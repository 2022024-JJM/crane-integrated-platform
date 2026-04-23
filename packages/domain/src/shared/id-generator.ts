type SeqKey = 'repair' | 'inspection' | 'parts' | 'asset';

const seqCounters: Record<SeqKey, number> = {
  repair: 0,
  inspection: 0,
  parts: 0,
  asset: 0,
};

export function seedSequence(key: SeqKey, startFrom: number): void {
  if (startFrom > seqCounters[key]) {
    seqCounters[key] = startFrom;
  }
}

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

function year(): number {
  return new Date().getFullYear();
}

export function nextRepairWoNumber(): string {
  seqCounters.repair += 1;
  return `RPR-${year()}-${pad4(seqCounters.repair)}`;
}

export function nextInspectionWoNumber(): string {
  seqCounters.inspection += 1;
  return `INS-${year()}-${pad4(seqCounters.inspection)}`;
}

export function nextPartsRequestNumber(): string {
  seqCounters.parts += 1;
  return `PRQ-${year()}-${pad4(seqCounters.parts)}`;
}

function cryptoId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newRepairId(): string {
  return `repair-${cryptoId()}`;
}

export function newInspectionId(): string {
  return `insp-${cryptoId()}`;
}

export function newPartsRequestId(): string {
  return `parts-req-${cryptoId()}`;
}

export function newAssetId(): string {
  return `crane-${cryptoId()}`;
}
