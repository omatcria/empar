import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({
  addTransaction: vi.fn(),
  addCardPurchase: vi.fn(),
  addRecurrence: vi.fn(),
  deleteRecurrence: vi.fn(),
  updateTransaction: vi.fn(),
  updateTransactionGroup: vi.fn(),
}))

vi.mock('@/store/data', () => {
  const state = {
    accounts: [{ id: 'acc-1', nome: 'Conta', contexto: 'PESSOAL', arquivada: false }],
    cards: [{ id: 'card-1', nome: 'Cartão', contexto: 'PESSOAL', arquivado: false, tipo: 'credito' }],
    categories: [
      { id: 'cat-d', nome: 'Mercado', contexto: 'PESSOAL', tipo: 'DESPESA', chave: null, categoria_pai_id: null, cor: '#000', icone: 'tag', sistema: false },
      { id: 'cat-r', nome: 'Salário', contexto: 'PESSOAL', tipo: 'RECEITA', chave: null, categoria_pai_id: null, cor: '#000', icone: 'tag', sistema: false },
    ],
    transactions: [],
    ...h,
  }
  return { useData: () => state }
})
vi.mock('@/store/ui', () => ({ useUI: () => ({ viewMode: 'PESSOAL' }) }))
vi.mock('@/features/mei/MeiImpactAlert', () => ({ MeiImpactAlert: () => null }))

import { TransactionModal } from '../TransactionModal'

function setData(v: string) {
  fireEvent.change(screen.getByLabelText('Data'), { target: { value: v } })
}

describe('TransactionModal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-22T12:00:00'))
    Object.values(h).forEach((f) => f.mockReset())
    h.addRecurrence.mockResolvedValue({ id: 'rec-1' })
    h.addTransaction.mockResolvedValue({})
    h.addCardPurchase.mockResolvedValue([])
  })
  afterEach(() => vi.useRealTimers())

  it('data futura vem pendente, data de hoje volta para pago', () => {
    render(<TransactionModal open onClose={vi.fn()} />)
    setData('2026-12-05')
    expect(screen.getByRole('button', { name: 'A pagar', pressed: true })).toBeInTheDocument()
    setData('2026-11-22')
    expect(screen.getByRole('button', { name: 'Pago', pressed: true })).toBeInTheDocument()
  })

  it('receita mostra Recebido / A receber', () => {
    render(<TransactionModal open onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Receita' }))
    expect(screen.getByRole('button', { name: 'Recebido' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'A receber' })).toBeInTheDocument()
  })

  it('situação mexida à mão não é sobrescrita pela data', () => {
    render(<TransactionModal open onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'A pagar' }))
    setData('2026-12-05')
    setData('2026-11-20')
    expect(screen.getByRole('button', { name: 'A pagar', pressed: true })).toBeInTheDocument()
  })

  it('Repetir no cartão cria a recorrência e lança com recorrencia_id', async () => {
    render(<TransactionModal open onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cartão de crédito' }))
    fireEvent.change(screen.getByPlaceholderText('R$ 0,00'), { target: { value: '50,00' } })
    fireEvent.click(screen.getByRole('switch', { name: 'Repetir' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(h.addCardPurchase).toHaveBeenCalled())
    expect(h.addRecurrence).toHaveBeenCalledWith(
      expect.objectContaining({
        frequencia: 'mensal',
        dia: 22,
        proxima_data: '2026-12-22',
        template: expect.objectContaining({ card_id: 'card-1' }),
      }),
    )
    expect(h.addCardPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ recorrencia_id: 'rec-1', parcelas: 1 }),
    )
  })

  it('falha no lançamento apaga a recorrência e mostra o erro', async () => {
    h.addCardPurchase.mockRejectedValue(new Error('Falhou geral'))
    render(<TransactionModal open onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cartão de crédito' }))
    fireEvent.change(screen.getByPlaceholderText('R$ 0,00'), { target: { value: '50,00' } })
    fireEvent.click(screen.getByRole('switch', { name: 'Repetir' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(h.deleteRecurrence).toHaveBeenCalledWith('rec-1'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Falhou geral')
  })

  it('parcelado esconde o Repetir', () => {
    render(<TransactionModal open onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cartão de crédito' }))
    expect(screen.getByRole('switch', { name: 'Repetir' })).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Parcelas'))
    fireEvent.click(screen.getByRole('option', { name: '3x' }))
    expect(screen.queryByRole('switch', { name: 'Repetir' })).toBeNull()
  })
})
