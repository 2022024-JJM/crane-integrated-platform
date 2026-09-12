import { useSceneCollisionStore } from './use-scene-collision-store';
import { useVirtualTagStore } from './use-virtual-tag-store';

/**
 * 시뮬레이션 초기화(종료) — 화면·독·배지·화면 진입/이탈이 모두 이 함수를
 * 부른다. 가상 태그 스토어의 `stop()`(러너 정지·시간 0·시나리오 해제·배속 1·
 * rest 복귀·live 값 제거·실시간 보류 해제)에 더해, 그 시뮬레이션이 남긴
 * **충돌 기록(세션 10건)과 충돌 정지 상태**를 지운다 — 시뮬레이션이 만든
 * 충돌은 시뮬레이션과 함께 사라져야 한다(2026-09-12). 영속 저널(대시보드
 * 이력)은 append-only 라 그대로 둔다. 영역 침범은 상태라 자세가 rest 로
 * 돌아가는 다음 스캔에서 스스로 정리된다.
 *
 * 순서: 충돌 기록을 먼저 지운다(pinned 이면 이 경로가 러너를 release 하고
 * 스토어 상태를 정리한다) → 가상 태그 stop.
 */
export function stopSimulation(): void {
  useSceneCollisionStore.getState().clearHistory();
  useVirtualTagStore.getState().stop();
}
