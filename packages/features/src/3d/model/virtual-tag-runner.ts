import {
  clampToTag,
  evaluateScenarioTrack,
  hasRateLimits,
  rateLimitStep,
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
 * 시뮬레이션 시계: 벽시계 dt 에 `speed` 를 곱해 씬 시간 `elapsedMs` 를 누적한다
 * (트랜스포트 위치). 값은 **씬 시간의 함수**다 — `tickMs` 의 고정 스텝으로만
 * 적분하고(`advanceTo`), 재생·seek 가 같은 적분기를 쓴다. 속도·가속 한계가
 * 있는 태그는 값이 경로 의존(값·속도 상태)이라 seek 에서 목표값을 바로 넣으면
 * 재생 때 그 시각에 보이던 자세와 어긋난다. 그래서 `seek(ms)` 는 0 초 상태에서
 * ms 까지 다시 적분한다(재시뮬레이션). 비용은 스텝 수에 선형이다 — 90 초
 * 시나리오는 태그당 900 스텝.
 *
 * 벽시계 타이머 간격은 `tickMs / speed`(하한 TIMER_MIN_MS)다 — 배속이 높아도
 * 스텝마다 내보내 화면 보간 지연이 씬 시간으로 한 스텝에 머문다. 틱이 밀리면
 * 한 콜백에 여러 스텝을 돈다.
 *
 * 내보내기: 정상 전진은 스무딩(publish 간격만큼 — 스텝 계단을 숨긴다), seek·
 * 리셋은 즉시(`smoothTime: 0`) — 위치 불연속에서 자세가 미끄러지지 않는다.
 *
 * 활성 시나리오가 있으면 트랙이 있는 태그는 키프레임 보간값이 파형을 대신하고,
 * loop 가 아닌 시나리오가 끝에 닿으면 `onFinished` 를 한 번 부른다(스토어가
 * 일시정지한다). 테스트는 vi.useFakeTimers 로 Date 와 interval 을 함께 고정한다.
 */

export interface VirtualTagRunnerConfig {
  tags: VirtualTagDefinition[];
  /** 적분 스텝(씬 시간 ms) = 값 갱신 주기. */
  tickMs: number;
  isRunning: boolean;
  /** 배속. 기본 1. */
  speed: number;
  /** 활성 시나리오. 없으면 null. */
  scenario: VirtualScenario | null;
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

class VirtualTagRuntime {
  private states = new Map<string, VirtualTagRuntimeState>();
  private defs = new Map<string, VirtualTagDefinition>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private timerMs = 0;
  /** 씬 시간(ms) — 트랜스포트 위치. 벽시계 dt × 배속의 누적. */
  private elapsedMs = 0;
  /** 적분이 도달한 씬 시간 — 항상 `tickMs` 의 배수이고 `elapsedMs` 이하. */
  private integratedMs = 0;
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
    // 재생 즉시 **현재 상태값**을 한 번 내보내 첫 틱 전에도 노드가 값을 받는다.
    // 시각 기준 재계산을 하지 않는다 — 한계로 목표보다 뒤처져 있던 값이 재개
    // 순간 목표로 점프해 모델이 미끄러진다. 재계산은 seek·리셋·시나리오 전환만.
    this.publishAll(this.publishSmoothing());
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
        JSON.stringify(prev.pattern) !== JSON.stringify(def.pattern) ||
        JSON.stringify(prev.limits ?? null) !==
          JSON.stringify(def.limits ?? null);
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

  /**
   * 시간을 0 으로 되돌리고 모든 상태를 0 초 상태로 잡는다(재생 중이면 파형
   * 위상도 0 부터). `publish=false` 면 버스에 내보내지 않는다 — 시뮬레이션
   * 종료(관제 복귀)처럼 모델을 rest 로 두고 싶을 때. 이 경로는 시나리오와
   * 무관하게 initial 이다(종료가 시나리오도 해제하므로).
   */
  resetValues(publish = true): void {
    this.elapsedMs = 0;
    this.integratedMs = 0;
    this.lastTickAt = Date.now();
    this.finishedNotified = false;
    this.initStates(publish ? this.activeScenario() : null, false);
    // 시각 불연속 — 스토어를 거치지 않는 호출(시뮬레이션 패널 리셋)도 여기로 온다.
    notifySceneSeek();
    if (!publish) return;
    this.publishAll(PUBLISH_IMMEDIATE);
  }

  /**
   * 경과 시간을 옮기고 0 초부터 그 시각까지 다시 적분해 내보낸다 — 재생해서
   * 그 시각에 닿았을 때와 같은 값·속도 상태. 재생 여부와 무관(정지 상태에서
   * 타임라인을 훑는 용도). 음수·NaN 은 0. 화면에는 즉시 대입한다.
   */
  seek(elapsedMs: number): void {
    this.elapsedMs =
      Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
    this.lastTickAt = Date.now();
    this.finishedNotified = false;
    notifySceneSeek();
    this.resimulate();
    this.publishAll(PUBLISH_IMMEDIATE);
  }

  get elapsed(): number {
    return this.elapsedMs;
  }

  /** 활성 시나리오 기준 현재 시나리오 시각(ms). 시나리오가 없으면 elapsed. */
  get scenarioTime(): number {
    const scenario = this.activeScenario();
    if (!scenario) return this.elapsedMs;
    return scenarioTimeMs(
      this.elapsedMs,
      scenarioDurationMs(scenario),
      scenario.loop,
    );
  }

  private activeScenario(): VirtualScenario | null {
    return this.getConfig?.().scenario ?? null;
  }

  private tracksOf(scenario: VirtualScenario): Map<string, ScenarioTrack> {
    if (this.trackCacheFor !== scenario) {
      this.trackCacheFor = scenario;
      this.trackByKey = new Map(scenario.tracks.map((t) => [t.key, t]));
    }
    return this.trackByKey;
  }

  /**
   * 0 초 상태 — 트랙이 있는 태그는 첫 키프레임 값(재생 시작 자세), 나머지는
   * initial. 속도는 0. `keepManual` 이면 트랙 없는 manual 태그는 슬라이더 값을
   * 유지한다(seek — 파형이 없으니 시각과 무관).
   */
  private initStates(
    scenario: VirtualScenario | null,
    keepManual: boolean,
  ): void {
    const tracks = scenario ? this.tracksOf(scenario) : null;
    for (const def of this.defs.values()) {
      const track = tracks?.get(def.key);
      const first = track ? evaluateScenarioTrack(track, 0) : undefined;
      if (first !== undefined) {
        this.states.set(def.id, { value: clampToTag(def, first) });
        continue;
      }
      if (
        keepManual &&
        def.pattern.kind === 'manual' &&
        this.states.has(def.id)
      ) {
        continue;
      }
      this.states.set(def.id, initVirtualTagState(def));
    }
  }

  /** 0 초 상태에서 현재 `elapsedMs` 까지 다시 적분한다. 설정이 없으면 no-op. */
  private resimulate(): void {
    const config = this.getConfig?.();
    if (!config) return;
    this.integratedMs = 0;
    this.initStates(config.scenario, true);
    this.advanceTo(config, this.elapsedMs);
  }

  /**
   * 고정 스텝 적분 — `integratedMs` 가 `targetMs` 를 넘지 않는 마지막 스텝
   * 경계까지 `tickMs` 씩 전진한다. 스텝마다 목표(스텝 끝 시각의 시나리오 값 또는
   * 파형)를 한계로 램프한다. 재생 tick 과 seek 재시뮬레이션이 같은 함수를 쓰므로
   * 같은 씬 시각의 값이 경로와 무관하게 같다.
   */
  private advanceTo(config: VirtualTagRunnerConfig, targetMs: number): void {
    const stepMs = config.tickMs;
    if (!(stepMs > 0)) return;
    const scenario = config.scenario;
    const tracks = scenario ? this.tracksOf(scenario) : null;
    const durationMs = scenario ? scenarioDurationMs(scenario) : 0;
    const dtSec = stepMs / 1000;
    while (this.integratedMs + stepMs <= targetMs) {
      this.integratedMs += stepMs;
      const tMs = scenario
        ? scenarioTimeMs(this.integratedMs, durationMs, scenario.loop)
        : 0;
      for (const def of config.tags) {
        if (!def.enabled) continue;
        const state = this.states.get(def.id) ?? initVirtualTagState(def);
        const track = tracks?.get(def.key);
        // 목표값 — 시나리오 트랙이 있으면 키프레임, 없으면 파형(manual 은 현재값).
        const scenarioValue = track
          ? evaluateScenarioTrack(track, tMs)
          : undefined;
        const target =
          scenarioValue !== undefined
            ? clampToTag(def, scenarioValue)
            : stepVirtualTag(def, this.integratedMs, state).value;
        this.states.set(
          def.id,
          hasRateLimits(def.limits)
            ? rateLimitStep(
                state.value,
                state.velocity ?? 0,
                target,
                dtSec,
                def.limits,
              )
            : { value: target },
        );
      }
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
    for (const def of this.defs.values()) {
      if (!def.enabled) continue;
      const state = this.states.get(def.id);
      if (state) this.publish(def.key, state.value, options);
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

    const scenario = config.scenario;
    if (
      scenario &&
      !this.finishedNotified &&
      isScenarioFinished(
        this.elapsedMs,
        scenarioDurationMs(scenario),
        scenario.loop,
      )
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
