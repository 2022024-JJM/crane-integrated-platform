import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { LoadedBlockModel } from '../../../../shared/features/bay-viewer/model/blockModel'
import { getMergedAssemblyPositions, getRestPose } from '../../../../shared/features/bay-viewer/model/blockModel'
import { fitDistanceForSphere } from '../../../../shared/features/bay-viewer/lib/fitCamera'
import { cn } from '../../../../shared/lib/utils'

interface AssemblyOrbitPreviewProps {
  model: LoadedBlockModel
  assemblyIds: string[]
  /** 마우스 조작 허용 — 기본 true. 호버 팝업처럼 입력을 받지 않는 자리에서는 끈다 */
  interactive?: boolean
  className?: string
}

/**
 * 조립체 3D 프리뷰 — 가만히 두면 360° 자동 회전하고, 마우스를 대면 사용자가 몬다.
 * 드래그로 궤도 회전, 휠로 확대, 우클릭 드래그로 평행 이동, 더블클릭으로 초기 각도 복귀.
 * 조작이 끝나고 잠시 손을 떼면 다시 자동 회전으로 돌아간다.
 *
 * 라이브 WebGL 캔버스다. 목록에 여러 개 늘어놓을 수 있도록 **화면 밖으로 나가면
 * 렌더 루프를 멈추지만**(컨텍스트는 유지), 캔버스 자체를 오래 안 쓸 것 같으면
 * 호출부가 언마운트해서 컨텍스트를 돌려주는 편이 낫다 (`BlockShapePreview` 참조).
 */
