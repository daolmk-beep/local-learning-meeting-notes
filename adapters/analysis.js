// AnalysisAdapter — 전사 어댑터와 대칭. 분석이 이 앱의 핵심.
//   ApiLlmAdapter   : 기본. fetch로 LLM API 호출 (Anthropic 기본 / OpenAI 분기).
//   ManualLlmAdapter: 폴백. 프롬프트를 화면에 만들어 복사 → 외부 LLM 결과를 붙여넣어 파싱.
//   RuleBasedAdapter: 최소 폴백. 신호어 기반 추출. API/네트워크 없을 때.
import { COMMON_SYSTEM, buildUserPrompt } from "../modules/prompts.js";

// ---- JSON 파싱 (코드펜스 방어): 첫 { ~ 마지막 } ----
export function extractJson(text) {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

// ---- 공급자별 호출 ----
async function callAnthropic({ apiKey, model, endpoint, maxTokens }, system, user) {
  const res = await fetch(endpoint || "https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: model || "claude-opus-4-8",
      max_tokens: maxTokens || 8000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

async function callOpenAI({ apiKey, model, endpoint, maxTokens }, system, user) {
  const res = await fetch(endpoint || "https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || "gpt-4o",
      max_tokens: maxTokens || 8000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

function callProvider(settings, system, user) {
  if (settings.provider === "openai") return callOpenAI(settings, system, user);
  return callAnthropic(settings, system, user);
}

// ---- ApiLlmAdapter ----
export const ApiLlmAdapter = {
  async analyze(transcript, { mode, template, settings }) {
    const system = COMMON_SYSTEM;
    const user = buildUserPrompt(mode, template, transcript);

    // 1차 시도
    let raw = await callProvider(settings, system, user);
    let result = extractJson(raw);

    // 파싱 실패 → 1회 재요청 (JSON만 강조)
    if (!result) {
      const stricter = user + "\n\n[중요] 반드시 유효한 JSON 객체 1개만 출력하라. 코드펜스(```)와 설명 문장을 절대 붙이지 마라.";
      raw = await callProvider(settings, system, stricter);
      result = extractJson(raw);
    }

    if (!result) {
      const err = new Error("JSON 파싱 실패");
      err.code = "PARSE_FAILED";
      throw err;
    }
    return { engine: "api", externalSent: true, result };
  },
};

// ---- ManualLlmAdapter (오프라인·무비용 경로) ----
export const ManualLlmAdapter = {
  // 사용자가 외부 LLM에 붙여넣을 전체 프롬프트를 만든다.
  buildPrompt(transcript, { mode, template }) {
    return COMMON_SYSTEM + "\n\n" + buildUserPrompt(mode, template, transcript);
  },
  // 외부 LLM이 돌려준 텍스트를 파싱한다.
  parse(pastedText) {
    const result = extractJson(pastedText);
    if (!result) {
      const err = new Error("붙여넣은 텍스트에서 JSON을 찾지 못했습니다.");
      err.code = "PARSE_FAILED";
      throw err;
    }
    // 앱이 직접 전송한 게 아니므로 externalSent=false (사용자 수동 전송)
    return { engine: "manual", externalSent: false, result };
  },
};

// ---- RuleBasedAdapter (최소 폴백) ----
function splitSentences(text) {
  return (text || "")
    .replace(/\r/g, "")
    .split(/[\n.!?。]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

export const RuleBasedAdapter = {
  analyze(transcript, { mode }) {
    const sentences = splitSentences(transcript);
    const summary = sentences.slice(0, 6).join(". ");
    const pick = (kws) =>
      sentences.filter((s) => kws.some((k) => s.includes(k)));

    let result;
    if (mode === "lesson") {
      result = {
        title: "[규칙기반] 수업 정리",
        summary,
        keywords: [],
        concepts: [],
        linkedLearning: { prerequisite: [], next: [], related: [] },
        reviewQuestions: [],
        checkPoints: [],
        _note: "규칙 기반 폴백 결과입니다. API 분석으로 다시 시도하세요.",
      };
    } else {
      result = {
        title: "[규칙기반] 회의 정리",
        summary,
        discussions: sentences.slice(0, 12),
        decisions: pick(["하기로", "결정", "확정"]),
        todos: pick(["해야", "하겠", "할 것", "준비", "전달"]).map((t) => ({
          task: t,
          owner: "미지정",
          due: "미정",
          status: "예정",
        })),
        openIssues: pick(["검토", "보류", "확인 필요", "미정"]),
        nextAgenda: [],
        _note: "규칙 기반 폴백 결과입니다. API 분석으로 다시 시도하세요.",
      };
    }
    return { engine: "rule", externalSent: false, result };
  },
};

// ---- 오케스트레이터: 어댑터 선택 + 폴백 체인 ----
// onStatus(message) 로 진행 상황을 UI에 알릴 수 있다.
export async function analyzeTranscript(transcript, { mode, template, settings, onStatus = () => {} }) {
  const hasKey = !!(settings.apiKey && settings.apiKey.trim());
  let target = settings.analysisMode || "api";

  // 키 없으면 api 불가 → manual로 폴백
  if (target === "api" && !hasKey) {
    onStatus("API 키가 없어 수동 LLM 모드로 전환합니다.");
    target = "manual";
  }

  if (target === "manual") {
    // 수동 모드는 프롬프트만 돌려준다 (호출은 UI에서 복사/붙여넣기로 처리)
    return { mode: "manual", prompt: ManualLlmAdapter.buildPrompt(transcript, { mode, template }) };
  }

  if (target === "rule") {
    onStatus("규칙 기반으로 분석합니다.");
    return RuleBasedAdapter.analyze(transcript, { mode });
  }

  // api
  try {
    onStatus("API로 분석 중…");
    return await ApiLlmAdapter.analyze(transcript, { mode, template, settings });
  } catch (err) {
    onStatus(`API 분석 실패(${err.message}). 규칙 기반으로 폴백합니다.`);
    const fb = RuleBasedAdapter.analyze(transcript, { mode });
    fb.fallbackReason = err.message;
    return fb;
  }
}
