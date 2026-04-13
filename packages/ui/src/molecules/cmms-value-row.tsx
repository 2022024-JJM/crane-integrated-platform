interface CmmsValueRowProps {
  label: string;
  value: string | number;
  highlight?: boolean;
  /** value span에 border border-border 추가. default: false */
  bordered?: boolean;
  /** value span 텍스트 정렬. default: 'center' */
  align?: 'center' | 'right';
}

export function CmmsValueRow({ label, value, highlight = false, bordered = false, align = 'center' }: CmmsValueRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b border-border last:border-0">
      <span className="text-xs text-foreground shrink-0">{label}</span>
      <span
        className={[
          'text-xs font-mono px-2 py-0.5 rounded min-w-14',
          align === 'right' ? 'text-right' : 'text-center',
          bordered ? 'border border-border' : '',
          highlight
            ? 'bg-muted text-yellow-500 dark:text-yellow-300 font-semibold'
            : 'bg-muted text-foreground',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}
