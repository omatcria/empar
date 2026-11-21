import { useEffect, useMemo, useState } from 'react'
import { Plus, Repeat, Trash2 } from '@/components/icons'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useData } from '@/store/data'
import { useUI } from '@/store/ui'
import { useCanWrite } from '@/store/workspace'
import type { Context, Recurrence, RecurrenceFreq, TxType } from '@/domain/types'
import type { RecurrenceTemplate } from '@/engine/recurrences'
import { CONTEXT_LABEL, RECURRENCE_FREQ_LABEL, TX_TYPE_LABEL } from '@/domain/enums'
import { Button, Surface } from '@/components/ui/primitives'
import { Money } from '@/components/ui/Money'
import { ContextBadge } from '@/components/ui/ContextBadge'
import { Modal } from '@/components/ui/Modal'
import { Field, Select, TextInput, MoneyInput } from '@/components/ui/form'
import { todayISO } from '@/lib/cn'
import type { Cents } from '@/lib/money'

function tpl(r: Recurrence): RecurrenceTemplate {
  return r.template as unknown as RecurrenceTemplate
}

export function Recurrences() {
  const { recurrences, updateRecurrence } = useData()
  const { viewMode } = useUI()
  const canWrite = useCanWrite()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Recurrence | null>(null)

  const visiveis = useMemo(
    () => recurrences.filter((r) => viewMode === 'CONSOLIDADO' || r.contexto === viewMode),
    [recurrences, viewMode],
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-app-fg">Recorrências</h1>
          <p className="text-sm text-app-muted">
            Salário, pró-labore, assinaturas — lançados sozinhos todo período.
          </p>
        </div>
        {canWrite && (
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            <span className="hidden sm:inline">Nova recorrência</span>
          </Button>
        )}
      </div>

      {visiveis.length === 0 ? (
        <Surface className="p-10 text-center">
          <Repeat className="mx-auto mb-3 size-8 text-app-muted" />
          <p className="text-sm text-app-muted">Nenhuma recorrência ainda.</p>
        </Surface>
      ) : (
        <div className="space-y-2">
          {visiveis.map((r) => {
            const t = tpl(r)
            return (
              <Surface key={r.id} className="flex items-center gap-3 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-app-surface-2 text-app-muted">
                  <Repeat className="size-5" />
                </span>
                <button onClick={() => setEditing(r)} className="min-w-0 flex-1 text-left cursor-pointer">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-app-fg">{t.descricao}</p>
                    {viewMode === 'CONSOLIDADO' && <ContextBadge contexto={r.contexto} iconOnly />}
                  </div>
                  <p className="text-xs text-app-muted">
                    {RECURRENCE_FREQ_LABEL[r.frequencia]} · próx.{' '}
                    {format(parseISO(r.proxima_data), "dd 'de' MMM", { locale: ptBR })}
                  </p>
                </button>
                <Money cents={t.valor_centavos} tipo={t.tipo} className="text-sm font-semibold" showSign />
                <button
                  onClick={() => updateRecurrence(r.id, { ativo: !r.ativo })}
                  role="switch"
                  aria-checked={r.ativo}
                  aria-label="Ativar recorrência"
                  className={
                    'relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ' +
                    (r.ativo ? 'bg-income' : 'bg-app-border')
                  }
                >
                  <span
                    className={
                      'absolute top-0.5 size-5 rounded-full bg-white transition-all ' +
                      (r.ativo ? 'left-[22px]' : 'left-0.5')
                    }
                  />
                </button>
              </Surface>
            )
          })}
        </div>
      )}

      <RecurrenceModal open={creating} onClose={() => setCreating(false)} />
      <RecurrenceModal
        open={!!editing}
        recurrence={editing ?? undefined}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}

function RecurrenceModal({
  open,
  onClose,
  recurrence,
}: {
  open: boolean
  onClose: () => void
  recurrence?: Recurrence
}) {
  const { accounts, categories, addRecurrence, updateRecurrence, deleteRecurrence } = useData()
  const { viewMode } = useUI()
  const isEdit = !!recurrence
  const t0 = recurrence ? tpl(recurrence) : undefined
  const ctxInicial: Context =
    recurrence?.contexto ?? (viewMode === 'EMPRESARIAL' ? 'EMPRESARIAL' : 'PESSOAL')

  const [descricao, setDescricao] = useState(t0?.descricao ?? '')
  const [contexto, setContexto] = useState<Context>(ctxInicial)
  const [tipo, setTipo] = useState<TxType>(t0?.tipo ?? 'RECEITA')
  const [accountId, setAccountId] = useState(t0?.account_id ?? '')
  const [categoryId, setCategoryId] = useState(t0?.category_id ?? '')
  const [valor, setValor] = useState<Cents>(t0?.valor_centavos ?? 0)
  const [frequencia, setFrequencia] = useState<RecurrenceFreq>(recurrence?.frequencia ?? 'mensal')
  const [proxima, setProxima] = useState(recurrence?.proxima_data ?? todayISO())
  const [saving, setSaving] = useState(false)

  const contas = useMemo(
    () => accounts.filter((a) => !a.arquivada && a.contexto === contexto),
    [accounts, contexto],
  )
  const cats = useMemo(
    () =>
      categories.filter(
        (c) =>
          c.contexto === contexto &&
          c.tipo === tipo &&
          !(c.chave && /PRO_LABORE|DISTRIBUICAO/.test(c.chave)),
      ),
    [categories, contexto, tipo],
  )

  useEffect(() => {
    if (!contas.some((a) => a.id === accountId)) setAccountId(contas[0]?.id ?? '')
  }, [contas, accountId])
  useEffect(() => {
    if (!cats.some((c) => c.id === categoryId)) setCategoryId(cats[0]?.id ?? '')
  }, [cats, categoryId])

  const podeSalvar = descricao.trim() && valor > 0 && accountId && categoryId && proxima

  async function salvar() {
    if (!podeSalvar) return
    setSaving(true)
    try {
      const template: RecurrenceTemplate = {
        tipo,
        account_id: accountId,
        category_id: categoryId,
        valor_centavos: valor,
        descricao: descricao.trim(),
        pago: true,
      }
      const dia = Number(proxima.slice(8, 10))
      if (isEdit) {
        await updateRecurrence(recurrence.id, {
          template: template as never,
          frequencia,
          dia,
          proxima_data: proxima,
        })
      } else {
        await addRecurrence({
          contexto,
          template: template as never,
          frequencia,
          dia,
          proxima_data: proxima,
          ativo: true,
        })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar recorrência' : 'Nova recorrência'}
      footer={
        <>
          {isEdit && (
            <Button
              variant="ghost"
              className="mr-auto text-expense"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                setSaving(true)
                await deleteRecurrence(recurrence.id)
                setSaving(false)
                onClose()
              }}
            >
              Excluir
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} loading={saving} disabled={!podeSalvar}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Descrição" htmlFor="r-desc" required>
          <TextInput
            id="r-desc"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: Salário, Netflix, Aluguel"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Contexto" htmlFor="r-ctx" hint={isEdit ? 'Fixo' : undefined}>
            <Select
              id="r-ctx"
              value={contexto}
              disabled={isEdit}
              onChange={(e) => setContexto(e.target.value as Context)}
            >
              <option value="PESSOAL">{CONTEXT_LABEL.PESSOAL}</option>
              <option value="EMPRESARIAL">{CONTEXT_LABEL.EMPRESARIAL}</option>
            </Select>
          </Field>
          <Field label="Tipo" htmlFor="r-tipo">
            <Select id="r-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TxType)}>
              <option value="RECEITA">{TX_TYPE_LABEL.RECEITA}</option>
              <option value="DESPESA">{TX_TYPE_LABEL.DESPESA}</option>
            </Select>
          </Field>
        </div>

        <Field label="Valor" htmlFor="r-valor" required>
          <MoneyInput id="r-valor" cents={valor} onChangeCents={setValor} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Conta" htmlFor="r-conta" required>
            <Select id="r-conta" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {contas.length === 0 && <option value="">Nenhuma conta</option>}
              {contas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Categoria" htmlFor="r-cat" required>
            <Select id="r-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {cats.length === 0 && <option value="">Nenhuma</option>}
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Frequência" htmlFor="r-freq">
            <Select
              id="r-freq"
              value={frequencia}
              onChange={(e) => setFrequencia(e.target.value as RecurrenceFreq)}
            >
              {Object.entries(RECURRENCE_FREQ_LABEL).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Próxima data" htmlFor="r-prox" required>
            <TextInput
              id="r-prox"
              type="date"
              value={proxima}
              onChange={(e) => setProxima(e.target.value)}
            />
          </Field>
        </div>

        <p className="text-xs text-app-muted">
          A partir da próxima data, o app gera o lançamento sozinho a cada período (e recupera
          períodos atrasados ao abrir).
        </p>
      </div>
    </Modal>
  )
}
