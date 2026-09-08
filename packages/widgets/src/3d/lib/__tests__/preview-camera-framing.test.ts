import { describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Vector3,
} from 'three';
import { frameCameraToModel } from '../preview-camera-framing';

const WIDTH = 200;
const HEIGHT = 200;

function boxGroup(size: number, center: [number, number, number] = [0, 0, 0]) {
  const group = new Group();
  const mesh = new Mesh(
    new BoxGeometry(size, size, size),
    new MeshBasicMaterial(),
  );
  mesh.position.set(...center);
  group.add(mesh);
  group.updateMatrixWorld(true);
  return group;
}

function camera() {
  return new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
}

describe('frameCameraToModel', () => {
  it('빈 그룹은 아무것도 바꾸지 않는다', () => {
    const cam = camera();
    const before = { zoom: cam.zoom, position: cam.position.clone() };
    frameCameraToModel(cam, new Group(), WIDTH, HEIGHT);
    expect(cam.zoom).toBe(before.zoom);
    expect(cam.position.equals(before.position)).toBe(true);
  });

  it('모델을 원점으로 옮기고 카메라가 원점을 바라본다', () => {
    const cam = camera();
    const group = boxGroup(2, [10, -4, 7]); // 원점에서 벗어난 모델
    frameCameraToModel(cam, group, WIDTH, HEIGHT);

    // 모델 중심이 원점 근처로 이동했다 (프레이밍 미세 보정 허용).
    const worldCenter = new Vector3().addVectors(
      group.position,
      new Vector3(10, -4, 7),
    );
    expect(worldCenter.length()).toBeLessThan(1);

    // 카메라 시선은 원점을 향한다.
    const toOrigin = cam.position.clone().negate().normalize();
    const viewDir = cam.getWorldDirection(new Vector3());
    expect(viewDir.distanceTo(toOrigin)).toBeLessThan(1e-6);
    expect(cam.zoom).toBeGreaterThan(0.01);
  });

  it('모델이 클수록 zoom이 줄어든다 — 크기에 반비례', () => {
    const camSmall = camera();
    const camLarge = camera();
    frameCameraToModel(camSmall, boxGroup(2), WIDTH, HEIGHT);
    frameCameraToModel(camLarge, boxGroup(20), WIDTH, HEIGHT);

    expect(camSmall.zoom).toBeGreaterThan(camLarge.zoom);
    expect(camSmall.zoom / camLarge.zoom).toBeCloseTo(10, 3);
  });

  it('카메라 거리는 최소 3.5를 보장한다 (아주 작은 모델)', () => {
    const cam = camera();
    frameCameraToModel(cam, boxGroup(0.1), WIDTH, HEIGHT);
    expect(cam.position.length()).toBeCloseTo(3.5, 6);
  });

  it('preset.paddingScale이 클수록 여백이 늘어 zoom이 준다', () => {
    const camDefault = camera();
    const camPadded = camera();
    frameCameraToModel(camDefault, boxGroup(2), WIDTH, HEIGHT);
    frameCameraToModel(camPadded, boxGroup(2), WIDTH, HEIGHT, {
      paddingScale: 2.44,
    });
    expect(camPadded.zoom).toBeCloseTo(camDefault.zoom / 2, 3);
  });

  it('preset.cameraDirection이 카메라 방위를 정한다', () => {
    const cam = camera();
    frameCameraToModel(cam, boxGroup(2), WIDTH, HEIGHT, {
      cameraDirection: [1, 0, 0],
    });
    expect(cam.position.y).toBeCloseTo(0, 6);
    expect(cam.position.z).toBeCloseTo(0, 6);
    expect(cam.position.x).toBeGreaterThan(0);
  });

  it('far plane은 모델과 거리에 맞춰 넉넉히 잡는다', () => {
    const cam = camera();
    frameCameraToModel(cam, boxGroup(20), WIDTH, HEIGHT);
    const radius = Math.sqrt(3) * 10; // size.length() * 0.5
    expect(cam.near).toBe(0.1);
    expect(cam.far).toBeGreaterThanOrEqual(cam.position.length() + radius);
  });
});
