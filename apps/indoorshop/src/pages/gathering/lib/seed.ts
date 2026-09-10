/**
 * V7 프로토타입(docs/내업공정실적 통합 v7)의 결정론적 목데이터 생성기.
 * 시드 기반 의사난수라 같은 호선·블록이면 항상 같은 값이 나온다.
 * 권역(가공·조립·의장·도장)별로 블록 실적·WO·수집 이벤트를 만든다.
 */
import type {
  BlockInfo,
  EvItem,
  FabResult,
  GatherProc,
  PntResult,
  WoItem,
} from '../model/types';

export function rnd(s: number, i: number): number {
  const x = Math.sin(s * 97.13 + i * 31.7) * 43758.5453;
  return x - Math.floor(x);
}

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function blocks(ship: string): BlockInfo[] {
  const seed = parseInt(ship, 10);
  const out: BlockInfo[] = [];
  for (let i = 0; i < 412; i++) {
    const no = String(101 + i);
    const prog = Math.max(0.03, Math.min(0.99, 0.15 + rnd(seed, i * 3) * 0.85));
    out.push({
      no,
      prog,
      seed: seed * 31 + parseInt(no, 10) * 11,
      woN: Math.round(40 + rnd(seed, i * 3 + 2) * 380),
      asmN: Math.round(4 + rnd(seed, i * 3 + 4) * 28),
      // 계획-실적 차 (%p). 권역 실적에 적용
      planGap: Math.round(-6 + rnd(seed, i * 3 + 5) * 22),
    });
  }
  return out;
}

/** 가공 5단계(강재반입→불출→절단→사상→팔레트편성) 중량률 */
export function fab(b: BlockInfo): FabResult {
  const rates: number[] = [];
  let base = Math.min(1, b.prog * 1.7);
  for (let k = 0; k < 5; k++) {
    const j = rnd(b.seed, 50 + k) * 0.15;
    const v = Math.max(0, Math.min(1, base - k * 0.13 - j + 0.1));
    rates.push(Math.round(v * 100));
    base = Math.min(base, v + 0.13);
  }
  return { rates, total: +(rates.reduce((a, v) => a + v, 0) / 5).toFixed(1) };
}

export function asm(b: BlockInfo): number | null {
  return b.prog < 0.25 ? null : Math.min(100, Math.round((b.prog - 0.25) * 160));
}

export function otf(b: BlockInfo): number | null {
  return b.prog < 0.4 ? null : Math.min(100, Math.round((b.prog - 0.4) * 175));
}

export function pnt(b: BlockInfo): PntResult {
  if (b.prog < 0.62) return { done: 0 };
  if (b.prog < 0.78) return { done: 1 };
  if (b.prog < 0.92) return { done: 2 };
  return { done: 3 };
}

/** 최근 LiDAR 스캔 경과 (시간). k: 조립=0 / 의장=1 */
export function scanAge(b: BlockInfo, k: number): number {
  return Math.floor(rnd(b.seed, 120 + k) * 70);
}

/** 최근 수신 경과 (분) */
export function recvMin(b: BlockInfo): number {
  return Math.floor(rnd(b.seed, 99) * 360);
}

/** 권역 실적값 (0~100 | null=미착수) */
export function procAct(proc: GatherProc, b: BlockInfo): number | null {
  if (proc === '가공') {
    const f = fab(b);
    return f.total <= 0 ? null : Math.round(f.total);
  }
  if (proc === '조립') return asm(b);
  if (proc === '의장') return otf(b);
  const p = pnt(b);
  return p.done === 0 ? null : Math.round((p.done / 3) * 100);
}

/** 권역 스코프 블록: 해당 공정이 착수된 블록만 */
export function scopeBlocks(proc: GatherProc, ship: string): BlockInfo[] {
  return blocks(ship).filter((b) => procAct(proc, b) != null);
}

