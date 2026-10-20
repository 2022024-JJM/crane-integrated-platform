import { restClient } from '@crane/core/api';
import { getApiPath } from '@crane/core/config/network';
import { sanitizeCraneSnapshot } from '../lib/crane-snapshot';
import type { CraneSnapshot } from '../model/types';

/**
 * `GET /api/cranes` — 서버가 Redis 에 들고 있는 크레인별 현재 스냅샷 전체.
 * STOMP 구독 직전에 한 번 받아 첫 화면을 채운다(구독만으로는 다음 push
 * 묶음까지 비어 있다). 모양이 깨진 항목은 버리고, 배열이 아니면 던진다.
 */
export async function getCraneSnapshots(): Promise<CraneSnapshot[]> {
  const response = await restClient.get<unknown>(getApiPath('cranes'));
  if (!Array.isArray(response)) {
    throw new Error('Invalid crane snapshots response.');
  }
  const snapshots: CraneSnapshot[] = [];
  for (const item of response) {
    const snapshot = sanitizeCraneSnapshot(item);
    if (snapshot) snapshots.push(snapshot);
  }
  return snapshots;
}
