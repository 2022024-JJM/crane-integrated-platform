import { Ban, Check, ImageIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { sceneEnvironmentCatalog } from '@crane/domain/3d';
import { cn } from '@crane/core/lib/utils';

interface PaletteEnvironmentSectionProps {
  /**
   * 현재 씬의 배경 선택. 3-상태다 —
   * 문자열=카탈로그 id, null=배경 없음(명시), undefined=미지정(region 기본).
   */
  environmentId: string | null | undefined;
  onChange: (environmentId: string | null) => void;
}

/**
 * 배경(EXR 파노라마) 선택 — Project 패널의 Background 카테고리.
 *
 * 목록은 카탈로그(sceneEnvironmentCatalog)에서 온다. 웹 최적화본만 등록되어
 * 있어 원본 해상도 업로드로 배경이 검게 나오는 사고가 원천 차단된다.
 *
 * "배경 없음"을 첫 항목으로 둔다. 배경을 끄는 것도 유효한 선택이고(실내 씬,
 * 성능 확보), 목록 안에 있어야 "지금 무엇이 선택되어 있는가"가 한 화면에서
 * 읽힌다. 미지정(undefined) 씬은 아무것도 선택되지 않은 상태로 그린다 —
 * region 기본값이 적용 중이라는 사실을 별도 문구로 알린다.
 */
export const PaletteEnvironmentSection = memo(
  function PaletteEnvironmentSection({
    environmentId,
    onChange,
  }: PaletteEnvironmentSectionProps) {
    const { t } = useTranslation();
    const isUnset = environmentId === undefined;

    return (
      <div className="flex flex-col gap-2">
        {isUnset ? (
          <p className="text-muted-foreground border-border bg-muted/40 rounded-md border px-2 py-1.5 text-[11px] leading-snug">
            {t('monitoring:editor.environmentUnset')}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <EnvironmentTile
            label={t('monitoring:editor.environmentNone')}
            isSelected={environmentId === null}
            onSelect={() => onChange(null)}
            icon={<Ban className="text-muted-foreground size-5" />}
          />
          {sceneEnvironmentCatalog.map((item) => (
            <EnvironmentTile
              key={item.id}
              label={item.label}
              isSelected={environmentId === item.id}
              onSelect={() => onChange(item.id)}
              icon={<ImageIcon className="text-muted-foreground size-5" />}
            />
          ))}
        </div>
      </div>
    );
  },
);

function EnvironmentTile({
  label,
  isSelected,
  onSelect,
  icon,
}: {
  label: string;
  isSelected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onSelect}
      className={cn(
        'group relative flex cursor-pointer flex-col items-center gap-1.5 rounded-md border px-2 py-3 transition',
        isSelected
          ? 'border-primary/50 bg-primary/10'
          : 'border-border bg-card hover:border-border hover:bg-muted/60',
      )}
    >
      {isSelected ? (
        <span className="bg-primary text-primary-foreground absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full">
          <Check className="size-2.5" />
        </span>
      ) : null}
      {icon}
      <span
        className={cn(
          'w-full truncate text-center text-[11px] font-medium',
          isSelected ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
    </button>
  );
}
