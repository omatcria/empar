import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Budget, Category, Invoice, Transaction } from '@/domain/types'
import { formatBRL, type Cents } from '@/lib/money'
import { categorySpend } from './balances'
import { invoiceTotal } from './invoices'
import { meiMessage, type MeiStatus } from './mei'

/**
 * Geração DERIVADA de notificações — engine PURA (sem React/DB).
 * A app chama isto ao carregar o espaço e persiste o que ainda não existe.
 * A deduplicação é por `dedupe_key` (guardado em `notifications.meta.dedupe_key`).
 */

export type NotifTipo = 'venc_fatura' | 'venc_conta' | 'orcamento_80' | 'mei'

/** Só os campos das preferências que interessam à geração. */
export interface NotifPrefsLike {
  venc_faturas: boolean
  venc_contas: boolean
  orcamento_80: boolean
  mei_alertas: boolean
}

export interface PendingNotification {
  tipo: NotifTipo
  titulo: string
  corpo: string
  /** Chave estável para não recriar a mesma notificação. */
  dedupe_key: string
  meta: Record<string, unknown>
}

export interface ComputeNotificationsInput {
  /** Data de referência ISO 'YYYY-MM-DD' (hoje). */
  today: string
  prefs: NotifPrefsLike
  invoices: Invoice[]
  transactions: Transaction[]
  budgets: Budget[]
  categories: Category[]
  /** Situação do limite MEI do ano corrente (só quando o espaço tem MEI ativo). */
  mei?: { year: number; status: MeiStatus }
  /** Mapa card_id → nome, para rótulos mais amigáveis. */
  cardNames?: Map<string, string>
  /** Chaves já notificadas (para não duplicar). */
  existingKeys?: Set<string>
  /** Janela de antecedência para vencimentos (dias). Default 5. */
  windowDays?: number
}

/** ISO 'YYYY-MM-DD' → 'DD/MM' (sem depender de locale). */
function ddmm(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function plural(n: number, s: string): string {
  return `${n} ${s}${n === 1 ? '' : 's'}`
}

export function computeNotifications(input: ComputeNotificationsInput): PendingNotification[] {
  const { today, prefs, invoices, transactions, budgets, categories } = input
  const windowDays = input.windowDays ?? 5
  const existing = input.existingKeys ?? new Set<string>()
  const cardNames = input.cardNames ?? new Map<string, string>()

  const out: PendingNotification[] = []
  const push = (n: PendingNotification) => {
    if (existing.has(n.dedupe_key)) return
    if (out.some((o) => o.dedupe_key === n.dedupe_key)) return
    out.push(n)
  }

  const daysUntil = (iso: string) =>
    differenceInCalendarDays(parseISO(iso), parseISO(today))

  const venceLabel = (d: number, sujeito: string) =>
    d < 0
      ? `${sujeito} vencida`
      : d === 0
        ? `${sujeito} vence hoje`
        : `${sujeito} vence em ${plural(d, 'dia')}`

  /* ---------- Faturas a vencer ---------- */
  if (prefs.venc_faturas) {
    for (const inv of invoices) {
      if (inv.paga) continue
      const total = invoiceTotal(inv, transactions)
      if (total <= 0) continue
      const d = daysUntil(inv.data_vencimento)
      if (d > windowDays) continue // ainda longe da janela
      const nome = cardNames.get(inv.card_id)
      const sujeito = nome ? `Fatura do ${nome}` : 'Fatura'
      push({
        tipo: 'venc_fatura',
        titulo: venceLabel(d, sujeito),
        corpo: `${formatBRL(total)} · vencimento ${ddmm(inv.data_vencimento)}`,
        dedupe_key: `venc_fatura:${inv.id}`,
        meta: { invoice_id: inv.id, valor: total, vencimento: inv.data_vencimento },
      })
    }
  }

  /* ---------- Contas (transações não-cartão) a pagar ---------- */
  if (prefs.venc_contas) {
    for (const t of transactions) {
      if (t.pago || t.card_id) continue
      if (t.tipo !== 'DESPESA') continue
      const due = t.data_vencimento ?? t.data
      const d = daysUntil(due)
      if (d > windowDays) continue
      const nome = t.descricao || 'Conta'
      push({
        tipo: 'venc_conta',
        titulo: venceLabel(d, nome),
        corpo: `${formatBRL(t.valor_centavos)} · vencimento ${ddmm(due)}`,
        dedupe_key: `venc_conta:${t.id}`,
        meta: { transaction_id: t.id, valor: t.valor_centavos, vencimento: due },
      })
    }
  }

  /* ---------- 80% do limite do orçamento (mês corrente) ---------- */
  if (prefs.orcamento_80) {
    const mes = today.slice(0, 7)
    const catById = new Map(categories.map((c) => [c.id, c]))
    for (const b of budgets) {
      if (b.mes_referencia !== mes) continue
      if (b.limite_centavos <= 0) continue
      const gasto: Cents = categorySpend(b.category_id, transactions, mes)
      const pct = gasto / b.limite_centavos
      if (pct < 0.8) continue
      const estourou = gasto > b.limite_centavos
      const cat = catById.get(b.category_id)
      const nome = cat?.nome ?? 'categoria'
      // Duas bandas: um aviso ao passar de 80% e outro ao estourar 100%.
      const band = estourou ? 'over' : '80'
      push({
        tipo: 'orcamento_80',
        titulo: estourou
          ? `Orçamento de ${nome} estourado`
          : `Orçamento de ${nome} em ${Math.round(pct * 100)}%`,
        corpo: `${formatBRL(gasto)} de ${formatBRL(b.limite_centavos)} usados`,
        dedupe_key: `orcamento_80:${b.id}:${mes}:${band}`,
        meta: {
          budget_id: b.id,
          category_id: b.category_id,
          gasto,
          limite: b.limite_centavos,
          mes,
        },
      })
    }
  }

  /* ---------- Limite do MEI (uma notificação por ano e nível) ---------- */
  if (prefs.mei_alertas && input.mei && input.mei.status.nivel !== 'ok') {
    const { year, status } = input.mei
    const msg = meiMessage(status, year)
    push({
      tipo: 'mei',
      titulo: msg.titulo,
      corpo: msg.texto,
      dedupe_key: `mei-${year}-${status.nivel}`,
      meta: { year, nivel: status.nivel, valor: status.valor, limite: status.limite },
    })
  }

  return out
}
