import { invalidateShadows } from '@crane/domain/3d';
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
  /** 마지막 그림자 무효화 이후 누적 |이동량| — step 의 epsilon 판정용. */
  shadowDrift: number;
}

const DEFAULT_SMOOTH_TIME = 0.35;

/**
 * 스무딩의 "실제로 움직였다" 판정 임계(m·deg·배율 공통) — **누적** 이동량 기준.
 *
 * smoothDampStep 은 target 에 수학적으로 영원히 정확 도달하지 않아(지수 수렴,
 * 실측 고정점 ~1e-14) `value === target` 만으로는 무효화가 끝나지 않는다.
 * per-step 변화량만 보면 안 된다 — 느린 파형 추종은 프레임당 이동이 sub-mm
 * 라 임계를 영영 안 넘는데 누적으로는 초당 수 cm 를 가서, 그림자가 안전망
 * 주기(4s)만큼 계단식으로 지연된다(실측: 재생 중 shadow pass 가 거의 안 돎).
 * 그래서 채널마다 마지막 무효화 이후 |이동량|을 누적하고, 어느 채널이든
 * EPS 를 넘으면 무효화 + 전 채널 누적 리셋(그 프레임의 shadow 렌더가 모든
 * 채널의 현재 자세를 담으므로). 정착 후 잔여 누적은 유한(지수 수렴)이라
 * 무효화는 저절로 멈추고, 최종 오차는 EPS(1mm·0.001°) — 최소 텍셀 7.3cm
 * 보다 훨씬 작아 비가시.
 */
const SHADOW_STEP_EPS = 1e-3;

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
    const previous = ch?.value;
    if (!ch) {
      ch = {
        value: smooth ? 0 : v,
        velocity: 0,
        target: v,
        smoothTime: 0,
        shadowDrift: 0,
      };
      this.channels.set(address, ch);
    }
    ch.target = v;
    ch.smoothTime = smooth ? (options?.smoothTime ?? DEFAULT_SMOOTH_TIME) : 0;
    if (!smooth) {
      ch.value = v;
      ch.velocity = 0;
      // 즉시 대입으로 화면 값이 실제로 바뀌는 순간만 그림자 무효화 — 슬라이더·
      // 기록 복원 경로. smooth 는 여기서 target 만 바뀌고 실제 이동은 step 이
      // 하므로 step 쪽 판정에 맡긴다(신규 채널의 value 는 0 = rest 로 시작).
      if (previous !== v && !(previous === undefined && v === 0)) {
        invalidateShadows();
      }
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
      // 채널이 지워지면 드라이버가 다음 프레임에 노드를 rest 로 되돌린다 —
      // 화면이 바뀌므로 그림자도 무효화한다(빈 상태 reset 은 no-op).
      if (this.channels.size > 0) {
        this.channels.clear();
        invalidateShadows();
      }
      return;
    }
    const prefix = `${modelId}/`;
    let removed = false;
    for (const key of this.channels.keys()) {
      if (key.startsWith(prefix)) {
        this.channels.delete(key);
        removed = true;
      }
    }
    if (removed) invalidateShadows();
  }

  /**
   * 모든 채널을 현재값에서 멈춘다(target=value, 속도 0). 충돌 감지가
   * 시뮬레이션을 정지시킬 때 쓴다 — pause 는 러너 틱만 멈추므로 스무딩이
   * 0.35s 더 target 으로 수렴해 정지 뒤에도 노드가 조금 더 파고든다.
   * 이후 새 set 은 정상 동작한다.
   */
  freeze(): void {
    for (const ch of this.channels.values()) {
      ch.target = ch.value;
      ch.velocity = 0;
    }
  }

  /**
   * 현재값(스무딩 적용 후) 전체 스냅샷 — 충돌 기록이 "그 순간의 씬 자세"를
   * 보관하는 데 쓴다. target 이 아니라 value 다: 화면에 보이던 자세가 기준.
   */
  snapshot(): Array<[JointAddress, number]> {
    const out: Array<[JointAddress, number]> = [];
    for (const [address, ch] of this.channels) out.push([address, ch.value]);
    return out;
  }

  /**
   * 스냅샷으로 되돌린다. 먼저 비우므로 스냅샷에 없던 채널(그 뒤 생긴 맵핑)은
   * rest 로 간다. 스무딩 없이 즉시 대입 — 기록을 클릭했을 때 그 자세가 바로
   * 보여야 한다. NaN 은 set 이 0 으로 방어한다.
   */
  restore(entries: ReadonlyArray<readonly [JointAddress, number]>): void {
    this.reset();
    for (const [address, value] of entries) this.set(address, value);
  }

  /**
   * 프레임마다 한 번. 스무딩 채널만 갱신하고, 정착한 채널은 비용 0.
   * 누적 이동량이 SHADOW_STEP_EPS 를 넘는 채널이 생기면 그림자를 무효화한다
   * (임계 주석 참고) — 재생 중엔 이동 속도에 비례한 주기로, 값이 정착하면
   * 자동으로 멈춘다.
   */
  step(dt: number): void {
    let moved = false;
    for (const ch of this.channels.values()) {
      if (ch.smoothTime <= 0 || ch.value === ch.target) continue;
      const before = ch.value;
      smoothDampStep(ch, ch.target, ch.smoothTime, dt);
      ch.shadowDrift += Math.abs(ch.value - before);
      if (ch.shadowDrift > SHADOW_STEP_EPS) moved = true;
    }
    if (moved) {
      invalidateShadows();
      // 이번 프레임의 shadow 렌더가 모든 채널의 현재 자세를 담는다.
      for (const ch of this.channels.values()) ch.shadowDrift = 0;
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

/**
 * 태그 값 → 저장소 값 환산. `applied = offset + value * scale`.
 *
 * 라이브 바인딩 소스(createTagBindingSource)와 충돌 예측의 미래 값 계산이
 * **같은 공식을 써야** 한다 — 갈라지면 예측 자세가 실제 자세와 어긋난다.
 */
export function applyTagBinding(
  target: TagBindingTarget,
  value: number,
): number {
  return target.offset + value * target.scale;
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
        sink.set(target.address, applyTagBinding(target, value), {
          smooth: true,
        });
      }
    },
  };
}
