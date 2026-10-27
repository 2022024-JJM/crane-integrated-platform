export type {
  VirtualEquipment,
  VirtualTagDataType,
  VirtualTagDefinition,
  VirtualTagPattern,
  VirtualTagPatternKind,
  VirtualTagSet,
} from './model/types';
export {
  SIMULATION_SPEED_OPTIONS,
  VIRTUAL_EQUIPMENT_BAY_MAX,
  VIRTUAL_EQUIPMENT_ID_MAX,
  VIRTUAL_EQUIPMENT_TAGS_MAX,
  VIRTUAL_EQUIPMENTS_MAX,
  VIRTUAL_TAG_BOOL_PATTERN_KINDS,
  VIRTUAL_TAG_CODE_MAX,
  VIRTUAL_TAG_DATA_TYPES,
  VIRTUAL_TAG_NAME_MAX,
  VIRTUAL_TAG_PATTERN_KINDS,
  VIRTUAL_TAG_PERIOD_DEFAULT,
  VIRTUAL_TAG_PERIOD_MAX,
  VIRTUAL_TAG_PERIOD_MIN,
  VIRTUAL_TAG_SECONDS_DECIMALS,
  VIRTUAL_TAG_TICK_DEFAULT,
  VIRTUAL_TAG_TICK_MAX,
  VIRTUAL_TAG_TICK_MIN,
  VIRTUAL_TAG_UNIT_MAX,
} from './model/types';
export {
  buildVirtualTagKey,
  normalizeVirtualEquipmentId,
  normalizeVirtualEquipmentKey,
  normalizeVirtualTagCode,
  parseVirtualTagKey,
  VIRTUAL_TAG_KEY_SEPARATOR,
  type VirtualTagKeyParts,
} from './lib/virtual-tag-key';
export {
  collectVirtualTagEntries,
  findVirtualTagEntry,
  type VirtualTagEntry,
} from './lib/virtual-tag-entries';
export {
  clampToTag,
  initVirtualTagState,
  setVirtualTagManualValue,
  stepVirtualTag,
  type VirtualTagRuntimeState,
} from './lib/tag-pattern';
export {
  clampVirtualTagPeriod,
  clampVirtualTagTick,
  createEmptyVirtualTagSet,
  migrateVirtualTagSetV1,
  sanitizeVirtualEquipment,
  sanitizeVirtualEquipmentList,
  sanitizeVirtualTag,
  sanitizeVirtualTagList,
  sanitizeVirtualTagPattern,
  sanitizeVirtualTagSet,
  VIRTUAL_UNASSIGNED_EQUIPMENT_ID,
} from './lib/sanitize-virtual-tags';
export {
  isVirtualTagSetStoredLocallyOnly,
  loadVirtualTagSet,
  saveVirtualTagSet,
  VIRTUAL_TAGS_PUBLIC_PATH,
  VIRTUAL_TAGS_STORAGE_KEY,
} from './lib/virtual-tag-storage';
