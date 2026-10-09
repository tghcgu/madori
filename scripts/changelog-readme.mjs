// README の「## 更新履歴」（日本語）と「## Changelog」（英語）を、src/changelog.ts の内容で書き直す。
// 更新履歴は src/changelog.ts に足し、このスクリプトで README をそろえる（食い違うと tests/changelog.test.mjs が失敗する）。
// 使い方: npm run changelog
import { readFile, writeFile } from 'node:fs/promises';

const { CHANGELOG, changelogDate } = await import(new URL('../src/changelog.ts', import.meta.url));
const readmeUrl = new URL('../README.md', import.meta.url);

const ja = ['## 更新履歴', '', 'アプリ左の「更新履歴」と同じ内容です（新しい順）。', ''];
const en = ['## Changelog', '', 'The same history as "更新履歴" in the app, newest first.', ''];
for (const entry of CHANGELOG) {
  ja.push(`### ${changelogDate(entry.date)}`, '');
  en.push(`### ${entry.date}`, '');
  for (const item of entry.items) {
    ja.push(`- ${item.ja}`);
    en.push(`- ${item.en}`);
  }
  ja.push('');
  en.push('');
}

let readme = (await readFile(readmeUrl, 'utf8')).replace(/\r\n/g, '\n');
// 見出しから、その次の見出し（## で始まる行）の手前までを入れ替える
function replaceSection(heading, lines) {
  const start = readme.indexOf(`\n${heading}\n`);
  if (start < 0) throw new Error(`README に「${heading}」の見出しがありません`);
  const next = readme.indexOf('\n## ', start + heading.length + 2);
  if (next < 0) throw new Error(`README の「${heading}」の後に次の見出しがありません`);
  readme = `${readme.slice(0, start + 1)}${lines.join('\n')}${readme.slice(next)}`;
}
replaceSection('## 更新履歴', ja);
replaceSection('## Changelog', en);
await writeFile(readmeUrl, readme);
console.log(`README の更新履歴を書き直しました（${CHANGELOG.length}日分）`);
