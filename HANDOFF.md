# HANDOFF — local-learning-meeting-notes (새 세션 인계 문서)

> 이 파일은 새 Claude Code 세션이 이 프로젝트를 이어받기 위한 단일 진입점이다.
> 갱신 시점: 2026-06-15 (**M3 완료** — 코드 + 브라우저 스모크 전부 통과. 미커밋).
> 다음 작업: **M3 커밋/푸시 → M4**.

---

## 0. 새 세션이 가장 먼저 할 일

1. 이 문서 + `README.md` + 루트의 소스 지시문 2개를 읽는다:
   - `c:\Claude-Code\codex_phase1_instruction_revised.md` (제품 정의·기능·금지사항)
   - `c:\Claude-Code\analysis_prompts.md` (SYSTEM + 수업1·회의4종 프롬프트·JSON 스키마)
2. **route B(브라우저→클라우드 직접호출)는 이미 실증됨** — CORS 게이트 통과(아래 §5). 재검증 불필요.
3. **M3 완료됨**(§7) — 코드 + 브라우저 스모크 전부 통과(미커밋). 미결 결정 3개 사용자 확정: 백업=기록만(오디오 제외)·복원=id병합(upsert)·설정/키 제외. 남은 건 **커밋/푸시**, 그 다음 M4.

---

## 1. 이 앱의 목적 (헷갈리지 말 것)

녹음앱이 아니다. **금융/자문 실무자(M&A·FDD·협상)가 회의·강의 발언을 "바로 쓸 업무·학습 산출물"로 바꾸는 개인 변환 도구.**

- 가치 = **변환 품질(분석)**. 녹음/저장이 아님.
- MNPI/NDA 방어가 실제 직업 리스크 → 외부 전송 경고·동의는 핵심 기능.
- 회의 템플릿(FDD/M&A/협상)이 사용자의 실제 딜 워크플로우를 반영.

---

## 2. 확정된 핵심 결정 (사용자와 합의 완료)

