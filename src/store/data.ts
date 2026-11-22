import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { useAuth } from './auth'
import { ownerCols } from './owner'
import { useDebts } from './debts'
import { useWishlist } from './wishlist'
import { useNotifications } from './notifications'
import type {
  Account,
  AccountInsert,
  AccountUpdate,
  ActivityLog,
  Budget,
  BudgetInsert,
  Card,
  CardInsert,
  CardUpdate,
  Category,
  CategoryInsert,
  CategoryUpdate,
  Context,
  Goal,
  GoalInsert,
  GoalUpdate,
  Investment,
  InvestmentInsert,
  InvestmentUpdate,
  InvestmentMovement,
  InvestmentMovementInsert,
  Invoice,
  Profile,
  Recurrence,
  RecurrenceInsert,
  RecurrenceUpdate,
  TaxProvision,
  TaxProvisionUpdate,
  Transaction,
  TransactionInsert,
  TransactionUpdate,
  TxType,
} from '@/domain/types'
import type { InvoiceCycle } from '@/engine/invoices'
import { buildInstallmentPlan, resolveInvoiceCycle } from '@/engine/invoices'
import {
  buildRecurrenceTx,
  dueOccurrences,
  resolveRecurrenceTarget,
  type RecurrenceTemplate,
} from '@/engine/recurrences'
import { todayISO, uid } from '@/lib/cn'

export interface CardPurchaseParams {
  cardId: string
  contexto: Context
  category_id: string
  valor_centavos: number
  data: string
  descricao: string
  tipo?: TxType
  parcelas?: number
  /** Recorrência de origem (gravado só em compra à vista). */
  recorrencia_id?: string
}

function requireUserId(): string {
  const id = useAuth.getState().user?.id
  if (!id) throw new Error('Usuário não autenticado')
  return id
}

interface DataState {
  loading: boolean
  loaded: boolean
  error: string | null
  workspaceId: string | null

  profile: Profile | null
  accounts: Account[]
  cards: Card[]
  invoices: Invoice[]
  categories: Category[]
  recurrences: Recurrence[]
  transactions: Transaction[]
  budgets: Budget[]
  goals: Goal[]
  provisions: TaxProvision[]
  activityLog: ActivityLog[]
  investments: Investment[]
  investmentMovements: InvestmentMovement[]

  loadAll: (workspaceId: string) => Promise<void>
  reset: () => void
  /** Apaga todos os dados do espaço (RPC, só dono) e recarrega as stores. */
  resetWorkspace: () => Promise<void>

  // Perfil
  updateProfile: (patch: Partial<Profile>) => Promise<void>
  completeOnboarding: () => Promise<void>

  // Contas
  addAccount: (input: Omit<AccountInsert, 'user_id' | 'workspace_id'>) => Promise<Account>
  updateAccount: (id: string, patch: AccountUpdate) => Promise<void>
  archiveAccount: (id: string) => Promise<void>

  // Cartões
  addCard: (input: Omit<CardInsert, 'user_id' | 'workspace_id'>) => Promise<Card>
  updateCard: (id: string, patch: CardUpdate) => Promise<void>
  archiveCard: (id: string) => Promise<void>

  // Categorias
  addCategory: (input: Omit<CategoryInsert, 'user_id' | 'workspace_id'>) => Promise<Category>
  updateCategory: (id: string, patch: CategoryUpdate) => Promise<void>
  deleteCategory: (id: string) => Promise<void>

  // Transações
  addTransaction: (
    input: Omit<TransactionInsert, 'user_id' | 'workspace_id'>,
  ) => Promise<Transaction>
  addTransactions: (
    inputs: Omit<TransactionInsert, 'user_id' | 'workspace_id'>[],
  ) => Promise<Transaction[]>
  updateTransaction: (id: string, patch: TransactionUpdate) => Promise<void>
  updateTransactionGroup: (id: string, patch: TransactionUpdate, mode: 'THIS' | 'THIS_AND_FUTURE' | 'ALL') => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  deleteTransactionGroup: (id: string, mode: 'THIS' | 'ALL') => Promise<void>
  togglePago: (id: string) => Promise<void>

