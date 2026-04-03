import type { Region } from '../model/types';

export function getRegionTitleKey(regionId: Region['id']) {
  return `common:regions.${toRegionResourceKey(regionId)}.title`;
}

export function getRegionSubtitleKey(regionId: Region['id']) {
  return `common:regions.${toRegionResourceKey(regionId)}.subtitle`;
}

function getRegionBasePath(regionId: Region['id']) {
  if (regionId === 'goliath') return `/goliath-work/${regionId}`;
  if (regionId === 'dock-in') return `/indoor-work/${regionId}`;
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
  return regionId.replace('-', '');
}
