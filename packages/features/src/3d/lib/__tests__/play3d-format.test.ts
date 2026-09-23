import { describe, expect, it } from 'vitest';
import type { SavedSceneInfo } from '@crane/domain/3d';
import type { VirtualTagDefinition } from '@crane/domain/virtual-tag';
import { RUNTIME_STATUS_COLORS } from '../model-runtime-status';
import {
  PLAY3D_DWELL_BOX_CLASS,
  PLAY3D_DWELL_HATCH,
  PLAY3D_DWELL_TONE,
  PLAY3D_STATUS_FILL,
  TICK_COUNT_MAX,
  TIMELINE_FIT_MS,
  TIMELINE_MAX_SCALE,
  TIMELINE_VIEW_TICKS,
  TRANSPORT_TICKS,
  bandPercent,
  coverageRatio,
  eventTimeLabel,
  formatBandSpan,
  formatPercent,
  markerPercent,
  markerSeekLeadMs,
  markerSeekTargetMs,
  msAtFraction,
  niceTickStepMs,
  percentOf,
  rangeBarPercent,
  statusSharePercents,
  tagRowLabel,
  tickTimes,
  timelineAxisMs,
  timelineContentWidth,
  timelineCursorInView,
  timelineFollowScroll,
  timelineRows,
  timelineTrackScale,
  timelineViewTicks,
  transportMarks,
  transportTicks,
  type TimelineScrollGeometry,
} from '../play3d-format';
import {
  computePlay3dStats,
  emptyStatusMs,
  type Play3dEvent,
} from '../play3d-stats';

describe('msAtFraction / markerPercent', () => {
  it('클릭 비율 → 씬 시간, 범위 밖은 clamp', () => {
    expect(msAtFraction(0.5, 10_000)).toBe(5000);
    expect(msAtFraction(-1, 10_000)).toBe(0);
    expect(msAtFraction(2, 10_000)).toBe(10_000);
    expect(msAtFraction(Number.NaN, 10_000)).toBe(0);
    expect(msAtFraction(0.5, 0)).toBe(0);
  });
  it('마커 위치 %', () => {
    expect(markerPercent(2500, 10_000)).toBe(25);
    expect(markerPercent(20_000, 10_000)).toBe(100);
    expect(markerPercent(500, 0)).toBe(0);
  });
});

describe('coverageRatio / percentOf / bandPercent / formatPercent', () => {
  it('coverageRatio: 검사 ÷ 창, 창 0·NaN 이면 null, 1 상한', () => {
    expect(coverageRatio(2500, 10_000)).toBe(0.25);
    expect(coverageRatio(20_000, 10_000)).toBe(1);
    expect(coverageRatio(1000, 0)).toBeNull();
    expect(coverageRatio(Number.NaN, 1000)).toBeNull();
    expect(coverageRatio(1000, Number.NaN)).toBeNull();
  });
  it('percentOf: max 0 은 0, 초과는 100 clamp, NaN 방어', () => {
    expect(percentOf(25, 100)).toBe(25);
    expect(percentOf(3000, 10_000)).toBe(30);
    expect(percentOf(150, 100)).toBe(100);
    expect(percentOf(-5, 100)).toBe(0);
    expect(percentOf(5, 0)).toBe(0);
    expect(percentOf(Number.NaN, 100)).toBe(0);
  });
  it('bandPercent: 역방향은 폭 0, 축 밖은 clamp', () => {
    expect(bandPercent(2000, 6000, 8000)).toEqual({ left: 25, width: 50 });
    expect(bandPercent(6000, 2000, 8000)).toEqual({ left: 75, width: 0 });
    expect(bandPercent(-1000, 20_000, 8000)).toEqual({ left: 0, width: 100 });
    expect(bandPercent(0, 1000, 0)).toEqual({ left: 0, width: 0 });
  });
  it('formatPercent: 반올림, null·NaN 은 —', () => {
    expect(formatPercent(83.4)).toBe('83%');
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(Number.NaN)).toBe('—');
  });
});

