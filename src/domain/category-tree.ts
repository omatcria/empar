import type { Category } from './types'

/** Minúsculas, sem acentos, sem espaços nas pontas. */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

export interface CategoryRow {
  category: Category
  depth: 0 | 1
  parentName?: string
  match: boolean
}

const byName = (a: Category, b: Category) => a.nome.localeCompare(b.nome, 'pt-BR')

/**
 * Linhas hierárquicas (mãe → filhas) para o seletor de categoria.
 * Raiz = sem mãe ou com mãe ausente da lista (órfã). Com busca, a mãe entra se
 * ela bate (com todas as filhas) ou se alguma filha bate (só as que batem).
 */
export function buildCategoryRows(categories: Category[], query: string): CategoryRow[] {
  const ids = new Set(categories.map((c) => c.id))
  const roots = categories.filter((c) => !c.categoria_pai_id || !ids.has(c.categoria_pai_id)).sort(byName)
  const q = normalizeText(query)
  const hits = (c: Category) => normalizeText(c.nome).includes(q)
  const rows: CategoryRow[] = []

  for (const root of roots) {
    const children = categories.filter((c) => c.categoria_pai_id === root.id).sort(byName)
    if (!q) {
      rows.push({ category: root, depth: 0, match: true })
      for (const ch of children) rows.push({ category: ch, depth: 1, parentName: root.nome, match: true })
      continue
    }
    const rootMatch = hits(root)
    const shown = rootMatch ? children : children.filter(hits)
    if (!rootMatch && shown.length === 0) continue
    rows.push({ category: root, depth: 0, match: rootMatch })
    for (const ch of shown) rows.push({ category: ch, depth: 1, parentName: root.nome, match: hits(ch) })
  }
  return rows
}
