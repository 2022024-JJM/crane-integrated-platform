import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import type { MonitoringRegion } from '@/entities/monitoring-region';
import {
  MAP_IMAGE_PATH,
  MAP_VIEWBOX,
  resolveMapZones,
  type ResolvedMapZone,
} from '@/features/main-region-overview/model/main-region-overview-map';

const TEXT = {
  viewHint: '지도에서 지역 선택',
  mapAlt: 'Hanwha crane yard map',
  region: '옥포산업단지',
} as const;

export function MainRegionOverviewMap({
  regions,
}: {
  regions: MonitoringRegion[];
}) {
  const navigate = useNavigate();

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
    <section className="relative flex-1 px-[clamp(20px,4vw,40px)] pb-8 animate-[main-page-fade-up_0.5s_0.16s_ease_both]">
      <div className="relative overflow-hidden rounded-2xl border border-(--main-page-border) bg-black/30 px-5 py-5">
        <div className="flex flex-wrap justify-start gap-2 text-[11px] tracking-[0.13em] text-(--main-page-text-dim)">
          <span>{TEXT.region}</span>
        </div>
        <div className="mx-auto flex w-full justify-center">
          <div className="relative w-full overflow-hidden rounded-xl border border-(--main-page-border) bg-(--main-page-surface) aspect-418/238 min-w-200 max-w-200 min-h-150">
            <img
              src={MAP_IMAGE_PATH}
              alt={TEXT.mapAlt}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-[rgba(0,0,0,0.30)]" />

            <div className="absolute inset-0">
              <div className="mb-2 px-4 pt-2 text-[12px] text-(--main-page-text-dim) tracking-[0.12em] dd">
                <span>{TEXT.viewHint}</span>
              </div>

              <svg
                viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
                className="absolute inset-0 h-full w-full"
                preserveAspectRatio="xMidYMid meet"
              >
                {mapZones.map((zone, index) => {
                  const displayLabel = zone.labelText ?? zone.region.name;
                  const style = zone.style;
                  const connectorStart = zone.labelPoint ?? zone.center;
                  const connectorEnd = zone.center;

                  return (
                    <g
                      key={`${zone.region.id}-${zone.labelText ?? index}`}
                      className="cursor-pointer transition-all duration-200 hover:brightness-150"
                      onClick={() => handleZoneNavigate(zone.region)}
                    >
                      <polygon
                        points={zone.points}
                        fill={style.fillColor}
                        fillOpacity={0.2}
                        stroke={style.strokeColor}
                        strokeWidth={1.5}
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
                        className="select-none tracking-[0.02em]"
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
