-- 自分の投稿（shared_keymaps）を削除できるようにする。
-- Supabase ダッシュボードの SQL Editor に貼り付けて実行してください。
-- keymap_likes / keymap_comments は on delete cascade なので、投稿の削除に合わせて自動で消えます。
--
-- shared_keymaps の RLS がまだ設定されていない環境でも安全に流せるよう、
-- 閲覧・投稿までまとめて定義し直す（既存ポリシーは一旦削除して作り直す）。

alter table public.shared_keymaps enable row level security;

drop policy if exists "shared_keymaps_select_all" on public.shared_keymaps;
create policy "shared_keymaps_select_all"
  on public.shared_keymaps for select
  using (true);

-- user_id は未ログイン投稿では null、ログイン投稿では本人の auth.uid() のみ許可
drop policy if exists "shared_keymaps_insert_any" on public.shared_keymaps;
create policy "shared_keymaps_insert_any"
  on public.shared_keymaps for insert
  with check (user_id is null or auth.uid() = user_id);

drop policy if exists "shared_keymaps_delete_own" on public.shared_keymaps;
create policy "shared_keymaps_delete_own"
  on public.shared_keymaps for delete
  using (auth.uid() = user_id);
