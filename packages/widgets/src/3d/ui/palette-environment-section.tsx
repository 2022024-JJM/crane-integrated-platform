import { Ban, Check, ImageIcon, Sun } from 'lucide-react';
import { memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SCENE_SUN_AZIMUTH_DEFAULT,
  SCENE_SUN_ELEVATION_DEFAULT,
  SCENE_SUN_ELEVATION_MIN,
  SCENE_SUN_MODE_DEFAULT,
  resolveSceneSiteLocation,
} from '@crane/domain/3d';
import type {
  SavedEnvironmentInfo,
  SavedLightingInfo,
  SceneSiteLocation,
  SceneSunMode,
} from '@crane/domain/3d';
import { SceneClockPanel } from '@crane/features/3d';
import type { ScenePaletteEnvironment } from '@crane/features/asset-library';
import { clampToRange, cn } from '@crane/core/lib/utils';
import { InputNumber } from '@crane/ui/atoms/input-number';
import { Switch } from '@crane/ui/atoms/switch';
import { ToggleGroup, ToggleGroupItem } from '@crane/ui/molecules/toggle-group';
import { toPaletteThumbnailUrl } from '../lib/palette-thumbnail';
import { NUMBER_INPUT, NUMBER_WRAPPER } from './inspector-field-classes';
import { PaletteTileThumbnail } from './palette-tile-thumbnail';

interface PaletteEnvironmentSectionProps {
  /** 씬이 지역을 지정하지 않았을 때 region 기본 지역을 찾는 키. */
  regionId: string;
  /**
   * 씬의 지역(시간 기준, `SavedSceneInfo.siteLocation`) — 미지정이면
   * undefined 이고 드롭다운은 region 기본 지역을 보인다. 드롭다운은 현장
   * 시각 연동일 때 시각 패널의 날짜 위에 있다. 현장 시각·낮/밤·현장 날씨가
   * 이 지역을 따르고, 모니터링은 읽기만 한다.
   */
  siteLocation: SceneSiteLocation | undefined;
  onSiteLocationChange: (location: SceneSiteLocation) => void;
  /** 팔레트 항목 — 자산 라이브러리의 배경(고를 수 없는 것 포함). */
  entries: ScenePaletteEnvironment[];
  /** 현재 씬의 배경. 없으면 배경 없음이다. */
  environment: SavedEnvironmentInfo | undefined;
  /** 배경을 고른다 — null 이면 배경 없음(setEnvironment). */
  onChange: (environment: SavedEnvironmentInfo | null) => void;
  /** 진북 방향(도, resolveTrueNorth) — 나침반·태양 방향의 기준. */
  trueNorth: number;
  /** 진북 입력 — [0,360) 로 랩해 저장한다(setTrueNorth). */
  onTrueNorthChange: (degrees: number) => void;
  /** 씬 조명 설정. 필드 없음 = 기본값(그림자 Off, 태양 남쪽 기본 고도). */
  lighting: SavedLightingInfo | undefined;
  onShadowsChange: (shadows: boolean) => void;
  /** 태양 위치(수동 / 현장 시각 연동) — 씬 데이터, 히스토리에 남는다. */
  onSunModeChange: (mode: SceneSunMode) => void;
  onSunAngleChange: (angles: { azimuth: number; elevation: number }) => void;
  /**
   * 태양 패드 드래그 시작/종료 — 드래그 중에는 히스토리를 쌓지 않고
   * 종료 시 1회만 커밋하기 위한 훅(TransformControls와 같은 패턴).
   */
  onSunDragStart: () => void;
  onSunDragEnd: () => void;
}

