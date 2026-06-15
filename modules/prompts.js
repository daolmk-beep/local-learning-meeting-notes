// AnalysisAdapter 프롬프트 — analysis_prompts.md 기준 (수업 1종 + 회의 4종).
// 출력은 "오직 JSON 1개". 모델중립: SYSTEM=top-level system, USER=user 메시지.

export const COMMON_SYSTEM = `당신은 한국어 회의·수업 전사문을 구조화된 학습/업무 산출물로 변환하는 분석 엔진이다.

[절대 규칙]
1. 출력은 유효한 JSON 객체 하나뿐이다. JSON 앞뒤에 어떤 텍스트, 설명, 마크다운 코드펜스(\`\`\`)도 붙이지 마라.
2. 스키마에 정의된 키만 사용하고, 모든 키를 빠짐없이 포함하라. 해당 내용이 없으면 빈 배열 [] 또는 빈 문자열 ""을 넣어라.
3. 전사문에 실제로 등장한 내용만 사용하라. 없는 사실을 지어내지 마라(환각 금지).
4. 전사문이 불완전하거나 잘려 있어도, 확보된 범위 안에서만 정리하라.
5. 추론으로 보충한 항목은 해당 텍스트 앞에 "[추정] "을 붙여 명시하라.
6. 날짜·금액·고유명사·수치는 전사문 표기를 그대로 보존하라. 임의 변환 금지.
7. 한국어로 작성하라.

[품질 기준]
- 요약은 "다시 안 들어도 될 만큼" 구체적으로. 추상적 일반론 금지.
- 추출이 아니라 변환을 하라: 문장을 고르는 게 아니라, 핵심을 재구성해 정리하라.`;

const LESSON_USER = `아래 전사문은 수업/강의 녹음을 텍스트로 옮긴 것이다.
복습과 연계학습에 쓸 수 있도록 아래 JSON 스키마에 맞춰 정리하라.

[출력 스키마]
{
  "title": "수업 핵심을 담은 10자 내외 제목",
  "summary": "이 수업에서 다룬 내용 전체를 5~8문장으로 재구성한 요약",
  "keywords": ["핵심 용어", "..."],
  "concepts": [
    {
      "name": "핵심 개념명",
      "explanation": "그 개념을 학생이 이해할 수 있게 풀어쓴 설명 2~3문장",
      "example": "수업에서 든 예시 또는 [추정] 적절한 예시"
    }
  ],
  "linkedLearning": {
    "prerequisite": ["이 수업을 이해하려면 알아야 할 선수 개념"],
    "next": ["이 다음에 배우면 좋은 단원/주제"],
    "related": ["연결되는 다른 과목·개념"]
  },
  "reviewQuestions": [
    { "type": "단답형", "q": "질문", "a": "정답" },
    { "type": "서술형", "q": "질문", "a": "모범답안 요지" }
  ],
  "checkPoints": ["학생이 헷갈리기 쉬운 지점이나 자주 하는 오해"]
}

[전사문]
<<<TRANSCRIPT>>>`;

const MEETING_BASE_SCHEMA = `{
  "title": "회의 핵심을 담은 제목",
  "summary": "회의 전체를 5~8문장으로 재구성한 요약",
  "discussions": ["주요 논의사항 항목"],
  "decisions": ["확정된 결정사항. 결정이 아닌 것은 넣지 마라"],
  "todos": [
    { "task": "해야 할 일(동사로 끝나게)", "owner": "담당자 또는 [추정]/미지정", "due": "기한 또는 미정", "status": "예정" }
  ],
  "openIssues": ["미결 이슈·보류 사항"],
  "nextAgenda": ["다음 회의에서 다룰 안건"]
}`;

const MEETING_GENERAL_USER = `아래 전사문은 일반 회의 녹음이다. 아래 JSON 스키마에 맞춰 정리하라.

[작성 지침]
- decisions와 todos를 명확히 구분하라. "~하기로 함"은 결정, "누가 ~할 것"은 todo.
- todo의 owner/due가 전사문에 없으면 "미지정"/"미정"으로 두되 지어내지 마라.

[출력 스키마]
${MEETING_BASE_SCHEMA}

[전사문]
<<<TRANSCRIPT>>>`;

const MEETING_FDD_USER = `아래 전사문은 재무 실사(FDD) 과정의 인터뷰/질의응답 녹음이다.
실사 워크페이퍼와 후속 자료요청에 바로 쓸 수 있도록 정리하라.

[작성 지침]
- 인터뷰이가 "확인해서 주겠다 / 자료를 보내겠다 / 다시 보겠다"고 한 것은 모두 requestedData로 분류하라.
- 매출 인식, 일회성 손익, 특수관계자 거래, 운전자본, 우발부채, 회계정책 변경,
  실사조정(QoE) 가능성과 관련된 발언은 financialRiskFlags로 별도 추출하라.
- 각 리스크 단서에는 confidence("높음"|"중간"|"낮음")를 붙여라. 단정하지 마라.
- 숫자·계정과목·기간은 전사문 그대로 보존하라.

[출력 스키마] — 회의 기본 스키마 + 아래 키 추가
{
  "title": "회의 핵심을 담은 제목",
  "summary": "회의 전체를 5~8문장으로 재구성한 요약",
  "discussions": ["주요 논의사항 항목"],
  "decisions": ["확정된 결정사항"],
  "todos": [ { "task": "해야 할 일", "owner": "담당자 또는 미지정", "due": "기한 또는 미정", "status": "예정" } ],
  "openIssues": ["미결 이슈"],
  "nextAgenda": ["다음 회의 안건"],
  "requestedData": [
    { "item": "요청/제출 예정 자료", "purpose": "왜 필요한지", "owner": "제공 주체", "due": "기한 또는 미정" }
  ],
  "financialRiskFlags": [
    { "area": "매출인식|원가|특수관계자|운전자본|우발부채|회계정책|기타", "finding": "관찰된 단서", "implication": "QoE/밸류에이션상 함의", "confidence": "높음|중간|낮음" }
  ]
}

[전사문]
<<<TRANSCRIPT>>>`;

