import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import * as THREE from 'three'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  applyBlenderMouseBindings,
  bindModifierAwareButtons,
  captureHomePose,
  resetToHome,
  setViewDirection,
  type HomePose,
  type ViewDirection,
} from '../../../shared/features/bay-viewer/lib/blenderControls'
import { projectAxes, type AxisViewState } from '../../../shared/features/bay-viewer/lib/axisGizmo'
import { bindViewportFocus } from '../../../shared/features/bay-viewer/lib/viewportInput'
import {
  PLAN_AZIMUTH,
  PLAN_VIEWPOINT,
  orbitDirectionAt,
  planViewDirection,
} from '../../../shared/features/bay-viewer/lib/viewpoint'
import { fitDistanceForBox } from '../../../shared/features/bay-viewer/lib/fitCamera'
import { CAMERA_FLY_MS, easeInOutCubic } from '../../../shared/lib/cameraMotion'
import { tweenCameraTo } from '../../../shared/features/bay-viewer/lib/cameraTween'
import { startRenderLoop } from '../../../shared/features/bay-viewer/lib/renderLoop'
import { disposeRenderer, disposeScene } from '../../../shared/features/bay-viewer/lib/disposeScene'
import { makeLabelObject } from '../../../shared/features/bay-viewer/lib/labelCards'
import {
  isLowGpuMode,
  pixelRatioFor,
  subscribeQualityMode,
} from '../../../shared/features/bay-viewer/lib/qualityMode'
import { LiveAxisGizmo } from '../../../shared/features/bay-viewer/ui/LiveViewportOverlay'
import { createViewportOverlayStore } from '../../../shared/features/bay-viewer/lib/viewportOverlayStore'
import { ViewportHelp } from '../../../shared/features/bay-viewer/ui/ViewportHelp'
import { prefersReducedMotion } from '../../../shared/lib/cameraMotion'
import { cn } from '../../../shared/lib/utils'
import { STATUS_HEX } from '../../../shared/ui/statusPalette'
import { DEHUMIDIFIER, GAS_HEATER } from './equipmentIcon'
import {
  EQUIPMENT_SYMBOL_SCALE,
  equipmentGeometryOf,
  indicatorGeometryOf,
} from './equipmentShapes'
import { loadEquipmentModel } from './equipmentModels'
import { buildFactoryFloorGeometry, FLOOR_PALETTE, selectionRingGeometry } from './factoryFloor'
import { createBayLabelCard, type BayLabelCard } from './bayLabel'
import { PaintingBayDetail } from './PaintingBayDetail'
import {
  buildParticleGeometry,
  buildRibbonGeometry,
  floorFieldMatrix,
  floorFieldPlane,
  flowUnitsOf,
  HEAT_RISE_M,
  type FlowUnit,
} from './airFlowField'
import {
  floorFieldMaterial,
  hazeMaterial,
  particleMaterial,
  ribbonMaterial,
  tickAirMaterials,
} from './airMaterials'
import { addLights, attachEnvironment, buildGround, concreteTexture } from './sceneDressing'
import { BAY_HEIGHT_M, estimateDrawCalls, type BayScene } from '../lib/bayScene'
import { PARTICLES_PER_BAY_MAX, fitParticleBudget, particleCountOf } from '../lib/airEffect'

/*
 * 도장 **가동 뷰** — 장비가 만드는 공기를, **도장공장 안에서** 그린다 (P5 · R38 · R44).
 *
 * 조립·의장의 3D 는 점군이다. 거기엔 그릴 물체(블록)가 있기 때문이다. 도장 베이에서
 * 실제로 일어나는 일은 **공기를 만드는 것**이고, 그래서 이 뷰의 주인공도 공기다:
 *
 *   가스히터 가동  →  토출구에서 베이 안으로 부채꼴로 퍼지며 떠오르는 열기
 *   제습기 가동    →  베이 안쪽에서 흡입구로 모여드는 기류
 *   정지           →  램프가 꺼지고 기류가 멎는다 (있다는 사실만 자리로 남는다)
 *
 * **세기는 SCADA 값을 따라간다** — 목표 온도에 못 미칠수록 열기가 진하고 빠르며, 습도가
 * 목표를 넘을수록 기류가 강하다. 그 수식은 여기 없다(`lib/airEffect`).
 *
 * ── R44 에서 바뀐 것 ────────────────────────────────────────────
 * 공기에 **방향이 없었다.** 열기는 히터 자리에서 수직으로 솟고 기류는 사방에서 제습기로
 * 모였다 — 켜졌다는 사실만 말했지, 그 공기가 베이의 어느 영역에 닿는지는 말하지 못했다.
 * 그리고 설비는 종류색 덩어리였고 화면 모서리의 안내판이 그림을 가렸다. 이제:
 *  · **기류장** — 유선 리본·입자·바닥 파문 세 겹이 토출구에서 시작해 베이 안으로 간다
 *    (`ui/airFlowField` 가 길을, `ui/airMaterials` 가 움직임을 만든다). 움직임은 GPU 가
 *    시간으로 계산하고 CPU 는 프레임마다 uniform 하나만 바꾼다.
 *  · **실물 재질** — 부위별 색·PBR 재질·환경 반사·그림자·콘크리트 바닥(`ui/sceneDressing`).
 *    가동 상태는 몸통 색이 아니라 **램프와 토출구의 빛**이 말한다.
 *  · **안내판은 한 줄로** — 요약·범례를 각각 한 줄 유리띠로 접었다. 이 화면은 읽는 곳이
 *    아니라 보는 곳이다.
 * 좌표·자리·문구는 전부 렌더 밖(`lib/*`)이 정한다 — 이 파일은 **그리기만** 한다.
 *
 * 껍데기(카메라 조작·포커스·기즈모·도움말·그리기 루프·라벨 카드 앵커)는 전부 shared
 * bay-viewer 를 쓴다 — 조작 문법이 조립·의장과 갈리면 화면을 옮길 때마다 손이 다시 배운다.
 *
 * 성능 계약(P0):
 *  · 그리기 콜백 안에서 setState 하지 않는다 — 기즈모는 오버레이 스토어로 흘린다.
 *  · 바닥·구획선·골조·기둥·바깥 바닥은 각각 **하나**, 설비는 **종류당 InstancedMesh 둘**
 *    (몸통·표시등), 기류는 **종류당 리본 하나·입자 하나**, 바닥장은 **전체가 하나**다.
 *    glTF 모델(가스히터·제습기)도 같다 — `ui/equipmentModels` 가 파일을 지오메트리 하나로
 *    구워 오면 몸통 InstancedMesh 의 지오메트리만 바꿔 끼운다(콜 수 불변).
 *    베이 수에 비례하는 것은 헤이즈뿐이다. 어림수는 `lib/bayScene` 의 `estimateDrawCalls`.
 *  · 입자는 예산 안에서만 켠다 — 버퍼는 상한만큼 잡아 두고 **켜는 개수**만 바꾼다.
 *  · 그리기 루프는 놀 때 멈춘다. 가동 중인 베이가 있는 동안만 다음 장을 요청한다.
 *    움직임 줄이기 설정이면 기류를 한 장으로 세워 두고 흐르게 하지 않는다.
 */

const HEAT_COLOR = new THREE.Color(GAS_HEATER)
const DRY_COLOR = new THREE.Color(DEHUMIDIFIER)
/** 표시등 — 켜지면 종류색이 밝게, 꺼지면 어두운 유리 */
const LAMP_OFF = new THREE.Color(0x232a31)
const HEAT_LAMP = new THREE.Color(0xff8a6a)
const DRY_LAMP = new THREE.Color(0x7fb6ff)

/** 라벨이 뜨는 높이(m) — 골조 위로 조금 더 */
const LABEL_HEIGHT = BAY_HEIGHT_M + 3

