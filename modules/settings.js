// 설정 로드/저장 — IndexedDB settings 스토어 사용.
// API Key는 코드에 하드코딩하지 않는다. 사용자가 설정 화면에서 입력해 이 기기에만 저장.
import { getSetting, setSetting } from "./db.js";

export const DEFAULT_SETTINGS = {
  // 분석 어댑터
  analysisMode: "api", // "api" | "manual" | "rule"
  provider: "anthropic", // "anthropic" | "openai"
  apiKey: "", // 분석용 LLM 키
  model: "claude-opus-4-8",
  endpoint: "https://api.anthropic.com/v1/messages",
  maxTokens: 8000,

  // 회의 모드 외부 전송
  meetingApiAlwaysAllow: false, // 기본 off — 매번 경고/동의

  // 전사 (M2) — 클라우드 STT (route B: 브라우저 → STT API 직접 호출)
  sttProvider: "openai", // "openai" | "deepgram"
  sttApiKey: "",
  sttModel: "whisper-1",
  sttEndpoint: "https://api.openai.com/v1/audio/transcriptions",

  // 오디오 외부 전송(클라우드 STT) — 전사 텍스트 경고와 별개의 추가 동의.
  // 기본 off(opt-in). 회의 모드는 매번 더 보수적으로 경고.
  sttAudioAlwaysAllow: false,
};

const KEY = "settings";

let _cache = null;

export async function loadSettings() {
  if (_cache) return _cache;
  const stored = (await getSetting(KEY)) || {};
  _cache = { ...DEFAULT_SETTINGS, ...stored };
  return _cache;
}

export async function saveSettings(patch) {
  const current = await loadSettings();
  _cache = { ...current, ...patch };
  await setSetting(KEY, _cache);
  return _cache;
}

export function getCached() {
  return _cache || { ...DEFAULT_SETTINGS };
}
