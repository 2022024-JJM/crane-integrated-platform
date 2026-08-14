import {
  ChevronDown,
  Cuboid,
  Eye,
  Lock,
  LockOpen,
  Map as MapIcon,
  Palette,
  SlidersHorizontal,
  Tag,
  Type,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  humanizeModelPath,
  isCameraSensor,
  isLidarSensor,
  type SavedCameraSensorInfo,
  type SavedLidarSensorInfo,
  type SavedMapInfo,
  type SavedModelInfo,
  type SavedSensorInfo,
  type SavedTextInfo,
  type ValueMapItem,
  type ValueMapType,
} from '@crane/domain/3d';
import type { Vector3Tuple } from '@crane/core/types/math';
import { cn } from '@crane/core/lib/utils';
import {
  type AxisKey,
  PositionController,
  RotationController,
  ScaleController,
  type SceneTransformField,
  type SelectedMeshInfo,
  useActiveTransformStore,
  useIsMapLocked,
} from '@crane/features/3d';
import { ArrowLeft } from 'lucide-react';
import { Input } from '@crane/ui/atoms/input';
import { Card, CardContent } from '@crane/ui/molecules/card';

// 지도 transform은 optional이라(기존 저장본 호환) 표시용 기본값이 필요하다.
// 렌더러가 쓰는 GltfModel 기본값과 같은 값이어야 인스펙터 수치와 화면이 일치한다.
const DEFAULT_MAP_POSITION: Vector3Tuple = [0, 0, 0];
const DEFAULT_MAP_ROTATION: Vector3Tuple = [0, 0, 0];
const DEFAULT_MAP_SCALE: Vector3Tuple = [1, 1, 1];

/** Vision PiP 채널 정의. app 레이어가 자기 도메인의 채널 목록을 주입한다. */
export interface VisionChannelOption {
  id: string;
  label: string;
  sensorType: 'camera' | 'lidar';
}

interface SceneObjectInspectorProps {
  selectedModel: SavedModelInfo | null;
  selectedText: SavedTextInfo | null;
  selectedSensor?: SavedSensorInfo | null;
  selectedMesh: SelectedMeshInfo | null;
  selectedMap?: SavedMapInfo | null;
  multiSelectCount?: number;
  /**
   * 인스펙터의 비전 채널 드롭다운에 노출할 채널 목록. 비어있거나 미지정 시
   * 채널 매핑 UI 자체가 표시되지 않는다.
   */
  visionChannels?: readonly VisionChannelOption[];
  /** 현재 씬의 모든 센서. 다른 센서가 이미 점유한 채널을 disabled 표시하기 위해. */
  allSensors?: readonly SavedSensorInfo[];
  onNameChange: (name: string) => void;
  onOpacityChange: (value: number) => void;
  onTransformChange: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => void;
  onTextContentChange: (content: string) => void;
  onTextColorChange: (color: string) => void;
  onTextTransformChange: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => void;
  onMeshNameChange: (name: string) => void;
  onMeshOpacityChange: (value: number) => void;
  onMeshTransformChange: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => void;
  /** 센서 설정 변경 콜백. (id, partial settings) — discriminated union이라
   *  서브컴포넌트 쪽에서 정확한 type별 patch를 보장한다. */
  onSensorChange?: (
    id: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    patch: Record<string, any>,
  ) => void;
  /** mesh 선택을 풀고 부모 모델로 돌아가는 콜백. */
  onBackToParent: () => void;
  /** 지도 transform 변경 콜백. 미지정 시 지도 인스펙터는 읽기 전용이 된다. */
  onMapTransformChange?: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => void;
  /** 지도 편집 잠금 토글 콜백. */
  onToggleMapLock?: (id: string, locked: boolean) => void;
  /** 모델의 태그 매핑 변경 콜백. key가 빈 문자열이면 해당 type 매핑을 삭제한다. */
  onValueMapChange?: (type: ValueMapType, key: string, scale?: number, offset?: number) => void;
}

