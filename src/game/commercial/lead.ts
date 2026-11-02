import type { CommercialOutcome } from './session'
import { getResolvedSkin } from './runtime'

export interface LeadPayload {
  name: string
  contact: string
  privacy: true
  skinId: string
  title: string
  lang: string
  fedPoints: number
  feedTarget: number
  outcome: CommercialOutcome | 'inquiry'
  page: string
  createdAt: string
}

export type LeadVia = 'webhook' | 'mailto' | 'local'

/**
 * Demo lead capture. Always logs locally. Posts when `webhook` is set
 * (`?webhook=` or the skin config). Opens a mailto draft when `mailto` is
 * set and no webhook answered. A failed post still counts as received so
 * the demo is not blocked on a missing backend.
 */
export async function submitLead(payload: LeadPayload): Promise<{ ok: true; via: LeadVia }> {
  console.log('[commercial-lead]', payload)
  const skin = getResolvedSkin()
  if (skin.webhookUrl) {
    try {
      await fetch(skin.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return { ok: true, via: 'webhook' }
    } catch (err) {
      console.warn('[commercial-lead] webhook failed', err)
    }
  }
  if (skin.mailto && typeof window !== 'undefined') {
    const subject = encodeURIComponent('餐桌互动示例 · 商务合作')
    const body = encodeURIComponent(`${payload.name}\n${payload.contact}\n${payload.outcome}`)
    window.location.href = `mailto:${skin.mailto}?subject=${subject}&body=${body}`
    return { ok: true, via: 'mailto' }
  }
  return { ok: true, via: 'local' }
}
