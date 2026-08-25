# 내업 공정실적 자동수집 시스템
# OT Server 인프라 구성 및 CI/CD 설계서

**버전:** v0.8
**작성:** 이태훈 PM
**소속:** 한화에너지 컨버전스사업부 R&D센터 솔루션개발1팀

---

## 목차

1. [개요](#1-개요)
2. [물리 서버 구성도](#2-물리-서버-구성도)
3. [zone-서버 배치 설계 근거](#3-zone-서버-배치-설계-근거)
4. [컨테이너 / Docker 구성](#4-컨테이너--docker-구성)
5. [서비스 간 의존성 처리 방안](#5-서비스-간-의존성-처리-방안)
6. [CI/CD 파이프라인](#6-cicd-파이프라인)
7. [보안 / Secret 관리](#7-보안--secret-관리)
8. [향후 검토 항목](#8-향후-검토-항목)

---

## 1. 개요

본 문서는 내업 공정실적 자동수집 시스템의 OT 영역 물리 인프라 구성과 그 설계 근거, 그리고 모노레포 구조를 전제로 한 CI/CD 파이프라인 전략을 정의한다.

대상 독자는 PM/PL 및 인프라 의사결정에 관여하는 인력이며, 모듈 빌드/실행 등 개발 절차는 「개발환경 가이드」를 참조한다.

### 1.1 설계 원칙

- zone(가공/조립/선행의장/선행도장)별 배포 단위는 독립 프로세스로 분리한다.
- 호스트 간 의존성은 기동 "순서"가 아니라 애플리케이션 레벨의 "재시도 견고성"으로 해결한다.
- 인프라 복잡도는 현재 운영 규모(물리 서버 4대)에 맞춰 최소화하고, 필요 시점에 단계적으로 고도화한다.

---

## 2. 물리 서버 구성도

### 2.1 서버 인벤토리 (2026-06 확정)

Kepware/EMQX 기반 구조는 완전히 제외되었으며, 물리 서버는 아래 4대로 확정되었다.

| 서버 | 권역 | 주요 구성 요소 |
|---|---|---|
| OT-Server-A (@전산실) | 조립 + 도장 | MQTT Broker(조립용), 조립 Agent(MQTT Agent, ISL V4 Agent), 조립 실적 판별 서비스, 도장 실적 판별 서비스, 공정 태그 Provider(ISL V4 Provider) |
| OT-Server-B (@전산실) | 가공 + 선행의장 | MQTT Broker(의장용), 의장 Agent(MQTT Agent, ISL V4 Agent), 가공 실적 판별 서비스, 의장 실적 판별 서비스 |
| ISL Server | ISL4 스택 전용 + 도장 Agent | ISL Dashboard, ISL Engine(OT Core), RFC Agent/Provider, Oracle DB Agent, Thingworx Provider, 도장 Agent(Modbus Agent, ISL V4 Agent) |
| Hot Data DB 서버 | 공통 | Hot DB Agent/Provider(ISL V4), PostgreSQL(dockerized) |

> **참고:** "공정 태그 Provider"는 의장품 입출고장의 Tag 프린터 애플리케이션에 실적판별 결과를 제공하는 ISL V4 Provider로 추정되며, 정확한 역할은 박준상 PL 확인 후 갱신 예정.

### 2.2 MQTT Broker — 단일 아닌 2개 인스턴스로 분리

> ⚠️ **변경 사항:** 이전 논의에서는 MQTT Broker를 단일 인스턴스로 가정하였으나, 실제 물리 배포 다이어그램 기준 **조립용/의장용 2개 인스턴스로 분리** 운영하는 것으로 최종 확정되었다.

| Broker | 위치 | 구독처 |
|---|---|---|
| MQTT Broker(조립용) | OT-Server-A | Vision WS 16대(LiDAR/Vision OCR) → 조립 Agent |
| MQTT Broker(의장용) | OT-Server-B | 선행의장1+2공장 통합 → 의장 Agent |

가공 권역은 필드 센서(LiDAR/PLC)가 없어 별도 Agent/Broker 구독 없이, 가공 실적 판별 서비스가 Legacy DB 연동으로 직접 동작한다. 도장 권역은 PLC가 Modbus로 ISL Server의 도장 Agent에 직결되며, MQTT Broker를 경유하지 않는다.

> **참고:** Broker를 zone별로 분리한 이유는 해당 zone의 실적 판별 서비스가 위치한 서버에 Broker와 Agent를 함께 두어 로컬 통신으로 처리하기 위함으로 추정된다(네트워크 홉 최소화). 두 Broker 간 메시지 공유는 없으며, 각 Broker는 독립적으로 장애가 발생할 수 있다 — SPOF 관점에서 조립 Broker 장애 시 조립/도장 데이터 수집에는 영향이 있으나 가공/의장은 영향 없음 (역도 마찬가지).

### 2.3 네트워크 토폴로지

```
Vision WS x16(조립) ──publish──→ MQTT Broker(조립용) @ OT-Server-A ──→ 조립 Agent ──────────────┐
                                                                                                    │
                       MQTT Broker(의장용) @ OT-Server-B ──→ 의장 Agent ─────────────────────────────┤
                                                                                                    │
PLC(가스히터/제습기, 선행도장) ──Modbus 직결──────────────────────────→ ISL Server 도장 Agent ─────────┤
                                                                                                    ▼
                                                                                  실적판별 결과 ──→ ISL Server (ISL Engine)

OT-Server-A/B ──JDBC──→ Hot Data DB (OT망 내부)
ISL Server ──RFC/JDBC──→ IT Layer (SAP HANA, Oracle)
```

Hot Data DB는 OT망 내부에 위치하며, OT-Server-A/B 모두 동일 DB 인스턴스에 JDBC로 접근한다. 4대 서버가 모두 같은 OT망 세그먼트 내에 있어 별도 라우팅 없이 통신 가능한 것을 전제로 한다.

### 2.4 방화벽 / 포트 체크리스트

| 연결 | 포트 | 용도 |
|---|---|---|
| OT-Server-A/B → Hot Data DB | DB 포트 (예: 5432) | JDBC 연결 |
| Vision WS 16대 → OT-Server-A | 1883 (MQTT) | MQTT(조립용, EMQX) publish |
| PLC → ISL Server | Modbus 포트 (예: 502) | Modbus 직결 |
| OT-Server-A/B ↔ ISL Server | 실적판별 결과 전달용 포트 (확정 필요) | 실적판별 결과 OT Core 전달 |
| ISL Server → Hot Data DB | DB 포트 | Hot DB Agent JDBC |
| ISL Server → IT Layer | RFC/JDBC 포트 | SAP HANA/Oracle 연계 |

> **참고:** OT-Server-A/B → ISL Server 간 "실적판별 결과" 전달 프로토콜/포트가 다이어그램상 명확하지 않아 미확정으로 표시함. ISL4 프레임워크 표준 포트 확인 후 갱신 필요. OT망 내부 서버 간 통신 정책은 협의목록 No.7(OT-IT DMZ 네트워크 정책)과는 별개 항목으로, 한화오션 측과 별도 확인이 필요할 수 있다.

---

## 3. zone-서버 배치 설계 근거

**OT-Server-A = 조립 + 도장, OT-Server-B = 가공 + 선행의장**으로 최종 확정되었다 (이전 검토안이었던 "가공+조립 / 의장+도장" 조합에서 변경됨).

### 3.1 페어링 변경 배경 — 부하 분산

| 권역 | 부하 특성 |
|---|---|
| 조립 | 최고 부하 — LiDAR 340대 + Vision WS 16대(HP OMEN 35L, RTX 5070Ti) 실시간 추론 이벤트 |
| 가공 | 중간 — Legacy DB 연동 중심 |
| 선행의장 | 중간 |
| 선행도장 | 최저 — PLC 기반, 이벤트 빈도 낮음 |

부하가 가장 큰 **조립**을 가장 가벼운 **도장**과 묶고, 중간 부하인 **가공·선행의장**을 묶음으로써, 기존 검토안(가공+조립 / 의장+도장)보다 두 서버 간 부하 편차를 줄이는 방향으로 변경되었다.

### 3.2 MQTT Broker 위치와의 연관성

zone-서버 페어링은 MQTT Broker 배치와도 맞물린다. 조립 zone의 MQTT Broker·Agent는 OT-Server-A에, 의장 zone의 MQTT Broker·Agent는 OT-Server-B에 위치하여, 해당 zone의 실적 판별 서비스와 로컬에서 통신한다 (2.2절 참조). 가공·도장은 별도 Broker 구독이 없으므로 이 배치 제약에서 자유롭다.

> **참고:** 실측 부하(Vision WS publish interval 확정 후) 결과에 따라 재배치 가능성은 여전히 열려 있다.

---

## 4. 컨테이너 / Docker 구성

### 4.1 이미지 빌드 전략

각 모듈은 독립된 Docker 이미지로 빌드하며, State Machine 설정(YAML)은 이미지에 포함하지 않고 런타임에 볼륨 마운트로 주입한다.

```dockerfile
FROM eclipse-temurin:21-jre
COPY build/libs/ot-pipeline-assembly.jar /app/app.jar
# state-machine yml은 COPY하지 않음 — 런타임 볼륨으로만 주입
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
```

### 4.2 docker-compose 구성 (서버별 분리)

compose 파일은 호스트별로 분리하여 관리한다. MQTT Broker(EMQX)가 zone별로 OT-Server-A/B에 분산되므로, 이전 안(별도 docker-compose.isl.yml에 브로커 포함)에서 변경되었다.

```
deploy/
├── docker-compose.db.yml          # Hot Data DB
├── docker-compose.isl.yml         # ISL Engine/Dashboard, RFC/Oracle Agent, Thingworx Provider, 도장 Modbus Agent
├── docker-compose.server-a.yml    # MQTT Broker(조립용), 조립 Agent, 조립/도장 실적판별서비스
└── docker-compose.server-b.yml    # MQTT Broker(의장용), 의장 Agent, 가공/의장 실적판별서비스
```

**docker-compose.db.yml**

```yaml
services:
  hotdata-db:
    image: postgres:16
    restart: unless-stopped
    env_file: .env.db
    ports:
      - "5432:5432"
    volumes:
      - hotdata-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  hotdata-pgdata:
```

**docker-compose.isl.yml** (MQTT Broker 없이 ISL4 스택 + 도장 Agent만 구성)

```yaml
services:
  isl-engine:
    image: ocean/isl-engine:latest
    restart: unless-stopped
    env_file: .env.isl

  isl-dashboard:
    image: ocean/isl-dashboard:latest
    restart: unless-stopped
    env_file: .env.isl

  rfc-agent:
    image: ocean/isl-rfc-agent:latest
    restart: unless-stopped
    env_file: .env.isl

  oracle-db-agent:
    image: ocean/isl-oracle-agent:latest
    restart: unless-stopped
    env_file: .env.isl

  thingworx-provider:
    image: ocean/isl-thingworx-provider:latest
    restart: unless-stopped
    env_file: .env.isl

  painting-modbus-agent:
    image: ocean/isl-modbus-agent:latest
    restart: unless-stopped
    env_file: .env.isl
    ports:
      - "502:502"   # PLC Modbus 직결 수신
```

**docker-compose.server-a.yml** (MQTT Broker(조립용, EMQX) + 조립 Agent + 조립/도장 실적판별서비스)

```yaml
services:
  mqtt-broker-assembly:
    image: emqx/emqx:5.x
    restart: unless-stopped
    ports:
      - "1883:1883"     # MQTT
      - "8083:8083"     # MQTT over WebSocket
      - "18083:18083"   # EMQX Dashboard/API
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:18083/status"]
      interval: 10s
      timeout: 5s
      retries: 5

  assembly-mqtt-agent:
    image: ocean/isl-mqtt-agent:latest
    restart: unless-stopped
    env_file: .env.server-a
    depends_on:
      - mqtt-broker-assembly   # 같은 호스트라 depends_on 정상 동작

  ot-pipeline-assembly:
    image: ocean/ot-pipeline-assembly:latest
    restart: unless-stopped
    env_file: .env.server-a
    volumes:
      - ${CONFIG_PATH}/assembly.yml:/app/config/assembly.yml:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 60s

  ot-pipeline-painting:
    image: ocean/ot-pipeline-painting:latest
    restart: unless-stopped
    env_file: .env.server-a
    volumes:
      - ${CONFIG_PATH}/painting.yml:/app/config/painting.yml:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8081/actuator/health"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 60s
```

> **참고:** EMQX Dashboard 포트(18083)는 같은 호스트 내 다른 서비스와 충돌하지 않는지 확인 필요. `docker-compose.server-b.yml`은 동일 패턴으로 `mqtt-broker-outfitting`(EMQX) + `outfitting-mqtt-agent` + `ot-pipeline-fabrication`(가공) + `ot-pipeline-outfitting`(의장)로 구성한다. 같은 서버에 zone 2개가 함께 뜨므로 actuator 포트를 모듈별로 분리한다 (예: 8080/8081).

---

## 5. 서비스 간 의존성 처리 방안

### 5.1 검토한 옵션

| 방식 | 장점 | 단점 |
|---|---|---|
| A. 호스트별 개별 compose + 배포 스크립트 순서 제어 | 단순, 현재 구조 그대로 확장 가능 | 호스트 간 의존성은 애플리케이션 레벨 재시도에 의존 |
| B. Docker Swarm으로 4대 클러스터화 | 서비스 디스커버리 자동화, config 배포 자동화 | 운영 학습/부담 추가, 장애 디버깅 복잡도 증가 |

### 5.2 채택 방안: 옵션 A

현재 규모(물리 서버 4대, zone 고정 배치)에서는 옵션 A로 충분하다고 판단하여 채택하였다. Swarm은 향후 운영 부담이 커질 경우 전환을 검토한다.

#### 5.2.1 핵심 설계: 기동 순서가 아닌 재시도 견고성

MQTT Broker가 zone별로 로컬화되면서, OT-Server-A/B 입장에서 실제 호스트 간(cross-host) 의존성은 **Hot Data DB**와 **ISL Server(실적판별 결과 전달)** 두 가지로 줄었다 — MQTT Broker는 같은 호스트 내 통신이라 상대적으로 안정적이다. 다만 물리적으로 분리된 서버 간에는 정확한 기동 순서를 보장하기 어렵다 (예: DB 서버 부팅 지연). 따라서 OT-Server-A/B의 컨테이너가 DB 연결 실패 시에도 죽지 않고 재시도하도록 구성하는 것을 핵심 설계 원칙으로 한다.

```yaml
# application.yml
spring:
  datasource:
    hikari:
      connection-timeout: 30000
      initialization-fail-timeout: -1   # DB 미기동 상태에서도 앱은 종료되지 않고 재시도
```

```yaml
services:
  ot-pipeline-assembly:
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8081/actuator/health"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 60s   # DB 연결 대기 여유
```

#### 5.2.2 배포 순서 스크립트 (권장 순서, 강제 아님)

```bash
#!/bin/bash
set -e
source ../hosts.conf

echo "[1/3] Hot Data DB 기동"
ssh $HOST_DB "cd $DEPLOY_PATH && docker compose -f docker-compose.db.yml up -d"
ssh $HOST_DB "until docker exec hotdata-db pg_isready; do sleep 2; done"

echo "[2/3] ISL 서버 기동 (ISL Engine/Dashboard, RFC/Oracle Agent, Thingworx Provider, 도장 Modbus Agent)"
ssh $HOST_ISL "cd $DEPLOY_PATH && docker compose -f docker-compose.isl.yml up -d"

echo "[3/3] OT-Server-A/B 기동 (MQTT Broker + Agent + 실적판별서비스, zone별 로컬 구성)"
ssh $HOST_SERVER_A "cd $DEPLOY_PATH && docker compose -f docker-compose.server-a.yml up -d"
ssh $HOST_SERVER_B "cd $DEPLOY_PATH && docker compose -f docker-compose.server-b.yml up -d"
```

> **참고:** 이 스크립트는 정상 동작의 필수 조건이 아니라 "최적화"다. 순서가 깨지더라도 5.2.1의 재시도 로직 덕분에 장애로 이어지지 않는다.

### 5.3 향후 검토: Docker Swarm 전환

운영 부담이 커지면 Swarm으로 전환하여, 서비스 이름 기반 디스커버리(예: `hotdata-db:5432`)와 `docker config`를 통한 설정 자동 배포를 활용할 수 있다.

```bash
docker swarm init --advertise-addr 10.x.x.10
docker swarm join --token <TOKEN> 10.x.x.10:2377

docker node update --label-add role=db        ot-db
docker node update --label-add role=isl       ot-isl
docker node update --label-add role=zone-ab   ot-server-a
docker node update --label-add role=zone-cd   ot-server-b
```

---

## 6. CI/CD 파이프라인

### 6.1 모듈별 빌드/배포 트리거 전략

모노레포 + zone별 독립 배포 구조이므로, 변경된 모듈 경로를 감지하여 해당 모듈만 빌드/배포하는 path filter를 적용한다. 트리거 기준이 되는 브랜치/태그 규칙은 「개발환경 가이드」의 Git Flow 가이드를 따른다.

### 6.2 빌드 트리거 규칙

| 변경 경로 | 빌드 대상 |
|---|---|
| src/ot-pipeline-assembly/** | ot-pipeline-assembly만 빌드/배포 |
| src/ot-pipeline-fabrication/** | ot-pipeline-fabrication만 빌드/배포 |
| src/ot-core/** | 의존하는 4개 zone 모듈 전체 재빌드/재배포 |
| src/state-machine-configs/** | 코드 빌드 없이 sync-configs.sh만 실행 (설정 반영 + 재시작) |

### 6.3 모듈별 release 태그 → 배포 대상 매핑

Git Flow 가이드에서 정의한 모듈별 태깅 규칙(예: `ot-pipeline-assembly-v1.2.0`)을 CI에서 파싱하여, 태그 prefix에 해당하는 모듈만 빌드하고 대응 서버(OT-Server-A 또는 B)로 배포한다.

```
태그: ot-pipeline-assembly-v1.2.0
  → 빌드: cd src && ./gradlew :ot-pipeline-assembly:bootJar
  → 이미지 빌드/푸시: ocean/ot-pipeline-assembly:1.2.0
  → 배포 대상: OT-Server-A (docker-compose.server-a.yml)
```

### 6.4 파이프라인 단계 (개략)

1. 변경 경로 감지 (path filter)
2. 대상 모듈만 Gradle 빌드 및 테스트
3. Docker 이미지 빌드 및 레지스트리 푸시
4. 대상 서버(OT-Server-A/B)에 SSH 접속하여 해당 서비스만 이미지 갱신 및 재기동
5. healthcheck-all.sh로 배포 후 상태 확인

---

## 7. 보안 / Secret 관리

DB 자격증명 등 민감 정보는 `.env` 파일에 평문으로 두지 않는 것을 원칙으로 한다.

- 레포에는 `.env.*.example`만 커밋하고, 실 값은 `.gitignore` 처리
- 실 자격증명은 서버에 직접 배치하거나, 별도 secret 관리 도구(예: Vault)로 분리 검토
- Docker Swarm 전환 시에는 `docker secret` 기능으로 대체 가능

> **참고:** 현재 단계에서는 미확정 항목이며, 운영 보안 요건이 정해지는 시점에 구체적인 방안을 확정한다.

---

## 8. 향후 검토 항목

| 항목 | 내용 |
|---|---|
| 포트 분리 규칙 | zone별 actuator/관리 포트 매핑표를 한 곳에 정리하여 충돌 방지 |
| Secret 관리 | DB 자격증명 등 민감정보 관리 방식 확정 (Vault 등) |
| Docker Swarm 전환 가능성 | 운영 부담 증가 시 클러스터화 전환 검토 |
| zone-서버 재배치 | Vision Workstation publish interval 확정 후 실측 부하 기반 재검토 |
| State Machine 핫리로드 | 운영 안정화 후 재시작 없는 설정 반영 방식 검토 |
| 공정 태그 Provider 역할 확정 | OT-Server-A에 위치한 "공정 태그 Provider"의 정확한 기능(의장품 입출고장 Tag 프린터 연계 추정) 확인 필요 |
| OT-Server↔ISL Server 결과 전달 프로토콜/포트 | "실적판별 결과" 전달 방식이 다이어그램상 미확정 — ISL4 표준 인터페이스 확인 필요 |
| 분리된 MQTT Broker 2개의 모니터링/알림 | SPOF 영향 범위가 zone별로 분리되므로, 각 Broker 장애 시 알림 체계를 zone 단위로 구성할지 검토 |

---

## 변경 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| v0.1 | 2026-06-25 | 최초 작성 |
| v0.2 | 2026-06-25 | Docker 이미지 베이스를 JDK 21 기반으로 변경 |
| v0.3 | 2026-06-25 | 실제 물리 배포 다이어그램 기준 전면 갱신 — 물리 서버 4대 확정 구성, MQTT Broker 조립용/의장용 2개 분리, zone-서버 페어링 변경(조립+도장/가공+의장), Vision WS 하드웨어 스펙(HP OMEN 35L, RTX 5070Ti) 반영 |
| v0.4 | 2026-06-28 | 표지 소속 표기를 R&D센터 솔루션개발1팀으로 수정 |
| v0.5 | 2026-06-28 | 「개발환경 구축 및 배포 운영 가이드」 참조 표기를 「개발환경 가이드」로 변경 (제목 변경 반영) |
| v0.6 | 2026-06-28 | 메시지 브로커 용어 정정 — "MQTT Broker"가 정식 명칭이며 NATS는 내부 메시징 구현체로 명확화 |
| v0.7 | 2026-06-28 | MQTT Broker 기술 스택을 NATS → EMQX로 변경 (docker-compose 예시, 포트 체크리스트 갱신) |
| v0.8 | 2026-06-29 | 개발환경가이드의 `src/` 디렉토리 재구조화에 맞춰 CI 경로 필터·빌드 명령 경로 동기화 |

