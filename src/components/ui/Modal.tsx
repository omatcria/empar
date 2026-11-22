import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@/components/icons'
import { cn } from '@/lib/cn'

/**
 * Modal centralizado no desktop e folha inferior no mobile.
 * Scrim forte (dismiss por fora) + Esc para fechar (escape-routes).
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  const selectWasOpen = useRef(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onMouseDown={(e) => {
          selectWasOpen.current = !!e.currentTarget.parentElement?.querySelector('[role="combobox"][aria-expanded="true"]')
        }}
        onClick={() => {
          if (!selectWasOpen.current) onClose()
          selectWasOpen.current = false
        }}
      />
      <div
        className={cn(
          'relative z-10 w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto',
          'rounded-t-2xl sm:rounded-2xl border border-app-border bg-app-surface shadow-2xl',
          'animate-[modal_.18s_ease-out]',
          className,
        )}
      >
        <div className="sticky top-0 flex items-center justify-between gap-4 border-b border-app-border bg-app-surface/95 px-5 py-4 backdrop-blur">
          <h2 className="text-base font-semibold text-app-fg">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-10 place-items-center rounded-lg text-app-muted hover:bg-app-surface-2 hover:text-app-fg cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>
        <div
          className="px-5 py-5"
          style={footer ? undefined : { paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
        >
          {children}
        </div>
        {footer && (
          <div
            className="sticky bottom-0 flex justify-end gap-2 border-t border-app-border bg-app-surface/95 px-5 pt-4 backdrop-blur"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
