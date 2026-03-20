import { createContext } from 'react';

export type ProgressToken = number;

export interface NavigationProgressContextValue {
  isVisible: boolean;
  progress: number;
  start: () => ProgressToken;
  advance: (value?: number) => void;
  complete: (token?: ProgressToken) => void;
  reset: () => void;
  startNavigation: () => void;
  completeNavigation: () => void;
}

export const NavigationProgressContext =
  createContext<NavigationProgressContextValue | null>(null);
