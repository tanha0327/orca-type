import { GestureRecognizer, PoseLandmarker } from '@mediapipe/tasks-vision'
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import { MODEL_URLS } from '../config'
import { type PoseArm, type TrackFrame, type Viewport, attachArms, buildHand, parseArms } from './hand'

export type LoadStep = 'gesture' | 'pose' | 'runtime'
export type Progress = (step: LoadStep, ratio: number, note?: string) => void

async function fetchModel(url: string, onRatio: (r: number) => void): Promise<Uint8Array> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const total = Number(res.headers.get('content-length')) || 0
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer())
    onRatio(1)
    return buf
  }
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.length
    if (total) onRatio(Math.min(1, loaded / total))
  }
  const out = new Uint8Array(loaded)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  onRatio(1)
  return out
}

/** GPU で作れなければ CPU で作り直す */
async function withDelegate<T>(make: (d: 'GPU' | 'CPU') => Promise<T>): Promise<{ task: T; delegate: 'GPU' | 'CPU' }> {
  try {
    return { task: await make('GPU'), delegate: 'GPU' }
  } catch (e) {
    console.warn('[tracker] GPU delegate failed, falling back to CPU', e)
    return { task: await make('CPU'), delegate: 'CPU' }
  }
}

export class Tracker {
  gesture: GestureRecognizer | null = null
  pose: PoseLandmarker | null = null
  delegate: 'GPU' | 'CPU' = 'GPU'
  /** 推論 1 回あたりの平均時間（ms） */
  infMs = 0
  private lastVideoTime = -1
  private lastTs = 0
  private frameNo = 0
  private poseEvery = 1
  private lastArms: PoseArm[] = []
  private stream: MediaStream | null = null

  constructor(readonly video: HTMLVideoElement) {}

  get ready() {
    return !!this.gesture
  }

  async startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('INSECURE')
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      audio: false,
    })
    this.video.srcObject = this.stream
    this.video.muted = true
    this.video.playsInline = true
    await this.video.play()
    if (!this.video.videoWidth) {
      await new Promise<void>((r) => this.video.addEventListener('loadedmetadata', () => r(), { once: true }))
    }
  }

  async loadModels(progress: Progress) {
    const fileset = { wasmLoaderPath, wasmBinaryPath }
    const [gBuf, pBuf] = await Promise.all([
      fetchModel(MODEL_URLS.gesture, (r) => progress('gesture', r)),
      fetchModel(MODEL_URLS.pose, (r) => progress('pose', r)).catch((e) => {
        console.warn('[tracker] pose model unavailable', e)
        progress('pose', 1, 'SKIPPED')
        return null
      }),
    ])
    progress('runtime', 0)
    const g = await withDelegate((delegate) =>
      GestureRecognizer.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer: gBuf, delegate },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      }),
    )
    this.gesture = g.task
    this.delegate = g.delegate
    if (pBuf) {
      try {
        const p = await withDelegate((delegate) =>
          PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetBuffer: pBuf, delegate },
            runningMode: 'VIDEO',
            numPoses: 1,
          }),
        )
        this.pose = p.task
      } catch (e) {
        console.warn('[tracker] pose init failed', e)
      }
    }
    progress('runtime', 1, this.delegate)
  }

  /** 新しい映像フレームがあれば推論する。なければ null */
  detect(now: number, W: number, H: number): TrackFrame | null {
    const v = this.video
    if (!this.gesture || v.readyState < 2 || !v.videoWidth) return null
    if (v.currentTime === this.lastVideoTime) return null
    this.lastVideoTime = v.currentTime
    const ts = Math.max(now, this.lastTs + 1)
    this.lastTs = ts
    const vp: Viewport = { W, H, vw: v.videoWidth, vh: v.videoHeight }

    const t0 = performance.now()
    const g = this.gesture.recognizeForVideo(v, ts)
    if (this.pose && this.frameNo % this.poseEvery === 0) {
      const p = this.pose.detectForVideo(v, ts)
      this.lastArms = parseArms(p.landmarks[0], vp)
    }
    this.frameNo++
    const ms = performance.now() - t0
    this.infMs = this.infMs ? this.infMs * 0.9 + ms * 0.1 : ms
    // 重い端末ではポーズ推論を 1 フレームおきにする
    if (this.infMs > 30) this.poseEvery = 2
    else if (this.infMs < 16) this.poseEvery = 1

    const hands = g.landmarks.map((lms, i) => buildHand(lms, g.worldLandmarks[i], g.gestures[i], g.handedness[i], vp))
    attachArms(hands, this.lastArms)
    return { t: now, hands, arms: this.lastArms }
  }
}
