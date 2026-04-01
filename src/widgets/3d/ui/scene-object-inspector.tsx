import { ChevronDown, Cuboid, Eye, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { humanizeModelPath, type SavedModelInfo } from '@/entities/3d';
import {
  type AxisKey,
  PositionController,
  RotationController,
  ScaleController,
  type SceneTransformField,
} from '@/features/3d';
import { Input } from '@/shared/ui/atoms/input';
import { Card, CardContent } from '@/shared/ui/molecules/card';

interface SceneObjectInspectorProps {
  selectedModel: SavedModelInfo | null;
  onNameChange: (name: string) => void;
  onOpacityChange: (value: number) => void;
  onTransformChange: (
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
      className="group rounded-lg border border-white/8 bg-black/18"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-2.5 py-2 text-[12px] font-medium text-white/84">
        <div className="flex items-center gap-2">
          <span className="text-white/55">{icon}</span>
          <span>{title}</span>
        </div>
        <ChevronDown className="size-3.5 text-white/40 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-white/8 px-2.5 py-2.5">{children}</div>
    </details>
  );
}

function TransformGroup({ title, children }: TransformGroupProps) {
  return (
    <div className="rounded-md border border-white/8 bg-white/[0.035] px-2.5 py-2">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-white/44 uppercase">
          {title}
        </p>
        <span className="h-px flex-1 bg-white/6" />
      </div>
      {children}
    </div>
  );
}

export function SceneObjectInspector({
  selectedModel,
  onNameChange,
  onOpacityChange,
  onTransformChange,
}: SceneObjectInspectorProps) {
  const { t } = useTranslation();
  const selectedLabel = selectedModel?.equipName ?? '';
  const selectedOpacity = selectedModel?.opacity ?? 1;
  const [nameDraft, setNameDraft] = useState(selectedLabel);

  useEffect(() => {
    setNameDraft(selectedLabel);
  }, [selectedLabel]);

  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden border-white/8 bg-[#171717] py-0 text-white">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-2 py-2">
        {selectedModel ? (
          <>
            <div className="rounded-lg border border-white/8 bg-black/22 px-2.5 py-2.5">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-white/38 uppercase">
                {t('monitoring:inspector.title')}
              </p>
              <p className="mt-1 truncate text-[15px] font-semibold leading-none text-white">
                {selectedLabel}
              </p>
              <p className="mt-1 truncate text-[10px] leading-none text-white/38">
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
                className="h-8 cursor-text rounded-sm border-white/8 bg-white/4 px-2 text-[12px] text-white placeholder:text-white/30"
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
                <span className="w-8 text-right text-[12px] tabular-nums text-white/62">
                  {selectedOpacity.toFixed(1)}
                </span>
              </div>
            </InspectorSection>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/18 px-6 text-[12px] text-white/42">
            <p className="max-w-56 text-center">
              {t('monitoring:inspector.empty')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
