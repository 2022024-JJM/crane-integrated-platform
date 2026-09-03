/*
 * Edge PC · 틸팅모듈 · 캐비닛 상태의 **모의(mock) 생성기** — 실 수집 경로가 붙기 전의 채움.
 *
 * 기법은 도장 `equipmentStatusMock` 과 같다: 설비 ID 해시로 설비마다 안정된 개성을 주고,
 * `now`(epoch ms)를 함께 넣어 값이 시간에 따라 흔들리게 한다. 화면을 다시 열어도 같은
 * 그림이 나오고(결정론), 폴링하면 값이 움직인다.
 *
 * **순수 함수다** — 시계를 직접 읽지 않는다. `now` 는 호출부가 주입한다(테스트·재현 가능).
 *
 * ⚠️ 여기서 만드는 것은 **상태뿐**이다. 대수·좌표·소속·페어는 전부 실데이터(도면 유도)다.
 */
import { EQUIPMENT_PANELS, equipmentOfPanel, pairIdOf, yardEquipmentOf } from './index'
import type { EquipmentPanel, YardEquipment } from './types'
import {
  panelHealthOf,
  type CollectorState,
  type EdgePcStatus,
  type EquipmentPanelStatus,
  type LinkState,
  type TiltMode,
  type TiltModuleStatus,
} from './status'

