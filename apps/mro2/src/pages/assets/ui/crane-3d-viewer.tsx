import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box3, Vector3, type Object3D } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import {
  ThreeSceneViewer,
  type SceneController,
} from '@crane/ui/organisms/three-scene-viewer';
import { GltfModel, getCraneModel, type CraneZoneConfig } from '@crane/domain/3d';
import type { CraneType } from '@crane/domain/asset';
import type { Vector3Tuple } from '@crane/core/types/math';
import {
  computeFrontalView,
  computeFrontalViewFromBox,
  computeFrontalViewFromObjects,
} from '../lib/compute-frontal-view';
import { classifyPointToZone, regionToWorldBox } from '../lib/zone-hit';

// 3D 하이라이트는 다크 캔버스 위 고정 블루 (테마 변수는 three.js가 못 읽으므로 상수)
const REGION_HIGHLIGHT_COLOR = '#3b82f6';

interface Crane3dViewerProps {
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
      {/* Canvas에 `shadows`를 켜지 않으므로 castShadow는 효과가 없다 — 플래그만
          남으면 오해를 낳아 제거했다(scene-render-preset 주석 참고). */}
      <directionalLight position={[10, 20, 10]} intensity={3} />
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

  const subZonesByHost = useMemo(() => {
    const map = new Map<string, typeof zoneConfig.zones>();
    for (const zone of zoneConfig.zones) {
      if (!zone.subRegionsOf) continue;
      const list = map.get(zone.subRegionsOf) ?? [];
      list.push(zone);
      map.set(zone.subRegionsOf, list);
    }
    return map;
  }, [zoneConfig]);

  const [hostBoxes, setHostBoxes] = useState<Map<string, Box3>>(new Map());

  const handleObjectReady = useCallback(
    (zoneKey: string, object: Object3D | null) => {
      onZoneObjectReady(zoneKey, object);
      if (!object) return;
      if (subZonesByHost.has(zoneKey)) {
        object.updateWorldMatrix(true, true);
        const box = new Box3().setFromObject(object);
        setHostBoxes((prev) => new Map(prev).set(zoneKey, box));
      }
      readyCountRef.current += 1;
      if (readyCountRef.current === totalParts) onGroupReady();
    },
    [onZoneObjectReady, onGroupReady, totalParts, subZonesByHost],
  );

  const resolveZoneKey = useCallback(
    (hostKey: string, event?: ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>) => {
      const subZones = subZonesByHost.get(hostKey);
      const hostBox = hostBoxes.get(hostKey);
      if (!subZones || !hostBox || !event) return hostKey;
      return classifyPointToZone(event.point, hostBox, subZones)?.key ?? hostKey;
    },
    [subZonesByHost, hostBoxes],
  );

  const overlaySubZoneKey = [hoveredZoneKey, selectedZoneKey].find((key) =>
    zoneConfig.zones.some((z) => z.key === key && z.subRegionsOf),
  );
  const overlaySubZone = overlaySubZoneKey
    ? zoneConfig.zones.find((z) => z.key === overlaySubZoneKey)
    : undefined;
  const overlayHostBox = overlaySubZone?.subRegionsOf
    ? hostBoxes.get(overlaySubZone.subRegionsOf)
    : undefined;

  return (
    <>
      {zoneConfig.zones.map((zone) =>
        (zone.parts ?? []).map((part, i) => {
          const isHighlighted = hoveredZoneKey === zone.key || selectedZoneKey === zone.key;
          const isDimmed = selectedZoneKey !== null && selectedZoneKey !== zone.key;
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
              onSelect={(_id, event) => onZoneSelect(resolveZoneKey(zone.key, event))}
              onHoverStart={(_id, _x, _y, event) => onZoneHover(resolveZoneKey(zone.key, event))}
              onHoverMove={(_id, _x, _y, event) => onZoneHover(resolveZoneKey(zone.key, event))}
              onHoverEnd={() => onZoneHover(null)}
              onObjectReady={(_id, object) => handleObjectReady(zone.key, object)}
            />
          );
        }),
      )}
      {overlaySubZone && overlayHostBox && (
        <RegionOverlay
          zoneConfig={zoneConfig}
          zoneKey={overlaySubZone.key}
          modelBox={overlayHostBox}
          selected={overlaySubZone.key === selectedZoneKey}
        />
      )}
    </>
  );
}

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
          <mesh key={i} position={center} raycast={() => null} renderOrder={10}>
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
      onZoneSelect(classify(event)?.key ?? null);
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
export function Crane3dViewer({
  craneType,
  zoneConfig,
  hoveredZoneKey,
  selectedZoneKey,
  onZoneHover,
  onZoneSelect,
  className,
}: Crane3dViewerProps) {
  const cfg = getCraneModel(craneType);
  const controllerRef = useRef<SceneController | null>(null);
  const wholeObjectRef = useRef<Object3D | null>(null);
  const zoneObjectsRef = useRef<Map<string, Object3D>>(new Map());
  const [framedPreset, setFramedPreset] = useState<typeof cfg.cameraPreset | null>(null);

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
      const dist = new Vector3(...view.position).distanceTo(new Vector3(...view.target));
      setFramedPreset({
        defaultPosition: view.position,
        defaultTarget: view.target,
        topViewPosition: [view.target[0], view.target[1] + dist, view.target[2]],
        topViewTarget: view.target,
      });
    },
    [],
  );

  const frameWhole = useCallback(() => {
    if (zoneConfig.strategy === 'parts') {
      const parts = [...zoneObjectsRef.current.values()];
      if (parts.length === 0) return;
      applyWholeView(computeFrontalViewFromObjects(parts));
      return;
    }
    if (!wholeObjectRef.current) return;
    applyWholeView(computeFrontalView(wholeObjectRef.current));
  }, [applyWholeView, zoneConfig.strategy]);

  const handleControllerReady = useCallback((controller: SceneController | null) => {
    controllerRef.current = controller;
  }, []);

  const handleZoneObjectReady = useCallback((zoneKey: string, object: Object3D | null) => {
    if (object) zoneObjectsRef.current.set(zoneKey, object);
  }, []);

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

  useEffect(() => {
    if (zoneConfig.strategy !== 'parts' || !framedPreset) return;
    const controller = controllerRef.current;
    if (!controller) return;
    if (selectedZoneKey) {
      const zone = zoneConfig.zones.find((z) => z.key === selectedZoneKey);
      if (zone?.subRegionsOf) {
        const host = zoneObjectsRef.current.get(zone.subRegionsOf);
        if (!host) return;
        host.updateWorldMatrix(true, true);
        const hostBox = new Box3().setFromObject(host);
        const regionBox = new Box3();
        for (const region of zone.regions ?? []) {
          regionBox.union(regionToWorldBox(hostBox, region));
        }
        const view = computeFrontalViewFromBox(regionBox);
        if (view) controller.moveTo(view.position, view.target);
        return;
      }
      const object = zoneObjectsRef.current.get(selectedZoneKey);
      if (!object) return;
      const view = computeFrontalView(object);
      if (view) controller.moveTo(view.position, view.target);
    } else {
      controller.reset();
    }
  }, [selectedZoneKey, zoneConfig, framedPreset]);

  return (
    <div
      className={`overflow-hidden rounded-[4px] border ${className ?? ''}`}
      style={{ borderColor: 'var(--kc-border)', background: 'var(--canvas-background)' }}
    >
      <ThreeSceneViewer
        cameraPreset={framedPreset ?? cfg.cameraPreset}
        onControllerReady={handleControllerReady}
      >
        <SceneChrome />
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.01, 0]}
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
