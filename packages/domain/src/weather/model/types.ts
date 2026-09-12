export type WeatherConditionCode =
  | 0
  | 1
  | 2
  | 3
  | 45
  | 48
  | 51
  | 53
  | 55
  | 56
  | 57
  | 61
  | 63
  | 65
  | 66
  | 67
  | 71
  | 73
  | 75
  | 77
  | 80
  | 81
  | 82
  | 85
  | 86
  | 95
  | 96
  | 99;

export type WeatherFetchState = 'loading' | 'success' | 'unavailable';

export type WeatherIconKey =
  | 'sun'
  | 'moon'
  | 'cloud-sun'
  | 'cloud-moon'
  | 'cloud'
  | 'cloud-rain'
  | 'cloud-snow'
  | 'cloud-fog'
  | 'cloud-lightning';

export type WeatherLocationSource = 'site' | 'region';

export type WeatherSiteId = 'geoje';

export interface WeatherSnapshot {
  temperature: number;
  conditionCode: WeatherConditionCode;
  isDay: boolean;
  /** 10m 풍속(m/s). 응답에 없으면 null — 크레인 작업 판단용(3D 관제 HUD). */
  windSpeed: number | null;
  /** 풍향(도, 바람이 불어오는 방위, 0=북). 없으면 null. */
  windDirection: number | null;
}

export interface WeatherLocationTarget {
  latitude: number;
  longitude: number;
  labelKey: string;
  source: WeatherLocationSource;
}
