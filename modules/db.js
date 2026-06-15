// IndexedDB 래퍼 — records / settings 두 스토어.
// 모든 데이터(전사문·분석결과·설정)는 이 기기에만 저장된다. 외부 저장 없음.

const DB_NAME = "llmn";
const DB_VERSION = 1;
const STORE_RECORDS = "records";
const STORE_SETTINGS = "settings";

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        const s = db.createObjectStore(STORE_RECORDS, { keyPath: "id" });
        s.createIndex("createdAt", "createdAt");
        s.createIndex("mode", "mode");
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(store, mode) {
  return openDB().then((db) => db.transaction(store, mode).objectStore(store));
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---- records ----
export async function putRecord(record) {
  const store = await tx(STORE_RECORDS, "readwrite");
  await reqToPromise(store.put(record));
  return record;
}

export async function getRecord(id) {
  const store = await tx(STORE_RECORDS, "readonly");
  return reqToPromise(store.get(id));
}

export async function getAllRecords() {
  const store = await tx(STORE_RECORDS, "readonly");
  const all = await reqToPromise(store.getAll());
  return all.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export async function deleteRecord(id) {
  const store = await tx(STORE_RECORDS, "readwrite");
  await reqToPromise(store.delete(id));
}

export async function clearRecords() {
  const store = await tx(STORE_RECORDS, "readwrite");
  await reqToPromise(store.clear());
}

// ---- settings (key-value) ----
export async function getSetting(key, fallback = null) {
  const store = await tx(STORE_SETTINGS, "readonly");
  const row = await reqToPromise(store.get(key));
  return row ? row.value : fallback;
}

export async function setSetting(key, value) {
  const store = await tx(STORE_SETTINGS, "readwrite");
  await reqToPromise(store.put({ key, value }));
}

export async function getAllSettings() {
  const store = await tx(STORE_SETTINGS, "readonly");
  const rows = await reqToPromise(store.getAll());
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}
