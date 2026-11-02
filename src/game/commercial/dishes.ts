import type { SkillId } from '../types'

/**
 * Dish catalog for the commercial dining skin.
 *
 * Adding a dish is a data change: append one object here. Give it an id,
 * names, a mesh tint, a shape, feed power, and a rarity. To put it on a
 * feeding action, point that action at the id in `SKILL_DISH` below.
 * No other gameplay file needs a new branch.
 *
 * Highlight one dish for a brand demo with `?dish=<id>` (it replaces the
 * signature serve on key 4). See COMMERCIAL.md.
 */
export type DishRarity = 'common' | 'uncommon' | 'rare' | 'signature'
export type DishShape = 'bowl' | 'plate' | 'cup' | 'dumpling' | 'box'

export interface Dish {
  id: string
  name: { zh: string; en: string }
  emoji: string
  /** Main mesh tint. */
  color: string
  /** Bowl, plate, or garnish tint. */
  accent: string
  /** Fullness added per guest this dish reaches. */
  feedPower: number
  rarity: DishRarity
  shape: DishShape
}

export const DISHES: readonly Dish[] = [
  {
    id: 'rice-bowl',
    name: { zh: '米饭碗', en: 'Rice Bowl' },
    emoji: '🍚',
    color: '#f4f0e4',
    accent: '#e4c98a',
    feedPower: 1,
    rarity: 'common',
    shape: 'bowl',
  },
  {
    id: 'dumpling',
    name: { zh: '饺子', en: 'Dumplings' },
    emoji: '🥟',
    color: '#f7f1e4',
    accent: '#d9c4a4',
    feedPower: 2,
    rarity: 'common',
    shape: 'dumpling',
  },
  {
    id: 'noodle',
    name: { zh: '热汤面', en: 'Noodle Bowl' },
    emoji: '🍜',
    color: '#f0d7a2',
    accent: '#c45c26',
    feedPower: 3,
    rarity: 'uncommon',
    shape: 'bowl',
  },
  {
    id: 'soup',
    name: { zh: '例汤', en: 'Soup' },
    emoji: '🍲',
    color: '#e7b15a',
    accent: '#8d4a22',
    feedPower: 1,
    rarity: 'common',
    shape: 'bowl',
  },
  {
    id: 'salad',
    name: { zh: '时蔬沙拉', en: 'Garden Salad' },
    emoji: '🥗',
    color: '#7dae5a',
    accent: '#f4f7ef',
    feedPower: 1,
    rarity: 'common',
    shape: 'plate',
  },
  {
    id: 'dessert',
    name: { zh: '甜品', en: 'Dessert' },
    emoji: '🍰',
    color: '#f3c1c8',
    accent: '#fff6f2',
    feedPower: 2,
    rarity: 'rare',
    shape: 'box',
  },
  {
    id: 'drink',
    name: { zh: '热饮', en: 'Warm Drink' },
    emoji: '🍵',
    color: '#d7efe4',
    accent: '#2f6f5e',
    feedPower: 1,
    rarity: 'common',
    shape: 'cup',
  },
  {
    id: 'brand-special',
    name: { zh: '招牌菜', en: 'House Special' },
    emoji: '✨',
    color: '#f0c14a',
    accent: '#fff4cc',
    feedPower: 3,
    rarity: 'signature',
    shape: 'plate',
  },
]

/**
 * Which catalog dish a feeding action serves.
 * Key 4 (`gag` in the original skill ids) is the signature slot and is
 * replaced when `?dish=` points at another catalog id.
 */
export const SKILL_DISH: Record<SkillId, string> = {
  slap: 'rice-bowl',
  tape: 'dumpling',
  megaphone: 'soup',
  gag: 'noodle',
  poop: 'salad',
  civility: 'dessert',
}

const BY_ID = new Map(DISHES.map((dish) => [dish.id, dish]))

export function dishById(id: string): Dish | undefined {
  return BY_ID.get(id)
}

export function dishLabel(dish: Dish, lang: string): string {
  return lang === 'zh' ? dish.name.zh : dish.name.en
}