export function wos(proc: GatherProc, b: BlockInfo): WoItem[] {
  const list: WoItem[] = [];
  const f = fab(b);
  const a = asm(b);
  const o = otf(b);
  const p = pnt(b);
  const defs: Record<GatherProc, [number | null, string[], number]> = {
    가공: [f.total, ['절단', '사상', '팔레트 편성'], 0.32],
    조립: [a, ['취부', '용접', '사상'], 0.4],
    의장: [o, ['파이프 설치', '서포트 설치', '전장 설치'], 0.18],
    도장: [p.done > 0 ? Math.round((p.done / 3) * 100) : null, ['S/P', 'T/UP', 'FINAL'], 0.1],
  };
  const def = defs[proc];
  const cnt = Math.max(2, Math.round(b.woN * def[2]));
  const di = (['가공', '조립', '의장', '도장'] as GatherProc[]).indexOf(proc);
  for (let i = 0; i < cnt; i++) {
    const u = rnd(b.seed, 500 + di * 997 + i);
    const base = def[0];
    let pct =
      base == null
        ? 0
        : Math.max(0, Math.min(100, Math.round(base + (u - 0.5) * 44)));
    if (pct >= 86) pct = 100;
    else if (pct <= 10) pct = 0;
    const warn =
      base != null &&
      pct > 0 &&
      pct < 100 &&
      rnd(b.seed, 700 + di * 997 + i) < 0.06;
    list.push({
      wo: `WO-${String(i + 1).padStart(4, '0')}`,
      name: `${def[1][i % 3]} — ${b.no}P${String(i + 1).padStart(3, '0')}`,
      asm: `ASM-${String(1 + Math.floor(u * b.asmN)).padStart(2, '0')}`,
      kind: def[1][i % 3],
      pct,
      warn,
    });
  }
  return list;
}

/** 가공 5단계 [이벤트명, 설명, 수집 원천, 관리번호 유형] */
const FAB_STAGES: [string, string, string, 'MAT' | 'DWG' | 'PC' | 'PLT'][] = [
  ['강재반입', '자재 입고·적치 확정', '부재종합 (강재반입일)', 'MAT'],
  ['강재불출', '전처리장 불출', '강재불출 실적 (ProSSYS)', 'MAT'],
  ['절단완료', '절단 도면 단위 완료', '절단 MES · 진행플래그', 'DWG'],
  ['사상완료', '사상 일자 · 모듬상태', '부재종합 (사상일)', 'PC'],
  ['팔레트편성', '모듬번호 부여 · 선별 라인', '부재선별 (송선)', 'PLT'],
];

