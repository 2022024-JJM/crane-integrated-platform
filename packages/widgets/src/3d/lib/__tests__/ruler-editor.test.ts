import { describe, expect, it } from 'vitest';
import {
  RULER_GUIDE_DEFAULT_LENGTH_M,
  RULER_GUIDE_OPACITY_MIN,
  type SavedRulerGuide,
  type SavedRulerInfo,
} from '@crane/domain/3d';
import {
  formatRulerLength,
  isRulerDrawClick,
  RULER_DRAW_CLICK_TOLERANCE_PX,
  rulerUnitsToMeters,
  snapRulerPoint,
  withRulerDotColor,
  withRulerDotSize,
  withRulerGuideColor,
  withRulerGuideEnabled,
  withRulerGuideLengthMeters,
  withRulerGuideOpacity,
  withRulerGuideSide,
  withRulerInterval,
  withRulerLengthMeters,
  withRulerStartValue,
  withRulerTextColor,
  withRulerTextSize,
  withRulerUnitHidden,
} from '../ruler-editor';

function ruler(overrides: Partial<SavedRulerInfo> = {}): SavedRulerInfo {
  return {
    id: 'r1',
    name: '눈금 1',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    length: 750,
    interval: 100,
    textColor: '#ffffff',
    dotColor: '#ffffff',
    ...overrides,
  };
}

function guided(overrides: Partial<SavedRulerGuide> = {}): SavedRulerInfo {
  return ruler({ guide: { length: 10, color: '#ffffff', ...overrides } });
}

describe('isRulerDrawClick — 클릭과 드래그 구분', () => {
  const down = { clientX: 100, clientY: 200 };

  it('제자리에서 뗐으면 클릭', () => {
    expect(isRulerDrawClick(down, { clientX: 100, clientY: 200 })).toBe(true);
  });

  it('경계 — 허용 오차와 같으면 클릭, 1px 넘으면 드래그', () => {
    const t = RULER_DRAW_CLICK_TOLERANCE_PX;
    expect(isRulerDrawClick(down, { clientX: 100 + t, clientY: 200 - t })).toBe(
      true,
    );
    expect(isRulerDrawClick(down, { clientX: 100 + t + 1, clientY: 200 })).toBe(
      false,
    );
    expect(isRulerDrawClick(down, { clientX: 100, clientY: 200 - t - 1 })).toBe(
      false,
    );
  });

  it('누른 자리를 모르면 클릭으로 본다', () => {
    expect(isRulerDrawClick(null, { clientX: 5, clientY: 5 })).toBe(true);
  });

  it('호출자가 넘긴 허용 오차를 쓴다', () => {
    expect(isRulerDrawClick(down, { clientX: 110, clientY: 200 }, 10)).toBe(
      true,
    );
    expect(isRulerDrawClick(down, { clientX: 110, clientY: 200 }, 0)).toBe(
      false,
    );
  });
});

describe('snapRulerPoint', () => {
  it('X·Z 만 격자로 옮기고 높이는 그대로 둔다', () => {
    expect(snapRulerPoint([10.4, 5.482, -20.6], 1)).toEqual([10, 5.482, -21]);
    expect(snapRulerPoint([10.12, 5.482, 3.38], 0.25)).toEqual([
      10, 5.482, 3.5,
    ]);
  });

  it('이미 격자 위면 같은 참조를 돌려준다', () => {
    const point: [number, number, number] = [10, 5.482, -21];
    expect(snapRulerPoint(point, 1)).toBe(point);
  });

  it('스냅 단위가 0·음수·NaN 이면 스냅하지 않는다(같은 참조)', () => {
    const point: [number, number, number] = [10.4, 5, -20.6];
    for (const step of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(snapRulerPoint(point, step)).toBe(point);
    }
  });

  it('-0 을 만들지 않는다', () => {
    const snapped = snapRulerPoint([-0.2, 0, 0.2], 1);
    expect(Object.is(snapped[0], -0)).toBe(false);
    expect(snapped).toEqual([0, 0, 0]);
  });
});

