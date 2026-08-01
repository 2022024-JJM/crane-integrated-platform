import { i18n } from '@crane/core/config/i18n';
import type { ServiceTone } from '../ui/kc';

/**
 * 도메인 WO 상태 → 서비스 상태색 매핑.
 * green=완료 / yellow=진행중 / grey=예정 / red=지연(기한 초과)
 */
export function inspectionTone(status: string): ServiceTone {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'in_progress':
      return 'inProgress';
    case 'overdue':
      return 'delayed';
    default:
      return 'open';
  }
}

export function repairTone(status: string, scheduledEnd?: string): ServiceTone {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'in_progress':
    case 're_inspection':
      return 'inProgress';
    default: {
      // 예정 종료일이 지났는데 미완료면 지연으로 본다 (매뉴얼 5일 규칙의 단순화)
      if (scheduledEnd && new Date(scheduledEnd).getTime() < Date.now()) {
        return 'delayed';
      }
      return 'open';
    }
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
