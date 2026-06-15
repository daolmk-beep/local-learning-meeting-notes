// 앱 진입점 — 뷰 라우팅 + 이벤트 배선.
import { loadSettings, saveSettings } from "./modules/settings.js";
import { createRecord, applyAnalysis } from "./modules/model.js";
import { putRecord, getAllRecords, getRecord, deleteRecord } from "./modules/db.js";
import { analyzeTranscript, ManualLlmAdapter } from "./adapters/analysis.js";
import { renderResult, renderList, renderDetail, esc } from "./modules/ui.js";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

let settings = null;
let pending = null; // { mode, template, title, transcript, analysis:{engine,externalSent,result} }
let detailId = null;

// ---------- 뷰 전환 ----------
function showView(name) {
  $$(".view").forEach((v) => v.classList.add("hidden"));
  $(`#view-${name}`).classList.remove("hidden");
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  if (name === "list") renderListView();
}

// ---------- 모달 (확인) ----------
function confirmModal({ title, body, okText = "계속", cancelText = "취소" }) {
  return new Promise((resolve) => {
    const root = $("#modal-root");
    root.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal">
          <h3>${esc(title)}</h3>
          <p>${esc(body)}</p>
          <div class="actions">
            <button class="ghost" data-act="cancel">${esc(cancelText)}</button>
            <button class="primary" data-act="ok">${esc(okText)}</button>
          </div>
        </div>
      </div>`;
    const close = (val) => {
      root.innerHTML = "";
      resolve(val);
    };
    root.querySelector('[data-act="ok"]').onclick = () => close(true);
    root.querySelector('[data-act="cancel"]').onclick = () => close(false);
    root.querySelector(".modal-backdrop").onclick = (e) => {
      if (e.target.classList.contains("modal-backdrop")) close(false);
    };
  });
}

// ---------- 새 기록: 입력 수집 ----------
function currentInput() {
  const mode = ($('input[name="mode"]:checked') || {}).value || "meeting";
  const template = $("#template").value;
  const title = $("#title").value.trim();
  const transcript = $("#transcript").value.trim();
  return { mode, template, title, transcript };
}

function setStatus(msg) {
  $("#status").textContent = msg || "";
}

function showResult(result) {
  const area = $("#result-area");
  area.innerHTML = renderResult(result);
  area.classList.remove("hidden");
  $("#save-bar").classList.remove("hidden");
}

function resetResult() {
  $("#result-area").classList.add("hidden");
  $("#result-area").innerHTML = "";
  $("#save-bar").classList.add("hidden");
  pending = null;
}

// ---------- 분석 실행 ----------
async function onAnalyze() {
  const input = currentInput();
  if (!input.transcript) {
    setStatus("전사문을 입력하세요.");
    return;
  }
  resetResult();
  $("#btn-analyze").disabled = true;

  try {
    // 회의 모드 + API + (항상허용 아님) → 외부 전송 경고
    const willCallApi = settings.analysisMode === "api" && !!(settings.apiKey || "").trim();
    if (input.mode === "meeting" && willCallApi && !settings.meetingApiAlwaysAllow) {
      const ok = await confirmModal({
        title: "외부 전송 경고",
        body:
          "회의 내용에는 거래처/거래 비밀(MNPI 등)이 포함될 수 있으며, 분석을 위해 전사 텍스트가 외부 API로 전송됩니다. 계속하시겠습니까?",
        okText: "동의하고 분석",
      });
      if (!ok) {
        setStatus("취소되었습니다.");
        return;
      }
    }

    const out = await analyzeTranscript(input.transcript, {
      mode: input.mode,
      template: input.template,
      settings,
      onStatus: setStatus,
    });

    // 수동 LLM 모드 → 프롬프트 복사 + 붙여넣기 UI
    if (out && out.mode === "manual") {
      renderManualMode(out.prompt, input);
      return;
    }

    // 일반 결과
    pending = { ...input, analysis: out };
    setStatus(
      out.engine === "rule"
        ? `규칙 기반 결과${out.fallbackReason ? " (API 실패 폴백)" : ""}`
        : "분석 완료"
    );
    showResult(out.result);
  } catch (err) {
    setStatus("오류: " + err.message);
  } finally {
    $("#btn-analyze").disabled = false;
  }
}

// ---------- 수동 LLM 모드 ----------
function renderManualMode(prompt, input) {
  const area = $("#result-area");
  area.innerHTML = `
    <div class="manual-prompt">
      <p class="muted">아래 프롬프트를 복사해 외부 LLM(Claude/ChatGPT 웹 등)에 붙여넣고, 받은 JSON을 다시 붙여넣으세요.</p>
      <pre id="manual-prompt-text">${esc(prompt)}</pre>
      <div class="actions">
        <button class="ghost" id="btn-copy-prompt">프롬프트 복사</button>
      </div>
      <label class="muted">LLM 응답(JSON) 붙여넣기</label>
      <textarea id="manual-paste" rows="6" placeholder="여기에 결과 JSON을 붙여넣으세요"></textarea>
      <div class="actions"><button class="primary" id="btn-parse-manual">파싱</button></div>
    </div>`;
  area.classList.remove("hidden");

  $("#btn-copy-prompt").onclick = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setStatus("프롬프트를 복사했습니다.");
    } catch {
      setStatus("복사 실패 — 직접 선택해 복사하세요.");
    }
  };
  $("#btn-parse-manual").onclick = () => {
    try {
      const parsed = ManualLlmAdapter.parse($("#manual-paste").value);
      pending = { ...input, analysis: parsed };
      setStatus("파싱 완료 (수동 입력)");
      showResult(parsed.result);
    } catch (err) {
      setStatus("파싱 실패: " + err.message);
    }
  };
}

// ---------- 저장 ----------
async function onSave() {
  if (!pending) return;
  const rec = createRecord({
    mode: pending.mode,
    template: pending.template,
    title: pending.title,
    transcript: pending.transcript,
  });
  applyAnalysis(rec, pending.analysis);
  await putRecord(rec);
  setStatus("");
  resetResult();
  $("#transcript").value = "";
  $("#title").value = "";
  showView("list");
}

// ---------- 목록 / 상세 ----------
async function renderListView() {
  const records = await getAllRecords();
  $("#list-area").innerHTML = renderList(records);
  $$(".record-item").forEach((el) => {
    el.onclick = () => openDetail(el.dataset.id);
  });
}

async function openDetail(id) {
  const rec = await getRecord(id);
  if (!rec) return;
  detailId = id;
  $("#detail-area").innerHTML = renderDetail(rec);
  showView("detail");
}

async function onDelete() {
  if (!detailId) return;
  const ok = await confirmModal({
    title: "기록 삭제",
    body: "이 기록을 삭제하시겠습니까? 되돌릴 수 없습니다.",
    okText: "삭제",
  });
  if (!ok) return;
  await deleteRecord(detailId);
  detailId = null;
  showView("list");
}

// ---------- 설정 ----------
function fillSettingsForm() {
  $("#set-mode").value = settings.analysisMode;
  $("#set-provider").value = settings.provider;
  $("#set-key").value = settings.apiKey || "";
  $("#set-model").value = settings.model || "";
  $("#set-endpoint").value = settings.endpoint || "";
  $("#set-maxtokens").value = settings.maxTokens || 8000;
  $("#set-always").checked = !!settings.meetingApiAlwaysAllow;
}

async function onSaveSettings() {
  settings = await saveSettings({
    analysisMode: $("#set-mode").value,
    provider: $("#set-provider").value,
    apiKey: $("#set-key").value.trim(),
    model: $("#set-model").value.trim(),
    endpoint: $("#set-endpoint").value.trim(),
    maxTokens: parseInt($("#set-maxtokens").value, 10) || 8000,
    meetingApiAlwaysAllow: $("#set-always").checked,
  });
  $("#settings-status").textContent = "저장됨";
  setTimeout(() => ($("#settings-status").textContent = ""), 1500);
}

// 공급자 변경 시 엔드포인트 기본값 보정
function onProviderChange() {
  const p = $("#set-provider").value;
  const ep = $("#set-endpoint");
  if (p === "anthropic" && (!ep.value || ep.value.includes("openai"))) {
    ep.value = "https://api.anthropic.com/v1/messages";
  } else if (p === "openai" && (!ep.value || ep.value.includes("anthropic"))) {
    ep.value = "https://api.openai.com/v1/chat/completions";
  }
}

// ---------- 모드 토글 ----------
function toggleTemplateField() {
  const mode = ($('input[name="mode"]:checked') || {}).value;
  $("#template-field").classList.toggle("hidden", mode !== "meeting");
}

// ---------- 초기화 ----------
async function init() {
  settings = await loadSettings();
  fillSettingsForm();
  toggleTemplateField();

  $$(".tab").forEach((t) => (t.onclick = () => showView(t.dataset.view)));
  $$('input[name="mode"]').forEach((r) => (r.onchange = toggleTemplateField));
  $("#btn-analyze").onclick = onAnalyze;
  $("#btn-save").onclick = onSave;
  $("#btn-discard").onclick = () => {
    resetResult();
    setStatus("");
  };
  $("#btn-back").onclick = () => showView("list");
  $("#btn-delete").onclick = onDelete;
  $("#btn-save-settings").onclick = onSaveSettings;
  $("#set-provider").onchange = onProviderChange;

  showView("new");
}

init();