/** 문자열 → 32bit 정수 해시 (FNV-1a) */
function hashOf(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** 시드에서 0..1 실수 하나 (축끼리 독립적이도록 한 번 더 섞는다) */
function unit(seed: number, salt: number): number {
  const mixed = Math.imul(seed ^ (salt * 0x9e3779b1), 0x85ebca6b) >>> 0
  return mixed / 0xffffffff
}

const round1 = (n: number) => Math.round(n * 10) / 10
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
/** pan 은 회전축이라 범위를 벗어나면 잘라내지 않고 감는다(-180~180) */
const wrapPan = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180

/**
 * 링크 상태 — 대부분 online, 드물게 offline, 더 드물게 error.
 * 조립 맵 진입의 `mockLidarStatus` 와 같은 분포 감각(대부분 정상)을 맞춘다.
 */
function mockLink(seed: number, salt: number): LinkState {
  const u = unit(seed, salt)
  if (u > 0.97) return 'error'
  if (u > 0.92) return 'offline'
  return 'online'
}

const SW_VERSIONS = ['1.4.2', '1.4.3', '1.5.0'] as const

/**
 * Edge PC 한 대의 현재 상태.
 *
 * 자원 지표는 느린 사인(주기 ~3분)으로 흔들려 폴링이 살아 있음을 보여 준다. 링크가
 * 죽은 판은 하트비트가 멈춘 것으로 그린다 — 그래야 신선도 표기가 상태와 어긋나지 않는다.
 */
export function mockEdgePcStatus(equipment: YardEquipment, now: number): EdgePcStatus {
  const seed = hashOf(equipment.id)
  const link = mockLink(seed, 1)
  const phase = unit(seed, 2) * Math.PI * 2
  const wave = Math.sin(now / 180_000 + phase) // ~3분 주기

  // 링크가 끊긴 판은 하트비트가 그만큼 오래 전이다(5~40분 전)
  const staleMinutes = 5 + Math.floor(unit(seed, 3) * 35)
  const lastHeartbeatAt =
    link === 'online'
      ? now - Math.floor(unit(seed, 4) * 9_000)
      : now - staleMinutes * 60_000

  const collector: CollectorState =
    link === 'error' ? 'exited' : link === 'offline' ? 'restarting' : 'running'
  const restarts =
    collector === 'running' ? (unit(seed, 5) > 0.85 ? 1 + Math.floor(unit(seed, 6) * 3) : 0) : 2 + Math.floor(unit(seed, 6) * 6)

  return {
    id: equipment.id,
    link,
    lastHeartbeatAt,
    cpuPercent: round1(Math.min(99, Math.max(3, 22 + unit(seed, 7) * 30 + wave * 9))),
    memoryPercent: round1(Math.min(99, Math.max(8, 38 + unit(seed, 8) * 28 + wave * 5))),
    diskPercent: round1(Math.min(99, 31 + unit(seed, 9) * 52)),
    temperatureC: round1(34 + unit(seed, 10) * 16 + wave * 2.5),
    collector,
    collectorRestarts: restarts,
    mqttConnected: link === 'online' && unit(seed, 11) > 0.04,
    ntpOffsetMs: Math.round((unit(seed, 12) - 0.5) * (link === 'online' ? 60 : 2400)),
    swVersion: SW_VERSIONS[Math.floor(unit(seed, 13) * SW_VERSIONS.length) % SW_VERSIONS.length],
  }
}

/**
 * 틸팅모듈 한 대의 현재 상태.
 *
 * 모드는 대부분 대기다 — 틸팅은 스캔 자세를 잡을 때만 움직인다. 틸팅중일 때만 현재 각이
 * 목표에서 벗어나게 두어(도달 전) `atTarget` 이 뜻을 갖게 한다.
 */
export function mockTiltStatus(equipment: YardEquipment, now: number): TiltModuleStatus {
  const seed = hashOf(equipment.id)
  const link = mockLink(seed, 21)
  const cycle = unit(seed, 22)
  // ~7분 주기로 잠깐(약 12%) 틸팅 구간에 들어간다
  const moving = link === 'online' && ((now / 420_000 + cycle) % 1) < 0.12
  const mode: TiltMode = link === 'error' ? 'error' : moving ? 'tilting' : 'idle'

  const targetPan = wrapPan(Math.round((unit(seed, 23) - 0.5) * 360))
  const targetTilt = Math.round((unit(seed, 24) - 0.5) * 90)
  const drift = moving ? (unit(seed, 25) * 0.6 + 0.2) : 0
  const pan = round1(wrapPan(targetPan - drift * 24))
  const tilt = round1(clamp(targetTilt - drift * 9, -90, 90))

  return {
    id: equipment.id,
    link,
    mode,
    panDeg: pan,
    tiltDeg: tilt,
    targetPanDeg: targetPan,
    targetTiltDeg: targetTilt,
    atTarget: !moving && mode !== 'error',
    pairedLidarId: pairIdOf(equipment),
    motorAlarm: mode === 'error' ? 100 + Math.floor(unit(seed, 26) * 12) : 0,
    lastMovedAt: now - Math.floor(unit(seed, 27) * 3_600_000),
  }
}

/**
 * 설비 한 대의 **링크 상태** — "지금 이 설비에 닿는가" 한 축.
 *
 * 종류마다 상태 계약이 다르지만(Edge PC 는 하트비트, 틸팅은 통신, 판넬은 전원·업링크),
 * 지도 마커·목록 배지·집계가 묻는 것은 늘 이 한 축이다. **이 함수가 그 축의 단일
 * 소스다** — 조립 맵, 의장 설비 목록, 캐비닛 집계가 모두 여기로 묻는다. 화면마다 자기
 * 해시를 굴리면 같은 설비가 두 화면에서 다른 답을 하게 된다.
 *
 * 시각에 의존하지 않는다 — 링크는 설비마다 고정된 개성이고, 시간에 따라 흔들리는 것은
 * 모드·자원 지표 쪽이다. 그래서 `now` 를 받지 않는다(호출부가 시계를 들 필요가 없다).
 *
 * ⚠️ 판넬(`PNL`)의 '링크'는 캐비닛 종합 판정을 접은 값이다 — 정지=offline, 주의=error.
 */
export function equipmentLinkOf(equipment: YardEquipment): LinkState {
  if (equipment.typeId === 'TILT') return mockTiltStatus(equipment, 0).link
  if (equipment.typeId === 'EDGE') return mockEdgePcStatus(equipment, 0).link
  if (equipment.typeId === 'PNL') {
    const panel = EQUIPMENT_PANELS.find((p) => p.id === equipment.id)
    if (!panel) return 'offline'
    const health = mockPanelStatus(panel, 0).health
    return health === 'down' ? 'offline' : health === 'degraded' ? 'error' : 'online'
  }
  return lidarLink(equipment.id)
}

/**
 * 라이다·그 밖의 설비 링크 — 조립·의장 두 화면이 이미 쓰던 규칙 그대로다
 * (대부분 온라인, 29의 배수는 오류, 13의 배수는 오프라인). 두 공정이 같은 라이다에
 * 같은 답을 하도록 규칙을 여기 한 곳에 둔다.
 */
function lidarLink(id: string): LinkState {
  let h = 0
  const text = `${id}-status`
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0
  const abs = Math.abs(h)
  if (abs % 29 === 0) return 'error'
  if (abs % 13 === 0) return 'offline'
  return 'online'
}

/**
 * 캐비닛 한 대의 현재 상태 — 자신의 전원·업링크 + 소속 설비 상태 집계.
 *
 * 전원이 죽은 판의 소속 설비는 **전부 이상으로 센다**. 판넬은 살아 있는데 라이다만
 * 몇 대 죽은 경우와 구분되지 않으면, 화면이 "이 판넬이 죽으면 몇 대"를 말할 수 없다.
 */
/**
 * 캐비닛 집계가 소속 설비에 묻는 링크.
 *
 * `equipmentLinkOf` 를 그대로 쓰지 않고 한 겹 두는 이유는 재귀를 끊기 위해서다 —
 * 판넬의 링크는 판넬 판정이고, 판넬 판정은 소속 설비 링크를 세므로 그대로 부르면
 * 제 꼬리를 문다. 소속 설비에는 캐비닛이 오지 않지만(생성기가 막는다), 규칙으로도 막는다.
 */
function memberLink(equipment: YardEquipment, now: number): LinkState {
  if (equipment.typeId === 'TILT') return mockTiltStatus(equipment, now).link
  if (equipment.typeId === 'EDGE') return mockEdgePcStatus(equipment, now).link
  return lidarLink(equipment.id)
}

export function mockPanelStatus(panel: EquipmentPanel, now: number): EquipmentPanelStatus {
  const seed = hashOf(panel.id)
  const powered = unit(seed, 41) > 0.03
  const uplink = powered ? mockLink(seed, 42) : 'offline'
  const members = equipmentOfPanel(panel.id)

  const faulty =
    powered && uplink !== 'offline'
      ? members.filter((m) => memberLink(m, now) !== 'online').length
      : members.length

  return {
    id: panel.id,
    powered,
    uplink,
    memberTotal: members.length,
    memberOnline: members.length - faulty,
    memberFaulty: faulty,
    lidarPairs: panel.memberCountByType.LIDAR ?? 0,
    health: panelHealthOf({ powered, uplink, memberFaulty: faulty }),
  }
}

/** 설비ID 로 바로 — 종류를 모르는 호출부(마커 상세 등)를 위한 편의 */
export function mockEdgePcStatusById(id: string, now: number): EdgePcStatus | null {
  const e = yardEquipmentOf(id)
  return e && e.typeId === 'EDGE' ? mockEdgePcStatus(e, now) : null
}

/** 설비ID 로 바로 — 페어 라이다에서 틸팅 상태를 물을 때 */
export function mockTiltStatusById(id: string, now: number): TiltModuleStatus | null {
  const e = yardEquipmentOf(id)
  return e && e.typeId === 'TILT' ? mockTiltStatus(e, now) : null
}
