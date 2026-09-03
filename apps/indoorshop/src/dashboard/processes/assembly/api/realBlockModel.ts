import type {
  BlockAssemblyEntry,
  BlockModelManifest,
  LoadedBlockModel,
} from '../../../shared/features/bay-viewer/model/blockModel'
import { loadRealCadMeshes, type RealCadMesh } from './realScanAssets'
import { realBlockParts, realWstgCode } from './realBlockFacts'

/*
 * 실측 13블록의 **형상 모델** — 목업 블록과 같은 계약(`LoadedBlockModel`)으로 편다.
 *
 * 왜 필요한가: 상세 카드의 360° 회전 미리보기(`AssemblyOrbitPreview`)는 모델과
 * `modelAssemblyIds` 로만 그린다. 실측 베이는 그 둘이 없어서 미리보기가 통째로 빠졌고,
 * 그래서 같은 화면에서 목업 블록은 돌아가고 실측 블록은 회색 칸으로 남았다 — 데이터가
 * 없어서가 아니라 **형상을 그 계약으로 편 적이 없어서**다. 실측 자산에는 블록별 CAD
 * 메시(`cad_meshes.json`, 13건)가 이미 들어 있다.
 *
 * ⚠️ 이 모델은 **상세 미리보기 전용**이다. 베이 3D 뷰어가 쓰는 `bayModel` 로 넘기지
 * 않는다 — 실측 씬은 점군이 정본이고 CAD 메시는 좌표 프레임이 달라, 뷰어에 얹으면
 * 형상이 엉뚱한 자리에 선다(그 판단은 `AssemblyWorkspace` 의 기존 주석 그대로다).
 */

/** 실측 메시의 호선 — 13블록이 5510 한 호선의 세 블록군(553·726·736)에 걸쳐 있다 */
const REAL_PROJ_NO = '5510'

/**
 * 안착 자세 — **가장 얇은 축을 세워** 넓은 면이 바닥을 향하게 눕힌다.
 *
 * 목업 모델은 전처리(FBX)가 면적 가중 지배 법선으로 `restQuat` 를 계산해 넣어 주지만,
 * 실측 CAD 메시에는 그 값이 없다. 형상 자체를 건드리지 않고 **표현 자세만** 목업과 같은
 * 규칙(넓은 면이 바닥)으로 맞춘다 — 미리보기에서 두 베이의 블록이 같은 눈높이로 선다.
 */
function restQuatFor(size: [number, number, number]): [number, number, number, number] {
  const thinnest = size.indexOf(Math.min(...size))
  /* 이미 Y 가 가장 얇으면 그대로 (항등) */
  if (thinnest === 1) return [0, 0, 0, 1]
  const half = Math.PI / 4 /* 90° 회전의 절반 */
  const s = Math.sin(half)
  const c = Math.cos(half)
  /* X 가 얇으면 Z 축으로, Z 가 얇으면 X 축으로 90° 돌려 그 축을 Y 로 세운다 */
  return thinnest === 0 ? [0, 0, s, c] : [s, 0, 0, c]
}

/** 회전한 AABB — 축 교환만 일어나므로 크기 성분을 바꿔 끼우면 된다 */
function rotatedBbox(
  min: [number, number, number],
  max: [number, number, number],
  thinnest: number
): { restBboxMin: [number, number, number]; restBboxMax: [number, number, number] } {
  const swap = (v: [number, number, number]): [number, number, number] =>
    thinnest === 0 ? [v[1], v[0], v[2]] : thinnest === 2 ? [v[0], v[2], v[1]] : v
  const a = swap(min)
  const b = swap(max)
  return {
    restBboxMin: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
    restBboxMax: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
  }
}

