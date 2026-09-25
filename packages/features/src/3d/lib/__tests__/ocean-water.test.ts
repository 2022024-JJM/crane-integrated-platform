import { SCENE_OPAQUE_STENCIL_BIT } from '@crane/domain/3d';
import {
  BackSide,
  Color,
  EqualStencilFunc,
  FrontSide,
  Group,
  Matrix4,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Texture,
  Vector3,
  UnsignedByteType,
  Vector4,
  WebGLRenderTarget,
  type Camera,
  type WebGLRenderer,
} from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OceanWater,
  isOceanWater,
  type OceanWaterOptions,
} from '../ocean-water';

/** 중첩 render 시점의 렌더러·물 상태 — 미러 패스 동안의 값을 고정한다. */
interface RenderSnapshot {
  waterVisible: boolean;
  xrEnabled: boolean;
  shadowAutoUpdate: boolean;
  infoAutoReset: boolean;
  renderTarget: WebGLRenderTarget | null;
  cameraPosition: Vector3;
  /** 미러 카메라 행렬 — 원본 Water.js 와의 동치 비교용(재사용 객체라 복사). */
  cameraProjection: number[];
  cameraMatrixWorld: number[];
}

interface FixtureOptions {
  water?: Partial<OceanWaterOptions>;
  autoClear?: boolean;
  previousTarget?: WebGLRenderTarget | null;
  /** 초기 렌더러 플래그(기본 전부 true) — 원복이 하드코딩이 아님을 본다. */
  flags?: { xr?: boolean; shadow?: boolean; autoReset?: boolean };
  /** 중첩 render 안에서 추가로 실행할 것(제외 객체 관찰·throw). */
  onRender?: () => void;
}

/** 물 객체와 무관한 mock 렌더러 — 원본 Water.js 에도 그대로 물린다. */
function createRenderer(
  options: FixtureOptions,
  isWaterVisible: () => boolean,
) {
  const snapshots: RenderSnapshot[] = [];
  let current: WebGLRenderTarget | null = options.previousTarget ?? null;
  const renderer = {
    autoClear: options.autoClear ?? true,
    xr: { enabled: options.flags?.xr ?? true },
    shadowMap: { autoUpdate: options.flags?.shadow ?? true },
    info: { autoReset: options.flags?.autoReset ?? true },
    state: {
      buffers: { depth: { setMask: vi.fn() } },
      viewport: vi.fn(),
    },
    getRenderTarget: vi.fn(() => current),
    setRenderTarget: vi.fn((target: WebGLRenderTarget | null) => {
      current = target;
    }),
    clear: vi.fn(),
    render: vi.fn((_scene: Scene, camera: Camera) => {
      snapshots.push({
        waterVisible: isWaterVisible(),
        xrEnabled: renderer.xr.enabled,
        shadowAutoUpdate: renderer.shadowMap.autoUpdate,
        infoAutoReset: renderer.info.autoReset,
        renderTarget: current,
        cameraPosition: camera.position.clone(),
        cameraProjection: [...camera.projectionMatrix.elements],
        cameraMatrixWorld: [...camera.matrixWorld.elements],
      });
      options.onRender?.();
    }),
  };
  return { renderer, snapshots, currentTarget: () => current };
}

function createFixture(options: FixtureOptions = {}) {
  const geometry = new PlaneGeometry(10, 10);
  const water = new OceanWater(geometry, {
    waterNormals: new Texture(),
    ...options.water,
  });
  // 예제와 같이 +Z 노멀을 +Y 로 눕힌다(수면 = y 0 평면).
  water.rotation.x = -Math.PI / 2;
  water.updateMatrixWorld();

  const scene = new Scene();
  const { renderer, snapshots, currentTarget } = createRenderer(
    options,
    () => water.visible,
  );
  return {
    geometry,
    water,
    scene,
    renderer,
    gl: renderer as unknown as WebGLRenderer,
    snapshots,
    currentTarget,
  };
}

