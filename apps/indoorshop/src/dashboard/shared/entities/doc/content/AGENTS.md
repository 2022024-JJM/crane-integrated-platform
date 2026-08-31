# AGENTS.md

이 파일은 `ocean-process-system` 레포에서 작업하는 모든 AI 코드 Agent(Claude Code, Codex, Antigravity 등)가 공통으로 참조하는 단일 소스(source of truth)다. 도구별 설정 파일(`CLAUDE.md` 등)은 이 파일을 import하거나 참조하며, 별도 내용을 중복 작성하지 않는다.

## 프로젝트 개요

내업 공정실적 자동수집 시스템 — 한화오션 발주, 조립·가공·선행의장·선행도장 4개 공정존의 센서 데이터(LiDAR/OCR/PLC)를 자동 수집·판별하고 Legacy 시스템과 통합하는 시스템. Kepware/OPC-UA 경로는 완전히 제외되었으며, 각 필드 영역의 dockerized Java 서비스가 MQTT Broker(EMQX)로 직접 publish하는 구조다.

상세 설계 배경은 레포 내 다음 문서를 우선 참조한다:
- `docs/개발환경가이드.md`
- `docs/OT_Server_인프라구성및CICD설계서.md`

> **이 프로젝트는 대부분의 코드를 AI Agent에게 위임해서 작성한다.** 따라서 이 문서에 명시된 규칙(특히 모듈 의존성, 보안, 테스트)을 누락 없이 지키는 것이 코드 품질의 1차 방어선이다. 규칙이 모호하거나 본 문서에 없는 결정이 필요하면, 추측해서 진행하지 말고 작업 전에 사용자에게 확인을 요청한다.

## 기술 스택

- 언어/런타임: Java, **JDK 21** (Spring Boot 3.2 이상, Virtual Threads 활용 가능 — `spring.threads.virtual.enabled=true`)
- 프레임워크: Spring Boot
- 빌드: Gradle 멀티모듈 (Git Flow)
- 메시지 브로커: **MQTT Broker(EMQX)** — 조립용/의장용 2개 인스턴스 분리 (단일 아님)
- OT 미들웨어: ISL v4 (사내 개발, MQTT Agent/Modbus Agent/Engine/Provider) — 내부적으로 **NATS**를 메시징 구현체로 사용 (EMQX와는 별개 계층이므로 혼동하지 말 것)
- DB: PostgreSQL(Hot Data DB, OT망) / SAP HANA·Oracle(통합 실적, IT망)
- 컨테이너: Docker / Docker Compose
- OT Server OS: Ubuntu 24.04 LTS

## 레포 구조

```
ocean-process-system/
├── src/                              # 전체 소스 코드 루트 (언어 무관)
│   ├── settings.gradle               # Gradle 멀티모듈 — 아래 include 목록만 빌드 대상
│   ├── build.gradle
│   ├── gradle.properties
│   ├── ot-core/                      # 공유 State Machine 엔진 (라이브러리, bootJar 비활성화)
│   ├── ot-pipeline-fabrication/      # 가공 실적 판별 서비스
│   ├── ot-pipeline-assembly/         # 조립 실적 판별 서비스
│   ├── ot-pipeline-outfitting/       # 선행의장 실적 판별 서비스
│   ├── ot-pipeline-painting/         # 선행도장 실적 판별 서비스
│   └── state-machine-configs/        # zone별 SM 설정 (source of truth, YAML)
├── web-dashboard/                    # 현황 대시보드 (React + Vite) — 아래 "웹 대시보드" 절 참조
├── deploy/                       # 배포 스크립트 및 docker-compose 파일
└── docs/                         # 설계 문서 (개발환경가이드, OT 인프라 설계서 등)
```

## 모듈 의존성 규칙 (반드시 준수 — Agent가 가장 자주 위반하는 부분)

