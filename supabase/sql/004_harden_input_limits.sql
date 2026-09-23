-- セキュリティ強化: フロントの maxLength はあくまで UI 側の制限で、
-- anon key を使って直接 REST API を叩けば誰でもバイパスできる。
-- DB 側にも同じ上限を CHECK 制約として入れ、無制限の巨大文字列・JSON
-- が送り込まれてストレージを圧迫したり表示を壊したりするのを防ぐ。
-- Supabase ダッシュボードの SQL Editor に貼り付けて実行してください。

-- 1) shared_keymaps: 投稿名・投稿者名・説明・keymap 本体の大きさに上限を付ける
alter table public.shared_keymaps drop constraint if exists shared_keymaps_name_length;
alter table public.shared_keymaps
  add constraint shared_keymaps_name_length check (char_length(name) between 1 and 120);

alter table public.shared_keymaps drop constraint if exists shared_keymaps_author_length;
alter table public.shared_keymaps
  add constraint shared_keymaps_author_length check (char_length(author) between 1 and 60);

alter table public.shared_keymaps drop constraint if exists shared_keymaps_description_length;
alter table public.shared_keymaps
  add constraint shared_keymaps_description_length check (description is null or char_length(description) <= 500);

alter table public.shared_keymaps drop constraint if exists shared_keymaps_keymap_size;
alter table public.shared_keymaps
  add constraint shared_keymaps_keymap_size check (octet_length(keymap::text) <= 300000);

alter table public.shared_keymaps drop constraint if exists shared_keymaps_avatar_url_length;
alter table public.shared_keymaps
  add constraint shared_keymaps_avatar_url_length check (avatar_url is null or char_length(avatar_url) <= 2048);

-- 2) keymap_comments: author_name / avatar_url にも上限を付ける（body は既に 003 で制約済み）
alter table public.keymap_comments drop constraint if exists keymap_comments_author_name_length;
alter table public.keymap_comments
  add constraint keymap_comments_author_name_length check (char_length(author_name) between 1 and 60);

alter table public.keymap_comments drop constraint if exists keymap_comments_avatar_url_length;
alter table public.keymap_comments
  add constraint keymap_comments_avatar_url_length check (avatar_url is null or char_length(avatar_url) <= 2048);

-- 3) profiles: 表示名・アイコン URL にも上限を付ける
alter table public.profiles drop constraint if exists profiles_display_name_length;
alter table public.profiles
  add constraint profiles_display_name_length check (char_length(display_name) between 1 and 60);

alter table public.profiles drop constraint if exists profiles_avatar_url_length;
alter table public.profiles
  add constraint profiles_avatar_url_length check (char_length(avatar_url) <= 2048);

-- 4) avatars ストレージバケット: アプリ側は「2MB 以下・image/* のみ」を
-- チェックしているが、これも UI 側だけの制限で API を直接叩けば回避できる。
-- バケット自体に同じ上限を設定し、任意サイズ・任意 MIME タイプのアップロードを防ぐ。
update storage.buckets
set file_size_limit = 2097152, -- 2MB
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'avatars';
