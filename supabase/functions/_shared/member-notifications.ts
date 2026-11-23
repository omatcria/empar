type Cents = number
const formatBRL = (c: Cents) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Avisos de ações de membros (lançamentos e desejos) — builder PURO.
 * O app grava o resultado em `notifications` para os outros membros do espaço.
 */

export type MemberAction = 'criou' | 'editou' | 'excluiu'

export type MemberEvent =
  | {
      kind: 'lancamento'
      acao: MemberAction
      entityId: string
      descricao: string
      tipo: 'RECEITA' | 'DESPESA'
      valorCentavos: Cents
      data: string
      parcelas?: number
      afetadas?: number
    }
  | {
      kind: 'desejo'
      acao: MemberAction
      entityId: string
      titulo: string
      precoCentavos: Cents | null
    }

export interface MemberNotification {
  tipo: 'membro_lancamento' | 'membro_desejo'
  titulo: string
  corpo: string
  meta: { acao: MemberAction; entity_id: string }
}

/** `formatBRL` usa espaço não separável; os avisos usam espaço comum. */
const brl = (c: Cents) => formatBRL(c).replace(/\u00a0/g, ' ')

/** 'YYYY-MM-DD' → 'dd/mm' */
function ddmm(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const VERBO_LANCAMENTO: Record<MemberAction, string> = {
  criou: 'lançou',
  editou: 'editou',
  excluiu: 'excluiu',
}

const VERBO_DESEJO: Record<MemberAction, string> = {
  criou: 'adicionou um desejo',
  editou: 'editou um desejo',
  excluiu: 'excluiu um desejo',
}

export function buildMemberNotification(evt: MemberEvent, autorNome: string): MemberNotification {
  const meta = { acao: evt.acao, entity_id: evt.entityId }

  if (evt.kind === 'desejo') {
    return {
      tipo: 'membro_desejo',
      titulo: `${autorNome} ${VERBO_DESEJO[evt.acao]}: ${evt.titulo}`,
      corpo: evt.precoCentavos == null ? 'Sem preço' : brl(evt.precoCentavos),
      meta,
    }
  }

  const base = evt.descricao.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim() || 'Lançamento'
  const prefixo = `${autorNome} ${VERBO_LANCAMENTO[evt.acao]}:`
  const rotulo = evt.tipo === 'RECEITA' ? 'Receita' : 'Despesa'

  if (evt.acao === 'criou' && evt.parcelas && evt.parcelas > 1) {
    return {
      tipo: 'membro_lancamento',
      titulo: `${prefixo} ${base} (${evt.parcelas}x)`,
      corpo: `${rotulo} de ${brl(evt.valorCentavos)} em ${evt.parcelas} parcelas`,
      meta,
    }
  }

  if (evt.acao !== 'criou' && evt.afetadas && evt.afetadas > 1) {
    const n = evt.parcelas ?? evt.afetadas
    return {
      tipo: 'membro_lancamento',
      titulo: `${prefixo} ${base} (${n}x)`,
      corpo:
        evt.acao === 'editou'
          ? `Alteração em ${evt.afetadas} parcelas`
          : `${evt.afetadas} parcelas removidas`,
      meta,
    }
  }

  return {
    tipo: 'membro_lancamento',
    titulo: `${prefixo} ${base}`,
    corpo: `${rotulo} de ${brl(evt.valorCentavos)} · ${ddmm(evt.data)}`,
    meta,
  }
}
