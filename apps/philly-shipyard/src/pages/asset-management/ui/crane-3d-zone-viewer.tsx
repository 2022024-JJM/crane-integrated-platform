import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box3, Vector3, type Object3D } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import {
  ThreeSceneViewer,
  type SceneController,
} from '@crane/ui/organisms/three-scene-viewer';
import {
  GltfModel,
  getCraneModel,
  type CraneZoneConfig,
} from '@crane/domain/3d';
import type { CraneType } from '@crane/domain/asset';
import type { Vector3Tuple } from '@crane/core/types/math';
import { cn } from '@crane/core/lib/utils';
import {
  computeFrontalView,
  computeFrontalViewFromObjects,
} from '../lib/compute-frontal-view';
import { classifyPointToZone } from '../lib/zone-hit';

// 하이라이트는 info 톤(#3b82f6) — GltfModel alarmSeverity 'info'와 동일 계열
const REGION_HIGHLIGHT_COLOR = '#3b82f6';

interface Crane3dZoneViewerProps {
  craneType: CraneType;
  zoneConfig: CraneZoneConfig;
  hoveredZoneKey: string | null;
  selectedZoneKey: string | null;
  onZoneHover: (key: string | null) => void;
  onZoneSelect: (key: string | null) => void;
  className?: string;
}

function SceneChrome() {
  return (
    <>
      <ambientLight intensity={2.5} />
      <directionalLight position={[10, 20, 10]} intensity={3} castShadow />
      <directionalLight position={[-5, 10, -5]} intensity={1} />
      <hemisphereLight args={['#b1e1ff', '#b97a20', 0.5]} />
      <gridHelper args={[60, 30, '#333355', '#222244']} />
    </>
  );
}

/** parts 전략: 존별 GLB 파트를 조립 렌더, 파트 단위 hover/클릭 */
function PartsScene({
  zoneConfig,
  hoveredZoneKey,
  selectedZoneKey,
  onZoneHover,
  onZoneSelect,
  onGroupReady,
  onZoneObjectReady,
}: {
  zoneConfig: CraneZoneConfig;
  hoveredZoneKey: string | null;
  selectedZoneKey: string | null;
  onZoneHover: (key: string | null) => void;
  onZoneSelect: (key: string | null) => void;
  onGroupReady: () => void;
  onZoneObjectReady: (zoneKey: string, object: Object3D | null) => void;
}) {
  const totalParts = useMemo(
    () => zoneConfig.zones.reduce((n, z) => n + (z.parts?.length ?? 0), 0),
    [zoneConfig],
  );
  const readyCountRef = useRef(0);

  const handleObjectReady = useCallback(
    (zoneKey: string, object: Object3D | null) => {
      onZoneObjectReady(zoneKey, object);
      if (!object) return;
      readyCountRef.current += 1;
      if (readyCountRef.current === totalParts) onGroupReady();
    },
    [onZoneObjectReady, onGroupReady, totalParts],
  );

  return (
    <>
      {zoneConfig.zones.map((zone) =>
        (zone.parts ?? []).map((part, i) => {
          const isHighlighted =
            hoveredZoneKey === zone.key || selectedZoneKey === zone.key;
          const isDimmed =
            selectedZoneKey !== null && selectedZoneKey !== zone.key;
          return (
            <GltfModel
              key={`${zone.key}-${i}`}
              id={`zone-${zone.key}-${i}`}
              url={part.url}
              position={part.position}
              scale={part.scale}
              showLabel={false}
              isSensorOccluder={false}
              opacity={isDimmed ? 0.35 : 1}
              alarmSeverity={isHighlighted ? 'info' : null}
              alarmHighlightMesh={isHighlighted}
              isSelected={selectedZoneKey === zone.key}
              onSelect={() => onZoneSelect(zone.key)}
              onHoverStart={() => onZoneHover(zone.key)}
              onHoverEnd={() => onZoneHover(null)}
              onObjectReady={(_id, object) => handleObjectReady(zone.key, object)}
            />
          );
        }),
      )}
    </>
  );
}

