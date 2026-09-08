import { Ban, Check, ImageIcon, Sun } from 'lucide-react';
import { memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SCENE_SUN_AZIMUTH_DEFAULT,
  SCENE_SUN_ELEVATION_DEFAULT,
  SCENE_SUN_ELEVATION_MIN,
  sceneEnvironmentCatalog,
} from '@crane/domain/3d';
import type { SavedLightingInfo } from '@crane/domain/3d';
import { clampToRange, cn } from '@crane/core/lib/utils';
import { Switch } from '@crane/ui/atoms/switch';

interface PaletteEnvironmentSectionProps {
  /**
   * 현재 씬의 배경 선택. 3-상태다 —
   * 문자열=카탈로그 id, null=배경 없음(명시), undefined=미지정(region 기본).
   */
  environmentId: string | null | undefined;
  onChange: (environmentId: string | null) => void;
  /** 씬 조명 설정. 필드 없음 = 기본값(그림자 Off, 태양 남쪽 기본 고도). */
  lighting: SavedLightingInfo | undefined;
  onShadowsChange: (shadows: boolean) => void;
  onSunAngleChange: (angles: { azimuth: number; elevation: number }) => void;
  /**
   * 태양 패드 드래그 시작/종료 — 드래그 중에는 히스토리를 쌓지 않고
   * 종료 시 1회만 커밋하기 위한 훅(TransformControls와 같은 패턴).
   */
  onSunDragStart: () => void;
  onSunDragEnd: () => void;
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
    onSunAngleChange,
    onSunDragStart,
    onSunDragEnd,
  }: PaletteEnvironmentSectionProps) {
    const { t } = useTranslation();
    const isUnset = environmentId === undefined;
    const shadowsEnabled = lighting?.shadows === true;
    const sunAzimuth = lighting?.sunAzimuth ?? SCENE_SUN_AZIMUTH_DEFAULT;
    const sunElevation = lighting?.sunElevation ?? SCENE_SUN_ELEVATION_DEFAULT;

    // 키를 누르고 있으면 keydown이 반복 발화한다 — start가 반복되면 히스토리
    // base 스냅샷이 중간값으로 덮어써져 undo가 한 스텝만 되돌린다. 상호작용이
    // 살아 있는 동안은 start/end를 다시 부르지 않는다.
    const sunInteractionActiveRef = useRef(false);
    const handleSunInteractionStart = () => {
      if (sunInteractionActiveRef.current) return;
      sunInteractionActiveRef.current = true;
      onSunDragStart();
    };
    const handleSunInteractionEnd = () => {
      if (!sunInteractionActiveRef.current) return;
      sunInteractionActiveRef.current = false;
      onSunDragEnd();
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

        {/* 조명 — 그림자 토글 + 태양 위치(방위·고도) 패드 */}
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

          {/* 그림자 Off여도 활성 — 태양 위치는 그림자와 무관하게 조명
              방향(셰이딩)에 항상 반영된다(scene-render-preset.tsx). */}
          <SunPositionPad
            azimuth={sunAzimuth}
            elevation={sunElevation}
            onAngleChange={onSunAngleChange}
            onInteractionStart={handleSunInteractionStart}
            onInteractionEnd={handleSunInteractionEnd}
          />
        </div>
      </div>
    );
  },
);

const SUN_PAD_SIZE = 120;
/** 핸들 중심의 최대 이동 반경 — 핸들(size-6)이 패드 테두리 안에 머문다. */
const SUN_HANDLE_TRAVEL = SUN_PAD_SIZE / 2 - 12;
const SUN_ELEVATION_SPAN = 90 - SCENE_SUN_ELEVATION_MIN;
/** 방위 라벨을 포함한 전체 폭 — 패드 사방에 라벨이 놓일 여백. */
const SUN_PAD_OUTER = SUN_PAD_SIZE + 32;

/**
 * 태양 위치 패드 — 하늘을 위에서 내려다본 원판. 중심=머리 위(고도 90°,
 * 그림자 최소), 가장자리=최저 고도(SCENE_SUN_ELEVATION_MIN, 그림자 최대).
 * 각도=방위 360°(위=북=-Z, 오른쪽=동=+X — SavedLightingInfo 규약).
 *
 * 태양 아이콘이 드래그 핸들이다. 핸들 자체는 pointer-events를 받지 않고
 * 패드 전체가 받는다 — 누르는 즉시 그 지점으로 점프하고 setPointerCapture로
 * 패드 밖 드래그도 따라온다.
 */
