import * as THREE from 'three'
import type { BaySceneItem } from '../lib/bayScene'

/*
 * 공장 바닥의 **구획** — 베이 경계와 벽 골조 (R38 · R44).
 *
 * 예전 가동 뷰의 베이는 상자 하나의 모서리선이었다. 상자는 베이가 아니다 — 도장공장의
 * 베이는 바닥에 그어진 구획이고, 그 위로 골조가 선다. 그래서 겹으로 그린다:
 *  · **바닥판** — 실형상 발자국을 채운 판. 설비가 선 베이는 조금 밝다. uv 를 갖고 있어
 *    콘크리트 질감(`ui/sceneDressing`)이 8m 마다 반복된다.
 *  · **구획선** — 발자국 외곽. 베이와 베이의 경계가 이 선이다.
 *  · **벽 골조** — 모서리 기둥(면이 있는 상자)과 상단 보(선). 설비가 선 베이에만 세운다
 *    (가동 중인 면이 화면에서 먼저 읽히도록). 벽을 채우지 않는 것은 공기가 주인공이기
 *    때문이다.
 *
 * 겹마다 **베이마다 따로 그리지 않고 하나로 합친다.** 26면짜리 공장이면 따로 그릴 때
 * 백 콜이 넘고, 합치면 넷이다(성능 계약 — `lib/bayScene`의 `estimateDrawCalls` 와 1:1).
 *
 * 발자국은 지번 껍질(볼록)이므로 **부채꼴 삼각분할**로 충분하다 — 오목 폴리곤이 들어오면
 * 이 분할이 밖으로 삐져나가므로, 그때는 여기가 아니라 배치(`lib/floorPlan`)가 바뀐다.
 */

export interface FloorPalette {
  /** 설비가 선 베이의 바닥/구획선 */
  activeFloor: number
  activeOutline: number
  /** 설비가 없는 베이 — 있다는 사실만 남기고 물러선다 */
  idleFloor: number
  idleOutline: number
  /** 벽 골조 */
  frame: number
  /** 모서리 기둥 */
  column: number
}

export const FLOOR_PALETTE: FloorPalette = {
  activeFloor: 0x2a323a,
  activeOutline: 0x5a6e82,
  idleFloor: 0x1a2027,
  idleOutline: 0x2c3842,
  frame: 0x4a5a68,
  column: 0x3b4650,
}

/** 콘크리트 질감이 반복되는 간격(m) */
export const FLOOR_TEXTURE_REPEAT_M = 8
/** 모서리 기둥 한 변(m) */
export const COLUMN_SIZE_M = 0.9

export interface FactoryFloorGeometry {
  floor: THREE.BufferGeometry
  outline: THREE.BufferGeometry
  /** 설비가 선 베이가 하나도 없으면 null */
  frame: THREE.BufferGeometry | null
  /** 위와 같은 조건 — 설비가 선 베이의 모서리 기둥 */
  columns: THREE.BufferGeometry | null
}

/** 베이 로컬 발자국 → 공장 좌표 [x, z] */
export function footprintToWorld(item: BaySceneItem): [number, number][] {
  const rad = (item.rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return item.footprint.map(([fx, fz]) => [
    item.center[0] + fx * cos - fz * sin,
    item.center[1] + fx * sin + fz * cos,
  ])
}

function pushColor(target: number[], color: THREE.Color, times: number): void {
  for (let i = 0; i < times; i += 1) target.push(color.r, color.g, color.b)
}

/** 상자 하나를 정점 배열에 밀어 넣는다 — 기둥을 합칠 때 쓴다(법선은 면별로) */
function pushBox(
  pos: number[],
  normal: number[],
  cx: number,
  cz: number,
  size: number,
  height: number
): void {
  const h = size / 2
  const x0 = cx - h
  const x1 = cx + h
  const z0 = cz - h
  const z1 = cz + h
  const faces: [number[], number[], number[], number[], [number, number, number]][] = [
    [[x0, 0, z1], [x1, 0, z1], [x1, height, z1], [x0, height, z1], [0, 0, 1]],
    [[x1, 0, z0], [x0, 0, z0], [x0, height, z0], [x1, height, z0], [0, 0, -1]],
    [[x1, 0, z1], [x1, 0, z0], [x1, height, z0], [x1, height, z1], [1, 0, 0]],
    [[x0, 0, z0], [x0, 0, z1], [x0, height, z1], [x0, height, z0], [-1, 0, 0]],
    [[x0, height, z1], [x1, height, z1], [x1, height, z0], [x0, height, z0], [0, 1, 0]],
  ]
  for (const [a, b, c, d, n] of faces) {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d)
    for (let i = 0; i < 6; i += 1) normal.push(...n)
  }
}

