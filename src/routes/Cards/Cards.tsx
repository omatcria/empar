import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  CalendarClock,
  Check,
  CreditCard,
  Pencil,
  Plus,
  RotateCcw,
  Search,
} from '@/components/icons'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useData } from '@/store/data'
import { useUI } from '@/store/ui'
import { useCanWrite } from '@/store/workspace'
import { invoiceTotal } from '@/engine'
import { mesRefLabel } from '@/engine/period'
import type { Card, CardKind, Context, Invoice } from '@/domain/types'
import { CARD_KIND_LABEL, CONTEXT_LABEL } from '@/domain/enums'
import { Button, Surface, ProgressBar } from '@/components/ui/primitives'
import { Money } from '@/components/ui/Money'
import { ContextBadge } from '@/components/ui/ContextBadge'
import { Modal } from '@/components/ui/Modal'
import { Field, Select, TextInput, MoneyInput } from '@/components/ui/form'
import { PALETTE } from '@/domain/palette'
import { BankBadge, BankPicker, bankById, colorChoices } from '@/domain/banks'
import { CardBrandLogo, CardBrandPicker, normalizeBrand } from '@/domain/card-brands'
import { formatBRL } from '@/lib/money'
import { TransactionList } from '@/features/transactions/TransactionList'
import { TransactionModal } from '@/features/transactions/TransactionModal'
import { ChevronDown, ChevronRight, ChevronLeft } from '@/components/icons'
import type { Transaction } from '@/domain/types'

