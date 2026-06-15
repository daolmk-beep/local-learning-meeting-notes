// 서비스워커 — 앱 셸 캐시 (네트워크 우선 + 타임아웃 폴백).
// 전략: 동일 출처 셸 자원은 네트워크를 먼저 시도해 항상 최신 코드를 받고,
//   네트워크가 느리거나(3초 초과) 끊기면 캐시로 폴백해 오프라인 열람을 보장한다.
//   성공한 응답은 캐시를 갱신해 둔다(다음 오프라인 대비).
// 과거 기록은 IndexedDB에 있으므로 셸만 살아 있으면 오프라인에서도 열람 가능.
// 분석/STT API 호출(교차출처)은 캐시하지 않고 항상 네트워크로 보낸다.

const CACHE = "llmn-shell-v4"; // M3: 네트워크 우선 + 타임아웃 폴백
const NET_TIMEOUT_MS = 3000;

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
  "./modules/export.js",
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

// 네트워크를 시도하되 NET_TIMEOUT_MS 안에 못 받으면 캐시로 폴백.
// 성공 응답(ok)은 캐시에 갱신해 둔다. 실패/타임아웃이면 캐시, 캐시도 없으면 네트워크 결과를 그대로 반환.
async function networkFirst(req, fallbackKey) {
  const cache = await caches.open(CACHE);
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), NET_TIMEOUT_MS);
  });

  try {
    const res = await Promise.race([fetch(req), timeout]);
    if (res) {
      if (res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    }
    // 타임아웃 → 캐시 폴백
  } catch {
    // 네트워크 오류 → 캐시 폴백
  } finally {
    clearTimeout(timer);
  }

  const cached =
    (await cache.match(req)) || (fallbackKey ? await cache.match(fallbackKey) : undefined);
  if (cached) return cached;

  // 캐시도 없으면 네트워크를 끝까지 한 번 더 기다린다(폴백할 게 없으므로).
  return fetch(req);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // 동일 출처(앱 셸)만 처리. API 등 교차출처는 그대로 네트워크로.
  if (url.origin !== self.location.origin) return;

  // 내비게이션 요청은 index.html을 폴백 키로.
  const fallbackKey = req.mode === "navigate" ? "./index.html" : null;
  event.respondWith(networkFirst(req, fallbackKey));
});
