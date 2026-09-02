import { describe, expect, it } from 'vitest'
import {
  applyAffine,
  applyRigid,
  displayToBayLocal,
  fitAffineWgsToMeters,
  fitRigid2D,
  obbFrame,
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
