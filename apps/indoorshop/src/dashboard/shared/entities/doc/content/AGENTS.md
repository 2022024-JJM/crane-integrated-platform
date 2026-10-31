# AGENTS.md

이 파일은 `ocean-inshop-process` 레포에서 작업하는 모든 AI 코드 Agent(Claude Code, Codex, Antigravity 등)가 공통으로 참조하는 단일 소스(source of truth)다. 도구별 설정 파일(`CLAUDE.md` 등)은 이 파일을 import하거나 참조하며, 별도 내용을 중복 작성하지 않는다.

## 프로젝트 개요

내업 공정실적 자동수집 시스템 — 한화오션 발주, 조립·가공·선행의장·선행도장 4개 공정존의 센서 데이터(LiDAR/OCR/PLC)를 자동 수집·판별하고 Legacy 시스템과 통합하는 시스템. Kepware/OPC-UA 경로는 완전히 제외되었으며, 각 필드 영역의 dockerized Java 서비스가 MQTT Broker(EMQX)로 직접 publish하는 구조다.

문서 전체의 위치·역할·버전·갱신 주체는 **`docs/문서지도.md`** 한 곳에서 본다. 코드 작업 전 최소 확인: `docs/guide/개발환경가이드.md`, `docs/design/OT_Server_인프라구성및CICD설계서.md`.

> **이 프로젝트는 대부분의 코드를 AI Agent에게 위임해서 작성한다.** 따라서 이 문서에 명시된 규칙(특히 모듈 의존성, 보안, 테스트)을 누락 없이 지키는 것이 코드 품질의 1차 방어선이다. 규칙이 모호하거나 본 문서에 없는 결정이 필요하면, 추측해서 진행하지 말고 작업 전에 사용자에게 확인을 요청한다.

## 프로그램 인벤토리

이 레포는 배포 단위가 다른 프로그램 여러 개를 담는 모노레포다. 작업 전에 이 표에서 대상 프로그램을 확인하고 해당 행의 규칙·문서를 읽는다. 새 프로그램은 코드 작성 전에 이 표에 행을 추가한다 (`[AGENTS.md]` PR).

| 프로그램 | 망 | 기술 | 위치 | 규칙·먼저 읽을 문서 | 문서 ID 접두 |
|---|---|---|---|---|---|
| 실적 판별 서비스 4종 + `ot-core` | OT망 | Java 21 / Spring Boot / Gradle | `services/ot-core`, `services/ot-pipeline-{zone}` | `services/AGENTS.md`, `docs/guide/ot-core-구조.md`, `docs/spec/기능정의서_{권역}.md` | FAB / ASM / OUT / PNT |
| OT 대시보드 (OTD) | OT망 | React 19 / Vite 8 / TypeScript | `apps/ot-dashboard/` | `apps/AGENTS.md`, `apps/ot-dashboard/README.md`, `docs/spec/기능정의서_OT대시보드.md`, `docs/design/uiux/README.md` | OTD |
| 레거시 Agent 시뮬레이터 | 개발 도구 (운영 배포 단위 아님) | Java / Gradle | `services/legacy-agent-simulator` | `services/AGENTS.md`, `deploy/README.md` 「가공 PoC E2E 검증」 | — |
| 통합실적대시보드 (IPD) | IT망 | ⚠️ 소속 레포·물리 배치 미확정 (xplatform으로 확인) | 없음 | `docs/spec/기능정의서_통합실적대시보드.md` | IPD |
| Key-in 실적 (KEY) | IT망 | ⚠️ 소속 레포·물리 배치 미확정 (X-Platform) | 없음 | `docs/spec/기능정의서_Key-in실적.md` | KEY |
| ISL v4 스택 | OT망 | 벤더 컴포넌트 | 레포 밖 (`deploy/docker-compose.isl.yml`은 자리만) | `docs/design/OT_Server_인프라구성및CICD설계서.md` | — |

- **시스템 영문명:** `ocean-inshop-process`. Gradle 루트 이름, npm 패키지 스코프(`@ocean-inshop-process/*`), 문서의 영문 표기가 여기서 파생된다. 다른 표기를 만들지 않는다.
- **용어 구분:** `ot-pipeline-{zone}`은 실적 판별 서비스의 구현 모듈이며 판별 구간만 담당한다. 문서의 "수집 파이프라인"은 ISL Agent → MQTT Broker → 판별 서비스 → Hot Data DB 경로 전체를 뜻한다. 모듈명의 `pipeline`은 고유명사로 유지하며, 새 모듈·프로그램 이름에 이 접두를 쓰지 않는다.

### 서브에이전트 브리핑 규칙

