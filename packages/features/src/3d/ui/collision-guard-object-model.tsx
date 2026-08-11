import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three/examples/jsm/Addons.js';
import {
  AnimationMixer,
  Box3,
  Color,
  Mesh,
  Vector3,
  type Material,
  type MeshStandardMaterial,
} from 'three';
import { withBaseUrl } from '@crane/domain/3d';
import type { DetectedObjectType } from '../model/use-collision-guard-store';

/**
 * 감지 객체의 GLB 모델 비주얼.
 *
 * GLB는 저작 스케일/피벗이 제각각이므로 로드 후 정규화한다:
 * 실측 목표 크기(m)로 스케일링, 바닥 y=0·중심 xz=0 정렬, 진행 방향(+X)
 * 회전 보정. 이후는 기존 파이프라인 그대로 — 그룹 스케일(과장 배율)과
 * heading 회전이 씌워진다.
 *
 * material은 인스턴스별로 clone해 다크 스테이지용 자체발광을 입히고,
 * register 콜백으로 부모(DetectedObjectMesh)에 넘긴다 — 부모가 페이드
 * opacity와 머티리얼라이즈 셰이더(applyMaterialize)를 일괄 구동한다.
 * 애니메이션 클립이 있으면(사람 걷기 등) 첫 클립을 루프 재생한다.
 */

interface ObjectModelSource {
  path: string;
  /** 정규화 목표 실측 크기 (m) */
  targetSize: number;
  /** 목표 크기를 잴 축 — 사람은 키, 차량류는 전장 */
  sizeAxis: 'height' | 'length';
  /** 모델 원본 전방 → 우리 전방(+X) 보정 회전 (rad) */
  rotationY: number;
}

const MODEL_SOURCES: Record<DetectedObjectType, ObjectModelSource> = {
  person: {
    path: '/models/human.glb',
    targetSize: 1.75,
    sizeAxis: 'height',
    rotationY: Math.PI / 2,
  },
  car: {
    path: '/models/car.glb',
    targetSize: 4.5,
    sizeAxis: 'length',
    rotationY: Math.PI / 2,
  },
  forklift: {
    path: '/models/fork_lift.glb',
    targetSize: 2.9,
    sizeAxis: 'length',
    rotationY: Math.PI / 2,
  },
};

for (const source of Object.values(MODEL_SOURCES)) {
  useGLTF.preload(withBaseUrl(source.path));
}

/**
 * 테슬라식 무채색 객체 색 — 세버리티 색 언어(sky/amber/red)와 경쟁하는
 * 색을 화면에서 배제하고, 종류 식별은 실루엣이 담당한다.
 */
const OBJECT_GRAY = new Color('#cbd5e1');

/**
 * 원본 텍스처/색을 버리고 통일된 밝은 회색 + 자체발광으로 교체한다.
 * 다크 스테이지(포커스 디밍)에서도 실루엣이 유지되고, 세버리티는
 * 머티리얼라이즈 셰이더의 림 글로우가 입힌다.
 */
function prepareMaterial(material: Material): MeshStandardMaterial {
  const cloned = material.clone() as MeshStandardMaterial;
  if (cloned.isMeshStandardMaterial) {
    cloned.map = null;
    cloned.emissiveMap = null;
    cloned.vertexColors = false;
    cloned.color = OBJECT_GRAY.clone();
    cloned.emissive = OBJECT_GRAY.clone();
    cloned.emissiveIntensity = 0.35;
    cloned.roughness = 1;
    cloned.metalness = 0;
  }
  cloned.transparent = true;
  cloned.opacity = 0;
  return cloned;
}

interface DetectedObjectModelProps {
  type: DetectedObjectType;
  register: (material: MeshStandardMaterial | null) => void;
  /**
   * 애니메이션 재생 배속 — 걷기 클립을 실제 이동 속도에 맞출 때 사용.
   * (예: 트랙 속도 m/s ÷ 클립의 기준 보행 속도)
   */
  animationTimeScale?: number;
}

export function DetectedObjectModel({
  type,
  register,
  animationTimeScale = 1,
}: DetectedObjectModelProps) {
  const source = MODEL_SOURCES[type];
  const { scene, animations } = useGLTF(withBaseUrl(source.path));

  const prepared = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);

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
      if (Array.isArray(original)) {
        const clonedList = original.map(prepareMaterial);
        materials.push(...clonedList);
        child.material = clonedList;
      } else {
        const clonedMaterial = prepareMaterial(original);
        materials.push(clonedMaterial);
        child.material = clonedMaterial;
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

  // 애니메이션 (사람 걷기 등) — 첫 클립 루프 재생.
  const mixerRef = useRef<AnimationMixer | null>(null);
  useEffect(() => {
    if (animations.length === 0) return;
    const mixer = new AnimationMixer(prepared.clone);
    mixer.timeScale = animationTimeScale;
    mixer.clipAction(animations[0]).play();
    mixerRef.current = mixer;
    return () => {
      mixer.stopAllAction();
      mixerRef.current = null;
    };
  }, [animations, prepared, animationTimeScale]);

  // 믹서는 24Hz로 스로틀 — 걷기 애니메이션에 60fps 갱신은 과하다.
  const mixerClockRef = useRef(0);
  useFrame((_, delta) => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    mixerClockRef.current += delta;
    if (mixerClockRef.current < 1 / 24) return;
    mixer.update(Math.min(mixerClockRef.current, 0.1));
    mixerClockRef.current = 0;
  });

  return (
    <group rotation={[0, source.rotationY, 0]}>
      <group scale={prepared.scale}>
        <primitive object={prepared.clone} position={prepared.offset} />
      </group>
    </group>
  );
}
