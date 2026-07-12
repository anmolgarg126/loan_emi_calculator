export type Theme = 'light' | 'dark'

const THEME_KEY = 'loan-emi-theme:v1'

export const readTheme = (): Theme => {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // The in-memory theme still works when storage is blocked.
  }
}
