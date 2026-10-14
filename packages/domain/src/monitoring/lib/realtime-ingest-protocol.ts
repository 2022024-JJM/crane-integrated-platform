import { isRealtimeCraneLiteMessage } from './realtime-monitoring';
import { toTagNumber } from './tag-number';

/**
 * 실시간 수신(ingest) 프로토콜 — Worker 와 메인 스레드가 주고받는 메시지,
 * 그리고 양쪽이 같은 코드로 쓰는 **태그 병합기(TagBatchCoalescer)**.
 *
 * 서버는 태그 하나를 WebSocket 메시지 하나로 보낸다(초당 수만 건). 메인
 * 스레드가 건마다 JSON.parse·타입 가드·키 조립을 하면 그 자체가 CPU 의
 * 절반이라, 이 일을 Worker 로 보내고 메인에는 **주기마다 한 번** 키 id 와
 * 값만 배열로 넘긴다.
 *
 * - 키 사전: 키 문자열(`${craneId}:${tagCode}`, craneId 의 `-` 는 `_`)은
 *   처음 본 때 한 번만 메인으로 보내고(`newKeys`), 그 뒤엔 정수 id 로만
 *   가리킨다. 메인은 id → 키 배열을 들고 있다.
 * - 병합: 한 주기 안에 같은 키가 여러 번 오면 마지막 값만 남는다(중간값은
 *   스무딩이 어차피 가린다).
 * - 관심 키(interest): 씬이 쓰는 키 목록을 주면 그 밖의 태그는 Worker 가
 *   버린다 — 메인 스레드가 받는 양이 수만 건에서 씬 태그 수로 준다. null
 *   이면 전부 통과(하위 호환).
 * - 태그가 아닌 메시지(알람 등)는 파싱된 봉투 그대로 즉시 넘긴다. 양이 적다.
 */

export type IngestConnectionState =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'closing'
  | 'closed'
  /** 열려 있지만 `heartbeatMs` 동안 메시지가 없다 — 곧 끊고 다시 잇는다. */
  | 'stalled';

export interface IngestEnvelope<TPayload = unknown> {
  type: string;
  payload: TPayload;
  timestamp?: string;
  requestId?: string;
}

/** Worker(또는 인라인 전송)가 메인으로 보내는 이벤트. */
export type IngestEvent =
  | { t: 'state'; state: IngestConnectionState }
  | { t: 'message'; envelope: IngestEnvelope }
  /** 태그가 아닌 봉투(알람 등)를 flush 주기마다 묶어서 — 건마다 postMessage·set 이 되지 않게. */
  | { t: 'messages'; envelopes: IngestEnvelope[] }
  | {
      t: 'batch';
      /** 이번 배치에서 처음 등장한 키들. id 는 keys 와 같은 순서. */
      newKeyIds: number[] | null;
      newKeys: string[] | null;
      ids: Int32Array;
      values: Float64Array;
      count: number;
      /** 이 주기 동안 Worker 가 받은 태그 메시지 수(관심 밖 포함). */
      received: number;
      /** 그중 관심 키가 아니어서 버린 수. */
      dropped: number;
      /** 이 주기 동안 전송 쪽(Worker)이 메시지 처리에 쓴 시간(ms). */
      busyMs: number;
    };

export interface IngestReconnectPolicy {
  enabled: boolean;
  initialIntervalMs: number;
  maxIntervalMs: number;
  backoffMultiplier: number;
  jitterRatio: number;
  maxAttempts: number;
}

/** 메인이 Worker 로 보내는 명령. */
export type IngestCommand =
  | {
      t: 'connect';
      url: string;
      protocols?: string | string[];
      reconnect: IngestReconnectPolicy;
      flushMs: number;
      /**
       * 무수신 감시(ms). 열린 소켓에 이 시간 동안 메시지가 없으면 반쯤 죽은
       * 연결(방화벽 유휴 끊김 — close 가 오지 않는다)로 보고 끊어 재연결
       * 경로를 탄다. 0 이면 끄기.
       */
      heartbeatMs: number;
    }
  | { t: 'disconnect' }
  | { t: 'interest'; keys: string[] | null };

