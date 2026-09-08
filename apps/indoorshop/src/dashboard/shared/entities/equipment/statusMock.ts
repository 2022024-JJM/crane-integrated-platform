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
import { EQUIPMENT_PANELS, YARD_EQUIPMENT, equipmentOfPanel, pairIdOf, yardEquipmentOf } from './index'
import { factorySlugOf } from '../../lib/factorySlugs'
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

/* ── 아픈 설비는 드물다 (R27) ────────────────────────────────────
 *
 * 예전에는 설비마다 주사위를 굴렸다 — 8~12% 확률로 offline/error. 841대에 굴리면
 * 100대 가까이가 아프고, 화면은 **맨날 아픈 공장**이 된다(의장 31/290). 현장의 설비는
 * 그렇게 아프지 않다: 대부분의 날에 문제는 손에 꼽고, 그 몇 건이 눈에 띄어야 한다.
 *
 * 그래서 확률을 낮추는 대신 **명단을 짠다.** 확률을 낮추면 몇 대가 아플지는 해시 운에
 * 달리고(공정 하나가 통째로 멀쩡해질 수도 있다), 시연에서 알람 레일·이상 정렬을 보여 줄
 * 이야기가 사라진다. 명단은 그 둘을 함께 지킨다 — 총량이 정확하고, 공정마다 최소 한 건이
 * 남는다. 뽑는 방법은 여전히 결정론(설비 ID 해시 순)이라 화면을 다시 열어도 같은 설비다.
 *
 * 정상 = 전체의 99% 이상. 알람 건수·요약 스트립·공장 뱃지는 여기서 파생되므로 함께 내려간다.
 */

/** 계획된 이상 — 없으면 정상이다 */
export type PlannedIssue = 'error' | 'offline'

/** 공정 한 곳의 몫 — 이야기가 서는 최소 단위(오류 한 건 + 통신 끊김 한두 건) */
interface IssueQuota {
  error: number
  offline: number
}

/**
 * 공정별 배정.
 *
 * 조립이 하나 더 많은 것은 설비가 그만큼 많아서다(337대의 라이다가 조립·의장에 걸쳐 있다).
 * 합계는 오류 3 · 통신 끊김 4 — 전체 841대의 0.8%다.
 * 가공(CAS·PAS)은 조립 화면에 서므로 조립 몫에 함께 든다.
 */
const ISSUE_QUOTA: Record<string, IssueQuota> = {
  asm: { error: 1, offline: 2 },
  ofit: { error: 1, offline: 1 },
  pnt: { error: 1, offline: 1 },
}

/** 공장 → 공정 키. 슬러그 앞자리가 곧 공정이다(`shared/lib/factorySlugs`) */
function zoneKeyOf(factory: string): string {
  const slug = factorySlugOf(factory) ?? ''
  const head = slug.split('-')[0]
  /* 가공 설비(CAS·PAS)는 조립 화면에 서므로 조립과 한 몫으로 센다 */
  return head === 'fab' ? 'asm' : head
}

/** 명단을 한 번만 짓는다 — 설비 목록은 고정 데이터라 결과도 고정이다 */
function buildIssuePlan(): ReadonlyMap<string, PlannedIssue> {
  const byZone = new Map<string, YardEquipment[]>()
  for (const equipment of YARD_EQUIPMENT) {
    const zone = zoneKeyOf(equipment.factory)
    if (!ISSUE_QUOTA[zone]) continue
    const bucket = byZone.get(zone)
    if (bucket) bucket.push(equipment)
    else byZone.set(zone, [equipment])
  }

  const plan = new Map<string, PlannedIssue>()
  for (const [zone, candidates] of byZone) {
    const quota = ISSUE_QUOTA[zone]
    /* 해시 순 — 이름 순이면 늘 앞 번호만 아프고, 무작위면 새로 고칠 때마다 달라진다 */
    const ordered = [...candidates].sort(
      (a, b) => hashOf(`${a.id}#issue`) - hashOf(`${b.id}#issue`) || a.id.localeCompare(b.id)
    )
    ordered.slice(0, quota.error).forEach((e) => plan.set(e.id, 'error'))
    ordered
      .slice(quota.error, quota.error + quota.offline)
      .forEach((e) => plan.set(e.id, 'offline'))
  }
  return plan
}

let issuePlan: ReadonlyMap<string, PlannedIssue> | null = null

/**
 * 이 설비가 오늘 아픈가 — 아니면 `null`(정상).
 *
 * 상태를 만드는 모든 자리가 이 한 곳에 묻는다: 라이다·틸팅·Edge PC·캐비닛은 물론
 * 도장 SCADA(제습기·가스히터)의 통신·고장까지. 두 곳에서 각자 주사위를 굴리면 "전체
 * 이상 몇 대"라는 약속이 지켜지지 않는다.
 */
export function plannedIssueOf(id: string): PlannedIssue | null {
  issuePlan ??= buildIssuePlan()
  return issuePlan.get(id) ?? null
}

/** 명단 전체 — 계약 테스트와 진단용 */
export function plannedIssues(): ReadonlyMap<string, PlannedIssue> {
  issuePlan ??= buildIssuePlan()
  return issuePlan
}

/** 링크 상태 — 명단에 없으면 정상이다 */
function plannedLink(id: string): LinkState {
  return plannedIssueOf(id) ?? 'online'
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
  const link = plannedLink(equipment.id)
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
  const link = plannedLink(equipment.id)
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
 * ⚠️ 판넬(`PNL`)의 '링크'는 **그 판 자신에 닿는가**만 본다 — 소속 설비가 아픈 것은
 *    그 설비 쪽에서 이미 세었으므로, 여기서 또 세면 한 사실이 두 대로 불어난다(R27).
 *    "이 판 아래 몇 대가 이상"은 캐비닛 상세(`memberFaulty`·`health`)가 말한다.
 */
export function equipmentLinkOf(equipment: YardEquipment): LinkState {
  if (equipment.typeId === 'TILT') return mockTiltStatus(equipment, 0).link
  if (equipment.typeId === 'EDGE') return mockEdgePcStatus(equipment, 0).link
  if (equipment.typeId === 'PNL') {
    const panel = EQUIPMENT_PANELS.find((p) => p.id === equipment.id)
    if (!panel) return 'offline'
    const status = mockPanelStatus(panel, 0)
    if (!status.powered || status.uplink === 'offline') return 'offline'
    return status.uplink === 'error' ? 'error' : 'online'
  }
  return lidarLink(equipment.id)
}

/**
 * 라이다·그 밖의 설비 링크.
 *
 * 예전에는 여기서 제 규칙(29의 배수는 오류, 13의 배수는 오프라인)을 굴렸다 — 337대의
 * 라이다에 그 규칙을 굴리면 40대 가까이가 아프다. 지금은 명단 한 곳에 묻는다(R27).
 */
function lidarLink(id: string): LinkState {
  return plannedLink(id)
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
  /* 캐비닛도 명단을 따른다 — 전원이 죽는 것은 그 판이 오늘의 오류로 뽑혔을 때뿐이다 */
  const issue = plannedIssueOf(panel.id)
  const powered = issue !== 'error'
  const uplink = powered ? plannedLink(panel.id) : 'offline'
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
