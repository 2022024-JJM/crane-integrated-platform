import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { SavedModelInfo } from '@/entities/3d';
import {
  type AxisKey,
  PositionController,
  RotationController,
  ScaleController,
  type SceneTransformField,
} from '@/features/3d';
import { Input } from '@/shared/ui/atoms/input';
import { Separator } from '@/shared/ui/atoms/separator';
import {
  Card,
  CardContent,
  CardDescription,
} from '@/shared/ui/molecules/card';

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
  children: ReactNode;
}

function InspectorSection({ title, children }: InspectorSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function SceneObjectInspector({
  selectedModel,
  onNameChange,
  onOpacityChange,
  onTransformChange,
}: SceneObjectInspectorProps) {
  const { t } = useTranslation();
  const selectedLabel = selectedModel?.equipName || selectedModel?.id || '';
  const selectedOpacity = selectedModel?.opacity ?? 1;
  const [nameDraft, setNameDraft] = useState(selectedLabel);

  useEffect(() => {
    setNameDraft(selectedLabel);
  }, [selectedLabel]);

  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 py-0">
      <CardContent className="flex flex-1 flex-col gap-4 overflow-auto py-4">
        {selectedModel ? (
          <>
            <div className="flex flex-col gap-2">
              <CardDescription>{t('monitoring:inspector.name')}</CardDescription>
              <Input
                value={nameDraft}
                aria-label={t('monitoring:inspector.name')}
                className="cursor-text"
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setNameDraft(nextValue);

                  if (nextValue.trim()) {
                    onNameChange(nextValue);
                  }
                }}
                onBlur={() => {
                  if (!nameDraft.trim()) {
                    setNameDraft(selectedLabel);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setNameDraft(selectedLabel);
                    event.currentTarget.blur();
                  }

                  if (event.key === 'Enter' && !nameDraft.trim()) {
                    setNameDraft(selectedLabel);
                    event.currentTarget.blur();
                  }
                }}
              />
            </div>
            <Separator />
            <InspectorSection title={t('monitoring:inspector.opacity')}>
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
                <span className="text-muted-foreground w-10 text-right text-sm tabular-nums">
                  {selectedOpacity.toFixed(1)}
                </span>
              </div>
            </InspectorSection>
            <Separator />
            <InspectorSection title={t('monitoring:inspector.position')}>
              <PositionController
                vec={selectedModel.position}
                onChange={(axis, value) => {
                  onTransformChange('position', axis, value);
                }}
              />
            </InspectorSection>
            <Separator />
            <InspectorSection title={t('monitoring:inspector.rotation')}>
              <RotationController
                vec={selectedModel.rotation}
                onChange={(axis, value) => {
                  onTransformChange('rotation', axis, value);
                }}
              />
            </InspectorSection>
            <Separator />
            <InspectorSection title={t('monitoring:inspector.scale')}>
              <ScaleController
                vec={selectedModel.scale}
                onChange={(axis, value) => {
                  onTransformChange('scale', axis, value);
                }}
              />
            </InspectorSection>
          </>
        ) : (
          <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
            <p className="max-w-56 text-center">
              {t('monitoring:inspector.empty')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