/** 배치 전달 주기(ms). 렌더 상한 30fps(33ms)보다 짧아 한 프레임 안에 닿는다. */
export const INGEST_FLUSH_MS = 25;
/**
 * 한 주기에 메인으로 넘기는 태그 아닌 봉투의 상한 — 알람 피드가 폭주해도
 * 메모리·메인 처리량이 이 수에 묶인다. 넘치면 오래된 것부터 버린다(알람은
 * 최신 상태가 중요하다).
 */
export const INGEST_MAX_MESSAGES_PER_FLUSH = 2_000;

/** 묶음 큐에 넣되 상한을 넘기면 오래된 것을 버린다. 돌려주는 값은 버린 수. */
export function enqueueBounded<T>(queue: T[], item: T, max: number): number {
  queue.push(item);
  if (queue.length <= max) return 0;
  const over = queue.length - max;
  queue.splice(0, over);
  return over;
}

const EVENT_TYPE_DELTA = /"eventType"\s*:\s*"snapshot\.delta"/;
const CRANE_ID_FIELD = /"craneId"\s*:\s*"([^"\\]*)"/;
const TAG_CODE_FIELD = /"tagCode"\s*:\s*"([^"\\]*)"/;

/**
 * 파싱 전 거르기 — 건별 태그 메시지의 원문에서 craneId·tagCode 만 잘라 키를
 * 만들고 관심 키가 아니면 JSON.parse 를 건너뛴다(건별 2만/초면 파싱이
 * Worker 비용의 대부분). `snapshot.delta` 가 아닌 봉투(알람 등)나 두 필드가
 * 안 읽히는 원문은 그대로 파싱 경로로 보낸다 — 거르기는 "확실히 관심 밖인
 * 태그" 만 버린다. 키 형식은 병합기와 같다(craneId 의 `-` → `_`).
 */
export function isTagMessageOutsideInterest(
  raw: string,
  interestKeys: ReadonlySet<string> | null,
): boolean {
  if (!interestKeys) return false;
  if (!EVENT_TYPE_DELTA.test(raw)) return false;
  const crane = CRANE_ID_FIELD.exec(raw);
  const tag = TAG_CODE_FIELD.exec(raw);
  if (!crane || !tag) return false;
  return !interestKeys.has(`${crane[1]!.replace(/-/g, '_')}:${tag[1]!}`);
}
/**
 * 무수신 감시 기본값(ms). 실서버는 1초마다 스냅샷을 보내므로 15초 침묵은
 * 연결이 죽은 것이다. 감시 자체는 1/5 주기로 돈다.
 */
export const INGEST_HEARTBEAT_MS = 15_000;

/** 감시 주기 — heartbeat 의 몇 분의 일로 볼지. */
export function heartbeatCheckIntervalMs(heartbeatMs: number): number {
  return Math.max(1_000, Math.floor(heartbeatMs / 5));
}

/** 지금 끊어야 하는지 — 마지막 수신이 heartbeat 보다 오래됐는가. */
export function isStalled(
  lastMessageAt: number,
  now: number,
  heartbeatMs: number,
): boolean {
  if (!(heartbeatMs > 0) || !Number.isFinite(lastMessageAt)) return false;
  return now - lastMessageAt >= heartbeatMs;
}

export interface CoalescerFlush {
  newKeyIds: number[] | null;
  newKeys: string[] | null;
  ids: Int32Array;
  values: Float64Array;
  count: number;
  received: number;
  dropped: number;
}

/**
 * 전송 쪽 처리 시간 집계 — onmessage 안에서 파싱·병합에 쓴 ms 를 더해 두고
 * flush 때 넘긴다. 메인 스레드가 비었어도 Worker 가 포화하면 지연이 쌓이므로
 * "어디까지 버티나" 는 이 값으로 본다.
 */