- 모든 `ot-pipeline-*` 모듈은 `ot-core`에만 의존한다.
- `ot-pipeline-*` 모듈 간 직접 참조는 **금지**한다 (순환 의존 방지, zone별 독립 배포 단위 유지).
- `ot-core`를 변경하면 4개 zone 모듈 전체가 영향을 받으므로, 변경 전 영향 범위를 먼저 확인하고 변경 사실을 PR 설명에 명시한다.
- 새 코드를 작성할 때 어떤 모듈에 둘지 애매하면: zone에 종속되지 않는 공통 로직 → `ot-core`, 특정 공정존 로직 → 해당 `ot-pipeline-{zone}`.
- 빌드/리뷰 전 자가 점검: 새로 추가한 `import` 또는 `project(':...')` 의존성이 위 규칙을 어기는지 항상 확인한다.

## 모듈 내부 패키지 구조 (헥사고날 아키텍처 — 새 코드는 반드시 이 구조를 따른다)

Java 모듈(`ot-core`, `ot-pipeline-*`)의 내부 패키지는 헥사고날 아키텍처를 따른다. **`domain/`은 Spring 등 프레임워크를 import하지 않는다.** 프레임워크 의존은 `infrastructure/`, `adapter/`, `config/`에만 둔다. 새 클래스를 만들 때 아래 패키지 중 어디에 속하는지 먼저 판단하고, 애매하면 사용자에게 확인한다.

**ot-core** (`com.hanwha.ocean.otcore`):
```
domain/model/, domain/statemachine/, domain/exception/         # 순수 도메인, 프레임워크 비의존
application/port/in/EvaluateProcessEventUseCase.java            # zone 모듈이 호출하는 진입점
application/port/out/StateMachineConfigRepository.java
application/service/DefaultEvaluateProcessEventService.java
infrastructure/config/YamlStateMachineConfigRepository.java
infrastructure/config/StateMachineProperties.java
```

**ot-pipeline-{zone}** (`com.hanwha.ocean.pipeline.{zone}` — fabrication/assembly/outfitting/painting 4개 모듈에 동일 적용):
```
domain/                                          # zone 고유 보강 모델만 (대부분 ot-core 도메인 재사용)
application/port/in/Judge{Zone}ProcessUseCase.java        # Provider 진입점 — OT Core가 호출
application/port/out/HotDataRepository.java
application/port/out/LegacyDataGateway.java                # 가공은 필수, 나머지는 선택
application/port/out/ProcessResultNotifier.java             # ⚠️ 전달 프로토콜 미확정 — 포트만 정의, 구현 보류
application/service/{Zone}ProcessJudgeService.java          # ot-core의 EvaluateProcessEventUseCase 호출
adapter/in/provider/{Zone}ProviderEndpoint.java              # ⚠️ REST/RPC 등 실제 프로토콜 미확정
adapter/out/persistence/HotDataJdbcRepository.java
adapter/out/legacy/LegacyDbJdbcGateway.java
adapter/out/notifier/                                        # TBD — ISL4 Provider SDK 연동 방식 확정 후 구현
config/{Zone}Application.java, config/BeanWiringConfig.java
```

- **MQTT 어댑터를 두지 않는다.** MQTT Broker 구독은 ISL4 Agent(벤더 컴포넌트)가 처리하고, zone 모듈은 OT Core가 호출하는 Provider로만 동작한다 (위 "작업 시 주의사항"의 가공/도장 zone 규칙과 일치).
- ⚠️ 표시된 `ProcessResultNotifier`/`{Zone}ProviderEndpoint`는 프로토콜이 미확정이므로, 포트(인터페이스)만 만들고 구현체(adapter)는 추측해서 채우지 않는다 — 사용자에게 먼저 확인한다.

## 웹 대시보드 (`web-dashboard/`) — 공정별 병렬 개발 규칙

