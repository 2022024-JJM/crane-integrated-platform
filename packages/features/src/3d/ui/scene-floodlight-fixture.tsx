import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  Group,
  Sprite,
  SpriteMaterial,
  type Object3D,
} from 'three';
import {
  floodlightConeOutline,
  modelObjectRegistry,
  SELECTION_LINE_COLOR,
  SELECTION_LINE_WIDTH,
} from '@crane/domain/3d';
import type { Vector3Tuple } from '@crane/core/types/math';
import { createFloodlightGlowTexture } from '../lib/celestial-glow-texture';
import { sceneLightingInfo } from '../model/scene-lighting-info';
import { excludeFromReflection } from '../model/scene-reflection-exclusions';

/**
 * 투광등 **기구** — 조명마다 하나(세 캔버스 공용). 빛(SpotLight)은
 * SceneFloodlights 의 슬롯이 든다.
 *
 * - 글로우 스프라이트: 밤에 광원이 눈부시게 보이는 것이 "조명이 켜져 있다"
 *   는 가장 강한 단서라, 슬롯 밖이라 바닥을 못 비추는 먼 조명도 이것은
 *   전부 그린다. 불투명도는 SceneLighting 이 발행한 점등 비율
 *   (sceneLightingInfo.floodlightOn)을 매 프레임 따른다 — 낮엔 숨긴다.
 *   바다 미러 패스·미니맵 캡처에서는 뺀다(excludeFromReflection — 캡처는
 *   시각 무관 기준 조명으로 찍는데 글로우가 남으면 밤에 찍은 미니맵에만
 *   점이 박힌다).
 * - 편집 표시(`editing`): 클릭을 받는 기구 머리와 바닥까지의 기둥 선. 선택
 *   되면 조준선·콘 윤곽(lib/floodlight floodlightConeOutline)을 선택 색으로.
 *   관제 화면은 글로우만 — 클릭도 통과한다.
 * - 바깥 group 이 기즈모 대상·레지스트리 등록 객체다. 안쪽 좌표는 기구 기준
 *   로컬이라 조준 오프셋(aim)을 그대로 쓴다.
 */

/** 글로우 스프라이트 한 변(씬 unit). 거리로 줄어들되 수백 m 에서도 점이 남는 크기. */
const GLOW_SIZE = 10;
/** 편집 화면의 기구 머리 반경(씬 unit). */
const HEAD_RADIUS = 0.9;
const HEAD_COLOR = '#ffd27a';
const POLE_COLOR = '#9ca3af';
const LINE_WIDTH_PX = 1.2;

const noRaycast = () => null;

function useGlowSprite() {
  const sprite = useMemo(() => {
    const map = createFloodlightGlowTexture();
    if (!map) return null;
    const material = new SpriteMaterial({
      map,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      opacity: 0,
      // 표시 색 그대로 — 톤매핑이 난백색을 회색으로 누른다.
      toneMapped: false,
    });
    const object = new Sprite(material);
    object.scale.set(GLOW_SIZE, GLOW_SIZE, 1);
    object.visible = false;
    object.raycast = () => {};
    return object;
  }, []);

  useEffect(() => {
    if (!sprite) return;
    const release = excludeFromReflection(sprite);
    return () => {
      release();
      sprite.material.map?.dispose();
      sprite.material.dispose();
    };
  }, [sprite]);

  return sprite;
}

/** 점등 비율에 따라 글로우 불투명도를 쓴다 — 바뀐 프레임에만. */
function FloodlightGlow() {
  const sprite = useGlowSprite();
  const spriteRef = useRef<Sprite | null>(null);
  useFrame(() => {
    const glow = spriteRef.current;
    if (!glow) return;
    const on = sceneLightingInfo.floodlightOn;
    const visible = on > 0.001;
    if (glow.visible !== visible) glow.visible = visible;
    if (visible && glow.material.opacity !== on) glow.material.opacity = on;
  });
  if (!sprite) return null;
  return <primitive object={sprite} ref={spriteRef} />;
}

const ORIGIN: Vector3Tuple = [0, 0, 0];

/**
 * 편집 보조선 — 기둥(머리 → 조준점 높이의 바닥), 선택 시 조준선·콘 윤곽.
 * 전부 기구 로컬 좌표. renderOrder 1 은 바다 위 오버레이 규칙(≥ 0.5).
 */
