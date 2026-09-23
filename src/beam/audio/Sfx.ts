/* =========================================================
   効果音はすべて WebAudio で合成する（音声ファイルなし）
   ========================================================= */

interface Voice {
  o1: OscillatorNode
  o2: OscillatorNode
  f: BiquadFilterNode
  g: GainNode
  lfo: OscillatorNode
  lfoG: GainNode
  n: AudioBufferSourceNode
  nf: BiquadFilterNode
  ng: GainNode
}

const VOL = 0.8

export class Sfx {
  muted = false
  private ctx: AudioContext | null = null
  private out!: GainNode
  private noiseBuf!: AudioBuffer
  private voices = new Map<string, Voice>()

  /** ユーザー操作の中で呼ぶ（自動再生制限のため） */
  init() {
    if (this.ctx) {
      void this.ctx.resume()
      return
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.knee.value = 12
    comp.ratio.value = 6
    comp.attack.value = 0.003
    comp.release.value = 0.2
    this.out = ctx.createGain()
    this.out.gain.value = this.muted ? 0 : VOL
    this.out.connect(comp).connect(ctx.destination)
    const len = ctx.sampleRate * 2
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = this.noiseBuf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    this.ctx = ctx
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.ctx) this.out.gain.setTargetAtTime(m ? 0 : VOL, this.ctx.currentTime, 0.03)
  }

  private osc(type: OscillatorType, freq: number) {
    const o = this.ctx!.createOscillator()
    o.type = type
    o.frequency.value = freq
    return o
  }

  private noise() {
    const s = this.ctx!.createBufferSource()
    s.buffer = this.noiseBuf
    s.loop = true
    return s
  }

  private filter(type: BiquadFilterType, freq: number, q = 0.7) {
    const f = this.ctx!.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    return f
  }

