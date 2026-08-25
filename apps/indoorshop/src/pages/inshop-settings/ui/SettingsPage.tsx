import { useTranslation } from '../../../dashboard/shared/lib/i18n/useTranslation'
import { useTheme } from '../../../dashboard/shared/lib/theme/useTheme'
import { useLanguage } from '../../../dashboard/shared/lib/i18n/useLanguage'
import { LANGUAGES, LANGUAGE_LABEL } from '../../../dashboard/shared/lib/i18n/config'
import { useFontScale } from '../../../dashboard/shared/lib/font-scale/useFontScale'
import {
  FONT_SCALE_OPTIONS,
  FONT_SCALE_VALUES,
} from '../../../dashboard/shared/lib/font-scale/storage'
import { Card, CardContent, CardHeader } from '../../../dashboard/shared/ui/atoms/Card'
import { Button } from '../../../dashboard/shared/ui/atoms/Button'
import { SunIcon, MoonIcon, TextSizeIcon, GlobeIcon } from '../../../dashboard/shared/ui/icons'
import { cn } from '../../../dashboard/shared/lib/utils'
import type { Theme } from '../../../dashboard/shared/lib/theme/storage'
import { APP_VERSION_LABEL } from '../../../dashboard/shared/config/appInfo'

/** 라디오 카드 한 장 — 테마·글자 크기가 같은 모양을 쓴다 */
function OptionRow({
  selected,
  onSelect,
  icon,
  label,
  description,
  trailing,
}: {
  selected: boolean
  onSelect: () => void
  icon?: React.ReactNode
  label: string
  description: string
  trailing?: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-inshop-md border px-4 py-3 text-left transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        selected
          ? 'border-accent bg-accent/8'
          : 'border-border bg-surface hover:border-accent/40 hover:bg-surface-secondary/40',
      )}
    >
      {icon && <span className={cn('shrink-0', selected ? 'text-accent' : 'text-foreground/63')}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-inshop-sm font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-inshop-xs text-foreground/63">{description}</span>
      </span>
      {trailing}
      <span
        aria-hidden="true"
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          selected ? 'border-accent' : 'border-border',
        )}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-accent" />}
      </span>
    </button>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { language, setLanguage } = useLanguage()
  const { fontScale, setFontScale } = useFontScale()

  const themeOptions: { value: Theme; label: string; description: string; icon: React.ReactNode }[] =
    [
      {
        value: 'light',
        label: t('theme.lightFull'),
        description: t('theme.lightDescription'),
        icon: <SunIcon size={18} />,
      },
      {
        value: 'dark',
        label: t('theme.darkFull'),
        description: t('theme.darkDescription'),
        icon: <MoonIcon size={18} />,
      },
      /*
       * 'system' 은 뺀다 — 셸 ThemeProvider 는 light/dark 두 값만 저장한다.
       * 고르면 즉시 light|dark 로 확정되어 선택 표시가 되돌아오지 않는, 눌러도
       * 켜지지 않는 항목이 된다. 셸이 초기값을 정할 때 이미 OS 설정을 따른다.
       */
    ]

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-inshop-xl font-semibold text-foreground">{t('settings.title')}</h1>
        <p className="mt-1 text-inshop-sm text-foreground/68">
          {t('settings.subtitle')}
        </p>
      </div>

      {/* 외관 — 테마 */}
      <Card>
        <CardHeader>
          <h2 className="text-inshop-base font-semibold text-foreground">{t('settings.themeTitle')}</h2>
          <p className="mt-0.5 text-inshop-xs text-foreground/58">{t('settings.themeDescription')}</p>
        </CardHeader>
        <CardContent>
          <div role="radiogroup" aria-label={t('settings.themeGroupLabel')} className="space-y-2">
            {themeOptions.map((option) => (
              <OptionRow
                key={option.value}
                selected={theme === option.value}
                onSelect={() => setTheme(option.value)}
                icon={option.icon}
                label={option.label}
                description={option.description}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/*
        글자 크기.
        브라우저 확대(Ctrl +)는 3D 뷰포트까지 함께 키워 점군이 뭉개진다 —
        글자만 키우는 배율을 따로 둔 이유다.
      */}
      <Card>
        <CardHeader className="mb-3.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-inshop-base font-semibold text-foreground">
              <TextSizeIcon size={17} className="text-foreground/54" />
              {t('settings.fontSizeTitle')}
            </h2>
            <p className="mt-0.5 text-inshop-xs text-foreground/58">
              {t('settings.fontSizeDescription', {
                percent: Math.round(FONT_SCALE_VALUES[fontScale] * 100),
              })}
            </p>
          </div>
          {fontScale !== 'md' && (
            <Button size="sm" variant="ghost" onClick={() => setFontScale('md')}>
              {t('settings.resetToDefault')}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div role="radiogroup" aria-label={t('settings.fontSizeGroupLabel')} className="space-y-2">
            {FONT_SCALE_OPTIONS.map((option) => (
              <OptionRow
                key={option.value}
                selected={fontScale === option.value}
                onSelect={() => setFontScale(option.value)}
                label={t(option.labelKey)}
                description={t(option.descriptionKey)}
                trailing={
                  // 배율 미리보기 — 고르기 전에 크기 차이가 눈에 보여야 한다
                  <span
                    aria-hidden="true"
                    style={{ fontSize: `${13 * FONT_SCALE_VALUES[option.value]}px` }}
                    className="shrink-0 px-2 font-semibold text-foreground/54"
                  >
                    {t('fontScale.glyph')}
                  </span>
                }
              />
            ))}
          </div>

          <div className="rounded-inshop-md border border-border bg-surface-secondary/50 p-3.5">
            <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-foreground/50">
              {t('settings.preview')}
            </p>
            <p className="mt-1.5 text-inshop-base font-semibold text-foreground">{t('settings.previewTitle')}</p>
            <p className="mt-1 text-inshop-sm text-foreground/70">
              {t('settings.previewLine')}
            </p>
            <p className="mt-1 font-mono text-inshop-xs text-foreground/54">
              {t('settings.previewCode')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/*
        언어.
        테마·글자 크기와 같은 격의 설정이라 나란히 둔다 — 계정 메뉴에도 같은
        전환이 있지만, 설정 화면은 "무엇을 바꿀 수 있는지" 목록이기도 하다.
      */}
      <Card>
        <CardHeader>
          <h2 className="flex items-center gap-2 text-inshop-base font-semibold text-foreground">
            <GlobeIcon size={17} className="text-foreground/54" />
            {t('language.label')}
          </h2>
          <p className="mt-0.5 text-inshop-xs text-foreground/58">{t('language.description')}</p>
        </CardHeader>
        <CardContent>
          <div
            role="radiogroup"
            aria-label={t('settings.languageGroupLabel')}
            className="space-y-2"
          >
            {LANGUAGES.map((option) => (
              <OptionRow
                key={option}
                selected={language === option}
                onSelect={() => setLanguage(option)}
                /* 각 언어는 그 언어로 적는다 — 지금 못 읽는 말로 적힌 선택지는 고를 수 없다 */
                label={LANGUAGE_LABEL[option]}
                description={t(`language.${option}Description`)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 정보 */}
      <Card>
        <CardHeader>
          <h2 className="text-inshop-base font-semibold text-foreground">{t('settings.infoTitle')}</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
            <span className="text-inshop-sm text-foreground/63">{t('settings.infoApp')}</span>
            <span className="text-inshop-sm font-medium text-foreground">{t('app.name')}</span>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
            <span className="text-inshop-sm text-foreground/63">{t('settings.infoVersion')}</span>
            <span className="font-mono text-inshop-sm text-foreground">{APP_VERSION_LABEL}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-inshop-sm text-foreground/63">{t('settings.infoOrganization')}</span>
            <span className="text-inshop-sm text-foreground">
              {t('app.organization')} · {t('app.team')}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
