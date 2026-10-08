import { describe, expect, it } from 'vitest';
import { isValidTimeZone } from '@crane/core/lib/time-zone';
import { sites } from '../../../region/model/sites';
import { SCENE_FILE_NAME_BY_REGION_ID } from '../../model/scene-file-map';
import {
  SCENE_SITE_GEO_BY_LOCATION,
  SCENE_SITE_LOCATIONS,
  SCENE_SITE_LOCATION_BY_REGION_ID,
  formatSceneSiteLocation,
  isSceneSiteLocation,
  resolveSceneSiteGeo,
  resolveSceneSiteLocation,
} from '../../model/scene-site-geo';

describe('scene-site-geo', () => {
  it('씬 파일이 등록된 모든 region 에 기본 지역이 있다', () => {
    for (const regionId of Object.keys(SCENE_FILE_NAME_BY_REGION_ID)) {
      expect(resolveSceneSiteLocation(regionId, undefined), regionId).not.toBe(
        null,
      );
    }
  });

  it('드롭다운 목록과 좌표 표의 지역이 일치한다', () => {
    expect(Object.keys(SCENE_SITE_GEO_BY_LOCATION).sort()).toEqual(
      [...SCENE_SITE_LOCATIONS].sort(),
    );
    for (const location of Object.values(SCENE_SITE_LOCATION_BY_REGION_ID)) {
      expect(SCENE_SITE_LOCATIONS).toContain(location);
    }
  });

  it('위경도는 유효 범위, 시간대는 이 런타임의 Intl 이 아는 이름이다', () => {
    for (const [location, geo] of Object.entries(SCENE_SITE_GEO_BY_LOCATION)) {
      expect(Math.abs(geo.latitude), location).toBeLessThanOrEqual(90);
      expect(Math.abs(geo.longitude), location).toBeLessThanOrEqual(180);
      expect(isValidTimeZone(geo.timeZone), location).toBe(true);
    }
  });

  it('region 기본 지역의 좌표는 그 region 이 속한 조선소(site.center)다', () => {
    for (const site of sites) {
      for (const region of site.regions) {
        const geo = resolveSceneSiteGeo(region.id, undefined);
        if (!geo) continue;
        expect(geo.latitude, region.id).toBeCloseTo(site.center.lat, 3);
        expect(geo.longitude, region.id).toBeCloseTo(site.center.lng, 3);
      }
    }
  });

  it('거제는 Asia/Seoul, 필라델피아는 America/New_York', () => {
    expect(resolveSceneSiteGeo('dock-1', undefined)?.timeZone).toBe(
      'Asia/Seoul',
    );
    expect(resolveSceneSiteGeo('dock-in', null)?.timeZone).toBe('Asia/Seoul');
    expect(resolveSceneSiteGeo('philly-dock-2', {})?.timeZone).toBe(
      'America/New_York',
    );
  });

  describe('resolveSceneSiteLocation', () => {
    it('명시값이 region 기본값보다 우선한다', () => {
      expect(
        resolveSceneSiteLocation('dock-1', {
          siteLocation: 'america-new-york',
        }),
      ).toBe('america-new-york');
      expect(
        resolveSceneSiteGeo('dock-1', { siteLocation: 'america-new-york' }),
      ).toBe(SCENE_SITE_GEO_BY_LOCATION['america-new-york']);
    });

    it('명시값이 region 기본값과 같아도 그대로 쓴다', () => {
      expect(
        resolveSceneSiteLocation('dock-1', { siteLocation: 'asia-seoul' }),
      ).toBe('asia-seoul');
    });

    it('목록에 없는 값·비문자열은 미지정으로 보고 region 기본값으로 떨어진다', () => {
      const polluted = [
        'europe-paris',
        'Asia/Seoul',
        '',
        'toString',
        1,
        true,
        null,
        {},
      ];
      for (const siteLocation of polluted) {
        const sceneInfo = { siteLocation } as unknown as Parameters<
          typeof resolveSceneSiteLocation
        >[1];
        expect(
          resolveSceneSiteLocation('philly-dock-2', sceneInfo),
          String(siteLocation),
        ).toBe('america-new-york');
      }
    });

    it('미등록 region 은 명시값이 있으면 그 지역, 없으면 null', () => {
      expect(
        resolveSceneSiteGeo('nowhere', { siteLocation: 'asia-seoul' }),
      ).toBe(SCENE_SITE_GEO_BY_LOCATION['asia-seoul']);
      expect(resolveSceneSiteLocation('nowhere', undefined)).toBeNull();
      expect(resolveSceneSiteGeo('nowhere', {})).toBeNull();
      expect(resolveSceneSiteGeo('', null)).toBeNull();
    });

    it('Object 프로토타입 키를 region id 로 받아도 지역이 생기지 않는다', () => {
      expect(resolveSceneSiteLocation('toString', undefined)).toBeNull();
      expect(resolveSceneSiteLocation('constructor', undefined)).toBeNull();
    });
  });

  describe('formatSceneSiteLocation', () => {
    it('IANA 시간대 이름이고 밑줄은 공백이다', () => {
      expect(formatSceneSiteLocation('asia-seoul')).toBe('Asia/Seoul');
      expect(formatSceneSiteLocation('america-new-york')).toBe(
        'America/New York',
      );
    });

    it('모든 지역의 이름이 서로 다르고 비어 있지 않다', () => {
      const labels = SCENE_SITE_LOCATIONS.map(formatSceneSiteLocation);
      expect(new Set(labels).size).toBe(labels.length);
      for (const label of labels) {
        expect(label.trim()).not.toBe('');
        expect(label).not.toContain('_');
      }
    });
  });

  describe('isSceneSiteLocation', () => {
    it('목록의 값만 true', () => {
      for (const location of SCENE_SITE_LOCATIONS) {
        expect(isSceneSiteLocation(location)).toBe(true);
      }
      expect(isSceneSiteLocation('ASIA-SEOUL')).toBe(false);
      expect(isSceneSiteLocation(' asia-seoul')).toBe(false);
      expect(isSceneSiteLocation(undefined)).toBe(false);
      expect(isSceneSiteLocation(['asia-seoul'])).toBe(false);
    });
  });
});
