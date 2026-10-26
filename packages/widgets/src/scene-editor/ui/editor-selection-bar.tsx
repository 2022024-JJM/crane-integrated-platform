import { Copy, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { TooltipProvider } from '@crane/ui/molecules/tooltip';
import {
  EDITOR_OVERLAY_SURFACE_CLASS,
  EDITOR_TOOLBAR_DIVIDER_CLASS,
} from '../lib/editor-toolbar-classes';
import { SHORTCUT_MOD } from '../lib/shortcut-modifier';
import { EditorToolbarButton } from './editor-toolbar-button';

interface EditorSelectionBarProps {
  /** 선택 객체 수(`selectedIds.size`). 0 이면 바를 그리지 않는다. */
  selectedCount: number;
  /** 선택에 복제 가능한 대상(모델·텍스트)이 있는지 — `hasDuplicableSelection`. */
  canDuplicate: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
}

/**
 * 하단 플로팅 선택 컨텍스트 바(D 구역). 선택 객체가 없으면 비활성 버튼으로
 * 남기지 않고 아예 그리지 않는다 — 등장 자체가 "선택됨" 의 신호다. 왼쪽
 * 개수 글자는 마퀴·Ctrl+A 로 몇 개가 잡혔는지, 곧 삭제가 몇 개를 지우는지
 * 보여 준다. 글자는 버튼 높이 안에 한 줄로 두어 바 높이를 바꾸지 않는다 —
 * 조명 조준 안내가 이 높이에 맞춰 바로 위에 뜬다.
 *
 * 삭제는 잠금 해제된 지도까지 다루지만 복제는 모델·텍스트만이라, 지도만
 * 선택된 경우 복제 버튼을 비활성화한다(누르면 무음 no-op 이라 고장처럼 보인다).
 */
export function EditorSelectionBar({
  selectedCount,
  canDuplicate,
  onDuplicate,
  onDelete,
}: EditorSelectionBarProps) {
  const { t } = useTranslation();

  if (selectedCount === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div
        role="toolbar"
        aria-label={t('monitoring:editor.selectionActions')}
        className={cn(
          EDITOR_OVERLAY_SURFACE_CLASS,
          'absolute bottom-1.5 left-1/2 z-10 -translate-x-1/2',
        )}
      >
        <span className="text-box-cap text-foreground px-2 text-xs font-medium whitespace-nowrap">
          {t('monitoring:editor.selectionCount', { count: selectedCount })}
        </span>
        <span aria-hidden className={EDITOR_TOOLBAR_DIVIDER_CLASS} />
        <EditorToolbarButton
          label={t('monitoring:editor.duplicateSelected')}
          shortcut={[SHORTCUT_MOD, 'D']}
          onClick={onDuplicate}
          disabled={!canDuplicate}
        >
          <Copy className="size-4" />
        </EditorToolbarButton>
        <EditorToolbarButton
          label={t('monitoring:editor.deleteSelected')}
          shortcut={['Delete']}
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </EditorToolbarButton>
      </div>
    </TooltipProvider>
  );
}
