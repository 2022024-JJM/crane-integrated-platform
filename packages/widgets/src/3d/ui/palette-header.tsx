import { Search } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@crane/ui/atoms/badge';
import { Input } from '@crane/ui/atoms/input';
import { CardHeader } from '@crane/ui/molecules/card';

interface PaletteHeaderProps {
  objectSearch: string;
  onObjectSearchChange: (value: string) => void;
  placedObjectCount: number;
}

/**
 * Hierarchy 패널 헤더 — 배치 객체 검색 + 개수 배지.
 * 저장/내보내기는 씬 전역 동작이라 중앙 상단 툴바가 담당한다.
 */
export const PaletteHeader = memo(function PaletteHeader({
  objectSearch = '',
  onObjectSearchChange,
  placedObjectCount,
}: PaletteHeaderProps) {
  const { t } = useTranslation();
  const controlClassName = 'h-6 rounded-sm';

  return (
    <CardHeader className="border-border border-b border-b-0 px-2.5 py-2">
      <div className="flex items-center gap-2">
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
        <div className="flex h-6 shrink-0 items-center">
          <Badge
            render={<div />}
            variant="outline"
            className={`border-border bg-muted text-muted-foreground ${controlClassName} flex min-w-6 items-center justify-center px-1.5 py-0 text-[9px] leading-none`}
          >
            {placedObjectCount}
          </Badge>
        </div>
      </div>
    </CardHeader>
  );
});
