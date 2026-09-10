import { useMemo, useState } from 'react';
import { fabCurIdx, stTier } from '../lib/block-status';
import {
  asm,
  events,
  fab,
  otf,
  pnt,
  procAct,
  recvMin,
  rnd,
  scanAge,
  scopeBlocks,
  wos,
} from '../lib/seed';
import {
  ISSUE_LABEL,
  SCOPES,
  SHIPS,
  STAGE_NAMES,
  USERS,
} from './mock-data';
import type {
  BlockInfo,
  DemoUser,
  EvItem,
  FabResult,
  GatherProc,
  IssueKind,
  PntResult,
  TierKey,
  WoItem,
} from './types';

export type MainTab = 'dash' | 'gather';
export type GatherStFilter = '전체' | '완료' | '진행중' | '보완';

/* ---------- 색 팔레트 (V7) ---------- */
const BAR = '#56687E';
const RED = '#C42B2B';
const AMBER = '#B5740A';
const GREEN = '#2F8F5B';
const GREEN_HEAT = '#5CA627';
const FAINT = '#C2C9D4';
const DIM = '#8A93A6';
const DARK = '#3C4859';
const STALE = '#A8AFBC';

/* ---------- VM 타입 ---------- */
export interface LoginVM {
  id: string;
  pw: string;
  err: string;
  setId: (v: string) => void;
  setPw: (v: string) => void;
  submit: () => void;
  demoAccounts: { id: string; desc: string; pick: () => void }[];
}

export interface KpiVM {
  label: string;
  val: string;
  unit: string;
  sub: string;
  /** 경고 강조색 — 있으면 좌측 바 + 값·서브 색, 클릭 가능 */
  warnColor: string | null;
  onClick: (() => void) | null;
}

