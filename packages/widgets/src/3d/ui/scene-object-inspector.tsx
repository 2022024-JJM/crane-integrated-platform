import {
  Bone,
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
  type RigDefinition,
  type SavedMapInfo,
  type SavedModelInfo,
  type SavedTextInfo,
} from '@crane/domain/3d';
import { RiggingSection, type RigUpdater } from './rigging-section';
import { TagMappingSection, type TagMappingsUpdater } from './tag-mapping-section';
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
  useUniformScaleStore,
} from '@crane/features/3d';
import { Checkbox } from '@crane/ui/atoms/checkbox';
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
  | 'rigging'
  | 'textContent'
  | 'textColor';

type InspectorObjectType = 'model' | 'text' | 'map';

const TAB_ICON: Record<InspectorTabKey, LucideIcon> = {
  transform: SlidersHorizontal,
  opacity: Eye,
  tagMapping: Tag,
  rigging: Bone,
  textContent: Type,
  textColor: Palette,
};

const TAB_LABEL_KEY: Record<InspectorTabKey, string> = {
  transform: 'monitoring:inspector.transform',
  opacity: 'monitoring:inspector.opacity',
  tagMapping: 'monitoring:inspector.tagMapping',
  rigging: 'monitoring:inspector.rigging.title',
  textContent: 'monitoring:inspector.textContent',
  textColor: 'monitoring:inspector.textColor',
};

const TABS_BY_TYPE: Record<InspectorObjectType, readonly InspectorTabKey[]> = {
  model: ['transform', 'opacity', 'tagMapping', 'rigging'],
  text: ['textContent', 'textColor', 'transform'],
  map: ['transform'],
};

function getTabsForType(
  type: InspectorObjectType,
  hasTagMapping: boolean,
  hasRigging: boolean,
): readonly InspectorTabKey[] {
  const tabs = TABS_BY_TYPE[type];
  if (type !== 'model') return tabs;
  // 태그 매핑·리깅은 콜백이 배선된 화면에서만 존재하는 섹션이다.
  return tabs.filter(
    (tab) =>
      (tab !== 'tagMapping' || hasTagMapping) &&
      (tab !== 'rigging' || hasRigging),
  );
}

/** 리깅 탭 콜백 묶음 — 전부 있어야 탭이 뜬다. */
export interface InspectorRiggingHandlers {
  rigs: RigDefinition[];
  onCreateRig: () => void;
  onAssignRig: (rigId: string | null) => void;
  onUpdateRig: (rigId: string, updater: RigUpdater) => void;
  onRemoveRig: (rigId: string) => void;
}

/** 태그 매핑 탭 — 관절 대상 선택에 리그 정의가 필요하다. */
export interface InspectorTagMappingHandlers {
  rigs: RigDefinition[];
  onUpdate: (updater: TagMappingsUpdater) => void;
}

interface SceneObjectInspectorProps {
  selectedModel: SavedModelInfo | null;
  selectedText: SavedTextInfo | null;
  /**
   * 모델 안쪽 노드 선택. 노드는 읽기 전용이라 편집 섹션 없이 안내 문구만
   * 보이고, 바운딩 박스는 캔버스가 그린다.
   */
  selectedMesh: SelectedMeshInfo | null;
  selectedMap?: SavedMapInfo | null;
  multiSelectCount?: number;
  onOpacityChange: (value: number) => void;
  onTransformChange: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
    options?: { uniformScale?: boolean },
  ) => void;
  onTextContentChange: (content: string) => void;
  onTextColorChange: (color: string) => void;
  /** 태그 매핑 탭. 없으면 탭이 뜨지 않는다. */
  tagMapping?: InspectorTagMappingHandlers;
  /** 리깅 탭. 없으면 탭이 뜨지 않는다(tagMapping 과 같은 게이트). */
  rigging?: InspectorRiggingHandlers;
  /** 루트 Card에 병합할 클래스. 도킹 컬럼에선 rounded/ring 제거에 쓴다. */
  className?: string;
}

