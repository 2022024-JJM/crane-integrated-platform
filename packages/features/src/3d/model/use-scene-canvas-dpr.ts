import { useMemo, useSyncExternalStore } from 'react';
import {
  getDevicePixelRatio,
  subscribeDevicePixelRatio,
} from '../lib/device-pixel-ratio';
import { resolveSceneDpr } from '../lib/scene-dpr';
import { useSceneGraphicsStore } from './use-scene-graphics-store';

const getServerDevicePixelRatio = () => 1;

/**
 * 씬 캔버스의 `dpr` — 기본 범위에 이 PC 의 해상도 배율(설정 페이지)을 얹은
 * 값. 모니터링·3D 플레이·에디터 캔버스가 같은 훅을 쓴다.
 *
 * 배율이 1 미만이면 기기 값에 곱한 숫자를 넘기므로 기기 값의 변화(모니터
 * 이동·브라우저 확대)를 직접 듣는다 — 숫자 dpr 은 R3F 가 다시 계산하지
 * 않는다. 값이 같으면 같은 참조를 돌려줘 Canvas prop 이 흔들리지 않는다.
 */
export function useSceneCanvasDpr(): number | [number, number] {
  const renderScale = useSceneGraphicsStore((s) => s.renderScale);
  const devicePixelRatio = useSyncExternalStore(
    subscribeDevicePixelRatio,
    getDevicePixelRatio,
    getServerDevicePixelRatio,
  );
  return useMemo(
    () => resolveSceneDpr(devicePixelRatio, renderScale),
    [devicePixelRatio, renderScale],
  );
}
