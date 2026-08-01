import type { ReactNode } from 'react';
import { KC, KC_FONT_DISPLAY } from './kc';

/** 섹션 헤딩 (헤어라인 하단) */
export function KcSectionHeading({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between border-b pb-1.5" style={{ borderColor: KC.borderStrong }}>
      <h2
        className="text-[18px] font-semibold tracking-wide"
        style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}
      >
        {children}
      </h2>
      {right}
    </div>
  );
}
