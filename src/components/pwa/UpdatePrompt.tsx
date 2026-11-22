import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/primitives'

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null
  return (
    <div
      className="fixed inset-x-4 bottom-24 z-[60] mx-auto flex max-w-sm items-center justify-between gap-3 rounded-xl border border-app-border bg-app-surface px-4 py-3 shadow-lg lg:bottom-6 lg:left-auto lg:right-6 lg:mx-0"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <p className="text-sm text-app-fg">Nova versão disponível</p>
      <Button onClick={() => updateServiceWorker(true)}>Atualizar</Button>
    </div>
  )
}
