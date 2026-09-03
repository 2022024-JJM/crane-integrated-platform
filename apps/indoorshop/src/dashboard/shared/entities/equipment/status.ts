/*
 * 설비 운전 상태 도메인 — Edge PC · 틸팅모듈 · 캐비닛(패널)이 화면에 낼 상태 계약.
 *
 * ⚠️ **값은 아직 실데이터가 아니다.** 이 세 종류의 상태 수집 경로(Edge PC 하트비트,
 * 틸팅 모터 컨트롤러, 판넬 전원/허브 링크)는 아직 확정되지 않았다 — 그래서 여기서는
 * **타입 계약만** 두고 값은 `statusMock.ts` 가 결정론으로 채운다. 실연동 시 mock 을
 * 실제 조회로 바꾸면 화면은 손대지 않는다(도장 `equipmentStatus.ts` 와 같은 판단).
 *
 * 왜 여기(shared/entities)인가 — 이 설비들은 조립·선행의장 두 권역의 공장에 함께 서고,
 * 소유 데이터도 공용 설비 엔티티다. 공정 모듈 한쪽에 두면 다른 쪽이 읽을 길이 없다
 * (공정 모듈 간 직접 import 금지). 반대로 도장 DH/GH 상태는 Modbus 태그 6종이라는
 * 별개 계약이라 도장 모듈에 그대로 둔다 — **억지로 한 타입으로 합치지 않는다.**
 *
 * ⚠️ RFID(레지스트리 종류 `RFID`)는 폐기된 수집 경로다 — 상태 계약을 만들지 않는다.
 * 데이터에 RFID 개체가 생기더라도 인벤토리(대수·위치) 표시까지가 전부다.
 */

/** 링크/통신 상태 3분류 — 세 종류가 공유하는 낱말 */
export type LinkState = 'online' | 'offline' | 'error'

/* ── Edge PC ─────────────────────────────────────────────────── */

/** 수집 서비스(컨테이너) 상태 — docker 상태 낱말을 그대로 쓴다 */
export type CollectorState = 'running' | 'restarting' | 'exited'

/**
 * Edge PC 한 대의 현재 상태.
 *
 * 이 판이 죽으면 물려 있는 라이다·틸팅이 통째로 눈이 먼다 — 그래서 "살아 있나"
 * (heartbeat·link)와 "왜 못 보내나"(수집 서비스·MQTT·디스크)를 같은 높이로 둔다.
 */
export interface EdgePcStatus {
  /** 설비ID — `YardEquipment.id` (`ED-*`) 와 짝 */
  id: string
  /** 하트비트로 판정한 링크 상태 */
  link: LinkState
  /** 마지막 하트비트 수신 시각 (epoch ms) — 신선도 판정의 근거 */
  lastHeartbeatAt: number
  /** CPU 사용률 (%) */
  cpuPercent: number
  /** 메모리 사용률 (%) */
  memoryPercent: number
  /** 디스크 사용률 (%) — 스캔 적재가 쌓이는 쪽이라 따로 본다 */
  diskPercent: number
  /** 본체 온도 (°C) */
  temperatureC: number
  /** 수집 서비스(컨테이너) 상태 */
  collector: CollectorState
  /** 수집 서비스 재시작 횟수(누적) — 0 이 아니면 그 자체가 신호다 */
  collectorRestarts: number
  /** MQTT Broker 연결 여부 (조립/의장 EMQX) */
  mqttConnected: boolean
  /** NTP 시각 편차 (ms) — 판별 타임스탬프의 신뢰도가 여기 걸린다 */
  ntpOffsetMs: number
  /** 배포된 수집 SW 버전 */
  swVersion: string
}

/* ── 틸팅모듈 ─────────────────────────────────────────────────── */

/** 틸팅 동작 모드 — 대기 / 틸팅중 / 에러 */
export type TiltMode = 'idle' | 'tilting' | 'error'

