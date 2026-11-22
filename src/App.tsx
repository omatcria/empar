import { lazy, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { useData } from '@/store/data'
import { useWorkspace, useActiveRole } from '@/store/workspace'
import { useNotifications } from '@/store/notifications'
import { useReactions } from '@/store/reactions'
import { useDebts } from '@/store/debts'
import { useWishlist } from '@/store/wishlist'
import { Spinner } from '@/components/ui/primitives'
import { Login } from '@/routes/Login/Login'
import { AppShell } from '@/components/layout/AppShell'
import { Onboarding } from '@/routes/Onboarding/Onboarding'
import { UpdatePrompt } from '@/components/pwa/UpdatePrompt'
import { OfflineBanner } from '@/components/pwa/OfflineBanner'

// Rotas carregadas sob demanda (separa Recharts e telas pesadas do bundle inicial)
const Dashboard = lazy(() =>
  import('@/routes/Dashboard/Dashboard').then((m) => ({ default: m.Dashboard })),
)
const Accounts = lazy(() =>
  import('@/routes/Accounts/Accounts').then((m) => ({ default: m.Accounts })),
)
const Transactions = lazy(() =>
  import('@/routes/Transactions/Transactions').then((m) => ({ default: m.Transactions })),
)
const Cards = lazy(() =>
  import('@/routes/Cards/Cards').then((m) => ({ default: m.Cards })),
)
const Categories = lazy(() =>
  import('@/routes/Categories/Categories').then((m) => ({ default: m.Categories })),
)
const Budgets = lazy(() =>
  import('@/routes/Budgets/Budgets').then((m) => ({ default: m.Budgets })),
)
const Settings = lazy(() =>
  import('@/routes/Settings/Settings').then((m) => ({ default: m.Settings })),
)
const Goals = lazy(() =>
  import('@/routes/Goals/Goals').then((m) => ({ default: m.Goals })),
)
const Recurrences = lazy(() =>
  import('@/routes/Recurrences/Recurrences').then((m) => ({ default: m.Recurrences })),
)
const Reports = lazy(() =>
  import('@/routes/Reports/Reports').then((m) => ({ default: m.Reports })),
)
const Members = lazy(() =>
  import('@/routes/Members/Members').then((m) => ({ default: m.Members })),
)
const Investments = lazy(() =>
  import('@/routes/Investments/Investments').then((m) => ({ default: m.Investments })),
)

const Debts = lazy(() =>
  import('@/routes/Debts/Debts').then((m) => ({ default: m.Debts })),
)
const Wishlist = lazy(() =>
  import('@/routes/Wishlist/Wishlist').then((m) => ({ default: m.Wishlist })),
)

export function App() {
  const { session, initializing, init } = useAuth()
  const ws = useData((s) => s.workspaceId)
  const resyncInvoices = useData((s) => s.resyncInvoices)

  useEffect(() => init(), [init])

  // Limpa os stores ao sair
  useEffect(() => {
    if (!session) {
      useData.getState().reset()
      useWorkspace.getState().reset()
      useNotifications.getState().unsubscribe()
      useNotifications.setState({ notifications: [], unreadCount: 0, prefs: null })
      useReactions.getState().unsubscribe()
      useReactions.setState({ reactions: [] })
      useDebts.getState().reset()
      useWishlist.getState().reset()
    }
  }, [session])

  useEffect(() => {
    if (ws) {
      // Auto-resync just once to fix the issue the user is seeing
      const hasSynced = localStorage.getItem('auto_resynced_v1')
      if (!hasSynced) {
        resyncInvoices().then(() => {
          localStorage.setItem('auto_resynced_v1', 'true')
          console.log('Auto resync complete')
        }).catch(console.error)
      }
    }
  }, [ws, resyncInvoices])

  let content
  if (initializing) content = <Splash />
  else if (!session) content = <Login />
  else content = <AuthedApp />

  return (
    <>
      <OfflineBanner />
      {content}
      <UpdatePrompt />
    </>
  )
}

function AuthedApp() {
  const userId = useAuth((s) => s.user?.id)
  const {
    activeWorkspaceId,
    loading: wsLoading,
    load: loadWorkspaces,
    acceptInvite,
  } = useWorkspace()
  const { loaded, loading, error, loadAll, profile, accounts } = useData()
  const role = useActiveRole()

  // Carrega os espaços ao entrar
  useEffect(() => {
    if (userId) loadWorkspaces()
  }, [userId, loadWorkspaces])

  // Convite via URL (?convite=TOKEN)
  useEffect(() => {
    if (!userId) return
    const params = new URLSearchParams(window.location.search)
    const token = params.get('convite')
    if (token) {
      acceptInvite(token)
        .catch(() => {})
        .finally(() => window.history.replaceState({}, '', window.location.pathname))
    }
  }, [userId, acceptInvite])

  // Carrega os dados do espaço ativo
  useEffect(() => {
    if (!activeWorkspaceId) return
    // Membros carregam globalmente (atribuição "por Fulano" + reações + feed
    // dependem disto em qualquer tela, não só na página Membros).
    useWorkspace.getState().loadMembers()
    // generate() depende dos dados (loadAll) e das prefs (load) já carregados.
    loadAll(activeWorkspaceId).then(() => {
      const notif = useNotifications.getState()
      notif.load().then(() => {
        notif.subscribe()
        notif.generate()
      })
    })
    useDebts.getState().load(activeWorkspaceId).catch((error) => console.error('Falha ao carregar dívidas', error))
    useWishlist.getState().load(activeWorkspaceId).catch((error) => console.error('Falha ao carregar desejos', error))
    useReactions.getState().load(activeWorkspaceId).then(() => {
      useReactions.getState().subscribe()
    })
  }, [activeWorkspaceId, loadAll])

  if (wsLoading || (activeWorkspaceId && !loaded && loading))
    return <Splash label="Carregando…" />
  if (error && !loaded) return <Splash label={`Erro ao carregar: ${error}`} />

  // Onboarding: só para dono de um espaço novo e vazio
  if (loaded && profile && !profile.onboarding_completo && role === 'owner' && accounts.length === 0)
    return <Onboarding />

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="lancamentos" element={<Transactions />} />
          <Route path="contas" element={<Accounts />} />
          <Route path="cartoes" element={<Cards />} />
          <Route path="categorias" element={<Categories />} />
          <Route path="orcamentos" element={<Budgets />} />
          <Route path="recorrencias" element={<Recurrences />} />
          <Route path="metas" element={<Goals />} />
          <Route path="investimentos" element={<Investments />} />
          <Route path="dividas" element={<Debts />} />
          <Route path="desejos" element={<Wishlist />} />
          <Route path="relatorios" element={<Reports />} />
          <Route path="membros" element={<Members />} />
          <Route path="config" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

function Splash({ label }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pessoal to-empresarial text-xl font-bold text-white">
        $
      </div>
      <Spinner />
      {label && <p className="text-sm text-app-muted">{label}</p>}
    </div>
  )
}
