import type { ReactNode } from 'react';
import { KC } from './kc';

/** 표준 엠프티 스테이트 — 목록/테이블이 0건일 때 (py-8 · 12px · 중앙) */
export function KcEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="py-8 text-center text-[12px]" style={{ color: KC.muted }}>
      {children}
    </div>
  );
}
