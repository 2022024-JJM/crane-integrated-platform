import type {
  CellAlign,
  CellTone,
  DetailCell,
  DetailCol,
  DrillDetail,
  GatherQuery,
  GatherRow,
} from './types';

/** 시드 기반 유사난수 — 조회할 때마다 동일한 목데이터가 나오도록 고정 */
function rnd(seed: number, n: number): number {
  const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dts(mo: number, dd: number, hh: number, mi: number): string {
  return `2026-${pad(mo)}-${pad(dd)} ${pad(hh)}:${pad(mi)}`;
}

export const SHIP_TYPES: Record<string, string> = {
  '7004': 'LNGC',
  '7005': 'LNGC',
  '7006': 'LNGC',
  '5019': 'VLCC',
  '8101': 'LPGC',
  '8102': 'LPGC',
  '2453': '컨테이너',
  '2454': '컨테이너',
};

export const SHIP_OPTIONS = Object.keys(SHIP_TYPES).map((no) => ({
  value: no,
  label: `${no}호 (${SHIP_TYPES[no]})`,
}));

export const STEP_OPTIONS = ['전체', '가공', '조립', '의장', '도장'];

interface BlockInfo {
  no: string;
  act: number;
}

const blockCache = new Map<string, BlockInfo[]>();

function blocks(shipNo: string): BlockInfo[] {
  const cached = blockCache.get(shipNo);
  if (cached) return cached;
  const seed = parseInt(shipNo, 10);
  const progMap: Record<string, number> = {
    '8101': 0.62,
    '5019': 0.54,
    '7004': 0.49,
    '8102': 0.48,
    '7005': 0.42,
    '2454': 0.39,
    '2453': 0.32,
    '7006': 0.29,
  };
  const prog = progMap[shipNo] ?? 0.45;
  const nb = 120 + Math.floor(rnd(seed, 1) * 80);
  const list: BlockInfo[] = [];
  for (let i = 0; i < nb; i++) {
    let p = prog + (rnd(seed, i * 3 + 1) - 0.5) * 0.9;
    p = Math.max(0, Math.min(1, p));
    const total = 30 + Math.floor(rnd(seed, i * 3 + 2) * 55);
    const done = Math.round(total * p);
    list.push({ no: String(101 + i), act: +((done / total) * 100).toFixed(1) });
  }
  blockCache.set(shipNo, list);
  return list;
}

function th(label: string, align: CellAlign = 'left'): DetailCol {
  return { label, align };
}

function cl(
  t: string | number | null | undefined,
  align: CellAlign = 'left',
  tone?: CellTone,
): DetailCell {
  return {
    text: t === '' || t == null ? '—' : String(t),
    align,
    tone,
  };
}

type KvPair = [string, string | number, CellTone?];

function kv(title: string, axis: string, pairs: KvPair[]): DrillDetail {
  return {
    title,
    axis,
    cols: [th('항목'), th('값')],
    rows: pairs.map((p) => [cl(p[0], 'left', 'b'), cl(p[1], 'left', p[2])]),
  };
}

const STAGE_ORDER: Record<string, number> = {
  SSY: 1,
  전처리: 2,
  절단: 3,
  사상: 4,
  선별: 5,
  조립: 6,
  의장: 7,
  도장: 8,
};
const SUB_ORDER: Record<string, number> = {
  입고: 1,
  적치: 2,
  선별: 3,
  불출: 4,
};

const gatherCache = new Map<string, GatherRow[]>();

/**
 * FACT_공정이벤트 목데이터 — 가공(SSY→전처리→절단→사상→선별) + 조립·의장·도장
 * 이벤트를 표준 롱포맷으로 생성한다. 각 행은 원천 화면 그대로의 드릴다운을 갖는다.
 */
export function gather(q: GatherQuery): GatherRow[] {
  const gk = `${q.ship}|${q.block}`;
  const cached = gatherCache.get(gk);
  if (cached) return cached;

  const targetBlocks = blocks(q.ship)
    .filter((b) => !q.block || b.no.includes(q.block))
    .slice(0, 3);
  const grades = ['ABS', 'BV', 'KR', 'LR'];
  const mats = ['AH32', 'B', 'DH36', 'A'];
  const eqs = ['PL51', 'PL31', 'NF61', '6-NF61'];
  const lines = ['A', 'B', 'C'];
  const yards = ['A-3 야드', 'B-1 야드', 'C-2 야드'];
  const rows: GatherRow[] = [];

  targetBlocks.forEach((b) => {
    const seed = parseInt(q.ship, 10) * 29 + parseInt(b.no, 10) * 7;
    const r = (k: number) => rnd(seed, k);

    // ---------- 블록의 도면 집합 (자재·절단이 공유) ----------
    const dwgs: {
      no: string;
      eq: string;
      cD: number;
      done: boolean;
      s: string;
      e: string;
    }[] = [];
    for (let i = 0; i < 3; i++) {
      const u = (k: number) => r(200 + i * 30 + k);
      const cD = 14 + Math.floor(u(4) * 6);
      dwgs.push({
        no:
          q.ship +
          'DS' +
          b.no +
          (u(1) < 0.5 ? 'CNE' : 'CSE') +
          pad(1 + Math.floor(u(2) * 19)),
        eq: eqs[Math.floor(u(3) * eqs.length)],
        cD,
        done: u(5) < 0.72,
        s: dts(6, cD - 1, 8, Math.floor(u(7) * 60)),
        e: dts(6, cD, 17, Math.floor(u(8) * 60)),
      });
    }

    // ---------- 자재(강판) 단위 : SSY(입고·적치·선별·불출) → 전처리 ----------
    for (let i = 0; i < 4; i++) {
      const u = (k: number) => r(i * 30 + k);
      const p3 = (n: number) => String(n).padStart(3, '0');
      const mat =
        q.ship +
        'ALP' +
        b.no +
        (u(1) < 0.5 ? 'NE' : 'SS') +
        p3(31 + i * 7 + Math.floor(u(30) * 40));
      const roll = String(20000000 + Math.floor(u(2) * 79999999));
      const eq = eqs[Math.floor(u(3) * eqs.length)];
      const gr = grades[Math.floor(u(4) * grades.length)];
      const mt = mats[Math.floor(u(5) * mats.length)];
      const thk = [12, 16, 20, 25][Math.floor(u(6) * 4)];
      const wid = [1000, 2400, 3200][Math.floor(u(7) * 3)];
      const len = 6000 + Math.floor(u(8) * 13000);
      const wt = Math.round((thk * wid * len * 7.85) / 1000000);
      const dwg = dwgs[i % 3].no;
      const inD = 8 + Math.floor(u(11) * 4);
      const stD = inD + 1;
      const selD = stD + 1;
      const reqD = selD + 1;
      const outD = reqD + Math.floor(u(12) * 5);
      const gap = outD - reqD;
      const preD = outD + 1;
      const key = `${mat} / ${roll}`;
      const base = { ship: q.ship, blk: b.no, proc: '가공' as const, key };
      const schedDetail = (
        kind: string,
        sTxt: string,
        eTxt: string,
        work: string,
        sch: string,
      ): DrillDetail => ({
        title: `ProSSYS 스케줄작업실적 — ${kind}`,
        axis: '자재(강판 1매) · 작업 이력',
        cols: [
          th('크레인', 'center'),
          th('작업종류'),
          th('스케줄 종류'),
          th('작업시작일시', 'center'),
          th('작업완료일시', 'center'),
          th('자재번호'),
          th('Roll No.'),
          th('절단장비', 'center'),
          th('불출예정일', 'center'),
        ],
        rows: [
          [
            cl('C' + (510 + Math.floor(u(14) * 9)), 'center'),
            cl(work),
            cl(sch),
            cl(sTxt, 'center'),
            cl(eTxt, 'center'),
            cl(mat, 'left', 'key'),
            cl(roll),
            cl(eq, 'center'),
            cl(`2026-06-${pad(reqD)}`, 'center'),
          ],
        ],
      });
      const inS = dts(6, inD, 7, 20 + Math.floor(u(19) * 30));
      const inE = dts(6, inD, 9, 10 + Math.floor(u(20) * 40));
      const stS = dts(6, stD, 8, Math.floor(u(21) * 60));
      const stE = dts(6, stD, 10, Math.floor(u(22) * 60));
      const seS = dts(6, selD, 9, Math.floor(u(23) * 60));
      const seE = dts(6, selD, 15, Math.floor(u(24) * 60));
      rows.push({
        ...base,
        stage: 'SSY',
        sub: '입고',
        start: inS,
        end: inE,
        note: '',
        warn: false,
        detail: schedDetail('입고', inS, inE, '강재 입고', '후판 입고 이적'),
      });
      rows.push({
        ...base,
        stage: 'SSY',
        sub: '적치',
        start: stS,
        end: stE,
        note: '',
        warn: false,
        detail: schedDetail(
          '적치',
          stS,
          stE,
          '적치',
          `적치장 ${yards[i % 3]} 이적`,
        ),
      });
      rows.push({
        ...base,
        stage: 'SSY',
        sub: '선별',
        start: seS,
        end: seE,
        note: '',
        warn: false,
        detail: schedDetail(
          '선별',
          seS,
          seE,
          '1차 선별',
          '2 Bay 1차 선별 이적(단척)',
        ),
      });
      rows.push({
        ...base,
        stage: 'SSY',
        sub: '불출',
        warn: gap >= 3,
        start: `2026-06-${pad(reqD)}`,
        end: dts(6, outD, 14 + Math.floor(u(25) * 4), Math.floor(u(26) * 60)),
        note: gap > 0 ? `요구일 대비 +${gap}일` : '',
        detail: {
          title: 'ProSSYS 불출작업실적 — 불출',
          axis: '자재(강판 1매)',
          cols: [
            th('LINE NO', 'center'),
            th('시각', 'center'),
            th('불출요구일', 'center'),
            th('불출일', 'center'),
            th('차이', 'right'),
            th('Bay', 'center'),
            th('도면-호선', 'center'),
            th('도면-블록', 'center'),
            th('도면계열', 'center'),
            th('자재번호'),
            th('Roll No.'),
            th('절단장비', 'center'),
            th('선급', 'center'),
            th('재질', 'center'),
            th('두께', 'right'),
            th('폭', 'right'),
            th('길이', 'right'),
            th('중량(kg)', 'right'),
          ],
          rows: [
            [
              cl(lines[i % 3], 'center', 'b'),
              cl(
                `${pad(14 + Math.floor(u(25) * 4))}:${pad(Math.floor(u(26) * 60))}`,
                'center',
              ),
              cl(`2026-06-${pad(reqD)}`, 'center'),
              cl(`2026-06-${pad(outD)}`, 'center'),
              cl(gap, 'right', gap >= 3 ? 'r' : 'o'),
              cl(1 + Math.floor(u(27) * 4), 'center'),
              cl(q.ship, 'center'),
              cl(b.no, 'center'),
              cl(Math.floor(u(28) * 3), 'center'),
              cl(mat, 'left', 'key'),
              cl(roll),
              cl(eq, 'center'),
              cl(gr, 'center'),
              cl(mt, 'center'),
              cl(thk, 'right'),
              cl(wid.toLocaleString(), 'right'),
              cl(len.toLocaleString(), 'right'),
              cl(wt.toLocaleString(), 'right'),
            ],
          ],
        },
      });
      const preH = 8 + Math.floor(u(29) * 6);
      const preM = Math.floor(u(11) * 60);
      rows.push({
        ...base,
        stage: '전처리',
        sub: '전처리',
        start: dts(6, outD, 15, Math.floor(u(26) * 60)),
        end: dts(6, preD, preH, preM),
        note: '',
        warn: false,
        detail: {
          title: 'ProMES 사내 전처리 강재 불출 실적(CCA) — 전처리',
          axis: '강판(PLATE)',
          cols: [
            th('LINE NO', 'center'),
            th('순번', 'right'),
            th('불출일자', 'center'),
            th('시각', 'center'),
            th('고유번호'),
            th('도면번호'),
            th('수량', 'right'),
            th('자재번호'),
            th('장비명', 'center'),
            th('선급', 'center'),
            th('재질', 'center'),
            th('두께', 'right'),
            th('폭', 'right'),
            th('길이', 'right'),
            th('중량(kg)', 'right'),
            th('면적(㎡)', 'right'),
            th('도장', 'center'),
            th('자재유형', 'center'),
          ],
          rows: [
            [
              cl(lines[i % 3], 'center', 'b'),
              cl(i + 1, 'right'),
              cl(`2026-06-${pad(preD)}`, 'center'),
              cl(`${pad(preH)}:${pad(preM)}`, 'center'),
              cl('P' + String(100000 + Math.floor(u(12) * 899999))),
              cl(dwg),
              cl(1, 'right'),
              cl(mat, 'left', 'key'),
              cl(eq, 'center'),
              cl(gr, 'center'),
              cl(mt, 'center'),
              cl(thk, 'right'),
              cl(wid.toLocaleString(), 'right'),
              cl(len.toLocaleString(), 'right'),
              cl(wt.toLocaleString(), 'right'),
              cl(((wid * len) / 1000000).toFixed(1), 'right'),
              cl(u(13) < 0.6 ? 'v' : '', 'center', u(13) < 0.6 ? 'g' : 'k'),
              cl('원자재', 'center'),
            ],
          ],
        },
      });
    }

    // ---------- 부재 풀 : 블록당 1회 생성 → 절단·사상·선별이 동일 부재번호를 공유 ----------
    const mods: {
      no: string;
      dd: number;
      gDone: boolean;
      sDone: boolean;
      gS: string;
      gE: string;
      sS: string;
      sE: string;
    }[] = [];
    for (let i = 0; i < 2; i++) {
      const u = (k: number) => r(500 + i * 30 + k);
      const dd = 11 + Math.floor(u(1) * 8);
      mods.push({
        no: '2026' + pad(7) + pad(dd) + String(6100 + Math.floor(u(2) * 899)),
        dd,
        gDone: u(4) < 0.75,
        sDone: u(5) < 0.55,
        gS: dts(7, dd, 8, Math.floor(u(6) * 60)),
        gE: dts(7, dd + 1, 17, Math.floor(u(7) * 60)),
        sS: dts(7, dd + 1, 18, Math.floor(u(8) * 60)),
        sE: dts(7, dd + 2, 16, Math.floor(u(9) * 60)),
      });
    }
    const pool: {
      no: string;
      dwg: (typeof dwgs)[number];
      mod: (typeof mods)[number];
      mat: string;
      thk: number;
      wt: number;
      cut: boolean;
      cutAt: string;
      gr: boolean;
      grAt: string;
      sel: boolean;
      line: string;
      plt: string;
      selAt: string;
    }[] = [];
    for (let j = 0; j < 12; j++) {
      const v = (k: number) => rnd(seed, 700 + j * 11 + k);
      const dw = dwgs[j % 3];
      const md = mods[j % 2];
      const cut = dw.done || v(1) < 0.5;
      const grDone = cut && v(7) < 0.78;
      const sel = grDone && v(8) < 0.72;
      pool.push({
        no:
          q.ship +
          '-' +
          b.no +
          '-BK' +
          pad(31 + (j % 3)) +
          'A-' +
          'ABS'[j % 3] +
          (Math.floor(j / 3) + 1),
        dwg: dw,
        mod: md,
        mat: mats[Math.floor(v(2) * mats.length)],
        thk: [12, 16, 20, 25][Math.floor(v(3) * 4)],
        wt: 30 + Math.floor(v(4) * 900),
        cut,
        cutAt: cut
          ? dts(6, dw.cD, 9 + Math.floor(v(5) * 7), Math.floor(v(6) * 60))
          : '',
        gr: grDone,
        grAt: grDone
          ? dts(7, md.dd + 1, 8 + Math.floor(v(9) * 8), Math.floor(v(10) * 60))
          : '',
        sel,
        line: 'C' + (1 + (j % 3)),
        plt: sel ? 'PLT-' + pad(4) + pad(10 + (j % 2)) + pad(j) : '미할당',
        selAt: sel
          ? dts(7, md.dd + 2, 9 + Math.floor(v(3) * 7), Math.floor(v(5) * 60))
          : '',
      });
    }

    dwgs.forEach((dw) => {
      const kids = pool.filter((p) => p.dwg === dw);
      rows.push({
        ship: q.ship,
        blk: b.no,
        proc: '가공',
        stage: '절단',
        sub: '절단',
        key: dw.no,
        warn: !dw.done,
        start: dw.s,
        end: dw.done ? dw.e : '',
        note: dw.done ? '' : '진행중',
        detail: {
          title: `절단 실적 — 도면 ${dw.no}`,
          axis: `도면(네스팅) → 하위 부재 ${kids.length}건`,
          cols: [
            th('부재번호'),
            th('도면번호'),
            th('절단장비', 'center'),
            th('재질', 'center'),
            th('두께', 'right'),
            th('중량(kg)', 'right'),
            th('절단완료일시', 'center'),
            th('상태', 'center'),
          ],
          rows: kids.map((p) => [
            cl(p.no, 'left', 'key'),
            cl(dw.no),
            cl(dw.eq, 'center'),
            cl(p.mat, 'center'),
            cl(p.thk, 'right'),
            cl(p.wt.toLocaleString(), 'right'),
            cl(p.cutAt, 'center', p.cut ? undefined : 'k'),
            cl(p.cut ? '절단완료' : '미완', 'center', p.cut ? 'g' : 'r'),
          ]),
        },
      });
    });

    mods.forEach((md) => {
      const kids = pool.filter((p) => p.mod === md);
      rows.push({
        ship: q.ship,
        blk: b.no,
        proc: '가공',
        stage: '사상',
        sub: '사상',
        key: md.no,
        warn: !md.gDone,
        start: md.gS,
        end: md.gDone ? md.gE : '',
        note: md.gDone ? '' : '진행중',
        detail: {
          title: `사상 실적 — 모듬 ${md.no}`,
          axis: `모듬(팔레트) → 하위 부재 ${kids.length}건`,
          cols: [
            th('부재번호'),
            th('모듬번호'),
            th('도면번호'),
            th('사상SHOP', 'center'),
            th('중량(kg)', 'right'),
            th('사상완료일시', 'center'),
            th('상태', 'center'),
          ],
          rows: kids.map((p) => [
            cl(p.no, 'left', 'key'),
            cl(md.no),
            cl(p.dwg.no),
            cl('GBS', 'center'),
            cl(p.wt.toLocaleString(), 'right'),
            cl(p.grAt, 'center', p.gr ? undefined : 'k'),
            cl(p.gr ? '사상완료' : '미완', 'center', p.gr ? 'g' : 'r'),
          ]),
        },
      });
      rows.push({
        ship: q.ship,
        blk: b.no,
        proc: '가공',
        stage: '선별',
        sub: '선별',
        key: md.no,
        warn: !md.sDone,
        start: md.sS,
        end: md.sDone ? md.sE : '',
        note: md.sDone ? '' : '팔레트 미할당 포함',
        detail: {
          title: `부재선별 실적 — 모듬 ${md.no}`,
          axis: `모듬(팔레트) → 하위 부재 ${kids.length}건`,
          cols: [
            th('부재번호'),
            th('모듬번호'),
            th('도면번호'),
            th('송선', 'center'),
            th('팔레트', 'center'),
            th('선별완료일시', 'center'),
            th('상태', 'center'),
          ],
          rows: kids.map((p) => [
            cl(p.no, 'left', 'key'),
            cl(md.no),
            cl(p.dwg.no),
            cl(p.line, 'center'),
            cl(p.plt, 'center', p.sel ? undefined : 'r'),
            cl(p.selAt, 'center', p.sel ? undefined : 'k'),
            cl(p.sel ? '선별완료' : '선별중', 'center', p.sel ? 'g' : 'o'),
          ]),
        },
      });
    });

    // ---------- 조립 · 의장 · 도장 (하위 없음 → 단건 상세) ----------
    const prog = b.act / 100;
    ['SA', 'MA', 'GA'].forEach((t, i) => {
      const u = (k: number) => r(800 + i * 20 + k);
      const comp = Math.max(
        0,
        Math.min(100, Math.round(prog * 130 - 20 + u(1) * 30)),
      );
      if (comp <= 0) return;
      const shade = u(2) < 0.12;
      const key = `${q.ship}-${b.no}-${t}${pad(i + 1)}`;
      const scanAt = dts(
        7,
        13 + Math.floor(u(3) * 6),
        9 + Math.floor(u(5) * 7),
        Math.floor(u(6) * 60),
      );
      rows.push({
        ship: q.ship,
        blk: b.no,
        proc: '조립',
        stage: '조립',
        sub: '스캔 인식',
        key,
        warn: shade,
        start: dts(7, 12 + Math.floor(u(3) * 6), 8, Math.floor(u(4) * 60)),
        end: shade ? '' : scanAt,
        note: shade ? '스캔 음영 — 완성도 미산출' : `완성도 ${comp}%`,
        detail: kv(`조립 스캔 인식 — ${key}`, '조립품 · 단건 (하위 없음)', [
          ['조립품번호', key, 'key'],
          ['도면 대비 완성도', shade ? '—' : `${comp}%`, shade ? 'k' : undefined],
          ['최근 스캔 일시', scanAt],
          ['인식 상태', shade ? '스캔 음영' : '인식', shade ? 'r' : 'g'],
          ['수집 원천', 'LiDAR · Vision AI (필드)'],
          ['하위 데이터', '없음 — 조립품이 최소 추적 단위', 'k'],
        ]),
      });
    });
    (
      [
        ['SP', '파이프'],
        ['EC', '전장케이블'],
        ['SPT', '서포트'],
      ] as const
    ).forEach((t, i) => {
      const u = (k: number) => r(900 + i * 20 + k);
      const comp = Math.max(
        0,
        Math.min(100, Math.round(prog * 110 - 35 + u(1) * 30)),
      );
      if (comp <= 0) return;
      const miss = u(2) < 0.14;
      const key = `${q.ship}-${b.no}-${t[0]}${pad(101 + i)}`;
      const recogAt = dts(
        7,
        15 + Math.floor(u(3) * 5),
        10 + Math.floor(u(5) * 6),
        Math.floor(u(6) * 60),
      );
      rows.push({
        ship: q.ship,
        blk: b.no,
        proc: '의장',
        stage: '의장',
        sub: '설치 인식',
        key,
        warn: miss,
        start: dts(7, 14 + Math.floor(u(3) * 5), 9, Math.floor(u(4) * 60)),
        end: miss ? '' : recogAt,
        note: miss ? '미인식 — Key-In 대기' : `${t[1]} 설치 인식 · ${comp}%`,
        detail: kv(`의장 설치 인식 — ${key}`, '의장품 · 단건 (하위 없음)', [
          ['의장품번호', key, 'key'],
          ['의장품 구분', t[1]],
          ['완성도', miss ? '—' : `${comp}%`, miss ? 'k' : undefined],
          ['최근 인식 일시', recogAt],
          ['수집', miss ? 'Key-In 대기' : '자동', miss ? 'r' : 'g'],
          ['수집 원천', 'LiDAR (필드) · RFID 미적용'],
          ['하위 데이터', '없음 — 의장품이 최소 추적 단위', 'k'],
        ]),
      });
    });
    (
      [
        ['S/P', 0.75],
        ['T/UP', 0.88],
        ['FINAL', 0.97],
      ] as const
    ).forEach((s, i) => {
      if (prog < s[1] - 0.35) return;
      const u = (k: number) => r(1000 + i * 20 + k);
      const done = prog >= s[1];
      const insp = u(1) < 0.7;
      const key = `${q.ship}-${b.no}`;
      rows.push({
        ship: q.ship,
        blk: b.no,
        proc: '도장',
        stage: '도장',
        sub: s[0],
        key,
        warn: done && !insp,
        start: dts(7, 18 + i * 3, 8, Math.floor(u(2) * 60)),
        end: done ? dts(7, 20 + i * 3, 16, Math.floor(u(3) * 60)) : '',
        note: done ? (insp ? 'i-QMS 검사 합격' : '검사중') : '진행중',
        detail: kv(
          `도장 스텝 실적 — ${key} · ${s[0]}`,
          '블록 · 스텝 단건 (하위 없음)',
          [
            ['블록번호', key, 'key'],
            ['도장 스텝', s[0]],
            ['스텝 상태', done ? '완료' : '진행중', done ? 'g' : 'o'],
            [
              '완료일',
              done ? `2026-07-${pad(20 + i * 3)}` : '—',
              done ? undefined : 'k',
            ],
            [
              'i-QMS 검사',
              done ? (insp ? '합격' : '검사중') : '—',
              done ? (insp ? 'g' : 'r') : 'k',
            ],
            ['수집 원천', 'BTS 스텝 실적 · i-QMS 검사'],
            ['하위 데이터', '없음 — 도장은 블록 단위 스텝 체인', 'k'],
          ],
        ),
      });
    });
  });

  rows.sort(
    (a, b) =>
      a.blk.localeCompare(b.blk) ||
      STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] ||
      (SUB_ORDER[a.sub] || 0) - (SUB_ORDER[b.sub] || 0) ||
      a.key.localeCompare(b.key),
  );
  gatherCache.set(gk, rows);
  return rows;
}

/** 단계 → 관리 단위(추적 객체) 라벨 */
export const STAGE_KEY_LABEL: Record<string, string> = {
  SSY: '자재번호 + Roll No.',
  전처리: '자재번호 + Roll No.',
  절단: '도면번호',
  사상: '모듬번호',
  선별: '모듬번호',
  조립: '조립품번호',
  의장: '의장품번호',
  도장: '블록번호',
};
