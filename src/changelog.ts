// 更新履歴。新しい順に並べる。アプリの「更新履歴」と README の「更新履歴」「Changelog」は、この内容と同じにする
// （README と食い違うとテストで分かる）

export interface ChangelogEntry {
  date: string;
  items: { ja: string; en: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-10-07",
    items: [
      {
        ja: "雛形「サンプル（作例）」を新しい作例に差し替え。二階建てになり、屋根・文字・芝生や石などの床・庭の木や灯籠・L字デスクや二段ベッドなどの家具も入っています",
        en: "The Showcase template is now a newer, two-story plan with roofs, text, grass and stone floors, garden trees and a lantern, and more furniture such as an L-shaped desk and a bunk bed",
      },
    ],
  },
  {
    date: "2026-10-05",
    items: [
      {
        ja: "ノートPCやタブレットなど少し狭い画面で、上のバーのボタンが押しつぶされて文字とアイコンが重なっていたのを修正。入りきらない幅ではお知らせを隠し、ボタンをアイコンだけにします",
        en: "Fixed top bar buttons being squeezed (text over icons) on laptops and tablets; where they do not fit, the notice hides and the buttons show icons only",
      },
    ],
  },
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
    items: [{ ja: "「支援する」欄を追加（Amazon ほしい物リスト）", en: "A section for supporting the project (an Amazon wishlist)" }],
  },
  {
    date: "2026-08-04",
    items: [
      {
        ja: "スマホ・タブレットで開いたときだけ、PCでの利用をおすすめするお知らせを出すように（幅の狭いPCの画面では出ません）",
        en: "The note recommending a PC only appears on phones and tablets, not in narrow PC windows",
      },
    ],
  },
  {
    date: "2026-07-24",
    items: [{ ja: "Google検索の結果に、サイト名「間取りクイック3D」が出るように", en: "Google search results show the site name 間取りクイック3D" }],
  },
  {
    date: "2026-07-21",
    items: [{ ja: "アプリのアイコンを追加（ブラウザのタブやホーム画面に出ます）", en: "App icons for browser tabs and home screens" }],
  },
  {
    date: "2026-07-20",
    items: [{ ja: "使い方の説明（README）を日本語と英語で詳しく", en: "A detailed README in Japanese and English" }],
  },
  {
    date: "2026-07-19",
    items: [{ ja: "屋根を複数置いて、それぞれの形・大きさ・位置を編集できるように", en: "Multiple roofs, each with its own shape, size and position" }],
  },
  {
    date: "2026-07-17",
    items: [{ ja: "「選択中」の欄を折りたためるように", en: "The selection panel can be collapsed" }],
  },
  {
    date: "2026-07-13",
    items: [
      { ja: "「選択中」の欄を、ツールのすぐ下に移動", en: "The selection panel moved right below the tools" },
      { ja: "PCでの利用をおすすめする注意書きを追加", en: "A note recommending use on a PC" },
      {
        ja: "利用条件で禁止する使い方を詳しくし、作った間取りや画像を公開するときのクレジット表記を必須に",
        en: "Usage terms list prohibited uses in detail, and credit is required when publishing plans or images",
      },
    ],
  },
  {
    date: "2026-07-12",
    items: [
      { ja: "家具を追加（壁掛け時計・ホールクロック・水槽など）。引き戸を追加", en: "More furniture (wall clock, grandfather clock, aquarium and more) and sliding doors" },
      { ja: "置いた物を動かないように固定できるように", en: "Lock items in place" },
      { ja: "作例の雛形「サンプル」を追加", en: "A sample plan template" },
      { ja: "Cloudflare Pages（madori-5yu.pages.dev）でも公開", en: "Also published on Cloudflare Pages (madori-5yu.pages.dev)" },
      {
        ja: "訪問数の把握に、Cookieを使わず個人を追跡しないアクセス計測を使うように（プライバシーの説明も更新）",
        en: "Cookie-free visit counting that does not track individuals (privacy note updated)",
      },
    ],
  },
  {
    date: "2026-07-11",
    items: [{ ja: "利用条件に、嫌がらせや差別的な目的での利用の禁止を追加", en: "Usage terms prohibit harassment and hate speech" }],
  },
  {
    date: "2026-07-10",
    items: [
      {
        ja: "大きな更新：2Dを白黒の図面風の線画に。家具23種類を種類ごとの一覧にし、ドア・窓も一覧へ",
        en: "Big update: 2D became black-and-white drawing-style line art, with 23 kinds of furniture grouped by type and doors and windows in the list",
      },
      { ja: "1F〜4Fの階を切り替えて編集。下の階を薄く重ねて表示し、3Dでは階を積み重ねて表示", en: "Floors 1F to 4F, the floor below shown faintly in 2D, and floors stacked in 3D" },
      { ja: "屋根（切妻・寄棟・陸屋根、軒の出つき）", en: "Roofs: gable, hip and flat, with eaves" },
      { ja: "壁・ドア・窓・図形・家具ごとに色を選べ、2Dと3Dで別々の色にもできるように", en: "Colors for each wall, door, window, shape and piece of furniture, separately for 2D and 3D" },
      {
        ja: "3Dの影の表示の切り替え、光の向き、5段階の光の強さ、階や屋根ごとの表示の切り替え",
        en: "3D shadow toggle, light direction, five light levels, and showing or hiding each floor and the roof",
      },
      { ja: "3Dで、ドアの上や窓の上下を壁でふさぎ、開口の所だけ壁を抜くように", en: "In 3D, walls fill the space above doors and around windows, leaving only the openings" },
      { ja: "壁・ドア・窓の長さを数字で入力したり、端のつまみで伸び縮みさせたりできるように", en: "Wall, door and window lengths can be typed or dragged from their ends" },
      { ja: "ドアや家具の左右反転（Fキー）と、真ん中に縦の枠がある窓", en: "Flip doors and furniture with F, and a window with a center mullion" },
      { ja: "Rキーで回転（Shift+Rで15°ずつ）、角度の入力", en: "Rotate with R (Shift+R for 15 degrees) and type an angle" },
      { ja: "斜めの壁（15°ずつ）と、円・円弧・三角形〜八角形の図形の壁", en: "Diagonal walls in 15-degree steps, and circle, arc and triangle-to-octagon walls" },
      { ja: "編集パネルを一時的に隠すボタン", en: "A button to hide the editing panel for more room" },
      {
        ja: "ショートカット一覧、「このアプリについて」（免責やデータの扱い）、「ご意見・ご要望」を追加。α版として公開",
        en: "A shortcut reference, an about section (disclaimer and data handling) and a feedback section; released as an alpha",
      },
    ],
  },
  {
    date: "2026-07-05",
    items: [{ ja: "GitHub Pages で公開", en: "Published on GitHub Pages" }],
  },
  {
    date: "2026-07-02",
    items: [{ ja: "ブラウザのタブに出るアイコンを追加", en: "A browser tab icon" }],
  },
  {
    date: "2026-06-27",
    items: [
      {
        ja: "最初の版：部屋・壁・ドア・窓・家具（ソファ・ベッド・机・テーブル・キッチン・浴槽）を2Dで描くと、そのまま3Dで見られる",
        en: "First version: draw rooms, walls, doors, windows and furniture (sofa, bed, desk, table, kitchen, bath) in 2D and see them in 3D",
      },
      {
        ja: "雛形（ワンルーム・1LDK・2LDK）、元に戻す・やり直す、ブラウザへの自動保存、ファイルへの書き出し・読み込み",
        en: "Templates (studio, 1LDK, 2LDK), undo and redo, automatic saving in the browser, and export and import as a file",
      },
      { ja: "2D・3D・同時の表示の切り替えと、右ドラッグでの2Dの移動", en: "2D, 3D and side-by-side views, and right-drag panning in 2D" },
      { ja: "円と円弧の壁。ドア・窓が壁より優先されるように", en: "Circle and arc walls; doors and windows take priority over walls" },
      { ja: "方眼に合わせた作図、ドアの開き方の描き方、3Dの閉じたドアと窓枠を改善", en: "Drawing snaps to the grid, clearer door swings, and better closed doors and window frames in 3D" },
      { ja: "部屋の名前の位置を動かせるように", en: "Room names can be moved" },
    ],
  },
];

// 日付の表示（例 2026年10月4日）
export function changelogDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}
