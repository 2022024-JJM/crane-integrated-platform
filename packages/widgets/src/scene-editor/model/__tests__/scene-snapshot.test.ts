import { describe, expect, it } from 'vitest';
import type {
  SavedCameraInfo,
  SavedModelInfo,
  SavedRulerGuide,
  SavedRulerInfo,
  SavedSceneInfo,
} from '@crane/domain/3d';
import {
  SCENE_SUN_AZIMUTH_DEFAULT,
  SCENE_SUN_ELEVATION_DEFAULT,
} from '@crane/domain/3d';
import { createSceneSnapshot, isSceneInfoEqual } from '../scene-snapshot';

function scene(overrides: Partial<SavedSceneInfo> = {}): SavedSceneInfo {
  return {
    maps: [],
    models: [],
    texts: [],
    camera: null,
    ...overrides,
  };
}

function model(overrides: Partial<SavedModelInfo> = {}): SavedModelInfo {
  return {
    id: 'm1',
    equipName: 'Crane',
    path: '/models/crane.glb',
    opacity: 1,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    ...overrides,
  };
}

describe('isSceneInfoEqual — 기본', () => {
  it('동일 참조는 true, null 혼합은 false', () => {
    const a = scene();
    expect(isSceneInfoEqual(a, a)).toBe(true);
    expect(isSceneInfoEqual(null, null)).toBe(true);
    expect(isSceneInfoEqual(a, null)).toBe(false);
    expect(isSceneInfoEqual(null, a)).toBe(false);
  });

  it('내용이 같은 다른 객체는 true (구조 비교)', () => {
    expect(
      isSceneInfoEqual(
        scene({ models: [model()] }),
        scene({ models: [model()] }),
      ),
    ).toBe(true);
  });
});

describe('isSceneInfoEqual — environmentId 3-상태', () => {
  it('undefined(미지정)와 null(배경 없음)은 다른 상태다', () => {
    expect(isSceneInfoEqual(scene(), scene({ environmentId: null }))).toBe(
      false,
    );
    expect(
      isSceneInfoEqual(
        scene({ environmentId: 'sky' }),
        scene({ environmentId: 'sky' }),
      ),
    ).toBe(true);
  });
});

describe('isSceneInfoEqual — sea 3-상태', () => {
  it('undefined(레거시 규칙)와 명시 boolean 은 다른 상태다', () => {
    expect(isSceneInfoEqual(scene(), scene({ sea: false }))).toBe(false);
    expect(isSceneInfoEqual(scene(), scene({ sea: true }))).toBe(false);
  });

  it('true 와 false 는 다르다', () => {
    expect(isSceneInfoEqual(scene({ sea: true }), scene({ sea: false }))).toBe(
      false,
    );
  });

  it('같은 명시값·둘 다 미지정은 같다', () => {
    expect(isSceneInfoEqual(scene({ sea: true }), scene({ sea: true }))).toBe(
      true,
    );
    expect(isSceneInfoEqual(scene({ sea: false }), scene({ sea: false }))).toBe(
      true,
    );
    expect(isSceneInfoEqual(scene(), scene())).toBe(true);
  });
});

describe('isSceneInfoEqual — 조명 기본값 정규화', () => {
  it('필드 없음과 명시적 기본값은 같은 상태다', () => {
    expect(
      isSceneInfoEqual(
        scene(),
        scene({
          lighting: {
            shadows: false,
            sunAzimuth: SCENE_SUN_AZIMUTH_DEFAULT,
            sunElevation: SCENE_SUN_ELEVATION_DEFAULT,
          },
        }),
      ),
    ).toBe(true);
  });

  it('그림자·태양 위치 변경은 dirty로 잡힌다', () => {
    expect(
      isSceneInfoEqual(scene(), scene({ lighting: { shadows: true } })),
    ).toBe(false);
    expect(
      isSceneInfoEqual(scene(), scene({ lighting: { sunAzimuth: 90 } })),
    ).toBe(false);
  });

  it("태양 방식(sunMode) — 'manual' 명시는 필드 없음과 같고 'solar' 는 dirty", () => {
    expect(
      isSceneInfoEqual(scene(), scene({ lighting: { sunMode: 'manual' } })),
    ).toBe(true);
    expect(
      isSceneInfoEqual(scene(), scene({ lighting: { sunMode: 'solar' } })),
    ).toBe(false);
    expect(
      isSceneInfoEqual(
        scene({ lighting: { sunMode: 'solar', sunAzimuth: 90 } }),
        scene({ lighting: { sunMode: 'solar', sunAzimuth: 90 } }),
      ),
    ).toBe(true);
  });
});

