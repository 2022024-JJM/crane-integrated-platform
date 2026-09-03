import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { TFunction } from 'i18next'
import type { InshopKey } from '../../../lib/i18n/keys'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { disposeRenderer, disposeScene } from '../lib/disposeScene'
import { startRenderLoop } from '../lib/renderLoop'
import { cn } from '../../../lib/utils'
import { useEscapeKey } from '../../../lib/useEscapeKey'
import type { LidarBlockInfo } from '../model/lidarBlock'
import { formatDetectionId } from '../model/lidarBlock'
import type { LidarSensor } from '../model/lidarSensor'
import type { Location } from '../../../entities/location/model/types'
import type { LoadedBlockModel } from '../model/blockModel'
import { getMergedAssemblyPositions, getRestPose } from '../model/blockModel'
import type { LidarBlockTransform } from '../model/lidarBlock'
import { simulateBaySurfaceScan } from '../lib/simulateLidarScan'
import type { ScanObstacle } from '../lib/simulateLidarScan'
import {
  sampleSurfacePoints,
  transformSamples,
  filterSamplesForSensor,
} from '../lib/sampleSurfacePoints'
import type { SurfaceSamples } from '../lib/sampleSurfacePoints'
import {
  paletteFor,
  showsPoints,
  showsCad,
  type ViewerDisplayMode,
  type ViewPalette,
} from '../lib/displayModes'
import {
  applyPointColors,
  type ColorableCloud,
  type PointKind,
} from '../lib/pointColorRules'
import type { PointColorMode } from '../lib/colorModes'
import {
  applyBlenderMouseBindings,
  bindModifierAwareButtons,
  setViewDirection,
  frameBox,
  captureHomePose,
  resetToHome,
  type HomePose,
  type ViewDirection,
} from '../lib/blenderControls'
import { projectAxes, type AxisViewState } from '../lib/axisGizmo'
import { makeLabelObject, createBlockLabel, createBayStatusLabel } from '../lib/labelCards'
import { createBackdrop } from '../lib/backdrop'
import type { FactoryLayout } from '../lib/bayLayout'
import type { RealScanOverlay } from '../model/realOverlay'
import {
  worstSensorStatus,
  sensorStatusCounts,
  bayWorkState,
  bayStage,
} from '../lib/bayStatusSummary'
import {
  emphasisFor,
  EMPHASIS_GEOMETRY_OPACITY,
  EMPHASIS_LABEL_OPACITY,
  type BaySelection,
} from '../lib/bayEmphasis'
import { tweenCameraTo } from '../lib/cameraTween'
import { edgePlacementFor } from '../lib/offscreenIndicator'
import { bindViewportFocus, clampPanToBounds } from '../lib/viewportInput'
import { isLowGpuMode, pixelRatioFor, subscribeQualityMode } from '../lib/qualityMode'
import { fitDistanceForBox } from '../lib/fitCamera'
import {
  LiveAxisGizmo,
  LiveOffscreenMarks,
  NO_OFFSCREEN_MARKS,
  type OffscreenMark,
} from './LiveViewportOverlay'
import { createViewportOverlayStore } from '../lib/viewportOverlayStore'
import { WheelZoomHint } from './WheelZoomHint'
import { SpinnerOverlay } from '../../../ui/atoms/Spinner'
import {
  splitComponents,
  sampleComponentSurfaces,
  subsetSoupByComponent,
  filterSamplesByPart,
} from '../lib/partComponents'
import {
  buildPointIndex,
  matchPartsToPoints,
  scoreMatch,
  type MatchSensor,
  type MatchAccuracy,
} from '../lib/cadPointMatch'
import {
  selectCompletedParts,
  detectionProgress,
  MISSING_COLOR,
  MISSING_FILL_OPACITY,
} from '../lib/progressStatus'
import {
  extractFeatureLines,
  createLineSegments,
  createCornerBrackets,
  createFloorFootprint,
  createFloorGrid,
  runFeatureLineQueue,
} from '../lib/outlineGeometry'
import {
  BAY_WIDTH,
  BAY_HEIGHT,
  BAY_LENGTH,
  JIG_HEIGHT,
  SENSOR_POINT_COLORS,
  SENSOR_MAX_RANGE,
} from '../lib/bayConfig'
import { getSensorPositions, SENSOR_TARGET } from '../lib/sensorLayout'
import { SENSOR_POLE_HEIGHT } from '../lib/bayConfig'

/** 베이에 배정된 블록 CAD 모델 + 정반 내 배치 */
export interface BayModelData {
  model: LoadedBlockModel
  placement: LidarBlockTransform
}

/** 뷰어가 렌더링하는 베이(정반) 하나의 데이터 묶음 */
export interface BaySceneData {
  location: Location
  sensors: LidarSensor[]
  blocks: LidarBlockInfo[]
  bayModel?: BayModelData | null
  /**
   * 실측 스캔 정반인가 — true 면 가짜 마커·합성 스캔을 만들지 않고 `realOverlay` 점군을
   * 기다린다. 판정(예: 조립 `isRealLocation`)은 공정 데이터 계층의 몫이다 — 뷰어는
   * 공정의 실측 자산 목록을 모른다.
   */
  realScan?: boolean
  /**
   * 실측 정반의 다운샘플 점군 — 센서 정합으로 베이 로컬에 앵커된 것.
   * null/생략 = 앵커 실패·미로드 — 빈 정반+실측 칩 폴백 그대로.
   */
  realOverlay?: RealScanOverlay | null
}

interface LidarPointCloudViewerProps {
  /** factory: 여러 정반을 배열해 공장 전체 센서퓨전 / bay: 단일 정반 (selectedBlockId 설정 시 블록 단독 뷰) */
  mode: 'factory' | 'bay'
  bays: BaySceneData[]
  selectedBlockId?: string | null
  /** 표시 모드 — scene 재구성 없이 전환된다 */
  displayMode?: ViewerDisplayMode
  /** 점군 색상 규칙 — scene 재구성 없이 전환된다 */
  colorMode?: PointColorMode
  /** 윤곽(특징선·코너 브래킷·풋프린트) 표시 */
  showOutline?: boolean
  /**
   * 공장 배치 (FR-3) — 베이 좌표·크기·통로 관계의 단일 출처. 뷰어는 이 값을 그대로
   * 그릴 뿐 배치를 스스로 정하지 않는다. 없으면 예전처럼 한 줄로 나열한다.
   */
  layout?: FactoryLayout | null
  onSelectBlock?: (blockId: string) => void
  /**
   * 공장 뷰의 지속 선택 정반 (FR-5) — 소유자는 화면(workspace)이다.
   * 선택 대상은 100%, 동일 공정 단계는 중간, 무관한 정반은 낮은 강도로 가라앉는다.
   */
  selectedBayId?: string | null
  /** 라벨 클릭(선택)·빈 공간 클릭·Esc(해제)로 선택이 바뀔 때 */
  onBaySelect?: (locationId: string | null) => void
  /** 이미 선택된 정반 라벨을 다시 클릭 — 정반 화면으로 들어간다 */
  onOpenBay?: (locationId: string) => void
  /**
   * 목록에서 가리키고 있는 정반 — 3D 쪽 경계선·라벨이 같이 켜진다.
   * 목록과 3D 가 같은 정반을 말하고 있다는 것을 보여주는 유일한 연결선이다.
   */
  highlightedBayId?: string | null
  /** 3D 쪽 정반 라벨에 손을 얹었을 때 — 목록 쪽 강조를 같은 값으로 맞춘다 */
  onHoverBay?: (locationId: string | null) => void
  /**
   * 필터에 걸린 정반 (FR-9) — 숨기지 않고 강하게 가라앉힌다. 판정은 화면(workspace)이
   * bayFilters 로 하고, 뷰어는 불투명도만 낮춘다.
   */
  dimmedBayIds?: ReadonlySet<string> | null
  /**
   * `선택 정반 맞춤` 재요청 신호 (FR-8 보조 액션) — 값이 오를 때마다 현재 선택
   * 정반으로 카메라를 다시 맞춘다. 선택 자체는 이미 맞춤을 유발하므로, 같은 정반을
   * 두고 카메라만 흘러갔을 때 상세 카드 버튼이 이 신호를 올린다.
   */
  fitRequest?: number
  /** 센서 카드 클릭으로 요청된 센서 인덱스와 반복 요청 식별자 */
  sensorFocus?: { index: number; request: number } | null
  /**
   * 뷰포트 크기 규칙 override.
   * 기본은 문서 안에 놓이는 고정 높이지만, 고정 화면에서는 부모 칸을 꽉 채워야 한다.
   * (크기 변화는 내부 ResizeObserver 가 카메라·렌더러에 그대로 반영한다)
   */
  className?: string
}

/** 탭에서 가리킨 정반의 경계선 색 — 두 모드 모두에서 바탕과 갈리는 밝은 주황 */
const BAY_HIGHLIGHT_COLOR = 0xffa347

/** 뷰포트 위 유리 버튼 공통 스타일 — 도움말 토글과 같은 결 */
const GLASS_BUTTON_CLASS =
  'rounded-inshop-md glass-panel px-2 py-1 text-2xs font-medium text-glass-foreground/80 transition-colors hover:bg-glass-hover hover:text-glass-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-glass-accent'

type LayerKey = 'floor' | 'labels' | 'blocks' | 'sensors' | 'status'

/** 레이어 토글 목록 (FR-3) — 바닥/경계 · 라벨 · 블록 · 라이다 · 상태 오버레이 */
const LAYER_OPTIONS: { key: LayerKey; labelKey: InshopKey }[] = [
  { key: 'floor', labelKey: 'viewer.layers.floor' },
  { key: 'labels', labelKey: 'viewer.layers.labels' },
  { key: 'blocks', labelKey: 'viewer.layers.blocks' },
  { key: 'sensors', labelKey: 'viewer.layers.sensors' },
  { key: 'status', labelKey: 'viewer.layers.status' },
]
const POINT_SIZE = 0.16
/** 화면 밖 표식이 가장자리에서 띄우는 여백(px) — 표식 pill 이 잘리지 않는 최소 거리 */
const OFFSCREEN_MARGIN = 30

/** 공장 뷰에서 정반 간 배치 간격(폭 방향) */
const BAY_PITCH = BAY_WIDTH + 10
/** 공장 뷰 다운샘플 배율 */
const FACTORY_DENSITY = 0.3

function createBayBoundary(color: number, width = BAY_WIDTH, length = BAY_LENGTH): THREE.LineSegments {
  const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(width, BAY_HEIGHT, length))
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 })
  const boundary = new THREE.LineSegments(geometry, material)
  boundary.position.y = BAY_HEIGHT / 2
  return boundary
}

/** 라이다 유닛 마커 — 베이스 + 기둥 + 퍽(puck) 형태 헤드 + 상태 색상 링 + 스캔 방향 콘 */
function createSensorMarker(
  position: THREE.Vector3,
  target: THREE.Vector3,
  color: THREE.ColorRepresentation,
  isOnline: boolean
): THREE.Group {
  const group = new THREE.Group()
  // 그룹 원점은 (0,0,0)이고 실제 본체는 자식 좌표에 있으므로 포커스 좌표를 별도 보존한다.
  group.userData.focusPosition = position.clone()
  const steel = new THREE.MeshLambertMaterial({ color: 0x5b6673 })
  const dark = new THREE.MeshLambertMaterial({ color: 0x232d3a })
  const ringColor = isOnline ? color : 0x475569

  // 바닥 베이스 + 기둥
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.55), steel)
  base.position.set(position.x, 0.06, position.z)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, position.y, 8), steel)
  pole.position.set(position.x, position.y / 2, position.z)
  group.add(base, pole)

  // 센서 헤드 (라이다 퍽) — 마운트 / 본체 / 발광 링 / 상단 캡
  const head = new THREE.Group()
  head.position.copy(position)
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.1, 8), dark)
  mount.position.y = 0.05
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 16), dark)
  body.position.y = 0.25
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.21, 0.1, 16),
    new THREE.MeshBasicMaterial({ color: ringColor })
  )
  ring.position.y = 0.25
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.06, 16), dark)
  cap.position.y = 0.43
  head.add(mount, body, ring, cap)
  group.add(head)

  // 스캔 방향 표시 콘 (online만) — 은은하게
  if (isOnline) {
    const dir = target.clone().sub(position).normalize()
    const coneLength = 2.6
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, coneLength, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    )
    // ConeGeometry는 +Y가 꼭짓점 — 꼭짓점이 센서 헤드 쪽에 오도록 -dir로 정렬
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate())
    cone.position.copy(position).addScaledVector(dir, coneLength / 2 + 0.3)
    group.add(cone)
  }

  return group
}

