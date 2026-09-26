-- X（旧 Twitter）の「ポストで本人確認」を追加する。
-- Supabase ダッシュボードの SQL Editor に貼り付けて実行してください。
-- Supabase・X のどちらにも追加の設定は要りません（X の開発者登録も不要）。
--
-- 仕組み:
--   1) アプリがユーザーごとの確認コード（例: ORCA-3F9A1C07B2）を表示する
--   2) ユーザーがそのコード入りのポストを X に投稿し、ポストの URL をアプリに貼る
--   3) verify_x_post() が X の公開 oEmbed（埋め込み用の窓口。鍵・料金不要）でそのポストを取りに行き、
--      「本文に自分の確認コードが入っているか」と「投稿者の @ユーザー名」を確かめて x_verifications に記録する
-- 有料の X API は使わない。投稿者は X が返す情報から取るので、他人のポストで本人確認することはできない。

create extension if not exists http with schema extensions;

-- この機能の最初の版（X アカウントのログイン連携。未公開）で作ったものが残っていれば片付ける
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'x_verifications' and column_name = 'x_user_id'
  ) then
    drop table public.x_verifications;
  end if;
end $$;
drop function if exists public.sync_x_verification();

-- 1) 公開用の本人確認テーブル（ユーザーごとに最大 1 行）
create table if not exists public.x_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  x_username text not null check (x_username ~ '^[A-Za-z0-9_]{1,15}$'),
  -- 確認に使ったポストの ID。バッジからこのポストを開けるようにする
  post_id text not null check (post_id ~ '^[0-9]{1,25}$'),
  verified_at timestamptz not null default now()
);

-- 同じ @ユーザー名 で本人確認できるのは 1 アカウントだけ（あとから確認し直した人が優先）
create unique index if not exists x_verifications_username_key
  on public.x_verifications (lower(x_username));

alter table public.x_verifications enable row level security;

drop policy if exists "x_verifications_select_all" on public.x_verifications;
create policy "x_verifications_select_all"
  on public.x_verifications for select
  using (true);

-- 自分の本人確認は自分で取り消せる
drop policy if exists "x_verifications_delete_own" on public.x_verifications;
create policy "x_verifications_delete_own"
  on public.x_verifications for delete
  using (auth.uid() = user_id);

-- insert / update のポリシーはあえて作らない（書き込みは verify_x_post() 経由のみ）

-- 2) 確認の連打で X にリクエストを送り続けないよう、ユーザーごとに最後に試した時刻を持つ（読み書きは関数からのみ）
create table if not exists public.x_verification_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempted_at timestamptz not null
);

alter table public.x_verification_attempts enable row level security;

-- 3) ログイン中のユーザーの確認コード。ユーザー ID から決まるので、何度開いても同じコードになる
create or replace function public.my_x_verification_code()
returns text
language sql
stable
set search_path = ''
as $$
  select 'ORCA-' || upper(substr(encode(sha256(convert_to('orca-map:x-verification:' || auth.uid()::text, 'UTF8')), 'hex'), 1, 10))
  where auth.uid() is not null
$$;

revoke all on function public.my_x_verification_code() from public, anon;
grant execute on function public.my_x_verification_code() to authenticated;

