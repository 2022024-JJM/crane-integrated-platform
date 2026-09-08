/**
 * 마커 식별색 — "이게 **어느** 도크인가" 를 색으로 가른다.
 *
 * 상태색과 반드시 계열을 갈라 둔다. 상태는 초록·주황·빨강(normal/warning/
 * critical)을 쓰므로 식별색은 그 세 계열을 피한 한색 쪽에서만 고른다.
 * 한 판 위에 같은 계열 두 색이 있으면 "저 색이 상태인가 이름인가" 를 매번
 * 되묻게 되고, 그 순간 두 신호가 모두 죽는다.
 *
 * 색이 뜻을 혼자 나르지는 않는다 — 칩 안에는 도크 코드(D1 · IN · GC)가 늘
 * 함께 찍힌다. 색은 지도를 훑을 때 덩어리를 갈라 주는 보조 신호이고,
 * 정확한 식별은 코드와 라벨이 한다(색각 이상 대비).
 *
 * `ui/*.tsx` 안에서 색을 고르지 않는다는 규약에 따라 표를 여기 둔다.
 */
export interface MapIdentityStyle {
  /** R G B 채널값 — `identityAlpha` 로 임의 투명도를 만든다 */
  channels: string;
  color: string;
  /**
   * 식별색 텍스트용 Tailwind 클래스. 원색은 라이트 배경에서 대비가 모자라
   * 도형에만 쓰고, 글자는 테마별로 명도를 나눈 이 쌍을 쓴다.
   */
  textClass: string;
}

/** 식별색을 임의 투명도로 — `identityAlpha(identity, 0.16)` */
export function identityAlpha(
  identity: MapIdentityStyle,
  alpha: number,
): string {
  return `rgb(${identity.channels} / ${alpha})`;
}

function identity(channels: string, textClass: string): MapIdentityStyle {
  return { channels, color: `rgb(${channels})`, textClass };
}

/** 상태 3색(초록·주황·빨강)과 겹치지 않는 한색 계열만 모아 둔 후보군 */
const IDENTITY_POOL: MapIdentityStyle[] = [
  identity('56 189 248', 'text-sky-600 dark:text-sky-300'),
  identity('129 140 248', 'text-indigo-600 dark:text-indigo-300'),
  identity('232 121 249', 'text-fuchsia-600 dark:text-fuchsia-300'),
  identity('34 211 238', 'text-cyan-600 dark:text-cyan-300'),
  identity('167 139 250', 'text-violet-600 dark:text-violet-300'),
  identity('96 165 250', 'text-blue-600 dark:text-blue-300'),
];

/**
 * region → 식별색 고정 배정.
 *
 * 같은 사이트 안에서 이웃하는 도크끼리 색상거리가 벌어지도록 손으로 정한다.
 * 특히 `dock-in`(내업)은 옥외 도크(D1 · D2)의 파랑 계열에서 가장 멀리 떨어진
 * 마젠타를 준다 — 내업/외업 구분이 지도에서 즉시 읽혀야 한다.
 */
const REGION_IDENTITY_INDEX: Record<string, number> = {
  'dock-1': 0, // sky
  'dock-2': 1, // indigo
  'dock-in': 2, // fuchsia — 내업
  goliath: 3, // cyan
  'philly-dock-2': 4, // violet
};

export function getRegionIdentity(regionId: string): MapIdentityStyle {
  const fixed = REGION_IDENTITY_INDEX[regionId];
  if (fixed !== undefined) return IDENTITY_POOL[fixed];
  return IDENTITY_POOL[hashIndex(regionId, IDENTITY_POOL.length)];
}

/**
 * 사이트(world 레벨) 식별색.
 *
 * 처음에는 사이트에 색을 주지 않고 중립 회색 하나로 통일했다. "사이트는
 * 대륙 단위로 흩어져 있어 색으로 가를 이유가 없다" 는 논리였는데, 실제
 * 화면에서 틀렸다는 게 드러났다 — 세계 지도는 두 사이트를 **한 화면에**
 * 같이 보여 주고, 둘 다 앵커 아이콘 · 같은 회색 칩 · 같은 초록 상태라
 * 이름을 읽기 전에는 같은 것으로 보였다. 이름을 읽어야 구분되면 그건
 * 마커가 일을 안 하고 있는 것이다.
 *
 * 그래서 도크와 같은 규칙을 사이트에도 적용한다 — 색이 덩어리를 갈라 주고
 * 정확한 식별은 이름이 한다. 도크 색과 겹쳐도 상관없다. 두 계층은 서로 다른
 * 줌 레벨에서만 그려져 한 화면에 같이 놓이는 일이 없다.
 */
const SITE_IDENTITY: Record<string, MapIdentityStyle> = {
  // 거제 — 하늘색
  'hanwha-ocean': identity('56 189 248', 'text-sky-600 dark:text-sky-300'),
  // 필라델피아 — 마젠타. 하늘색과 색상환에서 가장 멀어 곁눈질로도 갈린다
  'philly-shipyard': identity(
    '232 121 249',
    'text-fuchsia-600 dark:text-fuchsia-300',
  ),
};

/** 미등록 사이트도 렌더마다 같은 색을 받도록 하는 폴백 */
export function getSiteIdentity(siteId: string): MapIdentityStyle {
  return (
    SITE_IDENTITY[siteId] ??
    IDENTITY_POOL[hashIndex(siteId, IDENTITY_POOL.length)]
  );
}

/** 미등록 region 도 렌더마다 같은 색을 받도록 하는 결정론적 해시 */
function hashIndex(value: string, size: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % size;
}
