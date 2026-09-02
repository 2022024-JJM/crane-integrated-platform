import { useEffect, useState } from 'react';
import {
  actChangeN,
  actComplete,
  actKey,
  actModified,
  actRevert,
  actSubmittedDone,
  cloneActivity,
  frozenOrder,
  pendingOf,
  waitOf,
  woTypeOf,
} from '../lib/activity';
import { pad2, seedBlocks } from '../lib/seed';
import { KEYIN_ACTS, KEYIN_USERS } from './mock-data';
import type {
  Activity,
  BlkTab,
  BlockData,
  CardStatus,
  KeyinUser,
  MsgTone,
  WoFilter,
} from './types';

const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '←'];

export interface DemoAccountVM {
  id: string;
  desc: string;
  fill: () => void;
}

export interface LoginVM {
  loginId: string;
  loginPw: string;
  loginErr: string;
  setLoginId: (v: string) => void;
  setLoginPw: (v: string) => void;
  doLogin: () => void;
  demoAccounts: DemoAccountVM[];
}

export interface WoRowVM {
  seq: string;
  name: string;
  wo: string;
  done: boolean;
  toggle: () => void;
}

export interface CardVM {
  id: string;
  proc: Activity['proc'];
  name: string;
  actNo: string;
  status: CardStatus;
  submittedDone: boolean;
  /** 자동 인식(컨펌) 영역 */
  hasAuto: boolean;
  autoVal: string;
  autoAt: string;
  autoNote: string;
  edited: boolean;
  confirmed: boolean;
  confirmLabel: string;
  confirmAuto: () => void;
  openPad: () => void;
  /** 자동수집 없음 — 조립·의장(%) 직접 입력 */
  noAutoPct: boolean;
  failTxt: string;
  manualBtnLabel: string;
  /** 자동수집 없음 — 도장 등 스텝 안내 배너 */
  noAutoStep: boolean;
  stepNote: string;
  /** 하위 워크오더 */
  woInline: boolean;
  woHeader: string | null;
  wos: WoRowVM[];
  woSummary: boolean;
  woTotal: number;
  woDone: number;
  woWait: number;
  woTypeTxt: string;
  openWoList: () => void;
}

export interface BlockTileVM {
  no: string;
  selected: boolean;
  hasWait: boolean;
  dirty: boolean;
  select: () => void;
}

export interface BlkTabVM {
  key: BlkTab;
  label: string;
  active: boolean;
  select: () => void;
}

export interface ChipVM {
  label: string;
  active: boolean;
  select: () => void;
}

export interface ShipOptVM {
  no: string;
  selected: boolean;
  select: () => void;
}

export interface PadKeyVM {
  label: string;
  isFn: boolean;
  press: () => void;
}

export interface WoModalVM {
  title: string;
  sub: string;
  query: string;
  setQuery: (v: string) => void;
  filters: ChipVM[];
  types: ChipVM[];
  rows: WoRowVM[];
  shownN: number;
  filteredN: number;
  more: boolean;
  restN: number;
  loadMore: () => void;
  batchLabel: string | null;
  doBatch: () => void;
  close: () => void;
}

export interface PadModalVM {
  display: string;
  empty: boolean;
  keys: PadKeyVM[];
  confirm: () => void;
  close: () => void;
}

export interface MainVM {
  ship: string;
  userLabel: string;
  clock: string;
  totalWait: number;
  doLogout: () => void;
  /* 좌측 블록 패널 */
  blkTotal: number;
  blkQuery: string;
  setBlkQuery: (v: string) => void;
  blkTabs: BlkTabVM[];
  tiles: BlockTileVM[];
  blkEmptyMsg: string | null;
  /* 선택 블록 헤더 */
  blk: string;
  blkSub: string;
  lastSubStamp: string | null;
  hasRevert: boolean;
  doRevert: () => void;
  /* 카드 */
  cards: CardVM[];
  allDone: boolean;
  /* 푸터 */
  msg: string;
  msgOk: boolean;
  prevNo: string | null;
  goPrev: () => void;
  nextWaitNo: string | null;
  goNextWait: () => void;
  readyN: number;
  submitLabel: string;
  doSubmit: () => void;
  /* 모달 */
  shipOpen: boolean;
  openShip: () => void;
  closeShip: () => void;
  shipOpts: ShipOptVM[];
  wo: WoModalVM | null;
  pad: PadModalVM | null;
}

export interface KeyinVM {
  login: LoginVM;
  main: MainVM | null;
}

