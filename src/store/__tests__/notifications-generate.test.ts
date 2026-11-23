import { beforeEach, describe, expect, it, vi } from 'vitest'

const { from, insert } = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: { from, channel: vi.fn() },
}))
vi.mock('../owner', () => ({ ownerCols: () => ({ user_id: 'me', workspace_id: 'ws' }) }))
vi.mock('../auth', () => ({ useAuth: { getState: () => ({ user: { id: 'me' } }) } }))

import { useNotifications } from '../notifications'
import { useData } from '../data'
import { useWorkspace } from '../workspace'
import { todayISO } from '@/lib/cn'

beforeEach(() => {
  insert.mockReset()
  // Simula a RLS: `.select()` (RETURNING) falha com 42501 se o lote tiver linha de outro usuário.
  insert.mockImplementation((rows: Array<Record<string, any>>) => {
    const res = { data: null, error: null }
    return {
      then: (ok: (v: typeof res) => unknown, ko?: (e: unknown) => unknown) =>
        Promise.resolve(res).then(ok, ko),
      select: async () =>
        rows.some((r) => r.user_id !== 'me')
          ? { data: null, error: { code: '42501', message: 'rls' } }
          : { data: rows.map((r, i) => ({ ...r, id: `n${i}`, lida: false, created_at: '2026-11-22T10:00:00Z' })), error: null },
    }
  })
  from.mockReset()
  from.mockImplementation((table: string) => {
    if (table === 'notifications')
      return {
        insert,
        select: () => ({ eq: () => ({ eq: async () => ({ data: [], error: null }) }) }),
      }
    throw new Error('tabela inesperada ' + table)
  })
})

describe('generate', () => {
  it('grava o aviso de orçamento para cada membro com o mesmo dedupe_key', async () => {
    const mes = todayISO().slice(0, 7)
    useWorkspace.setState({
      activeWorkspaceId: 'ws',
      workspaces: [],
      members: [
        { user_id: 'me', nome: 'G' },
        { user_id: 'u2', nome: 'A' },
      ],
    } as never)
    useData.setState({
      invoices: [],
      cards: [],
      categories: [{ id: 'cat', nome: 'Mercado' }],
      budgets: [{ id: 'b1', category_id: 'cat', mes_referencia: mes, limite_centavos: 100000 }],
      transactions: [
        {
          id: 't1',
          tipo: 'DESPESA',
          category_id: 'cat',
          valor_centavos: 85000,
          data: `${mes}-01`,
          pago: true,
          contexto: 'PESSOAL',
          account_id: 'a',
          card_id: null,
        },
      ],
    } as never)
    useNotifications.setState({ prefs: null, notifications: [], unreadCount: 0 })

    await useNotifications.getState().generate()

    // um insert para os outros membros (sem RETURNING) e outro para o próprio usuário
    expect(insert).toHaveBeenCalledTimes(2)
    const rows = insert.mock.calls.flatMap((c) => c[0] as Array<Record<string, any>>)
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.user_id).sort()).toEqual(['me', 'u2'])
    expect(rows.every((r) => r.tipo === 'orcamento_80')).toBe(true)
    expect(rows[0].meta.dedupe_key).toBe(`orcamento_80:b1:${mes}:80`)
    expect(rows[1].meta.dedupe_key).toBe(rows[0].meta.dedupe_key)
    // o estado local recebe só a linha própria
    const { notifications } = useNotifications.getState()
    expect(notifications).toHaveLength(1)
    expect(notifications[0].user_id).toBe('me')
    expect(useNotifications.getState().unreadCount).toBe(1)
  })
})
