import {
  clampToTag,
  evaluateScenarioTrack,
  initVirtualTagState,
  isScenarioFinished,
  scenarioDurationMs,
  scenarioTimeMs,
  setVirtualTagManualValue,
  stepVirtualTag,
  type ScenarioTrack,
  type VirtualScenario,
  type VirtualTagDefinition,
  type VirtualTagRuntimeState,
} from '@crane/domain/virtual-tag';
import {
  publishTagValue,
  type TagPublish,
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
 * 시간은 `Date.now()` 누적(elapsed) 이라 일시정지 후 재개하면 파형이 이어진다.
 * 테스트는 vi.useFakeTimers 로 Date 와 interval 을 함께 고정한다.
 *
 * 시뮬레이션 시계(2026-09-12): 벽시계 dt 에 `speed` 를 곱해 누적한다 — 배속은
 * 파형 주기와 시나리오 시각을 함께 빠르게 한다. `seek(ms)` 는 경과 시간을
 * 옮기고 모든 값을 그 시각으로 다시 계산해 내보낸다(파형·시나리오 모두 시각의
 * 함수라 결정론적). 활성 시나리오가 있으면 트랙이 있는 태그는 키프레임
 * 보간값이 파형을 대신하고, loop 가 아닌 시나리오가 끝에 닿으면 `onFinished`
 * 를 한 번 부른다(스토어가 일시정지한다).
 */

export interface VirtualTagRunnerConfig {
  tags: VirtualTagDefinition[];
  tickMs: number;
  isRunning: boolean;
  /** 배속. 기본 1. */
  speed: number;
  /** 활성 시나리오. 없으면 null. */
  scenario: VirtualScenario | null;
}

type GetConfig = () => VirtualTagRunnerConfig;

class VirtualTagRuntime {
  private states = new Map<string, VirtualTagRuntimeState>();
  private defs = new Map<string, VirtualTagDefinition>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private timerTickMs = 0;
  private elapsedMs = 0;
  private lastTickAt = 0;
  private getConfig: GetConfig | null = null;
  private onFinished: (() => void) | null = null;
  private publish: TagPublish = publishTagValue;
  /** 시나리오 참조별 트랙 인덱스 캐시 — 같은 시나리오면 틱마다 다시 만들지 않는다. */
  private trackCacheFor: VirtualScenario | null = null;
  private trackByKey = new Map<string, ScenarioTrack>();
  private finishedNotified = false;

  /**
   * 스토어가 재생을 켤 때 부른다. 설정은 매 틱 getter 로 다시 읽는다.
   * `onFinished` 는 loop 아닌 시나리오가 끝에 닿은 틱에 한 번.
   */
  start(getConfig: GetConfig, onFinished: (() => void) | null = null): void {
    this.getConfig = getConfig;
    this.onFinished = onFinished;
    this.lastTickAt = Date.now();
    this.finishedNotified = false;
    this.ensureTimer();
    // 재생 즉시 현재값을 한 번 내보내 첫 틱 전에도 노드가 초기값을 받는다.
    this.evaluateAll();
    this.publishAll();
  }

  /**
   * 설정 getter 만 붙인다(타이머 없음) — 정지 상태에서 seek·시나리오 전환이
   * 값을 계산하려면 설정이 필요하다. 이미 있으면 교체.
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

  /** 정의 목록 동기화 — 새 태그는 초기 상태, 사라진 태그는 상태 제거. */
  syncDefinitions(tags: VirtualTagDefinition[]): void {
    const nextDefs = new Map(tags.map((t) => [t.id, t]));
    for (const id of this.states.keys()) {
      if (!nextDefs.has(id)) this.states.delete(id);
    }
    for (const def of tags) {
      const prev = this.defs.get(def.id);
      const state = this.states.get(def.id);
      // 범위·패턴·초기값이 바뀌면 상태를 다시 잡는다 — 옛 값이 새 범위 밖일 수 있다.
      const changed =
        !prev ||
        prev.min !== def.min ||
        prev.max !== def.max ||
        prev.initial !== def.initial ||
        JSON.stringify(prev.pattern) !== JSON.stringify(def.pattern);
      if (!state || changed) this.states.set(def.id, initVirtualTagState(def));
    }
    this.defs = nextDefs;
  }

  getValue(id: string): number | undefined {
    return this.states.get(id)?.value;
  }

  getValueByKey(key: string): number | undefined {
    for (const def of this.defs.values()) {
      if (def.key === key) return this.states.get(def.id)?.value;
    }
    return undefined;
  }

  /** 슬라이더 — 재생 여부와 무관하게 즉시 내보낸다(정지 상태에서 자세 확인용). */
  setManualValue(id: string, value: number): void {
    const def = this.defs.get(id);
    const state = this.states.get(id);
    if (!def || !state) return;
    const next = setVirtualTagManualValue(def, state, value);
    this.states.set(id, next);
    if (def.enabled) this.publish(def.key, next.value);
  }

  /** 모든 상태를 initial 로 되돌린다(재생 중이면 파형 위상도 0 부터). */
  resetValues(): void {
    this.elapsedMs = 0;
    this.lastTickAt = Date.now();
    this.finishedNotified = false;
    for (const def of this.defs.values()) {
      this.states.set(def.id, initVirtualTagState(def));
    }
    // 시나리오가 활성이면 0초 값은 initial 이 아니라 첫 키프레임이다.
    this.evaluateAll();
    this.publishAll();
  }

  /**
   * 경과 시간을 옮기고 모든 값을 그 시각으로 다시 계산해 내보낸다. 재생
   * 여부와 무관(정지 상태에서 타임라인을 훑는 용도). 음수·NaN 은 0.
   */
  seek(elapsedMs: number): void {
    this.elapsedMs =
      Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
    this.lastTickAt = Date.now();
    this.finishedNotified = false;
    this.evaluateAll();
    this.publishAll();
  }

  get elapsed(): number {
    return this.elapsedMs;
  }

  /** 활성 시나리오 기준 현재 시나리오 시각(ms). 시나리오가 없으면 elapsed. */
  get scenarioTime(): number {
    const scenario = this.getConfig?.().scenario ?? null;
    if (!scenario) return this.elapsedMs;
    return scenarioTimeMs(
      this.elapsedMs,
      scenarioDurationMs(scenario),
      scenario.loop,
    );
  }

  private tracksOf(scenario: VirtualScenario): Map<string, ScenarioTrack> {
    if (this.trackCacheFor !== scenario) {
      this.trackCacheFor = scenario;
      this.trackByKey = new Map(scenario.tracks.map((t) => [t.key, t]));
    }
    return this.trackByKey;
  }

  /**
   * 현재 elapsed 로 모든 태그 값을 계산한다(내보내지 않음). manual 은 시나리오
   * 트랙이 있을 때만 바뀐다(파형이 없으니 슬라이더 값 유지).
   */
  private evaluateAll(): void {
    const config = this.getConfig?.();
    if (!config) return;
    const scenario = config.scenario;
    const tracks = scenario ? this.tracksOf(scenario) : null;
    const tMs = scenario
      ? scenarioTimeMs(
          this.elapsedMs,
          scenarioDurationMs(scenario),
          scenario.loop,
        )
      : 0;
    for (const def of config.tags) {
      const state = this.states.get(def.id) ?? initVirtualTagState(def);
      const track = tracks?.get(def.key);
      if (track) {
        const value = evaluateScenarioTrack(track, tMs);
        if (value !== undefined) {
          this.states.set(def.id, { value: clampToTag(def, value) });
          continue;
        }
      }
      this.states.set(def.id, stepVirtualTag(def, this.elapsedMs, state));
    }
  }

  private ensureTimer(): void {
    const config = this.getConfig?.();
    if (!config) return;
    if (this.timer !== null && this.timerTickMs === config.tickMs) return;
    this.pause();
    this.timerTickMs = config.tickMs;
    this.timer = setInterval(() => this.tick(), config.tickMs);
  }

  private publishAll(): void {
    for (const def of this.defs.values()) {
      if (!def.enabled) continue;
      const state = this.states.get(def.id);
      if (state) this.publish(def.key, state.value);
    }
  }

  tick(): void {
    const config = this.getConfig?.();
    if (!config || !config.isRunning) {
      this.pause();
      return;
    }
    if (config.tickMs !== this.timerTickMs) {
      this.ensureTimer();
    }
    const now = Date.now();
    // 탭 비활성 등으로 오래 밀렸으면 한 번만 따라잡는다(최대 한 틱 분량 × 10).
    const dt = Math.min(Math.max(0, now - this.lastTickAt), config.tickMs * 10);
    this.lastTickAt = now;
    const speed =
      Number.isFinite(config.speed) && config.speed > 0 ? config.speed : 1;
    this.elapsedMs += dt * speed;

    const scenario = config.scenario;
    const tracks = scenario ? this.tracksOf(scenario) : null;
    const durationMs = scenario ? scenarioDurationMs(scenario) : 0;
    const tMs = scenario
      ? scenarioTimeMs(this.elapsedMs, durationMs, scenario.loop)
      : 0;

    for (const def of config.tags) {
      if (!def.enabled) continue;
      const state = this.states.get(def.id) ?? initVirtualTagState(def);
      const track = tracks?.get(def.key);
      let next: VirtualTagRuntimeState;
      if (track) {
        const value = evaluateScenarioTrack(track, tMs);
        next =
          value !== undefined
            ? { value: clampToTag(def, value) }
            : stepVirtualTag(def, this.elapsedMs, state);
      } else {
        next = stepVirtualTag(def, this.elapsedMs, state);
      }
      this.states.set(def.id, next);
      this.publish(def.key, next.value);
    }

    if (
      scenario &&
      !this.finishedNotified &&
      isScenarioFinished(this.elapsedMs, durationMs, scenario.loop)
    ) {
      this.finishedNotified = true;
      this.onFinished?.();
    }
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
