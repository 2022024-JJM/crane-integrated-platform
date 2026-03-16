import type {
  OperationInfoCard,
  OperationStatusCard,
} from '@/entities/monitoring/operation/model/types';

export const INDOOR_OPERATION_INFO_CARDS = [
  ['도크명', '1도크 / Indoor Storage'],
  ['활성 장비', 'OHC 4기, Bay Lift 2기'],
  ['현재 작업', '창고 반입 · 베이 이송'],
  ['작업 구간', '1Bay ~ 3Bay / 조립 5공장'],
] satisfies readonly OperationInfoCard[];

export const OUTDOOR_OPERATION_INFO_CARDS = [
  ['도크명', '2도크 / Busan New Port'],
  ['활성 장비', 'Gantry 1, TC 6, TTC 5'],
  ['현재 작업', '컨테이너 이송 / 선석 적재'],
  ['작업 구간', 'Berth A-03 ~ Yard B-12'],
] satisfies readonly OperationInfoCard[];

export const INDOOR_OPERATION_INFO_NOTES = [
  '1Bay 반입 라인 우선순위 상향',
  'OHC-14는 점검 모드 유지',
  'BL-01 자재 이송 사이클 정상',
  '3Bay 상부 센서 응답 0.6s',
] as const;

export const OUTDOOR_OPERATION_INFO_NOTES = [
  '선석 A-03 작업 우선순위 상향',
  'TTC-20은 점검 모드 유지',
  'GC-4 호이스트 응답 정상',
  'Berth 라인 풍속 5.1m/s',
] as const;

export const INDOOR_OPERATION_STATUS_CARDS = [
  ['총 운행 장비', '9', 'neutral'],
  ['정상 장비', '6', 'ok'],
  ['주의 장비', '2', 'danger'],
  ['점검 장비', '1', 'danger'],
] satisfies readonly OperationStatusCard[];

export const OUTDOOR_OPERATION_STATUS_CARDS = [
  ['총 운행 장비', '12', 'neutral'],
  ['정상 장비', '9', 'ok'],
  ['주의 장비', '2', 'danger'],
  ['점검 장비', '1', 'danger'],
] satisfies readonly OperationStatusCard[];

export const INDOOR_OPERATION_STATUS_SUMMARY = [
  '정상 장비 비율 66%',
  '주의 레벨 2건 유지',
  '점검 장비 1건 대응 중',
  '평균 베이 이송 응답 0.74s',
] as const;

export const OUTDOOR_OPERATION_STATUS_SUMMARY = [
  '정상 장비 비율 75%',
  '주의 레벨 2건 유지',
  '점검 장비 1건 대응 중',
  '평균 이동 응답 0.82s',
] as const;
