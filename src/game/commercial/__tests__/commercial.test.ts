import { describe, expect, it, afterEach, vi } from 'vitest'
import { DISHES, SKILL_DISH, dishById } from '../dishes'
import { commercialCopyKeys, commercialString } from '../copy'
import {
  applyCommercialQuery,
  DEFAULT_BUSINESS_EMAIL,
  getResolvedSkin,
  parseCommercialQuery,
  resetCommercialRuntime,
  setCommercialEnabled,
} from '../runtime'
import {
  commercialTitle,
  dishForSkill,
  feedPowerForSkill,
  resolveCommercialOutcome,
} from '../session'
import { setLang, t } from '../../i18n'
import { submitLead } from '../lead'
import { useGameStore } from '../../store'

const BANNED = /byagee|phook|dildo|poopwave|shit|fuck|吧唧|塞嘴|泼屎|闭嘴|制裁|他妈|吃屎|抽脸|恶心/i

afterEach(() => {
  resetCommercialRuntime()
  setLang('zh')
})

describe('dish catalog', () => {
  it('ships at least 8 dishes with unique ids and positive feed power', () => {
    expect(DISHES.length).toBeGreaterThanOrEqual(8)
    const ids = DISHES.map((dish) => dish.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const dish of DISHES) {
      expect(dish.name.zh.length).toBeGreaterThan(0)
      expect(dish.name.en.length).toBeGreaterThan(0)
      expect(dish.feedPower).toBeGreaterThan(0)
      expect(dish.color.startsWith('#')).toBe(true)
    }
  })

  it('maps every feeding action onto a catalog dish', () => {
    for (const id of Object.values(SKILL_DISH)) {
      expect(dishById(id)).toBeTruthy()
    }
    expect(feedPowerForSkill('slap', 2)).toBe(2)
    expect(feedPowerForSkill('slap', 0)).toBe(0)
    expect(feedPowerForSkill('megaphone', 3)).toBe(3)
    const dessert = dishById('dessert')!.feedPower
    const drink = dishById('drink')!.feedPower
    expect(feedPowerForSkill('civility', 1)).toBe(dessert + drink)
  })

  it('lets a query param highlight a brand dish on the signature serve', () => {
    applyCommercialQuery(parseCommercialQuery('?dish=brand-special'))
    expect(dishForSkill('gag').id).toBe('brand-special')
    expect(dishForSkill('slap').id).toBe('rice-bowl')
    applyCommercialQuery(parseCommercialQuery('?dish=not-a-dish'))
    expect(dishForSkill('gag').id).toBe('noodle')
  })
})

describe('commercial copy', () => {
  it('covers the same keys in English and stays brand-safe', () => {
    for (const key of commercialCopyKeys()) {
      const zh = commercialString('zh', key)
      const en = commercialString('en', key)
      expect(zh, key).toBeTruthy()
      expect(en, key).toBeTruthy()
      expect(zh).not.toMatch(BANNED)
      expect(en).not.toMatch(BANNED)
    }
  })

  it('overlays skill names only while the dining skin is on', () => {
    setLang('zh')
    setCommercialEnabled(false)
    expect(t('skill_slap')).toBe('抽脸')
    setCommercialEnabled(true)
    expect(t('skill_slap')).toBe('勺喂')
    expect(t('skill_gag')).toBe('招牌')
    expect(t('slapShoutLine')).toBe('来，先吃一口')
    setLang('en')
    expect(t('skill_poop')).toBe('Salad')
    expect(t('briefing_go')).toBe('Start service')
  })
})

