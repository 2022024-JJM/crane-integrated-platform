import { describe, expect, it } from 'vitest';
import { Color, DoubleSide } from 'three';
import {
  createGroundGridMaterial,
  GROUND_GRID_EDGE_FADE,
  GROUND_GRID_HALF_EXTENT,
  GROUND_GRID_LEVELS,
  GROUND_GRID_LOD_FADE_PX,
  GROUND_GRID_OPACITY,
  GROUND_GRID_PLANE_SIZE,
  GROUND_GRID_RENDER_ORDER,
} from '../ground-grid-material';

/** SCENE_CAMERA_CLIP.far — features 를 import 하면 R3F 가 딸려와 리터럴로 둔다. */
const CAMERA_FAR = 50000;

describe('createGroundGridMaterial — 재질 플래그', () => {
  it('오버레이: transparent(alpha 합성용), depthTest/depthWrite off, 양면', () => {
    const material = createGroundGridMaterial();
    expect(material.isShaderMaterial).toBe(true);
    expect(material.transparent).toBe(true);
    expect(material.depthTest).toBe(false);
    expect(material.depthWrite).toBe(false);
    expect(material.side).toBe(DoubleSide);
  });
});

describe('createGroundGridMaterial — 기본 유니폼', () => {
  it('3단계 크기·두께·투명도·페이드가 상수와 같다', () => {
    const { uniforms } = createGroundGridMaterial();
    expect(uniforms.uSizes.value.toArray()).toEqual([1, 10, 100]);
    // 두께는 세 단계 모두 같다 — 단계 구분은 색으로만.
    expect(uniforms.uThickness.value.toArray()).toEqual([1, 1, 1]);
    expect(uniforms.uOpacity.value).toBe(GROUND_GRID_OPACITY);
    expect(uniforms.uEdgeFade.value.toArray()).toEqual([
      GROUND_GRID_EDGE_FADE.start,
      GROUND_GRID_EDGE_FADE.end,
    ]);
    expect(uniforms.uLodFadePx.value.toArray()).toEqual([
      GROUND_GRID_LOD_FADE_PX.end,
      GROUND_GRID_LOD_FADE_PX.start,
    ]);
  });

  it('단계 색은 GROUND_GRID_LEVELS 의 hex 와 같다', () => {
    const { uniforms } = createGroundGridMaterial();
    const hex = (color: string) => new Color(color).getHexString();
    expect(uniforms.uCellColor.value.getHexString()).toBe(
      hex(GROUND_GRID_LEVELS.cell.color),
    );
    expect(uniforms.uSectionColor.value.getHexString()).toBe(
      hex(GROUND_GRID_LEVELS.section.color),
    );
    expect(uniforms.uMajorColor.value.getHexString()).toBe(
      hex(GROUND_GRID_LEVELS.major.color),
    );
  });
});

describe('상수 불변식', () => {
  it('cell 크기는 기즈모 이동 스냅(1m)과 같다', () => {
    expect(GROUND_GRID_LEVELS.cell.size).toBe(1);
  });

  it('단계는 엄격 증가한다', () => {
    expect(GROUND_GRID_LEVELS.cell.size).toBeLessThan(
      GROUND_GRID_LEVELS.section.size,
    );
    expect(GROUND_GRID_LEVELS.section.size).toBeLessThan(
      GROUND_GRID_LEVELS.major.size,
    );
  });

  it('가장자리 페이드는 평면 반경 안에서 끝난다 — 경계가 보이지 않는다', () => {
    expect(GROUND_GRID_EDGE_FADE.start).toBeLessThan(GROUND_GRID_EDGE_FADE.end);
    expect(GROUND_GRID_EDGE_FADE.end).toBeLessThan(GROUND_GRID_HALF_EXTENT);
  });

  it('LOD 페이드는 소멸(end) < 시작(start) 순이다', () => {
    expect(GROUND_GRID_LOD_FADE_PX.end).toBeLessThan(
      GROUND_GRID_LOD_FADE_PX.start,
    );
  });

  it('투명도는 (0,1], renderOrder 는 씬(0)과 선택 박스(1) 사이', () => {
    expect(GROUND_GRID_OPACITY).toBeGreaterThan(0);
    expect(GROUND_GRID_OPACITY).toBeLessThanOrEqual(1);
    expect(GROUND_GRID_RENDER_ORDER).toBeGreaterThan(0);
    expect(GROUND_GRID_RENDER_ORDER).toBeLessThan(1);
  });

  it('평면 크기는 카메라 far 안에 든다', () => {
    expect(GROUND_GRID_PLANE_SIZE).toBe(GROUND_GRID_HALF_EXTENT * 2);
    expect(GROUND_GRID_PLANE_SIZE).toBeLessThan(CAMERA_FAR);
  });
});

