import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const fsdLayerMessages = {
  app: 'app layer must not import from another app slice via internal paths.',
  pages: 'pages can import from widgets/features/entities/shared, but not from app internals.',
  widgets:
    'widgets can import from features/entities/shared, but not from pages or app.',
  features:
    'features can import from entities/shared, but not from widgets/pages/app.',
  entities:
    'entities can import from shared only, never from features/widgets/pages/app.',
  shared:
    'shared is the lowest layer and must not import from entities/features/widgets/pages/app.',
}

function createBoundaryRule(patterns) {
  return [
    'error',
    {
      patterns,
    },
  ]
}

const publicApiPatterns = [
  {
    group: [
      '@/pages/*/{ui,model,lib,config}/*',
      '@/pages/*/*/{ui,model,lib,config}/*',
      '@/widgets/*/{ui,model,lib,config}/*',
      '@/widgets/*/*/{ui,model,lib,config}/*',
      '@/features/*/{ui,model,lib,config}/*',
      '@/features/*/*/{ui,model,lib,config}/*',
      '@/entities/*/{ui,model,lib,config}/*',
      '@/entities/*/*/{ui,model,lib,config}/*',
    ],
    message:
      'Use the slice public API (`index.ts`) instead of importing another slice internals directly.',
  },
]

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
  },
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createBoundaryRule(publicApiPatterns),
    },
  },
  {
    files: ['src/pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createBoundaryRule([
        ...publicApiPatterns,
        {
          group: ['@/app', '@/app/*'],
          message: fsdLayerMessages.pages,
        },
      ]),
    },
  },
  {
    files: ['src/widgets/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createBoundaryRule([
        ...publicApiPatterns,
        {
          group: ['@/app', '@/app/*', '@/pages', '@/pages/*'],
          message: fsdLayerMessages.widgets,
        },
      ]),
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createBoundaryRule([
        ...publicApiPatterns,
        {
          group: [
            '@/app',
            '@/app/*',
            '@/pages',
            '@/pages/*',
            '@/widgets',
            '@/widgets/*',
          ],
          message: fsdLayerMessages.features,
        },
      ]),
    },
  },
  {
    files: ['src/entities/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createBoundaryRule([
        ...publicApiPatterns,
        {
          group: [
            '@/app',
            '@/app/*',
            '@/pages',
            '@/pages/*',
            '@/widgets',
            '@/widgets/*',
            '@/features',
            '@/features/*',
          ],
          message: fsdLayerMessages.entities,
        },
      ]),
    },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createBoundaryRule([
        {
          group: [
            '@/app',
            '@/app/*',
            '@/pages',
            '@/pages/*',
            '@/widgets',
            '@/widgets/*',
            '@/features',
            '@/features/*',
            '@/entities',
            '@/entities/*',
          ],
          message: fsdLayerMessages.shared,
        },
      ]),
    },
  },
])