/**
 * 이 거리(m)를 넘으면 라벨을 한 줄로 접는다.
 *
 * 도장 베이 한 면이 50~60m 다. 그 서너 배쯤 물러나면 카드 여러 장이 한 자리에 겹치기
 * 시작하고, 그때의 환경 수치는 읽히지 않으면서 옆 카드를 가린다. 다가가는 것이 곧
 * "이 베이를 보겠다"는 뜻이므로, 가까울 때만 수치·재실이 선다.
 */
const LABEL_COMPACT_DISTANCE_M = 420

/**
 * 도면이 일어서는 데 걸리는 시간(ms).
 *
 * 이 앱의 카메라 전환(`CAMERA_FLY_MS`)보다 길다. 저쪽은 "보던 자리에서 저 자리로" 옮기는
 * 짧은 이동이고, 이건 **차원이 바뀌는** 한 번뿐인 장면이다 — 눈이 도면과 3D 를 같은
 * 것으로 잇는 데는 그만큼의 시간이 든다. 더 길면 기다림이 되고, 더 짧으면 하드컷과
 * 구별되지 않는다.
 */
const TILT_INTRO_MS = 1300

/** 도입이 시작하는 고도(도) — 눈에는 도면, 계산에는 아직 3D */
const TILT_FROM_DEG = 84

/**
 * 설비 한 대를 볼 때 담는 둘레의 절반(m).
 *
 * 그 대만 꽉 채우면 어디에 서 있는지가 사라진다 — 옆 설비와 베이 벽이 함께 보여야
 * "이 칸 이 자리의 그 대" 로 읽힌다. 12m 면 도장 베이(58m) 안에서 이웃 한둘이 함께 든다.
 */
const UNIT_FOCUS_HALF_M = 12

interface BayVisual {
  bay: string
  haze: THREE.ShaderMaterial | null
  /** 설비가 없는 베이는 라벨을 달지 않는다 — 아래 씬 구성 주석 참조 */
  label: BayLabelCard | null
}

/** 종류당 하나씩 서는 기류 한 벌 — 리본·입자와, 세기를 다시 쓰는 열쇠 */
interface FlowLayer {
  ribbon: THREE.Mesh
  ribbonRanges: { unitIndex: number; start: number; count: number }[]
  particles: THREE.Points
  particleBlocks: { bayIndex: number; start: number; count: number }[]
}

export interface PaintingAirViewerProps {
  scene: BayScene
  /**
   * **도면이 일어서며** 들어오는가 (R45).
   *
   * 현황 탭의 '3D 가동 뷰' 로 건너오면 장면이 도면과 같은 자세(거의 수직 내려다보기)로
   * 서서, 1.3초에 걸쳐 이 앱의 기본 각(고도 48°)까지 기울어 내려온다 — 방금 읽던 2D 가
   * 그대로 3D 가 되는 것으로 읽힌다. 탭을 직접 눌러 들어오면 이어받을 그림이 없으므로
   * 처음부터 기본 각으로 선다.
   *
   * 각·방위는 이미 도면과 같은 상수를 쓰므로(`lib/viewpoint`) 여기서 움직이는 것은
   * **고도 하나뿐**이다 — 좌우가 함께 돌면 그건 이어짐이 아니라 새 그림이다.
   */
  tiltIntro?: boolean
  /**
   * 밖에서 데려온 **초점 베이** — 옆 목록의 구획 머리를 누른 결과 (R45).
   *
   * 값이 바뀌면 카메라가 그 칸으로 날아가고 상세가 열린다. 도면(2D)에서 그 칸이 밝아지는
   * 것과 같은 뜻을 3D 의 어휘로 옮긴 것이다 — 평면에서는 밝히는 것이 곧 가리키기이고,
   * 3D 에서는 **가서 보는 것**이 가리키기다. `null` 이면 공장 전체로 물러난다.
   */
  focusBay?: string | null
  /** 3D 안에서 칸을 골랐다 — 옆 목록이 따라오게 밖으로 알린다 */
  onSelectBay?: (bay: string | null) => void
  /**
   * 밖에서 데려온 **초점 설비** — 목록의 셀(`EQ039`)을 누른 결과 (R45).
   *
   * 도면에서는 그 심볼이 커지고 태그가 서지만, 3D 에서는 지금까지 아무 일도 일어나지
   * 않았다 — 같은 화면의 두 층이 서로 다른 것을 가리킨 셈이다. 이제 그 대를 고리와
   * 빛기둥으로 짚고 이름표를 세운 뒤, 카메라가 그 자리까지 간다.
   */
  focusUnit?: string | null
  className?: string
  /**
   * 오른쪽 위 도구 묶음에 함께 세울 것 — 전체 화면 버튼처럼 **뷰어 밖이 쥐고 있는**
   * 조작이 들어온다. 자리를 슬롯으로 낸 이유는, 밖에서 따로 절대배치하면 도움말 버튼과
   * 같은 좌표를 두 곳에서 재게 되어 한쪽만 옮겨도 둘이 겹치기 때문이다.
   */
  topRight?: ReactNode
}

