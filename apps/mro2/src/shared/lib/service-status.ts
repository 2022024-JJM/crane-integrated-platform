import { i18n } from '@crane/core/config/i18n';
import type { ServiceTone } from '../ui/kc';

/**
 * 매뉴얼 8p 지연 규칙 — "예정일이 5일 이상 지난 미완료 서비스 요청"만 빨강으로 본다.
 * 하루만 지나도 빨강으로 칠하면 정상 운영 중인 일정까지 지연으로 보이기 때문이다.
 */
export const OVERDUE_DAYS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 기준일이 오늘로부터 OVERDUE_DAYS 이상 지났는지 */
export function isPastDue(due: string | null | undefined, now: number = Date.now()): boolean {
  if (!due) return false;
  const t = new Date(due).getTime();
  if (Number.isNaN(t)) return false;
  return now - t >= OVERDUE_DAYS * DAY_MS;
}

/**
 * 도메인 WO 상태 → 서비스 상태색 매핑.
 * green=완료 / yellow=진행중 / grey=예정 / red=지연(예정일 5일 이상 초과)
 */
export function inspectionTone(
  status: string,
  scheduledDate?: string | null,
  now: number = Date.now(),
): ServiceTone {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'in_progress':
      return 'inProgress';
    case 'overdue':
      // 도메인이 overdue로 표시했어도 5일 규칙을 넘겨야 빨강으로 본다.
      // 예정일을 모르면 도메인 판단을 그대로 신뢰한다.
      return scheduledDate === undefined || isPastDue(scheduledDate, now) ? 'delayed' : 'open';
    default:
      return isPastDue(scheduledDate, now) ? 'delayed' : 'open';
  }
}

export function repairTone(
  status: string,
  scheduledEnd?: string | null,
  now: number = Date.now(),
): ServiceTone {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'in_progress':
    case 're_inspection':
      return 'inProgress';
    default:
      return isPastDue(scheduledEnd, now) ? 'delayed' : 'open';
  }
}

/** 서비스 상태 라벨 — mro2 네임스페이스 번역 (컴포넌트는 useTranslation 구독으로 재렌더) */
export function serviceToneLabel(tone: ServiceTone): string {
  return i18n.t(`mro2:status.${tone}`);
}

/** 라틴어 축약 월명 (Intl에 la 로케일이 없어 수동 매핑) */
const LA_MONTHS_SHORT = [
  'Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun',
  'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** 현재 i18n 언어에 맞춘 날짜 포맷 (ko: 2026. 8. 1. / en: Aug 1, 2026 / la: 1 Aug 2026) */
export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '-';
  const lang = i18n.language;
  if (lang === 'ko') {
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  if (lang === 'la') {
    return `${date.getDate()} ${LA_MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** WO 예정일의 연도 추출 */
export function yearOf(dateStr: string): number {
  return new Date(dateStr).getFullYear();
}
