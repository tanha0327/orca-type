import { useSyncExternalStore } from 'react'

/** Tailwind の sm と同じ幅 */
export const SM_QUERY = '(min-width: 640px)'

/** メディアクエリに今の画面幅が当てはまるか。幅が変わると再描画する */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => true,
  )
}
