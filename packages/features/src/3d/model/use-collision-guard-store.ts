import { create } from 'zustand';

export type DetectedObjectType = 'person' | 'car' | 'forklift';

/**
 * 충돌 감지 영역(센서 1기 커버리지) 설정. 씬 좌표(world unit) 기준.
 *
 * 라이다는 크레인 거더 양쪽 다리에 설치되므로 감지 영역은 다리별로
 * 하나씩 — 화면에는 이 zone 배열의 합집합이 커버리지로 나타난다.
 *
 * metersPerUnit: 씬 1 unit이 현실 몇 m인지. 시뮬레이션 이동 속도(m/s)와
 *   객체 mesh(미터 단위로 모델링)를 씬 unit으로 환산할 때 사용한다.
 * sizeMultiplier: 감지 객체의 시각적 과장 배율. 1이면 실측 크기인데,
 *   조선소 스케일 씬에서는 사람이 너무 작아 보이므로 2~3배를 권장.
 */
export interface CollisionGuardZone {
  /** 감지 원 중심 (x, z) — 라이다 설치 지점(다리) */
  center: [number, number];
  /** 지면 높이 (y) */
  y: number;
  /** 라이다 감지 반경 (씬 unit) — 이 안에 들어오면 객체가 나타난다 */
  radius: number;
  /** 위험 반경 (씬 unit) — 이 안이면 danger 상태로 강조 */
  dangerRadius: number;
  /** 카메라 근거리 음영 커버 반경 (씬 unit, 표시용) */
  cameraRadius?: number;
  /**
   * 주행(레일) 방향 단위 벡터 (x, z). 시뮬레이션 에이전트의 통행 축이자
   * 구조물 키프아웃 타원의 장축 기준. 생략 시 [1, 0] (X축).
   */
  travel?: [number, number];
  /**
   * 센서 설치 지점의 구조물(다리) 풋프린트 — 시뮬레이션 에이전트가
   * 침범하지 못하는 키프아웃 타원 (씬 unit, travel 축 기준).
   * 골리앗 다리 하부는 주행 방향으로 길쭉하므로 halfAlong > halfAcross.
   */
  obstacle?: { halfAlong: number; halfAcross: number };
  /**
   * 시뮬레이션 에이전트가 통행할 수 있는 차선 밴드 — travel 축에 대한
   * 횡방향 부호 있는 오프셋 범위 (m). 도크 피트·건물을 피해 실제로
   * 다닐 수 있는 통로(주행로 부지, 열린 부두)만 지정한다.
   * 양수 = travel 방향 기준 왼쪽(+perp). 생략 시 감지 반경 80%까지 전부 허용.
   */
  laneBandsM?: Array<[number, number]>;
  /** 다리 식별 라벨 (HUD 표시용, 예: 'L1') */
  label?: string;
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

export type TrackSeverity = 'warning' | 'danger';

/** 존 중심으로부터의 평면 거리 (씬 unit) */
export function distanceFromZoneCenter(
  x: number,
  z: number,
  zone: CollisionGuardZone,
): number {
  return Math.hypot(x - zone.center[0], z - zone.center[1]);
}

/** 여러 센서 존 중 (x, z)에서 가장 가까운 존과 그 거리 */
export function nearestZone(
  x: number,
  z: number,
  zones: CollisionGuardZone[],
): { zone: CollisionGuardZone; dist: number } {
  let best = zones[0];
  let bestDist = distanceFromZoneCenter(x, z, best);
  for (let i = 1; i < zones.length; i++) {
    const dist = distanceFromZoneCenter(x, z, zones[i]);
    if (dist < bestDist) {
      best = zones[i];
      bestDist = dist;
    }
  }
  return { zone: best, dist: bestDist };
}

/**
 * 트랙 위험도 판정 — 가장 가까운 센서 존 기준. 감지 반경 안이면 최소
 * warning, 위험 반경 안이면 danger. 씬(링/마커/림), 라벨, HUD가 모두
 * 이 함수 하나로 판단한다.
 */
export function trackSeverity(
  track: DetectedTrack,
  zones: CollisionGuardZone[],
): TrackSeverity {
  const { zone, dist } = nearestZone(track.target.x, track.target.z, zones);
  return dist <= zone.dangerRadius ? 'danger' : 'warning';
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
   * 이 push 기반 형태는 실제 센서 연동을 염두에 둔 것이지만, 실물 LiDAR를
   * 붙이려면 이 함수를 호출하는 것만으로는 부족하다. 아래가 선행되어야
   * 한다 (자세한 내용은 use-collision-guard-simulation.ts 상단 주석):
   *
   *  - 좌표 변환: 여기 x/z는 이미 씬 world unit이다. 실물은 센서 로컬
   *    프레임(m, Z-up, 센서 원점)으로 오므로 축 변환 · 외부 파라미터 ·
   *    크레인 실시간 포즈 · metersPerUnit을 합성해야 한다.
   *  - 수명 관리: 이 스토어에는 타임스탬프가 없다. 트래커가 보고를 멈춘
   *    트랙은 markLeaving()을 호출해 줄 주체가 없어 영구히 남는다
   *    (위험 반경 안이면 가짜 경보가 계속된다).
   *  - id 재사용: 같은 id를 무조건 "같은 객체"로 보고 되살리므로
   *    (phase='active'), 트래커가 id를 재활용하면 이전 객체가 새 객체로
   *    둔갑한다. `${sensorId}:${trackId}:${generation}` 같은 네임스페이스가
   *    필요하다.
   *  - 다중 센서: 존이 다리마다 하나씩 둘인데 두 센서가 같은 사람을 보면
   *    트랙이 둘 생긴다. sensorId와 연관(association) 단계가 필요하다.
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
