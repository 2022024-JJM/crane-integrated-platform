import { PanelRightClose } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { CardHeader } from '@crane/ui/molecules/card';
import { SearchField } from '@crane/ui/molecules/search-field';

interface PaletteHeaderProps {
  objectSearch: string;
  onObjectSearchChange: (value: string) => void;
  /** 우측 컬럼(Hierarchy+Inspector) 전체를 접는다. */
  onCollapse?: () => void;
}

/**
 * Hierarchy 패널 헤더 — 접기 버튼 + 배치 객체 검색.
 * 저장/내보내기는 씬 전역 동작이라 중앙 상단 툴바가 담당한다.
 * 높이 h-9 는 그 툴바(EditorHeaderBar)·좌측 팔레트 탭 헤더와 같은 값이다.
 */
export const PaletteHeader = memo(function PaletteHeader({
  objectSearch = '',
  onObjectSearchChange,
  onCollapse,
}: PaletteHeaderProps) {
  const { t } = useTranslation();

  return (
    <CardHeader className="border-border flex h-9 items-center border-b border-b-0 px-2.5 py-0">
      <div className="flex w-full items-center gap-2">
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            aria-label={t('monitoring:editor.collapsePanel')}
            title={t('monitoring:editor.collapsePanel')}
            className="text-muted-foreground hover:text-foreground inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors"
          >
            <PanelRightClose className="size-4" />
          </button>
        ) : null}
        <SearchField
          value={objectSearch}
          onChange={(event) => {
            onObjectSearchChange(event.target.value);
          }}
          placeholder={t('monitoring:editor.searchObjects')}
        />
      </div>
    </CardHeader>
  );
});
