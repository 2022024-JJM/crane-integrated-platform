import { Link, useLocation } from 'react-router-dom';

import { Button } from '@/shared/ui/atoms/button';

const TEXT = {
  title: '\uc2e4\ub0b4 \uc791\uc5c5',
  fallbackDescription:
    '\uc2e4\ub0b4 \uc124\ube44 \ubaa8\ub2c8\ud130\ub9c1 \ud654\uba74\uc744 \uc5f0\uacb0\ud560 \uc218 \uc788\ub3c4\ub85d \ud604\uc7ac \uc9c4\uc785\uc810\ub9cc \uc900\ube44\ud574 \ub450\uc5c8\uc2b5\ub2c8\ub2e4.',
  regionSuffixDescription:
    '\ud604\uc7a5\uacfc \uc5f0\ub3d9\ud560 \uc2e4\ub0b4 \uc791\uc5c5 \ud654\uba74\uc740 \ub2e4\uc74c \ub2e8\uacc4\uc5d0\uc11c \uad6c\uc131\ud558\uba74 \ub429\ub2c8\ub2e4.',
  back: '\uba54\uc778\uc73c\ub85c \ub3cc\uc544\uac00\uae30',
} as const;

export function IndoorWorkPage() {
  const location = useLocation();
  const regionName = (location.state as { regionName?: string } | null)?.regionName;

  return (
    <main className="bg-zinc-950 text-zinc-50 flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/80 px-8 py-10 text-center shadow-2xl">
        <p className="text-xs font-medium tracking-[0.24em] text-zinc-500 uppercase">
          Indoor Workspace
        </p>
        <h1 className="text-3xl font-semibold">{TEXT.title}</h1>
        <p className="text-sm leading-6 text-zinc-400">
          {regionName
            ? `${regionName} ${TEXT.regionSuffixDescription}`
            : TEXT.fallbackDescription}
        </p>
        <Button asChild>
          <Link to="/">{TEXT.back}</Link>
        </Button>
      </div>
    </main>
  );
}
