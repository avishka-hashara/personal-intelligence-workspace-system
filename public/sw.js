// Personal Intelligence Workspace - Service Worker for PWA Offline Support & Web Push

const CACHE_NAME = "piw-cache-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      ),
    ])
  );
});

// Mandatory fetch event listener for Chrome PWA installability criteria
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip API routes, auth callbacks, and browser extensions
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.protocol.startsWith("chrome")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache static assets dynamically
        if (
          response &&
          response.status === 200 &&
          (url.pathname.startsWith("/icons/") ||
            url.pathname.startsWith("/_next/static/") ||
            url.pathname.endsWith(".png") ||
            url.pathname.endsWith(".svg") ||
            url.pathname === "/manifest.webmanifest")
        ) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response("Offline", { status: 503, statusText: "Offline" });
      })
  );
});

// Web Push Notifications
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "You have a new reminder." };
  }

  const title = data.title || "Personal Intelligence Workspace";
  const options = {
    body: data.body || "You have a scheduled reminder.",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    data: {
      url: data.url || "/",
      occurrenceId: data.occurrenceId,
    },
    tag: data.tag || "piw-reminder",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
