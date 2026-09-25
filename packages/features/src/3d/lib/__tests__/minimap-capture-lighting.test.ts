import {
  AmbientLight,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  Object3D,
  PlaneGeometry,
  PointLight,
  Scene,
  Texture,
  Vector3,
} from 'three';
import { describe, expect, it } from 'vitest';
import { SCENE_KEY_LIGHT_NAME } from '../../model/scene-lighting-info';
import {
  CANONICAL_KEY_LIGHT_DISTANCE,
  applyCanonicalCaptureLighting,
  applyCanonicalWaterUniforms,
} from '../minimap-capture-lighting';
import { OceanWater } from '../ocean-water';
import {
  SCENE_ENVIRONMENT_INTENSITY,
  SCENE_LIGHTING_BASE,
} from '../sky-lighting';

/** 씬 → 태양 단위 벡터(임의의 비축 방향). */
function canonicalSun(): Vector3 {
  return new Vector3(0.3, 0.9, -0.3).normalize();
}

function makeRenderer(autoUpdate = true, needsUpdate = true) {
  return { shadowMap: { autoUpdate, needsUpdate } };
}

function buildScene() {
  const scene = new Scene();
  const ambient = new AmbientLight(0x334455, 0.4);
  // 키 조명 — SceneLighting 이 붙이는 이름. target 은 오프셋 그룹 안에 두어
  // 로컬이 아니라 **월드** 위치가 쓰이는지 본다.
  const key = new DirectionalLight(0xffeedd, 1.2);
  key.name = SCENE_KEY_LIGHT_NAME;
  key.position.set(5, 50, 10);
  key.castShadow = true;
  key.shadow.intensity = 0.8;
  const targetGroup = new Group();
  targetGroup.position.set(100, 0, 50);
  const target = new Object3D();
  target.position.set(10, 0, 20);
  targetGroup.add(target);
  key.target = target;
  const fill = new DirectionalLight(0xffffff, 1.2);
  const hemisphere = new HemisphereLight(0x223366, 0x664422, 0.5);
  hemisphere.visible = false;
  const point = new PointLight(0xffffff, 2);
  point.shadow.intensity = 0.6;
  const group = new Group();
  group.add(point);
  const mesh = new Mesh();
  scene.add(ambient, key, targetGroup, fill, hemisphere, group, mesh);
  scene.environment = new Texture();
  scene.environmentIntensity = 0.05;
  return { scene, ambient, key, target, fill, hemisphere, point, mesh };
}

