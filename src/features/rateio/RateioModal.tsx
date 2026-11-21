import { useEffect, useMemo, useState } from 'react'
import { SplitSquareHorizontal } from '@/components/icons'
import { useData } from '@/store/data'
import { Button } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Field, Select, TextInput, MoneyInput } from '@/components/ui/form'
import { formatBRL, type Cents } from '@/lib/money'
import { todayISO, uid } from '@/lib/cn'

/** Divide UMA despesa entre EMPRESARIAL e PESSOAL por %, gerando 2 lançamentos rastreáveis. */
export function RateioModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { accounts, categories, addTransactions } = useData()

  const contas = useMemo(() => accounts.filter((a) => !a.arquivada), [accounts])
  const catsPJ = useMemo(
    () =>
      categories.filter(
        (c) => c.contexto === 'EMPRESARIAL' && c.tipo === 'DESPESA' && !c.sistema,
      ),
    [categories],
  )
  const catsPessoal = useMemo(
    () => categories.filter((c) => c.contexto === 'PESSOAL' && c.tipo === 'DESPESA'),
    [categories],
  )

  const [descricao, setDescricao] = useState('')
  const [total, setTotal] = useState<Cents>(0)
  const [contaId, setContaId] = useState('')
  const [pctPJ, setPctPJ] = useState(60)
  const [catPJId, setCatPJId] = useState('')
  const [catPessoalId, setCatPessoalId] = useState('')
  const [data, setData] = useState(todayISO())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDescricao('')
    setTotal(0)
    setPctPJ(60)
    setData(todayISO())
  }, [open])

  useEffect(() => {
    if (!contas.some((a) => a.id === contaId)) setContaId(contas[0]?.id ?? '')
  }, [contas, contaId])
  useEffect(() => {
    if (!catsPJ.some((c) => c.id === catPJId)) setCatPJId(catsPJ[0]?.id ?? '')
  }, [catsPJ, catPJId])
  useEffect(() => {
    if (!catsPessoal.some((c) => c.id === catPessoalId))
      setCatPessoalId(catsPessoal[0]?.id ?? '')
  }, [catsPessoal, catPessoalId])

  const pjCentavos = Math.round((total * pctPJ) / 100)
  const pessoalCentavos = total - pjCentavos

  const podeSalvar =
    total > 0 && contaId && catPJId && catPessoalId && pctPJ >= 0 && pctPJ <= 100

  async function salvar() {
    if (!podeSalvar) return
    setSaving(true)
    try {
      const rateioId = uid()
      const base = {
        tipo: 'DESPESA' as const,
        account_id: contaId,
        data,
        descricao: descricao.trim() || 'Despesa compartilhada',
        pago: true,
        rateio_id: rateioId,
      }
      await addTransactions([
        {
          ...base,
          contexto: 'EMPRESARIAL',
          category_id: catPJId,
          valor_centavos: pjCentavos,
        },
        {
          ...base,
          contexto: 'PESSOAL',
          category_id: catPessoalId,
          valor_centavos: pessoalCentavos,
        },
      ])
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Dividir despesa (rateio)"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} loading={saving} disabled={!podeSalvar}>
            Lançar 2 partes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 rounded-xl bg-app-surface-2 px-3 py-2 text-xs text-app-muted">
          <SplitSquareHorizontal className="size-4" />
          Um gasto (celular, internet, notebook) dividido entre empresa e você.
        </div>

        <Field label="Descrição" htmlFor="rt-desc">
          <TextInput
            id="rt-desc"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: Internet, Celular"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor total" htmlFor="rt-total" required>
            <MoneyInput id="rt-total" cents={total} onChangeCents={setTotal} />
          </Field>
          <Field label="Pago pela conta" htmlFor="rt-conta" required>
            <Select id="rt-conta" value={contaId} onChange={(e) => setContaId(e.target.value)}>
              {contas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Slider de rateio */}
        <Field label={`Divisão — Empresa ${pctPJ}% / Você ${100 - pctPJ}%`} htmlFor="rt-pct">
          <input
            id="rt-pct"
            type="range"
            min={0}
            max={100}
            step={5}
            value={pctPJ}
            onChange={(e) => setPctPJ(Number(e.target.value))}
            className="w-full accent-[var(--color-empresarial)]"
          />
          <div className="mt-1 flex justify-between text-xs">
            <span className="text-empresarial-strong">Empresa {formatBRL(pjCentavos)}</span>
            <span className="text-pessoal-strong">Você {formatBRL(pessoalCentavos)}</span>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoria (Empresa)" htmlFor="rt-catpj" required>
            <Select id="rt-catpj" value={catPJId} onChange={(e) => setCatPJId(e.target.value)}>
              {catsPJ.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Categoria (Você)" htmlFor="rt-catpes" required>
            <Select
              id="rt-catpes"
              value={catPessoalId}
              onChange={(e) => setCatPessoalId(e.target.value)}
            >
              {catsPessoal.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Data" htmlFor="rt-data">
          <TextInput
            id="rt-data"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  )
}
