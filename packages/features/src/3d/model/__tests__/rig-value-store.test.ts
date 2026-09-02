import { beforeEach, describe, expect, it } from 'vitest';
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
            { modelId: 'm', jointId: 'luff', scale: 0.5, offset: -10 },
            { modelId: 'n', jointId: 'luff', scale: 1, offset: 0 },
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
