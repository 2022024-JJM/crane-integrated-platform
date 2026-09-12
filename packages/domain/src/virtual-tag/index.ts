export type {
  ScenarioEase,
  ScenarioKeyframe,
  ScenarioTrack,
  VirtualScenario,
  VirtualTagDefinition,
  VirtualTagLimits,
  VirtualTagPattern,
  VirtualTagPatternKind,
  VirtualTagSet,
} from './model/types';
export {
  SCENARIO_EASES,
  SCENARIO_KEYFRAMES_MAX,
  SCENARIO_NAME_MAX,
  SCENARIO_TIME_MAX_MS,
  SCENARIO_TRACKS_MAX,
  SCENARIOS_MAX,
  SIMULATION_SPEED_OPTIONS,
} from './model/types';
export {
  evaluateScenarioTrack,
  isScenarioFinished,
  normalizeKeyframes,
  scenarioDurationMs,
  scenarioTimeMs,
} from './lib/scenario';
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
  sanitizeVirtualTagLimits,
  sanitizeVirtualTagList,
  sanitizeVirtualTagPattern,
  sanitizeVirtualTagSet,
  sanitizeScenario,
  sanitizeScenarioKeyframe,
  sanitizeScenarioList,
  sanitizeScenarioTrack,
} from './lib/sanitize-virtual-tags';
export {
  isVirtualTagSetStoredLocallyOnly,
  loadVirtualTagSet,
  saveVirtualTagSet,
  VIRTUAL_TAGS_PUBLIC_PATH,
  VIRTUAL_TAGS_STORAGE_KEY,
} from './lib/virtual-tag-storage';
export {
  hasRateLimits,
  rateLimitStep,
  type RateLimitState,
} from './lib/rate-limit';
