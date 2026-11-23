import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ order: [] as string[], release: vi.fn(), signOut: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signOut: h.signOut, getSession: vi.fn(), onAuthStateChange: vi.fn() } },
}))
vi.mock('../push', () => ({ usePush: { getState: () => ({ releaseDevice: h.release }) } }))

import { useAuth } from '../auth'

beforeEach(() => {
  h.order.length = 0
  h.release.mockReset()
  h.signOut.mockReset()
  h.release.mockImplementation(async () => void h.order.push('release'))
  h.signOut.mockImplementation(async () => void h.order.push('signOut'))
})

describe('signOut', () => {
  it('libera o aparelho de push antes do signOut do Supabase', async () => {
    await useAuth.getState().signOut()
    expect(h.order).toEqual(['release', 'signOut'])
  })

  it('o logout acontece mesmo se a liberação falhar', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    h.release.mockRejectedValue(new Error('x'))
    await useAuth.getState().signOut()
    expect(h.signOut).toHaveBeenCalled()
    expect(useAuth.getState().user).toBeNull()
    spy.mockRestore()
  })
})
