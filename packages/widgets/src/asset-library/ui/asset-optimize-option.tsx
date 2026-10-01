import { useTranslation } from 'react-i18next';
import { Switch } from '@crane/ui/atoms/switch';

interface AssetOptimizeOptionProps {
  checked: boolean;
  disabled?: boolean;
  /** 좁은 자리(버전 올리기)에서는 설명을 뺀다. */
  compact?: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * 등록할 때 모델을 최적화할지. `pnpm optimize:glb` 와 같은 파이프라인(텍스처
 * 상한·WebP·지오메트리 압축)을 거쳐 저장하고, 올린 원본은 따로 보관한다.
 */
export function AssetOptimizeOption({
  checked,
  disabled,
  compact = false,
  onChange,
}: AssetOptimizeOptionProps) {
  const { t } = useTranslation();
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="text-foreground block text-[13px] font-medium">
          {t('asset-library:optimize.label')}
        </span>
        {compact ? null : (
          <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
            {t('asset-library:optimize.hint')}
          </span>
        )}
      </span>
      <Switch
        aria-label={t('asset-library:optimize.label')}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        className="mt-0.5"
      />
    </label>
  );
}
