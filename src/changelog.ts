// 更新履歴。新しい順に並べる。アプリの「更新履歴」と README の「更新履歴」「Changelog」は、この内容と同じにする
// （README と食い違うとテストで分かる）

export interface ChangelogEntry {
  date: string;
  items: { ja: string; en: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-10-12",
    items: [{
      ja: "円すい・ドーム・正多角形の屋根を追加。直径や幅・奥行、高さを調整でき、正多角形は3〜12辺と向きを選べます。2D・3Dで輪郭が一致し、魔法使いの塔と城の塔のテンプレートも円すい屋根に変更しました",
      en: "Added cone, dome and regular polygon roofs with editable diameter, width/depth and rise. Polygon roofs support 3 to 12 sides and rotation, with matching 2D and 3D footprints. Wizard and castle tower templates now use cone roofs",
    }, {
      ja: "楕円の壁を直接描けるツールと楕円の床の見本を追加。円の幅・奥行を別々に変えて楕円にでき、楕円のつまみは縦横を独立して変更します。中心を保ったサイズ変更、図形に合う床や屋根の追加、取り消しと保存にも対応",
      en: "Added an ellipse wall tool and ellipse floor preset. Change a circle's width and depth independently to make an ellipse; ellipse handles resize each axis separately while keeping the center fixed. Matching floors and roofs, undo and persistence are supported",
    }, {
      ja: "「線で囲んで床を作成」を追加。点を順につないで始点をクリック・Enter・完了ボタンで閉じると、同じ輪郭の床が2D・3Dにできます。作図中の1点戻し、キャンセル、Shiftで水平・垂直、交差した輪郭の検出に対応",
      en: "Added a click-to-draw floor tool. Connect points and close the outline by clicking its start, pressing Enter or using the finish button to create matching 2D and 3D floors. Supports undoing draft points, cancellation, Shift-constrained horizontal/vertical segments and crossed-outline validation",
    }, {
      ja: "床の形を見本ボタンで選び、全体の拡大縮小と「輪郭を編集」を分離。キャンバスで選んだ頂点を保持し、辺の中央で点を追加、Deleteで削除、座標指定・矢印キーで調整できます。階段の開口を壊す変更は理由を表示して止めます",
      en: "Replaced the floor-shape dropdown with visual presets and separated whole-floor resizing from contour editing. Selected canvas vertices stay selected across edits; insert points at edge midpoints, delete them, or adjust coordinates and nudge with arrow keys. Changes that invalidate stairwell openings are blocked with feedback",
    }, {
      ja: "円・円弧・多角形の壁と円形の床を、円周のつまみ・直径入力・スライダーでサイズ変更できるように。中心を保って拡大縮小し、円形床の通常選択では大量の頂点を出しません。スライダー操作は1回で取り消せます",
      en: "Circle, arc and polygon walls and circular floors now resize through perimeter handles, diameter input and a live slider. Resizing keeps the center fixed, and selecting a circular floor no longer shows every polygon vertex. A slider gesture is a single undo step",
    }, {
      ja: "間取り見本の名称を「テンプレート」に統一。全50種類を階段の仕様に合わせて点検し、上階の床に階段の開口を設け、二階建て・三階建ての到着側の配置を修正。魔法使いの塔と城の塔は円形の壁・床に変更し、建具と家具も配置し直しました。保存済みの間取りは変更しません",
      en: "Standardized the Japanese preset name as Template. Reviewed all 50 templates for the new stair behavior, added upper-floor stairwell openings and corrected arrival layouts in the two- and three-story houses. The wizard tower and castle towers now have circular walls and floors with repositioned openings and furniture. Existing saved plans are not changed",
    }, {
      ja: "同時表示や狭い画面で階のタブがつぶれて押せなくなる問題を修正。ボタンを早めにアイコン表示へ切り替え、必要な幅ではツールバーを折り返します",
      en: "Fixed floor tabs collapsing and becoming unclickable in split view and narrow panes. Toolbar buttons switch to icons earlier, and the toolbar wraps when needed",
    }, {
      ja: "城などの大きなテンプレートを狭い3D表示に収める際、カメラの距離制限で建物の端が切れていた問題を修正",
      en: "Fixed large templates such as the castle being cropped in narrow 3D views because the fit-to-view camera distance was capped",
    }],
  },
  {
    date: "2026-10-11",
    items: [
      {
        ja: "3Dの左ドラッグは通常は視点回転にし、家具をダブルクリックすると移動モードへ。空白クリック・Escで解除でき、固定・複数移動・取り消しにも対応。右ドラッグは画面に沿って上下左右へ動き、2階・3階へ視点の高さも変えられます",
        en: "Left-drag in 3D now orbits by default; double-click furniture to enter move mode, and leave it with an empty-space click or Escape. Locks, group movement and undo still work. Right-drag now pans in the screen plane, including elevation for exploring upper floors",
      },
      {
        ja: "部屋名の文字サイズを変更でき、部屋名と自由テキストを横書き・縦書きで切り替えられるように。縦書きの改行は右から左へ並び、選択・移動・PNG・保存にも反映します",
        en: "Room labels now have editable font sizes. Room labels and free text support horizontal or vertical writing, with right-to-left columns for line breaks, matching selection bounds, dragging, PNG export and persistence",
      },
      {
        ja: "床を円・L字・自由な多角形に変更でき、頂点や辺の中央をドラッグして形を編集できます。頂点の追加・削除・数値指定、図形の壁に合わせた床の追加にも対応し、2Dと3Dで同じ輪郭を使います。重なる床や凹んだ部分も正しく描画します",
        en: "Floors can be circular, L-shaped or freeform polygons. Drag vertices or edge midpoints, add/remove vertices or edit their coordinates, and add a floor matching an existing shape wall. 2D and 3D share the outline, including concave cutouts and overlapping floors",
      },
      {
        ja: "下階からつながる階段を、上階の2D図とPNGに下り向きの記号で自動表示。直階段・折返し・らせんに対応し、3Dには重複追加しません。テンプレートの最上階にあった余分な上り階段を修正し、既存の重複階段は選択欄の「下階の階段表示に切り替え」で取り消し可能な形で解消できます",
        en: "Stairs arriving from the floor below now appear automatically as descending symbols in the upper 2D plan and PNG exports, without extra 3D geometry. Supports straight, U-shaped and spiral stairs. Removed redundant top-floor flights from templates; existing duplicate stairs can be replaced with the lower-floor display using an undoable command in their properties",
      },
      {
        ja: "アパートのテンプレートで外階段の上を2階の床がふさいでいた配置を修正。階段の到着側に踊り場と手すりを設け、2階の外廊下へつなげました",
        en: "Fixed the apartment template's upper slab covering its exterior stairs. The stairs now lead to a guarded landing connected to the upper corridor",
      },
    ],
  },
  {
    date: "2026-10-10",
    items: [
      {
        ja: "3Dで拡大し続けると注視点の手前で止まっていた動きを修正。ホイールやピンチで窓・壁を越えて室内まで進めるようになり、逆方向で後退できます。室内の視点も再読み込み後に保ちます",
        en: "Fixed 3D zoom stopping short of its orbit target. Keep scrolling or pinching to move through windows and walls into rooms, and reverse to move back. Interior camera views also survive reloads",
      },
      {
        ja: "Ctrl＋ドラッグの範囲選択、Rで選択全体を90度回転、矢印キーで移動、Ctrl＋Dで複製、Ctrl＋C／Vでコピー・貼り付け、Ctrl＋Aで階全体を選択に対応。取り消し後も残っている物の複数選択を保ちます",
        en: "Added Ctrl-drag box selection, R to rotate a group by 90 degrees, arrow-key movement, Ctrl+D duplication, Ctrl+C/V copy and paste, and Ctrl+A selection of the current floor. Undo keeps surviving items selected",
      },
      {
        ja: "Ctrl＋クリック（MacはCmd）で複数の物を選択・解除し、位置関係を保ったまま一括移動できるように。2Dで部屋・壁・家具・文字などをまとめて選び、3Dでは選択した家具をつかんでまとめて移動できます。固定した物は動かさず、一括固定・削除、1回の取り消しにも対応",
        en: "Ctrl-click (Cmd on Mac) to add or remove items from a selection and move them together without changing their spacing. Select rooms, walls, furniture, text and more in 2D, or drag a selected piece of furniture in 3D to move the selection. Locked items stay put; batch locking, deletion and single-step undo are supported",
      },
      {
        ja: "描くツールでも物をクリックすると選択でき、家具・文字・消去などのツールでは長押しで選択できます。Escで描画や移動をキャンセルして選択ツールへ戻り、家具の配置と移動はまとめて1回で取り消せます",
        en: "Click an item to select it while using drawing tools, or hold to select while placing furniture, text or erasing. Escape cancels drawing or movement and returns to selection; placing and dragging a new piece of furniture is now one undo step",
      },
      {
        ja: "「和風の家具・設備」に12種類を追加。畳・座布団・ちゃぶ台・屏風・障子の衝立・行灯・階段箪笥・囲炉裏・火鉢・縁台・檜風呂・つくばいを、幅・奥行・高さ・色を変えて配置できます。2Dと3Dは共通の形データから描画します",
        en: "12 Japanese furnishings: tatami, zabuton, chabudai, folding screen, shoji partition, andon lantern, stepped chest, irori hearth, hibachi, veranda bench, hinoki bathtub and tsukubai basin. Width, depth, height and colors are editable, with shared geometry for 2D and 3D",
      },
      {
        ja: "テンプレートを50種類に。三階建て・マンション・シェアハウス・古民家・武家屋敷・寮・レストラン・ラーメン屋・居酒屋・美容院・本屋・保育園・体育館・交番・映画館・寺・キャンプ場・客船・寝台列車・城・冒険者の宿・魔法使いの塔・宇宙船を追加し、「屋外・乗り物」「ファンタジー・SF」の分類を足しました",
        en: "50 templates: added a three-story house, a condominium, a share house, an old farmhouse, a samurai residence, a dormitory, a restaurant, a ramen shop, an izakaya, a hair salon, a bookstore, a nursery school, a gymnasium, a police box, a cinema, a temple, a campsite, a cruise ship, a sleeper train, a castle, an adventurers' inn, a wizard's tower, and a spaceship, with new groups for outdoors and vehicles and for fantasy and sci-fi",
      },
      {
        ja: "2Dの絵柄を17種類に。水彩・墨絵・クレヨン・ポップ・CAD・ホラー・コピー・レトロゲーム（緑の4色のドット）を追加し、絵柄のメニューを分類ごとに並べました",
        en: "17 2D styles: added watercolor, ink wash, crayon, pop, CAD, horror, photocopy, and retro game (four-green dots), and the style menu is now grouped by kind",
      },
      {
        ja: "テンプレートの旅館・ホテル・病院・学校・図書館・警察署・美術館・城に、上の階を足しました（ホテルと学校は三階建て）。階段は上と下の階で同じ場所にあります",
        en: "The ryokan, hotel, hospital, school, library, police station, art museum, and castle templates now have upper floors (the hotel and the school have three), with stairs in the same place on each floor",
      },
      {
        ja: "2Dの「絵柄」を、線画と背景に分けて選べるように。たとえば鉛筆の線画を黒板に、ネオンの線画を羊皮紙に描けます（背景は「おまかせ」で線画に合わせます）",
        en: "The 2D style is now split into line art and background, chosen separately: for example, pencil lines on a chalkboard or neon lines on parchment (the background can also follow the line art)",
      },
      {
        ja: "筆・和風と墨絵の線を、より筆らしく。入りの押さえと払いの強弱、筆圧の揺れ、かすれ、1本の中の墨の濃淡、にじみと、塗りのむらを付けました",
        en: "Brush and ink-wash lines look more like a real brush: pressed starts and tapering sweeps, changing pressure, dry-brush streaks, darker and lighter ink within a stroke, a slight bleed, and mottled washes",
      },
      {
        ja: "家具に「墓石」を追加。2Dの記号と3Dの形は、台石・竿石・花立て・香炉が同じ配置です（寺のテンプレートの墓地にも使っています）",
        en: "New furniture: a grave, with the same base, upright stone, vases, and incense holder in 2D and 3D (used in the temple's graveyard)",
      },
    ],
  },
  {
    date: "2026-10-09",
    items: [
      {
        ja: "テンプレートを27種類に増やし、住まい・屋敷と宿・お店・施設・屋外とそのほかに分けて並べました。平屋の日本家屋・アパート・洋館（地下室つき）・山荘・旅館・ホテル・カフェ・バー・コンビニ・病院・学校・オフィス・図書館・教会・神社・警察署・研究所・美術館・銭湯・公園・廃工場・地下牢を追加。どれも壁・ドア・窓・家具・床・屋根まで入っていて、2Dでも3Dでも見られます",
        en: "27 templates in five groups: added a Japanese house, an apartment, a Western mansion with a cellar, a lodge, a ryokan, a hotel, a cafe, a bar, a convenience store, a hospital, a school, an office, a library, a church, a shrine, a police station, a laboratory, an art museum, a public bath, a park, an abandoned factory, and a dungeon, each with walls, doors, windows, furniture, floors, and roofs in 2D and 3D",
      },
      {
        ja: "2Dの絵柄に、鉛筆・マンガ・設計図・古地図・黒板・ネオンの6種類を追加（全部で9種類）。絵柄のメニューには、それぞれの絵柄で描いた見本が並びます",
        en: "Six more 2D styles: pencil, manga, blueprint, old map, chalkboard, and neon (nine in all). The style menu shows a sample drawn in each style",
      },
      {
        ja: "筆・和風の絵柄で、木や草などの床の模様の色が浮かないよう、和紙の色を薄く重ねるように",
        en: "In the brush style, floor patterns such as wood and grass now get a thin layer of the paper color so they blend in",
      },
    ],
  },
  {
    date: "2026-10-07",
    items: [
      {
        ja: "テンプレート「サンプル（作例）」を新しい作例に差し替え。二階建てになり、屋根・文字・芝生や石などの床・庭の木や灯籠・L字デスクや二段ベッドなどの家具も入っています",
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
      { ja: "作例のテンプレート「サンプル」を追加", en: "A sample plan template" },
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
        ja: "テンプレート（ワンルーム・1LDK・2LDK）、元に戻す・やり直す、ブラウザへの自動保存、ファイルへの書き出し・読み込み",
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
