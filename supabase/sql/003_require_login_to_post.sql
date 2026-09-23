-- 「みんなの配列」への投稿を、ログインしたユーザーだけに限定する。
-- Supabase ダッシュボードの SQL Editor に貼り付けて実行してください。
--
-- これまで shared_keymaps は未ログインでも投稿できる設計で、
-- ダッシュボード側に「誰でも投稿可」の INSERT ポリシー（public insert /
-- shared_keymaps_insert_any など）が作られていた。アプリ側でログインを
-- 必須にしたので、こちらも auth.uid() = user_id を要求する形に統一する。
-- 既存の未ログイン投稿（user_id が null の行）はそのまま残る。

alter table public.shared_keymaps enable row level security;

drop policy if exists "public insert" on public.shared_keymaps;
drop policy if exists "shared_keymaps_insert_any" on public.shared_keymaps;
drop policy if exists "Enable insert for all users" on public.shared_keymaps;

drop policy if exists "shared_keymaps_insert_own" on public.shared_keymaps;
create policy "shared_keymaps_insert_own"
  on public.shared_keymaps for insert
  with check (auth.uid() = user_id);