export function events(proc: GatherProc, ship: string): EvItem[] {
  const rows: EvItem[] = [];
  const dts = (dd: number, hh: number, mm: number) =>
    `07-${pad(dd)} ${pad(hh)}:${pad(mm)}`;
  blocks(ship).forEach((b) => {
    const s = b.seed;
    const u = (k: number) => rnd(s, 200 + k);
    if (proc === '가공') {
      const f = fab(b);
      FAB_STAGES.forEach((sg, k) => {
        if (f.rates[k] <= 0) return;
        const done = f.rates[k] >= 100;
        const key =
          sg[3] === 'DWG'
            ? `${ship}DS${b.no}CNE${pad(1 + Math.floor(u(k * 7) * 19))}`
            : sg[3] === 'MAT'
              ? `${ship}ALP${b.no}NB${String(80 + Math.floor(u(k * 7) * 99)).padStart(3, '0')}`
              : sg[3] === 'PLT'
                ? `202607${pad(11 + Math.floor(u(k * 7) * 3))}${String(6100 + Math.floor(u(k * 7 + 1) * 6))}`
                : `${ship}-${b.no}-BK33${['A', 'B', 'P'][Math.floor(u(k * 7) * 3)]}-S${1 + Math.floor(u(k * 7 + 1) * 3)}`;
        const mism = done && u(k * 7 + 8) < 0.22;
        const legacy = mism
          ? Math.max(0, f.rates[k] - (5 + Math.floor(u(k * 7 + 9) * 30)))
          : f.rates[k];
        const ifMiss = !done && u(k * 7 + 10) < 0.12;
        rows.push({
          blk: b.no,
          ev: sg[0],
          key,
          stage: k,
          autoPct: f.rates[k],
          legacy: ifMiss ? null : legacy,
          mism,
          ifMiss,
          start: dts(
            8 + k * 2 + Math.floor(u(k * 7 + 2) * 3),
            8 + Math.floor(u(k * 7 + 3) * 3),
            Math.floor(u(k * 7 + 4) * 60),
          ),
          end: done
            ? dts(
                10 + k * 2 + Math.floor(u(k * 7 + 2) * 3),
                13 + Math.floor(u(k * 7 + 5) * 4),
                Math.floor(u(k * 7 + 6) * 60),
              )
            : '',
          note: mism
            ? `정합성 불일치 (${f.rates[k] - legacy}%p)`
            : ifMiss
              ? 'I/F 미수신 — 레거시 실적 없음'
              : done
                ? '단계 완료'
                : '진행중',
          warn: mism || ifMiss,
          issue: mism ? '정합성' : ifMiss ? '수집실패' : '',
          src: sg[2],
        });
      });
    } else if (proc === '조립') {
      const av = asm(b);
      if (av == null) return;
      const n = 2 + Math.floor(u(59) * 3);
      for (let i = 0; i < n; i++) {
        const shade = u(60 + i * 5) < 0.15;
        const key = `${ship}-${b.no}-SA${pad(1 + Math.floor(u(61 + i * 5) * 9))}`;
        const cp = Math.max(
          0,
          Math.min(100, av + Math.round((u(66 + i) - 0.5) * 30)),
        );
        rows.push({
          blk: b.no,
          ev: '조립 스캔 인식',
          key,
          start: dts(12 + Math.floor(u(62 + i) * 6), 8, Math.floor(u(63 + i) * 60)),
          end: shade
            ? ''
            : dts(
                13 + Math.floor(u(62 + i) * 6),
                9 + Math.floor(u(64 + i) * 7),
                Math.floor(u(65 + i) * 60),
              ),
          note: shade ? '스캔 음영 — 완성도 미산출' : `도면 대비 완성도 ${cp}%`,
          warn: shade,
          issue: shade ? 'Key-In' : '',
          src: 'LiDAR · Vision AI',
        });
      }
    } else if (proc === '의장') {
      const ov = otf(b);
      if (ov == null) return;
      const n = 2 + Math.floor(u(69) * 3);
      for (let i = 0; i < n; i++) {
        const miss = u(70 + i * 5) < 0.14;
        const t = (
          [
            ['SP', '파이프'],
            ['EC', '전장케이블'],
            ['SPT', '서포트'],
          ] as const
        )[Math.floor(u(71 + i * 5) * 3)];
        const key = `${ship}-${b.no}-${t[0]}${pad(101 + Math.floor(u(72 + i) * 8))}`;
        const cp = Math.max(
          0,
          Math.min(100, ov + Math.round((u(77 + i) - 0.5) * 30)),
        );
        rows.push({
          blk: b.no,
          ev: `${t[1]} 설치 인식`,
          key,
          kind: t[1],
          start: dts(14 + Math.floor(u(73 + i) * 5), 9, Math.floor(u(74 + i) * 60)),
          end: miss
            ? ''
            : dts(
                15 + Math.floor(u(73 + i) * 5),
                10 + Math.floor(u(75 + i) * 6),
                Math.floor(u(76 + i) * 60),
              ),
          note: miss ? '미인식 — Key-In 대기' : `완성도 ${cp}%`,
          warn: miss,
          issue: miss ? 'Key-In' : '',
          src: 'LiDAR',
        });
      }
    } else {
      const pv = pnt(b);
      if (pv.done === 0) return;
      (['S/P', 'T/UP', 'FINAL'] as const).slice(0, pv.done).forEach((sp, i) => {
        const insp = u(80 + i) < 0.75;
        rows.push({
          blk: b.no,
          ev: `도장 스텝 완료 · ${sp}`,
          key: `${ship}-${b.no}`,
          step: sp,
          start: dts(18 + i * 3, 8, Math.floor(u(82 + i) * 60)),
          end: dts(20 + i * 3, 16, Math.floor(u(83 + i) * 60)),
          note: insp ? 'i-QMS 검사 합격' : 'i-QMS 검사중',
          warn: !insp,
          issue: insp ? '' : '검사중',
          src: 'BTS · i-QMS',
        });
      });
    }
  });
  return rows;
}
