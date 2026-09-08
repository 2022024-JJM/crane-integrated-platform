import { describe, expect, it } from 'vitest'
import { gaugeY, needleEnd } from '../AimDial'

/*
 * 조준 다이얼의 **기하** — 그림이 실제로 그 방향을 가리키는가.
 *
 * 다이얼을 둔 이유는 하나다: `pan -80° / tilt -9°` 같은 부호 붙은 숫자 쌍은 정확하지만
 * 337칸을 훑는 눈이 매번 좌표로 되옮기지 않는다. 그래서 **평면 투영**을 그린다 —
 * 그림이 투영이 아니라 장식이면 두 대의 자세를 견주는 데 쓸 수 없으므로, 여기서 못 박는다.
 */

const CENTER = 10

describe('조준 다이얼 — 바늘은 방위를 가리킨다', () => {
  it('pan 0° 는 위, 90° 는 오른쪽, 180° 는 아래, -90° 는 왼쪽', () => {
    expect(needleEnd(0, 0).y).toBeLessThan(CENTER)
    expect(needleEnd(0, 0).x).toBeCloseTo(CENTER, 5)

    expect(needleEnd(90, 0).x).toBeGreaterThan(CENTER)
    expect(needleEnd(90, 0).y).toBeCloseTo(CENTER, 5)

    expect(needleEnd(180, 0).y).toBeGreaterThan(CENTER)
    expect(needleEnd(-90, 0).x).toBeLessThan(CENTER)
  })

  /*
   * 길이는 cos(tilt) 다 — 위에서 내려다본 조준 벡터의 그림자다. 아래를 깊게 볼수록
   * 짧아진다는 사실 자체가, 두 대의 자세를 나란히 놓았을 때 읽히는 값이다.
   */
  it('고도가 깊을수록 바늘이 짧다 (평면 투영이라서)', () => {
    const flat = lengthOf(needleEnd(0, 0))
    const steep = lengthOf(needleEnd(0, -60))
    const straightDown = lengthOf(needleEnd(0, -90))
    expect(steep).toBeLessThan(flat)
    expect(straightDown).toBeLessThan(steep)
  })

  it('바늘은 아무리 깊어도 사라지지 않는다 — 자세를 못 읽는 그림을 만들지 않는다', () => {
    expect(lengthOf(needleEnd(0, -90))).toBeGreaterThan(2)
  })

  it('범위를 벗어난 고도는 잘라 낸다 (±90°)', () => {
    expect(needleEnd(0, -120)).toEqual(needleEnd(0, -90))
    expect(needleEnd(0, 130)).toEqual(needleEnd(0, 90))
  })
})

describe('조준 다이얼 — 고도 눈금', () => {
  /* 길이만으로는 위/아래가 갈리지 않는다(cos 은 짝함수) — 그래서 한 채널을 더 둔다 */
  it('위를 보면 위쪽, 아래를 보면 아래쪽, 수평이면 가운데', () => {
    expect(gaugeY(90)).toBeLessThan(gaugeY(0))
    expect(gaugeY(0)).toBeLessThan(gaugeY(-90))
    expect(gaugeY(0)).toBeCloseTo(CENTER, 5)
  })

  it('부호가 반대인 같은 크기의 고도는 길이가 같아도 눈금이 다르다', () => {
    expect(lengthOf(needleEnd(0, 30))).toBeCloseTo(lengthOf(needleEnd(0, -30)), 5)
    expect(gaugeY(30)).not.toBeCloseTo(gaugeY(-30), 5)
  })
})

function lengthOf(point: { x: number; y: number }): number {
  return Math.hypot(point.x - CENTER, point.y - CENTER)
}