describe('isSceneInfoEqual — 지도', () => {
  const map = { id: 'a', path: '/a.glb' };

  it('잠금은 씬 데이터다 — 필드 없음 = 잠김이라 undefined와 true는 같다', () => {
    expect(
      isSceneInfoEqual(
        scene({ maps: [map] }),
        scene({ maps: [{ ...map, locked: true }] }),
      ),
    ).toBe(true);
    expect(
      isSceneInfoEqual(
        scene({ maps: [map] }),
        scene({ maps: [{ ...map, locked: false }] }),
      ),
    ).toBe(false);
  });

  it('지도 이동(transform 추가)은 dirty로 잡힌다', () => {
    expect(
      isSceneInfoEqual(
        scene({ maps: [map] }),
        scene({ maps: [{ ...map, position: [1, 0, 0] }] }),
      ),
    ).toBe(false);
  });

  it('이름 변경도 dirty로 잡힌다', () => {
    expect(
      isSceneInfoEqual(
        scene({ maps: [map] }),
        scene({ maps: [{ ...map, name: 'Dock' }] }),
      ),
    ).toBe(false);
  });

  it('카메라 영역 제한 토글은 dirty — 없음과 false 는 같은 상태', () => {
    expect(
      isSceneInfoEqual(
        scene({ maps: [map] }),
        scene({ maps: [{ ...map, cameraBounds: true }] }),
      ),
    ).toBe(false);
    expect(
      isSceneInfoEqual(
        scene({ maps: [map] }),
        scene({ maps: [{ ...map, cameraBounds: false }] }),
      ),
    ).toBe(true);
  });
});

