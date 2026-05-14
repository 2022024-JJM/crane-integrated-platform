// 한 센서의 점 클라우드를 그리는 r3f 컴포넌트.
// 마운트 시점에는 빈 BufferGeometry 만 둔다. 점 attribute 는 첫 프레임 도착 후
// 실제 sampledPointCount 크기로만 할당해 — 비전모니터링 진입 직후의 큰
// pre-allocation 비용을 없앤다. 점 수가 늘어나면 그때 한번 더 확장한다.
// intensity → RGB 변환은 256-entry LUT 로 setHSL 호출 제거. computeBoundingSphere
// 대신 parser 가 이미 계산한 bounds 로 직접 sphere 구성.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { POINT_SIZE_PX } from '../../lib/point-cloud/config';
import { usePointCloudStreamStore } from '../../model/point-cloud-stream-store';
import { writeIntensityColor, writeSolidColor } from './color-lut';

const DEG_TO_RAD = Math.PI / 180;
const tempColor = new THREE.Color();

interface SensorPointsProps {
  sensorKey: string;
  fallbackColorHex: string;
  /** mode 기반의 강제 hide. 사용자가 패널 체크박스로 끄면 store 의 isVisible 도 false 가 된다. */
  modeVisible: boolean;
}

export function SensorPoints({
  sensorKey,
  fallbackColorHex,
  modeVisible,
}: SensorPointsProps) {
  // geometry / material 은 컴포넌트 수명 동안 1회만 생성. attribute 는 첫 프레임
  // 에서 lazy 하게 채운다.
  const { geometry, material } = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setDrawRange(0, 0);
    const material = new THREE.PointsMaterial({
      size: POINT_SIZE_PX,
      vertexColors: true,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    return { geometry, material };
  }, []);

  // 현재 attribute 의 capacity (점 개수). 0 = 아직 할당 안 됨.
  const capacityRef = useRef(0);
  const lastSeenFrame = useRef(-1);
  const lastSeenTransform = useRef(-1);
  const pointsRef = useRef<THREE.Points>(null);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(() => {
    const buffer = usePointCloudStreamStore.getState().sensors.get(sensorKey);
    const points = pointsRef.current;
    if (!points) return;

    const effectiveVisible =
      modeVisible && Boolean(buffer?.isVisible) && Boolean(buffer?.parsed?.ok);
    points.visible = effectiveVisible;
    if (!buffer || !effectiveVisible) return;

    if (lastSeenTransform.current !== buffer.transformRevision) {
      lastSeenTransform.current = buffer.transformRevision;
      const t = buffer.transform;
      points.position.set(t.position.x, t.position.y, t.position.z);
      points.rotation.set(
        t.rotation.x * DEG_TO_RAD,
        t.rotation.y * DEG_TO_RAD,
        t.rotation.z * DEG_TO_RAD,
      );
      points.updateMatrix();
      points.updateMatrixWorld(true);
    }

    if (!buffer.parsed || !buffer.parsed.ok) return;
    const frameId = buffer.frameCounter;
    if (frameId === lastSeenFrame.current) return;
    lastSeenFrame.current = frameId;

    const parsed = buffer.parsed;
    const count = parsed.sampledPointCount;
    if (count <= 0) {
      geometry.setDrawRange(0, 0);
      return;
    }

    // 점 수가 현재 capacity 를 넘으면 attribute 를 (재)할당. 그렇지 않으면
    // 기존 array 에 in-place 로 덮어쓴다. 이렇게 하면 첫 프레임에서만 alloc 이
    // 발생하고 이후 frame 들은 같은 array 를 재사용한다.
    let positionAttr = geometry.getAttribute(
      'position',
    ) as THREE.BufferAttribute | null;
    let colorAttr = geometry.getAttribute(
      'color',
    ) as THREE.BufferAttribute | null;

    if (!positionAttr || !colorAttr || capacityRef.current < count) {
      const positionArray = new Float32Array(count * 3);
      const colorArray = new Float32Array(count * 3);
      positionAttr = new THREE.BufferAttribute(positionArray, 3);
      colorAttr = new THREE.BufferAttribute(colorArray, 3);
      positionAttr.usage = THREE.DynamicDrawUsage;
      colorAttr.usage = THREE.DynamicDrawUsage;
      geometry.setAttribute('position', positionAttr);
      geometry.setAttribute('color', colorAttr);
      capacityRef.current = count;
    }

    const positionArray = positionAttr.array as Float32Array;
    positionArray.set(parsed.positions.subarray(0, count * 3));
    positionAttr.needsUpdate = true;

    const colorArray = colorAttr.array as Float32Array;
    if (parsed.intensities) {
      const intensities = parsed.intensities;
      for (let i = 0; i < count; i += 1) {
        writeIntensityColor(colorArray, i * 3, intensities[i]);
      }
    } else {
      tempColor.set(fallbackColorHex);
      const r = tempColor.r;
      const g = tempColor.g;
      const b = tempColor.b;
      for (let i = 0; i < count; i += 1) {
        writeSolidColor(colorArray, i * 3, r, g, b);
      }
    }
    colorAttr.needsUpdate = true;

    geometry.setDrawRange(0, count);

    // parser 의 bounds 를 그대로 sphere 로 환산 — computeBoundingSphere 의 O(n) 회피.
    if (parsed.bounds) {
      const { min, max } = parsed.bounds;
      const cx = (min[0] + max[0]) * 0.5;
      const cy = (min[1] + max[1]) * 0.5;
      const cz = (min[2] + max[2]) * 0.5;
      const hx = max[0] - cx;
      const hy = max[1] - cy;
      const hz = max[2] - cz;
      const radius = Math.sqrt(hx * hx + hy * hy + hz * hz);
      const sphere = geometry.boundingSphere ?? new THREE.Sphere();
      sphere.center.set(cx, cy, cz);
      sphere.radius = radius;
      geometry.boundingSphere = sphere;
    }
  });

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      visible={modeVisible}
    />
  );
}
