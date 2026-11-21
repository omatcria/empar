import { describe, expect, it } from 'vitest'
// @ts-expect-error script .mjs sem tipos
import { sanitizeSvg } from '../../../scripts/build-bank-logos.mjs'

const DIRTY = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Inkscape -->
<svg xmlns="http://www.w3.org/2000/svg" width="10" height="20" inkscape:version="1.2" sodipodi:docname="x.svg"
  xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
  xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
  xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg">
  <metadata><rdf:RDF/></metadata>
  <sodipodi:namedview id="nv" inkscape:zoom="1"/>
  <defs><path id="p" d="M0 0h5v5z"/></defs>
  <use xlink:href="#p" inkscape:label="a"/>
</svg>`

describe('sanitizeSvg', () => {
  it('mantém xmlns:xlink usado, um único xmlns e remove lixo do Inkscape', () => {
    const out: string = sanitizeSvg(DIRTY)
    const doc = new DOMParser().parseFromString(out, 'image/svg+xml')
    expect(doc.getElementsByTagName('parsererror').length).toBe(0)
    expect(out).toContain('xmlns:xlink=')
    expect(out.match(/xmlns="/g)?.length).toBe(1)
    expect(out).not.toMatch(/sodipodi|inkscape|<metadata|<\?xml|<!--/)
    expect(doc.documentElement.getAttribute('viewBox')).toBe('0 0 10 20')
  })

  it('remove xmlns:xlink quando não é usado', () => {
    const out: string = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1 1"><path d="M0 0"/></svg>',
    )
    expect(out).not.toContain('xmlns:xlink')
  })
})
