import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { bindViewportFocus } from '../../../../shared/features/bay-viewer/lib/viewportInput'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { cn } from '../../../../shared/lib/utils'
import { SpinnerOverlay } from '../../../../shared/ui/atoms/Spinner'
import { useAsyncData } from '../../../../shared/lib/useAsyncData'
import type { LidarBlockInfo } from '../../../../shared/features/bay-viewer/model/lidarBlock'
import type { Location } from '../../../../shared/entities/location/model/types'
import {
  loadRealScanManifest,
  loadRealCadMeshes,
  loadRealCloud,
  loadRealLabels,
  loadRealShade,
  assertRealSceneConsistent,
  realGroupKeyOf,
  FLOOR,
  UNLABELED,
  type RealCadMesh,
  type RealSceneMeta,
  type RealBlockPlacement,
  type RealBayBand,
  type RealGroupKey,
  type RealRect,
} from '../../api/realScanAssets'
import {
  MATCH_NEUTRALS,
  paletteFor,
  showsPoints,
  showsCad,
  type ViewerDisplayMode,
  type ViewPalette,
} from '../../../../shared/features/bay-viewer/lib/displayModes'
import {
  OBJECT_COLORS,
  ELEVATION_STOPS,
  objectBlockColor,
  segmentBlockColor,
  segmentBlockHex,
} from '../../../../shared/features/bay-viewer/lib/pointColorRules'
import type { PointColorMode } from '../../../../shared/features/bay-viewer/lib/colorModes'
import {
  applyBlenderMouseBindings,
  bindModifierAwareButtons,
  setViewDirection,
  frameBox,
  captureHomePose,
  resetToHome,
  type ViewDirection,
} from '../../../../shared/features/bay-viewer/lib/blenderControls'
import { projectAxes, type AxisViewState } from '../../../../shared/features/bay-viewer/lib/axisGizmo'
import { createLineSegments } from '../../../../shared/features/bay-viewer/lib/outlineGeometry'
import {
  createBandStripe,
  createBandFill,
  createBandCorners,
  createBandPillars,
  createLabelLeader,
  createRectGrid,
  rectToBox,
} from '../../lib/bayFootprint'
import { createBlockLabel, createBayLabel } from '../../../../shared/features/bay-viewer/lib/labelCards'
import { createBackdrop } from '../../../../shared/features/bay-viewer/lib/backdrop'
import { SENSOR_POINT_COLORS } from '../../../../shared/features/bay-viewer/lib/bayConfig'
import { ViewportAxisGizmo } from '../../../../shared/features/bay-viewer/ui/ViewportAxisGizmo'
import { WheelZoomHint } from '../../../../shared/features/bay-viewer/ui/WheelZoomHint'

/**
 * 실측 스캔 뷰어 — PBS 5BAY 실측(20251220 스냅샷, 호선 5510) 전용.
 *
 * 시뮬레이션 뷰어(`LidarPointCloudViewer`)와 달리 점군을 만들지 않는다:
 * `public/real-scan/` 의 정합 점군(bin)·점별 블록 라벨·CAD 오버레이 메쉬를 그대로 올린다.
 * CAD 로컬 프레임은 **정점 centroid 원점**이고 배치 행렬은 데이터 제공사의
 * T_scene_cad 그대로다 (manifest 생성 시 표면 오차 중앙값 4~12cm 검증됨) —
 * 여기서 형상을 재정렬하거나 행렬을 보정하지 않는다.
 *
 * 세그멘테이션(점 → 블록 분류)·바닥 판정·점별 음영도 뷰어가 하지 않는다 — 변환
 * 스크립트가 CAD 표면 거리로 라벨링하고 국소 법선으로 음영까지 구워 둔 것을 읽기만 한다.
 * 네 뷰가 같은 display 프레임을 쓰고 y=0 이 홀 바닥이라, 베이 구획·그리드·카메라를
 * 공장 뷰와 베이 뷰가 그대로 공유한다.
 */

interface RealScanViewerProps {
  /** factory: 12대 전체 정합 스캔 + 그룹 라벨 / bay: 정반 하나 + 블록 라벨 */
  mode: 'factory' | 'bay'
  /** bay 모드에서만 필요 — 실측 location id. 그룹 접미사(-g1…)가 없으면 홀 전체(PBS 5BAY) */
  locationId?: string
  /** 구획(G1~G3) 라벨용 목록 — id 끝 그룹 접미사로 manifest 밴드와 맞물린다 */
  bayLocations?: Location[]
  /** bay 모드의 인식 목록 — 라벨 카드가 신뢰도·ID 를 여기서 읽는다 */
  blocks?: LidarBlockInfo[]
  selectedBlockId?: string | null
  displayMode?: ViewerDisplayMode
  colorMode?: PointColorMode
  showOutline?: boolean
  onSelectBlock?: (blockId: string) => void
  onSelectBay?: (locationId: string) => void
  highlightedBayId?: string | null
  onHoverBay?: (locationId: string | null) => void
  className?: string
  /** 센서 카드 클릭으로 요청된 센서 인덱스와 반복 요청 식별자 */
  sensorFocus?: { index: number; request: number } | null
}

/** 실측 점군 기본 점 크기(m) — 밀도가 높아 큰 점은 뭉개진다. 뷰포트 슬라이더로 조절 */
const DEFAULT_POINT_SIZE = 0.02
const POINT_SIZE_MIN = 0.005
const POINT_SIZE_MAX = 0.12
/** 단독 뷰의 CAD 는 비교 대상 본체다 — 겹쳐보기 투명도(0.2)로는 점군에 묻힌다 */
const FOCUS_CAD_MIN_OPACITY = 0.45
const GROUP_HIGHLIGHT_COLOR = 0xffa347
/** 베이 라벨이 뜨는 높이(m) — 갠트리(약 6m)보다 위에 둬야 점군에 묻히지 않는다 */
const BAY_LABEL_HEIGHT = 9
/** 계단식 블록 라벨의 한 칸 높이(m) — 화면 높이 기준 */
const BLOCK_LABEL_STEP = 2.4
/**
 * 깊이 → 화면 높이 환산 계수. 기본 카메라가 약 30° 내려다보므로 1m 뒤로 갈수록
 * 화면에서 약 0.5m 위로 올라간다 — 계단 간격을 이 값으로 보정한다.
 */
const BLOCK_LABEL_DEPTH_LIFT = 0.5
/** 구획 기둥 높이(m) — 갠트리(약 6m)까지 세우면 화면이 기둥으로 뒤덮인다 */
const BAY_POST_HEIGHT = 3
/** 카메라 프레이밍 여유(m) */
const FRAME_MARGIN_M = 6
/**
 * 음영 반영 강도 — 색 × (SHADE_FLOOR + (1-SHADE_FLOOR) × shade).
 * 1로 곱하면 그늘진 면이 새까매져 형상이 되레 사라진다.
 */
