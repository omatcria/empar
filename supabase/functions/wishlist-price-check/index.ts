import { timingSafeEqual } from 'node:crypto'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { fetchProduct } from '../_shared/fetch-product.ts'
import { priceAlert } from '../_shared/wishlist-logic.ts'

Deno.serve(async (req: Request) => {
  const expected = Deno.env.get('CRON_SECRET')
  const supplied = req.headers.get('x-cron-secret')
  if (!expected || !supplied || new TextEncoder().encode(supplied).length !== new TextEncoder().encode(expected).length) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }
  if (!timingSafeEqual(new TextEncoder().encode(supplied), new TextEncoder().encode(expected))) return Response.json({ error: 'Não autorizado' }, { status: 401 })
  if (req.method !== 'POST') return Response.json({ error: 'Método não permitido' }, { status: 405 })
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: items, error } = await db.from('wishlist_items').select('*').eq('monitorar', true).eq('comprado', false)
  if (error) return Response.json({ error: 'Falha ao consultar itens' }, { status: 500 })
  let next = 0, verificados = 0, alertas = 0, erros = 0
  const worker = async () => {
    while (next < (items?.length ?? 0)) {
      const item = items![next++]
      try {
        const result = await fetchProduct(item.url)
        const now = new Date().toISOString()
        if (!result.ok || result.product.preco_centavos == null) {
          const message = result.ok ? 'Preço não encontrado' : result.motivo
          const { error: updateError } = await db.from('wishlist_items').update({ ultima_verificacao: now, ultimo_erro: message }).eq('id', item.id)
          if (updateError) throw updateError
          erros++; continue
        }
        const price = result.product.preco_centavos
        const alert = priceAlert(item.preco_atual_centavos, price, item.preco_alvo_centavos)
        const { error: historyError } = await db.from('wishlist_price_history').insert({ item_id: item.id, workspace_id: item.workspace_id, preco_centavos: price, verificado_em: now })
        if (historyError) throw historyError
        const { error: updateError } = await db.from('wishlist_items').update({ preco_atual_centavos: price, preco_inicial_centavos: item.preco_inicial_centavos ?? price, preco_minimo_centavos: Math.min(item.preco_minimo_centavos ?? price, price), ultima_verificacao: now, ultimo_erro: null }).eq('id', item.id)
        if (updateError) throw updateError
        verificados++
        if (!alert) continue
        const { data: members, error: membersError } = await db.from('workspace_members').select('user_id').eq('workspace_id', item.workspace_id).eq('status', 'active')
        if (membersError) throw membersError
        const ids = (members ?? []).map((m: { user_id: string }) => m.user_id)
        if (!ids.length) continue
        const { data: prefs, error: prefsError } = await db.from('notification_prefs').select('user_id,wishlist_precos').in('user_id', ids)
        if (prefsError) throw prefsError
        const disabled = new Set((prefs ?? []).filter((p: { wishlist_precos: boolean }) => !p.wishlist_precos).map((p: { user_id: string }) => p.user_id))
        const key = `wish-${item.id}-${now.slice(0,10)}`
        const { data: existing, error: existingError } = await db.from('notifications').select('user_id').eq('workspace_id', item.workspace_id).contains('meta', { dedupe_key: key }).in('user_id', ids)
        if (existingError) throw existingError
        const seen = new Set((existing ?? []).map((n: { user_id: string }) => n.user_id))
        const rows = ids.filter((id: string) => !disabled.has(id) && !seen.has(id)).map((user_id: string) => ({ user_id, workspace_id: item.workspace_id, tipo: 'wishlist', titulo: alert === 'alvo' ? 'Preço-alvo atingido' : 'Preço caiu', corpo: `${item.titulo}: ${(price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, meta: { dedupe_key: key, item_id: item.id } }))
        if (rows.length) { const { error: notificationError } = await db.from('notifications').insert(rows); if (notificationError) throw notificationError; alertas += rows.length }
      } catch (e) { console.error('Falha no monitoramento', e); erros++ }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  return Response.json({ verificados, alertas, erros })
})
