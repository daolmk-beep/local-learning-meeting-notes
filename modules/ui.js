// 렌더링 헬퍼 — 분석 결과 / 목록 / 상세를 HTML 문자열로 만든다.
import { MODE_LABELS, TEMPLATE_LABELS, ENGINE_LABELS, TRANSCRIPTION_LABELS } from "./model.js";

export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nl2br(s) {
  return esc(s).replace(/\n/g, "<br>");
}

function isNonEmpty(v) {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return String(v).trim() !== "";
}

function section(title, inner) {
  if (!inner) return "";
  return `<div class="res-section"><h3>${esc(title)}</h3>${inner}</div>`;
}

function ul(items) {
  if (!items || !items.length) return "";
  return `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
}

function chips(items) {
  if (!items || !items.length) return "";
  return `<div class="chips">${items.map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div>`;
}

function table(headers, rows) {
  if (!rows || !rows.length) return "";
  const head = headers.map((h) => `<th>${esc(h.label)}</th>`).join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${headers.map((h) => `<td>${esc(r[h.key] ?? "")}</td>`).join("")}</tr>`
    )
    .join("");
  return `<table class="res-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

// 분석 결과(구조화 JSON)를 사람이 읽는 HTML로
export function renderResult(result) {
  if (!result) return `<p class="muted">결과 없음</p>`;
  const r = result;
  let html = "";

  if (isNonEmpty(r.title)) html += `<h2 class="res-title">${esc(r.title)}</h2>`;
  if (isNonEmpty(r.summary)) html += section("핵심 요약", `<p>${nl2br(r.summary)}</p>`);
  if (isNonEmpty(r.keywords)) html += section("주요 키워드", chips(r.keywords));

  // 수업
  if (isNonEmpty(r.concepts)) {
    const inner = r.concepts
      .map(
        (c) =>
          `<div class="concept"><strong>${esc(c.name)}</strong><p>${nl2br(c.explanation)}</p>${
            isNonEmpty(c.example) ? `<p class="muted">예: ${esc(c.example)}</p>` : ""
          }</div>`
      )
      .join("");
    html += section("핵심 개념", inner);
  }
  if (isNonEmpty(r.linkedLearning)) {
    const l = r.linkedLearning;
    const inner =
      (isNonEmpty(l.prerequisite) ? `<p><b>선수학습</b></p>${ul(l.prerequisite)}` : "") +
      (isNonEmpty(l.next) ? `<p><b>다음 단원</b></p>${ul(l.next)}` : "") +
      (isNonEmpty(l.related) ? `<p><b>관련 개념</b></p>${ul(l.related)}` : "");
    html += section("연계 학습", inner);
  }
  if (isNonEmpty(r.reviewQuestions)) {
    const inner = r.reviewQuestions
      .map(
        (q) =>
          `<div class="qa"><p><b>[${esc(q.type)}]</b> ${esc(q.q)}</p><p class="muted">답: ${esc(q.a)}</p></div>`
      )
      .join("");
    html += section("복습 문제", inner);
  }
  if (isNonEmpty(r.checkPoints)) html += section("이해도 점검", ul(r.checkPoints));

  // 회의 공통
  if (isNonEmpty(r.discussions)) html += section("주요 논의사항", ul(r.discussions));
  if (isNonEmpty(r.decisions)) html += section("결정사항", ul(r.decisions));
  if (isNonEmpty(r.todos)) {
    html += section(
      "To Do",
      table(
        [
          { key: "task", label: "항목" },
          { key: "owner", label: "담당자" },
          { key: "due", label: "기한" },
          { key: "status", label: "상태" },
        ],
        r.todos
      )
    );
  }
  if (isNonEmpty(r.openIssues)) html += section("미결 이슈", ul(r.openIssues));
  if (isNonEmpty(r.nextAgenda)) html += section("후속 회의 안건", ul(r.nextAgenda));

  // FDD
  if (isNonEmpty(r.requestedData)) {
    html += section(
      "요청자료 리스트",
      table(
        [
          { key: "item", label: "자료" },
          { key: "purpose", label: "목적" },
          { key: "owner", label: "제공주체" },
          { key: "due", label: "기한" },
        ],
        r.requestedData
      )
    );
  }
  if (isNonEmpty(r.financialRiskFlags)) {
    html += section(
      "재무 리스크 단서",
      table(
        [
          { key: "area", label: "영역" },
          { key: "finding", label: "단서" },
          { key: "implication", label: "함의" },
          { key: "confidence", label: "신뢰도" },
        ],
        r.financialRiskFlags
      )
    );
  }

  // M&A
  if (isNonEmpty(r.dealPoints)) {
    html += section(
      "딜 포인트",
      table(
        [
          { key: "topic", label: "쟁점" },
          { key: "content", label: "내용" },
          { key: "ourSide", label: "우리측" },
          { key: "counterparty", label: "상대측" },
        ],
        r.dealPoints
      )
    );
  }
  if (isNonEmpty(r.followUps)) {
    html += section(
      "후속 자료/문서",
      table(
        [
          { key: "deliverable", label: "자료/문서" },
          { key: "owner", label: "담당" },
          { key: "due", label: "기한" },
        ],
        r.followUps
      )
    );
  }
  if (isNonEmpty(r.mnpiNotes)) {
    const inner = r.mnpiNotes
      .map((m) => `<div class="mnpi"><p>⚠ ${esc(m.info)}</p><p class="muted">주의: ${esc(m.caution)}</p></div>`)
      .join("");
    html += section("MNPI 주의", inner);
  }

  // 협상
  if (isNonEmpty(r.theirAsks)) html += section("상대 요청사항", ul(r.theirAsks));
  if (isNonEmpty(r.ourCommitments)) html += section("우리 약속/제안", ul(r.ourCommitments));
  if (isNonEmpty(r.agreements)) html += section("합의 사항", ul(r.agreements));
  if (isNonEmpty(r.draftEmail)) {
    const d = r.draftEmail;
    html += section(
      "후속 이메일 초안",
      `<div class="email"><p><b>제목:</b> ${esc(d.subject)}</p><p>${nl2br(d.body)}</p></div>`
    );
  }

  if (isNonEmpty(r._note)) html += `<p class="warn-note">${esc(r._note)}</p>`;
  return html || `<pre class="raw">${esc(JSON.stringify(r, null, 2))}</pre>`;
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function renderList(records) {
  if (!records.length) return `<p class="muted">아직 기록이 없습니다. "새 기록"에서 시작하세요.</p>`;
  return `<ul class="record-list">${records
    .map((rec) => {
      const tmpl = rec.mode === "meeting" && rec.meeting?.template ? ` · ${TEMPLATE_LABELS[rec.meeting.template] || ""}` : "";
      const kw = (rec.keywords || []).slice(0, 4).map((k) => `<span class="chip sm">${esc(k)}</span>`).join("");
      return `<li class="record-item" data-id="${esc(rec.id)}">
        <div class="ri-top"><span class="badge ${rec.mode}">${MODE_LABELS[rec.mode] || rec.mode}${esc(tmpl)}</span>
        <span class="muted sm">${fmtDate(rec.createdAt)}</span></div>
        <div class="ri-title">${esc(rec.title || "(제목 없음)")}</div>
        <div class="chips">${kw}</div>
      </li>`;
    })
    .join("")}</ul>`;
}

export function renderDetail(rec) {
  const tmpl = rec.mode === "meeting" && rec.meeting?.template ? ` · ${TEMPLATE_LABELS[rec.meeting.template] || ""}` : "";
  const eng = rec.analysis?.engine ? ENGINE_LABELS[rec.analysis.engine] || rec.analysis.engine : "-";
  const sent = rec.analysis?.externalSent ? "분석 전송됨" : "분석 미전송";
  const trEng = rec.transcription?.engine
    ? TRANSCRIPTION_LABELS[rec.transcription.engine] || rec.transcription.engine
    : "";
  const audio = rec.audioBlobId ? " · 녹음 백업 있음" : "";
  const audioSent = rec.transcription?.externalSent ? " · 오디오 전송됨" : "";
  return `
    <div class="detail-head">
      <span class="badge ${rec.mode}">${MODE_LABELS[rec.mode] || rec.mode}${esc(tmpl)}</span>
      <span class="muted sm">${fmtDate(rec.createdAt)} · ${esc(eng)} · ${esc(sent)}${esc(trEng ? " · " + trEng : "")}${esc(audio)}${esc(audioSent)}</span>
    </div>
    <div class="result">${renderResult(rec.analysis?.result)}</div>
    ${rec.audioBlobId ? `<div id="detail-audio" class="rec-result"></div>` : ""}
    <details class="transcript-box"><summary>전사문 보기</summary><pre>${esc(rec.transcript || "")}</pre></details>
  `;
}
