import { restClient } from '@crane/core/api';
import { getApiPath } from '@crane/core/config/network';
import { sanitizeCraneHistoryFrames } from '../lib/crane-history';
import type { CraneHistoryFrames, CraneHistoryQuery } from '../model/types';

/**
 * `GET /api/{scope}/cranes/{craneId}/history?from&to&step` — from 이전 마지막 행을
 * baseline 으로 깔고 step 간격으로 sample-and-hold 한 프레임. 모르는 크레인은
 * 404, 범위·step·프레임 수 상한 위반은 400(`RestClientError`). 모양이 깨진
 * 응답은 던진다.
 */
export async function getCraneHistory(
  query: CraneHistoryQuery,
): Promise<CraneHistoryFrames> {
  const response = await restClient.get<unknown>(
    getApiPath(
      `${query.scope}/cranes/${encodeURIComponent(query.craneId)}/history`,
    ),
    { query: { from: query.from, to: query.to, step: query.step } },
  );
  const frames = sanitizeCraneHistoryFrames(response);
  if (!frames) {
    throw new Error('Invalid crane history response.');
  }
  return frames;
}
