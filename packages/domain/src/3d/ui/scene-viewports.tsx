import { createPortal } from '@react-three/fiber';
import type { ThreeElements } from '@react-three/fiber';
import { Fragment, useState, type ReactNode } from 'react';
import type { Group, Object3D } from 'three';
import {
  useSceneViewports,
  type SceneViewport,
} from '../model/scene-viewports-context';

/**
 * 포털 key — 뷰포트 크기가 바뀌면 포털을 다시 만든다. R3F Portal 은 state
 * 오버라이드(size)를 만들 때 한 번 읽고 루트 상태가 바뀔 때만 다시 합치므로,
 * 크기 변경을 확실히 반영하려면 재마운트가 맞다(리사이즈는 드물다). 컨테이너
 * uuid 도 넣는다 — Portal 이 컨테이너 교체 시 이전 노드에 붙는 문제
 * (model-selection-box.tsx 주석)를 key 가 막는다.
 */
function portalKey(viewport: SceneViewport, container: Object3D): string {
  return `${viewport.key}:${container.uuid}:${viewport.size.width}x${viewport.size.height}`;
}

/**
 * 뷰포트마다 복제해 그리는 자식 — 단일 화면이면 `children(null)` 을 그 자리에
 * 한 번, 분할이면 타일마다 `container` 아래로 포털한다(씬 그래프 상속은
 * 그대로라 리그·기즈모를 따라간다). `container` 가 아직 없으면(첫 렌더 전)
 * 분할에서는 아무것도 그리지 않는다. 뷰포트 정의는 model/scene-viewports-context.
 */
export function PerViewport({
  container,
  children,
}: {
  container: Object3D | null;
  children: (viewport: SceneViewport | null) => ReactNode;
}) {
  const viewports = useSceneViewports();
  if (viewports === null) return <>{children(null)}</>;
  if (!container) return null;
  return (
    <>
      {viewports.map((viewport) => (
        <Fragment key={portalKey(viewport, container)}>
          {createPortal(children(viewport), container, {
            camera: viewport.camera,
            size: viewport.size,
          })}
        </Fragment>
      ))}
    </>
  );
}

/**
 * 자기 group 을 컨테이너로 쓰는 `PerViewport` — 표시가 스스로 만든 group 에
 * 매달릴 때(충돌 표지·영역 배지·눈금 숫자). group props 는 그대로 넘긴다.
 */
export function ViewportAnchor({
  children,
  ...groupProps
}: Omit<ThreeElements['group'], 'children' | 'ref'> & {
  children: (viewport: SceneViewport | null) => ReactNode;
}) {
  const [group, setGroup] = useState<Group | null>(null);
  return (
    <group ref={setGroup} {...groupProps}>
      <PerViewport container={group}>{children}</PerViewport>
    </group>
  );
}
