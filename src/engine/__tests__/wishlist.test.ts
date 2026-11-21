import { describe, expect, it } from 'vitest'
import { acharPromoUrl, priceAlert, priceStats } from '../wishlist'

const ML_IN =
  'https://www.mercadolivre.com.br/cama-box-bau-casal-138-bello-box-marrom/p/MLB80595545#reco_item_pos=0&reco_backend=item_decorator&reco_backend_type=function&reco_client=home_items-decorator-legacy&reco_id=103c48fc-00d7-4fb4-9bf6-437eb6271c6c&reco_model=&c_id=/home/navigation-recommendations-seed/element&c_uid=1312470a-bd03-4105-8d27-8a14a941d8c2&da_id=navigation&da_position=0&id_origin=/home/dynamic_access&da_sort_algorithm=ranker'
const ML_OUT =
  'https://www.achar.promo/mercadolivre.com.br/cama-box-bau-casal-138-bello-box-marrom/p/MLB80595545#reco_item_pos=0&reco_backend=item_decorator&reco_backend_type=function&reco_client=home_items-decorator-legacy&reco_id=103c48fc-00d7-4fb4-9bf6-437eb6271c6c&reco_model=&c_id=/home/navigation-recommendations-seed/element&c_uid=1312470a-bd03-4105-8d27-8a14a941d8c2&da_id=navigation&da_position=0&id_origin=/home/dynamic_access&da_sort_algorithm=ranker'

describe('acharPromoUrl', () => {
  it('exemplo exato do Mercado Livre', () => {
    expect(acharPromoUrl(ML_IN)).toBe(ML_OUT)
  })
  it('remove http e www (case-insensitive), preserva query e hash', () => {
    expect(acharPromoUrl('http://WWW.loja.com/p?x=1#y')).toBe('https://www.achar.promo/loja.com/p?x=1#y')
  })
  it('sem www', () => {
    expect(acharPromoUrl('https://produto.mercadolivre.com.br/MLB-1')).toBe(
      'https://www.achar.promo/produto.mercadolivre.com.br/MLB-1',
    )
  })
})

describe('priceAlert', () => {
  it('queda de 5% ou mais', () => {
    expect(priceAlert(10000, 9500, null)).toBe('queda')
    expect(priceAlert(10000, 9501, null)).toBeNull()
  })
  it('cruzou o alvo', () => {
    expect(priceAlert(10000, 9900, 9900)).toBe('alvo')
    expect(priceAlert(null, 8000, 9000)).toBe('alvo')
  })
  it('alvo tem precedência sobre queda', () => {
    expect(priceAlert(10000, 8000, 9000)).toBe('alvo')
  })
  it('já abaixo do alvo e queda pequena não alerta', () => {
    expect(priceAlert(9000, 8900, 9500)).toBeNull()
  })
  it('sem preço novo não alerta', () => {
    expect(priceAlert(10000, null, 9000)).toBeNull()
  })
})

describe('priceStats', () => {
  it('mínimo, máximo, variação e isLowest', () => {
    const pts = [
      { preco_centavos: 10000, verificado_em: '2026-01-01T00:00:00Z' },
      { preco_centavos: 12000, verificado_em: '2026-01-02T00:00:00Z' },
      { preco_centavos: 9000, verificado_em: '2026-01-03T00:00:00Z' },
    ]
    const s = priceStats(pts, 10000)
    expect(s.min).toBe(9000)
    expect(s.max).toBe(12000)
    expect(s.variacaoPct).toBeCloseTo(-10)
    expect(s.isLowest).toBe(true)
  })
  it('vazio', () => {
    expect(priceStats([], null)).toEqual({ min: null, max: null, variacaoPct: null, isLowest: false })
  })
})
