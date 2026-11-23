import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotificationSettings } from '../NotificationSettings'

const push = vi.hoisted(() => ({
  status: 'off' as string,
  error: null as string | null,
  refresh: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  sendTest: vi.fn(),
}))
const notif = vi.hoisted(() => ({
  prefs: null as Record<string, boolean> | null,
  updatePrefs: vi.fn(),
}))

vi.mock('@/store/push', () => ({
  usePush: (sel?: (s: typeof push) => unknown) => (sel ? sel(push) : push),
}))
vi.mock('@/store/notifications', () => ({
  useNotifications: (sel?: (s: typeof notif) => unknown) => (sel ? sel(notif) : notif),
}))

const KEYS = [
  'membros_lancamentos', 'membros_desejos', 'reacoes',
  'venc_faturas', 'venc_contas', 'venc_recorrencias', 'venc_dividas',
  'orcamento_80', 'mei_alertas', 'wishlist_precos',
]

describe('NotificationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    push.status = 'off'
    push.error = null
    push.sendTest.mockResolvedValue(true)
    notif.prefs = Object.fromEntries(KEYS.map((k) => [k, true]))
  })

  it('checking: sem botões de ação', () => {
    push.status = 'checking'
    render(<NotificationSettings />)
    expect(screen.queryByRole('button', { name: 'Ativar notificações' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Desativar neste aparelho' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Enviar teste' })).toBeNull()
  })

  it('error: mostra a mensagem em alert e o botão Ativar', () => {
    push.status = 'error'
    push.error = 'Falhou geral'
    render(<NotificationSettings />)
    expect(screen.getByRole('alert')).toHaveTextContent('Falhou geral')
    expect(screen.getByRole('button', { name: 'Ativar notificações' })).toBeInTheDocument()
  })

  it.each([
    ['on', 'Ativas neste aparelho'],
    ['off', 'Desativadas'],
    ['blocked', 'Bloqueadas no navegador'],
    ['ios-install', 'No iPhone, instale o app na tela inicial para receber notificações'],
    ['unsupported', 'Este navegador não suporta notificações'],
  ])('estado %s mostra o texto', (status, text) => {
    push.status = status
    render(<NotificationSettings />)
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it('blocked: mostra instrução para liberar nas configurações', () => {
    push.status = 'blocked'
    render(<NotificationSettings />)
    expect(screen.getByText(/libere as notificações deste site nas configurações do navegador/)).toBeInTheDocument()
  })

  it('sem instrução fora de blocked', () => {
    render(<NotificationSettings />)
    expect(screen.queryByText(/libere as notificações deste site/)).toBeNull()
  })

  it('limpa o resultado do teste ao sair de on', async () => {
    push.status = 'on'
    const { rerender } = render(<NotificationSettings />)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar teste' }))
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
    push.status = 'off'
    rerender(<NotificationSettings />)
    push.status = 'on'
    rerender(<NotificationSettings />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('Ativar notificações chama enable', () => {
    render(<NotificationSettings />)
    fireEvent.click(screen.getByRole('button', { name: 'Ativar notificações' }))
    expect(push.enable).toHaveBeenCalled()
  })

  it('on: Desativar e Enviar teste; teste mostra feedback', async () => {
    push.status = 'on'
    render(<NotificationSettings />)
    fireEvent.click(screen.getByRole('button', { name: 'Desativar neste aparelho' }))
    expect(push.disable).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Enviar teste' }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Teste enviado. Deve chegar em instantes.'),
    )
  })

  it('teste que falha mostra o erro do store em alert', async () => {
    push.status = 'on'
    push.sendTest.mockImplementation(async () => {
      push.error = 'Sem conexão'
      return false
    })
    render(<NotificationSettings />)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar teste' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sem conexão'))
  })

  it('agrupa as 10 chaves e alterna chama updatePrefs', () => {
    render(<NotificationSettings />)
    for (const g of ['Ações de outros membros', 'Vencimentos', 'Alertas']) {
      expect(screen.getByText(g)).toBeInTheDocument()
    }
    const labels = ['Lançamentos', 'Desejos', 'Reações', 'Faturas', 'Contas a pagar', 'Recorrências',
      'Parcelas de dívidas', 'Orçamento 80%', 'Limite do MEI', 'Queda de preço']
    for (const l of labels) expect(screen.getByRole('switch', { name: l })).toBeInTheDocument()
    expect(screen.getAllByRole('switch')).toHaveLength(10)
    fireEvent.click(screen.getByRole('switch', { name: 'Faturas' }))
    expect(notif.updatePrefs).toHaveBeenCalledWith({ venc_faturas: false })
    fireEvent.click(screen.getByRole('switch', { name: 'Queda de preço' }))
    expect(notif.updatePrefs).toHaveBeenCalledWith({ wishlist_precos: false })
  })
})