| 항목 | 결정 |
|---|---|
| 위치 | `c:\Claude-Code\local-learning-meeting-notes\` |
| 빌드 방식 | 가치·리스크 우선 마일스톤 **M1→M2→M3→M4** |
| 주 사용 | **폰 현장 포착 위주** |
| 분석 기본 | Anthropic Claude **`claude-opus-4-8`** (설정에서 sonnet/haiku 전환). provider=openai 분기도 구현·검증됨 |
| 전사 노선 | **route B** — 서버리스 PWA에서 사용자 키로 클라우드 STT API 직접 호출(고정비 0, 종량제). **실증 완료** |
| STT 기본 | **OpenAI Whisper**(`whisper-1`) 확정. Deepgram(화자분리)은 후속 — 어댑터에 분기 자리만 |
| 키 | 분석 키(Anthropic) + STT 키(OpenAI) **2개**. 코드 하드코딩 금지(준수) |
| 녹음 | **백업용 가볍게만**. 오디오는 IndexedDB Blob 보관 |
| 오디오 정책 | 기본 로컬. 클라우드 STT로 보낼 때 **별도 동의/경고**(구현됨, 기본 off, 회의 추가경고) |

---

## 3. 현재 상태 — M1·M2 완료(푸시됨) + 폰 배포·실증 완료

GitHub: https://github.com/daolmk-beep/local-learning-meeting-notes — **레포 public 전환됨**, main 동기화.
**배포(GitHub Pages, https):** https://daolmk-beep.github.io/local-learning-meeting-notes/ (Settings→Pages: main/root, `.nojekyll` 적용). 정적 배포라 push하면 ~1분 뒤 자동 반영.
커밋: `58c0894`(M1) → `945b1d5`(M2) → `a2b3c5d`(.nojekyll).

**운영 메모(현재 사용자 실사용 설정):** Anthropic 계정 잔액 부족으로, **분석=OpenAI `gpt-4o`**, **STT=OpenAI `whisper-1`**, OpenAI 키 1개를 분석·STT 양쪽에 사용 중. (코드 기본값은 여전히 anthropic/`claude-opus-4-8` — 크레딧 충전 시 설정에서 되돌리면 됨.)

**파일 맵 (현재 전체):**

- `server.mjs` — 정적 서버 :4173 (MIME: png/webmanifest/js 등 포함)
- `package.json` — `type:module`
- `index.html` / `styles.css` / `app.js` — UI + 전체 흐름 배선(경고 모달·녹음·STT·연결테스트·SW등록 포함)
- `modules/db.js` — IndexedDB **v2**: records / settings / **audio** 스토어. `putAudio/getAudio/deleteAudio`
- `modules/model.js` — Record 스키마. `meeting.template`, `analysis.{engine,externalSent,result}`, `transcription.{engine,externalSent}`, `audioBlobId`. `createRecord(transcriptionEngine,audioExternalSent,audioBlobId)`, `TRANSCRIPTION_LABELS`
- `modules/prompts.js` — `COMMON_SYSTEM` + `buildUserPrompt(mode,template,transcript)` (수업/일반/fdd/ma/negotiation) + `EXPECTED_KEYS`
- `modules/settings.js` — 로드/저장. 분석(provider/apiKey/model/endpoint/maxTokens/meetingApiAlwaysAllow) + STT(sttProvider/sttApiKey/sttModel/sttEndpoint/**sttAudioAlwaysAllow**)
- `modules/recorder.js` — `createRecorder()`(MediaRecorder, webm/mp4 자동), `isRecordingSupported()`, `storeAudioBlob()`
- `modules/ui.js` — 결과/목록/상세 렌더. 상세에 전사엔진·오디오·전송표시 + 녹음 재생기 placeholder(`#detail-audio`)
- `adapters/analysis.js` — **핵심**. `ApiLlm`(anthropic 기본+openai 분기) / `ManualLlm` / `RuleBased`. `extractJson`(첫{~마지막}) → 1회 재요청 → rule 폴백. `analyzeTranscript()` 오케스트레이터
- `adapters/transcription.js` — `ManualTranscriptAdapter` / **`CloudSttAdapter`(OpenAI Whisper multipart, 동작)** / `LocalWhisperAdapter`(M4 placeholder) + `testAnalysisConnection`/`testSttConnection`(CORS 조기검증)
- `manifest.webmanifest` / `service-worker.js`(앱셸 캐시 `llmn-shell-v4`, **네트워크 우선+3초 타임아웃 폴백**, 오프라인 열람) / `icons/icon-192.png`·`icon-512.png`
- `scripts/generate-icons.mjs` — 의존성 없는 PNG 아이콘 생성기
- `README.md`, `HANDOFF.md`

---

## 4. 아직 없는 것

- ~~Markdown 내보내기 / JSON 백업·복원~~ → **M3 구현 완료**(아래 §7).
- 로컬 Whisper(M4).
- Deepgram STT(화자분리) — 현재 OpenAI Whisper만. `CloudSttAdapter`에 분기 자리만.
- 긴 전사문 청크 분할/병합(2단계 후반).
- https 호스팅 — 폰 마이크/PWA설치 전제(§5 ⚠). 배포는 별도 결정.

---

## 5. 검증 상태 — route B 실증 완료 ✅

**코드 검증:** 전 모듈 `node --check` 통과. `node server.mjs`로 manifest/service-worker/icons/신규 모듈 라우팅·MIME·404 OK. 아이콘 PNG 유효. HTML id↔app.js 배선 정합성 OK(동적생성 4개 제외).

**브라우저 실테스트(사용자 수행, localhost):**
- **STT(OpenAI Whisper) 연결 테스트 = `✓`** — CORS 통과 + 키 유효 + 무음 WAV 200 처리. **route B STT 확정.**
- **분석(Anthropic) 연결 테스트 = `△`** — **CORS 통과 + 키 유효**, 단 HTTP 400 `credit balance is too low`(계정 잔액 부족). 즉 아키텍처/CORS 문제 없음, **결제만 남음.**
- 결론: **브라우저 직접 클라우드 호출 가능 — 프록시 불필요.**

