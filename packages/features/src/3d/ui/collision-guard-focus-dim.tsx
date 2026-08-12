import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, type Light, type Mesh, type MeshStandardMaterial } from 'three';
import { useCollisionGuardStore } from '../model/use-collision-guard-store';
import { isGuardLayer } from '../lib/materialize-material';

/**
 * 포커스 스테이지 — 충돌 감지 레이어가 켜지면 배경(맵)의 "색"을 빼서
 * 감지 레이어가 화면의 유일한 컬러가 되게 한다.
 *
 * 테슬라 FSD 화면이 또렷한 이유는 밝기가 아니라 채도에 있다: 배경은
 * 거의 무채색이고 컬러는 경로(파랑)·정지선(빨강)·객체(회색)만 쓴다.
 * 조선소 맵은 베이지 도크·파란 지붕·주황 크레인처럼 채도가 높아서,
 * 아무리 어둡게 해도 sky 링과 amber 라벨이 배경과 색으로 경쟁한다.
 *
 * 그래서 두 가지를 함께 한다:
 *  1. 채도 제거 — 맵 머티리얼 색을 자기 휘도(luminance)의 회색으로 수렴.
 *     밝기 관계는 보존되므로 지형의 형태·깊이는 그대로 읽힌다.
 *  2. 약한 디밍 — 배경을 한 단계 뒤로 물리되, 지형 맥락(객체가 어디를
 *     지나는가)을 잃지 않을 만큼만.
 *
 * 감지 링·라벨·림 글로우는 전부 이미시브라 1·2 모두의 영향을 받지 않는다.
 * 전환은 지수 감쇠로 부드럽게, 언마운트 시 원본 색/밝기로 복원한다.
 */

/** 가드 ON 시 조명 배율 — 채도 제거가 대비를 만들므로 깊게 낮출 필요가 없다 */
const DIM_LEVEL = 0.75;
/** 가드 ON 시 남기는 채도 비율 (0 = 완전 무채색) */
const SATURATION_LEVEL = 0.15;
/** 전환 시상수 (s) */
const DIM_TAU = 0.35;

interface TrackedLight {
  light: Light;
  base: number;
}

interface TrackedMaterial {
  material: MeshStandardMaterial;
  base: Color;
  /** base의 회색(휘도) 버전 — 매 프레임 재계산하지 않도록 미리 만든다 */
  gray: Color;
}

/** 씬 재수집 주기 (s) — 늦게 로드되는 GLB를 놓치지 않기 위한 폴링 */
const RESCAN_INTERVAL = 1;

export function CollisionGuardFocusDim() {
  const enabled = useCollisionGuardStore((s) => s.enabled);
  const lightsRef = useRef<TrackedLight[]>([]);
  const materialsRef = useRef<TrackedMaterial[]>([]);
  const seenRef = useRef<Set<MeshStandardMaterial>>(new Set());
  const seenLightsRef = useRef<Set<Light>>(new Set());
  const rescanClockRef = useRef(RESCAN_INTERVAL);
  const levelRef = useRef(1);
  /** 새로 합류한 요소가 있어 이번 프레임에 반드시 칠해야 하는지 */
  const dirtyRef = useRef(false);

  useFrame((state, delta) => {
    // 맵·크레인 GLB는 비동기로 로드되므로 첫 프레임 1회 수집으로는
    // 놓친다. 주기적으로 재스캔하되 이미 본 것은 건너뛴다.
    rescanClockRef.current += delta;
    if (rescanClockRef.current >= RESCAN_INTERVAL) {
      rescanClockRef.current = 0;
      const lights = lightsRef.current;
      const materials = materialsRef.current;
      const seen = seenRef.current;
      const seenLights = seenLightsRef.current;
      const beforeCount = materials.length + lights.length;

      // 현재 적용 중인 배율 — 재스캔으로 새로 찾은 요소의 "원본" 값을
      // 역산하는 데 쓴다. 이미 디밍된 씬에 늦게 합류한 조명의 현재
      // intensity를 base로 잡으면 OFF 복원 시 원본보다 어두워진다.
      const curDim = DIM_LEVEL + (1 - DIM_LEVEL) * levelRef.current;

      state.scene.traverse((object) => {
        const light = object as Light;
        if (light.isLight) {
          if (seenLights.has(light)) return;
          seenLights.add(light);
          lights.push({ light, base: light.intensity / curDim });
          return;
        }

        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        const list = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const raw of list) {
          const material = raw as MeshStandardMaterial;
          if (!material?.isMeshStandardMaterial || seen.has(material)) continue;
          // 감지 레이어(링/화살표/객체)는 건드리지 않는다 — 이것들이
          // 화면의 컬러를 독점해야 한다. emissive 유무로 판정하면 맵·크레인
          // GLB도 emissive를 가져 배경이 통째로 제외되므로 명시 표식을 쓴다.
          if (isGuardLayer(material)) continue;
          seen.add(material);
          const base = material.color.clone();
          // Rec.709 휘도 — 사람 눈이 느끼는 밝기를 보존한 회색.
          const lum = 0.2126 * base.r + 0.7152 * base.g + 0.0722 * base.b;
          materials.push({
            material,
            base,
            gray: new Color(lum, lum, lum),
          });
        }
      });

      // 새로 합류한 요소가 있으면 이번 프레임에 반드시 칠한다 —
      // 전환이 이미 끝난 상태(level === target)면 아래 조기 반환에
      // 걸려 늦게 로드된 맵/크레인이 영영 원색으로 남는다.
      if (materials.length + lights.length > beforeCount) {
        dirtyRef.current = true;
      }
    }

    const target = enabled ? 0 : 1;
    const level = levelRef.current;
    if (level === target && !dirtyRef.current) return;
    dirtyRef.current = false;

    const k = 1 - Math.exp(-Math.min(delta, 0.1) / DIM_TAU);
    let next = level + (target - level) * k;
    if (Math.abs(next - target) < 0.004) next = target;
    levelRef.current = next;

    // level 1 = 원본, 0 = 완전 적용. 두 효과를 같은 진행도로 묶는다.
    const dim = DIM_LEVEL + (1 - DIM_LEVEL) * next;
    const saturation = SATURATION_LEVEL + (1 - SATURATION_LEVEL) * next;

    for (const { light, base } of lightsRef.current) {
      light.intensity = base * dim;
    }
    for (const { material, base, gray } of materialsRef.current) {
      material.color.copy(gray).lerp(base, saturation);
    }
  });

  // 언마운트 시 원본 밝기/색으로 복원.
  useEffect(
    () => () => {
      lightsRef.current.forEach(({ light, base }) => {
        light.intensity = base;
      });
      materialsRef.current.forEach(({ material, base }) => {
        material.color.copy(base);
      });
    },
    [],
  );

  return null;
}
