/// <reference types="node" />
// Baixa uma página de produto com proteção contra SSRF e devolve os dados lidos pelo parser.
// Só usa APIs web globais (fetch, URL, AbortController, TextDecoder, crypto): roda no Deno
// (Edge Functions) e no Node ≥ 22, o que permite testar localmente sem Deno.
import { parseProductHtml, type ParsedProduct } from './product-parser.ts'
import { lookup } from 'node:dns/promises'

export type FetchProductResult = { ok: true; product: ParsedProduct } | { ok: false; motivo: string }
export type UrlCheck = { ok: true; url: URL } | { ok: false; motivo: string }

const TIMEOUT_MS = 12_000
const MAX_BYTES = 3 * 1024 * 1024
const MAX_REDIRECTS = 5
const MAX_URL_LENGTH = 2048
const PORTAS_PERMITIDAS = new Set(['', '80', '443', '8080', '8443'])

const CABECALHOS_NAVEGADOR: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
}

const falha = (motivo: string): { ok: false; motivo: string } => ({ ok: false, motivo })

// ---------- Proteção SSRF ----------

/** IPv4 em notação decimal com pontos (o parser WHATWG já normaliza 0x7f.1, 2130706433 etc.). */
function parseIPv4(host: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!m) return null
  const o = m.slice(1).map(Number)
  if (o.some((x) => x > 255)) return null
  return ((o[0] << 24) >>> 0) + (o[1] << 16) + (o[2] << 8) + o[3]
}

const BLOQUEIOS_V4: [string, number][] = [
  ['0.0.0.0', 8], // "esta rede"
  ['10.0.0.0', 8], // privada
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local (metadados de nuvem)
  ['172.16.0.0', 12], // privada
  ['192.0.0.0', 24], // IETF
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.168.0.0', 16], // privada
  ['198.18.0.0', 15], // benchmark
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 3], // multicast + reservado + broadcast
]
const FAIXAS_V4 = BLOQUEIOS_V4.map(([base, bits]) => {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return { rede: (parseIPv4(base)! & mask) >>> 0, mask }
})

function ipv4Bloqueado(ip: number): boolean {
  return FAIXAS_V4.some(({ rede, mask }) => ((ip & mask) >>> 0) === rede)
}

/** Bloqueia nomes internos e IPs literais não públicos. */
export function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, '')
  if (!host) return true
  // Qualquer IPv6 literal ([::1], fc00::/7, fe80::/10, ::ffff:7f00:1…): loja nenhuma usa.
  if (host.startsWith('[') || host.includes(':')) return true
  const v4 = parseIPv4(host)
  if (v4 != null) return ipv4Bloqueado(v4)
  if (/^[\d.]+$/.test(host)) return true // numérico mas não é um IPv4 válido
  if (!host.includes('.')) return true // rótulo único: "localhost", "metadata", "db"…
  return /(^|\.)(localhost|local|internal|intranet|lan|home\.arpa)$/.test(host)
}

function verificarUrl(url: URL): UrlCheck {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return falha('Só aceitamos links http(s)')
  if (url.username || url.password) return falha('Links com usuário/senha não são aceitos')
  if (!PORTAS_PERMITIDAS.has(url.port)) return falha('Porta não permitida')
  if (isBlockedHost(url.hostname)) return falha('Endereço não permitido')
  return { ok: true, url }
}

/** Valida a URL informada pelo usuário (formato, protocolo, host). Não faz rede. */
export function validateTargetUrl(raw: unknown): UrlCheck {
  if (typeof raw !== 'string' || !raw.trim()) return falha('Informe o link do produto')
  const s = raw.trim()
  if (s.length > MAX_URL_LENGTH) return falha('Link longo demais')
  let url: URL
  try {
    url = new URL(s)
  } catch {
    return falha('Link inválido')
  }
  return verificarUrl(url)
}

type Connection = { read(buffer: Uint8Array): Promise<number | null>; write(buffer: Uint8Array): Promise<number>; close(): void }
type DenoNetwork = { connect(options: {hostname: string; port: number}): Promise<Connection>; startTls(conn: Connection, options: {hostname: string}): Promise<Connection> }

