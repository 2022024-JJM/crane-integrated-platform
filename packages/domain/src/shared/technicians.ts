import type { PerformerType } from '../inspection/model/types';

export interface Technician {
  id: string;
  name: string;
  performerType: PerformerType;
}

// 정비/점검 mock 데이터에 등장하는 인력 풀 — 티켓 폼 담당자 선택지의 단일 소스.
const technicians: Technician[] = [
  { id: 'tech-01', name: '조범희', performerType: 'internal' },
  { id: 'tech-02', name: '정종민', performerType: 'internal' },
  { id: 'tech-03', name: '박순영', performerType: 'internal' },
  { id: 'tech-04', name: '이태훈', performerType: 'internal' },
  { id: 'tech-05', name: 'Siemens Service', performerType: 'third_party' },
  { id: 'tech-06', name: 'SICME Service', performerType: 'third_party' },
  { id: 'tech-07', name: 'M&S Corp.', performerType: 'third_party' },
  { id: 'tech-08', name: 'PHL Dock Service', performerType: 'local' },
];

export function getTechnicians(): Technician[] {
  return technicians;
}

export function getTechniciansByPerformerType(type: PerformerType): Technician[] {
  return technicians.filter((t) => t.performerType === type);
}
