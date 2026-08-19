import {
  Eye,
  Palette,
  SlidersHorizontal,
  Tag,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';

// 지도 transform은 optional이라(기존 저장본 호환) 표시용 기본값이 필요하다.
// 렌더러가 쓰는 GltfModel 기본값과 같은 값이어야 인스펙터 수치와 화면이 일치한다.
const DEFAULT_MAP_POSITION: Vector3Tuple = [0, 0, 0];
const DEFAULT_MAP_ROTATION: Vector3Tuple = [0, 0, 0];
const DEFAULT_MAP_SCALE: Vector3Tuple = [1, 1, 1];

type InspectorTabKey =
  | 'transform'
  | 'opacity'
  | 'tagMapping'
  | 'textContent'
  | 'textColor';

type InspectorObjectType = 'model' | 'mesh' | 'text' | 'map';

const TAB_ICON: Record<InspectorTabKey, LucideIcon> = {
  transform: SlidersHorizontal,
  opacity: Eye,
  tagMapping: Tag,
  textContent: Type,
  textColor: Palette,
};

const TAB_LABEL_KEY: Record<InspectorTabKey, string> = {
  transform: 'monitoring:inspector.transform',
  opacity: 'monitoring:inspector.opacity',
  tagMapping: 'monitoring:inspector.tagMapping',
  textContent: 'monitoring:inspector.textContent',
  textColor: 'monitoring:inspector.textColor',
};

const TABS_BY_TYPE: Record<InspectorObjectType, readonly InspectorTabKey[]> = {
  model: ['transform', 'opacity', 'tagMapping'],
  mesh: ['transform', 'opacity'],
  text: ['textContent', 'textColor', 'transform'],
  map: ['transform'],
};

function getTabsForType(
  type: InspectorObjectType,
  hasValueMap: boolean,
): readonly InspectorTabKey[] {
  const tabs = TABS_BY_TYPE[type];
  // 태그 매핑은 onValueMapChange가 배선된 화면에서만 존재하는 섹션이다.
  return type === 'model' && !hasValueMap
    ? tabs.filter((tab) => tab !== 'tagMapping')
    : tabs;
}

interface SceneObjectInspectorProps {
  selectedModel: SavedModelInfo | null;
  selectedText: SavedTextInfo | null;
  selectedMesh: SelectedMeshInfo | null;
  selectedMap?: SavedMapInfo | null;
  multiSelectCount?: number;
  onOpacityChange: (value: number) => void;
  onTransformChange: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => void;
  onTextContentChange: (content: string) => void;
  onTextColorChange: (color: string) => void;
  onMeshOpacityChange: (value: number) => void;
  onMeshTransformChange: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => void;
  /** mesh 선택을 풀고 부모 모델로 돌아가는 콜백. */
  onBackToParent: () => void;
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

interface TransformGroupProps {
  title: string;
  children: ReactNode;
}

/**
 * 탭 콘텐츠 상단의 얇은 섹션 헤더 — 접기 없음(섹션 전환은 좌측 레일 담당).
 * 아이콘은 레일에 이미 표시되므로 여기서는 타이틀만 둔다.
 */
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="text-foreground pb-1.5 text-[12px] font-medium">
      {title}
    </div>
  );
}

