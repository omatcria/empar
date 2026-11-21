import { describe, it, expect } from 'vitest'
import { buildDebtInstallments, debtSummary, debtsTotals } from '../debts'
import type { Debt, DebtInstallment } from '@/domain/types'

const debt = (o: Partial<Debt> = {}): Debt =>
  ({
    id: 'd1', workspace_id: 'w', user_id: 'u', contexto: 'pessoal', credor: 'Banco',
    origem: 'Serasa Limpa Nome', descricao: null, valor_original_centavos: null,
    valor_acordo_centavos: 100000, data_acordo: null, observacoes: null,
    created_at: '', updated_at: '', ...o,
  }) as Debt

const inst = (n: number, valor: number, venc: string, pago = false): DebtInstallment =>
  ({
    id: `i${n}`, workspace_id: 'w', user_id: 'u', debt_id: 'd1', numero: n,
    valor_centavos: valor, vencimento: venc, pago, pago_em: pago ? venc : null,
  }) as DebtInstallment

describe('buildDebtInstallments', () => {
  it('divide com resto nas primeiras e avança mês a mês', () => {
    const r = buildDebtInstallments(100000, 3, '2026-12-10')
    expect(r.map((p) => p.valor_centavos)).toEqual([33334, 33333, 33333])
    expect(r.map((p) => p.vencimento)).toEqual(['2026-12-10', '2027-01-10', '2027-02-10'])
    expect(r.map((p) => p.numero)).toEqual([1, 2, 3])
  })
  it('dia 31 usa o dia original limitado ao fim do mês', () => {
    const r = buildDebtInstallments(30000, 3, '2026-01-31')
    expect(r.map((p) => p.vencimento)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })
})

describe('debtSummary', () => {
  const ps = [
    inst(1, 33334, '2026-09-10', true),
    inst(2, 33333, '2026-10-10'),
    inst(3, 33333, '2026-12-10'),
  ]
  it('atrasada quando há parcela vencida não paga', () => {
    const s = debtSummary(debt(), ps, '2026-11-21')
    expect(s.status).toBe('atrasada')
    expect(s.pagas).toBe(1)
    expect(s.totalParcelas).toBe(3)
    expect(s.pago).toBe(33334)
    expect(s.total).toBe(100000)
    expect(s.restante).toBe(66666)
    expect(s.atrasadas).toBe(1)
    expect(s.proxima?.numero).toBe(2)
  })
  it('em_dia sem vencidas', () => {
    expect(debtSummary(debt(), ps, '2026-10-10').status).toBe('em_dia')
  })
  it('quitada quando tudo pago', () => {
    const s = debtSummary(debt(), ps.map((p) => ({ ...p, pago: true })), '2026-11-21')
    expect(s.status).toBe('quitada')
    expect(s.proxima).toBeNull()
    expect(s.restante).toBe(0)
  })
})

describe('debtsTotals', () => {
  it('soma acordos, pago, restante e economia ignorando original nulo', () => {
    const d1 = debt({ id: 'd1', valor_original_centavos: 150000, valor_acordo_centavos: 100000 })
    const d2 = debt({ id: 'd2', valor_original_centavos: null, valor_acordo_centavos: 50000 })
    const ps = [
      inst(1, 100000, '2026-12-10', true),
      { ...inst(1, 50000, '2026-12-10'), id: 'x', debt_id: 'd2' } as DebtInstallment,
    ]
    const t = debtsTotals([d1, d2], ps)
    expect(t).toEqual({ totalAcordos: 150000, pago: 100000, restante: 50000, economia: 50000 })
  })
})
