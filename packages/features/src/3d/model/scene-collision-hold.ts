import { useRealtimeStore } from './use-realtime-store';
import { useVirtualTagStore } from './use-virtual-tag-store';

/**
 * 충돌 감지가 값 생산자(러너)를 멈추고, 돌고 있는지 묻는 한 곳.
 *
 * - 가상 태그 러너는 pause — 경과 시간을 보존하므로 ▶ 가 멈춘 지점에서 잇는다.
 * - 실시간(WebSocket)은 화면 반영 보류(hold) — 장비는 계속 움직이고 수신 값은
 *   버려지며, release 하면 다음 값부터 최신 자세로 돌아간다.
 *
 * 리플레이 러너는 대상이 아니다(모니터링 뷰가 리플레이 모드에선 검사기를
 * 마운트하지 않는다).
 */

/** 감지 대상 값 생산자 — 스캔 게이트·정지 방식·안내 문구·재개 버튼이 갈린다. */
export type SceneCollisionRunner = 'simulation' | 'realtime';

/**
 * 러너가 재생 중인지 — 검사기의 스캔 게이트. 시뮬레이션은 가상 태그 러너의
 * isRunning, 실시간은 WebSocket 러너의 isRunning(화면 진입~이탈 내내 true).
 * 실시간 `held`(화면 반영 보류)는 보지 않는다 — 보류 중엔 아무것도 움직이지
 * 않아 스캔이 공짜이고, release 뒤 최신 값으로 튀는 것은 실제 장비 움직임이다.
 */
export function isRunnerRunning(runner: SceneCollisionRunner): boolean {
  return runner === 'realtime'
    ? useRealtimeStore.getState().isRunning
    : useVirtualTagStore.getState().isRunning;
}

export function holdRunners(): void {
  useVirtualTagStore.getState().pause();
  useRealtimeStore.getState().hold();
}

/**
 * pinned 해제 — 실시간만 자동 복귀한다. 가상 태그는 충돌 전에 켜져 있었는지
 * 기억할 상태가 없어 기존대로 ▶ 가 켠다.
 */
export function releaseRunners(): void {
  useRealtimeStore.getState().release();
}
