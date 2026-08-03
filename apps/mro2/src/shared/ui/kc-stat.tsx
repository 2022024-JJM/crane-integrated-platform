import type { ReactNode } from 'react';
import { KC, KC_FONT_DISPLAY } from './kc';

/** 큰 숫자 + 라벨 + 색 언더라인 (3-스탯 트리오의 벽돌) */
export function KcStat({
  value,
  label,
  tone = 'var(--kc-track)',
  size = 'md',
}: {
  value: ReactNode;
  label: string;
  /** 언더라인 색 */
  tone?: string;
  size?: 'md' | 'lg';
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-1">
      <span
        className={size === 'lg' ? 'text-[26px] leading-8' : 'text-[20px] leading-7'}
        style={{ color: KC.ink, fontWeight: 700, fontFamily: KC_FONT_DISPLAY }}
      >
        {value}
      </span>
      <span
        className="border-b-[3px] pb-0.5 text-center text-[10.5px] leading-tight whitespace-pre-line"
        style={{ borderColor: tone, color: KC.muted }}
      >
        {label}
      </span>
    </div>
  );
}
