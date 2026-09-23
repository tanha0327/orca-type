import './beam.css'
import { Stage } from './fx/Stage'
import { Particles } from './fx/Particles'
import { FxManager } from './fx/effects'
import { Sfx } from './audio/Sfx'
import { Hud } from './ui/Hud'
import { Overlay } from './ui/Overlay'
import { Tracker, type LoadStep } from './tracking/Tracker'
import { Game } from './game/Game'
import { SKILLS, TIERS } from './config'
import type { Vec2 } from './math'

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T

const stage = new Stage($<HTMLCanvasElement>('gl'))
const particles = new Particles()
stage.scene.add(particles.mesh)
const fx = new FxManager()
const sfx = new Sfx()
const overlay = new Overlay($<HTMLCanvasElement>('overlay'))
const tracker = new Tracker($<HTMLVideoElement>('cam'))
let game!: Game
const hud = new Hud({
  onSkill: (i) => {
    sfx.click()
    game.setSkill(i)
  },
})
game = new Game({ stage, particles, fx, sfx, hud })

/* ---------- 画面サイズ ---------- */
function resize() {
  const W = window.innerWidth
  const H = window.innerHeight
  stage.resize(W, H)
  overlay.resize(W, H)
  if (!game.pointer.x && !game.pointer.y) game.pointer = { x: W / 2, y: H * 0.3 }
}
window.addEventListener('resize', resize)
resize()

/* ---------- メインループ ---------- */
const params = new URLSearchParams(location.search)
/** 溜め時間を実時間に合わせるため、10fps までは経過時間をそのまま使う */
const DT_MAX = Number(params.get('dtmax')) || 0.1
let last = performance.now()
let t = 0
let fps = 60
/** 検証用：止めてから step() で 1 コマずつ進める */
let paused = false

function step(dt: number, now: number) {
  t = (t + dt) % 1000
  if (tracker.ready) {
    const tf = tracker.detect(now, stage.W, stage.H)
    if (tf) game.onFrame(tf, now)
  }
  game.update(dt, now)
  fx.update(dt, t)
  particles.update(dt)
  stage.render(dt, t)
  overlay.draw(game, now)
  hud.setPerf(fps, tracker.ready ? tracker.infMs : null, tracker.ready ? tracker.delegate : '')
  hud.tick(now, stage.shakeOffset.x, stage.shakeOffset.y)
}

