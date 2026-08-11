import { Suspense, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import {
  Color,
  DoubleSide,
  Shape,
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
 * 진행 방향 화살표 — 단위 길이(+X 방향) 플랫 화살표. 그룹이 heading으로
 * 회전하고 scale.x로 고정 길이(ARROW_LENGTH_M)를 편다.
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
/**
 * 화살표 길이 (m) — 전 객체 동일 고정 길이. 속도는 라벨/HUD의 수치가
 * 담당하고, 화살표는 진행 "방향"만 전달한다 (길이가 제각각이면 탑뷰에서
 * 시선이 분산된다는 운영 피드백).
 */
const ARROW_LENGTH_M = 4;
/** 화살표 시작점(객체 앞코) X 오프셋 (로컬 m) */
const ARROW_NOSE_OFFSET: Record<DetectedObjectType, number> = {
  person: 0.5,
  car: 2.5,
  forklift: 1.7,
};
/**
 * 림 글로우 강도 — 몸체는 무채색을 유지하고 림이 세버리티 색(주의 amber,
 * 위험 red)을 입힌다. 감지된 트랙은 정의상 최소 warning이므로 "idle 림"은
 * 없다 — 커버 안의 모든 객체가 자기 레벨 색으로 읽혀야 한다.
 */
const RIM_STRENGTH_WARNING = 0.7;
const RIM_STRENGTH_DANGER = 0.9;

/** 머티리얼라이즈 컷 기준 객체 높이 (로컬 미터, 라벨 부착에도 사용) */
const OBJECT_HEIGHT: Record<DetectedObjectType, number> = {
  person: 1.8,
  car: 1.6,
  forklift: 2.2,
};
const LABEL_HEIGHT_OFFSET = 0.45;

type Severity = 'idle' | 'warning' | 'danger';

/** 라벨 배경색 — 씬 세버리티 색과 동일 계열 (amber-500 / red-500) */
const LABEL_BG: Record<'warning' | 'danger', string> = {
  warning: 'rgba(245, 158, 11, 0.92)',
  danger: 'rgba(239, 68, 68, 0.92)',
};

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
 *
 * 색 역할 분담: 감지 링은 "센서 커버 범위"라는 정적 사실이므로 항상
 * sky를 유지한다 — 상태에 따라 물들이면 링 두 개가 동시에 색을 바꿔
 * 어느 원이 무엇인지 읽기 어려워진다(운영 피드백). 상태 전달은 위험
 * 반경 링(등장/펄스)과 객체 마커·라벨의 몫이다.
 *
 * 절제 원칙: 평시에 보이는 원은 감지 링 하나뿐이다. 위험 반경 링은
 * "설정"이 아니라 "상태"로 취급해 객체가 커버 안에 들어왔을 때만
 * 감지 링과 같은 불투명도로 페이드인하고(두 원의 선명도가 다르면
 * 하나가 흐릿한 잔상처럼 보인다), 카메라 근거리 링은 기본 숨김.
 */
function DetectionZoneRing({
  zone,
  showCameraCoverage = false,
}: {
  zone: CollisionGuardZone;
  showCameraCoverage?: boolean;
}) {
  const dangerRef = useRef<MeshStandardMaterial>(null);

  useFrame((state, delta) => {
    const danger = dangerRef.current;
    if (!danger) return;

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

    // 위험 반경 링 — 커버 안에 객체가 있을 때만, 감지 링과 같은 0.55로.
    // danger에서는 펄스로 긴급함을 전달한다.
    const k = 1 - Math.exp(-delta / 0.25);
    const dangerTarget =
      severity === 'danger'
        ? 0.55 + Math.sin(state.clock.elapsedTime * 5) * 0.2
        : severity === 'warning'
          ? 0.55
          : 0;
    danger.opacity += (dangerTarget - danger.opacity) * k;
  });

  const [cx, cz] = zone.center;
  const ringWidth = zone.radius * 0.02;
  // 지면 z-fighting 방지 리프트 — 좌표계 스케일이 달라도 비율로 유지.
  const groundLift = Math.max(0.03, zone.radius * 0.005);

  return (
    <group position={[cx, zone.y + groundLift, cz]}>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh renderOrder={1}>
          <circleGeometry args={[zone.radius, 96]} />
          <meshStandardMaterial
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
                args={[
                  zone.cameraRadius - ringWidth * 0.6,
                  zone.cameraRadius,
                  64,
                ]}
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
      {/* 센서(다리) 식별 배지 — 감지 링 중심 = 라이다 설치 지점 */}
      {zone.label ? (
        <Html
          center
          position={[0, 0.5, 0]}
          zIndexRange={[4, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="rounded border border-sky-400/50 bg-sky-950/70 px-1.5 py-0.5 font-mono text-[10px] leading-none font-bold whitespace-nowrap text-sky-300">
            {zone.label}
          </div>
        </Html>
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
  const arrowMatRef = useRef<MeshStandardMaterial>(null);
  const fadeMaterialsRef = useRef<MeshStandardMaterial[]>([]);
  const labelRefsRef = useRef<TrackLabelRefs | null>(null);
  const uniformsRef = useRef<MaterializeUniforms | null>(null);
  if (uniformsRef.current == null) {
    uniformsRef.current = createMaterializeUniforms();
  }
  const remove = useCollisionGuardStore((s) => s.remove);
  const reducedMotion = usePrefersReducedMotion();
  // 거리·속도 태그(Html)는 활성 트랙에만 마운트 — drei Html은 마운트만
  // 돼 있어도 매 프레임 DOM 갱신 비용이 들므로 이탈 페이드아웃이 끝나면
  // 제거한다.
  const [labelActive, setLabelActive] = useState(false);

  // 자식의 등록 effect가 이 함수를 의존성으로 잡으므로 참조가 안정적이어야
  // 한다 — 매 렌더 새 함수를 넘기면 부모 리렌더(위험 태그 마운트 등)마다
  // 자식 effect가 재실행되어 사용 중인 material이 dispose된다.
  // useCallback은 react-hooks/immutability가 useFrame에서의 material mutate를
  // hook 인자 수정으로 판정하므로 쓰지 않고, ref에 담아 1회만 생성한다.
  const registrarsRef = useRef<{
    fade: MaterialRegistrar;
    label: (refs: TrackLabelRefs | null) => void;
  } | null>(null);
  if (registrarsRef.current == null) {
    registrarsRef.current = {
      fade: (material) => {
        const list = fadeMaterialsRef.current;
        if (material && !list.includes(material)) {
          applyMaterialize(material, uniformsRef.current!);
          list.push(material);
        }
      },
      label: (refs) => {
        labelRefsRef.current = refs;
      },
    };
  }
  const registerFadeMaterial = registrarsRef.current.fade;
  const registerLabel = registrarsRef.current.label;

  // 렌더러가 소유하는 보간 상태. target(센서값)과 분리되어 있다.
  const smoothRef = useRef({
    x: track.target.x,
    z: track.target.z,
    heading: track.target.heading,
    /** 스케일 팝인 진행도 (0.4s in / 0.45s out) */
    fade: 0,
    /** 머티리얼라이즈 스윕 진행도 (0.6s in / 0.45s out) */
    sweep: 0,
    /** 거리·속도 태그 가시성 (활성 트랙이면 1로 수렴) */
    labelVis: 0,
    // 1/LABEL_UPDATE_HZ보다 크게 시작 — 마운트 직후 첫 프레임에 바로
    // 텍스트/배경색이 채워져 빈 태그가 깜빡이지 않는다.
    labelClock: 1,
  });

  // 스케일/지면 높이 설정은 전체 존 공통이므로 첫 존의 값을 쓴다.
  const baseZone = zones[0];
  const worldScale = baseZone.sizeMultiplier / baseZone.metersPerUnit;
  const objectHeight = OBJECT_HEIGHT[track.type];

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

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

    // --- 위험도 색상: 속도 벡터 + 림 글로우 + 라벨 (가장 가까운 센서 존 기준) ---
    const severity = trackSeverity(track, zones);
    const severityColor = severity === 'danger' ? COLOR_DANGER : COLOR_WARNING;

    // 진행 방향 화살표 — 길이는 고정, 색만 세버리티를 따른다.
    const arrowMat = arrowMatRef.current;
    if (arrowMat) {
      arrowMat.opacity = opacity * 0.85;
      arrowMat.color.lerp(severityColor, k);
      arrowMat.emissive.lerp(severityColor, k);
    }

    const rimColor = severityColor;
    const rimStrength =
      severity === 'danger' ? RIM_STRENGTH_DANGER : RIM_STRENGTH_WARNING;
    uniforms.uRimColor.value.lerp(rimColor, k);
    uniforms.uRimStrength.value +=
      (rimStrength - uniforms.uRimStrength.value) * k;

    // --- 거리·속도 태그: 활성(주의/위험) 트랙에 표시, 배경색이 세버리티를
    // 전달한다. 이탈 트랙은 페이드아웃 후 언마운트. ---
    const wantLabel = track.phase === 'active';
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
        label.speed.textContent = `${track.target.speed.toFixed(1)} m/s`;
        label.root.style.backgroundColor = LABEL_BG[severity];
      }
    }
  });

  return (
    <group
      ref={groupRef}
      position={[track.target.x, baseZone.y, track.target.z]}
      scale={[0.001, 0.001, 0.001]}
    >
      {/* 진행 방향 화살표 — 고정 길이, 방향만 전달 (+X가 heading) */}
      <group
        position={[ARROW_NOSE_OFFSET[track.type], 0.06, 0]}
        scale={[ARROW_LENGTH_M, 1, 1]}
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
