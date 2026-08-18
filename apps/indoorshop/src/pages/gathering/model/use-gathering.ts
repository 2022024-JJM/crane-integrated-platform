import { useEffect, useMemo, useState } from 'react';
import { gather, SHIP_TYPES, STAGE_KEY_LABEL } from './mock-data';
import type { GatherQuery, GatherRow } from './types';

const REFRESH_SEC = 5;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function useGathering() {
  const [fShip, setFShip] = useState('');
  const [fBlock, setFBlock] = useState('');
  const [fStep, setFStep] = useState('전체');
  const [query, setQuery] = useState<GatherQuery | null>(null);
  const [drill, setDrill] = useState<number | null>(null);
  const [auto, setAuto] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());

  useEffect(() => {
    if (!auto) return;
    const tick = setInterval(() => {
      setNow(Date.now());
      setUpdatedAt(Date.now());
    }, REFRESH_SEC * 1000);
    return () => clearInterval(tick);
  }, [auto]);

  const rows: GatherRow[] = useMemo(() => {
    if (!query) return [];
    const all = gather(query);
    return query.step && query.step !== '전체'
      ? all.filter((g) => g.proc === query.step)
      : all;
  }, [query]);

  const drillDetail =
    drill != null && rows[drill] ? rows[drill].detail : null;

  const nowDate = new Date(now);
  const upDate = new Date(updatedAt);

  function doSearch() {
    if (!fShip) return;
    setQuery({ ship: fShip, block: fBlock.trim(), step: fStep });
    setDrill(null);
    setUpdatedAt(Date.now());
  }

  function doReset() {
    setFShip('');
    setFBlock('');
    setFStep('전체');
    setQuery(null);
    setDrill(null);
  }

  /** 조회 결과를 엑셀(html table) 파일로 내려받는다 — 시연용 단순 내보내기 */
  function doExport() {
    if (!query || rows.length === 0) return;
    const header = [
      '호선',
      '블록',
      '공정',
      '단계',
      '세부 단계',
      '작업시작일시',
      '작업완료일시',
      '대상번호 (추적객체)',
      '추적 단위',
      '비고',
    ];
    const body = rows.map((g) => [
      g.ship,
      g.blk,
      g.proc,
      g.stage,
      g.sub,
      g.start || '—',
      g.end || '—',
      g.key,
      STAGE_KEY_LABEL[g.stage],
      g.note || '—',
    ]);
    const table =
      '<table>' +
      [header, ...body]
        .map((r) => '<tr>' + r.map((c) => `<td>${c}</td>`).join('') + '</tr>')
        .join('') +
      '</table>';
    const fname = `${query.ship}호_${query.block || '전체'}_수집종합현황`;
    const blob = new Blob(
      [
        '﻿<html><head><meta charset="utf-8"></head><body>' +
          table +
          '</body></html>',
      ],
      { type: 'application/vnd.ms-excel' },
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${fname}.xls`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return {
    fShip,
    fBlock,
    fStep,
    setFShip,
    setFBlock,
    setFStep,
    query,
    rows,
    drill,
    setDrill,
    drillDetail,
    auto,
    toggleAuto: () => setAuto((v) => !v),
    refreshSec: REFRESH_SEC,
    dateStr: `${nowDate.getFullYear()}-${pad(nowDate.getMonth() + 1)}-${pad(nowDate.getDate())}`,
    timeStr: `${pad(nowDate.getHours())}:${pad(nowDate.getMinutes())}`,
    updStr: `${pad(upDate.getHours())}:${pad(upDate.getMinutes())}:${pad(upDate.getSeconds())}`,
    shipLabel: query
      ? `${query.ship}호 (${SHIP_TYPES[query.ship] ?? ''})`
      : '',
    doSearch,
    doReset,
    doExport,
  };
}
