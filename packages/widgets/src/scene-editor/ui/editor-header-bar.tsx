import {
  SceneTransformModeToggle,
  SceneTransformSpaceSelect,
  SCENE_SNAP_STEP_OPTIONS,
  type SceneSnapChannel,
  type SceneSnapStep,
  type SceneTransformMode,
  type SceneTransformSpace,
} from '@crane/features/3d';
import {
  Binoculars,
  ChevronDown,
  Download,
  Grid3x3,
  House,
  Loader2,
  Magnet,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  Save,
  Type,
  Undo2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from '@crane/ui/molecules/popover';
import { ToggleGroup, ToggleGroupItem } from '@crane/ui/molecules/toggle-group';
import { TooltipProvider } from '@crane/ui/molecules/tooltip';
import { EDITOR_TOOLBAR_DIVIDER_CLASS } from '../lib/editor-toolbar-classes';
import {
  formatSnapRotation,
  formatSnapScale,
  formatSnapStep,
  formatSnapTranslation,
} from '../lib/format-snap-step';
import { SHORTCUT_MOD } from '../lib/shortcut-modifier';
import { EditorToolbarButton } from './editor-toolbar-button';

/** 이동/회전/크기 단축키 — Unity·Unreal 계열. 바인딩은 페이지의 keydown. */
const MODE_SHORTCUTS = {
  translate: 'W',
  rotate: 'E',
  scale: 'R',
} as const;

interface EditorHeaderBarProps {
  // 문서 동작
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  saveDisabled: boolean;
  isSaving: boolean;
  isDirty: boolean;
  onSave: () => void;
  onExport: () => void;
  // 도구
  mode: SceneTransformMode;
  onModeChange: (mode: SceneTransformMode) => void;
  onAddText: () => void;
  // 도구 동작 설정
  transformSpace: SceneTransformSpace;
  onTransformSpaceChange: (space: SceneTransformSpace) => void;
  /** scale 모드처럼 three 가 축 기준을 강제하는 동안 잠근다. */
  transformSpaceDisabled: boolean;
  snapEnabled: boolean;
  snapStep: SceneSnapStep;
  onToggleSnap: () => void;
  onSnapStepChange: (channel: SceneSnapChannel, value: number) => void;
  // 보기
  showGrid: boolean;
  onToggleGrid: () => void;
  onResetView: () => void;
  onTopView: () => void;
  /** 씬이 로드되기 전 — 도구·설정·보기 전부 잠근다. */
  sceneDisabled: boolean;
  // 사이드 패널 접기/펼치기 — 헤더 양끝의 고정 토글
  leftPanelCollapsed: boolean;
  onToggleLeftPanel: () => void;
  rightPanelCollapsed: boolean;
  onToggleRightPanel: () => void;
  // 전체화면 — 편집 페이지 루트를 Fullscreen API 로 올린다
  isFullscreen: boolean;
  /** Fullscreen API 를 못 쓰는 환경(iframe 정책 등)이면 버튼을 숨긴다. */
  fullscreenSupported: boolean;
  onToggleFullscreen: () => void;
}

/**
 * 뷰포트 위 고정 헤더 바. 뷰포트 오버레이가 아니라 캔버스 바깥의 평평한
 * 크롬이라 캡슐·그림자가 없다. 기능 수가 적어 도구·보기까지 한 줄에 둔다.
 *
 * - 좌측: 씬 전체·파일에 작용하는 문서 동작(실행취소·다시실행 | 저장·내보내기)
 * - 중앙: 모달 도구(이동/회전/크기) · 좌표계(로컬/월드) | 스냅 · 격자 · 홈 ·
 *   탑뷰 | 텍스트 추가
 * - 우측: 전체화면 · 우측 패널 토글
 *
 * 그룹 사이는 간격으로만 나누고, 구분선은 "기즈모(도구·좌표계) | 스냅·보기 |
 * 생성(텍스트)" 소분류 경계에만 쓴다. 활성 표현은 성격별로 다르다 — 모달 도구는 배경 채움,
 * 상태 토글(스냅·격자)은 하단 점, 액션은 눌림 피드백만.
 *
 * 높이는 h-9(36px) 에 28px 컨트롤 — 좌측 팔레트 탭 헤더(ProjectPalettePanel)
 * 와 우측 Hierarchy 검색 헤더(PaletteHeader)가 같은 h-9 라 세 컬럼의 하단선이
 * 한 줄에 놓인다. 공통 상수 없이 각자 h-9 를 쓰므로 바꿀 때 셋을 같이 고친다.
 */
export function EditorHeaderBar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  saveDisabled,
  isSaving,
  isDirty,
  onSave,
  onExport,
  mode,
  onModeChange,
  onAddText,
  transformSpace,
  onTransformSpaceChange,
  transformSpaceDisabled,
  snapEnabled,
  snapStep,
  onToggleSnap,
  onSnapStepChange,
  showGrid,
  onToggleGrid,
  onResetView,
  onTopView,
  sceneDisabled,
  leftPanelCollapsed,
  onToggleLeftPanel,
  rightPanelCollapsed,
  onToggleRightPanel,
  isFullscreen,
  fullscreenSupported,
  onToggleFullscreen,
}: EditorHeaderBarProps) {
  const { t } = useTranslation();

  return (
    <TooltipProvider>
      <div
        role="toolbar"
        aria-label={t('monitoring:editor.headerBar')}
        className="bg-card border-border flex h-9 shrink-0 items-center justify-between gap-2 border-b px-1.5"
      >
        {/* 좌측 — 문서 동작 */}
        <div className="flex items-center gap-2">
          <EditorToolbarButton
            label={t(
              leftPanelCollapsed
                ? 'monitoring:editor.expandPanel'
                : 'monitoring:editor.collapsePanel',
            )}
            side="bottom"
            onClick={onToggleLeftPanel}
          >
            {leftPanelCollapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </EditorToolbarButton>
          <div className="flex items-center gap-0.5">
            <EditorToolbarButton
              label={t('monitoring:history.undo')}
              shortcut={[SHORTCUT_MOD, 'Z']}
              side="bottom"
              disabled={!canUndo}
              onClick={onUndo}
            >
              <Undo2 className="size-4" />
            </EditorToolbarButton>
            <EditorToolbarButton
              label={t('monitoring:history.redo')}
              shortcut={[SHORTCUT_MOD, 'Y']}
              side="bottom"
              disabled={!canRedo}
              onClick={onRedo}
            >
              <Redo2 className="size-4" />
            </EditorToolbarButton>
          </div>
          <div className="flex items-center gap-0.5">
            {/* 저장 상태는 버튼 자체가 나타낸다 — 미저장이면 붉은 점과 진한
                아이콘, 저장되면 흐린 아이콘. 저장 직후 확인은 성공 토스트가
                맡는다(운영의 "이 브라우저에만" 고지도 거기서). */}
            <EditorToolbarButton
              label={t('monitoring:editor.save')}
              shortcut={[SHORTCUT_MOD, 'S']}
              side="bottom"
              disabled={saveDisabled || isSaving}
              className={cn(isDirty && 'text-foreground')}
              onClick={onSave}
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {isDirty && !isSaving ? (
                <span
                  aria-hidden
                  className="absolute top-1 right-1 size-1.5 rounded-full bg-red-500"
                />
              ) : null}
            </EditorToolbarButton>
            <EditorToolbarButton
              label={t('monitoring:editor.exportJson')}
              side="bottom"
              disabled={saveDisabled}
              onClick={onExport}
            >
              <Download className="size-4" />
            </EditorToolbarButton>
          </div>
        </div>

        {/* 중앙 — 모달 도구 · 좌표계 | 스냅 · 격자 · 홈 · 탑뷰 | 텍스트 */}
        <div
          role="group"
          aria-label={t('monitoring:editor.toolDock')}
          className="flex items-center gap-0.5"
        >
          <SceneTransformModeToggle
            mode={mode}
            onModeChange={onModeChange}
            shortcuts={MODE_SHORTCUTS}
            tooltipSide="bottom"
          />
          <SceneTransformSpaceSelect
            space={transformSpace}
            onSpaceChange={onTransformSpaceChange}
            disabled={transformSpaceDisabled || sceneDisabled}
          />
          <span aria-hidden className={EDITOR_TOOLBAR_DIVIDER_CLASS} />
          <SnapSplitButton
            enabled={snapEnabled}
            step={snapStep}
            disabled={sceneDisabled}
            onToggle={onToggleSnap}
            onStepChange={onSnapStepChange}
          />
          <EditorToolbarButton
            label={t('monitoring:editor.grid')}
            kind="toggle"
            pressed={showGrid}
            side="bottom"
            disabled={sceneDisabled}
            onClick={onToggleGrid}
          >
            <Grid3x3 className="size-4" />
          </EditorToolbarButton>
          <EditorToolbarButton
            label={t('common:viewer3d.resetView')}
            side="bottom"
            disabled={sceneDisabled}
            onClick={onResetView}
          >
            <House className="size-4" />
          </EditorToolbarButton>
          <EditorToolbarButton
            label={t('common:viewer3d.topView')}
            side="bottom"
            disabled={sceneDisabled}
            onClick={onTopView}
          >
            <Binoculars className="size-4" />
          </EditorToolbarButton>
          <span aria-hidden className={EDITOR_TOOLBAR_DIVIDER_CLASS} />
          <EditorToolbarButton
            label={t('monitoring:editor.addText')}
            side="bottom"
            disabled={sceneDisabled}
            onClick={onAddText}
          >
            <Type className="size-4" />
          </EditorToolbarButton>
        </div>

        {/* 우측 — 전체화면 · 우측 패널 토글. 전체화면은 페이지 루트 전체를
            올리므로 이 버튼이 전체화면 안에서도 남아 복원 경로가 된다. */}
        <div className="flex items-center gap-2">
          {fullscreenSupported ? (
            <EditorToolbarButton
              label={t(
                isFullscreen
                  ? 'common:viewer3d.exitFullscreen'
                  : 'common:viewer3d.fullscreen',
              )}
              side="bottom"
              onClick={onToggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </EditorToolbarButton>
          ) : null}
          <EditorToolbarButton
            label={t(
              rightPanelCollapsed
                ? 'monitoring:editor.expandPanel'
                : 'monitoring:editor.collapsePanel',
            )}
            side="bottom"
            onClick={onToggleRightPanel}
          >
            {rightPanelCollapsed ? (
              <PanelRightOpen className="size-4" />
            ) : (
              <PanelRightClose className="size-4" />
            )}
          </EditorToolbarButton>
        </div>
      </div>
    </TooltipProvider>
  );
}

interface SnapSplitButtonProps {
  enabled: boolean;
  step: SceneSnapStep;
  disabled: boolean;
  onToggle: () => void;
  onStepChange: (channel: SceneSnapChannel, value: number) => void;
}

const SNAP_CHANNEL_ROWS: Array<{
  channel: SceneSnapChannel;
  labelKey: string;
  format: (value: number) => string;
}> = [
  {
    channel: 'translation',
    labelKey: 'monitoring:editor.snapTranslation',
    format: formatSnapTranslation,
  },
  {
    channel: 'rotation',
    labelKey: 'monitoring:editor.snapRotation',
    format: formatSnapRotation,
  },
  {
    channel: 'scale',
    labelKey: 'monitoring:editor.snapScale',
    format: formatSnapScale,
  },
];

/**
 * 스냅 split button — 왼쪽은 on/off 토글(하단 점), 오른쪽 화살표는 단위
 * 선택 팝업. 팝업 안은 채널별 세그먼트라 "셋 중 하나" 가 형태로 드러난다.
 *
 * 두 반쪽은 라운드(rounded-md)를 가진 바깥 컨테이너 하나에 담는다 — 반쪽
 * 각각은 라운드·테두리가 없고 사이에 구분선도 두지 않아 한 덩어리로 읽힌다.
 * 셰브론은 자석 버튼의 우측 패딩 안으로 당겨(-ml-1.5) 아이콘끼리 붙인다.
 * 예전엔 셰브론에 `border-l border-border/60` 을 줬는데 Button 기본 클래스가
 * 4면 `border` 를 이미 갖고 있어 셰브론만 테두리 박스로 분리돼 보였다.
 */
function SnapSplitButton({
  enabled,
  step,
  disabled,
  onToggle,
  onStepChange,
}: SnapSplitButtonProps) {
  const { t } = useTranslation();
  const settingsLabel = t('monitoring:editor.snapSettings');

  return (
    <div
      role="group"
      aria-label={t('monitoring:editor.snap')}
      className="flex h-7 items-center overflow-hidden rounded-md"
    >
      <EditorToolbarButton
        label={`${t('monitoring:editor.snap')} (${formatSnapStep(step)})`}
        kind="toggle"
        pressed={enabled}
        side="bottom"
        disabled={disabled}
        className="rounded-none"
        onClick={onToggle}
      >
        <Magnet className="size-4" />
      </EditorToolbarButton>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={settingsLabel}
              disabled={disabled}
              className="text-muted-foreground hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground -ml-1.5 h-7 w-4 rounded-none px-0"
            />
          }
        >
          <ChevronDown className="size-3" />
        </PopoverTrigger>
        <PopoverPopup side="bottom" align="end" className="w-72 p-3">
          <p className="text-foreground mb-2 text-sm font-semibold">
            {settingsLabel}
          </p>
          <div className="flex flex-col gap-2">
            {/* 라벨은 고정 폭, 세그먼트는 남은 폭을 전부 차지하고 그 안에서
                버튼이 균등 분배된다 — 세 줄의 세그먼트 폭이 옵션 수(3·3·2)와
                무관하게 같아 세로로 정렬돼 보인다. */}
            {SNAP_CHANNEL_ROWS.map(({ channel, labelKey, format }) => (
              <div key={channel} className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground w-14 shrink-0">
                  {t(labelKey)}
                </span>
                <ToggleGroup
                  value={[String(step[channel])]}
                  onValueChange={(values) => {
                    const next = values[values.length - 1];
                    if (next === undefined) {
                      return;
                    }
                    onStepChange(channel, Number(next));
                  }}
                  spacing={0}
                  variant="outline"
                  size="sm"
                  aria-label={t(labelKey)}
                  className="h-7 w-auto flex-1"
                >
                  {SCENE_SNAP_STEP_OPTIONS[channel].map((option) => (
                    <ToggleGroupItem
                      key={option}
                      value={String(option)}
                      className="text-muted-foreground aria-pressed:bg-muted aria-pressed:text-foreground h-full min-w-0 flex-1 basis-0 px-2 text-[11px] font-medium tabular-nums"
                    >
                      {format(option)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            ))}
          </div>
        </PopoverPopup>
      </Popover>
    </div>
  );
}
