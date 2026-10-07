import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/*
 * 장면의 **옷** — 질감·조명·환경맵처럼 형상이 아니라 인상을 만드는 것들 (R44).
 *
 * 저폴리 형상을 실사에 가깝게 읽히게 하는 것은 폴리곤이 아니라 **빛과 표면**이다:
 *  · 콘크리트 바닥 질감(절차 생성 — 자산 파일 없이 캔버스에 노이즈로 굽는다)
 *  · 공장 밖 바닥의 격자 — 공장이 허공에 뜨지 않게, 10m 격자가 축척을 말한다
 *  · 방 환경맵(`RoomEnvironment`) — 강판·캐비닛에 비치는 반사. PBR 재질의 절반은 이것이다
 *  · 키 라이트의 그림자 — 설비가 바닥에 닿아 있다는 감각
 *
 * 전부 **있으면 좋고 없어도 그려지는** 것들이다. 캔버스 2D 컨텍스트가 없는 환경(jsdom·
 * 일부 원격 데스크톱)에서는 null 을 돌려주고 재질이 질감 없이 선다. 저사양 모드에서는
 * 그림자·환경맵을 끈다(`bay-viewer/lib/qualityMode`).
 */

/** 2D 캔버스를 얻는다 — 못 얻으면 null (질감 없이 간다) */
function canvas2d(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  return { canvas, ctx }
}

/** 결정적 난수 — 같은 자리에 같은 얼룩(리로드마다 바닥이 바뀌지 않게) */
function noise(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/**
 * 콘크리트 질감 — 회색 바탕에 미세한 얼룩과 굵은 골재 점, 그리고 반복 간격마다 한 줄의
 * 신축 줄눈. 정점 색(베이별 밝기)과 곱해지므로 여기서는 **밝기 변화만** 만든다.
 */
export function concreteTexture(size = 256): THREE.Texture | null {
  const c = canvas2d(size)
  if (!c) return null
  const { canvas, ctx } = c
  const image = ctx.createImageData(size, size)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4
      const fine = noise(x * 1.31 + y * 7.17) * 0.12
      const coarse = noise(Math.floor(x / 6) * 3.1 + Math.floor(y / 6) * 5.3) * 0.08
      const grain = noise(x * 0.37 + y * 0.91) > 0.985 ? -0.18 : 0
      const seam = x < 2 || y < 2 ? -0.22 : 0
      const v = Math.round(255 * Math.max(0, Math.min(1, 0.82 + fine + coarse + grain + seam)))
      image.data[i] = v
      image.data[i + 1] = v
      image.data[i + 2] = v
      image.data[i + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/**
 * 공장 밖 바닥의 격자 — 한 칸이 격자 간격(m). 굵은 선은 5칸마다.
 * uv 한 칸 = 격자 5칸이 되게 굽는다(호출 쪽이 repeat 로 축척을 맞춘다).
 */
export function groundGridTexture(size = 256): THREE.Texture | null {
  const c = canvas2d(size)
  if (!c) return null
  const { canvas, ctx } = c
  ctx.fillStyle = '#0b1016'
  ctx.fillRect(0, 0, size, size)
  const cell = size / 5
  ctx.strokeStyle = 'rgba(120, 140, 160, 0.16)'
  ctx.lineWidth = 1
  for (let i = 1; i < 5; i += 1) {
    ctx.beginPath()
    ctx.moveTo(i * cell + 0.5, 0)
    ctx.lineTo(i * cell + 0.5, size)
    ctx.moveTo(0, i * cell + 0.5)
    ctx.lineTo(size, i * cell + 0.5)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(120, 140, 160, 0.34)'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, size - 2, size - 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/** 격자 한 칸(m) */
export const GROUND_GRID_M = 10

/**
 * 공장 밖 바닥 한 장 — 장면 범위의 몇 배로 깔아 공장이 허공에 뜨지 않게 한다.
 */
export function buildGround(center: THREE.Vector3, extent: number): THREE.Mesh {
  const size = Math.max(400, extent * 4)
  const texture = groundGridTexture()
  if (texture) texture.repeat.set(size / (GROUND_GRID_M * 5), size / (GROUND_GRID_M * 5))
  const material = new THREE.MeshBasicMaterial({
    color: texture ? 0xffffff : 0x0b1016,
    map: texture,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(center.x, -0.05, center.z)
  mesh.receiveShadow = true
  return mesh
}

export interface SceneLights {
  key: THREE.DirectionalLight
  dispose: () => void
}

/**
 * 조명 — 하늘/땅 반구광 + 그림자를 만드는 키 라이트 + 반대편의 약한 보조광.
 * 키 라이트의 그림자 카메라는 장면 상자를 딱 덮게 잡는다(넓게 잡을수록 그림자가 뭉개진다).
 */
export function addLights(scene: THREE.Scene, box: THREE.Box3, shadows: boolean): SceneLights {
  const hemi = new THREE.HemisphereLight(0x7f95ad, 0x1b2129, 1.1)
  scene.add(hemi)

  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const radius = Math.max(size.x, size.z, 40)

  const key = new THREE.DirectionalLight(0xfff2e2, 2.4)
  key.position.copy(center).add(new THREE.Vector3(0.45 * radius, 0.9 * radius, 0.55 * radius))
  key.target.position.copy(center)
  key.castShadow = shadows
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.left = -radius * 0.6
  key.shadow.camera.right = radius * 0.6
  key.shadow.camera.top = radius * 0.6
  key.shadow.camera.bottom = -radius * 0.6
  key.shadow.camera.near = radius * 0.2
  key.shadow.camera.far = radius * 2.6
  key.shadow.bias = -0.0008
  key.shadow.normalBias = 0.3
  scene.add(key)
  scene.add(key.target)

  const fill = new THREE.DirectionalLight(0x9fb4c6, 0.5)
  fill.position.copy(center).add(new THREE.Vector3(-0.6 * radius, 0.5 * radius, -0.4 * radius))
  scene.add(fill)

  return {
    key,
    dispose: () => {
      key.shadow.dispose()
    },
  }
}

/**
 * 환경맵 — 방 하나를 미리 필터링해 반사로 쓴다. 강판·캐비닛의 하이라이트가 여기서 온다.
 * 렌더러 하나당 한 번 만들고, 씬을 헐 때 함께 버린다.
 */
export function attachEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene): () => void {
  const pmrem = new THREE.PMREMGenerator(renderer)
  let target: THREE.WebGLRenderTarget | null = null
  try {
    target = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = target.texture
    scene.environmentIntensity = 0.75
  } catch {
    /* 환경맵을 못 만들면 반사 없이 간다 — 형상은 그대로 선다 */
  }
  pmrem.dispose()
  return () => {
    scene.environment = null
    target?.dispose()
  }
}
