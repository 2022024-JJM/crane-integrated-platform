import { useMemo } from 'react';
import { listCranes } from '@crane/domain/crane';
import { buildCraneIdOptions } from '../lib/crane-id-options';

/** 크레인 레지스트리를 콤보박스 선택지로 — 레지스트리는 코드 상수라 한 번만 만든다. */
export function useCraneIdOptions() {
  return useMemo(() => buildCraneIdOptions(listCranes()), []);
}
