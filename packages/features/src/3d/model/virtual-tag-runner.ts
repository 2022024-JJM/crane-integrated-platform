import {
  initVirtualTagState,
  setVirtualTagManualValue,
  stepVirtualTag,
  type VirtualTagDefinition,
  type VirtualTagEntry,
  type VirtualTagRuntimeState,
} from '@crane/domain/virtual-tag';
import { notifySceneSeek } from './scene-seek-signal';
import {
  publishTagValue,
  type TagPublish,
  type TagPublishOptions,
  type TagValueSource,
} from './tag-value-bus';

/**
 * 가상 태그 값 러너 — 모듈 전역 `setInterval` 하나로 돈다.
 *
 * R3F useFrame 이 아닌 이유: 관리 페이지(Canvas 없음)에서도 값이 흘러야 표에
 * 현재값이 보이고, 캔버스 유무와 무관하게 "재생" 이 한 의미여야 한다. 값은
 * Object3D 를 직접 만지지 않고 버스 → 값 저장소(스무딩) 로만 가므로 프레임과
 * 어긋나도 튀지 않는다 — 예전 setInterval 생성기가 문제였던 건 Object3D 를
 * 프레임 밖에서 mutate 했기 때문이다.
 *
 * 정의는 장비 계층을 평탄화한 항목(`VirtualTagEntry`)으로 받고 상태는 **키**
 * 기준이다 — 키는 장비키와 코드의 조립값이라 전역에서 유일하고, 코드나 장비 ID
 * 를 바꾸면 새 키로 상태가 다시 잡힌다(범위를 바꿨을 때와 같은 규칙). 장비가
 * 꺼져 있으면 그 장비의 태그는 내보내지 않는다(태그별 켜짐은 없다).
 *
 * 시뮬레이션 시계: 벽시계 dt 에 `speed` 를 곱해 씬 시간 `elapsedMs` 를 누적한다
 * (트랜스포트 위치). 값은 **씬 시간의 함수**다 — `tickMs` 의 고정 스텝 경계
 * 에서만 계산하고(`advanceTo`), 재생·seek 가 같은 함수를 쓴다. 파형은 경로
 * 의존이 없어 스텝을 하나씩 밟지 않고 목표 시각 직전의 스텝 경계로 바로 간다.
 * 저장본의 시간 단위는 초이고 러너 시계는 ms 다 — 스토어가 경계에서 바꾼다.
 *
 * 벽시계 타이머 간격은 `tickMs / speed`(하한 TIMER_MIN_MS)다 — 배속이 높아도
 * 스텝마다 내보내 화면 보간 지연이 씬 시간으로 한 스텝에 머문다. 틱이 밀리면
 * 한 콜백에 여러 스텝을 돈다.
 *
 * 내보내기: 정상 전진은 스무딩(publish 간격만큼 — 스텝 계단을 숨긴다), seek·
 * 리셋은 즉시(`smoothTime: 0`) — 위치 불연속에서 자세가 미끄러지지 않는다.
 * 테스트는 vi.useFakeTimers 로 Date 와 interval 을 함께 고정한다.
 */

export interface VirtualTagRunnerConfig {
  /** 모든 장비의 모든 태그(꺼진 것 포함) — 켜짐 판정은 러너가 한다. */
  entries: readonly VirtualTagEntry[];
  /** 스텝(씬 시간 ms) = 값 갱신 주기. 저장본의 `tickSec` 을 스토어가 ms 로 바꿔 넘긴다. */
  tickMs: number;
  isRunning: boolean;
  /** 배속. 기본 1. */
  speed: number;
}

type GetConfig = () => VirtualTagRunnerConfig;

/** 타이머 최소 벽시계 간격(ms). 배속으로 스텝 간격이 이보다 짧으면 한 콜백에 여러 스텝. */
const TIMER_MIN_MS = 16;

/** seek·리셋 — 위치 불연속. 화면에 즉시 대입. */
const PUBLISH_IMMEDIATE: TagPublishOptions = { smoothTime: 0 };

function speedOf(config: VirtualTagRunnerConfig): number {
  return Number.isFinite(config.speed) && config.speed > 0 ? config.speed : 1;
}

/** 벽시계 publish 간격(ms) — 한 스텝의 씬 시간을 배속으로 나눈 것. */
function timerIntervalMs(config: VirtualTagRunnerConfig): number {
  return Math.max(TIMER_MIN_MS, config.tickMs / speedOf(config));
}

/** 장비가 켜져 있어야 값이 나간다. */
export function isVirtualTagEntryEnabled(entry: VirtualTagEntry): boolean {
  return entry.equipment.enabled;
}

