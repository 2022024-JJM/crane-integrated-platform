/**
 * 태그 값 버스 — 모든 값 생산자(가상 태그·WebSocket·리플레이)가 여기로
 * `publishTagValue(key, value)` 를 부르고, 소비자(태그 바인딩 소스)는
 * `setTagIngest` 로 한 번 꽂힌다.
 *
 * 생산자와 소비자가 서로를 모르게 하는 유일한 접점이다. 실서버가 붙는 날
 * 바뀌는 것은 생산자 하나(WebSocket 브리지를 켜는 스위치)뿐이다.
 *
 * `tagLiveValues` 는 표시용 마지막 값 캐시다. React 상태가 아니라 mutable
 * Map — 값이 초당 수십 번 오는데 setState 를 태우면 인스펙터·표가 그 속도로
 * 리렌더된다. UI 는 useRigLivePoll(15Hz) 로 폴링해 읽는다.
 */

export type TagPublish = (key: string, value: number) => void;

/** 값 생산자. start 에 받은 publish 로 값을 내보내고 stop 에서 멈춘다. */
export interface TagValueSource {
  readonly id: string;
  start(publish: TagPublish): void;
  stop(): void;
}

export interface TagLiveValue {
  value: number;
  /** performance.now() 기준이 아니라 Date.now() — 표시용이라 정밀도 불필요. */
  at: number;
}

const liveValues = new Map<string, TagLiveValue>();

export const tagLiveValues = {
  get(key: string): TagLiveValue | undefined {
    return liveValues.get(key);
  },
  has(key: string): boolean {
    return liveValues.has(key);
  },
  keys(): IterableIterator<string> {
    return liveValues.keys();
  },
  clear(): void {
    liveValues.clear();
  },
  get size(): number {
    return liveValues.size;
  },
};

let tagIngest: TagPublish | null = null;

/** 소비자 연결. null 이면 버스에 아무도 없다(값은 live 캐시에만 남는다). */
export function setTagIngest(ingest: TagPublish | null): void {
  tagIngest = ingest;
}

export function hasTagIngest(): boolean {
  return tagIngest !== null;
}

export function publishTagValue(key: string, value: number): void {
  if (typeof key !== 'string' || key.length === 0) return;
  if (!Number.isFinite(value)) return;
  liveValues.set(key, { value, at: Date.now() });
  tagIngest?.(key, value);
}
