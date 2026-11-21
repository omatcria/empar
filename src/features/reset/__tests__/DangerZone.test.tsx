import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const resetWorkspace = vi.fn()
let role: string | undefined = 'owner'

vi.mock('@/store/workspace', () => ({ useActiveRole: () => role }))
vi.mock('@/store/data', () => {
  const useData = (sel: (s: unknown) => unknown) => sel({ resetWorkspace })
  useData.getState = () => ({})
  return { useData }
})
vi.mock('../backup', () => ({ exportBackup: vi.fn() }))

import { DangerZone } from '../DangerZone'

function setup() {
  render(
    <MemoryRouter>
      <DangerZone />
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByText('Resetar todos os dados', { selector: 'button' }))
  return screen.getByRole('button', { name: /Apagar tudo e recomeçar/ }) as HTMLButtonElement
}

describe('DangerZone', () => {
  beforeEach(() => {
    resetWorkspace.mockReset()
    role = 'owner'
  })

  it('não renderiza para quem não é dono', () => {
    role = 'editor'
    const { container } = render(
      <MemoryRouter>
        <DangerZone />
      </MemoryRouter>,
    )
    expect(container.innerHTML).toBe('')
  })

  it('só habilita com o texto exato RESETAR', () => {
    const btn = setup()
    const input = screen.getByLabelText(/Digite RESETAR/)
    expect(btn.disabled).toBe(true)
    for (const v of ['RESETA', 'resetar', ' RESETAR', 'RESETAR ']) {
      fireEvent.change(input, { target: { value: v } })
      expect(btn.disabled).toBe(true)
    }
    fireEvent.change(input, { target: { value: 'RESETAR' } })
    expect(btn.disabled).toBe(false)
  })

  it('mostra o erro da RPC no modal', async () => {
    resetWorkspace.mockRejectedValue(new Error('Apenas o dono do espaço pode resetar os dados'))
    const btn = setup()
    fireEvent.change(screen.getByLabelText(/Digite RESETAR/), { target: { value: 'RESETAR' } })
    fireEvent.click(btn)
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Apenas o dono do espaço pode resetar os dados',
      ),
    )
  })
})
