#!/usr/bin/env python3
"""
ocean-inshop-process/web-dashboard → apps/indoorshop 이식 동기화.

    python scripts/sync-inshop.py [<ocean-inshop-process 경로>]

원본이 갱신될 때마다 이 스크립트 하나로 다시 옮긴다. 손으로 옮기면 29개 파일
중 한두 개를 빠뜨리는 것이 보통이라, 이식에 필요한 변환을 전부 여기 모아
**결정적**으로 재실행한다. 단계마다 assert 를 걸어, 원본 구조가 바뀌어 변환이
더 이상 맞지 않으면 조용히 지나가지 않고 여기서 멈춘다.

셸과 원본이 부딪히는 지점(왜 이 변환이 필요한지):
  - 디자인 토큰 이름 충돌 (--background/--accent/--text-*/--radius-*)  → 스코프·개명
  - i18next 전역 싱글턴 이중 init                                    → 네임스페이스 등록
  - '/' 루트 배포 전제의 절대 경로 (fetch, <Link>)                     → BASE_URL·/indoorshop 접두
  - 자체 헤더·사이드바·테마 provider                                  → 셸 것으로 대체
"""
from __future__ import annotations

import re
import shutil
import sys

# Windows 콘솔(cp949)에서 한글·기호 출력이 깨지지 않도록
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_REPO = Path(sys.argv[1] if len(sys.argv) > 1 else "C:/ocean-inshop-process")
WD = SRC_REPO / "web-dashboard"
DST = ROOT / "apps/indoorshop/src"
DASH = DST / "dashboard"
PAGES = DST / "pages"
OVERLAY = ROOT / "scripts/inshop-sync/overlay"
SHELL_PUBLIC = ROOT / "apps/shell/public"

DASH_LAYERS = ("shared", "features", "entities", "widgets", "assets")
PAGE_SLICES = ("dashboard", "zone-detail", "assembly", "yard", "settings", "docs", "not-found")

# 셸 AppLayout 이 대신하는 원본 크롬 — 옮기지 않는다 (그것만 쓰던 조각도 함께)
DROP_DIRS = (
    "widgets/layout-wrapper", "widgets/sidebar", "widgets/header", "widgets/footer",
    "widgets/user-menu", "widgets/alarm-menu",
    "features/alarm-center", "entities/alarm",
)
DROP_FILES = ("shared/config/navigation.ts", "shared/lib/theme/ThemeProvider.tsx")


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
    if DASH.exists():
        shutil.rmtree(DASH)
    for d in PAGES.glob("inshop-*"):
        shutil.rmtree(d)

    for layer in DASH_LAYERS:
        shutil.copytree(WD / "src" / layer, DASH / layer)

    upstream_pages = sorted(p.name for p in (WD / "src/pages").iterdir() if p.is_dir())
    assert upstream_pages == sorted(PAGE_SLICES), (
        f"원본 pages 구성이 바뀜: {upstream_pages}. PAGE_SLICES 와 overlay 의 index.ts 를 갱신할 것"
    )
    for slice_ in PAGE_SLICES:
        shutil.copytree(WD / "src/pages" / slice_, PAGES / f"inshop-{slice_}")

    for d in DROP_DIRS:
        shutil.rmtree(DASH / d)
    for f in DROP_FILES:
        (DASH / f).unlink()

    # 문서 뷰어가 읽는 마크다운 — 원본 레포의 docs/·AGENTS.md·ROUTING.md
    content = DASH / "entities/doc/content"
    content.mkdir()
    for md in (SRC_REPO / "docs").glob("*.md"):
        shutil.copy2(md, content / md.name)
    shutil.copy2(SRC_REPO / "AGENTS.md", content / "AGENTS.md")
    shutil.copy2(WD / "ROUTING.md", content / "ROUTING.md")


