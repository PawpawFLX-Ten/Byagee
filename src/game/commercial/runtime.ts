import { DISHES, dishById } from './dishes'

export const DEFAULT_FEED_TARGET = 8
export const DEFAULT_ROUND_SEC = 60

export type SkinId = 'hearth' | 'popup'

export interface BrandPreset {
  id: SkinId
  titleZh: string
  titleEn: string
  logoText: string
  primary: string
  accent: string
  tablecloth: string
  floor: string
  wall: string
  wallAccent: string
}

export const BRAND_PRESETS: Record<SkinId, BrandPreset> = {
  hearth: {
    id: 'hearth',
    titleZh: '暖桌小馆',
    titleEn: 'Hearth Table',
    logoText: '暖桌',
    primary: '#c46a2d',
    accent: '#f3d2a4',
    tablecloth: '#f6e6cf',
    floor: '#ead7be',
    wall: '#e7d3b8',
    wallAccent: '#c4a07a',
  },
  popup: {
    id: 'popup',
    titleZh: '品牌快闪餐桌',
    titleEn: 'Brand Pop-up Table',
    logoText: '快闪',
    primary: '#1f8a70',
    accent: '#d4f3ea',
    tablecloth: '#f4fbf7',
    floor: '#efe6d4',
    wall: '#f4f0e6',
    wallAccent: '#1f8a70',
  },
}

export interface ResolvedBrand {
  id: SkinId
  titleZh: string
  titleEn: string
  /** Set by `?title=`. Wins over the preset name. */
  titleOverride: string | null
  logoText: string
  logoUrl: string
  primary: string
  accent: string
  tablecloth: string
  floor: string
  wall: string
  wallAccent: string
  webhookUrl: string
  mailto: string
  featuredDishId: string | null
  feedTarget: number
  roundLimitSec: number
}

export interface CommercialQuery {
  mode: 'commercial' | 'classic'
  skin: SkinId | null
  color: string | null
  logoUrl: string | null
  logoText: string | null
  title: string | null
  dish: string | null
  lang: 'zh' | 'en' | 'nl' | null
  goal: number | null
  seconds: number | null
  webhookUrl: string | null
  mailto: string | null
}

interface FieldLocks {
  title: boolean
  logoText: boolean
  primary: boolean
  logoUrl: boolean
}

let enabled = false
let uiLang = 'zh'
let locks: FieldLocks = { title: false, logoText: false, primary: false, logoUrl: false }
let brand: ResolvedBrand = brandFromPreset('hearth')
const listeners = new Set<() => void>()

function brandFromPreset(id: SkinId, base?: ResolvedBrand): ResolvedBrand {
  const preset = BRAND_PRESETS[id]
  return {
    id,
    titleZh: preset.titleZh,
    titleEn: preset.titleEn,
    titleOverride: base?.titleOverride ?? null,
    logoText: preset.logoText,
    logoUrl: '',
    primary: preset.primary,
    accent: preset.accent,
    tablecloth: preset.tablecloth,
    floor: preset.floor,
    wall: preset.wall,
    wallAccent: preset.wallAccent,
    webhookUrl: base?.webhookUrl ?? '',
    mailto: base?.mailto ?? '',
    featuredDishId: base?.featuredDishId ?? null,
    feedTarget: base?.feedTarget ?? DEFAULT_FEED_TARGET,
    roundLimitSec: base?.roundLimitSec ?? DEFAULT_ROUND_SEC,
  }
}

export function isCommercial(): boolean {
  return enabled
}

export function setCommercialEnabled(on: boolean): void {
  enabled = on
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('commercial', on)
  }
}

export function getResolvedSkin(): ResolvedBrand {
  return brand
}

export function getSessionConfig(): { feedTarget: number; roundLimitSec: number } {
  return { feedTarget: brand.feedTarget, roundLimitSec: brand.roundLimitSec }
}

export function getFeaturedDishId(): string | null {
  return brand.featuredDishId
}

