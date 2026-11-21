import { describe, it, expect } from 'vitest'
import { meiStatus } from '@/engine/mei'
import type {
  Account,
  Budget,
  Card,
  Category,
  Invoice,
  TaxProvision,
  Transaction,
} from '@/domain/types'
import {
  toCents,
  formatBRL,
  parseBRLToCents,
} from '@/lib/money'
import {
  accountBalance,
  contextBalance,
  contextIncome,
  contextExpense,
  consolidatedIncome,
  consolidatedExpense,
  buildProLabore,
  resolveInvoiceCycle,
  buildInstallmentPlan,
  splitCents,
  invoiceTotal,
  provisionContributions,
  totalProvisionContribution,
  totalProvisionado,
  provisaoDevida,
  provisionadoAtual,
  advanceDate,
  dueOccurrences,
  buildDashboard,
  computeNotifications,
  annualRatePct,
  investedPrincipal,
  investmentValue,
  investmentReturn,
} from '@/engine'

/* ---------------- Fábricas de fixtures ---------------- */
const U = 'user-1'
let seq = 0
const id = (p: string) => `${p}-${++seq}`

function acc(o: Partial<Account> = {}): Account {
  return {
    id: id('acc'),
    user_id: U,
    workspace_id: 'ws-1',
    nome: 'Conta',
    contexto: 'PESSOAL',
    tipo: 'conta_corrente',
    saldo_inicial_centavos: 0,
    instituicao: null,
    banco: null,
    cor: '#000',
    arquivada: false,
    created_at: '',
    updated_at: '',
    ...o,
  }
}

function tx(o: Partial<Transaction> = {}): Transaction {
  return {
    id: id('tx'),
    user_id: U,
    workspace_id: 'ws-1',
    contexto: 'PESSOAL',
    tipo: 'DESPESA',
    account_id: null,
    card_id: null,
    invoice_id: null,
    category_id: 'cat-x',
    valor_centavos: 0,
    data: '2026-07-10',
    descricao: '',
    pago: true,
    data_vencimento: null,
    parcela_n: null,
    parcela_total: null,
    parcela_group_id: null,
    transfer_id: null,
    transfer_kind: null,
    recorrencia_id: null,
    rateio_id: null,
    centro_de_custo: null,
    tags: [],
    anexo: null,
    created_at: '',
    updated_at: '',
    ...o,
  }
}

function card(o: Partial<Card> = {}): Card {
  return {
    id: id('card'),
    user_id: U,
    workspace_id: 'ws-1',
    nome: 'Cartão',
    contexto: 'PESSOAL',
    bandeira: null,
    banco: null,
    tipo: 'credito',
    limite_centavos: 1_000_00,
    dia_fechamento: 20,
    dia_vencimento: 28,
    account_pagamento_id: null,
    cor: '#000',
    arquivado: false,
    created_at: '',
    updated_at: '',
    ...o,
  }
}

function invoice(o: Partial<Invoice> = {}): Invoice {
  return {
    id: id('inv'),
    user_id: U,
    workspace_id: 'ws-1',
    card_id: 'card-x',
    mes_referencia: '2026-07',
    data_fechamento: '2026-07-20',
    data_vencimento: '2026-07-28',
    paga: false,
    paid_account_id: null,
    created_at: '',
    updated_at: '',
    ...o,
  }
}

function cat(o: Partial<Category> = {}): Category {
  return {
    id: id('cat'),
    user_id: U,
    workspace_id: 'ws-1',
    nome: 'Cat',
    contexto: 'PESSOAL',
    tipo: 'DESPESA',
    categoria_pai_id: null,
    icone: 'tag',
    cor: '#000',
    sistema: false,
    chave: null,
    created_at: '',
    updated_at: '',
    ...o,
  }
}

function prov(o: Partial<TaxProvision> = {}): TaxProvision {
  return {
    id: id('prov'),
    user_id: U,
    workspace_id: 'ws-1',
    nome: 'DAS',
    percentual: 6,
    saldo_provisionado_centavos: 0,
    ativo: true,
    created_at: '',
    updated_at: '',
    ...o,
  }
}

