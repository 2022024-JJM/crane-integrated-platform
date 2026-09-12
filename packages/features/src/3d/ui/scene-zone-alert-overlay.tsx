import { useSceneCollisionStore } from '../model/use-scene-collision-store';
import { useSceneZoneStore } from '../model/use-scene-zone-store';

/**
 * 영역 침범 경보 — 침범 중인 영역이 하나라도 있는 동안 캔버스 가장자리에
 * 비네트를 두른다(충돌 경보 scene-collision-alert-overlay 와 같은 구성).
 * 등급이 색을 정한다 — 'warn' 만이면 amber, 'stop' 영역이 하나라도 침범되면
 * red(맥동). 침범은 **상태**라 끝나면 저절로 사라진다.
 *
 * 상단 중앙 배너는 2026-09-12 에 뺐다 — HUD 침범 칸·독 Radar 배지·헤더 알람
 * 배지·알람 패널이 같은 사건을 이미 보여 줘 겹쳤다. 배너에 있던 [영역 보기]는
 * 독 영역 팝업의 침범 행으로, [이어서 재생]은 독 ▶ 로 간다.
 *
 * 충돌 경보가 동시에 떠 있으면 아무것도 그리지 않는다 — 두 비네트가 겹치면
 * 색이 섞여 어느 쪽인지 읽을 수 없고, 충돌이 더 급하다.
 */
export function SceneZoneAlertOverlay({
  bannerClassName,
  onViewZone,
}: {
  /** @deprecated 배너가 없어져 쓰이지 않는다. 호출부 호환용. */
  bannerClassName?: string;
  /** @deprecated 배너가 없어져 쓰이지 않는다 — 영역 팝업(SceneZoneMenu)으로. */
  onViewZone?: (zoneKey: string) => void;
} = {}) {
  void bannerClassName;
  void onViewZone;
  const enabled = useSceneZoneStore((s) => s.enabled);
  const intrusions = useSceneZoneStore((s) => s.intrusions);
  const collisionActive = useSceneCollisionStore((s) => s.activeMode !== null);

  if (!enabled || intrusions.length === 0 || collisionActive) return null;

  const stop = intrusions.some((i) => i.level === 'stop');

  return (
    <div
      aria-hidden
      className={
        stop
          ? 'absolute inset-0 animate-pulse shadow-[inset_0_0_120px_32px_rgba(239,68,68,0.5)] motion-reduce:animate-none'
          : 'absolute inset-0 shadow-[inset_0_0_100px_24px_rgba(245,158,11,0.45)]'
      }
    />
  );
}
