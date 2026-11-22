import { ChevronLeft, ChevronRight } from '@/components/icons'
import { addMonths, format, parse } from 'date-fns'
import { useUI } from '@/store/ui'
import { mesRefLabel } from '@/engine/period'
import { cn } from '@/lib/cn'

function shift(mes: string, delta: number): string {
  const d = parse(mes + '-01', 'yyyy-MM-dd', new Date())
  return format(addMonths(d, delta), 'yyyy-MM')
}

/** Navegação de mês de referência (‹ jul/2026 ›). */
export function MonthSelector({ className }: { className?: string }) {
  const { mes, setMes } = useUI()
  return (
    <div
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 sm:gap-1 rounded-xl border border-app-border bg-app-surface-2 p-1',
        className,
      )}
    >
      <button
        aria-label="Mês anterior"
        onClick={() => setMes(shift(mes, -1))}
        className="grid size-10 place-items-center rounded-lg text-app-muted hover:bg-app-border/60 hover:text-app-fg cursor-pointer"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="px-1 text-center sm:min-w-24 sm:px-0 text-sm font-medium capitalize text-app-fg">
        {mesRefLabel(mes)}
      </span>
      <button
        aria-label="Próximo mês"
        onClick={() => setMes(shift(mes, 1))}
        className="grid size-10 place-items-center rounded-lg text-app-muted hover:bg-app-border/60 hover:text-app-fg cursor-pointer"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}
