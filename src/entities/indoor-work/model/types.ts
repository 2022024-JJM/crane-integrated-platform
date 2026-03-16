export type IndoorStatTone = 'danger' | 'neutral' | 'ok';

export type IndoorAlarmSeverity = 'Critical' | 'Normal' | 'Warning';

export interface IndoorStatCard {
  label: string;
  value: string;
  tone: IndoorStatTone;
}

export type IndoorAlarmRow = readonly [
  no: string,
  severity: IndoorAlarmSeverity,
  occurrenceTime: string,
  target: string,
  count: string,
];

export interface IndoorCraneRow {
  equipment: string;
  comm: boolean;
  on: boolean;
  fault: boolean;
  notComm: boolean;
  freeSlewing: boolean;
  rotate: boolean;
  trolley1: string;
  trolley2: string;
  gantry: string;
  hoist1: string;
  hoist2: string;
  hoist3: string;
  trolley2Secondary: string;
  slewing: string;
  gantrySecondary: string;
}

export type IndoorInfoCard = readonly [label: string, value: string];

export interface IndoorInfoRow {
  equipment: string;
  equipmentType: string;
  location: string;
  status: string;
  task: string;
  direction: string;
}

export type IndoorStatusCard = readonly [
  label: string,
  value: string,
  tone: IndoorStatTone,
];

export interface IndoorStatusRow {
  time: string;
  equipment: string;
  statusChange: string;
  level: string;
  location: string;
}
