import type { DoorStyle } from "./opening-shapes.ts";

export type FurnitureKind =
  | "tatami" | "zabuton" | "chabudai" | "byobu" | "shojiScreen" | "andon"
  | "stepTansu" | "irori" | "hibachi" | "engawa" | "hinokiBath" | "tsukubai"
  | "butsudan" | "kamidana" | "tokonoma" | "kamado" | "washikiToilet" | "chochin" | "takegaki" | "ido"
  | "torii" | "komainu" | "saisenBako" | "chozubachi"
  | "blackboard" | "whiteboard" | "lectern" | "schoolDesk" | "locker" | "copier" | "partition" | "safe" | "fireExtinguisher"
  | "counter" | "showcase" | "displayShelf" | "vendingMachine" | "signboard" | "barStool"
  | "hospitalBed" | "ivStand" | "wheelchair" | "examCouch"
  | "slide" | "jungleGym" | "ironBar" | "sandbox" | "vaultingBox" | "pingPongTable" | "poolTable" | "drumKit" | "stage"
  | "fountain" | "statue" | "campfire" | "tent" | "westernGrave"
  | "trafficCone" | "utilityPole" | "busStop" | "phoneBooth" | "manhole" | "drum" | "bus"
  | "cardboard" | "acOutdoor" | "fan" | "stove" | "curtain"
  | "treasureChest" | "barrel" | "crate" | "throne" | "altar" | "coffin" | "cage" | "brazier"
  | "sofa"
  | "sofaCorner"
  | "sideTable"
  | "roundTable"
  | "stool"
  | "rug"
  | "floorLamp"
  | "piano"
  | "bench"
  | "armchair"
  | "table"
  | "tv"
  | "plant"
  | "wallClock"
  | "grandfatherClock"
  | "aquarium"
  | "diningTable"
  | "chair"
  | "kitchen"
  | "fridge"
  | "bed"
  | "bedDouble"
  | "desk"
  | "shelf"
  | "bath"
  | "toilet"
  | "washbasin"
  | "washer"
  | "closet"
  | "wardrobe"
  | "stairs"
  | "stairsU"
  | "stairsSpiral"
  | "car"
  | "sofa2"
  | "officeChair"
  | "zaisu"
  | "kotatsu"
  | "longTable"
  | "deskL"
  | "bedSemiDouble"
  | "bunkBed"
  | "futon"
  | "cupboard"
  | "shoeCabinet"
  | "airConditioner"
  | "kitchenL"
  | "kitchenIsland"
  | "unitBath"
  | "shower"
  | "plantLarge"
  | "fireplace"
  | "bicycle"
  | "motorcycle"
  | "tree"
  | "conifer"
  | "palmTree"
  | "shrub"
  | "rock"
  | "steppingStones"
  | "flowerBed"
  | "pond"
  | "fence"
  | "gardenLight"
  | "stoneLantern"
  | "grave"
  | "mailbox"
  | "shed"
  | "dogHouse"
  | "parasol"
  | "clothesDryer"
  | "swing"
  | "trashCan"
  | "coatStand"
  | "crib"
  | "catTower"
  | "evidenceMarker"
  | "footprints"
  | "fallenPerson"
  | "person"
  | "paint"
  | "bloodPool"
  | "brokenGlass"
  // 自由な形（なぞって作る。free-shapes.ts）
  | "lawn" | "river" | "pathway" | "hedge" | "stoneWall" | "railway";
export interface FurnitureDef {
  label: string;
  w: number;
  h: number;
  // 高さを変えられる種類だけが持つ、標準の高さ cm
  height?: number;
}

