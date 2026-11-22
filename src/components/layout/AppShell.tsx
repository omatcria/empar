import { Suspense, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  ArrowRightLeft,
  BarChart3,
  CreditCard,
  Flag,
  HandCoins,
  Heart,
  LayoutDashboard,
  ListPlus,
  LogOut,
  MoreHorizontal,
  Plus,
  Repeat,
  Settings,
  Tags,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from '@/components/icons'
import type { LucideIcon } from '@/components/icons'
import { useAuth } from '@/store/auth'
import { useData } from '@/store/data'
import { useUI } from '@/store/ui'
import { useCanWrite, useActiveWorkspace } from '@/store/workspace'
import { cn } from '@/lib/cn'
import { Modal } from '@/components/ui/Modal'
import { Button, Spinner } from '@/components/ui/primitives'
import { Avatar } from '@/components/ui/Avatar'
import { ProfileModal } from '@/features/profile/ProfileModal'
import { TransactionModal } from '@/features/transactions/TransactionModal'
import { ProLaboreModal } from '@/features/prolabore/ProLaboreModal'
import { RateioModal } from '@/features/rateio/RateioModal'
import { ContextSelector } from './ContextSelector'
import { MonthSelector } from './MonthSelector'
import { NotificationsDropdown } from './NotificationsDropdown'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

const PRIMARY: NavItem[] = [
  { to: '/', label: 'Início', icon: LayoutDashboard },
  { to: '/lancamentos', label: 'Lançamentos', icon: ListPlus },
  { to: '/contas', label: 'Contas', icon: Wallet },
  { to: '/cartoes', label: 'Cartões', icon: CreditCard },
]

const SECONDARY: NavItem[] = [
  { to: '/categorias', label: 'Categorias', icon: Tags },
  { to: '/orcamentos', label: 'Orçamentos', icon: Target },
  { to: '/recorrencias', label: 'Recorrências', icon: Repeat },
  { to: '/metas', label: 'Metas', icon: Flag },
  { to: '/investimentos', label: 'Investimentos', icon: TrendingUp },
  { to: '/dividas', label: 'Dívidas', icon: HandCoins },
  { to: '/desejos', label: 'Desejos', icon: Heart },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/membros', label: 'Membros', icon: Users },
  { to: '/config', label: 'Configurações', icon: Settings },
]

export function AppShell() {
  const [maisOpen, setMaisOpen] = useState(false)
  const { quickAdd, openQuickAdd, closeQuickAdd } = useUI()
  const canWrite = useCanWrite()

  return (
    <div className="min-h-dvh">
      <DesktopSidebar />

      <div className="lg:pl-64">
        <header
          className="sticky top-0 z-30 border-b border-app-border bg-app-bg/80 backdrop-blur"
          style={{ top: 'var(--offline-banner-h, 0px)', paddingTop: 'var(--header-safe-top, env(safe-area-inset-top))' }}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
            <ContextSelector />
            <div className="flex items-center gap-1.5 sm:gap-2">
              <MonthSelector />
              <NotificationsDropdown />
              {!canWrite && (
                <span className="hidden rounded-full bg-app-surface-2 px-2.5 py-1 text-xs text-app-muted sm:inline">
                  Somente leitura
                </span>
              )}
              {canWrite && (
                <div className="hidden gap-2 lg:flex">
                  <Button
                    variant="secondary"
                    icon={<ArrowRightLeft className="size-4" />}
                    onClick={() => openQuickAdd('prolabore')}
                  >
                    Pró-labore
                  </Button>
                  <Button icon={<Plus className="size-4" />} onClick={() => openQuickAdd('tx')}>
                    Novo lançamento
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
          <Suspense
            fallback={
              <div className="flex justify-center py-20">
                <Spinner />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>

      <MobileBottomNav onMais={() => setMaisOpen(true)} />

      {/* FAB mobile (oculto para visualizadores) */}
      {canWrite && (
        <button
          onClick={() => openQuickAdd('tx')}
          aria-label="Novo lançamento"
          className="fixed bottom-20 right-4 z-40 grid size-14 place-items-center rounded-full bg-gradient-to-br from-pessoal to-empresarial text-white shadow-lg shadow-pessoal/30 lg:hidden"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <Plus className="size-6" />
        </button>
      )}

      {/* Modais globais */}
      <TransactionModal open={quickAdd === 'tx'} onClose={closeQuickAdd} />
      <ProLaboreModal open={quickAdd === 'prolabore'} onClose={closeQuickAdd} />
      <RateioModal open={quickAdd === 'rateio'} onClose={closeQuickAdd} />

      <Modal open={maisOpen} onClose={() => setMaisOpen(false)} title="Mais">
        <div className="grid grid-cols-2 gap-2">
          {SECONDARY.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              onClick={() => setMaisOpen(false)}
              className="flex items-center gap-3 rounded-xl border border-app-border bg-app-surface-2 p-4 text-sm font-medium text-app-fg hover:bg-app-border/50"
            >
              <it.icon className="size-5 text-app-muted" />
              {it.label}
            </NavLink>
          ))}
        </div>
        <SignOutButton className="mt-3 w-full" />
      </Modal>
    </div>
  )
}

/* ---------------- Desktop sidebar ---------------- */
function DesktopSidebar() {
  const user = useAuth((s) => s.user)
  const profile = useData((s) => s.profile)
  const ws = useActiveWorkspace()
  const [profileOpen, setProfileOpen] = useState(false)

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-app-border bg-app-surface lg:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <img src="/brand/empar-symbol.png" alt="" className="size-9 object-contain" />
        <div className="min-w-0 leading-tight">
          <img src="/brand/empar-wordmark.png" alt="Empar" className="h-5 w-auto" />
          <p className="truncate text-[11px] text-app-muted">{ws?.nome ?? 'PJ & Pessoal'}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {[...PRIMARY, ...SECONDARY].map((it) => (
          <SidebarLink key={it.to} {...it} />
        ))}
      </nav>

      <div className="border-t border-app-border p-3">
        <button
          onClick={() => setProfileOpen(true)}
          className="mb-2 flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-app-surface-2 cursor-pointer"
        >
          <Avatar path={profile?.avatar_url} nome={profile?.nome || user?.email} className="size-8 text-xs" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-app-fg">
              {profile?.nome || 'Meu perfil'}
            </p>
            <p className="truncate text-[11px] text-app-muted">{user?.email}</p>
          </div>
        </button>
        <SignOutButton className="w-full" />
      </div>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </aside>
  )
}

function SidebarLink({ to, label, icon: Icon }: NavItem) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-app-surface-2 text-app-fg'
            : 'text-app-muted hover:bg-app-surface-2/60 hover:text-app-fg',
        )
      }
    >
      <Icon className="size-[18px]" />
      {label}
    </NavLink>
  )
}

/* ---------------- Mobile bottom nav ---------------- */
function MobileBottomNav({ onMais }: { onMais: () => void }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-app-border bg-app-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {PRIMARY.map((it) => (
          <BottomLink key={it.to} {...it} />
        ))}
        <button
          onClick={onMais}
          className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-app-muted hover:text-app-fg cursor-pointer"
        >
          <MoreHorizontal className="size-5" />
          Mais
        </button>
      </div>
    </nav>
  )
}

function BottomLink({ to, label, icon: Icon }: NavItem) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors',
          isActive ? 'text-app-fg' : 'text-app-muted hover:text-app-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('size-5', isActive && 'text-pessoal-strong')} />
          {label}
        </>
      )}
    </NavLink>
  )
}

/* ---------------- Sign out ---------------- */
function SignOutButton({ className }: { className?: string }) {
  const signOut = useAuth((s) => s.signOut)
  return (
    <button
      onClick={() => signOut()}
      className={cn(
        'flex items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface-2 px-3 py-2.5 text-sm font-medium text-app-fg2 hover:bg-app-border/50 cursor-pointer',
        className,
      )}
    >
      <LogOut className="size-4" />
      Sair
    </button>
  )
}
