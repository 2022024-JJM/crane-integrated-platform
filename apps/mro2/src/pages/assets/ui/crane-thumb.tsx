import { lazy, Suspense } from 'react';
import type { CraneType } from '@crane/domain/asset';
import { KC } from '../../../shared/ui/kc';
import { CraneIcon } from './crane-icon';

// three.js는 자산 페이지 진입 시에만 로드되도록 lazy 분리
const CraneThumbScene = lazy(() => import('./crane-thumb-scene'));

function ThumbFallback({ craneType, size }: { craneType: CraneType; size: number }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <CraneIcon type={craneType} size={Math.round(size * 0.48)} />
    </div>
  );
}

/** 자산 원형 3D 썸네일 — 동그라미 안에 크레인 오브젝트를 정면 고정 표시 */
export function CraneThumb({
  craneType,
  size = 56,
}: {
  craneType: CraneType;
  size?: number;
}) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, ${KC.bgRow}, ${KC.bgSubtle})`,
        border: `1px solid ${KC.border}`,
      }}
      aria-hidden
    >
      <Suspense fallback={<ThumbFallback craneType={craneType} size={size} />}>
        <CraneThumbScene craneType={craneType} />
      </Suspense>
    </div>
  );
}
