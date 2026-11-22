import { describe, it, expect } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { detectInstallState } from '@/store/pwa'
import { OfflineBanner } from '@/components/pwa/OfflineBanner'

describe('detectInstallState', () => {
  it('classifica os estados de instalação', () => {
    expect(detectInstallState({ standalone: true, userAgent: 'x', hasPrompt: true })).toBe('installed')
    expect(
      detectInstallState({
        standalone: false,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
        hasPrompt: false,
      }),
    ).toBe('ios')
    expect(
      detectInstallState({ standalone: false, userAgent: 'Mozilla/5.0 (Linux; Android 15)', hasPrompt: true }),
    ).toBe('prompt')
    expect(
      detectInstallState({ standalone: false, userAgent: 'Mozilla/5.0 (Windows NT 10.0)', hasPrompt: false }),
    ).toBe('unsupported')
  })
})

describe('OfflineBanner', () => {
  it('aparece offline e some online', () => {
    render(<OfflineBanner />)
    expect(screen.queryByText('Sem conexão — os dados podem estar desatualizados')).toBeNull()
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByText('Sem conexão — os dados podem estar desatualizados')).toBeTruthy()
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByText('Sem conexão — os dados podem estar desatualizados')).toBeNull()
  })
})

describe('detectInstallState iPadOS', () => {
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15'
  it('Macintosh com toque é iOS', () => {
    expect(detectInstallState({ standalone: false, userAgent: mac, hasPrompt: false, maxTouchPoints: 5 })).toBe('ios')
  })
  it('Macintosh sem toque não é suportado', () => {
    expect(detectInstallState({ standalone: false, userAgent: mac, hasPrompt: false, maxTouchPoints: 0 })).toBe('unsupported')
    expect(detectInstallState({ standalone: false, userAgent: mac, hasPrompt: false })).toBe('unsupported')
  })
})
