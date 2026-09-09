import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { isScenePerfHudEnabled, scenePerfStore } from '../model/scene-perf-store';

/**
 * dev 성능 HUD 의 기록자 — Canvas 안 null 렌더 컴포넌트.
 *
 * useFrame 은 gl.render '이전'에 돌고 info.reset() 은 render() 내부 선두라
 * (shadow-invalidation.ts 의 소비 시점 주석과 같은 순서 근거), 여기서 읽는
 * gl.info.render.{calls,triangles} 는 **직전 프레임의 완결값**이다 — 1프레임
 * 지연이지만 HUD 용도로 정확하다. shadow pass 드로우콜이 포함되므로 정적
 * 리포트(scripts/scene-perf-report.mjs)보다 크게 나오는 것이 정상이다.
 *
 * setState 는 0회 — 기록은 scenePerfStore(mutable 싱글턴)에만 쓰고, 표시는
 * ScenePerfHud 가 저주기 폴링으로 가져간다(useFrame 내 setState 금지 규약).
 * 활성 조건은 스스로 판정한다(enabled prop 없음) — 배선하는 화면이 조건을
 * 복제하지 않게 하려는 것이고, 비활성이면 useFrame 에서 즉시 return 한다.
 */
export function ScenePerfProbe() {
  const enabled = isScenePerfHudEnabled();

  // 마운트 시 기준 시각 리셋 — 이전 캔버스가 남긴 시각으로 첫 dt 가
  // 거대값이 되어 worst 창을 1초간 오염시키는 것을 막는다.
  useEffect(() => {
    if (!enabled) return;
    scenePerfStore.reset();
  }, [enabled]);

  useFrame((state) => {
    if (!enabled) return;
    scenePerfStore.record(
      performance.now(),
      state.gl.info.render.calls,
      state.gl.info.render.triangles,
      readHeapBytes(),
    );
  });

  return null;
}

/** Chrome 전용 비표준 performance.memory — 존재 가드, 타 브라우저는 null. */
function readHeapBytes(): number | null {
  const memory = (
    performance as Performance & { memory?: { usedJSHeapSize: number } }
  ).memory;
  return memory ? memory.usedJSHeapSize : null;
}
