import { Ban, Check, ImageIcon } from 'lucide-react';
import { memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SCENE_SUN_POSITION_DEFAULT,
  sceneEnvironmentCatalog,
} from '@crane/domain/3d';
import type { SavedLightingInfo } from '@crane/domain/3d';
import { cn } from '@crane/core/lib/utils';
import { Switch } from '@crane/ui/atoms/switch';

interface PaletteEnvironmentSectionProps {
  /**
   * 현재 씬의 배경 선택. 3-상태다 —
   * 문자열=카탈로그 id, null=배경 없음(명시), undefined=미지정(region 기본).
   */
  environmentId: string | null | undefined;
  onChange: (environmentId: string | null) => void;
  /** 씬 조명 설정. 필드 없음 = 기본값(그림자 Off, 태양 남중). */
  lighting: SavedLightingInfo | undefined;
  onShadowsChange: (shadows: boolean) => void;
  onSunPositionChange: (sunPosition: number) => void;
  /**
   * 태양 슬라이더 드래그 시작/종료 — 드래그 중에는 히스토리를 쌓지 않고
   * 종료 시 1회만 커밋하기 위한 훅(TransformControls와 같은 패턴).
   */
  onSunPositionDragStart: () => void;
  onSunPositionDragEnd: () => void;
}

/**
 * 배경(EXR 파노라마) 선택 + 조명(그림자·태양 위치) — Project 패널의
 * Background 카테고리.
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
    lighting,
    onShadowsChange,
    onSunPositionChange,
    onSunPositionDragStart,
    onSunPositionDragEnd,
  }: PaletteEnvironmentSectionProps) {
    const { t } = useTranslation();
    const isUnset = environmentId === undefined;
    const shadowsEnabled = lighting?.shadows === true;
    const sunPosition = lighting?.sunPosition ?? SCENE_SUN_POSITION_DEFAULT;

    // 키를 누르고 있으면 keydown이 반복 발화한다 — start가 반복되면 히스토리
    // base 스냅샷이 중간값으로 덮어써져 undo가 한 스텝만 되돌린다. 상호작용이
    // 살아 있는 동안은 start/end를 다시 부르지 않는다.
    const sunInteractionActiveRef = useRef(false);
    const handleSunInteractionStart = () => {
      if (sunInteractionActiveRef.current) return;
      sunInteractionActiveRef.current = true;
      onSunPositionDragStart();
    };
    const handleSunInteractionEnd = () => {
      if (!sunInteractionActiveRef.current) return;
      sunInteractionActiveRef.current = false;
      onSunPositionDragEnd();
    };

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

        {/* 조명 — 그림자 토글 + 태양 위치(동→서) 슬라이더 */}
        <div className="border-border mt-1 flex flex-col gap-2 border-t pt-2">
          <span className="text-muted-foreground text-[11px] font-medium">
            {t('monitoring:editor.lightingSection')}
          </span>

          <div className="flex items-center justify-between">
            <span className="text-foreground text-[11px]">
              {t('monitoring:editor.lightingShadows')}
            </span>
            <Switch
              checked={shadowsEnabled}
              onCheckedChange={onShadowsChange}
              aria-label={t('monitoring:editor.lightingShadows')}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-foreground text-[11px]">
              {t('monitoring:editor.lightingSunPosition')}
            </span>
            {/* 그림자 Off여도 활성 — 태양 위치는 그림자와 무관하게 조명
                방향(셰이딩)에 항상 반영된다(scene-render-preset.tsx). */}
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={sunPosition}
              className="accent-primary h-2 w-full cursor-pointer"
              aria-label={t('monitoring:editor.lightingSunPosition')}
              onPointerDown={handleSunInteractionStart}
              onPointerUp={handleSunInteractionEnd}
              onKeyDown={handleSunInteractionStart}
              onKeyUp={handleSunInteractionEnd}
              onBlur={handleSunInteractionEnd}
              onChange={(event) => {
                onSunPositionChange(Number(event.target.value));
              }}
            />
            <div className="text-muted-foreground flex justify-between text-[10px]">
              <span>{t('monitoring:editor.lightingSunEast')}</span>
              <span>{t('monitoring:editor.lightingSunWest')}</span>
            </div>
          </div>
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
