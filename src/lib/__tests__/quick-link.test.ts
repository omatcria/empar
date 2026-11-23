import { describe, expect, it } from 'vitest'
import { parseQuickLink } from '../quick-link'

describe('parseQuickLink', () => {
  it.each([
    ['?novo=despesa', { tipo: 'DESPESA', meio: 'conta' }],
    ['?novo=receita', { tipo: 'RECEITA', meio: 'conta' }],
    ['?novo=cartao', { tipo: 'DESPESA', meio: 'cartao' }],
    ['?novo=outro', null],
    ['', null],
  ])('interpreta %s', (query, expected) => expect(parseQuickLink(query)).toEqual(expected))
})
