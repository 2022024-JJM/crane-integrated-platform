/**
 * 제너레이터로 쓴 긴 계산을 프레임 사이에 나눠 돌린다. 계산은 `yield` 로
 * 끊을 수 있는 지점을 표시하고, 여기서는 시간 예산이 찰 때까지 이어 돌린 뒤
 * 다음 슬라이스를 예약한다.
 *
 * 예산·간격은 워밍업 큐(@crane/domain/3d bvh-build-queue.ts)와 같은 값이다 —
 * 유휴 시간이 있으면 바로, 없어도 프레임급 간격 안에 다음 슬라이스가 돈다.
 */

/** 슬라이스 실행을 예약하고 취소 함수를 돌려준다. 테스트에서 주입한다. */
export type SliceScheduler = (run: () => void) => () => void;

export interface SlicedTaskOptions {
  schedule?: SliceScheduler;
  clock?: () => number;
  budgetMs?: number;
}

export interface SlicedTaskHandlers<T> {
  onDone: (result: T) => void;
  onError: (error: unknown) => void;
}

/** 한 슬라이스가 쓰는 시간. 넘겨도 최소 한 구간은 처리한다. */
export const SLICE_BUDGET_MS = 8;
/** 유휴 시간이 없어도 이 안에는 다음 슬라이스가 돈다. */
export const SLICE_INTERVAL_MS = 16;

const defaultScheduler: SliceScheduler = (run) => {
  if (typeof requestIdleCallback !== 'undefined') {
    const id = requestIdleCallback(() => run(), {
      timeout: SLICE_INTERVAL_MS,
    });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(run, SLICE_INTERVAL_MS);
  return () => clearTimeout(id);
};

const defaultClock = (): number => performance.now();

/**
 * 계산을 시작하고 취소 함수를 돌려준다. 첫 슬라이스도 예약으로 돈다 — 호출한
 * 자리(프레임 콜백)에서는 아무것도 계산하지 않는다. 취소한 뒤에는 onDone·
 * onError 가 불리지 않는다. 계산이 던지면 onError 로 넘기고 멈춘다.
 */
export function runSlicedTask<T>(
  task: Generator<void, T>,
  handlers: SlicedTaskHandlers<T>,
  {
    schedule = defaultScheduler,
    clock = defaultClock,
    budgetMs = SLICE_BUDGET_MS,
  }: SlicedTaskOptions = {},
): () => void {
  let cancelled = false;
  let cancelScheduled: (() => void) | null = null;

  const runSlice = () => {
    cancelScheduled = null;
    if (cancelled) return;
    const startedAt = clock();
    let step: IteratorResult<void, T>;
    try {
      do {
        step = task.next();
      } while (!step.done && clock() - startedAt < budgetMs);
    } catch (error) {
      cancelled = true;
      handlers.onError(error);
      return;
    }
    if (step.done) {
      cancelled = true;
      handlers.onDone(step.value);
      return;
    }
    cancelScheduled = schedule(runSlice);
  };

  cancelScheduled = schedule(runSlice);

  return () => {
    cancelled = true;
    cancelScheduled?.();
    cancelScheduled = null;
  };
}
