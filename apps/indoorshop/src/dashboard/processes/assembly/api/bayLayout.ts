import type { Location } from '../../../shared/entities/location/model/types'
import { BAY_WIDTH, BAY_LENGTH } from '../lib/bayConfig'

/*
 * 공장 배치(레이아웃) 데이터 계약 (PRD FR-3).
 *
 * 베이 형상·배치는 뷰어에 하드코딩하지 않고 이 계층이 소유한다. 실제 shop/bay
 * 좌표는 현장 레이아웃 확정 후 여기(또는 실제 API 호출)로 주입하며, 그 전까지는
 * `source: 'mock'` 으로 명확히 표시된 목업 배치를 쓴다 — 운영 데이터로 간주하지 않는다.
 */

/** 베이 하나의 평면 배치 — 좌표계는 공장 바닥 평면(x: 폭, z: 길이 방향), 단위 미터 */
export interface BayLayout {
  bayId: string
  name: string
  workCntr: string
  /** 베이 바닥 중심 [x, z] */
  center: [number, number]
  /** 외곽 크기 [폭(x), 길이(z)] */
  size: [number, number]
  /** 평면 회전(도, 반시계) — 목업은 0 */
  rotationDeg: number
}

export interface FactoryLayout {
  factoryId: string
  /** 'mock': 임의 배치(운영 데이터 아님) / 'surveyed': 현장 확정 좌표 */
  source: 'mock' | 'surveyed'
  bays: BayLayout[]
  /** 열(row) 사이 통로 폭 — 통로 관계가 보이도록 배치에 반영된다 */
  aisleWidth: number
}

/** 한 열에 세우는 최대 베이 수 — 넘으면 통로 건너 다음 열로 */
const BAYS_PER_ROW = 4
/** 같은 열 안 베이 사이 간격(폭 방향) */
const BAY_GAP = 10
/** 열 사이 통로 폭(길이 방향) */
const AISLE_WIDTH = 16

/**
 * 목업 배치 생성 — 베이를 통로를 사이에 둔 열로 세운다 (열당 4면).
 * 결정론적이며 전체가 원점 중심으로 정렬된다. 실측 좌표가 확정되면 이 함수 대신
 * 실제 조회 결과를 `FactoryLayout` 으로 매핑해 내려보낸다.
 */
export function buildMockFactoryLayout(factoryId: string, locations: Location[]): FactoryLayout {
  const rows = Math.max(1, Math.ceil(locations.length / BAYS_PER_ROW))
  const pitchX = BAY_WIDTH + BAY_GAP
  const pitchZ = BAY_LENGTH + AISLE_WIDTH

  const bays = locations.map((location, index): BayLayout => {
    const row = Math.floor(index / BAYS_PER_ROW)
    const col = index % BAYS_PER_ROW
    const colsInRow = row === rows - 1 ? locations.length - row * BAYS_PER_ROW : BAYS_PER_ROW
    const rowWidth = (colsInRow - 1) * pitchX
    return {
      bayId: location.id,
      name: location.name,
      workCntr: location.workCntr,
      center: [col * pitchX - rowWidth / 2, row * pitchZ - ((rows - 1) * pitchZ) / 2],
      size: [BAY_WIDTH, BAY_LENGTH],
      rotationDeg: 0,
    }
  })

  return { factoryId, source: 'mock', bays, aisleWidth: AISLE_WIDTH }
}