/** 인덱스 메시 → triangle soup (뷰어 계약은 인덱스 없는 position 배열이다) */
function toSoup(mesh: RealCadMesh): Float32Array {
  const out = new Float32Array(mesh.indices.length * 3)
  for (let i = 0; i < mesh.indices.length; i += 1) {
    const v = mesh.indices[i] * 3
    out[i * 3] = mesh.positions[v]
    out[i * 3 + 1] = mesh.positions[v + 1]
    out[i * 3 + 2] = mesh.positions[v + 2]
  }
  return out
}

let modelPromise: Promise<LoadedBlockModel> | null = null

/**
 * 실측 블록 모델 — 13블록이 각각 하나의 조립체(`BlockAssemblyEntry`)가 된다.
 * 조립체 id 는 **블록 이름 그대로**(`5510_726_SR1B`)라, detection 의 `modelAssemblyIds`
 * 가 그 이름 하나만 담으면 미리보기가 그 블록만 그린다.
 */
export function loadRealBlockModel(): Promise<LoadedBlockModel> {
  modelPromise ??= loadRealCadMeshes()
    .then((meshes) => buildRealBlockModel(meshes))
    .catch((error) => {
      modelPromise = null /* 실패한 약속을 캐시에 남기지 않는다 (자산 로더와 같은 규칙) */
      throw error
    })
  return modelPromise
}

/** 테스트 격리 — 모듈 캐시를 비운다 */
export function resetRealBlockModelCache(): void {
  modelPromise = null
}

/** 메시 목록을 뷰어 계약으로 — 순수 함수(테스트 대상) */
export function buildRealBlockModel(meshes: readonly RealCadMesh[]): LoadedBlockModel {
  const soups = meshes.map(toSoup)
  const total = soups.reduce((sum, soup) => sum + soup.length, 0)
  const positions = new Float32Array(total)

  let vertexCursor = 0
  const assemblies: BlockAssemblyEntry[] = meshes.map((mesh, index) => {
    const soup = soups[index]
    positions.set(soup, vertexCursor * 3)
    const vertexStart = vertexCursor
    const vertexCount = soup.length / 3
    vertexCursor += vertexCount

    const size: [number, number, number] = [
      mesh.bboxMax[0] - mesh.bboxMin[0],
      mesh.bboxMax[1] - mesh.bboxMin[1],
      mesh.bboxMax[2] - mesh.bboxMin[2],
    ]
    const thinnest = size.indexOf(Math.min(...size))
    const parts = realBlockParts(mesh.name)

    return {
      id: mesh.name,
      wstgCode: realWstgCode(mesh.name),
      partCount: parts.reduce((sum, part) => sum + part.partCount, 0),
      children: parts.map((part) => ({ ...part, children: [] })),
      vertexStart,
      vertexCount,
      bboxMin: mesh.bboxMin,
      bboxMax: mesh.bboxMax,
      restQuat: restQuatFor(size),
      ...rotatedBbox(mesh.bboxMin, mesh.bboxMax, thinnest),
    }
  })

  /* 블록 레벨 rest pose — 13블록을 감싸는 상자를 같은 규칙으로 눕힌다 */
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const mesh of meshes) {
    for (let i = 0; i < 3; i += 1) {
      min[i] = Math.min(min[i], mesh.bboxMin[i])
      max[i] = Math.max(max[i], mesh.bboxMax[i])
    }
  }
  const size: [number, number, number] = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  const thinnest = size.indexOf(Math.min(...size))

  const manifest: BlockModelManifest = {
    projNo: REAL_PROJ_NO,
    /* 13블록이 세 블록군에 걸쳐 있어 매니페스트 하나에 블록번호를 적을 수 없다 —
       이 모델은 미리보기용 컨테이너이고, 신원은 detection 각자가 들고 있다 */
    blkNo: '실측',
    wstgCode: realWstgCode(REAL_PROJ_NO),
    source: 'real-scan/cad_meshes.json',
    size,
    assemblies,
    restQuat: restQuatFor(size),
    ...rotatedBbox(min, max, thinnest),
  }

  return { manifest, positions }
}
