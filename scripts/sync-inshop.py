#!/usr/bin/env python3
"""
ocean-inshop-process/web-dashboard → apps/indoorshop 이식 동기화.

    python scripts/sync-inshop.py [<ocean-inshop-process 경로>]

원본이 갱신될 때마다 이 스크립트 하나로 다시 옮긴다. 손으로 옮기면 파일 몇 개를
빠뜨리는 것이 보통이라, 이식에 필요한 변환을 전부 여기 모아 **결정적**으로
재실행한다. 단계마다 assert 를 걸어, 원본 구조가 바뀌어 변환이 더 이상 맞지
않으면 조용히 지나가지 않고 여기서 멈춘다.

⚠️ 돌린 뒤에는 dev 서버를 재시작하고 브라우저를 하드 새로고침(Ctrl+Shift+R)해야 한다.
   트리를 통째로 지웠다 다시 쓰므로 떠 있는 Vite 의 모듈 그래프가 옛것을 가리킨다.

원본 구조 (2026-08-25 이후, 공정별 모듈 아키텍처):
  src/app/        bootstrap.ts(모듈 등록·번역 병합) · router.tsx · i18next.d.ts
  src/processes/  {fabrication,assembly,outfitting,painting,yard}/module.ts + i18n/api/lib/ui
  src/shared/     model(레지스트리) · entities · features · widgets · pages · ui · lib · config · styles

이식 후 위치: apps/indoorshop/src/dashboard/{app,processes,shared,assets}

셸과 원본이 부딪히는 지점(왜 이 변환이 필요한지):
  - 디자인 토큰 이름 충돌 (--background/--accent/--text-*/--radius-*)  → 스코프·개명
  - i18next 전역 싱글턴 이중 init                                    → 'inshop' 네임스페이스 등록
  - '/' 루트 배포 전제의 절대 경로 (fetch, <Link>, module.ts 라우트)  → BASE_URL·/indoorshop 접두
  - 자체 헤더·사이드바·테마 provider                                  → 셸 것으로 대체
"""
from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path

# Windows 콘솔(cp949)에서 한글·기호 출력이 깨지지 않도록
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
SRC_REPO = Path(sys.argv[1] if len(sys.argv) > 1 else "C:/ocean-inshop-process")
WD = SRC_REPO / "web-dashboard"
DST = ROOT / "apps/indoorshop/src"
DASH = DST / "dashboard"
OVERLAY = ROOT / "scripts/inshop-sync/overlay"
SHELL_PUBLIC = ROOT / "apps/shell/public"

LAYERS = ("shared", "processes", "assets")
# app/ 은 셸 라우팅과 겹치므로 통째로 옮기지 않는다 — 필요한 두 파일만 변환해서 가져온다
APP_FILES = ("bootstrap.ts", "i18next.d.ts")

# 셸 AppLayout 이 대신하는 원본 크롬 — 옮기지 않는다 (그것만 쓰던 조각도 함께).
# shared/widgets 통째가 아니라 크롬만 집어서 뺀다 — dashboard-map 처럼 화면이 쓰는
# 위젯이 같은 디렉토리에 살기 때문이다.
DROP_DIRS = (
    "shared/widgets/layout-wrapper", "shared/widgets/sidebar", "shared/widgets/header",
    "shared/widgets/footer", "shared/widgets/user-menu", "shared/widgets/alarm-menu",
)
DROP_FILES = (
    "shared/config/navigation.ts",
    "shared/lib/theme/ThemeProvider.tsx",
    # 알람 레일 위젯(shared/widgets/alarm-menu)은 버리는 크롬이다 — 그 위젯을 그리는
    # 테스트만 함께 뺀다. 판정 규칙·entities/alarm 과 derive 테스트는 그대로 옮긴다.
    "shared/features/alarms/__tests__/AlarmMenu.test.tsx",
)

# 이 앱이 소유하는 라우트 접두 — <Link>·navigate·module.ts 경로에 /indoorshop 을 붙인다
OWNED_PREFIXES = ("/zones", "/logistics", "/docs", "/settings")


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def write(p: Path, s: str) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(s, encoding="utf-8")


def replace_once(p: Path, old: str, new: str) -> None:
    s = read(p)
    assert s.count(old) == 1, f"{p.relative_to(ROOT)}: 기대한 조각이 정확히 1회 있어야 함 (found {s.count(old)}):\n{old[:120]}"
    write(p, s.replace(old, new, 1))


