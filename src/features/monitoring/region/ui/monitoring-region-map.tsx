import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { MonitoringRegion } from '@/entities/monitoring/region';
import {
  MAP_IMAGE_PATH,
  MAP_VIEWBOX,
  resolveMapZones,
  type ResolvedMapZone,
} from '@/features/monitoring/region/model/map-types';

const TEXT = {
  mapAlt: 'Hanwha crane yard map',
  region: '옥포산업단지',
} as const;

export function MonitoringRegionMap({
  regions,
}: {
  regions: MonitoringRegion[];
}) {
  const navigate = useNavigate();
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);

  const mapZones: ResolvedMapZone[] = useMemo(
    () => resolveMapZones(regions),
    [regions],
  );

  const handleZoneNavigate = (region: MonitoringRegion) => {
    navigate(region.route, {
      state: { regionId: region.id, regionName: region.name },
    });
  };

  return (
    <section className="relative flex-1 animate-[main-page-fade-up_0.5s_0.16s_ease_both] px-[clamp(20px,4vw,40px)] pb-8">
      <div className="grid grid-cols-[1fr_auto_1fr] overflow-hidden rounded-2xl border border-(--main-page-border) bg-[var(--main-page-map-shell-bg)] px-5 py-5">
        <div className="flex flex-wrap justify-start gap-2 text-[20px] tracking-[0.13em] text-(--main-page-text)">
          <span>{TEXT.region}</span>
        </div>
        <div className="mx-auto flex w-full justify-center">
          <div className="relative aspect-418/238 min-h-150 w-full max-w-200 min-w-200 overflow-hidden rounded-xl border border-(--main-page-border) bg-(--main-page-surface)">
            <img
              src={MAP_IMAGE_PATH}
              alt={TEXT.mapAlt}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-[var(--main-page-map-image-overlay)]" />

            <div className="absolute inset-0">
              <svg
                viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
                className="absolute inset-0 h-full w-full"
                preserveAspectRatio="xMidYMid meet"
              >
                {mapZones.map((zone) => {
                  const displayLabel = zone.labelText ?? zone.region.name;
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
                        aria-label={`${zone.region.name} 상세 화면으로 이동`}
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
                        width={40}
                        height={16}
                        rx={4}
                        fill="#1C1C1C"
                        stroke="#ffffff"
                        strokeWidth={0.7}
                      />
                      <text
                        x={connectorStart.x}
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
      </div>
    </section>
  );
}
