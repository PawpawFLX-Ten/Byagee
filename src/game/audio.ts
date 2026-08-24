import type { SkillId } from './types'
import { distance3 } from './threat'
import { CONFIG } from './config'
import { t, getLang } from './i18n'

/** Procedural SFX — no external audio assets. */

/**
 * Reverb send for the player's current room: small rooms are punchier,
 * big halls stay dry. Pure — unit-tested.
 */
export function reverbAmountForArea(area: number): number {
  const wet =
    CONFIG.audio.reverbWetMax -
    Math.max(0, area - CONFIG.audio.reverbAreaAtMax) * CONFIG.audio.reverbSlope
  return Math.min(CONFIG.audio.reverbWetMax, Math.max(CONFIG.audio.reverbMin, wet))
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
let chewBus: GainNode | null = null
let reverbGain: GainNode | null = null
let chewNodes: Map<
  string,
  {
    gain: GainNode
    filter: BiquadFilterNode
    stop: () => void
  }
> = new Map()
let threatGain: GainNode | null = null
let threatOsc: OscillatorNode | null = null
let unlocked = false
let ttsWarmedUp = false
let reduceNausea = false

// User volume factors (1 = the designed mix). SFX rides the master gain,
// voice scales each TTS utterance. Persisted per browser.
const VOL_SFX_KEY = 'civicman.vol.sfx'
const VOL_VOICE_KEY = 'civicman.vol.voice'
const SFX_BASE = 0.35

function loadVolumeFactor(key: string): number {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return 1
    const v = Number(raw)
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1
  } catch {
    return 1
  }
}

let sfxFactor = loadVolumeFactor(VOL_SFX_KEY)
let voiceFactor = loadVolumeFactor(VOL_VOICE_KEY)

export function setSfxVolume(factor: number) {
  sfxFactor = Math.min(1, Math.max(0, factor))
  if (ctx && master) master.gain.value = SFX_BASE * sfxFactor
  try { localStorage.setItem(VOL_SFX_KEY, String(sfxFactor)) } catch { /* ignore */ }
}

export function setVoiceVolume(factor: number) {
  voiceFactor = Math.min(1, Math.max(0, factor))
  try { localStorage.setItem(VOL_VOICE_KEY, String(voiceFactor)) } catch { /* ignore */ }
}

export function getSfxVolume() {
  return sfxFactor
}

export function getVoiceVolume() {
  return voiceFactor
}

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    ctx = new Ctx()
    master = ctx.createGain()
    master.gain.value = SFX_BASE * sfxFactor
    master.connect(ctx.destination)
    chewBus = ctx.createGain()
    chewBus.gain.value = 1
    chewBus.connect(master)
    // Procedural reverb: decaying-noise impulse → convolution → wet send.
    const convolver = ctx.createConvolver()
    convolver.buffer = buildImpulse(ctx, 1.2, 2.6)
    reverbGain = ctx.createGain()
    reverbGain.gain.value = 0
    chewBus.connect(convolver)
    convolver.connect(reverbGain)
    reverbGain.connect(master)
  }
  return ctx
}

/** Stereo impulse of exponentially decaying noise — one-shot reverb tail. */
function buildImpulse(c: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = c.sampleRate
  const len = Math.floor(rate * seconds)
  const buf = c.createBuffer(2, len, rate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
  }
  return buf
}

/** Ramp the wet reverb send; 0 kills the tail entirely. */
function setChewReverb(amount: number): void {
  if (!reverbGain || !ctx) return
  reverbGain.gain.linearRampToValueAtTime(
    Math.max(0, Math.min(1, amount)),
    ctx.currentTime + 0.12,
  )
}

export async function unlockAudio(): Promise<void> {
  const c = ac()
  if (!c) return
  if (c.state === 'suspended') await c.resume()
  if (!unlocked) {
    unlocked = true
    if (!ttsWarmedUp && typeof window !== 'undefined' && window.speechSynthesis) {
      ttsWarmedUp = true
      try {
        const warmup = new SpeechSynthesisUtterance('')
        warmup.volume = 0
        warmup.rate = 1
        window.speechSynthesis.speak(warmup)
      } catch {
        /* ignore missing TTS */
      }
    }
  }
}

