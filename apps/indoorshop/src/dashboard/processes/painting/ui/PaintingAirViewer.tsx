import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import * as THREE from 'three'
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
import { LiveAxisGizmo } from '../../../shared/features/bay-viewer/ui/LiveViewportOverlay'
import { createViewportOverlayStore } from '../../../shared/features/bay-viewer/lib/viewportOverlayStore'
import { ViewportHelp } from '../../../shared/features/bay-viewer/ui/ViewportHelp'
import { cn } from '../../../shared/lib/utils'
import { STATUS_HEX } from '../../../shared/ui/statusPalette'
import { DEHUMIDIFIER, GAS_HEATER } from './equipmentIcon'
import {
  PARTICLES_PER_BAY_MAX,
  fitParticleBudget,
  particleCountOf,
  type BayAirState,
} from '../lib/airEffect'

/*
 * 도장 **가동 뷰** — 점군 대신 **장비가 만드는 공기**를 그린다 (P5).
 *
 * 조립·의장의 3D 는 점군이다. 거기엔 그릴 물체(블록)가 있기 때문이다. 도장 베이에는 그
 * 물체가 없다 — 도장에서 실제로 일어나는 일은 **공기를 만드는 것**이고, 그래서 이 뷰가
 * 그리는 것도 공기다:
 *
 *   가스히터 가동  →  따뜻한 앰버 헤이즈 + 히터 자리에서 피어오르는 열 글로우
 *   제습기 가동    →  차고 맑은 톤 + 제습기 쪽으로 빨려드는 미세 기류 스트릭
 *   정지           →  무채 감쇄 (있다는 사실만 남기고 물러선다)
 *
 * **세기는 SCADA 값을 따라간다** — 목표 온도에 못 미칠수록 헤이즈가 진하고, 습도가
 * 목표를 넘을수록 기류가 강하다. 그 수식은 여기 없다(`lib/airEffect`) — 렌더 코드 안의
 * 수식은 검증할 수 없기 때문이다. 이 파일은 규칙이 정한 세기를 **그리기만** 한다.
 *
 * 껍데기(카메라 조작·포커스·기즈모·도움말·그리기 루프)는 전부 shared bay-viewer 를 쓴다 —
 * 조작 문법이 조립·의장과 갈리면 화면을 옮길 때마다 손이 다시 배워야 한다.
 *
 * 성능: 파티클은 예산 안에서만(`fitParticleBudget`), 그리기 루프는 놀 때 멈춘다.
 * 애니메이션이 있으므로 **가동 중인 베이가 있을 때만** 계속 그리도록 요청한다 — 전부
 * 정지한 공장은 정지 화면이라 0fps 로 내려간다.
 */

/*
 * 색은 **새로 정하지 않는다.**
 *  · 히터·제습기는 배치 지도의 마커와 같은 색을 쓴다(`ui/equipmentIcon`) — 지도에서 본
 *    빨간 점이 여기서 파랗게 서면 같은 설비인지 알아볼 수 없다.
 *  · 정지는 상태 팔레트의 `idle` — 정상/이상 색과 같은 축에서 온다(P3, `statusPalette`).
 */
const HEAT_COLOR = new THREE.Color(GAS_HEATER).getHex()
const DRY_COLOR = new THREE.Color(DEHUMIDIFIER).getHex()
const IDLE_COLOR = new THREE.Color(STATUS_HEX.dark.idle).getHex()

/** 씬 좌표 스케일 — EPSG:5187 미터를 화면 단위로 */
const METERS_PER_UNIT = 3

interface BayMesh {
  group: THREE.Group
  haze: THREE.Mesh | null
  particles: THREE.Points | null
  streaks: THREE.Points | null
  state: BayAirState
}

/** 베이 볼륨의 실루엣 — 채우지 않고 모서리만. 공기가 주인공이고 상자는 그릇이다 */
function buildBayShell(width: number, depth: number, height: number, color: number): THREE.Object3D {
  const geometry = new THREE.BoxGeometry(width, height, depth)
  const edges = new THREE.EdgesGeometry(geometry)
  geometry.dispose()
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 })
  const shell = new THREE.LineSegments(edges, material)
  shell.position.y = height / 2
  return shell
}

/** 베이를 채우는 헤이즈 — 상자 안쪽에 부드러운 덩어리 하나 */
function buildHaze(width: number, depth: number, height: number, color: number): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(width * 0.92, height * 0.8, depth * 0.92)
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.y = height * 0.45
  return mesh
}

