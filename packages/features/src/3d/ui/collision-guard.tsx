import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DoubleSide, type MeshStandardMaterial, type Group } from 'three';
import {
  useCollisionGuardStore,
  type CollisionGuardZone,
  type DetectedTrack,
} from '../model/use-collision-guard-store';
import { useCollisionGuardSimulation } from '../model/use-collision-guard-simulation';

/**
 * 골리앗 크레인 주변 충돌 감지(안티콜리전) 시각화.
 *
 * 테슬라 FSD 시각화와 같은 원리로 동작한다:
 *  - 센서(현재는 시뮬레이션)는 ~8Hz의 이산 관측값을 track.target에 쓴다.
 *  - 렌더러는 매 프레임 지수 damping으로 target을 추적한다. 관측 사이의
 *    공백을 보간이 메꿔 이동이 연속적이고 부드럽게 보인다.
 *  - 감지 반경 진입 시 scale 오버슈트(easeOutBack) + opacity로 페이드인,
 *    이탈 시 페이드아웃 후 트랙을 제거한다.
 *  - 모든 프레임 갱신은 ref로 수집한 material/Object3D mutate로 수행 —
 *    React 리렌더 0회. material은 JSX로 선언해 R3F가 dispose를 관리한다.
 */

/** 위치/방향 damping 시상수 (s). 작을수록 즉각적, 클수록 미끄러지듯. */
const POSITION_SMOOTHING_TAU = 0.14;
const FADE_IN_DURATION = 0.4;
const FADE_OUT_DURATION = 0.45;

const COLOR_IDLE = new Color('#38bdf8');
const COLOR_WARNING = new Color('#f59e0b');
const COLOR_DANGER = new Color('#ef4444');

type Severity = 'idle' | 'warning' | 'danger';

/** easeOutBack — 진입 시 살짝 튀어오르는 테슬라풍 pop-in */
function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

function trackSeverity(track: DetectedTrack, zone: CollisionGuardZone): Severity {
  const dist = Math.hypot(
    track.target.x - zone.center[0],
    track.target.z - zone.center[1],
  );
  return dist <= zone.dangerRadius ? 'danger' : 'warning';
}

