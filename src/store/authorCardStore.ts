import { create } from 'zustand'

/** カードに出す投稿者。名前とアイコンは、投稿・コメントに記録されているものをそのまま使う */
export interface AuthorSummary {
  userId: string
  name: string
  avatarUrl: string | null
}

interface AuthorCardState {
  author: AuthorSummary | null
  open: (author: AuthorSummary) => void
  close: () => void
}

/**
 * みんなの配列の投稿・コメントのどこからでも、同じ投稿者のカードを開けるようにする。
 * カード（AuthorCardModal）は開いたときに読み込むので、開くための状態はカードとは別のファイルに置く
 */
export const useAuthorCardStore = create<AuthorCardState>((set) => ({
  author: null,
  open: (author) => set({ author }),
  close: () => set({ author: null }),
}))
