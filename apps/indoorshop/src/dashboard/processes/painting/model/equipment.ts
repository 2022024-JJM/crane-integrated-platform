/*
 * 선행도장 설비 도메인 타입.
 *
 * 도장존은 공장마다 습도·온도를 잡는 제습기·가스히터를 두고, 이 설비들의 가동
 * 상태로 실적을 읽는다. 지금은 위치·배치 정보만 다룬다 — 실측 상태값(가동/정지·
 * 온습도)은 아직 데이터가 없어 화면(B2)이 mock 으로 채운다. 여기서는 데이터 계층이
 * 다루는 필드만 정의한다.
 */

/**
 * 도장 설비 종류 — 공용 설비 레지스트리(`shared/entities/equipment`)의 종류ID DH/GH 에
 * 대응하는 **이름**이다. SCADA 화면·mock 이 이 문자열을 키로 쓰므로 유지한다.
 */
export const PAINTING_EQUIPMENT_KINDS = ['제습기', '가스히터'] as const
export type PaintingEquipmentKind = (typeof PAINTING_EQUIPMENT_KINDS)[number]

/**
 * 도장 설비 한 대.
 *
 * `lat`/`lon` 은 야드 맵과 같은 WGS84 프레임(EPSG:5187 → 변환)이라 지번·공장 도형과
 * 바로 겹쳐 그릴 수 있다. `x`/`y` 는 변환 전 원본 EPSG:5187 좌표로, 재변환·검증용으로
 * 남겨 둔다.
 */
export interface PaintingEquipment {
  /** 설비 ID (예: EQ001) */
  id: string
  /** 설비 종류 */
  kind: PaintingEquipmentKind
  /** 소속 도장공장 이름 (야드 공장 fixture 의 이름과 동일) */
  factory: string
  /**
   * 소속 베이 이름 (예: `B21`, `NP6`) — ⚠️ **공장 안에서만 유일**하다. 지도 베이와
   * 이으려면 `{factory}#{bay}` 복합키(`YardParcelBay.id` 와 같은 규칙)를 쓴다.
   */
  bay: string
  /** WGS84 위도 */
  lat: number
  /** WGS84 경도 */
  lon: number
  /** 원본 EPSG:5187 easting (X) */
  x: number
  /** 원본 EPSG:5187 northing (Y) */
  y: number
}

/** 공장별 설비 집계 — 배치 요약·필터 칩에서 쓴다 */
export interface FactoryEquipmentSummary {
  factory: string
  total: number
  /** 종류별 대수 */
  byKind: Record<PaintingEquipmentKind, number>
}
