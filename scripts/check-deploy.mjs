// 公開先が、いまのコミットのビルドに切り替わったかを確かめる（切り替わるまで待つ）。
// ビルドにはコミットの番号（先頭7文字）が入る（vite.config.ts の __APP_COMMIT__。ご意見フォームの「版」）ので、
// 公開中の JavaScript にその番号が出てくれば、そのコミットが公開されている。
//
// 使い方:
//   npm run check:deploy -- develop   … プレビュー https://develop.madori-5yu.pages.dev/
//   npm run check:deploy -- main      … 本番 https://madori-5yu.pages.dev/ と https://tghcgu.github.io/madori/
//   npm run check:deploy -- main abc1234   … コミットを指定するとき（省略すると、いまの HEAD）
import { execSync } from 'node:child_process';

const SITES = {
  develop: ['https://develop.madori-5yu.pages.dev/'],
  main: ['https://madori-5yu.pages.dev/', 'https://tghcgu.github.io/madori/'],
};
const target = process.argv[2] ?? 'develop';
const sites = SITES[target];
if (!sites) {
  console.error(`使い方: npm run check:deploy -- develop|main [コミット]（${target} は分かりません）`);
  process.exit(2);
}
const commit = (process.argv[3] ?? execSync('git rev-parse HEAD').toString().trim()).slice(0, 7);
const WAIT_MS = 15_000, LIMIT_MS = 15 * 60_000;

// 公開中のページが読み込む JavaScript に、コミットの番号があるか
async function serves(base) {
  const html = await (await fetch(base, { cache: 'no-store' })).text();
  const scripts = [...html.matchAll(/assets\/index-[^"']+\.js/g)].map((match) => match[0]);
  for (const path of scripts) {
    const code = await (await fetch(new URL(path, base), { cache: 'no-store' })).text();
    if (code.includes(commit)) return true;
  }
  return false;
}

const started = Date.now();
const done = new Set();
console.log(`${commit} が公開されるのを待っています: ${sites.join(' , ')}`);
while (done.size < sites.length) {
  for (const site of sites) {
    if (done.has(site)) continue;
    try {
      if (await serves(site)) {
        done.add(site);
        console.log(`公開されました: ${site}（${Math.round((Date.now() - started) / 1000)}秒）`);
      }
    } catch (error) {
      // 一時的につながらないときは、次の確認で見直す
      console.log(`つながりませんでした（もう一度見ます）: ${site} ${error.message}`);
    }
  }
  if (done.size === sites.length) break;
  if (Date.now() - started > LIMIT_MS) {
    console.error(`15分待っても公開されませんでした: ${sites.filter((site) => !done.has(site)).join(' , ')}`);
    console.error('Cloudflare Pages のビルドや GitHub の Actions（Deploy to GitHub Pages）の結果を見てください');
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, WAIT_MS));
}