describe('isSceneInfoEqual — 모델·텍스트', () => {
  it('모델 transform/opacity 변경을 감지한다', () => {
    expect(
      isSceneInfoEqual(
        scene({ models: [model()] }),
        scene({ models: [model({ position: [1, 0, 0] })] }),
      ),
    ).toBe(false);
    expect(
      isSceneInfoEqual(
        scene({ models: [model()] }),
        scene({ models: [model({ opacity: 0.5 })] }),
      ),
    ).toBe(false);
  });

  it('모델 잠금: 필드 없음 = 해제라 undefined와 false가 같다', () => {
    expect(
      isSceneInfoEqual(
        scene({ models: [model()] }),
        scene({ models: [model({ locked: false })] }),
      ),
    ).toBe(true);
    expect(
      isSceneInfoEqual(
        scene({ models: [model()] }),
        scene({ models: [model({ locked: true })] }),
      ),
    ).toBe(false);
  });

  it('모델 labelHidden 은 undefined 와 false 를 같게, true 는 다르게 본다', () => {
    expect(
      isSceneInfoEqual(
        scene({ models: [model()] }),
        scene({ models: [model({ labelHidden: false })] }),
      ),
    ).toBe(true);
    expect(
      isSceneInfoEqual(
        scene({ models: [model()] }),
        scene({ models: [model({ labelHidden: true })] }),
      ),
    ).toBe(false);
  });

  it('tagMappings 는 id 기준 순서 무관, scale/offset 기본값(1/0)을 채워 비교한다', () => {
    const a = {
      id: 'm-a',
      target: { kind: 'node', node: '', channel: 'position', axis: 'z' },
      tagKey: 'k',
    } as const;
    const b = {
      id: 'm-b',
      target: { kind: 'joint', jointId: 'luff' },
      tagKey: 'k2',
    } as const;
    expect(
      isSceneInfoEqual(
        scene({ models: [model({ tagMappings: [a, b] })] }),
        scene({
          models: [
            model({
              tagMappings: [
                { ...b, offset: 0 },
                { ...a, scale: 1 },
              ],
            }),
          ],
        }),
      ),
    ).toBe(true);
    // 대상(축)·태그·scale 변경은 감지
    expect(
      isSceneInfoEqual(
        scene({ models: [model({ tagMappings: [a] })] }),
        scene({
          models: [
            model({
              tagMappings: [{ ...a, target: { ...a.target, axis: 'x' } }],
            }),
          ],
        }),
      ),
    ).toBe(false);
    expect(
      isSceneInfoEqual(
        scene({ models: [model({ tagMappings: [a] })] }),
        scene({
          models: [model({ tagMappings: [{ ...a, tagKey: 'other' }] })],
        }),
      ),
    ).toBe(false);
    expect(
      isSceneInfoEqual(
        scene({ models: [model({ tagMappings: [a] })] }),
        scene({ models: [model({ tagMappings: [{ ...a, scale: 2 }] })] }),
      ),
    ).toBe(false);
    // 필드 없음 ≡ 빈 배열
    expect(
      isSceneInfoEqual(
        scene({ models: [model({ tagMappings: undefined })] }),
        scene({ models: [model({ tagMappings: [] })] }),
      ),
    ).toBe(true);
  });

  it('meshOverrides는 meshPath 기준 순서 무관 비교', () => {
    const o1 = { meshPath: '[0]A', opacity: 0.5 };
    const o2 = { meshPath: '[1]B', visible: false };
    expect(
      isSceneInfoEqual(
        scene({ models: [model({ meshOverrides: [o1, o2] })] }),
        scene({ models: [model({ meshOverrides: [o2, o1] })] }),
      ),
    ).toBe(true);
    expect(
      isSceneInfoEqual(
        scene({ models: [model({ meshOverrides: [o1] })] }),
        scene({
          models: [model({ meshOverrides: [{ ...o1, opacity: 0.9 }] })],
        }),
      ),
    ).toBe(false);
  });

  it('모델 배열은 순서까지 같아야 한다', () => {
    const a = model({ id: 'a' });
    const b = model({ id: 'b' });
    expect(
      isSceneInfoEqual(scene({ models: [a, b] }), scene({ models: [b, a] })),
    ).toBe(false);
  });

  it('텍스트 변경을 감지한다 (잠금 기본값은 해제)', () => {
    const text = {
      id: 't',
      content: 'Hi',
      color: '#fff',
      position: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
    };
    expect(
      isSceneInfoEqual(
        scene({ texts: [text] }),
        scene({ texts: [{ ...text, locked: false }] }),
      ),
    ).toBe(true);
    expect(
      isSceneInfoEqual(
        scene({ texts: [text] }),
        scene({ texts: [{ ...text, content: 'Bye' }] }),
      ),
    ).toBe(false);
  });
});

describe('isSceneInfoEqual — 카메라', () => {
  it('position/target이 모두 같아야 한다', () => {
    const cam = { position: [1, 2, 3], target: [0, 0, 0] } as const;
    expect(
      isSceneInfoEqual(
        scene({ camera: { position: [1, 2, 3], target: [0, 0, 0] } }),
        scene({ camera: { position: [1, 2, 3], target: [0, 0, 0] } }),
      ),
    ).toBe(true);
    expect(
      isSceneInfoEqual(
        scene({ camera: { position: [...cam.position], target: [0, 0, 0] } }),
        scene({ camera: null }),
      ),
    ).toBe(false);
  });
});

describe('isSceneInfoEqual — cameraByRegion (공유 씬)', () => {
  const c1 = 1;
  const c2 = 2;
  const slot = (n: number): SavedCameraInfo => ({
    position: [n, n, n],
    target: [0, 0, 0],
  });

  it('같은 슬롯 내용이면 equal, undefined 와 {} 도 equal', () => {
    expect(
      isSceneInfoEqual(
        scene({ cameraByRegion: { 'dock-1': slot(c1) } }),
        scene({ cameraByRegion: { 'dock-1': slot(c1) } }),
      ),
    ).toBe(true);
    expect(isSceneInfoEqual(scene({ cameraByRegion: {} }), scene())).toBe(true);
  });

  it('슬롯 값이 다르거나 키 집합이 다르면 not equal', () => {
    expect(
      isSceneInfoEqual(
        scene({ cameraByRegion: { 'dock-1': slot(c1) } }),
        scene({ cameraByRegion: { 'dock-1': slot(c2) } }),
      ),
    ).toBe(false);
    expect(
      isSceneInfoEqual(
        scene({ cameraByRegion: { 'dock-1': slot(c1) } }),
        scene({ cameraByRegion: { 'dock-1': slot(c1), 'dock-2': slot(c2) } }),
      ),
    ).toBe(false);
    expect(
      isSceneInfoEqual(
        scene({ cameraByRegion: { 'dock-1': slot(c1) } }),
        scene({ cameraByRegion: { 'dock-2': slot(c1) } }),
      ),
    ).toBe(false);
    expect(
      isSceneInfoEqual(
        scene({ cameraByRegion: { 'dock-1': slot(c1) } }),
        scene(),
      ),
    ).toBe(false);
  });
});

