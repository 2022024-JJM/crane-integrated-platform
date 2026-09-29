import { describe, expect, it } from 'vitest';
import {
  RULER_DEFAULT_COLOR,
  RULER_GUIDE_OPACITY_MIN,
  RULER_INTERVAL_DEFAULT,
} from '../../model/ruler-types';
import { sanitizeRulerFields, sanitizeRulerGuide } from '../sanitize-rulers';

function ruler(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'r1',
    name: '1Dock 레일',
    position: [10, 5, -20],
    rotation: [0, 90, 0],
    length: 750,
    interval: 100,
    textColor: '#ffffff',
    dotColor: '#ffffff',
    ...overrides,
  };
}

function guide(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return { length: 10, color: '#ffffff', ...overrides };
}

describe('sanitizeRulerFields — 컨테이너', () => {
  it('객체가 아니면 null (undefined·null·배열·문자열·숫자)', () => {
    expect(sanitizeRulerFields(undefined)).toBeNull();
    expect(sanitizeRulerFields(null)).toBeNull();
    expect(sanitizeRulerFields([ruler()])).toBeNull();
    expect(sanitizeRulerFields('ruler')).toBeNull();
    expect(sanitizeRulerFields(3)).toBeNull();
  });

  it('정상 항목은 필드를 보존하고 id·알 수 없는 필드는 싣지 않는다', () => {
    expect(
      sanitizeRulerFields(
        ruler({ extra: true, scale: [2, 2, 2], width: 10, style: 'line' }),
      ),
    ).toEqual({
      name: '1Dock 레일',
      position: [10, 5, -20],
      rotation: [0, 90, 0],
      length: 750,
      interval: 100,
      textColor: '#ffffff',
      dotColor: '#ffffff',
    });
  });
});

describe('sanitizeRulerFields — 그릴 수 없는 항목은 버린다', () => {
  it('배치가 깨졌으면 null (누락·길이 다름·NaN·문자열)', () => {
    const { position: _position, ...noPosition } = ruler();
    void _position;
    expect(sanitizeRulerFields(noPosition)).toBeNull();
    expect(sanitizeRulerFields(ruler({ position: [1, 2] }))).toBeNull();
    expect(
      sanitizeRulerFields(ruler({ position: [1, Number.NaN, 3] })),
    ).toBeNull();
    expect(sanitizeRulerFields(ruler({ rotation: ['0', 0, 0] }))).toBeNull();
    expect(sanitizeRulerFields(ruler({ rotation: null }))).toBeNull();
  });

  it('길이가 0·음수·NaN·Infinity·문자열·누락이면 null', () => {
    for (const bad of [
      0,
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      '100',
      null,
      undefined,
    ]) {
      expect(sanitizeRulerFields(ruler({ length: bad }))).toBeNull();
    }
  });

  it('경계 — 아주 작은 양수 길이는 통과한다', () => {
    expect(sanitizeRulerFields(ruler({ length: 1e-6 }))).not.toBeNull();
  });
});

describe('sanitizeRulerFields — 간격', () => {
  it('고를 수 있는 간격(50·100)은 그대로 둔다', () => {
    expect(sanitizeRulerFields(ruler({ interval: 50 }))?.interval).toBe(50);
    expect(sanitizeRulerFields(ruler({ interval: 100 }))?.interval).toBe(100);
  });

  it('그 밖의 값은 눈금을 버리지 않고 기본 간격으로 되돌린다', () => {
    for (const other of [
      10,
      49,
      51,
      99,
      101,
      200,
      0,
      -50,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      '50',
      null,
      undefined,
    ]) {
      expect(sanitizeRulerFields(ruler({ interval: other }))?.interval).toBe(
        RULER_INTERVAL_DEFAULT,
      );
    }
  });
});

describe('sanitizeRulerFields — 표시 옵션은 기본값으로 되돌린다', () => {
  it('이름이 문자열이 아니면 빈 문자열', () => {
    expect(sanitizeRulerFields(ruler({ name: 12 }))?.name).toBe('');
    const { name: _name, ...noName } = ruler();
    void _name;
    expect(sanitizeRulerFields(noName)?.name).toBe('');
  });

  it.each(['textColor', 'dotColor'])(
    '%s 는 #rrggbb 만 받아 소문자로, 그 외는 기본색',
    (field) => {
      const out = sanitizeRulerFields(ruler({ [field]: '#FFAA00' }));
      expect(out?.[field as 'textColor' | 'dotColor']).toBe('#ffaa00');
      for (const bad of [
        '#fff',
        'white',
        'rgb(1,2,3)',
        '',
        0,
        null,
        undefined,
      ]) {
        const fallback = sanitizeRulerFields(ruler({ [field]: bad }));
        expect(fallback?.[field as 'textColor' | 'dotColor']).toBe(
          RULER_DEFAULT_COLOR,
        );
      }
    },
  );

  it('글자 색과 점 색은 서로 독립이다', () => {
    const out = sanitizeRulerFields(
      ruler({ textColor: '#ff0000', dotColor: '#00ff00' }),
    );
    expect(out?.textColor).toBe('#ff0000');
    expect(out?.dotColor).toBe('#00ff00');
  });

  it('시작 값은 0 이 아닌 유한수만 남긴다', () => {
    expect(sanitizeRulerFields(ruler({ startValue: 150 }))?.startValue).toBe(
      150,
    );
    expect(sanitizeRulerFields(ruler({ startValue: -20.5 }))?.startValue).toBe(
      -20.5,
    );
    for (const dropped of [
      0,
      Number.NaN,
      Number.NEGATIVE_INFINITY,
      '150',
      null,
    ]) {
      expect(
        sanitizeRulerFields(ruler({ startValue: dropped })),
      ).not.toHaveProperty('startValue');
    }
  });

  it("unitHidden·locked 는 true 만 남긴다('yes'·1·false 는 생략)", () => {
    const kept = sanitizeRulerFields(ruler({ unitHidden: true, locked: true }));
    expect(kept?.unitHidden).toBe(true);
    expect(kept?.locked).toBe(true);
    for (const other of ['yes', 1, false, null]) {
      const out = sanitizeRulerFields(
        ruler({ unitHidden: other, locked: other }),
      );
      expect(out).not.toHaveProperty('unitHidden');
      expect(out).not.toHaveProperty('locked');
    }
  });

  it('기본값뿐인 눈금은 선택 필드가 저장본(JSON)에 남지 않는다', () => {
    const out = sanitizeRulerFields(
      ruler({ startValue: 0, unitHidden: false, locked: false }),
    );
    expect(Object.keys(JSON.parse(JSON.stringify(out))).sort()).toEqual([
      'dotColor',
      'interval',
      'length',
      'name',
      'position',
      'rotation',
      'textColor',
    ]);
  });
});

