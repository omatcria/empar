import { useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { History, ChevronDown, ChevronUp } from '@/components/icons'
import { useData } from '@/store/data'
import { useWorkspace } from '@/store/workspace'
import { Surface } from '@/components/ui/primitives'
import { Avatar } from '@/components/ui/Avatar'
import { Field, TextInput } from '@/components/ui/form'

const ACTION_LABEL: Record<string, string> = {
  create: 'criou',
  update: 'editou',
  delete: 'excluiu',
}

const ENTITY_LABEL: Record<string, string> = {
  transaction: 'um lançamento',
}

const VISIVEIS_PADRAO = 6

/** Histórico de "quem fez o quê" no espaço (audita create/update/delete). */
export function ActivityFeed() {
  const { activityLog, loadActivity } = useData()
  const { members } = useWorkspace()
  const [expanded, setExpanded] = useState(false)
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.user_id, m])),
    [members],
  )

  useEffect(() => {
    loadActivity()
  }, [loadActivity])

  const filtrados = useMemo(() => {
    return activityLog.filter((a) => {
      const dia = a.at.slice(0, 10)
      if (de && dia < de) return false
      if (ate && dia > ate) return false
      return true
    })
  }, [activityLog, de, ate])

  if (activityLog.length === 0) return null

  const temFiltro = !!de || !!ate
  // Colapsado (sem filtro) mostra só os 6 primeiros; expandido mostra tudo (filtrado).
  const visiveis = expanded || temFiltro ? filtrados : filtrados.slice(0, VISIVEIS_PADRAO)
  const ocultos = filtrados.length - visiveis.length

  return (
    <Surface className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-app-fg">
          <History className="size-4" /> Atividade recente
        </h2>
        {(activityLog.length > VISIVEIS_PADRAO || expanded) && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-pessoal-strong hover:underline cursor-pointer"
          >
            {expanded ? (
              <>
                Minimizar <ChevronUp className="size-3.5" />
              </>
            ) : (
              <>
                Ver mais <ChevronDown className="size-3.5" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Filtro de datas — só quando expandido */}
      {expanded && (
        <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-app-border bg-app-surface-2 p-3">
          <Field label="De" htmlFor="act-de">
            <TextInput id="act-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </Field>
          <Field label="Até" htmlFor="act-ate">
            <TextInput id="act-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </Field>
          {temFiltro && (
            <button
              onClick={() => {
                setDe('')
                setAte('')
              }}
              className="col-span-2 text-left text-xs text-app-muted hover:text-app-fg cursor-pointer"
            >
              Limpar filtro
            </button>
          )}
        </div>
      )}

      {visiveis.length === 0 ? (
        <p className="py-4 text-center text-sm text-app-muted">
          Nenhuma atividade neste período.
        </p>
      ) : (
        <div className="space-y-3">
          {visiveis.map((a) => {
            const who = memberById.get(a.user_id)
            const nome = who?.nome || who?.email?.split('@')[0] || 'Alguém'
            const acao = ACTION_LABEL[a.action] ?? a.action
            const ent = ENTITY_LABEL[a.entity] ?? a.entity
            const desc = (a.meta as { descricao?: string } | null)?.descricao
            return (
              <div key={a.id} className="flex items-start gap-3">
                <Avatar path={who?.avatar_url} nome={nome} className="size-7 text-[10px]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-app-fg">
                    <span className="font-medium">{nome}</span>{' '}
                    <span className="text-app-fg2">
                      {acao} {ent}
                    </span>
                    {desc ? <span className="text-app-muted"> — {desc}</span> : null}
                  </p>
                  <span className="text-[11px] text-app-muted">
                    {formatDistanceToNow(parseISO(a.at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!expanded && ocultos > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-3 w-full rounded-xl border border-app-border py-2 text-xs font-medium text-app-muted hover:bg-app-surface-2 cursor-pointer"
        >
          Ver mais {ocultos} {ocultos === 1 ? 'atividade' : 'atividades'}
        </button>
      )}
    </Surface>
  )
}
