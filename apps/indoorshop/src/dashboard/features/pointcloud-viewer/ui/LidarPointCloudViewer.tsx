import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import type { TFunction } from 'i18next'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { cn } from '../../../shared/lib/utils'
import type { LidarBlockInfo } from '../../../entities/lidar-block/model/types'
import { formatDetectionId } from '../../../entities/lidar-block/model/types'
import type { LidarSensor } from '../../../entities/lidar-sensor/model/types'
import type { Location } from '../../../entities/location/model/types'
import type { LoadedBlockModel } from '../../../entities/block-model/model/types'
import { getMergedAssemblyPositions, getRestPose } from '../../../entities/block-model/model/types'
import type { LidarBlockTransform } from '../../../entities/lidar-block/model/types'
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
import { makeLabelObject, createBlockLabel, createBayLabel } from '../lib/labelCards'
import { createBackdrop } from '../lib/backdrop'
import { ViewportAxisGizmo } from './ViewportAxisGizmo'
import { SpinnerOverlay } from '../../../shared/ui/atoms/Spinner'
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
  onSelectBlock?: (blockId: string) => void
  onSelectBay?: (locationId: string) => void
  /**
   * 목록에서 가리키고 있는 정반 — 3D 쪽 경계선·라벨이 같이 켜진다.
   * 목록과 3D 가 같은 정반을 말하고 있다는 것을 보여주는 유일한 연결선이다.
   */
  highlightedBayId?: string | null
  /** 3D 쪽 정반 라벨에 손을 얹었을 때 — 목록 쪽 강조를 같은 값으로 맞춘다 */
  onHoverBay?: (locationId: string | null) => void
  /**
   * 뷰포트 크기 규칙 override.
   * 기본은 문서 안에 놓이는 고정 높이지만, 고정 화면에서는 부모 칸을 꽉 채워야 한다.
   * (크기 변화는 내부 ResizeObserver 가 카메라·렌더러에 그대로 반영한다)
   */
  className?: string
}

/** 탭에서 가리킨 정반의 경계선 색 — 두 모드 모두에서 바탕과 갈리는 밝은 주황 */
const BAY_HIGHLIGHT_COLOR = 0xffa347
const POINT_SIZE = 0.16
/** 공장 뷰에서 정반 간 배치 간격(폭 방향) */
const BAY_PITCH = BAY_WIDTH + 10
/** 공장 뷰 다운샘플 배율 */
const FACTORY_DENSITY = 0.3

