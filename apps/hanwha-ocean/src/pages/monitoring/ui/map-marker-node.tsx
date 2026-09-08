import type { ReactNode } from 'react';
import { cn } from '@crane/core/lib/utils';
import type { StatusLevel } from '@crane/core/types/status';
import { identityAlpha, type MapIdentityStyle } from '../lib/marker-identity';
import {
  getMapSymbolStyle,
  getStatusPalette,
  symbolAlpha,
  withAlpha,
  type BasemapTone,
  type MapSymbolStyle,
} from '../model/region-map-types';
import { GlassSurface } from './glass-surface';

interface MapMarkerNodeProps {
  statusLevel: StatusLevel;
  /** 지도 배경 밝기 — 지도 위에 그리는 도형 색이 이걸 따른다 */
  basemap: BasemapTone;
  /** 플레이트 선두 글리프 — region 은 도크 코드, site 는 앵커 아이콘 */
  glyph: ReactNode;
  /**
   * 글리프 칩의 식별색 — "이게 **어느** 도크인가".
   * 상태색과 계열을 갈라 둔 값이라 상태 띠/표식과 섞이지 않는다.
   */
  identity: MapIdentityStyle;
  /**
   * 상태를 글자로 못박는 라벨 (정상 · 경고 · 이상).
   *
   * **도크 마커에만 준다.** 세계 레벨의 사이트 마커에는 넘기지 않는다 —
   * 거기서 필요한 것은 "어느 사이트에 문제가 있나" 뿐이고 그건 경고·이상
   * 개수 배지와 표식 색이 이미 말한다. 사이트마다 "정상" 을 한 번 더 적으면
   * 아무 일도 없을 때 화면에서 가장 긴 글자가 "정상" 이 된다.
   */
  statusLabel?: string;
  /** 항상 노출되는 이름 (호버 없이 식별되도록) */
  label: string;
  /** 실시간 경고 건수 — 0 이면 배지를 그리지 않는다 */
  warningCount: number;
  /** 실시간 이상 건수 — 0 이면 배지를 그리지 않는다 */
  criticalCount: number;
  warningLabel: string;
  criticalLabel: string;
  active: boolean;
  onActivate: () => void;
  /** 리더 스템 길이(px). 계층별로 달리 줘서 마커 높이를 구분한다 */
  stemLength: number;
}

/**
 * 지도 마커 본체 — 측량 표식(ground reticle) + 리더 스템 + 식별 플레이트.
 *
 * 구글맵 기본 물방울 핀 대신, 오버레이와 같은 유리 재질의 판을 쓴다.
 * 박스의 아래쪽 가장자리가 실제 좌표이고, reticle 은 그 위에 중심을 맞춰
 * 절반이 박스 밖으로 걸치므로 원(reticle) 정중앙이 좌표점이 된다.
 * 마운트 위치는 AdvancedMarker 의 anchorPoint=BOTTOM_CENTER 가 잡는다.
 *
 * 색 규칙이 두 갈래인 데 주의: 플레이트 **안쪽**은 자기 배경(유리판)을
 * 깔고 있으니 앱 테마 팔레트를 쓰고, 지도 위에 **직접** 그리는 표식·스템은
 * 배경 밝기(basemap)를 따르는 심볼 색 + 케이싱을 쓴다.
 *
 * 마커 하나가 두 가지를 동시에 말한다 — **어디/무엇**(식별색 칩 + 이름)과
 * **어떤 상태**(왼쪽 띠 · 상태 알약 · 표식). 둘은 색 계열을 갈라 둔다.
 * 식별은 한색(sky·indigo·fuchsia…), 상태는 초록·주황·빨강이다. 한 판에 같은
 * 계열 두 색이 있으면 "저 색이 상태인가 이름인가"를 매번 되묻게 된다.
 *
 * 상태를 **글자로도** 적는 이유: 예전에는 지도 구석의 범례가 색과 뜻을 잇는
 * 유일한 장치여서 마커를 볼 때마다 시선이 범례를 왕복해야 했다. 마커가 스스로
 * 말하면 범례가 필요 없다 — 그래서 범례 컨트롤은 지웠다.
 *
 * 예전 이 마커에는 코너 브래킷과 회전 스캔 섹터가 붙어 있었다. 둘 다
 * 아무 값도 나르지 않으면서 마커마다 반복돼, 지도가 정보판이 아니라
 * SF 인터페이스 스틸컷처럼 보이게 만들던 것이라 걷어냈다.
 *
 * 지금 남은 모션은 둘이다. 좌표점의 잔물결은 critical 일 때만 돌고 "지금 봐야 한다" 는
 * 뜻을 갖는다. 판의 부유는 뜻을 나르지 않는 대신 **깊이**를 만든다 — 판이
 * 지도 위에 얹힌 스티커가 아니라 그 위에 떠 있는 물체라는 것을, 정지 화면의
 * 그림자만으로는 끝내 전달되지 않아서 넣었다. 모션 축소 설정에서는 멈춘다.
 */
