/* WG-App Service Worker
   Macht die App nach dem ersten Online-Besuch vollständig offline-lauffähig:
   App-Shell + CDN-Bibliotheken (React/Babel/Firebase/Fonts) werden gecacht.
   Der Firebase-Realtime-Sync läuft weiter übers Netz (nie gecacht).
   Cache-Name bei jedem Deploy mit relevanter Änderung hochzählen. */
const CACHE = 'wg-v23';
const SHELL = ['./', './wgapp.html', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Versionierte Bibliotheken & Fonts — ändern sich nie, daher cache-first */
const isCDN = url =>
  /^https:\/\/unpkg\.com\//.test(url) ||
  /^https:\/\/www\.gstatic\.com\/firebasejs\//.test(url) ||
  /^https:\/\/fonts\.googleapis\.com\//.test(url) ||
  /^https:\/\/fonts\.gstatic\.com\//.test(url);

/* Live-Sync & Auth dürfen NIE aus dem Cache kommen */
const isLiveData = url =>
  /firebasedatabase\.app/.test(url) ||
  /firebaseio\.com/.test(url) ||
  /firebaseinstallations\.googleapis\.com/.test(url) ||
  /identitytoolkit\.googleapis\.com/.test(url);

const cacheFirst = (req) =>
  caches.match(req).then(hit => hit || fetch(req).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
    return res;
  }));
  // Kein .catch(()=>hit): hit ist hier zwingend undefined (sonst wären wir im hit-Zweig).
  // Schlägt fetch fehl, propagiert die Rejection an respondWith → Browser zeigt sauberen
  // Netzwerkfehler, statt dass respondWith(undefined) selbst einen TypeError wirft.

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;

  if (isLiveData(url)) return;                 // durchlassen, nie cachen
  if (isCDN(url)) { e.respondWith(cacheFirst(req)); return; }

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