/** regions 전략: 히트 지점의 존 하이라이트용 반투명 영역 박스 */
function RegionOverlay({
  zoneConfig,
  zoneKey,
  modelBox,
  selected,
}: {
  zoneConfig: CraneZoneConfig;
  zoneKey: string;
  modelBox: Box3;
  selected: boolean;
}) {
  const zone = zoneConfig.zones.find((z) => z.key === zoneKey);
  if (!zone) return null;
  const size = new Vector3();
  modelBox.getSize(size);

  return (
    <>
      {(zone.regions ?? []).map((region, i) => {
        const [minX, minY, minZ] = region.min;
        const [maxX, maxY, maxZ] = region.max;
        const boxSize: [number, number, number] = [
          (maxX - minX) * size.x,
          (maxY - minY) * size.y,
          (maxZ - minZ) * size.z,
        ];
        const center: [number, number, number] = [
          modelBox.min.x + ((minX + maxX) / 2) * size.x,
          modelBox.min.y + ((minY + maxY) / 2) * size.y,
          modelBox.min.z + ((minZ + maxZ) / 2) * size.z,
        ];
        return (
          <mesh
            key={i}
            position={center}
            raycast={() => null}
            renderOrder={10}
          >
            <boxGeometry args={boxSize} />
            <meshBasicMaterial
              color={REGION_HIGHLIGHT_COLOR}
              transparent
              opacity={selected ? 0.28 : 0.15}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </>
  );
}

/** regions 전략: 단일 모델 + 히트 지점 분류 */
function RegionsScene({
  craneType,
  zoneConfig,
  hoveredZoneKey,
  selectedZoneKey,
  onZoneHover,
  onZoneSelect,
  onModelReady,
}: {
  craneType: CraneType;
  zoneConfig: CraneZoneConfig;
  hoveredZoneKey: string | null;
  selectedZoneKey: string | null;
  onZoneHover: (key: string | null) => void;
  onZoneSelect: (key: string | null) => void;
  onModelReady: (object: Object3D | null) => void;
}) {
  const cfg = getCraneModel(craneType);
  const [modelBox, setModelBox] = useState<Box3 | null>(null);
  const boxRef = useRef<Box3 | null>(null);

  const handleObjectReady = useCallback(
    (_id: string, object: Object3D | null) => {
      if (object) {
        object.updateWorldMatrix(true, true);
        const box = new Box3().setFromObject(object);
        boxRef.current = box;
        setModelBox(box);
      }
      onModelReady(object);
    },
    [onModelReady],
  );

  const classify = useCallback(
    (event?: ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>) => {
      const box = boxRef.current;
      if (!event || !box) return null;
      return classifyPointToZone(event.point, box, zoneConfig.zones);
    },
    [zoneConfig],
  );

  const handleHover = useCallback(
    (_id: string, _x: number, _y: number, event?: ThreeEvent<PointerEvent>) => {
      onZoneHover(classify(event)?.key ?? null);
    },
    [classify, onZoneHover],
  );

  const handleSelect = useCallback(
    (_id: string, event?: ThreeEvent<MouseEvent>) => {
      const zone = classify(event);
      onZoneSelect(zone?.key ?? null);
    },
    [classify, onZoneSelect],
  );

  const overlayKey = hoveredZoneKey ?? selectedZoneKey;

  return (
    <>
      <GltfModel
        id={`asset-3d-${craneType}`}
        url={cfg.url}
        scale={cfg.scale}
        showLabel={false}
        isSensorOccluder={false}
        onSelect={handleSelect}
        onHoverStart={handleHover}
        onHoverMove={handleHover}
        onHoverEnd={() => onZoneHover(null)}
        onObjectReady={handleObjectReady}
      />
      {modelBox && overlayKey && (
        <RegionOverlay
          zoneConfig={zoneConfig}
          zoneKey={overlayKey}
          modelBox={modelBox}
          selected={overlayKey === selectedZoneKey}
        />
      )}
    </>
  );
}

/** 자산 상세 3D 탭 좌측 뷰어 — 구역 hover/클릭 선택 */
export function Crane3dZoneViewer({
  craneType,
  zoneConfig,
  hoveredZoneKey,
  selectedZoneKey,
  onZoneHover,
  onZoneSelect,
  className,
}: Crane3dZoneViewerProps) {
  const cfg = getCraneModel(craneType);
  const controllerRef = useRef<SceneController | null>(null);
  const wholeObjectRef = useRef<Object3D | null>(null);
  const zoneObjectsRef = useRef<Map<string, Object3D>>(new Map());

  /**
   * 모델 로드 후 계산한 정면 뷰를 카메라 "프리셋"으로 주입한다.
   * 이렇게 하면 툴바 리셋(↺)·줌 %(100% = 정면 전체 뷰)·선택 해제 복귀가
   * 전부 같은 기준을 공유해 시선이 어긋나지 않는다.
   */
  const [framedPreset, setFramedPreset] = useState<
    typeof cfg.cameraPreset | null
  >(null);

  // hover 중 커서 포인터
  useEffect(() => {
    if (!hoveredZoneKey) return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = 'pointer';
    return () => {
      document.body.style.cursor = prev;
    };
  }, [hoveredZoneKey]);

  const applyWholeView = useCallback(
    (view: { position: Vector3Tuple; target: Vector3Tuple } | null) => {
      if (!view) return;
      const dist = new Vector3(...view.position).distanceTo(
        new Vector3(...view.target),
      );
      setFramedPreset({
        defaultPosition: view.position,
        defaultTarget: view.target,
        topViewPosition: [
          view.target[0],
          view.target[1] + dist,
          view.target[2],
        ],
        topViewTarget: view.target,
      });
    },
    [],
  );

  const frameWhole = useCallback(() => {
    // parts 전략: 파트들의 합집합 박스만 프레이밍 (씬 부모는 바닥 그리드 포함이라 금지)
    if (zoneConfig.strategy === 'parts') {
      const parts = [...zoneObjectsRef.current.values()];
      if (parts.length === 0) return;
      applyWholeView(computeFrontalViewFromObjects(parts));
      return;
    }
    if (!wholeObjectRef.current) return;
    applyWholeView(computeFrontalView(wholeObjectRef.current));
  }, [applyWholeView, zoneConfig.strategy]);

  const handleControllerReady = useCallback(
    (controller: SceneController | null) => {
      controllerRef.current = controller;
    },
    [],
  );

  // parts: 전 파트 로드 완료 시 전체 프레이밍용 그룹 구성
  const handleZoneObjectReady = useCallback(
    (zoneKey: string, object: Object3D | null) => {
      if (object) zoneObjectsRef.current.set(zoneKey, object);
    },
    [],
  );

  const handlePartsGroupReady = useCallback(() => {
    frameWhole();
  }, [frameWhole]);

  const handleSingleModelReady = useCallback(
    (object: Object3D | null) => {
      wholeObjectRef.current = object;
      frameWhole();
    },
    [frameWhole],
  );

  // 존 선택 → 해당 파트로 줌인, 해제 → 정면 전체 뷰(=리셋 기준) 복귀 (parts 전략만)
  useEffect(() => {
    if (zoneConfig.strategy !== 'parts' || !framedPreset) return;
    const controller = controllerRef.current;
    if (!controller) return;
    if (selectedZoneKey) {
      const object = zoneObjectsRef.current.get(selectedZoneKey);
      if (!object) return;
      const view = computeFrontalView(object);
      if (view) controller.moveTo(view.position, view.target);
    } else {
      controller.reset();
    }
  }, [selectedZoneKey, zoneConfig.strategy, framedPreset]);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border',
        className,
      )}
      style={{ background: 'var(--canvas-background)' }}
    >
      <ThreeSceneViewer
        cameraPreset={framedPreset ?? cfg.cameraPreset}
        onControllerReady={handleControllerReady}
      >
        <SceneChrome />
        {/* 바닥면 클릭 = 빈 공간 클릭 → 선택 해제 */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.01, 0]}
          receiveShadow
          onClick={(e) => {
            e.stopPropagation();
            onZoneSelect(null);
          }}
        >
          <planeGeometry args={[60, 60]} />
          <meshStandardMaterial color="#1a1a2e" opacity={0.3} transparent />
        </mesh>
        <Suspense fallback={null}>
          {zoneConfig.strategy === 'parts' ? (
            <PartsScene
              zoneConfig={zoneConfig}
              hoveredZoneKey={hoveredZoneKey}
              selectedZoneKey={selectedZoneKey}
              onZoneHover={onZoneHover}
              onZoneSelect={onZoneSelect}
              onGroupReady={handlePartsGroupReady}
              onZoneObjectReady={handleZoneObjectReady}
            />
          ) : (
            <RegionsScene
              craneType={craneType}
              zoneConfig={zoneConfig}
              hoveredZoneKey={hoveredZoneKey}
              selectedZoneKey={selectedZoneKey}
              onZoneHover={onZoneHover}
              onZoneSelect={onZoneSelect}
              onModelReady={handleSingleModelReady}
            />
          )}
        </Suspense>
      </ThreeSceneViewer>
    </div>
  );
}