/** 상태를 다시 잡아야 하는 정의 변경 — 옛 값이 새 범위·패턴 밖일 수 있다. */
function isDefinitionChanged(
  prev: VirtualTagDefinition,
  next: VirtualTagDefinition,
): boolean {
  return (
    prev.min !== next.min ||
    prev.max !== next.max ||
    prev.initial !== next.initial ||
    prev.dataType !== next.dataType ||
    JSON.stringify(prev.pattern) !== JSON.stringify(next.pattern)
  );
}

class VirtualTagRuntime {
  private states = new Map<string, VirtualTagRuntimeState>();
  private entries = new Map<string, VirtualTagEntry>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private timerMs = 0;
  /** 씬 시간(ms) — 트랜스포트 위치. 벽시계 dt × 배속의 누적. */
  private elapsedMs = 0;
  /** 값을 계산한 씬 시간 — 항상 `tickMs` 의 배수이고 `elapsedMs` 이하. */
  private integratedMs = 0;
  private lastTickAt = 0;
  private getConfig: GetConfig | null = null;
  private publish: TagPublish = publishTagValue;

  /** 스토어가 재생을 켤 때 부른다. 설정은 매 틱 getter 로 다시 읽는다. */
  start(getConfig: GetConfig): void {
    this.getConfig = getConfig;
    this.lastTickAt = Date.now();
    this.ensureTimer();
    // 재생 즉시 **현재 상태값**을 한 번 내보내 첫 틱 전에도 노드가 값을 받는다.
    this.publishAll(this.publishSmoothing());
  }

  /**
   * 설정 getter 만 붙인다(타이머 없음) — 정지 상태에서 seek 가 값을 계산하려면
   * 설정이 필요하다. 이미 있으면 교체.
   */
  attachConfig(getConfig: GetConfig): void {
    this.getConfig = getConfig;
  }

  /** 값이 나갈 곳을 바꾼다(테스트·어댑터). 기본은 태그 값 버스. */
  setPublish(publish: TagPublish | null): void {
    this.publish = publish ?? publishTagValue;
  }

