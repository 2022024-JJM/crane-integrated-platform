import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { KC } from './kc';

/** 접이식 섹션 — 13px 볼드 타이틀 + 헤어라인 하단 (service-plan/SR 상세 공용) */
export function KcSection({
  title,
  defaultOpen = true,
  right,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  /** 타이틀 우측 슬롯 (상태 뱃지 등) */
  right?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4 border-b pb-3" style={{ borderColor: KC.hairline }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between py-1 text-left"
      >
        <span className="text-[13px] font-bold" style={{ color: KC.ink }}>
          {title}
        </span>
        <span className="flex items-center gap-2">
          {right}
          {open ? (
            <ChevronUp size={14} style={{ color: KC.ink }} />
          ) : (
            <ChevronDown size={14} style={{ color: KC.ink }} />
          )}
        </span>
      </button>
      {open ? <div className="pt-2">{children}</div> : null}
    </div>
  );
}