function ensureUnlocked(): AudioContext | null {
  const c = ac()
  if (!c || !master || !unlocked) return null
  if (c.state === 'suspended') void c.resume()
  return c
}

export function setReduceNausea(on: boolean) {
  reduceNausea = on
  if (chewBus && ctx) {
    // Soften overall wet bus when nausea reduction is on
    chewBus.gain.linearRampToValueAtTime(
      on ? 0.35 : 1,
      ctx.currentTime + 0.08,
    )
  }
}

export function getReduceNausea() {
  return reduceNausea
}

// Reusable per-length noise buffers — AudioBuffer is context-bound but
// safe to share across one-shot sources; recreating the Float32Array for
// every click was a steady GC churn source.
const noiseCache = new Map<number, AudioBuffer>()

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(c.sampleRate * Math.max(seconds, 0.05))
  let buf = noiseCache.get(len)
  if (!buf) {
    buf = c.createBuffer(1, len, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    noiseCache.set(len, buf)
  }
  return buf
}

function beep(
  freq: number,
  dur: number,
  type: OscillatorType = 'square',
  gain = 0.2,
  slideTo?: number,
  delayMs = 0,
) {
  const c = ensureUnlocked()
  if (!c || !master) return
  const t0 = c.currentTime + delayMs / 1000
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur)
  }
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  osc.connect(g)
  g.connect(master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

function burstNoise(dur: number, gain = 0.15, filterFreq = 1200) {
  const c = ensureUnlocked()
  if (!c || !master) return
  const t0 = c.currentTime
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, Math.max(dur, 0.05))
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = filterFreq
  filter.Q.value = 0.8
  const g = c.createGain()
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  src.connect(filter)
  filter.connect(g)
  g.connect(master)
  src.start(t0)
  src.stop(t0 + dur + 0.02)
}

/** Wet chewing click loop for one NPC. */
export function startChew(npcId: string) {
  if (chewNodes.has(npcId)) return
  const c = ensureUnlocked()
  if (!c || !master || !chewBus) return

  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 1400
  filter.Q.value = 0.7

  const gain = c.createGain()
  gain.gain.value = 0.01
  filter.connect(gain)
  gain.connect(chewBus)

  let alive = true
  let timer = 0

  const tick = () => {
    if (!alive || !ctx) return
    const t0 = ctx.currentTime
    const wet = reduceNausea ? 0.25 : 0.55
    const tone = reduceNausea ? 0.08 : 0.28

    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx, 0.08)
    const g = ctx.createGain()
    g.gain.setValueAtTime(wet, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07)
    src.connect(g)
    g.connect(filter)

    const osc = ctx.createOscillator()
    const og = ctx.createGain()
    osc.type = reduceNausea ? 'sine' : 'triangle'
    osc.frequency.setValueAtTime(90 + Math.random() * 40, t0)
    og.gain.setValueAtTime(tone, t0)
    og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06)
    osc.connect(og)
    og.connect(filter)
    osc.start(t0)
    osc.stop(t0 + 0.07)
    src.start(t0)
    src.stop(t0 + 0.08)

    const gap = reduceNausea
      ? 180 + Math.random() * 120
      : 110 + Math.random() * 80
    timer = window.setTimeout(tick, gap)
  }

  tick()
  chewNodes.set(npcId, {
    gain,
    filter,
    stop: () => {
      alive = false
      window.clearTimeout(timer)
      try {
        gain.disconnect()
        filter.disconnect()
      } catch {
        /* ignore */
      }
    },
  })
}

export function stopChew(npcId: string) {
  const node = chewNodes.get(npcId)
  if (!node) return
  node.stop()
  chewNodes.delete(npcId)
}