// Conecta ao endereço validado; TLS continua verificando o hostname original.
async function safeRequest(url: URL, signal: AbortSignal): Promise<Response> {
  const literal = parseIPv4(url.hostname)
  const addresses = literal == null ? await lookup(url.hostname, { all: true, verbatim: true }) : [{ address: url.hostname, family: 4 }]
  if (signal.aborted) throw new Error('Tempo esgotado')
  const address = addresses.find(a => a.family === 4 && parseIPv4(a.address) != null && !ipv4Bloqueado(parseIPv4(a.address)!))
  if (!address || addresses.some(a => a.family === 4 && (parseIPv4(a.address) == null || ipv4Bloqueado(parseIPv4(a.address)!)))) throw new Error('Endereço não permitido')
  const network = (globalThis as unknown as { Deno: DenoNetwork }).Deno
  let conn = await network.connect({ hostname: address.address, port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)) })
  if (signal.aborted) { conn.close(); throw new Error('Tempo esgotado') }
  const abort = () => { try { conn.close() } catch { /* already closed */ } }
  signal.addEventListener('abort', abort, { once: true })
  try {
    if (url.protocol === 'https:') conn = await network.startTls(conn, { hostname: url.hostname })
    const headers = { ...CABECALHOS_NAVEGADOR, Host: url.host, Connection: 'close', 'Accept-Encoding': 'identity' }
    const request = `GET ${url.pathname}${url.search} HTTP/1.1\r\n${Object.entries(headers).map(([k,v])=>`${k}: ${v}`).join('\r\n')}\r\n\r\n`
    const requestBytes = new TextEncoder().encode(request)
    for (let sent = 0; sent < requestBytes.length;) sent += await conn.write(requestBytes.subarray(sent))
    const parts: Uint8Array[] = []; let size = 0
    while (size < MAX_BYTES + 262144) {
      const buffer = new Uint8Array(16384), n = await conn.read(buffer)
      if (n == null) break
      if (n === 0) continue
      size += n; parts.push(buffer.subarray(0,n))
    }
    if (size >= MAX_BYTES + 262144) throw new Error('Página grande demais')
    const bytes = new Uint8Array(size); let pos=0
    for (const part of parts) { bytes.set(part,pos);pos+=part.length }
    let split=-1
    for(let i=0;i<bytes.length-3;i++) if(bytes[i]===13&&bytes[i+1]===10&&bytes[i+2]===13&&bytes[i+3]===10){split=i;break}
    if(split<0 || split>65536) throw new Error('Resposta inválida')
    const head=new TextDecoder('latin1').decode(bytes.subarray(0,split)).split('\r\n')
    const status=Number(/^HTTP\/1\.[01] (\d{3})/.exec(head.shift() ?? '')?.[1])
    if(!status) throw new Error('Resposta inválida')
    const responseHeaders=new Headers()
    for(const line of head){const i=line.indexOf(':');if(i>0)responseHeaders.append(line.slice(0,i).trim(),line.slice(i+1).trim())}
    let body=bytes.subarray(split+4)
    if(/chunked/i.test(responseHeaders.get('transfer-encoding') ?? '')) {
      const chunks: Uint8Array[]=[];let offset=0,total=0
      while(true){let end=offset;while(end+1<body.length && !(body[end]===13&&body[end+1]===10))end++
        if(end+1>=body.length)throw new Error('Resposta incompleta')
        const text=new TextDecoder().decode(body.subarray(offset,end)).split(';')[0]
        if(!/^[0-9a-f]+$/i.test(text))throw new Error('Resposta inválida')
        const n=parseInt(text,16);offset=end+2;if(n===0)break
        if(offset+n+2>body.length||body[offset+n]!==13||body[offset+n+1]!==10)throw new Error('Resposta incompleta')
        total+=n;if(total>MAX_BYTES)throw new Error('Página grande demais');chunks.push(body.subarray(offset,offset+n));offset+=n+2
      }
      body=new Uint8Array(total);let p=0;for(const chunk of chunks){body.set(chunk,p);p+=chunk.length}
    }
    if(body.length>MAX_BYTES)throw new Error('Página grande demais')
    return new Response([204,205,304].includes(status)?null:body, { status, headers: responseHeaders })
  } finally { signal.removeEventListener('abort', abort); try { conn.close() } catch { /* already closed */ } }
}
// ---------- Download ----------

function motivoHttp(status: number): string {
  if (status === 401 || status === 403 || status === 429) return `A loja bloqueou a leitura automática (HTTP ${status})`
  if (status === 404 || status === 410) return `Página não encontrada na loja (HTTP ${status})`
  if (status >= 500) return `A loja está instável no momento (HTTP ${status})`
  return `A loja respondeu HTTP ${status}`
}

