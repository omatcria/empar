import { useMemo, useState } from 'react'
import { Trash2, Pencil } from '@/components/icons'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useData } from '@/store/data'
import { useUI } from '@/store/ui'
import { useAuth } from '@/store/auth'
import { useWorkspace } from '@/store/workspace'
import type { Transaction } from '@/domain/types'
import { Money } from '@/components/ui/Money'
import { ContextBadge } from '@/components/ui/ContextBadge'
import { CategoryIcon } from '@/domain/icons-catalog'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'
import { useReactions } from '@/store/reactions'
import { TransactionReactions } from './TransactionReactions'

export function TransactionList({
  transactions,
  showContext,
  onEdit,
}: {
  transactions: Transaction[]
  showContext?: boolean
  onEdit?: (t: Transaction) => void
}) {
  const { categories, accounts, cards, togglePago, deleteTransaction, deleteTransactionGroup } = useData()
  const { viewMode } = useUI()
  const { members } = useWorkspace()
  const uid = useAuth((s) => s.user?.id)
  const { reactions } = useReactions()
  // Lançamento parcelado aguardando escolha de escopo de exclusão.
  const [confirmDelete, setConfirmDelete] = useState<Transaction | null>(null)

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const memberById = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members])

  const reactionsByTx = useMemo(() => {
    const map = new Map<string, typeof reactions>()
    for (const r of reactions) {
      const arr = map.get(r.transaction_id) ?? []
      arr.push(r)
      map.set(r.transaction_id, arr)
    }
    return map
  }, [reactions])

  const grupos = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const t of [...transactions].sort((a, b) => b.data.localeCompare(a.data))) {
      const arr = map.get(t.data) ?? []
      arr.push(t)
      map.set(t.data, arr)
    }
    return [...map.entries()]
  }, [transactions])

  const mostrarCtx = showContext ?? viewMode === 'CONSOLIDADO'

  if (transactions.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-app-muted">
        Nenhum lançamento por aqui.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {grupos.map(([dia, txs]) => (
        <div key={dia}>
          <p className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-app-muted">
            {format(parseISO(dia), "EEE, dd 'de' MMM", { locale: ptBR })}
          </p>
          <div className="divide-y divide-app-border rounded-2xl border border-app-border bg-app-surface">
            {txs.map((t) => {
              const cat = catById.get(t.category_id)
              const meio = t.card_id
                ? cardById.get(t.card_id)?.nome
                : accById.get(t.account_id ?? '')?.nome
              const criador = memberById.get(t.user_id)
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-lg"
                    style={{ background: `${cat?.cor ?? '#8a8aa3'}22`, color: cat?.cor ?? '#8a8aa3' }}
                  >
                    <CategoryIcon name={cat?.icone} className="size-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-app-fg">
                          {t.descricao || cat?.nome || 'Lançamento'}
                        </p>
                        {mostrarCtx && <ContextBadge contexto={t.contexto} iconOnly />}
                      </div>
                      <div className="flex items-center gap-2 truncate text-xs text-app-muted">
                        <p className="truncate">
                          {cat?.nome}
                          {meio ? ` · ${meio}` : ''}
                        </p>
                        {criador && criador.user_id !== uid && (
                          <div className="flex shrink-0 items-center gap-1 rounded-full bg-app-surface-2 px-1.5 py-0.5">
                            <Avatar path={criador.avatar_url} nome={criador.nome || criador.email} className="size-3.5 text-[8px]" />
                            <span className="text-[10px]">por {criador.nome || criador.email?.split('@')[0]}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Área de Reações (apenas se for time) */}
                      {members.length > 1 && (
                        <TransactionReactions txId={t.id} reactions={reactionsByTx.get(t.id) ?? []} />
                      )}
                    </div>

                  <div className="flex flex-col items-end">
                    <Money cents={t.valor_centavos} tipo={t.tipo} className="text-sm font-semibold" showSign />
                    {!t.pago && (
                      <button
                        onClick={() => togglePago(t.id)}
                        className="text-[11px] text-warn hover:underline cursor-pointer"
                      >
                        Pendente · marcar pago
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 shrink-0">
                    {onEdit && (
                      <button
                        aria-label="Editar"
                        onClick={() => onEdit(t)}
                        className={cn(
                          'grid size-8 place-items-center rounded-lg text-app-muted',
                          'hover:bg-app-surface-2 hover:text-app-fg cursor-pointer',
                        )}
                      >
                        <Pencil className="size-4" />
                      </button>
                    )}
                    <button
                      aria-label="Excluir"
                      onClick={() =>
                        t.parcela_group_id ? setConfirmDelete(t) : deleteTransaction(t.id)
                      }
                      className={cn(
                        'grid size-8 place-items-center rounded-lg text-app-muted',
                        'hover:bg-expense/10 hover:text-expense cursor-pointer',
                      )}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Excluir lançamento parcelado"
      >
        {confirmDelete && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-app-muted">
              Este lançamento faz parte de uma compra parcelada
              {confirmDelete.parcela_n && confirmDelete.parcela_total
                ? ` (${confirmDelete.parcela_n}/${confirmDelete.parcela_total})`
                : ''}
              . O que deseja excluir?
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  deleteTransactionGroup(confirmDelete.id, 'THIS')
                  setConfirmDelete(null)
                }}
              >
                Excluir somente esta parcela
              </Button>
              <Button
                variant="primary"
                className="!bg-expense !text-white"
                onClick={() => {
                  deleteTransactionGroup(confirmDelete.id, 'ALL')
                  setConfirmDelete(null)
                }}
              >
                Excluir todas as parcelas
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
