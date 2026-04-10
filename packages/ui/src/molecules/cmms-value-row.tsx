interface CmmsValueRowProps {
  label: string;
  value: string | number;
  highlight?: boolean;
}

export function CmmsValueRow({ label, value, highlight = false }: CmmsValueRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b border-border last:border-0">
      <span className="text-xs text-foreground shrink-0">{label}</span>
      <span
        className={`text-xs font-mono px-2 py-0.5 rounded min-w-15 text-center ${
          highlight
            ? 'bg-muted text-yellow-500 dark:text-yellow-300 font-semibold'
            : 'bg-muted text-foreground'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
