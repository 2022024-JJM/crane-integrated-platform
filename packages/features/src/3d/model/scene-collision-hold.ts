import { usePlaybackStore } from './use-playback-store';
import { useRealtimeStore } from './use-realtime-store';
import { useReplayPlayerStore } from './use-replay-player-store';
import { useVirtualTagStore } from './use-virtual-tag-store';

/**
 * 충돌·영역 감지가 값 생산자(러너)를 멈추고, 돌고 있는지 묻고, 재개 전이를
 * 구독하는 한 곳.
 *
 * - 가상 태그 러너는 pause — 경과 시간을 보존하므로 ▶ 가 멈춘 지점에서 잇는다.
 * - 리플레이 러너도 pause — 프레임 index 를 보존하므로 ▶ 가 그 프레임부터 잇는다.
 * - 실시간(WebSocket)은 화면 반영 보류(hold) — 장비는 계속 움직이고 수신 값은
 *   버려지며, release 하면 다음 값부터 최신 자세로 돌아간다.
 */

/**
 * 감지 대상 값 생산자 — 스캔 게이트·정지 방식·안내 문구·재개 경로가 갈린다.
 * - 'simulation': 에디터·대시보드 미리보기(가상 태그 러너)
 * - 'realtime': 실시간 모니터링(WebSocket)
 * - 'playback': 플레이백 페이지 — 활성 소스(usePlaybackStore)가 리플레이면
 *   리플레이 러너, 시뮬레이션이면 가상 태그 러너
 */
export type SceneCollisionRunner = 'simulation' | 'realtime' | 'playback';

/**
 * 러너가 재생 중인지 — 검사기의 스캔 게이트. 실시간은 WebSocket 러너의
 * isRunning(화면 진입~이탈 내내 true) — `held`(화면 반영 보류)는 보지 않는다.
 * 보류 중엔 아무것도 움직이지 않아 스캔이 공짜이고, release 뒤 최신 값으로
 * 튀는 것은 실제 장비 움직임이다.
 */
export function isRunnerRunning(runner: SceneCollisionRunner): boolean {
  switch (runner) {
    case 'realtime':
      return useRealtimeStore.getState().isRunning;
    case 'playback':
      return usePlaybackStore.getState().source === 'replay'
        ? useReplayPlayerStore.getState().isPlaying
        : useVirtualTagStore.getState().isRunning;
    default:
      return useVirtualTagStore.getState().isRunning;
  }
}

export function holdRunners(): void {
  useVirtualTagStore.getState().pause();
  useReplayPlayerStore.getState().pause();
  useRealtimeStore.getState().hold();
}

/**
 * pinned 해제 — 실시간만 자동 복귀한다. 가상 태그·리플레이는 충돌 전에 켜져
 * 있었는지 기억할 상태가 없어 기존대로 ▶ 가 켠다.
 */
export function releaseRunners(): void {
  useRealtimeStore.getState().release();
}

/**
 * ▶ 재생 전이(false→true) 구독 — 충돌 pinned·영역 정지의 재개 경로. 시뮬레이션은
 * 가상 태그 러너, 플레이백은 두 러너 모두(활성 소스만 켜질 수 있다), 실시간은
 * 러너 재생 전이가 없어(진입~이탈 내내 true) 구독하지 않는다 — 실시간은
 * 자동 정지 자체가 없다(2026-09-16).
 */
export function subscribeRunnerResume(
  runner: SceneCollisionRunner,
  onResume: () => void,
): () => void {
  if (runner === 'realtime') return () => {};
  const unsubVirtual = useVirtualTagStore.subscribe((state, prev) => {
    if (state.isRunning && !prev.isRunning) onResume();
  });
  if (runner === 'simulation') return unsubVirtual;
  const unsubReplay = useReplayPlayerStore.subscribe((state, prev) => {
    if (state.isPlaying && !prev.isPlaying) onResume();
  });
  return () => {
    unsubVirtual();
    unsubReplay();
  };
}
