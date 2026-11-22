import { describe, it, expect } from 'vitest'
import type { Category } from '../types'
import { buildCategoryRows, normalizeText, type CategoryRow } from '../category-tree'

function cat(id: string, nome: string, pai: string | null = null): Category {
  return {
    id, nome, categoria_pai_id: pai, chave: null, contexto: 'pessoal', cor: '#000000',
    created_at: '', icone: 'tag', sistema: false, tipo: 'despesa', updated_at: '',
    user_id: 'u', workspace_id: 'w',
  } as Category
}

const cats = [
  cat('a', 'Alimentação'), cat('r', 'Restaurante', 'a'), cat('m', 'Mercado', 'a'),
  cat('t', 'Transporte'), cat('u', 'Uber', 't'), cat('o', 'Órfã', 'fora'),
]
const names = (rows: CategoryRow[]) => rows.map((r) => `${r.depth}:${r.category.nome}`)

describe('normalizeText', () => {
  it('minúsculas, sem acentos, trim', () => {
    expect(normalizeText('  AlimentAção ')).toBe('alimentacao')
  })
})

describe('buildCategoryRows', () => {
  it('sem busca lista tudo hierarquicamente', () => {
    expect(names(buildCategoryRows(cats, ''))).toEqual(['0:Alimentação','1:Mercado','1:Restaurante','0:Órfã','0:Transporte','1:Uber'])
  })
  it('filha que bate traz a mãe como contexto', () => {
    const rest = buildCategoryRows(cats, 'rest')
    expect(names(rest)).toEqual(['0:Alimentação','1:Restaurante'])
    expect(rest[0].match).toBe(false)
    expect(rest[1]).toMatchObject({ match: true, parentName: 'Alimentação' })
  })
  it('mãe que bate traz todas as filhas, ignorando acentos', () => {
    expect(names(buildCategoryRows(cats, 'alimentacao'))).toEqual(['0:Alimentação','1:Mercado','1:Restaurante'])
  })
  it('case-insensitive', () => {
    expect(names(buildCategoryRows(cats, 'UBER'))).toEqual(['0:Transporte','1:Uber'])
  })
  it('sem resultado', () => {
    expect(buildCategoryRows(cats, 'zzz')).toEqual([])
  })
})
