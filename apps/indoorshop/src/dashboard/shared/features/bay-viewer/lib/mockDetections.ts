import type {
  AssemblyPlanInfo,
  LidarBlockInfo,
  LidarBlockTransform,
  LidarHistoryEvent,
  SubAssemblyStatus,
} from '../model/lidarBlock'
import type { BlockAssemblyEntry, LoadedBlockModel } from '../model/blockModel'
import { restExtents } from '../model/blockModel'
import { BAY_WIDTH } from './bayConfig'

/*
 * 베이 mock 인식(detection) 생성 — 조립 1/2공장 mock 문법의 단일 소스.
 *
 * CAD 블록 모델 하나를 베이에 배정하면, unitLevel 에 따라 대조립(블록 전체 1건) 또는
 * 중조 단위(조립체별 분리 배치)로 결정론 detection 목록을 만든다. 원래
 * `processes/assembly/api/assemblyApi.ts` 안에 있던 것을 **그대로**(같은 해시 시드)
 * 들어 올린 것이다 — 조립 화면의 mock 값이 이 이동으로 달라지면 안 된다.
 *
 * 다른 공정(의장)이 같은 문법으로 mock 베이 장면을 만들 때 이 빌더를 재사용한다.
 * 명칭 몫(블록/조립체 이름)만 공정이 끼어들 수 있다(`labels`) — 기본값은 조립 문구다.
 */

/** 베이에 배정된 블록의 CAD 모델 + 정반 내 배치 transform */
export interface BayModelInfo {
  model: LoadedBlockModel
  placement: LidarBlockTransform
}

