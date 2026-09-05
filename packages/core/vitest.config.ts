import { defineConfig } from 'vitest/config';

// 기본은 node — 순수 로직 테스트가 DOM 없이 도는 게 원칙이다.
// 훅 테스트가 필요한 파일에만 `// @vitest-environment jsdom`.
// three 를 끌어오지 않는 패키지라 features/widgets 의 캔버스 스텁은 필요 없다.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
