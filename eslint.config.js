import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// ── FSD layer boundary messages ──────────────────────────────────────────────

const fsdLayerMessages = {
  domain:
    'domain(entities) can import from @crane/core and @crane/ui only, not from features/widgets/apps.',
  features:
    'features can import from domain/core/ui, but not from widgets or apps.',
  widgets:
    'widgets can import from features/domain/core/ui, but not from apps.',
  shared:
    'shared (@crane/core, @crane/ui) must not import from domain/features/widgets/apps.',
}

function createBoundaryRule(patterns) {
  return [
    'error',
    {
      patterns,
    },
  ]
}

// ── Public API enforcement (no deep imports into slice internals) ─────────────

const publicApiPatterns = [
  {
    group: [
      '@crane/features/*/{ui,model,lib,config}/*',
      '@crane/features/*/*/{ui,model,lib,config}/*',
      '@crane/widgets/*/{ui,model,lib,config}/*',
      '@crane/widgets/*/*/{ui,model,lib,config}/*',
      '@crane/domain/*/{ui,model,lib,config}/*',
      '@crane/domain/*/*/{ui,model,lib,config}/*',
    ],
    message:
      'Use the slice public API (`index.ts`) instead of importing slice internals directly.',
  },
]

// ── Config ───────────────────────────────────────────────────────────────────

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // shared layer (@crane/core, @crane/ui) — must not import upper layers
  {
    files: ['packages/core/src/**/*.{ts,tsx}', 'packages/ui/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createBoundaryRule([
        {
          group: [
            '@crane/domain',
            '@crane/domain/*',
            '@crane/features',
            '@crane/features/*',
            '@crane/widgets',
            '@crane/widgets/*',
            '@crane/hanwha-ocean',
            '@crane/hanwha-ocean/*',
            '@crane/goliath-crane',
            '@crane/goliath-crane/*',
          ],
          message: fsdLayerMessages.shared,
        },
      ]),
    },
  },

  // domain/entities layer (@crane/domain) — only core, ui
  {
    files: ['packages/domain/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createBoundaryRule([
        ...publicApiPatterns,
        {
          group: [
            '@crane/features',
            '@crane/features/*',
            '@crane/widgets',
            '@crane/widgets/*',
            '@crane/hanwha-ocean',
            '@crane/hanwha-ocean/*',
            '@crane/goliath-crane',
            '@crane/goliath-crane/*',
          ],
          message: fsdLayerMessages.domain,
        },
      ]),
    },
  },

  // features layer (@crane/features) — domain, core, ui
  {
    files: ['packages/features/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createBoundaryRule([
        ...publicApiPatterns,
        {
          group: [
            '@crane/widgets',
            '@crane/widgets/*',
            '@crane/hanwha-ocean',
            '@crane/hanwha-ocean/*',
            '@crane/goliath-crane',
            '@crane/goliath-crane/*',
          ],
          message: fsdLayerMessages.features,
        },
      ]),
    },
  },

  // widgets layer (@crane/widgets) — features, domain, core, ui
  {
    files: ['packages/widgets/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createBoundaryRule([
        ...publicApiPatterns,
        {
          group: [
            '@crane/hanwha-ocean',
            '@crane/hanwha-ocean/*',
            '@crane/goliath-crane',
            '@crane/goliath-crane/*',
          ],
          message: fsdLayerMessages.widgets,
        },
      ]),
    },
  },

  /*
   * 이식된 내업 대시보드(ocean-inshop-process/web-dashboard).
   *
   * 원본은 oxlint 로 검사하던 코드라 react-hooks v7 의 컴파일러 규칙
   * (set-state-in-effect / refs / immutability)을 통과하지 못한다. 지적된 12곳은
   * 전부 **이식 전부터 있던** 패턴이고 대부분 three.js 뷰어의 명령형 코드
   * (렌더 중 ref 로 씬 객체를 만지는 것이 이 라이브러리의 정상 사용법이다)라,
   * 옮기는 김에 고치면 검증 없이 동작을 바꾸게 된다.
   *
   * 그래서 지금은 경고로 낮춰 두고 눈에는 보이게 한다 — 끄지 않는 이유는
   * 새로 쓰는 코드까지 조용히 통과시키지 않기 위해서다. 화면별로 실제 동작을
   * 확인하면서 걷어내는 것이 이 예외의 종료 조건이다.
   */
  {
    files: ['apps/indoorshop/src/dashboard/**/*.{ts,tsx}', 'apps/indoorshop/src/pages/inshop-*/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
])
