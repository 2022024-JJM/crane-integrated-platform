import {
  KC,
  SERVICE_TONE_COLOR,
  SERVICE_TONE_TEXT,
  type ServiceTone,
} from './kc';
import { serviceToneLabel } from '../lib/service-status';

/**
 * 상태 칩 — 지연은 `alert` 일 때만 빨강 채움, 아니면 회색 테두리에 같은 라벨.
 * 빨강의 양을 applyAlertCap 이 정하고 칩은 그 결과만 그린다.
 */
export function SrStatusChip({
  tone,
  alert,
  days,
}: {
  tone: ServiceTone;
  alert: boolean;
  /** 지연이면 지난 일수 — "지연 D+45" 로 보여 준다 */
  days?: number;
}) {
  const muted = tone === 'delayed' && !alert;
  return (
    <span
      className="inline-flex h-5 shrink-0 items-center rounded px-1.5 text-[12px] font-bold whitespace-nowrap"
      style={
        muted
          ? {
              color: KC.muted,
              border: `1px solid ${KC.borderStrong}`,
              borderRadius: KC.radius,
            }
          : {
              background: SERVICE_TONE_COLOR[tone],
              color: SERVICE_TONE_TEXT[tone],
              borderRadius: KC.radius,
            }
      }
    >
      {serviceToneLabel(tone)}
      {tone === 'delayed' && days ? ` D+${days}` : ''}
    </span>
  );
}
