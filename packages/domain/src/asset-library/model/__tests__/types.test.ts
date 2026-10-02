import { describe, expect, it } from 'vitest';
import {
  ASSET_KINDS,
  isDocumentAssetKind,
  isGeometryAssetKind,
} from '../types';

describe('자산 종류 판정', () => {
  it('모델·지도만 형상이 있는 자산이다', () => {
    expect(ASSET_KINDS.filter(isGeometryAssetKind)).toEqual(['model', 'map']);
  });

  it('도면·CAD 만 문서형 자산이다', () => {
    expect(ASSET_KINDS.filter(isDocumentAssetKind)).toEqual(['drawing', 'cad']);
  });

  it('배경은 형상도 문서도 아니다 — 통계·기본 스케일도, 도면 번호도 없다', () => {
    expect(isGeometryAssetKind('environment')).toBe(false);
    expect(isDocumentAssetKind('environment')).toBe(false);
  });

  it('두 판정에 함께 걸리는 종류는 없다', () => {
    for (const kind of ASSET_KINDS) {
      expect(isGeometryAssetKind(kind) && isDocumentAssetKind(kind), kind).toBe(
        false,
      );
    }
  });
});