describe('createGroundGridMaterial — 옵션', () => {
  it('sizes·opacity·edgeFade 가 유니폼에 반영된다', () => {
    const { uniforms } = createGroundGridMaterial({
      sizes: [0.5, 5, 50],
      opacity: 0.7,
      edgeFade: { start: 100, end: 200 },
    });
    expect(uniforms.uSizes.value.toArray()).toEqual([0.5, 5, 50]);
    expect(uniforms.uOpacity.value).toBe(0.7);
    expect(uniforms.uEdgeFade.value.toArray()).toEqual([100, 200]);
  });

  it('opacity 는 [0,1] 로 클램프한다 — 경계값은 그대로', () => {
    expect(
      createGroundGridMaterial({ opacity: 1 }).uniforms.uOpacity.value,
    ).toBe(1);
    expect(
      createGroundGridMaterial({ opacity: 0 }).uniforms.uOpacity.value,
    ).toBe(0);
    expect(
      createGroundGridMaterial({ opacity: 1.5 }).uniforms.uOpacity.value,
    ).toBe(1);
    expect(
      createGroundGridMaterial({ opacity: -1 }).uniforms.uOpacity.value,
    ).toBe(0);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    '비유한 opacity(%s)는 RangeError',
    (opacity) => {
      expect(() => createGroundGridMaterial({ opacity })).toThrow(RangeError);
    },
  );

  it.each<[number, number, number]>([
    [10, 1, 100],
    [0, 10, 100],
    [-1, 10, 100],
    [1, 1, 100],
    [1, Number.POSITIVE_INFINITY, 100],
    [1, Number.NaN, 100],
  ])('잘못된 sizes %j 는 RangeError — 셰이더가 중첩을 전제한다', (...sizes) => {
    expect(() => createGroundGridMaterial({ sizes })).toThrow(RangeError);
  });

  it('thickness 음수는 0 으로, 비유한은 RangeError', () => {
    expect(
      createGroundGridMaterial({ thickness: [-1, 1, 1] }).uniforms.uThickness
        .value.x,
    ).toBe(0);
    expect(() =>
      createGroundGridMaterial({ thickness: [Number.NaN, 1, 1] }),
    ).toThrow(RangeError);
  });
});

describe('createGroundGridMaterial — 인스턴스·수명', () => {
  it('재질마다 유니폼이 독립이다 — 한쪽 조정이 다른 쪽에 번지지 않는다', () => {
    const a = createGroundGridMaterial();
    const b = createGroundGridMaterial();
    a.uniforms.uOpacity.value = 0.1;
    a.uniforms.uSizes.value.setX(99);
    expect(b.uniforms.uOpacity.value).toBe(GROUND_GRID_OPACITY);
    expect(b.uniforms.uSizes.value.x).toBe(1);
  });

  it('dispose 는 이벤트를 내고, 두 번 불러도 throw 하지 않는다', () => {
    const material = createGroundGridMaterial();
    let disposed = 0;
    material.addEventListener('dispose', () => {
      disposed += 1;
    });
    material.dispose();
    expect(() => material.dispose()).not.toThrow();
    expect(disposed).toBeGreaterThanOrEqual(1);
  });
});

describe('셰이더 계약 (설계 결정 고정)', () => {
  it('선은 월드 좌표로 그리고, 페이드는 내장 cameraPosition 을 쓴다', () => {
    const material = createGroundGridMaterial();
    expect(material.vertexShader).toContain('modelMatrix');
    expect(material.fragmentShader).toContain('cameraPosition');
    expect(material.fragmentShader).toContain('fwidth');
  });

  it('출력 색공간 청크를 포함하고, 오버레이라 logdepthbuf·#extension 은 없다', () => {
    const material = createGroundGridMaterial();
    expect(material.fragmentShader).toContain('colorspace_fragment');
    expect(material.fragmentShader).not.toContain('logdepthbuf');
    expect(material.vertexShader).not.toContain('logdepthbuf');
    expect(material.fragmentShader).not.toContain('#extension');
  });
});