function TransformGroup({ title, children }: TransformGroupProps) {
  return (
    <div>
      <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

const VALUE_MAP_GROUPS: { labelKey: string; types: ValueMapType[] }[] = [
  { labelKey: 'monitoring:inspector.position', types: ['PX', 'PY', 'PZ'] },
  { labelKey: 'monitoring:inspector.rotation', types: ['RX', 'RY', 'RZ'] },
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
    <div>
      <SectionHeader title={t('monitoring:inspector.tagMapping')} />
      {craneId ? (
        <p className="text-muted-foreground mb-2 text-[10px]">
          크레인 ID:{' '}
          <span className="text-foreground font-mono">{craneId}</span>
        </p>
      ) : null}
      <div className="space-y-3">
        {VALUE_MAP_GROUPS.map((group) => (
          <div key={group.labelKey}>
            <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase">
              {t(group.labelKey)}
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
    </div>
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
    <div>
      <SectionHeader title={t('monitoring:inspector.transform')} />
      <div className="space-y-3">
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
    </div>
  );
}

function OpacitySection({
  value,
  onChange,
  t,
}: {
  value: number;
  onChange: (value: number) => void;
  t: (key: string) => string;
}) {
  return (
    <div>
      <SectionHeader title={t('monitoring:inspector.opacity')} />
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.1}
          value={value}
          className="accent-primary h-2 w-full cursor-pointer"
          onChange={(event) => {
            onChange(Number(event.target.value));
          }}
        />
        <span className="text-muted-foreground w-8 text-right text-[12px] tabular-nums">
          {value.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

function ModelInspectorContent({
  selectedModel,
  selectedOpacity,
  activeTab,
  onOpacityChange,
  onTransformChange,
  onValueMapChange,
  t,
}: {
  selectedModel: SavedModelInfo;
  selectedOpacity: number;
  activeTab: InspectorTabKey;
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
      {activeTab === 'transform' ? (
        <TransformSection
          position={selectedModel.position}
          rotation={selectedModel.rotation}
          scale={selectedModel.scale}
          onTransformChange={onTransformChange}
          t={t}
        />
      ) : null}

      {activeTab === 'opacity' ? (
        <OpacitySection
          value={selectedOpacity}
          onChange={onOpacityChange}
          t={t}
        />
      ) : null}

      {activeTab === 'tagMapping' && onValueMapChange ? (
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
  activeTab,
  onMeshOpacityChange,
  onMeshTransformChange,
  onBackToParent,
  t,
}: {
  selectedMesh: SelectedMeshInfo;
  activeTab: InspectorTabKey;
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

  return (
    <>
      {/* 부모 복귀 버튼은 탭과 무관한 내비게이션이라 항상 상단에 둔다. */}
      <button
        type="button"
        onClick={onBackToParent}
        className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 px-1 text-[11px] transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        {selectedMesh.parentModel.equipName || selectedMesh.parentModel.id}
      </button>

      {activeTab === 'transform' ? (
        <TransformSection
          position={position}
          rotation={rotation}
          scale={scale}
          onTransformChange={onMeshTransformChange}
          t={t}
        />
      ) : null}

      {activeTab === 'opacity' ? (
        <OpacitySection value={opacity} onChange={onMeshOpacityChange} t={t} />
      ) : null}
    </>
  );
}

function TextInspectorContent({
  selectedText,
  contentDraft,
  activeTab,
  setContentDraft,
  onTextContentChange,
  onTextColorChange,
  onTransformChange,
  t,
}: {
  selectedText: SavedTextInfo;
  contentDraft: string;
  activeTab: InspectorTabKey;
  setContentDraft: (v: string) => void;
  onTextContentChange: (content: string) => void;
  onTextColorChange: (color: string) => void;
  onTransformChange: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => void;
  t: (key: string) => string;
}) {
  return (
    <>
      {activeTab === 'textContent' ? (
        <div>
          <SectionHeader title={t('monitoring:inspector.textContent')} />
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
        </div>
      ) : null}

      {activeTab === 'textColor' ? (
        <div>
          <SectionHeader title={t('monitoring:inspector.textColor')} />
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
        </div>
      ) : null}

      {activeTab === 'transform' ? (
        <TransformSection
          position={selectedText.position}
          rotation={selectedText.rotation}
          scale={selectedText.scale}
          onTransformChange={onTransformChange}
          t={t}
        />
      ) : null}
    </>
  );
}

/**
 * 지도 인스펙터 — transform만.
 *
 * 지도에는 모델의 투명도/태그 매핑에 해당하는 개념이 없다. 투명도를
 * 낮추면 그 위 객체의 기준면이 사라져 배치 작업 자체가 불가능해진다.
 * 그래서 편집 가능한 것은 배치(transform)뿐이고, 이름 표시/변경은
 * 계층 목록(우클릭 메뉴)이 담당한다.
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
    <TransformSection
      position={selectedMap.position ?? DEFAULT_MAP_POSITION}
      rotation={selectedMap.rotation ?? DEFAULT_MAP_ROTATION}
      scale={selectedMap.scale ?? DEFAULT_MAP_SCALE}
      onTransformChange={onTransformChange}
      t={t}
    />
  );
}

/** 좌측 세로 아이콘 레일 — 선택 타입의 섹션 탭을 나열한다. */
function InspectorTabRail({
  tabs,
  active,
  onSelect,
  t,
}: {
  tabs: readonly InspectorTabKey[];
  active: InspectorTabKey;
  onSelect: (tab: InspectorTabKey) => void;
  t: (key: string) => string;
}) {
  return (
    <TooltipProvider>
      <div className="border-border flex w-9 shrink-0 flex-col items-center gap-1 border-r py-2">
        {tabs.map((tab) => {
          const Icon = TAB_ICON[tab];
          const label = t(TAB_LABEL_KEY[tab]);
          const isActive = tab === active;
          return (
            <Tooltip key={tab}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={label}
                    aria-pressed={isActive}
                    onClick={() => onSelect(tab)}
                    className={cn(
                      'flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors',
                      isActive
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  />
                }
              >
                <Icon className="size-4" />
              </TooltipTrigger>
              <TooltipContent side="left">{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

export function SceneObjectInspector({
  selectedModel,
  selectedText,
  selectedMesh,
  selectedMap = null,
  multiSelectCount = 0,
  onOpacityChange,
  onTransformChange,
  onTextContentChange,
  onTextColorChange,
  onMeshOpacityChange,
  onMeshTransformChange,
  onBackToParent,
  onValueMapChange,
  className,
}: SceneObjectInspectorProps) {
  const { t } = useTranslation();
  const selectedOpacity = selectedModel?.opacity ?? 1;
  const [contentDraft, setContentDraft] = useState(selectedText?.content ?? '');
  const [activeTab, setActiveTab] = useState<InspectorTabKey>('transform');

  useEffect(() => {
    setContentDraft(selectedText?.content ?? '');
  }, [selectedText?.content]);

  // 기존 분기 순서(multi > mesh > model > text > map)와 동일하게 타입 판별.
  const selectedType: InspectorObjectType | null =
    multiSelectCount > 1
      ? null
      : selectedMesh
        ? 'mesh'
        : selectedModel
          ? 'model'
          : selectedText
            ? 'text'
            : selectedMap
              ? 'map'
              : null;

  const tabs = selectedType
    ? getTabsForType(selectedType, Boolean(onValueMapChange))
    : [];
  // 타입 전환 시 같은 섹션이 있으면 유지, 없으면 첫 탭 — effect 대신 렌더 시
  // 파생 보정이라 stale 탭이 한 프레임도 렌더되지 않는다. activeTab은 사용자의
  // 마지막 명시적 선택으로 남아, 탭이 없는 타입을 거쳐 돌아와도 복원된다.
  const resolvedTab = tabs.includes(activeTab)
    ? activeTab
    : (tabs[0] ?? 'transform');

  const hasSelection = selectedType !== null || multiSelectCount > 1;

  return (
    <Card
      className={cn(
        'border-border bg-card text-card-foreground flex h-full min-h-0 flex-col gap-0 overflow-hidden py-0',
        className,
      )}
    >
      <CardContent className="flex min-h-0 flex-1 flex-row gap-0 overflow-hidden p-0">
        {selectedType ? (
          <InspectorTabRail
            tabs={tabs}
            active={resolvedTab}
            onSelect={setActiveTab}
            t={t}
          />
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-2 py-2">
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
              activeTab={resolvedTab}
              onMeshOpacityChange={onMeshOpacityChange}
              onMeshTransformChange={onMeshTransformChange}
              onBackToParent={onBackToParent}
              t={t}
            />
          ) : selectedModel ? (
            <ModelInspectorContent
              selectedModel={selectedModel}
              selectedOpacity={selectedOpacity}
              activeTab={resolvedTab}
              onOpacityChange={onOpacityChange}
              onTransformChange={onTransformChange}
              onValueMapChange={onValueMapChange}
              t={t}
            />
          ) : selectedText ? (
            <TextInspectorContent
              selectedText={selectedText}
              contentDraft={contentDraft}
              activeTab={resolvedTab}
              setContentDraft={setContentDraft}
              onTextContentChange={onTextContentChange}
              onTextColorChange={onTextColorChange}
              onTransformChange={onTransformChange}
              t={t}
            />
          ) : selectedMap ? (
            <MapInspectorContent
              selectedMap={selectedMap}
              onTransformChange={onTransformChange}
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
        </div>
      </CardContent>
    </Card>
  );
}
