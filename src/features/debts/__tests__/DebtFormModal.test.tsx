import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DebtFormModal } from '../DebtFormModal'
import type { Debt } from '@/domain/types'

const { addDebt, updateDebt, regenerateUnpaid } = vi.hoisted(() => ({
  addDebt: vi.fn(), updateDebt: vi.fn(), regenerateUnpaid: vi.fn(),
}))
vi.mock('@/store/debts', () => ({
  useDebts: () => ({ addDebt, updateDebt, regenerateUnpaid, installments: [] }),
}))
vi.mock('@/store/ui', () => ({ useUI: (sel: (s: { viewMode: string }) => unknown) => sel({ viewMode: 'PESSOAL' }) }))

const salvar = () => screen.getByRole('button', { name: 'Salvar' })
const nome = () => screen.getByLabelText(/Nome/)
const original = () => screen.getByLabelText(/Valor original/)

beforeEach(() => {
  addDebt.mockReset().mockResolvedValue({})
  updateDebt.mockReset().mockResolvedValue(undefined)
  regenerateUnpaid.mockReset().mockResolvedValue(undefined)
})

describe('DebtFormModal', () => {
  it('Salvar só habilita com Nome e Valor original, e explica o motivo', () => {
    render(<DebtFormModal onClose={() => {}} />)
    expect(salvar()).toBeDisabled()
    expect(screen.getByText('Preencha Nome e Valor original para salvar.')).toBeInTheDocument()
    fireEvent.change(nome(), { target: { value: 'Nubank' } })
    expect(salvar()).toBeDisabled()
    fireEvent.change(original(), { target: { value: '500,00' } })
    expect(salvar()).toBeEnabled()
    expect(screen.queryByText('Preencha Nome e Valor original para salvar.')).toBeNull()
    fireEvent.change(nome(), { target: { value: '  ' } })
    expect(salvar()).toBeDisabled()
  })

  it('cria sem vencimento: sem parcelas e acordo nulo', async () => {
    render(<DebtFormModal onClose={() => {}} />)
    fireEvent.change(nome(), { target: { value: 'Nubank' } })
    fireEvent.change(original(), { target: { value: '500,00' } })
    fireEvent.click(salvar())
    await waitFor(() => expect(addDebt).toHaveBeenCalledTimes(1))
    const arg = addDebt.mock.calls[0][0]
    expect(arg).toMatchObject({ credor: 'Nubank', valor_original_centavos: 50000, valor_acordo_centavos: null })
    expect(arg).not.toHaveProperty('parcelas')
    expect(arg).not.toHaveProperty('primeiro_vencimento')
  })

  it('avisa quando há mais de 1 parcela sem primeiro vencimento', () => {
    render(<DebtFormModal onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Parcelas'), { target: { value: '3' } })
    expect(screen.getByText('Informe o primeiro vencimento para gerar as parcelas.')).toBeInTheDocument()
  })

  it('edição sem parcelas: "Gerar parcelas" chama regenerateUnpaid', async () => {
    const debt = { id: 'd1', credor: 'Serasa', origem: 'Outro', contexto: 'PESSOAL', valor_original_centavos: 50000, valor_acordo_centavos: null, descricao: null, observacoes: null, data_acordo: null } as Debt
    render(<DebtFormModal debt={debt} onClose={() => {}} />)
    expect(screen.getByText('Gerar parcelas')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Parcelas'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Primeiro vencimento'), { target: { value: '2026-12-10' } })
    fireEvent.click(salvar())
    await waitFor(() => expect(regenerateUnpaid).toHaveBeenCalledWith('d1', 4, '2026-12-10'))
    expect(updateDebt).toHaveBeenCalledTimes(1)
  })
})
