import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '../../../shared/lib/utils'
import { headingText, slugifyHeading } from '../lib/headings'

/*
 * 마크다운 타이포그래피.
 *
 * 프로즈 플러그인을 쓰지 않고 요소별로 직접 준다 — 이 앱의 텍스트 스케일은
 * `--app-font-scale` 을 곱한 자체 토큰이라, 플러그인이 들고 오는 rem 기반
 * 크기와 섞이면 글자 크기 설정이 문서 화면에서만 안 먹는다.
 */
const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-8 mb-3 text-inshop-xl font-semibold tracking-[-0.01em] text-foreground first:mt-0">
      {children}
    </h1>
  ),
  /*
   * h2·h3 만 앵커를 갖는다 — 목차가 담는 깊이와 같아야 목차 클릭이 항상 맞는
   * 자리로 간다. 툴바가 상단에 떠 있으므로 scroll-margin 으로 그 높이만큼 비운다.
   */
  h2: ({ children }) => (
    <h2
      id={slugifyHeading(headingText(children))}
      className="mt-8 mb-3 scroll-mt-20 border-b border-border pb-1.5 text-inshop-lg font-semibold text-foreground first:mt-0"
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      id={slugifyHeading(headingText(children))}
      className="mt-6 mb-2 scroll-mt-20 text-inshop-base font-semibold text-foreground first:mt-0"
    >
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-5 mb-2 text-inshop-sm font-semibold text-foreground/85 first:mt-0">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="my-3 text-inshop-sm leading-relaxed text-foreground/75">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-1.5 pl-5 text-inshop-sm leading-relaxed text-foreground/75 marker:text-foreground/40">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-1.5 pl-5 text-inshop-sm leading-relaxed text-foreground/75 marker:text-foreground/50">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-foreground/80">{children}</em>,
  a: ({ href, children }) => (
    /*
     * 문서 안의 링크는 대부분 레포 상대 경로(`../docs/…`)다 — 앱 라우트가 아니라서
     * 눌러도 갈 곳이 없다. 그래서 http(s) 링크만 실제 링크로 두고, 나머지는
     * 경로 표기로만 남긴다 (404 로 보내는 것보다 정직하다).
     */
    href?.startsWith('http') ? (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent"
      >
        {children}
      </a>
    ) : (
      <span
        title={href}
        className="border-b border-dashed border-foreground/20 text-foreground/70"
      >
        {children}
      </span>
    )
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-4 rounded-r-inshop-md border-l-2 border-accent/50 bg-surface-secondary/60 py-1 pl-3.5 pr-3 text-inshop-sm text-foreground/70">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-border" />,
  code: ({ className: codeClass, children }) => {
    // 코드펜스는 language-* 클래스를 달고 온다 — 그게 없으면 문장 속 인라인 코드다
    const isBlock = Boolean(codeClass?.startsWith('language-'))
    if (isBlock) {
      return (
        <code className="block font-mono text-inshop-xs leading-relaxed text-foreground/85">
          {children}
        </code>
      )
    }
    return (
      <code className="rounded-inshop-xs bg-foreground/8 px-1 py-0.5 font-mono text-inshop-xs text-foreground/85">
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    // 긴 코드 블록은 페이지가 아니라 자기 안에서 가로로 구른다
    <pre className="my-4 overflow-x-auto rounded-inshop-md border border-border bg-surface-secondary/70 p-3.5">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-inshop-md border border-border">
      <table className="w-full border-collapse text-inshop-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface-secondary/70">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-2 text-left text-inshop-xs font-semibold text-foreground/70">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/60 px-3 py-2 align-top text-foreground/75">{children}</td>
  ),
  input: ({ checked, type }) =>
    type === 'checkbox' ? (
      <input
        type="checkbox"
        checked={checked}
        readOnly
        className="mr-1.5 h-3 w-3 translate-y-px accent-accent"
      />
    ) : null,
}

interface MarkdownViewProps {
  markdown: string
  className?: string
}

export function MarkdownView({ markdown, className }: MarkdownViewProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
