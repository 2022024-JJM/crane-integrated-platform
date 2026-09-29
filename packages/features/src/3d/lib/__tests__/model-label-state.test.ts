import { describe, expect, it } from 'vitest';
import {
  EMPTY_LABEL_PREVIEW,
  STATUS_BIT_ON_THRESHOLD,
  UNKNOWN_LABEL_STATE,
  collectModelStatusKeys,
  getLabelState,
  isEmptyLabelPreview,
  isSameLabelStateRecord,
  readStatusBit,
  resolveLabelState,
  resolvePreviewLabelState,
  setPreviewBit,
  setPreviewMoving,
  type LabelStatePreview,
  type ModelStatusKeys,
  type TagReading,
} from '../model-label-state';
import { OFFLINE_WINDOW_MS, RUNNING_WINDOW_MS } from '../model-runtime-status';

const NOW = 1_000_000;
/** running 창 밖 — 값이 "예전에" 바뀐 시각. */
const LONG_AGO = NOW - RUNNING_WINDOW_MS - 1;

function readings(map: Record<string, TagReading>) {
  return (key: string) => map[key];
}

/** 방금 받은 비트(값은 오래전에 바뀜). */
function bit(value: number): TagReading {
  return { value, at: NOW, changedAt: LONG_AGO };
}

/** 방금 받았고 움직이는 축. */
function moving(value = 10): TagReading {
  return { value, at: NOW, changedAt: NOW };
}

/** 방금 받았지만 멈춰 있는 축. */
function still(value = 10): TagReading {
  return { value, at: NOW, changedAt: LONG_AGO };
}

const KEYS: ModelStatusKeys = {
  motion: ['axis'],
  liveness: ['axis', 'on', 'fault', 'bypass', 'swing'],
  status: {
    controlOn: 'on',
    fault: 'fault',
    bypass: 'bypass',
    freeSwing: 'swing',
  },
};

function tone(map: Record<string, TagReading>, keys = KEYS) {
  return resolveLabelState(keys, readings(map), NOW).tone;
}

describe('collectModelStatusKeys', () => {
  it('움직임 키는 맵핑만, 수신 키는 맵핑 + 상태 태그', () => {
    const keys = collectModelStatusKeys({
      tagMappings: [{ tagKey: 'A:x' }, { tagKey: 'A:y' }],
      statusTags: { controlOn: 'A:on', bypass: 'A:bypass' },
    } as unknown as Parameters<typeof collectModelStatusKeys>[0]);
    expect(keys.motion).toEqual(['A:x', 'A:y']);
    expect(keys.liveness).toEqual(['A:x', 'A:y', 'A:on', 'A:bypass']);
    expect(keys.status).toEqual({ controlOn: 'A:on', bypass: 'A:bypass' });
  });

  it('맵핑도 상태 태그도 없으면 전부 빈다', () => {
    expect(collectModelStatusKeys({})).toEqual({
      motion: [],
      liveness: [],
      status: {},
    });
  });

  it('축 태그와 같은 키를 상태 태그로 써도 수신 키는 한 번만 들어간다', () => {
    const keys = collectModelStatusKeys({
      tagMappings: [{ tagKey: 'A:x' }],
      statusTags: { controlOn: 'A:x', fault: 'A:x' },
    } as unknown as Parameters<typeof collectModelStatusKeys>[0]);
    expect(keys.liveness).toEqual(['A:x']);
    expect(keys.status).toEqual({ controlOn: 'A:x', fault: 'A:x' });
  });

  it('문자열이 아니거나 빈 키는 버린다(sanitize 를 안 거친 입력)', () => {
    const keys = collectModelStatusKeys({
      statusTags: { controlOn: '', fault: 42, bypass: null, freeSwing: 'A:s' },
    } as unknown as Parameters<typeof collectModelStatusKeys>[0]);
    expect(keys.status).toEqual({ freeSwing: 'A:s' });
    expect(keys.liveness).toEqual(['A:s']);
  });
});

describe('readStatusBit', () => {
  it('문턱 정확값은 on, 바로 아래는 off', () => {
    const get = readings({
      edge: bit(STATUS_BIT_ON_THRESHOLD),
      below: bit(STATUS_BIT_ON_THRESHOLD - 0.001),
    });
    expect(readStatusBit('edge', get)).toBe(true);
    expect(readStatusBit('below', get)).toBe(false);
  });

  it('0·1 과 범위 밖 값 — 음수는 off, 1 초과는 on', () => {
    const get = readings({
      zero: bit(0),
      one: bit(1),
      negative: bit(-1),
      big: bit(255),
    });
    expect(readStatusBit('zero', get)).toBe(false);
    expect(readStatusBit('one', get)).toBe(true);
    expect(readStatusBit('negative', get)).toBe(false);
    expect(readStatusBit('big', get)).toBe(true);
  });

  it('키가 없거나 못 받았거나 값이 유한수가 아니면 모름(null)', () => {
    const get = readings({
      nan: bit(Number.NaN),
      infinite: bit(Number.POSITIVE_INFINITY),
    });
    expect(readStatusBit(undefined, get)).toBeNull();
    expect(readStatusBit('', get)).toBeNull();
    expect(readStatusBit('missing', get)).toBeNull();
    expect(readStatusBit('nan', get)).toBeNull();
    expect(readStatusBit('infinite', get)).toBeNull();
  });
});

