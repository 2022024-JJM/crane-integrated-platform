import * as THREE from 'three'
import { fitDistanceForBox } from '../../pointcloud-viewer/lib/fitCamera'

/**
 * 조립체 형상의 정적 썸네일 생성기.
 * 카드마다 WebGL 캔버스를 살려두면 무거워지므로, 모듈 공유 오프스크린 렌더러로
 * 1회 렌더링해 PNG dataURL로 뽑고 캐시한다 — DOM에는 <img>만 남는다.
 */
const THUMB_WIDTH = 240
const THUMB_HEIGHT = 170

const cache = new Map<string, string>()
let sharedRenderer: THREE.WebGLRenderer | null = null

export function renderAssemblyThumbnail(
  cacheKey: string,
  soup: Float32Array,
  restQuat: [number, number, number, number]
): string | null {
  const cached = cache.get(cacheKey)
  if (cached) return cached
  if (soup.length === 0) return null

  if (!sharedRenderer) {
    sharedRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
    sharedRenderer.setSize(THUMB_WIDTH, THUMB_HEIGHT)
    sharedRenderer.setPixelRatio(1)
  }

  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.3))
  const light = new THREE.DirectionalLight(0xffffff, 1.3)
  light.position.set(1, 2, 1.5)
  scene.add(light)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(soup.slice(), 3))

  // 뷰어와 동일하게 안정 안착 자세(전처리 계산값)로 눕힌다
  geometry.applyQuaternion(new THREE.Quaternion(...restQuat))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()

  const material = new THREE.MeshLambertMaterial({ color: 0xa8bccb, side: THREE.DoubleSide })
  scene.add(new THREE.Mesh(geometry, material))

  const box = geometry.boundingBox!
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)

  /*
   * 시선은 고정이므로 바운딩 박스 꼭짓점을 실제로 투영해 딱 맞는 거리를 구한다 —
   * "가장 긴 변 × 상수" 로 잡으면 긴 부재가 가로로 누웠을 때 잘린다.
   */
  const FOV = 45
  const aspect = THUMB_WIDTH / THUMB_HEIGHT
  const direction = new THREE.Vector3(0.95, 0.75, 1.25).normalize()
  const distance = fitDistanceForBox(box, direction, FOV, aspect)

  const camera = new THREE.PerspectiveCamera(FOV, aspect, distance / 100, distance + maxDim * 4)
  camera.position.copy(direction).multiplyScalar(distance).add(center)
  camera.lookAt(center)

  sharedRenderer.render(scene, camera)
  const url = sharedRenderer.domElement.toDataURL('image/png')

  geometry.dispose()
  material.dispose()

  cache.set(cacheKey, url)
  return url
}
