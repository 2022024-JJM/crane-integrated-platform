import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Grid3x3, Search, Wrench } from 'lucide-react';
import { useAssetList } from '@crane/features/asset';
import { useInspectionList } from '@crane/features/inspection';
import { useMaintenanceList } from '@crane/features/maintenance';
import { KC, KC_FONT_MONO } from './kc';

interface SearchHit {
  key: string;
  kind: 'asset' | 'sr';
  title: string;
  subtitle: string;
  path: string;
}

const MAX_ASSETS = 4;
const MAX_SRS = 6;

/**
 * 전역 검색 (매뉴얼 3p 상단 돋보기) — 자산과 서비스 요청을 한 입력으로 찾는다.
 * 키보드: ↑/↓ 이동, Enter 이동, Esc 닫기.
 */
export function Mro2GlobalSearch() {
  const { t } = useTranslation('mro2');
  const navigate = useNavigate();
  const { assets } = useAssetList();
  const { inspections } = useInspectionList();
  const { repairs } = useMaintenanceList();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 바깥 클릭으로 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const hits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const assetHits: SearchHit[] = assets
      .filter((a) => a.name.toLowerCase().includes(q) || a.model.toLowerCase().includes(q))
      .slice(0, MAX_ASSETS)
      .map((a) => ({
        key: `a-${a.id}`,
        kind: 'asset',
        title: a.name,
        subtitle: a.model,
        path: `/mro2/assets/${a.id}`,
      }));
    const srHits: SearchHit[] = [
      ...inspections.map((w) => ({
        key: `i-${w.id}`,
        kind: 'sr' as const,
        title: w.woNumber,
        subtitle: w.craneName,
        path: `/mro2/service-requests/inspection/${w.id}`,
      })),
      ...repairs.map((w) => ({
        key: `r-${w.id}`,
        kind: 'sr' as const,
        title: w.woNumber,
        subtitle: `${w.craneName} · ${w.componentName}`,
        path: `/mro2/service-requests/repair/${w.id}`,
      })),
    ]
      .filter((h) => h.title.toLowerCase().includes(q) || h.subtitle.toLowerCase().includes(q))
      .slice(0, MAX_SRS);
    return [...assetHits, ...srHits];
  }, [query, assets, inspections, repairs]);

  const go = (hit: SearchHit) => {
    setOpen(false);
    setQuery('');
    navigate(hit.path);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open || hits.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + hits.length) % hits.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = hits[Math.min(active, hits.length - 1)];
      if (hit) go(hit);
    }
  };

  const sections: Array<{ kind: SearchHit['kind']; label: string }> = [
    { kind: 'asset', label: t('nav.assets') },
    { kind: 'sr', label: t('nav.serviceRequests') },
  ];

  return (
    <div ref={rootRef} className="relative">
      <div
        className="flex items-center gap-1.5 border px-2 py-1"
        style={{ borderColor: KC.border, background: KC.bg }}
      >
        <Search size={13} style={{ color: KC.muted }} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
          className="w-[200px] bg-transparent text-[11.5px]"
          style={{ color: KC.ink }}
        />
      </div>

      {open && query.trim() ? (
        <div
          className="absolute right-0 z-50 mt-1 w-[300px] border shadow-lg"
          style={{ borderColor: KC.border, background: KC.bg }}
        >
          {hits.length === 0 ? (
            <div className="px-3 py-3 text-[11px]" style={{ color: KC.muted }}>
              {t('search.noResults')}
            </div>
          ) : (
            sections.map(({ kind, label }) => {
              const group = hits.filter((h) => h.kind === kind);
              if (group.length === 0) return null;
              return (
                <div key={kind}>
                  <div
                    className="px-3 pt-2 pb-1 text-[9.5px] font-bold tracking-wider uppercase"
                    style={{ color: KC.faint }}
                  >
                    {label}
                  </div>
                  {group.map((hit) => {
                    const idx = hits.indexOf(hit);
                    return (
                      <button
                        key={hit.key}
                        type="button"
                        onClick={() => go(hit)}
                        onMouseEnter={() => setActive(idx)}
                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left"
                        style={{ background: idx === active ? KC.hover : 'transparent' }}
                      >
                        {hit.kind === 'asset' ? (
                          <Grid3x3 size={12} style={{ color: KC.muted }} />
                        ) : (
                          <Wrench size={12} style={{ color: KC.muted }} />
                        )}
                        <span className="min-w-0 flex-1">
                          <span
                            className="block truncate text-[11.5px]"
                            style={{ color: KC.ink, fontFamily: hit.kind === 'sr' ? KC_FONT_MONO : undefined }}
                          >
                            {hit.title}
                          </span>
                          <span className="block truncate text-[10px]" style={{ color: KC.muted }}>
                            {hit.subtitle}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
