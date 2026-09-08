import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Radar, ShieldAlert } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import { useAllSitesRealtimeSummary } from '../model/use-all-sites-realtime-summary';
import { GlassSurface } from './glass-surface';
import { RegionMap } from './region-map';

type OperationalStatus = 'nominal' | 'caution' | 'alert';

export function RegionMapPage() {
  const { t } = useTranslation();
  const summary = useAllSitesRealtimeSummary();
  const clock = useUtcClock();

  const status: OperationalStatus =
    summary.critical > 0
      ? 'alert'
      : summary.warning > 0
        ? 'caution'
        : 'nominal';

  return (
    <div className="relative flex h-full flex-col overflow-hidden p-6">
      <RegionMap />

      {/*
        좌하단 판독부 — 화면에서 유일한 수치 블록.
        예전에는 상단 중앙에 "Crane Ops / Global Fleet Map · 시각" 테이프가
        따로 떠 있었지만, 앞 절반은 화면이 바뀌어도 늘 같은 글자였고 위치는
        지도의 브레드크럼이 더 정확히 말해 준다. 남는 정보인 UTC 시각만
        이 판독부의 첫 칸으로 들어와, 판독은 여기 한 곳으로 모인다.
      */}
      <div
        className="pointer-events-none absolute bottom-8 left-28 z-30"
        style={{ animation: 'map-panel-reveal 600ms ease-out 180ms both' }}
      >
        <GlassSurface sheen className="pointer-events-auto">
          <div className="flex items-stretch">
            <OpsClock status={status} time={clock} />
            <OpsDivider className="hidden md:block" />
            <OpsMetric
              icon={<Radar className="size-[18px]" strokeWidth={1.75} />}
              label={t('monitoring-overview:map.kpi.sites')}
              value={summary.sitesCount}
              tone="neutral"
            />
            <OpsDivider />
            <OpsMetric
              icon={<Activity className="size-[18px]" strokeWidth={1.75} />}
              label={t('monitoring-overview:map.kpi.warning')}
              value={summary.warning}
              tone="warning"
            />
            <OpsDivider />
            <OpsMetric
              icon={<ShieldAlert className="size-[18px]" strokeWidth={1.75} />}
              label={t('monitoring-overview:map.kpi.critical')}
              value={summary.critical}
              tone="critical"
            />
          </div>
        </GlassSurface>
      </div>
    </div>
  );
}

/**
 * 칸 사이 구분 — 유리판을 가르는 헤어라인 하나.
 * 이전의 점선 테두리는 HUD 코스튬의 일부였고, 판을 조각내 보이게 했다.
 */
function OpsDivider({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'my-3.5 w-px self-stretch bg-black/[0.10] dark:bg-white/[0.12]',
        className,
      )}
    />
  );
}

/**
 * 판독부의 첫 칸 — 운영 상태등 + UTC 시각.
 *
 * 상태는 왼쪽 점 하나가 나른다. 예전에는 패널 네 귀퉁이의 브래킷이 색을
 * 바꾸고 깜빡이며 같은 말을 했는데, 정작 시선이 가는 곳은 숫자라 아무도
 * 귀퉁이를 보지 않았다. 점을 값 옆에 두면 같은 정보가 읽히는 자리에 온다.
 */
function OpsClock({
  status,
  time,
}: {
  status: OperationalStatus;
  time: string;
}) {
  const dotTone =
    status === 'alert'
      ? 'bg-red-500'
      : status === 'caution'
        ? 'bg-amber-500'
        : 'bg-emerald-500';

  return (
    <div className="relative hidden items-center gap-3.5 px-5 py-3.5 md:flex">
      <span
        aria-hidden
        className="relative flex size-2.5 shrink-0 items-center justify-center"
      >
        {status !== 'nominal' ? (
          <span
            className={cn(
              'absolute top-1/2 left-1/2 size-2 rounded-full opacity-40',
              dotTone,
              'animate-[region-map-ripple_2s_ease-out_infinite]',
            )}
          />
        ) : null}
        <span className={cn('relative size-2 rounded-full', dotTone)} />
      </span>

      <div className="flex flex-col items-start gap-1.5">
        <span className="text-foreground/55 text-[12px] leading-none font-medium">
          UTC
        </span>
        <span className="text-foreground text-[26px] leading-none font-semibold tabular-nums">
          {time}
        </span>
      </div>
    </div>
  );
}

function OpsMetric({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: 'neutral' | 'warning' | 'critical';
}) {
  const active = tone !== 'neutral' && value > 0;

  const toneText =
    tone === 'warning'
      ? active
        ? 'text-amber-600 dark:text-amber-300'
        : 'text-foreground/35'
      : tone === 'critical'
        ? active
          ? 'text-red-600 dark:text-red-300'
          : 'text-foreground/35'
        : 'text-foreground';

  return (
    <div className="relative flex items-center gap-3.5 px-5 py-3.5">
      <span
        className={cn('shrink-0', active ? toneText : 'text-foreground/40')}
      >
        {icon}
      </span>

      <div className="flex flex-col items-start gap-1.5">
        {/*
          라벨은 세 언어(ko/en/la)를 모두 담는다. 이전의
          `uppercase tracking-[0.16em]` 는 한글에서 uppercase 가 무효인 채
          자간만 벌려 "사 이 트" 처럼 흩어졌다.
        */}
        <span className="text-foreground/55 text-[12px] leading-none font-medium">
          {label}
        </span>
        <span
          className={cn(
            'text-[26px] leading-none font-semibold tabular-nums',
            toneText,
          )}
        >
          {value.toString().padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Live UTC clock — HH:MM:SS, 1 Hz tick
 * ────────────────────────────────────────────────────────────────────────── */

function useUtcClock() {
  const [now, setNow] = useState(() => formatUtc(new Date()));
  useEffect(() => {
    const id = setInterval(() => setNow(formatUtc(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatUtc(d: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