/**
 * 그룹 안 재질의 불투명도를 배율로 누른다 (FR-5 강조).
 * 원래 값은 `userData.baseOpacity` 에 잡아 두고 항상 base × 배율로 계산한다 —
 * 배율이 겹쳐 곱해져 원래 밝기를 잃는 것을 막는다. 여러 베이가 공유하는 재질
 * (CAD 솔리드·지그)은 베이별로 다르게 누를 수 없어 `emphasisExempt` 로 제외한다.
 */
function setGroupEmphasis(group: THREE.Object3D, factor: number): void {
  group.traverse((obj) => {
    const material = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
    if (!material) return
    for (const mat of Array.isArray(material) ? material : [material]) {
      if (mat.userData.emphasisExempt) continue
      if (mat.userData.baseOpacity === undefined) {
        mat.userData.baseOpacity = mat.opacity
        mat.userData.baseTransparent = mat.transparent
      }
      mat.opacity = (mat.userData.baseOpacity as number) * factor
      mat.transparent = factor < 1 ? true : (mat.userData.baseTransparent as boolean)
    }
  })
}

/**
 * 정점 색상 기반 점군.
 * 규칙 전환 시 geometry 는 그대로 두고 `color` 속성만 다시 쓰기 위해 vertexColors 를 쓴다.
 */
function createPoints(positions: Float32Array): THREE.Points {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(positions.length), 3))
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ size: POINT_SIZE, sizeAttenuation: true, vertexColors: true })
  )
}

/** 씬 빌드 결과를 색칠 대상으로 등록한다 */
function registerCloud(
  clouds: ColorableCloud[],
  hits: { positions: Float32Array; intensity: Float32Array },
  kind: PointKind,
  sensorIndex: number,
  detectionIndex: number
): THREE.Points {
  const points = createPoints(hits.positions)
  clouds.push({ points, kind, sensorIndex, detectionIndex, intensity: hits.intensity })
  return points
}

/** 미확인 요약 콜아웃 — 지시선과 함께 미확인 영역 중심에 뜬다 */
function createMissingCallout(
  count: number,
  percent: number,
  position: THREE.Vector3,
  t: TFunction
): CSS2DObject {
  const wrap = document.createElement('div')
  wrap.className = 'flex flex-col items-center'
  wrap.innerHTML = `
    <div class="rounded-inshop-md glass-panel px-1.5 py-0.5">
      <span class="whitespace-nowrap font-mono text-2xs font-semibold text-glass-unhealthy">${t('viewer.missingCallout', { count, percent })}</span>
    </div>
    <div class="h-3 w-px bg-glass-unhealthy/70"></div>
  `
  return makeLabelObject(wrap, position)
}

/**
 * detection의 배치 행렬 — 전처리에서 계산된 안정 안착 자세(restQuat: 가장 넓은 면이
 * 바닥을 향하는 회전)로 눕히고, 그 자세의 bbox(restBbox) 바닥 중심을 기준으로 재정렬한 뒤
 * detection.transform 위치의 핀지그(JIG_HEIGHT) 위에 안착시킨다.
 * 중조는 각자 정반 위에 분리 배치되고, 대조립(블록 전체)도 동일하게 눕혀서 놓인다.
 */
function detectionMatrix(
  model: LoadedBlockModel,
  block: LidarBlockInfo
): {
  matrix: THREE.Matrix4
  /** 배치(placement) 제외, 눕히기+재정렬만 적용하는 로컬 행렬 — 높이맵 계산용 */
  localMatrix: THREE.Matrix4
  recenteredBBox: { min: [number, number, number]; max: [number, number, number] }
} | null {
  if (!block.modelAssemblyIds) return null
  const rest = getRestPose(model, block.modelAssemblyIds)

  const cx = (rest.restBboxMin[0] + rest.restBboxMax[0]) / 2
  const cz = (rest.restBboxMin[2] + rest.restBboxMax[2]) / 2
  const minY = rest.restBboxMin[1]

  const localMatrix = new THREE.Matrix4()
    .makeTranslation(-cx, -minY + JIG_HEIGHT, -cz)
    .multiply(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion(...rest.restQuat)))

  const matrix = new THREE.Matrix4()
    .compose(
      new THREE.Vector3(...block.transform.position),
      new THREE.Quaternion(...block.transform.quaternion),
      new THREE.Vector3(1, 1, 1)
    )
    .multiply(localMatrix)

  return {
    matrix,
    localMatrix,
    recenteredBBox: {
      min: [rest.restBboxMin[0] - cx, JIG_HEIGHT, rest.restBboxMin[2] - cz],
      max: [
        rest.restBboxMax[0] - cx,
        rest.restBboxMax[1] - minY + JIG_HEIGHT,
        rest.restBboxMax[2] - cz,
      ],
    },
  }
}

/** 하부면 높이맵 — (x,z) 1m 격자별 geometry 최저 y (detection 로컬 프레임 기준) */
const JIG_CELL = 1.0

interface BottomHeightmap {
  minX: number
  minZ: number
  nx: number
  nz: number
  data: Float32Array
}

/**
 * 표면 샘플(로컬 프레임) 기반 하부 높이맵 — vertex가 아니라 표면 위 점들을 쓰므로
 * 대형 판재 한가운데 셀도 값이 채워진다.
 */
function buildBottomHeightmap(
  localPositions: Float32Array,
  bbox: { min: [number, number, number]; max: [number, number, number] }
): BottomHeightmap {
  const minX = bbox.min[0]
  const minZ = bbox.min[2]
  const nx = Math.max(1, Math.ceil((bbox.max[0] - minX) / JIG_CELL))
  const nz = Math.max(1, Math.ceil((bbox.max[2] - minZ) / JIG_CELL))
  const data = new Float32Array(nx * nz).fill(Infinity)

  for (let i = 0; i < localPositions.length; i += 3) {
    const ix = Math.min(nx - 1, Math.max(0, Math.floor((localPositions[i] - minX) / JIG_CELL)))
    const iz = Math.min(nz - 1, Math.max(0, Math.floor((localPositions[i + 2] - minZ) / JIG_CELL)))
    const idx = ix * nz + iz
    if (localPositions[i + 1] < data[idx]) data[idx] = localPositions[i + 1]
  }

  return { minX, minZ, nx, nz, data }
}

/**
 * (x,z) 지점의 하부면 높이 — 핀이 표면에 정확히 닿도록 자기 셀 값을 우선 사용하고,
 * 자기 셀이 비어 있을 때만 주변으로 확장해 찾는다 (주변 최소값을 쓰면 핀이 짧아져 안 닿음).
 */
function sampleBottomHeight(hm: BottomHeightmap, x: number, z: number): number | null {
  const ix = Math.floor((x - hm.minX) / JIG_CELL)
  const iz = Math.floor((z - hm.minZ) / JIG_CELL)
  const at = (jx: number, jz: number): number =>
    jx >= 0 && jx < hm.nx && jz >= 0 && jz < hm.nz ? hm.data[jx * hm.nz + jz] : Infinity

  const center = at(ix, iz)
  if (Number.isFinite(center)) return center

  for (let r = 1; r <= 2; r++) {
    let best = Infinity
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const y = at(ix + dx, iz + dz)
        if (y < best) best = y
      }
    }
    if (Number.isFinite(best)) return best
  }
  return null
}

const JIG_COLOR = 0x46525f
/** 핀 최대 연장 높이 — 이보다 높은 하부(돌출 구조 아래)는 지지하지 않는다 */
const JIG_MAX_REACH = JIG_HEIGHT + 3

/**
 * 핀지그 기둥들 — detection footprint 아래에 격자로 깔리되, 실제 핀지그처럼
 * 핀마다 높이를 개별 조절해 곡면 하부면에 닿는다 (하부 높이맵 기반).
 * 형상이 없는 격자점(footprint 밖 오목 영역)에는 핀을 세우지 않는다.
 */
interface JigPin {
  x: number
  z: number
  height: number
}

function createJigPosts(
  recenteredBBox: { min: [number, number, number]; max: [number, number, number] },
  transform: LidarBlockTransform,
  material: THREE.Material,
  heightmap: BottomHeightmap
): { group: THREE.Group; pins: JigPin[] } {
  const inset = 0.6
  const spacing = 3
  const minX = recenteredBBox.min[0] + inset
  const maxX = recenteredBBox.max[0] - inset
  const minZ = recenteredBBox.min[2] + inset
  const maxZ = recenteredBBox.max[2] - inset
  const nx = Math.max(2, Math.round((maxX - minX) / spacing) + 1)
  const nz = Math.max(2, Math.round((maxZ - minZ) / spacing) + 1)

  // 단위 높이(1m) 실린더를 바닥 기준으로 만들어두고 인스턴스마다 y 스케일로 높이 조절
  const geometry = new THREE.CylinderGeometry(0.13, 0.2, 1, 8)
  geometry.translate(0, 0.5, 0)

  const posts = new THREE.InstancedMesh(geometry, material, nx * nz)
  const m = new THREE.Matrix4()
  const pos = new THREE.Vector3()
  const rot = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  const pins: JigPin[] = []
  let i = 0
  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < nz; iz++) {
      const x = nx === 1 ? (minX + maxX) / 2 : minX + (ix * (maxX - minX)) / (nx - 1)
      const z = nz === 1 ? (minZ + maxZ) / 2 : minZ + (iz * (maxZ - minZ)) / (nz - 1)

      const bottom = sampleBottomHeight(heightmap, x, z)
      if (bottom === null || bottom > JIG_MAX_REACH) continue

      // 표면에 확실히 닿도록 약간의 겹침을 준다
      const height = Math.max(0.3, bottom + 0.04)
      m.compose(pos.set(x, 0, z), rot, scale.set(1, height, 1))
      posts.setMatrixAt(i++, m)
      pins.push({ x, z, height })
    }
  }
  posts.count = i

  const group = new THREE.Group()
  group.position.set(...transform.position)
  group.quaternion.set(...transform.quaternion)
  group.add(posts)
  return { group, pins }
}

/**
 * 핀지그 표면의 라이다 스캔 샘플 — 라이다는 지그도 당연히 투사하므로
 * 핀 측면에 point를 생성해 registered PCD에 포함시킨다 (정반 좌표계 기준).
 */
function sampleJigPoints(pins: JigPin[], transform: LidarBlockTransform): SurfaceSamples {
  const q = new THREE.Quaternion(...transform.quaternion)
  const t = new THREE.Vector3(...transform.position)
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  const positions: number[] = []
  const normals: number[] = []

  for (const pin of pins) {
    const count = Math.max(10, Math.round(pin.height * 55))
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const y = Math.random() * pin.height
      // 테이퍼 반영 (하단 0.2 → 상단 0.13)
      const r = 0.2 + (0.13 - 0.2) * (y / pin.height)
      p.set(pin.x + r * Math.cos(theta), y, pin.z + r * Math.sin(theta))
        .applyQuaternion(q)
        .add(t)
      n.set(Math.cos(theta), 0, Math.sin(theta)).applyQuaternion(q)
      positions.push(p.x, p.y, p.z)
      normals.push(n.x, n.y, n.z)
    }
  }

  return { positions: new Float32Array(positions), normals: new Float32Array(normals) }
}

