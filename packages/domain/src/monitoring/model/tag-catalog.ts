import type { ReplayTagSchemaItem } from './types';

export interface MonitoringTagMetadata {
  displayName: string;
  category: string;
  dataType: string | null;
  unit: string | null;
  direction: string | null;
  alarm: boolean;
}

const datetimeTagCodes = new Set([
  'year',
  'month',
  'day',
  'hour',
  'minute',
  'second',
]);

const alarmTagCodes = new Set([
  'crane_system_error',
  'crane_inverter_error',
  'e_stop_on',
]);

const statusDisplayNameMap: Record<string, string> = {
  heartbeat: 'Heartbeat',
  crane_control_on: 'Crane Control On',
  crane_system_error: 'Crane System Error',
  crane_inverter_error: 'Crane Inverter Error',
  accs_bypass_on: 'ACCS Bypass On',
  accs_off: 'ACCS Off',
  e_stop_on: 'E Stop On',
  remote_control_on_ack: 'Remote Control On Ack',
};

function humanizeToken(token: string) {
  return token
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getIndexedDisplayName(prefix: string, index: string, suffix: string) {
  return `${prefix.toUpperCase()}#${index} ${suffix}`;
}

export function getMonitoringTagMetadata(
  tagCode: string,
  tagSchemaItem?: ReplayTagSchemaItem | null,
): MonitoringTagMetadata {
  if (tagSchemaItem) {
    return {
      displayName: tagSchemaItem.displayName || humanizeToken(tagCode),
      category: tagSchemaItem.category || 'status',
      dataType: tagSchemaItem.dataType,
      unit: tagSchemaItem.unit,
      direction: null,
      alarm: tagSchemaItem.alarm,
    };
  }

  if (datetimeTagCodes.has(tagCode)) {
    return {
      displayName: humanizeToken(tagCode),
      category: 'datetime',
      dataType: 'INT',
      unit: null,
      direction: null,
      alarm: false,
    };
  }

  const weightMatch = tagCode.match(/^(mh|ah)(\d+)_weight$/);
  if (weightMatch) {
    return {
      displayName: getIndexedDisplayName(
        weightMatch[1],
        weightMatch[2],
        'Weight',
      ),
      category: 'measurement',
      dataType: 'INT',
      unit: 'ton',
      direction: null,
      alarm: false,
    };
  }

  const heightMatch = tagCode.match(/^(mh|ah)(\d+)_height$/);
  if (heightMatch) {
    return {
      displayName: getIndexedDisplayName(
        heightMatch[1],
        heightMatch[2],
        'Height',
      ),
      category: 'measurement',
      dataType: 'INT',
      unit: 'm',
      direction: null,
      alarm: false,
    };
  }

  const distanceMatch = tagCode.match(/^(ts|tl)(\d+)?_?(.*)$/);
  if (tagCode.includes('distance') && distanceMatch) {
    const prefix = distanceMatch[1].toUpperCase();
    const suffix = distanceMatch[3]
      ? humanizeToken(
          distanceMatch[3]
            .replace(/_?distance_?value$/, '')
            .replace(/_?distance$/, ''),
        )
      : 'Distance';
    const indexedPrefix = distanceMatch[2]
      ? `${prefix}#${distanceMatch[2]}`
      : prefix;

    return {
      displayName:
        suffix === 'Distance'
          ? `${indexedPrefix} Distance`
          : `${indexedPrefix} ${suffix} Distance`.trim(),
      category: 'measurement',
      dataType: 'INT',
      unit: 'm',
      direction: null,
      alarm: false,
    };
  }

  const statusMatch = tagCode.match(/^(mh|ah|ts|tl)(\d+)_status$/);
  if (statusMatch) {
    return {
      displayName: getIndexedDisplayName(
        statusMatch[1],
        statusMatch[2],
        'Status',
      ),
      category: 'status',
      dataType: null,
      unit: null,
      direction: null,
      alarm: false,
    };
  }

  return {
    displayName: statusDisplayNameMap[tagCode] ?? humanizeToken(tagCode),
    category: 'status',
    dataType: null,
    unit: null,
    direction: null,
    alarm: alarmTagCodes.has(tagCode),
  };
}
