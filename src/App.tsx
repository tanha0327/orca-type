import { useEffect, useState } from 'react'
import { KeyboardView } from './components/Board/KeyboardView'
import { ExportView } from './components/Export/ExportView'
import { FeedView } from './components/Feed/FeedView'
import { Hud } from './components/Hud/Hud'
import { LayerBar } from './components/LayerBar/LayerBar'
import { PipPortal } from './components/PipHost/PipPortal'
import { usePipWindow } from './components/PipHost/usePipWindow'
import { CODE_TO_KEY } from './data/layout'
import { BODY_COLOR_LABEL, TRACKBALL_COLOR_GRADIENT, type BodyColor } from './data/types'
import { isTypingTarget, useKeyCapture, useResetOnCaptureOff } from './engine/useEngine'
import { authEnabled, profileFromUser, signInWithGoogle, signOut } from './lib/auth'
import { useAuthStore } from './store/authStore'
import { useKeymapStore, type ViewId } from './store/keymapStore'

const BODY_COLORS: BodyColor[] = ['white', 'black']

const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'edit', label: '編集' },
  { id: 'feed', label: 'みんなの配列' },
  { id: 'export', label: '書き出し' },
]

export function App() {
  const view = useKeymapStore((s) => s.view)
  const setView = useKeymapStore((s) => s.setView)
  const capture = useKeymapStore((s) => s.captureEnabled)
  const setCapture = useKeymapStore((s) => s.setCapture)
  const comboPickId = useKeymapStore((s) => s.comboPickId)
  const setComboPick = useKeymapStore((s) => s.setComboPick)
  const toggleComboKey = useKeymapStore((s) => s.toggleComboKey)
  const bodyColor = useKeymapStore((s) => s.keymap.settings.bodyColor) ?? 'white'
  const setSettings = useKeymapStore((s) => s.setSettings)
  const [subLegends, setSubLegends] = useState(false)
  const initAuth = useAuthStore((s) => s.init)

  const pip = usePipWindow({ width: 380, height: 620 })

  useKeyCapture(typeof document !== 'undefined' ? document : null)
  useResetOnCaptureOff()

  useEffect(() => { initAuth() }, [initAuth])

  // コンボの参加キーを選んでいる間は、手元のキーボードのキーでも盤面のキーを追加／解除できる
  useEffect(() => {
    if (!comboPickId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || isTypingTarget(e.target)) return
      const keyId = CODE_TO_KEY[e.code]
      if (!keyId) return
      e.preventDefault()
      toggleComboKey(comboPickId, keyId)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [comboPickId, toggleComboKey])

  // 編集画面では ← → と数字キーで編集中のレイヤーを切り替えられる
  // （入力キャプチャ中は数字キーが M1〜M3 の打鍵テストと被るので、キャプチャ OFF のときだけ）
  useEffect(() => {
    if (view !== 'edit' || capture || comboPickId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || isTypingTarget(e.target)) return
      const { editingLayer, keymap, setEditingLayer, keyMenuOpen } = useKeymapStore.getState()
      // キーのクイック編集メニューを開いている間は、数字キーを編集内容の入力に使うのでレイヤー切替はしない
      if (keyMenuOpen) return
      const layerCount = keymap.layers.length
      if (e.key === 'ArrowRight') { setEditingLayer((editingLayer + 1) % layerCount); return }
      if (e.key === 'ArrowLeft') { setEditingLayer((editingLayer - 1 + layerCount) % layerCount); return }
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 0 && n < layerCount) setEditingLayer(n)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, capture, comboPickId])

  // PiP を開いたら自動でキャプチャを入れる（HUD が空だと意味がないので）
  useEffect(() => { if (pip.win && !capture) setCapture(true) }, [pip.win, capture, setCapture])

  return (
    <div className="min-h-full">
      <Header
        view={view}
        onView={setView}
        capture={capture}
        onCapture={setCapture}
        pipOn={!!pip.win}
        pipSupported={pip.supported}
        onPip={pip.toggle}
      />

      {pip.error && (
        <p className="mx-auto max-w-[1500px] px-4">
          <span className="nb mt-3 block p-2.5 text-[0.8rem] font-bold" style={{ background: 'var(--color-pink)' }}>
            {pip.error}
          </span>
        </p>
      )}

      {comboPickId && (
        <div className="mx-auto max-w-[1500px] px-4">
          <div
            className="nb mt-3 flex flex-wrap items-center gap-2 p-2.5"
            style={{ background: 'var(--color-purple)' }}
          >
            <span className="text-[0.82rem] font-black">
              コンボに入れるキーを、盤面でクリックするか、手元のキーボードで押してください
            </span>
            <span className="flex-1" />
            <button type="button" className="nb-btn !py-1.5 text-[0.78rem]" onClick={() => setComboPick(null)}>
              選択を終える
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto grid max-w-[1500px] gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          {view === 'edit' && (
            <section className="nb nb-lg p-4">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-[1.35rem]">Keychron Orca echo</h2>
                  <p className="mt-1 text-[0.76rem] font-bold leading-relaxed opacity-70">
                    キーをクリックで選択・ダブルクリックで試し打ち。
                    ホイールとパッドはドラッグ／スクロールで動かせます。
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex items-center gap-1" role="group" aria-label="キーボード本体の色">
                    {BODY_COLORS.map((c) => (
                      <BodyColorSwatch
                        key={c}
                        color={c}
                        active={bodyColor === c}
                        onClick={() => setSettings({ bodyColor: c })}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="nb-btn shrink-0 !py-1.5 text-[0.76rem]"
                    data-active={subLegends}
                    onClick={() => setSubLegends((v) => !v)}
                  >
                    重ね印字
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[520px]">
                  <KeyboardView subLegends={subLegends} />
                </div>
              </div>
              <Legend />
            </section>
          )}
          {view === 'feed' && <FeedView />}
          {view === 'export' && <ExportView />}
        </div>

        <aside className="min-w-0">
          <div className="flex flex-col gap-4 lg:sticky lg:top-[5.5rem] lg:h-[calc(100vh-7rem)]">
            <div className="nb nb-lg min-h-[22rem] overflow-hidden lg:min-h-0 lg:flex-[1.15]">
              {pip.win ? <PipPlaceholder onClose={pip.close} /> : <Hud />}
            </div>
            <div className="min-h-0 lg:flex-1 lg:overflow-y-auto">
              <LayerBar />
            </div>
          </div>
        </aside>
      </main>

      <PipPortal win={pip.win}>
        <Hud variant="pip" />
      </PipPortal>

      <footer className="mx-auto max-w-[1500px] px-4 pb-8 pt-2">
        <p className="text-[0.7rem] font-bold leading-relaxed opacity-55">
          ORCA TYPE は Keychron Orca echo のキーマップを設計するための非公式のコンセプトサイトです。
          実機には接続せず、手元のキーボードの入力を読み替えてシミュレートしています。
          Keychron / GIZMART とは関係ありません。
        </p>
      </footer>
    </div>
  )
}

function Header({
  view, onView, capture, onCapture, pipOn, pipSupported, onPip,
}: {
  view: ViewId
  onView: (v: ViewId) => void
  capture: boolean
  onCapture: (on: boolean) => void
  pipOn: boolean
  pipSupported: boolean
  onPip: () => void
}) {
  return (
    <header
      className="sticky top-0 z-30 border-b-[3px] border-[var(--color-ink)]"
      style={{ background: 'var(--color-bg)' }}
    >
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-3 gap-y-2 p-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-[1.5rem] leading-none">ORCA TYPE</h1>
          <span className="nb-eyebrow hidden sm:inline">KEYMAP STUDIO</span>
        </div>

        <nav className="flex flex-wrap gap-1.5" aria-label="表示切替">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className="nb-btn !py-1.5 text-[0.8rem]"
              data-active={view === v.id}
              onClick={() => onView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </nav>

        <span className="flex-1" />

        <AuthButton />

        <button
          type="button"
          className="nb-btn !py-2 text-[0.82rem]"
          onClick={onPip}
          disabled={!pipSupported}
          data-active={pipOn}
          title={pipSupported ? '出力 HUD を常に最前面のウィンドウで表示します' : 'Chrome / Edge でご利用ください'}
        >
          ⧉ {pipOn ? 'PiP を閉じる' : 'PiP で常時表示'}
        </button>

        <button
          type="button"
          className="nb-btn !py-2 text-[0.85rem]"
          style={{ background: capture ? 'var(--color-lime)' : 'var(--color-paper)' }}
          onClick={() => onCapture(!capture)}
          aria-pressed={capture}
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: capture ? 'var(--color-ink)' : 'transparent', border: '2px solid var(--color-ink)' }}
          />
          入力キャプチャ {capture ? 'ON' : 'OFF'}
        </button>
      </div>
    </header>
  )
}

function AuthButton() {
  const user = useAuthStore((s) => s.user)
  const initializing = useAuthStore((s) => s.initializing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!authEnabled() || initializing) return null

  const doSignIn = async () => {
    setError(null)
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ログインに失敗しました')
      setBusy(false)
    }
  }

  if (!user) {
    return (
      <div className="relative">
        <button type="button" className="nb-btn !py-2 text-[0.82rem]" onClick={() => void doSignIn()} disabled={busy}>
          G Google でログイン
        </button>
        {error && (
          <p
            className="nb absolute right-0 top-full z-20 mt-1.5 w-56 p-2 text-[0.72rem] font-bold"
            style={{ background: 'var(--color-pink)' }}
          >
            {error}
          </p>
        )}
      </div>
    )
  }

  const { name, avatarUrl } = profileFromUser(user)

  return (
    <div className="nb flex items-center gap-2 !py-1 !px-2">
      {avatarUrl
        ? <img src={avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full" style={{ border: '2px solid var(--color-ink)' }} />
        : <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-black" style={{ background: 'var(--color-lime)', border: '2px solid var(--color-ink)' }}>{name.slice(0, 1)}</span>}
      <span className="max-w-[8rem] truncate text-[0.78rem] font-bold">{name}</span>
      <button type="button" className="nb-btn !py-1 !px-2 text-[0.72rem]" onClick={() => void signOut()}>
        ログアウト
      </button>
    </div>
  )
}

function PipPlaceholder({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center"
      style={{ background: 'var(--color-ink)', color: 'var(--color-paper)' }}
    >
      <p className="text-[2rem] leading-none">⧉</p>
      <h3 className="text-[1.05rem]">HUD は PiP ウィンドウに出ています</h3>
      <p className="text-[0.78rem] font-bold leading-relaxed opacity-70">
        別ウィンドウが常に最前面に表示されます。
        他のアプリで作業しながら、打鍵の出力を確認できます。
      </p>
      <button type="button" className="nb-btn !py-2 text-[0.8rem]" onClick={onClose}>
        ここに戻す
      </button>
    </div>
  )
}

function BodyColorSwatch({
  color, active, onClick,
}: {
  color: BodyColor
  active: boolean
  onClick: () => void
}) {
  const [hi, mid, lo] = TRACKBALL_COLOR_GRADIENT[color]
  return (
    <button
      type="button"
      title={`本体色: ${BODY_COLOR_LABEL[color]}`}
      aria-label={`本体色を${BODY_COLOR_LABEL[color]}にする`}
      aria-pressed={active}
      onClick={onClick}
      className="block h-6 w-6 rounded-full"
      style={{
        background: `radial-gradient(circle at 32% 28%, ${hi} 0%, ${mid} 42%, ${lo} 100%)`,
        border: `${active ? 3 : 2}px solid var(--color-ink)`,
        boxShadow: active ? '2px 2px 0 var(--color-ink)' : '1px 1px 0 var(--color-ink)',
        transform: active ? 'translate(-1px, -1px)' : undefined,
      }}
    />
  )
}

function Legend() {
  const items: [string, string][] = [
    ['var(--color-pink)', '長押し（MOD-TAP）の出力'],
    ['var(--color-purple)', 'コンボに参加しているキー'],
    ['var(--color-orange)', 'アクセントキーキャップ'],
  ]
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map(([color, label]) => (
        <li key={label} className="flex items-center gap-1.5 text-[0.7rem] font-bold opacity-70">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: color, border: '2px solid var(--color-ink)' }}
          />
          {label}
        </li>
      ))}
    </ul>
  )
}
