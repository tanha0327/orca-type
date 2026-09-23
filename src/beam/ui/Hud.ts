import { MIN_CHARGE, PRE_INNER, SKILLS, TIERS, tierIndexFor } from '../config'

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T

/** 表示範囲の上限（最終段階に届いた時点で満タン） */
const BAR_MAX = TIERS[TIERS.length - 1].min

export interface FiringInfo {
  progress: number
  tierIdx: number
  ki: boolean
  front: boolean
  remain: number
}

export interface HudHandlers {
  onSkill: (i: number) => void
}

export class Hud {
  private text = new Map<HTMLElement, string>()
  private started = performance.now()
  private hintUntil = 0
  private tierRows: HTMLLIElement[] = []
  private skillBtns: HTMLButtonElement[] = []
  private lastTier = -2
  private el = {
    shake: $('hud-shake'),
    clock: $('clock'),
    a: $('st-a'),
    b: $('st-b'),
    pose: $('st-pose'),
    ki: $('st-ki'),
    fps: $('st-fps'),
    inf: $('st-inf'),
    charge: $('charge'),
    chMode: $('ch-mode'),
    chLv: $('ch-lv'),
    chJp: $('ch-jp'),
    chEn: $('ch-en'),
    chTime: $('ch-time'),
    chFill: $('ch-fill'),
    chTicks: $('ch-ticks'),
    chHint: $('ch-hint'),
    log: $('log'),
    banner: $('banner'),
    bnLv: $('bn-lv'),
    bnJp: $('bn-jp'),
    bnEn: $('bn-en'),
    tiers: $('tier-list'),
    skills: $('skills'),
  }