/** 감지 영역 링 + 위험 반경 링. 트랙 상태에 따라 색/펄스가 변한다. */
function DetectionZoneRing({ zone }: { zone: CollisionGuardZone }) {
  const outerRef = useRef<MeshStandardMaterial>(null);
  const fillRef = useRef<MeshStandardMaterial>(null);
  const targetColorRef = useRef(new Color().copy(COLOR_IDLE));

  useFrame((state, delta) => {
    const outer = outerRef.current;
    const fill = fillRef.current;
    if (!outer || !fill) return;

    const tracks = useCollisionGuardStore.getState().tracks;

    let severity: Severity = 'idle';
    for (const track of tracks) {
      if (track.phase !== 'active') continue;
      const s = trackSeverity(track, zone);
      if (s === 'danger') {
        severity = 'danger';
        break;
      }
      severity = 'warning';
    }

    targetColorRef.current.copy(
      severity === 'danger'
        ? COLOR_DANGER
        : severity === 'warning'
          ? COLOR_WARNING
          : COLOR_IDLE,
    );

    // 색상도 damping — 상태 전환 시 부드럽게 물든다.
    const k = 1 - Math.exp(-delta / 0.25);
    outer.color.lerp(targetColorRef.current, k);
    outer.emissive.lerp(targetColorRef.current, k);
    fill.color.lerp(targetColorRef.current, k);

    // danger일 때만 경계 펄스.
    const pulse =
      severity === 'danger'
        ? 0.55 + Math.sin(state.clock.elapsedTime * 5) * 0.25
        : 0.55;
    outer.opacity += (pulse - outer.opacity) * k;
  });

  const [cx, cz] = zone.center;
  const ringWidth = zone.radius * 0.02;

  return (
    <group position={[cx, zone.y + 0.03, cz]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh renderOrder={1}>
        <circleGeometry args={[zone.radius, 96]} />
        <meshStandardMaterial
          ref={fillRef}
          color={COLOR_IDLE}
          transparent
          opacity={0.05}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh renderOrder={2}>
        <ringGeometry args={[zone.radius - ringWidth, zone.radius, 96]} />
        <meshStandardMaterial
          ref={outerRef}
          color={COLOR_IDLE}
          emissive={COLOR_IDLE}
          emissiveIntensity={0.6}
          transparent
          opacity={0.55}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh renderOrder={2}>
        <ringGeometry
          args={[zone.dangerRadius - ringWidth * 0.7, zone.dangerRadius, 64]}
        />
        <meshStandardMaterial
          color={COLOR_DANGER}
          emissive={COLOR_DANGER}
          emissiveIntensity={0.4}
          transparent
          opacity={0.18}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

type MaterialRegistrar = (material: MeshStandardMaterial | null) => void;

/** 페이드 대상 material 공통 속성. 개별 mesh가 자기 material을 선언하고
 * registrar로 등록하면 부모가 매 프레임 opacity를 일괄 갱신한다. */
function BodyMaterial({
  register,
  dark = false,
}: {
  register: MaterialRegistrar;
  dark?: boolean;
}) {
  return dark ? (
    <meshStandardMaterial
      ref={register}
      color="#2f3a48"
      roughness={0.8}
      transparent
      opacity={0}
    />
  ) : (
    <meshStandardMaterial
      ref={register}
      color="#d8dde4"
      emissive="#94a3b8"
      emissiveIntensity={0.12}
      roughness={0.55}
      metalness={0.15}
      transparent
      opacity={0}
    />
  );
}

/** 미터 단위로 모델링된 사람 (총 높이 ~1.7m) */
function PersonMesh({ register }: { register: MaterialRegistrar }) {
  return (
    <group>
      <mesh position={[0, 0.85, 0]}>
        <capsuleGeometry args={[0.22, 0.9, 6, 16]} />
        <BodyMaterial register={register} />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.16, 16, 12]} />
        <BodyMaterial register={register} />
      </mesh>
      {/* 발밑 그림자 느낌의 받침 */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.32, 20]} />
        <BodyMaterial register={register} dark />
      </mesh>
    </group>
  );
}

/** 미터 단위로 모델링된 차량 (전장 ~4.2m, 진행 방향 +x) */
function VehicleMesh({ register }: { register: MaterialRegistrar }) {
  return (
    <group>
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[4.2, 0.9, 1.8]} />
        <BodyMaterial register={register} />
      </mesh>
      <mesh position={[-0.2, 1.45, 0]}>
        <boxGeometry args={[2.0, 0.6, 1.6]} />
        <BodyMaterial register={register} />
      </mesh>
      {[
        [1.4, 0.95],
        [1.4, -0.95],
        [-1.4, 0.95],
        [-1.4, -0.95],
      ].map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, 0.36, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.36, 0.36, 0.28, 20]} />
          <BodyMaterial register={register} dark />
        </mesh>
      ))}
    </group>
  );
}

