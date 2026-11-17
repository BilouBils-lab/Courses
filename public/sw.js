// Service worker : met l'application en cache pour un fonctionnement hors ligne.
// Pensez à incrémenter VERSION à chaque mise en ligne d'une nouvelle version.
const VERSION = 'v5';
const CACHE = `courses-${VERSION}`;
const APP_SHELL = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'firebase-config.js',
  'js/app.js',
  'js/store.js',
  'js/categories.js',
  'js/parse.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('courses-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Bibliothèques Firebase (versionnées, donc immuables) : cache d'abord.
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Le reste des requêtes externes (API Firestore, authentification) n'est pas intercepté :
  // Firestore gère lui-même son cache hors ligne.
  if (url.origin !== self.location.origin) return;

  // Fichiers de l'application : réseau d'abord (pour recevoir les mises à jour),
  // avec repli immédiat sur le cache si le réseau est absent ou trop lent.
  event.respondWith(networkFirst(request, url));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
  return response;
}

async function networkFirst(request, url) {
  const cache = await caches.open(CACHE);
  const fallback = () => cache.match(request, { ignoreSearch: true })
    .then((r) => r || (request.mode === 'navigate' ? cache.match('index.html') : undefined));

  try {
    // En magasin le réseau est souvent très lent : on n'attend pas plus de 2,5 s.
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500)),
    ]);
    if (response.ok && url.pathname.indexOf('/__') !== 0) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await fallback();
    return cached || Response.error();
  }
}
