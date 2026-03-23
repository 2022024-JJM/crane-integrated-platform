import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { SavedModelInfo } from '@/entities/3d';
import {
  PositionController,
  RotationController,
  ScaleController,
} from '@/features/3d';
import { Separator } from '@/shared/ui/atoms/separator';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/molecules/card';

interface SceneObjectInspectorProps {
  selectedModel: SavedModelInfo | null;
  onPositionChange: (axis: 'x' | 'y' | 'z', value: number) => void;
  onRotationChange: (axis: 'x' | 'y' | 'z', value: number) => void;
  onScaleChange: (axis: 'x' | 'y' | 'z', value: number) => void;
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
  onPositionChange,
  onRotationChange,
  onScaleChange,
}: SceneObjectInspectorProps) {
  const { t } = useTranslation();

  const selectedLabel = selectedModel
    ? selectedModel.equipName || selectedModel.id
    : null;

  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle>{t('common:inspector.title')}</CardTitle>
        <CardDescription>
          {selectedModel ? (
            <>
              {t('common:inspector.object')}: {selectedLabel}
            </>
          ) : (
            t('common:inspector.empty')
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 py-4">
        {selectedModel ? (
          <>
            <InspectorSection title={t('common:inspector.position')}>
              <PositionController
                vec={selectedModel.position}
                onChange={onPositionChange}
              />
            </InspectorSection>
            <Separator />
            <InspectorSection title={t('common:inspector.rotation')}>
              <RotationController
                vec={selectedModel.rotation}
                onChange={onRotationChange}
              />
            </InspectorSection>
            <Separator />
            <InspectorSection title={t('common:inspector.scale')}>
              <ScaleController vec={selectedModel.scale} onChange={onScaleChange} />
            </InspectorSection>
          </>
        ) : (
          <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
            <p className="max-w-56 text-center">{t('common:inspector.empty')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