function DetectedObjectMesh({
  track,
  zone,
}: {
  track: DetectedTrack;
  zone: CollisionGuardZone;
}) {
  const groupRef = useRef<Group>(null);
  const markerRef = useRef<MeshStandardMaterial>(null);
  const fadeMaterialsRef = useRef<MeshStandardMaterial[]>([]);
  const remove = useCollisionGuardStore((s) => s.remove);

  // ref callback으로 mount 시점에 호출된다(렌더 중 접근 아님). useCallback을
  // 쓰면 react-hooks/immutability가 useFrame에서의 material mutate를 hook
  // 인자 수정으로 판정하므로 일반 함수로 둔다.
  const registerFadeMaterial: MaterialRegistrar = (material) => {
    const list = fadeMaterialsRef.current;
    if (material && !list.includes(material)) {
      list.push(material);
    }
  };

  // 렌더러가 소유하는 보간 상태. target(센서값)과 분리되어 있다.
  const smoothRef = useRef({
    x: track.target.x,
    z: track.target.z,
    heading: track.target.heading,
    fade: 0,
  });

  const worldScale = zone.sizeMultiplier / zone.metersPerUnit;
  const markerRadius = track.type === 'vehicle' ? 2.8 : 1.2;

  useFrame((_, delta) => {
    const group = groupRef.current;
    const marker = markerRef.current;
    if (!group || !marker) return;

    const smooth = smoothRef.current;
    const dt = Math.min(delta, 0.1);

    // --- 페이드 상태 머신 ---
    if (track.phase === 'leaving') {
      smooth.fade -= dt / FADE_OUT_DURATION;
      if (smooth.fade <= 0) {
        remove(track.id);
        return;
      }
    } else {
      smooth.fade = Math.min(1, smooth.fade + dt / FADE_IN_DURATION);
    }

    // --- 위치/방향 damping (테슬라식 스무딩의 핵심) ---
    const k = 1 - Math.exp(-dt / POSITION_SMOOTHING_TAU);
    smooth.x += (track.target.x - smooth.x) * k;
    smooth.z += (track.target.z - smooth.z) * k;

    let headingDiff = track.target.heading - smooth.heading;
    headingDiff = Math.atan2(Math.sin(headingDiff), Math.cos(headingDiff));
    smooth.heading += headingDiff * k;

    group.position.set(smooth.x, zone.y, smooth.z);
    group.rotation.y = -smooth.heading;

    // 진입 시 easeOutBack 오버슈트, 이탈 시 선형 축소.
    const scaleEase =
      track.phase === 'leaving' ? smooth.fade : easeOutBack(smooth.fade);
    const s = worldScale * Math.max(0.001, scaleEase);
    group.scale.set(s, s, s);

    // --- 불투명도 + 위험도 색상 ---
    const opacity = smooth.fade;
    for (const material of fadeMaterialsRef.current) {
      material.opacity = opacity;
      material.depthWrite = opacity >= 0.99;
    }
    marker.opacity = opacity * 0.85;

    const severityColor =
      trackSeverity(track, zone) === 'danger' ? COLOR_DANGER : COLOR_WARNING;
    marker.color.lerp(severityColor, k);
    marker.emissive.lerp(severityColor, k);
  });

  return (
    <group
      ref={groupRef}
      position={[track.target.x, zone.y, track.target.z]}
      scale={[0.001, 0.001, 0.001]}
    >
      {/* 지면 세버리티 마커 링 */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <ringGeometry args={[markerRadius * 0.82, markerRadius, 48]} />
        <meshStandardMaterial
          ref={markerRef}
          color={COLOR_WARNING}
          emissive={COLOR_WARNING}
          emissiveIntensity={0.7}
          transparent
          opacity={0}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {track.type === 'vehicle' ? (
        <VehicleMesh register={registerFadeMaterial} />
      ) : (
        <PersonMesh register={registerFadeMaterial} />
      )}
    </group>
  );
}

interface CollisionGuardProps {
  zone: CollisionGuardZone;
}

/**
 * R3F Canvas 안에서 마운트하는 충돌 감지 레이어.
 * Monitoring3dView의 sceneExtras 슬롯으로 주입한다.
 */
export function CollisionGuard({ zone }: CollisionGuardProps) {
  useCollisionGuardSimulation(zone);

  const enabled = useCollisionGuardStore((s) => s.enabled);
  const tracks = useCollisionGuardStore((s) => s.tracks);

  if (!enabled) {
    return null;
  }

  return (
    <>
      <DetectionZoneRing zone={zone} />
      {tracks.map((track) => (
        <DetectedObjectMesh key={track.id} track={track} zone={zone} />
      ))}
    </>
  );
}
