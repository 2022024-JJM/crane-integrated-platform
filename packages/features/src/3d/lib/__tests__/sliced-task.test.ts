import { describe, expect, it, vi } from 'vitest';
import { runSlicedTask, type SliceScheduler } from '../sliced-task';

/** 예약된 슬라이스를 손으로 돌리는 스케줄러. */
function manualScheduler() {
  const queue: (() => void)[] = [];
  const cancelled: number[] = [];
  const schedule: SliceScheduler = (run) => {
    const index = queue.length;
    queue.push(run);
    return () => {
      cancelled.push(index);
    };
  };
  return {
    schedule,
    cancelled,
    get scheduled() {
      return queue.length;
    },
    /** 아직 돌리지 않았고 취소되지 않은 가장 오래된 슬라이스를 돌린다. */
    runNext(): boolean {
      for (let index = 0; index < queue.length; index += 1) {
        const run = queue[index];
        if (run === noop) continue;
        queue[index] = noop;
        if (cancelled.includes(index)) continue;
        run();
        return true;
      }
      return false;
    },
  };
}

function noop(): void {}

/** 호출될 때마다 step 만큼 흐르는 시계. */
function steppingClock(step: number): () => number {
  let now = 0;
  return () => {
    const value = now;
    now += step;
    return value;
  };
}

/** 구간 수만큼 yield 하고 값을 돌려주는 계산. 돈 구간을 기록한다. */
function* counting(steps: number, log: number[]): Generator<void, string> {
  for (let step = 0; step < steps; step += 1) {
    log.push(step);
    yield;
  }
  return 'done';
}

function handlers() {
  return { onDone: vi.fn(), onError: vi.fn() };
}

