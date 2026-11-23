import type {
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
} from '@/lib/database.types'

/* ---------- Enums de domínio ---------- */
export type Context = Enums<'context_enum'> // 'PESSOAL' | 'EMPRESARIAL'
export type TxType = Enums<'tx_type_enum'> // 'RECEITA' | 'DESPESA'
export type AccountType = Enums<'account_type_enum'>
export type CardKind = Enums<'card_kind_enum'>
export type TransferKind = Enums<'transfer_kind_enum'>
export type RecurrenceFreq = Enums<'recurrence_freq_enum'>
export type GoalPreset = Enums<'goal_preset_enum'>
export type MemberRole = Enums<'member_role'> // 'owner' | 'editor' | 'viewer'

/** Modo de visualização global: os dois universos + a soma. */
export type ViewMode = Context | 'CONSOLIDADO'

/* ---------- Entidades (Row) ---------- */
export type Profile = Tables<'profiles'>
export type Account = Tables<'accounts'>
export type Card = Tables<'cards'>
export type Invoice = Tables<'invoices'>
export type Category = Tables<'categories'>
export type Recurrence = Tables<'recurrences'>
export type Transaction = Tables<'transactions'>
export type Budget = Tables<'budgets'>
export type Goal = Tables<'goals'>
export type TaxProvision = Tables<'tax_provisions'>
export type Workspace = Tables<'workspaces'>
export type WorkspaceMember = Tables<'workspace_members'> & {
  avatar_url?: string | null
}
export type WorkspaceInvite = Tables<'workspace_invites'>
export type ActivityLog = Tables<'activity_log'>
export type Notification = Tables<'notifications'>
export type NotificationPref = Tables<'notification_prefs'>
export type PushSubscriptionRow = Tables<'push_subscriptions'>
export type TransactionReaction = Tables<'transaction_reactions'>
export type ReactionEmoji = Enums<'reaction_emoji'>
export type Investment = Tables<'investments'>
export type InvestmentMovement = Tables<'investment_movements'>
/** Dívida (acordo) — módulo isolado: nunca gera transações nem entra em saldos. */
export type Debt = Tables<'debts'>
export type DebtInstallment = Tables<'debt_installments'>
export type WishlistCategory = Tables<'wishlist_categories'>
export type WishlistItem = Tables<'wishlist_items'>
/** Ponto do histórico de preço de um item da lista de desejos. */
export type WishlistPricePoint = Tables<'wishlist_price_history'>

/** Tipo de produto de investimento. */
export type InvestmentTipo =
  | 'CDB'
  | 'TESOURO'
  | 'LCI_LCA'
  | 'ACOES'
  | 'FUNDO'
  | 'CRIPTO'
  | 'POUPANCA'
  | 'OUTRO'

/** Como o rendimento é calculado (interpreta o campo `taxa`). */
export type InvestmentForma = 'CDI_PERCENT' | 'PREFIXADO' | 'CDI_SPREAD' | 'NENHUM'

/** Aporte (entra) ou resgate (sai). */
export type MovimentoTipo = 'aporte' | 'resgate'

/** Espaço + o papel do usuário atual nele. */
export interface WorkspaceWithRole extends Workspace {
  role: MemberRole
}

/* ---------- Insert ---------- */
export type AccountInsert = TablesInsert<'accounts'>
export type CardInsert = TablesInsert<'cards'>
export type InvoiceInsert = TablesInsert<'invoices'>
export type CategoryInsert = TablesInsert<'categories'>
export type RecurrenceInsert = TablesInsert<'recurrences'>
export type TransactionInsert = TablesInsert<'transactions'>
export type BudgetInsert = TablesInsert<'budgets'>
export type PushSubscriptionInsert = TablesInsert<'push_subscriptions'>
export type GoalInsert = TablesInsert<'goals'>
export type TaxProvisionInsert = TablesInsert<'tax_provisions'>
export type DebtInsert = TablesInsert<'debts'>
export type DebtInstallmentInsert = TablesInsert<'debt_installments'>
export type WishlistCategoryInsert = TablesInsert<'wishlist_categories'>
export type WishlistItemInsert = TablesInsert<'wishlist_items'>
export type WishlistPricePointInsert = TablesInsert<'wishlist_price_history'>

/* ---------- Update ---------- */
export type AccountUpdate = TablesUpdate<'accounts'>
export type CardUpdate = TablesUpdate<'cards'>
export type CategoryUpdate = TablesUpdate<'categories'>
export type RecurrenceUpdate = TablesUpdate<'recurrences'>
export type TransactionUpdate = TablesUpdate<'transactions'>
export type BudgetUpdate = TablesUpdate<'budgets'>
export type GoalUpdate = TablesUpdate<'goals'>
export type TaxProvisionUpdate = TablesUpdate<'tax_provisions'>
export type WorkspaceUpdate = TablesUpdate<'workspaces'>
export type DebtUpdate = TablesUpdate<'debts'>
export type DebtInstallmentUpdate = TablesUpdate<'debt_installments'>
export type WishlistCategoryUpdate = TablesUpdate<'wishlist_categories'>
export type WishlistItemUpdate = TablesUpdate<'wishlist_items'>
export type ActivityLogInsert = TablesInsert<'activity_log'>
export type NotificationInsert = TablesInsert<'notifications'>
export type NotificationPrefUpdate = TablesUpdate<'notification_prefs'>
export type TransactionReactionInsert = TablesInsert<'transaction_reactions'>
export type InvestmentInsert = TablesInsert<'investments'>
export type InvestmentUpdate = TablesUpdate<'investments'>
export type InvestmentMovementInsert = TablesInsert<'investment_movements'>

/**
 * Chaves das categorias de SISTEMA — a engine encontra a categoria da ponte
 * (pró-labore / distribuição / impostos) por `chave`, nunca pelo nome.
 */
export const SYSTEM_CATEGORY = {
  PRO_LABORE_SAIDA: 'PRO_LABORE_SAIDA',
  PRO_LABORE_ENTRADA: 'PRO_LABORE_ENTRADA',
  DISTRIBUICAO_SAIDA: 'DISTRIBUICAO_SAIDA',
  DISTRIBUICAO_ENTRADA: 'DISTRIBUICAO_ENTRADA',
  IMPOSTOS: 'IMPOSTOS',
} as const

export type SystemCategoryKey =
  (typeof SYSTEM_CATEGORY)[keyof typeof SYSTEM_CATEGORY]
