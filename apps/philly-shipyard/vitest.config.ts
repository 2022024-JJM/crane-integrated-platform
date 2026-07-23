import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // 필라델피아(미 동부) 타임존으로 고정 — 날짜 파싱 off-by-one 회귀 검증용
    setupFiles: ['src/test-setup.ts'],
  },
});
