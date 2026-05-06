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
