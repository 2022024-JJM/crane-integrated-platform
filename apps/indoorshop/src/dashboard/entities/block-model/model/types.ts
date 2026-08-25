/** 소조 이하 조립 계층 메타데이터 (geometry 없음, 트리만) */
export interface SubAssemblyMeta {
  id: string
  wstgCode: string
  partCount: number
  children: SubAssemblyMeta[]
}

/**
 * 안정 안착 자세(rest pose) — 전처리에서 면적 가중 지배 법선을 수직으로 세워 계산.
 * restQuat를 geometry에 적용하면 가장 넓은 면이 바닥을 향해 눕는다.
 * restBbox*는 그 회전을 적용한 좌표계 기준 AABB.
 */
export interface RestPose {
  restQuat: [number, number, number, number]
  restBboxMin: [number, number, number]
  restBboxMax: [number, number, number]
}

/** 중조 단위 조립체 — geometry(bin 내 위치)와 소조 트리를 함께 보유 */
export interface BlockAssemblyEntry extends SubAssemblyMeta, RestPose {
  /** .bin 안에서의 vertex 시작 위치 (position triplet 단위) */
  vertexStart: number
  vertexCount: number
  /** 블록 로컬 좌표(m, 바닥 중심 원점) 기준 AABB */
  bboxMin: [number, number, number]
  bboxMax: [number, number, number]
}

/**
 * FBX(RVM 익스포트)에서 전처리 스크립트로 추출한 블록 모델 매니페스트.
 * public/models/{projNo}_{blkNo}.json + .bin 페어로 저장된다.
 */
export interface BlockModelManifest extends RestPose {
  projNo: string
  blkNo: string
  wstgCode: string
  source: string
  /** 블록 전체 크기 [x, y, z] (m) */
  size: [number, number, number]
  assemblies: BlockAssemblyEntry[]
}

/** 매니페스트 + geometry 버퍼가 로드된 상태 */
export interface LoadedBlockModel {
  manifest: BlockModelManifest
  /** 전체 triangle soup positions (모든 조립체 연결) */
  positions: Float32Array
}

/** 특정 조립체의 position 버퍼 (복사 없는 subarray view) */
export function getAssemblyPositions(
  model: LoadedBlockModel,
  assembly: BlockAssemblyEntry
): Float32Array {
  return model.positions.subarray(
    assembly.vertexStart * 3,
    (assembly.vertexStart + assembly.vertexCount) * 3
  )
}

/** 여러 조립체의 triangle soup 병합 (1개면 복사 없는 view) */
export function getMergedAssemblyPositions(
  model: LoadedBlockModel,
  assemblyIds: string[]
): Float32Array {
  const entries = model.manifest.assemblies.filter((a) => assemblyIds.includes(a.id))
  if (entries.length === 0) return new Float32Array(0)
  if (entries.length === 1) return getAssemblyPositions(model, entries[0])
  const total = entries.reduce((s, e) => s + e.vertexCount * 3, 0)
  const out = new Float32Array(total)
  let off = 0
  for (const e of entries) {
    out.set(getAssemblyPositions(model, e), off)
    off += e.vertexCount * 3
  }
  return out
}

/**
 * detection이 참조하는 조립체(들)의 rest pose.
 * 단일 조립체(중조 인식)면 그 조립체의 것을, 여러 개(대조립 = 블록 전체)면
 * 블록 레벨(manifest)의 것을 사용한다.
 */
export function getRestPose(model: LoadedBlockModel, assemblyIds: string[]): RestPose {
  if (assemblyIds.length === 1) {
    const entry = model.manifest.assemblies.find((a) => a.id === assemblyIds[0])
    if (entry) return entry
  }
  return model.manifest
}

/** rest pose 기준 [가로(X), 높이(Y), 세로(Z)] extent */
export function restExtents(pose: RestPose): [number, number, number] {
  return [
    pose.restBboxMax[0] - pose.restBboxMin[0],
    pose.restBboxMax[1] - pose.restBboxMin[1],
    pose.restBboxMax[2] - pose.restBboxMin[2],
  ]
}

/** 여러 조립체의 블록 로컬 AABB 합집합 */
export function getAssembliesBBox(
  model: LoadedBlockModel,
  assemblyIds: string[]
): { min: [number, number, number]; max: [number, number, number] } | null {
  const entries = model.manifest.assemblies.filter((a) => assemblyIds.includes(a.id))
  if (entries.length === 0) return null
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const e of entries) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], e.bboxMin[i])
      max[i] = Math.max(max[i], e.bboxMax[i])
    }
  }
  return { min, max }
}
