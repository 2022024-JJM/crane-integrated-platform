import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Loader,
  MapPinOff,
  Moon,
  Sun,
  type LucideProps,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
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

const WEATHER_ICON_COLOR_BY_KEY = {
  sun: 'text-amber-500 dark:text-amber-300',
  moon: 'text-sky-400 dark:text-sky-300',
  'cloud-sun': 'text-amber-500 dark:text-amber-300',
  'cloud-moon': 'text-sky-400 dark:text-sky-300',
  cloud: 'text-slate-500 dark:text-slate-300',
  'cloud-rain': 'text-blue-500 dark:text-blue-300',
  'cloud-snow': 'text-cyan-400 dark:text-cyan-200',
  'cloud-fog': 'text-zinc-400 dark:text-zinc-300',
  'cloud-lightning': 'text-yellow-500 dark:text-yellow-300',
} satisfies Record<WeatherIconKey, string>;

export function WeatherIcon({
  status,
  iconKey,
  ...props
}: {
  status: WeatherFetchState;
  iconKey?: WeatherIconKey;
} & LucideProps) {
  const Icon =
    status === 'success' && iconKey
      ? WEATHER_ICON_BY_KEY[iconKey]
      : status === 'loading'
        ? Loader
        : MapPinOff;
  const iconColorClassName =
    status === 'success' && iconKey
      ? WEATHER_ICON_COLOR_BY_KEY[iconKey]
      : 'text-muted-foreground';

  return (
    <Icon {...props} className={cn(props.className, iconColorClassName)} />
  );
}
