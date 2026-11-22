import { Button, Surface } from '@/components/ui/primitives'
import { detectInstallState, usePwaInstall } from '@/store/pwa'

export function InstallCard() {
  const deferred = usePwaInstall((s) => s.deferred)
  const installedEvt = usePwaInstall((s) => s.installed)
  const promptInstall = usePwaInstall((s) => s.promptInstall)

  const standalone =
    installedEvt ||
    (typeof window !== 'undefined' &&
      (window.matchMedia?.('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true))

  const state = detectInstallState({
    standalone: !!standalone,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    hasPrompt: !!deferred,
    maxTouchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
  })

  return (
    <Surface className="p-5">
      <h2 className="mb-2 text-sm font-semibold text-app-fg">Instalar no celular</h2>
      {state === 'prompt' && (
        <Button onClick={() => void promptInstall()}>Instalar app</Button>
      )}
      {state === 'ios' && (
        <p className="text-sm text-app-fg2">
          No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.
        </p>
      )}
      {state === 'installed' && <p className="text-sm text-app-fg2">App instalado</p>}
      {state === 'unsupported' && (
        <p className="text-sm text-app-fg2">Abra pelo navegador do celular para instalar.</p>
      )}
    </Surface>
  )
}
