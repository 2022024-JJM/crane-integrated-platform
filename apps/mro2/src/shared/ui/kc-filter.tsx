import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { KC } from './kc';

/** 좌측 필터 레일 */
export function KcFilterRail({
  selectedCount,
  onClear,
  children,
}: {
  selectedCount?: number;
  onClear?: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation('mro2');
  return (
    <aside className="w-[168px] shrink-0">
      <div className="mb-1 text-[12px] font-bold" style={{ color: KC.ink }}>
        {selectedCount ? t('common.filterSelected', { count: selectedCount }) : t('common.filter')}
      </div>
      <button
        type="button"
        onClick={onClear}
        className="mb-3 block cursor-pointer text-[11px]"
        style={{ color: KC.link }}
      >
        {t('common.clearFilter')}
      </button>
      <div className="flex flex-col gap-3">{children}</div>
    </aside>
  );
}

/** 필터 그룹 (접이식) */
export function KcFilterGroup({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b pb-2" style={{ borderColor: KC.hairline }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between py-1 text-left text-[11.5px] font-bold"
        style={{ color: KC.ink }}
      >
        {title}
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open ? <div className="mt-1 flex flex-wrap gap-1">{children}</div> : null}
    </div>
  );
}

/** 필터 칩 — 좌측 색 보더 + 회색 박스 (Service Status 칩 스타일) */
export function KcFilterChip({
  label,
  tone,
  active,
  onClick,
}: {
  label: string;
  /** 좌측 보더 색 (상태 의미색) — 없으면 무채색 칩 */
  tone?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-[3px] px-1.5 py-0.5 text-[11px]"
      style={{
        background: active ? KC.accent : KC.bgRow,
        color: active ? '#fff' : KC.text,
        borderLeft: tone ? `3px solid ${tone}` : undefined,
      }}
    >
      {label}
    </button>
  );
}
