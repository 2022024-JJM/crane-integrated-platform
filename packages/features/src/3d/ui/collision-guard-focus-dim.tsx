import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Light } from 'three';
import { useCollisionGuardStore } from '../model/use-collision-guard-store';

/**
 * 포커스 디밍 — 충돌 감지 레이어가 켜지면 씬 조명을 낮춰 밝은 주간 맵을
 * 어두운 무대로 바꾼다 (테슬라 FSD의 다크 스테이지 원리).
 *
 * 감지 링·마커·림 글로우·스캔 밴드는 전부 이미시브 기반이라 조명 감쇠의
 * 영향을 받지 않는다 — 맵만 가라앉고 감지 레이어가 도드라진다.
 * 전환은 지수 감쇠로 부드럽게, 언마운트 시 원래 밝기로 복원한다.
 */

/** 가드 ON 시 조명 배율 — 다크 스테이지가 될 만큼 깊게 */
const DIM_LEVEL = 0.12;
/** 전환 시상수 (s) */
const DIM_TAU = 0.35;

interface TrackedLight {
  light: Light;
  base: number;
}

export function CollisionGuardFocusDim() {
  const enabled = useCollisionGuardStore((s) => s.enabled);
  const lightsRef = useRef<TrackedLight[] | null>(null);
  const levelRef = useRef(1);

  useFrame((state, delta) => {
    if (lightsRef.current === null) {
      const lights: TrackedLight[] = [];
      state.scene.traverse((object) => {
        const light = object as Light;
        if (light.isLight) {
          lights.push({ light, base: light.intensity });
        }
      });
      lightsRef.current = lights;
    }

    const target = enabled ? DIM_LEVEL : 1;
    const level = levelRef.current;
    if (level === target) return;

    const k = 1 - Math.exp(-Math.min(delta, 0.1) / DIM_TAU);
    let next = level + (target - level) * k;
    if (Math.abs(next - target) < 0.004) next = target;
    levelRef.current = next;

    for (const { light, base } of lightsRef.current) {
      light.intensity = base * next;
    }
  });

  // 언마운트 시 원래 밝기로 복원.
  useEffect(
    () => () => {
      lightsRef.current?.forEach(({ light, base }) => {
        light.intensity = base;
      });
    },
    [],
  );

  return null;
}