  constructor(h: HudHandlers) {
    for (const t of TIERS) {
      const li = document.createElement('li')
      li.style.setProperty('--sw', t.prism ? 'linear-gradient(#ff3d71,#ffd60a,#38bdf8,#7b5cff)' : t.inner)
      if (t.prism) li.style.borderImage = 'linear-gradient(#ff3d71,#ffd60a,#38bdf8,#7b5cff) 1'
      li.innerHTML = `<span class="t-lv">LV${t.lv}</span><span class="t-jp">${t.jp}</span><span class="t-sec">${t.min.toFixed(1)}s</span><span class="t-en">${t.en}</span>`
      this.el.tiers.appendChild(li)
      this.tierRows.push(li)
      const tick = document.createElement('span')
      tick.style.left = `${(t.min / BAR_MAX) * 100}%`
      this.el.chTicks.appendChild(tick)
    }
    SKILLS.forEach((s, i) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'skill'
      b.innerHTML = `<span class="sk-no">${s.no}</span><span class="sk-jp">${s.jp}</span><span class="sk-en">${s.en}</span><span class="sk-key">[${i + 1}]</span>`
      b.title = s.desc
      b.addEventListener('click', () => h.onSkill(i))
      this.el.skills.appendChild(b)
      this.skillBtns.push(b)
    })
    this.setSkill(0)
  }

  /** 変わったときだけ DOM を書き換える */
  private set(el: HTMLElement, s: string) {
    if (this.text.get(el) === s) return
    this.text.set(el, s)
    el.textContent = s
  }

  setSkill(i: number) {
    this.skillBtns.forEach((b, j) => b.classList.toggle('active', i === j))
  }

  setStatus(s: { a: string; b: string; pose: string; ki: string }) {
    this.set(this.el.a, s.a)
    this.set(this.el.b, s.b)
    this.set(this.el.pose, s.pose)
    this.set(this.el.ki, s.ki)
  }

  setPerf(fps: number, infMs: number | null, delegate: string) {
    this.set(this.el.fps, `${fps.toFixed(0)} FRAME/S`)
    this.set(this.el.inf, infMs === null ? '--' : `${infMs.toFixed(1)}ms ${delegate}`)
  }

  setCharge(c: { charge: number; ki: boolean } | null, firing: FiringInfo | null) {
    const el = this.el
    const root = el.charge
    if (!c) {
      root.classList.remove('active')
      root.classList.toggle('firing', firing !== null)
      if (firing === null) {
        this.set(el.chMode, 'STANDBY')
        this.set(el.chLv, '00')
        this.set(el.chJp, '待機中')
        this.set(el.chEn, 'STANDBY')
        this.set(el.chTime, '00.00')
        el.chFill.style.width = '0%'
        root.style.setProperty('--acc', PRE_INNER)
        this.markTier(-1)
      } else {
        const t = TIERS[firing.tierIdx]
        this.set(el.chMode, firing.front ? 'RELEASE // FRONT' : 'RELEASE')
        this.set(el.chLv, `0${t.lv}`)
        this.set(el.chJp, firing.ki ? t.kiJp : t.jp)
        this.set(el.chEn, firing.ki ? t.kiEn : t.en)
        this.set(el.chTime, firing.remain.toFixed(2).padStart(5, '0'))
        el.chFill.style.width = `${Math.max(0, 1 - firing.progress) * 100}%`
        root.style.setProperty('--acc', t.prism ? '#ffffff' : t.inner)
        this.markTier(firing.tierIdx)
      }
      return
    }
    const ti = tierIndexFor(c.charge)
    const t = TIERS[ti]
    root.classList.add('active')
    root.classList.remove('firing')
    this.set(el.chMode, c.ki ? 'KI // 両手' : 'CHARGE // 片手')
    this.set(el.chLv, ti < 0 ? '00' : `0${t.lv}`)
    this.set(el.chJp, ti < 0 ? '充填中' : c.ki ? t.kiJp : t.jp)
    this.set(el.chEn, ti < 0 ? `MIN ${MIN_CHARGE.toFixed(1)}s` : c.ki ? t.kiEn : t.en)
    this.set(el.chTime, c.charge.toFixed(2).padStart(5, '0'))
    el.chFill.style.width = `${Math.min(1, c.charge / BAR_MAX) * 100}%`
    root.style.setProperty('--acc', ti < 0 ? PRE_INNER : t.prism ? '#ffffff' : t.inner)
    this.markTier(ti)
  }

  private markTier(ti: number) {
    if (ti === this.lastTier) return
    this.lastTier = ti
    this.tierRows.forEach((li, i) => {
      li.classList.toggle('current', i === ti)
      li.classList.toggle('reached', i < ti)
    })
  }

  pulseTier(ti: number) {
    const li = this.tierRows[ti]
    if (!li) return
    li.classList.remove('pulse')
    void li.offsetWidth
    li.classList.add('pulse')
  }

  setHint(s: string) {
    if (performance.now() < this.hintUntil) return
    this.el.chHint.classList.remove('flash')
    this.set(this.el.chHint, s || ' ')
  }

  /** しばらくのあいだ反転表示で目立たせる */
  flashHint(s: string) {
    this.hintUntil = performance.now() + 1600
    this.el.chHint.classList.add('flash')
    this.set(this.el.chHint, s)
  }

  log(msg: string) {
    const t = (performance.now() - this.started) / 1000
    const m = Math.floor(t / 60)
    const ts = `${String(m).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`
    const ln = document.createElement('div')
    ln.className = 'ln'
    ln.innerHTML = `<span class="ts">${ts}</span>`
    ln.appendChild(document.createTextNode(`> ${msg}`))
    this.el.log.appendChild(ln)
    while (this.el.log.children.length > 6) this.el.log.firstElementChild?.remove()
  }

  banner(ti: number, ki: boolean, front: boolean) {
    const t = TIERS[ti]
    const b = this.el.banner
    this.set(this.el.bnLv, `LV.0${t.lv}${ki ? ' // 双' : ''}${front ? ' // FRONT' : ''}`)
    this.set(this.el.bnJp, ki ? t.kiJp : t.jp)
    this.set(this.el.bnEn, ki ? t.kiEn : t.en)
    b.style.setProperty('--bc', t.prism ? '#ffffff' : t.inner)
    b.classList.remove('show')
    void b.offsetWidth
    b.classList.add('show')
  }

  tick(now: number, shakeX: number, shakeY: number) {
    const t = now - this.started
    const m = Math.floor(t / 60000)
    const s = Math.floor(t / 1000) % 60
    const ms = Math.floor(t % 1000)
    this.set(this.el.clock, `${m}.${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`)
    this.el.shake.style.transform = shakeX || shakeY ? `translate(${shakeX.toFixed(1)}px, ${shakeY.toFixed(1)}px)` : ''
  }
}
