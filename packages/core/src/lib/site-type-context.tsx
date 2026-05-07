import {
  createContext,
  use,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

export type SiteType =
  | 'hanwha-ocean'
  | 'goliath-crane'
  | 'philly-shipyard'
  | 'crane-hmi';

interface SiteTypeContextValue {
  siteType: SiteType;
  setSiteType: (type: SiteType) => void;
}

const STORAGE_KEY = 'site-type';

function getInitialSiteType(): SiteType {
  if (typeof window === 'undefined') return 'hanwha-ocean';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (
    stored === 'hanwha-ocean' ||
    stored === 'goliath-crane' ||
    stored === 'philly-shipyard' ||
    stored === 'crane-hmi'
  ) {
    return stored;
  }
  return 'hanwha-ocean';
}

const SiteTypeContext = createContext<SiteTypeContextValue | null>(null);

export function SiteTypeProvider({ children }: { children: ReactNode }) {
  const [siteType, setSiteTypeState] = useState<SiteType>(getInitialSiteType);

  const setSiteType = useCallback((type: SiteType) => {
    setSiteTypeState(type);
    localStorage.setItem(STORAGE_KEY, type);
  }, []);

  const value = useMemo(
    () => ({ siteType, setSiteType }),
    [siteType, setSiteType],
  );

  return <SiteTypeContext value={value}>{children}</SiteTypeContext>;
}

export function useSiteType() {
  const context = use(SiteTypeContext);
  if (!context) {
    throw new Error('useSiteType must be used within a SiteTypeProvider');
  }
  return context;
}
