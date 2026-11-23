import { beforeEach, describe, expect, it, vi } from 'vitest'

const { from, insert, state } = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(),
  state: {
    members: [] as Array<{ user_id: string; nome: string }>,
    fetched: [] as Array<{ user_id: string; nome: string }>,
  },
}))

vi.mock('@/lib/supabase', () => ({ supabase: { from } }))
vi.mock('@/store/auth', () => ({ useAuth: { getState: () => ({ user: { id: 'me' } }) } }))
vi.mock('@/store/workspace', () => ({
  useWorkspace: { getState: () => ({ activeWorkspaceId: 'ws', members: state.members }) },
}))

import { notifyMembers } from '../notify'
import type { MemberEvent } from '@/engine/member-notifications'

const evt: MemberEvent = {
  kind: 'lancamento',
  acao: 'criou',
  entityId: 'tx1',
  descricao: 'Mercado',
  tipo: 'DESPESA',
  valorCentavos: 15000,
  data: '2026-11-22',
}

beforeEach(() => {
  insert.mockReset()
  insert.mockResolvedValue({ error: null })
  from.mockReset()
  from.mockImplementation((table: string) => {
    if (table === 'notifications') return { insert }
    if (table === 'workspace_members')
      return { select: () => ({ eq: async () => ({ data: state.fetched, error: null }) }) }
    throw new Error('tabela inesperada ' + table)
  })
  state.members = []
  state.fetched = []
})

describe('notifyMembers', () => {
  it('grava uma linha por outro membro, sem o usuário atual', async () => {
    state.members = [
      { user_id: 'me', nome: 'Gabriela' },
      { user_id: 'u2', nome: 'Ana' },
      { user_id: 'u3', nome: 'Beto' },
    ]
    await notifyMembers(evt)
    expect(insert).toHaveBeenCalledTimes(1)
    const rows = insert.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.user_id)).toEqual(['u2', 'u3'])
    expect(rows.every((r) => r.user_id !== 'me')).toBe(true)
    expect(rows[0]).toMatchObject({
      workspace_id: 'ws',
      tipo: 'membro_lancamento',
      titulo: 'Gabriela lançou: Mercado',
      corpo: 'Despesa de R$ 150,00 · 22/11',
      meta: { acao: 'criou', entity_id: 'tx1' },
    })
  })

  it('com members vazio busca workspace_members e avisa os outros', async () => {
    state.fetched = [
      { user_id: 'me', nome: 'Gabriela' },
      { user_id: 'u2', nome: 'Ana' },
    ]
    await notifyMembers(evt)
    expect(from).toHaveBeenCalledWith('workspace_members')
    const rows = insert.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(rows.map((r) => r.user_id)).toEqual(['u2'])
    expect(rows[0].titulo).toBe('Gabriela lançou: Mercado')
  })

  it('não insere quando não há outros membros', async () => {
    state.members = [{ user_id: 'me', nome: 'Gabriela' }]
    await notifyMembers(evt)
    expect(insert).not.toHaveBeenCalled()
  })

  it('usa "Alguém" quando o nome não é conhecido', async () => {
    state.members = [{ user_id: 'u2', nome: 'Ana' }]
    await notifyMembers(evt)
    const rows = insert.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(rows[0].titulo).toBe('Alguém lançou: Mercado')
  })

  it('não lança quando o insert rejeita ou retorna erro', async () => {
    state.members = [{ user_id: 'u2', nome: 'Ana' }]
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    insert.mockRejectedValueOnce(new Error('boom'))
    await expect(notifyMembers(evt)).resolves.toBeUndefined()
    insert.mockResolvedValueOnce({ error: new Error('rls') })
    await expect(notifyMembers(evt)).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