/**
 * 배경(EXR 파노라마) 선택 + 방위(진북) + 조명(그림자·태양 위치·지역) —
 * Project 패널의 Background 카테고리.
 *
 * 목록은 자산 라이브러리의 배경이다. 게시된 배경만 고를 수 있고, 나머지는
 * 흐리게 보이며 상태가 적힌다. 등록할 때 해상도를 검사하므로(GPU 상한을 넘는
 * 원본은 배경이 검게 나온다) 목록에 있는 것은 그대로 써도 된다.
 *
 * "배경 없음"을 첫 항목으로 둔다. 배경을 끄는 것도 유효한 선택이고(실내 씬,
 * 성능 확보), 목록 안에 있어야 "지금 무엇이 선택되어 있는가"가 한 화면에서
 * 읽힌다. 씬의 배경이 목록에 없는 파일이면(라이브러리가 모르는 파일) 그
 * 사실을 한 줄로 알린다 — 다른 것을 고르기 전까지 그대로 그려진다.
 *
 * 선택 표시는 자산 id 로 한다 — 씬에 놓인 버전이 라이브러리의 현재 버전과
 * 달라도 같은 배경이다. 버전 차이는 새 버전 알림이 따로 알린다.
 *
 * 방위 절은 진북 입력 하나다 — 태양(수동 패드·현장 시각)과 나침반이 같은
 * 북쪽을 보므로 조명 절 바로 위에 둔다. 스테퍼로 359 를 넘기면 세터가 0 으로
 * 랩한다.
 */
