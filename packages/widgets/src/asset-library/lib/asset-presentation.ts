import { getAssetContentHash } from '@crane/core/lib/asset-url';
import { getModelPreviewAssetPath } from '@crane/domain/3d';
import {
  getAssetPreviewMode,
  getCurrentAssetVersion,
  type AssetFileRef,
  type AssetRecord,
  type AssetVersionStatus,
} from '@crane/domain/asset-library';

/**
 * 자산의 표시 규칙 — 썸네일을 어디서 가져올지, 상태를 어떤 색으로 보일지,
 * 날짜를 어떻게 적을지.
 */

export type AssetThumbnailSource =
  /** 저장된 썸네일 파일. `stamp` 은 같은 경로에 덮어쓴 썸네일의 캐시를 깬다. */
  | { kind: 'file'; ref: AssetFileRef; stamp: string }
  /** 배포된 정적 썸네일(`/previews/{id}.png`). */
  | { kind: 'static'; path: string }
  /** 그림 도면은 파일 자체가 썸네일이다. */
  | { kind: 'image'; ref: AssetFileRef }
  | { kind: 'none' };

/**
 * 썸네일 원천. 순서는 저장된 썸네일 → 배포된 정적 썸네일 → (그림 도면이면)
 * 파일 자체 → 없음. 정적 썸네일의 존재는 자산 해시 매니페스트로 판정한다 —
 * 없는 파일을 요청해 404 를 내지 않는다.
 */
export function resolveThumbnailSource(asset: AssetRecord): AssetThumbnailSource {
  if (asset.thumbnail) {
    return {
      kind: 'file',
      ref: asset.thumbnail.ref,
      stamp: asset.thumbnail.updatedAt,
    };
  }
  if (asset.kind === 'model' && asset.catalogId) {
    const path = getModelPreviewAssetPath(asset.catalogId);
    if (getAssetContentHash(path) !== null) return { kind: 'static', path };
  }
  const current = getCurrentAssetVersion(asset);
  if (getAssetPreviewMode(current.file.format) === 'image') {
    return { kind: 'image', ref: current.file.ref };
  }
  return { kind: 'none' };
}

/** URL 에 캐시 무효화 도장을 붙인다. blob·data URL 은 건드리지 않는다. */
export function withCacheStamp(url: string, stamp: string): string {
  if (!stamp || url.startsWith('blob:') || url.startsWith('data:')) return url;
  const [base, fragment] = url.split('#');
  const separator = base.includes('?') ? '&' : '?';
  const stamped = `${base}${separator}t=${encodeURIComponent(stamp)}`;
  return fragment === undefined ? stamped : `${stamped}#${fragment}`;
}

/** 뷰어 위 조작 묶음 — 배경이 무엇이든 읽히는 어두운 유리판. */
export const VIEWER_GLASS_BAR =
  'flex h-9 items-center gap-0.5 rounded-lg bg-black/50 p-1 shadow-sm backdrop-blur-md';

/** 카드 격자 — 최소 폭으로 칸 수를 정한다. 불러오는 동안의 자리 표시도 같이 쓴다. */
export const ASSET_CARD_GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3';

interface StatusTone {
  /** 점 색. */
  dot: string;
  /** 테두리·아이콘에 쓰는 글자색(currentColor). */
  text: string;
  /** 배지 글자·테두리·배경. */
  badge: string;
}

/**
 * 상태 색. 색은 수명주기의 위치만 나타낸다 — 진행 중(검토)은 amber, 통과
 * (승인)는 sky, 배포 중(게시)은 emerald, 막힘(반려)은 rose, 초안·철회는
 * 무채색이다.
 */
export const ASSET_STATUS_TONE: Record<AssetVersionStatus, StatusTone> = {
  draft: {
    text: 'text-zinc-400',
    dot: 'bg-zinc-400',
    badge: 'border-border text-muted-foreground bg-muted/40',
  },
  'in-review': {
    text: 'text-amber-500',
    dot: 'bg-amber-500',
    badge:
      'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  approved: {
    text: 'text-sky-500',
    dot: 'bg-sky-500',
    badge: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  rejected: {
    text: 'text-rose-500',
    dot: 'bg-rose-500',
    badge: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
  published: {
    text: 'text-emerald-500',
    dot: 'bg-emerald-500',
    badge:
      'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  withdrawn: {
    text: 'text-zinc-400',
    dot: 'bg-zinc-400/60',
    badge: 'border-border text-muted-foreground/70 bg-transparent line-through',
  },
};

/** 날짜만(목록용). 시각을 모르면 `—`. */
export function formatAssetDate(iso: string, locale: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

const RELATIVE_STEPS: [limit: number, size: number, unit: Intl.RelativeTimeFormatUnit][] = [
  [60 * 60, 60, 'minute'],
  [60 * 60 * 24, 60 * 60, 'hour'],
  [60 * 60 * 24 * 30, 60 * 60 * 24, 'day'],
  [60 * 60 * 24 * 365, 60 * 60 * 24 * 30, 'month'],
  [Infinity, 60 * 60 * 24 * 365, 'year'],
];

/**
 * 지금으로부터 얼마나 전인지 — `3일 전`, `2개월 전`. 카드처럼 좁은 자리에서
 * "최근에 손댄 것인가" 를 날짜보다 빨리 읽힌다. `now` 는 밀리초(호출부가 준다).
 * 1분 안쪽과 미래 시각(시계 오차)은 "지금" 으로 적고, 시각을 모르면 `—`.
 */
export function formatRelativeTime(
  iso: string,
  now: number,
  locale: string,
): string {
  if (!iso) return '—';
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '—';
  const seconds = Math.floor((now - time) / 1000);
  if (seconds < 60) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      0,
      'second',
    );
  }
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'always' });
  for (const [limit, size, unit] of RELATIVE_STEPS) {
    if (seconds < limit) return format.format(-Math.floor(seconds / size), unit);
  }
  return '—';
}

/** 날짜와 시각(이력용). */
export function formatAssetDateTime(iso: string, locale: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** 해시의 앞부분만 — `sha256:ab12cd34…`. */
export function shortenContentHash(hash: string | null): string {
  if (!hash) return '—';
  const [algorithm, value] = hash.includes(':') ? hash.split(':') : ['', hash];
  const head = value.slice(0, 12);
  return algorithm ? `${algorithm}:${head}…` : `${head}…`;
}

/** 쉼표·줄바꿈으로 구분해 입력한 태그 문자열을 목록으로. */
export function parseTagInput(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** 권할 태그 — 이미 붙은 것(대소문자 무시)을 뺀 나머지. 순서는 그대로다. */
export function listTagSuggestions(
  suggestions: readonly string[],
  current: readonly string[],
): string[] {
  const taken = new Set(current.map((tag) => tag.toLowerCase()));
  const offered: string[] = [];
  for (const tag of suggestions) {
    const key = tag.toLowerCase();
    if (taken.has(key)) continue;
    taken.add(key);
    offered.push(tag);
  }
  return offered;
}