export function subscribeBrand(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emit(): void {
  applyDocumentChrome()
  for (const listener of listeners) listener()
}

export function displayTitle(lang = uiLang): string {
  if (brand.titleOverride) return brand.titleOverride
  return lang === 'zh' ? brand.titleZh : brand.titleEn
}

export function applyDocumentChrome(): void {
  if (typeof document === 'undefined') return
  document.body.classList.toggle('commercial', enabled)
  if (!enabled) return
  const root = document.documentElement
  root.style.setProperty('--brand', brand.primary)
  root.style.setProperty('--brand-soft', brand.accent)
  const title = displayTitle(uiLang)
  document.title = uiLang === 'zh' ? `${title} — 喂饱他们` : `${title} — Feed the table`
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', brand.primary)
}

export function setBrandLang(lang: string): void {
  uiLang = lang
  applyDocumentChrome()
}

export function selectSkin(id: SkinId): void {
  const preset = BRAND_PRESETS[id]
  const next = brandFromPreset(id, brand)
  if (locks.title) {
    next.titleZh = brand.titleZh
    next.titleEn = brand.titleEn
    next.titleOverride = brand.titleOverride
  }
  if (locks.logoText) next.logoText = brand.logoText
  if (locks.primary) next.primary = brand.primary
  if (locks.logoUrl) next.logoUrl = brand.logoUrl
  next.accent = preset.accent
  brand = next
  emit()
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function normalizeColor(raw: string | null): string | null {
  if (!raw) return null
  const hex = raw.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null
  return `#${hex.toLowerCase()}`
}

export function parseCommercialQuery(search: string): CommercialQuery {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const modeRaw = params.get('mode')
  const skinRaw = params.get('skin')
  const langRaw = params.get('lang')
  const goalRaw = Number(params.get('goal'))
  const secondsRaw = Number(params.get('seconds'))
  const dishRaw = params.get('dish')
  return {
    mode: modeRaw === 'classic' ? 'classic' : 'commercial',
    skin: skinRaw === 'hearth' || skinRaw === 'popup' ? skinRaw : null,
    color: normalizeColor(params.get('color')),
    logoUrl: params.get('logo'),
    logoText: params.get('logoText'),
    title: params.get('title'),
    dish: dishRaw && dishById(dishRaw) ? dishRaw : null,
    lang: langRaw === 'zh' || langRaw === 'en' || langRaw === 'nl' ? langRaw : null,
    goal: Number.isFinite(goalRaw) && goalRaw > 0 ? clampInt(goalRaw, 1, 40) : null,
    seconds: Number.isFinite(secondsRaw) && secondsRaw > 0 ? clampInt(secondsRaw, 15, 180) : null,
    webhookUrl: params.get('webhook'),
    mailto: params.get('mailto'),
  }
}

export function applyCommercialQuery(query: CommercialQuery): void {
  const id = query.skin ?? 'hearth'
  locks = {
    title: Boolean(query.title),
    logoText: Boolean(query.logoText),
    primary: Boolean(query.color),
    logoUrl: Boolean(query.logoUrl),
  }
  const next = brandFromPreset(id)
  if (query.title) {
    next.titleOverride = query.title
    next.titleZh = query.title
    next.titleEn = query.title
  }
  if (query.logoText) next.logoText = query.logoText
  if (query.color) next.primary = query.color
  if (query.logoUrl) next.logoUrl = query.logoUrl
  if (query.dish) next.featuredDishId = query.dish
  if (query.goal) next.feedTarget = query.goal
  if (query.seconds) next.roundLimitSec = query.seconds
  if (query.webhookUrl) next.webhookUrl = query.webhookUrl
  if (query.mailto) next.mailto = query.mailto
  brand = next
  emit()
}

/** Test helper — restore the module to its import-time defaults. */
export function resetCommercialRuntime(): void {
  enabled = false
  uiLang = 'zh'
  locks = { title: false, logoText: false, primary: false, logoUrl: false }
  brand = brandFromPreset('hearth')
  if (typeof document !== 'undefined') document.body.classList.remove('commercial')
}

export function knownDishIds(): string[] {
  return DISHES.map((dish) => dish.id)
}
