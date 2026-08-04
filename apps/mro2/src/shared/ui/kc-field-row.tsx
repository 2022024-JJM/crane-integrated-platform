import type { ReactNode } from 'react';
import { KC } from './kc';

/** "라벨: 값" 정보 행 — 페이지마다 제각각이던 밀도를 11.5px 한 벌로 통일 */
export function KcFieldRow({
  k,
  v,
  labelWidth = 150,
}: {
  k: string;
  v: ReactNode;
  /** 라벨 칼럼 폭(px) — 긴 라벨 페이지만 넓힌다 */
  labelWidth?: number;
}) {
  return (
    <div className="flex py-1 text-[11.5px]">
      <span className="shrink-0 font-bold" style={{ color: KC.ink, width: labelWidth }}>
        {k}:
      </span>
      <span className="min-w-0 break-words" style={{ color: KC.text }}>
        {v}
      </span>
    </div>
  );
}
