import { describe, expect, it } from 'vitest'
import { parsePriceToCents, parseProductHtml } from '../wishlist'
import jsonldProduct from './fixtures/jsonld-product.html?raw'
import jsonldGraph from './fixtures/jsonld-graph-group.html?raw'
import opengraph from './fixtures/opengraph.html?raw'
import itemprop from './fixtures/itemprop.html?raw'
import noPrice from './fixtures/no-price.html?raw'

const FX: Record<string, string> = {
  'jsonld-product.html': jsonldProduct,
  'jsonld-graph-group.html': jsonldGraph,
  'opengraph.html': opengraph,
  'itemprop.html': itemprop,
  'no-price.html': noPrice,
}
const fx = (n: string) => FX[n]

describe('parsePriceToCents', () => {
  it('formatos brasileiros e internacionais', () => {
    expect(parsePriceToCents('R$ 1.299,90')).toBe(129990)
    expect(parsePriceToCents('1299.90')).toBe(129990)
    expect(parsePriceToCents(1299.9)).toBe(129990)
    expect(parsePriceToCents('1.299')).toBe(129900)
    expect(parsePriceToCents('R$ 49,9')).toBe(4990)
    expect(parsePriceToCents('abc')).toBeNull()
    expect(parsePriceToCents(null)).toBeNull()
  })
})

describe('parseProductHtml', () => {
  it('JSON-LD Product', () => {
    const p = parseProductHtml(fx('jsonld-product.html'), 'https://www.loja.com.br/p/cama')
    expect(p.titulo).toBe('Cama Box Baú & Casal 138')
    expect(p.descricao).toBe("Cama d'água boa")
    expect(p.imagem_url).toBe('https://www.loja.com.br/img/cama.jpg')
    expect(p.preco_centavos).toBe(129990)
    expect(p.loja).toBe('loja.com.br')
  })
  it('@graph com ProductGroup e lowPrice', () => {
    const p = parseProductHtml(fx('jsonld-graph-group.html'), 'https://magalu.exemplo.com/t')
    expect(p.titulo).toBe('Tenis Corrida')
    expect(p.imagem_url).toBe('https://cdn.exemplo.com/t.jpg')
    expect(p.preco_centavos).toBe(24990)
    expect(p.loja).toBe('magalu.exemplo.com')
  })
  it('OpenGraph + product:price:amount', () => {
    const p = parseProductHtml(fx('opengraph.html'), 'https://kabum.exemplo.com/x')
    expect(p.titulo).toBe('Fone Bluetooth')
    expect(p.descricao).toBe('Com cancelamento de ruído')
    expect(p.imagem_url).toBe('https://img.loja.com/fone.png')
    expect(p.preco_centavos).toBe(129900)
  })
  it('itemprop price e twitter:image, título pela tag title', () => {
    const p = parseProductHtml(fx('itemprop.html'), 'https://a.com/m')
    expect(p.titulo).toBe('Mochila')
    expect(p.preco_centavos).toBe(8990)
    expect(p.imagem_url).toBe('https://cdn.loja.com/m.jpg')
  })
  it('sem preço mantém título', () => {
    const p = parseProductHtml(fx('no-price.html'), 'https://www.x.com/y')
    expect(p.preco_centavos).toBeNull()
    expect(p.titulo).toBe('Item sem preco')
    expect(p.imagem_url).toBeNull()
  })
})

it('lê preço no atributo itemprop em elementos visíveis', () => {
  const product=parseProductHtml('<title>Fone</title><span itemprop="price" content="129.90">R$ 129,90</span>', 'https://loja.example/p')
  expect(product.preco_centavos).toBe(12990)
})
