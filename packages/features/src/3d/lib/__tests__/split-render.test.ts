import { describe, expect, it, vi } from 'vitest';
import {
  Color,
  PerspectiveCamera,
  Scene,
  type Camera,
  type WebGLRenderer,
} from 'three';
import type { SceneViewport } from '@crane/domain/3d';
import type { TerrainLodController } from '../../model/terrain-lod-controller';
import { renderSplitFrame } from '../split-render';

type Rect = [number, number, number, number];

interface DrawRecord {
  camera: Camera;
  /** 불투명 패스 시점(shadow pass 뒤)의 GL viewport·scissor. */
  opaque: { viewport: Rect; scissor: Rect; scissorTest: boolean };
  /** 바다 미러 패스 뒤(물·투명 객체)의 GL viewport·scissor. */
  afterWater: { viewport: Rect; scissor: Rect; scissorTest: boolean };
}

/**
 * three r183 WebGLRenderer 의 viewport 규약만 흉내 낸 가짜 렌더러.
 * - setViewport/setScissor: CSS px × pixelRatio 를 **반올림**해 GL 에 쓴다.
 * - setRenderTarget(null): 저장된 CSS 값 × pixelRatio 를 **내림**해 다시 쓴다.
 * - render: shadow 가 대기 중이면 shadow pass(RT 전환 → 복원)를 먼저 돌리고
 *   불투명 패스를 기록한 뒤, 바다 미러 패스(RT 전환 → 복원)를 거쳐 다시 기록한다.
 */
class FakeRenderer {
  readonly info = { reset: vi.fn() };
  shadowPending = false;
  mirrorPass = true;
  readonly draws: DrawRecord[] = [];

  private viewportCss: Rect = [0, 0, 0, 0];
  private scissorCss: Rect = [0, 0, 0, 0];
  private scissorTest = false;
  private target: object | null = null;
  glViewport: Rect = [0, 0, 0, 0];
  glScissor: Rect = [0, 0, 0, 0];
  glScissorTest = false;

  private readonly pixelRatio: number;

  constructor(pixelRatio: number) {
    this.pixelRatio = pixelRatio;
  }

  getPixelRatio(): number {
    return this.pixelRatio;
  }

  setViewport(x: number, y: number, width: number, height: number): void {
    this.viewportCss = [x, y, width, height];
    this.glViewport = this.toDevice(this.viewportCss, Math.round);
  }

  setScissor(x: number, y: number, width: number, height: number): void {
    this.scissorCss = [x, y, width, height];
    this.glScissor = this.toDevice(this.scissorCss, Math.round);
  }

  setScissorTest(on: boolean): void {
    this.scissorTest = on;
    this.glScissorTest = on;
  }

  getRenderTarget(): object | null {
    return this.target;
  }

  setRenderTarget(target: object | null): void {
    this.target = target;
    if (target === null) {
      this.glViewport = this.toDevice(this.viewportCss, Math.floor);
      this.glScissor = this.toDevice(this.scissorCss, Math.floor);
      this.glScissorTest = this.scissorTest;
    } else {
      this.glViewport = [0, 0, 512, 512];
      this.glScissor = [0, 0, 512, 512];
      this.glScissorTest = false;
    }
  }

  getClearColor(target: Color): Color {
    return target.set(0x000000);
  }

  getClearAlpha(): number {
    return 1;
  }

  setClearColor(): void {}

  clear(): void {}

  render(_scene: Scene, camera: Camera): void {
    if (this.shadowPending) {
      this.shadowPending = false;
      this.nestedPass();
    }
    const opaque = this.snapshot();
    if (this.mirrorPass) this.nestedPass();
    this.draws.push({ camera, opaque, afterWater: this.snapshot() });
  }

  private nestedPass(): void {
    const previous = this.target;
    this.setRenderTarget({});
    this.setRenderTarget(previous);
  }

  private snapshot() {
    return {
      viewport: [...this.glViewport] as Rect,
      scissor: [...this.glScissor] as Rect,
      scissorTest: this.glScissorTest,
    };
  }

  private toDevice(rect: Rect, snap: (value: number) => number): Rect {
    return rect.map((value) => snap(value * this.pixelRatio)) as Rect;
  }
}

function tile(
  key: string,
  size: SceneViewport['size'],
): SceneViewport & { camera: PerspectiveCamera } {
  return {
    key,
    camera: new PerspectiveCamera(75, 1, 1, 1000),
    size,
    portal: { current: null },
  };
}

/** 1600×900 캔버스의 2×2 — split-rects 의 간격 2px 결과와 같은 사각형. */
function grid2x2(): SceneViewport[] {
  return [
    tile('split:0', { left: 0, top: 0, width: 799, height: 449 }),
    tile('split:1', { left: 801, top: 0, width: 799, height: 449 }),
    tile('split:2', { left: 0, top: 451, width: 799, height: 449 }),
    tile('split:3', { left: 801, top: 451, width: 799, height: 449 }),
  ];
}

function renderFrame(
  renderer: FakeRenderer,
  viewports: readonly SceneViewport[],
  width = 1600,
  height = 900,
) {
  const lod = { apply: vi.fn() };
  renderSplitFrame({
    renderer: renderer as unknown as WebGLRenderer,
    scene: new Scene(),
    viewports,
    width,
    height,
    fov: 50,
    clearColor: new Color(0x101010),
    lod: lod as unknown as TerrainLodController,
  });
  return { lod };
}

