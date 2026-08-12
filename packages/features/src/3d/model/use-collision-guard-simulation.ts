import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  nearestZone,
  useCollisionGuardStore,
  type CollisionGuardZone,
  type DetectedObjectType,
} from './use-collision-guard-store';

/**
 * LiDAR가 설치되기 전까지 감지 트랙을 만들어내는 시뮬레이션 소스.
 *
 * - 라이다는 거더 양쪽 다리에 1기씩 — 에이전트는 라운드로빈으로 배정된
 *   다리 존에 스폰되어 양쪽 커버리지에 고르게 출몰한다.
 * - 이동 경로는 두 모드를 섞는다. 통로형: 다리 옆 부두 통로를
 *   zone.travel(레일) 방향으로 통과 — 차량은 항상 이 모드(도로를 벗어나
 *   도크를 가로지르면 부자연스럽다). 방사형: 감지 원 둘레의 임의 방위에서
 *   진입해 반대편으로 가로지른다 — 사람·지게차 위주로, 객체가 사방에서
 *   나타나는 화면을 만든다(운영 피드백: 한 방향 흐름은 시뮬레이션 티가
 *   난다). 두 모드 모두 zone.obstacle 키프아웃 타원(주행축 기준) 회피
 *   조향이 다리 구조물 관통을 막아준다.
 * - 에이전트끼리도 서로를 회피한다(separateAgents): 접근하면 진로를 틀고,
 *   그래도 가까워지면 하드 가드로 밀어내 사람과 차량이 겹치거나 관통하는
 *   장면이 생기지 않는다. 스폰 시점에도 최소 간격을 확인한다.
 * - 거리 상수는 미터로 정의하고 zone.metersPerUnit으로 환산한다 — 씬마다
 *   좌표계 스케일이 달라도(okpo 11.7m/unit, philly 1.17m/unit) 동작이 같다.
 * - 이동 자체는 매 프레임 연속적으로 계산하고, store로의 발행(ingest)은
 *   SENSOR_HZ 주기로만 수행해 실제 LiDAR의 이산적인 관측 주기를 재현한다
 *   — 렌더러의 damping 보간이 이 간격을 메꾸는 것까지가 실전과 같다.
 * - 진입/이탈 판정은 존 합집합 기준: 어느 존이든 반경 안이면 ingest,
 *   모든 존에서 (반경 + 히스테리시스) 밖이면 markLeaving.
 * - R3F Canvas 안에서만 사용해야 한다.
 *
 * ---
 * 실물 LiDAR 연동 시 유의 (이 훅을 제거하기 전에 읽을 것)
 *
 * 이 훅은 "데이터 소스"만이 아니라 아래 네 가지 책임을 함께 지고 있다.
 * 훅을 지우면 네 가지가 같이 사라지므로, 브리지를 붙이기 전에 각각을
 * 어디서 담당할지 정해야 한다.
 *
 *  1. 좌표 프레이밍 — 에이전트는 처음부터 씬 world unit으로 태어난다
 *     (spawnAgent가 zone.center에서 출발). 실물은 센서 로컬 프레임이라
 *     축 변환 · 센서 외부 파라미터 · 크레인 실시간 포즈 합성 ·
 *     metersPerUnit 환산이 필요하다. 크레인이 레일을 주행하면 존 중심도
 *     움직이므로 이 변환은 매 프레임 갱신되어야 한다.
 *  2. 존 진입/이탈 판정 — 아래 센서 발행 루프의 nearestZone + 5m
 *     히스테리시스가 그 역할이다. 이건 시뮬레이션 로직이 아니라 가드
 *     로직이므로, 브리지도 같은 판정을 써야 경계에서 깜빡이지 않는다.
 *     공용 모듈로 빼는 것을 권한다.
 *  3. 트랙 수명 — markLeaving()을 호출하는 곳은 이 훅뿐이다. 실물
 *     트래커는 "사라졌다"는 이벤트 없이 그냥 보고를 멈추는 경우가 많으므로,
 *     타임스탬프 + 무보고 타임아웃 리퍼(reaper)가 반드시 필요하다.
 *  4. 타입 결정 — 스폰 시 1회 확정한다. 실물 인식은 신뢰도와 함께 오고
 *     추적 도중 재분류되므로 'unknown'과 confidence 필드가 필요하다.
 *
 * 그 외 필요한 것: 소켓 콜백에서 동기로 ingest하지 말고 드레인 버퍼를
 * 거칠 것(같은 저장소의 use-realtime-store / point-cloud-stream-store가
 * 이미 이 패턴을 쓴다), 두 센서가 같은 사람을 보는 경우의 연관 처리.
 *
 * 앱에는 이미 SOSLAB 센서 2기의 포인트클라우드 스트림 인프라가 있다
 * (apps/goliath-crane/.../point-cloud) — 재연결 백오프 · 센서 레지스트리 ·
 * STALE_SENSOR_MS · 좌표 변환 슬라이더가 거기 있으니 재사용할 것.
 * 다만 브라우저에서 포인트클라우드를 클러스터링해 트랙을 만들려 하지는
 * 말 것(파서가 6만 점 이상을 다운샘플링한다 — 표시용 손실 데이터다).
 * 클러스터링/분류는 엣지 노드가 하고, 브라우저는 트랙 토픽을 받는다.
 */

