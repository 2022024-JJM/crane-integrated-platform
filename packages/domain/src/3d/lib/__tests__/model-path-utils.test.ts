import { describe, expect, it } from 'vitest';
import { humanizeModelPath, normalizeModelLabel } from '../model-path-utils';

describe('humanizeModelPath', () => {
  it('경로에서 파일명만 취해 사람이 읽을 이름으로 바꾼다', () => {
    expect(humanizeModelPath('/models/goliath-crane.glb')).toBe(
      'Goliath Crane',
    );
  });

  it('언더스코어·하이픈 혼용을 공백으로 나눈다', () => {
    expect(humanizeModelPath('tower_crane-v2.glb')).toBe('Tower Crane V2');
  });

  it('.glb 확장자는 대소문자 무관하게 제거한다', () => {
    expect(humanizeModelPath('/maps/OKPO.GLB')).toBe('OKPO');
  });

  it('연속 구분자로 생긴 빈 조각은 버린다', () => {
    expect(humanizeModelPath('a__b--c.glb')).toBe('A B C');
  });

  it('구분자 없는 이름은 첫 글자만 대문자화한다', () => {
    expect(humanizeModelPath('crane.glb')).toBe('Crane');
  });

  it('확장자가 없어도 동작한다', () => {
    expect(humanizeModelPath('/models/tower-crane')).toBe('Tower Crane');
  });

  it('빈 문자열·구분자만 있는 경로는 빈 결과 (예외 경계)', () => {
    expect(humanizeModelPath('')).toBe('');
    expect(humanizeModelPath('___.glb')).toBe('');
    // 디렉터리로 끝나는 경로는 파일명이 없다.
    expect(humanizeModelPath('/models/')).toBe('');
  });
});

describe('normalizeModelLabel', () => {
  it('트림 + 연속 공백 축약 + 소문자화', () => {
    expect(normalizeModelLabel('  Goliath   Crane ')).toBe('goliath crane');
  });

  it('이미 정규화된 입력은 그대로', () => {
    expect(normalizeModelLabel('crane')).toBe('crane');
  });
});