describe('createSceneSnapshot', () => {
  it('null은 null', () => {
    expect(createSceneSnapshot(null)).toBeNull();
  });

  it('sanitize를 거친 JSON 문자열 — 정규화가 같으면 스냅샷도 같다', () => {
    // 기본값 조명은 sanitize가 필드를 생략하므로 두 씬의 스냅샷이 일치한다.
    const a = createSceneSnapshot(scene());
    const b = createSceneSnapshot(
      scene({
        lighting: { shadows: false, sunAzimuth: SCENE_SUN_AZIMUTH_DEFAULT },
      }),
    );
    expect(a).toBeTypeOf('string');
    expect(a).toBe(b);
  });

  it('sea:false 는 직렬화에 남고, 미지정은 빠진다 (false 가 기본값 생략이 아니다)', () => {
    const explicitOff = JSON.parse(createSceneSnapshot(scene({ sea: false }))!);
    expect(explicitOff).toHaveProperty('sea', false);
    const unset = JSON.parse(createSceneSnapshot(scene())!);
    expect(unset).not.toHaveProperty('sea');
    expect(createSceneSnapshot(scene({ sea: false }))).not.toBe(
      createSceneSnapshot(scene()),
    );
  });
});

describe('isSceneInfoEqual — 리깅', () => {
  const rig = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'rig-1',
      name: 'R',
      modelPath: '/models/crane.glb',
      joints: [{ id: 'a', node: '[0]A', type: 'hinge', axis: 'x' }],
      constraints: [
        { type: 'linear', id: 'l', input: 'a', output: 'b', factor: 1.14 },
      ],
      ...overrides,
    }) as unknown as SavedSceneInfo['rigs'] extends (infer R)[] | undefined
      ? R
      : never;

  it('리그 정의 필드 없음과 빈 배열은 같은 상태다', () => {
    expect(isSceneInfoEqual(scene(), scene({ rigs: [] }))).toBe(true);
  });

  it('선형 연동의 factor/offset 변경은 dirty 로 잡히고 offset 기본값 0 은 생략과 같다', () => {
    expect(
      isSceneInfoEqual(scene({ rigs: [rig()] }), scene({ rigs: [rig()] })),
    ).toBe(true);
    expect(
      isSceneInfoEqual(
        scene({ rigs: [rig()] }),
        scene({
          rigs: [
            rig({
              constraints: [
                { type: 'linear', id: 'l', input: 'a', output: 'b', factor: 2 },
              ],
            }),
          ],
        }),
      ),
    ).toBe(false);
    expect(
      isSceneInfoEqual(
        scene({ rigs: [rig()] }),
        scene({
          rigs: [
            rig({
              constraints: [
                {
                  type: 'linear',
                  id: 'l',
                  input: 'a',
                  output: 'b',
                  factor: 1.14,
                  offset: 0,
                },
              ],
            }),
          ],
        }),
      ),
    ).toBe(true);
  });

  it('관절 축·한계 변경과 모델 rigId 변경을 감지한다', () => {
    expect(
      isSceneInfoEqual(
        scene({ rigs: [rig()] }),
        scene({
          rigs: [
            rig({
              joints: [{ id: 'a', node: '[0]A', type: 'hinge', axis: 'y' }],
            }),
          ],
        }),
      ),
    ).toBe(false);
    expect(
      isSceneInfoEqual(
        scene({ models: [model()] }),
        scene({ models: [model({ rigId: 'rig-1' })] }),
      ),
    ).toBe(false);
  });
});