`docs/`는 레포 루트에 하나만 두며 프로그램별로 분리하지 않는다. 서브에이전트는 대화 맥락을 상속하지 않으므로, 하위 디렉토리 세션이나 서브에이전트에게 작업을 넘길 때는 브리핑에 다음을 포함한다.

1. **근거 문서 경로** — 레포 루트 기준, 절 번호까지 (예: `docs/spec/기능정의서_가공.md §3.2`). 문서 전체를 읽히지 않는다.
2. **이미 결정된 사항** — 대화에서 정해졌지만 문서에 없는 것.
3. **범위와 금지** — 손대도 되는 디렉토리, 손대면 안 되는 것(`shared/` 수정, 새 IF-ID 채번, 미확정 프로토콜 구현 등).

스킬 스크립트(`.claude/skills/*/scripts/`)는 자기 파일 위치에서 레포 루트를 찾으므로 실행 위치와 무관하게 같은 `docs/`를 참조한다.

## 기술 스택

- 언어/런타임: Java, **JDK 21** (Spring Boot 3.2 이상, Virtual Threads 활용 가능 — `spring.threads.virtual.enabled=true`)
- 프레임워크: Spring Boot
- 빌드: Gradle 멀티모듈 (Git Flow)
- 메시지 브로커: **MQTT Broker(EMQX)** — 조립용/의장용 2개 인스턴스 분리 (단일 아님)
- OT 미들웨어: ISL v4 (사내 개발, MQTT Agent/Modbus Agent/Engine/Provider) — 내부적으로 **NATS**를 메시징 구현체로 사용 (EMQX와는 별개 계층이므로 혼동하지 말 것)
- DB: PostgreSQL(Hot Data DB, OT망) / SAP HANA·Oracle(통합 실적, IT망)
- 컨테이너: Docker / Docker Compose
- OT Server OS: Ubuntu 24.04 LTS

프론트엔드 스택은 [`apps/AGENTS.md`](apps/AGENTS.md) 「기술 스택」에 있다.

## 레포 구조

```
ocean-inshop-process/
├── AGENTS.md / CLAUDE.md             # 레포 공통 규칙(이 문서) / Claude Code 래퍼
├── .claude/                          # AI 스킬·서브에이전트·공통 설정 — 레포 공통, 프로그램별로 두지 않는다
├── services/                         # Java 루트 (Gradle 멀티모듈 — settings.gradle의 include 목록만 빌드 대상)
│   ├── AGENTS.md / CLAUDE.md         # Java 모듈 규칙 (의존성·패키지 구조·State Machine·빌드)
│   ├── settings.gradle, build.gradle, gradle.properties
│   ├── ot-core/                      # 공유 State Machine 엔진 (라이브러리, bootJar 비활성화)
│   ├── ot-pipeline-fabrication/      # 가공 실적 판별 서비스
│   ├── ot-pipeline-assembly/         # 조립 실적 판별 서비스
│   ├── ot-pipeline-outfitting/       # 선행의장 실적 판별 서비스
│   ├── ot-pipeline-painting/         # 선행도장 실적 판별 서비스
│   ├── legacy-agent-simulator/       # 개발·PoC 도구 — 레거시 미러 테이블 시뮬레이터 (운영 배포 단위 아님)
│   └── state-machine-configs/        # zone별 SM 설정 (source of truth, YAML)
├── apps/                             # 프론트엔드 루트
│   ├── AGENTS.md / CLAUDE.md         # 프론트엔드 규칙 (공정 모듈 경계·화면 추가 위치·명령)
│   └── ot-dashboard/                 # OT 대시보드 (React + Vite)
├── deploy/                           # 서버별 docker-compose·initdb·로컬 dev 스크립트 — deploy/README.md
└── docs/                             # 설계 문서 — 색인은 docs/문서지도.md
```

배치 원칙: 1단계 디렉토리 하나는 빌드 루트 하나에 대응한다(`services/` = Gradle 루트, `apps/` = 프론트엔드 루트). 망 구분은 디렉토리가 아니라 프로그램 이름 접두(`ot-`/`it-`)로 한다. IT망 프로그램(IPD·KEY·Rest Server)은 소속이 확정되면 같은 원칙으로 `apps/it-*`, `services/it-*`에 둔다.

이 트리가 레포 구조의 정본이다. `docs/guide/개발환경가이드.md` 등 다른 문서는 이 트리를 복제하지 않고 링크한다.

## 프로그램별 규칙

프로그램 고유 규칙은 그 프로그램의 1단계 디렉토리에 있는 `AGENTS.md`에 둔다. 해당 디렉토리에서 작업하는 에이전트는 루트 규칙에 더해 그 문서를 읽는다 (Claude Code는 하위 `CLAUDE.md`를 통해 자동으로 읽는다).