export function stopAllChews() {
  for (const id of [...chewNodes.keys()]) stopChew(id)
}

export type ChewSource = {
  id: string
  position: [number, number, number]
}

export type ChewMixOptions = {
  /** Per-source room gate (1 = same room). Mirrors threat acoustics. */
  gateFor?: (id: string) => number
  /** Wet reverb send 0..1 for the player's room; 0 when no sources. */
  reverbAmount?: number
}

/**
 * Keep chew loops in sync and spatialize by distance + room acoustics.
 * Near = bright/wet; far = muffled; other rooms quieter and darker;
 * many sources = louder wall. Reverb wet tracks the room size.
 */
export function syncChews(
  sources: ChewSource[],
  playerPos: [number, number, number],
  opts: ChewMixOptions = {},
) {
  const ids = sources.map((s) => s.id)
  const set = new Set(ids)
  for (const id of [...chewNodes.keys()]) {
    if (!set.has(id)) stopChew(id)
  }
  for (const id of ids) startChew(id)

  const count = sources.length
  const wallBoost = 1 + Math.max(0, count - 1) * 0.22

  for (const src of sources) {
    const node = chewNodes.get(src.id)
    if (!node || !ctx) continue
    const dist = distance3(src.position, playerPos)
    // 0m → 1, ~6m → ~0.22
    const atten = 1 / (1 + dist * 0.45)
    const gate = Math.min(1, Math.max(0, opts.gateFor?.(src.id) ?? 1))
    // Room gate: same room full; distant rooms quieter and darker.
    const gateGain = 0.55 + 0.45 * gate
    const gateCutoff = 0.75 + 0.25 * gate
    const targetGain =
      Math.min(0.55, 0.1 + atten * 0.32) * wallBoost * gateGain
    const cutoff = (reduceNausea
      ? 400 + atten * 500
      : 500 + atten * 1600) * gateCutoff
    node.gain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 0.05)
    node.filter.frequency.linearRampToValueAtTime(
      cutoff,
      ctx.currentTime + 0.05,
    )
  }

  setChewReverb(count > 0 ? (opts.reverbAmount ?? 0) : 0)
}

export function playSkill(skillId: SkillId) {
  switch (skillId) {
    case 'slap':
      burstNoise(0.06, 0.35, 2200)
      beep(320, 0.06, 'square', 0.16)
      beep(180, 0.1, 'triangle', 0.1)
      playShoutVoice(t('slapShoutLine'), 2.6)
      break
    case 'tape':
      burstNoise(0.2, 0.22, 3200)
      beep(620, 0.14, 'sawtooth', 0.1, 140)
      beep(90, 0.08, 'sine', 0.12)
      playShoutVoice(t('tapeShoutLine'), 1.4)
      break
    case 'megaphone':
      beep(180, 0.12, 'sawtooth', 0.3)
      beep(120, 0.22, 'sawtooth', 0.26, 55)
      burstNoise(0.35, 0.28, 450)
      beep(90, 0.4, 'triangle', 0.12)
      playShoutVoice()
      break
    case 'gag':
      beep(100, 0.22, 'triangle', 0.22, 45)
      burstNoise(0.14, 0.2, 700)
      beep(60, 0.3, 'sine', 0.1)
      playShoutVoice(t('gagShoutLine'), 1.5)
      break
    case 'poop':
      burstNoise(0.15, 0.25, 800)
      beep(200, 0.1, 'sawtooth', 0.18, 80)
      beep(120, 0.15, 'triangle', 0.12)
      playShoutVoice(t('poopShoutLine'), 2.0)
      break
    case 'civility':
      beep(150, 0.2, 'sawtooth', 0.3)
      beep(100, 0.3, 'triangle', 0.2, 50)
      burstNoise(0.4, 0.25, 300)
      playShoutVoice(t('civilityShoutLine'), 1.5)
      break
  }
}

