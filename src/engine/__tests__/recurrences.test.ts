import { describe, expect, it } from 'vitest'
import type { Account, Card } from '@/domain/types'
import { resolveInvoiceCycle } from '@/engine/invoices'
import {
  buildRecurrenceFromLaunch,
  buildRecurrenceTx,
  dueOccurrences,
  resolveRecurrenceTarget,
  type LaunchRecurrenceParams,
  type RecurrenceTemplate,
} from '../recurrences'

const tpl: RecurrenceTemplate = {
  tipo: 'DESPESA',
  category_id: 'cat1',
  valor_centavos: 5000,
  descricao: 'Netflix',
}

function card(over: Partial<Card> = {}): Card {
  return {
    id: 'c1',
    nome: 'Cartão',
    tipo: 'credito',
    arquivado: false,
    contexto: 'PESSOAL',
    dia_fechamento: 10,
    dia_vencimento: 17,
    ...over,
  } as Card
}
const conta = { id: 'a1', nome: 'Conta', arquivada: false } as Account
const c = card()

const launch: LaunchRecurrenceParams = {
  contexto: 'PESSOAL',
  tipo: 'DESPESA',
  data: '2026-09-10',
  frequencia: 'mensal',
  categoryId: 'cat1',
  valor: 5000,
  descricao: 'Netflix',
  pago: true,
}

describe('resolveRecurrenceTarget', () => {
  it('resolve cartão, conta e rejeita alvos inválidos', () => {
    expect(resolveRecurrenceTarget({ ...tpl, card_id: 'c1' }, [], [card({ id: 'c1' })])).toMatchObject({ kind: 'cartao' })
    expect(resolveRecurrenceTarget({ ...tpl, card_id: 'c1' }, [], [card({ id: 'c1', arquivado: true })])).toBeNull()
    expect(resolveRecurrenceTarget({ ...tpl, card_id: 'c1' }, [], [card({ id: 'c1', tipo: 'debito' })])).toBeNull()
    expect(resolveRecurrenceTarget({ ...tpl, card_id: 'sumiu' }, [conta], [])).toBeNull()
    expect(resolveRecurrenceTarget({ ...tpl, account_id: conta.id }, [conta], [])).toEqual({ kind: 'conta', accountId: conta.id })
    expect(resolveRecurrenceTarget({ ...tpl, account_id: 'apagada' }, [conta], [])).toBeNull()
    expect(resolveRecurrenceTarget({ ...tpl, category_id: '', account_id: conta.id }, [conta], [])).toBeNull()
    expect(resolveRecurrenceTarget(tpl, [conta], [])).toBeNull()
  })
})

describe('buildRecurrenceTx', () => {
  it('monta insert de cartão e de conta', () => {
    const tx = buildRecurrenceTx(tpl, { kind: 'cartao', card: c }, 'PESSOAL', '2026-12-05', 'r1')
    expect(tx).toMatchObject({ card_id: c.id, pago: true, recorrencia_id: 'r1', data: '2026-12-05' })
    expect(tx).not.toHaveProperty('account_id')
    expect(
      buildRecurrenceTx({ ...tpl, pago: false }, { kind: 'conta', accountId: 'a1' }, 'PESSOAL', '2026-12-05', 'r1'),
    ).toMatchObject({ account_id: 'a1', pago: false })
  })
})

describe('buildRecurrenceFromLaunch', () => {
  it('calcula dia e próxima data', () => {
    expect(buildRecurrenceFromLaunch({ ...launch, data: '2026-09-10', frequencia: 'mensal', accountId: 'a1' }))
      .toMatchObject({ dia: 10, proxima_data: '2026-10-10', template: { account_id: 'a1', card_id: null } })
    expect(buildRecurrenceFromLaunch({ ...launch, data: '2026-01-31', frequencia: 'mensal', cardId: 'c1' }))
      .toMatchObject({ dia: 31, proxima_data: '2026-02-28', template: { card_id: 'c1', account_id: null, pago: true } })
    expect(buildRecurrenceFromLaunch({ ...launch, data: '2026-11-22', frequencia: 'semanal', accountId: 'a1' }).proxima_data).toBe('2026-11-29')
  })
})

describe('ciclo de fatura das ocorrências', () => {
  it('fim de mês cai na fatura de cada mês', () => {
    const { dates } = dueOccurrences('2026-01-31', 'mensal', 31, '2026-03-31')
    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
    expect(dates.map((d) => resolveInvoiceCycle(31, 10, d).mesReferencia)).toEqual(['2026-01', '2026-02', '2026-03'])
  })
})
