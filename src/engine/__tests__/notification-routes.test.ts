import { describe, expect, it } from 'vitest'
import {
  NOTIFICATION_PREF_BY_TIPO,
  buildPushPayload,
  notificationRoute,
  shouldRemoveSubscription,
} from '../notification-routes'

describe('notificationRoute', () => {
  const rotas: Record<string, string> = {
    membro_lancamento: '/lancamentos',
    membro_desejo: '/desejos',
    reaction: '/lancamentos',
    venc_fatura: '/cartoes',
    venc_conta: '/lancamentos',
    venc_recorrencia: '/recorrencias',
    venc_divida: '/dividas',
    orcamento_80: '/orcamentos',
    mei: '/',
    wishlist: '/desejos',
    teste: '/config',
  }
  for (const [tipo, rota] of Object.entries(rotas)) {
    it(`${tipo} -> ${rota}`, () => expect(notificationRoute(tipo)).toBe(rota))
  }
  it('desconhecido -> /', () => expect(notificationRoute('xyz')).toBe('/'))
})

describe('NOTIFICATION_PREF_BY_TIPO', () => {
  it('espelha o SQL', () => {
    expect(NOTIFICATION_PREF_BY_TIPO.venc_divida).toBe('venc_dividas')
    expect(NOTIFICATION_PREF_BY_TIPO.mei).toBe('mei_alertas')
    expect(NOTIFICATION_PREF_BY_TIPO.teste).toBeNull()
  })
})

describe('buildPushPayload', () => {
  it('monta o payload', () => {
    expect(buildPushPayload({ id: 'n1', tipo: 'venc_fatura', titulo: 'T', corpo: null })).toEqual({
      title: 'T', body: '', url: '/cartoes', tag: 'venc_fatura', notification_id: 'n1',
      icon: '/icons/icon-192.png', badge: '/icons/badge-72.png',
    })
  })
})

describe('shouldRemoveSubscription', () => {
  it('404/410 removem', () => {
    expect(shouldRemoveSubscription(404)).toBe(true)
    expect(shouldRemoveSubscription(410)).toBe(true)
  })
  it('demais não', () => {
    for (const s of [400, 403, 500, 201]) expect(shouldRemoveSubscription(s)).toBe(false)
  })
})
