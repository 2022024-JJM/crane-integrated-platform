import * as THREE from 'three'

/**
 * 윤곽 요소 생성.
 *
 * `GridHelper` 는 정사각형만 만들어 베이(30×70m) 밖으로 넘치므로 바닥 그리드는 직접 만든다.
 */

/** 특징선 추출 임계각 — 이보다 크게 꺾인 모서리만 선으로 남긴다 */
export const FEATURE_LINE_THRESHOLD_DEG = 30

/**
 * triangle soup 에서 특징선 세그먼트를 뽑는다.
 * 블록 하나(6만 삼각형)당 약 164ms 걸리므로, 호출부는 워커로 밀거나
 * 씬 빌드가 끝난 뒤 순차 처리해야 한다.
 */
export function extractFeatureLines(soup: Float32Array): Float32Array {
  if (soup.length === 0) return new Float32Array(0)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(soup, 3))
  const edges = new THREE.EdgesGeometry(geometry, FEATURE_LINE_THRESHOLD_DEG)
  const positions = edges.getAttribute('position').array as Float32Array
  const out = new Float32Array(positions)
  edges.dispose()
  geometry.dispose()
  return out
}

export function createLineSegments(
  positions: Float32Array,
  color: number,
  opacity: number,
  options: { depthTest?: boolean; renderOrder?: number } = {}
): THREE.LineSegments {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: options.depthTest ?? true,
  })
  const lines = new THREE.LineSegments(geometry, material)
  if (options.renderOrder !== undefined) lines.renderOrder = options.renderOrder
  return lines
}

type BBox = { min: [number, number, number]; max: [number, number, number] }

/**
 * 인식 bbox 여덟 모서리의 L자 브래킷.
 * 정합에 실패해 도면 형상이 없는 detection 도 인식 범위는 보여준다.
 */
export function createCornerBrackets(bbox: BBox, armRatio = 0.18): Float32Array {
  const [x0, y0, z0] = bbox.min
  const [x1, y1, z1] = bbox.max
  const ax = Math.max(0.15, (x1 - x0) * armRatio)
  const ay = Math.max(0.15, (y1 - y0) * armRatio)
  const az = Math.max(0.15, (z1 - z0) * armRatio)

  const out: number[] = []
  for (const [x, sx] of [[x0, 1], [x1, -1]] as const) {
    for (const [y, sy] of [[y0, 1], [y1, -1]] as const) {
      for (const [z, sz] of [[z0, 1], [z1, -1]] as const) {
        out.push(x, y, z, x + sx * ax, y, z)
        out.push(x, y, z, x, y + sy * ay, z)
        out.push(x, y, z, x, y, z + sz * az)
      }
    }
  }
  return new Float32Array(out)
}

/** bbox 밑면을 정반 바닥(y=0)에 투영한 사각 윤곽 */
export function createFloorFootprint(bbox: BBox, y = 0.02): Float32Array {
  const [x0, , z0] = bbox.min
  const [x1, , z1] = bbox.max
  const corners: [number, number][] = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ]
  const out: number[] = []
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i]
    const [bx, bz] = corners[(i + 1) % 4]
    out.push(ax, y, az, bx, y, bz)
  }
  return new Float32Array(out)
}

/**
 * 베이 바닥 그리드 — 폭×길이가 다르므로 정사각형만 만드는 GridHelper 대신 직접 생성한다.
 */
export function createFloorGrid(width: number, length: number, step = 2, y = 0.01): Float32Array {
  const hx = width / 2
  const hz = length / 2
  const out: number[] = []
  for (let x = -hx; x <= hx + 1e-6; x += step) {
    out.push(x, y, -hz, x, y, hz)
  }
  for (let z = -hz; z <= hz + 1e-6; z += step) {
    out.push(-hx, y, z, hx, y, z)
  }
  return new Float32Array(out)
}

/**
 * 특징선 추출 큐 — 워커가 있으면 워커에서, 막힌 환경이면 동기 계산으로 자동 폴백한다.
 *
 * 블록을 하나씩 순차 처리하고 도착하는 대로 콜백을 호출한다.
 */
export interface FeatureLineJob {
  soup: Float32Array
  onReady: (positions: Float32Array) => void
}

export function runFeatureLineQueue(jobs: FeatureLineJob[]): () => void {
  if (jobs.length === 0) return () => {}

  let cancelled = false
  let index = 0

  let worker: Worker | null = null
  try {
    worker = new Worker(new URL('./featureLines.worker.ts', import.meta.url), { type: 'module' })
  } catch {
    worker = null
  }

  if (worker) {
    const active = worker
    active.onmessage = (event: MessageEvent<{ id: number; positions: Float32Array }>) => {
      if (cancelled) return
      jobs[event.data.id]?.onReady(event.data.positions)
      pump()
    }
    active.onerror = () => {
      // 워커가 죽으면 나머지는 동기로 처리한다
      active.terminate()
      worker = null
      pumpSync()
    }

    const pump = () => {
      if (cancelled || index >= jobs.length) return
      const id = index++
      /*
       * 입력 soup 은 블록 모델 캐시가 공유하는 버퍼다 — transfer 하면 메인 스레드의
       * 원본이 무효화된다. 반드시 복사본을 넘긴다.
       */
      active.postMessage({ id, soup: jobs[id].soup.slice() })
    }
    pump()

    return () => {
      cancelled = true
      active.terminate()
    }
  }

  function pumpSync() {
    if (cancelled || index >= jobs.length) return
    const job = jobs[index++]
    job.onReady(extractFeatureLines(job.soup))
    window.setTimeout(pumpSync, 0)
  }
  pumpSync()

  return () => {
    cancelled = true
  }
}
