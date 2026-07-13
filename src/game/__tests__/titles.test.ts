import { describe, expect, it } from 'vitest'
import { titleForTime } from '../titles'
import { setLang } from '../i18n'

describe('titles', () => {
  it('returns title bands by survival time', () => {
    setLang('zh')
    expect(titleForTime(0)).toBe('轻度洁癖')
    expect(titleForTime(29)).toBe('轻度洁癖')
    expect(titleForTime(30)).toBe('包间保安')
    expect(titleForTime(90)).toBe('咀嚼克星')
    expect(titleForTime(180)).toBe('食堂死神')
  })
})
