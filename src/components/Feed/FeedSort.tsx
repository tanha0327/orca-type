import type { ReactNode } from 'react'
import type { FeedSort } from '../../lib/feed'
import { useFeedStore } from '../../store/feedStore'
import { IconFlame, IconHeart, IconHistory, IconSparkle } from '../Icons'

interface SortOption {
  id: FeedSort
  label: string
  /** カード右上の英字タグ */
  tag: string
  help: string
  color: string
  icon: (size: number) => ReactNode
}

export const SORT_OPTIONS: SortOption[] = [
  {
    id: 'hot', label: '今熱い', tag: 'HOT', help: '最近いいね・コメントが集まっている順',
    color: 'var(--color-orange)', icon: (s) => <IconFlame size={s} />,
  },
  {
    id: 'popular', label: '人気', tag: 'TOP', help: 'いいねが多い順',
    color: 'var(--color-pink)', icon: (s) => <IconHeart size={s} />,
  },
  {
    id: 'new', label: '新しい順', tag: 'NEW', help: '投稿が新しい順',
    color: 'var(--color-lime)', icon: (s) => <IconSparkle size={s} />,
  },
  {
    id: 'old', label: '古い順', tag: 'OLD', help: '投稿が古い順',
    color: 'var(--color-cyan)', icon: (s) => <IconHistory size={s} />,
  },
]

export function sortOption(id: FeedSort): SortOption {
  return SORT_OPTIONS.find((o) => o.id === id) ?? SORT_OPTIONS[0]
}

/** サイド列（編集画面ではレイヤー一覧がある場所）に置く、フォルダ型カードの並び替え */
export function SortPanel() {
  const sort = useFeedStore((s) => s.sort)
  const setSort = useFeedStore((s) => s.setSort)

  return (
    <section aria-label="並び替え">
      <div className="mb-1 flex items-end justify-between gap-3">
        <h2 className="text-[1.35rem] sm:text-[1.6rem]">並び替え</h2>
        <p className="nb-eyebrow">SORT</p>
      </div>
      <p className="mb-1 text-[0.68rem] font-bold opacity-70">{sortOption(sort).help}</p>

      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
        {SORT_OPTIONS.map((o) => {
          const active = sort === o.id
          return (
            <div
              key={o.id}
              className="nb-folder"
              style={{
                // @ts-expect-error CSS カスタムプロパティ
                '--tab-color': o.color,
              }}
            >
              <button
                type="button"
                onClick={() => setSort(o.id)}
                className="nb-btn !block w-full !p-0 text-left"
                style={{
                  background: active ? o.color : 'var(--color-paper)',
                  transform: active ? 'translate(3px, 3px)' : undefined,
                  boxShadow: active ? '1px 1px 0 var(--color-ink)' : undefined,
                }}
                aria-pressed={active}
                title={o.help}
              >
                <div className="flex items-center gap-2 p-2">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px]"
                    style={{ background: active ? 'var(--color-paper)' : o.color, border: '3px solid var(--color-ink)' }}
                  >
                    {o.icon(18)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block font-mono text-[0.6rem] font-black leading-none opacity-60">{o.tag}</span>
                    <span className="mt-1 block truncate text-[0.95rem] font-black leading-none">{o.label}</span>
                  </div>
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** スマホなどサイド列が下に回る幅では、タイムラインの上に横並びで出す */
export function SortBar() {
  const sort = useFeedStore((s) => s.sort)
  const setSort = useFeedStore((s) => s.setSort)

  return (
    <div className="grid grid-cols-4 gap-2" role="group" aria-label="並び替え">
      {SORT_OPTIONS.map((o) => {
        const active = sort === o.id
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => setSort(o.id)}
            aria-pressed={active}
            title={o.help}
            className="nb-btn !flex-col !gap-0.5 !px-1 !py-1.5 text-[0.7rem]"
            style={{ background: active ? o.color : 'var(--color-paper)' }}
          >
            {o.icon(16)}
            <span className="whitespace-nowrap">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