def ts_files(base: Path):
    return [p for p in base.rglob("*") if p.suffix in (".ts", ".tsx")]


def step(msg: str) -> None:
    print(f"▸ {msg}")


# ── 1. 복사 ─────────────────────────────────────────────────────────────────
def copy_source() -> None:
    step("원본 복사 (이식 트리 초기화)")
    assert WD.is_dir(), f"web-dashboard 없음: {WD}"
    assert (WD / "src/processes").is_dir() and (WD / "src/shared/model/processRegistry.ts").is_file(), (
        "원본이 공정별 모듈 구조가 아님 — 이 스크립트는 2026-08-25 이후 구조를 전제로 한다"
    )
    if DASH.exists():
        shutil.rmtree(DASH)
    # 예전 구조(pages/inshop-*)의 잔재가 있으면 치운다
    for d in (DST / "pages").glob("inshop-*"):
        shutil.rmtree(d)

    for layer in LAYERS:
        shutil.copytree(WD / "src" / layer, DASH / layer)
    (DASH / "app").mkdir()
    for name in APP_FILES:
        shutil.copy2(WD / "src/app" / name, DASH / "app" / name)

    for d in DROP_DIRS:
        shutil.rmtree(DASH / d)
    for f in DROP_FILES:
        (DASH / f).unlink()

    # 문서 뷰어가 읽는 마크다운 — 원본 레포의 docs/·AGENTS.md·ROUTING.md
    content = DASH / "shared/entities/doc/content"
    content.mkdir()
    for md in (SRC_REPO / "docs").glob("*.md"):
        shutil.copy2(md, content / md.name)
    shutil.copy2(SRC_REPO / "AGENTS.md", content / "AGENTS.md")
    shutil.copy2(WD / "ROUTING.md", content / "ROUTING.md")


# ── 2. import 경로 ───────────────────────────────────────────────────────────
def target_for(spec: str) -> str:
    rest = spec[2:]
    head = rest.partition("/")[0]
    if head == "dashboard":
        return f"src/{rest}"
    if head in LAYERS:
        return f"src/dashboard/{rest}"
    raise SystemExit(f"@/ 별칭을 매핑할 수 없음: {spec}")


def rel_import(from_file: Path, target_src_rel: str) -> str:
    import posixpath
    frm = posixpath.dirname(from_file.relative_to(DST.parent).as_posix())
    rel = posixpath.relpath(target_src_rel, frm)
    return rel if rel.startswith(".") else "./" + rel


def rewrite_alias() -> None:
    step("@/ 별칭 → 상대 경로 (모노레포는 별칭을 쓰지 않는다)")
    n = 0
    for f in ts_files(DST):
        s = read(f)
        s2 = re.sub(r"'(@/[^']*)'", lambda m: f"'{rel_import(f, target_for(m.group(1)))}'", s)
        if s2 != s:
            write(f, s2); n += 1
    left = [f for f in ts_files(DST) if "'@/" in read(f)]
    assert not left, f"@/ 잔존: {left}"
    print(f"    {n} files")