describe('formatRulerLength', () => {
  it('소수 1자리 m', () => {
    expect(formatRulerLength(748.24)).toBe('748.2 m');
    expect(formatRulerLength(0)).toBe('0.0 m');
    expect(formatRulerLength(12)).toBe('12.0 m');
  });

  it('음수·비유한은 빈 문자열', () => {
    expect(formatRulerLength(-1)).toBe('');
    expect(formatRulerLength(Number.NaN)).toBe('');
    expect(formatRulerLength(Number.POSITIVE_INFINITY)).toBe('');
  });
});

describe('rulerUnitsToMeters', () => {
  it('씬 unit 을 m 로 환산한다', () => {
    expect(rulerUnitsToMeters(10, 11.7)).toBe(117);
    expect(rulerUnitsToMeters(750, 1)).toBe(750);
  });

  it('축척이 잘못되면(0·음수·NaN) 1 로 본다', () => {
    for (const bad of [0, -2, Number.NaN]) {
      expect(rulerUnitsToMeters(10, bad)).toBe(10);
    }
  });
});

describe('withRulerInterval — 50 과 100 만 고를 수 있다', () => {
  it('고를 수 있는 간격으로 바꾼다', () => {
    expect(withRulerInterval(ruler(), 50).interval).toBe(50);
    expect(withRulerInterval(ruler({ interval: 50 }), 100).interval).toBe(100);
  });

  it('그 밖의 값은 무시한다(같은 참조)', () => {
    const base = ruler();
    for (const other of [
      49,
      51,
      99,
      101,
      10,
      200,
      0,
      -50,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(withRulerInterval(base, other)).toBe(base);
    }
  });

  it('같은 간격이면 같은 참조', () => {
    const base = ruler();
    expect(withRulerInterval(base, 100)).toBe(base);
  });
});

describe('withRulerUnitHidden', () => {
  it('숨김은 true 로 남기고 표시는 필드를 지운다', () => {
    const hidden = withRulerUnitHidden(ruler(), true);
    expect(hidden.unitHidden).toBe(true);
    expect(withRulerUnitHidden(hidden, false)).not.toHaveProperty('unitHidden');
  });

  it('같은 상태면 같은 참조 — 없음과 false 는 같다', () => {
    const base = ruler();
    expect(withRulerUnitHidden(base, false)).toBe(base);
    const explicit = ruler({ unitHidden: false });
    expect(withRulerUnitHidden(explicit, false)).toBe(explicit);
    const hidden = ruler({ unitHidden: true });
    expect(withRulerUnitHidden(hidden, true)).toBe(hidden);
  });
});

describe('withRulerStartValue', () => {
  it('0 이 아닌 값은 남기고 0 은 필드를 지운다', () => {
    const started = withRulerStartValue(ruler(), 150);
    expect(started.startValue).toBe(150);
    expect(withRulerStartValue(started, 0)).not.toHaveProperty('startValue');
  });

  it('음수도 받고 3자리로 반올림한다', () => {
    expect(withRulerStartValue(ruler(), -20.12345).startValue).toBe(-20.123);
  });

  it('같은 값·비유한 값은 같은 참조', () => {
    const base = ruler();
    expect(withRulerStartValue(base, 0)).toBe(base);
    expect(withRulerStartValue(base, Number.NaN)).toBe(base);
    expect(withRulerStartValue(base, Number.POSITIVE_INFINITY)).toBe(base);
    const started = ruler({ startValue: 150 });
    expect(withRulerStartValue(started, 150)).toBe(started);
  });
});

describe('withRulerLengthMeters', () => {
  it('m 입력을 씬 unit 으로 저장한다', () => {
    expect(withRulerLengthMeters(ruler(), 117, 11.7).length).toBe(10);
    expect(withRulerLengthMeters(ruler(), 500, 1).length).toBe(500);
  });

  it('0·음수·비유한·같은 값은 같은 참조', () => {
    const base = ruler();
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(withRulerLengthMeters(base, bad, 1)).toBe(base);
    }
    expect(withRulerLengthMeters(base, 750, 1)).toBe(base);
  });

  it('반올림하면 0 이 되는 값은 무시한다(저장하면 눈금이 버려진다)', () => {
    const base = ruler();
    expect(withRulerLengthMeters(base, 0.0001, 1)).toBe(base);
  });

  it('길이를 바꿔도 간격·시작 값·보조선은 그대로다', () => {
    const base = guided();
    const next = withRulerLengthMeters({ ...base, startValue: 150 }, 300, 1);
    expect(next.interval).toBe(100);
    expect(next.startValue).toBe(150);
    expect(next.guide).toBe(base.guide);
  });
});

