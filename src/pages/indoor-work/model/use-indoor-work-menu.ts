import { useState } from 'react';

import type { MonitoringMenuKey } from '@/entities/monitoring/menu';

export function useIndoorWorkMenu() {
  const [activeMenu, setActiveMenu] = useState<MonitoringMenuKey>(
    'realtime-monitoring',
  );

  return { activeMenu, setActiveMenu };
}
