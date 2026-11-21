import { parseProductHtml, type ParsedProduct } from './product-parser.ts'

const hosts = new Set(['mercadolivre.com.br', 'www.mercadolivre.com.br', 'produto.mercadolivre.com.br'])
const maxBytes = 3 * 1024 * 1024

export function isBrowserEligible(raw: string): boolean {
  try {
    const page = new URL(raw)
    return page.protocol === 'https:' && hosts.has(page.hostname) && !page.port && !page.username && !page.password && /\/(?:p|up)\/MLB[A-Z]?\d+|\/MLB-?\d+/i.test(page.pathname)
  } catch { return false }
}

/** Fallback manual para anúncios públicos, sem enviar parâmetros de rastreamento. */
export async function fetchBrowserProduct(raw: string, config: { endpoint: string; token: string }): Promise<ParsedProduct | null> {
  let page: URL
  let endpoint: URL
  try { page = new URL(raw); endpoint = new URL(config.endpoint) } catch { return null }
  if (!isBrowserEligible(raw)) return null
  if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'production-sfo.browserless.io' || endpoint.username || endpoint.password || !config.token) return null
  const clean = new URL(page.origin + page.pathname)
  const item = page.searchParams.get('pdp_filters')
  if (item && /^item_id:MLB\d+$/i.test(item)) clean.searchParams.set('pdp_filters', item)
  endpoint = new URL('/chromium/content', endpoint.origin)
  endpoint.searchParams.set('token', config.token)
  endpoint.searchParams.set('timeout', '25000')
  endpoint.searchParams.set('allowedDomains', JSON.stringify(['mercadolivre.com.br', '*.mercadolivre.com.br', '*.mlstatic.com']))
  try {
    const response = await fetch(endpoint, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(27000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: clean.href, gotoOptions: { waitUntil: 'domcontentloaded', timeout: 20000 }, waitForTimeout: 1200 }),
    })
    if (!response.ok || !response.body) return null
    const declared = Number(response.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > maxBytes) return null
    const reader = response.body.getReader(), chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) { await reader.cancel(); return null }
      chunks.push(value)
    }
    const bytes = new Uint8Array(total); let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const html = new TextDecoder().decode(bytes)
    if (/<title[^>]*>[^<]*(?:verifica[çc][ãa]o|captcha|acesso negado)/i.test(html) || /(?:action|location)=["'][^"']*\/gz\/account-verification/i.test(html)) return null
    const product = parseProductHtml(html, clean.href)
    if (!product.titulo || product.preco_centavos == null || !Number.isSafeInteger(product.preco_centavos) || product.preco_centavos < 0) return null
    if (product.imagem_url) {
      try { if (new URL(product.imagem_url).protocol !== 'https:') product.imagem_url = null } catch { product.imagem_url = null }
    }
    return product
  } catch { return null }
}
