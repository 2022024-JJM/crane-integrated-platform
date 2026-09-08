import type {
  BlockInfo,
  BlockWo,
  FabResult,
  GatherEvent,
  GatherProc,
  PntResult,
} from '../model/types';

/** 시드 기반 유사난수 — 동일 호선이면 항상 같은 목데이터 */
export function rnd(s: number, i: number): number {
  const x = Math.sin(s * 97.13 + i * 31.7) * 43758.5453;
  return x - Math.floor(x);
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 호선 전체 내업 재공 블록 생성 */
export function blocks(ship: string): BlockInfo[] {
  const seed = parseInt(ship, 10);
  const out: BlockInfo[] = [];
  for (let i = 0; i < 412; i++) {
    const no = String(101 + i);
    const prog = Math.max(0.03, Math.min(0.99, 0.15 + rnd(seed, i * 3) * 0.85));
    const act = Math.round(prog * 100);
    const plan = Math.max(
      0,
      Math.min(100, act + Math.round(-6 + rnd(seed, i * 3 + 5) * 22)),
    );
    out.push({
      no,
      prog,
      seed: seed * 31 + parseInt(no, 10) * 11,
      fac: 1 + Math.floor(rnd(seed, i * 3 + 1) * 4),
      woN: Math.round(40 + rnd(seed, i * 3 + 2) * 380),
      asmN: Math.round(4 + rnd(seed, i * 3 + 4) * 28),
      act,
      plan,
      delay: Math.max(0, plan - act),
    });
  }
  return out;
}

/** 가공 5단계 중량가중 진척 (강재반입→불출→절단→사상→팔레트편성) */
export function fab(b: BlockInfo): FabResult {
  const rates: number[] = [];
  let base = Math.min(1, b.prog * 1.7);
  for (let k = 0; k < 5; k++) {
    const jitter = rnd(b.seed, 50 + k) * 0.15;
    const v = Math.max(0, Math.min(1, base - k * 0.13 - jitter + 0.1));
    rates.push(Math.round(v * 100));
    base = Math.min(base, v + 0.13);
  }
  const total = +(rates.reduce((a, v) => a + v, 0) / 5).toFixed(1);
  return { rates, total };
}

/** 조립 완성도 % — 미착수면 null */
export function asm(b: BlockInfo): number | null {
  return b.prog < 0.25 ? null : Math.min(100, Math.round((b.prog - 0.25) * 160));
}

/** 의장 완성도 % — 미착수면 null */
export function otf(b: BlockInfo): number | null {
  return b.prog < 0.4 ? null : Math.min(100, Math.round((b.prog - 0.4) * 175));
}

/** 도장 스텝 진행 */
export function pnt(b: BlockInfo): PntResult {
  if (b.prog < 0.62) return { txt: '—', done: 0 };
  if (b.prog < 0.78) return { txt: 'S/P', done: 1 };
  if (b.prog < 0.92) return { txt: 'T/UP', done: 2 };
  return { txt: 'FINAL', done: 3 };
}

/** 정합성 이슈 건수 = 자동 ↔ 레거시 대조 — 가공권역(레거시 실적 존재)에서만 발생 */
export function issues(b: BlockInfo): number {
  if (fab(b).total <= 0) return 0;
  return rnd(b.seed, 90) < 0.3 ? 1 + Math.floor(rnd(b.seed, 91) * 4) : 0;
}

/** 최근 스캔 경과 (시간 단위) */
export function scanAge(b: BlockInfo, k: number): number {
  return Math.floor(rnd(b.seed, 120 + k) * 70);
}

/** 최근 수신 경과 (분) */
export function recvMin(b: BlockInfo): number {
  return Math.floor(rnd(b.seed, 99) * 360);
}

/** 블록 하위 WO 실적 생성 */
export function wos(b: BlockInfo): BlockWo[] {
  const list: BlockWo[] = [];
  const f = fab(b);
  const a = asm(b);
  const o = otf(b);
  const p = pnt(b);
  const defs: [GatherProc, number | null, string[], string, number][] = [
    ['가공', f.total, ['절단', '사상', '팔레트 편성'], '절단 MES · 부재종합', 0.32],
    ['조립', a, ['취부', '용접', '사상'], 'LiDAR · Vision AI', 0.4],
    ['의장', o, ['파이프 설치', '서포트 설치', '전장 설치'], 'LiDAR', 0.18],
    [
      '도장',
      p.done > 0 ? Math.round((p.done / 3) * 100) : null,
      ['S/P', 'T/UP', 'FINAL'],
      'BTS · i-QMS',
      0.1,
    ],
  ];
  let idx = 1;
  defs.forEach((d, di) => {
    const cnt = Math.max(2, Math.round(b.woN * d[4]));
    for (let i = 0; i < cnt; i++) {
      const u = rnd(b.seed, 500 + di * 997 + i);
      const base = d[1];
      let pct =
        base == null
          ? 0
          : Math.max(0, Math.min(100, Math.round(base + (u - 0.5) * 44)));
      if (pct >= 86) pct = 100;
      else if (pct <= 10) pct = 0;
      const warn =
        base != null && pct > 0 && pct < 100 && rnd(b.seed, 700 + di * 997 + i) < 0.06;
      const rm = Math.floor(rnd(b.seed, 900 + di * 997 + i) * 300);
      list.push({
        wo: `WO-${String(idx++).padStart(4, '0')}`,
        proc: d[0],
        name: `${d[2][i % 3]} — ${b.no}P${String(i + 1).padStart(3, '0')}`,
        asm: `ASM-${String(1 + Math.floor(u * b.asmN)).padStart(2, '0')}`,
        pct,
        warn,
        src: warn ? `${d[3]} (수집 실패)` : d[3],
        recv:
          base == null
            ? '—'
            : rm < 60
              ? `${rm}분 전`
              : `${Math.floor(rm / 60)}시간 전`,
      });
    }
  });
  return list;
}

/** 호선 전체 수집 이벤트 로우데이터 생성 */
export function events(ship: string): GatherEvent[] {
  const rows: GatherEvent[] = [];
  blocks(ship).forEach((b) => {
    const s = b.seed;
    const u = (k: number) => rnd(s, 200 + k);
    const f = fab(b);
    const dts = (dd: number, hh: number, mm: number) =>
      `07-${pad2(dd)} ${pad2(hh)}:${pad2(mm)}`;
    const stages: [string, string, string, string][] = [
      ['강재반입', '자재 입고·적치 확정', '① 부재종합 (강재반입일)', 'MAT'],
      ['강재불출', '전처리장 불출 (일자+시각)', '② 강재불출 실적', 'MAT'],
      ['절단완료', '절단 도면 단위 완료', '③ 절단 MES · 진행플래그', 'DWG'],
      ['사상완료', '사상 일자 · 모듬상태', '④ 부재종합 (사상일)', 'PC'],
      ['팔레트편성', '모듬번호 부여 · 선별 라인', '⑤ 부재선별 (송선)', 'PLT'],
    ];
    stages.forEach((sg, k) => {
      if (f.rates[k] <= 0) return;
      const done = f.rates[k] >= 100;
      const key =
        sg[3] === 'DWG'
          ? `${ship}DS${b.no}CNE${pad2(1 + Math.floor(u(k * 7) * 19))}`
          : sg[3] === 'MAT'
            ? `${ship}ALP${b.no}NB${String(80 + Math.floor(u(k * 7) * 99)).padStart(3, '0')}`
            : sg[3] === 'PLT'
              ? `202607${pad2(11 + Math.floor(u(k * 7) * 3))}${String(6100 + Math.floor(u(k * 7 + 1) * 6))}`
              : `${ship}-${b.no}-BK33${['A', 'B', 'P'][Math.floor(u(k * 7) * 3)]}-S${1 + Math.floor(u(k * 7 + 1) * 3)}`;
      // 정합성 불일치: 자동수집(현장 스캔) 중량률 ↔ 레거시 실적 중량률 대조 — 완료 건 일부에서 발생
      const mism = done && u(k * 7 + 8) < 0.22;
      const legacyPct = mism
        ? Math.max(0, f.rates[k] - (5 + Math.floor(u(k * 7 + 9) * 30)))
        : f.rates[k];
      // 수집 실패: 레거시 I/F 미수신 (진행중인데 실적 레코드 자체가 없음)
      const ifMiss = !done && u(k * 7 + 10) < 0.12;
      rows.push({
        blk: b.no,
        proc: '가공',
        ev: sg[0],
        key,
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
          ? `정합성 불일치 — 자동 ${f.rates[k]}% / 레거시 ${legacyPct}%`
          : ifMiss
            ? 'I/F 미수신 — 레거시 실적 없음'
            : done
              ? `완료 · 중량률 ${f.rates[k]}%`
              : `진행중 · 중량률 ${f.rates[k]}%`,
        warn: mism || ifMiss,
        issue: mism ? '정합성' : ifMiss ? '수집실패' : '',
        src: sg[2],
        kv: [
          ['관리번호', key, 'key'],
          ['수집 이벤트', `${sg[0]} — ${sg[1]}`],
          ['블록', b.no],
          ['단계 중량률 (자동)', `${f.rates[k]}%`],
          [
            '레거시 실적 중량률',
            ifMiss ? '미수신' : `${legacyPct}%`,
            mism || ifMiss ? 'r' : '',
          ],
          [
            '정합성',
            mism
              ? `불일치 (${f.rates[k] - legacyPct}%p)`
              : ifMiss
                ? '대조 불가'
                : '일치',
            mism || ifMiss ? 'r' : 'g',
          ],
          ['상태', done ? '완료' : '진행중', done ? 'g' : 'o'],
          ['수집 원천', sg[2]],
          ['수집 방식', '레거시 I/F (일 배치+준실시간)'],
        ],
      });
    });
    const av = asm(b);
    if (av != null) {
      const shade = u(60) < 0.15;
      const key = `${ship}-${b.no}-SA${pad2(1 + Math.floor(u(61) * 9))}`;
      rows.push({
        blk: b.no,
        proc: '조립',
        ev: '조립 스캔 인식',
        key,
        start: dts(12 + Math.floor(u(62) * 6), 8, Math.floor(u(63) * 60)),
        end: shade
          ? ''
          : dts(
              13 + Math.floor(u(62) * 6),
              9 + Math.floor(u(64) * 7),
              Math.floor(u(65) * 60),
            ),
        note: shade ? '스캔 음영 — 완성도 미산출' : `도면 대비 완성도 ${av}%`,
        warn: shade,
        issue: shade ? 'Key-In' : '',
        src: 'LiDAR · Vision AI (필드)',
        kv: [
          ['조립품번호', key, 'key'],
          ['도면 대비 완성도', shade ? '— (음영)' : `${av}%`, shade ? 'r' : ''],
          ['인식 상태', shade ? '스캔 음영' : '인식', shade ? 'r' : 'g'],
          ['수집 원천', 'LiDAR · Vision AI'],
          ['보완 경로', shade ? 'Key-In 대상' : '—', shade ? 'r' : 'k'],
        ],
      });
    }
    const ov = otf(b);
    if (ov != null) {
      const miss = u(70) < 0.14;
      const t = (
        [
          ['SP', '파이프'],
          ['EC', '전장케이블'],
          ['SPT', '서포트'],
        ] as [string, string][]
      )[Math.floor(u(71) * 3)];
      const key = `${ship}-${b.no}-${t[0]}${pad2(101 + Math.floor(u(72) * 8))}`;
      rows.push({
        blk: b.no,
        proc: '의장',
        ev: '의장품 설치 인식',
        key,
        start: dts(14 + Math.floor(u(73) * 5), 9, Math.floor(u(74) * 60)),
        end: miss
          ? ''
          : dts(
              15 + Math.floor(u(73) * 5),
              10 + Math.floor(u(75) * 6),
              Math.floor(u(76) * 60),
            ),
        note: miss ? '미인식 — Key-In 대기' : `${t[1]} 설치 · 완성도 ${ov}%`,
        warn: miss,
        issue: miss ? 'Key-In' : '',
        src: 'LiDAR (필드)',
        kv: [
          ['의장품번호', key, 'key'],
          ['의장품 구분', t[1]],
          ['완성도', miss ? '—' : `${ov}%`, miss ? 'k' : ''],
          ['인식 상태', miss ? '미인식' : '인식', miss ? 'r' : 'g'],
          ['수집 원천', 'LiDAR — RFID 미적용'],
          ['보완 경로', miss ? 'Key-In 대상' : '—', miss ? 'r' : 'k'],
        ],
      });
    }
    const pv = pnt(b);
    if (pv.done > 0) {
      ['S/P', 'T/UP', 'FINAL'].slice(0, pv.done).forEach((sp, i) => {
        const insp = u(80 + i) < 0.75;
        rows.push({
          blk: b.no,
          proc: '도장',
          ev: `도장 스텝 완료 · ${sp}`,
          key: `${ship}-${b.no}`,
          start: dts(18 + i * 3, 8, Math.floor(u(82 + i) * 60)),
          end: dts(20 + i * 3, 16, Math.floor(u(83 + i) * 60)),
          note: insp ? 'i-QMS 검사 합격' : '검사중',
          warn: false,
          issue: '',
          src: 'BTS 스텝 실적 · i-QMS 검사',
          kv: [
            ['블록번호', `${ship}-${b.no}`, 'key'],
            ['도장 스텝', sp],
            ['스텝 상태', '완료', 'g'],
            ['완료일', `2026-07-${pad2(20 + i * 3)}`],
            ['i-QMS 검사', insp ? '합격' : '검사중', insp ? 'g' : 'r'],
            ['수집 원천', 'BTS · i-QMS'],
          ],
        });
      });
    }
  });
  return rows;
}