export interface BlkOptVM {
  no: string;
  on: boolean;
  st: string;
  stDone: boolean;
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

export interface ListColVM {
  h: string;
  align: 'left' | 'center' | 'right';
  sep?: boolean;
  bold?: boolean;
}

export interface ListCellVM {
  v: string;
  align: 'left' | 'center' | 'right';
  color: string;
  bg?: string;
  bold?: boolean;
  sep?: boolean;
}

export interface ListRowVM {
  no: string;
  tier: TierKey;
  act: number;
  plan: number;
  delay: number;
  delayTxt: string;
  cells: ListCellVM[];
  open: () => void;
}

export interface ListVM {
  rows: ListRowVM[];
  cols: ListColVM[];
  chips: TierChipVM[];
  shownN: number;
  total: number;
  foot: string;
}

export interface StatVM {
  k: string;
  v: string;
  color: string;
}

export interface CardRowVM {
  k: string;
  v: string;
  color: string;
}

export interface StageCardVM {
  name: string;
  cur: boolean;
  st: string;
  stKind: 'none' | 'done' | 'prog';
  /** null=미착수 */
  pct: string | null;
  unit: string;
  stale: boolean;
  tag: string;
  sub: string;
  barPct: number;
  rows: CardRowVM[];
  src: string;
  go: () => void;
}

export interface DetailVM {
  ship: string;
  no: string;
  stage: string;
  stats: StatVM[];
  ovAct: number;
  ovPlan: number;
  ovDelay: number;
  ovTier: TierKey;
  cardCols: number;
  stageCards: StageCardVM[];
  woN: string;
  distSegs: { w: number; color: string }[];
  distCells: { k: string; v: string; p: string; dot: string; color: string }[];
  panelBTitle: string;
  panelBSub: string;
  panelBRows: { name: string; pct: number; low: boolean; v: string; cnt: string }[];
  recentEv: { ev: string; t: string }[];
  careRows: {
    k: string;
    v: string;
    on: boolean;
    color: string;
    bg: string;
    border: string;
    open: () => void;
  }[];
  lowWos: { rank: number; wo: string; name: string; pct: number }[];
  goGather: () => void;
}

export interface DashVM {
  kpis: KpiVM[];
  list: ListVM | null;
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
  blk: string;
  ev: string;
  key: string;
  start: string;
  end: string;
  st: '완료' | '진행중' | '보완';
  warn: boolean;
  note: string;
  src: string;
  newBlk: boolean;
  /** 가공 전용 레거시 대조 컬럼 */
  autoPct: string;
  legacy: string;
  legacyWarn: boolean;
  match: string;
  matchWarn: boolean;
}

export interface GatherVM {
  cnt: number;
  hasLegacy: boolean;
  issueChip: { label: string; clear: () => void } | null;
  blkChip: { no: string; clear: () => void } | null;
  stFilters: ChipVM[];
  rows: EvRowVM[];
}

export interface MainVM {
  scopeName: GatherProc;
  scopeSrc: string;
  scopeHint: string;
  userLabel: string;
  logout: () => void;
  fShip: string;
  setFShip: (v: string) => void;
  shipOpts: { v: string; label: string }[];
  blkDd: BlkDropdownVM;
  doSearch: () => void;
  doReset: () => void;
  tab: MainTab;
  setTab: (t: MainTab) => void;
  searched: boolean;
  dash: DashVM | null;
  gather: GatherVM | null;
}

export interface GatheringVM {
  login: LoginVM | null;
  main: MainVM | null;
}

interface Enriched {
  b: BlockInfo;
  act: number;
  plan: number;
  delay: number;
  f: FabResult;
  a: number | null;
  o: number | null;
  p: PntResult;
  evB: EvItem[];
  iss: number;
}

const STEP_LABELS = ['—', 'S/P', 'T/UP', 'FINAL'];

export function useGathering(): GatheringVM {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [loginErr, setLoginErr] = useState('');
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
  const [gIssue, setGIssue] = useState<IssueKind | ''>('');
  const [gSt, setGSt] = useState<GatherStFilter>('전체');

  const proc = user?.proc ?? null;

  const scopeAll = useMemo(
    () => (proc && fShip ? scopeBlocks(proc, fShip) : []),
    [proc, fShip],
  );
  const evsAll = useMemo(
    () => (proc && query ? events(proc, query.ship) : []),
    [proc, query],
  );
  const enrichAll = useMemo<Enriched[]>(() => {
    if (!proc || !query) return [];
    return scopeBlocks(proc, query.ship).map((b) => {
      const act = procAct(proc, b) ?? 0;
      const plan = Math.max(0, Math.min(100, act + b.planGap));
      const delay = Math.max(0, plan - act);
      const evB = evsAll.filter((e) => e.blk === b.no);
      return {
        b,
        act,
        plan,
        delay,
        f: fab(b),
        a: asm(b),
        o: otf(b),
        p: pnt(b),
        evB,
        iss: evB.filter((e) => e.issue).length,
      };
    });
  }, [proc, query, evsAll]);

  /* ---------- 로그인 ---------- */
  if (!user) {
    const submit = () => {
      const f = USERS.find((x) => x.id === loginId.trim() && x.pw === loginPw);
      if (!f) {
        setLoginErr('사번 또는 비밀번호가 올바르지 않습니다');
        return;
      }
      setUser(f);
      setLoginErr('');
      setLoginPw('');
      setFShipRaw(f.ships[0]);
      setFBlks([]);
      setQuery(null);
      setBlks([]);
      setActBlk(null);
      setTab('dash');
    };
    return {
      login: {
        id: loginId,
        pw: loginPw,
        err: loginErr,
        setId: (v) => {
          setLoginId(v);
          setLoginErr('');
        },
        setPw: (v) => {
          setLoginPw(v);
          setLoginErr('');
        },
        submit,
        demoAccounts: USERS.map((x) => ({
          id: x.id,
          desc: `${x.dept} · ${x.name} → ${x.proc} 권역`,
          pick: () => {
            setLoginId(x.id);
            setLoginPw(x.pw);
            setLoginErr('');
          },
        })),
      },
      main: null,
    };
  }

  /* ---------- 메인 공통 ---------- */
  const scope = SCOPES[user.proc];
  const p = user.proc;

  const blkDd: BlkDropdownVM = {
    open: blkDdOpen,
    toggle: () => {
      if (!fShip) return;
      setBlkDdOpen((v) => !v);
    },
    query: blkDdQuery,
    setQuery: (v) => setBlkDdQuery(v.replace(/[^0-9]/g, '')),
    opts: scopeAll
      .filter((b) => !blkDdQuery || b.no.includes(blkDdQuery))
      .map((b) => {
        const on = fBlks.includes(b.no);
        const a = procAct(p, b) ?? 0;
        return {
          no: b.no,
          on,
          st: a >= 100 ? '완료' : `${a}%`,
          stDone: a >= 100,
          toggle: () =>
            setFBlks((cur) =>
              on ? cur.filter((x) => x !== b.no) : cur.concat([b.no]),
            ),
        };
      }),
    selN: fBlks.length,
    totalN: scopeAll.length,
    summary:
      fBlks.length === 0
        ? fShip
          ? '— 선택 —'
          : '호선 먼저 선택'
        : fBlks[0] + (fBlks.length > 1 ? ` 외 ${fBlks.length - 1}개` : ''),
    summaryOn: fBlks.length > 0,
    selectAll: () => setFBlks(scopeAll.map((b) => b.no)),
    clear: () => setFBlks([]),
  };

  const base: MainVM = {
    scopeName: p,
    scopeSrc: scope.src,
    scopeHint: scope.hint,
    userLabel: `${user.dept} ${user.ban} · ${user.name}${user.type === '협력사' ? ' (협력사)' : ''}`,
    logout: () => {
      setUser(null);
      setLoginId('');
      setLoginPw('');
      setQuery(null);
      setBlks([]);
      setFBlks([]);
      setFShipRaw('');
    },
    fShip,
    setFShip: (v) => {
      setFShipRaw(v);
      setFBlks([]);
      setBlkDdOpen(false);
    },
    shipOpts: user.ships.map((s) => ({ v: s, label: SHIPS[s] ?? `${s}호` })),
    blkDd,
    doSearch: () => {
      if (!fShip || fBlks.length === 0) return;
      setQuery({ ship: fShip });
      setBlks(fBlks.slice());
      setActBlk(null);
      setListTier('');
      setGBlk('');
      setGIssue('');
      setBlkDdOpen(false);
    },
    doReset: () => {
      setFShipRaw(user.ships[0]);
      setFBlks([]);
      setQuery(null);
      setBlks([]);
      setActBlk(null);
      setGBlk('');
      setGIssue('');
      setGSt('전체');
      setTab('dash');
      setBlkDdOpen(false);
    },
    tab,
    setTab,
    searched: !!query,
    dash: null,
    gather: null,
  };
  if (!query) return { login: null, main: base };

  const sel = blks
    .map((no) => enrichAll.find((e) => e.b.no === no))
    .filter((e): e is Enriched => e != null);
  const single = sel.length === 1;
  const actNo = single ? sel[0].b.no : actBlk && blks.includes(actBlk) ? actBlk : null;
  const selE = actNo ? (enrichAll.find((e) => e.b.no === actNo) ?? null) : null;
  const showList = sel.length > 1 && !selE;

  /* ---------- KPI (선택 블록 전체) ---------- */
  const nDelay = sel.filter((e) => stTier(e.delay) === 'delay').length;
  const issCnt = (iss: IssueKind) =>
    sel.reduce((s, e) => s + e.evB.filter((x) => x.issue === iss).length, 0);
  const avgAct = sel.length
    ? Math.round(sel.reduce((s, e) => s + e.act, 0) / sel.length)
    : 0;
  const avgPlan = sel.length
    ? Math.round(sel.reduce((s, e) => s + e.plan, 0) / sel.length)
    : 0;
  const goIss = (iss: IssueKind) => () => {
    setTab('gather');
    setGBlk('');
    setGIssue(iss);
  };
  const mk = (
    label: string,
    val: string,
    unit: string,
    sub: string,
    warnColor?: string | null,
    onClick?: () => void,
  ): KpiVM => ({
    label,
    val,
    unit,
    sub,
    warnColor: warnColor ?? null,
    onClick: onClick ?? null,
  });
  const kpis: KpiVM[] = [
    mk('대상 블록', String(sel.length), '개', `${p} 착수 재공 · 선택 기준`),
    mk(
      `${p} 평균 실적`,
      `${avgAct}%`,
      '',
      `계획 평균 ${avgPlan}% · ${avgPlan - avgAct > 0 ? `-${avgPlan - avgAct}%p` : '달성'}`,
    ),
    mk(
      '지연 블록',
      String(nDelay),
      '개',
      `계획 대비 -5%p↓ · 지연율 ${Math.round((nDelay / Math.max(1, sel.length)) * 100)}%`,
      nDelay > 0 ? RED : null,
    ),
  ];
  if (p === '가공') {
    const a = issCnt('정합성');
    const c = issCnt('수집실패');
    kpis.push(
      mk('정합성 불일치', String(a), '건', '자동↔레거시 중량률 대조', a > 0 ? RED : null, goIss('정합성')),
      mk('I/F 미수신', String(c), '건', '레거시 실적 레코드 없음', c > 0 ? RED : null, goIss('수집실패')),
    );
  } else if (p === '도장') {
    const c = issCnt('검사중');
    const fin = sel.filter((e) => e.p.done === 3).length;
    kpis.push(
      mk('FINAL 완료', String(fin), '개', '전 스텝 완료 블록'),
      mk('i-QMS 검사중', String(c), '건', '검사 결과 대기 스텝', c > 0 ? AMBER : null, goIss('검사중')),
    );
  } else {
    const k = issCnt('Key-In');
    const stale = sel.filter((e) => scanAge(e.b, p === '조립' ? 0 : 1) > 24).length;
    kpis.push(
      mk(
        'Key-In 대기',
        String(k),
        '건',
        p === '조립' ? '스캔 음영 — 수기 보완' : '미인식 — 수기 보완',
        k > 0 ? AMBER : null,
        goIss('Key-In'),
      ),
      mk('스캔 24h 초과', String(stale), '개', '최근 LiDAR 스캔 지연 블록', stale > 0 ? DIM : null),
    );
  }

  /* ---------- 블록 목록 (권역별 컬럼) ---------- */
  const cntT = (t: TierKey) => sel.filter((e) => stTier(e.delay) === t).length;
  const chips: TierChipVM[] = (
    [
      ['', `전체 ${sel.length}`],
      ['delay', `지연 ${cntT('delay')}`],
      ['warn', `주의 ${cntT('warn')}`],
      ['ok', `정상 ${cntT('ok')}`],
    ] as [TierKey | '', string][]
  ).map(([t, label]) => ({
    tier: t,
    label,
    active: listTier === t,
    select: () => setListTier(t),
  }));

  const heat = (v: number | null, align: 'left' | 'right' = 'right'): ListCellVM => {
    const s: ListCellVM = { v: v == null ? '—' : String(Math.round(v)), align, color: DARK, bold: true };
    if (v == null) return { ...s, color: FAINT, bold: false };
    if (v >= 99.5) return { ...s, color: GREEN_HEAT, bg: '#EDF6E2' };
    if (v >= 70) return s;
    if (v >= 40) return { ...s, color: AMBER, bg: '#FBF2DE' };
    if (v > 0.5) return { ...s, color: RED, bg: '#FBE8E8' };
    return { ...s, color: FAINT };
  };

  let extraCols: ListColVM[] = [];
  let cellsOf: (e: Enriched) => ListCellVM[] = () => [];
  let listFoot = '';
  if (p === '가공') {
    extraCols = STAGE_NAMES.map((n, i) => ({
      h: n,
      align: 'right',
      sep: i === 0,
    }));
    extraCols.push(
      { h: '가공계', align: 'right', sep: true, bold: true },
      { h: '정합성', align: 'right', sep: true },
      { h: 'I/F 미수신', align: 'right' },
    );
    listFoot = '단계값 = 대상 중량 대비 완료 중량 % · 녹 100 / 황 40~69 / 적 1~39';
    cellsOf = (e) => {
      const nb = e.evB.filter((x) => x.issue === '정합성').length;
      const nf = e.evB.filter((x) => x.issue === '수집실패').length;
      return e.f.rates
        .map((r, i): ListCellVM => ({ ...heat(r), sep: i === 0 }))
        .concat([
          { ...heat(e.f.total), sep: true },
          { v: nb > 0 ? String(nb) : '—', align: 'right', bold: true, sep: true, color: nb > 0 ? RED : FAINT },
          { v: nf > 0 ? String(nf) : '—', align: 'right', bold: true, color: nf > 0 ? RED : FAINT },
        ] satisfies ListCellVM[]);
    };
  } else if (p === '조립' || p === '의장') {
    extraCols = [
      { h: 'LiDAR 완성도', align: 'right', sep: true },
      { h: 'WO 완료', align: 'right' },
      { h: p === '조립' ? '어셈블리' : '의장품 종류', align: 'right' },
      { h: '최근 스캔', align: 'right', sep: true },
      { h: 'Key-In 대기', align: 'right' },
    ];
    listFoot = '완성도 = LiDAR 도면 대비 · 회색 = 최근 스캔 24시간 초과 · Key-In 대기 = 스캔 음영/미인식';
    cellsOf = (e) => {
      const ws = wos(p, e.b);
      const dn = ws.filter((w) => w.pct >= 100).length;
      const age = scanAge(e.b, p === '조립' ? 0 : 1);
      const stale = age > 24;
      const k = e.evB.filter((x) => x.issue === 'Key-In').length;
      const comp = p === '조립' ? e.a : e.o;
      const compCell: ListCellVM = stale
        ? {
            v: `${comp == null ? '—' : Math.round(comp)} (${Math.floor(age / 24)}d)`,
            align: 'right',
            color: STALE,
            bold: true,
            sep: true,
          }
        : { ...heat(comp), sep: true };
      return [
        compCell,
        { v: `${dn} / ${ws.length}`, align: 'right', color: DARK, bold: true },
        { v: p === '조립' ? String(e.b.asmN) : '3종', align: 'right', color: '#5C6678' },
        {
          v: age < 24 ? `${age}시간 전` : `${Math.floor(age / 24)}일 전`,
          align: 'right',
          color: stale ? STALE : '#5C6678',
          sep: true,
        },
        { v: k > 0 ? String(k) : '—', align: 'right', bold: true, color: k > 0 ? AMBER : FAINT },
      ];
    };
  } else {
    extraCols = [
      { h: '현재 스텝', align: 'center', sep: true },
      { h: 'S/P', align: 'center' },
      { h: 'T/UP', align: 'center' },
      { h: 'FINAL', align: 'center' },
      { h: 'i-QMS 검사', align: 'center', sep: true },
    ];
    listFoot = '스텝 체인 S/P → T/UP → FINAL · 검사중 = i-QMS 결과 대기';
    cellsOf = (e) => {
      const d = e.p.done;
      const insp = e.evB.some((x) => x.issue === '검사중');
      const stepC = (n: number): ListCellVM => ({
        v: d >= n ? '완료' : d === n - 1 ? '진행중' : '—',
        align: 'center',
        bold: true,
        color: d >= n ? GREEN_HEAT : d === n - 1 ? AMBER : FAINT,
      });
      return [
        {
          v: STEP_LABELS[d],
          align: 'center',
          bold: true,
          sep: true,
          color: d === 3 ? GREEN_HEAT : DARK,
        },
        stepC(1),
        stepC(2),
        stepC(3),
        {
          v: insp ? '검사중' : '합격',
          align: 'center',
          bold: true,
          sep: true,
          color: insp ? AMBER : GREEN,
        },
      ];
    };
  }
  const listCols: ListColVM[] = (
    [
      { h: '블록', align: 'center' },
      { h: '상태', align: 'center' },
      { h: `${p} 진행 (▏계획)`, align: 'left' },
      { h: '실적', align: 'right' },
      { h: '계획', align: 'right' },
      { h: '지연', align: 'right' },
    ] as ListColVM[]
  ).concat(extraCols);

  const listSel = sel
    .filter((e) => !listTier || stTier(e.delay) === listTier)
    .slice()
    .sort((x, y) => y.delay - x.delay || Number(x.b.no) - Number(y.b.no));
  const listRows: ListRowVM[] = listSel.map((e) => ({
    no: e.b.no,
    tier: stTier(e.delay),
    act: e.act,
    plan: e.plan,
    delay: e.delay,
    delayTxt: e.delay > 0 ? `-${e.delay}%p` : '—',
    cells: cellsOf(e),
    open: () => setActBlk(e.b.no),
  }));

  /* ---------- 목록으로 / 이전·다음 ---------- */
  let nav: DashVM['nav'] = null;
  if (selE && !single) {
    const arr = listSel.length ? listSel : sel;
    const i2 = Math.max(
      0,
      arr.findIndex((e) => e.b.no === actNo),
    );
    nav = {
      backToList: () => setActBlk(null),
      hasNav: arr.length > 1,
      pos: i2 + 1,
      total: arr.length,
      prev: () => setActBlk(arr[(i2 - 1 + arr.length) % arr.length].b.no),
      next: () => setActBlk(arr[(i2 + 1) % arr.length].b.no),
    };
  }

  /* ---------- 블록 대시보드 ---------- */
  let detail: DetailVM | null = null;
  if (selE) {
    const e = selE;
    const b = e.b;
    const f = e.f;
    const allWos = wos(p, b);
    let nDone = 0;
    let nProg = 0;
    let nWait = 0;
    let nFail = 0;
    allWos.forEach((w) => {
      if (w.warn) nFail++;
      else if (w.pct >= 100) nDone++;
      else if (w.pct > 0) nProg++;
      else nWait++;
    });
    const keyinB = Math.round(rnd(b.seed, 140) * 18);
    const rm = recvMin(b);
    const rmTxt = rm < 60 ? `${rm}분 전` : `${Math.floor(rm / 60)}시간 전`;
    const goG = (extra?: { issue?: IssueKind | '' }) => () => {
      setTab('gather');
      setGBlk(b.no);
      setGIssue(extra?.issue ?? '');
    };
    const woByKind: Record<string, WoItem[]> = {};
    allWos.forEach((w) => {
      (woByKind[w.kind] = woByKind[w.kind] ?? []).push(w);
    });
    const kindRows = (k: string) => {
      const ws = woByKind[k] ?? [];
      return `${ws.filter((w) => w.pct >= 100).length} / ${ws.length}`;
    };
    const rowV = (v: string, color?: string): { v: string; color: string } => ({
      v,
      color: color ?? DARK,
    });
    const card = (
      name: string,
      val: number | null,
      unit: string,
      sub: string,
      rows: CardRowVM[],
      src: string,
      go: () => void,
      opt?: { cur?: boolean; stale?: boolean; tag?: string; st?: string },
    ): StageCardVM => {
      const o = opt ?? {};
      return {
        name,
        cur: !!o.cur,
        st: o.st ?? (val == null ? '미착수' : val >= 100 ? '완료' : '진행중'),
        stKind: val == null ? 'none' : val >= 100 ? 'done' : 'prog',
        pct: val == null ? null : String(val),
        unit: val == null ? '' : unit,
        stale: !!o.stale,
        tag: o.tag ?? '',
        sub,
        barPct: val ?? 0,
        rows,
        src,
        go,
      };
    };

    let stage = '';
    let stats: StatVM[] = [];
    let cardCols = 3;
    let stageCards: StageCardVM[] = [];
    let panelBTitle = '';
    let panelBSub = '';
    let panelBRows: DetailVM['panelBRows'] = [];
    let careDefs: [string, number, IssueKind | '', string, string, string][] = [];

    if (p === '가공') {
      const cur = fabCurIdx(f);
      stage = `현재 단계 · ${f.rates.every((r) => r >= 100) ? '가공 완료' : STAGE_NAMES[cur]}`;
      const nb = e.evB.filter((x) => x.issue === '정합성').length;
      const nf = e.evB.filter((x) => x.issue === '수집실패').length;
      stats = [
        { k: '가공 WO', v: allWos.length.toLocaleString(), color: '#23344C' },
        { k: '가공계 (5단계 평균)', v: `${Math.round(f.total)}%`, color: '#23344C' },
        { k: '수집 이벤트', v: String(e.evB.length), color: '#23344C' },
        { k: '수기(Key-In) 비중', v: `${keyinB}%`, color: keyinB > 10 ? AMBER : '#5C6678' },
        { k: '정합성 불일치', v: nb > 0 ? `${nb}건` : '—', color: nb > 0 ? RED : FAINT },
        { k: '최근 수신', v: rmTxt, color: '#5C6678' },
      ];
      const srcs = [
        '부재종합 (강재반입일)',
        '강재불출 실적',
        '절단 MES',
        '부재종합 (사상일)',
        '부재선별 (송선)',
      ];
      cardCols = 5;
      stageCards = STAGE_NAMES.map((n, i) => {
        const evS = e.evB.filter((x) => x.stage === i);
        const bad = evS.filter((x) => x.issue === '정합성').length;
        const mis = evS.filter((x) => x.issue === '수집실패').length;
        return card(
          n,
          f.rates[i] <= 0 ? null : f.rates[i],
          '%',
          '중량 기준 완료율',
          [
            { k: '수집 이벤트', ...rowV(String(evS.length)) },
            { k: '정합성 불일치', ...rowV(bad > 0 ? `${bad}건` : '—', bad > 0 ? RED : FAINT) },
            { k: 'I/F 미수신', ...rowV(mis > 0 ? `${mis}건` : '—', mis > 0 ? RED : FAINT) },
          ],
          srcs[i],
          goG(),
          { cur: i === cur },
        );
      });
      panelBTitle = '단계별 중량 진척';
      panelBSub = '강재반입 → 팔레트편성';
      panelBRows = STAGE_NAMES.map((n, i) => ({
        name: n,
        pct: f.rates[i],
        low: f.rates[i] > 0 && f.rates[i] < 40,
        v: `${f.rates[i]}%`,
        cnt: i < 2 ? '자재 단위' : `${kindRows(['절단', '사상', '팔레트 편성'][i - 2])} WO`,
      }));
      careDefs = [
        ['정합성 불일치', nb, '정합성', RED, '#FBE8E8', '#E8B4B4'],
        ['I/F 미수신', nf, '수집실패', RED, '#FBE8E8', '#E8B4B4'],
      ];
    } else if (p === '조립' || p === '의장') {
      const comp = p === '조립' ? e.a : e.o;
      const age = scanAge(b, p === '조립' ? 0 : 1);
      const stale = age > 24;
      const k = e.evB.filter((x) => x.issue === 'Key-In').length;
      stage = stale
        ? `최근 스캔 ${Math.floor(age / 24)}일 전 — 갱신 필요`
        : `최근 스캔 ${age}시간 전`;
      stats = [
        { k: `${p} WO`, v: allWos.length.toLocaleString(), color: '#23344C' },
        {
          k: p === '조립' ? '어셈블리' : '의장품 종류',
          v: p === '조립' ? String(b.asmN) : '3종',
          color: '#23344C',
        },
        { k: '수집 이벤트', v: String(e.evB.length), color: '#23344C' },
        { k: '자동수집 비중', v: `${100 - keyinB}%`, color: '#23344C' },
        { k: 'Key-In 대기', v: k > 0 ? `${k}건` : '—', color: k > 0 ? AMBER : FAINT },
        { k: '최근 수신', v: rmTxt, color: '#5C6678' },
      ];
      cardCols = 3;
      const woDonePct = Math.round((nDone / Math.max(1, allWos.length)) * 100);
      const kinds =
        p === '조립' ? ['취부', '용접', '사상'] : ['파이프 설치', '서포트 설치', '전장 설치'];
      stageCards = [
        card(
          'LiDAR 완성도',
          comp,
          '%',
          '도면 대비 완성도',
          kinds.map((kd) => ({ k: `${kd} WO`, ...rowV(kindRows(kd)) })),
          scope.srcLong,
          goG(),
          { stale, tag: stale ? '스캔 24h 초과' : '' },
        ),
        card(
          'WO 완료율',
          woDonePct,
          '%',
          `${nDone} / ${allWos.length} 완료`,
          [
            { k: '진행중', ...rowV(String(nProg)) },
            { k: '미착수', ...rowV(String(nWait), DIM) },
            { k: '수집 실패', ...rowV(nFail > 0 ? String(nFail) : '—', nFail > 0 ? RED : FAINT) },
          ],
          '하위 WO 집계',
          goG(),
        ),
        card(
          '수집 상태',
          Math.round(100 - (k / Math.max(1, e.evB.length)) * 100),
          '%',
          `인식 성공률 · 이벤트 ${e.evB.length}건`,
          [
            { k: 'Key-In 대기', ...rowV(k > 0 ? `${k}건` : '—', k > 0 ? AMBER : FAINT) },
            {
              k: '최근 스캔',
              ...rowV(age < 24 ? `${age}시간 전` : `${Math.floor(age / 24)}일 전`, stale ? STALE : DARK),
            },
            { k: '수기 비중', ...rowV(`${keyinB}%`) },
          ],
          scope.srcLong,
          goG({ issue: 'Key-In' }),
          { st: k > 0 ? '보완 필요' : '정상' },
        ),
      ];
      if (p === '조립') {
        panelBTitle = '어셈블리별 진행률';
        panelBSub = `${b.asmN}개 중 하위 7`;
        const agg: Record<string, WoItem[]> = {};
        allWos.forEach((w) => {
          (agg[w.asm] = agg[w.asm] ?? []).push(w);
        });
        panelBRows = Object.keys(agg)
          .map((an) => {
            const ws = agg[an];
            return {
              an,
              avg: Math.round(ws.reduce((s, w) => s + w.pct, 0) / ws.length),
              dn: ws.filter((w) => w.pct >= 100).length,
              n: ws.length,
            };
          })
          .sort((x, y) => x.avg - y.avg)
          .slice(0, 7)
          .map((g) => ({
            name: g.an,
            pct: g.avg,
            low: g.avg < 40,
            v: `${g.avg}%`,
            cnt: `${g.dn}/${g.n} WO`,
          }));
      } else {
        panelBTitle = '의장품 구분별 진행률';
        panelBSub = '파이프 · 서포트 · 전장';
        panelBRows = kinds.map((kd) => {
          const ws = woByKind[kd] ?? [];
          const avg = ws.length
            ? Math.round(ws.reduce((s, w) => s + w.pct, 0) / ws.length)
            : 0;
          return {
            name: kd.replace(' 설치', ''),
            pct: avg,
            low: avg < 40,
            v: `${avg}%`,
            cnt: `${ws.filter((w) => w.pct >= 100).length}/${ws.length} WO`,
          };
        });
      }
      careDefs = [
        ['Key-In 대기', k, 'Key-In', AMBER, '#FBF2DE', '#E8CB9C'],
        ['수집 실패 WO', nFail, '', RED, '#FBE8E8', '#E8B4B4'],
      ];
    } else {
      const d = e.p.done;
      const insp = e.evB.filter((x) => x.issue === '검사중').length;
      stage = `현재 스텝 · ${d === 3 ? 'FINAL 완료' : STEP_LABELS[d]}`;
      stats = [
        { k: '도장 WO', v: allWos.length.toLocaleString(), color: '#23344C' },
        { k: '완료 스텝', v: `${d} / 3`, color: '#23344C' },
        { k: '수집 이벤트', v: String(e.evB.length), color: '#23344C' },
        { k: 'i-QMS 검사중', v: insp > 0 ? `${insp}건` : '—', color: insp > 0 ? AMBER : FAINT },
        { k: '수기(Key-In) 비중', v: `${keyinB}%`, color: keyinB > 10 ? AMBER : '#5C6678' },
        { k: '최근 수신', v: rmTxt, color: '#5C6678' },
      ];
      cardCols = 3;
      stageCards = (['S/P', 'T/UP', 'FINAL'] as const).map((sp, i) => {
        const ev = e.evB.find((x) => x.step === sp);
        const done = d >= i + 1;
        const cur = d === i;
        const stTxt = done ? (ev?.issue === '검사중' ? '검사중' : '완료') : cur ? '진행중' : '미착수';
        return card(
          sp,
          done ? 100 : cur ? 50 : null,
          '%',
          done ? `스텝 완료 · ${ev?.end ?? ''}` : cur ? 'BTS 진행중' : '—',
          [
            {
              k: 'BTS 스텝 실적',
              ...rowV(done ? '완료' : cur ? '진행중' : '—', done ? GREEN : cur ? AMBER : FAINT),
            },
            {
              k: 'i-QMS 검사',
              ...rowV(
                done ? (ev?.issue === '검사중' ? '검사중' : '합격') : '—',
                done ? (ev?.issue === '검사중' ? AMBER : GREEN) : FAINT,
              ),
            },
            { k: `${sp} WO`, ...rowV(kindRows(sp)) },
          ],
          'BTS · i-QMS',
          goG(),
          { cur, st: stTxt },
        );
      });
      panelBTitle = '스텝별 WO 완료';
      panelBSub = 'S/P → T/UP → FINAL';
      panelBRows = (['S/P', 'T/UP', 'FINAL'] as const).map((sp) => {
        const ws = woByKind[sp] ?? [];
        const avg = ws.length
          ? Math.round(ws.reduce((s, w) => s + w.pct, 0) / ws.length)
          : 0;
        return {
          name: sp,
          pct: avg,
          low: false,
          v: `${avg}%`,
          cnt: `${ws.filter((w) => w.pct >= 100).length}/${ws.length} WO`,
        };
      });
      careDefs = [
        ['i-QMS 검사중', insp, '검사중', AMBER, '#FBF2DE', '#E8CB9C'],
        ['수집 실패 WO', nFail, '', RED, '#FBE8E8', '#E8B4B4'],
      ];
    }

    const tot = Math.max(1, allWos.length);
    detail = {
      ship: query.ship,
      no: b.no,
      stage,
      stats,
      ovAct: e.act,
      ovPlan: e.plan,
      ovDelay: e.delay,
      ovTier: stTier(e.delay),
      cardCols,
      stageCards,
      woN: allWos.length.toLocaleString(),
      distSegs: [
        { w: (nDone / tot) * 100, color: BAR },
        { w: (nProg / tot) * 100, color: '#A8B4C2' },
        { w: (nWait / tot) * 100, color: '#E2DDD0' },
        { w: (nFail / tot) * 100, color: RED },
      ],
      distCells: [
        { k: '완료', v: nDone.toLocaleString(), p: `${Math.round((nDone / tot) * 100)}%`, dot: BAR, color: DARK },
        { k: '진행중', v: nProg.toLocaleString(), p: `${Math.round((nProg / tot) * 100)}%`, dot: '#A8B4C2', color: '#5C6678' },
        { k: '미착수', v: nWait.toLocaleString(), p: `${Math.round((nWait / tot) * 100)}%`, dot: '#E2DDD0', color: DIM },
        { k: '수집 실패', v: nFail.toLocaleString(), p: `${Math.round((nFail / tot) * 100)}%`, dot: RED, color: nFail > 0 ? RED : FAINT },
      ],
      panelBTitle,
      panelBSub,
      panelBRows,
      recentEv: e.evB
        .filter((x) => x.end)
        .slice(-7)
        .reverse()
        .map((x) => ({ ev: `${x.ev} · ${x.key}`, t: x.end })),
      careRows: careDefs.map((c) => ({
        k: c[0],
        v: c[1] > 0 ? `${c[1]}건` : '0',
        on: c[1] > 0,
        color: c[3],
        bg: c[4],
        border: c[5],
        open: () => {
          setTab('gather');
          setGBlk(b.no);
          setGIssue(c[2]);
        },
      })),
      lowWos: allWos
        .filter((w) => !w.warn && w.pct > 0 && w.pct < 100)
        .sort((x, y) => x.pct - y.pct)
        .slice(0, 10)
        .map((w, i) => ({ rank: i + 1, wo: w.wo, name: w.name, pct: w.pct })),
      goGather: goG(),
    };
  }

  const dash: DashVM = {
    kpis,
    list: showList
      ? {
          rows: listRows,
          cols: listCols,
          chips,
          shownN: listSel.length,
          total: sel.length,
          foot: listFoot,
        }
      : null,
    nav,
    detail,
  };

  /* ---------- 수집 데이터 조회 ---------- */
  let evs = evsAll.filter((x) => blks.includes(x.blk));
  if (gBlk) evs = evs.filter((x) => x.blk === gBlk);
  if (gIssue) evs = evs.filter((x) => x.issue === gIssue);
  if (gSt === '완료') evs = evs.filter((x) => x.end && !x.warn);
  else if (gSt === '진행중') evs = evs.filter((x) => !x.end && !x.warn);
  else if (gSt === '보완') evs = evs.filter((x) => x.warn);

  const gather: GatherVM = {
    cnt: evs.length,
    hasLegacy: p === '가공',
    issueChip: gIssue
      ? { label: ISSUE_LABEL[gIssue], clear: () => setGIssue('') }
      : null,
    blkChip: gBlk ? { no: gBlk, clear: () => setGBlk('') } : null,
    stFilters: (['전체', '완료', '진행중', '보완'] as GatherStFilter[]).map((s) => ({
      label: s,
      active: gSt === s,
      select: () => setGSt(s),
    })),
    rows: evs.slice(0, 300).map((x, i, arr) => ({
      blk: x.blk,
      ev: x.ev,
      key: x.key,
      start: x.start,
      end: x.end || '—',
      st: x.warn ? '보완' : x.end ? '완료' : '진행중',
      warn: x.warn,
      note: x.note,
      src: x.src,
      newBlk: i > 0 && arr[i - 1].blk !== x.blk,
      autoPct: x.autoPct != null ? `${x.autoPct}%` : '—',
      legacy: x.ifMiss ? '미수신' : x.legacy != null ? `${x.legacy}%` : '—',
      legacyWarn: !!(x.ifMiss || x.mism),
      match: x.ifMiss ? '대조 불가' : x.mism ? '불일치' : '일치',
      matchWarn: !!(x.ifMiss || x.mism),
    })),
  };

  return { login: null, main: { ...base, dash, gather } };
}