export const PaletteEnvironmentSection = memo(
  function PaletteEnvironmentSection({
    regionId,
    siteLocation,
    onSiteLocationChange,
    entries,
    environment,
    onChange,
    trueNorth,
    onTrueNorthChange,
    lighting,
    onShadowsChange,
    onSunModeChange,
    onSunAngleChange,
    onSunDragStart,
    onSunDragEnd,
  }: PaletteEnvironmentSectionProps) {
    const { t } = useTranslation();
    const selectedEntry = environment
      ? entries.find((entry) =>
          environment.asset
            ? entry.item.id === environment.asset.id
            : entry.item.path !== '' && entry.item.path === environment.path,
        )
      : undefined;
    // 씬에 배경이 있는데 목록에서 찾지 못했다 — 라이브러리가 모르는 파일이다.
    const isUnmanaged = environment !== undefined && !selectedEntry;
    const shadowsEnabled = lighting?.shadows === true;
    const sunMode = lighting?.sunMode ?? SCENE_SUN_MODE_DEFAULT;
    const resolvedLocation = resolveSceneSiteLocation(regionId, {
      siteLocation,
    });
    // 지역이 정해지지 않으면 solar 를 고를 수 없다 — 런타임이 어차피
    // manual 로 폴백하므로 고르게 두면 "켰는데 아무 변화가 없는" 상태가 된다.
    const hasSiteGeo = resolvedLocation !== null;
    const isSolar = sunMode === 'solar' && hasSiteGeo;
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
        {isUnmanaged ? (
          <p className="text-muted-foreground border-border bg-muted/40 rounded-md border px-2 py-1.5 text-[11px] leading-snug">
            {t('monitoring:editor.environmentUnmanaged')}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <EnvironmentTile
            label={t('monitoring:editor.environmentNone')}
            isSelected={environment === undefined}
            onSelect={() => onChange(null)}
            icon={<Ban className="text-muted-foreground size-5" />}
          />
          {entries.map((entry) => {
            const isSelected = entry === selectedEntry;
            // 이미 고른 배경은 상태와 무관하게 선택된 채로 보인다.
            const blocked = isSelected ? null : entry.blocked;
            return (
              <EnvironmentTile
                key={entry.item.id}
                label={entry.item.label}
                isSelected={isSelected}
                blockedLabel={
                  blocked === null
                    ? null
                    : blocked === 'unpublished'
                      ? t(`asset-library:status.${entry.status}`)
                      : t(`monitoring:palette.blocked.${blocked}`)
                }
                title={
                  blocked
                    ? t(`monitoring:palette.blockedHint.${blocked}`)
                    : undefined
                }
                onSelect={() => {
                  if (blocked !== null || isSelected) return;
                  onChange({
                    path: entry.item.path,
                    asset: { id: entry.item.id, version: entry.item.version },
                  });
                }}
                thumbnailUrl={toPaletteThumbnailUrl(entry.thumbnail)}
                icon={<ImageIcon className="text-muted-foreground size-5" />}
              />
            );
          })}
        </div>

        {/* 방위 — 진북 입력(나침반·태양 방향의 기준) */}
        <div className="border-border mt-1 flex flex-col gap-2 border-t pt-2">
          <span className="text-muted-foreground text-[11px] font-medium">
            {t('monitoring:editor.trueNorthSection')}
          </span>
          <div className="flex items-center justify-between gap-2">
            <span className="text-foreground text-[11px]">
              {t('monitoring:editor.trueNorth')}
            </span>
            <InputNumber
              value={trueNorth}
              step={1}
              editPreview
              unit="°"
              format={(value) => `${value}°`}
              className={cn(NUMBER_WRAPPER, 'w-20 shrink-0')}
              inputClassName={cn(NUMBER_INPUT, 'text-right')}
              aria-label={t('monitoring:editor.trueNorth')}
              onChange={onTrueNorthChange}
            />
          </div>
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

          {/* 태양 위치 — 수동(패드) / 현장 시각 연동(낮·밤 자동). */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-foreground text-[11px]">
              {t('monitoring:editor.lightingSunMode')}
            </span>
            <ToggleGroup
              value={[isSolar ? 'solar' : 'manual']}
              onValueChange={(next) => {
                const choice = next[0];
                if (choice === 'solar' || choice === 'manual') {
                  onSunModeChange(choice);
                }
              }}
              variant="outline"
              size="sm"
              aria-label={t('monitoring:editor.lightingSunMode')}
            >
              <ToggleGroupItem value="manual" className="h-6 px-2 text-[10px]">
                {t('monitoring:editor.lightingSunModeManual')}
              </ToggleGroupItem>
              <ToggleGroupItem
                value="solar"
                disabled={!hasSiteGeo}
                className="h-6 px-2 text-[10px]"
              >
                {t('monitoring:editor.lightingSunModeSolar')}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          {!hasSiteGeo ? (
            <p className="text-muted-foreground text-[10px] leading-snug">
              {t('monitoring:editor.lightingSunModeNoGeo')}
            </p>
          ) : null}

          {isSolar ? (
            // 시각 미리보기 — 모니터링 독 팝업과 같은 패널·같은 전역 시계.
            <SceneClockPanel
              regionId={regionId}
              siteLocation={siteLocation}
              onSiteLocationChange={onSiteLocationChange}
              solarEnabled
            />
          ) : (
            // 그림자 Off여도 활성 — 태양 위치는 그림자와 무관하게 조명
            // 방향(셰이딩)에 항상 반영된다(scene-render-preset.tsx).
            <SunPositionPad
              azimuth={sunAzimuth}
              elevation={sunElevation}
              onAngleChange={onSunAngleChange}
              onInteractionStart={handleSunInteractionStart}
              onInteractionEnd={handleSunInteractionEnd}
            />
          )}
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
 * 각도=지리 방위 360°(위=진북, 오른쪽=동 — SavedLightingInfo 규약). 월드
 * 방향은 런타임이 씬 진북만큼 돌린다(SceneLighting).
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
        <span
          className={cn(compassLabel, 'bottom-0 left-1/2 -translate-x-1/2')}
        >
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
  blockedLabel = null,
  title,
  onSelect,
  thumbnailUrl,
  icon,
}: {
  label: string;
  isSelected: boolean;
  /** 고를 수 없는 이유(자산 상태). 고를 수 있으면 null. */
  blockedLabel?: string | null;
  title?: string;
  onSelect: () => void;
  /** 라이브러리에 저장된 썸네일. 없으면(배경 없음 타일 포함) 아이콘. */
  thumbnailUrl?: string;
  icon: React.ReactNode;
}) {
  const blocked = blockedLabel !== null;
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      aria-disabled={blocked || undefined}
      title={title}
      onClick={onSelect}
      className={cn(
        'group relative flex flex-col items-center gap-1 rounded-md border p-1 pb-1.5 transition',
        blocked ? 'cursor-not-allowed opacity-55' : 'cursor-pointer',
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
      {/* 배경 썸네일은 화면을 채운 그림이라 받침 위에 띄우지 않고 자리를 채운다. */}
      <PaletteTileThumbnail
        url={thumbnailUrl}
        alt=""
        fit="cover"
        fallback={icon}
      />
      <span
        className={cn(
          'w-full truncate text-center text-[11px] font-medium',
          isSelected ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
      {blocked ? (
        <span className="text-muted-foreground/80 w-full truncate text-center text-[9px] leading-none">
          {blockedLabel}
        </span>
      ) : null}
    </button>
  );
}
