import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  registerShadowRenderer,
  unregisterShadowRenderer,
} from '@crane/domain/3d';
import {
  createTagBindingSource,
  makeJointAddress,
  manualJointSource,
  rigValueStore,
} from '../rig-value-store';

beforeEach(() => {
  rigValueStore.reset();
  manualJointSource.stop();
});

describe('rigValueStore', () => {
  it('없는 주소는 0(rest) 이다', () => {
    expect(rigValueStore.get('m/j')).toBe(0);
    expect(rigValueStore.has('m/j')).toBe(false);
  });

  it('smooth 없이 set 하면 즉시 반영된다', () => {
    rigValueStore.set('m/j', 12);
    expect(rigValueStore.get('m/j')).toBe(12);
    expect(rigValueStore.getTarget('m/j')).toBe(12);
  });

  it('NaN/Infinity 는 0 으로 방어한다', () => {
    rigValueStore.set('m/j', NaN);
    expect(rigValueStore.get('m/j')).toBe(0);
    rigValueStore.set('m/j', Infinity);
    expect(rigValueStore.get('m/j')).toBe(0);
  });

  it('freeze 는 스무딩 중인 채널을 현재값에서 멈추고, 이후 set 은 다시 동작한다', () => {
    rigValueStore.set('m/j', 0);
    rigValueStore.set('m/j', 10, { smooth: true, smoothTime: 0.2 });
    for (let i = 0; i < 6; i++) rigValueStore.step(1 / 60);
    const midway = rigValueStore.get('m/j');
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(10);

    rigValueStore.freeze();
    expect(rigValueStore.getTarget('m/j')).toBe(midway);
    for (let i = 0; i < 60; i++) rigValueStore.step(1 / 60);
    expect(rigValueStore.get('m/j')).toBe(midway);

    rigValueStore.set('m/j', 20, { smooth: true, smoothTime: 0.2 });
    for (let i = 0; i < 90; i++) rigValueStore.step(1 / 60);
    expect(rigValueStore.get('m/j')).toBeCloseTo(20, 1);
  });

  it('snapshot 은 현재값(스무딩 중이면 중간값) 목록이고, restore 는 그 자세로 즉시 돌아간다', () => {
    rigValueStore.set('m/a', 5);
    rigValueStore.set('m/b', 0);
    rigValueStore.set('m/b', 10, { smooth: true, smoothTime: 0.2 });
    for (let i = 0; i < 6; i++) rigValueStore.step(1 / 60);
    const midway = rigValueStore.get('m/b');
    const snap = rigValueStore.snapshot();
    expect(snap).toEqual([
      ['m/a', 5],
      ['m/b', midway],
    ]);

    // 계속 진행해 값이 바뀐 뒤 복원 → 스냅샷 값으로, 스무딩 없이.
    for (let i = 0; i < 60; i++) rigValueStore.step(1 / 60);
    expect(rigValueStore.get('m/b')).not.toBe(midway);
    rigValueStore.set('m/c', 7); // 스냅샷 뒤에 생긴 채널
    rigValueStore.restore(snap);
    expect(rigValueStore.get('m/a')).toBe(5);
    expect(rigValueStore.get('m/b')).toBe(midway);
    expect(rigValueStore.getTarget('m/b')).toBe(midway);
    expect(rigValueStore.has('m/c')).toBe(false);
    for (let i = 0; i < 30; i++) rigValueStore.step(1 / 60);
    expect(rigValueStore.get('m/b')).toBe(midway);
  });

  it('빈 스냅샷 restore 는 reset 과 같고, 스냅샷 배열은 저장소와 분리된 복사본이다', () => {
    rigValueStore.set('m/a', 1);
    const snap = rigValueStore.snapshot();
    rigValueStore.restore([]);
    expect(rigValueStore.size).toBe(0);
    rigValueStore.restore(snap);
    expect(rigValueStore.get('m/a')).toBe(1);
    expect(rigValueStore.snapshot()).not.toBe(snap);
  });

  it('freeze 는 빈 저장소·정착한 채널에서 no-op 이다', () => {
    rigValueStore.freeze();
    expect(rigValueStore.size).toBe(0);
    rigValueStore.set('m/j', 5);
    rigValueStore.freeze();
    expect(rigValueStore.get('m/j')).toBe(5);
    expect(rigValueStore.getTarget('m/j')).toBe(5);
  });

  it('smooth set 은 목표만 바꾸고 step 으로 수렴한다', () => {
    rigValueStore.set('m/j', 0);
    rigValueStore.set('m/j', 10, { smooth: true, smoothTime: 0.2 });
    expect(rigValueStore.get('m/j')).toBe(0);
    expect(rigValueStore.getTarget('m/j')).toBe(10);
    for (let i = 0; i < 90; i++) rigValueStore.step(1 / 60);
    expect(rigValueStore.get('m/j')).toBeCloseTo(10, 1);
  });

  it('처음부터 smooth 로 들어온 채널은 0 에서 출발한다', () => {
    rigValueStore.set('m/j', 5, { smooth: true });
    expect(rigValueStore.get('m/j')).toBe(0);
    rigValueStore.step(0.016);
    expect(rigValueStore.get('m/j')).toBeGreaterThan(0);
  });

  it('smooth 채널에 즉시 set 이 오면 스무딩을 끊고 점프한다', () => {
    rigValueStore.set('m/j', 10, { smooth: true });
    rigValueStore.step(0.016);
    rigValueStore.set('m/j', -3);
    expect(rigValueStore.get('m/j')).toBe(-3);
    rigValueStore.step(0.016);
    expect(rigValueStore.get('m/j')).toBe(-3);
  });

  it('reset(modelId) 은 그 모델 접두사만 지운다', () => {
    rigValueStore.set(makeJointAddress('a', 'j'), 1);
    rigValueStore.set(makeJointAddress('ab', 'j'), 2);
    rigValueStore.set(makeJointAddress('b', 'j'), 3);
    rigValueStore.reset('a');
    expect(rigValueStore.has('a/j')).toBe(false);
    expect(rigValueStore.get('ab/j')).toBe(2);
    expect(rigValueStore.get('b/j')).toBe(3);
    rigValueStore.reset();
    expect(rigValueStore.size).toBe(0);
  });

  it('정착한 채널은 step 이 값을 바꾸지 않는다', () => {
    rigValueStore.set('m/j', 4);
    rigValueStore.step(1);
    expect(rigValueStore.get('m/j')).toBe(4);
  });
});

