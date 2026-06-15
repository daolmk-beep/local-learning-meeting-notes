// TranscriptionAdapter — 분석 어댑터와 대칭 구조.
//   ManualTranscriptAdapter : 텍스트 직접 입력/받아쓰기를 그대로 반환.
//   CloudSttAdapter         : M2 구현. 브라우저 → STT API 직접 호출(사용자 키). route B 핵심.
//   LocalWhisperAdapter     : M4 (WASM). placeholder.

export const ManualTranscriptAdapter = {
  status: "ok",
  async transcribe(input) {
    // input: { text } — 사용자가 입력/받아쓰기한 텍스트
    return { text: (input && input.text) || "", engine: "manual" };
  },
};

// 오디오 mime → 파일명 확장자 (OpenAI는 확장자로 포맷을 추론한다)
function blobFilename(blob) {
  const t = (blob && blob.type) || "";
  if (t.includes("webm")) return "audio.webm";
  if (t.includes("mp4") || t.includes("m4a")) return "audio.mp4";
  if (t.includes("ogg")) return "audio.ogg";
  if (t.includes("wav")) return "audio.wav";
  if (t.includes("mpeg") || t.includes("mp3")) return "audio.mp3";
  return "audio.webm";
}

export const CloudSttAdapter = {
  status: "ok", // M2: 구현됨 (현재 OpenAI Whisper. Deepgram은 후속)
  // input: { blob, settings, onStatus }
  async transcribe({ blob, settings, onStatus = () => {} }) {
    if (!blob || !blob.size) throw new Error("전사할 오디오가 없습니다.");
    const provider = settings.sttProvider || "openai";
    if (!settings.sttApiKey || !settings.sttApiKey.trim()) {
      throw new Error("STT API 키가 설정되지 않았습니다. 설정에서 입력하세요.");
    }

    if (provider === "openai") {
      onStatus("클라우드 STT(OpenAI Whisper)로 전사 중…");
      const fd = new FormData();
      fd.append("file", blob, blobFilename(blob));
      fd.append("model", settings.sttModel || "whisper-1");
      // multipart 경계는 브라우저가 자동 설정하므로 content-type 헤더를 직접 넣지 않는다.
      const res = await fetch(
        settings.sttEndpoint || "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { authorization: `Bearer ${settings.sttApiKey}` },
          body: fd,
        }
      );
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`OpenAI STT ${res.status}: ${t.slice(0, 300)}`);
      }
      const data = await res.json().catch(() => ({}));
      return { text: data.text || "", engine: "cloud" };
    }

    // Deepgram (화자분리) — 후속. 키만 잡아두고 미구현 안내.
    throw new Error(`STT 공급자 "${provider}"는 아직 구현되지 않았습니다. (현재 OpenAI Whisper만 지원)`);
  },
};

export const LocalWhisperAdapter = {
  status: "not_implemented", // M4 (WASM Whisper)
  async transcribe() {
    throw new Error("LocalWhisperAdapter는 M4에서 구현됩니다.");
  },
};

export function getTranscriptionAdapter(engine) {
  switch (engine) {
    case "cloud":
      return CloudSttAdapter;
    case "local":
      return LocalWhisperAdapter;
    case "manual":
    default:
      return ManualTranscriptAdapter;
  }
}

// ---- 연결 테스트 (CORS 조기 검증) ----
// route B 전체가 "브라우저 → 클라우드 직접호출(CORS)" 가정 위에 선다.
// 판정 원칙: fetch가 TypeError로 거부 = CORS/네트워크 차단.
//            HTTP 응답이 오면(상태코드 무관) CORS는 통과한 것.

function classifyFetchError(err) {
  // 브라우저는 CORS 차단/네트워크 실패를 TypeError("Failed to fetch")로 던진다.
  if (err && err.name === "TypeError") {
    return {
      ok: false,
      cors: false,
      message:
        "요청이 응답 없이 거부됨 — CORS 차단 또는 네트워크 오류 가능성. (route B 직접호출 불가 시 프록시 필요)",
    };
  }
  return { ok: false, cors: null, message: err ? err.message : "알 수 없는 오류" };
}

// 분석 API(Anthropic / OpenAI 호환) 연결 테스트
export async function testAnalysisConnection(settings) {
  const provider = settings.provider || "anthropic";
  try {
    if (provider === "anthropic") {
      const res = await fetch(settings.endpoint || "https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": settings.apiKey || "",
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: settings.model || "claude-opus-4-8",
          max_tokens: 8,
          messages: [{ role: "user", content: "ping" }],
        }),
      });
      return interpretResponse(res, "Anthropic");
    }
    // openai 호환
    const res = await fetch(settings.endpoint || "https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${settings.apiKey || ""}`,
      },
      body: JSON.stringify({
        model: settings.model || "gpt-4o",
        max_tokens: 8,
        messages: [{ role: "user", content: "ping" }],
      }),
    });
    return interpretResponse(res, "OpenAI");
  } catch (err) {
    return classifyFetchError(err);
  }
}

// STT API 연결 테스트 — 짧은 무음 WAV로 실제 엔드포인트(CORS) 검증
export async function testSttConnection(settings) {
  const provider = settings.sttProvider || "openai";
  if (provider !== "openai") {
    return { ok: false, cors: null, message: `"${provider}"는 아직 미지원(현재 OpenAI Whisper만).` };
  }
  try {
    const fd = new FormData();
    fd.append("file", makeSilentWav(), "test.wav");
    fd.append("model", settings.sttModel || "whisper-1");
    const res = await fetch(
      settings.sttEndpoint || "https://api.openai.com/v1/audio/transcriptions",
      { method: "POST", headers: { authorization: `Bearer ${settings.sttApiKey || ""}` }, body: fd }
    );
    return interpretResponse(res, "OpenAI STT");
  } catch (err) {
    return classifyFetchError(err);
  }
}

async function interpretResponse(res, label) {
  // 여기까지 왔다 = CORS 통과(HTTP 응답을 받음).
  if (res.ok) {
    return { ok: true, cors: true, message: `${label} 연결 정상 (CORS 통과, 키 유효).` };
  }
  const body = await res.text().catch(() => "");
  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      cors: true,
      message: `${label} CORS는 통과 — 단 인증 실패(${res.status}). API 키를 확인하세요.`,
    };
  }
  return {
    ok: false,
    cors: true,
    message: `${label} CORS는 통과 — HTTP ${res.status}: ${body.slice(0, 200)}`,
  };
}

// 약 0.1초 무음 16-bit PCM mono WAV (테스트용, 약 1.7KB)
function makeSilentWav(sampleRate = 8000, seconds = 0.1) {
  const numSamples = Math.floor(sampleRate * seconds);
  const dataSize = numSamples * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(buf);
  const wstr = (off, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
  wstr(0, "RIFF");
  dv.setUint32(4, 36 + dataSize, true);
  wstr(8, "WAVE");
  wstr(12, "fmt ");
  dv.setUint32(16, 16, true);     // PCM chunk size
  dv.setUint16(20, 1, true);      // audio format = PCM
  dv.setUint16(22, 1, true);      // mono
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true); // byte rate
  dv.setUint16(32, 2, true);      // block align
  dv.setUint16(34, 16, true);     // bits per sample
  wstr(36, "data");
  dv.setUint32(40, dataSize, true);
  // 샘플은 0(무음)으로 둠
  return new Blob([buf], { type: "audio/wav" });
}
