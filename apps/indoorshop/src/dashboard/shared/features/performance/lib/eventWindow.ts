import type { CollectionEvent } from '../model/types'
import type { DateWindow } from './baseDate'

/*
 * 이벤트 그리드의 **조회 창** — 기준일 시간축이 그리드에 닿는 자리 (W7-2).
 *
 * 지금까지 그리드는 '오늘' 고정이었다. 기준일을 옮길 수 있게 되면 지켜야 할 것이 하나
 * 생긴다 — **기준일 이후에 일어난 일은 보이면 안 된다.** 과거 어느 날의 화면을 다시
 * 세우는 것이 기준일 조회이고, 그날 아직 오지 않은 실적이 섞이면 그건 그날의 화면이
 * 아니라 오늘의 화면에 과거 날짜만 적어 둔 것이다.
 *
 * 규칙 셋 (여기 한 곳에서만 정한다):
 *  · 발생이 **창의 끝(기준일)보다 뒤**인 행 — 그날엔 아직 일어나지 않았다. 지운다.
 *  · 발생이 **창의 시작보다 앞**인 행 — 창 밖이다. 지운다.
 *  · 발생은 창 안인데 **완료가 창 뒤**인 행 — 그날엔 아직 진행 중이었다. 완료를 지우고
 *    상태를 `inProgress` 로 되돌린다. 행 자체를 지우지 않는 이유는, 그날 그 행은
 *    **실제로 있었기** 때문이다(착수했고 아직 안 끝난 상태로).
 *
 * ⚠️ **날짜가 없는 행(미도래)은 창이 거르지 않는다.** 그런 행은 "아직 오지 않았다"는
 *    말 자체라, 어느 기준일에서 보든 참이다. 창이 자르는 것은 일어난 일의 시점뿐이다.
 */

/** 창에 비춘 이벤트 한 행 — 창 밖이면 null */
export function clampEventToWindow(
  event: CollectionEvent,
  window: DateWindow
): CollectionEvent | null {
  const occurred = event.occurred
  if (occurred) {
    if (occurred.date > window.to) return null
    if (occurred.date < window.from) return null
  }
  const completed = event.completed
  if (completed && completed.date > window.to) {
    /* 그날엔 아직 끝나지 않았다 — 완료를 지우고 진행 중으로 되돌린다 */
    return { ...event, completed: null, status: event.status === 'done' ? 'inProgress' : event.status }
  }
  return event
}

/** 창에 비춘 이벤트 목록 — 순서는 그대로 두고 걸러 내기만 한다 */
export function clampEventsToWindow(
  events: readonly CollectionEvent[],
  window: DateWindow
): CollectionEvent[] {
  const out: CollectionEvent[] = []
  for (const event of events) {
    const clamped = clampEventToWindow(event, window)
    if (clamped) out.push(clamped)
  }
  return out
}

/** 이 행이 일어난 날 — 발생일이 정본이고, 없으면 완료일. 둘 다 없으면 null(미도래) */
export function eventDateOf(event: CollectionEvent): string | null {
  return event.occurred?.date ?? event.completed?.date ?? null
}
