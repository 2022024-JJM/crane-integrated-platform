import * as THREE from 'three'

/**
 * three.js 장면의 GPU 자원 해제 — **언마운트 때 무엇을 놓치는가**를 한 곳에 모은다.
 *
 * three.js 는 자바스크립트 객체를 GC 가 치워 주지만 **GPU 쪽(버퍼·텍스처·WebGL 컨텍스트)은
 * 치워 주지 않는다.** `dispose()` 를 부르는 것은 우리 몫이고, 놓치면 뷰어를 열고 닫을 때마다
 * 자원이 쌓인다 — 몇 번 만에 `WARNING: Too many active WebGL contexts` 가 뜨고 제일 오래된
 * 컨텍스트가 강제로 죽는다(= 다른 탭의 뷰어가 검게 변한다).
 *
 * 손으로 쓰던 traverse 가 놓치던 것 셋:
 *  1. **텍스처** — 재질만 dispose 하면 그 재질이 쥔 텍스처(map·alphaMap·envMap…)는 남는다.
 *     배경 그라디언트(CanvasTexture)처럼 우리가 만든 것뿐 아니라 재질에 실린 전부를 훑는다.
 *  2. **Mesh/Points/Line 이 아닌 객체** — Sprite 는 셋 중 어느 것도 아니지만 geometry·material
 *     을 쥔다. 클래스로 거르지 않고 **가진 것으로** 거른다(instanceof 목록은 늘 늦게 는다).
 *  3. **공유 자원의 중복 dispose** — 여러 Mesh 가 한 재질을 나눠 쓰면 같은 것을 여러 번
 *     부른다. three.js 는 멱등이지만 dispose 이벤트가 그 수만큼 발생한다. Set 으로 한 번씩만.
 *
 * 순수 함수다 — 렌더러도 DOM 도 모른다. 그래서 WebGL 없이(노드) 테스트할 수 있다.
 */

/** 한 번의 해제에서 실제로 dispose 한 자원 수 — 테스트와 진단이 읽는 값 */
export interface DisposeCounts {
  geometries: number
  materials: number
  textures: number
}

/** 재질이 쥐고 있는 텍스처 전부 — 속성 이름을 나열하지 않는다(새 맵이 늘어도 따라간다) */
function texturesOf(material: THREE.Material): THREE.Texture[] {
  const found: THREE.Texture[] = []
  for (const value of Object.values(material as unknown as Record<string, unknown>)) {
    if (value instanceof THREE.Texture) found.push(value)
  }
  return found
}

/**
 * 객체 트리의 GPU 자원을 전부 해제한다.
 *
 * 트리에서 떼어 내지는 않는다 — 떼는 것은 호출부의 몫이고(장면을 다시 쓸 수도 있다),
 * 여기서는 "GPU 가 쥔 것을 놓게 하는" 일만 한다.
 */
export function disposeObject3D(root: THREE.Object3D): DisposeCounts {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()

  root.traverse((object) => {
    /* 클래스가 아니라 가진 것으로 거른다 — Sprite·InstancedMesh·LineSegments 를 다 잡는다 */
    const withGeometry = object as unknown as { geometry?: unknown; material?: unknown }
    /*
     * ⚠️ Sprite 의 geometry 는 three.js 가 **모든 스프라이트가 나눠 쓰는 하나**다(모듈 전역).
     * 그걸 dispose 하면 이 장면이 아니라 앱 전체의 스프라이트가 깨진다 — 재질만 놓는다.
     */
    if (withGeometry.geometry instanceof THREE.BufferGeometry && !(object instanceof THREE.Sprite)) {
      geometries.add(withGeometry.geometry)
    }
    const material = withGeometry.material
    const list = Array.isArray(material) ? material : material ? [material] : []
    for (const entry of list) {
      if (entry instanceof THREE.Material) {
        materials.add(entry)
        for (const texture of texturesOf(entry)) textures.add(texture)
      }
    }
  })

  for (const geometry of geometries) geometry.dispose()
  /* 텍스처를 재질보다 **먼저** 놓는다 — 재질을 먼저 버리면 그 재질이 쥔 텍스처를 더는
     찾아갈 수 없는 구현이 있다(우리가 이미 모아 뒀으므로 순서만 지키면 된다) */
  for (const texture of textures) texture.dispose()
  for (const material of materials) material.dispose()

  return { geometries: geometries.size, materials: materials.size, textures: textures.size }
}

/**
 * 장면 하나를 통째로 정리한다 — 자원 해제 + 트리 비우기.
 *
 * `clear()` 까지 하는 이유는 자바스크립트 쪽 참조를 끊기 위해서다. 장면이 살아 있는 한
 * 그 아래 수십만 점의 버퍼 객체도 GC 대상이 아니다 — dispose 는 GPU 쪽만 놓아 준다.
 */
export function disposeScene(scene: THREE.Scene): DisposeCounts {
  const counts = disposeObject3D(scene)
  if (scene.background instanceof THREE.Texture) {
    scene.background.dispose()
    counts.textures += 1
  }
  scene.clear()
  return counts
}

/**
 * 렌더러를 놓는다 — `dispose()` 만으로는 **WebGL 컨텍스트가 남는다**.
 *
 * 브라우저는 탭당 활성 컨텍스트를 8~16개로 제한한다. 뷰어를 열고 닫기만 반복해도 그 수를
 * 넘기고, 넘기는 순간 브라우저가 제일 오래된 컨텍스트를 죽인다 — 화면에는 "다른 뷰어가
 * 갑자기 검게 변하는" 버그로 나타난다. `forceContextLoss()` 가 그 자리에서 돌려준다.
 *
 * 캔버스도 부모에서 떼어 낸다(호출부가 잊기 쉬운 자리라 여기서 함께 한다).
 */
export function disposeRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.dispose()
  /* 테스트 더블(모의 렌더러)에는 없을 수 있다 — 있으면 부른다 */
  renderer.forceContextLoss?.()
  renderer.domElement.parentNode?.removeChild(renderer.domElement)
}