describe('rigValueStore 그림자 무효화(shadow-invalidation)', () => {
  const gl = { shadowMap: { needsUpdate: false } };

  beforeEach(() => {
    // 이전 테스트의 step 이 남긴 간격 제한을 푼다 — 싱글턴 상태.
    rigValueStore.reset();
    registerShadowRenderer(gl);
    gl.shadowMap.needsUpdate = false;
  });

  afterEach(() => {
    unregisterShadowRenderer(gl);
  });

  const consume = () => {
    const fired = gl.shadowMap.needsUpdate;
    gl.shadowMap.needsUpdate = false;
    return fired;
  };

  it('즉시 set 으로 값이 실제로 바뀌면 무효화한다', () => {
    rigValueStore.set('m/j', 5);
    expect(consume()).toBe(true);
  });

  it('같은 값 재설정은 무효화하지 않는다', () => {
    rigValueStore.set('m/j', 5);
    consume();
    rigValueStore.set('m/j', 5);
    expect(consume()).toBe(false);
  });

  it('신규 채널을 0 으로 만드는 것은 rest 그대로라 무효화하지 않는다', () => {
    rigValueStore.set('m/j', 0);
    expect(consume()).toBe(false);
  });

  it('smooth set 자체는 무효화하지 않고, 움직인 step 이 무효화한다', () => {
    rigValueStore.set('m/j', 10, { smooth: true, smoothTime: 0.2 });
    expect(consume()).toBe(false);
    rigValueStore.step(1 / 60);
    expect(consume()).toBe(true);
  });

  it('스무딩이 정착하면(per-step < eps) step 무효화가 멈춘다', () => {
    rigValueStore.set('m/j', 10, { smooth: true, smoothTime: 0.2 });
    // 충분히 수렴시킨다 — 0.2s 스무딩은 3초면 per-step 변화가 eps 아래다.
    for (let i = 0; i < 180; i++) rigValueStore.step(1 / 60);
    consume();
    rigValueStore.step(1 / 60);
    expect(consume()).toBe(false);
  });

  it('채널이 있는 reset 은 무효화하고, 빈 reset 은 하지 않는다', () => {
    rigValueStore.reset();
    expect(consume()).toBe(false);
    rigValueStore.set('m/j', 5);
    consume();
    rigValueStore.reset();
    expect(consume()).toBe(true);
  });

  it('reset(modelId) 은 지운 채널이 있을 때만 무효화한다', () => {
    rigValueStore.set(makeJointAddress('a', 'j'), 1);
    consume();
    rigValueStore.reset('없는모델');
    expect(consume()).toBe(false);
    rigValueStore.reset('a');
    expect(consume()).toBe(true);
  });

  it('스무딩 중 step 무효화는 50ms 에 한 번으로 제한되고, 미룬 이동은 다음 허용 프레임에 그린다', () => {
    // 시각은 명시 인자로 넣는다 — 타이머·performance.now 에 기대지 않는다.
    rigValueStore.set('m/j', 100, { smooth: true, smoothTime: 0.3 });
    rigValueStore.step(1 / 60, 1000);
    expect(consume()).toBe(true);
    // 같은 50ms 창 안의 프레임들은 임계를 넘어도 미룬다.
    rigValueStore.step(1 / 60, 1016);
    expect(consume()).toBe(false);
    rigValueStore.step(1 / 60, 1032);
    expect(consume()).toBe(false);
    // 창이 지나면 누적된 이동으로 반드시 한 번 그린다(trailing).
    rigValueStore.step(1 / 60, 1052);
    expect(consume()).toBe(true);
    // 그 다음 창도 같은 규칙.
    rigValueStore.step(1 / 60, 1060);
    expect(consume()).toBe(false);
    rigValueStore.step(1 / 60, 1110);
    expect(consume()).toBe(true);
  });

  it('즉시 set 은 간격 제한을 받지 않는다 — 점프는 바로 보인다', () => {
    rigValueStore.set('m/j', 100, { smooth: true, smoothTime: 0.3 });
    rigValueStore.step(1 / 60, 1000);
    consume();
    rigValueStore.set('m/j', 5);
    expect(consume()).toBe(true);
    rigValueStore.set('m/j', 7);
    expect(consume()).toBe(true);
  });

  it('reset 은 간격 제한을 푼다 — 씬 전환·seek 뒤 첫 움직임이 바로 그려진다', () => {
    rigValueStore.set('m/j', 100, { smooth: true, smoothTime: 0.3 });
    rigValueStore.step(1 / 60, 1000);
    consume();
    rigValueStore.reset();
    consume();
    rigValueStore.set('m/j', 100, { smooth: true, smoothTime: 0.3 });
    rigValueStore.step(1 / 60, 1010);
    expect(consume()).toBe(true);
  });

  it('freeze 는 무효화하지 않는다 — 화면 자세가 그대로다', () => {
    rigValueStore.set('m/j', 10, { smooth: true });
    rigValueStore.step(1 / 60);
    consume();
    rigValueStore.freeze();
    expect(consume()).toBe(false);
  });
});

