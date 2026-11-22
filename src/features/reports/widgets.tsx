import { useMemo } from 'react'
import type { FC, ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useData } from '@/store/data'
import { useUI } from '@/store/ui'
import {
  buildDashboard,
  contextBalance,
  dreEmpresarial,
  fluxoMensal,
  isInMonth,
  lastMonths,
  nextMonths,
  projecaoSaldo,
} from '@/engine'
import { mesRefLabel } from '@/engine/period'
import { Surface, ProgressBar } from '@/components/ui/primitives'
import { Money } from '@/components/ui/Money'
import { ContextBadge } from '@/components/ui/ContextBadge'
import { PieDespesas, type PieSlice } from '@/components/charts/PieDespesas'
import { MeiCard } from '@/features/mei/MeiCard'
import { UpcomingDues } from '@/features/dues/UpcomingDues'
import { todayISO } from '@/lib/cn'
import { formatBRL, formatBRLCompact, type Cents } from '@/lib/money'

const COL = {
  income: '#578546',
  expense: '#b83131',
  pessoal: '#3b82f6',
  empresarial: '#7c3aed',
  grid: '#e2e7f1',
  axis: '#8a8aa3',
}
const tooltipStyle = {
  background: '#ffffff',
  border: '1px solid #e2e7f1',
  borderRadius: 12,
  color: '#201f2b',
  boxShadow: '0 4px 12px rgba(0,0,0,.06)',
}

/* ---------------- helpers ---------------- */
function useDash() {
  const data = useData()
  const { viewMode, mes } = useUI()
  const d = useMemo(
    () =>
      buildDashboard({
        accounts: data.accounts,
        cards: data.cards,
        invoices: data.invoices,
        transactions: data.transactions,
        provisions: data.provisions,
        categories: data.categories,
        mes,
        hoje: todayISO(),
      }),
    [data.accounts, data.cards, data.invoices, data.transactions, data.provisions, data.categories, mes],
  )
  return { d, viewMode, mes, data }
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Surface className="p-4">
      <h3 className="text-sm font-semibold text-app-fg">{title}</h3>
      <hr className="my-4 border-app-border" />
      {children}
    </Surface>
  )
}

function StatTile({
  label,
  value,
  signed,
  hint,
}: {
  label: string
  value: Cents
  signed?: boolean
  hint?: string
}) {
  return (
    <Surface className="p-4">
      <p className="text-xs text-app-muted">{label}</p>
      <Money cents={value} signed={signed} className="mt-1 block text-xl font-bold text-app-fg" />
      {hint && <p className="mt-1 text-[11px] leading-tight text-app-muted">{hint}</p>}
    </Surface>
  )
}

/* ---------------- widgets ---------------- */
const WidgetSaldos: FC = () => {
  const { d, viewMode } = useDash()
  const previsto =
    viewMode === 'PESSOAL'
      ? d.previstoPessoal
      : viewMode === 'EMPRESARIAL'
        ? d.previstoEmpresarial
        : d.previstoConsolidado
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile label="Patrimônio consolidado" value={d.saldoConsolidado} signed />
      <StatTile label="Saldo pessoal" value={d.saldoPessoal} signed />
      <StatTile label="Saldo empresarial" value={d.saldoEmpresarial} signed />
      <StatTile label="Saldo previsto" value={previsto} signed />
    </div>
  )
}

const WidgetCaixaEmpresa: FC = () => {
  const { d } = useDash()
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <StatTile
        label="Caixa disponível da empresa"
        value={d.caixaEmpresa}
        hint="Saldo PJ − impostos − pró-labore pendente"
      />
      <StatTile label="Impostos provisionados" value={d.totalProvisionado} />
    </div>
  )
}

const WidgetVidaPessoal: FC = () => {
  const { d } = useDash()
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <StatTile label="Vida pessoal do mês" value={d.vidaPessoalMes} signed />
      <StatTile label="Despesas pessoais no mês" value={d.despesaPessoalMes} />
    </div>
  )
}

const WidgetFaturas: FC = () => {
  const { d } = useDash()
  return <StatTile label="Faturas de cartão abertas" value={d.faturasAbertas} />
}

