export type Lang = 'zh' | 'en'

let currentLang: Lang = 'zh'

export function setLang(lang: Lang): void {
  currentLang = lang
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
}

export function t(key: string): string {
  return DICT[currentLang]?.[key] ?? DICT.zh[key] ?? key
}
