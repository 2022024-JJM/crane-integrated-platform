import { defineConfig } from 'vitest/config';

// 기본은 node — 순수 로직 테스트가 DOM 없이 도는 게 원칙이다.
// 훅/스토어 테스트가 필요한 파일에만 `// @vitest-environment jsdom`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // jsdom 캔버스 스텁 — three/examples 모듈이 로드 시점에 2D 컨텍스트를 요구한다.
    setupFiles: ['src/test-setup.ts'],
  },
});
