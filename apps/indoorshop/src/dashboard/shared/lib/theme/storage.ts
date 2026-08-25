export type Theme = 'light' | 'dark' | 'system'

export function getInitialTheme(): Theme {
  // Check localStorage first
  const stored = localStorage.getItem('theme') as Theme | null
  if (stored && ['light', 'dark', 'system'].includes(stored)) {
    return stored
  }

  // Fall back to system preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }

  return 'light'
}

export function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return theme
}

export function applyTheme(theme: Theme): void {
  const effectiveTheme = getEffectiveTheme(theme)
  const html = document.documentElement

  if (effectiveTheme === 'dark') {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }

  try {
    localStorage.setItem('theme', theme)
  } catch (e) {
    console.warn('Failed to save theme to localStorage:', e)
  }
}
