// 更新履歴。新しい順に並べる。アプリの「更新履歴」と README の「更新履歴」「Changelog」は、この内容と同じにする
// （README と食い違うとテストで分かる）

export interface ChangelogEntry {
  date: string;
  items: { ja: string; en: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-10-21",
    items: [{
      ja: "壁の厚みを変えられるように。選んだ壁の欄の「厚み」で、ふつうの壁・コンクリート・レンガ・ブロック塀・石垣・生け垣などの厚みを変えられます。2Dと3Dの厚みは同じで、厚くした壁も角がすき間なくつながります",
      en: "Wall thickness can be changed: the Thickness field of a selected wall works for plain walls, concrete, brick, block walls, stone walls, hedges and more. 2D and 3D match, and thick walls still meet cleanly at corners",
    }, {
      ja: "2Dの上に「表示」を追加。部屋名の表示・部屋の広さ（帖・㎡）・方眼の表示と大きさ（25cm・50cm・半間・1m・1.5m・1間・2m・3m）を切り替えられます。方眼の大きさを決めると部屋の上にも方眼が重なり、画像の書き出しでは画像の左上からその大きさの方眼が並び、1マスの大きさ（px）も選べます（ココフォリアなどのマップのマス目に合わせられます）",
      en: "A new 表示 (view) menu above the 2D plan toggles room names, shows room areas in tatami mats (帖) or square meters, and turns the grid on or off with a size of 25 cm, 50 cm, half a ken, 1 m, 1.5 m, one ken, 2 m or 3 m. A chosen grid size is drawn over rooms too, and image export starts the grid at the top-left corner with a selectable cell size in pixels, ready for online tabletop maps",
    }, {
      ja: "画像の書き出しで、背景を透明にしたり、画像をクリップボードにコピーしたりできるように",
      en: "Image export can leave the background transparent and copy the image to the clipboard",
    }, {
      ja: "いまの階を複製できるように（階のタブの右の、重ねた四角のボタン）。すぐ上に同じ階が増え、この階の屋根は上の階へ移ります",
      en: "The current floor can be duplicated (the overlapping-squares button next to the floor tabs): the copy is added directly above, and this floor's roofs move up onto it",
    }, {
      ja: "絵柄に「モノクロ」を追加（2Dと3D）。色を白黒の濃淡にします",
      en: "Added a monochrome look for both the 2D plan and the 3D view, turning colors into shades of gray",
    }, {
      ja: "好きな画像を取り込めるように。「画像を取り込む」を押すか、2Dに画像のファイルをドラッグすると置けます。2Dに描き、3Dでは床に貼ります。大きさ・向き・濃さを変えられ、濃さを下げて「配置を固定」すれば下絵にもできます",
      en: "Any image can be imported: press 画像を取り込む (import image) or drag an image file onto the 2D plan. It appears in 2D and lies on the floor in 3D; its size, rotation and opacity can be changed, and a faint, locked image works as a tracing underlay",
    }, {
      ja: "家具・小物を約250種類追加しました。新しい分類は「建物の部分・工事」（柱・はしご・エレベーター・床の扉・瓦礫・壁のヒビや穴・非常階段・足場・土嚢など）、「設備・インフラ」（配電盤・配管・バルブ・ボイラー・タンク・給水塔・防犯カメラ・水門など）、「物流・工場・倉庫」（パレット・コンテナ・台車・工作機械・ベルトコンベアなど）、「博物館・教会・図書館」（恐竜の骨格・パイプオルガン・告解室など）、「駅・線路」（ポイント・車止め・ホームの端・改札・券売機など）、「人物・動物・怪物（コマ）」（いろいろな仕事の人・猫・犬・鳥・大小の怪物）、「ホラー・オカルト」（魔法陣・儀式台・石碑・肉塊・触手・異常な穴など）、「SF・宇宙船」（操作卓・冷凍睡眠カプセル・動力炉・ホログラム卓など）。ほかの分類にも、手術台や研究の機械、劇場の客席・プール・ジムの器具、電車・救急車・消防車・重機・戦車・飛行機・ヘリ・船の物、道路・横断歩道・信号、事務机や司令室の物、天蓋付きベッド・グランドピアノ、和風の庭の物、梵鐘、手がかりの小物（メモ・鍵・携帯電話・写真・刃物など）、ファンタジーの物を足しました。どれも2Dの記号と3Dの形が同じです。机やテーブルに重ねて置いた小物は、3Dではその上にのります",
      en: "Added about 250 furniture pieces and small items. New groups: building parts and construction (pillars, ladders, elevators, trapdoors, debris, wall cracks and holes, fire escapes, scaffolding, sandbags and more), utilities and infrastructure (switchboards, pipes, valves, boilers, tanks, water towers, security cameras, sluice gates and more), logistics, factories and warehouses (pallets, containers, hand carts, machine tools, conveyors and more), museums, churches and libraries (a dinosaur skeleton, a pipe organ, a confessional and more), stations and railways (switches, buffer stops, platform edges, ticket gates, ticket machines and more), people, animals and monsters as tokens (people in many jobs, cats, dogs, birds and monsters of every size), horror and occult (magic circles, ritual tables, steles, flesh masses, tentacles, an abyss and more), and sci-fi and spaceships (consoles, cryo pods, a reactor, a hologram table and more). Other groups gained operating tables and lab equipment, theater seats, a pool and gym equipment, trains, an ambulance, a fire truck, construction machines, a tank, an airplane, a helicopter and ship fittings, roads, crosswalks and traffic lights, office desks and command-room gear, a canopy bed and a grand piano, Japanese garden pieces, a temple bell, clue items (memos, keys, smartphones, photos, knives and more) and fantasy pieces. Every 2D symbol matches its 3D model, and small items placed on a desk or table rest on top of it in 3D",
    }, {
      ja: "家具の一覧のボタンに、2Dの記号の小さな絵を付けました",
      en: "Furniture buttons in the parts list now show a small picture of their 2D symbol",
    }, {
      ja: "テンプレートを名前で探せるように。「家具なし（間取りだけ）で開く」にすると、家具を外して開きます（階段や川・塀などの外まわりは残します）",
      en: "Templates can be searched by name, and 家具なし（間取りだけ）で開く opens one without furniture (stairs and outdoor shapes such as rivers and walls stay)",
    }, {
      ja: "家具・画像を「最前面へ」「最背面へ」動かせるように。キーの操作を追加: [ ] で階の切り替え、G で方眼の表示、0 で全体を表示、+ と - で拡大・縮小、Ctrl+S でファイルに書き出し",
      en: "Furniture and images can be brought to the front or sent to the back. New keys: [ and ] switch floors, G toggles the grid, 0 fits the whole plan, + and - zoom, and Ctrl+S saves the plan file",
    }],
  },
  {
    date: "2026-10-19",
    items: [{
      ja: "床・地面と、池・花壇・芝生・ラグを、ペンで塗れるように。描き方の「ペンで塗る」を選んで2Dをドラッグすると、塗った所がその形になります。重ねて塗るとつながり、輪のように塗ると真ん中があいた形（ドーナツ）になります。「けずる」にすると、塗った所を消したり穴をあけたりできます。塗る幅も選べます。これまでの、ぐるっとなぞって囲む描き方は「囲んで描く」です。ペンのツールで池などを描くときは、はじめから「ペンで塗る」です",
      en: "Floors and ground, ponds, flower beds, lawns and rugs can be painted: choose ペンで塗る (paint) as the drawing method and drag on the 2D plan, and the painted area takes that shape. Overlapping strokes join, painting a ring leaves the middle open like a donut, and けずる (cut) erases what you paint over or opens holes. The paint width is adjustable. Tracing around an area is now called 囲んで描く (enclose), and the Pen tool paints ponds and other areas from the start",
    }, {
      ja: "テンプレートの池や芝生を、なめらかな自然な形に。引いて見たときに、花壇の花や池の縁の石が黒くつぶれないようにしました",
      en: "Ponds and lawns in the templates have smooth, natural outlines, and flower bed flowers and pond-edge stones no longer turn black when zoomed out",
    }, {
      ja: "動きを軽くしました。選ぶだけのときは3Dを作り直さず、同じ家具・ドア・窓・草は前に作った物を使い回し、影は物や光が変わったときだけ描き直します。2Dだけを表示しているあいだは3Dを作りません。起動も速くしました（一覧の見本の絵は、その欄を開いたときに作ります）",
      en: "Editing is faster: selecting no longer rebuilds the 3D view, identical furniture, doors, windows and grass reuse what was already built, shadows are redrawn only when something or the light changes, and the 3D view is not built while only the 2D plan is shown. Startup is quicker too (palette pictures are drawn when their group is opened)",
    }, {
      ja: "川の見た目を直しました。真ん中の線をやめ、岸ほど深い色の水面に、流れに沿った小さな波の印（2Dと3Dで同じ所）を付けました",
      en: "Rivers look better: no line down the middle, water that deepens in color toward the banks, and small ripple marks along the flow in the same places in 2D and 3D",
    }, {
      ja: "壁の種類を追加: コンクリート・レンガ・ブロック塀・板塀・土塀（瓦の笠つき）・ガラス・石垣・生け垣・竹垣・フェンス。一覧の「壁」から選んで2Dをドラッグすると、その種類の壁になり、選んだ壁の種類も絵から変えられます。厚み・高さ・色は種類ごとで、2Dは3Dを真上から見た形と同じです",
      en: "Added wall types: concrete, brick, block wall, board fence, earthen wall with a tile cap, glass, stone wall, hedge, bamboo fence and fence. Pick one from the new Walls group and drag on the 2D plan to draw it, or change a selected wall's type from pictures. Each type has its own thickness, height and color, and the 2D symbol matches the 3D view from above",
    }, {
      ja: "描き方に「直線で描く」と「曲線で描く」を用意しました（「囲って描く」は「直線で描く」になりました）。直線は角がとがり、点を打つ前にドラッグすると1本の直線（池などの閉じる形は四角）になります。曲線は、打った点を通るなめらかな線です。石垣・竹垣・フェンス・生け垣・線路は、はじめから直線で描けます。描き方は物ごとに覚えます",
      en: "The drawing method now offers straight lines (直線で描く) and curves (曲線で描く); \"囲って描く\" became straight lines. Straight lines keep sharp corners, and a drag before placing any point draws one straight line (a rectangle for closed shapes such as ponds). Curves pass smoothly through the clicked points. Stone walls, bamboo fences, fences, hedges and railways start as straight lines, and the method is remembered for each kind",
    }, {
      ja: "床・地面、ペン、池・川・小道などの自由な形、足跡・破片のどれも、描き方を「ペンで描く」（なぞる）か「囲って描く」（クリックで点を打つ）から選べるように。囲って描くと、点と点のあいだはまっすぐになり、閉じる形は最初の点を押すと、線は Enter かダブルクリックで描き終えます",
      en: "Floors and ground, the pen, free shapes such as ponds, rivers and paths, footprints and shards can all be drawn either by tracing (ペンで描く) or by clicking points (囲って描く). With clicked points the edges are straight; closed shapes finish when you click the first point, and lines finish with Enter or a double-click",
    }, {
      ja: "3Dの移動モード（3Dの欄の十字の矢印のボタン）を直しました。1回押せば入り、何も選んでいなくても使えます。押した物（床・壁・ドア・窓・屋根・家具など）を、そのままドラッグで動かせます。もう一度押すか Esc で終わります",
      en: "Fixed the 3D move mode (the cross-arrows button in the 3D bar): one press turns it on, even with nothing selected, and you can drag whatever you press, including floors, walls, doors, windows, roofs and furniture. Press it again or Esc to finish",
    }, {
      ja: "選んだ床の形を、なぞって描き直せるように（「なぞり直す」）。ぐるっとなぞるとその形、斜めにドラッグすると四角になります。床材・名前・色はそのままです",
      en: "A selected floor can be reshaped by tracing (なぞり直す): trace around an area for that shape, or drag diagonally for a rectangle. Its material, name and colors stay the same",
    }, {
      ja: "床材を、名前だけでなく模様の絵から選べるように",
      en: "Floor materials are chosen from pictures of their patterns, not just from a list of names",
    }, {
      ja: "ペンで川・小道・生け垣・石垣・フェンス・竹垣・線路・飛び石・池・花壇・芝生・ラグも描けるように。ペンの欄の「描く物」で選びます。川・小道・生け垣・石垣は幅も決められ、描いたあともペンのまま続けて描けます",
      en: "The pen can also draw rivers, paths, hedges, stone walls, fences, bamboo fences, railways, stepping stones, ponds, flower beds, lawns and rugs: choose one under 描く物 (what to draw) in the pen settings. Rivers, paths, hedges and stone walls have a width setting, and the pen stays ready to keep drawing",
    }, {
      ja: "ペンの太さが分かるように。描く前から、マウスの所にペン先の大きさの丸が出ます。太さを変えている間は、2Dの真ん中に同じ丸が出ます",
      en: "The pen shows its width: a circle the size of the pen tip follows the mouse before you draw, and appears in the middle of the plan while you change the width",
    }, {
      ja: "床・地面の素材と部屋を、なぞって好きな形にできるように。2Dをぐるっとなぞると、その形の床になります（これまでどおり、斜めにドラッグすると四角）",
      en: "Floors, ground and rooms can take any shape: trace around an area on the 2D plan to make a floor of that shape (a diagonal drag still makes a rectangle)",
    }, {
      ja: "なぞって形を決められる物が分かるように。一覧のボタンに波線の印を付け、ペン・池・川・小道・足跡などを「なぞって形を決める」の欄にまとめました",
      en: "Items whose shape you can trace are easy to find: their buttons carry a wave mark, and the pen, ponds, rivers, paths, footprints and more are gathered in a new trace group",
    }, {
      ja: "テンプレートを見直しました。屋根のなかったカフェ・レストラン・ラーメン屋・居酒屋・バー・コンビニ・本屋・美容院・マンション・客船・寝台列車・宇宙船・地下牢・公園のトイレに屋根を付け、魔王城・潜水艦・京町家・二世帯住宅の屋根の抜けを直し、ドアの開く所をふさいでいた家具や重なっていた家具を動かしました。新幹線の座席は、進む向きにそろえた2席と2席の列にしました",
      en: "Reviewed the templates: added roofs to the cafe, restaurant, ramen shop, izakaya, bar, convenience store, bookstore, hair salon, condominium, cruise ship, sleeper train, spaceship, dungeon and the park toilet; closed gaps in the roofs of the demon lord's castle, submarine, Kyoto townhouse and two-family house; and moved furniture that blocked doors or overlapped. Shinkansen seats now face forward in rows of two and two",
    }, {
      ja: "テンプレートを153種類に。1K・タワーマンション・京町家・日本の城・温泉・寿司屋・スーパー・教室・診療所・水族館・駅・遊園地・新幹線・冒険者ギルド・魔王城・宇宙ステーション・廃病院など103種類を足し、「和風・歴史」「学校・仕事場」「公共・医療」「文化・娯楽」「乗り物」「SF・ホラー」など11の分類に分け直しました",
      en: "153 templates: added 103, including a 1K, a high-rise condominium, a Kyoto townhouse, a Japanese castle, a hot spring, a sushi restaurant, a supermarket, a classroom, a clinic, an aquarium, a train station, an amusement park, a shinkansen, an adventurers' guild, a demon lord's castle, a space station and an abandoned hospital, regrouped into 11 groups such as Japanese and historic, Schools and workplaces, Public and medical, Culture and entertainment, Vehicles, and Sci-fi and horror",
    }, {
      ja: "映画館のテンプレートで、スクリーンが屋根から突き出ていたのを直しました",
      en: "Fixed the screen sticking out through the roof in the cinema template",
    }, {
      ja: "家具・設備の一覧の分類名を「ファンタジー」だけにしました",
      en: "The fantasy group in the furniture list is now simply called Fantasy",
    }, {
      ja: "池などを自由な形で作れるように。池・花壇・ラグは、選んで2Dをドラッグで囲むと、その形になります（クリックならいつもの形）。フェンス・竹垣・飛び石は、なぞった道すじに沿って置けます。3Dも同じ形です",
      en: "Ponds and more can now take any shape. Choose a pond, flower bed or rug and drag around an area in 2D to give it that shape (a click places the usual shape). Fences, bamboo fences and stepping stones follow the path you trace. The 3D view has the same shape",
    }, {
      ja: "自由な形で作る家具・設備を6種類追加: 芝生・川・小道・生け垣・石垣・線路。川・小道・生け垣・石垣は幅を変えられ、「選択中」で形をなぞり直したり、いつもの形に戻したりできます",
      en: "Added 6 free-shape items: lawn, river, path, hedge, stone wall and railway. Rivers, paths, hedges and stone walls have an adjustable width, and Selection lets you retrace the shape or go back to the usual one",
    }, {
      ja: "テンプレートの外まわりを作り込み。城は城壁と見張り台・門楼・堀と跳ね橋、神社は玉垣・瑞垣・二つの鳥居の長い参道・神楽殿・手水舎の屋根・池・御神木、寺は山門（二重の屋根と仁王像）・五重塔・築地塀・池と飛び石、武家屋敷は白い土塀と表門・池・枯山水、教会は芝生の庭・墓地・外灯の小道",
      en: "Templates now have detailed surroundings. The castle has curtain walls, turrets, a gatehouse, a moat and a drawbridge; the shrine a sacred fence, a long approach through two torii gates, a kagura stage, a roofed purification fountain, a pond and a sacred tree; the temple a main gate with a two-tier roof and guardian statues, a five-story pagoda, earthen walls, a pond and stepping stones; the samurai residence a white earthen wall with a gate, a pond and a dry rock garden; and the church a lawn, a graveyard and a lamp-lit path",
    }],
  },
  {
    date: "2026-10-18",
    items: [{
      ja: "3Dの絵柄を追加。3Dの欄で、標準・リアル・白模型・線画・古写真・鉛筆・水彩・墨絵・アニメ・マンガ・ドット・レトロゲーム・設計図・ネオン・ホラーの15種類から選べます。選んだ絵柄は記憶され、3Dの画像の書き出しにも使われます",
      en: "Added looks for the 3D view. Choose from 15 in the 3D bar: standard, realistic, white model, line art, old photo, pencil, watercolor, ink wash, anime, manga, pixel art, retro game, blueprint, neon and horror. The chosen look is remembered and used for 3D image export",
    }, {
      ja: "リアルの絵柄では、すべての家具・設備の材質（木目・布目・金属の筋・石の粒・陶器や漆のつや など）と光（周りの映り込み・細かい影・物の間の暗がり）を本物らしくし、空と地面も描きます",
      en: "The realistic look gives all furniture and equipment realistic materials (wood grain, fabric weave, brushed metal, stone grain, glossy ceramics and lacquer, and more) and realistic lighting (environment reflections, finer shadows and ambient occlusion), with a sky and ground",
    }, {
      ja: "3Dの左ドラッグは、画面の真ん中ではなく、押した所（マウスの下の物）を中心に回るように。上下の向きの制限もなくし、下から見上げることもできます",
      en: "Left-drag in 3D now orbits around the point you press (whatever is under the mouse) instead of the screen center, and the vertical angle is no longer limited, so you can look up from below",
    }, {
      ja: "2Dで家具・壁・床などをドラッグしている間も、3Dがすぐ追いつくように（これまでは離したときに3Dが変わりました）。3Dで家具を動かすのも軽くなりました",
      en: "The 3D view now follows while you drag furniture, walls or floors in 2D (it used to update only when you let go), and moving furniture in 3D is smoother",
    }],
  },
  {
    date: "2026-10-15",
    items: [{
      ja: "いくつかのファイルを組み合わせる「組み合わせ」を追加。書き出したファイルを、いまの間取りに足せます（いくつでも一度に選べます）。置き方は「右に並べる」「同じ位置に重ねる」「上の階に積む」から選べ、1Fは1Fへ・地下は地下へと同じ階どうしを合わせます。足した物は選ばれた状態になるので、そのままドラッグで位置を直せ、1回の「元に戻す」で取り消せます",
      en: "Added Combine for putting several files together: add exported files to the current plan (pick as many as you like at once). Place them side by side, in the same place, or stacked on top; floors are matched by level (1F to 1F, basements to basements). The added items stay selected so you can drag them into place, and one Undo removes them",
    }, {
      ja: "3Dでは、ドア・窓も家具と同じくダブルクリックで選ぶように（スマホ・タブレットは長押し）。1回のクリックでは選択を変えず、選び方を案内します",
      en: "In 3D, doors and windows are now selected with a double-click like furniture (long press on phones and tablets). A single click leaves the selection unchanged and explains how to select them",
    }],
  },
  {
    date: "2026-10-14",
    items: [{
      ja: "2Dでドアを選びやすく。開き戸・両開き・門扉は、開いた扉や開く範囲の円弧の中を押しても選べます。引き戸・障子なども、壁の厚みのぶん広く当たります",
      en: "Doors are easier to select in 2D: click anywhere inside the swing of a hinged, double or gate door, and sliding doors and shoji respond across the full wall thickness",
    }, {
      ja: "2Dで屋根を選びやすく。縁の破線だけでなく、棟などの屋根の中の線や、床も家具もない軒先を押しても選べます（軒先は選択ツールのとき）",
      en: "Roofs are easier to select in 2D: besides the dashed edge, click a line inside the roof such as the ridge, or an empty spot under the roof such as the eaves (with the Select tool)",
    }, {
      ja: "屋根ごとに置く高さを上げ下げできるように。「選択中」の「上げ下げ cm」で、設置階の壁の上からずらします（下げるときはマイナス）。同じ階の屋根でも、下屋（げや）や重なった屋根を別の高さに置けます",
      en: "Each roof can now be raised or lowered with Raise/lower (cm) under Selection, measured from the top of its floor's walls (negative to lower). Roofs on the same floor can sit at different heights, such as a lean-to below the main roof or stacked roofs",
    }, {
      ja: "家具・設備の一覧を、よく使う順に並べ直しました（建具 → 椅子・テーブル・ベッドなど家の中の家具 → 階段・床・地面・屋外・屋根 → 和風・学校・お店などの場面ごとの物 → 図形の壁）。はじめに開いておくのは建具と椅子・ソファだけです。いくつかの分類に重ねて出している物は、検索の結果では上の分類の1つだけを出します",
      en: "Reordered the furniture palette by how often things are used: openings, household furniture such as seating, tables and beds, then stairs, floors, outdoor items and roofs, then themed groups such as Japanese, school and shops, and shape walls last. Only openings and seating start open, and items shown in several groups appear once in search results",
    }, {
      ja: "家具を置く・文字を置く・消すツールのままでも、ダブルクリックでそこにある物を選べるように。2Dでも3Dでも同じで、スマホ・タブレットは2回タップか長押しです。1回目のクリックで置いた家具や消した物は取り消します",
      en: "While placing furniture or text, or erasing, a double-click now selects whatever is there, in both 2D and 3D (double tap or long press on phones and tablets). Whatever the first click placed or erased is undone",
    }, {
      ja: "家具・設備を65種類追加。鳥居・狛犬・賽銭箱・手水鉢、仏壇・神棚・床の間・かまど・提灯・竹垣・井戸・和式トイレ、黒板・ホワイトボード・教卓・学校の机と椅子・ロッカー・複合機・パーティション・金庫・消火器、カウンター・ショーケース・陳列棚・自動販売機・立て看板・カウンターチェア、病院のベッド・点滴スタンド・車椅子・診察台、すべり台・ジャングルジム・鉄棒・砂場・跳び箱・卓球台・ビリヤード台・ドラムセット・ステージ、噴水・石像・焚き火・テント・十字架の墓、カラーコーン・電柱・バス停・電話ボックス・マンホール・ドラム缶・バス、段ボール箱・室外機・扇風機・ストーブ・カーテン、宝箱・樽・木箱・玉座・祭壇・棺・檻・篝火。2Dの記号は、3Dと同じ部品を真上から見た形です。一覧に「神社・寺」「学校・オフィス」「お店・飲食店」「病院・介護」「遊具・スポーツ・音楽」「街・道路」「ファンタジー」の分類を足しました",
      en: "Added 65 furniture and equipment items: torii gate, guardian lion-dogs, offering box and purification basin; Buddhist altar, household shrine, tokonoma alcove, kamado stove, paper lantern, bamboo fence, well and squat toilet; blackboard, whiteboard, lectern, school desk and chair, locker, copier, partition, safe and fire extinguisher; counter, showcase, store shelves, vending machine, A-frame sign and bar stool; hospital bed, IV stand, wheelchair and examination couch; slide, jungle gym, horizontal bar, sandbox, vaulting box, table tennis table, pool table, drum kit and stage; fountain, statue, campfire, tent and cross grave; traffic cone, utility pole, bus stop, phone booth, manhole, oil drum and bus; cardboard box, outdoor AC unit, fan, heater and curtain; treasure chest, barrel, crate, throne, altar, coffin, cage and brazier. Each 2D symbol is the same set of parts as the 3D model seen from above. New palette groups: shrines and temples, school and office, shops and restaurants, hospital and care, playground, sports and music, streets, and fantasy",
    }, {
      ja: "床材を17種類追加: 畳・カーペット・ヘリンボーン・ウッドデッキ（板張り）・モザイクタイル・市松（チェッカー）・大理石・石畳・レンガ・コンクリート・アスファルト・鉄板（縞鋼板）・土（土間）・砂・砂利・雪・水面。2Dの模様と3Dの床は同じ模様・同じ大きさです",
      en: "Added 17 floor materials: tatami, carpet, herringbone, wooden deck, mosaic tiles, checkerboard, marble, cobblestones, brick, concrete, asphalt, checker plate, soil, sand, gravel, snow and water. The 2D pattern and the 3D floor share the same pattern at the same scale",
    }, {
      ja: "屋根の色を変えられるように。「選択中」の色の見本かカラーコードで選び、末尾2桁で透かすと、3Dで屋根越しに中が見えます",
      en: "Roof colors can now be changed under Selection with swatches or a color code. Adding two digits for transparency makes the roof see-through in 3D",
    }, {
      ja: "庭や地面の床の上にある屋根の縁も、2Dでクリックして選べるように（1階の屋根を選べないことがありました）。いま見ている階の屋根を先に選びます",
      en: "Roof edges over gardens and ground floors can now be clicked in 2D (ground-floor roofs could not be selected before). The roof of the floor being viewed is chosen first",
    }, {
      ja: "テンプレートに新しい家具と床材を使用。神社に鳥居・狛犬・賽銭箱・手水鉢と玉砂利・石畳、寺の境内も玉砂利に。学校に黒板・教卓・学校の机、病院に病院のベッド・診察台・点滴スタンド・車椅子、コンビニに陳列棚・カウンター・自動販売機、公園と保育園に遊具、キャンプ場にテントと焚き火、ダンジョンと城に玉座・篝火・宝箱。和室は畳の床、土間は土の床です",
      en: "Templates use the new furniture and floors: the shrine has a torii, lion-dogs, an offering box, a basin, gravel and a stone path, and the temple grounds are gravel; the school has blackboards, lecterns and school desks; the hospital has hospital beds, examination couches, an IV stand and a wheelchair; the convenience store has store shelves, a counter and a vending machine; the park and nursery have playground equipment; the campsite has tents and a campfire; the dungeon and castle have thrones, braziers and treasure chests. Japanese rooms have tatami floors and earthen entrances have soil",
    }],
  },
  {
    date: "2026-10-13",
    items: [{
      ja: "ドアに「両開きドア」と和風の建具（障子・襖・格子戸の玄関戸・板戸）、門扉（門戸）を追加。2Dの記号と3Dの形は、同じ戸の並びと組子・格子の位置から作ります。2.4m以上の障子・襖は引き違いの4枚建てになり、置いたあとも「扉の種類」で変えられます。日本家屋・旅館・武家屋敷・古民家・寺・神社・居酒屋・銭湯のテンプレートも、障子・襖・格子戸・板戸に変えました",
      en: "New door types: double doors, Japanese fittings (shoji, fusuma, a lattice entrance door and a plank door) and gates. 2D symbols and 3D models share the same panel layout and bar positions, shoji and fusuma 2.4 m or wider become four sliding panels, and the type can be changed after placing. The Japanese house, ryokan, samurai residence, old farmhouse, temple, shrine, izakaya and public bath templates now use these fittings",
    }, {
      ja: "家具・設備の一覧の分類を見直し。「和風」に障子・襖などのドアと座椅子・こたつ・石灯籠なども集め、「キッチン」と「浴室・トイレ・洗面」を分け、「照明・インテリア」などに整理。探しやすいよう、同じ物を複数の分類に重ねて出します",
      en: "Reorganized the furniture palette: the Japanese group now gathers shoji, fusuma and other doors along with the floor chair, kotatsu and stone lantern; the kitchen and the bath, toilet and washroom are separate; and lighting and decor are grouped. Some items appear in several groups to make them easier to find",
    }, {
      ja: "3Dで家具を1回クリックしたときは、ダブルクリックで選べることを案内するように。スマホ・タブレットでは家具を長押しすると選ばれ、そのまま指を動かすと家具を動かせます",
      en: "A single click on furniture in 3D now explains that a double-click selects it. On phones and tablets, a long press selects furniture and moving the finger drags it",
    }, {
      ja: "テンプレート「サンプル（作例）」に残っていた、試し書きの文字（「あああ…」）を消しました",
      en: "Removed leftover test text (a long row of the same character) from the Showcase template",
    }, {
      ja: "3Dの家具選択をダブルクリックに変更。1回クリックや長押しでは選択を変えず、通常のドラッグは視点回転のままです。固定した家具の選択、別の階への切り替え、Ctrl／Cmdでの複数選択にも対応。2Dの1回クリックでの選択は変わりません",
      en: "Furniture selection in 3D now requires a double-click. Single clicks and holds leave the selection unchanged, while normal dragging still orbits the camera. Locked furniture remains selectable, selecting an upper-floor item switches floors, and Ctrl/Cmd group selection is preserved. Single-click selection in 2D is unchanged",
    }, {
      ja: "正多角形の床を追加。床の形の見本から選び、3〜12辺・向き・外接円の直径を調整できます。つまみや幅・奥行の変更でも辺の長さをそろえて拡大縮小し、階段の開口を保護します。輪郭の自由編集、同じ辺数・向きの屋根の追加、保存・取り消しにも対応",
      en: "Added regular polygon floors with a visual preset, 3 to 12 sides, rotation and circumcircle diameter. Handles and dimension fields scale proportionally to preserve equal sides, and shape changes protect stairwell holes. Supports freeform contour editing, matching polygon roofs, persistence and undo",
    }],
  },
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
