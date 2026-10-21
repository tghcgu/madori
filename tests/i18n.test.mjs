import test from 'node:test';
import assert from 'node:assert/strict';
import { collectI18nStrings, missingI18nStrings } from '../scripts/i18n-strings.mjs';
import { I18N_DICTIONARY } from '../src/i18n/dictionary.ts';
import { LANGUAGES, formatDate, hasTranslation, t, useDictionary } from '../src/i18n.ts';

const PLACEHOLDERS = /\{\d+\}/g;
const placeholders = (text) => [...new Set(text.match(PLACEHOLDERS) ?? [])].sort().join(',');

test('every Japanese text on screen has an English, Korean and Traditional Chinese translation', async () => {
  const missing = await missingI18nStrings();
  assert.deepEqual(missing.map(({ language, key, where }) => `${language} ${where.join(',')}: ${key}`), [],
    '画面の文字を足したら src/i18n/dict-*.ts にも訳を足す（node --experimental-strip-types scripts/i18n-strings.mjs で一覧）');
});

test('the strings come from the code and the page, not from search keywords, fonts or shader code', () => {
  const keys = new Set(collectI18nStrings().map(({ key }) => key));
  for (const expected of ['選択', '書き出し', '冷蔵庫', '天蓋付きベッド', '病院', '{0}個を選択中', '{0}（{1}個の要素・屋根{2}枚）を削除します。実行しますか？']) {
    assert.ok(keys.has(expected), expected);
  }
  for (const key of keys) {
    assert.doesNotMatch(key, /^(たたみ 和室|れいぞうこ)$/, 'search keywords are not translated');
    assert.doesNotMatch(key, /serif$|uniform |gl_FragColor/, 'fonts and shaders are not translated');
  }
});

test('every translation is filled in and keeps the same {0} {1} values as the Japanese', () => {
  for (const [key, values] of Object.entries(I18N_DICTIONARY)) {
    assert.equal(values.length, 3, key);
    values.forEach((value, i) => {
      assert.ok(value.trim(), `${key}: empty ${['en', 'ko', 'zh-Hant'][i]}`);
      assert.equal(placeholders(value), placeholders(key), `${key}: ${value}`);
    });
  }
});

test('translating: exact text, numbers, patterns with translated values, and separated parts', () => {
  useDictionary(I18N_DICTIONARY, 'en');
  try {
    assert.equal(t('書き出し'), 'Export');
    assert.equal(t('  保存済み\n'), '  Saved\n', 'surrounding spaces stay');
    assert.equal(t('3個を選択中'), '3 selected', 'numbers fill a pattern');
    assert.equal(t('客室2'), 'Guest room 2');
    assert.equal(t('病室B'), 'Patient room B', 'a pattern takes any value');
    assert.equal(t('ドラッグで池を描く'), 'Drag to draw Pond', 'values inside a pattern are translated too');
    assert.equal(t('1階建て・部材26・屋根0'), '1-story · 26 parts · 0 roofs');
    assert.equal(t('椅子（丸い座面）'), 'Chair (Round seat)', 'separated parts');
    assert.equal(t('2F（12個の要素・屋根1枚）を削除します。実行しますか？'), 'Delete 2F (12 items, 1 roofs)?');
    assert.equal(t('利用者が書いた名前'), '利用者が書いた名前', 'unknown text stays as it is');
    assert.equal(t('Ctrl+S'), 'Ctrl+S');
    assert.ok(hasTranslation('洋室3') && !hasTranslation('見たことのない文'));
    assert.match(formatDate('2026-10-21'), /October 21, 2026/);
    useDictionary(I18N_DICTIONARY, 'ko');
    assert.equal(t('書き出し'), '내보내기');
    useDictionary(I18N_DICTIONARY, 'zh-Hant');
    assert.equal(t('書き出し'), '匯出');
  } finally {
    useDictionary(I18N_DICTIONARY, 'ja');
  }
  assert.equal(t('書き出し'), '書き出し', 'Japanese shows the text as written');
  assert.equal(formatDate('2026-10-21'), '2026年10月21日');
  assert.deepEqual(LANGUAGES.map((item) => item.label), ['JP', 'EN', 'KR', '繁中']);
});
