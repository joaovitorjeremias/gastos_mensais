/* Service worker do Cofrinho: deixa o app abrir mesmo sem internet. */
const VERSAO = "cofrinho-v1";
const CASCA = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];
// Só estes domínios externos entram no cache (fontes e SDK do Firebase).
// Auth e Firestore (googleapis.com / firebaseapp.com) passam direto pela rede.
const EXTERNOS = ["fonts.googleapis.com", "fonts.gstatic.com", "www.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(CASCA)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Páginas: rede primeiro (sempre a versão mais nova), cache se estiver offline.
  // O link mágico de e-mail chega com ?parâmetros, por isso o fallback ignora a query.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(r => { const c = r.clone(); caches.open(VERSAO).then(ch => ch.put("./index.html", c)); return r; })
        .catch(() => caches.match("./index.html", { ignoreSearch: true }))
    );
    return;
  }

  // Arquivos do próprio app: cache primeiro.
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then(h => h || fetch(req)));
    return;
  }

  // Fontes e SDK: usa o cache e atualiza em segundo plano.
  if (EXTERNOS.includes(url.hostname)) {
    e.respondWith(
      caches.open(VERSAO).then(ch =>
        ch.match(req).then(h => {
          const rede = fetch(req).then(r => { if (r.ok || r.type === "opaque") ch.put(req, r.clone()); return r; }).catch(() => h);
          return h || rede;
        })
      )
    );
  }
});
