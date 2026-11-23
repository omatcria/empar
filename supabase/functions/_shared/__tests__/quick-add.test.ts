import { describe, expect, it } from 'vitest'
import { parseValorToCents, parseMeio, quickAddMessage, meioLabel, categoriaLabel } from '../quick-add'

describe('atalho financeiro', () => {
  it.each([['45,90',4590], ['45.90',4590], ['1.234,56',123456], ['R$ 45,90',4590], [45,4500], ['abc',null], [0,null], [-5,null], ['1,234',null], ['1.2.3',null]])('interpreta %s', (input, expected) => expect(parseValorToCents(input)).toBe(expected))
  it('valida o meio', () => {
    expect(parseMeio('conta:123e4567-e89b-12d3-a456-426614174000')).toEqual({kind:'conta', id:'123e4567-e89b-12d3-a456-426614174000'})
    expect(parseMeio('cartao:inválido')).toBeNull()
  })
  it('formata a mensagem', () => expect(quickAddMessage('despesa',4590,'Mercado')).toBe('Despesa de R$ 45,90 lançada: Mercado'))
  it('forma rótulos legíveis para meios e subcategorias', () => {
    expect(meioLabel('cartao', 'Nubank', 'PESSOAL')).toBe('Cartão · Nubank (Pessoal)')
    expect(categoriaLabel('Mercado', 'Alimentação')).toBe('Alimentação › Mercado')
  })
  it('mantém centavos exatos em valores grandes e rejeita números fora do limite seguro', () => {
    expect(parseValorToCents('90.071.992.547.400,01')).toBe(9007199254740001)
    expect(parseValorToCents('90.071.992.547.409,91')).toBe(9007199254740991)
    expect(parseValorToCents('90.071.992.547.409,92')).toBeNull()
  })
})
