/**
 * 크레인 레지스트리(`packages/domain/src/crane/model/registry.ts`)의 craneId 를
 * 읽는다. 프론트의 RealtimeAlarmSync 는 레지스트리에 없는 크레인의 알람을
 * 버리므로, 알람 부하는 이 목록으로만 만든다. TS 를 실행하지 않고 정규식으로
 * 긁는다 — 의존성 0 유지.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REGISTRY = path.join(ROOT, 'packages/domain/src/crane/model/registry.ts');

export function readRegistryCraneIds() {
  const text = fs.readFileSync(REGISTRY, 'utf8');
  const ids = [...text.matchAll(/craneId:\s*'([^']+)'/g)].map((m) => m[1]);
  return [...new Set(ids)];
}
