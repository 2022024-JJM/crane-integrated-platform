/*
 * 설비 운전 상태의 **공식 계약(seam)** — 화면과 상태 원천 사이의 유일한 문.
 *
 * 지금까지 화면은 `statusMock` 의 동기 함수(`mockEdgePcStatus(e, now)` …)를 직접 불렀다.
 * 그 형태로는 실연동이 왔을 때 **호출부가 통째로 바뀐다** — 네트워크 조회는 동기가 될 수
 * 없기 때문이다. 그래서 원천 조회를 여기 한 겹 뒤로 밀어 두고, 화면은 이 파일의
 * `fetch*` 만 부른다. 실연동 시 바꾸는 것은 **이 파일의 driver 하나**다.
 *
 * ── 무엇이 비동기가 되고, 무엇이 동기로 남는가 ──
 *
 *   비동기 = **원천 데이터**. Edge PC 자원/하트비트, 틸팅 각·모드, 캐비닛 전원·업링크.
 *            망 너머에서 오는 값이므로 Promise 뒤에 둔다.
 *   동기   = **순수 파생**. `equipmentLinkOf`(설비 → 링크 한 축), `panelHealthOf`(판정 규칙),
 *            페어·소속 계산. 이것들은 값이 아니라 규칙이라 망을 타지 않는다 — 억지로
 *            비동기로 만들면 지도 마커 한 점 그리는 데까지 await 가 번진다.
 *
 * ── 스냅샷이라는 값 ──
 *
 * `fetch*` 는 상태 낱개가 아니라 **한 시각의 스냅샷**을 낸다. 화면 한 장이 캐비닛·Edge PC·
 * 틸팅을 함께 그리는데 종류마다 따로 받아 오면 한 화면 안에서 시각이 갈린다(캐비닛은
 * 10:00:03, 틸팅은 10:00:07 상태). 스냅샷은 `at` 하나를 들고 있으므로 화면이 "이 그림은
 * 언제 것인가"를 한 번만 말하면 된다.
 *
 * ⚠️ 스냅샷은 **요청한 설비만** 담는다. 없는 ID 를 물으면 `null` 이다 — 아직 안 온 것과
 *    없는 것을 지어내 채우지 않는다(화면은 그 사이를 로딩·빈 상태로 말한다).
 */
import {
  EQUIPMENT_PANELS,
  YARD_EQUIPMENT,
  equipmentLinkOf,
  yardEquipmentOf,
} from './index'
import type { YardEquipment } from './types'
import { mockEdgePcStatus, mockPanelStatus, mockTiltStatus } from './statusMock'
import type {
  EdgePcStatus,
  EquipmentPanelStatus,
  LinkState,
  TiltModuleStatus,
} from './status'

/**
 * 한 시각의 설비 상태 스냅샷.
 *
 * 종류마다 계약이 다르므로 한 Map 에 섞지 않고 종류별로 나눈다 — 섞으면 소비부가 매번
 * 좁히기(narrowing)를 해야 하고, 그 좁히기가 화면마다 조금씩 달라진다.
 */
export interface EquipmentStatusSnapshot {
  /** 이 스냅샷의 기준 시각 (epoch ms) — 화면의 "갱신됨" 표기가 여기서 나온다 */
  at: number
  /** 요청에 들어 있던 설비ID 전부 (없는 ID 는 빠진다) */
  ids: readonly string[]
  edgePc: ReadonlyMap<string, EdgePcStatus>
  tilt: ReadonlyMap<string, TiltModuleStatus>
  /** 캐비닛(PNL·EDGE) 판정 — Edge PC 는 자기 상태와 캐비닛 판정을 둘 다 갖는다 */
  panel: ReadonlyMap<string, EquipmentPanelStatus>
  /** 종류 무관 링크 한 축 — 마커·배지가 묻는 것 */
  link: ReadonlyMap<string, LinkState>
}

const EMPTY_MAP = new Map<string, never>()

/** 아직 아무것도 못 받은 스냅샷 — 훅의 초기값. 시각은 0(=받은 적 없음) */
export const EMPTY_EQUIPMENT_STATUS: EquipmentStatusSnapshot = {
  at: 0,
  ids: [],
  edgePc: EMPTY_MAP,
  tilt: EMPTY_MAP,
  panel: EMPTY_MAP,
  link: EMPTY_MAP,
}

/* ── 조회 대상 고르기 ───────────────────────────────────────────
 * 화면은 대개 "이 공장 것 전부"를 묻는다. ID 목록을 화면이 손으로 모으면 공장마다
 * 조금씩 다른 목록이 생기므로 여기서 한 번만 정한다.
 */

/** 한 공장의 설비ID 전부 — 상태를 물을 대상의 기본 단위 */
export function equipmentIdsOfFactory(factory: string): string[] {
  return YARD_EQUIPMENT.filter((e) => e.factory === factory).map((e) => e.id)
}

/* ── mock 드라이버 ──────────────────────────────────────────────
 * 실연동 전까지 스냅샷을 채우는 구현. **기존 `statusMock` 을 그대로 재사용**하므로
 * 값·분포·결정론은 종전과 한 치도 다르지 않다(같은 `now` 면 같은 답).
 */

