import { describe, expect, it } from 'vitest';
import type {
  SavedModelInfo,
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
      isSceneInfoEqual(scene({ models: [model()] }), scene({ models: [model()] })),
    ).toBe(true);
  });
});

describe('isSceneInfoEqual — environmentId 3-상태', () => {
  it('undefined(미지정)와 null(배경 없음)은 다른 상태다', () => {
    expect(isSceneInfoEqual(scene(), scene({ environmentId: null }))).toBe(false);
    expect(
      isSceneInfoEqual(scene({ environmentId: 'sky' }), scene({ environmentId: 'sky' })),
    ).toBe(true);
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
    expect(isSceneInfoEqual(scene(), scene({ lighting: { shadows: true } }))).toBe(
      false,
    );
    expect(
      isSceneInfoEqual(scene(), scene({ lighting: { sunAzimuth: 90 } })),
    ).toBe(false);
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
          models: [model({ tagMappings: [{ ...b, offset: 0 }, { ...a, scale: 1 }] })],
        }),
      ),
    ).toBe(true);
    // 대상(축)·태그·scale 변경은 감지
    expect(
      isSceneInfoEqual(
        scene({ models: [model({ tagMappings: [a] })] }),
        scene({ models: [model({ tagMappings: [{ ...a, target: { ...a.target, axis: 'x' } }] })] }),
      ),
    ).toBe(false);
    expect(
      isSceneInfoEqual(
        scene({ models: [model({ tagMappings: [a] })] }),
        scene({ models: [model({ tagMappings: [{ ...a, tagKey: 'other' }] })] }),
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
        scene({ models: [model({ meshOverrides: [{ ...o1, opacity: 0.9 }] })] }),
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

describe('createSceneSnapshot', () => {
  it('null은 null', () => {
    expect(createSceneSnapshot(null)).toBeNull();
  });

  it('sanitize를 거친 JSON 문자열 — 정규화가 같으면 스냅샷도 같다', () => {
    // 기본값 조명은 sanitize가 필드를 생략하므로 두 씬의 스냅샷이 일치한다.
    const a = createSceneSnapshot(scene());
    const b = createSceneSnapshot(
      scene({ lighting: { shadows: false, sunAzimuth: SCENE_SUN_AZIMUTH_DEFAULT } }),
    );
    expect(a).toBeTypeOf('string');
    expect(a).toBe(b);
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
            rig({ joints: [{ id: 'a', node: '[0]A', type: 'hinge', axis: 'y' }] }),
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
