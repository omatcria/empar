import { useEffect, useState } from 'react'
import { Check, Copy, LogOut, Plus, Trash2, UserPlus, Users } from '@/components/icons'
import { useAuth } from '@/store/auth'
import { useWorkspace, useActiveWorkspace } from '@/store/workspace'
import type { MemberRole } from '@/domain/types'
import { Button, Surface } from '@/components/ui/primitives'
import { Field, Select, TextInput } from '@/components/ui/form'
import { ActivityFeed } from '@/features/activity/ActivityFeed'
import { cn } from '@/lib/cn'

const ROLE_LABEL: Record<MemberRole, string> = {
  owner: 'Dono',
  editor: 'Editor',
  viewer: 'Visualizador',
}
const ROLE_BADGE: Record<MemberRole, string> = {
  owner: 'bg-warn/15 text-warn',
  editor: 'bg-pessoal-soft text-pessoal-strong',
  viewer: 'bg-app-surface-2 text-app-muted',
}

export function Members() {
  const myId = useAuth((s) => s.user?.id)
  const {
    workspaces,
    activeWorkspaceId,
    members,
    invites,
    setActive,
    renameWorkspace,
    loadMembers,
    loadInvites,
    createInvite,
    revokeInvite,
    acceptInvite,
    updateMemberRole,
    removeMember,
    leave,
  } = useWorkspace()
  const active = useActiveWorkspace()
  const isOwner = active?.role === 'owner'

  useEffect(() => {
    loadMembers()
    if (isOwner) loadInvites()
  }, [activeWorkspaceId, isOwner, loadMembers, loadInvites])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-app-fg">Membros</h1>
        <p className="text-sm text-app-muted">
          Compartilhe este espaço com quem cuida das finanças com você.
        </p>
      </div>

      {/* Espaço ativo + troca */}
      {workspaces.length > 1 && (
        <Surface className="p-5">
          <Field label="Espaço ativo" htmlFor="ws-switch">
            <Select
              id="ws-switch"
              value={activeWorkspaceId ?? ''}
              onChange={(e) => setActive(e.target.value)}
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.nome} · {ROLE_LABEL[w.role]}
                </option>
              ))}
            </Select>
          </Field>
        </Surface>
      )}

      {isOwner && active && <RenameCard nome={active.nome} onSave={(n) => renameWorkspace(active.id, n)} />}

      {/* Entrar com convite */}
      <JoinCard onAccept={acceptInvite} />

      {/* Lista de membros */}
      <Surface className="p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-app-fg">
          <Users className="size-4" /> Quem tem acesso
        </h2>
        <div className="space-y-2">
          {members.map((m) => {
            const isMe = m.user_id === myId
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-xl bg-app-surface-2 px-3 py-2.5">
                <div className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-pessoal to-empresarial text-sm font-bold text-white">
                  {(m.nome || m.email || '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-app-fg">
                    {m.nome || m.email || 'Membro'} {isMe && <span className="text-app-muted">(você)</span>}
                  </p>
                  {m.email && <p className="truncate text-xs text-app-muted">{m.email}</p>}
                </div>

                {isOwner && !isMe ? (
                  <Select
                    value={m.role}
                    onChange={(e) => updateMemberRole(m.id, e.target.value as MemberRole)}
                    className="h-8 w-36 text-xs"
                  >
                    <option value="owner">Dono</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Visualizador</option>
                  </Select>
                ) : (
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', ROLE_BADGE[m.role])}>
                    {ROLE_LABEL[m.role]}
                  </span>
                )}

                {isOwner && !isMe && (
                  <button
                    aria-label="Remover"
                    onClick={() => removeMember(m.id)}
                    className="grid size-8 place-items-center rounded-lg text-app-muted hover:bg-expense/10 hover:text-expense cursor-pointer"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
                {isMe && m.role !== 'owner' && (
                  <button
                    aria-label="Sair do espaço"
                    onClick={() => leave(m.workspace_id)}
                    className="grid size-8 place-items-center rounded-lg text-app-muted hover:bg-expense/10 hover:text-expense cursor-pointer"
                  >
                    <LogOut className="size-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </Surface>

      {/* Convites (dono) */}
      {isOwner && (
        <InvitesCard
          invites={invites}
          onCreate={createInvite}
          onRevoke={revokeInvite}
        />
      )}

      {/* Histórico de "quem fez o quê" */}
      <ActivityFeed />
    </div>
  )
}

function RenameCard({ nome, onSave }: { nome: string; onSave: (n: string) => Promise<void> }) {
  const [val, setVal] = useState(nome)
  const [saving, setSaving] = useState(false)
  return (
    <Surface className="p-5">
      <Field label="Nome do espaço" htmlFor="ws-nome">
        <div className="flex gap-2">
          <TextInput id="ws-nome" value={val} onChange={(e) => setVal(e.target.value)} />
          <Button
            variant="secondary"
            loading={saving}
            disabled={!val.trim() || val === nome}
            onClick={async () => {
              setSaving(true)
              await onSave(val.trim())
              setSaving(false)
            }}
          >
            Salvar
          </Button>
        </div>
      </Field>
    </Surface>
  )
}

function JoinCard({ onAccept }: { onAccept: (t: string) => Promise<string> }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function entrar() {
    if (!code.trim()) return
    setLoading(true)
    setMsg(null)
    try {
      await onAccept(code)
      setMsg({ ok: true, text: 'Você entrou no espaço!' })
      setCode('')
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message || 'Convite inválido.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Surface className="p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-app-fg">
        <UserPlus className="size-4" /> Entrar com um convite
      </h2>
      <div className="flex gap-2">
        <TextInput
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Cole o código do convite"
        />
        <Button onClick={entrar} loading={loading} disabled={!code.trim()}>
          Entrar
        </Button>
      </div>
      {msg && (
        <p className={cn('mt-2 text-sm', msg.ok ? 'text-income' : 'text-expense')}>{msg.text}</p>
      )}
    </Surface>
  )
}

function InvitesCard({
  invites,
  onCreate,
  onRevoke,
}: {
  invites: ReturnType<typeof useWorkspace.getState>['invites']
  onCreate: (r: MemberRole) => Promise<string>
  onRevoke: (id: string) => Promise<void>
}) {
  const [role, setRole] = useState<MemberRole>('editor')
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  function linkOf(token: string) {
    return `${window.location.origin}/?convite=${token}`
  }
  async function copy(token: string) {
    await navigator.clipboard.writeText(linkOf(token))
    setCopied(token)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <Surface className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-app-fg">Convites</h2>
      <div className="flex items-end gap-2">
        <Field label="Papel do convidado" htmlFor="inv-role" className="flex-1">
          <Select id="inv-role" value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
            <option value="editor">Editor (lança e edita)</option>
            <option value="viewer">Visualizador (só vê)</option>
            <option value="owner">Dono (controle total)</option>
          </Select>
        </Field>
        <Button
          icon={<Plus className="size-4" />}
          loading={creating}
          onClick={async () => {
            setCreating(true)
            try {
              await onCreate(role)
            } finally {
              setCreating(false)
            }
          }}
        >
          Gerar
        </Button>
      </div>

      {invites.length > 0 && (
        <div className="mt-4 space-y-2">
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center gap-2 rounded-xl bg-app-surface-2 px-3 py-2">
              <code className="flex-1 truncate text-xs text-app-fg2">{inv.token}</code>
              <span className={cn('rounded-full px-2 py-0.5 text-[11px]', ROLE_BADGE[inv.role])}>
                {ROLE_LABEL[inv.role]}
              </span>
              <button
                onClick={() => copy(inv.token)}
                className="grid size-8 place-items-center rounded-lg text-app-muted hover:bg-app-border/60 hover:text-app-fg cursor-pointer"
                aria-label="Copiar link"
              >
                {copied === inv.token ? <Check className="size-4 text-income" /> : <Copy className="size-4" />}
              </button>
              <button
                onClick={() => onRevoke(inv.id)}
                className="grid size-8 place-items-center rounded-lg text-app-muted hover:bg-expense/10 hover:text-expense cursor-pointer"
                aria-label="Revogar"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-app-muted">
        Copie o link e envie para a pessoa. Ela entra ao abrir o link (logada) ou colando o código acima.
      </p>
    </Surface>
  )
}
