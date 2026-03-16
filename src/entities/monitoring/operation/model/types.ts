export type OperationInfoCard = readonly [label: string, value: string];

export type OperationStatusTone = 'danger' | 'neutral' | 'ok';

export type OperationStatusCard = readonly [
  label: string,
  value: string,
  tone: OperationStatusTone,
];
