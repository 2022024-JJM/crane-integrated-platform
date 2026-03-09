import { Link } from 'react-router-dom';

import { Button } from '@/shared/ui/atoms/button';
import { OutdoorWork3dView } from './outdoor-work-3d-view';

const TEXT = {
  statsTitle: '알람 및 통계',
  back: '메인으로 돌아가기',
} as const;

export function OutdoorWorkPage() {
  const menuItems = [
    '사용자 대시보드',
    '실시간 기능',
    '이벤트 알람',
    '설정',
    '보고서',
    '환경 설정',
  ];
  const statItems = [
    '알람 : 12',
    '가동 크레인 : 4',
    '시스템 사용률 : 78%',
    '오류 로그: 2',
    '현재 접속: 14',
  ];

  return (
    <main
      className="min-h-screen bg-[#111214] px-4 py-6 text-zinc-100 md:px-6 before:content-['']
    before:absolute
    before:inset-0
    before:z-0
    before:pointer-events-none
    before:bg-[repeating-linear-gradient(-45deg,transparent_0,transparent_18px,rgba(255,255,255,0.012)_18px,rgba(255,255,255,0.012)_19px)]"
    >
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-svw gap-2 lg:grid-cols-[240px_1fr_300px] lg:grid-rows-[120px_minmax(0,1fr)_220px]">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 lg:col-start-1 lg:row-span-3">
          <Button asChild className="mb-4 w-full">
            <Link to="/">{TEXT.back}</Link>
          </Button>
          <ul className="space-y-2 text-sm text-zinc-300">
            {menuItems.map((item) => (
              <li key={item}>
                <button className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-left transition hover:bg-zinc-700">
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 lg:col-start-2 lg:row-start-1">
          <div className="grid h-full place-items-center rounded-lg border border-dashed border-zinc-700 bg-zinc-800/70 text-xs text-zinc-500">
            날씨/시간 영역 placeholder
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-black p-4 lg:col-start-2 lg:row-start-2">
          <OutdoorWork3dView />
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 lg:col-start-2 lg:row-start-3">
          <div className="grid h-full place-items-center rounded-lg border border-dashed border-zinc-700 bg-zinc-800/70 text-xs text-zinc-500">
            실시간 크레인 값 카드 placeholder
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 lg:row-span-3 lg:col-start-3">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-200">
            {TEXT.statsTitle}
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            {statItems.map((item) => (
              <li
                key={item}
                className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
