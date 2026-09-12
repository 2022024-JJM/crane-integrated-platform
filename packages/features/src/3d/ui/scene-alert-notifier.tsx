import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { notifyAlert } from '@crane/core/lib/alert-notifications';
import { diffZoneIntrusions } from '../lib/zone-journal-map';
import { useSceneCollisionStore } from '../model/use-scene-collision-store';
import { useSceneZoneStore } from '../model/use-scene-zone-store';

/**
 * 3D 경보 → 알림 채널(toast·소리·브라우저 알림) 브릿지. 앱 셸 runtime
 * effects 에 1회 마운트한다. 충돌은 새 기록(id), 영역은 새 침범 쌍이 사건이다
 * — 두 스토어는 밖에서 구독만 한다. 화면 안 배너(충돌·영역 경보 오버레이)·
 * HUD·헤더 배지가 이미 같은 사건을 보여 주므로 toast 는 띄우지 않는다(겹쳐
 * 보여 2026-09-12 에 뺐다) — 이 채널은 소리와, 탭이 뒤에 있을 때의 브라우저
 * 알림이다.
 * critical 알람은 alarm 슬라이스(useCriticalAlarmBanner)가 같은 notifyAlert
 * 로 내보낸다.
 */
export function SceneAlertNotifier() {
  const { t } = useTranslation();

  useEffect(() => {
    const unsubCollision = useSceneCollisionStore.subscribe((state, prev) => {
      if (state.history === prev.history) return;
      const prevIds = new Set(prev.history.map((r) => r.id));
      for (const record of state.history) {
        if (prevIds.has(record.id)) continue;
        notifyAlert({
          id: `collision:${record.id}`,
          severity: 'critical',
          title: t('monitoring:sceneAlert.collisionTitle'),
          description: `${record.a.equipName || record.a.modelId} ↔ ${record.b.equipName || record.b.modelId}`,
          toast: false,
        });
      }
    });
    const unsubZone = useSceneZoneStore.subscribe((state, prev) => {
      if (state.intrusions === prev.intrusions) return;
      const { entered } = diffZoneIntrusions(prev.intrusions, state.intrusions);
      for (const ref of entered) {
        const { intrusion } = ref;
        notifyAlert({
          id: `zone:${intrusion.zoneKey}:${ref.intruderId}`,
          severity: intrusion.level === 'stop' ? 'critical' : 'warning',
          title: t(
            intrusion.level === 'stop'
              ? 'monitoring:sceneAlert.zoneStopTitle'
              : 'monitoring:sceneAlert.zoneWarnTitle',
          ),
          description: `${intrusion.ownerName} · ${intrusion.zoneName || intrusion.zoneId} ← ${ref.intruderName}`,
          toast: false,
        });
      }
    });
    return () => {
      unsubCollision();
      unsubZone();
    };
  }, [t]);

  return null;
}
