import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/*
 * 도장 설비의 **형상** — 종류를 실루엣으로, 재질을 색으로 구별한다 (R38 · R44).
 *
 * 처음(R38)에는 종류당 상자 셋을 합친 저폴리였고, 색은 인스턴스 색 하나로 몸통 전체를
 * 종류색으로 칠했다 — 빨간 덩어리·파란 덩어리. 관제 화면으로는 충분했지만 디지털 트윈으로
 * 읽히지는 않았다("모델링을 더 실사에 가깝게").
 *
 * R44 에서 바뀐 것:
 *  · **부위별 정점 색** — 아연도금 몸통·검은 버너 하우징·종류색 띠·강관 연도처럼 실물의
 *    재질 구분을 색으로 적는다. 인스턴스 색은 더 쓰지 않는다(몸통이 통째로 빨개지는 것이
 *    실사와 가장 먼 그림이었다).
 *  · **가동 표시등** — 상태는 몸통이 아니라 **램프와 토출구의 빛**이 말한다. 형상과 별개의
 *    작은 인스턴스 메시(`indicatorGeometryOf`)라 켜짐/꺼짐을 인스턴스 색으로 바꾼다.
 *  · **토출점**(`emitPointOf`) — 기류가 시작/끝나는 자리. 기류장(`ui/airFlowField`)이
 *    형상의 이 점에서 유선을 뽑는다.
 *
 * 그 이상은 만들지 않는다 — 고폴리는 성능 계약(정점 수)을 먹고, 이 화면의 질문("무엇이
 * 몇 대, 어디에, 도는가")에 보태는 것이 없다. **부품은 하나로 합쳐 낸다**(`mergeGeometries`):
 * 종류당 InstancedMesh 하나 = 대수와 무관하게 종류당 1콜.
 *
 * R46 — **두 종류 모두 glTF 모델**(`public/models/painting/{gas-heater,dehumidifier}.glb`)
 * 로 바뀌었다. 아래 `heaterGeometry()`·`dehumidifierGeometry()` 의 저폴리 실루엣은 모델이
 * 도착하기 전(그리고 못 가져왔을 때)의 자리표시자다. 모델 파일을 읽어 한 지오메트리로 굽는
 * 일은 `ui/equipmentModels` 가 하고, 모델의 **배율·토출구/흡입구·표시등 자리**는 이 파일의
 * `GAS_HEATER_MODEL`·`DEHUMIDIFIER_MODEL` 이 정한다 — 기류장과 표시등이 모델을 기다리지
 * 않고 같은 좌표로 서야 하기 때문이다(모델 로드는 비동기다).
 *
 * 좌표 규약: 바닥이 y=0, 정면(토출구·흡입구가 있는 쪽)이 +z. 자리 규칙(`lib/bayStations`)의
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

/**
 * 가스히터 glTF 모델의 규약 — 파일과 형상 로컬 좌표 사이의 약속.
 *
 * 모델은 실치수(약 1.0 × 1.35 × 0.94 m, 바닥 y=0, 정면 +z)로 그려져 있다. 그대로 두면
 * 제습기 실루엣(높이 2.2~3.5 로컬)에 견줘 반 토막이라, **로컬 높이 2.4 로 맞추는 배율**을
 * 한 번 곱해 저폴리 실루엣과 같은 크기 체계에 세운다(그 위에 `EQUIPMENT_SYMBOL_SCALE`).
 *
 * 토출구는 상판 가운데(위로 뚫린 원형 그릴)이고 표시등은 정면 상단 오른쪽 LED 묶음이다 —
 * 둘 다 모델 노드(`outlet_rim`, `led_*`)에서 잰 값이며 배율 곱하기 전 모델 좌표다.
 */