/* ⚠️ 지연 초기화 — 이 파일은 `index.ts` 가 재수출하는 중에 로드되므로, 모듈 톱레벨에서
 * `EQUIPMENT_PANELS` 를 읽으면 아직 만들어지기 전이다(statusMock 이 index 를 함수 몸 안에서만
 * 부르는 것과 같은 이유). 첫 호출 때 한 번만 색인한다. */
let panelIndex: Map<string, (typeof EQUIPMENT_PANELS)[number]> | null = null
function panelById(): Map<string, (typeof EQUIPMENT_PANELS)[number]> {
  panelIndex ??= new Map(EQUIPMENT_PANELS.map((p) => [p.id, p]))
  return panelIndex
}

/**
 * 스냅샷을 **동기로** 만든다 — mock 드라이버의 알맹이이자 테스트의 입구.
 *
 * 테스트가 이 함수를 직접 쓰는 것은 의도한 것이다: 상태 계산 규칙은 결정론이라 시계도
 * Promise 도 필요 없고, 그걸 굳이 await 로 감싸면 규칙 검증이 비동기 잡음에 묻힌다.
 * 화면은 반대로 이 함수를 부르지 않는다 — 화면의 문은 아래 `fetch*` 다.
 */
export function buildEquipmentStatusSnapshot(
  ids: readonly string[],
  now: number
): EquipmentStatusSnapshot {
  const edgePc = new Map<string, EdgePcStatus>()
  const tilt = new Map<string, TiltModuleStatus>()
  const panel = new Map<string, EquipmentPanelStatus>()
  const link = new Map<string, LinkState>()
  const known: string[] = []

  for (const id of ids) {
    const equipment: YardEquipment | null = yardEquipmentOf(id)
    if (!equipment) continue
    known.push(id)

    if (equipment.typeId === 'EDGE') edgePc.set(id, mockEdgePcStatus(equipment, now))
    if (equipment.typeId === 'TILT') tilt.set(id, mockTiltStatus(equipment, now))
    const cabinet = panelById().get(id)
    if (cabinet) panel.set(id, mockPanelStatus(cabinet, now))
    /* 링크 축은 파생 규칙(`equipmentLinkOf`)이 정본이다 — 여기서 다시 짓지 않는다.
       규칙을 두 번 적으면 지도 마커와 이 스냅샷이 같은 설비에 다른 답을 하게 된다. */
    link.set(id, equipmentLinkOf(equipment))
  }

  return { at: now, ids: known, edgePc, tilt, panel, link }
}

/** 한 공장 전체의 스냅샷을 동기로 — 테스트·mock 드라이버용 */
export function buildFactoryStatusSnapshot(
  factory: string,
  now: number
): EquipmentStatusSnapshot {
  return buildEquipmentStatusSnapshot(equipmentIdsOfFactory(factory), now)
}

/* ── 공식 계약 (화면이 쓰는 것) ──────────────────────────────────
 *
 * ⚠️ **실연동 시 바꾸는 곳은 아래 두 함수의 몸통뿐이다.**
 *    `buildEquipmentStatusSnapshot(...)` 을 실제 조회(Hot Data DB Provider / OT Server
 *    REST)로 갈아끼우고, 응답을 같은 `EquipmentStatusSnapshot` 모양으로 접는다.
 *    호출부(훅·화면·파생 계산)는 손대지 않는다 — 그것이 이 계약을 만든 이유다.
 */

/** 설비 여러 대의 현재 상태 스냅샷. `now` 는 주입받는다(테스트가 시계에 묶이지 않도록) */
export async function fetchEquipmentStatuses(
  ids: readonly string[],
  now: number = Date.now()
): Promise<EquipmentStatusSnapshot> {
  return buildEquipmentStatusSnapshot(ids, now)
}

/** 한 공장 전체 설비의 현재 상태 스냅샷 */
export async function fetchFactoryEquipmentStatuses(
  factory: string,
  now: number = Date.now()
): Promise<EquipmentStatusSnapshot> {
  return buildEquipmentStatusSnapshot(equipmentIdsOfFactory(factory), now)
}

/* ── 스냅샷 읽기 ────────────────────────────────────────────────
 * Map 을 직접 뒤져도 되지만, "없으면 null" 규칙을 호출부마다 다시 쓰지 않도록 접어 둔다.
 */

export function edgePcStatusIn(
  snapshot: EquipmentStatusSnapshot,
  id: string
): EdgePcStatus | null {
  return snapshot.edgePc.get(id) ?? null
}

export function tiltStatusIn(
  snapshot: EquipmentStatusSnapshot,
  id: string
): TiltModuleStatus | null {
  return snapshot.tilt.get(id) ?? null
}

export function panelStatusIn(
  snapshot: EquipmentStatusSnapshot,
  id: string
): EquipmentPanelStatus | null {
  return snapshot.panel.get(id) ?? null
}

/**
 * 스냅샷의 링크 축 — 스냅샷에 없으면 **파생 규칙으로 되짚는다**.
 *
 * 링크는 설비마다 고정된 개성(망 너머 값이 아니라 규칙)이므로, 아직 스냅샷이 안 왔다고
 * 마커를 회색으로 비워 둘 이유가 없다. 반대로 자원·각도 같은 원천 값은 되짚지 않는다.
 */
export function linkIn(snapshot: EquipmentStatusSnapshot, id: string): LinkState | null {
  const known = snapshot.link.get(id)
  if (known) return known
  const equipment = yardEquipmentOf(id)
  return equipment ? equipmentLinkOf(equipment) : null
}