# ── 3. i18n ─────────────────────────────────────────────────────────────────
def rewrite_i18n() -> None:
    step("i18n: useTranslation 셔 · ParseKeys → InshopKey · bootstrap/타입을 'inshop' 네임스페이스로")
    shim = "src/dashboard/shared/lib/i18n/useTranslation"
    keys = "src/dashboard/shared/lib/i18n/keys"
    skip = ("i18n/useTranslation.ts", "i18n/keys.ts", "app/i18next.d.ts", "i18n/config.ts")
    n_t = n_k = 0
    for f in ts_files(DST):
        if f.as_posix().endswith(skip):
            continue
        s = read(f); o = s
        if "import { useTranslation } from 'react-i18next'" in s:
            s = s.replace("import { useTranslation } from 'react-i18next'",
                          f"import {{ useTranslation }} from '{rel_import(f, shim)}'")
            n_t += 1
        m = re.search(r"import type \{([^}]*)\} from 'i18next'\n", s)
        if m and "ParseKeys" in m.group(1):
            names = [x.strip() for x in m.group(1).split(",") if x.strip() and x.strip() != "ParseKeys"]
            rest = f"import type {{ {', '.join(names)} }} from 'i18next'\n" if names else ""
            s = s.replace(m.group(0), rest + f"import type {{ InshopKey }} from '{rel_import(f, keys)}'\n")
            s = re.sub(r"\bParseKeys\b", "InshopKey", s)
            n_k += 1
        if s != o:
            write(f, s)

    # 원본 app/bootstrap.ts: 모듈 등록 + 번역 병합. 병합 대상 네임스페이스만 바꾼다.
    p = DASH / "app/bootstrap.ts"
    s = read(p)
    assert s.count("'translation'") == 2, "bootstrap.ts 의 addResourceBundle 형태가 바뀜"
    # i18n.addResourceBundle 은 init 전에 부르면 없다 — 셸 런타임은 init 이 먼저지만
    # vitest 는 아무도 init 하지 않은 채 이 모듈을 끌어오므로, 큐잉하는 addInshopBundle 로 보낸다.
    s = re.sub(
        r"i18n\.addResourceBundle\('(ko|en)', 'translation', ([^,]+), true, true\)",
        r"addInshopBundle('\1', \2)",
        s,
    )
    s = re.sub(r"import i18n from '([^']*i18n/config)'", r"import { addInshopBundle } from '\1'", s, count=1)
    assert "addInshopBundle } from" in s and s.count("addInshopBundle(") == 2, "bootstrap 변환 실패"
    write(p, s)

    # 원본 app/i18next.d.ts: defaultNS 는 셸 것('common')을 두고, 리소스는 'inshop' 아래로
    p = DASH / "app/i18next.d.ts"
    s = read(p)
    assert "defaultNS: 'translation'\n" in s and "      translation: Resources &" in s
    s = s.replace("    defaultNS: 'translation'\n", "")
    s = s.replace("      translation: Resources &", "      inshop: Resources &")
    s = s.replace(" * `t('...')` 의 키를 타입으로 묶는다.", " * `t('...')` 의 키를 타입으로 묶는다. (이식: 셸 i18next 의 'inshop' 네임스페이스에 얹는다 —\n * defaultNS 를 여기서 선언하면 셸·다른 모듈의 t() 까지 이 키 집합으로 좁혀진다.)")
    write(p, s)

    # 테스트 헬퍼는 I18nextProvider·initReactI18next 를 직접 써야 한다 — 예외
    bad = [f for f in ts_files(DST) if "from 'react-i18next'" in read(f) and not f.as_posix().endswith(("i18n/useTranslation.ts", "testing/renderWithProviders.tsx"))]
    assert not bad, f"react-i18next 직접 import 잔존: {bad}"
    # 주석에 든 단어까지 잡으면 안 된다 — import 구문의 ParseKeys 만 검사한다
    assert not [f for f in ts_files(DST) if re.search(r"import type \{[^}]*\bParseKeys\b", read(f)) and not f.as_posix().endswith("i18n/keys.ts")]
    print(f"    useTranslation {n_t} files, ParseKeys {n_k} files")


# ── 4. Tailwind 클래스 개명 ──────────────────────────────────────────────────
def rewrite_classes() -> None:
    step("충돌하는 Tailwind 스케일 개명 (text-xs..2xl, rounded-xs..lg, font-sans)")
    n = 0
    for f in DST.rglob("*.tsx"):
        s = read(f); o = s
        s = re.sub(r"\btext-(2xl|xl|base|lg|sm|xs)\b", r"text-inshop-\1", s)
        s = re.sub(r"\brounded-(3xl|2xl|xl|xs|sm|md|lg)\b", r"rounded-inshop-\1", s)
        s = re.sub(r"\brounded-([tblr]|t[lr]|b[lr])-(3xl|2xl|xl|xs|sm|md|lg)\b", r"rounded-\1-inshop-\2", s)
        s = re.sub(r"\bfont-sans\b", "font-inshop-sans", s)
        if s != o:
            write(f, s); n += 1
    assert not [f for f in DST.rglob("*.tsx") if "inshop-inshop" in read(f)]
    print(f"    {n} files")


# ── 5. 라우트·에셋 절대 경로 ────────────────────────────────────────────────
def _prefix(path: str) -> str:
    return "/indoorshop" if path == "/" else "/indoorshop" + path


