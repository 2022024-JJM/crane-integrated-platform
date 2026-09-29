import { describe, expect, it } from 'vitest';
import type { EquipmentRuntimeStatus } from '@crane/core/types/status';
import type { ModelStatusTags } from '@crane/domain/3d';
import {
  EMPTY_LABEL_PREVIEW,
  STATUS_BIT_ON_THRESHOLD,
  collectModelStatusKeys,
  resolveLabelState,
  type LabelStatePreview,
  type TagReading,
} from '../model-label-state';
import {
  isSameOutlineStateRecord,
  resolveOutlineState,
  resolvePreviewOutlineState,
} from '../model-outline-state';
import { OFFLINE_WINDOW_MS, RUNNING_WINDOW_MS } from '../model-runtime-status';

const NOW = 1_000_000;
const LONG_AGO = NOW - RUNNING_WINDOW_MS - 1;

function readings(map: Record<string, TagReading>) {
  return (key: string) => map[key];
}

/** 방금 받은 비트(값은 오래전에 바뀜). */
function bit(value: number): TagReading {
  return { value, at: NOW, changedAt: LONG_AGO };
}

const STATUS: ModelStatusTags = {
  controlOn: 'on',
  commError: 'comm',
  slowdown: 'slow',
  endstop: 'end',
};

/** 수신 중인 장비(tone 은 외곽선과 무관한 아무 값)의 외곽선. */
function outline(
  map: Record<string, TagReading>,
  tone: EquipmentRuntimeStatus = 'standby',
  status: ModelStatusTags = STATUS,
) {
  return resolveOutlineState(tone, status, readings(map));
}

describe('resolveOutlineState — 우선순위', () => {
  it('비트가 전부 꺼져 있으면 외곽선이 없다', () => {
    expect(outline({ comm: bit(0), slow: bit(0), end: bit(0) })).toBe('none');
  });

  it('비트 하나만 켜지면 그 외곽선', () => {
    expect(outline({ slow: bit(1) })).toBe('slowdown');
    expect(outline({ end: bit(1) })).toBe('endstop');
    expect(outline({ comm: bit(1) })).toBe('commError');
  });

  it('Endstop 은 Slowdown 보다 앞선다', () => {
    expect(outline({ slow: bit(1), end: bit(1) })).toBe('endstop');
  });

  it('통신불량은 Endstop·Slowdown 보다 앞선다 — 그 값들이 지금 상태가 아니다', () => {
    expect(outline({ comm: bit(1), end: bit(1) })).toBe('commError');
    expect(outline({ comm: bit(1), slow: bit(1) })).toBe('commError');
    expect(outline({ comm: bit(1), slow: bit(1), end: bit(1) })).toBe(
      'commError',
    );
  });

  it('통신불량이 꺼져 있으면 아래 순위를 읽는다', () => {
    expect(outline({ comm: bit(0), end: bit(1) })).toBe('endstop');
    expect(outline({ comm: bit(0), slow: bit(1), end: bit(0) })).toBe(
      'slowdown',
    );
  });

  it('라벨의 색과 독립이다 — 어떤 운전 상태에서도 같은 외곽선', () => {
    const tones: EquipmentRuntimeStatus[] = [
      'fault',
      'running',
      'standby',
      'off',
      'unknown',
    ];
    for (const tone of tones) {
      expect(outline({ end: bit(1) }, tone)).toBe('endstop');
      expect(outline({ end: bit(0) }, tone)).toBe('none');
    }
  });
});

