# ORCA MAP の作業ルール

## ブランチとサイト

- `main` … 本番（https://orca-map.vercel.app）
- `staging` … テスト用のサイト。ユーザーはここで触って確かめてから本番に出す
- Supabase は本番と staging で **同じプロジェクトを共有している**。staging で投稿・いいね・本人確認をすると本番のデータになり、
  `supabase/sql/` の SQL を流すと本番の DB も変わる。SQL は、いまの main のコードが動き続ける形（列やテーブルを足すなど）にする

## 作ったら staging にマージする

機能や修正を作ったら、作業ブランチに commit・push したあと、確認を待たずに staging にもマージして push する
（この push はこのルールで許可している）。同じ作業で直したときも、そのたびにマージし直す。

1. `git fetch origin staging` して `git checkout -B staging origin/staging`
2. `git merge --no-ff --no-commit <作業ブランチ>`
3. 同じコミットで `STAGING.md` を更新する（下記）
4. `Merge <作業ブランチ> into staging: <何が変わったかを一言>` でコミットして `git push origin staging`
5. 作業ブランチに戻る。staging の変更は作業ブランチに持ち込まない（作業ブランチは main 向けのまま保つ）

型チェック（`npm run typecheck`）はマージしたあとの staging でも通してから push する。

## STAGING.md（staging で確認待ちのもの）

`STAGING.md` は「staging には入っていて main にはまだ無い変更」と、その動作確認の項目の一覧。
staging にマージするたびに、staging 上で必ず書き足す・直す。

- 作業ブランチ 1 つにつき 1 項目。新しいものを上に足す。同じブランチをマージし直したときは、その項目を書き直す（増やさない）
- 見出しは変更の名前。その下に作業ブランチ名・最後にマージした日付と、何が変わったかを 1〜3 行
- 確認項目は `- [ ]` で、staging のサイトで実際に何をして、どう見えればよいかを書く。
  保存データの引き継ぎ・スマホ幅・PiP など、既存の機能に響きそうならその確認も入れる
- SQL の実行など、確認や本番の前に要る作業は「先にやること」に書く。DB は共通なので、
  SQL を流したかどうかも書く（分からなければ Supabase で確かめる）
- 見た目だけの変更でも項目は作る。アプリの動きに関係しない変更（ドキュメントだけなど）は作らなくてよい
- ユーザーが確認済みと言った項目は `- [x]` にする

staging を main に出すとき（main を staging まで進める・staging → main のプルリクエスト）は、出す分の項目を
STAGING.md から消すコミットを staging にしてから出す。作業ブランチから main に直接マージしたものも、staging に項目があれば消す。