describe('resolveLabelState — 우선순위', () => {
  it('아무것도 못 받았으면 unknown', () => {
    expect(resolveLabelState(KEYS, readings({}), NOW)).toBe(
      UNKNOWN_LABEL_STATE,
    );
  });

  it('고장은 움직임·운전 전원보다 앞선다', () => {
    expect(tone({ axis: moving(), on: bit(1), fault: bit(1) })).toBe('fault');
    expect(tone({ axis: still(), on: bit(0), fault: bit(1) })).toBe('fault');
  });

  it('운전 전원 off 는 움직임보다 앞선다 — 센서 흔들림이 가동으로 뜨지 않는다', () => {
    expect(tone({ axis: moving(), on: bit(0), fault: bit(0) })).toBe('off');
    expect(tone({ axis: still(), on: bit(0) })).toBe('off');
  });

  it('운전 전원 on 이고 움직이면 running, 멈춰 있으면 standby', () => {
    expect(tone({ axis: moving(), on: bit(1) })).toBe('running');
    expect(tone({ axis: still(), on: bit(1) })).toBe('standby');
  });

  it('running 창 경계 — 정확값은 running, +1ms 는 standby', () => {
    const edge = { value: 1, at: NOW, changedAt: NOW - RUNNING_WINDOW_MS };
    const past = { value: 1, at: NOW, changedAt: NOW - RUNNING_WINDOW_MS - 1 };
    expect(tone({ axis: edge, on: bit(1) })).toBe('running');
    expect(tone({ axis: past, on: bit(1) })).toBe('standby');
  });

  it('운전 전원을 모르면 움직일 때만 색이 있다 — 멈춰 있으면 unknown', () => {
    expect(tone({ axis: moving() })).toBe('running');
    expect(tone({ axis: still() })).toBe('unknown');
    expect(tone({ axis: still(), fault: bit(0) })).toBe('unknown');
  });

  it('운전 전원을 몰라도 아는 아이콘은 그린다', () => {
    expect(
      resolveLabelState(
        KEYS,
        readings({ axis: still(), bypass: bit(1), swing: bit(1) }),
        NOW,
      ),
    ).toEqual({ tone: 'unknown', bypass: true, freeSwing: true });
  });

  it('상태 비트가 바뀐 것은 움직임이 아니다', () => {
    const toggled = { value: 1, at: NOW, changedAt: NOW };
    expect(tone({ axis: still(), on: toggled, bypass: toggled })).toBe(
      'standby',
    );
  });

  it('축 맵핑 없이 상태 태그만 있어도 상태가 나온다', () => {
    const keys: ModelStatusKeys = {
      motion: [],
      liveness: ['on'],
      status: { controlOn: 'on' },
    };
    expect(tone({ on: bit(1) }, keys)).toBe('standby');
    expect(tone({ on: bit(0) }, keys)).toBe('off');
  });
});

describe('resolveLabelState — 수신 끊김', () => {
  const stale = (value: number): TagReading => ({
    value,
    at: NOW - OFFLINE_WINDOW_MS - 1,
    changedAt: NOW - OFFLINE_WINDOW_MS - 1,
  });

  it('전부 끊기면 offline — 낡은 고장·우회·자유선회는 표시하지 않는다', () => {
    const state = resolveLabelState(
      KEYS,
      readings({
        axis: stale(1),
        on: stale(1),
        fault: stale(1),
        bypass: stale(1),
        swing: stale(1),
      }),
      NOW,
    );
    expect(state).toEqual({ tone: 'offline', bypass: false, freeSwing: false });
  });

  it('offline 창 경계 — 정확값은 수신 중, +1ms 는 offline', () => {
    const edge = { value: 1, at: NOW - OFFLINE_WINDOW_MS, changedAt: 0 };
    expect(tone({ on: edge })).toBe('standby');
    expect(tone({ on: stale(1) })).toBe('offline');
  });

  it('축이 끊겨도 상태 태그가 오고 있으면 offline 이 아니다', () => {
    expect(tone({ axis: stale(1), on: bit(1) })).toBe('standby');
  });

  it('낡은 비트도 다른 키가 오고 있으면 마지막 값으로 읽는다', () => {
    expect(tone({ axis: still(), on: stale(0) })).toBe('off');
  });
});

