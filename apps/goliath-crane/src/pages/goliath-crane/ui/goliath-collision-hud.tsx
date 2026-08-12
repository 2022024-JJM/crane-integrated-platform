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

/**
 * 행 레이아웃 — 고정폭 그리드. 컬럼 폭이 행마다 같아야 숫자가 세로로
 * 정렬되어 목록을 훑어 읽을 수 있다 (flex auto 폭은 값 길이에 따라
 * 컬럼이 행마다 어긋난다). 레그 라벨(L1/L2)도 이름 옆 인라인이 아니라
 * 별도 컬럼 — 이름 길이에 따라 칩 위치가 행마다 흔들리지 않는다
 * (운영 피드백). 내부 트래킹 id는 운영자에게 무의미해 뺀다.
 */
const ROW_GRID =
  'grid grid-cols-[1.25rem_minmax(0,1fr)_1.5rem_3.25rem_3.5rem_2.75rem] items-center gap-1.5 px-2 py-1';

function TrackRow({ track }: { track: HudTrack }) {
  const { t } = useTranslation('goliath-crane');
  const Icon = TRACK_ICONS[track.type];
  const danger = track.severity === 'danger';

  return (
    <li
      className={cn(
        ROW_GRID,
        // 위험 행은 배경 틴트로도 구분 — 배지까지 시선이 가기 전에
        // 목록 스캔 단계에서 걸리게 한다.
        danger && 'bg-red-500/10',
        track.phase === 'leaving' && 'opacity-40',
      )}
    >
      <Icon className="size-3.5 text-slate-400" aria-hidden />
      <span className="min-w-0 truncate text-[11px] font-medium text-white">
        {t(`collisionGuard.hud.kind.${track.type}`)}
      </span>
      {/* 라벨이 없어도 셀은 유지 — 뒤 컬럼 정렬이 흔들리지 않는다 */}
      <span className="text-center">
        {track.zoneLabel ? (
          <span className="rounded bg-slate-700/70 px-1 py-px font-mono text-[9px] font-semibold text-slate-300">
            {track.zoneLabel}
          </span>
        ) : null}
      </span>
      <span className="text-right font-mono text-[11px] font-semibold tabular-nums text-white">
        {track.distanceM} m
      </span>
      <span className="text-right font-mono text-[10px] tabular-nums text-slate-400">
        {track.speedMps.toFixed(1)} m/s
      </span>
      <span
        className={cn(
          'rounded px-1 py-px text-center text-[9px] font-bold tracking-wide uppercase',
          danger
            ? 'bg-red-500/25 text-red-300'
            : 'bg-amber-500/25 text-amber-300',
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

  const overall = snapshot.overall;

  return (
    // 씬 라벨(다크 칩)과 같은 FSD풍 다크 패널로 고정 — 앱 테마와 무관하게
    // 밝은 무채색 무대 위에서 흰 글자의 대비가 항상 유지된다.
    // 전체 상태가 위험이면 패널 테두리까지 붉게 — 목록을 읽지 않아도
    // 패널 존재 자체가 경보가 된다.
    <section
      aria-label={t('collisionGuard.hud.title')}
      className={cn(
        'absolute top-3 left-3 w-72 overflow-hidden rounded-lg border bg-slate-900/85 shadow-md backdrop-blur-sm',
        overall === 'danger' ? 'border-red-500/70' : 'border-slate-700/70',
      )}
    >
      <header className="flex items-center gap-1.5 border-b border-slate-700/60 px-2.5 py-1.5 text-[11px] font-bold tracking-wide text-slate-200 uppercase">
        <ShieldCheck className="size-3.5" aria-hidden />
        <span className="flex-1">{t('collisionGuard.hud.title')}</span>
      </header>
      {snapshot.tracks.length === 0 ? (
        <p className="px-2.5 py-2 text-[11px] text-slate-400">
          {t('collisionGuard.hud.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-slate-700/50 py-0.5">
          {snapshot.tracks.map((track) => (
            <TrackRow key={track.id} track={track} />
          ))}
        </ul>
      )}
    </section>
  );
}
