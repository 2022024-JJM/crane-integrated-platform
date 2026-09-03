/*
 * 실시간 갱신 아래에서 **행이 도망가지 않게** 하는 두 장치 (순수부).
 *
 * 상태순으로 정렬한 목록은 폴링 틱마다 순서가 바뀐다. 사람은 그 사이에 마우스를 옮기고
 * 있으므로, 누르려던 줄이 손 밑에서 빠져나가고 엉뚱한 줄이 눌린다 — 잘못 누른 사람이
 * 자기 실수로 느끼지만 화면이 표적을 움직인 것이다.
 *
 * 두 가지로 막는다:
 *  1. **동률의 자리 고정**(`byThenKey`) — 같은 상태끼리는 언제나 같은 순서. 정렬 함수가
 *     동률을 남겨 두면 그 구간의 순서는 입력 배열 순서에 딸려 흔들린다.
 *  2. **상호작용 중 순서 동결**(`freezeOrder`) — 손이 목록 위에 있는 동안에는 마지막
 *     순서를 그대로 쓴다. 값은 계속 갱신되고 자리만 멈춘다 — 읽고 있는 숫자가 낡지는
 *     않으면서 표적은 가만히 있다.
 */

/** 비교 함수에 **키 동률 해소**를 얹는다 — 같은 상태끼리의 순서가 틱마다 흔들리지 않게 */
export function byThenKey<T>(
  compare: (a: T, b: T) => number,
  keyOf: (item: T) => string
): (a: T, b: T) => number {
  return (a, b) => compare(a, b) || keyOf(a).localeCompare(keyOf(b), undefined, { numeric: true })
}

/**
 * 이전 순서를 유지한 채 목록을 갱신한다 — **자리는 그대로, 값만 새로**.
 *
 * 사라진 항목은 빠지고, 새로 온 항목은 (이전 순서에 자리가 없으므로) `next` 가 준
 * 순서 그대로 뒤에 붙는다. 새 항목을 위로 끼워 넣으면 그것 역시 표적을 미는 일이다.
 */
export function freezeOrder<T>(
  previousKeys: readonly string[],
  next: readonly T[],
  keyOf: (item: T) => string
): T[] {
  const byKey = new Map(next.map((item) => [keyOf(item), item]))
  const kept: T[] = []
  for (const key of previousKeys) {
    const item = byKey.get(key)
    if (item === undefined) continue
    kept.push(item)
    byKey.delete(key)
  }
  /* 남은 것 = 새로 온 항목. `next` 의 순서를 지켜 뒤에 붙인다 */
  for (const item of next) {
    if (byKey.has(keyOf(item))) kept.push(item)
  }
  return kept
}
