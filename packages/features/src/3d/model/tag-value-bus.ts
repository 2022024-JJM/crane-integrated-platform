/**
 * 태그 값 버스 — 모든 값 생산자(시나리오 러너·실시간 러너·리플레이)가 여기로
 * `publishTagValue(key, value, { source })` 를 부르고, 소비자(태그 바인딩
 * 소스)는 `setTagIngest` 로 한 번 꽂힌다.
 *
 * 생산자와 소비자가 서로를 모르게 하는 유일한 접점이다. 세 생산자가 **같은
 * 키 표기**(`크레인ID.코드`)를 쓰므로 섞임을 막는 것은 **활성 소스 게이트**
 * 다 — 화면이 `setActiveTagSource` 로 지금 소스를 정하면 다른 소스의 publish
 * 는 캐시·소비자·관찰자 어디에도 닿지 않는다. 활성 소스가 null 이면(3D 뷰가
 * 없는 화면) 전부 통과한다.
 *
 * `tagLiveValues` 는 표시용 마지막 값 캐시다. React 상태가 아니라 mutable
 * Map — 값이 초당 수십 번 오는데 setState 를 태우면 인스펙터·표가 그 속도로
 * 리렌더된다. UI 는 useRigLivePoll(15Hz) 로 폴링해 읽는다.
 *
 * 서버가 값 없음(null)을 보내면 생산자는 `publishTagNull` 을 부른다. 캐시에만
 * null 로 남고(라벨이 `NULL` 을 보인다) 소비자·관찰자에는 가지 않는다 — 모델은
 * 마지막 자세에 머물고 통계는 숫자만 센다.
 */

/** 값 생산자 종류 — 화면 모드와 짝이다(lib/tag-source.ts). */
export type TagSourceId = 'realtime' | 'replay' | 'simulation';

export interface TagPublishOptions {
  /**
   * 화면 적용 스무딩(초). 생략 = 소비자 기본(리깅 스무딩 기본값), 0 = 즉시
   * 대입. seek·리셋처럼 위치가 불연속인 값은 0 으로 내보내 자세가 미끄러지지
   * 않게 하고, 러너의 정상 전진은 publish 간격을 넣어 스텝 계단을 숨긴다.
   * 관찰자(`subscribeTagValues`)에게는 전달하지 않는다 — 값·시각만 본다.
   */
  smoothTime?: number;
  /**
   * 내보내는 생산자. 활성 소스가 정해져 있고 이것과 다르면(없는 것도 다름)
   * 버린다. 생산자는 항상 싣는다.
   */
  source?: TagSourceId;
}

export type TagPublish = (
  key: string,
  value: number,
  options?: TagPublishOptions,
) => void;

export interface TagLiveValue {
  /** 마지막 값. 서버가 값 없음을 보냈으면 null(`publishTagNull`). */
  value: number | null;
  /** performance.now() 기준이 아니라 Date.now() — 표시용이라 정밀도 불필요. */
  at: number;
  /**
   * 값이 직전과 **달라진** 마지막 시각. 같은 값이 반복 수신되면(시나리오
   * manual 패턴, 정지한 장비의 주기 스냅샷) `at` 만 갱신되고 이건 남는다 —
   * 움직임 판정의 근거(lib/model-runtime-status.ts).
   */
  changedAt: number;
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

/**
 * 태그의 마지막 값 — 아직 없으면 undefined, 서버가 값 없음을 보냈으면 null.
 * 모델 라벨의 태그 값 줄이 프레임마다 부른다 — 참조가 고정된 함수라 memo 된
 * 모델에 prop 으로 넘겨도 된다.
 */
export function readTagLiveValue(key: string): number | null | undefined {
  return liveValues.get(key)?.value;
}

/** 숫자로 계산하는 소비자용 — 값 없음(null)도 아직 없는 것과 같이 undefined. */
export function readTagLiveNumber(key: string): number | undefined {
  return liveValues.get(key)?.value ?? undefined;
}

let activeSource: TagSourceId | null = null;

/**
 * 활성 소스 — 바뀌면 live 캐시를 비운다. 이전 소스가 남긴 값(리플레이 이탈의
 * frame-0, 시뮬레이션의 마지막 자세)이 새 소스의 상태 판정에 섞이지 않게.
 * 같은 값이면 no-op. 화면은 `useActiveTagSource` 로 건다.
 */
export function setActiveTagSource(source: TagSourceId | null): void {
  if (activeSource === source) return;
  activeSource = source;
  liveValues.clear();
}

export function getActiveTagSource(): TagSourceId | null {
  return activeSource;
}

let tagIngest: TagPublish | null = null;

export type TagValueListener = (key: string, value: number, at: number) => void;

const listeners = new Set<TagValueListener>();

/**
 * 관찰자 구독 — 소비자(`setTagIngest`, 단일 슬롯)와 달리 여럿이 붙을 수 있고
 * 값을 바꾸지 못한다. 3D 플레이 통계가 publish 마다 집계하는 데 쓴다(1Hz 샘플은
 * 8배속에서 이동량을 크게 놓친다). 리스너는 ingest 뒤에 불린다.
 */
export function subscribeTagValues(listener: TagValueListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 소비자 연결. null 이면 버스에 아무도 없다(값은 live 캐시에만 남는다). */
export function setTagIngest(ingest: TagPublish | null): void {
  tagIngest = ingest;
}

export function hasTagIngest(): boolean {
  return tagIngest !== null;
}

export function publishTagValue(
  key: string,
  value: number,
  options?: TagPublishOptions,
): void {
  if (typeof key !== 'string' || key.length === 0) return;
  if (!Number.isFinite(value)) return;
  if (activeSource !== null && options?.source !== activeSource) return;
  const now = Date.now();
  const prev = liveValues.get(key);
  liveValues.set(key, {
    value,
    at: now,
    changedAt: prev && prev.value === value ? prev.changedAt : now,
  });
  tagIngest?.(key, value, options);
  for (const listener of listeners) listener(key, value, now);
}

/**
 * 서버가 이 태그를 값 없음(null)으로 보냈다 — 표시 캐시만 null 로 바꾼다.
 * 소비자(값 저장소)·관찰자에는 보내지 않아 모델은 마지막 자세에 머문다. 수신은
 * 된 것이므로 `at` 은 갱신하고, 값 없음은 움직임이 아니므로 `changedAt` 은
 * 이어받는다(처음부터 null 이면 움직인 적 없음). 소스 게이트는 숫자와 같다.
 */
export function publishTagNull(key: string, options?: TagPublishOptions): void {
  if (typeof key !== 'string' || key.length === 0) return;
  if (activeSource !== null && options?.source !== activeSource) return;
  const prev = liveValues.get(key);
  liveValues.set(key, {
    value: null,
    at: Date.now(),
    changedAt: prev ? prev.changedAt : Number.NEGATIVE_INFINITY,
  });
}
