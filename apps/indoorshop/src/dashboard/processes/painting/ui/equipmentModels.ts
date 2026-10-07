import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { publicAsset } from '../../../shared/lib/public-asset'
import { DEHUMIDIFIER_MODEL, GAS_HEATER_MODEL } from './equipmentShapes'

/*
 * 설비 **glTF 모델**을 인스턴싱용 지오메트리 하나로 굽는다 (R46).
 *
 * 뷰어(`PaintingAirViewer`)의 성능 계약은 "종류당 InstancedMesh 하나, 정점 색 하나의
 * 재질"이다. 모델링 도구가 내보낸 glTF 는 그 반대다 — 부품마다 메시 하나, 재질 여러 개
 * (가스히터 모델은 메시 181개·재질 9개, 제습기는 318개·16개). 그래서 파일을 그대로 장면에 넣지 않고 여기서
 * **한 번 구워** 저폴리 실루엣(`equipmentShapes`)과 같은 모양의 지오메트리로 만든다:
 *
 *  · 부품의 월드 변환을 정점에 적용하고 전부 하나로 합친다 (`mergeGeometries`).
 *  · 재질의 baseColor 를 **정점 색**으로 적는다 — 뷰어 재질이 `vertexColors` 하나뿐이다.
 *    이미 정점 색이 있는 부품은 둘을 곱한다. 텍스처는 쓰지 않는다(모델에도 없다).
 *  · **반투명 부품은 버린다.** 모델에 든 공기 표현(히터의 `warm_air*`, 제습기의
 *    `flow_*`·`airflow_puffs`·유리창)은 이 화면의 기류장(`ui/airFlowField`)이 이미 SCADA
 *    값으로 그리는 것이라 겹치면 두 번 말하는 셈이 된다.
 *  · 모델 좌표를 형상 로컬 좌표로 **배율** 한 번 — 값은 `equipmentShapes` 의 모델 규약이
 *    갖는다(토출점·표시등이 같은 값으로 서야 하므로 여기서 재지 않는다).
 *
 * 굽는 일(`bakeEquipmentModel`)은 순수 함수라 파일 없이 노드에서 테스트한다. 파일을
 * 가져오는 일(`loadEquipmentModel`)은 한 번만 하고 결과를 나눠 준다 — 다만 뷰어가 언마운트
 * 때 지오메트리를 dispose 하므로 **복제본**을 준다(캐시가 같이 죽지 않게).
 */

export type EquipmentKind = '가스히터' | '제습기'

/** 종류별 모델 — 없는 종류는 저폴리 실루엣 그대로 */
const MODEL_OF: Partial<Record<EquipmentKind, { url: string; scale: number }>> = {
  가스히터: { url: GAS_HEATER_MODEL.url, scale: GAS_HEATER_MODEL.scale },
  제습기: { url: DEHUMIDIFIER_MODEL.url, scale: DEHUMIDIFIER_MODEL.scale },
}

export function equipmentModelUrlOf(kind: EquipmentKind): string | null {
  return MODEL_OF[kind]?.url ?? null
}

function isTransparent(material: THREE.Material): boolean {
  return material.transparent || material.opacity < 1
}

function colorOf(material: THREE.Material): THREE.Color {
  const color = (material as { color?: THREE.Color }).color
  return color instanceof THREE.Color ? color : new THREE.Color(1, 1, 1)
}

/**
 * 메시 하나를 합칠 수 있는 형태로 — 월드 변환 적용, 정점 색 채움, 속성 집합 통일
 * (position·normal·color 만). 인덱스가 없는 메시는 그대로 두고 합칠 때 풀어 준다.
 */
function bakeMesh(mesh: THREE.Mesh, material: THREE.Material): THREE.BufferGeometry {
  const geometry = mesh.geometry.clone()
  geometry.applyMatrix4(mesh.matrixWorld)
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()

  const tint = colorOf(material)
  const count = geometry.getAttribute('position').count
  const existing = geometry.getAttribute('color')
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    const r = existing ? existing.getX(i) : 1
    const g = existing ? existing.getY(i) : 1
    const b = existing ? existing.getZ(i) : 1
    colors[i * 3] = r * tint.r
    colors[i * 3 + 1] = g * tint.g
    colors[i * 3 + 2] = b * tint.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  for (const name of Object.keys(geometry.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'color') geometry.deleteAttribute(name)
  }
  geometry.morphAttributes = {}
  return geometry
}

/**
 * 모델 트리 → 지오메트리 하나. 반투명 부품은 빼고, 재질 색을 정점 색으로 굽고, `scale`
 * 로 형상 로컬 좌표에 맞춘다. 쓸 부품이 하나도 없으면 null.
 */
export function bakeEquipmentModel(root: THREE.Object3D, scale: number): THREE.BufferGeometry | null {
  root.updateMatrixWorld(true)
  const parts: THREE.BufferGeometry[] = []
  root.traverse((object) => {
    if (!(object as THREE.Mesh).isMesh) return
    const mesh = object as THREE.Mesh
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    /* 재질이 여럿(그룹)인 메시는 첫 재질 색으로 — 이 모델에는 없고, 있어도 실루엣은 남는다 */
    const material = materials[0]
    if (!material || isTransparent(material)) return
    parts.push(bakeMesh(mesh, material))
  })
  if (parts.length === 0) return null

  /* 인덱스 유무가 섞이면 합칠 수 없다 — 하나라도 없으면 전부 푼다 */
  const uniform = parts.every((part) => part.index !== null) ? parts : parts.map((part) => part.toNonIndexed())
  const merged = mergeGeometries(uniform, false)
  for (const part of parts) part.dispose()
  if (!merged) return null
  merged.scale(scale, scale, scale)
  merged.computeBoundingBox()
  merged.computeBoundingSphere()
  return merged
}

const cache = new Map<EquipmentKind, Promise<THREE.BufferGeometry | null>>()

/**
 * 종류의 모델 지오메트리(형상 로컬 좌표, 배율 적용 전 `EQUIPMENT_SYMBOL_SCALE` 미적용).
 * 모델이 없는 종류·가져오기 실패는 null — 호출자는 저폴리 실루엣을 그대로 둔다.
 * 돌려주는 것은 복제본이라 마음껏 scale·dispose 해도 된다.
 */
export async function loadEquipmentModel(kind: EquipmentKind): Promise<THREE.BufferGeometry | null> {
  const model = MODEL_OF[kind]
  if (!model) return null
  let pending = cache.get(kind)
  if (!pending) {
    pending = new GLTFLoader()
      .loadAsync(publicAsset(model.url))
      .then((gltf) => bakeEquipmentModel(gltf.scene, model.scale))
      .catch((error: unknown) => {
        console.warn(`[painting] 설비 모델을 가져오지 못했다 — 저폴리 실루엣으로 둔다: ${model.url}`, error)
        return null
      })
    cache.set(kind, pending)
  }
  const baked = await pending
  return baked ? baked.clone() : null
}

/** 테스트용 — 캐시를 비운다 */
export function resetEquipmentModelCache(): void {
  cache.clear()
}