/* ---------------- money ---------------- */
describe('money', () => {
  it('converte reais->centavos sem erro de float', () => {
    expect(toCents(12.34)).toBe(1234)
    expect(toCents(0.1 + 0.2)).toBe(30)
  })
  it('formata em BRL pt-BR', () => {
    expect(formatBRL(1234567)).toBe('R$ 12.345,67')
  })
  it('parseia string pt-BR', () => {
    expect(parseBRLToCents('R$ 1.234,56')).toBe(123456)
    expect(parseBRLToCents('1234,5')).toBe(123450)
  })
})

/* ---------------- saldo ---------------- */
describe('saldo de conta', () => {
  it('saldo_inicial + transações pagas, ignorando pendentes', () => {
    const a = acc({ saldo_inicial_centavos: 100_00 })
    const txs = [
      tx({ account_id: a.id, tipo: 'RECEITA', valor_centavos: 50_00, pago: true }),
      tx({ account_id: a.id, tipo: 'DESPESA', valor_centavos: 30_00, pago: true }),
      tx({ account_id: a.id, tipo: 'DESPESA', valor_centavos: 999_00, pago: false }),
    ]
    expect(accountBalance(a, txs)).toBe(120_00)
  })

  it('subtrai o total de faturas PAGAS do cartão que debita na conta', () => {
    const a = acc({ saldo_inicial_centavos: 200_00 })
    const c = card({ account_pagamento_id: a.id })
    const inv = invoice({ card_id: c.id, paga: true })
    const txs = [
      // compras no crédito: não afetam a conta diretamente
      tx({ card_id: c.id, invoice_id: inv.id, valor_centavos: 40_00, contexto: 'PESSOAL' }),
      tx({ card_id: c.id, invoice_id: inv.id, valor_centavos: 10_00, contexto: 'PESSOAL' }),
    ]
    // sem contexto de cartão: fatura ignorada -> saldo cheio
    expect(accountBalance(a, txs)).toBe(200_00)
    // com fatura paga: desconta 50,00
    expect(accountBalance(a, txs, { cards: [c], invoices: [inv] })).toBe(150_00)
  })

  it('fatura paga por OUTRA conta (paid_account_id) desconta da conta escolhida', () => {
    const padrao = acc({ saldo_inicial_centavos: 200_00 }) // conta padrão do cartão
    const outra = acc({ saldo_inicial_centavos: 300_00 }) // conta escolhida ao pagar
    const c = card({ account_pagamento_id: padrao.id })
    const inv = invoice({ card_id: c.id, paga: true, paid_account_id: outra.id })
    const txs = [tx({ card_id: c.id, invoice_id: inv.id, valor_centavos: 50_00, account_id: null })]
    const ctx = { cards: [c], invoices: [inv] }
    // desconta da conta ESCOLHIDA, não da padrão
    expect(accountBalance(padrao, txs, ctx)).toBe(200_00)
    expect(accountBalance(outra, txs, ctx)).toBe(250_00)
  })

  it('contextBalance ignora contas arquivadas e de outro contexto', () => {
    const p = acc({ contexto: 'PESSOAL', saldo_inicial_centavos: 100_00 })
    const e = acc({ contexto: 'EMPRESARIAL', saldo_inicial_centavos: 500_00 })
    const arq = acc({ contexto: 'PESSOAL', saldo_inicial_centavos: 999_00, arquivada: true })
    const all = [p, e, arq]
    expect(contextBalance('PESSOAL', all, [])).toBe(100_00)
    expect(contextBalance('EMPRESARIAL', all, [])).toBe(500_00)
  })
})