interface TransformGroupProps {
  title: string;
  /** 제목 우측에 붙는 보조 컨트롤(예: 크기의 "비율 유지" 체크박스). */
  action?: ReactNode;
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

function TransformGroup({ title, action, children }: TransformGroupProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
          {title}
        </p>
        {action}
      </div>
      {children}
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
    options?: { uniformScale?: boolean },
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

  // "비율 유지"는 인스펙터 입력에만 적용된다. 기즈모 드래그는 별도의 벡터
  // 커밋 경로를 타므로 이 플래그를 넘기지 않는다.
  const uniformScale = useUniformScaleStore((s) => s.enabled);
  const setUniformScale = useUniformScaleStore((s) => s.setEnabled);

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
        <TransformGroup
          title={t('monitoring:inspector.scale')}
          action={
            <label className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 text-[10px] transition-colors">
              <Checkbox
                checked={uniformScale}
                onCheckedChange={(checked) => setUniformScale(checked)}
                className="size-3.5 cursor-pointer [&>[data-slot=checkbox-indicator]>svg]:size-3"
              />
              {t('monitoring:inspector.uniformScale')}
            </label>
          }
        >
          <ScaleController
            vec={displayScale}
            onChange={(axis, value) => {
              onTransformChange('scale', axis, value, { uniformScale });
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
  tagMapping,
  rigging,
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
    options?: { uniformScale?: boolean },
  ) => void;
  tagMapping?: InspectorTagMappingHandlers;
  rigging?: InspectorRiggingHandlers;
  t: (key: string, options?: Record<string, unknown>) => string;
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

      {activeTab === 'tagMapping' && tagMapping ? (
        <TagMappingSection
          model={selectedModel}
          rigs={tagMapping.rigs}
          onUpdate={tagMapping.onUpdate}
          t={t}
        />
      ) : null}

      {activeTab === 'rigging' && rigging ? (
        <RiggingSection
          model={selectedModel}
          rigs={rigging.rigs}
          onCreateRig={rigging.onCreateRig}
          onAssignRig={rigging.onAssignRig}
          onUpdateRig={rigging.onUpdateRig}
          onRemoveRig={rigging.onRemoveRig}
          t={t}
        />
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
    options?: { uniformScale?: boolean },
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
          <div className="flex flex-col items-center gap-1.5">
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
    options?: { uniformScale?: boolean },
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
  tagMapping,
  rigging,
  className,
}: SceneObjectInspectorProps) {
  const { t } = useTranslation();
  const selectedOpacity = selectedModel?.opacity ?? 1;
  const [contentDraft, setContentDraft] = useState(selectedText?.content ?? '');
  const [activeTab, setActiveTab] = useState<InspectorTabKey>('transform');

  useEffect(() => {
    setContentDraft(selectedText?.content ?? '');
  }, [selectedText?.content]);

  // 분기 순서 multi > mesh > model > text > map. 노드(mesh)는 편집 탭이 없어
  // 타입 null 로 두고 아래에서 안내 문구만 그린다.
  const selectedType: InspectorObjectType | null =
    multiSelectCount > 1 || selectedMesh
      ? null
      : selectedModel
        ? 'model'
        : selectedText
          ? 'text'
          : selectedMap
            ? 'map'
            : null;

  const tabs = selectedType
    ? getTabsForType(selectedType, Boolean(tagMapping), Boolean(rigging))
    : [];
  // 타입 전환 시 같은 섹션이 있으면 유지, 없으면 첫 탭 — effect 대신 렌더 시
  // 파생 보정이라 stale 탭이 한 프레임도 렌더되지 않는다. activeTab은 사용자의
  // 마지막 명시적 선택으로 남아, 탭이 없는 타입을 거쳐 돌아와도 복원된다.
  const resolvedTab = tabs.includes(activeTab)
    ? activeTab
    : (tabs[0] ?? 'transform');

  const hasSelection =
    selectedType !== null || selectedMesh !== null || multiSelectCount > 1;

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
            <div className="border-border bg-muted/30 text-muted-foreground flex flex-1 items-center justify-center rounded-lg border border-dashed px-6 text-[12px]">
              <p className="max-w-56 text-center whitespace-pre-line">
                {t('monitoring:inspector.nodeReadOnly')}
              </p>
            </div>
          ) : selectedModel ? (
            <ModelInspectorContent
              selectedModel={selectedModel}
              selectedOpacity={selectedOpacity}
              activeTab={resolvedTab}
              onOpacityChange={onOpacityChange}
              onTransformChange={onTransformChange}
              tagMapping={tagMapping}
              rigging={rigging}
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
