import {
  ChevronDown,
  Cuboid,
  Eye,
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
  type SavedMapInfo,
  type SavedModelInfo,
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
} from '@crane/features/3d';
import { ArrowLeft } from 'lucide-react';
import { Input } from '@crane/ui/atoms/input';
import { Card, CardContent } from '@crane/ui/molecules/card';

// 지도 transform은 optional이라(기존 저장본 호환) 표시용 기본값이 필요하다.
// 렌더러가 쓰는 GltfModel 기본값과 같은 값이어야 인스펙터 수치와 화면이 일치한다.
const DEFAULT_MAP_POSITION: Vector3Tuple = [0, 0, 0];
const DEFAULT_MAP_ROTATION: Vector3Tuple = [0, 0, 0];
const DEFAULT_MAP_SCALE: Vector3Tuple = [1, 1, 1];

interface SceneObjectInspectorProps {
  selectedModel: SavedModelInfo | null;
  selectedText: SavedTextInfo | null;
  selectedMesh: SelectedMeshInfo | null;
  selectedMap?: SavedMapInfo | null;
  multiSelectCount?: number;
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
  /** mesh 선택을 풀고 부모 모델로 돌아가는 콜백. */
  onBackToParent: () => void;
  /** 지도 transform 변경 콜백. 미지정 시 지도 인스펙터는 읽기 전용이 된다. */
  onMapTransformChange?: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => void;
  /** 모델의 태그 매핑 변경 콜백. key가 빈 문자열이면 해당 type 매핑을 삭제한다. */
  onValueMapChange?: (
    type: ValueMapType,
    key: string,
    scale?: number,
    offset?: number,
  ) => void;
  /** 루트 Card에 병합할 클래스. 도킹 컬럼에선 rounded/ring 제거에 쓴다. */
  className?: string;
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
  PX: 'X',
  PY: 'Y',
  PZ: 'Z',
  RX: 'X',
  RY: 'Y',
  RZ: 'Z',
  SX: 'X',
  SY: 'Y',
  SZ: 'Z',
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
  onValueMapChange: (
    type: ValueMapType,
    key: string,
    scale?: number,
    offset?: number,
  ) => void;
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
      (['PX', 'PY', 'PZ'] as ValueMapType[]).map((t) => [
        t,
        String(getOffset(t)),
      ]),
    ) as Record<ValueMapType, string>;

  const [offsetDrafts, setOffsetDrafts] =
    useState<Record<ValueMapType, string>>(initialOffsetDrafts);

  // 외부에서 valueMapList가 바뀔 때(저장 후 로드 등) draft를 동기화
  useEffect(() => {
    setOffsetDrafts({
      PX: String(getOffset('PX')),
      PY: String(getOffset('PY')),
      PZ: String(getOffset('PZ')),
      RX: '0',
      RY: '0',
      RZ: '0',
      SX: '0',
      SY: '0',
      SZ: '0',
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
          크레인 ID:{' '}
          <span className="text-foreground font-mono">{craneId}</span>
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
                        placeholder={t(
                          'monitoring:inspector.tagKeyPlaceholder',
                        )}
                        className="border-border bg-muted text-foreground placeholder:text-muted-foreground h-7 flex-1 rounded-sm px-2 text-[11px]"
                        onChange={(e) => {
                          const fullKey = e.target.value.trim()
                            ? `${prefix}${e.target.value.trim()}`
                            : '';
                          onValueMapChange(
                            type,
                            fullKey,
                            getScale(type),
                            isPosition ? getOffset(type) : undefined,
                          );
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
                                onValueMapChange(
                                  type,
                                  `${prefix}${tagCode}`,
                                  s,
                                  isPosition ? getOffset(type) : undefined,
                                );
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
                                setOffsetDrafts((prev) => ({
                                  ...prev,
                                  [type]: raw,
                                }));
                                const o = parseFloat(raw);
                                if (Number.isFinite(o)) {
                                  onValueMapChange(
                                    type,
                                    `${prefix}${tagCode}`,
                                    getScale(type),
                                    o,
                                  );
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
  onValueMapChange?: (
    type: ValueMapType,
    key: string,
    scale?: number,
    offset?: number,
  ) => void;
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
 * 지도 인스펙터 — 파일명 표시 + transform.
 *
 * 지도에는 모델의 이름/투명도/태그 매핑에 해당하는 개념이 없다. 파일에서
 * 온 지형이라 이름은 경로가 곧 정체이고, 투명도를 낮추면 그 위 객체의
 * 기준면이 사라져 배치 작업 자체가 불가능해진다. 그래서 편집 가능한 것은
 * 배치(transform)뿐이다.
 *
 * 잠금 토글은 여기 두지 않는다 — 이 패널은 "지도가 선택된 상태"에서만
 * 보이는데, 잠긴 지도는 애초에 선택될 수 없고 잠그는 순간 선택이 풀려
 * 패널이 사라진다. 즉 여기서 잠금 버튼은 항상 "잠그기"만 표시하다가
 * 누르면 자기 자신이 사라지는 막다른 길이다. 잠금/해제는 좌측 계층
 * 목록의 자물쇠 버튼이 유일한 경로다(거기서는 잠긴 지도도 보인다).
 */
function MapInspectorContent({
  selectedMap,
  onTransformChange,
  t,
}: {
  selectedMap: SavedMapInfo;
  onTransformChange: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => void;
  t: (key: string) => string;
}) {
  return (
    <>
      <InspectorSection
        title={t('monitoring:editor.map')}
        icon={<MapIcon className="size-4" />}
      >
        <p className="text-foreground truncate text-[12px] font-medium">
          {humanizeModelPath(selectedMap.path)}
        </p>
      </InspectorSection>

      <TransformSection
        position={selectedMap.position ?? DEFAULT_MAP_POSITION}
        rotation={selectedMap.rotation ?? DEFAULT_MAP_ROTATION}
        scale={selectedMap.scale ?? DEFAULT_MAP_SCALE}
        onTransformChange={onTransformChange}
        t={t}
      />
    </>
  );
}

export function SceneObjectInspector({
  selectedModel,
  selectedText,
  selectedMesh,
  selectedMap = null,
  multiSelectCount = 0,
  onNameChange,
  onOpacityChange,
  onTransformChange,
  onTextContentChange,
  onTextColorChange,
  onTextTransformChange,
  onMeshNameChange,
  onMeshOpacityChange,
  onMeshTransformChange,
  onBackToParent,
  onValueMapChange,
  onMapTransformChange,
  className,
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
    selectedMesh ||
    selectedMap ||
    multiSelectCount > 1;

  return (
    <Card
      className={cn(
        'border-border bg-card text-card-foreground flex h-full min-h-0 flex-col gap-0 overflow-hidden py-0',
        className,
      )}
    >
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-2 py-2">
        {multiSelectCount > 1 ? (
          <div className="border-border bg-muted/30 text-muted-foreground flex flex-1 items-center justify-center rounded-lg border border-dashed px-6 text-[12px]">
            <p className="max-w-56 text-center">
              {t('monitoring:editor.multipleSelected', {
                count: multiSelectCount,
              })}
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
        ) : selectedMap ? (
          <MapInspectorContent
            selectedMap={selectedMap}
            onTransformChange={onMapTransformChange ?? onTransformChange}
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
