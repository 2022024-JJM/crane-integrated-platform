import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { Badge } from '@crane/ui/atoms/badge';
import {
  formatBandSpan,
  PLAY3D_DWELL_FRAME_CLASS,
  type Play3dHoverPayload,
} from '../lib/play3d-format';

/**
 * 표식 hover 요약 — 리포트 타임라인과 재생바가 같은 내용을 쓴다. 트리거가
 * payload 로 넘긴 것을 그리기만 한다(순번·구간 계산은 lib).
 *  - 충돌: 종류·시각 / [장비] ↔ [장비] / 같은 쌍에서 몇 번째
 *  - 영역 체류: 등급 / 영역 프레임 안에 [침범자] / 구간(미이탈은 "진행 중")
 *  - 상태 막대: 장비 · 상태 / 구간
 *  - 그 밖의 사건(재생바의 정지·두절): 종류·시각 / 대상
 * 충돌은 대칭 관계라 양쪽을 배지로 나누고(`CollisionPair`), 영역은 포함
 * 관계라 화살표 대신 영역 이름 라벨을 단 점선 상자 안에 침범자 배지를 넣는다
 * (`ZoneFrame`, 점선은 타임라인 체류 박스와 같은 amber). 라벨은 툴팁 글자
 * 그대로이고, 이름 배지는 상자와 같은 작은 모서리의 테두리 없는 칩이라 한
 * 그림으로 읽힌다. 툴팁 판이 `bg-foreground` 라 배지·라벨 색은 판 위에 맞춰
 * 뒤집는다.
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
        {payload.event.modelNames ? (
          <CollisionPair names={payload.event.modelNames} />
        ) : (
          <span>{payload.event.label}</span>
        )}
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
        <ZoneFrame zoneName={band.zoneName} intruderName={band.intruderName} />
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

/** 충돌 양쪽을 배지로 — 긴 이름은 배지 단위로 줄바꿈하고 한 배지 안에서는 말줄임. */
function CollisionPair({ names }: { names: readonly [string, string] }) {
  return (
    <span className="flex max-w-full flex-wrap items-center gap-1">
      <NameBadge>{names[0]}</NameBadge>
      <span className="shrink-0 opacity-70">↔</span>
      <NameBadge>{names[1]}</NameBadge>
    </span>
  );
}

/**
 * 영역 프레임 — 영역 이름을 왼쪽 위 테두리에 걸친 라벨(fieldset legend 꼴)로
 * 단 점선 상자 안에 침범자 배지를 넣어 "안에 있음" 이 그림으로 읽힌다.
 * 라벨은 절대 배치가 아니라 흐름 안에서 음수 위 여백으로 테두리에 걸친다 —
 * 절대 배치면 프레임 폭이 배지 폭으로만 정해져 긴 영역 이름이 잘린다. 라벨
 * 바탕은 판 색이라 보이지 않고 점선만 끊는다. 글자 크기·색은 툴팁 그대로.
 */
function ZoneFrame({
  zoneName,
  intruderName,
}: {
  zoneName: string;
  intruderName: string;
}) {
  return (
    <span
      className={cn(
        'mt-2.5 flex max-w-full flex-col items-start gap-1 rounded border px-1.5 pb-1.5',
        PLAY3D_DWELL_FRAME_CLASS,
      )}
    >
      <span className="bg-foreground -mt-2 max-w-full px-1 leading-tight font-medium">
        {zoneName}
      </span>
      <NameBadge className="self-center">{intruderName}</NameBadge>
    </span>
  );
}

/** 이름 칩 — 프레임과 같은 작은 모서리, 테두리 없이 판 색을 뒤집은 채움. */
function NameBadge({
  className,
  children,
}: {
  className?: string;
  children: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'bg-background/15 text-background h-auto max-w-full rounded-sm border-transparent px-1.5 py-px text-[11px]',
        className,
      )}
    >
      <span className="truncate">{children}</span>
    </Badge>
  );
}
