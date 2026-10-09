# 間取りクイック3D — 作業のきまり

Claude Code はこのファイルを毎回最初に読む。詳しい引き継ぎ（新しいPCでの再開手順・外部サービス・コードの地図・経緯）は [docs/handover.md](docs/handover.md)。
このPCが使えなくなっても、このリポジトリ（GitHub: tghcgu/madori）だけで作業を続けられるようにしてある。

## どんなアプリか

2Dで間取りを描くと、その場で3Dになるブラウザのツール。Vite + TypeScript + Three.js、個人開発、α版、無料。
主な使い道は創作（漫画・イラストの背景資料、小説の舞台、TRPGのマップ）。

- 本番: https://madori-5yu.pages.dev/ （Cloudflare Pages）と https://tghcgu.github.io/madori/ （GitHub Pages）。どちらも `main`
- プレビュー: https://develop.madori-5yu.pages.dev/ （`develop`）
- 間取り専用版（3Dなし）: 同じ場所の `/plan/`

## ユーザーとのやり取り

- ユーザーは短い日本語で頼む（例:「続き」「マージ」）。返事は日本語で、短く分かりやすく。
- 「マージ」と言われるまで `main`（本番）に出さない。

## 必ず守ること

1. **本番の前に試しで見せる**: `develop` で作業してテスト → `develop` を push → `npm run check:deploy -- develop` でプレビューに出たのを確かめる → プレビューのURLを見せて待つ → 「マージ」で `main` を `develop` に fast-forward して push → `npm run check:deploy -- main` で本番2か所を確かめる。
2. **2Dと3Dは必ず一致**: 3Dを真上から見た形は、2Dの記号と同じにする。形のデータは `src/furniture-shapes.ts` に置き、2D（`src/main.ts`）と3D（`src/furniture-models.ts`）の両方がそこから作る。変えたら `npm run compare` の見比べ画像で確かめる。前のデザインは消さずに、デザインの1つとして残す。
3. **2Dに文字を出さない**: 家具の記号に文字（「冷」「TV」など）を使わない。新しい部屋・床に既定の名前を付けない。出してよいのは、利用者が書いた名前・テキストだけ。
4. **PL/GMの分け方は入れない**: GM専用の物・隠し扉・PL表示・PL/GM別の画像は 2026-10-02 に外した。頼まれない限り戻さない。
5. **更新履歴を書く**: 使う人に見える変更は、同じコミットで `src/changelog.ts`（`ja` と `en`、新しい日付を先頭）に足し、`npm run changelog` で README の「## 更新履歴」「## Changelog」をそろえる（`tests/changelog.test.mjs` が食い違いを見つける）。取りやめた機能は載せない。
6. **メールアドレスを出さない**: サイトに連絡用のメールアドレスを載せない（問い合わせは Google フォーム）。個人のメールアドレスをリポジトリに書かない。
7. **消さないファイル**: `public/google6e6567f2912f5067.html` と `public/_redirects`（Google Search Console の確認用）。

## コマンド

| コマンド | 内容 |
| --- | --- |
| `npm ci` | 初回の準備（Node.js 22以上。手元は 24） |
| `npx playwright install chromium` | E2E・見比べ用のブラウザ。Windows は入っている Edge を使うので不要（ほかのOSだけ。`E2E_BROWSER_CHANNEL` で変えられる） |
| `npm run dev` | 開発用サーバー（http://127.0.0.1:5173/） |
| `npm test` | 単体テスト（Node の `--experimental-strip-types` で `src/*.ts` をそのまま読む） |
| `npm run test:e2e` | 画面を動かすテスト（約5分。いまは `PASS:` の行が29本） |
| `npm run test:visual` | 3Dの家具の一覧画像（`.codex/furniture-quality/`） |
| `npm run build` | 型チェック → ビルド → `/plan/` を作る |
| `npm run compare -- [種類,…]` | 2Dの記号と3Dの真上図の見比べ画像（`.codex/compare/`） |
| `npm run changelog` | README の更新履歴を `src/changelog.ts` から書き直す |
| `npm run check:deploy -- develop` / `main` | 公開先が、いまのコミットのビルドになるまで待つ |

## コードで気をつけること

- `src/main.ts` は約8500行。どこに何があるかは docs/handover.md の「コードの地図」。
- 起動の処理は `src/main.ts` のいちばん最後（`// ---- 起動 ----`）。上の方に置くと、後ろで宣言した `let` / `const` を読んで止まる（TDZ。過去に何度も起きた）。
- `src/` のコードはテストが Node でそのまま読むので、`enum`・`namespace`・コンストラクタ引数のプロパティなど、型を消すだけで動かない書き方はしない。`src/` を読み込むときに DOM を触らない（使うのは関数の中だけ）。
- 2Dは全体で1つの `ctx` に描く。オフスクリーンの描画や2Dの絵柄（`src/plan-style.ts`）は `ctx` を差し替えて描く。
- E2E は、テスト用の Vite プラグインで `window.__editorTest` を `main.ts` の後ろに足して中を調べる（`tests/editor.mjs` の先頭）。
- コードのコメントは日本語。コミットメッセージは英語（`git log` に合わせる）。
- `.codex/` は作業用（git に入らない）。大事な物はここに置かない。