function SunPositionPad({
  azimuth,
  elevation,
  onAngleChange,
  onInteractionStart,
  onInteractionEnd,
}: {
  azimuth: number;
  elevation: number;
  onAngleChange: (angles: { azimuth: number; elevation: number }) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}) {
  const { t } = useTranslation();
  const draggingRef = useRef(false);

  const applyPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const rNorm = clampToRange(Math.hypot(dx, dy) / SUN_HANDLE_TRAVEL, 0, 1);
    // 중심 데드존: atan2가 불안정해 방위가 널뛴다 — 방위는 유지하고 고도만
    // 90°(머리 위)로. prop 폐쇄값이라 최악 이벤트 1개만큼 stale — 무시 가능.
    const nextAzimuth =
      rNorm < 0.02
        ? azimuth
        : (Math.atan2(dx, -dy) * (180 / Math.PI) + 360) % 360;
    onAngleChange({
      azimuth: nextAzimuth,
      elevation: 90 - rNorm * SUN_ELEVATION_SPAN,
    });
  };

  // 핸들 표시 위치 — 화면 y는 아래가 양수이므로 북(-cos)을 위로 뒤집는다.
  const rNorm = (90 - elevation) / SUN_ELEVATION_SPAN;
  const azRad = azimuth * (Math.PI / 180);
  const handleX = Math.sin(azRad) * rNorm * SUN_HANDLE_TRAVEL;
  const handleY = -Math.cos(azRad) * rNorm * SUN_HANDLE_TRAVEL;

  const compassLabel = 'text-muted-foreground absolute text-[10px]';

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative"
        style={{ width: SUN_PAD_OUTER, height: SUN_PAD_OUTER }}
      >
        <span className={cn(compassLabel, 'top-0 left-1/2 -translate-x-1/2')}>
          {t('monitoring:editor.lightingSunNorth')}
        </span>
        <span className={cn(compassLabel, 'top-1/2 right-0 -translate-y-1/2')}>
          {t('monitoring:editor.lightingSunEast')}
        </span>
        <span className={cn(compassLabel, 'bottom-0 left-1/2 -translate-x-1/2')}>
          {t('monitoring:editor.lightingSunSouth')}
        </span>
        <span className={cn(compassLabel, 'top-1/2 left-0 -translate-y-1/2')}>
          {t('monitoring:editor.lightingSunWest')}
        </span>

        <div
          // 2축 컨트롤이라 role="slider"가 완벽히 맞지는 않지만, 값 서술은
          // aria-valuetext로 전달한다. 화살표 키: 좌우=방위, 상하=고도.
          role="slider"
          aria-label={t('monitoring:editor.lightingSunPosition')}
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(azimuth)}
          aria-valuetext={`${t('monitoring:editor.lightingSunAzimuth')} ${Math.round(azimuth)}°, ${t('monitoring:editor.lightingSunElevation')} ${Math.round(elevation)}°`}
          tabIndex={0}
          className="border-border bg-muted/40 focus-visible:ring-ring absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer touch-none rounded-full border focus-visible:ring-1 focus-visible:outline-none"
          style={{ width: SUN_PAD_SIZE, height: SUN_PAD_SIZE }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            draggingRef.current = true;
            onInteractionStart();
            applyPointer(event);
          }}
          onPointerMove={(event) => {
            if (draggingRef.current) applyPointer(event);
          }}
          onPointerUp={() => {
            draggingRef.current = false;
            onInteractionEnd();
          }}
          onPointerCancel={() => {
            draggingRef.current = false;
            onInteractionEnd();
          }}
          onKeyDown={(event) => {
            // 키보드 스텝은 정수로 반올림 — 기본 고도(78.69…)에서 시작해도
            // 소수 잔재 없이 5° 격자로 움직인다.
            let nextAzimuth = Math.round(azimuth);
            let nextElevation = Math.round(elevation);
            if (event.key === 'ArrowLeft') {
              nextAzimuth = (nextAzimuth + 355) % 360;
            } else if (event.key === 'ArrowRight') {
              nextAzimuth = (nextAzimuth + 5) % 360;
            } else if (event.key === 'ArrowUp') {
              nextElevation = Math.min(90, nextElevation + 5);
            } else if (event.key === 'ArrowDown') {
              nextElevation = Math.max(
                SCENE_SUN_ELEVATION_MIN,
                nextElevation - 5,
              );
            } else {
              return;
            }
            event.preventDefault();
            onInteractionStart();
            onAngleChange({ azimuth: nextAzimuth, elevation: nextElevation });
          }}
          onKeyUp={onInteractionEnd}
          onBlur={onInteractionEnd}
        >
          {/* 가이드 — 크로스헤어 + 중간 고도 동심원. 장식이므로 이벤트 차단 */}
          <div className="pointer-events-none absolute inset-0">
            <span className="bg-border/70 absolute top-1/2 right-2 left-2 h-px" />
            <span className="bg-border/70 absolute top-2 bottom-2 left-1/2 w-px" />
            <span
              className="border-border/70 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
              style={{ width: SUN_HANDLE_TRAVEL, height: SUN_HANDLE_TRAVEL }}
            />
          </div>
          <div
            className="pointer-events-none absolute top-1/2 left-1/2"
            style={{
              transform: `translate(calc(-50% + ${handleX}px), calc(-50% + ${handleY}px))`,
            }}
          >
            <span className="bg-card border-border flex size-6 items-center justify-center rounded-full border shadow-sm">
              <Sun className="size-4 text-amber-500" />
            </span>
          </div>
        </div>
      </div>

      <span className="text-muted-foreground text-[10px] tabular-nums">
        {t('monitoring:editor.lightingSunAzimuth')} {Math.round(azimuth)}° ·{' '}
        {t('monitoring:editor.lightingSunElevation')} {Math.round(elevation)}°
      </span>
    </div>
  );
}

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