describe('resolveLabelState — 아이콘', () => {
  it('우회·자유선회는 색과 독립이다', () => {
    expect(
      resolveLabelState(
        KEYS,
        readings({ axis: moving(), on: bit(1), bypass: bit(1), swing: bit(1) }),
        NOW,
      ),
    ).toEqual({ tone: 'running', bypass: true, freeSwing: true });
    expect(
      resolveLabelState(
        KEYS,
        readings({ axis: still(), on: bit(0), bypass: bit(1) }),
        NOW,
      ),
    ).toEqual({ tone: 'off', bypass: true, freeSwing: false });
  });

  it('비트를 모르면 꺼진 것으로 그린다', () => {
    expect(
      resolveLabelState(KEYS, readings({ axis: still(), on: bit(1) }), NOW),
    ).toEqual({ tone: 'standby', bypass: false, freeSwing: false });
  });

  it('같은 내용이면 같은 객체를 돌려준다', () => {
    const map = { axis: still(), on: bit(1), bypass: bit(1) };
    expect(resolveLabelState(KEYS, readings(map), NOW)).toBe(
      resolveLabelState(KEYS, readings({ ...map }), NOW + 1),
    );
    expect(getLabelState('fault', true, false)).toBe(
      getLabelState('fault', true, false),
    );
    expect(getLabelState('fault', true, false)).not.toBe(
      getLabelState('fault', false, false),
    );
  });

  it('돌려준 객체는 바꿀 수 없다', () => {
    expect(Object.isFrozen(getLabelState('running'))).toBe(true);
  });
});

describe('resolveLabelState — 상태 태그가 없는 모델', () => {
  const keys: ModelStatusKeys = {
    motion: ['axis'],
    liveness: ['axis'],
    status: {},
  };

  it('움직일 때만 가동이고 멈추면 unknown', () => {
    expect(tone({ axis: moving() }, keys)).toBe('running');
    expect(tone({ axis: still() }, keys)).toBe('unknown');
  });

  it('받은 적이 없으면 unknown, 끊기면 offline', () => {
    expect(tone({}, keys)).toBe('unknown');
    expect(
      tone(
        { axis: { value: 1, at: NOW - OFFLINE_WINDOW_MS - 1, changedAt: 0 } },
        keys,
      ),
    ).toBe('offline');
  });
});

describe('isSameLabelStateRecord', () => {
  const a = getLabelState('standby', true, false);

  it('같은 내용이면 true — 객체가 달라도', () => {
    expect(isSameLabelStateRecord({ m: a }, { m: { ...a } })).toBe(true);
    expect(isSameLabelStateRecord({}, {})).toBe(true);
  });

  it('tone·우회·자유선회 중 하나만 달라도 false', () => {
    expect(
      isSameLabelStateRecord({ m: a }, { m: getLabelState('off', true) }),
    ).toBe(false);
    expect(
      isSameLabelStateRecord({ m: a }, { m: getLabelState('standby') }),
    ).toBe(false);
    expect(
      isSameLabelStateRecord(
        { m: a },
        { m: getLabelState('standby', true, true) },
      ),
    ).toBe(false);
  });

  it('키 집합이 다르면 false — 개수가 같아도', () => {
    expect(isSameLabelStateRecord({ m: a }, { m: a, n: a })).toBe(false);
    expect(isSameLabelStateRecord({ m: a }, { n: a })).toBe(false);
  });
});