현황 대시보드는 React + Vite + TypeScript 로 만든 별도 앱이다 (`web-dashboard/`, 패키지 `ocean-process-web-dashboard`). **공정별 담당자가 나란히 작업할 수 있도록** 화면 코드를 공정 모듈로 갈라 두었다. 아래 규칙은 그 구조를 지키기 위한 것이며, 어기면 두 공정의 작업이 같은 파일에서 부딪힌다.

### 디렉토리 구조

```
web-dashboard/src/
├── app/                    # 조립(assembly) 계층 — 라우터·모듈 등록·전역 타입 선언
│   ├── bootstrap.ts        #   공정 모듈 목록 (⚠️ 모듈을 새로 만들 때만 수정)
│   ├── router.tsx          #   공통 라우트 + 레지스트리가 모아 온 공정 라우트
│   └── i18next.d.ts        #   t() 키 타입 (모듈당 한 줄)
├── processes/              # 공정 모듈 — 각 담당자가 자기 디렉토리만 고친다
│   ├── fabrication/
│   ├── assembly/
│   ├── outfitting/
│   ├── painting/
│   └── yard/               #   물류(야드) — 공정존은 아니지만 소유 단위는 같다
└── shared/                 # 공통 — 변경 시 사전 협의
    ├── model/              #   ProcessModule 타입 + 레지스트리
    ├── entities/ features/ widgets/ pages/ ui/ lib/ config/ styles/
```

각 공정 모듈은 자기 화면·상태·API 호출·번역 문구를 전부 자기 디렉토리 안에 둔다:

```
processes/{zone}/
├── module.ts       # 이 모듈의 선언 — 라우트·네비 항목·번역 조각·대시보드 카드
├── i18n/{ko,en}.ts # 이 공정의 문구 (공통 로케일 파일을 건드리지 않는다)
├── api/ model/ lib/ ui/
```

### 지켜야 할 것

- **공정 모듈 간 직접 import 금지.** `processes/painting` 이 `processes/assembly` 를 부르면 안 된다. 공통으로 필요한 값은 `shared` 를 경유한다 — 다른 모듈의 데이터가 필요하면 `ProcessModule.provides` 로 내고 `shared/model/processRegistry` 를 통해 읽는다 (야드 화면이 조립의 공장 현황을 읽는 방식이 그 예다).
- **`shared` 는 특정 공정을 알지 못한다.** `shared/**` 에서 `@/processes/**` 를 import 하지 않는다. 공통 화면이 공정 목록을 알아야 하면 레지스트리에 물어본다 (`getProcessZones()`, `getProcessNavEntries()`, `findProcessModuleByPath()`).
- **`app` 은 아래 레이어가 참조하지 않는다.** `processes/**`·`shared/**` 에서 `@/app/**` 를 import 하지 않는다.
- 위 셋은 `npm run lint` 가 자동으로 검사한다 (`web-dashboard/scripts/check-boundaries.mjs`). oxlint 의 `no-restricted-imports` 는 글롭 패턴을 아직 구현하지 않아 조용히 통과하므로 그것에 기대지 않는다.

### 화면·문구·항목을 더할 때 (중앙 파일을 열지 않는다)

| 하려는 일 | 고치는 곳 | 열지 **않는** 곳 |
|---|---|---|
| 라우트 추가 | `processes/{zone}/module.ts` 의 `routes` | `app/router.tsx` |
| 사이드바 항목·아이콘·데이터 출처 변경 | 같은 파일의 `nav` | `shared/config/navigation.ts`, `shared/widgets/sidebar` |
| 화면 문구 추가·수정 | `processes/{zone}/i18n/{ko,en}.ts` | `shared/lib/i18n/locales/{ko,en}.ts` |
| 대시보드 공정존 카드 값 변경 | 같은 파일의 `zone` | `shared/pages/DashboardPage.tsx` |
| 공정 상수·타입 | `processes/{zone}/` 안 | `shared/` 의 공통 상수 파일 |

공정 모듈을 **새로 만들 때만** `app/bootstrap.ts` 와 `app/i18next.d.ts` 에 한 줄씩 추가한다. 이 두 파일을 바꾸는 PR 은 구조 변경이므로 리뷰에서 그 사실을 명시한다.

