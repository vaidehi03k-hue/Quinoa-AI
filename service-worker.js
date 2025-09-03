
const CACHE_NAME='quinoa-wizard-full-v1';
const SHELL=['./','./index.html','./styles.css','./app.js','./webllm-advanced.js','./wizard.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(SHELL)))});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(url.origin===location.origin){
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
  }
});
