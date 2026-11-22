import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Budgets } from '../Budgets'

const state = vi.hoisted(() => ({
  categories: [] as unknown[],
  transactions: [] as unknown[],
  budgets: [] as unknown[],
}))

vi.mock('@/store/data', () => ({
  useData: () => ({
    categories: state.categories,
    transactions: state.transactions,
    budgets: state.budgets,
    upsertBudget: vi.fn(),
    deleteBudget: vi.fn(),
  }),
}))
vi.mock('@/store/ui', () => ({
  useUI: () => ({ viewMode: 'PESSOAL', mes: '2026-11' }),
}))
vi.mock('@/store/workspace', () => ({ useCanWrite: () => true }))
vi.mock('@/features/categories/CategoryFormModal', () => ({
  CategoryFormModal: () => null,
}))

describe('Budgets', () => {
  beforeEach(() => {
    state.categories = [
      { id: 'c1', nome: 'Mercado', tipo: 'DESPESA', contexto: 'PESSOAL', cor: '#00aa00', icone: 'shopping-cart' },
    ]
    state.transactions = [
      { id: 't1', category_id: 'c1', tipo: 'DESPESA', data: '2026-11-10', valor_centavos: 120_00 },
    ]
    state.budgets = []
  })

  it('mostra estado vazio quando há gasto mas nenhum limite', () => {
    render(<Budgets />)
    expect(screen.getByText('Sem orçamentos definidos')).toBeInTheDocument()
    expect(screen.getByText('Toque em Definir limite para criar o primeiro.')).toBeInTheDocument()
    expect(screen.queryByText('Mercado')).toBeNull()
    // botão do cabeçalho + botão visível no estado vazio
    expect(screen.getAllByRole('button', { name: 'Definir limite' }).length).toBeGreaterThanOrEqual(2)
  })

  it('lista a categoria quando há limite no mês', () => {
    state.budgets = [
      { id: 'b1', category_id: 'c1', mes_referencia: '2026-11', limite_centavos: 500_00, contexto: 'PESSOAL' },
    ]
    render(<Budgets />)
    expect(screen.getByText('Mercado')).toBeInTheDocument()
    expect(screen.queryByText('Sem orçamentos definidos')).toBeNull()
  })
})