export function useKeyin(): KeyinVM {
  const [user, setUser] = useState<KeyinUser | null>(null);
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [loginErr, setLoginErr] = useState('');

  const [ship, setShip] = useState<string | null>(null);
  const [blk, setBlk] = useState<string | null>(null);
  const [data, setData] = useState<BlockData | null>(null);
  const [blkQuery, setBlkQueryRaw] = useState('');
  const [blkTab, setBlkTab] = useState<BlkTab>('wait');
  const [recent, setRecent] = useState<string[]>([]);
  const [lastSub, setLastSub] = useState<Record<string, string>>({});
  /** 블록 진입 시점에 고정한 카드 순서 — 입력 중 재정렬 방지 */
  const [cardOrder, setCardOrder] = useState<string[]>([]);

  const [padId, setPadId] = useState<string | null>(null);
  const [padVal, setPadVal] = useState('');
  const [woId, setWoId] = useState<string | null>(null);
  const [woQuery, setWoQuery] = useState('');
  const [woFilter, setWoFilter] = useState<WoFilter>('미완료');
  const [woType, setWoType] = useState('전체');
  const [woLimit, setWoLimit] = useState(50);
  const [shipOpen, setShipOpen] = useState(false);

  const [msg, setMsg] = useState('');
  const [msgTone, setMsgTone] = useState<MsgTone>('info');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  function loginAs(u: KeyinUser) {
    const firstShip = u.ships[0];
    const seeded = seedBlocks(u, firstShip, KEYIN_ACTS[u.proc]);
    const firstBlk = Object.keys(seeded)[0];
    setUser(u);
    setShip(firstShip);
    setData(seeded);
    setBlk(firstBlk);
    setCardOrder(frozenOrder(seeded[firstBlk] ?? []));
    setLoginErr('');
    setLoginPw('');
    setBlkQueryRaw('');
    setBlkTab('wait');
    setRecent([]);
    setLastSub({});
    setMsg(
      `${u.dept} ${u.ban} 담당 전체 액티비티가 표시됩니다 — 자동수집 값도 확인·수정 가능합니다`,
    );
    setMsgTone('info');
  }

  const login: LoginVM = {
    loginId,
    loginPw,
    loginErr,
    setLoginId: (v) => {
      setLoginId(v);
      setLoginErr('');
    },
    setLoginPw: (v) => {
      setLoginPw(v);
      setLoginErr('');
    },
    doLogin: () => {
      const id = loginId.trim();
      if (!id || !loginPw) {
        setLoginErr('사번과 비밀번호를 입력하세요');
        return;
      }
      const u = KEYIN_USERS.find((x) => x.id === id);
      if (!u || u.pw !== loginPw) {
        setLoginErr('사번 또는 비밀번호가 올바르지 않습니다');
        return;
      }
      loginAs(u);
    },
    demoAccounts: KEYIN_USERS.map((u) => ({
      id: u.id,
      desc: `${u.dept} ${u.ban} · ${u.name}${u.type === '협력사' ? ' (협력사)' : ''}`,
      fill: () => {
        setLoginId(u.id);
        setLoginPw(u.pw);
        setLoginErr('');
      },
    })),
  };

  if (!user || !data || !ship || !blk) return { login, main: null };

  function upd(id: string, fn: (it: Activity) => Activity) {
    setData((prev) => {
      if (!prev) return prev;
      const d: BlockData = {};
      Object.keys(prev).forEach((k) => {
        d[k] = prev[k].map((it) => (it.id === id ? fn(cloneActivity(it)) : it));
      });
      return d;
    });
    setMsg('');
  }

  const list = data[blk] ?? [];

  let totalWait = 0;
  Object.keys(data).forEach((k) => (totalWait += waitOf(data[k])));
  let readyN = 0;
  Object.keys(data).forEach((k) =>
    data[k].forEach((it) => {
      if (actModified(it)) readyN += actChangeN(it);
    }),
  );

  const allNos = Object.keys(data);
  let shownNos = allNos;
  if (blkQuery) shownNos = shownNos.filter((no) => no.includes(blkQuery));
  shownNos = shownNos.slice().sort((a, b) => Number(a) - Number(b));

  const selectBlk = (no: string) => {
    if (no === blk) return;
    setBlk(no);
    setMsg('');
    setRecent((r) => [no, ...r.filter((x) => x !== no)].slice(0, 3));
    setCardOrder(frozenOrder(data[no] ?? []));
  };

  const waitNos = shownNos.filter(
    (no) => data[no].length === 0 || waitOf(data[no]) > 0,
  );
  const doneNos = shownNos.filter(
    (no) => data[no].length > 0 && waitOf(data[no]) === 0,
  );
  const tabNos = blkTab === 'wait' ? waitNos : doneNos;
  const tiles: BlockTileVM[] = tabNos.map((no) => ({
    no,
    selected: no === blk,
    hasWait: waitOf(data[no]) > 0,
    dirty: pendingOf(data[no]) > 0,
    select: () => selectBlk(no),
  }));
  const blkTabs: BlkTabVM[] = (
    [
      ['wait', '미확인', waitNos.length],
      ['done', '완료', doneNos.length],
    ] as [BlkTab, string, number][]
  ).map(([key, name, n]) => ({
    key,
    label: `${name} ${n}`,
    active: blkTab === key,
    select: () => setBlkTab(key),
  }));

  // 이전 방문 블록 = 방문 이력 중 현재 블록 바로 앞 항목
  const prevBlk = recent.filter((no) => data[no] && no !== blk)[0] ?? null;
  const nextWaitCandidates = allNos
    .filter((no) => no !== blk && waitOf(data[no]) > 0)
    .sort((a, b) => Number(a) - Number(b));
  const nextWaitNo =
    nextWaitCandidates.find((no) => Number(no) > Number(blk)) ??
    nextWaitCandidates[0] ??
    null;

  // 블록 진입 시점의 고정 순서 + 그 이후 생긴 항목은 뒤에
  const sorted = cardOrder
    .map((id) => list.find((x) => x.id === id))
    .filter((x): x is Activity => !!x)
    .concat(list.filter((x) => !cardOrder.includes(x.id)));

  const cards: CardVM[] = sorted.map((it) => {
    const modified = actModified(it);
    const submittedDone = !!it.sub && !modified && it.sub.done;
    const doneN = it.wos.filter((w) => w.done).length;
    const pctProc = it.proc === '조립' || it.proc === '의장';
    const status: CardStatus = modified
      ? 'typed'
      : it.sub
        ? it.sub.done
          ? 'fixed'
          : 'fixedPart'
        : it.auto != null
          ? 'auto'
          : 'none';
    const shownVal = it.edited != null ? it.edited : it.auto;
    const typeAgg: Record<string, [number, number]> = {};
    it.wos.forEach((w) => {
      const t = woTypeOf(w.name);
      typeAgg[t] = typeAgg[t] ?? [0, 0];
      typeAgg[t][1]++;
      if (w.done) typeAgg[t][0]++;
    });
    return {
      id: it.id,
      proc: it.proc,
      name: it.name,
      actNo: it.actNo,
      status,
      submittedDone,
      hasAuto: it.auto != null,
      autoVal: shownVal == null ? '—' : String(shownVal),
      autoAt: it.autoAt,
      autoNote: pctProc
        ? '완성도 = 도면 대비 LiDAR 인식률 — WO 완료 수와 기준이 다를 수 있습니다'
        : '',
      edited: it.edited != null,
      confirmed: it.confirmed,
      confirmLabel: it.confirmed
        ? '✓ 확인됨'
        : it.edited != null
          ? '수정값 반영'
          : '값 확인',
      confirmAuto: () =>
        upd(it.id, (x) =>
          Object.assign(x, {
            confirmed: !x.confirmed && x.edited == null ? true : false,
            edited: null,
          }),
        ),
      openPad: () => {
        setPadId(it.id);
        setPadVal(shownVal == null ? '' : String(shownVal));
      },
      noAutoPct: it.auto == null && pctProc,
      failTxt: it.fail,
      manualBtnLabel: it.edited != null ? '✓ 입력됨 · 수정' : '실적률 입력',
      noAutoStep: it.auto == null && !pctProc && it.proc !== '가공',
      stepNote:
        it.proc === '도장'
          ? 'BTS 미전송 — 아래 스텝(S/P → T/UP → FINAL)을 순서대로 완료 확인하세요'
          : '레거시 I/F 미수신 — 아래 작업의 완료를 직접 확인 입력하세요',
      woInline: it.wos.length <= 6,
      woHeader:
        it.proc === '가공'
          ? null
          : it.proc === '도장'
            ? '도장 스텝 · 완료 확인 (S/P → T/UP → FINAL 순서)'
            : '하위 워크오더 · 완료만 입력 (자동수신 완료분 포함, 수정 가능)',
      wos:
        it.wos.length <= 6
          ? it.wos.map((w, wi) => ({
              seq: String(wi + 1),
              name: w.name,
              wo: w.wo,
              done: w.done,
              toggle: () =>
                upd(it.id, (x) => {
                  x.wos[wi].done = !x.wos[wi].done;
                  return x;
                }),
            }))
          : [],
      woSummary: it.wos.length > 6,
      woTotal: it.wos.length,
      woDone: doneN,
      woWait: it.wos.length - doneN,
      woTypeTxt: Object.keys(typeAgg)
        .map((t) => `${t} ${typeAgg[t][0]}/${typeAgg[t][1]}`)
        .join(' · '),
      openWoList: () => {
        setWoId(it.id);
        setWoQuery('');
        setWoFilter('미완료');
        setWoType('전체');
        setWoLimit(50);
      },
    };
  });

  // ---------- WO 목록 드릴다운 ----------
  const woItem = woId ? (list.find((x) => x.id === woId) ?? null) : null;
  let wo: WoModalVM | null = null;
  if (woItem) {
    const tAgg: Record<string, [number, number]> = {};
    woItem.wos.forEach((w) => {
      const t = woTypeOf(w.name);
      tAgg[t] = tAgg[t] ?? [0, 0];
      tAgg[t][1]++;
      if (w.done) tAgg[t][0]++;
    });
    const types: ChipVM[] = [
      {
        t: '전체',
        cnt: `${woItem.wos.filter((w) => w.done).length}/${woItem.wos.length}`,
      },
      ...Object.keys(tAgg).map((t) => ({
        t,
        cnt: `${tAgg[t][0]}/${tAgg[t][1]}`,
      })),
    ].map((g) => ({
      label: `${g.t} ${g.cnt}`,
      active: woType === g.t,
      select: () => {
        setWoType(g.t);
        setWoLimit(50);
      },
    }));
    let idxs = woItem.wos.map((_, i) => i);
    if (woType !== '전체')
      idxs = idxs.filter((i) => woTypeOf(woItem.wos[i].name) === woType);
    if (woQuery)
      idxs = idxs.filter((i) => {
        const w = woItem.wos[i];
        return w.name.includes(woQuery) || w.wo.includes(woQuery);
      });
    if (woFilter === '미완료') idxs = idxs.filter((i) => !woItem.wos[i].done);
    if (woFilter === '완료') idxs = idxs.filter((i) => woItem.wos[i].done);
    const undoneIdxs = idxs.filter((i) => !woItem.wos[i].done);
    const shown = idxs.slice(0, woLimit);
    wo = {
      title: `${woItem.name} — 하위 워크오더`,
      sub: `블록 ${blk} · ${woItem.actNo} · 완료 ${woItem.wos.filter((w) => w.done).length}/${woItem.wos.length}`,
      query: woQuery,
      setQuery: (v) => {
        setWoQuery(v);
        setWoLimit(50);
      },
      filters: (['미완료', '완료', '전체'] as WoFilter[]).map((f) => ({
        label: f,
        active: woFilter === f,
        select: () => {
          setWoFilter(f);
          setWoLimit(50);
        },
      })),
      types,
      rows: shown.map((i) => {
        const w = woItem.wos[i];
        return {
          seq: String(i + 1),
          name: w.name,
          wo: w.wo,
          done: w.done,
          toggle: () =>
            upd(woItem.id, (x) => {
              x.wos[i].done = !x.wos[i].done;
              return x;
            }),
        };
      }),
      shownN: shown.length,
      filteredN: idxs.length,
      more: idxs.length > woLimit,
      restN: idxs.length - woLimit,
      loadMore: () => setWoLimit((v) => v + 50),
      batchLabel:
        undoneIdxs.length > 0
          ? `표시된 미완료 ${undoneIdxs.length}건 일괄 완료`
          : null,
      doBatch: () =>
        upd(woItem.id, (x) => {
          undoneIdxs.forEach((i) => {
            x.wos[i].done = true;
          });
          return x;
        }),
      close: () => {
        setWoId(null);
        setWoQuery('');
      },
    };
  }

  // ---------- 완성도 수정 넘패드 ----------
  let pad: PadModalVM | null = null;
  if (padId) {
    pad = {
      display: padVal === '' ? '—' : padVal,
      empty: padVal === '',
      keys: PAD_KEYS.map((k) => ({
        label: k,
        isFn: k === 'C' || k === '←',
        press: () =>
          setPadVal((v) => {
            if (k === 'C') return '';
            if (k === '←') return v.slice(0, -1);
            const nv = (v + k).replace(/^0+(?=\d)/, '');
            return Number(nv) > 100 ? '100' : nv.slice(0, 3);
          }),
      })),
      confirm: () => {
        if (padVal === '') {
          setPadId(null);
          return;
        }
        const v = Number(padVal);
        upd(padId, (x) => Object.assign(x, { edited: v, confirmed: false }));
        setPadId(null);
        setPadVal('');
      },
      close: () => {
        setPadId(null);
        setPadVal('');
      },
    };
  }

  const doSubmit = () => {
    if (readyN === 0) return;
    const stamp = `${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    const nextLastSub = { ...lastSub };
    const d: BlockData = {};
    let n = 0;
    Object.keys(data).forEach((k) => {
      d[k] = data[k].map((it) => {
        if (!actModified(it)) return it;
        n += actChangeN(it);
        nextLastSub[k] = stamp;
        return { ...it, sub: { done: actComplete(it), key: actKey(it) } };
      });
    });
    const curDone =
      (d[blk] ?? []).length > 0 && (d[blk] ?? []).every(actSubmittedDone);
    const wasDone = list.length > 0 && list.every(actSubmittedDone);
    const mv =
      curDone && !wasDone
        ? ` · 블록 ${blk} → 완료 탭으로 이동`
        : !curDone && wasDone
          ? ` · 블록 ${blk} → 미확인 탭으로 이동`
          : '';
    setData(d);
    setLastSub(nextLastSub);
    setMsg(
      `${n}건 제출했습니다 — 통합 조회 화면에 수기(Key-In)로 반영됩니다${mv}`,
    );
    setMsgTone('ok');
  };

  const doRevert = () => {
    if (pendingOf(list) === 0) return;
    let n = 0;
    list.forEach((it) => {
      if (actModified(it)) n += actChangeN(it);
    });
    setData({
      ...data,
      [blk]: list.map((it) => (actModified(it) ? actRevert(it) : it)),
    });
    setPadId(null);
    setWoId(null);
    setMsg(
      `블록 ${blk} 수정 ${n}건을 취소했습니다 — 마지막 제출 상태로 되돌렸습니다`,
    );
    setMsgTone('info');
  };

  const main: MainVM = {
    ship,
    userLabel: `${user.dept} ${user.ban} · ${user.name}${user.type === '협력사' ? ' (협력사)' : ''}`,
    clock: `${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
    totalWait,
    doLogout: () => {
      setUser(null);
      setData(null);
      setShip(null);
      setBlk(null);
      setPadId(null);
      setWoId(null);
      setMsg('');
      setLoginId('');
      setLoginPw('');
      setLoginErr('');
    },
    blkTotal: allNos.length,
    blkQuery,
    setBlkQuery: (v) => setBlkQueryRaw(v.replace(/[^0-9]/g, '')),
    blkTabs,
    tiles,
    blkEmptyMsg:
      tiles.length === 0
        ? blkQuery
          ? '조건에 맞는 블록 없음'
          : blkTab === 'wait'
            ? '미확인 블록이 없습니다'
            : '완료된 블록이 없습니다'
        : null,
    blk,
    blkSub: `${list.length}개 액티비티 · 미확인 ${waitOf(list)}건`,
    lastSubStamp: lastSub[blk] ?? null,
    hasRevert: pendingOf(list) > 0,
    doRevert,
    cards,
    allDone: list.length === 0,
    msg:
      msg ||
      (readyN > 0
        ? `${readyN}건 제출 준비됨`
        : '전체 목록 표시 — 자동수집 값 확인, 놓친 실적 수정·입력'),
    msgOk: msgTone === 'ok',
    prevNo: prevBlk,
    goPrev: () => {
      if (prevBlk) selectBlk(prevBlk);
    },
    nextWaitNo,
    goNextWait: () => {
      if (nextWaitNo) selectBlk(nextWaitNo);
    },
    readyN,
    submitLabel: readyN > 0 ? `제출 (${readyN}건)` : '제출',
    doSubmit,
    shipOpen,
    openShip: () => setShipOpen(true),
    closeShip: () => setShipOpen(false),
    shipOpts: user.ships.map((no) => ({
      no,
      selected: no === ship,
      select: () => {
        const seeded = seedBlocks(user, no, KEYIN_ACTS[user.proc]);
        const firstBlk = Object.keys(seeded)[0];
        setShip(no);
        setData(seeded);
        setBlk(firstBlk);
        setCardOrder(frozenOrder(seeded[firstBlk] ?? []));
        setMsg('');
        setPadId(null);
        setWoId(null);
        setShipOpen(false);
        setBlkQueryRaw('');
        setBlkTab('wait');
        setRecent([]);
        setLastSub({});
      },
    })),
    wo,
    pad,
  };

  return { login, main };
}