describe('applyCanonicalCaptureLighting', () => {
  it('키 조명을 이름으로 찾아 기준 세기·백색·그림자 0 으로 두고 target 월드 위치에서 태양 방향으로 옮긴다', () => {
    const { scene, key } = buildScene();
    const sun = canonicalSun();
    applyCanonicalCaptureLighting(scene, makeRenderer(), sun);
    expect(key.intensity).toBe(SCENE_LIGHTING_BASE.sunIntensity);
    expect(key.color.getHex()).toBe(0xffffff);
    expect(key.shadow.intensity).toBe(0);
    // target 월드 = (100,0,50) + (10,0,20) = (110,0,70)
    const expected = new Vector3(110, 0, 70).addScaledVector(
      sun,
      CANONICAL_KEY_LIGHT_DISTANCE,
    );
    expect(key.position.x).toBeCloseTo(expected.x, 6);
    expect(key.position.y).toBeCloseTo(expected.y, 6);
    expect(key.position.z).toBeCloseTo(expected.z, 6);
    // 방향(position − target)이 태양 방향과 일치한다.
    const dir = key.position
      .clone()
      .sub(new Vector3(110, 0, 70))
      .normalize();
    expect(dir.dot(sun)).toBeCloseTo(1, 6);
  });

  it('입력 태양 방향은 읽기만 한다', () => {
    const { scene } = buildScene();
    const sun = canonicalSun();
    const before = sun.clone();
    applyCanonicalCaptureLighting(scene, makeRenderer(), sun)();
    expect(sun.equals(before)).toBe(true);
  });

  it('환경광은 기준 세기·백색, 나머지 조명은 세기 0·그림자 0', () => {
    const { scene, ambient, fill, hemisphere, point } = buildScene();
    applyCanonicalCaptureLighting(scene, makeRenderer(), canonicalSun());
    expect(ambient.intensity).toBe(SCENE_LIGHTING_BASE.ambientIntensity);
    expect(ambient.color.getHex()).toBe(0xffffff);
    expect(fill.intensity).toBe(0);
    expect(hemisphere.intensity).toBe(0);
    expect(point.intensity).toBe(0);
    expect(point.shadow.intensity).toBe(0);
  });

  it('환경맵이 있으면 기준 세기, 없으면 0', () => {
    const { scene } = buildScene();
    applyCanonicalCaptureLighting(scene, makeRenderer(), canonicalSun());
    expect(scene.environmentIntensity).toBe(SCENE_ENVIRONMENT_INTENSITY);

    const bare = new Scene();
    bare.environmentIntensity = 0.5;
    const restore = applyCanonicalCaptureLighting(
      bare,
      makeRenderer(),
      canonicalSun(),
    );
    expect(bare.environmentIntensity).toBe(0);
    restore();
    expect(bare.environmentIntensity).toBe(0.5);
  });

  it('renderer 의 shadowMap autoUpdate·needsUpdate 를 캡처 동안 끄고 원래 값으로 되돌린다', () => {
    const { scene } = buildScene();
    for (const [autoUpdate, needsUpdate] of [
      [true, true],
      [false, true],
      [true, false],
      [false, false],
    ] as const) {
      const renderer = makeRenderer(autoUpdate, needsUpdate);
      const restore = applyCanonicalCaptureLighting(
        scene,
        renderer,
        canonicalSun(),
      );
      expect(renderer.shadowMap.autoUpdate).toBe(false);
      expect(renderer.shadowMap.needsUpdate).toBe(false);
      restore();
      expect(renderer.shadowMap.autoUpdate).toBe(autoUpdate);
      expect(renderer.shadowMap.needsUpdate).toBe(needsUpdate);
    }
  });

  it('visible·castShadow 는 건드리지 않는다(재컴파일 방지)', () => {
    const { scene, key, hemisphere } = buildScene();
    applyCanonicalCaptureLighting(scene, makeRenderer(), canonicalSun());
    expect(key.castShadow).toBe(true);
    expect(hemisphere.visible).toBe(false);
    expect(key.visible).toBe(true);
  });

  it('원복하면 세기·색·위치·그림자 세기·환경맵 세기가 정확히 되돌아온다', () => {
    const { scene, ambient, key, fill, hemisphere, point } = buildScene();
    const restore = applyCanonicalCaptureLighting(
      scene,
      makeRenderer(),
      canonicalSun(),
    );
    restore();
    expect(ambient.intensity).toBe(0.4);
    expect(ambient.color.getHex()).toBe(0x334455);
    expect(key.intensity).toBe(1.2);
    expect(key.color.getHex()).toBe(0xffeedd);
    expect(key.position.toArray()).toEqual([5, 50, 10]);
    expect(key.shadow.intensity).toBe(0.8);
    expect(fill.intensity).toBe(1.2);
    expect(hemisphere.intensity).toBe(0.5);
    expect(point.intensity).toBe(2);
    expect(point.shadow.intensity).toBe(0.6);
    expect(scene.environmentIntensity).toBe(0.05);
  });

  it('색·위치 객체의 참조는 apply·restore 를 거쳐도 유지된다(제자리 변경)', () => {
    // SceneLighting 의 setColorIfChanged 와 SceneWater 는 같은 Color/Vector3
    // 를 계속 들고 쓴다 — 객체를 갈아끼우면 그 쪽 쓰기가 허공에 간다.
    const { scene, ambient, key } = buildScene();
    const keyColor = key.color;
    const keyPosition = key.position;
    const ambientColor = ambient.color;
    const restore = applyCanonicalCaptureLighting(
      scene,
      makeRenderer(),
      canonicalSun(),
    );
    expect(key.color).toBe(keyColor);
    expect(key.position).toBe(keyPosition);
    expect(ambient.color).toBe(ambientColor);
    restore();
    expect(key.color).toBe(keyColor);
    expect(key.position).toBe(keyPosition);
    expect(ambient.color).toBe(ambientColor);
  });

  it('원복은 두 번 불러도 한 번만 적용된다 — 사이에 바뀐 값을 덮지 않는다', () => {
    const { scene, key } = buildScene();
    const renderer = makeRenderer();
    const restore = applyCanonicalCaptureLighting(
      scene,
      renderer,
      canonicalSun(),
    );
    restore();
    key.intensity = 7;
    key.position.set(1, 2, 3);
    renderer.shadowMap.needsUpdate = false;
    restore();
    expect(key.intensity).toBe(7);
    expect(key.position.toArray()).toEqual([1, 2, 3]);
    expect(renderer.shadowMap.needsUpdate).toBe(false);
  });

  it('키 조명이 없는 씬도 예외 없이 환경광·나머지 조명을 적용한다', () => {
    const scene = new Scene();
    const ambient = new AmbientLight(0x112233, 0.2);
    const unnamed = new DirectionalLight(0xffffff, 3);
    scene.add(ambient, unnamed);
    let restore: (() => void) | null = null;
    expect(() => {
      restore = applyCanonicalCaptureLighting(
        scene,
        makeRenderer(),
        canonicalSun(),
      );
    }).not.toThrow();
    expect(ambient.intensity).toBe(SCENE_LIGHTING_BASE.ambientIntensity);
    expect(unnamed.intensity).toBe(0);
    restore!();
    expect(ambient.intensity).toBe(0.2);
    expect(unnamed.intensity).toBe(3);
  });

  it('이름만 같고 방향광이 아니면 키로 보지 않는다', () => {
    const scene = new Scene();
    const impostor = new PointLight(0xffffff, 2);
    impostor.name = SCENE_KEY_LIGHT_NAME;
    scene.add(impostor);
    applyCanonicalCaptureLighting(scene, makeRenderer(), canonicalSun());
    expect(impostor.intensity).toBe(0);
  });

  it('조명이 아닌 객체는 건드리지 않고, 조명이 없는 씬도 안전하다', () => {
    const { scene, mesh } = buildScene();
    const before = { ...mesh };
    applyCanonicalCaptureLighting(scene, makeRenderer(), canonicalSun())();
    expect(mesh.visible).toBe(before.visible);

    const empty = new Scene();
    expect(() =>
      applyCanonicalCaptureLighting(empty, makeRenderer(), canonicalSun())(),
    ).not.toThrow();
  });

  it('apply 뒤 추가된 조명은 원복 대상이 아니다(예외 없음)', () => {
    const { scene } = buildScene();
    const restore = applyCanonicalCaptureLighting(
      scene,
      makeRenderer(),
      canonicalSun(),
    );
    const late = new DirectionalLight(0xffffff, 5);
    scene.add(late);
    expect(() => restore()).not.toThrow();
    expect(late.intensity).toBe(5);
  });
});

