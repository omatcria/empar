import { useMemo, useState } from 'react'
import { Flag, Plus, Trash2, TrendingUp } from '@/components/icons'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useData } from '@/store/data'
import { useUI } from '@/store/ui'
import { useCanWrite } from '@/store/workspace'
import type { Context, Goal } from '@/domain/types'
import { CONTEXT_LABEL } from '@/domain/enums'
import { Button, Surface, ProgressBar } from '@/components/ui/primitives'
import { Money } from '@/components/ui/Money'
import { ContextBadge } from '@/components/ui/ContextBadge'
import { Modal } from '@/components/ui/Modal'
import { Field, Select, TextInput, MoneyInput } from '@/components/ui/form'
import { formatBRL, type Cents } from '@/lib/money'

export function Goals() {
  const { goals } = useData()
  const { viewMode } = useUI()
  const canWrite = useCanWrite()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [aporte, setAporte] = useState<Goal | null>(null)

  const visiveis = useMemo(
    () => goals.filter((g) => viewMode === 'CONSOLIDADO' || g.contexto === viewMode),
    [goals, viewMode],
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-app-fg">Metas</h1>
          <p className="text-sm text-app-muted">
            Reserva de emergência e objetivos — pessoais e da empresa.
          </p>
        </div>
        {canWrite && (
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            <span className="hidden sm:inline">Nova meta</span>
          </Button>
        )}
      </div>

      {visiveis.length === 0 ? (
        <Surface className="p-10 text-center">
          <Flag className="mx-auto mb-3 size-8 text-app-muted" />
          <p className="text-sm text-app-muted">Nenhuma meta ainda.</p>
        </Surface>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visiveis.map((g) => {
            const alvo = g.valor_alvo_centavos
            const atual = g.valor_atual_centavos
            const pct = alvo > 0 ? Math.min(100, Math.round((atual / alvo) * 100)) : 0
            const done = alvo > 0 && atual >= alvo
            return (
              <Surface key={g.id} className="p-5">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-app-fg">{g.nome}</p>
                    <div className="mt-1">
                      <ContextBadge contexto={g.contexto} />
                    </div>
                  </div>
                  <button
                    onClick={() => setEditing(g)}
                    className="text-xs text-app-muted hover:text-app-fg2 cursor-pointer"
                  >
                    Editar
                  </button>
                </div>

                <div className="flex items-end justify-between">
                  <Money cents={atual} className="text-xl font-bold text-app-fg" />
                  <span className="text-sm text-app-muted">de {alvo > 0 ? formatBRL(alvo) : '—'}</span>
                </div>
                <ProgressBar
                  value={atual}
                  max={alvo || 1}
                  colorClass={done ? 'bg-income' : 'bg-pessoal'}
                  className="mt-2"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className={'text-xs ' + (done ? 'text-income' : 'text-app-muted')}>
                    {done ? '🎉 Meta atingida!' : `${pct}%`}
                    {g.prazo && !done
                      ? ` · até ${format(parseISO(g.prazo), "MMM/yy", { locale: ptBR })}`
                      : ''}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<TrendingUp className="size-3.5" />}
                    onClick={() => setAporte(g)}
                  >
                    Aporte
                  </Button>
                </div>
              </Surface>
            )
          })}
        </div>
      )}

      <GoalFormModal open={creating} onClose={() => setCreating(false)} />
      <GoalFormModal open={!!editing} goal={editing ?? undefined} onClose={() => setEditing(null)} />
      {aporte && <AporteModal goal={aporte} open={!!aporte} onClose={() => setAporte(null)} />}
    </div>
  )
}

function GoalFormModal({
  open,
  onClose,
  goal,
}: {
  open: boolean
  onClose: () => void
  goal?: Goal
}) {
  const { addGoal, updateGoal, deleteGoal } = useData()
  const { viewMode } = useUI()
  const isEdit = !!goal
  const ctxInicial: Context =
    goal?.contexto ?? (viewMode === 'EMPRESARIAL' ? 'EMPRESARIAL' : 'PESSOAL')

  const [nome, setNome] = useState(goal?.nome ?? '')
  const [contexto, setContexto] = useState<Context>(ctxInicial)
  const [alvo, setAlvo] = useState<Cents>(goal?.valor_alvo_centavos ?? 0)
  const [atual, setAtual] = useState<Cents>(goal?.valor_atual_centavos ?? 0)
  const [prazo, setPrazo] = useState(goal?.prazo ?? '')
  const [saving, setSaving] = useState(false)

  async function salvar() {
    if (!nome.trim()) return
    setSaving(true)
    try {
      if (isEdit) {
        await updateGoal(goal.id, {
          nome: nome.trim(),
          valor_alvo_centavos: alvo,
          valor_atual_centavos: atual,
          prazo: prazo || null,
        })
      } else {
        await addGoal({
          nome: nome.trim(),
          contexto,
          valor_alvo_centavos: alvo,
          valor_atual_centavos: atual,
          prazo: prazo || null,
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
      title={isEdit ? 'Editar meta' : 'Nova meta'}
      footer={
        <>
          {isEdit && (
            <Button
              variant="ghost"
              className="mr-auto text-expense"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                setSaving(true)
                await deleteGoal(goal.id)
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
          <Button onClick={salvar} loading={saving} disabled={!nome.trim()}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nome" htmlFor="g-nome" required>
          <TextInput
            id="g-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Reserva de emergência"
            autoFocus
          />
        </Field>
        <Field label="Contexto" htmlFor="g-ctx" hint={isEdit ? 'Fixo' : undefined}>
          <Select
            id="g-ctx"
            value={contexto}
            disabled={isEdit}
            onChange={(e) => setContexto(e.target.value as Context)}
          >
            <option value="PESSOAL">{CONTEXT_LABEL.PESSOAL}</option>
            <option value="EMPRESARIAL">{CONTEXT_LABEL.EMPRESARIAL}</option>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Objetivo" htmlFor="g-alvo" required>
            <MoneyInput id="g-alvo" cents={alvo} onChangeCents={setAlvo} />
          </Field>
          <Field label="Já guardado" htmlFor="g-atual">
            <MoneyInput id="g-atual" cents={atual} onChangeCents={setAtual} />
          </Field>
        </div>
        <Field label="Prazo (opcional)" htmlFor="g-prazo">
          <TextInput id="g-prazo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

function AporteModal({
  goal,
  open,
  onClose,
}: {
  goal: Goal
  open: boolean
  onClose: () => void
}) {
  const { updateGoal } = useData()
  const [valor, setValor] = useState<Cents>(0)
  const [saving, setSaving] = useState(false)

  async function salvar() {
    if (valor === 0) return
    setSaving(true)
    try {
      await updateGoal(goal.id, {
        valor_atual_centavos: Math.max(0, goal.valor_atual_centavos + valor),
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Aporte · ${goal.nome}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} loading={saving} disabled={valor === 0}>
            Adicionar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-xl bg-app-surface-2 px-4 py-3 text-sm">
          <span className="text-app-muted">Já guardado</span>
          <Money cents={goal.valor_atual_centavos} className="font-semibold text-app-fg" />
        </div>
        <Field label="Valor do aporte (use negativo para retirar)" htmlFor="ap-valor">
          <MoneyInput id="ap-valor" cents={valor} onChangeCents={setValor} autoFocus />
        </Field>
      </div>
    </Modal>
  )
}
