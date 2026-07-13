import { describe, expect, it } from 'vitest'
import { slapShoutLine } from '../slapShout'

describe('slapShout', () => {
  it('uses 操你妈', () => expect(slapShoutLine()).toBe('操你妈'))
})
