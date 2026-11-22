import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }))
vi.mock('../owner', () => ({ ownerCols: () => ({ user_id: 'u', workspace_id: 'w' }) }))

import { useData } from '../data'
import type { Recurrence } from '@/domain/types'

describe('runDueRecurrences', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-22T12:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('chamadas simultâneas geram as ocorrências uma única vez', async () => {
    let liberar!: () => void
    const trava = new Promise<void>((r) => (liberar = r))
    const addTransactions = vi.fn(async () => {
      await trava
      return []
    })
    const updateRecurrence = vi.fn(async () => {})
    useData.setState({
      accounts: [{ id: 'acc-1', contexto: 'PESSOAL', arquivada: false }] as never,
      cards: [],
      recurrences: [
        {
          id: 'r1',
          contexto: 'PESSOAL',
          ativo: true,
          frequencia: 'mensal',
          dia: 20,
          proxima_data: '2026-11-20',
          template: {
            tipo: 'DESPESA',
            account_id: 'acc-1',
            card_id: null,
            category_id: 'c',
            valor_centavos: 1000,
            descricao: 'X',
            pago: true,
          },
        } as unknown as Recurrence,
      ],
      addTransactions,
      updateRecurrence,
    } as never)

    const a = useData.getState().runDueRecurrences()
    const b = useData.getState().runDueRecurrences()
    liberar()
    await Promise.all([a, b])
    expect(addTransactions).toHaveBeenCalledTimes(1)

    // depois de concluída, uma nova chamada volta a executar
    await useData.getState().runDueRecurrences()
    expect(addTransactions).toHaveBeenCalledTimes(2)
  })
})
