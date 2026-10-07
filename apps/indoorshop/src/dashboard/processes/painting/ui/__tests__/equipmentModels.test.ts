import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { bakeEquipmentModel, equipmentModelUrlOf } from '../equipmentModels'
import {
  DEHUMIDIFIER_MODEL,
  EQUIPMENT_SYMBOL_SCALE,
  GAS_HEATER_MODEL,
  dehumidifierGeometry,
  dehumidifierIndicatorGeometry,
  emitPointOf,
  heaterGeometry,
  heaterIndicatorGeometry,
} from '../equipmentShapes'

/**
 * 설비 glTF 모델을 인스턴싱용 지오메트리로 굽는 규약 (R46).
 *
 * 파일은 읽지 않는다 — 굽는 함수는 순수하므로 손으로 만든 메시 트리로 본다. 보는 것은
 * 뷰어 성능 계약이 요구하는 형태다: 지오메트리 하나, 정점 색으로 적힌 재질 색, 반투명
 * 부품 제외, 부품 변환 적용, 형상 로컬 배율.
 */
function mesh(color: number, over: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color, ...over }))
}

describe('bakeEquipmentModel', () => {
  it('부품들을 지오메트리 하나로 합치고 재질 색을 정점 색으로 적는다', () => {
    const root = new THREE.Group()
    const red = mesh(0xff0000)
    const blue = mesh(0x0000ff)
    root.add(red, blue)

    const baked = bakeEquipmentModel(root, 1)
    expect(baked).not.toBeNull()
    const position = baked!.getAttribute('position')
    expect(position.count).toBe(24 * 2)
    const color = baked!.getAttribute('color')
    expect(color).toBeDefined()
    /* 앞 24 정점은 빨강, 뒤 24 정점은 파랑 — three 의 Color 는 선형이라 1/0 그대로다 */
    expect([color.getX(0), color.getY(0), color.getZ(0)]).toEqual([1, 0, 0])
    expect([color.getX(24), color.getY(24), color.getZ(24)]).toEqual([0, 0, 1])
    /* 뷰어 재질은 uv 를 쓰지 않는다 — 합치기 위해 속성 집합을 셋으로 줄인다 */
    expect(Object.keys(baked!.attributes).sort()).toEqual(['color', 'normal', 'position'])
  })

  it('반투명 부품(더운 공기 껍질)은 버린다 — 기류는 기류장이 그린다', () => {
    const root = new THREE.Group()
    root.add(mesh(0xffffff))
    root.add(mesh(0xffaa00, { transparent: true, opacity: 0.5 }))
    const baked = bakeEquipmentModel(root, 1)
    expect(baked!.getAttribute('position').count).toBe(24)
  })

  it('부품의 (중첩) 변환을 정점에 적용하고 형상 로컬 배율을 곱한다', () => {
    const root = new THREE.Group()
    const arm = new THREE.Group()
    arm.position.set(0, 2, 0)
    const part = mesh(0xffffff)
    part.position.set(1, 0, 0)
    arm.add(part)
    root.add(arm)

    const baked = bakeEquipmentModel(root, 2)
    baked!.computeBoundingBox()
    const center = baked!.boundingBox!.getCenter(new THREE.Vector3())
    expect(center.x).toBeCloseTo(2)
    expect(center.y).toBeCloseTo(4)
    expect(center.z).toBeCloseTo(0)
  })

  it('이미 정점 색이 있는 부품은 재질 색과 곱한다', () => {
    const root = new THREE.Group()
    const part = mesh(0x00ff00, { vertexColors: true })
    const count = part.geometry.getAttribute('position').count
    part.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(0.5), 3))
    root.add(part)
    const color = bakeEquipmentModel(root, 1)!.getAttribute('color')
    expect([color.getX(0), color.getY(0), color.getZ(0)]).toEqual([0, 0.5, 0])
  })

  it('쓸 부품이 없으면 null — 호출자는 저폴리 실루엣을 그대로 둔다', () => {
    const root = new THREE.Group()
    root.add(mesh(0xffffff, { transparent: true, opacity: 0.2 }))
    expect(bakeEquipmentModel(root, 1)).toBeNull()
  })
})

