import { Link, useLocation } from 'react-router-dom';

import { Button } from '@/shared/ui/button';

const TEXT = {
  title: '\uc2e4\uc678 \uc791\uc5c5',
  fallbackDescription:
    '\uc57c\ub4dc\uc640 \ud56d\ub9cc \uc124\ube44\uc6a9 3D \ubaa8\ub2c8\ud130\ub9c1 \ud654\uba74\uc744 \uc5f0\uacb0\ud560 \uc218 \uc788\ub3c4\ub85d \ud604\uc7ac \uc9c4\uc785\uc810\ub9cc \uc900\ube44\ud574 \ub450\uc5c8\uc2b5\ub2c8\ub2e4.',
  regionSuffixDescription:
    '\uc9c0\uc5ed \uc120\ud0dd\uc774 \uc804\ub2ec\ub418\uc5c8\uc2b5\ub2c8\ub2e4. \uc774 \ub77c\uc6b0\ud2b8\uc5d0 3D \ubaa8\ub2c8\ud130\ub9c1 \ud654\uba74\uc744 \uc774\uc5b4 \ubd99\uc774\uba74 \ub429\ub2c8\ub2e4.',
  back: '\uba54\uc778\uc73c\ub85c \ub3cc\uc544\uac00\uae30',
} as const;

export function OutdoorWorkPage() {
  const location = useLocation();
  const regionName = (location.state as { regionName?: string } | null)?.regionName;

  return (
    <main className="bg-zinc-950 text-zinc-50 flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/80 px-8 py-10 text-center shadow-2xl">
        <p className="text-xs font-medium tracking-[0.24em] text-zinc-500 uppercase">
          Outdoor Workspace
        </p>
        <h1 className="text-3xl font-semibold">
          {regionName ? `${regionName} ${TEXT.title}` : TEXT.title}
        </h1>
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
