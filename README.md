# 로컬 AI 노트 (local-learning-meeting-notes)

수업·회의 **전사문 → 학습/업무 산출물**로 변환하는 개인용 로컬 우선 AI 노트 PWA.
모든 데이터(전사문·분석결과·설정)는 **이 기기의 브라우저(IndexedDB)에만** 저장됩니다.

## 실행

```bash
node server.mjs
```

→ 브라우저에서 `http://localhost:4173`

## 사용

1. **설정** 탭에서 키 입력 (둘 다 이 기기 IndexedDB에만 저장, 코드에 없음)
   - **분석 API 키**: 기본 Anthropic(Claude), 모델 `claude-opus-4-8` (저비용 `claude-haiku-4-5`)
   - **STT API 키**: 클라우드 전사용. 기본 OpenAI Whisper(`whisper-1`)
   - 각각 **연결 테스트** 버튼으로 CORS/키 유효성을 즉시 확인 (저장 전에도 가능)
2. **새 기록** 탭에서 모드(수업/회의) 선택 → 회의는 템플릿(일반/FDD/M&A/협상) 선택
3. 입력 방법 (택1):
   - 전사문 붙여넣기 / 폰 키보드 마이크 받아쓰기로 직접 입력, 또는
   - **녹음 시작 → 정지 → 클라우드 STT로 전사** (오디오 외부 전송 전 동의)
4. **분석**
   - 회의 모드 + API 분석 시, 전사 텍스트 외부 전송 경고 후 동의해야 진행
   - 키 없으면 **수동 LLM 모드**로 자동 폴백(프롬프트 복사→외부 LLM→결과 붙여넣기)
   - API 호출/파싱 실패 시 **규칙 기반**으로 폴백
5. **기록 저장** → 기록 탭에서 목록/상세(녹음 재생)/삭제

## 어댑터 구조

- **AnalysisAdapter** (핵심): `ApiLlm`(기본·Anthropic/OpenAI) / `ManualLlm`(폴백) / `RuleBased`(최소 폴백)
- **TranscriptionAdapter**: `Manual`(동작) / `CloudStt`(M2·OpenAI Whisper 동작) / `LocalWhisper`(M4)

## 개인정보 / 외부 전송

- **분석**: 외부로 나가는 것은 **전사 텍스트뿐**(동의 시). 회의 모드는 매번 경고.
- **클라우드 STT**: 전사를 위해 **녹음 오디오 원본**이 STT API로 전송됨 → 분석과 **별개의 동의** 필요(기본 opt-in, off). 회의 녹음은 추가 경고.
- 녹음 오디오 자체는 기기 IndexedDB(audio 스토어)에만 백업되며, STT 전사 외에는 외부로 나가지 않음.

## 폰 / PWA 설치 주의 (중요)

- **녹음(마이크)·서비스워커·PWA 설치는 보안 컨텍스트(https) 또는 `localhost`에서만 동작**한다.
- PC `localhost`에서는 전 기능(녹음·STT·설치·오프라인) 정상.
- **폰에서 PC의 LAN IP(http)로 접속하면 마이크/설치가 막힌다.** 폰 실사용·설치 테스트는 https 호스팅(예: GitHub Pages 등 정적 호스팅)이 필요하다. (배포 자체는 별도 결정 사항)

## 로드맵

- **M1 (완료):** 변환 엔진 — 전사문 → 5종 템플릿 분석 → 저장/목록/상세
- **M2 (완료):** 폰 현장 루프 — PWA(manifest/SW/아이콘), 녹음(백업) + 클라우드 STT(route B), 오디오 동의, 연결 테스트
- **M3:** Markdown 내보내기·JSON 백업/복원, 설정/오프라인 마감
- **M4:** 로컬 Whisper(WASM, PC 우선) — 녹음→자동 전사
