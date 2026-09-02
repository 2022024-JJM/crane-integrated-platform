import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReplayLiteFrame } from '@crane/domain/monitoring';
import { useReplayPlayerStore } from '../use-replay-player-store';
import { rigValueStore } from '../rig-value-store';
import { setTagIngest, tagLiveValues } from '../tag-value-bus';

/**
 * craneId의 하이픈은 태그 키에서 언더스코어로 치환된다 —
 * 'crane-1' 프레임 값이 'crane_1:X' 키로 버스에 실리는 것까지 특성화한다.
 * 버스 소비자를 가짜로 꽂아 마지막 값을 키별로 기록한다.
 */
function frame(x: number): ReplayLiteFrame {
  return {
    timestamp: '2026-01-01T00:00:00Z',
    cranes: [
      {
        craneId: 'crane-1',
        craneNo: '1',
        snapshotAt: null,
        tagSchema: null,
        values: { X: x, NOTE: 'not-a-number' },
      },
    ],
  };
}

function store() {
  return useReplayPlayerStore.getState();
}

const received = new Map<string, number>();
const xValue = () => received.get('crane_1:X') ?? 0;

beforeEach(() => {
  useReplayPlayerStore.setState({
    frames: [],
    frameDurationsMs: [],
    frameIndex: 0,
    isPlaying: false,
    speedMultiplier: 1,
  });
  received.clear();
  tagLiveValues.clear();
  rigValueStore.reset();
  setTagIngest((key, value) => received.set(key, value));
});

afterEach(() => {
  setTagIngest(null);
});

describe('loadFrames', () => {
  it('로드 즉시 정지 상태로 0번 프레임을 씬에 적용한다', () => {
    store().loadFrames([frame(10), frame(20)], [1000, 1000]);

    expect(store().frameIndex).toBe(0);
    expect(store().isPlaying).toBe(false);
    expect(xValue()).toBe(10);
  });

  it('duration 길이가 프레임 수와 다르면 전부 기본값(5000ms)으로 채운다', () => {
    store().loadFrames([frame(1), frame(2), frame(3)], [1000]);
    expect(store().frameDurationsMs).toEqual([5000, 5000, 5000]);

    store().loadFrames([frame(1), frame(2)], [700, 800]);
    expect(store().frameDurationsMs).toEqual([700, 800]);
  });

  it('숫자가 아닌 태그 값은 적용하지 않는다', () => {
    expect(() => store().loadFrames([frame(5)], [1000])).not.toThrow();
    expect(xValue()).toBe(5);
    expect(received.has('crane_1:NOTE')).toBe(false);
  });
});

describe('빈 프레임 (예외 경계)', () => {
  it('빈 배열 로드 후 어떤 조작도 throw 없이 초기 상태를 유지한다', () => {
    store().loadFrames([], []);
    expect(store().frameIndex).toBe(0);

    expect(() => {
      store().play();
      store().tick(); // nextIndex 0 >= length 0 → 정지 분기
      store().seekTo(5);
      store().seekByFrames(-3);
      store().seekByMs(10_000);
    }).not.toThrow();

    expect(store().frameIndex).toBe(0);
    expect(store().isPlaying).toBe(false);
    // 프레임이 없으니 버스에 아무 값도 실리지 않는다.
    expect(received.size).toBe(0);
  });
});

describe('play / pause / setSpeed', () => {
  it('재생 상태와 배속을 전환한다', () => {
    store().play();
    expect(store().isPlaying).toBe(true);
    store().pause();
    expect(store().isPlaying).toBe(false);
    store().setSpeed(4);
    expect(store().speedMultiplier).toBe(4);
  });
});

describe('seekTo / seekByFrames', () => {
  beforeEach(() => {
    store().loadFrames([frame(0), frame(10), frame(20)], [1000, 1000, 1000]);
  });

  it('인덱스를 [0, length-1]로 클램프하고 재생을 멈춘다', () => {
    store().play();
    store().seekTo(99);
    expect(store().frameIndex).toBe(2);
    expect(store().isPlaying).toBe(false);
    expect(xValue()).toBe(20);

    store().seekTo(-5);
    expect(store().frameIndex).toBe(0);
    expect(xValue()).toBe(0);
  });

  it('seekByFrames는 현재 인덱스 기준 상대 이동', () => {
    store().seekByFrames(2);
    expect(store().frameIndex).toBe(2);
    store().seekByFrames(-1);
    expect(store().frameIndex).toBe(1);
  });
});

describe('seekByMs', () => {
  beforeEach(() => {
    store().loadFrames(
      [frame(0), frame(1), frame(2), frame(3)],
      [1000, 2000, 3000, 4000],
    );
  });

  it('앞으로: 누적 duration 경계를 넘는 프레임까지 이동한다', () => {
    store().seekByMs(1000); // ≤ dur[0] → index 1
    expect(store().frameIndex).toBe(1);

    store().seekTo(0);
    store().seekByMs(3000); // 1000 소모 후 remaining 2000 ≤ dur[1] → index 2
    expect(store().frameIndex).toBe(2);
  });

  it('범위를 넘으면 마지막/첫 프레임에 멈춘다', () => {
    store().seekByMs(999999);
    expect(store().frameIndex).toBe(3);
    store().seekByMs(-999999);
    expect(store().frameIndex).toBe(0);
  });

  it('뒤로: 직전 프레임 duration 기준으로 되감는다', () => {
    store().seekTo(2);
    store().seekByMs(-2000); // ≤ dur[1] → index 1
    expect(store().frameIndex).toBe(1);
  });

  it('0ms는 제자리', () => {
    store().seekTo(1);
    store().seekByMs(0);
    expect(store().frameIndex).toBe(1);
  });
});

describe('tick', () => {
  it('다음 프레임으로 진행하며 값을 적용한다', () => {
    store().loadFrames([frame(0), frame(10)], [1000, 1000]);
    store().play();
    store().tick();
    expect(store().frameIndex).toBe(1);
    expect(xValue()).toBe(10);
  });

  it('마지막 프레임에서는 정지하고 인덱스를 유지한다', () => {
    store().loadFrames([frame(0), frame(10)], [1000, 1000]);
    store().seekTo(1);
    store().play();
    store().tick();
    expect(store().frameIndex).toBe(1);
    expect(store().isPlaying).toBe(false);
  });
});

describe('reset', () => {
  it('전부 초기화하고 값 저장소를 비워 노드가 rest 로 돌아가게 한다', () => {
    store().loadFrames([frame(50)], [1000]);
    expect(xValue()).toBe(50);
    rigValueStore.set('m/slot', 1);
    expect(rigValueStore.size).toBe(1);

    store().reset();
    expect(store().frames).toEqual([]);
    expect(store().frameIndex).toBe(0);
    // 값 저장소가 비면 드라이버가 다음 프레임에 rest(Δ 0)를 적용한다.
    expect(rigValueStore.size).toBe(0);
  });
});
