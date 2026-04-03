import { useContext } from 'react';
import { NavigationProgressContext } from './navigation-progress-state';

export function useNavigationProgress() {
  const context = useContext(NavigationProgressContext);

  if (!context) {
    throw new Error(
      'useNavigationProgress must be used within NavigationProgressProvider.',
    );
  }

  return context;
}
