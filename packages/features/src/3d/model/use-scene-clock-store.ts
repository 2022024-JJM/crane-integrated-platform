import { create } from 'zustand';

export type SceneClockMode = 'live' | 'manual';

interface SceneClockState {
  /**
   * 'live' = 실제 시계(브라우저 `Date.now()` — 현장 시간대 변환은 소비자가),
   * 'manual' = 사용자가 고른 시각에 고정(시각 미리보기).
   */
  mode: SceneClockMode;
  /** manual 모드의 시각(UTC epoch ms). live 에서는 마지막으로 고른 값. */
  manualTimeMs: number;
  /**
   * live 모드에서 React UI 가 읽는 현재 시각 캐시 — `tickLive` 가 갱신한다.
   * 렌더 중 `Date.now()` 를 부르지 않기 위한 값이라 UI 갱신 주기(수십 초)
   * 만큼만 정확하다. 매 프레임 조명은 `readSceneClockMs` 로 실시계를 읽는다.
   */
  liveNowMs: number;
  /**
   * 야간 작업등(투광등) 점등. 기본 true — 관제 화면은 밤에도 장비가 보여야
   * 한다. 끄면 달·별빛 수준의 어두운 밤이 된다(sky-lighting 의 NIGHT_*_DARK).
   */
  yardLights: boolean;
  setLive: () => void;
  /** 시각을 고정한다(manual 전환). 유한하지 않은 값은 무시. */
  setManualTime: (timeMs: number) => void;
  setYardLights: (on: boolean) => void;
  tickLive: () => void;
}

/**
 * 씬 시각(낮/밤 태양 위치의 입력) — 세션 전용 전역. 새로고침하면 live 로
 * 돌아오고 씬 데이터·히스토리에 남지 않는다(편집기 보기 옵션과 같은 규칙).
 * 모니터링 독 팝업과 에디터 배경 탭이 같은 스토어를 본다 — 에디터에서
 * "18:30" 으로 맞춘 채 모니터링으로 가면 같은 저녁이 보인다.
 */
export const useSceneClockStore = create<SceneClockState>()((set) => ({
  mode: 'live',
  manualTimeMs: Date.now(),
  liveNowMs: Date.now(),
  yardLights: true,
  setLive: () =>
    set((state) =>
      state.mode === 'live' ? state : { mode: 'live', liveNowMs: Date.now() },
    ),
  setManualTime: (timeMs) => {
    if (!Number.isFinite(timeMs)) return;
    set((state) =>
      state.mode === 'manual' && state.manualTimeMs === timeMs
        ? state
        : { mode: 'manual', manualTimeMs: timeMs },
    );
  },
  setYardLights: (on) =>
    set((state) => (state.yardLights === on ? state : { yardLights: on })),
  tickLive: () => set({ liveNowMs: Date.now() }),
}));

/**
 * 지금 이 순간의 씬 시각(UTC epoch ms). live 면 실시계, manual 이면 고정값.
 * 렌더 밖(useFrame·이벤트)에서 부른다.
 */
export function readSceneClockMs(): number {
  const state = useSceneClockStore.getState();
  return state.mode === 'manual' ? state.manualTimeMs : Date.now();
}
