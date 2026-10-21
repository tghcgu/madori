// 画面の言語（日本語・英語・韓国語・繁体字中国語）。
// 画面の文字はどれも日本語で書いてあり、ほかの言語のときは、辞書（src/i18n/dictionary.ts。日本語の文 → [英語, 韓国語, 繁体字]）で
// 画面に出た文字を置き換える。
// - 画面（document）の文字と、人に見える属性（title・aria-label・placeholder・alt・label）を、出るたび・変わるたびに置き換える（MutationObserver）
// - `${…}` を含む文は、辞書の型（{0} {1} …）に当てはめて訳す（型の中の値も訳す。数字は数字のまま）
// - 型にも当たらない文は、「・」「（）」などで区切って、区切った所ごとに訳す
// - 確かめの窓（confirm・alert）も訳す。キャンバスに描く文字は、描く所で t() を通す
// 言語は「言語」の選択で変え、ブラウザに覚える（URL の ?lang=en などでも開ける）。何も決めていなければ日本語
// （検索エンジンの読み取りが日本語のままになるよう、ブラウザの言語からは決めない）
// このファイルは読み込んだだけでは DOM を触らない（テストが読む）

export type Language = "ja" | "en" | "ko" | "zh-Hant";
export type Translations = readonly [en: string, ko: string, zh: string];

export const LANGUAGES: { id: Language; label: string; name: string; locale: string }[] = [
  { id: "ja", label: "JP", name: "日本語", locale: "ja-JP" },
  { id: "en", label: "EN", name: "English", locale: "en-US" },
  { id: "ko", label: "KR", name: "한국어", locale: "ko-KR" },
  { id: "zh-Hant", label: "繁中", name: "繁體中文", locale: "zh-TW" },
];
export const LANGUAGE_STORAGE_KEY = "madori-quick-3d-language";

const COLUMN: Record<Exclude<Language, "ja">, number> = { en: 0, ko: 1, "zh-Hant": 2 };
const JA = /[぀-ヿ㐀-鿿！-｠]/;
const NUMBER = /\d+(?:\.\d+)?/g;
const HOLE = /\{(\d+)\}/g;
// 区切ってから訳すときの区切り（訳すときに、その言語の書き方に直す）
const SEPARATORS = /([・、。（）()「」『』：:／/，,！？!?\s]+)/;
const PUNCTUATION: Record<Exclude<Language, "ja">, [RegExp, string][]> = {
  en: [[/・/g, ", "], [/、/g, ", "], [/。/g, ". "], [/（/g, " ("], [/）/g, ") "], [/[「『]/g, "\""], [/[」』]/g, "\""], [/：/g, ": "], [/／/g, " / "], [/，/g, ", "], [/！/g, "! "], [/？/g, "? "]],
  ko: [[/・/g, "·"], [/、/g, ", "], [/。/g, ". "], [/（/g, " ("], [/）/g, ") "], [/[「『]/g, "'"], [/[」』]/g, "'"], [/：/g, ": "], [/／/g, " / "], [/，/g, ", "], [/！/g, "! "], [/？/g, "? "]],
  "zh-Hant": [[/・/g, "、"]],
};

let language: Language = "ja";
let dictionary: Record<string, Translations> | null = null;
let table: Map<string, string> | null = null;
let patterns: { regex: RegExp; translation: string; weight: number }[] = [];
const cache = new Map<string, string>();
const missing = new Set<string>();
const listeners = new Set<(language: Language) => void>();

export function getLanguage(): Language {
  return language;
}

export function languageInfo(id: Language = language) {
  return LANGUAGES.find((item) => item.id === id) ?? LANGUAGES[0];
}

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((item) => item.id === value);
}

// 辞書を、いまの言語の表と型の並びにする
export function useDictionary(source: Record<string, Translations>, next: Language): void {
  dictionary = source;
  language = next;
  cache.clear();
  valueCache.clear();
  missing.clear();
  if (next === "ja") {
    table = null;
    patterns = [];
    return;
  }
  const column = COLUMN[next];
  table = new Map();
  patterns = [];
  for (const [key, values] of Object.entries(source)) {
    const value = values[column];
    if (!value) continue;
    table.set(key, value);
    if (!/\{\d+\}/.test(key)) continue;
    // 型: 決まった文字の多い物から試す（型の中の値がどれも訳せたときだけ使う）
    const weight = key.replace(HOLE, "").replace(/[\s・、。（）()「」：:／/，,！？!?]/g, "").length;
    const regex = new RegExp(`^${key.replace(/[.*+?^$|[\]\\()]/g, "\\$&").replace(HOLE, "(.+?)")}$`);
    patterns.push({ regex, translation: value, weight });
  }
  patterns.sort((a, b) => b.weight - a.weight);
}

