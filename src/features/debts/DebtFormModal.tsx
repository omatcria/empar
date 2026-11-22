import { useState } from 'react'
import { Button } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Field, MoneyInput, Select, Textarea, TextInput } from '@/components/ui/form'
import { buildDebtInstallments, debtTotal } from '@/engine/debts'
import { formatBRL } from '@/lib/money'
import { useDebts } from '@/store/debts'
import { useUI } from '@/store/ui'
import type { Context, Debt } from '@/domain/types'

export function DebtFormModal({ debt, onClose }: { debt?: Debt; onClose: () => void }) {
  const { addDebt, updateDebt, regenerateUnpaid, installments } = useDebts()
  const hasParcelas = !!debt && installments.some(i => i.debt_id === debt.id)
  const viewMode = useUI(s => s.viewMode)
  const [credor,setCredor] = useState(debt?.credor ?? '')
  const [origem,setOrigem] = useState(debt?.origem ?? 'Serasa Limpa Nome')
  const [contexto,setContexto] = useState<Context>(debt?.contexto ?? (viewMode === 'EMPRESARIAL' ? 'EMPRESARIAL' : 'PESSOAL'))
  const [descricao,setDescricao] = useState(debt?.descricao ?? '')
  const [observacoes,setObservacoes] = useState(debt?.observacoes ?? '')
  const [original,setOriginal] = useState(debt?.valor_original_centavos ?? 0)
  const [acordo,setAcordo] = useState(debt?.valor_acordo_centavos ?? 0) // 0 = sem acordo (salvo como null)
  const [dataAcordo,setDataAcordo] = useState(debt?.data_acordo ?? '')
  const [parcelas,setParcelas] = useState(1)
  const [vencimento,setVencimento] = useState('')
  const [regenerate,setRegenerate] = useState(false)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const showGenerate = !debt || !hasParcelas || regenerate
  const total = debtTotal({ valor_acordo_centavos: acordo || null, valor_original_centavos: original || null })
  const parcelasOk = Number.isInteger(parcelas) && parcelas > 0 && parcelas <= 600
  const needsSchedule = showGenerate && (!!vencimento || (!!debt && hasParcelas))
  const valid = !!credor.trim() && original > 0 && (needsSchedule ? parcelasOk && !!vencimento : true)
  const preview = valid && showGenerate && vencimento ? buildDebtInstallments(total, parcelas, vencimento) : []
  async function save() {
    if (!valid) return
    setBusy(true); setError('')
    try {
      const fields = { credor: credor.trim(), origem, contexto, descricao: descricao.trim() || null, observacoes: observacoes.trim() || null, valor_original_centavos: original, valor_acordo_centavos: acordo > 0 ? acordo : null, data_acordo: dataAcordo || null }
      if (debt) { await updateDebt(debt.id, fields); if (showGenerate && vencimento) await regenerateUnpaid(debt.id, parcelas, vencimento) }
      else await addDebt({ ...fields, ...(vencimento ? { parcelas, primeiro_vencimento: vencimento } : {}) })
      onClose()
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar a dívida.') } finally { setBusy(false) }
  }
  return <Modal open onClose={onClose} title={debt ? 'Editar dívida' : 'Nova dívida'} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={!valid || busy} loading={busy} onClick={() => void save()}>Salvar</Button></>}>
    <div className="space-y-4">
      <Field label="Nome" htmlFor="debt-credor" required><TextInput id="debt-credor" placeholder="Ex.: Empréstimo Nubank, Serasa – Vivo" value={credor} onChange={e => setCredor(e.target.value)} /></Field>
      <Field label="Origem" htmlFor="debt-origem"><Select id="debt-origem" value={origem} onChange={e => setOrigem(e.target.value)}>{['Serasa Limpa Nome','Acordo direto com o credor','Banco/Financeira','Outro'].map(v => <option key={v} value={v}>{v}</option>)}</Select></Field>
      <Field label="Contexto" htmlFor="debt-contexto"><Select id="debt-contexto" value={contexto} onChange={e => setContexto(e.target.value as Context)}><option value="PESSOAL">Pessoal</option><option value="EMPRESARIAL">Empresarial</option></Select></Field>
      <Field label="Descrição" htmlFor="debt-desc"><TextInput id="debt-desc" value={descricao} onChange={e => setDescricao(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Valor original" htmlFor="debt-original" required><MoneyInput id="debt-original" cents={original} onChangeCents={setOriginal} /></Field><Field label="Valor do acordo" htmlFor="debt-acordo"><MoneyInput id="debt-acordo" cents={acordo} onChangeCents={setAcordo} /></Field></div>
      <Field label="Data do acordo" htmlFor="debt-data"><TextInput id="debt-data" type="date" value={dataAcordo} onChange={e => setDataAcordo(e.target.value)} /></Field>
      {debt && hasParcelas && <label className="flex gap-2 text-sm"><input type="checkbox" checked={regenerate} onChange={e => setRegenerate(e.target.checked)} /> Recriar parcelas em aberto</label>}
      {debt && !hasParcelas && <p className="text-sm font-medium text-app-fg">Gerar parcelas</p>}
      {showGenerate && <><div className="grid grid-cols-2 gap-3"><Field label="Parcelas" htmlFor="debt-parcelas"><TextInput id="debt-parcelas" type="number" min="1" max="600" value={parcelas} onChange={e => setParcelas(Number(e.target.value))} /></Field><Field label="Primeiro vencimento" htmlFor="debt-vencimento"><TextInput id="debt-vencimento" type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} /></Field></div>{preview.length > 0 && <p className="text-sm text-app-muted">{debt && hasParcelas ? 'O saldo restante será redistribuído nas parcelas em aberto.' : `Prévia: ${preview.length} parcelas, a primeira de ${formatBRL(preview[0].valor_centavos)}.`}</p>}</>}
      <Field label="Observações" htmlFor="debt-obs"><Textarea id="debt-obs" value={observacoes} onChange={e => setObservacoes(e.target.value)} /></Field>
      {(!credor.trim() || original <= 0) && <p className="text-xs text-app-muted">Preencha Nome e Valor original para salvar.</p>}
      {showGenerate && parcelas > 1 && !vencimento && <p className="text-xs text-app-muted">Informe o primeiro vencimento para gerar as parcelas.</p>}
      {error && <p role="alert" className="text-sm text-expense">{error}</p>}
    </div>
  </Modal>
}
