/**
 * 야드 설비 — 단일 소스 데이터 계약.
 *
 * painting 원본(equipment.js 503대 + equipment-types.js 종류 레지스트리)을
 * `scripts/build-equipment-fixture.mjs` 가 변환해 만든 fixture 를 이 타입으로 편다.
 * 도장 SCADA(제습기·가스히터)가 첫 소비자이고, LiDAR·틸팅 등 조립 확장도 같은 데이터를
 * 쓰게 될 것이라 소유 지점을 shared 로 모은다. (shared 는 공정 모듈을 import 하지 않는다 —
 * 여기서 공장·베이·종류는 문자열 데이터일 뿐 특정 공정 모듈에 대한 의존이 아니다.)
 */

/** 설비 종류 하나 — 원본 equipment-types.js 레지스트리 한 줄 */
export interface YardEquipmentType {
  /** 종류ID (DH/GH/PLC/HUB/LIDAR/VCAM/RFID/TILT/CONV/EDGE/PNL) */
  id: string
  /** 사람이 읽는 이름 (제습기/가스히터/라이다/…) */
  name: string
  /** 픽토그램 이름 (vent/flame/plc/hub/lidar/cam/rfid/tilt/server/panel/gear/box) */
  symbol: string
  /** 표시색 (hex) */
  color: string
  /** 비고 (소속 공정·기종 메모) */
  note: string
}

/**
 * 야드 설비 한 대.
 *
 * `lat`/`lon` 은 야드 맵과 같은 WGS84 프레임(EPSG:5187 → 변환), `x`/`y` 는 변환 전
 * 원본 EPSG:5187 좌표(재변환·검증용).
 *
 * ⚠️ `bay` 는 **공장 안에서만 유일**하다(PBS 의 '4'와 GPS 의 '4'는 다른 곳) — 베이
 * 소속은 반드시 (factory, bay) 복합키로 다루고, bay 단독 색인을 만들지 않는다.
 * 지도 베이와 이으려면 `yard-parcels` 의 `YardParcelBay.id`(`{공장}#{베이}`)와 같은
 * 규칙의 키를 쓴다.
 */
export interface YardEquipment {
  /** 설비 ID (EQ001·LD-P01·PT-D06·PNL-1 …) — 전역 유일 */
  id: string
  /** 종류ID — `YardEquipmentType.id` */
  typeId: string
  /** 소속 공장 이름 (yard-parcels 공장 이름과 동일 체계) */
  factory: string
  /** 소속 베이 이름 — 공장 내 유일. 빈 문자열 = 미지정/옥외 */
  bay: string
  /**
   * 이 설비가 물린 **캐비닛의 설비ID** (`PNL-*` Network Panel 또는 `ED-*` Edge PC).
   * 빈 문자열 = 캐비닛에 물리지 않음 — 캐비닛 자신과 도장 설비(EQ*)가 그렇다.
   *
   * ⚠️ 캐비닛과 소속 설비의 **베이는 다를 수 있다** — 캐비닛 한 대가 여러 베이의 설비를
   * 담당하는 것이 정상 배치다. 같은 것은 공장뿐이다(생성기가 강제한다).
   */
  panelId: string
  /** WGS84 위도 */
  lat: number
  /** WGS84 경도 */
  lon: number
  /** 원본 EPSG:5187 easting (X) */
  x: number
  /** 원본 EPSG:5187 northing (Y) */
  y: number
}

/**
 * 캐비닛(패널) 한 대 — Network Panel(`PNL-*`) 또는 Edge PC(`ED-*`).
 *
 * 원본에 별도 표가 있는 것이 아니라 설비 목록의 `panelId` 참조를 뒤집어 만든 **파생
 * 엔티티**다. 캐비닛을 일급으로 두는 이유는 하나다 — "이 판넬이 죽으면 라이다 몇 대가
 * 같이 죽는가"를 화면이 매번 다시 세지 않게 하려고. 그 집계가 `memberIds`/`memberCountByType`.
 *
 * ⚠️ `bay` 는 **캐비닛 자신이 선 베이**이지 담당 범위가 아니다 — 담당 베이는 `memberBays`.
 */
export interface EquipmentPanel {
  /** 캐비닛 설비ID (`PNL-D1`·`ED-F11` …) — `YardEquipment.id` 와 같은 값 */
  id: string
  /** 캐비닛 종류 — 두 갈래뿐이다 */
  kind: 'network-panel' | 'edge-pc'
  /** 종류ID (`PNL` | `EDGE`) — 심볼·색을 레지스트리에서 찾을 때 쓴다 */
  typeId: string
  /** 소속 공장 — 소속 설비와 항상 같다 */
  factory: string
  /** 캐비닛이 선 베이 (담당 범위가 아니다) */
  bay: string
  /** WGS84 위도 */
  lat: number
  /** WGS84 경도 */
  lon: number
  /** 이 캐비닛에 물린 설비ID — 원본 순서 그대로 */
  memberIds: readonly string[]
  /** 소속 설비의 종류별 대수 (`{ LIDAR: 9, TILT: 9 }`) — 영향 범위 문구의 근거 */
  memberCountByType: Readonly<Record<string, number>>
  /** 소속 설비가 걸친 베이 이름들(정렬) — 캐비닛 자신의 베이와 다를 수 있다 */
  memberBays: readonly string[]
}
