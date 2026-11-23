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
  insert.mockReturnValue({ select: async () => ({ data: [], error: null }) })
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
    useNotifications.setState({ prefs: null })

    await useNotifications.getState().generate()

    expect(insert).toHaveBeenCalledTimes(1)
    const rows = insert.mock.calls[0][0] as Array<Record<string, any>>
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.user_id).sort()).toEqual(['me', 'u2'])
    expect(rows.every((r) => r.tipo === 'orcamento_80')).toBe(true)
    expect(rows[0].meta.dedupe_key).toBe(`orcamento_80:b1:${mes}:80`)
    expect(rows[1].meta.dedupe_key).toBe(rows[0].meta.dedupe_key)
  })
})