export class IngestBusyMeter {
  private busyMs = 0;
  private readonly now: () => number;

  constructor(now: () => number = () => performance.now()) {
    this.now = now;
  }

  /** 처리 구간의 시작 시각(호출자가 end 에 되돌려 준다). */
  begin(): number {
    return this.now();
  }

  end(started: number): void {
    this.busyMs += this.now() - started;
  }

  /** 누적을 돌려주고 0 으로. */
  take(): number {
    const v = this.busyMs;
    this.busyMs = 0;
    return v;
  }
}

/**
 * 태그가 아닌 봉투를 메인으로 넘길지 — payload 가 객체일 때만. 문자열·숫자·
 * null 봉투(깨진 JSON, 핑 텍스트)는 소비자가 쓸 수 없는데 건마다 postMessage
 * 가 되면 잘못된 피드 하나가 메인 스레드를 채운다.
 */
export function shouldForwardEnvelope(envelope: IngestEnvelope): boolean {
  return typeof envelope.payload === 'object' && envelope.payload !== null;
}

/**
 * 서버 배치 형식(`snapshot.batch`)의 항목 — 봉투의 timestamp 를 공유하므로
 * 항목엔 craneId·tagCode·value 만 있다(sim-backend Json.batchItem 과 같은 모양).
 */
export interface TagBatchItem {
  craneId: string;
  tagCode: string;
  value: unknown;
}

export function isTagBatchItem(value: unknown): value is TagBatchItem {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.craneId === 'string' &&
    typeof c.tagCode === 'string' &&
    'value' in c
  );
}

/** `snapshot.batch` 봉투 payload — 항목 배열을 든다. */
export function isTagBatchPayload(
  value: unknown,
): value is { eventType: 'snapshot.batch'; items: unknown[] } {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return c.eventType === 'snapshot.batch' && Array.isArray(c.items);
}

/** 원시 텍스트를 봉투로. JSON 이 아니거나 봉투 모양이 아니면 `unknown` 봉투. */
export function parseIngestEnvelope(data: unknown): IngestEnvelope {
  let parsed: unknown = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      parsed = data;
    }
  }
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'type' in parsed &&
    typeof (parsed as { type: unknown }).type === 'string' &&
    'payload' in parsed
  ) {
    return parsed as IngestEnvelope;
  }
  return { type: 'unknown', payload: parsed };
}

/**
 * 태그 메시지 병합기. 입력은 봉투의 payload(파싱 완료), 출력은 flush 마다
 * 키 id·값 배열 하나. 메인 스레드와 Worker 어느 쪽에서도 돈다(순수 로직).
 */
export class TagBatchCoalescer {
  private readonly idByKey = new Map<string, number>();
  /** id → 키(사전). idByKey 의 역방향. */
  private readonly keys: string[] = [];
  /** craneId → tagCode → 완성 키. 메시지마다 문자열을 새로 만들지 않게. */
  private readonly keyCache = new Map<string, Map<string, string>>();
  private pendingKeyIds: number[] = [];
  private pendingKeys: string[] = [];
  private readonly latest = new Map<number, number>();
  private interest: Set<string> | null = null;
  private received = 0;
  private dropped = 0;

  /** 관심 키 목록. null 이면 전부 통과. 바꾸면 보류 중인 값 중 관심 밖은 버린다. */
  setInterest(keys: readonly string[] | null): void {
    this.interest = keys ? new Set(keys) : null;
    if (!this.interest) return;
    for (const id of [...this.latest.keys()]) {
      const key = this.keyOf(id);
      if (key !== undefined && !this.interest.has(key)) this.latest.delete(id);
    }
  }

