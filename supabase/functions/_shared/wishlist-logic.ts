// Lógica pura de desejos. Sem imports: usada pelo app (Vite) e pelas Edge Functions (Deno).

/** `https://www.achar.promo/` + URL sem http(s):// e sem `www.` inicial; resto preservado byte a byte. */
export function acharPromoUrl(url: string): string {
  const semProtocolo = url.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  return 'https://www.achar.promo/' + semProtocolo
}

export type PriceAlert = 'queda' | 'alvo' | null

/** Preços em centavos. 'alvo' tem precedência sobre 'queda'. */
export function priceAlert(anterior: number | null, novo: number | null, alvo: number | null): PriceAlert {
  if (novo == null) return null
  if (alvo != null && novo <= alvo && (anterior == null || anterior > alvo)) return 'alvo'
  if (anterior != null && anterior > 0 && novo * 100 <= anterior * 95) return 'queda'
  return null
}

export function priceStats(
  pontos: { preco_centavos: number; verificado_em: string }[],
  inicial: number | null,
): { min: number | null; max: number | null; variacaoPct: number | null; isLowest: boolean } {
  if (pontos.length === 0) return { min: null, max: null, variacaoPct: null, isLowest: false }
  const ordenados = [...pontos].sort((a, b) => a.verificado_em.localeCompare(b.verificado_em))
  const valores = ordenados.map((p) => p.preco_centavos)
  if (inicial != null) valores.push(inicial)
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const atual = ordenados[ordenados.length - 1].preco_centavos
  const base = inicial ?? ordenados[0].preco_centavos
  const variacaoPct = base > 0 ? ((atual - base) / base) * 100 : null
  return { min, max, variacaoPct, isLowest: min < max && atual <= min }
}
