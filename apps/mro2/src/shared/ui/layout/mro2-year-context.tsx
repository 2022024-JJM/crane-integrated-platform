import { createContext, use } from 'react';

/**
 * 전역 연도(기간) 컨텍스트 — 앱바 툴바의 🕐 연도 셀렉터가 소스.
 * (react-refresh 규칙상 컴포넌트 파일과 분리해 훅/상수만 둔다)
 */

export interface Mro2Filter {
  year: number;
  setYear: (y: number) => void;
}

export const Mro2FilterContext = createContext<Mro2Filter | null>(null);

export function useMro2Year(): Mro2Filter {
  const ctx = use(Mro2FilterContext);
  if (!ctx) throw new Error('useMro2Year must be used within Mro2Layout');
  return ctx;
}

export const MRO2_YEARS = [2025, 2026];
