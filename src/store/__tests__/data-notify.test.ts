import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { notifyMembers, scheduleGenerate } = vi.hoisted(() => ({
  notifyMembers: vi.fn(async () => {}),
  scheduleGenerate: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }))
vi.mock('../owner', () => ({ ownerCols: () => ({ user_id: 'u', workspace_id: 'w' }) }))
vi.mock('../notify', () => ({ notifyMembers }))
vi.mock('../notifications', () => ({
  useNotifications: { getState: () => ({ scheduleGenerate, load: vi.fn() }) },
}))

import { useData } from '../data'
import type { Recurrence } from '@/domain/types'

const initial = useData.getState()

const card = { id: 'card', dia_fechamento: 10, dia_vencimento: 20 }

const base = {
  contexto: 'PESSOAL',
  category_id: 'cat',
  tipo: 'DESPESA',
  card_id: 'card',
}

function grupo(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    ...base,
    id: `t${i + 1}`,
    descricao: `TV (${i + 1}/${n})`,
    valor_centavos: 20000,
    data: '2026-11-22',
    parcela_n: i + 1,
    parcela_total: n,
    parcela_group_id: 'g1',
    pago: true,
  }))
}

beforeEach(() => {
  useData.setState(initial, true)
  notifyMembers.mockClear()
  scheduleGenerate.mockClear()
})

describe('avisos de membros no store de dados', () => {
  it('addCardPurchase 12x avisa uma vez com parcelas e valor total', async () => {
    useData.setState({
      cards: [card],
      categories: [{ id: 'cat', nome: 'Casa' }],
      ensureInvoice: vi.fn(async () => ({ id: 'inv' })),
      addTransactions: vi.fn(async () => []),
    } as never)
    await useData.getState().addCardPurchase({
      cardId: 'card',
      contexto: 'PESSOAL',
      category_id: 'cat',
      valor_centavos: 240000,
      data: '2026-11-22',
      descricao: 'TV',
      parcelas: 12,
    })
    expect(notifyMembers).toHaveBeenCalledTimes(1)
    expect(notifyMembers).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'lancamento',
        acao: 'criou',
        descricao: 'TV',
        valorCentavos: 240000,
        parcelas: 12,
      }),
    )
    // a gravação interna é silenciosa
    const addTransactions = useData.getState().addTransactions as unknown as ReturnType<typeof vi.fn>
    expect((addTransactions.mock.calls[0] as unknown[])[1]).toEqual({ silent: true })
  })

  it('addCardPurchase à vista avisa uma vez', async () => {
    const addTransaction = vi.fn(async () => ({ id: 'x' }))
    useData.setState({
      cards: [card],
      categories: [{ id: 'cat', nome: 'Casa' }],
      ensureInvoice: vi.fn(async () => ({ id: 'inv' })),
      addTransaction,
    } as never)
    await useData.getState().addCardPurchase({
      cardId: 'card',
      contexto: 'PESSOAL',
      category_id: 'cat',
      valor_centavos: 5000,
      data: '2026-11-22',
      descricao: 'Lanche',
    })
    expect((addTransaction.mock.calls[0] as unknown[])[1]).toEqual({ silent: true })
    expect(notifyMembers).toHaveBeenCalledTimes(1)
    expect(notifyMembers).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'x', descricao: 'Lanche', valorCentavos: 5000 }),
    )
  })

  it('updateTransactionGroup ALL em grupo de 3 avisa uma vez com afetadas', async () => {
    const updateTransaction = vi.fn(async () => {})
    useData.setState({
      transactions: grupo(3),
      categories: [{ id: 'cat', nome: 'Casa' }],
      updateTransaction,
    } as never)
    await useData.getState().updateTransactionGroup('t1', { valor_centavos: 25000 }, 'ALL')
    expect(updateTransaction).toHaveBeenCalledTimes(3)
    expect(updateTransaction.mock.calls.every((c) => (c as any[])[2]?.silent === true)).toBe(true)
    expect(notifyMembers).toHaveBeenCalledTimes(1)
    expect(notifyMembers).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'editou', afetadas: 3, parcelas: 3 }),
    )
  })

  it('addTransaction silencioso não avisa, mas agenda a geração', async () => {
    const { supabase } = await import('@/lib/supabase')
    const row = { ...base, id: 'n1', descricao: 'Pix', valor_centavos: 100, data: '2026-11-22' }
    ;(supabase.from as any).mockImplementation(() => ({
      insert: () => ({ select: () => ({ single: async () => ({ data: row, error: null }) }) }),
    }))
    useData.setState({ transactions: [], categories: [], logActivity: vi.fn() } as never)
    await useData.getState().addTransaction(row as never, { silent: true })
    expect(notifyMembers).not.toHaveBeenCalled()
    expect(scheduleGenerate).toHaveBeenCalled()
    await useData.getState().addTransaction(row as never)
    expect(notifyMembers).toHaveBeenCalledTimes(1)
  })
})

describe('runDueRecurrences', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-22T12:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('gera ocorrências sem avisar os membros', async () => {
    const addTransactions = vi.fn(async () => [])
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
      updateRecurrence: vi.fn(async () => {}),
    } as never)
    await useData.getState().runDueRecurrences()
    expect(addTransactions).toHaveBeenCalledTimes(1)
    expect((addTransactions.mock.calls[0] as unknown[])[1]).toEqual({ silent: true })
    expect(notifyMembers).toHaveBeenCalledTimes(0)
  })
})
