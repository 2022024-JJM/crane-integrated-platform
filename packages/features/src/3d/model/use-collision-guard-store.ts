import { create } from 'zustand';

export type DetectedObjectType = 'person' | 'vehicle';

/**
 * 충돌 감지 영역 설정. 씬 좌표(world unit) 기준.
 *
 * metersPerUnit: 씬 1 unit이 현실 몇 m인지. 시뮬레이션 이동 속도(m/s)와
 *   객체 mesh(미터 단위로 모델링)를 씬 unit으로 환산할 때 사용한다.
 * sizeMultiplier: 감지 객체의 시각적 과장 배율. 1이면 실측 크기인데,
 *   조선소 스케일 씬에서는 사람이 너무 작아 보이므로 2~3배를 권장.
 */
export interface CollisionGuardZone {
  /** 감지 원 중심 (x, z) */
  center: [number, number];
  /** 지면 높이 (y) */
  y: number;
  /** 감지 반경 (씬 unit) — 이 안에 들어오면 객체가 나타난다 */
  radius: number;
  /** 위험 반경 (씬 unit) — 이 안이면 danger 상태로 강조 */
  dangerRadius: number;
  metersPerUnit: number;
  sizeMultiplier: number;
}

/**
 * LiDAR(현재는 시뮬레이션)가 추적 중인 객체 1개.
 *
 * target은 센서 tick마다 in-place로 갱신되는 "목표 상태"다. 렌더러가 매
 * 프레임 이 값을 향해 damping 보간하므로, 센서 주기(~8Hz)가 프레임보다
 * 느려도 테슬라처럼 부드럽게 움직인다. zustand set()은 트랙 추가/제거
 * 시에만 호출한다 — 값 갱신마다 React 리렌더가 나지 않도록.
 */
export interface DetectedTrack {
  id: string;
  type: DetectedObjectType;
  target: {
    x: number;
    z: number;
    /** 진행 방향 (rad, +x축 기준 반시계) */
    heading: number;
    /** m/s — 표시용/추후 TTC 계산용 */
    speed: number;
  };
  /** 'leaving'이면 렌더러가 fade-out 후 remove()를 호출한다 */
  phase: 'active' | 'leaving';
}

interface CollisionGuardState {
  enabled: boolean;
  tracks: DetectedTrack[];
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
  /**
   * 센서 관측값 반영. 새 id면 트랙을 추가(set → mount), 기존 id면 target을
   * in-place 갱신(리렌더 없음). fade-out 중 재진입하면 다시 살린다.
   *
   * 실제 LiDAR 연동 시 이 함수만 호출하면 된다 — WebSocket 브리지에서
   * 객체 인식 결과를 ingest()로 밀어 넣는 구조.
   */
  ingest: (
    id: string,
    type: DetectedObjectType,
    x: number,
    z: number,
    heading: number,
    speed: number,
  ) => void;
  /** 감지 범위 이탈 → fade-out 시작. Object는 렌더러가 remove()로 정리. */
  markLeaving: (id: string) => void;
  /** fade-out 완료 후 렌더러가 호출 (unmount 유발) */
  remove: (id: string) => void;
  clear: () => void;
}

export const useCollisionGuardStore = create<CollisionGuardState>()(
  (set, get) => ({
    enabled: true,
    tracks: [],

    setEnabled: (enabled) => set({ enabled }),
    toggle: () => set((s) => ({ enabled: !s.enabled })),

    ingest: (id, type, x, z, heading, speed) => {
      const existing = get().tracks.find((track) => track.id === id);

      if (existing) {
        existing.target.x = x;
        existing.target.z = z;
        existing.target.heading = heading;
        existing.target.speed = speed;
        // 이탈 fade-out 도중 재진입한 경우 되살린다.
        existing.phase = 'active';
        return;
      }

      set((s) => ({
        tracks: [
          ...s.tracks,
          { id, type, target: { x, z, heading, speed }, phase: 'active' },
        ],
      }));
    },

    markLeaving: (id) => {
      // phase는 렌더러가 useFrame에서 직접 읽으므로 set() 없이 mutate.
      const track = get().tracks.find((t) => t.id === id);
      if (track) {
        track.phase = 'leaving';
      }
    },

    remove: (id) =>
      set((s) => {
        if (!s.tracks.some((t) => t.id === id)) return s;
        return { tracks: s.tracks.filter((t) => t.id !== id) };
      }),

    clear: () => set({ tracks: [] }),
  }),
);
