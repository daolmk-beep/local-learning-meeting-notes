// 서비스워커 — 앱 셸 오프라인 캐시.
// 과거 기록은 IndexedDB에 있으므로, 셸만 캐시되면 오프라인에서도 열람 가능.
// 분석/STT API 호출(교차출처)은 캐시하지 않고 항상 네트워크로 보낸다.

const CACHE = "llmn-shell-v2"; // M2

const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./modules/db.js",
  "./modules/model.js",
  "./modules/prompts.js",
  "./modules/settings.js",
  "./modules/ui.js",
  "./modules/recorder.js",
  "./adapters/analysis.js",
  "./adapters/transcription.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // 동일 출처(앱 셸)만 처리. API 등 교차출처는 그대로 네트워크로.
  if (url.origin !== self.location.origin) return;

  // 내비게이션 요청은 캐시된 index.html로 폴백(오프라인 열람).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // 셸 자원: 캐시 우선, 없으면 네트워크 후 캐시에 채움.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
