import { describe, it, expect } from 'vitest'
import { resolveFontStack, normalizeCssValue, areChangesSameComputed } from '../visual-reason.js'
import type { Change } from '../diff.js'

function change(property: string, before: string, after: string): Change {
  return { property, before, after, category: 'typography', description: '' }
}

describe('resolveFontStack', () => {
  it('returns the first system-loaded font in the stack', () => {
    expect(resolveFontStack('Inter, -apple-system, BlinkMacSystemFont, sans-serif'))
      .toBe('-apple-system')
  })

  it('prefers system-ui over downstream fallbacks', () => {
    expect(resolveFontStack('system-ui, -apple-system, sans-serif')).toBe('system-ui')
  })

  it('strips quotes and lowercases', () => {
    expect(resolveFontStack('"Helvetica Neue", Arial, sans-serif')).toBe('helvetica neue')
  })

  it('falls through to the last token when nothing in the stack is recognized as loaded', () => {
    expect(resolveFontStack('Whatever-Custom, Another-Custom')).toBe('another-custom')
  })
})

describe('normalizeCssValue', () => {
  it('uses font-stack resolution for font-family', () => {
    const a = normalizeCssValue('font-family', 'Inter, -apple-system, sans-serif')
    const b = normalizeCssValue('font-family', '"Inter", -apple-system, sans-serif')
    expect(a).toBe(b)
    expect(a).toBe('-apple-system')
  })

  it('lowercases and collapses whitespace for generic values', () => {
    expect(normalizeCssValue('color', '  RED  ')).toBe('red')
    expect(normalizeCssValue('padding', '4px  8px')).toBe('4px 8px')
  })

  it('returns empty string for null', () => {
    expect(normalizeCssValue('color', null)).toBe('')
  })
})

describe('areChangesSameComputed', () => {
  it('flags font-family swaps that both resolve to the same system font', () => {
    const changes = [
      change('font-family', 'Inter, -apple-system, sans-serif', '"Inter", -apple-system, sans-serif'),
    ]
    expect(areChangesSameComputed(changes)).toBe(true)
  })

  it('flags case/whitespace noise on arbitrary properties', () => {
    const changes = [change('color', 'RED', '  red  ')]
    expect(areChangesSameComputed(changes)).toBe(true)
  })

  it('returns false when any change actually differs once normalized', () => {
    const changes = [
      change('font-family', 'Inter, -apple-system', '"Inter", -apple-system'), // equal
      change('color', 'rgb(0, 0, 0)', 'rgb(10, 0, 0)'),                         // different
    ]
    expect(areChangesSameComputed(changes)).toBe(false)
  })

  it('returns false for empty input — no evidence to promote', () => {
    expect(areChangesSameComputed([])).toBe(false)
  })

  it('returns false when before or after is null (added/removed, not equivalent)', () => {
    const c: Change = { property: 'color', before: null, after: 'red', category: 'visual', description: '' }
    expect(areChangesSameComputed([c])).toBe(false)
  })
})
