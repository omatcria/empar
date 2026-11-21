import { useState } from 'react'
import type { ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Download, ShieldAlert, Trash2 } from '@/components/icons'
import { Button, Surface } from '@/components/ui/primitives'
import { Field, TextInput } from '@/components/ui/form'
import { Modal } from '@/components/ui/Modal'
import { useData } from '@/store/data'
import { useActiveRole } from '@/store/workspace'
import { exportBackup } from './backup'

/** Texto exato exigido para habilitar o reset (sem trim, diferencia maiúsculas). */
export const RESET_CONFIRM_TEXT = 'RESETAR'

const APAGADO = [
  'Contas, cartões e faturas',
  'Lançamentos, recorrências e orçamentos',
  'Metas, categorias e envelopes de imposto (voltam ao padrão)',
  'Investimentos e aportes/resgates',
  'Dívidas e parcelas',
  'Lista de desejos e histórico de preços',
  'Notificações e histórico de atividades',
]
const MANTIDO = [
  'Seu perfil (nome, foto, pró-labore padrão, CDI)',
  'O espaço de trabalho e a configuração do MEI',
  'Membros e convites',
  'Preferências de notificação',
]

export function DangerZone(): ReactElement | null {
  const role = useActiveRole()
  const resetWorkspace = useData((s) => s.resetWorkspace)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [texto, setTexto] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (role !== 'owner') return null

  const close = () => {
    if (busy) return
    setOpen(false)
    setTexto('')
    setErro(null)
  }

  const confirm = async () => {
    if (texto !== RESET_CONFIRM_TEXT || busy) return
    setBusy(true)
    setErro(null)
    try {
      await resetWorkspace()
      setOpen(false)
      setTexto('')
      navigate('/')
    } catch (e) {
      setErro((e as Error).message || 'Não foi possível resetar os dados.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Surface className="border-expense/40 p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-expense">
          <ShieldAlert className="size-4" /> Zona de perigo
        </h2>
        <p className="mb-4 text-sm text-app-muted">
          Apaga todos os dados financeiros do espaço e recomeça do zero, com o onboarding.
          Esta ação não pode ser desfeita.
        </p>
        <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setOpen(true)}>
          Resetar todos os dados
        </Button>
      </Surface>

      <Modal
        open={open}
        onClose={close}
        title="Resetar todos os dados"
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 className="size-4" />}
              loading={busy}
              disabled={texto !== RESET_CONFIRM_TEXT}
              onClick={confirm}
            >
              Apagar tudo e recomeçar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-expense/40 bg-expense/10 p-3 text-sm text-expense">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>Esta ação é permanente e vale para todos os membros do espaço.</span>
          </div>

          <div>
            <p className="mb-1 text-sm font-semibold text-app-fg">Será apagado</p>
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-app-fg2">
              {APAGADO.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold text-app-fg">Será mantido</p>
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-app-fg2">
              {MANTIDO.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="size-4" />}
            onClick={() => exportBackup(useData.getState())}
          >
            Baixar backup antes
          </Button>

          <Field label={`Digite ${RESET_CONFIRM_TEXT} para confirmar`} htmlFor="reset-confirm">
            <TextInput
              id="reset-confirm"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={RESET_CONFIRM_TEXT}
            />
          </Field>

          {erro && (
            <p role="alert" className="text-sm text-expense">
              {erro}
            </p>
          )}
        </div>
      </Modal>
    </>
  )
}
