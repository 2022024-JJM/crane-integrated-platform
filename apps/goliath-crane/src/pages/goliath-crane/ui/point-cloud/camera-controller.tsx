import { useCallback, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CAMERA } from '../../lib/point-cloud/config';
import { usePointCloudStreamStore } from '../../model/point-cloud-stream-store';

const DEG_TO_RAD = Math.PI / 180;

interface CameraControllerProps {
  /** parent 가 호출하면 강제로 fit 을 다시 수행 (Refit 버튼 용도). */
  refitToken: number;
}

/**
 * 첫 프레임에 한해 모든 visible 센서의 bounds 합집합으로 카메라를 fit.
 * OrbitControls 가 한 번이라도 조작되면 fit 을 멈춘다 (참조 viewer.js 와 동일).
 * Refit 버튼이 누르면 userDirty 를 무시하고 한 번 더 fit.
 */
export function CameraController({ refitToken }: CameraControllerProps) {
  const { camera, controls } = useThree();
  const fittedRef = useRef(false);
  const userDirtyRef = useRef(false);
  const lastSeenFrameRef = useRef(-1);
  const lastRefitTokenRef = useRef(refitToken);

  useEffect(() => {
    const c = controls as unknown as
      | {
          addEventListener?: (type: string, fn: () => void) => void;
          removeEventListener?: (type: string, fn: () => void) => void;
        }
      | null;
    if (!c?.addEventListener) return;
    const onStart = () => {
      userDirtyRef.current = true;
    };
    c.addEventListener('start', onStart);
    return () => c.removeEventListener?.('start', onStart);
  }, [controls]);

  const tryFit = useCallback(
    (force: boolean) => {
      const sensors = usePointCloudStreamStore.getState().sensors;
      const box = new THREE.Box3();
      let hasPoints = false;
      const corner = new THREE.Vector3();

      for (const buf of sensors.values()) {
        if (!buf.isVisible) continue;
        if (!buf.parsed || !buf.parsed.ok || !buf.parsed.bounds) continue;
        // Transform 이 적용된 world bounds 를 사용.
        const matrix = new THREE.Matrix4().compose(
          new THREE.Vector3(
            buf.transform.position.x,
            buf.transform.position.y,
            buf.transform.position.z,
          ),
          new THREE.Quaternion().setFromEuler(
            new THREE.Euler(
              buf.transform.rotation.x * DEG_TO_RAD,
              buf.transform.rotation.y * DEG_TO_RAD,
              buf.transform.rotation.z * DEG_TO_RAD,
            ),
          ),
          new THREE.Vector3(1, 1, 1),
        );
        const { min, max } = buf.parsed.bounds;
        for (const x of [min[0], max[0]]) {
          for (const y of [min[1], max[1]]) {
            for (const z of [min[2], max[2]]) {
              corner.set(x, y, z).applyMatrix4(matrix);
              box.expandByPoint(corner);
              hasPoints = true;
            }
          }
        }
      }
      if (!hasPoints) return false;

      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const dominant = Math.max(size.x, size.y, size.z, 1);
      const offset = new THREE.Vector3(1, 1, 1)
        .normalize()
        .multiplyScalar(dominant * 1.6);

      camera.position.copy(center.clone().add(offset));
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.near = Math.max(0.1, dominant / 200);
        camera.far = Math.max(CAMERA.far, dominant * 50);
        camera.updateProjectionMatrix();
      }
      const ctrl = controls as unknown as
        | { target?: THREE.Vector3; update?: () => void }
        | null;
      if (ctrl?.target) {
        ctrl.target.copy(center);
        ctrl.update?.();
      } else {
        camera.lookAt(center);
      }
      if (force) {
        userDirtyRef.current = false;
      }
      return true;
    },
    [camera, controls],
  );

  // 외부 Refit 트리거.
  useEffect(() => {
    if (refitToken === lastRefitTokenRef.current) return;
    lastRefitTokenRef.current = refitToken;
    const ok = tryFit(true);
    if (ok) fittedRef.current = true;
  }, [refitToken, tryFit]);

  // 첫 프레임 auto-fit.
  useFrame(() => {
    if (fittedRef.current || userDirtyRef.current) return;
    const counter = usePointCloudStreamStore.getState().globalFrameCounter;
    if (counter === lastSeenFrameRef.current) return;
    lastSeenFrameRef.current = counter;

    if (tryFit(false)) {
      fittedRef.current = true;
    }
  });

  return null;
}
