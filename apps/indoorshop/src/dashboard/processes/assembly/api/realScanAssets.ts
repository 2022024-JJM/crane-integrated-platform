import { publicAsset } from '../../../shared/lib/public-asset'
/**
 * 실측 PoC 데이터셋(20251220_150000) 자산 로더.
 *
 * `scripts/build-real-scan-assets.py` 가 만든 `public/real-scan/` 을 읽는다.
 * bin(점군·라벨·편차·음영)은 git 에 그대로 커밋돼 있다 (pull 만 받으면 뜬다).
 * **4종은 반드시 한 실행본이어야 한다** — 점 순서로만 이어져 있어 일부만 갱신하면
 * 조용히 어긋난다. 로드 때 `assertRealSceneConsistent` 가 이것을 검사한다.
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

/**
 * 실측 자산을 가져오는 통로 — **바꿔 끼울 수 있게 한 겹 둔다.**
 *
 * 이 자산들은 `public/real-scan/` 에 있고 상대 경로 `fetch` 로 온다. 브라우저에서는
 * 그것으로 충분하지만, **노드(테스트)에는 상대 경로를 풀 기준이 없어** `fetch` 가
 * TypeError 로 죽는다. 그 바람에 이 로더를 거치는 조립 집계(`fetchFactoryOverviews`)는
 * 노드에서 아예 실행되지 않았고, 화면 수치를 코드로 검증할 길이 없었다
 * (`.work/연계매트릭스.md` §5 가 남긴 제약).
 *
 * 그래서 통로를 주입 가능하게 연다. 기본은 지금까지와 같은 상대 경로 fetch 이고,
 * 테스트는 파일에서 읽는 통로를 끼운다 — **제품 동작은 그대로**다.
 */
export type RealScanAssetFetcher = (path: string) => Promise<unknown>

const defaultFetcher: RealScanAssetFetcher = async (path) => {
  const res = await fetch(`${ASSET_BASE}/${path}`)
  if (!res.ok) throw new Error(`실측 스캔 자산 로드 실패: ${path} (HTTP ${res.status})`)
  return res.json()
}

let assetFetcher: RealScanAssetFetcher = defaultFetcher

/**
 * 자산 통로를 바꾼다(테스트 전용). `null` 이면 기본(상대 경로 fetch)으로 되돌린다.
 * 통로를 바꾸면 이미 받아 둔 캐시도 함께 버린다 — 다른 자산을 보면서 옛 결과를 쓰면 안 된다.
 */
export function setRealScanAssetFetcher(next: RealScanAssetFetcher | null): void {
  assetFetcher = next ?? defaultFetcher
  manifestPromise = null
  meshesPromise = null
}

async function fetchJson<T>(path: string): Promise<T> {
  return (await assetFetcher(path)) as T
}

let manifestPromise: Promise<RealScanManifest> | null = null
export function loadRealScanManifest(): Promise<RealScanManifest> {
  /*
   * 실패한 약속을 캐시에 남기지 않는다 — 한 번 실패하면 그 프로세스 내내 같은 오류를
   * 되돌려 주고, 통로를 갈아 끼워도 소용이 없어진다.
   */
  manifestPromise ??= fetchJson<RealScanManifest>('manifest.json').catch((error) => {
    manifestPromise = null
    throw error
  })
  return manifestPromise
}

