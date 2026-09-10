import type { DemoUser, GatherProc, IssueKind, ScopeInfo } from './types';

/** 테스트 계정 — 부서 권역에 따라 대시보드 구성이 달라진다 */
export const USERS: DemoUser[] = [
  {
    id: '20231001',
    pw: '1234',
    name: '김현수',
    type: '직영',
    dept: '가공1부',
    ban: '1반',
    proc: '가공',
    ships: ['7004', '7005'],
  },
  {
    id: '20231002',
    pw: '1234',
    name: '박지훈',
    type: '직영',
    dept: '조립2부',
    ban: '3반',
    proc: '조립',
    ships: ['7004', '5019'],
  },
  {
    id: '20231003',
    pw: '1234',
    name: '이서연',
    type: '직영',
    dept: '의장부',
    ban: '2반',
    proc: '의장',
    ships: ['7005', '8101'],
  },
  {
    id: '90031001',
    pw: '1234',
    name: '최민석',
    type: '협력사',
    dept: '도장부(협력 대성기업)',
    ban: 'A조',
    proc: '도장',
    ships: ['7004'],
  },
];

export const SHIPS: Record<string, string> = {
  '7004': '7004호 (LNGC)',
  '7005': '7005호 (LNGC)',
  '5019': '5019호 (VLCC)',
  '8101': '8101호 (LPGC)',
};

export const SCOPES: Record<GatherProc, ScopeInfo> = {
  가공: {
    src: '레거시 I/F',
    srcLong: '절단 MES · 부재종합 · 부재선별',
    hint: '가공 권역 — 강재반입 → 불출 → 절단 → 사상 → 팔레트편성 5단계 중량률 · 정합성 · I/F 미수신',
  },
  조립: {
    src: 'LiDAR · Vision',
    srcLong: 'LiDAR · Vision AI',
    hint: '조립 권역 — LiDAR 도면 대비 완성도 · 어셈블리 진행 · 스캔 신선도 · Key-In 대기',
  },
  의장: {
    src: 'LiDAR',
    srcLong: 'LiDAR (RFID 미적용)',
    hint: '의장 권역 — LiDAR 의장품 설치 인식 · 파이프/전장/서포트 구분 · Key-In 대기',
  },
  도장: {
    src: 'BTS · i-QMS',
    srcLong: 'BTS 스텝 실적 · i-QMS 검사',
    hint: '도장 권역 — S/P → T/UP → FINAL 스텝 실적 · i-QMS 검사 결과',
  },
};

export const ISSUE_LABEL: Record<IssueKind, string> = {
  정합성: '정합성 불일치',
  'Key-In': 'Key-In 대기',
  수집실패: 'I/F 미수신',
  검사중: 'i-QMS 검사중',
};

/** 가공 5단계 이름 */
export const STAGE_NAMES = ['강재반입', '불출', '절단', '사상', '팔레트'];