describe('manualJointSource', () => {
  it('start 전에는 push 가 무시된다', () => {
    manualJointSource.push('m', 'j', 9);
    expect(rigValueStore.has('m/j')).toBe(false);
    expect(manualJointSource.active).toBe(false);
  });

  it('start 후 push 는 즉시(스무딩 없이) 반영되고 stop 후엔 다시 무시된다', () => {
    manualJointSource.start(rigValueStore);
    manualJointSource.push('m', 'j', 9);
    expect(rigValueStore.get('m/j')).toBe(9);
    manualJointSource.resetModel('m');
    expect(rigValueStore.has('m/j')).toBe(false);
    manualJointSource.stop();
    manualJointSource.push('m', 'j', 1);
    expect(rigValueStore.has('m/j')).toBe(false);
  });
});

describe('createTagBindingSource', () => {
  it('start 전 ingest 는 무시, start 후엔 offset + value*scale 로 smooth set', () => {
    const source = createTagBindingSource((key) =>
      key === 'C_1:luff'
        ? [
            { address: 'm/luff', scale: 0.5, offset: -10 },
            { address: 'n/luff', scale: 1, offset: 0 },
          ]
        : [],
    );
    source.ingest('C_1:luff', 20);
    expect(rigValueStore.has('m/luff')).toBe(false);

    source.start(rigValueStore);
    source.ingest('C_1:luff', 20);
    expect(rigValueStore.getTarget('m/luff')).toBe(0);
    expect(rigValueStore.getTarget('n/luff')).toBe(20);
    // smooth 이므로 현재값은 아직 0
    expect(rigValueStore.get('n/luff')).toBe(0);

    source.ingest('unknown', 1);
    expect(rigValueStore.size).toBe(2);

    source.ingest('C_1:luff', NaN);
    expect(rigValueStore.getTarget('n/luff')).toBe(20);

    source.stop();
    source.ingest('C_1:luff', 99);
    expect(rigValueStore.getTarget('n/luff')).toBe(20);
  });
});