describe('isSceneInfoEqual — 모델 영역(zones)', () => {
  const zone = { id: 'z1', name: 'A', color: '#38bdf8', radius: 10 };

  it('영역 추가·삭제는 다르다', () => {
    expect(
      isSceneInfoEqual(
        scene({ models: [model()] }),
        scene({ models: [model({ zones: [zone] })] }),
      ),
    ).toBe(false);
  });

  it('이름·색·반경·오프셋 변경은 각각 다르다', () => {
    const base = scene({ models: [model({ zones: [zone] })] });
    for (const patch of [
      { name: 'B' },
      { color: '#ff0000' },
      { radius: 11 },
      { offset: [1, 0] as [number, number] },
    ]) {
      expect(
        isSceneInfoEqual(
          base,
          scene({ models: [model({ zones: [{ ...zone, ...patch }] })] }),
        ),
      ).toBe(false);
    }
  });

  it('offset 없음과 [0,0] 은 같은 상태, 순서가 달라도 같다', () => {
    const z2 = { id: 'z2', name: '', color: '#fbbf24', radius: 3 };
    expect(
      isSceneInfoEqual(
        scene({ models: [model({ zones: [zone, z2] })] }),
        scene({
          models: [model({ zones: [z2, { ...zone, offset: [0, 0] }] })],
        }),
      ),
    ).toBe(true);
  });

  it('zoneExempt 는 true 만 상태다 — false·없음은 같고 true 는 다르다', () => {
    expect(
      isSceneInfoEqual(
        scene({ models: [model({ zoneExempt: false })] }),
        scene({ models: [model()] }),
      ),
    ).toBe(true);
    expect(
      isSceneInfoEqual(
        scene({ models: [model({ zoneExempt: true })] }),
        scene({ models: [model()] }),
      ),
    ).toBe(false);
  });

  it('빈 배열과 필드 없음은 같다', () => {
    expect(
      isSceneInfoEqual(
        scene({ models: [model({ zones: [] })] }),
        scene({ models: [model()] }),
      ),
    ).toBe(true);
  });
});

describe('isSceneInfoEqual — 상태 태그(statusTags)', () => {
  const tags = { controlOn: 'A:on', bypass: 'A:bypass' };

  it('역할 추가·삭제·키 변경은 각각 다르다', () => {
    const base = scene({ models: [model({ statusTags: tags })] });
    for (const next of [
      { ...tags, fault: 'A:fault' },
      { controlOn: 'A:on' },
      { ...tags, bypass: 'A:other' },
    ]) {
      expect(
        isSceneInfoEqual(
          base,
          scene({ models: [model({ statusTags: next })] }),
        ),
      ).toBe(false);
    }
  });

  it('필드가 새로 생기면 다르다 — 빠지면 첫 연결이 저장되지 않는다', () => {
    expect(
      isSceneInfoEqual(
        scene({ models: [model()] }),
        scene({ models: [model({ statusTags: { freeSwing: 'A:swing' } })] }),
      ),
    ).toBe(false);
  });

  it('내용이 같으면 객체·역할 순서가 달라도 같다', () => {
    expect(
      isSceneInfoEqual(
        scene({ models: [model({ statusTags: tags })] }),
        scene({
          models: [
            model({ statusTags: { bypass: 'A:bypass', controlOn: 'A:on' } }),
          ],
        }),
      ),
    ).toBe(true);
  });

  it('필드 없음·빈 객체·빈 문자열은 같은 상태다', () => {
    const none = scene({ models: [model()] });
    expect(
      isSceneInfoEqual(none, scene({ models: [model({ statusTags: {} })] })),
    ).toBe(true);
    expect(
      isSceneInfoEqual(
        none,
        scene({ models: [model({ statusTags: { controlOn: '' } })] }),
      ),
    ).toBe(true);
  });

  it('스냅샷(JSON)에도 실린다 — 저장 직전 정규화를 거친 값으로', () => {
    const snapshot = createSceneSnapshot(
      scene({
        models: [model({ statusTags: { controlOn: ' A:on ', fault: '' } })],
      }),
    );
    expect(JSON.parse(snapshot ?? '{}').models[0].statusTags).toEqual({
      controlOn: 'A:on',
    });
  });

  it('외곽선 역할도 역할마다 비교한다 — 빠지면 외곽선 연결이 저장되지 않는다', () => {
    const base = scene({ models: [model({ statusTags: tags })] });
    for (const role of ['commError', 'slowdown', 'endstop'] as const) {
      const linked = scene({
        models: [model({ statusTags: { ...tags, [role]: 'A:bit' } })],
      });
      expect(isSceneInfoEqual(base, linked)).toBe(false);
      expect(
        isSceneInfoEqual(
          linked,
          scene({
            models: [model({ statusTags: { ...tags, [role]: 'A:other' } })],
          }),
        ),
      ).toBe(false);
      expect(
        isSceneInfoEqual(
          linked,
          scene({
            models: [model({ statusTags: { [role]: 'A:bit', ...tags } })],
          }),
        ),
      ).toBe(true);
    }
  });

  it('Slowdown 과 Endstop 을 맞바꾸면 다르다', () => {
    expect(
      isSceneInfoEqual(
        scene({
          models: [model({ statusTags: { slowdown: 'A:a', endstop: 'A:b' } })],
        }),
        scene({
          models: [model({ statusTags: { slowdown: 'A:b', endstop: 'A:a' } })],
        }),
      ),
    ).toBe(false);
  });

  it('외곽선 역할이 스냅샷(JSON)에 실린다', () => {
    const snapshot = createSceneSnapshot(
      scene({
        models: [
          model({
            statusTags: {
              endstop: ' A:end ',
              slowdown: 'A:slow',
              commError: '',
            },
          }),
        ],
      }),
    );
    expect(JSON.parse(snapshot ?? '{}').models[0].statusTags).toEqual({
      slowdown: 'A:slow',
      endstop: 'A:end',
    });
  });
});

