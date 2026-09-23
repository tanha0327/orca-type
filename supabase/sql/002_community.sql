-- Google ログイン対応のコミュニティ機能（いいね・コメント）を追加する。
-- Supabase ダッシュボードの SQL Editor に貼り付けて実行してください。
-- 事前に Authentication > Providers で Google を有効化しておく必要があります。

-- 1) 既存の shared_keymaps に、投稿者のユーザー ID とアイコン URL を追加
alter table public.shared_keymaps
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists avatar_url text;

-- 2) いいね
create table if not exists public.keymap_likes (
  keymap_id uuid not null references public.shared_keymaps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (keymap_id, user_id)
);

alter table public.keymap_likes enable row level security;

drop policy if exists "keymap_likes_select_all" on public.keymap_likes;
create policy "keymap_likes_select_all"
  on public.keymap_likes for select
  using (true);

drop policy if exists "keymap_likes_insert_own" on public.keymap_likes;
create policy "keymap_likes_insert_own"
  on public.keymap_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "keymap_likes_delete_own" on public.keymap_likes;
create policy "keymap_likes_delete_own"
  on public.keymap_likes for delete
  using (auth.uid() = user_id);

-- 3) コメント
create table if not exists public.keymap_comments (
  id uuid primary key default gen_random_uuid(),
  keymap_id uuid not null references public.shared_keymaps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  avatar_url text,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.keymap_comments enable row level security;

drop policy if exists "keymap_comments_select_all" on public.keymap_comments;
create policy "keymap_comments_select_all"
  on public.keymap_comments for select
  using (true);

drop policy if exists "keymap_comments_insert_own" on public.keymap_comments;
create policy "keymap_comments_insert_own"
  on public.keymap_comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "keymap_comments_delete_own" on public.keymap_comments;
create policy "keymap_comments_delete_own"
  on public.keymap_comments for delete
  using (auth.uid() = user_id);

create index if not exists keymap_comments_keymap_id_idx on public.keymap_comments (keymap_id);
create index if not exists keymap_likes_keymap_id_idx on public.keymap_likes (keymap_id);
