# AGENTS.md

This file provides guidance to AI Agents when working with code in this repository.

## Commands

- `npm run dev` — Start Vite dev server with HMR
- `npm run build` — TypeScript check + Vite production build
- `npm run lint` — ESLint (flat config)
- `npm run preview` — Preview production build

No test framework is configured yet.

## Architecture

This is a **Crane Monitoring Dashboard** built with React 19, TypeScript, Vite, Tailwind CSS v4, and shadcn/ui. It follows **Feature-Sliced Design (FSD)** architecture.

### Layers (`src/`)

- **app/** — Application shell, routing (react-router-dom), entry point (`main.tsx`), global styles
- **pages/** — Route-level components
- **widgets/** — Page-level UI blocks composed from features/entities/shared
- **features/** — User-facing functionality units
- **entities/** — Business domain models and data
- **shared/** — Reusable code used across all layers: UI components (`ui/`), utilities (`lib/`), types (`types/`), config (`config/`), assets

Import rule: layers can only import from layers below them (`shared` → `entities` → `features` → `widgets` → `pages` → `app`).

### FSD Import Rules

- Cross-layer imports must follow the layer order above. Lower layers must never import higher layers.
- Cross-slice imports in `pages/`, `widgets/`, `features/`, and `entities/` should go through each slice's public API (`index.ts`) whenever possible.
- Avoid deep imports such as `@/widgets/foo/ui/bar` or `@/entities/foo/model/types` from outside the owning slice. Expose what is needed via the slice barrel instead.
- If a slice has consumers outside its own folder, it should provide an `index.ts` public API.

### shared/ui 구조 (Atomic Design)

- **shared/ui/atoms/\*.tsx** — 단일 UI 요소 (Badge, Button, Separator, Toggle)
- **shared/ui/molecules/\*.tsx** — atoms를 조합한 복합 UI 컴포넌트 (Card, Table, ScrollArea, Resizable, ToggleGroup, Tooltip)
- **shared/ui/organisms/\*.tsx** — 도메인 프레젠테이션 컴포넌트 (AlarmPanel, CraneStatusTable, AppLayout 등). 데이터는 pages에서 props로 주입받으며, entities 타입만 `import type`으로 참조

> **참고**: shadcn CLI(`npx shadcn add`)로 추가한 컴포넌트는 `shared/ui/` 루트에 생성됨. 추가 후 atoms 또는 molecules로 수동 이동 필요.

### Key Conventions

- **Path alias**: `@/*` maps to `src/*`
- **shadcn/ui components** go in `src/shared/ui/atoms/` or `src/shared/ui/molecules/` (CLI는 `src/shared/ui/`에 생성, 수동 분류 필요)
- **Utilities/hooks** go in `src/shared/lib/`
- Components use **CVA (class-variance-authority)** for variant styling and **cn()** (`clsx` + `tailwind-merge`) for class merging
- **Tailwind CSS v4** — no `tailwind.config.*`; theme is defined via CSS variables in `src/app/styles/global.css` using OKLCH color space
- **Base UI** primitives underpin shadcn/ui components for accessibility
- `.npmrc` has `legacy-peer-deps=true`
- ESLint enforces FSD layer boundaries and restricts deep cross-slice imports with `no-restricted-imports`
- `react-refresh/only-export-components` is still active globally; if shared UI files intentionally export helpers alongside components, add a targeted override in ESLint rather than assuming it is already exempted