/* ---------------- consolidado x transferências ---------------- */
describe('consolidação exclui transferências (pró-labore)', () => {
  const salario = tx({ contexto: 'PESSOAL', tipo: 'RECEITA', valor_centavos: 300_00 })
  const receitaPJ = tx({ contexto: 'EMPRESARIAL', tipo: 'RECEITA', valor_centavos: 800_00 })
  const plSaida = tx({ contexto: 'EMPRESARIAL', tipo: 'DESPESA', valor_centavos: 500_00, transfer_id: 't1', transfer_kind: 'PRO_LABORE' })
  const plEntrada = tx({ contexto: 'PESSOAL', tipo: 'RECEITA', valor_centavos: 500_00, transfer_id: 't1', transfer_kind: 'PRO_LABORE' })
  const txs = [salario, receitaPJ, plSaida, plEntrada]

  it('por contexto INCLUI o pró-labore', () => {
    // pessoal: salário 300 + pró-labore 500 = 800
    expect(contextIncome('PESSOAL', txs, '2026-07')).toBe(800_00)
    // empresarial despesa: pró-labore 500
    expect(contextExpense('EMPRESARIAL', txs, '2026-07')).toBe(500_00)
  })

  it('consolidado EXCLUI as pernas de transferência', () => {
    // receita real: salário 300 + receita PJ 800 = 1100 (sem pró-labore)
    expect(consolidatedIncome(txs, '2026-07')).toBe(1100_00)
    // despesa real: nenhuma (o pró-labore é transferência)
    expect(consolidatedExpense(txs, '2026-07')).toBe(0)
  })
})

/* ---------------- pró-labore (a ponte) ---------------- */
describe('buildProLabore', () => {
  const cats = [
    cat({ contexto: 'EMPRESARIAL', tipo: 'DESPESA', sistema: true, chave: 'PRO_LABORE_SAIDA' }),
    cat({ contexto: 'PESSOAL', tipo: 'RECEITA', sistema: true, chave: 'PRO_LABORE_ENTRADA' }),
  ]
  it('gera par ligado por transfer_id com contextos corretos', () => {
    const [saida, entrada] = buildProLabore({
      userId: U,
      valorCentavos: 500_00,
      data: '2026-07-05',
      accountEmpresarialId: 'acc-pj',
      accountPessoalId: 'acc-pessoal',
      categories: cats,
    })
    expect(saida.transfer_id).toBe(entrada.transfer_id)
    expect(saida.transfer_kind).toBe('PRO_LABORE')
    expect(saida.contexto).toBe('EMPRESARIAL')
    expect(saida.tipo).toBe('DESPESA')
    expect(entrada.contexto).toBe('PESSOAL')
    expect(entrada.tipo).toBe('RECEITA')
    expect(saida.valor_centavos).toBe(500_00)
    expect(entrada.valor_centavos).toBe(500_00)
  })
  it('falha se faltar categoria de sistema', () => {
    expect(() =>
      buildProLabore({
        userId: U,
        valorCentavos: 1,
        data: '2026-07-05',
        accountEmpresarialId: 'a',
        accountPessoalId: 'b',
        categories: [],
      }),
    ).toThrow()
  })
})

/* ---------------- faturas e parcelas ---------------- */
describe('ciclo de fatura', () => {
  it('compra antes/no fechamento entra na fatura do mês', () => {
    const c = resolveInvoiceCycle(20, 28, '2026-07-15')
    expect(c.mesReferencia).toBe('2026-07')
    expect(c.dataVencimento).toBe('2026-07-28')
  })
  it('compra depois do fechamento entra na fatura do mês seguinte', () => {
    const c = resolveInvoiceCycle(20, 28, '2026-07-25')
    expect(c.mesReferencia).toBe('2026-08')
  })
  it('vencimento rola para o mês seguinte quando dia_venc <= dia_fech', () => {
    const c = resolveInvoiceCycle(20, 5, '2026-07-10')
    expect(c.mesReferencia).toBe('2026-07')
    expect(c.dataVencimento).toBe('2026-08-05')
  })
})

