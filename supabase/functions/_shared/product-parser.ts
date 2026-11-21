// Leitor genérico de páginas de produto. Sem imports (regex/string); `URL` é global em Deno e navegadores.

export interface ParsedProduct {
  titulo: string | null
  descricao: string | null
  imagem_url: string | null
  preco_centavos: number | null
  loja: string | null
}

/** Converte preço em reais (texto BR/US ou número) para centavos inteiros. */
export function parsePriceToCents(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) : null
  }
  if (typeof raw !== 'string') return null
  const s = raw.replace(/[^\d.,]/g, '')
  if (!/\d/.test(s)) return null
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  let normalized: string
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? '.' : ','
    const mil = dec === '.' ? ',' : '.'
    normalized = s.split(mil).join('').replace(dec, '.')
  } else if (lastComma >= 0) {
    const frac = s.length - lastComma - 1
    const unico = s.indexOf(',') === lastComma
    normalized = unico && frac !== 3 ? s.replace(',', '.') : s.split(',').join('')
  } else if (lastDot >= 0) {
    const frac = s.length - lastDot - 1
    const unico = s.indexOf('.') === lastDot
    normalized = unico && frac !== 3 ? s : s.split('.').join('')
  } else {
    normalized = s
  }
  const n = Number(normalized)
  return Number.isFinite(n) ? Math.round(n * 100) : null
}

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', agrave: 'à', acirc: 'â', atilde: 'ã', eacute: 'é', ecirc: 'ê', iacute: 'í',
  oacute: 'ó', ocirc: 'ô', otilde: 'õ', uacute: 'ú', ccedil: 'ç',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ccedil: 'Ç',
  Atilde: 'Ã', Otilde: 'Õ', Acirc: 'Â', Ecirc: 'Ê', Ocirc: 'Ô',
}

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e: string) => {
    if (e[0] === '#') {
      try {
        const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
        return String.fromCodePoint(code)
      } catch {
        return m
      }
    }
    return NAMED[e] ?? NAMED[e.toLowerCase()] ?? m
  })
}

const clean = (s: string | null | undefined): string | null => {
  if (s == null) return null
  const t = decodeEntities(s).replace(/\s+/g, ' ').trim()
  return t || null
}

function parseAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([^\s"'<>\/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(tag))) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ''
  return attrs
}

function readMetas(html: string): Record<string, string> {
  const metas: Record<string, string> = {}
  const re = /<meta\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const a = parseAttrs(m[0])
    const key = (a.property ?? a.name ?? a.itemprop ?? '').toLowerCase()
    const content = a.content
    if (key && content != null && !(key in metas)) metas[key] = content
  }
  return metas
}

type Json = unknown
const isObj = (v: Json): v is Record<string, Json> => typeof v === 'object' && v !== null && !Array.isArray(v)

function collectNodes(v: Json, out: Record<string, Json>[], depth = 0): void {
  if (depth > 6) return
  if (Array.isArray(v)) {
    v.forEach((x) => collectNodes(x, out, depth + 1))
  } else if (isObj(v)) {
    out.push(v)
    if ('@graph' in v) collectNodes(v['@graph'], out, depth + 1)
    if ('hasVariant' in v) collectNodes(v.hasVariant, out, depth + 1)
  }
}

const hasType = (n: Record<string, Json>, ...types: string[]): boolean => {
  const t = n['@type']
  const list = Array.isArray(t) ? t : [t]
  return list.some((x) => typeof x === 'string' && types.includes(x))
}

function offerPrice(offers: Json, depth = 0): unknown {
  if (depth > 4 || offers == null) return null
  if (Array.isArray(offers)) {
    for (const o of offers) {
      const p = offerPrice(o, depth + 1)
      if (p != null) return p
    }
    return null
  }
  if (!isObj(offers)) return null
  for (const k of ['price', 'lowPrice']) {
    if (offers[k] != null && parsePriceToCents(offers[k]) != null) return offers[k]
  }
  const spec = offers.priceSpecification
  const sp = Array.isArray(spec) ? spec[0] : spec
  if (isObj(sp) && sp.price != null) return sp.price
  return offerPrice(offers.offers, depth + 1)
}

function imageOf(v: Json): string | null {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) {
    for (const x of v) {
      const r = imageOf(x)
      if (r) return r
    }
    return null
  }
  if (isObj(v)) return imageOf(v.url ?? v.contentUrl)
  return null
}

const str = (v: Json): string | null => (typeof v === 'string' ? v : null)

function readJsonLd(html: string): { titulo: string | null; descricao: string | null; imagem: string | null; preco: unknown } {
  const res = { titulo: null as string | null, descricao: null as string | null, imagem: null as string | null, preco: null as unknown }
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    let data: Json
    try {
      data = JSON.parse(m[1].trim())
    } catch {
      continue
    }
    const nodes: Record<string, Json>[] = []
    collectNodes(data, nodes)
    for (const n of nodes.filter((x) => hasType(x, 'Product', 'ProductGroup', 'IndividualProduct'))) {
      res.titulo ??= str(n.name)
      res.descricao ??= str(n.description)
      res.imagem ??= imageOf(n.image)
      if (res.preco == null) res.preco = offerPrice(n.offers)
    }
  }
  return res
}

function resolveUrl(src: string | null, pageUrl: string): string | null {
  if (!src) return null
  try {
    return new URL(decodeEntities(src.trim()), pageUrl).href
  } catch {
    return null
  }
}

export function parseProductHtml(html: string, pageUrl: string): ParsedProduct {
  const ld = readJsonLd(html)
  const meta = readMetas(html)
  const titleTag = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? null

  const titulo = clean(ld.titulo) ?? clean(meta['og:title']) ?? clean(meta['twitter:title']) ?? clean(titleTag)
  const descricao =
    clean(ld.descricao) ?? clean(meta['og:description']) ?? clean(meta['twitter:description']) ?? clean(meta['description'])
  const imagem_url = resolveUrl(
    ld.imagem ?? meta['og:image'] ?? meta['og:image:url'] ?? meta['twitter:image'] ?? meta['image'] ?? null,
    pageUrl,
  )

  let preco_centavos = parsePriceToCents(ld.preco)
  if (preco_centavos == null) {
    for (const k of ['product:price:amount', 'og:price:amount', 'price']) {
      preco_centavos = parsePriceToCents(meta[k])
      if (preco_centavos != null) break
    }
  }
  if (preco_centavos == null) {
    const tags = html.match(/<[^>]+\bitemprop\s*=\s*["']price["'][^>]*>/gi) ?? []
    for (const tag of tags) {
      const attrs = parseAttrs(tag)
      preco_centavos = parsePriceToCents(attrs.content ?? attrs.value)
      if (preco_centavos != null) break
    }
  }

  let loja: string | null = null
  try {
    loja = new URL(pageUrl).hostname.replace(/^www\./i, '') || null
  } catch {
    loja = null
  }
  return { titulo, descricao, imagem_url, preco_centavos, loja }
}
