import { RAW_FACILITIES, RAW_FACILITY_PROCESSES } from '../api/facilityFixture'
import { YARD_ORIGIN } from '../api/btsFixture'
import type { LatLon } from '../model/types'
import { boundsOf } from '../model/types'
import {
  facilityContains,
  FACILITY_LABEL_MIN_SCALE,
  FACILITY_SMALL_SECTIONS,
  type FacilityProcess,
  type FacilityProcessKey,
  type YardFacility,
} from '../../../shared/features/yard-map/model/facility'

/**
 * 공장·샵 내비게이션 도메인 — "야드의 어느 공장이 어느 공정 소속인가".
 *
 * 타입 계약(`YardFacility`/`FacilityProcess`)과 순수 판정(`facilityContains`)은
 * `shared/features/yard-map` 이 소유하고, 여기서는 그것을 다시 내보내(re-export) 야드
 * 모듈 안의 기존 참조를 그대로 둔다. 이 파일이 더하는 것은 **옥포 야드의 실제 공정 목록**
 * (`FACILITY_PROCESSES` — 화면 경로 `/zones/...` 를 아는 것은 shared 가 아니라 여기다)과
 * fixture(`facilityFixture`)에서 41개 샵을 편 마스터다.
 *
 * 공정 이름은 번역하지 않는다 — 지번 갈래와 같은 규칙이다. 화면에서 본 말을 현장에서
 * 같은 말로 물어볼 수 있어야 한다.
 */
export {
  facilityContains,
  FACILITY_LABEL_MIN_SCALE,
  FACILITY_SMALL_SECTIONS,
}
export type { FacilityProcess, FacilityProcessKey, YardFacility }

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
