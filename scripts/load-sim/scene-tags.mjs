/**
 * 씬 JSON(apps/shell/public/scenes/*.json) 에서 "실제로 모델을 움직이는 태그
 * 키" 와 그 값 범위를 뽑는다. 시뮬레이터(server.mjs)와 맵핑 생성기
 * (bind-scene-tags.mjs)가 같은 표를 쓴다.
 *
 * 값 범위는 맵핑의 적용식 `Δ = offset + value × scale` 을 거꾸로 풀어
 * "모델이 rest 에서 적당히 움직이는 Δ 범위" 가 나오도록 정한다.
 */
import fs from 'node:fs';
import path from 'node:path';

export const SCENES_DIR = path.resolve('apps/shell/public/scenes');
export const SCENE_FILES = ['okpo.json', 'dock-in.json', 'philly-2dock.json'];

/** 채널별 기본 Δ 진폭 — 루트 회전은 deg, 위치는 m. */
const ROOT_DELTA = { rotation: 25, position: 12, scale: 0 };
/** 관절 min/max 가 없을 때의 진폭(deg 또는 m). */
const JOINT_DEFAULT = { hinge: 15, slide: 4 };

/** 레거시 valueMapList(절대 대입)의 축 표. sanitize-tag-mappings 와 같다. */
const LEGACY = {
  PX: ['position', 'x'],
  PY: ['position', 'y'],
  PZ: ['position', 'z'],
  RX: ['rotation', 'x'],
  RY: ['rotation', 'y'],
  RZ: ['rotation', 'z'],
};

function readScene(file) {
  return JSON.parse(fs.readFileSync(path.join(SCENES_DIR, file), 'utf8'));
}

/** Δ 범위 [lo, hi] 를 태그 값 범위로 되돌린다. */
function valueRange(lo, hi, scale = 1, offset = 0) {
  const s = scale === 0 ? 1 : scale;
  const a = (lo - offset) / s;
  const b = (hi - offset) / s;
  return [Math.min(a, b), Math.max(a, b)];
}

function splitKey(tagKey) {
  const i = tagKey.indexOf(':');
  return i < 0 ? [tagKey, 'value'] : [tagKey.slice(0, i), tagKey.slice(i + 1)];
}

/**
 * 씬 하나의 태그 표.
 * @returns {{ craneId: string, tagCode: string, min: number, max: number, periodMs: number, source: string }[]}
 */
export function collectSceneTags(scene, sceneName = '') {
  const rigs = new Map((scene.rigs ?? []).map((r) => [r.id, r]));
  const out = [];
  const seen = new Set();
  const push = (tagKey, min, max, periodMs, source) => {
    if (seen.has(tagKey)) return;
    seen.add(tagKey);
    const [craneId, tagCode] = splitKey(tagKey);
    out.push({
      craneId,
      tagCode,
      min,
      max,
      periodMs,
      source: `${sceneName}:${source}`,
    });
  };

  for (const model of scene.models ?? []) {
    const rig = model.rigId ? rigs.get(model.rigId) : undefined;
    for (const m of model.tagMappings ?? []) {
      if (!m || typeof m.tagKey !== 'string') continue;
      const scale = typeof m.scale === 'number' ? m.scale : 1;
      const offset = typeof m.offset === 'number' ? m.offset : 0;
      if (m.target?.kind === 'joint') {
        const joint = rig?.joints?.find((j) => j.id === m.target.jointId);
        const type = joint?.type ?? 'hinge';
        const lo =
          typeof joint?.min === 'number' ? joint.min : -JOINT_DEFAULT[type];
        const hi =
          typeof joint?.max === 'number' ? joint.max : JOINT_DEFAULT[type];
        const [a, b] = valueRange(lo, hi, scale, offset);
        const span = Math.abs(hi - lo);
        // 상부 선회(±180°)는 한 바퀴를 천천히, 러핑·트롤리는 빠르게.
        const period =
          type === 'hinge' ? (span >= 300 ? 90_000 : 30_000) : 36_000;
        push(m.tagKey, a, b, period, 'joint');
      } else if (m.target?.kind === 'node') {
        const amp = ROOT_DELTA[m.target.channel] ?? 0;
        const [a, b] = valueRange(-amp, amp, scale, offset);
        push(
          m.tagKey,
          a,
          b,
          m.target.channel === 'rotation' ? 45_000 : 40_000,
          `node.${m.target.channel}`,
        );
      }
    }
    // 레거시 valueMapList — sanitize 가 루트 node 맵핑으로 바꾼다. 절대 대입
    // 의미였으므로 "배치 좌표 ± 진폭" 이 되는 값 범위를 만든다.
    for (const v of model.valueMapList ?? []) {
      const spec = LEGACY[v?.type];
      if (!spec || typeof v.key !== 'string') continue;
      const [channel, axis] = spec;
      const rest = model[channel]?.['xyz'.indexOf(axis)] ?? 0;
      const amp = ROOT_DELTA[channel];
      const scale = typeof v.scale === 'number' ? v.scale : 1;
      const offset =
        channel === 'position' && typeof v.offset === 'number' ? v.offset : 0;
      const [a, b] = valueRange(rest - amp, rest + amp, scale, offset);
      push(v.key, a, b, 40_000, `legacy.${v.type}`);
    }
  }
  return out;
}

/** 세 씬을 합친 표. 같은 키는 먼저 나온 씬이 이긴다. */
export function collectAllSceneTags() {
  const seen = new Set();
  const out = [];
  for (const file of SCENE_FILES) {
    if (!fs.existsSync(path.join(SCENES_DIR, file))) continue;
    for (const t of collectSceneTags(
      readScene(file),
      file.replace('.json', ''),
    )) {
      const key = `${t.craneId}:${t.tagCode}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}
