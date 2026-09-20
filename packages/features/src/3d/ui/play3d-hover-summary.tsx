import { useTranslation } from 'react-i18next';
import { formatBandSpan, type Play3dHoverPayload } from '../lib/play3d-format';

/**
 * 표식 hover 요약 — 리포트 타임라인과 재생바가 같은 내용을 쓴다. 트리거가
 * payload 로 넘긴 것을 그리기만 한다(순번·구간 계산은 lib).
 *  - 충돌: 종류·시각 / 두 장비 / 같은 쌍에서 몇 번째
 *  - 영역 체류: 등급 / 소유 장비 · 영역 ← 침범자 / 구간(미이탈은 "진행 중")
 *  - 상태 막대: 장비 · 상태 / 구간
 *  - 그 밖의 사건(재생바의 정지·두절): 종류·시각 / 대상
 */
export function Play3dHoverSummary({
  payload,
}: {
  payload: Play3dHoverPayload;
}) {
  const { t } = useTranslation();

  if (payload.kind === 'collision') {
    return (
      <>
        <Title
          label={t('monitoring:play3d.event.collision')}
          time={payload.timeLabel}
        />
        <span>{payload.event.label}</span>
        {payload.summary ? (
          <Detail>
            {t('monitoring:play3d.hover.pairOrdinal', {
              n: payload.summary.ordinal,
              total: payload.summary.total,
            })}
          </Detail>
        ) : null}
      </>
    );
  }

  if (payload.kind === 'zone') {
    const { band } = payload;
    return (
      <>
        <Title
          label={t('monitoring:play3d.hover.zoneTitle', {
            level: t(
              band.level === 'stop'
                ? 'monitoring:inspector.zones.levelStop'
                : 'monitoring:inspector.zones.levelWarn',
            ),
          })}
        />
        <span>
          {band.zoneName} ← {band.intruderName}
        </span>
        <Detail>
          {formatBandSpan(
            band.fromMs,
            band.toMs,
            band.open ? t('monitoring:play3d.hover.ongoing') : null,
          )}
        </Detail>
      </>
    );
  }

  if (payload.kind === 'status') {
    return (
      <>
        <Title
          label={`${payload.name} · ${t(`monitoring:runtimeStatus.${payload.band.status}`)}`}
        />
        <Detail>
          {formatBandSpan(payload.band.fromMs, payload.band.toMs)}
        </Detail>
      </>
    );
  }

  const { event } = payload;
  const isHold = event.kind === 'holdStart' || event.kind === 'holdEnd';
  const target = isHold
    ? t(
        event.subject === 'collision'
          ? 'monitoring:play3d.filter.collision'
          : 'monitoring:play3d.filter.zone',
      )
    : event.label;
  return (
    <>
      <Title
        label={t(`monitoring:play3d.event.${event.kind}`)}
        time={payload.timeLabel}
      />
      {target ? <span>{target}</span> : null}
    </>
  );
}

function Title({ label, time }: { label: string; time?: string }) {
  return (
    <span className="flex w-full items-baseline justify-between gap-3 font-medium">
      <span>{label}</span>
      {time ? (
        <span className="font-mono tabular-nums opacity-70">{time}</span>
      ) : null}
    </span>
  );
}

function Detail({ children }: { children: React.ReactNode }) {
  return <span className="font-mono tabular-nums opacity-70">{children}</span>;
}
