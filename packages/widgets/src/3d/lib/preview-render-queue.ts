export interface RenderRequest {
  path: string;
  preset?: import('@crane/domain/3d').SceneModelPreviewPreset;
  width: number;
  height: number;
}

export interface AbortHandle {
  abort: () => void;
}

export interface QueueListener {
  resolve: (url: string) => void;
  reject: (error: Error) => void;
  aborted: boolean;
}

export interface QueueEntry {
  request: RenderRequest;
  listeners: QueueListener[];
  aborted: boolean;
}

export function resolveListeners(entry: QueueEntry, url: string): void {
  for (const listener of entry.listeners) {
    if (!listener.aborted) {
      listener.resolve(url);
    }
  }
}

export function rejectListeners(entry: QueueEntry, error: Error): void {
  for (const listener of entry.listeners) {
    if (!listener.aborted) {
      listener.reject(error);
    }
  }
}

export function createEnqueueRender(
  pendingByPath: Map<string, QueueEntry>,
  queue: QueueEntry[],
  scheduleNext: () => void,
) {
  return function enqueueRender(request: RenderRequest): {
    promise: Promise<string>;
    abort: AbortHandle;
  } {
    const existing = pendingByPath.get(request.path);
    if (existing && !existing.aborted) {
      const listener: QueueListener = {
        resolve: () => {},
        reject: () => {},
        aborted: false,
      };
      const promise = new Promise<string>((resolve, reject) => {
        listener.resolve = resolve;
        listener.reject = reject;
      });
      existing.listeners.push(listener);

      return {
        promise,
        abort: {
          abort: () => {
            listener.aborted = true;
            if (existing.listeners.every((l) => l.aborted)) {
              existing.aborted = true;
            }
          },
        },
      };
    }

    const listener: QueueListener = {
      resolve: () => {},
      reject: () => {},
      aborted: false,
    };
    const promise = new Promise<string>((resolve, reject) => {
      listener.resolve = resolve;
      listener.reject = reject;
    });

    const entry: QueueEntry = {
      request,
      listeners: [listener],
      aborted: false,
    };
    queue.push(entry);
    pendingByPath.set(request.path, entry);

    scheduleNext();

    return {
      promise,
      abort: {
        abort: () => {
          listener.aborted = true;
          if (entry.listeners.every((l) => l.aborted)) {
            entry.aborted = true;
          }
        },
      },
    };
  };
}
