// Record 데이터 모델 — 지시문 5.1 + 추가 필드.
// record.meeting.template : "general" | "fdd" | "ma" | "negotiation"
// record.analysis.engine  : "api" | "manual" | "rule"
// record.analysis.externalSent : 외부 전송 여부 감사 로그

export const MODES = ["lesson", "meeting"];

export const MODE_LABELS = {
  lesson: "수업",
  meeting: "회의",
};

export const TEMPLATES = ["general", "fdd", "ma", "negotiation"];

export const TEMPLATE_LABELS = {
  general: "일반 회의",
  fdd: "FDD 인터뷰",
  ma: "M&A 거래처 미팅",
  negotiation: "거래처 협상",
};

export const ENGINE_LABELS = {
  api: "API 분석",
  manual: "수동 LLM",
  rule: "규칙 기반",
};

function uid() {
  return (
    "rec_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8)
  );
}

// 새 기록 생성
export function createRecord({ mode, template = "general", title = "", transcript = "" }) {
  const now = new Date().toISOString();
  return {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    mode, // "lesson" | "meeting"
    title: title || "",
    meeting: {
      template: mode === "meeting" ? template : null,
    },
    transcription: {
      engine: "manual", // manual | cloud | local (M2~)
      text: transcript,
    },
    transcript, // 편의 접근용 (transcription.text와 동기)
    audioBlobId: null, // M2: 녹음 백업 연결
    analysis: {
      engine: null, // "api" | "manual" | "rule"
      externalSent: false, // 전사 텍스트 외부 전송 여부
      result: null, // 구조화 JSON
      error: null,
      analyzedAt: null,
    },
    keywords: [], // 목록 표시용 (분석 후 채움)
  };
}

// 분석 결과를 기록에 반영
export function applyAnalysis(record, { engine, externalSent, result }) {
  record.analysis = {
    engine,
    externalSent: !!externalSent,
    result: result || null,
    error: null,
    analyzedAt: new Date().toISOString(),
  };
  // 목록 표시용 키워드 / 제목 보정
  if (result) {
    if (!record.title && result.title) record.title = result.title;
    record.keywords = Array.isArray(result.keywords) ? result.keywords.slice(0, 6) : [];
  }
  record.updatedAt = new Date().toISOString();
  return record;
}
