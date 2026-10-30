import { normalizeCraneKey } from '@crane/core/lib/crane-tag-key';
import {
  getMonitoringTagMetadata,
  type CraneScope,
} from '@crane/domain/monitoring';
import { filterTagRows, type TagRow } from '@crane/features/3d';

/**
 * 태그 연결 다이얼로그(ui/tag-pick-dialog.tsx)·코드 필드(ui/tag-code-field.tsx)의
 * 순수 로직 — ui/*.tsx 안에서 계산하지 않는다는 규칙(AGENTS.md) 대로 여기서
 * 거르고 고르고 적는다.
 */

/** 크레인 스냅샷 항목을 찾는 데 필요한 조각 — 스토어의 `cranes` 모양. */
export type PickSnapshotEntries<E> = Record<string, E | undefined>;

/**
 * 모델 craneId 의 스냅샷 항목 — 서버 크레인 ID 와 모델 craneId 는 `-`/`_`
 * 표기가 섞여 있어 정규화해 비교한다. 없으면 null.
 */
export function findSnapshotEntry<E>(
  cranes: PickSnapshotEntries<E>,
  craneId: string | undefined,
): { craneId: string; entry: E } | null {
  if (!craneId) return null;
  const wanted = normalizeCraneKey(craneId);
  for (const [id, entry] of Object.entries(cranes)) {
    if (entry && normalizeCraneKey(id) === wanted)
      return { craneId: id, entry };
  }
  return null;
}

/** 태그 목록 — 코드·표시명으로 거른다(빈 검색어는 전부, 새 배열). */
export function filterPickTags(
  rows: readonly TagRow[],
  query: string,
): TagRow[] {
  return filterTagRows(rows, 'all', query);
}

export interface CodeChip {
  /** 칸에 보이는 글자 — 코드. */
  text: string;
  /** 툴팁 — 조립 키와 표시명·단위. */
  title: string;
  /** 모델에 craneId 가 없어 키를 만들 수 없다 — amber 로 알린다. */
  unresolved: boolean;
}

/**
 * 카드의 코드 칩 — 코드 그대로 보이고, 툴팁에 조립 키(`C_171.tl_distance`)와
 * 서버 카탈로그의 표시명·단위를 적는다. craneId 가 없으면 키가 없다. 카탈로그는
 * 내업 태그의 것이라 다른 범위(외업 — 원본 이름이 코드)는 키만 적는다.
 */
export function describeCodeChip(
  code: string,
  craneId: string | undefined,
  scope: CraneScope | null,
): CodeChip {
  const meta = scope === 'indoor' ? getMonitoringTagMetadata(code) : null;
  const key = craneId ? `${normalizeCraneKey(craneId)}.${code}` : undefined;
  return {
    text: code,
    title: [key, meta?.displayName, meta?.unit ?? '']
      .filter(Boolean)
      .join(' · '),
    unresolved: !craneId,
  };
}

/** 칩이 좁을 때 코드 끝에서 남길 글자 수 — `_2`·`_01` 같은 번호가 보이게. */
export const CHIP_TAIL_KEEP = 4;

/**
 * 칩의 코드를 줄어드는 앞과 늘 보이는 끝으로 나눈다(가운데 줄임 —
 * `trolley_p…on_2`). 짧은 코드는 나누지 않는다 — 끝까지 들어가거나, 줄어도
 * 앞만 남는 편이 읽힌다.
 */
export function splitChipTail(tail: string): { head: string; end: string } {
  if (tail.length <= CHIP_TAIL_KEEP * 2) return { head: tail, end: '' };
  return {
    head: tail.slice(0, -CHIP_TAIL_KEEP),
    end: tail.slice(-CHIP_TAIL_KEEP),
  };
}
