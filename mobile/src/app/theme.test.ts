import { beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, getStoredTheme, THEME_KEY, toggleTheme } from './theme'

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('defaults to dark when unset', () => {
    expect(getStoredTheme()).toBe('dark')
  })

  it('applyTheme persists and sets data-theme', () => {
    applyTheme('light')
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('toggleTheme flips dark ↔ light', () => {
    applyTheme('dark')
    expect(toggleTheme()).toBe('light')
    expect(toggleTheme()).toBe('dark')
  })
})
