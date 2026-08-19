import type { KeyinData, KeyinItem, KeyinKind, KeyinProc } from './types';

/** 시드 기반 유사난수 — 동일 호선이면 항상 같은 목데이터 */
function rnd(s: number, i: number): number {
  const x = Math.sin(s * 97.13 + i * 31.7) * 43758.5453;
  return x - Math.floor(x);
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export const KEYIN_SHIPS = ['7004', '7005', '6064'];

export const KEYIN_REASONS = [
  '현장 실측 결과',
  '작업 진척 반영',
  '자동값 오류로 판단',
  '작업 중단',
  '기타',
];

export const KEYIN_DATES: [string, string][] = [
  ['오늘', '08-11'],
  ['어제', '08-10'],
  ['그제', '08-09'],
];

interface ProcDef {
  proc: KeyinProc;
  kind: KeyinKind;
  /** [이벤트명, 실패 유형 후보] */
  evs: [string, string[]][];
  src?: string;
}

// 이벤트별 정합 실패 유형: 절단→장비 미인식, 사상→태그, 도장→BTS 누락
// (i-QMS 검사는 Key-In 보완 대상 아님)
const PROC_DEFS: ProcDef[] = [
  {
    proc: '가공',
    kind: 'event',
    evs: [
      ['불출(전처리) 실적', ['실적 I/F 수신 누락']],
      ['절단 완료일', ['절단장비 미인식', '실적 I/F 수신 누락']],
      ['사상 완료일', ['태그 인식 실패', '실적 I/F 수신 누락']],
      ['모듬 편성', ['모듬번호 미부여', '실적 I/F 수신 누락']],
    ],
  },
  {
    proc: '조립',
    kind: 'pct',
    evs: [
      ['도면 대비 완성도', ['스캔 음영구역', 'AI 신뢰도 미달', 'LiDAR 미스캔']],
    ],
    src: 'LiDAR·Vision',
  },
  {
    proc: '의장',
    kind: 'pct',
    evs: [['의장품 설치 완성도', ['형상 미확보 — 미인식', 'LiDAR 미스캔']]],
    src: 'LiDAR',
  },
  {
    proc: '도장',
    kind: 'event',
    evs: [
      ['S/P 스텝 완료', ['BTS 실적 미전송']],
      ['T/UP 스텝 완료', ['BTS 실적 미전송', '실적 I/F 수신 누락']],
      ['FINAL 스텝 완료', ['BTS 실적 미전송']],
    ],
  },
];

/** 호선 전체 블록의 Key-In 대상 카드 생성 */
export function seedAll(ship: string): KeyinData {
  const seed = parseInt(ship, 10);
  const out: KeyinData = {};
  for (let b = 0; b < 7; b++) {
    const no = String(101 + b * 13);
    out[no] = [];
    PROC_DEFS.forEach((d, pi) => {
      const u = rnd(seed, b * 17 + pi * 5);
      if (u < 0.3) return;
      const pick =
        d.evs[Math.floor(rnd(seed, b * 17 + pi * 5 + 8) * d.evs.length)];
      const ev = pick[0];
      const fail =
        pick[1][Math.floor(rnd(seed, b * 17 + pi * 5 + 1) * pick[1].length)];
      const neverScanned = /미인식|형상 미확보|미스캔|태그 인식/.test(fail);
      const hasPrev = rnd(seed, b * 17 + pi * 5 + 2) < (neverScanned ? 0.15 : 0.8);
      const total =
        d.kind === 'count'
          ? Math.round(8 + rnd(seed, b * 17 + pi * 5 + 9) * 30)
          : null;
      out[no].push({
        id: `${no}-${d.proc}`,
        proc: d.proc,
        kind: d.kind,
        ev,
        fail,
        src: d.src ?? '',
        auto:
          d.kind === 'pct' && hasPrev
            ? Math.round(20 + rnd(seed, b * 17 + pi * 5 + 3) * 70)
            : d.kind === 'count' && hasPrev && total != null
              ? Math.round(rnd(seed, b * 17 + pi * 5 + 3) * total)
              : null,
        autoAt: hasPrev
          ? `08-${pad2(4 + Math.floor(rnd(seed, b * 17 + pi * 5 + 7) * 6))}`
          : null,
        total,
        val: null,
        cnt: null,
        done: null,
        doneAt: null,
        memo: '',
        status: 'none',
      });
    });
  }
  return out;
}

/** 입력이 완료된 카드인지 */
export function entered(it: KeyinItem): boolean {
  if (it.kind === 'pct') return it.val != null;
  if (it.kind === 'count') return it.cnt != null;
  return it.done === true && !!it.doneAt;
}

/** 자동값 대비 15%p 이상 차이인데 사유가 없어 제출이 막힌 카드인지 */
export function blocked(it: KeyinItem): boolean {
  if (it.kind !== 'pct' || !entered(it) || it.auto == null) return false;
  return Math.abs((it.val as number) - it.auto) >= 15 && !it.memo;
}
