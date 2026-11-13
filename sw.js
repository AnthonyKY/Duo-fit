// DUOFIT offline support: network first (so updates arrive as soon as there is signal),
// cached copy when the gym has no network. Version checks (?nocache=) are never served from cache.
const CACHE="duofit-v1";
const SHELL=["./","./index.html","./manifest.webmanifest","./icon-180.png","./icon-192.png","./icon-512.png"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
function keyOf(url){const u=new URL(url);return u.origin+u.pathname}
function withTimeout(promise,ms){return new Promise((resolve,reject)=>{const id=setTimeout(()=>reject(new Error("timeout")),ms);promise.then(v=>{clearTimeout(id);resolve(v)},e=>{clearTimeout(id);reject(e)})})}
self.addEventListener("fetch",event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=="GET"||url.origin!==self.location.origin)return;
  if(url.searchParams.has("nocache"))return; // update check: network only
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const response=await withTimeout(fetch(request),request.mode==="navigate"?4000:8000);
      if(response&&response.ok)cache.put(keyOf(request.url),response.clone());
      return response;
    }catch(error){
      const hit=await cache.match(keyOf(request.url))||await cache.match(request,{ignoreSearch:true});
      if(hit)return hit;
      if(request.mode==="navigate"){const shell=await cache.match(keyOf(new URL("./",self.location).href))||await cache.match(keyOf(new URL("./index.html",self.location).href));if(shell)return shell}
      throw error;
    }
  })());
});
