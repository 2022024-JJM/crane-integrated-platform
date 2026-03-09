import { useEffect, useMemo, useState } from 'react';

interface SiteWeatherOption {
  regionName?: string;
}

interface SiteWeatherState {
  label: string;
  temperatureLabel: string;
}

interface SiteLocation {
  label: string;
  latitude: number;
  longitude: number;
}

const DEFAULT_LOCATION: SiteLocation = {
  label: '부산',
  latitude: 35.1796,
  longitude: 129.0756,
};

const SITE_LOCATION_MAP: Record<string, SiteLocation> = {
  부산: DEFAULT_LOCATION,
  인천: { label: '인천', latitude: 37.4563, longitude: 126.7052 },
  광양: { label: '광양', latitude: 34.9407, longitude: 127.6959 },
  평택: { label: '평택', latitude: 36.9921, longitude: 127.1127 },
  군산: { label: '군산', latitude: 35.9677, longitude: 126.7369 },
  포항: { label: '포항', latitude: 36.0190, longitude: 129.3435 },
  목포: { label: '목포', latitude: 34.8118, longitude: 126.3922 },
  여수: { label: '여수', latitude: 34.7604, longitude: 127.6622 },
};

const WEATHER_LABEL_MAP: Record<number, string> = {
  0: '맑음',
  1: '대체로 맑음',
  2: '구름 조금',
  3: '흐림',
  45: '안개',
  48: '서리 안개',
  51: '이슬비',
  53: '약한 비',
  55: '비',
  56: '약한 어는비',
  57: '어는비',
  61: '약한 비',
  63: '비',
  65: '강한 비',
  66: '약한 진눈깨비',
  67: '진눈깨비',
  71: '약한 눈',
  73: '눈',
  75: '강한 눈',
  77: '싸락눈',
  80: '소나기',
  81: '강한 소나기',
  82: '매우 강한 소나기',
  85: '약한 눈 소나기',
  86: '강한 눈 소나기',
  95: '뇌우',
  96: '약한 우박 뇌우',
  99: '강한 우박 뇌우',
};

function resolveLocation(regionName?: string) {
  if (!regionName) return DEFAULT_LOCATION;
  return SITE_LOCATION_MAP[regionName] ?? DEFAULT_LOCATION;
}

export function useSiteWeather({ regionName }: SiteWeatherOption) {
  const location = useMemo(() => resolveLocation(regionName), [regionName]);
  const [weather, setWeather] = useState<SiteWeatherState>({
    label: `${location.label} 날씨 확인 중`,
    temperatureLabel: '--°C',
  });

  useEffect(() => {
    const controller = new AbortController();

    async function fetchWeather() {
      try {
        const params = new URLSearchParams({
          latitude: String(location.latitude),
          longitude: String(location.longitude),
          current: 'temperature_2m,weather_code',
          timezone: 'Asia/Seoul',
        });

        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error(`Weather request failed: ${response.status}`);
        }

        const data = (await response.json()) as {
          current?: { temperature_2m?: number; weather_code?: number };
        };

        const temperature = data.current?.temperature_2m;
        const weatherCode = data.current?.weather_code;

        setWeather({
          label: WEATHER_LABEL_MAP[weatherCode ?? -1] ?? '날씨 정보 없음',
          temperatureLabel:
            typeof temperature === 'number'
              ? `${Math.round(temperature)}°C`
              : '--°C',
        });
      } catch (error) {
        if (controller.signal.aborted) return;

        setWeather({
          label: '날씨 정보 없음',
          temperatureLabel: '--°C',
        });
      }
    }

    void fetchWeather();

    return () => controller.abort();
  }, [location]);

  return {
    weatherLabel: weather.label,
    temperatureLabel: weather.temperatureLabel,
    siteLabel: location.label,
  };
}
