import type { MonitoringRegion } from '@/entities/monitoring/region';

export const MAP_IMAGE_PATH = '/images/hanwha-ocean.png';

export const MAP_VIEWBOX = {
  width: 418,
  height: 238,
} as const;

export interface MapPoint {
  x: number;
  y: number;
}

export interface RegionPolygonDefinition {
  regionId: string;
  points: string;
  labelText?: string;
  labelPoint?: MapPoint;
}

export interface MapZoneStyle {
  fillColor: string;
  strokeColor: string;
}

export interface ResolvedMapZone extends RegionPolygonDefinition {
  region: MonitoringRegion;
  center: MapPoint;
  style: MapZoneStyle;
}

// 이미지 좌표 기준으로 영역을 그리는 지점 설정
// - points: 도형 꼭짓점 좌표 (x,y), viewBox({ width: 418, height: 238 }) 기준
// - labelPoint: 라벨/실선 연결 시작점
export const MAP_REGION_DEFINITIONS: RegionPolygonDefinition[] = [
  {
    regionId: '1dock',
    points: '105,130 125,143 102,170 83,155',
    labelText: '1 도크',
    labelPoint: { x: 40, y: 130 },
  },
  {
    regionId: '2dock',
    points: '135,145 158,160 195,115 171,104',
    labelText: '2 도크',
    labelPoint: { x: 220, y: 55 },
  },
  {
    regionId: 'indoor-work',
    points: '180,210 195,222 185,235 170,223',
    labelText: '내업',
    labelPoint: { x: 300, y: 225 },
  },
  {
    regionId: 'indoor-work',
    points: '256,140 262,145 250,160 243,156',
    labelText: '내업',
    labelPoint: { x: 300, y: 225 },
  },
  {
    regionId: 'indoor-work',
    points: '215,200 223,205 213,218 206,213',
    labelText: '내업',
    labelPoint: { x: 300, y: 225 },
  },
] as const;

function parsePoints(points: string): MapPoint[] {
  return points
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const coordinates = pair.split(',');
      if (coordinates.length !== 2) {
        return null;
      }

      const x = Number(coordinates[0]?.trim());
      const y = Number(coordinates[1]?.trim());

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }

      return { x, y };
    })
    .filter((point): point is MapPoint => point !== null);
}

export function getPolygonCenter(points: string): MapPoint {
  const vertices = parsePoints(points);
  if (!vertices.length) {
    return { x: MAP_VIEWBOX.width / 2, y: MAP_VIEWBOX.height / 2 };
  }

  const sum = vertices.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );

  return {
    x: Math.round(sum.x / vertices.length),
    y: Math.round(sum.y / vertices.length),
  };
}

function getStatusPalette(status: MonitoringRegion['status']) {
  if (status === 'warning') {
    return {
      fillColor: 'rgb(245 166 35)',
      strokeColor: 'rgb(245 166 35 / 0.9)',
    };
  }

  if (status === 'error') {
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

export const resolveMapZones = (
  regions: MonitoringRegion[],
): ResolvedMapZone[] => {
  const regionById = regions.reduce<Record<string, MonitoringRegion>>(
    (acc, region) => {
      acc[region.id] = region;
      return acc;
    },
    {},
  );

  return MAP_REGION_DEFINITIONS.flatMap((definition) => {
    const region = regionById[definition.regionId];
    if (!region) {
      return [];
    }

    return [
      {
        ...definition,
        region,
        center: getPolygonCenter(definition.points),
        style: getStatusPalette(region.status),
      },
    ];
  });
};