function createBayBoundary(color: number): THREE.LineSegments {
  const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(BAY_WIDTH, BAY_HEIGHT, BAY_LENGTH))
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
  onSelectBlock,
  onSelectBay,
  highlightedBayId = null,
  onHoverBay,
  className,
}: LidarPointCloudViewerProps) {
  const { t, i18n } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)

  // 콜백은 ref로 우회해 scene 재구성 없이 최신 핸들러를 유지
  const onSelectBlockRef = useRef(onSelectBlock)
  onSelectBlockRef.current = onSelectBlock
  const onSelectBayRef = useRef(onSelectBay)
  onSelectBayRef.current = onSelectBay
  const onHoverBayRef = useRef(onHoverBay)
  onHoverBayRef.current = onHoverBay

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
    /** 공장 뷰 정반별 강조 대상 — 목록 hover 와 3D 를 잇는다 */
    bayHighlights: { locationId: string; boundary: THREE.LineSegments | null; card: HTMLElement | null }[]
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

  /** 기즈모가 조작할 카메라 — 씬 빌드가 끝나야 생긴다 */
  const viewApiRef = useRef<{
    camera: THREE.PerspectiveCamera
    controls: OrbitControls
    home: HomePose
  } | null>(null)
  const [axisView, setAxisView] = useState<AxisViewState | null>(null)

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

  /** 강조된 정반의 경계선·라벨만 켠다 (geometry·재질 재생성 없음) */
  const applyBayHighlight = useCallback(() => {
    const refs = sceneRefs.current
    if (!refs) return
    const palette = paletteFor(displayRef.current.displayMode)
    const current = highlightRef.current

    for (const entry of refs.bayHighlights) {
      const on = entry.locationId === current
      if (entry.boundary) {
        const material = entry.boundary.material as THREE.LineBasicMaterial
        material.color.setHex(on ? BAY_HIGHLIGHT_COLOR : palette.boundaryColor)
        material.opacity = on ? 1 : 0.6
      }
      if (entry.card) {
        // 라벨은 CSS2D(DOM)라 Tailwind 대신 토큰을 직접 쓴다
        entry.card.style.borderColor = on ? 'var(--accent)' : ''
        entry.card.style.boxShadow = on ? '0 0 0 2px var(--accent)' : ''
      }
    }
  }, [])

  /** 재질·가시성·색만 갱신한다 (geometry 유지) */
  const applyDisplay = useCallback(() => {
    const refs = sceneRefs.current
    if (!refs) return
    const { displayMode: dm, colorMode: cm, showOutline: so } = displayRef.current
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
    const presentVisible = cadVisible && !(diffActive && dm === 'overlay')
    for (const mesh of refs.cadMeshes) mesh.visible = presentVisible

    for (const fill of refs.diffFills) {
      fill.visible = diffActive
      const material = fill.material as THREE.MeshLambertMaterial
      material.opacity = dm === 'cad' ? MISSING_FILL_OPACITY.cad : MISSING_FILL_OPACITY.overlay
    }
    for (const edges of refs.diffEdges) edges.visible = diffActive
    for (const callout of refs.callouts) callout.visible = diffActive

    const pointsVisible = showsPoints(dm)
    for (const group of refs.pointGroups) group.visible = pointsVisible

    // CAD 모드에서는 센서 마커를 숨긴다 — 도면 형상만 남겨야 도면으로 읽힌다
    for (const marker of refs.sensorMarkers) marker.visible = dm !== 'cad'

    for (const material of refs.edgeMaterials) {
      material.color.setHex(palette.edgeColor)
      material.opacity = palette.edgeOpacity
    }
    for (const outline of refs.outlines) outline.visible = so

    // 인식 범위 표시선 — 밝은 CAD 배경에서는 진한 스텝을 쓴다
    for (const marker of refs.markers) {
      marker.lines.visible = so
      const material = marker.lines.material as THREE.LineBasicMaterial
      if (dm === 'cad') {
        material.color.setHex(marker.registered ? 0x8a6d1f : 0x991b1b)
      } else {
        material.color.setHex(marker.registered ? 0xfbbf24 : 0xdc2626)
      }
    }

    // 핀지그와 센서는 실측 설비이지 도면 형상이 아니다
    for (const jig of refs.jigGroups) jig.visible = dm !== 'cad'
    for (const boundary of refs.boundaries) {
      ;(boundary.material as THREE.LineBasicMaterial).color.setHex(palette.boundaryColor)
    }
    for (const grid of refs.grids) {
      // 바닥은 어느 모드에서나 있어야 점이 어디에 놓였는지 읽힌다
      grid.visible = true
      const material = grid.material as THREE.LineBasicMaterial
      material.color.setHex(palette.gridColor)
      material.opacity = palette.gridOpacity
    }

    if (pointsVisible) {
      applyPointColors(refs.clouds, cm, {
        sensorColors: SENSOR_POINT_COLORS,
        minY: refs.minY,
        maxY: refs.maxY,
      })
    }

    // 경계선 색을 팔레트로 되돌린 뒤이므로, 강조는 항상 마지막에 다시 얹는다
    applyBayHighlight()
  }, [applyBayHighlight])

  // 모드·규칙 전환 — 씬을 다시 만들지 않는다
  useEffect(() => {
    applyDisplay()
  }, [applyDisplay, displayMode, colorMode, showOutline])

  useEffect(() => {
    applyBayHighlight()
  }, [applyBayHighlight, highlightedBayId])

  /*
   * 빌드 예약.
   *
   * 같은 틱에서 씬을 만들면 브라우저는 그 사이 한 프레임도 그리지 못해 스피너가
   * 아예 나타나지 않는다. 두 프레임(레이아웃 → 페인트)을 흘려보낸 뒤 빌드를 건다.
   * 그동안 이전 씬은 그대로 서 있고 그 위에 스피너만 덮이므로 화면이 비지 않는다.
   */
  useEffect(() => {
    setBuilding(true)
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setBuildRequest((request) => request + 1))
    })
    return () => cancelAnimationFrame(frame)
    // 3D 라벨(CSS2D)은 씬을 세울 때 만든 DOM 이다 — 언어가 바뀌면 다시 세워야 글자가 따라온다
  }, [mode, bays, selectedBlockId, i18n.language])

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
      bayHighlights: [] as {
        locationId: string
        boundary: THREE.LineSegments | null
        card: HTMLElement | null
      }[],
      grids: [] as THREE.LineSegments[],
      backdrops: new Map<string, THREE.CanvasTexture>(),
      edgeMaterials: [] as THREE.LineBasicMaterial[],
      minY: 0,
      maxY: 1,
    }
    sceneRefs.current = refs

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      800
    )

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)

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
    applyBlenderMouseBindings(controls)
    const unbindButtons = bindModifierAwareButtons(controls, renderer.domElement)

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

    bays.forEach((bay, bayIndex) => {
      const bayGroup = new THREE.Group()
      /** 이 정반의 경계선 — 공장 뷰에서 목록 강조 대상으로 잡아 둔다 */
      let bayBoundary: THREE.LineSegments | null = null
      if (mode === 'factory') bayGroup.position.x = bayIndex * BAY_PITCH

      const density = mode === 'factory' ? FACTORY_DENSITY : 1
      const sensorPositions = getSensorPositions(bay.sensors.length)
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
        const boundary = createBayBoundary(0x334155)
        bayBoundary = boundary
        refs.boundaries.push(boundary)
        bayGroup.add(boundary)

        const grid = createLineSegments(createFloorGrid(BAY_WIDTH, BAY_LENGTH, 2), 0x3a4a5c, 0.35)
        refs.grids.push(grid)
        bayGroup.add(grid)
      }

      // ══ pass 2 ══ 센서별 스캔 → 점군. 블록 표면 점을 대조용으로 모은다
      const pointGroup = new THREE.Group()
      refs.pointGroups.push(pointGroup)
      bayGroup.add(pointGroup)

      /** detection index → 그 블록 표면에서 나온 실측 점 (바닥·지그는 넣지 않는다) */
      const blockHitsByDetection: { positions: Float32Array; normals: Float32Array }[][] =
        prepared.map(() => [])

      bay.sensors.forEach((sensor, index) => {
        const position = sensorPositions[index]
        if (!position) return

        const color = SENSOR_POINT_COLORS[index % SENSOR_POINT_COLORS.length]
        const isOnline = sensor.status === 'online'
        if (!focusBlock) {
          const marker = createSensorMarker(position, SENSOR_TARGET, color, isOnline)
          refs.sensorMarkers.push(marker)
          bayGroup.add(marker)
        }
        if (!isOnline) return

        if (!focusBlock) {
          const surface = simulateBaySurfaceScan(position, SENSOR_TARGET, obstacles, density)
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
        .map((sensor, index) => ({ sensor, position: sensorPositions[index] }))
        .filter((s) => s.sensor.status === 'online' && s.position)
        .map((s) => ({ position: s.position, target: SENSOR_TARGET }))

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
        const label = createBayLabel(
          bay.location.name,
          bay.location.workCntr,
          new THREE.Vector3(0, BAY_HEIGHT + 2, 0),
          t,
          () => onSelectBayRef.current?.(bay.location.id),
          (hovering) => onHoverBayRef.current?.(hovering ? bay.location.id : null)
        )
        bayGroup.add(label)
        refs.bayHighlights.push({
          locationId: bay.location.id,
          boundary: bayBoundary,
          // 라벨 wrap 의 첫 자식이 실제 카드다 (createBayLabel 참조)
          card: label.element.firstElementChild as HTMLElement | null,
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

    // 모드별 카메라/타겟
    if (mode === 'factory') {
      const centerX = ((bays.length - 1) * BAY_PITCH) / 2
      camera.position.set(centerX + 60, 58, 115)
      controls.target.set(centerX, 2, 0)
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

    /** 씬 전체 bounding box — '.' 키에서 선택 대상이 없을 때의 맞춤 기준 */
    const sceneBox = new THREE.Box3().setFromObject(scene)

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
    viewApiRef.current = { camera, controls, home }
    let axisFrame = 0
    const publishAxisView = () => {
      axisFrame = 0
      setAxisView(projectAxes(camera, controls.target))
    }
    const scheduleAxisView = () => {
      if (axisFrame) return
      axisFrame = requestAnimationFrame(publishAxisView)
    }
    controls.addEventListener('change', scheduleAxisView)
    publishAxisView()

    const viewKeys: Record<string, [ViewDirection, ViewDirection]> = {
      // [기본, Ctrl 조합(반대편)]
      '1': ['front', 'back'],
      '3': ['right', 'left'],
      '7': ['top', 'bottom'],
    }

    const handleViewportKey = (event: KeyboardEvent) => {
      if (!pointerInside) return
      // 입력 중인 필드의 키를 가로채지 않는다
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '')) return

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

    let animationId: number
    function animate() {
      animationId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
      labelRenderer.render(scene, camera)
    }
    animate()

    const resizeObserver = new ResizeObserver(() => {
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
      labelRenderer.setSize(container.clientWidth, container.clientHeight)
    })
    resizeObserver.observe(container)

    // 여기까지 왔으면 첫 프레임을 그릴 준비가 끝났다 — 스피너를 내린다
    setBuilding(false)

    return () => {
      cancelAnimationFrame(animationId)
      if (axisFrame) cancelAnimationFrame(axisFrame)
      controls.removeEventListener('change', scheduleAxisView)
      viewApiRef.current = null
      stopEdgeQueue()
      unbindButtons()
      renderer.domElement.removeEventListener('pointerenter', markInside)
      renderer.domElement.removeEventListener('pointerleave', markOutside)
      window.removeEventListener('keydown', handleViewportKey)
      resizeObserver.disconnect()
      controls.dispose()
      sceneRefs.current = null

      scene.traverse((obj) => {
        if (
          obj instanceof THREE.Points ||
          obj instanceof THREE.Mesh ||
          obj instanceof THREE.Line
        ) {
          obj.geometry.dispose()
          const material = obj.material
          if (Array.isArray(material)) {
            material.forEach((m) => m.dispose())
          } else {
            material.dispose()
          }
        }
      })

      for (const backdrop of refs.backdrops.values()) backdrop.dispose()
      renderer.dispose()
      container.removeChild(renderer.domElement)
      container.removeChild(labelRenderer.domElement)
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

      <ViewportAxisGizmo
        view={axisView}
        onSelectDirection={handleAxisSelect}
        onGoHome={handleGoHome}
      />

      {building && <SpinnerOverlay label={t('viewer.building')} />}
    </div>
  )
}
