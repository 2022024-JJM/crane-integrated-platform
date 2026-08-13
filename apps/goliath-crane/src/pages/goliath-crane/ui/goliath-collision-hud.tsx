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
 *
 * 거리 컬럼이 가장 넓다 — 충돌 HUD에서 가장 행동을 좌우하는 수치이므로
 * 글자 크기를 키웠고(15px), 그만큼 컬럼도 넓혀야 자리가 난다.
 */
const ROW_GRID =
  'grid grid-cols-[1.25rem_minmax(0,1fr)_1.5rem_4rem_3.25rem_3rem] items-center gap-1.5 py-1 pr-2 pl-1.5';

function TrackRow({ track }: { track: HudTrack }) {
  const { t } = useTranslation('goliath-crane');
  const Icon = TRACK_ICONS[track.type];
  const danger = track.severity === 'danger';

  return (
    <li
      className={cn(
        ROW_GRID,
        // 위험 행은 배경 틴트 + 왼쪽 굵은 세로선. 색 배지는 시선이 행
        // 끝까지 가야 읽히지만, 왼쪽 모서리 마커는 목록을 훑는 단계에서
        // 걸린다 — 위험 행이 여럿이면 붉은 띠가 이어져 "위험 그룹"의
        // 경계가 배지를 읽지 않고도 보인다.
        'border-l-2',
        danger ? 'border-red-500 bg-red-500/15' : 'border-transparent',
        // 이탈 트랙은 opacity로 흐리지 않는다 — opacity는 글자와 배경을
        // 함께 곱해 대비가 2.10:1까지 떨어진다(위험 구역을 막 벗어난
        // 객체가 가장 안 읽히게 되는 역설). 색 한 단계 + 기울임으로만
        // 물려 대비를 지킨다(이 조합의 최악 대비 6.03:1).
        track.phase === 'leaving' && 'text-slate-400 italic',
      )}
    >
      <Icon
        className={cn(
          'size-3.5',
          track.phase === 'leaving' ? 'text-current' : 'text-slate-300',
        )}
        aria-hidden
      />
      <span
        className={cn(
          'min-w-0 truncate text-[11px]',
          track.phase === 'leaving' ? 'text-current' : 'text-slate-200',
        )}
      >
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
      {/* 거리 — 이 패널에서 가장 큰 글자. 운영자가 판단에 쓰는 수치는
          거리 하나이므로 종류·속도보다 위계가 확실히 위여야 한다.
          단위는 한 단계 작고 어둡게 — 매 행 반복되므로 눈이 걸러낸다 */}
      <span
        className={cn(
          'text-right font-mono text-[15px] leading-none font-bold tabular-nums',
          // 이탈 행은 상속색(slate-400)을 따르고, 활성 행만 흰색으로 튄다
          track.phase === 'leaving' ? 'text-current' : 'text-white',
        )}
      >
        {track.distanceM}
        <span className="ml-0.5 text-[9px] font-normal text-slate-400">m</span>
      </span>
      <span
        className={cn(
          'text-right font-mono text-[10px] tabular-nums',
          track.phase === 'leaving' ? 'text-current' : 'text-slate-300',
        )}
      >
        {track.speedMps.toFixed(1)}
        <span className="ml-0.5 text-slate-400">m/s</span>
      </span>
      {/* 세버리티 배지 — 틴트 배경(대비 4.7:1)이 아니라 솔리드. 한글에
          uppercase·tracking은 자간만 벌려 가독성을 해치므로 쓰지 않는다.
          글리프(▲/●)는 씬 라벨·도움말과 같은 기호 언어 — 도움말이
          가르친 기호가 HUD에서도 이어져야 하고, 적록색맹에게는 색과
          무관한 구분 채널이 된다 */}
      <span
        className={cn(
          'rounded px-1 py-px text-center text-[11px] font-bold',
          danger ? 'bg-red-700 text-white' : 'bg-amber-400 text-slate-950',
        )}
      >
        <span aria-hidden className="mr-0.5 text-[9px]">
          {danger ? '▲' : '●'}
        </span>
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
        // 불투명도 95% — 85%는 밝은 객체가 패널 밑을 지날 때 배경이
        // 비쳐 slate-400 텍스트가 4.44:1까지 떨어진다(기준 4.5:1 미달).
        'absolute top-3 left-3 w-80 overflow-hidden rounded-lg border bg-slate-900/95 shadow-md backdrop-blur-sm',
        // 위험 상태는 1px 테두리가 아니라 링까지 — 목록을 읽지 않아도
        // 패널의 "덩어리"가 경보로 읽힌다.
        overall === 'danger'
          ? 'border-red-500 ring-2 ring-red-500/50'
          : 'border-slate-700/70',
      )}
    >
      {/* 헤더는 정적 라벨이므로 데이터보다 조용하게 — 이전에는 데이터 행과
          같은 11px bold라 목록과 시선을 다퉜다 */}
      <header className="flex items-center gap-1.5 border-b border-slate-700/60 px-2.5 py-1.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
        <ShieldCheck className="size-3" aria-hidden />
        <span className="flex-1">{t('collisionGuard.hud.title')}</span>
        {/* 감시 생존 신호 — 빈 목록 문구는 센서가 죽어도 똑같아서 "시스템이
            지금 보고 있다"를 전달하지 못한다. 씬의 레이더 파장과 같은 sky로
            묶어 중립 상태임을 유지한다(세버리티 인코딩은 행 배지 하나뿐이라는
            이 패널의 규칙을 침범하지 않는다). */}
        <span className="flex items-center gap-1 text-[10px] font-medium tracking-normal text-sky-300/90 normal-case">
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-sky-400 motion-safe:animate-pulse"
          />
          {t('collisionGuard.hud.scanning')}
        </span>
      </header>
      {/* 위험 진입을 스크린리더에 알린다 — 시각 채널(붉은 링·펄스)만으로는
          전달되지 않는다. 상태가 바뀔 때만 문장이 갱신되므로 4Hz 폴링이
          그대로 읽히지 않는다. */}
      <p role="status" aria-live="assertive" className="sr-only">
        {overall === 'danger'
          ? t('collisionGuard.hud.severity.danger')
          : overall === 'warning'
            ? t('collisionGuard.hud.severity.warning')
            : ''}
      </p>
      {snapshot.tracks.length === 0 ? (
        <p className="px-2.5 py-2 text-[11px] text-slate-300">
          {t('collisionGuard.hud.empty')}
        </p>
      ) : (
        <>
          {/* 행 구분선은 아주 옅게 — 위험 행의 붉은 틴트/모서리 마커와
              줄무늬가 경쟁하지 않아야 한다. */}
          <ul className="divide-y divide-slate-700/30 py-0.5">
            {snapshot.tracks.map((track) => (
              <TrackRow key={track.id} track={track} />
            ))}
          </ul>
          {/* 거리 기준 각주 — "12 m"가 어디서부터인지 화면이 스스로 답한다
              (거더 끝 기준 환산 zoneDisplayDistanceM). 도움말 각주와 같은
              톤으로 데이터 행과 시선을 다투지 않는다. */}
          <p className="border-t border-slate-700/50 px-2.5 py-1 text-[10px] leading-tight text-slate-400">
            {t('collisionGuard.hud.distanceBasis')}
          </p>
        </>
      )}
    </section>
  );
}
