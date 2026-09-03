import type { Region } from '@crane/domain/region';

export interface MapMarkerStyle {
  /**
   * 상태 색의 R G B 채널값 (`'34 197 94'`).
   * `rgb(<channels> / <alpha>)` 로 임의 투명도를 만들 때 쓴다 —
   * `fillColor` 는 이미 `rgb(...)` 로 닫혀 있어 뒤에 알파를 이어 붙일 수 없다.
   */
  channels: string;
  fillColor: string;
  fillColorTo: string;
  strokeColor: string;
  shadowColor: string;
  rippleColor: string;
  /**
   * 상태색 텍스트용 Tailwind 클래스.
   * 원색(`fillColor`)은 라이트 테마 배경에서 대비가 4.5:1 에 못 미쳐
   * 도형·링·점에만 쓰고, 글자는 테마별로 명도를 나눈 이 쌍을 쓴다.
   */
  textClass: string;
}

/** 상태 색을 임의 투명도로 — `withAlpha(palette, 0.25)` */
export function withAlpha(palette: MapMarkerStyle, alpha: number): string {
  return `rgb(${palette.channels} / ${alpha})`;
}

const WARNING_CHANNELS = '245 158 11';
const CRITICAL_CHANNELS = '239 68 68';
const NORMAL_CHANNELS = '34 197 94';

export function getStatusPalette(status: Region['status']): MapMarkerStyle {
  if (status === 'warning') {
    return {
      channels: WARNING_CHANNELS,
      fillColor: `rgb(${WARNING_CHANNELS})`,
      fillColorTo: 'rgb(217 119 6)',
      strokeColor: `rgb(${WARNING_CHANNELS} / 0.95)`,
      shadowColor: `rgb(${WARNING_CHANNELS} / 0.35)`,
      rippleColor: `rgb(${WARNING_CHANNELS} / 0.22)`,
      textClass: 'text-amber-600 dark:text-amber-300',
    };
  }

  if (status === 'critical') {
    return {
      channels: CRITICAL_CHANNELS,
      fillColor: `rgb(${CRITICAL_CHANNELS})`,
      fillColorTo: 'rgb(185 28 28)',
      strokeColor: `rgb(${CRITICAL_CHANNELS} / 0.95)`,
      shadowColor: `rgb(${CRITICAL_CHANNELS} / 0.35)`,
      rippleColor: `rgb(${CRITICAL_CHANNELS} / 0.22)`,
      textClass: 'text-red-600 dark:text-red-300',
    };
  }

  return {
    channels: NORMAL_CHANNELS,
    fillColor: `rgb(${NORMAL_CHANNELS})`,
    fillColorTo: 'rgb(22 163 74)',
    strokeColor: `rgb(${NORMAL_CHANNELS} / 0.95)`,
    shadowColor: `rgb(${NORMAL_CHANNELS} / 0.35)`,
    rippleColor: `rgb(${NORMAL_CHANNELS} / 0.22)`,
    textClass: 'text-emerald-600 dark:text-emerald-300',
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 지도 위에 직접 그리는 도형(측량 표식·스템·범례 스와치)의 색
 *
 * 위 팔레트는 **앱 테마**를 따르지만, 지도 배경은 앱 테마와 따로 논다 —
 * 위성(hybrid)은 라이트 테마에서도 늘 어두운 영상이다. 그래서 지도 위 도형은
 * 앱 테마가 아니라 **배경 밝기(basemap)** 를 기준으로 색을 고른다.
 *
 * 여기에 더해 모든 도형은 중립 케이싱(casing)을 깔고 그 위에 상태색을 얹는다.
 * 위성 영상의 초록 육지 위 초록 마커처럼 배경과 색이 겹쳐도 윤곽이 끊기지
 * 않게 하는, 지도 심볼의 표준 기법이다.
 * ────────────────────────────────────────────────────────────────────────── */

/** 지도 배경 밝기. `위성 || 다크 테마` 면 'dark' */
export type BasemapTone = 'light' | 'dark';

export interface MapSymbolStyle {
  /** R G B 채널값 — `symbolAlpha` 로 투명도를 만든다 */
  channels: string;
  /** 도형 본색 */
  mark: string;
  /** 도형 뒤 중립 케이싱 */
  casing: string;
}

/** 밝은 배경에는 진한 톤, 어두운 배경에는 밝은 톤 — 명도 대비를 배경에 맞춘다 */
const MARK_CHANNELS: Record<BasemapTone, Record<Region['status'], string>> = {
  light: {
    normal: '5 150 105',
    warning: '217 119 6',
    critical: '220 38 38',
  },
  dark: {
    normal: '52 211 153',
    warning: '251 191 36',
    critical: '248 113 113',
  },
};

const CASING: Record<BasemapTone, string> = {
  light: 'rgb(255 255 255 / 0.92)',
  dark: 'rgb(6 10 15 / 0.85)',
};

export function getMapSymbolStyle(
  status: Region['status'],
  basemap: BasemapTone,
): MapSymbolStyle {
  const channels = MARK_CHANNELS[basemap][status];
  return { channels, mark: `rgb(${channels})`, casing: CASING[basemap] };
}

/** 지도 도형 색을 임의 투명도로 — `symbolAlpha(sym, 0.25)` */
export function symbolAlpha(symbol: MapSymbolStyle, alpha: number): string {
  return `rgb(${symbol.channels} / ${alpha})`;
}
