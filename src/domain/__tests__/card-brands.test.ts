import { describe, it, expect } from 'vitest'
import { CARD_BRANDS, normalizeBrand } from '../card-brands'

describe('normalizeBrand', () => {
  it.each([
    ['Visa', 'visa'],
    ['MASTER', 'mastercard'],
    ['Mastercard', 'mastercard'],
    ['American Express', 'amex'],
    ['amex', 'amex'],
    ['Elo', 'elo'],
    ['hiper', 'hipercard'],
    ['Visa Platinum Itaú', 'visa'],
    ['xyz', null],
    [null, null],
    [undefined, null],
    ['', null],
  ])('%s -> %s', (input, out) => {
    expect(normalizeBrand(input as string | null | undefined)).toBe(out)
  })
})

describe('CARD_BRANDS', () => {
  it('tem as 5 bandeiras', () => {
    expect(CARD_BRANDS.map((b) => b.id)).toEqual(['visa', 'mastercard', 'elo', 'amex', 'hipercard'])
  })
  it.each(CARD_BRANDS.map((b) => [b.id, b.svg]))('svg de %s é XML válido com viewBox', (_id, svg) => {
    const doc = new DOMParser().parseFromString(svg as string, 'image/svg+xml')
    expect(doc.getElementsByTagName('parsererror').length).toBe(0)
    expect(doc.documentElement.tagName).toBe('svg')
    expect(doc.documentElement.getAttribute('viewBox')).toBeTruthy()
  })
})
