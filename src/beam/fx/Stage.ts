import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { BG_FRAG, NOISE, POST_FRAG, VERT } from './shaders'
import { clamp } from '../math'

/** 背景映像を照らす光。a==b なら点光源 */
export interface LightSpec {
  ax: number
  ay: number
  bx: number
  by: number
  color: THREE.Color
  intensity: number
  radius: number
}

/** 背景映像を歪める衝撃波 */
export interface WaveSpec {
  x: number
  y: number
  r: number
  w: number
  s: number
}

export interface Kick {
  shake?: number
  aberr?: number
  flash?: number
  invert?: number
  glitch?: number
}

const MAX_LIGHTS = 8
const MAX_WAVES = 6
const PAD = 60

/**
 * Three.js の舞台。カメラは画面 px の正射影（y 下向き）なので、
 * FX 側は画面座標のまま配置し、rotation.z = atan2(dy, dx) で向きを決められる。
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.OrthographicCamera(0, 1, 0, 1, -100, 100)
  W = 1
  H = 1
  /** 画面サイズに対する FX の倍率 */
  unit = 1
  /** HUD を揺らすためのオフセット */
  readonly shakeOffset = { x: 0, y: 0 }

  private composer: EffectComposer
  private post: ShaderPass
  private bgMat: THREE.ShaderMaterial
  private bgMesh: THREE.Mesh
  private videoTex: THREE.VideoTexture | null = null

  private trauma = 0
  private hold: Required<Kick> = { shake: 0, aberr: 0, flash: 0, invert: 0, glitch: 0 }
  private impulse: Required<Kick> = { shake: 0, aberr: 0, flash: 0, invert: 0, glitch: 0 }
  private lights: LightSpec[] = []
  private waves: WaveSpec[] = []

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' })
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.renderer.setClearColor(0x000000, 1)
    this.camera.position.z = 10

    this.bgMat = new THREE.ShaderMaterial({
      uniforms: {
        uVideo: { value: null },
        uHasVideo: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uVidRes: { value: new THREE.Vector2(1280, 720) },
        uPad: { value: PAD },
        uTime: { value: 0 },
        uFlash: { value: 0 },
        uWave: { value: Array.from({ length: MAX_WAVES }, () => new THREE.Vector4()) },
        uWaveW: { value: new Array<number>(MAX_WAVES).fill(1) },
        uNW: { value: 0 },
        uLA: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4()) },
        uLB: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4()) },
        uLR: { value: new Array<number>(MAX_LIGHTS).fill(1) },
        uNL: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: NOISE + BG_FRAG,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    this.bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.bgMat)
    this.bgMesh.renderOrder = -100
    this.bgMesh.frustumCulled = false
    this.scene.add(this.bgMesh)

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.62, 0.12, 0.78))
    this.composer.addPass(new OutputPass())
    this.post = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uAberr: { value: 0 },
        uInvert: { value: 0 },
        uGlitch: { value: 0 },
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: VERT,
      fragmentShader: POST_FRAG,
    })
    this.composer.addPass(this.post)
  }

  resize(W: number, H: number) {
    this.W = W
    this.H = H
    this.unit = clamp(Math.min(W, H) / 820, 0.55, 1.5)
    const dpr = clamp(Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(2_400_000 / (W * H))), 0.6, 2)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(W, H)
    this.composer.setPixelRatio(dpr)
    this.composer.setSize(W, H)
    this.camera.left = 0
    this.camera.right = W
    this.camera.top = 0
    this.camera.bottom = H
    this.camera.updateProjectionMatrix()
    this.bgMesh.position.set(W / 2, H / 2, -1)
    this.bgMesh.scale.set(W + PAD * 2, H + PAD * 2, 1)
    ;(this.bgMat.uniforms.uRes.value as THREE.Vector2).set(W, H)
    ;(this.post.uniforms.uRes.value as THREE.Vector2).set(W * dpr, H * dpr)
  }

  setVideo(video: HTMLVideoElement) {
    this.videoTex?.dispose()
    const tex = new THREE.VideoTexture(video)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    this.videoTex = tex
    this.bgMat.uniforms.uVideo.value = tex
    this.bgMat.uniforms.uHasVideo.value = 1
  }

  /** 一瞬の衝撃（加算で積もる） */
  kick(k: Kick) {
    if (k.shake) this.trauma = Math.min(1, this.trauma + k.shake)
    if (k.aberr) this.impulse.aberr = Math.max(this.impulse.aberr, k.aberr)
    if (k.flash) this.impulse.flash = Math.max(this.impulse.flash, k.flash)
    if (k.invert) this.impulse.invert = Math.max(this.impulse.invert, k.invert)
    if (k.glitch) this.impulse.glitch = Math.max(this.impulse.glitch, k.glitch)
  }

  /** 照射中など、そのフレームだけ維持したい強さ */
  sustain(k: Kick) {
    if (k.shake) this.hold.shake = Math.max(this.hold.shake, k.shake)
    if (k.aberr) this.hold.aberr = Math.max(this.hold.aberr, k.aberr)
    if (k.flash) this.hold.flash = Math.max(this.hold.flash, k.flash)
    if (k.glitch) this.hold.glitch = Math.max(this.hold.glitch, k.glitch)
  }

  addLight(l: LightSpec) {
    if (l.intensity > 0.01) this.lights.push(l)
  }

  addWave(w: WaveSpec) {
    if (Math.abs(w.s) > 0.05) this.waves.push(w)
  }

  render(dt: number, t: number) {
    // 衝撃は時間で減衰
    this.trauma = Math.max(0, this.trauma - dt * 0.95)
    const im = this.impulse
    im.aberr = Math.max(0, im.aberr - dt * 1.6)
    im.flash = Math.max(0, im.flash - dt * 1.4)
    im.invert = Math.max(0, im.invert - dt * 5)
    im.glitch = Math.max(0, im.glitch - dt * 2.2)

    const shake = Math.max(this.trauma, this.hold.shake)
    const amp = 26 * this.unit * shake * shake
    const sx = amp * (Math.sin(t * 47.3) * 0.6 + Math.sin(t * 83.1 + 1.3) * 0.4)
    const sy = amp * (Math.sin(t * 53.7 + 2.1) * 0.6 + Math.sin(t * 71.9 + 0.4) * 0.4)
    this.camera.position.x = sx
    this.camera.position.y = sy
    this.shakeOffset.x = sx * 0.35
    this.shakeOffset.y = sy * 0.35

    const u = this.bgMat.uniforms
    u.uTime.value = t
    u.uFlash.value = Math.min(0.5, im.flash + this.hold.flash)
    const vid = this.videoTex?.image as HTMLVideoElement | undefined
    if (vid && vid.videoWidth) (u.uVidRes.value as THREE.Vector2).set(vid.videoWidth, vid.videoHeight)

    this.lights.sort((a, b) => b.intensity - a.intensity)
    const nl = Math.min(MAX_LIGHTS, this.lights.length)
    const la = u.uLA.value as THREE.Vector4[]
    const lb = u.uLB.value as THREE.Vector4[]
    const lr = u.uLR.value as number[]
    for (let i = 0; i < nl; i++) {
      const l = this.lights[i]
      la[i].set(l.ax, l.ay, l.bx, l.by)
      lb[i].set(l.color.r, l.color.g, l.color.b, Math.min(l.intensity, 2.5))
      lr[i] = Math.max(1, l.radius)
    }
    u.uNL.value = nl

    const nw = Math.min(MAX_WAVES, this.waves.length)
    const wv = u.uWave.value as THREE.Vector4[]
    const ww = u.uWaveW.value as number[]
    for (let i = 0; i < nw; i++) {
      const w = this.waves[i]
      wv[i].set(w.x, w.y, w.r, w.s)
      ww[i] = Math.max(1, w.w)
    }
    u.uNW.value = nw

    const p = this.post.uniforms
    p.uTime.value = t
    p.uAberr.value = Math.min(1.5, im.aberr + this.hold.aberr)
    p.uInvert.value = im.invert
    p.uGlitch.value = Math.min(1, im.glitch + this.hold.glitch)

    this.composer.render(dt)

    this.lights.length = 0
    this.waves.length = 0
    this.hold = { shake: 0, aberr: 0, flash: 0, invert: 0, glitch: 0 }
  }
}
