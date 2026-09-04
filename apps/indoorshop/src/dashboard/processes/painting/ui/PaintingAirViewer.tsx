import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import * as THREE from 'three'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  applyBlenderMouseBindings,
  bindModifierAwareButtons,
  captureHomePose,
  frameBox,
  resetToHome,
  setViewDirection,
  type HomePose,
  type ViewDirection,
} from '../../../shared/features/bay-viewer/lib/blenderControls'
import { projectAxes, type AxisViewState } from '../../../shared/features/bay-viewer/lib/axisGizmo'
import { bindViewportFocus } from '../../../shared/features/bay-viewer/lib/viewportInput'
import { startRenderLoop } from '../../../shared/features/bay-viewer/lib/renderLoop'
import { disposeRenderer, disposeScene } from '../../../shared/features/bay-viewer/lib/disposeScene'
import { makeLabelObject } from '../../../shared/features/bay-viewer/lib/labelCards'
import { LiveAxisGizmo } from '../../../shared/features/bay-viewer/ui/LiveViewportOverlay'
import { createViewportOverlayStore } from '../../../shared/features/bay-viewer/lib/viewportOverlayStore'
import { ViewportHelp } from '../../../shared/features/bay-viewer/ui/ViewportHelp'
import { cn } from '../../../shared/lib/utils'
import { STATUS_HEX } from '../../../shared/ui/statusPalette'
import { DEHUMIDIFIER, GAS_HEATER } from './equipmentIcon'
import { EQUIPMENT_SYMBOL_SCALE, equipmentGeometryOf } from './equipmentShapes'
import { buildFactoryFloorGeometry, FLOOR_PALETTE, selectionRingGeometry } from './factoryFloor'
import { createBayLabelCard, type BayLabelCard } from './bayLabel'
import { PaintingBayDetail } from './PaintingBayDetail'
import { BAY_HEIGHT_M, estimateDrawCalls, type BaySceneItem, type BayScene } from '../lib/bayScene'
import { PARTICLES_PER_BAY_MAX, fitParticleBudget, particleCountOf } from '../lib/airEffect'

/*
 * 도장 **가동 뷰** — 장비가 만드는 공기를, **도장공장 안에서** 그린다 (P5 · R38).
 *
 * 조립·의장의 3D 는 점군이다. 거기엔 그릴 물체(블록)가 있기 때문이다. 도장 베이에서
 * 실제로 일어나는 일은 **공기를 만드는 것**이고, 그래서 이 뷰의 주인공도 공기다:
 *
 *   가스히터 가동  →  따뜻한 앰버 헤이즈 + 히터 자리에서 피어오르는 열 글로우
 *   제습기 가동    →  차고 맑은 톤 + 제습기 쪽으로 빨려드는 미세 기류 스트릭
 *   정지           →  무채 감쇄 (있다는 사실만 남기고 물러선다)
 *
 * **세기는 SCADA 값을 따라간다** — 목표 온도에 못 미칠수록 헤이즈가 진하고, 습도가
 * 목표를 넘을수록 기류가 강하다. 그 수식은 여기 없다(`lib/airEffect`).
 *
 * ── R38 에서 바뀐 것 ────────────────────────────────────────────
 * 공기만 있고 **공장이 없었다.** 베이는 설비 좌표의 외접 상자(=8m 큐브)였고, 설비는
 * 종류를 구별할 수 없는 구슬이었으며, 화면 어디에도 베이 이름·온습도·재실 블록이 없었다.
 * "큐브만 가져다 뒀다"는 말이 정확했다. 이제 세 겹이 함께 선다:
 *  · **배치** — 실형상 베이 발자국(지번 fixture)과 바닥 구획선·벽 골조 (`ui/factoryFloor`)
 *  · **형상** — 종류를 실루엣으로 구별하는 저폴리 설비, 관례 자리에 (`ui/equipmentShapes`,
 *    `lib/bayStations`)
 *  · **정보** — 베이 이름·환경 수치·가동 대수·재실 블록을 적는 3D 라벨 (`ui/bayLabel`),
 *    누르면 그 베이의 상세
 * 좌표·자리·문구는 전부 렌더 밖(`lib/*`)이 정한다 — 이 파일은 **그리기만** 한다.
 *
 * 껍데기(카메라 조작·포커스·기즈모·도움말·그리기 루프·라벨 카드 앵커)는 전부 shared
 * bay-viewer 를 쓴다 — 조작 문법이 조립·의장과 갈리면 화면을 옮길 때마다 손이 다시 배운다.
 *
 * 성능 계약(P0):
 *  · 그리기 콜백 안에서 setState 하지 않는다 — 기즈모는 오버레이 스토어로 흘린다.
 *  · 바닥·구획선·골조는 **하나로 합치고**, 설비는 **종류당 InstancedMesh 하나**다
 *    (대수와 무관하게 2콜). 어림수는 `lib/bayScene` 의 `estimateDrawCalls` 가 잠근다.
 *  · 파티클은 예산 안에서만 그린다 — 버퍼는 상한만큼 잡아 두고 **그리는 개수**만 바꾼다
 *    (개수가 바뀔 때마다 씬을 다시 세우지 않기 위해서다).
 *  · 그리기 루프는 놀 때 멈춘다. 가동 중인 베이가 있는 동안만 다음 장을 요청한다.
 */