describe('runSlicedTask', () => {
  it('시작한 자리에서는 계산하지 않고 첫 슬라이스를 예약만 한다', () => {
    const scheduler = manualScheduler();
    const log: number[] = [];
    const handler = handlers();

    runSlicedTask(counting(3, log), handler, {
      schedule: scheduler.schedule,
      clock: steppingClock(0),
    });

    expect(log).toEqual([]);
    expect(scheduler.scheduled).toBe(1);
    expect(handler.onDone).not.toHaveBeenCalled();
  });

  it('예산 안에서는 한 슬라이스에 끝까지 돌고 결과를 한 번 넘긴다', () => {
    const scheduler = manualScheduler();
    const log: number[] = [];
    const handler = handlers();

    runSlicedTask(counting(5, log), handler, {
      schedule: scheduler.schedule,
      clock: steppingClock(0),
      budgetMs: 8,
    });
    scheduler.runNext();

    expect(log).toEqual([0, 1, 2, 3, 4]);
    expect(handler.onDone).toHaveBeenCalledTimes(1);
    expect(handler.onDone).toHaveBeenCalledWith('done');
    expect(scheduler.scheduled).toBe(1);
  });

  it('예산이 차면 멈추고 다음 슬라이스를 예약한다', () => {
    const scheduler = manualScheduler();
    const log: number[] = [];
    const handler = handlers();

    // 시계가 호출마다 3ms — 시작 시각 0, 구간 뒤 3·6·9. 9 에서 예산(8)을 넘는다.
    runSlicedTask(counting(10, log), handler, {
      schedule: scheduler.schedule,
      clock: steppingClock(3),
      budgetMs: 8,
    });
    scheduler.runNext();

    expect(log).toEqual([0, 1, 2]);
    expect(handler.onDone).not.toHaveBeenCalled();
    expect(scheduler.scheduled).toBe(2);

    while (scheduler.runNext());
    expect(log).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(handler.onDone).toHaveBeenCalledTimes(1);
  });

  it('경과가 예산과 정확히 같으면 멈춘다', () => {
    const scheduler = manualScheduler();
    const log: number[] = [];

    runSlicedTask(counting(10, log), handlers(), {
      schedule: scheduler.schedule,
      clock: steppingClock(4),
      budgetMs: 8,
    });
    scheduler.runNext();

    // 시작 0, 구간 뒤 4(계속)·8(멈춤).
    expect(log).toEqual([0, 1]);
  });

  it('예산이 0 이어도 슬라이스마다 최소 한 구간은 나아간다', () => {
    const scheduler = manualScheduler();
    const log: number[] = [];
    const handler = handlers();

    runSlicedTask(counting(3, log), handler, {
      schedule: scheduler.schedule,
      clock: steppingClock(1),
      budgetMs: 0,
    });
    scheduler.runNext();
    expect(log).toEqual([0]);
    scheduler.runNext();
    expect(log).toEqual([0, 1]);

    while (scheduler.runNext());
    expect(handler.onDone).toHaveBeenCalledWith('done');
  });

  it('yield 없이 바로 끝나는 계산도 예약된 슬라이스에서 끝난다', () => {
    const scheduler = manualScheduler();
    const handler = handlers();

    runSlicedTask(counting(0, []), handler, {
      schedule: scheduler.schedule,
      clock: steppingClock(0),
    });
    expect(handler.onDone).not.toHaveBeenCalled();

    scheduler.runNext();
    expect(handler.onDone).toHaveBeenCalledWith('done');
  });

  it('취소하면 예약을 풀고 그 뒤로 계산도 결과 전달도 없다', () => {
    const scheduler = manualScheduler();
    const log: number[] = [];
    const handler = handlers();

    const cancel = runSlicedTask(counting(10, log), handler, {
      schedule: scheduler.schedule,
      clock: steppingClock(3),
      budgetMs: 8,
    });
    scheduler.runNext();
    expect(log).toEqual([0, 1, 2]);

    cancel();
    expect(scheduler.cancelled).toEqual([1]);

    while (scheduler.runNext());
    expect(log).toEqual([0, 1, 2]);
    expect(handler.onDone).not.toHaveBeenCalled();
    expect(handler.onError).not.toHaveBeenCalled();
  });

  it('스케줄러가 취소를 무시하고 슬라이스를 불러도 계산하지 않는다', () => {
    const runs: (() => void)[] = [];
    const log: number[] = [];
    const handler = handlers();

    const cancel = runSlicedTask(counting(3, log), handler, {
      schedule: (run) => {
        runs.push(run);
        return () => {};
      },
      clock: steppingClock(0),
    });
    cancel();
    runs[0]();

    expect(log).toEqual([]);
    expect(handler.onDone).not.toHaveBeenCalled();
  });

  it('끝난 뒤의 취소와 두 번째 취소는 no-op 이다', () => {
    const scheduler = manualScheduler();
    const handler = handlers();

    const cancel = runSlicedTask(counting(1, []), handler, {
      schedule: scheduler.schedule,
      clock: steppingClock(0),
    });
    scheduler.runNext();
    expect(handler.onDone).toHaveBeenCalledTimes(1);

    expect(() => {
      cancel();
      cancel();
    }).not.toThrow();
    expect(scheduler.cancelled).toEqual([]);
    expect(handler.onDone).toHaveBeenCalledTimes(1);
  });

  it('계산이 던지면 onError 로 넘기고 더 예약하지 않는다', () => {
    const scheduler = manualScheduler();
    const handler = handlers();
    const failure = new Error('geometry gone');
    function* failing(): Generator<void, string> {
      yield;
      throw failure;
    }

    runSlicedTask(failing(), handler, {
      schedule: scheduler.schedule,
      clock: steppingClock(0),
    });
    expect(() => scheduler.runNext()).not.toThrow();

    expect(handler.onError).toHaveBeenCalledTimes(1);
    expect(handler.onError).toHaveBeenCalledWith(failure);
    expect(handler.onDone).not.toHaveBeenCalled();
    expect(scheduler.scheduled).toBe(1);
    expect(scheduler.runNext()).toBe(false);
  });
});
