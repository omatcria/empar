import { describe, expect, it } from 'vitest'
import { buildMemberNotification, type MemberEvent } from '../member-notifications'

const lanc = (o: Partial<Extract<MemberEvent, { kind: 'lancamento' }>> = {}): MemberEvent => ({
  kind: 'lancamento',
  acao: 'criou',
  entityId: 'e1',
  descricao: 'Mercado',
  tipo: 'DESPESA',
  valorCentavos: 15000,
  data: '2026-11-22',
  ...o,
})

const A = 'Gabriela'

describe('buildMemberNotification', () => {
  it('lançamento criado', () => {
    expect(buildMemberNotification(lanc(), A)).toEqual({
      tipo: 'membro_lancamento',
      titulo: 'Gabriela lançou: Mercado',
      corpo: 'Despesa de R$ 150,00 · 22/11',
      meta: { acao: 'criou', entity_id: 'e1' },
    })
  })

  it('parcelado criado', () => {
    const n = buildMemberNotification(
      lanc({ descricao: 'TV', valorCentavos: 240000, parcelas: 12 }),
      A,
    )
    expect(n.titulo).toBe('Gabriela lançou: TV (12x)')
    expect(n.corpo).toBe('Despesa de R$ 2.400,00 em 12 parcelas')
  })

  it('lançamento editado e excluído', () => {
    const e = buildMemberNotification(lanc({ acao: 'editou', valorCentavos: 16000 }), A)
    expect(e.titulo).toBe('Gabriela editou: Mercado')
    expect(e.corpo).toBe('Despesa de R$ 160,00 · 22/11')
    expect(e.meta.acao).toBe('editou')
    const x = buildMemberNotification(lanc({ acao: 'excluiu' }), A)
    expect(x.titulo).toBe('Gabriela excluiu: Mercado')
    expect(x.corpo).toBe('Despesa de R$ 150,00 · 22/11')
  })

  it('grupo editado', () => {
    const n = buildMemberNotification(
      lanc({ acao: 'editou', descricao: 'TV (3/12)', parcelas: 12, afetadas: 5 }),
      A,
    )
    expect(n.titulo).toBe('Gabriela editou: TV (12x)')
    expect(n.corpo).toBe('Alteração em 5 parcelas')
  })

  it('grupo excluído', () => {
    const n = buildMemberNotification(
      lanc({ acao: 'excluiu', descricao: 'TV (3/12)', parcelas: 12, afetadas: 12 }),
      A,
    )
    expect(n.titulo).toBe('Gabriela excluiu: TV (12x)')
    expect(n.corpo).toBe('12 parcelas removidas')
  })

  it('receita e descrição vazia', () => {
    const n = buildMemberNotification(lanc({ tipo: 'RECEITA', descricao: '' }), A)
    expect(n.titulo).toBe('Gabriela lançou: Lançamento')
    expect(n.corpo).toBe('Receita de R$ 150,00 · 22/11')
  })

  it('desejos', () => {
    const base = { kind: 'desejo', entityId: 'w1', titulo: 'Fone X' } as const
    const c = buildMemberNotification(
      { ...base, acao: 'criou', precoCentavos: 29990 },
      A,
    )
    expect(c).toEqual({
      tipo: 'membro_desejo',
      titulo: 'Gabriela adicionou um desejo: Fone X',
      corpo: 'R$ 299,90',
      meta: { acao: 'criou', entity_id: 'w1' },
    })
    expect(
      buildMemberNotification({ ...base, acao: 'editou', precoCentavos: null }, A),
    ).toMatchObject({ titulo: 'Gabriela editou um desejo: Fone X', corpo: 'Sem preço' })
    expect(
      buildMemberNotification({ ...base, acao: 'excluiu', precoCentavos: 100 }, A).titulo,
    ).toBe('Gabriela excluiu um desejo: Fone X')
  })
})
