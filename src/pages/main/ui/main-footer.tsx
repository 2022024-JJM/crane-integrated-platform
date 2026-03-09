import './main-footer.css';

interface MainFooterProps {
  dateTime: string;
  footerLabel: string;
}

export function MainFooter({ dateTime, footerLabel }: MainFooterProps) {
  return (
    <footer className="main-page__footer">
      <span>CraneOps v2.1.0 | 3D Monitoring System</span>
      <time dateTime={dateTime}>{footerLabel}</time>
    </footer>
  );
}
