import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { cn } from '../../../shared/lib/utils'
import { SpinnerOverlay } from '../../../shared/ui/atoms/Spinner'
import { useAsyncData } from '../../../shared/lib/useAsyncData'
import type { LidarBlockInfo } from '../../../entities/lidar-block/model/types'
import type { Location } from '../../../entities/location/model/types'
import {
  loadRealScanManifest,
  loadRealCadMeshes,
  loadRealCloud,
  loadRealLabels,
  loadRealShade,
  realGroupKeyOf,
  FLOOR,
  UNLABELED,
  type RealCadMesh,
  type RealSceneMeta,
  type RealBlockPlacement,
  type RealBayBand,
  type RealGroupKey,
  type RealRect,
} from '../api/realScanAssets'
import {
  paletteFor,
  showsPoints,
  showsCad,
  type ViewerDisplayMode,
  type ViewPalette,
} from '../lib/displayModes'
import {
  OBJECT_COLORS,
  ELEVATION_STOPS,
  objectBlockColor,
} from '../lib/pointColorRules'
import type { PointColorMode } from '../lib/colorModes'
import {
  applyBlenderMouseBindings,
  bindModifierAwareButtons,
  setViewDirection,
  frameBox,
  captureHomePose,
  resetToHome,
  type ViewDirection,
} from '../lib/blenderControls'
import { projectAxes, type AxisViewState } from '../lib/axisGizmo'
import { createLineSegments } from '../lib/outlineGeometry'
import {
  createBandStripe,
  createBandFill,
  createBandCorners,
  createBandPillars,
  createLabelLeader,
  createRectGrid,
  rectToBox,
} from '../lib/bayFootprint'
import { createBlockLabel, createBayLabel } from '../lib/labelCards'
import { createBackdrop } from '../lib/backdrop'
import { SENSOR_POINT_COLORS } from '../lib/bayConfig'
import { ViewportAxisGizmo } from './ViewportAxisGizmo'

/**
 * 실측 스캔 뷰어 — 조립 5공장 (실측데이터) 전용.
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
  /** factory: 12대 전체 정합 스캔 + 그룹 라벨 / bay: 그룹 하나 + 블록 라벨 */
  mode: 'factory' | 'bay'
  /** bay 모드에서만 필요 — 실측 location id (real5-g1 …) */
  locationId?: string
  /** factory 모드의 그룹 라벨용 — 실측 공장 소속 location 목록 */
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
/** 블록 라벨 → 색 캐시 — 그룹당 최대 13종이라 넉넉히 16개면 된다 */
const BLOCK_LABEL_COLORS = Array.from({ length: 16 }, (_, i) => objectBlockColor(i))

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
 *  - 바닥(FLOOR)은 눌러 깐다. 홀 바닥이 점의 40%라 같이 칠하면 조립품이 안 뜬다.
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
        : mode === 'height' || mode === 'object'
          ? null
          : PLAIN_POINT_COLOR

    for (let i = 0; i < count; i++) {
      const label = cloud.fixedLabel ?? cloud.labels?.[i] ?? UNLABELED
      if (label === FLOOR) {
        base.copy(floor)
      } else if (mode === 'height') {
        elevationColor((position.getY(i) - ctx.minY) / span, base)
      } else if (mode === 'object') {
        if (label === UNLABELED) base.copy(OBJECT_JIG_COLOR)
        else base.copy(BLOCK_LABEL_COLORS[label % BLOCK_LABEL_COLORS.length])
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

interface LoadedRealScene {
  key: string
  meta: RealSceneMeta
  cloud: Float32Array
  labels: Uint8Array
  shade: Uint8Array
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
    return {
      key: groupKey ?? 'factory',
      meta,
      cloud,
      labels,
      shade,
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
    cadMaterial: THREE.MeshLambertMaterial
    cadMeshes: THREE.Mesh[]
    /** 인식 블록 바닥 표시 재질 — 표시 모드 팔레트를 따라간다 */
    blockPaint: THREE.MeshBasicMaterial
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
    refs.cadMaterial.color.setHex(palette.cadColor)
    refs.cadMaterial.opacity = cadOpacity
    refs.cadMaterial.transparent = cadOpacity < 1
    refs.cadMaterial.depthWrite = palette.cadDepthWrite
    refs.cadMaterial.needsUpdate = true

    refs.blockPaint.color.setHex(palette.edgeColor)
    refs.blockPaint.opacity = palette.edgeOpacity * 0.9

    const cadVisible = showsCad(dm) || refs.focusView
    for (const mesh of refs.cadMeshes) mesh.visible = cadVisible

    const pointsVisible = showsPoints(dm)
    for (const group of refs.pointGroups) group.visible = pointsVisible

    // CAD 모드에서는 실측 설비(센서 마커)를 숨긴다 — 도면 형상만 남긴다
    for (const marker of refs.sensorMarkers) marker.visible = dm !== 'cad'

    for (const material of refs.edgeMaterials) {
      material.color.setHex(palette.edgeColor)
      material.opacity = palette.edgeOpacity
    }
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

    const cadMaterial = new THREE.MeshLambertMaterial({
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
      cadMaterial,
      cadMeshes: [] as THREE.Mesh[],
      blockPaint,
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
    const visiblePlacements = selectedPlacement ? [selectedPlacement] : meta.blocks
    for (const placement of visiblePlacements) {
      const source = meshByName.get(placement.name)
      if (!source) continue
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(source.positions), 3))
      geometry.setIndex(source.indices)
      geometry.computeVertexNormals()
      const mesh = new THREE.Mesh(geometry, cadMaterial)
      mesh.matrixAutoUpdate = false
      mesh.matrix.copy(placementMatrix(placement))
      scene.add(mesh)
      refs.cadMeshes.push(mesh)

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
      for (const placement of meta.blocks) {
        const rect: RealRect = {
          min: [placement.bboxMin[0], placement.bboxMin[2]],
          max: [placement.bboxMax[0], placement.bboxMax[2]],
        }
        scene.add(createBandStripe(rect, blockPaint, 0.3, 0.06))
        scene.add(createBandCorners(rect, blockPaint, 1.6, 0.5, 0.07))
      }
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
            const placement = meta.blocks.find((p) => block.id.endsWith(p.name))
            const box = placement ? blockBoxes.get(placement.name) : undefined
            if (!placement || !box) return null
            const lift = (zBackOf(meta.blocks) - placement.center[2]) * BLOCK_LABEL_DEPTH_LIFT
            return { block, placement, top: box.max.y, lift, screen: box.max.y + 1.2 + lift }
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
              true
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

  return (
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