describe('statusSharePercents / rangeBarPercent', () => {
  it('statusSharePercents: unknown 을 뺀 시간 대비 %, 적층 시작 위치, 분모 0 이면 null', () => {
    const ms = { running: 6000, idle: 3000, offline: 1000, unknown: 5000 };
    expect(statusSharePercents({ ms, totalMs: 15_000 })).toEqual({
      running: 60,
      idle: 30,
      offline: 10,
      idleLeft: 60,
      offlineLeft: 90,
    });
    expect(
      statusSharePercents({
        ms: { running: 0, idle: 0, offline: 0, unknown: 5000 },
        totalMs: 5000,
      }),
    ).toBeNull();
    expect(
      statusSharePercents({
        ms: { running: 0, idle: 0, offline: 0, unknown: 0 },
        totalMs: 0,
      }),
    ).toBeNull();
  });
  it('rangeBarPercent: 0~1 위치 → %', () => {
    expect(
      rangeBarPercent({ min: 0.25, mean: 0.5, max: 0.75, lo: 0, hi: 40 }),
    ).toEqual({ left: 25, width: 50, mean: 50 });
    expect(rangeBarPercent({ min: 0, mean: 0, max: 0, lo: 5, hi: 6 })).toEqual({
      left: 0,
      width: 0,
      mean: 0,
    });
  });
});

describe('timelineAxisMs / markerSeekLeadMs', () => {
  it('길이가 있으면 길이, 없으면 위치·마지막 사건·1초 중 최대', () => {
    expect(timelineAxisMs(90_000, 5, 5)).toBe(90_000);
    expect(timelineAxisMs(null, 200, 7000)).toBe(7000);
    expect(timelineAxisMs(0, 200, 300)).toBe(1000);
  });
  it('리플레이는 프레임 길이(기본 5초), 시뮬레이션은 0.5초', () => {
    expect(markerSeekLeadMs('replay', 2000)).toBe(2000);
    expect(markerSeekLeadMs('replay', undefined)).toBe(5000);
    expect(markerSeekLeadMs('simulation', 2000)).toBe(500);
  });
  it('markerSeekTargetMs: 선행량만큼 앞, 0 밑으로는 가지 않고 NaN 은 0', () => {
    expect(markerSeekTargetMs(10_000, 'replay', 2000)).toBe(8000);
    expect(markerSeekTargetMs(10_000, 'simulation', undefined)).toBe(9500);
    expect(markerSeekTargetMs(500, 'simulation', undefined)).toBe(0);
    expect(markerSeekTargetMs(499, 'simulation', undefined)).toBe(0);
    expect(markerSeekTargetMs(Number.NaN, 'replay', 2000)).toBe(0);
  });
});

describe('tagRowLabel', () => {
  const defs = [
    { key: 'v1', name: '주권 높이', unit: 'm' },
    { key: 'v2', name: '', unit: undefined },
  ] as VirtualTagDefinition[];
  const scene = {
    models: [
      { id: 'm1', equipName: 'GC#1', craneId: 'gc-01' },
      { id: 'm2', equipName: '', craneId: 'goliath-crane-1' },
      { id: 'm3', equipName: 'NoCrane' },
    ],
  } as SavedSceneInfo;
  const sim = { source: 'simulation' as const, defs, scene };
  const replay = { source: 'replay' as const, defs, scene };

  it('시뮬레이션: 정의의 이름·단위, 이름이 비면 키, 단위 없으면 빈 문자열', () => {
    expect(tagRowLabel('v1', sim)).toEqual({ label: '주권 높이', unit: 'm' });
    expect(tagRowLabel('v2', sim)).toEqual({ label: 'v2', unit: '' });
  });
  it('시뮬레이션: 정의가 없으면 키 그대로', () => {
    expect(tagRowLabel('gc_01:mh1_weight', sim)).toEqual({
      label: 'gc_01:mh1_weight',
      unit: '',
    });
  });
  it('리플레이: craneKey:tagCode → 장비 이름 · 카탈로그 표시명·단위', () => {
    expect(tagRowLabel('gc_01:mh1_weight', replay)).toEqual({
      label: 'GC#1 · MH#1 Weight',
      unit: 'ton',
    });
  });
  it('리플레이: 하이픈 craneId 는 밑줄로 맞추고, 장비 이름이 비면 craneKey', () => {
    expect(tagRowLabel('goliath_crane_1:ah2_height', replay)).toEqual({
      label: 'goliath_crane_1 · AH#2 Height',
      unit: 'm',
    });
  });
  it('리플레이: 씬에 크레인이 없거나 scene 이 null 이면 craneKey 를 이름으로', () => {
    expect(tagRowLabel('zz_9:mh1_height', replay)).toEqual({
      label: 'zz_9 · MH#1 Height',
      unit: 'm',
    });
    expect(tagRowLabel('gc_01:mh1_height', { ...replay, scene: null })).toEqual(
      { label: 'gc_01 · MH#1 Height', unit: 'm' },
    );
  });
  it('리플레이: 콜론이 없거나 앞·뒤가 비면 키 그대로', () => {
    for (const key of ['novalue', ':x', 'a:', '']) {
      expect(tagRowLabel(key, replay)).toEqual({ label: key, unit: '' });
    }
  });
  it('리플레이: 카탈로그 단위가 없으면 빈 문자열', () => {
    expect(tagRowLabel('gc_01:heartbeat', replay)).toEqual({
      label: 'GC#1 · Heartbeat',
      unit: '',
    });
  });
});

