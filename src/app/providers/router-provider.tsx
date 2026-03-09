import { RouterProvider } from 'react-router-dom';

import { appRouter } from '@/app/providers/router';

export function AppRouterProvider() {
  return <RouterProvider router={appRouter} />;
}
