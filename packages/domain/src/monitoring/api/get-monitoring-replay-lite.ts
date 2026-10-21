import { RestClientError } from '@crane/core/api';
import { getCraneIdsByRegion } from '../../shared';
import { getDefaultReplayInterval } from '../config/replay-defaults';
import { buildReplayFromCraneHistories } from '../lib/crane-history';
import type {
  CraneHistoryFrames,
  CraneHistoryQuery,
  MonitoringReplayLiteQuery,
  ReplayLiteResponse,
} from '../model/types';
import { getCraneHistory } from './get-crane-history';

/**
 * region 의 리플레이 — 레지스트리의 크레인마다 `GET /api/cranes/{id}/history`
 * 를 같은 from·to·step 으로 받아 한 시간 축으로 합친다
 * (`buildReplayFromCraneHistories`). 서버가 모르는 크레인(404)은 빼고, 그 밖의
 * 실패는 그대로 던진다 — 일부만 빠진 리플레이를 정상처럼 보이지 않게 한다.
 */
export async function getMonitoringReplayLite(
  query: MonitoringReplayLiteQuery,
): Promise<ReplayLiteResponse> {
  const step = getDefaultReplayInterval();
  const histories = await Promise.all(
    getCraneIdsByRegion(query.regionId).map((craneId) =>
      loadCraneHistory({ craneId, from: query.from, to: query.to, step }),
    ),
  );
  return buildReplayFromCraneHistories(
    histories.filter((history): history is CraneHistoryFrames => !!history),
    query,
  );
}

async function loadCraneHistory(
  query: CraneHistoryQuery,
): Promise<CraneHistoryFrames | null> {
  try {
    return await getCraneHistory(query);
  } catch (error) {
    if (error instanceof RestClientError && error.status === 404) return null;
    throw error;
  }
}