def rewrite_links() -> None:
    step("내부 링크·모듈 라우트에 /indoorshop 접두 (role 가드가 밖으로 나간 경로를 되돌린다)")
    hits = 0

    def repl(m):
        nonlocal hits
        pre, path = m.group(1), m.group(2)
        if path == "/" or path.startswith(OWNED_PREFIXES):
            hits += 1
            return pre + _prefix(path)
        return m.group(0)

    for f in DASH.rglob("*.tsx"):
        s = read(f)
        s2 = re.sub(r"(to=\"|to=\{`|to=\{'|navigate\('|navigate\(`)(/[^\"`']*)", repl, s)
        if s2 != s:
            write(f, s2)

    # module.ts 의 nav.path·routes[].path — findProcessModuleByPath 가 location.pathname 과
    # 비교하므로 여기도 접두가 있어야 ZonePlaceholderPage 가 자기 모듈을 찾는다.
    # (InshopRoot 가 useRoutes 에 넘길 때 접두를 다시 떼어 상대 경로로 만든다.)
    mods = list((DASH / "processes").glob("*/module.ts"))
    assert mods, "processes/*/module.ts 가 없음"
    for f in mods:
        s = read(f)
        s2 = re.sub(r"(path: ')(/[^']*)(?=')", repl, s)
        assert s2 != s, f"{f.name}: 라우트 경로를 찾지 못함"
        write(f, s2)
    print(f"    {hits} paths")


def patch_asset_paths() -> None:
    step("public 에셋 fetch 에 BASE_URL (/crane_rnd/) 씌우기")
    imp = "import { publicAsset } from '@/dashboard/shared/lib/public-asset'\n"
    p = DASH / "shared/features/bay-viewer/api/loadBlockModel.ts"
    s = read(p)
    assert s.count("fetch(`/models/") == 3, "loadBlockModel fetch 지점 수가 바뀜"
    s = s.replace("fetch(`/models/${key}.json`)", "fetch(publicAsset(`/models/${key}.json`))")
    s = s.replace("fetch(`/models/${key}.bin`)", "fetch(publicAsset(`/models/${key}.bin`))")
    write(p, imp + s)

    p2 = DASH / "processes/assembly/api/realScanAssets.ts"
    replace_once(p2, "const ASSET_BASE = '/real-scan'", "const ASSET_BASE = publicAsset('/real-scan')")
    write(p2, imp + read(p2))

    for q in (p, p2):
        write(q, re.sub(r"'(@/[^']*)'", lambda m: f"'{rel_import(q, target_for(m.group(1)))}'", read(q)))

    # public 에셋 경로만 본다 — 서버 API 경로('/api')는 별개 관심사고, 주석 속 예시까지 잡으면 안 된다
    left = [f for f in ts_files(DST) if re.search(r"fetch\([`']/(?:real-scan|models)\b|= '/real-scan'", read(f))]
    assert not left, f"절대 경로 fetch 잔존: {left}"


# ── 6. 개별 패치 ─────────────────────────────────────────────────────────────
def patch_settings() -> None:
    step("설정: 'system' 테마 항목 제거 (셸 ThemeProvider 는 light/dark 만 저장)")
    p = DASH / "shared/pages/SettingsPage.tsx"
    s = read(p)
    m = re.search(r"      \{\n        value: 'system',.*?\n      \},\n    \]", s, re.S)
    assert m, "SettingsPage 의 system 옵션 블록을 찾지 못함"
    s = s.replace(m.group(0), """      /*
       * 'system' 은 뺀다 — 셸 ThemeProvider 는 light/dark 두 값만 저장한다.
       * 고르면 즉시 light|dark 로 확정되어 선택 표시가 되돌아오지 않는, 눌러도
       * 켜지지 않는 항목이 된다. 셸이 초기값을 정할 때 이미 OS 설정을 따른다.
       */
    ]""")
    s = re.sub(r"ComputerIcon, ", "", s, count=1)
    assert "ComputerIcon" not in s
    write(p, s)


