import { defineConfig } from 'vitest/config';

// 기본은 node — 순수 로직 테스트가 DOM 없이 도는 게 원칙이다.
// localStorage 등 브라우저 API가 필요한 파일에만 `// @vitest-environment jsdom`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
