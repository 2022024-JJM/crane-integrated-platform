import { Suspense, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import {
  CanvasTexture,
  Color,
  DoubleSide,
  Shape,
  type Mesh,
  type MeshBasicMaterial,
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
  markGuardLayer,
  type MaterializeUniforms,
} from '../lib/materialize-material';
import { TrackLabel, type TrackLabelRefs } from './collision-guard-label';
import { CollisionGuardFocusDim } from './collision-guard-focus-dim';
import {
  DetectedObjectModel,
  MODEL_VARIANT_COUNTS,
} from './collision-guard-object-model';

/**
 * 골리앗 크레인 주변 충돌 감지(안티콜리전) 시각화.
 *
 * 테슬라 FSD 시각화와 같은 원리로 동작한다:
 *  - 센서(현재는 시뮬레이션)는 ~8Hz의 이산 관측값을 track.target에 쓴다.
 *  - 렌더러는 매 프레임 지수 damping으로 target을 추적한다. 관측 사이의
 *    공백을 보간이 메꿔 이동이 연속적이고 부드럽게 보인다.
 *  - 실체화 정도는 시간이 아니라 "경계 침투 깊이"를 따른다: 감지 경계
 *    바로 안쪽 밴드에서는 고스트(저불투명 + 하반신만 실체화)로 나타나고,
 *    깊이 들어올수록 컷 플레인이 차오르며 완전한 실체가 된다. 이탈은
 *    역순 — 경계로 물러날수록 서서히 해체된 뒤 트랙이 제거된다. 스윕
 *    속도에는 상한(MATERIALIZE_*_DURATION)이 있어 빠른 객체는 클래식
 *    스캔 연출로 보인다. prefers-reduced-motion이면 컷 없이 거리 비례
 *    페이드만 수행한다.
 *  - 모든 프레임 갱신은 ref로 수집한 material/Object3D mutate로 수행 —
 *    React 리렌더 0회. material은 JSX로 선언해 R3F가 dispose를 관리한다.
 */

/** 위치/방향 damping 시상수 (s). 작을수록 즉각적, 클수록 미끄러지듯. */
const POSITION_SMOOTHING_TAU = 0.14;
/** 스케일 성장 인/아웃 타이밍 — 머티리얼라이즈 스윕과 병렬로 돈다. */
const FADE_IN_DURATION = 0.6;
const FADE_OUT_DURATION = 0.45;
/**
 * 등장 시 시작 스케일 배율 — 0에서 튀어나오는 팝인은 damping 이동과
 * 겹치면 덜컥거리는 인상을 준다(운영 피드백). FSD처럼 제자리에서
 * 거의 실제 크기(85%)로 시작해 실체화 스윕이 등장을 전담하고, 스케일은
 * 마지막 15%만 완만하게 채운다.
 */
const SCALE_ENTRY_MIN = 0.85;
/** 라벨 텍스트 갱신 주기 — 센서 tick(8Hz)과 맞춘다. */
const LABEL_UPDATE_HZ = 8;

/**
 * 감지 경계 안쪽의 신뢰도 페이드 밴드 (m). 경계에서 갓 잡힌 트랙은
 * 고스트로 나타나고, 이 밴드를 통과해 들어오는 동안 실체화가 차오른다.
 * 이탈도 역순으로 서서히 — 진입/이탈 모두 "한 번에 싹"이 아니라 거리에
 * 비례해 부드럽게 나타나고 사라진다. 차량(≈7m/s)은 약 1.7초, 도보
 * (≈1.2m/s)는 밴드를 걷는 동안 내내 고스트 상태를 거친다.
 */
const EDGE_FADE_BAND_M = 12;
/**
 * 경계 고스트의 최소 불투명도 배율 — 실체화가 시작된 객체가 경계 근처에
 * 머무는 동안에도 이 비율만큼은 비쳐 보인다. 0이면 밴드 초입에서 스캔
 * 밴드 글로우조차 안 보여 "감지됐다"는 사실 자체가 전달되지 않는다.
 */
const EDGE_MIN_SOLIDITY = 0.3;

/**
 * 감지 링 색 — 채도를 뺀 밝은 회색 배경 위에서 읽혀야 하므로 밝은
 * 하늘색(#38bdf8)이 아니라 한 단계 진한 파랑을 쓴다. 밝은 배경에서는
 * 밝은 색이 묻히고 어두운 색이 도드라진다.
 */
const COLOR_IDLE = new Color('#0284c7');
const COLOR_WARNING = new Color('#f59e0b');
const COLOR_DANGER = new Color('#ef4444');
/**
 * 커버 영역 무대 색 — 감지 링 안쪽을 어두운 네이비로 깔아 FSD의 "어두운
 * 도로"를 만든다. 흰 객체·고스트·발광 화살표·위험 면은 전부 이 어두운
 * 무대 위에서 대비를 얻는다 (흰 객체 + 밝은 지면은 구조적으로 대비가
 * 안 나온다는 운영 피드백). 전역 디밍과 달리 필요한 곳만 어두워져
 * 지도 맥락은 보존된다.
 */
const COLOR_STAGE = new Color('#0b1220');
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
 *
 * 객체와 같은 과장 배율(sizeMultiplier) 그룹 안에 있으므로 실측 m가
 * 아니라 "객체 대비 비율"로 읽힌다 — 객체를 키우면 함께 커진다.
 */
const ARROW_LENGTH_M = 4;
/**
 * 화살표 시작점(객체 앞코) X 오프셋 (로컬 m) — 객체 실측 반길이 수준으로
 * 최소화한다. 이 값도 과장 배율(sizeMultiplier)이 곱해지므로, 크게 잡으면
 * 화살표가 객체에서 뚝 떨어져 별개 물체처럼 보인다.
 */
const ARROW_NOSE_OFFSET: Record<DetectedObjectType, number> = {
  person: 0.35,
  car: 1.6,
  forklift: 1.1,
};
/**
 * 림 글로우 강도 — 몸체는 무채색을 유지하고 림이 세버리티 색(주의 amber,
 * 위험 red)을 입힌다. 감지된 트랙은 정의상 최소 warning이므로 "idle 림"은
 * 없다 — 커버 안의 모든 객체가 자기 레벨 색으로 읽혀야 한다.
 */
const RIM_STRENGTH_WARNING = 0.7;
const RIM_STRENGTH_DANGER = 0.9;
/**
 * 위험 "진입 순간"의 원샷 림 플래시 — 지속 상태는 damping된 림 강도가,
 * 전환의 긴급함은 순간 증폭이 전달한다. 색 lerp만으로는 전환이 너무
 * 조용해 다른 곳을 보고 있으면 놓친다 — 짧은 휘도 스파이크는 주변시가
 * 잡아낸다 (FSD가 위험 요소 강조에 쓰는 문법).
 */
const DANGER_FLASH_DURATION = 0.35;
const DANGER_FLASH_BOOST = 1.6;

/** 머티리얼라이즈 컷 기준 객체 높이 (로컬 미터, 라벨 부착에도 사용) */
const OBJECT_HEIGHT: Record<DetectedObjectType, number> = {
  person: 1.8,
  car: 1.6,
  forklift: 2.2,
};
const LABEL_HEIGHT_OFFSET = 0.45;
/**
 * 트랙별 라벨 높이 분산 (m) — 이웃한 두 객체의 칩이 정확히 포개져 어느
 * 칩이 어느 객체인지 못 읽는 것을 막는다. id 해시로 결정적으로 버킷을
 * 골라, 같은 트랙은 항상 같은 높이를 유지한다 (프레임마다 튀지 않음).
 */
const LABEL_JITTER_BUCKETS = 5;
const LABEL_JITTER_STEP_M = 0.22;

/** 트랙 id의 결정적 해시 — 라벨 높이 버킷·모델 배리언트 선택에 공용 */
function hashTrackId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function labelJitterFor(id: string): number {
  return (hashTrackId(id) % LABEL_JITTER_BUCKETS) * LABEL_JITTER_STEP_M;
}

/**
 * 접지 앵커(컨택트 셰이딩) 풋프린트 — 로컬 미터 (장축 = 진행 방향 +X,
 * 단축 = 횡방향). 감지 객체는 실시간 그림자를 끄므로(castShadow=false)
 * 부감 구도에서 지면과의 접점이 없어 떠 보인다 — 부드러운 방사형
 * 그라데이션 타원 하나가 객체를 지면에 붙여 공간 관계를 읽게 한다.
 */
const CONTACT_SHADOW_FOOTPRINT: Record<
  DetectedObjectType,
  [long: number, cross: number]
> = {
  person: [0.55, 0.55],
  car: [2.5, 1.15],
  forklift: [1.7, 1.0],
};
/** 접지 앵커 최대 불투명도 — 객체 페이드에 이 배율을 곱해 함께 여려진다 */
const CONTACT_SHADOW_OPACITY = 0.45;

/**
 * 접지 앵커 텍스처 — 중심 진한 검정에서 가장자리 완전 투명으로 빠지는
 * 방사형 그라데이션. 모든 트랙이 공유하는 지연 생성 싱글턴 (R3F는
 * 클라이언트 전용이므로 document 접근이 안전하다).
 */
let contactShadowTexture: CanvasTexture | null = null;
function getContactShadowTexture(): CanvasTexture {
  if (!contactShadowTexture) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    gradient.addColorStop(0.55, 'rgba(0, 0, 0, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    contactShadowTexture = new CanvasTexture(canvas);
  }
  return contactShadowTexture;
}

type Severity = 'idle' | 'warning' | 'danger';

/**
 * 라벨 칩 스타일 — 밝은 무채색 무대에서 amber 칩 위 흰 글자는 대비가
 * 1.9:1 수준이라 안 읽힌다(운영 피드백). 주의는 어두운 칩 + 세버리티색
 * 보더로 대비를 확보하고, 위험은 칩 전체를 red로 물들여 소리치게 한다.
 */
const LABEL_STYLE: Record<'warning' | 'danger', { bg: string; border: string }> =
  {
    warning: {
      bg: 'rgba(15, 23, 42, 0.92)', // slate-900
      border: 'rgba(251, 191, 36, 0.9)', // amber-400
    },
    danger: {
      bg: 'rgba(220, 38, 38, 0.95)', // red-600
      border: 'rgba(254, 202, 202, 0.9)', // red-200
    },
  };

function easeOutCubic(t: number) {
  const u = 1 - t;
  return 1 - u * u * u;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** 0→1 clamp + smoothstep — 경계 신뢰도 페이드의 완만한 양끝 처리 */
function smoothstep01(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * 감지 영역 링(라이다 커버) + 위험 반경 링 + 카메라 근거리 링.
 *
 * 색 역할 분담: 감지 링은 "센서 커버 범위"라는 정적 사실이므로 항상
 * sky를 유지한다 — 상태에 따라 물들이면 링 두 개가 동시에 색을 바꿔
 * 어느 원이 무엇인지 읽기 어려워진다(운영 피드백). 상태 전달은 위험
 * 반경 영역(등장/펄스)과 객체 림 글로우·라벨의 몫이다.
 *
 * 형태 역할 분담: 감지는 "선"(경계), 위험은 "면"(영역)이다. 둘 다 같은
 * 굵기의 링으로 그리면 화면에 원이 넷 있는 것처럼 읽혀 서로 경쟁한다
 * — FSD에서 파란 경로선과 빨간 정지선이 굵기·형태가 완전히 달라
 * 역할이 즉시 구분되는 것과 같은 원리다.
 *
 * 위험 반경은 "경계"와 "면"을 분리한다: 빨간 경계 링은 상시 표시해
 * 위험 지역이 어디까지인지 항상 알 수 있게 하고(운영 피드백 — 위험
 * 반경 인지 안 됨), 면 채움은 상태로 취급해 객체가 커버 안에 들어왔을
 * 때만 페이드인·danger 펄스한다. 카메라 근거리 링은 기본 숨김.
 */
/** 레이더 파장 — 동시에 도는 확산 링 수와 한 파장의 주기 (s) */
const SCAN_WAVE_COUNT = 2;
const SCAN_WAVE_PERIOD = 3.4;

function DetectionZoneRing({
  zone,
  showCameraCoverage = false,
}: {
  zone: CollisionGuardZone;
  showCameraCoverage?: boolean;
}) {
  const dangerRef = useRef<MeshStandardMaterial>(null);
  const registerDanger = (material: MeshStandardMaterial | null) => {
    dangerRef.current = material;
    markGuardLayer(material);
  };
  const waveMeshRefs = useRef<(Mesh | null)[]>([]);
  const waveMatRefs = useRef<(MeshStandardMaterial | null)[]>([]);
  const reducedMotion = usePrefersReducedMotion();

  useFrame((state, delta) => {
    // --- 레이더 파장: 중심에서 감지 경계까지 퍼져나가며 소멸하는 링.
    // "이 영역을 능동적으로 스캔하고 있다"는 감각을 만든다. 위상을
    // 분산한 두 파장이 번갈아 나가고, 바깥으로 갈수록 빠르게 옅어져
    // 객체·위험 면보다 시각적 우선순위가 낮게 유지된다.
    for (let i = 0; i < SCAN_WAVE_COUNT; i++) {
      const mesh = waveMeshRefs.current[i];
      const material = waveMatRefs.current[i];
      if (!mesh || !material) continue;
      if (reducedMotion) {
        material.opacity = 0;
        continue;
      }
      const t =
        (state.clock.elapsedTime / SCAN_WAVE_PERIOD + i / SCAN_WAVE_COUNT) % 1;
      const s = Math.max(0.001, t) * zone.radius;
      mesh.scale.set(s, s, 1);
      material.opacity = (1 - t) * (1 - t) * 0.3;
    }

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

    // 위험 반경 "면" — idle에도 미세 채움을 남겨 다크 스테이지 위에서
    // 위험 구역이 항상 "면"으로 인지되게 하고, 객체 진입(warning) →
    // danger 펄스로 단계적으로 차오른다. 면은 선보다 같은 불투명도에서
    // 훨씬 무겁게 읽히므로 낮은 값을 쓴다.
    const k = 1 - Math.exp(-delta / 0.25);
    const dangerTarget =
      severity === 'danger'
        ? 0.3 + Math.sin(state.clock.elapsedTime * 5) * 0.1
        : severity === 'warning'
          ? 0.18
          : 0.05;
    danger.opacity += (dangerTarget - danger.opacity) * k;
  });

  const [cx, cz] = zone.center;
  // 굵기 3.5% — 부감 구도에서 링이 원근으로 눌려 얇아 보이므로 넉넉하게.
  const ringWidth = zone.radius * 0.035;
  // 지면 z-fighting 방지 리프트 — 좌표계 스케일이 달라도 비율로 유지.
  const groundLift = Math.max(0.03, zone.radius * 0.005);

  return (
    <group position={[cx, zone.y + groundLift, cz]}>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        {/* 커버 영역 다크 스테이지 — 링 안쪽을 어둡게 깔아 흰 객체가
            도드라지는 배경을 만든다 (FSD의 어두운 도로에 해당) */}
        <mesh renderOrder={1}>
          <circleGeometry args={[zone.radius, 128]} />
          <meshStandardMaterial
            ref={markGuardLayer}
            color={COLOR_STAGE}
            transparent
            opacity={0.38}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh renderOrder={2}>
          <ringGeometry args={[zone.radius - ringWidth, zone.radius, 128]} />
          <meshStandardMaterial
            ref={markGuardLayer}
            color={COLOR_IDLE}
            emissive={COLOR_IDLE}
            emissiveIntensity={1.1}
            transparent
            opacity={0.9}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
        {/* 레이더 파장 — 단위 반경 링을 useFrame이 scale·opacity로 구동 */}
        {Array.from({ length: SCAN_WAVE_COUNT }, (_, waveIndex) => (
          <mesh
            key={waveIndex}
            renderOrder={2}
            ref={(mesh) => {
              waveMeshRefs.current[waveIndex] = mesh;
            }}
          >
            <ringGeometry args={[0.94, 1, 96]} />
            <meshStandardMaterial
              ref={(material) => {
                waveMatRefs.current[waveIndex] = material;
                markGuardLayer(material);
              }}
              color={COLOR_IDLE}
              emissive={COLOR_IDLE}
              emissiveIntensity={0.9}
              transparent
              opacity={0}
              side={DoubleSide}
              depthWrite={false}
            />
          </mesh>
        ))}
        {/* 위험 반경 경계 — 상시 표시되는 빨간 링. 감지 링(sky)과 색·굵기가
            달라 "여기부터 위험 지역"이라는 경계가 항상 읽힌다. 부감에서
            원근으로 눌려도 붉게 남도록 이미시브를 세게 준다 */}
        <mesh renderOrder={2}>
          <ringGeometry
            args={[zone.dangerRadius - ringWidth * 0.8, zone.dangerRadius, 96]}
          />
          <meshStandardMaterial
            ref={markGuardLayer}
            color={COLOR_DANGER}
            emissive={COLOR_DANGER}
            emissiveIntensity={1.1}
            transparent
            opacity={0.8}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
        {/* 위험 반경 면 — 링이 아니라 채워진 면. 객체가 커버 안에 있을 때만
            페이드인해 상태를 전달한다. 파란 채움(1)·링(2)보다 뒤에 그린다 */}
        <mesh renderOrder={3}>
          <circleGeometry args={[zone.dangerRadius, 96]} />
          <meshStandardMaterial
            ref={registerDanger}
            color={COLOR_DANGER}
            emissive={COLOR_DANGER}
            emissiveIntensity={0.5}
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
                ref={markGuardLayer}
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
                ref={markGuardLayer}
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
      {/* 반경 수치 — 배경·보더 없는 반투명 흰 텍스트. 수치는 참고 정보일
          뿐 시선의 주인공은 감지 객체이므로 가시성을 한 단계 낮춘다.
          위험 수치는 빨간 링 안쪽, 감지 수치는 파란 링 안쪽 — 둘 다
          다크 스테이지 위라 흰 글자가 요란하지 않게 읽힌다. 부착 방위는
          travel 반대 방향 = 에고 카메라가 물러난 쪽(근측). */}
      <Html
        center
        position={[
          -(zone.travel?.[0] ?? 1) * (zone.dangerRadius - ringWidth * 2),
          0.5,
          -(zone.travel?.[1] ?? 0) * (zone.dangerRadius - ringWidth * 2),
        ]}
        zIndexRange={[4, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <span className="font-mono text-[10px] leading-none font-semibold whitespace-nowrap text-white/70">
          {Math.round(zone.dangerRadius * zone.metersPerUnit)}m
        </span>
      </Html>
      <Html
        center
        position={[
          -(zone.travel?.[0] ?? 1) * (zone.radius - ringWidth * 2.5),
          0.5,
          -(zone.travel?.[1] ?? 0) * (zone.radius - ringWidth * 2.5),
        ]}
        zIndexRange={[4, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <span className="font-mono text-[10px] leading-none font-semibold whitespace-nowrap text-white/70">
          {Math.round(zone.radius * zone.metersPerUnit)}m
        </span>
      </Html>
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
  const registerArrow = (material: MeshStandardMaterial | null) => {
    arrowMatRef.current = material;
    markGuardLayer(material);
  };
  // 접지 앵커는 basic material — 포커스 디밍(MeshStandardMaterial만 추적)의
  // 영향을 받지 않고, 조명과 무관하게 일정한 어둡기를 유지한다.
  const shadowMatRef = useRef<MeshBasicMaterial>(null);
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
    /** 스케일 성장 진행도 (0.6s in / 0.45s out, 85%→100% 구간만 사용) */
    fade: 0,
    /** 머티리얼라이즈 스윕 진행도 (0.6s in / 0.45s out) */
    sweep: 0,
    /** 거리·속도 태그 가시성 (활성 트랙이면 1로 수렴) */
    labelVis: 0,
    /** damping된 림 글로우 강도 (플래시와 분리된 기저값) */
    rim: 0.55,
    /** 위험 진입 원샷 플래시 잔여량 (1 → 0) */
    flash: 0,
    /** 직전 프레임의 danger 여부 — 진입 에지 검출용 */
    wasDanger: false,
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

    // --- 위치/방향 damping (테슬라식 스무딩의 핵심) ---
    const k = 1 - Math.exp(-dt / POSITION_SMOOTHING_TAU);
    smooth.x += (track.target.x - smooth.x) * k;
    smooth.z += (track.target.z - smooth.z) * k;

    let headingDiff = track.target.heading - smooth.heading;
    headingDiff = Math.atan2(Math.sin(headingDiff), Math.cos(headingDiff));
    smooth.heading += headingDiff * k;

    // --- 경계 신뢰도 (0 = 감지 경계, 1 = 페이드 밴드 통과) ---
    // 실체화 스윕·불투명도·라벨이 전부 이 값을 따라 거리 기반으로
    // 차오르고 빠진다. smooth 좌표는 damping으로 연속이므로 값도 연속.
    const nearest = nearestZone(smooth.x, smooth.z, zones);
    const edgeBand = EDGE_FADE_BAND_M / baseZone.metersPerUnit;
    const presence = smoothstep01((nearest.zone.radius - nearest.dist) / edgeBand);

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
      // 실체화 목표는 경계 신뢰도 — 시간 램프가 아니라 침투 깊이를
      // 따른다. 속도 상한이 있어 빠른 객체는 기존 스캔 연출 그대로,
      // 느린 객체는 밴드를 걸어 들어오는 동안 부분 실체화를 거친다.
      // 경계 밖(히스테리시스 구간)으로 물러나면 목표가 0이 되어 제거
      // 전에 이미 서서히 해체된다 — 재진입 시 그 자리에서 되살아난다.
      if (smooth.sweep < presence) {
        smooth.sweep = Math.min(
          presence,
          smooth.sweep + dt / MATERIALIZE_IN_DURATION,
        );
      } else {
        smooth.sweep = Math.max(
          presence,
          smooth.sweep - dt / MATERIALIZE_OUT_DURATION,
        );
      }
    }

    group.position.set(smooth.x, baseZone.y, smooth.z);
    group.rotation.y = -smooth.heading;

    // 제자리 등장: 스케일은 85% → 100%만 완만하게 채운다 (0에서 튀어
    // 나오는 팝인 제거 — 등장의 주역은 실체화 스윕이다). 이탈은 같은
    // 곡선을 역으로 타며 페이드아웃과 함께 살짝만 줄어든다.
    // reduced-motion이면 스케일 변화 없이 페이드만.
    const scaleEase = reducedMotion
      ? 1
      : SCALE_ENTRY_MIN + (1 - SCALE_ENTRY_MIN) * easeOutCubic(smooth.fade);
    const s = worldScale * scaleEase;
    group.scale.set(s, s, s);

    // --- 불투명도: 스윕보다 빠르게 램프(반투명 내부면 비침 최소화)하되,
    // 경계 신뢰도의 고스트 배율을 곱한다 — 경계 근처의 트랙은 실체화가
    // 진행돼도 반투명으로 남고, 깊이 들어와야 완전한 실체가 된다.
    // reduced-motion이면 컷 없이 거리 비례 페이드만.
    const solidity = EDGE_MIN_SOLIDITY + (1 - EDGE_MIN_SOLIDITY) * presence;
    const opacity = reducedMotion
      ? smooth.fade * presence
      : Math.min(1, Math.max(0, smooth.sweep) * 2.5) * solidity;
    for (const material of fadeMaterialsRef.current) {
      material.opacity = opacity;
      material.depthWrite = opacity >= 0.99;
    }

    // 접지 앵커 — 객체 페이드를 그대로 따라간다.
    const shadowMat = shadowMatRef.current;
    if (shadowMat) {
      shadowMat.opacity = opacity * CONTACT_SHADOW_OPACITY;
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

    // 위험 진입 에지에서만 플래시 점화 — 이후 짧게 감쇠한다.
    const isDanger = severity === 'danger';
    if (isDanger && !smooth.wasDanger) {
      smooth.flash = 1;
    }
    smooth.wasDanger = isDanger;
    smooth.flash = Math.max(0, smooth.flash - dt / DANGER_FLASH_DURATION);

    smooth.rim += (rimStrength - smooth.rim) * k;
    uniforms.uRimStrength.value =
      smooth.rim + smooth.flash * DANGER_FLASH_BOOST;

    // --- 거리·속도 태그: 활성(주의/위험) 트랙에 표시, 배경색이 세버리티를
    // 전달한다. 이탈 트랙은 페이드아웃 후 언마운트. ---
    const wantLabel = track.phase === 'active';
    const labelTarget = wantLabel ? 1 : 0;
    // 라벨도 객체 등장과 보조를 맞춰 여유 있게 페이드인한다.
    smooth.labelVis += (labelTarget - smooth.labelVis) * Math.min(1, dt / 0.35);

    if (wantLabel && !labelActive) {
      setLabelActive(true);
    } else if (!wantLabel && labelActive && smooth.labelVis < 0.02) {
      // 페이드아웃이 끝난 뒤 언마운트 — 갑자기 사라지지 않는다.
      setLabelActive(false);
    }

    const label = labelRefsRef.current;
    if (label) {
      // 라벨도 경계 신뢰도를 따라 고스트 객체 위에서 함께 여리게 —
      // 반투명 실루엣 위에 쨍한 태그만 떠 있으면 따로 논다.
      label.root.style.opacity = String(smooth.fade * smooth.labelVis * presence);

      smooth.labelClock += dt;
      if (smooth.labelVis > 0.01 && smooth.labelClock >= 1 / LABEL_UPDATE_HZ) {
        smooth.labelClock = 0;
        const meters = Math.round(nearest.dist * baseZone.metersPerUnit);
        label.distance.textContent = `${meters} m`;
        label.speed.textContent = `${track.target.speed.toFixed(1)} m/s`;
        const labelStyle = LABEL_STYLE[severity];
        label.root.style.backgroundColor = labelStyle.bg;
        label.root.style.borderColor = labelStyle.border;
      }
    }
  });

  return (
    <group
      ref={groupRef}
      position={[track.target.x, baseZone.y, track.target.z]}
      scale={[0.001, 0.001, 0.001]}
    >
      {/* 접지 앵커 — 존 지면 요소(1~3) 위, 화살표(5) 아래에 그린다 */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        scale={[
          CONTACT_SHADOW_FOOTPRINT[track.type][0],
          CONTACT_SHADOW_FOOTPRINT[track.type][1],
          1,
        ]}
        renderOrder={4}
      >
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial
          ref={shadowMatRef}
          map={getContactShadowTexture()}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      {/* 진행 방향 화살표 — 고정 길이, 방향만 전달 (+X가 heading) */}
      <group
        position={[ARROW_NOSE_OFFSET[track.type], 0.06, 0]}
        scale={[ARROW_LENGTH_M, 1, 1]}
      >
        {/* 지면 요소(존 1~3)·접지 앵커(4)보다 위에 그린다 */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
          <shapeGeometry args={[VELOCITY_ARROW_SHAPE]} />
          <meshStandardMaterial
            ref={registerArrow}
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
          // 트랙별 모델 배리언트 — id 해시로 결정적 선택 (리마운트에도 유지)
          variant={hashTrackId(track.id)}
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
          height={
            objectHeight + LABEL_HEIGHT_OFFSET + labelJitterFor(track.id)
          }
          worldScale={worldScale}
          register={registerLabel}
        />
      ) : null}
    </group>
  );
}

const WARMUP_TYPES: DetectedObjectType[] = ['person', 'car', 'forklift'];

/**
 * 스폰 히치 워밍업 — 감지 객체는 각 타입의 "첫 등장" 프레임에 geometry
 * GPU 업로드 + 머티리얼라이즈 셰이더 컴파일(스킨드/비스킨드 2종) +
 * 바운딩박스 계산이 몰려 수십 ms 프레임 스파이크가 난다(등장 연출이
 * 버벅이는 주범). 씬 로드 직후 세 타입을 화면 밖에서 몇 프레임 그려
 * 이 비용을 미리 치른다.
 *
 * 워밍업 후 언마운트하지 않고 visible=false로 계속 붙들어 두는 이유:
 * three의 셰이더 프로그램은 참조하는 마지막 material이 dispose되면 함께
 * 삭제된다 — 언마운트하면 컴파일을 다시 하게 되어 워밍업이 무효가 된다.
 * (visible=false면 렌더 비용은 0이다.)
 */
function CollisionGuardWarmup() {
  const groupRef = useRef<Group>(null);
  const warmFramesRef = useRef(0);
  const uniformsRef = useRef<MaterializeUniforms | null>(null);
  if (uniformsRef.current == null) {
    uniformsRef.current = createMaterializeUniforms();
  }
  const registerRef = useRef((material: MeshStandardMaterial | null) => {
    if (material) {
      applyMaterialize(material, uniformsRef.current!);
    }
  });

  useFrame(() => {
    const group = groupRef.current;
    if (!group || !group.visible) return;
    warmFramesRef.current += 1;
    if (warmFramesRef.current > 3) {
      group.visible = false;
    }
  });

  return (
    // 지면 한참 아래 + 재질 opacity 0 — 워밍업 프레임에도 화면에는 안 보인다.
    <group ref={groupRef} position={[0, -2000, 0]}>
      {WARMUP_TYPES.flatMap((type) =>
        Array.from({ length: MODEL_VARIANT_COUNTS[type] }, (_, variantIndex) => (
          <Suspense key={`${type}:${variantIndex}`} fallback={null}>
            <DetectedObjectModel
              type={type}
              variant={variantIndex}
              register={registerRef.current}
              animationTimeScale={0}
            />
          </Suspense>
        )),
      )}
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
      {/* 워밍업도 enabled와 무관 — 가드를 켜기 전에 비용을 다 치러 둔다 */}
      <CollisionGuardWarmup />
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
