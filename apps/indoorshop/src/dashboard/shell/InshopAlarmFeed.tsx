import { useMemo } from 'react'
import {
  useExternalAlarmFeed,
  type ExternalAlarm,
} from '@crane/features/alarm'
import type { AlarmSeverity as InshopSeverity } from '../shared/entities/alarm/model/types'
import { useRailAlarms } from '../shared/features/alarms/model/useRailAlarms'

/*
 * 내업 통합 알람 레일(W7-1)을 **셸 헤더의 알람 벨**에 실어 보내는 어댑터.
 *
 * 원본에서 이 알람들은 자체 헤더의 종 아이콘(`widgets/alarm-menu`)이 그렸다. 이식본은
 * 그 크롬을 쓰지 않고 셸 `AppHeader` 를 쓰는데, 거기에는 이미 크레인 실시간 알람을
 * 세는 벨이 하나 서 있다. 벨을 하나 더 세우는 대신 **같은 벨에 합친다** — "지금 뭔가
 * 잘못됐나"의 답이 두 군데로 갈리면 어느 쪽도 안 보게 된다.
 *
 * 판정·문구·정렬은 전부 원본 그대로(`useRailAlarms`)이고, 여기서는 표에 그릴 수 있는
 * 최소 어휘(`ExternalAlarm`)로 옮기기만 한다. 화면 컴포넌트가 아니므로 아무것도 그리지
 * 않는다 — 내업 화면이 떠 있는 동안만 벨에 실리고, 벗어나면 훅이 스스로 거둔다
 * (판정의 원천 구독도 그때 함께 멎으므로 남겨 두면 옛 값이 굳는다).
 */

/**
 * 내업 심각도(2단) → 셸 심각도(4단).
 *
 * 레일은 `critical`(지금 손대야 한다) · `warning`(오늘 안에 확인) 둘뿐이다. 셸 배지는
 * critical 이 하나라도 있으면 적색, high 면 주황, 그 밖은 호박색이다 — `warning` 을
 * `high` 로 올리면 "오늘 안에 보면 되는 것"이 크레인 고장과 같은 색으로 서므로
 * `medium`(호박)에 맞춘다. `info` 는 레일이 내지 않지만 타입상 받아 둔다.
 */
const SEVERITY_OF: Record<InshopSeverity, ExternalAlarm['severity']> = {
  critical: 'critical',
  warning: 'medium',
  info: 'info',
}

/** 셸 헤더 벨에서 이 공급자를 가리키는 이름 */
const FEED_ID = 'indoorshop'

export function InshopAlarmFeed() {
  const { alarms } = useRailAlarms()

  const external = useMemo<ExternalAlarm[]>(
    () =>
      alarms.map((alarm) => ({
        /* 레일 id 는 "같은 사정이면 같은 값" 이 보장돼 있다 — 그대로 쓴다 */
        id: `${FEED_ID}:${alarm.id}`,
        severity: SEVERITY_OF[alarm.severity],
        /* 레일 목록에 남아 있다는 것이 곧 "판정이 아직 살아 있다"는 뜻이다 */
        active: true,
        title: alarm.title ?? '',
        message: alarm.message ?? '',
        source: alarm.source,
        timestamp: alarm.occurredAt,
        href: alarm.href,
      })),
    [alarms],
  )

  useExternalAlarmFeed(FEED_ID, external)
  return null
}
