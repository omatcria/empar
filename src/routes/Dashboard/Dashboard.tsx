import { useMemo } from 'react'
import type { ReactNode } from 'react'
import {
  Building2,
  PiggyBank,
  Receipt,
  TrendingDown,
  TrendingUp,
  User,
  Wallet,
} from '@/components/icons'
import { useData } from '@/store/data'
import { useUI } from '@/store/ui'
import { buildDashboard, isInMonth } from '@/engine'
import { Money } from '@/components/ui/Money'
import { Surface } from '@/components/ui/primitives'
import { PieDespesas, type PieSlice } from '@/components/charts/PieDespesas'
import { UpcomingDues } from '@/features/dues/UpcomingDues'
import { mesRefLabel } from '@/engine/period'
import { MeiCard } from '@/features/mei/MeiCard'
import { cn } from '@/lib/cn'
import type { Cents } from '@/lib/money'

export function Dashboard() {
  const { accounts, cards, invoices, transactions, provisions, categories } =
    useData()
  const { viewMode, mes } = useUI()

  const d = useMemo(
    () =>
      buildDashboard({
        accounts,
        cards,
        invoices,
        transactions,
        provisions,
        categories,
        mes,
      }),
    [accounts, cards, invoices, transactions, provisions, categories, mes],
  )

  // Despesas por categoria (respeitando o contexto do seletor)
  const pie = useMemo<PieSlice[]>(() => {
    const catById = new Map(categories.map((c) => [c.id, c]))
    const totals = new Map<string, Cents>()
    for (const t of transactions) {
      if (t.tipo !== 'DESPESA') continue
      if (!isInMonth(t.data, mes)) continue
      if (viewMode !== 'CONSOLIDADO' && t.contexto !== viewMode) continue
      if (viewMode === 'CONSOLIDADO' && t.transfer_id) continue // sem transferências
      totals.set(t.category_id, (totals.get(t.category_id) ?? 0) + t.valor_centavos)
    }
    return [...totals.entries()]
      .map(([id, value]) => ({
        name: catById.get(id)?.nome ?? 'Outros',
        value,
        color: catById.get(id)?.cor ?? '#64748b',
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [transactions, categories, mes, viewMode])

  const heroValor =
    viewMode === 'PESSOAL'
      ? d.saldoPessoal
      : viewMode === 'EMPRESARIAL'
        ? d.saldoEmpresarial
        : d.saldoConsolidado

  const heroLabel =
    viewMode === 'PESSOAL'
      ? 'Saldo pessoal'
      : viewMode === 'EMPRESARIAL'
        ? 'Saldo empresarial'
        : 'Patrimônio consolidado'

  return (
    <div className="space-y-6">
      {/* Hero saldo */}
      <Surface
        className={cn(
          'relative overflow-hidden p-6',
          viewMode === 'PESSOAL' && 'ring-1 ring-pessoal/30',
          viewMode === 'EMPRESARIAL' && 'ring-1 ring-empresarial/30',
        )}
      >
        <p className="text-sm text-app-muted">
          {heroLabel} · {mesRefLabel(mes)}
        </p>
        <Money cents={heroValor} className="mt-1 block text-4xl font-bold text-app-fg" />

        {viewMode === 'CONSOLIDADO' && (
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <User className="size-4 text-pessoal-strong" />
              <span className="text-app-muted">Pessoal</span>
              <Money cents={d.saldoPessoal} className="font-semibold text-app-fg" />
            </span>
            <span className="flex items-center gap-1.5">
              <Building2 className="size-4 text-empresarial-strong" />
              <span className="text-app-muted">Empresarial</span>
              <Money cents={d.saldoEmpresarial} className="font-semibold text-app-fg" />
            </span>
          </div>
        )}
      </Surface>

      {/* Cards por contexto */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(viewMode === 'EMPRESARIAL' || viewMode === 'CONSOLIDADO') && (
          <>
            <StatCard
              icon={<Wallet className="size-5" />}
              tone="empresarial"
              label="Caixa disponível da empresa"
              value={d.caixaEmpresa}
              hint="Saldo PJ − impostos provisionados − pró-labore pendente"
            />
            <StatCard
              icon={<Receipt className="size-5" />}
              tone="warn"
              label="Impostos provisionados"
              value={d.totalProvisionado}
              hint="Guardado nos envelopes ativos"
            />
          </>
        )}
        <MeiCard />

        {(viewMode === 'PESSOAL' || viewMode === 'CONSOLIDADO') && (
          <StatCard
            icon={<PiggyBank className="size-5" />}
            tone="pessoal"
            label="Vida pessoal do mês"
            value={d.vidaPessoalMes}
            signed
            hint="Salário + pró-labore − despesas pessoais"
          />
        )}

        {viewMode !== 'EMPRESARIAL' && (
          <StatCard
            icon={<TrendingUp className="size-5" />}
            tone="income"
            label="Receitas pessoais no mês"
            value={d.receitaPessoalMes}
          />
        )}
        {viewMode !== 'EMPRESARIAL' && (
          <StatCard
            icon={<TrendingDown className="size-5" />}
            tone="expense"
            label="Despesas pessoais no mês"
            value={d.despesaPessoalMes}
          />
        )}
        {viewMode !== 'PESSOAL' && (
          <StatCard
            icon={<TrendingUp className="size-5" />}
            tone="income"
            label="Receita PJ no mês"
            value={d.receitaEmpresarialMes}
          />
        )}
        {viewMode !== 'PESSOAL' && (
          <StatCard
            icon={<TrendingDown className="size-5" />}
            tone="expense"
            label="Despesa PJ no mês"
            value={d.despesaEmpresarialMes}
          />
        )}

        <StatCard
          icon={<Receipt className="size-5" />}
          tone="neutral"
          label="Faturas de cartão abertas"
          value={d.faturasAbertas}
        />
      </div>

      {/* A pagar / a receber */}
      <UpcomingDues />

      {/* Pizza de despesas */}
      <Surface className="p-6">
        <h2 className="mb-4 text-sm font-semibold text-app-fg">
          Despesas por categoria · {mesRefLabel(mes)}
        </h2>
        {pie.length > 0 ? (
          <PieDespesas data={pie} />
        ) : (
          <p className="py-8 text-center text-sm text-app-muted">
            Sem despesas neste mês. Lance uma transação para ver o gráfico.
          </p>
        )}
      </Surface>
    </div>
  )
}

/* ---------------- StatCard ---------------- */
type Tone = 'pessoal' | 'empresarial' | 'income' | 'expense' | 'warn' | 'neutral'

const toneIcon: Record<Tone, string> = {
  pessoal: 'text-pessoal-strong bg-pessoal-soft',
  empresarial: 'text-empresarial-strong bg-empresarial-soft',
  income: 'text-income bg-income/10',
  expense: 'text-expense bg-expense/10',
  warn: 'text-warn bg-warn/10',
  neutral: 'text-app-muted bg-app-surface-2',
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
  signed,
}: {
  icon: ReactNode
  label: string
  value: Cents
  hint?: string
  tone: Tone
  signed?: boolean
}) {
  return (
    <Surface className="p-4">
      <div className="flex items-start gap-3">
        <span className={cn('grid size-10 place-items-center rounded-xl', toneIcon[tone])}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-app-muted">{label}</p>
          <Money
            cents={value}
            signed={signed}
            className="mt-0.5 block text-xl font-bold text-app-fg"
          />
          {hint && <p className="mt-1 text-[11px] leading-tight text-app-muted">{hint}</p>}
        </div>
      </div>
    </Surface>
  )
}
