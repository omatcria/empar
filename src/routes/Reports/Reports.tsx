import { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Download,
  LayoutDashboard,
  Plus,
  RotateCcw,
  X,
} from '@/components/icons'
import { useData } from '@/store/data'
import { useUI } from '@/store/ui'
import { useDashboardPrefs } from '@/store/dashboardPrefs'
import { WIDGETS, WIDGET_MAP } from '@/features/reports/widgets'
import { isInMonth } from '@/engine'
import { mesRefLabel } from '@/engine/period'
import { Button, Surface } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'

export function Reports() {
  const { pinned } = useDashboardPrefs()
  const { transactions, categories, accounts, cards } = useData()
  const { viewMode, mes } = useUI()
  const [customizing, setCustomizing] = useState(false)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-app-fg">Relatórios</h1>
          <p className="text-sm text-app-muted">
            {mesRefLabel(mes)} · painéis personalizáveis
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<Download className="size-4" />}
            onClick={() => exportCSV(transactions, categories, accounts, cards, viewMode, mes)}
          >
            <span className="hidden sm:inline">CSV</span>
          </Button>
          <Button
            icon={<LayoutDashboard className="size-4" />}
            onClick={() => setCustomizing(true)}
          >
            <span className="hidden sm:inline">Personalizar</span>
          </Button>
        </div>
      </div>

      {pinned.length === 0 ? (
        <Surface className="p-10 text-center">
          <LayoutDashboard className="mx-auto mb-3 size-8 text-app-muted" />
          <p className="text-sm text-app-muted">
            Nenhum painel fixado. Clique em <strong>Personalizar</strong> para escolher.
          </p>
        </Surface>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {pinned.map((id) => {
            const w = WIDGET_MAP.get(id)
            if (!w) return null
            const Comp = w.Component
            return (
              <div key={id} className={w.span === 'full' ? 'lg:col-span-2' : ''}>
                <Comp />
              </div>
            )
          })}
        </div>
      )}

      <CustomizeModal open={customizing} onClose={() => setCustomizing(false)} />
    </div>
  )
}

/* ---------------- Editor de painéis ---------------- */
function CustomizeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pinned, toggle, moveUp, moveDown, reset } = useDashboardPrefs()
  const disponiveis = WIDGETS.filter((w) => !pinned.includes(w.id))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Personalizar relatórios"
      footer={
        <>
          <Button variant="ghost" icon={<RotateCcw className="size-4" />} onClick={reset}>
            Padrão
          </Button>
          <Button onClick={onClose}>Concluir</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Fixados */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-muted">
            Fixados na tela ({pinned.length})
          </p>
          {pinned.length === 0 ? (
            <p className="text-sm text-app-muted">Nenhum painel fixado ainda.</p>
          ) : (
            <div className="space-y-1.5">
              {pinned.map((id, i) => {
                const w = WIDGET_MAP.get(id)
                if (!w) return null
                return (
                  <div
                    key={id}
                    className="flex items-center gap-2 rounded-xl border border-app-border bg-app-surface-2 px-3 py-2"
                  >
                    <span className="flex-1 truncate text-sm text-app-fg">{w.title}</span>
                    <button
                      aria-label="Subir"
                      disabled={i === 0}
                      onClick={() => moveUp(id)}
                      className="grid size-7 place-items-center rounded-lg text-app-muted hover:bg-app-border/60 hover:text-app-fg disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronUp className="size-4" />
                    </button>
                    <button
                      aria-label="Descer"
                      disabled={i === pinned.length - 1}
                      onClick={() => moveDown(id)}
                      className="grid size-7 place-items-center rounded-lg text-app-muted hover:bg-app-border/60 hover:text-app-fg disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronDown className="size-4" />
                    </button>
                    <button
                      aria-label="Remover"
                      onClick={() => toggle(id)}
                      className="grid size-7 place-items-center rounded-lg text-app-muted hover:bg-expense/10 hover:text-expense cursor-pointer"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Disponíveis */}
        {disponiveis.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-muted">
              Disponíveis
            </p>
            <div className="space-y-1.5">
              {disponiveis.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center gap-2 rounded-xl border border-app-border px-3 py-2"
                >
                  <span className="flex-1 truncate text-sm text-app-fg2">{w.title}</span>
                  <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => toggle(w.id)}>
                    Fixar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ---------------- CSV ---------------- */
function exportCSV(
  transactions: ReturnType<typeof useData.getState>['transactions'],
  categories: ReturnType<typeof useData.getState>['categories'],
  accounts: ReturnType<typeof useData.getState>['accounts'],
  cards: ReturnType<typeof useData.getState>['cards'],
  viewMode: ReturnType<typeof useUI.getState>['viewMode'],
  mes: string,
) {
  const catById = new Map(categories.map((c) => [c.id, c.nome]))
  const accById = new Map(accounts.map((a) => [a.id, a.nome]))
  const cardById = new Map(cards.map((c) => [c.id, c.nome]))

  const rows = transactions
    .filter(
      (t) => isInMonth(t.data, mes) && (viewMode === 'CONSOLIDADO' || t.contexto === viewMode),
    )
    .sort((a, b) => a.data.localeCompare(b.data))

  const header = ['Data', 'Contexto', 'Tipo', 'Categoria', 'Descrição', 'Meio', 'Valor']
  const linhas = rows.map((t) => [
    t.data,
    t.contexto,
    t.tipo,
    catById.get(t.category_id) ?? '',
    (t.descricao ?? '').replace(/;/g, ','),
    t.card_id ? cardById.get(t.card_id) ?? '' : accById.get(t.account_id ?? '') ?? '',
    (t.valor_centavos / 100).toFixed(2).replace('.', ','),
  ])

  const csv = [header, ...linhas].map((l) => l.join(';')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `financas-${mes}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
