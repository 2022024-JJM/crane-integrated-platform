import { PanelRightClose, Search } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@crane/ui/atoms/input';
import { CardHeader } from '@crane/ui/molecules/card';

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
  const controlClassName = 'h-6 rounded-sm';

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
        <div
          className={`border-border bg-muted text-foreground focus-within:border-ring focus-within:ring-ring/50 ${controlClassName} flex min-w-0 flex-1 items-center border px-2 transition-colors focus-within:ring-3`}
        >
          <Search className="text-muted-foreground/50 mr-2 size-3 shrink-0" />
          <Input
            value={objectSearch}
            onChange={(event) => {
              onObjectSearchChange(event.target.value);
            }}
            placeholder={t('monitoring:editor.searchObjects')}
            className="placeholder:text-muted-foreground h-full flex-1 border-0 bg-transparent px-0 text-[11px] leading-none shadow-none focus:border-0 focus:ring-0"
          />
        </div>
      </div>
    </CardHeader>
  );
});
