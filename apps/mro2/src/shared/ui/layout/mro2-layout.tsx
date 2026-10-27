import '../kc-theme.css';
import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useIsMobile } from '@crane/core/lib/use-is-mobile';
import { resetPersisted } from '@crane/domain/shared';
import { Clock } from 'lucide-react';
import { KC } from '../kc';
import { NewTicketModal } from '../new-ticket-modal';
import { Mro2GlobalSearch } from '../global-search';
import { Mro2FilterContext, MRO2_YEARS } from './mro2-year-context';
import { Mro2Alerts } from './mro2-alerts';

/* ── 레이아웃 본체 ──────────────────────────────────────────────────────
 * 헤더/햄버거 사이드바는 기존 MRO와 동일하게 shell의 AppLayout이 담당한다.
 * 여기서는 MRO2 콘텐츠 래핑(서체·컬러)과 연도 컨텍스트만 제공한다. */

const FIELD_PREFIX = '/mro2/field';
/** 자동으로 현장 모드에 보내진 경우 원래 경로 — 넓어지면 거기로 되돌린다. */
const RETURN_KEY = 'mro2.field.returnTo';

/**
 * 휴대폰(현장)은 포털이 아니라 현장 모드로 — 목록·차트가 아니라 등록이
 * 목적이다. 창이 다시 넓어지면 자동으로 보내진 경우에만 원래 화면으로
 * 되돌린다(메뉴에서 직접 연 현장 모드는 그대로). 데스크톱에서도
 * `/mro2/field` 로 직접 열 수 있다.
 */
/** `?reset=1` — 브라우저에 남긴 데모 데이터를 지우고 시드로 돌아간다(새로고침). */
function PersistedReset() {
  const { search } = useLocation();
  useEffect(() => {
    if (!new URLSearchParams(search).has('reset')) return;
    resetPersisted();
    const url = new URL(window.location.href);
    url.searchParams.delete('reset');
    window.location.replace(url.toString());
  }, [search]);
  return null;
}

function FieldRedirect() {
  const isMobile = useIsMobile();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const onField = pathname.startsWith(FIELD_PREFIX);
  useEffect(() => {
    if (isMobile && !onField) {
      sessionStorage.setItem(RETURN_KEY, pathname + search);
      navigate(FIELD_PREFIX, { replace: true });
      return;
    }
    if (!isMobile && onField) {
      const back = sessionStorage.getItem(RETURN_KEY);
      if (back) {
        sessionStorage.removeItem(RETURN_KEY);
        navigate(back, { replace: true });
      }
    }
  }, [isMobile, onField, pathname, search, navigate]);
  return null;
}

export function Mro2Layout() {
  const [year, setYear] = useState(2026);
  const filter = useMemo(() => ({ year, setYear }), [year]);
  const onField = useLocation().pathname.startsWith(FIELD_PREFIX);

  return (
    <Mro2FilterContext value={filter}>
      <div
        className="mro2-root min-h-full"
        style={{ background: KC.bg, color: KC.text }}
      >
        <PersistedReset />
        <FieldRedirect />
        {/* 콘텐츠 툴바: 전역 검색 + 기간(연도) 셀렉터 — 현장 모드엔 없다 */}
        {onField ? null : (
          <div className="flex items-center justify-end gap-4 px-3 pt-2.5 md:px-5">
            <Mro2Alerts />
            <Mro2GlobalSearch />
            <label
              className="flex cursor-pointer items-center gap-1 text-[13px]"
              style={{ color: KC.ink }}
            >
              <Clock size={14} />
              <select
                aria-label="Time frame"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="cursor-pointer bg-transparent text-[13px]"
                style={{ color: KC.ink }}
              >
                {MRO2_YEARS.map((y) => (
                  <option
                    key={y}
                    value={y}
                    style={{ background: KC.bg, color: KC.ink }}
                  >
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

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
