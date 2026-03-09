interface MainFooterProps {
  dateTime: string;
  footerLabel: string;
}

export function MainFooter({ dateTime, footerLabel }: MainFooterProps) {
  return (
    <footer className="mt-auto px-[clamp(20px,4vw,40px)] pt-4 pb-[18px] border-t border-[var(--main-page-border)] flex items-center justify-between gap-4 text-[11px] font-mono text-[var(--main-page-text-dim)] max-[960px]:flex-col max-[960px]:items-start max-[640px]:gap-[10px]">
      <span>
        Copyrightⓒ Hanwha Energy Corporation All Rights Reserved | CraneOps
        v1.0.0
      </span>
      <time dateTime={dateTime}>{footerLabel}</time>
    </footer>
  );
}
