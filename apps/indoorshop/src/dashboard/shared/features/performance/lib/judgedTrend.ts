import type { CollectionEvent } from '../model/types'
import { datesInWindow, type DateWindow } from './baseDate'
import { eventDateOf } from './eventWindow'

/*
 * 조립 **일자별 인식 추이** (W7-2).
 *
 * 조립 카드는 지금 "몇 개 중 몇 개를 인식했나"를 말한다. 그 수치는 옳지만 **언제** 그
 * 인식이 일어났는지는 말하지 않아서, 어제 하루에 몰아 들어온 것과 지난 이레에 고르게
 * 들어온 것이 화면에서 똑같이 보인다. 수집이 멈춘 날을 알아채려면 그 둘이 달라야 한다.
 *
 * 축은 **판별 이벤트**(`asmJudged` — 정반 LiDAR 인식)의 발생일이다. W/O 착수·완료 행은
 * 세지 않는다 — 그건 레거시가 적은 날이지 우리가 수집한 날이 아니다(수집 추이를 묻는
 * 자리에 레거시 등록일을 섞으면 무엇을 보는 그림인지 알 수 없게 된다).
 *
 * 값은 **창의 모든 날**에 대해 낸다. 수집이 0인 날을 건너뛰면 x축이 촘촘한 날과 성긴
 * 날이 같은 간격으로 그려져, 빈 날이 아예 없었던 것처럼 읽힌다 — 빈 날이 곧 신호다.
 */

/** 하루치 — 그날 판별된 ASSY 건수 */
export interface JudgedDayCount {
  date: string
  count: number
}

/** 이 이벤트가 '우리가 수집한 판별' 인가 */
export function isJudgedEvent(event: CollectionEvent): boolean {
  return event.stage === 'ASM' && event.kind === 'asmJudged'
}

/**
 * 창 안의 일자별 판별 건수 — 오래된 날부터, **빈 날도 0 으로 채운다**.
 * 창 밖의 행은 세지 않는다(창을 좁히면 그림도 함께 좁아진다).
 */
export function judgedTrendOf(
  events: readonly CollectionEvent[],
  window: DateWindow
): JudgedDayCount[] {
  const counts = new Map<string, number>()
  for (const date of datesInWindow(window)) counts.set(date, 0)
  for (const event of events) {
    if (!isJudgedEvent(event)) continue
    const date = eventDateOf(event)
    if (date == null || !counts.has(date)) continue
    counts.set(date, (counts.get(date) ?? 0) + 1)
  }
  return [...counts.entries()].map(([date, count]) => ({ date, count }))
}

/** 창 전체의 판별 합계 — 그림 옆에 적는 한 수 */
export function judgedTotalOf(trend: readonly JudgedDayCount[]): number {
  return trend.reduce((sum, day) => sum + day.count, 0)
}
