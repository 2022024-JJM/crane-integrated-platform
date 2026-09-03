import { describe, expect, it } from 'vitest'
import {
  applyAffine,
  applyRigid,
  displayToBayLocal,
  fitAffineWgsToMeters,
  fitRigid2D,
  fitWallAxis,
  obbFrame,
  wallToBayLocal,
  type Pt2,
} from '../lib/realScanAnchor'

/** 결정론적 의사난수 — 테스트가 실행마다 다른 점집합을 보지 않게 */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

const rand = rng(20260902)
const SOURCE: Pt2[] = Array.from({ length: 12 }, () => ({
  x: rand() * 80,
  y: rand() * 20,
}))

const transform = (pts: Pt2[], theta: number, tx: number, ty: number, reflect = false, noise = 0) =>
  pts.map((p) => {
    const x = reflect ? -p.x : p.x
    return {
      x: Math.cos(theta) * x - Math.sin(theta) * p.y + tx + (rand() - 0.5) * noise,
      y: Math.sin(theta) * x + Math.cos(theta) * p.y + ty + (rand() - 0.5) * noise,
    }
  })

/**
 * 대응 미상 강체 정합 — 알려진 변환을 **뒤섞인** 대상에서 복원해야 한다.
 * 실전(실측 센서 12대 ↔ 설비 좌표 12대)은 ID↔IP 대응표가 없어 순서가 다르다.
 */
describe('fitRigid2D', () => {
  it('회전+병진을 잔차 수 cm 로 복원한다 (순서 뒤섞임 + 소음 0.1m)', () => {
    const target = transform(SOURCE, (137 * Math.PI) / 180, 172000, 252000, false, 0.1)
    const shuffled = [...target].reverse()
    const fit = fitRigid2D(SOURCE, shuffled)!
    expect(fit.rms).toBeLessThan(0.2)
    expect(fit.reflected).toBe(false)
    /* 복원 검증은 각도 비교가 아니라 **재적용 잔차**로 — 각도는 2π 접힘이 있다 */
    const moved = applyRigid(SOURCE, fit)
    for (let i = 0; i < moved.length; i++) {
      const t = shuffled[fit.pairs[i]]
      expect(Math.hypot(moved[i].x - t.x, moved[i].y - t.y)).toBeLessThan(0.3)
    }
  })

  it('반사(손방향 차이)도 검출한다', () => {
    const target = transform(SOURCE, 0.7, 50, -30, true, 0)
    const fit = fitRigid2D(SOURCE, target)!
    expect(fit.reflected).toBe(true)
    expect(fit.rms).toBeLessThan(0.01)
  })

  it('무관한 점집합은 큰 잔차로 스스로 드러난다 — 임계 폴백의 근거', () => {
    const unrelated: Pt2[] = Array.from({ length: 12 }, () => ({
      x: rand() * 300,
      y: rand() * 300,
    }))
    const fit = fitRigid2D(SOURCE, unrelated)!
    expect(fit.rms).toBeGreaterThan(3)
  })

  it('개수가 다르면 정합하지 않는다', () => {
    expect(fitRigid2D(SOURCE.slice(0, 11), SOURCE)).toBeNull()
  })
})

describe('fitAffineWgsToMeters', () => {
  it('알려진 선형 투영을 복원한다', () => {
    const pairs = SOURCE.map((p) => {
      const lon = 128.7 + p.x * 1e-5
      const lat = 34.87 + p.y * 1e-5
      return { lat, lon, x: 911_000 * (lon - 128.7) + 172_500, y: 1_110_000 * (lat - 34.87) + 252_800 }
    })
    const affine = fitAffineWgsToMeters(pairs)!
    for (const p of pairs) {
      const m = applyAffine(affine, p.lat, p.lon)
      expect(Math.abs(m.x - p.x)).toBeLessThan(1e-3)
      expect(Math.abs(m.y - p.y)).toBeLessThan(1e-3)
    }
  })
})