describe('withRulerTextColor / withRulerDotColor — 색은 따로 정한다', () => {
  it('#rrggbb 를 소문자로 저장한다', () => {
    expect(withRulerTextColor(ruler(), '#FFAA00').textColor).toBe('#ffaa00');
    expect(withRulerDotColor(ruler(), '#00FF00').dotColor).toBe('#00ff00');
  });

  it('한쪽을 바꿔도 다른 쪽은 그대로다', () => {
    const text = withRulerTextColor(ruler(), '#ff0000');
    expect(text.dotColor).toBe('#ffffff');
    const dot = withRulerDotColor(text, '#00ff00');
    expect(dot.textColor).toBe('#ff0000');
    expect(dot.dotColor).toBe('#00ff00');
  });

  it('보조선 색을 건드리지 않는다', () => {
    const base = guided({ color: '#123456' });
    expect(withRulerTextColor(base, '#ff0000').guide).toBe(base.guide);
    expect(withRulerDotColor(base, '#ff0000').guide).toBe(base.guide);
  });

  it('형식이 아니거나 같은 색이면 같은 참조', () => {
    const base = ruler();
    for (const bad of ['#fff', 'white', '', 'rgb(1,2,3)']) {
      expect(withRulerTextColor(base, bad)).toBe(base);
      expect(withRulerDotColor(base, bad)).toBe(base);
    }
    expect(withRulerTextColor(base, '#FFFFFF')).toBe(base);
    expect(withRulerDotColor(base, '#FFFFFF')).toBe(base);
  });
});

describe('withRulerTextSize / withRulerDotSize — 크기는 따로 정한다', () => {
  it('S·L 은 필드로 싣는다', () => {
    expect(withRulerTextSize(ruler(), 's').textSize).toBe('s');
    expect(withRulerTextSize(ruler(), 'l').textSize).toBe('l');
    expect(withRulerDotSize(ruler(), 's').dotSize).toBe('s');
    expect(withRulerDotSize(ruler(), 'l').dotSize).toBe('l');
  });

  it('기본(M)으로 되돌리면 필드를 지운다', () => {
    const text = withRulerTextSize(ruler({ textSize: 'l' }), 'm');
    expect('textSize' in text).toBe(false);
    const dot = withRulerDotSize(ruler({ dotSize: 's' }), 'm');
    expect('dotSize' in dot).toBe(false);
  });

  it('한쪽을 바꿔도 다른 쪽과 색은 그대로다', () => {
    const base = ruler({ textColor: '#ff0000', dotColor: '#00ff00' });
    const text = withRulerTextSize(base, 'l');
    expect('dotSize' in text).toBe(false);
    const both = withRulerDotSize(text, 's');
    expect(both.textSize).toBe('l');
    expect(both.dotSize).toBe('s');
    expect(both.textColor).toBe('#ff0000');
    expect(both.dotColor).toBe('#00ff00');
  });

  it('S ↔ L 로 바로 바꿀 수 있다', () => {
    expect(withRulerTextSize(ruler({ textSize: 's' }), 'l').textSize).toBe('l');
    expect(withRulerDotSize(ruler({ dotSize: 'l' }), 's').dotSize).toBe('s');
  });

  it('같은 크기면 같은 참조 — 필드 없음과 M 은 같은 상태다', () => {
    const base = ruler();
    expect(withRulerTextSize(base, 'm')).toBe(base);
    expect(withRulerDotSize(base, 'm')).toBe(base);
    const sized = ruler({ textSize: 's', dotSize: 'l' });
    expect(withRulerTextSize(sized, 's')).toBe(sized);
    expect(withRulerDotSize(sized, 'l')).toBe(sized);
  });

  it('고를 수 없는 값은 무시한다(같은 참조)', () => {
    const base = ruler({ textSize: 'l', dotSize: 's' });
    for (const bad of ['S', 'xl', '', ' m', 1, null, undefined, {}, ['s']]) {
      expect(withRulerTextSize(base, bad)).toBe(base);
      expect(withRulerDotSize(base, bad)).toBe(base);
    }
  });

  it('보조선을 건드리지 않는다', () => {
    const base = guided({ color: '#123456' });
    expect(withRulerTextSize(base, 'l').guide).toBe(base.guide);
    expect(withRulerDotSize(base, 's').guide).toBe(base.guide);
  });

  it('입력 객체를 바꾸지 않는다', () => {
    const base = ruler({ textSize: 's' });
    withRulerTextSize(base, 'l');
    withRulerTextSize(base, 'm');
    withRulerDotSize(base, 'l');
    expect(base).toEqual(ruler({ textSize: 's' }));
  });
});

