/**
 * BTS(블록운반시스템) 야드 도메인.
 *
 * 용어는 옥포 레거시(APNB_블록운반시스템) 기준이다:
 *  - 지번(LANDNO / LOT): 야드를 나눈 최소 구획. 적치장·조립검사장처럼 **용도**를 갖는다.
 *  - 운송대상ID(TPT_TRSP_OBJT_ID): 트랜스포터가 옮기는 대상 하나. `{호선}_{블록}[_{계열}]`.
 *
 * 좌표는 **WGS84 위경도**다. 원본 테이블은 EPSG:5187(중부원점) 절대좌표를 쓰지만,
 * 베이스맵(OSM)과 겹쳐 그리려면 같은 좌표계여야 한다.
 */

export interface LatLon {
  lat: number
  lon: number
}

export interface LatLonBounds {
  minLat: number
  minLon: number
  maxLat: number
  maxLon: number
}

export interface YardLot {
  /** 지번코드 (LOT, 예: `GB1S07`) */
  lot: string
  /** 설명 (DESCRIPTION) */
  description: string
  /**
   * 성격 — 용도 20여 종을 일곱 갈래로 묶은 것.
   * 색이 뜻하는 단위이며, 정확한 용도는 `useType` 에 남는다.
   */
  category: string
  /** 용도 (USETYPE, 예: 적치장·조립검사장·PE장) */
  useType: string | null
  /** 재공 구분 (WIP: 재고 / 재공) */
  wip: string | null
  /** 옥내 / 옥외 (WORKPLACETYPE) */
  place: string | null
  /** 면적 (m², AREA) */
  area: number
  /** 묶음 이름 (예: 'GBS 남쪽 조립검사') — 없는 지번이 더 많다 */
  group: string | null
  /** 실제 구획 모양 — 안벽 방향을 따라 돌아간 사각형의 꼭짓점 4개 */
  quad: LatLon[]
  /** 라벨을 놓을 자리 (꼭짓점 평균) */
  center: LatLon
  /** 화면 밖 판정을 빠르게 하기 위한 경계 상자 */
  bounds: LatLonBounds
}

export interface YardBlock {
  /** 운송대상ID (TPT_TRSP_OBJT_ID) */
  id: string
  /** 호선번호 */
  projNo: string
  /** 블록번호 */
  blkNo: string
  /** 계열 접미(있을 때만 — 예: `H4`, `SF1`) */
  suffix: string | null
  lat: number
  lon: number
  /** 실적지번 (ACTL_LANDNO) — 마스터에 없는 지번일 수 있다 */
  lot: string | null
  /** 최종 수정 (MNT_DATE + MNT_TIME) — 위치가 마지막으로 갱신된 시점 */
  updatedAt: string | null
  /** 갱신을 남긴 프로그램 (PGM_ID) */
  source: string | null
}

/**
 * 운송대상ID 분해 — `2520_801_SF1` → 호선 2520 / 블록 801 / 계열 SF1.
 * 접미가 없는 `5499_735` 형태가 대부분이다.
 */
export function parseTransportObjectId(id: string): {
  projNo: string
  blkNo: string
  suffix: string | null
} {
  const [projNo = id, blkNo = '', ...rest] = id.split('_')
  return { projNo, blkNo, suffix: rest.length > 0 ? rest.join('_') : null }
}

/** `YYYYMMDD` + `HHMMSS` → `MM-DD HH:MM` (초는 목록에서 읽히지 않는다) */
export function formatUpdatedAt(value: string | null): string | null {
  if (!value) return null
  if (value.length < 12) return `${value.slice(4, 6)}-${value.slice(6, 8)}`
  return `${value.slice(4, 6)}-${value.slice(6, 8)} ${value.slice(8, 10)}:${value.slice(10, 12)}`
}

export function boundsOf(points: LatLon[]): LatLonBounds {
  let minLat = Infinity
  let minLon = Infinity
  let maxLat = -Infinity
  let maxLon = -Infinity
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lon < minLon) minLon = p.lon
    if (p.lon > maxLon) maxLon = p.lon
  }
  return { minLat, minLon, maxLat, maxLon }
}

export function mergeBounds(a: LatLonBounds, b: LatLonBounds): LatLonBounds {
  return {
    minLat: Math.min(a.minLat, b.minLat),
    minLon: Math.min(a.minLon, b.minLon),
    maxLat: Math.max(a.maxLat, b.maxLat),
    maxLon: Math.max(a.maxLon, b.maxLon),
  }
}

/**
 * 볼록 사각형 안에 점이 있는가 — 외적 부호가 모두 같으면 안이다.
 * 지번은 회전 사각형이라 경계 상자로 판정하면 옆 지번을 집는다.
 */
export function quadContains(quad: LatLon[], lat: number, lon: number): boolean {
  let positive = false
  let negative = false
  for (let i = 0; i < quad.length; i++) {
    const a = quad[i]
    const b = quad[(i + 1) % quad.length]
    const cross = (b.lon - a.lon) * (lat - a.lat) - (b.lat - a.lat) * (lon - a.lon)
    if (cross > 0) positive = true
    else if (cross < 0) negative = true
    if (positive && negative) return false
  }
  return true
}

/**
 * 하루치 블록 이동 실적 — 트랜스포터가 블록을 지번 A 에서 지번 B 로 옮긴 한 건.
 *
 * 블록 위치(`YardBlock`)가 "지금 어디에 있는가"를 말한다면, 이동은 **"어떻게 거기까지
 * 왔는가"**를 말한다. 야드가 막히는 자리는 지번이 아니라 경로에서 드러난다.
 */
export interface YardMove {
  /** 이동일 (YYYYMMDD) */
  date: string
  /** 출발 지번 */
  from: string
  /** 도착 지번 */
  to: string
  /** 작업반 (WEG) */
  crew: string | null
  /** 트랜스포터 호기 (TP) */
  transporter: string | null
  /** 완료 시각 (HHMM — 야드는 26:30 처럼 24시를 넘겨 적는다) */
  time: string | null
  /** 야드 도로를 따라간 경로인가 — 아니면 도로 미매핑 구간을 직선으로 이은 근사다 */
  onRoad: boolean
  /** 이동 거리 (m) */
  length: number
  /** 경로 꼭짓점 */
  path: LatLon[]
  bounds: LatLonBounds
}

/** 블록별 배정 계획 — "이 블록을 몇 시에 어느 지번으로 넣기로 했는가" */
export interface YardPlan {
  date: string
  /** 운송대상ID */
  blockId: string
  /** 직전 위치 지번 (알려진 경우) */
  from: string | null
  /** 배정 지번 */
  to: string
  /** 시작·종료 시각 (HHMM) */
  startTime: string | null
  endTime: string | null
  crew: string | null
  transporter: string | null
  /** 배정 지번의 자리 — 마스터에 없는 지번이면 없다 */
  at: LatLon | null
  /** 계획 체인이 그려진 경우의 경로 (대부분 비어 있다) */
  path: LatLon[]
}

/**
 * `HHMM` → `HH:MM`. 야드 시각은 24시를 넘겨 적는다 — `2630` 은 다음 날 새벽 2시 30분이며,
 * 이것을 `02:30` 으로 고쳐 쓰면 **어느 날 작업인지가 사라진다**. 그래서 그대로 둔다.
 */
export function formatYardTime(value: string | null): string | null {
  if (!value) return null
  const padded = value.padStart(4, '0')
  return `${padded.slice(0, padded.length - 2)}:${padded.slice(-2)}`
}

/** `YYYYMMDD` → `YYYY-MM-DD` */
export function formatYardDate(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
}
