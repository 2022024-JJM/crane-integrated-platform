import { createContext, use } from 'react';

/** Philly Anti-Collision HMI 디자인 토큰 — 글로벌 라이트/다크 테마 대응 */
export interface PhillyTheme {
  pageBg: string;
  text: string;
  textSub: string;
  caption: string;
  border: string;
  panelBg: string;
  buttonBg: string;
  hanwhaOrange: string;
  arrowIdle: string;
  arrowActive: string;
  red: string;
  redBg: string;
  orange: string;
  orangeBg: string;
  greenText: string;
  greenBg: string;
  greenDot: string;
  /** 지도 팔레트 (OSM 라이트/다크 스타일 근사) */
  map: {
    land: string;
    water: string;
    waterLabel: string;
    green: string;
    building: string;
    buildingLine: string;
    roadCasing: string;
    roadFill: string;
    roadLabel: string;
    dock: string;
    dockLine: string;
    dockInner: string;
    rail: string;
    slewCircle: string;
    poiFill: string;
    poiRing: string;
    poiDot: string;
    poiLabel: string;
    purple: string;
    purpleStroke: string;
    purpleLabel: string;
  };
}

const LIGHT: PhillyTheme = {
  pageBg: '#ffffff',
  text: '#17181a',
  textSub: '#4b4f55',
  caption: '#9aa0a6',
  border: '#e3e3e3',
  panelBg: '#ffffff',
  buttonBg: '#ffffff',
  hanwhaOrange: '#f26f21',
  arrowIdle: '#c2c7cd',
  arrowActive: '#2b6fd4',
  red: '#d3382b',
  redBg: '#fadcd9',
  orange: '#e8890c',
  orangeBg: '#fdeeda',
  greenText: '#2f8f3b',
  greenBg: '#e7f4e4',
  greenDot: '#34a853',
  map: {
    land: '#f2f1ed',
    water: '#8fd0ee',
    waterLabel: '#3f8fc0',
    green: '#cdebb0',
    building: '#e3e1dc',
    buildingLine: '#d4d1cb',
    roadCasing: '#d7dde5',
    roadFill: '#fdfdfd',
    roadLabel: '#6e6e6e',
    dock: '#edece8',
    dockLine: '#d0cdc7',
    dockInner: '#f6f5f2',
    rail: '#9a9a98',
    slewCircle: '#9aa25a',
    poiFill: '#ffffff',
    poiRing: '#b9b9b9',
    poiDot: '#7a7a7a',
    poiLabel: '#555555',
    purple: '#8e5bc0',
    purpleStroke: '#7a48ab',
    purpleLabel: '#7a5aa0',
  },
};

const DARK: PhillyTheme = {
  pageBg: '#101318',
  text: '#e8eaed',
  textSub: '#b6bcc4',
  caption: '#7c828a',
  border: '#2a2f36',
  panelBg: '#171b21',
  buttonBg: '#1c2129',
  hanwhaOrange: '#f26f21',
  arrowIdle: '#4b525a',
  arrowActive: '#4d8df0',
  red: '#ef5349',
  redBg: '#3a1e1c',
  orange: '#f2a13c',
  orangeBg: '#3a2c15',
  greenText: '#5fc46d',
  greenBg: '#1c2f1f',
  greenDot: '#43b656',
  map: {
    land: '#22262c',
    water: '#17293a',
    waterLabel: '#5a87a8',
    green: '#243626',
    building: '#2b3037',
    buildingLine: '#343a42',
    roadCasing: '#31363e',
    roadFill: '#3d434c',
    roadLabel: '#8b9199',
    dock: '#262b31',
    dockLine: '#3a4048',
    dockInner: '#20242a',
    rail: '#6a7078',
    slewCircle: '#a8b168',
    poiFill: '#20242a',
    poiRing: '#5a6068',
    poiDot: '#9aa0a8',
    poiLabel: '#a6acb4',
    purple: '#a06fd6',
    purpleStroke: '#8e5bc0',
    purpleLabel: '#a98fd0',
  },
};

export const PHILLY_THEMES: Record<'light' | 'dark', PhillyTheme> = {
  light: LIGHT,
  dark: DARK,
};

export const PhillyThemeContext = createContext<PhillyTheme>(LIGHT);

export function usePhillyTheme(): PhillyTheme {
  return use(PhillyThemeContext);
}

export const PHILLY_FONT =
  "'Segoe UI', 'Malgun Gothic', system-ui, -apple-system, sans-serif";
