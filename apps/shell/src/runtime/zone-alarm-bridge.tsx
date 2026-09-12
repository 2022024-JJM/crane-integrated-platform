import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createLocalAlarm, localAlarmActiveKey } from '@crane/domain/alarm';
import { useRealtimeAlarmStore } from '@crane/features/alarm';
import {
  diffZoneIntrusions,
  findRegionOfModel,
  useSceneInfoStore,
  useSceneZoneStore,
} from '@crane/features/3d';

/**
 * 3D 영역 침범 → 실시간 알람 스토어 브릿지(앱 셸 글루). features/3d 와
 * features/alarm 은 서로 import 하지 않으므로(FSD 같은 레이어) 두 슬라이스를
 * 모두 아는 셸이 잇는다. 침범 쌍이 생기면 로컬 알람(발생), 사라지면 해제
 * 레코드를 같은 키로 넣어 알람 이력 페이지·헤더 배지·전체화면 알람 패널이
 * 서버 알람과 같이 보여 준다. craneId 는 소유 모델의 craneId, 없으면 모델 id —
 * 지역 필터는 alarm.regionId 로도 통과한다(features/alarm isAlarmInRegion).
 */
export function ZoneAlarmBridge() {
  const { t } = useTranslation();
  useEffect(() => {
    const openedAt = new Map<string, number>();
    return useSceneZoneStore.subscribe((state, prev) => {
      if (state.intrusions === prev.intrusions) return;
      const { entered, exited } = diffZoneIntrusions(
        prev.intrusions,
        state.intrusions,
      );
      if (entered.length === 0 && exited.length === 0) return;
      const now = Date.now();
      const scenes = useSceneInfoStore.getState().sceneInfoByRegion;
      const store = useRealtimeAlarmStore.getState();
      for (const kind of ['enter', 'exit'] as const) {
        for (const ref of kind === 'enter' ? entered : exited) {
          const { intrusion } = ref;
          const regionId = findRegionOfModel(intrusion.ownerId, scenes);
          if (!regionId) continue;
          const owner = scenes[regionId]?.models.find(
            (m) => m.id === intrusion.ownerId,
          );
          const subject = `${intrusion.zoneKey}|${ref.intruderId}`;
          if (kind === 'enter') openedAt.set(subject, now);
          const input = {
            eventType: 'zone_intrusion' as const,
            subject,
            regionId,
            craneId: owner?.craneId ?? intrusion.ownerId,
            craneName: intrusion.ownerName,
            severity:
              intrusion.level === 'stop'
                ? ('high' as const)
                : ('medium' as const),
            alarmName: t('monitoring:sceneAlert.zoneAlarmName', {
              owner: intrusion.ownerName,
              zone: intrusion.zoneName || intrusion.zoneId,
              intruder: ref.intruderName,
            }),
            alarmDescription: t(
              intrusion.level === 'stop'
                ? 'monitoring:sceneAlert.zoneAlarmLevelStop'
                : 'monitoring:sceneAlert.zoneAlarmLevelWarn',
            ),
            active: kind === 'enter',
            at: now,
            openedAt: openedAt.get(subject),
            eventData: { zoneKey: intrusion.zoneKey, intruder: ref.intruderId },
          };
          if (kind === 'exit') openedAt.delete(subject);
          store.upsertLocalAlarm(
            createLocalAlarm(input),
            localAlarmActiveKey(input),
          );
        }
      }
    });
  }, [t]);
  return null;
}