describe('parcelas', () => {
  it('splitCents soma exatamente o total', () => {
    expect(splitCents(1000, 3)).toEqual([334, 333, 333])
    expect(splitCents(1000, 3).reduce((a, b) => a + b, 0)).toBe(1000)
  })
  it('buildInstallmentPlan distribui em N faturas consecutivas', () => {
    const plan = buildInstallmentPlan(20, 28, '2026-07-10', 1200_00, 12)
    expect(plan).toHaveLength(12)
    expect(plan.reduce((s, p) => s + p.valorCentavos, 0)).toBe(1200_00)
    expect(plan[0].mesReferencia).toBe('2026-07')
    expect(plan[11].mesReferencia).toBe('2027-06')
    expect(plan[0].parcelaN).toBe(1)
    expect(plan[0].parcelaTotal).toBe(12)
  })
  it('cada parcela cai numa fatura de mês DISTINTO (bug: mesma fatura)', () => {
    // Vários cenários de dia de fechamento, inclusive dia 31 (meses curtos)
    for (const [fech, venc, compra] of [
      [20, 28, '2026-07-25'], // compra após o fechamento
      [31, 10, '2026-01-15'], // fechamento no fim do mês
      [1, 10, '2026-03-01'],
    ] as const) {
      const plan = buildInstallmentPlan(fech, venc, compra, 600_00, 6)
      const meses = plan.map((p) => p.mesReferencia)
      expect(new Set(meses).size).toBe(6) // 6 faturas distintas
    }
  })
  it('invoiceTotal soma as transações da fatura', () => {
    const inv = invoice()
    const txs = [
      tx({ invoice_id: inv.id, valor_centavos: 40_00, card_id: 'c', account_id: null }),
      tx({ invoice_id: inv.id, valor_centavos: 60_00, card_id: 'c', account_id: null }),
      tx({ invoice_id: 'outra', valor_centavos: 999_00, card_id: 'c', account_id: null }),
    ]
    expect(invoiceTotal(inv, txs)).toBe(100_00)
  })
})

/* ---------------- impostos ---------------- */
describe('provisão de imposto', () => {
  const provs = [
    prov({ nome: 'DAS', percentual: 6, ativo: true }),
    prov({ nome: 'INSS', percentual: 11, ativo: true }),
    prov({ nome: 'IRPF', percentual: 5, ativo: false }), // inativo não conta
  ]
  it('calcula contribuição por envelope ativo', () => {
    const c = provisionContributions(1000_00, provs)
    expect(c).toHaveLength(2)
    expect(c[0].contributionCentavos).toBe(60_00)
    expect(c[1].contributionCentavos).toBe(110_00)
  })
  it('total a reservar soma os ativos', () => {
    expect(totalProvisionContribution(1000_00, provs)).toBe(170_00)
  })
  it('total provisionado soma saldos dos ativos', () => {
    expect(
      totalProvisionado([
        prov({ saldo_provisionado_centavos: 100_00, ativo: true }),
        prov({ saldo_provisionado_centavos: 999_00, ativo: false }),
      ]),
    ).toBe(100_00)
  })
})

/* ---------------- provisão derivada ---------------- */
describe('provisão de imposto (derivada)', () => {
  const receita = tx({ contexto: 'EMPRESARIAL', tipo: 'RECEITA', valor_centavos: 1000_00 })

  it('devido = receitas PJ × Σ% dos envelopes ativos', () => {
    const provs = [
      prov({ percentual: 6, ativo: true }),
      prov({ percentual: 11, ativo: true }),
      prov({ percentual: 99, ativo: false }),
    ]
    expect(provisaoDevida([receita], provs)).toBe(170_00)
  })

  it('provisionado atual = devido − impostos já pagos', () => {
    const impostoCat = cat({ contexto: 'EMPRESARIAL', tipo: 'DESPESA', sistema: true, chave: 'IMPOSTOS' })
    const pago = tx({ contexto: 'EMPRESARIAL', tipo: 'DESPESA', category_id: impostoCat.id, valor_centavos: 50_00 })
    const provs = [prov({ percentual: 6, ativo: true })] // devido = 60
    expect(provisionadoAtual([receita, pago], provs, new Set([impostoCat.id]))).toBe(10_00)
  })
})

/* ---------------- recorrências ---------------- */
describe('recorrências', () => {
  it('mensal avança um mês, com clamp para meses curtos', () => {
    expect(advanceDate('2026-01-31', 'mensal', 31)).toBe('2026-02-28')
    expect(advanceDate('2026-07-05', 'mensal', 5)).toBe('2026-08-05')
  })
  it('semanal avança 7 dias', () => {
    expect(advanceDate('2026-07-05', 'semanal', 5)).toBe('2026-07-12')
  })
  it('gera as ocorrências atrasadas até hoje e aponta a próxima', () => {
    const r = dueOccurrences('2026-05-05', 'mensal', 5, '2026-07-06')
    expect(r.dates).toEqual(['2026-05-05', '2026-06-05', '2026-07-05'])
    expect(r.novaProxima).toBe('2026-08-05')
  })
  it('não gera nada se a próxima é no futuro', () => {
    const r = dueOccurrences('2026-08-05', 'mensal', 5, '2026-07-06')
    expect(r.dates).toEqual([])
    expect(r.novaProxima).toBe('2026-08-05')
  })
})

