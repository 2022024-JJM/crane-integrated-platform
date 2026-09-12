import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CircleGeometry,
  DoubleSide,
  RingGeometry,
  Vector3,
  type Group,
  type MeshBasicMaterial,
} from 'three';
import {
  isValidZoneRadius,
  modelObjectRegistry,
  zoneCenterWorld,
  type SavedModelZone,
  type SavedSceneInfo,
} from '@crane/domain/3d';
import {
  ZONE_RING_WIDTH_RATIO,
  zoneGroundLift,
  zoneKey,
  zonePulsePhase,
  zoneRingOpacity,
} from '../lib/scene-zones';
import { sceneZoneRuntime } from '../model/scene-zone-runtime';
import { usePrefersReducedMotion } from '../model/use-prefers-reduced-motion';
import { useSceneZoneStore } from '../model/use-scene-zone-store';

/**
 * 모델 영역의 바닥 원·테두리·이름 배지. 에디터·모니터링(리플레이 포함) 공용.
 *
 * - 영역은 **모델 루트의 자식으로 portal 하지 않는다** — 모델 scale/yaw 를
 *   상속받으면 반경 단위가 깨진다(카탈로그 defaultScale 0.1). 씬 수준 형제로
 *   두고 useFrame 마다 registry 루트의 월드 위치를 읽어 따라간다. 루트의
 *   `updateWorldMatrix(true, false)` 로 이 프레임의 자세를 바로 읽어 주행
 *   크레인 뒤로 링이 끌리지 않게 한다.
 * - 단위 지오메트리(반경 1) + 그룹 scale=r — 반경 편집은 스칼라만 바뀌고
 *   지오메트리를 다시 만들지 않는다. 테두리 두께 비율은 그대로 유지된다.
 * - 침범 여부는 런타임 싱글턴을 프레임마다 직접 읽는다(zustand 구독 없음).
 *   채움·테두리 불투명도는 머티리얼에 직접 쓴다 — setState 없음.
 * - `meshBasicMaterial`·`toneMapped=false` 라 조명·낮밤(solar)과 무관하게
 *   영역 색이 그대로 보인다. renderOrder 1·2 — 바다(0.25) 뒤에 그려져 물 위
 *   에서도 덮이지 않는다(AGENTS.md 규칙 ≥ 0.5). depthWrite 없음, 그림자 없음.
 * - key 는 zoneKey(영역 id) — 중심값으로 key 를 만들면 매 틱 리마운트된다
 *   (골리앗 가드 문서의 실측 결함).
 *
 * 이름 배지는 `useSceneZoneStore.labelsVisible`(충돌 탭 토글)로 따로 끈다 —
 * 링·감지는 그대로 돌고 배지만 사라진다(영역이 많은 야드에서 화면을 덮는다).
 *
 * 에디터 규칙: 전역 토글이 꺼져 있어도 **선택된 모델**의 영역은 그린다
 * (반경을 편집하면서 보이지 않으면 편집이 불가능하다). 판정은 멈춘 상태라
 * 침범 표시는 없다. 모니터링은 `selectedModelId` 를 넘기지 않는다.
 */

const FILL_GEOMETRY = new CircleGeometry(1, 96);
const RING_GEOMETRY = new RingGeometry(1 - ZONE_RING_WIDTH_RATIO, 1, 128);
const LAY_FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];
const _center = new Vector3();
const noRaycast = () => null;

interface SceneZoneRingsProps {
  sceneInfo: SavedSceneInfo | null;
  /** 에디터 — 토글이 꺼져도 이 모델의 영역은 그린다(편집 피드백). */
  selectedModelId?: string | null;
}

export function SceneZoneRings({
  sceneInfo,
  selectedModelId = null,
}: SceneZoneRingsProps) {
  const enabled = useSceneZoneStore((s) => s.enabled);
  const labelsVisible = useSceneZoneStore((s) => s.labelsVisible);
  const reducedMotion = usePrefersReducedMotion();
  const models = sceneInfo?.models;
  if (!models) return null;
  return (
    <>
      {models.map((model) => {
        if (!model.zones?.length) return null;
        if (!enabled && model.id !== selectedModelId) return null;
        return model.zones.map((zone, index) =>
          isValidZoneRadius(zone.radius) ? (
            <ZoneRing
              key={zoneKey(model.id, zone.id)}
              ownerId={model.id}
              zone={zone}
              index={index}
              live={enabled}
              showLabel={labelsVisible}
              reducedMotion={reducedMotion}
            />
          ) : null,
        );
      })}
    </>
  );
}

