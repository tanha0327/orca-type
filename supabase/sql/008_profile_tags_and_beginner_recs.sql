-- プロフィールに「持っているキーボード」と「分割初心者（🔰）」のタグを、
-- みんなの配列に「分割初心者におすすめ」を追加する。
-- Supabase ダッシュボードの SQL Editor に貼り付けて実行してください。
--
-- 既存のテーブルには手を入れず、新しいテーブルを 2 つ足すだけなので、今の main のコードはそのまま動く。
-- profiles（表示名・アイコン）は本人しか読めないままにして、ほかの人に見せてよいものだけを profile_tags に置く。

-- 1) プロフィールの公開タグ（ユーザーごとに最大 1 行。行が無い人はタグ未設定）
create table if not exists public.profile_tags (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- 持っているキーボード。アプリの一覧にあるものはその ID（keychron-orca-echo など）、無いものは入力された名前
  keyboards text[] not null default '{}',
  -- 分割キーボード初心者。名前の横に 🔰 を出し、みんなの配列で初心者におすすめの配列を見せる
  split_beginner boolean not null default false,
  updated_at timestamptz not null default now(),
  -- アプリ側は 12 台・1 台 40 文字までにしているが、API を直接叩かれても巨大な配列を入れられないよう DB でも上限を付ける
  constraint profile_tags_keyboards_limit check (
    cardinality(keyboards) <= 20 and char_length(array_to_string(keyboards, '')) <= 1000
  )
);

alter table public.profile_tags enable row level security;

drop policy if exists "profile_tags_select_all" on public.profile_tags;
create policy "profile_tags_select_all"
  on public.profile_tags for select
  using (true);

drop policy if exists "profile_tags_insert_own" on public.profile_tags;
create policy "profile_tags_insert_own"
  on public.profile_tags for insert
  with check (auth.uid() = user_id);

drop policy if exists "profile_tags_update_own" on public.profile_tags;
create policy "profile_tags_update_own"
  on public.profile_tags for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- タグはログインしていない人にも見せるので anon にも select を付ける。
-- 書き込みは本人の行だけ（*_own のポリシー）。アプリは upsert するので insert と update の両方が要る
grant select on public.profile_tags to anon, authenticated;
grant insert, update on public.profile_tags to authenticated;

-- 2) 分割初心者におすすめ（いいねと同じ作りで、投稿ごと・ユーザーごとに 1 つ）。
--    投稿者が投稿するときに付けることも、ほかの人があとから付けることもできる
create table if not exists public.keymap_beginner_recs (
  keymap_id uuid not null references public.shared_keymaps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (keymap_id, user_id)
);

alter table public.keymap_beginner_recs enable row level security;

drop policy if exists "keymap_beginner_recs_select_all" on public.keymap_beginner_recs;
create policy "keymap_beginner_recs_select_all"
  on public.keymap_beginner_recs for select
  using (true);

drop policy if exists "keymap_beginner_recs_insert_own" on public.keymap_beginner_recs;
create policy "keymap_beginner_recs_insert_own"
  on public.keymap_beginner_recs for insert
  with check (auth.uid() = user_id);

drop policy if exists "keymap_beginner_recs_delete_own" on public.keymap_beginner_recs;
create policy "keymap_beginner_recs_delete_own"
  on public.keymap_beginner_recs for delete
  using (auth.uid() = user_id);

-- おすすめの数はログインしていない人にも見せる。付ける・外すのは本人の行だけ
grant select on public.keymap_beginner_recs to anon, authenticated;
grant insert, delete on public.keymap_beginner_recs to authenticated;