export function MapMarkerNode({
  statusLevel,
  basemap,
  glyph,
  identity,
  label,
  statusLabel,
  warningCount,
  criticalCount,
  warningLabel,
  criticalLabel,
  active,
  onActivate,
  stemLength,
}: MapMarkerNodeProps) {
  const palette = getStatusPalette(statusLevel);
  const symbol = getMapSymbolStyle(statusLevel, basemap);
  const isCritical = statusLevel === 'critical';
  const hasBadges = warningCount > 0 || criticalCount > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onActivate();
        }
      }}
      className="group/marker relative flex cursor-pointer flex-col items-center outline-none"
      style={{ animation: 'map-panel-reveal 420ms ease-out both' }}
    >
      {/*
        ── 부유 그룹: 판 + 리더 스템 ──
        이 그룹만 오르내리고 지면의 측량 표식은 가만히 있는다. 예전에는 마커
        전체(root)에 부양을 걸어서 표식까지 같이 움직였는데, 판과 지면의 상대
        변위가 0 이면 아무리 움직여도 "떠오른다" 로 보이지 않는다.

        진폭 3px 은 표식 중심 원의 반지름보다 작게 잡은 값이다. 그래야 스템의
        아래 끝이 늘 그 원 안에 머물러 선이 끊어져 보이지 않는다 — 스템을
        늘였다 줄였다 하지 않고도 항상 이어져 있는 것처럼 보이는 이유다.
      */}
      <div
        className={cn(
          'relative z-10 flex flex-col items-center',
          'animate-[map-marker-float_3.6s_ease-in-out_infinite]',
          'motion-reduce:animate-none',
        )}
      >
        <div className="relative">
          {/*
            판이 지면에 드리우는 그림자.

            부모의 상하 이동을 **반대 위상으로 상쇄**해서 자기는 지면에 머문다
            (부모가 −3px 갈 때 이 요소는 +3px). 그림자가 판을 따라 같이
            움직이면 물체가 뜨는 게 아니라 화면이 통째로 흔들려 보인다.
            동시에 넓어지고 옅어진다 — 광원에서 멀어질 때 실제로 일어나는 일이다.
          */}
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-x-1.5 rounded-[50%] blur-[6px]',
              'animate-[map-marker-float-shadow_3.6s_ease-in-out_infinite]',
              'motion-reduce:animate-none',
              'transition-[height,bottom] duration-200 ease-out',
              active ? '-bottom-1.5 h-4' : '-bottom-1 h-3.5',
            )}
            style={{ backgroundColor: 'rgb(0 0 0 / 0.55)' }}
          />

          {/* ── 식별 플레이트(네임택) ── */}
          <GlassSurface
            className={cn(
              'bg-white/90 dark:bg-[rgb(18_20_24)]/88',
              'transition-shadow duration-200',
            )}
          >
            {/*
              왼쪽 상태 띠. 플레이트 높이를 꽉 채워서, 지도를 훑을 때 글자를
              읽기 전에 색 덩어리로 먼저 잡힌다.
            */}
            <span
              aria-hidden
              className="w-1.5 shrink-0 self-stretch"
              style={{ backgroundColor: palette.fillColor }}
            />

            <span className="flex items-center gap-2.5 py-2 pr-3 pl-2.5">
              <span
                aria-hidden
                className={cn(
                  'flex size-[30px] shrink-0 items-center justify-center rounded-sm text-[13px] leading-none font-bold tabular-nums',
                  identity.textClass,
                )}
                style={{
                  backgroundColor: identityAlpha(identity, 0.18),
                  boxShadow: `inset 0 0 0 1px ${identityAlpha(identity, 0.45)}`,
                }}
              >
                {glyph}
              </span>

              <span className="text-foreground max-w-[220px] truncate text-base leading-none font-semibold">
                {label}
              </span>

              {/*
                상태 알약 — 도크 마커에서만 정상·경고·이상을 글자로 못박는다.
                예전에는 지도 한쪽 구석의 범례가 색과 뜻을 이어 주는 유일한
                장치라, 마커를 볼 때마다 시선이 범례로 갔다 와야 했다. 마커가
                스스로 말하면 범례가 필요 없다(그래서 범례는 지웠다).
                색각 이상 대비이기도 하다.
              */}
              {statusLabel ? (
                <span
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-sm py-1.5 pr-2.5 pl-2 text-[13px] leading-none font-semibold',
                    palette.textClass,
                  )}
                  style={{ backgroundColor: withAlpha(palette, 0.14) }}
                >
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: palette.fillColor }}
                  />
                  {statusLabel}
                </span>
              ) : null}

              {hasBadges ? (
                <span className="flex shrink-0 items-center gap-1">
                  {warningCount > 0 ? (
                    <CountBadge
                      value={warningCount}
                      statusLevel="warning"
                      srLabel={warningLabel}
                    />
                  ) : null}
                  {criticalCount > 0 ? (
                    <CountBadge
                      value={criticalCount}
                      statusLevel="critical"
                      srLabel={criticalLabel}
                    />
                  ) : null}
                </span>
              ) : null}
            </span>
          </GlassSurface>
        </div>

        {/* ── 리더 스템: 판을 좌표점에 묶는다 ── */}
        <span
          aria-hidden
          className="w-px shrink-0"
          style={{
            height: stemLength,
            backgroundColor: symbol.mark,
            boxShadow: `0 0 0 1.5px ${symbol.casing}`,
          }}
        />
      </div>

      {/* ── 측량 표식: 박스 아래 가장자리(=좌표)에 중심을 맞춘다 ── */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/2 size-[34px] -translate-x-1/2 translate-y-1/2"
      >
        {isCritical ? (
          <span
            className="absolute top-1/2 left-1/2 size-[34px] rounded-full"
            style={{
              backgroundColor: symbolAlpha(symbol, 0.3),
              animation: 'region-map-ripple 1.8s ease-out infinite',
            }}
          />
        ) : null}

        <GroundReticle symbol={symbol} statusLevel={statusLevel} />
      </span>
    </div>
  );
}

