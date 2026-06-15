// TranscriptionAdapter — 분석 어댑터와 대칭 구조.
//   ManualTranscriptAdapter : 1단계 동작. 사용자 입력을 그대로 반환.
//   CloudSttAdapter         : M2에서 구현 (브라우저 → STT API, 사용자 키). 지금은 placeholder.
//   LocalWhisperAdapter     : M4 (WASM). placeholder.

export const ManualTranscriptAdapter = {
  status: "ok",
  async transcribe(input) {
    // input: { text } — 사용자가 입력/받아쓰기한 텍스트
    return { text: (input && input.text) || "", engine: "manual" };
  },
};

export const CloudSttAdapter = {
  status: "not_implemented", // M2에서 구현 예정 (route B 핵심)
  async transcribe() {
    throw new Error("CloudSttAdapter는 M2에서 구현됩니다.");
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