export function Cards() {
  const { cards, invoices, transactions } = useData()
  const { viewMode } = useUI()
  const canWrite = useCanWrite()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Card | null>(null)
  const [detail, setDetail] = useState<Card | null>(null)
  const [search, setSearch] = useState('')

  const visiveis = useMemo(
    () =>
      cards.filter(
        (c) =>
          !c.arquivado &&
          (viewMode === 'CONSOLIDADO' || c.contexto === viewMode) &&
          c.nome.toLowerCase().includes(search.toLowerCase()),
      ),
    [cards, viewMode, search],
  )

  function openTotal(card: Card) {
    return invoices
      .filter((i) => i.card_id === card.id && !i.paga)
      .reduce((s, i) => s + invoiceTotal(i, transactions), 0)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-app-fg">Cartões</h1>
          <p className="text-sm text-app-muted">
            Todos os cartões, pessoais e PJ, num só lugar.
          </p>
        </div>
        {canWrite && (
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            <span className="hidden sm:inline">Novo cartão</span>
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-app-muted" />
          <TextInput
            type="search"
            placeholder="Buscar cartão..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {visiveis.length === 0 ? (
        <Surface className="p-10 text-center">
          <CreditCard className="mx-auto mb-3 size-8 text-app-muted" />
          <p className="text-sm text-app-muted">Nenhum cartão ainda.</p>
        </Surface>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visiveis.map((c) => {
            const aberto = openTotal(c)
            const disponivel = Math.max(0, c.limite_centavos - aberto)
            return (
              <Surface key={c.id} className="overflow-hidden p-0">
                <div className="p-4" style={{ background: `linear-gradient(135deg, ${c.cor}22, transparent)` }}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {c.banco ? (
                        <BankBadge id={c.banco} className="size-9 text-xs" />
                      ) : (
                        <span
                          className="grid size-9 place-items-center rounded-lg"
                          style={{ background: `${c.cor}33`, color: c.cor }}
                        >
                          <CreditCard className="size-5" />
                        </span>
                      )}
                      <div>
                        <p className="font-medium text-app-fg">{c.nome}</p>
                        <p className="text-xs text-app-muted">
                          {c.bandeira && !normalizeBrand(c.bandeira) ? `${c.bandeira} · ` : ''}
                          {CARD_KIND_LABEL[c.tipo]}
                        </p>
                      </div>
                    </div>
                    <ContextBadge contexto={c.contexto} iconOnly />
                  </div>

                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-app-muted">Em aberto (todas as faturas)</span>
                      <span className="tnum text-expense">{formatBRL(aberto)}</span>
                    </div>
                    <ProgressBar
                      value={aberto}
                      max={c.limite_centavos || 1}
                      colorClass="bg-expense"
                    />
                    <div className="mt-1 flex items-center justify-between text-xs text-app-muted">
                      <span>Disponível {formatBRL(disponivel)}</span>
                      <span>Limite {formatBRL(c.limite_centavos)}</span>
                    </div>
                    {normalizeBrand(c.bandeira) && (
                      <div className="mt-2 flex justify-end">
                        <CardBrandLogo brand={c.bandeira} className="h-6" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-app-border px-4 py-2 text-xs text-app-muted">
                  <span>Fecha dia {c.dia_fechamento} · vence dia {c.dia_vencimento}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setDetail(c)}
                      className="rounded-lg px-2 py-1 font-medium text-pessoal-strong hover:bg-app-surface-2 cursor-pointer"
                    >
                      Faturas
                    </button>
                    <button
                      aria-label="Editar"
                      onClick={() => setEditing(c)}
                      className="grid size-7 place-items-center rounded-lg hover:bg-app-surface-2 hover:text-app-fg cursor-pointer"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  </div>
                </div>
              </Surface>
            )
          })}
        </div>
      )}

      <CardFormModal open={creating} onClose={() => setCreating(false)} />
      <CardFormModal
        open={!!editing}
        card={editing ?? undefined}
        onClose={() => setEditing(null)}
      />
      {detail && (
        <InvoicesModal card={detail} open={!!detail} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}

/* ---------------- Modal criar/editar cartão ---------------- */
function CardFormModal({
  open,
  onClose,
  card,
}: {
  open: boolean
  onClose: () => void
  card?: Card
}) {
  const { accounts, addCard, updateCard, archiveCard } = useData()
  const { viewMode } = useUI()
  const isEdit = !!card
  const ctxInicial: Context =
    card?.contexto ?? (viewMode === 'EMPRESARIAL' ? 'EMPRESARIAL' : 'PESSOAL')

  const [nome, setNome] = useState(card?.nome ?? '')
  const [contexto, setContexto] = useState<Context>(ctxInicial)
  const [bandeira, setBandeira] = useState(normalizeBrand(card?.bandeira) ?? card?.bandeira ?? '')
  const [tipo, setTipo] = useState<CardKind>(card?.tipo ?? 'credito')
  const [limite, setLimite] = useState(card?.limite_centavos ?? 0)
  const [fech, setFech] = useState(card?.dia_fechamento ?? 20)
  const [venc, setVenc] = useState(card?.dia_vencimento ?? 28)
  const [pagamentoId, setPagamentoId] = useState(card?.account_pagamento_id ?? '')
  const [cor, setCor] = useState<string>(card?.cor ?? PALETTE[1])
  const [banco, setBanco] = useState<string | null>(card?.banco ?? null)
  const [saving, setSaving] = useState(false)

  // Preenche (ou limpa) os campos ao abrir — o modal fica montado, então os
  // inicializadores de useState não bastam para refletir o cartão em edição.
  useEffect(() => {
    if (!open) return
    setNome(card?.nome ?? '')
    setContexto(card?.contexto ?? (viewMode === 'EMPRESARIAL' ? 'EMPRESARIAL' : 'PESSOAL'))
    setBandeira(normalizeBrand(card?.bandeira) ?? card?.bandeira ?? '')
    setTipo(card?.tipo ?? 'credito')
    setLimite(card?.limite_centavos ?? 0)
    setFech(card?.dia_fechamento ?? 20)
    setVenc(card?.dia_vencimento ?? 28)
    setPagamentoId(card?.account_pagamento_id ?? '')
    setCor(card?.cor ?? PALETTE[1])
    setBanco(card?.banco ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, card])

  const contasCtx = accounts.filter((a) => !a.arquivada && a.contexto === contexto)

  async function salvar() {
    if (!nome.trim()) return
    setSaving(true)
    try {
      const payload = {
        nome: nome.trim(),
        bandeira: bandeira.trim() || null,
        tipo,
        limite_centavos: limite,
        dia_fechamento: fech,
        dia_vencimento: venc,
        account_pagamento_id: pagamentoId || null,
        cor,
        banco,
      }
      if (isEdit) await updateCard(card.id, payload)
      else await addCard({ ...payload, contexto })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar cartão' : 'Novo cartão'}
      footer={
        <>
          {isEdit && (
            <Button
              variant="ghost"
              className="mr-auto text-expense"
              icon={<Archive className="size-4" />}
              onClick={async () => {
                setSaving(true)
                await archiveCard(card.id)
                setSaving(false)
                onClose()
              }}
            >
              Arquivar
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} loading={saving} disabled={!nome.trim()}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nome" htmlFor="c-nome" required>
          <TextInput
            id="c-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Nubank, Inter PJ"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Contexto" htmlFor="c-ctx" hint={isEdit ? 'Fixo' : undefined}>
            <Select
              id="c-ctx"
              value={contexto}
              disabled={isEdit}
              onChange={(e) => setContexto(e.target.value as Context)}
            >
              <option value="PESSOAL">{CONTEXT_LABEL.PESSOAL}</option>
              <option value="EMPRESARIAL">{CONTEXT_LABEL.EMPRESARIAL}</option>
            </Select>
          </Field>
        </div>

        <Field label="Bandeira">
          <CardBrandPicker value={bandeira} onChange={(id) => setBandeira(id ?? '')} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo" htmlFor="c-tipo">
            <Select id="c-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as CardKind)}>
              <option value="credito">{CARD_KIND_LABEL.credito}</option>
              <option value="credito_debito">{CARD_KIND_LABEL.credito_debito}</option>
              <option value="debito">{CARD_KIND_LABEL.debito}</option>
            </Select>
          </Field>
          <Field label="Limite" htmlFor="c-lim">
            <MoneyInput id="c-lim" cents={limite} onChangeCents={setLimite} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Dia de fechamento" htmlFor="c-fech">
            <TextInput
              id="c-fech"
              type="number"
              min={1}
              max={31}
              value={fech}
              onChange={(e) => setFech(Number(e.target.value))}
            />
          </Field>
          <Field label="Dia de vencimento" htmlFor="c-venc">
            <TextInput
              id="c-venc"
              type="number"
              min={1}
              max={31}
              value={venc}
              onChange={(e) => setVenc(Number(e.target.value))}
            />
          </Field>
        </div>

        <Field label="Conta que paga a fatura" htmlFor="c-pag">
          <Select id="c-pag" value={pagamentoId} onChange={(e) => setPagamentoId(e.target.value)}>
            <option value="">— escolher depois —</option>
            {contasCtx.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Banco">
          <BankPicker
            value={banco}
            onChange={(id) => {
              setBanco(id)
              setCor(bankById(id)?.cor ?? cor)
            }}
          />
        </Field>

        <Field label="Cor">
          <div className="flex flex-wrap gap-2">
            {colorChoices(banco, PALETTE).map(({ cor: c, doBanco }) => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                title={doBanco ? 'Cor do banco' : undefined}
                aria-label={doBanco ? 'Cor do banco' : `Cor ${c}`}
                className={
                  'size-8 rounded-lg transition-transform ' +
                  (cor === c ? 'ring-2 ring-app-fg ring-offset-2 ring-offset-app-surface scale-110' : '')
                }
                style={{ background: c }}
              />
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  )
}

/** Desloca um 'YYYY-MM' por N meses. */
function shiftMes(ref: string, delta: number): string {
  const [y, m] = ref.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/* ---------------- Modal de faturas ---------------- */
function InvoicesModal({
  card,
  open,
  onClose,
}: {
  card: Card
  open: boolean
  onClose: () => void
}) {
  const { invoices, transactions, payInvoice } = useData()
  const { mes } = useUI()
  const [paying, setPaying] = useState<Invoice | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  // Mostra uma fatura por vez; começa no mês selecionado no app.
  const [mesView, setMesView] = useState(mes)

  const temFaturas = useMemo(
    () => invoices.some((i) => i.card_id === card.id),
    [invoices, card.id],
  )
  const inv = useMemo(
    () => invoices.find((i) => i.card_id === card.id && i.mes_referencia === mesView) ?? null,
    [invoices, card.id, mesView],
  )
  const invTxs = useMemo(
    () => (inv ? transactions.filter((t) => t.invoice_id === inv.id) : []),
    [inv, transactions],
  )
  const total = inv ? invoiceTotal(inv, transactions) : 0

  return (
    <Modal open={open} onClose={onClose} title={`Faturas · ${card.nome}`}>
      {/* Navegador de mês */}
      <div className="mb-3 flex items-center justify-between rounded-xl bg-app-surface-2 px-2 py-1.5">
        <button
          aria-label="Mês anterior"
          onClick={() => { setMesView((m) => shiftMes(m, -1)); setExpanded(false) }}
          className="grid size-8 place-items-center rounded-lg text-app-muted hover:bg-app-border/50 hover:text-app-fg cursor-pointer"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-semibold capitalize text-app-fg">{mesRefLabel(mesView)}</span>
        <button
          aria-label="Próximo mês"
          onClick={() => { setMesView((m) => shiftMes(m, 1)); setExpanded(false) }}
          className="grid size-8 place-items-center rounded-lg text-app-muted hover:bg-app-border/50 hover:text-app-fg cursor-pointer"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {!inv ? (
        <p className="py-8 text-center text-sm text-app-muted">
          {temFaturas
            ? 'Sem fatura neste mês. Use as setas para navegar.'
            : 'Sem faturas ainda. Lance uma compra no crédito neste cartão.'}
        </p>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-app-border bg-app-surface-2 p-3">
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('button')) return
              setExpanded((v) => !v)
            }}
          >
            <span
              className={
                'grid size-9 place-items-center rounded-lg ' +
                (inv.paga ? 'bg-income/15 text-income' : 'bg-warn/10 text-warn')
              }
            >
              {inv.paga ? <Check className="size-4" /> : <CalendarClock className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium capitalize text-app-fg">
                {mesRefLabel(inv.mes_referencia)}
              </p>
              <p className="text-xs text-app-muted">
                Vence {format(parseISO(inv.data_vencimento), "dd 'de' MMM", { locale: ptBR })}
                {` · ${invTxs.length} lançamento${invTxs.length === 1 ? '' : 's'}`}
                {inv.paga ? ' · paga' : ''}
              </p>
            </div>
            <Money cents={total} className="text-sm font-semibold" />
            <Button
              size="sm"
              variant={inv.paga ? 'ghost' : 'primary'}
              icon={inv.paga ? <RotateCcw className="size-3.5" /> : <Check className="size-3.5" />}
              onClick={(e) => {
                e.stopPropagation()
                inv.paga ? payInvoice(inv.id, false) : setPaying(inv)
              }}
            >
              {inv.paga ? 'Estornar' : 'Pagar'}
            </Button>
            <button className="grid size-8 place-items-center rounded-lg text-app-muted group-hover:text-app-fg cursor-pointer">
              {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          </div>

          {expanded && (
            <div className="pt-2 border-t border-app-border mt-1">
              <TransactionList transactions={invTxs} showContext={false} onEdit={setEditingTx} />
            </div>
          )}
        </div>
      )}
      <p className="mt-3 text-xs text-app-muted">
        Ao pagar, o total da fatura é descontado do saldo da conta escolhida.
      </p>

      {paying && (
        <PayInvoiceModal
          card={card}
          invoice={paying}
          total={invoiceTotal(paying, transactions)}
          onClose={() => setPaying(null)}
        />
      )}
      <TransactionModal open={!!editingTx} onClose={() => setEditingTx(null)} transaction={editingTx ?? undefined} />
    </Modal>
  )
}

/* ---------------- Confirmar pagamento da fatura ---------------- */
function PayInvoiceModal({
  card,
  invoice,
  total,
  onClose,
}: {
  card: Card
  invoice: Invoice
  total: number
  onClose: () => void
}) {
  const { accounts, payInvoice } = useData()
  const contas = accounts.filter((a) => !a.arquivada)
  const [contaId, setContaId] = useState(card.account_pagamento_id ?? contas[0]?.id ?? '')
  const [saving, setSaving] = useState(false)

  async function confirmar() {
    if (!contaId) return
    setSaving(true)
    try {
      await payInvoice(invoice.id, true, contaId)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Pagar fatura · ${mesRefLabel(invoice.mes_referencia)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={confirmar} loading={saving} disabled={!contaId}>
            Confirmar pagamento
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-xl bg-app-surface-2 px-4 py-3">
          <span className="text-sm text-app-muted">Total da fatura</span>
          <Money cents={total} className="text-lg font-bold text-app-fg" />
        </div>
        <Field label="Pagar com a conta" htmlFor="pay-conta" required>
          <Select id="pay-conta" value={contaId} onChange={(e) => setContaId(e.target.value)}>
            {contas.length === 0 && <option value="">Nenhuma conta cadastrada</option>}
            {contas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-app-muted">
          O valor será descontado do saldo dessa conta. Você pode estornar depois.
        </p>
      </div>
    </Modal>
  )
}
