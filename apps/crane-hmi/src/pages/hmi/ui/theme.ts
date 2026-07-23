import { createContext, useContext } from 'react';
import { getStorageItem, setStorageItem } from '@crane/core/lib/safe-storage';
import type { AlarmZone } from '../model/types';

export type HmiThemeName = 'classic' | 'modern';

/**
 * HMI 디자인 토큰 — 레이아웃·정보 구조·알람 의미론(노랑/주황/빨강)은 두 테마가 동일하고
 * 색·타이포·질감만 다르다. classic은 GSI 원본 재현, modern은 모던 산업 SCADA 톤.
 */
export interface HmiTheme {
  name: HmiThemeName;
  /** 기본(한글 라벨) 폰트 */
  font: string;
  /** 수치 전용 폰트 — modern은 계기판 느낌의 모노스페이스 */
  valueFont: string;
  pageBg: string;
  panel: {
    bg: string;
    border: string;
    masterBorder: string;
    headerBg: string;
    headerBorder: string;
    headerText: string;
    radius: number;
  };
  row: {
    border: string;
    labelBg: string;
    labelText: string;
    labelBorder: string;
  };
  text: {
    value: string;
    valueMoving: string;
    unit: string;
  };
  arrow: {
    idleFill: string;
    idleStroke: string;
  };
  alarm: {
    warnText: string;
    stopText: string;
    /** 맵 점멸 오버레이 — modern은 반투명 + 테두리 글로우 */
    overlay: Record<Exclude<AlarmZone, 'none'>, string>;
    glow: Record<Exclude<AlarmZone, 'none'>, string> | null;
  };
  titleBar: {
    bg: string;
    border: string;
    brand: string;
    title: string;
    screenName: string;
    clock: string;
  };
  map: {
    bg: string;
    border: string;
    /** 25m 간격 거리 그리드 색 (null이면 미표시) */
    grid: string | null;
    boom: string;
    trolley: string;
    trolleyStroke: string;
    trolleyAlt: string;
    ttcFill: string;
    ttcStroke: string | null;
    ocFill: string;
    ocStroke: string | null;
    masterFill: string;
    masterStroke: string | null;
    commBody: string;
    commFill: string;
  };
  button: {
    bg: string;
    text: string;
    borderTop: string;
    borderBottom: string;
    radius: number;
  };
  freeSlew: {
    bg: string;
    text: string;
    border: string;
  };
  settings: {
    sectionBg: string;
    sectionBorder: string;
    outputBg: string;
    outputText: string;
    outputBorder: string;
    inputBg: string;
    inputText: string;
    inputBorder: string;
    guideText: string;
    guideAccent: string;
  };
}

const KOREAN_FONT =
  "'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif";

const MONO_FONT =
  "'IBM Plex Mono', 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace";

/** GSI 원본 HMI 재현 (비교 데모·매뉴얼 검증용) */
export const CLASSIC_THEME: HmiTheme = {
  name: 'classic',
  font: KOREAN_FONT,
  valueFont: KOREAN_FONT,
  pageBg: '#000',
  panel: {
    bg: '#000',
    border: '2px solid #bdbdbd',
    masterBorder: '2px solid #d40000',
    headerBg: 'transparent',
    headerBorder: '2px solid #e3e3e3',
    headerText: '#fff',
    radius: 0,
  },
  row: {
    border: '1px solid #4d4d4d',
    labelBg: '#262626',
    labelText: '#e9e9e9',
    labelBorder: '1px solid #4d4d4d',
  },
  text: {
    value: '#fff',
    valueMoving: '#35e83b',
    unit: '#bdbdbd',
  },
  arrow: {
    idleFill: '#484848',
    idleStroke: '#2a2a2a',
  },
  alarm: {
    warnText: '#ffe33c',
    stopText: '#ff2a2a',
    overlay: { near: '#f6f67c', slow: '#f57800', stop: '#ef0e0e' },
    glow: null,
  },
  titleBar: {
    bg: '#000',
    border: '1px solid #2c2c2c',
    brand: '#f37321',
    title: '#f2f2f2',
    screenName: '#9a9a9a',
    clock: '#d8d8d8',
  },
  map: {
    bg: '#000',
    border: '1px solid #8c8c8c',
    grid: null,
    boom: '#f88a00',
    trolley: '#ffe23e',
    trolleyStroke: '#7a6400',
    trolleyAlt: '#f5ead0',
    ttcFill: 'rgba(64, 104, 108, 0.88)',
    ttcStroke: null,
    ocFill: 'rgba(132, 128, 46, 0.42)',
    ocStroke: null,
    masterFill: 'rgba(62, 106, 110, 0.9)',
    masterStroke: null,
    commBody: '#e01212',
    commFill: 'rgba(150, 12, 12, 0.55)',
  },
  button: {
    bg: '#3a3a3a',
    text: '#e3e3e3',
    borderTop: '1px solid #7a7a7a',
    borderBottom: '1px solid #151515',
    radius: 0,
  },
  freeSlew: {
    bg: '#52f23a',
    text: '#000',
    border: '1px solid #b8ffb0',
  },
  settings: {
    sectionBg: '#111',
    sectionBorder: '1px solid #555',
    outputBg: '#d8d8d8',
    outputText: '#111',
    outputBorder: '2px inset #888',
    inputBg: '#fff',
    inputText: '#111',
    inputBorder: '2px inset #888',
    guideText: '#9fdf9f',
    guideAccent: '#ff4a4a',
  },
};

