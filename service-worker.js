
const CACHE='quinoa-present-v1';
const SHELL=['./','./index.html','./styles.css','./app.js','./webllm-advanced.js','./presentation.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)))});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url); if(u.origin===location.origin){e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));}});