/** 센서 관측 발행 주기 (Hz) */
const SENSOR_HZ = 8;
const MAX_AGENTS = 4;
/** 다음 스폰까지 대기 시간 범위 (s) */
const SPAWN_DELAY_MIN = 1.5;
const SPAWN_DELAY_MAX = 4;
/**
 * 스폰/목표 지점의 반경 배율. 감지 링 바로 바깥에서 출발해야 몇 초 안에
 * 링 안으로 들어온다 — 1.6배로 멀리 잡았더니 사람 걸음으로 진입까지
 * 30초가 걸려 "객체가 안 나오는" 것처럼 보였다.
 */
const SPAWN_RADIUS_RATIO = 1.12;
/** 감지 경계에서의 이탈 히스테리시스 (m) — 경계에서 깜빡임 방지 */
const EXIT_HYSTERESIS_M = 5;
/** 통로(차선) 중심선의 구조물 경계로부터의 여유 (m) */
const LANE_CLEARANCE_M = 4;
/** 목표 도달로 간주하는 거리 (m) */
const GOAL_REACH_M = 5;
/** 통로를 비스듬히 가로지르는 목표점 드리프트 (m) */
const GOAL_DRIFT_M: Record<DetectedObjectType, number> = {
  person: 16,
  car: 3.5,
  forklift: 6,
};
/**
 * 에이전트 이동 속도 (m/s) — 구간이 겹치지 않게 현장 실측 기준으로 분리.
 * 사람 도보 ≈ 3~6km/h, 지게차 야드 제한속도 ≈ 8~15km/h, 차량 부두 도로
 * ≈ 18~30km/h. 화면에서 종류별 속도 차이가 한눈에 드러난다.
 */
const SPEED_RANGE: Record<DetectedObjectType, [number, number]> = {
  person: [0.9, 1.6],
  car: [5.0, 8.5],
  forklift: [2.2, 4.2],
};
/** 사행 진폭 — 차는 차선을 지키고 사람은 흔들리며 걷는다 */
const WANDER_AMPLITUDE: Record<DetectedObjectType, number> = {
  person: 0.3,
  car: 0.05,
  forklift: 0.1,
};
/** 키프아웃 타원 침범 전 조향을 시작하는 정규화 거리 */
const AVOID_STEER_START = 1.6;

/**
 * 타입별 방사형 스폰 확률 — 나머지는 통로형. 차량은 도로(통로)를 벗어나면
 * 부자연스러우므로 항상 통로형, 사람은 어디서든 걸어올 수 있으므로 대부분
 * 방사형, 지게차는 반반.
 */
const RADIAL_SPAWN_CHANCE: Record<DetectedObjectType, number> = {
  person: 0.8,
  car: 0,
  forklift: 0.5,
};
/**
 * 방사형 목표 방위 지터 (rad) — 진입점의 정반대에서 ±이 범위만큼 튼
 * 현(chord)을 걷는다. 0이면 모두 중심 관통 직선이 되어 위험 이벤트가
 * 과도해지고, 크면 둘레를 스치는 짧은 경로가 늘어난다.
 */
const RADIAL_EXIT_JITTER = 0.9;

/**
 * 에이전트 물리 반경 (m) — 서로 겹치면 안 되는 최소 풋프린트.
 * 두 에이전트 사이의 하드 최소 간격은 두 반경의 합이다.
 */