/** 수면 위에서 원점을 내려다보는 카메라. */
function cameraAbove(): PerspectiveCamera {
  const camera = new PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(0, 10, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

/** 수면 아래(등진 쪽) 카메라. */
function cameraBelow(): PerspectiveCamera {
  const camera = new PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(0, -10, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OceanWater — 머티리얼 규약', () => {
  it('깊이는 읽지도 쓰지도 않고 불투명 비트가 0 인 픽셀만 통과시킨다', () => {
    const { water } = createFixture();
    const m = water.material;
    expect(m.depthTest).toBe(false);
    expect(m.depthWrite).toBe(false);
    expect(m.stencilWrite).toBe(true);
    expect(m.stencilWriteMask).toBe(0);
    expect(m.stencilRef).toBe(0);
    expect(m.stencilFunc).toBe(EqualStencilFunc);
    expect(m.stencilFuncMask).toBe(SCENE_OPAQUE_STENCIL_BIT);
  });

  it('조명 유니폼·그림자를 쓰지 않는다(lights false, receiveShadow false)', () => {
    const { water } = createFixture();
    expect(water.material.lights).toBe(false);
    expect(water.receiveShadow).toBe(false);
    expect(water.material.uniforms).not.toHaveProperty('directionalLights');
  });

  it('셰이더에 logdepthbuf·shadowmap·lights 청크가 없고 fog·톤매핑·색공간은 남는다', () => {
    const { water } = createFixture();
    const { vertexShader, fragmentShader } = water.material;
    for (const src of [vertexShader, fragmentShader]) {
      expect(src).not.toMatch(/logdepthbuf/);
      expect(src).not.toMatch(/shadowmap/);
      expect(src).not.toMatch(/shadowmask/);
      expect(src).not.toMatch(/lights_pars_begin/);
      expect(src).not.toMatch(/getShadowMask/);
    }
    expect(vertexShader).toContain('#include <common>');
    expect(vertexShader).toContain('#include <fog_pars_vertex>');
    expect(vertexShader).toContain('#include <fog_vertex>');
    expect(fragmentShader).toContain('#include <common>');
    expect(fragmentShader).toContain('#include <packing>');
    expect(fragmentShader).toContain('#include <bsdfs>');
    expect(fragmentShader).toContain('#include <fog_pars_fragment>');
    expect(fragmentShader).toContain('#include <tonemapping_fragment>');
    expect(fragmentShader).toContain('#include <colorspace_fragment>');
    expect(fragmentShader).toContain('#include <fog_fragment>');
    // 포크 전용 — 비친 상·태양 확산항에 곱하는 배율.
    expect(fragmentShader).toMatch(/\)\s*\*\s*reflectionIntensity;/);
    expect(fragmentShader).toMatch(/0\.3\s*\*\s*sunDiffuseIntensity/);
  });

  it('side·fog 옵션은 머티리얼로 전달되고 기본은 FrontSide·fog 없음', () => {
    const plain = createFixture().water.material;
    expect(plain.side).toBe(FrontSide);
    expect(plain.fog).toBe(false);
    const custom = createFixture({ water: { side: BackSide, fog: true } }).water
      .material;
    expect(custom.side).toBe(BackSide);
    expect(custom.fog).toBe(true);
  });
});

describe('OceanWater — 유니폼', () => {
  it('옵션 기본값은 원본 Water.js 와 같다', () => {
    const normals = new Texture();
    const { water } = createFixture({ water: { waterNormals: normals } });
    const u = water.uniforms;
    expect(u.normalSampler.value).toBe(normals);
    expect(u.alpha.value).toBe(1);
    expect(u.time.value).toBe(0);
    expect(u.size.value).toBe(1);
    expect(u.distortionScale.value).toBe(20);
    expect(u.reflectionIntensity.value).toBe(1);
    expect(u.sunDiffuseIntensity.value).toBe(1);
    expect(u.sunColor.value.getHex()).toBe(0xffffff);
    expect(u.waterColor.value.getHex()).toBe(0x7f7f7f);
    expect(u.sunDirection.value.toArray()).toEqual([0.70707, 0.70707, 0]);
    expect(u.eye.value.toArray()).toEqual([0, 0, 0]);
    // 첫 미러 패스 전엔 항등 — 원본도 new Matrix4() 다.
    expect(u.textureMatrix.value.equals(new Matrix4())).toBe(true);
  });

  it('옵션 값이 유니폼에 실리고 Vector3 옵션은 그 참조를 쓴다', () => {
    const sunDirection = new Vector3(0, 1, 0);
    const eye = new Vector3(1, 2, 3);
    const { water } = createFixture({
      water: {
        sunDirection,
        eye,
        sunColor: 0x102030,
        waterColor: 0x001e0f,
        distortionScale: 3.7,
        reflectionIntensity: 0.35,
        sunDiffuseIntensity: 0.25,
        alpha: 0.5,
        time: 7,
      },
    });
    const u = water.uniforms;
    expect(u.sunDirection.value).toBe(sunDirection);
    expect(u.eye.value).toBe(eye);
    expect(u.sunColor.value.getHex()).toBe(0x102030);
    expect(u.waterColor.value.equals(new Color(0x001e0f))).toBe(true);
    expect(u.distortionScale.value).toBe(3.7);
    expect(u.reflectionIntensity.value).toBe(0.35);
    expect(u.sunDiffuseIntensity.value).toBe(0.25);
    expect(u.alpha.value).toBe(0.5);
    expect(u.time.value).toBe(7);
  });

  it('인스턴스마다 유니폼 객체가 독립이다(merge 가 래퍼·값을 깊은 복사)', () => {
    const a = createFixture().water.uniforms;
    const b = createFixture().water.uniforms;
    // 래퍼 객체 자체가 달라야 한 인스턴스의 값 변경이 다른 쪽에 새지 않는다.
    expect(a.alpha).not.toBe(b.alpha);
    expect(a.time).not.toBe(b.time);
    expect(a.waterColor.value).not.toBe(b.waterColor.value);
    a.time.value = 5;
    a.waterColor.value.setHex(0x123456);
    expect(b.time.value).toBe(0);
    expect(b.waterColor.value.getHex()).toBe(0x7f7f7f);
  });

  it('isOceanWater 타입 가드', () => {
    const { water } = createFixture();
    expect(water.isOceanWater).toBe(true);
    expect(isOceanWater(water)).toBe(true);
    expect(isOceanWater(new Object3D())).toBe(false);
    expect(isOceanWater(new Scene())).toBe(false);
  });
});

describe('OceanWater.onBeforeRender — 건너뛰는 경우', () => {
  it('직교 카메라면 미러 패스 없이 eye 만 시선 반대쪽 아주 먼 점으로 둔다', () => {
    const { water, scene, renderer, gl } = createFixture();
    // 미니맵 캡처와 같은 탑뷰: 아래를 보므로 시선 반대 = +Y.
    const camera = new OrthographicCamera();
    camera.position.set(5, 100, 7);
    camera.up.set(0, 0, -1);
    camera.lookAt(5, 0, 7);
    camera.updateMatrixWorld();
    water.onBeforeRender(gl, scene, camera);
    expect(renderer.render).not.toHaveBeenCalled();
    expect(renderer.setRenderTarget).not.toHaveBeenCalled();
    expect(renderer.getRenderTarget).not.toHaveBeenCalled();
    expect(water.visible).toBe(true);
    const eye = water.uniforms.eye.value;
    expect(eye.x).toBeCloseTo(5, 3);
    expect(eye.z).toBeCloseTo(7, 3);
    // 카메라 위치가 아니라 훨씬 위 — 픽셀마다 시선이 평행해진다.
    expect(eye.y).toBeGreaterThan(100 + 1e5);
  });

  it('수면을 등진(아래쪽) 카메라면 그리지 않는다', () => {
    const { water, scene, renderer, gl } = createFixture();
    water.onBeforeRender(gl, scene, cameraBelow());
    expect(renderer.render).not.toHaveBeenCalled();
    expect(renderer.setRenderTarget).not.toHaveBeenCalled();
    expect(water.visible).toBe(true);
  });
});

describe('OceanWater.onBeforeRender — 미러 패스', () => {
  it('물을 숨기고 xr·shadow·info.autoReset 을 끈 채 RT 에 1회 그린 뒤 전부 원복한다', () => {
    const previous = new WebGLRenderTarget(4, 4);
    const fx = createFixture({ previousTarget: previous });
    const { water, scene, renderer, gl, snapshots } = fx;
    const camera = cameraAbove();
    camera.viewport = new Vector4(0, 0, 100, 100);

    water.onBeforeRender(gl, scene, camera);

    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(renderer.render.mock.calls[0][0]).toBe(scene);
    expect(snapshots).toHaveLength(1);
    const during = snapshots[0];
    expect(during.waterVisible).toBe(false);
    expect(during.xrEnabled).toBe(false);
    expect(during.shadowAutoUpdate).toBe(false);
    expect(during.infoAutoReset).toBe(false);
    expect(during.renderTarget).not.toBe(previous);
    expect(during.renderTarget).toBeInstanceOf(WebGLRenderTarget);

    // 원복
    expect(water.visible).toBe(true);
    expect(renderer.xr.enabled).toBe(true);
    expect(renderer.shadowMap.autoUpdate).toBe(true);
    expect(renderer.info.autoReset).toBe(true);
    expect(fx.currentTarget()).toBe(previous);
    expect(renderer.state.buffers.depth.setMask).toHaveBeenCalledWith(true);
    expect(renderer.state.viewport).toHaveBeenCalledWith(camera.viewport);
    // autoClear 가 켜져 있으면 직접 clear 하지 않는다.
    expect(renderer.clear).not.toHaveBeenCalled();
  });

  it('원래 꺼져 있던 플래그는 꺼진 채로 원복된다(하드코딩 true 가 아니다)', () => {
    const { water, scene, renderer, gl, snapshots } = createFixture({
      flags: { xr: false, shadow: false, autoReset: false },
    });
    water.onBeforeRender(gl, scene, cameraAbove());
    expect(snapshots[0].xrEnabled).toBe(false);
    expect(renderer.xr.enabled).toBe(false);
    expect(renderer.shadowMap.autoUpdate).toBe(false);
    expect(renderer.info.autoReset).toBe(false);
  });

  it('호출 순서: RT 바인딩 → 깊이 마스크 → clear → render → 이전 RT 복원 → viewport', () => {
    // clear 가 RT 바인딩보다 앞이면 메인 프레임버퍼(불투명 스텐실 비트)를
    // 지우고, viewport 복원이 setRenderTarget(previous) 보다 앞이면 three 가
    // 화면 타깃 복귀 때 viewport 를 다시 덮어 서브 viewport 가 사라진다.
    const { water, scene, renderer, gl } = createFixture({ autoClear: false });
    const camera = cameraAbove();
    camera.viewport = new Vector4(0, 0, 100, 100);
    water.onBeforeRender(gl, scene, camera);

    expect(renderer.clear).toHaveBeenCalledTimes(1);
    expect(renderer.setRenderTarget).toHaveBeenCalledTimes(2);
    const order = [
      renderer.setRenderTarget.mock.invocationCallOrder[0],
      renderer.state.buffers.depth.setMask.mock.invocationCallOrder[0],
      renderer.clear.mock.invocationCallOrder[0],
      renderer.render.mock.invocationCallOrder[0],
      renderer.setRenderTarget.mock.invocationCallOrder[1],
      renderer.state.viewport.mock.invocationCallOrder[0],
    ];
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });

  it('viewport 가 없는 카메라면 state.viewport 를 부르지 않는다', () => {
    const { water, scene, renderer, gl } = createFixture();
    water.onBeforeRender(gl, scene, cameraAbove());
    expect(renderer.state.viewport).not.toHaveBeenCalled();
  });

  it('미러 카메라는 수면에 대칭인 위치이고 eye 유니폼은 카메라 위치다', () => {
    const { water, scene, gl, snapshots } = createFixture();
    const camera = cameraAbove();
    water.onBeforeRender(gl, scene, camera);
    const mirror = snapshots[0].cameraPosition;
    expect(mirror.x).toBeCloseTo(0, 6);
    expect(mirror.y).toBeCloseTo(-10, 6);
    expect(mirror.z).toBeCloseTo(10, 6);
    expect(water.uniforms.eye.value.toArray()).toEqual([0, 10, 10]);
  });

  it('미러 카메라 행렬·textureMatrix·eye 가 원본 Water.js(r183) 와 같다', () => {
    // 손으로 옮긴 oblique 클립·textureMatrix 수식이 원본에서 어긋나면
    // 여기서 잡힌다. 카메라를 비스듬히 두어 모든 성분이 0 이 아니게 한다.
    const geometry = new PlaneGeometry(10, 10);
    const normals = new Texture();
    const ours = new OceanWater(geometry, {
      waterNormals: normals,
      clipBias: 0.01,
    });
    const theirs = new Water(geometry, {
      waterNormals: normals,
      clipBias: 0.01,
    });
    for (const mesh of [ours, theirs]) {
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(3, 0, -2);
      mesh.updateMatrixWorld();
    }
    const camera = new PerspectiveCamera(55, 1.6, 1, 20000);
    camera.position.set(30, 30, 100);
    camera.lookAt(5, 2, -7);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    const scene = new Scene();
    const mine = createRenderer({}, () => ours.visible);
    const orig = createRenderer({}, () => theirs.visible);

    ours.onBeforeRender(
      mine.renderer as unknown as WebGLRenderer,
      scene,
      camera,
    );
    // 원본 시그니처는 (renderer, scene, camera, geometry, material, group) —
    // 뒤 셋은 쓰지 않는다.
    theirs.onBeforeRender(
      orig.renderer as unknown as WebGLRenderer,
      scene,
      camera,
      geometry,
      theirs.material,
      new Group(),
    );

    expect(mine.snapshots).toHaveLength(1);
    expect(orig.snapshots).toHaveLength(1);
    expect(mine.snapshots[0].cameraProjection).toEqual(
      orig.snapshots[0].cameraProjection,
    );
    expect(mine.snapshots[0].cameraMatrixWorld).toEqual(
      orig.snapshots[0].cameraMatrixWorld,
    );
    expect(ours.uniforms.textureMatrix.value.elements).toEqual(
      theirs.material.uniforms.textureMatrix.value.elements,
    );
    expect(ours.uniforms.eye.value.toArray()).toEqual(
      theirs.material.uniforms.eye.value.toArray(),
    );
    // 원본은 흰 태양·회색 물 기본값이 같다.
    expect(ours.uniforms.sunColor.value.getHex()).toBe(
      theirs.material.uniforms.sunColor.value.getHex(),
    );
    expect(ours.uniforms.waterColor.value.getHex()).toBe(
      theirs.material.uniforms.waterColor.value.getHex(),
    );
  });

  it('반사 RT 는 8bit(HDR 클램프) + 깊이/스텐실 버퍼이고 mirrorSampler 가 그 텍스처다', () => {
    const { water, scene, renderer, gl } = createFixture({
      water: { textureWidth: 64, textureHeight: 32 },
    });
    water.onBeforeRender(gl, scene, cameraAbove());
    const rt = renderer.setRenderTarget.mock.calls[0][0];
    expect(rt).toBeInstanceOf(WebGLRenderTarget);
    if (!rt) throw new Error('unreachable');
    expect(rt.texture.type).toBe(UnsignedByteType);
    expect(rt.depthBuffer).toBe(true);
    expect(rt.stencilBuffer).toBe(true);
    expect(rt.width).toBe(64);
    expect(rt.height).toBe(32);
    expect(water.uniforms.mirrorSampler.value).toBe(rt.texture);
  });

  it('RT 크기 기본값은 512', () => {
    const { water, scene, renderer, gl } = createFixture();
    water.onBeforeRender(gl, scene, cameraAbove());
    const rt = renderer.setRenderTarget.mock.calls[0][0];
    expect(rt?.width).toBe(512);
    expect(rt?.height).toBe(512);
  });
});

describe('OceanWater.onBeforeRender — 제외 객체', () => {
  it('visible 인 것만 숨기고 뒤에 복원, 원래 invisible 은 그대로 둔다', () => {
    const a = new Object3D();
    const b = new Object3D();
    b.visible = false;
    const seen: boolean[][] = [];
    const { water, scene, gl } = createFixture({
      water: { excludedObjects: () => [a, b] },
      onRender: () => seen.push([a.visible, b.visible]),
    });
    water.onBeforeRender(gl, scene, cameraAbove());
    expect(seen).toEqual([[false, false]]);
    expect(a.visible).toBe(true);
    expect(b.visible).toBe(false);
  });

  it('게터는 매 패스 호출된다 — 두 번째 패스에서 다른 객체를 주면 그 객체가 숨겨진다', () => {
    const a = new Object3D();
    const c = new Object3D();
    let list: Object3D[] = [a];
    const getter = vi.fn(() => list);
    const seen: Array<[boolean, boolean]> = [];
    const { water, scene, gl } = createFixture({
      water: { excludedObjects: getter },
      onRender: () => seen.push([a.visible, c.visible]),
    });
    water.onBeforeRender(gl, scene, cameraAbove());
    list = [c];
    water.onBeforeRender(gl, scene, cameraAbove());
    expect(getter).toHaveBeenCalledTimes(2);
    expect(seen).toEqual([
      [false, true],
      [true, false],
    ]);
    expect(a.visible).toBe(true);
    expect(c.visible).toBe(true);
  });

  it('null·undefined 항목은 건너뛴다(늦게 등록되는 지도 루트)', () => {
    const a = new Object3D();
    const seen: boolean[] = [];
    const { water, scene, renderer, gl } = createFixture({
      water: { excludedObjects: () => [undefined, a, null] },
      onRender: () => seen.push(a.visible),
    });
    expect(() => water.onBeforeRender(gl, scene, cameraAbove())).not.toThrow();
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([false]);
    expect(a.visible).toBe(true);
  });

  it('제너레이터도 받는다', () => {
    const a = new Object3D();
    const seen: boolean[] = [];
    function* excluded(): Generator<Object3D | undefined> {
      yield undefined;
      yield a;
    }
    const { water, scene, gl } = createFixture({
      water: { excludedObjects: excluded },
      onRender: () => seen.push(a.visible),
    });
    water.onBeforeRender(gl, scene, cameraAbove());
    expect(seen).toEqual([false]);
    expect(a.visible).toBe(true);
  });

  it('excludedObjects 옵션이 없어도 정상 동작한다', () => {
    const { water, scene, renderer, gl } = createFixture();
    water.onBeforeRender(gl, scene, cameraAbove());
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(water.visible).toBe(true);
  });
});

describe('OceanWater.onBeforeRender — render 가 throw 해도 원복(try/finally)', () => {
  it('물·제외 객체·플래그·RT 가 전부 원복되고 예외는 전파된다', () => {
    const previous = new WebGLRenderTarget(4, 4);
    const a = new Object3D();
    const fx = createFixture({
      previousTarget: previous,
      water: { excludedObjects: () => [a] },
      onRender: () => {
        throw new Error('boom');
      },
    });
    const { water, scene, renderer, gl } = fx;
    expect(() => water.onBeforeRender(gl, scene, cameraAbove())).toThrow(
      'boom',
    );
    expect(water.visible).toBe(true);
    expect(a.visible).toBe(true);
    expect(renderer.xr.enabled).toBe(true);
    expect(renderer.shadowMap.autoUpdate).toBe(true);
    expect(renderer.info.autoReset).toBe(true);
    expect(fx.currentTarget()).toBe(previous);

    // 다음 패스는 정상 — 스크래치가 비워져 이전 실패가 남지 않는다.
    const seen: boolean[] = [];
    renderer.render.mockImplementation(() => {
      seen.push(a.visible);
    });
    water.onBeforeRender(gl, scene, cameraAbove());
    expect(seen).toEqual([false]);
    expect(a.visible).toBe(true);
  });

  it('제외 게터가 throw 해도 물이 다시 보이고 플래그가 원복된다', () => {
    const { water, scene, renderer, gl } = createFixture({
      water: {
        excludedObjects: () => {
          throw new Error('getter');
        },
      },
    });
    expect(() => water.onBeforeRender(gl, scene, cameraAbove())).toThrow(
      'getter',
    );
    expect(renderer.render).not.toHaveBeenCalled();
    expect(water.visible).toBe(true);
    expect(renderer.xr.enabled).toBe(true);
    expect(renderer.shadowMap.autoUpdate).toBe(true);
    expect(renderer.info.autoReset).toBe(true);
  });
});

describe('OceanWater.dispose', () => {
  it('RT 와 머티리얼만 폐기하고 geometry 는 건드리지 않는다', () => {
    const rtDispose = vi.spyOn(WebGLRenderTarget.prototype, 'dispose');
    const { water, geometry } = createFixture();
    const materialDispose = vi.spyOn(water.material, 'dispose');
    const geometryDispose = vi.spyOn(geometry, 'dispose');

    water.dispose();

    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(rtDispose).toHaveBeenCalledTimes(1);
    const disposed = rtDispose.mock.contexts[0] as WebGLRenderTarget;
    expect(disposed.texture).toBe(water.uniforms.mirrorSampler.value);
  });
});
