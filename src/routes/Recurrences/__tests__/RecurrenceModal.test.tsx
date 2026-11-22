import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/store/data', () => {
  const state = {
    accounts: [{ id: 'acc-1', nome: 'Conta Corrente', contexto: 'PESSOAL', arquivada: false }],
    cards: [{ id: 'card-1', nome: 'Nubank', contexto: 'PESSOAL', arquivado: false, tipo: 'credito' }],
    categories: [
      { id: 'cat-d', nome: 'Assinaturas', contexto: 'PESSOAL', tipo: 'DESPESA', chave: null },
      { id: 'cat-r', nome: 'Salário', contexto: 'PESSOAL', tipo: 'RECEITA', chave: null },
    ],
    addRecurrence: vi.fn(),
    updateRecurrence: vi.fn(),
    deleteRecurrence: vi.fn(),
  }
  return { useData: () => state }
})
vi.mock('@/store/ui', () => ({ useUI: () => ({ viewMode: 'PESSOAL' }) }))
vi.mock('@/store/workspace', () => ({ useCanWrite: () => true }))

import { RecurrenceModal } from '../Recurrences'
import type { Recurrence } from '@/domain/types'

const rec = {
  id: 'r1',
  contexto: 'PESSOAL',
  frequencia: 'mensal',
  dia: 10,
  proxima_data: '2026-12-10',
  ativo: true,
  template: {
    tipo: 'DESPESA',
    account_id: null,
    card_id: 'card-1',
    category_id: 'cat-d',
    valor_centavos: 3990,
    descricao: 'Netflix',
    pago: true,
  },
} as unknown as Recurrence

describe('RecurrenceModal', () => {
  it('edição abre preenchida e Nova reabre vazia', () => {
    const { rerender } = render(<RecurrenceModal open recurrence={rec} onClose={vi.fn()} />)
    expect(screen.getByLabelText(/Descrição/)).toHaveValue('Netflix')
    expect((screen.getByLabelText(/Valor/) as HTMLInputElement).value).toMatch(/^R\$\s39,90$/)
    expect(screen.getByText('Nubank')).toBeInTheDocument()

    rerender(<RecurrenceModal open={false} recurrence={undefined} onClose={vi.fn()} />)
    rerender(<RecurrenceModal open recurrence={undefined} onClose={vi.fn()} />)
    expect(screen.getByLabelText(/Descrição/)).toHaveValue('')
    expect((screen.getByLabelText(/Valor/) as HTMLInputElement).value).not.toMatch(/39,90/)
  })
})
