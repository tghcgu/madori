export type FurnitureKind =
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
  | "motorcycle";
export interface FurnitureDef {
  label: string;
  w: number;
  h: number;
}

export const FURNITURE_DEFS: Record<FurnitureKind, FurnitureDef> = {
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
};