const HEAT_COLOR = new THREE.Color(GAS_HEATER)
const DRY_COLOR = new THREE.Color(DEHUMIDIFIER)
const IDLE_COLOR = new THREE.Color(STATUS_HEX.dark.idle)

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

interface BayVisual {
  bay: string
  group: THREE.Group
  haze: THREE.Mesh | null
  heat: THREE.Points | null
  dry: THREE.Points | null
  /** 설비가 없는 베이는 라벨을 달지 않는다 — 아래 씬 구성 주석 참조 */
  label: BayLabelCard | null
}

/** 파티클 한 벌 — 열 글로우와 기류 스트릭이 같은 부품이다(시작·목표만 다르다) */
function buildParticles(capacity: number, color: THREE.Color, size: number): THREE.Points {
  const positions = new Float32Array(capacity * 3)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setDrawRange(0, 0)
  const material = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })
  return new THREE.Points(geometry, material)
}

/** 이 베이에서 이 종류의 설비가 선 자리 — 파티클의 씨앗 */
function seedsOf(item: BaySceneItem, kind: '가스히터' | '제습기'): { x: number; z: number }[] {
  return item.stations
    .filter((station) => station.kind === kind)
    .map((station) => ({ x: station.x, z: station.z }))
}

export interface PaintingAirViewerProps {
  scene: BayScene
  className?: string
}

