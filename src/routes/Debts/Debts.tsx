import { useState } from 'react'
import { Info, Plus } from '@/components/icons'
import { Button, Surface } from '@/components/ui/primitives'
import { DebtCard } from '@/features/debts/DebtCard'
import { DebtFormModal } from '@/features/debts/DebtFormModal'
import { debtsTotals } from '@/engine/debts'
import { formatBRL } from '@/lib/money'
import { useDebts } from '@/store/debts'
import { useUI } from '@/store/ui'
import { useCanWrite } from '@/store/workspace'
import type { Debt } from '@/domain/types'

export function Debts() {
  const { debts, installments, loaded, loadError } = useDebts()
  const viewMode = useUI(s => s.viewMode)
  const canWrite = useCanWrite()
  const [creating,setCreating] = useState(false)
  const [editing,setEditing] = useState<Debt | null>(null)
  const visible = debts.filter(d => viewMode === 'CONSOLIDADO' || d.contexto === viewMode)
  const totals = debtsTotals(visible, installments)
  const stats = [['Total em acordos',totals.totalAcordos],['Já pago',totals.pago],['Restante',totals.restante],['Economia negociada',totals.economia]] as const
  if (loadError) return <p role="alert">Não foi possível carregar as dívidas: {loadError}</p>
  if (!loaded) return <p>Carregando dívidas…</p>
  return <div className="space-y-5"><div className="flex items-center justify-between"><div><h1 className="text-xl font-bold text-app-fg">Dívidas</h1><p className="text-sm text-app-muted">Acompanhe seus acordos e parcelas.</p></div>{canWrite && <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Nova dívida</Button>}</div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{stats.map(([label,value]) => <Surface key={label} className="p-4"><p className="text-xs text-app-muted">{label}</p><p className="mt-1 text-lg font-semibold">{formatBRL(value)}</p></Surface>)}</div>
    <p className="flex gap-2 rounded-xl bg-app-surface-2 p-4 text-sm text-app-muted"><Info className="size-5 shrink-0" /> Dívidas são acompanhadas separadamente e não alteram saldos, despesas ou valores a pagar no painel.</p>
    {visible.length ? <div className="grid gap-3 lg:grid-cols-2">{visible.map(d => <DebtCard key={d.id} debt={d} installments={installments.filter(i => i.debt_id === d.id)} canWrite={canWrite} onEdit={() => setEditing(d)} />)}</div> : <Surface className="p-10 text-center text-sm text-app-muted">Nenhuma dívida cadastrada.</Surface>}
    {creating && <DebtFormModal onClose={() => setCreating(false)} />}{editing && <DebtFormModal debt={editing} onClose={() => setEditing(null)} />}
  </div>
}
