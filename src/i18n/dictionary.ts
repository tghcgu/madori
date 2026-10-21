// ほかの言語の辞書（日本語 → [英語, 韓国語, 繁体字中国語]）。日本語以外を選んだときだけ読み込む（src/i18n.ts）
import type { Translations } from "../i18n.ts";
import { UI } from "./dict-ui.ts";
import { LOOKS } from "./dict-looks.ts";
import { FURNITURE } from "./dict-furniture.ts";
import { TEMPLATES } from "./dict-templates.ts";

export const I18N_DICTIONARY: Record<string, Translations> = { ...TEMPLATES, ...FURNITURE, ...LOOKS, ...UI };
