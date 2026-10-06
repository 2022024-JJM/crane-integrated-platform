import { useTranslation } from 'react-i18next';
import type { AssetKind } from '@crane/domain/asset-library';
import { Switch } from '@crane/ui/atoms/switch';

interface AssetOptimizeOptionProps {
  /** 모델인지 지도인지 — 설명이 다르다(파이프라인이 다르다). */
  kind: AssetKind;
  checked: boolean;
  disabled?: boolean;
  /** 좁은 자리(버전 올리기)에서는 설명을 뺀다. */
  compact?: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * 등록할 때 모델·지도를 최적화할지. 모델은 `scripts/optimize-glb.mjs`, 지도는
 * `scripts/optimize-map.mjs` 파이프라인을 거쳐 저장하고, 올린 원본은 따로
 * 보관한다. 고를 것은 켜고 끄는 것 하나다 — 지도의 타일·LOD·압축 여부는
 * 파이프라인이 파일을 재서 정한다.
 */
export function AssetOptimizeOption({
  kind,
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
            {t(
              kind === 'map'
                ? 'asset-library:optimize.hintMap'
                : 'asset-library:optimize.hint',
            )}
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