const SHADE_FLOOR = 0.35

/* 미지정 prop 의 기본값 — 렌더마다 새 배열이면 씬 빌드 effect 가 무한히 돈다 */
const EMPTY_BLOCKS: LidarBlockInfo[] = []
const EMPTY_LOCATIONS: Location[] = []

/** display 좌표 bounds → Box3 */
function toBox3(bounds: { min: [number, number, number]; max: [number, number, number] }): THREE.Box3 {
  return new THREE.Box3(new THREE.Vector3(...bounds.min), new THREE.Vector3(...bounds.max))
}

/** 가장 카메라 쪽(=+Z)에 있는 블록의 Z — 라벨 계단의 깊이 보정 기준점 */
function zBackOf(placements: RealBlockPlacement[]): number {
  return Math.max(...placements.map((placement) => placement.center[2]))
}

/** manifest 의 row-major 4×4 → three Matrix4 */
function placementMatrix(placement: RealBlockPlacement): THREE.Matrix4 {
  return new THREE.Matrix4().set(...(placement.matrix as Parameters<THREE.Matrix4['set']>))
}

/** 갠트리 라이다 마커 — 기둥 + 퍽. 실측 extrinsic 위치에 세운다 */
function createRealSensorMarker(
  position: [number, number, number],
  color: string
): THREE.Group {
  const group = new THREE.Group()
  const [x, y, z] = position
  // 그룹 원점이 아니라 manifest가 준 센서 본체 위치로 카메라를 이동시킨다.
  group.userData.focusPosition = new THREE.Vector3(x, y, z)
  const steel = new THREE.MeshLambertMaterial({ color: 0x5b6673 })
  const dark = new THREE.MeshLambertMaterial({ color: 0x232d3a })

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, y, 8), steel)
  pole.position.set(x, y / 2, z)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.28, 16), dark)
  body.position.set(x, y + 0.14, z)
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 0.09, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color) })
  )
  ring.position.set(x, y + 0.14, z)
  group.add(pole, body, ring)
  return group
}

/** bbox 12개 모서리 선분 (블록 선택 강조용) */
function boxEdgePositions(box: THREE.Box3): Float32Array {
  const { min, max } = box
  const c = [
    [min.x, min.y, min.z], [max.x, min.y, min.z], [max.x, min.y, max.z], [min.x, min.y, max.z],
    [min.x, max.y, min.z], [max.x, max.y, min.z], [max.x, max.y, max.z], [min.x, max.y, max.z],
  ]
  const pairs = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ]
  const out = new Float32Array(pairs.length * 6)
  pairs.forEach(([a, b], i) => {
    out.set(c[a], i * 6)
    out.set(c[b], i * 6 + 3)
  })
  return out
}

/** 색칠 대상 점군 하나 — 라벨·음영을 함께 들고 있어 규칙 전환이 점 단위로 성립한다 */
interface RealCloud {
  points: THREE.Points
  sensorIndex: number
  /** 이 점군 구간의 블록 라벨 (cloud 와 같은 순서) — 단독 뷰 점군은 라벨이 하나라 null */
  labels: Uint8Array | null
  /** labels 가 null 일 때 전체에 적용할 라벨 (단독 뷰의 블록 인덱스) */
  fixedLabel: number | null
  /** 점별 의사 반사강도 (0..255) — 색상 규칙과 무관하게 곱해 명암을 준다 */
  shade: Uint8Array | null
}

const ELEVATION = ELEVATION_STOPS.map((hex) => new THREE.Color(hex))
const OBJECT_JIG_COLOR = new THREE.Color(OBJECT_COLORS.jig)
const PLAIN_POINT_COLOR = new THREE.Color(0x8b95a1)
/*
 * `CAD 정합` 규칙의 무채색 — 센서가 보긴 했지만 CAD 표면에 붙지 않은 점.
 * 정합된 실측점만 색을 갖게 하려면 나머지는 색을 완전히 비워야 한다 (흰색~회색).
 * 바닥은 점의 40% 가까이 되므로 같은 밝기로 두면 화면이 흰 판이 된다 — 한 단 눌러 깐다.
 */
const MATCH_REST_COLOR = new THREE.Color(MATCH_NEUTRALS.rest)
const MATCH_FLOOR_COLOR = new THREE.Color(MATCH_NEUTRALS.floor)
/*
 * 블록 라벨 → 색. 실측 뷰어는 목업의 8색 hue 순환(objectBlockColor)이 아니라
 * 13색 세그멘테이션 팔레트를 쓴다 — 공장 뷰에 블록이 13종이라 8색이면 색이 겹친다.
 * `객체` 규칙만 목업과 같은 색을 유지한다 (그쪽은 detection 수가 적다).
 */
const BLOCK_LABEL_COLORS = Array.from({ length: 13 }, (_, i) => segmentBlockColor(i))
const OBJECT_MODE_BLOCK_COLORS = Array.from({ length: 16 }, (_, i) => objectBlockColor(i))
/*
 * CAD 오버레이를 블록 세그멘테이션과 **같은 계열**로 묶는다.
 * 도면 솔리드가 전부 한 색(호박색)이면 "이 껍데기가 저 색 점 무리와 짝" 이라는 것이
 * 눈으로 안 이어져서, 정합이 맞는지 틀리는지를 위치로만 가늠하게 된다.
 *  - 솔리드: 블록색을 흰색 쪽으로 당긴 옅은 같은 계열 — 껍데기(도면)로 읽히게
 *  - 특징선: 블록색 그대로 — 형상 경계가 어느 블록 것인지 바로 읽히게
 */
const CAD_TINT_WHITE = new THREE.Color(0xffffff)
const BLOCK_CAD_COLORS = BLOCK_LABEL_COLORS.map((color) =>
  color.clone().lerp(CAD_TINT_WHITE, 0.35).getHex()
)
const BLOCK_EDGE_COLORS = BLOCK_LABEL_COLORS.map((color) => color.getHex())
const blockCadColor = (index: number) => BLOCK_CAD_COLORS[index % BLOCK_CAD_COLORS.length]
const blockEdgeColor = (index: number) => BLOCK_EDGE_COLORS[index % BLOCK_EDGE_COLORS.length]

function elevationColor(t: number, out: THREE.Color): THREE.Color {
  const x = Math.min(1, Math.max(0, t)) * (ELEVATION.length - 1)
  const i = Math.min(ELEVATION.length - 2, Math.floor(x))
  return out.copy(ELEVATION[i]).lerp(ELEVATION[i + 1], x - i)
}

