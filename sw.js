/* WG-App Service Worker
   Macht die App nach dem ersten Online-Besuch vollständig offline-lauffähig:
   App-Shell + Bibliotheken (React/Babel/Firebase-SDK, selbst gehostet unter vendor/) + Schriften (fonts/)
   werden gecacht. Der Firebase-Realtime-Sync läuft weiter übers Netz (nie gecacht).
   Cache-Name bei jedem Deploy mit relevanter Änderung hochzählen. */
const CACHE = 'wg-v74';
/* Stabiler Cache OHNE Versions-Suffix, überlebt Deploys. Hier liegen nur Dateien, deren Name sich bei jeder
   inhaltlichen Änderung mitändert (vendor/ mit Version, fonts/ mit Inhalts-Hash). Vorher wurden solche Dateien beim activate-Cleanup jedes Deploys mitgelöscht: bis zum
   nächsten vollen Online-Load war die App offline ein weißer Screen (HTML da, Skripte weg). */
const CDN_CACHE = 'wg-cdn';
const SHELL = ['./', './wgapp.html', './manifest.json', './icon.svg'];
/* Selbst gehostete Bibliotheken + Schriften: schon beim Installieren laden. Babel wird nach JEDEM Deploy
   einmal gebraucht (der JSX-Cache ist dann ungültig) und muss auch offline da sein.
   Datei getauscht? Neuen Namen hier eintragen — der alte fliegt beim activate raus. */
const IMMUTABLE = [
  './vendor/react-18.3.1.production.min.js',
  './vendor/react-dom-18.3.1.production.min.js',
  './vendor/babel-standalone-7.25.6.min.js',
  './vendor/firebase-app-compat-12.19.0.js',
  './vendor/firebase-database-compat-12.19.0.js',
  './fonts/hanken-grotesk-latin-e9201edd.woff2',
  './fonts/hanken-grotesk-latin-ext-768af292.woff2',
  './fonts/unbounded-latin-22f9b928.woff2',
  './fonts/unbounded-latin-ext-845e1c9f.woff2',
  './fonts/spline-sans-mono-latin-46b7dcaf.woff2',
  './fonts/spline-sans-mono-latin-ext-0ca9a398.woff2',
];
const IMMUTABLE_ABS = IMMUTABLE.map(u => new URL(u, self.location).href);

/* Selbst gehostete, versionierte Dateien unter vendor/ und fonts/ */
const isImmutable = url => url.startsWith(self.location.origin) && /\/(vendor|fonts)\/[^/]+$/.test(new URL(url).pathname);

/* Live-Sync & Auth dürfen NIE aus dem Cache kommen */
const isLiveData = url =>
  /firebasedatabase\.app/.test(url) ||
  /firebaseio\.com/.test(url) ||
  /firebaseinstallations\.googleapis\.com/.test(url) ||
  /identitytoolkit\.googleapis\.com/.test(url);

// Nur Fehlendes holen — sonst lädt jedes Deploy die 2,9 MB Babel erneut herunter
const precacheImmutable = () => caches.open(CDN_CACHE).then(c =>
  Promise.all(IMMUTABLE_ABS.map(u => c.match(u).then(hit => hit || c.add(u).catch(() => {})))));

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(Promise.all([
    caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}),
    precacheImmutable(),
  ]));
});

/* Aufräumen: alte Versions-Caches weg; im stabilen Cache alles, was nicht mehr gebraucht wird —
   die früheren CDN-Kopien (unpkg, Google Fonts, gstatic-Firebase, ~3,2 MB) und abgelöste vendor/fonts-Versionen. */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== CDN_CACHE).map(k => caches.delete(k))))
      .then(() => caches.open(CDN_CACHE))
      .then(c => c.keys().then(rs => Promise.all(rs
        .filter(r => /unpkg\.com|fonts\.(googleapis|gstatic)\.com|www\.gstatic\.com\/firebasejs/.test(r.url) || (isImmutable(r.url) && !IMMUTABLE_ABS.includes(r.url)))
        .map(r => c.delete(r)))))
      .then(() => self.clients.claim())
  );
});

/* Cache-first, nur für eigene Dateien. Nur ok-Antworten (200er) ablegen — vorher landete auch ein 404 im
   Cache, im stabilen Cache wäre das für immer. (Fremde, opaque Antworten gibt es seit dem Selbst-Hosting nicht mehr.) */
const cacheFirst = (req, cacheName = CACHE) =>
  caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(cacheName).then(c => c.put(req, copy)).catch(() => {});
    }
    return res;
  }));
  // Kein .catch(()=>hit): hit ist hier zwingend undefined (sonst wären wir im hit-Zweig).
  // Schlägt fetch fehl, propagiert die Rejection an respondWith → Browser zeigt sauberen
  // Netzwerkfehler, statt dass respondWith(undefined) selbst einen TypeError wirft.

/* Web-Push: Server (Vercel /api/notify, /api/cron) schickt JSON {title, body, tag, url} */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil(self.registration.showNotification(d.title || 'WG-App', {
    body: d.body || '',
    icon: './icon.svg',
    badge: './icon.svg',
    tag: d.tag || 'wg-push',
    data: { url: d.url || './' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  // Nur eigene Seiten öffnen — auch falls der Server einmal einen fremden Link durchließe (Phishing-Schutz, doppelt)
  let url = (e.notification.data && e.notification.data.url) || './';
  try { if (new URL(url, self.location).origin !== self.location.origin) url = './'; } catch (_) { url = './'; }
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;

  if (isLiveData(url)) return;                 // durchlassen, nie cachen
  if (isImmutable(url)) { e.respondWith(cacheFirst(req, CDN_CACHE)); return; }

  // Navigationen: network-first (frische App), Offline-Fallback aus Cache
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./wgapp.html', copy));
        return res;
      }).catch(() => caches.match('./wgapp.html').then(h => h || caches.match('./')))
    );
    return;
  }

  // Übrige gleich-origin Assets: cache-first
  if (url.startsWith(self.location.origin)) e.respondWith(cacheFirst(req));
});
