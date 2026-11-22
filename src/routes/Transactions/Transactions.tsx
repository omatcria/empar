import { useMemo, useState } from 'react'
import { ArrowRightLeft, Filter, Plus, Search, SplitSquareHorizontal } from '@/components/icons'
import { useData } from '@/store/data'
import { useUI } from '@/store/ui'
import { useCanWrite } from '@/store/workspace'
import { isInMonth } from '@/engine'
import { mesRefLabel } from '@/engine/period'
import { Button } from '@/components/ui/primitives'
import { TransactionList } from '@/features/transactions/TransactionList'
import { TransactionModal } from '@/features/transactions/TransactionModal'
import { TextInput, Select } from '@/components/ui/form'

import type { Transaction } from '@/domain/types'

export function Transactions() {
  const { transactions } = useData()
  const { viewMode, mes, openQuickAdd } = useUI()
  const canWrite = useCanWrite()
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [search, setSearch] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<'ALL' | 'RECEITA' | 'DESPESA'>('ALL')
  const [statusFiltro, setStatusFiltro] = useState<'ALL' | 'PAGO' | 'PENDENTE'>('ALL')

  const filtradas = useMemo(
    () =>
      transactions.filter((t) => {
        if (!isInMonth(t.data, mes)) return false
        if (viewMode !== 'CONSOLIDADO' && t.contexto !== viewMode) return false
        if (tipoFiltro !== 'ALL' && t.tipo !== tipoFiltro) return false
        if (statusFiltro === 'PAGO' && !t.pago) return false
        if (statusFiltro === 'PENDENTE' && t.pago) return false
        if (search) {
          const s = search.toLowerCase()
          if (!t.descricao?.toLowerCase().includes(s)) return false
        }
        return true
      }),
    [transactions, mes, viewMode, search, tipoFiltro, statusFiltro],
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-app-fg">Lançamentos</h1>
          <p className="text-sm text-app-muted">{mesRefLabel(mes)}</p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button
              variant={showFilters ? "primary" : "secondary"}
              icon={<Filter className="size-4" />}
              onClick={() => setShowFilters(!showFilters)}
            >
              <span className="hidden sm:inline">Filtros</span>
            </Button>
            <Button
              variant="secondary"
              icon={<SplitSquareHorizontal className="size-4" />}
              onClick={() => openQuickAdd('rateio')}
            >
              <span className="hidden sm:inline">Dividir</span>
            </Button>
            <Button
              variant="secondary"
              icon={<ArrowRightLeft className="size-4" />}
              onClick={() => openQuickAdd('prolabore')}
            >
              <span className="hidden sm:inline">Pró-labore</span>
            </Button>
            <Button icon={<Plus className="size-4" />} onClick={() => openQuickAdd('tx')}>
              <span className="hidden sm:inline">Novo</span>
            </Button>
          </div>
        )}
      </div>

      {showFilters && (
        <div className="grid gap-3 sm:grid-cols-3 rounded-xl border border-app-border bg-app-surface-2 p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-app-muted" />
            <TextInput
              type="search"
              placeholder="Buscar lançamento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value as any)}>
            <option value="ALL">Todos os tipos</option>
            <option value="DESPESA">Despesas</option>
            <option value="RECEITA">Receitas</option>
          </Select>
          <Select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value as any)}>
            <option value="ALL">Todos os status</option>
            <option value="PAGO">Pagos / Recebidos</option>
            <option value="PENDENTE">Pendentes</option>
          </Select>
        </div>
      )}

      <TransactionList transactions={filtradas} onEdit={canWrite ? setEditingTx : undefined} />
      
      <TransactionModal open={!!editingTx} onClose={() => setEditingTx(null)} transaction={editingTx ?? undefined} />
    </div>
  )
}
