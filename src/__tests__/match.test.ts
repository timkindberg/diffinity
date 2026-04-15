import { describe, it, expect, beforeEach } from 'vitest'
import { matchManifests } from '../match.js'
import { el, manifest, resetIdx } from './test-helpers.js'

beforeEach(() => resetIdx())

describe('matchManifests', () => {
  it('matches identical trees perfectly', () => {
    const before = manifest(
      el('body', { children: [
        el('div', { testId: 'nav', children: [
          el('a', { accessibleName: 'Home', attrs: { href: '/' } }),
          el('a', { accessibleName: 'About', attrs: { href: '/about' } }),
        ]}),
        el('main', { role: 'main', children: [
          el('h1', { text: 'Hello' }),
        ]}),
      ]})
    )

    resetIdx()
    const after = manifest(
      el('body', { children: [
        el('div', { testId: 'nav', children: [
          el('a', { accessibleName: 'Home', attrs: { href: '/' } }),
          el('a', { accessibleName: 'About', attrs: { href: '/about' } }),
        ]}),
        el('main', { role: 'main', children: [
          el('h1', { text: 'Hello' }),
        ]}),
      ]})
    )

    const result = matchManifests(before, after)
    expect(result.matched).toHaveLength(6)
    expect(result.removed).toHaveLength(0)
    expect(result.added).toHaveLength(0)
  })

  it('detects removed elements', () => {
    const before = manifest(
      el('body', { children: [
        el('div', { testId: 'keep' }),
        el('div', { testId: 'remove-me' }),
      ]})
    )

    resetIdx()
    const after = manifest(
      el('body', { children: [
        el('div', { testId: 'keep' }),
      ]})
    )

    const result = matchManifests(before, after)
    expect(result.matched).toHaveLength(2) // body + keep
    expect(result.removed).toHaveLength(1)
    expect(result.added).toHaveLength(0)
  })

  it('detects added elements', () => {
    const before = manifest(
      el('body', { children: [
        el('div', { testId: 'existing' }),
      ]})
    )

    resetIdx()
    const after = manifest(
      el('body', { children: [
        el('div', { testId: 'existing' }),
        el('div', { testId: 'new-element' }),
      ]})
    )

    const result = matchManifests(before, after)
    expect(result.matched).toHaveLength(2) // body + existing
    expect(result.removed).toHaveLength(0)
    expect(result.added).toHaveLength(1)
  })

  it('matches elements that moved to a different parent', () => {
    const before = manifest(
      el('body', { children: [
        el('nav', { role: 'navigation', children: [
          el('a', { testId: 'link-home', accessibleName: 'Home' }),
        ]}),
        el('main', { role: 'main' }),
      ]})
    )

    resetIdx()
    const after = manifest(
      el('body', { children: [
        el('nav', { role: 'navigation' }),
        el('main', { role: 'main', children: [
          el('a', { testId: 'link-home', accessibleName: 'Home' }),
        ]}),
      ]})
    )

    const result = matchManifests(before, after)
    const linkMatch = result.matched.find(m => {
      // The link was before idx 2, should be matched to after idx 3
      return m.score > 0
    })
    expect(result.removed).toHaveLength(0)
    expect(result.added).toHaveLength(0)
    expect(result.matched).toHaveLength(4) // body, nav, main, link — all matched
  })

  it('matches elements despite text changes', () => {
    const before = manifest(
      el('body', { children: [
        el('button', { testId: 'submit', text: 'Submit' }),
      ]})
    )

    resetIdx()
    const after = manifest(
      el('body', { children: [
        el('button', { testId: 'submit', text: 'Save' }),
      ]})
    )

    const result = matchManifests(before, after)
    expect(result.matched).toHaveLength(2)
    expect(result.removed).toHaveLength(0)
    expect(result.added).toHaveLength(0)
  })

  it('matches elements despite style changes', () => {
    const before = manifest(
      el('body', { children: [
        el('div', { testId: 'card', styles: { 'padding-top': '16px', color: 'rgb(0,0,0)' } }),
      ]})
    )

    resetIdx()
    const after = manifest(
      el('body', { children: [
        el('div', { testId: 'card', styles: { 'padding-top': '24px', color: 'rgb(51,51,51)' } }),
      ]})
    )

    const result = matchManifests(before, after)
    expect(result.matched).toHaveLength(2)
    expect(result.removed).toHaveLength(0)
    expect(result.added).toHaveLength(0)
  })

  it('does not match elements with different tags', () => {
    const before = manifest(
      el('body', { children: [
        el('div', { testId: 'x' }),
      ]})
    )

    resetIdx()
    const after = manifest(
      el('body', { children: [
        el('span', { testId: 'x' }),
      ]})
    )

    const result = matchManifests(before, after)
    expect(result.matched).toHaveLength(1) // body only
    expect(result.removed).toHaveLength(1)
    expect(result.added).toHaveLength(1)
  })

  it('skips framework-generated ids like :r0:', () => {
    const before = manifest(
      el('body', { children: [
        el('div', { id: ':r0:', text: 'Alpha' }),
        el('div', { id: ':r1:', text: 'Beta' }),
      ]})
    )

    resetIdx()
    const after = manifest(
      el('body', { children: [
        el('div', { id: ':r5:', text: 'Alpha' }),
        el('div', { id: ':r6:', text: 'Beta' }),
      ]})
    )

    const result = matchManifests(before, after)
    // Should still match via text content, not id
    expect(result.matched).toHaveLength(3)
    expect(result.removed).toHaveLength(0)
    expect(result.added).toHaveLength(0)
  })

  it('handles empty manifests', () => {
    const before = { capturedAt: '', captureTimeMs: 0, url: '', viewportWidth: 0, viewportHeight: 0, totalElements: 0, root: null }
    const after = { capturedAt: '', captureTimeMs: 0, url: '', viewportWidth: 0, viewportHeight: 0, totalElements: 0, root: null }

    const result = matchManifests(before, after)
    expect(result.matched).toHaveLength(0)
    expect(result.removed).toHaveLength(0)
    expect(result.added).toHaveLength(0)
  })

  it('prefers higher-signal matches over lower ones', () => {
    const before = manifest(
      el('body', { idx: 100, children: [
        el('button', { idx: 10, testId: 'save', text: 'Save' }),
        el('button', { idx: 11, text: 'Cancel' }),
      ]})
    )

    resetIdx()
    const after = manifest(
      el('body', { idx: 100, children: [
        el('button', { idx: 20, text: 'Cancel' }),
        el('button', { idx: 21, testId: 'save', text: 'Save Changes' }),
      ]})
    )

    const result = matchManifests(before, after)
    expect(result.matched).toHaveLength(3)

    // testId match should pair save→save despite text change and reordering
    const saveMatch = result.matched.find(m => m.beforeIdx === 10)!
    expect(saveMatch).toBeDefined()
    expect(saveMatch.afterIdx).toBe(21)
  })
})
