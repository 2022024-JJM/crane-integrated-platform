import { describe, expect, it } from 'vitest';
import {
  DAYLIGHT_FADE,
  DAY_AMBIENT_BOOST,
  DAY_HEMISPHERE_GROUND_COLOR,
  DAY_HEMISPHERE_INTENSITY,
  DAY_HEMISPHERE_SKY_COLOR,
  FILL_LIGHT_INTENSITY_RATIO,
  NIGHT_AMBIENT_COLOR_DARK,
  NIGHT_AMBIENT_COLOR_LIT,
  NIGHT_AMBIENT_INTENSITY_DARK,
  NIGHT_AMBIENT_INTENSITY_LIT,
  NIGHT_HEMISPHERE_GROUND_COLOR,
  NIGHT_HEMISPHERE_INTENSITY_DARK,
  NIGHT_HEMISPHERE_INTENSITY_LIT,
  NIGHT_HEMISPHERE_SKY_COLOR,
  NIGHT_SKY_INTENSITY,
  NIGHT_SKY_TINT_ALPHA,
  SUN_COLOR_HORIZON,
  SUN_COLOR_ZENITH,
  SUN_COMPENSATION_MAX,
  SUN_COMPENSATION_REF_ELEVATION,
  SUN_KEY_FADE,
  YARD_LIGHT_COLOR,
  YARD_LIGHT_FADE,
  YARD_LIGHT_INTENSITY_RATIO,
  classifySkyPhase,
  resolveSkyLighting,
  smoothstep,
} from '../sky-lighting';

const BASE = { sunIntensity: 3.6, ambientIntensity: 0.9 };
const YARD_FULL = BASE.sunIntensity * YARD_LIGHT_INTENSITY_RATIO;

function at(
  sunElevation: number,
  moonElevation = -30,
  moonFraction = 0.5,
  yardLights = true,
) {
  return resolveSkyLighting(
    { sunElevation, moonElevation, moonFraction },
    BASE,
    { yardLights },
  );
}

