export interface MainHeroShortcut {
  title: string;
  description: string;
  route: '/indoor-work' | '/outdoor-work';
}

export const mainHeroShortcuts: MainHeroShortcut[] = [
  {
    title: '\uc2e4\ub0b4 \uc791\uc5c5',
    description: '\ucc3d\uace0, \uc2e4\ub0b4 \uc124\ube44 \ubaa8\ub2c8\ud130\ub9c1 \ud654\uba74',
    route: '/indoor-work',
  },
  {
    title: '\uc2e4\uc678 \uc791\uc5c5',
    description: '\uc57c\ub4dc, \ud56d\ub9cc \uc124\ube44 3D \ubaa8\ub2c8\ud130\ub9c1 \ud654\uba74',
    route: '/outdoor-work',
  },
];
