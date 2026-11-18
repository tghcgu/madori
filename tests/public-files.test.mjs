import assert from 'node:assert/strict';
import test from 'node:test';
import { access, readFile } from 'node:fs/promises';

// 公開する固定のファイル（public/）。2026-11-16 に、作業フォルダから sitemap.xml 以外がまとめて消えていた（コミット前に気づいて戻した）。
// 消えたまま出すと、本番からアイコン・robots.txt・Google Search Console の確認・リダイレクトが消えるので、ここで見張る
const REQUIRED = [
  // CLAUDE.md の「消さないファイル」（Google Search Console の確認用）
  'google6e6567f2912f5067.html',
  '_redirects',
  'robots.txt',
  'sitemap.xml',
  'site.webmanifest',
  'browserconfig.xml',
  'favicon.ico',
  'favicon.svg',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'mstile-150x150.png',
];

test('the fixed files that the site publishes are all there', async () => {
  const missing = [];
  for (const name of REQUIRED) {
    try {
      await access(`public/${name}`);
    } catch {
      missing.push(name);
    }
  }
  assert.deepEqual(missing, [], 'public/ is missing files');
});

test('the files the pages point to are among them', async () => {
  // index.html が読むアイコンと設定のファイルが、上の一覧にある（足したら一覧にも足す）
  const html = await readFile('index.html', 'utf8');
  const linked = [...html.matchAll(/(?:href|content)="%BASE_URL%([^"?#]+)"/g)].map(match => match[1]).filter(name => !name.includes('/'));
  for (const name of linked) assert.ok(REQUIRED.includes(name), `${name} is linked from index.html`);
});
