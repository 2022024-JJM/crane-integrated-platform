import type {
  OperationInfoCard,
  OperationStatusCard,
} from '@/entities/monitoring/operation/model/types';

export const OPERATION_INFO_CARDS = [
  ['도크명', '1도크 / Indoor Storage'],
  ['활성 장비', 'OHC 4기, Bay Lift 2기'],
  ['현재 작업', '창고 반입 · 베이 이송'],
  ['작업 구간', '1Bay ~ 3Bay / 조립 5공장'],
] satisfies readonly OperationInfoCard[];

export const OPERATION_INFO_NOTES = [
  '1Bay 반입 라인 우선순위 상향',
  'OHC-14는 점검 모드 유지',
  'BL-01 자재 이송 사이클 정상',
  '3Bay 상부 센서 응답 0.6s',
] as const;

export const OPERATION_STATUS_CARDS = [
  ['총 운행 장비', '9', 'neutral'],
  ['정상 장비', '6', 'ok'],
  ['주의 장비', '2', 'danger'],
  ['점검 장비', '1', 'danger'],
] satisfies readonly OperationStatusCard[];

export const OPERATION_STATUS_SUMMARY = [
  '정상 장비 비율 66%',
  '주의 레벨 2건 유지',
  '점검 장비 1건 대응 중',
  '평균 베이 이송 응답 0.74s',
] as const;
