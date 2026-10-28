import type { CraneType } from '@crane/domain/asset';

/**
 * 증상 프리셋 — 장비 종류에 맞는 칩만 보인다. 골리앗·갠트리는 트롤리·주행,
 * 러핑·지브는 기복·선회처럼 구조가 달라 같은 칩을 줄 수 없다. 칩 글자는
 * i18n `field.preset.*`, 부위 글자는 `field.component.*`.
 */
export type SymptomPresetKey =
  | 'wireDamage'
  | 'brakeAbnormal'
  | 'noise'
  | 'motorStop'
  | 'limitFault'
  | 'leak'
  | 'trolleyTravel'
  | 'hoist'
  | 'gantryTravel'
  | 'luffing'
  | 'slewing'
  | 'electricalAlarm';

export type ComponentKey =
  | 'trolley'
  | 'hoist'
  | 'gantry'
  | 'luffing'
  | 'slewing'
  | 'brake'
  | 'wireRope'
  | 'limitSwitch'
  | 'electricalRoom'
  | 'hydraulics'
  | 'motor';

const GOLIATH: readonly SymptomPresetKey[] = [
  'trolleyTravel',
  'hoist',
  'gantryTravel',
  'brakeAbnormal',
  'wireDamage',
  'limitFault',
  'electricalAlarm',
  'noise',
  'leak',
];
const LUFFING: readonly SymptomPresetKey[] = [
  'luffing',
  'slewing',
  'hoist',
  'brakeAbnormal',
  'wireDamage',
  'limitFault',
  'electricalAlarm',
  'noise',
  'leak',
];
const GENERIC: readonly SymptomPresetKey[] = [
  'wireDamage',
  'brakeAbnormal',
  'noise',
  'motorStop',
  'limitFault',
  'leak',
];

export function symptomPresets(
  craneType: CraneType | null | undefined,
): readonly SymptomPresetKey[] {
  switch (craneType) {
    case 'goliath':
    case 'gantry':
    case 'overhead':
      return GOLIATH;
    case 'luffing':
    case 'llc':
    case 'jib':
    case 'ttc':
      return LUFFING;
    default:
      return GENERIC;
  }
}

const PRESET_COMPONENT: Partial<Record<SymptomPresetKey, ComponentKey>> = {
  trolleyTravel: 'trolley',
  hoist: 'hoist',
  gantryTravel: 'gantry',
  luffing: 'luffing',
  slewing: 'slewing',
  brakeAbnormal: 'brake',
  wireDamage: 'wireRope',
  limitFault: 'limitSwitch',
  electricalAlarm: 'electricalRoom',
  leak: 'hydraulics',
  motorStop: 'motor',
};

/** 프리셋이 가리키는 부위 — 없는 프리셋(이상 소음 등)은 null. */
export function presetComponent(key: SymptomPresetKey): ComponentKey | null {
  return PRESET_COMPONENT[key] ?? null;
}

/**
 * 프리셋 토글에 따른 부위 자동 채움. 켤 때 부위가 비어 있으면 그 프리셋의
 * 부위를 넣고, 끌 때 부위가 그 값 그대로면 비운다. 사람이 손으로 적은
 * 부위는 건드리지 않는다.
 */
export function componentAfterPreset(
  current: string,
  key: SymptomPresetKey,
  turningOn: boolean,
  labelOf: (component: ComponentKey) => string,
): string {
  const c = presetComponent(key);
  if (!c) return current;
  const label = labelOf(c);
  if (turningOn) return current.trim() === '' ? label : current;
  return current === label ? '' : current;
}