// 日本語の文を、いまの言語にする（前後の空白はそのまま。訳がなければ元の文）
export function t(text: string): string {
  if (language === "ja" || !table || !JA.test(text)) return text;
  const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(text) ?? ["", "", text, ""];
  return lead + translateCore(core.replace(/\s+/g, " ")) + trail;
}

function translateCore(core: string): string {
  const cached = cache.get(core);
  if (cached !== undefined) return cached;
  const result = exact(core) ?? numbered(core) ?? patterned(core) ?? segmented(core, false);
  if (result === null) missing.add(core);
  const value = result ?? core;
  cache.set(core, value);
  return value;
}

function exact(core: string): string | null {
  return table?.get(core) ?? null;
}

// 数字だけが違う文（「3個を選択中」→「{0}個を選択中」）
function numbered(core: string): string | null {
  const numbers: string[] = [];
  const key = core.replace(NUMBER, (value) => `{${numbers.push(value) - 1}}`);
  if (!numbers.length) return null;
  const value = table?.get(key);
  return value === undefined ? null : value.replace(HOLE, (whole, index: string) => numbers[Number(index)] ?? whole);
}

// 型に当てはめる（「1Fを編集」→「{0}を編集」）。型の中の値も訳し、訳せない値があればその型は使わない
// （「部屋{0}」が「部屋の中に…」のような別の文に当たらないように）
function patterned(core: string): string | null {
  for (const pattern of patterns) {
    const match = pattern.regex.exec(core);
    if (!match) continue;
    const values = match.slice(1).map(translateValue);
    if (values.some((value) => value === null)) continue;
    return pattern.translation.replace(HOLE, (whole, index: string) => values[Number(index)] ?? whole);
  }
  return null;
}

// 型の中の値: 日本語がなければそのまま。あれば、そのまま・数字・型・区切り（どの区切りも訳せたとき）で訳す。訳せなければ null
const valueCache = new Map<string, string | null>();
function translateValue(value: string): string | null {
  if (!JA.test(value)) return value;
  if (!valueCache.has(value)) valueCache.set(value, exact(value) ?? numbered(value) ?? patterned(value) ?? segmented(value, true));
  return valueCache.get(value) ?? null;
}

// 区切った所ごとに訳す（「椅子（丸い座面）」→「Chair (round seat)」）。どこも訳せなければ null。
// strict なら、日本語のある所がどれも訳せたときだけ
function segmented(core: string, strict: boolean): string | null {
  const parts = core.split(SEPARATORS);
  if (parts.length < 3) return null;
  let changed = false, failed = false;
  const out = parts.map((part, index) => {
    if (index % 2 === 1 || !JA.test(part)) return part;
    const value = exact(part) ?? numbered(part) ?? patterned(part);
    if (value === null) {
      failed = true;
      return part;
    }
    changed = true;
    return value;
  });
  if (!changed || (strict && failed)) return null;
  let joined = out.join("");
  if (language !== "ja") for (const [from, to] of PUNCTUATION[language]) joined = joined.replace(from, to);
  return joined.replace(/ {2,}/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")").replace(/ ([,.:!?])/g, "$1").trim();
}

// 訳せなかった文（画面の確かめと、辞書の書き足しに使う）
export function missingTranslations(): string[] {
  return [...missing];
}

// いまの言語に訳があるか（そのままの文・数字だけ違う文・型のどれかで訳せるか。区切って訳すのは数えない）。辞書の確かめに使う
export function hasTranslation(text: string): boolean {
  if (!table) return false;
  const core = text.replace(/\s+/g, " ").trim();
  return exact(core) !== null || numbered(core) !== null || patterned(core) !== null;
}

// ---- 画面の文字の置き換え ----

const ATTRIBUTES = ["title", "aria-label", "placeholder", "alt", "label"];
// 置き換えない所（利用者が書いた文字の欄、更新履歴のように言語ごとの文を持つ所）
const SKIP_SELECTOR = "script, style, textarea, [contenteditable], [data-i18n-skip]";
type Shown = { source: string; shown: string };
const textSources = new WeakMap<Text, Shown>();
const attributeSources = new WeakMap<Element, Map<string, Shown>>();
let observer: MutationObserver | null = null;
let touched = false;
let titleSource: string | null = null;

function skipped(element: Element | null): boolean {
  return !element || element.closest(SKIP_SELECTOR) !== null;
}

