import type { RepairTicketDraft } from './use-create-repair-ticket';

/**
 * 자주 발생하는 수리 유형 템플릿 — 클릭 한 번으로 폼 대부분을 채운다.
 * 라벨/설명 텍스트는 i18n에 위임한다 (ticket:templates.{id}.label / .desc).
 * componentName은 HPSI BOM 클러스터의 실품목 표기를 따른다.
 */
export interface RepairTemplate {
  id: string;
  labelKey: string;
  descKey: string;
  componentName: string;
  draft: Partial<
    Pick<
      RepairTicketDraft,
      'failureType' | 'repairLevel' | 'sourceType' | 'priority' | 'performerType'
    >
  >;
}

export const REPAIR_TEMPLATES: RepairTemplate[] = [
  {
    id: 'hoistBrake',
    labelKey: 'templates.hoistBrake.label',
    descKey: 'templates.hoistBrake.desc',
    componentName: 'Hoist Brake',
    draft: { failureType: 'mechanical', repairLevel: 'minor', sourceType: 'preventive' },
  },
  {
    id: 'wireRope',
    labelKey: 'templates.wireRope.label',
    descKey: 'templates.wireRope.desc',
    componentName: 'Wire Rope',
    draft: { failureType: 'mechanical', repairLevel: 'major', sourceType: 'preventive' },
  },
  {
    id: 'dcmFan',
    labelKey: 'templates.dcmFan.label',
    descKey: 'templates.dcmFan.desc',
    componentName: 'SINAMICS DCM Drive (Hoist)',
    draft: { failureType: 'electrical', repairLevel: 'minor', sourceType: 'preventive' },
  },
  {
    id: 'panelFilter',
    labelKey: 'templates.panelFilter.label',
    descKey: 'templates.panelFilter.desc',
    componentName: 'Panel Fan / Filter Unit',
    draft: { failureType: 'electrical', repairLevel: 'minor', sourceType: 'preventive' },
  },
  {
    id: 'limitSwitch',
    labelKey: 'templates.limitSwitch.label',
    descKey: 'templates.limitSwitch.desc',
    componentName: 'Limit Switch',
    draft: { failureType: 'control', repairLevel: 'minor', sourceType: 'inspection' },
  },
];