describe('timelineAxisMs — 네 입력의 최대', () => {
  it('timelineAxisMs: 길이·위치·마지막 사건·닿은 지점 중 최대 — 위치가 길이와 같음·+1ms', () => {
    expect(timelineAxisMs(90_000, 5, 5)).toBe(90_000);
    expect(timelineAxisMs(90_000, 90_000, 0)).toBe(90_000);
    expect(timelineAxisMs(90_000, 90_001, 0)).toBe(90_001);
    expect(timelineAxisMs(90_000, 1000, 250_000)).toBe(250_000);
  });
  it('timelineAxisMs: 닿은 지점만 넘는 경우 — 뒤로 seek 해도 축은 줄지 않는다', () => {
    // 반복 시나리오: 5분까지 재생한 뒤 1분으로 되돌아가도 축은 5분이다.
    expect(timelineAxisMs(90_000, 60_000, 0, 300_000)).toBe(300_000);
    expect(timelineAxisMs(90_000, 60_000, 0, 89_999)).toBe(90_000);
    expect(timelineAxisMs(null, 60_000, 0, 300_000)).toBe(300_000);
  });
  it('timelineAxisMs: 열린 구간에서 정지 중 앞으로 뛴 뒤 뒤로 seek — 축은 닿은 지점에 고정', () => {
    // 검사 구간이 없어도(재생한 적 없음) 닿은 지점이 축을 잡아 손잡이가 끝으로 튀지 않는다.
    expect(timelineAxisMs(null, 12_500, 0, 25_000)).toBe(25_000);
    expect(timelineAxisMs(null, 25_000, 0, 25_000)).toBe(25_000);
    expect(timelineAxisMs(null, 25_001, 0, 25_000)).toBe(25_001);
    expect(timelineAxisMs(null, 0, 0, 0)).toBe(1000);
    expect(timelineAxisMs(null, 500, 0, Number.NaN)).toBe(1000);
    expect(timelineAxisMs(null, 500, 0, -1)).toBe(1000);
  });
  it('timelineAxisMs: 길이 null·0 은 1초 바닥, NaN·Infinity 는 건너뛰고 네 번째 인자 생략 가능', () => {
    expect(timelineAxisMs(null, 200, 7000)).toBe(7000);
    expect(timelineAxisMs(0, 200, 300)).toBe(1000);
    expect(timelineAxisMs(60_000, Number.NaN, Number.NaN, Number.NaN)).toBe(
      60_000,
    );
    expect(timelineAxisMs(null, Number.NaN, 4000)).toBe(4000);
    expect(timelineAxisMs(null, Number.NaN, Number.NaN)).toBe(1000);
    expect(timelineAxisMs(null, Infinity, 2000, Infinity)).toBe(2000);
    expect(timelineAxisMs(Number.NaN, 10, 10)).toBe(1000);
  });
});

describe('timelineTrackScale / timelineContentWidth', () => {
  it('timelineTrackScale: FIT 이하는 1, 넘으면 축 ÷ FIT — 경계 정확값·+1ms·2배', () => {
    expect(timelineTrackScale(TIMELINE_FIT_MS / 2)).toBe(1);
    expect(timelineTrackScale(TIMELINE_FIT_MS)).toBe(1);
    expect(timelineTrackScale(TIMELINE_FIT_MS + 1)).toBeGreaterThan(1);
    expect(timelineTrackScale(TIMELINE_FIT_MS * 2)).toBe(2);
    expect(timelineTrackScale(TIMELINE_FIT_MS * 36)).toBe(36);
  });
  it('timelineTrackScale: 0·음수·NaN·±Infinity 는 1, 상한은 TIMELINE_MAX_SCALE — 정확값·초과', () => {
    for (const v of [0, -5000, Number.NaN, Infinity, -Infinity]) {
      expect(timelineTrackScale(v)).toBe(1);
    }
    expect(timelineTrackScale(TIMELINE_FIT_MS * TIMELINE_MAX_SCALE)).toBe(
      TIMELINE_MAX_SCALE,
    );
    expect(timelineTrackScale(TIMELINE_FIT_MS * TIMELINE_MAX_SCALE * 3)).toBe(
      TIMELINE_MAX_SCALE,
    );
  });
  it('timelineContentWidth: 배율 1 이하·NaN·Infinity 는 100%, 넘으면 배율 × 100%', () => {
    expect(timelineContentWidth(1)).toBe('100%');
    expect(timelineContentWidth(0.5)).toBe('100%');
    expect(timelineContentWidth(Number.NaN)).toBe('100%');
    expect(timelineContentWidth(Infinity)).toBe('100%');
    expect(timelineContentWidth(2.5)).toBe('250%');
  });
});

