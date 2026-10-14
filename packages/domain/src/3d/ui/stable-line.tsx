import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Color } from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 굵은 선(Line2) — drei `<Line>` 대신 쓴다. drei 는 points 가 바뀔 때마다
 * geometry 와 **함께 material 을 dispose** 하고는 같은 material 을 계속
 * 쓰므로 three 가 다음 프레임에 셰이더를 다시 링크한다(수신 중 실측 초당
 * 3~4회, 끝점이 움직이는 근접 거리 선에서). 여기서는 material·geometry 가
 * 마운트 동안 하나고 points 는 `setPositions` 로만 갱신한다.
 */
// 훅이 돌려준 객체를 effect 에서 직접 고치지 않는다(react-hooks/immutability)
// — scene-water 의 applyWaterLook 과 같은 선례로 평범한 함수가 쓴다.
function applyLineLook(
  material: LineMaterial,
  color: string,
  lineWidth: number,
  depthTest: boolean,
): void {
  material.color = new Color(color);
  material.linewidth = lineWidth;
  material.depthTest = depthTest;
  material.transparent = !depthTest;
}

function applyRenderOrder(line: Line2, renderOrder: number): void {
  if (line.renderOrder !== renderOrder) line.renderOrder = renderOrder;
}

export function StableLine({
  points,
  color,
  lineWidth = 1,
  depthTest = true,
  renderOrder = 0,
}: {
  points: readonly Vector3Tuple[];
  color: string;
  /** 화면 px. */
  lineWidth?: number;
  depthTest?: boolean;
  renderOrder?: number;
}) {
  const size = useThree((s) => s.size);
  const { line, material, geometry } = useMemo(() => {
    const geometry = new LineGeometry();
    const material = new LineMaterial({ worldUnits: false });
    const line = new Line2(geometry, material);
    line.raycast = () => {};
    line.frustumCulled = false;
    return { line, material, geometry };
  }, []);

  useEffect(() => {
    geometry.setPositions(points.flat() as number[]);
    line.computeLineDistances();
  }, [geometry, line, points]);

  useEffect(() => {
    applyLineLook(material, color, lineWidth, depthTest);
  }, [material, color, lineWidth, depthTest]);

  useEffect(() => {
    material.resolution.set(size.width, size.height);
  }, [material, size.width, size.height]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(() => {
    applyRenderOrder(line, renderOrder);
  });

  return <primitive object={line} />;
}
