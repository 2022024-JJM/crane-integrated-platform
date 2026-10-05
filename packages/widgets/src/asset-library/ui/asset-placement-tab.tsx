import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ASSET_MAP_ROLES,
  type AssetMapRole,
  type AssetPlacement,
  type AssetRecord,
} from '@crane/domain/asset-library';
import { useAssetLibraryStore } from '@crane/features/asset-library';
import type { Vector3Tuple } from '@crane/core/types/math';
import { InputNumber } from '@crane/ui/atoms/input-number';
import { Switch } from '@crane/ui/atoms/switch';
import { ToggleGroup, ToggleGroupItem } from '@crane/ui/molecules/toggle-group';
import { useAssetSaveReport } from '../model/use-asset-save-report';

interface AssetPlacementTabProps {
  asset: AssetRecord;
  actor: string;
}

const AXES = ['X', 'Y', 'Z'] as const;
const ORIGIN: Vector3Tuple = [0, 0, 0];

/** 속성 하나 — 이름과 조작이 한 줄, 그 아래에 무엇을 하는 값인지 적는다. */
function PlacementRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="border-border flex flex-col gap-1.5 border-b px-5 py-4 last:border-b-0">
      <div className="flex min-h-7 items-center justify-between gap-3">
        <span className="text-foreground text-[13px] font-medium">{label}</span>
        {children}
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>
    </div>
  );
}

/**
 * 배치 속성 — 3D 화면 편집에서 이 자산을 씬에 놓을 때의 기본값.
 *
 * 값은 놓는 순간 씬에 복사된다. 그 뒤로는 씬이 자기 값을 가지므로 여기서
 * 바꿔도 이미 놓인 것은 달라지지 않는다 — 탭 아래에 그렇게 적는다. 종류에
 * 맞는 속성만 나온다(지도: 역할·기본 위치, 모델: 수면에 놓기).
 */
export function AssetPlacementTab({ asset, actor }: AssetPlacementTabProps) {
  const { t } = useTranslation();
  const report = useAssetSaveReport();
  const updateMetadata = useAssetLibraryStore((state) => state.updateMetadata);
  const placement = asset.placement ?? {};

  // 배치 속성은 통째로 갈아 끼운다 — 기본 동작인 값은 저장할 때 떨어진다.
  const patch = (change: AssetPlacement) =>
    report(
      updateMetadata(
        asset.id,
        { placement: { ...placement, ...change } },
        actor,
      ),
    );

  const role = placement.mapRole ?? 'ground';
  const position = placement.defaultPosition ?? ORIGIN;

  return (
    <div>
      <PlacementRow
        label={t('asset-library:placement.palette')}
        hint={t('asset-library:placement.paletteHint')}
      >
        <Switch
          checked={placement.paletteHidden !== true}
          onCheckedChange={(shown) => patch({ paletteHidden: !shown })}
          aria-label={t('asset-library:placement.palette')}
        />
      </PlacementRow>

      {asset.kind === 'map' ? (
        <>
          <PlacementRow
            label={t('asset-library:placement.mapRole')}
            hint={t(`asset-library:placement.mapRoleHint.${role}`)}
          >
            <ToggleGroup
              value={[role]}
              onValueChange={(next) => {
                const choice = next[0] as AssetMapRole | undefined;
                if (choice && ASSET_MAP_ROLES.includes(choice)) {
                  patch({ mapRole: choice });
                }
              }}
              variant="outline"
              size="sm"
              aria-label={t('asset-library:placement.mapRole')}
            >
              {ASSET_MAP_ROLES.map((item) => (
                <ToggleGroupItem
                  key={item}
                  value={item}
                  className="h-7 px-2.5 text-xs"
                >
                  {t(`asset-library:placement.mapRoleOption.${item}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </PlacementRow>
          <PlacementRow
            label={t('asset-library:placement.defaultPosition')}
            hint={t('asset-library:placement.defaultPositionHint')}
          >
            <div className="flex items-center gap-1.5">
              {AXES.map((axis, index) => (
                <InputNumber
                  key={axis}
                  value={position[index]}
                  step={1}
                  className="h-7 w-[5.25rem]"
                  inputClassName="text-xs"
                  aria-label={`${t('asset-library:placement.defaultPosition')} ${axis}`}
                  format={(value) => `${axis} ${value}`}
                  onChange={(value) => {
                    const next: Vector3Tuple = [...position];
                    next[index] = value;
                    patch({ defaultPosition: next });
                  }}
                />
              ))}
            </div>
          </PlacementRow>
        </>
      ) : null}

      {asset.kind === 'model' ? (
        <PlacementRow
          label={t('asset-library:placement.floating')}
          hint={t('asset-library:placement.floatingHint')}
        >
          <Switch
            checked={placement.floating === true}
            onCheckedChange={(floating) => patch({ floating })}
            aria-label={t('asset-library:placement.floating')}
          />
        </PlacementRow>
      ) : null}

      <p className="text-muted-foreground px-5 py-4 text-xs leading-relaxed">
        {t('asset-library:placement.note')}
      </p>
    </div>
  );
}