describe('niceTickStepMs / tickTimes / timelineViewTicks / transportTicks', () => {
  it('niceTickStepMs: span ÷ step ≤ maxTicks 인 가장 작은 단위 — 경계 정확값(3분÷6 → 30초)·+1ms(→ 1분)', () => {
    expect(niceTickStepMs(180_000, 6)).toBe(30_000);
    expect(niceTickStepMs(180_001, 6)).toBe(60_000);
    expect(niceTickStepMs(6_000, 6)).toBe(1_000);
    expect(niceTickStepMs(3_600_000, 10)).toBe(600_000);
  });
  it('niceTickStepMs: 0·음수·NaN·Infinity span 은 첫 단위, maxTicks 0·NaN·음수는 1 로, 목록을 넘으면 마지막 단위의 배수', () => {
    for (const v of [0, -1, Number.NaN, Infinity]) {
      expect(niceTickStepMs(v, 6)).toBe(1_000);
    }
    for (const max of [0, -3, Number.NaN]) {
      expect(niceTickStepMs(30_000, max)).toBe(30_000);
    }
    // 6시간(마지막 후보)을 넘는 구간: 100시간 ÷ 4칸 = 25시간 → 6시간의 배수로 올림.
    expect(niceTickStepMs(360_000_000, 4)).toBe(21_600_000 * 5);
  });
  it('tickTimes: 끝 반 칸 안의 배수는 빼고 축 끝과 같은 배수는 넣는다 — 7칸·7.4칸·7.5칸·7.5칸−1ms', () => {
    const STEP = 60_000;
    expect(tickTimes(STEP * 7, STEP)).toEqual(
      [0, 1, 2, 3, 4, 5, 6, 7].map((i) => i * STEP),
    );
    expect(tickTimes(STEP * 7.4, STEP).at(-1)).toBe(STEP * 6);
    expect(tickTimes(STEP * 7.5, STEP).at(-1)).toBe(STEP * 7);
    expect(tickTimes(STEP * 7.5 - 1, STEP).at(-1)).toBe(STEP * 6);
  });
  it('tickTimes: 0·음수·NaN 축·간격은 [0], 간격이 지나치게 작아도 개수는 상한 이하', () => {
    for (const v of [0, -1, Number.NaN, Infinity]) {
      expect(tickTimes(v, 1000)).toEqual([0]);
      expect(tickTimes(60_000, v)).toEqual([0]);
    }
    const dense = tickTimes(10_000_000, 1);
    expect(dense.length).toBeLessThanOrEqual(TICK_COUNT_MAX + 1);
    expect(dense[0]).toBe(0);
  });
  it('timelineViewTicks: FIT 이하도 둥근 배수, 축이 자라도 앞 눈금은 그대로', () => {
    expect(timelineViewTicks(90_000)).toEqual([
      0, 15_000, 30_000, 45_000, 60_000, 75_000, 90_000,
    ]);
    const a = timelineViewTicks(TIMELINE_FIT_MS * 2);
    const b = timelineViewTicks(TIMELINE_FIT_MS * 2.6);
    expect(a[1]).toBe(30_000);
    expect(b.slice(0, a.length - 1)).toEqual(a.slice(0, a.length - 1));
    for (const v of [0, -1, Number.NaN, Infinity]) {
      expect(timelineViewTicks(v)).toEqual([0]);
    }
  });
  it('timelineViewTicks: 배율 상한에서 개수·첫 간격·마지막 값 정확값, 상한을 넘으면 간격이 커져 개수는 그대로', () => {
    const atCap = TIMELINE_FIT_MS * TIMELINE_MAX_SCALE;
    const step = niceTickStepMs(TIMELINE_FIT_MS, TIMELINE_VIEW_TICKS);
    const capTicks = timelineViewTicks(atCap);
    expect(capTicks).toHaveLength(atCap / step + 1);
    expect(capTicks[1]).toBe(step);
    expect(capTicks.at(-1)).toBe(atCap);
    const beyond = timelineViewTicks(atCap * 10);
    expect(beyond).toHaveLength(capTicks.length);
    expect(beyond[1]).toBe(step * 10);
    expect(beyond.at(-1)).toBe(atCap * 10);
  });
  it('transportTicks: 축 전체 기준 — 0 시작, 칸 수는 상한 이하, 비정상 축은 [0]', () => {
    const ticks = transportTicks(3_600_000);
    expect(ticks[0]).toBe(0);
    expect(ticks[1]).toBe(600_000);
    expect(ticks.at(-1)).toBe(3_600_000);
    expect(ticks.length).toBeLessThanOrEqual(TRANSPORT_TICKS + 1);
    expect(transportTicks(Number.NaN)).toEqual([0]);
  });
});