/** Browser TTS shout — prefer male zh voice, barked fast. */
export function playShoutVoice(line = t('shoutLine'), rate = 1.45) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return

  const speak = () => {
    try {
      window.speechSynthesis.cancel()
      const lang = getLang()
      // iOS Safari can swallow speak() if called synchronously after cancel().
      // Defer to next tick to break the race.
      window.setTimeout(() => {
        window.speechSynthesis.cancel()
        const u = new SpeechSynthesisUtterance(line)
        u.lang = lang === 'zh' ? 'zh-CN' : 'en-US'
        u.rate = rate
        u.pitch = 0.65
        u.volume = voiceFactor

        const voices = window.speechSynthesis.getVoices()
        const maleHint = lang === 'zh' ? /male|男|kangkang|yunyang|yunjian|yunxi|hanhan|xiaomu/i : /male|david|alex|daniel|fred/i
        const femaleHint = lang === 'zh'
          ? /female|女|xiaoyi|xiaoxiao|tingting|yaoyao|huihui/i
          : /female|tracy|jenny|zira/i

        const zhVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(lang === 'zh' ? 'zh' : 'en'))
        const male =
          zhVoices.find((v) => maleHint.test(v.name)) ??
          zhVoices.find((v) => !femaleHint.test(v.name)) ??
          zhVoices[0]

        // If no matching voice, leave u.voice unset — u.lang guides the engine to auto-pick.
        if (male) u.voice = male
        window.speechSynthesis.speak(u)
      }, 0)
    } catch {
      /* ignore missing TTS */
    }
  }

  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) {
    // iOS Safari: voiceschanged event is unreliable. Poll as fallback.
    let attempts = 0
    let done = false
    const trySpeak = () => {
      if (done) return
      const v = window.speechSynthesis.getVoices()
      if (v.length > 0 || attempts >= 6) {
        done = true
        speak()
      } else {
        attempts++
        window.setTimeout(trySpeak, 40)
      }
    }
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      if (!done) { done = true; speak() }
    }, { once: true })
    trySpeak()
  } else {
    speak()
  }
}

export function playFail() {
  beep(120, 0.08, 'square', 0.08)
}

/** Space event fires: low thud + a few carpenter knocks. */
export function playSpaceEvent() {
  beep(110, 0.28, 'square', 0.24, 45)
  beep(160, 0.07, 'square', 0.14, undefined, 120)
  beep(150, 0.07, 'square', 0.12, undefined, 260)
  burstNoise(0.18, 0.1, 500)
}

/** Door latch slams home: wooden clunk. */
export function playLatch() {
  beep(180, 0.06, 'square', 0.16, 90)
  burstNoise(0.12, 0.14, 700)
}

export function playDeath() {
  stopAllChews()
  setThreatLevel(0)
  beep(200, 0.4, 'sawtooth', 0.2, 40)
  burstNoise(0.35, 0.2, 400)
}

export function setThreatLevel(level: 0 | 1 | 2) {
  const c = ensureUnlocked()
  if (!c || !master) return

  if (level === 0) {
    if (threatOsc) {
      try {
        threatOsc.stop()
      } catch {
        /* ignore */
      }
      threatOsc = null
    }
    if (threatGain) {
      try {
        threatGain.disconnect()
      } catch {
        /* ignore */
      }
      threatGain = null
    }
    return
  }

  if (!threatGain) {
    threatGain = c.createGain()
    threatGain.gain.value = 0
    threatGain.connect(master)
    threatOsc = c.createOscillator()
    threatOsc.type = 'sine'
    threatOsc.frequency.value = 55
    threatOsc.connect(threatGain)
    threatOsc.start()
  }

  const target = level === 1 ? 0.04 : 0.09
  threatGain.gain.linearRampToValueAtTime(target, c.currentTime + 0.15)
  if (threatOsc) {
    threatOsc.frequency.linearRampToValueAtTime(
      level === 1 ? 55 : 72,
      c.currentTime + 0.15,
    )
  }
}

export function isAudioUnlocked() {
  return unlocked
}