  /**
   * 원문 단계의 거르기 — 관심 밖 크레인의 건별 태그면 파싱 없이 버리고
   * true(received·dropped 에 센다). 호출자는 true 면 JSON.parse 를 건너뛴다.
   */
  dropRawIfOutsideInterest(raw: string): boolean {
    if (!isTagMessageOutsideInterest(raw, this.interest)) return false;
    this.received += 1;
    this.dropped += 1;
    return true;
  }

  /**
   * payload 하나를 먹인다. 태그 메시지(snapshot.delta), 서버 배치
   * (`snapshot.batch` 의 items), 태그 메시지 배열이면 병합하고 true, 아니면
   * false(호출자가 봉투를 그대로 넘긴다). 숫자로 못 바꾸는 값은 태그여도
   * 버리되 true — 메인으로 넘길 이유가 없다. 배치는 한 메시지에 수만 건이라
   * 메인으로 통째로 넘기면 구조적 복제만으로 수 ms 가 든다 — 여기서 푼다.
   */
  ingest(payload: unknown): boolean {
    if (isRealtimeCraneLiteMessage(payload)) {
      this.ingestOne(payload.craneId, payload.tagCode, payload.value);
      return true;
    }
    if (isTagBatchPayload(payload)) {
      for (const item of payload.items) {
        if (isTagBatchItem(item)) {
          this.ingestOne(item.craneId, item.tagCode, item.value);
        }
      }
      return true;
    }
    if (Array.isArray(payload)) {
      let any = false;
      for (const item of payload) {
        if (isRealtimeCraneLiteMessage(item) || isTagBatchItem(item)) {
          this.ingestOne(item.craneId, item.tagCode, item.value);
          any = true;
        }
      }
      return any;
    }
    return false;
  }

  private ingestOne(craneId: string, tagCode: string, raw: unknown): void {
    this.received += 1;
    const key = this.keyFor(craneId, tagCode);
    if (this.interest && !this.interest.has(key)) {
      this.dropped += 1;
      return;
    }
    const value = toTagNumber(raw);
    if (value === null) return;
    this.latest.set(this.idFor(key), value);
  }

  /** 보류 중인 값이 있거나 이 주기에 받은 메시지가 있으면 배치, 아니면 null. */
  flush(): CoalescerFlush | null {
    if (this.latest.size === 0 && this.received === 0) return null;
    const count = this.latest.size;
    const ids = new Int32Array(count);
    const values = new Float64Array(count);
    let i = 0;
    for (const [id, value] of this.latest) {
      ids[i] = id;
      values[i] = value;
      i += 1;
    }
    this.latest.clear();
    const out: CoalescerFlush = {
      newKeyIds: this.pendingKeyIds.length > 0 ? this.pendingKeyIds : null,
      newKeys: this.pendingKeys.length > 0 ? this.pendingKeys : null,
      ids,
      values,
      count,
      received: this.received,
      dropped: this.dropped,
    };
    if (out.newKeyIds) {
      this.pendingKeyIds = [];
      this.pendingKeys = [];
    }
    this.received = 0;
    this.dropped = 0;
    return out;
  }

  /** 등록된 키 수(사전 크기). 관심 밖 키는 사전에 들어가지 않는다. */
  get size(): number {
    return this.idByKey.size;
  }

  private keyFor(craneId: string, tagCode: string): string {
    let byTag = this.keyCache.get(craneId);
    if (!byTag) {
      byTag = new Map();
      this.keyCache.set(craneId, byTag);
    }
    let key = byTag.get(tagCode);
    if (key === undefined) {
      key = `${craneId.replace(/-/g, '_')}:${tagCode}`;
      byTag.set(tagCode, key);
    }
    return key;
  }

  private idFor(key: string): number {
    let id = this.idByKey.get(key);
    if (id === undefined) {
      id = this.keys.length;
      this.idByKey.set(key, id);
      this.keys.push(key);
      this.pendingKeyIds.push(id);
      this.pendingKeys.push(key);
    }
    return id;
  }

  private keyOf(id: number): string | undefined {
    return this.keys[id];
  }
}
