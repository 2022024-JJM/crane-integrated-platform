import type { BasemapTone } from '../model/region-map-types';

/**
 * 사이트가 있는 나라의 경계선을 칠하는 색.
 *
 * **중립색만 쓴다.** 지도 위에는 이미 뜻을 가진 색이 두 계열 돌고 있다 —
 * 상태(초록·주황·빨강)와 도크 식별색(한색 계열). 국경선까지 유채색을 쓰면
 * "저 파란 테두리가 무슨 뜻이지"를 되묻게 되고, 그 순간 세 신호가 모두
 * 흐려진다. 경계선이 나르는 뜻은 "여기에 우리 현장이 있다" 하나뿐이라
 * 배경 밝기의 반대편 무채색으로 충분하다.
 *
 * 면(fill)은 아주 옅게만 깐다. 세계 레벨에서 나라 하나가 화면의 상당 부분을
 * 덮으므로, 진하게 깔면 그 안의 마커·지명이 죽는다. 강조는 선이 하고 면은
 * "이 덩어리" 라는 것만 알려 준다.
 */
export interface CountryBoundaryStyle {
  strokeColor: string;
  strokeOpacity: number;
  strokeWeight: number;
  fillColor: string;
  fillOpacity: number;
}

export function countryBoundaryStyle(
  basemap: BasemapTone,
): CountryBoundaryStyle {
  if (basemap === 'dark') {
    return {
      strokeColor: '#ffffff',
      strokeOpacity: 0.68,
      strokeWeight: 1.8,
      fillColor: '#ffffff',
      fillOpacity: 0.07,
    };
  }

  return {
    strokeColor: '#0f172a',
    strokeOpacity: 0.55,
    strokeWeight: 1.8,
    fillColor: '#0f172a',
    fillOpacity: 0.06,
  };
}
