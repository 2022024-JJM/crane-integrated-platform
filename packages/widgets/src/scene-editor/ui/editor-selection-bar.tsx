import { Copy, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { TooltipProvider } from '@crane/ui/molecules/tooltip';
import { EDITOR_OVERLAY_SURFACE_CLASS } from '../lib/editor-toolbar-classes';
import { SHORTCUT_MOD } from '../lib/shortcut-modifier';
import { EditorToolbarButton } from './editor-toolbar-button';

interface EditorSelectionBarProps {
  hasSelection: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
}

/**
 * 하단 플로팅 선택 컨텍스트 바(D 구역). 선택 객체가 없으면 비활성 버튼으로
 * 남기지 않고 아예 그리지 않는다 — 등장 자체가 "선택됨" 의 신호다.
 */
export function EditorSelectionBar({
  hasSelection,
  onDuplicate,
  onDelete,
}: EditorSelectionBarProps) {
  const { t } = useTranslation();

  if (!hasSelection) {
    return null;
  }

  return (
    <TooltipProvider>
      <div
        role="toolbar"
        aria-label={t('monitoring:editor.selectionActions')}
        className={cn(
          EDITOR_OVERLAY_SURFACE_CLASS,
          'absolute bottom-3 left-1/2 z-10 -translate-x-1/2',
        )}
      >
        <EditorToolbarButton
          label={t('monitoring:editor.duplicateSelected')}
          shortcut={[SHORTCUT_MOD, 'D']}
          onClick={onDuplicate}
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