describe('commercial round', () => {
  it('names the table by how full the guests got', () => {
    expect(commercialTitle(0, 8, 'lose', 'zh')).toBe('热心饭搭子')
    expect(commercialTitle(4, 8, 'lose', 'zh')).toBe('桌长')
    expect(commercialTitle(3, 8, 'win', 'en')).toBe('Full-Marks Chef')
    expect(commercialTitle(8, 8, 'playing', 'en')).toBe('Full-Marks Chef')
  })

  it('wins on a full meter and loses when time or energy runs out', () => {
    expect(resolveCommercialOutcome({
      fedPoints: 8, feedTarget: 8, elapsedSec: 10, roundLimitSec: 40, hp: 50,
    })).toBe('win')
    expect(resolveCommercialOutcome({
      fedPoints: 3, feedTarget: 8, elapsedSec: 40, roundLimitSec: 40, hp: 50,
    })).toBe('lose')
    expect(resolveCommercialOutcome({
      fedPoints: 3, feedTarget: 8, elapsedSec: 10, roundLimitSec: 40, hp: 0,
    })).toBe('lose')
    expect(resolveCommercialOutcome({
      fedPoints: 3, feedTarget: 8, elapsedSec: 10, roundLimitSec: 40, hp: 20,
    })).toBe('playing')
  })

  it('adds fullness when a serve reaches a hungry guest', () => {
    setCommercialEnabled(true)
    applyCommercialQuery(parseCommercialQuery('?seconds=60&goal=8'))
    useGameStore.getState().beginMission(5_000)
    const npc = useGameStore.getState().npcs[0]
    expect(npc).toBeTruthy()
    useGameStore.setState({
      npcs: useGameStore.getState().npcs.map((n) =>
        n.id === npc.id
          ? { ...n, status: 'smacking' as const, position: [0.4, 0, 2.2] }
          : n,
      ),
      playerPos: [0, 0, 2.4],
      targetId: npc.id,
    })
    useGameStore.getState().useSkill('slap', 6_000)
    useGameStore.getState().tick(0.05, 6_500)
    expect(useGameStore.getState().fedPoints).toBe(1)
    expect(useGameStore.getState().commercialOutcome).toBe('playing')
  })

  it('ends the live round when service time runs out', () => {
    setCommercialEnabled(true)
    applyCommercialQuery(parseCommercialQuery('?seconds=40&goal=8'))
    useGameStore.getState().beginMission(1_000)
    useGameStore.getState().tick(0.05, 1_000 + 41_000)
    const state = useGameStore.getState()
    expect(state.commercialOutcome).toBe('lose')
    expect(state.alive).toBe(false)
    expect(state.fedPoints).toBe(0)
  })

  it('reads skin, color, and goal from the query string', () => {
    const query = parseCommercialQuery(
      '?skin=popup&color=1A73E8&logoText=Acme&title=Acme%20Table&goal=6&seconds=30&webhook=https%3A%2F%2Fexample.com%2Flead',
    )
    expect(query.skin).toBe('popup')
    expect(query.color).toBe('#1a73e8')
    expect(query.goal).toBe(6)
    expect(query.seconds).toBe(30)
    applyCommercialQuery(query)
    const skin = getResolvedSkin()
    expect(skin.id).toBe('popup')
    expect(skin.primary).toBe('#1a73e8')
    expect(skin.logoText).toBe('Acme')
    expect(skin.titleOverride).toBe('Acme Table')
    expect(skin.feedTarget).toBe(6)
    expect(skin.roundLimitSec).toBe(30)
    expect(skin.webhookUrl).toBe('https://example.com/lead')
    expect(skin.mailto).toBe(DEFAULT_BUSINESS_EMAIL)
    expect(skin.tablecloth).toBe('#f4fbf7')
  })

  it('keeps the business inbox unless ?mailto= overrides it', async () => {
    applyCommercialQuery(parseCommercialQuery('?skin=popup'))
    expect(getResolvedSkin().mailto).toBe('llzlty1@pawpawmaster.com')
    const opened: string[] = []
    vi.stubGlobal('window', {
      location: {
        set href(value: string) {
          opened.push(value)
        },
        get href() {
          return opened.at(-1) ?? ''
        },
      },
    })
    const result = await submitLead({
      name: '测试',
      contact: 'guest@example.com',
      privacy: true,
      skinId: 'popup',
      title: '品牌快闪餐桌',
      lang: 'zh',
      fedPoints: 0,
      feedTarget: 8,
      outcome: 'inquiry',
      page: 'http://localhost/',
      createdAt: '2026-11-02T00:00:00.000Z',
    })
    expect(result.via).toBe('mailto')
    expect(opened[0]).toContain('mailto:llzlty1@pawpawmaster.com')
    vi.unstubAllGlobals()

    applyCommercialQuery(parseCommercialQuery('?mailto=hello@brand.com'))
    expect(getResolvedSkin().mailto).toBe('hello@brand.com')
    expect(commercialString('zh', 'lead_business')).toBe('商务联系')
    expect(commercialString('en', 'lead_business')).toBe('Business contact')
  })
})
