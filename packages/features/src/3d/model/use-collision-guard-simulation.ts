import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  useCollisionGuardStore,
  type CollisionGuardZone,
  type DetectedObjectType,
} from './use-collision-guard-store';

/**
 * LiDAR가 설치되기 전까지 감지 트랙을 만들어내는 시뮬레이션 소스.
 *
 * - 에이전트(사람/차량)는 감지 반경 밖에서 스폰되어 영역을 가로질러
 *   반대편으로 빠져나간다. 이동 자체는 매 프레임 연속적으로 계산하고,
 *   store로의 발행(ingest)은 SENSOR_HZ 주기로만 수행해 실제 LiDAR의
 *   이산적인 관측 주기를 재현한다 — 렌더러의 damping 보간이 이 간격을
 *   메꾸는 것까지가 실전과 같은 경로다.
 * - 실제 LiDAR 연동 시 이 훅만 제거하고 WebSocket 브리지가
 *   useCollisionGuardStore.ingest()를 호출하도록 바꾸면 된다.
 * - R3F Canvas 안에서만 사용해야 한다.
 */

/** 센서 관측 발행 주기 (Hz) */
const SENSOR_HZ = 8;
const MAX_AGENTS = 4;
/** 다음 스폰까지 대기 시간 범위 (s) */
const SPAWN_DELAY_MIN = 1.5;
const SPAWN_DELAY_MAX = 4;
/**
 * 스폰/목표 지점의 반경 배율. 감지 링 바로 바깥에서 출발해야 몇 초 안에
 * 링 안으로 들어온다 — 1.6배로 멀리 잡았더니 사람 걸음(≈0.12 unit/s)으로
 * 진입까지 30초가 걸려 "객체가 안 나오는" 것처럼 보였다.
 */
const SPAWN_RADIUS_RATIO = 1.12;
/** 감지 경계에서의 이탈 히스테리시스 (unit) — 경계에서 깜빡임 방지 */
const EXIT_HYSTERESIS = 0.4;
/** 에이전트 이동 속도 (m/s) */
const SPEED_RANGE: Record<DetectedObjectType, [number, number]> = {
  person: [1.2, 2.0],
  vehicle: [3.0, 6.0],
};

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

function spawnAgent(zone: CollisionGuardZone, id: string): SimAgent {
  const type: DetectedObjectType = Math.random() < 0.55 ? 'person' : 'vehicle';
  const [cx, cz] = zone.center;
  const spawnRadius = zone.radius * SPAWN_RADIUS_RATIO;

  // 원 밖 임의 지점에서 출발, 중심 근처를 지나는 현(chord)을 따라 반대편으로.
  const angle = rand(0, Math.PI * 2);
  const x = cx + Math.cos(angle) * spawnRadius;
  const z = cz + Math.sin(angle) * spawnRadius;

  // 목표: 출발점 대칭 지점 + 횡방향 오프셋. 오프셋이 작을수록 중심(위험
  // 반경)을 깊게 관통한다.
  const lateral = rand(-zone.radius, zone.radius) * 0.5;
  const perpAngle = angle + Math.PI / 2;
  const goalX = cx - Math.cos(angle) * spawnRadius + Math.cos(perpAngle) * lateral;
  const goalZ = cz - Math.sin(angle) * spawnRadius + Math.sin(perpAngle) * lateral;

  const [speedMin, speedMax] = SPEED_RANGE[type];

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

export function useCollisionGuardSimulation(zone: CollisionGuardZone) {
  const enabled = useCollisionGuardStore((s) => s.enabled);

  const agentsRef = useRef<SimAgent[]>([]);
  const spawnTimerRef = useRef(0.3);
  const sensorAccumulatorRef = useRef(0);
  const idCounterRef = useRef(0);
  const elapsedRef = useRef(0);

  useFrame((_, delta) => {
    // 탭 비활성 복귀 등으로 delta가 튀면 에이전트가 순간이동하므로 clamp.
    const dt = Math.min(delta, 0.1);
    const store = useCollisionGuardStore.getState();

    if (!enabled) {
      if (agentsRef.current.length > 0) {
        agentsRef.current = [];
        store.clear();
      }
      return;
    }

    elapsedRef.current += dt;
    const [cx, cz] = zone.center;
    const unitSpeedScale = 1 / zone.metersPerUnit;

    // --- 스폰 ---
    spawnTimerRef.current -= dt;
    if (spawnTimerRef.current <= 0 && agentsRef.current.length < MAX_AGENTS) {
      idCounterRef.current += 1;
      agentsRef.current.push(spawnAgent(zone, `sim-${idCounterRef.current}`));
      spawnTimerRef.current = rand(SPAWN_DELAY_MIN, SPAWN_DELAY_MAX);
    }

    // --- 이동 (매 프레임 연속) ---
    for (const agent of agentsRef.current) {
      agent.age += dt;

      const goalHeading = Math.atan2(agent.goalZ - agent.z, agent.goalX - agent.x);
      // 진행 방향을 목표 방향으로 서서히 수렴 + 사인파 사행으로 자연스러운 궤적.
      let diff = goalHeading - agent.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      agent.heading += diff * Math.min(1, dt * 2.5);
      agent.heading +=
        Math.sin(elapsedRef.current * 1.3 + agent.wanderPhase) * 0.25 * dt;

      const step = agent.speed * unitSpeedScale * dt;
      agent.x += Math.cos(agent.heading) * step;
      agent.z += Math.sin(agent.heading) * step;
    }

    // --- 수명 종료 (목표 도달 or 타임아웃) ---
    agentsRef.current = agentsRef.current.filter((agent) => {
      const goalDist = Math.hypot(agent.goalX - agent.x, agent.goalZ - agent.z);
      const alive = goalDist > 0.5 && agent.age < 180;
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

    for (const agent of agentsRef.current) {
      const dist = Math.hypot(agent.x - cx, agent.z - cz);

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
      } else if (agent.tracked && dist > zone.radius + EXIT_HYSTERESIS) {
        agent.tracked = false;
        store.markLeaving(agent.id);
      }
    }
  });
}
