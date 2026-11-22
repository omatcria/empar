import { Building2, Layers, User } from '@/components/icons'
import type { ViewMode } from '@/domain/types'
import { VIEW_MODES, VIEW_MODE_LABEL } from '@/domain/enums'
import { useUI } from '@/store/ui'
import { cn } from '@/lib/cn'

const ICON: Record<ViewMode, typeof User> = {
  PESSOAL: User,
  EMPRESARIAL: Building2,
  CONSOLIDADO: Layers,
}

const ACTIVE: Record<ViewMode, string> = {
  PESSOAL: 'bg-pessoal-soft text-pessoal-strong ring-1 ring-pessoal/40',
  EMPRESARIAL: 'bg-empresarial-soft text-empresarial-strong ring-1 ring-empresarial/40',
  CONSOLIDADO: 'bg-app-surface text-app-fg ring-1 ring-app-border',
}

/** Seletor de contexto global — filtra todo o app. */
export function ContextSelector({ className }: { className?: string }) {
  const { viewMode, setViewMode } = useUI()
  return (
    <div
      role="tablist"
      aria-label="Contexto"
      className={cn(
        'inline-grid shrink-0 grid-cols-3 gap-1 rounded-xl bg-app-surface-2 p-1',
        className,
      )}
    >
      {VIEW_MODES.map((m) => {
        const Icon = ICON[m]
        const active = viewMode === m
        return (
          <button
            key={m}
            role="tab"
            aria-selected={active}
            onClick={() => setViewMode(m)}
            className={cn(
              'flex h-10 items-center justify-center gap-1.5 rounded-lg px-2 sm:px-3 text-sm font-medium transition-all cursor-pointer',
              active ? ACTIVE[m] : 'text-app-muted hover:text-app-fg2',
            )}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{VIEW_MODE_LABEL[m]}</span>
          </button>
        )
      })}
    </div>
  )
}
