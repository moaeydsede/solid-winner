// Simple offline cache for static assets (best-effort).
const CACHE = 'fa-suite-pro-v2-2026-02-26';
const ASSETS = [
  './',
  './login.html',
  './index.html',
  './data.html',
  './cfo.html',
  './coa.html',
  './documents.html',
  './period-close.html',
  './fx.html',
  './budgets.html',
  './alerts-pro.html',
  './styles.css',
  './app.js',
  './firebase_client.js',
  './store.js',
  './accounting.js',
  './templates.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', (e)=>{
  const req = e.request;
  // Network-first for Firebase/CDNs
  if(req.url.includes('firebase') || req.url.includes('gstatic') || req.url.includes('cdn.jsdelivr')){
    return;
  }
  e.respondWith(
    caches.match(req).then(cached=> cached || fetch(req).then(res=>{
      const copy = res.clone();
      caches.open(CACHE).then(c=>c.put(req, copy)).catch(()=>{});
      return res;
    }).catch(()=>cached))
  );
});
