import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DebtCard } from '../DebtCard'
import type { Debt, DebtInstallment } from '@/domain/types'

const debt = { id: 'd', credor: 'Credor teste', origem: 'Outro', contexto: 'PESSOAL', valor_acordo_centavos: 90000 } as Debt
const installments = [1, 2, 3].map((numero) => ({ id: String(numero), debt_id: 'd', numero, valor_centavos: 30000, vencimento: '2026-12-10', pago: numero === 1, pago_em: null })) as DebtInstallment[]
vi.mock('@/store/debts', () => ({ useDebts: () => ({ setInstallmentPaid: vi.fn(), payAll: vi.fn(), deleteDebt: vi.fn() }) }))

describe('DebtCard', () => {
  it('mostra o progresso e permite abrir as parcelas', () => {
    render(<DebtCard debt={debt} installments={installments} canWrite={false} onEdit={() => {}} />)
    expect(screen.getByText(/1\/3/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /parcelas/i }))
    expect(screen.getByText('Parcela 2')).toBeInTheDocument()
    expect(screen.queryByText('Marcar paga')).toBeNull()
  })
})