export const FURNITURE_DEFS: Record<FurnitureKind, FurnitureDef> = {
  tatami: { label: "畳（一畳）", w: 90, h: 180, height: 6 },
  zabuton: { label: "座布団", w: 55, h: 59, height: 8 },
  chabudai: { label: "ちゃぶ台", w: 90, h: 90, height: 33 },
  byobu: { label: "屏風", w: 180, h: 45, height: 150 },
  shojiScreen: { label: "障子の衝立", w: 100, h: 35, height: 160 },
  andon: { label: "行灯", w: 32, h: 32, height: 65 },
  stepTansu: { label: "階段箪笥", w: 150, h: 45, height: 150 },
  irori: { label: "囲炉裏", w: 110, h: 110, height: 35 },
  hibachi: { label: "火鉢", w: 45, h: 45, height: 32 },
  engawa: { label: "縁台", w: 180, h: 60, height: 40 },
  hinokiBath: { label: "檜風呂", w: 160, h: 85, height: 65 },
  tsukubai: { label: "つくばい", w: 60, h: 60, height: 45 },
  butsudan: { label: "仏壇", w: 80, h: 55, height: 140 },
  // 神棚・提灯・黒板は壁に掛ける・吊るす物。高さは上の端まで
  kamidana: { label: "神棚", w: 90, h: 35, height: 210 },
  tokonoma: { label: "床の間", w: 180, h: 80, height: 200 },
  kamado: { label: "かまど", w: 160, h: 80, height: 85 },
  washikiToilet: { label: "和式トイレ", w: 45, h: 100, height: 30 },
  chochin: { label: "提灯", w: 40, h: 40, height: 230 },
  takegaki: { label: "竹垣", w: 180, h: 12, height: 150 },
  ido: { label: "井戸", w: 120, h: 120, height: 230 },
  torii: { label: "鳥居", w: 360, h: 60, height: 400 },
  komainu: { label: "狛犬", w: 50, h: 80, height: 120 },
  saisenBako: { label: "賽銭箱", w: 120, h: 60, height: 70 },
  chozubachi: { label: "手水鉢", w: 120, h: 60, height: 70 },
  blackboard: { label: "黒板", w: 360, h: 10, height: 210 },
  whiteboard: { label: "ホワイトボード", w: 180, h: 60, height: 190 },
  lectern: { label: "教卓", w: 120, h: 60, height: 100 },
  schoolDesk: { label: "学校の机と椅子", w: 65, h: 100, height: 76 },
  locker: { label: "ロッカー", w: 90, h: 50, height: 180 },
  copier: { label: "複合機（コピー機）", w: 60, h: 65, height: 115 },
  partition: { label: "パーティション", w: 120, h: 50, height: 150 },
  safe: { label: "金庫", w: 60, h: 60, height: 80 },
  fireExtinguisher: { label: "消火器", w: 25, h: 25, height: 60 },
  counter: { label: "カウンター", w: 240, h: 60, height: 100 },
  showcase: { label: "ショーケース", w: 150, h: 60, height: 100 },
  displayShelf: { label: "陳列棚", w: 180, h: 90, height: 150 },
  vendingMachine: { label: "自動販売機", w: 100, h: 75, height: 183 },
  signboard: { label: "立て看板", w: 60, h: 50, height: 100 },
  barStool: { label: "カウンターチェア", w: 40, h: 40, height: 75 },
  hospitalBed: { label: "病院のベッド", w: 100, h: 210, height: 90 },
  ivStand: { label: "点滴スタンド", w: 55, h: 55, height: 200 },
  wheelchair: { label: "車椅子", w: 62, h: 100, height: 92 },
  examCouch: { label: "診察台", w: 70, h: 190, height: 65 },
  slide: { label: "すべり台", w: 60, h: 350, height: 220 },
  jungleGym: { label: "ジャングルジム", w: 240, h: 240, height: 240 },
  ironBar: { label: "鉄棒", w: 240, h: 30, height: 120 },
  sandbox: { label: "砂場", w: 300, h: 300, height: 30 },
  vaultingBox: { label: "跳び箱", w: 80, h: 120, height: 100 },
  pingPongTable: { label: "卓球台", w: 152, h: 274, height: 91 },
  poolTable: { label: "ビリヤード台", w: 140, h: 254, height: 80 },
  drumKit: { label: "ドラムセット", w: 170, h: 140, height: 110 },
  stage: { label: "ステージ（舞台）", w: 400, h: 250, height: 60 },
  fountain: { label: "噴水", w: 300, h: 300, height: 160 },
  statue: { label: "石像", w: 70, h: 70, height: 220 },
  campfire: { label: "焚き火", w: 100, h: 100, height: 60 },
  tent: { label: "テント", w: 220, h: 160, height: 130 },
  westernGrave: { label: "十字架の墓", w: 60, h: 100, height: 110 },
  trafficCone: { label: "カラーコーン", w: 40, h: 40, height: 70 },
  utilityPole: { label: "電柱", w: 140, h: 40, height: 1000 },
  busStop: { label: "バス停", w: 60, h: 60, height: 230 },
  phoneBooth: { label: "電話ボックス", w: 90, h: 90, height: 230 },
  manhole: { label: "マンホール", w: 64, h: 64, height: 2 },
  drum: { label: "ドラム缶", w: 58, h: 58, height: 88 },
  bus: { label: "バス", w: 250, h: 1100, height: 320 },
  cardboard: { label: "段ボール箱", w: 50, h: 40, height: 35 },
  acOutdoor: { label: "室外機", w: 80, h: 30, height: 60 },
  fan: { label: "扇風機", w: 40, h: 40, height: 100 },
  stove: { label: "ストーブ", w: 48, h: 48, height: 75 },
  curtain: { label: "カーテン", w: 180, h: 15, height: 230 },
  treasureChest: { label: "宝箱", w: 80, h: 50, height: 60 },
  barrel: { label: "樽", w: 60, h: 60, height: 90 },
  crate: { label: "木箱", w: 70, h: 70, height: 70 },
  throne: { label: "玉座", w: 100, h: 90, height: 180 },
  altar: { label: "祭壇", w: 180, h: 70, height: 140 },
  coffin: { label: "棺", w: 70, h: 190, height: 55 },
  cage: { label: "檻", w: 120, h: 120, height: 150 },
  brazier: { label: "篝火（かがり火）", w: 50, h: 50, height: 150 },
  sofaCorner: { label: "L字ソファ", w: 240, h: 160 },
  sideTable: { label: "サイドテーブル", w: 50, h: 50 },
  roundTable: { label: "丸テーブル", w: 100, h: 100 },
  stool: { label: "スツール", w: 40, h: 40 },
  rug: { label: "ラグ", w: 200, h: 140 },
  floorLamp: { label: "フロアライト", w: 45, h: 45 },
  piano: { label: "ピアノ", w: 150, h: 60 },
  bench: { label: "ベンチ", w: 150, h: 55 },
  sofa: { label: "ソファ", w: 170, h: 80 },
  armchair: { label: "1人掛け", w: 80, h: 80 },
  table: { label: "ローテーブル", w: 100, h: 50 },
  tv: { label: "テレビ台", w: 120, h: 40 },
  plant: { label: "観葉植物", w: 40, h: 40 },
  wallClock: { label: "壁掛け時計", w: 50, h: 20 },
  grandfatherClock: { label: "ホールクロック", w: 60, h: 40 },
  aquarium: { label: "水槽", w: 120, h: 45 },
  diningTable: { label: "ダイニングセット", w: 160, h: 160 },
  chair: { label: "椅子", w: 45, h: 45 },
  kitchen: { label: "キッチン", w: 240, h: 65 },
  fridge: { label: "冷蔵庫", w: 65, h: 65 },
  bed: { label: "シングルベッド", w: 100, h: 200 },
  bedDouble: { label: "ダブルベッド", w: 140, h: 200 },
  desk: { label: "机", w: 120, h: 60 },
  shelf: { label: "棚・本棚", w: 90, h: 30 },
  bath: { label: "浴槽", w: 160, h: 75 },
  toilet: { label: "トイレ", w: 45, h: 75 },
  washbasin: { label: "洗面台", w: 75, h: 55 },
  washer: { label: "洗濯機", w: 65, h: 65 },
  closet: { label: "クローゼット", w: 160, h: 60 },
  wardrobe: { label: "タンス", w: 120, h: 45 },
  stairs: { label: "直階段", w: 100, h: 280 },
  stairsU: { label: "折返し階段", w: 180, h: 180 },
  stairsSpiral: { label: "らせん階段", w: 140, h: 140 },
  car: { label: "車", w: 180, h: 460 },
  sofa2: { label: "2人掛けソファ", w: 140, h: 80 },
  officeChair: { label: "オフィスチェア", w: 60, h: 60 },
  zaisu: { label: "座椅子", w: 55, h: 65 },
  kotatsu: { label: "こたつ", w: 180, h: 180 },
  longTable: { label: "長テーブル", w: 180, h: 60 },
  deskL: { label: "L字デスク", w: 140, h: 140 },
  bedSemiDouble: { label: "セミダブルベッド", w: 120, h: 200 },
  bunkBed: { label: "二段ベッド", w: 100, h: 210 },
  futon: { label: "布団", w: 100, h: 210 },
  cupboard: { label: "食器棚", w: 90, h: 45 },
  shoeCabinet: { label: "靴箱", w: 80, h: 35 },
  airConditioner: { label: "エアコン", w: 80, h: 25 },
  kitchenL: { label: "L型キッチン", w: 240, h: 180 },
  kitchenIsland: { label: "アイランドキッチン", w: 240, h: 100 },
  unitBath: { label: "ユニットバス", w: 160, h: 160 },
  shower: { label: "シャワー", w: 90, h: 90 },
  plantLarge: { label: "大きな観葉植物", w: 60, h: 60 },
  fireplace: { label: "暖炉", w: 120, h: 45 },
  bicycle: { label: "自転車", w: 60, h: 180 },
  motorcycle: { label: "バイク", w: 80, h: 210 },
  tree: { label: "木", w: 300, h: 300, height: 450 },
  conifer: { label: "針葉樹", w: 180, h: 180, height: 500 },
  palmTree: { label: "ヤシの木", w: 320, h: 320, height: 600 },
  shrub: { label: "低木・植え込み", w: 120, h: 80, height: 90 },
  rock: { label: "岩", w: 120, h: 90, height: 70 },
  steppingStones: { label: "飛び石", w: 60, h: 200 },
  flowerBed: { label: "花壇", w: 180, h: 60 },
  pond: { label: "池", w: 300, h: 200 },
  fence: { label: "フェンス", w: 180, h: 20, height: 120 },
  gardenLight: { label: "外灯", w: 30, h: 30, height: 200 },
  stoneLantern: { label: "石灯籠", w: 60, h: 60 },
  grave: { label: "墓石", w: 70, h: 80 },
  mailbox: { label: "郵便ポスト", w: 40, h: 30 },
  shed: { label: "物置", w: 180, h: 90 },
  dogHouse: { label: "犬小屋", w: 70, h: 90 },
  parasol: { label: "パラソル", w: 240, h: 240 },
  clothesDryer: { label: "物干し台", w: 240, h: 60 },
  swing: { label: "ブランコ", w: 200, h: 120 },
  trashCan: { label: "ゴミ箱", w: 40, h: 40 },
  coatStand: { label: "コートハンガー", w: 50, h: 50 },
  crib: { label: "ベビーベッド", w: 70, h: 120 },
  catTower: { label: "キャットタワー", w: 60, h: 60, height: 170 },
  evidenceMarker: { label: "番号の印", w: 24, h: 24 },
  footprints: { label: "足跡", w: 60, h: 200 },
  fallenPerson: { label: "倒れた人", w: 100, h: 180 },
  // 人の模型。手足の角度と姿勢（立つ・うつぶせ・あおむけ）を変えられる。大きさは「気をつけ」で立ったときの真上から見た形
  person: { label: "人", w: 52.2, h: 27.2 },
  // ペンで描いた線・塗り（パーツの一覧には出さず、ツールの「ペン」で描く）
  paint: { label: "ペンで描いた線", w: 30, h: 30 },
  bloodPool: { label: "血だまり", w: 90, h: 70 },
  // 割れたガラスなどの破片。なぞった道すじに沿ってまける（クリックだけなら、ひとまとまり）
  brokenGlass: { label: "破片", w: 80, h: 60 },
  // 自由な形: クリックで置くと決まった形、ドラッグでなぞると、その形（線の形は、なぞった道すじに沿う）
  lawn: { label: "芝生", w: 300, h: 200 },
  river: { label: "川", w: 400, h: 170 },
  pathway: { label: "小道", w: 300, h: 102 },
  hedge: { label: "生け垣", w: 300, h: 72, height: 120 },
  stoneWall: { label: "石垣", w: 300, h: 57, height: 100 },
  railway: { label: "線路", w: 500, h: 312 },
};

