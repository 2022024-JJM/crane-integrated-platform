import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import {
  extendAnimationGrace,
  governorIntervalMs,
  resolveGovernorFps,
} from '../lib/frame-governor';
import { useActiveTransformStore } from '../model/use-active-transform-store';
import { useRealtimeStore } from '../model/use-realtime-store';
import { useReplayPlayerStore } from '../model/use-replay-player-store';
import { useVirtualTagStore } from '../model/use-virtual-tag-store';

/** 애니메이션 소스 상태를 다시 읽는 주기(ms). 유예(1.5s)보다 충분히 짧다. */
const POLL_MS = 250;
/**
 * 실시간 수신을 "움직이는 중" 으로 보는 창(ms) — 마지막 메시지가 이 안이면
 * 활성. isRunning 은 연결 시도 중에도 true 라 서버가 없거나 끊기면 30fps 가
 * 헛돌기 때문에 실제 수신 시각으로 판정한다.
 */
const REALTIME_ACTIVE_MS = 1500;

interface SceneFrameGovernorProps {
  /**
   * 호출자가 아는 상시 애니메이션 — 바다(EXR 배경) 씬은 파도가 항상
   * 움직인다. 스토어로 알 수 없는 소스는 여기로 준다.
   */
  animating?: boolean;
  /** 느린 변화 소스(solar 모드 태양)가 있는지. */
  slow?: boolean;
}

/**
 * 프레임 거버너 — `frameloop='demand'` 캔버스에서 프레임을 만드는 유일한
 * 상시 틱. 판정은 lib/frame-governor(테스트 대상), 여기는 배선만이다.
 *
 * 애니메이션 소스는 스토어를 직접 읽는다(구독이 아니라 폴링 — 재생 토글이
 * React 리렌더를 일으키지 않게): 가상 태그 재생, 실시간 수신(최근 메시지
 * 기준), 리플레이 재생, 기즈모 드래그. 멈춘 뒤 ANIMATION_GRACE_MS 동안
 * 유예해 스무딩이 정착한다.
 *
 * 조작(궤도·휠·기즈모)은 각 컨트롤이 스스로 invalidate 하므로 세지 않는다.
 * 틱은 setInterval — rAF 로 돌리면 틱 자체가 주사율로 깨어 판정 비용이
 * 생기고, 간격 타이머는 R3F 가 다음 vsync 에 맞춰 그리므로 30fps 가 2 vsync
 * 간격으로 고르게 나온다.
 */
export function SceneFrameGovernor({
  animating = false,
  slow = false,
}: SceneFrameGovernorProps) {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    let fps = -1;
    let ticker: ReturnType<typeof setInterval> | null = null;
    let graceUntil = 0;

    const applyFps = (next: number) => {
      if (next === fps) return;
      fps = next;
      if (ticker !== null) {
        clearInterval(ticker);
        ticker = null;
      }
      const interval = governorIntervalMs(next);
      if (interval !== null) {
        // 주기가 바뀐 즉시 한 프레임 — 느린 주기로 내려갈 때 마지막 자세가
        // 화면에 남게.
        invalidate();
        ticker = setInterval(() => invalidate(), interval);
      }
    };

    const evaluate = () => {
      const now = performance.now();
      const realtime = useRealtimeStore.getState();
      const active =
        animating ||
        useVirtualTagStore.getState().isRunning ||
        (realtime.isRunning &&
          now - realtime.activity.lastMessageAt < REALTIME_ACTIVE_MS) ||
        useReplayPlayerStore.getState().isPlaying ||
        useActiveTransformStore.getState().active;
      graceUntil = extendAnimationGrace(graceUntil, active, now);
      applyFps(
        resolveGovernorFps({
          animating: active || now < graceUntil,
          slow,
          hidden: document.visibilityState === 'hidden',
        }),
      );
    };

    evaluate();
    const poll = setInterval(evaluate, POLL_MS);
    document.addEventListener('visibilitychange', evaluate);
    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', evaluate);
      if (ticker !== null) clearInterval(ticker);
    };
  }, [animating, slow, invalidate]);

  return null;
}