function translateTextNode(node: Text): void {
  const record = textSources.get(node);
  const source = record && record.shown === node.data ? record.source : node.data;
  if (!record && !JA.test(source)) return;
  const shown = t(source);
  textSources.set(node, { source, shown });
  if (shown !== node.data) node.data = shown;
}

function translateAttribute(element: Element, name: string): void {
  const current = element.getAttribute(name);
  if (current === null) return;
  let records = attributeSources.get(element);
  const record = records?.get(name);
  const source = record && record.shown === current ? record.source : current;
  if (!record && !JA.test(source)) return;
  const shown = t(source);
  if (!records) attributeSources.set(element, (records = new Map()));
  records.set(name, { source, shown });
  if (shown !== current) element.setAttribute(name, shown);
}

function translateElementAttributes(element: Element): void {
  for (const name of ATTRIBUTES) if (element.hasAttribute(name)) translateAttribute(element, name);
}

export function translateTree(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    if (!skipped(root.parentElement)) translateTextNode(root as Text);
    return;
  }
  if (!(root instanceof Element || root instanceof Document || root instanceof DocumentFragment)) return;
  if (root instanceof Element) {
    if (skipped(root)) return;
    translateElementAttributes(root);
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => node instanceof Element && node.matches(SKIP_SELECTOR) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text);
    else translateElementAttributes(node as Element);
  }
}

function startObserver(): void {
  if (observer) return;
  observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "childList") record.addedNodes.forEach((node) => translateTree(node));
      else if (record.type === "characterData") {
        if (!skipped(record.target.parentElement)) translateTextNode(record.target as Text);
      } else if (record.type === "attributes" && record.attributeName && record.target instanceof Element && !skipped(record.target)) {
        translateAttribute(record.target, record.attributeName);
      }
    }
    // 置き換えたことで出た知らせは捨てる（置き換えた文字は、もう訳してある）
    observer?.takeRecords();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES });
}

function stopObserver(): void {
  observer?.disconnect();
  observer = null;
}

// ---- 言語を変える ----

let loading: Promise<Record<string, Translations>> | null = null;
function loadDictionary(): Promise<Record<string, Translations>> {
  if (dictionary) return Promise.resolve(dictionary);
  loading ??= import("./i18n/dictionary.ts").then((module) => module.I18N_DICTIONARY);
  return loading;
}

export function onLanguageChange(listener: (language: Language) => void): void {
  listeners.add(listener);
}

export async function setLanguage(next: Language, remember = true): Promise<void> {
  const source = next === "ja" ? (dictionary ?? {}) : await loadDictionary();
  useDictionary(source, next);
  if (remember) {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // 覚えられなくても、いまの画面は変える
    }
  }
  const root = document.documentElement;
  root.lang = next;
  titleSource ??= document.title;
  document.title = t(titleSource);
  if (next !== "ja" || touched) translateTree(document.body);
  touched ||= next !== "ja";
  if (next === "ja") stopObserver();
  else startObserver();
  delete root.dataset.i18nPending;
  listeners.forEach((listener) => listener(next));
}

// 起動のとき: 覚えている言語（または URL の ?lang=）にする。確かめの窓も訳すようにする
export async function initI18n(): Promise<void> {
  const nativeConfirm = window.confirm.bind(window);
  const nativeAlert = window.alert.bind(window);
  const nativePrompt = window.prompt.bind(window);
  window.confirm = (message?: string) => nativeConfirm(message === undefined ? message : t(String(message)));
  window.alert = (message?: unknown) => nativeAlert(message === undefined ? message : t(String(message)));
  window.prompt = (message?: string, value?: string) => nativePrompt(message === undefined ? message : t(String(message)), value);
  const start = startingLanguage();
  if (start !== "ja") {
    try {
      await setLanguage(start, false);
    } catch {
      // 辞書を読めなかったときは日本語のまま
      language = "ja";
    }
  }
  delete document.documentElement.dataset.i18nPending;
}

export function startingLanguage(): Language {
  try {
    const fromUrl = new URLSearchParams(location.search).get("lang");
    if (isLanguage(fromUrl)) return fromUrl;
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguage(saved)) return saved;
  } catch {
    // 読めなければ日本語
  }
  return "ja";
}

// 日付（更新履歴など）。日本語は「2026年10月21日」
export function formatDate(date: string, withYear = true): string {
  const [year, month, day] = date.split("-").map(Number);
  if (language === "ja") return withYear ? `${year}年${month}月${day}日` : `${month}月${day}日`;
  const options: Intl.DateTimeFormatOptions = withYear ? { year: "numeric", month: "long", day: "numeric" } : { month: "long", day: "numeric" };
  return new Intl.DateTimeFormat(languageInfo().locale, options).format(new Date(year, month - 1, day));
}
