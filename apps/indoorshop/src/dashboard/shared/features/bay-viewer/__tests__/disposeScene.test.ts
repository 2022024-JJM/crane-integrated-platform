import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { disposeObject3D, disposeRenderer, disposeScene } from '../lib/disposeScene'

/**
 * 뷰어를 열고 닫아도 **GPU 자원이 쌓이지 않는가**.
 *
 * 이건 눈으로 볼 수 없는 종류의 버그다 — 몇 번 열고 닫은 뒤 다른 탭의 뷰어가 갑자기 검게
 * 변하고 나서야 드러난다(WebGL 컨텍스트 한도 초과). 그래서 "만든 만큼 놓았는가"를 세어
 * 확인한다: 살아 있는 자원 수가 반복 후에도 **평평해야** 한다.
 */

/** 만들어진/놓아진 자원을 세는 저울 — dispose 를 가로채 살아 있는 수를 추적한다 */
function createScale() {
  const live = { geometries: 0, materials: 0, textures: 0 }
  const track = <T extends { dispose: () => void }>(resource: T, key: keyof typeof live): T => {
    live[key] += 1
    const original = resource.dispose.bind(resource)
    let released = false
    resource.dispose = () => {
      /* 공유 자원이 두 번 불려도 한 번만 센다 — 음수로 내려가면 저울이 거짓말을 한다 */
      if (!released) {
        released = true
        live[key] -= 1
      }
      original()
    }
    return resource
  }
  return { live, track }
}

/** 뷰어 한 판이 만드는 것과 닮은 장면 — 점군·메시·선·스프라이트·텍스처 실은 재질 */
function buildScene(scale: ReturnType<typeof createScale>) {
  const scene = new THREE.Scene()

  const points = new THREE.Points(
    scale.track(new THREE.BufferGeometry(), 'geometries'),
    scale.track(new THREE.PointsMaterial(), 'materials')
  )
  const mesh = new THREE.Mesh(
    scale.track(new THREE.BoxGeometry(), 'geometries'),
    scale.track(new THREE.MeshBasicMaterial(), 'materials')
  )
  const line = new THREE.Line(
    scale.track(new THREE.BufferGeometry(), 'geometries'),
    scale.track(new THREE.LineBasicMaterial(), 'materials')
  )
  /* Sprite 는 Mesh/Points/Line 어느 것도 아니다 — 손으로 쓴 instanceof 목록이 놓치던 자리 */
  const sprite = new THREE.Sprite(scale.track(new THREE.SpriteMaterial(), 'materials'))

  /* 재질이 쥔 텍스처 — 재질만 dispose 하면 남는다 */
  const texture = scale.track(new THREE.Texture(), 'textures')
  ;(mesh.material as THREE.MeshBasicMaterial).map = texture

  /* 두 메시가 한 재질을 나눠 쓰는 경우 — 중복 dispose 로 저울이 음수가 되면 안 된다 */
  const shared = scale.track(new THREE.MeshBasicMaterial(), 'materials')
  const a = new THREE.Mesh(scale.track(new THREE.BufferGeometry(), 'geometries'), shared)
  const b = new THREE.Mesh(scale.track(new THREE.BufferGeometry(), 'geometries'), shared)

  scene.add(points, mesh, line, sprite, a, b)
  return scene
}

