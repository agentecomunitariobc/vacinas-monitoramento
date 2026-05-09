// VacinaControl Service Worker v1.0
const CACHE_NAME = 'vacinacontrol-v1';
const STATIC_CACHE = 'vacinacontrol-static-v1';
const DYNAMIC_CACHE = 'vacinacontrol-dynamic-v1';

// Assets to pre-cache for full offline support
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // External CDN libs - cache on first use
];

const CDN_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.6.0/jspdf.plugin.autotable.min.js',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap',
];

// ---- INSTALL ----
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('SW: Some precache failed', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ---- ACTIVATE ----
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ---- FETCH ----
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and browser-extension requests
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Strategy: Cache First for static assets, Network First for HTML
  if (request.destination === 'document') {
    // Network first for the main document
    event.respondWith(networkFirst(request));
  } else if (isCDN(url)) {
    // Cache first for CDN libs (they rarely change)
    event.respondWith(cacheFirst(request, DYNAMIC_CACHE));
  } else if (url.origin === self.location.origin) {
    // Cache first for local assets
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else {
    // Network with dynamic cache fallback
    event.respondWith(networkWithDynamicCache(request));
  }
});

function isCDN(url) {
  return url.hostname.includes('cdnjs.cloudflare.com') ||
         url.hostname.includes('fonts.googleapis.com') ||
         url.hostname.includes('fonts.gstatic.com');
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || offlineFallback();
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
    return response;
  } catch {
    return offlineFallback();
  }
}

async function networkWithDynamicCache(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(DYNAMIC_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || offlineFallback();
  }
}

function offlineFallback() {
  return new Response(
    `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <title>VacinaControl — Offline</title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      body{font-family:sans-serif;background:#0a0f1e;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:20px}
      .icon{font-size:64px;margin-bottom:16px}
      h1{font-size:24px;font-weight:700;margin-bottom:8px}
      p{color:rgba(255,255,255,.5);font-size:14px;margin-bottom:24px}
      button{background:#059669;color:#fff;border:none;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer}
    </style></head><body>
    <div>
      <div class="icon">💉</div>
      <h1>Sem conexão</h1>
      <p>O VacinaControl está funcionando no modo offline.<br>Seus dados locais estão seguros.</p>
      <button onclick="location.reload()">Tentar novamente</button>
    </div></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

// ---- BACKGROUND SYNC (for future use) ----
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // Placeholder for future server sync
  console.log('SW: Background sync triggered');
}

// ---- PUSH NOTIFICATIONS (for future use) ----
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'VacinaControl', {
      body: data.body || 'Nova notificação',
      icon: './icons/icon-192.png',
      badge: './icons/icon-72.png',
      tag: 'vacinacontrol',
      renotify: true,
    })
  );
});
