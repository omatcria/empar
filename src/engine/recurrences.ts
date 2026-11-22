import { addDays, addMonths, addYears, getDaysInMonth, parseISO, format } from 'date-fns'
import type { Account, Card, Context, RecurrenceFreq, TransactionInsert, TxType } from '@/domain/types'
import type { Cents } from '@/lib/money'

/** Molde de transação guardado em `recurrences.template` (jsonb). */
export interface RecurrenceTemplate {
  tipo: 'RECEITA' | 'DESPESA'
  account_id?: string | null
  card_id?: string | null
  category_id: string
  valor_centavos: number
  descricao: string
  pago?: boolean
}

function withDay(base: Date, day: number): Date {
  const dd = Math.min(day, getDaysInMonth(base))
  return new Date(base.getFullYear(), base.getMonth(), dd)
}

/** Próxima data de uma recorrência a partir de uma data. */
export function advanceDate(
  dateISO: string,
  freq: RecurrenceFreq,
  dia: number,
): string {
  const d = parseISO(dateISO)
  if (freq === 'semanal') return format(addDays(d, 7), 'yyyy-MM-dd')
  if (freq === 'anual') return format(addYears(d, 1), 'yyyy-MM-dd')
  // mensal: mesmo dia do mês (com clamp para meses curtos)
  return format(withDay(addMonths(d, 1), dia), 'yyyy-MM-dd')
}

export interface DueResult {
  /** Datas que deveriam ter sido geradas (inclui atrasadas) até hoje. */
  dates: string[]
  /** Nova próxima data (a primeira ainda no futuro). */
  novaProxima: string
}

/** Ocorrências devidas de uma recorrência entre `proximaData` e hoje. */
export function dueOccurrences(
  proximaData: string,
  freq: RecurrenceFreq,
  dia: number,
  todayISO: string,
): DueResult {
  const dates: string[] = []
  let cur = proximaData
  let guard = 0
  while (cur <= todayISO && guard < 500) {
    dates.push(cur)
    cur = advanceDate(cur, freq, dia)
    guard++
  }
  return { dates, novaProxima: cur }
}

export type RecurrenceTarget =
  | { kind: 'conta'; accountId: string }
  | { kind: 'cartao'; card: Card }

/** Resolve o alvo (conta ou cartão de crédito) do molde; `null` se inválido/inexistente. */
export function resolveRecurrenceTarget(
  tpl: RecurrenceTemplate,
  accounts: Account[],
  cards: Card[],
): RecurrenceTarget | null {
  if (!tpl?.category_id) return null
  if (tpl.card_id) {
    const card = cards.find((c) => c.id === tpl.card_id)
    if (!card || card.arquivado || card.tipo === 'debito') return null
    return { kind: 'cartao', card }
  }
  if (tpl.account_id) {
    const acc = accounts.find((a) => a.id === tpl.account_id)
    return acc ? { kind: 'conta', accountId: acc.id } : null
  }
  return null
}

/** Insert da transação de uma ocorrência (no cartão, o store completa `invoice_id`). */
export function buildRecurrenceTx(
  tpl: RecurrenceTemplate,
  target: RecurrenceTarget,
  contexto: Context,
  data: string,
  recurrenceId: string,
): Omit<TransactionInsert, 'user_id' | 'workspace_id'> {
  const base = {
    contexto,
    tipo: tpl.tipo,
    category_id: tpl.category_id,
    valor_centavos: tpl.valor_centavos,
    data,
    descricao: tpl.descricao,
    recorrencia_id: recurrenceId,
  }
  if (target.kind === 'cartao') return { ...base, card_id: target.card.id, pago: true }
  return { ...base, account_id: target.accountId, pago: tpl.pago ?? true }
}

export interface LaunchRecurrenceParams {
  contexto: Context
  tipo: TxType
  data: string
  frequencia: RecurrenceFreq
  accountId?: string | null
  cardId?: string | null
  categoryId: string
  valor: Cents
  descricao: string
  pago: boolean
}

/** Monta a recorrência criada a partir de um lançamento (a primeira ocorrência já existe). */
export function buildRecurrenceFromLaunch(p: LaunchRecurrenceParams): {
  contexto: Context
  template: RecurrenceTemplate
  frequencia: RecurrenceFreq
  dia: number
  proxima_data: string
  ativo: true
} {
  const dia = Number(p.data.slice(8, 10))
  const cartao = !!p.cardId
  return {
    contexto: p.contexto,
    template: {
      tipo: p.tipo,
      account_id: cartao ? null : (p.accountId ?? null),
      card_id: cartao ? p.cardId : null,
      category_id: p.categoryId,
      valor_centavos: p.valor,
      descricao: p.descricao,
      pago: cartao ? true : p.pago,
    },
    frequencia: p.frequencia,
    dia,
    proxima_data: advanceDate(p.data, p.frequencia, dia),
    ativo: true,
  }
}
