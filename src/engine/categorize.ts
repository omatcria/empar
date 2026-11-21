import type { Context, Transaction, TxType } from '@/domain/types'

/**
 * Sugere a categoria mais provável para uma descrição, aprendendo do histórico.
 * Pontua transações do mesmo contexto/tipo por semelhança de texto e devolve
 * a categoria com maior pontuação acumulada.
 */
export function suggestCategory(
  descricao: string,
  transactions: Transaction[],
  contexto: Context,
  tipo: TxType,
): string | undefined {
  const q = descricao.trim().toLowerCase()
  if (q.length < 2) return undefined

  const tokens = q.split(/\s+/).filter((t) => t.length >= 3)
  const score = new Map<string, number>()

  for (const t of transactions) {
    if (t.contexto !== contexto || t.tipo !== tipo) continue
    const d = (t.descricao ?? '').toLowerCase()
    if (!d) continue

    let s = 0
    if (d === q) s += 5
    else if (d.includes(q) || q.includes(d)) s += 3
    for (const tok of tokens) if (d.includes(tok)) s += 1

    if (s > 0) score.set(t.category_id, (score.get(t.category_id) ?? 0) + s)
  }

  let best: string | undefined
  let bestScore = 0
  for (const [id, s] of score) {
    if (s > bestScore) {
      best = id
      bestScore = s
    }
  }
  return best
}