**폰 풀루프 실증 완료 ✅ (GitHub Pages https, 실제 기기):**
- 폰 PWA 설치 → 녹음(마이크 권한) → 클라우드 STT(whisper-1) 전사 → 전사문 자동채움 → **API 분석(gpt-4o) "분석 완료"** → 저장까지 동작 확인.
- 함정 메모(다음 세션·사용자 참고): ① **연결테스트는 입력칸 값**, **실제 분석은 저장된 설정** → 공급자/모델 바꾸면 **"설정 저장" 필수.** ② 모델명은 정확히 **`gpt-4o`**(알파벳 o). `gpt-4.0`/`claude-...` 남기면 분석 실패→규칙폴백. ③ 규칙기반은 비상폴백(문장추출)일 뿐 — 실가치는 API 분석.

**아직 안 본 것:** 회의 모드 풀루프(동의 모달 2번), FDD/M&A 실제 전사문 **산출물 품질**(프롬프트 튜닝 판단점), IndexedDB v2 마이그레이션 장기.

**⚠ https 주의:** 마이크 녹음·서비스워커·PWA설치는 **https 또는 localhost에서만** 동작. PC localhost는 전기능 OK. **폰에서 PC LAN IP(http) 접속은 마이크/설치 막힘** → 폰 실사용/설치는 https 정적 호스팅(GitHub Pages 등) 필요.

---

## 6. M2 — 폰 현장 루프 + route B 클라우드 STT (✅ 완료)

구현·푸시 완료. 내용: PWA 설치형(manifest/SW/아이콘), 녹음(MediaRecorder→audio 스토어→`audioBlobId`), CloudSttAdapter(OpenAI Whisper), 오디오 외부전송 동의(기본 off·회의 추가경고·감사플래그), STT 설정 UI, 연결 테스트(CORS 검증), 상세 녹음 재생, 삭제 시 오디오 cascade. 상세 파일은 §3.

---

## 7. M3 (매일쓰기 마감) — ✅ 코드 완료

목표: **매일 실무에서 굴릴 수 있게 "꺼내 쓰기·지키기"를 완성.**

**구현 완료(2026-06-15):**

- `modules/export.js` 신규 — `recordToMarkdown(record)`(ui.js 렌더 구조 미러링, 모드/템플릿별 섹션·테이블·MNPI 포함), `recordsToBackupJson`/`parseBackup`(배열·{records} 양형 허용+유효성), `markdownFilename`(`YYYYMMDD_HHMM_모드_제목.md`, 윈도우 금지문자 안전화), `backupFilename`(`llmn_backup_YYYYMMDD.json`), `downloadBlob`.
- `modules/db.js` — `clearAudio()` 추가.
- `index.html` — 상세에 `#btn-export-md`, 설정에 "데이터 관리"(`#btn-backup`/`#btn-restore`+`#restore-file`/`#btn-clear-data`, `#data-status`).
- `app.js` — `onExportMarkdown`/`onBackup`/`onRestoreFile`(upsert)/`onClearData`(확인모달→clearRecords+clearAudio, 설정·키 유지) 배선.
- `service-worker.js` — SHELL에 `./modules/export.js` 추가. 전략 변경: **캐시 우선 → 네트워크 우선 + 3초 타임아웃 폴백**(`networkFirst`, `NET_TIMEOUT_MS=3000`). 캐시 `llmn-shell-v2`→**`v4`**. 온라인이면 항상 최신 코드, 느린/오프라인 망은 캐시 폴백(과거 기록 오프라인 열람 유지). 개발 중 stale 코드 함정 제거가 목적.
- `README.md` — 사용법 6번·로드맵 M3 완료.
- **검증:** 전 12개 모듈 `node --check` 통과. export.js 순수함수 노드 스모크(MD 출력/파일명/백업 라운드트립/잘못된입력 거부) 통과. 정적 서버 export.js MIME=text/javascript 200, html/sw 배선 grep 확인.
- **브라우저 스모크 통과(2026-06-15, 사용자 수행):** ① 상세 MD 내보내기 다운로드 ✓ ② JSON 백업 → 복원 라운드트립(id 병합, 중복 없음) ✓ ③ 전체삭제 모달·동작(설정/키 유지) ✓ ④ 빈 상태 → 복원 원복 ✓ + SW **v4 네트워크 우선** 실동작 확인(stale 코드 함정 해소).
- 선택적 미실시: 망 끊고 SW 캐시 오프라인 열람만.

