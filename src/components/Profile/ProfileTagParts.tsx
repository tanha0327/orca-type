import { useState } from 'react'
import {
  catalogKeyboard, KEYBOARD_CATALOG, keyboardLabel, keyboardValueFromInput, MAX_KEYBOARD_NAME, MAX_OWNED_KEYBOARDS,
  sameKeyboard,
} from '../../data/keyboardCatalog'
import { useProfileTags } from '../../store/profileTagsStore'

/* プロフィールの公開タグ（持っているキーボード・分割初心者）を見せる部品と、プロフィール編集の欄 */

/** 名前の横に付ける 🔰（分割キーボード初心者のタグを付けている人だけ） */
export function BeginnerBadge({ userId }: { userId: string | null | undefined }) {
  const tags = useProfileTags(userId)
  if (!tags?.splitBeginner) return null
  return (
    <span
      className="shrink-0 text-[0.8rem] leading-none"
      role="img"
      title="分割キーボード初心者"
      aria-label="分割キーボード初心者"
    >
      🔰
    </span>
  )
}

/** 持っているキーボードの一覧。分割キーボードとそれ以外に分けて出す */
export function OwnedKeyboardList({ keyboards }: { keyboards: string[] }) {
  const split = keyboards.filter((k) => catalogKeyboard(k)?.split)
  const others = keyboards.filter((k) => !catalogKeyboard(k)?.split)
  const group = (label: string, list: string[], tone: string) => list.length > 0 && (
    <div>
      <p className="text-[0.68rem] font-black opacity-55">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {list.map((k) => (
          <span key={k} className="nb-chip !whitespace-normal" style={{ background: tone }}>⌨ {keyboardLabel(k)}</span>
        ))}
      </div>
    </div>
  )
  return (
    <div className="space-y-2">
      {group('分割キーボード', split, 'var(--color-sand)')}
      {group(split.length > 0 ? 'そのほか' : 'キーボード', others, 'var(--color-paper)')}
    </div>
  )
}

/** プロフィール編集の「持っているキーボード」。一覧から選ぶか、一覧に無いものは名前を入れて足す */
export function OwnedKeyboardsField({
  value, onChange,
}: {
  value: string[]
  onChange: (keyboards: string[]) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const full = value.length >= MAX_OWNED_KEYBOARDS
  const has = (v: string) => value.some((k) => sameKeyboard(k, v))
  const remove = (v: string) => onChange(value.filter((k) => !sameKeyboard(k, v)))
  const add = (v: string) => { if (!has(v) && !full) onChange([...value, v]) }
  const toggle = (v: string) => (has(v) ? remove(v) : add(v))

  const addDraft = () => {
    const v = keyboardValueFromInput(draft)
    if (!v) return
    add(v)
    setDraft('')
  }

  const catalogGroup = (label: string, split: boolean) => (
    <div>
      <p className="text-[0.68rem] font-black opacity-55">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {KEYBOARD_CATALOG.filter((k) => k.split === split).map((k) => {
          const on = has(k.id)
          return (
            <button
              key={k.id}
              type="button"
              className="nb-chip"
              style={{ background: on ? 'var(--color-lime)' : 'var(--color-paper)' }}
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => toggle(k.id)}
            >
              {on ? '✓ ' : ''}{k.name}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div>
      <span className="nb-eyebrow">持っているキーボード</span>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {value.map((k) => (
          <button
            key={k}
            type="button"
            className="nb-chip !whitespace-normal"
            style={{ background: catalogKeyboard(k)?.split ? 'var(--color-sand)' : 'var(--color-paper)' }}
            title="押すと外します"
            aria-label={`${keyboardLabel(k)} を外す`}
            onClick={() => remove(k)}
          >
            ⌨ {keyboardLabel(k)} <span aria-hidden className="opacity-60">×</span>
          </button>
        ))}
        {value.length === 0 && (
          <span className="text-[0.74rem] font-bold opacity-55">まだ登録していません</span>
        )}
      </div>

      <button
        type="button"
        className="nb-btn mt-2 w-full !py-1.5 text-[0.78rem]"
        aria-expanded={pickerOpen}
        onClick={() => setPickerOpen((o) => !o)}
      >
        {pickerOpen ? '一覧を閉じる' : '＋ キーボードを追加'}
      </button>

      {pickerOpen && (
        <div className="nb nb-flat mt-2 space-y-2.5 p-2.5">
          {catalogGroup('分割キーボード', true)}
          {catalogGroup('一体型のキーボード', false)}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); addDraft() }}
          >
            <input
              className="nb-input min-w-0 flex-1 !py-1.5 text-[0.78rem]"
              value={draft}
              maxLength={MAX_KEYBOARD_NAME}
              placeholder="一覧に無いキーボードの名前"
              aria-label="一覧に無いキーボードの名前"
              disabled={full}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button
              type="submit"
              className="nb-btn shrink-0 !py-1.5 text-[0.76rem]"
              disabled={full || !draft.trim()}
            >
              追加
            </button>
          </form>
          {full && (
            <p className="text-[0.7rem] font-bold opacity-60">
              登録できるのは {MAX_OWNED_KEYBOARDS} 台までです。増やすときは、上のキーボードを押して外してください。
            </p>
          )}
        </div>
      )}

      <p className="mt-1.5 text-[0.7rem] font-bold leading-relaxed opacity-55">
        みんなの配列で、あなたのアイコンを押した人に表示されます。
      </p>
    </div>
  )
}

/** プロフィール編集の「分割キーボード初心者」のスイッチ */
export function SplitBeginnerField({
  value, onChange,
}: {
  value: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <div>
      <span className="nb-eyebrow">分割キーボード歴</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        className="nb nb-flat mt-1.5 flex w-full items-center gap-3 p-2.5 text-left"
        style={{ background: value ? 'color-mix(in srgb, var(--color-lime) 45%, var(--color-paper))' : 'var(--color-paper)' }}
        onClick={() => onChange(!value)}
      >
        <span aria-hidden className="shrink-0 text-[1.5rem] leading-none">🔰</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.86rem] font-black">分割キーボード初心者</span>
          <span className="mt-0.5 block text-[0.7rem] font-bold leading-relaxed opacity-70">
            名前の横に 🔰 が付き、みんなの配列の上に「初心者におすすめ」の配列が出ます。
            慣れている人からコメントでアドバイスをもらいやすくなります。
          </span>
        </span>
        <span
          aria-hidden
          className="relative h-6 w-11 shrink-0 rounded-full"
          style={{
            border: '3px solid var(--color-ink)',
            background: value ? 'var(--color-ink)' : 'var(--color-paper)',
          }}
        >
          <span
            className="absolute top-[2px] h-3.5 w-3.5 rounded-full transition-[left] duration-100"
            style={{
              left: value ? 'calc(100% - 1rem)' : '2px',
              background: value ? 'var(--color-lime)' : 'var(--color-ink)',
            }}
          />
        </span>
      </button>
    </div>
  )
}
