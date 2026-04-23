import { Link, useLocation } from 'react-router-dom';

export function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <div
      role="alert"
      className="flex h-full min-h-[320px] w-full flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <h2 className="text-lg font-semibold">페이지를 찾을 수 없습니다</h2>
      <p className="text-muted-foreground max-w-md text-sm break-all">
        요청하신 경로 <code className="font-mono">{pathname}</code>는 존재하지
        않거나 접근할 수 없습니다.
      </p>
      <Link
        to="/"
        className="border-border bg-background hover:bg-accent mt-2 rounded-md border px-4 py-2 text-sm font-medium"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
