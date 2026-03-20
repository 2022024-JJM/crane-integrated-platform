import {
  CircleHelp,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  type LucideProps,
} from 'lucide-react';
import type { WeatherFetchState, WeatherIconKey } from '../model/types';

const WEATHER_ICON_BY_KEY = {
  sun: Sun,
  moon: Moon,
  'cloud-sun': CloudSun,
  'cloud-moon': CloudMoon,
  cloud: Cloud,
  'cloud-rain': CloudRain,
  'cloud-snow': CloudSnow,
  'cloud-fog': CloudFog,
  'cloud-lightning': CloudLightning,
} satisfies Record<WeatherIconKey, typeof Sun>;

export function WeatherIcon({
  status,
  iconKey,
  ...props
}: {
  status: WeatherFetchState;
  iconKey?: WeatherIconKey;
} & LucideProps) {
  const Icon =
    status === 'success' && iconKey ? WEATHER_ICON_BY_KEY[iconKey] : CircleHelp;

  return <Icon {...props} />;
}