describe('timelineCursorInView / timelineFollowScroll', () => {
  // 정수 픽스처: 트랙 2000px → 1% = 20px, 보이는 폭 400px, 최대 스크롤 1600.
  const geometry = (
    cursorPercent: number,
    scrollLeft: number,
    patch: Partial<TimelineScrollGeometry> = {},
  ): TimelineScrollGeometry => ({
    cursorPercent,
    scrollLeft,
    clientWidth: 400,
    scrollWidth: 2000,
    ...patch,
  });
  const follow = (
    cursorPercent: number,
    scrollLeft: number,
    isPlaying: boolean,
    wasInView = true,
    patch: Partial<TimelineScrollGeometry> = {},
  ) =>
    timelineFollowScroll({
      ...geometry(cursorPercent, scrollLeft, patch),
      isPlaying,
      wasInView,
    });
  const none = { scrollLeft: null, inView: true };

  it('timelineCursorInView: 보이는 범위 양 끝 정확값·허용오차 1px 은 보임, 그 밖 1px 은 안 보임', () => {
    // 50% → x = 1000. 오른쪽 끝: scrollLeft + 400(+1) 이상이어야 보인다.
    expect(timelineCursorInView(geometry(50, 600))).toBe(true);
    expect(timelineCursorInView(geometry(50, 599))).toBe(true);
    expect(timelineCursorInView(geometry(50, 598))).toBe(false);
    expect(timelineCursorInView(geometry(50, 1000))).toBe(true);
    expect(timelineCursorInView(geometry(50, 1001))).toBe(true);
    expect(timelineCursorInView(geometry(50, 1002))).toBe(false);
  });

  it('timelineCursorInView: 범위 밖 퍼센트는 0·100 으로 clamp — scrollLeft clamp 에 가려지지 않게 보임 판정으로 고정', () => {
    expect(timelineCursorInView(geometry(250, 1600))).toBe(true);
    expect(timelineCursorInView(geometry(-10, 0))).toBe(true);
    expect(follow(250, 1600, true)).toEqual(none);
    expect(follow(-10, 1002, false)).toEqual({ scrollLeft: 0, inView: true });
    expect(follow(250, 0, false)).toEqual({ scrollLeft: 1600, inView: true });
  });

  it('timelineFollowScroll: 넘침 없음·0 크기·scrollWidth < clientWidth 는 null·inView true', () => {
    expect(follow(50, 0, true, false, { scrollWidth: 400 })).toEqual(none);
    expect(follow(50, 0, true, false, { scrollWidth: 399 })).toEqual(none);
    expect(
      follow(50, 0, false, true, { scrollWidth: 0, clientWidth: 0 }),
    ).toEqual(none);
    expect(timelineCursorInView(geometry(50, 0, { scrollWidth: 400 }))).toBe(
      true,
    );
  });

  it('timelineFollowScroll: clientWidth 0 은 판단하지 않고 1 은 동작, 넘침 10px 이면 10 으로', () => {
    expect(follow(50, 0, true, true, { clientWidth: 0 })).toEqual(none);
    expect(follow(50, 0, true, true, { clientWidth: 1 }).scrollLeft).toBe(1000);
    expect(follow(100, 0, true, true, { scrollWidth: 410 })).toEqual({
      scrollLeft: 10,
      inView: true,
    });
  });

  it('timelineFollowScroll: 재생 중 오른쪽 끝을 넘으면 page-flip, 경계 정확값은 그대로', () => {
    expect(follow(50, 599, true)).toEqual(none);
    // 커서가 보이는 폭(400px)의 왼쪽 10% 지점: 1000 − 40.
    expect(follow(50, 598, true)).toEqual({ scrollLeft: 960, inView: true });
  });

  it('timelineFollowScroll: 재생 중 뒤로 점프하면 가운데로, 왼쪽은 0 으로 clamp', () => {
    expect(follow(50, 1002, true)).toEqual({ scrollLeft: 800, inView: true });
    expect(follow(5, 1002, true)).toEqual({ scrollLeft: 0, inView: true });
    expect(follow(0, 1002, true)).toEqual({ scrollLeft: 0, inView: true });
  });

  it('timelineFollowScroll: 100% 는 scrollWidth − clientWidth 에 멈춘다(자라는 축의 끝 고정) — 재생·일시정지 모두', () => {
    expect(follow(100, 0, true)).toEqual({ scrollLeft: 1600, inView: true });
    expect(follow(100, 0, false)).toEqual({ scrollLeft: 1600, inView: true });
    expect(follow(100, 1600, true)).toEqual(none);
  });

  it('timelineFollowScroll: 재생 중 wasInView=false 면 따라가지 않고 false 유지, 다시 보이면 true', () => {
    expect(follow(50, 0, true, false)).toEqual({
      scrollLeft: null,
      inView: false,
    });
    expect(follow(50, 700, true, false)).toEqual(none);
  });

  it('timelineFollowScroll: 일시정지 중 화면 밖이면 wasInView 와 무관하게 가운데로(page-flip 아님)', () => {
    expect(follow(50, 0, false, false)).toEqual({
      scrollLeft: 800,
      inView: true,
    });
    expect(follow(50, 0, false, true)).toEqual({
      scrollLeft: 800,
      inView: true,
    });
    expect(follow(50, 0, true, true)).toEqual({
      scrollLeft: 960,
      inView: true,
    });
  });

  it('timelineFollowScroll: NaN·Infinity 치수는 판단하지 않는다', () => {
    expect(follow(Number.NaN, 0, true)).toEqual(none);
    expect(follow(50, Number.NaN, true)).toEqual(none);
    expect(follow(50, 0, true, true, { scrollWidth: Infinity })).toEqual(none);
    expect(follow(50, 0, true, true, { clientWidth: Number.NaN })).toEqual(
      none,
    );
  });

  it('timelineFollowScroll: 결과는 반올림 — .5 양옆 픽스처로 floor·ceil 과 구분', () => {
    // 보이는 폭 403 → 선행 40.3 → 959.7 → 960 (floor 면 959).
    expect(follow(50, 0, true, true, { clientWidth: 403 }).scrollLeft).toBe(
      960,
    );
    // 보이는 폭 407 → 선행 40.7 → 959.3 → 959 (ceil 이면 960).
    expect(follow(50, 0, true, true, { clientWidth: 407 }).scrollLeft).toBe(
      959,
    );
  });

  it('timelineFollowScroll: 돌려준 scrollLeft 를 적용하면 위치는 항상 보인다(불변식)', () => {
    for (const isPlaying of [true, false]) {
      for (let percent = 0; percent <= 100; percent += 7) {
        for (let scrollLeft = 0; scrollLeft <= 1600; scrollLeft += 123) {
          const next = follow(percent, scrollLeft, isPlaying);
          const applied = next.scrollLeft ?? scrollLeft;
          expect(timelineCursorInView(geometry(percent, applied))).toBe(true);
          expect(next.inView).toBe(true);
        }
      }
    }
  });
});