const AGENT_RADIUS_M: Record<DetectedObjectType, number> = {
  person: 0.6,
  car: 2.4,
  forklift: 1.6,
};
/**
 * 상호 회피를 시작하는 여유 거리 (m). 반경 합 + 이 값 안으로 들어오면
 * 서로 비켜서기 시작한다 — 실제 현장에서도 스치기 한참 전에 진로를
 * 바꾸므로, 이 값이 넉넉해야 "부딪힐 뻔한" 장면 자체가 안 생긴다.
 */
const SEPARATION_MARGIN_M = 7;
/** 상호 회피 조향 강도 (rad/s 계수) */
const SEPARATION_STEER_RATE = 3.5;
/**
 * 스폰 시 기존 에이전트와 확보해야 하는 최소 간격 (m). 스폰 지점이
 * 붐비면 태어나자마자 겹친 상태가 되므로 이 tick의 스폰을 건너뛴다.
 */
const SPAWN_SEPARATION_M = 14;

/**
 * 시뮬레이션 세션 카운터 — 훅이 마운트될 때마다 증가한다. 재마운트 시
 * 트랙 id가 이전 세션과 겹치지 않게 하는 용도(아래 sessionIdRef 참고).
 */
let simulationSessionCounter = 0;

interface SimAgent {
  id: string;
  type: DetectedObjectType;
  x: number;
  z: number;
  heading: number;
  /** m/s */
  speed: number;
  goalX: number;
  goalZ: number;
  /** 사행(蛇行) 위상 — 에이전트마다 다른 흔들림 */
  wanderPhase: number;
  age: number;
  tracked: boolean;
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function travelAxis(zone: CollisionGuardZone): [number, number] {
  return zone.travel ?? [1, 0];
}

function spawnAgent(zone: CollisionGuardZone, id: string): SimAgent {
  const roll = Math.random();
  const type: DetectedObjectType =
    roll < 0.45 ? 'person' : roll < 0.75 ? 'car' : 'forklift';
  const [cx, cz] = zone.center;
  const [tx, tz] = travelAxis(zone);
  // 주행축의 왼쪽 수직 벡터 — 차선 횡방향.
  const px = -tz;
  const pz = tx;
  const spawnRadius = zone.radius * SPAWN_RADIUS_RATIO;
  const toUnits = 1 / zone.metersPerUnit;
  const [speedMin, speedMax] = SPEED_RANGE[type];

  // --- 방사형: 원 둘레 임의 방위에서 진입해 반대편으로 가로지른다 ---
  if (Math.random() < RADIAL_SPAWN_CHANCE[type]) {
    const entry = rand(0, Math.PI * 2);
    const exit =
      entry + Math.PI + rand(-RADIAL_EXIT_JITTER, RADIAL_EXIT_JITTER);
    const x = cx + Math.cos(entry) * spawnRadius;
    const z = cz + Math.sin(entry) * spawnRadius;
    const goalX = cx + Math.cos(exit) * spawnRadius;
    const goalZ = cz + Math.sin(exit) * spawnRadius;
    return {
      id,
      type,
      x,
      z,
      heading: Math.atan2(goalZ - z, goalX - x),
      speed: rand(speedMin, speedMax),
      goalX,
      goalZ,
      wanderPhase: rand(0, Math.PI * 2),
      age: 0,
      tracked: false,
    };
  }

  // --- 통로형: 다리 옆 부두 통로를 travel(레일) 방향으로 통과 ---

  // 부두 통로 동선: 다리 옆을 주행(레일) 방향으로 통과한다. 통행 가능한
  // 차선 밴드(zone.laneBandsM — 도크/건물을 피한 통로)에서 차선을 고르되,
  // 구조물 여유(laneFloor)보다는 항상 바깥이어야 한다. 위험 반경보다
  // 안쪽 차선이면 다리를 스칠 때 danger 이벤트가 자연스럽게 발생한다.
  const laneFloor =
    (zone.obstacle?.halfAcross ?? 0) + LANE_CLEARANCE_M * toUnits;
  let bands: Array<[number, number]>;
  if (zone.laneBandsM?.length) {
    bands = zone.laneBandsM.map(
      ([a, b]) => [a * toUnits, b * toUnits] as [number, number],
    );
  } else {
    const laneMax = Math.max(laneFloor * 1.3, zone.radius * 0.8);
    bands = [
      [laneFloor, laneMax],
      [-laneMax, -laneFloor],
    ];
  }
  const band = bands[Math.floor(Math.random() * bands.length)];
  const bandLo = Math.min(band[0], band[1]);
  const bandHi = Math.max(band[0], band[1]);
  const clampToBand = (value: number) => {
    let lane = Math.min(Math.max(value, bandLo), bandHi);
    if (Math.abs(lane) < laneFloor) {
      lane = (lane < 0 || bandHi < 0 ? -1 : 1) * laneFloor;
    }
    return lane;
  };
  const laneOffset = clampToBand(rand(bandLo, bandHi));

  const dir = Math.random() < 0.5 ? -1 : 1;
  const x = cx + px * laneOffset - tx * dir * spawnRadius;
  const z = cz + pz * laneOffset - tz * dir * spawnRadius;

  // 사람은 통로를 비스듬히 가로지르기도 하고, 차량은 차선을 유지한다.
  // 목표 지점도 같은 밴드 안으로 clamp — 통로 밖(도크/건물)으로 새지 않는다.
  const driftMax = GOAL_DRIFT_M[type] * toUnits;
  const goalLane = clampToBand(laneOffset + rand(-driftMax, driftMax));
  const goalX = cx + px * goalLane + tx * dir * spawnRadius;
  const goalZ = cz + pz * goalLane + tz * dir * spawnRadius;

  return {
    id,
    type,
    x,
    z,
    heading: Math.atan2(goalZ - z, goalX - x),
    speed: rand(speedMin, speedMax),
    goalX,
    goalZ,
    wanderPhase: rand(0, Math.PI * 2),
    age: 0,
    tracked: false,
  };
}

/**
 * 다리 구조물 키프아웃 회피. 주행축 프레임의 타원 정규화 거리 d(경계=1)
 * 기준으로 d < AVOID_STEER_START면 바깥 방향으로 조향을 섞고, 경계를
 * 침범하면 위치를 경계로 밀어낸다 — 사행 드리프트가 있어도 구조물을
 * 뚫지 않는다.
 */
function avoidObstacles(
  agent: SimAgent,
  zones: CollisionGuardZone[],
  dt: number,
) {
  for (const zone of zones) {
    const obstacle = zone.obstacle;
    if (!obstacle) continue;

    const [tx, tz] = travelAxis(zone);
    const dx = agent.x - zone.center[0];
    const dz = agent.z - zone.center[1];
    // 주행축 프레임으로 회전: along = 주행 방향 성분, across = 횡방향 성분.
    const along = dx * tx + dz * tz;
    const across = -dx * tz + dz * tx;

    const na = along / obstacle.halfAlong;
    const nc = across / obstacle.halfAcross;
    const d = Math.hypot(na, nc);
    if (d >= AVOID_STEER_START || d < 1e-4) continue;

    // 바깥 방향(타원 거리의 증가 방향)을 월드 프레임으로 되돌려 조향.
    const ga = na / obstacle.halfAlong;
    const gc = nc / obstacle.halfAcross;
    const awayX = ga * tx - gc * tz;
    const awayZ = ga * tz + gc * tx;
    const awayHeading = Math.atan2(awayZ, awayX);
    let diff = awayHeading - agent.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const urgency = (AVOID_STEER_START - d) / (AVOID_STEER_START - 1);
    agent.heading += diff * Math.min(1, dt * 3.5 * Math.max(0, urgency));

    // 경계 침범 시 위치를 경계 밖으로 투영 (관통 방지 하드 가드).
    if (d < 1.02) {
      const push = 1.02 / d;
      const outAlong = na * push * obstacle.halfAlong;
      const outAcross = nc * push * obstacle.halfAcross;
      agent.x = zone.center[0] + outAlong * tx - outAcross * tz;
      agent.z = zone.center[1] + outAlong * tz + outAcross * tx;
    }
  }
}

/**
 * 에이전트 상호 분리 — 사람·차량·지게차가 서로 겹치거나 스쳐 지나가지
 * 않도록 한다. 구조물 회피(avoidObstacles)와 같은 원리를 에이전트 쌍에
 * 적용한다:
 *
 *  1. 조향: 반경 합 + 여유 안으로 접근하면 상대 반대편으로 진로를 튼다.
 *     가까울수록 급하게(urgency) — 멀리서 조금씩 비켜 자연스럽다.
 *  2. 하드 가드: 그럼에도 반경 합 안으로 들어오면 두 에이전트를 중점
 *     기준으로 밀어내 물리적 겹침을 원천 차단한다.
 *
 * 각 쌍을 한 번만 처리한다(j > i) — 양쪽에 대칭으로 적용하므로 두 번
 * 돌 필요가 없고, 순서에 따른 편향도 생기지 않는다.
 */
function separateAgents(
  agents: SimAgent[],
  metersPerUnit: number,
  dt: number,
) {
  const toUnits = 1 / metersPerUnit;

  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    for (let j = i + 1; j < agents.length; j++) {
      const b = agents[j];

      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1e-6) continue;

      const hardGap =
        (AGENT_RADIUS_M[a.type] + AGENT_RADIUS_M[b.type]) * toUnits;
      const steerGap = hardGap + SEPARATION_MARGIN_M * toUnits;
      if (dist >= steerGap) continue;

      // --- 1. 조향: 서로 반대편으로 진로를 튼다 ---
      const urgency = (steerGap - dist) / (steerGap - hardGap);
      const steer = Math.min(1, dt * SEPARATION_STEER_RATE * urgency);

      // a는 b의 반대 방향, b는 a의 반대 방향으로.
      const awayFromB = Math.atan2(-dz, -dx);
      let diffA = awayFromB - a.heading;
      diffA = Math.atan2(Math.sin(diffA), Math.cos(diffA));
      a.heading += diffA * steer;

      const awayFromA = Math.atan2(dz, dx);
      let diffB = awayFromA - b.heading;
      diffB = Math.atan2(Math.sin(diffB), Math.cos(diffB));
      b.heading += diffB * steer;

      // --- 2. 하드 가드: 겹침 방지 (중점 기준 대칭 분리) ---
      if (dist < hardGap) {
        const push = (hardGap - dist) / 2;
        const nx = dx / dist;
        const nz = dz / dist;
        a.x -= nx * push;
        a.z -= nz * push;
        b.x += nx * push;
        b.z += nz * push;
      }
    }
  }
}

