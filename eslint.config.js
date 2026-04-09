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
])
