import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three/examples/jsm/Addons.js';
import {
  AnimationMixer,
  Box3,
  Mesh,
  SkinnedMesh,
  Vector3,
  type Group,
  type Material,
  type MeshStandardMaterial,
} from 'three';
import {
  CODE_ASSETS,
  extendGltfLoaderWithKtx2,
  withBaseUrl,
} from '@crane/domain/3d';
import {
  isPedestrianType,
  type DetectedObjectType,
} from '../model/use-collision-guard-store';
import {
  GUARD_BLENDED_RENDER_ORDER,
  isGuardBlendedMaterial,
  prepareGuardObjectMaterial,
} from '../lib/guard-object-material';

/**
 * 감지 객체의 GLB 모델 비주얼.
 *
 * GLB는 저작 스케일/피벗이 제각각이므로 로드 후 정규화한다:
 * 실측 목표 크기(m)로 스케일링, 바닥 y=0·중심 xz=0 정렬, 진행 방향(+X)
 * 회전 보정. 이후는 기존 파이프라인 그대로 — 그룹 스케일(과장 배율)과
 * heading 회전이 씌워진다.
 *
 * 재질은 자산이 가진 색·텍스처 그대로다. 인스턴스별로 clone해 페이드
 * 기준값만 잡아 두고(lib/guard-object-material.ts) register 콜백으로
 * 부모(DetectedObjectMesh)에 넘긴다 — 부모가 페이드와 머티리얼라이즈
 * 셰이더(applyMaterialize)를 일괄 구동한다. 세버리티는 그 셰이더의 림
 * 글로우가 입힌다. 애니메이션 클립이 있으면(사람 걷기) 루프 재생한다.
 */

interface ObjectModelSource {
  path: string;
  /** 정규화 목표 실측 크기 (m) */
  targetSize: number;
  /** 목표 크기를 잴 축 — 사람은 키, 차량류는 전장 */
  sizeAxis: 'height' | 'length';
  /** 모델 원본 전방 → 우리 전방(+X) 보정 회전 (rad) */
  rotationY: number;
  /**
   * 루프 재생할 클립 이름. 자산에 정지 포즈 클립이 섞여 있을 수 있어 순서로
   * 고르지 않는다. 그 이름의 클립이 없으면 첫 클립이다.
   */
  clip?: string;
}

/**
 * 타입별 모델 배리언트 — 같은 타입의 트랙이라도 트랙별로 다른 모델을
 * 입혀 현장감을 준다 (FSD가 세단/SUV/트럭을 구분해 그리는 것과 같은
 * 원리). 배리언트 선택은 부모가 트랙 id 해시로 결정한다.
 */
const MODEL_SOURCES: Record<DetectedObjectType, ObjectModelSource[]> = {
  person: [
    {
      path: CODE_ASSETS.person.path,
      targetSize: 1.78,
      sizeAxis: 'height',
      rotationY: Math.PI / 2,
      clip: 'Walk',
    },
  ],
  worker: [
    {
      path: CODE_ASSETS.worker.path,
      targetSize: 1.85,
      sizeAxis: 'height',
      rotationY: Math.PI / 2,
      clip: 'Action',
    },
  ],
  car: [
    {
      path: CODE_ASSETS.car.path,
      targetSize: 4.8,
      sizeAxis: 'length',
      rotationY: Math.PI,
    },
  ],
  forklift: [
    {
      path: CODE_ASSETS.forkLift.path,
      targetSize: 2.7,
      sizeAxis: 'length',
      rotationY: Math.PI / 2,
    },
  ],
};

/** 타입별 배리언트 수 — 워밍업이 전 배리언트를 미리 그릴 때 사용 */
export const MODEL_VARIANT_COUNTS: Record<DetectedObjectType, number> =
  Object.fromEntries(
    Object.entries(MODEL_SOURCES).map(([type, sources]) => [
      type,
      sources.length,
    ]),
  ) as Record<DetectedObjectType, number>;

interface DetectedObjectModelProps {
  type: DetectedObjectType;
  register: (material: MeshStandardMaterial | null) => void;
  /**
   * 애니메이션 재생 배속 — 걷기 클립을 실제 이동 속도에 맞출 때 사용.
   * (예: 트랙 속도 m/s ÷ 클립의 기준 보행 속도)
   */
  animationTimeScale?: number;
  /**
   * 모델 배리언트 선택자 — 임의의 비음수 정수(트랙 id 해시 등)를 받아
   * 타입의 배리언트 수로 나눈 나머지로 모델을 고른다. 같은 트랙은 항상
   * 같은 모델을 유지한다.
   */
  variant?: number;
}

