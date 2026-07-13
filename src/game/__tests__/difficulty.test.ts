import { describe, expect, it } from 'vitest'
import { getPhase, scaledSilence } from '../difficulty'

describe('difficulty', () => {
  it('returns early/mid/late by elapsed time', () => {
    expect(getPhase(0)).toBe('early')
    expect(getPhase(59)).toBe('early')
    expect(getPhase(60)).toBe('mid')
    expect(getPhase(179)).toBe('mid')
    expect(getPhase(180)).toBe('late')
  })

  it('scales silence down in later phases', () => {
    expect(scaledSilence(10, 10)).toBe(10)
    expect(scaledSilence(10, 90)).toBe(7)
    expect(scaledSilence(10, 200)).toBe(5)
  })
})