`module.ts` 는 앱이 뜰 때 전부 읽히므로 **가볍게 유지한다** — 화면은 `lazy()` 로 두고, three.js 같은 무거운 의존을 정적으로 import 하지 않는다 (대시보드만 보는 사용자에게까지 그 무게가 실린다).

### 상태 관리

아직 상태 관리 라이브러리를 쓰지 않는다 (로컬 state + `shared/lib` 의 Context 뿐). 도입하게 되면 **공정별 슬라이스로 나눠 각 모듈 안에 두고**, 공통 스토어 파일 하나에 몰아넣지 않는다.

### 명령

```bash
cd web-dashboard
npm run dev          # 개발 서버
npm run build        # tsc -b && vite build
npm run lint         # oxlint + 모듈 경계 검사
npm run boundaries   # 모듈 경계 검사만
```

## State Machine 설정

- 인식 규칙은 코드에 하드코딩하지 않고 `src/state-machine-configs/{zone}.yml`로 분리한다.
- 애플리케이션은 `STATE_MACHINE_CONFIG_PATH` 환경변수로 외부 경로를 참조한다 (`@ConfigurationProperties(prefix = "state-machine")`).
- 운영 환경에서는 컨테이너 볼륨 마운트로 주입하며, 설정 변경 시 재빌드 없이 해당 zone 컨테이너 재시작만으로 반영한다.

## 물리 배포 / zone-서버 매핑 (코드에서 환경변수·포트 다룰 때 참고)

| 서버 | 권역 | 비고 |
|---|---|---|
| OT-Server-A | 조립 + 도장 | MQTT Broker(조립용, EMQX) + 조립 Agent 포함 |
| OT-Server-B | 가공 + 선행의장 | MQTT Broker(의장용, EMQX) + 의장 Agent 포함 |
| ISL Server | ISL4 스택 전용 | Engine/Dashboard, RFC/Oracle Agent, Thingworx Provider, 도장 Modbus Agent |
| Hot Data DB 서버 | 공통 | PostgreSQL + Hot DB Agent/Provider |

같은 서버에 zone 2개가 함께 뜨므로, actuator 등 관리 포트는 모듈별로 분리한다 (예: 8080/8081). DB/Broker 연결은 `initialization-fail-timeout: -1` 등으로 재시도 견고성을 갖추도록 구현한다 (기동 순서를 코드가 가정하지 않도록).

## 코딩 컨벤션

- Java 코드 스타일: Spring Boot 표준 컨벤션 따름.
- 커밋 메시지: `type(scope) : 설명` 형식을 사용하며, 콜론(`:`) 양쪽에 공백을 하나씩 둔다. `scope`에는 변경한 모듈명을 표기하고 **WBS 번호는 포함하지 않는다.**
  ```
  feat(ot-pipeline-assembly) : LiDAR 이벤트 판별 로직 추가
  fix(web-dashboard) : 공정존 지도 확대 동작 수정
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

## 빌드/실행 명령

```bash
# settings.gradle, gradlew가 모두 src/ 아래에 있으므로 먼저 이동
cd src

# 전체 빌드
./gradlew build

# 특정 모듈만 빌드
./gradlew :ot-pipeline-assembly:build
./gradlew :ot-pipeline-assembly:bootJar

# 로컬 실행 (의존 서비스: OT DB, EMQX 등이 로컬에 떠 있어야 함)
./gradlew :ot-pipeline-assembly:bootRun
```

## 본 문서 변경 규칙

이 문서는 일반 코드와 동일하게 **PR 리뷰를 거쳐서만 변경**한다. 임의로 로컬에서만 다르게 유지하지 않는다 (그렇게 하면 팀원·Agent마다 동작이 달라짐). 변경 시 PR 제목에 `[AGENTS.md]`를 prefix로 붙인다.