-- 4) X から返ってきた oEmbed の中身を確かめて、投稿者の @ユーザー名 を返す（合わなければ null）。
-- HTTP を伴わない部分だけを切り出してあるので、単体で試せる。
create or replace function public.x_post_author_from_oembed(oembed jsonb, expected_post_id text, expected_code text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  username text;
  post_text text;
begin
  username := substring(oembed->>'author_url' from '^https?://(?:www\.|mobile\.)?(?:twitter|x)\.com/([A-Za-z0-9_]{1,15})/?$');
  if username is null then
    return null;
  end if;
  -- 頼んだポストそのものの情報かを確かめる
  if coalesce(oembed->>'url', '') !~ ('/status(?:es)?/' || expected_post_id || '(?:[/?#]|$)') then
    return null;
  end if;
  -- 本文（<p>…</p>）だけを見る。表示名などに書いたコードでは通さない
  post_text := substring(oembed->>'html' from '<p[^>]*>(.*)</p>');
  if post_text is null or position(upper(expected_code) in upper(post_text)) = 0 then
    return null;
  end if;
  return username;
end;
$$;

revoke all on function public.x_post_author_from_oembed(jsonb, text, text) from public, anon, authenticated;

-- 5) ポストの URL を受け取って本人確認する。
-- 戻り値: { ok: true, username, post_id } か { ok: false, error }（error はそのまま画面に出せる日本語）
create or replace function public.verify_x_post(post_url text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  code text;
  m text[];
  post_id text;
  target text;
  res extensions.http_response;
  oembed jsonb;
  username text;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'ログインが必要です');
  end if;

  m := regexp_match(
    btrim(coalesce(post_url, '')),
    '^https?://(?:www\.|mobile\.)?(?:x|twitter)\.com/([A-Za-z0-9_]{1,15}|i/web|i)/status(?:es)?/([0-9]{1,25})(?:[/?#].*)?$'
  );
  if m is null then
    return jsonb_build_object('ok', false, 'error', 'X のポストの URL を貼り付けてください（例: https://x.com/ユーザー名/status/123…）');
  end if;
  post_id := m[2];

  if exists (
    select 1 from public.x_verification_attempts
    where user_id = uid and attempted_at > now() - interval '10 seconds'
  ) then
    return jsonb_build_object('ok', false, 'error', '少し待ってから、もう一度お試しください');
  end if;
  insert into public.x_verification_attempts (user_id, attempted_at)
  values (uid, now())
  on conflict (user_id) do update set attempted_at = excluded.attempted_at;

  code := 'ORCA-' || upper(substr(encode(sha256(convert_to('orca-map:x-verification:' || uid::text, 'UTF8')), 'hex'), 1, 10));

  -- API のリクエストがタイムアウト（8 秒）する前に終わるよう、1 回 3 秒まで・最大 2 回にする。
  -- まずユーザー名を含まない形の URL で取りに行き、だめなら貼られた形（ユーザー名入り）で取りに行く。
  -- どちらの形でも、oEmbed は URL に書いたユーザー名ではなく実際の投稿者を返す（2026-09 に確認）
  begin
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '3000');
    foreach target in array array[
      'https://twitter.com/i/status/' || post_id,
      'https://twitter.com/' || m[1] || '/status/' || post_id
    ] loop
      begin
        res := extensions.http((
          'GET',
          'https://publish.twitter.com/oembed?omit_script=true&dnt=true&url=' || extensions.urlencode(target),
          array[extensions.http_header('Accept', 'application/json')],
          null,
          null
        )::extensions.http_request);
      exception when others then
        res := null;
      end;
      exit when res.status = 200;
    end loop;
    -- 同じ接続で http 拡張を使うほかの処理に、短いタイムアウトを持ち越さない
    perform extensions.http_reset_curlopt();

    if res.status is distinct from 200 then
      return jsonb_build_object('ok', false, 'error',
        'ポストを読み込めませんでした。URL が正しいか、鍵アカウントでないか、ポストを消していないかを確かめてください');
    end if;

    oembed := res.content::jsonb;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'X からの応答を読み取れませんでした。時間をおいてお試しください');
  end;

  username := public.x_post_author_from_oembed(oembed, post_id, code);
  if username is null then
    return jsonb_build_object('ok', false, 'error',
      'ポストの本文に確認コード（' || code || '）が見つかりませんでした。コードを消さずに投稿してください');
  end if;

  -- 同じ @ユーザー名 で別のアカウントが確認済みなら、今確かめた人を優先する
  delete from public.x_verifications where lower(x_username) = lower(username) and user_id <> uid;
  insert into public.x_verifications (user_id, x_username, post_id, verified_at)
  values (uid, username, post_id, now())
  on conflict (user_id) do update
    set x_username = excluded.x_username,
        post_id = excluded.post_id,
        verified_at = excluded.verified_at;

  return jsonb_build_object('ok', true, 'username', username, 'post_id', post_id);
end;
$$;

revoke all on function public.verify_x_post(text) from public, anon;
grant execute on function public.verify_x_post(text) to authenticated;
