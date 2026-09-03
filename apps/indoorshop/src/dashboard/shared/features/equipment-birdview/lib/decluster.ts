/*
 * 겹친 설비 떼어 놓기.
 *
 * 실좌표대로 찍으면 라이다가 몇 대씩 한 자리에 몰린 구역에서 점이 서로를 덮는다. 덮인
 * 점은 **없는 점**이다 — 이상이 하나 숨어 있어도 화면은 정상 하나를 보여 준다.
 *
 * 그래서 최소 간격만큼만 밀어낸다. 두 가지를 지킨다:
 *  · **결정적이다.** id 순으로 훑고 겹친 좌표에는 순번에서 얻은 각도를 쓴다 — 폴링마다
 *    점이 자리를 바꾸면 그림이 살아 있는 게 아니라 떨리는 것이다.
 *  · **조금만 민다.** 원래 자리에서 `maxShift` 를 넘지 않는다. 많이 밀면 겹침은 풀리지만
 *    "저 베이 안쪽에 있다"는 이 그림의 유일한 값이 사라진다. 못 푼 겹침은 남겨 둔다.
 */

export interface DeclusterInput {
  id: string
  x: number
  y: number
}

export interface DeclusterOptions {
  /** 이만큼은 떨어져 있어야 한다 (뷰박스 단위) */
  minGap: number
  /** 원래 자리에서 최대 이만큼까지만 밀린다 */
  maxShift: number
  /** 완화 반복 횟수 — 늘려도 maxShift 가 결과를 묶는다 */
  iterations?: number
}

/** 겹침을 푼 좌표 — 입력과 같은 순서 */
export function declusterPoints(
  points: readonly DeclusterInput[],
  options: DeclusterOptions
): DeclusterInput[] {
  const { minGap, maxShift, iterations = 10 } = options
  if (points.length < 2 || minGap <= 0) return [...points]

  /* id 순 고정 — 입력 순서가 흔들려도 결과가 같아야 한다 */
  const order = [...points].sort((a, b) => a.id.localeCompare(b.id))
  const moved = order.map((point) => ({ ...point }))

  for (let round = 0; round < iterations; round += 1) {
    let touched = false
    for (let i = 0; i < moved.length; i += 1) {
      for (let j = i + 1; j < moved.length; j += 1) {
        const a = moved[i]
        const b = moved[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        let distance = Math.hypot(dx, dy)
        if (distance >= minGap) continue
        if (distance < 1e-6) {
          /* 완전히 같은 자리 — 순번에서 각도를 얻는다(난수를 쓰면 매번 달라진다) */
          const angle = (j * 2.39996) % (Math.PI * 2)
          dx = Math.cos(angle)
          dy = Math.sin(angle)
          distance = 1
        }
        const push = (minGap - distance) / 2
        const ux = (dx / distance) * push
        const uy = (dy / distance) * push
        a.x -= ux
        a.y -= uy
        b.x += ux
        b.y += uy
        touched = true
      }
    }
    if (!touched) break
  }

  /* 원래 자리에서 너무 멀어진 것은 되돌린다 — 겹침보다 거짓 위치가 나쁘다 */
  const byId = new Map(order.map((point, index) => [point.id, moved[index]]))
  return points.map((origin) => {
    const shifted = byId.get(origin.id)
    if (!shifted) return { ...origin }
    const dx = shifted.x - origin.x
    const dy = shifted.y - origin.y
    const distance = Math.hypot(dx, dy)
    if (distance <= maxShift) return { id: origin.id, x: shifted.x, y: shifted.y }
    const ratio = maxShift / distance
    return { id: origin.id, x: origin.x + dx * ratio, y: origin.y + dy * ratio }
  })
}