export function PaintingAirViewer({ scene, className }: PaintingAirViewerProps) {
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
  const requestRenderRef = useRef<(() => void) | null>(null)
  const visualsRef = useRef<BayVisual[]>([])
  const instancedRef = useRef<{ heater: THREE.InstancedMesh | null; dryer: THREE.InstancedMesh | null }>({
    heater: null,
    dryer: null,
  })
  const selectionRef = useRef<{ root: THREE.Group; line: THREE.LineSegments | null } | null>(null)
  /** 베이별로 지금 그릴 파티클 수 — 값이 바뀔 때만 다시 계산한다(프레임마다 하지 않는다) */
  const budgetRef = useRef<Map<string, { heat: number; dry: number }>>(new Map())
  /** 씬을 다시 세우지 않고 값만 갈아 끼우는 통로 — 씬을 세울 때 채워진다 */
  const applyValuesRef = useRef<(() => void) | null>(null)
  const [selectedBay, setSelectedBay] = useState<string | null>(null)
  const selectedRef = useRef<string | null>(null)
  selectedRef.current = selectedBay
  /* 라벨 클릭은 씬을 세울 때 한 번 묶인다 — 콜백이 바뀌어도 씬을 다시 세우지 않게 ref 로 */
  const selectRef = useRef<(bay: string) => void>(() => {})
  selectRef.current = (bay: string) => setSelectedBay((prev) => (prev === bay ? null : bay))

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
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.setSize(container.clientWidth, container.clientHeight)
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

    /* 형상이 읽히려면 빛이 있어야 한다 — 저폴리 면의 밝기 차가 실루엣을 만든다 */
    threeScene.add(new THREE.AmbientLight(0x9fb4c6, 1.5))
    const key = new THREE.DirectionalLight(0xffffff, 1.6)
    key.position.set(0.4, 1, 0.6)
    threeScene.add(key)

    const root = new THREE.Group()
    threeScene.add(root)

    /* ── ① 바닥·구획선·벽 골조 — 셋을 각각 하나로 합쳐 3콜 ── */
    const floorGeometry = buildFactoryFloorGeometry(built.items, BAY_HEIGHT_M)
    const floorMesh = new THREE.Mesh(
      floorGeometry.floor,
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })
    )
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
          new THREE.LineBasicMaterial({
            color: FLOOR_PALETTE.frame,
            transparent: true,
            opacity: 0.5,
          })
        )
      )
    }

    /* ── ② 설비 — 종류당 InstancedMesh 하나(대수와 무관하게 2콜) ── */
    const stations = built.items.flatMap((item) =>
      item.stations.map((station) => ({ item, station }))
    )
    const dummy = new THREE.Object3D()
    const makeInstanced = (kind: '가스히터' | '제습기') => {
      const list = stations.filter((s) => s.station.kind === kind)
      if (list.length === 0) return null
      const geometry = equipmentGeometryOf(kind)
      geometry.scale(EQUIPMENT_SYMBOL_SCALE, EQUIPMENT_SYMBOL_SCALE, EQUIPMENT_SYMBOL_SCALE)
      const mesh = new THREE.InstancedMesh(
        geometry,
        new THREE.MeshLambertMaterial({ color: 0xffffff }),
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
        dummy.rotation.set(0, station.yaw + bayRad, 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(index, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      /* 경계 상자를 직접 알려 준다 — 인스턴스가 원점에만 있는 것으로 잘못 컬링되지 않게 */
      mesh.frustumCulled = false
      root.add(mesh)
      return { mesh, list }
    }
    const heaterSet = makeInstanced('가스히터')
    const dryerSet = makeInstanced('제습기')
    instancedRef.current = { heater: heaterSet?.mesh ?? null, dryer: dryerSet?.mesh ?? null }
    /* 인스턴스 순서 — 값 갱신이 같은 순서로 색을 다시 칠하려면 기억해 둬야 한다 */
    const heaterOrder = heaterSet?.list.map((s) => s.station.id) ?? []
    const dryerOrder = dryerSet?.list.map((s) => s.station.id) ?? []

    /* ── ③ 베이별 공기와 라벨 ── */
    const visuals: BayVisual[] = []
    for (const item of built.items) {
      const group = new THREE.Group()
      group.position.set(item.center[0], 0, item.center[1])
      group.rotation.y = (item.rotationDeg * Math.PI) / 180
      root.add(group)

      let haze: THREE.Mesh | null = null
      let heat: THREE.Points | null = null
      let dry: THREE.Points | null = null

      if (item.air) {
        const [w, l] = item.size
        haze = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.9, BAY_HEIGHT_M * 0.8, l * 0.9),
          new THREE.MeshBasicMaterial({
            color: HEAT_COLOR,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
        )
        haze.position.y = BAY_HEIGHT_M * 0.45
        group.add(haze)

        const heatSeeds = seedsOf(item, '가스히터')
        if (heatSeeds.length > 0) {
          heat = buildParticles(PARTICLES_PER_BAY_MAX, HEAT_COLOR, 1.6)
          heat.userData.seeds = heatSeeds
          heat.frustumCulled = false
          group.add(heat)
        }
        const drySeeds = seedsOf(item, '제습기')
        if (drySeeds.length > 0) {
          dry = buildParticles(PARTICLES_PER_BAY_MAX, DRY_COLOR, 1.2)
          dry.userData.seeds = drySeeds
          dry.userData.spanX = item.size[0]
          dry.userData.spanZ = item.size[1]
          dry.frustumCulled = false
          group.add(dry)
        }
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

      visuals.push({ bay: item.bay, group, haze, heat, dry, label: card })
    }
    visualsRef.current = visuals

    /* 선택 강조선은 고를 때마다 다시 만든다 — 한 면뿐이라 콜 하나 */
    const selectionRoot = new THREE.Group()
    root.add(selectionRoot)
    selectionRef.current = { root: selectionRoot, line: null }

    /* 카메라 — 공장 전체가 한 화면에 들어오게 */
    floorGeometry.floor.computeBoundingBox()
    const box = floorGeometry.floor.boundingBox?.clone() ?? new THREE.Box3()
    if (!box.isEmpty()) {
      box.max.y = BAY_HEIGHT_M
      /*
       * 처음 보는 각을 **위에서 비스듬히**로 정한다. shared 기본값은 (1,1,1) 등각인데,
       * 그 각은 점군 덩어리에는 맞아도 **평면에 넓게 퍼진 공장 배치**에는 맞지 않는다 —
       * 베이 줄이 화면 대각선으로 눕고 위아래 여백만 남는다. 배치를 보러 온 화면이므로
       * 도면에 가까운 각에서 시작하고, 그다음은 손이 정한다.
       */
      camera.position.set(0.35, 1, 0.55).multiplyScalar(100)
      controls.target.set(0, 0, 0)
      frameBox(camera, controls, box, 1.05)
    }
    homeRef.current = captureHomePose(camera, controls)

    /* ── 애니메이션 — 시간에 따라 공기를 흘린다 ── */
    let axisSignature = ''
    let compactBand: boolean | null = null
    const startedAt = performance.now()
    const anyRunning = () => sceneRef.current.items.some((item) => item.runningCount > 0)

    const animate = (elapsed: number) => {
      /* 값은 늘 최신을 읽는다 — 씬을 다시 세우지 않고 값만 흘려 넣는 통로 */
      const latest = new Map(sceneRef.current.items.map((item) => [item.bay, item]))
      for (const visual of visuals) {
        const item = latest.get(visual.bay)
        const air = item?.air ?? null
        const budget = budgetRef.current.get(visual.bay) ?? { heat: 0, dry: 0 }

        if (visual.haze) {
          /* 헤이즈 진하기 = 열 세기. 아주 느리게 숨쉬어 '살아 있는 공기'로 읽히게 */
          const breathe = 0.85 + 0.15 * Math.sin(elapsed / 2600)
          ;(visual.haze.material as THREE.MeshBasicMaterial).opacity =
            (air?.hazeIntensity ?? 0) * 0.3 * breathe
        }

        if (visual.heat) {
          const count = budget.heat
          visual.heat.visible = count > 0
          if (count > 0) {
            /* 열 글로우 — 히터 자리에서 위로 피어오르고, 천장에 닿으면 처음으로 돌아간다 */
            const seeds = visual.heat.userData.seeds as { x: number; z: number }[]
            const attr = visual.heat.geometry.getAttribute('position') as THREE.BufferAttribute
            const intensity = air?.hazeIntensity ?? 0
            const speed = 0.4 + intensity * 1.4
            for (let i = 0; i < count; i += 1) {
              const seed = seeds[i % seeds.length]
              const phase = (i * 0.37 + (elapsed / 1000) * speed) % 1
              const drift = Math.sin(elapsed / 900 + i) * 1.6
              attr.setXYZ(
                i,
                seed.x + drift,
                phase * BAY_HEIGHT_M,
                seed.z + Math.cos(elapsed / 1100 + i) * 1.6
              )
            }
            attr.needsUpdate = true
            visual.heat.geometry.setDrawRange(0, count)
            ;(visual.heat.material as THREE.PointsMaterial).opacity = 0.25 + intensity * 0.6
          }
        }

        if (visual.dry) {
          const count = budget.dry
          visual.dry.visible = count > 0
          if (count > 0) {
            /* 기류 스트릭 — 베이 가장자리에서 제습기 쪽으로 빨려든다(반대 방향) */
            const seeds = visual.dry.userData.seeds as { x: number; z: number }[]
            const spanX = visual.dry.userData.spanX as number
            const spanZ = visual.dry.userData.spanZ as number
            const attr = visual.dry.geometry.getAttribute('position') as THREE.BufferAttribute
            const intensity = air?.streakIntensity ?? 0
            const speed = 0.3 + intensity * 1.2
            for (let i = 0; i < count; i += 1) {
              const target = seeds[i % seeds.length]
              const phase = (i * 0.29 + (elapsed / 1000) * speed) % 1
              /* phase 1 → 0 으로 가면서 목표에 다가간다 */
              const away = 1 - phase
              const angle = i * 2.399
              attr.setXYZ(
                i,
                target.x + Math.cos(angle) * away * spanX * 0.42,
                1.5 + away * 5,
                target.z + Math.sin(angle) * away * spanZ * 0.42
              )
            }
            attr.needsUpdate = true
            visual.dry.geometry.setDrawRange(0, count)
            ;(visual.dry.material as THREE.PointsMaterial).opacity = 0.2 + intensity * 0.6
          }
        }
      }
    }

    /* 값 갱신 통로 — 인스턴스 색·라벨 글자·파티클 예산을 한 번에 다시 잡는다.
     * React 렌더 밖(DOM/GPU 직접 쓰기)이라 리렌더를 부르지 않는다. */
    const applyValues = () => {
      const current = sceneRef.current
      const byBay = new Map(current.items.map((item) => [item.bay, item]))
      const runningById = new Map<string, boolean>()
      for (const item of current.items) {
        for (const unit of item.air?.units ?? []) runningById.set(unit.id, unit.running)
      }

      const paint = (mesh: THREE.InstancedMesh | null, order: string[], color: THREE.Color) => {
        if (!mesh) return
        order.forEach((id, index) => {
          mesh.setColorAt(index, runningById.get(id) ? color : IDLE_COLOR)
        })
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      }
      paint(instancedRef.current.heater, heaterOrder, HEAT_COLOR)
      paint(instancedRef.current.dryer, dryerOrder, DRY_COLOR)

      /* 파티클 예산 — 공장 총량 상한 안에서 베이별로 나눈다(`lib/airEffect`) */
      const slots = current.items.flatMap((item) => {
        const air = item.air
        if (!air) return []
        const entries: { bay: string; kind: 'heat' | 'dry'; want: number }[] = []
        if (item.stations.some((s) => s.kind === '가스히터')) {
          entries.push({
            bay: item.bay,
            kind: 'heat',
            want: particleCountOf(air.hazeIntensity, PARTICLES_PER_BAY_MAX),
          })
        }
        if (item.stations.some((s) => s.kind === '제습기')) {
          entries.push({
            bay: item.bay,
            kind: 'dry',
            want: particleCountOf(air.streakIntensity, PARTICLES_PER_BAY_MAX),
          })
        }
        return entries
      })
      const fitted = fitParticleBudget(slots.map((slot) => slot.want))
      const budget = new Map<string, { heat: number; dry: number }>()
      slots.forEach((slot, index) => {
        const entry = budget.get(slot.bay) ?? { heat: 0, dry: 0 }
        entry[slot.kind] = fitted[index] ?? 0
        budget.set(slot.bay, entry)
      })
      budgetRef.current = budget

      for (const visual of visuals) {
        const item = byBay.get(visual.bay)
        if (!item || !visual.label) continue
        visual.label.update(
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
    animate(0)

    const loop = startRenderLoop({
      controls,
      render: () => {
        const elapsed = performance.now() - startedAt
        /* 움직이는 것이 있을 때만 다시 계산한다 — 전부 정지면 정지 화면이다 */
        if (anyRunning()) animate(elapsed)
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
         * 가동 중이면 다음 장을 **직접 요청해서** 애니메이션을 잇는다. 요청 한 번은 딱
         * 한 장이므로, 전부 멎으면 종전 규칙대로 곧 0fps 로 내려간다(유예 무한 금지).
         */
        if (anyRunning()) requestRenderRef.current?.()
      },
    })

    requestRenderRef.current = loop.requestRender

    /* 손이 닿아 있는 동안은 유휴 판정을 끈다 (lib/renderLoop 의 `setInteracting` 주석) */
    const beginInteract = () => loop.setInteracting(true)
    const endInteract = () => loop.setInteracting(false)
    controls.addEventListener('start', beginInteract)
    controls.addEventListener('end', endInteract)

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
      observer.disconnect()
      controls.removeEventListener('start', beginInteract)
      controls.removeEventListener('end', endInteract)
      loop.stop()
      focusApi.dispose()
      unbindButtons()
      controls.dispose()
      disposeScene(threeScene)
      disposeRenderer(renderer)
      renderer.domElement.remove()
      /* CSS2D 라벨은 GPU 자원이 아니라 DOM 이다 — 렌더러 요소째 떼어 낸다 */
      labelRenderer.domElement.parentNode?.removeChild(labelRenderer.domElement)
      visualsRef.current = []
      instancedRef.current = { heater: null, dryer: null }
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

      {/* 그릴 수 없는 환경 — 빈 검은 화면 대신 이유를 말한다 */}
      {webglFailed && (
        <p
          role="status"
          className="absolute inset-0 flex items-center justify-center px-6 text-center text-inshop-sm text-white/60"
        >
          {t('painting.airView.noWebgl')}
        </p>
      )}

      {/* 공장 한 줄 요약 — 이 화면이 몇 면을 세웠고 몇 대가 도는지 */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-0.5 rounded-inshop-md bg-black/55 px-2.5 py-2 text-2xs text-white/75 backdrop-blur-sm">
        <span className="font-medium text-white/90">
          {t('painting.airView.bayCount', { count: scene.bayCount })} ·{' '}
          {t('painting.airView.unitCount', { count: unitTotal })}
        </span>
        <span>{t('painting.airView.running', { count: runningTotal })}</span>
        {scene.source === 'grid' && (
          <span className="text-white/45">{t('painting.airView.gridLayoutNote')}</span>
        )}
      </div>

      {selected && (
        <PaintingBayDetail item={selected} onClose={() => setSelectedBay(null)} />
      )}

      {/* 범례 — 무엇이 무엇인지 색만으로 말하지 않는다 */}
      {/* 왼쪽 아래는 축 기즈모의 자리다(shared 규약) — 범례는 오른쪽으로 비켜 세운다 */}
      <div className="pointer-events-none absolute bottom-3 right-3 flex flex-col gap-1 rounded-inshop-md bg-black/55 px-2.5 py-2 text-2xs text-white/70 backdrop-blur-sm">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: GAS_HEATER }} />
          {t('painting.airView.legendHeat')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: DEHUMIDIFIER }} />
          {t('painting.airView.legendDry')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: STATUS_HEX.dark.idle }} />
          {t('painting.airView.legendIdle')}
        </span>
        <span className="mt-0.5 text-white/45">{t('painting.airView.intensityNote')}</span>
      </div>

      <div className="absolute right-3 top-3 z-10">
        <ViewportHelp className="static flex-col-reverse" />
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
