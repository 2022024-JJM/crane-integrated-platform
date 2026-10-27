import { lazy, Suspense } from 'react';
import type { CraneType } from '@crane/domain/asset';
import { KC } from '../../../shared/ui/kc';
import { CraneIcon } from '../../../shared/ui/crane-icon';
import {
  useRenderClaim,
  useThumbSnapshot,
} from '../model/thumb-snapshot-store';

// three.js는 자산 페이지 진입 시에만 로드되도록 lazy 분리
const CraneThumbScene = lazy(() => import('./crane-thumb-scene'));

function ThumbFallback({
  craneType,
  size,
}: {
  craneType: CraneType;
  size: number;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <CraneIcon type={craneType} size={Math.round(size * 0.48)} />
    </div>
  );
}

/**
 * 자산 원형 3D 썸네일 — 동그라미 안에 크레인 오브젝트를 정면 고정 표시.
 * 종류별 첫 썸네일만 WebGL 로 그려 이미지를 캐시에 올리고, 나머지는 그 이미지를
 * 쓴다 — 카드 100장이어도 WebGL 컨텍스트는 종류 수만큼만, 그것도 잠깐 뜬다.
 */
export function CraneThumb({
  craneType,
  size = 56,
}: {
  craneType: CraneType;
  size?: number;
}) {
  const snapshot = useThumbSnapshot(craneType);
  // 종류별로 하나만 캔버스를 띄운다 — 스냅샷이 오면 img 로 바뀌며 캔버스는 내려간다
  const renderer = useRenderClaim(craneType);

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
      {snapshot ? (
        <img
          src={snapshot}
          alt=""
          draggable={false}
          className="h-full w-full object-cover"
        />
      ) : (
        <>
          <ThumbFallback craneType={craneType} size={size} />
          {renderer ? (
            <div className="absolute inset-0 opacity-0">
              <Suspense fallback={null}>
                <CraneThumbScene craneType={craneType} />
              </Suspense>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
