import { describe, expect, it } from 'vitest'
import { pushSupport, urlBase64ToUint8Array, type PushEnv } from '../push'

const base: PushEnv = {
  userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120',
  maxTouchPoints: 5,
  standalone: false,
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
}
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1'

describe('pushSupport', () => {
  it('iPhone fora do modo instalado pede instalação', () => {
    expect(pushSupport({ ...base, userAgent: iphone })).toBe('ios-install')
  })
  it('iPhone instalado com APIs presentes é ok', () => {
    expect(pushSupport({ ...base, userAgent: iphone, standalone: true })).toBe('ok')
  })
  it('iPadOS (Macintosh com toque) fora do modo instalado pede instalação', () => {
    expect(
      pushSupport({ ...base, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 }),
    ).toBe('ios-install')
  })
  it('Android com APIs é ok', () => {
    expect(pushSupport(base)).toBe('ok')
  })
  it('sem PushManager é unsupported', () => {
    expect(pushSupport({ ...base, hasPushManager: false })).toBe('unsupported')
  })
})

describe('urlBase64ToUint8Array', () => {
  it('decodifica base64url', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID'))).toEqual([1, 2, 3])
  })
  it('decodifica base64url com - e _ e precisa de padding', () => {
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([251, 255])
  })
})
