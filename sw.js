const CACHE_NAME = "safe-automaton-shell-v1";
const APP_SHELL = ["/", "/manifest.webmanifest"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try { await cache.addAll(APP_SHELL); } catch (_) { /* Online-first still works if a shell URL is unavailable. */ }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("safe-automaton-shell-") && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok && (event.request.mode === "navigate" || APP_SHELL.includes(url.pathname))) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      throw error;
    }
  })());
});

self.addEventListener("push", event => {
  let payload = { title: "Safe Automaton", body: "Imate novo obaveštenje.", url: "/" };
  try { if (event.data) payload = { ...payload, ...event.data.json() }; }
  catch (_) { if (event.data) payload.body = event.data.text(); }
  event.waitUntil(self.registration.showNotification(payload.title || "Safe Automaton", {
    body: payload.body || "Otvorite aplikaciju za detalje.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag || "safe-automaton",
    data: { url: typeof payload.url === "string" && payload.url.startsWith("/") ? payload.url : "/" },
    requireInteraction: payload.urgent === true
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = event.notification.data && event.notification.data.url;
  const safeTarget = typeof target === "string" && target.startsWith("/") ? target : "/";
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(safeTarget);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(safeTarget);
  })());
});