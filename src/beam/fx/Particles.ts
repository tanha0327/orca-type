import * as THREE from 'three'
import { PARTICLE_FRAG, PARTICLE_VERT } from './shaders'
import type { Vec2 } from '../math'

export interface ParticleSpec {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  size: number
  color: THREE.Color
  alpha?: number
  /** 速度 × この秒数ぶん尾を伸ばす */
  stretch?: number
  drag?: number
  gravity?: number
  /** この点に吸い寄せられる（参照を保持するので、動く目標にも追従する） */
  attract?: Vec2 | null
  attractK?: number
  /** 1 秒あたりの速度の伸び率（正面ビームの遠近感用） */
  accel?: number
  shrink?: boolean
}

interface P {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  r: number
  g: number
  b: number
  a: number
  stretch: number
  drag: number
  grav: number
  attract: Vec2 | null
  attractK: number
  accel: number
  shrink: boolean
}

/** 火花を 1 回の描画でまとめて出すインスタンス描画の粒子系 */
export class Particles {
  readonly mesh: THREE.Mesh
  private alive: P[] = []
  private pool: P[] = []
  private geo: THREE.InstancedBufferGeometry
  private aPos: Float32Array
  private aVel: Float32Array
  private aCol: Float32Array
  private aSize: Float32Array
  private attrs: THREE.InstancedBufferAttribute[]

  constructor(private readonly max = 2800) {
    const base = new THREE.PlaneGeometry(1, 1)
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = base.index
    geo.setAttribute('position', base.getAttribute('position'))
    geo.setAttribute('uv', base.getAttribute('uv'))
    this.aPos = new Float32Array(max * 2)
    this.aVel = new Float32Array(max * 2)
    this.aCol = new Float32Array(max * 4)
    this.aSize = new Float32Array(max * 2)
    const mk = (arr: Float32Array, n: number) => {
      const a = new THREE.InstancedBufferAttribute(arr, n)
      a.setUsage(THREE.DynamicDrawUsage)
      return a
    }
    this.attrs = [mk(this.aPos, 2), mk(this.aVel, 2), mk(this.aCol, 4), mk(this.aSize, 2)]
    geo.setAttribute('iPos', this.attrs[0])
    geo.setAttribute('iVel', this.attrs[1])
    geo.setAttribute('iCol', this.attrs[2])
    geo.setAttribute('iSize', this.attrs[3])
    geo.instanceCount = 0
    this.geo = geo

    const mat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 6
  }

  get count() {
    return this.alive.length
  }

  emit(s: ParticleSpec) {
    if (this.alive.length >= this.max) return
    const p = this.pool.pop() ?? ({} as P)
    p.x = s.x
    p.y = s.y
    p.vx = s.vx
    p.vy = s.vy
    p.life = s.life
    p.max = s.life
    p.size = s.size
    p.r = s.color.r
    p.g = s.color.g
    p.b = s.color.b
    p.a = s.alpha ?? 1
    p.stretch = s.stretch ?? 0.03
    p.drag = s.drag ?? 1.5
    p.grav = s.gravity ?? 0
    p.attract = s.attract ?? null
    p.attractK = s.attractK ?? 0
    p.accel = s.accel ?? 0
    p.shrink = s.shrink ?? true
    this.alive.push(p)
  }

  update(dt: number) {
    const A = this.alive
    for (let i = 0; i < A.length; i++) {
      const p = A[i]
      p.life -= dt
      if (p.life <= 0) {
        this.pool.push(p)
        A[i] = A[A.length - 1]
        A.pop()
        i--
        continue
      }
      if (p.attract) {
        const dx = p.attract.x - p.x
        const dy = p.attract.y - p.y
        p.vx += dx * p.attractK * dt
        p.vy += dy * p.attractK * dt
        if (dx * dx + dy * dy < 36) p.life = Math.min(p.life, 0.04)
      }
      if (p.accel) {
        const k = 1 + p.accel * dt
        p.vx *= k
        p.vy *= k
      }
      const dr = Math.exp(-p.drag * dt)
      p.vx *= dr
      p.vy *= dr
      p.vy += p.grav * dt
      p.x += p.vx * dt
      p.y += p.vy * dt

      const k = p.life / p.max
      const fade = k < 0.35 ? k / 0.35 : 1
      const size = p.shrink ? p.size * (0.35 + 0.65 * k) : p.size
      const speed = Math.hypot(p.vx, p.vy)
      this.aPos[i * 2] = p.x
      this.aPos[i * 2 + 1] = p.y
      this.aVel[i * 2] = p.vx
      this.aVel[i * 2 + 1] = p.vy
      this.aCol[i * 4] = p.r
      this.aCol[i * 4 + 1] = p.g
      this.aCol[i * 4 + 2] = p.b
      this.aCol[i * 4 + 3] = p.a * fade
      this.aSize[i * 2] = size
      this.aSize[i * 2 + 1] = size + speed * p.stretch
    }
    this.geo.instanceCount = A.length
    for (const a of this.attrs) a.needsUpdate = true
  }
}
