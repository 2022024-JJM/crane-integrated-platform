import type { LatLng, Region } from '@crane/domain/region';

// Okpo shipyard area is used as the default map camera.
export const MAP_DEFAULT_CENTER: LatLng = {
  lat: 34.873071,
  lng: 128.710288,
};

export const MAP_DEFAULT_ZOOM = 15;

export interface MapMarkerStyle {
  fillColor: string;
  strokeColor: string;
}

export function getStatusPalette(status: Region['status']): MapMarkerStyle {
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
