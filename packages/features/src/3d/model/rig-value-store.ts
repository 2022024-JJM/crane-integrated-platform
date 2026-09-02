import { smoothDampStep, type SmoothDampState } from '../lib/smooth-damp';

/**
 * 관절 값의 단일 저장소 + 값 소스 추상화.
 *
 * React 상태가 아니라 **mutable Map** 이다. 드라이버가 60fps 로 읽고 소스가
 * 임의 시점에 쓰므로 setState 를 태우면 슬라이더 하나에 캔버스 전체가
 * 리렌더된다. UI 는 useRigLivePoll 로 낮은 주기(15Hz)로 폴링해 읽는다.
 *
 * 소스는 전부 `JointValueSource` 하나로 통한다:
 *  - manualJointSource: 에디터 슬라이더. 스무딩 없이 즉시 반영.
 *  - createTagBindingSource: 서버·리플레이 값(`applyValue` 버스)을 바인딩으로
 *    관절 주소에 매핑. 이번 단계는 정의만 있고 켜지 않는다 — 서버 연동 단계에서
 *    이 소스를 start 하면 끝이다.
 */

/** `${modelId}/${jointId}` */
export type JointAddress = string;

export function makeJointAddress(
  modelId: string,
  jointId: string,
): JointAddress {
  return `${modelId}/${jointId}`;
}

export interface SetJointValueOptions {
  /** true 면 SmoothDamp 로 추종. 기본 false(즉시). */
  smooth?: boolean;
  /** 초. 기본 0.35 */
  smoothTime?: number;
}

export interface RigValueSink {
  set(
    address: JointAddress,
    value: number,
    options?: SetJointValueOptions,
  ): void;
  /** modelId 를 주면 그 모델의 관절만, 없으면 전부 지운다. */
  reset(modelId?: string): void;
}

export interface JointValueSource {
  readonly id: string;
  start(sink: RigValueSink): void;
  stop(): void;
}

interface Channel extends SmoothDampState {
  target: number;
  smoothTime: number;
}

const DEFAULT_SMOOTH_TIME = 0.35;

class RigValueStoreImpl implements RigValueSink {
  private readonly channels = new Map<JointAddress, Channel>();

  set(
    address: JointAddress,
    value: number,
    options?: SetJointValueOptions,
  ): void {
    const v = Number.isFinite(value) ? value : 0;
    const smooth = options?.smooth === true;
    let ch = this.channels.get(address);
    if (!ch) {
      ch = { value: smooth ? 0 : v, velocity: 0, target: v, smoothTime: 0 };
      this.channels.set(address, ch);
    }
    ch.target = v;
    ch.smoothTime = smooth ? (options?.smoothTime ?? DEFAULT_SMOOTH_TIME) : 0;
    if (!smooth) {
      ch.value = v;
      ch.velocity = 0;
    }
  }

  /** 현재(스무딩 적용) 값. 없으면 0 = rest. */
  get(address: JointAddress): number {
    return this.channels.get(address)?.value ?? 0;
  }

  getTarget(address: JointAddress): number {
    return this.channels.get(address)?.target ?? 0;
  }

  has(address: JointAddress): boolean {
    return this.channels.has(address);
  }

  reset(modelId?: string): void {
    if (modelId === undefined) {
      this.channels.clear();
      return;
    }
    const prefix = `${modelId}/`;
    for (const key of this.channels.keys()) {
      if (key.startsWith(prefix)) this.channels.delete(key);
    }
  }

  /** 프레임마다 한 번. 스무딩 채널만 갱신하고, 정착한 채널은 비용 0. */
  step(dt: number): void {
    for (const ch of this.channels.values()) {
      if (ch.smoothTime <= 0 || ch.value === ch.target) continue;
      smoothDampStep(ch, ch.target, ch.smoothTime, dt);
    }
  }

  get size(): number {
    return this.channels.size;
  }
}

export const rigValueStore = new RigValueStoreImpl();

/**
 * 수동 조작 소스. 에디터 슬라이더가 push 한다. 스무딩 없음 — 슬라이더는
 * 손이 곧 값이라 지연이 있으면 "안 먹는다"고 느낀다.
 */
class ManualJointSource implements JointValueSource {
  readonly id = 'manual';
  private sink: RigValueSink | null = null;

  start(sink: RigValueSink): void {
    this.sink = sink;
  }

  stop(): void {
    this.sink = null;
  }

  get active(): boolean {
    return this.sink !== null;
  }

  push(modelId: string, jointId: string, value: number): void {
    this.sink?.set(makeJointAddress(modelId, jointId), value, {
      smooth: false,
    });
  }

  resetModel(modelId: string): void {
    this.sink?.reset(modelId);
  }
}

export const manualJointSource = new ManualJointSource();

export interface TagBindingTarget {
  /** 값 저장소 주소 — 관절(`${modelId}/${jointId}`) 또는 node 맵핑(`${modelId}/${mappingId}`). */
  address: JointAddress;
  scale: number;
  offset: number;
}

export interface TagBindingSource extends JointValueSource {
  /** 값 버스(`publishTagValue`)가 호출한다. 시작 전이면 무시. */
  ingest(key: string, value: number): void;
}

/**
 * 태그 키 → 값 저장소 주소 바인딩 소스. `resolve` 는 키에 꽂힌 주소 목록을
 * 돌려준다(씬의 tagMappings 에서 buildTagMappingIndex 가 만든다). 적용 공식:
 * applied = offset + value * scale. 서버·시뮬 값은 프레임 사이에서 튀므로
 * smooth 로 쓴다.
 */
export function createTagBindingSource(
  resolve: (key: string) => readonly TagBindingTarget[],
): TagBindingSource {
  let sink: RigValueSink | null = null;
  return {
    id: 'tag',
    start(next) {
      sink = next;
    },
    stop() {
      sink = null;
    },
    ingest(key, value) {
      if (!sink || !Number.isFinite(value)) return;
      for (const target of resolve(key)) {
        sink.set(target.address, target.offset + value * target.scale, {
          smooth: true,
        });
      }
    },
  };
}
