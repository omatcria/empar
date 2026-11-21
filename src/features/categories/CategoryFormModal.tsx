import { useMemo, useState, useEffect } from 'react'
import { Trash2 } from '@/components/icons'
import { useData } from '@/store/data'
import { useUI } from '@/store/ui'
import type { Category, Context, TxType } from '@/domain/types'
import { CONTEXT_LABEL, TX_TYPE_LABEL } from '@/domain/enums'
import { Button } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Field, Select, TextInput } from '@/components/ui/form'
import { PALETTE } from '@/domain/palette'
import { CategoryIcon, searchIcons } from '@/domain/icons-catalog'
import { cn } from '@/lib/cn'

export function CategoryFormModal({
  open,
  onClose,
  category,
  defaultContexto,
  defaultTipo,
}: {
  open: boolean
  onClose: () => void
  category?: Category
  defaultContexto?: Context
  defaultTipo?: TxType
}) {
  const { categories, addCategory, updateCategory, deleteCategory } = useData()
  const { viewMode } = useUI()
  const isEdit = !!category
  const ctxInicial: Context =
    category?.contexto ??
    defaultContexto ??
    (viewMode === 'EMPRESARIAL' ? 'EMPRESARIAL' : 'PESSOAL')

  const [nome, setNome] = useState(category?.nome ?? '')
  const [contexto, setContexto] = useState<Context>(ctxInicial)
  const [tipo, setTipo] = useState<TxType>(category?.tipo ?? defaultTipo ?? 'DESPESA')
  const [paiId, setPaiId] = useState(category?.categoria_pai_id ?? '')
  const [cor, setCor] = useState<string>(category?.cor ?? PALETTE[0])
  const [icone, setIcone] = useState<string>(category?.icone ?? 'tag')
  const [buscaIcone, setBuscaIcone] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setNome(category?.nome ?? '')
      setContexto(category?.contexto ?? defaultContexto ?? (viewMode === 'EMPRESARIAL' ? 'EMPRESARIAL' : 'PESSOAL'))
      setTipo(category?.tipo ?? defaultTipo ?? 'DESPESA')
      setPaiId(category?.categoria_pai_id ?? '')
      setCor(category?.cor ?? PALETTE[0])
      setIcone(category?.icone ?? 'tag')
      setBuscaIcone('')
      setErro(null)
    }
  }, [open, category, defaultContexto, defaultTipo, viewMode])

  const possiveisPais = useMemo(
    () =>
      categories.filter(
        (c) =>
          c.contexto === contexto &&
          c.tipo === tipo &&
          !c.categoria_pai_id &&
          c.id !== category?.id,
      ),
    [categories, contexto, tipo, category?.id],
  )

  const iconesFiltrados = useMemo(() => searchIcons(buscaIcone).slice(0, 48), [buscaIcone])

  async function salvar() {
    if (!nome.trim()) return
    setSaving(true)
    setErro(null)
    try {
      if (isEdit) {
        await updateCategory(category.id, {
          nome: nome.trim(),
          categoria_pai_id: paiId || null,
          cor,
          icone,
        })
      } else {
        await addCategory({
          nome: nome.trim(),
          contexto,
          tipo,
          categoria_pai_id: paiId || null,
          cor,
          icone,
        })
      }
      onClose()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function excluir() {
    if (!category) return
    setSaving(true)
    setErro(null)
    try {
      await deleteCategory(category.id)
      onClose()
    } catch {
      setErro('Não é possível excluir: há lançamentos usando esta categoria.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar categoria' : 'Nova categoria'}
      footer={
        <>
          {isEdit && !category?.sistema && (
            <Button
              variant="ghost"
              className="mr-auto text-expense"
              icon={<Trash2 className="size-4" />}
              onClick={excluir}
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
        {/* Nome + preview do ícone */}
        <div className="flex items-end gap-3">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-xl"
            style={{ background: `${cor}22`, color: cor }}
          >
            <CategoryIcon name={icone} className="size-6" />
          </span>
          <Field label="Nome" htmlFor="cat-nome" required className="flex-1">
            <TextInput
              id="cat-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Mercado, Software"
              autoFocus
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Contexto" htmlFor="cat-ctx" hint={isEdit ? 'Fixo' : undefined}>
            <Select
              id="cat-ctx"
              value={contexto}
              disabled={isEdit}
              onChange={(e) => setContexto(e.target.value as Context)}
            >
              <option value="PESSOAL">{CONTEXT_LABEL.PESSOAL}</option>
              <option value="EMPRESARIAL">{CONTEXT_LABEL.EMPRESARIAL}</option>
            </Select>
          </Field>
          <Field label="Tipo" htmlFor="cat-tipo" hint={isEdit ? 'Fixo' : undefined}>
            <Select
              id="cat-tipo"
              value={tipo}
              disabled={isEdit}
              onChange={(e) => setTipo(e.target.value as TxType)}
            >
              <option value="DESPESA">{TX_TYPE_LABEL.DESPESA}</option>
              <option value="RECEITA">{TX_TYPE_LABEL.RECEITA}</option>
            </Select>
          </Field>
        </div>

        {possiveisPais.length > 0 && (
          <Field label="Subcategoria de (opcional)" htmlFor="cat-pai">
            <Select id="cat-pai" value={paiId} onChange={(e) => setPaiId(e.target.value)}>
              <option value="">— nenhuma (categoria principal) —</option>
              {possiveisPais.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {/* Seletor de ícone */}
        <Field label="Ícone">
          <TextInput
            value={buscaIcone}
            onChange={(e) => setBuscaIcone(e.target.value)}
            placeholder="Buscar ícone (ex.: mercado, casa, car, health)…"
            className="mb-2"
          />
          <div className="grid max-h-44 grid-cols-8 gap-1.5 overflow-y-auto rounded-xl border border-app-border bg-app-surface-2 p-2 sm:grid-cols-10">
            {iconesFiltrados.map((ic) => (
              <button
                key={ic.key}
                type="button"
                aria-label={ic.key}
                onClick={() => setIcone(ic.key)}
                className={cn(
                  'grid aspect-square place-items-center rounded-lg transition-colors cursor-pointer',
                  icone === ic.key
                    ? 'bg-primary text-primary-content'
                    : 'text-app-fg2 hover:bg-app-border/60',
                )}
              >
                <ic.comp className="size-5" />
              </button>
            ))}
            {iconesFiltrados.length === 0 && (
              <p className="col-span-full py-3 text-center text-xs text-app-muted">
                Nenhum ícone encontrado.
              </p>
            )}
          </div>
        </Field>

        {/* Cor */}
        <Field label="Cor">
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                aria-label={`Cor ${c}`}
                className={
                  'size-8 rounded-lg transition-transform ' +
                  (cor === c ? 'ring-2 ring-app-fg ring-offset-2 ring-offset-app-surface scale-110' : '')
                }
                style={{ background: c }}
              />
            ))}
          </div>
        </Field>

        {erro && <p className="text-sm text-expense">{erro}</p>}
      </div>
    </Modal>
  )
}