def patch_docs_registry() -> None:
    step("문서 레지스트리: 레포 밖 glob → 패키지 안 content/")
    p = DASH / "shared/entities/doc/api/docsRegistry.ts"
    s = read(p)
    m = re.search(r"const rawDocs: Record<string, string> = \{\n  \.\.\.import\.meta\.glob\(.*?\n\}\n", s, re.S)
    assert m, "docsRegistry rawDocs glob 블록을 찾지 못함"
    s = s.replace(m.group(0), """const rawDocs: Record<string, string> = import.meta.glob('../content/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})
""")
    m = re.search(r"/\*\*\n \* glob 키\(이 파일 기준 상대 경로\)를.*?\nfunction toRepoPath\(globKey: string\): string \{.*?\n\}\n", s, re.S)
    assert m, "docsRegistry toRepoPath 를 찾지 못함"
    s = s.replace(m.group(0), """/**
 * glob 키를 원본 레포(ocean-inshop-process) 기준 경로로 되돌린다.
 *
 * 원본은 레포 루트의 `docs/*.md` 와 `AGENTS.md` 를 직접 glob 했다. 이식 후에는
 * 그 파일들이 이 패키지의 `entities/doc/content/` 로 함께 들어와 있으므로 —
 * 셸 레포의 `docs/` 는 크레인 쪽 문서라 여기서 읽을 것이 아니다 — glob 은
 * 그 폴더만 보고, 표시용 경로는 파일 이름으로 원래 위치를 되살린다.
 */
const WEB_DASHBOARD_DOCS = new Set(['ROUTING.md'])
const REPO_ROOT_DOCS = new Set(['AGENTS.md'])

function toRepoPath(globKey: string): string {
  const name = fileNameOf(globKey)
  if (REPO_ROOT_DOCS.has(name)) return name
  if (WEB_DASHBOARD_DOCS.has(name)) return `web-dashboard/${name}`
  return `docs/${name}`
}
""")
    s = s.replace(
        "  return docs.map(({ markdown: _markdown, ...meta }) => meta)",
        "  return docs.map(\n    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- 나머지만 남기려고 구조분해로 덜어낸다\n    ({ markdown: _markdown, ...meta }) => meta,\n  )",
    )
    write(p, s)


def patch_globals_css() -> None:
    step("globals.css: 셸 Tailwind 엔트리에 얹을 수 있게 정규화·스코프")
    p = DASH / "shared/styles/globals.css"
    s = read(p)
    s = re.sub(r"^/\* 서체 CSS 는[^\n]*\n@import \"tailwindcss\";\n\n", "", s)
    s = s.replace("@custom-variant dark (&:where(.dark, .dark *));\n\n", "")
    s = re.sub(r"\nbody \{\n  font-family: var\(--font-sans\);.*?\n\}\n", "\n", s, flags=re.S)
    assert "  --font-sans: 'Pretendard Variable'" in s
    s = re.sub(r"  --font-sans: 'Pretendard Variable'[^\n]*\n  --font-mono: [^\n]*\n", "", s)
    s = re.sub(r"--radius-(xs|sm|md|lg): (\d+px);", r"--radius-inshop-\1: \2;", s)
    # 원본은 xl 계열 radius 를 정의하지 않고 Tailwind 기본값(xl 12 / 2xl 16 / 3xl 24px)을
    # 쓴다. 셸 shadcn 은 --radius-xl 을 --radius×1.4(=5.6px)로 재정의하므로, 개명한
    # 이름으로 기본값을 되살린다.
    s = s.replace("--radius-inshop-xs:", "--radius-inshop-xl: 12px;\n  --radius-inshop-2xl: 16px;\n  --radius-inshop-3xl: 24px;\n  --radius-inshop-xs:", 1)
    for st in ("xs", "sm", "base", "lg", "xl", "2xl"):
        s = s.replace(f"--text-{st}: calc(", f"--text-inshop-{st}: calc(")
        s = s.replace(f"--text-{st}--line-height: calc(", f"--text-inshop-{st}--line-height: calc(")
    assert s.count(":root {") == 1 and s.count("\n.dark {") == 1
    s = s.replace(":root {", ".inshop-root {", 1)
    s = s.replace("\n.dark {", "\n.dark .inshop-root,\n.inshop-root.dark {", 1)
    assert s.startswith("@theme {")
    # `inline` 이어야 한다. 그냥 @theme 이면 Tailwind 가 `:root { --color-surface: var(--surface) }`
    # 를 내놓는데, --surface 는 .inshop-root 에만 있으므로 :root 에서 무효가 되어 그대로
    # 상속된다 — bg-surface·bg-status-* 가 전부 투명으로 그려진다. inline 은 유틸리티가
    # var(--surface) 를 직접 참조하게 해 요소 위치에서 해석된다.
    # 원본 서체도 이름을 바꿔 다시 넣는다 — `font-sans` 그대로 두면 셸 토큰(IBM Plex)을 받는다.
    s = s.replace("@theme {", "@theme inline {\n  --font-inshop-sans: 'Pretendard Variable', 'Pretendard', system-ui, -apple-system, sans-serif;\n", 1)
    s = ":root {\n  /* @theme 의 text-* 계산식이 참조한다 — 셸 전역에서 항상 1 이어야 한다 */\n  --app-font-scale: 1;\n}\n\n" + s
    old_base = """@layer base {
  button:not(:disabled),
  [role="button"]:not([aria-disabled="true"]),
  summary,
  select:not(:disabled) {
    cursor: pointer;
  }
}"""
    assert old_base in s
    s = s.replace(old_base, old_base.replace("\n  button", "\n  .inshop-root button").replace("\n  [role", "\n  .inshop-root [role").replace("\n  summary", "\n  .inshop-root summary").replace("\n  select", "\n  .inshop-root select"))
    s += """
/*
 * 내업 대시보드 subtree 의 바탕.
 *
 * 원본은 `body` 에 바탕·서체를 걸었지만, 셸에서는 body 가 모든 모듈의 공유
 * 자산이라 여기서 칠하면 다른 모듈 화면까지 이 팔레트로 바뀐다. 대신 이 앱이
 * 차지하는 영역에만 칠한다 — 서체도 마찬가지로 (셸 전역은 IBM Plex 다).
 */
.inshop-root {
  font-family: 'Pretendard Variable', 'Pretendard', system-ui, -apple-system, sans-serif;
  background-color: var(--background);
  color: var(--foreground);
}

/*
 * 셸은 base 에서 `* { border-color: var(--border) }` 를 전역으로 건다(shadcn 관례).
 * 원본은 Tailwind 기본값(currentColor)을 전제로 쓰였다 — `border-border` 를 붙인
 * 곳만 토큰 색이고, 나머지는 글자색 테두리다. 그 전제를 이 subtree 안에서 되돌린다.
 * base 레이어라 유틸리티(`border-border`, `border-accent`)는 그대로 이긴다.
 */
@layer base {
  .inshop-root,
  .inshop-root * {
    border-color: currentColor;
  }
}
"""
    write(p, s)


