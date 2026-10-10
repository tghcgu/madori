export type FurnitureKind =
  | "tatami" | "zabuton" | "chabudai" | "byobu" | "shojiScreen" | "andon"
  | "stepTansu" | "irori" | "hibachi" | "engawa" | "hinokiBath" | "tsukubai"
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
  | "brokenGlass";
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