/**
 * 실측 점군 색칠 — 시뮬레이션 쪽 `applyPointColors` 와 달리 점 하나가 어느 블록인지가
 * 점군 단위가 아니라 **점별 라벨**로 온다 (실측 스캔은 한 센서 구간에 여러 블록이 섞인다).
 *
 * 규칙과 별개로 두 가지를 항상 적용한다:
 *  - 바닥(FLOOR)은 눌러 깐다. 홀 바닥이 점의 40%라 같이 칠하면 조립품이 안 뜬다
 *    (`CAD 정합` 규칙만 팔레트 색 대신 자기 회색으로 누른다 — 아래 주석 참조).
 *  - 점별 음영을 곱한다. 이 데이터셋은 intensity 가 전부 0 이라 안 곱하면 색면이 된다.
 */
function applyRealPointColors(
  clouds: RealCloud[],
  mode: PointColorMode,
  ctx: { sensorColors: string[]; minY: number; maxY: number; floorColor: number }
): void {
  const base = new THREE.Color()
  const floor = new THREE.Color(ctx.floorColor)
  const span = Math.max(1e-3, ctx.maxY - ctx.minY)

  for (const cloud of clouds) {
    const geometry = cloud.points.geometry
    const position = geometry.getAttribute('position')
    if (!position) continue
    const count = position.count

    let attr = geometry.getAttribute('color') as THREE.BufferAttribute | undefined
    if (!attr || attr.count !== count) {
      attr = new THREE.BufferAttribute(new Float32Array(count * 3), 3)
      geometry.setAttribute('color', attr)
    }
    const colors = attr.array as Float32Array

    const flat: THREE.Color | null =
      mode === 'sensor'
        ? new THREE.Color(ctx.sensorColors[cloud.sensorIndex % ctx.sensorColors.length])
        : mode === 'height' || mode === 'object' || mode === 'match'
          ? null
          : PLAIN_POINT_COLOR

    for (let i = 0; i < count; i++) {
      const label = cloud.fixedLabel ?? cloud.labels?.[i] ?? UNLABELED
      if (mode === 'match') {
        /*
         * CAD 정합 규칙: 색은 **정합된 실측점**만 갖는다.
         * 바닥은 여기서 팔레트 색(floor)을 쓰지 않는다 — 규칙 자체가 무채색이라
         * 어두운 팔레트 바닥을 섞으면 "흰색·회색 배경 + 색 블록" 대비가 깨진다.
         */
        if (label === FLOOR) base.copy(MATCH_FLOOR_COLOR)
        else if (label === UNLABELED) base.copy(MATCH_REST_COLOR)
        else base.copy(BLOCK_LABEL_COLORS[label % BLOCK_LABEL_COLORS.length])
      } else if (label === FLOOR) {
        base.copy(floor)
      } else if (mode === 'height') {
        elevationColor((position.getY(i) - ctx.minY) / span, base)
      } else if (mode === 'object') {
        if (label === UNLABELED) base.copy(OBJECT_JIG_COLOR)
        else base.copy(OBJECT_MODE_BLOCK_COLORS[label % OBJECT_MODE_BLOCK_COLORS.length])
      } else if (flat) {
        base.copy(flat)
      }
      const shade = cloud.shade
        ? SHADE_FLOOR + ((1 - SHADE_FLOOR) * cloud.shade[i]) / 255
        : 1
      colors[i * 3] = base.r * shade
      colors[i * 3 + 1] = base.g * shade
      colors[i * 3 + 2] = base.b * shade
    }
    attr.needsUpdate = true
  }
}

/**
 * 실제로 화면에 칠린 점 수 — 범례가 쓴다.
 *
 * manifest 의 `segmentation.perBlock.matched` 는 **바닥 판정 전** 값이라 조금 크다
 * (CAD 표면에 붙었지만 그 뒤 바닥으로 넘어간 점이 있다 — 실측 g3 에서 약 1,500점).
 * 범례가 색을 설명하는 표인 이상 숫자는 화면과 같아야 하므로 라벨에서 직접 센다.
 */
function countByLabel(labels: Uint8Array, blockCount: number) {
  const blocks = new Uint32Array(blockCount)
  let floor = 0
  let unmatched = 0
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i]
    if (label === FLOOR) floor++
    else if (label === UNLABELED) unmatched++
    else if (label < blockCount) blocks[label]++
  }
  return { blocks, floor, unmatched }
}

interface LoadedRealScene {
  key: string
  meta: RealSceneMeta
  cloud: Float32Array
  labels: Uint8Array
  shade: Uint8Array
  counts: ReturnType<typeof countByLabel>
  meshes: RealCadMesh[]
  /** 홀 크롭 상자 — 카메라가 담을 높이 상한 */
  hall: { min: [number, number, number]; max: [number, number, number] }
  /** 그릴 베이 구획 — 공장 뷰는 셋 다, 베이 뷰는 자기 것 하나 */
  bays: { key: RealGroupKey; band: RealBayBand }[]
}

