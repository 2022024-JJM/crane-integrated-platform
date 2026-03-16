interface PanelNoteListProps {
  items: readonly string[];
}

export function PanelNoteList({ items }: PanelNoteListProps) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div
          key={item}
          className="border border-l-[2px] border-[var(--outdoor-page-card-border)] border-l-[var(--outdoor-page-accent-soft-border)] bg-[var(--outdoor-page-card-bg)] px-3 py-2.5 text-[12px] leading-[1.5] text-[var(--outdoor-page-note-text)]"
        >
          {item}
        </div>
      ))}
    </div>
  );
}