describe('PLAY3D_STATUS_FILL / PLAY3D_DWELL_*', () => {
  const channels = (hex: string) =>
    [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  const luma = (hex: string) => channels(hex).reduce((a, b) => a + b, 0);

  it('PLAY3D_STATUS_FILL: 리포트 전용 — 가동은 전역 색 그대로, 대기·두절은 서로 다른 회색 계열·대기가 더 밝다, unknown 은 null', () => {
    expect(PLAY3D_STATUS_FILL.running).toBe(RUNTIME_STATUS_COLORS.running);
    expect(PLAY3D_STATUS_FILL.unknown).toBeNull();
    const idle = PLAY3D_STATUS_FILL.idle ?? '';
    const offline = PLAY3D_STATUS_FILL.offline ?? '';
    for (const hex of [PLAY3D_STATUS_FILL.running ?? '', idle, offline]) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(idle).not.toBe(RUNTIME_STATUS_COLORS.idle);
    // 3D 라벨의 두절이 중립 회색 계열이라 같은 값이면 한 화면에서 뜻이 뒤집힌다.
    expect(idle).not.toBe(RUNTIME_STATUS_COLORS.offline);
    expect(idle).not.toBe(offline);
    expect(luma(idle)).toBeGreaterThan(luma(offline));
    for (const hex of [idle, offline]) {
      const c = channels(hex);
      expect(Math.max(...c) - Math.min(...c)).toBeLessThanOrEqual(48);
    }
  });

  it('PLAY3D_DWELL_*: 빗금은 currentColor 줄 + 투명 바탕의 한 문자열, 등급별 톤이 다르고 박스는 그 색 테두리', () => {
    expect(PLAY3D_DWELL_HATCH).toContain('repeating-linear-gradient');
    expect(PLAY3D_DWELL_HATCH).toContain('currentColor');
    expect(PLAY3D_DWELL_HATCH).toContain('transparent');
    expect(PLAY3D_DWELL_TONE.warn).not.toBe(PLAY3D_DWELL_TONE.stop);
    expect(PLAY3D_DWELL_TONE.warn).toMatch(/^text-/);
    expect(PLAY3D_DWELL_TONE.stop).toMatch(/^text-/);
    expect(PLAY3D_DWELL_BOX_CLASS).toContain('border-current');
  });
});

describe('eventTimeLabel / formatBandSpan', () => {
  const frames = [
    { timestamp: '2026-09-18T09:03:12' },
    { timestamp: 'not-a-timestamp' },
  ];
  it('eventTimeLabel: 리플레이는 그 프레임의 실제 시각, 시뮬레이션·범위 밖 프레임은 씬 시계', () => {
    expect(eventTimeLabel({ atMs: 192_000, frameIndex: 0 }, frames)).toBe(
      '09:03:12',
    );
    expect(eventTimeLabel({ atMs: 192_000, frameIndex: null }, frames)).toBe(
      '03:12',
    );
    expect(eventTimeLabel({ atMs: 192_000, frameIndex: 9 }, frames)).toBe(
      '03:12',
    );
    expect(eventTimeLabel({ atMs: 192_000, frameIndex: 0 }, [])).toBe('03:12');
    // 형식이 다른 타임스탬프는 포매터가 원문을 돌려준다(현재 동작).
    expect(eventTimeLabel({ atMs: 0, frameIndex: 1 }, frames)).toBe(
      'not-a-timestamp',
    );
  });
  it('formatBandSpan: 시작 ~ 끝 (길이), 진행 중 문구·역방향은 길이 0', () => {
    expect(formatBandSpan(240_000, 310_000)).toBe('04:00 ~ 05:10 (01:10)');
    expect(formatBandSpan(240_000, 310_000, '진행 중')).toBe(
      '04:00 ~ 진행 중 (01:10)',
    );
    expect(formatBandSpan(310_000, 240_000)).toBe('05:10 ~ 04:00 (00:00)');
    expect(formatBandSpan(0, 0)).toBe('00:00 ~ 00:00 (00:00)');
  });
});

describe('timelineRows / transportMarks', () => {
  let id = 1;
  const ev = (
    kind: Play3dEvent['kind'],
    atMs: number,
    subject: string,
    extra: Partial<Play3dEvent> = {},
  ): Play3dEvent => ({
    id: id++,
    kind,
    atMs,
    frameIndex: null,
    subject,
    label: subject,
    ...extra,
  });
  const running = () => ({ ...emptyStatusMs(), running: 1000 });
  const timeLabel = (e: Play3dEvent) => `t${e.atMs}`;

  it('timelineRows: 장비 순서 유지, 충돌은 양쪽 행·체류는 배정 규칙, unknown 구간은 그리지 않는다', () => {
    const c1 = ev('collision', 1000, 'a|b', { modelIds: ['a', 'b'] });
    const c2 = ev('collision', 3000, 'a|b', { modelIds: ['a', 'b'] });
    const enter = ev('zoneEnter', 2000, 'a#z|b', {
      zoneKey: 'a#z',
      ownerId: 'a',
      intruderId: 'b',
      level: 'stop',
    });
    const stats = computePlay3dStats({
      events: [c2, enter, c1],
      statusTransitions: [
        { atMs: 0, modelId: 'a', from: 'unknown', to: 'running' },
        { atMs: 0, modelId: 'b', from: 'unknown', to: 'idle' },
        { atMs: 4000, modelId: 'b', from: 'idle', to: 'unknown' },
      ],
      statuses: {
        a: { modelId: 'a', name: 'A', ms: running() },
        b: { modelId: 'b', name: 'B', ms: running() },
      },
      tags: {},
      scanned: [{ fromMs: 0, toMs: 5000 }],
      windowEndMs: 5000,
      scenarioDurationMs: null,
      holdWallMs: 0,
      detectionOffSeen: false,
    });
    const rows = timelineRows(stats, timeLabel);
    expect(rows.map((r) => r.modelId)).toEqual(['a', 'b']);
    expect(rows[0].collisions.map((m) => m.key)).toEqual([
      `c${c1.id}`,
      `c${c2.id}`,
    ]);
    expect(rows[1].collisions.map((m) => m.key)).toEqual([
      `c${c1.id}`,
      `c${c2.id}`,
    ]);
    expect(rows[0].zones).toEqual([]);
    expect(rows[1].zones.map((m) => [m.key, m.dim])).toEqual([
      [`z${enter.id}`, false],
    ]);
    expect(rows[1].zones[0].payload).toMatchObject({
      kind: 'zone',
      band: { fromMs: 2000, toMs: 5000, open: true, level: 'stop' },
    });
    expect(rows[0].collisions[1].payload).toEqual({
      kind: 'collision',
      event: c2,
      timeLabel: 't3000',
      summary: { ordinal: 2, total: 2 },
    });
    expect(rows[0].status.map((m) => m.payload)).toEqual([
      {
        kind: 'status',
        name: 'A',
        band: { fromMs: 0, toMs: 5000, status: 'running' },
      },
    ]);
    // b 의 4000 이후 unknown 구간은 표식이 없다.
    expect(rows[1].status.map((m) => [m.band.fromMs, m.band.toMs])).toEqual([
      [0, 4000],
    ]);
  });

  it('timelineRows: 장비가 없으면 빈 배열, 사건이 없으면 행마다 빈 표식', () => {
    const base = {
      events: [],
      statusTransitions: [],
      scanned: [],
      windowEndMs: 0,
    };
    expect(timelineRows({ ...base, equipment: [] }, timeLabel)).toEqual([]);
    const stats = computePlay3dStats({
      events: [],
      statuses: { a: { modelId: 'a', name: 'A', ms: running() } },
      tags: {},
      scanned: [],
      windowEndMs: 1000,
      scenarioDurationMs: null,
      holdWallMs: 0,
      detectionOffSeen: false,
    });
    expect(timelineRows(stats, timeLabel)).toEqual([
      { modelId: 'a', name: 'A', status: [], zones: [], collisions: [] },
    ]);
  });

  it('transportMarks: 창 뒤 표식은 dim, 시각순이 아닌 원시 사건도 시각 기준으로 순번을 매기고 충돌 선이 마지막', () => {
    const late = ev('collision', 5000, 'a|b', { modelIds: ['a', 'b'] });
    const early = ev('collision', 1000, 'a|b', { modelIds: ['a', 'b'] });
    const enter = ev('zoneEnter', 2000, 'a#z|b', {
      zoneKey: 'a#z',
      intruderId: 'b',
    });
    const hold = ev('holdStart', 2500, 'zone');
    const back = ev('offlineExit', 2600, 'a');
    const broken = ev('collision', Number.NaN, 'a|b');
    const marks = transportMarks(
      [late, early, enter, hold, back, broken],
      3000,
      timeLabel,
    );
    // 영역: 미이탈은 실행 전체의 끝(마지막 사건 5000)까지, 창 안에서 시작해 dim 아님.
    expect(marks.zones).toHaveLength(1);
    expect(marks.zones[0]).toMatchObject({
      key: `z${enter.id}`,
      dim: false,
      band: { fromMs: 2000, toMs: 5000, open: true },
    });
    // 선: 복귀(표식 종류 아님)·NaN 시각은 빠지고, 충돌이 뒤에 온다.
    expect(marks.lines.map((m) => [m.key, m.dim])).toEqual([
      [`e${hold.id}`, false],
      [`e${late.id}`, true],
      [`e${early.id}`, false],
    ]);
    expect(marks.lines[0].payload).toEqual({
      kind: 'event',
      event: hold,
      timeLabel: 't2500',
    });
    expect(marks.lines[1].payload).toMatchObject({
      kind: 'collision',
      summary: { ordinal: 2, total: 2 },
    });
    expect(marks.lines[2].payload).toMatchObject({
      kind: 'collision',
      summary: { ordinal: 1, total: 2 },
    });
  });

  it('transportMarks: 빈 사건은 빈 표식, 창 끝이 NaN·음수면 0 으로 보고 그 뒤는 전부 dim', () => {
    expect(transportMarks([], 1000, timeLabel)).toEqual({
      zones: [],
      lines: [],
    });
    const c = ev('collision', 1000, 'a|b');
    for (const windowEnd of [Number.NaN, -5]) {
      expect(transportMarks([c], windowEnd, timeLabel).lines[0].dim).toBe(true);
    }
    expect(transportMarks([c], 1000, timeLabel).lines[0].dim).toBe(false);
    expect(transportMarks([c], 999, timeLabel).lines[0].dim).toBe(true);
  });
});