/* ---------------- dashboard ---------------- */
describe('buildDashboard', () => {
  it('caixa da empresa = saldo PJ − provisionado − pró-labore pendente', () => {
    const pj = acc({ contexto: 'EMPRESARIAL', saldo_inicial_centavos: 1000_00 })
    const pessoal = acc({ contexto: 'PESSOAL', saldo_inicial_centavos: 200_00 })
    const receitaPJ = tx({ contexto: 'EMPRESARIAL', tipo: 'RECEITA', valor_centavos: 1000_00, account_id: pj.id, pago: true, data: '2026-07-03' })
    const proLabore = tx({ contexto: 'EMPRESARIAL', tipo: 'DESPESA', valor_centavos: 300_00, transfer_kind: 'PRO_LABORE', transfer_id: 't', pago: false, account_id: pj.id, data: '2026-07-05' })
    const provs = [prov({ percentual: 6, ativo: true })] // 6% de 1000 = 60

    const d = buildDashboard({
      accounts: [pj, pessoal],
      cards: [],
      invoices: [],
      transactions: [receitaPJ, proLabore],
      provisions: provs,
      categories: [],
      mes: '2026-07',
    })
    expect(d.saldoEmpresarial).toBe(2000_00) // 1000 inicial + 1000 receita paga
    expect(d.totalProvisionado).toBe(60_00) // derivado das receitas
    expect(d.proLaborePendenteMes).toBe(300_00)
    expect(d.caixaEmpresa).toBe(1640_00) // 2000 - 60 - 300
    expect(d.saldoConsolidado).toBe(2200_00) // 2000 PJ + 200 pessoal
  })
})

/* ---------------- notificações derivadas ---------------- */
function budget(o: Partial<Budget> = {}): Budget {
  return {
    id: id('bud'),
    user_id: U,
    workspace_id: 'ws-1',
    category_id: 'cat-x',
    contexto: 'PESSOAL',
    mes_referencia: '2026-07',
    limite_centavos: 1000_00,
    created_at: '',
    updated_at: '',
    ...o,
  }
}

const PREFS_ON = { venc_faturas: true, venc_contas: true, orcamento_80: true, mei_alertas: true }