export const GAS_HEATER_MODEL = {
  url: '/models/painting/gas-heater.glb',
  /** 모델 좌표 → 형상 로컬 좌표 (2.4 / 모델 높이 1.353) */
  scale: 1.774,
  /** 모델 좌표의 토출구 중심(상판 그릴)과 그 반지름 */
  outlet: { x: 0, y: 1.334, z: -0.045, radius: 0.133 },
  /** 모델 좌표의 LED 묶음 중심 */
  lamp: { x: 0.17, y: 0.917, z: 0.3 },
} as const

/**
 * 제습기(데시칸트) glTF 모델의 규약.
 *
 * 모델은 실치수(불투명 부품 기준 약 3.3 × 2.27 × 1.37 m, 바닥 y=0, 정면 +z)다 — 스키드 위
 * 캐비닛 양옆으로 흡입 덕트(-x, 벨마우스)와 급기 덕트(+x)가 뻗고, 지붕에 재생 배기 스택이
 * 선다. 이 크기면 히터(로컬 2.4 높이)와 나란히 서도 "큰 기계" 로 읽히므로 **배율 1** —
 * 실치수 그대로 형상 로컬 좌표로 쓴다. 코너 자리의 벽 여백(`WALL_INSET_M` 3.5m)에 덕트
 * 끝(반폭 1.7 × 심볼 배율 2.4 ≈ 4m)이 반 미터쯤 걸치지만 벽은 선 골조라 가려지지 않는다.
 *
 * 흡입구는 -x 끝 벨마우스, 표시등은 정면 HMI 아래 램프 셋이다 — `intake_hood_rim`·
 * `supply_end_flange`·`indicator_lamp_*` 노드에서 잰 모델 좌표다.
 */
export const DEHUMIDIFIER_MODEL = {
  url: '/models/painting/dehumidifier.glb',
  scale: 1,
  /** 흡입 벨마우스 중심(-x 를 본다)과 반지름 */
  intake: { x: -1.585, y: 0.81, z: 0, radius: 0.267 },
  /** 급기 덕트 끝 플랜지 중심(+x 를 본다)과 반지름 */
  supply: { x: 1.711, y: 0.81, z: 0, radius: 0.285 },
  /** 정면 램프 셋의 가운데 */
  lamp: { x: 0.8, y: 0.995, z: 0.74 },
} as const

/** 원통 분할 수 — 12면 매끈한 원통으로 읽히고 인스턴싱이라 정점 부담이 없다 */
const RADIAL = 12

/** 재질 팔레트 — 실물 산업 설비의 색. 종류색은 띠 한 줄에만 쓴다 */
const PAINT = {
  skid: 0x1e2429,
  galvanized: 0xb4bac1,
  cabinet: 0xd2d7dc,
  dark: 0x2c3237,
  steel: 0x8a9198,
  heaterBand: 0xc2493a,
  dryerBand: 0x3a6ccc,
  grille: 0x171b1f,
} as const

function put(geometry: THREE.BufferGeometry, x: number, y: number, z: number): THREE.BufferGeometry {
  geometry.translate(x, y, z)
  return geometry
}

/** 부품에 한 색을 정점 색으로 입힌다 — 합친 뒤에도 부위별 색이 남는다 */
function paint(geometry: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const color = new THREE.Color(hex)
  const count = geometry.getAttribute('position').count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  /* 합치려면 속성 집합이 같아야 한다 — uv 는 쓰지 않으므로 떼어 낸다 */
  geometry.deleteAttribute('uv')
  return geometry
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, hex: number) {
  return paint(put(new THREE.BoxGeometry(w, h, d), x, y, z), hex)
}

function cylinderY(r: number, h: number, x: number, y: number, z: number, hex: number, rTop = r) {
  return paint(put(new THREE.CylinderGeometry(rTop, r, h, RADIAL), x, y, z), hex)
}

