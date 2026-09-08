import { useMemo, useState } from 'react';
import { STAGE_NAMES, fabCurIdx, stTier, stepTxt } from '../lib/block-status';
import {
  asm,
  blocks,
  events,
  fab,
  otf,
  pnt,
  recvMin,
  rnd,
  scanAge,
  wos,
} from '../lib/seed';
import type {
  BlockInfo,
  FabResult,
  GatherProc,
  IssueKind,
  KvRow,
  PntResult,
  TierKey,
} from './types';

export type ProcFilter = GatherProc | '전체';
export type MainTab = 'dash' | 'gather';

interface Enriched {
  b: BlockInfo;
  f: FabResult;
  a: number | null;
  o: number | null;
  p: PntResult;
  insp: string;
}

export interface BlkOptVM {
  no: string;
  fac: string;
  on: boolean;
  toggle: () => void;
}

export interface BlkDropdownVM {
  open: boolean;
  toggle: () => void;
  query: string;
  setQuery: (v: string) => void;
  opts: BlkOptVM[];
  selN: number;
  totalN: number;
  summary: string;
  /** 선택이 있어 진한 색으로 표시할지 */
  summaryOn: boolean;
  selectAll: () => void;
  clear: () => void;
}

export interface ChipVM {
  label: string;
  active: boolean;
  select: () => void;
}

export interface TierChipVM extends ChipVM {
  tier: TierKey | '';
}

export interface ListRowVM {
  no: string;
  tier: TierKey;
  act: number;
  plan: number;
  delay: number;
  delayTxt: string;
  fab: string;
  asm: string;
  otf: string;
  pnt: string;
  woN: string;
  iss: number;
  open: () => void;
}

export interface ProcCardRowVM {
  k: string;
  /** 바 채움 % — null 이면 바 없음 */
  val: number | null;
  /** 값 표기 — 없으면 val% */
  txt: string | null;
}

export interface ProcCardVM {
  name: GatherProc;
  st: '미착수' | '진행중' | '완료';
  pct: number | null;
  stale: boolean;
  subTag: string | null;
  woCnt: string;
  rows: ProcCardRowVM[];
  src: string;
  goProc: () => void;
}

export interface DistCellVM {
  k: string;
  v: string;
  p: string;
  color: string;
  warm: boolean;
}

export interface DetailVM {
  ship: string;
  no: string;
  fac: string;
  stats: { k: string; v: string; warm: boolean; dim: boolean }[];
  ovAct: number;
  ovPlan: number;
  ovDelay: number;
  ovTier: TierKey;
  procCards: ProcCardVM[];
  woN: string;
  asmN: string;
  distSegs: { w: number; color: string }[];
  distCells: DistCellVM[];
  asmBars: { name: string; avg: number; cnt: string }[];
  recentEv: { proc: GatherProc; ev: string; t: string }[];
  care: { k: string; v: number; warm: boolean; open: () => void }[];
  lowWos: { rank: number; proc: GatherProc; wo: string; pct: number }[];
  goGather: () => void;
}

export interface DashVM {
  prompt: boolean;
  list: {
    rows: ListRowVM[];
    chips: TierChipVM[];
    shownN: number;
    total: number;
  } | null;
  nav: {
    backToList: () => void;
    hasNav: boolean;
    pos: number;
    total: number;
    prev: () => void;
    next: () => void;
  } | null;
  detail: DetailVM | null;
}

export interface EvRowVM {
  id: string;
  blk: string;
  proc: GatherProc;
  ev: string;
  key: string;
  start: string;
  end: string;
  done: boolean;
  warn: boolean;
  note: string;
  src: string;
  newBlk: boolean;
  selected: boolean;
  open: () => void;
}

export interface GatherVM {
  cnt: number;
  issueChip: { label: string; clear: () => void } | null;
  blkChip: { no: string; clear: () => void } | null;
  procFilters: ChipVM[];
  rows: EvRowVM[];
  drill: {
    title: string;
    sub: string;
    kv: KvRow[];
    close: () => void;
  } | null;
}

export interface GatheringVM {
  fShip: string;
  setFShip: (v: string) => void;
  blkDd: BlkDropdownVM;
  doSearch: () => void;
  doReset: () => void;
  tab: MainTab;
  setTab: (t: MainTab) => void;
  searched: boolean;
  dash: DashVM | null;
  gather: GatherVM | null;
}

