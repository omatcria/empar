import { useEffect, useState } from 'react'
import { Surface, Button } from '@/components/ui/primitives'
import { usePush, type PushStatus } from '@/store/push'
import { useNotifications } from '@/store/notifications'

type PrefKey =
  | 'membros_lancamentos' | 'membros_desejos' | 'reacoes'
  | 'venc_faturas' | 'venc_contas' | 'venc_recorrencias' | 'venc_dividas'
  | 'orcamento_80' | 'mei_alertas' | 'wishlist_precos'

const GROUPS: { title: string; items: { key: PrefKey; label: string }[] }[] = [
  {
    title: 'Ações de outros membros',
    items: [
      { key: 'membros_lancamentos', label: 'Lançamentos' },
      { key: 'membros_desejos', label: 'Desejos' },
      { key: 'reacoes', label: 'Reações' },
    ],
  },
  {
    title: 'Vencimentos',
    items: [
      { key: 'venc_faturas', label: 'Faturas' },
      { key: 'venc_contas', label: 'Contas a pagar' },
      { key: 'venc_recorrencias', label: 'Recorrências' },
      { key: 'venc_dividas', label: 'Parcelas de dívidas' },
    ],
  },
  {
    title: 'Alertas',
    items: [
      { key: 'orcamento_80', label: 'Orçamento 80%' },
      { key: 'mei_alertas', label: 'Limite do MEI' },
      { key: 'wishlist_precos', label: 'Queda de preço' },
    ],
  },
]

const STATUS_TEXT: Partial<Record<PushStatus, string>> = {
  on: 'Ativas neste aparelho',
  off: 'Desativadas',
  blocked: 'Bloqueadas no navegador',
  'ios-install': 'No iPhone, instale o app na tela inicial para receber notificações',
  unsupported: 'Este navegador não suporta notificações',
}

export function NotificationSettings() {
  const { status, error, enable, disable, sendTest } = usePush()
  const prefs = useNotifications((s) => s.prefs)
  const updatePrefs = useNotifications((s) => s.updatePrefs)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (status !== 'on') setTestResult(null)
  }, [status])

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      setTestResult((await sendTest()) ? 'ok' : 'fail')
    } finally {
      setTesting(false)
    }
  }

  const statusText = STATUS_TEXT[status]

  return (
    <Surface className="p-5">
      <h2 className="mb-1 text-sm font-semibold text-app-fg">Notificações</h2>
      <p className="mb-4 text-xs text-app-muted">Escolha o que deseja receber neste aparelho e no app.</p>

      {statusText && <p className="mb-3 text-sm font-medium text-app-fg">{statusText}</p>}
      {status === 'blocked' && (
        <p className="mb-3 text-xs text-app-muted">
          Para receber, libere as notificações deste site nas configurações do navegador (no iPhone: Ajustes › Notificações › Empar) e recarregue o app.
        </p>
      )}
      {status === 'error' && error && (
        <p role="alert" className="mb-3 text-sm text-expense">{error}</p>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {(status === 'off' || status === 'error') && (
          <Button onClick={() => void enable()}>Ativar notificações</Button>
        )}
        {status === 'on' && (
          <>
            <Button variant="secondary" onClick={() => void disable()}>
              Desativar neste aparelho
            </Button>
            <Button variant="secondary" onClick={() => void handleTest()} loading={testing}>
              Enviar teste
            </Button>
          </>
        )}
      </div>
      {status === 'on' && testResult === 'ok' && (
        <p role="status" className="mb-3 text-sm text-app-fg2">Teste enviado. Deve chegar em instantes.</p>
      )}
      {status === 'on' && testResult === 'fail' && error && (
        <p role="alert" className="mb-3 text-sm text-expense">{error}</p>
      )}

      {prefs && (
        <div className="space-y-5">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-app-muted">{g.title}</h3>
              <div className="divide-y divide-app-border">
                {g.items.map(({ key, label }) => {
                  const checked = !!prefs[key]
                  return (
                    <div key={key} className="flex min-h-11 items-center justify-between gap-3 py-1">
                      <span className="min-w-0 text-sm font-medium text-app-fg">{label}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={checked}
                        aria-label={label}
                        onClick={() => void updatePrefs({ [key]: !checked })}
                        className="grid h-10 w-14 shrink-0 cursor-pointer place-items-center"
                      >
                        <span
                          className={
                            'relative block h-6 w-11 rounded-full transition-colors ' +
                            (checked ? 'bg-pessoal' : 'bg-app-border')
                          }
                        >
                          <span
                            className={
                              'absolute top-0.5 size-5 rounded-full bg-white transition-all ' +
                              (checked ? 'left-[22px]' : 'left-0.5')
                            }
                          />
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Surface>
  )
}
