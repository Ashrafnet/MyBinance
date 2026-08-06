export type Theme = 'dark' | 'light'

export const THEME_KEY = 'mybinance.theme'

const listeners = new Set<(t: Theme) => void>()

export function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* private mode */
  }
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#07090f' : '#f2f5fa')
  listeners.forEach((cb) => cb(theme))
}

export function toggleTheme(): Theme {
  const next: Theme = getStoredTheme() === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  return next
}

export function subscribeTheme(cb: (t: Theme) => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

if (typeof document !== 'undefined') {
  applyTheme(getStoredTheme())
}