interface DrillState {
  id: string;
  title: string;
  sub: string;
  kv: KvRow[];
}

const ISSUE_LABEL: Record<IssueKind, string> = {
  정합성: '정합성 불일치',
  'Key-In': 'Key-In 대기',
  수집실패: 'I/F 미수신',
};

export function useGathering(): GatheringVM {
  const [fShip, setFShipRaw] = useState('');
  const [fBlks, setFBlks] = useState<string[]>([]);
  const [blkDdOpen, setBlkDdOpen] = useState(false);
  const [blkDdQuery, setBlkDdQuery] = useState('');
  const [query, setQuery] = useState<{ ship: string } | null>(null);
  const [blks, setBlks] = useState<string[]>([]);
  const [actBlk, setActBlk] = useState<string | null>(null);
  const [listTier, setListTier] = useState<TierKey | ''>('');
  const [tab, setTab] = useState<MainTab>('dash');
  const [gBlk, setGBlk] = useState('');
  const [gProc, setGProc] = useState<ProcFilter>('전체');
  const [gIssue, setGIssue] = useState<IssueKind | ''>('');
  const [drill, setDrill] = useState<DrillState | null>(null);

  const ddBlocks = useMemo(() => (fShip ? blocks(fShip) : []), [fShip]);
  const blocksAll = useMemo(
    () => (query ? blocks(query.ship) : []),
    [query],
  );
  const evAll = useMemo(() => (query ? events(query.ship) : []), [query]);

  const blkDd: BlkDropdownVM = {
    open: blkDdOpen,
    toggle: () => {
      if (!fShip) return;
      setBlkDdOpen((v) => !v);
    },
    query: blkDdQuery,
    setQuery: (v) => setBlkDdQuery(v.replace(/[^0-9]/g, '')),
    opts: ddBlocks
      .filter((b) => !blkDdQuery || b.no.includes(blkDdQuery))
      .map((b) => {
        const on = fBlks.includes(b.no);
        return {
          no: b.no,
          fac: `조립${b.fac}`,
          on,
          toggle: () =>
            setFBlks((cur) =>
              on ? cur.filter((x) => x !== b.no) : cur.concat([b.no]),
            ),
        };
      }),
    selN: fBlks.length,
    totalN: ddBlocks.length,
    summary:
      fBlks.length === 0
        ? fShip
          ? '— 선택 —'
          : '호선 먼저 선택'
        : fBlks[0] + (fBlks.length > 1 ? ` 외 ${fBlks.length - 1}개` : ''),
    summaryOn: fBlks.length > 0,
    selectAll: () => setFBlks(ddBlocks.map((b) => b.no)),
    clear: () => setFBlks([]),
  };

  const base: GatheringVM = {
    fShip,
    setFShip: (v) => {
      setFShipRaw(v);
      setFBlks([]);
      setBlkDdOpen(false);
    },
    blkDd,
    doSearch: () => {
      if (!fShip || fBlks.length === 0) return;
      setQuery({ ship: fShip });
      setBlks(fBlks.slice());
      setActBlk(null);
      setListTier('');
      setGBlk('');
      setDrill(null);
      setBlkDdOpen(false);
    },
    doReset: () => {
      setFShipRaw('');
      setFBlks([]);
      setQuery(null);
      setBlks([]);
      setActBlk(null);
      setGBlk('');
      setGProc('전체');
      setGIssue('');
      setDrill(null);
      setTab('dash');
      setBlkDdOpen(false);
    },
    tab,
    setTab,
    searched: !!query,
    dash: null,
    gather: null,
  };

  if (!query) return base;
  const ship = query.ship;

  // ---------- 대시보드 ----------
  const enrichOf = (no: string): Enriched | null => {
    const b = blocksAll.find((x) => x.no === no);
    if (!b) return null;
    const p = pnt(b);
    return {
      b,
      f: fab(b),
      a: asm(b),
      o: otf(b),
      p,
      insp: p.done > 0 ? (rnd(b.seed, 80 + p.done - 1) < 0.75 ? '합격' : '검사중') : '',
    };
  };
  const sel = blks
    .map(enrichOf)
    .filter((e): e is Enriched => e != null);
  const single = blks.length === 1;
  const actNo = single ? blks[0] : actBlk && blks.includes(actBlk) ? actBlk : null;
  const selE = actNo ? (sel.find((e) => e.b.no === actNo) ?? null) : null;

  const tierCnt = (t: TierKey) =>
    sel.filter((e) => stTier(e.b.delay) === t).length;
  const chips: TierChipVM[] = (
    [
      ['', `전체 ${sel.length}`],
      ['delay', `지연 ${tierCnt('delay')}`],
      ['warn', `주의 ${tierCnt('warn')}`],
      ['ok', `정상 ${tierCnt('ok')}`],
    ] as [TierKey | '', string][]
  ).map(([t, label]) => ({
    tier: t,
    label,
    active: listTier === t,
    select: () => setListTier(t),
  }));

  let listSel = sel.filter((e) => !listTier || stTier(e.b.delay) === listTier);
  listSel = listSel
    .slice()
    .sort((x, y) => y.b.delay - x.b.delay || Number(x.b.no) - Number(y.b.no));

  const listRows: ListRowVM[] = listSel.map((e) => {
    const s = stepTxt(e.f, e.a, e.o, e.p);
    const iss = evAll.filter((x) => x.blk === e.b.no && x.issue).length;
    return {
      no: e.b.no,
      tier: stTier(e.b.delay),
      act: e.b.act,
      plan: e.b.plan,
      delay: e.b.delay,
      delayTxt: e.b.delay > 0 ? `-${e.b.delay}%p` : '—',
      fab: s.fab,
      asm: s.asm,
      otf: s.otf,
      pnt: s.pnt,
      woN: e.b.woN.toLocaleString(),
      iss,
      open: () => setActBlk(e.b.no),
    };
  });

  let nav: DashVM['nav'] = null;
  if (selE && !single) {
    const idx = listSel.findIndex((e) => e.b.no === actNo);
    const arr = listSel.length ? listSel : sel;
    const i2 = Math.max(0, arr.findIndex((e) => e.b.no === actNo));
    nav = {
      backToList: () => setActBlk(null),
      hasNav: arr.length > 1,
      pos: (idx >= 0 ? idx : i2) + 1,
      total: arr.length,
      prev: () => setActBlk(arr[(i2 - 1 + arr.length) % arr.length].b.no),
      next: () => setActBlk(arr[(i2 + 1) % arr.length].b.no),
    };
  }

  let detail: DetailVM | null = null;
  if (selE) {
    const b = selE.b;
    const f = selE.f;
    const evB = evAll.filter((e) => e.blk === b.no);
    const autoB = evB.filter((e) => e.src.includes('LiDAR')).length;
    const keyinB = Math.round(rnd(b.seed, 140) * 18);
    const rm = recvMin(b);
    const allWos = wos(b);
    let nDone = 0;
    let nProg = 0;
    let nWait = 0;
    let nFail = 0;
    const pAgg: Record<GatherProc, [number, number]> = {
      가공: [0, 0],
      조립: [0, 0],
      의장: [0, 0],
      도장: [0, 0],
    };
    allWos.forEach((w) => {
      if (w.warn) nFail++;
      else if (w.pct >= 100) nDone++;
      else if (w.pct > 0) nProg++;
      else nWait++;
      pAgg[w.proc][1]++;
      if (w.pct >= 100) pAgg[w.proc][0]++;
    });

    const goProcOf = (proc: GatherProc) => () => {
      setTab('gather');
      setGBlk(b.no);
      setGProc(proc);
      setDrill(null);
    };
    const scanH = scanAge(b, 0);
    const scanHo = scanAge(b, 1);
    const ageTxt = (h: number) =>
      h < 24 ? `${h}시간 전` : `${Math.floor(h / 24)}일 전`;
    const woDoneRow = (proc: GatherProc, v: number | null): ProcCardRowVM => ({
      k: 'WO 완료',
      val:
        v == null
          ? null
          : Math.round((pAgg[proc][0] / Math.max(1, pAgg[proc][1])) * 100),
      txt: null,
    });
    const fc = fabCurIdx(f);
    const fabHead =
      f.total > 0 ? (f.rates.every((r) => r >= 100) ? '완료' : STAGE_NAMES[fc]) : null;
    const pntV = selE.p.done > 0 ? Math.round((selE.p.done / 3) * 100) : null;
    const pntRow = (k: string, th: number): ProcCardRowVM => ({
      k,
      val: selE.p.done >= th ? 100 : null,
      txt:
        selE.p.done >= th
          ? '완료'
          : th === 2 && selE.p.done === 1
            ? '진행중'
            : '—',
    });
    const cardDefs: {
      name: GatherProc;
      v: number | null;
      rows: ProcCardRowVM[];
      src: string;
      head: string | null;
      stale: boolean;
    }[] = [
      {
        name: '가공',
        v: f.total > 0 ? f.rates[fc] : null,
        rows: STAGE_NAMES.map((n, i) => ({ k: n, val: f.rates[i], txt: null })),
        src: '절단 MES · 부재종합 · 부재선별 (레거시 I/F)',
        head: fabHead,
        stale: false,
      },
      {
        name: '조립',
        v: selE.a,
        rows: [
          { k: '완성도', val: selE.a, txt: null },
          woDoneRow('조립', selE.a),
          { k: '최근 스캔', val: null, txt: selE.a == null ? '—' : ageTxt(scanH) },
        ],
        src: 'LiDAR · Vision AI',
        head: null,
        stale: selE.a != null && scanH > 24,
      },
      {
        name: '의장',
        v: selE.o,
        rows: [
          { k: '완성도', val: selE.o, txt: null },
          woDoneRow('의장', selE.o),
          { k: '최근 스캔', val: null, txt: selE.o == null ? '—' : ageTxt(scanHo) },
        ],
        src: 'LiDAR (RFID 미적용)',
        head: null,
        stale: selE.o != null && scanHo > 24,
      },
      {
        name: '도장',
        v: pntV,
        rows: [pntRow('S/P', 1), pntRow('T/UP', 2), pntRow('FINAL', 3)],
        src:
          'BTS · i-QMS' +
          (selE.p.done > 0
            ? ` — ${selE.insp === '검사중' ? '검사중' : `검사 ${selE.insp}`}`
            : ''),
        head: selE.p.done > 0 ? ['S/P', 'T/UP', 'FINAL'][selE.p.done - 1] : null,
        stale: false,
      },
    ];
    const procCards: ProcCardVM[] = cardDefs.map((pc) => ({
      name: pc.name,
      st: pc.v == null ? '미착수' : pc.v >= 100 ? '완료' : '진행중',
      pct: pc.v,
      stale: pc.stale,
      subTag: pc.stale ? '스캔 24h 초과' : pc.head,
      woCnt: `WO ${pAgg[pc.name][0].toLocaleString()} / ${pAgg[pc.name][1].toLocaleString()} 완료`,
      rows: pc.rows,
      src: pc.src,
      goProc: goProcOf(pc.name),
    }));

    const tot = Math.max(1, allWos.length);
    const distSegs = [
      { w: (nDone / tot) * 100, color: '#56687E' },
      { w: (nProg / tot) * 100, color: '#A8B4C2' },
      { w: (nWait / tot) * 100, color: '#E2DDD0' },
      { w: (nFail / tot) * 100, color: '#C42B2B' },
    ];
    const dcell = (k: string, v: number, color: string, warm: boolean): DistCellVM => ({
      k,
      v: v.toLocaleString(),
      p: `${Math.round((v / tot) * 100)}%`,
      color,
      warm,
    });
    const distCells = [
      dcell('완료', nDone, '#56687E', false),
      dcell('진행중', nProg, '#A8B4C2', false),
      dcell('미착수', nWait, '#E2DDD0', false),
      dcell('수집 실패', nFail, '#C42B2B', nFail > 0),
    ];

    const asmAgg: Record<string, { sum: number; done: number; n: number }> = {};
    allWos.forEach((w) => {
      asmAgg[w.asm] = asmAgg[w.asm] ?? { sum: 0, done: 0, n: 0 };
      asmAgg[w.asm].sum += w.pct;
      asmAgg[w.asm].n++;
      if (w.pct >= 100) asmAgg[w.asm].done++;
    });
    const asmBars = Object.keys(asmAgg)
      .map((an) => {
        const g = asmAgg[an];
        return { name: an, avg: Math.round(g.sum / g.n), cnt: `${g.done}/${g.n} WO` };
      })
      .sort((x, y) => x.avg - y.avg)
      .slice(0, 7);

    const recentEv = evB
      .filter((e) => e.end)
      .slice(-7)
      .reverse()
      .map((e) => ({ proc: e.proc, ev: `${e.ev} · ${e.key}`, t: e.end }));

    // 실적 저조 WO TOP 10 — 진행중 WO만, 진행률 오름차순. 수집실패는 '확인 필요'가 담당
    const lowWos = allWos
      .filter((w) => !w.warn && w.pct > 0 && w.pct < 100)
      .sort((x, y) => x.pct - y.pct)
      .slice(0, 10)
      .map((w, i) => ({ rank: i + 1, proc: w.proc, wo: w.wo, pct: w.pct }));

    const cnt = (iss: IssueKind) => evB.filter((e) => e.issue === iss).length;
    const careOf = (k: string, n: number, iss: IssueKind, warm: boolean) => ({
      k,
      v: n,
      warm,
      open: () => {
        setTab('gather');
        setGBlk(b.no);
        setGProc('전체');
        setGIssue(iss);
        setDrill(null);
      },
    });
    const nBad = cnt('정합성');
    const nKi = cnt('Key-In');
    const nIf = cnt('수집실패');

    detail = {
      ship,
      no: b.no,
      fac: `조립 ${b.fac}공장`,
      stats: [
        { k: '하위 WO', v: b.woN.toLocaleString(), warm: false, dim: false },
        { k: '어셈블리', v: String(b.asmN), warm: false, dim: false },
        { k: '수집 이벤트', v: evB.length.toLocaleString(), warm: false, dim: false },
        {
          k: '자동수집 비중',
          v: `${Math.round((autoB / Math.max(1, evB.length)) * 100)}%`,
          warm: false,
          dim: false,
        },
        { k: '수기(Key-In) 비중', v: `${keyinB}%`, warm: keyinB > 10, dim: keyinB <= 10 },
        {
          k: '최근 수신',
          v: rm < 60 ? `${rm}분 전` : `${Math.floor(rm / 60)}시간 전`,
          warm: false,
          dim: true,
        },
      ],
      ovAct: b.act,
      ovPlan: b.plan,
      ovDelay: b.delay,
      ovTier: stTier(b.delay),
      procCards,
      woN: b.woN.toLocaleString(),
      asmN: String(b.asmN),
      distSegs,
      distCells,
      asmBars,
      recentEv,
      care: [
        careOf('정합성 불일치', nBad, '정합성', true),
        careOf('Key-In 대기', nKi, 'Key-In', false),
        careOf('I/F 미수신', nIf, '수집실패', true),
      ],
      lowWos,
      goGather: () => {
        setTab('gather');
        setGBlk(b.no);
        setGIssue('');
        setDrill(null);
      },
    };
  }

  const dash: DashVM = {
    prompt: blks.length === 0,
    list: blks.length > 1 && !selE ? { rows: listRows, chips, shownN: listSel.length, total: sel.length } : null,
    nav,
    detail,
  };

  // ---------- 수집 데이터 조회 ----------
  let evs = evAll;
  if (gBlk) evs = evs.filter((e) => e.blk === gBlk);
  if (gProc !== '전체') evs = evs.filter((e) => e.proc === gProc);
  if (gIssue) evs = evs.filter((e) => e.issue === gIssue);

  const gather: GatherVM = {
    cnt: evs.length,
    issueChip: gIssue
      ? {
          label: ISSUE_LABEL[gIssue],
          clear: () => {
            setGIssue('');
            setDrill(null);
          },
        }
      : null,
    blkChip: gBlk
      ? {
          no: gBlk,
          clear: () => {
            setGBlk('');
            setDrill(null);
          },
        }
      : null,
    procFilters: (['전체', '가공', '조립', '의장', '도장'] as ProcFilter[]).map(
      (p) => ({
        label: p,
        active: gProc === p,
        select: () => {
          setGProc(p);
          setDrill(null);
        },
      }),
    ),
    rows: evs.slice(0, 200).map((e, i, arr) => {
      const id = e.key + e.ev;
      return {
        id,
        blk: e.blk,
        proc: e.proc,
        ev: e.ev,
        key: e.key,
        start: e.start,
        end: e.end || '—',
        done: !!e.end,
        warn: e.warn,
        note: e.note.replace(/^(완료|진행중) · /, ''),
        src: e.src,
        newBlk: i > 0 && arr[i - 1].blk !== e.blk,
        selected: drill?.id === id,
        open: () =>
          setDrill({
            id,
            title: `${e.ev} — ${e.key}`,
            sub: `${e.blk}블록 · ${e.proc}`,
            kv: e.kv,
          }),
      };
    }),
    drill: drill
      ? {
          title: drill.title,
          sub: drill.sub,
          kv: drill.kv,
          close: () => setDrill(null),
        }
      : null,
  };

  return { ...base, dash, gather };
}
