import * as THREE from 'three'
import type { SurfaceSamples } from './sampleSurfacePoints'

/**
 * 부재 단위 분해.
 *
 * 조립체 형상은 판재·보강재 여러 장이 하나의 triangle soup 에 들어 있다.
 * **정점을 공유하는 삼각형끼리 묶으면(union-find) 실제 부재 단위로 갈라진다.**
 *
 * 비용은 대형 조립체(6만 삼각형) 하나당 11~18ms 수준이라 워커 없이 씬 빌드 중 동기 처리한다.
 */

/** 정점 용접 격자 (m) — 이보다 가까운 정점은 같은 점으로 본다 */
const WELD_EPSILON = 1e-4

export interface PartComponents {
  /** 삼각형 index → 부재 index */
  labels: Uint32Array
  /** 부재 개수 */
  count: number
  /** 부재별 표면적 */
  areas: Float64Array
}

class UnionFind {
  private parent: Int32Array

  constructor(size: number) {
    this.parent = new Int32Array(size)
    for (let i = 0; i < size; i++) this.parent[i] = i
  }

  find(x: number): number {
    let root = x
    while (this.parent[root] !== root) root = this.parent[root]
    // 경로 압축
    let node = x
    while (this.parent[node] !== root) {
      const next = this.parent[node]
      this.parent[node] = root
      node = next
    }
    return root
  }

  union(a: number, b: number): void {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent[rb] = ra
  }
}

/** triangle soup 을 정점 공유 기준 연결요소(=부재)로 가른다 */
export function splitComponents(soup: Float32Array): PartComponents {
  const triCount = Math.floor(soup.length / 9)
  if (triCount === 0) {
    return { labels: new Uint32Array(0), count: 0, areas: new Float64Array(0) }
  }

  const uf = new UnionFind(triCount)
  // 용접된 정점 키 → 그 정점을 처음 쓴 삼각형
  const vertexOwner = new Map<string, number>()
  const inv = 1 / WELD_EPSILON

  for (let t = 0; t < triCount; t++) {
    for (let v = 0; v < 3; v++) {
      const o = t * 9 + v * 3
      const key =
        Math.round(soup[o] * inv) +
        ',' +
        Math.round(soup[o + 1] * inv) +
        ',' +
        Math.round(soup[o + 2] * inv)
      const owner = vertexOwner.get(key)
      if (owner === undefined) vertexOwner.set(key, t)
      else uf.union(owner, t)
    }
  }

  // 루트를 0..n-1 로 압축
  const rootToIndex = new Map<number, number>()
  const labels = new Uint32Array(triCount)
  for (let t = 0; t < triCount; t++) {
    const root = uf.find(t)
    let idx = rootToIndex.get(root)
    if (idx === undefined) {
      idx = rootToIndex.size
      rootToIndex.set(root, idx)
    }
    labels[t] = idx
  }

  const count = rootToIndex.size
  const areas = new Float64Array(count)
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  for (let t = 0; t < triCount; t++) {
    a.fromArray(soup, t * 9)
    b.fromArray(soup, t * 9 + 3)
    c.fromArray(soup, t * 9 + 6)
    ab.subVectors(b, a)
    ac.subVectors(c, a)
    areas[labels[t]] += ab.cross(ac).length() / 2
  }

  return { labels, count, areas }
}

/** 부재별 표면 샘플 (위치 + 법선 + 소속 부재) */
export interface ComponentSamples extends SurfaceSamples {
  /** 샘플 index → 부재 index */
  owners: Uint32Array
}

/**
 * 부재마다 **최소 표본 수를 보장하며** 표면을 샘플링한다.
 *
 * 면적 가중으로만 뽑으면 작은 부재는 표본이 0~2개라 판정 자체가 불가능해진다.
 * 그래서 부재별로 max(minPerPart, 면적 비례) 만큼 뽑는다.
 */
