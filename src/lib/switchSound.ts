/* ================================================================
   打鍵音（スイッチ ASMR）。
   音声ファイルは使わず、Web Audio でノイズとサイン波を組み合わせて合成する。
   ================================================================ */

export type SwitchSoundProfile = 'off' | 'linear' | 'tactile' | 'clicky'

export const SWITCH_SOUND_PROFILES: SwitchSoundProfile[] = ['off', 'linear', 'tactile', 'clicky']

export const SWITCH_SOUND_LABEL: Record<SwitchSoundProfile, string> = {
  off: 'オフ',
  linear: '赤軸',
  tactile: '茶軸',
  clicky: '青軸',
}

/** 設定のチップに付ける軸の色 */
export const SWITCH_STEM_COLOR: Record<SwitchSoundProfile, string | null> = {
  off: null,
  linear: '#d7372b',
  tactile: '#8a5a2e',
  clicky: '#2f73d6',
}

/**
 * 鳴らすきっかけ。
 * down / up はキーの押下と離し、hold は長押し確定、combo はコンボ発火、
 * encoder はホイールの 1 ノッチ、pad はスワイプ・タップ
 */
export type SwitchSoundEvent = 'down' | 'up' | 'hold' | 'combo' | 'encoder' | 'pad'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null

function getContext(): AudioContext | null {
  if (ctx) return ctx
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx = new Ctor()
  master = ctx.createGain()
  master.connect(ctx.destination)
  return ctx
}

/**
 * ブラウザは操作のない状態で音を出させてくれないので、クリックや打鍵のたびに呼んで起こしておく。
 * 最初の呼び出しで AudioContext を作る。
 */
export function unlockAudio() {
  const c = getContext()
  if (c && c.state === 'suspended') void c.resume()
}

/** いまブラウザが音を出せる状態か */
export function audioRunning(): boolean {
  return ctx?.state === 'running'
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise) return noise
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.5), c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  noise = buf
  return buf
}

/** 小さな揺らぎ。毎回まったく同じ音だと機械っぽく聞こえるので */
function jitter(amount: number): number {
  return 1 + (Math.random() - 0.5) * amount
}

function envelope(c: AudioContext, at: number, duration: number, peak: number): GainNode {
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.linearRampToValueAtTime(peak, at + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  return g
}

/** 帯域を絞ったノイズの短いバースト（底打ちやクリックの「カチッ」「コトッ」） */
function burst(c: AudioContext, out: AudioNode, opts: {
  at: number
  duration: number
  freq: number
  /** 指定すると、この周波数まで掃引する（スワイプの「シュッ」） */
  toFreq?: number
  q: number
  gain: number
}) {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c)
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = opts.q
  filter.frequency.setValueAtTime(opts.freq, opts.at)
  if (opts.toFreq) filter.frequency.exponentialRampToValueAtTime(opts.toFreq, opts.at + opts.duration)
  const env = envelope(c, opts.at, opts.duration, opts.gain)
  src.connect(filter).connect(env).connect(out)
  src.start(opts.at, Math.random() * 0.3)
  src.stop(opts.at + opts.duration + 0.02)
}

/** 音程のある短い音（ハウジングの響きや、合図の「ピッ」） */
function tone(c: AudioContext, out: AudioNode, opts: {
  at: number
  duration: number
  freq: number
  toFreq?: number
  gain: number
  type?: OscillatorType
}) {
  const osc = c.createOscillator()
  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(opts.freq, opts.at)
  if (opts.toFreq) osc.frequency.exponentialRampToValueAtTime(opts.toFreq, opts.at + opts.duration)
  const env = envelope(c, opts.at, opts.duration, opts.gain)
  osc.connect(env).connect(out)
  osc.start(opts.at)
  osc.stop(opts.at + opts.duration + 0.02)
}

/** 底打ちの「コトッ」。赤軸・茶軸・青軸で共通の土台 */
function bottomOut(c: AudioContext, out: AudioNode, at: number, weight: number) {
  const r = jitter(0.12)
  burst(c, out, { at, duration: 0.045, freq: 1800 * r, q: 1.2, gain: 0.5 * weight * jitter(0.2) })
  tone(c, out, { at, duration: 0.06, freq: 170 * r, toFreq: 110 * r, gain: 0.35 * weight })
}

export function playSwitchSound(event: SwitchSoundEvent, profile: SwitchSoundProfile, volume: number) {
  if (profile === 'off' || volume <= 0) return
  const c = getContext()
  if (!c || !master) return
  // まだ音を出せない（ユーザー操作の前）なら、起こすだけにして今回は鳴らさない
  if (c.state !== 'running') { void c.resume(); return }

  master.gain.value = volume
  const out = master
  const at = c.currentTime + 0.001

  switch (event) {
    case 'down':
      if (profile === 'linear') {
        bottomOut(c, out, at, 1)
      } else if (profile === 'tactile') {
        // 押し始めの小さな段差（タクタイルバンプ）のあとに底打ち
        burst(c, out, { at, duration: 0.02, freq: 900 * jitter(0.1), q: 2, gain: 0.25 })
        bottomOut(c, out, at + 0.018, 0.9)
      } else {
        // 青軸はクリックジャケットの鋭い「カチッ」が先に来る
        burst(c, out, { at, duration: 0.012, freq: 4200 * jitter(0.1), q: 6, gain: 0.8 })
        tone(c, out, { at, duration: 0.008, freq: 3000, gain: 0.08, type: 'square' })
        bottomOut(c, out, at + 0.012, 0.7)
      }
      return
    case 'up': {
      const r = jitter(0.12)
      burst(c, out, { at, duration: 0.03, freq: 2400 * r, q: 1.5, gain: 0.22 })
      tone(c, out, { at, duration: 0.03, freq: 240 * r, toFreq: 180 * r, gain: 0.12 })
      if (profile === 'clicky') burst(c, out, { at, duration: 0.01, freq: 3800 * r, q: 6, gain: 0.35 })
      return
    }
    case 'hold':
      // 長押しが確定した合図の、低い「コッ」
      tone(c, out, { at, duration: 0.07, freq: 330, toFreq: 260, gain: 0.2, type: 'triangle' })
      return
    case 'combo':
      // コンボ発火は短い 2 連音
      tone(c, out, { at, duration: 0.05, freq: 880, gain: 0.12, type: 'triangle' })
      tone(c, out, { at: at + 0.06, duration: 0.06, freq: 1320, gain: 0.12, type: 'triangle' })
      return
    case 'encoder':
      // ホイールのディテントの細かい「カリッ」
      burst(c, out, { at, duration: 0.008, freq: 3000 * jitter(0.1), q: 8, gain: 0.4 })
      tone(c, out, { at, duration: 0.01, freq: 1400, gain: 0.05 })
      return
    case 'pad':
      // 指でなぞる「シュッ」
      burst(c, out, { at, duration: 0.12, freq: 600, toFreq: 2400, q: 1, gain: 0.18 })
  }
}