/**
 * 바닥·구획선·골조·기둥을 각각 **하나의 지오메트리**로 합쳐 낸다.
 *
 * 베이마다 색이 다르므로 재질을 나누지 않고 **정점 색**을 쓴다 — 재질을 나누면 합친
 * 뜻이 없어진다(재질 수 = draw call 수).
 */
export function buildFactoryFloorGeometry(
  items: readonly BaySceneItem[],
  height: number,
  palette: FloorPalette = FLOOR_PALETTE
): FactoryFloorGeometry {
  const floorPos: number[] = []
  const floorColor: number[] = []
  const floorUv: number[] = []
  const floorNormal: number[] = []
  const outlinePos: number[] = []
  const outlineColor: number[] = []
  const framePos: number[] = []
  const columnPos: number[] = []
  const columnNormal: number[] = []

  const active = new THREE.Color(palette.activeFloor)
  const idle = new THREE.Color(palette.idleFloor)
  const activeLine = new THREE.Color(palette.activeOutline)
  const idleLine = new THREE.Color(palette.idleOutline)

  for (const item of items) {
    const ring = footprintToWorld(item)
    if (ring.length < 3) continue
    const isActive = item.air != null

    /* 바닥판 — 첫 점에서 부채꼴로 (발자국은 볼록). uv 는 공장 좌표를 반복 간격으로 나눈 값 */
    for (let i = 1; i + 1 < ring.length; i += 1) {
      for (const [x, z] of [ring[0], ring[i], ring[i + 1]]) {
        floorPos.push(x, 0, z)
        floorUv.push(x / FLOOR_TEXTURE_REPEAT_M, z / FLOOR_TEXTURE_REPEAT_M)
        floorNormal.push(0, 1, 0)
      }
      pushColor(floorColor, isActive ? active : idle, 3)
    }

    /* 구획선 — 발자국을 한 바퀴, 바닥에서 아주 조금 띄워 z-fighting 을 피한다 */
    for (let i = 0; i < ring.length; i += 1) {
      const a = ring[i]
      const b = ring[(i + 1) % ring.length]
      outlinePos.push(a[0], 0.05, a[1], b[0], 0.05, b[1])
      pushColor(outlineColor, isActive ? activeLine : idleLine, 2)
    }

    /* 벽 골조 — 설비가 선 베이만. 모서리 기둥(상자) + 상단 보(선) */
    if (!isActive) continue
    for (let i = 0; i < ring.length; i += 1) {
      const a = ring[i]
      const b = ring[(i + 1) % ring.length]
      framePos.push(a[0], height, a[1], b[0], height, b[1])
      pushBox(columnPos, columnNormal, a[0], a[1], COLUMN_SIZE_M, height)
    }
  }

  const floor = new THREE.BufferGeometry()
  floor.setAttribute('position', new THREE.Float32BufferAttribute(floorPos, 3))
  floor.setAttribute('color', new THREE.Float32BufferAttribute(floorColor, 3))
  floor.setAttribute('uv', new THREE.Float32BufferAttribute(floorUv, 2))
  floor.setAttribute('normal', new THREE.Float32BufferAttribute(floorNormal, 3))

  const outline = new THREE.BufferGeometry()
  outline.setAttribute('position', new THREE.Float32BufferAttribute(outlinePos, 3))
  outline.setAttribute('color', new THREE.Float32BufferAttribute(outlineColor, 3))

  let frame: THREE.BufferGeometry | null = null
  let columns: THREE.BufferGeometry | null = null
  if (framePos.length > 0) {
    frame = new THREE.BufferGeometry()
    frame.setAttribute('position', new THREE.Float32BufferAttribute(framePos, 3))
    columns = new THREE.BufferGeometry()
    columns.setAttribute('position', new THREE.Float32BufferAttribute(columnPos, 3))
    columns.setAttribute('normal', new THREE.Float32BufferAttribute(columnNormal, 3))
  }

  return { floor, outline, frame, columns }
}

/** 선택한 베이를 두르는 강조선 — 한 면뿐이라 콜 하나로 족하다 */
export function selectionRingGeometry(item: BaySceneItem, height: number): THREE.BufferGeometry {
  const ring = footprintToWorld(item)
  const pos: number[] = []
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    pos.push(a[0], 0.12, a[1], b[0], 0.12, b[1])
    pos.push(a[0], height, a[1], b[0], height, b[1])
    pos.push(a[0], 0.12, a[1], a[0], height, a[1])
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return geometry
}