function FloodlightGuides({
  aim,
  angle,
  selected,
}: {
  aim: Vector3Tuple;
  angle?: number;
  selected: boolean;
}) {
  const polePoints = useMemo<Vector3Tuple[]>(
    () => [ORIGIN, [0, aim[1], 0]],
    [aim],
  );
  const aimPoints = useMemo<Vector3Tuple[]>(() => [ORIGIN, aim], [aim]);
  const outline = useMemo(
    () => floodlightConeOutline({ position: ORIGIN, aim, angle }),
    [aim, angle],
  );
  return (
    <>
      <Line
        points={polePoints}
        color={POLE_COLOR}
        lineWidth={LINE_WIDTH_PX}
        renderOrder={1}
        raycast={noRaycast}
      />
      {selected ? (
        <>
          <Line
            points={aimPoints}
            color={SELECTION_LINE_COLOR}
            lineWidth={SELECTION_LINE_WIDTH}
            depthTest={false}
            renderOrder={1}
            raycast={noRaycast}
          />
          <Line
            points={outline.rim}
            color={SELECTION_LINE_COLOR}
            lineWidth={SELECTION_LINE_WIDTH}
            depthTest={false}
            renderOrder={1}
            raycast={noRaycast}
          />
          {outline.spokes.map((spoke, i) => (
            <Line
              // 윤곽 살은 자리(i)로 식별한다 — 개수가 고정이다.
              key={i}
              points={spoke}
              color={SELECTION_LINE_COLOR}
              lineWidth={SELECTION_LINE_WIDTH}
              depthTest={false}
              renderOrder={1}
              raycast={noRaycast}
            />
          ))}
        </>
      ) : null}
    </>
  );
}

interface SceneFloodlightFixtureProps {
  id: string;
  position: Vector3Tuple;
  aim: Vector3Tuple;
  angle?: number;
  isSelected?: boolean;
  /** 에디터 — 기구 머리·기둥을 그리고 머리가 클릭을 받는다. */
  editing?: boolean;
  onSelect?: (id: string) => void;
  onObjectReady?: (id: string, object: Object3D | null) => void;
}

export const SceneFloodlightFixture = memo(function SceneFloodlightFixture({
  id,
  position,
  aim,
  angle,
  isSelected = false,
  editing = false,
  onSelect,
  onObjectReady,
}: SceneFloodlightFixtureProps) {
  const groupRef = useRef<Group>(null);

  // SceneText 와 같은 ref 패턴 — 콜백 참조가 바뀔 때 effect 가 재발화해
  // 방금 선택된 다른 객체의 기즈모 타깃을 지우지 않게 한다.
  const onObjectReadyRef = useRef(onObjectReady);
  useEffect(() => {
    onObjectReadyRef.current = onObjectReady;
  }, [onObjectReady]);

  useEffect(() => {
    const group = groupRef.current;
    if (group) {
      modelObjectRegistry.register(id, group);
    }
    onObjectReadyRef.current?.(id, group);
    return () => {
      if (group) {
        modelObjectRegistry.unregister(id, group);
      }
      onObjectReadyRef.current?.(id, null);
    };
  }, [id]);

  const handleClick = useCallback(
    (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      onSelect?.(id);
    },
    [id, onSelect],
  );

  return (
    <group ref={groupRef} position={position}>
      <FloodlightGlow />
      {editing ? (
        <>
          <mesh
            onClick={handleClick}
            onPointerOver={(event) => {
              event.stopPropagation();
            }}
          >
            <sphereGeometry args={[HEAD_RADIUS, 16, 12]} />
            <meshBasicMaterial color={HEAD_COLOR} toneMapped={false} />
          </mesh>
          <FloodlightGuides aim={aim} angle={angle} selected={isSelected} />
        </>
      ) : null}
    </group>
  );
});

/**
 * 놓는 중의 미리보기 — 씬 데이터가 아니다. 기구 머리·기둥·조준선·콘 윤곽을
 * 선택 색으로 그린다(use-floodlight-place 의 상태).
 */
export function SceneFloodlightPreview({
  position,
  aim,
}: {
  position: Vector3Tuple;
  aim: Vector3Tuple;
}) {
  return (
    <group position={position}>
      <mesh raycast={noRaycast}>
        <sphereGeometry args={[HEAD_RADIUS, 16, 12]} />
        <meshBasicMaterial color={HEAD_COLOR} toneMapped={false} />
      </mesh>
      <FloodlightGuides aim={aim} selected />
    </group>
  );
}
