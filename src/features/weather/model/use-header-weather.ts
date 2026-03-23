import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  buildOpenMeteoCurrentWeatherUrl,
  getRegionWeatherTarget,
  parseOpenMeteoCurrentWeatherResponse,
  type WeatherFetchState,
  type WeatherLocationTarget,
  type WeatherSnapshot,
} from '@/entities/weather';

const CURRENT_LOCATION_LABEL_KEY = 'header.currentLocationWeather';

type HeaderWeatherState = {
  status: WeatherFetchState;
  snapshot: WeatherSnapshot | null;
  locationLabelKey: string | null;
};

type HeaderWeatherRequest =
  | {
      type: 'current-location';
      key: string;
      labelKey: string;
    }
  | {
      type: 'region';
      key: string;
      target: WeatherLocationTarget;
    }
  | {
      type: 'unavailable';
      key: string;
    };

type HeaderWeatherResult = {
  requestKey: string;
  status: Exclude<WeatherFetchState, 'loading'>;
  snapshot: WeatherSnapshot | null;
};

const CURRENT_LOCATION_WEATHER_REQUEST: HeaderWeatherRequest = {
  type: 'current-location',
  key: 'current-location',
  labelKey: CURRENT_LOCATION_LABEL_KEY,
};

const UNAVAILABLE_WEATHER_STATE: HeaderWeatherState = {
  status: 'unavailable',
  snapshot: null,
  locationLabelKey: null,
};

export function useHeaderWeather(): HeaderWeatherState {
  const { pathname } = useLocation();
  const request = useMemo(
    () => resolveHeaderWeatherRequest(pathname),
    [pathname],
  );
  const [result, setResult] = useState<HeaderWeatherResult>({
    requestKey: '',
    status: 'unavailable',
    snapshot: null,
  });

  useEffect(() => {
    if (request.type === 'unavailable') {
      return undefined;
    }

    const abortController = new AbortController();
    let isDisposed = false;

    if (request.type === 'region') {
      void loadWeather(request.target, abortController.signal).then(
        (snapshot) => {
          if (isDisposed || abortController.signal.aborted) {
            return;
          }

          setResult({
            requestKey: request.key,
            status: snapshot ? 'success' : 'unavailable',
            snapshot,
          });
        },
      );

      return () => {
        isDisposed = true;
        abortController.abort();
      };
    }

    if (
      typeof window === 'undefined' ||
      !window.isSecureContext ||
      !('geolocation' in navigator)
    ) {
      queueMicrotask(() => {
        if (isDisposed || abortController.signal.aborted) {
          return;
        }

        setResult({
          requestKey: request.key,
          status: 'unavailable',
          snapshot: null,
        });
      });

      return undefined;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (isDisposed || abortController.signal.aborted) {
          return;
        }

        const currentLocationTarget: WeatherLocationTarget = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          labelKey: CURRENT_LOCATION_LABEL_KEY,
          source: 'current-location',
        };

        void loadWeather(currentLocationTarget, abortController.signal).then(
          (snapshot) => {
            if (isDisposed || abortController.signal.aborted) {
              return;
            }

            setResult({
              requestKey: request.key,
              status: snapshot ? 'success' : 'unavailable',
              snapshot,
            });
          },
        );
      },
      () => {
        if (isDisposed || abortController.signal.aborted) {
          return;
        }

        setResult({
          requestKey: request.key,
          status: 'unavailable',
          snapshot: null,
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 300000,
      },
    );

    return () => {
      isDisposed = true;
      abortController.abort();
    };
  }, [request]);

  if (request.type === 'unavailable') {
    return UNAVAILABLE_WEATHER_STATE;
  }

  if (result.requestKey !== request.key) {
    return {
      status: 'loading',
      snapshot: null,
      locationLabelKey:
        request.type === 'region' ? request.target.labelKey : request.labelKey,
    };
  }

  if (result.status === 'success' && result.snapshot) {
    return {
      status: 'success',
      snapshot: result.snapshot,
      locationLabelKey:
        request.type === 'region' ? request.target.labelKey : request.labelKey,
    };
  }

  return UNAVAILABLE_WEATHER_STATE;
}

async function loadWeather(
  target: WeatherLocationTarget,
  signal: AbortSignal,
): Promise<WeatherSnapshot | null> {
  try {
    const response = await fetch(
      buildOpenMeteoCurrentWeatherUrl(target.latitude, target.longitude),
      { signal },
    );

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as {
      current?: {
        temperature_2m?: number;
        weather_code?: number;
        is_day?: number;
      };
    };

    return parseOpenMeteoCurrentWeatherResponse(json);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null;
    }

    return null;
  }
}

function getRegionIdFromPathname(pathname: string) {
  const matchedPath = pathname.match(
    /^\/(?:outdoor-work|indoor-work)\/([^/]+)(?:\/.*)?$/,
  );

  if (!matchedPath) {
    return null;
  }

  return decodeURIComponent(matchedPath[1]);
}

function resolveHeaderWeatherRequest(pathname: string): HeaderWeatherRequest {
  const regionId = getRegionIdFromPathname(pathname);

  if (regionId) {
    const target = getRegionWeatherTarget(regionId);

    if (!target) {
      return {
        type: 'unavailable',
        key: `unavailable:${pathname}`,
      };
    }

    return {
      type: 'region',
      key: `region:${regionId}`,
      target,
    };
  }

  if (pathname === '/' || pathname === '/region-overview') {
    return CURRENT_LOCATION_WEATHER_REQUEST;
  }

  return {
    type: 'unavailable',
    key: `unavailable:${pathname}`,
  };
}

export type { HeaderWeatherState };