/**
 * 틸팅모듈 한 대의 현재 상태.
 *
 * 틸팅은 **페어 라이다의 시야를 움직이는 장치**다 — 그래서 이 상태를 라이다와 떼어
 * 읽으면 의미가 반쪽이다. `pairedLidarId` 를 상태에 실어, 화면이 "이 각도로 저 라이다가
 * 지금 어디를 보고 있는가"를 한 줄로 말할 수 있게 한다.
 */
export interface TiltModuleStatus {
  /** 설비ID — `YardEquipment.id` (`PT-*`) 와 짝 */
  id: string
  /** 통신 상태 */
  link: LinkState
  /** 동작 모드 */
  mode: TiltMode
  /** 현재 pan 각 (deg, -180~180) */
  panDeg: number
  /** 현재 tilt 각 (deg, -90~90) */
  tiltDeg: number
  /** 목표 pan 각 (deg) */
  targetPanDeg: number
  /** 목표 tilt 각 (deg) */
  targetTiltDeg: number
  /** 목표 도달 여부 — `mode === 'tilting'` 이면 대개 false */
  atTarget: boolean
  /** 페어 라이다 설비ID (`LD-*`) — 페어가 깨졌으면 null */
  pairedLidarId: string | null
  /** 모터 알람 코드 (0 = 정상) */
  motorAlarm: number
  /** 마지막 동작 시각 (epoch ms) */
  lastMovedAt: number
}

/* ── 캐비닛(패널) ─────────────────────────────────────────────── */

/**
 * 캐비닛 한 대의 현재 상태 + 소속 설비 집계.
 *
 * 판넬 자신의 상태(전원·허브 링크)는 두 값뿐이고, 나머지는 **소속 설비 상태의 집계**다.
 * 이 집계를 화면마다 다시 세지 않도록 상태 계약 안에 넣는다 — "판넬이 죽으면 라이다 몇
 * 쌍"이 여기서 바로 읽힌다.
 */
export interface EquipmentPanelStatus {
  /** 캐비닛 설비ID — `EquipmentPanel.id` 와 짝 */
  id: string
  /** 전원 인가 여부 (AC 220/440) */
  powered: boolean
  /** 업링크(스위치 허브) 링크 상태 */
  uplink: LinkState
  /** 소속 설비 총 대수 */
  memberTotal: number
  /** 소속 설비 중 정상(online) 대수 */
  memberOnline: number
  /** 소속 설비 중 이상(offline/error) 대수 */
  memberFaulty: number
  /** 소속 라이다-틸팅 페어 수 — 영향 범위를 대수 대신 자리 수로 말할 때 */
  lidarPairs: number
  /** 캐비닛 종합 판정 — 전원·업링크가 먼저고, 그 다음이 소속 설비다 */
  health: 'healthy' | 'degraded' | 'down'
}

/**
 * 값의 신선도 — 마지막 수신이 이 시간(ms)을 넘기면 stale.
 * Edge PC 하트비트 주기(10초)의 3배 — 한두 번 건너뛴 것과 끊긴 것을 가른다.
 */
export const EDGE_STALE_AFTER_MS = 30_000

/** 지금 기준 stale 인가 */
export function isEdgeStale(status: EdgePcStatus, now: number): boolean {
  return now - status.lastHeartbeatAt > EDGE_STALE_AFTER_MS
}

/**
 * 캐비닛 종합 판정 규칙 — 한 곳에서만 정한다.
 *
 * 전원이 없거나 업링크가 끊기면 소속 설비 상태를 볼 것도 없이 `down` 이다(그 아래가
 * 전부 눈이 멀었다는 뜻). 나머지는 소속 설비 중 이상이 하나라도 있으면 `degraded`.
 */
export function panelHealthOf(input: {
  powered: boolean
  uplink: LinkState
  memberFaulty: number
}): EquipmentPanelStatus['health'] {
  if (!input.powered || input.uplink === 'offline') return 'down'
  if (input.uplink === 'error' || input.memberFaulty > 0) return 'degraded'
  return 'healthy'
}
