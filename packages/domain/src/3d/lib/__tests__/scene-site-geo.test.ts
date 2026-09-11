import { describe, expect, it } from 'vitest';
import { isValidTimeZone } from '@crane/core/lib/time-zone';
import { regions } from '../../../region/model/mock-data';
import { SCENE_FILE_NAME_BY_REGION_ID } from '../../model/scene-file-map';
import {
  SCENE_SITE_GEO_BY_REGION_ID,
  getSceneSiteGeo,
} from '../../model/scene-site-geo';

describe('scene-site-geo', () => {
  it('씬 파일이 등록된 모든 region 에 현장 위치가 있다', () => {
    for (const regionId of Object.keys(SCENE_FILE_NAME_BY_REGION_ID)) {
      expect(getSceneSiteGeo(regionId), regionId).not.toBeNull();
    }
  });

  it('위경도는 유효 범위, 시간대는 이 런타임의 Intl 이 아는 이름이다', () => {
    for (const [regionId, geo] of Object.entries(SCENE_SITE_GEO_BY_REGION_ID)) {
      expect(Math.abs(geo.latitude), regionId).toBeLessThanOrEqual(90);
      expect(Math.abs(geo.longitude), regionId).toBeLessThanOrEqual(180);
      expect(isValidTimeZone(geo.timeZone), regionId).toBe(true);
    }
  });

  it('대시보드 지도 핀(region.center)이 있는 region 은 같은 좌표를 쓴다', () => {
    for (const region of regions) {
      if (!region.center) continue;
      const geo = getSceneSiteGeo(region.id);
      if (!geo) continue;
      expect(geo.latitude, region.id).toBeCloseTo(region.center.lat, 3);
      expect(geo.longitude, region.id).toBeCloseTo(region.center.lng, 3);
    }
  });

  it('거제는 Asia/Seoul, 필라델피아는 America/New_York', () => {
    expect(getSceneSiteGeo('dock-1')?.timeZone).toBe('Asia/Seoul');
    expect(getSceneSiteGeo('philly-dock-2')?.timeZone).toBe('America/New_York');
    expect(getSceneSiteGeo('goliath')?.timeZone).toBe('America/New_York');
  });

  it('미등록 region 은 null', () => {
    expect(getSceneSiteGeo('nowhere')).toBeNull();
    expect(getSceneSiteGeo('')).toBeNull();
  });
});
