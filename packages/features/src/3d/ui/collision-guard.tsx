import { Suspense, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Color,
  DoubleSide,
  Shape,
  type Mesh,
  type MeshStandardMaterial,
  type Group,
} from 'three';
import {
  distanceFromZoneCenter,
  nearestZone,
  trackSeverity,
  useCollisionGuardStore,
  type CollisionGuardZone,
  type DetectedObjectType,
  type DetectedTrack,
} from '../model/use-collision-guard-store';
import { useCollisionGuardSimulation } from '../model/use-collision-guard-simulation';
import { usePrefersReducedMotion } from '../model/use-prefers-reduced-motion';
import {
  CUT_DISABLED,
  MATERIALIZE_IN_DURATION,
  MATERIALIZE_OUT_DURATION,
  SCAN_BAND_RATIO,
  applyMaterialize,
  createMaterializeUniforms,
  type MaterializeUniforms,
} from '../lib/materialize-material';
import { TrackLabel, type TrackLabelRefs } from './collision-guard-label';
import { CollisionGuardFocusDim } from './collision-guard-focus-dim';
import { DetectedObjectModel } from './collision-guard-object-model';

/**
 * 골리앗 크레인 주변 충돌 감지(안티콜리전) 시각화.
 *
 * 테슬라 FSD 시각화와 같은 원리로 동작한다:
 *  - 센서(현재는 시뮬레이션)는 ~8Hz의 이산 관측값을 track.target에 쓴다.
 *  - 렌더러는 매 프레임 지수 damping으로 target을 추적한다. 관측 사이의
 *    공백을 보간이 메꿔 이동이 연속적이고 부드럽게 보인다.
 *  - 감지 반경 진입 시 LiDAR 머티리얼라이즈 스윕(컷 플레인이 아래→위로
 *    스캔하며 실체화) + scale 오버슈트(easeOutBack), 이탈 시 역스캔으로
 *    해체 후 트랙을 제거한다. prefers-reduced-motion이면 단순 페이드.
 *  - 모든 프레임 갱신은 ref로 수집한 material/Object3D mutate로 수행 —
 *    React 리렌더 0회. material은 JSX로 선언해 R3F가 dispose를 관리한다.
 */

/** 위치/방향 damping 시상수 (s). 작을수록 즉각적, 클수록 미끄러지듯. */
const POSITION_SMOOTHING_TAU = 0.14;
/** 스케일 팝인/아웃 타이밍 — 머티리얼라이즈 스윕과 병렬로 돈다. */
const FADE_IN_DURATION = 0.4;
const FADE_OUT_DURATION = 0.45;
/** 라벨 텍스트 갱신 주기 — 센서 tick(8Hz)과 맞춘다. */
const LABEL_UPDATE_HZ = 8;

const COLOR_IDLE = new Color('#38bdf8');
const COLOR_WARNING = new Color('#f59e0b');
const COLOR_DANGER = new Color('#ef4444');
/**
 * 카메라 근거리 커버 링 — 센서 종류 구분용 정적 색.
 * amber를 쓰면 warning 세버리티와 색 의미가 충돌하므로 보라 계열로 분리.
 */
const COLOR_CAMERA = new Color('#a78bfa');

/**
 * 속도 벡터 화살표 — 단위 길이(+X 방향) 플랫 화살표. 그룹이 heading으로
 * 회전하고 scale.x를 속도 비례 길이로 늘려 쓴다.
 */
const VELOCITY_ARROW_SHAPE = (() => {
  const shape = new Shape();
  shape.moveTo(0, -0.14);
  shape.lineTo(0.62, -0.14);
  shape.lineTo(0.62, -0.32);
  shape.lineTo(1, 0);
  shape.lineTo(0.62, 0.32);
  shape.lineTo(0.62, 0.14);
  shape.lineTo(0, 0.14);
  shape.closePath();
  return shape;
})();
/** 화살표 길이 = 속도(m/s) × 룩어헤드(s), [최소, 최대] 클램프 (m) */
const ARROW_LOOKAHEAD_S = 1.4;
const ARROW_LENGTH_RANGE_M: [number, number] = [1.4, 8];
/** 화살표 시작점(객체 앞코) X 오프셋 (로컬 m) */
const ARROW_NOSE_OFFSET: Record<DetectedObjectType, number> = {
  person: 0.5,
  car: 2.5,
  forklift: 1.7,
};
/** 평시 림 글로우 — 세버리티 danger 시 red로 물든다. */
const COLOR_RIM_IDLE = new Color('#7dd3fc');
const RIM_STRENGTH_IDLE = 0.55;
const RIM_STRENGTH_DANGER = 0.9;

