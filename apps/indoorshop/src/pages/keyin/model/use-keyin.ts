import { useEffect, useRef, useState } from 'react';
import { blocked, entered, pad2, seedAll } from './mock-data';
import type { KeyinData, KeyinItem, KeyinStatus } from './types';

export type MsgTone = 'ok' | 'warn' | 'info';

export function useKeyin() {
  const [ship, setShipRaw] = useState('7004');
  const [blk, setBlkRaw] = useState('101');
  const [data, setData] = useState<KeyinData>(() => seedAll('7004'));
  const [padId, setPadId] = useState<string | null>(null);
  const [padVal, setPadVal] = useState('');
  const [holdPct, setHoldPct] = useState(0);
  const [msg, setMsg] = useState(
    '조립·의장은 완성도(%), 가공·도장은 완료 확인으로 입력합니다',
  );
  const [msgTone, setMsgTone] = useState<MsgTone>('info');
  const [shipOpen, setShipOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdPctRef = useRef(0);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => {
      clearInterval(t);
      if (holdTimer.current) clearInterval(holdTimer.current);
    };
  }, []);

  function upd(id: string, fn: (it: KeyinItem) => KeyinItem) {
    setData((d) => {
      const next: KeyinData = {};
      Object.keys(d).forEach((k) => {
        next[k] = d[k].map((it) => (it.id === id ? fn({ ...it }) : it));
      });
      return next;
    });
    setMsg('');
  }

  /** 입력 후 상태 갱신 — 확정 건은 유지 */
  function mark(it: KeyinItem): KeyinItem {
    if (it.status !== 'fixed')
      it.status = (entered(it) ? 'typed' : 'none') as KeyinStatus;
    return it;
  }

  const list = data[blk] ?? [];

  const waitOf = (arr: KeyinItem[]) =>
    arr.filter((it) => it.status !== 'fixed' && !entered(it)).length;

  let totalWait = 0;
  Object.keys(data).forEach((k) => (totalWait += waitOf(data[k])));

  let readyN = 0;
  Object.keys(data).forEach((k) =>
    data[k].forEach((it) => {
      if (it.status !== 'fixed' && entered(it) && !blocked(it)) readyN++;
    }),
  );

  function setShip(no: string) {
    setShipRaw(no);
    setData(seedAll(no));
    setBlkRaw('101');
    setMsg('');
    setPadId(null);
    setShipOpen(false);
  }

  function setBlk(no: string) {
    setBlkRaw(no);
    setMsg('');
  }

  function openPad(it: KeyinItem) {
    if (it.status === 'fixed') return;
    setPadId(it.id);
    setPadVal(
      it.kind === 'pct'
        ? it.val == null
          ? ''
          : String(it.val)
        : it.cnt == null
          ? ''
          : String(it.cnt),
    );
  }

  const padItem = padId ? (list.find((x) => x.id === padId) ?? null) : null;
  const padMax = padItem
    ? padItem.kind === 'count'
      ? (padItem.total ?? 100)
      : 100
    : 100;

  function padPress(k: string) {
    setPadVal((v) => {
      if (k === 'C') return '';
      if (k === '←') return v.slice(0, -1);
      const nv = (v + k).replace(/^0+(?=\d)/, '');
      return Number(nv) > padMax ? String(padMax) : nv.slice(0, 3);
    });
  }

  function padConfirm() {
    if (padItem) {
      const v = padVal === '' ? null : Number(padVal);
      upd(padItem.id, (x) =>
        mark(
          Object.assign(x, padItem.kind === 'count' ? { cnt: v } : { val: v }),
        ),
      );
    }
    setPadId(null);
  }

  function doDraft() {
    let n = 0;
    setData((d) => {
      const next: KeyinData = {};
      Object.keys(d).forEach((k) => {
        next[k] = d[k].map((it) => {
          if (it.status !== 'fixed' && entered(it)) {
            n++;
            return { ...it, status: 'draft' as KeyinStatus };
          }
          return it;
        });
      });
      return next;
    });
    setMsg(
      n
        ? `${n}건 임시저장했습니다 — 나중에 이어서 입력할 수 있습니다`
        : '입력한 값이 없습니다',
    );
    setMsgTone(n ? 'info' : 'warn');
  }

  function finishSubmit() {
    let n = 0;
    setData((d) => {
      const next: KeyinData = {};
      Object.keys(d).forEach((k) => {
        next[k] = d[k].map((it) => {
          if (it.status === 'fixed' || !entered(it) || blocked(it)) return it;
          n++;
          return { ...it, status: 'fixed' as KeyinStatus };
        });
      });
      return next;
    });
    setHoldPct(0);
    holdPctRef.current = 0;
    setMsg(`${n}건 확정 제출했습니다 — 조회 화면에 수기(Key-In)로 반영됩니다`);
    setMsgTone('ok');
  }

  /** 오제출 방지 — 길게 누르고 있어야 제출 (약 1.2초) */
  function holdStart() {
    let miss = 0;
    Object.keys(data).forEach((k) =>
      data[k].forEach((it) => {
        if (it.status !== 'fixed' && blocked(it)) miss++;
      }),
    );
    if (miss) {
      setMsg(
        `직전 자동값과 15%p 이상 차이 나는 ${miss}건은 사유를 선택해야 제출됩니다`,
      );
      setMsgTone('warn');
      return;
    }
    if (!readyN) {
      setMsg('제출할 입력값이 없습니다');
      setMsgTone('warn');
      return;
    }
    if (holdTimer.current) clearInterval(holdTimer.current);
    holdTimer.current = setInterval(() => {
      const p = holdPctRef.current + 4.2;
      if (p >= 100) {
        if (holdTimer.current) clearInterval(holdTimer.current);
        finishSubmit();
      } else {
        holdPctRef.current = p;
        setHoldPct(p);
      }
    }, 50);
  }

  function holdEnd() {
    if (holdTimer.current) clearInterval(holdTimer.current);
    if (holdPctRef.current > 0 && holdPctRef.current < 100) {
      holdPctRef.current = 0;
      setHoldPct(0);
      setMsg('끝까지 누르고 있어야 제출됩니다');
      setMsgTone('info');
    }
  }

  return {
    ship,
    setShip,
    blk,
    setBlk,
    data,
    list,
    waitOf,
    totalWait,
    readyN,
    upd,
    mark,
    padItem,
    padVal,
    openPad,
    padPress,
    padConfirm,
    closePad: () => setPadId(null),
    shipOpen,
    setShipOpen,
    holdPct,
    holdStart,
    holdEnd,
    doDraft,
    msg,
    msgTone,
    clock: `${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
  };
}
