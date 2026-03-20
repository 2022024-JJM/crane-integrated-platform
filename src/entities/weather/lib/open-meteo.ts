import type { WeatherConditionCode, WeatherSnapshot } from '../model/types';

interface OpenMeteoCurrentWeatherResponse {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    is_day?: number;
  };
}

const WEATHER_CONDITION_CODES: WeatherConditionCode[] = [
  0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77,
  80, 81, 82, 85, 86, 95, 96, 99,
];

export function buildOpenMeteoCurrentWeatherUrl(
  latitude: number,
  longitude: number,
) {
  const searchParams = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current: 'temperature_2m,weather_code,is_day',
    temperature_unit: 'celsius',
  });

  return `https://api.open-meteo.com/v1/forecast?${searchParams.toString()}`;
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

  return {
    temperature,
    conditionCode: weatherCode,
    isDay: isDay === 1,
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
