import * as THREE from 'three'
import type { RealRect } from '../api/realScanAssets'

/**
 * 베이 담당구간 윤곽 — 바닥에 칠한 구획선처럼 그린다.
 *
 * 이전에는 그룹 점군의 AABB 를 12선 와이어박스로 세웠는데, 라이다가 홀 반대편까지
 * 보는 탓에 상자 세 개가 서로를 통째로 덮어 **어디가 어느 베이인지 읽히지 않았다**.
 * 지금은 담당구간이 X 축을 따라 맞물린 사각형이라 겹칠 일이 없고, 실제 공장 바닥의
 * 구획 도색과 같은 문법(면 + 굵은 테두리 + 모서리 마크)으로 그린다.
 *
 * three 의 `LineBasicMaterial.linewidth` 는 대부분의 WebGL 구현에서 1px 로 무시된다.
 * 그래서 선은 전부 **바닥에 눕힌 얇은 사각형 메쉬**로 만든다 — 원근에 따라 굵기가
 * 같이 줄어들어 100m 홀에서도 도색처럼 보인다.
 */

/** 바닥 도색이 점군 바닥면과 z-fighting 하지 않도록 살짝 띄우는 높이(m) */
const PAINT_LIFT = 0.03

function pushQuad(
  out: number[],
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number
): void {
  // 두 삼각형 (반시계) — 바닥을 위에서 보므로 side: DoubleSide 로 뒤집힘까지 덮는다
  out.push(x0, y, z0, x1, y, z0, x1, y, z1)
  out.push(x0, y, z0, x1, y, z1, x0, y, z1)
}

function meshFrom(positions: number[], material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return new THREE.Mesh(geometry, material)
}

/** 구획선 — 사각형 테두리를 폭 `width` 의 띠로 두른다 */
export function createBandStripe(
  rect: RealRect,
  material: THREE.Material,
  width = 0.9,
  y = PAINT_LIFT
): THREE.Mesh {
  const [x0, z0] = rect.min
  const [x1, z1] = rect.max
  const w = width / 2
  const out: number[] = []
  pushQuad(out, x0 - w, z0 - w, x1 + w, z0 + w, y) // 앞
  pushQuad(out, x0 - w, z1 - w, x1 + w, z1 + w, y) // 뒤
  pushQuad(out, x0 - w, z0 + w, x0 + w, z1 - w, y) // 좌
  pushQuad(out, x1 - w, z0 + w, x1 + w, z1 - w, y) // 우
  return meshFrom(out, material)
}

/** 구획 내부 — 아주 옅은 면. 베이가 "영역"으로 읽히게 하되 점군을 가리지 않는다 */
export function createBandFill(
  rect: RealRect,
  material: THREE.Material,
  y = PAINT_LIFT / 2
): THREE.Mesh {
  const out: number[] = []
  pushQuad(out, rect.min[0], rect.min[1], rect.max[0], rect.max[1], y)
  return meshFrom(out, material)
}

/**
 * 모서리 마크 — 네 귀퉁이의 L 자 굵은 표시.
 * 테두리만으로는 어느 쪽이 구획의 끝인지 원근에서 흐려진다.
 */
export function createBandCorners(
  rect: RealRect,
  material: THREE.Material,
  arm = 5,
  width = 1.8,
  y = PAINT_LIFT * 1.5
): THREE.Mesh {
  const [x0, z0] = rect.min
  const [x1, z1] = rect.max
  const a = Math.min(arm, (x1 - x0) / 3, (z1 - z0) / 3)
  const out: number[] = []
  for (const [x, sx] of [[x0, 1], [x1, -1]] as const) {
    for (const [z, sz] of [[z0, 1], [z1, -1]] as const) {
      const xa = x + sx * a
      const za = z + sz * a
      pushQuad(out, Math.min(x, xa), z, Math.max(x, xa), z + sz * width, y)
      pushQuad(out, x, Math.min(z, za), x + sx * width, Math.max(z, za), y)
    }
  }
  return meshFrom(out, material)
}

function pushBox(
  out: number[],
  cx: number,
  cz: number,
  half: number,
  y0: number,
  y1: number
): void {
  const [x0, x1, z0, z1] = [cx - half, cx + half, cz - half, cz + half]
  const face = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx2: number, cy2: number, cz2: number,
    dx: number, dy: number, dz: number
  ) => {
    out.push(ax, ay, az, bx, by, bz, cx2, cy2, cz2)
    out.push(ax, ay, az, cx2, cy2, cz2, dx, dy, dz)
  }
  face(x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0)
  face(x1, y0, z1, x0, y0, z1, x0, y1, z1, x1, y1, z1)
  face(x0, y0, z1, x0, y0, z0, x0, y1, z0, x0, y1, z1)
  face(x1, y0, z0, x1, y0, z1, x1, y1, z1, x1, y1, z0)
}

/**
 * 구획 기둥 — 네 귀퉁이에서 올라오는 짧은 각기둥.
 *
 * 바닥 도색만 있으면 비스듬히 볼 때 구획이 바닥 무늬로 뭉개진다. 1px 선으로는
 * 100m 거리에서 아예 안 보여서, 굵기를 가진 각기둥으로 세운다.
 */
export function createBandPillars(
  rect: RealRect,
  material: THREE.Material,
  height: number,
  thickness = 0.22
): THREE.Mesh {
  const out: number[] = []
  for (const x of [rect.min[0], rect.max[0]]) {
    for (const z of [rect.min[1], rect.max[1]]) {
      pushBox(out, x, z, thickness / 2, 0, height)
    }
  }
  return meshFrom(out, material)
}

/** 라벨 지시선 — 구획 중앙 바닥에서 라벨 높이까지 세우는 가는 기둥 */
export function createLabelLeader(
  rect: RealRect,
  material: THREE.Material,
  height: number,
  thickness = 0.09
): THREE.Mesh {
  const out: number[] = []
  pushBox(
    out,
    (rect.min[0] + rect.max[0]) / 2,
    (rect.min[1] + rect.max[1]) / 2,
    thickness / 2,
    0,
    height
  )
  return meshFrom(out, material)
}

/**
 * 바닥 그리드 — 지정한 사각형 안에서만 5m 격자를 깐다.
 * `createFloorGrid` 는 중심 기준 대칭 격자라 홀처럼 원점이 한쪽으로 치우친 영역에
 * 쓰면 격자가 밖으로 새거나 모자란다.
 */
export function createRectGrid(rect: RealRect, step = 5, y = 0.005): Float32Array {
  const [x0, z0] = rect.min
  const [x1, z1] = rect.max
  const out: number[] = []
  for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
    out.push(x, y, z0, x, y, z1)
  }
  for (let z = Math.ceil(z0 / step) * step; z <= z1; z += step) {
    out.push(x0, y, z, x1, y, z)
  }
  return new Float32Array(out)
}

/** display XZ 사각형 → Box3 (카메라 프레이밍용, 높이는 호출부가 준다) */
export function rectToBox(rect: RealRect, minY: number, maxY: number): THREE.Box3 {
  return new THREE.Box3(
    new THREE.Vector3(rect.min[0], minY, rect.min[1]),
    new THREE.Vector3(rect.max[0], maxY, rect.max[1])
  )
}