describe('가스히터 모델 규약', () => {
  it('두 종류 모두 모델 파일이 있다', () => {
    expect(equipmentModelUrlOf('가스히터')).toBe(GAS_HEATER_MODEL.url)
    expect(equipmentModelUrlOf('제습기')).toBe(DEHUMIDIFIER_MODEL.url)
  })

  it('배율은 모델 높이(1.35m)를 로컬 2.4 로 세운다', () => {
    expect(1.353 * GAS_HEATER_MODEL.scale).toBeCloseTo(2.4, 1)
  })

  it('토출점은 모델 상판 그릴 위에 있다 — 기류 리본이 모델을 기다리지 않고 같은 자리에서 난다', () => {
    const emit = emitPointOf('가스히터')
    const k = GAS_HEATER_MODEL.scale
    expect(emit.x).toBeCloseTo(GAS_HEATER_MODEL.outlet.x * k)
    expect(emit.z).toBeCloseTo(GAS_HEATER_MODEL.outlet.z * k)
    expect(emit.y).toBeGreaterThan(GAS_HEATER_MODEL.outlet.y * k)
  })

  it('자리표시자 실루엣은 모델과 같은 자리(바닥 y=0, 정면 +z)에 비슷한 부피로 선다', () => {
    const geometry = heaterGeometry()
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    const k = GAS_HEATER_MODEL.scale
    expect(box.min.y).toBeCloseTo(0, 1)
    expect(box.max.y).toBeLessThanOrEqual(1.353 * k + 0.05)
    expect(box.max.y).toBeGreaterThan(1.0 * k)
    expect(box.max.x).toBeLessThan(1.0 * k)
    expect(box.max.z).toBeLessThan(0.6 * k)
    /* 상판 토출구가 토출점 바로 아래 있다 */
    expect(emitPointOf('가스히터').y).toBeGreaterThan(box.max.y - 0.2)
  })

  it('표시등은 정면 LED 자리와 상판 토출구 위에 선다 — 실루엣 배율과 같은 좌표계', () => {
    const geometry = heaterIndicatorGeometry()
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    const k = GAS_HEATER_MODEL.scale
    expect(box.max.y).toBeCloseTo((GAS_HEATER_MODEL.outlet.y + 0.012) * k, 1)
    expect(box.max.z).toBeGreaterThan(GAS_HEATER_MODEL.lamp.z * k)
    expect(EQUIPMENT_SYMBOL_SCALE).toBeGreaterThan(1)
  })
})

describe('제습기 모델 규약', () => {
  it('실치수 그대로(배율 1) — 히터 옆에서 큰 기계로 읽힌다', () => {
    expect(DEHUMIDIFIER_MODEL.scale).toBe(1)
    expect(DEHUMIDIFIER_MODEL.intake.x).toBeLessThan(0)
    expect(DEHUMIDIFIER_MODEL.supply.x).toBeGreaterThan(0)
  })

  it('토출점(흡입점)은 흡입 벨마우스의 조금 바깥(-x)이다', () => {
    const emit = emitPointOf('제습기')
    const k = DEHUMIDIFIER_MODEL.scale
    expect(emit.x).toBeLessThan(DEHUMIDIFIER_MODEL.intake.x * k)
    expect(emit.y).toBeCloseTo(DEHUMIDIFIER_MODEL.intake.y * k)
    expect(emit.z).toBeCloseTo(DEHUMIDIFIER_MODEL.intake.z * k)
  })

  it('자리표시자 실루엣은 모델과 같은 자리(바닥 y=0, 양옆 덕트, 지붕 스택)에 선다', () => {
    const geometry = dehumidifierGeometry()
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    const k = DEHUMIDIFIER_MODEL.scale
    expect(box.min.y).toBeCloseTo(0, 1)
    /* 모델 불투명 부품의 상자: x -1.585~1.711, y ~2.27, z ±0.76 */
    expect(box.min.x).toBeCloseTo(DEHUMIDIFIER_MODEL.intake.x * k, 0)
    expect(box.max.x).toBeCloseTo(DEHUMIDIFIER_MODEL.supply.x * k, 0)
    expect(box.max.y).toBeLessThanOrEqual(2.3 * k)
    expect(box.max.y).toBeGreaterThan(2.0 * k)
    expect(Math.abs(box.max.z)).toBeLessThan(0.8 * k)
    /* 흡입 덕트 끝이 토출점 바로 옆이다 */
    expect(emitPointOf('제습기').x).toBeLessThan(box.min.x + 0.2)
  })

  it('표시등은 정면 램프 자리와 흡입·급기 덕트 끝에 선다', () => {
    const geometry = dehumidifierIndicatorGeometry()
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    const k = DEHUMIDIFIER_MODEL.scale
    expect(box.min.x).toBeLessThan(DEHUMIDIFIER_MODEL.intake.x * k)
    expect(box.max.x).toBeGreaterThan(DEHUMIDIFIER_MODEL.supply.x * k)
    expect(box.max.z).toBeGreaterThan(DEHUMIDIFIER_MODEL.lamp.z * k)
  })
})
