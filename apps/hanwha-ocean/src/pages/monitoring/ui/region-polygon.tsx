import { useEffect } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import type { LatLng } from '@crane/domain/region';
import type { MapZoneStyle } from '../model/region-map-types';

interface RegionPolygonProps {
  paths: LatLng[];
  style: MapZoneStyle;
  active: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function RegionPolygon({
  paths,
  style,
  active,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: RegionPolygonProps) {
  const map = useMap();
  const mapsLibrary = useMapsLibrary('maps');

  useEffect(() => {
    if (!map || !mapsLibrary) return;

    const polygon = new mapsLibrary.Polygon({
      paths,
      fillColor: style.fillColor,
      fillOpacity: active ? 0.45 : 0.25,
      strokeColor: style.strokeColor,
      strokeOpacity: 1,
      strokeWeight: active ? 2.4 : 1.6,
      clickable: true,
      map,
    });

    const clickListener = polygon.addListener('click', onClick);
    const enterListener = polygon.addListener('mouseover', onMouseEnter);
    const leaveListener = polygon.addListener('mouseout', onMouseLeave);

    return () => {
      clickListener.remove();
      enterListener.remove();
      leaveListener.remove();
      polygon.setMap(null);
    };
  }, [
    map,
    mapsLibrary,
    paths,
    style.fillColor,
    style.strokeColor,
    active,
    onClick,
    onMouseEnter,
    onMouseLeave,
  ]);

  return null;
}