describe('smoothstep', () => {
  it('경계 밖은 0/1, 중간은 0.5, 단조 증가', () => {
    expect(smoothstep(0, 10, -1)).toBe(0);
    expect(smoothstep(0, 10, 11)).toBe(1);
    expect(smoothstep(0, 10, 5)).toBeCloseTo(0.5, 12);
    let prev = -1;
    for (let x = -2; x <= 12; x += 0.5) {
      const v = smoothstep(0, 10, x);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('edge0 === edge1 이면 계단', () => {
    expect(smoothstep(5, 5, 4.9)).toBe(0);
    expect(smoothstep(5, 5, 5)).toBe(1);
  });
});

describe('resolveSkyLighting — 낮', () => {
  it('기준 고도(수동 기본값 78.7°)의 태양은 기존 세기 그대로 — 백색·하늘 1·작업등 꺼짐', () => {
    const sky = at(SUN_COMPENSATION_REF_ELEVATION);
    expect(sky.sunIntensity).toBeCloseTo(BASE.sunIntensity, 12);
    expect(sky.yardIntensity).toBe(0);
    // 밤 전용 요소는 0 — 낮엔 하늘빛 반구광만 더해진다.
    expect(sky.fillIntensity).toBe(0);
    expect(sky.hemisphereIntensity).toBeCloseTo(DAY_HEMISPHERE_INTENSITY, 12);
    expect(sky.hemisphereSkyColor).toEqual(DAY_HEMISPHERE_SKY_COLOR);
    expect(sky.skyTintOpacity).toBe(0);
    expect(sky.keyYardBlend).toBe(0);
    expect(sky.keyColor).toEqual(SUN_COLOR_ZENITH);
    expect(sky.ambientIntensity).toBeCloseTo(
      BASE.ambientIntensity * DAY_AMBIENT_BOOST,
      12,
    );
    expect(sky.ambientColor).toEqual([1, 1, 1]);
    expect(sky.skyIntensity).toBe(1);
    expect(sky.daylight).toBe(1);
    expect(sky.sunVisibility).toBe(1);
  });

  it('낮은 태양은 지면 조도 보상으로 세기가 오르되 상한이 있다 — 오후·겨울도 밝다', () => {
    expect(at(60).sunIntensity).toBeGreaterThan(BASE.sunIntensity);
    expect(at(60).sunIntensity).toBeCloseTo(
      BASE.sunIntensity *
        (Math.sin((SUN_COMPENSATION_REF_ELEVATION * Math.PI) / 180) /
          Math.sin((60 * Math.PI) / 180)),
      10,
    );
    expect(at(30).sunIntensity).toBeCloseTo(
      BASE.sunIntensity * SUN_COMPENSATION_MAX,
      10,
    );
    // 지평선 위에서는 세기·색·하늘이 낮 그대로다(전환은 지평선 근처 몇 도).
    for (const el of [10, 20, 45]) {
      expect(at(el).skyIntensity).toBe(1);
      expect(at(el).daylight).toBe(1);
      expect(at(el).keyColor).toEqual(SUN_COLOR_ZENITH);
      expect(at(el).yardIntensity).toBe(0);
    }
  });

  it('지평선(0°)의 태양은 노을색이 섞이고 세기·하늘이 낮보다 낮다', () => {
    const sky = at(0);
    expect(sky.sunIntensity).toBeGreaterThan(0);
    expect(sky.sunIntensity).toBeLessThan(at(10).sunIntensity);
    // 작업등이 켜지기 시작해 색은 노을과 작업등의 혼합 — 어느 한쪽 순색은 아니다.
    expect(sky.keyYardBlend).toBeGreaterThan(0);
    expect(sky.keyYardBlend).toBeLessThan(1);
    expect(sky.keyColor).not.toEqual(SUN_COLOR_ZENITH);
    expect(sky.skyIntensity).toBeGreaterThan(NIGHT_SKY_INTENSITY);
    expect(sky.skyIntensity).toBeLessThan(1);
  });

  it('작업등 점등 상한(YARD_LIGHT_FADE[1]) 위에서는 작업등이 완전히 꺼져 있다', () => {
    const sky = at(YARD_LIGHT_FADE[1]);
    expect(sky.yardIntensity).toBe(0);
    expect(sky.keyColor).toEqual(
      at(YARD_LIGHT_FADE[1], -30, 0.5, false).keyColor,
    );
  });
});

describe('resolveSkyLighting — 밤 (작업등 켜짐)', () => {
  it('깊은 밤(−40°)은 하늘만 어둡고 작업등이 방향광, 환경광은 난색으로 밝다', () => {
    const sky = at(-40, 50, 1);
    expect(sky.daylight).toBe(0);
    expect(sky.skyIntensity).toBeCloseTo(NIGHT_SKY_INTENSITY, 12);
    expect(sky.sunIntensity).toBe(0);
    expect(sky.yardIntensity).toBeCloseTo(YARD_FULL, 12);
    expect(sky.keyIntensity).toBeCloseTo(YARD_FULL, 12);
    expect(sky.keyYardBlend).toBe(1);
    expect(sky.keyColor).toEqual(YARD_LIGHT_COLOR);
    expect(sky.ambientIntensity).toBeCloseTo(NIGHT_AMBIENT_INTENSITY_LIT, 12);
    expect(sky.ambientColor).toEqual(NIGHT_AMBIENT_COLOR_LIT);
    expect(sky.sunVisibility).toBe(0);
    expect(sky.moonVisibility).toBeGreaterThan(0.9);
    // 보조 투광등·반구광·하늘 틴트가 모두 켜진다.
    expect(sky.fillIntensity).toBeCloseTo(
      YARD_FULL * FILL_LIGHT_INTENSITY_RATIO,
      12,
    );
    expect(sky.fillColor).toEqual(YARD_LIGHT_COLOR);
    expect(sky.hemisphereIntensity).toBeCloseTo(
      NIGHT_HEMISPHERE_INTENSITY_LIT,
      12,
    );
    expect(sky.hemisphereGroundColor).toEqual(NIGHT_HEMISPHERE_GROUND_COLOR);
    expect(sky.skyTintOpacity).toBeCloseTo(NIGHT_SKY_TINT_ALPHA, 12);
  });

  it('달의 고도·위상은 조명 세기에 영향을 주지 않고 표식만 바꾼다', () => {
    const moonUp = at(-40, 60, 1);
    const moonDown = at(-40, -20, 1);
    const newMoon = at(-40, 60, 0);
    expect(moonDown.keyIntensity).toBe(moonUp.keyIntensity);
    expect(newMoon.keyIntensity).toBe(moonUp.keyIntensity);
    expect(moonDown.ambientIntensity).toBe(moonUp.ambientIntensity);
    expect(moonDown.moonVisibility).toBe(0);
    expect(newMoon.moonVisibility).toBeLessThan(moonUp.moonVisibility);
  });
});

describe('resolveSkyLighting — 밤 (작업등 꺼짐)', () => {
  it('방향광 0·푸른 바닥 환경광·방향은 마스트 쪽(1)', () => {
    const sky = at(-40, 50, 1, false);
    expect(sky.yardIntensity).toBe(0);
    expect(sky.keyIntensity).toBe(0);
    expect(sky.keyYardBlend).toBe(1);
    expect(sky.ambientIntensity).toBeCloseTo(NIGHT_AMBIENT_INTENSITY_DARK, 12);
    expect(sky.ambientColor).toEqual(NIGHT_AMBIENT_COLOR_DARK);
    expect(sky.skyIntensity).toBeCloseTo(NIGHT_SKY_INTENSITY, 12);
    // 보조 투광등은 꺼지고 반구광은 약한 푸른 값, 하늘 틴트는 그대로(밤이니까).
    expect(sky.fillIntensity).toBe(0);
    expect(sky.hemisphereIntensity).toBeCloseTo(
      NIGHT_HEMISPHERE_INTENSITY_DARK,
      12,
    );
    expect(sky.hemisphereGroundColor).toEqual(NIGHT_AMBIENT_COLOR_DARK);
    expect(sky.skyTintOpacity).toBeCloseTo(NIGHT_SKY_TINT_ALPHA, 12);
  });

  it('낮에는 옵션과 무관하게 같은 값이다', () => {
    expect(at(60, -30, 0.5, false)).toEqual(at(60, -30, 0.5, true));
  });
});

describe('resolveSkyLighting — 태양→작업등 인계 연속성', () => {
  it('점등 구간이 태양 소등 고도(SUN_KEY_FADE 하한)를 품는다', () => {
    expect(YARD_LIGHT_FADE[0]).toBeLessThan(SUN_KEY_FADE[0]);
    expect(YARD_LIGHT_FADE[1]).toBeGreaterThan(SUN_KEY_FADE[0]);
  });

  it('고도 1° 간격으로 훑어도 세기·혼합비·환경광이 갑자기 튀지 않는다', () => {
    let prev = at(30, -30, 0);
    for (let el = 29; el >= -30; el -= 1) {
      const cur = at(el, -30, 0);
      // 인계 구간이 7°(SUN_KEY_FADE)로 좁아 1° 당 변화가 크지만, 실제로는
      // 수 분에 걸친 변화라 프레임 단위론 연속이다.
      expect(Math.abs(cur.keyIntensity - prev.keyIntensity)).toBeLessThan(
        BASE.sunIntensity * 0.4,
      );
      expect(Math.abs(cur.keyYardBlend - prev.keyYardBlend)).toBeLessThan(0.5);
      expect(
        Math.abs(cur.ambientIntensity - prev.ambientIntensity),
      ).toBeLessThan(0.2);
      expect(Math.abs(cur.fillIntensity - prev.fillIntensity)).toBeLessThan(
        0.3,
      );
      expect(
        Math.abs(cur.hemisphereIntensity - prev.hemisphereIntensity),
      ).toBeLessThan(0.15);
      expect(Math.abs(cur.skyTintOpacity - prev.skyTintOpacity)).toBeLessThan(
        0.15,
      );
      prev = cur;
    }
  });

  it('혼합비는 고도가 내려갈수록 0 → 1 로 단조 증가한다', () => {
    let prev = at(30).keyYardBlend;
    for (let el = 29; el >= -30; el -= 1) {
      const cur = at(el).keyYardBlend;
      expect(cur).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = cur;
    }
    expect(at(30).keyYardBlend).toBe(0);
    expect(at(-30).keyYardBlend).toBe(1);
  });

  it('하늘·낮 비율은 고도가 내려갈수록 단조 감소한다', () => {
    let prev = at(90, -30, 0);
    for (let el = 89; el >= -30; el -= 1) {
      const cur = at(el, -30, 0);
      expect(cur.skyIntensity).toBeLessThanOrEqual(prev.skyIntensity + 1e-12);
      expect(cur.daylight).toBeLessThanOrEqual(prev.daylight + 1e-12);
      prev = cur;
    }
  });

  it('밤에도 방향광이 낮의 절반~3/4 로 남아 장비가 보인다', () => {
    const night = at(-40);
    expect(night.keyIntensity).toBeGreaterThan(BASE.sunIntensity * 0.3);
    expect(night.keyIntensity).toBeLessThanOrEqual(BASE.sunIntensity * 0.75);
    expect(night.ambientIntensity).toBeGreaterThan(BASE.ambientIntensity * 0.6);
  });
});

describe('resolveSkyLighting — 잘못된 입력', () => {
  it('NaN·무한대 고도는 낮으로 본다 (관제 화면이 캄캄해지지 않게)', () => {
    const nan = at(Number.NaN);
    expect(nan.daylight).toBe(1);
    expect(nan.keyIntensity).toBeCloseTo(BASE.sunIntensity, 12);
    const inf = at(Number.NEGATIVE_INFINITY);
    expect(inf.daylight).toBe(1);
  });

  it('범위 밖 고도는 [−90, 90] 로 클램프한다', () => {
    expect(at(500)).toEqual(at(90));
    expect(at(-500)).toEqual(at(-90));
  });

  it('조명 비율 오염(NaN·범위 밖)은 0 또는 클램프 — 표식에만 반영', () => {
    expect(at(-40, 60, Number.NaN).moonVisibility).toBe(
      at(-40, 60, 0).moonVisibility,
    );
    expect(at(-40, 60, 7).moonVisibility).toBe(at(-40, 60, 1).moonVisibility);
  });

  it('SUN_COLOR_HORIZON 은 작업등을 끈 지평선 아래(-2°) 태양의 색이다', () => {
    expect(at(-2, -30, 0.5, false).keyColor).toEqual(SUN_COLOR_HORIZON);
  });
});

describe('classifySkyPhase', () => {
  it('낮·밤·새벽(동쪽 박명)·황혼(서쪽 박명)', () => {
    expect(classifySkyPhase(45, 180)).toBe('day');
    expect(classifySkyPhase(-30, 0)).toBe('night');
    expect(classifySkyPhase(-2, 95)).toBe('dawn');
    expect(classifySkyPhase(-2, 265)).toBe('dusk');
  });

  it('경계 — 6° 은 낮, DAYLIGHT_FADE 하한 바로 아래는 밤', () => {
    expect(classifySkyPhase(6, 180)).toBe('day');
    expect(classifySkyPhase(5.999, 180)).toBe('dusk');
    expect(classifySkyPhase(DAYLIGHT_FADE[0], 180)).toBe('dusk');
    expect(classifySkyPhase(DAYLIGHT_FADE[0] - 0.001, 180)).toBe('night');
  });

  it('방위 랩·NaN 방어', () => {
    expect(classifySkyPhase(0, 450)).toBe('dawn'); // 90°
    expect(classifySkyPhase(0, -90)).toBe('dusk'); // 270°
    expect(classifySkyPhase(0, Number.NaN)).toBe('dawn');
    expect(classifySkyPhase(Number.NaN, 0)).toBe('day');
  });
});

describe('resolveSkyLighting — 반구광 색', () => {
  it('밤은 남색 하늘·난색 지면, 낮은 하늘색·지면색', () => {
    expect(at(-40, 50, 1).hemisphereSkyColor).toEqual(
      NIGHT_HEMISPHERE_SKY_COLOR,
    );
    expect(at(60).hemisphereGroundColor).toEqual(DAY_HEMISPHERE_GROUND_COLOR);
  });
});
