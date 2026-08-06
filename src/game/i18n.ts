export type Lang = 'zh' | 'en' | 'nl'

const LANG_STORAGE_KEY = 'civicman.lang'

function detectInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY)
    if (stored === 'zh' || stored === 'en' || stored === 'nl') return stored
  } catch {
    // localStorage unavailable (private mode, SSR, etc.)
  }
  const browser = typeof navigator !== 'undefined' ? navigator.language : ''
  const lower = (browser ?? '').toLowerCase()
  if (lower.startsWith('zh')) return 'zh'
  if (lower.startsWith('nl')) return 'nl'
  return 'en'
}

let currentLang: Lang = detectInitialLang()

export function setLang(lang: Lang): void {
  currentLang = lang
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    // ignore write failures (private mode, quota, etc.)
  }
}

export function getLang(): Lang {
  return currentLang
}

const DICT: Record<Lang, Record<string, string>> = {
  zh: {
    // === Shout lines (TTS) ===
    shoutLine: '都他妈把嘴闭上！',
    slapShoutLine: '操你妈',
    tapeShoutLine: '给老子闭嘴！',
    gagShoutLine: '吃屎吧你！',
    poopShoutLine: '请您吃顿好的 哈哈！',
    civilityShoutLine: '素质，注意你丫的素质！',

    // === Skill display names ===
    skill_slap: '抽脸',
    skill_tape: '胶条',
    skill_megaphone: '吼',
    skill_gag: '塞嘴',
    skill_poop: '泼屎',
    skill_civility: '素质',

    // === Skill unlock labels ===
    unlock_default: '初始',
    unlock_lv5: '5级解锁',
    unlock_lv10: '10级解锁',

    // === Skill descriptions ===
    slap_pro: '手拍玩具抽脸，冷却最短，救急首选',
    slap_con: '沉默极短，治标不治本',
    slap_perks: '2级起回血2 · 6级回血4',
    tape_pro: '伸手贴嘴，封得久，性价比体面',
    tape_con: '要贴脸，慢半拍就白贴',
    tape_perks: '3级起降噪 · 7级降噪增强',
    megaphone_pro: '怒喝一声，范围静音',
    megaphone_con: '以毒攻毒，文明蒙羞',
    megaphone_perks: '4级起回血2 · 8级回血4',
    gag_pro: '智能寻址最远嘴巴。入口柔，胰腺瘘',
    gag_con: '冷却漫长，莫当普通拍子用',
    gag_perks: '9级起 Boss双倍伤害 · 普通双倍封印',
    poop_pro: '眼界之内，自由飞翔',
    poop_con: '谁也别吃了',
    poop_perks: '「请您吃顿好的 哈哈！」',
    civility_pro: '搋子盖脸，十分炫酷',
    civility_con: '虽然保险，不能回血',
    civility_perks: '「素质，注意你丫的素质！」',

    // === Pro/Con prefixes ===
    pro_prefix: '优：',
    con_prefix: '劣：',

    // === Briefing UI ===
    briefing_h1: '你是行侠仗义的文明侠',
    briefing_donation: '☕ 赞助作者',
    briefing_lede: '吧唧嘴亵渎了公共秩序，是对人类的终极犯罪。你将在食堂维护正义，用无情铁手让每个人吃饭闭嘴！',
    briefing_tools: '执法工具（请务必读完再丢人）',
    briefing_nausea: '降低恶心音效（吧唧更闷、更礼貌）',
    briefing_go: '出警 · 开始制裁',
    briefing_foot: 'WASD 移动 · 空格跳跃跨人 · 拖拽转镜 · Tab 换目标 · 噪音越大掉血越狠',

    // === HUD ===
    hud_hp: 'HP',
    hud_noise: '噪音',
    hud_selfNoise: '自噪音',
    hud_pauseTitle: '暂停 (Esc)',
    hud_nauseaShort: '降恶心音',
    hud_hint: 'WASD · 拖拽转镜 · Tab 换目标 · 1拍 2胶条 3吼 4塞嘴',
    hud_survived: '存活',
    hud_deathTitle: '吧唧致死',
    hud_deathRestart: '文明侠亦有殉职之日。按 R 再出警',
    hud_restart: '重开',

    // === Toast ===
    toast_cooldown: '技能冷却中',
    toast_tooFar: '再靠近一点！',
    toast_noTarget: '没有目标',
    toast_fail: '无法使用',
    toast_levelUp_prefix: '升级！',

    // === Space events ===
    spaceEvent_A1: '扩建：新包间',
    spaceEvent_A2: '扩建：走廊与房间',
    spaceEvent_A3: '扩建：宴会厅',
    spaceEvent_A4: '扩建：楼上小包间',
    spaceEvent_C1: '改造：大厅扩张',
    spaceEvent_C2: '改造：大厅收缩',
    spaceEvent_C3: '改造：立柱障碍',
    spaceEvent_C4: '改造：阁楼平台',
    spaceEvent_C5: '改造：微调整',

    // === Donation modal ===
    donation_title: '☕ 吧唧钱包',
    donation_p1: '本作在人类学意义上，冒犯了许多人。',
    donation_p2: '如果您感到被冒犯，先向您下跪磕头，并诚恳请求您吃饭闭嘴',
    donation_p3: '愿意支持作者，表示您愿意庄严承诺：咀嚼时把嘴闭上，并献出一点小小爱心支持作者在北京买房的宏图萎夜。',
    donation_afdian: '爱发电（微信/支付宝）',
    donation_kofi: 'Ko-fi（PayPal / 信用卡）',
    donation_close: '关闭',

    // === Guide tips ===
    guide_1: '靠近绕桌觅食的吧唧者——文明需要距离。',
    guide_2: '按 1：挥手拍玩具抽脸。短促有效。',
    guide_3: '2 贴胶条 · 3 怒吼「闭嘴」· 4 塞嘴大招。',

    // === Prop toast ===
    prop_heal: '回血 +',
    prop_silence_prefix: '全场静音 ',
    prop_silence_suffix: 's',

    // === Titles ===
    title_0: '轻度洁癖',
    title_30: '包间保安',
    title_90: '咀嚼克星',
    title_180: '食堂死神',

    // === NPC labels ===
    npc_sealedTape: '已封',
    npc_sealedGag: '塞住',
    npc_silenced: '安静',
    npc_walking: '觅食',
    npc_chaser: '追杀',
    npc_smacking: '吧唧',

    // === Scene 3D text ===
    silenceChar: '静',
    wall_calm: '静',
    wall_endure: '忍',
    wall_silence: '食不言',
    couplet_right: '天道酬勤',
    couplet_left: '地道的您',

    // === Touch controls ===
    touch_jump: '跳',
    touch_switch: '换',

    // === App ===
    rotateOverlay: '请旋转手机横屏游玩',

    // === Donation label (config) ===
    donation_label: '支持开发者',
  },

  en: {
    // === Shout lines (TTS) ===
    shoutLine: "Shut the phooken' mouths!",
    slapShoutLine: 'Phook you!',
    tapeShoutLine: 'Weeeeave yer leeeeeeeeeeeeps',
    gagShoutLine: 'Eat this sheeeiiiit',
    poopShoutLine: 'Have fun, boy!',
    civilityShoutLine: 'May byageee be with you',

    // === Skill display names ===
    skill_slap: 'Slap Face',
    skill_tape: 'Taping',
    skill_megaphone: 'Shout',
    skill_gag: 'Mouth Dildoing',
    skill_poop: 'PoopWave',
    skill_civility: 'Civility',

    // === Skill unlock labels ===
    unlock_default: 'Default',
    unlock_lv5: 'Lv 5 Unlock',
    unlock_lv10: 'Lv10 Unlock',

    // === Skill descriptions ===
    slap_pro: 'Solve the problem immediately',
    slap_con: 'Too instant',
    slap_perks: 'Lv2 recover 2 HP · LV 6 recover 4 HP',
    tape_pro: 'Long mouth-taping, decent price-performance ratio',
    tape_con: 'Get closed or get slowed',
    tape_perks: 'Lv3 · Lv7 De-Noise',
    megaphone_pro: 'Mute the surroundings using human voice',
    megaphone_con: 'Violating silence by thyself',
    megaphone_perks: 'Lv4 recover 2 HP · LV 8 recover 4 HP',
    gag_pro: 'Lockdown the farthest mouth with AI-Empowered Dildo',
    gag_con: 'Year long CD. Do no use it as normal slap',
    gag_perks: 'Lv9 Boss damage doubled',
    poop_pro: 'Wave wherever your dream can reach',
    poop_con: 'Everything would turn uneatable - but does it matter?',
    poop_perks: 'Have fun!',
    civility_pro: 'Cover everyone\'s face with the ultimate literacy. Extremely cool and gentle',
    civility_con: 'Although it secures your environment, it - just like health insurance, doesn\'t cure',
    civility_perks: 'Be cool, man!',

    // === Pro/Con prefixes ===
    pro_prefix: 'Pro: ',
    con_prefix: 'Con: ',

    // === Briefing UI ===
    briefing_h1: 'You are the justest CivicMan',
    briefing_donation: '☕ Sponsor the Phookn Author',
    briefing_lede: 'Byagee Mouth greatly supplements cultural diversity and is the ultimate crime to humanity. You are going to shut everyone\'s lips while they are chewing and maintain the ultimate justice!',
    briefing_tools: 'Toolsets - Please act with no shame after reading',
    briefing_nausea: 'Wearing headset so you don\'t hear Byagee',
    briefing_go: 'Yo yo yo!',
    briefing_foot: 'WASD movement · Space for Jump · Drag with left-click change camera · Tab for Aiming · The noisier, the more destructive this dining hall is',

    // === HUD ===
    hud_hp: 'HP',
    hud_noise: 'Noise',
    hud_selfNoise: 'SelfNoise',
    hud_pauseTitle: 'Pause (Esc)',
    hud_nauseaShort: 'Less Nausea',
    hud_hint: 'WASD · Drag · Tab to Aim  · 1 Slap · 2 Tape · 3 Shout · 4 Dildo',
    hud_survived: 'Survived',
    hud_deathTitle: 'Byagee to Die',
    hud_deathRestart: 'Civilization can fail. Press R to reincarnate.',
    hud_restart: 'Reincarnate',

    // === Toast ===
    toast_cooldown: 'Warming up is Cooling down',
    toast_tooFar: 'Get Phooken Closer ya!',
    toast_noTarget: 'Target lost',
    toast_fail: 'Unavailable',
    toast_levelUp_prefix: 'Level-UP!',

    // === Space events ===
    spaceEvent_A1: 'Expansion: new side room',
    spaceEvent_A2: 'Expansion: corridor & room',
    spaceEvent_A3: 'Expansion: banquet hall',
    spaceEvent_A4: 'Expansion: upstairs nook',
    spaceEvent_C1: 'Morph: hall expanded',
    spaceEvent_C2: 'Morph: hall shrunk',
    spaceEvent_C3: 'Morph: pillar obstacles',
    spaceEvent_C4: 'Morph: loft platform',
    spaceEvent_C5: 'Morph: minor tweak',

    // === Donation modal ===
    donation_title: '☕ Byagee My Wallet',
    donation_p1: 'This work violated some cultural convention in the broadest anthropological sense',
    donation_p2: 'If you feel violated, please you shut your mouth during chewing and accept my insignificant apology',
    donation_p3: 'If you\'d like to spare a penny, you are seriously swearing to whoever or whatever you believe that you\'d like to shut the lips during chewing and support the author\'s Mission Impussyble of buying a house.',
    donation_afdian: 'Afdian Support (WeChat/Alipay)',
    donation_kofi: 'Ko-fi (PayPal / Credit Card)',
    donation_close: 'Shut the F....',

    // === Guide tips ===
    guide_1: 'Approach the Byageee Mouth-ers circling the tables — civility needs distance.',
    guide_2: 'Press 1: Slap toy to the face. Quick and effective.',
    guide_3: '2 Tape · 3 Shout «Shut up» · 4 Mouth Dildoing ultimate.',

    // === Prop toast ===
    prop_heal: 'HP +',
    prop_silence_prefix: 'Global Muting ',
    prop_silence_suffix: 's and the First Amendment is Crucially violated!',

    // === Titles ===
    title_0: 'Tiny Minded',
    title_30: 'Table Warrior',
    title_90: 'Byagee Hunter',
    title_180: 'Death of Chewing',

    // === NPC labels ===
    npc_sealedTape: 'Sealed',
    npc_sealedGag: 'Gagged',
    npc_silenced: 'Quiet',
    npc_walking: 'Hungry',
    npc_chaser: 'Chasing',
    npc_smacking: 'Byagee',

    // === Scene 3D text ===
    silenceChar: 'Shhhhhh',
    wall_calm: 'Shhh',
    wall_endure: 'Bear It',
    wall_silence: 'No Smack',
    couplet_right: 'Chew Quiet',
    couplet_left: 'Or Else',

    // === Touch controls ===
    touch_jump: 'Jump',
    touch_switch: 'Switch',

    // === App ===
    rotateOverlay: 'Please rotate yer phone',

    // === Donation label (config) ===
    donation_label: 'Sponsor the Phookn Author',
  },

  nl: {
    // === Shout lines (TTS uses EN voice — text only) ===
    shoutLine: 'Hou je fucking bekken dicht!',
    slapShoutLine: 'Flikker op!',
    tapeShoutLine: 'Sluuuuuit je muuuuuuul',
    gagShoutLine: 'Eet dit stront',
    poopShoutLine: 'Eet smakelijk, jongen!',
    civilityShoutLine: 'Moge byageee met je zijn',

    // === Skill display names ===
    skill_slap: 'Klap',
    skill_tape: 'Plakband',
    skill_megaphone: 'Schreeuw',
    skill_gag: 'Mondprop',
    skill_poop: 'Strontgolf',
    skill_civility: 'Beschaafd',

    // === Skill unlock labels ===
    unlock_default: 'Standaard',
    unlock_lv5: 'Lv 5 Ontgrendel',
    unlock_lv10: 'Lv10 Ontgrendel',

    // === Skill descriptions ===
    slap_pro: 'Los het probleem direct op',
    slap_con: 'Te kort',
    slap_perks: 'Lv2 herstel 2 HP · Lv6 herstel 4 HP',
    tape_pro: 'Lange mond-plakband, goede prijs-prestatie',
    tape_con: 'Dichtbij komen of vertraagd worden',
    tape_perks: 'Lv3 · Lv7 Geluidsdemping',
    megaphone_pro: 'Demp de omgeving met menselijke stem',
    megaphone_con: 'Zelf de stilte schenden',
    megaphone_perks: 'Lv4 herstel 2 HP · Lv8 herstel 4 HP',
    gag_pro: 'Vergrendel de verste mond met AI-Aangedreven Dildo',
    gag_con: 'Jaar lange CD. Gebruik niet als normale klap',
    gag_perks: 'Lv9 Boss schade verdubbeld',
    poop_pro: 'Gooi waar je droom reikt',
    poop_con: 'Alles wordt oneetbaar - maar maakt dat uit?',
    poop_perks: 'Veel plezier!',
    civility_pro: "Bedek ieders gezicht met de ultieme beschaving. Extreem cool en zacht",
    civility_con: "Hoewel het je omgeving veilig stelt, geneest het niet - net als zorgverzekering",
    civility_perks: 'Blijf cool, man!',

    // === Pro/Con prefixes ===
    pro_prefix: 'Voor: ',
    con_prefix: 'Tegen: ',

    // === Briefing UI ===
    briefing_h1: 'Jij bent de rechtvaardigste CivicMan',
    briefing_donation: '☕ Steun de Phookn Auteur',
    briefing_lede: 'Byageee Mouth schendt de culturele diversiteit en is de ultieme misdaad tegen de mensheid. Je gaat ieders lippen sluiten terwijl ze kauwen en de ultieme rechtvaardigheid handhaven!',
    briefing_tools: 'Gereedschap - Schaam je niet na het lezen',
    briefing_nausea: 'Koptelefoon zodat je Byageee niet hoort',
    briefing_go: 'Yo yo yo!',
    briefing_foot: 'WASD bewegen · Spatie voor Sprong · Sleep voor camera · Tab voor Richting · Hoe luider, hoe destructiever deze eetzaal is',

    // === HUD ===
    hud_hp: 'HP',
    hud_noise: 'Geluid',
    hud_selfNoise: 'EigenGeluid',
    hud_pauseTitle: 'Pauze (Esc)',
    hud_nauseaShort: 'Minder Misselijk',
    hud_hint: 'WASD · Sleep · Tab voor Richting · 1 Klap · 2 Plak · 3 Schreeuw · 4 Dildo',
    hud_survived: 'Overleefd',
    hud_deathTitle: 'Byagee Dood',
    hud_deathRestart: 'Beschaving kan falen. Druk R om te reïncarneren.',
    hud_restart: 'Reïncarneer',

    // === Toast ===
    toast_cooldown: 'Opwarmen is Afkoelen',
    toast_tooFar: 'Kom fucking dichterbij!',
    toast_noTarget: 'Doel verloren',
    toast_fail: 'Niet beschikbaar',
    toast_levelUp_prefix: 'Level-UP!',

    // === Space events ===
    spaceEvent_A1: 'Uitbreiding: nieuwe zijkamer',
    spaceEvent_A2: 'Uitbreiding: gang & kamer',
    spaceEvent_A3: 'Uitbreiding: banketzaal',
    spaceEvent_A4: 'Uitbreiding: bovenverdieping',
    spaceEvent_C1: 'Aanpassing: zaal vergroot',
    spaceEvent_C2: 'Aanpassing: zaal verkleind',
    spaceEvent_C3: 'Aanpassing: pilaar obstakels',
    spaceEvent_C4: 'Aanpassing: platform',
    spaceEvent_C5: 'Aanpassing: kleine wijziging',

    // === Donation modal ===
    donation_title: '☕ Byagee Mijn Portemonnee',
    donation_p1: 'Dit werk schond een culturele conventie in de breedste antropologische zin',
    donation_p2: 'Als je je geschonden voelt, sluit je mond tijdens het kauwen en accepteer mijn onbeduidende excuses',
    donation_p3: 'Als je een cent wilt missen, zweer je plechtig dat je je lippen sluit tijdens het kauwen en de auteur steunt in zijn Onmogelijke Missie om een huis te kopen.',
    donation_afdian: 'Afdian Steun (WeChat/Alipay)',
    donation_kofi: 'Ko-fi (PayPal / Creditcard)',
    donation_close: 'Sluit de F...',

    // === Guide tips ===
    guide_1: 'Nader de Byageee Mouth-ers die om de tafels cirkelen — beschaving heeft afstand nodig.',
    guide_2: 'Druk 1: Klap speelgoed in het gezicht. Snel en effectief.',
    guide_3: '2 Plak · 3 Schreeuw «Bek dicht» · 4 Mondprop ultieme.',

    // === Prop toast ===
    prop_heal: 'HP +',
    prop_silence_prefix: 'Globaal Dempen ',
    prop_silence_suffix: 's en de Eerste Amendement is Kritisch geschonden!',

    // === Titles ===
    title_0: 'Kleinzerig',
    title_30: 'Tafel Krijger',
    title_90: 'Byagee Jager',
    title_180: 'Dood van Kauwen',

    // === NPC labels ===
    npc_sealedTape: 'Verzegeld',
    npc_sealedGag: 'Gepropt',
    npc_silenced: 'Stil',
    npc_walking: 'Hongerig',
    npc_chaser: 'Achtervolging',
    npc_smacking: 'Byagee',

    // === Scene 3D text ===
    silenceChar: 'Sjjjjj',
    wall_calm: 'Sjh',
    wall_endure: 'Volhard',
    wall_silence: 'Geen Smak',
    couplet_right: 'Kauw Stil',
    couplet_left: 'Of Anders',

    // === Touch controls ===
    touch_jump: 'Sprong',
    touch_switch: 'Wissel',

    // === App ===
    rotateOverlay: 'Draai je telefoon',

    // === Donation label (config) ===
    donation_label: 'Steun de Phookn Auteur',
  },
}

export function t(key: string): string {
  return DICT[currentLang]?.[key] ?? DICT.zh[key] ?? key
}
