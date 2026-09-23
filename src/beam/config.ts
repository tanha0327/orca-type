/* =========================================================
   HADO//ARM — 技と判定のパラメータ
   ========================================================= */

export interface Tier {
  lv: number
  /** この段階に達するのに必要な溜め（秒） */
  min: number
  jp: string
  en: string
  /** 両手の気で撃ったときの技名 */
  kiJp: string
  kiEn: string
  /** 照射時間（秒） */
  duration: number
  /** ビーム芯の太さ（px, 画面倍率前） */
  core: number
  outer: string
  inner: string
  shake: number
  /** 最終段階だけ虹色に割れる */
  prism: boolean
}

/** これ未満で手を開いても発射されない（秒） */
export const MIN_CHARGE = 3
/** 溜めの上限（秒） */
export const MAX_CHARGE = 16
/** 両手の気は片手より速く溜まる */
export const KI_RATE = 1.5

export const TIERS: Tier[] = [
  { lv: 1, min: 3, jp: '光線', en: 'PHOTON RAY', kiJp: '気功波', kiEn: 'KI WAVE', duration: 1.6, core: 16, outer: '#0078ff', inner: '#3ff0ff', shake: 0.22, prism: false },
  { lv: 2, min: 5, jp: '荷電粒子砲', en: 'ION CANNON', kiJp: '双掌波', kiEn: 'TWIN PALM WAVE', duration: 2.4, core: 24, outer: '#3a1cff', inner: '#9a6bff', shake: 0.34, prism: false },
  { lv: 3, min: 7.5, jp: '超電磁砲', en: 'RAILGUN', kiJp: '龍閃波', kiEn: 'DRAGON SURGE', duration: 3.3, core: 32, outer: '#ff0040', inner: '#ff4fa8', shake: 0.48, prism: false },
  { lv: 4, min: 10.5, jp: '終焉ノ光', en: 'SOLAR FLARE', kiJp: '天衝波', kiEn: 'HEAVEN PIERCER', duration: 4.5, core: 42, outer: '#ff3c00', inner: '#ffb300', shake: 0.66, prism: false },
  { lv: 5, min: 14, jp: '虚空断界砲', en: 'VOID//ZERO', kiJp: '零式・虚空波', kiEn: 'ZERO FORM', duration: 6.2, core: 54, outer: '#ffffff', inner: '#f4f0ff', shake: 0.85, prism: true },
]

/** 3 秒未満（発射不可）の溜め色 */
export const PRE_OUTER = '#4d5a6e'
export const PRE_INNER = '#d9e2ef'

/** 溜め量に対応する段階。発射不可なら -1 */
export function tierIndexFor(charge: number): number {
  let idx = -1
  for (let i = 0; i < TIERS.length; i++) if (charge >= TIERS[i].min) idx = i
  return idx
}

/* ---------- 両手の気 ---------- */

/** 手のひら中心の距離 / 手の大きさ がこれ未満で気が発生 */
export const KI_NEAR = 2.2
/** これを超えて離れ続けると気が散る */
export const KI_FAR = 3.8
/** 両腕の向きの差がこれ未満なら「揃った」とみなす（度） */
export const ALIGN_DEG = 24

/** 手を見失ってから溜めを取り消すまで（ms） */
export const LOST_MS = 650

/* ---------- タップ技 ---------- */

export type SkillId = 'bullet' | 'thunder' | 'nova' | 'slash'

export interface Skill {
  id: SkillId
  no: string
  jp: string
  en: string
  color: string
  desc: string
}

export const SKILLS: Skill[] = [
  { id: 'bullet', no: '01', jp: '気弾', en: 'KI BULLET', color: '#6cf6ff', desc: '手元からタップ地点へ' },
  { id: 'thunder', no: '02', jp: '雷撃', en: 'THUNDER', color: '#a9c4ff', desc: '天から落雷' },
  { id: 'nova', no: '03', jp: '爆裂', en: 'NOVA', color: '#ff7a1a', desc: 'その場で爆発' },
  { id: 'slash', no: '04', jp: '斬撃', en: 'SLASH', color: '#ff3df0', desc: 'タップで十字 / なぞって斬る' },
]

/* ---------- モデル ---------- */

export const MODEL_URLS = {
  gesture:
    'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task',
  pose: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
}
