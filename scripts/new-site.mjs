#!/usr/bin/env node
// Scaffold a new site plugin under apps/<slug>.
// 사용법:  pnpm new-site <slug>
//   <slug> — kebab-case (예: dock-three, my-yard).
//
// 동작:
//   1. apps/<slug>/ 가 이미 있으면 종료.
//   2. apps/<slug>/{src/pages,tsconfig.json,package.json} 생성.
//   3. shell/package.json 에 workspace 의존성 추가.
//   4. 다음 단계(shell/app.tsx 라우팅 등록, navigation.ts 분기) 안내.
//
// 의도적으로 shell 의 app.tsx, navigation.ts 는 자동 수정하지 않는다.
// 각 사이트마다 라우팅 구조와 권한이 다르므로 사람의 판단이 필요하다.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const slug = process.argv[2];
if (!slug || !/^[a-z][a-z0-9-]*$/.test(slug)) {
  console.error('Usage: pnpm new-site <kebab-case-slug>');
  console.error('  e.g., pnpm new-site dock-three');
  process.exit(1);
}

const pkgName = `@crane/${slug}`;
const appDir = resolve(repoRoot, 'apps', slug);

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

if (await exists(appDir)) {
  console.error(`apps/${slug} already exists. Aborting.`);
  process.exit(1);
}

const examplePage = 'example';

const filesToWrite = {
  [`apps/${slug}/package.json`]: JSON.stringify(
    {
      name: pkgName,
      version: '0.0.0',
      private: true,
      type: 'module',
      main: './src/pages/index.ts',
      types: './src/pages/index.ts',
      exports: {
        [`./pages/${examplePage}`]: `./src/pages/${examplePage}/index.ts`,
      },
      peerDependencies: {
        react: '^19.2.0',
        'react-dom': '^19.2.0',
      },
      dependencies: {
        '@crane/core': 'workspace:*',
        '@crane/ui': 'workspace:*',
        '@crane/domain': 'workspace:*',
        '@crane/features': 'workspace:*',
        '@crane/widgets': 'workspace:*',
        'react-router-dom': '^7.13.1',
        'react-i18next': '^16.3.5',
        i18next: '^25.6.2',
        'lucide-react': '^0.575.0',
      },
    },
    null,
    2,
  ) + '\n',

  [`apps/${slug}/tsconfig.json`]:
    JSON.stringify(
      {
        extends: '../../tsconfig.base.json',
        include: ['src'],
      },
      null,
      2,
    ) + '\n',

  [`apps/${slug}/src/pages/index.ts`]: `export { ExamplePage } from './${examplePage}';\n`,

  [`apps/${slug}/src/pages/${examplePage}/index.ts`]: `export { ExamplePage } from './ui/example-page';\n`,

  [`apps/${slug}/src/pages/${examplePage}/ui/example-page.tsx`]: `export function ExamplePage() {
  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold">${pkgName} — example page</h1>
      <p className="text-muted-foreground text-sm">
        Replace this with your site’s entry page.
      </p>
    </div>
  );
}
`,
};

for (const [rel, content] of Object.entries(filesToWrite)) {
  const abs = resolve(repoRoot, rel);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, content, 'utf8');
  console.log(`+ ${rel}`);
}

// shell/package.json 의 dependencies 에 추가 (idempotent).
const shellPkgPath = resolve(repoRoot, 'apps/shell/package.json');
const shellPkgRaw = await readFile(shellPkgPath, 'utf8');
const shellPkg = JSON.parse(shellPkgRaw);
shellPkg.dependencies ??= {};
if (!shellPkg.dependencies[pkgName]) {
  // alphabetical insert among @crane/* entries
  const entries = Object.entries(shellPkg.dependencies);
  entries.push([pkgName, 'workspace:*']);
  entries.sort(([a], [b]) => a.localeCompare(b));
  shellPkg.dependencies = Object.fromEntries(entries);
  await writeFile(shellPkgPath, JSON.stringify(shellPkg, null, 2) + '\n', 'utf8');
  console.log(`~ apps/shell/package.json (added ${pkgName})`);
}

console.log('\nNext steps (manual):');
console.log(`  1. pnpm install`);
console.log(`  2. apps/shell/src/app.tsx 에 다음 lazy import + Route 추가:`);
console.log(`       const ExamplePage = lazy(() => import('${pkgName}/pages/${examplePage}').then((m) => ({ default: m.ExamplePage })));`);
console.log(`       <Route path="${slug}/example" element={<LazyRoute><ExamplePage /></LazyRoute>} />`);
console.log(`  3. packages/widgets/src/layout/config/navigation.ts 의 role/site 분기에 메뉴 항목 추가 (필요 시).`);
console.log(`  4. apps/shell/src/locales/{ko,en,la}/common.json 의 nav 에 새 메뉴 라벨 추가 (필요 시).`);
