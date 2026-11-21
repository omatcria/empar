import { useMemo } from 'react'
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CreditCard } from '@/components/icons'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useData } from '@/store/data'
import { useUI } from '@/store/ui'
import { invoiceTotal } from '@/engine'
import { Surface, Button } from '@/components/ui/primitives'
import { Money } from '@/components/ui/Money'
import { todayISO } from '@/lib/cn'
import type { Cents } from '@/lib/money'

interface DueItem {
  id: string
  kind: 'tx' | 'invoice'
  label: string
  due: string
  valor: Cents
  fluxo: 'pagar' | 'receber'
  onResolve: () => void
}

export function UpcomingDues() {
  const {
    transactions,
    invoices,
    cards,
    categories,
    togglePago,
    payInvoice,
  } = useData()
  const { viewMode } = useUI()
  const hoje = todayISO()

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const itens = useMemo<DueItem[]>(() => {
    const ctxOk = (ctx: 'PESSOAL' | 'EMPRESARIAL') =>
      viewMode === 'CONSOLIDADO' || ctx === viewMode

    const txItems: DueItem[] = transactions
      .filter((t) => !t.pago && !t.card_id && ctxOk(t.contexto))
      .map((t) => ({
        id: t.id,
        kind: 'tx' as const,
        label: t.descricao || catById.get(t.category_id)?.nome || 'Lançamento',
        due: t.data_vencimento ?? t.data,
        valor: t.valor_centavos,
        fluxo: t.tipo === 'DESPESA' ? ('pagar' as const) : ('receber' as const),
        onResolve: () => togglePago(t.id),
      }))

    const invItems: DueItem[] = invoices
      .filter((i) => !i.paga)
      .filter((i) => {
        const card = cardById.get(i.card_id)
        return card && ctxOk(card.contexto)
      })
      .map((i) => ({
        id: i.id,
        kind: 'invoice' as const,
        label: `Fatura ${cardById.get(i.card_id)?.nome ?? ''}`.trim(),
        due: i.data_vencimento,
        valor: invoiceTotal(i, transactions),
        fluxo: 'pagar' as const,
        onResolve: () => payInvoice(i.id, true),
      }))
      .filter((i) => i.valor > 0)

    return [...txItems, ...invItems]
      .sort((a, b) => a.due.localeCompare(b.due))
      .slice(0, 6)
  }, [transactions, invoices, cardById, catById, viewMode, togglePago, payInvoice])

  if (itens.length === 0) return null

  const atrasados = itens.filter((i) => i.due < hoje).length

  return (
    <Surface className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-app-fg">A pagar / a receber</h2>
        {atrasados > 0 && (
          <span className="flex items-center gap-1 text-xs text-expense">
            <AlertTriangle className="size-3.5" /> {atrasados} atrasado(s)
          </span>
        )}
      </div>

      <div className="space-y-1">
        {itens.map((it) => {
          const dias = differenceInCalendarDays(parseISO(it.due), parseISO(hoje))
          const atrasado = dias < 0
          const urgente = dias >= 0 && dias <= 3
          return (
            <div key={`${it.kind}-${it.id}`} className="flex items-center gap-3 py-2">
              <span
                className={
                  'grid size-8 shrink-0 place-items-center rounded-lg ' +
                  (it.kind === 'invoice'
                    ? 'bg-app-surface-2 text-app-muted'
                    : it.fluxo === 'pagar'
                      ? 'bg-expense/10 text-expense'
                      : 'bg-income/10 text-income')
                }
              >
                {it.kind === 'invoice' ? (
                  <CreditCard className="size-4" />
                ) : it.fluxo === 'pagar' ? (
                  <ArrowUpRight className="size-4" />
                ) : (
                  <ArrowDownLeft className="size-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-app-fg">{it.label}</p>
                <p
                  className={
                    'text-xs ' +
                    (atrasado ? 'text-expense' : urgente ? 'text-warn' : 'text-app-muted')
                  }
                >
                  {atrasado
                    ? `Atrasado · venceu ${format(parseISO(it.due), "dd/MM", { locale: ptBR })}`
                    : `Vence ${format(parseISO(it.due), "dd 'de' MMM", { locale: ptBR })}`}
                </p>
              </div>
              <Money cents={it.valor} className="text-sm font-semibold text-app-fg" />
              <Button size="sm" variant="secondary" onClick={it.onResolve}>
                {it.fluxo === 'pagar' ? 'Pagar' : 'Receber'}
              </Button>
            </div>
          )
        })}
      </div>
    </Surface>
  )
}
