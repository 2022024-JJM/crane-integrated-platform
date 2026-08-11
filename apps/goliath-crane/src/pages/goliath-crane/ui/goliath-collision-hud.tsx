import { Car, Forklift, PersonStanding, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useCollisionGuardHudSnapshot,
  useCollisionGuardStore,
  type HudTrack,
} from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';
import { useGoliathCollisionZones } from '../model/use-goliath-collision-zones';

/**
 * 충돌 감지 HUD — Monitoring3dView의 overlayExtras 슬롯(Canvas 위 DOM).
 *
 * 4Hz 스냅샷 훅으로 구동되는 표시 전용 패널. 컨테이너가
 * pointer-events-none이라 orbit 드래그를 막지 않는다.
 *
 * 레벨(주의/위험) 표기는 행 오른쪽 배지 하나뿐이다 — 배너 색·보더 색·
 * 아이콘 색까지 세버리티를 중복 인코딩하면 패널 전체가 경보처럼 요란해져
 * 오히려 읽기 어렵다. 긴급함의 전달은 씬(위험 링 펄스·라벨)이 담당한다.
 */

const TRACK_ICONS = {
  person: PersonStanding,
  car: Car,
  forklift: Forklift,
} as const;

function TrackRow({ track }: { track: HudTrack }) {
  const { t } = useTranslation('goliath-crane');
  const Icon = TRACK_ICONS[track.type];
  const danger = track.severity === 'danger';

  return (
    <li
      className={cn(
        'flex items-center gap-2 px-2 py-1',
        track.phase === 'leaving' && 'opacity-40',
      )}
    >
      <Icon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
      <span className="text-muted-foreground min-w-0 flex-1 truncate text-[11px]">
        {t(`collisionGuard.hud.kind.${track.type}`)}
        {track.zoneLabel ? (
          <span className="bg-muted/60 text-muted-foreground ml-1 rounded px-1 py-px font-mono text-[9px] font-semibold">
            {track.zoneLabel}
          </span>
        ) : null}
        <span className="text-muted-foreground/60 ml-1 font-mono">
          {track.id}
        </span>
      </span>
      <span className="font-mono text-[11px] font-semibold tabular-nums">
        {track.distanceM} m
      </span>
      <span className="text-muted-foreground/70 font-mono text-[10px] tabular-nums">
        {track.speedMps.toFixed(1)} m/s
      </span>
      <span
        className={cn(
          'rounded px-1 py-px text-[9px] font-bold tracking-wide uppercase',
          danger
            ? 'bg-red-500/15 text-red-600 dark:text-red-400'
            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
        )}
      >
        {t(`collisionGuard.hud.severity.${track.severity}`)}
      </span>
    </li>
  );
}

const EMPTY_ZONES: never[] = [];

export function GoliathCollisionGuardHud() {
  const { t } = useTranslation('goliath-crane');
  const enabled = useCollisionGuardStore((s) => s.enabled);
  // 씬의 크레인 배치에서 파생 — 씬 로드 전에는 빈 존으로 대기.
  const derived = useGoliathCollisionZones();
  const snapshot = useCollisionGuardHudSnapshot(derived?.zones ?? EMPTY_ZONES);

  if (!enabled || !derived) return null;

  return (
    <section
      aria-label={t('collisionGuard.hud.title')}
      className="bg-background/85 border-border/70 absolute top-3 left-3 w-60 overflow-hidden rounded-lg border shadow-sm backdrop-blur-sm"
    >
      <header className="text-muted-foreground border-border/50 flex items-center gap-1.5 border-b px-2.5 py-1.5 text-[11px] font-bold tracking-wide uppercase">
        <ShieldCheck className="size-3.5" aria-hidden />
        <span className="flex-1">{t('collisionGuard.hud.title')}</span>
      </header>
      {snapshot.tracks.length === 0 ? (
        <p className="text-muted-foreground px-2.5 py-2 text-[11px]">
          {t('collisionGuard.hud.empty')}
        </p>
      ) : (
        <ul className="divide-border/50 divide-y py-0.5">
          {snapshot.tracks.map((track) => (
            <TrackRow key={track.id} track={track} />
          ))}
        </ul>
      )}
    </section>
  );
}
