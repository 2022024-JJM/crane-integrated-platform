export interface LidarHistoryEvent {
  timestamp: string
  event: string
  /** 해당 시점의 조립 진척률(%) — 라이다 관측 기반 추정치 */
  progress?: number
}

export interface LidarBlockDimensions {
  length: number
  width: number
  height: number
}

/**
 * position: 정반 좌표계(바닥 중심 원점) 기준 [x, y, z]
 * quaternion: [x, y, z, w] — 백엔드 연동 프로토콜 미확정, mock 단계에서 임의로 가정한 형식
 */
export interface LidarBlockTransform {
  position: [number, number, number]
  quaternion: [number, number, number, number]
}

/**
 * 조립 월간실행계획(ZPPT004_1/YPWS210V) 기준 계획 정보.
 *  - planStartDate/planEndDate: DETL_SD_PLN / DETL_FD_PLN (계획된 시작/종료)
 */
export interface AssemblyPlanInfo {
  planStartDate: string
  planEndDate: string
}

/**
 * 라이다 인식 파이프라인이 베이 안에서 감지한 조립 객체 하나.
 * 한 베이(정반)에서 여러 개가 동시에 감지될 수 있다.
 *
 * 용어는 옥포 레거시(GP 스키마) 기준:
 *  - projNo: 공사/호선번호 (PROJ_NO)
 *  - blkNo: 블록번호 (BLK_NO)
 *  - assySerNo: 조립 일련번호 (ASSY_SER_NO) — 블록 내부 중·소조립 단위 인식일 때만 존재,
 *    대조립(블록 단위) 인식이면 null. 끝자리 'Z'는 특수계열(SZ) 판정 지시자.
 *  - wstgCode: 송선기호 (WSTG_CODE, 4자리) — 앞 2자리 현공정(ASSY), 뒤 2자리 다음공정(NEXT)
 *  - cadRegistered: PCD↔CAD 도면 registering 성공 여부 — 실패 시 도면 매핑이 안 된
 *    PCD만 존재하는 상태이므로 화면에서 경고로 표시한다
 */
export interface LidarBlockInfo {
  id: string
  locationId: string
  projNo: string
  blkNo: string
  assySerNo: string | null
  blockName: string
  wstgCode: string
  cadRegistered: boolean
  plan: AssemblyPlanInfo | null
  confidence: number
  dimensions: LidarBlockDimensions
  transform: LidarBlockTransform
  history: LidarHistoryEvent[]
  /** 이 detection이 참조하는 블록 모델 조립체 id 목록 (viewer geometry 매핑용) */
  modelAssemblyIds?: string[]
  /** 소조 이하 구성 (CAD 계층에서 추출) + 작업 상태 */
  subAssemblies?: SubAssemblyStatus[]
}

export type SubAssemblyWorkStatus = 'not_started' | 'in_progress' | 'completed'

/** 하위 구성품의 작업 상태 — 작업중일 때만 진척률을 가진다 */
export interface SubAssemblyStatus {
  id: string
  wstgCode: string
  partCount: number
  workStatus: SubAssemblyWorkStatus
  /** workStatus가 in_progress일 때의 진척률(%) */
  progress?: number
}

/** 화면 표시용 계층 ID — '627-FR755'(조립품 단위) 또는 'BLK 627'(블록 단위) */
export function formatDetectionId(block: LidarBlockInfo): string {
  return block.assySerNo ? `${block.blkNo}-${block.assySerNo}` : `BLK ${block.blkNo}`
}

/**
 * 선택 승계 (W8-3) — `?block={projNo}-{blkNo}` 로 도착한 화면이 그 블록의 첫 detection 을
 * 고른다. 블록 단위 정반은 정확히 그 한 건이고, 중조 분해 정반은 같은 블록의 여러 조각
 * 중 첫 번째다(승계 단위가 블록이라 조각까지는 특정하지 않는다). 없으면 null — 승계는
 * 조용히 접히고 화면은 전체 뷰로 선다.
 */
export function detectionForBlockKey(
  blocks: readonly LidarBlockInfo[],
  key: string | null | undefined
): LidarBlockInfo | null {
  if (!key) return null
  return blocks.find((block) => `${block.projNo}-${block.blkNo}` === key) ?? null
}

/** 송선기호(WSTG_CODE) 4자리를 현공정/다음공정으로 분해 */
export function parseWstgCode(wstgCode: string): { current: string; next: string } {
  return { current: wstgCode.slice(0, 2), next: wstgCode.slice(2, 4) }
}

/** SZ_INDC — ASSY_SER_NO 끝자리 'Z'면 특수계열 */
export function isSpecialSeries(block: LidarBlockInfo): boolean {
  return block.assySerNo?.endsWith('Z') ?? false
}