/** Lê o corpo em streaming e para em `max` bytes (o resto é descartado). */
async function lerComLimite(res: Response, max: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array(0)
  const reader = res.body.getReader()
  const partes: Uint8Array[] = []
  let total = 0
  while (total < max) {
    const { done, value } = await reader.read()
    if (done) break
    const sobra = max - total
    const parte = value.byteLength > sobra ? value.subarray(0, sobra) : value
    partes.push(parte)
    total += parte.byteLength
  }
  if (total >= max) await reader.cancel().catch(() => {})
  const out = new Uint8Array(total)
  let pos = 0
  for (const p of partes) {
    out.set(p, pos)
    pos += p.byteLength
  }
  return out
}

function decodificar(bytes: Uint8Array, contentType: string): string {
  let charset = /charset\s*=\s*["']?([\w.:-]+)/i.exec(contentType)?.[1]
  if (!charset) {
    const inicio = new TextDecoder('latin1').decode(bytes.subarray(0, 4096))
    charset = /<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i.exec(inicio)?.[1]
  }
  try {
    return new TextDecoder(charset || 'utf-8').decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

const corta = (s: string | null, max: number): string | null => (s && s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s)

/** Limita tamanhos e aceita só imagem http(s) (nada de javascript:/data:). */
function sanear(p: ParsedProduct): ParsedProduct {
  let imagem = p.imagem_url
  if (imagem) {
    try {
      const u = new URL(imagem)
      imagem = (u.protocol === 'https:' || u.protocol === 'http:') && imagem.length <= MAX_URL_LENGTH ? u.href : null
    } catch {
      imagem = null
    }
  }
  const preco = p.preco_centavos != null && Number.isSafeInteger(p.preco_centavos) && p.preco_centavos >= 0 ? p.preco_centavos : null
  return {
    titulo: corta(p.titulo, 300),
    descricao: corta(p.descricao, 2000),
    imagem_url: imagem,
    preco_centavos: preco,
    loja: corta(p.loja, 120),
  }
}

/**
 * Baixa a página (cabeçalhos de navegador, redirects manuais revalidados, timeout 12 s,
 * no máximo 3 MB) e extrai título/descrição/imagem/preço/loja.
 */
export async function fetchProduct(rawUrl: string): Promise<FetchProductResult> {
  const inicial = validateTargetUrl(rawUrl)
  if (!inicial.ok) return inicial

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    let url = inicial.url
    let res: Response
    for (let salto = 0; ; salto++) {
      res = await Promise.race([
        safeRequest(url, ctrl.signal),
        new Promise<never>((_, reject) => ctrl.signal.addEventListener('abort', () => reject(new Error('Tempo esgotado')), { once: true })),
      ])
      const destino = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
      if (!destino) break
      await res.body?.cancel().catch(() => {})
      if (salto >= MAX_REDIRECTS) return falha('A loja redirecionou vezes demais')
      let proxima: URL
      try {
        proxima = new URL(destino, url)
      } catch {
        return falha('A loja redirecionou para um link inválido')
      }
      const ok = verificarUrl(proxima)
      if (!ok.ok) return falha('A loja redirecionou para um endereço não permitido')
      if (/\/(?:gz\/account-verification|captcha|challenge)(?:\/|$)/i.test(proxima.pathname)) return falha('A loja exige verificação para acessar este produto.')
      url = proxima
    }

    if (!res.ok) {
      await res.body?.cancel().catch(() => {})
      return falha(motivoHttp(res.status))
    }
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType && !/html|xml/i.test(contentType)) {
      await res.body?.cancel().catch(() => {})
      return falha('O link não aponta para uma página de produto')
    }

    const html = decodificar(await lerComLimite(res, MAX_BYTES), contentType)
    const product = sanear(parseProductHtml(html, url.href))
    if (!product.titulo && product.preco_centavos == null) {
      return falha('Não encontramos os dados do produto nesta página')
    }
    return { ok: true, product }
  } catch (error) {
    if (error instanceof Error && error.message === 'Endereço não permitido') return falha(error.message)
    if (ctrl.signal.aborted) return falha('A loja demorou demais para responder')
    return falha('Não foi possível acessar a loja')
  } finally {
    clearTimeout(timer)
  }
}
