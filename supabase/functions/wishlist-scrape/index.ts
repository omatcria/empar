import { createClient } from 'npm:@supabase/supabase-js@2'
import { fetchProduct } from '../_shared/fetch-product.ts'
import { fetchBrowserProduct, isBrowserEligible } from '../_shared/browser-product.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' }
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return Response.json({ ok: false, motivo: 'Método não permitido' }, { status: 405, headers: cors })
  try {
    const { url, browser_fallback } = await req.json()
    const result = await fetchProduct(url)
    const token = Deno.env.get('BROWSERLESS_TOKEN')
    if (browser_fallback === true && typeof url === 'string' && isBrowserEligible(url) && (!result.ok || result.product.preco_centavos == null) && token) {
      const authorization = req.headers.get('Authorization')
      if (!authorization) return Response.json({ ok: false, motivo: 'Entre novamente para atualizar o preço.' }, { status: 401, headers: cors })
      const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
      const { data: allowed, error } = await db.rpc('acquire_browser_scrape')
      if (error) return Response.json({ ok: false, motivo: 'Não foi possível verificar o limite de consultas. Tente novamente.' }, { headers: cors })
      if (!allowed) return Response.json({ ok: false, motivo: 'Limite de 10 consultas com navegador por hora atingido. Tente mais tarde.' }, { headers: cors })
      const product = await fetchBrowserProduct(url, { endpoint: 'https://production-sfo.browserless.io', token })
      if (product) return Response.json({ ok: true, ...product }, { headers: cors })
    }
    return Response.json(result.ok ? { ok: true, ...result.product } : result, { headers: cors })
  } catch {
    return Response.json({ ok: false, motivo: 'Não foi possível consultar o produto.' }, { status: 400, headers: cors })
  }
})
