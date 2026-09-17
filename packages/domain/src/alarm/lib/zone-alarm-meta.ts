import type { Alarm } from '../model/types';

/**
 * 영역 침범 로컬 알람(`eventType 'zone_intrusion'`, 앱 셸 zone-alarm-bridge 가
 * 만든다)의 `eventData` 에서 화면이 쓰는 값을 뽑는다 — 우상단 알람 목록이
 * 행에 영역 색 점과 [영역 보기] 버튼을 붙일 때(2026-09-17, 독 영역 팝업의
 * 침범 목록을 알람 목록으로 옮긴 것). `zoneKey` 는 `modelId#zoneId`, `color`
 * 는 영역 정의의 `#rrggbb`(sanitize-model-zones 가 보장하지만 eventData 는
 * 자유 형식이라 여기서 다시 검사한다 — 통과 못 하면 점을 그리지 않는다).
 */
export interface ZoneAlarmMeta {
  zoneKey: string;
  /** `#rrggbb` 소문자, 형식이 아니면 null. */
  color: string | null;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function getZoneAlarmMeta(
  alarm: Pick<Alarm, 'eventType' | 'eventData'>,
): ZoneAlarmMeta | null {
  if (alarm.eventType !== 'zone_intrusion') return null;
  const zoneKey = alarm.eventData?.zoneKey;
  if (typeof zoneKey !== 'string' || zoneKey.length === 0) return null;
  const color = alarm.eventData?.color;
  return {
    zoneKey,
    color:
      typeof color === 'string' && HEX_COLOR.test(color)
        ? color.toLowerCase()
        : null,
  };
}
