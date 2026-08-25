import { RAW_FACILITIES, RAW_FACILITY_PROCESSES } from '../api/facilityFixture'
import { YARD_ORIGIN } from '../api/btsFixture'
import type { LatLon, LatLonBounds } from '../model/types'
import { boundsOf } from '../model/types'
import type { MapTheme } from './basemapStyle'

/**
 * 공장·샵 내비게이션 도메인 — "야드의 어느 공장이 어느 공정 소속인가".
 *
 * 지번(`YardLot`)이 야드를 용도로 가른다면, 이쪽은 **공정**으로 가른다. BTS 기준정보
 * 분석(`temp/공장샵_목록.xlsx`)이 41개 샵을 여섯 갈래(조립·도장·의장·가공·전처리·
 * 미지정)로 나눴고, 맵의 샵 내비 모드와 샵 목록이 이 갈래를 색과 묶음으로 쓴다.
 *
 * 공정 이름은 번역하지 않는다 — 지번 갈래와 같은 규칙이다. 화면에서 본 말을 현장에서
 * 같은 말로 물어볼 수 있어야 한다.
 */

/** 이 배율(px/도) 아래에서는 작은 공장(구획 8 미만)의 라벨을 접는다 — 이름끼리 겹쳐 못 읽는다 */
export const FACILITY_LABEL_MIN_SCALE = 45_000
export const FACILITY_SMALL_SECTIONS = 8

export type FacilityProcessKey =
  | 'assembly'
  | 'painting'
  | 'outfitting'
  | 'fabrication'
  | 'pretreatment'
  | 'unassigned'

export interface FacilityProcess {
  key: FacilityProcessKey
  /** BTS 가 부르는 이름 그대로 (조립·도장…) */
  label: string
  /**
   * 이 공정의 화면 경로 — **없는 공정도 있다.** 전처리는 아직 전용 화면이 없고,
   * 미지정은 공정 귀속 자체가 판단되지 않은 샵이다(배관제작·중장비정비 등).
   * 경로가 없는 샵은 눌러도 이동하지 않고 정보 카드만 띄운다 (요청 문서의 규칙).
   */
  zonePath: string | null
  /**
   * 공정색 — 어두운 지도에서는 네온(발광)이라 명도를 올렸고, 밝은 지도에서는
   * 레퍼런스 뷰어의 배색을 그대로 쓴다 (발광 없이 채도로 선다).
   */
  color: Record<MapTheme, string>
}

/* 순서가 곧 목록 순서다 — 과제 대상 4개 공정존이 앞에, 화면 없는 갈래가 뒤에 선다 */
export const FACILITY_PROCESSES: readonly FacilityProcess[] = [
  {
    key: 'assembly',
    label: '조립',
    zonePath: '/zones/assembly',
    color: { dark: '#4da3ff', light: '#2a78d6' },
  },
  {
    key: 'painting',
    label: '도장',
    zonePath: '/zones/painting',
    color: { dark: '#f783ac', light: '#e87ba4' },
  },
  {
    key: 'outfitting',
    label: '의장',
    zonePath: '/zones/outfitting',
    color: { dark: '#ff8a5c', light: '#eb6834' },
  },
  {
    key: 'fabrication',
    label: '가공',
    zonePath: '/zones/fabrication',
    color: { dark: '#2dd4a7', light: '#1baf7a' },
  },
  {
    key: 'pretreatment',
    label: '전처리',
    zonePath: null,
    color: { dark: '#69db7c', light: '#008300' },
  },
  {
    key: 'unassigned',
    label: '미지정',
    zonePath: null,
    color: { dark: '#8b95a1', light: '#9a9890' },
  },
]

