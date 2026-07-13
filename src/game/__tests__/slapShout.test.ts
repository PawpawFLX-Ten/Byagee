import { describe, expect, it } from 'vitest'
import { slapShoutLine } from '../slapShout'
import { setLang } from '../i18n'

describe('slapShout', () => {
  it('uses 操你妈', () => {
    setLang('zh')
    expect(slapShoutLine()).toBe('操你妈')
  })
})