describe('obbFrame · displayToBayLocal', () => {
  it('회전한 직사각형의 긴 축·도심을 찾고, 합성 변환이 베이 로컬로 떨어진다', () => {
    /* 30×200 사각형을 25° 돌려 둔다 — 긴 축이 그 방향으로 나와야 한다 */
    const theta = (25 * Math.PI) / 180
    const c = Math.cos(theta)
    const s = Math.sin(theta)
    const rect: Pt2[] = [
      { x: -100, y: -15 },
      { x: 100, y: -15 },
      { x: 100, y: 15 },
      { x: -100, y: 15 },
    ].map((p) => ({ x: c * p.x - s * p.y + 500, y: s * p.x + c * p.y + 900 }))
    const frame = obbFrame(rect)!
    expect(Math.hypot(frame.center.x - 500, frame.center.y - 900)).toBeLessThan(1e-6)
    expect(Math.abs(Math.abs(frame.axis.x * c + frame.axis.y * s) - 1)).toBeLessThan(1e-6)

    /* display 원점 → (베이 도심으로 병진하는 강체) → 로컬 원점 근처 */
    const rigid = { theta: 0, reflected: false, tx: 500, ty: 900, rms: 0, pairs: [] }
    const local = displayToBayLocal({ rigid, frame }, 0, 0)
    expect(Math.hypot(local.x, local.y)).toBeLessThan(1e-6)
    /* 긴 축 방향으로 10m 간 점은 로컬 z(길이 성분)로 10 이 되어야 한다 */
    const alongEpsg = { x: 500 + frame.axis.x * 10, y: 900 + frame.axis.y * 10 }
    const along = displayToBayLocal({ rigid, frame }, alongEpsg.x - 500, alongEpsg.y - 900)
    expect(Math.abs(Math.abs(along.y) - 10)).toBeLessThan(1e-6)
  })
})

/**
 * 벽선 앵커 — 합성 홀로 회전·횡방향 복원을 검증한다.
 *
 * 합성 홀은 실측이 가진 함정을 그대로 담는다: 장변 벽 2개 말고도 **더 촘촘하지만 짧은**
 * 내부 구조(갠트리 레일)가 있고, 슬랩 밖(바닥·천장) 점이 섞여 있다. 봉우리 세기로 고르면
 * 레일을 벽으로 잡으므로, `fitWallAxis` 는 **장축 방향 연장**으로 골라야 한다.
 */