/**
 * 좌표점 표식. 상태는 색뿐 아니라 **형태**로도 구분된다 —
 * normal 은 링 하나, warning·critical 은 점선 링을 덧댄다. 색만으로 읽지
 * 않아도 되게 하려는 것이다. 모든 획은 케이싱을 먼저 깔고 그 위에 상태색을
 * 얹는다 — 위성 영상의 초록 육지 위 초록 마커처럼 배경과 색이 겹쳐도
 * 윤곽이 끊기지 않게 하는 지도 심볼의 표준 기법이다.
 */
function GroundReticle({
  symbol,
  statusLevel,
}: {
  symbol: MapSymbolStyle;
  statusLevel: StatusLevel;
}) {
  const isNormal = statusLevel === 'normal';
  const ticks = [
    'M13 0.8 V3.6',
    'M13 22.4 V25.2',
    'M0.8 13 H3.6',
    'M22.4 13 H25.2',
  ];

  return (
    <svg viewBox="0 0 26 26" className="relative size-full" aria-hidden>
      {/* 케이싱 패스 */}
      <circle
        cx="13"
        cy="13"
        r="7.5"
        fill="none"
        stroke={symbol.casing}
        strokeWidth="3.25"
      />
      {!isNormal ? (
        <circle
          cx="13"
          cy="13"
          r="10.5"
          fill="none"
          stroke={symbol.casing}
          strokeWidth="2.6"
          strokeDasharray="2 3.5"
        />
      ) : null}
      {ticks.map((d) => (
        <path
          key={`casing-${d}`}
          d={d}
          stroke={symbol.casing}
          strokeWidth="3.25"
          strokeLinecap="round"
        />
      ))}
      <circle cx="13" cy="13" r="4.6" fill={symbol.casing} />

      {/* 상태색 패스 */}
      <circle
        cx="13"
        cy="13"
        r="7.5"
        fill="none"
        stroke={symbol.mark}
        strokeWidth="1.5"
      />
      {!isNormal ? (
        <circle
          cx="13"
          cy="13"
          r="10.5"
          fill="none"
          stroke={symbol.mark}
          strokeWidth="1.1"
          strokeDasharray="2 3.5"
        />
      ) : null}
      {ticks.map((d) => (
        <path
          key={d}
          d={d}
          stroke={symbol.mark}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ))}
      <circle cx="13" cy="13" r="3.2" fill={symbol.mark} />
    </svg>
  );
}

function CountBadge({
  value,
  statusLevel,
  srLabel,
}: {
  value: number;
  statusLevel: StatusLevel;
  srLabel: string;
}) {
  const palette = getStatusPalette(statusLevel);
  return (
    <span
      title={`${srLabel} ${value}`}
      aria-label={`${srLabel} ${value}`}
      className={cn(
        'inline-flex min-w-[22px] items-center justify-center rounded-sm px-1.5 py-1 text-[12px] leading-none font-bold tabular-nums',
        palette.textClass,
      )}
      style={{ backgroundColor: withAlpha(palette, 0.16) }}
    >
      {value.toString().padStart(2, '0')}
    </span>
  );
}