const WidgetReceitaDespesa: FC = () => {
  const { data, viewMode, mes } = useDash()
  const meses = useMemo(() => lastMonths(mes, 6), [mes])
  const fluxo = useMemo(
    () => fluxoMensal(data.transactions, viewMode, meses),
    [data.transactions, viewMode, meses],
  )
  const barData = fluxo.map((f) => ({
    mes: mesRefLabel(f.mes),
    Receitas: f.receita,
    Despesas: f.despesa,
  }))
  return (
    <Shell title="Receitas × Despesas (6 meses)">
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} barGap={4}>
            <CartesianGrid stroke={COL.grid} vertical={false} />
            <XAxis dataKey="mes" stroke={COL.axis} fontSize={12} tickLine={false} />
            <YAxis stroke={COL.axis} fontSize={11} tickLine={false} width={60} tickFormatter={(v) => formatBRLCompact(Number(v))} />
            <Tooltip formatter={(v) => formatBRL(Number(v))} contentStyle={tooltipStyle} cursor={{ fill: '#00000008' }} />
            <Bar dataKey="Receitas" fill={COL.income} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Despesas" fill={COL.expense} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Shell>
  )
}

const WidgetEvolucao: FC = () => {
  const { data, viewMode, mes } = useDash()
  const meses = useMemo(() => lastMonths(mes, 6), [mes])
  const fluxo = useMemo(() => fluxoMensal(data.transactions, viewMode, meses), [data.transactions, viewMode, meses])
  const saldoAtual = useMemo(() => {
    const bctx = { cards: data.cards, invoices: data.invoices, asOf: todayISO() }
    if (viewMode === 'CONSOLIDADO')
      return (
        contextBalance('PESSOAL', data.accounts, data.transactions, bctx) +
        contextBalance('EMPRESARIAL', data.accounts, data.transactions, bctx)
      )
    return contextBalance(viewMode, data.accounts, data.transactions, bctx)
  }, [data.accounts, data.transactions, data.cards, data.invoices, viewMode])

  const lineData = useMemo(() => {
    const bal: number[] = new Array(meses.length)
    bal[meses.length - 1] = saldoAtual
    for (let i = meses.length - 2; i >= 0; i--) bal[i] = bal[i + 1] - fluxo[i + 1].resultado
    const proj = projecaoSaldo(saldoAtual, data.recurrences, viewMode, nextMonths(mes, 6))
    return [
      ...meses.map((m, i) => ({
        mes: mesRefLabel(m),
        saldo: bal[i],
        projecao: i === meses.length - 1 ? saldoAtual : null,
      })),
      ...proj.map((p) => ({ mes: mesRefLabel(p.mes), saldo: null, projecao: p.saldo })),
    ]
  }, [meses, fluxo, saldoAtual, data.recurrences, viewMode, mes])

  return (
    <Shell title="Evolução do saldo + projeção">
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={lineData}>
            <CartesianGrid stroke={COL.grid} vertical={false} />
            <XAxis dataKey="mes" stroke={COL.axis} fontSize={11} tickLine={false} />
            <YAxis stroke={COL.axis} fontSize={11} tickLine={false} width={60} tickFormatter={(v) => formatBRLCompact(Number(v))} />
            <Tooltip formatter={(v) => formatBRL(Number(v))} contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="saldo" stroke={COL.pessoal} strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="projecao" stroke={COL.empresarial} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Shell>
  )
}

const WidgetDRE: FC = () => {
  const { data, mes } = useDash()
  const dre = useMemo(() => dreEmpresarial(data.transactions, data.categories, mes), [data.transactions, data.categories, mes])
  const Row = ({ label, value, bold }: { label: string; value: number; bold?: boolean }) => (
    <div className="flex items-center justify-between">
      <span className={bold ? 'font-semibold text-app-fg' : 'text-app-muted'}>{label}</span>
      <Money cents={value} signed={bold} className={bold ? 'text-base font-bold' : 'text-app-fg2'} />
    </div>
  )
  return (
    <Shell title={`DRE simplificada — empresa · ${mesRefLabel(mes)}`}>
      <div className="space-y-1.5 text-sm">
        <Row label="Receita de serviços/vendas" value={dre.receita} />
        <Row label="(−) Custos e despesas" value={-dre.custos} />
        <Row label="(−) Impostos" value={-dre.impostos} />
        <Row label="(−) Pró-labore" value={-dre.proLabore} />
        {dre.distribuicao > 0 && <Row label="(−) Distribuição de lucros" value={-dre.distribuicao} />}
        <div className="my-2 border-t border-app-border" />
        <Row label="(=) Resultado" value={dre.resultado} bold />
      </div>
    </Shell>
  )
}