| 디렉토리 | 문서 | 담는 것 |
|---|---|---|
| `services/` | [`services/AGENTS.md`](services/AGENTS.md) | 모듈 의존성 규칙, 헥사고날 패키지 구조, State Machine 설정, 물리 배포·포트, 빌드 명령, 새 모듈 추가 |
| `apps/` | [`apps/AGENTS.md`](apps/AGENTS.md) | 프론트엔드 스택, 공정 모듈 경계, 화면·문구 추가 위치, 명령, 새 앱 추가 |

## 코딩 컨벤션

- Java 코드 스타일: Spring Boot 표준 컨벤션 따름.
- 커밋 메시지: `type(scope) : 설명` 형식을 사용하며, 콜론(`:`) 양쪽에 공백을 하나씩 둔다. `scope`에는 변경한 모듈명을 표기하고 **WBS 번호는 포함하지 않는다.**
  ```
  feat(ot-pipeline-assembly) : LiDAR 이벤트 판별 로직 추가
  fix(ot-dashboard) : 공정존 지도 확대 동작 수정
  ```
- 브랜치: `main` / `develop` / `feature/{모듈}-{설명}` / `release/{모듈}-v{버전}` / `hotfix/{모듈}-{설명}`
- 릴리즈 태그는 레포 전체가 아니라 **모듈 단위**로 생성한다 (예: `ot-pipeline-assembly-v1.2.0`).

## 테스트 (Agent에게 코드를 위임할 때 가장 중요한 안전망)

- 코드를 작성한 Agent는 해당 변경에 대한 단위 테스트도 함께 작성한다. 테스트 없는 PR은 기본적으로 머지 대상이 아니다.
- 모듈 의존성 규칙(위 항목) 위반 여부는 가능하면 빌드 단계에서 정적으로 검출되도록 한다 (예: Gradle 모듈 의존성 검증, ArchUnit 등 — 도입 여부는 팀 논의 필요).
- 외부 연동(JDBC, MQTT, RFC) 코드는 실제 연결 없이도 동작을 검증할 수 있도록 mock/fake를 우선 사용한다.

## 보안 / 민감정보 (Agent 프롬프트·컨텍스트에 노출 금지)

- DB 자격증명, SAP RFC 연동 정보, 한화오션 내부 문서(제안서, 협의목록 등 비공개 자료)를 Agent에 그대로 붙여넣지 않는다.
- `.env.*.example`만 커밋하고 실값은 `.gitignore` 처리한다 (기존 규칙 유지).
- Agent가 자격증명이나 사내 비공개 정보를 요구하는 작업을 만나면, 실제 값을 채우지 말고 플레이스홀더로 남기고 사용자에게 알린다.

## 작업 시 주의사항

- Kepware/OPC-UA/KEPServerEX 관련 코드·설정은 절대 재도입하지 않는다 (완전히 폐기된 아키텍처).
- **RFID 경로는 폐기되었다 — 선행의장의 필드 디바이스는 LiDAR다.** RFID 수집 코드·설정을 새로 만들지 않는다.
- 가공 zone은 LiDAR/PLC 같은 필드 센서가 없다 — Legacy DB 연동 중심으로 동작하며, MQTT Agent를 통한 구독 로직이 필요 없다.
- 도장 zone은 PLC가 Modbus로 ISL Server에 직결되며 MQTT Broker를 경유하지 않는다 — `ot-pipeline-painting`에서 MQTT 구독 코드를 작성하지 않는다.
- 미확정 항목(예: OT-Server↔ISL Server 결과 전달 프로토콜, 공정 태그 Provider 역할)에 의존하는 코드를 작성해야 한다면, 작업 전에 사용자에게 확인을 요청한다.
- 본 문서와 실제 코드/설정이 어긋나는 것을 발견하면, 임의로 코드를 본 문서에 맞추지 말고 먼저 사용자에게 보고한다 (설계가 바뀌었을 수도 있고 문서가 갱신되지 않았을 수도 있음).

## 본 문서 변경 규칙

이 문서는 일반 코드와 동일하게 **PR 리뷰를 거쳐서만 변경**한다. 임의로 로컬에서만 다르게 유지하지 않는다 (그렇게 하면 팀원·Agent마다 동작이 달라짐). 변경 시 PR 제목에 `[AGENTS.md]`를 prefix로 붙인다. `services/AGENTS.md`·`apps/AGENTS.md`도 같은 규칙을 따른다.

**규칙 단일 소스:** 규칙은 이 문서에만 쓴다. `docs/guide/*`는 절차와 설명을 담고, 규칙이 필요한 자리에는 이 문서의 해당 절을 링크한다.
