import { describe, it, expect } from 'vitest'
import type { Category, Transaction } from '@/domain/types'
import {
  meiRevenue,
  meiLimit,
  meiStatus,
  meiProjection,
  meiMessage,
  meiImpact,
} from '@/engine/mei'

let seq = 0
function tx(o: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx-${++seq}`,
    user_id: 'u',
    workspace_id: 'ws',
    contexto: 'EMPRESARIAL',
    tipo: 'RECEITA',
    account_id: null,
    card_id: null,
    invoice_id: null,
    category_id: 'cat-ok',
    valor_centavos: 100000,
    data: '2026-03-10',
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
  } as Transaction
}

const cats = [
  { id: 'cat-ok', sistema: false },
  { id: 'cat-sys', sistema: true },
] as Category[]

describe('meiRevenue', () => {
  it('soma só EMPRESARIAL+RECEITA do ano, ignora ponte, sistema, outro ano e PESSOAL', () => {
    const txs = [
      tx({ valor_centavos: 100000 }),
      tx({ valor_centavos: 50000, pago: false }),
      tx({ valor_centavos: 999, transfer_id: 't-1' }),
      tx({ valor_centavos: 888, category_id: 'cat-sys' }),
      tx({ valor_centavos: 777, data: '2025-12-31' }),
      tx({ valor_centavos: 666, data: '2027-01-01' }),
      tx({ valor_centavos: 555, contexto: 'PESSOAL' }),
      tx({ valor_centavos: 444, tipo: 'DESPESA' }),
    ]
    expect(meiRevenue(txs, cats, 2026)).toEqual({ realizado: 100000, previsto: 150000 })
  })
})

describe('meiLimit', () => {
  it('é cheio sem abertura ou com abertura em ano anterior', () => {
    expect(meiLimit(8100000, null, 2026)).toBe(8100000)
    expect(meiLimit(8100000, '2025-03-01', 2026)).toBe(8100000)
  })
  it('é proporcional no ano de abertura', () => {
    expect(meiLimit(8100000, '2026-07-15', 2026)).toBe(4050000)
  })
})

describe('meiStatus', () => {
  const L = 8100000
  it.each([
    [5669999, 'ok'],
    [5670000, 'atencao'],
    [7289999, 'atencao'],
    [7290000, 'critico'],
    [8099999, 'critico'],
    [8100000, 'excedido'],
    [9720000, 'excedido'],
    [9720001, 'desenquadrado'],
  ])('%i -> %s', (v, nivel) => {
    expect(meiStatus(v, L).nivel).toBe(nivel)
  })
  it('restante nunca é negativo', () => {
    expect(meiStatus(9000000, L).restante).toBe(0)
    expect(meiStatus(1000000, L).restante).toBe(7100000)
  })
})

describe('meiProjection', () => {
  it('projeta ritmo e média mensal disponível', () => {
    expect(meiProjection(4050000, 8100000, '2026-06-30')).toEqual({
      ritmoAnual: 8100000,
      mediaMensalDisponivel: 675000,
      mesesRestantes: 6,
    })
  })
})

describe('meiMessage', () => {
  it('excedido cita DAS complementar e 1º de janeiro do ano seguinte', () => {
    const m = meiMessage(meiStatus(8500000, 8100000), 2026)
    const all = `${m.titulo} ${m.texto} ${m.acao}`
    expect(all).toContain('DAS complementar')
    expect(all).toContain('1º de janeiro de 2027')
    expect(m.acao).toContain('contador')
  })
  it('desenquadrado cita retroativo', () => {
    const m = meiMessage(meiStatus(10000000, 8100000), 2026)
    expect(`${m.titulo} ${m.texto} ${m.acao}`).toContain('retroativo')
  })
  it('todos os níveis têm título, texto e ação', () => {
    for (const v of [1000000, 6000000, 7500000, 8100000, 10000000]) {
      const m = meiMessage(meiStatus(v, 8100000), 2026)
      expect(m.titulo && m.texto && m.acao).toBeTruthy()
    }
  })
})

describe('meiImpact', () => {
  it('edição sem mudar o valor não sobe de nível', () => {
    const r = meiImpact(7000000, 8100000, 500000, 500000)
    expect(r.depois.valor).toBe(7000000)
    expect(r.subiuNivel).toBe(false)
  })
  it('novo lançamento que cruza para crítico sobe de nível', () => {
    const r = meiImpact(7000000, 8100000, 500000)
    expect(r.antes.nivel).toBe('atencao')
    expect(r.depois.nivel).toBe('critico')
    expect(r.subiuNivel).toBe(true)
  })
})