let meshesPromise: Promise<RealCadMesh[]> | null = null
export function loadRealCadMeshes(): Promise<RealCadMesh[]> {
  meshesPromise ??= fetchJson<{ instances: RealCadMesh[] }>('cad_meshes.json')
    .then((d) => d.instances)
    .catch((error) => {
      meshesPromise = null
      throw error
    })
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

/**
 * 점별 CAD 표면 편차 — cloud 와 같은 순서의 Uint8 배열.
 *
 * 값은 `거리 / segmentation.toleranceM × 255` 로 양자화돼 있고 **255 = 미일치**다.
 * 이 배열이 있으면 화면에서 임계를 낮출 때 **최근접 재계산이 필요 없다** — 바이트 비교
 * 한 번으로 끝난다(생성은 `scripts/build-real-scan-assets.py` 의 KD-tree, 빌드 타임).
 *
 * ⚠️ 그래서 **낮추는 방향만** 가능하다. 자산의 `toleranceM`(현 0.30m)보다 큰 임계는
 * 이 배열에 정보가 없어(전부 255 로 잘려 있다) 스크립트 재실행이 필요하다.
 */
export async function loadRealDeviations(meta: RealSceneMeta): Promise<Uint8Array> {
  const res = await fetch(`${ASSET_BASE}/${meta.deviations}`)
  if (!res.ok) throw new Error(`실측 편차 로드 실패: ${meta.deviations} (HTTP ${res.status})`)
  return new Uint8Array(await res.arrayBuffer())
}

/** 임계(m) → `deviations` 바이트 컷오프. 자산 허용오차를 넘는 값은 255(전량 통과)로 saturate */
export function deviationCutoff(toleranceM: number, meta: RealSceneMeta): number {
  const ratio = toleranceM / meta.segmentation.toleranceM
  return Math.max(0, Math.min(255, Math.round(ratio * 255)))
}

/**
 * 자산 4종(점군·라벨·편차·음영)이 **같은 변환 실행본**인지 검사한다.
 *
 * bin 은 점 순서로만 이어져 있어 길이가 어긋나도 뷰어는 아무 에러 없이 그린다 —
 * 음영이 엉뚱한 점에 곱해지고, 센서 구간이 점군 끝을 넘거나 못 미쳐 일부 점이
 * 아예 안 그려진다. 실제로 bin 과 manifest 를 서로 다른 실행에서 커밋한 적이
 * 있어서(점군은 옛 실행본, manifest·음영은 새 실행본) 화면만 보고는 원인을
 * 찾기 어려웠다. 그래서 로드 시점에 소리 내서 실패시킨다.
 */
export function assertRealSceneConsistent(
  meta: RealSceneMeta,
  cloud: Float32Array,
  labels: Uint8Array,
  shade: Uint8Array,
  deviations?: Uint8Array
): void {
  const cloudPoints = cloud.length / 3
  const mismatches: string[] = []
  if (cloudPoints !== meta.pointCount) {
    mismatches.push(`${meta.cloud} ${cloudPoints} ≠ manifest.pointCount ${meta.pointCount}`)
  }
  if (labels.length !== cloudPoints) {
    mismatches.push(`${meta.labels} ${labels.length} ≠ 점 수 ${cloudPoints}`)
  }
  if (shade.length !== cloudPoints) {
    mismatches.push(`${meta.shade} ${shade.length} ≠ 점 수 ${cloudPoints}`)
  }
  if (deviations && deviations.length !== cloudPoints) {
    mismatches.push(`${meta.deviations} ${deviations.length} ≠ 점 수 ${cloudPoints}`)
  }
  const rangeEnd = meta.ranges.reduce((end, range) => Math.max(end, range.start + range.count), 0)
  if (rangeEnd !== cloudPoints) {
    mismatches.push(`센서 구간 합 ${rangeEnd} ≠ 점 수 ${cloudPoints}`)
  }
  if (mismatches.length > 0) {
    throw new Error(
      `실측 스캔 자산이 서로 다른 변환 실행본이다 (${mismatches.join(' · ')}). ` +
        'public/real-scan/README.md 의 재생성 절차로 bin 을 한 번에 다시 만들어야 한다.'
    )
  }
}

/**
 * id 규약 `…-g1` → manifest 그룹 키 'g1'. 그룹 접미사가 아니면 null — 실측 정반
 * (PBS 5BAY, `asm-pbs-b5`)처럼 **홀 전체**를 가리키는 id 는 그룹이 없고, 뷰어는
 * null 을 받아 `manifest.factory`(홀 전체 장면)로 내려간다.
 */
export function realGroupKeyOf(locationId: string): RealGroupKey | null {
  const key = locationId.split('-').pop()
  return key === 'g1' || key === 'g2' || key === 'g3' ? key : null
}
