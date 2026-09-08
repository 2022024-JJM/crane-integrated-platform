/**
 * 베이(bay) mock 좌표계 규약 — 백엔드 프로토콜 미확정으로 프론트에서 임의 정의.
 *  - 원점: 베이 바닥(정반) 중심
 *  - +Y: 위쪽(높이), +X: 폭 방향(30m), +Z: 길이 방향(50m)
 *  - 단위: 미터
 */
export const BAY_WIDTH = 30 // X
export const BAY_HEIGHT = 20 // Y
export const BAY_LENGTH = 70 // Z

/** 라이다 센서 기둥 높이 */
export const SENSOR_POLE_HEIGHT = 15

/** 핀지그 높이 — 블록/조립품은 정반 바닥이 아니라 지그 위에 안착된다 */
export const JIG_HEIGHT = 1.2

/** 시야각(수평/수직 동일 75°), 감지거리 */
export const SENSOR_FOV_DEG = 75
export const SENSOR_MAX_RANGE = 50

/** registered PCD에서 센서별 point를 구분하기 위한 색상 (센서 인덱스 순, 최대 12대) */
export const SENSOR_POINT_COLORS = [
  '#f59e0b', // amber
  '#38bdf8', // sky
  '#4ade80', // green
  '#f472b6', // pink
  '#a78bfa', // violet
  '#f87171', // red
  '#2dd4bf', // teal
  '#f97316', // orange
  '#c084fc', // purple
  '#facc15', // yellow
  '#34d399', // emerald
  '#60a5fa', // blue
]
