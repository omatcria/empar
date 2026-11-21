import { useState, useRef, useEffect } from 'react'
import { Bell } from '@/components/icons'
import { useNotifications } from '@/store/notifications'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative grid size-10 place-items-center rounded-full hover:bg-app-surface-2 transition-colors cursor-pointer text-app-muted hover:text-app-fg"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute right-2 top-2 flex size-3 items-center justify-center rounded-full bg-warn text-[8px] font-bold text-white shadow ring-2 ring-app-bg">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-xl z-50">
          <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
            <h3 className="font-semibold text-app-fg">Notificações</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="text-xs font-medium text-pessoal hover:underline cursor-pointer"
              >
                Marcar todas lidas
              </button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-app-muted">
                Nenhuma notificação por enquanto.
              </div>
            ) : (
              <div className="divide-y divide-app-border">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (!n.lida) markAsRead(n.id)
                    }}
                    className={`flex flex-col gap-1 p-4 cursor-pointer hover:bg-app-surface-2 transition-colors ${
                      !n.lida ? 'bg-pessoal/5' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm ${!n.lida ? 'font-semibold text-app-fg' : 'text-app-fg2'}`}>
                        {n.titulo}
                      </p>
                      {!n.lida && <span className="size-2 shrink-0 rounded-full bg-pessoal mt-1" />}
                    </div>
                    <p className={`text-xs ${!n.lida ? 'text-app-fg2' : 'text-app-muted'}`}>
                      {n.corpo}
                    </p>
                    <span className="text-[10px] text-app-muted mt-1">
                      {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
