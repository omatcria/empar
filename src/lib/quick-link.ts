export type QuickAddPreset = { tipo: 'DESPESA' | 'RECEITA'; meio: 'conta' | 'cartao' }

export function parseQuickLink(search: string): QuickAddPreset | null {
  switch (new URLSearchParams(search).get('novo')) {
    case 'despesa': return { tipo: 'DESPESA', meio: 'conta' }
    case 'receita': return { tipo: 'RECEITA', meio: 'conta' }
    case 'cartao': return { tipo: 'DESPESA', meio: 'cartao' }
    default: return null
  }
}