// 家具ごとの別デザインの名前（1番以降。0番は標準）。2Dの記号と3Dのモデルが、この番号で同じデザインになる
export const FURNITURE_VARIANTS: Partial<Record<FurnitureKind, string[]>> = {
  chair: ["脚付き", "丸い座面"],
  diningTable: ["脚付きの椅子", "丸い座面の椅子"],
  sofa: ["丸い肘", "背クッション"],
  sofa2: ["丸い肘", "背クッション"],
  armchair: ["丸い肘", "背クッション"],
  bed: ["布団を折り返す", "足元に帯"],
  bedSemiDouble: ["布団を折り返す", "足元に帯"],
  bedDouble: ["布団を折り返す", "足元に帯"],
  futon: ["布団を折り返す"],
  desk: ["シンプル", "両袖"],
  table: ["ガラス天板", "木目"],
  roundTable: ["ガラス天板", "木目"],
  tv: ["脚付きのテレビ"],
  fridge: ["観音開き", "シンプル"],
  washer: ["四角いふた", "ドラム式"],
  toilet: ["タンクレス", "手洗い付き"],
  bath: ["四角い浴槽"],
  washbasin: ["角形ボウル"],
  kitchen: ["ガスコンロ"],
  kitchenIsland: ["ガスコンロ"],
  closet: ["引き戸", "ルーバー扉", "斜線"],
  wardrobe: ["両開き"],
  shelf: ["オープン棚"],
  plant: ["丸い葉", "細い葉", "らせんの葉"],
  plantLarge: ["丸い葉", "細い葉", "らせんの葉"],
  rug: ["二重の縁", "ひし形の柄"],
  car: ["ワゴン"],
  rock: ["2つの岩"],
  gardenLight: ["笠付き"],
  sideTable: ["丸"],
  stool: ["四角"],
  bench: ["背もたれなし"],
  floorLamp: ["四角いシェード"],
  kotatsu: ["布団なし"],
  officeChair: ["ハイバック"],
  tree: ["丸く刈り込み"],
  shrub: ["生垣"],
  fence: ["ブロック塀"],
  flowerBed: ["丸い花壇"],
  evidenceMarker: ["丸い札"],
  footprints: ["素足"],
  fallenPerson: ["手足を広げて", "チョークの線"],
  bloodPool: ["飛び散った血", "引きずった跡"],
};

