import { useTranslation } from 'react-i18next';
import { getAllInspectionWOs } from '@crane/domain/inspection';
import { getAllRepairWOs } from '@crane/domain/maintenance';
import { useEntityTicks } from '../shared/use-domain-event-store';
import type { CalendarEvent } from './types';

/** 'YYYY-MM-DD' → 로컬 자정 Date (new Date(str)의 UTC 파싱으로 인한 하루 밀림 방지) */
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 'YYYY-MM-DDTHH:mm:ss' (TZ 없음) → 로컬 Date */
function parseLocalDateTime(s: string): Date {
  const [datePart, timePart = '00:00:00'] = s.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm, ss] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0);
}

/**
 * 점검 WO(예정일, 종일) + 정비 WO(예정 기간)를 캘린더 이벤트로 합쳐 반환한다.
 * 두 도메인 tick을 구독해 티켓 생성/상태 변경 시 자동 갱신된다.
 */
export function useServiceCalendar(): { events: CalendarEvent[] } {
  const { t, i18n } = useTranslation('calendar');
  const isKo = i18n.language === 'ko';
  useEntityTicks(['inspection', 'repair']);

  const inspectionEvents: CalendarEvent[] = getAllInspectionWOs().map((wo) => {
    const start = parseLocalDate(wo.scheduledDate);
    return {
      id: `inspection:${wo.id}`,
      sourceId: wo.id,
      sourceType: 'inspection',
      woNumber: wo.woNumber,
      title: `${wo.woNumber} · ${t(`type.${wo.woType}`)}`,
      craneId: wo.craneId,
      craneName: wo.craneName,
      productKey: wo.woType,
      start,
      end: start,
      allDay: true,
      status: wo.status,
      priority: wo.priority,
      colorKey: wo.status,
      detailPath: `/inspection/${wo.id}`,
    };
  });

  const repairEvents: CalendarEvent[] = getAllRepairWOs().map((wo) => {
    const start = parseLocalDateTime(wo.scheduledStart);
    let end = parseLocalDateTime(wo.scheduledEnd);
    // 데이터 오류(end ≤ start) 방어: 최소 1시간 폭 보장
    if (end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }
    const componentName = isKo
      ? wo.componentName_ko ?? wo.componentName
      : wo.componentName;
    return {
      id: `repair:${wo.id}`,
      sourceId: wo.id,
      sourceType: 'repair',
      woNumber: wo.woNumber,
      title: `${wo.woNumber} · ${componentName}`,
      craneId: wo.craneId,
      craneName: wo.craneName,
      productKey: wo.sourceType === 'breakdown' ? 'oncall' : 'planned',
      start,
      end,
      allDay: false,
      status: wo.status,
      priority: wo.priority,
      colorKey: wo.priority,
      detailPath: `/maintenance/${wo.id}`,
    };
  });

  const events = [...inspectionEvents, ...repairEvents].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  return { events };
}
