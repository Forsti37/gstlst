// Loaded into the service worker through workbox.importScripts. Shows pushes, and opens the app
// on tap. A push with the same tag replaces the earlier one, without buzzing a second time.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // Not ours or broken: still show something, because browsers require a visible notification.
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'GSTLST', {
      body: data.body || '',
      tag: data.tag,
      icon: 'icons/icon-192.png',
      data: { url: data.url || '' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const client = clients[0]
      if (!client) return self.clients.openWindow(target)
      await client.focus()
      return client.navigate(target)
    }),
  )
})
