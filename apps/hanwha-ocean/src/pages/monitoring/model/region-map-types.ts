import type { LatLng, Region } from '@crane/domain/region';

// 옥포 조선소(거제시) 일대를 기본 카메라로 사용한다.
export const MAP_DEFAULT_CENTER: LatLng = {
  lat: 34.881,
  lng: 128.6905,
};

export const MAP_DEFAULT_ZOOM = 15;

export interface MapZoneStyle {
  fillColor: string;
  strokeColor: string;
}

export function getStatusPalette(status: Region['status']): MapZoneStyle {
  if (status === 'warning') {
    return {
      fillColor: 'rgb(245 166 35)',
      strokeColor: 'rgb(245 166 35 / 0.9)',
    };
  }

  if (status === 'critical') {
    return {
      fillColor: 'rgb(240 71 71)',
      strokeColor: 'rgb(240 71 71 / 0.9)',
    };
  }

  return {
    fillColor: 'rgb(61 214 140)',
    strokeColor: 'rgb(61 214 140 / 0.9)',
  };
}