  pause(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** 정의 목록 동기화 — 새 키는 초기 상태, 사라진 키는 상태 제거. */
  syncDefinitions(entries: readonly VirtualTagEntry[]): void {
    const next = new Map(entries.map((entry) => [entry.key, entry]));
    for (const key of this.states.keys()) {
      if (!next.has(key)) this.states.delete(key);
    }
    for (const entry of entries) {
      const prev = this.entries.get(entry.key);
      const state = this.states.get(entry.key);
      if (!state || !prev || isDefinitionChanged(prev.tag, entry.tag)) {
        this.states.set(entry.key, initVirtualTagState(entry.tag));
      }
    }
    this.entries = next;
  }

  getValue(key: string): number | undefined {
    return this.states.get(key)?.value;
  }

  /** 슬라이더·토글 — 재생 여부와 무관하게 즉시 내보낸다(정지 상태에서 자세 확인용). */
  setManualValue(key: string, value: number): void {
    const entry = this.entries.get(key);
    const state = this.states.get(key);
    if (!entry || !state) return;
    const next = setVirtualTagManualValue(entry.tag, state, value);
    this.states.set(key, next);
    if (isVirtualTagEntryEnabled(entry)) this.publish(key, next.value);
  }

  /**
   * 시간을 0 으로 되돌리고 모든 상태를 initial 로 잡는다(재생 중이면 파형
   * 위상도 0 부터). `publish=false` 면 버스에 내보내지 않는다 — 시뮬레이션
   * 종료(관제 복귀)처럼 모델을 rest 로 두고 싶을 때.
   */
  resetValues(publish = true): void {
    this.elapsedMs = 0;
    this.integratedMs = 0;
    this.lastTickAt = Date.now();
    this.initStates(false);
    // 시각 불연속 — 스토어를 거치지 않는 호출(시뮬레이션 패널 리셋)도 여기로 온다.
    notifySceneSeek();
    if (!publish) return;
    this.publishAll(PUBLISH_IMMEDIATE);
  }

  /**
   * 경과 시간을 옮기고 0 초 상태에서 그 시각의 값을 계산해 내보낸다 — 재생해서
   * 그 시각에 닿았을 때와 같은 값. 재생 여부와 무관(정지 상태에서 타임라인을
   * 훑는 용도). 음수·NaN 은 0. 화면에는 즉시 대입한다.
   */
  seek(elapsedMs: number): void {
    this.elapsedMs =
      Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
    this.lastTickAt = Date.now();
    notifySceneSeek();
    this.resimulate();
    this.publishAll(PUBLISH_IMMEDIATE);
  }

  get elapsed(): number {
    return this.elapsedMs;
  }

  /**
   * 0 초 상태 — 전부 initial. `keepManual` 이면 manual 태그는 슬라이더 값을
   * 유지한다(seek — 파형이 없으니 시각과 무관).
   */
  private initStates(keepManual: boolean): void {
    for (const entry of this.entries.values()) {
      if (
        keepManual &&
        entry.tag.pattern.kind === 'manual' &&
        this.states.has(entry.key)
      ) {
        continue;
      }
      this.states.set(entry.key, initVirtualTagState(entry.tag));
    }
  }

  /** 0 초 상태에서 현재 `elapsedMs` 의 값을 다시 계산한다. 설정이 없으면 no-op. */
  private resimulate(): void {
    const config = this.getConfig?.();
    if (!config) return;
    this.integratedMs = 0;
    this.initStates(true);
    this.advanceTo(config, this.elapsedMs);
  }

  /**
   * 고정 스텝 — `targetMs` 를 넘지 않는 마지막 `tickMs` 경계로 `integratedMs`
   * 를 옮기고 그 시각의 파형 값을 상태로 둔다. 값이 씬 시간의 순수 함수라
   * 사이 스텝을 밟을 필요가 없고, 재생 tick 과 seek 가 같은 함수를 쓰므로 같은
   * 씬 시각의 값이 경로와 무관하게 같다. 꺼진 항목은 계산하지 않는다.
   */
  private advanceTo(config: VirtualTagRunnerConfig, targetMs: number): void {
    const stepMs = config.tickMs;
    if (!(stepMs > 0)) return;
    const reachedMs = Math.floor(targetMs / stepMs) * stepMs;
    if (reachedMs <= this.integratedMs) return;
    this.integratedMs = reachedMs;
    for (const entry of config.entries) {
      if (!isVirtualTagEntryEnabled(entry)) continue;
      const state =
        this.states.get(entry.key) ?? initVirtualTagState(entry.tag);
      this.states.set(
        entry.key,
        stepVirtualTag(entry.tag, this.integratedMs, state),
      );
    }
  }

  private ensureTimer(): void {
    const config = this.getConfig?.();
    if (!config) return;
    const interval = timerIntervalMs(config);
    if (this.timer !== null && this.timerMs === interval) return;
    this.pause();
    this.timerMs = interval;
    this.timer = setInterval(() => this.tick(), interval);
  }

  /** 정상 전진의 스무딩(초) = publish 벽시계 간격 — 스텝 계단을 숨기고 지연은 씬 시간 한 스텝. */
  private publishSmoothing(): TagPublishOptions | undefined {
    const config = this.getConfig?.();
    if (!config) return undefined;
    return { smoothTime: timerIntervalMs(config) / 1000 };
  }

  private publishAll(options: TagPublishOptions | undefined): void {
    for (const entry of this.entries.values()) {
      if (!isVirtualTagEntryEnabled(entry)) continue;
      const state = this.states.get(entry.key);
      if (state) this.publish(entry.key, state.value, options);
    }
  }

  tick(): void {
    const config = this.getConfig?.();
    if (!config || !config.isRunning) {
      this.pause();
      return;
    }
    if (timerIntervalMs(config) !== this.timerMs) {
      this.ensureTimer();
    }
    const now = Date.now();
    // 탭 비활성 등으로 오래 밀렸으면 한 번만 따라잡는다(최대 한 틱 분량 × 10).
    const dt = Math.min(Math.max(0, now - this.lastTickAt), config.tickMs * 10);
    this.lastTickAt = now;
    this.elapsedMs += dt * speedOf(config);
    this.advanceTo(config, this.elapsedMs);
    this.publishAll(this.publishSmoothing());
  }
}

export const virtualTagRuntime = new VirtualTagRuntime();

/**
 * TagValueSource 모양의 어댑터 — 생산자 교체 지점을 한 인터페이스로 맞춘다.
 * start 에 받은 publish 로 값을 내보내고 stop 에서 버스 기본값으로 돌린다.
 * 재생 자체(타이머)는 useVirtualTagStore.start/pause 가 관리한다.
 */
export const virtualTagSource: TagValueSource = {
  id: 'virtual',
  start(publish) {
    virtualTagRuntime.setPublish(publish);
  },
  stop() {
    virtualTagRuntime.setPublish(null);
  },
};
