import { describe, expect, it } from 'vitest';
import { resolveSeaVisible } from '../scene-sea';
import { getEnvironmentFileUrlByRegionId } from '../../model/scene-environment-registry';
import { sceneEnvironmentCatalog } from '../../model/scene-environment-catalog';

/** region 기본 배경이 등록된 region / 등록되지 않은 region. */
const REGION_WITH_DEFAULT_SKY = 'philly-dock-2';
const REGION_WITHOUT_DEFAULT_SKY = 'dock-in';
const CATALOG_ID = sceneEnvironmentCatalog[0].id;

describe('resolveSeaVisible — 명시 boolean 이 우선한다', () => {
  it('전제: region 기본 배경 등록 상태가 테스트 가정과 맞다', () => {
    expect(getEnvironmentFileUrlByRegionId(REGION_WITH_DEFAULT_SKY)).not.toBe(
      null,
    );
    expect(getEnvironmentFileUrlByRegionId(REGION_WITHOUT_DEFAULT_SKY)).toBe(
      null,
    );
  });

  it('sea:true 는 배경 없음(environmentId:null)이어도 true', () => {
    expect(
      resolveSeaVisible(REGION_WITHOUT_DEFAULT_SKY, {
        sea: true,
        environmentId: null,
      }),
    ).toBe(true);
  });

  it('sea:false 는 카탈로그 배경이 있어도 false', () => {
    expect(
      resolveSeaVisible(REGION_WITH_DEFAULT_SKY, {
        sea: false,
        environmentId: CATALOG_ID,
      }),
    ).toBe(false);
  });
});

describe('resolveSeaVisible — 미지정(undefined)은 레거시 규칙(배경이 있으면 바다)', () => {
  it('environmentId 미지정 + region 기본 배경 있음 → true', () => {
    expect(resolveSeaVisible(REGION_WITH_DEFAULT_SKY, {})).toBe(true);
  });

  it('environmentId 미지정 + region 기본 배경 없음 → false', () => {
    expect(resolveSeaVisible(REGION_WITHOUT_DEFAULT_SKY, {})).toBe(false);
  });

  it('environmentId:null(배경 없음 명시) → region 기본이 있어도 false', () => {
    expect(
      resolveSeaVisible(REGION_WITH_DEFAULT_SKY, { environmentId: null }),
    ).toBe(false);
  });

  it('카탈로그 배경을 고른 씬은 region 기본이 없어도 true', () => {
    expect(
      resolveSeaVisible(REGION_WITHOUT_DEFAULT_SKY, {
        environmentId: CATALOG_ID,
      }),
    ).toBe(true);
  });

  it('카탈로그에 없는 id 는 배경 없음으로 떨어져 false', () => {
    expect(
      resolveSeaVisible(REGION_WITH_DEFAULT_SKY, {
        environmentId: 'no-such-environment',
      }),
    ).toBe(false);
  });

  it('sceneInfo 가 null/undefined 면 region 규칙만 본다', () => {
    expect(resolveSeaVisible(REGION_WITH_DEFAULT_SKY, null)).toBe(true);
    expect(resolveSeaVisible(REGION_WITH_DEFAULT_SKY, undefined)).toBe(true);
    expect(resolveSeaVisible(REGION_WITHOUT_DEFAULT_SKY, null)).toBe(false);
    expect(resolveSeaVisible(REGION_WITHOUT_DEFAULT_SKY, undefined)).toBe(
      false,
    );
  });
});

describe('resolveSeaVisible — boolean 이 아닌 sea 는 미지정으로 취급', () => {
  it("'yes'·1 같은 truthy 오염값은 명시로 보지 않고 레거시 규칙으로 간다", () => {
    const polluted = (sea: unknown) =>
      ({ sea, environmentId: null }) as unknown as {
        sea?: boolean;
        environmentId?: string | null;
      };
    // 배경 없음이므로 레거시 규칙은 false — truthy 값을 그대로 믿었다면 true.
    expect(resolveSeaVisible(REGION_WITH_DEFAULT_SKY, polluted('yes'))).toBe(
      false,
    );
    expect(resolveSeaVisible(REGION_WITH_DEFAULT_SKY, polluted(1))).toBe(false);
    // 반대로 falsy 오염값(0·null)도 명시 false 가 아니다 — 배경이 있으면 true.
    expect(
      resolveSeaVisible(REGION_WITH_DEFAULT_SKY, {
        ...polluted(0),
        environmentId: undefined,
      }),
    ).toBe(true);
    expect(
      resolveSeaVisible(REGION_WITH_DEFAULT_SKY, {
        ...polluted(null),
        environmentId: undefined,
      }),
    ).toBe(true);
  });
});