/**
 * 파티클 한 벌 — 열 글로우(위로 피어오름)와 기류 스트릭(설비로 빨려듦)이 같은 부품이다.
 * 다른 것은 **어디서 나서 어디로 가는가**뿐이라, 시작점·목표점만 다르게 채운다.
 */
function buildParticles(count: number, color: number, size: number): THREE.Points {
  const positions = new Float32Array(count * 3)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
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

export interface PaintingAirViewerProps {
  bays: readonly BayAirState[]
  className?: string
}

export function PaintingAirViewer({ bays, className }: PaintingAirViewerProps) {
  const { t } = useTranslation()
  /**
   * **세기는 매초 바뀌고 구조는 안 바뀐다.**
   *
   * SCADA 폴링이 돌 때마다 `bays` 는 새 배열이 된다. 그 identity 로 씬을 다시 세우면
   * 6초마다 WebGL 컨텍스트째로 헐고 다시 짓는다 — 그리는 도중에 헐리니 화면은 계속
   * 검다. 그래서 **구조(어떤 베이에 어떤 설비가 있는가)** 가 바뀔 때만 다시 세우고,
   * 세기는 ref 로 흘려 넣는다.
   */
  const sceneKey = bays.map((bay) => `${bay.bay}:${bay.units.map((u) => u.id).join('|')}`).join(';')
  const baysRef = useRef<readonly BayAirState[]>(bays)
  baysRef.current = bays
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const homeRef = useRef<HomePose | null>(null)
  const requestRenderRef = useRef<(() => void) | null>(null)
  /*
   * 기즈모는 카메라 방향을 화면에 되비춘다 — 프레임마다 축을 투영해 담는다.
   * 담는 곳은 React 상태가 **아니다**: 그리기 콜백 안에서 setState 를 하면 프레임마다
   * 이 뷰어 전체가 리렌더되고, 그 리렌더가 다시 이펙트를 흔든다
   * (`shared/features/bay-viewer/lib/viewportOverlayStore` 주석 참조).
   */
  const axisStore = useRef(createViewportOverlayStore<AxisViewState | null>(null)).current
  /**
   * WebGL 을 못 얻었는가.
   *
   * 원격 데스크톱·구형 드라이버·GPU 차단 정책에서는 컨텍스트 생성이 실패한다. 그때
   * 화면이 통째로 죽는 대신 **왜 못 그리는지 말하고 물러선다** — 이 뷰는 SCADA 목록이
   * 이미 말하는 것을 그림으로 한 번 더 보여 주는 자리라, 없어도 일은 계속할 수 있다.
   */
  const [webglFailed, setWebglFailed] = useState(false)

  /* 조작 문법은 조립·의장의 그것 그대로다 — 방향 클릭·홈 복귀 모두 shared 헬퍼가 한다 */
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

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0e13)

    const camera = new THREE.PerspectiveCamera(
      42,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      2000
    )
    cameraRef.current = camera

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true })
    } catch {
      /* 컨텍스트를 못 얻었다 — 껍데기(범례·도움말)는 남기고 그림만 접는다 */
      setWebglFailed(true)
      cameraRef.current = null
      return
    }
    setWebglFailed(false)
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controlsRef.current = controls
    controls.enableDamping = true
    /* 조작 문법은 조립·의장과 같다 — 화면을 옮길 때 손이 다시 배우지 않게 */
    applyBlenderMouseBindings(controls)
    const unbindButtons = bindModifierAwareButtons(controls, renderer.domElement)
    const focusApi = bindViewportFocus(controls, camera, container, {})

    /* ── 씬 구성 — 베이를 한 줄로 세우고 그 안에 설비 자리를 실좌표 비율로 찍는다 ── */
    const root = new THREE.Group()
    scene.add(root)

    const meshes: BayMesh[] = []
    const counts = bays.map((bay) =>
      particleCountOf(Math.max(bay.hazeIntensity, bay.streakIntensity), PARTICLES_PER_BAY_MAX)
    )
    const budget = fitParticleBudget(counts)

    /*
     * 베이는 **격자**로 세운다. 한 줄로 늘어놓으면 15개짜리 공장이 화면을 가로질러
     * 가느다란 띠가 되고, 카메라를 맞추면 베이 하나가 몇 픽셀로 줄어든다.
     * 열 수는 √n — 가로세로가 엇비슷해져 화면을 고르게 쓴다.
     */
    const columns = Math.max(1, Math.ceil(Math.sqrt(bays.length)))
    const GAP = 4
    let cursorX = 0
    let cursorZ = 0
    let rowDepth = 0
    bays.forEach((bay, index) => {
      const spanX = Math.max(8, (bay.bounds.maxX - bay.bounds.minX) / METERS_PER_UNIT)
      const spanZ = Math.max(8, (bay.bounds.maxY - bay.bounds.minY) / METERS_PER_UNIT)
      const height = 6

      if (index > 0 && index % columns === 0) {
        /* 줄이 바뀐다 — 앞 줄에서 가장 깊었던 베이만큼 뒤로 물린다 */
        cursorZ += rowDepth + GAP
        cursorX = 0
        rowDepth = 0
      }
      const group = new THREE.Group()
      group.position.x = cursorX + spanX / 2
      group.position.z = cursorZ + spanZ / 2
      cursorX += spanX + GAP
      rowDepth = Math.max(rowDepth, spanZ)
      root.add(group)

      group.add(buildBayShell(spanX, spanZ, height, IDLE_COLOR))
      const haze = buildHaze(spanX, spanZ, height, HEAT_COLOR)
      group.add(haze)

      /* 설비 자리 — 베이 안의 **실좌표 비율**을 그대로 옮긴다(지어낸 배치가 아니다) */
      const localOf = (x: number, y: number) => {
        const w = bay.bounds.maxX - bay.bounds.minX || 1
        const d = bay.bounds.maxY - bay.bounds.minY || 1
        return {
          x: ((x - bay.bounds.minX) / w - 0.5) * spanX,
          z: ((y - bay.bounds.minY) / d - 0.5) * spanZ,
        }
      }

      for (const unit of bay.units) {
        const local = localOf(unit.x, unit.y)
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.35, 8, 6),
          new THREE.MeshBasicMaterial({
            color: unit.running ? (unit.kind === '가스히터' ? HEAT_COLOR : DRY_COLOR) : IDLE_COLOR,
            transparent: true,
            opacity: unit.running ? 0.95 : 0.35,
          })
        )
        marker.position.set(local.x, 0.4, local.z)
        group.add(marker)
      }

      const count = budget[index] ?? 0
      let particles: THREE.Points | null = null
      let streaks: THREE.Points | null = null
      if (count > 0) {
        const heaters = bay.units.filter((u) => u.running && u.kind === '가스히터')
        const dryers = bay.units.filter((u) => u.running && u.kind === '제습기')
        if (heaters.length > 0) {
          particles = buildParticles(count, HEAT_COLOR, 0.55)
          particles.userData.seeds = heaters.map((h) => localOf(h.x, h.y))
          particles.userData.height = height
          group.add(particles)
        }
        if (dryers.length > 0) {
          streaks = buildParticles(count, DRY_COLOR, 0.4)
          streaks.userData.seeds = dryers.map((d) => localOf(d.x, d.y))
          streaks.userData.spanX = spanX
          streaks.userData.spanZ = spanZ
          group.add(streaks)
        }
      }
      meshes.push({ group, haze, particles, streaks, state: bay })
    })

    /* 카메라 — 전체가 한 화면에 들어오게 */
    const box = new THREE.Box3().setFromObject(root)
    if (!box.isEmpty()) frameBox(camera, controls, box, 1.5)
    homeRef.current = captureHomePose(camera, controls)

    /* ── 애니메이션 — 시간에 따라 파티클을 흘린다 ── */
    let axisSignature = ''
    const startedAt = performance.now()
    const anyRunning = () => baysRef.current.some((bay) => bay.mode !== 'idle')

    const animate = (elapsed: number) => {
      /* 세기는 늘 최신을 읽는다 — 씬을 다시 세우지 않고 값만 흘려 넣는 통로 */
      const latest = new Map(baysRef.current.map((bay) => [bay.bay, bay]))
      for (const mesh of meshes) {
        const state = latest.get(mesh.state.bay) ?? mesh.state
        if (mesh.haze) {
          /* 헤이즈 진하기 = 열 세기. 아주 느리게 숨쉬어 '살아 있는 공기' 로 읽히게 */
          const breathe = 0.85 + 0.15 * Math.sin(elapsed / 2600)
          ;(mesh.haze.material as THREE.MeshBasicMaterial).opacity =
            state.hazeIntensity * 0.22 * breathe
        }
        if (mesh.particles) {
          /* 열 글로우 — 히터 자리에서 위로 피어오르고, 천장에 닿으면 처음으로 돌아간다 */
          const seeds = mesh.particles.userData.seeds as { x: number; z: number }[]
          const height = mesh.particles.userData.height as number
          const attr = mesh.particles.geometry.getAttribute('position') as THREE.BufferAttribute
          const speed = 0.4 + state.hazeIntensity * 1.4
          for (let i = 0; i < attr.count; i += 1) {
            const seed = seeds[i % seeds.length]
            const phase = (i * 0.37 + (elapsed / 1000) * speed) % 1
            const drift = Math.sin(elapsed / 900 + i) * 0.5
            attr.setXYZ(i, seed.x + drift, phase * height, seed.z + Math.cos(elapsed / 1100 + i) * 0.5)
          }
          attr.needsUpdate = true
          ;(mesh.particles.material as THREE.PointsMaterial).opacity = 0.25 + state.hazeIntensity * 0.6
        }
        if (mesh.streaks) {
          /* 기류 스트릭 — 베이 가장자리에서 제습기 쪽으로 빨려든다(반대 방향) */
          const seeds = mesh.streaks.userData.seeds as { x: number; z: number }[]
          const spanX = mesh.streaks.userData.spanX as number
          const spanZ = mesh.streaks.userData.spanZ as number
          const attr = mesh.streaks.geometry.getAttribute('position') as THREE.BufferAttribute
          const speed = 0.3 + state.streakIntensity * 1.2
          for (let i = 0; i < attr.count; i += 1) {
            const target = seeds[i % seeds.length]
            const phase = (i * 0.29 + (elapsed / 1000) * speed) % 1
            /* phase 1 → 0 으로 가면서 목표에 다가간다 */
            const away = 1 - phase
            const angle = i * 2.399
            attr.setXYZ(
              i,
              target.x + Math.cos(angle) * away * spanX * 0.45,
              0.6 + away * 1.6,
              target.z + Math.sin(angle) * away * spanZ * 0.45
            )
          }
          attr.needsUpdate = true
          ;(mesh.streaks.material as THREE.PointsMaterial).opacity = 0.2 + state.streakIntensity * 0.6
        }
      }
    }
    animate(0)

    const loop = startRenderLoop({
      controls,
      render: () => {
        const elapsed = performance.now() - startedAt
        /* 움직이는 것이 있을 때만 다시 계산한다 — 전부 정지면 정지 화면이다 */
        if (anyRunning()) animate(elapsed)
        renderer.render(scene, camera)
        /*
         * 기즈모는 **카메라가 실제로 돌았을 때만** 갱신한다. 프레임마다 setState 하면
         * 60fps 로 리렌더가 돌고, 그 리렌더가 다시 이 이펙트를 흔든다(그 되먹임이
         * 화면이 검게 남았던 원인이다). 회전 서명이 바뀔 때만 올린다.
         */
        const signature = `${camera.quaternion.x.toFixed(3)},${camera.quaternion.y.toFixed(3)},${camera.quaternion.z.toFixed(3)},${camera.quaternion.w.toFixed(3)}`
        if (signature !== axisSignature) {
          axisSignature = signature
          axisStore.publish(projectAxes(camera, controls.target))
        }

        /*
         * 가동 중이면 다음 장을 **직접 요청해서** 애니메이션을 잇는다.
         *
         * 예전에는 유예를 `1_000_000ms` 로 열어 두는 방식이었는데, 그것은 유휴 정지를
         * 사실상 없앤 것이라 **전부 정지한 공장에서도 영원히 초당 60장을 그렸다**
         * (W6-8 절전이 이 뷰어만 통째로 빠져 있었던 셈이다). 요청 한 번은 딱 한 장을
         * 뜻하므로, 움직일 것이 남아 있는 동안만 프레임이 이어지고 전부 멎으면
         * 종전 규칙대로 곧 0fps 로 내려간다.
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
      disposeScene(scene)
      disposeRenderer(renderer)
      renderer.domElement.remove()
      cameraRef.current = null
      controlsRef.current = null
      requestRenderRef.current = null
    }
    /* 구조가 같으면 다시 세우지 않는다 — 세기는 위 ref 로 들어온다 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey])

  return (
    <div className={cn('relative overflow-hidden rounded-inshop-lg bg-[#0a0e13]', className)}>
      <div ref={containerRef} className="absolute inset-0" data-testid="painting-air-viewport" />

      {/* 그릴 수 없는 환경 — 빈 검은 화면 대신 이유를 말한다 */}
      {webglFailed && (
        <p
          role="status"
          className="absolute inset-0 flex items-center justify-center px-6 text-center text-inshop-sm text-white/60"
        >
          {t('painting.airView.noWebgl')}
        </p>
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