/** 모던 산업 SCADA — 블루-차콜 베이스, 헤어라인 보더, 모노 수치, 시안 악센트 */
export const MODERN_THEME: HmiTheme = {
  name: 'modern',
  font: KOREAN_FONT,
  valueFont: MONO_FONT,
  pageBg: 'radial-gradient(1100px 760px at 50% 28%, #0d1622 0%, #070b11 62%)',
  panel: {
    bg: '#0d141d',
    border: '1px solid #22303f',
    masterBorder: '1px solid #c43c3c',
    headerBg: '#101924',
    headerBorder: '1px solid #2c3c4e',
    headerText: '#e8f0f8',
    radius: 10,
  },
  row: {
    border: '1px solid #1a2533',
    labelBg: '#121b26',
    labelText: '#7e94ab',
    labelBorder: '1px solid #1d2937',
  },
  text: {
    value: '#ecf3fa',
    valueMoving: '#3ddc84',
    unit: '#5d7287',
  },
  arrow: {
    idleFill: '#33404f',
    idleStroke: '#1d2733',
  },
  alarm: {
    warnText: '#ffd23e',
    stopText: '#ff5147',
    overlay: {
      near: 'rgba(255, 210, 62, 0.20)',
      slow: 'rgba(255, 138, 44, 0.24)',
      stop: 'rgba(255, 59, 48, 0.27)',
    },
    glow: { near: '#ffd23e', slow: '#ff8a2c', stop: '#ff3b30' },
  },
  titleBar: {
    bg: 'linear-gradient(180deg, #0e1620, #0a1018)',
    border: '1px solid #1d2a39',
    brand: '#f37321',
    title: '#dbe6f2',
    screenName: '#39c0d8',
    clock: '#8ba1b8',
  },
  map: {
    bg: '#0a1019',
    border: '1px solid #22303f',
    grid: 'rgba(120, 160, 200, 0.07)',
    boom: '#ff9f43',
    trolley: '#ffd166',
    trolleyStroke: '#8a6a1a',
    trolleyAlt: '#ffe9c2',
    ttcFill: 'rgba(43, 116, 138, 0.40)',
    ttcStroke: 'rgba(99, 205, 231, 0.35)',
    ocFill: 'rgba(128, 120, 48, 0.30)',
    ocStroke: 'rgba(206, 190, 96, 0.35)',
    masterFill: 'rgba(40, 98, 116, 0.45)',
    masterStroke: '#39c0d8',
    commBody: '#e0312f',
    commFill: 'rgba(150, 12, 12, 0.5)',
  },
  button: {
    bg: '#121b26',
    text: '#b9c9da',
    borderTop: '1px solid #243345',
    borderBottom: '1px solid #243345',
    radius: 8,
  },
  freeSlew: {
    bg: '#2bd576',
    text: '#04110a',
    border: '1px solid #57e89a',
  },
  settings: {
    sectionBg: '#0d141d',
    sectionBorder: '1px solid #22303f',
    outputBg: '#0f1822',
    outputText: '#cfe0f0',
    outputBorder: '1px solid #243345',
    inputBg: '#101b27',
    inputText: '#e8f1fa',
    inputBorder: '1px solid #2c4258',
    guideText: '#86c7a4',
    guideAccent: '#ff6b61',
  },
};

export const HMI_THEMES: Record<HmiThemeName, HmiTheme> = {
  classic: CLASSIC_THEME,
  modern: MODERN_THEME,
};

const STORAGE_KEY = 'hmi-theme';

export function loadThemeName(): HmiThemeName {
  const stored = getStorageItem(STORAGE_KEY);
  return stored === 'classic' || stored === 'modern' ? stored : 'modern';
}

export function saveThemeName(name: HmiThemeName): void {
  setStorageItem(STORAGE_KEY, name);
}

/** hmi-page에서 `<HmiThemeContext.Provider value={HMI_THEMES[name]}>`로 주입 */
export const HmiThemeContext = createContext<HmiTheme>(MODERN_THEME);

export function useHmiTheme(): HmiTheme {
  return useContext(HmiThemeContext);
}
