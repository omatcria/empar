import { fetchProduct } from '../_shared/fetch-product.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' }
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return Response.json({ ok: false, motivo: 'Método não permitido' }, { status: 405, headers: cors })
  try {
    const { url } = await req.json()
    const result = await fetchProduct(url)
    return Response.json(result.ok ? { ok: true, ...result.product } : result, { headers: cors })
  } catch {
    return Response.json({ ok: false, motivo: 'Informe um link válido' }, { status: 400, headers: cors })
  }
})
