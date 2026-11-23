export function parseValorToCents(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  let text = String(value).trim().replace(/^R\$\s*/, '')
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text) && !/^\d+\.\d{1,2}$/.test(text)) return null
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) text = text.replace(/\./g, '')
  const [whole, fraction = ''] = text.split('.')
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  return cents > 0n && cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null
}

export function parseMeio(value: unknown): { kind: 'conta' | 'cartao'; id: string } | null {
  if (typeof value !== 'string') return null
  const match = /^(conta|cartao):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(value)
  return match ? { kind: match[1] as 'conta' | 'cartao', id: match[2] } : null
}

export function quickAddMessage(tipo: 'despesa' | 'receita', centavos: number, descricao: string): string {
  const valor = (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ')
  return `${tipo === 'receita' ? 'Receita' : 'Despesa'} de ${valor} lançada: ${descricao}`
}

export function meioLabel(kind: 'conta' | 'cartao', nome: string, contexto: string): string {
  return `${kind === 'conta' ? 'Conta' : 'Cartão'} · ${nome} (${contexto === 'PESSOAL' ? 'Pessoal' : 'Empresarial'})`
}

export function categoriaLabel(nome: string, pai?: string | null): string {
  return pai ? `${pai} › ${nome}` : nome
}
