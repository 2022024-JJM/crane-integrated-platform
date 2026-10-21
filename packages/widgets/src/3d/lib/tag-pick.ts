import {
  TAG_SLOTS,
  getSlotTagKey,
  type TagKeySlots,
  type TagSlot,
} from '@crane/domain/3d';
import {
  getMonitoringTagMetadata,
  normalizeCraneKey,
  parseCraneTagKey,
} from '@crane/domain/monitoring';
import {
  filterTagRows,
  type TagCatalogEntry,
  type TagRow,
} from '@crane/features/3d';

/**
 * 태그 연결 다이얼로그(ui/tag-pick-dialog.tsx)·슬롯 필드(ui/tag-slot-field.tsx)의
 * 순수 로직 — ui/*.tsx 안에서 계산하지 않는다는 규칙(AGENTS.md) 대로 여기서
 * 거르고 고르고 적는다.
 */

/** 크레인 목록 필터에 필요한 스냅샷 조각 — 스토어 항목에서 bay 만 본다. */
export type PickCraneEntries = Record<
  string,
  { snapshot: { bay: string | null } } | undefined
>;

export interface PickCraneFilter {
  /** 왼쪽 목록에 보일 크레인(스토어 순서 유지). */
  craneIds: string[];
  /** 검색어가 크레인에 맞았는가 — 맞으면 태그 목록은 거르지 않는다. */
  craneMatched: boolean;
}

/**
 * 크레인 목록 — 구역 칩('all' 이면 전부)과 검색어. 검색어는 크레인 ID·구역에
 * 부분 일치(대소문자·앞뒤 공백 무시)하면 거르고, 아무 크레인에도 안 맞으면
 * 태그 검색어로 보아 크레인은 전부 둔다(`filterPickTags`).
 */
export function filterPickCranes(
  order: readonly string[],
  cranes: PickCraneEntries,
  bay: string | 'all',
  query: string,
): PickCraneFilter {
  const needle = query.trim().toLowerCase();
  const inBay = order.filter((id) => {
    const entry = cranes[id];
    if (!entry) return false;
    return bay === 'all' || entry.snapshot.bay === bay;
  });
  if (!needle) return { craneIds: inBay, craneMatched: false };
  const byCrane = inBay.filter((id) => {
    const entry = cranes[id];
    return (
      id.toLowerCase().includes(needle) ||
      (entry?.snapshot.bay ?? '').toLowerCase().includes(needle)
    );
  });
  return byCrane.length > 0
    ? { craneIds: byCrane, craneMatched: true }
    : { craneIds: inBay, craneMatched: false };
}

/**
 * 태그 목록 — 검색어가 크레인에 맞았으면 전부, 아니면 코드·표시명으로 거른다.
 * 한 검색창이 두 목록을 겨누되 "C_171" 을 치면 태그 목록이 비는 일이 없게.
 */
export function filterPickTags(
  rows: readonly TagRow[],
  query: string,
  craneMatched: boolean,
): TagRow[] {
  return craneMatched ? [...rows] : filterTagRows(rows, 'all', query);
}

/** 가상 태그 목록 — 키·이름 부분 일치(대소문자·앞뒤 공백 무시). */
export function filterTagCatalog(
  entries: readonly TagCatalogEntry[],
  query: string,
): TagCatalogEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...entries];
  return entries.filter(
    (entry) =>
      entry.key.toLowerCase().includes(needle) ||
      entry.name.toLowerCase().includes(needle),
  );
}

/**
 * 처음 고를 크레인 — 지금 연결된 키의 크레인 › 모델의 craneId › 목록 첫
 * 크레인. 키·craneId 는 `-`/`_` 표기가 섞여 있어 정규화해 비교한다.
 */
export function pickInitialCrane(
  craneIds: readonly string[],
  modelCraneId: string | undefined,
  currentKey: string | undefined,
): string | null {
  const candidates = [
    currentKey ? parseCraneTagKey(currentKey)?.craneKey : undefined,
    modelCraneId ? normalizeCraneKey(modelCraneId) : undefined,
  ];
  for (const wanted of candidates) {
    if (!wanted) continue;
    const found = craneIds.find((id) => normalizeCraneKey(id) === wanted);
    if (found) return found;
  }
  return craneIds[0] ?? null;
}

/**
 * 사용자가 고른 크레인이 목록에 남아 있으면 그것, 아니면 처음 규칙으로
 * 다시 고른다(검색·구역 칩으로 목록이 바뀌어도 선택이 비지 않게).
 */
