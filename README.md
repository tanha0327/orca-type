# ORCA MAP

**Keychron Orca echo** のキーマップを設計するための、非公式のコンセプト・エディタです。

実機に接続せず、手元の普通のキーボードの打鍵を Orca echo の配列として読み替え、
「この組み合わせなら何が出るのか」「いまのは単押しか長押しか」を
**Picture-in-Picture の常時最前面ウィンドウ**に出しながら設計できます。

## できること

| | |
|---|---|
| **8 レイヤー** | 名前・色つきのレイヤーを 8 枚。`MO` / `TG` / `TO` / layer-tap に対応 |
| **MOD-TAP** | すべての割当に単押し・長押し・ダブルタップ。タッピングタームとフレーバー（長押し優先／バランス／単押し優先）も個別に指定可能 |
| **コンボ** | 同時押しの割当。参加キー・判定時間・有効レイヤーを編集でき、盤面クリックでキーを選べる |
| **ロータリーエンコーダー** | 左ホイールの右回し／左回し／押し込み。初期設定は **右回しで `→`、左回しで `←`** |
| **スワイプ** | 左右のスクロールパッドに上下左右スワイプ・タップ・ダブルタップ。初期設定は **上下で音量、左右で水平スクロール** |
| **トラックボール** | 19mm ボールの DPI・取り付け角度・反転・精密モード倍率・スクロール粒度 |
| **出力 HUD** | 現在レイヤー／組み合わせ→出力／単押し・長押しの判定とタッピングターム進行バー／コンボ発火／スワイプ／直近ログ／ミニキーマップ。PiP で常時最前面に出せる |
| **入出力** | localStorage への自動保存、JSON の書き出し・読み込み、ZMK `.keymap` 風のプレビュー |

## 動かす

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 型チェック + 本番ビルド
npm run typecheck
```

PiP（Document Picture-in-Picture API）は Chrome / Edge で動きます。
非対応のブラウザではボタンが無効になり、HUD はページ内に表示されます。

## 使い方

1. 盤面のキーをクリックして、右のインスペクタで単押しと長押しを決める
2. ヘッダーの「入力キャプチャ ON」で打鍵の読み替えを開始する
3. HUD にいま何が出力されたかが出る（キーをダブルクリックすれば試し打ちも可）
4. 「PiP で常時表示」で HUD を別ウィンドウに逃がし、他のアプリを使いながら確認する

キャプチャ中はブラウザのショートカットを除くほとんどのキーがページに取り込まれます。
文字を入力したいときは OFF に戻してください。

## X 連携（本人確認）

ログイン中のアカウントに X（旧 Twitter）のアカウントを紐づけると、
「みんなの配列」の投稿・コメントに **✓ 𝕏 @ユーザー名** のバッジが付きます。
バッジは連携した X のプロフィール（数値のユーザー ID 指定）へのリンクなので、
見た人が本人の投稿かどうかを確かめられます。連携・解除はプロフィール編集から行えます。

有効にするには Supabase 側で次の設定が必要です。

1. Authentication > Sign In / Providers で **X / Twitter (OAuth 2.0)** を有効にし、
   X Developer Portal の Client ID / Client Secret を登録する
   （X 側の Callback URI は `https://<project-ref>.supabase.co/auth/v1/callback`）
2. 同じ画面の **Allow manual linking** を ON にする
3. `supabase/sql/005_x_verification.sql` を SQL Editor で実行する

連携情報は Supabase Auth の `auth.identities` に入り、公開用の `x_verifications` テーブルへは
DB 関数 `sync_x_verification()` だけが書き込みます（クライアントから任意のユーザー名を書き込んで
なりすますことはできません）。

## 構成

```
src/
  data/       layout.ts（49 キーの物理配列）/ keycodes.ts / defaultKeymap.ts / types.ts
  engine/     resolve.ts（純粋な解決関数）/ KeyEngine.ts（状態機械）/ zmk.ts / useEngine.ts
  lib/        supabase.ts / auth.ts / profile.ts / feed.ts / xVerification.ts（X 連携による本人確認）
  store/      keymapStore.ts（Zustand + persist）/ authStore.ts / profileStore.ts
  components/ Board / LayerBar / Inspector / Picker / Combos / Gestures / Export / Hud / PipHost / Feed / Profile / Auth
  styles/     theme.css（デザイントークンと共通クラス）
```

割当はキーもエンコーダーもパッドもコンボも `Binding`（`tap` / `hold` / `doubleTap` /
`tappingTermMs` / `flavor`）という 1 つの型に集約してあり、編集 UI もそれを共有しています。

## 注意

ORCA MAP は非公式のコンセプトサイトです。Keychron / GIZMART とは関係ありません。
実機のファームウェアへの書き込みは行いません。