describe('장면 자원 해제', () => {
  it('만든 자원을 빠짐없이 놓는다 — geometry·material·texture', () => {
    const scale = createScale()
    const scene = buildScene(scale)
    expect(scale.live).toEqual({ geometries: 5, materials: 5, textures: 1 })

    const counts = disposeObject3D(scene)
    expect(counts).toEqual({ geometries: 5, materials: 5, textures: 1 })
    expect(scale.live).toEqual({ geometries: 0, materials: 0, textures: 0 })
  })

  it('Sprite 처럼 Mesh/Points/Line 이 아닌 객체의 재질도 놓는다', () => {
    const scale = createScale()
    const scene = new THREE.Scene()
    scene.add(new THREE.Sprite(scale.track(new THREE.SpriteMaterial(), 'materials')))
    disposeObject3D(scene)
    expect(scale.live.materials).toBe(0)
  })

  it('Sprite 의 geometry 는 건드리지 않는다 — 모든 스프라이트가 나눠 쓰는 하나다', () => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial())
    const spy = vi.spyOn(sprite.geometry, 'dispose')
    const scene = new THREE.Scene()
    scene.add(sprite)
    expect(disposeObject3D(scene).geometries).toBe(0)
    expect(spy).not.toHaveBeenCalled()
  })

  it('재질에 실린 텍스처를 재질보다 먼저 놓는다 — 재질만 버리면 텍스처가 남는다', () => {
    const order: string[] = []
    const material = new THREE.MeshBasicMaterial()
    const texture = new THREE.Texture()
    material.map = texture
    vi.spyOn(material, 'dispose').mockImplementation(() => order.push('material'))
    vi.spyOn(texture, 'dispose').mockImplementation(() => order.push('texture'))
    const scene = new THREE.Scene()
    scene.add(new THREE.Mesh(new THREE.BufferGeometry(), material))

    disposeObject3D(scene)
    expect(order).toEqual(['texture', 'material'])
  })

  it('공유 재질은 한 번만 놓는다 — 여러 메시가 나눠 써도', () => {
    const shared = new THREE.MeshBasicMaterial()
    const spy = vi.spyOn(shared, 'dispose')
    const scene = new THREE.Scene()
    scene.add(new THREE.Mesh(new THREE.BufferGeometry(), shared))
    scene.add(new THREE.Mesh(new THREE.BufferGeometry(), shared))

    const counts = disposeObject3D(scene)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(counts.materials).toBe(1)
  })

  it('배경 텍스처와 트리 자체를 함께 비운다 — JS 쪽 참조도 끊어야 GC 가 가져간다', () => {
    const scale = createScale()
    const scene = buildScene(scale)
    scene.background = scale.track(new THREE.Texture(), 'textures')

    disposeScene(scene)
    expect(scale.live).toEqual({ geometries: 0, materials: 0, textures: 0 })
    expect(scene.children).toHaveLength(0)
  })
})

describe('마운트-언마운트 10회 반복', () => {
  it('반복 후 살아 있는 자원 수가 평평하다 — 열고 닫을수록 쌓이지 않는다', () => {
    const scale = createScale()
    const peak: number[] = []

    for (let i = 0; i < 10; i += 1) {
      const scene = buildScene(scale)
      peak.push(scale.live.geometries + scale.live.materials + scale.live.textures)
      disposeScene(scene)
      /* 매 회 닫은 직후는 반드시 0 — 한 회라도 남으면 그 다음 회부터 쌓인다 */
      expect(scale.live).toEqual({ geometries: 0, materials: 0, textures: 0 })
    }

    /* 회차마다 정점이 같다 = 누적이 없다 (첫 회 11, 열 번째도 11) */
    expect(new Set(peak).size).toBe(1)
    expect(peak).toHaveLength(10)
  })

  it('렌더러도 10회 반복 후 컨텍스트를 남기지 않는다', () => {
    let liveContexts = 0
    const makeRenderer = () => {
      liveContexts += 1
      const canvas = { parentNode: null } as unknown as HTMLCanvasElement
      return {
        domElement: canvas,
        dispose: () => {},
        /* 컨텍스트를 실제로 돌려주는 것은 forceContextLoss 다 — dispose 만으로는 남는다 */
        forceContextLoss: () => {
          liveContexts -= 1
        },
      } as unknown as THREE.WebGLRenderer
    }

    for (let i = 0; i < 10; i += 1) disposeRenderer(makeRenderer())
    expect(liveContexts).toBe(0)
  })

  it('forceContextLoss 가 없는 렌더러(테스트 더블)에서도 죽지 않는다', () => {
    const renderer = {
      domElement: { parentNode: null } as unknown as HTMLCanvasElement,
      dispose: () => {},
    } as unknown as THREE.WebGLRenderer
    expect(() => disposeRenderer(renderer)).not.toThrow()
  })
})
