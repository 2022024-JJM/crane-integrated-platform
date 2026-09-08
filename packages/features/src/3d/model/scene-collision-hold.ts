import { useRealtimeStore } from './use-realtime-store';
import { useVirtualTagStore } from './use-virtual-tag-store';

/**
 * 충돌 정지·기록 복원이 값 생산자를 멈추는 한 곳.
 *
 * - 가상 태그 러너는 pause — 경과 시간을 보존하므로 ▶ 가 멈춘 지점에서 잇는다.
 * - 실시간(WebSocket)은 화면 반영 보류(hold) — 장비는 계속 움직이고 수신 값은
 *   버려지며, release 하면 다음 값부터 최신 자세로 돌아간다.
 *
 * 리플레이 러너는 대상이 아니다(모니터링 뷰가 리플레이 모드에선 검사기를
 * 마운트하지 않는다).
 */
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