export function DetectedObjectModel({
  type,
  register,
  animationTimeScale = 1,
  variant = 0,
}: DetectedObjectModelProps) {
  const sources = MODEL_SOURCES[type];
  const source = sources[Math.abs(variant) % sources.length];
  const { scene, animations } = useGLTF(
    withBaseUrl(source.path),
    true,
    true,
    extendGltfLoaderWithKtx2,
  );

  const prepared = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);

    // 스킨드 메시의 박스는 월드 행렬을 한 번 갱신한 뒤에 잰다. 막 복제한
    // 메시는 bindMatrixInverse 가 단위 행렬이라 박스가 월드 좌표로 나오고,
    // 거기에 메시의 월드 행렬이 한 번 더 곱해진다 — 루트에 스케일이 실린
    // 리그(cm 단위 아마추어)는 그만큼 작게 재져 정규화 배율이 부풀어 오른다.
    clone.updateMatrixWorld(true);
    clone.traverse((child) => {
      if (child instanceof SkinnedMesh) child.computeBoundingBox();
    });
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const measured =
      source.sizeAxis === 'height' ? size.y : Math.max(size.x, size.z);
    const scale = measured > 1e-6 ? source.targetSize / measured : 1;

    const materials: MeshStandardMaterial[] = [];
    clone.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.castShadow = false;
      child.receiveShadow = false;
      const original = child.material as Material | Material[];
      const clonedList = (Array.isArray(original) ? original : [original]).map(
        (material) =>
          prepareGuardObjectMaterial(material) as MeshStandardMaterial,
      );
      materials.push(...clonedList);
      child.material = Array.isArray(original) ? clonedList : clonedList[0];
      // 유리·눈썹처럼 원래 반투명인 재질은 같은 객체의 본체 뒤에 그린다.
      if (clonedList.some(isGuardBlendedMaterial)) {
        child.renderOrder = GUARD_BLENDED_RENDER_ORDER;
      }
    });

    return {
      clone,
      scale,
      // 바닥 y=0 · 중심 xz=0 정렬 (스케일 그룹 안쪽에서 원본 단위로 이동)
      offset: [-center.x, -box.min.y, -center.z] as const,
      materials,
    };
  }, [scene, source]);

  // 부모 페이드/머티리얼라이즈 파이프라인에 등록.
  //
  // register는 부모가 매 렌더 새로 만드는 함수이므로 effect 의존성에 두면
  // 안 된다 — 부모가 리렌더될 때마다(예: 위험 태그 마운트) cleanup이 돌아
  // 아직 사용 중인 material을 dispose해버린다. 최신 register를 ref로 들고
  // 등록은 prepared(=material 인스턴스)가 바뀔 때만 수행한다.
  const registerRef = useRef(register);
  registerRef.current = register;

  useEffect(() => {
    prepared.materials.forEach((material) => registerRef.current(material));
  }, [prepared]);

  // dispose는 material 인스턴스의 수명에만 묶는다. clone된 material은 R3F
  // 관리 밖이라 직접 정리해야 한다 (geometry는 GLTF 캐시와 공유하므로
  // 건드리지 않는다).
  useEffect(
    () => () => {
      prepared.materials.forEach((material) => material.dispose());
    },
    [prepared],
  );

  // 애니메이션 (사람 걷기) — 소스가 지정한 클립을 루프 재생.
  const mixerRef = useRef<AnimationMixer | null>(null);
  useEffect(() => {
    if (animations.length === 0) return;
    const clip =
      animations.find((entry) => entry.name === source.clip) ?? animations[0];
    const mixer = new AnimationMixer(prepared.clone);
    mixer.timeScale = animationTimeScale;
    mixer.clipAction(clip).play();
    mixerRef.current = mixer;
    return () => {
      mixer.stopAllAction();
      mixerRef.current = null;
    };
  }, [animations, prepared, source, animationTimeScale]);

  // 걷기 클립이 없는 정적 사람 모델은 그대로 두면 마네킹이 미끄러지듯
  // 이동한다 — 케이던스에 맞춘 절차적 보브(걸음마다 상하 + 미세 요잉)로
  // 걷는 리듬을 흉내 낸다. 차량류에는 적용하지 않는다.
  const needsWalkBob =
    isPedestrianType(type) &&
    animations.length === 0 &&
    animationTimeScale > 0;
  const bobRef = useRef<Group>(null);
  const bobClockRef = useRef(0);

  // 믹서는 24Hz로 스로틀 — 걷기 애니메이션에 60fps 갱신은 과하다.
  const mixerClockRef = useRef(0);
  useFrame((_, delta) => {
    const mixer = mixerRef.current;
    if (mixer) {
      mixerClockRef.current += delta;
      if (mixerClockRef.current < 1 / 24) return;
      mixer.update(Math.min(mixerClockRef.current, 0.1));
      mixerClockRef.current = 0;
      return;
    }

    const bobGroup = bobRef.current;
    if (!needsWalkBob || !bobGroup) return;
    // 기준 보행(1.4m/s)에서 2보/초 — timeScale이 실제 속도 비율을 반영.
    bobClockRef.current += delta * animationTimeScale;
    const t = bobClockRef.current;
    bobGroup.position.y = Math.abs(Math.sin(t * Math.PI * 2)) * 0.035;
    bobGroup.rotation.y = Math.sin(t * Math.PI) * 0.06;
  });

  return (
    <group rotation={[0, source.rotationY, 0]}>
      {/* 보브 그룹은 스케일 밖(미터 단위) — 진폭이 모델 원본 단위에
          좌우되지 않는다 */}
      <group ref={bobRef}>
        <group scale={prepared.scale}>
          <primitive object={prepared.clone} position={prepared.offset} />
        </group>
      </group>
    </group>
  );
}