describe('computeNotifications', () => {
  const hoje = '2026-07-10'

  it('gera aviso de fatura a vencer dentro da janela (com valor > 0)', () => {
    const inv = invoice({ id: 'inv-1', card_id: 'card-1', data_vencimento: '2026-07-13', paga: false })
    const compra = tx({ card_id: 'card-1', invoice_id: 'inv-1', valor_centavos: 200_00 })
    const out = computeNotifications({
      today: hoje,
      prefs: PREFS_ON,
      invoices: [inv],
      transactions: [compra],
      budgets: [],
      categories: [],
      cardNames: new Map([['card-1', 'Nubank']]),
    })
    const n = out.find((o) => o.tipo === 'venc_fatura')
    expect(n).toBeTruthy()
    expect(n!.titulo).toContain('Nubank')
    expect(n!.dedupe_key).toBe('venc_fatura:inv-1')
  })

  it('não gera fatura fora da janela nem fatura paga ou zerada', () => {
    const longe = invoice({ id: 'inv-long', card_id: 'c', data_vencimento: '2026-08-30' })
    const paga = invoice({ id: 'inv-paid', card_id: 'c', data_vencimento: '2026-07-11', paga: true })
    const zerada = invoice({ id: 'inv-zero', card_id: 'c', data_vencimento: '2026-07-11', paga: false })
    const compraLonge = tx({ card_id: 'c', invoice_id: 'inv-long', valor_centavos: 100_00 })
    const out = computeNotifications({
      today: hoje,
      prefs: PREFS_ON,
      invoices: [longe, paga, zerada],
      transactions: [compraLonge],
      budgets: [],
      categories: [],
    })
    expect(out.filter((o) => o.tipo === 'venc_fatura')).toHaveLength(0)
  })

  it('gera conta a pagar (despesa não-cartão, não paga) na janela e ignora receita/paga', () => {
    const conta = tx({ id: 'c-1', pago: false, tipo: 'DESPESA', account_id: 'a', data: '2026-07-12', descricao: 'Luz' })
    const receber = tx({ id: 'c-2', pago: false, tipo: 'RECEITA', account_id: 'a', data: '2026-07-12' })
    const jaPaga = tx({ id: 'c-3', pago: true, tipo: 'DESPESA', account_id: 'a', data: '2026-07-12' })
    const out = computeNotifications({
      today: hoje,
      prefs: PREFS_ON,
      invoices: [],
      transactions: [conta, receber, jaPaga],
      budgets: [],
      categories: [],
    })
    const contas = out.filter((o) => o.tipo === 'venc_conta')
    expect(contas).toHaveLength(1)
    expect(contas[0].dedupe_key).toBe('venc_conta:c-1')
    expect(contas[0].titulo).toContain('Luz')
  })

  it('avisa orçamento a partir de 80% e marca estouro acima de 100%', () => {
    const gasto80 = tx({ category_id: 'cat-a', tipo: 'DESPESA', valor_centavos: 850_00, data: '2026-07-05' })
    const gastoOver = tx({ category_id: 'cat-b', tipo: 'DESPESA', valor_centavos: 1200_00, data: '2026-07-05' })
    const catA = cat({ id: 'cat-a', nome: 'Mercado' })
    const catB = cat({ id: 'cat-b', nome: 'Lazer' })
    const out = computeNotifications({
      today: hoje,
      prefs: PREFS_ON,
      invoices: [],
      transactions: [gasto80, gastoOver],
      budgets: [
        budget({ id: 'b-a', category_id: 'cat-a', limite_centavos: 1000_00 }),
        budget({ id: 'b-b', category_id: 'cat-b', limite_centavos: 1000_00 }),
      ],
      categories: [catA, catB],
    })
    const orc = out.filter((o) => o.tipo === 'orcamento_80')
    expect(orc).toHaveLength(2)
    const over = orc.find((o) => o.titulo.includes('estourado'))
    expect(over?.dedupe_key).toBe('orcamento_80:b-b:2026-07:over')
    const at80 = orc.find((o) => o.titulo.includes('85%'))
    expect(at80?.dedupe_key).toBe('orcamento_80:b-a:2026-07:80')
  })

  it('não gera orçamento abaixo de 80% nem de outro mês', () => {
    const gasto = tx({ category_id: 'cat-a', tipo: 'DESPESA', valor_centavos: 500_00, data: '2026-07-05' })
    const out = computeNotifications({
      today: hoje,
      prefs: PREFS_ON,
      invoices: [],
      transactions: [gasto],
      budgets: [
        budget({ id: 'b-low', category_id: 'cat-a', limite_centavos: 1000_00 }),
        budget({ id: 'b-old', category_id: 'cat-a', limite_centavos: 1_00, mes_referencia: '2026-06' }),
      ],
      categories: [cat({ id: 'cat-a', nome: 'Mercado' })],
    })
    expect(out.filter((o) => o.tipo === 'orcamento_80')).toHaveLength(0)
  })

  it('respeita as preferências desligadas e deduplica por existingKeys', () => {
    const inv = invoice({ id: 'inv-x', card_id: 'c', data_vencimento: '2026-07-11' })
    const compra = tx({ card_id: 'c', invoice_id: 'inv-x', valor_centavos: 100_00 })
    const off = computeNotifications({
      today: hoje,
      prefs: { venc_faturas: false, venc_contas: false, orcamento_80: false, mei_alertas: false },
      invoices: [inv],
      transactions: [compra],
      budgets: [],
      categories: [],
    })
    expect(off).toHaveLength(0)

    const jaVisto = computeNotifications({
      today: hoje,
      prefs: PREFS_ON,
      invoices: [inv],
      transactions: [compra],
      budgets: [],
      categories: [],
      existingKeys: new Set(['venc_fatura:inv-x']),
    })
    expect(jaVisto.filter((o) => o.tipo === 'venc_fatura')).toHaveLength(0)
  })
  describe('alertas do MEI', () => {
    const base = {
      today: hoje,
      invoices: [],
      transactions: [],
      budgets: [],
      categories: [],
    }
    const critico = { year: 2026, status: meiStatus(75_000_00, 81_000_00) }

    it('gera 1 notificação mei com dedupe_key por ano e nível', () => {
      const out = computeNotifications({ ...base, prefs: PREFS_ON, mei: critico })
      const m = out.filter((o) => o.tipo === 'mei')
      expect(m).toHaveLength(1)
      expect(m[0].dedupe_key).toBe('mei-2026-critico')
    })

    it('não duplica quando a chave já existe', () => {
      const out = computeNotifications({
        ...base,
        prefs: PREFS_ON,
        mei: critico,
        existingKeys: new Set(['mei-2026-critico']),
      })
      expect(out).toHaveLength(0)
    })

    it('respeita mei_alertas desligado e nível ok', () => {
      expect(
        computeNotifications({ ...base, prefs: { ...PREFS_ON, mei_alertas: false }, mei: critico }),
      ).toHaveLength(0)
      expect(
        computeNotifications({
          ...base,
          prefs: PREFS_ON,
          mei: { year: 2026, status: meiStatus(10_000_00, 81_000_00) },
        }),
      ).toHaveLength(0)
    })
  })
})