describe('rigValueStore — demand 캔버스 프레임 요청 (scene-frame-request)', () => {
  let frames = 0;
  const requester = () => {
    frames += 1;
  };
  beforeEach(async () => {
    const { registerSceneFrameRequester } =
      await import('../scene-frame-request');
    frames = 0;
    registerSceneFrameRequester(requester);
  });
  afterEach(async () => {
    const { unregisterSceneFrameRequester } =
      await import('../scene-frame-request');
    unregisterSceneFrameRequester(requester);
  });

  it('즉시 set 은 값이 실제로 바뀔 때만 프레임을 요청한다', () => {
    rigValueStore.set('m/j', 5);
    expect(frames).toBe(1);
    rigValueStore.set('m/j', 5);
    expect(frames).toBe(1);
    // 신규 채널에 0(rest) 대입은 화면이 안 바뀐다 — 요청 없음.
    rigValueStore.set('m/k', 0);
    expect(frames).toBe(1);
  });

  it('smooth set 은 target 이 바뀌면 요청하고, 같은 target 재설정은 정착 후 요청하지 않는다', () => {
    rigValueStore.set('m/j', 10, { smooth: true, smoothTime: 0.1 });
    expect(frames).toBe(1);
    // 정착 전 같은 target 재설정 — value !== target 이라 다시 요청(스무딩 계속).
    rigValueStore.set('m/j', 10, { smooth: true, smoothTime: 0.1 });
    expect(frames).toBe(2);
    for (let i = 0; i < 600; i++) rigValueStore.step(1 / 60);
    // 정착: value === target 이면 같은 target 재설정은 no-op.
    const settled = rigValueStore.get('m/j');
    rigValueStore.set('m/j', settled, { smooth: true, smoothTime: 0.1 });
    expect(rigValueStore.hasPendingSmoothing()).toBe(false);
  });

  it('hasPendingSmoothing — 스무딩 중 true, 정착·freeze·reset 뒤 false', () => {
    expect(rigValueStore.hasPendingSmoothing()).toBe(false);
    rigValueStore.set('m/j', 10, { smooth: true, smoothTime: 0.1 });
    expect(rigValueStore.hasPendingSmoothing()).toBe(true);
    rigValueStore.freeze();
    expect(rigValueStore.hasPendingSmoothing()).toBe(false);
    rigValueStore.set('m/j', 20, { smooth: true, smoothTime: 0.1 });
    expect(rigValueStore.hasPendingSmoothing()).toBe(true);
    rigValueStore.reset();
    expect(rigValueStore.hasPendingSmoothing()).toBe(false);
  });

  it('reset 은 채널이 있을 때만, restore 는 값마다 요청한다', () => {
    rigValueStore.reset();
    expect(frames).toBe(0);
    rigValueStore.set('m/j', 3);
    rigValueStore.set('m/k', 4);
    expect(frames).toBe(2);
    rigValueStore.reset('m');
    expect(frames).toBe(3);
    rigValueStore.reset();
    expect(frames).toBe(3);
    rigValueStore.restore([
      ['m/j', 1],
      ['m/k', 2],
    ]);
    expect(frames).toBe(5);
  });
});
