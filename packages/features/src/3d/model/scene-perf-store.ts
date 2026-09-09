import { getStorageItem } from '@crane/core/lib/safe-storage';
import {
  createWorstFrameTracker,
  updateEma,
  type ScenePerfSample,
  type WorstFrameTracker,
} from '../lib/perf-stats';

/**
 * dev 성능 HUD 의 샘플 저장소 — React 밖 모듈 싱글턴 (선례:
 * @crane/domain/3d 의 shadow-invalidation.ts).
 *
 * 왜 mutable + 폴링인가: 기록자는 useFrame(초당 수십 회)이고, useFrame 안
 * setState 는 이 레포 금지 규약이다(값이 프레임 속도로 오면 React 커밋이
 * 그 속도로 돈다 — tag-value-bus.ts 의 tagLiveValues 주석과 같은 이유).
 * 그래서 구독 없이, 기록은 mutable 샘플에 쓰고 UI(ScenePerfHud)가 낮은
 * 주기(500ms)로 read() 해 간다.
 *
 * 기록자는 ScenePerfProbe(Canvas 안) 하나다. 캔버스가 여럿 떠 있으면 같은
 * 프레임에 여러 번 기록돼 마지막 캔버스 값 위주로 보인다 — dev 진단
 * 도구라 감수하고, 정밀 비교가 필요하면 화면 하나만 띄우고 본다.
 */

const sample: ScenePerfSample = {
  calls: 0,
  triangles: 0,
  frameMs: 0,
  worstMs: 0,
  heapMB: null,
};

let lastFrameAt: number | null = null;
let frameMsEma: number | null = null;
let worstTracker: WorstFrameTracker = createWorstFrameTracker();

export const scenePerfStore = {
  /**
   * 프레임 1회 기록. dt 는 직전 record 호출과의 간격으로 여기서 계산한다 —
   * 첫 프레임(기준 시각 없음)은 카운터만 쓰고 dt 통계는 건너뛴다.
   * heap 은 바이트로 받아 MB 로 바꿔 둔다(호출부 ui 에 수치 계산 금지).
   */
  record(
    now: number,
    calls: number,
    triangles: number,
    heapBytes: number | null,
  ): void {
    if (!Number.isFinite(now)) return;
    if (lastFrameAt !== null) {
      const dt = now - lastFrameAt;
      frameMsEma = updateEma(frameMsEma, dt);
      worstTracker.push(now, dt);
      sample.frameMs = frameMsEma;
      sample.worstMs = worstTracker.worst(now);
    }
    lastFrameAt = now;
    sample.calls = calls;
    sample.triangles = triangles;
    sample.heapMB =
      heapBytes !== null && Number.isFinite(heapBytes)
        ? heapBytes / (1024 * 1024)
        : null;
  },

  /**
   * 폴링 읽기 — 같은 mutable 객체를 돌려주므로 값을 들고 있지 말고 그
   * 자리에서 소비한다(HUD 는 즉시 문자열로 포맷).
   */
  read(): Readonly<ScenePerfSample> {
    return sample;
  },

  /**
   * 기준 시각·통계 초기화. 프로브가 마운트될 때 부른다 — 이전 캔버스가
   * 남긴 lastFrameAt 으로 첫 dt 가 수 초짜리 거대값이 되는 것을 막는다.
   */
  reset(): void {
    lastFrameAt = null;
    frameMsEma = null;
    worstTracker = createWorstFrameTracker();
    sample.calls = 0;
    sample.triangles = 0;
    sample.frameMs = 0;
    sample.worstMs = 0;
    sample.heapMB = null;
  },
};

/** localStorage 키 규약 `crane:<feature>` (선례: dock-storage.ts). */
export const PERF_HUD_STORAGE_KEY = 'crane:perf-hud';

/**
 * HUD 활성 판정 — 프로브·HUD 가 같은 조건을 본다.
 * dev 번들에서만 살아 있고(import.meta.env.DEV 가 프로덕션 트리셰이킹을
 * 보장 — shadow-invalidation.ts 의 __shadowDebug 와 같은 방식), dev 에서도
 * 콘솔에서 `localStorage.setItem('crane:perf-hud', '1')` 후 새로고침해야
 * 켜진다(렌더 중 매번 읽는 값이라 토글 반영은 새로고침 기준).
 */
export function isScenePerfHudEnabled(): boolean {
  return import.meta.env.DEV && getStorageItem(PERF_HUD_STORAGE_KEY) === '1';
}
