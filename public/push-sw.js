/* Service worker de push do Empar — carregado pelo SW do Workbox via importScripts. */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Empar'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/badge-72.png',
      tag: data.notification_id || data.tag,
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  let resolved
  try {
    resolved = new URL(url, self.location.origin)
  } catch {
    resolved = null
  }
  const target =
    resolved && resolved.origin === self.location.origin ? resolved.href : self.location.origin + '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin) {
          return client
            .focus()
            .then((c) => (c && 'navigate' in c ? c.navigate(target) : undefined))
            .catch(() => self.clients.openWindow(target))
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
