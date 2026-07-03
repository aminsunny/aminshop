const CACHE = "aminshop-v4";
const FILES = [
    "/aminshop/",
    "/aminshop/index.html",
    "/aminshop/app.js",
    "/aminshop/sheets.js",
    "/aminshop/manifest.json",
    "/aminshop/favicon.ico",
    "/aminshop/icons/icon-192.png",
    "/aminshop/icons/icon-512.png",
];

// نصب — همه فایل‌ها رو cache کن
self.addEventListener("install", e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(FILES))
    );
    self.skipWaiting(); // فوری فعال بشه
});

// فعال‌سازی — cache قدیمی رو پاک کن
self.addEventListener("activate", e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim()) // همه تب‌ها رو کنترل کن
    );
});

// درخواست‌ها — اول cache، بعد شبکه (Cache First)
self.addEventListener("fetch", e => {
    const url = new URL(e.request.url);

    // درخواست‌های Google Apps Script رو cache نکن (همیشه از شبکه)
    if (url.hostname.includes("script.google.com") ||
        url.hostname.includes("googleapis.com") ||
        url.hostname.includes("fonts.googleapis.com")) {
        e.respondWith(fetch(e.request).catch(() => new Response("", {status: 503})));
        return;
    }

    // بقیه فایل‌ها — اول cache، اگه نبود از شبکه
    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;
            return fetch(e.request).then(response => {
                // فایل‌های اپ رو cache کن
                if (response.ok && url.origin === self.location.origin) {
                    const clone = response.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return response;
            }).catch(() => {
                // آفلاین — اگه index.html خواسته شد، از cache بده
                if (e.request.destination === "document") {
                    return caches.match("/aminshop/index.html");
                }
            });
        })
    );
});
