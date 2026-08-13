import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Vector3 } from 'three';
import { useCollisionGuardStore } from '../model/use-collision-guard-store';

/**
 * 크레인 주목 → 충돌 감지 레이어 단방향 동기화.
 *
 * 현재 사용처 없음. 골리앗은 "토글이 유일한 진입 경로"로 전환했다 —
 * 카메라 조작으로도 켜지면 OFF 시 돌아갈 시점이 불분명해지고(진입
 * 시점이 사용자 의도가 아님), 복귀 플라이트가 사용자 드래그와 싸운다.
 * 자동 진입 UX를 되살릴 때를 위해 남겨 둔다.
 *
 * 사용자가 크레인을 화면 중심에 놓고 가까이 들여다보면(= 크레인에
 * 주목하면) 충돌 감지를 켠다. 켜진 뒤 시점을 옮겨도 꺼지지 않는다 —
 * 끄는 것은 수동 토글(Radar 버튼)의 몫이다.
 *
 * 판정 기준이 카메라 "각도"가 아니라 "무엇을 보고 있는가"인 이유:
 * 가드 ON 시의 에고 포즈가 순수 탑뷰가 아니라 기울인 부감(≈51°)이라,
 * 씬 저작 카메라(≈42°)와 각도가 비슷하다. 각도 임계로는 두 상태를
 * 구분할 수 없어 초기 로드가 곧바로 "진입"으로 판정되고, 이 훅은
 * 진입 에지에서만 켜므로 자동 진입이 영영 성립하지 않는다.
 *
 * - 크레인 중심으로부터 타깃까지의 거리 + 시거리(dolly)를 함께 본다.
 * - 히스테리시스로 경계에서의 판정 깜빡임을 막는다.
 * - 주목 진입 에지에서만 setEnabled(true)를 호출한다.
 */

interface ControlsLike {
  target: Vector3;
}

interface CollisionGuardTopViewSyncProps {
  /** 크레인 중심 (x, z) — 이 지점을 주목하면 가드를 켠다 */
  center: [number, number];
  /**
   * 주목 판정 반경 (씬 unit). 카메라 타깃이 크레인 중심에서 이 안에
   * 있고 시거리도 충분히 가까우면 "크레인에 주목"으로 본다.
   */
  focusRadius?: number;
  /** 주목으로 인정하는 최대 시거리 (씬 unit) */
  focusDistance?: number;
}

export function CollisionGuardTopViewSync({
  center,
  focusRadius = 90,
  focusDistance = 320,
}: CollisionGuardTopViewSyncProps) {
  const isFocusedRef = useRef<boolean | null>(null);

  useFrame((state) => {
    const controls = state.controls as ControlsLike | null;
    if (!controls?.target) return;

    const [cx, cz] = center;
    const targetDist = Math.hypot(
      controls.target.x - cx,
      controls.target.z - cz,
    );
    const camDist = state.camera.position.distanceTo(controls.target);

    // 히스테리시스: 켜질 때보다 꺼질 때를 관대하게(1.25배).
    const prev = isFocusedRef.current;
    const radius = prev ? focusRadius * 1.25 : focusRadius;
    const distance = prev ? focusDistance * 1.25 : focusDistance;
    const isFocused = targetDist < radius && camDist < distance;

    if (prev === null) {
      // 초기 판정: 로드 시점 상태를 그대로 기록만 한다. 저작 카메라가
      // 이미 크레인을 보고 있으면 켠 채로 시작하는 것이 자연스럽다.
      isFocusedRef.current = isFocused;
      const store = useCollisionGuardStore.getState();
      if (store.enabled !== isFocused) {
        store.setEnabled(isFocused);
      }
      return;
    }

    if (isFocused !== prev) {
      isFocusedRef.current = isFocused;
      // 단방향: 주목 진입에서만 켠다. 이탈해도 끄지 않는다.
      if (isFocused) {
        const store = useCollisionGuardStore.getState();
        if (!store.enabled) {
          store.setEnabled(true);
        }
      }
    }
  });

  return null;
}