describe('resolveOutlineState — 수신 끊김', () => {
  it('운전 상태가 offline 이면 비트와 무관하게 회색', () => {
    expect(outline({}, 'offline')).toBe('commError');
    expect(outline({ comm: bit(0), end: bit(1) }, 'offline')).toBe('commError');
    expect(outline({ slow: bit(1) }, 'offline')).toBe('commError');
  });

  it('상태 태그가 하나도 없어도 offline 이면 회색', () => {
    expect(outline({}, 'offline', {})).toBe('commError');
  });

  it('라벨 판정의 offline 창 경계를 그대로 따른다 — 정확값은 수신 중, +1ms 는 회색', () => {
    const keys = collectModelStatusKeys({ statusTags: STATUS });
    const at = (age: number) =>
      readings({ end: { value: 1, at: NOW - age, changedAt: 0 } });
    const resolve = (age: number) => {
      const get = at(age);
      const tone = resolveLabelState(keys, get, NOW).tone;
      return resolveOutlineState(tone, keys.status, get);
    };
    expect(resolve(OFFLINE_WINDOW_MS)).toBe('endstop');
    expect(resolve(OFFLINE_WINDOW_MS + 1)).toBe('commError');
  });

  it('낡은 비트도 다른 키가 오고 있으면 마지막 값으로 읽는다', () => {
    const keys = collectModelStatusKeys({ statusTags: STATUS });
    const get = readings({
      on: bit(1),
      end: { value: 1, at: NOW - OFFLINE_WINDOW_MS - 1, changedAt: 0 },
    });
    const tone = resolveLabelState(keys, get, NOW).tone;
    expect(tone).toBe('standby');
    expect(resolveOutlineState(tone, keys.status, get)).toBe('endstop');
  });
});

describe('resolveOutlineState — 모르는 값', () => {
  it('받은 적이 없으면 외곽선이 없다', () => {
    expect(outline({}, 'unknown')).toBe('none');
  });

  it('상태 태그를 연결하지 않았으면 값이 와도 외곽선이 없다', () => {
    expect(outline({ end: bit(1), slow: bit(1) }, 'running', {})).toBe('none');
    expect(
      outline({ end: bit(1) }, 'running', {
        controlOn: 'on',
        slowdown: 'slow',
      }),
    ).toBe('none');
  });

  it('연결은 했지만 아직 못 받은 비트는 꺼진 것으로 본다', () => {
    expect(outline({ slow: bit(1) })).toBe('slowdown');
    expect(outline({ on: bit(1) })).toBe('none');
  });

  it('유한수가 아닌 값은 모름 — 아래 순위를 읽는다', () => {
    expect(outline({ comm: bit(Number.NaN), end: bit(1) })).toBe('endstop');
    expect(outline({ end: bit(Number.POSITIVE_INFINITY), slow: bit(1) })).toBe(
      'slowdown',
    );
    expect(outline({ end: bit(Number.NaN) })).toBe('none');
  });

  it('빈 키·문자열이 아닌 키는 연결하지 않은 것과 같다(sanitize 를 안 거친 입력)', () => {
    // 판정에 들어오는 키는 collectModelStatusKeys 가 거른 것이다 — 방어는 그
    // 경계에 있다.
    const keys = collectModelStatusKeys({
      statusTags: { commError: '', slowdown: 42, endstop: null },
    } as unknown as Parameters<typeof collectModelStatusKeys>[0]);
    expect(keys.status).toEqual({});
    expect(outline({ '': bit(1), '42': bit(1) }, 'running', keys.status)).toBe(
      'none',
    );
  });

  it.todo(
    'resolveOutlineState 에 거르지 않은 상태 태그를 직접 넘기면 숫자 키도 읽는다 — 호출자는 collectModelStatusKeys 결과만 넘긴다',
  );

  it('문턱 정확값은 on, 바로 아래는 off', () => {
    expect(outline({ end: bit(STATUS_BIT_ON_THRESHOLD) })).toBe('endstop');
    expect(outline({ end: bit(STATUS_BIT_ON_THRESHOLD - 0.001) })).toBe('none');
  });

  it('범위 밖 값 — 음수는 off, 1 초과는 on', () => {
    expect(outline({ slow: bit(-1) })).toBe('none');
    expect(outline({ slow: bit(255) })).toBe('slowdown');
  });

  it('같은 태그를 두 역할에 이으면 둘 다 그 값을 읽는다', () => {
    const status: ModelStatusTags = { slowdown: 'ac', endstop: 'ac' };
    expect(outline({ ac: bit(1) }, 'running', status)).toBe('endstop');
    expect(outline({ ac: bit(0) }, 'running', status)).toBe('none');
  });
});

