const VERSION="2026-11-14a";
const root=new URL("./",self.registration.scope);
const prefix="duofit:"+root.pathname+":";
const cacheKey=prefix+VERSION;
const shell=new URL("index.html",root).href;
const assets=["index.html","manifest.webmanifest","icon-192.png","icon-512.png"].map(p=>new URL(p,root).href);
self.addEventListener("install",event=>event.waitUntil((async()=>{
  const cache=await caches.open(cacheKey);
  await cache.addAll(assets.map(url=>new Request(url,{cache:"reload"})));
  await self.skipWaiting();
})()));
self.addEventListener("activate",event=>event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith(prefix)&&name!==cacheKey)await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener("fetch",event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=="GET"||url.origin!==root.origin||url.searchParams.has("nocache"))return;
  if(request.mode==="navigate"&&[root.pathname,new URL(shell).pathname].includes(url.pathname)){
    event.respondWith((async()=>{
      const cache=await caches.open(cacheKey);
      try{
        const response=await fetch(request,{cache:"no-cache"});
        if(response.ok&&response.headers.get("content-type")?.includes("text/html")){
          await cache.put(shell,response.clone());return response;
        }
        return await cache.match(shell)||response;
      }catch(error){const copy=await cache.match(shell);if(copy)return copy;throw error}
    })());
  }else if(assets.includes(url.href)){
    event.respondWith(caches.open(cacheKey).then(async cache=>(await cache.match(url.href))||fetch(request)));
  }
});
