# AGENTS.md

이 파일은 `ocean-process-system` 레포에서 작업하는 모든 AI 코드 Agent(Claude Code, Codex, Antigravity 등)가 공통으로 참조하는 단일 소스(source of truth)다. 도구별 설정 파일(`CLAUDE.md` 등)은 이 파일을 import하거나 참조하며, 별도 내용을 중복 작성하지 않는다.

## 프로젝트 개요

내업 공정실적 자동수집 시스템 — 한화오션 발주, 조립·가공·선행의장·선행도장 4개 공정존의 센서 데이터(LiDAR/OCR/RFID/PLC)를 자동 수집·판별하고 Legacy 시스템과 통합하는 시스템. Kepware/OPC-UA 경로는 완전히 제외되었으며, 각 필드 영역의 dockerized Java 서비스가 MQTT Broker(EMQX)로 직접 publish하는 구조다.

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
│   ├── rfid-preprocessor/            # RFID 태그 debounce/중복제거 전처리
│   ├── rfid-tag-publisher/           # RFID 전처리 결과 MQTT publish — ⚠️ 기술 스택 미확정(Java가 아닐 수 있음), settings.gradle include 목록에는 없음
│   └── state-machine-configs/        # zone별 SM 설정 (source of truth, YAML)
├── deploy/                       # 배포 스크립트 및 docker-compose 파일
└── docs/                         # 설계 문서 (개발환경가이드, OT 인프라 설계서 등)
```

> **참고:** `rfid-tag-publisher`는 `src/` 안에 같이 두지만 Gradle 멀티모듈 빌드 대상은 아니다 (`settings.gradle`의 `include`에 없음 — Gradle은 거기 없는 디렉토리를 그냥 무시한다). 기술 스택이 확정되면 해당 언어의 빌드 설정을 그 디렉토리 안에 독립적으로 둔다.

## 모듈 의존성 규칙 (반드시 준수 — Agent가 가장 자주 위반하는 부분)

- 모든 `ot-pipeline-*` 모듈은 `ot-core`에만 의존한다.
- `ot-pipeline-*` 모듈 간 직접 참조는 **금지**한다 (순환 의존 방지, zone별 독립 배포 단위 유지).
- `ot-core`를 변경하면 4개 zone 모듈 전체가 영향을 받으므로, 변경 전 영향 범위를 먼저 확인하고 변경 사실을 PR 설명에 명시한다.
- 새 코드를 작성할 때 어떤 모듈에 둘지 애매하면: zone에 종속되지 않는 공통 로직 → `ot-core`, 특정 공정존 로직 → 해당 `ot-pipeline-{zone}`.
- 빌드/리뷰 전 자가 점검: 새로 추가한 `import` 또는 `project(':...')` 의존성이 위 규칙을 어기는지 항상 확인한다.

## 모듈 내부 패키지 구조 (헥사고날 아키텍처 — 새 코드는 반드시 이 구조를 따른다)

Java 모듈(`ot-core`, `ot-pipeline-*`, `rfid-preprocessor`)의 내부 패키지는 헥사고날 아키텍처를 따른다. **`domain/`은 Spring 등 프레임워크를 import하지 않는다.** 프레임워크 의존은 `infrastructure/`, `adapter/`, `config/`에만 둔다. 새 클래스를 만들 때 아래 패키지 중 어디에 속하는지 먼저 판단하고, 애매하면 사용자에게 확인한다.

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

**rfid-preprocessor** (`com.hanwha.ocean.rfid.preprocessor`):
```
domain/TagDebounceRule.java
application/port/in/PreprocessTagEventUseCase.java
application/port/out/CleanedTagEventPublisher.java
adapter/in/reader/, adapter/out/mqtt/
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
- 커밋 메시지: 모듈 경로를 prefix로 표기한다. **WBS 번호는 포함하지 않는다.**
  ```
  [ot-pipeline-assembly] LiDAR 이벤트 판별 로직 추가
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
- 가공 zone은 LiDAR/RFID/PLC 같은 필드 센서가 없다 — Legacy DB 연동 중심으로 동작하며, MQTT Agent를 통한 구독 로직이 필요 없다.
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
