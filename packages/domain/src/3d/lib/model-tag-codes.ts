import {
  STATUS_TAG_ROLES,
  type ModelStatusTags,
  type StatusTagRole,
} from '../model/status-tag-types';
import type { TagMapping, TagMappingTarget } from '../model/tag-mapping-types';
import type { SavedModelHook } from '../model/types';

/**
 * 모델이 참조하는 태그 코드 목록 — 맵핑(움직임)·상태 태그(라벨·외곽선)·훅의
 * 부착 태그(운반)를 한 줄로 편 것. 시나리오 선택기가 "이 모델에서 고를 수
 * 있는 태그" 로 보이고, 시나리오 태그 행이 코드 옆에 대상(노드·채널·축 /
 * 역할 / 훅)을 적는 데 쓴다.
 *
 * 같은 코드가 여러 맵핑에 붙어 있으면(팬아웃) 첫 항목만 남긴다 — 시나리오는
 * 코드 단위로 값을 내므로 하나면 충분하다.
 */
export type ModelTagCode =
  | {
      code: string;
      source: 'mapping';
      mappingId: string;
      target: TagMappingTarget;
    }
  | { code: string; source: 'status'; role: StatusTagRole }
  | { code: string; source: 'hook'; hookId: string; label: string };

export function collectModelTagCodes(model: {
  tagMappings?: readonly TagMapping[];
  statusTags?: ModelStatusTags;
  hooks?: readonly SavedModelHook[];
}): ModelTagCode[] {
  const out: ModelTagCode[] = [];
  const seen = new Set<string>();
  for (const mapping of model.tagMappings ?? []) {
    if (!mapping.code || seen.has(mapping.code)) continue;
    seen.add(mapping.code);
    out.push({
      code: mapping.code,
      source: 'mapping',
      mappingId: mapping.id,
      target: mapping.target,
    });
  }
  const statusTags = model.statusTags;
  if (statusTags) {
    for (const role of STATUS_TAG_ROLES) {
      const code = statusTags[role];
      if (!code || seen.has(code)) continue;
      seen.add(code);
      out.push({ code, source: 'status', role });
    }
  }
  for (const hook of model.hooks ?? []) {
    if (!hook.attachCode || seen.has(hook.attachCode)) continue;
    seen.add(hook.attachCode);
    out.push({
      code: hook.attachCode,
      source: 'hook',
      hookId: hook.id,
      label: hook.label ?? hook.id,
    });
  }
  return out;
}