export function sampleComponentSurfaces(
  soup: Float32Array,
  parts: PartComponents,
  totalSamples: number,
  minPerPart = 24
): ComponentSamples {
  const { labels, count, areas } = parts
  const triCount = Math.floor(soup.length / 9)
  if (triCount === 0 || count === 0) {
    return {
      positions: new Float32Array(0),
      normals: new Float32Array(0),
      owners: new Uint32Array(0),
    }
  }

  // 부재별 삼각형 목록
  const trisByPart: number[][] = Array.from({ length: count }, () => [])
  for (let t = 0; t < triCount; t++) trisByPart[labels[t]].push(t)

  const totalArea = areas.reduce((s, v) => s + v, 0) || 1
  const quotas = new Int32Array(count)
  let planned = 0
  for (let p = 0; p < count; p++) {
    quotas[p] = Math.max(minPerPart, Math.round((areas[p] / totalArea) * totalSamples))
    planned += quotas[p]
  }

  const positions = new Float32Array(planned * 3)
  const normals = new Float32Array(planned * 3)
  const owners = new Uint32Array(planned)

  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  const n = new THREE.Vector3()

  let s = 0
  for (let p = 0; p < count; p++) {
    const tris = trisByPart[p]
    if (tris.length === 0) continue

    // 부재 내부 면적 가중 누적표
    const cum = new Float64Array(tris.length)
    let acc = 0
    for (let i = 0; i < tris.length; i++) {
      const t = tris[i]
      a.fromArray(soup, t * 9)
      b.fromArray(soup, t * 9 + 3)
      c.fromArray(soup, t * 9 + 6)
      ab.subVectors(b, a)
      ac.subVectors(c, a)
      acc += n.crossVectors(ab, ac).length() / 2
      cum[i] = acc
    }
    if (acc === 0) acc = 1

    for (let k = 0; k < quotas[p]; k++) {
      const r = Math.random() * acc
      let lo = 0
      let hi = tris.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (cum[mid] < r) lo = mid + 1
        else hi = mid
      }
      const t = tris[lo]

      a.fromArray(soup, t * 9)
      b.fromArray(soup, t * 9 + 3)
      c.fromArray(soup, t * 9 + 6)

      let u = Math.random()
      let v = Math.random()
      if (u + v > 1) {
        u = 1 - u
        v = 1 - v
      }
      positions[s * 3] = a.x + (b.x - a.x) * u + (c.x - a.x) * v
      positions[s * 3 + 1] = a.y + (b.y - a.y) * u + (c.y - a.y) * v
      positions[s * 3 + 2] = a.z + (b.z - a.z) * u + (c.z - a.z) * v

      ab.subVectors(b, a)
      ac.subVectors(c, a)
      n.crossVectors(ab, ac).normalize()
      normals[s * 3] = n.x
      normals[s * 3 + 1] = n.y
      normals[s * 3 + 2] = n.z
      owners[s] = p
      s++
    }
  }

  return { positions, normals, owners }
}

/**
 * 조건을 만족하는 부재의 삼각형만 모아 새 soup 을 만든다.
 *
 * 한 mesh 안에서는 부재별로 투명도를 달리 줄 수 없다. 그래서 조립체마다
 * 확인 mesh / 미확인 mesh 두 개로 나눠 만든다.
 */
export function subsetSoupByComponent(
  soup: Float32Array,
  labels: Uint32Array,
  keep: (partIndex: number) => boolean
): Float32Array {
  const triCount = labels.length
  let kept = 0
  for (let t = 0; t < triCount; t++) if (keep(labels[t])) kept++

  const out = new Float32Array(kept * 9)
  let o = 0
  for (let t = 0; t < triCount; t++) {
    if (!keep(labels[t])) continue
    out.set(soup.subarray(t * 9, t * 9 + 9), o)
    o += 9
  }
  return out
}

/** 특정 부재에 속한 샘플만 남긴다 */
export function filterSamplesByPart(
  samples: ComponentSamples,
  keep: (partIndex: number) => boolean
): ComponentSamples {
  const { positions, normals, owners } = samples
  let n = 0
  for (let i = 0; i < owners.length; i++) if (keep(owners[i])) n++

  const outPos = new Float32Array(n * 3)
  const outNrm = new Float32Array(n * 3)
  const outOwn = new Uint32Array(n)
  let o = 0
  for (let i = 0; i < owners.length; i++) {
    if (!keep(owners[i])) continue
    outPos[o * 3] = positions[i * 3]
    outPos[o * 3 + 1] = positions[i * 3 + 1]
    outPos[o * 3 + 2] = positions[i * 3 + 2]
    outNrm[o * 3] = normals[i * 3]
    outNrm[o * 3 + 1] = normals[i * 3 + 1]
    outNrm[o * 3 + 2] = normals[i * 3 + 2]
    outOwn[o] = owners[i]
    o++
  }
  return { positions: outPos, normals: outNrm, owners: outOwn }
}