const MEETING_MA_USER = `아래 전사문은 M&A 거래 상대방과의 미팅 녹음이다.
딜 진행 노트와 후속 액션에 바로 쓸 수 있도록 정리하라.

[작성 지침]
- 거래구조(지분/자산양수도, RCPS·CB 등 증권종류, SPC, 유한회사 제약 등),
  가격·밸류에이션, 실사 범위·일정, 선결조건, 진술보장 관련 발언을 dealPoints로 추출하라.
- 양측이 합의한 것과 한쪽이 주장한 것을 구분하라(decisions vs discussions).
- 후속으로 보낼 자료·문서(LOI, NDA, 텀시트, 자료 등)는 followUps로 정리하라.
- 미공개 중요정보(MNPI)·내부정보로 보이는 발언이 있으면 mnpiNotes에 기록하고,
  "외부 공유·매매 활용 주의"를 함의로 남겨라. (법적 판단은 하지 말고 플래그만)
- 거래처·금액·지분율·일정은 전사문 그대로 보존하라.

[출력 스키마] — 회의 기본 스키마 + 아래 키 추가
{
  "title": "회의 핵심을 담은 제목",
  "summary": "회의 전체를 5~8문장으로 재구성한 요약",
  "discussions": ["주요 논의사항 항목"],
  "decisions": ["확정된 결정사항"],
  "todos": [ { "task": "해야 할 일", "owner": "담당자 또는 미지정", "due": "기한 또는 미정", "status": "예정" } ],
  "openIssues": ["미결 이슈"],
  "nextAgenda": ["다음 회의 안건"],
  "dealPoints": [
    { "topic": "거래구조|가격|실사|일정|선결조건|진보|기타", "content": "쟁점 내용", "ourSide": "우리 측 입장 또는 미상", "counterparty": "상대 측 입장 또는 미상" }
  ],
  "followUps": [
    { "deliverable": "보낼 자료/문서", "owner": "담당", "due": "기한 또는 미정" }
  ],
  "mnpiNotes": [
    { "info": "미공개 중요정보로 보이는 내용", "caution": "취급 주의 사유" }
  ]
}

[전사문]
<<<TRANSCRIPT>>>`;

const MEETING_NEGOTIATION_USER = `아래 전사문은 거래처와의 협상/상담 녹음이다.
협상 노트와 후속 커뮤니케이션에 바로 쓸 수 있도록 정리하라.

[작성 지침]
- 상대방이 우리에게 요청한 것(theirAsks)과 우리가 약속/제안한 것(ourCommitments)을 구분하라.
- 합의점과 이견을 명확히 나눠라(agreements vs openIssues).
- 협상 종료 후 상대방에게 보낼 후속 이메일 초안을 draftEmail에 작성하라.
  (정중한 비즈니스 한국어, 합의사항 확인 + 후속 일정 포함, 6~10문장)

[출력 스키마] — 회의 기본 스키마 + 아래 키 추가
{
  "title": "회의 핵심을 담은 제목",
  "summary": "회의 전체를 5~8문장으로 재구성한 요약",
  "discussions": ["주요 논의사항 항목"],
  "decisions": ["확정된 결정사항"],
  "todos": [ { "task": "해야 할 일", "owner": "담당자 또는 미지정", "due": "기한 또는 미정", "status": "예정" } ],
  "openIssues": ["미결 이슈"],
  "nextAgenda": ["다음 회의 안건"],
  "theirAsks": ["상대방 요청사항"],
  "ourCommitments": ["우리가 약속/제안한 사항"],
  "agreements": ["합의된 사항"],
  "draftEmail": { "subject": "메일 제목", "body": "메일 본문" }
}

[전사문]
<<<TRANSCRIPT>>>`;

const USER_TEMPLATES = {
  lesson: { lesson: LESSON_USER },
  meeting: {
    general: MEETING_GENERAL_USER,
    fdd: MEETING_FDD_USER,
    ma: MEETING_MA_USER,
    negotiation: MEETING_NEGOTIATION_USER,
  },
};

// 모드/템플릿에 맞는 USER 프롬프트를 조립한다.
export function buildUserPrompt(mode, template, transcript) {
  let tpl;
  if (mode === "lesson") {
    tpl = USER_TEMPLATES.lesson.lesson;
  } else {
    tpl = USER_TEMPLATES.meeting[template] || USER_TEMPLATES.meeting.general;
  }
  return tpl.replace("<<<TRANSCRIPT>>>", transcript || "");
}

// 결과 렌더링/검증용 — 모드+템플릿별 기대 키 목록
export const EXPECTED_KEYS = {
  lesson: ["title", "summary", "keywords", "concepts", "linkedLearning", "reviewQuestions", "checkPoints"],
  general: ["title", "summary", "discussions", "decisions", "todos", "openIssues", "nextAgenda"],
  fdd: ["title", "summary", "discussions", "decisions", "todos", "openIssues", "nextAgenda", "requestedData", "financialRiskFlags"],
  ma: ["title", "summary", "discussions", "decisions", "todos", "openIssues", "nextAgenda", "dealPoints", "followUps", "mnpiNotes"],
  negotiation: ["title", "summary", "discussions", "decisions", "todos", "openIssues", "nextAgenda", "theirAsks", "ourCommitments", "agreements", "draftEmail"],
};
