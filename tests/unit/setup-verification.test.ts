import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

describe('Testing infrastructure', () => {
  it('vitest works', () => {
    expect(1 + 1).toBe(2)
  })

  it('fast-check works', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        expect(a + b).toBe(b + a)
      })
    )
  })

  it('jsdom environment is available', () => {
    expect(document).toBeDefined()
    expect(window).toBeDefined()
  })
})