/* ---------------- investimentos ---------------- */
describe('investimentos', () => {
  const CDI = 10 // % a.a.

  it('converte a forma de rendimento em taxa efetiva anual', () => {
    expect(annualRatePct({ forma_rendimento: 'CDI_PERCENT', taxa: 110 }, CDI)).toBeCloseTo(11)
    expect(annualRatePct({ forma_rendimento: 'PREFIXADO', taxa: 12 }, CDI)).toBe(12)
    expect(annualRatePct({ forma_rendimento: 'CDI_SPREAD', taxa: 2 }, CDI)).toBe(12)
    expect(annualRatePct({ forma_rendimento: 'NENHUM', taxa: 99 }, CDI)).toBe(0)
  })

  it('principal líquido = aportes − resgates', () => {
    const movs = [
      { tipo: 'aporte', valor_centavos: 1000_00, data: '2026-01-01' },
      { tipo: 'aporte', valor_centavos: 500_00, data: '2026-03-01' },
      { tipo: 'resgate', valor_centavos: 200_00, data: '2026-05-01' },
    ]
    expect(investedPrincipal(movs)).toBe(1300_00)
  })

  it('capitaliza um aporte por um ano exato à taxa efetiva', () => {
    const movs = [{ tipo: 'aporte', valor_centavos: 1000_00, data: '2026-01-01' }]
    // 110% do CDI(10%) = 11% a.a. → ~1110,00 depois de 365 dias
    const v = investmentValue({ forma_rendimento: 'CDI_PERCENT', taxa: 110 }, movs, CDI, '2027-01-01')
    expect(v).toBeGreaterThan(1109_00)
    expect(v).toBeLessThan(1111_00)
    const rend = investmentReturn({ forma_rendimento: 'CDI_PERCENT', taxa: 110 }, movs, CDI, '2027-01-01')
    expect(rend).toBeGreaterThan(109_00)
  })

  it('forma NENHUM não rende: valor = principal', () => {
    const movs = [{ tipo: 'aporte', valor_centavos: 1000_00, data: '2026-01-01' }]
    expect(investmentValue({ forma_rendimento: 'NENHUM', taxa: 0 }, movs, CDI, '2027-01-01')).toBe(1000_00)
    expect(investmentReturn({ forma_rendimento: 'NENHUM', taxa: 0 }, movs, CDI, '2027-01-01')).toBe(0)
  })

  it('movimento futuro não capitaliza (fator 1)', () => {
    const movs = [{ tipo: 'aporte', valor_centavos: 1000_00, data: '2027-06-01' }]
    expect(investmentValue({ forma_rendimento: 'PREFIXADO', taxa: 12 }, movs, CDI, '2026-07-08')).toBe(1000_00)
  })
})
