-- X（旧 Twitter）アカウントとの連携による「本人確認」を追加する。
-- Supabase ダッシュボードの SQL Editor に貼り付けて実行してください。
--
-- 事前に Supabase ダッシュボードで次の 2 つを設定しておく必要があります。
--   1) Authentication > Sign In / Providers で「X / Twitter (OAuth 2.0)」を有効化し、
--      X Developer Portal で発行した Client ID / Client Secret を登録する
--      （X 側の Callback URI には https://<project-ref>.supabase.co/auth/v1/callback を登録）
--   2) 同じ画面の「Allow manual linking」を ON にする
--      （ログイン済みのアカウントに、あとから X のアカウントを紐づけるのに必要）
--
-- 連携した X アカウントの情報は auth.identities に入るが、auth スキーマは他人から読めない。
-- 投稿・コメントに「@ユーザー名 で本人確認済み」のバッジを出すため、公開用のテーブルに写しておく。
-- 写すのは下の sync_x_verification() だけで、クライアントからは直接書き込めない
-- （自己申告のユーザー名を入れて他人になりすます、ということができないようにする）。

-- 1) 公開用の本人確認テーブル（ユーザーごとに最大 1 行）
create table if not exists public.x_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- X の数値のユーザー ID。@ユーザー名は変更・再取得されうるので、プロフィールへのリンクはこちらで張る
  x_user_id text not null,
  x_username text not null check (char_length(x_username) between 1 and 50),
  verified_at timestamptz not null default now()
);

alter table public.x_verifications enable row level security;

drop policy if exists "x_verifications_select_all" on public.x_verifications;
create policy "x_verifications_select_all"
  on public.x_verifications for select
  using (true);

-- insert / update / delete のポリシーはあえて作らない（書き込みは sync_x_verification() 経由のみ）

-- 2) ログイン中のユーザーの X 連携状態を auth.identities から読み直して、公開テーブルに反映する。
-- 連携したとき・解除したとき・アプリを開いたときにクライアントから呼ぶ。
-- 旧 OAuth 1.0a の 'twitter' プロバイダで連携済みのアカウントも本人確認済みとして扱う。
create or replace function public.sync_x_verification()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  x_identity record;
begin
  if uid is null then
    raise exception 'ログインが必要です';
  end if;

  select
    i.provider_id,
    coalesce(
      nullif(i.identity_data->>'user_name', ''),
      nullif(i.identity_data->>'preferred_username', '')
    ) as username,
    i.created_at
  into x_identity
  from auth.identities i
  where i.user_id = uid and i.provider in ('x', 'twitter')
  order by (i.provider = 'x') desc, i.updated_at desc nulls last
  limit 1;

  if not found or x_identity.username is null then
    delete from public.x_verifications where user_id = uid;
    return;
  end if;

  insert into public.x_verifications (user_id, x_user_id, x_username, verified_at)
  values (uid, x_identity.provider_id, left(x_identity.username, 50), coalesce(x_identity.created_at, now()))
  on conflict (user_id) do update
    set x_user_id = excluded.x_user_id,
        x_username = excluded.x_username,
        verified_at = excluded.verified_at;
end;
$$;

revoke all on function public.sync_x_verification() from public, anon;
grant execute on function public.sync_x_verification() to authenticated;

-- 3) すでに X で連携済みのユーザーを反映しておく（以降はアプリを開くたびに同期される）
insert into public.x_verifications (user_id, x_user_id, x_username, verified_at)
select distinct on (i.user_id)
  i.user_id,
  i.provider_id,
  left(coalesce(nullif(i.identity_data->>'user_name', ''), nullif(i.identity_data->>'preferred_username', '')), 50),
  coalesce(i.created_at, now())
from auth.identities i
where i.provider in ('x', 'twitter')
  and coalesce(nullif(i.identity_data->>'user_name', ''), nullif(i.identity_data->>'preferred_username', '')) is not null
order by i.user_id, (i.provider = 'x') desc, i.updated_at desc nulls last
on conflict (user_id) do nothing;