/**
 * 가스히터 **자리표시자** — glTF 모델(`GAS_HEATER_MODEL`)이 도착할 때까지, 그리고 모델을
 * 못 가져왔을 때 서 있는 저폴리 실루엣. 모델과 같은 자리(바닥 y=0, 정면 +z)에 비슷한
 * 부피로 서도록 상판 토출구를 모델의 토출구 자리에 둔다 — 기류 리본이 모델 좌표에서
 * 시작하므로 자리표시자만 보이는 잠깐에도 리본이 허공에서 나오지 않는다.
 */
export function heaterGeometry(): THREE.BufferGeometry {
  const k = GAS_HEATER_MODEL.scale
  const { outlet } = GAS_HEATER_MODEL
  const parts = [
    box(0.9 * k, 0.16 * k, 0.86 * k, 0, 0.08 * k, 0, PAINT.skid),
    box(0.68 * k, 1.0 * k, 0.56 * k, 0, 0.66 * k, 0, PAINT.galvanized),
    box(0.7 * k, 0.16 * k, 0.58 * k, 0, 1.08 * k, 0, PAINT.heaterBand),
    /* 상판 토출구 — 모델의 그릴 자리, 위로 뚫린다 */
    cylinderY(outlet.radius * k, 0.06 * k, outlet.x * k, (outlet.y - 0.03) * k, outlet.z * k, PAINT.dark),
    /* 정면 표시창 */
    box(0.24 * k, 0.1 * k, 0.02 * k, -0.115 * k, 1.01 * k, 0.29 * k, PAINT.grille),
  ]
  return mergeGeometries(parts, false) ?? parts[1]
}

/**
 * 제습기 **자리표시자** — glTF 모델(`DEHUMIDIFIER_MODEL`)이 도착할 때까지, 그리고 모델을
 * 못 가져왔을 때 서 있는 저폴리 실루엣. 모델과 같은 자리에 비슷한 부피로 — 캐비닛, 양옆
 * 덕트, 지붕 스택. 흡입 덕트 끝을 모델의 벨마우스 자리에 두어 기류 리본이 허공에서 끝나지
 * 않게 한다.
 */
export function dehumidifierGeometry(): THREE.BufferGeometry {
  const k = DEHUMIDIFIER_MODEL.scale
  const { intake, supply } = DEHUMIDIFIER_MODEL
  const parts = [
    box(2.1 * k, 0.2 * k, 1.2 * k, 0, 0.1 * k, 0, PAINT.skid),
    box(1.96 * k, 1.45 * k, 1.06 * k, 0, 0.94 * k, 0, PAINT.cabinet),
    box(1.98 * k, 0.3 * k, 1.08 * k, 0, 1.5 * k, 0, PAINT.dryerBand),
    /* 흡입 덕트 — 캐비닛 왼쪽(-x)으로 뻗어 벨마우스로 끝난다 */
    cylinderY(0.2 * k, 0.5 * k, 0, 0, 0, PAINT.steel).rotateZ(Math.PI / 2).translate(-1.25 * k, intake.y * k, 0),
    cylinderY(intake.radius * k, 0.1 * k, 0, 0, 0, PAINT.dark).rotateZ(Math.PI / 2).translate((intake.x + 0.05) * k, intake.y * k, 0),
    /* 급기 덕트 — 오른쪽(+x) */
    cylinderY(0.23 * k, 0.7 * k, 0, 0, 0, PAINT.steel).rotateZ(Math.PI / 2).translate(1.35 * k, supply.y * k, 0),
    cylinderY(supply.radius * k, 0.05 * k, 0, 0, 0, PAINT.dark).rotateZ(Math.PI / 2).translate((supply.x - 0.03) * k, supply.y * k, 0),
    /* 재생 배기 스택 + 갓 */
    cylinderY(0.165 * k, 0.5 * k, 0.62 * k, 1.93 * k, 0, PAINT.steel),
    cylinderY(0.225 * k, 0.12 * k, 0.62 * k, 2.21 * k, 0, PAINT.dark, 0.08 * k),
    /* 정면 HMI */
    box(0.29 * k, 0.22 * k, 0.02 * k, 0.8 * k, 1.185 * k, 0.73 * k, PAINT.grille),
  ]
  return mergeGeometries(parts, false) ?? parts[1]
}

