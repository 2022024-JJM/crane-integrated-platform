import { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { COLLISION_GUARD_COLORS, useCollisionGuardStore } from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';
import { useGoliathCollisionZones } from '../model/use-goliath-collision-zones';

/**
 * 충돌 감지 도움말 — Monitoring3dView의 overlayExtras 슬롯(Canvas 위 DOM).
 *
 * 화면이 스스로를 설명하게 하는 장치다. 처음 보는 사람에게는 파란 원과
 * 빨간 원이 무엇인지, L1/L2가 무엇인지, 왜 어떤 객체는 노랗고 어떤 것은
 * 빨간지가 전혀 전달되지 않는다 — 발표자가 매번 말로 설명해야 한다면
 * 화면이 제 몫을 못 하는 것이다.
 *
 * 기본은 접힌 상태(물음표 버튼). 평상시 관제에서는 도움말이 시야를 먹으면
 * 안 되고, 시연·신규 사용자에게만 펼쳐 보이면 되기 때문이다.
 *
 * 색 견본은 씬과 같은 토큰(COLLISION_GUARD_COLORS)을 쓴다 — 한쪽만 바뀌면
 * 도움말이 거짓말을 하게 된다. 반경 수치도 하드코딩하지 않고 실제 존
 * 설정에서 읽어 표시한다.
 */

/** 링 색 견본 — 실제 씬처럼 "면 위의 얇은 테두리"로 그린다 */
function RingSwatch({ color, fill }: { color: string; fill?: string }) {
  return (
    <span
      aria-hidden
      className="size-3.5 shrink-0 rounded-full border-2"
      style={{ borderColor: color, backgroundColor: fill ?? 'transparent' }}
    />
  );
}

function HelpRow({
  swatch,
  label,
  value,
}: {
  swatch: React.ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <li className="flex items-center gap-2">
      {swatch}
      <span className="min-w-0 flex-1 text-[11px] leading-tight text-slate-200">
        {label}
      </span>
      {value ? (
        <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-white">
          {value}
        </span>
      ) : null}
    </li>
  );
}

export function GoliathCollisionHelp() {
  const { t } = useTranslation('goliath-crane');
  const enabled = useCollisionGuardStore((s) => s.enabled);
  const derived = useGoliathCollisionZones();
  const [open, setOpen] = useState(false);

  if (!enabled || !derived) return null;

  // 실제 존 설정에서 반경을 읽는다 — 두 다리 설정이 같으므로 첫 존 기준.
  const zone = derived.zones[0];
  const detectionM = Math.round(zone.radius * zone.metersPerUnit);
  const dangerM = Math.round(zone.dangerRadius * zone.metersPerUnit);
  const sensorLabels = derived.zones
    .map((z) => z.label)
    .filter(Boolean)
    .join(' · ');

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('collisionGuard.help.show')}
        // pointer-events-auto — 부모 오버레이 컨테이너가 none이라 명시 필요
        className="pointer-events-auto absolute right-3 bottom-3 flex items-center gap-1.5 rounded-lg border border-slate-700/70 bg-slate-900/95 px-2 py-1.5 text-[11px] font-semibold text-slate-200 shadow-md backdrop-blur-sm transition-colors hover:border-slate-500 hover:text-white focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none"
      >
        <HelpCircle className="size-3.5" aria-hidden />
        {t('collisionGuard.help.title')}
      </button>
    );
  }

  return (
    <section
      aria-label={t('collisionGuard.help.title')}
      className="pointer-events-auto absolute right-3 bottom-3 w-64 overflow-hidden rounded-lg border border-slate-700/70 bg-slate-900/95 shadow-md backdrop-blur-sm"
    >
      <header className="flex items-center gap-1.5 border-b border-slate-700/60 py-1.5 pr-1.5 pl-2.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
        <HelpCircle className="size-3" aria-hidden />
        <span className="flex-1">{t('collisionGuard.help.title')}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t('collisionGuard.help.hide')}
          className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-700/60 hover:text-white focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </header>

      <ul className="space-y-1.5 px-2.5 py-2">
        {/* 공간 요소 — 원의 정체와 실제 반경 */}
        <HelpRow
          swatch={<RingSwatch color={COLLISION_GUARD_COLORS.detection} />}
          label={t('collisionGuard.help.detectionRing')}
          value={`${detectionM} m`}
        />
        <HelpRow
          swatch={
            <RingSwatch
              color={COLLISION_GUARD_COLORS.danger}
              fill="rgba(239, 68, 68, 0.2)"
            />
          }
          label={t('collisionGuard.help.dangerRing')}
          value={`${dangerM} m`}
        />
        <HelpRow
          swatch={
            <span
              aria-hidden
              className="shrink-0 rounded border border-sky-400/50 bg-sky-950/70 px-1 py-px font-mono text-[9px] leading-none font-bold text-sky-300"
            >
              {derived.zones[0]?.label ?? 'L1'}
            </span>
          }
          label={t('collisionGuard.help.sensor')}
          value={sensorLabels || undefined}
        />
      </ul>

      {/* 객체 표기 — 세버리티는 색 외에 글리프로도 구분된다는 것까지 보여준다 */}
      <ul className="space-y-1.5 border-t border-slate-700/50 px-2.5 py-2">
        <HelpRow
          swatch={
            <span
              aria-hidden
              className="flex size-3.5 shrink-0 items-center justify-center text-[10px] leading-none"
              style={{ color: COLLISION_GUARD_COLORS.danger }}
            >
              ▲
            </span>
          }
          label={t('collisionGuard.help.severityDanger')}
        />
        <HelpRow
          swatch={
            <span
              aria-hidden
              className="flex size-3.5 shrink-0 items-center justify-center text-[10px] leading-none"
              style={{ color: COLLISION_GUARD_COLORS.warning }}
            >
              ●
            </span>
          }
          label={t('collisionGuard.help.severityWarning')}
        />
        <HelpRow
          swatch={
            <svg
              aria-hidden
              viewBox="0 0 14 8"
              className="size-3.5 shrink-0"
              fill={COLLISION_GUARD_COLORS.warning}
            >
              <path d="M0 3h8V1l6 3-6 3V5H0z" />
            </svg>
          }
          label={t('collisionGuard.help.arrow')}
        />
      </ul>

      {/* 시뮬레이션 고지 — MVP 단계임을 화면이 스스로 밝힌다. 실물 센서
          연동 시 이 줄만 제거하면 된다. */}
      <p
        className={cn(
          'border-t border-slate-700/50 px-2.5 py-1.5',
          'text-[10px] leading-tight text-slate-400',
        )}
      >
        {t('collisionGuard.help.simulationNote')}
      </p>
    </section>
  );
}
