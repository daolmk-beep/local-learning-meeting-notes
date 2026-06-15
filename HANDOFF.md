# HANDOFF — local-learning-meeting-notes (새 세션 인계 문서)

> 이 파일은 새 Claude Code 세션이 이 프로젝트를 이어받기 위한 단일 진입점이다.
> 갱신 시점: 2026-06-15 (**M2 구현 완료**, 사용자 실테스트 대기 — 아직 커밋 전).
> 직전: M1 완료·GitHub 푸시(`58c0894`).

---

## 0. 새 세션이 가장 먼저 할 일

1. 이 문서 + `README.md` + 루트의 소스 지시문 2개를 읽는다:
   - `c:\Claude-Code\codex_phase1_instruction_revised.md` (제품 정의·기능·금지사항)
   - `c:\Claude-Code\analysis_prompts.md` (SYSTEM + 수업1·회의4종 프롬프트·JSON 스키마)
2. **사용자에게 M1 실테스트 결과부터 확인한다** (아래 §5). 그 결과가 M2 착수의 게이트다.
   - 특히 ① 브라우저 직접호출 CORS 동작 여부 ② 산출물(프롬프트) 품질.
3. 문제 있으면 먼저 잡고, 없으면 **M2** 진행.

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
| 위치 | `c:\Claude-Code\local-learning-meeting-notes\` (루트 하위 서브폴더) |
| 빌드 방식 | 계층별(P0~P8) 폐기 → **가치·리스크 우선 마일스톤 M1→M2→M3→M4** |
| 주 사용 | **폰 현장 포착 위주** |
| 분석 기본 | Anthropic Claude **`claude-opus-4-8`** (설정에서 sonnet/haiku 전환). provider=openai 분기도 구현됨 |
| **전사 노선** | **route B 채택** — 서버리스 PWA에서 **사용자 키로 클라우드 STT API 직접 호출**(고정비 0, 종량제). 클라우드 STT 회의 1건 ≈ $0.3~0.5 |
| STT 기본 후보 | **OpenAI Whisper**(`whisper-1`, $0.006/분, 브라우저 호출 가능). 대안 Deepgram(화자분리). **M2에서 최종 확정** |
| 키 | 분석=Anthropic, STT=OpenAI → **키 2개** 설정 예정. 코드 하드코딩 금지(이미 준수) |
| 녹음 | **백업용 가볍게만**(텍스트는 받아쓰기/STT, 오디오는 Blob 보관) |
| 오디오 정책 | 기본 로컬. route B에서 클라우드 STT로 보낼 때는 **별도 동의/경고** 필요(현재 경고는 전사 텍스트만 커버) |

---

## 3. 현재 상태 — M1 완료(푸시됨) + M2 구현 완료(미커밋, 실테스트 대기)

M2: 폰 현장 루프(PWA 설치형 + 녹음 + route B 클라우드 STT + 오디오 동의 + 연결 테스트) 구현·구문검증·서버 라우팅 확인 완료. **아직 커밋/푸시 안 됨.**

**M2 추가/변경 파일:**
- `modules/recorder.js` (신규) — `createRecorder()`(MediaRecorder, webm/mp4 자동선택) + `storeAudioBlob()`
- `adapters/transcription.js` — **CloudSttAdapter 구현**(OpenAI Whisper, multipart) + `testAnalysisConnection`/`testSttConnection`(CORS 조기검증: fetch TypeError=차단, HTTP응답=통과)
- `modules/db.js` — **v2**: `audio` 스토어 + `putAudio/getAudio/deleteAudio`
- `modules/model.js` — `createRecord`에 `transcriptionEngine`/`audioExternalSent`/`audioBlobId` 인자, `transcription.externalSent`, `TRANSCRIPTION_LABELS`
- `modules/settings.js` — `sttAudioAlwaysAllow`(기본 off) 추가
- `index.html` — manifest/apple 메타, 녹음 UI, STT 설정란, 연결 테스트 버튼 2개
- `app.js` — 녹음 토글·STT 전사·오디오 동의 모달·STT 설정 저장·연결테스트·SW 등록·상세 녹음재생·삭제 시 오디오 cascade
- `modules/ui.js` — 상세에 전사엔진/오디오/오디오전송 표시 + 녹음 재생기 placeholder
- `styles.css` — 녹음/테스트/설정구분 스타일
- `manifest.webmanifest`, `service-worker.js`(앱셸 캐시 `llmn-shell-v2`), `icons/icon-192.png`·`icon-512.png`(신규, `scripts/generate-icons.mjs`로 생성)

**M1 파일 맵:**
- `server.mjs` — 정적 서버 :4173
- `package.json` — `type:module`
- `index.html` / `styles.css` / `app.js` — UI + 전체 흐름 배선(경고 모달 포함)
- `modules/db.js` — IndexedDB(records/settings 스토어)
- `modules/model.js` — Record 스키마(`meeting.template`, `analysis.engine`, `analysis.externalSent`, `audioBlobId`(M2 대비))
- `modules/prompts.js` — `COMMON_SYSTEM` + `buildUserPrompt(mode,template,transcript)` (수업/일반/fdd/ma/negotiation)
- `modules/settings.js` — 설정 로드/저장. **STT 필드(sttProvider/sttApiKey/sttModel/sttEndpoint) 이미 스캐폴드됨**
- `modules/ui.js` — 결과/목록/상세 렌더(템플릿별 표·섹션)
- `adapters/analysis.js` — **핵심**. `ApiLlm`(anthropic 기본+openai 분기) / `ManualLlm` / `RuleBased`. `extractJson`(첫{~마지막}) → 1회 재요청 → rule 폴백. `analyzeTranscript()` 오케스트레이터
- `adapters/transcription.js` — `ManualTranscriptAdapter`(동작) / `CloudSttAdapter`(placeholder, **M2 구현 대상**) / `LocalWhisperAdapter`(placeholder, M4)
- `README.md`

**GitHub:** https://github.com/daolmk-beep/local-learning-meeting-notes (main, 커밋 `58c0894`). 옛 `-codex` 레포는 이름 변경+force-push로 교체됨(기존 Codex 콘텐츠 삭제). 로컬 main↔origin/main 추적 설정됨.

---

## 4. 아직 없는 것

- 내보내기(Markdown)·JSON 백업/복원(M3).
- 로컬 Whisper(M4).
- Deepgram STT(화자분리) — 현재 OpenAI Whisper만 구현. `CloudSttAdapter`에 분기 자리만 있음.
- 긴 전사문 청크 분할/병합(2단계 후반).
- https 호스팅 — 폰에서 마이크/PWA설치는 https 또는 localhost에서만 동작(아래 §5 주의).

---

## 5. 검증 상태

**완료(M2 포함):** 전 모듈 `node --check` 통과. `node server.mjs`로 `/manifest.webmanifest`·`/service-worker.js`·`/icons/*.png`·신규 모듈 라우팅/MIME/404 OK. 아이콘 PNG 유효성 확인. HTML id↔app.js 참조 정합성 확인(동적생성 4개 제외).

**미검증(브라우저·실제 키 필요 → 사용자 실테스트 대기):**
- **연결 테스트 버튼으로 CORS 확인** — 설정탭의 "분석 API 연결 테스트"(Anthropic)·"STT API 연결 테스트"(OpenAI). 결과 표기: `✓`통과+키유효 / `△`CORS통과·인증/요청문제 / `✗`CORS·네트워크 차단. **`✗`(특히 STT)면 route B 직접호출 불가 → 프록시 검토.**
- 녹음→정지→클라우드 STT 전사→전사문 자동채움→분석→저장 풀루프, 상세 녹음 재생.
- 오디오 외부전송 동의 모달(회의 추가경고), 키없음→manual 폴백, IndexedDB v2 마이그레이션.
- FDD/M&A 실제 전사문 **산출물 품질**(프롬프트 튜닝 판단점).

**⚠ https 주의:** 마이크 녹음·서비스워커·PWA설치는 **보안컨텍스트(https) 또는 localhost에서만** 동작. PC localhost는 전기능 OK. **폰에서 PC의 LAN IP(http) 접속은 마이크/설치 막힘** → 폰 실사용/설치 테스트는 https 정적 호스팅(GitHub Pages 등) 필요. 배포는 별도 결정.

→ 새 세션은 연결 테스트(CORS) 결과를 사용자에게 먼저 확인할 것.

---

## 6. M2 — 폰 현장 루프 + route B 클라우드 STT (✅ 구현 완료, 실테스트 대기)

목표: **폰에서 설치형으로, 녹음/받아쓰기로 포착 → (동의 시) 클라우드 STT 전사 → 분석 → 저장**.

구현된 것(아래 항목 모두 코드 반영됨 — 상세 파일은 §3):
1. **PWA 설치형**: `manifest.webmanifest`(이름·아이콘·display:standalone·theme) + `service-worker.js`(앱 셸 캐시 + 과거 기록 오프라인 열람) + `icons/icon-192.png`·`icon-512.png` 생성. `index.html`에 manifest/SW 등록 추가.
2. **녹음(백업용 가볍게)**: `MediaRecorder`로 오디오 캡처 → Blob을 IndexedDB에 저장하고 `record.audioBlobId`로 연결. (별도 audio 스토어 권장)
3. **CloudSttAdapter 구현(route B 핵심)**: 브라우저 → STT API 직접 호출(사용자 키).
   - 기본 OpenAI Whisper: `POST https://api.openai.com/v1/audio/transcriptions`, multipart(`file`=오디오, `model`=whisper-1), `Authorization: Bearer <sttApiKey>`. 응답 `.text`.
   - CORS 브라우저 호출 가능 여부 **조기 검증**. 안 되면 Deepgram 등 대안 또는 작은 프록시 검토.
   - `settings`의 stt* 필드 활용, 설정 UI에 **STT 키 입력란 추가**.
4. **입력 UX**: OS 받아쓰기(키보드 마이크)로 textarea 직접 입력 흐름 안내 + 녹음 버튼. 흐름: 녹음→전사(CloudStt)→transcript 채움→분석.
5. **오디오 외부전송 동의/경고**: 클라우드 STT로 오디오를 보내는 것은 새로운 외부 전송 → 별도 경고·동의. **회의 모드는 특히 보수적으로**(기본 opt-in, 기본 off 권장). 감사 플래그 추가.
6. **검증**: OpenAI audio 엔드포인트 브라우저 CORS, 짧은 클립 전사, 녹음→전사→분석→저장 풀루프, 폰 설치/오프라인 열람.

**M2 결정(확정):**
- STT 공급자 기본값 = **OpenAI Whisper**(`whisper-1`). Deepgram(화자분리)은 후속 — 어댑터에 분기 자리만.
- 클라우드 STT(오디오 외부전송) 기본 = **opt-in / off**(`sttAudioAlwaysAllow=false`), 회의 모드 추가 경고.

**M2 이후 사용자 확인 필요:**
- 연결 테스트(CORS) 결과 — `✗`면 프록시 노선 검토.
- 폰 실사용을 위한 https 호스팅 여부(§5 주의) — 배포 결정.

---

## 7. 이후 마일스톤

- **M3** — 매일쓰기 마감: 기록 목록/상세/삭제(이미 일부), 설정 전체, **Markdown 내보내기(`YYYYMMDD_HHMM_모드_제목.md`)** + **JSON 백업/복원**, 오프라인 마감, README 보강. 지시문 `[검증]` 체크리스트 전수.
- **M4** — 2단계 1순위: **LocalWhisperAdapter(WASM, PC 우선)** — 녹음 백업→자동 전사. 폰은 tiny/base+WebGPU로 짧은 클립만, 긴 다자회의는 PC 전사 권장(성능 한계 확인됨). 긴 오디오 청크 병합, 프롬프트 고도화.

---

## 8. 실행 / 깃

```
cd c:\Claude-Code\local-learning-meeting-notes
node server.mjs        # http://localhost:4173
```
- 깃 신원: kmoon / daolmk@gmail.com (설정됨). 인증=Windows 자격관리자(GCM, manager).
- 커밋/푸시는 사용자가 요청할 때만. 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- 이 `HANDOFF.md`는 아직 커밋/푸시 안 됨(원하면 사용자 요청 시 포함).

---

## 9. 작업 규칙 리마인더

- 지시문 금지사항 준수: **API 키 하드코딩 금지**, 녹음 오디오 무경고 외부전송 금지, 회의모드 무경고 전송 금지, 로그인/클라우드DB/결제/팀협업/배포 금지(1단계 밖).
- 어댑터 추상화·폴백 체인 유지(2단계는 "교체"가 아니라 "개선").
- 메모리: `C:\Users\User\.claude\projects\c--Claude-Code\memory\local-learning-meeting-notes-plan.md`에 동일 맥락 기록됨(MEMORY.md 인덱스에도 등재).
