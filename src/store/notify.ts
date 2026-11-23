import { supabase } from '@/lib/supabase'
import { buildMemberNotification, type MemberEvent } from '@/engine/member-notifications'
import { useAuth } from '@/store/auth'
import { useWorkspace } from '@/store/workspace'

/**
 * Avisa os outros membros do espaço ativo sobre uma ação do usuário atual.
 * Uma linha por destinatário; o gatilho do banco filtra preferências.
 * Nunca lança: falha só vai para o console.
 */
export async function notifyMembers(evt: MemberEvent): Promise<void> {
  try {
    const uid = useAuth.getState().user?.id
    const { activeWorkspaceId: ws, members: cached } = useWorkspace.getState()
    if (!uid || !ws) return

    let members: Array<{ user_id: string; nome: string | null }> = cached
    if (members.length === 0) {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('user_id, nome')
        .eq('workspace_id', ws)
      if (error) throw error
      members = data ?? []
    }

    const autor = members.find((m) => m.user_id === uid)?.nome || 'Alguém'
    const destinatarios = members.filter((m) => m.user_id !== uid)
    if (destinatarios.length === 0) return

    const n = buildMemberNotification(evt, autor)
    const rows = destinatarios.map((m) => ({
      workspace_id: ws,
      user_id: m.user_id,
      tipo: n.tipo,
      titulo: n.titulo,
      corpo: n.corpo,
      meta: n.meta,
    }))
    const { error } = await supabase.from('notifications').insert(rows)
    if (error) throw error
  } catch (e) {
    console.error('Falha ao avisar membros', e)
  }
}
