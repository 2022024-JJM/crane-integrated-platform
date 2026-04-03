import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MAP_IMAGE_PATH,
  MAP_VIEWBOX,
  resolveMapZones,
  type ResolvedMapZone,
} from '../model/region-map-types';
import { getRegionTitleKey, regions, type Region } from '@crane/domain/region';
import { useProgressNavigate } from '@crane/core/lib/use-progress-navigate';

export function RegionMap() {
  const { t } = useTranslation();
  const navigate = useProgressNavigate();
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const mapZones: ResolvedMapZone[] = useMemo(() => resolveMapZones(regions), []);
  const handleZoneNavigate = (region: Region) => {
    navigate(region.navigateTo);
  };

  return (
    <section className="relative flex-1">
      <div className="grid grid-cols-[1fr_auto_1fr] overflow-hidden rounded-2xl border px-5 py-5">
        <div className="flex text-[20px] tracking-widest">
          <span>{t('region-overview:regionName')}</span>
        </div>
        <div className="mx-auto flex w-full justify-center">
          <div className="relative aspect-418/238 min-h-150 w-full max-w-200 min-w-200 overflow-hidden rounded-xl">
            <img src={MAP_IMAGE_PATH} className="h-full w-full object-cover" />
            <svg
              viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
              className="absolute inset-0 h-full w-full"
              preserveAspectRatio="xMidYMid meet"
            >
              {mapZones.map((zone) => {
                const displayLabel = t(getRegionTitleKey(zone.region.id));
                const style = zone.style;
                const connectorStart = zone.labelPoint ?? zone.center;
                const connectorEnd = zone.center;
                const isActiveRegion = hoveredRegionId === zone.region.id;

                return (
                  <g
                    key={`${zone.region.id}-${zone.points}`}
                    className={`cursor-pointer ${
                      isActiveRegion ? 'brightness-150' : 'brightness-100'
                    }`}
                    onMouseEnter={() => setHoveredRegionId(zone.region.id)}
                    onMouseLeave={() => setHoveredRegionId(null)}
                    onClick={() => handleZoneNavigate(zone.region)}
                  >
                    <polygon
                      points={zone.points}
                      fill={style.fillColor}
                      fillOpacity={isActiveRegion ? 0.35 : 0.2}
                      stroke={style.strokeColor}
                      strokeWidth={isActiveRegion ? 2.3 : 1.5}
                      role="link"
                      tabIndex={0}
                    />
                    <line
                      x1={connectorStart.x}
                      y1={connectorStart.y}
                      x2={connectorEnd.x}
                      y2={connectorEnd.y}
                      stroke="#ffffff"
                      strokeWidth={0.7}
                    />
                    <rect
                      x={connectorStart.x - 20}
                      y={connectorStart.y - 7}
                      width={60}
                      height={16}
                      rx={4}
                      fill="#1C1C1C"
                      stroke="#ffffff"
                      strokeWidth={0.7}
                    />
                    <text
                      x={connectorStart.x + 10}
                      y={connectorStart.y + 4}
                      className="tracking-[0.02em] select-none"
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="8"
                    >
                      {displayLabel}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
