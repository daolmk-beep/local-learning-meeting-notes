// 내보내기/백업 — Markdown 변환 + JSON 백업/복원.
// 결정(M3): JSON 백업은 "기록만"(오디오 Blob·설정·API 키 제외). 복원은 id 기준 병합(upsert).
import { MODE_LABELS, TEMPLATE_LABELS, ENGINE_LABELS, TRANSCRIPTION_LABELS } from "./model.js";

// ---------- 공통 ----------
export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isNonEmpty(v) {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return String(v).trim() !== "";
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function stamp(iso) {
  const d = iso ? new Date(iso) : new Date();
  const p = (n) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`,
    time: `${p(d.getHours())}${p(d.getMinutes())}`,
  };
}

// 파일명 안전화 (윈도우 금지문자 제거 + 공백→_)
function safeName(s, fallback = "untitled") {
  const cleaned = String(s == null ? "" : s)
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 40);
  return cleaned || fallback;
}

// ---------- Markdown 빌더 ----------
function oneLine(s) {
  return String(s == null ? "" : s).replace(/\r?\n/g, " ").trim();
}

function mdList(items) {
  if (!items || !items.length) return "";
  return items.map((x) => `- ${oneLine(x)}`).join("\n") + "\n\n";
}

function mdTable(headers, rows) {
  if (!rows || !rows.length) return "";
  const cell = (v) => oneLine(v).replace(/\|/g, "\\|");
  const head = `| ${headers.map((h) => h.label).join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((r) => `| ${headers.map((h) => cell(r[h.key] ?? "")).join(" | ")} |`)
    .join("\n");
  return [head, sep, body].join("\n") + "\n\n";
}

function section(title, inner) {
  if (!inner) return "";
  return `## ${title}\n\n${inner}`;
}

// 기록 → 사람이 읽는 Markdown
export function recordToMarkdown(rec) {
  const r = (rec.analysis && rec.analysis.result) || {};
  const modeLabel = MODE_LABELS[rec.mode] || rec.mode;
  const tmpl =
    rec.mode === "meeting" && rec.meeting && rec.meeting.template
      ? TEMPLATE_LABELS[rec.meeting.template] || rec.meeting.template
      : "";
  const title = rec.title || r.title || "(제목 없음)";

  let md = `# ${oneLine(title)}\n\n`;

  // 메타 정보
  const meta = [modeLabel + (tmpl ? ` · ${tmpl}` : ""), fmtDate(rec.createdAt)];
  if (rec.analysis && rec.analysis.engine)
    meta.push(ENGINE_LABELS[rec.analysis.engine] || rec.analysis.engine);
  if (rec.transcription && rec.transcription.engine)
    meta.push(TRANSCRIPTION_LABELS[rec.transcription.engine] || rec.transcription.engine);
  md += `> ${meta.filter(Boolean).join(" · ")}\n\n`;

  // 공통
  if (isNonEmpty(r.summary)) md += section("핵심 요약", `${oneLine(r.summary)}\n\n`);
  if (isNonEmpty(r.keywords)) md += section("주요 키워드", `${r.keywords.map(oneLine).join(", ")}\n\n`);

  // 수업
  if (isNonEmpty(r.concepts)) {
    const inner = r.concepts
      .map((c) => {
        let s = `### ${oneLine(c.name)}\n\n${oneLine(c.explanation)}\n\n`;
        if (isNonEmpty(c.example)) s += `_예: ${oneLine(c.example)}_\n\n`;
        return s;
      })
      .join("");
    md += section("핵심 개념", inner);
  }
  if (isNonEmpty(r.linkedLearning)) {
    const l = r.linkedLearning;
    let inner = "";
    if (isNonEmpty(l.prerequisite)) inner += `**선수학습**\n\n${mdList(l.prerequisite)}`;
    if (isNonEmpty(l.next)) inner += `**다음 단원**\n\n${mdList(l.next)}`;
    if (isNonEmpty(l.related)) inner += `**관련 개념**\n\n${mdList(l.related)}`;
    md += section("연계 학습", inner);
  }
  if (isNonEmpty(r.reviewQuestions)) {
    const inner = r.reviewQuestions
      .map((q) => `**[${oneLine(q.type)}]** ${oneLine(q.q)}\n\n답: ${oneLine(q.a)}\n\n`)
      .join("");
    md += section("복습 문제", inner);
  }
  if (isNonEmpty(r.checkPoints)) md += section("이해도 점검", mdList(r.checkPoints));

  // 회의 공통
  if (isNonEmpty(r.discussions)) md += section("주요 논의사항", mdList(r.discussions));
  if (isNonEmpty(r.decisions)) md += section("결정사항", mdList(r.decisions));
  if (isNonEmpty(r.todos)) {
    md += section(
      "To Do",
      mdTable(
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
  if (isNonEmpty(r.openIssues)) md += section("미결 이슈", mdList(r.openIssues));
  if (isNonEmpty(r.nextAgenda)) md += section("후속 회의 안건", mdList(r.nextAgenda));

  // FDD
  if (isNonEmpty(r.requestedData)) {
    md += section(
      "요청자료 리스트",
      mdTable(
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
    md += section(
      "재무 리스크 단서",
      mdTable(
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
    md += section(
      "딜 포인트",
      mdTable(
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
    md += section(
      "후속 자료/문서",
      mdTable(
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
      .map((m) => `- ⚠ ${oneLine(m.info)}\n  - 주의: ${oneLine(m.caution)}`)
      .join("\n");
    md += section("MNPI 주의", inner + "\n\n");
  }

  // 협상
  if (isNonEmpty(r.theirAsks)) md += section("상대 요청사항", mdList(r.theirAsks));
  if (isNonEmpty(r.ourCommitments)) md += section("우리 약속/제안", mdList(r.ourCommitments));
  if (isNonEmpty(r.agreements)) md += section("합의 사항", mdList(r.agreements));
  if (isNonEmpty(r.draftEmail)) {
    const d = r.draftEmail;
    md += section(
      "후속 이메일 초안",
      `**제목:** ${oneLine(d.subject)}\n\n${String(d.body || "").trim()}\n\n`
    );
  }

  if (isNonEmpty(r._note)) md += `> ${oneLine(r._note)}\n\n`;

  // 전사문 (코드펜스, 원문 그대로)
  md += `## 전사문\n\n\`\`\`\n${rec.transcript || ""}\n\`\`\`\n`;

  return md;
}

export function markdownFilename(rec) {
  const s = stamp(rec.createdAt);
  const modeLabel = MODE_LABELS[rec.mode] || rec.mode;
  const tmpl =
    rec.mode === "meeting" && rec.meeting && rec.meeting.template
      ? TEMPLATE_LABELS[rec.meeting.template]
      : "";
  const modePart = safeName(tmpl || modeLabel, modeLabel);
  const titlePart = safeName(
    rec.title || (rec.analysis && rec.analysis.result && rec.analysis.result.title) || "제목없음",
    "제목없음"
  );
  return `${s.date}_${s.time}_${modePart}_${titlePart}.md`;
}

// ---------- JSON 백업 / 복원 ----------
// 백업 페이로드: 기록 객체 그대로(오디오 Blob·설정·키 제외). audioBlobId는 보존(같은 기기에서 재연결).
export function recordsToBackupJson(records) {
  const payload = {
    app: "local-learning-meeting-notes",
    type: "llmn-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    count: records.length,
    records,
  };
  return JSON.stringify(payload, null, 2);
}

export function backupFilename() {
  return `llmn_backup_${stamp().date}.json`;
}

// 백업 텍스트 → 유효 기록 배열. 배열 형식과 {records:[...]} 형식 모두 허용.
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("JSON 파싱 실패 — 올바른 백업 파일이 아닙니다.");
  }
  let records;
  if (Array.isArray(data)) records = data;
  else if (data && Array.isArray(data.records)) records = data.records;
  else throw new Error("백업 형식을 인식할 수 없습니다.");

  const valid = records.filter((r) => r && typeof r.id === "string" && r.mode);
  if (!valid.length) throw new Error("복원할 기록이 없습니다.");
  return valid;
}