export function resolveSelectedCrane(
  picked: string | null,
  craneIds: readonly string[],
  modelCraneId: string | undefined,
  currentKey: string | undefined,
): string | null {
  if (picked && craneIds.includes(picked)) return picked;
  return pickInitialCrane(craneIds, modelCraneId, currentKey);
}

/** 연결된 키가 이 크레인의 것이면 그 태그 코드, 아니면 null. */
export function selectedCodeForCrane(
  currentKey: string | undefined,
  craneId: string | null,
): string | null {
  if (!currentKey || !craneId) return null;
  const parts = parseCraneTagKey(currentKey);
  if (!parts || parts.craneKey !== normalizeCraneKey(craneId)) return null;
  return parts.tagCode;
}

export interface TagKeyDescription {
  craneKey: string;
  tagCode: string;
  /** 플랫폼 태그 카탈로그의 표시명(영문). 모르는 코드는 코드를 사람 말로. */
  name: string;
  unit: string | null;
}

/**
 * 실시간 키 → 크레인·코드·표시명. 크레인·코드로 나뉘지 않는 키(가상 태그
 * 표기 등)는 null — 호출자가 키를 그대로 보인다.
 */
export function describeTagKey(key: string): TagKeyDescription | null {
  const parts = parseCraneTagKey(key);
  if (!parts) return null;
  const meta = getMonitoringTagMetadata(parts.tagCode);
  return {
    craneKey: parts.craneKey,
    tagCode: parts.tagCode,
    name: meta.displayName,
    unit: meta.unit,
  };
}

export interface SlotChip {
  /** 칩에 보이는 글자 — 늘 `lead + tail`. */
  text: string;
  /**
   * 장비 쪽 앞부분(`C_171 · `, `GC_04:`)과 태그 코드. 칸이 좁으면 앞부분부터
   * 줄여 코드를 남긴다 — 장비는 대개 고른 모델이라 코드가 더 많이 말한다.
   */
  lead: string;
  tail: string;
  /** 툴팁 — 표시명·단위. 없으면 undefined. */
  title: string | undefined;
  /** 목록에서 못 찾는 키(지운 가상 태그·가상 표기의 실시간 키). amber 로 알린다. */
  unknown: boolean;
}

/**
 * 풀리지 않은 키를 마지막 `:`·`.` 뒤에서 나눈다. 구분자가 양 끝이거나
 * 없으면 앞부분 없이 키 전체가 코드다.
 */
function splitKeyText(key: string): Pick<SlotChip, 'lead' | 'tail'> {
  const at = Math.max(key.lastIndexOf(':'), key.lastIndexOf('.'));
  if (at <= 0 || at >= key.length - 1) return { lead: '', tail: key };
  return { lead: key.slice(0, at + 1), tail: key.slice(at + 1) };
}

/**
 * 카드의 슬롯 칩 — 실시간 키는 `크레인 · 코드` 로 나눠 보이고, 가상 키는
 * 카탈로그의 이름을 툴팁에 붙인다. 어느 쪽도 못 풀면 키 그대로 + unknown.
 */
export function describeSlotChip(
  key: string,
  slot: TagSlot,
  catalog: readonly TagCatalogEntry[],
): SlotChip {
  if (slot === 'virtual') {
    const entry = catalog.find((e) => e.key === key);
    return {
      text: key,
      ...splitKeyText(key),
      title: entry
        ? [entry.name !== key ? entry.name : '', entry.unit ?? '']
            .filter(Boolean)
            .join(' · ') || undefined
        : undefined,
      unknown: !entry,
    };
  }
  const desc = describeTagKey(key);
  if (!desc) {
    return { text: key, ...splitKeyText(key), title: undefined, unknown: true };
  }
  const lead = `${desc.craneKey} · `;
  return {
    text: `${lead}${desc.tagCode}`,
    lead,
    tail: desc.tagCode,
    title: [desc.name, desc.unit ?? ''].filter(Boolean).join(' · '),
    unknown: false,
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

/**
 * 슬롯 필드가 처음 보일 슬롯 — 키가 있는 첫 슬롯(실시간 › 시뮬레이션), 둘 다
 * 비면 실시간. 맵핑은 대개 한쪽만 채우므로 연결된 쪽을 먼저 보인다.
 */
export function pickInitialSlot(value: TagKeySlots): TagSlot {
  return TAG_SLOTS.find((slot) => getSlotTagKey(value, slot)) ?? 'realtime';
}

/** 푸터 빵부스러기 — `C_171 › 계측값 › TL Distance (tl_distance)`. */
export function describePickSelection(
  craneId: string,
  row: Pick<TagRow, 'code' | 'name'>,
  categoryLabel: string,
): string {
  return `${craneId} › ${categoryLabel} › ${row.name} (${row.code})`;
}
