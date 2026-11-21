import type { Category, Transaction } from '@/domain/types'
import { formatBRL, type Cents } from '@/lib/money'

export type MeiNivel = 'ok' | 'atencao' | 'critico' | 'excedido' | 'desenquadrado'

export interface MeiStatus {
  valor: Cents
  limite: Cents
  pct: number
  nivel: MeiNivel
  restante: Cents
}

const ORDEM: MeiNivel[] = ['ok', 'atencao', 'critico', 'excedido', 'desenquadrado']

/** Receita MEI do ano-calendário: EMPRESARIAL/RECEITA, sem pontes e sem categorias de sistema. */
export function meiRevenue(
  txs: Transaction[],
  cats: Category[],
  year: number,
): { realizado: Cents; previsto: Cents } {
  const sistema = new Set(cats.filter((c) => c.sistema).map((c) => c.id))
  const prefix = `${year}-`
  let realizado = 0
  let previsto = 0
  for (const t of txs) {
    if (t.contexto !== 'EMPRESARIAL' || t.tipo !== 'RECEITA') continue
    if (t.transfer_id) continue
    if (t.category_id && sistema.has(t.category_id)) continue
    if (!t.data.startsWith(prefix)) continue
    previsto += t.valor_centavos
    if (t.pago) realizado += t.valor_centavos
  }
  return { realizado, previsto }
}

/** Limite efetivo: proporcional (mês de abertura até dezembro) no ano de abertura. */
export function meiLimit(limiteAnual: Cents, abertura: string | null, year: number): Cents {
  if (!abertura) return limiteAnual
  const ano = Number(abertura.slice(0, 4))
  if (ano !== year) return limiteAnual
  const mes = Number(abertura.slice(5, 7))
  const meses = 12 - mes + 1
  return Math.round((limiteAnual * meses) / 12)
}

export function meiStatus(valor: Cents, limite: Cents): MeiStatus {
  const pct = limite > 0 ? (valor / limite) * 100 : 0
  // comparações em inteiros para evitar erro de ponto flutuante nas fronteiras
  const v100 = valor * 100
  let nivel: MeiNivel
  if (v100 < limite * 70) nivel = 'ok'
  else if (v100 < limite * 90) nivel = 'atencao'
  else if (v100 < limite * 100) nivel = 'critico'
  else if (v100 <= limite * 120) nivel = 'excedido'
  else nivel = 'desenquadrado'
  return { valor, limite, pct, nivel, restante: Math.max(0, limite - valor) }
}

export function meiProjection(
  realizado: Cents,
  limite: Cents,
  todayISO: string,
): { ritmoAnual: Cents; mediaMensalDisponivel: Cents; mesesRestantes: number } {
  const mes = Number(todayISO.slice(5, 7))
  const decorridos = Math.min(12, Math.max(1, mes))
  const mesesRestantes = 12 - decorridos
  const ritmoAnual = Math.round((realizado / decorridos) * 12)
  const restante = Math.max(0, limite - realizado)
  const mediaMensalDisponivel =
    mesesRestantes > 0 ? Math.round(restante / mesesRestantes) : restante
  return { ritmoAnual, mediaMensalDisponivel, mesesRestantes }
}

export function meiMessage(
  status: MeiStatus,
  year: number,
): { titulo: string; texto: string; acao: string } {
  const pct = `${status.pct.toFixed(1).replace('.', ',')}%`
  const valor = formatBRL(status.valor)
  const limite = formatBRL(status.limite)
  const resumo = `O faturamento de ${year} soma ${valor}, ${pct} do limite de ${limite}.`
  const excesso = formatBRL(Math.max(0, status.valor - status.limite))

  switch (status.nivel) {
    case 'ok':
      return {
        titulo: 'Faturamento dentro do limite',
        texto: `${resumo} Ainda restam ${formatBRL(status.restante)} até o teto do MEI.`,
        acao: 'Siga acompanhando mensalmente; nenhuma medida é necessária agora.',
      }
    case 'atencao':
      return {
        titulo: 'Atenção ao limite do MEI',
        texto: `${resumo} Restam ${formatBRL(status.restante)} até o teto anual.`,
        acao: 'Planeje os próximos meses e acompanhe o ritmo de faturamento para não ultrapassar o limite.',
      }
    case 'critico':
      return {
        titulo: 'Limite do MEI próximo do teto',
        texto: `${resumo} Faltam apenas ${formatBRL(status.restante)} para o teto.`,
        acao: 'Avalie postergar recebimentos e converse com seu contador sobre a migração para ME.',
      }
    case 'excedido':
      return {
        titulo: 'Limite do MEI excedido',
        texto: `${resumo} O excesso é de ${excesso}, dentro da tolerância de 20%. Haverá DAS complementar sobre o valor excedente e o desenquadramento do MEI a partir de 1º de janeiro de ${year + 1}.`,
        acao: 'Procure seu contador para apurar o DAS complementar e planejar a migração para ME.',
      }
    case 'desenquadrado':
      return {
        titulo: 'Desenquadramento do MEI',
        texto: `${resumo} O excesso de ${excesso} ultrapassa a tolerância de 20%, o que implica desenquadramento retroativo a janeiro (ou à data de abertura) de ${year}, com tributação como ME sobre todo o período.`,
        acao: 'Procure seu contador imediatamente para regularizar o enquadramento e recalcular os tributos devidos.',
      }
  }
}

/** Novo status caso o lançamento seja salvo; `valorAnterior` é o valor do lançamento em edição. */
export function meiImpact(
  atual: Cents,
  limite: Cents,
  valorNovo: Cents,
  valorAnterior: Cents = 0,
): { antes: MeiStatus; depois: MeiStatus; subiuNivel: boolean } {
  const antes = meiStatus(atual, limite)
  const depois = meiStatus(atual - valorAnterior + valorNovo, limite)
  return {
    antes,
    depois,
    subiuNivel: ORDEM.indexOf(depois.nivel) > ORDEM.indexOf(antes.nivel),
  }
}