/** 머티리얼라이즈 컷 기준 객체 높이 (로컬 미터, 라벨 부착에도 사용) */
const OBJECT_HEIGHT: Record<DetectedObjectType, number> = {
  person: 1.8,
  car: 1.6,
  forklift: 2.2,
};
const LABEL_HEIGHT_OFFSET = 0.45;

/**
 * 지면 마커 링 크기/두께 (로컬 미터). 사람은 실루엣이 점 수준으로
 * 작아지는 탑뷰에서 가장 위험한 객체이므로 마커를 차량급으로 키우고
 * 링도 더 두껍게 그린다.
 */
const MARKER_RADIUS: Record<DetectedObjectType, number> = {
  person: 2.4,
  car: 2.8,
  forklift: 2.6,
};
const MARKER_INNER_RATIO: Record<DetectedObjectType, number> = {
  person: 0.72,
  car: 0.82,
  forklift: 0.78,
};
/**
 * 마커 화면 최소 크기 보장 — 이 거리보다 멀어지면 카메라 거리에 비례해
 * 마커를 확대해 화면상 크기를 유지한다 (에고 탑뷰 높이 130 기준).
 */
const MARKER_REF_DISTANCE = 130;

type Severity = 'idle' | 'warning' | 'danger';

/** easeOutBack — 진입 시 살짝 튀어오르는 테슬라풍 pop-in */
function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * 감지 영역 링(라이다 커버) + 위험 반경 링 + 카메라 근거리 링.
 * 트랙 상태에 따라 색/펄스가 변한다 — 이 링(센서)의 커버 범위 안에 있는
 * 트랙만 반영하므로, 다리별 링이 각자 담당 구역의 상태를 보여준다.
 *
 * 절제 원칙: 평시에 보이는 원은 감지 링 하나뿐이다. 위험 반경 링은
 * "설정"이 아니라 "상태"로 취급해 객체가 커버 안에 들어왔을 때만
 * 페이드인하고, 카메라 근거리 링은 기본 숨김(showCameraCoverage 토글).
 */
