import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ rpc: vi.fn(), list: vi.fn(), workspace: 'ws-1' }))
vi.mock('@/store/workspace', () => ({ useWorkspace: (selector: (s: unknown) => unknown) => selector({ activeWorkspaceId: mock.workspace }) }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mock.rpc, from: () => ({ select: () => ({ eq: () => ({ is: () => ({ order: mock.list }) }) }) }) } }))
import { ShortcutsSettings } from '../ShortcutsSettings'
beforeEach(() => { mock.rpc.mockReset(); mock.list.mockReset(); mock.list.mockResolvedValue({data: [], error: null}) })
it('copia o link do atalho escolhido', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  render(<ShortcutsSettings />)
  fireEvent.click(screen.getByRole('button', { name: 'Copiar Nova receita' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://empar-pink.vercel.app/?novo=receita'))
})
it('gera chave e permite copiá-la uma única vez', async () => {
  mock.rpc.mockResolvedValue({ data: 'emp_secreta', error: null })
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  render(<ShortcutsSettings />)
  fireEvent.click(screen.getByRole('button', { name: 'Gerar chave' }))
  await waitFor(() => expect(screen.getByDisplayValue('emp_secreta')).toBeInTheDocument())
  expect(mock.rpc).toHaveBeenCalledWith('create_quick_token', { _workspace: 'ws-1', _nome: 'Meu celular' })
  fireEvent.click(screen.getByRole('button', { name: 'Copiar chave' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('emp_secreta'))
  fireEvent.click(screen.getByRole('button', { name: 'Fechar chave' }))
  expect(screen.queryByDisplayValue('emp_secreta')).not.toBeInTheDocument()
})
it('revoga uma chave após confirmação', async () => {
  mock.list.mockResolvedValue({data: [{id:'a',nome:'Celular',prefixo:'emp_abcd',created_at:'2026-01-01',last_used_at:null}], error:null})
  mock.rpc.mockResolvedValue({data:null,error:null})
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<ShortcutsSettings />)
  fireEvent.click(await screen.findByRole('button', {name:'Revogar Celular'}))
  await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith('revoke_quick_token', {_id:'a'}))
})
it('não mostra uma chave do espaço anterior após trocar de espaço', async () => {
  let finish!: (value: unknown) => void
  mock.rpc.mockReturnValue(new Promise((resolve) => { finish = resolve }))
  const { rerender } = render(<ShortcutsSettings />)
  fireEvent.click(screen.getByRole('button', { name: 'Gerar chave' }))
  mock.workspace = 'ws-2'
  rerender(<ShortcutsSettings />)
  finish({ data: 'emp_secreta_antiga', error: null })
  await waitFor(() => expect(mock.rpc).toHaveBeenCalled())
  expect(screen.queryByDisplayValue('emp_secreta_antiga')).not.toBeInTheDocument()
  mock.workspace = 'ws-1'
})
