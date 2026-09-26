// Vercel の Edge ランタイムでは process.env だけが使える。@types/node を丸ごと入れると
// アプリ側（ブラウザ）の型まで Node 寄りになるので、使う分だけ宣言しておく
declare const process: { env: Record<string, string | undefined> }
