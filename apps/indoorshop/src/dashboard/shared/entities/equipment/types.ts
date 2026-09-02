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
  /** WGS84 위도 */
  lat: number
  /** WGS84 경도 */
  lon: number
  /** 원본 EPSG:5187 easting (X) */
  x: number
  /** 원본 EPSG:5187 northing (Y) */
  y: number
}