export interface YardFacility {
  /** 이름이 곧 식별자다 — BTS 기준정보에 샵 코드가 따로 없다 */
  name: string
  process: FacilityProcess
  /** 본체 구획 수 (옥내 BAY·라인만 — 셀터·적치장·검사장 제외) */
  sections: number
  /** 관할 지번 수 (셀터·적치장까지 포함한 전체) */
  lotCount: number
  /** BAY 목록 — 연속 구간을 접은 표기 (`1–8`). 없는 샵은 빈 문자열 */
  bays: string
  /** 라벨을 놓을 자리 (본체 무게중심) */
  anchor: LatLon
  /** 본체 외곽 — 볼록 껍질, 닫는 점 없음 */
  hull: LatLon[]
  bounds: LatLonBounds
}

const lat = (v: number) => YARD_ORIGIN.lat + v / 1e6
const lon = (v: number) => YARD_ORIGIN.lon + v / 1e6

/* 미지정(-1)도 마지막 갈래로 흡수한다 — 라벨 배열에는 없지만 갈래로는 존재한다 */
const processOf = (index: number): FacilityProcess => {
  if (index < 0) return FACILITY_PROCESSES[FACILITY_PROCESSES.length - 1]
  const label = RAW_FACILITY_PROCESSES[index]
  return FACILITY_PROCESSES.find((p) => p.label === label) ?? FACILITY_PROCESSES[5]
}

const facilities: YardFacility[] = RAW_FACILITIES.map((row) => {
  const [name, processIndex, sections, lotCount, bays, anchorLat, anchorLon, packed] = row
  const hull: LatLon[] = []
  for (let i = 0; i < packed.length; i += 2) {
    hull.push({ lat: lat(packed[i]), lon: lon(packed[i + 1]) })
  }
  return {
    name,
    process: processOf(processIndex),
    sections,
    lotCount,
    bays,
    anchor: { lat: lat(anchorLat), lon: lon(anchorLon) },
    hull,
    bounds: boundsOf(hull),
  }
})

const byName = new Map(facilities.map((facility) => [facility.name, facility]))

export function fetchYardFacilities(): YardFacility[] {
  return facilities
}

export function findFacility(name: string | null | undefined): YardFacility | null {
  return name ? (byName.get(name) ?? null) : null
}

/** 공정 페이지가 연결된 샵 수 — 요약 줄이 쓴다 */
export function routedFacilityCount(): number {
  return facilities.filter((facility) => facility.process.zonePath !== null).length
}

/**
 * BAY 압축 표기(`1–8`, `1, 2, 13–16`)를 개별 번호로 편다.
 *
 * BAY 는 아직 이름뿐이다 — 지번처럼 구획 좌표가 있는 것이 아니라 기준정보의 번호
 * 목록이라, 맵 위 도형이 아니라 **고르는 칩**으로만 선다. 좌표가 확보되면 그때
 * 도형이 된다.
 */
export function facilityBayNumbers(facility: YardFacility): number[] {
  if (!facility.bays) return []
  const numbers: number[] = []
  for (const part of facility.bays.split(',')) {
    const match = part.trim().match(/^(\d+)(?:–(\d+))?$/)
    if (!match) continue
    const from = Number(match[1])
    const to = match[2] ? Number(match[2]) : from
    for (let n = from; n <= to; n++) numbers.push(n)
  }
  return numbers
}

/**
 * 외곽 안에 점이 있는가 — 짝홀(ray casting) 판정.
 * 공장 외곽은 꼭짓점이 5~10개라 지번의 볼록 사각형 판정(`quadContains`)을 못 쓴다.
 */
export function facilityContains(facility: YardFacility, latitude: number, longitude: number): boolean {
  const { hull } = facility
  let inside = false
  for (let i = 0, j = hull.length - 1; i < hull.length; j = i++) {
    const a = hull[i]
    const b = hull[j]
    if (
      a.lat > latitude !== b.lat > latitude &&
      longitude < ((b.lon - a.lon) * (latitude - a.lat)) / (b.lat - a.lat) + a.lon
    ) {
      inside = !inside
    }
  }
  return inside
}