function DetectionZoneRing({
  zone,
  showCameraCoverage = false,
}: {
  zone: CollisionGuardZone;
  showCameraCoverage?: boolean;
}) {
  const outerRef = useRef<MeshStandardMaterial>(null);
  const fillRef = useRef<MeshStandardMaterial>(null);
  const dangerRef = useRef<MeshStandardMaterial>(null);
  const targetColorRef = useRef(new Color().copy(COLOR_IDLE));

  useFrame((state, delta) => {
    const outer = outerRef.current;
    const fill = fillRef.current;
    if (!outer || !fill) return;

    const tracks = useCollisionGuardStore.getState().tracks;

    let severity: Severity = 'idle';
    for (const track of tracks) {
      if (track.phase !== 'active') continue;
      const dist = distanceFromZoneCenter(track.target.x, track.target.z, zone);
      if (dist > zone.radius) continue;
      if (dist <= zone.dangerRadius) {
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

    // 위험 반경 링은 상태 표시 — 커버 안에 객체가 있을 때만 나타난다.
    const danger = dangerRef.current;
    if (danger) {
      const dangerTarget =
        severity === 'danger' ? 0.34 : severity === 'warning' ? 0.2 : 0;
      danger.opacity += (dangerTarget - danger.opacity) * k;
    }
  });

  const [cx, cz] = zone.center;
  const ringWidth = zone.radius * 0.02;
  // 지면 z-fighting 방지 리프트 — 좌표계 스케일이 달라도 비율로 유지.
  const groundLift = Math.max(0.03, zone.radius * 0.005);

  return (
    <group position={[cx, zone.y + groundLift, cz]} rotation={[-Math.PI / 2, 0, 0]}>
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
          ref={dangerRef}
          color={COLOR_DANGER}
          emissive={COLOR_DANGER}
          emissiveIntensity={0.4}
          transparent
          opacity={0}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* 카메라 근거리 음영 커버 — 기본 숨김, 범례/설정 토글로만 표시 */}
      {showCameraCoverage && zone.cameraRadius ? (
        <>
          <mesh renderOrder={1}>
            <circleGeometry args={[zone.cameraRadius, 64]} />
            <meshStandardMaterial
              color={COLOR_CAMERA}
              transparent
              opacity={0.05}
              side={DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <mesh renderOrder={2}>
            <ringGeometry
              args={[zone.cameraRadius - ringWidth * 0.6, zone.cameraRadius, 64]}
            />
            <meshStandardMaterial
              color={COLOR_CAMERA}
              emissive={COLOR_CAMERA}
              emissiveIntensity={0.3}
              transparent
              opacity={0.28}
              side={DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </>
      ) : null}
    </group>
  );
}

type MaterialRegistrar = (material: MeshStandardMaterial | null) => void;

function DetectedObjectMesh({
  track,
  zones,
}: {
  track: DetectedTrack;
  zones: CollisionGuardZone[];
}) {
  const groupRef = useRef<Group>(null);
  const markerRef = useRef<MeshStandardMaterial>(null);
  const markerMeshRef = useRef<Mesh>(null);
  const arrowGroupRef = useRef<Group>(null);
  const arrowMatRef = useRef<MeshStandardMaterial>(null);
  const fadeMaterialsRef = useRef<MeshStandardMaterial[]>([]);
  const labelRefsRef = useRef<TrackLabelRefs | null>(null);
  const uniformsRef = useRef<MaterializeUniforms | null>(null);
  if (uniformsRef.current == null) {
    uniformsRef.current = createMaterializeUniforms();
  }
  const remove = useCollisionGuardStore((s) => s.remove);
  const reducedMotion = usePrefersReducedMotion();
  // 위험 태그(Html)는 danger일 때만 마운트 — drei Html은 마운트만 돼 있어도
  // 매 프레임 DOM 갱신 비용이 들므로 평시엔 아예 제거한다.
  const [labelActive, setLabelActive] = useState(false);

  // ref callback으로 mount 시점에 호출된다(렌더 중 접근 아님). useCallback을
  // 쓰면 react-hooks/immutability가 useFrame에서의 material mutate를 hook
  // 인자 수정으로 판정하므로 일반 함수로 둔다.
  const registerFadeMaterial: MaterialRegistrar = (material) => {
    const list = fadeMaterialsRef.current;
    if (material && !list.includes(material)) {
      applyMaterialize(material, uniformsRef.current!);
      list.push(material);
    }
  };

  const registerLabel = (refs: TrackLabelRefs | null) => {
    labelRefsRef.current = refs;
  };

  // 렌더러가 소유하는 보간 상태. target(센서값)과 분리되어 있다.
  const smoothRef = useRef({
    x: track.target.x,
    z: track.target.z,
    heading: track.target.heading,
    /** 스케일 팝인 진행도 (0.4s in / 0.45s out) */
    fade: 0,
    /** 머티리얼라이즈 스윕 진행도 (0.6s in / 0.45s out) */
    sweep: 0,
    /** 위험 거리 태그 가시성 (danger일 때만 1로 수렴) */
    labelVis: 0,
    labelClock: 0,
  });

  // 스케일/지면 높이 설정은 전체 존 공통이므로 첫 존의 값을 쓴다.
  const baseZone = zones[0];
  const worldScale = baseZone.sizeMultiplier / baseZone.metersPerUnit;
  const markerRadius = MARKER_RADIUS[track.type];
  const markerInnerRatio = MARKER_INNER_RATIO[track.type];
  const objectHeight = OBJECT_HEIGHT[track.type];

  useFrame((state, delta) => {
    const group = groupRef.current;
    const marker = markerRef.current;
    if (!group || !marker) return;

    const smooth = smoothRef.current;
    const dt = Math.min(delta, 0.1);

    // --- 페이드/스윕 상태 머신 ---
    if (track.phase === 'leaving') {
      smooth.fade = Math.max(0, smooth.fade - dt / FADE_OUT_DURATION);
      smooth.sweep -= dt / MATERIALIZE_OUT_DURATION;
      if (smooth.sweep <= 0) {
        remove(track.id);
        return;
      }
    } else {
      smooth.fade = Math.min(1, smooth.fade + dt / FADE_IN_DURATION);
      smooth.sweep = Math.min(1, smooth.sweep + dt / MATERIALIZE_IN_DURATION);
    }

    // --- 위치/방향 damping (테슬라식 스무딩의 핵심) ---
    const k = 1 - Math.exp(-dt / POSITION_SMOOTHING_TAU);
    smooth.x += (track.target.x - smooth.x) * k;
    smooth.z += (track.target.z - smooth.z) * k;

    let headingDiff = track.target.heading - smooth.heading;
    headingDiff = Math.atan2(Math.sin(headingDiff), Math.cos(headingDiff));
    smooth.heading += headingDiff * k;

    group.position.set(smooth.x, baseZone.y, smooth.z);
    group.rotation.y = -smooth.heading;

    // 진입 시 easeOutBack 오버슈트, 이탈 시 선형 축소.
    // reduced-motion이면 오버슈트 없이 선형.
    const scaleEase =
      track.phase === 'leaving' || reducedMotion
        ? smooth.fade
        : easeOutBack(smooth.fade);
    const s = worldScale * Math.max(0.001, scaleEase);
    group.scale.set(s, s, s);

    // --- 불투명도: 스윕보다 빠르게 램프 → depthWrite 조기 활성화로
    // 반투명 내부면 비침을 최소화한다. reduced-motion이면 순수 페이드.
    const opacity = reducedMotion
      ? smooth.fade
      : Math.min(1, Math.max(0, smooth.sweep) * 2.5);
    for (const material of fadeMaterialsRef.current) {
      material.opacity = opacity;
      material.depthWrite = opacity >= 0.99;
    }
    marker.opacity = opacity * 0.85;

    // --- 머티리얼라이즈 컷 플레인 ---
    // 컷은 객체 높이 + 밴드 두께만큼 이동해 스캔 밴드가 머리 위로
    // 완전히 빠져나간 뒤 비활성화된다 (완료 시 팝 없음).
    const uniforms = uniformsRef.current!;
    if (reducedMotion || smooth.sweep >= 1) {
      uniforms.uCutY.value = CUT_DISABLED;
    } else {
      const travel = objectHeight * (1 + SCAN_BAND_RATIO + 0.05) * s;
      const eased = easeInOutCubic(Math.max(0, smooth.sweep));
      uniforms.uCutY.value = baseZone.y + eased * travel;
      uniforms.uBand.value = SCAN_BAND_RATIO * objectHeight * s;
    }

    // --- 위험도 색상: 마커 + 속도 벡터 + 림 글로우 (가장 가까운 센서 존 기준) ---
    const severity = trackSeverity(track, zones);
    const severityColor = severity === 'danger' ? COLOR_DANGER : COLOR_WARNING;
    marker.color.lerp(severityColor, k);
    marker.emissive.lerp(severityColor, k);

    // 마커 화면 최소 크기 보장 — 기준 거리보다 멀어지면 비례 확대.
    const markerMesh = markerMeshRef.current;
    if (markerMesh) {
      const camDistance = state.camera.position.distanceTo(group.position);
      const compensation = Math.max(1, camDistance / MARKER_REF_DISTANCE);
      markerMesh.scale.setScalar(compensation);
    }

    // 속도 벡터: 길이 = 속도 × 룩어헤드. 그룹 회전(heading)을 따라간다.
    const arrowGroup = arrowGroupRef.current;
    const arrowMat = arrowMatRef.current;
    if (arrowGroup && arrowMat) {
      const lengthM = Math.min(
        ARROW_LENGTH_RANGE_M[1],
        Math.max(ARROW_LENGTH_RANGE_M[0], track.target.speed * ARROW_LOOKAHEAD_S),
      );
      arrowGroup.scale.set(lengthM, 1, 1);
      arrowMat.opacity = opacity * 0.85;
      arrowMat.color.lerp(severityColor, k);
      arrowMat.emissive.lerp(severityColor, k);
    }

    const rimColor = severity === 'danger' ? COLOR_DANGER : COLOR_RIM_IDLE;
    const rimStrength =
      severity === 'danger' ? RIM_STRENGTH_DANGER : RIM_STRENGTH_IDLE;
    uniforms.uRimColor.value.lerp(rimColor, k);
    uniforms.uRimStrength.value +=
      (rimStrength - uniforms.uRimStrength.value) * k;

    // --- 위험 거리 태그: danger일 때만 마운트 + 페이드인 (평시엔 객체를
    // 가리지 않도록 숨김 — 거리/종류/속도는 HUD 패널이 담당) ---
    const wantLabel = severity === 'danger' && track.phase === 'active';
    const labelTarget = wantLabel ? 1 : 0;
    smooth.labelVis += (labelTarget - smooth.labelVis) * Math.min(1, dt / 0.2);

    if (wantLabel && !labelActive) {
      setLabelActive(true);
    } else if (!wantLabel && labelActive && smooth.labelVis < 0.02) {
      // 페이드아웃이 끝난 뒤 언마운트 — 갑자기 사라지지 않는다.
      setLabelActive(false);
    }

    const label = labelRefsRef.current;
    if (label) {
      label.root.style.opacity = String(smooth.fade * smooth.labelVis);

      smooth.labelClock += dt;
      if (smooth.labelVis > 0.01 && smooth.labelClock >= 1 / LABEL_UPDATE_HZ) {
        smooth.labelClock = 0;
        const meters = Math.round(
          nearestZone(smooth.x, smooth.z, zones).dist * baseZone.metersPerUnit,
        );
        label.distance.textContent = `${meters} m`;
      }
    }
  });

  return (
    <group
      ref={groupRef}
      position={[track.target.x, baseZone.y, track.target.z]}
      scale={[0.001, 0.001, 0.001]}
    >
      {/* 지면 세버리티 마커 링 */}
      <mesh
        ref={markerMeshRef}
        position={[0, 0.04, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={3}
      >
        <ringGeometry args={[markerRadius * markerInnerRatio, markerRadius, 48]} />
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
      {/* 속도 벡터 화살표 — 진행 방향(+X)으로 속도 비례 길이 */}
      <group
        ref={arrowGroupRef}
        position={[ARROW_NOSE_OFFSET[track.type], 0.06, 0]}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
          <shapeGeometry args={[VELOCITY_ARROW_SHAPE]} />
          <meshStandardMaterial
            ref={arrowMatRef}
            color={COLOR_WARNING}
            emissive={COLOR_WARNING}
            emissiveIntensity={0.8}
            transparent
            opacity={0}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
      {/* GLB 모델 로드 동안 다른 씬 요소가 매달리지 않도록 자체 Suspense */}
      <Suspense fallback={null}>
        <DetectedObjectModel
          type={track.type}
          register={registerFadeMaterial}
          // 걷기 클립(기준 보행 ≈1.4m/s)을 실제 이동 속도에 동기화 —
          // 트랙 속도는 스폰 시 고정이므로 mount 시점 값이면 충분하다.
          animationTimeScale={
            track.type === 'person' ? track.target.speed / 1.4 : 1
          }
        />
      </Suspense>
      {labelActive ? (
        <TrackLabel
          height={objectHeight + LABEL_HEIGHT_OFFSET}
          register={registerLabel}
        />
      ) : null}
    </group>
  );
}

interface CollisionGuardProps {
  /** 센서(라이다) 설치 지점별 감지 존 — 거더 양쪽 다리에 1개씩 */
  zones: CollisionGuardZone[];
  /** 카메라 근거리 커버 링 표시 (기본 숨김 — 설정/범례용) */
  showCameraCoverage?: boolean;
}

/**
 * R3F Canvas 안에서 마운트하는 충돌 감지 레이어.
 * Monitoring3dView의 sceneExtras 슬롯으로 주입한다.
 */
export function CollisionGuard({
  zones,
  showCameraCoverage = false,
}: CollisionGuardProps) {
  useCollisionGuardSimulation(zones);

  const enabled = useCollisionGuardStore((s) => s.enabled);
  const tracks = useCollisionGuardStore((s) => s.tracks);

  return (
    <>
      {/* 디밍은 enabled 여부와 무관하게 마운트 — OFF 전환 시에도 부드럽게 복원 */}
      <CollisionGuardFocusDim />
      {enabled && zones.length > 0 ? (
        <>
          {zones.map((zone) => (
            <DetectionZoneRing
              key={`${zone.center[0]}:${zone.center[1]}`}
              zone={zone}
              showCameraCoverage={showCameraCoverage}
            />
          ))}
          {tracks.map((track) => (
            <DetectedObjectMesh key={track.id} track={track} zones={zones} />
          ))}
        </>
      ) : null}
    </>
  );
}
