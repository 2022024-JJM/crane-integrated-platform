import { defineConfig } from 'vitest/config';

/*
 * 원본(ocean-inshop-process/web-dashboard vite.config.ts)의 테스트 설정을 그대로
 * 옮긴 것 — 확장자가 곧 환경이다.
 *
 *   `*.test.ts`  → node.  순수 계산·데이터 규약. jsdom 을 띄우지 않아 전량이 수초 안에 끝난다.
 *   `*.test.tsx` → jsdom. 화면(React)을 실제로 그려 보는 검증.
 *
 * 노드 테스트에 jsdom 을 얹으면 전체 실행 시간이 몇 배로 늘므로 섞지 않는다.
 */
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./src/dashboard/shared/lib/testing/setupDom.ts'],
          /*
           * (이식) 직렬로 돌린다. 모노레포에서는 워커가 원본 단독 레포보다 무거워,
           * 병렬이면 CPU 경합으로 waitFor 류가 간헐적으로 시간 초과된다 — 같은
           * 스위트가 직렬에서는 전량 통과함을 확인했다. dom 은 200여 건이라
           * 직렬 비용이 작다. (upstream 도 병렬에서 같은 부류의 flake 가 있다.)
           */
          fileParallelism: false,
        },
      },
    ],
  },
});