describe('collectModelStatusKeys — 외곽선 역할', () => {
  it('외곽선 역할의 키도 수신 키에 들어가고 움직임 키에는 들어가지 않는다', () => {
    const keys = collectModelStatusKeys({
      tagMappings: [{ tagKey: 'A:x' }],
      statusTags: { commError: 'A:comm', slowdown: 'A:slow', endstop: 'A:end' },
    } as unknown as Parameters<typeof collectModelStatusKeys>[0]);
    expect(keys.motion).toEqual(['A:x']);
    expect(keys.liveness).toEqual(['A:x', 'A:comm', 'A:slow', 'A:end']);
    expect(keys.status).toEqual({
      commError: 'A:comm',
      slowdown: 'A:slow',
      endstop: 'A:end',
    });
  });

  it('외곽선 태그만 단 모델도 수신이 끊기면 offline 이 된다', () => {
    const keys = collectModelStatusKeys({ statusTags: { endstop: 'A:end' } });
    const stale = readings({
      'A:end': { value: 0, at: NOW - OFFLINE_WINDOW_MS - 1, changedAt: 0 },
    });
    expect(resolveLabelState(keys, stale, NOW).tone).toBe('offline');
  });

  it('외곽선 비트는 라벨의 색·아이콘을 바꾸지 않는다', () => {
    const keys = collectModelStatusKeys({ statusTags: STATUS });
    const base = { on: bit(1) };
    const withOutline = {
      on: bit(1),
      comm: bit(1),
      slow: bit(1),
      end: bit(1),
    };
    expect(resolveLabelState(keys, readings(withOutline), NOW)).toBe(
      resolveLabelState(keys, readings(base), NOW),
    );
  });
});

describe('resolvePreviewOutlineState', () => {
  function preview(bits: LabelStatePreview['bits']): LabelStatePreview {
    return { bits };
  }

  it('고른 값이 없으면 미리보기 없음(null)', () => {
    expect(resolvePreviewOutlineState(EMPTY_LABEL_PREVIEW)).toBeNull();
    expect(resolvePreviewOutlineState({ bits: {} })).toBeNull();
  });

  it('ACMS 의 외곽선 세 가지를 전부 만들 수 있다', () => {
    expect(
      [
        preview({ commError: true }),
        preview({ slowdown: true }),
        preview({ endstop: true }),
      ].map(resolvePreviewOutlineState),
    ).toEqual(['commError', 'slowdown', 'endstop']);
  });

  it('실제 값과 같은 우선순위를 탄다', () => {
    expect(
      resolvePreviewOutlineState(preview({ slowdown: true, endstop: true })),
    ).toBe('endstop');
    expect(
      resolvePreviewOutlineState(
        preview({ commError: true, slowdown: true, endstop: true }),
      ),
    ).toBe('commError');
    expect(
      resolvePreviewOutlineState(preview({ commError: false, endstop: true })),
    ).toBe('endstop');
  });

  it('Off 로 고른 값·라벨 값만 고른 미리보기는 외곽선 없음(none)', () => {
    expect(resolvePreviewOutlineState(preview({ endstop: false }))).toBe(
      'none',
    );
    expect(resolvePreviewOutlineState(preview({ controlOn: true }))).toBe(
      'none',
    );
    expect(resolvePreviewOutlineState({ bits: {}, moving: true })).toBe('none');
  });

  it('어떤 값을 골라도 수신 끊김의 회색은 나오지 않는다 — 통신불량 On 일 때만 회색', () => {
    for (const p of [
      preview({ commError: false }),
      preview({ slowdown: false, endstop: false }),
      { bits: {}, moving: false },
    ]) {
      expect(resolvePreviewOutlineState(p)).not.toBe('commError');
    }
  });
});

describe('isSameOutlineStateRecord', () => {
  it('같은 내용이면 true — 빈 기록끼리도', () => {
    expect(isSameOutlineStateRecord({ m: 'endstop' }, { m: 'endstop' })).toBe(
      true,
    );
    expect(isSameOutlineStateRecord({}, {})).toBe(true);
  });

  it('값이 하나만 달라도 false', () => {
    expect(
      isSameOutlineStateRecord(
        { m: 'endstop', n: 'none' },
        { m: 'endstop', n: 'slowdown' },
      ),
    ).toBe(false);
  });

  it('키 집합이 다르면 false — 개수가 같아도', () => {
    expect(
      isSameOutlineStateRecord({ m: 'none' }, { m: 'none', n: 'none' }),
    ).toBe(false);
    expect(isSameOutlineStateRecord({ m: 'none' }, { n: 'none' })).toBe(false);
  });
});