describe('withRulerGuideEnabled — 보조선 켜고 끄기', () => {
  it('켜면 기본값(기본 길이·기본색)으로 만든다 — 방향·불투명도는 기본이라 필드가 없다', () => {
    expect(withRulerGuideEnabled(ruler(), true, 1).guide).toEqual({
      length: RULER_GUIDE_DEFAULT_LENGTH_M,
      color: '#ffffff',
    });
    expect(RULER_GUIDE_DEFAULT_LENGTH_M).toBe(100);
  });

  it('기본 길이는 씬 unit 으로 환산해 저장한다', () => {
    expect(withRulerGuideEnabled(ruler(), true, 11.7).guide?.length).toBe(
      8.547,
    );
    // 축척이 잘못되면 1 로 본다.
    expect(withRulerGuideEnabled(ruler(), true, 0).guide?.length).toBe(
      RULER_GUIDE_DEFAULT_LENGTH_M,
    );
  });

  it('끄면 필드째 지운다', () => {
    expect(withRulerGuideEnabled(guided(), false, 1)).not.toHaveProperty(
      'guide',
    );
  });

  it('이미 그 상태면 같은 참조 — 켜져 있는 보조선의 설정을 덮지 않는다', () => {
    const on = guided({ length: 33, side: 'right', opacity: 0.4 });
    expect(withRulerGuideEnabled(on, true, 1)).toBe(on);
    const off = ruler();
    expect(withRulerGuideEnabled(off, false, 1)).toBe(off);
  });
});

describe('withRulerGuideLengthMeters', () => {
  it('m 입력을 씬 unit 으로 저장한다', () => {
    expect(withRulerGuideLengthMeters(guided(), 25, 1).guide?.length).toBe(25);
    expect(withRulerGuideLengthMeters(guided(), 23.4, 11.7).guide?.length).toBe(
      2,
    );
  });

  it('0·음수·비유한·같은 값은 같은 참조', () => {
    const base = guided();
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, 0.0001]) {
      expect(withRulerGuideLengthMeters(base, bad, 1)).toBe(base);
    }
    expect(withRulerGuideLengthMeters(base, 10, 1)).toBe(base);
  });

  it('보조선이 없으면 no-op (만들지 않는다)', () => {
    const base = ruler();
    expect(withRulerGuideLengthMeters(base, 25, 1)).toBe(base);
  });

  it('길이를 바꿔도 방향은 그대로다 — 한쪽으로만 늘어난다', () => {
    const next = withRulerGuideLengthMeters(guided({ side: 'right' }), 99, 1);
    expect(next.guide?.side).toBe('right');
  });
});