export function PaintingAirViewer({
  scene,
  tiltIntro = false,
  focusBay,
  onSelectBay,
  focusUnit,
  className,
  topRight,
}: PaintingAirViewerProps) {
  const { t, i18n } = useTranslation()
  /**
   * **세기는 매초 바뀌고 구조는 안 바뀐다.**
   *
   * SCADA 폴링이 돌 때마다 장면 값이 새 객체가 된다. 그 identity 로 씬을 다시 세우면
   * 6초마다 WebGL 컨텍스트째로 헐고 다시 짓는다 — 그리는 도중에 헐리니 화면은 계속
   * 검다. 그래서 **구조(어떤 베이가 어디에 있고 어떤 설비가 서는가)** 가 바뀔 때만 다시
   * 세우고, 값은 ref 로 흘려 넣는다. 언어도 구조에 넣는다 — 라벨 DOM 이 씬의 일부라서
   * 언어가 바뀌면 글자가 따라가야 한다(값 갱신 경로가 그 일을 한다).
   */
  const sceneKey = useMemo(
    () =>
      `${scene.factory}|${scene.source}|` +
      scene.items
        .map((item) => `${item.bay}:${item.stations.map((s) => `${s.kind[0]}${s.id}`).join(',')}`)
        .join(';'),
    [scene]
  )
  const sceneRef = useRef<BayScene>(scene)
  sceneRef.current = scene
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const homeRef = useRef<HomePose | null>(null)
  /** 도입 트윈 — `startedAt` 0 이면 아직 첫 그림을 기다리는 중이다 */
  const introRef = useRef<{ startedAt: number } | null>(null)
  /** 그 트윈이 프레임을 청하는 rAF — 씬을 헐 때 끊는다 */
  const introFrameRef = useRef(0)
  /** 이 뷰어에서 도입을 이미 걸었는가 — 씬을 다시 세워도 두 번 걸지 않는다 */
  const introArmedRef = useRef(false)
  /**
   * 지금 초점 — 씬을 세우는 순간의 값을 도입이 읽는다.
   *
   * 제습기를 고른 채로 3D 로 뒤집으면 도면이 일어서는 것과 그 대로 다가가는 것이 **한
   * 움직임**이어야 한다. 두 번 나눠 걸면(일어선 뒤에 날아가면) 그 사이에 카메라가
   * 서로를 덮어쓰고, 무엇보다 두 번 움직이는 화면이 된다.
   */
  const focusRef = useRef<{ bay: string | null; unit: string | null }>({ bay: null, unit: null })
  focusRef.current = { bay: focusBay ?? null, unit: focusUnit ?? null }
  /** 그 칸으로 날아가는 손 — 씬을 세울 때 채워진다(밖에서 부르는 초점 이동) */
  const flyToBayRef = useRef<((bay: string | null, unitId?: string) => void) | null>(null)
  /** 트윈 취소 — 새 트윈이 걸리거나 씬이 헐릴 때 끊는다 */
  const flyCancelRef = useRef<(() => void) | null>(null)
  /** 설비 한 대를 짚는 손 — 씬을 세울 때 채워진다. 그 대가 선 베이명을 돌려준다 */
  const markUnitRef = useRef<((id: string | null) => string | null) | null>(null)
  const requestRenderRef = useRef<(() => void) | null>(null)
  const selectionRef = useRef<{ root: THREE.Group; line: THREE.LineSegments | null } | null>(null)
  /** 씬을 다시 세우지 않고 값만 갈아 끼우는 통로 — 씬을 세울 때 채워진다 */
  const applyValuesRef = useRef<(() => void) | null>(null)
  const [selectedBay, setSelectedBay] = useState<string | null>(null)
  const selectedRef = useRef<string | null>(null)
  selectedRef.current = selectedBay
  /* 라벨 클릭은 씬을 세울 때 한 번 묶인다 — 콜백이 바뀌어도 씬을 다시 세우지 않게 ref 로 */
  const selectRef = useRef<(bay: string) => void>(() => {})
  selectRef.current = (bay: string) => {
    const next = selectedRef.current === bay ? null : bay
    setSelectedBay(next)
    /* 옆 목록이 같은 칸을 가리키게 한다 — 링킹은 도면이 하던 것과 같은 계약이다 */
    onSelectBay?.(next)
  }

  const axisStore = useRef(createViewportOverlayStore<AxisViewState | null>(null)).current
  /**
   * WebGL 을 못 얻었는가 — 원격 데스크톱·구형 드라이버·GPU 차단 정책에서는 컨텍스트
   * 생성이 실패한다. 그때 화면이 통째로 죽는 대신 **왜 못 그리는지 말하고 물러선다.**
   */
  const [webglFailed, setWebglFailed] = useState(false)

  const handleAxisSelect = useCallback((direction: ViewDirection) => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return
    setViewDirection(camera, controls, direction)
    requestRenderRef.current?.()
  }, [])

  const handleGoHome = useCallback(() => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls || !homeRef.current) return
    resetToHome(camera, controls, homeRef.current)
    requestRenderRef.current?.()
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const built = sceneRef.current
    const threeScene = new THREE.Scene()
    threeScene.background = new THREE.Color(0x0a0e13)

    const camera = new THREE.PerspectiveCamera(
      42,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      6000
    )
    cameraRef.current = camera

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true })
    } catch {
      /* 컨텍스트를 못 얻었다 — 껍데기(요약·범례·도움말)는 남기고 그림만 접는다 */
      setWebglFailed(true)
      cameraRef.current = null
      return
    }
    setWebglFailed(false)
    let lowGpu = isLowGpuMode()
    renderer.setPixelRatio(pixelRatioFor(lowGpu))
    renderer.setSize(container.clientWidth, container.clientHeight)
    /* 실사 쪽으로 — 필름 톤매핑이 강판 하이라이트와 가산 혼합의 공기를 함께 담는다 */
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = !lowGpu
    renderer.shadowMap.type = THREE.PCFShadowMap
    container.appendChild(renderer.domElement)

    /* 라벨은 DOM 이다 — WebGL 캔버스 위에 겹쳐 놓고 같은 카메라로 투영한다 */
    const labelRenderer = new CSS2DRenderer()
    labelRenderer.setSize(container.clientWidth, container.clientHeight)
    labelRenderer.domElement.style.position = 'absolute'
    labelRenderer.domElement.style.top = '0'
    labelRenderer.domElement.style.left = '0'
    labelRenderer.domElement.style.pointerEvents = 'none'
    container.appendChild(labelRenderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controlsRef.current = controls
    controls.enableDamping = true
    applyBlenderMouseBindings(controls)
    const unbindButtons = bindModifierAwareButtons(controls, renderer.domElement)
    const focusApi = bindViewportFocus(controls, camera, container, {})

    const root = new THREE.Group()
    threeScene.add(root)

    /* ── ① 바닥·구획선·벽 골조·기둥 — 각각 하나로 합쳐 4콜, 바깥 바닥 1콜 ── */
    const floorGeometry = buildFactoryFloorGeometry(built.items, BAY_HEIGHT_M)
    const concrete = concreteTexture()
    const floorMesh = new THREE.Mesh(
      floorGeometry.floor,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        map: concrete,
        roughness: 0.92,
        metalness: 0.02,
        side: THREE.DoubleSide,
      })
    )
    floorMesh.receiveShadow = true
    root.add(floorMesh)
    const outlineMesh = new THREE.LineSegments(
      floorGeometry.outline,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 })
    )
    root.add(outlineMesh)
    if (floorGeometry.frame) {
      root.add(
        new THREE.LineSegments(
          floorGeometry.frame,
          new THREE.LineBasicMaterial({ color: FLOOR_PALETTE.frame, transparent: true, opacity: 0.55 })
        )
      )
    }
    if (floorGeometry.columns) {
      const columns = new THREE.Mesh(
        floorGeometry.columns,
        new THREE.MeshStandardMaterial({ color: FLOOR_PALETTE.column, roughness: 0.7, metalness: 0.3 })
      )
      columns.castShadow = true
      columns.receiveShadow = true
      root.add(columns)
    }

    floorGeometry.floor.computeBoundingBox()
    const box = floorGeometry.floor.boundingBox?.clone() ?? new THREE.Box3()
    const center = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3())
    const extent = box.isEmpty() ? 100 : Math.max(...box.getSize(new THREE.Vector3()).toArray())
    root.add(buildGround(center, extent))

    /* ── 빛과 반사 — 형상이 실물로 읽히는 절반은 여기다 ── */
    if (!box.isEmpty()) box.max.y = BAY_HEIGHT_M
    const lights = addLights(threeScene, box, !lowGpu)
    let detachEnvironment = lowGpu ? null : attachEnvironment(renderer, threeScene)
    threeScene.fog = new THREE.Fog(0x0a0e13, extent * 1.6, extent * 5)

    /* ── ② 설비 — 종류당 InstancedMesh 둘: 몸통(실물 색)과 표시등(가동 색) ── */
    const stations = built.items.flatMap((item) =>
      item.stations.map((station) => ({ item, station }))
    )
    const dummy = new THREE.Object3D()
    /* 언마운트 뒤에 도착한 모델은 버린다 — 죽은 장면에 지오메트리를 꽂지 않게 */
    let disposed = false
    const makeInstanced = (kind: '가스히터' | '제습기') => {
      const list = stations.filter((s) => s.station.kind === kind)
      if (list.length === 0) return null
      const bodyGeometry = equipmentGeometryOf(kind)
      bodyGeometry.scale(EQUIPMENT_SYMBOL_SCALE, EQUIPMENT_SYMBOL_SCALE, EQUIPMENT_SYMBOL_SCALE)
      const body = new THREE.InstancedMesh(
        bodyGeometry,
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          metalness: 0.5,
          roughness: 0.42,
          envMapIntensity: 0.9,
        }),
        list.length
      )
      body.castShadow = true
      body.receiveShadow = true
      const lampGeometry = indicatorGeometryOf(kind)
      lampGeometry.scale(EQUIPMENT_SYMBOL_SCALE, EQUIPMENT_SYMBOL_SCALE, EQUIPMENT_SYMBOL_SCALE)
      const lamp = new THREE.InstancedMesh(
        lampGeometry,
        new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
        list.length
      )
      list.forEach(({ item, station }, index) => {
        const bayRad = (item.rotationDeg * Math.PI) / 180
        const cos = Math.cos(bayRad)
        const sin = Math.sin(bayRad)
        dummy.position.set(
          item.center[0] + station.x * cos - station.z * sin,
          0,
          item.center[1] + station.x * sin + station.z * cos
        )
        /* 베이 로컬→공장 회전(`footprintToWorld`)은 three 의 rotation.y 와 부호가 반대다 */
        dummy.rotation.set(0, station.yaw - bayRad, 0)
        dummy.updateMatrix()
        body.setMatrixAt(index, dummy.matrix)
        lamp.setMatrixAt(index, dummy.matrix)
        lamp.setColorAt(index, LAMP_OFF)
      })
      body.instanceMatrix.needsUpdate = true
      lamp.instanceMatrix.needsUpdate = true
      /* 경계 상자를 직접 알려 준다 — 인스턴스가 원점에만 있는 것으로 잘못 컬링되지 않게 */
      body.frustumCulled = false
      lamp.frustumCulled = false
      root.add(body, lamp)
      /* glTF 모델은 도착하는 대로 몸통만 바꿔 끼운다 — 자리·표시등·기류는 모델 규약
         (`GAS_HEATER_MODEL`·`DEHUMIDIFIER_MODEL`)으로 이미 같은 좌표에 서 있다. 못 가져오면
         실루엣 유지 */
      void loadEquipmentModel(kind).then((model) => {
        if (!model) return
        if (disposed) {
          model.dispose()
          return
        }
        model.scale(EQUIPMENT_SYMBOL_SCALE, EQUIPMENT_SYMBOL_SCALE, EQUIPMENT_SYMBOL_SCALE)
        body.geometry.dispose()
        body.geometry = model
        requestRenderRef.current?.()
      })
      return { lamp, order: list.map((s) => s.station.id) }
    }
    const heaterSet = makeInstanced('가스히터')
    const dryerSet = makeInstanced('제습기')

    /* ── ③ 기류장 — 종류당 리본 하나·입자 하나, 바닥장은 전체가 하나 ── */
    const flowUnits: FlowUnit[] = flowUnitsOf(built.items)
    const pixelRatio = pixelRatioFor(lowGpu)
    const makeFlow = (kind: '가스히터' | '제습기'): FlowLayer | null => {
      if (!flowUnits.some((unit) => unit.kind === kind)) return null
      const heat = kind === '가스히터'
      const ribbonBuilt = buildRibbonGeometry(flowUnits, kind)
      const ribbon = new THREE.Mesh(
        ribbonBuilt.geometry,
        ribbonMaterial(heat ? HEAT_COLOR : DRY_COLOR, heat ? [0.06, 0.72] : [0.1, 0.92])
      )
      ribbon.frustumCulled = false
      ribbon.renderOrder = 2
      root.add(ribbon)
      const particleBuilt = buildParticleGeometry(flowUnits, kind, PARTICLES_PER_BAY_MAX)
      const particles = new THREE.Points(
        particleBuilt.geometry,
        particleMaterial(heat ? HEAT_COLOR : DRY_COLOR, heat ? 'heat' : 'dry', pixelRatio, HEAT_RISE_M)
      )
      particles.frustumCulled = false
      particles.renderOrder = 3
      root.add(particles)
      return {
        ribbon,
        ribbonRanges: ribbonBuilt.ranges,
        particles,
        particleBlocks: particleBuilt.blocks,
      }
    }
    const heatFlow = makeFlow('가스히터')
    const dryFlow = makeFlow('제습기')

    let field: THREE.InstancedMesh | null = null
    if (flowUnits.length > 0) {
      field = new THREE.InstancedMesh(floorFieldPlane(), floorFieldMaterial(), flowUnits.length)
      const matrix = new THREE.Matrix4()
      const modes = new Float32Array(flowUnits.length)
      flowUnits.forEach((unit, index) => {
        field!.setMatrixAt(index, floorFieldMatrix(unit, matrix))
        field!.setColorAt(index, unit.kind === '가스히터' ? HEAT_COLOR : DRY_COLOR)
        modes[index] = unit.kind === '가스히터' ? 0 : 1
      })
      field.geometry.setAttribute('aMode', new THREE.InstancedBufferAttribute(modes, 1))
      field.geometry.setAttribute(
        'aIntensity',
        new THREE.InstancedBufferAttribute(new Float32Array(flowUnits.length), 1)
      )
      field.instanceMatrix.needsUpdate = true
      field.frustumCulled = false
      field.renderOrder = 1
      root.add(field)
    }

    /* ── ④ 베이별 헤이즈와 라벨 ── */
    const visuals: BayVisual[] = []
    for (const item of built.items) {
      const group = new THREE.Group()
      group.position.set(item.center[0], 0, item.center[1])
      /* 베이 로컬→공장 회전(`footprintToWorld`)은 three 의 rotation.y 와 부호가 반대다 */
      group.rotation.y = -(item.rotationDeg * Math.PI) / 180
      root.add(group)

      let haze: THREE.ShaderMaterial | null = null
      if (item.air) {
        const [w, l] = item.size
        const half: [number, number, number] = [w * 0.46, BAY_HEIGHT_M * 0.4, l * 0.46]
        haze = hazeMaterial(HEAT_COLOR, DRY_COLOR, half)
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2), haze)
        mesh.position.y = half[1]
        mesh.renderOrder = 0
        group.add(mesh)
      }

      /*
       * 라벨은 **설비가 선 베이에만** 단다. 1DOCK 처럼 26면짜리 공장에서 빈 면까지 카드를
       * 달면 화면이 카드로 덮이고, 정작 값을 가진 베이가 그 아래 묻힌다. 빈 베이는 바닥
       * 구획선만으로 "여기 베이가 있고 설비가 없다"를 이미 말한다.
       */
      let card: BayLabelCard | null = null
      if (item.air) {
        card = createBayLabelCard(
          {
            bay: item.bay,
            label: item.label,
            mode: item.air.mode,
            runningCount: item.runningCount,
            unitCount: item.unitCount,
            env: item.air.env,
            occupants: item.occupants,
            selected: false,
          },
          t,
          () => selectRef.current(item.bay)
        )
        group.add(makeLabelObject(card.element, new THREE.Vector3(0, LABEL_HEIGHT, 0)))
      }

      visuals.push({ bay: item.bay, haze, label: card })
    }

    /* 선택 강조선은 고를 때마다 다시 만든다 — 한 면뿐이라 콜 하나 */
    const selectionRoot = new THREE.Group()
    root.add(selectionRoot)
    selectionRef.current = { root: selectionRoot, line: null }

    /** 이 설비가 선 자리 — 인스턴싱과 **같은 변환**을 쓴다(자리가 갈리면 표식이 거짓말이다) */
    const stationAt = (id: string) => {
      for (const item of sceneRef.current.items) {
        const station = item.stations.find((entry) => entry.id === id)
        if (!station) continue
        const bayRad = (item.rotationDeg * Math.PI) / 180
        const cos = Math.cos(bayRad)
        const sin = Math.sin(bayRad)
        return {
          item,
          station,
          x: item.center[0] + station.x * cos - station.z * sin,
          z: item.center[1] + station.x * sin + station.z * cos,
        }
      }
      return null
    }

    /** 고도 하나로 카메라를 다시 세우는 손 — 축 단축키·복귀가 쓴다 */
    let settleRef: ((elevationDeg: number) => void) | null = null
    /** 도입이 오갈 두 자세 — 시작(도면)과 끝(전체 또는 고른 것) */
    let introPosesRef: {
      from: { target: THREE.Vector3; position: THREE.Vector3; distance: number }
      to: { target: THREE.Vector3; position: THREE.Vector3; distance: number }
    } | null = null
    /** 자세 한 벌을 카메라에 옮긴다 — 도입이 프레임마다 부른다 */
    let applyPoseRef: ((pose: {
      target: THREE.Vector3
      position: THREE.Vector3
      distance: number
    }) => void) | null = null

    /* 카메라 — 공장 전체가 한 화면에 들어오게 */
    if (!box.isEmpty()) {
      /*
       * 처음 보는 각은 **도면에서 이어받는다**(`bay-viewer/lib/viewpoint`).
       *
       * 예전에는 이 자리에 제 비율(0.35/1/0.55 — 고도 57°·방위 33°)을 적어 두었다. 위에서
       * 비스듬히 보기는 했지만 그 방위는 아무 데서도 오지 않은 값이라, 현황 탭의 배치도에서
       * 건너오면 같은 공장이 다른 각으로 누워 보였다 — 조립·의장의 3D 는 이미 한 상수로
       * 선다(공장 전체·정반·실측 스캔이 같은 각). 도장의 가동 뷰만 제 각을 쓰면 공정을
       * 옮길 때마다 눈이 자리를 다시 찾는다.
       *
       * 각만 공유하고 거리는 여기서 정한다 — 공장 크기는 저마다 다르다(`frameBox`).
       */
      /*
       * 거리는 **고도와 함께 변한다.** 위에서 곧게 내려다보면 공장의 가로세로가 그대로
       * 화면을 채우지만, 기울면 세로가 짧아져 같은 거리에서는 그림이 작아진다 — 그러면
       * 일어서는 동안 장면이 뒤로 물러나는 것처럼 보인다. 각도마다 제 거리를 구하면
       * 크기가 유지된 채 **자세만** 바뀐다.
       */
      /**
       * 어떤 상자를 어느 고도에서 볼 것인가 → 카메라 한 벌.
       * 거리는 상자와 고도가 함께 정한다(위 주석).
       */
      const poseFor = (target: THREE.Vector3, from: THREE.Box3, elevationDeg: number) => {
        const direction = orbitDirectionAt(PLAN_AZIMUTH, elevationDeg)
        const distance = Math.max(
          fitDistanceForBox(from, direction, camera.fov, camera.aspect, 1.05),
          1
        )
        return { target, position: target.clone().addScaledVector(direction, distance), distance }
      }
      const applyPose = (pose: {
        target: THREE.Vector3
        position: THREE.Vector3
        distance: number
      }) => {
        controls.target.copy(pose.target)
        camera.position.copy(pose.position)
        camera.near = Math.max(0.05, pose.distance / 1000)
        camera.far = pose.distance * 20
        camera.updateProjectionMatrix()
        controls.update()
      }
      applyPoseRef = applyPose
      const wholeFactory = (elevationDeg: number) => poseFor(center, box, elevationDeg)

      settleRef = (elevationDeg: number) => applyPose(wholeFactory(elevationDeg))
      settleRef(PLAN_VIEWPOINT.elevationDeg)
      /*
       * 처음 자리(Home)는 **다 선 뒤의 각**이다 — 도입은 한 번 흐르고 마는 움직임이라,
       * 그 시작점으로 돌아갈 이유가 없다.
       */
      homeRef.current = captureHomePose(camera, controls)

      /*
       * 도면이 일어선다 — 고도 84°(거의 수직, 도면과 같은 그림)에서 48°까지.
       * 90° 를 쓰지 않는 이유는 그 각에서 궤도 카메라의 위 벡터가 시선과 나란해져
       * 좌우가 뒤집히기 때문이다. 84° 면 눈에는 도면이고 계산에는 아무 일도 없다.
       *
       * ⚠️ **시계는 첫 그림이 뜰 때 시작한다.** 여기(씬을 세우는 순간)에서 재면, 3D
       * 모듈·지번 fixture 를 받아 오는 동안 흐른 시간까지 트윈에 들어가 화면에는 이미
       * 다 기울어진 장면만 나타난다. 그래서 시작 자세만 잡아 두고, 시계는 그리기 루프가 켠다.
       *
       * ⚠️ **한 번만 시작하고, 씬을 다시 세워도 이어진다.** 씬은 SCADA 첫 응답이 닿는
       * 순간 한 번 다시 서는데(그때 설비 자리가 생겨 구조가 바뀐다), 그때마다 도입을
       * 새로 걸면 기울던 도면이 도로 눕는다 — 실제로 반쯤 기울다 처음으로 돌아갔다.
       * 그래서 시작 여부는 **뷰어 한 벌의 일**로 기억하고(`introArmedRef`), 다시 세울
       * 때는 흐르던 트윈을 그대로 물려받는다.
       */
      /*
       * **도착지는 지금 고른 것이다.** 제습기를 고른 채 뒤집었다면 도면이 일어서면서
       * 그대로 그 대까지 다가간다 — 한 움직임이라 눈이 한 번만 따라가면 된다.
       * 아무것도 안 골랐으면 공장 전체에서 멈춘다(지금까지의 도입 그대로).
       */
      const introPoses = () => {
        const focus = focusRef.current
        const spot = focus.unit ? stationAt(focus.unit) : null
        const focusItem =
          spot?.item ??
          (focus.bay ? (built.items.find((entry) => entry.bay === focus.bay) ?? null) : null)
        if (!focusItem) {
          return {
            from: wholeFactory(TILT_FROM_DEG),
            to: wholeFactory(PLAN_VIEWPOINT.elevationDeg),
          }
        }
        const half = spot ? UNIT_FOCUS_HALF_M : Math.max(focusItem.size[0], focusItem.size[1]) / 2
        const cx = spot ? spot.x : focusItem.center[0]
        const cz = spot ? spot.z : focusItem.center[1]
        const top = spot ? BAY_HEIGHT_M * 0.72 : BAY_HEIGHT_M
        const focusBox = new THREE.Box3(
          new THREE.Vector3(cx - half, 0, cz - half),
          new THREE.Vector3(cx + half, top, cz + half)
        )
        return {
          from: wholeFactory(TILT_FROM_DEG),
          to: poseFor(
            focusBox.getCenter(new THREE.Vector3()),
            focusBox,
            PLAN_VIEWPOINT.elevationDeg
          ),
        }
      }

      if (tiltIntro && !prefersReducedMotion() && !introArmedRef.current) {
        introArmedRef.current = true
        introRef.current = { startedAt: 0 }
      }
      /*
       * 씬은 SCADA 첫 응답이 닿을 때 한 번 다시 선다 — 그때 설비 자리가 비로소 생긴다.
       * 도입이 아직 흐르고 있으면 **그 자리로 도착지를 다시 잡는다.** 처음 세울 때는
       * 설비가 없어 칸까지밖에 못 갔던 것이, 다시 세우면서 그 대까지 좁혀진다.
       */
      if (introRef.current) {
        introPosesRef = introPoses()
        const elapsed = introRef.current.startedAt
          ? performance.now() - introRef.current.startedAt
          : 0
        const k = easeInOutCubic(Math.min(1, elapsed / TILT_INTRO_MS))
        applyPose({
          target: introPosesRef.from.target.clone().lerp(introPosesRef.to.target, k),
          position: introPosesRef.from.position.clone().lerp(introPosesRef.to.position, k),
          distance:
            introPosesRef.from.distance +
            (introPosesRef.to.distance - introPosesRef.from.distance) * k,
        })
      }
    } else {
      homeRef.current = captureHomePose(camera, controls)
    }

    /**
     * 도입 트윈 한 걸음 — 그리기 직전에 카메라를 그 각으로 옮긴다.
     *
     * 시계는 **첫 그림이 실제로 뜬 순간** 시작하고, 그때부터 트윈이 **스스로 프레임을
     * 청한다**. 두 번째가 필요한 이유: 그리기 루프는 절전을 위해 "카메라가 움직였는가"로
     * 다음 장을 정하는데(`lib/renderLoop`), 여기서 옮긴 뒤 `controls.update()` 까지
     * 부르고 나면 루프가 다음 프레임에 보는 것은 **이미 반영이 끝난 카메라**다 — 움직이지
     * 않았다고 판정해 유예(400ms)만 흐르고 멎었다. 실제로 도면이 기울다 말았다.
     */
    const pumpIntro = () => {
      if (!introRef.current) {
        introFrameRef.current = 0
        return
      }
      requestRenderRef.current?.()
      introFrameRef.current = requestAnimationFrame(pumpIntro)
    }
    const advanceIntro = () => {
      const intro = introRef.current
      if (!intro || box.isEmpty()) return
      const now = performance.now()
      if (intro.startedAt === 0) intro.startedAt = now
      /* 씬을 다시 세우면 이 펌프도 함께 끊겼다 — 살아 있는 트윈이면 다시 건다 */
      if (!introFrameRef.current) introFrameRef.current = requestAnimationFrame(pumpIntro)
      const k = easeInOutCubic(Math.min(1, (now - intro.startedAt) / TILT_INTRO_MS))
      const poses = introPosesRef
      if (poses && applyPoseRef) {
        applyPoseRef({
          target: poses.from.target.clone().lerp(poses.to.target, k),
          position: poses.from.position.clone().lerp(poses.to.position, k),
          distance: poses.from.distance + (poses.to.distance - poses.from.distance) * k,
        })
      }
      if (k >= 1) introRef.current = null
    }

    /*
     * ── 고른 설비 한 대를 **짚는다** (R45) ──
     *
     * 목록에서 `EQ039` 를 누르면 도면은 그 심볼을 키우고 태그를 세우는데, 3D 는 지금까지
     * 아무 일도 하지 않았다 — 같은 화면의 두 층이 서로 다른 것을 가리킨 셈이다. 그런데
     * 3D 에서 "저 대가 어느 것인가" 는 도면보다 더 답하기 어렵다: 히터와 제습기가 형상은
     * 달라도 한 베이에 여럿 서 있고, 그중 한 대만 고른 것이기 때문이다.
     *
     * 그래서 셋을 함께 세운다 — 바닥의 **고리**(어느 자리인가), 위로 뻗는 **빛기둥**(멀리
     * 서도 보이는 깃발), 그리고 **이름표**(무엇인가·지금 어떤가). 하나로는 부족하다:
     * 고리만 두면 베이 안에서 가려지고, 기둥만 두면 어느 대인지 겹쳐 보인다.
     *
     * 표식은 씬에 **한 벌만** 둔다(고른 것은 언제나 한 대다) — 자리와 글자만 갈아 끼운다.
     */
    const unitMarker = new THREE.Group()
    unitMarker.visible = false
    root.add(unitMarker)
    const markerColor = 0x8fe0ff
    const markerRing = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 3.1, 40),
      new THREE.MeshBasicMaterial({
        color: markerColor,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    )
    markerRing.rotation.x = -Math.PI / 2
    markerRing.position.y = 0.08
    const markerBeamHeight = BAY_HEIGHT_M * 0.66
    const markerBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, markerBeamHeight, 8),
      new THREE.MeshBasicMaterial({
        color: markerColor,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      })
    )
    markerBeam.position.y = markerBeamHeight / 2
    const markerLabelEl = document.createElement('div')
    markerLabelEl.className =
      'glass-panel pointer-events-none whitespace-nowrap rounded-inshop-md px-1.5 py-1 text-[10px] leading-tight text-white/90 ring-1 ring-[color:rgb(143_224_255/0.55)]'
    unitMarker.add(
      markerRing,
      markerBeam,
      makeLabelObject(markerLabelEl, new THREE.Vector3(0, markerBeamHeight + 1.6, 0))
    )

    markUnitRef.current = (id: string | null) => {
      if (!id) {
        unitMarker.visible = false
        requestRenderRef.current?.()
        return null
      }
      const found = stationAt(id)
      if (!found) {
        unitMarker.visible = false
        requestRenderRef.current?.()
        return null
      }
      unitMarker.position.set(found.x, 0, found.z)
      unitMarker.visible = true
      /* 이름표는 **셀과 같은 값**을 적는다 — 두 층이 다른 수치를 말하면 둘 다 못 믿는다 */
      const unit = found.item.air?.units.find((entry) => entry.id === id) ?? null
      const reading =
        unit && unit.value != null
          ? `${unit.value.toFixed(1)}${found.station.kind === '가스히터' ? '°C' : '%'}`
          : t('painting.airView.bayEnvNone')
      const running = unit?.running
        ? t('painting.airView.unitRunning')
        : t('painting.airView.unitStopped')
      markerLabelEl.textContent = `${id} · ${found.station.kind} · ${reading} · ${running}`
      requestRenderRef.current?.()
      return found.item.bay
    }

    /*
     * **그 칸으로 날아간다** — 옆 목록의 구획 머리를 눌렀을 때 (R45).
     *
     * 도면에서는 칸을 밝히는 것이 곧 가리키기지만, 3D 에서 그 자리를 밝혀 봐야 화면
     * 밖이면 아무것도 가리키지 못한다. 그래서 **가서 본다** — 각은 그대로 두고(이 앱의
     * 한 각) 자리와 거리만 그 칸에 맞춘다. 각까지 바뀌면 도착한 곳이 다른 공장처럼 보인다.
     *
     * `null` 이면 처음 자리로 물러난다 — 한 칸을 놓는다는 것은 공장 전체로 돌아간다는 뜻이다.
     */
    flyToBayRef.current = (bay: string | null, unitId?: string) => {
      const camera3d = cameraRef.current
      const controls3d = controlsRef.current
      if (!camera3d || !controls3d) return
      flyCancelRef.current?.()
      const home = homeRef.current
      const item = bay ? sceneRef.current.items.find((entry) => entry.bay === bay) : null
      if (!item) {
        if (home) {
          flyCancelRef.current = tweenCameraTo(camera3d, controls3d, {
            position: home.position.clone(),
            target: home.target.clone(),
          })
        }
        requestRenderRef.current?.()
        return
      }
      /*
       * 담을 상자 — 칸이면 발자국 전체, **설비 한 대면 그 둘레만**.
       * 셀을 눌렀는데 칸 전체가 잡히면 그 대는 여전히 점만 하게 남는다.
       */
      const spot = unitId ? stationAt(unitId) : null
      const half = spot ? UNIT_FOCUS_HALF_M : Math.max(item.size[0], item.size[1]) / 2
      const cx = spot ? spot.x : item.center[0]
      const cz = spot ? spot.z : item.center[1]
      const top = spot ? BAY_HEIGHT_M * 0.72 : BAY_HEIGHT_M
      const bayBox = new THREE.Box3(
        new THREE.Vector3(cx - half, 0, cz - half),
        new THREE.Vector3(cx + half, top, cz + half)
      )
      const target = bayBox.getCenter(new THREE.Vector3())
      const direction = planViewDirection()
      const distance = Math.max(
        fitDistanceForBox(bayBox, direction, camera3d.fov, camera3d.aspect, 1.35),
        BAY_HEIGHT_M
      )
      flyCancelRef.current = tweenCameraTo(camera3d, controls3d, {
        position: target.clone().addScaledVector(direction, distance),
        target,
      })
      requestRenderRef.current?.()
    }

    /* ── 값 갱신 통로 — 표시등 색·세기 속성·입자 예산·라벨 글자를 한 번에 다시 잡는다.
     *    React 렌더 밖(DOM/GPU 직접 쓰기)이라 리렌더를 부르지 않는다. ── */
    const applyValues = () => {
      const current = sceneRef.current
      const byBay = new Map(current.items.map((item) => [item.bay, item]))
      const unitById = new Map<string, { running: boolean; intensity: number }>()
      for (const item of current.items) {
        for (const unit of item.air?.units ?? []) {
          unitById.set(unit.id, { running: unit.running, intensity: unit.intensity })
        }
      }

      /* 표시등 — 켜진 설비만 종류색으로 빛난다 */
      const relamp = (set: { lamp: THREE.InstancedMesh; order: string[] } | null, on: THREE.Color) => {
        if (!set) return
        set.order.forEach((id, index) => {
          set.lamp.setColorAt(index, unitById.get(id)?.running ? on : LAMP_OFF)
        })
        if (set.lamp.instanceColor) set.lamp.instanceColor.needsUpdate = true
      }
      relamp(heaterSet, HEAT_LAMP)
      relamp(dryerSet, DRY_LAMP)

      /* 기류 세기 — 설비별 값을 리본 정점과 바닥장 인스턴스에 쓴다 */
      const intensityOf = (unit: FlowUnit) => {
        const state = unitById.get(unit.id)
        return state?.running ? state.intensity : 0
      }
      for (const layer of [heatFlow, dryFlow]) {
        if (!layer) continue
        const attr = layer.ribbon.geometry.getAttribute('aIntensity') as THREE.BufferAttribute
        for (const range of layer.ribbonRanges) {
          const value = intensityOf(flowUnits[range.unitIndex])
          for (let i = 0; i < range.count; i += 1) attr.setX(range.start + i, value)
        }
        attr.needsUpdate = true
      }
      if (field) {
        const attr = field.geometry.getAttribute('aIntensity') as THREE.InstancedBufferAttribute
        flowUnits.forEach((unit, index) => attr.setX(index, intensityOf(unit)))
        attr.needsUpdate = true
      }

      /* 입자 예산 — 공장 총량 상한 안에서 베이별로 나눈다(`lib/airEffect`) */
      const slots = current.items.flatMap((item, bayIndex) => {
        const air = item.air
        if (!air) return []
        const entries: { bayIndex: number; kind: 'heat' | 'dry'; want: number }[] = []
        if (item.stations.some((s) => s.kind === '가스히터')) {
          entries.push({ bayIndex, kind: 'heat', want: particleCountOf(air.hazeIntensity) })
        }
        if (item.stations.some((s) => s.kind === '제습기')) {
          entries.push({ bayIndex, kind: 'dry', want: particleCountOf(air.streakIntensity) })
        }
        return entries
      })
      const fitted = fitParticleBudget(slots.map((slot) => slot.want))
      const budget = new Map<string, number>()
      slots.forEach((slot, index) => budget.set(`${slot.kind}:${slot.bayIndex}`, fitted[index] ?? 0))
      const applyBudget = (layer: FlowLayer | null, kind: 'heat' | 'dry') => {
        if (!layer) return
        const on = layer.particles.geometry.getAttribute('aOn') as THREE.BufferAttribute
        const strength = layer.particles.geometry.getAttribute('aIntensity') as THREE.BufferAttribute
        for (const block of layer.particleBlocks) {
          const count = budget.get(`${kind}:${block.bayIndex}`) ?? 0
          const item = current.items[block.bayIndex]
          const value = kind === 'heat' ? (item?.air?.hazeIntensity ?? 0) : (item?.air?.streakIntensity ?? 0)
          for (let i = 0; i < block.count; i += 1) {
            on.setX(block.start + i, i < count ? 1 : 0)
            strength.setX(block.start + i, value)
          }
        }
        on.needsUpdate = true
        strength.needsUpdate = true
      }
      applyBudget(heatFlow, 'heat')
      applyBudget(dryFlow, 'dry')

      for (const visual of visuals) {
        const item = byBay.get(visual.bay)
        if (!item) continue
        if (visual.haze) {
          visual.haze.uniforms.uHeat.value = item.air?.hazeIntensity ?? 0
          visual.haze.uniforms.uDry.value = item.air?.streakIntensity ?? 0
        }
        visual.label?.update(
          {
            bay: item.bay,
            label: item.label,
            mode: item.air?.mode ?? null,
            runningCount: item.runningCount,
            unitCount: item.unitCount,
            env: item.air?.env ?? {
              tempC: null,
              tempSetpoint: null,
              humidityRh: null,
              humiditySetpoint: null,
            },
            occupants: item.occupants,
            selected: selectedRef.current === item.bay,
          },
          t
        )
      }
    }
    applyValuesRef.current = applyValues
    applyValues()

    /* ── 그리기 루프 — 시간은 uniform 하나로 흐른다 ── */
    let axisSignature = ''
    let compactBand: boolean | null = null
    const startedAt = performance.now()
    const anyRunning = () => sceneRef.current.items.some((item) => item.runningCount > 0)
    /* 움직임 줄이기 — 기류를 한 장에 세워 둔다(방향·세기는 남고 흐름만 멎는다) */
    const reducedMotion = prefersReducedMotion()
    tickAirMaterials(reducedMotion ? 1.7 : 0)

    const loop = startRenderLoop({
      controls,
      render: () => {
        /* 도면이 일어서는 중이라면 이 프레임의 각으로 카메라를 옮긴다 (R45) */
        advanceIntro()
        if (!reducedMotion) tickAirMaterials((performance.now() - startedAt) / 1000)
        renderer.render(threeScene, camera)
        labelRenderer.render(threeScene, camera)
        /*
         * 기즈모는 **카메라가 실제로 돌았을 때만** 갱신한다. 프레임마다 setState 하면
         * 60fps 로 리렌더가 돌고, 그 리렌더가 다시 이 이펙트를 흔든다.
         */
        const signature = `${camera.quaternion.x.toFixed(3)},${camera.quaternion.y.toFixed(3)},${camera.quaternion.z.toFixed(3)},${camera.quaternion.w.toFixed(3)}`
        if (signature !== axisSignature) {
          axisSignature = signature
          axisStore.publish(projectAxes(camera, controls.target))
        }
        /*
         * 라벨 축약 — 멀리서는 한 줄, 다가가면 수치까지. **띠를 넘을 때만** DOM 을 건드린다
         * (프레임마다 스무 장의 카드를 다시 쓰면 그것이 곧 프레임 예산이다).
         */
        const compact = camera.position.distanceTo(controls.target) > LABEL_COMPACT_DISTANCE_M
        if (compact !== compactBand) {
          compactBand = compact
          for (const visual of visuals) visual.label?.setCompact(compact)
        }
        /*
         * 가동 중이면 다음 장을 **직접 요청해서** 기류를 잇는다. 요청 한 번은 딱 한 장이므로,
         * 전부 멎으면 종전 규칙대로 곧 0fps 로 내려간다(유예 무한 금지). 움직임 줄이기면
         * 흐르지 않으므로 잇지 않는다.
         */
        /* 도입이 흐르는 동안은 가동 중인 설비가 없어도 다음 장을 청한다 — 안 그러면
           멎어 있는 공장에서 도면이 기울다 만다 */
        if (introRef.current || (!reducedMotion && anyRunning())) requestRenderRef.current?.()
      },
    })

    requestRenderRef.current = loop.requestRender

    /* 손이 닿아 있는 동안은 유휴 판정을 끈다 (lib/renderLoop 의 `setInteracting` 주석) */
    const beginInteract = () => loop.setInteracting(true)
    const endInteract = () => loop.setInteracting(false)
    controls.addEventListener('start', beginInteract)
    controls.addEventListener('end', endInteract)

    /* 저사양 스위치 — 픽셀 밀도·그림자·환경맵을 즉시 따라간다 (도움말 패널의 스위치) */
    const unsubscribeQuality = subscribeQualityMode((low) => {
      lowGpu = low
      renderer.setPixelRatio(pixelRatioFor(low))
      renderer.shadowMap.enabled = !low
      lights.key.castShadow = !low
      if (low && detachEnvironment) {
        detachEnvironment()
        detachEnvironment = null
      } else if (!low && !detachEnvironment) {
        detachEnvironment = attachEnvironment(renderer, threeScene)
      }
      for (const layer of [heatFlow, dryFlow]) {
        if (layer) (layer.particles.material as THREE.ShaderMaterial).uniforms.uPixelRatio.value = pixelRatioFor(low)
      }
      loop.requestRender()
    })

    const observer = new ResizeObserver(() => {
      const width = Math.max(1, container.clientWidth)
      const height = Math.max(1, container.clientHeight)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      labelRenderer.setSize(width, height)
      loop.requestRender()
    })
    observer.observe(container)

    return () => {
      disposed = true
      observer.disconnect()
      if (introFrameRef.current) cancelAnimationFrame(introFrameRef.current)
      introFrameRef.current = 0
      unsubscribeQuality()
      controls.removeEventListener('start', beginInteract)
      controls.removeEventListener('end', endInteract)
      loop.stop()
      focusApi.dispose()
      unbindButtons()
      controls.dispose()
      detachEnvironment?.()
      lights.dispose()
      concrete?.dispose()
      disposeScene(threeScene)
      disposeRenderer(renderer)
      renderer.domElement.remove()
      /* CSS2D 라벨은 GPU 자원이 아니라 DOM 이다 — 렌더러 요소째 떼어 낸다 */
      labelRenderer.domElement.parentNode?.removeChild(labelRenderer.domElement)
      flyCancelRef.current?.()
      flyCancelRef.current = null
      flyToBayRef.current = null
      markUnitRef.current = null
      selectionRef.current = null
      applyValuesRef.current = null
      cameraRef.current = null
      controlsRef.current = null
      requestRenderRef.current = null
    }
    /* 구조·언어가 같으면 다시 세우지 않는다 — 값은 아래 이펙트가 흘려 넣는다 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey, i18n.language])

  /* 값이 바뀌면 씬을 다시 세우지 않고 **갈아 끼운다** (위 `applyValues`) */
  useEffect(() => {
    applyValuesRef.current?.()
    requestRenderRef.current?.()
  }, [scene, t, selectedBay])

  /*
   * 밖에서 데려온 초점 — 목록에서 누른 것이 여기로 온다.
   *
   * **설비가 칸보다 앞선다.** 셀(`EQ039`)을 누르면 그 대가 선 칸도 함께 밝아지는데,
   * 둘 다 따로 반응하면 카메라가 칸으로 갔다가 설비로 다시 가는 두 번 이동이 된다.
   * 고른 것이 설비면 그 대까지 가고, 칸뿐이면 칸에서 멈춘다.
   */
  useEffect(() => {
    if (focusBay === undefined && focusUnit === undefined) return
    const markedBay = markUnitRef.current?.(focusUnit ?? null) ?? null
    const go =
      focusUnit && markedBay
        ? { bay: markedBay, unit: focusUnit }
        : { bay: focusBay ?? null, unit: undefined }
    setSelectedBay(go.bay)
    /*
     * 도면이 아직 일어서는 중이면 **줄을 세운다** — 표식은 지금 찍어 두고(일어서는 동안
     * 어디로 갈지 보인다), 카메라는 도입이 끝난 뒤에 움직인다.
     */
    /*
     * 도입이 도는 중이면 **시계로 줄을 세운다.** 도입의 끝에서 이어 붙이지 않는 이유:
     * 그리기 루프는 절전을 위해 프레임을 건너뛸 수 있어(`lib/renderLoop`) "도입이 끝났다"
     * 는 순간이 늦게 오거나 아예 안 올 수 있다 — 그러면 고른 설비로 영영 가지 않는다.
     * 시계는 그림이 몇 장 그려졌든 같은 때에 울린다.
     */
    /*
     * 도입이 도는 중이면 **그대로 둔다** — 도입의 도착지가 이미 이 자리다(위 무장 코드).
     * 여기서 또 트윈을 걸면 같은 카메라를 두 손이 밀어 화면이 떨린다.
     */
    if (!introRef.current) flyToBayRef.current?.(go.bay, go.unit)
    /* 트윈이 도는 동안 그리기를 이어 준다 — 절전 루프가 중간에 멎지 않게 */
    let frame = requestAnimationFrame(function pump() {
      requestRenderRef.current?.()
      frame = requestAnimationFrame(pump)
    })
    /* 도입이 끝나기를 기다렸다 가는 경우까지 덮는다 */
    const stop = setTimeout(
      () => cancelAnimationFrame(frame),
      TILT_INTRO_MS + CAMERA_FLY_MS + 200
    )
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(stop)
    }
  }, [focusBay, focusUnit])

  /* 선택 강조선 — 고른 베이 하나를 두른다 */
  useEffect(() => {
    const selection = selectionRef.current
    if (!selection) return
    if (selection.line) {
      selection.root.remove(selection.line)
      selection.line.geometry.dispose()
      ;(selection.line.material as THREE.Material).dispose()
      selection.line = null
    }
    const item = scene.items.find((entry) => entry.bay === selectedBay)
    if (item) {
      const line = new THREE.LineSegments(
        selectionRingGeometry(item, BAY_HEIGHT_M),
        new THREE.LineBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.8 })
      )
      selection.root.add(line)
      selection.line = line
    }
    requestRenderRef.current?.()
  }, [selectedBay, scene])

  const selected = scene.items.find((item) => item.bay === selectedBay) ?? null
  const unitTotal = scene.heaterCount + scene.dryerCount
  const runningTotal = scene.items.reduce((sum, item) => sum + item.runningCount, 0)

  return (
    <div className={cn('relative overflow-hidden rounded-inshop-lg bg-[#0a0e13]', className)}>
      <div
        ref={containerRef}
        className="absolute inset-0"
        data-testid="painting-air-viewport"
        /* 화면이 **제가 그린 것을 말한다** — 계기(計器)이자 성능 계약의 검사점이다 */
        data-bay-count={scene.bayCount}
        data-active-bays={scene.activeBays}
        data-unit-count={unitTotal}
        data-layout-source={scene.source}
        data-draw-calls={estimateDrawCalls(scene)}
      />
      {/* 가장자리 비네트 — 그림의 가장자리가 어둡게 잦아들어 시선이 공장에 모인다 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(4,7,11,0.55)_100%)]"
      />

      {/* 그릴 수 없는 환경 — 빈 검은 화면 대신 이유를 말한다 */}
      {webglFailed && (
        <p
          role="status"
          className="absolute inset-0 flex items-center justify-center px-6 text-center text-inshop-sm text-white/60"
        >
          {t('painting.airView.noWebgl')}
        </p>
      )}

      {/* 공장 한 줄 요약 — 이 화면이 몇 면을 세웠고 몇 대가 도는지. 한 줄 유리띠다 */}
      <div className="pointer-events-none absolute left-[var(--vp-inset,1rem)] top-[var(--vp-inset,1rem)] flex items-center gap-2 rounded-full glass-panel px-3 py-1 text-2xs tabular-nums text-glass-foreground/75">
        <span className="flex items-center gap-1.5 font-medium text-glass-foreground">
          <span
            aria-hidden="true"
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              runningTotal > 0 ? 'bg-glass-accent motion-safe:animate-pulse' : 'bg-glass-foreground/30'
            )}
          />
          {t('painting.airView.running', { count: runningTotal })}
        </span>
        <span aria-hidden="true" className="h-3 w-px bg-glass-foreground/20" />
        <span>{t('painting.airView.bayCount', { count: scene.bayCount })}</span>
        <span>{t('painting.airView.unitCount', { count: unitTotal })}</span>
        {scene.source === 'grid' && (
          <span className="rounded-full bg-glass-foreground/10 px-1.5 text-glass-foreground/55">
            {t('painting.airView.gridLayoutNote')}
          </span>
        )}
      </div>

      {selected && !focusUnit && (
        /*
         * 설비 한 대를 짚고 있는 동안에는 칸 상세를 덮지 않는다 — 카드가 화면의 절반을
         * 가려 정작 짚은 그 대와 이름표를 덮었다. 그때 답할 것은 "이 대가 무엇인가"이고,
         * 그 답은 표식의 이름표가 이미 적는다.
         */
        <PaintingBayDetail item={selected} onClose={() => setSelectedBay(null)} />
      )}

      {/* 범례 — 무엇이 무엇인지 색만으로 말하지 않는다. 한 줄이다 */}
      {/* 왼쪽 아래는 축 기즈모의 자리다(shared 규약) — 범례는 오른쪽으로 비켜 세운다 */}
      <div className="pointer-events-none absolute bottom-[var(--vp-inset,1rem)] right-[var(--vp-inset,1rem)] flex items-center gap-2.5 rounded-full glass-panel px-3 py-1 text-2xs text-glass-foreground/75">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: GAS_HEATER }} />
          {t('painting.airView.legendHeat')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: DEHUMIDIFIER }} />
          {t('painting.airView.legendDry')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_HEX.dark.idle }} />
          {t('painting.airView.legendIdle')}
        </span>
        <span aria-hidden="true" className="h-3 w-px bg-glass-foreground/20" />
        <span className="text-glass-foreground/50">{t('painting.airView.intensityNote')}</span>
      </div>

      <div className="absolute right-[var(--vp-inset,1rem)] top-[var(--vp-inset,1rem)] z-10 flex items-start gap-2">
        <ViewportHelp className="static flex-col-reverse" />
        {topRight}
      </div>
      {/* 기즈모는 카메라가 있을 때만 뜻이 있다 */}
      {!webglFailed && (
        <LiveAxisGizmo
          store={axisStore}
          onSelectDirection={handleAxisSelect}
          onGoHome={handleGoHome}
        />
      )}
    </div>
  )
}
