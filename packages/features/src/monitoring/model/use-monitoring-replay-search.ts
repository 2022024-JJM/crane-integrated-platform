import { useCallback, useMemo, useState } from 'react';

import {
  REPLAY_DURATION_KEYS,
  buildDefaultReplayFormValues,
  buildDefaultReplayStart,
  resolveReplayRange,
  toDateTimeLocalValue,
  validateReplayStart,
  type ReplayDuration,
} from '@crane/domain/monitoring';

const EMPTY_RANGE = { from: '', to: '' };

interface SubmittedSearch {
  start: string;
  /** 확정한 순간의 서버 from/to. 종료는 그때의 지금으로 잘려 있다. */
  range: { from: string; to: string };
}

function submitOf(start: string, duration: ReplayDuration): SubmittedSearch {
  return { start, range: resolveReplayRange(start, duration) ?? EMPTY_RANGE };
}

/**
 * 리플레이 구간 검색 상태 — 시작 시각(datetime-local) + 길이(10분·30분·1시간).
 * 종료는 시작 + 길이를 지금으로 자른 값이다(`resolveReplayRange`).
 *
 * `query` 는 불러오기를 누른 순간 계산해 굳힌 구간이다. 렌더마다 다시 계산하면
 * 시계가 흐르며 종료가 바뀌어 조회 키가 매번 달라진다. 같은 시작·길이로 다시
 * 누르면 그 사이 늘어난 종료로 다시 받는다.
 */
export function useMonitoringReplaySearch(regionId: string) {
  const defaults = useMemo(
    () => buildDefaultReplayFormValues(regionId),
    [regionId],
  );
  const [draftStart, setDraftStart] = useState(defaults.start);
  const [duration, setDuration] = useState<ReplayDuration>(defaults.duration);
  const [submitted, setSubmitted] = useState<SubmittedSearch>(() =>
    submitOf(defaults.start, defaults.duration),
  );

  const validation = useMemo(
    () => validateReplayStart(draftStart),
    [draftStart],
  );
  const canSearch = validation.isValid;

  const draftEnd = useMemo(() => {
    const range = resolveReplayRange(draftStart, duration);
    return range ? toDateTimeLocalValue(range.to) : '';
  }, [draftStart, duration]);

  const query = submitted.range;
  const viewingTo = useMemo(
    () => (query.to ? toDateTimeLocalValue(query.to) : ''),
    [query.to],
  );

  const submitSearch = useCallback(() => {
    // 누르는 순간의 시계로 다시 본다 — 화면의 검증은 입력이 바뀔 때만 갱신된다.
    if (!validateReplayStart(draftStart).isValid) {
      return;
    }
    setSubmitted(submitOf(draftStart, duration));
  }, [draftStart, duration]);

  // 시작 입력만 기본값(직전 정각의 한 시간 전)으로 되돌린다 — 누르는 순간의
  // 시계로 다시 계산하므로 정각이 지났으면 새 기본값이다. 길이·확정 구간은 그대로.
  const resetDraftStart = useCallback(() => {
    setDraftStart(toDateTimeLocalValue(buildDefaultReplayStart()));
  }, []);

  return {
    draftStart,
    setDraftStart,
    resetDraftStart,
    draftEnd,
    duration,
    setDuration,
    durations: REPLAY_DURATION_KEYS,
    submitSearch,
    canSearch,
    validationReason: validation.reason,
    viewingFrom: submitted.start,
    viewingTo,
    query,
  };
}
