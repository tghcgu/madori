import { createIcons, icons } from "lucide";
import "./styles.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SURFACE_DEFS, SURFACE_TILE_CM, isRoomSurface, surfaceCanvas, type RoomSurface } from "./surfaces";
import { openingIntervals, segmentInterval, solidWallSections, visibleRectangles, type Rectangle } from "./geometry";
import { readStoredPlan, type Recovery } from "./persistence";
import { FURNITURE_DEFS, FURNITURE_VARIANTS, FURNITURE_VARIANTS_2D_ONLY, type FurnitureKind } from "./furniture-catalog";
import { colorAlpha, parseColorCode, solidColor, withAlpha } from "./colors";
import { makeTranslucent } from "./translucency";
import {
  CONIFER_TIERS, PALM_FROND_ANGLES, PETAL_ANGLES, PLANT_LEAF_ANGLES, RIPPLE_END, RIPPLE_START, ROUND_LEAF_CLUMPS,
  closetDoorCount, fernFronds, flowerBedLayout, pondShape, rockShapes, steppingStoneLayout, woodGrain, type RockShape,
  CAT_TOWER_DECKS, COAT_HOOK_ANGLES, COAT_HOOK_REACH, DRYER_POLES, PARASOL_CORNERS,
  blockWallCaps, cribRail, dryerFootWidth, roundFlowerBedLayout, spiralPlantTopView,
  CHALK_WIDTH, SHARD_SPREAD, bloodShape, evidenceMarkerShape, markerTextSize, markerTextureSpan, shardMargin, shardPieces, shardTrail,
  FOOTPRINT_STRIDE, footprintPathTrail, footprintPieces,
  PERSON_HEIGHT, PERSON_PRESETS, POSTURES, editablePersonPose, normalizePersonPose, personDesign, personLayout, personOutline, personRefSize, presetPose, reachHandle,
  type LimbAngles, type PersonLayout, type PersonPose, type Point2, type Posture, type StoneSlab, type TrunkAngles,
} from "./furniture-shapes";
import { buildFurnitureModel } from "./furniture-models";
import { buildOpeningModel } from "./opening-models";

// 間取り専用版（3Dなし）。/plan/ で開いたとき（index.html の先頭で印を付ける）は、同じアプリで3Dの欄と3Dだけの設定を出さない。
// 間取りのデータは本体と同じ所に保存するので、どちらで開いても同じ間取りを続けて編集できる
const PLAN_EDITION = document.documentElement.dataset.edition === "plan";
// 上のバーの「間取り専用版もできました」のお知らせと、開発中の注意書きを消したか
const EDITION_NOTICE_KEY = "madori-quick-3d-plan-edition-notice";
const ALPHA_NOTE_KEY = "madori-quick-3d-alpha-note";

type Tool = "select" | "paint" | "room" | "wall" | "door" | "slidingDoor" | "window" | "window2" | "furniture" | "circle" | "arc" | "polygon" | "text" | "erase";
type EntityType = "room" | "wall" | "door" | "window" | "furniture" | "shape" | "roof" | "text";
type ShapeKind = "circle" | "arc" | "polygon";
type RoofKind = "gable" | "hip" | "flat";
type LegacyRoofKind = RoofKind | "none";
type LightDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw" | "top";
type DragMode = "draw" | "move" | "resize" | "label" | "pan" | "path" | "pose" | "none";
type ViewMode = "split" | "plan" | "three";

interface Point {
  x: number;
  y: number;
}

interface Room {
  id: string;
  type: "room";
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  color3d?: string;
  surface?: RoomSurface;
  labelOffsetX?: number;
  labelOffsetY?: number;
  locked?: boolean;
}

interface LinearElement {
  id: string;
  type: "wall" | "door" | "window";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  color3d?: string;
  flip?: boolean;
  mullion?: boolean;
  doorStyle?: "swing" | "sliding";
  locked?: boolean;
}

interface Furniture {
  id: string;
  type: "furniture";
  kind: FurnitureKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  color?: string;
  color3d?: string;
  flip?: boolean;
  // 2D記号の別デザインの番号（1から）。0（標準）のときは持たない
  symbol?: number;
  // 木やフェンスなど、高さを変えられる家具の高さ cm。標準の高さのときは持たない
  height?: number;
  // 番号の印に書く文字（番号）。番号の印だけが持つ
  markerLabel?: string;
  // 足跡: なぞった道すじ（家具の中心が原点、幅・奥行に対する割合）と歩幅 cm（標準のときは持たない）
  path?: number[][];
  stride?: number;
  // 人: 姿勢と手足の角度（手足を動かすまでは持たない）
  pose?: PersonPose;
  // ペンで描いた線: 太さ cm と、囲んで塗りつぶすか（道すじは path）。破片では brush がまく幅
  brush?: number;
  filled?: boolean;
  // 破片の量（1 がふつう）
  density?: number;
  locked?: boolean;
}

interface Shape {
  id: string;
  type: "shape";
  kind: ShapeKind;
  x: number;
  y: number;
  r: number;
  startAngle: number;
  endAngle: number;
  sides?: number;
  rotation?: number;
  color?: string;
  color3d?: string;
  locked?: boolean;
}

interface Roof {
  id: string;
  type: "roof";
  kind: RoofKind;
  x: number;
  y: number;
  w: number;
  h: number;
  floorId?: string;
  locked?: boolean;
}

// 2Dの間取りだけに表示する自由な文字。x, y は文字のまとまりの中心
interface TextLabel {
  id: string;
  type: "text";
  text: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  color?: string;
  locked?: boolean;
}

type Entity = Room | LinearElement | Furniture | Shape | Roof | TextLabel;

interface Floor {
  id: string;
  name: string;
  entities: Entity[];
}

interface PlanState {
  // 下の階から順。先頭の basements 個が地下の階（B1F, B2F …）で、その次が1F
  floors: Floor[];
  activeFloor: number;
  selectedId: string | null;
  roofs: Roof[];
  basements?: number;
}

interface PointerState {
  dragMode: DragMode;
  pointerId: number | null;
  startScreen: Point;
  startView: Point;
  startWorld: Point;
  currentWorld: Point;
  originEntity: Entity | null;
  resizeCorner: string | null;
  // 足跡をなぞっている点
  path?: Point[];
  // 動かしている手首・足首（0 左手、1 右手、2 左足、3 右足）
  limb?: number;
}

interface ThreeDrag {
  pointerId: number;
  startScreen: Point;
  startWorld: Point;
  origin: Furniture;
  planeY: number;
  created: boolean;
  moved: boolean;
}

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Required DOM node is missing: ${selector}`);
  }
  return element;
}

const planCanvas = requiredElement<HTMLCanvasElement>("#planCanvas");
const threeCanvas = requiredElement<HTMLCanvasElement>("#threeCanvas");
const workspace = requiredElement<HTMLElement>(".workspace");
const planPane = requiredElement<HTMLElement>(".plan-pane");
const threePane = requiredElement<HTMLElement>(".three-pane");
const splitDivider = requiredElement<HTMLDivElement>("#splitDivider");
const propertiesPanel = requiredElement<HTMLDivElement>("#propertiesPanel");
const planStats = requiredElement<HTMLSpanElement>("#planStats");
const threeStats = requiredElement<HTMLSpanElement>("#threeStats");
const saveStatus = requiredElement<HTMLSpanElement>("#saveStatus");
const importInput = requiredElement<HTMLInputElement>("#importInput");
const dimensionToggle = requiredElement<HTMLButtonElement>("#dimensionToggle");
const furniturePicker = requiredElement<HTMLDivElement>("#furniturePicker");
const paletteSearch = requiredElement<HTMLInputElement>("#paletteSearch");
const paletteEmpty = requiredElement<HTMLParagraphElement>("#paletteEmpty");
const roofPicker = requiredElement<HTMLDivElement>("#roofPicker");
const roofList = requiredElement<HTMLDivElement>("#roofList");
const floorTabs = requiredElement<HTMLDivElement>("#floorTabs");
const canvasContext = planCanvas.getContext("2d");
if (!canvasContext) {
  throw new Error("2D canvas is not supported.");
}
// 記号の見本を小さなキャンバスに描くときだけ、一時的に描き先を差し替える
let ctx: CanvasRenderingContext2D = canvasContext;

const STORAGE_KEY = "madori-quick-3d-plan";
const VIEW_MODE_KEY = "madori-quick-3d-view-mode";
const DIMENSION_LABELS_KEY = "madori-quick-3d-dimension-labels";
const SHADOWS_KEY = "madori-quick-3d-shadows";
const LIGHT_DIRECTION_KEY = "madori-quick-3d-light-direction";
const LIGHT_LEVEL_KEY = "madori-quick-3d-light-level";
const GHOST_FLOOR_KEY = "madori-quick-3d-ghost-floor";
const MOBILE_NOTICE_KEY = "madori-quick-3d-mobile-notice";
const SPLIT_KEY = "madori-quick-3d-split";
const VIEW_STATE_KEY = "madori-quick-3d-view-state";
// 同時表示での2Dの広さの割合（2Dと3Dの合計に対して）。どちらも狭くなりすぎないよう範囲を決める
const MIN_SPLIT = 0.15;
const MAX_SPLIT = 0.85;
const SPLIT_KEY_STEP = 0.05;
// 2Dの倍率（1cmあたりの画面上のpx）と3Dのカメラ距離（m）の範囲。どちらもほぼ無限に寄ったり引いたりできる
const MIN_PLAN_ZOOM = 0.0001;
const MAX_PLAN_ZOOM = 10000;
const MIN_CAMERA_DISTANCE = 0.01;
const MAX_CAMERA_DISTANCE = 100000;
// 2Dの方眼の線の間隔が、画面上でこれより狭くならないように間隔を5倍ずつ変える
const MIN_GRID_PIXELS = 10;
// これより拡大したら、部屋の中にも方眼を薄く重ねる。白い部屋の中まで寄ったときも、動かしているのが分かるように
const GRID_OVER_ROOMS_ZOOM = 4;
// 3Dの右ドラッグ移動で、つかんだ物がこれより近くても、この距離（m）にある物をつかんだ速さで動かす
const MIN_PAN_DEPTH = 0.5;
const HISTORY_LIMIT = 60;
const GRID = 20;
const SCALE_3D = 0.01;
const WALL_THICKNESS_2D = 10;
const WALL_HEIGHT = 2.6;
const FLOOR_SLAB = 0.15;
const FLOOR_SPACING = WALL_HEIGHT + FLOOR_SLAB;
// 開口の高さ範囲（壁がドア・窓と重なった部分だけを切り抜くために使う）
const DOOR_HEAD_Y = 2.1;
const WINDOW_SILL_Y = 0.84;
const WINDOW_HEAD_Y = 1.96;
// 光量5段階の倍率
const LIGHT_LEVELS = [0.5, 0.75, 1, 1.3, 1.6];

function isMobileOrTabletDevice(): boolean {
  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: { mobile?: boolean };
  };
  const isIpadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  // 「PC版サイトを表示」にしているスマホは名乗りがPCと同じになるため、指で操作する小さめの画面かどうかでも見分ける
  const touchFirstScreen =
    window.matchMedia("(pointer: coarse) and (hover: none)").matches &&
    Math.min(window.screen.width, window.screen.height) <= 1100;
  return Boolean(
    navigatorWithUserAgentData.userAgentData?.mobile ||
      isIpadOs ||
      touchFirstScreen ||
      /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle/i.test(navigator.userAgent),
  );
}

const INK = "#000000";
const TEXT_FONT = '"Yu Gothic UI", "Hiragino Sans", Meiryo, sans-serif';
const TEXT_LINE_HEIGHT = 1.25;
const DEFAULT_TEXT_SIZE = 24;
const MAX_TEXT_LENGTH = 500;
// 椅子の背もたれ・枕など、向きを示す部分の塗り
const SYMBOL_SHADE = "#dde4e2";
const SYMBOL_PREVIEW_SIZE = 48;
const MIN_FURNITURE_HEIGHT = 10;
const MAX_FURNITURE_HEIGHT = 3000;
// 草地の3Dに生やす草の束の密度と、1つの床あたりの上限（重くしすぎない）
const GRASS_TUFTS_PER_M2 = 70;
const GRASS_MAX_TUFTS = 7000;
// 草が突き抜けて見えてしまう、低くて平たいもの。この下には草を生やさない
const GRASS_FREE_KINDS: FurnitureKind[] = ["pond", "steppingStones", "rug"];

// 家具の別デザインの2Dの描き方。名前と数は FURNITURE_VARIANTS（3Dと共通）に合わせ、同じ順に並べる。
// 0番（標準）は drawFurnitureSymbol の本体で描き、ここには1番以降を並べる
type SymbolDraw = (w: number, h: number, item?: Furniture) => void;

interface SymbolVariant {
  label: string;
  draw: SymbolDraw;
}

const SYMBOL_DRAWS: Partial<Record<FurnitureKind, SymbolDraw[]>> = {
  chair: [drawChairWithLegs, drawRoundSeatChair],
  diningTable: [(w, h) => drawDiningSet(w, h, drawChairWithLegs), (w, h) => drawDiningSet(w, h, drawRoundSeatChair)],
  sofa: [drawRoundArmSofa, (w, h) => drawCushionSofa(w, h, sofaSeats("sofa", w))],
  sofa2: [drawRoundArmSofa, (w, h) => drawCushionSofa(w, h, sofaSeats("sofa2", w))],
  armchair: [drawRoundArmSofa, (w, h) => drawCushionSofa(w, h, 1)],
  bed: [(w, h) => drawFoldedBed(w, h, 1), (w, h) => drawRunnerBed(w, h, 1)],
  bedSemiDouble: [(w, h) => drawFoldedBed(w, h, 1), (w, h) => drawRunnerBed(w, h, 1)],
  bedDouble: [(w, h) => drawFoldedBed(w, h, 2), (w, h) => drawRunnerBed(w, h, 2)],
  futon: [drawFoldedFuton],
  desk: [drawSimpleDesk, drawDoublePedestalDesk],
  table: [(w, h) => drawGlassTable(w, h, false), (w, h) => drawWoodTable(w, h, false)],
  roundTable: [(w, h) => drawGlassTable(w, h, true), (w, h) => drawWoodTable(w, h, true)],
  tv: [drawTvWithLegs],
  fridge: [drawFrenchDoorFridge, drawSimpleFridge],
  washer: [drawLidWasher, drawDrumWasher],
  toilet: [drawTanklessToilet, drawHandWashToilet],
  bath: [drawSquareBath],
  washbasin: [drawSquareWashbasin],
  kitchen: [(w, h) => drawKitchenSymbol(w, h, false, true)],
  kitchenIsland: [(w, h) => drawKitchenSymbol(w, h, true, true)],
  closet: [drawSlidingCloset, drawLouverCloset, drawHatchedCloset],
  wardrobe: [drawDoubleDoorWardrobe],
  shelf: [drawOpenShelf],
  plant: [drawRoundLeafPlant, drawPalmPlant, drawSpiralPlant],
  plantLarge: [drawRoundLeafPlant, drawPalmPlant, drawSpiralPlant],
  rug: [drawBorderRug, drawDiamondRug],
  car: [drawWagonCar],
  rock: [(w, h) => drawRocks(rockShapes(w, h, 1))],
  gardenLight: [drawCappedGardenLight],
  sideTable: [drawRoundSideTable],
  stool: [drawSquareStool],
  bench: [drawBacklessBench],
  floorLamp: [drawSquareFloorLamp],
  kotatsu: [drawKotatsuTable],
  officeChair: [drawHighBackOfficeChair],
  tree: [drawTopiaryTree],
  shrub: [drawHedge],
  fence: [drawBlockWall],
  flowerBed: [drawRoundFlowerBed],
  evidenceMarker: [(w, h) => drawEvidenceMarker(w, h, 1)],
  footprints: [(w, h, item) => drawFootprints(w, h, true, item)],
  fallenPerson: [(w, h, item) => drawPersonSymbol(w, h, item, "fallenPerson", 1), (w, h, item) => drawPersonSymbol(w, h, item, "fallenPerson", 2)],
  bloodPool: [(w, h) => drawBlood(w, h, 1), (w, h) => drawBlood(w, h, 2)],
};

const SYMBOL_VARIANTS: Partial<Record<FurnitureKind, SymbolVariant[]>> = Object.fromEntries(
  (Object.entries(FURNITURE_VARIANTS) as [FurnitureKind, string[]][]).map(([kind, labels]) => {
    const draws = SYMBOL_DRAWS[kind] ?? [];
    if (draws.length !== labels.length) throw new Error(`2D symbol variants do not match the catalog: ${kind}`);
    return [kind, labels.map((label, index) => ({ label, draw: draws[index] }))];
  }),
);
const INK_SOFT = "#5b6470";
// 屋外の記号の塗り（葉・幹・石・土・水）
const OUTDOOR_LEAF = "#e3eedb";
const OUTDOOR_TRUNK = "#d8cbb6";
const OUTDOOR_STONE = "#e6e4de";
const OUTDOOR_SOIL = "#efe5d6";
const OUTDOOR_WATER = "#dcebf2";

// 家具は置く部屋ではなく種類で分ける。創作では部屋の種類が決まっていないことが多いため
const FURNITURE_CATEGORIES: { label: string; kinds: FurnitureKind[] }[] = [
  { label: "椅子・ソファ", kinds: ["sofa", "sofa2", "sofaCorner", "armchair", "chair", "officeChair", "zaisu", "stool", "bench"] },
  { label: "テーブル・机", kinds: ["diningTable", "roundTable", "table", "sideTable", "kotatsu", "longTable", "desk", "deskL"] },
  { label: "ベッド", kinds: ["bed", "bedSemiDouble", "bedDouble", "bunkBed", "futon", "crib"] },
  { label: "収納・棚", kinds: ["closet", "wardrobe", "shelf", "cupboard", "shoeCabinet", "coatStand"] },
  { label: "家電", kinds: ["fridge", "washer", "tv", "airConditioner"] },
  { label: "キッチン・水回り", kinds: ["kitchen", "kitchenL", "kitchenIsland", "bath", "unitBath", "shower", "toilet", "washbasin"] },
  { label: "インテリア", kinds: ["plant", "plantLarge", "rug", "floorLamp", "fireplace", "wallClock", "grandfatherClock", "aquarium", "piano", "trashCan", "catTower"] },
  { label: "屋外・庭", kinds: ["tree", "conifer", "palmTree", "shrub", "rock", "steppingStones", "flowerBed", "pond", "fence", "gardenLight", "stoneLantern", "mailbox", "shed", "dogHouse", "parasol", "clothesDryer", "swing"] },
  { label: "乗り物", kinds: ["car", "motorcycle", "bicycle"] },
  { label: "人・事件・調査", kinds: ["person", "fallenPerson", "footprints", "evidenceMarker", "bloodPool", "brokenGlass"] },
];

// 床に付いた跡（足跡・血）は、2Dの色をそのまま跡の塗りにする。色を決めていないときの塗り
const MARK_FILLS: Partial<Record<FurnitureKind, string>> = { footprints: "#6b625a", bloodPool: "#a3201c", brokenGlass: "#dcedf4" };
// 番号の印に書ける文字数
const MAX_MARKER_LABEL = 4;
// 階段は家具の種類分けに入れず、パレットでは床材や図形の壁と並べて下の方に置く
const STAIR_KINDS: FurnitureKind[] = ["stairs", "stairsU", "stairsSpiral"];

// 検索で表記ゆれ（ひらがな・別名）を拾うための語。表示名と分類名は自動で検索対象になる
const SEARCH_KEYWORDS: Record<string, string> = {
  evidenceMarker: "ばんごう 番号 数字 すうじ 印 しるし マーカー 証拠 しょうこ 札 ふだ 事件 じけん 調査 ちょうさ 探索 TRPG",
  footprints: "あしあと 足 あし 靴 くつ 素足 はだし 跡 あと 痕跡 こんせき 事件 じけん TRPG",
  fallenPerson: "ひと 人 人型 ひとがた 死体 したい 遺体 いたい 倒れた たおれた 被害者 ひがいしゃ チョーク 事件 じけん TRPG 模型 もけい マネキン ポーズ",
  person: "ひと 人 人間 にんげん 人物 じんぶつ 人型 ひとがた 模型 もけい マネキン ポーズ 立つ たつ 立っている 座る すわる 歩く あるく TRPG",
  bloodPool: "ち 血 血痕 けっこん 血だまり ちだまり しぶき 跡 あと 事件 じけん TRPG",
  brokenGlass: "はへん かけら 割れたガラス がらす ガラス 割れ われ 窓 まど 瓦礫 がれき 陶器 とうき 皿 さら 木片 散らばる ちらばる 事件 じけん TRPG",
  sofa: "ソファー", sofaCorner: "ソファー コーナー", armchair: "椅子 いす イス チェア ソファー ひとりがけ",
  chair: "いす イス チェア", stool: "椅子 いす イス", bench: "椅子 いす イス 屋外",
  diningTable: "テーブル 食卓 しょくたく 椅子 いす", roundTable: "まるテーブル", table: "座卓 ちゃぶ台",
  desk: "つくえ デスク 勉強", bed: "ベット 寝台 布団", bedDouble: "ベット 寝台 布団",
  closet: "押入れ おしいれ 収納", wardrobe: "箪笥 たんす 収納", shelf: "たな ほんだな ラック",
  fridge: "れいぞうこ", washer: "せんたくき", tv: "テレビ てれび TV",
  kitchen: "台所 だいどころ 流し シンク コンロ", bath: "よくそう 風呂 ふろ お風呂 バス",
  toilet: "便器 べんき", washbasin: "せんめんだい 洗面所",
  plant: "かんようしょくぶつ 植物 しょくぶつ 木 グリーン", rug: "じゅうたん 絨毯 カーペット マット",
  floorLamp: "照明 しょうめい ライト ランプ", wallClock: "とけい 時計", grandfatherClock: "とけい 時計 柱時計",
  aquarium: "すいそう 魚 さかな", piano: "楽器 がっき", car: "くるま 自動車 じどうしゃ 屋外",
  stairs: "かいだん", stairsU: "かいだん", stairsSpiral: "かいだん 螺旋",
  sofa2: "ソファー 2人掛け ふたりがけ", officeChair: "椅子 いす イス チェア デスクチェア 事務",
  zaisu: "ざいす 椅子 いす イス 和室", kotatsu: "テーブル 炬燵 和室", longTable: "会議 机 つくえ 折りたたみ",
  deskL: "つくえ 机 デスク 勉強", bedSemiDouble: "ベット 寝台", bunkBed: "ベット 2段 にだん 子供",
  futon: "ふとん 寝具 和室", cupboard: "しょっきだな 棚 たな 収納", shoeCabinet: "くつばこ 下駄箱 げたばこ 玄関 収納",
  airConditioner: "えあこん クーラー 冷房 暖房 AC", kitchenL: "台所 だいどころ", kitchenIsland: "台所 だいどころ",
  unitBath: "ゆにっとばす 風呂 ふろ お風呂 浴室 UB", shower: "風呂 ふろ 浴室",
  plantLarge: "かんようしょくぶつ 植物 しょくぶつ 木 グリーン", fireplace: "だんろ 暖房",
  bicycle: "じてんしゃ チャリ", motorcycle: "オートバイ 二輪",
  tree: "き じゅもく 樹木 樹 庭木 にわき 広葉樹 ツリー 庭 にわ 屋外 外 そと",
  conifer: "しんようじゅ き 木 樹木 樹 杉 すぎ 松 まつ もみ ツリー 庭 にわ 屋外 外 そと",
  palmTree: "やし 椰子 き 木 樹木 樹 南国 庭 にわ 屋外 外 そと",
  shrub: "ていぼく うえこみ 植込み 生垣 いけがき 植物 しょくぶつ 木 き 庭 にわ 屋外 外 そと",
  rock: "いわ 石 いし 岩石 がんせき 庭 にわ 屋外 外 そと",
  steppingStones: "とびいし 石 いし 通路 庭 にわ 屋外 外 そと",
  flowerBed: "かだん 花 はな プランター 庭 にわ 屋外 外 そと",
  pond: "いけ 水 みず 池泉 庭 にわ 屋外 外 そと",
  fence: "ふぇんす 柵 さく 塀 へい 囲い かこい 庭 にわ 屋外 外 そと",
  gardenLight: "がいとう 街灯 照明 しょうめい ライト 庭園灯 庭 にわ 屋外 外 そと",
  stoneLantern: "いしどうろう 灯籠 とうろう 和風 庭 にわ 屋外 外 そと",
  mailbox: "ゆうびん ポスト 郵便受け 玄関 げんかん 屋外 外 そと",
  shed: "ものおき 倉庫 そうこ 収納 庭 にわ 屋外 外 そと",
  dogHouse: "いぬごや 犬 いぬ ペット 庭 にわ 屋外 外 そと",
  parasol: "ぱらそる 日傘 ひがさ 傘 かさ ガーデン 庭 にわ 屋外 外 そと",
  clothesDryer: "ものほし 物干し竿 ものほしざお 洗濯 せんたく 干す ベランダ 庭 にわ 屋外 外 そと",
  swing: "ぶらんこ 遊具 ゆうぐ 公園 こうえん 子供 庭 にわ 屋外 外 そと",
  trashCan: "ごみばこ ごみ箱 ダストボックス くずかご",
  coatStand: "こーとはんがー ハンガー ポールハンガー 衣類 いるい 収納",
  crib: "べびーべっど 赤ちゃん あかちゃん 子供 こども ベット",
  catTower: "きゃっとたわー 猫 ねこ ペット",
};

const ROOM_COLORS = ["#ffffff", "#fdfdfc", "#fbfcfd", "#fcfbf9", "#fbfcfb", "#fdfcfd"];
const ROOF_LABELS: Record<RoofKind, string> = {
  gable: "切妻",
  hip: "寄棟",
  flat: "陸屋根",
};

// ---- 画像の書き出しの設定（起動時のメニューの組み立てでも使うので、ここで決める） ----

const EXPORT_MARGIN = 60;
// 書き出す画像の線の太さや文字の大きさの割合は、この大きさの2Dの画面で全体を表示したときと同じにする。
// 1cmあたりの大きさを決めて大きな間取りを書き出すと、線や文字が画像に比べて細く小さくなり、縮めて見ると薄く見えるため
const EXPORT_VIEW_WIDTH = 1600;
const EXPORT_VIEW_HEIGHT = 1000;
// 細かさは画面の2倍以上で、1cmが1.5ピクセル以上
const EXPORT_PIXEL_RATIO = 2;
const EXPORT_MIN_PIXELS_PER_CM = 1.5;
// どの端末でも作れる大きさに抑える
const EXPORT_MAX_SIDE = 8192;
const EXPORT_MAX_PIXELS = 16_000_000;

interface ImageExportSettings {
  floors: "current" | "all" | "each";
  grid: boolean;
  names: boolean;
}

const imageExportSettings: ImageExportSettings = { floors: "current", grid: true, names: true };

// 2D画面の上が北（3Dの-z）。値は「光が差す方角」に太陽を置く位置。
const LIGHT_POSITIONS: Record<LightDirection, [number, number, number]> = {
  n: [0, 12, -14],
  ne: [10, 12, -10],
  e: [14, 12, 0],
  se: [10, 12, 10],
  s: [0, 12, 14],
  sw: [-10, 12, 10],
  w: [-14, 12, 0],
  nw: [-10, 12, -10],
  top: [0.6, 18, 0.6],
};

let activeTool: Tool = "select";
let activeFurniture: FurnitureKind = "sofa";
// 種類ごとに最後に選んだ2D記号。続けて置く家具も同じ描き方にそろえる（見ていた場所などと一緒にブラウザへ保存）
const lastSymbolByKind: Partial<Record<FurnitureKind, number>> = {};
let activeRoomSurface: RoomSurface = "plain";
let activePolygonSides = 6;
// 間取り専用版はいつも2Dだけ（表示の切り替えは本体の設定として残す）
let viewMode: ViewMode = PLAN_EDITION ? "plan" : loadViewMode();
let showDimensions = loadDimensionLabels();
// 画像を書き出している間だけ、部屋の名前を省く
let hideRoomNames = false;
// デザインの見本を描いている間だけ true（起動直後の選択中パネルでも使うので、ここで宣言しておく）
let symbolPreview = false;
// 足跡の歩幅 cm の範囲と、「道すじを描き直す」を押した足跡（次になぞった道すじで描き直す）
const MIN_STRIDE = 20;
const MAX_STRIDE = 200;
let footprintRedrawId: string | null = null;
// 手足を動かしている間の3Dの描き直し。1コマに1回だけにし、選択中のパネルは作り直さない（動かしているスライダーが外れないように）
let threeRefreshQueued = false;
// ペンの色・太さ・描き方（見ていた場所などと一緒にブラウザへ保存）
const PEN_DEFAULT_COLOR = "#9b1c17";
const DEFAULT_BRUSH = 15;
const penSettings: { color: string; brush: number; filled: boolean } = { color: PEN_DEFAULT_COLOR, brush: DEFAULT_BRUSH, filled: false };
const MAX_BRUSH = 300;
// 次になぞって描く破片の、まく幅と量（選んだ破片で変えると、次からもそれを使う）
const shardSettings: { spread: number; density: number } = { spread: SHARD_SPREAD, density: 1 };
const SHARD_DENSITIES: [number, string][] = [[0.5, "少なめ"], [1, "ふつう"], [2, "多め"]];
// ペンのよく使う色（血の色が最初）
const PEN_COLORS: [string, string][] = [
  ["#9b1c17", "血の色"], ["#e03131", "赤"], ["#f08c00", "だいだい"], ["#f2c230", "黄"], ["#2f9e44", "緑"], ["#1c7ed6", "青"],
  ["#7048e8", "紫"], ["#8b5a2b", "茶"], ["#222222", "黒"], ["#868e96", "灰"], ["#ffffff", "白"],
];
let shadowsEnabled = loadShadowsEnabled();
let lightDirection: LightDirection = loadLightDirection();
let lightLevel = loadLightLevel();
let showGhostFloor = loadGhostFloor();
// 透かす階（"below" すぐ下 / "above" すぐ上 / "all" ほかの階すべて / 階のID）、透かす色（空なら元の色）、濃さ
const DEFAULT_GHOST_OPACITY = 0.13;
const ghostSettings: { target: string; color: string; opacity: number } = { target: "below", color: "", opacity: DEFAULT_GHOST_OPACITY };
// 透かす階をいったん描く作業用のキャンバス（起動直後の描画でも使うので、ここで宣言しておく）
let ghostCanvas: HTMLCanvasElement | null = null;
// 透明度のある色の要素をいったん描く作業用のキャンバス（同じく起動直後から使う）
let translucentCanvas: HTMLCanvasElement | null = null;

// 透かす色のカラーコードに透明度があればそれを、なければ「濃さ」を使う
function ghostOpacity(): number {
  const tint = parseColorCode(ghostSettings.color);
  return tint && tint.alpha < 1 ? tint.alpha : ghostSettings.opacity;
}
let storageRecovery: Recovery | null = null;
let state: PlanState = loadInitialState();
let history: PlanState[] = [cloneState(state)];
let historyIndex = 0;
let view = { zoom: 1, x: 0, y: 0 };
let appResizeObserver: ResizeObserver | null = null;
let saveTimer: number | null = null;
let drag: PointerState = {
  dragMode: "none",
  pointerId: null,
  startScreen: { x: 0, y: 0 },
  startView: { x: 0, y: 0 },
  startWorld: { x: 0, y: 0 },
  currentWorld: { x: 0, y: 0 },
  originEntity: null,
  resizeCorner: null,
};
let threePointerDown: Point | null = null;
let threeDrag: ThreeDrag | null = null;
let threeSceneCenter: Point = { x: 0, y: 0 };
let threeNeedsRender = true;
let pendingCameraFrame = true;
let pendingTextFocus = false;
let roofVisible3d = true;
// 間取り(2D)上の屋根の一時的な表示切替。保存はしない
let roofVisible2d = true;
const hiddenFloorIds = new Set<string>();

const renderer = new THREE.WebGLRenderer({
  canvas: threeCanvas,
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9edf3);
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = false;
controls.minDistance = MIN_CAMERA_DISTANCE;
controls.maxDistance = MAX_CAMERA_DISTANCE;
// 奥まで寄れるよう、マウスのある場所に向かって拡大縮小する。1目盛りの倍率は2Dとほぼ同じ
controls.zoomToCursor = true;
controls.zoomSpeed = 2;
controls.maxPolarAngle = Math.PI * 0.48;
controls.addEventListener("change", () => {
  threeNeedsRender = true;
  scheduleViewStateSave();
});

const planGroup = new THREE.Group();
scene.add(planGroup);
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();

const hemiLight = new THREE.HemisphereLight(0xffffff, 0xaeb7c3, 1.6);
scene.add(hemiLight);
const sunLight = new THREE.DirectionalLight(0xffffff, 2.4);
sunLight.position.set(8, 14, 10);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -14;
sunLight.shadow.camera.right = 14;
sunLight.shadow.camera.top = 14;
sunLight.shadow.camera.bottom = -14;
scene.add(sunLight);

const coloredMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f1ec, roughness: 0.78 });
const wallCapMaterial = new THREE.MeshStandardMaterial({ color: 0xe2ddd5, roughness: 0.8 });
const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x405064, transparent: true, opacity: 0.55 });
const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x5d6773, roughness: 0.86, side: THREE.DoubleSide });
const slabMaterial = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.85 });
const sharedMaterials = new Set<THREE.Material>([
  wallMaterial, wallCapMaterial, edgeMaterial, roofMaterial, slabMaterial,
]);

// 再読み込みしても、見ていた場所や表示の切り替えをそのまま戻す（間取りのデータとは別に、このブラウザだけに保存）
interface SavedViewState {
  // 2Dの画面の中央にある点（cm）と倍率。画面の大きさが変わっても同じ所が中央に来るようにする
  plan?: { x: number; y: number; zoom: number };
  // 3Dのカメラと回転の中心。シーンの中心ではなく、間取りの原点からの位置（m）で持つ
  camera?: { position: number[]; target: number[] };
  hiddenFloors?: string[];
  roofs2d?: boolean;
  roofs3d?: boolean;
  panelHidden?: boolean;
  // 左の一覧の開閉。見出しの文字ごとに持つ
  panels?: Record<string, boolean>;
  symbols?: Partial<Record<FurnitureKind, number>>;
  ghost?: { target?: string; color?: string; opacity?: number };
  imageExport?: { floors?: string; grid?: boolean; names?: boolean };
  pen?: { color?: string; brush?: number; filled?: boolean };
  shards?: { spread?: number; density?: number };
}

const viewState: SavedViewState = loadViewState();
// 起動して元に戻し終えるまでは、途中の表示で記録を上書きしない
let viewStateReady = false;
let viewStateTimer = 0;

function isRoofKind(value: unknown): value is RoofKind {
  return value === "gable" || value === "hip" || value === "flat";
}

function isLegacyRoofKind(value: unknown): value is LegacyRoofKind {
  return value === "none" || isRoofKind(value);
}

function normalizeRoof(value: unknown): Roof | null {
  const item = value as Partial<Roof>;
  if (!item || !isRoofKind(item.kind)) return null;
  const x = Number(item.x);
  const y = Number(item.y);
  const w = Number(item.w);
  const h = Number(item.h);
  if (![x, y, w, h].every(Number.isFinite)) return null;
  return {
    id: typeof item.id === "string" ? item.id : newId("roof"),
    type: "roof",
    kind: item.kind,
    x,
    y,
    w: Math.max(GRID * 2, w),
    h: Math.max(GRID * 2, h),
    floorId: typeof item.floorId === "string" ? item.floorId : undefined,
    locked: item.locked === true ? true : undefined,
  };
}

function legacyRoofs(kind: unknown, floors: Floor[]): Roof[] {
  if (!isLegacyRoofKind(kind) || kind === "none") return [];
  const sourceFloor = [...floors].reverse().find((floor) => floor.entities.length > 0);
  if (!sourceFloor) return [];
  const bounds = getEntitiesBounds(sourceFloor.entities.filter(isRoom)) ?? getEntitiesBounds(sourceFloor.entities);
  if (!bounds) return [];
  const overhang = 40;
  return [roof(kind, bounds.x - overhang, bounds.y - overhang, bounds.w + overhang * 2, bounds.h + overhang * 2)];
}

function normalizePlan(parsed: unknown, recover = false): PlanState | null {
  const data = parsed as Partial<PlanState> & { entities?: Entity[]; roof?: unknown };
  const normalizeEntities = (items: unknown[]): Entity[] => items.flatMap((item) => {
    try {
      return [normalizeEntity(item)];
    } catch (error) {
      if (!recover) throw error;
      return [];
    }
  });
  if (data && Array.isArray(data.floors)) {
    if (!recover && data.floors.some((floor) => !floor || !Array.isArray(floor.entities))) throw new Error("Invalid floor");
    const floors: Floor[] = data.floors
      .filter((floor): floor is Floor => Boolean(floor) && Array.isArray((floor as Floor).entities))
      .map((floor, index) => ({
        id: typeof floor.id === "string" ? floor.id : newId("floor"),
        name: `${index + 1}F`,
        entities: normalizeEntities(floor.entities),
      }));
    if (floors.length === 0) return null;
    const basements = clamp(Math.round(Number(data.basements ?? 0)) || 0, 0, floors.length - 1);
    floors.forEach((floor, index) => (floor.name = floorLabel(index, basements)));
    const roofs = Array.isArray(data.roofs)
      ? data.roofs.flatMap((item) => {
        const normalized = normalizeRoof(item);
        if (!normalized && !recover) throw new Error("Invalid roof");
        return normalized ? [normalized] : [];
      })
      : legacyRoofs(data.roof, floors);
    roofs.forEach((item) => {
      if (!floors.some((floor) => floor.id === item.floorId)) item.floorId = floors[floors.length - 1].id;
    });
    return {
      floors,
      activeFloor: clamp(Math.round(Number(data.activeFloor ?? 0)) || 0, 0, floors.length - 1),
      selectedId: data.selectedId ?? null,
      roofs,
      ...(basements ? { basements } : {}),
    };
  }
  if (data && Array.isArray(data.entities)) {
    return {
      floors: [{ id: newId("floor"), name: "1F", entities: normalizeEntities(data.entities) }],
      activeFloor: 0,
      selectedId: data.selectedId ?? null,
      roofs: [],
    };
  }
  return null;
}

function normalizeEntity(value: unknown): Entity {
  if (!value || typeof value !== "object") throw new Error("Invalid plan entity");
  const entity = value as Entity;
  const finite = (...values: unknown[]) => values.every((item) => typeof item === "number" && Number.isFinite(item));
  // #RGB / #RRGGBB / #RRGGBBAA（末尾2桁が透明度）を受け付け、#rrggbb か #rrggbbaa にそろえる
  const color = (input: unknown) => parseColorCode(input)?.code;
  const base = {
    id: typeof entity.id === "string" && entity.id ? entity.id : newId("room"),
    locked: entity.locked === true,
  };
  if (entity.type === "roof") {
    const normalized = normalizeRoof(entity);
    if (normalized) return normalized;
  }
  if (entity.type === "room" || entity.type === "furniture") {
    if (!finite(entity.x, entity.y, entity.w, entity.h) || entity.w <= 0 || entity.h <= 0) throw new Error("Invalid dimensions");
    if (entity.type === "room") {
      return {
        ...entity, ...base,
        name: typeof entity.name === "string" ? entity.name : "",
        color: color(entity.color) ?? "#ffffff", color3d: color(entity.color3d),
        surface: isRoomSurface(entity.surface) ? entity.surface : "plain",
        labelOffsetX: finite(entity.labelOffsetX) ? entity.labelOffsetX : undefined,
        labelOffsetY: finite(entity.labelOffsetY) ? entity.labelOffsetY : undefined,
      };
    }
    if (!Object.prototype.hasOwnProperty.call(FURNITURE_DEFS, entity.kind)) throw new Error("Unknown furniture kind");
    return {
      ...entity, ...base, color: color(entity.color), color3d: color(entity.color3d),
      rotation: finite(entity.rotation) ? entity.rotation : 0,
      symbol: validSymbol(entity.kind, entity.symbol) || undefined,
      markerLabel: entity.kind === "evidenceMarker" && typeof entity.markerLabel === "string" ? entity.markerLabel.slice(0, MAX_MARKER_LABEL) : undefined,
      path: entity.kind === "footprints" || entity.kind === "brokenGlass" ? normalizeFootprintPath(entity.path) : undefined,
      stride: entity.kind === "footprints" && finite(entity.stride) ? clamp(Math.round(entity.stride!), MIN_STRIDE, MAX_STRIDE) : undefined,
      pose: isPersonKind(entity.kind) ? normalizePersonPose(entity.pose) : undefined,
      ...(entity.kind === "brokenGlass" ? {
        brush: finite(entity.brush) ? clamp(Math.round(entity.brush!), 5, MAX_BRUSH) : undefined,
        density: SHARD_DENSITIES.some(([value]) => value === entity.density) ? entity.density : undefined,
      } : {}),
      ...(entity.kind === "paint" ? {
        path: normalizePaintPath(entity.path),
        brush: finite(entity.brush) ? clamp(Math.round(entity.brush!), 1, MAX_BRUSH) : DEFAULT_BRUSH,
        filled: entity.filled === true ? true : undefined,
      } : {}),
      height: FURNITURE_DEFS[entity.kind].height !== undefined && finite(entity.height)
        ? clamp(Math.round(entity.height!), MIN_FURNITURE_HEIGHT, MAX_FURNITURE_HEIGHT)
        : undefined,
    };
  }
  if (entity.type === "wall" || entity.type === "door" || entity.type === "window") {
    if (!finite(entity.x1, entity.y1, entity.x2, entity.y2)) throw new Error("Invalid line coordinates");
    return { ...entity, ...base, color: color(entity.color), color3d: color(entity.color3d) };
  }
  if (entity.type === "shape" && ["circle", "arc", "polygon"].includes(entity.kind)) {
    if (!finite(entity.x, entity.y, entity.r) || entity.r <= 0) throw new Error("Invalid shape");
    return {
      ...entity, ...base, color: color(entity.color), color3d: color(entity.color3d),
      startAngle: finite(entity.startAngle) ? entity.startAngle : 0,
      endAngle: finite(entity.endAngle) ? entity.endAngle : Math.PI * 2,
      sides: finite(entity.sides) ? clamp(Math.round(entity.sides!), 3, 12) : 6,
      rotation: finite(entity.rotation) ? entity.rotation : 0,
    };
  }
  if (entity.type === "text") {
    if (!finite(entity.x, entity.y)) throw new Error("Invalid text position");
    return {
      id: base.id, type: "text", locked: base.locked,
      text: typeof entity.text === "string" ? entity.text.slice(0, MAX_TEXT_LENGTH) : "",
      x: entity.x, y: entity.y,
      size: finite(entity.size) ? clamp(entity.size, 5, 500) : DEFAULT_TEXT_SIZE,
      rotation: finite(entity.rotation) ? entity.rotation : 0,
      color: color(entity.color),
    };
  }
  throw new Error("Unknown plan entity");
}

function loadInitialState(): PlanState {
  const params = new URLSearchParams(window.location.search);
  const templateKey = params.get("template");
  if (templateKey) {
    const plan = makeTemplate(templateKey);
    const floorParam = Number(params.get("floor"));
    if (Number.isFinite(floorParam) && floorParam >= 1) {
      plan.activeFloor = clamp(Math.round(floorParam) - 1, 0, plan.floors.length - 1);
    }
    return plan;
  }
  const stored = readStoredPlan(localStorage, STORAGE_KEY, normalizePlan);
  storageRecovery = stored.recovery;
  return stored.plan ?? (storageRecovery ? emptyState() : makeTemplate("starter"));
}

function emptyState(): PlanState {
  return {
    floors: [{ id: newId("floor"), name: "1F", entities: [] }],
    activeFloor: 0,
    selectedId: null,
    roofs: [],
  };
}

function loadViewMode(): ViewMode {
  const stored = localStorage.getItem(VIEW_MODE_KEY);
  return stored === "plan" || stored === "three" || stored === "split" ? stored : "split";
}

function loadDimensionLabels(): boolean {
  return localStorage.getItem(DIMENSION_LABELS_KEY) === "visible";
}

function loadShadowsEnabled(): boolean {
  const param = new URLSearchParams(window.location.search).get("shadows");
  if (param === "off") return false;
  if (param === "on") return true;
  return localStorage.getItem(SHADOWS_KEY) !== "off";
}

function loadLightDirection(): LightDirection {
  const stored = localStorage.getItem(LIGHT_DIRECTION_KEY);
  return stored && stored in LIGHT_POSITIONS ? (stored as LightDirection) : "se";
}

function loadGhostFloor(): boolean {
  return localStorage.getItem(GHOST_FLOOR_KEY) !== "off";
}

function loadLightLevel(): number {
  const stored = Number(localStorage.getItem(LIGHT_LEVEL_KEY));
  return Number.isInteger(stored) && stored >= 1 && stored <= LIGHT_LEVELS.length ? stored : 3;
}

function applyLightSettings(): void {
  threeNeedsRender = true;
  const [x, y, z] = LIGHT_POSITIONS[lightDirection];
  sunLight.position.set(x, y, z);
  // castShadow の切替はシェーダー再構築が必要で確実に効かないため、影の濃度を0にする方式にする
  sunLight.shadow.intensity = shadowsEnabled ? 1 : 0;
  const level = LIGHT_LEVELS[lightLevel - 1];
  if (shadowsEnabled) {
    // 通常: 太陽光で立体感を出す
    sunLight.intensity = 2.4 * level;
    hemiLight.intensity = 1.6 * level;
    hemiLight.groundColor.set(0xaeb7c3);
  } else {
    // 影オフ: 太陽光を完全に消し、均一な環境光のみのフラットな見た目にする
    sunLight.intensity = 0;
    hemiLight.intensity = 3.5 * level;
    hemiLight.groundColor.set(0xffffff);
  }
}

function activeFloor(): Floor {
  return state.floors[state.activeFloor];
}

function activeEntities(): Entity[] {
  return activeFloor().entities;
}

function setupUi(): void {
  document.querySelectorAll<HTMLButtonElement>("button[data-view-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      applyViewMode(button.dataset.viewMode as ViewMode);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTool = button.dataset.tool as Tool;
      footprintRedrawId = null;
      // ペンでは選択を外し、選択中の欄にペンの色・太さを出す
      if (activeTool === "paint") state.selectedId = null;
      updatePropertiesPanel();
      render2d();
      if (activeTool === "room") activeRoomSurface = "plain";
      setActiveButton("[data-surface]", activeTool === "room" ? activeRoomSurface : "");
      setActiveButton("[data-tool]", activeTool);
      syncPlanCursor();
    });
  });

  buildFurniturePicker();
  restorePanelOpenStates();
  paletteSearch.addEventListener("input", applyPaletteSearch);

  roofPicker.querySelectorAll<HTMLButtonElement>("[data-roof-add]").forEach((button) => {
    button.addEventListener("click", () => {
      addRoof(button.dataset.roofAdd as RoofKind);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-template]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.template ?? "oneLdk";
      if (!window.confirm("現在の間取りを雛形で置き換えます。実行しますか？")) {
        return;
      }
      replaceState(makeTemplate(key), true);
    });
  });

  dimensionToggle.addEventListener("click", () => {
    showDimensions = !showDimensions;
    localStorage.setItem(DIMENSION_LABELS_KEY, showDimensions ? "visible" : "hidden");
    updateDimensionToggle();
    renderRoofList();
    render2d();
  });

  document.querySelector<HTMLButtonElement>("#roofToggle2d")?.addEventListener("click", () => {
    roofVisible2d = !roofVisible2d;
    // 見えない屋根のハンドルやキー操作が残らないよう、隠すときは選択を外す
    if (!roofVisible2d && state.roofs.some((item) => item.id === state.selectedId)) state.selectedId = null;
    updateUi();
    render2d();
    rebuildThree();
  });

  setupGhostMenu();
  setupImageExport();
  setupEdition();
  setupTopNote();
  setupFeedbackForm();
  setupCreditCopy();
  const ghostToggle = document.querySelector<HTMLButtonElement>("#ghostToggle");
  ghostToggle?.addEventListener("click", () => {
    showGhostFloor = !showGhostFloor;
    localStorage.setItem(GHOST_FLOOR_KEY, showGhostFloor ? "on" : "off");
    ghostToggle.classList.toggle("is-active", showGhostFloor);
    ghostToggle.setAttribute("aria-pressed", String(showGhostFloor));
    render2d();
  });
  ghostToggle?.classList.toggle("is-active", showGhostFloor);
  ghostToggle?.setAttribute("aria-pressed", String(showGhostFloor));

  const mobileNotice = document.querySelector<HTMLElement>("#mobileNotice");
  if (mobileNotice && isMobileOrTabletDevice()) {
    mobileNotice.classList.add("is-mobile-device");
    // 閉じた記録を残し続けると二度と出なくなるため、閉じても開いている間だけ隠す。以前の記録は消す
    localStorage.removeItem(MOBILE_NOTICE_KEY);
    if (sessionStorage.getItem(MOBILE_NOTICE_KEY) === "dismissed") {
      mobileNotice.classList.add("is-dismissed");
    }
    document.querySelector<HTMLButtonElement>("#mobileNoticeClose")?.addEventListener("click", () => {
      mobileNotice.classList.add("is-dismissed");
      sessionStorage.setItem(MOBILE_NOTICE_KEY, "dismissed");
      requestAnimationFrame(() => {
        resizeCanvases();
        render2d();
        render3dOnce();
      });
    });
  }

  const panelToggle = document.querySelector<HTMLButtonElement>("#panelToggle");
  panelToggle?.addEventListener("click", () => {
    const hidden = workspace.dataset.panel === "hidden";
    if (hidden) {
      delete workspace.dataset.panel;
    } else {
      workspace.dataset.panel = "hidden";
    }
    panelToggle.setAttribute("aria-pressed", String(!hidden));
    requestAnimationFrame(() => {
      resizeCanvases();
      render2d();
      render3dOnce();
    });
    scheduleViewStateSave();
  });

  document.querySelector<HTMLButtonElement>("#shadowToggle")?.addEventListener("click", () => {
    shadowsEnabled = !shadowsEnabled;
    localStorage.setItem(SHADOWS_KEY, shadowsEnabled ? "on" : "off");
    applyLightSettings();
    updateShadowToggle();
  });

  const lightSelect = document.querySelector<HTMLSelectElement>("#lightDirectionSelect");
  if (lightSelect) {
    lightSelect.value = lightDirection;
    lightSelect.addEventListener("change", () => {
      lightDirection = lightSelect.value as LightDirection;
      localStorage.setItem(LIGHT_DIRECTION_KEY, lightDirection);
      applyLightSettings();
    });
  }

  const lightLevelSelect = document.querySelector<HTMLSelectElement>("#lightLevelSelect");
  if (lightLevelSelect) {
    lightLevelSelect.value = String(lightLevel);
    lightLevelSelect.addEventListener("change", () => {
      lightLevel = Number(lightLevelSelect.value) || 3;
      localStorage.setItem(LIGHT_LEVEL_KEY, String(lightLevel));
      applyLightSettings();
    });
  }

  document.querySelector<HTMLButtonElement>("#undoButton")?.addEventListener("click", undo);
  document.querySelector<HTMLButtonElement>("#redoButton")?.addEventListener("click", redo);
  document.querySelector<HTMLButtonElement>("#fitButton")?.addEventListener("click", () => {
    fitPlanToCanvas();
    render2d();
    frameCamera(getGlobalBounds());
  });
  document.querySelector<HTMLButtonElement>("#resetButton")?.addEventListener("click", () => {
    if ((state.roofs.length || state.floors.some((floor) => floor.entities.length)) && !window.confirm("現在の間取りを消去して新規作成します。実行しますか？")) return;
    replaceState(emptyState(), true);
  });
  document.querySelector<HTMLButtonElement>("#exportButton")?.addEventListener("click", exportPlan);
  document.querySelector<HTMLButtonElement>("#importButton")?.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", importPlan);
  if (storageRecovery) {
    const recovery = storageRecovery;
    if (!recovery.backupSaved) saveStatus.textContent = "元データ保護中・自動保存停止";
    requiredElement<HTMLElement>("#recoveryNotice").hidden = false;
    const recoveredItems = state.floors.reduce((sum, floor) => sum + floor.entities.length, 0) + state.roofs.length;
    requiredElement<HTMLElement>("#recoveryMessage").textContent = !recovery.backupSaved
      ? "保存データを完全には読み込めません。元データを保護するため、自動保存を停止しています。編集中の内容は書き出してください。"
      : recoveredItems > 0
        ? "保存データに読み込めない項目がありました。元データを退避し、読み込める内容を復旧しました。"
        : "保存データが壊れていたため読み込めませんでした。元データは退避してあり、「元データを書き出し」から取り出せます。";
    requiredElement<HTMLButtonElement>("#recoveryExportButton").addEventListener("click", () => downloadJson(recovery.raw, `madori-recovery-${localDateStamp()}.json`));
    requiredElement<HTMLButtonElement>("#recoveryCloseButton").addEventListener("click", () => {
      requiredElement<HTMLElement>("#recoveryNotice").hidden = true;
    });
  }

  planCanvas.addEventListener("pointerdown", handlePointerDown);
  planCanvas.addEventListener("pointermove", handlePointerMove);
  planCanvas.addEventListener("pointerup", handlePointerUp);
  planCanvas.addEventListener("pointercancel", handlePointerUp);
  planCanvas.addEventListener("wheel", handleWheel, { passive: false });
  planCanvas.addEventListener("contextmenu", (event) => event.preventDefault());
  planCanvas.addEventListener("dblclick", handleDoubleClick);
  threeCanvas.addEventListener("pointerdown", handleThreePointerDown, { capture: true });
  threeCanvas.addEventListener("pointermove", handleThreePointerMove);
  threeCanvas.addEventListener("pointerup", handleThreePointerUp);
  threeCanvas.addEventListener("pointercancel", cancelThreeDrag);
  threeCanvas.addEventListener("lostpointercapture", cancelThreeDrag);
  window.addEventListener("keydown", handleKeyDown);

  bindSplitDivider();
  appResizeObserver = new ResizeObserver(() => {
    fitPlanBar();
    resizeCanvases();
    render2d();
    render3dOnce();
    updateSplitDivider();
  });
  appResizeObserver.observe(planCanvas);
  appResizeObserver.observe(threeCanvas);
  resizeCanvases();
  updateDimensionToggle();
  updateShadowToggle();
  applyLightSettings();
  updateUi();
}

function buildFurniturePicker(): void {
  furniturePicker.innerHTML = "";

  // よく使う建具と家具を上に、床材・階段・図形の壁は下に置く。屋根はHTML側で最後に並ぶ
  const fittings = createPaletteGroup("建具（ドア・窓）", true, "たてぐ");
  ([
    ["door", "ドア", "とびら 扉 開き戸"],
    ["slidingDoor", "引き戸", "ひきど 扉 スライド"],
    ["window", "窓", "まど"],
    ["window2", "窓（区切付き）", "まど"],
  ] as [Tool, string, string][]).forEach(([tool, label, keywords]) => {
    const button = createPaletteButton(label, keywords, () => {
      activeTool = tool;
      setActiveButton("[data-tool]", activeTool);
      syncPlanCursor();
    });
    button.dataset.tool = tool;
    fittings.items.appendChild(button);
  });
  furniturePicker.appendChild(fittings.details);

  FURNITURE_CATEGORIES.forEach((category, categoryIndex) => {
    const group = createPaletteGroup(category.label, categoryIndex === 0);
    category.kinds.forEach((kind) => group.items.appendChild(createFurnitureButton(kind)));
    furniturePicker.appendChild(group.details);
  });

  const surfaces = createPaletteGroup("床・地面", true, "ゆか 床 素材");
  (Object.keys(SURFACE_DEFS) as RoomSurface[]).forEach((surface) => {
    const button = createPaletteButton(SURFACE_DEFS[surface].label, "ゆか 床", () => {
      activeRoomSurface = surface;
      activeTool = "room";
      setActiveButton("[data-surface]", surface);
      setActiveButton("[data-tool]", activeTool);
      syncPlanCursor();
    });
    button.dataset.surface = surface;
    const swatch = document.createElement("span");
    swatch.className = "surface-swatch";
    swatch.style.backgroundImage = `url(${surfaceCanvas(surface, SURFACE_DEFS[surface].color).toDataURL()})`;
    button.prepend(swatch);
    surfaces.items.appendChild(button);
  });
  furniturePicker.appendChild(surfaces.details);

  const stairs = createPaletteGroup("階段", false, "かいだん");
  STAIR_KINDS.forEach((kind) => stairs.items.appendChild(createFurnitureButton(kind)));
  furniturePicker.appendChild(stairs.details);

  const shapes = createPaletteGroup("図形の壁", false, "図形 ずけい 壁 かべ");
  ([
    ["circle", 0, "円", "えん まる"],
    ["arc", 0, "円弧", "えんこ カーブ"],
    ["poly3", 3, "三角形", "さんかく"],
    ["poly4", 4, "四角形", "しかく"],
    ["poly5", 5, "五角形", "ごかく"],
    ["poly6", 6, "六角形", "ろっかく"],
    ["poly8", 8, "八角形", "はっかく"],
  ] as [string, number, string, string][]).forEach(([key, sides, label, keywords]) => {
    const button = createPaletteButton(label, keywords, () => {
      if (key === "circle" || key === "arc") {
        activeTool = key;
      } else {
        activeTool = "polygon";
        activePolygonSides = sides;
      }
      setActiveButton("[data-shape]", key);
      setActiveButton("[data-tool]", activeTool);
      syncPlanCursor();
    });
    button.dataset.shape = key;
    shapes.items.appendChild(button);
  });
  furniturePicker.appendChild(shapes.details);

  // 屋根の欄はHTMLに固定で置いてあるので、検索用の語だけ付ける
  const roofCategory = requiredElement<HTMLDetailsElement>("#roofCategory");
  roofCategory.dataset.search = normalizeSearchText("屋根 やね");
  const roofKeywords: Record<RoofKind, string> = { gable: "きりづま", hip: "よせむね", flat: "ろくやね りくやね フラット" };
  roofPicker.querySelectorAll<HTMLButtonElement>("[data-roof-add]").forEach((button) => {
    const kind = button.dataset.roofAdd as RoofKind;
    button.dataset.search = normalizeSearchText(`${ROOF_LABELS[kind]} ${roofKeywords[kind]}`);
  });

  applyPaletteSearch();
}

function createPaletteGroup(label: string, open: boolean, keywords = ""): { details: HTMLDetailsElement; items: HTMLDivElement } {
  const details = document.createElement("details");
  details.className = "furniture-category palette-group";
  details.open = open;
  details.dataset.search = normalizeSearchText(`${label} ${keywords}`);
  const summary = document.createElement("summary");
  summary.textContent = label;
  const items = document.createElement("div");
  items.className = "furniture-items";
  details.append(summary, items);
  return { details, items };
}

function createPaletteButton(label: string, keywords: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.search = normalizeSearchText(`${label} ${keywords}`);
  button.addEventListener("click", onClick);
  return button;
}

function createFurnitureButton(kind: FurnitureKind): HTMLButtonElement {
  const button = createPaletteButton(FURNITURE_DEFS[kind].label, SEARCH_KEYWORDS[kind] ?? "", () => {
    activeFurniture = kind;
    footprintRedrawId = null;
    setActiveButton("[data-furniture]", activeFurniture);
    activeTool = "furniture";
    setActiveButton("[data-tool]", activeTool);
    syncPlanCursor();
  });
  button.dataset.furniture = kind;
  if (activeTool === "furniture" && kind === activeFurniture) button.classList.add("is-active");
  return button;
}

// カタカナをひらがなに、全角英数を半角にそろえ、「ソファ」と「そふぁ」などを同じ語として扱う
function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function applyPaletteSearch(): void {
  const terms = normalizeSearchText(paletteSearch.value).split(/\s+/).filter(Boolean);
  const searching = terms.length > 0;
  let anyMatch = false;
  document.querySelectorAll<HTMLElement>(".palette-section").forEach((section) => {
    let sectionMatch = false;
    section.querySelectorAll<HTMLDetailsElement>(".palette-group").forEach((group) => {
      const groupText = group.dataset.search ?? "";
      let groupMatch = false;
      group.querySelectorAll<HTMLButtonElement>("button[data-search]").forEach((button) => {
        const text = `${button.dataset.search} ${groupText}`;
        const match = !searching || terms.every((term) => text.includes(term));
        button.classList.toggle("palette-hidden", !match);
        groupMatch ||= match;
      });
      // 検索中は該当する分類だけを開き、検索をやめたら元の開閉状態に戻す
      if (searching) {
        if (group.dataset.wasOpen === undefined) group.dataset.wasOpen = String(group.open);
        group.open = groupMatch;
      } else if (group.dataset.wasOpen !== undefined) {
        group.open = group.dataset.wasOpen === "true";
        delete group.dataset.wasOpen;
      }
      group.classList.toggle("palette-hidden", searching && !groupMatch);
      sectionMatch ||= groupMatch;
    });
    section.classList.toggle("palette-hidden", searching && !sectionMatch);
    anyMatch ||= sectionMatch;
  });
  paletteEmpty.hidden = !searching || anyMatch;
}

function renderFloorTabs(): void {
  floorTabs.innerHTML = "";
  const basement = document.createElement("button");
  basement.type = "button";
  basement.className = "floor-tab floor-tab-ghost";
  basement.textContent = "＋B";
  basement.title = "地下の階を追加（いちばん下に増えます）";
  basement.addEventListener("click", addBasement);
  floorTabs.appendChild(basement);
  // 階のタブだけを横に並べる。階が多くて入りきらないときはここだけ横にスクロールし、追加・削除のボタンは隠れない
  const list = document.createElement("div");
  list.className = "floor-tab-list";
  state.floors.forEach((floor, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `floor-tab${index === state.activeFloor ? " is-active" : ""}`;
    button.textContent = floor.name;
    button.title = `${floor.name}を編集`;
    button.addEventListener("click", () => setActiveFloorIndex(index));
    list.appendChild(button);
  });
  // 縦のホイールでも横にスクロールできるようにする
  list.addEventListener("wheel", (event) => {
    if (list.scrollWidth <= list.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    event.preventDefault();
    list.scrollLeft += event.deltaY;
  }, { passive: false });
  floorTabs.appendChild(list);
  const add = document.createElement("button");
  add.type = "button";
  add.className = "floor-tab floor-tab-ghost";
  add.textContent = "＋";
  add.title = "上の階を追加";
  add.addEventListener("click", addFloorAbove);
  floorTabs.appendChild(add);
  if (state.floors.length > 1) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "floor-tab floor-tab-ghost";
    remove.textContent = "×";
    remove.title = "表示中の階を削除";
    remove.addEventListener("click", removeActiveFloor);
    floorTabs.appendChild(remove);
  }
  fitPlanBar();
}

// 2Dの欄が狭くて階のタブが入りきらないときは、部屋や壁の数の表示をしまい、
// 編集中の階のタブが見えるところまでスクロールする
function fitPlanBar(): void {
  const list = floorTabs.querySelector<HTMLElement>(".floor-tab-list");
  if (!list) return;
  planStats.hidden = false;
  if (list.scrollWidth > list.clientWidth + 1) planStats.hidden = true;
  const active = list.querySelector<HTMLElement>(".is-active");
  if (!active || list.scrollWidth <= list.clientWidth) return;
  const listRect = list.getBoundingClientRect();
  const tabRect = active.getBoundingClientRect();
  if (tabRect.left < listRect.left) list.scrollLeft -= listRect.left - tabRect.left;
  else if (tabRect.right > listRect.right) list.scrollLeft += tabRect.right - listRect.right;
}

function renderFloorVisibility(): void {
  const container = document.querySelector<HTMLSpanElement>("#floorVisibility");
  if (!container) return;
  container.innerHTML = "";
  if (state.floors.length > 1) {
    state.floors.forEach((floor) => {
      const button = document.createElement("button");
      button.type = "button";
      const visible = !hiddenFloorIds.has(floor.id);
      button.className = `mini-toggle${visible ? " is-active" : ""}`;
      button.textContent = floor.name;
      button.title = visible ? `${floor.name}を3Dから一時的に隠す` : `${floor.name}を3Dに表示`;
      button.setAttribute("aria-pressed", String(visible));
      button.addEventListener("click", () => {
        if (hiddenFloorIds.has(floor.id)) {
          hiddenFloorIds.delete(floor.id);
        } else {
          hiddenFloorIds.add(floor.id);
        }
        rebuildThree();
      });
      container.appendChild(button);
    });
  }
  if (state.roofs.length > 0) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `mini-toggle${roofVisible3d ? " is-active" : ""}`;
    button.textContent = `屋根 ${state.roofs.length}`;
    button.title = roofVisible3d ? "屋根を3Dから一時的に隠す" : "屋根を3Dに表示";
    button.setAttribute("aria-pressed", String(roofVisible3d));
    button.addEventListener("click", () => {
      roofVisible3d = !roofVisible3d;
      rebuildThree();
    });
    container.appendChild(button);
  }
}

function addRoof(kind: RoofKind): void {
  if (!isRoofKind(kind)) return;
  const selected = state.selectedId ? findEntity(state.selectedId) : null;
  const selectedBounds = selected?.type === "room" ? { x: selected.x, y: selected.y, w: selected.w, h: selected.h } : null;
  const sourceBounds =
    selectedBounds ??
    getEntitiesBounds(activeEntities().filter(isRoom)) ??
    getEntitiesBounds(activeEntities()) ??
    { x: -200, y: -150, w: 400, h: 300 };
  const overhang = 40;
  const previousRoof = selectedBounds ? null : state.roofs[state.roofs.length - 1] ?? null;
  const defaultWidth = Math.max(GRID * 2, snap(sourceBounds.w + overhang * 2));
  const defaultDepth = Math.max(GRID * 2, snap(sourceBounds.h + overhang * 2));
  const item = roof(
    kind,
    previousRoof ? previousRoof.x + previousRoof.w + GRID * 2 : snap(sourceBounds.x - overhang),
    previousRoof ? previousRoof.y : snap(sourceBounds.y - overhang),
    previousRoof?.w ?? defaultWidth,
    previousRoof?.h ?? defaultDepth,
  );
  item.floorId = activeFloor().id;
  state.roofs.push(item);
  state.selectedId = item.id;
  roofVisible3d = true;
  roofVisible2d = true;
  activeTool = "select";
  setActiveButton("[data-tool]", activeTool);
  pendingCameraFrame = true;
  commitState();
  fitPlanToCanvas();
  redrawAll();
}

// 2Dの間取りに屋根を描くか。屋根は3Dの部品なので、間取り専用版では描かない
function roofsOn2d(): boolean {
  return roofVisible2d && !PLAN_EDITION;
}

// 一覧や3Dから屋根を選んだときは、隠したままだと編集できないので間取りにも表示し直す
function revealRoofsIfSelected(): void {
  if (!roofVisible2d && state.roofs.some((item) => item.id === state.selectedId)) roofVisible2d = true;
}

function updateRoofToggle2d(): void {
  const button = document.querySelector<HTMLButtonElement>("#roofToggle2d");
  if (!button) return;
  revealRoofsIfSelected();
  button.hidden = state.roofs.length === 0;
  button.classList.toggle("is-active", roofVisible2d);
  button.setAttribute("aria-pressed", String(roofVisible2d));
  button.title = roofVisible2d ? "間取り上の屋根を一時的に隠す" : "間取り上に屋根を表示";
}

function renderRoofList(): void {
  roofList.innerHTML = "";
  state.roofs.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = `roof-list-row${state.selectedId === item.id ? " is-active" : ""}`;

    const select = document.createElement("button");
    select.type = "button";
    select.className = "roof-list-select";
    const floorName = state.floors.find((floor) => floor.id === item.floorId)?.name ?? state.floors[state.floors.length - 1].name;
    const roofSize = showDimensions ? ` ${formatMeters(item.w)} x ${formatMeters(item.h)}` : "";
    select.textContent = `${index + 1}. ${floorName} ${ROOF_LABELS[item.kind]}${roofSize}`;
    select.addEventListener("click", () => {
      state.selectedId = item.id;
      activeTool = "select";
      setActiveButton("[data-tool]", activeTool);
      updateUi();
      render2d();
      rebuildThree();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "roof-list-remove";
    remove.textContent = "×";
    remove.title = `${index + 1}枚目の屋根を削除`;
    remove.setAttribute("aria-label", remove.title);
    remove.disabled = isLocked(item);
    remove.addEventListener("click", () => {
      if (isLocked(item)) return;
      removeEntityById(item.id);
      commitState();
      redrawAll();
    });

    row.append(select, remove);
    roofList.appendChild(row);
  });
}

function setActiveFloorIndex(index: number): void {
  if (index === state.activeFloor || index < 0 || index >= state.floors.length) return;
  state.activeFloor = index;
  state.selectedId = null;
  persistState();
  fitPlanToCanvas();
  redrawAll();
}

// ---- 階の高さ・名前（地下の階は1Fより下） ----

function basementCount(plan: PlanState = state): number {
  return clamp(Math.round(plan.basements ?? 0) || 0, 0, plan.floors.length - 1);
}

// 地上からの階の位置。0が1F、-1がB1F
function floorLevel(index: number): number {
  return index - basementCount();
}

function floorLabel(index: number, basements = basementCount()): string {
  const level = index - basements;
  return level >= 0 ? `${level + 1}F` : `B${-level}F`;
}

function renameFloors(): void {
  state.floors.forEach((floor, index) => (floor.name = floorLabel(index)));
}

function isGroundFloor(index: number): boolean {
  return floorLevel(index) === 0;
}

// その階の床の高さ（3D）。1Fが0で、地下はマイナス
function floorBaseY(index: number): number {
  return floorLevel(index) * FLOOR_SPACING;
}

// 1Fだけは地面の上に薄い床があるので、家具などを置く面が少し高い
function floorTopOffset(index: number): number {
  return isGroundFloor(index) ? 0.08 : 0;
}

function addBasement(): void {
  state.floors.unshift({ id: newId("floor"), name: "", entities: [] });
  state.basements = basementCount() + 1;
  renameFloors();
  state.activeFloor = 0;
  state.selectedId = null;
  commitState();
  fitPlanToCanvas();
  redrawAll();
}

function addFloorAbove(): void {
  state.floors.push({ id: newId("floor"), name: "", entities: [] });
  renameFloors();
  state.activeFloor = state.floors.length - 1;
  state.selectedId = null;
  commitState();
  fitPlanToCanvas();
  redrawAll();
}

function removeActiveFloor(): void {
  if (state.floors.length <= 1) return;
  const floor = activeFloor();
  const attachedRoofs = state.roofs.filter((item) => item.floorId === floor.id);
  if (!window.confirm(`${floor.name}（${floor.entities.length}個の要素・屋根${attachedRoofs.length}枚）を削除します。実行しますか？`)) {
    return;
  }
  hiddenFloorIds.delete(floor.id);
  state.roofs = state.roofs.filter((item) => item.floorId !== floor.id);
  const basements = basementCount();
  const wasBasement = state.activeFloor < basements;
  state.floors.splice(state.activeFloor, 1);
  // 地下を消したとき、または地上の階がなくなったときは地下の数を1つ減らす（いちばん上の地下が1Fになる）
  if (wasBasement || state.floors.length - basements <= 0) state.basements = Math.max(0, basements - 1);
  if (!state.basements) delete state.basements;
  renameFloors();
  state.activeFloor = clamp(state.activeFloor, 0, state.floors.length - 1);
  state.selectedId = null;
  commitState();
  fitPlanToCanvas();
  redrawAll();
}

function setActiveButton(selector: string, value: string): void {
  document.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
    const dataValue =
      button.dataset.surface ?? button.dataset.shape ?? button.dataset.tool ?? button.dataset.furniture ?? button.dataset.viewMode;
    button.classList.toggle("is-active", dataValue === value);
    button.setAttribute("aria-pressed", String(dataValue === value));
  });
}

function syncPlanCursor(): void {
  setActiveButton("[data-surface]", activeTool === "room" ? activeRoomSurface : "");
  setActiveButton("[data-furniture]", activeTool === "furniture" ? activeFurniture : "");
  if (drag.dragMode === "pan") {
    planCanvas.style.cursor = "grabbing";
    return;
  }
  planCanvas.style.cursor = activeTool === "select" ? "default" : activeTool === "erase" ? "not-allowed" : activeTool === "text" ? "text" : "crosshair";
}

function updateDimensionToggle(): void {
  dimensionToggle.classList.toggle("is-active", showDimensions);
  dimensionToggle.setAttribute("aria-pressed", String(showDimensions));
}

function updateShadowToggle(): void {
  const button = document.querySelector<HTMLButtonElement>("#shadowToggle");
  button?.classList.toggle("is-active", shadowsEnabled);
  button?.setAttribute("aria-pressed", String(shadowsEnabled));
  const lightSelect = document.querySelector<HTMLSelectElement>("#lightDirectionSelect");
  if (lightSelect) lightSelect.disabled = !shadowsEnabled;
}

// ---- 透かす階と色のメニュー ----

function setupGhostMenu(): void {
  const button = document.querySelector<HTMLButtonElement>("#ghostMenuButton");
  const menu = document.querySelector<HTMLDivElement>("#ghostMenu");
  const select = document.querySelector<HTMLSelectElement>("#ghostFloorSelect");
  const picker = document.querySelector<HTMLInputElement>("#ghostColorPicker");
  const code = document.querySelector<HTMLInputElement>("#ghostColorInput");
  const opacity = document.querySelector<HTMLInputElement>("#ghostOpacityInput");
  if (!button || !menu || !select || !picker || !code || !opacity) return;
  const apply = () => {
    syncGhostMenu();
    render2d();
    scheduleViewStateSave();
  };
  button.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
    button.setAttribute("aria-expanded", String(!menu.hidden));
  });
  document.addEventListener("pointerdown", (event) => {
    if (menu.hidden || menu.contains(event.target as Node) || button.contains(event.target as Node)) return;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  });
  select.addEventListener("change", () => {
    ghostSettings.target = select.value;
    // 透かす階を選んだら、透過も表示にする
    if (!showGhostFloor) document.querySelector<HTMLButtonElement>("#ghostToggle")?.click();
    apply();
  });
  picker.addEventListener("input", () => {
    // 色を選び直しても、カラーコードの透明度はそのまま
    const current = parseColorCode(ghostSettings.color);
    ghostSettings.color = withAlpha(picker.value, current ? current.alpha : 1);
    apply();
  });
  code.addEventListener("change", () => {
    const value = code.value.trim();
    const parsed = parseColorCode(value);
    if (value && !parsed) {
      code.classList.add("is-invalid");
      return;
    }
    code.classList.remove("is-invalid");
    ghostSettings.color = parsed?.code ?? "";
    apply();
  });
  opacity.addEventListener("input", () => {
    const value = Number(opacity.value) / 100;
    const current = parseColorCode(ghostSettings.color);
    // カラーコードがあれば、その末尾の透明度を書き換える
    if (current) ghostSettings.color = withAlpha(current.rgb, value);
    ghostSettings.opacity = value;
    apply();
  });
  syncGhostMenu();
}

function syncGhostMenu(): void {
  const picker = document.querySelector<HTMLInputElement>("#ghostColorPicker");
  const code = document.querySelector<HTMLInputElement>("#ghostColorInput");
  const opacity = document.querySelector<HTMLInputElement>("#ghostOpacityInput");
  const value = document.querySelector<HTMLSpanElement>("#ghostOpacityValue");
  const parsed = parseColorCode(ghostSettings.color);
  if (picker && parsed) picker.value = parsed.rgb;
  // 見本の下の市松模様を透かして、透かす濃さを見せる
  picker?.parentElement?.style.setProperty("--swatch-alpha", String(parsed ? ghostOpacity() : 1));
  if (code && document.activeElement !== code) code.value = parsed?.code ?? "";
  const percent = Math.round(ghostOpacity() * 100);
  if (opacity) opacity.value = String(percent);
  if (value) value.textContent = `${percent}%`;
  renderGhostFloorOptions();
}

function renderGhostFloorOptions(): void {
  const select = document.querySelector<HTMLSelectElement>("#ghostFloorSelect");
  if (!select) return;
  const options = [
    ["below", "すぐ下の階"],
    ["above", "すぐ上の階"],
    ["all", "ほかの階すべて"],
    ...state.floors.map((floor) => [floor.id, floor.name]),
  ];
  // 選んでいた階が消えたときは、すぐ下の階に戻す
  if (!options.some(([value]) => value === ghostSettings.target)) ghostSettings.target = "below";
  const html = options.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");
  if (select.dataset.options !== html) {
    select.innerHTML = html;
    select.dataset.options = html;
  }
  select.value = ghostSettings.target;
}

// ---- 2Dと3Dの境目 ----

function loadSplitRatio(): number | null {
  const stored = Number(localStorage.getItem(SPLIT_KEY));
  return Number.isFinite(stored) && stored > 0 ? clamp(stored, MIN_SPLIT, MAX_SPLIT) : null;
}

// null のときは画面幅ごとの標準の配分に戻す。数値のときは grid の比（fr）として渡す
function applySplitRatio(ratio: number | null): void {
  if (ratio === null) {
    delete workspace.dataset.split;
    for (const name of ["--plan-fr", "--three-fr", "--plan-share"]) workspace.style.removeProperty(name);
  } else {
    const share = clamp(ratio, MIN_SPLIT, MAX_SPLIT);
    workspace.dataset.split = "custom";
    // 比の合計が1未満だと、片側が最小幅で止まったときに余った幅が空白のまま残るため100倍して渡す
    workspace.style.setProperty("--plan-fr", `${share * 100}fr`);
    workspace.style.setProperty("--three-fr", `${(1 - share) * 100}fr`);
    workspace.style.setProperty("--plan-share", String(share));
  }
  updateSplitDivider();
}

// 2Dの表示の中心を保ったまま境目を動かす（左上が固定されて図がずれて見えないように）
function setSplitRatio(ratio: number | null): void {
  const before = planCanvas.getBoundingClientRect();
  applySplitRatio(ratio);
  const after = planCanvas.getBoundingClientRect();
  if (before.width > 0 && after.width > 0) {
    view.x += (after.width - before.width) / 2;
    view.y += (after.height - before.height) / 2;
  }
}

function saveSplitRatio(): void {
  const share = workspace.style.getPropertyValue("--plan-share");
  if (share) localStorage.setItem(SPLIT_KEY, share);
  else localStorage.removeItem(SPLIT_KEY);
}

// 2Dと3Dが横に並ぶ（広い画面）か、上下に並ぶ（タブレット・スマホ）かを実際の配置から判断する
function splitLayout(): { across: boolean; share: number; ratioAt: (x: number, y: number) => number } {
  const plan = planPane.getBoundingClientRect();
  const three = threePane.getBoundingClientRect();
  const across = three.left >= plan.right - 2;
  const total = across ? three.right - plan.left : three.bottom - plan.top;
  return {
    across,
    share: total > 0 ? (across ? plan.width : plan.height) / total : 0.5,
    ratioAt: (x, y) => (total > 0 ? (across ? x - plan.left : y - plan.top) / total : 0.5),
  };
}

function updateSplitDivider(): void {
  if (viewMode !== "split") return;
  const layout = splitLayout();
  splitDivider.setAttribute("aria-orientation", layout.across ? "vertical" : "horizontal");
  splitDivider.setAttribute("aria-valuenow", String(Math.round(layout.share * 100)));
}

function bindSplitDivider(): void {
  applySplitRatio(loadSplitRatio());
  splitDivider.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    splitDivider.setPointerCapture(event.pointerId);
    splitDivider.classList.add("is-dragging");
    document.body.dataset.resizing = splitLayout().across ? "across" : "down";
  });
  splitDivider.addEventListener("pointermove", (event) => {
    if (!splitDivider.hasPointerCapture(event.pointerId)) return;
    setSplitRatio(splitLayout().ratioAt(event.clientX, event.clientY));
  });
  const finish = () => {
    if (!splitDivider.classList.contains("is-dragging")) return;
    splitDivider.classList.remove("is-dragging");
    delete document.body.dataset.resizing;
    saveSplitRatio();
  };
  splitDivider.addEventListener("pointerup", finish);
  splitDivider.addEventListener("pointercancel", finish);
  splitDivider.addEventListener("lostpointercapture", finish);
  splitDivider.addEventListener("dblclick", () => {
    setSplitRatio(null);
    saveSplitRatio();
  });
  // 矢印キーでも少しずつ動かせる。選択中の家具などを動かさないよう、ここで止める
  splitDivider.addEventListener("keydown", (event) => {
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    event.stopPropagation();
    setSplitRatio(splitLayout().share + step * SPLIT_KEY_STEP);
    saveSplitRatio();
  });
}

function applyViewMode(nextMode: ViewMode, persist = true, restore = false): void {
  viewMode = nextMode;
  workspace.dataset.viewMode = viewMode;
  workspace.classList.remove("is-active");
  setActiveButton("button[data-view-mode]", viewMode);
  if (persist && !PLAN_EDITION) {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }
  requestAnimationFrame(() => {
    resizeCanvases();
    updateSplitDivider();
    // 起動したときは前回の視点に戻す。記録がない（または使えない）ときと、表示を切り替えたときは全体が入るように合わせる
    const cameraRestored = restore && restoreCamera();
    if (viewMode !== "three") {
      if (!(restore && restorePlanView())) fitPlanToCanvas();
      render2d();
    }
    if (viewMode !== "plan") {
      if (!cameraRestored) frameCamera(getGlobalBounds());
      render3dOnce();
    }
    if (restore) {
      viewStateReady = true;
      window.addEventListener("pagehide", saveViewState);
    }
    scheduleViewStateSave();
  });
}

// ---- 見ていた場所・表示の切り替えの保存 ----

function loadViewState(): SavedViewState {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(VIEW_STATE_KEY) ?? "null");
    return value && typeof value === "object" ? (value as SavedViewState) : {};
  } catch {
    return {};
  }
}

// 画面を作る前に戻しておく設定（階・屋根の表示、ツールパネル、家具の2D記号）
function applySavedDisplaySettings(): void {
  const floorIds = new Set(state.floors.map((floor) => floor.id));
  if (Array.isArray(viewState.hiddenFloors)) {
    viewState.hiddenFloors.filter((id) => floorIds.has(id)).forEach((id) => hiddenFloorIds.add(id));
  }
  if (typeof viewState.roofs2d === "boolean") roofVisible2d = viewState.roofs2d;
  if (typeof viewState.roofs3d === "boolean") roofVisible3d = viewState.roofs3d;
  if (viewState.panelHidden === true) {
    workspace.dataset.panel = "hidden";
    document.querySelector<HTMLButtonElement>("#panelToggle")?.setAttribute("aria-pressed", "true");
  }
  if (viewState.ghost && typeof viewState.ghost === "object") {
    const { target, color, opacity } = viewState.ghost;
    if (typeof target === "string" && target) ghostSettings.target = target;
    if (typeof color === "string") ghostSettings.color = parseColorCode(color)?.code ?? "";
    if (typeof opacity === "number" && Number.isFinite(opacity)) ghostSettings.opacity = clamp(opacity, 0.03, 0.9);
  }
  if (viewState.shards && typeof viewState.shards === "object") {
    const { spread, density } = viewState.shards;
    if (typeof spread === "number" && Number.isFinite(spread)) shardSettings.spread = clamp(Math.round(spread), 5, MAX_BRUSH);
    if (SHARD_DENSITIES.some(([value]) => value === density)) shardSettings.density = density as number;
  }
  if (viewState.pen && typeof viewState.pen === "object") {
    const { color, brush, filled } = viewState.pen;
    penSettings.color = parseColorCode(color)?.code ?? PEN_DEFAULT_COLOR;
    if (typeof brush === "number" && Number.isFinite(brush)) penSettings.brush = clamp(Math.round(brush), 1, MAX_BRUSH);
    penSettings.filled = filled === true;
  }
  if (viewState.symbols && typeof viewState.symbols === "object") {
    for (const [kind, symbol] of Object.entries(viewState.symbols)) {
      if (Object.prototype.hasOwnProperty.call(FURNITURE_DEFS, kind)) {
        const valid = validSymbol(kind as FurnitureKind, symbol);
        if (valid) lastSymbolByKind[kind as FurnitureKind] = valid;
      }
    }
  }
}

function toolPanelDetails(): HTMLDetailsElement[] {
  return [...document.querySelectorAll<HTMLDetailsElement>(".tool-panel details")];
}

function detailsKey(details: HTMLDetailsElement): string {
  return details.querySelector("summary")?.textContent?.trim() ?? "";
}

// 左の一覧の開閉を前回の状態に戻し、開け閉めしたら記録する
function restorePanelOpenStates(): void {
  const panels = viewState.panels && typeof viewState.panels === "object" ? viewState.panels : {};
  toolPanelDetails().forEach((details) => {
    const open = panels[detailsKey(details)];
    if (typeof open === "boolean") details.open = open;
    details.addEventListener("toggle", scheduleViewStateSave);
  });
}

function restorePlanView(): boolean {
  const saved = viewState.plan;
  if (!saved || ![saved.x, saved.y, saved.zoom].every(Number.isFinite) || saved.zoom <= 0) return false;
  const rect = planCanvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  view.zoom = clamp(saved.zoom, MIN_PLAN_ZOOM, MAX_PLAN_ZOOM);
  view.x = rect.width / 2 - saved.x * view.zoom;
  view.y = rect.height / 2 - saved.y * view.zoom;
  return true;
}

function sceneOrigin(): THREE.Vector3 {
  return new THREE.Vector3(threeSceneCenter.x * SCALE_3D, 0, threeSceneCenter.y * SCALE_3D);
}

function restoreCamera(): boolean {
  const saved = viewState.camera;
  const isVector = (value: unknown): value is number[] => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
  if (!saved || !isVector(saved.position) || !isVector(saved.target)) return false;
  const position = new THREE.Vector3().fromArray(saved.position).sub(sceneOrigin());
  const target = new THREE.Vector3().fromArray(saved.target).sub(sceneOrigin());
  const distance = position.distanceTo(target);
  if (distance < MIN_CAMERA_DISTANCE * 0.99 || distance > MAX_CAMERA_DISTANCE * 1.01) return false;
  camera.position.copy(position);
  controls.target.copy(target);
  controls.update();
  return true;
}

function scheduleViewStateSave(): void {
  if (!viewStateReady) return;
  window.clearTimeout(viewStateTimer);
  viewStateTimer = window.setTimeout(saveViewState, 400);
}

function saveViewState(): void {
  if (!viewStateReady) return;
  window.clearTimeout(viewStateTimer);
  const rect = planCanvas.getBoundingClientRect();
  // 2Dを隠しているあいだは2Dの視点が決まらないので、前回の記録を残す
  if (rect.width > 0 && rect.height > 0) {
    viewState.plan = { x: (rect.width / 2 - view.x) / view.zoom, y: (rect.height / 2 - view.y) / view.zoom, zoom: view.zoom };
  }
  // 間取り専用版では3Dのカメラを動かさないので、本体で見ていた向きを残す
  if (!PLAN_EDITION) viewState.camera = { position: camera.position.clone().add(sceneOrigin()).toArray(), target: controls.target.clone().add(sceneOrigin()).toArray() };
  viewState.hiddenFloors = [...hiddenFloorIds];
  viewState.roofs2d = roofVisible2d;
  viewState.roofs3d = roofVisible3d;
  viewState.panelHidden = workspace.dataset.panel === "hidden";
  // 検索で一時的に開閉している一覧は、検索する前の状態を記録する
  viewState.panels = Object.fromEntries(
    toolPanelDetails().map((details) => [detailsKey(details), details.dataset.wasOpen !== undefined ? details.dataset.wasOpen === "true" : details.open]),
  );
  viewState.symbols = { ...lastSymbolByKind };
  viewState.ghost = { ...ghostSettings };
  viewState.pen = { ...penSettings };
  viewState.shards = { ...shardSettings };
  try {
    localStorage.setItem(VIEW_STATE_KEY, JSON.stringify(viewState));
  } catch {
    // 保存できなくても編集は続けられる。次に開いたときに全体表示へ戻るだけ
  }
}

function handlePointerDown(event: PointerEvent): void {
  if (event.button === 2) {
    event.preventDefault();
    planCanvas.setPointerCapture(event.pointerId);
    drag = {
      dragMode: "pan",
      pointerId: event.pointerId,
      startScreen: { x: event.clientX, y: event.clientY },
      startView: { x: view.x, y: view.y },
      startWorld: screenToWorld(event),
      currentWorld: screenToWorld(event),
      originEntity: null,
      resizeCorner: null,
    };
    planCanvas.style.cursor = "grabbing";
    return;
  }

  const point = screenToWorld(event);
  const hit = hitTest(point);
  planCanvas.setPointerCapture(event.pointerId);
  drag.pointerId = event.pointerId;
  drag.startScreen = { x: event.clientX, y: event.clientY };
  drag.startView = { x: view.x, y: view.y };
  drag.startWorld = point;
  drag.currentWorld = point;
  drag.originEntity = hit.entity ? cloneEntity(hit.entity) : null;
  drag.resizeCorner = hit.corner;

  if (activeTool === "erase") {
    if (hit.entity && !isLocked(hit.entity)) {
      removeEntityById(hit.entity.id);
      if (state.selectedId === hit.entity.id) state.selectedId = null;
      commitState();
      redrawAll();
    } else if (hit.entity) {
      state.selectedId = hit.entity.id;
      updateUi();
      render2d();
    }
    drag.dragMode = "none";
    return;
  }

  if (activeTool === "select") {
    state.selectedId = hit.entity?.id ?? null;
    if (hit.entity && isLocked(hit.entity)) {
      drag.dragMode = "none";
      planCanvas.style.cursor = "not-allowed";
    } else if (hit.entity?.type === "room" && hit.corner === "label") {
      drag.dragMode = "label";
      planCanvas.style.cursor = "grabbing";
    } else if (isPerson(hit.entity) && hit.corner?.startsWith("limb:")) {
      drag.dragMode = "pose";
      drag.limb = beginPersonPose(hit.entity, Number(hit.corner.slice(5)), point);
      planCanvas.style.cursor = "grabbing";
    } else if (hit.entity && hit.corner && (isResizable(hit.entity) || isLinear(hit.entity))) {
      drag.dragMode = "resize";
    } else if (hit.entity) {
      drag.dragMode = "move";
    } else {
      drag.dragMode = "none";
    }
    updateUi();
    render2d();
    return;
  }

  if (activeTool === "text") {
    // 既存の文字をクリックしたらそれを選び、何もない所なら新しく置く。どちらもすぐ入力できるよう選択ツールへ戻す
    let target = hit.entity?.type === "text" ? hit.entity : null;
    if (!target) {
      target = { id: newId("text"), type: "text", text: "テキスト", x: Math.round(point.x), y: Math.round(point.y), size: DEFAULT_TEXT_SIZE, rotation: 0 };
      activeEntities().push(target);
      commitState();
    }
    state.selectedId = target.id;
    activeTool = "select";
    setActiveButton("[data-tool]", activeTool);
    syncPlanCursor();
    drag.dragMode = "none";
    redrawAll();
    pendingTextFocus = true;
    return;
  }

  // 足跡は、なぞった道すじに付ける（クリックだけなら、まっすぐな足跡）。ペンも、なぞった所に線を描く
  if (activeTool === "paint" || (activeTool === "furniture" && (activeFurniture === "footprints" || activeFurniture === "brokenGlass"))) {
    drag.dragMode = "path";
    drag.path = [point];
    render2d();
    return;
  }

  drag.dragMode = "draw";
  state.selectedId = null;

  if (activeTool === "furniture") {
    const base = FURNITURE_DEFS[activeFurniture];
    const entity: Furniture = {
      id: newId("furniture"),
      type: "furniture",
      kind: activeFurniture,
      x: snap(point.x - base.w / 2),
      y: snap(point.y - base.h / 2),
      w: base.w,
      h: base.h,
      rotation: 0,
      ...newFurnitureDetails(activeFurniture),
    };
    activeEntities().push(entity);
    state.selectedId = entity.id;
    drag.originEntity = cloneEntity(entity);
    drag.dragMode = "move";
    commitState();
    redrawAll();
    return;
  }

  render2d();
}

function handlePointerMove(event: PointerEvent): void {
  if (drag.pointerId === event.pointerId && drag.dragMode === "pan") {
    view.x = drag.startView.x + event.clientX - drag.startScreen.x;
    view.y = drag.startView.y + event.clientY - drag.startScreen.y;
    render2d();
    return;
  }

  const point = screenToWorld(event);
  const hover = hitTest(point);
  if (activeTool === "select" && drag.dragMode === "none") {
    planCanvas.style.cursor = hover.entity && isLocked(hover.entity) ? "not-allowed" : hover.corner === "label" || hover.corner?.startsWith("limb:") ? "grab" : hover.corner ? "nwse-resize" : hover.entity ? "move" : "default";
  }

  if (drag.pointerId !== event.pointerId || drag.dragMode === "none") {
    return;
  }

  drag.currentWorld = point;

  if (drag.dragMode === "path") {
    const last = drag.path?.[drag.path.length - 1];
    if (drag.path && (!last || Math.hypot(point.x - last.x, point.y - last.y) >= Math.max(1, 2 / view.zoom))) drag.path.push(point);
    render2d();
    return;
  }

  if (drag.dragMode === "pose" && drag.originEntity) {
    const entity = findEntity(drag.originEntity.id);
    if (isPerson(entity) && drag.limb !== undefined) movePersonLimb(entity, drag.limb, point);
    redrawAll(false);
    scheduleThreeRefresh();
    return;
  }

  if (activeTool === "select" && drag.originEntity) {
    const entity = findEntity(drag.originEntity.id);
    if (!entity) return;
    if (drag.dragMode === "move") {
      moveEntity(entity, drag.originEntity, point.x - drag.startWorld.x, point.y - drag.startWorld.y);
    }
    if (drag.dragMode === "label") {
      moveRoomLabel(entity, drag.originEntity, point.x - drag.startWorld.x, point.y - drag.startWorld.y);
    }
    if (drag.dragMode === "resize" && drag.resizeCorner) {
      resizeEntity(entity, drag.originEntity, drag.resizeCorner, point);
    }
    redrawAll(false);
    return;
  }

  if (activeTool === "furniture" && drag.originEntity) {
    const entity = findEntity(drag.originEntity.id);
    if (!entity) return;
    moveEntity(entity, drag.originEntity, point.x - drag.startWorld.x, point.y - drag.startWorld.y);
    redrawAll(false);
    return;
  }

  render2d();
}

function handlePointerUp(event: PointerEvent): void {
  if (drag.pointerId !== event.pointerId) return;
  planCanvas.releasePointerCapture(event.pointerId);

  const end = drag.currentWorld;
  const start = drag.startWorld;
  const distanceMoved = Math.hypot(end.x - start.x, end.y - start.y);

  if (drag.dragMode === "draw" && distanceMoved > 8) {
    if (activeTool === "room") addRoomFromDrag(start, end);
    if (activeTool === "wall") addLineFromDrag("wall", start, end);
    if (activeTool === "door") addLineFromDrag("door", start, end);
    if (activeTool === "slidingDoor") addLineFromDrag("door", start, end, false, "sliding");
    if (activeTool === "window") addLineFromDrag("window", start, end);
    if (activeTool === "window2") addLineFromDrag("window", start, end, true);
    if (activeTool === "circle") addShapeFromDrag("circle", start, end);
    if (activeTool === "arc") addShapeFromDrag("arc", start, end);
    if (activeTool === "polygon") addShapeFromDrag("polygon", start, end);
    commitState();
  }

  if (drag.dragMode === "path" && drag.path) {
    if (activeTool === "paint") placePaintStroke(drag.path);
    else if (activeFurniture === "brokenGlass") placeShardPath(drag.path);
    else placeFootprintPath(drag.path);
    commitState();
  }

  if ((drag.dragMode === "move" || drag.dragMode === "resize" || drag.dragMode === "label" || drag.dragMode === "pose") && drag.originEntity) {
    const current = findEntity(drag.originEntity.id);
    if (current && JSON.stringify(current) !== JSON.stringify(drag.originEntity)) {
      commitState();
    }
  }

  drag = {
    dragMode: "none",
    pointerId: null,
    startScreen: { x: 0, y: 0 },
    startView: { x: 0, y: 0 },
    startWorld: { x: 0, y: 0 },
    currentWorld: { x: 0, y: 0 },
    originEntity: null,
    resizeCorner: null,
  };
  syncPlanCursor();
  redrawAll();
  // 置いた文字の入力欄へは、クリックを離して描き直した後に移る（先に移すと描き直しで外れる）
  if (pendingTextFocus) {
    pendingTextFocus = false;
    focusTextContentInput();
  }
}

function handleDoubleClick(event: MouseEvent): void {
  const hit = hitTest(screenToWorld(event));
  if (!hit.entity) return;
  state.selectedId = hit.entity.id;
  activeTool = "select";
  setActiveButton("[data-tool]", activeTool);
  updateUi();
  render2d();
}

function handleThreePointerDown(event: PointerEvent): void {
  // 右ドラッグ（またはShift・Ctrl＋左ドラッグ）の移動は、つかんだ物の奥行きに合わせた速さにする
  if (!threeDrag && (event.button === 2 || (event.button === 0 && (event.shiftKey || event.ctrlKey || event.metaKey)))) {
    anchorPanToPointer(event);
  }
  if (event.button !== 0 || threeDrag) {
    threePointerDown = null;
    return;
  }
  threePointerDown = { x: event.clientX, y: event.clientY };
  const id = pickThreeEntity(event);
  const selected = id ? findEntity(id) : undefined;

  if (activeTool === "erase") {
    event.stopImmediatePropagation();
    threePointerDown = null;
    if (selected && !isLocked(selected)) {
      removeEntityById(selected.id);
      commitState();
      redrawAll();
    }
    return;
  }

  let furnitureItem: Furniture;
  let floorIndex = state.activeFloor;
  const created = activeTool === "furniture";
  if (created) {
    if (hiddenFloorIds.has(activeFloor().id)) return;
    const point = threeFloorPoint(event, floorBaseY(floorIndex) + floorTopOffset(floorIndex));
    if (!point) return;
    const base = FURNITURE_DEFS[activeFurniture];
    furnitureItem = { id: newId("furniture"), type: "furniture", kind: activeFurniture, x: snap(point.x - base.w / 2), y: snap(point.y - base.h / 2), w: base.w, h: base.h, rotation: 0, ...newFurnitureDetails(activeFurniture) };
  } else if (activeTool === "select" && selected?.type === "furniture" && !isLocked(selected)) {
    furnitureItem = selected;
    floorIndex = state.floors.findIndex((floor) => floor.entities.some((entity) => entity.id === selected.id));
  } else {
    return;
  }

  const planeY = floorBaseY(floorIndex) + floorTopOffset(floorIndex);
  const point = threeFloorPoint(event, planeY);
  if (!point) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  controls.enabled = false;
  threeCanvas.setPointerCapture(event.pointerId);
  state.activeFloor = floorIndex;
  if (created) activeEntities().push(furnitureItem);
  state.selectedId = furnitureItem.id;
  threeDrag = { pointerId: event.pointerId, startScreen: { x: event.clientX, y: event.clientY }, startWorld: point, origin: cloneEntity(furnitureItem) as Furniture, planeY, created, moved: false };
  threeCanvas.style.cursor = "grabbing";
  redrawAll();
}

// 右ドラッグで動かす前に、回転の中心（controls.target）を視線の中心線上で、マウスの下にある物と同じ奥行きへ移す。
// 中心線上なので画面は動かない。OrbitControls の移動の速さは中心までの距離で決まるため、
// つかんだ物がマウスについてくる速さになる。すぐ目の前の物をつかんでも止まったように見えないよう、奥行きには下限を設ける
function anchorPanToPointer(event: MouseEvent): void {
  setThreeRay(event);
  planGroup.updateMatrixWorld(true);
  const hit = raycaster
    .intersectObjects(planGroup.children, true)
    .find((item) => (item.object as THREE.Mesh).isMesh && item.object.visible);
  const point = hit?.point ?? raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  const forward = camera.getWorldDirection(new THREE.Vector3());
  const depth = point ? point.sub(camera.position).dot(forward) : camera.position.distanceTo(controls.target);
  controls.target.copy(camera.position).addScaledVector(forward, clamp(depth, MIN_PAN_DEPTH, MAX_CAMERA_DISTANCE));
}

function setThreeRay(event: MouseEvent): void {
  const rect = threeCanvas.getBoundingClientRect();
  pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  camera.updateMatrixWorld();
  raycaster.setFromCamera(pointerNdc, camera);
}

function threeFloorPoint(event: PointerEvent, y: number): Point | null {
  setThreeRay(event);
  const point = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), new THREE.Vector3());
  return point ? { x: point.x / SCALE_3D + threeSceneCenter.x, y: point.z / SCALE_3D + threeSceneCenter.y } : null;
}

function pickThreeEntity(event: PointerEvent): string | null {
  setThreeRay(event);
  planGroup.updateMatrixWorld(true);
  const hits = raycaster.intersectObjects(planGroup.children, true);
  return hits.map((hit) => entityIdFromObject(hit.object)).find((id): id is string => Boolean(id)) ?? null;
}

function handleThreePointerMove(event: PointerEvent): void {
  if (!threeDrag || event.pointerId !== threeDrag.pointerId) return;
  if (!threeDrag.moved && Math.hypot(event.clientX - threeDrag.startScreen.x, event.clientY - threeDrag.startScreen.y) < 3) return;
  threeDrag.moved = true;
  const point = threeFloorPoint(event, threeDrag.planeY);
  const entity = findEntity(threeDrag.origin.id);
  if (!point || !entity) return;
  moveEntity(entity, threeDrag.origin, point.x - threeDrag.startWorld.x, point.y - threeDrag.startWorld.y);
  redrawAll();
}

function finishThreeDrag(cancel = false): void {
  if (!threeDrag) return;
  const gesture = threeDrag;
  threeDrag = null;
  threePointerDown = null;
  const current = findEntity(gesture.origin.id);
  if (cancel) {
    if (gesture.created) removeEntityById(gesture.origin.id);
    else if (current) Object.assign(current, gesture.origin);
  } else if (current && (gesture.created || JSON.stringify(current) !== JSON.stringify(gesture.origin))) {
    commitState();
  }
  controls.enabled = true;
  if (threeCanvas.hasPointerCapture(gesture.pointerId)) threeCanvas.releasePointerCapture(gesture.pointerId);
  threeCanvas.style.cursor = "grab";
  redrawAll();
}

function cancelThreeDrag(): void {
  finishThreeDrag(true);
}

function handleThreePointerUp(event: PointerEvent): void {
  if (threeDrag) {
    if (event.pointerId === threeDrag.pointerId) finishThreeDrag();
    return;
  }
  if (!threePointerDown || event.button !== 0) return;
  const moved = Math.hypot(event.clientX - threePointerDown.x, event.clientY - threePointerDown.y);
  threePointerDown = null;
  if (moved > 6 || activeTool === "furniture") return;
  const entityId = pickThreeEntity(event);
  state.selectedId = entityId;
  if (entityId) {
    const floorIndex = state.floors.findIndex((floor) => floor.entities.some((entity) => entity.id === entityId));
    if (floorIndex >= 0 && floorIndex !== state.activeFloor) {
      state.activeFloor = floorIndex;
      fitPlanToCanvas();
    }
  }
  activeTool = "select";
  setActiveButton("[data-tool]", activeTool);
  updateUi();
  render2d();
  rebuildThree();
}

function handleWheel(event: WheelEvent): void {
  event.preventDefault();
  const before = screenToWorld(event);
  // ホイール1目盛り（100）でおよそ1.1倍。タッチパッドの細かい動きは、その分だけ少しずつ拡大縮小する
  const delta = clamp(event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY, -200, 200);
  view.zoom = clamp(view.zoom * Math.exp(-delta * 0.001), MIN_PLAN_ZOOM, MAX_PLAN_ZOOM);
  const after = screenToWorld(event);
  view.x += (after.x - before.x) * view.zoom;
  view.y += (after.y - before.y) * view.zoom;
  render2d();
}

function handleKeyDown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  const isEditing = target?.tagName === "INPUT" || target?.tagName === "SELECT" || target?.tagName === "TEXTAREA" || Boolean(target?.isContentEditable);
  if (isEditing) return;
  if (event.key === "Escape" && threeDrag) {
    cancelThreeDrag();
    return;
  }
  if (threeDrag && (event.ctrlKey || event.metaKey) && ["z", "y"].includes(event.key.toLowerCase())) cancelThreeDrag();
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    event.shiftKey ? redo() : undo();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
    event.preventDefault();
    redo();
    return;
  }
  if (!isEditing && event.key.toLowerCase() === "l" && state.selectedId) {
    const selected = findEntity(state.selectedId);
    if (selected) {
      selected.locked = !selected.locked;
      commitState();
      redrawAll();
    }
    return;
  }
  if (!isEditing && event.key.toLowerCase() === "r" && state.selectedId) {
    const selected = findEntity(state.selectedId);
    if (selected && !isLocked(selected)) {
      rotateEntity(selected, event.shiftKey ? 15 : 90);
      commitState();
      redrawAll();
    }
    return;
  }
  if (!isEditing && event.key.toLowerCase() === "f" && state.selectedId) {
    const selected = findEntity(state.selectedId);
    if (!selected?.locked && (selected?.type === "furniture" || selected?.type === "door")) {
      selected.flip = !selected.flip;
      commitState();
      redrawAll();
    }
    return;
  }
  if (!isEditing && !event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "v" && state.selectedId) {
    // 見た目だけの変更なので、配置を固定していても切り替えられる。Shift+V で逆順
    const selected = findEntity(state.selectedId);
    const count = selected?.type === "furniture" ? SYMBOL_VARIANTS[selected.kind]?.length ?? 0 : 0;
    if (selected?.type === "furniture" && count > 0) {
      setFurnitureSymbol(selected, ((selected.symbol ?? 0) + (event.shiftKey ? count : 1)) % (count + 1));
      commitState();
      redrawAll();
    }
    return;
  }
  if (!isEditing && (event.key === "Delete" || event.key === "Backspace") && state.selectedId) {
    const selected = findEntity(state.selectedId);
    if (!selected || isLocked(selected)) return;
    removeEntityById(state.selectedId);
    state.selectedId = null;
    commitState();
    redrawAll();
  }
}

function addRoomFromDrag(start: Point, end: Point): void {
  const x = snap(Math.min(start.x, end.x));
  const y = snap(Math.min(start.y, end.y));
  const w = snap(Math.abs(end.x - start.x));
  const h = snap(Math.abs(end.y - start.y));
  if (w < GRID * 2 || h < GRID * 2) return;
  const entities = activeEntities();
  const newRoom: Room = {
    id: newId("room"),
    type: "room",
    // 名前は最初は空。必要なときだけ選択中パネルで付ける
    name: "",
    x,
    y,
    w,
    h,
    color: activeRoomSurface === "plain" ? ROOM_COLORS[entities.length % ROOM_COLORS.length] : SURFACE_DEFS[activeRoomSurface].color,
    surface: activeRoomSurface,
  };
  entities.push(newRoom);
  state.selectedId = newRoom.id;
}

function addLineFromDrag(
  type: "wall" | "door" | "window",
  start: Point,
  end: Point,
  mullion = false,
  doorStyle: LinearElement["doorStyle"] = "swing",
): void {
  const snappedStart = { x: snap(start.x), y: snap(start.y) };
  const snappedEnd = constrainLine(snappedStart, { x: snap(end.x), y: snap(end.y) });
  const length = Math.hypot(snappedEnd.x - snappedStart.x, snappedEnd.y - snappedStart.y);
  if (length < GRID) return;
  const line: LinearElement = {
    id: newId(type),
    type,
    x1: snappedStart.x,
    y1: snappedStart.y,
    x2: snappedEnd.x,
    y2: snappedEnd.y,
  };
  if (type === "window" && mullion) line.mullion = true;
  if (type === "door" && doorStyle === "sliding") line.doorStyle = "sliding";
  activeEntities().push(line);
  state.selectedId = line.id;
}

function addShapeFromDrag(kind: ShapeKind, start: Point, end: Point): void {
  const radius = Math.max(GRID, snap(Math.hypot(end.x - start.x, end.y - start.y)));
  const dragAngle = Math.atan2(end.y - start.y, end.x - start.x);
  const shape: Shape = {
    id: newId("shape"),
    type: "shape",
    kind,
    x: snap(start.x),
    y: snap(start.y),
    r: radius,
    startAngle: kind === "arc" ? -Math.PI / 2 : 0,
    endAngle: kind === "arc" ? dragAngle : Math.PI * 2,
  };
  if (kind === "polygon") {
    shape.sides = activePolygonSides;
    // 辺がドラッグ方向を向くようにする（四角形なら水平ドラッグで正方形の向きになる）
    shape.rotation = dragAngle + Math.PI / activePolygonSides;
  }
  activeEntities().push(shape);
  state.selectedId = shape.id;
}

function polygonPoints(shape: Shape): Point[] {
  const sides = clamp(Math.round(shape.sides ?? 6), 3, 12);
  const rotation = shape.rotation ?? 0;
  const points: Point[] = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = rotation + (i / sides) * Math.PI * 2;
    points.push({ x: shape.x + Math.cos(angle) * shape.r, y: shape.y + Math.sin(angle) * shape.r });
  }
  return points;
}

function rotateEntity(entity: Entity, degrees: number): void {
  if (isLocked(entity)) return;
  if (entity.type === "furniture" || entity.type === "text") {
    entity.rotation = (entity.rotation + degrees) % 360;
    return;
  }
  if (entity.type === "roof") {
    const cx = entity.x + entity.w / 2;
    const cy = entity.y + entity.h / 2;
    const newW = entity.h;
    const newH = entity.w;
    entity.x = snap(cx - newW / 2);
    entity.y = snap(cy - newH / 2);
    entity.w = newW;
    entity.h = newH;
    return;
  }
  if (entity.type === "room") {
    // 部屋は軸平行のみなので、角度によらず縦横を入れ替える90°回転にする
    const cx = entity.x + entity.w / 2;
    const cy = entity.y + entity.h / 2;
    const newW = entity.h;
    const newH = entity.w;
    entity.x = snap(cx - newW / 2);
    entity.y = snap(cy - newH / 2);
    entity.w = newW;
    entity.h = newH;
    return;
  }
  if (isLinear(entity)) {
    const mid = midpoint(entity);
    const rad = degreesToRadians(degrees);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rotatePoint = (x: number, y: number): Point => ({
      x: Math.round(mid.x + (x - mid.x) * cos - (y - mid.y) * sin),
      y: Math.round(mid.y + (x - mid.x) * sin + (y - mid.y) * cos),
    });
    const p1 = rotatePoint(entity.x1, entity.y1);
    const p2 = rotatePoint(entity.x2, entity.y2);
    entity.x1 = p1.x;
    entity.y1 = p1.y;
    entity.x2 = p2.x;
    entity.y2 = p2.y;
    return;
  }
  if (entity.type === "shape") {
    const rad = degreesToRadians(degrees);
    if (entity.kind === "polygon") {
      entity.rotation = (entity.rotation ?? 0) + rad;
      return;
    }
    entity.startAngle += rad;
    entity.endAngle += rad;
  }
}

function rotateLineTo(entity: LinearElement, degrees: number): void {
  if (isLocked(entity)) return;
  const mid = midpoint(entity);
  const length = distance(entity);
  const rad = degreesToRadians(degrees);
  entity.x1 = Math.round(mid.x - (Math.cos(rad) * length) / 2);
  entity.y1 = Math.round(mid.y - (Math.sin(rad) * length) / 2);
  entity.x2 = Math.round(mid.x + (Math.cos(rad) * length) / 2);
  entity.y2 = Math.round(mid.y + (Math.sin(rad) * length) / 2);
}

function moveEntity(entity: Entity, origin: Entity, dx: number, dy: number): void {
  if (isLocked(entity) || isLocked(origin)) return;
  const moveX = snap(dx);
  const moveY = snap(dy);
  if (origin.type === "room" && entity.type === "room") {
    entity.x = snap(origin.x + moveX);
    entity.y = snap(origin.y + moveY);
  }
  if (origin.type === "furniture" && entity.type === "furniture") {
    entity.x = snap(origin.x + moveX);
    entity.y = snap(origin.y + moveY);
  }
  if (origin.type === "roof" && entity.type === "roof") {
    entity.x = snap(origin.x + moveX);
    entity.y = snap(origin.y + moveY);
  }
  if (origin.type === "shape" && entity.type === "shape") {
    entity.x = snap(origin.x + moveX);
    entity.y = snap(origin.y + moveY);
  }
  if (origin.type === "text" && entity.type === "text") {
    // 文字は細かく位置を合わせたいので、グリッドに吸着させずに動かす
    entity.x = Math.round(origin.x + dx);
    entity.y = Math.round(origin.y + dy);
  }
  if (isLinear(origin) && isLinear(entity)) {
    entity.x1 = origin.x1 + moveX;
    entity.y1 = origin.y1 + moveY;
    entity.x2 = origin.x2 + moveX;
    entity.y2 = origin.y2 + moveY;
  }
}

function moveRoomLabel(entity: Entity, origin: Entity, dx: number, dy: number): void {
  if (origin.type !== "room" || entity.type !== "room") return;
  if (isLocked(entity) || isLocked(origin)) return;
  entity.labelOffsetX = (origin.labelOffsetX ?? 10) + dx;
  entity.labelOffsetY = (origin.labelOffsetY ?? 10) + dy;
}

function resizeEntity(entity: Entity, origin: Entity, corner: string, point: Point): void {
  if (isLocked(entity) || isLocked(origin)) return;
  if (origin.type === "room" && entity.type === "room") {
    let x1 = origin.x;
    let y1 = origin.y;
    let x2 = origin.x + origin.w;
    let y2 = origin.y + origin.h;
    if (corner.includes("w")) x1 = snap(point.x);
    if (corner.includes("e")) x2 = snap(point.x);
    if (corner.includes("n")) y1 = snap(point.y);
    if (corner.includes("s")) y2 = snap(point.y);
    entity.x = Math.min(x1, x2);
    entity.y = Math.min(y1, y2);
    entity.w = Math.max(GRID * 2, Math.abs(x2 - x1));
    entity.h = Math.max(GRID * 2, Math.abs(y2 - y1));
  }

  if (origin.type === "furniture" && entity.type === "furniture") {
    let x1 = origin.x;
    let y1 = origin.y;
    let x2 = origin.x + origin.w;
    let y2 = origin.y + origin.h;
    if (corner.includes("w")) x1 = snap(point.x);
    if (corner.includes("e")) x2 = snap(point.x);
    if (corner.includes("n")) y1 = snap(point.y);
    if (corner.includes("s")) y2 = snap(point.y);
    entity.x = Math.min(x1, x2);
    entity.y = Math.min(y1, y2);
    entity.w = Math.max(GRID, Math.abs(x2 - x1));
    entity.h = Math.max(GRID, Math.abs(y2 - y1));
  }

  if (origin.type === "roof" && entity.type === "roof") {
    let x1 = origin.x;
    let y1 = origin.y;
    let x2 = origin.x + origin.w;
    let y2 = origin.y + origin.h;
    if (corner.includes("w")) x1 = snap(point.x);
    if (corner.includes("e")) x2 = snap(point.x);
    if (corner.includes("n")) y1 = snap(point.y);
    if (corner.includes("s")) y2 = snap(point.y);
    entity.x = Math.min(x1, x2);
    entity.y = Math.min(y1, y2);
    entity.w = Math.max(GRID * 2, Math.abs(x2 - x1));
    entity.h = Math.max(GRID * 2, Math.abs(y2 - y1));
  }

  if (isLinear(origin) && isLinear(entity) && (corner === "p1" || corner === "p2")) {
    const fixed = corner === "p1" ? { x: origin.x2, y: origin.y2 } : { x: origin.x1, y: origin.y1 };
    const moved = constrainLine(fixed, { x: snap(point.x), y: snap(point.y) });
    if (Math.hypot(moved.x - fixed.x, moved.y - fixed.y) < GRID) return;
    if (corner === "p1") {
      entity.x1 = moved.x;
      entity.y1 = moved.y;
    } else {
      entity.x2 = moved.x;
      entity.y2 = moved.y;
    }
  }
}

function render2d(): void {
  const { width, height } = resizePlanCanvas();
  const ratio = getCanvasPixelRatio();
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawPlan(width, height, { grid: true, ghost: true, editing: true });
  scheduleViewStateSave();
}

// 間取りを描く。editing は画面だけの物（屋根の破線・固定の印・作図中の線）も描くとき
function drawPlan(width: number, height: number, options: { grid: boolean; ghost: boolean; editing: boolean }): void {
  ctx.save();
  ctx.translate(view.x, view.y);
  ctx.scale(view.zoom, view.zoom);

  if (options.grid) drawGrid(width, height);

  const entities = activeEntities();
  drawLayer(entities.filter(isRoom), drawRoom);
  if (options.grid && view.zoom > GRID_OVER_ROOMS_ZOOM) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    drawGrid(width, height);
    ctx.restore();
  }
  // 現在の階の部屋の塗りの上・線画の下に、ほかの階のゴーストを挟む
  if (options.ghost) drawFloorBelowGhost();
  drawLayer(entities.filter(isFurniture).filter((item) => item.kind === "rug" || item.kind === "paint"), drawFurniture2d);
  drawLayer(entities.filter((entity): entity is LinearElement => entity.type === "wall"), (wallItem) => {
    getVisibleWallSegments(wallItem, entities).forEach(drawWall2d);
  });
  drawLayer(entities.filter((entity): entity is LinearElement => entity.type === "window"), drawWindow2d);
  drawLayer(entities.filter((entity): entity is LinearElement => entity.type === "door"), drawDoor2d);
  drawLayer(entities.filter(isFurniture).filter((item) => item.kind !== "rug" && item.kind !== "paint"), drawFurniture2d);
  drawLayer(entities.filter(isShape), drawShape2d);
  if (options.editing) {
    revealRoofsIfSelected();
    if (roofsOn2d()) state.roofs.forEach(drawRoof2d);
  }
  drawLayer(entities.filter(isTextLabel), drawTextLabel);
  if (options.editing) {
    entities.filter(isLocked).forEach(drawLockedIndicator);
    if (roofsOn2d()) state.roofs.filter(isLocked).forEach(drawLockedIndicator);
    if (drag.dragMode === "path" && drag.path) {
      if (activeTool === "paint") drawPaintPreview(drag.path);
      else if (activeFurniture === "brokenGlass") drawShardPreview(drag.path);
      else drawFootprintPreview(drag.path);
    }
    if (drag.dragMode === "draw" && activeTool !== "furniture") {
      drawPreview(drag.startWorld, drag.currentWorld);
    }
  }

  ctx.restore();
}

// 方眼の間隔。20cmを基準に、画面上で狭すぎれば5倍ずつ広げ、広すぎれば1/5ずつ細かくする
function gridStep(): number {
  let step = GRID;
  while (step * view.zoom < MIN_GRID_PIXELS) step *= 5;
  while ((step / 5) * view.zoom >= MIN_GRID_PIXELS) step /= 5;
  return step;
}

function drawGrid(canvasWidth: number, canvasHeight: number): void {
  const left = -view.x / view.zoom;
  const top = -view.y / view.zoom;
  const right = left + canvasWidth / view.zoom;
  const bottom = top + canvasHeight / view.zoom;
  const step = gridStep();
  // 5本ごとの太い線は、線の番号で見分ける（小数の間隔でも割り算の誤差が出ない）
  const firstX = Math.floor(left / step), lastX = Math.ceil(right / step);
  const firstY = Math.floor(top / step), lastY = Math.ceil(bottom / step);

  ctx.lineWidth = 1 / view.zoom;
  for (let i = firstX; i <= lastX; i += 1) {
    ctx.beginPath();
    ctx.strokeStyle = i % 5 === 0 ? "#e2e6ec" : "#f2f4f7";
    ctx.moveTo(i * step, top);
    ctx.lineTo(i * step, bottom);
    ctx.stroke();
  }
  for (let i = firstY; i <= lastY; i += 1) {
    ctx.beginPath();
    ctx.strokeStyle = i % 5 === 0 ? "#e2e6ec" : "#f2f4f7";
    ctx.moveTo(left, i * step);
    ctx.lineTo(right, i * step);
    ctx.stroke();
  }
}

// 透かして見せる階。「すぐ下」「すぐ上」「ほかの階すべて」、または階を1つ選ぶ
function ghostFloors(): Floor[] {
  const target = ghostSettings.target;
  const active = state.activeFloor;
  if (target === "below") return active > 0 ? [state.floors[active - 1]] : [];
  if (target === "above") return active < state.floors.length - 1 ? [state.floors[active + 1]] : [];
  if (target === "all") return state.floors.filter((_, index) => index !== active);
  return state.floors.filter((floor, index) => floor.id === target && index !== active);
}

// 透かす階を、まず別のキャンバスにふつうの濃さで描き、最後に1回だけ半透明で重ねる。
// 要素ごとに半透明で重ねると、壁の角や重なった所だけ濃くなってしまうため
function drawFloorBelowGhost(): void {
  if (!showGhostFloor) return;
  const floors = ghostFloors();
  if (!floors.length) return;
  ghostCanvas ??= document.createElement("canvas");
  const target = ghostCanvas;
  if (target.width !== planCanvas.width || target.height !== planCanvas.height) {
    target.width = planCanvas.width;
    target.height = planCanvas.height;
  }
  const ghostContext = target.getContext("2d");
  if (!ghostContext) return;
  const planContext = ctx;
  const transform = planContext.getTransform();
  ctx = ghostContext;
  try {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.setTransform(transform);
    // 部屋の塗りを先に全部描き、その上に線の要素を描く（ほかの階の床が線を隠さないように）
    drawLayer(floors.flatMap((floor) => floor.entities.filter(isRoom)), drawRoom);
    for (const floor of floors) {
      const entities = floor.entities;
      drawLayer(entities.filter((entity): entity is LinearElement => entity.type === "wall"), (wallItem) => {
        getVisibleWallSegments(wallItem, entities).forEach(drawWall2d);
      });
      drawLayer(entities.filter((entity): entity is LinearElement => entity.type === "window"), drawWindow2d);
      drawLayer(entities.filter((entity): entity is LinearElement => entity.type === "door"), drawDoor2d);
      drawLayer(entities.filter(isFurniture), drawFurniture2d);
      drawLayer(entities.filter(isShape), drawShape2d);
      drawLayer(entities.filter(isTextLabel), drawTextLabel);
    }
    const tint = parseColorCode(ghostSettings.color);
    if (tint) {
      // 透かす色が決まっているときは、描いた形をその色1色に塗り替える
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = tint.rgb;
      ctx.fillRect(0, 0, target.width, target.height);
      ctx.globalCompositeOperation = "source-over";
    }
  } finally {
    ctx = planContext;
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = ghostOpacity();
  ctx.drawImage(target, 0, 0);
  ctx.restore();
}

// ---- 透明度のある色 ----

// カラーコードに透明度がある要素は、同じ色どうしをまとめて別のキャンバスに不透明で描き、最後に1回だけ半透明で重ねる。
// 1つずつ半透明で描くと、線の重なりや壁の角だけが濃くなってしまうため
function drawLayer<T extends Entity & { color?: string }>(items: T[], draw: (item: T) => void): void {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const parsed = parseColorCode(item.color);
    if (!parsed || parsed.alpha >= 1) {
      draw(item);
      continue;
    }
    const group = groups.get(parsed.code);
    if (group) group.push(item);
    else groups.set(parsed.code, [item]);
  }
  groups.forEach((group, code) => {
    drawTranslucent(colorAlpha(code), () => group.forEach(draw));
    // 選んでいる物のつまみは、透明に近い色でも見失わないよう上から描き直す
    group.filter((item) => item.id === state.selectedId).forEach(drawSelectionMarks);
  });
}

function drawTranslucent(alpha: number, draw: () => void): void {
  if (alpha <= 0) return;
  const base = ctx;
  translucentCanvas ??= document.createElement("canvas");
  const target = translucentCanvas;
  if (target.width !== base.canvas.width || target.height !== base.canvas.height) {
    target.width = base.canvas.width;
    target.height = base.canvas.height;
  }
  const layer = target.getContext("2d");
  if (!layer) return;
  const transform = base.getTransform();
  ctx = layer;
  try {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.setTransform(transform);
    draw();
  } finally {
    ctx = base;
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha *= alpha;
  ctx.drawImage(target, 0, 0);
  ctx.restore();
}

// 選んでいる要素の枠やつまみ（大きさや端を動かす所）
function drawSelectionMarks(entity: Entity): void {
  if (entity.type === "room") {
    drawRoomLabelGuide(entity);
    if (!isLocked(entity)) drawResizeHandles(entity);
  } else if (entity.type === "furniture") {
    if (!isLocked(entity) && !isPersonKind(entity.kind)) drawResizeHandles(entity);
    if (!isLocked(entity) && isPersonKind(entity.kind)) drawPersonHandles(entity);
  } else if (entity.type === "wall") {
    if (!isLocked(entity)) getVisibleWallSegments(entity, activeEntities()).forEach(drawLineHandles);
  } else if (entity.type === "door" || entity.type === "window") {
    if (!isLocked(entity)) drawLineHandles(entity);
  } else if (entity.type === "shape") {
    if (!isLocked(entity)) drawShapeHandle(entity);
  } else if (entity.type === "text") {
    drawTextSelection(entity);
  }
}

function drawRoof2d(roofItem: Roof): void {
  const selected = state.selectedId === roofItem.id;
  const horizontal = roofItem.w >= roofItem.h;
  const cx = roofItem.x + roofItem.w / 2;
  const cy = roofItem.y + roofItem.h / 2;
  const inset = Math.min(roofItem.w, roofItem.h) / 2;

  ctx.save();
  ctx.fillStyle = selected ? "rgba(39, 117, 209, 0.12)" : "rgba(93, 103, 115, 0.06)";
  ctx.strokeStyle = selected ? "#2775d1" : "#657180";
  ctx.lineWidth = (selected ? 2.2 : 1.4) / view.zoom;
  ctx.setLineDash(selected ? [] : [7 / view.zoom, 5 / view.zoom]);
  ctx.fillRect(roofItem.x, roofItem.y, roofItem.w, roofItem.h);
  ctx.strokeRect(roofItem.x, roofItem.y, roofItem.w, roofItem.h);
  ctx.setLineDash([]);

  ctx.beginPath();
  if (roofItem.kind === "flat") {
    const edgeInset = Math.min(16 / view.zoom, roofItem.w / 4, roofItem.h / 4);
    ctx.rect(roofItem.x + edgeInset, roofItem.y + edgeInset, roofItem.w - edgeInset * 2, roofItem.h - edgeInset * 2);
  } else if (horizontal) {
    const ridgeStart = roofItem.kind === "gable" ? roofItem.x : roofItem.x + inset;
    const ridgeEnd = roofItem.kind === "gable" ? roofItem.x + roofItem.w : roofItem.x + roofItem.w - inset;
    ctx.moveTo(ridgeStart, cy);
    ctx.lineTo(ridgeEnd, cy);
    if (roofItem.kind === "hip") {
      ctx.moveTo(roofItem.x, roofItem.y);
      ctx.lineTo(ridgeStart, cy);
      ctx.lineTo(roofItem.x, roofItem.y + roofItem.h);
      ctx.moveTo(roofItem.x + roofItem.w, roofItem.y);
      ctx.lineTo(ridgeEnd, cy);
      ctx.lineTo(roofItem.x + roofItem.w, roofItem.y + roofItem.h);
    }
  } else {
    const ridgeStart = roofItem.kind === "gable" ? roofItem.y : roofItem.y + inset;
    const ridgeEnd = roofItem.kind === "gable" ? roofItem.y + roofItem.h : roofItem.y + roofItem.h - inset;
    ctx.moveTo(cx, ridgeStart);
    ctx.lineTo(cx, ridgeEnd);
    if (roofItem.kind === "hip") {
      ctx.moveTo(roofItem.x, roofItem.y);
      ctx.lineTo(cx, ridgeStart);
      ctx.lineTo(roofItem.x + roofItem.w, roofItem.y);
      ctx.moveTo(roofItem.x, roofItem.y + roofItem.h);
      ctx.lineTo(cx, ridgeEnd);
      ctx.lineTo(roofItem.x + roofItem.w, roofItem.y + roofItem.h);
    }
  }
  ctx.stroke();

  if (showDimensions) {
    ctx.fillStyle = selected ? "#145da8" : "#4d5967";
    ctx.font = `${Math.max(10, 11 / view.zoom)}px "Yu Gothic UI", sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${formatMeters(roofItem.w)} x ${formatMeters(roofItem.h)}`, roofItem.x + 6, roofItem.y - 5 / view.zoom);
  }
  ctx.restore();

  if (selected && !isLocked(roofItem)) drawResizeHandles(roofItem);
}

function drawRoom(room: Room): void {
  const selected = state.selectedId === room.id;
  const surface = room.surface ?? "plain";
  // 透明度は部屋ごとではなく、同じ色の部屋をまとめて重ねるときに付ける（drawLayer）
  const fill = solidColor(room.color);
  const pattern = surface !== "plain" ? ctx.createPattern(surfaceCanvas(surface, fill), "repeat") : null;
  pattern?.setTransform(new DOMMatrix().translate(room.x, room.y).scale(SURFACE_TILE_CM / 256));
  ctx.fillStyle = pattern ?? fill;
  ctx.strokeStyle = selected ? "#2775d1" : "#c3c9d2";
  ctx.lineWidth = selected ? 2.4 / view.zoom : 1.1 / view.zoom;
  ctx.fillRect(room.x, room.y, room.w, room.h);
  if (selected) {
    ctx.fillStyle = "rgba(39,117,209,0.08)";
    ctx.fillRect(room.x, room.y, room.w, room.h);
  }
  ctx.strokeRect(room.x, room.y, room.w, room.h);

  const label = getRoomLabelPosition(room);
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.font = `${Math.max(12, 13 / view.zoom)}px "Yu Gothic UI", sans-serif`;
  ctx.textBaseline = "top";
  const named = room.name.trim() !== "" && !hideRoomNames;
  if (named) ctx.fillText(room.name, label.x, label.y);
  if (showDimensions) {
    // 名前がないときは、寸法を名前の位置へ詰める
    ctx.fillStyle = INK_SOFT;
    ctx.font = `${Math.max(10, 11 / view.zoom)}px "Yu Gothic UI", sans-serif`;
    ctx.fillText(`${formatMeters(room.w)} x ${formatMeters(room.h)}`, label.x, label.y + (named ? 20 : 0));
  }
  if (selected) drawRoomLabelGuide(room);
  if (selected && !isLocked(room)) drawResizeHandles(room);
}

function drawRoomLabelGuide(room: Room): void {
  const bounds = getRoomLabelBounds(room);
  if (!bounds) return;
  ctx.save();
  ctx.setLineDash([5 / view.zoom, 4 / view.zoom]);
  ctx.strokeStyle = "rgba(39, 117, 209, 0.7)";
  ctx.lineWidth = 1.5 / view.zoom;
  ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.restore();
}

function drawWall2d(wallItem: LinearElement): void {
  drawLineElement(wallItem, solidColor(wallItem.color) ?? INK, WALL_THICKNESS_2D);
  if (state.selectedId === wallItem.id && !isLocked(wallItem)) drawLineHandles(wallItem);
}

function drawLineHandles(entity: LinearElement): void {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#2775d1";
  ctx.lineWidth = 2 / view.zoom;
  const size = 8 / view.zoom;
  [
    { x: entity.x1, y: entity.y1 },
    { x: entity.x2, y: entity.y2 },
  ].forEach((end) => {
    ctx.fillRect(end.x - size / 2, end.y - size / 2, size, size);
    ctx.strokeRect(end.x - size / 2, end.y - size / 2, size, size);
  });
  ctx.restore();
}

function drawWindow2d(windowEl: LinearElement): void {
  const selected = state.selectedId === windowEl.id;
  const length = distance(windowEl);
  if (length <= 0) return;
  const mid = midpoint(windowEl);
  const angle = lineAngle(windowEl);
  const t = WALL_THICKNESS_2D;
  ctx.save();
  ctx.translate(mid.x, mid.y);
  ctx.rotate(angle);
  if (selected) {
    ctx.strokeStyle = "rgba(39, 117, 209, 0.4)";
    ctx.lineWidth = (t + 8) / view.zoom;
    ctx.beginPath();
    ctx.moveTo(-length / 2, 0);
    ctx.lineTo(length / 2, 0);
    ctx.stroke();
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-length / 2, -t / 2, length, t);
  ctx.strokeStyle = selected ? "#2775d1" : solidColor(windowEl.color) ?? INK;
  ctx.lineWidth = 1.4 / view.zoom;
  ctx.strokeRect(-length / 2, -t / 2, length, t);
  ctx.beginPath();
  ctx.moveTo(-length / 2, 0);
  ctx.lineTo(length / 2, 0);
  ctx.stroke();
  if (windowEl.mullion) {
    ctx.beginPath();
    ctx.moveTo(0, -t / 2);
    ctx.lineTo(0, t / 2);
    ctx.stroke();
  }
  ctx.restore();
  if (selected && !isLocked(windowEl)) drawLineHandles(windowEl);
}

function drawDoor2d(door: LinearElement): void {
  if (door.doorStyle === "sliding") {
    drawSlidingDoor2d(door);
    return;
  }
  ctx.save();
  const selected = state.selectedId === door.id;
  const length = Math.max(distance(door), GRID);
  const angle = Math.atan2(door.y2 - door.y1, door.x2 - door.x1);
  const side = door.flip ? 1 : -1;
  const leafAngle = angle + (side * Math.PI) / 2;
  const leafEnd = {
    x: door.x1 + Math.cos(leafAngle) * length,
    y: door.y1 + Math.sin(leafAngle) * length,
  };

  ctx.lineCap = "butt";
  ctx.strokeStyle = selected ? "#2775d1" : solidColor(door.color) ?? INK;
  ctx.lineWidth = (selected ? 3 : 1.8) / view.zoom;
  ctx.beginPath();
  ctx.moveTo(door.x1, door.y1);
  ctx.lineTo(leafEnd.x, leafEnd.y);
  ctx.stroke();

  ctx.lineWidth = (selected ? 2 : 1.2) / view.zoom;
  ctx.beginPath();
  if (door.flip) {
    ctx.arc(door.x1, door.y1, length, angle, leafAngle, false);
  } else {
    ctx.arc(door.x1, door.y1, length, leafAngle, angle, false);
  }
  ctx.stroke();
  ctx.restore();
  if (selected && !isLocked(door)) drawLineHandles(door);
}

function drawSlidingDoor2d(door: LinearElement): void {
  const selected = state.selectedId === door.id;
  const length = Math.max(distance(door), GRID);
  const mid = midpoint(door);
  const angle = lineAngle(door);
  const depth = WALL_THICKNESS_2D;
  const front = door.flip ? -1 : 1;
  ctx.save();
  ctx.translate(mid.x, mid.y);
  ctx.rotate(angle);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-length / 2, -depth / 2, length, depth);
  ctx.strokeStyle = selected ? "#2775d1" : solidColor(door.color) ?? INK;
  ctx.lineWidth = (selected ? 2.2 : 1.4) / view.zoom;
  ctx.strokeRect(-length / 2, -depth / 2, length, depth);
  const panelWidth = length * 0.56;
  const trackOffset = depth * 0.23 * front;
  ctx.beginPath();
  ctx.moveTo(-length / 2, -trackOffset);
  ctx.lineTo(-length / 2 + panelWidth, -trackOffset);
  ctx.moveTo(length / 2 - panelWidth, trackOffset);
  ctx.lineTo(length / 2, trackOffset);
  ctx.stroke();
  const handleX = length * 0.08;
  ctx.lineWidth = 2 / view.zoom;
  ctx.beginPath();
  ctx.moveTo(-handleX, -trackOffset - depth * 0.18);
  ctx.lineTo(-handleX, -trackOffset + depth * 0.18);
  ctx.moveTo(handleX, trackOffset - depth * 0.18);
  ctx.lineTo(handleX, trackOffset + depth * 0.18);
  ctx.stroke();
  ctx.restore();
  if (selected && !isLocked(door)) drawLineHandles(door);
}

function drawLineElement(entity: LinearElement, color: string, width: number): void {
  const selected = state.selectedId === entity.id;
  ctx.save();
  ctx.lineCap = "square";
  ctx.lineWidth = selected ? width + 6 / view.zoom : width;
  ctx.strokeStyle = selected ? "rgba(39, 117, 209, 0.35)" : color;
  ctx.beginPath();
  ctx.moveTo(entity.x1, entity.y1);
  ctx.lineTo(entity.x2, entity.y2);
  ctx.stroke();
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(entity.x1, entity.y1);
  ctx.lineTo(entity.x2, entity.y2);
  ctx.stroke();
  ctx.restore();
}

// ---- 2D furniture symbols ----

function strokeLine(x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function strokeCircle(x: number, y: number, r: number, fill = false): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) ctx.fill();
  ctx.stroke();
}

function strokeEllipse(x: number, y: number, rx: number, ry: number, fill = false): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) ctx.fill();
  ctx.stroke();
}

function strokeRoundedRect(x: number, y: number, w: number, h: number, r: number, fill = false): void {
  roundedRect(x, y, w, h, r);
  if (fill) ctx.fill();
  ctx.stroke();
}

function strokeArrowHead(x: number, y: number, angle: number, size: number): void {
  ctx.beginPath();
  ctx.moveTo(x - Math.cos(angle - 0.5) * size, y - Math.sin(angle - 0.5) * size);
  ctx.lineTo(x, y);
  ctx.lineTo(x - Math.cos(angle + 0.5) * size, y - Math.sin(angle + 0.5) * size);
  ctx.stroke();
}

function drawMiniChair(cx: number, cy: number, size: number, backSide: number): void {
  const backH = Math.max(3, size * 0.24);
  const fill = ctx.fillStyle;
  strokeRoundedRect(cx - size * 0.45, cy - size / 2 + (backSide < 0 ? backH * 0.5 : 0), size * 0.9, size - backH * 0.5, size * 0.14, true);
  ctx.fillStyle = SYMBOL_SHADE;
  strokeRoundedRect(cx - size / 2, backSide < 0 ? cy - size / 2 : cy + size / 2 - backH, size, backH, backH * 0.45, true);
  ctx.fillStyle = fill;
}

// 冷蔵庫に描く雪の結晶。3本の軸と、各枝先の小さな枝
function drawSnowflake(cx: number, cy: number, r: number): void {
  for (let i = 0; i < 3; i += 1) {
    const a = (i * Math.PI) / 3;
    strokeLine(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  for (let i = 0; i < 6; i += 1) {
    const a = (i * Math.PI) / 3;
    const bx = cx + Math.cos(a) * r * 0.62, by = cy + Math.sin(a) * r * 0.62;
    for (const side of [-1, 1]) strokeLine(bx, by, bx + Math.cos(a + side * 0.75) * r * 0.32, by + Math.sin(a + side * 0.75) * r * 0.32);
  }
}

// 上から見た靴の底。つま先（奥）が広く、かかと（手前）が細い。左右の足で少し外へ開く
function drawShoe(cx: number, cy: number, halfWidth: number, length: number, angle: number): void {
  const top = -length / 2, bottom = length / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.bezierCurveTo(halfWidth * 1.15, top, halfWidth * 1.1, top + length * 0.45, halfWidth * 0.62, bottom - length * 0.18);
  ctx.bezierCurveTo(halfWidth * 0.6, bottom, -halfWidth * 0.6, bottom, -halfWidth * 0.62, bottom - length * 0.18);
  ctx.bezierCurveTo(-halfWidth * 1.1, top + length * 0.45, -halfWidth * 1.15, top, 0, top);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function traceLShape(w: number, h: number, arm: number): void {
  const hw = w / 2, hh = h / 2;
  ctx.beginPath();
  ctx.moveTo(-hw, -hh);
  ctx.lineTo(hw, -hh);
  ctx.lineTo(hw, -hh + arm);
  ctx.lineTo(-hw + arm, -hh + arm);
  ctx.lineTo(-hw + arm, hh);
  ctx.lineTo(-hw, hh);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawDrawerStack(x0: number, x1: number, y0: number, y1: number): void {
  strokeLine(x0, y0, x0, y1);
  for (const t of [1 / 3, 2 / 3]) strokeLine(x0, y0 + (y1 - y0) * t, x1, y0 + (y1 - y0) * t);
  for (const t of [1 / 6, 1 / 2, 5 / 6]) strokeLine(x0 + (x1 - x0) * 0.3, y0 + (y1 - y0) * t, x1 - (x1 - x0) * 0.3, y0 + (y1 - y0) * t);
}

function drawFurniture2d(furnitureItem: Furniture): void {
  const selected = state.selectedId === furnitureItem.id;
  ctx.save();
  ctx.translate(furnitureItem.x + furnitureItem.w / 2, furnitureItem.y + furnitureItem.h / 2);
  ctx.rotate((furnitureItem.rotation * Math.PI) / 180);
  if (furnitureItem.flip) ctx.scale(-1, 1);
  ctx.lineWidth = 1.4 / view.zoom;
  ctx.strokeStyle = solidColor(furnitureItem.color) ?? INK;
  ctx.fillStyle = furnitureFill(furnitureItem);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  drawFurnitureSymbol(furnitureItem.kind, furnitureItem.w, furnitureItem.h, furnitureItem.symbol ?? 0, furnitureItem);
  if (furnitureItem.kind === "evidenceMarker") drawMarkerLabel(furnitureItem);
  if (selected) {
    ctx.strokeStyle = "#2775d1";
    ctx.lineWidth = 2.2 / view.zoom;
    strokeRoundedRect(-furnitureItem.w / 2, -furnitureItem.h / 2, furnitureItem.w, furnitureItem.h, 4);
  }
  ctx.restore();
  // 人は四隅のつまみの代わりに手首・足首のつまみを出す（大きさは「身長」で変える）
  if (selected && !isLocked(furnitureItem) && !isPersonKind(furnitureItem.kind)) drawResizeHandles(furnitureItem);
  if (selected && !isLocked(furnitureItem) && isPersonKind(furnitureItem.kind)) drawPersonHandles(furnitureItem);
}

function furnitureSymbolFill(kind: FurnitureKind): string {
  const mark = MARK_FILLS[kind];
  if (mark) return mark;
  if (kind === "evidenceMarker") return "#f4c430";
  if (kind === "fallenPerson" || kind === "person") return "#e4e0da";
  if (["sofa", "sofa2", "sofaCorner", "armchair", "officeChair", "zaisu", "stool", "bed", "bedSemiDouble", "bedDouble", "bunkBed"].includes(kind)) return "#edf3f2";
  if (["table", "sideTable", "roundTable", "longTable", "desk", "deskL", "bench", "shelf", "closet", "wardrobe", "cupboard", "shoeCabinet"].includes(kind)) return "#f7f5f0";
  return "#ffffff";
}

function drawFurnitureSymbol(kind: FurnitureKind, w: number, h: number, symbol = 0, item?: Furniture): void {
  const variant = symbol > 0 ? SYMBOL_VARIANTS[kind]?.[symbol - 1] : undefined;
  if (variant) {
    variant.draw(w, h, item);
    return;
  }
  const hw = w / 2;
  const hh = h / 2;
  const baseFill = ctx.fillStyle;
  switch (kind) {
    case "sofaCorner": {
      ctx.beginPath();
      ctx.moveTo(-hw, -hh);
      ctx.lineTo(hw, -hh);
      ctx.lineTo(hw, hh);
      ctx.lineTo(w * 0.12, hh);
      ctx.lineTo(w * 0.12, 0);
      ctx.lineTo(-hw, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      strokeLine(-hw, -h * 0.36, hw, -h * 0.36);
      strokeLine(w * 0.4, -h * 0.36, w * 0.4, hh);
      strokeLine(-w * 0.18, -h * 0.36, -w * 0.18, 0);
      strokeLine(w * 0.12, -h * 0.36, w * 0.12, 0);
      strokeRoundedRect(w * 0.15, h * 0.04, w * 0.22, h * 0.41, 4);
      strokeRoundedRect(-w * 0.41, -h * 0.28, w * 0.16, h * 0.19, 4);
      break;
    }
    case "sideTable": {
      strokeRoundedRect(-hw, -hh, w, h, 4, true);
      strokeRoundedRect(-w * 0.4, -h * 0.4, w * 0.8, h * 0.8, 2);
      for (const x of [-1, 1]) for (const y of [-1, 1]) strokeCircle(x * w * 0.36, y * h * 0.36, Math.min(w, h) * 0.025);
      break;
    }
    case "roundTable":
    case "stool":
    case "floorLamp": {
      strokeEllipse(0, 0, hw, hh, true);
      if (kind === "stool") strokeEllipse(0, 0, w * 0.4, h * 0.4);
      if (kind === "roundTable") strokeEllipse(0, 0, w * 0.46, h * 0.46);
      if (kind === "floorLamp") {
        // 内側の円は、3Dのシェードの上の口と同じ大きさ
        strokeEllipse(0, 0, w * 0.32, h * 0.32);
        strokeLine(-w * 0.15, -h * 0.15, w * 0.15, h * 0.15);
        strokeLine(w * 0.15, -h * 0.15, -w * 0.15, h * 0.15);
      }
      break;
    }
    case "rug": {
      ctx.fillStyle = "#e3ecea";
      strokeRoundedRect(-hw, -hh, w, h, 2, true);
      strokeRoundedRect(-w * 0.44, -h * 0.42, w * 0.88, h * 0.84, 1);
      for (const side of [-1, 1]) for (let i = 0; i < 18; i += 1) strokeLine(-w * 0.44 + i * w * 0.88 / 17, side * h * 0.46, -w * 0.44 + i * w * 0.88 / 17, side * h * 0.5);
      break;
    }
    case "piano": {
      strokeRoundedRect(-hw, -hh, w, h, 2, true);
      strokeLine(-hw, h * 0.15, hw, h * 0.15);
      for (let i = 0; i <= 35; i += 1) {
        const x = -w * 0.435 + i * w * 0.87 / 35;
        strokeLine(x, h * 0.15, x, hh);
        if (i < 35 && ![2, 6].includes(i % 7)) {
          ctx.fillStyle = String(ctx.strokeStyle);
          ctx.fillRect(x + w * 0.87 / 35 * 0.72, h * 0.15, w * 0.87 / 35 * 0.56, h * 0.19);
        }
      }
      break;
    }
    case "bench": {
      strokeRoundedRect(-hw, -hh, w, h, 3, true);
      for (let i = 1; i < 5; i += 1) strokeLine(-hw, -hh + h * i / 5, hw, -hh + h * i / 5);
      strokeLine(-w * 0.4, -hh, -w * 0.4, hh);
      strokeLine(w * 0.4, -hh, w * 0.4, hh);
      strokeRoundedRect(-w * 0.47, -h * 0.46, w * 0.94, h * 0.12, 2);
      break;
    }
    case "sofa":
    case "sofa2":
    case "armchair": {
      strokeRoundedRect(-hw, -hh, w, h, 8, true);
      const t = Math.min(w, h) * 0.22;
      strokeRoundedRect(-hw, -hh, w, t, 5);
      strokeRoundedRect(-hw, -hh, t, h, 5);
      strokeRoundedRect(hw - t, -hh, t, h, 5);
      const count = kind === "armchair" ? 1 : Math.max(2, Math.min(4, Math.round(w / 65)));
      const usable = w - t * 2;
      for (let i = 0; i < count; i += 1) {
        strokeRoundedRect(-hw + t + i * usable / count + usable * 0.01, -hh + t + h * 0.035, usable / count - usable * 0.02, h - t - h * 0.07, Math.min(w, h) * 0.05);
      }
      break;
    }
    case "table": {
      strokeRoundedRect(-hw, -hh, w, h, 6, true);
      strokeRoundedRect(-w * 0.46, -h * 0.44, w * 0.92, h * 0.88, 4);
      break;
    }
    case "tv": {
      // 奥に薄型テレビの画面（塗りつぶし）とスタンド、手前に台の扉と取っ手
      strokeRoundedRect(-hw, -hh, w, h, 3, true);
      strokeRoundedRect(-w * 0.1, -h * 0.16, w * 0.2, h * 0.22, 1.5);
      ctx.fillStyle = String(ctx.strokeStyle);
      roundedRect(-w * 0.43, -h * 0.3, w * 0.86, Math.max(2.5, h * 0.12), 1.5);
      ctx.fill();
      strokeLine(0, hh - h * 0.2, 0, hh);
      for (const sign of [-1, 1]) strokeLine(sign * w * 0.12, hh - h * 0.1, sign * w * 0.3, hh - h * 0.1);
      break;
    }
    case "plant":
    case "plantLarge": {
      ctx.fillStyle = "#e8f1e7";
      strokeEllipse(0, 0, w * 0.22, h * 0.22, true);
      for (const angle of PLANT_LEAF_ANGLES) {
        ctx.save();
        ctx.scale(w / Math.max(w, h), h / Math.max(w, h));
        ctx.rotate(angle);
        const r = Math.max(w, h) * 0.5;
        strokeEllipse(r * 0.5, 0, r * 0.44, r * 0.14, true);
        strokeLine(r * 0.06, 0, r * 0.9, 0);
        ctx.restore();
      }
      strokeEllipse(0, 0, w * 0.065, h * 0.065);
      break;
    }
    case "wallClock": {
      strokeRoundedRect(-hw, -hh, w, h, 3, true);
      const r = Math.min(hw * 0.42, hh * 0.72);
      strokeCircle(0, 0, r);
      strokeLine(0, 0, 0, -r * 0.55);
      strokeLine(0, 0, r * 0.45, r * 0.2);
      for (let i = 0; i < 4; i += 1) {
        const a = i * Math.PI / 2;
        strokeLine(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95);
      }
      break;
    }
    case "grandfatherClock": {
      strokeRoundedRect(-hw, -hh, w, h, 3, true);
      const r = Math.min(hw, hh) * 0.42;
      strokeCircle(0, -hh * 0.24, r);
      strokeLine(0, -hh * 0.24, 0, -hh * 0.24 - r * 0.55);
      strokeLine(0, -hh * 0.24, r * 0.45, -hh * 0.12);
      strokeCircle(0, hh * 0.35, r * 0.28);
      strokeLine(0, h * 0.05, 0, h * 0.27);
      break;
    }
    case "aquarium": {
      ctx.fillStyle = "#e8f4f7";
      strokeRoundedRect(-hw, -hh, w, h, 3, true);
      strokeRoundedRect(-hw + 5, -hh + 5, w - 10, h - 10, 2);
      ctx.beginPath();
      for (let i = 0; i <= 12; i += 1) {
        const x = -hw + 8 + ((w - 16) * i) / 12;
        const y = -hh + h * 0.34 + Math.sin((i / 12) * Math.PI * 4) * h * 0.07;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      strokeEllipse(w * 0.12, h * 0.12, Math.min(w, h) * 0.16, Math.min(w, h) * 0.08);
      strokeLine(w * 0.26, h * 0.12, w * 0.34, h * 0.04);
      strokeLine(w * 0.26, h * 0.12, w * 0.34, h * 0.2);
      break;
    }
    case "diningTable": {
      const tw = w * 0.7;
      const th = h * 0.48;
      const cs = Math.min(w, h) * 0.23;
      const chairZ = th / 2 + cs * 0.58;
      drawMiniChair(-w * 0.17, -chairZ, cs, -1);
      drawMiniChair(w * 0.17, -chairZ, cs, -1);
      drawMiniChair(-w * 0.17, chairZ, cs, 1);
      drawMiniChair(w * 0.17, chairZ, cs, 1);
      strokeRoundedRect(-tw / 2, -th / 2, tw, th, 4, true);
      break;
    }
    case "chair": {
      // 座面と、奥の背もたれを塗り分けて向きが分かるようにする
      const backH = Math.max(4, h * 0.22);
      strokeRoundedRect(-hw + w * 0.05, -hh + backH * 0.5, w * 0.9, h - backH * 0.5, Math.min(w, h) * 0.14, true);
      ctx.fillStyle = SYMBOL_SHADE;
      strokeRoundedRect(-hw, -hh, w, backH, backH * 0.45, true);
      break;
    }
    case "officeChair": {
      drawOfficeChair(w, h);
      break;
    }
    case "parasol": {
      // 8角形の傘と、中心から角へ伸びる骨の線、てっぺんの飾り（3Dと同じ角の向き）
      ctx.fillStyle = "#f6efe2";
      ctx.beginPath();
      PARASOL_CORNERS.forEach((a, i) => (i ? ctx.lineTo(Math.cos(a) * hw, Math.sin(a) * hh) : ctx.moveTo(Math.cos(a) * hw, Math.sin(a) * hh)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      for (const a of PARASOL_CORNERS) strokeLine(0, 0, Math.cos(a) * hw, Math.sin(a) * hh);
      ctx.fillStyle = OUTDOOR_TRUNK;
      strokeCircle(0, 0, Math.min(w, h) * 0.03, true);
      break;
    }
    case "clothesDryer": {
      // 両端の台（足と横木、柱）と、端から端へ渡した2本の竿
      const foot = dryerFootWidth(w);
      for (const sx of [-1, 1]) {
        const x = sx * (hw - foot / 2);
        strokeRoundedRect(x - foot / 2, -hh, foot, h, 2, true);
        strokeRoundedRect(x - foot * 0.3, -h * 0.45, foot * 0.6, h * 0.9, 1);
        strokeCircle(x, 0, Math.min(foot, h) * 0.12);
      }
      for (const offset of DRYER_POLES) strokeRoundedRect(-hw + foot * 0.3, offset * h - 1.8, w - foot * 0.6, 3.6, 1.8);
      break;
    }
    case "swing": {
      // 真ん中の座面、両端のA字の脚（上から見ると1本の線）、座面の上を通る横木
      const inset = w * 0.05, seatW = w * 0.3, seatD = h * 0.22;
      strokeRoundedRect(-seatW / 2, -seatD / 2, seatW, seatD, 2, true);
      for (const sx of [-1, 1]) strokeRoundedRect(sx * (hw - inset) - 3.5, -h * 0.47, 7, h * 0.94, 3.5);
      ctx.fillStyle = "#dfe7ee";
      strokeRoundedRect(-hw + inset * 0.5, -4, w - inset, 8, 4, true);
      break;
    }
    case "trashCan": {
      // 丸い胴と少し内側のふた、奥のちょうつがい、手前のペダル
      const r = Math.min(hw, hh);
      strokeCircle(0, 0, r * 0.84, true);
      strokeCircle(0, 0, r * 0.8);
      ctx.fillStyle = String(ctx.strokeStyle);
      strokeRoundedRect(-r * 0.2, -r * 0.89, r * 0.4, r * 0.1, 1, true);
      strokeRoundedRect(-r * 0.16, r * 0.77, r * 0.32, r * 0.22, 1, true);
      break;
    }
    case "coatStand": {
      // 丸い台座、柱の頭の玉、6本のフックと先の玉
      const r = Math.min(hw, hh);
      strokeEllipse(0, 0, hw, hh, true);
      for (const a of COAT_HOOK_ANGLES) {
        const tx = Math.cos(a) * r * COAT_HOOK_REACH, ty = Math.sin(a) * r * COAT_HOOK_REACH;
        strokeLine(Math.cos(a) * r * 0.1, Math.sin(a) * r * 0.1, tx, ty);
        strokeCircle(tx, ty, r * 0.06, true);
      }
      ctx.fillStyle = "#e9dfd2";
      strokeCircle(0, 0, r * 0.14, true);
      break;
    }
    case "crib": {
      // 手すりの帯、四隅の柱の頭、マットレス、枕、掛け布団
      const rail = cribRail(w, h);
      ctx.fillStyle = "#f5eee2";
      strokeRoundedRect(-hw, -hh, w, h, 2, true);
      ctx.fillStyle = "#fbfaf6";
      ctx.beginPath();
      ctx.rect(-hw + rail, -hh + rail, w - rail * 2, h - rail * 2);
      ctx.fill();
      ctx.stroke();
      strokeRoundedRect(-w * 0.25, -h * 0.39, w * 0.5, h * 0.12, 3, true);
      ctx.fillStyle = "#edf3f2";
      strokeRoundedRect(-hw + rail + 1, -h * 0.055, w - rail * 2 - 2, h * 0.45, 2, true);
      ctx.fillStyle = "#f5eee2";
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) strokeCircle(sx * (hw - rail / 2), sy * (hh - rail / 2), rail * 0.55, true);
      break;
    }
    case "catTower": {
      // 床の台と、高さの違う板（低い板から順に重ねて描く。3Dと同じ位置・大きさ・丸と四角）
      strokeRoundedRect(-hw, -hh, w, h, 2, true);
      CAT_TOWER_DECKS.forEach((deck, i) => {
        ctx.fillStyle = i % 2 ? "#f3ebdd" : "#e9dfcd";
        const x = deck.x * w, y = deck.y * h;
        if (deck.round) strokeEllipse(x, y, (deck.w * w) / 2, (deck.h * h) / 2, true);
        else strokeRoundedRect(x - (deck.w * w) / 2, y - (deck.h * h) / 2, deck.w * w, deck.h * h, 2, true);
      });
      break;
    }
    case "zaisu": {
      // 後ろへ倒れた背もたれ（奥・塗り分け）と、床置きの座面（手前）
      const r = Math.min(w, h) * 0.12;
      ctx.fillStyle = SYMBOL_SHADE;
      strokeRoundedRect(-hw + w * 0.03, -hh, w * 0.94, h * 0.48, r, true);
      ctx.fillStyle = baseFill;
      strokeRoundedRect(-hw, -hh + h * 0.4, w, h * 0.6, r, true);
      break;
    }
    case "kotatsu": {
      // 床に広がる布団（縫い目は破線）と中央の天板
      ctx.fillStyle = "#f3e6de";
      strokeRoundedRect(-hw, -hh, w, h, Math.min(w, h) * 0.1, true);
      ctx.save();
      ctx.setLineDash([4, 3]);
      strokeRoundedRect(-w * 0.36, -h * 0.36, w * 0.72, h * 0.72, Math.min(w, h) * 0.05);
      ctx.restore();
      ctx.fillStyle = "#f7f5f0";
      strokeRoundedRect(-w * 0.32, -h * 0.32, w * 0.64, h * 0.64, 3, true);
      break;
    }
    case "longTable": {
      // 天板と、天板の下に隠れる両端の脚（破線）
      strokeRoundedRect(-hw, -hh, w, h, 3, true);
      ctx.save();
      ctx.setLineDash([4, 3]);
      for (const sign of [-1, 1]) strokeLine(sign * w * 0.41, -hh + h * 0.12, sign * w * 0.41, hh - h * 0.12);
      ctx.restore();
      break;
    }
    case "deskL": {
      // L字の天板と、右奥の袖の引き出し
      const arm = Math.min(w, h) * 0.43;
      traceLShape(w, h, arm);
      drawDrawerStack(hw - w * 0.26, hw, -hh, -hh + arm);
      break;
    }
    case "kitchen":
    case "kitchenIsland": {
      drawKitchenSymbol(w, h, kind === "kitchenIsland", false);
      break;
    }
    case "fridge": {
      // 前面の扉と取っ手。冷やすものと分かるよう中央に雪の結晶を描く
      strokeRoundedRect(-hw, -hh, w, h, 3, true);
      strokeLine(-hw + 3, hh - h * 0.16, hw - 3, hh - h * 0.16);
      strokeLine(-w * 0.14, hh - h * 0.08, w * 0.14, hh - h * 0.08);
      drawSnowflake(0, -h * 0.08, Math.min(w, h) * 0.27);
      break;
    }
    case "bed":
    case "bedSemiDouble":
    case "bedDouble": {
      drawBedFrame(w, h, kind === "bedDouble" ? 2 : 1);
      strokeLine(-hw, -hh + h * 0.24, hw, -hh + h * 0.24);
      strokeLine(hw - w * 0.3, -hh + h * 0.24, hw, -hh + h * 0.24 + h * 0.12);
      strokeLine(-w * 0.47, h * 0.38, w * 0.47, h * 0.38);
      break;
    }
    case "desk": {
      // 天板、右の袖の引き出し3段、奥のケーブル穴
      strokeRoundedRect(-hw, -hh, w, h, 3, true);
      drawDrawerStack(hw - w * 0.28, hw, -hh, hh);
      strokeCircle(-w * 0.3, -h * 0.32, Math.min(w, h) * 0.035);
      break;
    }
    case "shelf": {
      strokeRoundedRect(-hw, -hh, w, h, 2, true);
      strokeRoundedRect(-w * 0.43, -h * 0.38, w * 0.86, h * 0.8, 1);
      for (let i = 0; i < 6; i += 1) strokeRoundedRect(-w * 0.38 + i * w * 0.09, -h * 0.29, w * 0.07, h * 0.61, 1);
      break;
    }
    case "bath": {
      strokeEllipse(0, 0, hw, hh, true);
      strokeEllipse(0, 0, w * 0.42, h * 0.39);
      strokeCircle(-hw + w * 0.18, 0, 3);
      strokeLine(-w * 0.3, -h * 0.3, -w * 0.3, -h * 0.12);
      break;
    }
    case "toilet": {
      strokeRoundedRect(-hw + 1, -hh, w - 2, h * 0.26, 2, true);
      ctx.fillStyle = "#ffffff";
      strokeEllipse(0, h * 0.14, w * 0.42, h * 0.32, true);
      strokeEllipse(0, h * 0.14, w * 0.27, h * 0.21);
      strokeCircle(w * 0.15, -h * 0.37, Math.min(w, h) * 0.045);
      break;
    }
    case "washbasin": {
      strokeRoundedRect(-hw, -hh, w, h, 3, true);
      strokeEllipse(0, h * 0.06, w * 0.3, h * 0.28);
      strokeRoundedRect(-w * 0.07, -hh + 2, w * 0.14, 5, 2);
      strokeCircle(0, h * 0.06, Math.min(w, h) * 0.025);
      strokeLine(0, h * 0.4, 0, hh);
      break;
    }
    case "washer": {
      strokeRoundedRect(-hw, -hh, w, h, 4, true);
      const r = Math.min(hw, hh);
      strokeCircle(0, 1, r * 0.6);
      strokeCircle(0, 1, r * 0.3);
      strokeCircle(-hw + 6, -hh + 6, 2);
      strokeRoundedRect(-w * 0.42, -h * 0.45, w * 0.55, h * 0.11, 1);
      break;
    }
    case "closet": {
      // 壁の塗りと紛らわしい斜線はやめ、ハンガーパイプ（破線）に掛けた服と前面の折れ戸で表す
      strokeRoundedRect(-hw, -hh, w, h, 2, true);
      drawClosetRod(w, h);
      const doors = Math.max(2, Math.min(4, Math.round(w / 60)));
      ctx.beginPath();
      for (let i = 0; i < doors; i += 1) {
        const x0 = -hw + (w * i) / doors, x1 = x0 + w / doors;
        ctx.moveTo(x0, hh);
        ctx.lineTo(x0 + (x1 - x0) * 0.25, hh - h * 0.2);
        ctx.lineTo((x0 + x1) / 2, hh);
        ctx.lineTo(x1 - (x1 - x0) * 0.25, hh - h * 0.2);
        ctx.lineTo(x1, hh);
      }
      ctx.stroke();
      break;
    }
    case "wardrobe": {
      // 手前に引き出しの前板と、左右に並んだ取っ手
      strokeRoundedRect(-hw, -hh, w, h, 2, true);
      strokeLine(-hw, hh - h * 0.18, hw, hh - h * 0.18);
      strokeLine(0, hh - h * 0.18, 0, hh);
      for (const x of [-0.25, 0.25]) strokeRoundedRect(w * x - w * 0.08, hh - h * 0.12, w * 0.16, h * 0.06, 1);
      break;
    }
    case "cupboard": {
      // 手前のガラス戸（二重線）と、中に重ねたお皿
      strokeRoundedRect(-hw, -hh, w, h, 2, true);
      strokeLine(-hw + 2, hh - h * 0.14, hw - 2, hh - h * 0.14);
      strokeLine(-hw + 2, hh - h * 0.08, hw - 2, hh - h * 0.08);
      strokeLine(0, hh - h * 0.14, 0, hh);
      const plate = Math.min(w * 0.12, h * 0.28);
      for (const x of [-0.28, 0, 0.28]) {
        strokeCircle(w * x, -h * 0.1, plate);
        strokeCircle(w * x, -h * 0.1, plate * 0.55);
      }
      break;
    }
    case "shoeCabinet": {
      // 前面の扉と、中に並べた靴2足
      strokeRoundedRect(-hw, -hh, w, h, 2, true);
      strokeLine(-hw + 2, hh - h * 0.16, hw - 2, hh - h * 0.16);
      strokeLine(0, hh - h * 0.16, 0, hh);
      for (const x of [-0.24, 0.24]) {
        for (const side of [-1, 1]) drawShoe(w * x + side * w * 0.06, -h * 0.1, w * 0.05, h * 0.58, side * 0.14);
      }
      break;
    }
    case "airConditioner": {
      // 壁の高い位置にあるので破線で描き、手前に吹き出し口
      ctx.save();
      ctx.setLineDash([Math.max(3, w * 0.05), Math.max(2, w * 0.03)]);
      strokeRoundedRect(-hw, -hh, w, h, Math.min(w, h) * 0.3, true);
      ctx.restore();
      strokeLine(-w * 0.4, hh - h * 0.22, w * 0.4, hh - h * 0.22);
      // 吹き出し口の羽根
      for (let i = 0; i < 6; i += 1) {
        const x = -w * 0.35 + (w * 0.7 * i) / 5;
        strokeLine(x, hh - h * 0.22, x + w * 0.03, hh - h * 0.06);
      }
      break;
    }
    case "bunkBed": {
      // 四隅の柱、枕と掛け布団の境目、足元のはしご
      strokeRoundedRect(-hw, -hh, w, h, 3, true);
      strokeRoundedRect(-w * 0.28, -hh + h * 0.04, w * 0.56, h * 0.09, 3);
      strokeLine(-hw, -hh + h * 0.2, hw, -hh + h * 0.2);
      strokeRoundedRect(hw - w * 0.1, h * 0.2, w * 0.07, h * 0.24, 1);
      for (const t of [0.28, 0.36]) strokeLine(hw - w * 0.1, h * t, hw - w * 0.03, h * t);
      // 上段の柵（左の辺と、はしごより奥の右の辺）
      strokeRoundedRect(-hw + w * 0.02, -hh + h * 0.24, w * 0.05, h * 0.6, 1);
      strokeRoundedRect(hw - w * 0.07, -hh + h * 0.1, w * 0.05, h * 0.4, 1);
      ctx.fillStyle = String(ctx.strokeStyle);
      const post = Math.min(w, h) * 0.07;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) ctx.fillRect(sx < 0 ? -hw : hw - post, sy < 0 ? -hh : hh - post, post, post);
      break;
    }
    case "futon": {
      // 枠のない敷布団（角を大きく丸める）、枕、縫い目の入った掛け布団
      const r = Math.min(w, h) * 0.12;
      ctx.fillStyle = "#f8f7f2";
      strokeRoundedRect(-hw, -hh, w, h, r, true);
      strokeRoundedRect(-w * 0.26, -hh + h * 0.05, w * 0.52, h * 0.1, 5);
      ctx.fillStyle = "#edf3f2";
      strokeRoundedRect(-hw + w * 0.03, -hh + h * 0.27, w * 0.94, h * 0.7, r * 0.8, true);
      const stitch = Math.min(w, h) * 0.04;
      for (let row = 1; row <= 3; row += 1) for (const col of [-1, 0, 1]) {
        const x = col * w * 0.28, y = -hh + h * 0.27 + (h * 0.7 * row) / 4;
        strokeLine(x - stitch, y, x + stitch, y);
        strokeLine(x, y - stitch, x, y + stitch);
      }
      break;
    }
    case "stairs": {
      strokeRoundedRect(-hw, -hh, w, h, 1, true);
      if (h >= w) {
        for (let y = -hh + 24; y < hh - 4; y += 24) {
          strokeLine(-hw, y, hw, y);
        }
        strokeCircle(0, hh - 10, 3);
        strokeLine(0, hh - 10, 0, -hh + 14);
        strokeArrowHead(0, -hh + 14, -Math.PI / 2, 8);
      } else {
        for (let x = -hw + 24; x < hw - 4; x += 24) {
          strokeLine(x, -hh, x, hh);
        }
        strokeCircle(-hw + 10, 0, 3);
        strokeLine(-hw + 10, 0, hw - 14, 0);
        strokeArrowHead(hw - 14, 0, 0, 8);
      }
      break;
    }
    case "stairsU": {
      strokeRoundedRect(-hw, -hh, w, h, 1, true);
      const landing = h * 0.3;
      strokeLine(-hw, -hh, 0, -hh + landing);
      strokeLine(hw, -hh, 0, -hh + landing);
      strokeLine(0, -hh + landing, 0, hh);
      for (let y = -hh + landing + 20; y < hh - 4; y += 20) {
        strokeLine(-hw, y, 0, y);
        strokeLine(0, y, hw, y);
      }
      const ax = w * 0.25;
      const ay = -hh + landing + 8;
      strokeCircle(ax, hh - 9, 3);
      strokeLine(ax, hh - 9, ax, ay);
      ctx.beginPath();
      ctx.ellipse(0, ay, ax, Math.min(landing * 0.65, ax), 0, 0, Math.PI, true);
      ctx.stroke();
      strokeLine(-ax, ay, -ax, hh - 12);
      strokeArrowHead(-ax, hh - 12, Math.PI / 2, 8);
      break;
    }
    case "stairsSpiral": {
      const r = Math.min(hw, hh);
      ctx.save();
      ctx.scale(hw / r, hh / r);
      strokeCircle(0, 0, r, true);
      for (let i = 0; i < 12; i += 1) {
        const angle = (i / 12) * Math.PI * 2;
        strokeLine(0, 0, Math.cos(angle) * r, Math.sin(angle) * r);
      }
      ctx.fillStyle = String(ctx.strokeStyle);
      strokeCircle(0, 0, 2.5, true);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, Math.PI * 0.5, Math.PI * 1.75, false);
      ctx.stroke();
      const endAngle = Math.PI * 1.75;
      strokeArrowHead(Math.cos(endAngle) * r * 0.55, Math.sin(endAngle) * r * 0.55, endAngle + Math.PI / 2, 7);
      ctx.restore();
      break;
    }
    case "kitchenL": {
      // 奥の辺に流し台、左の辺にコンロ
      const depth = Math.min(w, h) * 0.36;
      traceLShape(w, h, depth);
      strokeRoundedRect(w * 0.08, -hh + depth * 0.2, w * 0.2, depth * 0.6, 4);
      strokeCircle(w * 0.18, -hh + depth * 0.12, 2.5);
      const bx = -hw + depth / 2, cy = depth / 2 + (h - depth) * 0.05, span = h - depth;
      strokeRoundedRect(bx - depth * 0.375, cy - span * 0.25, depth * 0.75, span * 0.5, 2);
      for (const t of [-0.12, 0.12]) strokeCircle(bx, cy + span * t, Math.min(depth * 0.17, span * 0.1));
      break;
    }
    case "unitBath": {
      // 二重線の外枠（一体成型）、奥の浴槽、洗い場の排水口
      strokeRoundedRect(-hw, -hh, w, h, 3, true);
      strokeRoundedRect(-hw + 3, -hh + 3, w - 6, h - 6, 2);
      const tubH = h * 0.45;
      strokeLine(-hw + 3, -hh + tubH, hw - 3, -hh + tubH);
      strokeRoundedRect(-w * 0.42, -hh + tubH * 0.16, w * 0.84, tubH * 0.66, Math.min(w, tubH) * 0.2);
      strokeCircle(w * 0.28, h * 0.3, Math.min(w, h) * 0.035);
      // 洗い場の風呂椅子と、右の壁のシャワー
      strokeRoundedRect(-w * 0.18 - w * 0.094, h * 0.24 - h * 0.069, w * 0.188, h * 0.138, 2);
      strokeCircle(hw - w * 0.1, h * 0.05, Math.min(w, h) * 0.04);
      strokeLine(hw - w * 0.06, h * 0.05, hw - 3, h * 0.05);
      break;
    }
    case "shower": {
      // 受け皿の対角線（中央の排水口へ傾斜）、手前と右のガラス、奥のシャワー
      strokeRoundedRect(-hw, -hh, w, h, 2, true);
      strokeLine(-hw, -hh, hw, hh);
      strokeLine(hw, -hh, -hw, hh);
      ctx.fillStyle = "#ffffff";
      strokeCircle(0, 0, Math.min(w, h) * 0.07, true);
      strokeLine(-hw, hh - 2.5, hw, hh - 2.5);
      strokeLine(hw - 2.5, -hh, hw - 2.5, hh);
      strokeCircle(-hw + w * 0.22, -hh + h * 0.22, Math.min(w, h) * 0.07, true);
      break;
    }
    case "fireplace": {
      // 本体、手前に開いた炉、炎
      strokeRoundedRect(-hw, -hh, w, h, 2, true);
      ctx.beginPath();
      ctx.moveTo(-w * 0.3, hh);
      ctx.lineTo(-w * 0.22, -hh + h * 0.2);
      ctx.lineTo(w * 0.22, -hh + h * 0.2);
      ctx.lineTo(w * 0.3, hh);
      ctx.stroke();
      for (const [x, size] of [[-0.09, 0.8], [0, 1], [0.09, 0.75]]) {
        const fx = w * x, fh = h * 0.45 * size, base = hh - h * 0.1, fw = w * 0.05 * size;
        ctx.beginPath();
        ctx.moveTo(fx - fw, base);
        ctx.quadraticCurveTo(fx - fw * 0.2, base - fh * 0.6, fx, base - fh);
        ctx.quadraticCurveTo(fx + fw * 0.2, base - fh * 0.6, fx + fw, base);
        ctx.closePath();
        ctx.stroke();
      }
      break;
    }
    case "bicycle":
    case "motorcycle": {
      // 上から見た二輪。前（上）にハンドル、細い車輪、サドルまたは車体
      const moto = kind === "motorcycle";
      const tire = Math.max(3, w * (moto ? 0.16 : 0.08));
      for (const cy of [-h * 0.31, h * 0.31]) strokeRoundedRect(-tire / 2, cy - h * 0.19, tire, h * 0.38, tire / 2, true);
      if (moto) {
        strokeRoundedRect(-w * 0.2, -h * 0.2, w * 0.4, h * 0.46, w * 0.15, true);
        strokeLine(-w * 0.15, h * 0.02, w * 0.15, h * 0.02);
      } else {
        strokeLine(0, -h * 0.25, 0, h * 0.3);
        strokeRoundedRect(-w * 0.1, h * 0.04, w * 0.2, h * 0.12, w * 0.08, true);
      }
      strokeLine(-w * 0.45, -h * 0.2, w * 0.45, -h * 0.2);
      for (const sign of [-1, 1]) strokeRoundedRect(sign * w * 0.45 - w * 0.05, -h * 0.215, w * 0.1, h * 0.03, 1);
      break;
    }
    case "car": {
      const cw = w;
      const chh = h;
      const cx = cw / 2;
      const cy = chh / 2;
      strokeRoundedRect(-cx, -cy, cw, chh, Math.min(cx, chh * 0.12), true);
      strokeRoundedRect(-cx + cw * 0.12, -chh * 0.1, cw * 0.76, chh * 0.42, 8);
      strokeLine(-cx + cw * 0.1, -cy + chh * 0.12, cx - cw * 0.1, -cy + chh * 0.12);
      strokeLine(-cx + cw * 0.03, -chh * 0.11, -cx, -chh * 0.14);
      strokeLine(cx - cw * 0.03, -chh * 0.11, cx, -chh * 0.14);
      strokeLine(-cw * 0.35, chh * 0.07, cw * 0.35, chh * 0.07);
      for (const sign of [-1, 1]) {
        strokeRoundedRect(sign * cw * 0.29 - cw * 0.09, -chh * 0.45, cw * 0.18, chh * 0.035, 2);
        strokeRoundedRect(sign * cw * 0.29 - cw * 0.09, chh * 0.42, cw * 0.18, chh * 0.035, 2);
      }
      break;
    }
    case "tree": {
      // こぶの連なる樹冠の輪郭と、中央の幹から伸びる枝
      ctx.fillStyle = OUTDOOR_LEAF;
      traceCanopy(w, h, 12, 0.86);
      ctx.fill();
      ctx.stroke();
      const r = Math.min(w, h) / 2;
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        strokeLine(0, 0, Math.cos(a) * w * 0.3, Math.sin(a) * h * 0.3);
        const bx = Math.cos(a) * w * 0.18, by = Math.sin(a) * h * 0.18;
        strokeLine(bx, by, bx + Math.cos(a + 0.7) * r * 0.14, by + Math.sin(a + 0.7) * r * 0.14);
      }
      ctx.fillStyle = OUTDOOR_TRUNK;
      strokeCircle(0, 0, r * 0.08, true);
      break;
    }
    case "conifer": {
      // とがった葉先が並ぶ星形の輪郭を二重にし、中央に幹
      ctx.fillStyle = OUTDOOR_LEAF;
      CONIFER_TIERS.forEach((tier, i) => {
        traceStar(hw * tier.radius, hh * tier.radius, tier.points, tier.inner);
        if (i === 0) ctx.fill();
        ctx.stroke();
      });
      ctx.fillStyle = OUTDOOR_TRUNK;
      strokeCircle(0, 0, Math.min(w, h) * 0.05, true);
      break;
    }
    case "palmTree": {
      // 幹の先から放射状に広がる、切れ込みのある大きな葉
      const m = Math.max(w, h), r = m / 2;
      ctx.save();
      ctx.scale(w / m, h / m);
      ctx.fillStyle = OUTDOOR_LEAF;
      for (const angle of PALM_FROND_ANGLES) {
        ctx.save();
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(r * 0.08, 0);
        ctx.bezierCurveTo(r * 0.35, -r * 0.2, r * 0.8, -r * 0.15, r * 0.98, r * 0.03);
        ctx.bezierCurveTo(r * 0.75, r * 0.03, r * 0.35, r * 0.14, r * 0.08, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.1, 0);
        ctx.quadraticCurveTo(r * 0.55, -r * 0.07, r * 0.96, r * 0.03);
        ctx.stroke();
        for (let t = 0.32; t < 0.9; t += 0.14) strokeLine(r * t, -r * 0.035, r * (t + 0.05), -r * 0.12 * (1.05 - t * 0.6));
        ctx.restore();
      }
      ctx.fillStyle = OUTDOOR_TRUNK;
      strokeCircle(0, 0, r * 0.1, true);
      ctx.restore();
      break;
    }
    case "shrub": {
      // 細かいこぶの輪郭と、内側のもう一回り小さなこぶ
      ctx.fillStyle = OUTDOOR_LEAF;
      traceCanopy(w, h, Math.max(9, Math.round((w + h) / 18)), 0.88);
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.scale(0.55, 0.55);
      traceCanopy(w, h, 7, 0.84);
      ctx.restore();
      ctx.stroke();
      break;
    }
    case "rock": {
      drawRocks(rockShapes(w, h));
      break;
    }
    case "steppingStones": {
      // 歩く向きに並んだ平たい石。左右に少しずらす（3Dと同じ配置）
      ctx.fillStyle = OUTDOOR_STONE;
      for (const stone of steppingStoneLayout(w, h)) {
        ctx.save();
        ctx.translate(stone.x, stone.y);
        ctx.rotate(stone.angle);
        strokeEllipse(0, 0, stone.rx, stone.ry, true);
        ctx.restore();
      }
      break;
    }
    case "flowerBed": {
      // 縁で囲んだ土と、上から見た5枚の花びらの花
      ctx.fillStyle = OUTDOOR_SOIL;
      strokeRoundedRect(-hw, -hh, w, h, 2, true);
      const bed = flowerBedLayout(w, h);
      strokeRoundedRect(-bed.innerW / 2, -bed.innerH / 2, bed.innerW, bed.innerH, 1);
      for (const [x, y] of bed.flowers) drawFlower(x, y, bed.size / 2);
      break;
    }
    case "pond": {
      // 自然な形の水面、さざ波、ふちに並べた石（3Dと同じ輪郭と石の位置）
      const pond = pondShape(w, h);
      const points = pond.points;
      ctx.fillStyle = OUTDOOR_WATER;
      ctx.beginPath();
      const last = points[points.length - 1];
      ctx.moveTo((last[0] + points[0][0]) / 2, (last[1] + points[0][1]) / 2);
      points.forEach((point, i) => {
        const next = points[(i + 1) % points.length];
        ctx.quadraticCurveTo(point[0], point[1], (point[0] + next[0]) / 2, (point[1] + next[1]) / 2);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      for (const ripple of pond.ripples) {
        ctx.beginPath();
        ctx.ellipse(ripple.x, ripple.y, ripple.rx, ripple.ry, 0, RIPPLE_START, RIPPLE_END);
        ctx.stroke();
      }
      ctx.fillStyle = OUTDOOR_STONE;
      for (const stone of pond.stones) strokeEllipse(stone.x, stone.y, stone.rx, stone.ry, true);
      break;
    }
    case "fence": {
      // 細長い横木と、一定の間隔の支柱（塗りつぶし）
      const along = w >= h;
      const length = along ? w : h, span = along ? h : w;
      ctx.save();
      if (!along) ctx.rotate(Math.PI / 2);
      const rail = Math.max(2, span * 0.35);
      strokeRoundedRect(-length / 2, -rail / 2, length, rail, 1, true);
      const posts = Math.max(2, Math.round(length / 90) + 1);
      const post = Math.min(span * 0.9, 10);
      ctx.fillStyle = String(ctx.strokeStyle);
      for (let i = 0; i < posts; i += 1) {
        const x = -length / 2 + post / 2 + ((length - post) * i) / (posts - 1);
        ctx.fillRect(x - post / 2, -post / 2, post, post);
      }
      ctx.restore();
      break;
    }
    case "gardenLight": {
      // 上から見た白い受け皿、光る玉、受け皿から外へ伸びる8本の飾りの腕（3Dと同じ）
      const r = Math.min(hw, hh);
      strokeCircle(0, 0, r * 0.62, true);
      ctx.fillStyle = "#fff3c4";
      strokeCircle(0, 0, r * 0.34, true);
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        strokeLine(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, Math.cos(a) * r * 0.97, Math.sin(a) * r * 0.97);
      }
      break;
    }
    case "stoneLantern": {
      // 六角形の笠と、頂上の宝珠へ集まる稜線
      ctx.fillStyle = OUTDOOR_STONE;
      tracePolygon(hw, hh, 6, 1);
      ctx.fill();
      ctx.stroke();
      tracePolygon(hw, hh, 6, 0.62);
      ctx.stroke();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        strokeLine(Math.cos(a) * hw * 0.2, Math.sin(a) * hh * 0.2, Math.cos(a) * hw, Math.sin(a) * hh);
      }
      ctx.fillStyle = "#ffffff";
      strokeCircle(0, 0, Math.min(w, h) * 0.12, true);
      break;
    }
    case "mailbox": {
      // 箱と、中に封筒の形（投函口の代わりの目印）
      strokeRoundedRect(-hw, -hh, w, h, 3, true);
      const ew = w * 0.58, eh = h * 0.5;
      strokeRoundedRect(-ew / 2, -eh / 2, ew, eh, 1);
      ctx.beginPath();
      ctx.moveTo(-ew / 2, -eh / 2);
      ctx.lineTo(0, eh * 0.1);
      ctx.lineTo(ew / 2, -eh / 2);
      ctx.stroke();
      break;
    }
    case "shed": {
      // 金属の波板屋根の筋と、手前の軒
      ctx.fillStyle = "#eef0ee";
      strokeRoundedRect(-hw, -hh, w, h, 2, true);
      const eave = hh - h * 0.12;
      const ribs = Math.max(3, Math.round(w / 18));
      for (let i = 1; i < ribs; i += 1) strokeLine(-hw + (w * i) / ribs, -hh + 2, -hw + (w * i) / ribs, eave);
      strokeLine(-hw, eave, hw, eave);
      break;
    }
    case "dogHouse": {
      // 切妻屋根の棟と、片側の屋根面の塗り、手前の出入口
      ctx.fillStyle = "#f3e7da";
      strokeRoundedRect(-hw, -hh, w, h, 2, true);
      ctx.fillStyle = SYMBOL_SHADE;
      ctx.beginPath();
      ctx.rect(0, -hh, hw, h);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = String(ctx.strokeStyle);
      ctx.beginPath();
      ctx.arc(0, hh, Math.min(w * 0.16, h * 0.2), Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "evidenceMarker":
      drawEvidenceMarker(w, h, 0);
      break;
    case "footprints":
      drawFootprints(w, h, false, item);
      break;
    case "fallenPerson":
    case "person":
      drawPersonSymbol(w, h, item, kind, 0);
      break;
    case "paint":
      drawPaint(w, h, item);
      break;
    case "bloodPool":
      drawBlood(w, h, 0);
      break;
    case "brokenGlass":
      drawBrokenGlass(w, h, item);
      break;
    default: {
      strokeRoundedRect(-hw, -hh, w, h, 4, true);
    }
  }
}

// ---- 事件・調査の印（形は furniture-shapes.ts の共通のデータ。3Dを真上から見た形と同じ） ----

// 家具の記号の塗り。床に付いた跡は2Dの色で塗る
function furnitureFill(item: Furniture): string {
  return MARK_FILLS[item.kind] ? solidColor(item.color) ?? furnitureSymbolFill(item.kind) : furnitureSymbolFill(item.kind);
}

function traceLoop(points: Point2[]): void {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// 隣り合う点の中点を通る2次曲線でつないだ、なめらかな輪郭（3Dの形と同じつなぎ方）
function traceSmoothLoop(points: Point2[]): void {
  const at = (i: number) => points[(i + points.length) % points.length];
  const mid = (i: number): Point2 => [(at(i)[0] + at(i + 1)[0]) / 2, (at(i)[1] + at(i + 1)[1]) / 2];
  const start = mid(-1);
  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  points.forEach((point, i) => {
    const end = mid(i);
    ctx.quadraticCurveTo(point[0], point[1], end[0], end[1]);
  });
  ctx.closePath();
}

function fillPiece(piece: StoneSlab): void {
  ctx.beginPath();
  ctx.ellipse(piece.x, piece.y, piece.rx, piece.ry, piece.angle, 0, Math.PI * 2);
  ctx.fill();
}

function drawEvidenceMarker(w: number, h: number, variant: number): void {
  const shape = evidenceMarkerShape(w, h, variant);
  traceLoop(shape.outer);
  ctx.fill();
  ctx.stroke();
  traceLoop(shape.inner);
  ctx.stroke();
}

// 番号の印の番号。印を反転しても、文字は裏返さない
function drawMarkerLabel(item: Furniture): void {
  const text = item.markerLabel ?? "";
  if (!text) return;
  const shape = evidenceMarkerShape(item.w, item.h, item.symbol ?? 0);
  ctx.save();
  if (item.flip) ctx.scale(-1, 1);
  ctx.fillStyle = String(ctx.strokeStyle);
  ctx.font = `700 ${markerTextSize(shape, text)}px ${TEXT_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, shape.label.x, shape.label.y);
  ctx.restore();
}

function drawFootprints(w: number, h: number, bare: boolean, item?: Furniture): void {
  footprintPieces(w, h, bare, item?.path, item?.stride).forEach(fillPiece);
}

function drawBlood(w: number, h: number, variant: number): void {
  const shape = bloodShape(w, h, variant);
  for (const blob of shape.blobs) {
    traceSmoothLoop(blob);
    ctx.fill();
  }
  shape.drops.forEach(fillPiece);
}

// 人: 体の部品を真上から見た形。高さの近い部品（寝た人ならぜんぶ）は同じ色で塗ってひとまとまりにし、外側の輪郭だけを線で描く。
// 立った人の頭や肩のように高い所は、低い所の上に重ねて輪郭を描く（3Dを真上から見たときの重なりと同じ）
function drawPersonSymbol(w: number, h: number, item: Furniture | undefined, kind: FurnitureKind, symbol: number): void {
  // デザインの見本では、倒れた人の形は前からある形のまま見せる（選ぶとその形に戻る）
  const pose = symbolPreview && kind === "fallenPerson" && symbol !== 2 ? undefined : item?.pose;
  const design = personDesign(kind, symbol, pose);
  const layout = personLayout(w, h, design.pose, design.legacy);
  if (design.chalk) {
    // 人の形の外側をなぞったチョークの線（3Dでは床の白い線）
    ctx.save();
    ctx.lineWidth = Math.max(ctx.lineWidth, CHALK_WIDTH);
    traceLoop(personOutline(layout));
    ctx.stroke();
    ctx.restore();
    return;
  }
  const lineWidth = ctx.lineWidth;
  for (const layer of layout.layers) {
    // 線を太めに描いてから中を塗ると、まとまりの外側の輪郭だけが残る
    ctx.save();
    ctx.lineWidth = lineWidth * 2;
    for (const index of layer) {
      traceLoop(layout.outlines[index]);
      ctx.stroke();
    }
    ctx.restore();
    for (const index of layer) {
      traceLoop(layout.outlines[index]);
      ctx.fill();
    }
  }
}

// ---- 人の模型（手足を動かす・立たせる） ----

function isPersonKind(kind: FurnitureKind): boolean {
  return kind === "fallenPerson" || kind === "person";
}

function isPerson(entity: Entity | null | undefined): entity is Furniture {
  return entity?.type === "furniture" && isPersonKind(entity.kind);
}

// 2Dの記号と3Dで同じ置き方
function personLayoutOf(item: Furniture): PersonLayout {
  const design = personDesign(item.kind, item.symbol ?? 0, item.pose);
  return personLayout(item.w, item.h, design.pose, design.legacy);
}

// 家具の中の点（中心が原点、回転・反転の前）と、間取りの点を行き来する
function furnitureLocalToWorld(item: Furniture, [x, y]: Point2): Point {
  const lx = item.flip ? -x : x;
  const angle = degreesToRadians(item.rotation);
  return {
    x: item.x + item.w / 2 + lx * Math.cos(angle) - y * Math.sin(angle),
    y: item.y + item.h / 2 + lx * Math.sin(angle) + y * Math.cos(angle),
  };
}

function worldToFurnitureLocal(item: Furniture, point: Point): Point2 {
  const angle = degreesToRadians(-item.rotation);
  const dx = point.x - item.x - item.w / 2, dy = point.y - item.y - item.h / 2;
  const x = dx * Math.cos(angle) - dy * Math.sin(angle), y = dx * Math.sin(angle) + dy * Math.cos(angle);
  return [item.flip ? -x : x, y];
}

const roundTenth = (value: number) => Math.round(value * 10) / 10;

// 人の姿勢を変える。範囲（幅・奥行）を新しい形にぴったり合わせ、腰の位置は動かさない。scale は実物大に対する大きさ
function setPersonPose(item: Furniture, pose: PersonPose, scale = personLayoutOf(item).scale): void {
  const pelvis = furnitureLocalToWorld(item, personLayoutOf(item).pelvis);
  const size = personRefSize(pose);
  item.pose = pose;
  item.w = Math.max(1, roundTenth(size.w * scale));
  item.h = Math.max(1, roundTenth(size.h * scale));
  const local = personLayoutOf(item).pelvis;
  const offset = furnitureLocalToWorld({ ...item, x: -item.w / 2, y: -item.h / 2 }, local);
  item.x = roundTenth(pelvis.x - offset.x - item.w / 2);
  item.y = roundTenth(pelvis.y - offset.y - item.h / 2);
}

function editingPose(item: Furniture): PersonPose {
  return editablePersonPose(item.kind, item.symbol ?? 0, item.pose);
}

// 体のつまみ（0〜3 手首・足首、4〜7 ひじ・ひざ、8 頭）。pointer の近くにあればその番号（いちばん近いもの）
function personHandleAt(item: Furniture, point: Point): number {
  let best = -1, bestDistance = 9 / view.zoom;
  personLayoutOf(item).handles.forEach((handle, index) => {
    const at = furnitureLocalToWorld(item, handle);
    const distance = Math.hypot(at.x - point.x, at.y - point.y);
    if (distance <= bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

// 手首・足首は白い丸、ひじ・ひざは小さな水色の丸、頭は中に点のある丸
function drawPersonHandles(item: Furniture): void {
  ctx.save();
  ctx.strokeStyle = "#2775d1";
  ctx.lineWidth = 2 / view.zoom;
  personLayoutOf(item).handles.forEach((handle, index) => {
    const at = furnitureLocalToWorld(item, handle);
    const middle = index >= 4 && index < 8;
    ctx.fillStyle = middle ? "#d6e7fb" : "#ffffff";
    ctx.beginPath();
    ctx.arc(at.x, at.y, (middle ? 4 : index === 8 ? 6 : 5) / view.zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (index === 8) {
      ctx.fillStyle = "#2775d1";
      ctx.beginPath();
      ctx.arc(at.x, at.y, 1.8 / view.zoom, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.restore();
}

// 体のつまみをつかんだとき。前からある形のままなら、近いポーズの見本に置き換えてから、いちばん近いつまみを動かす
function beginPersonPose(item: Furniture, handle: number, point: Point): number {
  if (item.pose || item.kind === "person") return handle;
  setPersonPose(item, editingPose(item));
  const picked = personHandleAt(item, point);
  return picked >= 0 ? picked : handle;
}

function movePersonLimb(item: Furniture, handle: number, point: Point): void {
  const layout = personLayoutOf(item);
  const local = worldToFurnitureLocal(item, point);
  const target: Point2 = [local[0] / layout.scale + layout.center[0], local[1] / layout.scale + layout.center[1]];
  setPersonPose(item, reachHandle(editingPose(item), handle, target), layout.scale);
}

// 関節の角度のスライダー。名前・いちばん小さい角度・いちばん大きい角度
const TRUNK_SLIDERS: Record<"waist" | "neck", [string, number, number][]> = {
  waist: [["前へ倒す", -90, 120], ["横へ倒す", -90, 90], ["ねじる", -120, 120]],
  neck: [["うなずく", -70, 90], ["かしげる", -60, 60], ["振り向く", -100, 100]],
};

function limbSliders(arm: boolean): [string, number, number][] {
  return [["開く", -180, 180], ["前後", -180, 180], [arm ? "ひじを曲げる" : "ひざを曲げる", 0, 180], ["曲げる向き", -180, 180], [arm ? "手首" : "足首", -90, 90]];
}

function jointSliderHtml(part: string, label: string, sliders: [string, number, number][], angles: number[], disabled: string): string {
  return `<fieldset class="pose-limb" data-part="${part}">
      <legend>${label}</legend>
      ${sliders.map(([name, min, max], index) => `<label><span>${name}</span><input type="range" min="${min}" max="${max}" step="1" value="${Math.round(angles[index])}" data-angle="${index}" aria-label="${label}を${name}" ${disabled} /><output>${Math.round(angles[index])}°</output></label>`).join("")}
    </fieldset>`;
}

function personEditorHtml(item: Furniture, disabled: string): string {
  const pose = editingPose(item);
  const height = Math.round(PERSON_HEIGHT * personLayoutOf(item).scale);
  const postures: [Posture, string][] = [["stand", "立っている"], ["prone", "うつぶせ"], ["supine", "あおむけ"]];
  return `
    <div class="two-col">
      <label>姿勢<select id="personPostureInput" ${disabled}>${postures.map(([value, label]) => `<option value="${value}" ${value === pose.posture ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      <label>身長 cm<input id="personHeightInput" type="number" min="10" max="1000" step="1" value="${height}" ${disabled} /></label>
    </div>
    <div class="pose-presets">
      <span>ポーズの見本</span>
      <div>${PERSON_PRESETS.map((preset) => `<button type="button" class="prop-button" data-pose-preset="${preset.id}" ${disabled}>${preset.label}</button>`).join("")}</div>
    </div>
    <p class="pose-hint">2Dで選ぶと、手首・足首（白）、ひじ・ひざ（水色）、頭に丸いつまみが出ます。ドラッグするとその所が動きます（頭は腰から曲がります）。</p>
    <details class="pose-limbs" open>
      <summary>関節の角度</summary>
      ${jointSliderHtml("waist", "胴（腰）", TRUNK_SLIDERS.waist, pose.waist, disabled)}
      ${jointSliderHtml("neck", "首", TRUNK_SLIDERS.neck, pose.neck, disabled)}
      ${jointSliderHtml("arm0", "左腕", limbSliders(true), pose.arms[0], disabled)}
      ${jointSliderHtml("arm1", "右腕", limbSliders(true), pose.arms[1], disabled)}
      ${jointSliderHtml("leg0", "左脚", limbSliders(false), pose.legs[0], disabled)}
      ${jointSliderHtml("leg1", "右脚", limbSliders(false), pose.legs[1], disabled)}
    </details>`;
}

function bindPersonEditor(item: Furniture): void {
  bindNumber("#personHeightInput", (value) => setPersonPose(item, editingPose(item), clamp(value, 10, 1000) / PERSON_HEIGHT));
  bindSelect("#personPostureInput", (value) => {
    if (!POSTURES.includes(value as Posture)) return;
    const pose = editingPose(item);
    // 寝ている姿勢どうし（うつぶせ・あおむけ）は手足の角度をそのままに、立つ・寝るを変えたときはその姿勢の見本から始める
    const lying = (posture: Posture) => posture !== "stand";
    setPersonPose(item, lying(pose.posture) && lying(value as Posture) ? { ...pose, posture: value as Posture } : presetPose(value));
  });
  propertiesPanel.querySelectorAll<HTMLButtonElement>("[data-pose-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      setPersonPose(item, presetPose(button.dataset.posePreset ?? "stand"));
      commitState();
      redrawAll();
    });
  });
  propertiesPanel.querySelectorAll<HTMLFieldSetElement>(".pose-limb").forEach((fieldset) => {
    const part = fieldset.dataset.part ?? "";
    const inputs = [...fieldset.querySelectorAll<HTMLInputElement>("input[data-angle]")];
    const apply = () => {
      const pose = editingPose(item);
      const angles = inputs.map((input) => Number(input.value));
      if (part === "waist") pose.waist = angles as TrunkAngles;
      else if (part === "neck") pose.neck = angles as TrunkAngles;
      else (part.startsWith("leg") ? pose.legs : pose.arms)[Number(part.slice(3))] = angles as LimbAngles;
      setPersonPose(item, pose);
    };
    inputs.forEach((input) => {
      // 動かしている間は2Dと3Dだけを描き直し、離したときに履歴に積む
      input.addEventListener("input", () => {
        apply();
        const output = input.parentElement?.querySelector("output");
        if (output) output.textContent = `${input.value}°`;
        render2d();
        scheduleThreeRefresh();
      });
      input.addEventListener("change", () => {
        apply();
        commitState();
        redrawAll();
      });
    });
  });
}

// ---- ペンで描く線・塗り ----

function normalizePaintPath(value: unknown): number[][] | undefined {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4000) return undefined;
  const ok = value.every((point) => Array.isArray(point) && point.length === 2 && point.every((part) => typeof part === "number" && Number.isFinite(part) && Math.abs(part) <= 1));
  return ok ? value.map(([u, v]: number[]) => [Math.round(u * 10000) / 10000, Math.round(v * 10000) / 10000]) : undefined;
}

// ペンの線の点（家具の中心が原点の cm）。道すじがなければ真ん中の点
function paintPoints(w: number, h: number, item?: Furniture): Point2[] {
  return item?.path?.length ? item.path.map(([u, v]): Point2 => [u * w, v * h]) : [[0, 0]];
}

// ペンの線・塗りを描く。3Dの床に貼る画像も、この描き方で白く描いて色を付ける
function drawPaint(w: number, h: number, item?: Furniture, color?: string): void {
  const points = paintPoints(w, h, item);
  const brush = item?.brush ?? DEFAULT_BRUSH;
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = color ?? solidColor(item?.color) ?? PEN_DEFAULT_COLOR;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (item?.filled && points.length >= 3) {
    traceLoop(points);
    ctx.fill();
  } else if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0][0], points[0][1], brush / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.lineWidth = brush;
    traceOpenPath(points);
    ctx.stroke();
  }
  ctx.restore();
}

// 描いた線の上か、塗った所の中か
function isPointOnPaint(item: Furniture, point: Point): boolean {
  const [x, y] = worldToFurnitureLocal(item, point);
  const points = paintPoints(item.w, item.h, item);
  const reach = (item.filled ? 0 : (item.brush ?? DEFAULT_BRUSH) / 2) + 4 / view.zoom;
  if (item.filled && points.length >= 3) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i], [xj, yj] = points[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return true;
  }
  if (points.length === 1) return Math.hypot(x - points[0][0], y - points[0][1]) <= reach;
  for (let i = 1; i < points.length; i += 1) {
    if (distanceToSegment({ x, y }, { x: points[i - 1][0], y: points[i - 1][1] }, { x: points[i][0], y: points[i][1] }) <= reach) return true;
  }
  return item.filled === true && points.length >= 3 && distanceToSegment({ x, y }, { x: points[points.length - 1][0], y: points[points.length - 1][1] }, { x: points[0][0], y: points[0][1] }) <= reach;
}

// 描いた点（間取りの cm）から、範囲と道すじを決める。線の太さの分だけ範囲を広げる
function paintFrame(path: Point2[], brush: number, filled: boolean): { x: number; y: number; w: number; h: number; path: number[][] } {
  const margin = filled ? 1 : brush / 2 + 1;
  const xs = path.map((point) => point[0]), ys = path.map((point) => point[1]);
  const w = roundTenth(Math.max(2, Math.max(...xs) - Math.min(...xs) + margin * 2));
  const h = roundTenth(Math.max(2, Math.max(...ys) - Math.min(...ys) + margin * 2));
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  return {
    x: roundTenth(cx - w / 2), y: roundTenth(cy - h / 2), w, h,
    path: path.map(([x, y]) => [Math.round(((x - cx) / w) * 10000) / 10000, Math.round(((y - cy) / h) * 10000) / 10000]),
  };
}

// 線の手ぶれを少しだけならす（細かい形は残す）
function tidyPaintPath(points: Point[]): Point2[] {
  const spaced: Point2[] = [];
  for (const point of points) {
    const last = spaced[spaced.length - 1];
    if (!last || Math.hypot(point.x - last[0], point.y - last[1]) >= 1) spaced.push([point.x, point.y]);
  }
  if (spaced.length < 3) return spaced;
  const smooth = spaced.map((point, index): Point2 => {
    if (index === 0 || index === spaced.length - 1) return point;
    const [ax, ay] = spaced[index - 1], [bx, by] = spaced[index + 1];
    return [(ax + point[0] * 2 + bx) / 4, (ay + point[1] * 2 + by) / 4];
  });
  return simplifyPath(smooth, 0.5);
}

function placePaintStroke(points: Point[]): void {
  const path = tidyPaintPath(points);
  if (!path.length) return;
  const brush = penSettings.brush;
  const filled = penSettings.filled && path.length >= 3 && pathLength(path) > brush;
  const frame = paintFrame(path.length === 2 && pathLength(path) < 1 ? [path[0]] : path, brush, filled);
  const item: Furniture = {
    id: newId("furniture"), type: "furniture", kind: "paint", rotation: 0, color: penSettings.color, brush, ...(filled ? { filled: true } : {}), ...frame,
  };
  activeEntities().push(item);
}

// 太さや描き方を変えたとき、線が収まるように範囲を合わせ直す（線の場所はそのまま）
function refitPaint(item: Furniture): void {
  const points = paintPoints(item.w, item.h, item);
  const frame = paintFrame(points, item.brush ?? DEFAULT_BRUSH, item.filled === true);
  const center = furnitureLocalToWorld(item, [frame.x + frame.w / 2, frame.y + frame.h / 2]);
  item.w = frame.w;
  item.h = frame.h;
  item.path = frame.path;
  item.x = roundTenth(center.x - frame.w / 2);
  item.y = roundTenth(center.y - frame.h / 2);
}

// なぞっている間の見本: いまのペンの色・太さで描く
function drawPaintPreview(points: Point[]): void {
  const path = tidyPaintPath(points);
  if (!path.length) return;
  const parsed = parseColorCode(penSettings.color);
  const filled = penSettings.filled && path.length >= 3;
  ctx.save();
  ctx.globalAlpha = parsed?.alpha ?? 1;
  ctx.translate(0, 0);
  drawPaint(1, 1, { id: "preview", type: "furniture", kind: "paint", x: 0, y: 0, w: 1, h: 1, rotation: 0, brush: penSettings.brush, filled, path: path.map(([x, y]) => [x, y]) }, parsed?.rgb ?? PEN_DEFAULT_COLOR);
  ctx.restore();
}

// 3Dの床に貼る画像。2Dと同じ描き方で白く描き、色は材質で付ける（透明度も材質で）
function applyPaintTexture(group: THREE.Group, item: Furniture): void {
  let decal: THREE.Mesh | undefined;
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    // 3Dでは選ばない（範囲の透明な所でも、下の床や家具を選べるように）
    mesh.raycast = () => {};
    if ((mesh.material as THREE.Material).name === "paint-decal") decal = mesh;
  });
  if (!decal) return;
  const pixelsPerCm = Math.min(2, 1024 / Math.max(item.w, item.h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.ceil(item.w * pixelsPerCm));
  canvas.height = Math.max(2, Math.ceil(item.h * pixelsPerCm));
  const context = canvas.getContext("2d");
  if (!context) return;
  const planContext = ctx;
  ctx = context;
  try {
    ctx.setTransform(canvas.width / item.w, 0, 0, canvas.height / item.h, canvas.width / 2, canvas.height / 2);
    drawPaint(item.w, item.h, item, "#ffffff");
  } finally {
    ctx = planContext;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = decal.material as THREE.MeshStandardMaterial;
  material.map = texture;
  material.needsUpdate = true;
}

function penControlsHtml(prefix: string, color: string, brush: number, filled: boolean, disabled = ""): string {
  const current = parseColorCode(color)?.rgb;
  return `
    ${colorField(`${prefix}ColorInput`, "色", color, disabled)}
    <div class="pen-colors" role="group" aria-label="よく使う色">${PEN_COLORS.map(([value, label]) => `<button type="button" class="pen-color${current === value ? " is-active" : ""}" data-pen-color="${value}" title="${label}" aria-label="${label}" style="--pen-color: ${value}" ${disabled}></button>`).join("")}</div>
    <label>太さ cm
      <span class="pen-width">
        <input id="${prefix}WidthRange" type="range" min="1" max="100" step="1" value="${Math.min(100, brush)}" aria-label="太さ" ${disabled} />
        <input id="${prefix}WidthInput" type="number" min="1" max="${MAX_BRUSH}" step="1" value="${brush}" ${disabled} />
      </span>
    </label>
    <div class="segmented pen-mode" role="radiogroup" aria-label="描き方">
      <button type="button" data-pen-mode="line" class="${filled ? "" : "is-active"}" aria-checked="${!filled}" role="radio" ${disabled}>線で描く</button>
      <button type="button" data-pen-mode="fill" class="${filled ? "is-active" : ""}" aria-checked="${filled}" role="radio" ${disabled}>囲んで塗る</button>
    </div>`;
}

// ペンの設定（まだ描いていない線の色・太さ）。履歴には積まない
function bindPenControls(): void {
  const panel = propertiesPanel;
  const picker = panel.querySelector<HTMLInputElement>("#penColorInput");
  const code = panel.querySelector<HTMLInputElement>("#penColorInputCode");
  const remember = () => {
    scheduleViewStateSave();
    updatePropertiesPanel();
  };
  picker?.addEventListener("change", () => {
    penSettings.color = withAlpha(picker.value, colorAlpha(penSettings.color));
    remember();
  });
  code?.addEventListener("change", () => {
    const parsed = parseColorCode(code.value.trim());
    if (code.value.trim() && !parsed) {
      code.classList.add("is-invalid");
      return;
    }
    penSettings.color = parsed?.code ?? PEN_DEFAULT_COLOR;
    remember();
  });
  panel.querySelectorAll<HTMLButtonElement>("[data-pen-color]").forEach((button) => button.addEventListener("click", () => {
    penSettings.color = withAlpha(button.dataset.penColor ?? PEN_DEFAULT_COLOR, colorAlpha(penSettings.color));
    remember();
  }));
  const range = panel.querySelector<HTMLInputElement>("#penWidthRange"), number = panel.querySelector<HTMLInputElement>("#penWidthInput");
  range?.addEventListener("input", () => {
    penSettings.brush = clamp(Math.round(Number(range.value)), 1, MAX_BRUSH);
    if (number) number.value = String(penSettings.brush);
    scheduleViewStateSave();
  });
  number?.addEventListener("change", () => {
    if (!Number.isFinite(Number(number.value))) return;
    penSettings.brush = clamp(Math.round(Number(number.value)), 1, MAX_BRUSH);
    remember();
  });
  panel.querySelectorAll<HTMLButtonElement>("[data-pen-mode]").forEach((button) => button.addEventListener("click", () => {
    penSettings.filled = button.dataset.penMode === "fill";
    remember();
  }));
}

// 選んだ線の色・太さ・描き方を変える（履歴に積む）
function bindPaintControls(item: Furniture): void {
  const panel = propertiesPanel;
  bindColor("#paintColorInput", (value) => {
    item.color = value ?? PEN_DEFAULT_COLOR;
    delete item.color3d;
  });
  panel.querySelectorAll<HTMLButtonElement>("[data-pen-color]").forEach((button) => button.addEventListener("click", () => {
    item.color = withAlpha(button.dataset.penColor ?? PEN_DEFAULT_COLOR, colorAlpha(item.color));
    delete item.color3d;
    commitState();
    redrawAll();
  }));
  const range = panel.querySelector<HTMLInputElement>("#paintWidthRange"), number = panel.querySelector<HTMLInputElement>("#paintWidthInput");
  const setBrush = (value: number) => {
    item.brush = clamp(Math.round(value), 1, MAX_BRUSH);
    refitPaint(item);
  };
  range?.addEventListener("input", () => {
    setBrush(Number(range.value));
    if (number) number.value = String(item.brush);
    render2d();
    scheduleThreeRefresh();
  });
  range?.addEventListener("change", () => {
    setBrush(Number(range.value));
    commitState();
    redrawAll();
  });
  bindNumber("#paintWidthInput", (value) => setBrush(value));
  panel.querySelectorAll<HTMLButtonElement>("[data-pen-mode]").forEach((button) => button.addEventListener("click", () => {
    const filled = button.dataset.penMode === "fill";
    if (filled === (item.filled === true)) return;
    if (filled) item.filled = true;
    else delete item.filled;
    refitPaint(item);
    commitState();
    redrawAll();
  }));
}

// ---- 足跡の道すじ ----

function normalizeFootprintPath(value: unknown): number[][] | undefined {
  if (!Array.isArray(value) || value.length < 2 || value.length > 2000) return undefined;
  const ok = value.every((point) => Array.isArray(point) && point.length === 2 && point.every((part) => typeof part === "number" && Number.isFinite(part) && Math.abs(part) <= 1));
  return ok ? value.map(([u, v]: number[]) => [Math.round(u * 10000) / 10000, Math.round(v * 10000) / 10000]) : undefined;
}

// なぞった点を、間引いて手ぶれをならした道すじにする（cm）
function tidyPath(points: Point[]): Point2[] {
  const spaced: Point2[] = [];
  for (const point of points) {
    const last = spaced[spaced.length - 1];
    if (!last || Math.hypot(point.x - last[0], point.y - last[1]) >= 2) spaced.push([point.x, point.y]);
  }
  if (spaced.length < 3) return spaced;
  const smooth = spaced.map((point, index): Point2 => {
    if (index === 0 || index === spaced.length - 1) return point;
    const from = Math.max(0, index - 2), to = Math.min(spaced.length - 1, index + 2);
    let sx = 0, sy = 0;
    for (let k = from; k <= to; k += 1) {
      sx += spaced[k][0];
      sy += spaced[k][1];
    }
    return [sx / (to - from + 1), sy / (to - from + 1)];
  });
  return simplifyPath(smooth, 1.2);
}

// 形をほとんど変えずに点を減らす（ダグラス・ポーカー法）
function simplifyPath(points: Point2[], tolerance: number): Point2[] {
  if (points.length < 3) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    const [ax, ay] = points[first], [bx, by] = points[last];
    const length = Math.hypot(bx - ax, by - ay) || 1;
    let farthest = -1, distance = tolerance;
    for (let i = first + 1; i < last; i += 1) {
      const d = Math.abs((bx - ax) * (ay - points[i][1]) - (ax - points[i][0]) * (by - ay)) / length;
      if (d > distance) {
        farthest = i;
        distance = d;
      }
    }
    if (farthest >= 0) {
      keep[farthest] = true;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return points.filter((_, index) => keep[index]);
}

function pathLength(points: Point2[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return total;
}

// 「なぞり直す」を押した足跡・破片
function pathRedrawTarget(kind: FurnitureKind): Furniture | null {
  const target = footprintRedrawId ? findEntity(footprintRedrawId) : null;
  return target?.type === "furniture" && target.kind === kind && !isLocked(target) ? target : null;
}

function footprintRedrawTarget(): Furniture | null {
  return pathRedrawTarget("footprints");
}

// なぞり終えたとき。短ければ（クリック）まっすぐな足跡を置き、長ければその道すじに沿った足跡を作る（または描き直す）
function placeFootprintPath(points: Point[]): void {
  const redraw = footprintRedrawTarget();
  footprintRedrawId = null;
  const path = tidyPath(points);
  if (path.length < 2 || pathLength(path) < 30) {
    if (redraw) return;
    const base = FURNITURE_DEFS.footprints;
    const item: Furniture = {
      id: newId("furniture"), type: "furniture", kind: "footprints",
      x: snap(points[0].x - base.w / 2), y: snap(points[0].y - base.h / 2), w: base.w, h: base.h, rotation: 0, ...rememberedSymbol("footprints"),
    };
    activeEntities().push(item);
    state.selectedId = item.id;
    return;
  }
  const stride = redraw?.stride ?? FOOTPRINT_STRIDE;
  // 足の大きさと、道すじからのずれの分だけ、範囲を広げる
  const margin = Math.ceil(Math.min(stride * 0.82, 28) + 4);
  const xs = path.map((point) => point[0]), ys = path.map((point) => point[1]);
  const w = roundTenth(Math.max(20, Math.max(...xs) - Math.min(...xs) + margin * 2));
  const h = roundTenth(Math.max(20, Math.max(...ys) - Math.min(...ys) + margin * 2));
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const item: Furniture = redraw ?? { id: newId("furniture"), type: "furniture", kind: "footprints", x: 0, y: 0, w, h, rotation: 0, ...rememberedSymbol("footprints") };
  item.x = roundTenth(cx - w / 2);
  item.y = roundTenth(cy - h / 2);
  item.w = w;
  item.h = h;
  item.rotation = 0;
  delete item.flip;
  item.path = path.map(([x, y]) => [Math.round(((x - cx) / w) * 10000) / 10000, Math.round(((y - cy) / h) * 10000) / 10000]);
  if (!redraw) activeEntities().push(item);
  state.selectedId = item.id;
  if (redraw) {
    activeTool = "select";
    setActiveButton("[data-tool]", activeTool);
    setActiveButton("[data-furniture]", "");
  }
}

// なぞっている間の見本: 道すじと、そこに付く足跡
function drawFootprintPreview(points: Point[]): void {
  const path = tidyPath(points);
  if (path.length < 2) return;
  const redraw = footprintRedrawTarget();
  const bare = (redraw ? redraw.symbol ?? 0 : rememberedSymbol("footprints").symbol ?? 0) === 1;
  ctx.save();
  ctx.strokeStyle = "rgba(39, 117, 209, 0.55)";
  ctx.lineWidth = 1.5 / view.zoom;
  ctx.setLineDash([6 / view.zoom, 4 / view.zoom]);
  traceOpenPath(path);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(107, 98, 90, 0.75)";
  footprintPathTrail(path, Infinity, Infinity, bare, redraw?.stride ?? FOOTPRINT_STRIDE).forEach(fillPiece);
  ctx.restore();
}

function traceOpenPath(points: Point2[]): void {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
}

function footprintEditorHtml(item: Furniture, disabled: string): string {
  return `
    <label>歩幅 cm<input id="footprintStrideInput" type="number" min="${MIN_STRIDE}" max="${MAX_STRIDE}" step="2" value="${item.stride ?? FOOTPRINT_STRIDE}" ${disabled} /></label>
    <div class="two-col">
      <button type="button" class="prop-button" id="footprintRedrawButton" ${disabled}>道すじを描き直す</button>
      <button type="button" class="prop-button" id="footprintStraightButton" ${disabled || (item.path ? "" : "disabled")}>まっすぐにする</button>
    </div>
    <p class="pose-hint">パーツの「足跡」を選んで2Dをドラッグすると、なぞった道すじに足跡が付きます（クリックだけなら、まっすぐな足跡）。</p>`;
}

function bindFootprintEditor(item: Furniture): void {
  bindNumber("#footprintStrideInput", (value) => {
    const stride = clamp(Math.round(value), MIN_STRIDE, MAX_STRIDE);
    if (stride === FOOTPRINT_STRIDE) delete item.stride;
    else item.stride = stride;
  });
  propertiesPanel.querySelector<HTMLButtonElement>("#footprintRedrawButton")?.addEventListener("click", () => {
    footprintRedrawId = item.id;
    activeFurniture = "footprints";
    activeTool = "furniture";
    setActiveButton("[data-furniture]", activeFurniture);
    setActiveButton("[data-tool]", activeTool);
    syncPlanCursor();
    const hint = propertiesPanel.querySelector<HTMLParagraphElement>(".pose-hint");
    if (hint) hint.textContent = "2Dの上をドラッグして、新しい道すじをなぞってください。";
  });
  bindButton("#footprintStraightButton", () => {
    const base = FURNITURE_DEFS.footprints;
    const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
    delete item.path;
    item.w = base.w;
    item.h = base.h;
    item.x = snap(cx - base.w / 2);
    item.y = snap(cy - base.h / 2);
  });
}

// 破片。色を決めていればその色で塗り、縁はその色を暗くした線（決めていなければ、前からある水色のガラスと黒い縁）
function drawBrokenGlass(w: number, h: number, item?: Furniture): void {
  const color = solidColor(item?.color);
  ctx.save();
  if (color) ctx.strokeStyle = darkenColor(color, 0.55);
  for (const shard of shardPieces(w, h, item?.path, item?.brush, item?.density)) {
    traceLoop(shard);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function darkenColor(color: string, amount: number): string {
  const rgb = parseColorCode(color)?.rgb ?? INK;
  const channel = (index: number) => Math.round(parseInt(rgb.slice(1 + index * 2, 3 + index * 2), 16) * (1 - amount)).toString(16).padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

// 破片をなぞり終えたとき。短ければ（クリック）ひとまとまりの破片を置き、長ければ道すじに沿ってまく（または描き直す）
function placeShardPath(points: Point[]): void {
  const redraw = pathRedrawTarget("brokenGlass");
  footprintRedrawId = null;
  const path = tidyPath(points);
  if (path.length < 2 || pathLength(path) < 15) {
    if (redraw) return;
    const base = FURNITURE_DEFS.brokenGlass;
    const item: Furniture = { id: newId("furniture"), type: "furniture", kind: "brokenGlass", x: snap(points[0].x - base.w / 2), y: snap(points[0].y - base.h / 2), w: base.w, h: base.h, rotation: 0 };
    activeEntities().push(item);
    state.selectedId = item.id;
    return;
  }
  const spread = redraw?.brush ?? shardSettings.spread;
  const density = redraw?.density ?? shardSettings.density;
  const frame = pathFrame(path, shardMargin(spread));
  const item: Furniture = redraw ?? { id: newId("furniture"), type: "furniture", kind: "brokenGlass", x: 0, y: 0, w: 1, h: 1, rotation: 0 };
  Object.assign(item, frame, { rotation: 0, brush: spread });
  if (density === 1) delete item.density;
  else item.density = density;
  delete item.flip;
  if (!redraw) activeEntities().push(item);
  state.selectedId = item.id;
  if (redraw) {
    activeTool = "select";
    setActiveButton("[data-tool]", activeTool);
    setActiveButton("[data-furniture]", "");
  }
}

// 道すじ（間取りの cm）から、余白を付けた範囲と、範囲に対する割合の道すじを作る
function pathFrame(path: Point2[], margin: number): { x: number; y: number; w: number; h: number; path: number[][] } {
  const xs = path.map((point) => point[0]), ys = path.map((point) => point[1]);
  const w = roundTenth(Math.max(20, Math.max(...xs) - Math.min(...xs) + margin * 2));
  const h = roundTenth(Math.max(20, Math.max(...ys) - Math.min(...ys) + margin * 2));
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  return {
    x: roundTenth(cx - w / 2), y: roundTenth(cy - h / 2), w, h,
    path: path.map(([x, y]) => [Math.round(((x - cx) / w) * 10000) / 10000, Math.round(((y - cy) / h) * 10000) / 10000]),
  };
}

// なぞっている間の見本: 道すじと、そこにまかれる破片
function drawShardPreview(points: Point[]): void {
  const path = tidyPath(points);
  if (path.length < 2) return;
  const redraw = pathRedrawTarget("brokenGlass");
  const color = solidColor(redraw?.color);
  ctx.save();
  ctx.strokeStyle = "rgba(39, 117, 209, 0.55)";
  ctx.lineWidth = 1.5 / view.zoom;
  ctx.setLineDash([6 / view.zoom, 4 / view.zoom]);
  traceOpenPath(path);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = color ?? "#dcedf4";
  ctx.strokeStyle = color ? darkenColor(color, 0.55) : INK;
  ctx.lineWidth = 1.2 / view.zoom;
  for (const shard of shardTrail(path, Infinity, Infinity, redraw?.brush ?? shardSettings.spread, redraw?.density ?? shardSettings.density)) {
    traceLoop(shard);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function shardEditorHtml(item: Furniture, disabled: string): string {
  const density = item.density ?? 1;
  return `
    <div class="two-col">
      <label>まく幅 cm<input id="shardSpreadInput" type="number" min="5" max="${MAX_BRUSH}" step="5" value="${item.brush ?? SHARD_SPREAD}" ${disabled || (item.path ? "" : "disabled")} /></label>
      <label>量<select id="shardDensityInput" ${disabled || (item.path ? "" : "disabled")}>${SHARD_DENSITIES.map(([value, label]) => `<option value="${value}" ${value === density ? "selected" : ""}>${label}</option>`).join("")}</select></label>
    </div>
    <div class="two-col">
      <button type="button" class="prop-button" id="shardRedrawButton" ${disabled}>なぞり直す</button>
      <button type="button" class="prop-button" id="shardGatherButton" ${disabled || (item.path ? "" : "disabled")}>ひとまとまりにする</button>
    </div>
    <p class="pose-hint">パーツの「破片」を選んで2Dをドラッグすると、なぞった所に破片が散らばります（クリックだけなら、ひとまとまり）。色は「色 2D」「色 3D」で変えられます（陶器や木の破片など）。</p>`;
}

// 道すじのある破片で、まく幅や量を変えたとき。道すじの場所はそのままに、範囲を合わせ直す
function refitShards(item: Furniture): void {
  if (!item.path) return;
  const points = item.path.map(([u, v]): Point2 => [u * item.w, v * item.h]);
  const frame = pathFrame(points, shardMargin(item.brush ?? SHARD_SPREAD));
  const center = furnitureLocalToWorld(item, [frame.x + frame.w / 2, frame.y + frame.h / 2]);
  item.w = frame.w;
  item.h = frame.h;
  item.path = frame.path;
  item.x = roundTenth(center.x - frame.w / 2);
  item.y = roundTenth(center.y - frame.h / 2);
}

function bindShardEditor(item: Furniture): void {
  bindNumber("#shardSpreadInput", (value) => {
    item.brush = clamp(Math.round(value), 5, MAX_BRUSH);
    shardSettings.spread = item.brush;
    refitShards(item);
  });
  bindSelect("#shardDensityInput", (value) => {
    const density = Number(value);
    if (!SHARD_DENSITIES.some(([option]) => option === density)) return;
    if (density === 1) delete item.density;
    else item.density = density;
    shardSettings.density = density;
  });
  propertiesPanel.querySelector<HTMLButtonElement>("#shardRedrawButton")?.addEventListener("click", () => {
    footprintRedrawId = item.id;
    activeFurniture = "brokenGlass";
    activeTool = "furniture";
    setActiveButton("[data-furniture]", activeFurniture);
    setActiveButton("[data-tool]", activeTool);
    syncPlanCursor();
    const hint = propertiesPanel.querySelector<HTMLParagraphElement>(".pose-hint");
    if (hint) hint.textContent = "2Dの上をドラッグして、破片をまく所をなぞってください。";
  });
  bindButton("#shardGatherButton", () => {
    const base = FURNITURE_DEFS.brokenGlass;
    const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
    delete item.path;
    delete item.brush;
    delete item.density;
    item.w = base.w;
    item.h = base.h;
    item.x = snap(cx - base.w / 2);
    item.y = snap(cy - base.h / 2);
  });
}

// 番号の印を置くときの番号。どの階にもある番号の印の、いちばん大きい番号の次
function nextMarkerLabel(): string {
  const numbers = state.floors
    .flatMap((floor) => floor.entities)
    .filter((entity): entity is Furniture => entity.type === "furniture" && entity.kind === "evidenceMarker")
    .map((entity) => Number(entity.markerLabel))
    .filter((value) => Number.isInteger(value) && value > 0);
  return String(Math.max(0, ...numbers) + 1);
}

// 新しく置く家具の、種類ごとの初めの設定（前に選んだデザイン。番号の印なら次の番号）
function newFurnitureDetails(kind: FurnitureKind): { symbol?: number; markerLabel?: string } {
  return { ...rememberedSymbol(kind), ...(kind === "evidenceMarker" ? { markerLabel: nextMarkerLabel() } : {}) };
}

// 番号の印の上の面（3D）に、2Dと同じ番号を書いた画像を貼る。札の色の上に、2Dの線の色で書く
function applyMarkerLabel(group: THREE.Group, item: Furniture): void {
  let body: THREE.MeshStandardMaterial | undefined;
  let face: THREE.MeshStandardMaterial | undefined;
  group.traverse((object) => {
    const material = (object as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (material?.name === "marker") body = material;
    if (material?.name === "marker-label") face = material;
  });
  if (!face) return;
  const shape = evidenceMarkerShape(item.w, item.h, item.symbol ?? 0);
  const text = item.markerLabel ?? "";
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = `#${(body?.color ?? new THREE.Color(0xf2c230)).getHexString()}`;
  context.fillRect(0, 0, size, size);
  if (text) {
    // 3Dでは反転した家具を鏡に映すので、文字を先に裏返しておく
    if (item.flip) {
      context.translate(size, 0);
      context.scale(-1, 1);
    }
    context.fillStyle = solidColor(item.color) ?? INK;
    context.font = `700 ${(markerTextSize(shape, text) / markerTextureSpan(shape)) * size}px ${TEXT_FONT}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, size / 2, size / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  face.map = texture;
  face.color.set(0xffffff);
  face.needsUpdate = true;
}

// 木や植え込みの、丸いこぶが連なった輪郭。inner はこぶの付け根の半径（外枠に対する比）
function traceCanopy(w: number, h: number, bumps: number, inner: number): void {
  const hw = w / 2, hh = h / 2;
  // こぶの頂点がちょうど外枠に届くときの、制御点の半径
  const outer = 2 - inner * Math.cos(Math.PI / bumps);
  ctx.beginPath();
  for (let i = 0; i <= bumps; i += 1) {
    const a = (i / bumps) * Math.PI * 2;
    const x = Math.cos(a) * hw * inner, y = Math.sin(a) * hh * inner;
    if (i === 0) {
      ctx.moveTo(x, y);
      continue;
    }
    const mid = a - Math.PI / bumps;
    ctx.quadraticCurveTo(Math.cos(mid) * hw * outer, Math.sin(mid) * hh * outer, x, y);
  }
  ctx.closePath();
}

function traceStar(rx: number, ry: number, points: number, inner: number): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const k = i % 2 ? inner : 1;
    if (i === 0) ctx.moveTo(Math.cos(a) * rx * k, Math.sin(a) * ry * k);
    else ctx.lineTo(Math.cos(a) * rx * k, Math.sin(a) * ry * k);
  }
  ctx.closePath();
}

function tracePolygon(rx: number, ry: number, sides: number, scale: number): void {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) ctx.moveTo(Math.cos(a) * rx * scale, Math.sin(a) * ry * scale);
    else ctx.lineTo(Math.cos(a) * rx * scale, Math.sin(a) * ry * scale);
  }
  ctx.closePath();
}

// 上から見た花。5枚の花びらと、塗り分けた花芯
function drawFlower(cx: number, cy: number, r: number): void {
  const fill = ctx.fillStyle;
  ctx.fillStyle = "#ffffff";
  for (const a of PETAL_ANGLES) strokeCircle(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5, r * 0.42, true);
  ctx.fillStyle = "#f2d98b";
  strokeCircle(cx, cy, r * 0.26, true);
  ctx.fillStyle = fill;
}

// ---- 2D記号の別デザイン ----

function validSymbol(kind: FurnitureKind, symbol: unknown): number {
  const count = SYMBOL_VARIANTS[kind]?.length ?? 0;
  return typeof symbol === "number" && Number.isInteger(symbol) && symbol >= 1 && symbol <= count ? symbol : 0;
}

function setFurnitureSymbol(item: Furniture, symbol: number): void {
  const next = validSymbol(item.kind, symbol);
  // 倒れた人で前からある形（うつぶせ・手足を広げて）を選んだら、動かした手足を戻してその形にする。チョークの線は今の形のまま
  if (item.kind === "fallenPerson" && item.pose && next !== 2) {
    const scale = personLayoutOf(item).scale;
    const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
    delete item.pose;
    item.w = roundTenth(FURNITURE_DEFS.fallenPerson.w * scale);
    item.h = roundTenth(FURNITURE_DEFS.fallenPerson.h * scale);
    item.x = roundTenth(cx - item.w / 2);
    item.y = roundTenth(cy - item.h / 2);
  }
  if (next) item.symbol = next;
  else delete item.symbol;
  lastSymbolByKind[item.kind] = next;
}

function rememberedSymbol(kind: FurnitureKind): { symbol?: number } {
  const symbol = validSymbol(kind, lastSymbolByKind[kind]);
  return symbol ? { symbol } : {};
}

// 選択中パネルで記号を見比べるための見本。回転はせず、反転と2Dの色は反映する
function drawSymbolPreview(canvas: HTMLCanvasElement, item: Furniture, symbol: number): void {
  const target = canvas.getContext("2d");
  if (!target) return;
  const ratio = window.devicePixelRatio || 1;
  const size = SYMBOL_PREVIEW_SIZE;
  canvas.width = Math.round(size * ratio);
  canvas.height = Math.round(size * ratio);
  // 倒れた人の前からある形の見本は、その形の標準の大きさで見せる（手足を動かした後の範囲だと小さくなるため）
  const legacyPreview = item.kind === "fallenPerson" && symbol !== 2 && Boolean(item.pose);
  const w = legacyPreview ? FURNITURE_DEFS.fallenPerson.w : item.w, h = legacyPreview ? FURNITURE_DEFS.fallenPerson.h : item.h;
  const scale = Math.min((size - 8) / w, (size - 8) / h);
  const planContext = ctx;
  ctx = target;
  symbolPreview = true;
  try {
    ctx.setTransform(ratio * scale, 0, 0, ratio * scale, (size / 2) * ratio, (size / 2) * ratio);
    if (item.flip) ctx.scale(-1, 1);
    ctx.lineWidth = 1 / scale;
    ctx.strokeStyle = solidColor(item.color) ?? INK;
    ctx.fillStyle = furnitureFill(item);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    drawFurnitureSymbol(item.kind, w, h, symbol, item);
    if (item.kind === "evidenceMarker") drawMarkerLabel({ ...item, symbol });
  } finally {
    ctx = planContext;
    symbolPreview = false;
  }
}

function drawChairWithLegs(w: number, h: number): void {
  // 座面の枠と四隅の脚。奥の辺に沿った線が背もたれ
  const hw = w / 2, hh = h / 2;
  strokeRoundedRect(-hw, -hh, w, h, Math.min(4, w * 0.1), true);
  strokeLine(-hw + w * 0.07, -hh + h * 0.09, hw - w * 0.07, -hh + h * 0.09);
  strokeRoundedRect(-w * 0.37, -h * 0.28, w * 0.74, h * 0.66, Math.min(4, w * 0.1));
  const leg = Math.min(w, h) * 0.055;
  for (const x of [-1, 1]) for (const y of [-1, 1]) strokeCircle(x * (hw - leg * 1.8), y * (hh - leg * 1.8), leg);
}

function drawRoundSeatChair(w: number, h: number): void {
  // 丸い座面と、奥から包む弓形の背もたれ（塗り分け）
  const fill = ctx.fillStyle;
  strokeEllipse(0, h * 0.06, w * 0.42, h * 0.42, true);
  ctx.fillStyle = SYMBOL_SHADE;
  ctx.beginPath();
  ctx.ellipse(0, h * 0.06, w * 0.5, h * 0.56, 0, Math.PI + 0.5, Math.PI * 2 - 0.5);
  ctx.ellipse(0, h * 0.06, w * 0.42, h * 0.42, 0, Math.PI * 2 - 0.5, Math.PI + 0.5, true);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = fill;
}

// 標準のダイニングセットと同じ並びで、椅子だけ別の描き方にする
function drawDiningSet(w: number, h: number, drawChair: (w: number, h: number) => void): void {
  const tw = w * 0.7;
  const th = h * 0.48;
  const cs = Math.min(w, h) * 0.23;
  const chairZ = th / 2 + cs * 0.58;
  for (const x of [-w * 0.17, w * 0.17]) {
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(x, side * chairZ);
      if (side > 0) ctx.rotate(Math.PI);
      drawChair(cs, cs);
      ctx.restore();
    }
  }
  strokeRoundedRect(-tw / 2, -th / 2, tw, th, 4, true);
}

function sofaSeats(kind: FurnitureKind, w: number): number {
  return kind === "armchair" ? 1 : Math.max(2, Math.min(4, Math.round(w / 65)));
}

function drawRoundArmSofa(w: number, h: number): void {
  // 丸みのある肘と背もたれ、座面は一枚のクッション
  const hw = w / 2, hh = h / 2;
  const t = Math.min(w, h) * 0.22;
  strokeRoundedRect(-hw, -hh, w, h, t, true);
  strokeRoundedRect(-hw + t * 0.5, -hh, w - t, t, t / 2, true);
  for (const x of [-hw, hw - t]) strokeRoundedRect(x, -hh, t, h, t / 2, true);
  strokeRoundedRect(-hw + t * 1.1, -hh + t * 1.1, w - t * 2.2, h - t * 1.1 - h * 0.07, t * 0.4);
}

function drawCushionSofa(w: number, h: number, seats: number): void {
  // 細い肘と、座る人数分の背クッション（塗り分け）と座面クッション
  const hw = w / 2, hh = h / 2;
  const fill = ctx.fillStyle;
  const t = Math.min(w, h) * 0.16;
  strokeRoundedRect(-hw, -hh, w, h, 4, true);
  for (const x of [-hw, hw - t]) strokeRoundedRect(x, -hh, t, h, 3, true);
  const cell = (w - t * 2) / seats;
  const gap = Math.min(cell, h) * 0.03;
  const back = h * 0.3;
  for (let i = 0; i < seats; i += 1) {
    const x = -hw + t + i * cell + gap;
    strokeRoundedRect(x, -hh + back * 0.9, cell - gap * 2, h - back * 0.9 - gap * 2, Math.min(cell, h) * 0.08);
    ctx.fillStyle = SYMBOL_SHADE;
    strokeRoundedRect(x + cell * 0.04, -hh + gap, cell * 0.92 - gap * 2, back, back * 0.4, true);
    ctx.fillStyle = fill;
  }
}

// ベッドの枠、頭側の板、枕（1つまたは2つ）
function drawBedFrame(w: number, h: number, pillows: number): void {
  const hw = w / 2, hh = h / 2;
  strokeRoundedRect(-hw, -hh, w, h, 4, true);
  strokeRoundedRect(-w * 0.45, -h * 0.48, w * 0.9, h * 0.035, 2);
  if (pillows === 1) {
    strokeRoundedRect(-w * 0.28, -hh + h * 0.04, w * 0.56, h * 0.1, 4);
  } else {
    strokeRoundedRect(-w * 0.43, -hh + h * 0.04, w * 0.37, h * 0.1, 4);
    strokeRoundedRect(w * 0.06, -hh + h * 0.04, w * 0.37, h * 0.1, 4);
  }
}

// 掛け布団の角を斜めに折り返した三角（裏地を塗る）。right, top は布団の右上の角
function drawBlanketFold(right: number, top: number, fold: number): void {
  const fill = ctx.fillStyle;
  ctx.fillStyle = SYMBOL_SHADE;
  ctx.beginPath();
  ctx.moveTo(right - fold, top);
  ctx.lineTo(right, top + fold);
  ctx.lineTo(right - fold, top + fold);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = fill;
}

function drawFoldedBed(w: number, h: number, pillows: number): void {
  drawBedFrame(w, h, pillows);
  const hw = w / 2, top = -h / 2 + h * 0.24;
  const fold = Math.min(w * 0.5, h * 0.36);
  strokeLine(-hw, top, hw - fold, top);
  drawBlanketFold(hw, top, fold);
}

function drawRunnerBed(w: number, h: number, pillows: number): void {
  // 足元に掛けた帯（ベッドスロー）を塗り分ける
  drawBedFrame(w, h, pillows);
  const hw = w / 2, hh = h / 2;
  strokeLine(-hw, -hh + h * 0.24, hw, -hh + h * 0.24);
  const fill = ctx.fillStyle;
  ctx.fillStyle = SYMBOL_SHADE;
  ctx.beginPath();
  ctx.rect(-hw, hh - h * 0.3, w, h * 0.14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = fill;
}

function drawFoldedFuton(w: number, h: number): void {
  // 敷布団と枕、角を折り返した掛け布団
  const hw = w / 2, hh = h / 2;
  const r = Math.min(w, h) * 0.12;
  ctx.fillStyle = "#f8f7f2";
  strokeRoundedRect(-hw, -hh, w, h, r, true);
  strokeRoundedRect(-w * 0.26, -hh + h * 0.05, w * 0.52, h * 0.1, 5);
  const left = -hw + w * 0.03, right = hw - w * 0.03, top = -hh + h * 0.27, bottom = hh - h * 0.03;
  const fold = Math.min(w * 0.5, h * 0.3);
  const corner = r * 0.8;
  ctx.fillStyle = "#edf3f2";
  ctx.beginPath();
  ctx.moveTo(left, top + corner);
  ctx.arcTo(left, top, left + corner, top, corner);
  ctx.lineTo(right - fold, top);
  ctx.lineTo(right, top + fold);
  ctx.arcTo(right, bottom, right - corner, bottom, corner);
  ctx.arcTo(left, bottom, left, bottom - corner, corner);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  drawBlanketFold(right, top, fold);
}

function drawSimpleDesk(w: number, h: number): void {
  // 天板と、袖の引き出しを一つの枠で
  strokeRoundedRect(-w / 2, -h / 2, w, h, 3, true);
  strokeRoundedRect(w * 0.15, -h * 0.38, w * 0.28, h * 0.76, 2);
  strokeLine(w * 0.23, h * 0.32, w * 0.35, h * 0.32);
  strokeCircle(-w * 0.3, -h * 0.32, Math.min(w, h) * 0.025);
}

function drawDoublePedestalDesk(w: number, h: number): void {
  // 左右の袖に引き出し3段、中央に浅い引き出しの取っ手
  const hw = w / 2, hh = h / 2;
  strokeRoundedRect(-hw, -hh, w, h, 3, true);
  drawDrawerStack(hw - w * 0.24, hw, -hh, hh);
  drawDrawerStack(-hw + w * 0.24, -hw, -hh, hh);
  strokeLine(-w * 0.08, hh - h * 0.1, w * 0.08, hh - h * 0.1);
}

function traceTableTop(w: number, h: number, round: boolean, inset = 0): void {
  if (round) {
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2 - inset, h / 2 - inset, 0, 0, Math.PI * 2);
  } else {
    roundedRect(-w / 2 + inset, -h / 2 + inset, w - inset * 2, h - inset * 2, Math.max(1, 4 - inset * 0.3));
  }
}

function drawGlassTable(w: number, h: number, round: boolean): void {
  // 薄い青のガラス天板と縁の二重線、左上に光の映り込み（斜めの短い線2本）
  ctx.fillStyle = "#eaf3f5";
  traceTableTop(w, h, round);
  ctx.fill();
  ctx.stroke();
  traceTableTop(w, h, round, Math.min(w, h) * 0.07);
  ctx.stroke();
  if (round) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    const fill = ctx.fillStyle;
    ctx.fillStyle = SYMBOL_SHADE;
    strokeEllipse(0, 0, w * 0.225, h * 0.225, true);
    ctx.fillStyle = fill;
    for (let i = 0; i < 3; i += 1) {
      const a = (i * Math.PI * 2) / 3;
      strokeLine(0, 0, Math.cos(a) * w * 0.44, Math.sin(a) * h * 0.44);
    }
    ctx.restore();
  } else {
    // ガラス越しに見える下の棚（破線）
    ctx.save();
    ctx.setLineDash([4, 3]);
    traceTableTop(w, h, round, Math.min(w, h) * 0.12);
    ctx.stroke();
    ctx.restore();
  }
  const s = Math.min(w, h);
  const cx = -w * 0.2, cy = -h * 0.1;
  for (const [offset, length] of [[0, 0.3], [0.09, 0.18]]) {
    const ox = cx + s * offset * 0.7, oy = cy + s * offset * 0.7;
    const d = (s * length) / 2 / Math.SQRT2;
    strokeLine(ox - d, oy + d, ox + d, oy - d);
  }
}

function drawWoodTable(w: number, h: number, round: boolean): void {
  // 天板に沿って流れる木目（薄い線）と節。3Dも同じ曲線で溝を付ける
  traceTableTop(w, h, round);
  ctx.fill();
  ctx.save();
  traceTableTop(w, h, round);
  ctx.clip();
  ctx.globalAlpha = 0.55;
  const grain = woodGrain(w, h);
  for (const [p0, c1, c2, p1] of grain.lines) {
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p1[0], p1[1]);
    ctx.stroke();
  }
  strokeEllipse(grain.knot.x, grain.knot.y, grain.knot.rx, grain.knot.ry);
  ctx.restore();
  traceTableTop(w, h, round);
  ctx.stroke();
}

function drawTvWithLegs(w: number, h: number): void {
  // 台の上に脚の付いた画面を置いた形
  const hw = w / 2, hh = h / 2;
  strokeRoundedRect(-hw, -hh, w, h, 3, true);
  strokeRoundedRect(-w * 0.42, -hh + 3, w * 0.84, Math.max(5, h * 0.18), 2);
  for (const sign of [-1, 1]) strokeLine(sign * w * 0.26, -h * 0.29, sign * w * 0.31, h * 0.14);
  strokeLine(-w * 0.17, h * 0.4, -w * 0.17, hh);
  strokeLine(w * 0.17, h * 0.4, w * 0.17, hh);
}

function drawFrenchDoorFridge(w: number, h: number): void {
  // 前面を左右2枚の扉に分け、合わせ目の両側に取っ手。中央に雪の結晶
  const hw = w / 2, hh = h / 2;
  strokeRoundedRect(-hw, -hh, w, h, 3, true);
  strokeLine(-hw + 3, hh - h * 0.16, hw - 3, hh - h * 0.16);
  strokeLine(0, hh - h * 0.16, 0, hh);
  for (const sign of [-1, 1]) strokeLine(sign * w * 0.05, hh - h * 0.08, sign * w * 0.18, hh - h * 0.08);
  drawSnowflake(0, -h * 0.08, Math.min(w, h) * 0.27);
}

function drawSimpleFridge(w: number, h: number): void {
  const hw = w / 2, hh = h / 2;
  strokeRoundedRect(-hw, -hh, w, h, 3, true);
  strokeLine(-hw + 3, hh - h * 0.18, hw - 3, hh - h * 0.18);
  strokeLine(-hw + w * 0.16, hh - h * 0.09, -hw + w * 0.38, hh - h * 0.09);
  strokeRoundedRect(-w * 0.45, -h * 0.45, w * 0.9, h * 0.74, 2);
}

function drawLidWasher(w: number, h: number): void {
  // 奥の操作パネルとつまみ、手前に四角いふたと取っ手
  const hw = w / 2, hh = h / 2;
  const m = Math.min(w, h);
  strokeRoundedRect(-hw, -hh, w, h, 4, true);
  strokeLine(-hw + 3, -hh + h * 0.2, hw - 3, -hh + h * 0.2);
  strokeCircle(hw - w * 0.15, -hh + h * 0.1, m * 0.05);
  strokeRoundedRect(-w * 0.38, -hh + h * 0.28, w * 0.76, h * 0.6, m * 0.12);
  strokeLine(-w * 0.1, hh - h * 0.19, w * 0.1, hh - h * 0.19);
}

function drawTanklessToilet(w: number, h: number): void {
  // 背の低い本体（タンクなし）と、大きめの便座
  const hw = w / 2, hh = h / 2;
  strokeRoundedRect(-w * 0.36, -hh, w * 0.72, h * 0.16, Math.min(w, h) * 0.06, true);
  ctx.fillStyle = "#ffffff";
  strokeEllipse(0, h * 0.06, hw * 0.88, h * 0.4, true);
  strokeEllipse(0, h * 0.1, w * 0.28, h * 0.26);
}

function drawHandWashToilet(w: number, h: number): void {
  // タンクの上に手洗いの鉢と蛇口
  const hw = w / 2, hh = h / 2;
  strokeRoundedRect(-hw + 1, -hh, w - 2, h * 0.26, 2, true);
  strokeEllipse(0, -hh + h * 0.14, w * 0.3, h * 0.08);
  strokeLine(0, -hh + h * 0.02, 0, -hh + h * 0.09);
  ctx.fillStyle = "#ffffff";
  strokeEllipse(0, h * 0.14, w * 0.42, h * 0.32, true);
  strokeEllipse(0, h * 0.14, w * 0.27, h * 0.21);
}

function drawSquareBath(w: number, h: number): void {
  // 角の丸い四角い浴槽。左の縁に水栓、底に排水口
  const hw = w / 2, hh = h / 2;
  strokeRoundedRect(-hw, -hh, w, h, 4, true);
  strokeRoundedRect(-w * 0.38, -h * 0.38, w * 0.82, h * 0.76, Math.min(w, h) * 0.18);
  strokeRoundedRect(-hw + w * 0.03, -h * 0.12, w * 0.05, h * 0.24, 2);
  strokeCircle(-w * 0.3, 0, 3);
}

function drawSquareWashbasin(w: number, h: number): void {
  // 角の丸い四角のボウル、奥の蛇口、手前の扉の合わせ目
  const hw = w / 2, hh = h / 2;
  strokeRoundedRect(-hw, -hh, w, h, 3, true);
  strokeRoundedRect(-w * 0.3, -h * 0.2, w * 0.6, h * 0.52, Math.min(w, h) * 0.1);
  strokeRoundedRect(-w * 0.07, -hh + 2, w * 0.14, 5, 2);
  strokeLine(0, -hh + 7, 0, -h * 0.12);
  strokeCircle(0, h * 0.1, Math.min(w, h) * 0.025);
  strokeLine(0, h * 0.4, 0, hh);
}

function drawGasBurner(x: number, y: number, r: number): void {
  // 炎の出る口（内側の円）と、鍋を載せる五徳（4本の爪）
  strokeCircle(x, y, r);
  strokeCircle(x, y, r * 0.38);
  for (let i = 0; i < 4; i += 1) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    strokeLine(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95);
  }
}

function drawKitchenSymbol(w: number, h: number, island: boolean, gas: boolean): void {
  const hw = w / 2, hh = h / 2;
  strokeRoundedRect(-hw, -hh, w, h, 2, true);
  if (island) {
    // 壁に付かない独立型。奥の張り出し（カウンター席側）を破線で示す
    ctx.save();
    ctx.setLineDash([4, 3]);
    strokeLine(-hw + 3, -hh + h * 0.07, hw - 3, -hh + h * 0.07);
    ctx.restore();
  }
  strokeRoundedRect(-hw + w * 0.07, -h * 0.3, w * 0.24, h * 0.6, 5);
  strokeCircle(-hw + w * 0.19, -hh + h * 0.12, 2.5);
  const bx = hw - w * 0.16;
  const br = h * 0.17;
  const burner = gas ? drawGasBurner : strokeCircle;
  burner(bx, -h * 0.2, br);
  burner(bx, h * 0.2, br);
  burner(bx - w * 0.14, 0, br * 0.8);
  strokeRoundedRect(w * 0.06, -h * 0.39, w * 0.39, h * 0.78, 2);
  const doors = Math.max(2, Math.min(8, Math.round(w / 60)));
  for (let i = 1; i < doors; i += 1) strokeLine(-hw + i * w / doors, hh - h * 0.09, -hw + i * w / doors, hh);
}

// クローゼットのハンガーパイプ（破線）と、掛けた服
function drawClosetRod(w: number, h: number): void {
  const hw = w / 2;
  const rodY = -h * 0.12;
  ctx.save();
  ctx.setLineDash([Math.max(3, w * 0.03), Math.max(2, w * 0.02)]);
  strokeLine(-hw + w * 0.05, rodY, hw - w * 0.05, rodY);
  ctx.restore();
  const hangers = Math.max(3, Math.floor((w * 0.86) / 14));
  for (let i = 0; i < hangers; i += 1) {
    const x = -w * 0.43 + (w * 0.86 * (i + 0.5)) / hangers;
    strokeLine(x, rodY - h * 0.2, x, rodY + h * 0.2);
  }
}

function drawSlidingCloset(w: number, h: number): void {
  // 前面の引き戸は、前後2本のレールに交互に並べて少し重ねる
  const hw = w / 2, hh = h / 2;
  strokeRoundedRect(-hw, -hh, w, h, 2, true);
  drawClosetRod(w, h);
  const doors = Math.max(2, Math.min(4, Math.round(w / 90)));
  const inner = w - 6;
  const panel = (inner / doors) * 1.08;
  const thick = Math.max(3, h * 0.08);
  for (let i = 0; i < doors; i += 1) {
    const x = -hw + 3 + (i * (inner - panel)) / (doors - 1);
    const y = hh - 3 - thick * (i % 2 ? 1 : 2);
    strokeRoundedRect(x, y, panel, thick, 1, true);
  }
}

// 岩: 輪郭、頂上から下りる稜線、手前の面の塗り。3Dも同じ輪郭と稜線で面を作る
function drawRocks(shapes: RockShape[]): void {
  const fill = ctx.fillStyle;
  for (const shape of shapes) {
    const { outline, peak, ridges } = shape;
    ctx.fillStyle = OUTDOOR_STONE;
    ctx.beginPath();
    outline.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 最初の稜線から次の稜線までの面（手前の面）を陰にする
    ctx.fillStyle = SYMBOL_SHADE;
    ctx.beginPath();
    ctx.moveTo(peak[0], peak[1]);
    for (let i = ridges[0]; ; i = (i + 1) % outline.length) {
      ctx.lineTo(outline[i][0], outline[i][1]);
      if (i === ridges[1]) break;
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (const index of ridges.slice(2)) strokeLine(peak[0], peak[1], outline[index][0], outline[index][1]);
  }
  ctx.fillStyle = fill;
}

function drawOfficeChair(w: number, h: number): void {
  // 5本脚のキャスター、座面、肘掛け、塗り分けた背もたれ
  const hw = w / 2, hh = h / 2;
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    const x = Math.cos(a) * hw * 0.88, y = Math.sin(a) * hh * 0.88;
    strokeLine(0, 0, x, y);
    strokeCircle(x, y, Math.min(w, h) * 0.06, true);
  }
  strokeRoundedRect(-w * 0.26, -h * 0.14, w * 0.52, h * 0.44, Math.min(w, h) * 0.1, true);
  for (const sign of [-1, 1]) strokeRoundedRect(sign * w * 0.3 - w * 0.04, -h * 0.08, w * 0.08, h * 0.3, 2, true);
  const fill = ctx.fillStyle;
  ctx.fillStyle = SYMBOL_SHADE;
  strokeRoundedRect(-w * 0.28, -h * 0.3, w * 0.56, h * 0.14, h * 0.07, true);
  ctx.fillStyle = fill;
}

function drawHighBackOfficeChair(w: number, h: number): void {
  // ハイバック: 背もたれの奥に、頭をのせる枕の帯（3Dと同じ位置）
  drawOfficeChair(w, h);
  const fill = ctx.fillStyle;
  ctx.fillStyle = SYMBOL_SHADE;
  strokeRoundedRect(-w * 0.23, -h * 0.48, w * 0.46, h * 0.1, h * 0.04, true);
  ctx.fillStyle = fill;
}

function drawRoundSideTable(w: number, h: number): void {
  // 丸い天板と、縁に沿った溝
  strokeEllipse(0, 0, w / 2, h / 2, true);
  strokeEllipse(0, 0, w * 0.46, h * 0.46);
}

function drawSquareStool(w: number, h: number): void {
  // 角の丸い四角の座面と、内側のクッション
  strokeRoundedRect(-w / 2, -h / 2, w, h, 3, true);
  strokeRoundedRect(-w * 0.4, -h * 0.4, w * 0.8, h * 0.8, 1);
}

function drawBacklessBench(w: number, h: number): void {
  // 背もたれなし: 奥行いっぱいに並べた4枚の板（継ぎ目は3本）
  strokeRoundedRect(-w / 2, -h / 2, w, h, 3, true);
  for (const y of [-0.25, 0, 0.25]) strokeLine(-w / 2, h * y, w / 2, h * y);
}

function drawSquareFloorLamp(w: number, h: number): void {
  // 四角いシェード: すその四角と上の口の四角、中の明かりの印
  strokeRoundedRect(-w / 2, -h / 2, w, h, 2, true);
  ctx.strokeRect(-w * 0.32, -h * 0.32, w * 0.64, h * 0.64);
  strokeLine(-w * 0.15, -h * 0.15, w * 0.15, h * 0.15);
  strokeLine(w * 0.15, -h * 0.15, -w * 0.15, h * 0.15);
}

function drawKotatsuTable(w: number, h: number): void {
  // 布団なし: 天板と縁の溝だけ（周りの床は空く）
  const fill = ctx.fillStyle;
  ctx.fillStyle = "#f7f5f0";
  strokeRoundedRect(-w * 0.32, -h * 0.32, w * 0.64, h * 0.64, 3, true);
  ctx.strokeRect(-w * 0.29, -h * 0.29, w * 0.58, h * 0.58);
  ctx.fillStyle = fill;
}

function drawTopiaryTree(w: number, h: number): void {
  // 丸く刈り込んだ木: 設置範囲いっぱいの丸い葉の玉と、光の当たる弧
  ctx.fillStyle = OUTDOOR_LEAF;
  strokeEllipse(0, 0, w / 2, h / 2, true);
  ctx.beginPath();
  ctx.ellipse(-w * 0.1, -h * 0.1, w * 0.26, h * 0.2, 0, Math.PI * 1.1, Math.PI * 1.75);
  ctx.stroke();
}

function drawHedge(w: number, h: number): void {
  // 生垣: 四角く刈り込んだ植え込み（角の丸い四角と、上面の縁）
  const m = Math.min(w, h);
  ctx.fillStyle = OUTDOOR_LEAF;
  strokeRoundedRect(-w / 2, -h / 2, w, h, m * 0.15, true);
  strokeRoundedRect(-w / 2 + m * 0.08, -h / 2 + m * 0.08, w - m * 0.16, h - m * 0.16, m * 0.08);
}

function drawBlockWall(w: number, h: number): void {
  // ブロック塀: 上から見える笠木の帯と、40cmごとの目地（3Dと同じ数）
  const along = w >= h;
  const length = along ? w : h;
  const band = Math.min(15, along ? h : w) * 0.85 * 1.18;
  const caps = blockWallCaps(length);
  ctx.save();
  if (!along) ctx.rotate(Math.PI / 2);
  ctx.fillStyle = OUTDOOR_STONE;
  strokeRoundedRect(-length / 2, -band / 2, length, band, 1, true);
  for (let i = 1; i < caps; i += 1) strokeLine(-length / 2 + (length * i) / caps, -band / 2, -length / 2 + (length * i) / caps, band / 2);
  ctx.restore();
}

function drawRoundFlowerBed(w: number, h: number): void {
  // 丸い花壇: 丸い縁と土、輪に並んだ花（3Dと同じ位置）
  const bed = roundFlowerBedLayout(w, h);
  ctx.fillStyle = OUTDOOR_SOIL;
  strokeEllipse(0, 0, w / 2, h / 2, true);
  strokeEllipse(0, 0, bed.innerW / 2, bed.innerH / 2);
  for (const [x, y] of bed.flowers) drawFlower(x, y, bed.size / 2);
}

function drawDrumWasher(w: number, h: number): void {
  // ドラム式: 平らな上面と、手前に少し出た丸い扉。中のドラムは隠れた線（破線）
  const hw = w / 2, hh = h / 2;
  strokeRoundedRect(-hw, -hh, w, h, 4, true);
  strokeRoundedRect(-w * 0.31, hh - h * 0.02, w * 0.62, h * 0.05, h * 0.02);
  strokeRoundedRect(-w * 0.44, hh - h * 0.03, w * 0.21, h * 0.03, 1);
  ctx.save();
  ctx.setLineDash([Math.min(w, h) * 0.05, Math.min(w, h) * 0.035]);
  strokeCircle(0, h * 0.04, Math.min(w, h) * 0.3);
  ctx.restore();
}

function drawCappedGardenLight(w: number, h: number): void {
  // 笠付き: 上から見ると暗い色の丸い笠と、てっぺんの小さな飾り
  const r = Math.min(w, h) / 2;
  const fill = ctx.fillStyle;
  ctx.fillStyle = "#3a4046";
  strokeCircle(0, 0, r * 0.96, true);
  ctx.fillStyle = "#ffffff";
  strokeCircle(0, 0, r * 0.14, true);
  ctx.fillStyle = fill;
}

function drawLouverCloset(w: number, h: number): void {
  // ルーバー扉: 中のハンガーパイプと服、手前の扉の帯に斜めの羽根板
  const hw = w / 2, hh = h / 2;
  strokeRoundedRect(-hw, -hh, w, h, 2, true);
  drawClosetRod(w, h);
  const doors = closetDoorCount(w);
  const band = Math.max(4, h * 0.1);
  for (let i = 0; i < doors; i += 1) {
    const x0 = -hw + (w * i) / doors, x1 = x0 + w / doors;
    strokeRoundedRect(x0 + 1, hh - band, x1 - x0 - 2, band - 1, 1);
    for (let x = x0 + band * 0.6; x < x1 - band * 0.5; x += band * 0.7) strokeLine(x, hh - band * 0.85, x + band * 0.45, hh - band * 0.2);
  }
}

function drawHatchedCloset(w: number, h: number): void {
  // 収納を斜線で塗り、手前に両開きの扉の合わせ目と取っ手
  const hw = w / 2, hh = h / 2;
  strokeRoundedRect(-hw, -hh, w, h, 2, true);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-hw, -hh, w, h);
  ctx.clip();
  for (let x = -hw - h; x < hw; x += 16) strokeLine(x, hh, x + h, -hh);
  ctx.restore();
  strokeLine(0, h * 0.38, 0, hh);
  strokeLine(-w * 0.12, h * 0.42, -w * 0.04, h * 0.42);
  strokeLine(w * 0.04, h * 0.42, w * 0.12, h * 0.42);
}

function drawDoubleDoorWardrobe(w: number, h: number): void {
  // 中央で分かれる両開きの扉と、合わせ目の両側の取っ手
  strokeRoundedRect(-w / 2, -h / 2, w, h, 2, true);
  strokeLine(0, -h * 0.4, 0, h * 0.42);
  strokeRoundedRect(-w * 0.45, -h * 0.4, w * 0.9, h * 0.83, 2);
  for (const sign of [-1, 1]) strokeLine(sign * w * 0.15, h * 0.35, sign * w * 0.33, h * 0.35);
}

function drawOpenShelf(w: number, h: number): void {
  // 本を入れていない、縦の仕切りで区切った棚
  strokeRoundedRect(-w / 2, -h / 2, w, h, 2, true);
  strokeRoundedRect(-w * 0.46, -h * 0.38, w * 0.92, h * 0.8, 1);
  const cells = Math.max(2, Math.round(w / 35));
  for (let i = 1; i < cells; i += 1) {
    const x = -w * 0.46 + (w * 0.92 * i) / cells;
    strokeLine(x, -h * 0.38, x, h * 0.42);
  }
}

// らせんの葉（ひとつ前の標準の3Dの形）: 3Dを真上から見た形そのもの。大きめの鉢と土、
// 茎から出る軸、下の葉から順に重ねた13枚の斜めの葉と葉脈
function drawSpiralPlant(w: number, h: number): void {
  const view = spiralPlantTopView(w, h);
  const fill = ctx.fillStyle;
  ctx.fillStyle = "#f3f1ec";
  strokeEllipse(view.pot.x, view.pot.y, view.pot.rx, view.pot.ry, true);
  strokeEllipse(view.soil.x, view.soil.y, view.soil.rx, view.soil.ry);
  ctx.fillStyle = "#e8f1e7";
  for (const leaf of view.leaves) {
    strokeLine(leaf.stem[0][0], leaf.stem[0][1], leaf.stem[1][0], leaf.stem[1][1]);
    ctx.beginPath();
    leaf.outline.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    strokeLine(leaf.midrib[0][0], leaf.midrib[0][1], leaf.midrib[1][0], leaf.midrib[1][1]);
  }
  ctx.fillStyle = fill;
}

function drawRoundLeafPlant(w: number, h: number): void {
  // 丸い葉がこんもり茂った鉢植え（葉の塊の位置は3Dと共通）
  const m = Math.max(w, h), r = m / 2;
  ctx.save();
  ctx.scale(w / m, h / m);
  ctx.fillStyle = "#e8f1e7";
  for (const clump of ROUND_LEAF_CLUMPS) strokeCircle(Math.cos(clump.angle) * r * clump.distance, Math.sin(clump.angle) * r * clump.distance, r * clump.size, true);
  ctx.restore();
}

function drawPalmPlant(w: number, h: number): void {
  // 鉢から放射状に伸びる細長い葉（葉軸と両側の小葉）。3Dも同じ葉軸と小葉で作る
  const m = Math.max(w, h), r = m / 2;
  ctx.save();
  ctx.scale(w / m, h / m);
  ctx.fillStyle = "#e8f1e7";
  strokeCircle(0, 0, r * 0.22, true);
  for (const frond of fernFronds()) {
    ctx.save();
    ctx.rotate(frond.angle);
    const [[x0, y0], [cx, cy], [x1, y1]] = frond.spine;
    ctx.beginPath();
    ctx.moveTo(r * x0, r * y0);
    ctx.quadraticCurveTo(r * cx, r * cy, r * x1, r * y1);
    ctx.stroke();
    for (const [[ax, ay], [bx, by]] of frond.leaflets) strokeLine(r * ax, r * ay, r * bx, r * by);
    ctx.restore();
  }
  ctx.restore();
}

function drawBorderRug(w: number, h: number): void {
  // 縁取りを二重にした無地のラグ
  ctx.fillStyle = "#e3ecea";
  strokeRoundedRect(-w / 2, -h / 2, w, h, 2, true);
  const m = Math.min(w, h);
  strokeRoundedRect(-w / 2 + m * 0.07, -h / 2 + m * 0.07, w - m * 0.14, h - m * 0.14, 1);
  strokeRoundedRect(-w / 2 + m * 0.11, -h / 2 + m * 0.11, w - m * 0.22, h - m * 0.22, 1);
}

function drawDiamondRug(w: number, h: number): void {
  // 縁の内側を、ひし形が並ぶ柄で埋める
  const m = Math.min(w, h);
  const inset = m * 0.08;
  ctx.fillStyle = "#e3ecea";
  strokeRoundedRect(-w / 2, -h / 2, w, h, 2, true);
  strokeRoundedRect(-w / 2 + inset, -h / 2 + inset, w - inset * 2, h - inset * 2, 1);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-w / 2 + inset, -h / 2 + inset, w - inset * 2, h - inset * 2);
  ctx.clip();
  const step = Math.max(12, m * 0.2);
  const reach = w + h;
  for (let d = -reach; d <= reach; d += step) {
    strokeLine(d - h / 2, -h / 2, d + h / 2, h / 2);
    strokeLine(d + h / 2, -h / 2, d - h / 2, h / 2);
  }
  ctx.restore();
}

function drawWagonCar(w: number, h: number): void {
  // 屋根が後ろまで長いワゴン。屋根の上にルーフレール
  const hw = w / 2, hh = h / 2;
  strokeRoundedRect(-hw, -hh, w, h, Math.min(hw, h * 0.12), true);
  strokeLine(-hw + w * 0.1, -hh + h * 0.12, hw - w * 0.1, -hh + h * 0.12);
  ctx.beginPath();
  ctx.moveTo(-w * 0.38, -h * 0.15);
  ctx.quadraticCurveTo(0, -h * 0.21, w * 0.38, -h * 0.15);
  ctx.stroke();
  strokeRoundedRect(-w * 0.36, -h * 0.11, w * 0.72, h * 0.5, 8);
  for (const sign of [-1, 1]) {
    strokeLine(sign * w * 0.29, -h * 0.07, sign * w * 0.29, h * 0.35);
    strokeLine(sign * (hw - w * 0.03), -h * 0.12, sign * hw, -h * 0.15);
    strokeRoundedRect(sign * w * 0.29 - w * 0.09, -h * 0.45, w * 0.18, h * 0.035, 2);
    strokeRoundedRect(sign * w * 0.29 - w * 0.09, h * 0.42, w * 0.18, h * 0.035, 2);
  }
}

function traceShapePath(shape: Shape): void {
  ctx.beginPath();
  if (shape.kind === "circle") {
    ctx.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2);
  } else if (shape.kind === "arc") {
    ctx.arc(shape.x, shape.y, shape.r, shape.startAngle, shape.endAngle);
  } else {
    const points = polygonPoints(shape);
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
  }
}

function drawShape2d(shape: Shape): void {
  const selected = state.selectedId === shape.id;
  ctx.save();
  if (selected) {
    ctx.strokeStyle = "rgba(39, 117, 209, 0.35)";
    ctx.lineWidth = WALL_THICKNESS_2D + 6 / view.zoom;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    traceShapePath(shape);
    ctx.stroke();
  }
  ctx.strokeStyle = solidColor(shape.color) ?? INK;
  ctx.lineWidth = WALL_THICKNESS_2D;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  traceShapePath(shape);
  ctx.stroke();
  ctx.restore();
  if (selected && !isLocked(shape)) drawShapeHandle(shape);
}

function drawShapeHandle(shape: Shape): void {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#2775d1";
  ctx.lineWidth = 2 / view.zoom;
  const size = 8 / view.zoom;
  ctx.fillRect(shape.x - size / 2, shape.y - size / 2, size, size);
  ctx.strokeRect(shape.x - size / 2, shape.y - size / 2, size, size);
  ctx.restore();
}

function drawPreview(start: Point, current: Point): void {
  ctx.save();
  ctx.setLineDash([8 / view.zoom, 6 / view.zoom]);
  ctx.lineWidth = 2 / view.zoom;
  ctx.strokeStyle = "#2775d1";
  ctx.fillStyle = "rgba(39, 117, 209, 0.08)";
  if (activeTool === "room") {
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const w = Math.abs(current.x - start.x);
    const h = Math.abs(current.y - start.y);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  } else if (activeTool === "circle" || activeTool === "arc" || activeTool === "polygon") {
    const r = Math.max(1, Math.hypot(current.x - start.x, current.y - start.y));
    ctx.beginPath();
    if (activeTool === "circle") {
      ctx.arc(start.x, start.y, r, 0, Math.PI * 2);
    } else if (activeTool === "arc") {
      ctx.arc(start.x, start.y, r, -Math.PI / 2, Math.atan2(current.y - start.y, current.x - start.x));
    } else {
      const sides = activePolygonSides;
      const rotation = Math.atan2(current.y - start.y, current.x - start.x) + Math.PI / sides;
      for (let i = 0; i <= sides; i += 1) {
        const angle = rotation + (i / sides) * Math.PI * 2;
        const px = start.x + Math.cos(angle) * r;
        const py = start.y + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  } else {
    const line = constrainLine(start, current);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(line.x, line.y);
    ctx.stroke();
  }
  ctx.restore();
}

function roundedRect(x: number, y: number, w: number, h: number, radius: number): void {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawResizeHandles(entity: Room | Furniture | Roof): void {
  const handles = [
    { x: entity.x, y: entity.y },
    { x: entity.x + entity.w, y: entity.y },
    { x: entity.x, y: entity.y + entity.h },
    { x: entity.x + entity.w, y: entity.y + entity.h },
  ];
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#2775d1";
  ctx.lineWidth = 2 / view.zoom;
  const size = 8 / view.zoom;
  handles.forEach((handle) => {
    ctx.fillRect(handle.x - size / 2, handle.y - size / 2, size, size);
    ctx.strokeRect(handle.x - size / 2, handle.y - size / 2, size, size);
  });
}

function textLines(label: TextLabel): string[] {
  return label.text.split("\n");
}

// 文字のまとまりの幅と高さ（ワールド座標）。フォントの大きさをそのまま cm として扱う
function measureTextLabel(label: TextLabel): { w: number; h: number } {
  ctx.save();
  ctx.font = `${label.size}px ${TEXT_FONT}`;
  const lines = textLines(label);
  const w = Math.max(label.size * 0.6, ...lines.map((line) => ctx.measureText(line).width));
  ctx.restore();
  return { w, h: lines.length * label.size * TEXT_LINE_HEIGHT };
}

function drawTextLabel(label: TextLabel): void {
  const lines = textLines(label);
  const lineHeight = label.size * TEXT_LINE_HEIGHT;
  ctx.save();
  ctx.translate(label.x, label.y);
  ctx.rotate(degreesToRadians(label.rotation));
  ctx.font = `${label.size}px ${TEXT_FONT}`;
  ctx.fillStyle = solidColor(label.color) ?? INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((line, index) => ctx.fillText(line, 0, (index - (lines.length - 1) / 2) * lineHeight));
  ctx.restore();
  if (state.selectedId === label.id) drawTextSelection(label);
}

function drawTextSelection(label: TextLabel): void {
  const { w, h } = measureTextLabel(label);
  const pad = 4 / view.zoom;
  ctx.save();
  ctx.translate(label.x, label.y);
  ctx.rotate(degreesToRadians(label.rotation));
  ctx.strokeStyle = "#2775d1";
  ctx.lineWidth = 1.5 / view.zoom;
  ctx.setLineDash([4 / view.zoom, 3 / view.zoom]);
  ctx.strokeRect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2);
  ctx.restore();
}

function isPointInTextLabel(point: Point, label: TextLabel): boolean {
  const { w, h } = measureTextLabel(label);
  const angle = degreesToRadians(label.rotation);
  const dx = point.x - label.x;
  const dy = point.y - label.y;
  const localX = dx * Math.cos(angle) + dy * Math.sin(angle);
  const localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
  const pad = 6 / view.zoom;
  return Math.abs(localX) <= w / 2 + pad && Math.abs(localY) <= h / 2 + pad;
}

function focusTextContentInput(): void {
  const input = propertiesPanel.querySelector<HTMLTextAreaElement>("#textContentInput");
  input?.focus();
  input?.select();
}

function drawLockedIndicator(entity: Entity): void {
  let anchor: Point;
  if (entity.type === "room" || entity.type === "roof") {
    anchor = { x: entity.x + entity.w - 16 / view.zoom, y: entity.y + 16 / view.zoom };
  } else if (entity.type === "furniture") {
    anchor = { x: entity.x + entity.w / 2, y: entity.y + entity.h / 2 };
  } else if (entity.type === "shape" || entity.type === "text") {
    anchor = { x: entity.x, y: entity.y };
  } else {
    anchor = midpoint(entity);
  }

  const size = 15 / view.zoom;
  ctx.save();
  ctx.translate(anchor.x, anchor.y);
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.strokeStyle = "#8a5a13";
  ctx.lineWidth = 1.5 / view.zoom;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -size * 0.08, size * 0.24, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = "#8a5a13";
  ctx.fillRect(-size * 0.31, -size * 0.04, size * 0.62, size * 0.45);
  ctx.restore();
}

// ---- 3D ----

function rebuildThree(): void {
  rebuildThreeScene();
  updateUi();
}

function scheduleThreeRefresh(): void {
  if (threeRefreshQueued || PLAN_EDITION) return;
  threeRefreshQueued = true;
  requestAnimationFrame(() => {
    threeRefreshQueued = false;
    rebuildThreeScene();
  });
}

function rebuildThreeScene(): void {
  // 間取り専用版では3Dを作らない
  if (PLAN_EDITION) return;
  threeNeedsRender = true;
  disposeGroup(planGroup);
  const bounds = getGlobalBounds();
  const center = bounds ? { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 } : { x: 0, y: 0 };
  const shift = new THREE.Vector3((threeSceneCenter.x - center.x) * SCALE_3D, 0, (threeSceneCenter.y - center.y) * SCALE_3D);
  camera.position.add(shift);
  controls.target.add(shift);
  threeSceneCenter = center;

  let topVisibleIndex = -1;
  for (let i = state.floors.length - 1; i >= 0; i -= 1) {
    if (!hiddenFloorIds.has(state.floors[i].id)) {
      topVisibleIndex = i;
      break;
    }
  }

  state.floors.forEach((floor, index) => {
    if (hiddenFloorIds.has(floor.id)) return;
    const yBase = floorBaseY(index);
    // 笠木（壁上端のキャップ）は最上階のみ。途中階は上階の壁と面一に continuous させる
    const withCap = index === topVisibleIndex;
    const entities = floor.entities;
    const rooms = entities.filter(isRoom);
    rooms.forEach((roomItem, roomIndex) => addRoom3d(roomItem, center, yBase, index, rooms.slice(roomIndex + 1)));
    entities
      .filter((entity): entity is LinearElement => entity.type === "wall")
      .forEach((wallItem) => addWall3d(wallItem, entities, center, yBase, withCap));
    entities.filter(isShape).forEach((shape) => addShapeWall3d(shape, center, yBase, withCap));
    entities
      .filter((entity): entity is LinearElement => entity.type === "door")
      .forEach((door) => addDoor3d(door, center, yBase));
    entities
      .filter((entity): entity is LinearElement => entity.type === "window")
      .forEach((windowEl) => addWindow3d(windowEl, center, yBase));
    entities.filter(isFurniture).forEach((furnitureItem) => addFurniture3d(furnitureItem, center, yBase));
  });

  if (state.floors.every((floor) => floor.entities.length === 0)) {
    addGroundPlaceholder({ x: 0, y: 0 });
  }

  state.roofs.forEach((roofItem) => addRoof3d(roofItem, center));
  addSubtleGrid(bounds, center);
  if (pendingCameraFrame) {
    frameCamera(bounds);
    pendingCameraFrame = false;
  }
}

function addRoom3d(roomItem: Room, center: Point, yBase: number, floorIndex: number, laterRooms: Room[]): void {
  const ground = isGroundFloor(floorIndex);
  const slabInset = ground ? 0 : WALL_THICKNESS_2D;
  const footprint = (item: Room): Rectangle => ({ x: item.x + slabInset / 2, y: item.y + slabInset / 2, w: Math.max(item.w - slabInset, 10), h: Math.max(item.h - slabInset, 10) });
  // 1Fは地面の上の薄い床。下に地下があるときは、地下の天井とのすき間も床でふさぐ
  const thickness = ground ? 0.08 + (floorIndex > 0 ? FLOOR_SLAB : 0) : FLOOR_SLAB;
  // 床の色に透明度があれば、床の側面も同じだけ透かす
  const alpha = colorAlpha(roomItem.color3d ?? roomItem.color);
  const side = alpha < 1 ? translucentSlabMaterial(alpha) : slabMaterial;
  const group = new THREE.Group();
  for (const rect of visibleRectangles(footprint(roomItem), laterRooms.map(footprint))) {
    const geometry = new THREE.BoxGeometry(rect.w * SCALE_3D, thickness, rect.h * SCALE_3D);
    const mesh = new THREE.Mesh(geometry, [side, side, roomMaterial(roomItem, rect), side, side, side]);
    const pos = to3d(rect.x + rect.w / 2, rect.y + rect.h / 2, center);
    mesh.position.set(pos.x, ground ? 0.08 - thickness / 2 : yBase - thickness / 2, pos.z);
    mesh.receiveShadow = true;
    mesh.castShadow = floorIndex > 0 && alpha >= 1;
    group.add(mesh);
    if (roomItem.surface === "grass") addGrass3d(roomItem, rect, center, ground ? 0.08 : yBase, state.floors[floorIndex].entities);
  }
  if (!group.children.length) return;
  markSelectable(group, roomItem.id);
  planGroup.add(group);
  addSelectionBox(group, roomItem.id);
}

// 草の束1つ分。根元から少しずつ違う向きに傾いた細い葉3枚。高さ1で作り、置くときに縮める
function createGrassTuftGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const baseX = Math.cos(a) * 0.008, baseZ = Math.sin(a) * 0.008;
    const sideX = -Math.sin(a) * 0.005, sideZ = Math.cos(a) * 0.005;
    const lean = 0.022 + i * 0.008;
    positions.push(
      baseX - sideX, 0, baseZ - sideZ,
      baseX + sideX, 0, baseZ + sideZ,
      baseX + Math.cos(a) * lean, 1, baseZ + Math.sin(a) * lean,
    );
    // 根元を暗く、葉先を明るく
    colors.push(0.62, 0.62, 0.62, 0.62, 0.62, 0.62, 1.12, 1.12, 1.12);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  // 法線を上向きにそろえ、横から光が当たっても床と同じ明るさに見せる
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(positions.map((_, index) => (index % 3 === 1 ? 1 : 0)), 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function addGrass3d(roomItem: Room, rect: Rectangle, center: Point, top: number, entities: Entity[]): void {
  const count = Math.min(GRASS_MAX_TUFTS, Math.round(((rect.w * rect.h) / 10000) * GRASS_TUFTS_PER_M2));
  if (count <= 0) return;
  const bare = entities.filter((entity): entity is Furniture => entity.type === "furniture" && GRASS_FREE_KINDS.includes(entity.kind));
  const isBare = (x: number, y: number) => bare.some((item) => {
    // 家具の回転を戻した座標で、池は楕円、それ以外は長方形の内側かどうかを見る
    const angle = degreesToRadians(-item.rotation);
    const dx = x - (item.x + item.w / 2), dy = y - (item.y + item.h / 2);
    const lx = (dx * Math.cos(angle) - dy * Math.sin(angle)) / (item.w / 2);
    const ly = (dx * Math.sin(angle) + dy * Math.cos(angle)) / (item.h / 2);
    return item.kind === "pond" ? lx * lx + ly * ly <= 1 : Math.abs(lx) <= 1 && Math.abs(ly) <= 1;
  });
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, vertexColors: true, side: THREE.DoubleSide });
  makeTranslucent(material, colorAlpha(roomItem.color3d ?? roomItem.color));
  const mesh = new THREE.InstancedMesh(createGrassTuftGeometry(), material, count);
  // 描き直すたびに草の位置が変わらないよう、部屋と範囲から決まる乱数を使う
  const random = seededRandom(`${roomItem.id}:${Math.round(rect.x)}:${Math.round(rect.y)}`);
  const base = new THREE.Color(solidColor(roomItem.color3d ?? roomItem.color));
  const tint = new THREE.Color();
  const placement = new THREE.Object3D();
  let placed = 0;
  for (let i = 0; i < count; i += 1) {
    const x = rect.x + random() * rect.w, y = rect.y + random() * rect.h;
    if (isBare(x, y)) continue;
    const position = to3d(x, y, center);
    placement.position.set(position.x, top, position.z);
    placement.rotation.set(0, random() * Math.PI * 2, 0);
    const spread = 0.8 + random() * 0.6;
    placement.scale.set(spread, 0.05 + random() * 0.08, spread);
    placement.updateMatrix();
    mesh.setMatrixAt(placed, placement.matrix);
    mesh.setColorAt(placed, tint.copy(base).offsetHSL((random() - 0.5) * 0.04, 0, (random() - 0.5) * 0.1));
    placed += 1;
  }
  mesh.count = placed;
  // 草は見た目だけ。クリックが下の床に届くよう、当たり判定から外す
  mesh.raycast = () => {};
  mesh.receiveShadow = true;
  planGroup.add(mesh);
}

function seededRandom(key: string): () => number {
  let seed = 2166136261;
  for (let i = 0; i < key.length; i += 1) seed = Math.imul(seed ^ key.charCodeAt(i), 16777619);
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function addWall3d(wallItem: LinearElement, entities: Entity[], center: Point, yBase: number, withCap = true): void {
  wallSections(wallItem, entities).forEach((section) => {
    const segment = segmentInterval(wallItem, section.from, section.to);
    addStraightWall3d(segment, center, yBase, wallItem.id, true, section.bottom, section.top, withCap);
  });
}

function addStraightWall3d(
  wallItem: LinearElement,
  center: Point,
  yBase: number,
  entityId = wallItem.id,
  showSelection = true,
  yFrom = 0,
  yTo = WALL_HEIGHT,
  withCap = true,
): void {
  const length = distance(wallItem) * SCALE_3D;
  // 上階の壁は床スラブの厚みぶん下へ延長し、下階の壁と外面が連続するようにする
  // いちばん下の階でなければ、下の階の壁の上端まで伸ばす（地下があるときの1Fも同じ）
  const bottomExtension = yBase > floorBaseY(0) + 1e-6 && yFrom === 0 ? FLOOR_SLAB : 0;
  const height = yTo - yFrom + bottomExtension;
  if (length <= 0.02 || height <= 0.02) return;
  const thickness = WALL_THICKNESS_2D * SCALE_3D;
  const angle = Math.atan2(wallItem.y2 - wallItem.y1, wallItem.x2 - wallItem.x1);
  const customWallColor = wallItem.color3d ?? wallItem.color;
  const bodyMaterial = customWallColor ? coloredMaterial(customWallColor, 0.78) : wallMaterial;
  const geometry = new THREE.BoxGeometry(length, height, thickness);
  const mesh = new THREE.Mesh(geometry, bodyMaterial);
  const mid = midpoint(wallItem);
  const pos = to3d(mid.x, mid.y, center);
  mesh.position.set(pos.x, yBase + yFrom - bottomExtension + height / 2, pos.z);
  mesh.rotation.y = -angle;
  // 透明度のある色の壁は、ガラスと同じく影を落とさない
  mesh.castShadow = !bodyMaterial.transparent;
  mesh.receiveShadow = true;
  markSelectable(mesh, entityId);
  planGroup.add(mesh);

  if (withCap && yTo >= WALL_HEIGHT - 0.001) {
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(length + 0.01, 0.06, thickness + 0.01),
      customWallColor ? bodyMaterial : wallCapMaterial,
    );
    cap.position.set(pos.x, yBase + WALL_HEIGHT + 0.03, pos.z);
    cap.rotation.y = -angle;
    cap.castShadow = !cap.material.transparent;
    markSelectable(cap, entityId);
    planGroup.add(cap);
  }
  if (showSelection) {
    addSelectionBox(mesh, entityId);
  }
}

function addShapeWall3d(shape: Shape, center: Point, yBase: number, withCap = true): void {
  if (shape.kind === "polygon") {
    const points = polygonPoints(shape);
    points.forEach((vertex, index) => {
      const next = points[(index + 1) % points.length];
      const segment: LinearElement = {
        id: shape.id,
        type: "wall",
        x1: vertex.x,
        y1: vertex.y,
        x2: next.x,
        y2: next.y,
        color: shape.color,
        color3d: shape.color3d,
      };
      addStraightWall3d(segment, center, yBase, shape.id, false, 0, WALL_HEIGHT, withCap);
    });
    return;
  }
  const start = shape.kind === "circle" ? 0 : shape.startAngle;
  const sweep = shape.kind === "circle" ? Math.PI * 2 : normalizeAngle(shape.endAngle - shape.startAngle);
  const segmentCount = Math.max(12, Math.ceil((shape.r * sweep) / 24));
  for (let index = 0; index < segmentCount; index += 1) {
    const a1 = start + (sweep * index) / segmentCount;
    const a2 = start + (sweep * (index + 1)) / segmentCount;
    const segment: LinearElement = {
      id: shape.id,
      type: "wall",
      x1: shape.x + Math.cos(a1) * shape.r,
      y1: shape.y + Math.sin(a1) * shape.r,
      x2: shape.x + Math.cos(a2) * shape.r,
      y2: shape.y + Math.sin(a2) * shape.r,
      color: shape.color,
      color3d: shape.color3d,
    };
    addStraightWall3d(segment, center, yBase, shape.id, false, 0, WALL_HEIGHT, withCap);
  }
}

function addDoor3d(door: LinearElement, center: Point, yBase: number): void {
  addOpening3d(door, center, yBase);
}

function addWindow3d(windowEl: LinearElement, center: Point, yBase: number): void {
  addOpening3d(windowEl, center, yBase);
}

function addOpening3d(item: LinearElement, center: Point, yBase: number): void {
  if (item.type === "wall") return;
  const group = buildOpeningModel({ ...item, type: item.type, length: distance(item) * SCALE_3D, floorTop: yBase === 0 ? 0.08 : 0 });
  const mid = midpoint(item);
  const position = to3d(mid.x, mid.y, center);
  group.position.set(position.x, yBase, position.z);
  group.rotation.y = -lineAngle(item);
  markSelectable(group, item.id);
  planGroup.add(group);
  addSelectionBox(group, item.id);
}

// ---- 3D furniture ----

function addFurniture3d(furnitureItem: Furniture, center: Point, yBase: number): void {
  const floorTop = yBase === 0 ? 0.08 : 0;
  const group = buildFurnitureModel({ ...furnitureItem, rise: FLOOR_SPACING - floorTop });
  if (furnitureItem.kind === "evidenceMarker") applyMarkerLabel(group, furnitureItem);
  if (furnitureItem.kind === "paint") applyPaintTexture(group, furnitureItem);
  const pos = to3d(furnitureItem.x + furnitureItem.w / 2, furnitureItem.y + furnitureItem.h / 2, center);
  group.position.set(pos.x, yBase + floorTop, pos.z);
  group.rotation.y = (-furnitureItem.rotation * Math.PI) / 180;
  if (furnitureItem.flip) group.scale.x *= -1;
  markSelectable(group, furnitureItem.id);
  planGroup.add(group);
  addSelectionBox(group, furnitureItem.id);
}

// ---- Roof ----

function buildRoofGeometry(width: number, depth: number, height: number, ridgeInset: number): THREE.BufferGeometry {
  const w2 = width / 2;
  const d2 = depth / 2;
  const inset = Math.min(ridgeInset, w2 * 0.999);
  const A = [-w2, 0, -d2];
  const B = [w2, 0, -d2];
  const C = [w2, 0, d2];
  const D = [-w2, 0, d2];
  const R1 = [-w2 + inset, height, 0];
  const R2 = [w2 - inset, height, 0];
  const triangles = [
    A, R2, B,
    A, R1, R2,
    C, R1, D,
    C, R2, R1,
    A, D, R1,
    C, B, R2,
    A, B, C,
    A, C, D,
  ];
  const positions = new Float32Array(triangles.flat());
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function addRoof3d(roofItem: Roof, center: Point): void {
  if (!roofVisible3d) return;
  const topIndex = roofItem.floorId ? state.floors.findIndex((floor) => floor.id === roofItem.floorId) : state.floors.length - 1;
  if (topIndex < 0 || hiddenFloorIds.has(state.floors[topIndex].id)) return;
  const width = roofItem.w * SCALE_3D;
  const depth = roofItem.h * SCALE_3D;
  const pos = to3d(roofItem.x + roofItem.w / 2, roofItem.y + roofItem.h / 2, center);
  const topY = floorBaseY(topIndex) + WALL_HEIGHT + 0.06;

  if (roofItem.kind === "flat") {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.16, depth), roofMaterial);
    mesh.position.set(pos.x, topY + 0.08, pos.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    markSelectable(mesh, roofItem.id);
    planGroup.add(mesh);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMaterial);
    edge.position.copy(mesh.position);
    edge.userData.ignoreSelection = true;
    planGroup.add(edge);
    addSelectionBox(mesh, roofItem.id);
    return;
  }

  const long = Math.max(width, depth);
  const short = Math.min(width, depth);
  const height = short * (roofItem.kind === "gable" ? 0.34 : 0.3);
  const ridgeInset = roofItem.kind === "gable" ? 0 : short / 2;
  const geometry = buildRoofGeometry(long, short, height, ridgeInset);
  const mesh = new THREE.Mesh(geometry, roofMaterial);
  mesh.position.set(pos.x, topY, pos.z);
  if (depth > width) {
    mesh.rotation.y = Math.PI / 2;
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  markSelectable(mesh, roofItem.id);
  planGroup.add(mesh);

  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 12), edgeMaterial);
  edge.position.copy(mesh.position);
  edge.rotation.copy(mesh.rotation);
  edge.userData.ignoreSelection = true;
  planGroup.add(edge);
  addSelectionBox(mesh, roofItem.id);
}

function markSelectable(object: THREE.Object3D, entityId: string): void {
  object.userData.entityId = entityId;
  object.traverse((child) => {
    child.userData.entityId = entityId;
  });
}

function addSelectionBox(object: THREE.Object3D, entityId: string): void {
  if (state.selectedId !== entityId) return;
  const selected = findEntity(entityId);
  const helper = new THREE.BoxHelper(object, selected && isLocked(selected) ? 0x9b6714 : 0x2775d1);
  helper.userData.ignoreSelection = true;
  planGroup.add(helper);
}

function entityIdFromObject(object: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (!current.userData.ignoreSelection && typeof current.userData.entityId === "string") {
      return current.userData.entityId;
    }
    current = current.parent;
  }
  return null;
}

function addGroundPlaceholder(center: Point): void {
  const geometry = new THREE.BoxGeometry(7, 0.05, 5);
  const material = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.8 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(center.x, 0, center.y);
  mesh.receiveShadow = true;
  planGroup.add(mesh);
}

function addSubtleGrid(bounds: Bounds | null, center: Point): void {
  const size = bounds ? Math.max(bounds.w, bounds.h) * SCALE_3D + 4 : 10;
  const grid = new THREE.GridHelper(size, Math.max(8, Math.round(size)), 0xb9c2cd, 0xdde3eb);
  grid.position.y = 0.012;
  grid.position.x = to3d(center.x, center.y, center).x;
  grid.position.z = to3d(center.x, center.y, center).z;
  planGroup.add(grid);
}

function frameCamera(bounds: Bounds | null): void {
  const size = bounds ? Math.max(bounds.w, bounds.h) * SCALE_3D : 7;
  const buildingHeight = (state.floors.length - basementCount()) * FLOOR_SPACING;
  const rect = threeCanvas.getBoundingClientRect();
  const aspect = rect.height > 0 ? rect.width / rect.height : 1;
  const portraitScale = aspect < 1 ? 1 / Math.max(aspect, 0.45) : 1;
  const distanceToFit = clamp(Math.max(size * 1.4 * portraitScale, buildingHeight * 2.2), 6, 30);
  camera.position.set(distanceToFit * 0.9, distanceToFit * 0.72, distanceToFit);
  controls.target.set(0, Math.min(buildingHeight * 0.32, 2.4), 0);
  controls.update();
}

function render3dOnce(): void {
  const rect = threeCanvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  // 寄ったときに手前が切れず、引いたときに奥が消えないよう、見える範囲をカメラの距離に合わせる
  const distance = camera.position.distanceTo(controls.target);
  camera.near = clamp(distance * 0.002, 0.0005, 0.1);
  camera.far = Math.max(distance * 200, 1000);
  camera.updateProjectionMatrix();
  controls.update();
  renderer.render(scene, camera);
  threeNeedsRender = false;
}

function animate3d(): void {
  requestAnimationFrame(animate3d);
  if (viewMode === "plan" || document.hidden) return;
  controls.update();
  if (threeNeedsRender) render3dOnce();
}

function redrawAll(rebuild = true): void {
  render2d();
  if (rebuild) rebuildThree();
  updateUi();
}

function updateUi(): void {
  scheduleViewStateSave();
  renderGhostFloorOptions();
  updateStats();
  updatePropertiesPanel();
  renderFloorTabs();
  renderFloorVisibility();
  renderRoofList();
  updateRoofToggle2d();
  document.querySelector<HTMLButtonElement>("#undoButton")?.toggleAttribute("disabled", historyIndex <= 0);
  document.querySelector<HTMLButtonElement>("#redoButton")?.toggleAttribute("disabled", historyIndex >= history.length - 1);
}

function updateStats(): void {
  const entities = activeEntities();
  const rooms = entities.filter(isRoom).length;
  const walls = entities.filter((entity) => entity.type === "wall").length;
  const furnitureCount = entities.filter(isFurniture).length;
  planStats.textContent = `${rooms}室 / 壁${walls} / 家具${furnitureCount}`;
  // ボタンが並んで欄が狭いときは省略されるので、マウスを乗せると全部読めるようにする
  planStats.title = planStats.textContent;
  const totalParts = state.floors.reduce((sum, floor) => sum + floor.entities.length, 0);
  const basements = basementCount();
  const stories = basements ? `地上${state.floors.length - basements}階・地下${basements}階` : `${state.floors.length}階建て`;
  threeStats.textContent = `${stories}・部材${totalParts}・屋根${state.roofs.length}`;
}

function updatePropertiesPanel(): void {
  const selected = state.selectedId ? findEntity(state.selectedId) : null;
  if (!selected && activeTool === "paint") {
    propertiesPanel.innerHTML = `<div class="property-grid">
        <p class="empty-state">ペン: 2Dの上をドラッグすると、この色で描けます。クリックで点、「囲んで塗る」なら囲んだ所を塗りつぶします。</p>
        ${penControlsHtml("pen", penSettings.color, penSettings.brush, penSettings.filled)}
      </div>`;
    bindPenControls();
    return;
  }
  if (!selected) {
    propertiesPanel.innerHTML = `<p class="empty-state">選択ツールで部屋・壁・家具を選ぶと、名前や寸法を調整できます。家具は R キーで回転、F キーで反転します。</p>`;
    return;
  }
  const placementDisabled = isLocked(selected) ? "disabled" : "";
  const lockRow = `<label class="check placement-lock"><input id="entityLockedInput" type="checkbox" ${isLocked(selected) ? "checked" : ""} /> 配置を固定（Lキー）</label>`;

  if (selected.type === "roof") {
    const roofIndex = state.roofs.findIndex((item) => item.id === selected.id);
    propertiesPanel.innerHTML = `
      <div class="property-grid">
        ${lockRow}
        <p class="empty-state">屋根 ${roofIndex + 1}</p>
        <label>設置階<select id="roofFloorInput" ${placementDisabled}>${state.floors.map((floor) => `<option value="${escapeHtml(floor.id)}" ${floor.id === (selected.floorId ?? state.floors[state.floors.length - 1].id) ? "selected" : ""}>${floor.name}</option>`).join("")}</select></label>
        <label>種類
          <select id="roofKindInput" ${placementDisabled}>
            <option value="gable" ${selected.kind === "gable" ? "selected" : ""}>切妻</option>
            <option value="hip" ${selected.kind === "hip" ? "selected" : ""}>寄棟</option>
            <option value="flat" ${selected.kind === "flat" ? "selected" : ""}>陸屋根</option>
          </select>
        </label>
        <div class="two-col">
          <label>幅 cm<input id="roofWInput" type="number" min="40" step="20" value="${selected.w}" ${placementDisabled} /></label>
          <label>奥行 cm<input id="roofHInput" type="number" min="40" step="20" value="${selected.h}" ${placementDisabled} /></label>
        </div>
        <div class="two-col">
          <label>位置 X<input id="roofXInput" type="number" step="20" value="${selected.x}" ${placementDisabled} /></label>
          <label>位置 Y<input id="roofYInput" type="number" step="20" value="${selected.y}" ${placementDisabled} /></label>
        </div>
        <button type="button" class="prop-button" id="roofRotateButton" ${placementDisabled}>幅と奥行を入れ替える（Rキー）</button>
        <button type="button" class="prop-button danger-button" id="roofDeleteButton" ${placementDisabled}>この屋根を削除</button>
      </div>
    `;
    bindEntityLock(selected);
    bindSelect("#roofFloorInput", (value) => {
      if (state.floors.some((floor) => floor.id === value)) selected.floorId = value;
    });
    bindSelect("#roofKindInput", (value) => (selected.kind = value as RoofKind));
    bindNumber("#roofWInput", (value) => (selected.w = Math.max(GRID * 2, snap(value))));
    bindNumber("#roofHInput", (value) => (selected.h = Math.max(GRID * 2, snap(value))));
    bindNumber("#roofXInput", (value) => (selected.x = snap(value)));
    bindNumber("#roofYInput", (value) => (selected.y = snap(value)));
    bindButton("#roofRotateButton", () => rotateEntity(selected, 90));
    bindButton("#roofDeleteButton", () => {
      removeEntityById(selected.id);
      state.selectedId = null;
    });
    return;
  }

  if (selected.type === "room") {
    propertiesPanel.innerHTML = `
      <div class="property-grid">
        ${lockRow}
        <label>名前<input id="roomNameInput" value="${escapeHtml(selected.name)}" placeholder="なし（2Dに文字を出さない）" /></label>
        <label>床材<select id="roomSurfaceInput">${(Object.keys(SURFACE_DEFS) as RoomSurface[]).map((surface) => `<option value="${surface}" ${surface === (selected.surface ?? "plain") ? "selected" : ""}>${SURFACE_DEFS[surface].label}</option>`).join("")}</select></label>
        <div class="two-col">
          <label>幅 cm<input id="roomWInput" type="number" min="40" step="20" value="${selected.w}" ${placementDisabled} /></label>
          <label>奥行 cm<input id="roomHInput" type="number" min="40" step="20" value="${selected.h}" ${placementDisabled} /></label>
        </div>
        ${colorField("roomColorInput", "色 2D", selected.color)}
        ${PLAN_EDITION ? "" : colorField("roomColor3dInput", "色 3D", selected.color3d ?? selected.color)}
        <button type="button" class="prop-button" id="roomRotateButton" ${placementDisabled}>90°回転（Rキー）</button>
      </div>
    `;
    bindEntityLock(selected);
    bindInput("#roomNameInput", (value) => (selected.name = value));
    bindSelect("#roomSurfaceInput", (value) => {
      if (!isRoomSurface(value)) return;
      selected.surface = value;
      // 床材を変えても、カラーコードで決めた透明度はそのまま
      selected.color3d = withAlpha(SURFACE_DEFS[value].color, colorAlpha(selected.color3d ?? selected.color));
      selected.color = withAlpha(SURFACE_DEFS[value].color, colorAlpha(selected.color));
    });
    bindNumber("#roomWInput", (value) => (selected.w = Math.max(GRID * 2, snap(value))));
    bindNumber("#roomHInput", (value) => (selected.h = Math.max(GRID * 2, snap(value))));
    bindColor("#roomColorInput", (value) => (selected.color = value ?? SURFACE_DEFS[selected.surface ?? "plain"].color));
    bindColor("#roomColor3dInput", (value) => (selected.color3d = value));
    bindButton("#roomRotateButton", () => rotateEntity(selected, 90));
    return;
  }

  if (isLinear(selected)) {
    const slidingDoor = selected.type === "door" && selected.doorStyle === "sliding";
    const typeLabel = selected.type === "wall" ? "壁" : selected.type === "door" ? (slidingDoor ? "引き戸" : "ドア") : "窓";
    const default3d = selected.type === "wall" ? "#f4f1ec" : selected.type === "door" ? "#99683d" : "#dfe5ea";
    const doorStyleRow =
      selected.type === "door"
        ? `<label>扉の種類
            <select id="doorStyleInput">
              <option value="swing" ${slidingDoor ? "" : "selected"}>開き戸</option>
              <option value="sliding" ${slidingDoor ? "selected" : ""}>引き戸</option>
            </select>
          </label>`
        : "";
    const doorFlipRow =
      selected.type === "door"
        ? `<label class="check"><input id="doorFlipInput" type="checkbox" ${selected.flip ? "checked" : ""} ${placementDisabled} /> ${slidingDoor ? "重なり" : "開き"}を反転（Fキー）</label>`
        : "";
    const mullionRow =
      selected.type === "window"
        ? `<label class="check"><input id="windowMullionInput" type="checkbox" ${selected.mullion ? "checked" : ""} /> 中央に区切り</label>`
        : "";
    propertiesPanel.innerHTML = `
      <div class="property-grid">
        ${lockRow}
        <p class="empty-state">${typeLabel}</p>
        ${doorStyleRow}
        <div class="two-col">
          <label>長さ cm<input id="lineLengthInput" type="number" min="20" step="20" value="${Math.round(distance(selected))}" ${placementDisabled} /></label>
          <label>角度 °<input id="lineAngleInput" type="number" step="5" value="${Math.round(radiansToDegrees(lineAngle(selected)))}" ${placementDisabled} /></label>
        </div>
        <div class="two-col">
          <label>始点X<input id="lineXInput" type="number" step="20" value="${selected.x1}" ${placementDisabled} /></label>
          <label>始点Y<input id="lineYInput" type="number" step="20" value="${selected.y1}" ${placementDisabled} /></label>
        </div>
        <button type="button" class="prop-button" id="lineRotateButton" ${placementDisabled}>90°回転（Rキー）</button>
        ${doorFlipRow}
        ${mullionRow}
        ${colorField("lineColorInput", "色 2D", selected.color ?? INK)}
        ${PLAN_EDITION ? "" : colorField("lineColor3dInput", "色 3D", selected.color3d ?? selected.color ?? default3d)}
      </div>
    `;
    bindEntityLock(selected);
    bindNumber("#lineLengthInput", (value) => {
      const newLength = Math.max(GRID, Math.round(value));
      const angle = lineAngle(selected);
      selected.x2 = Math.round(selected.x1 + Math.cos(angle) * newLength);
      selected.y2 = Math.round(selected.y1 + Math.sin(angle) * newLength);
    });
    bindNumber("#lineAngleInput", (value) => rotateLineTo(selected, value));
    bindButton("#lineRotateButton", () => rotateEntity(selected, 90));
    bindSelect("#doorStyleInput", (value) => (selected.doorStyle = value as LinearElement["doorStyle"]));
    bindNumber("#lineXInput", (value) => {
      const dx = snap(value) - selected.x1;
      selected.x1 += dx;
      selected.x2 += dx;
    });
    bindNumber("#lineYInput", (value) => {
      const dy = snap(value) - selected.y1;
      selected.y1 += dy;
      selected.y2 += dy;
    });
    bindCheckbox("#doorFlipInput", (checked) => (selected.flip = checked));
    bindCheckbox("#windowMullionInput", (checked) => (selected.mullion = checked));
    bindColor("#lineColorInput", (value) => (selected.color = value));
    bindColor("#lineColor3dInput", (value) => (selected.color3d = value));
    return;
  }

  if (selected.type === "text") {
    const label = selected;
    propertiesPanel.innerHTML = `
      <div class="property-grid">
        ${lockRow}
        <label>文字（改行もできます）<textarea id="textContentInput" rows="3" maxlength="${MAX_TEXT_LENGTH}" ${placementDisabled}>${escapeHtml(label.text)}</textarea></label>
        <div class="two-col">
          <label>大きさ cm<input id="textSizeInput" type="number" min="5" max="500" step="2" value="${label.size}" ${placementDisabled} /></label>
          <label>回転 °<input id="textRotationInput" type="number" step="5" value="${label.rotation}" ${placementDisabled} /></label>
        </div>
        ${colorField("textColorInput", "色", label.color ?? INK, placementDisabled)}
      </div>
    `;
    bindEntityLock(label);
    const content = propertiesPanel.querySelector<HTMLTextAreaElement>("#textContentInput");
    // 入力中はその場で描き直し、確定（欄から出る）したときに履歴へ積む。空にしたら文字ごと消す
    content?.addEventListener("input", () => {
      label.text = content.value;
      render2d();
    });
    content?.addEventListener("change", () => {
      if (!content.value.trim()) {
        removeEntityById(label.id);
        state.selectedId = null;
      } else {
        label.text = content.value;
      }
      commitState();
      redrawAll();
    });
    bindNumber("#textSizeInput", (value) => (label.size = clamp(Number.isFinite(value) ? value : DEFAULT_TEXT_SIZE, 5, 500)));
    bindNumber("#textRotationInput", (value) => (label.rotation = Number.isFinite(value) ? value % 360 : 0));
    bindColor("#textColorInput", (value) => (label.color = value));
    return;
  }

  if (selected.type === "shape") {
    const selectedShape = selected;
    const arcRows =
      selectedShape.kind === "arc"
        ? `<div class="two-col">
            <label>開始 °<input id="shapeStartInput" type="number" step="5" value="${Math.round(radiansToDegrees(selectedShape.startAngle))}" ${placementDisabled} /></label>
            <label>終了 °<input id="shapeEndInput" type="number" step="5" value="${Math.round(radiansToDegrees(selectedShape.endAngle))}" ${placementDisabled} /></label>
          </div>`
        : "";
    const polygonRows =
      selectedShape.kind === "polygon"
        ? `<div class="two-col">
            <label>辺の数<input id="shapeSidesInput" type="number" min="3" max="12" step="1" value="${clamp(Math.round(selectedShape.sides ?? 6), 3, 12)}" ${placementDisabled} /></label>
            <label>回転 °<input id="shapeRotationInput" type="number" step="5" value="${Math.round(radiansToDegrees(selectedShape.rotation ?? 0))}" ${placementDisabled} /></label>
          </div>`
        : "";
    propertiesPanel.innerHTML = `
      <div class="property-grid">
        ${lockRow}
        <label>種類
          <select id="shapeKindInput" ${placementDisabled}>
            <option value="circle" ${selectedShape.kind === "circle" ? "selected" : ""}>円</option>
            <option value="arc" ${selectedShape.kind === "arc" ? "selected" : ""}>円弧</option>
            <option value="polygon" ${selectedShape.kind === "polygon" ? "selected" : ""}>多角形</option>
          </select>
        </label>
        <label>半径 cm<input id="shapeRadiusInput" type="number" min="20" step="20" value="${selectedShape.r}" ${placementDisabled} /></label>
        ${arcRows}
        ${polygonRows}
        ${colorField("shapeColorInput", "色 2D", selectedShape.color ?? INK)}
        ${PLAN_EDITION ? "" : colorField("shapeColor3dInput", "色 3D", selectedShape.color3d ?? selectedShape.color ?? "#f4f1ec")}
      </div>
    `;
    bindEntityLock(selectedShape);
    bindSelect("#shapeKindInput", (value) => {
      selectedShape.kind = value as ShapeKind;
      if (selectedShape.kind === "circle") {
        selectedShape.startAngle = 0;
        selectedShape.endAngle = Math.PI * 2;
      }
      if (selectedShape.kind === "polygon") {
        selectedShape.sides = selectedShape.sides ?? 6;
        selectedShape.rotation = selectedShape.rotation ?? 0;
      }
    });
    bindNumber("#shapeRadiusInput", (value) => (selectedShape.r = Math.max(GRID, snap(value))));
    bindNumber("#shapeStartInput", (value) => (selectedShape.startAngle = degreesToRadians(value)));
    bindNumber("#shapeEndInput", (value) => (selectedShape.endAngle = degreesToRadians(value)));
    bindNumber("#shapeSidesInput", (value) => (selectedShape.sides = clamp(Math.round(value), 3, 12)));
    bindNumber("#shapeRotationInput", (value) => (selectedShape.rotation = degreesToRadians(value)));
    bindColor("#shapeColorInput", (value) => (selectedShape.color = value));
    bindColor("#shapeColor3dInput", (value) => (selectedShape.color3d = value));
    return;
  }

  const selectedFurniture = selected as Furniture;
  if (selectedFurniture.kind === "paint") {
    propertiesPanel.innerHTML = `<div class="property-grid">
        ${lockRow}
        <p class="empty-state">ペンで描いた${selectedFurniture.filled ? "塗り" : "線"}</p>
        ${penControlsHtml("paint", selectedFurniture.color ?? PEN_DEFAULT_COLOR, selectedFurniture.brush ?? DEFAULT_BRUSH, selectedFurniture.filled === true, placementDisabled)}
      </div>`;
    bindEntityLock(selectedFurniture);
    bindPaintControls(selectedFurniture);
    return;
  }
  const kindOptions = [...FURNITURE_CATEGORIES, { label: "階段", kinds: STAIR_KINDS }].map(
    (category) =>
      `<optgroup label="${category.label}">` +
      category.kinds
        .map((kind) => `<option value="${kind}" ${kind === selectedFurniture.kind ? "selected" : ""}>${FURNITURE_DEFS[kind].label}</option>`)
        .join("") +
      `</optgroup>`,
  ).join("");
  const defaultHeight = FURNITURE_DEFS[selectedFurniture.kind].height;
  const markerRow = selectedFurniture.kind === "evidenceMarker"
    ? `<label>番号（印に書く文字。${MAX_MARKER_LABEL}文字まで）<input id="markerLabelInput" value="${escapeHtml(selectedFurniture.markerLabel ?? "")}" maxlength="${MAX_MARKER_LABEL}" autocomplete="off" /></label>`
    : "";
  const heightRow = defaultHeight !== undefined && !PLAN_EDITION
    ? `<label>高さ cm<input id="furnitureHeightInput" type="number" min="${MIN_FURNITURE_HEIGHT}" max="${MAX_FURNITURE_HEIGHT}" step="10" value="${selectedFurniture.height ?? defaultHeight}" ${placementDisabled} /></label>`
    : "";
  // 2Dの記号だけのデザインは、3Dが標準の形のままになることを名前に添える
  const only2d = FURNITURE_VARIANTS_2D_ONLY[selectedFurniture.kind] ?? [];
  const symbolLabels = ["標準", ...(SYMBOL_VARIANTS[selectedFurniture.kind] ?? []).map((variant, index) => (only2d.includes(index + 1) ? `${variant.label}（2Dの記号のみ・3Dは標準）` : variant.label))];
  const currentSymbol = selectedFurniture.symbol ?? 0;
  // 見た目だけの設定なので、配置を固定していても選べる
  const symbolPicker = symbolLabels.length > 1
    ? `<div class="symbol-picker">
        <span>デザイン（2Dの記号と3Dの形。Vキーで切り替え）</span>
        <div class="symbol-options" role="radiogroup" aria-label="デザイン">
          ${symbolLabels.map((label, index) => `<button type="button" class="symbol-option${index === currentSymbol ? " is-active" : ""}" data-symbol="${index}" role="radio" aria-checked="${index === currentSymbol}" title="${label}" aria-label="${label}"><canvas></canvas></button>`).join("")}
        </div>
      </div>`
    : "";
  propertiesPanel.innerHTML = `
    <div class="property-grid">
      ${lockRow}
      <label>種類
        <select id="furnitureKindInput" ${placementDisabled}>${kindOptions}</select>
      </label>
      ${symbolPicker}
      <div class="two-col">
        <label>幅 cm<input id="furnitureWInput" type="number" min="20" step="20" value="${selectedFurniture.w}" ${placementDisabled} /></label>
        <label>奥行 cm<input id="furnitureHInput" type="number" min="20" step="20" value="${selectedFurniture.h}" ${placementDisabled} /></label>
      </div>
      ${heightRow}
      ${markerRow}
      ${isPersonKind(selectedFurniture.kind) ? personEditorHtml(selectedFurniture, placementDisabled) : ""}
      ${selectedFurniture.kind === "footprints" ? footprintEditorHtml(selectedFurniture, placementDisabled) : ""}
      ${selectedFurniture.kind === "brokenGlass" ? shardEditorHtml(selectedFurniture, placementDisabled) : ""}
      <label>回転（R: 90° / Shift+R: 15°）<input id="furnitureRotationInput" type="number" step="5" value="${selectedFurniture.rotation}" ${placementDisabled} /></label>
      <label class="check"><input id="furnitureFlipInput" type="checkbox" ${selectedFurniture.flip ? "checked" : ""} ${placementDisabled} /> 左右反転（Fキー）</label>
      ${colorField("furnitureColorInput", "色 2D", selectedFurniture.color ?? MARK_FILLS[selectedFurniture.kind] ?? INK)}
      ${PLAN_EDITION ? "" : colorField("furnitureColor3dInput", "色 3D", selectedFurniture.color3d ?? selectedFurniture.color ?? "#b9c0c8")}
    </div>
  `;
  bindEntityLock(selectedFurniture);
  bindSelect("#furnitureKindInput", (value) => {
    const kind = value as FurnitureKind;
    const def = FURNITURE_DEFS[kind];
    selectedFurniture.kind = kind;
    selectedFurniture.w = def.w;
    selectedFurniture.h = def.h;
    delete selectedFurniture.path;
    delete selectedFurniture.stride;
    delete selectedFurniture.pose;
    setFurnitureSymbol(selectedFurniture, lastSymbolByKind[kind] ?? 0);
    delete selectedFurniture.height;
    if (kind !== "evidenceMarker") delete selectedFurniture.markerLabel;
    else selectedFurniture.markerLabel ??= nextMarkerLabel();
  });
  bindInput("#markerLabelInput", (value) => (selectedFurniture.markerLabel = value.trim().slice(0, MAX_MARKER_LABEL)));
  if (isPersonKind(selectedFurniture.kind)) bindPersonEditor(selectedFurniture);
  if (selectedFurniture.kind === "footprints") bindFootprintEditor(selectedFurniture);
  if (selectedFurniture.kind === "brokenGlass") bindShardEditor(selectedFurniture);
  bindNumber("#furnitureHeightInput", (value) => {
    const height = clamp(Math.round(value), MIN_FURNITURE_HEIGHT, MAX_FURNITURE_HEIGHT);
    if (height === defaultHeight) delete selectedFurniture.height;
    else selectedFurniture.height = height;
  });
  propertiesPanel.querySelectorAll<HTMLButtonElement>(".symbol-option").forEach((button) => {
    const symbol = Number(button.dataset.symbol);
    const canvas = button.querySelector("canvas");
    if (canvas) drawSymbolPreview(canvas, selectedFurniture, symbol);
    button.addEventListener("click", () => {
      setFurnitureSymbol(selectedFurniture, symbol);
      commitState();
      redrawAll();
    });
  });
  bindNumber("#furnitureWInput", (value) => (selectedFurniture.w = Math.max(GRID, snap(value))));
  bindNumber("#furnitureHInput", (value) => (selectedFurniture.h = Math.max(GRID, snap(value))));
  bindNumber("#furnitureRotationInput", (value) => (selectedFurniture.rotation = value % 360));
  bindCheckbox("#furnitureFlipInput", (checked) => (selectedFurniture.flip = checked));
  bindColor("#furnitureColorInput", (value) => (selectedFurniture.color = value));
  bindColor("#furnitureColor3dInput", (value) => (selectedFurniture.color3d = value));
}

// 色の欄。見本から選ぶか、カラーコードを入れる。末尾に2桁足すと透明度（00で透明〜ffで不透明。#2775d180 で半分透ける）。
// カラーコードを空にすると標準の色に戻す
function colorField(id: string, label: string, value: string | undefined, disabled = ""): string {
  const parsed = parseColorCode(value);
  return `<div class="color-field">
      <span>${label}</span>
      <span class="color-code-row">
        <span class="color-swatch" style="--swatch-alpha: ${parsed?.alpha ?? 1}">
          <input id="${id}" type="color" value="${parsed?.rgb ?? INK}" title="${label}を見本から選ぶ" aria-label="${label}を見本から選ぶ" ${disabled} />
        </span>
        <input id="${id}Code" type="text" value="${parsed?.code ?? ""}" placeholder="#RRGGBB（透かすなら #RRGGBB80）" maxlength="9" spellcheck="false" autocomplete="off"
          title="カラーコード（#RRGGBB）。末尾に2桁足すと透明度になります（00で透明〜ffで不透明）。空にすると標準の色に戻ります" aria-label="${label}のカラーコード" ${disabled} />
      </span>
    </div>`;
}

// 見本で選び直しても、カラーコードの透明度はそのまま残す
function bindColor(selector: string, update: (value: string | undefined) => void): void {
  const picker = propertiesPanel.querySelector<HTMLInputElement>(selector);
  const code = propertiesPanel.querySelector<HTMLInputElement>(`${selector}Code`);
  if (!picker || !code) return;
  const apply = (value: string | undefined) => {
    update(value);
    commitState();
    redrawAll();
  };
  picker.addEventListener("change", () => apply(withAlpha(picker.value, colorAlpha(code.value))));
  code.addEventListener("input", () => {
    if (!code.value.trim() || parseColorCode(code.value)) code.classList.remove("is-invalid");
  });
  code.addEventListener("change", () => {
    const value = code.value.trim();
    const parsed = parseColorCode(value);
    if (value && !parsed) {
      code.classList.add("is-invalid");
      return;
    }
    apply(parsed?.code);
  });
}

function bindEntityLock(entity: Entity): void {
  bindCheckbox("#entityLockedInput", (checked) => {
    entity.locked = checked;
  });
}

function bindInput(selector: string, update: (value: string) => void): void {
  const input = propertiesPanel.querySelector<HTMLInputElement>(selector);
  input?.addEventListener("change", () => {
    update(input.value);
    commitState();
    redrawAll();
  });
}

function bindNumber(selector: string, update: (value: number) => void): void {
  const input = propertiesPanel.querySelector<HTMLInputElement>(selector);
  input?.addEventListener("change", () => {
    if (input.value.trim() === "" || !Number.isFinite(Number(input.value))) {
      updatePropertiesPanel();
      return;
    }
    update(Number(input.value));
    commitState();
    redrawAll();
  });
}

function bindSelect(selector: string, update: (value: string) => void): void {
  const input = propertiesPanel.querySelector<HTMLSelectElement>(selector);
  input?.addEventListener("change", () => {
    update(input.value);
    commitState();
    redrawAll();
  });
}

function bindCheckbox(selector: string, update: (checked: boolean) => void): void {
  const input = propertiesPanel.querySelector<HTMLInputElement>(selector);
  input?.addEventListener("change", () => {
    update(input.checked);
    commitState();
    redrawAll();
  });
}

function bindButton(selector: string, action: () => void): void {
  const button = propertiesPanel.querySelector<HTMLButtonElement>(selector);
  button?.addEventListener("click", () => {
    action();
    commitState();
    redrawAll();
  });
}

function resizeCanvases(): void {
  resizePlanCanvas();
}

function resizePlanCanvas(): { width: number; height: number } {
  const rect = planCanvas.getBoundingClientRect();
  const ratio = getCanvasPixelRatio();
  const width = Math.max(1, Math.floor(rect.width * ratio));
  const height = Math.max(1, Math.floor(rect.height * ratio));
  if (planCanvas.width !== width || planCanvas.height !== height) {
    planCanvas.width = width;
    planCanvas.height = height;
  }
  return { width: rect.width, height: rect.height };
}

function getCanvasPixelRatio(): number {
  return Math.min(globalThis.devicePixelRatio || 1, 2);
}

function fitPlanToCanvas(): void {
  const bounds = getEntitiesBounds([...activeEntities(), ...state.roofs]) ?? getGlobalBounds();
  const rect = planCanvas.getBoundingClientRect();
  if (!bounds || rect.width === 0 || rect.height === 0) {
    view = { zoom: 1, x: rect.width / 2, y: rect.height / 2 };
    return;
  }
  const padding = 70;
  const zoomX = (rect.width - padding * 2) / bounds.w;
  const zoomY = (rect.height - padding * 2) / bounds.h;
  // 広い敷地も全体が入るよう縮小側は制限しない。小さな図を画面いっぱいまで拡大しすぎないよう、拡大は2.2倍まで
  const zoom = clamp(Math.min(zoomX, zoomY), MIN_PLAN_ZOOM, 2.2);
  view.zoom = zoom;
  view.x = rect.width / 2 - (bounds.x + bounds.w / 2) * zoom;
  view.y = rect.height / 2 - (bounds.y + bounds.h / 2) * zoom;
}

function commitState(): void {
  history = history.slice(0, historyIndex + 1);
  history.push(cloneState(state));
  if (history.length > HISTORY_LIMIT) {
    history.shift();
  } else {
    historyIndex += 1;
  }
  persistState();
  updateUi();
}

function replaceState(next: PlanState, pushHistory: boolean): void {
  state = cloneState(next);
  // 別の間取りに入れ替えたときは、隠していた階や屋根をすべて表示に戻す
  hiddenFloorIds.clear();
  roofVisible2d = true;
  roofVisible3d = true;
  if (pushHistory) commitState();
  persistState();
  fitPlanToCanvas();
  pendingCameraFrame = true;
  redrawAll();
}

function undo(): void {
  if (historyIndex <= 0) return;
  historyIndex -= 1;
  state = cloneState(history[historyIndex]);
  persistState();
  redrawAll();
}

function redo(): void {
  if (historyIndex >= history.length - 1) return;
  historyIndex += 1;
  state = cloneState(history[historyIndex]);
  persistState();
  redrawAll();
}

function persistState(): void {
  saveStatus.textContent = "保存中...";
  if (saveTimer) window.clearTimeout(saveTimer);
  if (storageRecovery && !storageRecovery.backupSaved) {
    saveStatus.textContent = "元データ保護中・自動保存停止";
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    saveStatus.textContent = "自動保存失敗・書き出してください";
    return;
  }
  saveTimer = window.setTimeout(() => {
    saveStatus.textContent = "保存済み";
  }, 320);
}

// ---- クレジット表記のコピー ----

// 作った間取りや画像を公開するときに添えるクレジット。どのサイトから開いても、本番のURLにする
const CREDIT_TEXT: Record<"ja" | "en", string> = {
  ja: "間取りクイック3D https://madori-5yu.pages.dev/",
  en: "Madori Quick 3D https://madori-5yu.pages.dev/",
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // クリップボードの機能が使えないブラウザでは、見えない入力欄を選んでコピーする
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  }
}

function setupCreditCopy(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-copy-credit]").forEach((button) => {
    const label = button.textContent ?? "";
    let timer = 0;
    button.addEventListener("click", async () => {
      const copied = await copyText(CREDIT_TEXT[button.dataset.copyCredit === "en" ? "en" : "ja"]);
      button.textContent = copied ? "コピーしました" : "コピーできませんでした";
      button.classList.toggle("is-copied", copied);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        button.textContent = label;
        button.classList.remove("is-copied");
      }, 1600);
    });
  });
}

// ---- ご意見・ご要望のフォーム ----

// Google フォーム。「使っている版とブラウザ」の欄（entry.144245894）に、使っている環境を自動で入れて開く。
// 文章だけのフォーム（ログイン不要）と、画像も添えられるフォーム（Googleアカウントでのログインが必要）。画像付きは文章だけのものの複製
const FEEDBACK_FORMS: { link: string; url: string }[] = [
  { link: "#feedbackFormLink", url: "https://docs.google.com/forms/d/e/1FAIpQLSd2tDbVHoz1r5CUKdsK221_-KkIjx0U6NSRZFmiZZqPWk7jEg/viewform" },
  { link: "#feedbackImageFormLink", url: "https://docs.google.com/forms/d/e/1FAIpQLSfd6lucVdNQ5GqqXep8xos68t2Ri9CatBdMrap5dHaSH-EdeQ/viewform" },
];
const FEEDBACK_ENVIRONMENT_ENTRY = "entry.144245894";

// 不具合を調べるときに役立つ、使っている環境の短い説明（間取りのデータは含めない）
function feedbackEnvironment(): string {
  const agent = navigator.userAgent;
  const version = (pattern: RegExp) => pattern.exec(agent)?.[1];
  const browser = version(/Edg\/(\d+)/) ? `Edge ${version(/Edg\/(\d+)/)}`
    : version(/Firefox\/(\d+)/) ? `Firefox ${version(/Firefox\/(\d+)/)}`
    : version(/Chrome\/(\d+)/) ? `Chrome ${version(/Chrome\/(\d+)/)}`
    : version(/Version\/(\d+)[^ ]* .*Safari/) ? `Safari ${version(/Version\/(\d+)[^ ]* .*Safari/)}`
    : "その他のブラウザ";
  const system = /Windows/.test(agent) ? "Windows" : /iPhone|iPad/.test(agent) ? "iOS" : /Android/.test(agent) ? "Android"
    : /Mac OS X|Macintosh/.test(agent) ? "Mac" : /Linux/.test(agent) ? "Linux" : "その他のOS";
  return [
    PLAN_EDITION ? "間取り専用版" : "本体（3Dあり）",
    `版 ${__APP_COMMIT__}`,
    browser,
    system,
    `画面 ${window.innerWidth}×${window.innerHeight}`,
    location.host,
  ].join(" / ");
}

function feedbackFormUrl(url: string): string {
  return `${url}?usp=pp_url&${FEEDBACK_ENVIRONMENT_ENTRY}=${encodeURIComponent(feedbackEnvironment())}`;
}

// 開く直前の画面の大きさが入るよう、押したときにリンク先を作り直す
function setupFeedbackForm(): void {
  for (const form of FEEDBACK_FORMS) {
    const link = document.querySelector<HTMLAnchorElement>(form.link);
    if (!link) continue;
    const refresh = () => (link.href = feedbackFormUrl(form.url));
    link.addEventListener("pointerdown", refresh);
    link.addEventListener("focus", refresh);
    refresh();
  }
}

// ---- 間取り専用版と、本体のお知らせ ----

function setupEdition(): void {
  if (PLAN_EDITION) {
    document.title = "間取りクイック 間取り専用版";
    const heading = document.querySelector<HTMLHeadingElement>(".brand h1");
    if (heading?.firstChild?.nodeType === Node.TEXT_NODE) heading.firstChild.textContent = "間取りクイック";
    heading?.querySelector(".alpha-badge")?.insertAdjacentHTML("beforebegin", '<span class="edition-badge">間取り専用版</span>');
    // 本体で屋根を選んだまま開いたときは、選ばない状態から始める（屋根は3Dの部品なので出さない）
    if (state.roofs.some((item) => item.id === state.selectedId)) state.selectedId = null;
    return;
  }
}

// 上のバーの文。本体では間取り専用版のお知らせを、それを消したあと（と間取り専用版）は開発中の注意書きを出す。
// どちらも×で消せて、消した文は次からも出さない。画面の高さは使わない
function setupTopNote(): void {
  const note = document.querySelector<HTMLDivElement>("#topNote");
  const edition = document.querySelector<HTMLSpanElement>("#editionNote");
  const alpha = document.querySelector<HTMLSpanElement>("#alphaNote");
  const close = document.querySelector<HTMLButtonElement>("#topNoteClose");
  if (!note || !edition || !alpha || !close) return;
  const closed = (key: string) => localStorage.getItem(key) === "closed";
  const show = () => {
    edition.hidden = PLAN_EDITION || closed(EDITION_NOTICE_KEY);
    alpha.hidden = !edition.hidden || closed(ALPHA_NOTE_KEY);
    note.hidden = edition.hidden && alpha.hidden;
  };
  close.addEventListener("click", () => {
    localStorage.setItem(edition.hidden ? ALPHA_NOTE_KEY : EDITION_NOTICE_KEY, "closed");
    show();
  });
  show();
}

// ---- 画像の書き出し（2Dの間取り・3D） ----


function setupImageExport(): void {
  const button = document.querySelector<HTMLButtonElement>("#imageExportButton");
  const menu = document.querySelector<HTMLDivElement>("#imageExportMenu");
  const floors = document.querySelector<HTMLSelectElement>("#imageExportFloors");
  const grid = document.querySelector<HTMLInputElement>("#imageExportGrid");
  const names = document.querySelector<HTMLInputElement>("#imageExportNames");
  if (!button || !menu || !floors || !grid || !names) return;
  const saved = viewState.imageExport;
  if (saved && typeof saved === "object") {
    if (saved.floors === "current" || saved.floors === "all" || saved.floors === "each") imageExportSettings.floors = saved.floors;
    if (typeof saved.grid === "boolean") imageExportSettings.grid = saved.grid;
    if (typeof saved.names === "boolean") imageExportSettings.names = saved.names;
  }
  floors.value = imageExportSettings.floors;
  grid.checked = imageExportSettings.grid;
  names.checked = imageExportSettings.names;
  const remember = () => {
    imageExportSettings.floors = floors.value as ImageExportSettings["floors"];
    imageExportSettings.grid = grid.checked;
    imageExportSettings.names = names.checked;
    viewState.imageExport = { ...imageExportSettings };
    scheduleViewStateSave();
  };
  [floors, grid, names].forEach((input) => input.addEventListener("change", remember));
  const close = () => {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  };
  button.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
    button.setAttribute("aria-expanded", String(!menu.hidden));
  });
  document.addEventListener("pointerdown", (event) => {
    if (menu.hidden || menu.contains(event.target as Node) || button.contains(event.target as Node)) return;
    close();
  });
  document.querySelector<HTMLButtonElement>("#imageExportPlan")?.addEventListener("click", () => {
    remember();
    close();
    exportPlanImages();
  });
  document.querySelector<HTMLButtonElement>("#imageExport3d")?.addEventListener("click", () => {
    close();
    exportThreeImage();
  });
}

// 書き出す階の、物が入る範囲（屋根は含めない）
function exportBounds(floorIndexes: number[]): Bounds | null {
  return getEntitiesBounds(floorIndexes.flatMap((index) => state.floors[index].entities));
}

// 1つの階を、書き出し用のキャンバスの (left, top) から描く。選択の枠・ほかの階の透過・屋根・固定の印は描かない
function drawFloorForExport(target: CanvasRenderingContext2D, floorIndex: number, bounds: Bounds, left: number, top: number, ratio: number, zoom: number): void {
  const saved = { ctx, view: { ...view }, activeFloor: state.activeFloor, selectedId: state.selectedId, hideRoomNames };
  const width = (bounds.w + EXPORT_MARGIN * 2) * zoom;
  const height = (bounds.h + EXPORT_MARGIN * 2) * zoom;
  ctx = target;
  view = { zoom, x: (EXPORT_MARGIN - bounds.x) * zoom, y: (EXPORT_MARGIN - bounds.y) * zoom };
  state.activeFloor = floorIndex;
  state.selectedId = null;
  hideRoomNames = !imageExportSettings.names;
  try {
    ctx.save();
    ctx.setTransform(ratio, 0, 0, ratio, left * ratio, top * ratio);
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();
    drawPlan(width, height, { grid: imageExportSettings.grid, ghost: false, editing: false });
    ctx.restore();
  } finally {
    ctx = saved.ctx;
    view = saved.view;
    state.activeFloor = saved.activeFloor;
    state.selectedId = saved.selectedId;
    hideRoomNames = saved.hideRoomNames;
  }
}

// 書き出す画像の倍率。zoom（1cmあたりの画面の大きさ）は、間取り全体を EXPORT_VIEW の大きさの画面に収めたときの値で、
// 線の太さや文字の大きさの割合を決める。ratio は細かさ。大きすぎる間取りは、作れる大きさまで細かさを下げる
function exportScale(layoutW: number, layoutH: number, headings: number): { ratio: number; zoom: number } {
  const zoom = clamp(Math.min(EXPORT_VIEW_WIDTH / layoutW, Math.max(1, EXPORT_VIEW_HEIGHT - headings) / layoutH), MIN_PLAN_ZOOM, 2.2);
  const widthCss = layoutW * zoom;
  const heightCss = layoutH * zoom + headings;
  const ratio = Math.min(
    Math.max(EXPORT_PIXEL_RATIO, EXPORT_MIN_PIXELS_PER_CM / zoom),
    EXPORT_MAX_SIDE / widthCss,
    EXPORT_MAX_SIDE / heightCss,
    Math.sqrt(EXPORT_MAX_PIXELS / (widthCss * heightCss)),
  );
  return { ratio, zoom };
}

// 階の画像を並べた1枚（階が1つなら、その階だけ）。複数の階は、階の名前を上に書く
function renderPlanImage(floorIndexes: number[], bounds: Bounds): HTMLCanvasElement {
  const labelled = floorIndexes.length > 1;
  const heading = labelled ? 44 : 0;
  const cellWcm = bounds.w + EXPORT_MARGIN * 2;
  const cellHcm = bounds.h + EXPORT_MARGIN * 2;
  // 横に長くなりすぎるときは、何段かに折り返す
  const columns = labelled ? Math.max(1, Math.min(floorIndexes.length, Math.round(Math.sqrt((floorIndexes.length * cellHcm * 1.6) / cellWcm)) || 1)) : 1;
  const rows = Math.ceil(floorIndexes.length / columns);
  const { ratio, zoom } = exportScale(cellWcm * columns, cellHcm * rows, heading * rows);
  const cellW = cellWcm * zoom;
  const cellH = cellHcm * zoom + heading;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(cellW * columns * ratio));
  canvas.height = Math.max(1, Math.round(cellH * rows * ratio));
  const target = canvas.getContext("2d");
  if (!target) return canvas;
  target.fillStyle = "#ffffff";
  target.fillRect(0, 0, canvas.width, canvas.height);
  floorIndexes.forEach((floorIndex, i) => {
    const left = (i % columns) * cellW;
    const top = Math.floor(i / columns) * cellH;
    if (labelled) {
      target.save();
      target.setTransform(ratio, 0, 0, ratio, 0, 0);
      target.fillStyle = INK;
      target.font = `700 22px ${TEXT_FONT}`;
      target.textBaseline = "middle";
      target.fillText(state.floors[floorIndex].name, left + 16, top + heading / 2);
      target.restore();
    }
    drawFloorForExport(target, floorIndex, bounds, left, top + heading, ratio, zoom);
  });
  return canvas;
}

function exportPlanImages(): void {
  const stamp = localDateStamp();
  const choice = imageExportSettings.floors;
  const floorIndexes = choice === "current" ? [state.activeFloor] : state.floors.map((_, index) => index).filter((index) => exportBounds([index]));
  const bounds = exportBounds(floorIndexes);
  if (!bounds || !floorIndexes.length) {
    saveStatus.textContent = "書き出す物がありません";
    window.setTimeout(() => (saveStatus.textContent = "保存済み"), 1600);
    return;
  }
  if (choice === "each") {
    // 階ごとの画像も、同じ範囲・同じ倍率にそろえる（重ねて見比べやすいように）
    floorIndexes.forEach((floorIndex, i) => {
      window.setTimeout(() => downloadCanvas(renderPlanImage([floorIndex], bounds), `madori-${stamp}-${state.floors[floorIndex].name}.png`), i * 350);
    });
    return;
  }
  const name = choice === "current" ? state.floors[state.activeFloor].name : "all";
  downloadCanvas(renderPlanImage(floorIndexes, bounds), `madori-${stamp}-${name}.png`);
}

// いまの3Dの見え方を、画面の2倍の細かさで画像にする
function exportThreeImage(): void {
  const size = renderer.getSize(new THREE.Vector2());
  if (size.x < 2 || size.y < 2) {
    saveStatus.textContent = "3Dを表示してから書き出してください";
    window.setTimeout(() => (saveStatus.textContent = "保存済み"), 2000);
    return;
  }
  const pixelRatio = renderer.getPixelRatio();
  const ratio = Math.min(pixelRatio * 2, EXPORT_MAX_SIDE / size.x, EXPORT_MAX_SIDE / size.y, renderer.capabilities.maxTextureSize / Math.max(size.x, size.y));
  renderer.setPixelRatio(ratio);
  renderer.setSize(size.x, size.y, false);
  renderer.render(scene, camera);
  const stamp = localDateStamp();
  downloadCanvas(renderer.domElement, `madori-${stamp}-3d.png`);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(size.x, size.y, false);
  render3dOnce();
}

function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

function exportPlan(): void {
  downloadJson(JSON.stringify(state, null, 2), `madori-${localDateStamp()}.json`);
}

// toISOString() はUTCのため、日本時間の0〜9時に前日の日付になる。利用者の現地日付を使う
function localDateStamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function downloadJson(json: string, filename: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function importPlan(): void {
  const file = importInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const normalized = normalizePlan(JSON.parse(String(reader.result)));
      if (!normalized) throw new Error("Invalid plan");
      normalized.selectedId = null;
      replaceState(normalized, true);
    } catch {
      saveStatus.textContent = "読み込み失敗";
      window.setTimeout(() => {
        saveStatus.textContent = "保存済み";
      }, 1400);
    } finally {
      importInput.value = "";
    }
  });
  reader.readAsText(file);
}

function screenToWorld(event: PointerEvent | MouseEvent | WheelEvent): Point {
  const rect = planCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left - view.x) / view.zoom,
    y: (event.clientY - rect.top - view.y) / view.zoom,
  };
}

function hitTest(point: Point): { entity: Entity | null; corner: string | null } {
  // Match visual stacking even when a floor or rug was placed after the furniture.
  const layer = (entity: Entity): number => entity.type === "text" ? 7 : entity.type === "room" ? 0 : entity.type === "furniture" && (entity.kind === "rug" || entity.kind === "paint") ? 1 : entity.type === "wall" ? 2 : entity.type === "window" ? 3 : entity.type === "door" ? 4 : entity.type === "furniture" ? 5 : 6;
  const entities = [...activeEntities()].sort((a, b) => layer(a) - layer(b));
  const selectedPerson = entities.find((entity) => entity.id === state.selectedId);
  if (isPerson(selectedPerson) && !isLocked(selectedPerson)) {
    const limb = personHandleAt(selectedPerson, point);
    if (limb >= 0) return { entity: selectedPerson, corner: `limb:${limb}` };
  }
  const selectedRoof = roofsOn2d() ? state.roofs.find((item) => item.id === state.selectedId) : undefined;
  if (selectedRoof) {
    const corner = getCornerHit(selectedRoof, point);
    if (corner) return { entity: selectedRoof, corner };
    if (isPointInRoof(point, selectedRoof)) return { entity: selectedRoof, corner: null };
  }
  for (let i = entities.length - 1; i >= 0; i -= 1) {
    const entity = entities[i];
    if (entity.type === "room" && isPointInRoomLabel(point, entity)) {
      return { entity, corner: "label" };
    }
  }

  for (let i = entities.length - 1; i >= 0; i -= 1) {
    const entity = entities[i];
    if (entity.type === "room") {
      const corner = getCornerHit(entity, point);
      if (corner) return { entity, corner };
      if (point.x >= entity.x && point.x <= entity.x + entity.w && point.y >= entity.y && point.y <= entity.y + entity.h) {
        return { entity, corner: null };
      }
    } else if (entity.type === "furniture" && entity.kind === "paint") {
      const corner = entity.id === state.selectedId ? getCornerHit(entity, point) : null;
      if (corner) return { entity, corner };
      if (isPointOnPaint(entity, point)) return { entity, corner: null };
    } else if (entity.type === "furniture") {
      const corner = isPerson(entity) ? null : getCornerHit(entity, point);
      if (corner) return { entity, corner };
      const angle = degreesToRadians(entity.rotation);
      const dx = point.x - entity.x - entity.w / 2;
      const dy = point.y - entity.y - entity.h / 2;
      const localX = dx * Math.cos(angle) + dy * Math.sin(angle);
      const localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
      if (Math.abs(localX) <= entity.w / 2 && Math.abs(localY) <= entity.h / 2) {
        return { entity, corner: null };
      }
    } else if (entity.type === "text") {
      if (isPointInTextLabel(point, entity)) {
        return { entity, corner: null };
      }
    } else if (entity.type === "shape") {
      if (isPointNearShape(point, entity)) {
        return { entity, corner: null };
      }
    } else if (isLinear(entity)) {
      if (state.selectedId === entity.id) {
        const endpoint = getLineEndpointHit(entity, point);
        if (endpoint) return { entity, corner: endpoint };
      }
      if (distanceToSegment(point, { x: entity.x1, y: entity.y1 }, { x: entity.x2, y: entity.y2 }) < 12 / view.zoom) {
        return { entity, corner: null };
      }
    }
  }
  for (let i = roofsOn2d() ? state.roofs.length - 1 : -1; i >= 0; i -= 1) {
    const roofItem = state.roofs[i];
    if (roofItem.id !== selectedRoof?.id && isPointNearRoofEdge(point, roofItem)) {
      return { entity: roofItem, corner: null };
    }
  }
  return { entity: null, corner: null };
}

function getLineEndpointHit(entity: LinearElement, point: Point): string | null {
  // 短い線でも中央部をドラッグで移動できるよう、端点判定は線長の1/4までに制限する
  const size = Math.min(12 / view.zoom, distance(entity) * 0.25);
  if (Math.abs(point.x - entity.x1) <= size && Math.abs(point.y - entity.y1) <= size) return "p1";
  if (Math.abs(point.x - entity.x2) <= size && Math.abs(point.y - entity.y2) <= size) return "p2";
  return null;
}

function getRoomLabelPosition(room: Room): Point {
  return {
    x: room.x + (room.labelOffsetX ?? 10),
    y: room.y + (room.labelOffsetY ?? 10),
  };
}

function getRoomLabelBounds(room: Room): { x: number; y: number; w: number; h: number } | null {
  const named = room.name.trim() !== "";
  if (!named && !showDimensions) return null;
  const position = getRoomLabelPosition(room);
  const nameWidth = named ? Math.max(36, room.name.length * 14) : 0;
  const dimensionWidth = showDimensions ? 82 : 0;
  return {
    x: position.x - 6,
    y: position.y - 5,
    w: Math.max(nameWidth, dimensionWidth) + 12,
    h: named && showDimensions ? 44 : 26,
  };
}

function isPointInRoomLabel(point: Point, room: Room): boolean {
  const bounds = getRoomLabelBounds(room);
  if (!bounds) return false;
  return point.x >= bounds.x && point.x <= bounds.x + bounds.w && point.y >= bounds.y && point.y <= bounds.y + bounds.h;
}

function getCornerHit(entity: Room | Furniture | Roof, point: Point): string | null {
  const size = 12 / view.zoom;
  const corners = [
    { key: "nw", x: entity.x, y: entity.y },
    { key: "ne", x: entity.x + entity.w, y: entity.y },
    { key: "sw", x: entity.x, y: entity.y + entity.h },
    { key: "se", x: entity.x + entity.w, y: entity.y + entity.h },
  ];
  const hit = corners.find((corner) => Math.abs(point.x - corner.x) <= size && Math.abs(point.y - corner.y) <= size);
  return hit?.key ?? null;
}

function isPointNearRoofEdge(point: Point, roofItem: Roof): boolean {
  const tolerance = 12 / view.zoom;
  const withinX = point.x >= roofItem.x - tolerance && point.x <= roofItem.x + roofItem.w + tolerance;
  const withinY = point.y >= roofItem.y - tolerance && point.y <= roofItem.y + roofItem.h + tolerance;
  if (!withinX || !withinY) return false;
  const nearLeft = Math.abs(point.x - roofItem.x) <= tolerance;
  const nearRight = Math.abs(point.x - (roofItem.x + roofItem.w)) <= tolerance;
  const nearTop = Math.abs(point.y - roofItem.y) <= tolerance;
  const nearBottom = Math.abs(point.y - (roofItem.y + roofItem.h)) <= tolerance;
  return nearLeft || nearRight || nearTop || nearBottom;
}

function isPointInRoof(point: Point, roofItem: Roof): boolean {
  return point.x >= roofItem.x && point.x <= roofItem.x + roofItem.w && point.y >= roofItem.y && point.y <= roofItem.y + roofItem.h;
}

function constrainLine(start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return { x: end.x, y: end.y };
  // 15°刻みにスナップ（縦横に加えて斜めの壁も引ける）
  const step = Math.PI / 12;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  return {
    x: Math.round(start.x + Math.cos(angle) * length),
    y: Math.round(start.y + Math.sin(angle) * length),
  };
}

function to3d(x: number, y: number, center: Point): { x: number; z: number } {
  return {
    x: (x - center.x) * SCALE_3D,
    z: (y - center.y) * SCALE_3D,
  };
}

// ---- Templates ----

function makeFloor(name: string, entities: Entity[]): Floor {
  return { id: newId("floor"), name, entities };
}

// 「サンプル」雛形: 作例プラン（書き出しJSONをそのまま収録）
// 起動時（URLパラメータ経由）でも参照できるよう、巻き上げの効く関数宣言にしている
function samplePlanData(): unknown {
  return {
  floors: [
    {
      id: "floor-a35471aa-199e-4886-8241-548b47d8ea02",
      name: "1F",
      entities: [
        { id: "room-ee067625-51a8-4019-8565-b352841f3e73", type: "room", name: "寝室", x: 380, y: 0, w: 220, h: 220, color: "#e9eff8" },
        { id: "room-038963ce-8166-4fe4-9eaa-7e91829213e4", type: "room", name: "水回り", x: 380, y: 220, w: 220, h: 220, color: "#e8f2ed" },
        { id: "room-6b1825cb-c567-403c-8058-6523ca6dbde4", type: "room", name: "玄関", x: 0, y: 300, w: 380, h: 140, color: "#f6e8e0", labelOffsetX: 244.10191702469064, labelOffsetY: 35.376901574492194 },
        { id: "wall-81013c56-5bcf-48b5-abd8-f16b73d135f3", type: "wall", x1: 0, y1: 0, x2: 600, y2: 0 },
        { id: "wall-bf7760b9-38c1-4cda-826a-ee31172178c3", type: "wall", x1: 600, y1: 0, x2: 600, y2: 440 },
        { id: "wall-87765cd4-1650-4714-af29-2d4f30beee85", type: "wall", x1: 600, y1: 440, x2: 0, y2: 440 },
        { id: "wall-61ff692b-f233-43ae-8108-f30d8e2b61e1", type: "wall", x1: 0, y1: 440, x2: 0, y2: 0 },
        { id: "wall-f1d83055-3bf5-41d1-b753-20db2583b8a1", type: "wall", x1: 380, y1: 0, x2: 380, y2: 440 },
        { id: "wall-7a144e4d-23df-4f45-8086-ab975d0a2545", type: "wall", x1: 380, y1: 220, x2: 600, y2: 220 },
        { id: "wall-5dce8c29-33d7-47e2-b5d7-40839f2b3db8", type: "wall", x1: 0, y1: 300, x2: 380, y2: 300 },
        { id: "door-52c4d0ee-4c7a-4db3-9cb1-3ba1db1a15fd", type: "door", x1: 240, y1: 300, x2: 320, y2: 300 },
        { id: "door-5cf38b13-c684-44ca-935e-0908d904746f", type: "door", x1: 380, y1: 140, x2: 380, y2: 180 },
        { id: "door-48b1ad1a-a902-45f6-ad6d-7d6b568dd649", type: "door", x1: 460, y1: 220, x2: 540, y2: 220 },
        { id: "window-94d629ab-9a8d-4cd3-b78b-93279bf96998", type: "window", x1: 70, y1: 0, x2: 250, y2: 0 },
        { id: "window-ab00b630-a863-49e9-b1a6-3fd411a3ff2d", type: "window", x1: 430, y1: 0, x2: 560, y2: 0 },
        { id: "furniture-238b95f5-e170-4ea3-bdd0-2e8d63c08892", type: "furniture", kind: "sofa", x: 80, y: 40, w: 140, h: 60, rotation: 0 },
        { id: "furniture-7728a0d4-8c93-43da-816b-e781b5a504c6", type: "furniture", kind: "table", x: 80, y: 140, w: 80, h: 100, rotation: 0 },
        { id: "furniture-18c308ac-cdad-4a92-bc92-5071236d8479", type: "furniture", kind: "bed", x: 520, y: 20, w: 74, h: 120, rotation: 0 },
        { id: "furniture-be7d6740-6272-440f-95d1-f0bab0608c73", type: "furniture", kind: "kitchen", x: 240, y: 20, w: 120, h: 40, rotation: 0 },
        { id: "furniture-c5bcaafe-20ab-47b9-8739-0dbaa36f719e", type: "furniture", kind: "bath", x: 440, y: 280, w: 120, h: 80, rotation: 0, color: "#000000", color3d: "#c2f3ff" },
        { id: "window-cced82e5-d999-480a-a32e-8494dee0bb5a", type: "window", x1: 0, y1: 60, x2: 0, y2: 220 },
        { id: "wall-470a55ea-b8e9-41b0-836e-794f53e1b254", type: "wall", x1: 0, y1: 40, x2: 0, y2: -180 },
        { id: "wall-433e695b-470e-43c3-bd75-6ddd5a28a896", type: "wall", x1: 0, y1: -180, x2: 600, y2: -180 },
        { id: "wall-76154116-819b-4daf-aaa6-431e94fcc1c0", type: "wall", x1: 600, y1: -180, x2: 600, y2: 20 },
        { id: "shape-8cf996c6-dca5-4b39-ba14-12f60889bd91", type: "shape", kind: "circle", x: 920, y: -80, r: 160, startAngle: 0, endAngle: 6.283185307179586 },
        { id: "shape-b1ac4c06-b255-4d6f-99cb-4c2633303385", type: "shape", kind: "arc", x: 660, y: -300, r: 60, startAngle: -1.5707963267948966, endAngle: 2.3754228892920524 },
        { id: "wall-69d4bd62-3860-4a4c-9eec-745e06e193ad", type: "wall", x1: 1180, y1: -240, x2: 1180, y2: 340 },
        { id: "wall-72497fe6-53c5-49c2-9355-58ac4b57089c", type: "wall", x1: 1180, y1: -240, x2: 2000, y2: -240 },
        { id: "wall-640af7ef-3e1b-48b4-97e6-1c17efcf3069", type: "wall", x1: 1180, y1: 340, x2: 2000, y2: 340 },
        { id: "wall-c2da2d05-a822-49f9-b5a1-9eb226eb91fb", type: "wall", x1: 2000, y1: -240, x2: 2000, y2: 340 },
        { id: "room-80fae1c5-87f5-4824-9c0f-085a1e51b617", type: "room", name: "部屋 4", x: 240, y: -600, w: 460, h: 180, color: "#e8f2ed" },
        { id: "door-c9e53dd8-24be-423c-99ab-ee27a80a23c0", type: "door", x1: 60, y1: 440, x2: 160, y2: 440 },
        { id: "furniture-6a1c3a27-ee99-4f34-8c53-c74399151063", type: "furniture", kind: "table", x: 200, y: -140, w: 100, h: 80, rotation: 0 },
        { id: "furniture-41012320-f935-440d-abee-0371f54ae634", type: "furniture", kind: "table", x: 60, y: -300, w: 100, h: 50, rotation: 0 },
        { id: "furniture-1743122b-187b-412e-b280-c986fe64f743", type: "furniture", kind: "stairsSpiral", x: 440, y: -160, w: 140, h: 140, rotation: 90 },
        { id: "furniture-6a9947d5-8015-4f76-9691-005782f6091c", type: "furniture", kind: "table", x: 820, y: 300, w: 100, h: 70, rotation: 0 },
        { id: "furniture-01fc71a0-f688-459e-bb63-60bb100fe6ba", type: "furniture", kind: "closet", x: 0, y: -180, w: 160, h: 60, rotation: 0 },
        { id: "door-d1972569-27a1-4dc2-aa16-28c048986801", type: "door", x1: 860, y1: -460, x2: 1000, y2: -460 },
        { id: "door-67b92620-b0a9-47e1-9a0d-53b29d85c3f2", type: "door", x1: 0, y1: -100, x2: 0, y2: -40 },
        { id: "furniture-283cf7e4-31f2-404e-8455-f4821697752c", type: "furniture", kind: "car", x: 1260, y: 700, w: 180, h: 460, rotation: 0 },
        { id: "furniture-c965ef89-9119-4a01-ae08-ac7f6cc5374e", type: "furniture", kind: "stairsU", x: -300, y: 60, w: 240, h: 260, rotation: 0 },
        { id: "furniture-ffff236f-57f6-4649-9d0b-1851ead4b219", type: "furniture", kind: "plant", x: 800, y: 720, w: 80, h: 80, rotation: 0 },
        { id: "furniture-a5f3f497-a0cd-4212-b9fc-1c23f318ee60", type: "furniture", kind: "tv", x: -60, y: 680, w: 320, h: 140, rotation: 0 },
        { id: "furniture-a02a885c-4624-410e-92ac-14b3fe78a3f6", type: "furniture", kind: "toilet", x: 220, y: 1040, w: 160, h: 200, rotation: 0 },
        { id: "furniture-9c9e45fd-689b-4419-acc2-c2bc1ce0dfb4", type: "furniture", kind: "armchair", x: -400, y: -160, w: 80, h: 80, rotation: 0 },
        { id: "furniture-2efe9d15-206a-4c2f-b007-383d567f5448", type: "furniture", kind: "chair", x: 1080, y: 300, w: 80, h: 80, rotation: 0 },
        { id: "furniture-984286e0-c13c-4137-8b30-5fc8d7c822d6", type: "furniture", kind: "chair", x: 940, y: 560, w: 45, h: 45, rotation: 0 },
        { id: "furniture-0560c5e1-3110-46ce-bdba-9b438b7b2dc7", type: "furniture", kind: "aquarium", x: -200, y: 1060, w: 180, h: 125, rotation: 0 },
        { id: "furniture-9932ba70-4b8e-4bf4-9dd8-839dcf799304", type: "furniture", kind: "grandfatherClock", x: 80, y: 1060, w: 80, h: 140, rotation: 0 },
        { id: "furniture-224fd4b7-5937-44d7-89c1-86debdf6fdf8", type: "furniture", kind: "wallClock", x: 600, y: 1060, w: 220, h: 160, rotation: 0 },
        { id: "furniture-f10a3996-56f8-426d-98f5-1f00b84a75e7", type: "furniture", kind: "washer", x: 940, y: 1080, w: 125, h: 145, rotation: 0 },
        { id: "furniture-a33c49c0-52ea-480f-9238-dd675437a9ea", type: "furniture", kind: "washbasin", x: 1220, y: 1260, w: 75, h: 55, rotation: 0 },
        { id: "furniture-14358d3e-963c-45ff-b18b-224095ec5ddc", type: "furniture", kind: "washbasin", x: 1140, y: 1100, w: 120, h: 120, rotation: 180 },
        { id: "furniture-bf61839b-28c6-4829-97c0-74d6e1c08fae", type: "furniture", kind: "stairs", x: 1700, y: 840, w: 100, h: 280, rotation: 0 },
      ],
    },
  ],
  activeFloor: 0,
  selectedId: null,
  roofs: [],
  };
}

function makeTemplate(key: string): PlanState {
  const plan = buildTemplate(key);
  plan.roofs.forEach((item) => { item.floorId ??= plan.floors[plan.floors.length - 1].id; });
  return plan;
}

function buildTemplate(key: string): PlanState {
  if (key === "sample") {
    const plan = normalizePlan(samplePlanData());
    if (plan) {
      plan.selectedId = null;
      plan.activeFloor = 0;
      return plan;
    }
  }
  if (key === "starter") {
    return {
      floors: [
        makeFloor("1F", [
          room("部屋", 0, 0, 600, 400, "#ffffff"),
          wall(0, 0, 600, 0),
          wall(600, 0, 600, 400),
          wall(600, 400, 0, 400),
          wall(0, 400, 0, 0),
          door(260, 400, 340, 400),
          windowLine(180, 0, 420, 0),
        ]),
      ],
      activeFloor: 0,
      selectedId: null,
      roofs: [],
    };
  }

  if (key === "studio") {
    return {
      floors: [
        makeFloor("1F", [
          room("LDK", 0, 0, 420, 360, "#ffffff"),
          room("水回り", 420, 0, 180, 220, "#fbfcfd"),
          room("玄関", 420, 220, 180, 140, "#fcfbf9"),
          wall(0, 0, 600, 0),
          wall(600, 0, 600, 360),
          wall(600, 360, 0, 360),
          wall(0, 360, 0, 0),
          wall(420, 0, 420, 360),
          wall(420, 220, 600, 220),
          door(420, 260, 420, 330),
          door(420, 60, 420, 140),
          door(470, 360, 550, 360),
          windowLine(60, 0, 240, 0),
          windowLine(0, 100, 0, 260),
          furniture("kitchen", 40, 10),
          furniture("fridge", 300, 10),
          furniture("bed", 40, 140),
          furniture("sofa", 220, 150),
          furniture("table", 240, 250),
          furniture("tv", 200, 310),
          furniture("plant", 375, 310),
          furniture("bath", 430, 15),
          furniture("washbasin", 430, 105),
          furniture("toilet", 540, 130),
        ]),
      ],
      activeFloor: 0,
      selectedId: null,
      roofs: [roof("flat", -40, -40, 680, 440)],
    };
  }

  if (key === "twoLdk") {
    return {
      floors: [
        makeFloor("1F", [
          room("LDK", 0, 0, 480, 320, "#ffffff"),
          room("洋室 1", 480, 0, 320, 320, "#fbfcfd"),
          room("洋室 2", 0, 320, 280, 240, "#fcfbf9"),
          room("玄関", 280, 320, 200, 240, "#fdfdfc"),
          room("水回り", 480, 320, 320, 240, "#fbfcfb"),
          wall(0, 0, 800, 0),
          wall(800, 0, 800, 560),
          wall(800, 560, 0, 560),
          wall(0, 560, 0, 0),
          wall(480, 0, 480, 320),
          wall(0, 320, 800, 320),
          wall(280, 320, 280, 560),
          wall(480, 320, 480, 560),
          door(480, 100, 480, 180),
          door(80, 320, 160, 320),
          door(330, 320, 410, 320),
          door(330, 560, 410, 560),
          door(480, 380, 480, 450),
          windowLine(60, 0, 260, 0),
          windowLine(560, 0, 740, 0),
          windowLine(40, 560, 200, 560),
          windowLine(0, 100, 0, 240),
          windowLine(800, 80, 800, 220),
          furniture("kitchen", 80, 10),
          furniture("fridge", 340, 10),
          furniture("diningTable", 100, 120),
          furniture("sofa", 300, 180),
          furniture("tv", 330, 270),
          furniture("plant", 440, 20),
          furniture("bedDouble", 510, 80),
          furniture("closet", 560, 10),
          furniture("bed", 40, 340),
          furniture("desk", 160, 470),
          furniture("bath", 500, 340),
          furniture("washbasin", 690, 340),
          furniture("washer", 690, 410),
          furniture("toilet", 740, 480),
          furniture("shelf", 300, 340),
        ]),
      ],
      activeFloor: 0,
      selectedId: null,
      roofs: [roof("hip", -40, -40, 880, 640)],
    };
  }

  if (key === "twoStory") {
    return {
      floors: [
        makeFloor("1F", [
          room("LDK", 0, 0, 460, 480, "#ffffff"),
          room("水回り", 460, 0, 260, 240, "#fbfcfd"),
          room("玄関", 460, 240, 260, 240, "#fcfbf9"),
          wall(0, 0, 720, 0),
          wall(720, 0, 720, 480),
          wall(720, 480, 0, 480),
          wall(0, 480, 0, 0),
          wall(460, 0, 460, 480),
          wall(460, 240, 720, 240),
          door(560, 480, 640, 480),
          door(460, 300, 460, 380),
          door(540, 240, 620, 240),
          windowLine(60, 0, 240, 0),
          windowLine(0, 140, 0, 320),
          windowLine(520, 0, 660, 0),
          windowLine(60, 480, 220, 480),
          furniture("kitchen", 40, 10),
          furniture("fridge", 300, 10),
          furniture("diningTable", 60, 120),
          furniture("sofa", 40, 330),
          furniture("tv", 40, 430),
          furniture("stairsU", 270, 290),
          furniture("plant", 410, 20),
          furniture("bath", 480, 20),
          furniture("washbasin", 480, 110),
          furniture("washer", 570, 110),
          furniture("toilet", 660, 140),
          furniture("shelf", 610, 260),
        ]),
        makeFloor("2F", [
          room("寝室", 0, 0, 360, 280, "#ffffff"),
          room("洋室", 360, 0, 360, 280, "#fbfcfd"),
          room("書斎", 0, 280, 240, 200, "#fcfbf9"),
          room("ホール", 240, 280, 240, 200, "#fdfdfc"),
          room("収納", 480, 280, 240, 200, "#fbfcfb"),
          wall(0, 0, 720, 0),
          wall(720, 0, 720, 480),
          wall(720, 480, 0, 480),
          wall(0, 480, 0, 0),
          wall(360, 0, 360, 280),
          wall(0, 280, 720, 280),
          wall(240, 280, 240, 480),
          wall(480, 280, 480, 480),
          door(260, 280, 330, 280),
          door(390, 280, 460, 280),
          door(240, 340, 240, 410),
          door(480, 340, 480, 410),
          windowLine(60, 0, 240, 0),
          windowLine(440, 0, 620, 0),
          windowLine(40, 480, 160, 480),
          windowLine(540, 480, 660, 480),
          windowLine(0, 80, 0, 200),
          furniture("bedDouble", 60, 40),
          furniture("closet", 200, 10),
          furniture("bed", 400, 40),
          furniture("desk", 560, 40),
          furniture("shelf", 620, 180),
          furniture("desk", 40, 320),
          furniture("shelf", 40, 410),
          furniture("stairsU", 270, 290),
          furniture("wardrobe", 520, 300),
          furniture("closet", 520, 400),
        ]),
      ],
      activeFloor: 0,
      selectedId: null,
      roofs: [roof("gable", -40, -40, 800, 560)],
    };
  }

  return {
    floors: [
      makeFloor("1F", [
        room("LDK", 0, 0, 440, 480, "#ffffff"),
        room("寝室", 440, 0, 280, 280, "#fbfcfd"),
        room("玄関", 440, 280, 120, 200, "#fcfbf9"),
        room("水回り", 560, 280, 160, 200, "#fbfcfb"),
        wall(0, 0, 720, 0),
        wall(720, 0, 720, 480),
        wall(720, 480, 0, 480),
        wall(0, 480, 0, 0),
        wall(440, 0, 440, 480),
        wall(440, 280, 720, 280),
        wall(560, 280, 560, 480),
        door(440, 100, 440, 180),
        door(440, 340, 440, 410),
        door(560, 330, 560, 400),
        door(460, 480, 540, 480),
        windowLine(80, 0, 280, 0),
        windowLine(520, 0, 660, 0),
        windowLine(0, 140, 0, 320),
        windowLine(720, 80, 720, 200),
        furniture("kitchen", 60, 10),
        furniture("fridge", 320, 10),
        furniture("diningTable", 80, 120),
        furniture("sofa", 60, 330),
        furniture("table", 250, 320),
        furniture("tv", 250, 430),
        furniture("plant", 400, 430),
        furniture("bed", 470, 60),
        furniture("closet", 540, 10),
        furniture("desk", 590, 200),
        furniture("bath", 570, 290, 140, 70),
        furniture("washbasin", 570, 380),
        furniture("toilet", 670, 380),
      ]),
    ],
    activeFloor: 0,
    selectedId: null,
    roofs: [roof("gable", -40, -40, 800, 560)],
  };
}

function room(name: string, x: number, y: number, w: number, h: number, color: string): Room {
  return { id: newId("room"), type: "room", name, x, y, w, h, color };
}

function wall(x1: number, y1: number, x2: number, y2: number): LinearElement {
  return { id: newId("wall"), type: "wall", x1, y1, x2, y2 };
}

function door(x1: number, y1: number, x2: number, y2: number): LinearElement {
  return { id: newId("door"), type: "door", x1, y1, x2, y2 };
}

function windowLine(x1: number, y1: number, x2: number, y2: number): LinearElement {
  return { id: newId("window"), type: "window", x1, y1, x2, y2 };
}

function furniture(kind: FurnitureKind, x: number, y: number, w = FURNITURE_DEFS[kind].w, h = FURNITURE_DEFS[kind].h): Furniture {
  return { id: newId("furniture"), type: "furniture", kind, x, y, w, h, rotation: 0 };
}

function roof(kind: RoofKind, x: number, y: number, w: number, h: number): Roof {
  return { id: newId("roof"), type: "roof", kind, x, y, w, h };
}

function cloneState(value: PlanState): PlanState {
  return JSON.parse(JSON.stringify(value)) as PlanState;
}

function cloneEntity(value: Entity): Entity {
  return JSON.parse(JSON.stringify(value)) as Entity;
}

function findEntity(id: string): Entity | undefined {
  return state.roofs.find((item) => item.id === id) ?? state.floors.flatMap((floor) => floor.entities).find((entity) => entity.id === id);
}

function removeEntityById(id: string): void {
  state.roofs = state.roofs.filter((item) => item.id !== id);
  state.floors.forEach((floor) => {
    floor.entities = floor.entities.filter((entity) => entity.id !== id);
  });
  if (state.selectedId === id) state.selectedId = null;
}

function isRoom(entity: Entity): entity is Room {
  return entity.type === "room";
}

function isFurniture(entity: Entity): entity is Furniture {
  return entity.type === "furniture";
}

function isTextLabel(entity: Entity): entity is TextLabel {
  return entity.type === "text";
}

function isShape(entity: Entity): entity is Shape {
  return entity.type === "shape";
}

function isLinear(entity: Entity): entity is LinearElement {
  return entity.type === "wall" || entity.type === "door" || entity.type === "window";
}

function isResizable(entity: Entity): entity is Room | Furniture | Roof {
  return entity.type === "room" || entity.type === "furniture" || entity.type === "roof";
}

function isLocked(entity: Entity): boolean {
  return entity.locked === true;
}

function lineAngle(entity: LinearElement): number {
  return Math.atan2(entity.y2 - entity.y1, entity.x2 - entity.x1);
}

function midpoint(entity: LinearElement): Point {
  return {
    x: (entity.x1 + entity.x2) / 2,
    y: (entity.y1 + entity.y2) / 2,
  };
}

function distance(entity: LinearElement): number {
  return Math.hypot(entity.x2 - entity.x1, entity.y2 - entity.y1);
}

function getVisibleWallSegments(wallItem: LinearElement, entities: Entity[]): LinearElement[] {
  return wallSections(wallItem, entities)
    .filter((section) => section.bottom === 0 && section.top === WALL_HEIGHT)
    .map((section) => segmentInterval(wallItem, section.from, section.to));
}

function wallSections(wallItem: LinearElement, entities: Entity[]) {
  const openings = entities.filter((entity): entity is LinearElement & { type: "door" | "window" } => entity.type === "door" || entity.type === "window");
  return solidWallSections(distance(wallItem), openingIntervals(wallItem, openings, WALL_THICKNESS_2D), WALL_HEIGHT, DOOR_HEAD_Y, WINDOW_SILL_Y, WINDOW_HEAD_Y);
}

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

function getEntitiesBounds(entities: Entity[]): Bounds | null {
  if (entities.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  entities.forEach((entity) => {
    if (entity.type === "room" || entity.type === "furniture" || entity.type === "roof") {
      minX = Math.min(minX, entity.x);
      minY = Math.min(minY, entity.y);
      maxX = Math.max(maxX, entity.x + entity.w);
      maxY = Math.max(maxY, entity.y + entity.h);
    } else if (entity.type === "text") {
      const { w, h } = measureTextLabel(entity);
      minX = Math.min(minX, entity.x - w / 2);
      minY = Math.min(minY, entity.y - h / 2);
      maxX = Math.max(maxX, entity.x + w / 2);
      maxY = Math.max(maxY, entity.y + h / 2);
    } else if (entity.type === "shape") {
      minX = Math.min(minX, entity.x - entity.r);
      minY = Math.min(minY, entity.y - entity.r);
      maxX = Math.max(maxX, entity.x + entity.r);
      maxY = Math.max(maxY, entity.y + entity.r);
    } else {
      minX = Math.min(minX, entity.x1, entity.x2);
      minY = Math.min(minY, entity.y1, entity.y2);
      maxX = Math.max(maxX, entity.x1, entity.x2);
      maxY = Math.max(maxY, entity.y1, entity.y2);
    }
  });
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }
  return { x: minX, y: minY, w: Math.max(GRID, maxX - minX), h: Math.max(GRID, maxY - minY) };
}

function getGlobalBounds(): Bounds | null {
  const all = [...state.floors.flatMap((floor) => floor.entities), ...state.roofs];
  return getEntitiesBounds(all);
}

function roomMaterial(roomItem: Room, rect: Rectangle): THREE.MeshStandardMaterial {
  const surface = roomItem.surface ?? "plain";
  const code = roomItem.color3d ?? roomItem.color;
  const color = solidColor(code);
  let material: THREE.MeshStandardMaterial;
  if (surface === "plain") {
    material = new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
  } else {
    const map = new THREE.CanvasTexture(surfaceCanvas(surface, color));
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(rect.w / SURFACE_TILE_CM, rect.h / SURFACE_TILE_CM);
    map.offset.set((rect.x - roomItem.x) / SURFACE_TILE_CM, (roomItem.y + roomItem.h - rect.y - rect.h) / SURFACE_TILE_CM);
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    material = new THREE.MeshStandardMaterial({ map, roughness: SURFACE_DEFS[surface].roughness });
  }
  makeTranslucent(material, colorAlpha(code));
  return material;
}

// カラーコードの末尾2桁（透明度）は、材質の透け具合にする
function coloredMaterial(color: string, roughness = 0.75): THREE.MeshStandardMaterial {
  const key = `${color}-${roughness}`;
  const cached = coloredMaterialCache.get(key);
  if (cached) return cached;
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(solidColor(color)), roughness });
  makeTranslucent(material, colorAlpha(color));
  coloredMaterialCache.set(key, material);
  return material;
}

function translucentSlabMaterial(alpha: number): THREE.MeshStandardMaterial {
  const key = `slab-${alpha}`;
  const cached = coloredMaterialCache.get(key);
  if (cached) return cached;
  const material = slabMaterial.clone();
  makeTranslucent(material, alpha);
  coloredMaterialCache.set(key, material);
  return material;
}

function disposeGroup(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const instanced: THREE.InstancedMesh[] = [];
  group.traverse((object) => {
    if ((object as THREE.InstancedMesh).isInstancedMesh) instanced.push(object as THREE.InstancedMesh);
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const items = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    items.forEach((material) => {
      if (sharedMaterials.has(material)) return;
      materials.add(material);
      const map = (material as THREE.MeshStandardMaterial).map;
      if (map) textures.add(map);
    });
  });
  group.clear();
  instanced.forEach((mesh) => mesh.dispose());
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  coloredMaterialCache.clear();
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy), 0, 1);
  const x = start.x + t * dx;
  const y = start.y + t * dy;
  return Math.hypot(point.x - x, point.y - y);
}

function isPointNearShape(point: Point, shape: Shape): boolean {
  const threshold = Math.max(10 / view.zoom, 6);
  if (shape.kind === "polygon") {
    const points = polygonPoints(shape);
    return points.some((vertex, index) => distanceToSegment(point, vertex, points[(index + 1) % points.length]) < threshold);
  }
  const dist = Math.hypot(point.x - shape.x, point.y - shape.y);
  if (Math.abs(dist - shape.r) > threshold) return false;
  if (shape.kind === "circle") return true;
  return isAngleOnArc(Math.atan2(point.y - shape.y, point.x - shape.x), shape.startAngle, shape.endAngle);
}

function isAngleOnArc(angle: number, start: number, end: number): boolean {
  const sweep = normalizeAngle(end - start);
  const offset = normalizeAngle(angle - start);
  return offset <= sweep + 0.05;
}

function normalizeAngle(angle: number): number {
  const full = Math.PI * 2;
  return ((angle % full) + full) % full;
}

function formatMeters(value: number): string {
  return `${Math.round(value / 10) / 10}m`;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function snap(value: number): number {
  return Math.round(value / GRID) * GRID;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function newId(prefix: EntityType | "floor"): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

// ---- 起動 ----
// ファイルのいちばん最後で起動する。ここまでに、ファイルの中のすべての値（const・let）が用意されているので、
// 起動中の描画やパネルが、まだ用意されていない値を読んで止まることがない
applySavedDisplaySettings();

createIcons({ icons });
setupUi();
fitPlanToCanvas();
render2d();
rebuildThree();
applyViewMode(viewMode, false, true);
if (!PLAN_EDITION) animate3d();
