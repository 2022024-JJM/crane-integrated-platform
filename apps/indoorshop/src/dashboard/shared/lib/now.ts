/*
 * ── 시계 seam — 앱이 '지금'을 얻는 **유일한** 자리 ──
 *
 * 화면 코드가 `new Date()` 를 직접 부르면 두 가지가 동시에 깨진다.
 *
 *  1. **기준일 되감기가 반쪽이 된다.** 통합실적은 `?date=` 로 과거를 말하는데 그 옆
 *     화면은 제 시계를 읽어 오늘을 말한다 — 한 앱이 두 날짜를 동시에 주장한다.
 *  2. **테스트가 실행 시각에 묶인다.** 자정 언저리에만 깨지는 검사, 며칠 뒤 갑자기
 *     빨개지는 스냅샷이 여기서 나온다.
 *
 * 그래서 시계는 여기 한 곳에서만 읽고, 나머지는 전부 이 함수를 부른다. 계약 테스트
 * (`src/__tests__/noDirectClock.test.ts`)가 그 규칙을 지킨다 — 이 파일이 유일한 예외다.
 *
 * ⚠️ 실연동에서 '지금'이 서버 시각이어야 한다면 바꾸는 곳도 여기 하나다.
 */

/** epoch ms 를 내는 원천. 기본은 기계 시계 — 이 한 줄이 앱 전체의 유일한 직접 호출이다 */
type NowSource = () => number

let source: NowSource = () => Date.now()

/** 지금 (epoch ms) */
export function nowMs(): number {
  return source()
}

/** 지금 (Date) — 값 타입이 필요한 자리(달력·서식)를 위한 얇은 포장 */
export function nowDate(): Date {
  return new Date(source())
}

/**
 * 시계를 갈아 끼운다 — **테스트·스토리 전용**.
 *
 * 숫자를 주면 그 시각에 멈춘 시계가 되고, 함수를 주면 그 함수가 원천이 된다.
 * `null` 로 되돌린다. 되돌리지 않으면 다음 테스트가 남의 시계를 물려받으므로,
 * 부르는 쪽은 `afterEach` 에서 반드시 풀어 준다.
 */
export function setNowSource(next: NowSource | number | null): void {
  if (next === null) {
    source = () => Date.now()
    return
  }
  source = typeof next === 'number' ? () => next : next
}
