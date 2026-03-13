import { useState } from 'react';
import type { MonitoringMenuKey } from './types';

export function useMonitoringMenu() {
  const [activeMenu, setActiveMenu] = useState<MonitoringMenuKey>(
    'realtime-monitoring',
  );

  return { activeMenu, setActiveMenu };
}
