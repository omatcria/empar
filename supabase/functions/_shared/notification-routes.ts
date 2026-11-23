// Mapa de tipos de notificação compartilhado entre o app (Vite) e as Edge Functions (Deno).
// TypeScript puro: sem imports de Node, Deno ou navegador.

export type NotificationTipo =
  | 'membro_lancamento'
  | 'membro_desejo'
  | 'reaction'
  | 'venc_fatura'
  | 'venc_conta'
  | 'venc_recorrencia'
  | 'venc_divida'
  | 'orcamento_80'
  | 'mei'
  | 'wishlist'
  | 'teste'

/** Espelho de `notification_pref_column` (SQL). `null` = sempre envia. */
export const NOTIFICATION_PREF_BY_TIPO: Record<NotificationTipo, string | null> = {
  membro_lancamento: 'membros_lancamentos',
  membro_desejo: 'membros_desejos',
  reaction: 'reacoes',
  venc_fatura: 'venc_faturas',
  venc_conta: 'venc_contas',
  venc_recorrencia: 'venc_recorrencias',
  venc_divida: 'venc_dividas',
  orcamento_80: 'orcamento_80',
  mei: 'mei_alertas',
  wishlist: 'wishlist_precos',
  teste: null,
}

const ROUTE_BY_TIPO: Record<NotificationTipo, string> = {
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

export function notificationRoute(tipo: string): string {
  return Object.prototype.hasOwnProperty.call(ROUTE_BY_TIPO, tipo)
    ? ROUTE_BY_TIPO[tipo as NotificationTipo]
    : '/'
}

export interface PushPayload {
  title: string
  body: string
  url: string
  tag: string
  notification_id: string
  icon: string
  badge: string
}

export function buildPushPayload(n: {
  id: string
  tipo: string
  titulo: string
  corpo: string | null
}): PushPayload {
  return {
    title: n.titulo,
    body: n.corpo ?? '',
    url: notificationRoute(n.tipo),
    tag: n.tipo,
    notification_id: n.id,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
  }
}

/** Inscrição expirada/removida no serviço de push (404/410) deve ser apagada. */
export function shouldRemoveSubscription(status: number): boolean {
  return status === 404 || status === 410
}
