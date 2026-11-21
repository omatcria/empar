import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Building2, User } from '@/components/icons'
import { useData } from '@/store/data'
import { useAuth } from '@/store/auth'
import { buildProLabore, buildDistribuicao } from '@/engine'
import { Button } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Field, Select, TextInput, MoneyInput } from '@/components/ui/form'
import { todayISO, cn } from '@/lib/cn'
import type { Cents } from '@/lib/money'

type Tipo = 'PRO_LABORE' | 'DISTRIBUICAO'

export function ProLaboreModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { accounts, categories, profile, addTransactions } = useData()
  const userId = useAuth((s) => s.user?.id)

  const contasPJ = useMemo(
    () => accounts.filter((a) => !a.arquivada && a.contexto === 'EMPRESARIAL'),
    [accounts],
  )
  const contasPessoais = useMemo(
    () => accounts.filter((a) => !a.arquivada && a.contexto === 'PESSOAL'),
    [accounts],
  )

  const [tipo, setTipo] = useState<Tipo>('PRO_LABORE')
  const [valor, setValor] = useState<Cents>(profile?.prolabore_padrao_centavos ?? 0)
  const [origemId, setOrigemId] = useState('')
  const [destinoId, setDestinoId] = useState('')
  const [data, setData] = useState(todayISO())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTipo('PRO_LABORE')
    setValor(profile?.prolabore_padrao_centavos ?? 0)
    setData(todayISO())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!contasPJ.some((a) => a.id === origemId)) setOrigemId(contasPJ[0]?.id ?? '')
  }, [contasPJ, origemId])
  useEffect(() => {
    if (!contasPessoais.some((a) => a.id === destinoId))
      setDestinoId(contasPessoais[0]?.id ?? '')
  }, [contasPessoais, destinoId])

  const faltaConta = contasPJ.length === 0 || contasPessoais.length === 0
  const podeSalvar = !faltaConta && valor > 0 && origemId && destinoId && !!userId

  async function salvar() {
    if (!podeSalvar || !userId) return
    setSaving(true)
    try {
      const build = tipo === 'PRO_LABORE' ? buildProLabore : buildDistribuicao
      const par = build({
        userId,
        valorCentavos: valor,
        data,
        accountEmpresarialId: origemId,
        accountPessoalId: destinoId,
        categories,
      })
      await addTransactions(par)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pró-labore / Distribuição"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} loading={saving} disabled={!podeSalvar}>
            Lançar
          </Button>
        </>
      }
    >
      {faltaConta ? (
        <p className="py-6 text-center text-sm text-app-muted">
          Você precisa de pelo menos <strong className="text-empresarial-strong">uma conta
          Empresarial</strong> e <strong className="text-pessoal-strong">uma conta Pessoal</strong>{' '}
          para lançar o pró-labore.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-app-surface-2 p-1">
            {(
              [
                ['PRO_LABORE', 'Pró-labore'],
                ['DISTRIBUICAO', 'Distribuição'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setTipo(v)}
                className={cn(
                  'h-9 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                  tipo === v ? 'bg-app-surface text-app-fg shadow' : 'text-app-muted',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Fluxo visual PJ -> Pessoal */}
          <div className="flex items-center justify-center gap-3 rounded-xl bg-app-surface-2 py-3 text-sm">
            <span className="flex items-center gap-1.5 text-empresarial-strong">
              <Building2 className="size-4" /> Empresa
            </span>
            <ArrowRight className="size-4 text-app-muted" />
            <span className="flex items-center gap-1.5 text-pessoal-strong">
              <User className="size-4" /> Você
            </span>
          </div>

          <Field label="Valor" htmlFor="pl-valor" required>
            <MoneyInput id="pl-valor" cents={valor} onChangeCents={setValor} autoFocus />
          </Field>

          <Field label="Sai da conta (Empresarial)" htmlFor="pl-origem" required>
            <Select id="pl-origem" value={origemId} onChange={(e) => setOrigemId(e.target.value)}>
              {contasPJ.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Entra na conta (Pessoal)" htmlFor="pl-destino" required>
            <Select
              id="pl-destino"
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
            >
              {contasPessoais.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Data" htmlFor="pl-data">
            <TextInput
              id="pl-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </Field>

          <p className="text-xs text-app-muted">
            Gera 2 lançamentos ligados: saída na empresa e entrada em você. No
            Consolidado, não conta como receita/despesa (é o mesmo dinheiro mudando de bolso).
          </p>
        </div>
      )}
    </Modal>
  )
}
