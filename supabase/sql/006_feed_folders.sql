-- みんなの配列の「フォルダ」機能を追加する。
-- Supabase ダッシュボードの SQL Editor に貼り付けて実行してください。
--
-- 1) 投稿のカテゴリ（全員共通のフォルダ）。投稿時にアプリが配列の特徴から自動判定し、
--    投稿者が変更もできる。既存の投稿は null のままで、アプリ側で自動判定して振り分ける。
-- 2) 自分用のフォルダ。気に入った投稿を保存して整理する（本人しか見えない）。

-- 1) 投稿のカテゴリ
alter table public.shared_keymaps
  add column if not exists category text;

alter table public.shared_keymaps drop constraint if exists shared_keymaps_category_valid;
alter table public.shared_keymaps
  add constraint shared_keymaps_category_valid check (
    category is null
    or category in ('homerow', 'vim', 'combo', 'mouse', 'multilayer', 'minimal', 'standard')
  );

-- 2) 自分用のフォルダ
create table if not exists public.keymap_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

alter table public.keymap_folders enable row level security;

drop policy if exists "keymap_folders_select_own" on public.keymap_folders;
create policy "keymap_folders_select_own"
  on public.keymap_folders for select
  using (auth.uid() = user_id);

drop policy if exists "keymap_folders_insert_own" on public.keymap_folders;
create policy "keymap_folders_insert_own"
  on public.keymap_folders for insert
  with check (auth.uid() = user_id);

drop policy if exists "keymap_folders_update_own" on public.keymap_folders;
create policy "keymap_folders_update_own"
  on public.keymap_folders for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "keymap_folders_delete_own" on public.keymap_folders;
create policy "keymap_folders_delete_own"
  on public.keymap_folders for delete
  using (auth.uid() = user_id);

create index if not exists keymap_folders_user_id_idx on public.keymap_folders (user_id);

-- 3) フォルダの中身。position はフォルダ内の手動の並び順（小さいほど上）
create table if not exists public.keymap_folder_items (
  folder_id uuid not null references public.keymap_folders(id) on delete cascade,
  keymap_id uuid not null references public.shared_keymaps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (folder_id, keymap_id)
);

alter table public.keymap_folder_items enable row level security;

drop policy if exists "keymap_folder_items_select_own" on public.keymap_folder_items;
create policy "keymap_folder_items_select_own"
  on public.keymap_folder_items for select
  using (auth.uid() = user_id);

-- 他人のフォルダに投稿を差し込めないよう、folder_id が自分のフォルダであることも要求する
drop policy if exists "keymap_folder_items_insert_own" on public.keymap_folder_items;
create policy "keymap_folder_items_insert_own"
  on public.keymap_folder_items for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.keymap_folders f
      where f.id = folder_id and f.user_id = auth.uid()
    )
  );

drop policy if exists "keymap_folder_items_update_own" on public.keymap_folder_items;
create policy "keymap_folder_items_update_own"
  on public.keymap_folder_items for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.keymap_folders f
      where f.id = folder_id and f.user_id = auth.uid()
    )
  );

drop policy if exists "keymap_folder_items_delete_own" on public.keymap_folder_items;
create policy "keymap_folder_items_delete_own"
  on public.keymap_folder_items for delete
  using (auth.uid() = user_id);

create index if not exists keymap_folder_items_user_id_idx on public.keymap_folder_items (user_id);