  // Compra no cartão (crédito): resolve fatura + parcelas
  addCardPurchase: (params: CardPurchaseParams) => Promise<void>

  // Faturas
  ensureInvoice: (cardId: string, cycle: InvoiceCycle) => Promise<Invoice>
  payInvoice: (id: string, paga?: boolean, accountId?: string | null) => Promise<void>
  resyncInvoices: () => Promise<void>

  // Orçamentos
  upsertBudget: (input: Omit<BudgetInsert, 'user_id' | 'workspace_id'>) => Promise<void>
  deleteBudget: (id: string) => Promise<void>

  // Provisões
  updateProvision: (id: string, patch: TaxProvisionUpdate) => Promise<void>

  // Metas
  addGoal: (input: Omit<GoalInsert, 'user_id' | 'workspace_id'>) => Promise<Goal>
  updateGoal: (id: string, patch: GoalUpdate) => Promise<void>
  deleteGoal: (id: string) => Promise<void>

  // Recorrências
  addRecurrence: (input: Omit<RecurrenceInsert, 'user_id' | 'workspace_id'>) => Promise<Recurrence>
  updateRecurrence: (id: string, patch: RecurrenceUpdate) => Promise<void>
  deleteRecurrence: (id: string) => Promise<void>
  runDueRecurrences: () => Promise<void>

  // Histórico de Atividades
  logActivity: (entity: string, action: string, entity_id: string, meta?: any) => Promise<void>
  loadActivity: () => Promise<void>

  // Investimentos
  addInvestment: (input: Omit<InvestmentInsert, 'user_id' | 'workspace_id'>) => Promise<Investment>
  updateInvestment: (id: string, patch: InvestmentUpdate) => Promise<void>
  deleteInvestment: (id: string) => Promise<void>
  addMovement: (input: Omit<InvestmentMovementInsert, 'user_id' | 'workspace_id'>) => Promise<void>
  deleteMovement: (id: string) => Promise<void>
}

let dueRecurrencesInFlight: Promise<void> | null = null

