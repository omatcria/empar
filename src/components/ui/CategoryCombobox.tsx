import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Search } from '@/components/icons'
import type { Category } from '@/domain/types'
import { CategoryIcon } from '@/domain/icons-catalog'
import { cn } from '@/lib/cn'

interface CategoryComboboxProps {
  value: string
  onChange: (id: string) => void
  categories: Category[]
  id?: string
  className?: string
  placeholder?: string
}

export function CategoryCombobox({ value, onChange, categories, id, className, placeholder = "Selecione uma categoria..." }: CategoryComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selected = useMemo(() => categories.find(c => c.id === value), [categories, value])

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return categories.filter(c => c.nome.toLowerCase().includes(s))
  }, [categories, search])

  // Hierarchical display if search is empty?
  // Since this is for a dropdown, alphabetical or hierarchical is good.
  const displayCategories = useMemo(() => {
    if (search) return filtered.sort((a, b) => a.nome.localeCompare(b.nome))
    
    const parents = categories.filter(c => !c.categoria_pai_id).sort((a, b) => a.nome.localeCompare(b.nome))
    const result: (Category & { isSub?: boolean })[] = []
    for (const p of parents) {
      result.push(p)
      const subs = categories.filter(c => c.categoria_pai_id === p.id).sort((a, b) => a.nome.localeCompare(b.nome))
      for (const sub of subs) {
        result.push({ ...sub, isSub: true })
      }
    }
    return result
  }, [categories, filtered, search])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen(!open)}
        className="flex h-11 w-full items-center justify-between rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pessoal cursor-pointer"
      >
        {selected ? (
          <div className="flex items-center gap-2 overflow-hidden">
            <span
              className="grid size-6 shrink-0 place-items-center rounded-lg"
              style={{ background: `${selected.cor}22`, color: selected.cor }}
            >
              <CategoryIcon name={selected.icone} className="size-3.5" />
            </span>
            <span className="truncate font-medium text-app-fg">{selected.nome}</span>
          </div>
        ) : (
          <span className="text-app-muted truncate">{placeholder}</span>
        )}
        <ChevronDown className="size-4 shrink-0 text-app-muted ml-2" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-full overflow-hidden rounded-xl border border-app-border bg-app-surface shadow-xl z-50 flex flex-col max-h-72">
          <div className="flex items-center gap-2 border-b border-app-border px-3 py-2 text-app-fg">
            <Search className="size-4 shrink-0 text-app-muted" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-app-muted"
            />
          </div>
          <div className="overflow-y-auto p-1.5 flex-1 space-y-0.5">
            {displayCategories.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-app-muted">Nenhuma categoria encontrada.</p>
            ) : (
              displayCategories.map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    onChange(c.id)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors cursor-pointer hover:bg-app-surface-2",
                    c.id === value ? "bg-app-surface-2" : "",
                    ('isSub' in c && c.isSub) ? "pl-7 opacity-90 border-l border-transparent hover:border-app-border" : ""
                  )}
                >
                  <span
                    className={cn("grid shrink-0 place-items-center rounded-lg", ('isSub' in c && c.isSub) ? "size-5" : "size-7")}
                    style={{ background: `${c.cor}22`, color: c.cor }}
                  >
                    <CategoryIcon name={c.icone} className={('isSub' in c && c.isSub) ? "size-3" : "size-4"} />
                  </span>
                  <span className={cn("flex-1 truncate text-app-fg", ('isSub' in c && c.isSub) ? "text-xs" : "text-sm font-medium")}>{c.nome}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