describe('renderSplitFrame — shadow pass 가 낀 프레임의 타일 사각형', () => {
  it('DPR 1.5 홀수 사각형에서도 shadow pass 유무와 무관하게 첫 타일이 같은 사각형에 그려진다', () => {
    const viewports = grid2x2();
    const plain = new FakeRenderer(1.5);
    renderFrame(plain, viewports);

    const withShadow = new FakeRenderer(1.5);
    withShadow.shadowPending = true;
    renderFrame(withShadow, viewports);

    expect(withShadow.draws[0].opaque).toEqual(plain.draws[0].opaque);
    // 1600×900 @1.5 의 첫 타일(GL y=451, 799×449)은 반올림과 내림이 1px
    // 갈리는 값이다 — 이 테스트가 실제로 어긋남을 검출할 수 있는 입력이다.
    expect(plain.draws[0].opaque.viewport).toEqual([0, 676, 1198, 673]);
  });

  it('shadow pass 는 첫 타일에서만 소비되고 나머지 타일도 같은 규칙의 사각형이다', () => {
    const renderer = new FakeRenderer(1.5);
    renderer.shadowPending = true;
    renderFrame(renderer, grid2x2());

    expect(renderer.shadowPending).toBe(false);
    expect(renderer.draws.map((d) => d.opaque.viewport)).toEqual([
      [0, 676, 1198, 673],
      [1201, 676, 1198, 673],
      [0, 0, 1198, 673],
      [1201, 0, 1198, 673],
    ]);
  });

  it('바다 미러 패스 뒤(물·투명)도 불투명 패스와 같은 viewport·scissor 다', () => {
    const renderer = new FakeRenderer(1.5);
    renderer.shadowPending = true;
    renderFrame(renderer, grid2x2());

    for (const draw of renderer.draws) {
      expect(draw.afterWater).toEqual(draw.opaque);
      expect(draw.opaque.scissor).toEqual(draw.opaque.viewport);
      expect(draw.opaque.scissorTest).toBe(true);
    }
  });

  it('캔버스 크기가 소수(getBoundingClientRect)여도 shadow pass 유무로 갈리지 않는다', () => {
    const viewports = [
      tile('split:0', { left: 0, top: 0, width: 755, height: 430 }),
      tile('split:1', { left: 757, top: 0, width: 754.5, height: 430 }),
    ];
    const plain = new FakeRenderer(1.5);
    renderFrame(plain, viewports, 1511.5, 860.75);
    const withShadow = new FakeRenderer(1.5);
    withShadow.shadowPending = true;
    renderFrame(withShadow, viewports, 1511.5, 860.75);

    expect(withShadow.draws.map((d) => d.opaque)).toEqual(
      plain.draws.map((d) => d.opaque),
    );
  });

  it('DPR 1 은 반올림·내림이 같아 CSS 사각형 그대로다', () => {
    const renderer = new FakeRenderer(1);
    renderer.shadowPending = true;
    renderFrame(renderer, grid2x2());

    expect(renderer.draws[0].opaque.viewport).toEqual([0, 451, 799, 449]);
  });
});

describe('renderSplitFrame — 경계·정리', () => {
  it('크기가 0 인 타일은 LOD 적용·렌더 없이 건너뛴다', () => {
    const renderer = new FakeRenderer(1.5);
    const viewports = [
      tile('split:0', { left: 0, top: 0, width: 0, height: 449 }),
      tile('split:1', { left: 801, top: 0, width: 799, height: 0 }),
      tile('split:2', { left: 0, top: 451, width: 799, height: 449 }),
    ];
    const { lod } = renderFrame(renderer, viewports);

    expect(renderer.draws).toHaveLength(1);
    expect(renderer.draws[0].camera).toBe(viewports[2].camera);
    expect(lod.apply).toHaveBeenCalledTimes(1);
    expect(lod.apply).toHaveBeenCalledWith(
      'split:2',
      viewports[2].camera,
      449 * 1.5,
    );
  });

  it('캔버스 밖으로 넘친 타일은 캔버스 안으로 잘라 그린다', () => {
    const renderer = new FakeRenderer(1);
    renderFrame(
      renderer,
      [tile('split:0', { left: 900, top: 500, width: 799, height: 449 })],
      1600,
      900,
    );

    expect(renderer.draws[0].opaque.viewport).toEqual([900, 0, 700, 400]);
  });

  it('프레임 뒤 scissor test 를 끄고 캔버스 전체 viewport 로 되돌린다', () => {
    const renderer = new FakeRenderer(1.5);
    renderer.shadowPending = true;
    renderFrame(renderer, grid2x2());

    expect(renderer.glScissorTest).toBe(false);
    expect(renderer.glViewport).toEqual([0, 0, 2400, 1350]);
    expect(renderer.getRenderTarget()).toBeNull();
  });

  it('타일 카메라의 종횡비·fov 를 타일에 맞춘다', () => {
    const renderer = new FakeRenderer(1.5);
    const viewports = grid2x2();
    renderFrame(renderer, viewports);

    const camera = viewports[0].camera;
    expect(camera.fov).toBe(50);
    expect(camera.aspect).toBeCloseTo(799 / 449);
  });
});
