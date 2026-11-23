import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'
const mocks = vi.hoisted(() => ({ canWrite: true }))
vi.mock('@/store/workspace', () => ({ useCanWrite: () => mocks.canWrite, useActiveWorkspace: () => null }))
vi.mock('@/store/auth', () => ({ useAuth: (selector: (s: unknown) => unknown) => selector({user:null,signOut:vi.fn()}) }))
vi.mock('@/store/data', () => ({ useData: (selector: (s: unknown) => unknown) => selector({profile:null}) }))
vi.mock('@/features/transactions/TransactionModal', () => ({ TransactionModal: ({open,preset,onClose}: {open:boolean;preset:unknown;onClose:()=>void}) => open ? <div><span data-testid="preset">{JSON.stringify(preset)}</span><button onClick={onClose}>Fechar modal</button></div> : null }))
vi.mock('@/features/prolabore/ProLaboreModal', () => ({ ProLaboreModal: () => null }))
vi.mock('@/features/rateio/RateioModal', () => ({ RateioModal: () => null }))
vi.mock('@/features/profile/ProfileModal', () => ({ ProfileModal: () => null }))
vi.mock('@/components/layout/ContextSelector', () => ({ ContextSelector: () => null }))
vi.mock('@/components/layout/MonthSelector', () => ({ MonthSelector: () => null }))
vi.mock('@/components/layout/NotificationsDropdown', () => ({ NotificationsDropdown: () => null }))
import { AppShell } from '../AppShell'
import { useUI } from '@/store/ui'
function Location() { const loc=useLocation(); return <span data-testid="location">{loc.pathname+loc.search+loc.hash}</span> }
function mount() { return render(<MemoryRouter initialEntries={['/?a=1&novo=receita#top']}><Routes><Route path="/" element={<AppShell />}><Route index element={<Location />} /></Route></Routes></MemoryRouter>) }
beforeEach(() => {
  useUI.persist.setOptions({ storage: createJSONStorage(() => ({ getItem: () => null, setItem: () => {}, removeItem: () => {} })) })
  mocks.canWrite = true
  useUI.getState().closeQuickAdd()
})
describe('atalho por link', () => {
  it('abre receita e remove apenas novo da URL', async () => {
    mount()
    expect(await screen.findByTestId('preset')).toHaveTextContent('RECEITA')
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/?a=1#top'))
    fireEvent.click(screen.getByRole('button',{name:'Fechar modal'}))
    expect(useUI.getState().quickAddPreset).toBeNull()
  })
  it('ignora o link para quem não tem permissão de escrita', () => {
    mocks.canWrite = false; mount()
    expect(screen.queryByTestId('preset')).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/?a=1&novo=receita#top')
  })
})