describe('fitWallAxis', () => {
  const HALL_ANGLE_DEG = 12
  const HALL_HALF_LENGTH = 60
  const HALL_HALF_WIDTH = 20
  const END_WALL_ALONG = 55

  /** (along, across, height) 를 각도·병진을 태워 display xyz 평탄배열로 굽는다 */
  function buildHall(): Float32Array {
    const noise = rng(4242)
    const theta = (HALL_ANGLE_DEG * Math.PI) / 180
    const c = Math.cos(theta)
    const s = Math.sin(theta)
    const out: number[] = []
    const push = (along: number, across: number, height: number) => {
      const a = along + (noise() - 0.5) * 0.1
      const b = across + (noise() - 0.5) * 0.1
      out.push(a * c - b * s + 300, height, a * s + b * c - 120)
    }
    /* 장변 벽 2개 — 홀 전장에 걸쳐 성기게 */
    for (let i = 0; i < 1500; i++) {
      const along = -HALL_HALF_LENGTH + (i / 1499) * 2 * HALL_HALF_LENGTH
      push(along, -HALL_HALF_WIDTH, 1.5 + noise() * 4)
      push(along, HALL_HALF_WIDTH, 1.5 + noise() * 4)
    }
    /* 갠트리 레일 — 짧지만 벽보다 촘촘하다(연장 기준이 아니면 여기에 걸린다) */
    for (let i = 0; i < 5000; i++) {
      push(-15 + (i / 4999) * 30, -8, 2 + noise() * 3)
    }
    /* 북단 끝벽 — 홀 폭을 가로지르는 선 */
    for (let i = 0; i < 900; i++) {
      push(END_WALL_ALONG, -HALL_HALF_WIDTH + (i / 899) * 2 * HALL_HALF_WIDTH, 1.5 + noise() * 5)
    }
    /* 슬랩 밖 — 바닥과 천장 트러스. 걸러지지 않으면 벽선이 흔들린다 */
    for (let i = 0; i < 4000; i++) {
      push((noise() - 0.5) * 120, (noise() - 0.5) * 40, noise() * 0.5)
      push((noise() - 0.5) * 120, (noise() - 0.5) * 40, 9 + noise())
    }
    return Float32Array.from(out)
  }

  it('짧고 촘촘한 내부 구조가 아니라 **가장 길게 이어지는 평행 두 선**을 벽으로 잡는다', () => {
    const frame = fitWallAxis(buildHall())!
    expect(frame).not.toBeNull()
    expect((frame.angle * 180) / Math.PI).toBeCloseTo(HALL_ANGLE_DEG, 1)
    expect(frame.innerWidth).toBeCloseTo(2 * HALL_HALF_WIDTH, 1)
    /* 두 벽은 평행해야 한다 — 이 값이 게이트의 자기검증 항목이다 */
    expect((frame.angleSpread * 180) / Math.PI).toBeLessThan(0.5)
    /* 레일(across=-8)을 잡았다면 폭이 12m 로 나온다 */
    expect(Math.abs(frame.walls[0].offset - frame.walls[1].offset)).toBeGreaterThan(30)
    for (const wall of frame.walls) expect(wall.residual).toBeLessThan(0.2)
  })

  it('장축 끝의 끝벽을 찾는다 — 종방향 앵커의 근거', () => {
    const frame = fitWallAxis(buildHall())!
    const [, high] = frame.endWalls
    expect(high).not.toBeNull()
    /* 끝벽의 장축 좌표는 프레임 원점(=display 원점 투영)까지 포함하므로 상대 비교로 본다 */
    const zero = wallToBayLocal(
      { angle: frame.angle, lateralOrigin: frame.center, longitudinalOffset: 0 },
      300,
      -120
    )
    expect(high! - zero.y).toBeCloseTo(END_WALL_ALONG, 0)
  })

  it('벽이 한 줄뿐이면(이격 미달) 프레임을 세우지 않는다', () => {
    const noise = rng(77)
    const out: number[] = []
    for (let i = 0; i < 4000; i++) out.push(-60 + (i / 3999) * 120, 2 + noise() * 4, noise() * 0.2)
    expect(fitWallAxis(Float32Array.from(out))).toBeNull()
  })

  it('점이 너무 적으면 null', () => {
    expect(fitWallAxis(new Float32Array([0, 2, 0, 1, 2, 1]))).toBeNull()
  })
})

describe('wallToBayLocal', () => {
  it('장축 방향 이동은 베이 로컬 z, 수직 방향 이동은 베이 로컬 x 로 떨어진다', () => {
    const angle = (37 * Math.PI) / 180
    const anchor = { angle, lateralOrigin: 4, longitudinalOffset: 25 }
    const origin = wallToBayLocal(anchor, 0, 0)
    expect(origin.x).toBeCloseTo(-4, 9)
    expect(origin.y).toBeCloseTo(25, 9)
    /* 장축 +10m */
    const along = wallToBayLocal(anchor, 10 * Math.cos(angle), 10 * Math.sin(angle))
    expect(along.y - origin.y).toBeCloseTo(10, 9)
    expect(along.x - origin.x).toBeCloseTo(0, 9)
    /* 수직 +10m */
    const across = wallToBayLocal(anchor, -10 * Math.sin(angle), 10 * Math.cos(angle))
    expect(across.x - origin.x).toBeCloseTo(10, 9)
    expect(across.y - origin.y).toBeCloseTo(0, 9)
  })
})