/**
 * 바닥 스캔 점의 의사 반사강도 — 바닥 법선은 +Y 이므로 입사각은 레이의 수직 성분,
 * 여기에 거리 감쇠를 곱한다.
 */
function floorHits(
  positions: Float32Array,
  sensorPosition: THREE.Vector3
): { positions: Float32Array; intensity: Float32Array } {
  const intensity = new Float32Array(positions.length / 3)
  for (let i = 0, k = 0; i < positions.length; i += 3, k++) {
    const dx = positions[i] - sensorPosition.x
    const dy = positions[i + 1] - sensorPosition.y
    const dz = positions[i + 2] - sensorPosition.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
    const incidence = Math.abs(dy) / dist
    intensity[k] = incidence * (1 - Math.min(0.75, dist / SENSOR_MAX_RANGE))
  }
  return { positions, intensity }
}

export function LidarPointCloudViewer({
  mode,
  bays,
  selectedBlockId = null,
  displayMode = 'overlay',
  colorMode = 'sensor',
  showOutline = true,
  layout = null,
  onSelectBlock,
  selectedBayId = null,
  onBaySelect,
  onOpenBay,
  highlightedBayId = null,
  onHoverBay,
  dimmedBayIds = null,
  fitRequest = 0,
  sensorFocus = null,
  className,
}: LidarPointCloudViewerProps) {
  const { t, i18n } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)

  // 콜백은 ref로 우회해 scene 재구성 없이 최신 핸들러를 유지
  const onSelectBlockRef = useRef(onSelectBlock)
  onSelectBlockRef.current = onSelectBlock
  const onBaySelectRef = useRef(onBaySelect)
  onBaySelectRef.current = onBaySelect
  const onOpenBayRef = useRef(onOpenBay)
  onOpenBayRef.current = onOpenBay
  const onHoverBayRef = useRef(onHoverBay)
  onHoverBayRef.current = onHoverBay
  const selectedBayIdRef = useRef(selectedBayId)
  selectedBayIdRef.current = selectedBayId
  /* 조작 포커스 핸들 — 문서 레벨 ESC 가 이펙트 밖에서 부를 수 있게 밖으로 낸다 */
  const focusApiRef = useRef<ReturnType<typeof bindViewportFocus> | null>(null)

  /*
   * ESC — 선택이 있으면 먼저 해제(FR-5), 없으면 조작 포커스 해제(FR-6).
   *
   * **커서·포커스 조건을 걸지 않는다.** 예전에는 "커서가 뷰포트 위에 있거나 이미 무언가를
   * 골랐을 때"만 들었는데, 그러면 딥링크로 막 연 화면에서 첫 ESC 가 죽는다 — 아직 아무
   * 데도 클릭하지 않았고 커서도 지나간 적이 없다. 문서 레벨에서 받되, 풀 것이 하나도
   * 없으면 `false` 로 흘려보내 바깥 단계(드릴다운 ESC 등)가 이어받게 한다.
   */
  useEscapeKey(
    useCallback(() => {
      if (mode === 'factory' && selectedBayIdRef.current) {
        onBaySelectRef.current?.(null)
        return true
      }
      if (focusApiRef.current?.isFocused()) {
        focusApiRef.current.blur()
        return true
      }
      return false
    }, [mode])
  )

  /**
   * 씬 빌드 결과 등록부.
   * 모드·규칙 전환은 씬 빌드 effect 를 다시 돌리지 않는다 — 여기 등록된 것들의
   * 재질·가시성·색만 applyDisplay() 가 갱신한다.
   */
  const sceneRefs = useRef<{
    scene: THREE.Scene
    hemi: THREE.HemisphereLight
    dir: THREE.DirectionalLight
    cadMaterial: THREE.MeshLambertMaterial
    cadMeshes: THREE.Mesh[]
    clouds: ColorableCloud[]
    pointGroups: THREE.Group[]
    sensorMarkers: THREE.Object3D[]
    /** 특징선·코너 브래킷·풋프린트 (윤곽 토글 대상) */
    outlines: THREE.LineSegments[]
    /** 인식 범위 표시선 — 정합 여부에 따라 색이 갈리고, 모드별로 밝기를 맞춘다 */
    markers: { lines: THREE.LineSegments; registered: boolean }[]
    /** 핀지그 — 도면 요소가 아니므로 CAD 모드에서 숨긴다 */
    jigGroups: THREE.Group[]
    /** 미확인 부재 채움 */
    diffFills: THREE.Mesh[]
    /** 미확인 부재 관통 윤곽 */
    diffEdges: THREE.LineSegments[]
    /** 미확인 요약 콜아웃 */
    callouts: CSS2DObject[]
    /** 베이 경계선 — 모드별 색만 바뀐다 */
    boundaries: THREE.LineSegments[]
    /**
     * 공장 뷰 정반별 시각 요소 등록부 — hover 강조, 선택/동일 공정 강조(FR-5),
     * 레이어 토글(FR-3)이 전부 여기 등록된 것만 만진다 (geometry 재생성 없음).
     */
    bayVisuals: {
      locationId: string
      /** 표시명 — 화면 밖 표식(FR-9)이 이름으로 방향을 말한다 */
      name: string
      /** 이 베이의 현재 공정 단계 — 동일 stage 강조 비교 키 */
      stage: string | null
      group: THREE.Group
      boundary: THREE.LineSegments | null
      /** 라벨 래퍼(불투명도 조절)와 카드(테두리 강조) */
      labelWrap: HTMLElement | null
      labelCard: HTMLElement | null
      label: CSS2DObject | null
      statusOverlay: THREE.Mesh | null
      error: boolean
      /** 이상(오류·오프라인) 여부 — 화면 밖 표식 대상 */
      failing: boolean
    }[]
    /** 베이 바닥 판 — 모드별 색만 바뀐다 (FR-2 바닥 면 / FR-4 깊이 표현) */
    floors: THREE.Mesh[]
    /** 바닥 그리드 — 모드마다 밝기만 달라진다 */
    grids: THREE.LineSegments[]
    /** 모드별 배경 텍스처 캐시 (키: 위-아래 색 조합) */
    backdrops: Map<string, THREE.CanvasTexture>
    /** 특징선 재질 — 모드별 색/불투명도 갱신 대상 */
    edgeMaterials: THREE.LineBasicMaterial[]
    minY: number
    maxY: number
  } | null>(null)

  const displayRef = useRef({ displayMode, colorMode, showOutline })
  displayRef.current = { displayMode, colorMode, showOutline }

  const highlightRef = useRef(highlightedBayId)
  highlightRef.current = highlightedBayId

  const dimmedRef = useRef(dimmedBayIds)
  dimmedRef.current = dimmedBayIds

  /** 화면 밖 이상 정반 표식 (FR-9) — 카메라가 움직일 때마다 다시 계산된다 */
  /*
   * 기즈모·화면 밖 표식은 카메라 속도로 바뀐다 — React 상태에 담으면 그 속도가 곧
   * 뷰어 전체의 리렌더가 된다. 상태 밖 저장소에 두고 잎 컴포넌트만 구독한다
   * (`lib/viewportOverlayStore` 주석 참조).
   */
  const marksStore = useRef(
    createViewportOverlayStore<readonly OffscreenMark[]>(NO_OFFSCREEN_MARKS)
  ).current
  /** 씬 빌드가 만든 오버레이 재계산 함수 — 필터 변경 등 카메라 밖 요인이 이걸 부른다 */
  const refreshOverlayRef = useRef<(() => void) | null>(null)
  /*
   * 장면을 고친 쪽이 "한 장 더 그려 달라"고 말하는 통로.
   *
   * 그리기 루프는 카메라가 멈추면 쉰다(`lib/renderLoop`). 재질 색·가시성처럼 카메라와
   * 무관한 변경은 루프가 알 수 없으므로 여기로 알린다 — 빠뜨리면 그 변경이 다음 카메라
   * 조작 때까지 화면에 안 나타난다.
   */
  const requestRenderRef = useRef<(() => void) | null>(null)

  /** 현재 선택(베이 + 그 공정 단계) — 강조 계산의 기준 (FR-5) */
  const selectionRef = useRef<BaySelection | null>(null)
  /** 진행 중인 카메라 전환 — 사용자가 직접 조작을 시작하면 끊는다 */
  const tweenCancelRef = useRef<(() => void) | null>(null)

  /** 레이어 토글 (FR-3) — 바닥·라벨·블록·라이다·상태 오버레이를 독립 제어한다 */
  const [layers, setLayers] = useState({
    floor: true,
    labels: true,
    blocks: true,
    sensors: true,
    status: true,
  })
  const layersRef = useRef(layers)
  layersRef.current = layers
  const [layersOpen, setLayersOpen] = useState(false)
  const [wheelHint, setWheelHint] = useState(false)
  const wheelHintTimer = useRef(0)

  /**
   * 씬을 세우는 동안임을 나타내는 플래그.
   *
   * 정반을 옮기면 데이터 로딩(수십 ms)보다 **씬 빌드**(부재 분해·표본·특징선,
   * 수백 ms)가 훨씬 길다. 그동안 메인 스레드가 잡혀 있어서 화면은 이전 정반을
   * 그대로 보여주는데, 사용자 눈에는 클릭이 씹힌 것으로 보인다.
   */
  const [building, setBuilding] = useState(true)
  /**
   * 빌드 요청 번호.
   * 값이 오르면 아래 빌드 effect 가 다시 돈다 — 입력(mode·bays·선택 블록)이
   * 바뀐 **다음 프레임**에 올려서, 스피너가 먼저 그려질 틈을 만든다.
   */
  const [buildRequest, setBuildRequest] = useState(0)

  /** 기즈모·맞춤 버튼이 조작할 카메라 — 씬 빌드가 끝나야 생긴다 */
  const viewApiRef = useRef<{
    camera: THREE.PerspectiveCamera
    controls: OrbitControls
    home: HomePose
    sceneBox: THREE.Box3
  } | null>(null)
  const axisStore = useRef(createViewportOverlayStore<AxisViewState | null>(null)).current

  const handleAxisSelect = useCallback((direction: ViewDirection) => {
    const api = viewApiRef.current
    if (!api) return
    setViewDirection(api.camera, api.controls, direction)
  }, [])

  /** 화면을 열었을 때의 시점으로 되돌린다 (기즈모 버튼 · Home 키 공통) */
  const handleGoHome = useCallback(() => {
    const api = viewApiRef.current
    if (!api) return
    resetToHome(api.camera, api.controls, api.home)
  }, [])

  /** 대상 box 로 부드럽게 이동 — 보던 방향은 유지하고 거리만 맞춘다 (FR-4) */
  const fitBoxTweened = useCallback((box: THREE.Box3, padding = 1.08) => {
    const api = viewApiRef.current
    if (!api || box.isEmpty()) return
    const center = box.getCenter(new THREE.Vector3())
    const direction = api.camera.position.clone().sub(api.controls.target)
    if (direction.lengthSq() < 1e-6) direction.set(1, 1, 1)
    direction.normalize()
    const distance = Math.max(
      fitDistanceForBox(box, direction, api.camera.fov, api.camera.aspect, padding),
      api.controls.minDistance
    )
    tweenCancelRef.current?.()
    tweenCancelRef.current = tweenCameraTo(api.camera, api.controls, {
      position: center.clone().addScaledVector(direction, distance),
      target: center,
    })
  }, [])

  /** `전체 맞춤` (FR-4) */
  const handleFitAll = useCallback(() => {
    const api = viewApiRef.current
    if (api) fitBoxTweened(api.sceneBox)
  }, [fitBoxTweened])

  /** `선택 베이 맞춤` (FR-4) — 선택이 없으면 버튼 자체가 뜨지 않는다 */
  const handleFitSelected = useCallback(() => {
    const refs = sceneRefs.current
    const bay = refs?.bayVisuals.find((entry) => entry.locationId === selectedBayIdRef.current)
    if (bay) fitBoxTweened(new THREE.Box3().setFromObject(bay.group), 1.3)
  }, [fitBoxTweened])

  /** `기본 시점 복원` (FR-4) — Home 과 같은 자리로 가되 부드럽게 */
  const handleResetView = useCallback(() => {
    const api = viewApiRef.current
    if (!api) return
    tweenCancelRef.current?.()
    tweenCancelRef.current = tweenCameraTo(api.camera, api.controls, {
      position: api.home.position,
      target: api.home.target,
    })
  }, [])

  /**
   * 정반별 강조를 한 번에 계산한다 — 선택/동일 공정/무관(FR-5), 목록 hover, 오류 상태.
   * geometry·재질 재생성 없이 불투명도·색·라벨 스타일만 만진다.
   */
  const applyBayEmphasis = useCallback(() => {
    const refs = sceneRefs.current
    if (!refs) return
    const palette = paletteFor(displayRef.current.displayMode)
    const hovered = highlightRef.current
    const selection = selectionRef.current

    const dimmed = dimmedRef.current

    for (const bay of refs.bayVisuals) {
      const tier = emphasisFor(bay.locationId, bay.stage, selection)
      let geometryFactor = EMPHASIS_GEOMETRY_OPACITY[tier]
      let labelFactor = EMPHASIS_LABEL_OPACITY[tier]
      /* 필터에 걸린 정반(FR-9)은 무관 대상보다 더 가라앉는다 — 자리만 남긴다 */
      if (dimmed?.has(bay.locationId)) {
        geometryFactor = Math.min(geometryFactor, 0.1)
        labelFactor = Math.min(labelFactor, 0.28)
      }
      /* 오류 베이는 가라앉히지 않는다 — 알람이 강조·필터 문법보다 우선한다 (FR-2) */
      if (bay.error) {
        geometryFactor = Math.max(geometryFactor, 0.85)
        labelFactor = Math.max(labelFactor, 0.95)
      }

      setGroupEmphasis(bay.group, geometryFactor)

      const isHovered = bay.locationId === hovered
      const isSelected = tier === 'selected'
      if (bay.boundary) {
        const material = bay.boundary.material as THREE.LineBasicMaterial
        material.color.setHex(
          isSelected || isHovered ? BAY_HIGHLIGHT_COLOR : palette.boundaryColor
        )
        material.opacity = isSelected ? 1 : isHovered ? 0.9 : 0.6 * geometryFactor
      }
      // 라벨은 CSS2D(DOM)라 Tailwind 대신 토큰을 직접 쓴다
      if (bay.labelWrap) bay.labelWrap.style.opacity = String(labelFactor)
      if (bay.labelCard) {
        bay.labelCard.style.boxShadow = isSelected
          ? '0 0 0 2px var(--glass-accent)'
          : isHovered
            ? '0 0 0 2px var(--accent)'
            : ''
      }
    }

    /* 색·불투명도만 바꿨어도 한 장은 다시 그려야 보인다(루프는 카메라만 본다) */
    requestRenderRef.current?.()
  }, [])

  /** 재질·가시성·색만 갱신한다 (geometry 유지) */
  const applyDisplay = useCallback(() => {
    const refs = sceneRefs.current
    if (!refs) return
    const { displayMode: dm, colorMode: cm, showOutline: so } = displayRef.current
    const ly = layersRef.current
    const palette: ViewPalette = paletteFor(dm)

    if (palette.backgroundTop === palette.background) {
      refs.scene.background = new THREE.Color(palette.background)
    } else {
      const key = `${palette.backgroundTop}-${palette.background}`
      let backdrop = refs.backdrops.get(key)
      if (!backdrop) {
        backdrop = createBackdrop(palette.backgroundTop, palette.background)
        refs.backdrops.set(key, backdrop)
      }
      refs.scene.background = backdrop
    }
    refs.hemi.color.setHex(palette.hemiSky)
    refs.hemi.groundColor.setHex(palette.hemiGround)
    refs.hemi.intensity = palette.hemiIntensity
    refs.dir.intensity = palette.dirIntensity

    refs.cadMaterial.color.setHex(palette.cadColor)
    refs.cadMaterial.opacity = palette.cadOpacity
    refs.cadMaterial.transparent = palette.cadOpacity < 1
    refs.cadMaterial.depthWrite = palette.cadDepthWrite
    refs.cadMaterial.needsUpdate = true

    const cadVisible = showsCad(dm)

    /*
     * 빨간 diff 는 `색상 = 진척` 이고 표시 모드가 `점군` 이 아닐 때만 낸다.
     * diff 는 윤곽 토글과 무관하다 — 윤곽은 형상 판독 옵션이고 diff 는 판정 결과의 본체다.
     */
    const diffActive = cm === 'progress' && dm !== 'pcd'

    /*
     * 겹쳐보기 + 진척에서는 확인된 부재의 CAD 를 감춘다.
     * 있는 부재는 점군이 이미 보여주므로, CAD 로 덮으면 대비만 흐려진다.
     */
    const presentVisible = cadVisible && ly.blocks && !(diffActive && dm === 'overlay')
    for (const mesh of refs.cadMeshes) mesh.visible = presentVisible

    for (const fill of refs.diffFills) {
      fill.visible = diffActive && ly.blocks
      const material = fill.material as THREE.MeshLambertMaterial
      material.opacity = dm === 'cad' ? MISSING_FILL_OPACITY.cad : MISSING_FILL_OPACITY.overlay
      material.userData.baseOpacity = material.opacity
    }
    for (const edges of refs.diffEdges) edges.visible = diffActive && ly.blocks
    for (const callout of refs.callouts) callout.visible = diffActive && ly.blocks

    const pointsVisible = showsPoints(dm) && ly.blocks
    for (const group of refs.pointGroups) group.visible = pointsVisible

    // CAD 모드에서는 센서 마커를 숨긴다 — 도면 형상만 남겨야 도면으로 읽힌다
    for (const marker of refs.sensorMarkers) marker.visible = dm !== 'cad' && ly.sensors

    for (const material of refs.edgeMaterials) {
      material.color.setHex(palette.edgeColor)
      material.opacity = palette.edgeOpacity
      material.userData.baseOpacity = palette.edgeOpacity
    }
    for (const outline of refs.outlines) outline.visible = so && ly.blocks

    // 인식 범위 표시선 — 밝은 CAD 배경에서는 진한 스텝을 쓴다
    for (const marker of refs.markers) {
      marker.lines.visible = so && ly.blocks
      const material = marker.lines.material as THREE.LineBasicMaterial
      if (dm === 'cad') {
        material.color.setHex(marker.registered ? 0x8a6d1f : 0x991b1b)
      } else {
        material.color.setHex(marker.registered ? 0xfbbf24 : 0xdc2626)
      }
    }

    // 핀지그와 센서는 실측 설비이지 도면 형상이 아니다
    for (const jig of refs.jigGroups) jig.visible = dm !== 'cad' && ly.blocks
    for (const boundary of refs.boundaries) {
      boundary.visible = ly.floor
      ;(boundary.material as THREE.LineBasicMaterial).color.setHex(palette.boundaryColor)
    }
    for (const grid of refs.grids) {
      // 바닥은 어느 모드에서나 있어야 점이 어디에 놓였는지 읽힌다
      grid.visible = ly.floor
      const material = grid.material as THREE.LineBasicMaterial
      material.color.setHex(palette.gridColor)
      material.opacity = palette.gridOpacity
      material.userData.baseOpacity = palette.gridOpacity
    }
    for (const floor of refs.floors) {
      floor.visible = ly.floor
      // 바닥 판은 팔레트를 따라간다 — 어두운 점군 바탕에서는 강판, CAD 에서는 밝은 무채색
      ;(floor.material as THREE.MeshLambertMaterial).color.setHex(
        dm === 'cad' ? 0xc7ccd1 : 0x27313c
      )
    }
    for (const bay of refs.bayVisuals) {
      if (bay.label) bay.label.visible = ly.labels
      if (bay.statusOverlay) bay.statusOverlay.visible = ly.status
    }

    if (pointsVisible) {
      applyPointColors(refs.clouds, cm, {
        sensorColors: SENSOR_POINT_COLORS,
        minY: refs.minY,
        maxY: refs.maxY,
      })
    }

    // 경계선·불투명도를 팔레트 기준으로 되돌린 뒤이므로, 강조는 항상 마지막에 다시 얹는다
    applyBayEmphasis()

    /* 재질·가시성을 바꿨으면 한 장 더 — 카메라가 멈춰 있어도 반영되게 */
    requestRenderRef.current?.()
  }, [applyBayEmphasis])

  // 모드·규칙·레이어 전환 — 씬을 다시 만들지 않는다
  useEffect(() => {
    applyDisplay()
  }, [applyDisplay, displayMode, colorMode, showOutline, layers])

  useEffect(() => {
    applyBayEmphasis()
  }, [applyBayEmphasis, highlightedBayId])

  // 필터 변경 (FR-9) — 가라앉힘과 화면 밖 표식 대상이 함께 바뀐다
  useEffect(() => {
    applyBayEmphasis()
    refreshOverlayRef.current?.()
  }, [applyBayEmphasis, dimmedBayIds])

  /** `선택 정반 맞춤` 재요청 (FR-8) — 카드 버튼이 신호를 올리면 카메라만 다시 맞춘다 */
  useEffect(() => {
    if (fitRequest > 0) handleFitSelected()
  }, [fitRequest, handleFitSelected])

  useEffect(() => {
    if (!sensorFocus || building || mode !== 'bay') return
    if (sensorFocus.index < 0) {
      handleResetView()
      return
    }
    const marker = sceneRefs.current?.sensorMarkers[sensorFocus.index]
    const api = viewApiRef.current
    if (!marker || !api) return
    const localFocus = marker.userData.focusPosition as THREE.Vector3 | undefined
    if (!localFocus) return
    const target = marker.localToWorld(localFocus.clone())
    const direction = api.camera.position.clone().sub(api.controls.target)
    if (direction.lengthSq() < 1e-6) direction.set(1, 0.7, 1)
    direction.normalize()
    tweenCancelRef.current?.()
    tweenCancelRef.current = tweenCameraTo(api.camera, api.controls, {
      position: target.clone().addScaledVector(direction, Math.max(8, api.controls.minDistance)),
      target,
    })
  }, [sensorFocus, building, mode, handleResetView])

  /**
   * 선택 변화(FR-5) — 강조를 다시 계산하고, 새로 선택된 정반에는 카메라를 부드럽게
   * 맞춘다 (FR-3 수용 기준 3 · FR-4 `선택 베이 맞춤`). 해제 시 카메라는 그대로 둔다 —
   * 보던 자리를 잃는 쪽이 더 어지럽다.
   */
  useEffect(() => {
    if (building) return
    const refs = sceneRefs.current
    const api = viewApiRef.current
    const bay = selectedBayId
      ? refs?.bayVisuals.find((entry) => entry.locationId === selectedBayId)
      : undefined
    selectionRef.current =
      selectedBayId && bay ? { bayId: selectedBayId, stage: bay.stage } : null
    applyBayEmphasis()

    if (bay && api && mode === 'factory') {
      fitBoxTweened(new THREE.Box3().setFromObject(bay.group), 1.3)
    }
  }, [selectedBayId, building, mode, applyBayEmphasis, fitBoxTweened])

  /*
   * 빌드 예약.
   *
   * 같은 틱에서 씬을 만들면 브라우저는 그 사이 한 프레임도 그리지 못해 스피너가
   * 아예 나타나지 않는다. 두 프레임(레이아웃 → 페인트)을 흘려보낸 뒤 빌드를 건다.
   * 그동안 이전 씬은 그대로 서 있고 그 위에 스피너만 덮이므로 화면이 비지 않는다.
   */
  useEffect(() => {
    setBuilding(true)
    let done = false
    const build = () => {
      if (done) return
      done = true
      setBuildRequest((request) => request + 1)
    }
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(build)
    })
    /*
     * ⚠️ rAF 폴백 — **rAF 가 한 번도 발화하지 않는 환경이 있다.** 백그라운드·가려진 탭,
     * 일부 VDI/원격데스크톱, 절전 모드가 그렇다. 그런 곳에서는 이 게이트가 영원히 안
     * 열려 씬이 만들어지지 않고 화면이 스피너인 채로 멈춘다(W9-0 진단 §4에서 재현 —
     * 같은 조건에서 실측 뷰어는 rAF 게이트가 없어 정상이라, 목업 뷰어만 공백이었다).
     * 스피너를 먼저 그리려는 지연은 두 프레임이면 충분하므로, 그보다 넉넉한 시간이
     * 지나도 rAF 가 오지 않으면 타이머가 대신 연다. 먼저 온 쪽이 이기고 한 번만 연다.
     */
    const timer = window.setTimeout(build, 120)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
    // 3D 라벨(CSS2D)은 씬을 세울 때 만든 DOM 이다 — 언어가 바뀌면 다시 세워야 글자가 따라온다
  }, [mode, bays, selectedBlockId, layout, i18n.language])

  useEffect(() => {
    // 첫 요청 전 — 아직 그릴 것이 없다. 스피너만 떠 있는 상태다.
    if (buildRequest === 0) return

    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const hemi = new THREE.HemisphereLight(0xdde6f0, 0x1a2030, 1.1)
    scene.add(hemi)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9)
    dirLight.position.set(40, 70, 30)
    scene.add(dirLight)

    const cadMaterial = new THREE.MeshLambertMaterial({
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const jigMaterial = new THREE.MeshLambertMaterial({ color: JIG_COLOR })
    /* 여러 베이가 공유하는 재질 — 베이별 강조(불투명도)에서 제외한다 (setGroupEmphasis) */
    cadMaterial.userData.emphasisExempt = true
    jigMaterial.userData.emphasisExempt = true

    const refs = {
      scene,
      hemi,
      dir: dirLight,
      cadMaterial,
      cadMeshes: [] as THREE.Mesh[],
      clouds: [] as ColorableCloud[],
      pointGroups: [] as THREE.Group[],
      sensorMarkers: [] as THREE.Object3D[],
      outlines: [] as THREE.LineSegments[],
      markers: [] as { lines: THREE.LineSegments; registered: boolean }[],
      jigGroups: [] as THREE.Group[],
      diffFills: [] as THREE.Mesh[],
      diffEdges: [] as THREE.LineSegments[],
      callouts: [] as CSS2DObject[],
      boundaries: [] as THREE.LineSegments[],
      bayVisuals: [] as {
        locationId: string
        name: string
        stage: string | null
        group: THREE.Group
        boundary: THREE.LineSegments | null
        labelWrap: HTMLElement | null
        labelCard: HTMLElement | null
        label: CSS2DObject | null
        statusOverlay: THREE.Mesh | null
        error: boolean
        failing: boolean
      }[],
      floors: [] as THREE.Mesh[],
      grids: [] as THREE.LineSegments[],
      backdrops: new Map<string, THREE.CanvasTexture>(),
      edgeMaterials: [] as THREE.LineBasicMaterial[],
      minY: 0,
      maxY: 1,
    }
    sceneRefs.current = refs

    /*
     * 공장 뷰는 화각을 좁힌다 (FR-4) — 낮은 원근감이라야 원거리 베이가 과도하게
     * 작아지지 않고, 기울인 2.5D 시점에서도 베이 경계가 왜곡 없이 읽힌다.
     */
    const camera = new THREE.PerspectiveCamera(
      mode === 'factory' ? 36 : 50,
      container.clientWidth / container.clientHeight,
      0.1,
      800
    )

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    /* 저사양 모드(FR-4)는 픽셀 밀도를 눌러 렌더 부하를 줄인다 — 도움말 패널에서 켠다 */
    renderer.setPixelRatio(pixelRatioFor(isLowGpuMode()))
    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)
    const unsubscribeQuality = subscribeQualityMode((low) => {
      renderer.setPixelRatio(pixelRatioFor(low))
      requestRenderRef.current?.()
    })

    const labelRenderer = new CSS2DRenderer()
    labelRenderer.setSize(container.clientWidth, container.clientHeight)
    labelRenderer.domElement.style.position = 'absolute'
    labelRenderer.domElement.style.top = '0'
    labelRenderer.domElement.style.left = '0'
    labelRenderer.domElement.style.pointerEvents = 'none'
    container.appendChild(labelRenderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.maxDistance = 400
    if (mode === 'factory') {
      /*
       * 2.5D 시점의 조작 한계 (FR-4·FR-6) — 지평선 아래로 뒤집히거나 바닥에 붙는
       * 각도를 막는다. maxDistance 는 씬을 세운 뒤 장면 크기에 맞춰 다시 잡는다.
       */
      controls.minDistance = 15
      controls.minPolarAngle = THREE.MathUtils.degToRad(10)
      controls.maxPolarAngle = THREE.MathUtils.degToRad(78)
    }
    applyBlenderMouseBindings(controls)
    const unbindButtons = bindModifierAwareButtons(controls, renderer.domElement)

    /*
     * 조작 포커스 (FR-6) — 클릭하기 전에는 휠을 소비하지 않아 페이지 스크롤이 여기
     * 걸리지 않고, 포커스 중에도 줌 한계에 닿으면 페이지 스크롤로 흘려보낸다.
     */
    const focusApi = bindViewportFocus(controls, camera, container, {
      onBlockedWheel: () => {
        setWheelHint(true)
        window.clearTimeout(wheelHintTimer.current)
        wheelHintTimer.current = window.setTimeout(() => setWheelHint(false), 2200)
      },
      onFocusChange: (focused) => {
        if (focused) setWheelHint(false)
      },
    })
    focusApiRef.current = focusApi
    /* 카메라 전환 중 드래그를 시작하면 전환을 끊는다 — 사용자 조작이 항상 이긴다 */
    const cancelTweenOnPointerDown = () => tweenCancelRef.current?.()
    container.addEventListener('pointerdown', cancelTweenOnPointerDown)

    /* 빈 공간 클릭(드래그 아님) = 선택 해제 (FR-5). 라벨 클릭은 DOM 라벨이 먼저 받는다 */
    let blankClickStart: { x: number; y: number } | null = null
    const handleCanvasPointerDown = (event: PointerEvent) => {
      blankClickStart = event.button === 0 ? { x: event.clientX, y: event.clientY } : null
    }
    const handleCanvasPointerUp = (event: PointerEvent) => {
      if (!blankClickStart || event.button !== 0) return
      const moved = Math.hypot(event.clientX - blankClickStart.x, event.clientY - blankClickStart.y)
      blankClickStart = null
      if (moved < 6 && mode === 'factory' && selectedBayIdRef.current) {
        onBaySelectRef.current?.(null)
      }
    }
    renderer.domElement.addEventListener('pointerdown', handleCanvasPointerDown)
    renderer.domElement.addEventListener('pointerup', handleCanvasPointerUp)

    /*
     * 단축키는 포커스가 아니라 **커서가 올라간 뷰포트**에 적용한다.
     * Blender 도 그렇게 동작하고, 캔버스는 클릭해도 포커스를 안 받는 경우가 있어
     * 포커스에 기대면 키가 먹지 않는다.
     */
    let pointerInside = false
    const markInside = () => { pointerInside = true }
    const markOutside = () => { pointerInside = false }
    renderer.domElement.addEventListener('pointerenter', markInside)
    renderer.domElement.addEventListener('pointerleave', markOutside)

    // 블록 단독 뷰 대상 (bay 모드 + selectedBlockId가 유효할 때만)
    const focusBlock =
      mode === 'bay' && selectedBlockId
        ? bays[0]?.blocks.find((b) => b.id === selectedBlockId) ?? null
        : null

    /** 특징선은 씬 빌드가 끝난 뒤 순차 처리한다 (블록당 ~164ms) */
    const pendingEdges: { soup: Float32Array; matrix: THREE.Matrix4; group: THREE.Group }[] = []

    /**
     * 판정 품질 리포트 — 시뮬레이션 정답 대비 적중/놓침/오탐.
     * 임계값(MATCH_TOLERANCE · PRESENT_COVERAGE · 부재별 최소 표본)을 만질 때마다
     * 이 수치가 크게 움직인다. 눈으로 보지 말고 이걸 본다.
     */
    const matchReports: ({ detection: string; parts: number } & MatchAccuracy)[] = []

    /** 배치 조회 — 베이 좌표·회전은 데이터 계층(FactoryLayout)이 소유한다 (FR-3) */
    const layoutByBay = new Map((layout?.bays ?? []).map((entry) => [entry.bayId, entry]))

    bays.forEach((bay, bayIndex) => {
      const bayGroup = new THREE.Group()
      /** 이 정반의 경계선 — 공장 뷰에서 목록 강조 대상으로 잡아 둔다 */
      let bayBoundary: THREE.LineSegments | null = null
      const placement = mode === 'factory' ? layoutByBay.get(bay.location.id) : undefined
      if (mode === 'factory') {
        if (placement) {
          bayGroup.position.set(placement.center[0], 0, placement.center[1])
          bayGroup.rotation.y = THREE.MathUtils.degToRad(placement.rotationDeg)
        } else {
          /* 배치 데이터가 없는 베이 — 예전처럼 한 줄로 나열한다 */
          bayGroup.position.x = bayIndex * BAY_PITCH
        }
      }
      /* 실형상 배치(yard-fixture)면 베이마다 폭·길이가 다르다 — 바닥·경계·그리드·
       * 상태막이 전부 이 두 값을 쓴다. 배치가 없으면 종전 목업 상자 크기다. */
      const bayW = placement?.size[0] ?? BAY_WIDTH
      const bayL = placement?.size[1] ?? BAY_LENGTH

      const density = mode === 'factory' ? FACTORY_DENSITY : 1
      /* 실측 정반(PBS 5BAY) — 이 뷰어는 목업 시뮬레이터라 실측 **점군**을 지어낼 수 없다.
       * 합성 바닥 스캔·블록 히트를 만들면 실측 센서 명의의 가짜 데이터가 되므로(R 진단)
       * 만들지 않는다. 점군은 아래에서 realOverlay(진짜 점군)로 올린다. */
      const realScan = bay.realScan ?? false
      /* 센서 자리 — 설비 엔티티 실좌표(도면 이식)가 있으면 그것, 없으면 절차 배치.
       * 상태 목록(bay.sensors)이 실좌표보다 많으면 남는 항목은 마커 없이 남는다
       * (아래 `if (!position) return` — 자리를 지어내지 않는다). */
      const sensorPositions = placement?.sensorPoints?.length
        ? placement.sensorPoints.map(([sx, sz]) => new THREE.Vector3(sx, SENSOR_POLE_HEIGHT, sz))
        : getSensorPositions(bay.sensors.length, bayW, bayL)
      /*
       * 실측 정반의 센서 자리는 **오버레이가 준 실측 좌표**다 — 점군과 같은 변환을 탄
       * 값이라 마커가 점군과 어긋날 여지가 없고, 높이도 실측(5~7m)이라 목업 폴(15m)과
       * 한눈에 갈린다. 도면 이식값(placement.sensorPoints)을 쓰지 않는 이유는
       * realOverlay 계약 주석 참조 — 실측 12대와 도면 12대는 다른 장비 집합이다.
       * 이름(장비 IP)으로 맞춘다: 두 목록의 순서를 가정하지 않는다.
       */
      const realSensorPositions = new Map<string, THREE.Vector3>(
        (bay.realOverlay?.sensors ?? []).map((sensor) => [
          sensor.name,
          new THREE.Vector3(...sensor.position),
        ])
      )
      const positionOfSensor = (sensor: LidarSensor, index: number) =>
        realScan ? realSensorPositions.get(sensor.name) : sensorPositions[index]
      const bayModel = bay.bayModel ?? null
      const visibleBlocks = focusBlock ? [focusBlock] : bay.blocks

      // ══ pass 1 ══ detection 분해 · 부재 분해 · 샘플 · 지그/브래킷/풋프린트
      const obstacles: ScanObstacle[] = []
      const prepared = visibleBlocks.map((block) => {
        if (!bayModel || !block.modelAssemblyIds) return null
        const placed = detectionMatrix(bayModel.model, block)
        if (!placed) return null
        const soup = getMergedAssemblyPositions(bayModel.model, block.modelAssemblyIds)
        if (soup.length === 0) return null

        // 부재 단위 분해 — 정점을 공유하는 삼각형끼리 묶는다
        const parts = splitComponents(soup)

        /*
         * 시뮬레이션 정답: 진척률만큼의 부재만 실제로 존재한다고 보고,
         * 그 부재에서만 점군을 만든다. 뷰어는 이 집합을 보지 않는다 —
         * 점군과 도면을 대조해 스스로 판정한다.
         */
        const builtParts = selectCompletedParts(parts.areas, detectionProgress(block))
        const builtSoup =
          builtParts.size === parts.count
            ? soup
            : subsetSoupByComponent(soup, parts.labels, (i) => builtParts.has(i))

        const bracketColor = block.cadRegistered ? 0xfbbf24 : 0xdc2626
        const brackets = createLineSegments(
          createCornerBrackets(placed.recenteredBBox),
          bracketColor,
          0.8
        )
        brackets.position.set(...block.transform.position)
        brackets.quaternion.set(...block.transform.quaternion)
        refs.markers.push({ lines: brackets, registered: block.cadRegistered })
        bayGroup.add(brackets)

        if (!focusBlock) {
          const footprint = createLineSegments(
            createFloorFootprint(placed.recenteredBBox),
            bracketColor,
            0.45
          )
          footprint.position.set(block.transform.position[0], 0, block.transform.position[2])
          footprint.quaternion.set(...block.transform.quaternion)
          refs.markers.push({ lines: footprint, registered: block.cadRegistered })
          bayGroup.add(footprint)
        }

        /*
         * 점군 생성용 표면 샘플 — 만들어진 부재에서만 뽑되, **부재별 최소 점수를 보장**한다.
         * 라이다 점 밀도는 부재 크기에 비례하지 않는데, 면적 가중으로만 뿌리면 작은 부재에
         * 점이 거의 없어 대조가 "있는데 없다"고 오판한다.
         */
        const sampleCount = Math.round(
          Math.min(40000, Math.max(6000, (builtSoup.length / 3) * 0.5)) * density
        )
        const scanSamples = filterSamplesByPart(
          sampleComponentSurfaces(soup, parts, sampleCount, Math.round(60 * density)),
          (i) => builtParts.has(i)
        )
        const localSamples = transformSamples(
          { positions: scanSamples.positions, normals: scanSamples.normals },
          placed.localMatrix
        )

        // 지그는 도면 기준으로 미리 세팅되므로 전체 형상의 하부면을 쓴다
        const fullLocal = transformSamples(
          sampleSurfacePoints(soup, Math.min(20000, Math.max(4000, (soup.length / 3) * 0.25))),
          placed.localMatrix
        )
        const heightmap = buildBottomHeightmap(fullLocal.positions, placed.recenteredBBox)
        const jig = createJigPosts(placed.recenteredBBox, block.transform, jigMaterial, heightmap)
        refs.jigGroups.push(jig.group)
        bayGroup.add(jig.group)

        if (!focusBlock) {
          obstacles.push({ ...placed.recenteredBBox, transform: block.transform })
        }

        const placementMatrix = new THREE.Matrix4().compose(
          new THREE.Vector3(...block.transform.position),
          new THREE.Quaternion(...block.transform.quaternion),
          new THREE.Vector3(1, 1, 1)
        )

        return {
          block,
          placed,
          soup,
          parts,
          builtParts,
          blockSamples: transformSamples(localSamples, placementMatrix),
          jigSamples: sampleJigPoints(jig.pins, block.transform),
          kind: (block.cadRegistered ? 'block' : 'unregistered') as PointKind,
        }
      })

      if (!focusBlock) {
        const boundary = createBayBoundary(0x334155, bayW, bayL)
        bayBoundary = boundary
        refs.boundaries.push(boundary)
        bayGroup.add(boundary)

        const grid = createLineSegments(createFloorGrid(bayW, bayL, 2), 0x3a4a5c, 0.35)
        refs.grids.push(grid)
        bayGroup.add(grid)

        if (mode === 'factory') {
          /*
           * 바닥 판 (FR-2·FR-4) — 베이가 선이 아니라 **면**으로 서고, 살짝 두께를 줘
           * 지면에서 돌출시키면 기울인 2.5D 시점에서 깊이가 읽힌다. 색은 applyDisplay
           * 가 표시 모드 팔레트에 맞춘다. 실형상 배치가 footprint(지번 합집합 외곽)를
           * 주면 상자 대신 그 모양으로 깎는다 — 베이 구획이 실제 땅 모양으로 선다.
           */
          const floor = placement?.footprint?.length
            ? (() => {
                const shape = new THREE.Shape()
                placement.footprint.forEach(([fx, fz], i) => {
                  /* Shape(XY) → rotateX(+90°) 로 XZ 평면에 눕는다: (x, y) → (x, z=y) */
                  if (i === 0) shape.moveTo(fx, fz)
                  else shape.lineTo(fx, fz)
                })
                shape.closePath()
                const geometry = new THREE.ExtrudeGeometry(shape, {
                  depth: 0.5,
                  bevelEnabled: false,
                })
                geometry.rotateX(Math.PI / 2)
                return new THREE.Mesh(
                  geometry,
                  new THREE.MeshLambertMaterial({ color: 0x27313c, side: THREE.DoubleSide })
                )
              })()
            : new THREE.Mesh(
                new THREE.BoxGeometry(bayW, 0.5, bayL),
                new THREE.MeshLambertMaterial({ color: 0x27313c })
              )
          floor.position.y = placement?.footprint?.length ? 0.25 : -0.25
          refs.floors.push(floor)
          bayGroup.add(floor)
        }
      }

      // ══ pass 2 ══ 센서별 스캔 → 점군. 블록 표면 점을 대조용으로 모은다
      const pointGroup = new THREE.Group()
      refs.pointGroups.push(pointGroup)
      bayGroup.add(pointGroup)

      /** detection index → 그 블록 표면에서 나온 실측 점 (바닥·지그는 넣지 않는다) */
      const blockHitsByDetection: { positions: Float32Array; normals: Float32Array }[][] =
        prepared.map(() => [])

      /* 실측 정반 — 합성 대신 **진짜 점군**(프리뷰, 데이터 유도 앵커)을 올린다.
       * 색은 의사 반사강도만 입힌 단색 계열 — 목업 센서색 규칙(pass 2)과 섞이지 않게
       * refs.clouds 에 등록하지 않는다(색상 규칙 순회가 건드리지 않는 별도 층).
       * pointGroup 에 넣어 점군 레이어 토글은 함께 따른다. */
      if (realScan && bay.realOverlay) {
        const overlay = bay.realOverlay
        const count = overlay.positions.length / 3
        const colors = new Float32Array(count * 3)
        for (let i = 0; i < count; i++) {
          const shade = overlay.shade ? overlay.shade[i] / 255 : 0.55
          const v = 0.28 + shade * 0.6
          colors[i * 3] = v
          colors[i * 3 + 1] = v * 0.92
          colors[i * 3 + 2] = v * 0.72
        }
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(overlay.positions, 3))
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        const points = new THREE.Points(
          geometry,
          new THREE.PointsMaterial({ size: POINT_SIZE, sizeAttenuation: true, vertexColors: true })
        )
        pointGroup.add(points)
      }

      bay.sensors.forEach((sensor, index) => {
        const position = positionOfSensor(sensor, index)
        if (!position) return

        const color = SENSOR_POINT_COLORS[index % SENSOR_POINT_COLORS.length]
        const isOnline = sensor.status === 'online'
        if (!focusBlock) {
          /* 방향 콘 — 목업은 정반 중앙을 겨눈다(합성 스캔이 실제로 그렇게 쏜다).
           * 실측 센서는 갠트리에 매달려 제 아래를 훑으므로 그 자리 바닥을 겨눈다:
           * 100m 떨어진 베이 중앙을 가리키면 화면이 없는 조준을 말하게 된다. */
          const target = realScan ? new THREE.Vector3(position.x, 0, position.z) : SENSOR_TARGET
          const marker = createSensorMarker(position, target, color, isOnline)
          refs.sensorMarkers.push(marker)
          bayGroup.add(marker)
        }
        /* 실측 정반은 마커까지다 — 아래 합성 스캔은 목업 시뮬레이션이라 실측에
         * 얹으면 가짜 데이터가 된다(위 주석). 점군은 realOverlay 가 이미 올렸다. */
        if (realScan) return
        if (!isOnline) return

        if (!focusBlock) {
          const surface = simulateBaySurfaceScan(position, SENSOR_TARGET, obstacles, density, bayW, bayL)
          if (surface.length > 0) {
            pointGroup.add(
              registerCloud(refs.clouds, floorHits(surface, position), 'floor', index, -1)
            )
          }
        }

        prepared.forEach((entry, detectionIndex) => {
          if (!entry) return
          const blockHits = filterSamplesForSensor(entry.blockSamples, position, SENSOR_TARGET)
          if (blockHits.positions.length > 0) {
            pointGroup.add(
              registerCloud(refs.clouds, blockHits, entry.kind, index, detectionIndex)
            )
            blockHitsByDetection[detectionIndex].push(blockHits)
          }
          const jigHits = filterSamplesForSensor(entry.jigSamples, position, SENSOR_TARGET)
          if (jigHits.positions.length > 0) {
            pointGroup.add(registerCloud(refs.clouds, jigHits, 'jig', index, detectionIndex))
          }
        })
      })

      // ══ pass 3 ══ 공간 해시 → 부재별 대조 → CAD mesh(확인/미확인) · diff 윤곽 · 콜아웃
      const onlineSensors: MatchSensor[] = bay.sensors
        .map((sensor, index) => ({ sensor, position: positionOfSensor(sensor, index) }))
        .filter((s) => s.sensor.status === 'online' && s.position)
        .map((s) => ({ position: s.position!, target: SENSOR_TARGET }))

      prepared.forEach((entry, detectionIndex) => {
        if (!entry || !entry.block.cadRegistered) return
        const { block, placed, soup, parts, builtParts } = entry

        const placementMatrix = new THREE.Matrix4().compose(
          new THREE.Vector3(...block.transform.position),
          new THREE.Quaternion(...block.transform.quaternion),
          new THREE.Vector3(1, 1, 1)
        )
        const toBay = placementMatrix.clone().multiply(placed.localMatrix)

        // 도면 부재 샘플 (정반 좌표계) — 부재마다 최소 표본을 보장한다
        const cadSamples = sampleComponentSurfaces(soup, parts, 12000)
        const baySamples = transformSamples(
          { positions: cadSamples.positions, normals: cadSamples.normals },
          toBay
        )
        const index = buildPointIndex(blockHitsByDetection[detectionIndex])
        const result = matchPartsToPoints(
          { ...baySamples, owners: cadSamples.owners },
          parts.count,
          index,
          onlineSensors
        )

        // 판정 정확도 — 시뮬레이션 정답과 대조해 수치로 남긴다
        const score = scoreMatch(result.presence, builtParts)
        matchReports.push({
          detection: formatDetectionId(block),
          parts: parts.count,
          ...score,
        })

        const missingSet = new Set(result.missing)
        const presentSoup = subsetSoupByComponent(soup, parts.labels, (i) => !missingSet.has(i))
        const missingSoup =
          missingSet.size > 0
            ? subsetSoupByComponent(soup, parts.labels, (i) => missingSet.has(i))
            : new Float32Array(0)

        // 확인된 부재 — 도면 그대로(무채색 솔리드). 색을 입히지 않는다
        if (presentSoup.length > 0) {
          const geometry = new THREE.BufferGeometry()
          geometry.setAttribute('position', new THREE.BufferAttribute(presentSoup, 3))
          geometry.computeVertexNormals()
          const mesh = new THREE.Mesh(geometry, cadMaterial)
          mesh.applyMatrix4(toBay)
          refs.cadMeshes.push(mesh)
          bayGroup.add(mesh)
          pendingEdges.push({ soup: presentSoup, matrix: toBay, group: bayGroup })
        }

        if (missingSoup.length > 0) {
          // 채움 — 한 mesh 안에서 부재별 투명도를 달리 줄 수 없어 mesh 를 갈라 만든다
          const geometry = new THREE.BufferGeometry()
          geometry.setAttribute('position', new THREE.BufferAttribute(missingSoup, 3))
          geometry.computeVertexNormals()
          const fill = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({
              color: MISSING_COLOR,
              transparent: true,
              opacity: MISSING_FILL_OPACITY.cad,
              depthWrite: false,
              side: THREE.DoubleSide,
            })
          )
          fill.applyMatrix4(toBay)
          fill.visible = false
          refs.diffFills.push(fill)
          bayGroup.add(fill)

          // 윤곽 — depthTest:false + renderOrder 로 판재 뒤 부재까지 관통해 보인다
          const edgePositions = extractFeatureLines(missingSoup)
          if (edgePositions.length > 0) {
            const edges = createLineSegments(edgePositions, MISSING_COLOR, 0.95, {
              depthTest: false,
              renderOrder: 10,
            })
            edges.applyMatrix4(toBay)
            edges.visible = false
            refs.diffEdges.push(edges)
            bayGroup.add(edges)
          }

          // 요약 콜아웃 — detection 당 1개, 미확인 영역의 면적 가중 중심에
          let wx = 0
          let wy = 0
          let wz = 0
          let wsum = 0
          const center = new THREE.Vector3()
          for (const partIndex of result.missing) {
            const area = parts.areas[partIndex]
            center.set(0, 0, 0)
            let n = 0
            for (let t = 0; t < parts.labels.length; t++) {
              if (parts.labels[t] !== partIndex) continue
              center.x += soup[t * 9]
              center.y += soup[t * 9 + 1]
              center.z += soup[t * 9 + 2]
              n++
            }
            if (n === 0) continue
            center.multiplyScalar(1 / n).applyMatrix4(toBay)
            wx += center.x * area
            wy += center.y * area
            wz += center.z * area
            wsum += area
          }
          if (wsum > 0) {
            const judged = parts.count - result.unobservable.length
            const pct = judged > 0 ? Math.round((result.missing.length / judged) * 100) : 0
            const callout = createMissingCallout(
              result.missing.length,
              pct,
              new THREE.Vector3(wx / wsum, wy / wsum, wz / wsum),
              t
            )
            callout.visible = false
            refs.callouts.push(callout)
            bayGroup.add(callout)
          }
        }
      })

      if (mode === 'bay') {
        for (const block of visibleBlocks) {
          const [bx, by, bz] = block.transform.position
          const top = by + JIG_HEIGHT + block.dimensions.height

          /*
           * 단독 뷰에서는 3D 위에 라벨을 얹지 않는다 — 화면에 이것 하나뿐이라
           * 무엇인지는 이미 분명하고, 상세는 뷰포트 왼쪽 위 패널이 맡는다.
           */
          if (focusBlock) continue

          // 정반 전체 뷰 — 한 줄 라벨. 누르면 이 블록 단독 뷰로 들어간다
          bayGroup.add(
            createBlockLabel(
              block,
              new THREE.Vector3(bx, top + 1.2, bz),
              t,
              () => onSelectBlockRef.current?.(block.id)
            )
          )
        }
      }

      if (mode === 'factory') {
        const worst = worstSensorStatus(bay.sensors)
        const stage = bayStage(bay.blocks)

        /*
         * 상태 오버레이 (FR-2) — 이상(오류·오프라인) 베이는 바닥에 상태색 막을 깔아
         * 공장 전체 시점에서 확대 없이도 식별되게 한다 (수용 기준 2). 색만으로 전하지
         * 않도록 라벨의 상태점·텍스트가 같은 사실을 함께 말한다.
         */
        let statusOverlay: THREE.Mesh | null = null
        if (worst === 'error' || worst === 'offline') {
          const overlayMaterial = new THREE.MeshBasicMaterial({
            color: worst === 'error' ? 0xdc2626 : 0x64748b,
            transparent: true,
            opacity: worst === 'error' ? 0.14 : 0.1,
            depthWrite: false,
          })
          /* 알람은 강조 문법보다 우선한다 — 무관 베이로 가라앉아도 상태막은 남는다 */
          overlayMaterial.userData.emphasisExempt = true
          statusOverlay = new THREE.Mesh(
            new THREE.PlaneGeometry(bayW - 1, bayL - 1),
            overlayMaterial
          )
          statusOverlay.rotation.x = -Math.PI / 2
          statusOverlay.position.y = 0.3
          bayGroup.add(statusOverlay)
        }

        /* 밀집 공장에서는 정상 베이 라벨을 축약한다 — 이상·선택 라벨이 우선권을 갖는다 (FR-3).
           실측 정반은 축약하지 않는다: '실측 — 진입해 확인' 줄이 곧 그 베이의 안내판이다 */
        const compact = bays.length > 6 && worst === 'online' && !realScan
        const label = createBayStatusLabel(
          {
            name: bay.location.name,
            workCntr: bay.location.workCntr,
            sensorStatus: worst,
            sensorCounts: sensorStatusCounts(bay.sensors),
            workState: bayWorkState(bay.sensors, bay.blocks),
            blockCount: bay.blocks.length,
            stageCode: stage,
            realScan,
          },
          new THREE.Vector3(0, BAY_HEIGHT + 2, 0),
          t,
          () => {
            /* 첫 클릭 = 지속 선택(강조·카메라 맞춤) · 선택된 것을 다시 클릭 = 정반 화면 진입 */
            if (selectedBayIdRef.current === bay.location.id) {
              onOpenBayRef.current?.(bay.location.id)
            } else {
              onBaySelectRef.current?.(bay.location.id)
            }
          },
          (hovering) => onHoverBayRef.current?.(hovering ? bay.location.id : null),
          compact
        )
        bayGroup.add(label)
        refs.bayVisuals.push({
          locationId: bay.location.id,
          name: bay.location.name,
          stage,
          group: bayGroup,
          boundary: bayBoundary,
          labelWrap: label.element,
          // 라벨 wrap 의 첫 자식이 실제 카드(button)다 (createBayStatusLabel 참조)
          labelCard: label.element.firstElementChild as HTMLElement | null,
          label,
          statusOverlay,
          error: worst === 'error',
          failing: worst === 'error' || worst === 'offline',
        })
      }

      scene.add(bayGroup)
    })

    if (matchReports.length > 0) {
      const sum = matchReports.reduce(
        (acc, r) => ({
          hit: acc.hit + r.hit,
          miss: acc.miss + r.miss,
          falseAlarm: acc.falseAlarm + r.falseAlarm,
          skipped: acc.skipped + r.skipped,
        }),
        { hit: 0, miss: 0, falseAlarm: 0, skipped: 0 }
      )
      const recall = sum.hit + sum.miss === 0 ? 1 : sum.hit / (sum.hit + sum.miss)
      console.log(
        `[cadPointMatch] ${bays.length}개 베이 · 적중 ${sum.hit} / 놓침 ${sum.miss} / 오탐 ${sum.falseAlarm} / 판정불가 ${sum.skipped} · 재현율 ${(recall * 100).toFixed(1)}%`,
        matchReports
      )
    }

    // 높이 규칙 정규화 범위
    let minY = Infinity
    let maxY = -Infinity
    for (const cloud of refs.clouds) {
      const position = cloud.points.geometry.getAttribute('position')
      for (let i = 0; i < position.count; i++) {
        const y = position.getY(i)
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
    refs.minY = Number.isFinite(minY) ? minY : 0
    refs.maxY = Number.isFinite(maxY) ? maxY : 1

    applyDisplay()

    // 특징선은 워커에서 뽑는다 — 솔리드가 먼저 뜨고 선이 뒤따라 채워진다
    const stopEdgeQueue = runFeatureLineQueue(
      pendingEdges.map(({ soup, matrix, group }) => ({
        soup,
        onReady: (positions) => {
          if (!sceneRefs.current || positions.length === 0) return
          const lines = createLineSegments(positions, 0xfbbf24, 0.5)
          lines.applyMatrix4(matrix)
          refs.outlines.push(lines)
          refs.edgeMaterials.push(lines.material as THREE.LineBasicMaterial)
          group.add(lines)
          applyDisplay()
        },
      }))
    )

    /** 씬 전체 bounding box — 기본 시점·'.' 맞춤·이동 한계의 기준 */
    const sceneBox = new THREE.Box3().setFromObject(scene)

    // 모드별 카메라/타겟
    if (mode === 'factory') {
      /*
       * 2.5D 기본 시점 (FR-4) — 위에서 비스듬히 내려다보는 고도 52° 에 좁은 화각을
       * 짝지어, 공간감은 남기되 원거리 베이가 과도하게 작아지지 않게 한다.
       * 배치(레이아웃)가 몇 열이 되든 씬 크기에서 거리를 계산하므로 항상 다 들어온다.
       */
      const center = sceneBox.isEmpty()
        ? new THREE.Vector3()
        : sceneBox.getCenter(new THREE.Vector3())
      center.y = 2
      const elevation = THREE.MathUtils.degToRad(52)
      const azimuth = THREE.MathUtils.degToRad(18)
      const direction = new THREE.Vector3(
        Math.sin(azimuth) * Math.cos(elevation),
        Math.sin(elevation),
        Math.cos(azimuth) * Math.cos(elevation)
      )
      const distance = sceneBox.isEmpty()
        ? 120
        : Math.max(fitDistanceForBox(sceneBox, direction, camera.fov, camera.aspect, 1.08), 40)
      camera.position.copy(center).addScaledVector(direction, distance)
      controls.target.copy(center)
      /* 줌 아웃 한계 = 전체가 다 보이는 거리의 두 배 — 그 너머의 휠은 페이지 스크롤이다 */
      controls.maxDistance = distance * 2.2
    } else if (focusBlock) {
      const [bx, by, bz] = focusBlock.transform.position
      const { length, height } = focusBlock.dimensions
      controls.target.set(bx, by + JIG_HEIGHT + height / 2, bz)
      camera.position.set(
        bx + length * 1.1,
        by + JIG_HEIGHT + height + length * 0.7,
        bz + length * 1.4
      )
    } else {
      camera.position.set(38, 32, 66)
      controls.target.set(0, 3, 0)
    }

    /* 타겟이 공장 밖으로 끌려 나가 장면을 잃지 않게 한다 (FR-6) */
    const unclampPan = clampPanToBounds(controls, camera, sceneBox, 40)

    /*
     * 방금 잡은 시점이 이 화면의 "처음 위치"다 — Home 은 여기로 돌아온다.
     * 모드마다(공장 전체 / 단독 블록 / 정반) 시점이 다르므로 씬을 세운 뒤에 뜬다.
     */
    const home = captureHomePose(camera, controls)

    /*
     * 축 기즈모와 카메라를 잇는다.
     *
     * 갱신은 프레임당 한 번으로 묶는다 — OrbitControls 는 damping 때문에 드래그
     * 한 번에 'change' 를 수십 번 낸다. 그대로 setState 하면 React 가 그만큼 돈다.
     */
    viewApiRef.current = { camera, controls, home, sceneBox }

    /**
     * 화면 밖 이상 정반 표식 (FR-9) — 이상(오류·오프라인) 정반의 라벨 지점을 투영해
     * 시야 밖이면 가장 가까운 가장자리에 방향 표식을 세운다. 필터로 가라앉힌 정반은
     * 사용자가 스스로 치운 것이므로 표식도 내지 않는다.
     */
    const offscreenPoint = new THREE.Vector3()
    const viewPoint = new THREE.Vector3()
    const computeOffscreenMarks = (): OffscreenMark[] => {
      if (mode !== 'factory') return []
      // 첫 계산은 첫 렌더 전에 온다 — 투영에 쓰는 카메라 행렬을 직접 갱신해 둔다
      camera.updateMatrixWorld()
      const marks: OffscreenMark[] = []
      for (const bay of refs.bayVisuals) {
        if (!bay.failing || dimmedRef.current?.has(bay.locationId)) continue
        // 정반 그룹은 scene 직속이라 로컬 위치가 곧 월드 위치다
        offscreenPoint.copy(bay.group.position)
        offscreenPoint.y += BAY_HEIGHT
        const behind = viewPoint.copy(offscreenPoint).applyMatrix4(camera.matrixWorldInverse).z > 0
        offscreenPoint.project(camera)
        const placed = edgePlacementFor(
          offscreenPoint.x,
          offscreenPoint.y,
          behind,
          container.clientWidth,
          container.clientHeight,
          OFFSCREEN_MARGIN
        )
        if (placed) marks.push({ id: bay.locationId, name: bay.name, error: bay.error, ...placed })
      }
      return marks
    }

    let axisFrame = 0
    const publishAxisView = () => {
      axisFrame = 0
      axisStore.publish(projectAxes(camera, controls.target))
      const marks = computeOffscreenMarks()
      /* 표식이 없는 프레임은 **같은 빈 배열**을 낸다 — 매번 새 배열이면 잎이 헛돈다 */
      marksStore.publish(marks.length === 0 ? NO_OFFSCREEN_MARKS : marks)
    }
    const scheduleAxisView = () => {
      if (axisFrame) return
      axisFrame = requestAnimationFrame(publishAxisView)
    }
    controls.addEventListener('change', scheduleAxisView)
    refreshOverlayRef.current = scheduleAxisView
    publishAxisView()

    const viewKeys: Record<string, [ViewDirection, ViewDirection]> = {
      // [기본, Ctrl 조합(반대편)]
      '1': ['front', 'back'],
      '3': ['right', 'left'],
      '7': ['top', 'bottom'],
    }

    const handleViewportKey = (event: KeyboardEvent) => {
      // 입력 중인 필드의 키를 가로채지 않는다
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '')) return

      /* ESC 는 여기서 듣지 않는다 — 아래 `useEscapeKey` 가 문서 레벨에서 받는다.
         커서·포커스 조건에 묶여 있던 탓에 딥링크로 막 연 화면의 첫 ESC 가 죽었다. */
      if (event.key === 'Escape') return

      if (!pointerInside) return
      const pair = viewKeys[event.key]
      if (pair) {
        event.preventDefault()
        setViewDirection(camera, controls, event.ctrlKey || event.metaKey ? pair[1] : pair[0])
        return
      }
      if (event.key === '.') {
        // 선택된 블록에 맞춘다 — 없으면 전체
        event.preventDefault()
        const focus = focusBlock ?? null
        if (focus) {
          const [fx, fy, fz] = focus.transform.position
          const { length, width, height } = focus.dimensions
          const half = new THREE.Vector3(width / 2, height / 2, length / 2)
          const center = new THREE.Vector3(fx, fy + JIG_HEIGHT + height / 2, fz)
          frameBox(camera, controls, new THREE.Box3(center.clone().sub(half), center.clone().add(half)))
        } else {
          frameBox(camera, controls, sceneBox)
        }
        return
      }
      if (event.key === 'Home') {
        event.preventDefault()
        resetToHome(camera, controls, home)
      }
    }
    window.addEventListener('keydown', handleViewportKey)

    /*
     * 그리기 루프 — 카메라가 멈추고 아무 요청도 없으면 쉬고, 탭이 숨으면 아예 멈춘다.
     * 예전에는 정지 화면도 탭 뒤의 화면도 초당 60장씩 그렸다. 규칙과 검증은
     * `lib/renderLoop` 에 있다(화면의 모습은 바뀌지 않는다).
     */
    const loop = startRenderLoop({
      controls,
      render: () => {
        renderer.render(scene, camera)
        labelRenderer.render(scene, camera)
      },
    })
    requestRenderRef.current = loop.requestRender

    /*
     * 손이 닿아 있는 동안은 유휴 판정을 끈다 — 드래그 중에도 카메라가 안 움직이는
     * 프레임이 있고(각도 한계에 걸리거나 포인터가 잠시 멎은 순간), 그 프레임을 건너뛰면
     * 손보다 화면이 한 박자 늦는다. `end` 뒤에는 유예가 다시 열려 관성이 끝까지 그려진다.
     */
    const beginInteract = () => loop.setInteracting(true)
    const endInteract = () => loop.setInteracting(false)
    controls.addEventListener('start', beginInteract)
    controls.addEventListener('end', endInteract)

    const resizeObserver = new ResizeObserver(() => {
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
      labelRenderer.setSize(container.clientWidth, container.clientHeight)
      // 뷰포트 크기가 바뀌면 가장자리 표식 자리도 다시 재야 한다
      scheduleAxisView()
      requestRenderRef.current?.()
    })
    resizeObserver.observe(container)

    // 여기까지 왔으면 첫 프레임을 그릴 준비가 끝났다 — 스피너를 내린다
    setBuilding(false)

    return () => {
      loop.stop()
      requestRenderRef.current = null
      if (axisFrame) cancelAnimationFrame(axisFrame)
      controls.removeEventListener('start', beginInteract)
      controls.removeEventListener('end', endInteract)
      controls.removeEventListener('change', scheduleAxisView)
      refreshOverlayRef.current = null
      viewApiRef.current = null
      stopEdgeQueue()
      unbindButtons()
      focusApiRef.current = null
      focusApi.dispose()
      unclampPan()
      unsubscribeQuality()
      tweenCancelRef.current?.()
      tweenCancelRef.current = null
      window.clearTimeout(wheelHintTimer.current)
      container.removeEventListener('pointerdown', cancelTweenOnPointerDown)
      renderer.domElement.removeEventListener('pointerdown', handleCanvasPointerDown)
      renderer.domElement.removeEventListener('pointerup', handleCanvasPointerUp)
      renderer.domElement.removeEventListener('pointerenter', markInside)
      renderer.domElement.removeEventListener('pointerleave', markOutside)
      window.removeEventListener('keydown', handleViewportKey)
      resizeObserver.disconnect()
      controls.dispose()
      sceneRefs.current = null

      /*
       * GPU 자원 해제는 `lib/disposeScene` 이 한다 — 손으로 쓴 traverse 는 재질이 쥔
       * **텍스처**와 Mesh/Points/Line 이 아닌 객체를 놓치고 있었고, 렌더러는 dispose 만으론
       * WebGL 컨텍스트를 돌려주지 않았다(열고 닫기를 반복하면 한도를 넘어 다른 뷰어가
       * 검게 변한다). 규칙을 한 곳에 모아 두면 테스트가 "10회 반복 후 평평"을 지킨다.
       */
      for (const backdrop of refs.backdrops.values()) backdrop.dispose()
      refs.backdrops.clear()
      disposeScene(scene)
      disposeRenderer(renderer)
      /* CSS2D 라벨은 GPU 자원이 아니라 DOM 이다 — 렌더러 요소째 떼어 낸다 */
      labelRenderer.domElement.parentNode?.removeChild(labelRenderer.domElement)
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- 입력(mode·bays·선택 블록)은 buildRequest 를 통해서만 들어온다: 스피너를 먼저 그리려고 한 프레임 늦춘 것이라 여기 직접 담으면 지연이 사라진다
  }, [buildRequest])

  return (
    /*
     * 캔버스를 담는 칸과 그 위에 얹는 것(기즈모·스피너)을 나눈다.
     * three.js 가 appendChild 로 캔버스를 넣는 칸에 React 자식까지 섞으면
     * 두 쪽이 같은 DOM 을 각자 관리하게 된다 — 안쪽 칸은 three.js 전용으로 둔다.
     */
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-inshop-lg border border-border',
        className ?? 'h-[72vh] min-h-[480px]',
      )}
    >
      <div ref={containerRef} className="absolute inset-0" />

      <LiveAxisGizmo
        store={axisStore}
        onSelectDirection={handleAxisSelect}
        onGoHome={handleGoHome}
      />

      {wheelHint && <WheelZoomHint />}

      {/*
        화면 밖 이상 정반 표식 (FR-9) — 카메라를 따라 매 프레임 자리가 바뀌므로
        저장소를 구독하는 잎에 맡긴다(뷰어 본체는 이 때문에 리렌더되지 않는다).
      */}
      {mode === 'factory' && !building && (
        <LiveOffscreenMarks
          store={marksStore}
          onSelect={(id) => onBaySelectRef.current?.(id)}
        />
      )}

      {/* 카메라 맞춤 · 레이어 토글 (FR-3·FR-4) — 공장 뷰 전용 도구 묶음.
          아래 가운데에 둔다: 왼쪽 아래는 축 기즈모, 오른쪽 아래는 도움말 자리다 */}
      {mode === 'factory' && !building && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
          {layersOpen && (
            <div className="flex animate-fade-in flex-col gap-1.5 rounded-inshop-lg glass-panel p-2.5">
              {LAYER_OPTIONS.map(({ key, labelKey }) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 text-2xs text-glass-foreground/85"
                >
                  <input
                    type="checkbox"
                    checked={layers[key]}
                    onChange={() => setLayers((state) => ({ ...state, [key]: !state[key] }))}
                    className="h-3 w-3 accent-(--glass-accent)"
                  />
                  {t(labelKey)}
                </label>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={handleFitAll} className={GLASS_BUTTON_CLASS}>
              {t('viewer.fit.all')}
            </button>
            {selectedBayId && (
              <button type="button" onClick={handleFitSelected} className={GLASS_BUTTON_CLASS}>
                {t('viewer.fit.selected')}
              </button>
            )}
            <button type="button" onClick={handleResetView} className={GLASS_BUTTON_CLASS}>
              {t('viewer.fit.home')}
            </button>
            <button
              type="button"
              onClick={() => setLayersOpen((open) => !open)}
              aria-expanded={layersOpen}
              className={cn(GLASS_BUTTON_CLASS, layersOpen && 'text-glass-accent')}
            >
              {t('viewer.layers.toggle')}
            </button>
          </div>
        </div>
      )}

      {building && <SpinnerOverlay label={t('viewer.building')} />}
    </div>
  )
}
