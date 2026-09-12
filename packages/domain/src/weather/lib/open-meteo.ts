import type { WeatherConditionCode, WeatherSnapshot } from '../model/types';
import { openMeteoClient } from '../api/open-meteo-client';

interface OpenMeteoCurrentWeatherResponse {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    is_day?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
  };
}

const WEATHER_CONDITION_CODES: WeatherConditionCode[] = [
  0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77,
  80, 81, 82, 85, 86, 95, 96, 99,
];

export async function fetchOpenMeteoCurrentWeather(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<WeatherSnapshot | null> {
  try {
    const response = await openMeteoClient.get<OpenMeteoCurrentWeatherResponse>(
      '/v1/forecast',
      {
        query: {
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          current:
            'temperature_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m',
          temperature_unit: 'celsius',
          wind_speed_unit: 'ms',
        },
        signal,
      },
    );

    return parseOpenMeteoCurrentWeatherResponse(response);
  } catch {
    return null;
  }
}

export function parseOpenMeteoCurrentWeatherResponse(
  response: OpenMeteoCurrentWeatherResponse,
): WeatherSnapshot | null {
  const temperature = response.current?.temperature_2m;
  const weatherCode = response.current?.weather_code;
  const isDay = response.current?.is_day;

  if (
    typeof temperature !== 'number' ||
    !isWeatherConditionCode(weatherCode) ||
    typeof isDay !== 'number'
  ) {
    return null;
  }

  const windSpeed = response.current?.wind_speed_10m;
  const windDirection = response.current?.wind_direction_10m;

  return {
    temperature,
    conditionCode: weatherCode,
    isDay: isDay === 1,
    // 바람은 선택 — 없어도 기존 날씨 표시(온도·아이콘)는 그대로 동작한다.
    windSpeed:
      typeof windSpeed === 'number' &&
      Number.isFinite(windSpeed) &&
      windSpeed >= 0
        ? windSpeed
        : null,
    windDirection:
      typeof windDirection === 'number' && Number.isFinite(windDirection)
        ? windDirection
        : null,
  };
}

function isWeatherConditionCode(
  weatherCode: number | undefined,
): weatherCode is WeatherConditionCode {
  return (
    typeof weatherCode === 'number' &&
    WEATHER_CONDITION_CODES.includes(weatherCode as WeatherConditionCode)
  );
}