describe('withRulerGuideSide', () => {
  it('오른쪽은 필드로 남기고 왼쪽(기본)은 필드를 지운다', () => {
    const right = withRulerGuideSide(guided(), 'right');
    expect(right.guide?.side).toBe('right');
    expect(withRulerGuideSide(right, 'left').guide).not.toHaveProperty('side');
  });

  it('같은 방향이면 같은 참조 — 없음과 left 는 같다', () => {
    const base = guided();
    expect(withRulerGuideSide(base, 'left')).toBe(base);
    const explicit = guided({ side: 'left' });
    expect(withRulerGuideSide(explicit, 'left')).toBe(explicit);
    const right = guided({ side: 'right' });
    expect(withRulerGuideSide(right, 'right')).toBe(right);
  });

  it('보조선이 없으면 no-op', () => {
    const base = ruler();
    expect(withRulerGuideSide(base, 'right')).toBe(base);
  });
});

describe('withRulerGuideColor', () => {
  it('#rrggbb 를 소문자로 저장하고 점·글자 색은 건드리지 않는다', () => {
    const next = withRulerGuideColor(guided(), '#FFAA00');
    expect(next.guide?.color).toBe('#ffaa00');
    expect(next.textColor).toBe('#ffffff');
    expect(next.dotColor).toBe('#ffffff');
  });

  it('형식이 아니거나 같은 색·보조선 없음은 같은 참조', () => {
    const base = guided();
    for (const bad of ['#fff', 'white', '']) {
      expect(withRulerGuideColor(base, bad)).toBe(base);
    }
    expect(withRulerGuideColor(base, '#FFFFFF')).toBe(base);
    const none = ruler();
    expect(withRulerGuideColor(none, '#ff0000')).toBe(none);
  });
});

describe('withRulerGuideOpacity', () => {
  it('불투명도를 저장하고 1(기본)은 필드를 지운다', () => {
    const half = withRulerGuideOpacity(guided(), 0.5);
    expect(half.guide?.opacity).toBe(0.5);
    expect(withRulerGuideOpacity(half, 1).guide).not.toHaveProperty('opacity');
  });

  it('경계 — 하한·상한 정확값은 그대로, 밖은 범위로 자른다', () => {
    expect(
      withRulerGuideOpacity(guided(), RULER_GUIDE_OPACITY_MIN).guide?.opacity,
    ).toBe(RULER_GUIDE_OPACITY_MIN);
    expect(withRulerGuideOpacity(guided(), 0).guide?.opacity).toBe(
      RULER_GUIDE_OPACITY_MIN,
    );
    expect(withRulerGuideOpacity(guided(), -2).guide?.opacity).toBe(
      RULER_GUIDE_OPACITY_MIN,
    );
    // 1 을 넘으면 1 로 잘려 기본과 같아진다.
    const half = guided({ opacity: 0.5 });
    expect(withRulerGuideOpacity(half, 5).guide).not.toHaveProperty('opacity');
  });

  it('슬라이더의 부동소수 잡음을 지운다', () => {
    expect(withRulerGuideOpacity(guided(), 0.1 + 0.2).guide?.opacity).toBe(0.3);
  });

  it('같은 값·비유한 값·보조선 없음은 같은 참조', () => {
    const base = guided();
    expect(withRulerGuideOpacity(base, 1)).toBe(base);
    expect(withRulerGuideOpacity(base, 9)).toBe(base);
    expect(withRulerGuideOpacity(base, Number.NaN)).toBe(base);
    const half = guided({ opacity: 0.5 });
    expect(withRulerGuideOpacity(half, 0.5)).toBe(half);
    const none = ruler();
    expect(withRulerGuideOpacity(none, 0.5)).toBe(none);
  });
});