interface InspectorSectionProps {
  title: string;
  icon: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

interface TransformGroupProps {
  title: string;
  children: ReactNode;
}

function InspectorSection({
  title,
  icon,
  defaultOpen = true,
  children,
}: InspectorSectionProps) {
  return (
    <details
      open={defaultOpen}
      className="group border-border bg-card rounded-lg border"
    >
      <summary className="text-foreground flex cursor-pointer list-none items-center justify-between px-2.5 py-2 text-[12px] font-medium">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span>{title}</span>
        </div>
        <ChevronDown className="text-muted-foreground/60 size-3.5 transition group-open:rotate-180" />
      </summary>
      <div className="border-border border-t px-2.5 py-2.5">{children}</div>
    </details>
  );
}

function TransformGroup({ title, children }: TransformGroupProps) {
  return (
    <div className="border-border bg-muted/50 rounded-md border px-2.5 py-2">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
          {title}
        </p>
        <span className="bg-border h-px flex-1" />
      </div>
      {children}
    </div>
  );
}

const VALUE_MAP_GROUPS: { label: string; types: ValueMapType[] }[] = [
  { label: 'Position', types: ['PX', 'PY', 'PZ'] },
  { label: 'Rotation', types: ['RX', 'RY', 'RZ'] },
];

const VALUE_MAP_AXIS_LABEL: Record<ValueMapType, string> = {
  PX: 'X', PY: 'Y', PZ: 'Z',
  RX: 'X', RY: 'Y', RZ: 'Z',
  SX: 'X', SY: 'Y', SZ: 'Z',
};

const POSITION_TYPES = new Set<ValueMapType>(['PX', 'PY', 'PZ']);

function TagMappingSection({
  valueMapList,
  craneId,
  onValueMapChange,
  t,
}: {
  valueMapList: ValueMapItem[];
  craneId?: string;
  onValueMapChange: (type: ValueMapType, key: string, scale?: number, offset?: number) => void;
  t: (key: string) => string;
}) {
  const prefix = craneId ? `${craneId}:` : '';

  const getTagCode = (type: ValueMapType) => {
    const key = valueMapList.find((item) => item.type === type)?.key ?? '';
    return key.startsWith(prefix) ? key.slice(prefix.length) : key;
  };
  const getScale = (type: ValueMapType) =>
    valueMapList.find((item) => item.type === type)?.scale ?? 1;
  const getOffset = (type: ValueMapType) =>
    valueMapList.find((item) => item.type === type)?.offset ?? 0;

  // offset 입력 중간 상태(소수점, 음수 부호 등)를 허용하기 위해 로컬 draft 관리
  const initialOffsetDrafts = () =>
    Object.fromEntries(
      (['PX', 'PY', 'PZ'] as ValueMapType[]).map((t) => [t, String(getOffset(t))]),
    ) as Record<ValueMapType, string>;

  const [offsetDrafts, setOffsetDrafts] = useState<Record<ValueMapType, string>>(initialOffsetDrafts);

  // 외부에서 valueMapList가 바뀔 때(저장 후 로드 등) draft를 동기화
  useEffect(() => {
    setOffsetDrafts({
      PX: String(getOffset('PX')),
      PY: String(getOffset('PY')),
      PZ: String(getOffset('PZ')),
      RX: '0', RY: '0', RZ: '0',
      SX: '0', SY: '0', SZ: '0',
    });
    // valueMapList 참조가 바뀔 때만 동기화
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueMapList]);

  return (
    <InspectorSection
      title={t('monitoring:inspector.tagMapping')}
      icon={<Tag className="size-4" />}
      defaultOpen={false}
    >
      {craneId ? (
        <p className="text-muted-foreground mb-2 text-[10px]">
          크레인 ID: <span className="text-foreground font-mono">{craneId}</span>
        </p>
      ) : null}
      <div className="space-y-3">
        {VALUE_MAP_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase">
              {group.label}
            </p>
            <div className="space-y-1.5">
              {group.types.map((type) => {
                const tagCode = getTagCode(type);
                const isPosition = POSITION_TYPES.has(type);
                return (
                  <div key={type} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-muted-foreground w-4 shrink-0 text-center font-mono">
                        {VALUE_MAP_AXIS_LABEL[type]}
                      </span>
                      <Input
                        value={tagCode}
                        placeholder={t('monitoring:inspector.tagKeyPlaceholder')}
                        className="border-border bg-muted text-foreground placeholder:text-muted-foreground h-7 flex-1 rounded-sm px-2 text-[11px]"
                        onChange={(e) => {
                          const fullKey = e.target.value.trim()
                            ? `${prefix}${e.target.value.trim()}`
                            : '';
                          onValueMapChange(type, fullKey, getScale(type), isPosition ? getOffset(type) : undefined);
                        }}
                      />
                    </div>
                    {tagCode ? (
                      <>
                        <div className="ml-6 flex items-center gap-2 text-[11px]">
                          <span className="text-muted-foreground w-8 shrink-0 text-[10px]">
                            scale
                          </span>
                          <Input
                            type="number"
                            step={0.1}
                            value={getScale(type)}
                            placeholder="1"
                            className="border-border bg-muted text-foreground placeholder:text-muted-foreground h-6 w-full rounded-sm px-2 text-[11px]"
                            onChange={(e) => {
                              const s = parseFloat(e.target.value);
                              if (Number.isFinite(s)) {
                                onValueMapChange(type, `${prefix}${tagCode}`, s, isPosition ? getOffset(type) : undefined);
                              }
                            }}
                          />
                        </div>
                        {isPosition ? (
                          <div className="ml-6 flex items-center gap-2 text-[11px]">
                            <span className="text-muted-foreground w-8 shrink-0 text-[10px]">
                              offset
                            </span>
                            <Input
                              type="number"
                              step="any"
                              value={offsetDrafts[type] ?? '0'}
                              placeholder="0"
                              className="border-border bg-muted text-foreground placeholder:text-muted-foreground h-6 w-full rounded-sm px-2 text-[11px]"
                              onChange={(e) => {
                                const raw = e.target.value;
                                setOffsetDrafts((prev) => ({ ...prev, [type]: raw }));
                                const o = parseFloat(raw);
                                if (Number.isFinite(o)) {
                                  onValueMapChange(type, `${prefix}${tagCode}`, getScale(type), o);
                                }
                              }}
                            />
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </InspectorSection>
  );
}

interface TransformSectionProps {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  onTransformChange: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => void;
  t: (key: string) => string;
}

function TransformSection({
  position,
  rotation,
  scale,
  onTransformChange,
  t,
}: TransformSectionProps) {
  // 드래그 중에는 sceneInfo write가 끊긴 상태이므로 props로 받은 값이 멈춘다.
  // active=true 일 때는 transient store의 라이브 값을 표시해 숫자가 실시간으로
  // 따라가도록 한다. 드래그가 끝나면 active=false가 되며 sceneInfo의 commit된
  // 값(=props)으로 자연스럽게 돌아간다.
  const isActive = useActiveTransformStore((s) => s.active);
  const livePosition = useActiveTransformStore((s) => s.position);
  const liveRotation = useActiveTransformStore((s) => s.rotation);
  const liveScale = useActiveTransformStore((s) => s.scale);

  const displayPosition = isActive && livePosition ? livePosition : position;
  const displayRotation = isActive && liveRotation ? liveRotation : rotation;
  const displayScale = isActive && liveScale ? liveScale : scale;

  return (
    <InspectorSection
      title={t('monitoring:transform.title')}
      icon={<Cuboid className="size-4" />}
    >
      <div className="space-y-2.5">
        <TransformGroup title={t('monitoring:inspector.position')}>
          <PositionController
            vec={displayPosition}
            onChange={(axis, value) => {
              onTransformChange('position', axis, value);
            }}
          />
        </TransformGroup>
        <TransformGroup title={t('monitoring:inspector.rotation')}>
          <RotationController
            vec={displayRotation}
            onChange={(axis, value) => {
              onTransformChange('rotation', axis, value);
            }}
          />
        </TransformGroup>
        <TransformGroup title={t('monitoring:inspector.scale')}>
          <ScaleController
            vec={displayScale}
            onChange={(axis, value) => {
              onTransformChange('scale', axis, value);
            }}
          />
        </TransformGroup>
      </div>
    </InspectorSection>
  );
}

function ModelInspectorContent({
  selectedModel,
  selectedLabel,
  nameDraft,
  setNameDraft,
  selectedOpacity,
  onNameChange,
  onOpacityChange,
  onTransformChange,
  onValueMapChange,
  t,
}: {
  selectedModel: SavedModelInfo;
  selectedLabel: string;
  nameDraft: string;
  setNameDraft: (v: string) => void;
  selectedOpacity: number;
  onNameChange: (name: string) => void;
  onOpacityChange: (value: number) => void;
  onTransformChange: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => void;
  onValueMapChange?: (type: ValueMapType, key: string, scale?: number, offset?: number) => void;
  t: (key: string) => string;
}) {
  return (
    <>
      <InspectorSection
        title={t('monitoring:inspector.name')}
        icon={<SlidersHorizontal className="size-4" />}
      >
        <Input
          value={nameDraft}
          aria-label={t('monitoring:inspector.name')}
          className="border-border bg-muted text-foreground placeholder:text-muted-foreground h-8 cursor-text rounded-sm px-2 text-[12px]"
          onChange={(event) => {
            const nextValue = event.target.value;
            setNameDraft(nextValue);
            onNameChange(nextValue);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setNameDraft(selectedLabel);
              event.currentTarget.blur();
            }
          }}
        />
      </InspectorSection>

      <TransformSection
        position={selectedModel.position}
        rotation={selectedModel.rotation}
        scale={selectedModel.scale}
        onTransformChange={onTransformChange}
        t={t}
      />

      <InspectorSection
        title={t('monitoring:inspector.opacity')}
        icon={<Eye className="size-4" />}
      >
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.1}
            value={selectedOpacity}
            className="accent-primary h-2 w-full cursor-pointer"
            onChange={(event) => {
              onOpacityChange(Number(event.target.value));
            }}
          />
          <span className="text-muted-foreground w-8 text-right text-[12px] tabular-nums">
            {selectedOpacity.toFixed(1)}
          </span>
        </div>
      </InspectorSection>

      {onValueMapChange ? (
        <TagMappingSection
          valueMapList={selectedModel.valueMapList}
          craneId={selectedModel.craneId}
          onValueMapChange={onValueMapChange}
          t={t}
        />
      ) : null}
    </>
  );
}

function MeshInspectorContent({
  selectedMesh,
  meshNameDraft,
  setMeshNameDraft,
  onMeshNameChange,
  onMeshOpacityChange,
  onMeshTransformChange,
  onBackToParent,
  t,
}: {
  selectedMesh: SelectedMeshInfo;
  meshNameDraft: string;
  setMeshNameDraft: (v: string) => void;
  onMeshNameChange: (name: string) => void;
  onMeshOpacityChange: (value: number) => void;
  onMeshTransformChange: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => void;
  onBackToParent: () => void;
  t: (key: string) => string;
}) {
  const override = selectedMesh.override;
  // override가 없는 axis는 mesh 객체의 현재 transform을 표시(GLTF 원본 또는
  // 마지막 적용 상태). 사용자가 첫 입력을 할 때 그 값에서 시작하기 위함.
  const meshObj = selectedMesh.meshObject;
  const defaultPosition: [number, number, number] = meshObj
    ? [meshObj.position.x, meshObj.position.y, meshObj.position.z]
    : [0, 0, 0];
  const defaultRotation: [number, number, number] = meshObj
    ? [
        (meshObj.rotation.x * 180) / Math.PI,
        (meshObj.rotation.y * 180) / Math.PI,
        (meshObj.rotation.z * 180) / Math.PI,
      ]
    : [0, 0, 0];
  const defaultScale: [number, number, number] = meshObj
    ? [meshObj.scale.x, meshObj.scale.y, meshObj.scale.z]
    : [1, 1, 1];
  const position = override?.position ?? defaultPosition;
  const rotation = override?.rotation ?? defaultRotation;
  const scale = override?.scale ?? defaultScale;
  const opacity = override?.opacity ?? 1;
  // 자식 mesh의 표시 이름 우선순위: override.name → mesh segment의 마지막 이름
  // (path 의 [idx]name 마지막 부분) → meshPath 자체.
  const lastSegment = selectedMesh.meshPath.split('/').pop() ?? '';
  const segmentName = /^\[\d+\](.*)$/.exec(lastSegment)?.[1] ?? lastSegment;
  const displayName = override?.name || segmentName || selectedMesh.meshPath;

  return (
    <>
      <button
        type="button"
        onClick={onBackToParent}
        className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 px-1 text-[11px] transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        {selectedMesh.parentModel.equipName || selectedMesh.parentModel.id}
      </button>

      <InspectorSection
        title={t('monitoring:inspector.name')}
        icon={<SlidersHorizontal className="size-4" />}
      >
        <Input
          value={meshNameDraft}
          aria-label={t('monitoring:inspector.name')}
          className="border-border bg-muted text-foreground placeholder:text-muted-foreground h-8 cursor-text rounded-sm px-2 text-[12px]"
          onChange={(event) => {
            const nextValue = event.target.value;
            setMeshNameDraft(nextValue);
            onMeshNameChange(nextValue);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setMeshNameDraft(displayName);
              event.currentTarget.blur();
            }
          }}
        />
      </InspectorSection>

      <TransformSection
        position={position}
        rotation={rotation}
        scale={scale}
        onTransformChange={onMeshTransformChange}
        t={t}
      />

      <InspectorSection
        title={t('monitoring:inspector.opacity')}
        icon={<Eye className="size-4" />}
      >
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.1}
            value={opacity}
            className="accent-primary h-2 w-full cursor-pointer"
            onChange={(event) => {
              onMeshOpacityChange(Number(event.target.value));
            }}
          />
          <span className="text-muted-foreground w-8 text-right text-[12px] tabular-nums">
            {opacity.toFixed(1)}
          </span>
        </div>
      </InspectorSection>
    </>
  );
}

function TextInspectorContent({
  selectedText,
  contentDraft,
  setContentDraft,
  onTextContentChange,
  onTextColorChange,
  onTextTransformChange,
  t,
}: {
  selectedText: SavedTextInfo;
  contentDraft: string;
  setContentDraft: (v: string) => void;
  onTextContentChange: (content: string) => void;
  onTextColorChange: (color: string) => void;
  onTextTransformChange: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => void;
  t: (key: string) => string;
}) {
  return (
    <>
      <InspectorSection
        title={t('monitoring:inspector.textContent')}
        icon={<Type className="size-4" />}
      >
        <Input
          value={contentDraft}
          aria-label={t('monitoring:inspector.textContent')}
          className="border-border bg-muted text-foreground placeholder:text-muted-foreground h-8 cursor-text rounded-sm px-2 text-[12px]"
          onChange={(event) => {
            const nextValue = event.target.value;
            setContentDraft(nextValue);
            onTextContentChange(nextValue);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setContentDraft(selectedText.content);
              event.currentTarget.blur();
            }
          }}
        />
      </InspectorSection>

      <InspectorSection
        title={t('monitoring:inspector.textColor')}
        icon={<Palette className="size-4" />}
      >
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={selectedText.color}
            className="border-border h-8 w-10 cursor-pointer rounded-sm border bg-transparent"
            onChange={(event) => {
              onTextColorChange(event.target.value);
            }}
          />
          <span className="text-muted-foreground text-[12px]">
            {selectedText.color}
          </span>
        </div>
      </InspectorSection>

      <TransformSection
        position={selectedText.position}
        rotation={selectedText.rotation}
        scale={selectedText.scale}
        onTransformChange={onTextTransformChange}
        t={t}
      />
    </>
  );
}

/**
 * 지도 인스펙터 — transform과 잠금 토글만 있다.
 *
 * 지도에는 모델의 이름/투명도/태그 매핑에 해당하는 개념이 없다. 파일에서
 * 온 지형이라 이름은 경로가 곧 정체이고, 투명도를 낮추면 그 위 객체의
 * 기준면이 사라져 배치 작업 자체가 불가능해진다. 그래서 편집 가능한 것은
 * 배치(transform)와 "지금 편집 대상인가"(잠금)뿐이다.
 */
function MapInspectorContent({
  selectedMap,
  onTransformChange,
  onToggleLock,
  t,
}: {
  selectedMap: SavedMapInfo;
  onTransformChange: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => void;
  onToggleLock?: (id: string, locked: boolean) => void;
  t: (key: string) => string;
}) {
  const locked = useIsMapLocked(selectedMap.id);

  return (
    <>
      <InspectorSection
        title={t('monitoring:editor.map')}
        icon={<MapIcon className="size-4" />}
      >
        <div className="space-y-2">
          <p className="text-foreground truncate text-[12px] font-medium">
            {humanizeModelPath(selectedMap.path)}
          </p>
          <button
            type="button"
            aria-pressed={locked}
            onClick={() => onToggleLock?.(selectedMap.id, !locked)}
            className={cn(
              'flex w-full cursor-pointer items-center gap-2 rounded-sm border px-2 py-1.5 text-[12px] transition-colors',
              locked
                ? 'border-border bg-muted text-muted-foreground hover:text-foreground'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-500 hover:bg-amber-500/15',
            )}
          >
            {locked ? (
              <Lock className="size-3.5 shrink-0" />
            ) : (
              <LockOpen className="size-3.5 shrink-0" />
            )}
            <span className="flex-1 text-left">
              {locked
                ? t('monitoring:editor.unlockMap')
                : t('monitoring:editor.lockMap')}
            </span>
          </button>
        </div>
      </InspectorSection>

      {/* 잠긴 지도는 수치 입력도 막는다 — 캔버스에서 못 옮기는데 인스펙터
          로는 옮겨지면 자물쇠의 의미가 반쪽이 된다. */}
      {locked ? null : (
        <TransformSection
          position={selectedMap.position ?? DEFAULT_MAP_POSITION}
          rotation={selectedMap.rotation ?? DEFAULT_MAP_ROTATION}
          scale={selectedMap.scale ?? DEFAULT_MAP_SCALE}
          onTransformChange={onTransformChange}
          t={t}
        />
      )}
    </>
  );
}

function VisionChannelSelect({
  sensor,
  onChange,
  visionChannels,
  allSensors,
  t,
}: {
  sensor: SavedLidarSensorInfo | SavedCameraSensorInfo;
  onChange: (
    id: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    patch: Record<string, any>,
  ) => void;
  visionChannels?: readonly VisionChannelOption[];
  allSensors?: readonly SavedSensorInfo[];
  t: (key: string) => string;
}) {
  if (!visionChannels || visionChannels.length === 0) return null;

  // 같은 sensorType의 채널만 노출 — 카메라는 cam-*, 라이다는 lidar-*
  const candidates = visionChannels.filter(
    (c) => c.sensorType === sensor.type,
  );
  if (candidates.length === 0) return null;

  // 다른 센서가 점유한 채널 집계 (자기 자신 제외)
  const taken = new Set<string>();
  for (const s of allSensors ?? []) {
    if (s.id === sensor.id) continue;
    if (s.channelId) taken.add(s.channelId);
  }

  const current = sensor.channelId ?? '';

  return (
    <label className="flex items-center justify-between gap-2 py-1">
      <span className="text-muted-foreground text-[11px]">
        {t('monitoring:inspector.visionChannel')}
      </span>
      <select
        value={current}
        onChange={(e) => {
          const next = e.target.value;
          onChange(sensor.id, {
            channelId: next.length > 0 ? next : undefined,
          });
        }}
        className="border-border bg-muted text-foreground h-7 w-32 rounded-sm px-1.5 text-right text-[11px]"
      >
        <option value="">{t('monitoring:inspector.visionChannelEmpty')}</option>
        {candidates.map((channel) => {
          const isTaken = taken.has(channel.id);
          return (
            <option key={channel.id} value={channel.id} disabled={isTaken}>
              {channel.label}
              {isTaken
                ? ` · ${t('monitoring:inspector.visionChannelTaken')}`
                : ''}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function LidarSensorInspectorContent({
  sensor,
  onChange,
  onTransformChange,
  visionChannels,
  allSensors,
  t,
}: {
  sensor: SavedLidarSensorInfo;
  onChange: (
    id: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    patch: Record<string, any>,
  ) => void;
  onTransformChange: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => void;
  visionChannels?: readonly VisionChannelOption[];
  allSensors?: readonly SavedSensorInfo[];
  t: (key: string) => string;
}) {
  return (
    <>
      <TransformSection
        position={sensor.position}
        rotation={sensor.rotation}
        scale={[1, 1, 1]}
        onTransformChange={onTransformChange}
        t={t}
      />

      <InspectorSection
        title="LiDAR Settings"
        icon={<SlidersHorizontal className="size-4" />}
      >
        <div className="space-y-2">
          <VisionChannelSelect
            sensor={sensor}
            onChange={onChange}
            visionChannels={visionChannels}
            allSensors={allSensors}
            t={t}
          />
        </div>
      </InspectorSection>
    </>
  );
}

function CameraSensorInspectorContent({
  sensor,
  onChange,
  onTransformChange,
  visionChannels,
  allSensors,
  t,
}: {
  sensor: SavedCameraSensorInfo;
  onChange: (
    id: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    patch: Record<string, any>,
  ) => void;
  onTransformChange: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => void;
  visionChannels?: readonly VisionChannelOption[];
  allSensors?: readonly SavedSensorInfo[];
  t: (key: string) => string;
}) {
  return (
    <>
      <TransformSection
        position={sensor.position}
        rotation={sensor.rotation}
        scale={[1, 1, 1]}
        onTransformChange={onTransformChange}
        t={t}
      />

      <InspectorSection
        title="Camera Settings"
        icon={<SlidersHorizontal className="size-4" />}
      >
        <div className="space-y-2">
          <VisionChannelSelect
            sensor={sensor}
            onChange={onChange}
            visionChannels={visionChannels}
            allSensors={allSensors}
            t={t}
          />
        </div>
      </InspectorSection>
    </>
  );
}

export function SceneObjectInspector({
  selectedModel,
  selectedText,
  selectedSensor = null,
  selectedMesh,
  selectedMap = null,
  multiSelectCount = 0,
  visionChannels,
  allSensors,
  onNameChange,
  onOpacityChange,
  onTransformChange,
  onTextContentChange,
  onTextColorChange,
  onTextTransformChange,
  onMeshNameChange,
  onMeshOpacityChange,
  onMeshTransformChange,
  onSensorChange,
  onBackToParent,
  onValueMapChange,
  onMapTransformChange,
  onToggleMapLock,
}: SceneObjectInspectorProps) {
  const { t } = useTranslation();
  const selectedLabel = selectedModel?.equipName ?? '';
  const selectedOpacity = selectedModel?.opacity ?? 1;
  const [nameDraft, setNameDraft] = useState(selectedLabel);
  const [contentDraft, setContentDraft] = useState(selectedText?.content ?? '');
  const initialMeshName = selectedMesh?.override?.name ?? '';
  const [meshNameDraft, setMeshNameDraft] = useState(initialMeshName);

  useEffect(() => {
    setNameDraft(selectedLabel);
  }, [selectedLabel]);

  useEffect(() => {
    setContentDraft(selectedText?.content ?? '');
  }, [selectedText?.content]);

  useEffect(() => {
    setMeshNameDraft(initialMeshName);
  }, [initialMeshName, selectedMesh?.meshPath]);

  const hasSelection =
    selectedModel ||
    selectedText ||
    selectedSensor ||
    selectedMesh ||
    selectedMap ||
    multiSelectCount > 1;

  return (
    <Card className="border-border bg-card text-card-foreground flex h-full min-h-0 flex-col gap-0 overflow-hidden py-0">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-2 py-2">
        {multiSelectCount > 1 ? (
          <div className="border-border bg-muted/30 text-muted-foreground flex flex-1 items-center justify-center rounded-lg border border-dashed px-6 text-[12px]">
            <p className="max-w-56 text-center">
              {t('monitoring:editor.multipleSelected', { count: multiSelectCount })}
            </p>
          </div>
        ) : selectedMesh ? (
          <MeshInspectorContent
            selectedMesh={selectedMesh}
            meshNameDraft={meshNameDraft}
            setMeshNameDraft={setMeshNameDraft}
            onMeshNameChange={onMeshNameChange}
            onMeshOpacityChange={onMeshOpacityChange}
            onMeshTransformChange={onMeshTransformChange}
            onBackToParent={onBackToParent}
            t={t}
          />
        ) : selectedModel ? (
          <ModelInspectorContent
            selectedModel={selectedModel}
            selectedLabel={selectedLabel}
            nameDraft={nameDraft}
            setNameDraft={setNameDraft}
            selectedOpacity={selectedOpacity}
            onNameChange={onNameChange}
            onOpacityChange={onOpacityChange}
            onTransformChange={onTransformChange}
            onValueMapChange={onValueMapChange}
            t={t}
          />
        ) : selectedText ? (
          <TextInspectorContent
            selectedText={selectedText}
            contentDraft={contentDraft}
            setContentDraft={setContentDraft}
            onTextContentChange={onTextContentChange}
            onTextColorChange={onTextColorChange}
            onTextTransformChange={onTextTransformChange}
            t={t}
          />
        ) : selectedSensor && onSensorChange ? (
          isLidarSensor(selectedSensor) ? (
            <LidarSensorInspectorContent
              sensor={selectedSensor}
              onChange={onSensorChange}
              onTransformChange={onTransformChange}
              visionChannels={visionChannels}
              allSensors={allSensors}
              t={t}
            />
          ) : isCameraSensor(selectedSensor) ? (
            <CameraSensorInspectorContent
              sensor={selectedSensor}
              onChange={onSensorChange}
              onTransformChange={onTransformChange}
              visionChannels={visionChannels}
              allSensors={allSensors}
              t={t}
            />
          ) : null
        ) : selectedMap ? (
          <MapInspectorContent
            selectedMap={selectedMap}
            onTransformChange={onMapTransformChange ?? onTransformChange}
            onToggleLock={onToggleMapLock}
            t={t}
          />
        ) : null}
        {!hasSelection ? (
          <div className="border-border bg-muted/30 text-muted-foreground flex flex-1 items-center justify-center rounded-lg border border-dashed px-6 text-[12px]">
            <p className="max-w-56 text-center">
              {t('monitoring:inspector.empty')}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
