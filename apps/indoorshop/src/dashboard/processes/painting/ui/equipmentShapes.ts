import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/*
 * 도장 설비의 **저폴리 형상** — 종류를 실루엣으로 구별한다 (R38).
 *
 * 지금까지 히터와 제습기는 같은 구(球) 마커였다. 색만 다른 점 두 개가 서 있으면 화면은
 * "여기 뭔가 있다"까지만 말하고, 무엇이 있는지는 범례를 봐야 안다. 도장 관제에서 알아야
 * 하는 첫 번째가 그것인데(어느 베이에 무엇이 몇 대) 형상이 그 말을 못 한 것이다.
 *
 * 그래서 종류마다 **알아볼 수 있는 최소한의 형상**을 만든다:
 *  · 가스히터 — 낮고 넓은 몸통 + 앞으로 튀어나온 원통 토출구 + 짧은 연도(煙道)
 *  · 제습기   — 좁고 높은 캐비닛 + 위로 올라 앞으로 꺾이는 덕트
 * 그 이상은 만들지 않는다 — 고폴리 모델은 성능 계약(draw call·정점 수)을 먹고, 이 화면이
 * 답해야 하는 질문("무엇이 몇 대, 어디에, 도는가")에 아무것도 보태지 않는다.
 *
 * **부품은 하나로 합쳐 낸다**(`mergeGeometries`). 설비 한 대가 메시 세 개면 86대에
 * 258개가 되고, 그 순간 draw call 계약이 무너진다. 합친 지오메트리 하나를 종류마다
 * InstancedMesh 로 세우면 대수와 무관하게 **종류당 1콜**이다.
 *
 * 좌표 규약: 바닥이 y=0, 정면(토출구·덕트가 나가는 쪽)이 +z. 자리 규칙(`lib/bayStations`)의
 * yaw 가 그 정면을 베이 안쪽으로 돌린다.
 */

/**
 * 형상 배율 — **심볼의 크기이지 실치수가 아니다.**
 *
 * 실제 히터는 2m 남짓인데 도장 베이는 한 면이 56m다. 실치수로 세우면 공장 한 화면에서
 * 설비는 1px 티끌이 되어, 형상을 만든 뜻이 사라진다(지도 기호가 실축척을 따르지 않는
 * 것과 같은 이유). 배율은 여기 한 곳에만 있고, 화면 어디에서도 이 형상으로 치수를
 * 재라고 말하지 않는다.
 */
export const EQUIPMENT_SYMBOL_SCALE = 2.4

/** 원통 분할 수 — 8이면 실루엣이 원통으로 읽힌다. 그 이상은 정점만 늘린다 */
const RADIAL = 8

function put(geometry: THREE.BufferGeometry, x: number, y: number, z: number): THREE.BufferGeometry {
  geometry.translate(x, y, z)
  return geometry
}

/**
 * 가스히터 — 낮고 넓은 몸통, 앞면 원통 토출구, 몸통 뒤 짧은 연도.
 * 실루엣의 요점은 **가로로 눕고 앞으로 뚫려 있다**는 것이다.
 */
export function heaterGeometry(): THREE.BufferGeometry {
  const body = put(new THREE.BoxGeometry(2.2, 1.5, 1.1), 0, 0.75, 0)
  /* 토출구 — 원통을 눕혀 정면(+z)으로 내민다 */
  const outlet = new THREE.CylinderGeometry(0.5, 0.5, 0.9, RADIAL)
  outlet.rotateX(Math.PI / 2)
  put(outlet, 0, 0.8, 0.95)
  /* 연도 — 몸통 뒤쪽 어깨에서 위로. 히터를 위에서 봐도 알아보게 하는 한 획 */
  const stack = put(new THREE.CylinderGeometry(0.16, 0.16, 1.3, RADIAL), -0.75, 2.1, -0.3)
  return mergeGeometries([body, outlet, stack], false) ?? body
}

/**
 * 제습기 — 좁고 높은 캐비닛에 덕트가 위로 올라 앞으로 꺾인다.
 * 실루엣의 요점은 **세로로 서고 위로 배관이 나간다**는 것이다(히터와 정반대의 인상).
 */
export function dehumidifierGeometry(): THREE.BufferGeometry {
  const cabinet = put(new THREE.BoxGeometry(1.3, 2.2, 1.1), 0, 1.1, 0)
  const riser = put(new THREE.CylinderGeometry(0.3, 0.3, 1.4, RADIAL), 0.35, 2.9, 0)
  /* 덕트 팔 — 위에서 앞으로 꺾여 나간다 */
  const elbow = new THREE.CylinderGeometry(0.3, 0.3, 1.3, RADIAL)
  elbow.rotateX(Math.PI / 2)
  put(elbow, 0.35, 3.5, 0.6)
  return mergeGeometries([cabinet, riser, elbow], false) ?? cabinet
}

/** 종류별 형상 — 이름을 그대로 키로 쓴다(모델의 `kind` 와 같은 말) */
export function equipmentGeometryOf(kind: '가스히터' | '제습기'): THREE.BufferGeometry {
  return kind === '가스히터' ? heaterGeometry() : dehumidifierGeometry()
}
