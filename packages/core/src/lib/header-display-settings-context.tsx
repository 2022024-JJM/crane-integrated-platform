/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const HEADER_DISPLAY_SETTINGS_STORAGE_KEY = 'header-display-settings';

type HeaderDisplaySettings = {
  showDate: boolean;
  showTime: boolean;
  showWeather: boolean;
};

interface HeaderDisplaySettingsContextValue extends HeaderDisplaySettings {
  setSetting: (
    key: keyof HeaderDisplaySettings,
    value: HeaderDisplaySettings[keyof HeaderDisplaySettings],
  ) => void;
}

const DEFAULT_HEADER_DISPLAY_SETTINGS: HeaderDisplaySettings = {
  showDate: true,
  showTime: true,
  showWeather: true,
};

const HeaderDisplaySettingsContext =
  createContext<HeaderDisplaySettingsContextValue | null>(null);

function getInitialHeaderDisplaySettings(): HeaderDisplaySettings {
  if (typeof window === 'undefined') {
    return DEFAULT_HEADER_DISPLAY_SETTINGS;
  }

  const storedSettings = localStorage.getItem(
    HEADER_DISPLAY_SETTINGS_STORAGE_KEY,
  );

  if (!storedSettings) {
    return DEFAULT_HEADER_DISPLAY_SETTINGS;
  }

  try {
    const parsedSettings = JSON.parse(
      storedSettings,
    ) as Partial<HeaderDisplaySettings> | null;

    return {
      showDate:
        typeof parsedSettings?.showDate === 'boolean'
          ? parsedSettings.showDate
          : DEFAULT_HEADER_DISPLAY_SETTINGS.showDate,
      showTime:
        typeof parsedSettings?.showTime === 'boolean'
          ? parsedSettings.showTime
          : DEFAULT_HEADER_DISPLAY_SETTINGS.showTime,
      showWeather:
        typeof parsedSettings?.showWeather === 'boolean'
          ? parsedSettings.showWeather
          : DEFAULT_HEADER_DISPLAY_SETTINGS.showWeather,
    };
  } catch {
    return DEFAULT_HEADER_DISPLAY_SETTINGS;
  }
}

export function HeaderDisplaySettingsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [settings, setSettings] = useState<HeaderDisplaySettings>(
    getInitialHeaderDisplaySettings,
  );

  useEffect(() => {
    localStorage.setItem(
      HEADER_DISPLAY_SETTINGS_STORAGE_KEY,
      JSON.stringify(settings),
    );
  }, [settings]);

  const setSetting = useCallback(
    (
      key: keyof HeaderDisplaySettings,
      value: HeaderDisplaySettings[keyof HeaderDisplaySettings],
    ) => {
      setSettings((currentSettings) => ({
        ...currentSettings,
        [key]: value,
      }));
    },
    [],
  );

  const value = useMemo(
    () => ({ ...settings, setSetting }),
    [settings, setSetting],
  );

  return (
    <HeaderDisplaySettingsContext value={value}>
      {children}
    </HeaderDisplaySettingsContext>
  );
}

export function useHeaderDisplaySettings() {
  const context = use(HeaderDisplaySettingsContext);

  if (!context) {
    throw new Error(
      'useHeaderDisplaySettings must be used within a HeaderDisplaySettingsProvider',
    );
  }

  return context;
}

export type { HeaderDisplaySettings };
