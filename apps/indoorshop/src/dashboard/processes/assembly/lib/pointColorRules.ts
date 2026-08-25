import * as THREE from 'three'
import type { PointColorMode } from './colorModes'

/**
 * 점군 색상 규칙.
 *
 * 색상 전환은 scene 을 다시 만들지 않는다. 점군은 정점 색상(vertexColors)으로 칠하고
 * `color` 속성만 다시 쓴다 — 재샘플링(수십만 점)이 없어 즉시 전환된다.
 */
/** 점 하나가 어디서 나온 것인지 — `객체` 규칙이 쓰는 분류 */
export type PointKind = 'floor' | 'jig' | 'block' | 'unregistered'

/**
 * 객체 규칙 색 — 정반 바닥 / 핀지그 / 정합 블록(detection별 변주) / 미정합 클러스터.
 * 범례가 같은 값을 다시 적지 않도록 여기서 단일 출처로 export 한다.
 */
export const OBJECT_COLORS = {
  floor: '#3f4a56',
  jig: '#7c8b9a',
  unregistered: '#dc2626',
} as const

const OBJECT_FLOOR = new THREE.Color(OBJECT_COLORS.floor)
const OBJECT_JIG = new THREE.Color(OBJECT_COLORS.jig)
const OBJECT_UNREGISTERED = new THREE.Color(OBJECT_COLORS.unregistered)
/** 정합 블록은 detection 마다 색상(hue)을 돌려 서로 구분한다 (실측 뷰어도 같은 팔레트) */
export const OBJECT_BLOCK_HUES = [0.52, 0.09, 0.33, 0.75, 0.86, 0.16, 0.62, 0.02]

/** detection index → 객체 규칙 블록색 — 목업·실측 뷰어가 같은 색을 내도록 단일 출처 */
export function objectBlockColor(detectionIndex: number): THREE.Color {
  const hue = OBJECT_BLOCK_HUES[detectionIndex % OBJECT_BLOCK_HUES.length]
  return new THREE.Color().setHSL(hue, 0.62, 0.58)
}

/**
 * 블록 세그멘테이션 팔레트 — 데이터 제공사 참조 뷰어(js-sample-1)의 SEG_PALETTE 를 따른다.
 *
 * 위 `OBJECT_BLOCK_HUES` 는 8색이라 공장 뷰(블록 13종)에서 9번째부터 색이 되풀이된다 —
 * 화면에 같은 색 블록이 둘 나오면 "색 = 블록" 이라는 약속 자체가 깨진다. 그래서 세그멘테이션
 * 전용으로 13색을 따로 둔다 (블록 수와 같다).
 *
 * 참조 팔레트에서 딱 하나 바꿨다: 13번째 `0xa9a9a9`(회색)은 우리 화면에서 **미정합 점의
 * 회색과 구분이 안 된다** (참조 뷰어는 배경이 검어서 문제가 없었다). 색상환에서 비어 있던
 * 청록-남색 사이를 대신 넣는다.
 */
export const SEGMENT_COLORS = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4',
  '#469990', '#9a6324', '#1f6fb2',
] as const

const SEGMENT_THREE_COLORS = SEGMENT_COLORS.map((hex) => new THREE.Color(hex))

/** 블록 인덱스(= 점 라벨 값) → 세그멘테이션 색 */
export function segmentBlockColor(blockIndex: number): THREE.Color {
  return SEGMENT_THREE_COLORS[blockIndex % SEGMENT_THREE_COLORS.length]
}

/** 블록 인덱스 → CSS hex — 범례·라벨이 같은 색을 쓰도록 */
export function segmentBlockHex(blockIndex: number): string {
  return SEGMENT_COLORS[blockIndex % SEGMENT_COLORS.length]
}

/**
 * 고도(elevation) 램프 — 낮으면 파랑, 높으면 빨강.
 *
 * 등고선·지형도에서 쓰는 관습을 따른다. "위로 갈수록 뜨거워진다"가 이미 몸에
 * 익은 규칙이라, 지각적으로 더 고른 램프(viridis)보다 현장에서 빨리 읽힌다.
 * 다만 무지개 계열은 색각 이상에서 순서가 무너질 수 있으므로, 높이는 색으로만
 * 나르지 않고 범례(낮음 → 높음)를 항상 함께 낸다.
 */
