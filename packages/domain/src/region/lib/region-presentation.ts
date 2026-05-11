import type { Region } from '../model/types';

export function getRegionTitleKey(regionId: Region['id']) {
  return `common:regions.${toRegionResourceKey(regionId)}.title`;
}

export function getRegionSubtitleKey(regionId: Region['id']) {
  return `common:regions.${toRegionResourceKey(regionId)}.subtitle`;
}

function getRegionBasePath(regionId: Region['id']) {
  if (regionId === 'goliath') return `/goliath-work/${regionId}`;
  if (regionId.endsWith('dock-in')) return `/indoor-work/${regionId}`;
  return `/outdoor-work/${regionId}`;
}

export function getRegionLinkItems(regionId: Region['id']) {
  const base = getRegionBasePath(regionId);

  return [
    {
      labelKey: 'common:nav.realTimeMonitoring',
      path: `${base}/3d-monitoring`,
    },
    {
      labelKey: 'common:nav.craneStatus',
      path: `${base}/crane-status`,
    },
  ];
}

function toRegionResourceKey(regionId: Region['id']) {
  // philly-dock-2 는 4도크이므로 별도 키 사용, 나머지는 prefix를 벗기고 ocean 키 재사용
  if (regionId === 'philly-dock-2') return 'phillydock2';
  return regionId.replace(/^philly-/, '').replace(/-/g, '');
}

/**
 * 지도 마커 본체에 표시할 짧은 도크 코드.
 *   philly-dock-2       → 'D4'  (Philly 현장은 Dock 4로 운영)
 *   dock-in / *-dock-in → 'IN'
 *   dock-N / *-dock-N   → 'D{N}'
 *   goliath             → 'GC'
 *   기타                 → id에서 영숫자 첫 두 글자 대문자
 */
export function getRegionShortCode(regionId: Region['id']): string {
  if (regionId === 'goliath') return 'GC';
  if (regionId === 'philly-dock-2') return 'D4';

  const normalized = regionId.replace(/^philly-/, '');
  if (normalized === 'dock-in') return 'IN';

  const dockMatch = normalized.match(/^dock-(\d+)$/);
  if (dockMatch) return `D${dockMatch[1]}`;

  const fallback = normalized.replace(/[^a-z0-9]/gi, '').slice(0, 2);
  return fallback.toUpperCase() || '?';
}
