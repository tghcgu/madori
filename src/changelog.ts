// 更新履歴。新しい順に並べる。アプリの「更新履歴」と README の「更新履歴」「Changelog」は、この内容と同じにする
// （README と食い違うとテストで分かる）

export interface ChangelogEntry {
  date: string;
  items: { ja: string; en: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-10-04",
    items: [
      {
        ja: "2Dの「絵柄」を追加。間取り全体を、ドット絵のマップや、和紙に墨の筆で描いたような見た目に切り替えられます（画像の書き出しも同じ絵柄）",
        en: "2D styles: draw the whole plan as a pixel-art map or in brush ink on washi paper (exported images follow the style)",
      },
    ],
  },
  {
    date: "2026-10-03",
    items: [
      {
        ja: "「割れたガラス」を「破片」に変え、ドラッグでなぞった所に破片をまけるように（まく幅・量・色を変えられます）",
        en: "Broken glass is now shards: drag to scatter them along a path, with adjustable spread, amount and color",
      },
      { ja: "クレジット表記をワンクリックでコピーできるように", en: "Copy the credit line in one click" },
      {
        ja: "ご意見・ご要望をGoogleフォームで受け付けるように（使っている環境が自動で入ります）。画像を添えて送れるフォームも追加",
        en: "Feedback through Google Forms with your environment filled in, plus a form that takes images",
      },
    ],
  },
  {
    date: "2026-10-02",
    items: [
      { ja: "3Dを使わない「間取り専用版」（/plan/）を公開", en: "Plan-only edition without 3D at /plan/" },
      { ja: "ペンを追加。好きな色で線や点を描いたり、囲んで塗ったりできます", en: "Pen for lines, dots and filled areas in any color" },
      {
        ja: "人の模型を追加。立つ・うつぶせ・あおむけ、ポーズの見本、腰・首・ひじ・ひざなどの関節を自由に動かせます（3Dはデッサン人形風）",
        en: "Posable person: standing or lying, pose presets, and every joint adjustable (a wooden mannequin in 3D)",
      },
      { ja: "足跡を、なぞった道すじに沿って付けられるように", en: "Footprints follow a drawn path" },
      {
        ja: "事件・調査の印（番号の印・足跡・倒れた人・血・割れたガラス）を追加",
        en: "Investigation marks: numbered markers, footprints, a fallen person, blood and broken glass",
      },
      { ja: "色をカラーコードで入力できるように。末尾の2桁で透明度も決められます", en: "Colors can be typed as color codes, with optional transparency" },
      {
        ja: "地下の階と、上限のない階数に対応。透かす階・色・濃さを選べるように",
        en: "Basements and unlimited floors; choose which floors to show through, and their color and strength",
      },
      { ja: "書き出した画像が薄く見えないように。お知らせを上のバーへ移動", en: "Exported images no longer look faint; the notice moved into the top bar" },
    ],
  },
  {
    date: "2026-09-29",
    items: [
      { ja: "すべての家具の3Dを、真上から見たとき2Dの記号と同じ形に", en: "Every 3D model matches its 2D symbol when seen from above" },
      { ja: "パーツ7種類とデザイン10種類を追加", en: "7 new items and 10 new designs" },
    ],
  },
  {
    date: "2026-09-28",
    items: [
      { ja: "2D・3Dともに、ほぼ無限に拡大・縮小できるように", en: "Zoom 2D and 3D almost without limit" },
      { ja: "再読み込みしても、見ていた場所や表示の設定がそのまま残るように", en: "The viewpoint and display settings survive reloads" },
      { ja: "3Dの家具にも、2Dと同じデザインの種類を追加", en: "3D models get the same design variants as the 2D symbols" },
    ],
  },
  {
    date: "2026-09-25",
    items: [
      { ja: "テキストツールを追加。間取りの好きな所に文字を置けます", en: "Text tool for free text anywhere on the plan" },
      { ja: "2Dの記号を、文字を使わず形だけで分かりやすく。記号のデザイン違いを追加", en: "Clearer 2D symbols drawn with shapes only, and symbol variants" },
      { ja: "屋外の物（高さを変えられます）と、3Dの草地を追加", en: "Outdoor items with adjustable height, and grass in 3D" },
      { ja: "2Dと3Dの境目をドラッグで動かせるように", en: "Drag the boundary between 2D and 3D" },
    ],
  },
  {
    date: "2026-09-24",
    items: [
      { ja: "パーツ検索（ひらがなや別名でも探せます）を追加し、よく使う物を先頭に", en: "Part search (hiragana and aliases too), with frequent items first" },
      { ja: "2Dの屋根の表示切替を追加。寸法の表示で屋根の寸法も切り替え", en: "Toggle roofs on the 2D plan; the dimension toggle covers roofs too" },
    ],
  },
  {
    date: "2026-09-17",
    items: [
      { ja: "すべての家具の3Dモデルと、ドア・窓の作りをより細かく", en: "More detailed 3D furniture, doors and windows" },
      { ja: "名前のない部屋を作れるように。保存データの復旧を改善", en: "Unnamed rooms, and better recovery of saved plans" },
    ],
  },
  {
    date: "2026-09-07",
    items: [{ ja: "床材（フローリング・タイル・石の床・草地）と家具を追加", en: "Floor surfaces (wood, tile, stone, grass) and more furniture" }],
  },
  {
    date: "2026-09-01",
    items: [{ ja: "「支援する」欄を追加", en: "A section for supporting the project" }],
  },
  {
    date: "2026-07-21",
    items: [{ ja: "アプリのアイコンを追加", en: "App icons" }],
  },
  {
    date: "2026-07-19",
    items: [{ ja: "屋根を複数置いて編集できるように", en: "Multiple editable roofs" }],
  },
  {
    date: "2026-07-17",
    items: [{ ja: "「選択中」の欄をツールのすぐ下に移し、折りたためるように", en: "The selection panel sits right below the tools and can be collapsed" }],
  },
  {
    date: "2026-07-12",
    items: [
      { ja: "家具と引き戸を追加。置いた物を動かないように固定できるように", en: "More furniture, sliding doors, and placement locks" },
      { ja: "作例の雛形を追加。Cloudflare Pages（madori-5yu.pages.dev）で公開", en: "A sample plan template; published on Cloudflare Pages (madori-5yu.pages.dev)" },
    ],
  },
  {
    date: "2026-07-10",
    items: [
      {
        ja: "大きな更新：白黒の図面風の2D、複数の階、屋根、家具の一覧、2Dと3Dで別々の色",
        en: "Big update: monochrome drawing-style 2D, multiple floors, roofs, a furniture catalog, and separate 2D and 3D colors",
      },
      {
        ja: "Rキーでの回転、斜めの壁、円や多角形の壁、下の階を半透明で重ねる表示",
        en: "Rotation with R, diagonal walls, circle and polygon walls, and the floor below shown as a translucent guide",
      },
      { ja: "ショートカット一覧と「このアプリについて」を追加。α版として公開", en: "A shortcut reference and an about section; released as an alpha" },
    ],
  },
  {
    date: "2026-07-05",
    items: [{ ja: "GitHub Pages で公開", en: "Published on GitHub Pages" }],
  },
  {
    date: "2026-06-27",
    items: [
      {
        ja: "最初の版：2Dで描いた間取りを3Dで見られる。表示の切り替え、右ドラッグでの移動、ドア・窓、曲線の壁",
        en: "First version: draw a plan in 2D and see it in 3D, with view modes, right-drag panning, doors, windows and curved walls",
      },
    ],
  },
];

// 日付の表示（例 2026年10月4日）
export function changelogDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}
