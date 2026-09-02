import type { ActDef, Activity, BlockData, KeyinUser } from '../model/types';

/** 시드 기반 유사난수 — 동일 (호선, 담당자)이면 항상 같은 목데이터 */
export function rnd(s: number, i: number): number {
  const x = Math.sin(s * 97.13 + i * 31.7) * 43758.5453;
  return x - Math.floor(x);
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * 담당 블록 전체의 액티비티 생성.
 * 전체 액티비티를 모두 표시 — 자동수집 값 포함, 모든 항목 수정 가능.
 */
export function seedBlocks(
  user: KeyinUser,
  ship: string,
  defs: ActDef[],
): BlockData {
  const seed = parseInt(ship, 10) + user.blkOff * 7;
  const out: BlockData = {};
  for (let b = 0; b < 340; b++) {
    const no = String(101 + (b + user.blkOff) * 3);
    const acts: Activity[] = [];
    defs.forEach((d, di) => {
      const hasAuto = d.auto && rnd(seed, b * 19 + di * 5 + 1) < 0.75;
      const autoV = hasAuto
        ? Math.round(20 + rnd(seed, b * 19 + di * 5 + 2) * 75)
        : null;
      // 자동수집이 있으면 하위 WO 일부가 이미 완료 상태로 수신됨
      const autoDoneP = hasAuto
        ? (autoV as number) / 130
        : rnd(seed, b * 19 + di * 5 + 6) < 0.4
          ? 0.3
          : 0;
      const n = d.many
        ? Math.round(d.many * (0.4 + rnd(seed, b * 19 + di * 5 + 4) * 0.9))
        : d.wos.length;
      const wos = [];
      for (let wi = 0; wi < n; wi++) {
        const base = d.wos[wi % d.wos.length];
        const done = rnd(seed, b * 19 + di * 5 + 10 + wi) < autoDoneP;
        wos.push({
          name: d.many
            ? `${base} — 부재 ${ship.slice(-2)}${no}P${pad2(wi + 1)}`
            : base,
          wo: `WO-${String(di * 1000 + wi + 1).padStart(4, '0')}`,
          done,
          autoDone: done,
        });
      }
      acts.push({
        id: `${no}-${di}`,
        proc: user.proc,
        name: d.name,
        actNo: `ACT-${ship}-${no}-${pad2(di + 1)}`,
        auto: autoV,
        autoAt: `08-${pad2(22 + Math.floor(rnd(seed, b * 19 + di * 5 + 3) * 6))}`,
        fail: d.fail ?? '스캔 음영 — 인식값 없음',
        confirmed: false,
        edited: null,
        wos,
        sub: null,
      });
    });
    out[no] = acts;
  }
  return out;
}