/**
 * 가동 표시 — 램프 + 토출구(흡입구)의 빛. 형상과 따로 세우는 이유는 이것만 인스턴스
 * 색으로 켜고 끄기 위해서다(몸통은 실물 색을 유지한다).
 */
export function heaterIndicatorGeometry(): THREE.BufferGeometry {
  const k = GAS_HEATER_MODEL.scale
  const { lamp: at, outlet } = GAS_HEATER_MODEL
  /* LED 묶음은 실치수 1.5cm 라 공장 화면에서 사라진다 — 램프 하나로 키워 그 자리에 둔다 */
  const lamp = new THREE.SphereGeometry(0.1, 10, 8)
  lamp.translate(at.x * k, at.y * k, at.z * k)
  /* 토출구의 빛 — 상판 그릴이라 위(+y)를 본다 */
  const glow = new THREE.CircleGeometry(outlet.radius * k, RADIAL)
  glow.rotateX(-Math.PI / 2)
  glow.translate(outlet.x * k, (outlet.y + 0.012) * k, outlet.z * k)
  return mergeGeometries([lamp, glow], false) ?? lamp
}

export function dehumidifierIndicatorGeometry(): THREE.BufferGeometry {
  const k = DEHUMIDIFIER_MODEL.scale
  const { lamp: at, intake: inlet, supply } = DEHUMIDIFIER_MODEL
  /* 정면 램프 셋 — 실치수 4cm 라 하나로 키워 가운데 자리에 둔다 */
  const lamp = new THREE.SphereGeometry(0.1, 10, 8)
  lamp.translate(at.x * k, at.y * k, at.z * k)
  /* 흡입 벨마우스의 빛 — -x 를 본다 */
  const intake = new THREE.CircleGeometry(inlet.radius * k, RADIAL)
  intake.rotateY(-Math.PI / 2)
  intake.translate((inlet.x - 0.012) * k, inlet.y * k, inlet.z * k)
  /* 급기 덕트 끝의 빛 — +x 를 본다 */
  const duct = new THREE.CircleGeometry(supply.radius * k, RADIAL)
  duct.rotateY(Math.PI / 2)
  duct.translate((supply.x + 0.012) * k, supply.y * k, supply.z * k)
  return mergeGeometries([lamp, intake, duct], false) ?? lamp
}

/** 종류별 형상 — 이름을 그대로 키로 쓴다(모델의 `kind` 와 같은 말) */
export function equipmentGeometryOf(kind: '가스히터' | '제습기'): THREE.BufferGeometry {
  return kind === '가스히터' ? heaterGeometry() : dehumidifierGeometry()
}

export function indicatorGeometryOf(kind: '가스히터' | '제습기'): THREE.BufferGeometry {
  return kind === '가스히터' ? heaterIndicatorGeometry() : dehumidifierIndicatorGeometry()
}

/**
 * **토출점** — 형상 로컬(배율 전) 좌표. 히터는 모델 상판 그릴의 조금 위, 제습기는 흡입
 * 벨마우스의 조금 바깥(-x). 기류장이 여기서 유선을 시작(히터)하거나 끝낸다(제습기).
 */
export function emitPointOf(kind: '가스히터' | '제습기'): { x: number; y: number; z: number } {
  if (kind === '가스히터') {
    const k = GAS_HEATER_MODEL.scale
    const { outlet } = GAS_HEATER_MODEL
    return { x: outlet.x * k, y: (outlet.y + 0.02) * k, z: outlet.z * k }
  }
  const k = DEHUMIDIFIER_MODEL.scale
  const { intake } = DEHUMIDIFIER_MODEL
  return { x: (intake.x - 0.05) * k, y: intake.y * k, z: intake.z * k }
}
