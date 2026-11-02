import type { SkillId } from '../types'
import { dishById, dishLabel, SKILL_DISH, type Dish } from './dishes'
import { getFeaturedDishId } from './runtime'

export type CommercialOutcome = 'playing' | 'win' | 'lose'

/** Dish served by a feeding action. `?dish=` swaps the signature slot (key 4). */
export function dishForSkill(skillId: SkillId): Dish {
  const featured = getFeaturedDishId()
  const id = featured && skillId === 'gag' ? featured : SKILL_DISH[skillId]
  const dish = dishById(id) ?? dishById(SKILL_DISH[skillId]) ?? dishById('rice-bowl')
  if (!dish) throw new Error('dish catalog is empty')
  return dish
}

/**
 * Fullness added when a feeding action reaches `guestsHit` hungry guests.
 * Dessert service also sets down a warm drink, so that action adds both.
 */
export function feedPowerForSkill(skillId: SkillId, guestsHit: number): number {
  if (guestsHit <= 0) return 0
  const base = dishForSkill(skillId).feedPower
  const drink = skillId === 'civility' ? (dishById('drink')?.feedPower ?? 0) : 0
  return (base + drink) * guestsHit
}

export function servedDishLabel(skillId: SkillId, lang: string): string {
  const dish = dishForSkill(skillId)
  const drink = skillId === 'civility' ? dishById('drink') : undefined
  const main = `${dish.emoji} ${dishLabel(dish, lang)}`
  if (!drink) return main
  return `${main} + ${drink.emoji} ${dishLabel(drink, lang)}`
}

export function resolveCommercialOutcome(input: {
  fedPoints: number
  feedTarget: number
  elapsedSec: number
  roundLimitSec: number
  hp: number
}): CommercialOutcome {
  if (input.fedPoints >= input.feedTarget) return 'win'
  if (input.hp <= 0 || input.elapsedSec >= input.roundLimitSec) return 'lose'
  return 'playing'
}

/** End-card title. Win, or a full meter, is 满分厨师 / Full-Marks Chef. */
export function commercialTitle(
  fed: number,
  target: number,
  outcome: CommercialOutcome,
  lang: string,
): string {
  const zh = lang === 'zh'
  if (outcome === 'win' || fed >= target) return zh ? '满分厨师' : 'Full-Marks Chef'
  if (target > 0 && fed >= Math.ceil(target * 0.5)) return zh ? '桌长' : 'Table Host'
  return zh ? '热心饭搭子' : 'Table Buddy'
}