export function RealScanViewer({
  mode,
  locationId,
  bayLocations = EMPTY_LOCATIONS,
  blocks = EMPTY_BLOCKS,
  selectedBlockId = null,
  displayMode = 'overlay',
  colorMode = 'sensor',
  showOutline = true,
  onSelectBlock,
  onSelectBay,
  highlightedBayId = null,
  onHoverBay,
  className,
  sensorFocus = null,
}: RealScanViewerProps) {
  const { t, i18n } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)

  const onSelectBlockRef = useRef(onSelectBlock)
  onSelectBlockRef.current = onSelectBlock
  const onSelectBayRef = useRef(onSelectBay)
  onSelectBayRef.current = onSelectBay
  const onHoverBayRef = useRef(onHoverBay)
  onHoverBayRef.current = onHoverBay

  const { data: scene3d, loading, error } = useAsyncData<LoadedRealScene>(async () => {
    const manifest = await loadRealScanManifest()
    const groupKey = mode === 'bay' ? realGroupKeyOf(locationId!) : null
    const meta = groupKey ? manifest.groups[groupKey] : manifest.factory
    const [cloud, labels, shade, meshes] = await Promise.all([
      loadRealCloud(meta),
      loadRealLabels(meta),
      loadRealShade(meta),
      loadRealCadMeshes(),
    ])
    assertRealSceneConsistent(meta, cloud, labels, shade)
    return {
      key: groupKey ?? 'factory',
      meta,
      cloud,
      labels,
      shade,
      counts: countByLabel(labels, meta.blocks.length),
      meshes,
      hall: manifest.hall,
      bays: groupKey
        ? [{ key: groupKey, band: manifest.bays[groupKey] }]
        : (Object.keys(manifest.bays) as RealGroupKey[]).map((key) => ({
            key,
            band: manifest.bays[key],
          })),
    }
  }, [mode, locationId])

  /** 모드·규칙 전환이 재사용하는 씬 등록부 — geometry 재생성 없이 재질·색만 바꾼다 */
  const sceneRefs = useRef<{
    scene: THREE.Scene
    hemi: THREE.HemisphereLight
    dir: THREE.DirectionalLight
    /** 블록마다 하나 — 세그멘테이션 색을 입히려면 재질을 공유할 수 없다 */
    cadMaterials: THREE.MeshLambertMaterial[]
    cadMeshes: THREE.Mesh[]
    /** cadMaterials·edgeMaterials 와 같은 순서의 블록 인덱스 (점 라벨 값과 같다) */
    cadBlockIndices: number[]
    /** 인식 블록 바닥 표시 재질 — 표시 모드 팔레트를 따라간다 */
    blockPaint: THREE.MeshBasicMaterial
    /** 블록 바닥 표시 재질 — 블록마다 하나라 세그멘테이션 색을 그대로 받는다 */
    footprintPaints: { material: THREE.MeshBasicMaterial; blockIndex: number }[]
    /** 개관(공장) 뷰에서 CAD 솔리드가 배경에 녹지 않게 잡는 투명도 하한 */
    overviewCadMinOpacity: number
    edgeMaterials: THREE.LineBasicMaterial[]
    outlines: THREE.LineSegments[]
    clouds: RealCloud[]
    pointGroups: THREE.Group[]
    pointMaterial: THREE.PointsMaterial
    /** 블록 단독 뷰 여부 — CAD 를 표시 모드와 무관하게 세운다 */
    focusView: boolean
    sensorMarkers: THREE.Object3D[]
    /** 베이 구획 도색 재질 — 강조 전환이 색만 바꾸면 되도록 묶어 둔다 */
    bayPaints: {
      locationId: string | null
      stripe: THREE.MeshBasicMaterial
      fill: THREE.MeshBasicMaterial
      card: HTMLElement | null
    }[]
    grids: THREE.LineSegments[]
    backdrops: Map<string, THREE.CanvasTexture>
    minY: number
    maxY: number
  } | null>(null)

  const displayRef = useRef({ displayMode, colorMode, showOutline })
  displayRef.current = { displayMode, colorMode, showOutline }
  const highlightRef = useRef(highlightedBayId)
  highlightRef.current = highlightedBayId

  /** 점 크기 — 재질 속성만 바꾸므로 씬 재구성 없이 즉시 반영된다 */
  const [pointSize, setPointSize] = useState(DEFAULT_POINT_SIZE)
  const pointSizeRef = useRef(pointSize)
  pointSizeRef.current = pointSize
  useEffect(() => {
    const refs = sceneRefs.current
    if (refs) refs.pointMaterial.size = pointSize
  }, [pointSize])

  const viewApiRef = useRef<{
    camera: THREE.PerspectiveCamera
    controls: OrbitControls
    home: ReturnType<typeof captureHomePose>
  } | null>(null)
  const [axisView, setAxisView] = useState<AxisViewState | null>(null)
  const [wheelHint, setWheelHint] = useState(false)
  const wheelHintTimer = useRef(0)
  /** axisView는 카메라 조작 중 계속 바뀐다. 같은 클릭 요청을 두 번 처리하지 않는다. */
  const handledSensorFocusRequestRef = useRef<number | null>(null)

  useEffect(() => {
    if (!sensorFocus || !axisView || mode !== 'bay') return
    if (handledSensorFocusRequestRef.current === sensorFocus.request) return
    const api = viewApiRef.current
    if (!api) return
    handledSensorFocusRequestRef.current = sensorFocus.request
    if (sensorFocus.index < 0) {
      resetToHome(api.camera, api.controls, api.home)
      return
    }
    const marker = sceneRefs.current?.sensorMarkers[sensorFocus.index]
    if (!marker) return
    const localFocus = marker.userData.focusPosition as THREE.Vector3 | undefined
    if (!localFocus) return
    const target = marker.localToWorld(localFocus.clone())
    const direction = api.camera.position.clone().sub(api.controls.target)
    if (direction.lengthSq() < 1e-6) direction.set(1, 0.7, 1)
    direction.normalize()
    api.camera.position.copy(
      target.clone().addScaledVector(direction, Math.max(8, api.controls.minDistance))
    )
    api.controls.target.copy(target)
    api.controls.update()
  }, [sensorFocus, axisView, mode])

  const handleAxisSelect = useCallback((direction: ViewDirection) => {
    const api = viewApiRef.current
    if (api) setViewDirection(api.camera, api.controls, direction)
  }, [])
  const handleGoHome = useCallback(() => {
    const api = viewApiRef.current
    if (api) resetToHome(api.camera, api.controls, api.home)
  }, [])

  const applyBayHighlight = useCallback(() => {
    const refs = sceneRefs.current
    if (!refs) return
    const palette = paletteFor(displayRef.current.displayMode)
    const current = highlightRef.current
    for (const entry of refs.bayPaints) {
      const on = entry.locationId != null && entry.locationId === current
      const color = on ? GROUP_HIGHLIGHT_COLOR : palette.boundaryColor
      entry.stripe.color.setHex(color)
      entry.stripe.opacity = on ? 1 : 0.85
      entry.fill.color.setHex(color)
      entry.fill.opacity = on ? palette.boundaryFillOpacity * 3 : palette.boundaryFillOpacity
      if (entry.card) {
        entry.card.style.borderColor = on ? 'var(--accent)' : ''
        entry.card.style.boxShadow = on ? '0 0 0 2px var(--accent)' : ''
      }
    }
  }, [])

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
    // 안개는 배경색으로 수렴시켜야 원경이 배경에 녹는다 (경계선이 생기면 되레 지저분해진다)
    if (refs.scene.fog) (refs.scene.fog as THREE.Fog).color.setHex(palette.fogColor)
    refs.hemi.color.setHex(palette.hemiSky)
    refs.hemi.groundColor.setHex(palette.hemiGround)
    refs.hemi.intensity = palette.hemiIntensity
    refs.dir.intensity = palette.dirIntensity

    /*
     * 단독 뷰의 CAD 는 실측 점군과 비교하는 본체다 — 표시 모드가 `점군`이어도 세우고,
     * 겹쳐보기의 흐린 투명도(0.2)로는 점군에 묻히므로 하한을 보장한다.
     */
    const cadOpacity =
      dm === 'cad'
        ? palette.cadOpacity
        : refs.focusView
          ? Math.max(palette.cadOpacity, FOCUS_CAD_MIN_OPACITY)
          : Math.max(palette.cadOpacity, refs.overviewCadMinOpacity)
    /*
     * 도면 모드(`cad`)는 무채색 도면이 그 모드의 목적이라 블록색을 입히지 않는다.
     * 점군이 함께 보이는 모드에서 `CAD 정합` 규칙일 때만 세그멘테이션 색으로 묶는다 —
     * 그래야 "같은 색 껍데기와 점"이 한 블록이라는 게 색만으로 읽힌다.
     */
    const tintCadByBlock = cm === 'match' && dm !== 'cad'
    refs.cadMaterials.forEach((material, i) => {
      const blockIndex = refs.cadBlockIndices[i]
      material.color.setHex(tintCadByBlock ? blockCadColor(blockIndex) : palette.cadColor)
      material.opacity = cadOpacity
      material.transparent = cadOpacity < 1
      material.depthWrite = palette.cadDepthWrite
      material.needsUpdate = true
    })

    refs.blockPaint.color.setHex(palette.edgeColor)
    refs.blockPaint.opacity = palette.edgeOpacity * 0.9
    for (const paint of refs.footprintPaints) {
      paint.material.color.setHex(
        tintCadByBlock ? blockEdgeColor(paint.blockIndex) : palette.edgeColor
      )
      paint.material.opacity = palette.edgeOpacity * 0.9
    }

    const cadVisible = showsCad(dm) || refs.focusView
    for (const mesh of refs.cadMeshes) mesh.visible = cadVisible

    const pointsVisible = showsPoints(dm)
    for (const group of refs.pointGroups) group.visible = pointsVisible

    // CAD 모드에서는 실측 설비(센서 마커)를 숨긴다 — 도면 형상만 남긴다
    for (const marker of refs.sensorMarkers) marker.visible = dm !== 'cad'

    refs.edgeMaterials.forEach((material, i) => {
      const blockIndex = refs.cadBlockIndices[i]
      material.color.setHex(tintCadByBlock ? blockEdgeColor(blockIndex) : palette.edgeColor)
      material.opacity = palette.edgeOpacity
    })
    for (const outline of refs.outlines) outline.visible = so && cadVisible

    for (const grid of refs.grids) {
      const material = grid.material as THREE.LineBasicMaterial
      material.color.setHex(palette.gridColor)
      material.opacity = palette.gridOpacity
    }

    if (pointsVisible) {
      // 진척 규칙은 실측 데이터가 못 받친다 — 점군을 중성색 배경으로 깐다
      const rule: PointColorMode = cm === 'progress' ? 'plain' : cm
      applyRealPointColors(refs.clouds, rule, {
        sensorColors: SENSOR_POINT_COLORS,
        minY: refs.minY,
        maxY: refs.maxY,
        floorColor: palette.floorPointColor,
      })
    }

    applyBayHighlight()
  }, [applyBayHighlight])

  useEffect(() => {
    applyDisplay()
  }, [applyDisplay, displayMode, colorMode, showOutline])

  useEffect(() => {
    applyBayHighlight()
  }, [applyBayHighlight, highlightedBayId])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !scene3d) return

    const { meta, cloud, labels, shade, meshes, hall, bays } = scene3d
    const scene = new THREE.Scene()
    // 원경을 배경색으로 녹인다 — 100m 홀에서 앞뒤가 같은 밝기면 깊이가 안 읽힌다
    scene.fog = new THREE.Fog(0x12171d, 60, 260)
    const hemi = new THREE.HemisphereLight(0xdde6f0, 0x1a2030, 1.1)
    scene.add(hemi)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9)
    dirLight.position.set(40, 70, 30)
    scene.add(dirLight)

    /** 블록마다 복제해서 쓰는 원본 — 실제 색·투명도는 applyDisplay 가 정한다 */
    const cadMaterialTemplate = new THREE.MeshLambertMaterial({
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    /*
     * 인식 블록 바닥 표시 — 도면 솔리드는 겹쳐보기 투명도(0.2)로 100m 밖에서 사라진다.
     * 공장 전체 뷰에서 "어디에 무엇이 인식돼 있는지"는 바닥 표시가 대신 나른다.
     */
    const blockPaint = new THREE.MeshBasicMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    })

    /** 단독 뷰 대상 — bay 모드에서 선택된 블록의 manifest 인덱스 (없으면 -1) */
    const selectedIndex =
      mode === 'bay' && selectedBlockId
        ? meta.blocks.findIndex((p) => selectedBlockId.endsWith(p.name))
        : -1
    const selectedPlacement = selectedIndex >= 0 ? meta.blocks[selectedIndex] : null

    const pointMaterial = new THREE.PointsMaterial({
      size: pointSizeRef.current,
      vertexColors: true,
      sizeAttenuation: true,
    })

    const refs = {
      scene,
      hemi,
      dir: dirLight,
      cadMaterials: [] as THREE.MeshLambertMaterial[],
      cadMeshes: [] as THREE.Mesh[],
      cadBlockIndices: [] as number[],
      blockPaint,
      footprintPaints: [] as { material: THREE.MeshBasicMaterial; blockIndex: number }[],
      edgeMaterials: [] as THREE.LineBasicMaterial[],
      outlines: [] as THREE.LineSegments[],
      clouds: [] as RealCloud[],
      pointGroups: [] as THREE.Group[],
      pointMaterial,
      focusView: selectedIndex >= 0,
      /*
       * 공장 전체 뷰는 카메라가 100m 밖이라 겹쳐보기 기본 투명도(0.2)로는 블록이
       * 배경에 녹는다 — 개관 뷰에서만 하한을 올린다 (베이 뷰는 팔레트 그대로).
       */
      overviewCadMinOpacity: mode === 'factory' ? 0.4 : 0,
      sensorMarkers: [] as THREE.Object3D[],
      bayPaints: [] as {
        locationId: string | null
        stripe: THREE.MeshBasicMaterial
        fill: THREE.MeshBasicMaterial
        card: HTMLElement | null
      }[],
      grids: [] as THREE.LineSegments[],
      backdrops: new Map<string, THREE.CanvasTexture>(),
      minY: meta.bounds.min[1],
      maxY: Math.max(meta.bounds.max[1], meta.bounds.min[1] + 0.5),
    }
    sceneRefs.current = refs

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1200
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
    controls.maxDistance = 700
    applyBlenderMouseBindings(controls)
    const unbindButtons = bindModifierAwareButtons(controls, renderer.domElement)

    /*
     * 조작 포커스 (FR-6) — 시뮬레이션 뷰어와 같은 규칙: 클릭 전에는 휠을 소비하지
     * 않아 페이지 스크롤이 걸리지 않고, 줌 한계에서는 다시 페이지로 흘려보낸다.
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

    let pointerInside = false
    const markInside = () => { pointerInside = true }
    const markOutside = () => { pointerInside = false }
    renderer.domElement.addEventListener('pointerenter', markInside)
    renderer.domElement.addEventListener('pointerleave', markOutside)

    // ── 점군: 센서 구간별 THREE.Points — 라벨을 함께 실어 `객체` 규칙이 점별로 칠한다 ──
    const pointGroup = new THREE.Group()
    refs.pointGroups.push(pointGroup)
    scene.add(pointGroup)
    meta.ranges.forEach((range, sensorIndex) => {
      let geometry: THREE.BufferGeometry
      let cloudLabels: Uint8Array | null
      let cloudShade: Uint8Array | null
      let fixedLabel: number | null
      if (selectedPlacement) {
        /*
         * 단독 뷰: 이 블록으로 분류된 점만 남긴다 — 목업 뷰어의 블록 단독 뷰와 같은 문법.
         * 센서 구간을 유지한 채 걸러야 `센서별` 색상이 단독 뷰에서도 성립한다.
         */
        const picked: number[] = []
        const pickedShade: number[] = []
        for (let i = range.start; i < range.start + range.count; i++) {
          if (labels[i] === selectedIndex) {
            picked.push(cloud[i * 3], cloud[i * 3 + 1], cloud[i * 3 + 2])
            pickedShade.push(shade[i])
          }
        }
        if (picked.length === 0) return
        geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(picked), 3))
        cloudLabels = null
        cloudShade = new Uint8Array(pickedShade)
        fixedLabel = selectedIndex
      } else {
        geometry = new THREE.BufferGeometry()
        const slice = cloud.subarray(range.start * 3, (range.start + range.count) * 3)
        geometry.setAttribute('position', new THREE.BufferAttribute(slice, 3))
        cloudLabels = labels.subarray(range.start, range.start + range.count)
        cloudShade = shade.subarray(range.start, range.start + range.count)
        fixedLabel = null
      }
      const points = new THREE.Points(geometry, pointMaterial)
      pointGroup.add(points)
      refs.clouds.push({
        points,
        sensorIndex,
        labels: cloudLabels,
        fixedLabel,
        shade: cloudShade,
      })
    })

    // ── CAD 오버레이: manifest 배치 행렬 그대로 (재정렬 금지 — 헤더 주석 참조) ──
    const meshByName = new Map(meshes.map((mesh) => [mesh.name, mesh]))
    const blockBoxes = new Map<string, THREE.Box3>()
    /*
     * 블록 인덱스를 함께 들고 다닌다 — 이 값이 곧 점 라벨 값이라, 도면과 점군이
     * 같은 색을 쓰는 근거가 된다. 단독 뷰는 목록이 하나뿐이어도 인덱스는 원래 것을 쓴다.
     */
    const visiblePlacements: { placement: RealBlockPlacement; index: number }[] =
      selectedPlacement
        ? [{ placement: selectedPlacement, index: selectedIndex }]
        : meta.blocks.map((placement, index) => ({ placement, index }))
    for (const { placement, index } of visiblePlacements) {
      const source = meshByName.get(placement.name)
      if (!source) continue
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(source.positions), 3))
      geometry.setIndex(source.indices)
      geometry.computeVertexNormals()
      const cadMaterial = cadMaterialTemplate.clone()
      const mesh = new THREE.Mesh(geometry, cadMaterial)
      mesh.matrixAutoUpdate = false
      mesh.matrix.copy(placementMatrix(placement))
      scene.add(mesh)
      refs.cadMeshes.push(mesh)
      refs.cadMaterials.push(cadMaterial)
      refs.cadBlockIndices.push(index)

      const edgeGeometry = new THREE.EdgesGeometry(geometry, 25)
      const edgeMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.5 })
      const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial)
      edges.matrixAutoUpdate = false
      edges.matrix.copy(mesh.matrix)
      scene.add(edges)
      refs.outlines.push(edges)
      refs.edgeMaterials.push(edgeMaterial)

      blockBoxes.set(placement.name, toBox3({ min: placement.bboxMin, max: placement.bboxMax }))
    }

    /*
     * 인식 블록 바닥 표시 — 블록 bbox 를 바닥에 투영한 테두리 + 모서리 마크.
     * 공장 전체 뷰에서 조립품이 "어디에 몇 개" 있는지는 이 표시가 나른다.
     */
    if (!selectedPlacement) {
      meta.blocks.forEach((placement, index) => {
        const rect: RealRect = {
          min: [placement.bboxMin[0], placement.bboxMin[2]],
          max: [placement.bboxMax[0], placement.bboxMax[2]],
        }
        // 블록마다 복제한다 — 바닥 표시도 그 블록의 세그멘테이션 색을 받아야 짝이 읽힌다
        const paint = blockPaint.clone()
        refs.footprintPaints.push({ material: paint, blockIndex: index })
        scene.add(createBandStripe(rect, paint, 0.3, 0.06))
        scene.add(createBandCorners(rect, paint, 1.6, 0.5, 0.07))
      })
    }

    /** 계단식 블록 라벨의 최고 높이 — 카메라가 라벨까지 담도록 프레이밍에 반영한다 */
    let labelStackTop = 0

    // ── 단독 뷰가 아닐 때만: 센서 마커·바닥 그리드·베이 구획·라벨 ──
    //    (블록만 남기는 단독 뷰에서는 전부 소음이다)
    if (!selectedPlacement) {
      meta.sensors.forEach((sensor, index) => {
        const marker = createRealSensorMarker(
          sensor.position,
          SENSOR_POINT_COLORS[index % SENSOR_POINT_COLORS.length]
        )
        refs.sensorMarkers.push(marker)
        scene.add(marker)
      })

      /*
       * 바닥 그리드는 홀 전체가 아니라 **베이 구획을 덮는 사각형**에만 깐다.
       * 홀은 갠트리 열보다 60m 더 긴데 거기까지 격자를 그리면 화면이 격자로 덮여
       * 정작 작업 구간이 안 보인다.
       */
      const gridRect: RealRect = {
        min: [
          Math.min(...bays.map((b) => b.band.min[0])) - FRAME_MARGIN_M,
          Math.min(...bays.map((b) => b.band.min[1])) - FRAME_MARGIN_M,
        ],
        max: [
          Math.max(...bays.map((b) => b.band.max[0])) + FRAME_MARGIN_M,
          Math.max(...bays.map((b) => b.band.max[1])) + FRAME_MARGIN_M,
        ],
      }
      const grid = createLineSegments(createRectGrid(gridRect), 0x2f3d4c, 0.5)
      refs.grids.push(grid)
      scene.add(grid)

      // ── 베이 구획 — 바닥 도색(면 + 테두리 + 모서리 마크) + 짧은 기둥 ──
      const bayByLocation = new Map(
        bayLocations.map((location) => [realGroupKeyOf(location.id), location])
      )
      for (const { key, band } of bays) {
        const location = bayByLocation.get(key)
        const stripe = new THREE.MeshBasicMaterial({
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
        const fill = new THREE.MeshBasicMaterial({
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
        const paint = new THREE.Group()
        paint.add(createBandFill(band, fill))
        paint.add(createBandStripe(band, stripe))
        paint.add(createBandCorners(band, stripe))
        paint.add(createBandPillars(band, stripe, BAY_POST_HEIGHT))
        scene.add(paint)

        /*
         * 베이 라벨은 구획 한가운데 위에 띄우고 바닥까지 지시선을 내린다.
         * 전에는 점군 AABB 위에 얹었는데 상자 셋이 겹쳐 라벨도 한자리에 포개졌다.
         */
        let card: HTMLElement | null = null
        if (location) {
          paint.add(createLabelLeader(band, stripe, BAY_LABEL_HEIGHT))
          const label = createBayLabel(
            location.name,
            location.workCntr,
            new THREE.Vector3(
              (band.min[0] + band.max[0]) / 2,
              BAY_LABEL_HEIGHT,
              (band.min[1] + band.max[1]) / 2
            ),
            t,
            mode === 'factory' ? () => onSelectBayRef.current?.(location.id) : undefined,
            mode === 'factory'
              ? (hovering) => onHoverBayRef.current?.(hovering ? location.id : null)
              : undefined
          )
          scene.add(label)
          card = label.element.firstElementChild as HTMLElement | null
        }

        refs.bayPaints.push({ locationId: location?.id ?? null, stripe, fill, card })
      }

      if (mode === 'bay') {
        /*
         * 블록 라벨 배치 — 조립품 아홉 개가 한 정반에 붙어 서므로 그냥 얹으면 카드가
         * 서로를 덮는다. 화면 아래쪽에 놓일 라벨부터 차례로 올리며 최소 간격을 확보한다
         * (도면의 지시선 처리와 같은 문법). 카메라가 약 30° 내려다보므로 **뒤쪽 블록은
         * 가만 둬도 화면에서 위로 올라간다** — 그 깊이 몫을 빼고 나서 간격을 잰다.
         */
        const placed = blocks
          .map((block) => {
            // 인덱스까지 들고 간다 — 라벨 테두리가 점군과 같은 세그멘테이션 색을 쓰려면 필요하다
            const blockIndex = meta.blocks.findIndex((p) => block.id.endsWith(p.name))
            const placement = blockIndex >= 0 ? meta.blocks[blockIndex] : undefined
            const box = placement ? blockBoxes.get(placement.name) : undefined
            if (!placement || !box) return null
            const lift = (zBackOf(meta.blocks) - placement.center[2]) * BLOCK_LABEL_DEPTH_LIFT
            return {
              block,
              placement,
              blockIndex,
              top: box.max.y,
              lift,
              screen: box.max.y + 1.2 + lift,
            }
          })
          .filter((entry) => entry != null)
          .sort((a, b) => a.screen - b.screen)

        let rung = -Infinity
        for (const entry of placed) {
          rung = Math.max(entry.screen, rung + BLOCK_LABEL_STEP)
          const height = Math.max(entry.top + 0.8, rung - entry.lift)
          const anchor: RealRect = {
            min: [entry.placement.center[0], entry.placement.center[2]],
            max: [entry.placement.center[0], entry.placement.center[2]],
          }
          scene.add(createLabelLeader(anchor, blockPaint, height, 0.06))
          scene.add(
            createBlockLabel(
              entry.block,
              new THREE.Vector3(entry.placement.center[0], height, entry.placement.center[2]),
              t,
              () => onSelectBlockRef.current?.(entry.block.id),
              true,
              segmentBlockHex(entry.blockIndex)
            )
          )
          labelStackTop = Math.max(labelStackTop, height)
        }
      }
    }

    // ── 단독 뷰: 선택 블록 강조 ──
    if (selectedPlacement) {
      const box = blockBoxes.get(selectedPlacement.name)
      if (box) {
        scene.add(
          createLineSegments(
            boxEdgePositions(box.clone().expandByScalar(0.3)),
            GROUP_HIGHLIGHT_COLOR,
            0.9
          )
        )
      }
    }

    /*
     * 프레이밍 기준: 베이 뷰는 **자기 담당구간**, 공장 뷰는 **홀 밀집 영역** 전체.
     * 베이 뷰에서 점군 bounds 로 잡으면 담당구간이 화면 구석에 손톱만하게 남고,
     * 공장 뷰에서 구획으로만 잡으면 홀 절반이 화면 밖으로 밀린다.
     */
    const bayRect: RealRect = {
      min: [
        Math.min(...bays.map((b) => b.band.min[0])) - FRAME_MARGIN_M,
        Math.min(...bays.map((b) => b.band.min[1])) - FRAME_MARGIN_M,
      ],
      max: [
        Math.max(...bays.map((b) => b.band.max[0])) + FRAME_MARGIN_M,
        Math.max(...bays.map((b) => b.band.max[1])) + FRAME_MARGIN_M,
      ],
    }
    /*
     * 베이 뷰는 담당구간 전체보다 **인식된 조립품 무리**에 붙는다 — 정반의 빈 통로까지
     * 담으면 조립품이 화면 가운데 작게 남아 라벨이 서로 겹친다. 조립품이 없으면(빈 베이)
     * 담당구간 전체를 잡는다.
     */
    const blockRect: RealRect | null =
      mode === 'bay' && meta.blocks.length > 0
        ? {
            min: [
              Math.min(...meta.blocks.map((b) => b.bboxMin[0])) - FRAME_MARGIN_M,
              Math.min(...meta.blocks.map((b) => b.bboxMin[2])) - FRAME_MARGIN_M,
            ],
            max: [
              Math.max(...meta.blocks.map((b) => b.bboxMax[0])) + FRAME_MARGIN_M,
              Math.max(...meta.blocks.map((b) => b.bboxMax[2])) + FRAME_MARGIN_M,
            ],
          }
        : null
    const viewRect: RealRect =
      mode === 'factory'
        ? { min: [meta.bounds.min[0], meta.bounds.min[2]], max: [meta.bounds.max[0], meta.bounds.max[2]] }
        : (blockRect ?? bayRect)
    const focusBox =
      selectedPlacement && blockBoxes.has(selectedPlacement.name)
        ? blockBoxes.get(selectedPlacement.name)!.clone().expandByScalar(2)
        : rectToBox(
            viewRect,
            0,
            // 계단식 라벨 꼭대기까지 담아야 위쪽 카드가 화면 밖으로 나가지 않는다
            Math.max(Math.min(hall.max[1], meta.bounds.max[1] + 1), labelStackTop + 1.5)
          )
    const focusCenter = focusBox.getCenter(new THREE.Vector3())
    const focusSize = focusBox.getSize(new THREE.Vector3())
    const spread = Math.max(focusSize.x, focusSize.z)
    // 정면에서 살짝 비스듬히 내려다보는 각 — 갠트리 열과 구획이 한 화면에 들어온다
    camera.position.set(
      focusCenter.x + spread * 0.18,
      focusCenter.y + spread * 0.45,
      focusCenter.z + spread * 0.78
    )
    controls.target.copy(focusCenter)
    frameBox(camera, controls, focusBox)
    // 안개 범위를 프레이밍 거리에 맞춘다 — 홀 크기가 달라도 원경만 정확히 녹는다
    const focusDistance = camera.position.distanceTo(focusCenter)
    ;(scene.fog as THREE.Fog).near = focusDistance * 0.55
    ;(scene.fog as THREE.Fog).far = focusDistance * 2.4

    const home = captureHomePose(camera, controls)
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
      '1': ['front', 'back'],
      '3': ['right', 'left'],
      '7': ['top', 'bottom'],
    }
    const handleViewportKey = (event: KeyboardEvent) => {
      if (!pointerInside) return
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '')) return
      const pair = viewKeys[event.key]
      if (pair) {
        event.preventDefault()
        setViewDirection(camera, controls, event.ctrlKey || event.metaKey ? pair[1] : pair[0])
        return
      }
      if (event.key === '.') {
        event.preventDefault()
        frameBox(camera, controls, focusBox)
        return
      }
      if (event.key === 'Home') {
        event.preventDefault()
        resetToHome(camera, controls, home)
      }
    }
    window.addEventListener('keydown', handleViewportKey)

    applyDisplay()

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

    return () => {
      cancelAnimationFrame(animationId)
      if (axisFrame) cancelAnimationFrame(axisFrame)
      controls.removeEventListener('change', scheduleAxisView)
      viewApiRef.current = null
      unbindButtons()
      focusApi.dispose()
      window.clearTimeout(wheelHintTimer.current)
      renderer.domElement.removeEventListener('pointerenter', markInside)
      renderer.domElement.removeEventListener('pointerleave', markOutside)
      window.removeEventListener('keydown', handleViewportKey)
      resizeObserver.disconnect()
      controls.dispose()
      sceneRefs.current = null

      scene.traverse((obj) => {
        if (obj instanceof THREE.Points || obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
          obj.geometry.dispose()
          const material = obj.material
          if (Array.isArray(material)) material.forEach((m) => m.dispose())
          else material.dispose()
        }
      })
      for (const backdrop of refs.backdrops.values()) backdrop.dispose()
      renderer.dispose()
      container.removeChild(renderer.domElement)
      container.removeChild(labelRenderer.domElement)
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- 씬 입력은 scene3d(로드 결과)·라벨 대상·선택·언어뿐이다: 콜백·표시 상태는 ref 로 우회해 재빌드를 막는다
  }, [scene3d, blocks, bayLocations, selectedBlockId, i18n.language])

  /*
   * 블록별 범례 — `CAD 정합` 규칙에서만 낸다.
   * 색이 13종이면 "무슨 색이 무슨 블록인지"를 화면 안에서 답해주지 않는 한 색을 입힌
   * 의미가 없다. 일치 점수까지 같이 내면 정합이 얼마나 잡혔는지도 한눈에 읽힌다.
   */
  const segmentLegend =
    scene3d && colorMode === 'match' && showsPoints(displayMode)
      ? {
          rows: scene3d.meta.blocks.map((placement, index) => ({
            name: placement.name,
            hex: segmentBlockHex(index),
            matched: scene3d.counts.blocks[index] ?? 0,
          })),
          unmatched: scene3d.counts.unmatched,
          floor: scene3d.counts.floor,
          toleranceCm: Math.round(scene3d.meta.segmentation.toleranceM * 100),
        }
      : null

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-inshop-lg border border-border',
        className ?? 'h-[72vh] min-h-[480px]',
      )}
    >
      <div ref={containerRef} className="absolute inset-0" />

      {segmentLegend && (
        <div
          className={cn(
            'pointer-events-none absolute max-h-[60%] overflow-hidden rounded-inshop-lg glass-panel px-2.5 py-1.5',
            // 왼쪽 위는 어느 화면에서나 유리 도구줄(ViewportToolbar) 자리다 — 늘 오른쪽으로 비킨다
            'right-3 top-12'
          )}
        >
          <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-glass-foreground/54">
            {t('viewer.legend.matchTolerance', { cm: segmentLegend.toleranceCm })}
          </p>
          <ul className="space-y-0.5">
            {segmentLegend.rows.map((row) => (
              <li key={row.name} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-inshop-xs ring-1 ring-glass-border"
                  style={{ background: row.hex }}
                />
                <span className="font-mono text-2xs text-glass-foreground/80">{row.name}</span>
                <span className="ml-auto pl-2 font-mono text-2xs tabular-nums text-glass-foreground/54">
                  {row.matched.toLocaleString()}
                </span>
              </li>
            ))}
            <li className="flex items-center gap-2 border-t border-glass-border pt-0.5">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-inshop-xs ring-1 ring-glass-border"
                style={{ background: MATCH_NEUTRALS.rest }}
              />
              <span className="text-2xs text-glass-foreground/80">
                {t('viewer.legend.unmatchedPoint')}
              </span>
              <span className="ml-auto pl-2 font-mono text-2xs tabular-nums text-glass-foreground/54">
                {segmentLegend.unmatched.toLocaleString()}
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-inshop-xs ring-1 ring-glass-border"
                style={{ background: MATCH_NEUTRALS.floor }}
              />
              <span className="text-2xs text-glass-foreground/80">{t('viewer.legend.floor')}</span>
              <span className="ml-auto pl-2 font-mono text-2xs tabular-nums text-glass-foreground/54">
                {segmentLegend.floor.toLocaleString()}
              </span>
            </li>
          </ul>
        </div>
      )}

      <ViewportAxisGizmo
        view={axisView}
        onSelectDirection={handleAxisSelect}
        onGoHome={handleGoHome}
      />

      {wheelHint && <WheelZoomHint />}

      {/* 점 크기 — 밀도·거리에 따라 적정값이 달라 사용자가 즉석에서 잡는다 */}
      <div className="absolute bottom-3 right-24 flex items-center gap-2 rounded-inshop-md glass-panel px-2.5 py-1.5">
        <label htmlFor="real-scan-point-size" className="whitespace-nowrap text-2xs text-glass-foreground/63">
          {t('viewer.pointSize')}
        </label>
        <input
          id="real-scan-point-size"
          type="range"
          min={POINT_SIZE_MIN}
          max={POINT_SIZE_MAX}
          step={0.005}
          value={pointSize}
          onChange={(event) => setPointSize(Number(event.target.value))}
          className="w-24 accent-[var(--accent)]"
        />
        <span className="w-10 text-right font-mono text-2xs tabular-nums text-glass-foreground/85">
          {pointSize.toFixed(3)}
        </span>
      </div>

      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="max-w-md px-4 text-center text-inshop-sm text-status-unhealthy">
            {t('viewer.realScanLoadFailed')}
          </p>
        </div>
      )}
      {loading && <SpinnerOverlay label={t('viewer.loadingRealScan')} />}
    </div>
  )
}