  /** 立ち上がり a 秒でピーク、hold 秒保持、d 秒で消える */
  private env(src: AudioNode, t0: number, a: number, peak: number, d: number, hold = 0) {
    const g = this.ctx!.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(peak, t0 + a)
    if (hold > 0) g.gain.setValueAtTime(peak, t0 + a + hold)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + hold + d)
    src.connect(g).connect(this.out)
    return t0 + a + hold + d + 0.05
  }

  private play(nodes: (OscillatorNode | AudioBufferSourceNode)[], t0: number, end: number) {
    for (const n of nodes) {
      n.start(t0)
      n.stop(end)
    }
  }

  /* ---------- 溜め ---------- */

  chargeStart(id: string) {
    const ctx = this.ctx
    if (!ctx || this.voices.has(id)) return
    const t = ctx.currentTime
    const o1 = this.osc('sawtooth', 70)
    const o2 = this.osc('square', 105)
    const f = this.filter('lowpass', 300, 8)
    const g = ctx.createGain()
    g.gain.value = 0
    const lfo = this.osc('sine', 5)
    const lfoG = ctx.createGain()
    lfoG.gain.value = 0.02
    lfo.connect(lfoG).connect(g.gain)
    o1.connect(f)
    o2.connect(f)
    f.connect(g).connect(this.out)
    const n = this.noise()
    const nf = this.filter('bandpass', 900, 1.2)
    const ng = ctx.createGain()
    ng.gain.value = 0
    n.connect(nf).connect(ng).connect(this.out)
    for (const s of [o1, o2, lfo, n]) s.start(t)
    g.gain.setTargetAtTime(0.06, t, 0.05)
    this.voices.set(id, { o1, o2, f, g, lfo, lfoG, n, nf, ng })
  }

  chargeSet(id: string, charge: number) {
    const v = this.voices.get(id)
    if (!v || !this.ctx) return
    const t = this.ctx.currentTime
    const k = Math.min(1, charge / 14)
    v.o1.frequency.setTargetAtTime(55 + k * 250, t, 0.08)
    v.o2.frequency.setTargetAtTime((55 + k * 250) * 1.498, t, 0.08)
    v.f.frequency.setTargetAtTime(260 + k * 2800, t, 0.08)
    v.g.gain.setTargetAtTime(0.05 + k * 0.08, t, 0.1)
    v.lfo.frequency.setTargetAtTime(4 + k * 22, t, 0.1)
    v.lfoG.gain.setTargetAtTime(0.015 + k * 0.045, t, 0.1)
    v.nf.frequency.setTargetAtTime(700 + k * 4200, t, 0.1)
    v.ng.gain.setTargetAtTime(k * 0.05, t, 0.1)
  }

  chargeStop(id: string) {
    const v = this.voices.get(id)
    if (!v || !this.ctx) return
    this.voices.delete(id)
    const t = this.ctx.currentTime
    v.g.gain.cancelScheduledValues(t)
    v.g.gain.setTargetAtTime(0, t, 0.03)
    v.ng.gain.cancelScheduledValues(t)
    v.ng.gain.setTargetAtTime(0, t, 0.03)
    for (const s of [v.o1, v.o2, v.lfo, v.n]) s.stop(t + 0.3)
  }

  tierUp(tierIdx: number) {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const base = 520 * (1 + tierIdx * 0.16)
    ;[1, 1.26, 1.5, 2].forEach((m, i) => {
      const o = this.osc('square', base * m)
      const f = this.filter('lowpass', 3500)
      o.connect(f)
      const end = this.env(f, t + i * 0.045, 0.004, 0.07, 0.09)
      this.play([o], t + i * 0.045, end)
    })
  }

  /* ---------- 発射 ---------- */

  fire(tierIdx: number, duration: number, ki: boolean) {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const pw = 0.55 + tierIdx * 0.12

    // 破裂音
    const n = this.noise()
    const lp = this.filter('lowpass', 9000, 1)
    lp.frequency.setValueAtTime(9000, t)
    lp.frequency.exponentialRampToValueAtTime(160, t + 0.9)
    n.connect(lp)
    let end = this.env(lp, t, 0.005, 0.85 * pw, 1.1)
    this.play([n], t, end)

    // 低音の衝撃
    const sub = this.osc('sine', 150)
    sub.frequency.setValueAtTime(150, t)
    sub.frequency.exponentialRampToValueAtTime(30, t + 0.7)
    end = this.env(sub, t, 0.01, 0.9 * pw, 0.9)
    this.play([sub], t, end)

    // 照射中のうなり
    const base = (ki ? 62 : 48) * (1 + tierIdx * 0.18)
    const s1 = this.osc('sawtooth', base)
    const s2 = this.osc('sawtooth', base * 1.012)
    const s3 = this.osc('square', base * 2.003)
    const vib = this.osc('sine', 6.5)
    const vibG = ctx.createGain()
    vibG.gain.value = base * 0.05
    vib.connect(vibG)
    vibG.connect(s1.frequency)
    vibG.connect(s2.frequency)
    const hum = this.filter('lowpass', 700 + tierIdx * 350, 4)
    s1.connect(hum)
    s2.connect(hum)
    const sq = ctx.createGain()
    sq.gain.value = 0.25
    s3.connect(sq).connect(hum)
    const hold = Math.max(0.1, duration * 0.72)
    end = this.env(hum, t, 0.06, 0.2 * pw, duration - hold, hold)
    this.play([s1, s2, s3, vib], t, end)

    const hiss = this.noise()
    const bp = this.filter('bandpass', 2400, 0.8)
    hiss.connect(bp)
    end = this.env(bp, t, 0.05, 0.12 * pw, duration - hold, hold)
    this.play([hiss], t, end)
  }

  fizzle() {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const o = this.osc('sine', 420)
    o.frequency.setValueAtTime(420, t)
    o.frequency.exponentialRampToValueAtTime(60, t + 0.3)
    this.play([o], t, this.env(o, t, 0.005, 0.12, 0.3))
    const n = this.noise()
    const hp = this.filter('highpass', 3000)
    n.connect(hp)
    this.play([n], t, this.env(hp, t, 0.003, 0.08, 0.12))
  }

  /* ---------- タップ技 ---------- */

  shoot() {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const n = this.noise()
    const bp = this.filter('bandpass', 600, 2)
    bp.frequency.setValueAtTime(600, t)
    bp.frequency.exponentialRampToValueAtTime(3800, t + 0.15)
    n.connect(bp)
    this.play([n], t, this.env(bp, t, 0.01, 0.35, 0.2))
    const o = this.osc('triangle', 900)
    o.frequency.setValueAtTime(900, t)
    o.frequency.exponentialRampToValueAtTime(300, t + 0.15)
    this.play([o], t, this.env(o, t, 0.003, 0.1, 0.15))
  }

  impact(size = 1) {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const o = this.osc('sine', 120)
    o.frequency.setValueAtTime(120, t)
    o.frequency.exponentialRampToValueAtTime(38, t + 0.4)
    this.play([o], t, this.env(o, t, 0.005, 0.55 * size, 0.4 * size))
    const n = this.noise()
    const lp = this.filter('lowpass', 2400)
    lp.frequency.setValueAtTime(2400, t)
    lp.frequency.exponentialRampToValueAtTime(180, t + 0.5 * size)
    n.connect(lp)
    this.play([n], t, this.env(lp, t, 0.004, 0.45 * size, 0.5 * size))
  }

  thunder() {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const crack = this.noise()
    const hp = this.filter('highpass', 1400)
    crack.connect(hp)
    this.play([crack], t, this.env(hp, t, 0.002, 0.8, 0.25))
    const rumble = this.noise()
    const lp = this.filter('lowpass', 260)
    rumble.connect(lp)
    this.play([rumble], t, this.env(lp, t + 0.02, 0.04, 0.9, 1.5))
    const o = this.osc('sine', 70)
    o.frequency.setValueAtTime(70, t)
    o.frequency.exponentialRampToValueAtTime(35, t + 0.8)
    this.play([o], t, this.env(o, t, 0.01, 0.4, 0.8))
  }

  nova() {
    this.impact(1.6)
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const n = this.noise()
    const lp = this.filter('lowpass', 500)
    n.connect(lp)
    this.play([n], t, this.env(lp, t + 0.05, 0.05, 0.6, 1.4))
  }

  slash() {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const n = this.noise()
    const bp = this.filter('bandpass', 2500, 3)
    bp.frequency.setValueAtTime(2500, t)
    bp.frequency.exponentialRampToValueAtTime(9000, t + 0.12)
    n.connect(bp)
    this.play([n], t, this.env(bp, t, 0.004, 0.5, 0.18))
    for (const f of [2380, 3610]) {
      const o = this.osc('sine', f)
      this.play([o], t, this.env(o, t + 0.02, 0.002, 0.05, 0.4))
    }
  }

  click() {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const o = this.osc('square', 1400)
    this.play([o], t, this.env(o, t, 0.002, 0.04, 0.04))
  }
}