# ── 2. import 경로 ───────────────────────────────────────────────────────────
def target_for(spec: str) -> str:
    rest = spec[2:]
    head, _, tail = rest.partition("/")
    if head == "dashboard":
        return f"src/{rest}"
    if head in DASH_LAYERS:
        return f"src/dashboard/{rest}"
    if head == "pages":
        slice_, _, sub = tail.partition("/")
        if slice_ in PAGE_SLICES:
            return f"src/pages/inshop-{slice_}" + (f"/{sub}" if sub else "")
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
    step("i18n: useTranslation 셔 · ParseKeys → InshopKey")
    shim = "src/dashboard/shared/lib/i18n/useTranslation"
    keys = "src/dashboard/shared/lib/i18n/keys"
    n_t = n_k = 0
    for f in ts_files(DST):
        if f.as_posix().endswith(("i18n/useTranslation.ts", "i18n/keys.ts", "i18next.d.ts", "i18n/config.ts")):
            continue
        s = read(f); o = s
        if "import { useTranslation } from 'react-i18next'" in s:
            s = s.replace("import { useTranslation } from 'react-i18next'",
                          f"import {{ useTranslation }} from '{rel_import(f, shim)}'")
            n_t += 1
        # `import type { ParseKeys }`, `{ ParseKeys, TFunction }`, `{ TFunction, ParseKeys }` 전부 처리
        m = re.search(r"import type \{([^}]*)\} from 'i18next'\n", s)
        if m and "ParseKeys" in m.group(1):
            names = [x.strip() for x in m.group(1).split(",") if x.strip() and x.strip() != "ParseKeys"]
            rest = f"import type {{ {', '.join(names)} }} from 'i18next'\n" if names else ""
            s = s.replace(m.group(0), rest + f"import type {{ InshopKey }} from '{rel_import(f, keys)}'\n")
            s = re.sub(r"\bParseKeys\b", "InshopKey", s)
            n_k += 1
        if s != o:
            write(f, s)
    bad = [f for f in ts_files(DST) if "from 'react-i18next'" in read(f) and not f.as_posix().endswith("i18n/useTranslation.ts")]
    assert not bad, f"react-i18next 직접 import 잔존: {bad}"
    assert not [f for f in ts_files(DST) if "ParseKeys" in read(f) and not f.as_posix().endswith("i18n/keys.ts")]
    print(f"    useTranslation {n_t} files, ParseKeys {n_k} files")


# ── 4. Tailwind 클래스 개명 ──────────────────────────────────────────────────
def rewrite_classes() -> None:
    step("충돌하는 Tailwind 스케일 개명 (text-xs..2xl, rounded-xs..lg)")
    n = 0
    for f in DST.rglob("*.tsx"):
        s = read(f); o = s
        s = re.sub(r"\btext-(2xl|xl|base|lg|sm|xs)\b", r"text-inshop-\1", s)
        s = re.sub(r"\brounded-(xs|sm|md|lg)\b", r"rounded-inshop-\1", s)
        s = re.sub(r"\bfont-sans\b", "font-inshop-sans", s)
        s = re.sub(r"\brounded-([tblr]|t[lr]|b[lr])-(xs|sm|md|lg)\b", r"rounded-\1-inshop-\2", s)
        if s != o:
            write(f, s); n += 1
    assert not [f for f in DST.rglob("*.tsx") if "inshop-inshop" in read(f)]
    print(f"    {n} files")


# ── 5. 라우트·에셋 절대 경로 ────────────────────────────────────────────────
def rewrite_links() -> None:
    step("내부 링크 /indoorshop 접두 (role 가드가 밖으로 나간 경로를 되돌린다)")
    owned = ("/zones", "/logistics", "/docs", "/settings")
    hits = 0

    def repl(m):
        nonlocal hits
        pre, path = m.group(1), m.group(2)
        if path == "/" or path.startswith(owned):
            hits += 1
            return pre + ("/indoorshop" if path == "/" else "/indoorshop" + path)
        return m.group(0)

    for f in DST.rglob("*.tsx"):
        if f.parts[-3:-1] in (("gathering", "ui"), ("keyin", "ui")):
            continue
        s = read(f)
        s2 = re.sub(r"(to=\"|to=\{`|to=\{'|navigate\('|navigate\(`)(/[^\"`']*)", repl, s)
        if s2 != s:
            write(f, s2)
    print(f"    {hits} links")


