import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { useAuth } from './auth'
import type {
  MemberRole,
  Workspace,
  WorkspaceInvite,
  WorkspaceUpdate,
  WorkspaceMember,
  WorkspaceWithRole,
} from '@/domain/types'

interface WorkspaceState {
  workspaces: WorkspaceWithRole[]
  activeWorkspaceId: string | null
  members: WorkspaceMember[]
  invites: WorkspaceInvite[]
  loading: boolean

  load: () => Promise<void>
  reset: () => void
  setActive: (id: string) => Promise<void>
  renameWorkspace: (id: string, nome: string) => Promise<void>
  updateWorkspace: (id: string, patch: WorkspaceUpdate) => Promise<void>

  loadMembers: () => Promise<void>
  loadInvites: () => Promise<void>
  createInvite: (role: MemberRole) => Promise<string>
  revokeInvite: (id: string) => Promise<void>
  acceptInvite: (token: string) => Promise<string>
  updateMemberRole: (memberId: string, role: MemberRole) => Promise<void>
  removeMember: (memberId: string) => Promise<void>
  leave: (workspaceId: string) => Promise<void>
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  members: [],
  invites: [],
  loading: true,

  load: async () => {
    set({ loading: true })
    const uid = useAuth.getState().user?.id
    if (!uid) {
      set({ loading: false })
      return
    }
    const [{ data: memberships }, { data: prof }] = await Promise.all([
      supabase.from('workspace_members').select('workspace_id, role').eq('user_id', uid),
      supabase.from('profiles').select('active_workspace_id').eq('id', uid).maybeSingle(),
    ])

    const roleByWs = new Map((memberships ?? []).map((m) => [m.workspace_id, m.role]))
    const ids = [...roleByWs.keys()]
    const { data: wsRows } = ids.length
      ? await supabase.from('workspaces').select('*').in('id', ids)
      : { data: [] as Workspace[] }

    const workspaces: WorkspaceWithRole[] = (wsRows ?? []).map((w) => ({
      ...w,
      role: roleByWs.get(w.id) ?? 'viewer',
    }))

    let active = prof?.active_workspace_id ?? null
    if (!active || !workspaces.some((w) => w.id === active))
      active = workspaces[0]?.id ?? null

    set({ workspaces, activeWorkspaceId: active, loading: false })
  },

  reset: () =>
    set({ workspaces: [], activeWorkspaceId: null, members: [], invites: [], loading: true }),

  setActive: async (id) => {
    if (get().activeWorkspaceId === id) return
    set({ activeWorkspaceId: id, members: [], invites: [] })
    const uid = useAuth.getState().user?.id
    if (uid) await supabase.from('profiles').update({ active_workspace_id: id }).eq('id', uid)
  },

  renameWorkspace: async (id, nome) => {
    const { data, error } = await supabase
      .from('workspaces')
      .update({ nome })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    set((s) => ({
      workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, nome: data.nome } : w)),
    }))
  },

  updateWorkspace: async (id, patch) => {
    const { data, error } = await supabase
      .from('workspaces')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    set((s) => ({
      workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, ...data } : w)),
    }))
  },

  loadMembers: async () => {
    const ws = get().activeWorkspaceId
    if (!ws) return
    const { data: members } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', ws)
      .order('created_at')

    if (!members) {
      set({ members: [] })
      return
    }

    const userIds = members.map((m) => m.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, avatar_url')
      .in('id', userIds)

    const avatarMap = new Map((profiles ?? []).map((p) => [p.id, p.avatar_url]))

    const augmented = members.map((m) => ({
      ...m,
      avatar_url: avatarMap.get(m.user_id) ?? null,
    }))

    set({ members: augmented })
  },

  loadInvites: async () => {
    const ws = get().activeWorkspaceId
    if (!ws) return
    const { data } = await supabase
      .from('workspace_invites')
      .select('*')
      .eq('workspace_id', ws)
      .is('used_at', null)
      .order('created_at', { ascending: false })
    set({ invites: data ?? [] })
  },

  createInvite: async (role) => {
    const ws = get().activeWorkspaceId
    const uid = useAuth.getState().user?.id
    if (!ws) throw new Error('Sem espaço ativo')
    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    const expires_at = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
    const { data, error } = await supabase
      .from('workspace_invites')
      .insert({ workspace_id: ws, token, role, created_by: uid, expires_at })
      .select()
      .single()
    if (error) throw error
    set((s) => ({ invites: [data, ...s.invites] }))
    return token
  },

  revokeInvite: async (id) => {
    const { error } = await supabase.from('workspace_invites').delete().eq('id', id)
    if (error) throw error
    set((s) => ({ invites: s.invites.filter((i) => i.id !== id) }))
  },

  acceptInvite: async (token) => {
    const { data, error } = await supabase.rpc('accept_invite', { _token: token.trim() })
    if (error) throw error
    await get().load()
    set({ activeWorkspaceId: data as string })
    return data as string
  },

  updateMemberRole: async (memberId, role) => {
    const { data, error } = await supabase
      .from('workspace_members')
      .update({ role })
      .eq('id', memberId)
      .select()
      .single()
    if (error) throw error
    set((s) => ({ members: s.members.map((m) => (m.id === memberId ? data : m)) }))
  },

  removeMember: async (memberId) => {
    const { error } = await supabase.from('workspace_members').delete().eq('id', memberId)
    if (error) throw error
    set((s) => ({ members: s.members.filter((m) => m.id !== memberId) }))
  },

  leave: async (workspaceId) => {
    const uid = useAuth.getState().user?.id
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', uid ?? '')
    if (error) throw error
    await get().load()
  },
}))

/* ---------------- Seletores utilitários ---------------- */
export function useActiveWorkspace(): WorkspaceWithRole | undefined {
  return useWorkspace((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId))
}

export function useActiveRole(): MemberRole | undefined {
  return useActiveWorkspace()?.role
}

/** Usuário pode escrever no espaço ativo (Dono ou Editor)? */
export function useCanWrite(): boolean {
  const role = useActiveRole()
  return role === 'owner' || role === 'editor'
}
