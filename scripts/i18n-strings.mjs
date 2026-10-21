// 画面に出る日本語の文字を、コード（TypeScript の文字列）と index.html から集める。
// 集めた物は、ほかの言語の辞書（src/i18n/dict-*.ts）にどれも訳があるかを確かめるのに使う（tests/i18n.test.mjs）。
// `node --experimental-strip-types scripts/i18n-strings.mjs` で、辞書に訳がない物を出す
//
// - `${…}` を含む文字は `{0}` `{1}` … の形（型）にする。HTML の中なら、文字の所と、人に見える属性（title・aria-label・placeholder・alt）ごとに分ける
// - 検索だけに使う語（keywords、normalizeSearchText に渡す物、ひらがなを空白で並べた物）は集めない
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// 画面の文字を持つファイル
export const I18N_SOURCES = [
  'src/main.ts', 'src/furniture-catalog.ts', 'src/furniture-more.ts', 'src/templates.ts', 'src/surfaces.ts',
  'src/wall-styles.ts', 'src/plan-style.ts', 'src/three-style.ts', 'src/opening-shapes.ts', 'src/roof-shapes.ts',
  'src/free-shapes.ts', 'src/stairs.ts', 'src/persistence.ts', 'src/template-floors.ts', 'src/selection.ts',
  'src/floor-editing.ts', 'src/furniture-shapes.ts', 'src/furniture-models.ts',
];
// 訳さない物を書いた所（プロパティの名前）と、関数に渡す引数（番号の引数だけ訳さない。-1 は全部）
const SKIP_PROPS = new Set(['keywords', 'search']);
const SKIP_CALLS = { normalizeSearchText: -1, createPaletteGroup: 2, createPaletteButton: 1, querySelector: -1, querySelectorAll: -1 };

const JA = /[぀-ヿ㐀-鿿！-｠]/;
const HOLE = /\u0001(\d+)\u0002/g;
const CUT = '\u0000';

export function normalizeKey(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function looksLikeKeywords(key) {
  const words = key.split(' ');
  if (words.length < 2 || /[。、（）「」：！？{}]/.test(key)) return false;
  return words.filter((word) => /^[぀-ゟー]+$/.test(word)).length >= Math.max(1, words.length / 3);
}

// 断片を1つの鍵にする。`${…}` の所は、断片の中で 0 から番号を振り直す
function fragmentKey(fragment) {
  const numbers = new Map();
  const key = normalizeKey(fragment.replace(HOLE, (_, n) => {
    if (!numbers.has(n)) numbers.set(n, numbers.size);
    return `{${numbers.get(n)}}`;
  }));
  if (!key || !JA.test(key.replace(/\{\d+\}/g, '')) || looksLikeKeywords(key)) return null;
  // 字体の並び（CSS の font-family）と、シェーダーのコード（日本語のコメントがある）は訳さない
  if (/(serif|monospace)$/.test(key) || /\b(uniform|varying|vec[234]|gl_FragColor)\b|\bfloat \w+\(/.test(key)) return null;
  return key;
}

const ATTRS = /\b(?:title|placeholder|aria-label|alt)\s*=\s*"([^"]*)"/g;
function htmlFragments(text) {
  const out = [];
  for (const match of text.matchAll(ATTRS)) out.push(match[1]);
  const stripped = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, CUT)
    // 前の文字列から続くタグの終わりと、次の文字列へ続くタグの始まり（属性の値は上で拾う）
    .replace(/^[^<>\u0000]*>/, CUT)
    .replace(/<[^>\u0000]*$/, CUT);
  out.push(...stripped.split(CUT));
  return out;
}

// 置き換えない所（data-i18n-skip を付けた要素。言語の選択や更新履歴）を、閉じタグまで取りのぞく
function withoutSkipped(html) {
  const open = /<([a-z]+)\b[^>]*\bdata-i18n-skip\b[^>]*>/i;
  for (let match = open.exec(html); match; match = open.exec(html)) {
    const tags = new RegExp(`<(/?)${match[1]}\\b[^>]*>`, 'gi');
    tags.lastIndex = match.index;
    let depth = 0, end = html.length;
    for (let tag = tags.exec(html); tag; tag = tags.exec(html)) {
      depth += tag[1] ? -1 : 1;
      if (depth === 0) { end = tag.index + tag[0].length; break; }
    }
    html = html.slice(0, match.index) + html.slice(end);
  }
  return html;
}

const LOOKS_LIKE_HTML =/<[a-z!/][^>]*>|<[a-z][^>]*$|^[^<]*>/i;
function addText(found, text, where) {
  for (const fragment of LOOKS_LIKE_HTML.test(text) ? htmlFragments(text) : [text]) {
    const key = fragmentKey(fragment);
    if (!key) continue;
    if (!found.has(key)) found.set(key, new Set());
    found.get(key).add(where);
  }
}

export function collectI18nStrings(root = fileURLToPath(new URL('..', import.meta.url))) {
  const found = new Map();
  for (const file of I18N_SOURCES) {
    const source = ts.createSourceFile(file, readFileSync(`${root}/${file}`, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      if (ts.isPropertyAssignment(node) && SKIP_PROPS.has(node.name.getText(source))) return;
      if (ts.isVariableDeclaration(node) && /keywords/i.test(node.name.getText(source))) return;
      if (ts.isCallExpression(node)) {
        const name = node.expression.getText(source).split('.').pop();
        if (name in SKIP_CALLS) {
          const skip = SKIP_CALLS[name];
          if (skip >= 0) node.arguments.forEach((arg, i) => { if (i !== skip) visit(arg); });
          return;
        }
      }
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) addText(found, node.text, file);
      else if (ts.isTemplateExpression(node)) {
        // `${…}` の所に印を入れてつなぎ、その形のまま断片に分ける
        let text = node.head.text;
        node.templateSpans.forEach((span, i) => { text += `\u0001${i}\u0002${span.literal.text}`; });
        addText(found, text, file);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  const html = readFileSync(`${root}/index.html`, 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<head>[\s\S]*?<\/head>/, '');
  addText(found, withoutSkipped(html), 'index.html');
  return [...found.entries()].map(([key, where]) => ({ key, where: [...where] }));
}

// どの言語でも訳せない物（そのままの文・数字だけ違う文・型のどれでも訳せない物）
export async function missingI18nStrings(strings = collectI18nStrings()) {
  const { I18N_DICTIONARY } = await import('../src/i18n/dictionary.ts');
  const { useDictionary, hasTranslation } = await import('../src/i18n.ts');
  const missing = [];
  for (const language of ['en', 'ko', 'zh-Hant']) {
    useDictionary(I18N_DICTIONARY, language);
    for (const item of strings) if (!hasTranslation(item.key)) missing.push({ ...item, language });
  }
  useDictionary(I18N_DICTIONARY, 'ja');
  return missing;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const strings = collectI18nStrings();
  const missing = await missingI18nStrings(strings);
  if (process.argv.includes('--json')) console.log(JSON.stringify(missing, null, 1));
  else for (const { key, where, language } of missing) console.log(`${language}\t${where.join(',')}\t${key}`);
  console.error(`strings ${strings.length}, missing ${missing.length}`);
}
