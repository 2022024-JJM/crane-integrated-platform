import type { ActDef, KeyinProc, KeyinUser } from './types';

/** 테스트 계정 (프로토타입) — MES 계정 대용 */
export const KEYIN_USERS: KeyinUser[] = [
  {
    id: '20231001',
    pw: '1234',
    name: '김현수',
    type: '직영',
    dept: '가공1부',
    ban: '1반',
    proc: '가공',
    ships: ['7004', '7005'],
    blkOff: 0,
  },
  {
    id: '20231002',
    pw: '1234',
    name: '박지훈',
    type: '직영',
    dept: '조립2부',
    ban: '3반',
    proc: '조립',
    ships: ['7004', '6064'],
    blkOff: 1,
  },
  {
    id: '20231003',
    pw: '1234',
    name: '이서연',
    type: '직영',
    dept: '의장부',
    ban: '2반',
    proc: '의장',
    ships: ['7005'],
    blkOff: 2,
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
    blkOff: 0,
  },
];

/**
 * 액티비티 정의 — 관리는 액티비티, 하위 WO 표시. 입력은 '완료'만.
 * 가공 5단계는 대시보드 가공계(중량가중) 산출 단계와 1:1 정합.
 */
export const KEYIN_ACTS: Record<KeyinProc, ActDef[]> = {
  가공: [
    {
      name: '강재반입',
      auto: false,
      wos: ['자재 입고', '적치 확정'],
      fail: '부재종합 반입일 미수신',
    },
    {
      name: '강재불출',
      auto: false,
      wos: ['전처리장 불출'],
      fail: 'ProSSYS 불출 실적 미수신',
    },
    {
      name: '절단',
      auto: false,
      wos: ['마킹', '절단'],
      fail: '절단 MES 완료 플래그 미수신',
    },
    {
      name: '사상',
      auto: false,
      wos: ['사상(그라인딩)', '모듬상태 확인'],
      fail: '부재종합 사상일 미수신',
    },
    {
      name: '팔레트 편성',
      auto: false,
      wos: ['부재 선별', '팔레트 적치'],
      fail: '모듬번호 미부여',
    },
  ],
  조립: [
    {
      name: '소조립 (취부·용접·사상)',
      auto: true,
      wos: ['취부', '용접', '사상'],
      many: 120,
    },
    {
      name: '대조립 (취부·용접·사상)',
      auto: true,
      wos: ['취부', '용접', '사상'],
      many: 180,
    },
  ],
  의장: [
    {
      name: '선행의장 설치',
      auto: true,
      wos: ['파이프', '서포트', '전장 케이블'],
      many: 60,
    },
  ],
  도장: [
    {
      name: '도장 스텝',
      auto: false,
      wos: ['S/P', 'T/UP', 'FINAL'],
      fail: 'BTS 실적 미전송',
    },
  ],
};
