import { describe, expect, it } from 'vitest';
import type { SavedSceneInfo } from '@crane/domain/3d';
import type { VirtualTagDefinition } from '@crane/domain/virtual-tag';
import { RUNTIME_STATUS_COLORS } from '../model-runtime-status';
import {
  PLAY3D_STATUS_FILL,
  TIMELINE_FIT_MS,
  TIMELINE_MAX_SCALE,
  TIMELINE_TICK_STEP_MS,
  bandPercent,
  coverageRatio,
  formatPercent,
  markerPercent,
  markerSeekLeadMs,
  msAtFraction,
  percentOf,
  rangeBarPercent,
  reportAxisMs,
  statusSharePercents,
  tagRowLabel,
  timelineAxisMs,
  timelineContentWidth,
  timelineCursorInView,
  timelineFollowScroll,
  timelineTickTimes,
  timelineTicks,
  timelineTrackScale,
  type TimelineScrollGeometry,
} from '../play3d-format';

describe('timelineTicks / msAtFraction / markerPercent', () => {
  it('눈금은 0 과 축 끝을 포함해 n+1 개', () => {
    expect(timelineTicks(8000, 4)).toEqual([0, 2000, 4000, 6000, 8000]);
    expect(timelineTicks(0, 4)).toEqual([0]);
  });
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

describe('reportAxisMs', () => {
  it('reportAxisMs: 길이가 있으면 길이, 위치·마지막 사건이 길이를 넘으면 그 값(반복 시나리오)', () => {
    expect(reportAxisMs(90_000, 5, 5)).toBe(90_000);
    expect(reportAxisMs(90_000, 90_000, 0)).toBe(90_000);
    expect(reportAxisMs(90_000, 90_001, 0)).toBe(90_001);
    expect(reportAxisMs(90_000, 1000, 250_000)).toBe(250_000);
  });
  it('reportAxisMs: 길이 없음은 timelineAxisMs 와 같고, NaN 은 건너뛴다', () => {
    expect(reportAxisMs(null, 200, 7000)).toBe(timelineAxisMs(null, 200, 7000));
    expect(reportAxisMs(0, 200, 300)).toBe(1000);
    expect(reportAxisMs(60_000, Number.NaN, Number.NaN)).toBe(60_000);
    expect(reportAxisMs(null, Number.NaN, 4000)).toBe(4000);
    expect(reportAxisMs(null, Number.NaN, Number.NaN)).toBe(1000);
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
  it('timelineContentWidth: 배율 1 이하·NaN 은 100%, 넘으면 라벨을 뺀 폭만 배율', () => {
    expect(timelineContentWidth(1, 6)).toBe('100%');
    expect(timelineContentWidth(0.5, 6)).toBe('100%');
    expect(timelineContentWidth(Number.NaN, 6)).toBe('100%');
    expect(timelineContentWidth(Infinity, 6)).toBe('100%');
    expect(timelineContentWidth(2, Number.NaN)).toBe('100%');
    expect(timelineContentWidth(2, -1)).toBe('100%');
    expect(timelineContentWidth(2.5, 6)).toBe(
      'calc(6rem + 2.5 * (100% - 6rem))',
    );
  });
});

describe('timelineTickTimes', () => {
  const STEP = TIMELINE_TICK_STEP_MS;
  it('timelineTickTimes: FIT 이하는 4등분(0 과 축 끝 포함) — 경계 정확값은 4등분, +1ms 는 눈금 간격 배수', () => {
    expect(timelineTickTimes(8000)).toEqual([0, 2000, 4000, 6000, 8000]);
    expect(timelineTickTimes(TIMELINE_FIT_MS)).toEqual(
      timelineTicks(TIMELINE_FIT_MS, 4),
    );
    const over = timelineTickTimes(TIMELINE_FIT_MS + 1);
    expect(over.every((t) => t % STEP === 0)).toBe(true);
    expect(over[0]).toBe(0);
  });
  it('timelineTickTimes: 축이 자라도 앞 눈금은 그대로다', () => {
    const a = timelineTickTimes(STEP * 7);
    const b = timelineTickTimes(STEP * 9.2);
    expect(b.slice(0, a.length - 1)).toEqual(a.slice(0, a.length - 1));
  });
  it('timelineTickTimes: 끝 반 칸 안의 배수는 빼고, 축 끝과 정확히 같은 배수는 넣는다', () => {
    expect(timelineTickTimes(STEP * 7)).toEqual(
      [0, 1, 2, 3, 4, 5, 6, 7].map((i) => i * STEP),
    );
    // 축 끝이 7.4 칸 → 7 은 끝에서 0.4 칸이라 뺀다.
    expect(timelineTickTimes(STEP * 7.4).at(-1)).toBe(STEP * 6);
    // 정확히 반 칸 남으면 넣는다(경계), 1ms 모자라면 뺀다.
    expect(timelineTickTimes(STEP * 7.5).at(-1)).toBe(STEP * 7);
    expect(timelineTickTimes(STEP * 7.5 - 1).at(-1)).toBe(STEP * 6);
  });
  it('timelineTickTimes: 0·음수·NaN·Infinity 는 [0], 상한 배율을 넘는 축도 유한 개', () => {
    for (const v of [0, -1, Number.NaN, Infinity]) {
      expect(timelineTickTimes(v)).toEqual([0]);
    }
    const perFit = TIMELINE_FIT_MS / STEP;
    const huge = timelineTickTimes(TIMELINE_FIT_MS * TIMELINE_MAX_SCALE * 10);
    expect(huge.length).toBeLessThanOrEqual(TIMELINE_MAX_SCALE * perFit + 1);
    expect(huge[0]).toBe(0);
  });
});

describe('timelineCursorInView / timelineFollowScroll', () => {
  // 정수 픽스처: 트랙 2000px → 1% = 20px, 보이는 트랙 400px, 최대 스크롤 1600.
  const geometry = (
    cursorPercent: number,
    scrollLeft: number,
    patch: Partial<TimelineScrollGeometry> = {},
  ): TimelineScrollGeometry => ({
    cursorPercent,
    scrollLeft,
    clientWidth: 500,
    scrollWidth: 2100,
    labelPx: 100,
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

  it('timelineCursorInView: 보이는 범위 양 끝 정확값·허용오차 1px 은 보임, 그 밖 1px 은 안 보임', () => {
    // 50% → x = 1100. 오른쪽 끝: scrollLeft + 500(+1) 이상이어야 보인다.
    expect(timelineCursorInView(geometry(50, 600))).toBe(true);
    expect(timelineCursorInView(geometry(50, 599))).toBe(true);
    expect(timelineCursorInView(geometry(50, 598))).toBe(false);
    // 왼쪽 끝: 라벨 열(100px) 뒤에 가린 커서는 밖이다.
    expect(timelineCursorInView(geometry(50, 1000))).toBe(true);
    expect(timelineCursorInView(geometry(50, 1001))).toBe(true);
    expect(timelineCursorInView(geometry(50, 1002))).toBe(false);
  });

  it('timelineFollowScroll: 넘침 없음·0 크기·scrollWidth < clientWidth 는 null·inView true', () => {
    const none = { scrollLeft: null, inView: true };
    expect(follow(50, 0, true, false, { scrollWidth: 500 })).toEqual(none);
    expect(follow(50, 0, true, false, { scrollWidth: 499 })).toEqual(none);
    expect(
      follow(50, 0, false, true, { scrollWidth: 0, clientWidth: 0 }),
    ).toEqual(none);
    expect(timelineCursorInView(geometry(50, 0, { scrollWidth: 500 }))).toBe(
      true,
    );
  });

  it('timelineFollowScroll: 재생 중 오른쪽 끝을 넘으면 page-flip, 경계 정확값은 그대로', () => {
    expect(follow(50, 599, true)).toEqual({ scrollLeft: null, inView: true });
    // 커서가 보이는 트랙(400px)의 왼쪽 10% 지점: 1100 − 100 − 40.
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
    expect(follow(100, 1600, true)).toEqual({ scrollLeft: null, inView: true });
  });

  it('timelineFollowScroll: 재생 중 wasInView=false 면 따라가지 않고 false 유지, 다시 보이면 true', () => {
    expect(follow(50, 0, true, false)).toEqual({
      scrollLeft: null,
      inView: false,
    });
    expect(follow(50, 700, true, false)).toEqual({
      scrollLeft: null,
      inView: true,
    });
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

  it('timelineFollowScroll: NaN·Infinity·음수 라벨·라벨 ≥ clientWidth·범위 밖 퍼센트', () => {
    const none = { scrollLeft: null, inView: true };
    expect(follow(Number.NaN, 0, true)).toEqual(none);
    expect(follow(50, Number.NaN, true)).toEqual(none);
    expect(follow(50, 0, true, true, { scrollWidth: Infinity })).toEqual(none);
    // 음수 라벨은 0 으로: 트랙 2100px, 50% → 1050, 보이는 트랙 500 → 1050 − 50.
    expect(follow(50, 0, true, true, { labelPx: -30 })).toEqual({
      scrollLeft: 1000,
      inView: true,
    });
    // 라벨이 화면을 다 가리면(정확값) 판단하지 않고, 1px 이라도 남으면 동작한다.
    expect(follow(50, 0, true, true, { labelPx: 500 })).toEqual(none);
    expect(
      follow(50, 0, true, true, { labelPx: 499 }).scrollLeft,
    ).not.toBeNull();
    // 범위 밖 퍼센트는 0·100 으로 clamp.
    expect(follow(-10, 1002, false)).toEqual({ scrollLeft: 0, inView: true });
    expect(follow(250, 0, false)).toEqual({ scrollLeft: 1600, inView: true });
  });

  it('timelineFollowScroll: 결과는 정수 px', () => {
    // 보이는 트랙 405px → 선행 40.5px → 959.5 → 반올림.
    const next = follow(50, 0, true, true, { clientWidth: 505 });
    expect(next.scrollLeft).toBe(960);
    expect(Number.isInteger(next.scrollLeft)).toBe(true);
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

describe('PLAY3D_STATUS_FILL', () => {
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
    expect(idle).not.toBe(offline);
    expect(luma(idle)).toBeGreaterThan(luma(offline));
    // 회색 계열: 채널 편차가 작다(채도가 낮다).
    for (const hex of [idle, offline]) {
      const c = channels(hex);
      expect(Math.max(...c) - Math.min(...c)).toBeLessThanOrEqual(48);
    }
  });
});
