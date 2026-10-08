import { describe, expect, it } from 'vitest';
import { getScopeBaseUrl, resolveAppScope, toScopeUrl } from '../app-scope';

const prod = (p: string) =>
  resolveAppScope(p, '/crane_rnd/', '/crane_rnd/indoor/');
const dev = (p: string) =>
  resolveAppScope(p, '/crane_rnd/dev/', '/crane_rnd/indoor/dev/');

describe('resolveAppScope', () => {
  it('crane 주소는 crane, basename 은 끝 슬래시 없이', () => {
    expect(prod('/crane_rnd/mro2/assets')).toEqual({
      scope: 'crane',
      basename: '/crane_rnd',
      split: true,
    });
  });

  it('indoor 접두어 아래는 indoor', () => {
    expect(prod('/crane_rnd/indoor/keyin')).toEqual({
      scope: 'indoor',
      basename: '/crane_rnd/indoor',
      split: true,
    });
  });

  it('dev 환경도 같은 규칙', () => {
    expect(dev('/crane_rnd/dev/outdoor-work/philly-dock-2/3d-monitoring').basename).toBe(
      '/crane_rnd/dev',
    );
    expect(dev('/crane_rnd/indoor/dev/indoorshop').basename).toBe(
      '/crane_rnd/indoor/dev',
    );
  });

  it('슬래시 없는 indoor 루트도 indoor', () => {
    expect(prod('/crane_rnd/indoor').scope).toBe('indoor');
  });

  it('indoor 로 시작하는 crane 라우트는 crane 으로 남는다', () => {
    expect(prod('/crane_rnd/indoor-work/dock-in/crane-status').scope).toBe(
      'crane',
    );
    expect(prod('/crane_rnd/indoorX').scope).toBe('crane');
  });

  it('indoor 경로가 없거나 비면 나누지 않는다 (기존 동작)', () => {
    for (const indoor of [undefined, '', '   ']) {
      expect(resolveAppScope('/crane_rnd/indoor/', '/crane_rnd/', indoor)).toEqual(
        { scope: 'crane', basename: '/crane_rnd', split: false },
      );
    }
  });

  it('indoor 경로가 crane 과 같으면 나누지 않는다', () => {
    expect(resolveAppScope('/x/', '/x/', '/x/').split).toBe(false);
  });

  it('슬래시 없이 들어온 설정값도 정규화', () => {
    expect(resolveAppScope('/a/b/c', 'a', 'a/b').basename).toBe('/a/b');
  });

  it("base 가 '/' 거나 없으면 basename 은 빈 문자열", () => {
    expect(resolveAppScope('/x', '/', undefined).basename).toBe('');
    expect(resolveAppScope('/x', undefined, undefined).basename).toBe('');
  });
});

describe('getScopeBaseUrl', () => {
  it('범위별 시작 주소', () => {
    expect(getScopeBaseUrl('crane', '/crane_rnd/dev/', '/crane_rnd/indoor/dev/')).toBe(
      '/crane_rnd/dev/',
    );
    expect(getScopeBaseUrl('indoor', '/crane_rnd/', '/crane_rnd/indoor')).toBe(
      '/crane_rnd/indoor/',
    );
  });

  it('indoor 가 설정되지 않으면 null', () => {
    expect(getScopeBaseUrl('indoor', '/crane_rnd/', undefined)).toBeNull();
  });
});

describe('toScopeUrl', () => {
  it('라우트와 쿼리를 대상 범위 주소에 붙인다', () => {
    expect(
      toScopeUrl('/indoorshop/zones/assembly', '?factory=asm-pbs', '/crane_rnd/indoor/'),
    ).toBe('/crane_rnd/indoor/indoorshop/zones/assembly?factory=asm-pbs');
  });

  it('대상 주소에 끝 슬래시가 없어도 한 번만 붙는다', () => {
    expect(toScopeUrl('/keyin', '', '/crane_rnd/indoor')).toBe(
      '/crane_rnd/indoor/keyin',
    );
  });

  it('루트 라우트', () => {
    expect(toScopeUrl('/', '', '/crane_rnd/indoor/')).toBe('/crane_rnd/indoor/');
  });
});