export function useCollisionGuardSimulation(zones: CollisionGuardZone[]) {
  const enabled = useCollisionGuardStore((s) => s.enabled);

  const agentsRef = useRef<SimAgent[]>([]);
  const spawnTimerRef = useRef(0.3);
  const sensorAccumulatorRef = useRef(0);
  const idCounterRef = useRef(0);
  const elapsedRef = useRef(0);
  /**
   * 훅 인스턴스별 트랙 id 접두사.
   *
   * 카운터만 쓰면 재마운트 때 id가 sim-1부터 다시 시작해, 정리가 한 박자
   * 늦은 프레임에 이전 세션의 트랙과 id가 겹친다 — ingest()는 같은 id를
   * "기존 트랙"으로 보고 되살리므로(phase='active') 좀비가 새 객체의 탈을
   * 쓰고 남는다. 인스턴스마다 접두사를 달리해 id 공간을 분리한다.
   */
  const sessionIdRef = useRef(0);
  if (sessionIdRef.current === 0) {
    sessionIdRef.current = ++simulationSessionCounter;
  }

  /**
   * 언마운트 시 스토어 정리.
   *
   * 트랙은 모듈 싱글턴 스토어에 살고, 에이전트는 이 훅의 ref에 산다 —
   * 수명이 다르다. 다른 화면으로 이동하면 훅(과 useFrame)은 죽지만
   * 스토어의 트랙 배열은 그대로 남는다. 돌아와서 다시 켜면 그 트랙들이
   * 마운트되는데, 에이전트는 빈 배열로 새로 시작하므로 아무도
   * ingest()해 주지 않아 화면에 멈춰 선 채로 남고 그 옆에서 새 객체가
   * 스폰된다. useFrame 안의 정리 코드(!enabled 분기)는 프레임이 도는
   * 동안만 유효하므로 이 경우를 잡지 못한다 — 언마운트에서 정리한다.
   */
  useEffect(
    () => () => {
      agentsRef.current = [];
      useCollisionGuardStore.getState().clear();
    },
    [],
  );

  useFrame((_, delta) => {
    // 탭 비활성 복귀 등으로 delta가 튀면 에이전트가 순간이동하므로 clamp.
    const dt = Math.min(delta, 0.1);
    const store = useCollisionGuardStore.getState();

    if (!enabled || zones.length === 0) {
      // 에이전트가 이미 비었더라도 스토어에 트랙이 남아 있으면 지운다 —
      // 두 상태의 수명이 다르므로 agents 기준으로만 판단하면(이전 구현)
      // 소유자 없는 트랙이 화면에 멈춰 선 채로 남는다.
      if (agentsRef.current.length > 0) {
        agentsRef.current = [];
      }
      if (store.tracks.length > 0) {
        store.clear();
      }
      return;
    }

    elapsedRef.current += dt;
    const unitSpeedScale = 1 / zones[0].metersPerUnit;

    // --- 스폰: 라운드로빈으로 다리 존을 번갈아 배정 → 양쪽 고른 출몰 ---
    spawnTimerRef.current -= dt;
    if (spawnTimerRef.current <= 0 && agentsRef.current.length < MAX_AGENTS) {
      idCounterRef.current += 1;
      const zone = zones[idCounterRef.current % zones.length];
      const candidate = spawnAgent(
        zone,
        `sim-${sessionIdRef.current}-${idCounterRef.current}`,
      );

      // 스폰 지점이 붐비면 이번엔 건너뛴다 — 태어나자마자 겹친 상태로
      // 시작하면 분리 로직이 밀어내며 부자연스럽게 튄다.
      const minGap = SPAWN_SEPARATION_M / zone.metersPerUnit;
      const crowded = agentsRef.current.some(
        (other) =>
          Math.hypot(other.x - candidate.x, other.z - candidate.z) < minGap,
      );

      if (crowded) {
        // 다음 프레임에 다시 시도 — id는 이미 소비했으므로 중복되지 않는다.
        spawnTimerRef.current = 0.3;
      } else {
        agentsRef.current.push(candidate);
        spawnTimerRef.current = rand(SPAWN_DELAY_MIN, SPAWN_DELAY_MAX);
      }
    }

    // --- 이동 (매 프레임 연속) ---
    // 상호 회피 조향은 목표 조향 뒤·이동 앞에 둔다 — 이번 프레임의 조향이
    // 곧바로 이번 프레임의 이동에 반영되어야 비켜서는 동작이 즉각적이다.
    separateAgents(agentsRef.current, zones[0].metersPerUnit, dt);

    for (const agent of agentsRef.current) {
      agent.age += dt;

      const goalHeading = Math.atan2(agent.goalZ - agent.z, agent.goalX - agent.x);
      // 진행 방향을 목표 방향으로 서서히 수렴 + 사인파 사행으로 자연스러운 궤적.
      let diff = goalHeading - agent.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      agent.heading += diff * Math.min(1, dt * 2.5);
      agent.heading +=
        Math.sin(elapsedRef.current * 1.3 + agent.wanderPhase) *
        WANDER_AMPLITUDE[agent.type] *
        dt;

      // 다리 구조물 키프아웃 — 조향 + 관통 방지.
      avoidObstacles(agent, zones, dt);

      const step = agent.speed * unitSpeedScale * dt;
      agent.x += Math.cos(agent.heading) * step;
      agent.z += Math.sin(agent.heading) * step;
    }

    // 이동 후 겹침 최종 해소 — 목표 조향이 상호 회피를 이겨 서로를 향해
    // 파고든 경우에도 물리적 겹침만은 남지 않도록 위치를 분리한다.
    separateAgents(agentsRef.current, zones[0].metersPerUnit, dt);

    // --- 수명 종료 (목표 도달 or 타임아웃) ---
    const goalReach = GOAL_REACH_M * unitSpeedScale;
    agentsRef.current = agentsRef.current.filter((agent) => {
      const goalDist = Math.hypot(agent.goalX - agent.x, agent.goalZ - agent.z);
      const alive = goalDist > goalReach && agent.age < 180;
      if (!alive && agent.tracked) {
        store.markLeaving(agent.id);
      }
      return alive;
    });

    // --- 센서 발행 (SENSOR_HZ 주기의 이산 관측) ---
    sensorAccumulatorRef.current += dt;
    if (sensorAccumulatorRef.current < 1 / SENSOR_HZ) {
      return;
    }
    sensorAccumulatorRef.current = 0;

    const exitHysteresis = EXIT_HYSTERESIS_M * unitSpeedScale;
    for (const agent of agentsRef.current) {
      // 존 합집합 기준 진입/이탈 — 가장 가까운 센서가 커버 여부를 결정한다.
      const { zone, dist } = nearestZone(agent.x, agent.z, zones);

      if (dist <= zone.radius) {
        agent.tracked = true;
        store.ingest(
          agent.id,
          agent.type,
          agent.x,
          agent.z,
          agent.heading,
          agent.speed,
        );
      } else if (agent.tracked && dist > zone.radius + exitHysteresis) {
        agent.tracked = false;
        store.markLeaving(agent.id);
      }
    }
  });
}
