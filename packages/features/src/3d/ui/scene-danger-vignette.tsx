import { useSceneCollisionStore } from '../model/use-scene-collision-store';
import { useSceneZoneStore } from '../model/use-scene-zone-store';

/**
 * 위험 비네트 — 관제 HUD 의 이상 조건(lib/hud-conditions.ts)에 위험 행이
 * 하나라도 있는 동안 캔버스 가장자리를 옅게 붉힌다. 고장·critical/high
 * 알람처럼 씬 안에 표시가 없는 위험도 카메라가 어디를 보든 걸리게 하는
 * 용도라 충돌·영역 비네트와 같은 구성(inset box-shadow)이고 더 옅다.
 *
 * 충돌·영역 침범 비네트가 떠 있으면 그리지 않는다 — 두 비네트가 겹치면 색이
 * 섞여 어느 쪽인지 읽을 수 없고, 그쪽이 더 급하다. 맥동하지 않아 충돌
 * (맥동)과도 구분된다. pointer-events-none 이라 조작을 막지 않는다.
 */
export function SceneDangerVignette({ active }: { active: boolean }) {
  const collisionActive = useSceneCollisionStore((s) => s.activeMode !== null);
  const zoneActive = useSceneZoneStore(
    (s) => s.enabled && s.intrusions.length > 0,
  );
  if (!active || collisionActive || zoneActive) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 shadow-[inset_0_0_160px_24px_rgba(239,68,68,0.3)]"
    />
  );
}
