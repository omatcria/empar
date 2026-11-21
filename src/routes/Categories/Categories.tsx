import { useState } from 'react'
import { ChevronDown, ChevronRight, Lock, Pencil, Plus, Search } from '@/components/icons'
import { useData } from '@/store/data'
import { useUI } from '@/store/ui'
import { useCanWrite } from '@/store/workspace'
import type { Category, Context, TxType } from '@/domain/types'
import { TX_TYPE_LABEL } from '@/domain/enums'
import { Button, Surface } from '@/components/ui/primitives'
import { ContextBadge } from '@/components/ui/ContextBadge'
import { CategoryIcon } from '@/domain/icons-catalog'
import { CategoryFormModal } from '@/features/categories/CategoryFormModal'
import { TextInput } from '@/components/ui/form'
import { cn } from '@/lib/cn'

export function Categories() {
  const { categories } = useData()
  const { viewMode } = useUI()
  const canWrite = useCanWrite()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const contextos: Context[] =
    viewMode === 'CONSOLIDADO' ? ['PESSOAL', 'EMPRESARIAL'] : [viewMode]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-app-fg">Categorias</h1>
          <p className="text-sm text-app-muted">
            Organize seus lançamentos — separadas por contexto.
          </p>
        </div>
        {canWrite && (
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            <span className="hidden sm:inline">Nova categoria</span>
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-app-muted" />
          <TextInput
            type="search"
            placeholder="Buscar categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {contextos.map((ctx) => (
        <div key={ctx} className="space-y-3">
          <div className="flex items-center gap-2">
            <ContextBadge contexto={ctx} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(['RECEITA', 'DESPESA'] as TxType[]).map((tipo) => (
              <Surface key={tipo} className="p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-muted">
                  {TX_TYPE_LABEL[tipo]}s
                </p>
                <ul className="space-y-1">
                  {(() => {
                    const ctxCats = categories.filter((c) => c.contexto === ctx && c.tipo === tipo)
                    
                    const matchesSearch = (c: Category) => c.nome.toLowerCase().includes(search.toLowerCase())
                    
                    const pais = ctxCats.filter(c => !c.categoria_pai_id).sort((a, b) => a.nome.localeCompare(b.nome))
                    
                    const renderCat = (c: Category, isSub = false) => {
                      const subs = !isSub ? ctxCats.filter(sub => sub.categoria_pai_id === c.id).sort((a, b) => a.nome.localeCompare(b.nome)) : []
                      const hasSubs = subs.length > 0
                      
                      // Filter: if parent matches, show it and all subs. If a sub matches, show the parent and the matching sub.
                      const isMatch = matchesSearch(c)
                      const matchingSubs = subs.filter(matchesSearch)
                      
                      if (!isMatch && matchingSubs.length === 0 && !isSub) return null
                      if (isSub && !matchesSearch(c) && !matchesSearch(ctxCats.find(p => p.id === c.categoria_pai_id)!)) return null

                      // Force expand if searching
                      const isCollapsed = search ? false : collapsed[c.id]

                      return (
                        <div key={c.id}>
                          <li
                            className={cn(
                              "group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-app-surface-2",
                              isSub && "ml-8 opacity-90 border-l-2 border-app-border rounded-l-none pl-3"
                            )}
                          >
                            <span
                              className={cn(
                                "grid shrink-0 place-items-center rounded-lg",
                                isSub ? "size-6" : "size-7"
                              )}
                              style={{ background: `${c.cor}22`, color: c.cor }}
                            >
                              <CategoryIcon name={c.icone} className={isSub ? "size-3.5" : "size-4"} />
                            </span>
                            <span className={cn("flex-1 truncate text-app-fg", isSub ? "text-xs" : "text-sm font-medium")}>{c.nome}</span>
                            
                            {hasSubs && (
                              <button
                                onClick={() => toggleCollapse(c.id)}
                                className="grid size-6 place-items-center rounded text-app-muted hover:text-app-fg hover:bg-app-border/50 cursor-pointer"
                              >
                                {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                              </button>
                            )}

                            {c.sistema ? (
                              <Lock className="size-3.5 text-app-muted" />
                            ) : canWrite ? (
                              <button
                                aria-label="Editar categoria"
                                onClick={() => setEditing(c)}
                                className="grid size-6 place-items-center rounded text-app-muted opacity-0 hover:text-app-fg group-hover:opacity-100 cursor-pointer"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                            ) : null}
                          </li>
                          
                          {/* Subcategorias */}
                          {!isSub && hasSubs && !isCollapsed && (
                            <div className="mt-1">
                              {subs.map(sub => renderCat(sub, true))}
                            </div>
                          )}
                        </div>
                      )
                    }

                    return pais.map(p => renderCat(p))
                  })()}
                </ul>
              </Surface>
            ))}
          </div>
        </div>
      ))}

      <CategoryFormModal open={creating} onClose={() => setCreating(false)} />
      <CategoryFormModal
        open={!!editing}
        category={editing ?? undefined}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}