def patch_test_helper() -> None:
    step("renderWithProviders: vitest 에서 i18n 을 초기화 (셸 런타임은 initI18n 이 대신한다)")
    p = DASH / "shared/lib/testing/renderWithProviders.tsx"
    replace_once(p, "import { I18nextProvider } from 'react-i18next'",
                 "import { I18nextProvider, initReactI18next } from 'react-i18next'")
    s = read(p)
    m = re.search(r"import i18n from '(\S*i18n/config)'", s)
    assert m, "renderWithProviders 의 i18n import 를 찾지 못함"
    s = s.replace(m.group(0), f"import i18n, {{ INSHOP_NS }} from '{m.group(1)}'\n"
                              "// 공정 번역 조각까지 큐에 올린다 — 아래 init 의 'initialized' 에서 한꺼번에 얹힌다\n"
                              "import '../../../app/bootstrap'", 1)
    s = s.replace("export function renderWithProviders(", """/*
 * (이식) 원본 config 은 스스로 init 했지만, 이식본은 셸의 initI18n 에 얹혀 산다 —
 * vitest 에는 그게 없으므로 여기서 초기화한다. config·bootstrap 이 큐에 쌓아 둔
 * 번들(공통·공정)은 'initialized' 리스너가 이때 한꺼번에 얹는다.
 */
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    lng: 'ko',
    fallbackLng: 'ko',
    defaultNS: INSHOP_NS,
    ns: [INSHOP_NS],
    resources: {},
    interpolation: { escapeValue: false },
    returnNull: false,
  })
}

export function renderWithProviders(""", 1)
    write(p, s)


def patch_fixed_viewport() -> None:
    step("FixedViewport: useEffect → useLayoutEffect (첫 페인트 전에 고정 플래그를 세운다)")
    p = DASH / "shared/lib/fixed-viewport/FixedViewport.tsx"
    replace_once(p, "import { useContext, useEffect } from 'react'", "import { useContext, useLayoutEffect } from 'react'")
    replace_once(p, "  useEffect(() => {\n    setFixed(true)", """  /*
   * useLayoutEffect 인 이유: 셸 ScrollArea 안에서는 이 플래그가 서기 전의 첫 레이아웃이
   * 높이 제약 없이 계산된다. 그 한 프레임 동안 `xl:h-full` 사슬이 auto 로 풀려 캔버스
   * 컨테이너가 캔버스 자신의 크기를 따라 수만 px 로 자라고(ResizeObserver 되먹임),
   * 그 크기의 드로잉 버퍼를 한 번 할당했다가 버린다 — 첫 진입이 1초 넘게 멎는다.
   * 페인트 전에 플래그를 세우면 그 레이아웃은 아예 만들어지지 않는다.
   */
  useLayoutEffect(() => {
    setFixed(true)""")