export const ELEVATION_STOPS = ['#2563eb', '#22d3ee', '#22c55e', '#facc15', '#ef4444'] as const

const ELEVATION = ELEVATION_STOPS.map((hex) => new THREE.Color(hex))

function elevation(t: number, out: THREE.Color): THREE.Color {
  const x = Math.min(1, Math.max(0, t)) * (ELEVATION.length - 1)
  const i = Math.min(ELEVATION.length - 2, Math.floor(x))
  return out.copy(ELEVATION[i]).lerp(ELEVATION[i + 1], x - i)
}

/** 색칠 대상 점군 하나 — 씬 빌드 때 만들어 두고 규칙 전환 시 재사용한다 */
export interface ColorableCloud {
  points: THREE.Points
  kind: PointKind
  /** 이 점들을 만든 센서 index */
  sensorIndex: number
  /** 소속 detection index (block/unregistered 일 때만 의미 있음) */
  detectionIndex: number
  /**
   * 점별 의사 반사강도(0..1) — 입사각 × 거리 감쇠.
   * 어떤 규칙이든 이 값을 곱해 명암을 준다. 명암이 없으면 곡면·모서리가
   * 평평해져 형상이 안 읽힌다.
   */
  intensity: Float32Array
}

export interface ColorContext {
  /** 센서 index → 색 (문자열 hex) */
  sensorColors: string[]
  /** 높이 규칙 정규화 범위 */
  minY: number
  maxY: number
}

const SENSOR_FALLBACK = '#94a3b8'

/**
 * 규칙에 따라 각 점군의 `color` 속성을 다시 쓴다.
 * geometry 는 그대로 두므로 점 수에 비례하는 색 재계산만 일어난다.
 */
export function applyPointColors(
  clouds: ColorableCloud[],
  mode: PointColorMode,
  ctx: ColorContext
): void {
  const base = new THREE.Color()
  const span = Math.max(1e-3, ctx.maxY - ctx.minY)

  for (const cloud of clouds) {
    const geometry = cloud.points.geometry
    const position = geometry.getAttribute('position')
    if (!position) continue

    const count = position.count
    let attr = geometry.getAttribute('color') as THREE.BufferAttribute | undefined
    if (!attr || attr.count !== count) {
      attr = new THREE.BufferAttribute(new Float32Array(count * 3), 3)
      geometry.setAttribute('color', attr)
    }
    const colors = attr.array as Float32Array

    // 규칙별 고정색은 루프 밖에서 한 번만 정한다
    let flat: THREE.Color | null = null
    if (mode === 'sensor') {
      flat = new THREE.Color(ctx.sensorColors[cloud.sensorIndex] ?? SENSOR_FALLBACK)
    } else if (mode === 'object') {
      if (cloud.kind === 'floor') flat = OBJECT_FLOOR
      else if (cloud.kind === 'jig') flat = OBJECT_JIG
      else if (cloud.kind === 'unregistered') flat = OBJECT_UNREGISTERED
      else flat = objectBlockColor(cloud.detectionIndex)
    } else if (mode === 'plain' || mode === 'progress') {
      // CAD 계열 규칙에서는 점군이 배경 역할만 한다 (겹쳐보기에서 도면과 대비되도록 중성색)
      flat = new THREE.Color(0x8b95a1)
    }

    for (let i = 0; i < count; i++) {
      if (mode === 'height') {
        elevation((position.getY(i) - ctx.minY) / span, base)
      } else if (flat) {
        base.copy(flat)
      }
      // 의사 반사강도로 명암을 준다 — 완전히 검게 죽지 않도록 하한을 둔다
      const shade = 0.45 + 0.55 * (cloud.intensity[i] ?? 1)
      colors[i * 3] = base.r * shade
      colors[i * 3 + 1] = base.g * shade
      colors[i * 3 + 2] = base.b * shade
    }
    attr.needsUpdate = true
  }
}
