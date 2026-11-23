import { timingSafeEqual } from 'node:crypto'
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { buildPushPayload, shouldRemoveSubscription } from '../_shared/notification-routes.ts'

interface Subscription { id: string; endpoint: string; p256dh: string; auth: string }

Deno.serve(async (req: Request) => {
  const expected = Deno.env.get('PUSH_WEBHOOK_SECRET')
  const supplied = req.headers.get('x-push-secret')
  const enc = new TextEncoder()
  if (!expected || !supplied || enc.encode(supplied).length !== enc.encode(expected).length
    || !timingSafeEqual(enc.encode(supplied), enc.encode(expected))) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }
  if (req.method !== 'POST') return Response.json({ error: 'Método não permitido' }, { status: 405 })

  let notificationId: unknown
  try { notificationId = (await req.json())?.notification_id } catch { notificationId = null }
  if (typeof notificationId !== 'string' || !notificationId) {
    return Response.json({ error: 'notification_id obrigatório' }, { status: 400 })
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: notification, error } = await db.from('notifications')
    .select('id,user_id,tipo,titulo,corpo').eq('id', notificationId).maybeSingle()
  if (error) {
    console.error('Falha ao ler notificação', error)
    return Response.json({ error: 'Falha ao consultar notificação' }, { status: 500 })
  }
  if (!notification) return Response.json({ error: 'Notificação não encontrada' }, { status: 404 })

  const { data: subs, error: subsError } = await db.from('push_subscriptions')
    .select('id,endpoint,p256dh,auth').eq('user_id', notification.user_id)
  if (subsError) {
    console.error('Falha ao ler inscrições', subsError)
    return Response.json({ error: 'Falha ao consultar inscrições' }, { status: 500 })
  }
  const subscriptions = (subs ?? []) as Subscription[]
  if (!subscriptions.length) return Response.json({ sent: 0, removed: 0, failed: 0 })

  try {
    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT')!,
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    )
  } catch (e) {
    console.error('VAPID inválido', e)
    return Response.json({ error: 'Configuração VAPID inválida' }, { status: 500 })
  }

  const payload = JSON.stringify(buildPushPayload(notification))
  let sent = 0, removed = 0, failed = 0
  await Promise.all(subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 86400 },
      )
      sent++
      const { error: updateError } = await db.from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString() }).eq('id', sub.id)
      if (updateError) console.error('Falha ao atualizar last_used_at', updateError)
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode ?? 0
      if (shouldRemoveSubscription(status)) {
        const { error: deleteError } = await db.from('push_subscriptions').delete().eq('id', sub.id)
        if (deleteError) console.error('Falha ao remover inscrição', deleteError)
        removed++
      } else {
        console.error('Falha no envio push', status, (e as Error).message)
        failed++
      }
    }
  }))
  return Response.json({ sent, removed, failed })
})