const WidgetPizza: FC = () => {
  const { data, viewMode, mes } = useDash()
  const pie = useMemo<PieSlice[]>(() => {
    const catById = new Map(data.categories.map((c) => [c.id, c]))
    const totals = new Map<string, Cents>()
    for (const t of data.transactions) {
      if (t.tipo !== 'DESPESA' || !isInMonth(t.data, mes)) continue
      if (viewMode !== 'CONSOLIDADO' && t.contexto !== viewMode) continue
      if (viewMode === 'CONSOLIDADO' && t.transfer_id) continue
      totals.set(t.category_id, (totals.get(t.category_id) ?? 0) + t.valor_centavos)
    }
    return [...totals.entries()]
      .map(([id, value]) => ({
        name: catById.get(id)?.nome ?? 'Outros',
        value,
        color: catById.get(id)?.cor ?? '#8a8aa3',
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [data.transactions, data.categories, mes, viewMode])

  return (
    <Shell title={`Despesas por categoria · ${mesRefLabel(mes)}`}>
      {pie.length > 0 ? (
        <PieDespesas data={pie} />
      ) : (
        <p className="py-6 text-center text-sm text-app-muted">Sem despesas neste mês.</p>
      )}
    </Shell>
  )
}

const WidgetAPagar: FC = () => <UpcomingDues />

const WidgetMetas: FC = () => {
  const { data, viewMode } = useDash()
  const metas = data.goals.filter((g) => viewMode === 'CONSOLIDADO' || g.contexto === viewMode)
  return (
    <Shell title="Metas">
      {metas.length === 0 ? (
        <p className="py-4 text-center text-sm text-app-muted">Nenhuma meta.</p>
      ) : (
        <div className="space-y-3">
          {metas.map((g) => {
            const pct = g.valor_alvo_centavos > 0 ? Math.min(100, Math.round((g.valor_atual_centavos / g.valor_alvo_centavos) * 100)) : 0
            return (
              <div key={g.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-app-fg">
                    <ContextBadge contexto={g.contexto} iconOnly />
                    {g.nome}
                  </span>
                  <span className="text-app-muted">{pct}%</span>
                </div>
                <ProgressBar value={g.valor_atual_centavos} max={g.valor_alvo_centavos || 1} colorClass={pct >= 100 ? 'bg-income' : 'bg-pessoal'} />
              </div>
            )
          })}
        </div>
      )}
    </Shell>
  )
}

/* ---------------- registro ---------------- */
export interface WidgetDef {
  id: string
  title: string
  span: 'full' | 'half'
  Component: FC
}

export const WIDGETS: WidgetDef[] = [
  { id: 'saldos', title: 'Saldos (consolidado / pessoal / empresarial)', span: 'full', Component: WidgetSaldos },
  { id: 'caixa-empresa', title: 'Caixa da empresa + impostos', span: 'full', Component: WidgetCaixaEmpresa },
  { id: 'vida-pessoal', title: 'Vida pessoal do mês', span: 'full', Component: WidgetVidaPessoal },
  { id: 'faturas', title: 'Faturas de cartão abertas', span: 'half', Component: WidgetFaturas },
  { id: 'receita-despesa', title: 'Receitas × Despesas (6 meses)', span: 'full', Component: WidgetReceitaDespesa },
  { id: 'evolucao', title: 'Evolução do saldo + projeção', span: 'full', Component: WidgetEvolucao },
  { id: 'dre', title: 'DRE simplificada (empresa)', span: 'full', Component: WidgetDRE },
  { id: 'pizza', title: 'Despesas por categoria (pizza)', span: 'full', Component: WidgetPizza },
  { id: 'a-pagar', title: 'A pagar / a receber', span: 'full', Component: WidgetAPagar },
  { id: 'metas', title: 'Progresso das metas', span: 'full', Component: WidgetMetas },
  { id: 'mei', title: 'Limite do MEI', span: 'full', Component: MeiCard },
]

export const WIDGET_MAP = new Map(WIDGETS.map((w) => [w.id, w]))
