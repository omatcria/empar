import type {
  Category,
  SystemCategoryKey,
  TransactionInsert,
  TransferKind,
} from '@/domain/types'
import { SYSTEM_CATEGORY } from '@/domain/types'
import type { Cents } from '@/lib/money'

/** Lançamento novo — sem colunas de propriedade (o store preenche user/workspace). */
export type TxNew = Omit<TransactionInsert, 'user_id' | 'workspace_id'>

export type BridgePair = [TxNew, TxNew]

/** Encontra o id de uma categoria de sistema pela sua `chave` (nunca pelo nome). */
export function findSystemCategoryId(
  categories: Category[],
  chave: SystemCategoryKey,
): string | undefined {
  return categories.find((c) => c.chave === chave)?.id
}

export interface BridgeParams {
  userId: string
  valorCentavos: Cents
  data: string // 'YYYY-MM-DD'
  descricao?: string
  accountEmpresarialId: string
  accountPessoalId: string
  categories: Category[]
  pago?: boolean
}

/**
 * A ÚNICA ponte entre EMPRESARIAL e PESSOAL.
 * Gera um par de lançamentos ligados por um mesmo `transfer_id`:
 *   - SAÍDA no contexto EMPRESARIAL (conta PJ)
 *   - ENTRADA no contexto PESSOAL (conta pessoal)
 * Lança uma vez, reflete nos dois lados.
 */
function buildBridge(
  kind: TransferKind,
  saidaChave: SystemCategoryKey,
  entradaChave: SystemCategoryKey,
  p: BridgeParams,
): BridgePair {
  const saidaCat = findSystemCategoryId(p.categories, saidaChave)
  const entradaCat = findSystemCategoryId(p.categories, entradaChave)
  if (!saidaCat || !entradaCat) {
    throw new Error(
      'Categorias de sistema da ponte não encontradas (pró-labore/distribuição).',
    )
  }

  const transferId = crypto.randomUUID()
  const pago = p.pago ?? true

  const saida: TxNew = {
    contexto: 'EMPRESARIAL',
    tipo: 'DESPESA',
    account_id: p.accountEmpresarialId,
    category_id: saidaCat,
    valor_centavos: p.valorCentavos,
    data: p.data,
    descricao: p.descricao ?? rotulo(kind),
    pago,
    transfer_id: transferId,
    transfer_kind: kind,
  }

  const entrada: TxNew = {
    contexto: 'PESSOAL',
    tipo: 'RECEITA',
    account_id: p.accountPessoalId,
    category_id: entradaCat,
    valor_centavos: p.valorCentavos,
    data: p.data,
    descricao: p.descricao ?? rotulo(kind),
    pago,
    transfer_id: transferId,
    transfer_kind: kind,
  }

  return [saida, entrada]
}

function rotulo(kind: TransferKind): string {
  switch (kind) {
    case 'PRO_LABORE':
      return 'Pró-labore'
    case 'DISTRIBUICAO_LUCROS':
      return 'Distribuição de lucros'
    default:
      return 'Transferência'
  }
}

/** Pró-labore: saída EMPRESARIAL + entrada PESSOAL (a ponte principal). */
export function buildProLabore(
  p: BridgeParams,
): BridgePair {
  return buildBridge(
    'PRO_LABORE',
    SYSTEM_CATEGORY.PRO_LABORE_SAIDA,
    SYSTEM_CATEGORY.PRO_LABORE_ENTRADA,
    p,
  )
}

/** Distribuição de lucros: mesma mecânica do pró-labore. */
export function buildDistribuicao(
  p: BridgeParams,
): BridgePair {
  return buildBridge(
    'DISTRIBUICAO_LUCROS',
    SYSTEM_CATEGORY.DISTRIBUICAO_SAIDA,
    SYSTEM_CATEGORY.DISTRIBUICAO_ENTRADA,
    p,
  )
}
