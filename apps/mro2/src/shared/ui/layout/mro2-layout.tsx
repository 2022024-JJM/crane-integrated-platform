import '../kc-theme.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-sans-condensed/600.css';
import '@fontsource/ibm-plex-sans-condensed/700.css';
import '@fontsource/ibm-plex-mono/500.css';
import { createContext, use, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { KC, KC_FONT, KC_FONT_DISPLAY } from '../kc';
import { NewTicketModal } from '../new-ticket-modal';

/* ── 전역 연도 컨텍스트 (툴바 🕐 연도 셀렉터) ───────────────────────── */

interface Mro2Filter {
  year: number;
  setYear: (y: number) => void;
}

const Mro2FilterContext = createContext<Mro2Filter | null>(null);

export function useMro2Year(): Mro2Filter {
  const ctx = use(Mro2FilterContext);
  if (!ctx) throw new Error('useMro2Year must be used within Mro2Layout');
  return ctx;
}

export const MRO2_YEARS = [2025, 2026];

/* ── 브랜드 워드마크 (필요 시 페이지 내 사용) ───────────────────────── */

export function Mro2Logo({ size = 15 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 font-bold tracking-wide uppercase"
      style={{ fontSize: size, lineHeight: 1, fontFamily: KC_FONT_DISPLAY }}
    >
      <span
        className="inline-block"
        style={{
          width: size * 0.55,
          height: size * 0.55,
          background: KC.accent,
          borderRadius: 2,
        }}
      />
      <span style={{ color: KC.ink }}>CRANE</span>
      <span style={{ color: KC.accent }}>MRO</span>
    </span>
  );
}

/* ── 레이아웃 본체 ──────────────────────────────────────────────────────
 * 헤더/햄버거 사이드바는 기존 MRO와 동일하게 shell의 AppLayout이 담당한다.
 * 여기서는 MRO2 콘텐츠 래핑(서체·컬러)과 연도 컨텍스트만 제공한다. */

export function Mro2Layout() {
  const [year, setYear] = useState(2026);
  const filter = useMemo(() => ({ year, setYear }), [year]);

  return (
    <Mro2FilterContext value={filter}>
      <div
        className="min-h-full"
        style={{ background: KC.bg, color: KC.text, fontFamily: KC_FONT }}
      >
        {/* 콘텐츠 툴바: 전역 기간(연도) 셀렉터 */}
        <div className="flex items-center justify-end px-3 pt-2.5 md:px-5">
          <label
            className="flex cursor-pointer items-center gap-1 text-[12px]"
            style={{ color: KC.ink }}
          >
            <Clock size={14} />
            <select
              aria-label="Time frame"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="cursor-pointer bg-transparent text-[12px] outline-none"
              style={{ color: KC.ink }}
            >
              {MRO2_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* 콘텐츠 — 전폭 */}
        <main className="w-full px-3 pt-1 pb-14 md:px-5">
          <Outlet />
        </main>

        {/* WO 생성 모달 (URL ?new= 로 열림) */}
        <NewTicketModal />
      </div>
    </Mro2FilterContext>
  );
}