describe('isSceneInfoEqual — 거리 눈금(rulers)', () => {
  function ruler(overrides: Partial<SavedRulerInfo> = {}): SavedRulerInfo {
    return {
      id: 'r1',
      name: '눈금 1',
      position: [10, 5, -20],
      rotation: [0, 90, 0],
      length: 750,
      interval: 100,
      textColor: '#ffffff',
      dotColor: '#ffffff',
      ...overrides,
    };
  }

  it('눈금 추가·삭제는 다르다', () => {
    expect(isSceneInfoEqual(scene(), scene({ rulers: [ruler()] }))).toBe(false);
    expect(
      isSceneInfoEqual(
        scene({ rulers: [ruler(), ruler({ id: 'r2' })] }),
        scene({ rulers: [ruler()] }),
      ),
    ).toBe(false);
  });

  it('필드 없음과 빈 배열은 같은 상태다', () => {
    expect(isSceneInfoEqual(scene(), scene({ rulers: [] }))).toBe(true);
  });

  it('내용이 같은 다른 객체는 같다', () => {
    expect(
      isSceneInfoEqual(
        scene({ rulers: [ruler()] }),
        scene({ rulers: [ruler()] }),
      ),
    ).toBe(true);
  });

  it.each<[string, Partial<SavedRulerInfo>]>([
    ['이름', { name: '눈금 2' }],
    ['글자 색', { textColor: '#ffaa00' }],
    ['점 색', { dotColor: '#ffaa00' }],
    ['길이', { length: 751 }],
    ['간격', { interval: 50 }],
    ['보조선 추가', { guide: { length: 10, color: '#ffffff' } }],
    ['시작 값', { startValue: 150 }],
    ['단위 숨김', { unitHidden: true }],
    ['잠금', { locked: true }],
    ['위치', { position: [10, 5, -21] }],
    ['회전', { rotation: [0, 91, 0] }],
  ])('%s 변경은 dirty 로 잡힌다', (_label, change) => {
    expect(
      isSceneInfoEqual(
        scene({ rulers: [ruler()] }),
        scene({ rulers: [ruler(change)] }),
      ),
    ).toBe(false);
  });

  it('기본값 명시는 필드 없음과 같은 상태다', () => {
    expect(
      isSceneInfoEqual(
        scene({ rulers: [ruler()] }),
        scene({
          rulers: [
            ruler({
              startValue: 0,
              unitHidden: false,
              locked: false,
            }),
          ],
        }),
      ),
    ).toBe(true);
  });

  it.each<[string, Partial<SavedRulerGuide>]>([
    ['길이', { length: 11 }],
    ['색', { color: '#ffaa00' }],
    ['방향', { side: 'right' }],
    ['불투명도', { opacity: 0.5 }],
  ])('보조선 %s 변경은 dirty 로 잡힌다', (_label, change) => {
    const base: SavedRulerGuide = { length: 10, color: '#ffffff' };
    expect(
      isSceneInfoEqual(
        scene({ rulers: [ruler({ guide: base })] }),
        scene({ rulers: [ruler({ guide: { ...base, ...change } })] }),
      ),
    ).toBe(false);
  });

  it('보조선 제거는 dirty 로 잡힌다', () => {
    expect(
      isSceneInfoEqual(
        scene({ rulers: [ruler({ guide: { length: 10, color: '#ffffff' } })] }),
        scene({ rulers: [ruler()] }),
      ),
    ).toBe(false);
  });

  it('보조선의 기본값 명시(왼쪽·불투명도 1)는 필드 없음과 같은 상태다', () => {
    expect(
      isSceneInfoEqual(
        scene({ rulers: [ruler({ guide: { length: 10, color: '#ffffff' } })] }),
        scene({
          rulers: [
            ruler({
              guide: { length: 10, color: '#ffffff', side: 'left', opacity: 1 },
            }),
          ],
        }),
      ),
    ).toBe(true);
  });

  it('눈금 배열은 순서까지 같아야 한다', () => {
    const a = ruler({ id: 'a' });
    const b = ruler({ id: 'b' });
    expect(
      isSceneInfoEqual(scene({ rulers: [a, b] }), scene({ rulers: [b, a] })),
    ).toBe(false);
  });

  it('스냅샷(JSON)에도 실린다 — 저장 직전 정규화를 거친 값으로', () => {
    const snapshot = createSceneSnapshot(
      scene({
        rulers: [
          ruler({
            textColor: '#FFAA00',
            guide: { length: 10, color: '#ffffff', side: 'left' },
          }),
        ],
      }),
    );
    const parsed = JSON.parse(snapshot!) as SavedSceneInfo;
    expect(parsed.rulers?.[0].textColor).toBe('#ffaa00');
    expect(parsed.rulers?.[0].guide).not.toHaveProperty('side');
    // 눈금이 없는 씬은 필드가 생기지 않는다.
    expect(JSON.parse(createSceneSnapshot(scene())!)).not.toHaveProperty(
      'rulers',
    );
  });
});