describe('applyCanonicalWaterUniforms', () => {
  function buildWater() {
    const sunDirection = new Vector3(0.7, 0.7, 0);
    const water = new OceanWater(new PlaneGeometry(1, 1), {
      waterNormals: new Texture(),
      sunDirection,
      sunColor: 0xffcc88,
      reflectionIntensity: 0.3,
      sunDiffuseIntensity: 0.25,
      waterColor: 0x123f5e,
    });
    return { water, sunDirection };
  }

  it('반사 0·기준 태양 방향(복사)·백색 태양색으로 두고 나머지 유니폼은 건드리지 않는다', () => {
    const { water, sunDirection } = buildWater();
    const sun = canonicalSun();
    applyCanonicalWaterUniforms(water, sun);
    expect(water.uniforms.reflectionIntensity.value).toBe(0);
    expect(water.uniforms.sunDirection.value.equals(sun)).toBe(true);
    // 참조는 유지(SceneWater 가 같은 Vector3 를 들고 있다), 값은 복사.
    expect(water.uniforms.sunDirection.value).toBe(sunDirection);
    sun.set(0, 0, 1);
    expect(water.uniforms.sunDirection.value.z).not.toBe(1);
    expect(water.uniforms.sunColor.value.getHex()).toBe(0xffffff);
    expect(water.uniforms.sunDiffuseIntensity.value).toBe(0.25);
    expect(water.uniforms.waterColor.value.getHex()).toBe(0x123f5e);
  });

  it('원복하면 반사·태양 방향·태양색이 정확히 되돌아오고 유니폼 객체 참조는 유지된다', () => {
    const { water } = buildWater();
    const sunColor = water.uniforms.sunColor.value;
    const restore = applyCanonicalWaterUniforms(water, canonicalSun());
    expect(water.uniforms.sunColor.value).toBe(sunColor);
    restore();
    expect(water.uniforms.sunColor.value).toBe(sunColor);
    expect(water.uniforms.reflectionIntensity.value).toBe(0.3);
    expect(water.uniforms.sunDirection.value.toArray()).toEqual([0.7, 0.7, 0]);
    expect(water.uniforms.sunColor.value.getHex()).toBe(0xffcc88);
  });

  it('원복은 두 번 불러도 한 번만 적용된다', () => {
    const { water } = buildWater();
    const restore = applyCanonicalWaterUniforms(water, canonicalSun());
    restore();
    water.uniforms.reflectionIntensity.value = 0.9;
    water.uniforms.sunDirection.value.set(0, 1, 0);
    restore();
    expect(water.uniforms.reflectionIntensity.value).toBe(0.9);
    expect(water.uniforms.sunDirection.value.toArray()).toEqual([0, 1, 0]);
  });
});