/** 문자열 기반 결정적 의사난수 (mock 신뢰도 등 렌더링마다 값이 흔들리지 않도록) */
function hashOf(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

function mockConfidence(id: string): number {
  return 0.78 + (hashOf(id) % 18) / 100 // 0.78 ~ 0.95
}

function mockPlan(id: string): AssemblyPlanInfo {
  const day = 10 + (hashOf(id) % 14)
  return {
    planStartDate: `07/${String(day).padStart(2, '0')}`,
    planEndDate: `08/${String((day % 12) + 1).padStart(2, '0')}`,
  }
}

/** detection의 현재 진척률(%) — mock 결정적 값 (45~94) */
function mockProgress(id: string): number {
  return 45 + (hashOf(`${id}-progress`) % 50)
}

/** 라이다 관측 기반 진척률이 붙은 인식 히스토리 (mock — 스캔 갱신마다 진척률 상승) */
function mockHistory(id: string, arrivalEvent: string): LidarHistoryEvent[] {
  const latest = mockProgress(id)
  return [
    { timestamp: '14:32', event: '스캔 갱신', progress: latest },
    { timestamp: '09:10', event: '스캔 갱신', progress: Math.max(5, latest - 16) },
    { timestamp: '07/31', event: arrivalEvent, progress: Math.max(3, latest - 33) },
  ]
}

/**
 * 하위 구성품 작업 상태 (mock) — 상위 진척률과 정합되게 생성:
 * 진척률이 높을수록 완료된 하위 구성품 비율이 높고, 경계 근처는 작업중(진척률 보유).
 */
function mockSubAssemblies(
  parentId: string,
  children: { id: string; wstgCode: string; partCount: number }[],
  parentProgress: number
): SubAssemblyStatus[] {
  const n = children.length
  return children.map((child, index) => {
    const slot = ((index + 0.5) / n) * 100
    const jitter = (hashOf(parentId + child.id) % 21) - 10
    const boundary = slot + jitter
    if (parentProgress >= boundary + 12) return { ...child, workStatus: 'completed' }
    if (parentProgress <= boundary - 12) return { ...child, workStatus: 'not_started' }
    const progress = Math.min(95, Math.max(5, Math.round(50 + (parentProgress - boundary) * 3)))
    return { ...child, workStatus: 'in_progress', progress }
  })
}

/** 조립체 id 기반의 미세한 yaw 회전 (분리 배치가 너무 정렬돼 보이지 않도록) */
function yawQuaternion(id: string): [number, number, number, number] {
  const angle = ((hashOf(id) % 9) - 4) * 0.025
  return [0, +Math.sin(angle / 2).toFixed(4), 0, +Math.cos(angle / 2).toFixed(4)]
}

/**
 * 중조립품 분리 배치 — 아직 블록으로 조립되기 전이므로 CAD 원위치가 아니라 정반 위에
 * 각각 떨어뜨려 놓는다 (면적 내림차순 shelf packing). 각 조립체 geometry는 viewer에서
 * 자기 bbox 바닥 중심 기준으로 재정렬된 뒤 이 위치에 놓인다.
 */
function layoutAssemblies(assemblies: BlockAssemblyEntry[]): Map<string, LidarBlockTransform> {
  const GAP = 2.5
  const usableWidth = BAY_WIDTH - 4

  // 안정 안착 자세(눕힌 상태)의 footprint 기준으로 배치
  const items = assemblies
    .map((a) => {
      const [w, , d] = restExtents(a)
      return { a, w, d }
    })
    .sort((p, q) => q.w * q.d - p.w * p.d)

  const raw = new Map<string, { x: number; z: number }>()
  let zCursor = 0
  let shelf: typeof items = []
  let shelfWidth = 0

  const flushShelf = () => {
    if (shelf.length === 0) return
    const totalWidth = shelfWidth - GAP
    const shelfDepth = Math.max(...shelf.map((i) => i.d))
    let x = -totalWidth / 2
    for (const item of shelf) {
      raw.set(item.a.id, { x: x + item.w / 2, z: zCursor + shelfDepth / 2 })
      x += item.w + GAP
    }
    zCursor += shelfDepth + GAP
    shelf = []
    shelfWidth = 0
  }

  for (const item of items) {
    if (shelf.length > 0 && shelfWidth + item.w > usableWidth) flushShelf()
    shelf.push(item)
    shelfWidth += item.w + GAP
  }
  flushShelf()

  // 전체 배치를 정반 중앙(z=0) 기준으로 정렬 — 센서 FOV 커버리지가 가장 좋은 영역에 놓이도록
  const totalDepth = zCursor - GAP
  const zOffset = -totalDepth / 2
  const placements = new Map<string, LidarBlockTransform>()
  for (const [id, pos] of raw) {
    placements.set(id, {
      position: [+pos.x.toFixed(2), 0, +(pos.z + zOffset).toFixed(2)],
      quaternion: yawQuaternion(id),
    })
  }
  return placements
}

function assemblyDimensions(assembly: BlockAssemblyEntry) {
  // 안정 안착 자세(눕힌 상태) 기준 치수
  const [length, height, width] = restExtents(assembly)
  return {
    length: +length.toFixed(1),
    width: +width.toFixed(1),
    height: +height.toFixed(1),
  }
}

/** 공정이 끼어드는 명칭 몫 — 생략하면 조립 문구(대조립 블록/중조립품) 그대로 */
export interface DetectionLabels {
  blockName?: (blkNo: string) => string
  assemblyName?: (assemblyId: string) => string
}

/**
 * 베이의 mock detection 목록 — unitLevel 'block'(대조 1건) / 'assembly'(중조 분리 배치).
 * 시드가 locationId·매니페스트 id 뿐이라 같은 입력이면 항상 같은 결과다.
 */
export function buildBayDetections(
  locationId: string,
  bayModel: BayModelInfo,
  unitLevel: 'assembly' | 'block',
  labels?: DetectionLabels
): LidarBlockInfo[] {
  const { model, placement } = bayModel
  const { manifest } = model
  // MISC(블록 직부재)와 소형 부속품(브라켓급 — PCD가 유의미하게 잡히지 않음)은 인식 단위에서 제외
  const assemblies = manifest.assemblies.filter(
    (a) => a.id !== 'MISC' && a.vertexCount >= 1500 && a.partCount >= 4
  )

  if (unitLevel === 'block') {
    // 대조립(블록) 단위 인식 — 블록 전체가 detection 1건
    const detection: LidarBlockInfo = {
      id: `${locationId}-${manifest.blkNo}`,
      locationId,
      projNo: manifest.projNo,
      blkNo: manifest.blkNo,
      assySerNo: null,
      blockName: labels?.blockName?.(manifest.blkNo) ?? `대조립 블록 ${manifest.blkNo}`,
      wstgCode: manifest.wstgCode,
      cadRegistered: true,
      plan: mockPlan(manifest.blkNo),
      confidence: mockConfidence(`${manifest.projNo}-${manifest.blkNo}`),
      dimensions: (() => {
        // 안정 안착 자세 기준 치수 (블록 레벨 rest pose)
        const [length, height, width] = restExtents(manifest)
        return {
          length: +length.toFixed(1),
          width: +width.toFixed(1),
          height: +height.toFixed(1),
        }
      })(),
      transform: placement,
      history: mockHistory(`${manifest.projNo}-${manifest.blkNo}`, '블록 반입 감지'),
      modelAssemblyIds: manifest.assemblies.map((a) => a.id), // MISC 포함 전체 형상
      subAssemblies: mockSubAssemblies(
        `${manifest.projNo}-${manifest.blkNo}`,
        assemblies.map((a) => ({ id: a.id, wstgCode: a.wstgCode, partCount: a.partCount })),
        mockProgress(`${manifest.projNo}-${manifest.blkNo}`)
      ),
    }
    return [detection]
  }

  // 중조립품 단위 인식 — 조립체마다 detection, 정반 위에 분리 배치
  const placements = layoutAssemblies(assemblies)
  return assemblies.map((assembly, index): LidarBlockInfo => {
    const detectionId = `${locationId}-${assembly.id}`
    return {
      id: detectionId,
      locationId,
      projNo: manifest.projNo,
      blkNo: manifest.blkNo,
      assySerNo: assembly.id,
      blockName: labels?.assemblyName?.(assembly.id) ?? `중조립품 ${assembly.id}`,
      wstgCode: assembly.wstgCode,
      // 데모: 두 번째 조립체는 PCD↔CAD registering 실패 상태 (도면 미매핑 PCD 케이스)
      cadRegistered: index !== 1,
      plan: mockPlan(detectionId),
      confidence: mockConfidence(detectionId),
      dimensions: assemblyDimensions(assembly),
      transform: placements.get(assembly.id)!,
      // 정합 실패 시 진척률 추정 불가 — 이벤트만 남긴다
      history:
        index !== 1
          ? mockHistory(detectionId, '정반 안착 감지')
          : mockHistory(detectionId, '정반 안착 감지').map(({ timestamp, event }) => ({
              timestamp,
              event,
            })),
      modelAssemblyIds: [assembly.id],
      subAssemblies: mockSubAssemblies(
        detectionId,
        assembly.children.map((c) => ({ id: c.id, wstgCode: c.wstgCode, partCount: c.partCount })),
        mockProgress(detectionId)
      ),
    }
  })
}
