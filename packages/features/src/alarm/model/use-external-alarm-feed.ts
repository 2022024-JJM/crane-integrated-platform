import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import type { AlarmSeverity } from '@crane/domain/alarm';

/*
 * 헤더 알람 벨에 **크레인 밖의 알람**을 실어 보내는 통로.
 *
 * 벨이 원래 보는 것은 `useRealtimeAlarmStore` — 크레인 실시간 알람(WebSocket) 하나다.
 * 그런데 내업(Indoorshop.OT)처럼 자기 도메인의 이상 신호를 이미 판정해 들고 있는 화면이
 * 생기면서, 같은 사람이 같은 화면에서 벨을 두 개 봐야 하는 상태가 됐다. 벨은 하나여야
 * 한다 — "지금 뭔가 잘못됐나"의 답이 두 군데로 갈리면 어느 쪽도 안 보게 된다.
 *
 * 그렇다고 남의 알람을 크레인 알람(`Alarm`)으로 위장시키지는 않는다. 그 타입은
 * `craneId`·`regionId`·`eventType` 을 요구하고, 없는 값을 지어 넣으면 '알람 이력 전체
 * 보기'가 엉뚱한 지역으로 가고 지역별 통계가 오염된다. 대신 **표에 그릴 수 있는 최소한**
 * 만 담은 별도 어휘(`ExternalAlarm`)를 두고, 벨이 두 목록을 합쳐 그린다.
 *
 * 공급자는 화면이 떠 있는 동안만 산다(`useExternalAlarmFeed` 가 언마운트에 지운다) —
 * 내업 화면을 벗어나면 내업 알람도 벨에서 사라지는 것이 맞다. 판정의 근거가 되는
 * 원천 구독도 그 화면과 함께 멎기 때문이다.
 */

export interface ExternalAlarm {
  /** 공급자 안에서 안정적인 식별자 — 다시 계산돼도 같은 사정이면 같은 값이어야 한다 */
  id: string;
  severity: AlarmSeverity;
  /** 아직 살아 있는가 — 벨 배지가 세는 것은 이 값이 true 인 것들뿐이다 */
  active: boolean;
  /** 한 줄 제목 */
  title: string;
  /** 사정을 설명하는 본문 */
  message: string;
  /** 알람을 낸 주체(설비ID·블록·테이블명) — 표의 '설비' 칸에 선다 */
  source: string;
  /** ISO — 원천이 말하는 시각 */
  timestamp: string;
  /** 누르면 갈 곳 (앱 내부 경로). 없으면 줄이 눌리지 않는다 */
  href?: string;
}

interface ExternalAlarmFeedState {
  /** 공급자 id → 그 공급자가 지금 내고 있는 알람 목록 */
  feeds: Record<string, readonly ExternalAlarm[]>;
  publish: (sourceId: string, alarms: readonly ExternalAlarm[]) => void;
  withdraw: (sourceId: string) => void;
}

export const useExternalAlarmFeedStore = create<ExternalAlarmFeedState>(
  (set) => ({
    feeds: {},
    publish: (sourceId, alarms) =>
      set((state) => {
        const previous = state.feeds[sourceId];
        // 같은 내용이면 참조를 유지한다 — 벨은 매 폴링마다 리렌더할 이유가 없다
        if (previous && isSameFeed(previous, alarms)) return state;
        return { feeds: { ...state.feeds, [sourceId]: alarms } };
      }),
    withdraw: (sourceId) =>
      set((state) => {
        if (!(sourceId in state.feeds)) return state;
        const next = { ...state.feeds };
        delete next[sourceId];
        return { feeds: next };
      }),
  }),
);

function isSameFeed(
  left: readonly ExternalAlarm[],
  right: readonly ExternalAlarm[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every((alarm, index) => {
    const other = right[index]!;
    return (
      alarm.id === other.id &&
      alarm.active === other.active &&
      alarm.severity === other.severity &&
      alarm.title === other.title &&
      alarm.message === other.message &&
      alarm.source === other.source &&
      alarm.timestamp === other.timestamp &&
      alarm.href === other.href
    );
  });
}

/**
 * 알람 공급자 — 화면이 떠 있는 동안 자기 알람을 벨에 실어 둔다.
 *
 * `alarms` 는 호출부에서 `useMemo` 로 안정화해 넘긴다(매 렌더 새 배열이면 스토어가
 * 매번 새 참조를 받는다 — 내용 비교로 한 겹 막아 두긴 했지만 비교 비용은 남는다).
 */
export function useExternalAlarmFeed(
  sourceId: string,
  alarms: readonly ExternalAlarm[],
): void {
  const publish = useExternalAlarmFeedStore((state) => state.publish);
  const withdraw = useExternalAlarmFeedStore((state) => state.withdraw);

  useEffect(() => {
    publish(sourceId, alarms);
  }, [publish, sourceId, alarms]);

  useEffect(() => () => withdraw(sourceId), [withdraw, sourceId]);
}

/** 지금 실려 있는 외부 알람 전부 — 최신 순 */
export function useExternalAlarms(): ExternalAlarm[] {
  const feeds = useExternalAlarmFeedStore(useShallow((state) => state.feeds));
  return useMemo(
    () =>
      Object.values(feeds)
        .flat()
        .sort((left, right) => right.timestamp.localeCompare(left.timestamp)),
    [feeds],
  );
}