describe('sanitizeRulerGuide — 보조선', () => {
  it('객체가 아니면 undefined (없음·null·배열·문자열·true)', () => {
    for (const bad of [undefined, null, [guide()], 'guide', true, 10]) {
      expect(sanitizeRulerGuide(bad)).toBeUndefined();
    }
  });

  it('정상 보조선은 길이·색을 보존하고 알 수 없는 필드는 버린다', () => {
    expect(sanitizeRulerGuide(guide({ extra: 1 }))).toEqual({
      length: 10,
      color: '#ffffff',
    });
  });

  it('길이가 0·음수·NaN·Infinity·문자열·누락이면 보조선을 버린다', () => {
    for (const bad of [
      0,
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      '10',
      null,
      undefined,
    ]) {
      expect(sanitizeRulerGuide(guide({ length: bad }))).toBeUndefined();
    }
  });

  it('색은 #rrggbb 만 받아 소문자로, 그 외는 기본색', () => {
    expect(sanitizeRulerGuide(guide({ color: '#FFAA00' }))?.color).toBe(
      '#ffaa00',
    );
    for (const bad of ['#fff', 'white', '', 0, null, undefined]) {
      expect(sanitizeRulerGuide(guide({ color: bad }))?.color).toBe(
        RULER_DEFAULT_COLOR,
      );
    }
  });

  it("방향은 'right' 만 남긴다 — 기본('left')·오타·타입 오염은 필드 생략", () => {
    expect(sanitizeRulerGuide(guide({ side: 'right' }))?.side).toBe('right');
    for (const other of ['left', 'Right', 'both', '', 1, true, null]) {
      expect(sanitizeRulerGuide(guide({ side: other }))).not.toHaveProperty(
        'side',
      );
    }
  });

  it('불투명도는 범위로 자르고 1(기본)은 생략한다', () => {
    expect(sanitizeRulerGuide(guide({ opacity: 0.5 }))?.opacity).toBe(0.5);
    // 경계 — 하한 정확값은 그대로, 그 아래는 하한으로.
    expect(
      sanitizeRulerGuide(guide({ opacity: RULER_GUIDE_OPACITY_MIN }))?.opacity,
    ).toBe(RULER_GUIDE_OPACITY_MIN);
    expect(sanitizeRulerGuide(guide({ opacity: 0 }))?.opacity).toBe(
      RULER_GUIDE_OPACITY_MIN,
    );
    expect(sanitizeRulerGuide(guide({ opacity: -3 }))?.opacity).toBe(
      RULER_GUIDE_OPACITY_MIN,
    );
    // 상한 정확값과 그 위는 기본이라 필드가 빠진다.
    expect(sanitizeRulerGuide(guide({ opacity: 1 }))).not.toHaveProperty(
      'opacity',
    );
    expect(sanitizeRulerGuide(guide({ opacity: 7 }))).not.toHaveProperty(
      'opacity',
    );
  });

  it('불투명도가 숫자가 아니면(문자열·NaN·Infinity) 기본으로 본다', () => {
    for (const bad of ['0.5', Number.NaN, Number.POSITIVE_INFINITY, null]) {
      expect(sanitizeRulerGuide(guide({ opacity: bad }))).not.toHaveProperty(
        'opacity',
      );
    }
  });
});

describe('sanitizeRulerFields — 보조선 포함', () => {
  it('유효한 보조선은 눈금에 싣는다', () => {
    expect(
      sanitizeRulerFields(
        ruler({ guide: guide({ side: 'right', opacity: 0.3 }) }),
      )?.guide,
    ).toEqual({ length: 10, color: '#ffffff', side: 'right', opacity: 0.3 });
  });

  it('보조선이 깨졌으면 보조선만 버리고 눈금은 살린다', () => {
    for (const bad of [guide({ length: 0 }), 'guide', null, 3, []]) {
      const out = sanitizeRulerFields(ruler({ guide: bad }));
      expect(out).not.toBeNull();
      expect(out).not.toHaveProperty('guide');
    }
  });
});
