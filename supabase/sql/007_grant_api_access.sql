-- 005（X の本人確認）・006（フォルダ）で作ったテーブルを、アプリから読み書きできるようにする。
-- Supabase ダッシュボードの SQL Editor に貼り付けて実行してください（005・006 のあとに）。
--
-- この Supabase プロジェクトでは、SQL で新しく作ったテーブルに anon / authenticated の
-- select・insert・update・delete の権限が自動では付かない（既定で付くのは truncate などだけ）。
-- RLS のポリシーは権限のさらに内側の絞り込みなので、権限が無いと、ポリシーで許していても
-- REST API は「permission denied for table ...」になる。005・006 はポリシーしか書いていなかったため、
--   - 本人確認しても、投稿・コメント・ヘッダーに ✓ のバッジが出ない（取り消しもできない）
--   - マイフォルダが読み込めず、作ることも投稿を保存することもできない
-- となっていた。ここではポリシーで許している操作の権限だけを付ける（誰の行を触れるかは今までどおり RLS で決まる）。

-- 1) X の本人確認: バッジはログインしていない人にも見せるので、anon にも select を付ける。
--    取り消し（delete）は本人の行だけ（x_verifications_delete_own）。
--    記録（insert / update）は verify_x_post() だけに任せるので付けない
grant select on public.x_verifications to anon, authenticated;
grant delete on public.x_verifications to authenticated;

-- x_verification_attempts は関数の中からしか使わないので、何も付けない

-- 2) マイフォルダ: ログインしている本人が自分の行だけを読み書きする（*_own のポリシー）
grant select, insert, update, delete on public.keymap_folders to authenticated;
grant select, insert, update, delete on public.keymap_folder_items to authenticated;
