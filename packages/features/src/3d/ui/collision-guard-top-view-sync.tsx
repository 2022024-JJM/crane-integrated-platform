import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Vector3 } from 'three';
import { useCollisionGuardStore } from '../model/use-collision-guard-store';

/**
 * 탑뷰 → 충돌 감지 레이어 단방향 동기화.
 *
 * 카메라가 타깃 바로 위에서 내려다보면(폴라각 ≈ 0) 탑뷰로 간주해
 * 충돌 감지를 켠다. 켜진 뒤 각도를 바꿔 탑뷰를 벗어나도 꺼지지 않는다 —
 * 끄는 것은 수동 토글(Radar 버튼)의 몫이다. 초기 로드 시에는 저작 카메라
 * (비탑뷰)이므로 꺼진 상태로 시작한다.
 *
 * - 히스테리시스(ON 0.25rad / OFF 0.4rad)로 경계 각도에서의 판정 깜빡임 방지.
 * - 탑뷰 진입 에지에서만 setEnabled(true)를 호출한다.
 */

/** 이 폴라각(rad) 미만이면 탑뷰 진입으로 간주 */
const TOP_VIEW_ENTER_POLAR = 0.25;
/** 이 폴라각(rad) 초과면 탑뷰 이탈로 간주 */
const TOP_VIEW_EXIT_POLAR = 0.4;

interface ControlsLike {
  target: Vector3;
}

export function CollisionGuardTopViewSync() {
  const isTopViewRef = useRef<boolean | null>(null);

  useFrame((state) => {
    const controls = state.controls as ControlsLike | null;
    if (!controls?.target) return;

    const dx = state.camera.position.x - controls.target.x;
    const dy = state.camera.position.y - controls.target.y;
    const dz = state.camera.position.z - controls.target.z;
    // 0 = 타깃 바로 위에서 수직으로 내려다보는 각도.
    const polar = Math.atan2(Math.hypot(dx, dz), dy);

    const prev = isTopViewRef.current;
    const isTopView = prev
      ? polar < TOP_VIEW_EXIT_POLAR
      : polar < TOP_VIEW_ENTER_POLAR;

    if (prev === null) {
      // 초기 판정: 탑뷰가 아니면 꺼진 상태로 시작 (씬 저작 카메라 존중).
      isTopViewRef.current = isTopView;
      const store = useCollisionGuardStore.getState();
      if (store.enabled !== isTopView) {
        store.setEnabled(isTopView);
      }
      return;
    }

    if (isTopView !== prev) {
      isTopViewRef.current = isTopView;
      // 단방향: 탑뷰 진입에서만 켠다. 이탈해도 끄지 않는다.
      if (isTopView) {
        const store = useCollisionGuardStore.getState();
        if (!store.enabled) {
          store.setEnabled(true);
        }
      }
    }
  });

  return null;
}
