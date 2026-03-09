import { createBrowserRouter, Navigate } from 'react-router-dom';

import { MainPage } from '@/pages/main';
import { IndoorWorkPage } from '@/pages/indoor-work';
import { OutdoorWorkPage } from '@/pages/outdoor-work';

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <MainPage />,
  },
  {
    path: '/indoor-work',
    element: <IndoorWorkPage />,
  },
  {
    path: '/outdoor-work',
    element: <OutdoorWorkPage />,
  },
  {
    path: '*',
    element: <Navigate replace to="/" />,
  },
]);