function ZoneRing({
  ownerId,
  zone,
  index,
  live,
  showLabel,
  reducedMotion,
}: {
  ownerId: string;
  zone: SavedModelZone;
  index: number;
  /** false 면(토글 off·선택 모델만 표시) 침범 상태를 읽지 않는다. */
  live: boolean;
  /** 이름 배지(+침범자 수)를 그릴지. 링은 이 값과 무관하게 그린다. */
  showLabel: boolean;
  reducedMotion: boolean;
}) {
  const { t } = useTranslation();
  const key = zoneKey(ownerId, zone.id);
  const groupRef = useRef<Group>(null);
  const fillRef = useRef<MeshBasicMaterial>(null);
  const ringRef = useRef<MeshBasicMaterial>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  // 원시값 셀렉터 — 전이 때만 리렌더된다.
  const intruderCount = useSceneZoneStore(
    (s) => s.intrusions.find((i) => i.zoneKey === key)?.intruders.length ?? 0,
  );
  const radius = zone.radius;
  const lift = zoneGroundLift(radius);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    const root = modelObjectRegistry.get(ownerId);
    if (!root) {
      group.visible = false;
      if (badgeRef.current) badgeRef.current.hidden = true;
      return;
    }
    group.visible = true;
    if (badgeRef.current) badgeRef.current.hidden = false;
    root.updateWorldMatrix(true, false);
    zoneCenterWorld(root.matrixWorld, zone.offset, _center);
    group.position.set(_center.x, _center.y + lift, _center.z);

    const intruded = live && sceneZoneRuntime.isIntruded(key);
    const opacity = zoneRingOpacity(
      intruded,
      zonePulsePhase(state.clock.elapsedTime),
      reducedMotion,
    );
    if (fillRef.current) fillRef.current.opacity = opacity.fill;
    if (ringRef.current) ringRef.current.opacity = opacity.ring;
  });

  const name =
    zone.name || t('monitoring:sceneZone.unnamed', { index: index + 1 });

  return (
    <group ref={groupRef} scale={[radius, radius, radius]} visible={false}>
      <group rotation={LAY_FLAT}>
        <mesh geometry={FILL_GEOMETRY} renderOrder={1} raycast={noRaycast}>
          <meshBasicMaterial
            ref={fillRef}
            color={zone.color}
            transparent
            opacity={0.05}
            depthWrite={false}
            side={DoubleSide}
            toneMapped={false}
          />
        </mesh>
        <mesh geometry={RING_GEOMETRY} renderOrder={2} raycast={noRaycast}>
          <meshBasicMaterial
            ref={ringRef}
            color={zone.color}
            transparent
            opacity={0.8}
            depthWrite={false}
            side={DoubleSide}
            toneMapped={false}
          />
        </mesh>
      </group>
      {/* 링 +X 가장자리의 이름 배지. 라벨 [5,0]·충돌 표지 [6,0] 아래.
          침범 중엔 배지 우상단에 빨간 점·흰 숫자(이 영역의 침범자 수).
          충돌 탭의 "영역 이름 표시" 가 꺼지면 통째로 언마운트한다 — Html 은
          매 프레임 화면 좌표를 계산하므로 숨기기보다 빼는 쪽이 싸다. */}
      {showLabel ? (
        <Html center position={[1, 0, 0]} zIndexRange={[4, 0]}>
          <div
            ref={badgeRef}
            className="pointer-events-none relative flex items-center rounded-sm border-l-2 bg-black/60 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-white select-none"
            style={{ borderLeftColor: zone.color }}
          >
            <span>{name}</span>
            {intruderCount > 0 ? (
              <span
                aria-label={`intruders ${intruderCount}`}
                className="absolute -top-2 -right-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] leading-none font-bold text-white tabular-nums ring-1 ring-black/40"
              >
                {intruderCount > 99 ? '99+' : intruderCount}
              </span>
            ) : null}
          </div>
        </Html>
      ) : null}
    </group>
  );
}
