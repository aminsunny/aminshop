const CACHE = "aminshop-v2";
const FILES = [
    "/aminshop/index.html",
    "/aminshop/app.js",
    "/aminshop/sheets.js",
    "/aminshop/manifest.json",
    "/aminshop/icons/icon-192.png",
    "/aminshop/icons/icon-512.png",
];

self.addEventListener("install", e =>
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)))
);
self.addEventListener("activate", e =>
    e.waitUntil(caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ))
);
self.addEventListener("fetch", e =>
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)))
);
