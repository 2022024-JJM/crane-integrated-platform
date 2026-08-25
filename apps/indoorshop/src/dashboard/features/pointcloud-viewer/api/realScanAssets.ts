import { publicAsset } from '../../../shared/lib/public-asset'
/**
 * 실측 PoC 데이터셋(20251220_150000) 자산 로더.
 *
 * `scripts/build-real-scan-assets.py` 가 만든 `public/real-scan/` 을 읽는다.
 * bin(점군·라벨·음영)은 용량 문제로 git 에 없다 — 없으면 스크립트로 재생성한다.
 * 네 뷰(factory/g1/g2/g3)는 **같은 display 프레임**을 공유하고 y=0 이 홀 바닥이다.
 * CAD 로컬 프레임은 **정점 centroid 원점**(제공사 규약 확인됨)이고 배치 행렬은
 * T_scene_cad 그대로다. 여기서 형상·행렬을 재가공하지 않는다.
 */

export type RealGroupKey = 'g1' | 'g2' | 'g3'

export interface RealSensorRange {
  sensor: string
  start: number
  count: number
}

export interface RealSensorInfo {
  /** 센서 IP (예: '192.168.1.100') */
  name: string
  /** display 좌표(y-up) 기준 센서 설치 위치 */
  position: [number, number, number]
  /** factory 목록에서만 존재 — 소속 그룹 */
  group?: RealGroupKey
}

export interface RealBlockPlacement {
  /** CAD 인스턴스 이름 (예: '5510_726_FR84A') */
  name: string
  cadFile: string
  /** display 좌표 배치 행렬 (row-major 4×4) */
  matrix: number[]
  center: [number, number, number]
  bboxMin: [number, number, number]
  bboxMax: [number, number, number]
  /** [length, width, height] (m) */
  dims: [number, number, number]
  /** CAD 표면 → 점군 최근접 거리 중앙값 (cm) — 오프라인 검증 실측치 */
  fitErrorCm?: number
}

/** 수평 사각형 (display XZ) — 베이 담당구간·홀 바닥 */
export interface RealRect {
  min: [number, number]
  max: [number, number]
}

/** 베이(갠트리 담당구간) — 점군에서 유도한 사각형 + 갠트리 중심 */
export interface RealBayBand extends RealRect {
  /** 갠트리 라이다 4대의 평균 위치 (display, y-up) */
  gantry: [number, number, number]
}

export interface RealSceneMeta {
  cloud: string
  /** 점별 블록 라벨 bin — 값은 blocks 인덱스, 255 = 미분류 (UNLABELED) */
  labels: string
  /** 점별 CAD 표면 편차 bin — dist/tolerance×255 양자화, 255 = 미일치 (히트맵용) */
  deviations: string
  /**
   * 점별 의사 반사강도 bin (Uint8) — 국소 법선 × 센서 입사각 + 거리 감쇠.
   * 이 데이터셋은 intensity/RGB 가 전부 0 이라, 이 값을 곱하지 않으면 형상이
   * 평평한 색면으로 뭉개진다.
   */
  shade: string
  labeledPointCount: number
  /** FLOOR 로 분류된 바닥 점 수 */
  floorPointCount: number
  /** 세그멘테이션 방법·허용오차·블록별 일치 통계 */
  segmentation: {
    method: string
    toleranceM: number
    sampleSpacingM: number
    perBlock: Record<string, { candidates: number; matched: number }>
  }
  pointCount: number
  ranges: RealSensorRange[]
  sensors: RealSensorInfo[]
  blocks: RealBlockPlacement[]
  /** 원거리 산란점을 뺀 밀집 영역 (1~99 퍼센타일) — 높이 색상 정규화 기준 */
  bounds: { min: [number, number, number]; max: [number, number, number] }
}

/** 베이 뷰 — 해당 갠트리 담당구간만 실은 점군 */
export interface RealBayMeta extends RealSceneMeta {
  band: RealBayBand
}

export interface RealScanManifest {
  dataset: string
  scannedAt: string
  /** 홀 크롭 상자 (display) — 바닥 y=0 기준 */
  hall: { min: [number, number, number]; max: [number, number, number] }
  /** 베이 담당구간 — 세 개가 X 축을 따라 맞물린다 (겹치지 않는다) */
  bays: Record<RealGroupKey, RealBayBand>
  groups: Record<RealGroupKey, RealBayMeta>
  factory: RealSceneMeta
}

export interface RealCadMesh {
  name: string
  positions: number[]
  indices: number[]
  bboxMin: [number, number, number]
  bboxMax: [number, number, number]
}

const ASSET_BASE = publicAsset('/real-scan')

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${ASSET_BASE}/${path}`)
  if (!res.ok) throw new Error(`실측 스캔 자산 로드 실패: ${path} (HTTP ${res.status})`)
  return res.json() as Promise<T>
}

let manifestPromise: Promise<RealScanManifest> | null = null
export function loadRealScanManifest(): Promise<RealScanManifest> {
  manifestPromise ??= fetchJson<RealScanManifest>('manifest.json')
  return manifestPromise
}

let meshesPromise: Promise<RealCadMesh[]> | null = null
export function loadRealCadMeshes(): Promise<RealCadMesh[]> {
  meshesPromise ??= fetchJson<{ instances: RealCadMesh[] }>('cad_meshes.json').then(
    (d) => d.instances
  )
  return meshesPromise
}

export async function loadRealCloud(meta: RealSceneMeta): Promise<Float32Array> {
  const res = await fetch(`${ASSET_BASE}/${meta.cloud}`)
  if (!res.ok) throw new Error(`실측 점군 로드 실패: ${meta.cloud} (HTTP ${res.status})`)
  return new Float32Array(await res.arrayBuffer())
}

/** 점별 블록 라벨 — cloud 와 같은 순서의 Uint8 배열 */
export const UNLABELED = 255
/** 블록에 속하지 않은 바닥 점 — 색상 규칙이 배경으로 깔아 형상을 띄운다 */
export const FLOOR = 254
export async function loadRealLabels(meta: RealSceneMeta): Promise<Uint8Array> {
  const res = await fetch(`${ASSET_BASE}/${meta.labels}`)
  if (!res.ok) throw new Error(`실측 라벨 로드 실패: ${meta.labels} (HTTP ${res.status})`)
  return new Uint8Array(await res.arrayBuffer())
}

/** 점별 의사 반사강도 — cloud 와 같은 순서의 Uint8 배열 (0..255) */
export async function loadRealShade(meta: RealSceneMeta): Promise<Uint8Array> {
  const res = await fetch(`${ASSET_BASE}/${meta.shade}`)
  if (!res.ok) throw new Error(`실측 음영 로드 실패: ${meta.shade} (HTTP ${res.status})`)
  return new Uint8Array(await res.arrayBuffer())
}

/** 실측 location id 규약 'real5-g1' → manifest 그룹 키 'g1' */
export function realGroupKeyOf(locationId: string): RealGroupKey {
  return locationId.split('-').pop() as RealGroupKey
}
