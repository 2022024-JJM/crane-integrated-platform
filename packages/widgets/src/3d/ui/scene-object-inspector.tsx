import {
  ChevronDown,
  Cuboid,
  Eye,
  Palette,
  SlidersHorizontal,
  Type,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  humanizeModelPath,
  type SavedModelInfo,
  type SavedTextInfo,
} from '@crane/domain/3d';
import {
  type AxisKey,
  PositionController,
  RotationController,
  ScaleController,
  type SceneTransformField,
} from '@crane/features/3d';
import { Input } from '@crane/ui/atoms/input';
import { Card, CardContent } from '@crane/ui/molecules/card';

interface SceneObjectInspectorProps {
  selectedModel: SavedModelInfo | null;
  selectedText: SavedTextInfo | null;
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

function ModelInspectorContent({
  selectedModel,
  selectedLabel,
  nameDraft,
  setNameDraft,
  selectedOpacity,
  onNameChange,
  onOpacityChange,
  onTransformChange,
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
  t: (key: string) => string;
}) {
  return (
    <>
      <div className="border-border bg-muted/30 rounded-lg border px-2.5 py-2.5">
        <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
          {t('monitoring:inspector.title')}
        </p>
        <p className="text-foreground mt-1 truncate text-[15px] leading-none font-semibold">
          {selectedLabel || selectedModel.id}
        </p>
        <p className="text-muted-foreground mt-1 truncate text-[10px] leading-none">
          {humanizeModelPath(selectedModel.path)}
        </p>
      </div>

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

      <InspectorSection
        title={t('monitoring:transform.title')}
        icon={<Cuboid className="size-4" />}
      >
        <div className="space-y-2.5">
          <TransformGroup title={t('monitoring:inspector.position')}>
            <PositionController
              vec={selectedModel.position}
              onChange={(axis, value) => {
                onTransformChange('position', axis, value);
              }}
            />
          </TransformGroup>
          <TransformGroup title={t('monitoring:inspector.rotation')}>
            <RotationController
              vec={selectedModel.rotation}
              onChange={(axis, value) => {
                onTransformChange('rotation', axis, value);
              }}
            />
          </TransformGroup>
          <TransformGroup title={t('monitoring:inspector.scale')}>
            <ScaleController
              vec={selectedModel.scale}
              onChange={(axis, value) => {
                onTransformChange('scale', axis, value);
              }}
            />
          </TransformGroup>
        </div>
      </InspectorSection>

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
      <div className="border-border bg-muted/30 rounded-lg border px-2.5 py-2.5">
        <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
          {t('monitoring:editor.textObject')}
        </p>
        <p className="text-foreground mt-1 truncate text-[15px] leading-none font-semibold">
          {selectedText.content || 'Text'}
        </p>
      </div>

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

      <InspectorSection
        title={t('monitoring:transform.title')}
        icon={<Cuboid className="size-4" />}
      >
        <div className="space-y-2.5">
          <TransformGroup title={t('monitoring:inspector.position')}>
            <PositionController
              vec={selectedText.position}
              onChange={(axis, value) => {
                onTextTransformChange('position', axis, value);
              }}
            />
          </TransformGroup>
          <TransformGroup title={t('monitoring:inspector.rotation')}>
            <RotationController
              vec={selectedText.rotation}
              onChange={(axis, value) => {
                onTextTransformChange('rotation', axis, value);
              }}
            />
          </TransformGroup>
          <TransformGroup title={t('monitoring:inspector.scale')}>
            <ScaleController
              vec={selectedText.scale}
              onChange={(axis, value) => {
                onTextTransformChange('scale', axis, value);
              }}
            />
          </TransformGroup>
        </div>
      </InspectorSection>
    </>
  );
}

export function SceneObjectInspector({
  selectedModel,
  selectedText,
  multiSelectCount = 0,
  onNameChange,
  onOpacityChange,
  onTransformChange,
  onTextContentChange,
  onTextColorChange,
  onTextTransformChange,
}: SceneObjectInspectorProps) {
  const { t } = useTranslation();
  const selectedLabel = selectedModel?.equipName ?? '';
  const selectedOpacity = selectedModel?.opacity ?? 1;
  const [nameDraft, setNameDraft] = useState(selectedLabel);
  const [contentDraft, setContentDraft] = useState(selectedText?.content ?? '');

  useEffect(() => {
    setNameDraft(selectedLabel);
  }, [selectedLabel]);

  useEffect(() => {
    setContentDraft(selectedText?.content ?? '');
  }, [selectedText?.content]);

  const hasSelection = selectedModel || selectedText || multiSelectCount > 1;

  return (
    <Card className="border-border bg-card text-card-foreground flex h-full min-h-0 flex-col gap-0 overflow-hidden py-0">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-2 py-2">
        {multiSelectCount > 1 ? (
          <div className="border-border bg-muted/30 text-muted-foreground flex flex-1 items-center justify-center rounded-lg border border-dashed px-6 text-[12px]">
            <p className="max-w-56 text-center">
              {t('monitoring:editor.multipleSelected', { count: multiSelectCount })}
            </p>
          </div>
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