def patch_asset_paths() -> None:
    step("public 에셋 fetch 에 BASE_URL (/crane_rnd/) 씌우기")
    imp = "import { publicAsset } from '@/dashboard/shared/lib/public-asset'\n"
    p = DASH / "entities/block-model/api/loadBlockModel.ts"
    s = read(p)
    assert s.count("fetch(`/models/") == 3, "loadBlockModel fetch 지점 수가 바뀜"
    s = s.replace("fetch(`/models/${key}.json`)", "fetch(publicAsset(`/models/${key}.json`))")
    s = s.replace("fetch(`/models/${key}.bin`)", "fetch(publicAsset(`/models/${key}.bin`))")
    write(p, imp + s)

    p = DASH / "features/pointcloud-viewer/api/realScanAssets.ts"
    replace_once(p, "const ASSET_BASE = '/real-scan'", "const ASSET_BASE = publicAsset('/real-scan')")
    write(p, imp + read(p))

    # 위 두 파일에 넣은 '@/dashboard/...' 별칭을 상대 경로로 (rewrite_alias 를 한 번 더)
    for p in (DASH / "entities/block-model/api/loadBlockModel.ts", DASH / "features/pointcloud-viewer/api/realScanAssets.ts"):
        s = read(p)
        write(p, re.sub(r"'(@/[^']*)'", lambda m: f"'{rel_import(p, target_for(m.group(1)))}'", s))

    left = [f for f in ts_files(DST) if re.search(r"fetch\(`/|fetch\('/|= '/real-scan'|'/models/", read(f))]
    assert not left, f"절대 경로 fetch 잔존: {left}"


# ── 6. 개별 패치 ─────────────────────────────────────────────────────────────
def patch_settings() -> None:
    step("설정: 'system' 테마 항목 제거 (셸 ThemeProvider 는 light/dark 만 저장)")
    p = PAGES / "inshop-settings/ui/SettingsPage.tsx"
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
    p = DASH / "entities/doc/api/docsRegistry.ts"
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


def patch_block_list_scroller() -> None:
    step("조립 블록 목록 스크롤러: 선택 링이 잘리지 않게 사방 여백")
    p = PAGES / "inshop-assembly/ui/AssemblyWorkspace.tsx"
    replace_once(
        p,
        "'transition-opacity xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1',",
        """/*
                       * 고른 카드는 ring-2 + ring-offset-2 로 바깥 4px 에 링을 그린다. overflow
                       * 컨테이너는 padding box 밖을 잘라내므로, 여백이 없는 쪽(아래·왼쪽·위)과
                       * 스크롤바가 차지하는 오른쪽에서 링이 끊긴다. 링만큼 사방에 여백을 주고
                       * 같은 크기의 음수 마진으로 되돌려 보이는 위치는 그대로 둔다.
                       */
                      'transition-opacity xl:-m-1.5 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:p-1.5',""",
    )


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


# ── 7. overlay · public ──────────────────────────────────────────────────────
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
    pat = re.compile(r"from '[^']*(?:layout-wrapper|widgets/sidebar|widgets/header|widgets/footer|user-menu|alarm-menu|alarm-center|entities/alarm|config/navigation|theme/ThemeProvider)[^']*'")
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
    patch_docs_registry()
    patch_globals_css()
    patch_fixed_viewport()
    patch_block_list_scroller()
    check_orphans()
    sync_public()
    print("✓ sync 완료 — 이어서: pnpm --filter @crane/shell typecheck && pnpm lint && pnpm --filter @crane/shell build")


if __name__ == "__main__":
    main()
