import { useState } from 'react'
import { Button, ProgressBar, Surface } from '@/components/ui/primitives'
import { ContextBadge } from '@/components/ui/ContextBadge'
import { Modal } from '@/components/ui/Modal'
import { Field, MoneyInput, TextInput } from '@/components/ui/form'
import { debtSummary } from '@/engine/debts'
import { formatBRL } from '@/lib/money'
import { useDebts } from '@/store/debts'
import type { Debt, DebtInstallment } from '@/domain/types'

const dateBR = (d: string) => d.split('-').reverse().join('/')
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

export function DebtCard({ debt, installments, canWrite, onEdit }: { debt: Debt; installments: DebtInstallment[]; canWrite: boolean; onEdit: () => void }) {
  const { setInstallmentPaid, payAll, deleteDebt, updateInstallment } = useDebts()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DebtInstallment | null>(null)
  const [amount, setAmount] = useState(0)
  const [due, setDue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const summary = debtSummary(debt, installments, today())
  const action = async (fn: () => Promise<void>) => {
    setBusy(true); setError('')
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar. Tente novamente.') } finally { setBusy(false) }
  }
  return <Surface className="p-5 space-y-3">
    <div className="flex justify-between gap-3"><div><h2 className="font-semibold text-app-fg">{debt.credor}</h2><p className="text-sm text-app-muted">{debt.origem}</p></div><ContextBadge contexto={debt.contexto} /></div>
    {summary.status === 'sem_parcelas' ? <>
      <div className="flex justify-between text-sm"><span>Total</span><strong>{formatBRL(summary.total)}</strong></div>
      <p className="text-sm text-app-muted">Sem parcelas — edite para adicionar acordo e vencimento</p>
    </> : <>
      <div className="flex justify-between text-sm"><span>{summary.pagas}/{summary.totalParcelas} parcelas pagas</span><strong>{formatBRL(summary.pago)} de {formatBRL(summary.total)}</strong></div>
      <ProgressBar value={summary.pagas} max={summary.totalParcelas} />
      <p className="text-sm text-app-muted">{summary.status === 'quitada' ? 'Quitada' : summary.status === 'atrasada' ? `${summary.atrasadas} parcela(s) em atraso` : 'Em dia'}{summary.proxima && ` · Próxima: ${dateBR(summary.proxima.vencimento)} — ${formatBRL(summary.proxima.valor_centavos)}`}</p>
    </>}
    {error && <p role="alert" className="text-sm text-expense">{error}</p>}
    <div className="flex flex-wrap gap-2">{summary.status !== 'sem_parcelas' && <Button size="sm" variant="secondary" onClick={() => setOpen(!open)}>{open ? 'Ocultar parcelas' : 'Ver parcelas'}</Button>}{canWrite && <><Button size="sm" variant="ghost" onClick={onEdit}>Editar</Button>{summary.status !== 'sem_parcelas' && <Button size="sm" variant="ghost" disabled={busy || summary.status === 'quitada'} onClick={() => { if (window.confirm('Marcar todas as parcelas como pagas?')) void action(() => payAll(debt.id)) }}>Quitar tudo</Button>}<Button size="sm" variant="ghost" className="text-expense" disabled={busy} onClick={() => { if (window.confirm(`Excluir a dívida de ${debt.credor} e suas parcelas?`)) void action(() => deleteDebt(debt.id)) }}>Excluir</Button></>}</div>
    {open && <div className="divide-y divide-app-border">{[...installments].sort((a,b) => a.numero-b.numero).map(p => <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div><span className="font-medium">Parcela {p.numero}</span><p className="text-app-muted">{dateBR(p.vencimento)} · {formatBRL(p.valor_centavos)}{p.pago && ` · Paga${p.pago_em ? ` em ${dateBR(p.pago_em)}` : ''}`}</p></div>{canWrite && <div className="flex gap-1"><Button size="sm" variant="ghost" disabled={busy} onClick={() => { setEditing(p); setAmount(p.valor_centavos); setDue(p.vencimento) }}>Editar</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => void action(() => setInstallmentPaid(p.id, !p.pago))}>{p.pago ? 'Desfazer' : 'Marcar paga'}</Button></div>}</div>)}</div>}
    {editing && <Modal open onClose={() => setEditing(null)} title="Editar parcela" footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button disabled={!due || amount < 0 || busy} onClick={() => void action(async () => { await updateInstallment(editing.id, { valor_centavos: amount, vencimento: due }); setEditing(null) })}>Salvar</Button></>}><div className="space-y-4"><Field label="Valor" htmlFor="inst-valor"><MoneyInput id="inst-valor" cents={amount} onChangeCents={setAmount} /></Field><Field label="Vencimento" htmlFor="inst-data"><TextInput id="inst-data" type="date" value={due} onChange={e => setDue(e.target.value)} /></Field>{error && <p role="alert" className="text-expense text-sm">{error}</p>}</div></Modal>}
  </Surface>
}
