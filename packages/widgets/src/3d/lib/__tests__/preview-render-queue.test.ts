import { describe, expect, it, vi } from 'vitest';
import {
  createEnqueueRender,
  getRenderRequestKey,
  rejectListeners,
  resolveListeners,
  type QueueEntry,
  type RenderRequest,
} from '../preview-render-queue';

function request(overrides: Partial<RenderRequest> = {}): RenderRequest {
  return { path: '/models/crane.glb', width: 128, height: 128, ...overrides };
}

function setup() {
  const pendingByKey = new Map<string, QueueEntry>();
  const queue: QueueEntry[] = [];
  const scheduleNext = vi.fn();
  const enqueueRender = createEnqueueRender(pendingByKey, queue, scheduleNext);
  return { pendingByKey, queue, scheduleNext, enqueueRender };
}

describe('getRenderRequestKey', () => {
  it('path·크기별로 키가 갈린다', () => {
    expect(getRenderRequestKey(request())).not.toBe(
      getRenderRequestKey(request({ width: 256 })),
    );
    expect(getRenderRequestKey(request())).not.toBe(
      getRenderRequestKey(request({ path: '/other.glb' })),
    );
    expect(getRenderRequestKey(request())).toBe(getRenderRequestKey(request()));
  });

  it('preset 없음은 "default" 슬롯을 쓴다', () => {
    expect(getRenderRequestKey(request())).toContain('|default|');
  });

  // 주의(잠재 버그 — 고치지 않고 특성화만 한다): preset 객체는
  // String() 직렬화라 서로 다른 preset 두 개가 모두 "[object Object]"로
  // 같은 키가 된다. 현재 호출부는 카탈로그의 공유 preset을 path별로
  // 하나만 쓰므로 실전에서 충돌하지 않지만, path가 같고 preset만 다른
  // 요청이 생기면 서로 다른 렌더가 하나로 합쳐진다.
  it('같은 path의 서로 다른 preset은 같은 키로 합쳐진다 (현재 동작)', () => {
    expect(getRenderRequestKey(request({ preset: { paddingScale: 1 } }))).toBe(
      getRenderRequestKey(request({ preset: { paddingScale: 2 } })),
    );
  });
});

describe('enqueueRender — 신규 요청', () => {
  it('큐에 넣고 scheduleNext를 부른다', () => {
    const { enqueueRender, queue, pendingByKey, scheduleNext } = setup();
    enqueueRender(request());

    expect(queue).toHaveLength(1);
    expect(pendingByKey.get(getRenderRequestKey(request()))).toBe(queue[0]);
    expect(scheduleNext).toHaveBeenCalledTimes(1);
  });

  it('resolveListeners로 대기자가 url을 받는다', async () => {
    const { enqueueRender, queue } = setup();
    const { promise } = enqueueRender(request());

    resolveListeners(queue[0], 'blob:preview');
    await expect(promise).resolves.toBe('blob:preview');
  });

  it('rejectListeners로 대기자가 에러를 받는다 (컨텍스트 로스트 경로)', async () => {
    const { enqueueRender, queue } = setup();
    const { promise } = enqueueRender(request());

    rejectListeners(queue[0], new Error('context lost'));
    await expect(promise).rejects.toThrow('context lost');
  });
});

describe('enqueueRender — 키 중복 제거', () => {
  it('같은 키는 기존 entry에 listener만 붙는다', async () => {
    const { enqueueRender, queue, scheduleNext } = setup();
    const first = enqueueRender(request());
    const second = enqueueRender(request());

    expect(queue).toHaveLength(1);
    expect(queue[0].listeners).toHaveLength(2);
    expect(scheduleNext).toHaveBeenCalledTimes(1);

    resolveListeners(queue[0], 'blob:shared');
    await expect(first.promise).resolves.toBe('blob:shared');
    await expect(second.promise).resolves.toBe('blob:shared');
  });

  it('키가 다르면 별도 entry', () => {
    const { enqueueRender, queue } = setup();
    enqueueRender(request());
    enqueueRender(request({ width: 256 }));
    expect(queue).toHaveLength(2);
  });
});

describe('abort', () => {
  it('일부만 abort하면 entry는 살아 있고, abort한 대기자만 결과를 못 받는다', async () => {
    const { enqueueRender, queue } = setup();
    const first = enqueueRender(request());
    const second = enqueueRender(request());

    first.abort.abort();
    expect(queue[0].aborted).toBe(false);

    const firstSettled = vi.fn();
    void first.promise.then(firstSettled, firstSettled);

    resolveListeners(queue[0], 'blob:x');
    await expect(second.promise).resolves.toBe('blob:x');
    // abort된 listener는 resolve도 reject도 되지 않는다 (pending 유지).
    await Promise.resolve();
    expect(firstSettled).not.toHaveBeenCalled();
  });

  it('전원이 abort하면 entry가 aborted되고, 같은 키의 새 요청은 새 entry를 만든다', () => {
    const { enqueueRender, queue, scheduleNext } = setup();
    const first = enqueueRender(request());
    const second = enqueueRender(request());

    first.abort.abort();
    second.abort.abort();
    expect(queue[0].aborted).toBe(true);

    const third = enqueueRender(request());
    expect(queue).toHaveLength(2);
    expect(queue[1].aborted).toBe(false);
    expect(scheduleNext).toHaveBeenCalledTimes(2);
    expect(third.promise).toBeInstanceOf(Promise);
  });
});
