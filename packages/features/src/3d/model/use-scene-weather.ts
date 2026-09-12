import { useEffect, useState } from 'react';
import { getSceneSiteGeo } from '@crane/domain/3d';
import {
  fetchOpenMeteoCurrentWeather,
  type WeatherSnapshot,
} from '@crane/domain/weather';

/** 갱신 주기 — open-meteo 현재 날씨는 15분 단위로 바뀐다. */
export const SCENE_WEATHER_REFRESH_MS = 10 * 60 * 1_000;

/**
 * 3D 관제 HUD 용 현장 날씨(풍속·풍향). 위치는 씬 현장 표(scene-site-geo —
 * solar 낮/밤과 같은 좌표)에서 region 으로 찾는다. 헤더의 useHeaderWeather
 * 는 라우트 경로 기반이고 옥포 독 좌표만 알아 필리 씬에 쓸 수 없어 따로 둔다
 * (요청 하나가 더 나가지만 10분에 한 번이다). 실패·미등록 region 은 null —
 * HUD 는 풍속 칸을 "정보 없음"으로 둔다.
 */
export function useSceneWeather(regionId: string): WeatherSnapshot | null {
  const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null);

  useEffect(() => {
    const geo = getSceneSiteGeo(regionId);
    if (!geo) {
      setSnapshot(null);
      return;
    }
    let disposed = false;
    let controller = new AbortController();
    const load = () => {
      controller.abort();
      controller = new AbortController();
      void fetchOpenMeteoCurrentWeather(
        geo.latitude,
        geo.longitude,
        controller.signal,
      ).then((next) => {
        if (disposed) return;
        setSnapshot(next);
      });
    };
    load();
    const timer = window.setInterval(load, SCENE_WEATHER_REFRESH_MS);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [regionId]);

  return snapshot;
}