def patch_block_list_scroller() -> None:
    step("조립 스크롤러 3곳: 선택 링(ring-2+offset-2, 바깥 4px)이 잘리지 않게 사방 여백")
    # overflow 컨테이너는 padding box 밖을 잘라낸다. 링만큼 사방에 p-1.5(6px)를 주고
    # 같은 크기의 음수 마진으로 되돌려 보이는 위치는 그대로 둔다. (블록 목록·센서 상태 2곳)
    p = DASH / "processes/assembly/ui/pages/AssemblyWorkspace.tsx"
    replace_once(
        p,
        '"xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">',
        '"xl:-m-1.5 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:p-1.5">',
    )
    replace_once(
        p,
        '"xl:min-h-0 xl:flex-1 xl:overflow-y-auto">',
        '"xl:-m-1.5 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:p-1.5">',
    )
    replace_once(
        p,
        '"grid gap-3 md:grid-cols-2 2xl:grid-cols-3 xl:min-h-0 xl:flex-1 xl:content-start xl:overflow-y-auto xl:pr-1">',
        '"grid gap-3 md:grid-cols-2 2xl:grid-cols-3 xl:-m-1.5 xl:min-h-0 xl:flex-1 xl:content-start xl:overflow-y-auto xl:p-1.5">',
    )


# ── 7. overlay · public · 검사 ───────────────────────────────────────────────
def apply_overlay() -> None:
    step("손으로 쓴 어댑터 파일 overlay")
    for f in OVERLAY.rglob("*"):
        if f.is_file():
            dst = DST / f.relative_to(OVERLAY)
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, dst)


def sync_public() -> None:
    step("public 에셋 (real-scan 전체 미러, models 는 추가만 — 셸의 glb 와 섞여 있음)")
    src_rs, dst_rs = WD / "public/real-scan", SHELL_PUBLIC / "real-scan"
    if dst_rs.exists():
        shutil.rmtree(dst_rs)
    shutil.copytree(src_rs, dst_rs)
    for f in (WD / "public/models").iterdir():
        shutil.copy2(f, SHELL_PUBLIC / "models" / f.name)
    shutil.copy2(WD / "public/icons.svg", SHELL_PUBLIC / "icons.svg")


def check_orphans() -> None:
    step("삭제한 크롬을 아직 참조하는 곳이 없는지")
    # import 지정자만 본다 — 주석에 '왜 ThemeProvider 를 뺐는가' 를 적어 둔 것까지 잡으면 안 된다
    pat = re.compile(r"from '[^']*(?:widgets/(?:layout-wrapper|sidebar|header|footer|user-menu|alarm-menu)|alarm-center|config/navigation|theme/ThemeProvider)[^']*'")
    bad = [f for f in ts_files(DST) if pat.search(read(f))]
    assert not bad, f"삭제된 모듈 참조 잔존 — 원본이 새로 쓰기 시작했다면 DROP 목록을 재검토: {bad}"


def main() -> None:
    copy_source()
    apply_overlay()  # 변환·검사보다 먼저 — 검사는 최종 트리를 봐야 한다
    rewrite_alias()
    rewrite_i18n()
    rewrite_classes()
    rewrite_links()
    patch_asset_paths()
    patch_settings()
    patch_test_helper()
    patch_docs_registry()
    patch_globals_css()
    patch_fixed_viewport()
    patch_block_list_scroller()
    check_orphans()
    sync_public()
    print("✓ sync 완료 — 이어서: pnpm --filter @crane/shell typecheck && pnpm lint && pnpm --filter @crane/shell build")
    print("  ⚠️ dev 서버 재시작 + 브라우저 Ctrl+Shift+R 필요 (Vite 모듈 그래프가 옛 트리를 가리킨다)")


if __name__ == "__main__":
    main()
