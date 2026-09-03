import type { LatLng } from '@crane/domain/region';

/**
 * 세계 레벨에서 사이트들을 **화면 정중앙**에 놓는 경계 계산.
 *
 * 이 값을 상수로 적어 두면 두 가지가 틀어진다. 하나, 사이트가 늘거나 좌표가
 * 바뀌면 손으로 다시 맞춰야 하고 아무도 그걸 기억하지 못한다. 둘, 눈대중으로
 * 적은 숫자는 대칭이 아니어서 마커가 늘 한쪽으로 치우친다.
 *
 * ## 위도는 도(degree)가 아니라 메르카토르 y 로 다룬다
 *
 * 처음에는 위도에도 "±32°" 식으로 도 단위 여백을 줬는데, 그러면 세로 중앙이
 * 맞지 않는다. 메르카토르는 위도에 선형이 아니라서 **도 기준 중앙과 픽셀 기준
 * 중앙이 다르기** 때문이다. 실제로 사이트(북위 35~40°)들이 화면 중앙에서
 * 70px 넘게 아래로 밀려 있었다.
 *
 * 그래서 위도는 y(0=북극, 1=남극)로 변환한 뒤 그 위에서 대칭을 잡고 다시
 * 위도로 되돌린다. 경도는 메르카토르에서 x 에 선형이므로 도 단위 대칭이
 * 그대로 픽셀 대칭이다.
 *
 * 날짜변경선은 넘지 않는다고 본다. 지금 사이트는 필라델피아(-75°)와
 * 거제(129°) 뿐이라 경도 범위가 204° — 태평양을 가로지르는 짧은 길이 아니라
 * 대서양·유라시아를 지나는 긴 길로 잡힌다. 그게 의도한 프레이밍이다
 * (아메리카가 왼쪽, 아시아가 오른쪽인 일반적인 세계지도 배치).
 */
export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** 사이트 좌우로 남길 여유(도). 아메리카 서안부터 호주까지 들어오는 정도 */
const LNG_MARGIN_DEG = 36;

/**
 * 사이트 위아래로 남길 여유(메르카토르 y, 세계 높이를 1 로 본 비율).
 *
 * 가로로 긴 화면에서는 **경도 쪽이 먼저 걸리도록** 일부러 작게 잡았다. 세로가
 * 먼저 걸리면 남는 가로를 채우려 지도가 한 바퀴 넘게 늘어난다. 세로로 긴
 * 화면에서는 이쪽이 걸리며 더 축소되는데, 그때도 **y 중심은 그대로**라
 * 사이트가 세로 중앙에 놓이는 것은 변하지 않는다.
 */
const Y_MARGIN = 0.16;

const LNG_LIMIT_DEG = 179;
/** y=0/1 은 극점이라 fitBounds 가 튄다. 가장자리를 조금 남긴다 */
const Y_LIMIT = 0.0025;

/** 사이트가 하나도 없을 때의 폴백 — 지구 전체 */
const WHOLE_WORLD: MapBounds = {
  north: 85,
  south: -85,
  east: 179.999,
  west: -179.999,
};

export function worldFitBounds(centers: readonly LatLng[]): MapBounds {
  if (centers.length === 0) return WHOLE_WORLD;

  const ys = centers.map((c) => latToY(c.lat));
  const lngs = centers.map((c) => c.lng);

  const yCenter = (Math.min(...ys) + Math.max(...ys)) / 2;
  const lngCenter = (Math.min(...lngs) + Math.max(...lngs)) / 2;

  /*
   * 반폭은 "사이트 범위의 절반 + 여유" 다. 한계에 부딪히면 **반폭 쪽을 줄인다** —
   * 북/남을 각각 잘라 내면 중심이 밀려서, 정중앙에 놓겠다는 목적 자체가
   * 깨지기 때문이다.
   */
  const yHalf = Math.min(
    (Math.max(...ys) - Math.min(...ys)) / 2 + Y_MARGIN,
    yCenter - Y_LIMIT,
    1 - Y_LIMIT - yCenter,
  );
  const lngHalf = Math.min(
    (Math.max(...lngs) - Math.min(...lngs)) / 2 + LNG_MARGIN_DEG,
    LNG_LIMIT_DEG - Math.abs(lngCenter),
  );

  return {
    north: yToLat(yCenter - yHalf),
    south: yToLat(yCenter + yHalf),
    east: lngCenter + lngHalf,
    west: lngCenter - lngHalf,
  };
}

/** 위도(도) → 메르카토르 y. 0 이 북극, 1 이 남극이다 */
function latToY(lat: number): number {
  const rad = (lat * Math.PI) / 180;
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + rad / 2)) / (2 * Math.PI);
}

/** 메르카토르 y → 위도(도) */
function yToLat(y: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
}