function frame(now: number) {
  const dt = Math.min(DT_MAX, Math.max(0, (now - last) / 1000))
  last = now
  if (dt > 0) fps = fps * 0.95 + (1 / dt) * 0.05
  if (!paused) step(dt, now)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

/* ---------- 起動 ---------- */
const boot = $('boot')
const bootLog = $('boot-log')
const bootBar = $('boot-bar')
const btnStart = $<HTMLButtonElement>('btn-start')
const btnDemo = $<HTMLButtonElement>('btn-demo')
const btnClose = $<HTMLButtonElement>('btn-close')

const lines: Record<string, string> = {}
function logLine(key: string, text: string) {
  lines[key] = text
  bootLog.textContent = Object.values(lines).join('\n')
}
const dots = (label: string, value: string) => `> ${label} ${'.'.repeat(Math.max(2, 24 - label.length))} ${value}`

function hideBoot() {
  boot.classList.add('hidden')
  boot.classList.remove('help')
}

async function startCamera() {
  sfx.init()
  btnStart.disabled = true
  btnDemo.disabled = true
  logLine('cam', dots('CAMERA', 'REQUEST'))
  try {
    await tracker.startCamera()
    stage.setVideo(tracker.video)
    logLine('cam', dots('CAMERA', `OK ${tracker.video.videoWidth}x${tracker.video.videoHeight}`))
  } catch (e) {
    const name = e instanceof Error ? (e.message === 'INSECURE' ? 'INSECURE' : e.name) : 'Error'
    const msg =
      name === 'NotAllowedError'
        ? 'カメラの使用が許可されませんでした'
        : name === 'NotFoundError'
          ? 'カメラが見つかりません'
          : name === 'INSECURE'
            ? 'HTTPS で開いてください'
            : 'カメラを開始できませんでした'
    logLine('cam', `${dots('CAMERA', 'FAILED')}  ${msg}\n> DEMO モードで遊べます（SPACE 長押し / タップ）`)
    btnDemo.disabled = false
    btnStart.disabled = false
    return
  }

  const prog: Record<LoadStep, number> = { gesture: 0, pose: 0, runtime: 0 }
  const onProgress = (step: LoadStep, r: number, note?: string) => {
    prog[step] = r
    bootBar.style.width = `${(prog.gesture * 0.45 + prog.pose * 0.35 + prog.runtime * 0.2) * 100}%`
    if (step === 'gesture') logLine('g', dots('HAND/GESTURE MODEL', r >= 1 ? 'OK' : `${Math.round(r * 100)}%`))
    if (step === 'pose') logLine('p', dots('ARM/POSE MODEL', note ?? (r >= 1 ? 'OK' : `${Math.round(r * 100)}%`)))
    if (step === 'runtime') logLine('r', dots('NEURAL RUNTIME', r >= 1 ? `OK ${note ?? ''}` : 'COMPILING'))
  }
  try {
    await tracker.loadModels(onProgress)
  } catch (e) {
    console.error(e)
    logLine('r', `${dots('NEURAL RUNTIME', 'FAILED')}\n> 認識モデルを読み込めませんでした。通信環境を確認してください`)
    btnDemo.disabled = false
    btnStart.disabled = false
    return
  }
  logLine('go', '> LINK ESTABLISHED — THE ARM MUST AWAKEN')
  game.mode = 'camera'
  hud.log(`CAMERA LINK // ${tracker.delegate}${tracker.pose ? ' + POSE' : ''}`)
  setTimeout(hideBoot, 450)
}

function startDemo() {
  sfx.init()
  game.mode = 'demo'
  hud.log('DEMO MODE // SPACE + TAP')
  hideBoot()
}

btnStart.addEventListener('click', () => void startCamera())
btnDemo.addEventListener('click', startDemo)
btnClose.addEventListener('click', hideBoot)
$('btn-help').addEventListener('click', () => {
  sfx.click()
  boot.classList.remove('hidden')
  boot.classList.add('help')
  const running = game.mode !== 'boot'
  btnStart.hidden = running
  btnDemo.hidden = running
  btnClose.hidden = !running
})
const btnSound = $<HTMLButtonElement>('btn-sound')
btnSound.addEventListener('click', () => {
  sfx.init()
  sfx.setMuted(!sfx.muted)
  btnSound.textContent = sfx.muted ? 'SND:OFF' : 'SND:ON'
})

/* ---------- タップ技 / 斬撃のなぞり ---------- */
const app = $('app')
let drag: { id: number; path: Vec2[] } | null = null
const isUi = (e: Event) => (e.target as HTMLElement).closest('button, .boot') !== null

app.addEventListener('pointerdown', (e) => {
  if (isUi(e) || game.mode === 'boot') return
  sfx.init()
  const p = { x: e.clientX, y: e.clientY }
  game.pointer = p
  overlay.addTap(p, performance.now())
  if (SKILLS[game.skill].id === 'slash') drag = { id: e.pointerId, path: [p] }
  else game.tap(p)
})
app.addEventListener('pointermove', (e) => {
  game.pointer = { x: e.clientX, y: e.clientY }
  if (drag && e.pointerId === drag.id) drag.path.push({ x: e.clientX, y: e.clientY })
})
const endDrag = (e: PointerEvent) => {
  if (!drag || e.pointerId !== drag.id) return
  const path = drag.path
  drag = null
  let len = 0
  for (let i = 1; i < path.length; i++) len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
  if (len > 70) game.slashPath(path)
  else game.tap(path[0])
}
app.addEventListener('pointerup', endDrag)
app.addEventListener('pointercancel', endDrag)

/* ---------- キーボード ---------- */
window.addEventListener('keydown', (e) => {
  if (e.repeat) return
  if (e.code === 'Space') {
    e.preventDefault()
    if (game.mode === 'boot') return
    sfx.init()
    game.keyCharge(true)
  } else if (/^Digit[1-4]$/.test(e.code)) {
    sfx.click()
    game.setSkill(Number(e.code.slice(5)) - 1)
  }
})
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') game.keyCharge(false)
})

/* ---------- 検証用（?debug） ---------- */
if (params.has('demo')) startDemo()
if (params.has('debug')) {
  Object.assign(window, {
    __beam: {
      game,
      stage,
      fx,
      tiers: TIERS,
      /** 発射台から、指定秒数ぶん溜めた状態で angleDeg（画面上向きが 90°）へ撃つ */
      fire(charge: number, angleDeg = 60) {
        const a = (angleDeg * Math.PI) / 180
        game.pointer = { x: stage.W / 2 + Math.cos(a) * 400, y: stage.H * 0.78 - Math.sin(a) * 400 }
        game.update(0, performance.now())
        if (game.vslot.beam) {
          game.vslot.beam.dead = true
          game.vslot.beam = null
        }
        game.keyCharge(true)
        game.vslot.charge = charge
        game.keyCharge(false)
      },
      /** ループを止めて、seconds 秒ぶんを 60fps 相当で進める */
      advance(seconds: number) {
        paused = true
        const n = Math.max(1, Math.round(seconds * 60))
        let now = performance.now()
        for (let i = 0; i < n; i++) {
          now += 1000 / 60
          step(1 / 60, now)
        }
      },
      resume() {
        paused = false
      },
      charge(seconds: number) {
        game.keyCharge(true)
        game.vslot.charge = seconds
      },
      tap(skill: number, x: number, y: number) {
        game.setSkill(skill)
        game.tap({ x, y })
      },
    },
  })
}
