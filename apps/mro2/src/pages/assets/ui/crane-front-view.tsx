import { lazy, Suspense } from 'react';
import type { CraneType } from '@crane/domain/asset';
import { KC } from '../../../shared/ui/kc';
import { CraneIcon } from '../../../shared/ui/crane-icon';

// three.js는 필요한 시점에만 로드되도록 lazy 분리 (썸네일과 동일한 방식)
const CraneFrontViewScene = lazy(() => import('./crane-front-view-scene'));

function FrontFallback({ craneType }: { craneType: CraneType }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <CraneIcon type={craneType} size={72} />
    </div>
  );
}

/**
 * 자산 정보 탭의 정면 3D 뷰 — 회전/조작 없이 크레인 형상만 보여준다.
 * (조작이 필요하면 3D 탭의 뷰어를 쓴다)
 *
 * fill=true면 부모 높이를 꽉 채운다. 좌우 2단 배치에서 반대편 표와 높이를
 * 맞추기 위한 모드이며, 이때 부모가 높이를 정해줘야 한다(grid items-stretch 등).
 */
export function CraneFrontView({
  craneType,
  caption,
  height = 300,
  fill = false,
}: {
  craneType: CraneType;
  caption?: string;
  height?: number;
  fill?: boolean;
}) {
  return (
    <figure className={`m-0 ${fill ? 'flex h-full flex-col' : ''}`}>
      <div
        className={`relative w-full overflow-hidden rounded-[4px] ${fill ? 'min-h-[280px] flex-1' : ''}`}
        style={{
          height: fill ? undefined : height,
          background: `radial-gradient(circle at 50% 35%, ${KC.bgRow}, ${KC.bgSubtle})`,
          border: `1px solid ${KC.border}`,
        }}
        aria-hidden
      >
        <Suspense fallback={<FrontFallback craneType={craneType} />}>
          <CraneFrontViewScene craneType={craneType} />
        </Suspense>
      </div>
      {caption ? (
        <figcaption className="mt-1.5 shrink-0 text-center text-[10.5px]" style={{ color: KC.faint }}>
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