export const useData = create<DataState>((set, get) => ({
  loading: false,
  loaded: false,
  error: null,
  workspaceId: null,
  profile: null,
  accounts: [],
  cards: [],
  invoices: [],
  categories: [],
  recurrences: [],
  transactions: [],
  budgets: [],
  goals: [],
  provisions: [],
  activityLog: [],
  investments: [],
  investmentMovements: [],

  loadAll: async (workspaceId) => {
    set({ loading: true, error: null, workspaceId })
    try {
      const [
        profile,
        accounts,
        cards,
        invoices,
        categories,
        recurrences,
        transactions,
        budgets,
        goals,
        provisions,
        investments,
        investmentMovements,
      ] = await Promise.all([
        supabase.from('profiles').select('*').maybeSingle(),
        supabase.from('accounts').select('*').eq('workspace_id', workspaceId).order('created_at'),
        supabase.from('cards').select('*').eq('workspace_id', workspaceId).order('created_at'),
        supabase.from('invoices').select('*').eq('workspace_id', workspaceId),
        supabase.from('categories').select('*').eq('workspace_id', workspaceId).order('nome'),
        supabase.from('recurrences').select('*').eq('workspace_id', workspaceId),
        supabase
          .from('transactions')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('data', { ascending: false }),
        supabase.from('budgets').select('*').eq('workspace_id', workspaceId),
        supabase.from('goals').select('*').eq('workspace_id', workspaceId),
        supabase.from('tax_provisions').select('*').eq('workspace_id', workspaceId).order('nome'),
        supabase.from('investments').select('*').eq('workspace_id', workspaceId).order('created_at'),
        supabase.from('investment_movements').select('*').eq('workspace_id', workspaceId),
      ])

      const firstError =
        profile.error ||
        accounts.error ||
        cards.error ||
        invoices.error ||
        categories.error ||
        recurrences.error ||
        transactions.error ||
        budgets.error ||
        goals.error ||
        provisions.error ||
        investments.error ||
        investmentMovements.error
      if (firstError) throw firstError

      set({
        profile: profile.data ?? null,
        accounts: accounts.data ?? [],
        cards: cards.data ?? [],
        invoices: invoices.data ?? [],
        categories: categories.data ?? [],
        recurrences: recurrences.data ?? [],
        transactions: transactions.data ?? [],
        budgets: budgets.data ?? [],
        goals: goals.data ?? [],
        provisions: provisions.data ?? [],
        investments: investments.data ?? [],
        investmentMovements: investmentMovements.data ?? [],
        loaded: true,
        loading: false,
      })

      // Gera lançamentos de recorrências vencidas (salário, pró-labore, assinaturas)
      try {
        await get().runDueRecurrences()
      } catch (e) {
        console.error('Falha ao processar recorrências:', e)
      }
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  reset: () =>
    set({
      loaded: false,
      workspaceId: null,
      profile: null,
      accounts: [],
      cards: [],
      invoices: [],
      categories: [],
      recurrences: [],
      transactions: [],
      budgets: [],
      goals: [],
      provisions: [],
      activityLog: [],
      investments: [],
      investmentMovements: [],
    }),

  resetWorkspace: async () => {
    const ws = get().workspaceId
    if (!ws) throw new Error('Espaço de trabalho não carregado')
    const imagePaths: string[] = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from('wishlist_items').select('imagem_url').eq('workspace_id', ws).order('id').range(offset, offset + 999)
      if (error) throw new Error('Não foi possível preparar a remoção das imagens. Nenhum dado foi apagado.')
      imagePaths.push(...data.flatMap(item => item.imagem_url?.startsWith('wishlist-storage:') ? [item.imagem_url.slice('wishlist-storage:'.length)] : []))
      if (data.length < 1000) break
    }
    const { error } = await supabase.rpc('reset_workspace_data', { _ws: ws })
    if (error) throw new Error(error.message)
    try {
      for (let offset = 0; offset < imagePaths.length; offset += 100) {
        const result = await supabase.storage.from('wishlist-images').remove(imagePaths.slice(offset, offset + 100))
        if (result.error) throw new Error('Falha ao remover imagens')
      }
      await get().loadAll(ws)
      if (get().error) throw new Error(get().error!)
      await Promise.all([
        useDebts.getState().load(ws),
        useWishlist.getState().load(ws),
        useNotifications.getState().load(),
      ])
    } catch {
      throw new Error('Os dados foram apagados, mas houve uma falha ao remover imagens ou recarregar. Atualize a página; não repita o reset.')
    }
  },

  /* -------- Perfil -------- */
  updateProfile: async (patch) => {
    const uid = requireUserId()
    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', uid)
      .select()
      .single()
    if (error) throw error
    set({ profile: data })
  },

  completeOnboarding: async () => {
    await get().updateProfile({ onboarding_completo: true })
  },

  /* -------- Contas -------- */
  addAccount: async (input) => {
    const { data, error } = await supabase
      .from('accounts')
      .insert({ ...input, ...ownerCols() })
      .select()
      .single()
    if (error) throw error
    set((s) => ({ accounts: [...s.accounts, data] }))
    return data
  },
  updateAccount: async (id, patch) => {
    const { data, error } = await supabase
      .from('accounts')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? data : a)) }))
  },
  archiveAccount: async (id) => {
    await get().updateAccount(id, { arquivada: true })
  },

  /* -------- Cartões -------- */
  addCard: async (input) => {
    const { data, error } = await supabase
      .from('cards')
      .insert({ ...input, ...ownerCols() })
      .select()
      .single()
    if (error) throw error
    set((s) => ({ cards: [...s.cards, data] }))
    return data
  },
  updateCard: async (id, patch) => {
    const { data, error } = await supabase
      .from('cards')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    set((s) => ({ cards: s.cards.map((c) => (c.id === id ? data : c)) }))
  },
  archiveCard: async (id) => {
    await get().updateCard(id, { arquivado: true })
  },

  /* -------- Categorias -------- */
  addCategory: async (input) => {
    const { data, error } = await supabase
      .from('categories')
      .insert({ ...input, ...ownerCols() })
      .select()
      .single()
    if (error) throw error
    set((s) => ({ categories: [...s.categories, data] }))
    return data
  },
  updateCategory: async (id, patch) => {
    const { data, error } = await supabase
      .from('categories')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    set((s) => ({
      categories: s.categories.map((c) => (c.id === id ? data : c)),
    }))
  },
  deleteCategory: async (id) => {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) throw error
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }))
  },

  /* -------- Transações -------- */
  addTransaction: async (input) => {
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...input, ...ownerCols() })
      .select()
      .single()
    if (error) throw error
    set((s) => ({ transactions: [data, ...s.transactions] }))
    get().logActivity('transaction', 'create', data.id, { descricao: data.descricao })
    return data
  },
  addTransactions: async (inputs) => {
    const cols = ownerCols()
    const { data, error } = await supabase
      .from('transactions')
      .insert(inputs.map((i) => ({ ...i, ...cols })))
      .select()
    if (error) throw error
    set((s) => ({ transactions: [...(data ?? []), ...s.transactions] }))
    if (data) {
      data.forEach(t => get().logActivity('transaction', 'create', t.id, { descricao: t.descricao }))
    }
    return data ?? []
  },
  updateTransaction: async (id, patch) => {
    const old = get().transactions.find(t => t.id === id)
    if (!old) return

    const finalPatch = { ...patch }
    const cardId = patch.card_id !== undefined ? patch.card_id : old.card_id
    const dataIso = patch.data !== undefined ? patch.data : old.data

    if (cardId) {
      const card = get().cards.find(c => c.id === cardId)
      if (card && dataIso) {
        const cycle = resolveInvoiceCycle(card.dia_fechamento, card.dia_vencimento, dataIso)
        const inv = await get().ensureInvoice(card.id, cycle)
        finalPatch.invoice_id = inv.id
        finalPatch.account_id = null
      }
    } else if (patch.account_id) {
      finalPatch.invoice_id = null
    }

    const { data, error } = await supabase
      .from('transactions')
      .update(finalPatch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    set((s) => ({
      transactions: s.transactions.map((t) => (t.id === id ? data : t)),
    }))
    get().logActivity('transaction', 'update', id, finalPatch)
  },
  
  updateTransactionGroup: async (id, patch, mode) => {
    const old = get().transactions.find(t => t.id === id)
    if (!old) return
    
    if (!old.parcela_group_id || mode === 'THIS') {
       await get().updateTransaction(id, patch)
       return
    }

    let groupTxs = get().transactions.filter(t => t.parcela_group_id === old.parcela_group_id)
    if (mode === 'THIS_AND_FUTURE') {
       groupTxs = groupTxs.filter(t => t.parcela_n !== null && old.parcela_n !== null && t.parcela_n >= old.parcela_n)
    }
    
    for (const tx of groupTxs) {
       const txPatch = { ...patch }
       if (tx.id !== id) {
          delete txPatch.data
          delete txPatch.pago
       }
       await get().updateTransaction(tx.id, txPatch)
    }
  },
  deleteTransaction: async (id) => {
    const t = get().transactions.find(x => x.id === id)
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) throw error
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }))
    if (t) get().logActivity('transaction', 'delete', id, { descricao: t.descricao })
  },
  deleteTransactionGroup: async (id, mode) => {
    const t = get().transactions.find((x) => x.id === id)
    if (!t) return
    // Sem grupo (não parcelado) ou "só esta" → exclui apenas a transação.
    if (mode === 'THIS' || !t.parcela_group_id) {
      await get().deleteTransaction(id)
      return
    }
    // "Todas as parcelas" → exclui o grupo inteiro de uma vez.
    const groupIds = get()
      .transactions.filter((x) => x.parcela_group_id === t.parcela_group_id)
      .map((x) => x.id)
    const { error } = await supabase.from('transactions').delete().in('id', groupIds)
    if (error) throw error
    const idSet = new Set(groupIds)
    set((s) => ({ transactions: s.transactions.filter((x) => !idSet.has(x.id)) }))
    get().logActivity('transaction', 'delete', t.parcela_group_id, {
      descricao: t.descricao,
      parcelas: groupIds.length,
    })
  },
  togglePago: async (id) => {
    const t = get().transactions.find((x) => x.id === id)
    if (!t) return
    await get().updateTransaction(id, { pago: !t.pago })
  },

  /* -------- Compra no cartão de crédito -------- */
  addCardPurchase: async (p) => {
    const card = get().cards.find((c) => c.id === p.cardId)
    if (!card) throw new Error('Cartão não encontrado')
    const tipo = p.tipo ?? 'DESPESA'
    const n = Math.max(1, p.parcelas ?? 1)

    if (n === 1) {
      const cycle = resolveInvoiceCycle(
        card.dia_fechamento,
        card.dia_vencimento,
        p.data,
      )
      const inv = await get().ensureInvoice(p.cardId, cycle)
      await get().addTransaction({
        contexto: p.contexto,
        tipo,
        card_id: p.cardId,
        invoice_id: inv.id,
        category_id: p.category_id,
        valor_centavos: p.valor_centavos,
        data: p.data,
        descricao: p.descricao,
        pago: true,
        ...(p.recorrencia_id ? { recorrencia_id: p.recorrencia_id } : {}),
      })
      return
    }

    // Parcelado: cada parcela cai na fatura do seu ciclo
    const plan = buildInstallmentPlan(
      card.dia_fechamento,
      card.dia_vencimento,
      p.data,
      p.valor_centavos,
      n,
    )
    const groupId = uid()
    const inserts: Omit<TransactionInsert, 'user_id' | 'workspace_id'>[] = []
    
    // Import addMonths and parseISO dynamically or ensure they are imported at the top
    // Wait, date-fns is already used in invoices.ts, let's just use a simple date shift or we can import them.
    // Actually, I can just use JS Date for this.
    const [y, m, d] = p.data.split('-').map(Number)

    for (let i = 0; i < plan.length; i++) {
      const item = plan[i]
      const inv = await get().ensureInvoice(p.cardId, {
        mesReferencia: item.mesReferencia,
        dataFechamento: item.dataFechamento,
        dataVencimento: item.dataVencimento,
      })
      
      // Shift date by i months to make them appear in subsequent months
      const dateObj = new Date(y, m - 1 + i, d)
      // JS Date auto-corrects overflow (e.g., Jan 31 + 1 month = Mar 3 if Feb has 28 days)
      // To prevent jumping to next month, we cap the day to the target month's max days
      const targetMonth = (m - 1 + i) % 12
      while (dateObj.getMonth() !== targetMonth && dateObj.getMonth() !== (targetMonth < 0 ? targetMonth + 12 : targetMonth)) {
        dateObj.setDate(dateObj.getDate() - 1)
      }
      const dataParcela = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`

      inserts.push({
        contexto: p.contexto,
        tipo,
        card_id: p.cardId,
        invoice_id: inv.id,
        category_id: p.category_id,
        valor_centavos: item.valorCentavos,
        data: dataParcela,
        descricao: `${p.descricao} (${item.parcelaN}/${item.parcelaTotal})`,
        pago: true,
        parcela_n: item.parcelaN,
        parcela_total: item.parcelaTotal,
        parcela_group_id: groupId,
      })
    }
    await get().addTransactions(inserts)
  },

  /* -------- Faturas -------- */
  ensureInvoice: async (cardId, cycle) => {
    const existing = get().invoices.find(
      (i) => i.card_id === cardId && i.mes_referencia === cycle.mesReferencia,
    )
    if (existing) return existing
    const { data, error } = await supabase
      .from('invoices')
      .insert({
        ...ownerCols(),
        card_id: cardId,
        mes_referencia: cycle.mesReferencia,
        data_fechamento: cycle.dataFechamento,
        data_vencimento: cycle.dataVencimento,
      })
      .select()
      .single()
    if (error) throw error
    set((s) => ({ invoices: [...s.invoices, data] }))
    return data
  },
  payInvoice: async (id, paga = true, accountId = null) => {
    const { data, error } = await supabase
      .from('invoices')
      .update({ paga, paid_account_id: paga ? accountId : null })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? data : i)) }))
  },

  resyncInvoices: async () => {
    const transactions = get().transactions
    const cards = get().cards

    for (const t of transactions) {
      if (!t.card_id) continue
      const card = cards.find(c => c.id === t.card_id)
      if (!card) continue

      const cycle = resolveInvoiceCycle(card.dia_fechamento, card.dia_vencimento, t.data)
      const inv = await get().ensureInvoice(card.id, cycle)
      
      if (t.invoice_id !== inv.id) {
         await supabase.from('transactions').update({ invoice_id: inv.id }).eq('id', t.id)
      }
    }
    
    const ws = get().workspaceId
    if (ws) {
      await get().loadAll(ws)
    }
  },

  /* -------- Orçamentos -------- */
  upsertBudget: async (input) => {
    // Limite zerado = remover o orçamento (não deixar linha vestigial).
    if (!input.limite_centavos || input.limite_centavos <= 0) {
      const existing = get().budgets.find(
        (b) => b.category_id === input.category_id && b.mes_referencia === input.mes_referencia,
      )
      if (existing) await get().deleteBudget(existing.id)
      return
    }
    const { data, error } = await supabase
      .from('budgets')
      .upsert(
        { ...input, ...ownerCols() },
        { onConflict: 'workspace_id,category_id,mes_referencia' },
      )
      .select()
      .single()
    if (error) throw error
    set((s) => {
      const rest = s.budgets.filter((b) => b.id !== data.id)
      return { budgets: [...rest, data] }
    })
  },
  deleteBudget: async (id) => {
    const { error } = await supabase.from('budgets').delete().eq('id', id)
    if (error) throw error
    set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id) }))
  },

  /* -------- Provisões -------- */
  updateProvision: async (id, patch) => {
    const { data, error } = await supabase
      .from('tax_provisions')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    set((s) => ({
      provisions: s.provisions.map((p) => (p.id === id ? data : p)),
    }))
  },

  /* -------- Metas -------- */
  addGoal: async (input) => {
    const { data, error } = await supabase
      .from('goals')
      .insert({ ...input, ...ownerCols() })
      .select()
      .single()
    if (error) throw error
    set((s) => ({ goals: [...s.goals, data] }))
    return data
  },
  updateGoal: async (id, patch) => {
    const { data, error } = await supabase
      .from('goals')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    set((s) => ({ goals: s.goals.map((g) => (g.id === id ? data : g)) }))
  },
  deleteGoal: async (id) => {
    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (error) throw error
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }))
  },

  /* -------- Recorrências -------- */
  addRecurrence: async (input) => {
    const { data, error } = await supabase
      .from('recurrences')
      .insert({ ...input, ...ownerCols() })
      .select()
      .single()
    if (error) throw error
    set((s) => ({ recurrences: [...s.recurrences, data] }))
    // gera imediatamente se já estiver vencida; falha aqui não pode desfazer a criação
    try {
      await get().runDueRecurrences()
    } catch (e) {
      console.error('Falha ao gerar recorrências após criar', e)
    }
    return data
  },
  updateRecurrence: async (id, patch) => {
    const { data, error } = await supabase
      .from('recurrences')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    set((s) => ({ recurrences: s.recurrences.map((r) => (r.id === id ? data : r)) }))
  },
  deleteRecurrence: async (id) => {
    const { error } = await supabase.from('recurrences').delete().eq('id', id)
    if (error) throw error
    set((s) => ({ recurrences: s.recurrences.filter((r) => r.id !== id) }))
  },

  /** Gera as transações devidas de todas as recorrências ativas e avança as datas. */
  runDueRecurrences: () => {
    // execução única: chamadas simultâneas reaproveitam a promise em andamento
    if (dueRecurrencesInFlight) return dueRecurrencesInFlight
    const p = (async () => {
    const today = todayISO()
    const recs = get().recurrences.filter((r) => r.ativo)
    for (const r of recs) {
      const { dates, novaProxima } = dueOccurrences(
        r.proxima_data,
        r.frequencia,
        r.dia,
        today,
      )
      if (dates.length === 0) continue
      const tpl = r.template as unknown as RecurrenceTemplate
      const target = resolveRecurrenceTarget(tpl, get().accounts, get().cards)
      if (!target) continue
      const inserts: Omit<TransactionInsert, 'user_id' | 'workspace_id'>[] = []
      for (const data of dates) {
        const tx = buildRecurrenceTx(tpl, target, r.contexto, data, r.id)
        if (target.kind === 'cartao') {
          const cycle = resolveInvoiceCycle(
            target.card.dia_fechamento,
            target.card.dia_vencimento,
            data,
          )
          const inv = await get().ensureInvoice(target.card.id, cycle)
          tx.invoice_id = inv.id
        }
        inserts.push(tx)
      }
      await get().addTransactions(inserts)
      await get().updateRecurrence(r.id, { proxima_data: novaProxima })
    }
    })().finally(() => {
      dueRecurrencesInFlight = null
    })
    dueRecurrencesInFlight = p
    return p
  },

  logActivity: async (entity, action, entity_id, meta) => {
    try {
      const { data } = await supabase
        .from('activity_log')
        .insert({
          ...ownerCols(),
          entity,
          action,
          entity_id,
          meta,
        })
        .select()
        .single()
      // Mantém o feed em dia sem refetch (se já estiver carregado).
      if (data) set((s) => ({ activityLog: [data, ...s.activityLog].slice(0, 50) }))
    } catch (e) {
      console.error('Failed to log activity:', e)
    }
  },

  loadActivity: async () => {
    const ws = get().workspaceId
    if (!ws) return
    const { data } = await supabase
      .from('activity_log')
      .select('*')
      .eq('workspace_id', ws)
      .order('at', { ascending: false })
      .limit(50)
    set({ activityLog: data ?? [] })
  },

  /* -------- Investimentos -------- */
  addInvestment: async (input) => {
    const { data, error } = await supabase
      .from('investments')
      .insert({ ...input, ...ownerCols() })
      .select()
      .single()
    if (error) throw error
    set((s) => ({ investments: [...s.investments, data] }))
    return data
  },
  updateInvestment: async (id, patch) => {
    const { data, error } = await supabase
      .from('investments')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    set((s) => ({ investments: s.investments.map((i) => (i.id === id ? data : i)) }))
  },
  deleteInvestment: async (id) => {
    const { error } = await supabase.from('investments').delete().eq('id', id)
    if (error) throw error
    // movimentos caem por ON DELETE CASCADE
    set((s) => ({
      investments: s.investments.filter((i) => i.id !== id),
      investmentMovements: s.investmentMovements.filter((m) => m.investment_id !== id),
    }))
  },
  addMovement: async (input) => {
    const { data, error } = await supabase
      .from('investment_movements')
      .insert({ ...input, ...ownerCols() })
      .select()
      .single()
    if (error) throw error
    set((s) => ({ investmentMovements: [...s.investmentMovements, data] }))
  },
  deleteMovement: async (id) => {
    const { error } = await supabase.from('investment_movements').delete().eq('id', id)
    if (error) throw error
    set((s) => ({ investmentMovements: s.investmentMovements.filter((m) => m.id !== id) }))
  },
}))
