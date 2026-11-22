import { describe, expect, it } from 'vitest'
import type { Account, Card, Invoice, Transaction } from '@/domain/types'
import { accountBalance, forecastBalance, forecastHorizon } from '@/engine'

let seq = 0
const id = (p: string) => `${p}-${++seq}`

function acc(o: Partial<Account> = {}): Account {
  return {
    id: id('acc'), user_id: 'u', workspace_id: 'ws', nome: 'Conta', contexto: 'PESSOAL',
    tipo: 'conta_corrente', saldo_inicial_centavos: 0, instituicao: null, banco: null,
    cor: '#000', arquivada: false, created_at: '', updated_at: '', ...o,
  }
}
function tx(o: Partial<Transaction> = {}): Transaction {
  return {
    id: id('tx'), user_id: 'u', workspace_id: 'ws', contexto: 'PESSOAL', tipo: 'DESPESA',
    account_id: null, card_id: null, invoice_id: null, category_id: 'c', valor_centavos: 0,
    data: '2026-11-10', descricao: '', pago: true, data_vencimento: null, parcela_n: null,
    parcela_total: null, parcela_group_id: null, transfer_id: null, transfer_kind: null,
    recorrencia_id: null, rateio_id: null, centro_de_custo: null, tags: [], anexo: null,
    created_at: '', updated_at: '', ...o,
  }
}
function card(o: Partial<Card> = {}): Card {
  return {
    id: id('card'), user_id: 'u', workspace_id: 'ws', nome: 'Cartão', contexto: 'PESSOAL',
    bandeira: null, banco: null, tipo: 'credito', limite_centavos: 1_000_00, dia_fechamento: 20,
    dia_vencimento: 28, account_pagamento_id: null, cor: '#000', arquivado: false,
    created_at: '', updated_at: '', ...o,
  }
}
function inv(o: Partial<Invoice> = {}): Invoice {
  return {
    id: id('inv'), user_id: 'u', workspace_id: 'ws', card_id: 'x', mes_referencia: '2026-11',
    data_fechamento: '2026-11-20', data_vencimento: '2026-11-28', paga: false,
    paid_account_id: null, created_at: '', updated_at: '', ...o,
  }
}

const hoje = '2026-11-22'

function base() {
  const conta = acc({ saldo_inicial_centavos: 1000_00 })
  const cartao = card()
  const fA = inv({ card_id: cartao.id, data_vencimento: '2026-11-28' })
  const fB = inv({ card_id: cartao.id, data_vencimento: '2026-12-10' })
  const txs = [
    tx({ tipo: 'RECEITA', valor_centavos: 500_00, account_id: conta.id, pago: true, data: '2026-11-10' }),
    tx({ tipo: 'RECEITA', valor_centavos: 300_00, account_id: conta.id, pago: false, data: '2026-11-28' }),
    tx({ tipo: 'RECEITA', valor_centavos: 200_00, account_id: conta.id, pago: true, data: '2026-11-25' }),
    tx({ tipo: 'DESPESA', valor_centavos: 100_00, account_id: conta.id, pago: false, data: '2026-11-05' }),
    tx({ tipo: 'RECEITA', valor_centavos: 999_00, account_id: conta.id, pago: false, data: '2026-12-05' }),
    tx({ tipo: 'DESPESA', valor_centavos: 150_00, card_id: cartao.id, invoice_id: fA.id, pago: false, data: '2026-11-15' }),
    tx({ tipo: 'DESPESA', valor_centavos: 80_00, card_id: cartao.id, invoice_id: fB.id, pago: false, data: '2026-11-25' }),
  ]
  return { conta, cards: [cartao], invoices: [fA, fB], txs }
}

describe('saldo realizado x previsto', () => {
  it('saldo real ignora pago com data futura', () => {
    const { conta, cards, invoices, txs } = base()
    expect(accountBalance(conta, txs, { cards, invoices, asOf: hoje })).toBe(1500_00)
    expect(accountBalance(conta, txs, { cards, invoices })).toBe(1700_00)
  })

  it('previsto até o fim do mês', () => {
    const { conta, cards, invoices, txs } = base()
    const inp = { accounts: [conta], cards, invoices, transactions: txs }
    expect(forecastHorizon('2026-11', hoje)).toBe('2026-11-30')
    expect(forecastBalance('PESSOAL', inp, '2026-11', hoje)).toBe(1750_00)
  })

  it('mês passado usa hoje como horizonte', () => {
    const { conta, cards, invoices, txs } = base()
    const inp = { accounts: [conta], cards, invoices, transactions: txs }
    expect(forecastHorizon('2026-09', hoje)).toBe('2026-11-22')
    expect(forecastBalance('PESSOAL', inp, '2026-09', hoje)).toBe(1400_00)
  })

  it('pró-labore pendente move PJ e pessoal e se anula no consolidado', () => {
    const { conta, cards, invoices, txs } = base()
    const pj = acc({ contexto: 'EMPRESARIAL', saldo_inicial_centavos: 2000_00 })
    const t = [
      ...txs,
      tx({ contexto: 'EMPRESARIAL', tipo: 'DESPESA', valor_centavos: 300_00, account_id: pj.id, transfer_id: 'x', pago: false, data: '2026-11-25' }),
      tx({ contexto: 'PESSOAL', tipo: 'RECEITA', valor_centavos: 300_00, account_id: conta.id, transfer_id: 'x', pago: false, data: '2026-11-25' }),
    ]
    const inp2 = { accounts: [conta, pj], cards, invoices, transactions: t }
    expect(forecastBalance('EMPRESARIAL', inp2, '2026-11', hoje)).toBe(1700_00)
    expect(forecastBalance('CONSOLIDADO', inp2, '2026-11', hoje)).toBe(
      forecastBalance('PESSOAL', inp2, '2026-11', hoje) +
        forecastBalance('EMPRESARIAL', inp2, '2026-11', hoje),
    )
  })

  it('conta arquivada fica fora', () => {
    const { conta, cards, invoices, txs } = base()
    const arq = acc({ saldo_inicial_centavos: 70_00, arquivada: true })
    const t = [...txs, tx({ tipo: 'RECEITA', valor_centavos: 50_00, account_id: arq.id, pago: false, data: '2026-11-25' })]
    const inp = { accounts: [conta, arq], cards, invoices, transactions: t }
    expect(forecastBalance('PESSOAL', inp, '2026-11', hoje)).toBe(1750_00)
  })
})
