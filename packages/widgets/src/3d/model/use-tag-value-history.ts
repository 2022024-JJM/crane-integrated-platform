import { useEffect, useState } from 'react';
import {
  getCraneHistory,
  toTagNumber,
  type CraneScope,
} from '@crane/domain/monitoring';
import { useCraneSnapshotStore } from '@crane/features/3d';
import {
  TAG_HISTORY_WINDOW_MS,
  appendSample,
  historySamples,
  type TagSample,
} from '../lib/tag-history';

/** 이력 API 의 표본 간격 — 스냅샷 서버 heartbeat 주기와 같다. */
const HISTORY_STEP = '1s';

const NO_SAMPLES: readonly TagSample[] = [];

interface HistoryState {
  /** 어느 크레인·태그의 표본인지. 다르면 아직 이 대상의 표본이 아니다. */
  key: string | null;
  samples: readonly TagSample[];
  loading: boolean;
}

export interface TagValueHistory {
  samples: readonly TagSample[];
  loading: boolean;
}

const EMPTY: TagValueHistory = { samples: NO_SAMPLES, loading: false };

/**
 * 태그 연결 다이얼로그 미리보기의 최근 60초 표본 — 고른 크레인·태그가 바뀌면
 * 이력 API(`GET /api/{scope}/cranes/{id}/history`, 1초 간격)로 한 번 채우고, 그
 * 뒤는 스냅샷 스토어의 그 범위 칸에 새 스냅샷이 올 때마다 뒤에 붙인다. 이력
 * 조회가 실패하면 라이브 표본만 쌓인다(그래프가 서서히 채워진다). 값 없음
 * (null)은 표본이 없다 — 그래프가 그 구간을 건너뛴다.
 *
 * 대상이 바뀐 직후는 이전 대상의 표본을 보이지 않는다 — 상태에 대상 키를
 * 함께 두고 렌더에서 맞을 때만 쓴다(effect 안의 동기 setState 없이).
 */
export function useTagValueHistory(
  scope: CraneScope | null,
  craneId: string | null,
  code: string | null,
  enabled: boolean,
): TagValueHistory {
  const key =
    enabled && scope && craneId && code
      ? `${scope}\u0000${craneId}\u0000${code}`
      : null;
  const [state, setState] = useState<HistoryState>({
    key: null,
    samples: NO_SAMPLES,
    loading: false,
  });

  useEffect(() => {
    if (!key || !scope || !craneId || !code) return;
    let cancelled = false;
    const now = Date.now();
    void getCraneHistory({
      scope,
      craneId,
      from: new Date(now - TAG_HISTORY_WINDOW_MS).toISOString(),
      to: new Date(now).toISOString(),
      step: HISTORY_STEP,
    })
      .then((frames) => {
        if (cancelled) return;
        const fetched = historySamples(frames, code);
        setState((prev) => {
          // 조회 중 들어온 라이브 표본은 이력 뒤에 이어 붙인다.
          const live = prev.key === key ? prev.samples : NO_SAMPLES;
          let merged = fetched;
          for (const sample of live) merged = appendSample(merged, sample);
          return { key, samples: merged, loading: false };
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState((prev) => ({
          key,
          samples: prev.key === key ? prev.samples : NO_SAMPLES,
          loading: false,
        }));
      });

    const unsubscribe = useCraneSnapshotStore.subscribe((s, prev) => {
      const entry = s.byScope[scope].cranes[craneId];
      if (!entry || entry === prev.byScope[scope].cranes[craneId]) return;
      const tag = entry.snapshot.tags[code];
      const v = tag ? toTagNumber(tag.value) : null;
      if (v === null) return;
      const sample = { t: entry.receivedAt, v };
      setState((p) =>
        p.key === key
          ? {
              key,
              samples: appendSample(p.samples, sample),
              loading: p.loading,
            }
          : { key, samples: appendSample(NO_SAMPLES, sample), loading: true },
      );
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [key, scope, craneId, code]);

  if (!key) return EMPTY;
  if (state.key !== key) return LOADING;
  return { samples: state.samples, loading: state.loading };
}

const LOADING: TagValueHistory = { samples: NO_SAMPLES, loading: true };