**확정된 M3 결정(사용자):** 백업 오디오 **제외** / 복원 **id 병합(upsert)** / 백업에 설정·API키 **제외**(키 유출 방지).

---

(원래 계획 — 참고용)

해야 할 것:

1. **Markdown 내보내기** (지시문 기능 11)
   - 기록별 내보내기 버튼(상세 화면). 구조화 결과 + 전사문을 사람이 읽는 .md로 변환.
   - 파일명: **`YYYYMMDD_HHMM_모드_제목.md`** (모드=수업/회의 또는 템플릿, 제목은 파일명 안전화).
   - `Blob` + 다운로드 앵커로 저장. 권장: `modules/export.js`에 `recordToMarkdown(record)` 분리(모드/템플릿별 섹션은 `ui.js` 렌더 구조 재사용).
2. **JSON 백업 / 복원** (지시문 기능 12)
   - 백업: 전체 기록을 JSON으로 내보내기(`llmn_backup_YYYYMMDD.json`). 설정 포함 여부는 결정(아래).
   - 복원: 파일 선택 → 파싱 → `putRecord` 적재. id 기준 병합(upsert) 권장.
   - 설정 UI에 백업/복원 버튼 추가.
3. **설정/데이터 마감**: 전체 설정 저장 정합성 점검, **데이터 전체 삭제**(확인 모달, `clearRecords` 활용) 추가.
4. **오프라인 마감**: SW 셸 캐시로 과거 기록 오프라인 열람 동작 확인. 셸 파일 추가 시 `service-worker.js`의 `SHELL`·캐시버전(`llmn-shell-vN`) 갱신.
5. **README/검증**: 지시문 `[검증]` 체크리스트 전수 + README 사용법 보강.

**M3 미결 결정(착수 전 사용자 확인):**
- **JSON 백업에 녹음 오디오 Blob 포함?** 권장: **텍스트/분석만(오디오 제외)** — 가볍고 핵심 보존(오디오는 base64로 무거워짐).
- **복원 시 기존 기록 처리** — 권장: **id 기준 병합(upsert)**, 덮어쓰기/중복 회피.

---

## 8. 이후 마일스톤

- **M4** — 2단계 1순위: **LocalWhisperAdapter(WASM, PC 우선)** — 녹음 백업→자동 전사. 폰은 tiny/base+WebGPU로 짧은 클립만, 긴 다자회의는 PC 전사 권장. 긴 오디오 청크 병합, 프롬프트 고도화, Deepgram(화자분리) 옵션.

---

## 9. 실행 / 깃

```bash
cd c:\Claude-Code\local-learning-meeting-notes
node server.mjs        # http://localhost:4173 (localhost로 접속)
```

- 깃 신원: kmoon / daolmk@gmail.com. 인증=Windows 자격관리자(GCM).
- **커밋/푸시는 사용자가 요청할 때만.** 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- 이 갱신된 `HANDOFF.md`는 아직 커밋 안 됐을 수 있음(사용자 요청 시 포함).

---

## 10. 작업 규칙 리마인더

- 지시문 금지사항 준수: **API 키 하드코딩 금지**, 녹음 오디오 무경고 외부전송 금지, 회의모드 무경고 전송 금지, 로그인/클라우드DB/결제/팀협업/앱스토어 배포 금지(1단계 밖).
- 어댑터 추상화·폴백 체인 유지(2단계는 "교체"가 아니라 "개선").
- 메모리: 이 프로젝트 `memory/` 디렉터리에 계획 맥락 기록(MEMORY.md 인덱스 참조).