export function AssemblyOrbitPreview({
  model,
  assemblyIds,
  interactive = true,
  className,
}: AssemblyOrbitPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const soup = getMergedAssemblyPositions(model, assemblyIds)
    if (soup.length === 0) return
    const rest = getRestPose(model, assemblyIds)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x11151a)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.3))
    const light = new THREE.DirectionalLight(0xffffff, 1.3)
    light.position.set(1, 2, 1.5)
    scene.add(light)

    // 안착 자세로 눕히고 중심을 원점으로 — 제자리 회전축 확보 (공유 버퍼 보호를 위해 복사)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(soup.slice(), 3))
    geometry.applyQuaternion(new THREE.Quaternion(...rest.restQuat))
    geometry.computeBoundingBox()
    const center = geometry.boundingBox!.getCenter(new THREE.Vector3())
    const size = geometry.boundingBox!.getSize(new THREE.Vector3())
    geometry.translate(-center.x, -center.y, -center.z)
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    const maxDim = Math.max(size.x, size.y, size.z)
    /*
     * 프레이밍은 바운딩 **구** 로 잡는다. 대상이 계속 돌아가므로 어느 각도에서도
     * 화면 밖으로 나가지 않아야 하고, 그 조건을 만족하는 건 구뿐이다.
     */
    const radius = geometry.boundingSphere?.radius ?? maxDim / 2

    const material = new THREE.MeshLambertMaterial({ color: 0xa8bccb, side: THREE.DoubleSide })
    scene.add(new THREE.Mesh(geometry, material))

    const FOV = 45
    /** 3/4 부감 — 길이·폭·높이가 한 번에 읽히는 각도 */
    const viewDirection = new THREE.Vector3(0.85, 0.65, 1.15).normalize()

    const camera = new THREE.PerspectiveCamera(FOV, 1, radius / 100, radius * 20)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    /*
     * 목록에서는 이 캔버스가 여러 장 동시에 돈다 — 3배 밀도(고DPI 노트북)로 그리면
     * 픽셀 수가 9배가 된다. 작은 프리뷰에서 2배를 넘겨 얻는 것은 거의 없다.
     */
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    /*
     * 회전은 오브젝트가 아니라 **카메라**가 한다. 사용자가 드래그로 잡는 것도
     * 카메라이므로, 자동 회전까지 카메라 쪽에 맡겨야 두 조작이 같은 좌표계에서
     * 이어진다 (오브젝트를 돌리면 드래그한 각도가 계속 어긋난다).
     */
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enabled = interactive
    controls.enableDamping = true
    controls.dampingFactor = 0.12
    controls.rotateSpeed = 0.9
    controls.zoomSpeed = 0.8
    controls.enablePan = interactive
    controls.panSpeed = 0.7
    /*
     * 자동 회전이 기본이다 — 정지 이미지로는 형강 하나가 앞에 있는지 뒤에 있는지
     * 알 수 없고, 목록에서 블록을 구분하는 단서가 결국 형상이기 때문이다.
     * 다만 모션 저감을 켠 사용자에게는 돌리지 않는다 (그 각도 그대로 멈춰 선다).
     */
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    controls.autoRotate = !reduceMotion
    controls.autoRotateSpeed = 1.6
    controls.minDistance = radius * 0.6
    controls.maxDistance = radius * 8
    controls.target.set(0, 0, 0)
    if (interactive) renderer.domElement.style.cursor = 'grab'

    /** 사용자가 각도를 잡은 뒤에는 리사이즈가 그 각도를 건드리지 않는다 */
    let userAdjusted = false
    /** 손을 뗀 뒤 이만큼 조용하면 자동 회전 재개 */
    const RESUME_DELAY_MS = 2500
    let resumeTimer: ReturnType<typeof setTimeout> | undefined

    function suspendAutoRotate() {
      userAdjusted = true
      controls.autoRotate = false
      clearTimeout(resumeTimer)
    }
    function scheduleResume() {
      if (reduceMotion) return
      clearTimeout(resumeTimer)
      resumeTimer = setTimeout(() => {
        controls.autoRotate = true
      }, RESUME_DELAY_MS)
    }

    const handlePointerDown = () => {
      suspendAutoRotate()
      renderer.domElement.style.cursor = 'grabbing'
    }
    const handlePointerUp = () => {
      renderer.domElement.style.cursor = 'grab'
      scheduleResume()
    }
    const handleWheel = () => {
      suspendAutoRotate()
      scheduleResume()
    }
    /** 더블클릭 = 처음 보던 3/4 부감으로 복귀 */
    const handleDoubleClick = () => {
      userAdjusted = false
      controls.target.set(0, 0, 0)
      fitToContainer()
      scheduleResume()
    }

    if (interactive) {
      renderer.domElement.addEventListener('pointerdown', handlePointerDown)
      window.addEventListener('pointerup', handlePointerUp)
      renderer.domElement.addEventListener('wheel', handleWheel, { passive: true })
      renderer.domElement.addEventListener('dblclick', handleDoubleClick)
    }

    /** 컨테이너 크기가 바뀌면 종횡비와 거리를 다시 잡는다 (안 하면 잘리거나 늘어난다) */
    function fitToContainer() {
      const width = container!.clientWidth
      const height = container!.clientHeight
      if (width === 0 || height === 0) return

      const aspect = width / height
      camera.aspect = aspect
      if (!userAdjusted) {
        camera.position.copy(viewDirection).multiplyScalar(fitDistanceForSphere(radius, FOV, aspect, 1.04))
        camera.lookAt(0, 0, 0)
      }
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      controls.update()
    }
    fitToContainer()

    const resizeObserver = new ResizeObserver(fitToContainer)
    resizeObserver.observe(container)

    /*
     * 화면 밖에서는 아무것도 그리지 않는다.
     * 목록에 카드가 열 장 있어도 실제로 도는 것은 보이는 두어 장뿐이어야, 옆의
     * 큰 점군 뷰어가 프레임을 뺏기지 않는다. (rAF 는 계속 돌지만 하는 일이 없다)
     */
    let onScreen = true
    const visibilityObserver =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            onScreen = entry.isIntersecting
          })
    visibilityObserver?.observe(container)

    let animationId: number
    function animate() {
      animationId = requestAnimationFrame(animate)
      if (!onScreen) return
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      resizeObserver.disconnect()
      visibilityObserver?.disconnect()
      cancelAnimationFrame(animationId)
      clearTimeout(resumeTimer)
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointerup', handlePointerUp)
      renderer.domElement.removeEventListener('wheel', handleWheel)
      renderer.domElement.removeEventListener('dblclick', handleDoubleClick)
      controls.dispose()
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [model, assemblyIds, interactive])

  return (
    <div className={cn('relative overflow-hidden rounded-inshop-md bg-viewport', className)}>
      <div ref={containerRef} className="h-full w-full" />
      {interactive && (
        <p className="pointer-events-none absolute bottom-1.5 left-2 font-mono text-[10px] text-white/45">
          드래그 회전 · 휠 확대 · 더블클릭 초기화
        </p>
      )}
    </div>
  )
}
