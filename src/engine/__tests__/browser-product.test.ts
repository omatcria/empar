import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchBrowserProduct } from '../../../supabase/functions/_shared/browser-product'

afterEach(() => vi.unstubAllGlobals())
describe('leitura opcional com navegador remoto', () => {
  it('rejeita URLs fora das lojas permitidas antes de consultar o serviço', async () => {
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher)
    expect(await fetchBrowserProduct('http://127.0.0.1/',{endpoint:'https://production-sfo.browserless.io',token:'teste'})).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('extrai nome, imagem e preço renderizados e remove rastreadores do link', async () => {
    const html='<meta property="og:title" content="Corrediça - R$ 12,87"><meta property="og:image" content="https://http2.mlstatic.com/foto.webp">'
    const fetcher=vi.fn().mockResolvedValue(new Response(html,{status:200,headers:{'content-type':'text/html'}}));vi.stubGlobal('fetch',fetcher)
    const result=await fetchBrowserProduct('https://www.mercadolivre.com.br/corredica/up/MLBU4381461436?pdp_filters=item_id%3AMLB7209245232&matt_source=google',{endpoint:'https://production-sfo.browserless.io',token:'teste'})
    expect(result).toMatchObject({titulo:'Corrediça',preco_centavos:1287,imagem_url:'https://http2.mlstatic.com/foto.webp'})
    const body=JSON.parse(fetcher.mock.calls[0][1].body)
    expect(body.url).toContain('pdp_filters=')
    expect(body.url).not.toContain('matt_source')
  })
  it('trata página de verificação como falha e não como produto', async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<title>Verificação de conta</title><form action="/gz/account-verification"></form>',{status:200})))
    expect(await fetchBrowserProduct('https://www.mercadolivre.com.br/p/MLB123',{endpoint:'https://production-sfo.browserless.io',token:'teste'})).toBeNull()
  })
})
