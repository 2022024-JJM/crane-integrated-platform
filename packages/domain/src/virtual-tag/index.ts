export type {
  VirtualTagDefinition,
  VirtualTagPattern,
  VirtualTagPatternKind,
  VirtualTagSet,
} from './model/types';
export {
  VIRTUAL_TAG_KEY_MAX,
  VIRTUAL_TAG_NAME_MAX,
  VIRTUAL_TAG_PATTERN_KINDS,
  VIRTUAL_TAG_PERIOD_DEFAULT,
  VIRTUAL_TAG_PERIOD_MAX,
  VIRTUAL_TAG_PERIOD_MIN,
  VIRTUAL_TAG_TICK_DEFAULT,
  VIRTUAL_TAG_TICK_MAX,
  VIRTUAL_TAG_TICK_MIN,
  VIRTUAL_TAG_UNIT_MAX,
  VIRTUAL_TAGS_MAX,
} from './model/types';
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
  normalizeVirtualTagKey,
  sanitizeVirtualTag,
  sanitizeVirtualTagList,
  sanitizeVirtualTagPattern,
  sanitizeVirtualTagSet,
} from './lib/sanitize-virtual-tags';
