import type { LatLng, Region } from '@crane/domain/region';

// Okpo shipyard area is used as the default map camera.
export const MAP_DEFAULT_CENTER: LatLng = {
  lat: 34.873071,
  lng: 128.710288,
};

export const MAP_DEFAULT_ZOOM = 15;

export interface MapMarkerStyle {
  fillColor: string;
  fillColorTo: string;
  strokeColor: string;
  shadowColor: string;
  rippleColor: string;
}

export function getStatusPalette(status: Region['status']): MapMarkerStyle {
  if (status === 'warning') {
    return {
      fillColor: 'rgb(245 158 11)',
      fillColorTo: 'rgb(217 119 6)',
      strokeColor: 'rgb(245 158 11 / 0.95)',
      shadowColor: 'rgb(245 158 11 / 0.35)',
      rippleColor: 'rgb(245 158 11 / 0.22)',
    };
  }

  if (status === 'critical') {
    return {
      fillColor: 'rgb(239 68 68)',
      fillColorTo: 'rgb(185 28 28)',
      strokeColor: 'rgb(239 68 68 / 0.95)',
      shadowColor: 'rgb(239 68 68 / 0.35)',
      rippleColor: 'rgb(239 68 68 / 0.22)',
    };
  }

  return {
    fillColor: 'rgb(34 197 94)',
    fillColorTo: 'rgb(22 163 74)',
    strokeColor: 'rgb(34 197 94 / 0.95)',
    shadowColor: 'rgb(34 197 94 / 0.35)',
    rippleColor: 'rgb(34 197 94 / 0.22)',
  };
}
