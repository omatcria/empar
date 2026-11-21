// Gera src/domain/bank-logos.ts a partir de github.com/Tgentil/Bancos-em-SVG.
// Uso: node scripts/build-bank-logos.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const REPO = 'Tgentil/Bancos-em-SVG'
const BRANCH = 'main'
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/domain/bank-logos.ts')

/** id do app → caminho do SVG de símbolo no repositório. */
export const LOGO_PATHS = {
  nubank: 'Nu Pagamentos S.A/nubank-logo-2021.svg',
  inter: 'Banco Inter S.A/inter.svg',
  itau: 'Itaú Unibanco S.A/itau.svg',
  bradesco: 'Bradesco S.A/bradesco.svg',
  bb: 'Banco do Brasil S.A/banco-do-brasil-sem-fundo.svg',
  caixa: 'Caixa Econômica Federal/caixa-economica-federal-1.svg',
  mercadopago: 'Mercado Pago/mercado-pago.svg',
  c6: 'Banco C6 S.A/c6 bank.svg',
  picpay: 'PicPay/Logo-PicPay.svg',
  neon: 'Neon/header-logo-neon.svg',
  santander: 'Banco Santander Brasil S.A/banco-santander-logo.svg',
  cora: 'Cora Sociedade Credito Direto S.A/icone-cora-rosa-pequeno.svg',
  stone: 'Stone Pagamentos S.A/stone.svg',
  infinitepay: 'InfinitePay/InfitePay.svg',
  pagbank: 'PagSeguro Internet S.A/logo-pagbank.svg',
  btg: 'Banco BTG Pacutal/btg-pactual.svg',
  sicoob: 'Sicoob/sicoob-minimalista-com.svg',
  sicredi: 'Sicredi/logo-svg2.svg',
  pan: 'Banco Pan/bancoPan.svg',
  // Next e Will Bank não existem no repositório (badge colorido de fallback).
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const TAG_RE = /<([A-Za-z][\w:.-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g
const ATTR_RE = /([^\s=>/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g

/** Remove lixo de editor (Inkscape/Illustrator), deduplica atributos e garante xmlns + viewBox. */
export function sanitizeSvg(input) {
  let s = String(input)
    .replace(/^\uFEFF/, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?(\[[\s\S]*?\])?\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<sodipodi:[\w-]+\b[^>]*\/>/g, '')
    .replace(/<sodipodi:([\w-]+)\b[^>]*>[\s\S]*?<\/sodipodi:\1>/g, '')

  const usesPrefix = (p) => new RegExp(`[\s<]${p}:[\w-]+`).test(s.replace(/xmlns:\w+="[^"]*"/g, ''))

  let first = true
  s = s.replace(TAG_RE, (_m, name, attrs, selfClose) => {
    const seen = new Map()
    for (const a of attrs.matchAll(ATTR_RE)) {
      const key = a[1]
      if (/^(sodipodi|inkscape):/.test(key)) continue
      if (/^xmlns:/.test(key)) {
        const prefix = key.slice(6)
        if (!usesPrefix(prefix)) continue
      }
      if (key === 'xmlns') continue // reposto abaixo, só na raiz
      if (!seen.has(key)) seen.set(key, a[2])
    }
    if (first && name.toLowerCase() === 'svg') {
      first = false
      const ordered = new Map([['xmlns', `"${SVG_NS}"`]])
      if (!seen.has('viewBox')) {
        const num = (v) => parseFloat(String(v ?? '').replace(/["']/g, ''))
        const w = num(seen.get('width'))
        const h = num(seen.get('height'))
        if (w > 0 && h > 0) ordered.set('viewBox', `"0 0 ${w} ${h}"`)
      }
      for (const [k, v] of seen) ordered.set(k, v)
      seen.clear()
      for (const [k, v] of ordered) seen.set(k, v)
    }
    const out = [...seen].map(([k, v]) => (v === undefined ? k : `${k}=${v}`)).join(' ')
    return `<${name}${out ? ' ' + out : ''}${selfClose ? '/' : ''}>`
  })

  return s.replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim()
}

/** Cor de preenchimento dominante (primeiro hex não branco/preto/transparente mais frequente). */
function dominantFill(svg) {
  const count = new Map()
  for (const m of svg.matchAll(/(?:fill\s*[:=]\s*["']?|stop-color\s*[:=]\s*["']?)(#[0-9a-fA-F]{3,6})\b/g)) {
    let c = m[1].toLowerCase()
    if (c.length === 4) c = '#' + [...c.slice(1)].map((x) => x + x).join('')
    if (c === '#ffffff' || c === '#000000') continue
    count.set(c, (count.get(c) ?? 0) + 1)
  }
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0]
}

async function download(path) {
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path.split('/').map(encodeURIComponent).join('/')}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ao baixar ${path}`)
  return res.text()
}

async function main() {
  const entries = {}
  for (const [id, path] of Object.entries(LOGO_PATHS)) {
    const clean = sanitizeSvg(await download(path))
    entries[id] = clean
    console.log(`${id.padEnd(12)} ${String(clean.length).padStart(7)} bytes  cor=${dominantFill(clean) ?? '?'}  <- ${path}`)
  }
  const body = Object.entries(entries)
    .map(([id, svg]) => `  ${JSON.stringify(id)}: ${JSON.stringify(svg)},`)
    .join('\n')
  writeFileSync(
    OUT,
    `// GERADO por scripts/build-bank-logos.mjs — não edite à mão.\n// Fonte: github.com/${REPO} (símbolos), saneados.\n// Renderizados via <img> com data-URI para isolar estilos internos de cada SVG.\n\nexport const BANK_LOGO_SVG: Record<string, string> = {\n${body}\n}\n`,
  )
  console.log(`Escrito ${OUT}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
