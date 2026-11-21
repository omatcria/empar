import { describe, expect, it } from 'vitest'
import { BANK_LOGO_SVG } from '../bank-logos'
import { BANKS } from '../banks'

const ALIAS_PJ = /-pj$/

describe('logos de bancos', () => {
  for (const [id, svg] of Object.entries(BANK_LOGO_SVG)) {
    it(`SVG de ${id} é XML válido com viewBox`, () => {
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
      expect(doc.getElementsByTagName('parsererror').length).toBe(0)
      expect(doc.documentElement.getAttribute('viewBox')).toBeTruthy()
    })
  }

  it('todo id de BANK_LOGO_SVG existe em BANKS (ou alias -pj)', () => {
    const ids = new Set(BANKS.map((b) => b.id))
    for (const id of Object.keys(BANK_LOGO_SVG)) {
      expect(ids.has(id) || ids.has(id.replace(ALIAS_PJ, '')), id).toBe(true)
    }
  })

  it('bancos novos existem no catálogo', () => {
    const ids = BANKS.map((b) => b.id)
    for (const id of ['cora', 'stone', 'infinitepay', 'pagbank', 'btg', 'sicoob', 'sicredi', 'pan']) {
      expect(ids).toContain(id)
    }
  })
})