// 2Dの記号だけのデザイン（番号）。3Dは標準の形のまま
export const FURNITURE_VARIANTS_2D_ONLY: Partial<Record<FurnitureKind, number[]>> = {
  closet: [3],
};

// 家具の一覧の分類。kinds はその分類の物で、どの種類も、どれか1つの分類の kinds に入る（「種類」の選択欄はこの並び）。
// also は、ほかの分類にも重ねて出す物（探しやすいように。座布団は「和風」にも「椅子・ソファ」にも出す）。
// doorStyles は、その分類にも出すドアの種類（和風の欄の障子・襖など）。階段は別の欄、ペンの線は一覧に出さない。
// 並びはよく使う順（家の中の家具 → 屋外 → 和風・学校・お店などの場面ごとの物）
export interface FurnitureGroup {
  id: string;
  label: string;
  keywords?: string;
  kinds: FurnitureKind[];
  also?: FurnitureKind[];
  doorStyles?: DoorStyle[];
}

export const FURNITURE_GROUPS: FurnitureGroup[] = [
  { id: "seating", label: "椅子・ソファ", keywords: "いす すわる", kinds: ["sofa", "sofa2", "sofaCorner", "armchair", "chair", "officeChair", "zaisu", "stool", "barStool", "bench"], also: ["zabuton", "engawa", "throne", "wheelchair"] },
  { id: "tables", label: "テーブル・机", keywords: "つくえ てーぶる", kinds: ["diningTable", "roundTable", "table", "sideTable", "kotatsu", "longTable", "desk", "deskL"], also: ["chabudai", "counter", "schoolDesk", "lectern"] },
  { id: "beds", label: "ベッド・寝具", keywords: "べっど しんぐ ねる 寝る", kinds: ["bed", "bedSemiDouble", "bedDouble", "bunkBed", "futon", "crib"], also: ["hospitalBed"] },
  { id: "storage", label: "収納・棚", keywords: "しゅうのう たな", kinds: ["closet", "wardrobe", "shelf", "cupboard", "shoeCabinet", "coatStand", "cardboard"], also: ["stepTansu", "locker", "safe", "displayShelf", "crate"] },
  { id: "kitchen", label: "キッチン", keywords: "きっちん だいどころ 台所", kinds: ["kitchen", "kitchenL", "kitchenIsland"], also: ["fridge", "cupboard", "barStool", "kamado"] },
  { id: "bath", label: "浴室・トイレ・洗面", keywords: "よくしつ ふろ 風呂 といれ せんめん 水回り みずまわり", kinds: ["bath", "unitBath", "shower", "toilet", "washbasin"], also: ["washer", "hinokiBath", "washikiToilet"] },
  { id: "appliances", label: "家電", keywords: "かでん", kinds: ["fridge", "washer", "tv", "airConditioner", "acOutdoor", "fan", "stove"], also: ["copier", "vendingMachine"] },
  { id: "decor", label: "照明・インテリア", keywords: "しょうめい あかり いんてりあ 飾り かざり", kinds: ["plant", "plantLarge", "rug", "floorLamp", "fireplace", "wallClock", "grandfatherClock", "aquarium", "piano", "trashCan", "catTower", "curtain"], also: ["andon", "byobu", "shojiScreen", "irori", "hibachi", "chochin", "partition"] },
  { id: "outdoor", label: "屋外・庭", keywords: "おくがい にわ そと 外", kinds: ["tree", "conifer", "palmTree", "shrub", "rock", "steppingStones", "flowerBed", "pond", "lawn", "river", "pathway", "hedge", "stoneWall", "fence", "takegaki", "gardenLight", "stoneLantern", "grave", "westernGrave", "mailbox", "shed", "dogHouse", "parasol", "clothesDryer", "swing", "ido", "fountain", "statue", "campfire", "tent"], also: ["bench", "tsukubai", "engawa", "torii", "acOutdoor", "bicycle", "car"], doorStyles: ["gate"] },
  {
    id: "japanese",
    label: "和風（和室・和の設備）",
    keywords: "わふう 和 和室 わしつ 日本 にほん 和の",
    kinds: ["tatami", "zabuton", "chabudai", "byobu", "shojiScreen", "andon", "stepTansu", "irori", "hibachi", "engawa", "hinokiBath", "tsukubai", "butsudan", "kamidana", "tokonoma", "kamado", "washikiToilet", "chochin"],
    also: ["zaisu", "kotatsu", "futon", "stoneLantern", "steppingStones", "pond", "grave", "takegaki", "hedge", "stoneWall", "ido", "torii"],
    doorStyles: ["shoji", "fusuma", "koshi", "itado", "gate"],
  },
  { id: "school", label: "学校・オフィス", keywords: "がっこう 学校 きょうしつ 教室 おふぃす 事務所 じむしょ 会社 かいしゃ 職員室", kinds: ["blackboard", "whiteboard", "lectern", "schoolDesk", "locker", "copier", "partition", "safe", "fireExtinguisher"], also: ["desk", "deskL", "officeChair", "longTable", "shelf", "vaultingBox", "piano"] },
  { id: "shop", label: "お店・飲食店", keywords: "おみせ 店 みせ 店舗 てんぽ しょうてん 商店 いんしょくてん 飲食店 れすとらん カフェ バー", kinds: ["counter", "showcase", "displayShelf", "vendingMachine", "signboard"], also: ["barStool", "diningTable", "chair", "roundTable", "kitchen", "chochin", "trashCan"] },
  { id: "people", label: "人・事件・調査", keywords: "ひと じけん ちょうさ TRPG", kinds: ["person", "fallenPerson", "footprints", "evidenceMarker", "bloodPool", "brokenGlass"] },
  { id: "vehicles", label: "乗り物", keywords: "のりもの くるま", kinds: ["car", "motorcycle", "bicycle", "bus"] },
  { id: "hospital", label: "病院・介護", keywords: "びょういん 病院 いりょう 医療 かいご 介護 しんりょうじょ 診療所 保健室 ほけんしつ", kinds: ["hospitalBed", "ivStand", "wheelchair", "examCouch"], also: ["curtain", "partition", "washbasin"] },
  { id: "street", label: "街・道路", keywords: "まち 街 町 どうろ 道路 みち 道 ろじょう 路上 こうじ 工事", kinds: ["trafficCone", "utilityPole", "busStop", "phoneBooth", "manhole", "drum", "railway"], also: ["pathway", "river", "car", "bus", "bicycle", "vendingMachine", "acOutdoor", "mailbox", "gardenLight", "fence", "bench", "tree", "trashCan", "signboard", "fireExtinguisher"] },
  { id: "shrine", label: "神社・寺", keywords: "じんじゃ 神社 てら 寺 お寺 おてら 神道 仏教 参道", kinds: ["torii", "komainu", "saisenBako", "chozubachi"], also: ["stoneLantern", "chochin", "kamidana", "butsudan", "brazier", "takegaki", "grave", "tsukubai"], doorStyles: ["gate"] },
  { id: "play", label: "遊具・スポーツ・音楽", keywords: "ゆうぐ 遊具 こうえん 公園 すぽーつ 運動 うんどう たいいく 体育 おんがく 音楽 がっき 楽器 あそび 遊び", kinds: ["slide", "jungleGym", "ironBar", "sandbox", "vaultingBox", "pingPongTable", "poolTable", "drumKit", "stage"], also: ["swing", "piano"] },
  { id: "fantasy", label: "ファンタジー", keywords: "ふぁんたじー ファンタジー 異世界 いせかい ダンジョン だんじょん 城 しろ 中世 ちゅうせい ぼうけん 冒険", kinds: ["treasureChest", "barrel", "crate", "throne", "altar", "coffin", "cage", "brazier"], also: ["statue", "campfire", "westernGrave", "fountain", "tent", "river", "stoneWall"] },
];

// 左の一覧の並び（よく使う順）。家具の分類は FURNITURE_GROUPS の id、ほかは建具・階段・なぞって形を決める物・床材・屋根・図形の壁の欄
export type PaletteSection = "fittings" | "walls" | "stairs" | "trace" | "surfaces" | "roofs" | "shapes";
export const PALETTE_ORDER: string[] = [
  "fittings", "walls", "seating", "tables", "beds", "storage", "kitchen", "bath", "appliances", "decor",
  "stairs", "trace", "surfaces", "outdoor", "roofs",
  "japanese", "school", "shop", "people", "vehicles", "hospital", "street", "shrine", "play", "fantasy",
  "shapes",
];