describe('setPreviewBit / setPreviewMoving', () => {
  it('역할 값을 고르고 바꾸고 뗀다 — 다른 항목은 그대로', () => {
    const on = setPreviewBit(EMPTY_LABEL_PREVIEW, 'controlOn', true);
    expect(on).toEqual({ bits: { controlOn: true } });
    const withFault = setPreviewBit(on, 'fault', false);
    expect(withFault).toEqual({ bits: { controlOn: true, fault: false } });
    expect(setPreviewBit(withFault, 'controlOn', false).bits.controlOn).toBe(
      false,
    );
    expect(setPreviewBit(withFault, 'controlOn', null)).toEqual({
      bits: { fault: false },
    });
  });

  it('움직임을 고르고 떼도 비트는 그대로', () => {
    const base = setPreviewBit(EMPTY_LABEL_PREVIEW, 'bypass', true);
    const moving = setPreviewMoving(base, true);
    expect(moving).toEqual({ bits: { bypass: true }, moving: true });
    expect(setPreviewMoving(moving, false).moving).toBe(false);
    const cleared = setPreviewMoving(moving, null);
    expect(cleared).toEqual({ bits: { bypass: true } });
    expect('moving' in cleared).toBe(false);
  });

  it('바뀌는 것이 없으면 같은 참조를 돌려준다', () => {
    const base = setPreviewMoving(
      setPreviewBit(EMPTY_LABEL_PREVIEW, 'fault', true),
      false,
    );
    expect(setPreviewBit(base, 'fault', true)).toBe(base);
    expect(setPreviewBit(base, 'bypass', null)).toBe(base);
    expect(setPreviewMoving(base, false)).toBe(base);
    expect(setPreviewMoving(EMPTY_LABEL_PREVIEW, null)).toBe(
      EMPTY_LABEL_PREVIEW,
    );
  });

  it('입력을 바꾸지 않는다 — 빈 미리보기는 얼어 있다', () => {
    const base: LabelStatePreview = { bits: { fault: true } };
    setPreviewBit(base, 'fault', false);
    setPreviewMoving(base, true);
    expect(base).toEqual({ bits: { fault: true } });
    expect(Object.isFrozen(EMPTY_LABEL_PREVIEW)).toBe(true);
    expect(Object.isFrozen(EMPTY_LABEL_PREVIEW.bits)).toBe(true);
  });

  it('마지막 값을 떼면 빈 미리보기와 같은 내용이 된다', () => {
    const one = setPreviewBit(EMPTY_LABEL_PREVIEW, 'fault', true);
    expect(isEmptyLabelPreview(one)).toBe(false);
    expect(isEmptyLabelPreview(setPreviewBit(one, 'fault', null))).toBe(true);
    expect(
      isEmptyLabelPreview(
        setPreviewMoving(setPreviewMoving(EMPTY_LABEL_PREVIEW, false), null),
      ),
    ).toBe(true);
  });
});

describe('resolvePreviewLabelState', () => {
  function preview(
    bits: LabelStatePreview['bits'],
    moving?: boolean,
  ): LabelStatePreview {
    return moving === undefined ? { bits } : { bits, moving };
  }

  it('고른 값이 없으면 미리보기 없음(null)', () => {
    expect(resolvePreviewLabelState(EMPTY_LABEL_PREVIEW)).toBeNull();
    expect(resolvePreviewLabelState({ bits: {} })).toBeNull();
  });

  it('ACMS 의 네 가지 색을 전부 만들 수 있다', () => {
    const tones = [
      preview({ fault: true }),
      preview({ controlOn: true }, true),
      preview({ controlOn: true }),
      preview({ controlOn: false }),
    ].map((p) => resolvePreviewLabelState(p)?.tone);
    expect(tones).toEqual(['fault', 'running', 'standby', 'off']);
  });

  it('실제 값과 같은 우선순위를 탄다', () => {
    // 고장 > 꺼짐 > 움직임.
    expect(
      resolvePreviewLabelState(preview({ fault: true, controlOn: false }, true))
        ?.tone,
    ).toBe('fault');
    expect(
      resolvePreviewLabelState(preview({ controlOn: false }, true))?.tone,
    ).toBe('off');
    // 운전 전원을 모르면 움직임만으로 가동.
    expect(resolvePreviewLabelState(preview({}, true))?.tone).toBe('running');
    // 운전 전원도 모르고 멈춰 있으면 색이 없다.
    expect(resolvePreviewLabelState(preview({}, false))?.tone).toBe('unknown');
    expect(resolvePreviewLabelState(preview({ fault: false }))?.tone).toBe(
      'unknown',
    );
  });

  it('어떤 값을 골라도 offline 은 나오지 않는다', () => {
    for (const p of [
      preview({ bypass: false }),
      preview({ freeSwing: true }),
      preview({}, false),
      preview({ controlOn: false, fault: false }, false),
    ]) {
      expect(resolvePreviewLabelState(p)?.tone).not.toBe('offline');
    }
  });

  it('아이콘은 On 일 때만 켠다', () => {
    expect(
      resolvePreviewLabelState(preview({ bypass: true, freeSwing: false })),
    ).toEqual({ tone: 'unknown', bypass: true, freeSwing: false });
    expect(
      resolvePreviewLabelState(
        preview({ controlOn: true, bypass: true, freeSwing: true }),
      ),
    ).toEqual({ tone: 'standby', bypass: true, freeSwing: true });
  });

  it('실제 값 판정과 같은 객체를 돌려준다', () => {
    expect(resolvePreviewLabelState(preview({ controlOn: true }))).toBe(
      getLabelState('standby'),
    );
  });
});