describe('isSceneInfoEqual — 태그 맵핑의 라벨 표시', () => {
  function mapped(overrides: Record<string, unknown> = {}): SavedModelInfo {
    return model({
      tagMappings: [
        {
          id: 'tm1',
          target: { kind: 'node', node: '', channel: 'position', axis: 'z' },
          tagKey: 'GC_04:gantry_position',
          ...overrides,
        },
      ],
    });
  }

  it('라벨 표시를 켜면 dirty — 빠지면 체크가 저장되지 않는다', () => {
    expect(
      isSceneInfoEqual(
        scene({ models: [mapped()] }),
        scene({ models: [mapped({ showOnLabel: true })] }),
      ),
    ).toBe(false);
  });

  it('이름 변경은 dirty 로 잡힌다', () => {
    expect(
      isSceneInfoEqual(
        scene({ models: [mapped({ showOnLabel: true, caption: '주행' })] }),
        scene({ models: [mapped({ showOnLabel: true, caption: '횡행' })] }),
      ),
    ).toBe(false);
  });

  it('표시 없음·false·undefined 는 같고, 이름 없음·빈 문자열도 같다', () => {
    expect(
      isSceneInfoEqual(
        scene({ models: [mapped()] }),
        scene({
          models: [mapped({ showOnLabel: false, caption: '' })],
        }),
      ),
    ).toBe(true);
    expect(
      isSceneInfoEqual(
        scene({ models: [mapped()] }),
        scene({
          models: [mapped({ showOnLabel: undefined, caption: undefined })],
        }),
      ),
    ).toBe(true);
  });
});
