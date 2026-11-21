import { useMemo, useState } from 'react'
import { AlertTriangle, Plus, Target, Trash2 } from '@/components/icons'
import { useData } from '@/store/data'
import { useUI } from '@/store/ui'
import { useCanWrite } from '@/store/workspace'
import { categorySpend } from '@/engine'
import { mesRefLabel } from '@/engine/period'
import type { Category, Context } from '@/domain/types'
import { Button, Surface, ProgressBar } from '@/components/ui/primitives'
import { ContextBadge } from '@/components/ui/ContextBadge'
import { Modal } from '@/components/ui/Modal'
import { Field, MoneyInput, Select } from '@/components/ui/form'
import { CategoryIcon } from '@/domain/icons-catalog'
import { CategoryFormModal } from '@/features/categories/CategoryFormModal'
import { formatBRL, type Cents } from '@/lib/money'

export function Budgets() {
  const { categories, transactions, budgets } = useData()
  const { viewMode, mes } = useUI()
  const canWrite = useCanWrite()
  const [editando, setEditando] = useState<Category | null>(null)
  const [criandoCat, setCriandoCat] = useState(false)

  const contextos: Context[] =
    viewMode === 'CONSOLIDADO' ? ['PESSOAL', 'EMPRESARIAL'] : [viewMode]

  function limiteDe(catId: string): Cents {
    return (
      budgets.find((b) => b.category_id === catId && b.mes_referencia === mes)
        ?.limite_centavos ?? 0
    )
  }

  const linhas = useMemo(() => {
    return categories
      .filter((c) => c.tipo === 'DESPESA' && contextos.includes(c.contexto))
      .map((c) => ({
        cat: c,
        gasto: categorySpend(c.id, transactions, mes),
        limite: limiteDe(c.id),
      }))
      .filter((l) => l.limite > 0 || l.gasto > 0)
      .sort((a, b) => b.gasto - a.gasto)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, transactions, budgets, mes, viewMode])

  const estourados = linhas.filter((l) => l.limite > 0 && l.gasto > l.limite).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-app-fg">Limites por categoria</h1>
          <p className="text-sm text-app-muted">
            {mesRefLabel(mes)} — economize sem esforço.
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={<Plus className="size-4" />}
              onClick={() => setCriandoCat(true)}
            >
              <span className="hidden sm:inline">Nova categoria</span>
            </Button>
            <Button icon={<Target className="size-4" />} onClick={() => setEditando(pickFirst(categories, contextos))}>
              <span className="hidden sm:inline">Definir limite</span>
            </Button>
          </div>
        )}
      </div>

      {estourados > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-expense/30 bg-expense/10 px-4 py-3 text-sm text-expense">
          <AlertTriangle className="size-4" />
          {estourados} categoria(s) acima do limite neste mês.
        </div>
      )}

      {linhas.length === 0 ? (
        <Surface className="p-10 text-center">
          <Target className="mx-auto mb-3 size-8 text-app-muted" />
          <p className="text-sm text-app-muted">
            Nenhum limite definido. Defina quanto quer gastar em cada categoria.
          </p>
        </Surface>
      ) : (
        <div className="space-y-2">
          {linhas.map(({ cat, gasto, limite }) => {
            const temLimite = limite > 0
            const pct = temLimite ? gasto / limite : 0
            const cor =
              pct > 1 ? 'bg-expense' : pct >= 0.8 ? 'bg-warn' : 'bg-income'
            return (
              <Surface key={cat.id} className="p-4">
                <button
                  onClick={() => setEditando(cat)}
                  className="flex w-full items-center gap-2 text-left cursor-pointer"
                >
                  <span
                    className="grid size-7 shrink-0 place-items-center rounded-lg"
                    style={{ background: `${cat.cor}22`, color: cat.cor }}
                  >
                    <CategoryIcon name={cat.icone} className="size-4" />
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-app-fg">
                    {cat.nome}
                  </span>
                  {viewMode === 'CONSOLIDADO' && <ContextBadge contexto={cat.contexto} iconOnly />}
                  <span className="tnum text-sm text-app-fg2">
                    {formatBRL(gasto)}
                    {temLimite && (
                      <span className="text-app-muted"> / {formatBRL(limite)}</span>
                    )}
                  </span>
                </button>
                {temLimite ? (
                  <div className="mt-2">
                    <ProgressBar value={gasto} max={limite} colorClass={cor} />
                    {pct > 1 && (
                      <p className="mt-1 text-xs text-expense">
                        Estourou {formatBRL(gasto - limite)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-app-muted">Sem limite definido — toque para definir</p>
                )}
              </Surface>
            )
          })}
        </div>
      )}

      {editando && (
        <BudgetModal
          open={!!editando}
          category={editando}
          currentLimit={limiteDe(editando.id)}
          onClose={() => setEditando(null)}
        />
      )}

      <CategoryFormModal
        open={criandoCat}
        defaultTipo="DESPESA"
        defaultContexto={contextos[0]}
        onClose={() => setCriandoCat(false)}
      />
    </div>
  )
}

function pickFirst(cats: Category[], contextos: Context[]): Category | null {
  return (
    cats.find((c) => c.tipo === 'DESPESA' && contextos.includes(c.contexto)) ?? null
  )
}

function BudgetModal({
  open,
  onClose,
  category,
  currentLimit,
}: {
  open: boolean
  onClose: () => void
  category: Category
  currentLimit: Cents
}) {
  const { categories, budgets, upsertBudget, deleteBudget } = useData()
  const { mes } = useUI()
  const [catId, setCatId] = useState(category.id)
  const [limite, setLimite] = useState<Cents>(currentLimit)
  const [saving, setSaving] = useState(false)

  const cat = categories.find((c) => c.id === catId) ?? category
  const despesasCtx = categories.filter(
    (c) => c.tipo === 'DESPESA' && c.contexto === category.contexto,
  )
  const existente = budgets.find((b) => b.category_id === catId && b.mes_referencia === mes)

  async function salvar() {
    setSaving(true)
    try {
      await upsertBudget({
        contexto: cat.contexto,
        category_id: catId,
        mes_referencia: mes,
        limite_centavos: limite,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function remover() {
    if (!existente) return
    setSaving(true)
    try {
      await deleteBudget(existente.id)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Limite · ${mesRefLabel(mes)}`}
      footer={
        <>
          {existente && (
            <Button
              variant="ghost"
              className="mr-auto text-expense"
              icon={<Trash2 className="size-4" />}
              onClick={remover}
              loading={saving}
            >
              Remover
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Categoria" htmlFor="bud-cat">
          <Select id="bud-cat" value={catId} onChange={(e) => setCatId(e.target.value)}>
            {despesasCtx.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Limite do mês" htmlFor="bud-lim" hint="Deixe em R$ 0,00 para remover o limite.">
          <MoneyInput id="bud-lim" cents={limite} onChangeCents={setLimite} autoFocus />
        </Field>
      </div>
    </Modal>
  )
}
