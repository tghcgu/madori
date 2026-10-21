import { createIcons, icons } from "lucide";
import "./styles.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { SURFACE_DEFS, isRoomSurface, surfaceCanvas, surfaceTileCm, type RoomSurface } from "./surfaces";
import { CAP_COLOR, WALL_STYLES, WALL_THICKNESS_RANGE, isWallStyle, isWallThicknessAdjustable, wallJoints, wallStyleInfo, wallStyleWithThickness, wallTopWidth, type WallStyle, type WallStyleInfo } from "./wall-styles";
import { openingIntervals, segmentInterval, solidWallSections, visibleRectangles, type Rectangle } from "./geometry";
import { readStoredPlan, type Recovery } from "./persistence";
import { FURNITURE_DEFS, FURNITURE_GROUPS, FURNITURE_VARIANTS, FURNITURE_VARIANTS_2D_ONLY, PALETTE_ORDER, type FurnitureKind } from "./furniture-catalog";
import { MORE_DEFS, MORE_SMALL_KINDS, isMorePartKind } from "./furniture-more";
import { colorAlpha, parseColorCode, solidColor, withAlpha } from "./colors";
import { CHANGELOG } from "./changelog";
import { formatDate, getLanguage, initI18n, isLanguage, onLanguageChange, setLanguage, t } from "./i18n";
import { TEMPLATE_GROUPS, hasTemplatePlan, templatePlan } from "./templates";
import { makeTranslucent } from "./translucency";
import {
  DEFAULT_PIXEL_DOT, PIXEL_DOTS, PLAN_BACKGROUNDS, PLAN_STYLES, PLAN_STYLE_GROUPS, RETRO_INK, STYLE_LOOKS, createPixelContext, drawPixelTexts, isDotStyle,
  lookStyle, retroColors, styleContext, styleFinish, styledFont, type PixelText, type PlanBackground, type PlanStyle,
} from "./plan-style";
import {
  AO_FRAGMENT_SHADER, POST_FRAGMENT_SHADER, POST_VERTEX_SHADER, REAL_COMPOSITE_FRAGMENT_SHADER, REAL_FRAGMENT_DECLARATIONS, REAL_VERTEX_BODY, REAL_VERTEX_DECLARATIONS, THREE_STYLES, THREE_STYLE_GROUPS,
  isPostStyle, isThreeStyle, postStyleId, realColorCode, realMaterialKind, realSurfaceCode, type ThreeStyle,
} from "./three-style";
import {
  FREE_AREA_KINDS, FREE_LINE_KINDS, FREE_WIDTH_RANGE, RAILWAY, curveThrough, defaultFreePath, freeRiverRipples, sharpCorners, distanceToFreeLine, freeCenterLine, freeFlowerBed, freeFrame, freeLawn, freeLineWidth, freeMargin,
  freeOutline, freePathPoints, freePond, freePosts, freeSteppingStones, isAlwaysFreeKind, isFreeAreaKind, isFreeShapeKind, isFreeWidthAdjustable,
  offsetFreeLine, freeHoleOutlines, freeHolePoints, normalizeFreeHoles, pointInFreeRegion, type FreeKind,
} from "./free-shapes";
import {
  CONIFER_TIERS, PALM_FROND_ANGLES, PETAL_ANGLES, PLANT_LEAF_ANGLES, RIPPLE_END, RIPPLE_START, ROUND_LEAF_CLUMPS,
  closetDoorCount, fernFronds, flowerBedLayout, pondShape, rockShapes, steppingStoneLayout, woodGrain, type RockShape,
  CAT_TOWER_DECKS, COAT_HOOK_ANGLES, COAT_HOOK_REACH, DRYER_POLES, GRAVE_PARTS, PARASOL_CORNERS,
  blockWallCaps, cribRail, dryerFootWidth, roundFlowerBedLayout, spiralPlantTopView,
  CHALK_WIDTH, SHARD_SPREAD, bloodShape, evidenceMarkerShape, markerTextSize, markerTextureSpan, shardMargin, shardPieces, shardTrail,
  FOOTPRINT_STRIDE, footprintPathTrail, footprintPieces,
  PERSON_HEIGHT, PERSON_PRESETS, POSTURES, editablePersonPose, normalizePersonPose, personDesign, personLayout, personOutline, personRefSize, presetPose, reachHandle,
  type LimbAngles, type PersonLayout, type PersonPose, type Point2, type Posture, type StoneSlab, type TrunkAngles,
  PART_MATERIALS, furnitureParts, isPartKind, partSpan,
} from "./furniture-shapes";
import { buildFurnitureModel } from "./furniture-models";
import { buildOpeningModel } from "./opening-models";
import {
  DOOR_COLORS, DOOR_STYLES, doorStyleInfo, doubleLeaves, gateSlats, isDoorStyle, panelBars, panelThickness, slidingPanels, trackOffset, type DoorStyle,
} from "./opening-shapes";
import { translateSelection } from "./selection";
import { STAIR_KINDS, incomingStairs, isStair, sameStairPlacement, stairsBelow } from "./stairs";
import { layoutText, type TextLayout, type WritingMode } from "./text-layout";
import { floorPoints, floorPolygon, multiPolygonTester, normalizeOutline, normalizeFloorHoles, outlineFromPoints, pointInPolygon, tracedFloorPoints, visibleFloorPolygons, MAX_FLOOR_VERTICES } from "./floor-outline";
import { openTemplateStairwells } from "./template-floors";
import { BRUSH_WIDTH_RANGE, MAX_FREE_RING_POINTS, brushStroke, clampBrushWidth, floorFromRegion, regionsOverlap, subtractRegion, tidyRegion, unionRegions, type FloorRegion } from "./brush-area";
import clipping, { type MultiPolygon, type Pair } from "polygon-clipping";
import { centeredFloorSize, floorPreset, isEllipseFloor, presetOutline, regularFloor, regularFloorOutline, regularFloorSize, regularFloorSides, type FloorPreset } from "./floor-editing";
import { ROOF_LABELS, isRoofKind, isRadialRoof, roofOutline, roofSides, roofRise, regularRoofSize, radialRoofModel, type RoofKind } from "./roof-shapes";

// 間取り専用版（3Dなし）。/plan/ で開いたとき（index.html の先頭で印を付ける）は、同じアプリで3Dの欄と3Dだけの設定を出さない。
// 間取りのデータは本体と同じ所に保存するので、どちらで開いても同じ間取りを続けて編集できる
const PLAN_EDITION = document.documentElement.dataset.edition === "plan";
// 上のバーの「間取り専用版もできました」のお知らせと、開発中の注意書きを消したか
const EDITION_NOTICE_KEY = "madori-quick-3d-plan-edition-notice";
const ALPHA_NOTE_KEY = "madori-quick-3d-alpha-note";

type Tool = "select" | "paint" | "room" | "floor" | "wall" | "door" | "slidingDoor" | "window" | "window2" | "furniture" | "circle" | "ellipse" | "arc" | "polygon" | "text" | "erase";
type EntityType = "room" | "wall" | "door" | "window" | "furniture" | "shape" | "roof" | "text";
type ShapeKind = "circle" | "ellipse" | "arc" | "polygon";
type LegacyRoofKind = RoofKind | "none";
type LightDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw" | "top";
type DragMode = "draw" | "move" | "resize" | "label" | "pan" | "path" | "pose" | "marquee" | "none";
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
  labelSize?: number;
  writingMode?: WritingMode;
  outline?: [number, number][];
  holes?: [number, number][][];
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
  // ドアの種類（開き戸のときは持たない）
  doorStyle?: DoorStyle;
  // 壁の種類（ふつうの壁のときは持たない）
  wallStyle?: WallStyle;
  // 壁の厚み cm（種類の標準の厚みのときは持たない）
  thickness?: number;
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
  // 池・花壇・芝生・ラグの穴（道すじと同じ割合の輪）。穴がなければ持たない
  holes?: number[][][];
  // 取り込んだ画像（data URL）と、その濃さ（1 より小さいと透ける。1 のときは持たない）
  image?: string;
  opacity?: number;
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
  ry?: number;
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
  sides?: number;
  rotation?: number;
  rise?: number;
  // 置く高さのずれ cm（設置階の壁の上から、上げるとプラス・下げるとマイナス）。なければ 0
  elevation?: number;
  // 屋根の色（カラーコード。末尾2桁で透かせる）。なければ標準の灰色（ROOF_COLORS の先頭）
  color?: string;
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
  writingMode?: WritingMode;
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
  // 押した所にあった物（描くツールでのクリック・どのツールでも長押しで選ぶ物）
  pressedId?: string;
  // 置くツールで、押した所に物があったとき: 置く・消すのは、指を離すか動かすまで待つ（長押しで選べるように）
  pending?: "furniture" | "text" | "erase";
  origins?: Entity[];
  createdId?: string;
}

interface ThreeDrag {
  pointerId: number;
  startScreen: Point;
  startWorld: Point;
  origin: Entity;
  planeY: number;
  created: boolean;
  moved: boolean;
  origins?: Entity[];
  // 置くツールで押したとき、押した所にあった物（続けてもう1回押したら、それを選ぶ）
  pressedId?: string;
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
const combineInput = requiredElement<HTMLInputElement>("#combineInput");
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
const MIN_CAMERA_FOCUS_DISTANCE = 1;
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
// 屋根を上げ下げできる幅（cm）
const ROOF_ELEVATION_LIMIT = 3000;
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
const GRASS_FREE_KINDS: FurnitureKind[] = ["pond", "steppingStones", "rug", "flowerBed", "lawn", "river", "pathway", "railway"];

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


// 床に付いた跡（足跡・血）は、2Dの色をそのまま跡の塗りにする。色を決めていないときの塗り
const MARK_FILLS: Partial<Record<FurnitureKind, string>> = { footprints: "#6b625a", bloodPool: "#a3201c", brokenGlass: "#dcedf4" };
// 番号の印に書ける文字数
const MAX_MARKER_LABEL = 4;

// 検索で表記ゆれ（ひらがな・別名）を拾うための語。表示名と分類名は自動で検索対象になる
const SEARCH_KEYWORDS: Record<string, string> = {
  tatami: "たたみ 和室", zabuton: "ざぶとん 座蒲団 和室", chabudai: "座卓 ちゃぶだい 和室",
  byobu: "びょうぶ 間仕切り", shojiScreen: "しょうじ ついたて 間仕切り", andon: "あんどん 照明 灯り",
  stepTansu: "かいだんだんす 階段たんす 箪笥 収納", irori: "いろり 暖房 炉", hibachi: "ひばち 暖房",
  engawa: "えんだい 縁側 えんがわ ベンチ", hinokiBath: "ひのきぶろ 檜 ヒノキ 浴槽 風呂", tsukubai: "蹲 つくばい 手水鉢 ちょうずばち 庭 和風",
  butsudan: "ぶつだん 仏 ほとけ 位牌 いはい 和室", kamidana: "かみだな 神 かみ 神社 お札 おふだ 榊 さかき 壁 かべ 和室",
  tokonoma: "とこのま 掛け軸 かけじく 床柱 とこばしら 生け花 いけばな 和室 座敷", kamado: "かまど 竈 へっつい 釜 かま 土間 どま 台所 だいどころ 古民家",
  washikiToilet: "わしきといれ 和式 便器 べんき 便所 べんじょ トイレ", chochin: "ちょうちん 赤提灯 あかちょうちん 灯り あかり 居酒屋 いざかや 祭り まつり",
  takegaki: "たけがき 竹 たけ 垣根 かきね 生垣 柵 さく 庭 にわ 和風 屋外 外 そと", ido: "いど 井筒 いづつ つるべ 水 みず 古民家 庭 にわ 屋外 外 そと",
  torii: "とりい 神社 じんじゃ 鳥居 朱 しゅ 稲荷 いなり 参道 さんどう 屋外 外 そと", komainu: "こまいぬ 狛犬 獅子 しし 神社 じんじゃ 石像 せきぞう 像",
  saisenBako: "さいせんばこ 賽銭 さいせん お賽銭 おさいせん 神社 じんじゃ 寺 てら", chozubachi: "ちょうずばち 手水 ちょうず 手水舎 ちょうずや 柄杓 ひしゃく 神社 じんじゃ 寺 てら",
  blackboard: "こくばん 黒板 チョーク 教室 きょうしつ 学校 がっこう", whiteboard: "ほわいとぼーど ボード 会議 かいぎ 事務所 じむしょ 学校 がっこう",
  lectern: "きょうたく 教壇 きょうだん 演台 えんだい 講義 こうぎ 教室 きょうしつ", schoolDesk: "がっこう 学習机 つくえ 机 いす 椅子 教室 きょうしつ 生徒 せいと",
  locker: "ろっかー 更衣室 こういしつ 収納 しゅうのう 学校 がっこう 事務所 じむしょ", copier: "こぴーき コピー機 ふくごうき プリンター 印刷 いんさつ 事務所 じむしょ",
  partition: "ぱーてぃしょん ついたて 衝立 間仕切り まじきり 事務所 じむしょ", safe: "きんこ 金庫 お金 おかね 銀行 ぎんこう 事務所 じむしょ",
  fireExtinguisher: "しょうかき 消火 しょうか 火事 かじ 防災 ぼうさい", counter: "かうんたー 受付 うけつけ レジ バー 台 だい 店 みせ",
  showcase: "しょーけーす ガラスケース 陳列 ちんれつ ケーキ 宝石 ほうせき 店 みせ", displayShelf: "ちんれつだな 商品棚 しょうひんだな ゴンドラ スーパー コンビニ 店 みせ",
  vendingMachine: "じどうはんばいき 自販機 じはんき ジュース 飲み物 のみもの 屋外 外 そと", signboard: "たてかんばん 看板 かんばん 黒板 メニュー 店 みせ カフェ",
  barStool: "かうんたーちぇあ ハイスツール 椅子 いす イス バー カウンター", hospitalBed: "びょういん 介護 かいご ベッド ベット 寝台 病室 びょうしつ",
  ivStand: "てんてき 点滴 病院 びょういん 医療 いりょう", wheelchair: "くるまいす 車イス 介護 かいご 病院 びょういん",
  examCouch: "しんさつだい 診察 しんさつ ベッド 病院 びょういん 保健室 ほけんしつ", slide: "すべりだい 滑り台 遊具 ゆうぐ 公園 こうえん 子供 こども 屋外 外 そと",
  jungleGym: "じゃんぐるじむ 遊具 ゆうぐ 公園 こうえん 子供 こども 屋外 外 そと", ironBar: "てつぼう 鉄棒 逆上がり さかあがり 遊具 ゆうぐ 公園 こうえん 校庭 こうてい",
  sandbox: "すなば 砂 すな 遊具 ゆうぐ 公園 こうえん 子供 こども 屋外 外 そと", vaultingBox: "とびばこ 体育 たいいく 体育館 たいいくかん",
  pingPongTable: "たっきゅうだい 卓球 たっきゅう ピンポン 台 だい", poolTable: "びりやーど ビリヤード 撞球 どうきゅう 台 だい バー",
  drumKit: "どらむ 太鼓 たいこ 楽器 がっき バンド ライブ 音楽 おんがく", stage: "すてーじ 舞台 ぶたい 壇 だん 演台 えんだい ライブ 体育館 たいいくかん",
  fountain: "ふんすい 噴水 水 みず 公園 こうえん 広場 ひろば 屋外 外 そと", statue: "せきぞう 石像 銅像 どうぞう 像 ぞう 彫刻 ちょうこく 公園 こうえん",
  campfire: "たきび 焚き火 キャンプ ファイヤー 火 ひ 屋外 外 そと", tent: "てんと キャンプ 野営 やえい 屋外 外 そと",
  westernGrave: "はか 墓 お墓 十字架 じゅうじか 墓地 ぼち 教会 きょうかい 洋風 屋外 外 そと", trafficCone: "からーこーん パイロン 三角コーン 工事 こうじ 道路 どうろ",
  utilityPole: "でんちゅう 電柱 電信柱 でんしんばしら 電線 でんせん 道路 どうろ 屋外 外 そと", busStop: "ばすてい バス停 停留所 ていりゅうじょ 標識 ひょうしき 道路 どうろ",
  phoneBooth: "でんわぼっくす 電話 でんわ 公衆電話 こうしゅうでんわ 屋外 外 そと", manhole: "まんほーる ふた 蓋 下水 げすい 道路 どうろ",
  drum: "どらむかん ドラム缶 缶 かん 工場 こうじょう 倉庫 そうこ", bus: "ばす 乗り物 のりもの 車 くるま",
  cardboard: "だんぼーる 段ボール 箱 はこ 荷物 にもつ 引っ越し ひっこし 倉庫 そうこ", acOutdoor: "しつがいき 室外機 エアコン ベランダ 屋外 外 そと",
  fan: "せんぷうき 扇風機 夏 なつ 風 かぜ", stove: "すとーぶ 石油ストーブ 暖房 だんぼう やかん 冬 ふゆ",
  curtain: "かーてん 窓 まど 布 ぬの 仕切り しきり", treasureChest: "たからばこ 宝 たから 箱 はこ ダンジョン",
  barrel: "たる 樽 酒樽 さかだる ワイン 倉庫 そうこ 酒場 さかば", crate: "きばこ 木箱 箱 はこ 荷物 にもつ 倉庫 そうこ",
  throne: "ぎょくざ 玉座 王 おう 椅子 いす 城 しろ 王座 おうざ", altar: "さいだん 祭壇 教会 きょうかい 神殿 しんでん 燭台 しょくだい ろうそく",
  coffin: "ひつぎ 棺 棺桶 かんおけ 葬儀 そうぎ 吸血鬼 きゅうけつき", cage: "おり 檻 牢 ろう 牢屋 ろうや 鉄格子 てつごうし 動物 どうぶつ",
  brazier: "かがりび 篝火 たいまつ 松明 火 ひ 神社 じんじゃ 城 しろ",
  evidenceMarker: "ばんごう 番号 数字 すうじ 印 しるし マーカー 証拠 しょうこ 札 ふだ 事件 じけん 調査 ちょうさ 探索 TRPG",
  footprints: "あしあと 足 あし 靴 くつ 素足 はだし 跡 あと 痕跡 こんせき 事件 じけん TRPG",
  fallenPerson: "ひと 人 人型 ひとがた 死体 したい 遺体 いたい 倒れた たおれた 被害者 ひがいしゃ チョーク 事件 じけん TRPG 模型 もけい マネキン ポーズ",
  person: "ひと 人 人間 にんげん 人物 じんぶつ 人型 ひとがた 模型 もけい マネキン ポーズ 立つ たつ 立っている 座る すわる 歩く あるく TRPG",
  bloodPool: "ち 血 血痕 けっこん 血だまり ちだまり しぶき 跡 あと 事件 じけん TRPG",
  lawn: "しばふ 芝 しば にわ 庭 くさ 草 くさはら 草原 ぐらうんど 自由な形 なぞる",
  river: "かわ 川 みず 水 おがわ 小川 すいろ 水路 ながれ 流れ 自由な形 なぞる",
  pathway: "こみち 小道 みち 道 さんどう 参道 ほどう 歩道 じゃり 砂利 散歩道 自由な形 なぞる",
  hedge: "いけがき 生垣 かきね 垣根 うえこみ 植え込み しげみ 茂み 自由な形 なぞる",
  stoneWall: "いしがき 石垣 いしづみ 石積み しろ 城 へい 塀 自由な形 なぞる",
  railway: "せんろ 線路 てつどう 鉄道 でんしゃ 電車 れーる レール まくらぎ 枕木 えき 駅 自由な形 なぞる",
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
  grave: "はか 墓 お墓 ぼせき ぼち 墓地 霊園 れいえん 寺 てら 石 いし 屋外 外 そと",
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
  // 方眼の大きさを決めたときの、画像の1マスの px（0 ならおまかせ）
  cell: number;
  // 背景を透明にする
  transparent: boolean;
}

const imageExportSettings: ImageExportSettings = { floors: "current", grid: true, names: true, cell: 0, transparent: false };
const EXPORT_CELLS = [0, 50, 64, 70, 100, 128, 140];

// 表示の切り替え（部屋名・部屋の広さ・方眼の表示と大きさ）。ブラウザに覚える
type RoomAreaUnit = "none" | "jo" | "m2";
const GRID_SIZES = [0, 25, 50, 91, 100, 150, 182, 200, 300];
const displaySettings: { names: boolean; area: RoomAreaUnit; grid: boolean; gridSize: number } = { names: true, area: "none", grid: true, gridSize: 0 };
// 書き出しでは、方眼の大きさをまとめずにそのまま使う（画像のマス目をきっちり合わせる）
let exactGrid = false;

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
// 一覧で選んでいるドアの種類（ドア・両開きドア・引き戸・障子・襖など）
let activeDoorStyle: DoorStyle = "swing";
// 種類ごとに最後に選んだ2D記号。続けて置く家具も同じ描き方にそろえる（見ていた場所などと一緒にブラウザへ保存）
const lastSymbolByKind: Partial<Record<FurnitureKind, number>> = {};
let activeRoomSurface: RoomSurface = "plain";
// 壁のツールで次に描く壁の種類
let activeWallStyle: WallStyle = "plain";
// 形をなぞって描き直している床（部屋のツールで、次になぞった形・四角をこの床に当てる）
let floorRetraceId: string | null = null;
let floorDraft: { floorId: string; target: string; points: [number, number][]; undone: [number, number][]; hover: Point | null } | null = null;
// 描き方。ペン・なぞれる物（池・川・足跡など）・床を、ペンでなぞって描くか、点を打って直線か曲線でつなぐか。物ごとに覚える（ブラウザに保存）
// 描き方: なぞる（線の物は道すじ、床や池などの閉じる形は囲む）、点を打つ直線・曲線、ペンで塗る（床と、池などの閉じる形だけ）
type DrawMethod = "trace" | "straight" | "curve" | "brush";
const DRAW_METHODS: DrawMethod[] = ["trace", "straight", "curve", "brush"];
const drawMethods: Record<string, DrawMethod> = {};
// ペンで塗る幅（cm）。床と、池・花壇・芝生・ラグの種類ごとに覚える
const brushWidths: Record<string, number> = {};
// ペンで塗るときに、塗るのではなく、塗った所をけずるか
let brushCut = false;
// まっすぐ描くことが多い物は、はじめから直線
const STRAIGHT_DRAW_KINDS = new Set<string>(["stoneWall", "takegaki", "fence", "hedge", "railway"]);
let floorEdit: { id: string; vertex: number | null } | null = null;
let floorEditError = "";
let floorToolbar: HTMLDivElement | null = null;
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
// 「なぞり直す」を押した足跡・破片（次になぞった道すじで描き直す）
let pathRedrawId: string | null = null;
// 手足を動かしている間の3Dの描き直し。1コマに1回だけにし、選択中のパネルは作り直さない（動かしているスライダーが外れないように）
let threeRefreshQueued = false;
// ペンの色・太さ・描き方（見ていた場所などと一緒にブラウザへ保存）
const PEN_DEFAULT_COLOR = "#9b1c17";
const DEFAULT_BRUSH = 15;
// ペンで描く物。ペンの線のほかに、川・小道・池などの自由な形もペンでなぞって描ける（「描く物」の欄の並び）
const PEN_KINDS = ["paint", "river", "pathway", "hedge", "stoneWall", "fence", "takegaki", "railway", "steppingStones", "pond", "flowerBed", "lawn", "rug"] as const;
type PenKind = (typeof PEN_KINDS)[number];
const penSettings: { color: string; brush: number; filled: boolean; kind: PenKind } = { color: PEN_DEFAULT_COLOR, brush: DEFAULT_BRUSH, filled: false, kind: "paint" };
const MAX_BRUSH = 300;
// ペン先の見本（いまの太さ・色の丸）。マウスを乗せている間と描いている間はペン先に、太さを変えている間は少しのあいだ画面の真ん中に出す
let penCursor: Point | null = null;
let penSizePreview = false;
let penSizePreviewTimer = 0;
let penCursorFrame = 0;
// 次になぞって描く破片の、まく幅と量（選んだ破片で変えると、次からもそれを使う）
const shardSettings: { spread: number; density: number } = { spread: SHARD_SPREAD, density: 1 };
const SHARD_DENSITIES: [number, string][] = [[0.5, "少なめ"], [1, "ふつう"], [2, "多め"]];
// 2Dの絵柄（標準・ドット・筆と和風）と、ドットの大きさ（見ていた場所などと一緒にブラウザへ保存）
let planStyle: PlanStyle = "standard";
// 2Dの背景（地の色・方眼・紙の模様）。"auto" なら線画の絵柄に合わせる
let planBackground: PlanBackground = "auto";
let pixelDot = DEFAULT_PIXEL_DOT;
// 屋根の色の見本。先頭が標準の色（3Dの屋根の材質と同じ）
const ROOF_COLORS: [string, string][] = [
  ["#5d6773", "いぶし瓦（標準）"], ["#2f3338", "黒"], ["#8d949c", "銀"], ["#9c4a2f", "赤茶（洋瓦）"], ["#c8452f", "朱"], ["#6b4b35", "こげ茶"],
  ["#b59a6a", "かやぶき"], ["#5e9c8b", "緑青（銅板）"], ["#2f6b4f", "緑"], ["#3f5f8c", "青"], ["#2c3e66", "紺"], ["#e8e4da", "白"],
];
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
// 絵柄を付けて描いている間の設定（標準の絵柄で描いている間は null）。
// raw は絵柄を付けない描き先（方眼）、overlays はあとで絵柄なしで上に描く物（選択のつまみ・作図中の線など）、
// layer はほかのキャンバス（透かす階・透明度のある色）にも同じ絵柄を付ける関数、texts はドットの絵柄であとから描く文字
interface StylePass {
  style: PlanStyle;
  // 地の色・方眼に使う絵柄（背景）
  look: PlanStyle;
  raw: CanvasRenderingContext2D;
  overlays: (() => void)[];
  layer: (raw: CanvasRenderingContext2D, keepTexts: boolean) => CanvasRenderingContext2D;
  texts: PixelText[];
  alpha: number;
}
let stylePass: StylePass | null = null;
// ドットの絵柄の作業用のキャンバス（細かく描く所・ドットにした所・レトロゲームの4色にした所・文字）
let pixelSourceCanvas: HTMLCanvasElement | null = null;
let pixelDotCanvas: HTMLCanvasElement | null = null;
let retroCanvas: HTMLCanvasElement | null = null;
let pixelTextCanvas: HTMLCanvasElement | null = null;

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
// ほかのツールのまま物を選ぶ。描くツールではクリックで、置くツールでは長押し（動かさずに押し続ける）で選ぶ
const LONG_PRESS_MS = 450;
// 押してから離すまでにこれより動かなければクリック（画面のpx）
const CLICK_SLOP = 5;
// 置く・消すツールのまま、同じ所を続けて押したら（ダブルクリック・2回タップ）、そこにある物を選ぶ。
// 1回目のクリックで置いた（消した）物は取り消す。何もない所に置いたときは、置いた物を選ぶ
const DOUBLE_PRESS_MS = 500;
interface LastClick { at: number; x: number; y: number; history: number; select: string | null; revert: boolean }
let lastPlanClick: LastClick | null = null;
let lastThreeClick: LastClick | null = null;
let longPressTimer = 0;
let longPressPoint: Point | null = null;
let pressRing: HTMLDivElement | null = null;
let toolHint: HTMLDivElement | null = null;
const multiSelection = new Set<string>();
let selectionFloor = -1;
// Ctrl+C でコピーした物。同じ階へ貼るたびに、少しずつずらして置く
let clipboard: { floorId: string; entities: Entity[]; pastes: number } | null = null;
let threePointerDown: Point | null = null;
let threeDrag: ThreeDrag | null = null;
let threeMoveId: string | null = null;
// 3Dの移動モード（ボタンで入れる）。押した物（床・壁・ドア・窓・屋根・家具など）を、そのままドラッグで動かす
let threeMoveMode = false;
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
// 影は、物や光が変わったときだけ描き直す（視点を動かすだけなら前の影をそのまま使う）
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9edf3);
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = true;
controls.minDistance = MIN_CAMERA_DISTANCE;
controls.maxDistance = MAX_CAMERA_DISTANCE;
// 奥まで寄れるよう、マウスのある場所に向かって拡大縮小する。1目盛りの倍率は2Dとほぼ同じ
controls.zoomToCursor = true;
controls.zoomSpeed = 2;
// 回す向きに制限は付けない（真上から真下まで。下から見上げることもできる）。真上・真下ちょうどは向きが決まらないので、ごくわずか手前で止める
controls.minPolarAngle = 0;
controls.maxPolarAngle = Math.PI;
// 左ドラッグ（指1本）の回転は、押した所を中心に回すため自前で行う（startThreeOrbit）。拡大縮小と平行移動は OrbitControls のまま
controls.enableRotate = false;
controls.addEventListener("change", () => {
  // 注視点の手前で前進が止まらないよう、近づいたら視線の先へ送る。カメラの位置と向きは変えない。
  if (camera.position.distanceToSquared(controls.target) < MIN_CAMERA_FOCUS_DISTANCE ** 2) {
    camera.getWorldDirection(controls.target).multiplyScalar(MIN_CAMERA_FOCUS_DISTANCE).add(camera.position);
  }
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
// 影の地図の細かさが足りない所で、面が自分の影を縞模様に落とさないようにする（屋根の斜面などに出ていた）
sunLight.shadow.bias = -0.0004;
sunLight.shadow.normalBias = 0.04;
scene.add(sunLight);

const coloredMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f1ec, roughness: 0.78, name: "plaster-wall" });
const wallCapMaterial = new THREE.MeshStandardMaterial({ color: 0xe2ddd5, roughness: 0.8, name: "plaster-cap" });
const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x405064, transparent: true, opacity: 0.55 });
const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x5d6773, roughness: 0.86, side: THREE.DoubleSide, name: "roof-tile" });
const slabMaterial = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.85, name: "concrete-slab" });
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
  imageExport?: { floors?: string; grid?: boolean; names?: boolean; cell?: number; transparent?: boolean };
  // 「組み合わせ」の置き方
  combine?: string;
  pen?: { color?: string; brush?: number; filled?: boolean; kind?: string };
  drawMethods?: Record<string, string>;
  brushes?: Record<string, number>;
  display?: { names?: boolean; area?: string; grid?: boolean; gridSize?: number };
  shards?: { spread?: number; density?: number };
  look?: { style?: string; dot?: number; background?: string };
  // 3Dの絵柄
  look3d?: string;
}

const viewState: SavedViewState = loadViewState();
// 3Dの絵柄（three-style.ts）。標準とリアル以外は、描いたあとに画面全体へ効果をかける
let threeStyle: ThreeStyle = isThreeStyle(viewState.look3d) ? viewState.look3d : "standard";
// 起動して元に戻し終えるまでは、途中の表示で記録を上書きしない
let viewStateReady = false;
let viewStateTimer = 0;

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
    ...(item.kind === "polygon" ? {
      ...regularRoofSize({ x, y, w: Math.max(GRID * 2, w), h: Math.max(GRID * 2, h) }),
      sides: roofSides(item.sides),
      rotation: typeof item.rotation === "number" && Number.isFinite(item.rotation) ? ((item.rotation % 360) + 360) % 360 : 0,
    } : {}),
    rise: isRadialRoof(item.kind) && typeof item.rise === "number" && Number.isFinite(item.rise) ? clamp(item.rise, 10, 2000) : undefined,
    floorId: typeof item.floorId === "string" ? item.floorId : undefined,
    elevation: roofElevation(item.elevation) || undefined,
    locked: item.locked === true ? true : undefined,
    color: parseColorCode(item.color)?.code,
  };
}

// 屋根を置く高さのずれ（cm）。数でなければ 0
function roofElevation(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? clamp(Math.round(value), -ROOF_ELEVATION_LIMIT, ROOF_ELEVATION_LIMIT) : 0;
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
        labelSize: finite(entity.labelSize) ? clamp(entity.labelSize!, 5, 500) : undefined,
        writingMode: entity.writingMode === "vertical" ? "vertical" : undefined,
        outline: normalizeOutline(entity.outline),
        holes: normalizeFloorHoles(entity.holes, normalizeOutline(entity.outline)),
      };
    }
    if (!Object.prototype.hasOwnProperty.call(FURNITURE_DEFS, entity.kind)) throw new Error("Unknown furniture kind");
    return {
      ...entity, ...base, color: color(entity.color), color3d: color(entity.color3d),
      rotation: finite(entity.rotation) ? entity.rotation : 0,
      symbol: validSymbol(entity.kind, entity.symbol) || undefined,
      markerLabel: entity.kind === "evidenceMarker" && typeof entity.markerLabel === "string" ? entity.markerLabel.slice(0, MAX_MARKER_LABEL) : undefined,
      path: entity.kind === "footprints" || entity.kind === "brokenGlass" || isFreeShapeKind(entity.kind) ? normalizeFootprintPath(entity.path) : undefined,
      holes: isFreeAreaKind(entity.kind) && normalizeFootprintPath(entity.path) ? normalizeFreeHoles(entity.holes) : undefined,
      image: entity.kind === "image" && typeof entity.image === "string" && IMAGE_DATA_URL.test(entity.image) && entity.image.length <= MAX_IMAGE_DATA ? entity.image : undefined,
      opacity: entity.kind === "image" && finite(entity.opacity) && entity.opacity! < 1 ? clamp(entity.opacity!, 0.05, 1) : undefined,
      stride: entity.kind === "footprints" && finite(entity.stride) ? clamp(Math.round(entity.stride!), MIN_STRIDE, MAX_STRIDE) : undefined,
      pose: isPersonKind(entity.kind) ? normalizePersonPose(entity.pose) : undefined,
      ...(entity.kind === "brokenGlass" ? {
        brush: finite(entity.brush) ? clamp(Math.round(entity.brush!), 5, MAX_BRUSH) : undefined,
        density: SHARD_DENSITIES.some(([value]) => value === entity.density) ? entity.density : undefined,
      } : {}),
      ...(isFreeWidthAdjustable(entity.kind) ? {
        brush: finite(entity.brush) ? clamp(Math.round(entity.brush!), FREE_WIDTH_RANGE.min, FREE_WIDTH_RANGE.max) : undefined,
      } : {}),
      ...(entity.kind === "paint" ? {
        path: normalizePaintPath(entity.path),
        brush: finite(entity.brush) ? clamp(Math.round(entity.brush!), 1, MAX_BRUSH) : DEFAULT_BRUSH,
        filled: entity.filled === true ? true : undefined,
      } : {}),
      height: FURNITURE_DEFS[entity.kind].height !== undefined && finite(entity.height)
        ? clamp(Math.round(entity.height!), isPartKind(entity.kind) ? 1 : MIN_FURNITURE_HEIGHT, MAX_FURNITURE_HEIGHT)
        : undefined,
    };
  }
  if (entity.type === "wall" || entity.type === "door" || entity.type === "window") {
    if (!finite(entity.x1, entity.y1, entity.x2, entity.y2)) throw new Error("Invalid line coordinates");
    const line = { ...entity, ...base, color: color(entity.color), color3d: color(entity.color3d) } as LinearElement;
    // ドアの種類は知っている物だけ。開き戸（ふつうのドア）は持たない
    if (line.type !== "door" || !isDoorStyle(line.doorStyle) || line.doorStyle === "swing") delete line.doorStyle;
    // 壁の種類も知っている物だけ。ふつうの壁は持たない
    if (line.type !== "wall" || !isWallStyle(line.wallStyle) || line.wallStyle === "plain") delete line.wallStyle;
    // 厚みは壁だけ。範囲に収め、種類の標準と同じなら持たない
    if (line.type === "wall" && finite(line.thickness)) {
      const thickness = clamp(Math.round(line.thickness!), WALL_THICKNESS_RANGE.min, WALL_THICKNESS_RANGE.max);
      if (thickness === wallStyleInfo(line.wallStyle).thickness || !isWallThicknessAdjustable(wallStyleInfo(line.wallStyle))) delete line.thickness;
      else line.thickness = thickness;
    } else delete line.thickness;
    return line;
  }
  if (entity.type === "shape" && ["circle", "ellipse", "arc", "polygon"].includes(entity.kind)) {
    if (!finite(entity.x, entity.y, entity.r) || entity.r <= 0) throw new Error("Invalid shape");
    if (entity.kind === "ellipse" && entity.ry !== undefined && (!finite(entity.ry) || entity.ry <= 0)) throw new Error("Invalid ellipse");
    return {
      ...entity, ...base, color: color(entity.color), color3d: color(entity.color3d),
      startAngle: finite(entity.startAngle) ? entity.startAngle : 0,
      ry: entity.kind === "ellipse" ? entity.ry ?? entity.r : undefined,
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
      writingMode: entity.writingMode === "vertical" ? "vertical" : undefined,
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
  renderer.shadowMap.needsUpdate = true;
  const [x, y, z] = LIGHT_POSITIONS[lightDirection];
  sunLight.position.set(x, y, z);
  // castShadow の切替はシェーダー再構築が必要で確実に効かないため、影の濃度を0にする方式にする
  sunLight.shadow.intensity = shadowsEnabled ? 1 : 0;
  const level = LIGHT_LEVELS[lightLevel - 1];
  // リアルでは、周りの映り込み（scene.environment）が明るさを足すので、空の光を弱める
  const real = threeStyle === "real";
  const ambient = real ? 0.36 : 1;
  sunLight.color.set(real ? 0xfff0dc : 0xffffff);
  hemiLight.color.set(real ? 0xdde8ff : 0xffffff);
  if (shadowsEnabled) {
    // 通常: 太陽光で立体感を出す
    sunLight.intensity = (real ? 3.2 : 2.4) * level;
    hemiLight.intensity = 1.6 * level * ambient;
    hemiLight.groundColor.set(real ? 0x9c8f7c : 0xaeb7c3);
  } else {
    // 影オフ: 太陽光を完全に消し、均一な環境光のみのフラットな見た目にする
    sunLight.intensity = 0;
    hemiLight.intensity = 3.5 * level * ambient;
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
      cancelPlanDrag();
      activeTool = button.dataset.tool as Tool;
      floorDraft = null;
      floorEdit = null;
      floorEditError = "";
      pathRedrawId = null;
      floorRetraceId = null;
      penCursor = null;
      // ペンでは選択を外し、選択中の欄にペンの色・太さを出す
      if (activeTool === "paint" || activeTool === "floor") selectOnly(null);
      if (activeTool === "floor" && viewMode === "three") applyViewMode("split");
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

  buildTemplateList();
  document.querySelectorAll<HTMLButtonElement>("[data-template]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.template ?? "oneLdk";
      if (!window.confirm("現在の間取りをテンプレートで置き換えます。実行しますか？")) {
        return;
      }
      const plan = makeTemplate(key);
      replaceState(document.querySelector<HTMLInputElement>("#templateStructureOnly")?.checked ? structureOnly(plan) : plan, true);
    });
  });
  document.querySelector<HTMLInputElement>("#templateSearch")?.addEventListener("input", applyTemplateSearch);

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
  setupViewMenu();
  setupImageImport();
  document.querySelector<HTMLButtonElement>("#imageImportButton")?.addEventListener("click", () => document.querySelector<HTMLInputElement>("#imageImportInput")?.click());
  setupPlanStyleMenu();
  setupImageExport();
  setupThreeStyle();
  setupCombine();
  setupEdition();
  setupTopNote();
  setupFeedbackForm();
  setupCreditCopy();
  setupChangelog();
  setupLanguageSelect();
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

  // ほかの所（一覧のボタンなど）を押したら、ダブルクリックの1回目の記録を捨てる（別の家具を選んで同じ所に置けるように）
  document.addEventListener("pointerdown", (event) => {
    if (event.target !== planCanvas) lastPlanClick = null;
    if (event.target !== threeCanvas) lastThreeClick = null;
  }, true);
  planCanvas.addEventListener("pointerdown", handlePointerDown);
  planCanvas.addEventListener("pointermove", handlePointerMove);
  planCanvas.addEventListener("pointerup", handlePointerUp);
  planCanvas.addEventListener("pointercancel", cancelPlanDrag);
  // 2Dから外れたら（タッチは指を離したら）ペン先の丸を消す
  planCanvas.addEventListener("pointerleave", hidePenCursor);
  planCanvas.addEventListener("pointerup", (event) => {
    if (event.pointerType === "touch") hidePenCursor();
  });
  planCanvas.addEventListener("lostpointercapture", cancelPlanDrag);
  window.addEventListener("blur", cancelPlanDrag);
  planCanvas.addEventListener("wheel", handleWheel, { passive: false });
  planCanvas.addEventListener("contextmenu", (event) => event.preventDefault());
  planCanvas.addEventListener("dblclick", handleDoubleClick);
  threeCanvas.addEventListener("pointerdown", handleThreePointerDown, { capture: true });
  // 家具の移動などで止めた押し方（stopImmediatePropagation）では回さないよう、handleThreePointerDown の後に置く
  threeCanvas.addEventListener("pointerdown", startThreeOrbit, { capture: true });
  threeCanvas.addEventListener("pointermove", moveThreeOrbit);
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"] as const) threeCanvas.addEventListener(type, endThreeOrbit);
  // 指が何本触れているか（2本目が触れたら、回転をやめてピンチ・平行移動にする）。家具をつかんだ指も数える
  document.addEventListener("pointerdown", (event) => { if (event.pointerType === "touch" && event.target === threeCanvas) threeTouches.add(event.pointerId); }, true);
  for (const type of ["pointerup", "pointercancel"] as const) document.addEventListener(type, (event) => { threeTouches.delete(event.pointerId); }, true);
  threeCanvas.addEventListener("pointermove", handleThreePointerMove);
  threeCanvas.addEventListener("pointerup", handleThreePointerUp);
  for (const type of ["pointermove", "pointerup", "pointercancel"] as const) threeCanvas.addEventListener(type, trackThreeLongPress);
  threeCanvas.addEventListener("dblclick", handleThreeDoubleClick);
  threeCanvas.addEventListener("pointercancel", cancelThreeDrag);
  threeCanvas.addEventListener("lostpointercapture", cancelThreeDrag);
  window.addEventListener("blur", () => { cancelThreeDrag(); threeMoveId = null; syncThreeMoveMode(); });
  // 移動モードを入れる・切る（何も選んでいなくても入れられる）
  document.querySelector("#threeMoveToggle")?.addEventListener("click", () => {
    threeMoveMode = !threeMoveMode;
    threeMoveId = null;
    activeTool = "select";
    setActiveButton("[data-tool]", activeTool);
    syncPlanCursor();
    syncThreeMoveMode();
    if (threeMoveMode) showThreeHint("移動モード: 動かしたい物（床・壁・屋根・家具など）をドラッグします。もう一度押すか Esc で終わります");
  });
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
  // 屋根の欄はHTMLに置いてあり、ほかの欄と一緒に使う順に並べ直す（作り直しで消えないよう、先に外しておく）
  const roofCategory = requiredElement<HTMLDetailsElement>("#roofCategory");
  roofCategory.remove();
  furniturePicker.innerHTML = "";
  const sections = new Map<string, HTMLElement>();

  const fittings = createPaletteGroup("建具（ドア・窓）", true, "たてぐ");
  DOOR_STYLES.forEach((style) => fittings.items.appendChild(createDoorStyleButton(style.value)));
  ([
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
  sections.set("fittings", fittings.details);

  // 壁の種類。押すと壁のツールになり、2Dをドラッグすると、その種類の壁を描く
  const walls = createPaletteGroup("壁", false, "かべ 塀 へい 垣 かき");
  WALL_STYLES.forEach((style) => {
    const button = createPaletteButton(style.label, "かべ へい", () => {
      activeWallStyle = style.value;
      activeTool = "wall";
      floorRetraceId = null;
      setActiveButton("[data-tool]", activeTool);
      syncPlanCursor();
      updatePropertiesPanel();
    });
    button.dataset.wallStyle = style.value;
    const swatch = document.createElement("span");
    swatch.className = "surface-swatch wall-swatch";
    whenOpened(walls.details, () => { swatch.style.backgroundImage = `url(${wallStyleSwatchUrl(style.value)})`; });
    button.prepend(swatch);
    walls.items.appendChild(button);
  });
  sections.set("walls", walls.details);

  FURNITURE_GROUPS.forEach((category) => {
    // はじめは、建具といちばんよく使う分類（並びの先頭の家具の分類）だけを開いておく
    const group = createPaletteGroup(category.label, category.id === PALETTE_ORDER.find((id) => FURNITURE_GROUPS.some((item) => item.id === id)), category.keywords);
    // 和風の欄には、障子・襖などのドアも並べる（建具の欄と重ねて出す）
    category.doorStyles?.forEach((style) => group.items.appendChild(createDoorStyleButton(style)));
    [...category.kinds, ...(category.also ?? [])].forEach((kind) => group.items.appendChild(createFurnitureButton(kind)));
    sections.set(category.id, group.details);
  });

  const surfaces = createPaletteGroup("床・地面", false, "ゆか 床 素材 なぞる");
  (Object.keys(SURFACE_DEFS) as RoomSurface[]).forEach((surface) => {
    const button = createPaletteButton(SURFACE_DEFS[surface].label, "ゆか 床", () => {
      activeRoomSurface = surface;
      floorRetraceId = null;
      if (activeTool !== "floor") activeTool = drawMethodFor("floor") === "trace" || drawMethodFor("floor") === "brush" ? "room" : "floor";
      if (activeTool === "floor") updatePropertiesPanel();
      setActiveButton("[data-surface]", surface);
      setActiveButton("[data-tool]", activeTool);
      syncPlanCursor();
    });
    button.dataset.surface = surface;
    markTraceable(button);
    const swatch = document.createElement("span");
    swatch.className = "surface-swatch";
    whenOpened(surfaces.details, () => { swatch.style.backgroundImage = `url(${surfaceSwatchUrl(surface)})`; });
    button.prepend(swatch);
    surfaces.items.appendChild(button);
  });
  sections.set("surfaces", surfaces.details);

  // なぞって形を決められる物を1つの欄にまとめる（ほかの欄にもある物を重ねて出す）
  const trace = createPaletteGroup("なぞって形を決める", false, "なぞる 形 かたち 自由 じゆう 囲む かこむ フリーハンド");
  const pen = createPaletteButton("ペン", "ぺん 線 せん 描く かく 塗る ぬる", () => requiredElement<HTMLButtonElement>('.tool-button[data-tool="paint"]').click());
  // ツールのペンのボタンと区別する（押したときは、ツールのペンを押したのと同じにする）
  pen.dataset.penShortcut = "";
  markTraceable(pen);
  trace.items.appendChild(pen);
  ([...FREE_AREA_KINDS, ...FREE_LINE_KINDS, "footprints", "brokenGlass"] as FurnitureKind[]).forEach((kind) => trace.items.appendChild(createFurnitureButton(kind)));
  const note = document.createElement("p");
  note.className = "palette-note";
  note.textContent = "床・地面の素材と部屋も、2Dをぐるっとなぞると、その形の床になります";
  trace.items.appendChild(note);
  sections.set("trace", trace.details);

  const stairs = createPaletteGroup("階段", false, "かいだん");
  STAIR_KINDS.forEach((kind) => stairs.items.appendChild(createFurnitureButton(kind)));
  sections.set("stairs", stairs.details);

  const shapes = createPaletteGroup("図形の壁", false, "図形 ずけい 壁 かべ");
  ([
    ["circle", 0, "円", "えん まる"],
    ["ellipse", 0, "楕円", "だえん 丸 まる 長円"],
    ["arc", 0, "円弧", "えんこ カーブ"],
    ["poly3", 3, "三角形", "さんかく"],
    ["poly4", 4, "四角形", "しかく"],
    ["poly5", 5, "五角形", "ごかく"],
    ["poly6", 6, "六角形", "ろっかく"],
    ["poly8", 8, "八角形", "はっかく"],
  ] as [string, number, string, string][]).forEach(([key, sides, label, keywords]) => {
    const button = createPaletteButton(label, keywords, () => {
      if (key === "circle" || key === "ellipse" || key === "arc") {
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
  sections.set("shapes", shapes.details);

  // 屋根の欄はHTMLに置いてあるので、検索用の語を付けて並びに入れる
  roofCategory.dataset.search = normalizeSearchText("屋根 やね");
  sections.set("roofs", roofCategory);
  for (const id of PALETTE_ORDER) {
    const section = sections.get(id);
    if (section) furniturePicker.appendChild(section);
    if (section instanceof HTMLDetailsElement) addPaletteThumbs(section);
  }
  const roofKeywords: Record<RoofKind, string> = { gable: "きりづま", hip: "よせむね", flat: "ろくやね りくやね フラット", cone: "えんすい 円形 丸 まる 塔", dome: "どーむ 円形 丸 まる 半球", polygon: "せいたかっけい 多角形 三角 四角 五角 六角 八角" };
  roofPicker.querySelectorAll<HTMLButtonElement>("[data-roof-add]").forEach((button) => {
    const kind = button.dataset.roofAdd as RoofKind;
    button.dataset.search = normalizeSearchText(`${ROOF_LABELS[kind]} ${roofKeywords[kind]}`);
  });

  applyPaletteSearch();
}

// 一覧の家具のボタンに、2Dの記号の小さな絵を付ける（その欄を開いたときに描く）
const PALETTE_THUMB_SIZE = 30;
function addPaletteThumbs(details: HTMLDetailsElement): void {
  whenOpened(details, () => {
    details.querySelectorAll<HTMLButtonElement>("button[data-furniture]").forEach((button) => {
      if (button.querySelector(".furniture-thumb")) return;
      const kind = button.dataset.furniture as FurnitureKind;
      const def = FURNITURE_DEFS[kind];
      if (!def) return;
      const canvas = document.createElement("canvas");
      canvas.className = "furniture-thumb";
      canvas.setAttribute("aria-hidden", "true");
      const symbol = validSymbol(kind, lastSymbolByKind[kind]) || 0;
      drawSymbolPreview(canvas, { id: "thumb", type: "furniture", kind, x: 0, y: 0, w: def.w, h: def.h, rotation: 0, ...(symbol ? { symbol } : {}) }, symbol, PALETTE_THUMB_SIZE);
      button.prepend(canvas);
      button.classList.add("has-thumb");
    });
  });
}

// 一覧の見本の絵は、その欄を開いたときに作る（閉じた欄の絵まで作ると、起動が重くなる）
function whenOpened(details: HTMLDetailsElement, fill: () => void): void {
  if (details.open) {
    fill();
    return;
  }
  const onToggle = () => {
    if (!details.open) return;
    details.removeEventListener("toggle", onToggle);
    fill();
  };
  details.addEventListener("toggle", onToggle);
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

// ドアの種類のボタン。押すとドアのツールになり、2Dで壁に沿ってドラッグすると、その種類のドアを置く
function createDoorStyleButton(style: DoorStyle): HTMLButtonElement {
  const info = doorStyleInfo(style);
  const button = createPaletteButton(info.label, info.keywords, () => {
    activeTool = "door";
    activeDoorStyle = style;
    pathRedrawId = null;
    setActiveButton("[data-tool]", activeTool);
    syncPlanCursor();
  });
  button.dataset.doorStyle = style;
  return button;
}

function createFurnitureButton(kind: FurnitureKind): HTMLButtonElement {
  const button = createPaletteButton(FURNITURE_DEFS[kind].label, SEARCH_KEYWORDS[kind] ?? (isMorePartKind(kind) ? MORE_DEFS[kind].keywords ?? "" : ""), () => {
    activeFurniture = kind;
    pathRedrawId = null;
    setActiveButton("[data-furniture]", activeFurniture);
    activeTool = "furniture";
    setActiveButton("[data-tool]", activeTool);
    syncPlanCursor();
  });
  button.dataset.furniture = kind;
  if (activeTool === "furniture" && kind === activeFurniture) button.classList.add("is-active");
  if (isTraceableKind(kind)) markTraceable(button);
  return button;
}

// 2Dをなぞって形を決められる家具・設備（池・川などの自由な形と、足跡・破片）
function isTraceableKind(kind: FurnitureKind): boolean {
  return isFreeShapeKind(kind) || kind === "footprints" || kind === "brokenGlass";
}

// なぞって形を決められる物の印（ボタンの右の小さな波線）と説明
function markTraceable(button: HTMLButtonElement): void {
  button.classList.add("is-traceable");
  button.title = `${button.textContent ?? ""}（2Dをなぞって形を決められます）`;
}

// カタカナをひらがなに、全角英数を半角にそろえ、「ソファ」と「そふぁ」などを同じ語として扱う
function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

// 一覧のボタンが表す物（いくつかの分類に重ねて出している物は、同じ値になる）
function paletteItemKey(button: HTMLButtonElement): string | null {
  const { furniture, doorStyle, tool, surface, shape, roofAdd } = button.dataset;
  return furniture ? `furniture:${furniture}` : doorStyle ? `door:${doorStyle}` : surface ? `surface:${surface}` : shape ? `shape:${shape}` : roofAdd ? `roof:${roofAdd}` : tool ? `tool:${tool}` : null;
}

function applyPaletteSearch(): void {
  const terms = normalizeSearchText(paletteSearch.value).split(/\s+/).filter(Boolean);
  const searching = terms.length > 0;
  let anyMatch = false;
  // 検索の結果では、重ねて出している物を、上の（よく使う）分類の1つだけにする
  const found = new Set<string>();
  document.querySelectorAll<HTMLElement>(".palette-section").forEach((section) => {
    let sectionMatch = false;
    section.querySelectorAll<HTMLDetailsElement>(".palette-group").forEach((group) => {
      const groupText = `${group.dataset.search ?? ""} ${normalizeSearchText(group.querySelector("summary")?.textContent ?? "")}`;
      let groupMatch = false;
      group.querySelectorAll<HTMLButtonElement>("button[data-search]").forEach((button) => {
        const text = `${button.dataset.search} ${normalizeSearchText(button.textContent ?? "")} ${groupText}`;
        let match = !searching || terms.every((term) => text.includes(term));
        const key = searching && match ? paletteItemKey(button) : null;
        if (key) {
          if (found.has(key)) match = false;
          else found.add(key);
        }
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

// 階のタブを作り直すのは、階・編集中の階・数の表示が変わったときだけ（作り直すと欄の大きさを測り直すので重い）
let floorTabsKey = "";

function renderFloorTabs(): void {
  const key = JSON.stringify([state.floors.map((floor) => floor.name), state.activeFloor, planStats.textContent]);
  if (key === floorTabsKey && floorTabs.childElementCount) return;
  floorTabsKey = key;
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
  // この階を複製（2つ重ねた四角の絵）
  const duplicate = document.createElement("button");
  duplicate.type = "button";
  duplicate.className = "floor-tab floor-tab-ghost floor-tab-duplicate";
  duplicate.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="5.5" y="1.5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="1.5" y="5.5" width="9" height="9" rx="1.5" fill="#fff" stroke="currentColor" stroke-width="1.4"/></svg>`;
  duplicate.title = `${activeFloor().name}を複製（すぐ上に同じ階を足す）`;
  duplicate.setAttribute("aria-label", "この階を複製");
  duplicate.addEventListener("click", duplicateActiveFloor);
  floorTabs.appendChild(duplicate);
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
  const floorPolygonShape = selected?.type === "room" ? regularFloor(selected) : null;
  const selectedBounds = floorPolygonShape && isRadialRoof(kind) ? { x: floorPolygonShape.x - floorPolygonShape.diameter / 2, y: floorPolygonShape.y - floorPolygonShape.diameter / 2, w: floorPolygonShape.diameter, h: floorPolygonShape.diameter }
    : selected?.type === "room" ? { x: selected.x, y: selected.y, w: selected.w, h: selected.h }
    : selected?.type === "shape" && isRadialRoof(kind) ? { x: selected.x - selected.r, y: selected.y - shapeRadiusY(selected), w: selected.r * 2, h: shapeRadiusY(selected) * 2 } : null;
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
  if (isRadialRoof(kind) && selectedBounds) Object.assign(item, { x: selectedBounds.x - overhang, y: selectedBounds.y - overhang, w: selectedBounds.w + overhang * 2, h: selectedBounds.h + overhang * 2 });
  if (kind === "polygon") {
    Object.assign(item, regularRoofSize(item));
    item.sides = selected?.type === "shape" && selected.kind === "polygon" ? roofSides(selected.sides) : floorPolygonShape?.sides ?? 6;
    item.rotation = selected?.type === "shape" && selected.kind === "polygon" ? radiansToDegrees(selected.rotation ?? 0) : floorPolygonShape?.rotation ?? 0;
  }
  item.floorId = activeFloor().id;
  state.roofs.push(item);
  selectOnly(item.id);
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
  threeMoveId = null;
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

// いまの階を複製して、すぐ上に足す（部屋・壁・家具などを新しい id で写す）。この階に付いている屋根は、上の写しへ移す
function duplicateActiveFloor(): void {
  const index = state.activeFloor;
  const source = state.floors[index];
  const basements = basementCount();
  const copy: Floor = { id: newId("floor"), name: "", entities: source.entities.map((entity) => ({ ...cloneEntity(entity), id: newId(entity.type) })) };
  state.floors.splice(index + 1, 0, copy);
  // 地下の階を複製したときは、写しも地下にする
  if (index < basements) state.basements = basements + 1;
  state.roofs.forEach((roofItem) => { if (roofItem.floorId === source.id) roofItem.floorId = copy.id; });
  renameFloors();
  state.activeFloor = index + 1;
  selectOnly(null);
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
      button.dataset.surface ?? button.dataset.shape ?? button.dataset.doorStyle ?? button.dataset.tool ?? button.dataset.furniture ?? button.dataset.viewMode;
    button.classList.toggle("is-active", dataValue === value);
    button.setAttribute("aria-pressed", String(dataValue === value));
  });
}

function syncPlanCursor(): void {
  syncFloorEditing();
  setActiveButton("[data-surface]", activeTool === "room" || activeTool === "floor" ? activeRoomSurface : "");
  setActiveButton("[data-wall-style]", activeTool === "wall" ? activeWallStyle : "");
  setActiveButton("[data-furniture]", activeTool === "furniture" ? activeFurniture : "");
  setActiveButton("[data-door-style]", activeTool === "door" ? activeDoorStyle : activeTool === "slidingDoor" ? "sliding" : "");
  document.querySelector("[data-pen-shortcut]")?.classList.toggle("is-active", activeTool === "paint");
  if (threeMoveMode && activeTool !== "select") {
    threeMoveMode = false;
    syncThreeMoveMode();
  }
  // 部屋のツールから離れたら、床の描き直しはやめる
  if (activeTool !== "room") floorRetraceId = null;
  if (drag.dragMode === "pan") {
    planCanvas.style.cursor = "grabbing";
    return;
  }
  planCanvas.style.cursor = activeTool === "select" ? "default" : activeTool === "erase" ? "not-allowed" : activeTool === "text" ? "text" : "crosshair";
  syncToolHint();
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

// 表示メニュー（部屋名・部屋の広さ・方眼の表示と大きさ）
function setupViewMenu(): void {
  const button = document.querySelector<HTMLButtonElement>("#viewMenuButton");
  const menu = document.querySelector<HTMLDivElement>("#viewMenu");
  const names = document.querySelector<HTMLInputElement>("#roomNamesInput");
  const area = document.querySelector<HTMLSelectElement>("#roomAreaSelect");
  const grid = document.querySelector<HTMLInputElement>("#gridVisibleInput");
  const size = document.querySelector<HTMLSelectElement>("#gridSizeSelect");
  if (!button || !menu || !names || !area || !grid || !size) return;
  button.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
    button.setAttribute("aria-expanded", String(!menu.hidden));
  });
  document.addEventListener("pointerdown", (event) => {
    if (menu.hidden || menu.contains(event.target as Node) || button.contains(event.target as Node)) return;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  });
  names.addEventListener("change", () => {
    displaySettings.names = names.checked;
    hideRoomNames = !names.checked;
    applyDisplaySettings();
  });
  area.addEventListener("change", () => {
    displaySettings.area = area.value === "jo" || area.value === "m2" ? area.value : "none";
    applyDisplaySettings();
  });
  grid.addEventListener("change", () => {
    displaySettings.grid = grid.checked;
    applyDisplaySettings();
  });
  size.addEventListener("change", () => {
    const value = Number(size.value);
    displaySettings.gridSize = GRID_SIZES.includes(value) ? value : 0;
    // 大きさを選んだら、方眼も表示する
    displaySettings.grid = true;
    applyDisplaySettings();
  });
  syncViewMenu();
}

function syncViewMenu(): void {
  const set = <T extends HTMLInputElement | HTMLSelectElement>(selector: string, apply: (element: T) => void) => {
    const element = document.querySelector<T>(selector);
    if (element) apply(element);
  };
  set<HTMLInputElement>("#roomNamesInput", (input) => (input.checked = displaySettings.names));
  set<HTMLSelectElement>("#roomAreaSelect", (select) => (select.value = displaySettings.area));
  set<HTMLInputElement>("#gridVisibleInput", (input) => (input.checked = displaySettings.grid));
  set<HTMLSelectElement>("#gridSizeSelect", (select) => (select.value = String(displaySettings.gridSize)));
  const button = document.querySelector<HTMLButtonElement>("#viewMenuButton");
  // 初めの表示（部屋名あり・広さなし・方眼あり・おまかせ）から変えていれば、ボタンを押した見た目にする
  button?.classList.toggle("is-active", !displaySettings.names || displaySettings.area !== "none" || !displaySettings.grid || displaySettings.gridSize > 0);
}

function applyDisplaySettings(): void {
  syncViewMenu();
  scheduleViewStateSave();
  render2d();
  updatePropertiesPanel();
}

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
      // 2Dだけを見ていた間は3Dを作らないので、ここで作る
      ensureThreeScene();
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
  if (viewState.display && typeof viewState.display === "object") {
    const { names, area, grid, gridSize } = viewState.display;
    if (typeof names === "boolean") displaySettings.names = names;
    if (area === "none" || area === "jo" || area === "m2") displaySettings.area = area;
    if (typeof grid === "boolean") displaySettings.grid = grid;
    if (typeof gridSize === "number" && GRID_SIZES.includes(gridSize)) displaySettings.gridSize = gridSize;
  }
  hideRoomNames = !displaySettings.names;
  if (viewState.ghost && typeof viewState.ghost === "object") {
    const { target, color, opacity } = viewState.ghost;
    if (typeof target === "string" && target) ghostSettings.target = target;
    if (typeof color === "string") ghostSettings.color = parseColorCode(color)?.code ?? "";
    if (typeof opacity === "number" && Number.isFinite(opacity)) ghostSettings.opacity = clamp(opacity, 0.03, 0.9);
  }
  if (viewState.look && typeof viewState.look === "object") {
    const { style, dot, background } = viewState.look;
    if (PLAN_STYLES.some((option) => option.value === style)) planStyle = style as PlanStyle;
    if (PLAN_BACKGROUNDS.some((option) => option.value === background)) planBackground = background as PlanBackground;
    if (PIXEL_DOTS.some((option) => option.value === dot)) pixelDot = dot as number;
  }
  if (viewState.shards && typeof viewState.shards === "object") {
    const { spread, density } = viewState.shards;
    if (typeof spread === "number" && Number.isFinite(spread)) shardSettings.spread = clamp(Math.round(spread), 5, MAX_BRUSH);
    if (SHARD_DENSITIES.some(([value]) => value === density)) shardSettings.density = density as number;
  }
  if (viewState.pen && typeof viewState.pen === "object") {
    const { color, brush, filled, kind } = viewState.pen;
    penSettings.color = parseColorCode(color)?.code ?? PEN_DEFAULT_COLOR;
    if (typeof brush === "number" && Number.isFinite(brush)) penSettings.brush = clamp(Math.round(brush), 1, MAX_BRUSH);
    penSettings.filled = filled === true;
    penSettings.kind = (PEN_KINDS as readonly string[]).includes(kind ?? "") ? kind as PenKind : "paint";
  }
  if (viewState.drawMethods && typeof viewState.drawMethods === "object") {
    for (const [key, method] of Object.entries(viewState.drawMethods)) if ((DRAW_METHODS as string[]).includes(method)) drawMethods[key] = method as DrawMethod;
  }
  if (viewState.brushes && typeof viewState.brushes === "object") {
    for (const [key, width] of Object.entries(viewState.brushes)) if (typeof width === "number" && Number.isFinite(width)) brushWidths[key] = clampBrushWidth(width);
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
  viewState.drawMethods = { ...drawMethods };
  viewState.brushes = { ...brushWidths };
  viewState.display = { ...displaySettings };
  viewState.shards = { ...shardSettings };
  viewState.look = { style: planStyle, dot: pixelDot, background: planBackground };
  try {
    localStorage.setItem(VIEW_STATE_KEY, JSON.stringify(viewState));
  } catch {
    // 保存できなくても編集は続けられる。次に開いたときに全体表示へ戻るだけ
  }
}

function selectedEntities(): Entity[] {
  const primary = state.selectedId ? findEntity(state.selectedId) : undefined;
  if (!primary || !multiSelection.has(primary.id) || selectionFloor !== state.activeFloor) {
    multiSelection.clear();
    selectionFloor = state.activeFloor;
    if (primary) multiSelection.add(primary.id);
  }
  const visibleIds = new Set([...activeEntities(), ...(roofsOn2d() ? state.roofs : [])].map((item) => item.id));
  return [...multiSelection].filter((id) => visibleIds.has(id)).map(findEntity).filter((item): item is Entity => Boolean(item));
}

function selectOnly(id: string | null): void {
  if (id !== floorEdit?.id) { floorEdit = null; floorEditError = ""; }
  if (id !== threeMoveId) threeMoveId = null;
  multiSelection.clear();
  state.selectedId = id;
  selectionFloor = state.activeFloor;
  if (id) multiSelection.add(id);
}

function toggleSelection(id: string): void {
  selectedEntities();
  if (multiSelection.has(id)) multiSelection.delete(id);
  else multiSelection.add(id);
  state.selectedId = [...multiSelection].slice(-1)[0] ?? null;
  activeTool = "select";
  pathRedrawId = null;
  setActiveButton("[data-tool]", activeTool);
  syncPlanCursor();
  redrawAll();
}

// 物をまとめて選ぶ（最後の物を、寸法の欄などで扱う物にする）
function selectMany(ids: string[]): void {
  const unique = [...new Set(ids)].filter((id) => findEntity(id));
  multiSelection.clear();
  unique.forEach((id) => multiSelection.add(id));
  state.selectedId = unique[unique.length - 1] ?? null;
  selectionFloor = state.activeFloor;
}

// 上から見た物の外形の四角（回した家具は、回したあとの形）
function entityBox(entity: Entity): Bounds {
  if (entity.type === "furniture") {
    const a = degreesToRadians(entity.rotation ?? 0);
    const cos = Math.abs(Math.cos(a)), sin = Math.abs(Math.sin(a));
    const w = entity.w * cos + entity.h * sin, h = entity.w * sin + entity.h * cos;
    return { x: entity.x + entity.w / 2 - w / 2, y: entity.y + entity.h / 2 - h / 2, w, h };
  }
  if (entity.type === "room" || entity.type === "roof") return { x: entity.x, y: entity.y, w: entity.w, h: entity.h };
  if (entity.type === "text") {
    const { w, h } = measureTextLabel(entity);
    return { x: entity.x - w / 2, y: entity.y - h / 2, w, h };
  }
  if (entity.type === "shape") return { x: entity.x - entity.r, y: entity.y - shapeRadiusY(entity), w: entity.r * 2, h: shapeRadiusY(entity) * 2 };
  return { x: Math.min(entity.x1, entity.x2), y: Math.min(entity.y1, entity.y2), w: Math.abs(entity.x2 - entity.x1), h: Math.abs(entity.y2 - entity.y1) };
}

// 四角の中にすっかり入っている物（いまの階の物と、2Dに出している屋根）
function entitiesInRect(a: Point, b: Point): string[] {
  const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x), top = Math.min(a.y, b.y), bottom = Math.max(a.y, b.y);
  return [...activeEntities(), ...(roofsOn2d() ? state.roofs : [])]
    .filter((entity) => {
      const box = entityBox(entity);
      return box.x >= left && box.y >= top && box.x + box.w <= right && box.y + box.h <= bottom;
    })
    .map((entity) => entity.id);
}

// 物をずらす（グリッドに吸着させない）
function translateEntity(entity: Entity, dx: number, dy: number): void {
  if (isLinear(entity)) {
    entity.x1 = Math.round(entity.x1 + dx);
    entity.y1 = Math.round(entity.y1 + dy);
    entity.x2 = Math.round(entity.x2 + dx);
    entity.y2 = Math.round(entity.y2 + dy);
    return;
  }
  entity.x = Math.round(entity.x + dx);
  entity.y = Math.round(entity.y + dy);
}

// まとめて選んだ物を、全体の中心のまわりに90°回す（並び方はそのまま。固定した物は動かさない）
function rotateSelection(entities: Entity[]): void {
  const movable = entities.filter((entity) => !isLocked(entity));
  if (!movable.length) return;
  const boxes = movable.map(entityBox);
  const left = Math.min(...boxes.map((box) => box.x)), right = Math.max(...boxes.map((box) => box.x + box.w));
  const top = Math.min(...boxes.map((box) => box.y)), bottom = Math.max(...boxes.map((box) => box.y + box.h));
  const gx = (left + right) / 2, gy = (top + bottom) / 2;
  movable.forEach((entity, i) => {
    const cx = boxes[i].x + boxes[i].w / 2, cy = boxes[i].y + boxes[i].h / 2;
    rotateEntity(entity, 90);
    const after = entityBox(entity);
    translateEntity(entity, gx - (cy - gy) - (after.x + after.w / 2), gy + (cx - gx) - (after.y + after.h / 2));
  });
}

// 物の写しを、いまの階に (dx, dy) ずらして置き、置いた物を選ぶ。屋根はいまの階の屋根にする
function placeCopies(sources: Entity[], dx: number, dy: number): void {
  const floor = state.floors[state.activeFloor];
  const ids: string[] = [];
  for (const source of sources) {
    const copy = cloneEntity(source);
    copy.id = newId(copy.type);
    delete copy.locked;
    translateEntity(copy, dx, dy);
    if (copy.type === "roof") {
      copy.floorId = floor.id;
      state.roofs.push(copy);
    } else activeEntities().push(copy);
    ids.push(copy.id);
  }
  selectMany(ids);
  activeTool = "select";
  setActiveButton("[data-tool]", activeTool);
  syncPlanCursor();
  commitState();
  redrawAll();
}

// Ctrl+ドラッグで囲んでいる四角
function drawMarquee(): void {
  if (drag.dragMode !== "marquee") return;
  if (deferOverlay(drawMarquee)) return;
  const a = drag.startWorld, b = drag.currentWorld;
  ctx.save();
  ctx.fillStyle = "rgba(39, 117, 209, 0.08)";
  ctx.strokeStyle = "#2775d1";
  ctx.lineWidth = 1.2 / view.zoom;
  ctx.setLineDash([5 / view.zoom, 4 / view.zoom]);
  ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  ctx.restore();
}

function moveSelection(origins: Entity[], dx: number, dy: number): void {
  translateSelection(origins, findEntity, snap(dx), snap(dy));
}

function restoreOrigins(origins: Entity[]): void {
  for (const origin of origins) {
    const current = findEntity(origin.id);
    if (!current) continue;
    // 姿勢など、ドラッグ中に初めて付いたプロパティも取り除く。
    for (const key of Object.keys(current)) Reflect.deleteProperty(current, key);
    Object.assign(current, cloneEntity(origin));
  }
}

function cancelPlanDrag(): void {
  cancelLongPress();
  const pointerId = drag.pointerId;
  if (pointerId === null) return;
  if (drag.createdId) removeEntityById(drag.createdId);
  else restoreOrigins(drag.origins ?? (drag.originEntity ? [drag.originEntity] : []));
  drag = { ...drag, pointerId: null, dragMode: "none", pending: undefined, path: undefined, origins: undefined, originEntity: null, createdId: undefined };
  if (planCanvas.hasPointerCapture(pointerId)) planCanvas.releasePointerCapture(pointerId);
  longPressPoint = null;
  pendingTextFocus = false;
  syncPlanCursor();
  redrawAll();
}

function handlePointerDown(event: PointerEvent): void {
  if (drag.pointerId !== null || (event.button !== 0 && event.button !== 2)) return;
  cancelLongPress();
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

  // 置く・消すツールで、同じ所を続けて押した（ダブルクリック）: 1回目を取り消して、そこにある物を選ぶ
  const doubled = !event.ctrlKey && !event.metaKey && isDoublePress(lastPlanClick, event) ? lastPlanClick : null;
  lastPlanClick = null;
  if (doubled) {
    revertLastClick(doubled);
    if (doubled.select && findEntity(doubled.select)) selectFromOtherTool(doubled.select, false);
    redrawAll();
    return;
  }

  const point = screenToWorld(event);
  if (isPointDrafting()) {
    event.preventDefault();
    planCanvas.setPointerCapture(event.pointerId);
    drag = { ...drag, pointerId: event.pointerId, dragMode: "none", startScreen: { x: event.clientX, y: event.clientY }, startWorld: point, currentWorld: point, originEntity: null, resizeCorner: null, pressedId: undefined, pending: undefined, createdId: undefined, origins: undefined };
    return;
  }
  const hit = hitTest(point);
  if (event.ctrlKey || event.metaKey) {
    // Ctrl（Mac は Cmd）: クリックで選ぶ物を足す・外す、ドラッグで囲んだ物をまとめて選ぶ
    event.preventDefault();
    planCanvas.setPointerCapture(event.pointerId);
    drag = {
      dragMode: "marquee",
      pointerId: event.pointerId,
      startScreen: { x: event.clientX, y: event.clientY },
      startView: { x: view.x, y: view.y },
      startWorld: point,
      currentWorld: point,
      originEntity: null,
      resizeCorner: null,
      pressedId: hit.entity?.id,
    };
    return;
  }
  planCanvas.setPointerCapture(event.pointerId);
  drag.pointerId = event.pointerId;
  drag.startScreen = { x: event.clientX, y: event.clientY };
  drag.startView = { x: view.x, y: view.y };
  drag.startWorld = point;
  drag.currentWorld = point;
  drag.originEntity = hit.entity ? cloneEntity(hit.entity) : null;
  drag.resizeCorner = hit.corner;
  drag.pending = undefined;
  drag.origins = undefined;
  drag.createdId = undefined;
  // 選択ツール以外で物を押したら、長押しで選べるようにする
  drag.pressedId = activeTool !== "select" && hit.entity ? hit.entity.id : undefined;
  cancelLongPress();
  if (drag.pressedId) startLongPress(event, drag.pressedId);

  if (activeTool === "erase") {
    // 消すのは指を離したとき（押し続けると、消さずに選ぶ）
    drag.dragMode = "none";
    drag.pending = hit.entity ? "erase" : undefined;
    return;
  }

  if (activeTool === "select") {
    const members = selectedEntities();
    if (hit.entity && members.length > 1 && members.some((item) => item.id === hit.entity!.id)) {
      drag.origins = members.map(cloneEntity);
      drag.dragMode = isLocked(hit.entity) ? "none" : "move";
      drag.resizeCorner = null;
      planCanvas.style.cursor = isLocked(hit.entity) ? "not-allowed" : "grabbing";
      return;
    }
    selectOnly(hit.entity?.id ?? null);
    if (floorEdit && hit.entity?.id === floorEdit.id && hit.corner?.startsWith("vertex:")) floorEdit.vertex = Number(hit.corner.slice(7));
    if (floorEdit && hit.entity?.id === floorEdit.id && hit.corner?.startsWith("edge:")) floorEdit.vertex = Number(hit.corner.slice(5)) + 1;
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
    } else if (hit.entity && hit.corner && (isResizable(hit.entity) || isLinear(hit.entity) || hit.entity.type === "shape")) {
      drag.dragMode = "resize";
    } else if (hit.entity?.id === floorEdit?.id) {
      drag.dragMode = "none";
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
    // 既存の文字をクリックしたらそれを選び、何もない所なら新しく置く。どちらもすぐ入力できるよう選択ツールへ戻す。
    // ほかの物の上では、置くのは指を離したとき（押し続けると、その物を選ぶ）
    drag.dragMode = "none";
    if (hit.entity?.type === "text") {
      cancelLongPress();
      placeTextAt(point, hit.entity);
    } else if (hit.entity) drag.pending = "text";
    else placeTextAt(point, null);
    return;
  }

  // 足跡は、なぞった道すじに付ける（クリックだけなら、まっすぐな足跡）。ペンも、なぞった所に線を描く
  if (activeTool === "paint" || (activeTool === "furniture" && (activeFurniture === "footprints" || activeFurniture === "brokenGlass" || isFreeShapeKind(activeFurniture)))) {
    drag.dragMode = "path";
    drag.path = [point];
    render2d();
    return;
  }

  // 床をペンで塗る（なぞった所が床になる）
  if (activeTool === "room" && isBrushing()) {
    drag.dragMode = "path";
    drag.path = [point];
    render2d();
    return;
  }

  drag.dragMode = "draw";
  drag.path = activeTool === "room" ? [point] : undefined;
  state.selectedId = null;

  if (activeTool === "furniture") {
    // ほかの物の上では、置くのは動かし始めたときか指を離したとき（押し続けると、その物を選ぶ）
    if (hit.entity) {
      drag.dragMode = "none";
      drag.pending = "furniture";
      render2d();
      return;
    }
    placeFurnitureAt(point);
    return;
  }

  render2d();
}

// 家具の一覧で選んでいる家具を、point を中心に置いて、そのままドラッグで動かせるようにする
function placeFurnitureAt(point: Point): void {
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
  selectOnly(entity.id);
  drag.originEntity = cloneEntity(entity);
  drag.dragMode = "move";
  drag.pending = undefined;
  drag.createdId = entity.id;
  redrawAll();
}

// 文字を置く（target があればその文字を選ぶ）。すぐ入力できるよう選択ツールへ戻す
function placeTextAt(point: Point, target: Entity | null): void {
  if (!target) {
    target = { id: newId("text"), type: "text", text: "テキスト", x: Math.round(point.x), y: Math.round(point.y), size: DEFAULT_TEXT_SIZE, rotation: 0 };
    activeEntities().push(target);
    drag.createdId = target.id;
  }
  selectOnly(target.id);
  activeTool = "select";
  setActiveButton("[data-tool]", activeTool);
  syncPlanCursor();
  drag.dragMode = "none";
  drag.pending = undefined;
  redrawAll();
  pendingTextFocus = true;
}

// ---- ほかのツールのまま物を選ぶ（クリック・ダブルクリック・長押し） ----

function isDoublePress(last: LastClick | null, event: PointerEvent): boolean {
  return Boolean(last) && performance.now() - last!.at <= DOUBLE_PRESS_MS && Math.hypot(event.clientX - last!.x, event.clientY - last!.y) <= CLICK_SLOP * 2;
}

// 1回目のクリックで置いた・消した物を取り消す。その変更が最後の記録のときだけ（ほかの操作をはさんだら取り消さない）。
// 取り消した記録は「やり直し」にも残さない
function revertLastClick(last: LastClick): void {
  if (!last.revert || historyIndex !== last.history || historyIndex <= 0) return;
  history = history.slice(0, historyIndex);
  historyIndex -= 1;
  state = cloneState(history[historyIndex]);
  persistState();
}

// 押した物を選び、選択ツールに切り替える。holding なら押したまま動かせるようにする（長押しのあと、そのままドラッグで動かす）
function selectFromOtherTool(entityId: string, holding: boolean): void {
  const entity = findEntity(entityId);
  if (!entity) return;
  selectOnly(entityId);
  activeTool = "select";
  pathRedrawId = null;
  floorRetraceId = null;
  setActiveButton("[data-tool]", activeTool);
  drag.pending = undefined;
  drag.path = undefined;
  drag.resizeCorner = null;
  if (holding && !isLocked(entity)) {
    drag.originEntity = cloneEntity(entity);
    drag.startWorld = longPressPoint ?? drag.startWorld;
    drag.currentWorld = drag.startWorld;
    drag.dragMode = "move";
  } else drag.dragMode = "none";
  syncPlanCursor();
  updateUi();
  render2d();
}

function startLongPress(event: PointerEvent, entityId: string): void {
  const pointerId = event.pointerId;
  longPressPoint = screenToWorld(event);
  showPressRing(event.clientX, event.clientY);
  longPressTimer = window.setTimeout(() => {
    longPressTimer = 0;
    hidePressRing();
    if (drag.pointerId !== pointerId) return;
    selectFromOtherTool(entityId, true);
  }, LONG_PRESS_MS);
}

function cancelLongPress(): void {
  if (longPressTimer) window.clearTimeout(longPressTimer);
  longPressTimer = 0;
  hidePressRing();
}

// 長押しの目印。押した所に、満ちていく輪を出す（すぐ離したときは出ないよう、少し待ってから見せる）
function showPressRing(clientX: number, clientY: number, pane: HTMLElement | null = planCanvas.parentElement): void {
  if (!pane) return;
  if (!pressRing) {
    pressRing = document.createElement("div");
    pressRing.className = "press-ring";
    pressRing.setAttribute("aria-hidden", "true");
    pressRing.innerHTML = `<svg viewBox="0 0 46 46"><circle class="track" cx="23" cy="23" r="19"></circle><circle class="fill" cx="23" cy="23" r="19"></circle></svg>`;
  }
  if (pressRing.parentElement !== pane) pane.appendChild(pressRing);
  const rect = pane.getBoundingClientRect();
  pressRing.style.left = `${clientX - rect.left}px`;
  pressRing.style.top = `${clientY - rect.top}px`;
  pressRing.style.setProperty("--press-ms", `${LONG_PRESS_MS}ms`);
  pressRing.classList.remove("is-pressing");
  // 描き直しを挟んで、満ちていく動きを最初から始める
  void pressRing.offsetWidth;
  pressRing.classList.add("is-pressing");
}

function hidePressRing(): void {
  pressRing?.classList.remove("is-pressing");
}

// いまのツールでできることを、2Dの左下に小さく出す（選択ツールでは出さない）
function syncToolHint(): void {
  const pane = planCanvas.parentElement;
  if (!pane) return;
  if (!toolHint) {
    toolHint = document.createElement("div");
    toolHint.className = "tool-hint";
    toolHint.id = "toolHint";
    toolHint.setAttribute("role", "status");
    pane.appendChild(toolHint);
  }
  const parts = toolHintParts();
  toolHint.hidden = !parts;
  if (!parts) return;
  const html = parts.map((part, i) => (i === 0 ? `<strong>${escapeHtml(part)}</strong>` : `<span>${escapeHtml(part)}</span>`)).join("");
  if (toolHint.innerHTML !== html) toolHint.innerHTML = html;
}

// 案内の中身。はじめはツールの名前（選択ツールでは、選んでいる物の数）
function toolHintParts(): string[] | null {
  if (floorEdit) return null;
  if (activeTool !== "select") {
    const action = toolAction();
    const names: Record<Tool, string> = { select: "選択", room: "部屋", floor: "床", wall: "壁", door: doorStyleInfo(activeDoorStyle).label, slidingDoor: "引き戸", window: "窓", window2: "窓", circle: "円", ellipse: "楕円", arc: "円弧", polygon: "多角形", furniture: FURNITURE_DEFS[activeFurniture].label, text: "文字", paint: "ペン", erase: "消去" };
    return action ? [names[activeTool], ...action, "Escで選択に戻る"] : null;
  }
  // 選択ツール: 選んでいるときだけ、まとめて選ぶ方法を出す（Ctrl のないスマホ・タブレットでは出さない）
  if (window.matchMedia?.("(pointer: coarse)").matches) return null;
  const count = selectedEntities().length;
  if (count > 1) return [`${count}個を選択中`, "ドラッグでまとめて動かす", "Ctrl+クリックで足す・外す", "Escで選択を外す"];
  if (count === 1) return ["選択中", "Ctrl+クリックで、ほかの物も選ぶ", "Ctrl+ドラッグで囲んで選ぶ"];
  return null;
}

// ツールの使い方と、ほかの物の選び方（描くツールはクリック、置くツールは長押し）
function toolAction(): [string, string] | null {
  const click = "物をクリックで選ぶ";
  const hold = "物をダブルクリック・長押しで選ぶ";
  switch (activeTool) {
    case "select":
    case "floor":
      return null;
    case "room":
      if (floorRetraceId) return ["床の形を描き直す: ぐるっとなぞるとその形、斜めのドラッグで四角（Escでやめる）", click];
      if (isBrushing()) return [brushCut ? "ドラッグした所の床（同じ素材）をけずる" : "ドラッグで塗った所が床になる", hold];
      return ["ドラッグで四角、ぐるっとなぞるとその形の床", click];
    case "wall":
      return ["ドラッグで壁を描く", click];
    case "door":
    case "slidingDoor":
    case "window":
    case "window2":
      return ["壁に沿ってドラッグで置く", click];
    case "circle":
    case "ellipse":
    case "arc":
    case "polygon":
      return ["ドラッグで図形の壁を描く", click];
    case "furniture":
      if (isBrushing()) return [brushCut ? `ドラッグした所の${FURNITURE_DEFS[activeFurniture].label}をけずる` : `ドラッグで塗った所が${FURNITURE_DEFS[activeFurniture].label}になる`, hold];
      if (currentDrawMethod() !== "trace" && isTraceableKind(activeFurniture)) return [isFreeShapeKind(activeFurniture) && isFreeAreaKind(activeFurniture) ? "クリックで点を打ち、最初の点で閉じる" : "クリックで点を打ち、Enter・ダブルクリックで描き終える", hold];
      if (isFreeShapeKind(activeFurniture)) return [isFreeAreaKind(activeFurniture) ? "ドラッグで囲んで形を作る（クリックで置く）" : "ドラッグでなぞって置く（クリックで置く）", hold];
      return [activeFurniture === "footprints" || activeFurniture === "brokenGlass" ? "なぞって置く" : "クリックで置く", hold];
    case "text":
      return ["クリックで文字を置く", hold];
    case "paint":
      if (isBrushing() && penSettings.kind !== "paint") return [brushCut ? `ドラッグした所の${FURNITURE_DEFS[penSettings.kind].label}をけずる` : `ドラッグで塗った所が${FURNITURE_DEFS[penSettings.kind].label}になる`, hold];
      if (currentDrawMethod() !== "trace") return [penSettings.kind === "paint" && !penSettings.filled || (penSettings.kind !== "paint" && !isFreeAreaKind(penSettings.kind)) ? "クリックで点を打ち、Enter・ダブルクリックで描き終える" : "クリックで点を打ち、最初の点で閉じる", hold];
      return [penSettings.kind === "paint" ? "ドラッグで描く" : `ドラッグで${FURNITURE_DEFS[penSettings.kind].label}を描く`, hold];
    case "erase":
      return ["クリックで消す", hold];
  }
}

function handlePointerMove(event: PointerEvent): void {
  if (drag.pointerId === event.pointerId && drag.dragMode === "pan") {
    view.x = drag.startView.x + event.clientX - drag.startScreen.x;
    view.y = drag.startView.y + event.clientY - drag.startScreen.y;
    render2d();
    return;
  }

  const point = screenToWorld(event);
  if ((activeTool === "paint" || isBrushing()) && (event.pointerType !== "touch" || drag.dragMode === "path")) {
    penCursor = point;
    if (drag.dragMode === "none") renderPenCursor();
  }
  if (isPointDrafting()) {
    if (floorDraft) floorDraft.hover = draftFloorPoint(point, event.shiftKey);
    drag.currentWorld = point;
    render2d();
    return;
  }
  const hover = hitTest(point);
  if (activeTool === "select" && drag.dragMode === "none") {
    planCanvas.style.cursor = hover.entity && isLocked(hover.entity) ? "not-allowed"
      : hover.corner?.startsWith("edge:") ? "copy"
      : hover.corner === "label" || hover.corner?.startsWith("limb:") || hover.corner?.startsWith("vertex:") ? "grab"
      : hover.corner === "round:n" || hover.corner === "round:s" || (hover.entity?.type === "shape" && ["circle", "ellipse"].includes(hover.entity.kind) && ["radius:1", "radius:3"].includes(hover.corner ?? "")) ? "ns-resize"
      : hover.corner === "round:w" || hover.corner === "round:e" || (hover.entity?.type === "shape" && ["circle", "ellipse"].includes(hover.entity.kind) && ["radius:0", "radius:2"].includes(hover.corner ?? "")) ? "ew-resize"
      : hover.corner ? "nwse-resize" : hover.entity?.id === floorEdit?.id ? "default" : hover.entity ? "move" : "default";
  }
  if (drag.pointerId === event.pointerId && (longPressTimer || drag.pending)) {
    // 少しでも動かしたら長押しではない。置くのを待っていた家具は、ここで置いてそのまま動かす
    const moved = Math.hypot(event.clientX - drag.startScreen.x, event.clientY - drag.startScreen.y);
    if (longPressTimer) longPressPoint = point;
    if (moved > CLICK_SLOP) {
      cancelLongPress();
      if (drag.pending === "furniture") placeFurnitureAt(drag.startWorld);
    }
  }

  if (drag.pointerId !== event.pointerId || drag.dragMode === "none") {
    return;
  }

  drag.currentWorld = point;

  // 部屋・床のツールでは、なぞった道すじも覚える（ぐるっと囲んだら、その形の床にする）
  if (drag.dragMode === "draw" && activeTool === "room" && drag.path) {
    const last = drag.path[drag.path.length - 1];
    if (Math.hypot(point.x - last.x, point.y - last.y) >= Math.max(1, 2 / view.zoom)) drag.path.push(point);
  }

  if (drag.dragMode === "marquee") {
    render2d();
    return;
  }

  if (drag.dragMode === "move" && drag.origins) {
    if (Math.hypot(event.clientX - drag.startScreen.x, event.clientY - drag.startScreen.y) <= CLICK_SLOP) return;
    moveSelection(drag.origins, point.x - drag.startWorld.x, point.y - drag.startWorld.y);
    redrawAll(false);
    syncThreeWhileDragging(drag.origins.map((origin) => findEntity(origin.id)).filter((entity): entity is Entity => Boolean(entity)));
    return;
  }

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
    if (entity) syncThreeWhileDragging([entity], true);
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
    if (drag.dragMode === "move" || drag.dragMode === "resize") syncThreeWhileDragging([entity], drag.dragMode === "resize");
    return;
  }

  if (activeTool === "furniture" && drag.originEntity) {
    const entity = findEntity(drag.originEntity.id);
    if (!entity) return;
    moveEntity(entity, drag.originEntity, point.x - drag.startWorld.x, point.y - drag.startWorld.y);
    redrawAll(false);
    // 置いたばかりの家具は、まだ3Dにないので作る
    syncThreeWhileDragging([entity], !planGroup.children.some((object) => object.userData.entityId === entity.id));
    return;
  }

  render2d();
}

function handlePointerUp(event: PointerEvent): void {
  if (drag.pointerId !== event.pointerId) return;

  const tool = activeTool, pressedId = drag.pressedId;
  let erasedId: string | null = null;
  const end = drag.currentWorld;
  const start = drag.startWorld;
  const distanceMoved = Math.hypot(end.x - start.x, end.y - start.y);
  // ぐるっとなぞった床（始めの所に戻ってきても、クリックではない）
  const traced = drag.dragMode === "draw" && activeTool === "room" && drag.path !== undefined && isFloorTrace(drag.path);
  // 長押しになる前に離した（クリック）
  const clicked = !traced && Math.hypot(event.clientX - drag.startScreen.x, event.clientY - drag.startScreen.y) <= CLICK_SLOP;
  cancelLongPress();
  if (isPointDrafting() && drag.dragMode !== "pan") {
    const released = screenToWorld(event);
    const dragged = Math.hypot(event.clientX - drag.startScreen.x, event.clientY - drag.startScreen.y) > CLICK_SLOP;
    if (dragged && activeTool !== "floor" && currentDrawMethod() === "straight" && !floorDraft?.points.length) placeStraightDrag(drag.startWorld, released);
    else addDraftFloorPoint(released, event.shiftKey);
  }

  // Ctrl+クリックは選ぶ物を足す・外す、Ctrl+ドラッグは囲んだ物を足す
  if (drag.dragMode === "marquee") {
    if (clicked) {
      if (drag.pressedId) toggleSelection(drag.pressedId);
    } else {
      const inside = entitiesInRect(start, end);
      if (inside.length) selectMany([...selectedEntities().map((item) => item.id), ...inside]);
      activeTool = "select";
      pathRedrawId = null;
      setActiveButton("[data-tool]", activeTool);
      updateUi();
    }
  }

  // 置くツールで物の上を押していたとき: 長押しにならずに離したら、置く・消す
  if (drag.pending === "furniture") placeFurnitureAt(start);
  else if (drag.pending === "text") placeTextAt(start, null);
  else if (drag.pending === "erase" && drag.pressedId) {
    const target = findEntity(drag.pressedId);
    if (target && !isLocked(target)) {
      removeEntityById(target.id);
      if (state.selectedId === target.id) state.selectedId = null;
      commitState();
      erasedId = target.id;
    } else if (target) {
      state.selectedId = target.id;
      updateUi();
    }
  }
  drag.pending = undefined;

  if (clicked && drag.dragMode === "resize" && drag.originEntity?.type === "room" && drag.resizeCorner?.startsWith("edge:")) {
    const entity = findEntity(drag.originEntity.id);
    const handle = floorHandles(drag.originEntity).find(h => h.key === drag.resizeCorner);
    if (entity && handle) resizeEntity(entity, drag.originEntity, drag.resizeCorner, handle);
  }

  // 描くツールで物をクリックしたら、その物を選んで選択ツールに切り替える
  if (drag.dragMode === "draw" && clicked && drag.pressedId) {
    selectFromOtherTool(drag.pressedId, false);
    drag.dragMode = "none";
  }

  if (drag.dragMode === "draw" && (distanceMoved > 8 || traced)) {
    if (activeTool === "room" && floorRetraceId) retraceFloor(floorRetraceId, traced ? drag.path! : null, start, end);
    else if (activeTool === "room") {
      if (traced) addFloorFromTrace(drag.path!);
      else addRoomFromDrag(start, end);
    }
    if (activeTool === "wall") addLineFromDrag("wall", start, end);
    if (activeTool === "door") addLineFromDrag("door", start, end, false, activeDoorStyle);
    if (activeTool === "slidingDoor") addLineFromDrag("door", start, end, false, "sliding");
    if (activeTool === "window") addLineFromDrag("window", start, end);
    if (activeTool === "window2") addLineFromDrag("window", start, end, true);
    if (activeTool === "circle") addShapeFromDrag("circle", start, end);
    if (activeTool === "ellipse") addShapeFromDrag("ellipse", start, end);
    if (activeTool === "arc") addShapeFromDrag("arc", start, end);
    if (activeTool === "polygon") addShapeFromDrag("polygon", start, end);
    commitState();
  }

  // クリックで置いた自由な形（続けてもう1回押したら、取り消してそこにある物を選ぶ）
  let pathCreatedId: string | undefined;
  if (drag.dragMode === "path" && drag.path && isBrushing()) {
    paintArea(drag.path);
    commitState();
  } else if (drag.dragMode === "path" && drag.path) {
    if (activeTool === "paint") {
      const kind = penSettings.kind;
      if (kind === "paint") placePaintStroke(drag.path);
      else {
        // ペンで描いた川・小道など。ペンのまま続けて描けるよう、選ばない
        placeFreeShapePath(kind, drag.path);
        state.selectedId = null;
      }
    }
    else if (activeFurniture === "brokenGlass") placeShardPath(drag.path);
    else if (isFreeShapeKind(activeFurniture)) {
      const created = placeFreeShapePath(activeFurniture, drag.path);
      if (created && clicked) pathCreatedId = created.id;
    } else placeFootprintPath(drag.path);
    commitState();
  }

  if (drag.createdId || drag.origins?.some((origin) => JSON.stringify(findEntity(origin.id)) !== JSON.stringify(origin))) {
    commitState();
  } else if (!drag.origins && (drag.dragMode === "move" || drag.dragMode === "resize" || drag.dragMode === "label" || drag.dragMode === "pose") && drag.originEntity) {
    const current = findEntity(drag.originEntity.id);
    if (current && JSON.stringify(current) !== JSON.stringify(drag.originEntity)) {
      commitState();
    }
  }
  // クリックで置いた・消した物を覚えておく（続けてもう1回押したら、取り消してそこにある物を選ぶ）
  const placedId = drag.createdId ?? pathCreatedId;
  if (clicked && (tool === "furniture" || tool === "text") && placedId && findEntity(placedId)) {
    lastPlanClick = { at: performance.now(), x: event.clientX, y: event.clientY, history: historyIndex, select: pressedId ?? placedId, revert: Boolean(pressedId) };
  } else if (clicked && erasedId) {
    lastPlanClick = { at: performance.now(), x: event.clientX, y: event.clientY, history: historyIndex, select: erasedId, revert: true };
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
  longPressPoint = null;
  if (planCanvas.hasPointerCapture(event.pointerId)) planCanvas.releasePointerCapture(event.pointerId);
  syncPlanCursor();
  redrawAll();
  // 置いた文字の入力欄へは、クリックを離して描き直した後に移る（先に移すと描き直しで外れる）
  if (pendingTextFocus) {
    pendingTextFocus = false;
    focusTextContentInput();
  }
}

function handleDoubleClick(event: MouseEvent): void {
  if (isPointDrafting()) { finishFloorDraft(); return; }
  if (event.ctrlKey || event.metaKey) return;
  const hit = hitTest(screenToWorld(event));
  if (!hit.entity) return;
  selectOnly(hit.entity.id);
  activeTool = "select";
  setActiveButton("[data-tool]", activeTool);
  updateUi();
  render2d();
}

function handleThreePointerDown(event: PointerEvent): void {
  // 2本目の指（ピンチでの拡大縮小など）が触れたら、長押しで家具をつかむのはやめる
  if (threeLongPress && event.pointerId !== threeLongPress.pointerId) cancelThreeLongPress();
  // 右ドラッグ・Shift＋左ドラッグは視点移動。Ctrl/Cmd は複数選択に使う。
  if (!threeDrag && (event.button === 2 || (event.button === 0 && event.shiftKey))) {
    anchorPanToPointer(event);
    threePointerDown = null;
    return;
  }
  if (event.button !== 0 || threeDrag) {
    threePointerDown = null;
    return;
  }
  // 置く・消すツールで、同じ所を続けて押した（ダブルクリック・2回タップ）: 1回目を取り消して、そこにある物を選ぶ
  const doubled = !event.ctrlKey && !event.metaKey && isDoublePress(lastThreeClick, event) ? lastThreeClick : null;
  lastThreeClick = null;
  if (doubled) {
    event.preventDefault();
    event.stopImmediatePropagation();
    threePointerDown = null;
    revertLastClick(doubled);
    selectThreePress(doubled.select);
    return;
  }
  threePointerDown = { x: event.clientX, y: event.clientY };
  const id = pickThreeEntity(event);
  const selected = id ? findEntity(id) : undefined;
  // 移動モード: 押した物を、そのままドラッグで動かす（固定した物は動かさない）
  if (threeMoveMode && activeTool === "select" && selected && !isLocked(selected) && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    event.stopImmediatePropagation();
    threePointerDown = null;
    beginThreeMove(event, selected);
    return;
  }
  // タッチの長押しで物を選ぶ（指を動かせば、ふつうに視点が回る）。家具を置くツールのままでも選べる
  if (event.pointerType !== "mouse" && !event.ctrlKey && !event.metaKey
    && ((activeTool === "select" && isThreeDoubleSelect(selected) && !(selected?.type === "furniture" && threeMoveId)) || (activeTool === "furniture" && selected))) {
    startThreeLongPress(event, selected!.id);
  }
  if (event.ctrlKey || event.metaKey) {
    threeMoveId = null;
    event.preventDefault();
    event.stopImmediatePropagation();
    threePointerDown = null;
    if (id) {
      const floorIndex = state.floors.findIndex((floor) => floor.entities.some((entity) => entity.id === id));
      if (floorIndex >= 0 && floorIndex !== state.activeFloor) {
        selectOnly(null);
        state.activeFloor = floorIndex;
        fitPlanToCanvas();
      }
      toggleSelection(id);
    }
    return;
  }

  if (activeTool === "erase") {
    event.stopImmediatePropagation();
    threePointerDown = null;
    if (selected && !isLocked(selected)) {
      removeEntityById(selected.id);
      commitState();
      lastThreeClick = { at: performance.now(), x: event.clientX, y: event.clientY, history: historyIndex, select: selected.id, revert: true };
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
  } else if (activeTool === "select" && selected?.type === "furniture" && !isLocked(selected)
    && threeMoveId && selectedEntities().some(item => item.id === threeMoveId) && selectedEntities().some(item => item.id === selected.id)) {
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
  const members = selectedEntities();
  const origins = !created && members.length > 1 && members.some((item) => item.id === furnitureItem.id) ? members.map(cloneEntity) : undefined;
  if (!origins) selectOnly(furnitureItem.id);
  threeDrag = { pointerId: event.pointerId, startScreen: { x: event.clientX, y: event.clientY }, startWorld: point, origin: cloneEntity(furnitureItem) as Furniture, origins, planeY, created, moved: false, pressedId: created ? id ?? undefined : undefined };
  threeCanvas.style.cursor = "grabbing";
  redrawAll();
}

// 3Dで物を選ぶ（家具なら、そのままドラッグで動かせるようにする）。何もなければ選択を外す
function selectThreePress(id: string | null): void {
  const entity = id ? findEntity(id) : undefined;
  selectThreeEntity(entity ? entity.id : null);
  if (entity?.type === "furniture") {
    threeMoveId = isLocked(entity) ? null : entity.id;
    syncThreeMoveMode();
  }
}

// ---- 3D: 左ドラッグの回転は、押した所（マウスの下の物）を中心に回す ----
// カメラと注視点を、押した点のまわりに同じだけ回すので、押した点は画面の同じ所にとどまる。
// 押した所に何もなければ地面の点、空なら、これまでどおり画面の中央（controls.target）が中心
let threeOrbit: { pointerId: number; pivot: THREE.Vector3; x: number; y: number } | null = null;
const threeTouches = new Set<number>();

function startThreeOrbit(event: PointerEvent): void {
  if (event.pointerType === "touch" && threeTouches.size > 1) {
    threeOrbit = null;
    return;
  }
  if (event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || !controls.enabled || threeDrag) return;
  threeOrbit = { pointerId: event.pointerId, pivot: orbitPivotAt(event), x: event.clientX, y: event.clientY };
}

function moveThreeOrbit(event: PointerEvent): void {
  if (!threeOrbit || event.pointerId !== threeOrbit.pointerId) return;
  if (!controls.enabled || threeDrag || threeTouches.size > 1) {
    threeOrbit = null;
    return;
  }
  // 速さは OrbitControls と同じ（画面の高さぶん動かすと1回転）
  const height = threeCanvas.clientHeight || 1;
  const yaw = (-2 * Math.PI * (event.clientX - threeOrbit.x)) / height;
  const pitch = (-2 * Math.PI * (event.clientY - threeOrbit.y)) / height;
  threeOrbit.x = event.clientX;
  threeOrbit.y = event.clientY;
  orbitAround(threeOrbit.pivot, yaw, pitch);
}

function endThreeOrbit(event: PointerEvent): void {
  if (threeOrbit?.pointerId === event.pointerId) threeOrbit = null;
}

function orbitPivotAt(event: MouseEvent): THREE.Vector3 {
  setThreeRay(event);
  planGroup.updateMatrixWorld(true);
  const hit = raycaster.intersectObjects(planGroup.children, true).find((item) => (item.object as THREE.Mesh).isMesh && item.object.visible);
  if (hit) return hit.point.clone();
  // 地面（高さ0）。遠すぎる所（地平線の近く）は使わない
  const ground = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  const reach = Math.max(50, camera.position.distanceTo(controls.target) * 4);
  if (ground && ground.distanceTo(camera.position) <= reach) return ground;
  return controls.target.clone();
}

// カメラと注視点を、pivot のまわりに、左右（縦の軸）へ yaw、上下へ pitch だけ回す。上下は、真上・真下ちょうどの手前まで
function orbitAround(pivot: THREE.Vector3, yaw: number, pitch: number): void {
  const offset = camera.position.clone().sub(controls.target);
  const length = offset.length();
  if (length < 1e-9) return;
  const polar = Math.acos(clamp(offset.y / length, -1, 1));
  const turn = clamp(polar + pitch, 0.001, Math.PI - 0.001) - polar;
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const side = new THREE.Vector3().crossVectors(offset, camera.up);
  // 横の軸のまわりに正の向きに回すと、カメラは上（真上から見る側）へ動く。下へ動かすときは逆向き
  if (side.lengthSq() > 1e-12) rotation.multiply(new THREE.Quaternion().setFromAxisAngle(side.normalize(), -turn));
  for (const point of [camera.position, controls.target]) point.sub(pivot).applyQuaternion(rotation).add(pivot);
  controls.update();
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

function pickThreeEntity(event: MouseEvent): string | null {
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
  if (threeDrag.origins) moveSelection(threeDrag.origins, point.x - threeDrag.startWorld.x, point.y - threeDrag.startWorld.y);
  else moveEntity(entity, threeDrag.origin, point.x - threeDrag.startWorld.x, point.y - threeDrag.startWorld.y);
  // 3Dは動かした家具だけを動かす（離したときに全体を作り直す）
  render2d();
  syncThreeWhileDragging((threeDrag.origins ?? [threeDrag.origin]).map((origin) => findEntity(origin.id)).filter((item): item is Entity => Boolean(item)));
}

function finishThreeDrag(cancel = false): void {
  if (!threeDrag) return;
  const gesture = threeDrag;
  threeDrag = null;
  threePointerDown = null;
  const current = findEntity(gesture.origin.id);
  if (cancel) {
    if (gesture.created) removeEntityById(gesture.origin.id);
    else restoreOrigins(gesture.origins ?? [gesture.origin]);
  } else if (gesture.origins ? gesture.origins.some((origin) => JSON.stringify(findEntity(origin.id)) !== JSON.stringify(origin)) : current && (gesture.created || JSON.stringify(current) !== JSON.stringify(gesture.origin))) {
    commitState();
    // クリックで置いた家具（続けてもう1回押したら、取り消して、そこにあった物を選ぶ）
    if (gesture.created && !gesture.moved && current) {
      lastThreeClick = { at: performance.now(), x: gesture.startScreen.x, y: gesture.startScreen.y, history: historyIndex, select: gesture.pressedId ?? current.id, revert: Boolean(gesture.pressedId) };
    }
  }
  controls.enabled = true;
  if (threeCanvas.hasPointerCapture(gesture.pointerId)) threeCanvas.releasePointerCapture(gesture.pointerId);
  syncThreeMoveMode();
  redrawAll();
}

function cancelThreeDrag(): void {
  finishThreeDrag(true);
}

// 3D: タッチ（指・ペン）で家具・ドア・窓を長押ししたら選ぶ。家具は、そのまま指を動かすと動く（マウスはダブルクリックで選ぶ）
let threeLongPress: { timer: number; pointerId: number; x: number; y: number; id: string; last: PointerEvent } | null = null;

function startThreeLongPress(event: PointerEvent, id: string): void {
  cancelThreeLongPress();
  showPressRing(event.clientX, event.clientY, threeCanvas.parentElement);
  threeLongPress = {
    timer: window.setTimeout(() => {
      const press = threeLongPress;
      threeLongPress = null;
      hidePressRing();
      const entity = press ? findEntity(press.id) : undefined;
      if (!press || !entity) return;
      // 家具を置くツールで押していたときは、置きかけた家具をやめる
      if (threeDrag?.created) cancelThreeDrag();
      if (entity.type !== "furniture") {
        selectThreeEntity(press.id);
        return;
      }
      selectThreeEntity(press.id);
      threeMoveId = isLocked(entity) ? null : press.id;
      syncThreeMoveMode();
      if (threeMoveId) beginThreeMove(press.last, entity);
    }, LONG_PRESS_MS),
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    id,
    last: event,
  };
}

function cancelThreeLongPress(): void {
  if (!threeLongPress) return;
  window.clearTimeout(threeLongPress.timer);
  threeLongPress = null;
  hidePressRing();
}

function trackThreeLongPress(event: PointerEvent): void {
  if (!threeLongPress || event.pointerId !== threeLongPress.pointerId) return;
  threeLongPress.last = event;
  if (event.type !== "pointermove" || Math.hypot(event.clientX - threeLongPress.x, event.clientY - threeLongPress.y) > 8) cancelThreeLongPress();
}

// 3Dでつかんだ物を動かし始める（まとめて選んでいる物の1つなら、まとめて動かす）。
// 屋根は屋根の高さ、ほかは床の高さの水平な面の上で動かすので、つかんだ所がマウスについてくる
function beginThreeMove(event: PointerEvent, entity: Entity): void {
  const floorIndex = entity.type === "roof"
    ? state.floors.findIndex((floor) => floor.id === entity.floorId)
    : state.floors.findIndex((floor) => floor.entities.some((item) => item.id === entity.id));
  if (floorIndex < 0) return;
  const planeY = entity.type === "roof"
    ? floorBaseY(floorIndex) + WALL_HEIGHT + (entity.elevation ?? 0) * SCALE_3D
    : floorBaseY(floorIndex) + floorTopOffset(floorIndex);
  const point = threeFloorPoint(event, planeY);
  if (!point) return;
  controls.enabled = false;
  if (!threeCanvas.hasPointerCapture(event.pointerId)) threeCanvas.setPointerCapture(event.pointerId);
  state.activeFloor = floorIndex;
  const members = selectedEntities();
  const origins = members.length > 1 && members.some((item) => item.id === entity.id) ? members.map(cloneEntity) : undefined;
  if (!origins) selectOnly(entity.id);
  threeDrag = { pointerId: event.pointerId, startScreen: { x: event.clientX, y: event.clientY }, startWorld: point, origin: cloneEntity(entity), origins, planeY, created: false, moved: false };
  threeCanvas.style.cursor = "grabbing";
  redrawAll();
}

// 3Dの案内（家具を1回クリックしたときに、選び方を少しのあいだ出す）
let threeHint: HTMLDivElement | null = null;
let threeHintTimer = 0;

function showThreeHint(text: string): void {
  const pane = threeCanvas.parentElement;
  if (!pane) return;
  if (!threeHint) {
    threeHint = document.createElement("div");
    threeHint.className = "tool-hint three-hint";
    threeHint.id = "threeHint";
    threeHint.setAttribute("role", "status");
    pane.appendChild(threeHint);
  }
  threeHint.textContent = text;
  threeHint.hidden = false;
  window.clearTimeout(threeHintTimer);
  threeHintTimer = window.setTimeout(() => {
    if (threeHint) threeHint.hidden = true;
  }, 3200);
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
  const entity = entityId ? findEntity(entityId) : undefined;
  // 家具・ドア・窓の上で視点を操作しても選択が変わらないよう、選択はダブルクリックで行う。1回クリックしたときは、選び方を案内する
  if (entity && isThreeDoubleSelect(entity)) {
    if (!selectedEntities().some((item) => item.id === entity.id) && activeTool === "select" && event.pointerType === "mouse") {
      showThreeHint(entity.type === "furniture" ? "家具はダブルクリックで選べます。選んだ家具は、そのままドラッグで動かせます" : "ドア・窓はダブルクリックで選べます");
    }
    return;
  }
  selectThreeEntity(entityId);
}

// 3Dでダブルクリック（タッチは長押し）で選ぶ物: 家具と建具（ドア・窓）。ほかの物（床・壁・屋根など）は1回のクリックで選ぶ
function isThreeDoubleSelect(entity: Entity | undefined): boolean {
  return entity?.type === "furniture" || entity?.type === "door" || entity?.type === "window";
}

function selectThreeEntity(entityId: string | null): void {
  if (!entityId || !selectedEntities().some(item => item.id === entityId)) selectOnly(entityId);
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

function handleThreeDoubleClick(event: MouseEvent): void {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || threeDrag || activeTool === "furniture" || activeTool === "erase") return;
  const id = pickThreeEntity(event), entity = id ? findEntity(id) : undefined;
  if (!isThreeDoubleSelect(entity)) return;
  // 家具なら、そのままドラッグで動かせるようにする
  selectThreePress(id);
}

// 移動モードのボタンと、3Dのカーソル。ダブルクリックで選んだ家具（threeMoveId）も、そのままドラッグで動かせる
function syncThreeMoveMode(): void {
  const members = selectedEntities();
  if (threeMoveId && !members.some(item => item.id === threeMoveId && !isLocked(item))) threeMoveId = null;
  const button = document.querySelector<HTMLButtonElement>("#threeMoveToggle");
  if (button) {
    button.classList.toggle("is-active", threeMoveMode);
    button.setAttribute("aria-pressed", String(threeMoveMode));
  }
  if (!threeDrag) threeCanvas.style.cursor = threeMoveMode || threeMoveId ? "move" : "grab";
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

// 2Dを、画面の真ん中を中心に拡大・縮小する
function zoomPlanBy(factor: number): void {
  const rect = planCanvas.getBoundingClientRect();
  const cx = rect.width / 2, cy = rect.height / 2;
  const before = { x: (cx - view.x) / view.zoom, y: (cy - view.y) / view.zoom };
  view.zoom = clamp(view.zoom * factor, MIN_PLAN_ZOOM, MAX_PLAN_ZOOM);
  view.x = cx - before.x * view.zoom;
  view.y = cy - before.y * view.zoom;
  render2d();
}

function handleKeyDown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  const isEditing = target?.tagName === "INPUT" || target?.tagName === "SELECT" || target?.tagName === "TEXTAREA" || Boolean(target?.isContentEditable);
  if (isEditing) return;
  if (isPointDrafting()) {
    if (event.key === "Enter") { event.preventDefault(); finishFloorDraft(); return; }
    if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"))) { event.preventDefault(); redoFloorPoint(); return; }
    if (event.key === "Backspace" || event.key === "Delete" || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z")) {
      event.preventDefault(); undoFloorPoint(); return;
    }
  }
  if (floorEdit && event.key === "Escape" && drag.pointerId === null) {
    event.preventDefault(); floorEdit = null; floorEditError = ""; redrawAll(false); return;
  }
  if (floorEdit && !event.ctrlKey && !event.metaKey && (event.key === "Delete" || event.key === "Backspace")) {
    event.preventDefault(); removeFloorVertex(); return;
  }
  if (floorEdit && !event.ctrlKey && !event.metaKey && event.key.startsWith("Arrow")) {
    event.preventDefault();
    const room = findEntity(floorEdit.id);
    if (room?.type === "room" && !isLocked(room) && floorEdit.vertex !== null) {
      const points = floorPoints(room), p = points[floorEdit.vertex], step = event.shiftKey ? GRID : 1;
      p[0] += event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      p[1] += event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      if (updateFloorVertex(room, points)) { commitState(); redrawAll(); }
    }
    return;
  }
  if (event.key === "Escape" && threeDrag) {
    cancelThreeDrag();
    threeMoveId = null;
    threeMoveMode = false;
    syncThreeMoveMode();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    threeMoveId = null;
    threeMoveMode = false;
    syncThreeMoveMode();
    if (floorRetraceId) {
      floorRetraceId = null;
      activeTool = "select";
      setActiveButton("[data-tool]", activeTool);
    }
    const gesturing = drag.pointerId !== null;
    cancelPlanDrag();
    floorDraft = null;
    floorEditError = "";
    if (!gesturing && activeTool === "select") selectOnly(null);
    activeTool = "select";
    pathRedrawId = null;
    setActiveButton("[data-tool]", activeTool);
    syncPlanCursor();
    redrawAll();
    return;
  }
  // Ctrl+A でいまの階の物をぜんぶ選び、Ctrl+C・V で写し、Ctrl+D で複製する
  if ((event.ctrlKey || event.metaKey) && !event.altKey && ["a", "c", "v", "d"].includes(event.key.toLowerCase())) {
    const key = event.key.toLowerCase();
    const members = selectedEntities();
    if (key === "a") {
      event.preventDefault();
      cancelPlanDrag();
      selectMany([...activeEntities(), ...(roofsOn2d() ? state.roofs : [])].map((entity) => entity.id));
      activeTool = "select";
      setActiveButton("[data-tool]", activeTool);
      syncPlanCursor();
      redrawAll();
      return;
    }
    if (key === "c" && members.length) {
      event.preventDefault();
      clipboard = { floorId: state.floors[state.activeFloor].id, entities: members.map(cloneEntity), pastes: 0 };
      return;
    }
    if (key === "v" && clipboard) {
      event.preventDefault();
      // 同じ階へ貼るときは、元の物と重ならないよう少しずつずらす。ほかの階へは同じ位置に貼る（上の階に同じ壁を作るときなど）
      const sameFloor = clipboard.floorId === state.floors[state.activeFloor].id;
      if (sameFloor) clipboard.pastes += 1;
      const offset = sameFloor ? clipboard.pastes * GRID * 2 : 0;
      placeCopies(clipboard.entities, offset, offset);
      return;
    }
    if (key === "d" && members.length) {
      event.preventDefault();
      placeCopies(members, GRID * 2, GRID * 2);
      return;
    }
  }
  // 矢印キーで、選んでいる物を少しずつ動かす（Shift で大きく）
  if (event.key.startsWith("Arrow") && !event.ctrlKey && !event.metaKey && !event.altKey && drag.pointerId === null) {
    const members = selectedEntities().filter((entity) => !isLocked(entity));
    const step = GRID * (event.shiftKey ? 5 : 1);
    const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    if (members.length && (dx || dy)) {
      event.preventDefault();
      moveSelection(members.map(cloneEntity), dx, dy);
      commitState();
      redrawAll();
      return;
    }
  }
  if (threeDrag && (event.ctrlKey || event.metaKey) && ["z", "y"].includes(event.key.toLowerCase())) cancelThreeDrag();
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    cancelPlanDrag();
    event.shiftKey ? redo() : undo();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
    event.preventDefault();
    cancelPlanDrag();
    redo();
    return;
  }
  // ファイルに保存（Ctrl+S）。ブラウザのページ保存の代わりに、間取りのファイルを書き出す
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "s") {
    event.preventDefault();
    exportPlan();
    return;
  }
  // 階の切り替え（[ 下の階・] 上の階）、方眼の表示（G）、全体を表示（0）、拡大・縮小（+ / -）
  if (!event.ctrlKey && !event.metaKey && !event.altKey && drag.pointerId === null) {
    if (event.key === "[" || event.key === "]") {
      const next = state.activeFloor + (event.key === "]" ? 1 : -1);
      if (next >= 0 && next < state.floors.length) setActiveFloorIndex(next);
      return;
    }
    if (event.key === "g" || event.key === "G") {
      displaySettings.grid = !displaySettings.grid;
      applyDisplaySettings();
      return;
    }
    if (event.key === "0") {
      fitPlanToCanvas();
      render2d();
      return;
    }
    if (event.key === "+" || event.key === "=" || event.key === "-") {
      zoomPlanBy(event.key === "-" ? 1 / 1.25 : 1.25);
      return;
    }
  }
  if (!isEditing && event.key.toLowerCase() === "l" && state.selectedId) {
    const members = selectedEntities();
    if (members.length) {
      const locked = !members.every(isLocked);
      members.forEach((item) => { item.locked = locked; });
      commitState();
      redrawAll();
    }
    return;
  }
  if (!event.ctrlKey && !event.metaKey && (event.key === "Delete" || event.key === "Backspace")) {
    event.preventDefault();
    deleteSelection();
    return;
  }
  if (selectedEntities().length > 1) {
    // まとめて選んでいるときの R は、全体を90°回す
    if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "r") {
      rotateSelection(selectedEntities());
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

// 部屋・床をなぞって描いたか。ぐるっと囲むように動かした線は、四角を描くときの斜めのドラッグより、ずっと長い
function isFloorTrace(path: Point[]): boolean {
  if (path.length < 6) return false;
  let length = 0;
  for (let i = 1; i < path.length; i += 1) length += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  const start = path[0], end = path[path.length - 1];
  const xs = path.map((p) => p.x), ys = path.map((p) => p.y);
  const size = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return size >= GRID * 2 && length > 2 * Math.hypot(end.x - start.x, end.y - start.y) + GRID * 4;
}

// 選んでいた床の形を描き直す。ぐるっとなぞったらその形、斜めにドラッグしたら四角。床材・名前・色などはそのまま。
// 階段の穴は、新しい形の中に収まるならそのまま残す
function retraceFloor(id: string, path: Point[] | null, start: Point, end: Point): void {
  const room = findEntity(id);
  floorRetraceId = null;
  if (room?.type !== "room" || isLocked(room)) return;
  let frame: { x: number; y: number; w: number; h: number; outline?: [number, number][] } | null;
  if (path) {
    const points = tracedFloorPoints(path.map((p): [number, number] => [p.x, p.y]), Math.max(1, 1 / view.zoom));
    frame = points && outlineFromPoints(points);
  } else {
    const x = snap(Math.min(start.x, end.x)), y = snap(Math.min(start.y, end.y));
    const w = snap(Math.abs(end.x - start.x)), h = snap(Math.abs(end.y - start.y));
    frame = w >= GRID * 2 && h >= GRID * 2 ? { x, y, w, h } : null;
  }
  if (!frame) return;
  const holes = room.holes?.map((ring) => ring.map(([u, v]): [number, number] => [(room.x + u * room.w - frame!.x) / frame!.w, (room.y + v * room.h - frame!.y) / frame!.h]));
  Object.assign(room, { x: frame.x, y: frame.y, w: frame.w, h: frame.h });
  if (frame.outline) room.outline = frame.outline;
  else delete room.outline;
  delete room.holes;
  if (holes?.length) {
    try {
      room.holes = normalizeFloorHoles(holes, room.outline);
    } catch {
      delete room.holes;
    }
  }
  // 名前の位置は、新しい形の左上から測り直す
  delete room.labelOffsetX;
  delete room.labelOffsetY;
  activeTool = "select";
  setActiveButton("[data-tool]", activeTool);
  selectOnly(room.id);
}

// なぞって囲んだ形の床（いま選んでいる床材）。線の揺れをならし、交わった所はほどく
function addFloorFromTrace(path: Point[]): void {
  const points = tracedFloorPoints(path.map((p): [number, number] => [p.x, p.y]), Math.max(1, 1 / view.zoom));
  const outline = points && outlineFromPoints(points);
  if (!outline) return;
  const entities = activeEntities();
  const floor: Room = {
    id: newId("room"), type: "room", name: "",
    color: activeRoomSurface === "plain" ? ROOM_COLORS[entities.length % ROOM_COLORS.length] : SURFACE_DEFS[activeRoomSurface].color,
    surface: activeRoomSurface, ...outline,
  };
  entities.push(floor);
  state.selectedId = floor.id;
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
  if (type === "door" && doorStyle && doorStyle !== "swing") line.doorStyle = doorStyle;
  if (type === "wall" && activeWallStyle !== "plain") line.wallStyle = activeWallStyle;
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
  if (kind === "ellipse") {
    const x1 = snap(start.x), y1 = snap(start.y), x2 = snap(end.x), y2 = snap(end.y);
    shape.x = (x1 + x2) / 2; shape.y = (y1 + y2) / 2;
    shape.r = Math.max(GRID, Math.abs(x2 - x1) / 2);
    shape.ry = Math.max(GRID, Math.abs(y2 - y1) / 2);
  }
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

function reshapeRoom(room: Room, points: [number, number][]): boolean {
  const outline = outlineFromPoints(points);
  if (!outline) return false;
  const holes = floorPolygon(room).slice(1).map(ring => ring.map(([x, y]): [number, number] => [(x - outline.x) / outline.w, (y - outline.y) / outline.h]));
  try { outline.holes = normalizeFloorHoles(holes, outline.outline); }
  catch { return false; }
  const label = getRoomLabelPosition(room);
  Object.assign(room, outline);
  room.labelOffsetX = label.x - room.x;
  room.labelOffsetY = label.y - room.y;
  return true;
}

function floorHandles(room: Room): { key: string; x: number; y: number }[] {
  if (floorEdit?.id !== room.id) {
    if (regularFloor(room)) return floorPoints(room).map(([x, y], i) => ({ key: `regular:${i}`, x, y }));
    if (isEllipseFloor(room)) return [
      { key: "round:e", x: room.x + room.w, y: room.y + room.h / 2 },
      { key: "round:s", x: room.x + room.w / 2, y: room.y + room.h },
      { key: "round:w", x: room.x, y: room.y + room.h / 2 },
      { key: "round:n", x: room.x + room.w / 2, y: room.y },
    ];
    return [
      { key: "nw", x: room.x, y: room.y }, { key: "ne", x: room.x + room.w, y: room.y },
      { key: "sw", x: room.x, y: room.y + room.h }, { key: "se", x: room.x + room.w, y: room.y + room.h },
    ];
  }
  const points = floorPoints(room);
  return [
    ...points.map(([x, y], i) => ({ key: `vertex:${i}`, x, y })),
    ...(points.length >= MAX_FLOOR_VERTICES ? [] : points.map(([x, y], i) => {
      const next = points[(i + 1) % points.length];
      return { key: `edge:${i}`, x: (x + next[0]) / 2, y: (y + next[1]) / 2 };
    })),
  ];
}

// いま描こうとしている物（描き方を覚える単位）。床は "floor"、ペンの線は "paint"
function drawKey(): string | null {
  if (activeTool === "room" || activeTool === "floor") return "floor";
  if (activeTool === "paint") return penSettings.kind;
  if (activeTool === "furniture" && isTraceableKind(activeFurniture)) return activeFurniture;
  return null;
}

function drawMethodFor(key: string): DrawMethod {
  const stored = drawMethods[key];
  // ペンで塗れるのは、床と、池・花壇・芝生・ラグだけ
  if (stored && (stored !== "brush" || isAreaKey(key))) return stored;
  if (STRAIGHT_DRAW_KINDS.has(key)) return "straight";
  // ペンのツールでは、閉じる形ははじめから塗る
  return activeTool === "paint" && isAreaKey(key) ? "brush" : "trace";
}

// ペンで塗れる物（床と、池・花壇・芝生・ラグ）か
function isAreaKey(key: string | null): boolean {
  return key === "floor" || (key !== null && isFreeAreaKind(key));
}

// いまの描き方。床は、部屋のツールが「ペンで塗る」か「囲んで描く」、線で囲んで床を作成が「直線」か「曲線」。
// なぞり直しているときは、塗らずになぞる
function currentDrawMethod(): DrawMethod {
  const key = drawKey();
  if (!key) return "trace";
  const method = activeTool === "room" ? (drawMethods.floor === "brush" ? "brush" : "trace")
    : activeTool === "floor" ? (drawMethods.floor === "curve" ? "curve" : "straight")
    : drawMethodFor(key);
  return method === "brush" && (floorRetraceId || pathRedrawId) ? "trace" : method;
}

// ペンで塗っているか（床・池などを、幅のある線で塗る・けずる）
function isBrushing(): boolean {
  return currentDrawMethod() === "brush";
}

// 塗る幅（cm）
function brushWidthFor(key: string): number {
  return clampBrushWidth(brushWidths[key]);
}

// 点を打って描いているか（線で囲んで床を作成と、描き方を「直線」「曲線」にしたペン・なぞれる物）
function isPointDrafting(): boolean {
  const method = currentDrawMethod();
  return activeTool === "floor" || ((activeTool === "paint" || (activeTool === "furniture" && isTraceableKind(activeFurniture))) && (method === "straight" || method === "curve"));
}

// ---- ペンで塗る・けずる ----
// 床（同じ素材）や、池・花壇・芝生・ラグ（同じ種類）を、幅のある線で塗る。重なった物とは1つにつながり、
// 輪のように塗ると真ん中があいた形（ドーナツ）になる。けずるときは、重なった所をその物から取りのぞく
const BRUSH_CUT_COLOR = "#d64545";

// 塗っている所の色（床は素材の色、池などはその物の色）
function brushFill(key: string): string {
  if (key === "floor") return activeRoomSurface === "plain" ? "#9fb6cc" : SURFACE_DEFS[activeRoomSurface].color;
  return key === "pond" ? OUTDOOR_WATER : key === "lawn" ? OUTDOOR_LEAF : key === "flowerBed" ? OUTDOOR_SOIL : furnitureSymbolFill(key as FurnitureKind);
}

// 塗っている線（離すと、この形が床・池などになる。けずるときは赤）
function drawBrushPreview(points: Point[]): void {
  if (deferOverlay(() => drawBrushPreview(points))) return;
  const key = drawKey();
  if (!key || !points.length) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = brushWidthFor(key);
  ctx.strokeStyle = brushCut ? BRUSH_CUT_COLOR : brushFill(key);
  ctx.globalAlpha = brushCut ? 0.4 : 0.6;
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  if (points.length === 1) ctx.lineTo(points[0].x + 0.01, points[0].y);
  ctx.stroke();
  ctx.restore();
}

// 塗り終えたとき: 塗った形を、床か、池などの自由な形にする
function paintArea(points: Point[]): void {
  const key = drawKey();
  if (!key || !isAreaKey(key)) return;
  const stroke = brushStroke(points.map((p): Pair => [p.x, p.y]), brushWidthFor(key));
  if (!stroke.length) return;
  if (key === "floor") paintFloor(stroke);
  else paintFreeArea(key as FreeKind, stroke);
  // 続けて塗れるよう、選ばない
  selectOnly(null);
}

function roomRegion(room: Room): MultiPolygon {
  return [floorPolygon(room)];
}

// 床を塗る: いま選んでいる素材の床で、塗った所に重なる物とつなげる（なければ新しい床）。けずるときは、その床から取りのぞく。
// 名前のある部屋（リビングなど）は、塗っても形を変えない（上に床が重なる）。けずるときは、名前があってもけずる
function paintFloor(stroke: MultiPolygon): void {
  const entities = activeEntities();
  const targets = entities.filter((entity): entity is Room => isRoom(entity) && !isLocked(entity) && (entity.surface ?? "plain") === activeRoomSurface && regionsOverlap(roomRegion(entity), stroke));
  const shapes = (region: MultiPolygon) => tidyRegion(region, { maxPoints: 2000 }).map((rings) => floorFromRegion(rings)).filter((shape): shape is FloorRegion => Boolean(shape));
  if (brushCut) {
    for (const room of targets) applyFloorPieces(room, shapes(subtractRegion(roomRegion(room), stroke)));
    return;
  }
  const joined = targets.filter((room) => !room.name.trim());
  const pieces = shapes(unionRegions(stroke, ...joined.map(roomRegion)));
  if (!pieces.length) return;
  const [first, ...others] = joined;
  if (first) {
    others.forEach((room) => removeEntityById(room.id));
    applyFloorPieces(first, pieces);
    return;
  }
  for (const piece of pieces) {
    entities.push({
      id: newId("room"), type: "room", name: "",
      color: activeRoomSurface === "plain" ? ROOM_COLORS[entities.length % ROOM_COLORS.length] : SURFACE_DEFS[activeRoomSurface].color,
      surface: activeRoomSurface, ...piece,
    });
  }
}

// 床に新しい形を当てる。なくなったら消し、いくつかに分かれたら、残りは同じ素材・色の新しい床（名前は付けない）
function applyFloorPieces(room: Room, pieces: FloorRegion[]): void {
  if (!pieces.length) {
    removeEntityById(room.id);
    return;
  }
  const [first, ...rest] = pieces;
  const copy = cloneEntity(room) as Room;
  Object.assign(room, { x: first.x, y: first.y, w: first.w, h: first.h, outline: first.outline });
  if (first.holes) room.holes = first.holes;
  else delete room.holes;
  const entities = activeEntities();
  let index = entities.indexOf(room);
  for (const piece of rest) {
    const extra: Room = { ...copy, id: newId("room"), name: "", x: piece.x, y: piece.y, w: piece.w, h: piece.h, outline: piece.outline };
    delete extra.holes;
    if (piece.holes) extra.holes = piece.holes;
    delete extra.labelOffsetX;
    delete extra.labelOffsetY;
    entities.splice(++index, 0, extra);
  }
}

// 自由な形（池など）の、間取りの上での形（cm）。なぞっていない池・花壇・ラグは、いつもの形（池は楕円、ほかは四角）
function freeItemRegion(item: Furniture): MultiPolygon {
  const kind = item.kind as FreeKind;
  const local: Point2[][] = isFreeShapeItem(item)
    ? [freeItemPoints(kind, item.w, item.h, item), ...freeItemHoles(kind, item.w, item.h, item)]
    : [kind === "pond"
      ? Array.from({ length: 32 }, (_, i): Point2 => [Math.cos((i / 32) * Math.PI * 2) * item.w / 2, Math.sin((i / 32) * Math.PI * 2) * item.h / 2])
      : [[-item.w / 2, -item.h / 2], [item.w / 2, -item.h / 2], [item.w / 2, item.h / 2], [-item.w / 2, item.h / 2]]];
  const rings = local.map((ring) => ring.map((point): Pair => {
    const world = furnitureLocalToWorld(item, point);
    return [world.x, world.y];
  }));
  // なぞった道すじは、交わっていることもある。いったん合わせてほどいてから、穴を引く
  try {
    const outer = clipping.union([rings[0]]);
    return rings.length > 1 ? clipping.difference(outer, ...rings.slice(1).map((ring): [Pair[]] => [ring])) : outer;
  } catch {
    return [];
  }
}

// 池などを塗る: 同じ種類で、塗った所に重なる物とつなげる（なければ新しく置く）。けずるときは、その物から取りのぞく
function paintFreeArea(kind: FreeKind, stroke: MultiPolygon): void {
  const entities = activeEntities();
  const targets = entities.filter((entity): entity is Furniture => entity.type === "furniture" && entity.kind === kind && !isLocked(entity) && regionsOverlap(freeItemRegion(entity), stroke));
  const pieces = (region: MultiPolygon) => tidyRegion(region, { maxPoints: MAX_FREE_RING_POINTS });
  if (brushCut) {
    for (const item of targets) applyFreePieces(item, pieces(subtractRegion(freeItemRegion(item), stroke)));
    return;
  }
  const merged = pieces(unionRegions(stroke, ...targets.map(freeItemRegion)));
  if (!merged.length) return;
  const [first, ...others] = targets;
  if (first) {
    others.forEach((item) => removeEntityById(item.id));
    applyFreePieces(first, merged);
    return;
  }
  for (const rings of merged) {
    const item: Furniture = { id: newId("furniture"), type: "furniture", kind, x: 0, y: 0, w: 1, h: 1, rotation: 0, ...newFurnitureDetails(kind) };
    setFreeRegion(item, rings);
    entities.push(item);
  }
}

// 自由な形に、新しい形（cm の輪。1つ目が外側、残りが穴）を当てる。向きは0度にそろえる
function setFreeRegion(item: Furniture, rings: Pair[][]): void {
  const [outer, ...holes] = rings;
  const frame = freeFrame(outer, freeMargin(item.kind as FreeKind), holes);
  Object.assign(item, { x: frame.x, y: frame.y, w: frame.w, h: frame.h, rotation: 0, path: frame.path });
  if (frame.holes) item.holes = frame.holes;
  else delete item.holes;
  delete item.flip;
}

// なくなったら消し、いくつかに分かれたら、残りは同じ種類・色の新しい物
function applyFreePieces(item: Furniture, pieces: Pair[][][]): void {
  if (!pieces.length) {
    removeEntityById(item.id);
    return;
  }
  const [first, ...rest] = pieces;
  const copy = cloneEntity(item) as Furniture;
  setFreeRegion(item, first);
  const entities = activeEntities();
  let index = entities.indexOf(item);
  for (const rings of rest) {
    const extra: Furniture = { ...copy, id: newId("furniture") };
    setFreeRegion(extra, rings);
    entities.splice(++index, 0, extra);
  }
}

// 打った点から、描く物の道すじを作る。曲線は点を通るなめらかな線、直線の自由な形は角をとがらせる
function shapeDraftPoints(points: [number, number][], closed: boolean): Point2[] {
  if (currentDrawMethod() === "curve") return curveThrough(points, closed);
  const kind = activeTool === "paint" ? penSettings.kind : activeFurniture;
  if (kind !== "paint" && isFreeShapeKind(kind)) return sharpCorners(points, closed);
  return points.map(([x, y]): Point2 => [x, y]);
}

// 直線で描くとき、点を打つ前にドラッグしたら、そのまま1本の直線（閉じる形は四角）を置く
function placeStraightDrag(start: Point, end: Point): void {
  const a = draftFloorPoint(start), b = draftFloorPoint(end);
  if (a.x === b.x && a.y === b.y) return;
  const target = draftTarget();
  const points: [number, number][] = target.closed ? [[a.x, a.y], [b.x, a.y], [b.x, b.y], [a.x, b.y]] : [[a.x, a.y], [b.x, b.y]];
  if (target.closed && (a.x === b.x || a.y === b.y)) return;
  floorDraft = { floorId: activeFloor().id, target: target.key, points, undone: [], hover: null };
  finishFloorDraft();
}

// 点を打って描く物。閉じた形（床・池・塗りつぶすペンなど）は最初の点に戻って閉じ、線（川・小道・ペンの線・足跡など）は Enter かダブルクリックで終える
function draftTarget(): { key: string; label: string; closed: boolean; min: number } {
  if (activeTool === "floor") return { key: `floor:${currentDrawMethod()}`, label: "床", closed: true, min: 3 };
  const kind = activeTool === "paint" ? penSettings.kind : activeFurniture;
  const method = currentDrawMethod();
  if (kind === "paint") return { key: `${penSettings.filled ? "paint-fill" : "paint"}:${method}`, label: "ペン", closed: penSettings.filled, min: penSettings.filled ? 3 : 2 };
  const closed = isFreeShapeKind(kind) && isFreeAreaKind(kind);
  return { key: `${kind}:${method}`, label: FURNITURE_DEFS[kind].label, closed, min: closed ? 3 : 2 };
}

function syncFloorEditing(): void {
  if (floorDraft && (!isPointDrafting() || floorDraft.floorId !== activeFloor().id || floorDraft.target !== draftTarget().key)) { floorDraft = null; floorEditError = ""; }
  const room = floorEdit ? findEntity(floorEdit.id) : null;
  if (floorEdit && (activeTool !== "select" || room?.type !== "room" || state.selectedId !== room.id || selectedEntities().length !== 1 || isLocked(room))) {
    floorEdit = null;
    floorEditError = "";
  }
  if (floorEdit && room?.type === "room" && floorEdit.vertex !== null) floorEdit.vertex = Math.min(floorEdit.vertex, floorPoints(room).length - 1);
  syncFloorToolbar();
}

function draftFloorPoint(point: Point, orthogonal = false): Point {
  const p = { x: snap(point.x), y: snap(point.y) };
  const last = floorDraft?.points[floorDraft.points.length - 1];
  if (orthogonal && last) {
    if (Math.abs(p.x - last[0]) >= Math.abs(p.y - last[1])) p.y = last[1];
    else p.x = last[0];
  }
  return p;
}

function addDraftFloorPoint(point: Point, orthogonal: boolean): void {
  const target = draftTarget();
  floorDraft ??= { floorId: activeFloor().id, target: target.key, points: [], undone: [], hover: null };
  const points = floorDraft.points, first = points[0], last = points[points.length - 1];
  if (target.closed && points.length >= 3 && Math.hypot(point.x - first[0], point.y - first[1]) <= 14 / view.zoom) { finishFloorDraft(); return; }
  const p = draftFloorPoint(point, orthogonal);
  // 線は、最後の点をもう一度押しても終える
  if (last && last[0] === p.x && last[1] === p.y) {
    if (!target.closed && points.length >= target.min) finishFloorDraft();
    return;
  }
  if (points.length >= MAX_FLOOR_VERTICES) { floorEditError = `頂点は${MAX_FLOOR_VERTICES}個までです`; syncFloorToolbar(); return; }
  points.push([p.x, p.y]);
  floorDraft.undone = [];
  floorDraft.hover = p;
  floorEditError = "";
  syncFloorToolbar();
}

function undoFloorPoint(): void {
  const point = floorDraft?.points.pop();
  if (point) floorDraft!.undone.push(point);
  floorEditError = "";
  syncFloorToolbar();
  render2d();
}

function redoFloorPoint(): void {
  const point = floorDraft?.undone.pop();
  if (point) floorDraft!.points.push(point);
  floorEditError = "";
  syncFloorToolbar();
  render2d();
}

function finishFloorDraft(): void {
  const target = draftTarget();
  if (!floorDraft || floorDraft.points.length < target.min) {
    floorEditError = `${target.label}には${target.min}点以上必要です`;
    syncFloorToolbar();
    return;
  }
  if (activeTool !== "floor") {
    finishShapeDraft();
    return;
  }
  const curved = currentDrawMethod() === "curve" ? tracedFloorPoints(curveThrough(floorDraft.points, true), 1) : null;
  const outline = outlineFromPoints(curved ?? floorDraft.points);
  if (!outline) { floorEditError = "線が交差しているか、床の面積がありません"; syncFloorToolbar(); return; }
  const room: Room = { id: newId("room"), type: "room", name: "", color: SURFACE_DEFS[activeRoomSurface].color, surface: activeRoomSurface, ...outline };
  activeEntities().push(room);
  floorDraft = null;
  activeTool = "select";
  selectOnly(room.id);
  floorEdit = { id: room.id, vertex: null };
  setActiveButton("[data-tool]", activeTool);
  syncPlanCursor();
  commitState();
  redrawAll();
}

// 点を打って描いたペンの線・自由な形・足跡・破片を置く（点と点のあいだはまっすぐ）。描くツールのまま続けて描ける
function finishShapeDraft(): void {
  if (!floorDraft) return;
  const points = shapeDraftPoints(floorDraft.points, draftTarget().closed).map(([x, y]): Point => ({ x, y }));
  floorDraft = null;
  floorEditError = "";
  if (activeTool === "paint") {
    const kind = penSettings.kind;
    if (kind === "paint") placePaintStroke(points, true);
    else {
      placeFreeShapePath(kind, points, true);
      state.selectedId = null;
    }
  } else if (activeFurniture === "footprints") placeFootprintPath(points);
  else if (activeFurniture === "brokenGlass") placeShardPath(points);
  else if (isFreeShapeKind(activeFurniture)) placeFreeShapePath(activeFurniture, points, true);
  commitState();
  redrawAll();
}

function syncFloorToolbar(): void {
  syncHistoryButtons();
  const pane = planCanvas.parentElement;
  if (!pane) return;
  if (!floorToolbar) {
    floorToolbar = document.createElement("div");
    floorToolbar.className = "floor-toolbar";
    floorToolbar.id = "floorToolbar";
    pane.appendChild(floorToolbar);
  }
  const drawing = isPointDrafting();
  const target = drawing ? draftTarget() : null;
  floorToolbar.hidden = !drawing && !floorEdit && !floorEditError;
  if (floorToolbar.hidden) return;
  floorToolbar.style.top = `${planCanvas.offsetTop + 10}px`;
  const button = (id: string, icon: string, label: string, disabled = false) => `<button type="button" id="${id}" title="${label}" aria-label="${label}" ${disabled ? "disabled" : ""}><i data-lucide="${icon}"></i></button>`;
  const room = floorEdit ? findEntity(floorEdit.id) : state.selectedId ? findEntity(state.selectedId) : null;
  const count = drawing ? floorDraft?.points.length ?? 0 : room?.type === "room" ? floorPoints(room).length : 0;
  // ドラッグの描き直しでフォーカス中のボタンを取り替えない。
  const html = `<div class="floor-toolbar-row"><strong>${target ? `${target.label}の作図` : "床の輪郭"}</strong><span>${count}点</span>${target
    ? button("floorDraftUndo", "undo-2", "1点戻す（Backspace）", count === 0) + button("floorDraftRedo", "redo-2", "頂点をやり直す（Ctrl+Y）", !floorDraft?.undone.length) + button("floorDraftFinish", "check", target.closed ? `閉じて${target.label}を作る（Enter）` : `${target.label}を描き終える（Enter・ダブルクリック）`, count < target.min) + button("floorDraftCancel", "x", "作図を中止（Esc）")
    : (floorEdit ? button("floorPointDelete", "minus", "選択した頂点を削除（Delete）", count <= 3 || floorEdit.vertex === null) + button("floorEditDone", "check", "輪郭の編集を完了（Esc）") : button("floorErrorClose", "x", "閉じる"))}</div>${floorEditError ? `<div class="floor-error" role="alert">${escapeHtml(floorEditError)}</div>` : ""}`;
  if (floorToolbar.dataset.markup === html) return;
  floorToolbar.dataset.markup = html;
  floorToolbar.innerHTML = html;
  floorToolbar.querySelector("#floorDraftUndo")?.addEventListener("click", undoFloorPoint);
  floorToolbar.querySelector("#floorDraftRedo")?.addEventListener("click", redoFloorPoint);
  floorToolbar.querySelector("#floorDraftFinish")?.addEventListener("click", finishFloorDraft);
  floorToolbar.querySelector("#floorDraftCancel")?.addEventListener("click", () => {
    floorDraft = null; floorEditError = "";
    // 床の作図はツールごとやめる。ペンなどは、打った点だけを捨てて続けて描ける
    if (activeTool === "floor") { activeTool = "select"; setActiveButton("[data-tool]", activeTool); }
    syncPlanCursor(); redrawAll(false);
  });
  floorToolbar.querySelector("#floorPointDelete")?.addEventListener("click", removeFloorVertex);
  floorToolbar.querySelector("#floorEditDone")?.addEventListener("click", () => { floorEdit = null; floorEditError = ""; redrawAll(false); });
  floorToolbar.querySelector("#floorErrorClose")?.addEventListener("click", () => { floorEditError = ""; syncFloorToolbar(); });
  createIcons({ icons });
}

function updateFloorVertex(room: Room, points: [number, number][]): boolean {
  const ok = reshapeRoom(room, points);
  floorEditError = ok ? "" : "変更できません。輪郭の交差や階段の開口との重なりを確認してください";
  syncFloorToolbar();
  return ok;
}

function removeFloorVertex(): void {
  const room = floorEdit ? findEntity(floorEdit.id) : null;
  if (room?.type !== "room" || isLocked(room) || floorEdit?.vertex == null) return;
  const points = floorPoints(room);
  if (points.length <= 3) return;
  points.splice(floorEdit.vertex, 1);
  if (updateFloorVertex(room, points)) { floorEdit.vertex = Math.min(floorEdit.vertex, points.length - 1); commitState(); redrawAll(); }
}

function shapeHandles(shape: Shape): { key: string; x: number; y: number }[] {
  const angles = shape.kind === "arc" ? [shape.startAngle, shape.startAngle + normalizeAngle(shape.endAngle - shape.startAngle) / 2, shape.endAngle]
    : shape.kind === "polygon" ? polygonPoints(shape).map(p => Math.atan2(p.y - shape.y, p.x - shape.x)) : [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
  return angles.map((angle, i) => ({ key: `radius:${i}`, ...shapePoint(shape, angle) }));
}

function shapeRadiusY(shape: Shape): number { return shape.kind === "ellipse" ? shape.ry ?? shape.r : shape.r; }

function shapePoint(shape: Shape, angle: number): Point {
  return { x: shape.x + shape.r * Math.cos(angle), y: shape.y + shapeRadiusY(shape) * Math.sin(angle) };
}

function floorFromShape(shape: Shape): void {
  let points: [number, number][];
  if (shape.kind === "polygon") points = polygonPoints(shape).map(p => [p.x, p.y]);
  else {
    const closed = shape.kind !== "arc";
    const start = closed ? 0 : shape.startAngle;
    const sweep = closed ? Math.PI * 2 : normalizeAngle(shape.endAngle - start);
    const count = Math.max(4, Math.ceil(sweep / (Math.PI * 2) * 64));
    points = Array.from({ length: closed ? count : count + 1 }, (_, i) => { const p = shapePoint(shape, start + sweep * i / count); return [p.x, p.y]; });
    if (shape.kind === "arc") points.unshift([shape.x, shape.y]);
  }
  const outline = outlineFromPoints(points);
  if (!outline) return;
  const floor: Room = { id: newId("room"), type: "room", name: "", color: SURFACE_DEFS[activeRoomSurface].color, surface: activeRoomSurface, ...outline };
  activeEntities().push(floor);
  selectOnly(floor.id);
}

function rotateEntity(entity: Entity, degrees: number): void {
  if (isLocked(entity)) return;
  if (entity.type === "furniture" || entity.type === "text") {
    entity.rotation = (entity.rotation + degrees) % 360;
    return;
  }
  if (entity.type === "roof") {
    if (entity.kind === "polygon") { entity.rotation = ((entity.rotation ?? 0) + degrees) % 360; return; }
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
    // 外枠の縦横を入れ替え、自由な床の頂点も同じ90度だけ回す。
    const cx = entity.x + entity.w / 2;
    const cy = entity.y + entity.h / 2;
    const newW = entity.h;
    const newH = entity.w;
    const polygon = regularFloor(entity);
    entity.x = polygon ? cx - newW / 2 : snap(cx - newW / 2);
    entity.y = polygon ? cy - newH / 2 : snap(cy - newH / 2);
    entity.w = newW;
    entity.h = newH;
    if (entity.outline) entity.outline = entity.outline.map(([x, y]) => [1 - y, x]);
    if (entity.holes) entity.holes = entity.holes.map(ring => ring.map(([x, y]) => [1 - y, x]));
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
    if (entity.kind === "ellipse") { const ry = shapeRadiusY(entity); entity.ry = entity.r; entity.r = ry; return; }
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
  if (entity.type === "room" && origin.type === "room" && corner.startsWith("regular:")) {
    const polygon = regularFloor(origin);
    if (polygon) Object.assign(entity, regularFloorSize(origin, Math.round(Math.hypot(point.x - polygon.x, point.y - polygon.y) * 2)));
    return;
  }
  if (entity.type === "shape" && origin.type === "shape" && corner.startsWith("radius:")) {
    if (origin.kind === "ellipse") {
      if (Number(corner.slice(7)) % 2) entity.ry = Math.max(GRID, Math.round(Math.abs(point.y - origin.y)));
      else entity.r = Math.max(GRID, Math.round(Math.abs(point.x - origin.x)));
      return;
    }
    entity.r = Math.max(GRID, Math.round(Math.hypot(point.x - origin.x, point.y - origin.y)));
    return;
  }
  if (entity.type === "room" && origin.type === "room" && corner.startsWith("round:")) {
    const vertical = corner.endsWith("n") || corner.endsWith("s");
    const radius = Math.abs(vertical ? point.y - origin.y - origin.h / 2 : point.x - origin.x - origin.w / 2);
    if (Math.abs(origin.w - origin.h) >= 0.01) {
      Object.assign(entity, centeredFloorSize(origin, vertical ? origin.w : Math.max(40, radius * 2), vertical ? Math.max(40, radius * 2) : origin.h));
      return;
    }
    const scale = Math.max(40 / Math.min(origin.w, origin.h), radius * 2 / (vertical ? origin.h : origin.w));
    Object.assign(entity, centeredFloorSize(origin, origin.w * scale, origin.h * scale));
    return;
  }
  if (origin.type === "room" && entity.type === "room" && (corner.startsWith("vertex:") || corner.startsWith("edge:"))) {
    const points = floorPoints(origin), index = Number(corner.split(":")[1]);
    const next: [number, number] = [snap(point.x), snap(point.y)];
    if (corner.startsWith("edge:")) {
      if (points.length >= MAX_FLOOR_VERTICES) return;
      points.splice(index + 1, 0, next);
    } else points[index] = next;
    if (updateFloorVertex(entity, points) && floorEdit) floorEdit.vertex = corner.startsWith("edge:") ? index + 1 : index;
    return;
  }
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
    if (entity.kind === "polygon") {
      const diameter = Math.max(entity.w, entity.h);
      entity.x = corner.includes("w") ? origin.x + origin.w - diameter : origin.x;
      entity.y = corner.includes("n") ? origin.y + origin.h - diameter : origin.y;
      entity.w = diameter; entity.h = diameter;
    }
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
  syncFloorEditing();
  const { width, height } = resizePlanCanvas();
  const ratio = getCanvasPixelRatio();
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawStyledPlan(ctx, width, height, ratio, { grid: displaySettings.grid, ghost: true, editing: true });
  scheduleViewStateSave();
}

interface PlanDrawOptions {
  grid: boolean;
  ghost: boolean;
  editing: boolean;
}

// ---- 2Dの絵柄 ----

// 間取りを、いまの絵柄で target に描く。target の変換は、画面の1pxを ratio 画素にして、描き始めの所へ動かしたもの。
// paper は筆の絵柄で和紙の地と模様も描くとき（画像の書き出しでは、画像全体にまとめて描く）
function drawStyledPlan(target: CanvasRenderingContext2D, width: number, height: number, ratio: number, options: PlanDrawOptions, paper = true): void {
  const saved = ctx;
  try {
    if (isDotStyle(planStyle)) drawPixelPlan(target, width, height, options, planStyle === "retro", paper);
    else if (planStyle === "standard" && planLook() === "standard") {
      ctx = target;
      drawPlan(width, height, options);
    } else drawWrappedPlan(target, width, height, ratio, options, paper);
  } finally {
    ctx = saved;
  }
}

// 地の色・方眼・紙の模様に使う絵柄（背景を「おまかせ」にしたときは線画の絵柄）
function planLook(): PlanStyle {
  return lookStyle(planStyle, planBackground);
}

// 絵柄を付けて間取りを描き、あとで上に描く物（つまみなど）と、控えた文字を返す
function runStylePass(style: PlanStyle, raw: CanvasRenderingContext2D, layer: StylePass["layer"], draw: () => void): StylePass {
  const pass: StylePass = { style, look: planLook(), raw, overlays: [], layer, texts: [], alpha: 1 };
  const saved = { ctx, stylePass };
  stylePass = pass;
  ctx = layer(raw, true);
  try {
    draw();
  } finally {
    ctx = saved.ctx;
    stylePass = saved.stylePass;
  }
  return pass;
}

// 絵柄を付けている間は、選択のつまみ・作図中の線などを、あとで絵柄なしで上に描く
function deferOverlay(draw: () => void): boolean {
  if (!stylePass) return false;
  stylePass.overlays.push(draw);
  return true;
}

function drawOverlays(target: CanvasRenderingContext2D, pass: StylePass): void {
  if (!pass.overlays.length) return;
  const saved = ctx;
  ctx = target;
  target.save();
  target.translate(view.x, view.y);
  target.scale(view.zoom, view.zoom);
  try {
    pass.overlays.forEach((draw) => draw());
  } finally {
    target.restore();
    ctx = saved;
  }
}

// 筆・鉛筆・マンガ・設計図など: 背景の地の色を敷き、線画の絵柄の描き先で間取りを描いてから、背景の紙の模様などの仕上げを重ねる
function drawWrappedPlan(target: CanvasRenderingContext2D, width: number, height: number, ratio: number, options: PlanDrawOptions, paper: boolean): void {
  const style = planStyle;
  const look = planLook();
  const background = STYLE_LOOKS[look].background;
  if (paper && background) {
    target.save();
    target.fillStyle = background;
    target.fillRect(0, 0, width, height);
    target.restore();
  }
  // トーンや斜線を間取りに貼り付けるための、間取りの原点の画素の位置
  const origin = target.getTransform().transformPoint({ x: view.x, y: view.y });
  const wrap = (raw: CanvasRenderingContext2D) =>
    styleContext(style, raw, { unit: ratio, anchorX: origin.x, anchorY: origin.y, paper: background ?? "#ffffff" }) ?? raw;
  const pass = runStylePass(style, target, wrap, () => drawPlan(width, height, options));
  if (paper) styleFinish(look, target, width, height, view.x, view.y);
  drawOverlays(target, pass);
}

// ドット: 画面の1pxの細かさで描いてから、ドットごとに真ん中の1画素の色をとって（ぼかさずに縮めて）大きく映す。
// 細い線は描くときにドットのます目に沿わせ、文字は画面の細かさでぼかさずに描く。retro ならドットを緑の4色にする（レトロゲーム）
function drawPixelPlan(target: CanvasRenderingContext2D, width: number, height: number, options: PlanDrawOptions, retro = false, paper = true): void {
  const dot = pixelDot;
  const columns = Math.max(1, Math.ceil(width / dot)), rows = Math.max(1, Math.ceil(height / dot));
  const w = columns * dot, h = rows * dot;
  pixelSourceCanvas ??= document.createElement("canvas");
  const sourceCanvas = pixelSourceCanvas;
  if (sourceCanvas.width !== w || sourceCanvas.height !== h) {
    sourceCanvas.width = w;
    sourceCanvas.height = h;
  }
  const source = sourceCanvas.getContext("2d");
  if (!source) return;
  source.setTransform(1, 0, 0, 1, 0, 0);
  source.globalAlpha = 1;
  source.globalCompositeOperation = "source-over";
  // 背景の地の色（ドットにまとめる前に敷く）。レトロゲームの地の緑は4色にしたあとの色なので、元は白にする
  const look = planLook();
  source.fillStyle = look === "retro" ? "#ffffff" : STYLE_LOOKS[look].background ?? "#ffffff";
  source.fillRect(0, 0, w, h);
  // 間取りをドットのます目に合わせて1ドットずつ動かす（スクロールしても、ドットの形がちらつかない）
  const realView = view;
  view = { ...view, x: Math.round(view.x / dot) * dot, y: Math.round(view.y / dot) * dot };
  let pass: StylePass;
  try {
    pass = runStylePass("pixel", source, (raw, keepTexts) => createPixelContext(raw, {
      dot,
      text: keepTexts ? (text) => {
        if (!stylePass) return false;
        stylePass.texts.push({ ...text, alpha: text.alpha * stylePass.alpha });
        return true;
      } : undefined,
    }), () => drawPlan(width, height, options));
  } finally {
    view = realView;
  }
  pixelDotCanvas ??= document.createElement("canvas");
  const dots = pixelDotCanvas;
  if (dots.width !== columns || dots.height !== rows) {
    dots.width = columns;
    dots.height = rows;
  }
  const dotContext = dots.getContext("2d");
  if (!dotContext) return;
  dotContext.imageSmoothingEnabled = false;
  dotContext.clearRect(0, 0, columns, rows);
  dotContext.drawImage(sourceCanvas, 0, 0, w, h, 0, 0, columns, rows);
  let shown = dots;
  if (retro) {
    // レトロゲーム: ドットを緑の4色にする（混ぜ方の並びは間取りに合わせて動く）
    retroCanvas ??= document.createElement("canvas");
    if (retroCanvas.width !== columns || retroCanvas.height !== rows) {
      retroCanvas.width = columns;
      retroCanvas.height = rows;
    }
    const retroContext = retroCanvas.getContext("2d", { willReadFrequently: true });
    if (retroContext) {
      retroContext.clearRect(0, 0, columns, rows);
      retroContext.drawImage(dots, 0, 0);
      const image = retroContext.getImageData(0, 0, columns, rows);
      retroColors(image.data, columns, rows, Math.round(realView.x / dot), Math.round(realView.y / dot));
      retroContext.putImageData(image, 0, 0);
      shown = retroCanvas;
    }
  }
  target.save();
  target.imageSmoothingEnabled = false;
  target.drawImage(shown, 0, 0, w, h);
  target.restore();
  // 背景の紙の模様などは、ドットの上に重ねる（文字と操作用の印はその上に、くっきり描く）
  if (paper) styleFinish(look, target, width, height, realView.x, realView.y);
  pixelTextCanvas ??= document.createElement("canvas");
  drawPixelTexts(target, retro ? pass.texts.map((text) => ({ ...text, color: RETRO_INK })) : pass.texts, w, h, pixelTextCanvas);
  drawOverlays(target, pass);
}

function setupPlanStyleMenu(): void {
  const button = document.querySelector<HTMLButtonElement>("#planStyleButton");
  const menu = document.querySelector<HTMLDivElement>("#planStyleMenu");
  const dots = document.querySelector<HTMLSelectElement>("#pixelDotSelect");
  const choices = document.querySelector<HTMLDivElement>("#planStyleChoices");
  const backgrounds = document.querySelector<HTMLDivElement>("#planBackgroundChoices");
  if (!button || !menu || !dots || !choices || !backgrounds) return;
  dots.innerHTML = PIXEL_DOTS.map(({ value, label }) => `<option value="${value}">${label}</option>`).join("");
  // 絵柄ごとの見本を、分類ごとに並べる（開いたときに、その絵柄で小さな部屋を描く）
  choices.innerHTML = PLAN_STYLE_GROUPS.map((group) => `
    <div class="style-group">
      <p class="style-group-label">${escapeHtml(group)}</p>
      <div class="style-group-choices">${PLAN_STYLES.filter((style) => style.group === group).map(({ value, label, hint }) => `
        <button type="button" class="style-choice" role="radio" aria-checked="false" data-plan-style="${value}" title="${escapeHtml(`${label}（${hint}）`)}">
          <canvas class="style-thumb" aria-hidden="true"></canvas>
          <strong>${escapeHtml(label)}</strong><small>${escapeHtml(hint)}</small>
        </button>`).join("")}</div>
    </div>`).join("");
  // 背景の見本（いまの線画を、それぞれの背景で描く）
  backgrounds.innerHTML = `<div class="style-group-choices">${PLAN_BACKGROUNDS.map(({ value, label, hint }) => `
    <button type="button" class="style-choice" role="radio" aria-checked="false" data-plan-background="${value}" title="${escapeHtml(`${label}（${hint}）`)}">
      <canvas class="style-thumb" aria-hidden="true"></canvas>
      <strong>${escapeHtml(label)}</strong><small>${escapeHtml(hint)}</small>
    </button>`).join("")}</div>`;
  // 線画と背景のタブ
  const tabs = menu.querySelectorAll<HTMLButtonElement>("[data-style-tab]");
  const showTab = (tab: string) => {
    tabs.forEach((item) => {
      const active = item.dataset.styleTab === tab;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
    });
    choices.hidden = tab !== "line";
    backgrounds.hidden = tab !== "background";
    refreshStyleThumbnails(menu);
  };
  tabs.forEach((item) => item.addEventListener("click", () => showTab(item.dataset.styleTab ?? "line")));
  const close = () => {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  };
  button.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
    button.setAttribute("aria-expanded", String(!menu.hidden));
    if (menu.hidden) return;
    refreshStyleThumbnails(menu);
    // 狭い画面でも、メニューが画面の外にはみ出さないように横へずらす
    menu.style.translate = "";
    const rect = menu.getBoundingClientRect();
    const margin = 8;
    const shift = rect.left < margin ? margin - rect.left : Math.min(0, window.innerWidth - margin - rect.right);
    if (shift) menu.style.translate = `${shift}px 0`;
  });
  document.addEventListener("pointerdown", (event) => {
    if (menu.hidden || menu.contains(event.target as Node) || button.contains(event.target as Node)) return;
    close();
  });
  menu.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    close();
    button.focus();
  });
  menu.querySelectorAll<HTMLButtonElement>("[data-plan-style]").forEach((choice) => {
    choice.addEventListener("click", () => {
      const style = PLAN_STYLES.find((option) => option.value === choice.dataset.planStyle);
      if (!style) return;
      planStyle = style.value;
      syncPlanStyleMenu();
      render2d();
      scheduleViewStateSave();
      refreshStyleThumbnails(menu);
    });
  });
  menu.querySelectorAll<HTMLButtonElement>("[data-plan-background]").forEach((choice) => {
    choice.addEventListener("click", () => {
      const background = PLAN_BACKGROUNDS.find((option) => option.value === choice.dataset.planBackground);
      if (!background) return;
      planBackground = background.value;
      syncPlanStyleMenu();
      render2d();
      scheduleViewStateSave();
      refreshStyleThumbnails(menu);
    });
  });
  dots.addEventListener("change", () => {
    const value = Number(dots.value);
    if (!PIXEL_DOTS.some((option) => option.value === value)) return;
    pixelDot = value;
    render2d();
    scheduleViewStateSave();
  });
  syncPlanStyleMenu();
}

// 絵柄の見本に描く、小さな部屋（ベッド・テーブル・植物・ラグ・ドア・窓）
let styleSample: PlanState | null = null;

function styleSamplePlan(): PlanState {
  styleSample ??= {
    floors: [makeFloor("1F", [
      room("", 0, 0, 300, 200, "#f3efe6"),
      wall(0, 0, 300, 0), wall(300, 0, 300, 200), wall(300, 200, 0, 200), wall(0, 200, 0, 0),
      door(190, 200, 260, 200),
      windowLine(70, 0, 210, 0),
      { ...furniture("rug", 95, 110, 110, 64), color: "#b0413e" },
      furniture("bed", 14, 14, 72, 140),
      furniture("diningTable", 186, 26, 96, 96),
      furniture("plant", 255, 150, 32, 32),
    ])],
    activeFloor: 0,
    selectedId: null,
    roofs: [],
  };
  return styleSample;
}

// 開いているタブの見本を描き直す。線画の見本はいまの背景で、背景の見本はいまの線画で描く（同じ組み合わせなら描き直さない）
function refreshStyleThumbnails(menu: HTMLElement): void {
  const items: { canvas: HTMLCanvasElement; style: PlanStyle; background: PlanBackground }[] = [];
  const add = (canvas: HTMLCanvasElement | null, style: PlanStyle, background: PlanBackground) => {
    const key = `${style}|${background}`;
    if (!canvas || canvas.dataset.drawn === key) return;
    canvas.dataset.drawn = key;
    items.push({ canvas, style, background });
  };
  const lines = menu.querySelector<HTMLElement>("#planStyleChoices");
  if (lines && !lines.hidden) {
    lines.querySelectorAll<HTMLButtonElement>("[data-plan-style]").forEach((choice) => {
      const style = PLAN_STYLES.find((option) => option.value === choice.dataset.planStyle);
      if (style) add(choice.querySelector("canvas"), style.value, planBackground);
    });
  }
  const backgrounds = menu.querySelector<HTMLElement>("#planBackgroundChoices");
  if (backgrounds && !backgrounds.hidden) {
    backgrounds.querySelectorAll<HTMLButtonElement>("[data-plan-background]").forEach((choice) => {
      const background = PLAN_BACKGROUNDS.find((option) => option.value === choice.dataset.planBackground);
      if (background) add(choice.querySelector("canvas"), planStyle, background.value);
    });
  }
  drawStyleThumbnails(items);
}

// メニューの見本を、それぞれの線画と背景で描く。描いている間だけ、間取り・見ている所・絵柄を見本の物に差し替える
function drawStyleThumbnails(items: { canvas: HTMLCanvasElement; style: PlanStyle; background: PlanBackground }[]): void {
  if (!items.length) return;
  const saved = { state, view: { ...view }, planStyle, planBackground, ctx, hideRoomNames, showDimensions, area: displaySettings.area };
  const ratio = 2;
  try {
    state = styleSamplePlan();
    hideRoomNames = true;
    showDimensions = false;
    displaySettings.area = "none";
    for (const { canvas, style, background } of items) {
      const target = canvas.getContext("2d");
      if (!target) continue;
      const w = 96, h = 62;
      canvas.width = w * ratio;
      canvas.height = h * ratio;
      const zoom = Math.min(w / 330, h / 230);
      view = { zoom, x: (w - 300 * zoom) / 2, y: (h - 200 * zoom) / 2 };
      planStyle = style;
      planBackground = background;
      target.setTransform(ratio, 0, 0, ratio, 0, 0);
      target.fillStyle = "#ffffff";
      target.fillRect(0, 0, w, h);
      drawStyledPlan(target, w, h, ratio, { grid: true, ghost: false, editing: false });
    }
  } finally {
    state = saved.state;
    view = saved.view;
    planStyle = saved.planStyle;
    planBackground = saved.planBackground;
    ctx = saved.ctx;
    hideRoomNames = saved.hideRoomNames;
    showDimensions = saved.showDimensions;
    displaySettings.area = saved.area;
  }
}

function syncPlanStyleMenu(): void {
  const style = PLAN_STYLES.find((option) => option.value === planStyle) ?? PLAN_STYLES[0];
  const background = PLAN_BACKGROUNDS.find((option) => option.value === planBackground) ?? PLAN_BACKGROUNDS[0];
  const plain = planStyle === "standard" && planBackground === "auto";
  const button = document.querySelector<HTMLButtonElement>("#planStyleButton");
  const label = document.querySelector<HTMLSpanElement>("#planStyleLabel");
  // 背景を線画と別に選んだときは「線画・背景」と出す
  if (label) label.textContent = plain ? "絵柄" : planBackground === "auto" ? style.label : `${style.label}・${background.label}`;
  button?.classList.toggle("is-active", !plain);
  document.querySelectorAll<HTMLButtonElement>("[data-plan-style]").forEach((choice) => {
    choice.setAttribute("aria-checked", String(choice.dataset.planStyle === planStyle));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-plan-background]").forEach((choice) => {
    choice.setAttribute("aria-checked", String(choice.dataset.planBackground === planBackground));
  });
  const dots = document.querySelector<HTMLSelectElement>("#pixelDotSelect");
  if (dots) dots.value = String(pixelDot);
  const dotRow = document.querySelector<HTMLLabelElement>("#pixelDotRow");
  if (dotRow) dotRow.hidden = !isDotStyle(planStyle);
}

// 間取りを描く。editing は画面だけの物（屋根の破線・固定の印・作図中の線）も描くとき
function drawPlan(width: number, height: number, options: PlanDrawOptions): void {
  ctx.save();
  ctx.translate(view.x, view.y);
  ctx.scale(view.zoom, view.zoom);

  if (options.grid) drawGrid(width, height);

  const entities = activeEntities();
  drawLayer(entities.filter(isRoom), drawRoom);
  // 方眼の大きさを決めたとき（コマを置くマス目）は、いつも部屋の上にもはっきり重ねる
  if (options.grid && displaySettings.gridSize > 0) drawGrid(width, height, true);
  else if (options.grid && view.zoom > GRID_OVER_ROOMS_ZOOM) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    drawGrid(width, height);
    ctx.restore();
  }
  // 現在の階の部屋の塗りの上・線画の下に、ほかの階のゴーストを挟む
  if (options.ghost) drawFloorBelowGhost();
  drawLayer(incomingStairs(state.floors, state.activeFloor), (item) => drawFurniture2d(item, true));
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
    if (selectedEntities().length > 1) drawMultiSelection();
    const selectedFloor = activeEntities().find(entity => entity.id === state.selectedId);
    if (selectedFloor?.type === "room" && !isLocked(selectedFloor)) drawResizeHandles(selectedFloor);
    if (selectedFloor?.type === "shape" && !isLocked(selectedFloor)) drawShapeHandle(selectedFloor);
    if (isPointDrafting() && floorDraft) drawFloorDraft();
    drawMarquee();
    entities.filter(isLocked).forEach(drawLockedIndicator);
    if (roofsOn2d()) state.roofs.filter(isLocked).forEach(drawLockedIndicator);
    if (drag.dragMode === "path" && drag.path && isBrushing()) drawBrushPreview(drag.path);
    else if (drag.dragMode === "path" && drag.path) {
      if (activeTool === "paint") {
        const kind = penSettings.kind;
        if (kind === "paint") drawPaintPreview(drag.path);
        else drawFreeShapePreview(kind, drag.path);
      }
      else if (activeFurniture === "brokenGlass") drawShardPreview(drag.path);
      else if (isFreeShapeKind(activeFurniture)) drawFreeShapePreview(activeFurniture, drag.path);
      else drawFootprintPreview(drag.path);
    }
    // ペン先の丸は、描いている線の上に重ねる
    if (activeTool === "paint" || isBrushing()) {
      const tip = penCursor ?? (penSizePreview ? planCenter() : null);
      if (tip) drawPenCursor(tip);
    }
    if (drag.dragMode === "draw" && activeTool !== "furniture") {
      drawPreview(drag.startWorld, drag.currentWorld);
    }
  }

  ctx.restore();
}

// 方眼の間隔。20cmを基準に、画面上で狭すぎれば5倍ずつ広げ、広すぎれば1/5ずつ細かくする
function gridStep(): number {
  // 方眼の大きさを決めたときは、その大きさ（引いて細かすぎるときだけ5つずつまとめる。書き出しではまとめない）
  if (displaySettings.gridSize > 0) {
    let step = displaySettings.gridSize;
    while (!exactGrid && step * view.zoom < MIN_GRID_PIXELS) step *= 5;
    return step;
  }
  let step = GRID;
  while (step * view.zoom < MIN_GRID_PIXELS) step *= 5;
  while ((step / 5) * view.zoom >= MIN_GRID_PIXELS) step /= 5;
  return step;
}

// 部屋の上に重ねる方眼の色（地が暗い絵柄では明るい線）
function overGridColors(): [string, string] {
  const background = STYLE_LOOKS[planLook()].background;
  const parsed = background ? parseColorCode(background) : null;
  const dark = parsed ? (() => { const n = Number.parseInt(parsed.rgb.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 128; })() : false;
  return dark ? ["rgba(255, 255, 255, 0.22)", "rgba(255, 255, 255, 0.4)"] : ["rgba(30, 40, 55, 0.2)", "rgba(30, 40, 55, 0.36)"];
}

function drawGrid(canvasWidth: number, canvasHeight: number, over = false): void {
  const left = -view.x / view.zoom;
  const top = -view.y / view.zoom;
  const right = left + canvasWidth / view.zoom;
  const bottom = top + canvasHeight / view.zoom;
  const step = gridStep();
  // 5本ごとの太い線は、線の番号で見分ける（小数の間隔でも割り算の誤差が出ない）
  const firstX = Math.floor(left / step), lastX = Math.ceil(right / step);
  const firstY = Math.floor(top / step), lastY = Math.ceil(bottom / step);
  // 絵柄を付けて描いている間も、方眼は絵柄を付けずにまっすぐ引く（色は絵柄ごと。筆では和紙に刷ったような茶色、設計図では白っぽい線など）。
  // ドットでは線をドットのます目に合わせた1ドットの線（ドットにまとめたときに、とぎれとぎれにならないように）
  const g = stylePass?.raw ?? ctx;
  const dot = stylePass?.style === "pixel" ? pixelDot : 0;
  const [minor, major] = over ? overGridColors() : STYLE_LOOKS[stylePass?.look ?? "standard"].grid;
  const snap = (value: number, offset: number) => (dot ? (Math.floor((value * view.zoom + offset) / dot) * dot + dot / 2 - offset) / view.zoom : value);

  g.lineWidth = (dot || 1) / view.zoom;
  for (let i = firstX; i <= lastX; i += 1) {
    const x = snap(i * step, view.x);
    g.beginPath();
    g.strokeStyle = i % 5 === 0 ? major : minor;
    g.moveTo(x, top);
    g.lineTo(x, bottom);
    g.stroke();
  }
  for (let i = firstY; i <= lastY; i += 1) {
    const y = snap(i * step, view.y);
    g.beginPath();
    g.strokeStyle = i % 5 === 0 ? major : minor;
    g.moveTo(left, y);
    g.lineTo(right, y);
    g.stroke();
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
  const host = ctx.canvas;
  if (target.width !== host.width || target.height !== host.height) {
    target.width = host.width;
    target.height = host.height;
  }
  const ghostContext = target.getContext("2d");
  if (!ghostContext) return;
  const planContext = ctx;
  const transform = planContext.getTransform();
  // 絵柄を付けているときは、透かす階にも同じ絵柄を付ける（文字もその場で描く）
  ctx = stylePass ? stylePass.layer(ghostContext, false) : ghostContext;
  try {
    ghostContext.setTransform(1, 0, 0, 1, 0, 0);
    ghostContext.clearRect(0, 0, target.width, target.height);
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
      ghostContext.setTransform(1, 0, 0, 1, 0, 0);
      ghostContext.globalCompositeOperation = "source-in";
      ghostContext.fillStyle = tint.rgb;
      ghostContext.fillRect(0, 0, target.width, target.height);
      ghostContext.globalCompositeOperation = "source-over";
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
    drawTranslucent(colorAlpha(code), () => group.forEach((item) => draw(item)));
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
  // 絵柄を付けているときは同じ絵柄で描く。ドットの絵柄で控える文字には、この透明度も付ける
  const pass = stylePass;
  const outerAlpha = pass?.alpha ?? 1;
  ctx = pass ? pass.layer(layer, true) : layer;
  if (pass) pass.alpha = outerAlpha * alpha;
  try {
    layer.setTransform(1, 0, 0, 1, 0, 0);
    layer.clearRect(0, 0, target.width, target.height);
    ctx.setTransform(transform);
    draw();
  } finally {
    ctx = base;
    if (pass) pass.alpha = outerAlpha;
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha *= alpha;
  ctx.drawImage(target, 0, 0);
  ctx.restore();
}

// 選んでいる要素の枠やつまみ（大きさや端を動かす所）
function drawMultiSelection(): void {
  if (deferOverlay(drawMultiSelection)) return;
  ctx.save();
  ctx.strokeStyle = "#2377db";
  ctx.lineWidth = 2 / view.zoom;
  ctx.setLineDash([6 / view.zoom, 4 / view.zoom]);
  for (const item of selectedEntities()) {
    const bounds = getEntitiesBounds([item]);
    if (!bounds) continue;
    ctx.save();
    ctx.translate(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);
    if (item.type === "furniture" || item.type === "text") ctx.rotate(degreesToRadians(item.rotation));
    const padding = 4 / view.zoom;
    ctx.strokeRect(-bounds.w / 2 - padding, -bounds.h / 2 - padding, bounds.w + padding * 2, bounds.h + padding * 2);
    ctx.restore();
  }
  ctx.restore();
}

function drawSelectionMarks(entity: Entity): void {
  if (selectedEntities().length > 1) return;
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

// 2Dの屋根の中に引く線（棟・隅棟・円すいの筋・陸屋根の内側の線）。クリックで屋根を選ぶ当たり判定にも使う
function roofLines2d(roofItem: Roof): [Point, Point][] {
  const { x, y, w, h } = roofItem;
  const cx = x + w / 2, cy = y + h / 2, inset = Math.min(w, h) / 2;
  const line = (x1: number, y1: number, x2: number, y2: number): [Point, Point] => [{ x: x1, y: y1 }, { x: x2, y: y2 }];
  if (roofItem.kind === "dome") return [];
  if (isRadialRoof(roofItem.kind)) {
    return roofOutline(roofItem).filter((_, i) => roofItem.kind === "polygon" || i % 8 === 0).map(([px, py]) => line(cx, cy, px, py));
  }
  if (roofItem.kind === "flat") {
    const e = Math.min(16 / view.zoom, w / 4, h / 4);
    return [line(x + e, y + e, x + w - e, y + e), line(x + w - e, y + e, x + w - e, y + h - e), line(x + w - e, y + h - e, x + e, y + h - e), line(x + e, y + h - e, x + e, y + e)];
  }
  const gable = roofItem.kind === "gable";
  if (w >= h) {
    const start = gable ? x : x + inset, end = gable ? x + w : x + w - inset;
    return [line(start, cy, end, cy), ...(gable ? [] : [line(x, y, start, cy), line(start, cy, x, y + h), line(x + w, y, end, cy), line(end, cy, x + w, y + h)])];
  }
  const start = gable ? y : y + inset, end = gable ? y + h : y + h - inset;
  return [line(cx, start, cx, end), ...(gable ? [] : [line(x, y, cx, start), line(cx, start, x + w, y), line(x, y + h, cx, end), line(cx, end, x + w, y + h)])];
}

function drawRoof2d(roofItem: Roof): void {
  if (deferOverlay(() => drawRoof2d(roofItem))) return;
  const selected = state.selectedId === roofItem.id;
  const cx = roofItem.x + roofItem.w / 2;
  const cy = roofItem.y + roofItem.h / 2;

  ctx.save();
  // 色を決めた屋根は、その色でうすく塗り、少し濃くした色で縁を描く（透明度があれば、そのぶん薄く）
  const tint = roofItem.color ? solidColor(roofItem.color) : null;
  ctx.fillStyle = selected ? "rgba(39, 117, 209, 0.12)" : tint ? withAlpha(tint, 0.16 * colorAlpha(roofItem.color)) : "rgba(93, 103, 115, 0.06)";
  ctx.strokeStyle = selected ? "#2775d1" : tint ? withAlpha(darkenColor(tint, 0.2), Math.max(0.35, colorAlpha(roofItem.color))) : "#657180";
  ctx.lineWidth = (selected ? 2.2 : 1.4) / view.zoom;
  ctx.setLineDash(selected ? [] : [7 / view.zoom, 5 / view.zoom]);
  const outline = roofOutline(roofItem);
  ctx.beginPath();
  outline.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  if (roofItem.kind === "dome") {
    for (const scale of [0.45, 0.8]) { ctx.moveTo(cx + roofItem.w / 2 * scale, cy); ctx.ellipse(cx, cy, roofItem.w / 2 * scale, roofItem.h / 2 * scale, 0, 0, Math.PI * 2); }
  }
  roofLines2d(roofItem).forEach(([from, to]) => { ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); });
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

function traceRoom(room: Room): void {
  ctx.beginPath();
  for (const points of floorPolygon(room)) {
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
  }
}

function drawRoom(room: Room): void {
  const selected = state.selectedId === room.id;
  const surface = room.surface ?? "plain";
  // 透明度は部屋ごとではなく、同じ色の部屋をまとめて重ねるときに付ける（drawLayer）
  const fill = solidColor(room.color);
  const pattern = surface !== "plain" ? ctx.createPattern(surfaceCanvas(surface, fill), "repeat") : null;
  pattern?.setTransform(new DOMMatrix().translate(room.x, room.y).scale(surfaceTileCm(surface) / 256));
  ctx.fillStyle = pattern ?? fill;
  ctx.strokeStyle = selected ? "#2775d1" : "#c3c9d2";
  ctx.lineWidth = selected ? 2.4 / view.zoom : 1.1 / view.zoom;
  traceRoom(room);
  ctx.fill("evenodd");
  if (selected) {
    ctx.fillStyle = "rgba(39,117,209,0.08)";
    ctx.fill("evenodd");
  }
  ctx.stroke();

  const label = getRoomLabelPosition(room);
  ctx.fillStyle = INK;
  const size = room.labelSize ?? Math.max(12, 13 / view.zoom);
  const layout = measureLabel(room.name, size, room.writingMode);
  ctx.font = `${size}px ${TEXT_FONT}`;
  const named = room.name.trim() !== "" && !hideRoomNames;
  if (named) paintLabel(layout, label.x, label.y);
  // 寸法と広さ（名前がないときは、名前の位置へ詰める）
  const details = roomDetailLines(room);
  if (details.length) {
    const size = Math.max(10, 11 / view.zoom);
    ctx.fillStyle = INK_SOFT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `${size}px "Yu Gothic UI", sans-serif`;
    details.forEach((text, i) => ctx.fillText(text, label.x, label.y + (named ? layout.h + 4 : 0) + i * (size + 3)));
  }
  if (selected) drawRoomLabelGuide(room);
  if (selected && !isLocked(room)) drawResizeHandles(room);
}

function drawRoomLabelGuide(room: Room): void {
  if (selectedEntities().length > 1) return;
  if (deferOverlay(() => drawRoomLabelGuide(room))) return;
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
  drawWallBody2d(wallItem);
  if (state.selectedId === wallItem.id && !isLocked(wallItem)) drawLineHandles(wallItem);
}

// 壁の帯。種類のある壁は、3Dを真上から見た形（厚み・色・目地・瓦の笠）。石垣・生け垣・竹垣・フェンスは、その自由な形を壁の線に沿わせる
function drawWallBody2d(wallItem: LinearElement): void {
  const info = wallInfoOf(wallItem);
  if (info.value === "plain") {
    drawLineElement(wallItem, solidColor(wallItem.color) ?? INK, info.thickness);
    return;
  }
  const length = distance(wallItem);
  if (length <= 0) return;
  const selected = state.selectedId === wallItem.id;
  const width = wallTopWidth(info);
  ctx.save();
  if (selected) {
    ctx.lineCap = "square";
    ctx.lineWidth = width + 6 / view.zoom;
    ctx.strokeStyle = "rgba(39, 117, 209, 0.35)";
    strokeLine(wallItem.x1, wallItem.y1, wallItem.x2, wallItem.y2);
  }
  if (info.freeKind) {
    const item = freeWallItem(wallItem, info, 0, length);
    ctx.translate(item.x + item.w / 2, item.y + item.h / 2);
    ctx.lineWidth = 1.4 / view.zoom;
    ctx.strokeStyle = solidColor(item.color) ?? INK;
    ctx.fillStyle = furnitureFill(item);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    drawFreeShape2d(info.freeKind, item.w, item.h, item);
    ctx.restore();
    return;
  }
  // 端は2Dの壁と同じく、幅の半分だけ伸ばす（3Dも同じだけ伸ばす）
  ctx.translate(wallItem.x1, wallItem.y1);
  ctx.rotate(lineAngle(wallItem));
  const fill = info.cap ? CAP_COLOR : solidColor(wallItem.color) ?? info.color;
  ctx.fillStyle = info.glass ? withAlpha(fill, 0.45) : fill;
  ctx.fillRect(-width / 2, -width / 2, length + width, width);
  ctx.lineWidth = 1.2 / view.zoom;
  // ガラスは、窓と同じく水色の細い線
  ctx.strokeStyle = info.glass ? "#5f93ad" : INK;
  ctx.strokeRect(-width / 2, -width / 2, length + width, width);
  // 目地・板の継ぎ目（真上から見た線）
  ctx.lineWidth = 0.9 / view.zoom;
  ctx.strokeStyle = "rgba(30, 30, 30, 0.55)";
  for (const d of wallJoints(info, length)) strokeLine(d, -width / 2, d, width / 2);
  // 瓦の笠の棟、ガラスの2本線
  if (info.cap) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    strokeLine(-width / 2, 0, length + width / 2, 0);
  }
  if (info.glass) {
    ctx.strokeStyle = "#5f93ad";
    strokeLine(-width / 2, -width / 4, length + width / 2, -width / 4);
    strokeLine(-width / 2, width / 4, length + width / 2, width / 4);
  }
  ctx.restore();
}

// 壁の種類の決まりに、その壁で変えた厚みを重ねた物（2D・3D・当たり判定で使う）
function wallInfoOf(wallItem: LinearElement): WallStyleInfo {
  return wallStyleWithThickness(wallStyleInfo(wallItem.wallStyle), wallItem.thickness);
}

// 自由な形で作る壁（石垣など）の、壁の from〜to cm の部分を、自由な形の家具と同じデータにする（2Dも3Dもこれで作る）。
// 厚みを変えた石垣・生け垣は、その厚みを自由な形の幅にする
function freeWallItem(wallItem: LinearElement, info: WallStyleInfo, from: number, to: number): Furniture {
  const length = distance(wallItem) || 1;
  const at = (d: number): Point2 => [wallItem.x1 + ((wallItem.x2 - wallItem.x1) * d) / length, wallItem.y1 + ((wallItem.y2 - wallItem.y1) * d) / length];
  const kind = info.freeKind!;
  const brush = isFreeWidthAdjustable(kind) && wallItem.thickness !== undefined ? info.thickness : undefined;
  const frame = freeFrame([at(from), at(to)], freeMargin(kind, brush));
  return {
    id: wallItem.id, type: "furniture", kind, x: frame.x, y: frame.y, w: frame.w, h: frame.h, rotation: 0, path: frame.path,
    ...(brush !== undefined ? { brush } : {}),
    ...(wallItem.color ? { color: wallItem.color } : {}), ...(wallItem.color3d ? { color3d: wallItem.color3d } : {}),
  };
}

// 壁の種類の見本の絵（一覧と選択中の欄）。2Dの壁と同じ描き方で、短い壁を描く
const wallSwatchUrls = new Map<WallStyle, string>();
function wallStyleSwatchUrl(style: WallStyle): string {
  const cached = wallSwatchUrls.get(style);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 120;
  canvas.height = 48;
  const target = canvas.getContext("2d")!;
  target.fillStyle = "#ffffff";
  target.fillRect(0, 0, canvas.width, canvas.height);
  const saved = ctx, zoom = view.zoom, selected = state.selectedId;
  try {
    ctx = target;
    view.zoom = 0.4;
    state.selectedId = null;
    target.setTransform(0.4, 0, 0, 0.4, 0, 0);
    drawWallBody2d({ id: "swatch", type: "wall", x1: 50, y1: 60, x2: 250, y2: 60, ...(style !== "plain" ? { wallStyle: style } : {}) });
  } finally {
    ctx = saved;
    view.zoom = zoom;
    state.selectedId = selected;
  }
  const url = canvas.toDataURL();
  wallSwatchUrls.set(style, url);
  return url;
}

// 壁の厚み（cm）。変えられない種類（フェンス・竹垣）は出さない
function wallThicknessHtml(wall: LinearElement, disabled: string): string {
  const info = wallInfoOf(wall);
  if (!isWallThicknessAdjustable(info)) return "";
  return `<label>厚み cm
      <span class="pen-width">
        <input id="wallThicknessRange" type="range" min="${WALL_THICKNESS_RANGE.min}" max="100" step="1" value="${Math.min(100, info.thickness)}" aria-label="厚み" ${disabled} />
        <input id="wallThicknessInput" type="number" min="${WALL_THICKNESS_RANGE.min}" max="${WALL_THICKNESS_RANGE.max}" step="1" value="${info.thickness}" ${disabled} />
      </span>
    </label>`;
}

// 厚みを変える。スライダーを動かしている間は2Dと3Dだけ描き直し、離したときに履歴に積む
function bindWallThickness(wall: LinearElement): void {
  const range = propertiesPanel.querySelector<HTMLInputElement>("#wallThicknessRange"), number = propertiesPanel.querySelector<HTMLInputElement>("#wallThicknessInput");
  const set = (value: number) => {
    if (!Number.isFinite(value) || isLocked(wall)) return;
    const thickness = clamp(Math.round(value), WALL_THICKNESS_RANGE.min, WALL_THICKNESS_RANGE.max);
    if (thickness === wallStyleInfo(wall.wallStyle).thickness) delete wall.thickness;
    else wall.thickness = thickness;
  };
  range?.addEventListener("input", () => {
    set(Number(range.value));
    if (number) number.value = String(wallInfoOf(wall).thickness);
    render2d();
    scheduleThreeRefresh();
  });
  range?.addEventListener("change", () => {
    commitState();
    redrawAll();
  });
  number?.addEventListener("change", () => {
    set(Number(number.value));
    commitState();
    redrawAll();
  });
}

// 壁の種類を絵で選ぶ欄
function wallStylePickerHtml(id: string, current: WallStyle, disabled = ""): string {
  return `<label>壁の種類</label>
    <div class="wall-style-picker" id="${id}" role="radiogroup" aria-label="壁の種類">${WALL_STYLES.map((style) => {
      const active = style.value === current;
      return `<button type="button" role="radio" data-wall-style-choice="${style.value}" class="${active ? "is-active" : ""}" aria-checked="${active}" ${disabled}><img src="${wallStyleSwatchUrl(style.value)}" alt="" /><span>${escapeHtml(style.label)}</span></button>`;
    }).join("")}</div>`;
}

function bindWallStylePicker(selector: string, choose: (style: WallStyle) => void): void {
  propertiesPanel.querySelectorAll<HTMLButtonElement>(`${selector} [data-wall-style-choice]`).forEach((button) => button.addEventListener("click", () => {
    const value = button.dataset.wallStyleChoice;
    if (isWallStyle(value)) choose(value);
  }));
}

function drawLineHandles(entity: LinearElement): void {
  if (selectedEntities().length > 1) return;
  if (deferOverlay(() => drawLineHandles(entity))) return;
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
  if (door.doorStyle === "double" || door.doorStyle === "gate") {
    drawDoubleDoor2d(door, door.doorStyle);
    return;
  }
  if (door.doorStyle) {
    drawJapaneseSlidingDoor2d(door, door.doorStyle);
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

// 両開きドア・門扉: 両端のつりもとから、半分ずつの扉が同じ側へ開く（開いた扉と、開く道すじの円弧）。
// 門扉の扉は、縦の板を並べた細い四角で描く（板の数と位置は3Dと同じ）
function drawDoubleDoor2d(door: LinearElement, style: "double" | "gate"): void {
  const selected = state.selectedId === door.id;
  const length = Math.max(distance(door), GRID);
  const a = Math.atan2(door.y2 - door.y1, door.x2 - door.x1);
  const side = door.flip ? 1 : -1;
  const open = a + (side * Math.PI) / 2;
  ctx.save();
  ctx.lineCap = "butt";
  ctx.strokeStyle = selected ? "#2775d1" : solidColor(door.color) ?? INK;
  for (const leaf of doubleLeaves()) {
    const hinge = leaf.hinge < 0 ? { x: door.x1, y: door.y1 } : { x: door.x2, y: door.y2 };
    const closed = leaf.hinge < 0 ? a : a + Math.PI;
    const leafLength = length * leaf.width;
    const tip = { x: hinge.x + Math.cos(open) * leafLength, y: hinge.y + Math.sin(open) * leafLength };
    if (style === "gate") {
      // 開いた扉を、厚み4cmの細い四角と、縦の板の継ぎ目で描く
      const nx = Math.cos(closed) * 2, ny = Math.sin(closed) * 2;
      ctx.fillStyle = "#ffffff";
      ctx.lineWidth = (selected ? 2.2 : 1.2) / view.zoom;
      ctx.beginPath();
      ctx.moveTo(hinge.x - nx, hinge.y - ny);
      ctx.lineTo(tip.x - nx, tip.y - ny);
      ctx.lineTo(tip.x + nx, tip.y + ny);
      ctx.lineTo(hinge.x + nx, hinge.y + ny);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      const slats = gateSlats(leafLength);
      for (let i = 1; i < slats.positions.length; i += 1) {
        const t = (slats.positions[i - 1] + slats.positions[i]) / 2 + 0.5;
        const px = hinge.x + Math.cos(open) * leafLength * t, py = hinge.y + Math.sin(open) * leafLength * t;
        ctx.moveTo(px - nx, py - ny);
        ctx.lineTo(px + nx, py + ny);
      }
      ctx.stroke();
    } else {
      ctx.lineWidth = (selected ? 3 : 1.8) / view.zoom;
      ctx.beginPath();
      ctx.moveTo(hinge.x, hinge.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
    }
    // 開く道すじ（閉じた向きから開いた向きまでの4分の1の円）
    const [from, to] = leaf.hinge < 0 ? (side > 0 ? [closed, open] : [open, closed]) : side > 0 ? [open, closed] : [closed, open];
    ctx.lineWidth = (selected ? 2 : 1.2) / view.zoom;
    ctx.beginPath();
    ctx.arc(hinge.x, hinge.y, leafLength, from, to, false);
    ctx.stroke();
  }
  ctx.restore();
  if (selected && !isLocked(door)) drawLineHandles(door);
}

// 障子・襖・格子戸・板戸: 敷居の上に並ぶ戸を、真上から見た形で描く（板の並び・桟の位置は3Dと同じ）
const SLIDING_PANEL_FILLS: Partial<Record<DoorStyle, string>> = { shoji: "#ffffff", fusuma: "#d9ceb7", koshi: "#f3eee5", itado: "#c4ad8d" };

function drawJapaneseSlidingDoor2d(door: LinearElement, style: DoorStyle): void {
  const selected = state.selectedId === door.id;
  const length = Math.max(distance(door), GRID);
  const mid = midpoint(door);
  const depth = WALL_THICKNESS_2D;
  const flip = door.flip ? -1 : 1;
  const stroke = selected ? "#2775d1" : solidColor(door.color) ?? INK;
  // 柱の間（3Dと同じく、両端の柱の分を除いた幅に戸を並べる）
  const clear = length - Math.min(length * 0.09, 4.5);
  // 戸の厚みは3Dと同じ。ただし2Dで見分けられるよう、3.2cmより薄くはしない
  const thickness = Math.max(panelThickness(style), 3.2);
  const offset = trackOffset(style);
  ctx.save();
  ctx.translate(mid.x, mid.y);
  ctx.rotate(lineAngle(door));
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-length / 2, -depth / 2, length, depth);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = (selected ? 2.2 : 1.2) / view.zoom;
  ctx.strokeRect(-length / 2, -depth / 2, length, depth);
  ctx.lineWidth = (selected ? 1.6 : 1) / view.zoom;
  for (const panel of slidingPanels(style, length)) {
    const pw = panel.width * clear, x = panel.center * clear, y = panel.track * flip * offset;
    ctx.fillStyle = SLIDING_PANEL_FILLS[style] ?? "#ffffff";
    ctx.fillRect(x - pw / 2, y - thickness / 2, pw, thickness);
    ctx.strokeRect(x - pw / 2, y - thickness / 2, pw, thickness);
    // 縦の桟（障子の組子・格子戸の格子）は、戸の厚みを横切る短い線に見える
    ctx.beginPath();
    for (const bar of panelBars(style, pw)) {
      ctx.moveTo(x + bar * pw, y - thickness / 2);
      ctx.lineTo(x + bar * pw, y + thickness / 2);
    }
    ctx.stroke();
    // 襖の黒い縁は、両端を塗りつぶす
    if (style === "fusuma") {
      ctx.fillStyle = stroke;
      const rim = Math.min(2, pw * 0.05);
      for (const s2 of [-1, 1]) ctx.fillRect(x + s2 * (pw / 2) - (s2 > 0 ? rim : 0), y - thickness / 2, rim, thickness);
    }
  }
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

function drawFurniture2d(furnitureItem: Furniture, fromAbove = false): void {
  const selected = !fromAbove && state.selectedId === furnitureItem.id;
  ctx.save();
  ctx.translate(furnitureItem.x + furnitureItem.w / 2, furnitureItem.y + furnitureItem.h / 2);
  ctx.rotate((furnitureItem.rotation * Math.PI) / 180);
  if (furnitureItem.flip) ctx.scale(-1, 1);
  ctx.lineWidth = 1.4 / view.zoom;
  ctx.strokeStyle = solidColor(furnitureItem.color) ?? INK;
  ctx.fillStyle = furnitureFill(furnitureItem);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  drawFurnitureSymbol(furnitureItem.kind, furnitureItem.w, furnitureItem.h, furnitureItem.symbol ?? 0, furnitureItem, fromAbove);
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

// ---- 取り込んだ画像 ----
// 画像は data URL のまま間取りに入れる（自動保存・書き出しのファイルにも入る）。大きすぎる画像は、取り込むときに縮める
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,/;
const MAX_IMAGE_DATA = 12_000_000;
const IMAGE_MAX_SIDE = 1600;
const imageElements = new Map<string, HTMLImageElement>();

// 読み込み済みの画像（まだなら読み込みを始め、読めたら2Dと3Dを描き直す）
function loadedImage(src: string): HTMLImageElement | null {
  let image = imageElements.get(src);
  if (!image) {
    image = new Image();
    image.addEventListener("load", () => {
      render2d();
      threeSceneKey = null;
      scheduleThreeRefresh();
    });
    image.src = src;
    imageElements.set(src, image);
  }
  return image.complete && image.naturalWidth > 0 ? image : null;
}

// 2D: 範囲いっぱいに画像を描く。読めていない間は、山と太陽の絵の入った四角
function drawImageItem(w: number, h: number, item?: Furniture): void {
  const image = item?.image ? loadedImage(item.image) : null;
  ctx.save();
  ctx.globalAlpha *= item?.opacity ?? 1;
  if (image) ctx.drawImage(image, -w / 2, -h / 2, w, h);
  else {
    ctx.fillStyle = "#eef1f5";
    strokeRoundedRect(-w / 2, -h / 2, w, h, 2, true);
    const s = Math.min(w, h) * 0.3;
    ctx.beginPath();
    ctx.moveTo(-s, s * 0.6);
    ctx.lineTo(-s * 0.3, -s * 0.2);
    ctx.lineTo(s * 0.1, s * 0.25);
    ctx.lineTo(s * 0.45, -s * 0.05);
    ctx.lineTo(s, s * 0.6);
    ctx.stroke();
    strokeCircle(s * 0.45, -s * 0.5, s * 0.15);
  }
  ctx.restore();
}

// 3D: 床に貼った板に、2Dと同じ画像を貼る（反転は家具と同じく、置くときに鏡に映す）
function applyImageTexture(group: THREE.Group, item: Furniture): void {
  const image = item.image ? loadedImage(item.image) : null;
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as THREE.MeshStandardMaterial;
    if (material.name !== "image-decal") return;
    if (image) {
      const texture = new THREE.Texture(image);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      texture.needsUpdate = true;
      material.map = texture;
    } else material.color.set(0xdfe4ea);
    material.opacity = item.opacity ?? 1;
    material.depthWrite = (item.opacity ?? 1) >= 1;
    material.needsUpdate = true;
  });
}

// 画像のファイルを読み、縮めて data URL にする。透ける所がありそうな形式（PNG・GIF・WebP）は WebP（使えなければ PNG）、写真は JPEG
async function imageFileToDataUrl(file: File): Promise<{ url: string; width: number; height: number } | null> {
  const source = await new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(typeof reader.result === "string" ? reader.result : null));
    reader.addEventListener("error", () => resolve(null));
    reader.readAsDataURL(file);
  });
  if (!source) return null;
  const image = await new Promise<HTMLImageElement | null>((resolve) => {
    const element = new Image();
    element.addEventListener("load", () => resolve(element));
    element.addEventListener("error", () => resolve(null));
    element.src = source;
  });
  if (!image || !image.naturalWidth || !image.naturalHeight) return null;
  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale)), height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const target = canvas.getContext("2d");
  if (!target) return null;
  target.drawImage(image, 0, 0, width, height);
  const photo = file.type === "image/jpeg";
  let url = photo ? canvas.toDataURL("image/jpeg", 0.88) : canvas.toDataURL("image/webp", 0.88);
  if (!IMAGE_DATA_URL.test(url)) url = canvas.toDataURL("image/png");
  return { url, width, height };
}

// 画像を取り込んで、point（なければ2Dの真ん中）に置く。長い辺を3mにする
async function importImageFile(file: File, point?: Point): Promise<void> {
  if (!file.type.startsWith("image/")) return;
  const result = await imageFileToDataUrl(file);
  if (!result) {
    saveStatus.textContent = "画像を読み込めませんでした";
    window.setTimeout(() => (saveStatus.textContent = "保存済み"), 2000);
    return;
  }
  const longest = 300;
  const w = result.width >= result.height ? longest : roundTenth((longest * result.width) / result.height);
  const h = result.width >= result.height ? roundTenth((longest * result.height) / result.width) : longest;
  const center = point ?? planCenter();
  const item: Furniture = { id: newId("furniture"), type: "furniture", kind: "image", x: snap(center.x - w / 2), y: snap(center.y - h / 2), w, h, rotation: 0, image: result.url };
  activeEntities().push(item);
  activeTool = "select";
  setActiveButton("[data-tool]", activeTool);
  selectOnly(item.id);
  commitState();
  redrawAll();
}

// 「画像を取り込む」のファイル選択と、2Dへのドラッグ＆ドロップ
function setupImageImport(): void {
  const input = document.querySelector<HTMLInputElement>("#imageImportInput");
  input?.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) void importImageFile(file);
    input.value = "";
  });
  planCanvas.addEventListener("dragover", (event) => {
    if ([...(event.dataTransfer?.items ?? [])].some((item) => item.kind === "file" && item.type.startsWith("image/"))) event.preventDefault();
  });
  planCanvas.addEventListener("drop", (event) => {
    const files = [...(event.dataTransfer?.files ?? [])].filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    event.preventDefault();
    const point = screenToWorld(event);
    files.forEach((file, i) => void importImageFile(file, { x: point.x + i * 40, y: point.y + i * 40 }));
  });
}

// 選んだ画像の欄: 大きさ（縦横の比を保てる）・濃さ・回転・反転・重なりの順・差し替え
function imageEditorHtml(item: Furniture, disabled: string): string {
  return `<div class="two-col">
      <label>幅 cm<input id="imageWInput" type="number" min="10" step="10" value="${item.w}" ${disabled} /></label>
      <label>奥行 cm<input id="imageHInput" type="number" min="10" step="10" value="${item.h}" ${disabled} /></label>
    </div>
    <label class="check"><input id="imageAspectInput" type="checkbox" checked ${disabled} /> 縦横の比を保つ</label>
    <label>濃さ <span id="imageOpacityValue">${Math.round((item.opacity ?? 1) * 100)}%</span><input id="imageOpacityInput" type="range" min="5" max="100" step="5" value="${Math.round((item.opacity ?? 1) * 100)}" /></label>
    <button type="button" class="prop-button" id="imageReplaceButton" ${disabled}>画像を差し替える</button>
    <p class="pose-hint">画像は間取りのデータに入ります（自動保存・書き出しのファイルにも入ります）。大きな画像をたくさん入れると、ブラウザに自動保存できなくなることがあります。下絵にするときは、濃さを下げて「配置を固定」すると便利です。</p>`;
}

function bindImageEditor(item: Furniture): void {
  const keep = () => propertiesPanel.querySelector<HTMLInputElement>("#imageAspectInput")?.checked !== false;
  bindNumber("#imageWInput", (value) => {
    const w = Math.max(10, value), ratio = item.h / item.w;
    if (keep()) item.h = roundTenth(w * ratio);
    item.w = w;
  });
  bindNumber("#imageHInput", (value) => {
    const h = Math.max(10, value), ratio = item.w / item.h;
    if (keep()) item.w = roundTenth(h * ratio);
    item.h = h;
  });
  const opacity = propertiesPanel.querySelector<HTMLInputElement>("#imageOpacityInput");
  opacity?.addEventListener("input", () => {
    const value = clamp(Number(opacity.value) / 100, 0.05, 1);
    if (value >= 1) delete item.opacity;
    else item.opacity = value;
    const label = propertiesPanel.querySelector("#imageOpacityValue");
    if (label) label.textContent = `${Math.round(value * 100)}%`;
    render2d();
    threeSceneKey = null;
    scheduleThreeRefresh();
  });
  opacity?.addEventListener("change", () => {
    commitState();
    redrawAll();
  });
  propertiesPanel.querySelector<HTMLButtonElement>("#imageReplaceButton")?.addEventListener("click", () => {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*";
    picker.addEventListener("change", async () => {
      const file = picker.files?.[0];
      if (!file) return;
      const result = await imageFileToDataUrl(file);
      if (!result || isLocked(item)) return;
      item.image = result.url;
      // 新しい画像の縦横の比に合わせる（幅はそのまま）
      item.h = roundTenth((item.w * result.height) / result.width);
      commitState();
      redrawAll();
    });
    picker.click();
  });
}

function drawFurnitureSymbol(kind: FurnitureKind, w: number, h: number, symbol = 0, item?: Furniture, fromAbove = false): void {
  if (kind === "image") {
    drawImageItem(w, h, item);
    return;
  }
  // 自由な形（なぞった形、または決まった形の道すじ）。3Dと同じ輪郭・帯・石や杭の位置で描く
  if (isFreeShapeKind(kind) && (item?.path || isAlwaysFreeKind(kind))) {
    drawFreeShape2d(kind, w, h, item);
    return;
  }
  // 部品で組む家具は、3Dと同じ部品を低い順に真上から描く（横倒しの円柱と傾けた板は、上から見た長方形）
  if (isPartKind(kind)) {
    for (const part of furnitureParts(kind, w, h, item?.height ?? FURNITURE_DEFS[kind].height!)) {
      ctx.save();
      ctx.translate(part.x, part.y);
      ctx.rotate(part.angle ?? 0);
      const material = PART_MATERIALS[part.material];
      ctx.fillStyle = material.tintable && item?.color ? solidColor(item.color) : material.color;
      if (material.opacity !== undefined) ctx.globalAlpha *= Math.max(0.3, material.opacity);
      const depth = partSpan(part);
      if (part.shape === "box" || part.shape === "disc") strokeRoundedRect(-part.w / 2, -depth / 2, part.w, depth, part.radius, true);
      else if (part.shape === "ellipse" || part.shape === "sphere") strokeEllipse(0, 0, part.w / 2, part.d / 2, true);
      else {
        ctx.beginPath();
        ctx.ellipse(0, 0, part.w / 2, part.d / 2, 0, 0, Math.PI * 2);
        ctx.moveTo(part.w / 2 * (part.inner ?? 0.68), 0);
        ctx.ellipse(0, 0, part.w / 2 * (part.inner ?? 0.68), part.d / 2 * (part.inner ?? 0.68), 0, 0, Math.PI * 2, true);
        ctx.fill("evenodd");
        ctx.stroke();
      }
      ctx.restore();
    }
    return;
  }
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
        const start = fromAbove ? -hh + 10 : hh - 10, end = fromAbove ? hh - 14 : -hh + 14;
        strokeCircle(0, start, 3);
        strokeLine(0, start, 0, end);
        strokeArrowHead(0, end, (fromAbove ? 1 : -1) * Math.PI / 2, 8);
      } else {
        for (let x = -hw + 24; x < hw - 4; x += 24) {
          strokeLine(x, -hh, x, hh);
        }
        const start = fromAbove ? hw - 10 : -hw + 10, end = fromAbove ? -hw + 14 : hw - 14;
        strokeCircle(start, 0, 3);
        strokeLine(start, 0, end, 0);
        strokeArrowHead(end, 0, fromAbove ? Math.PI : 0, 8);
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
      const startX = fromAbove ? -ax : ax;
      strokeCircle(startX, hh - 9, 3);
      strokeLine(startX, hh - 9, startX, ay);
      ctx.beginPath();
      ctx.ellipse(0, ay, ax, Math.min(landing * 0.65, ax), 0, fromAbove ? Math.PI : 0, fromAbove ? 0 : Math.PI, !fromAbove);
      ctx.stroke();
      strokeLine(-startX, ay, -startX, hh - 12);
      strokeArrowHead(-startX, hh - 12, Math.PI / 2, 8);
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
      const startAngle = fromAbove ? Math.PI * 1.75 : Math.PI * 0.5;
      const endAngle = fromAbove ? Math.PI * 0.5 : Math.PI * 1.75;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, startAngle, endAngle, fromAbove);
      ctx.stroke();
      strokeArrowHead(Math.cos(endAngle) * r * 0.55, Math.sin(endAngle) * r * 0.55, endAngle + (fromAbove ? -1 : 1) * Math.PI / 2, 7);
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
    case "grave": {
      // 台石と、上台・竿石（上から見た四角）、手前の花立て2つと香炉（3Dと同じ位置・大きさ。GRAVE_PARTS）
      const { middle, stone, vases, vaseRadius, incense } = GRAVE_PARTS;
      ctx.fillStyle = OUTDOOR_STONE;
      strokeRoundedRect(-hw, -hh, w, h, 2, true);
      ctx.fillStyle = SYMBOL_SHADE;
      strokeRoundedRect(-(middle.w * w) / 2, middle.y * h - (middle.d * h) / 2, middle.w * w, middle.d * h, 1.5, true);
      ctx.fillStyle = "#c9ccc8";
      strokeRoundedRect(-(stone.w * w) / 2, stone.y * h - (stone.d * h) / 2, stone.w * w, stone.d * h, 1, true);
      ctx.fillStyle = "#ffffff";
      for (const [vx, vy] of vases) strokeCircle(vx * w, vy * h, vaseRadius * Math.min(w, h), true);
      strokeRoundedRect(-(incense.w * w) / 2, incense.y * h - (incense.d * h) / 2, incense.w * w, incense.d * h, 1, true);
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
  if (selectedEntities().length > 1) return;
  if (deferOverlay(() => drawPersonHandles(item))) return;
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

// exact: 点を打って描いた線（点と点のあいだをまっすぐのまま、なめらかにしない）
function placePaintStroke(points: Point[], exact = false): void {
  const path = exact ? points.map((point): Point2 => [point.x, point.y]) : tidyPaintPath(points);
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

// なぞっている間の見本: いまのペンの色・太さで描く（exact: 点を打って描いている線は、打った点のまま）
function drawPaintPreview(points: Point[], exact = false): void {
  if (deferOverlay(() => drawPaintPreview(points, exact))) return;
  const path = exact ? points.map((point): Point2 => [point.x, point.y]) : tidyPaintPath(points);
  if (!path.length) return;
  const parsed = parseColorCode(penSettings.color);
  const filled = penSettings.filled && path.length >= 3;
  ctx.save();
  ctx.globalAlpha = parsed?.alpha ?? 1;
  ctx.translate(0, 0);
  drawPaint(1, 1, { id: "preview", type: "furniture", kind: "paint", x: 0, y: 0, w: 1, h: 1, rotation: 0, brush: penSettings.brush, filled, path: path.map(([x, y]) => [x, y]) }, parsed?.rgb ?? PEN_DEFAULT_COLOR);
  ctx.restore();
}

// ペン先の丸: いまのペンの太さの円を、色を薄く塗って描く。白と黒の二重の縁で、どんな床の上でも見えるようにする
function drawPenCursor(point: Point): void {
  if (deferOverlay(() => drawPenCursor(point))) return;
  const kind = penSettings.kind;
  const brushKey = isBrushing() ? drawKey() : null;
  const parsed = !brushKey && activeTool === "paint" && kind === "paint" ? parseColorCode(penSettings.color) : null;
  // 塗る幅（床・池など）、ペンの太さ、川・小道などの幅。囲む形は点だけ
  const width = brushKey ? brushWidthFor(brushKey) : kind === "paint" ? penSettings.brush : isFreeAreaKind(kind) ? 0 : freeBandWidth(kind, freeWidthByKind[kind]);
  ctx.save();
  ctx.beginPath();
  ctx.arc(point.x, point.y, Math.max(width / 2, 2 / view.zoom), 0, Math.PI * 2);
  ctx.fillStyle = brushKey ? (brushCut ? BRUSH_CUT_COLOR : brushFill(brushKey)) : parsed ? parsed.rgb : "#2775d1";
  ctx.globalAlpha = brushKey ? 0.45 : (parsed ? 0.35 : 0.2) * (parsed?.alpha ?? 1);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 3 / view.zoom;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.stroke();
  ctx.lineWidth = 1.2 / view.zoom;
  ctx.strokeStyle = "rgba(24, 28, 33, 0.9)";
  ctx.stroke();
  ctx.restore();
}

// マウスを動かすたびに全体を描き直すと重いので、1コマに1回にまとめる
function renderPenCursor(): void {
  if (penCursorFrame) return;
  penCursorFrame = requestAnimationFrame(() => {
    penCursorFrame = 0;
    render2d();
  });
}

function hidePenCursor(): void {
  if (!penCursor) return;
  penCursor = null;
  renderPenCursor();
}

// 太さを変えている間は、画面の真ん中にペン先の丸を少しのあいだ出す
function previewPenSize(): void {
  penSizePreview = true;
  window.clearTimeout(penSizePreviewTimer);
  penSizePreviewTimer = window.setTimeout(() => {
    penSizePreview = false;
    renderPenCursor();
  }, 1500);
  renderPenCursor();
}

// 2Dに見えている範囲の真ん中（cm）
function planCenter(): Point {
  const rect = planCanvas.getBoundingClientRect();
  return { x: (rect.width / 2 - view.x) / view.zoom, y: (rect.height / 2 - view.y) / view.zoom };
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

// 描き方を選ぶ欄（ペンでなぞる・点を打って囲う）。床は「部屋」と「線で囲んで床を作成」を切り替える
function drawMethodHtml(): string {
  const method = currentDrawMethod();
  const key = drawKey();
  const area = isAreaKey(key);
  const item = (value: DrawMethod, label: string) => `<button type="button" role="radio" data-draw-method="${value}" class="${method === value ? "is-active" : ""}" aria-checked="${method === value}">${label}</button>`;
  // 床・池などの閉じる形は、ペンで塗るか、囲むか。川・小道などの線の形は、ペンでなぞるか、点を打つか
  const methods = area
    ? item("brush", "ペンで塗る") + item("trace", "囲んで描く") + item("straight", "直線で囲む") + item("curve", "曲線で囲む")
    : item("trace", "ペンで描く") + item("straight", "直線で描く") + item("curve", "曲線で描く");
  return `<label>描き方</label>
    <div class="segmented draw-method${area ? " is-area" : ""}" role="radiogroup" aria-label="描き方">${methods}</div>
    ${key && area && method === "brush" ? brushControlsHtml(key) : ""}`;
}

// ペンで塗るときの幅と、塗るかけずるか
function brushControlsHtml(key: string): string {
  const width = brushWidthFor(key);
  const mode = (value: "paint" | "cut", label: string) => {
    const active = (value === "cut") === brushCut;
    return `<button type="button" role="radio" data-brush-mode="${value}" class="${active ? "is-active" : ""}" aria-checked="${active}">${label}</button>`;
  };
  return `<label>塗る幅 cm
      <span class="pen-width">
        <input id="brushWidthRange" type="range" min="${BRUSH_WIDTH_RANGE.min}" max="600" step="10" value="${Math.min(600, width)}" aria-label="塗る幅" />
        <input id="brushWidthInput" type="number" min="${BRUSH_WIDTH_RANGE.min}" max="${BRUSH_WIDTH_RANGE.max}" step="10" value="${width}" />
      </span>
    </label>
    <div class="segmented pen-mode brush-mode" role="radiogroup" aria-label="塗るかけずるか">${mode("paint", "塗る")}${mode("cut", "けずる")}</div>`;
}

// ペンで塗るときの説明
function brushHint(label: string): string {
  const what = activeTool === "room" ? "同じ素材の床" : `${label}`;
  return brushCut
    ? `けずる: 2Dをドラッグした所の${what}をけずります。真ん中をけずると穴があきます。`
    : `${label}: 2Dをドラッグして塗った所が${label}になります。${what}に重ねて塗るとつながり、輪のように塗ると真ん中があいた形（ドーナツ）になります。`;
}

function bindDrawMethod(): void {
  propertiesPanel.querySelectorAll<HTMLButtonElement>("[data-draw-method]").forEach((button) => button.addEventListener("click", () => {
    const method = (DRAW_METHODS as string[]).includes(button.dataset.drawMethod ?? "") ? button.dataset.drawMethod as DrawMethod : "trace";
    const key = drawKey();
    if (!key) return;
    drawMethods[key] = method;
    floorDraft = null;
    floorEditError = "";
    // 床: 塗る・囲むなら部屋のツール、直線・曲線なら線で囲んで床を作成
    if (key === "floor") activeTool = method === "trace" || method === "brush" ? "room" : "floor";
    setActiveButton("[data-tool]", activeTool);
    scheduleViewStateSave();
    syncPlanCursor();
    updatePropertiesPanel();
    syncToolHint();
    render2d();
  }));
  // 塗る幅と、塗るかけずるか（履歴には積まない）
  const key = drawKey();
  const range = propertiesPanel.querySelector<HTMLInputElement>("#brushWidthRange"), number = propertiesPanel.querySelector<HTMLInputElement>("#brushWidthInput");
  const setWidth = (value: number) => {
    if (!key || !Number.isFinite(value)) return;
    brushWidths[key] = clampBrushWidth(value);
    scheduleViewStateSave();
    previewPenSize();
  };
  range?.addEventListener("input", () => {
    setWidth(Number(range.value));
    if (number && key) number.value = String(brushWidthFor(key));
  });
  number?.addEventListener("change", () => {
    setWidth(Number(number.value));
    if (range && key) range.value = String(Math.min(600, brushWidthFor(key)));
  });
  propertiesPanel.querySelectorAll<HTMLButtonElement>("[data-brush-mode]").forEach((button) => button.addEventListener("click", () => {
    brushCut = button.dataset.brushMode === "cut";
    updatePropertiesPanel();
    syncToolHint();
    render2d();
  }));
}

// ペンで描く物を選ぶ欄（ペンの線と、なぞって描ける自由な形）
function penKindHtml(): string {
  return `<label>描く物</label>
    <div class="segmented pen-kinds" role="radiogroup" aria-label="描く物">${PEN_KINDS.map((kind) => {
      const active = penSettings.kind === kind;
      return `<button type="button" role="radio" data-pen-kind="${kind}" class="${active ? "is-active" : ""}" aria-checked="${active}">${kind === "paint" ? "ペン" : FURNITURE_DEFS[kind].label}</button>`;
    }).join("")}</div>`;
}

// 自由な形をペンで描くときの幅（川・小道・生け垣・石垣）。一覧から置くときと同じ「最後に使った幅」を使う
function penShapeWidthHtml(kind: FreeKind): string {
  if (isFreeAreaKind(kind)) return "";
  if (!isFreeWidthAdjustable(kind)) return `<p class="pose-hint">${FURNITURE_DEFS[kind].label}の幅は決まっています。</p>`;
  const width = freeLineWidth(kind as Parameters<typeof freeLineWidth>[0], freeWidthByKind[kind]);
  return `<label>幅 cm
      <span class="pen-width">
        <input id="penShapeWidthRange" type="range" min="${FREE_WIDTH_RANGE.min}" max="600" step="10" value="${Math.min(600, width)}" aria-label="幅" />
        <input id="penShapeWidthInput" type="number" min="${FREE_WIDTH_RANGE.min}" max="${FREE_WIDTH_RANGE.max}" step="10" value="${width}" />
      </span>
    </label>`;
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
    previewPenSize();
  });
  number?.addEventListener("change", () => {
    if (!Number.isFinite(Number(number.value))) return;
    penSettings.brush = clamp(Math.round(Number(number.value)), 1, MAX_BRUSH);
    remember();
    previewPenSize();
  });
  panel.querySelectorAll<HTMLButtonElement>("[data-pen-mode]").forEach((button) => button.addEventListener("click", () => {
    penSettings.filled = button.dataset.penMode === "fill";
    remember();
  }));
  panel.querySelectorAll<HTMLButtonElement>("[data-pen-kind]").forEach((button) => button.addEventListener("click", () => {
    penSettings.kind = button.dataset.penKind as PenKind;
    remember();
    syncToolHint();
  }));
  // 自由な形の幅は、一覧から置くときと同じ「最後に使った幅」に入れる
  const shapeRange = panel.querySelector<HTMLInputElement>("#penShapeWidthRange"), shapeNumber = panel.querySelector<HTMLInputElement>("#penShapeWidthInput");
  const setShapeWidth = (value: number) => {
    if (penSettings.kind === "paint" || !Number.isFinite(value)) return;
    freeWidthByKind[penSettings.kind] = clamp(Math.round(value), FREE_WIDTH_RANGE.min, FREE_WIDTH_RANGE.max);
    previewPenSize();
  };
  shapeRange?.addEventListener("input", () => {
    setShapeWidth(Number(shapeRange.value));
    if (shapeNumber && penSettings.kind !== "paint") shapeNumber.value = String(freeWidthByKind[penSettings.kind]);
  });
  shapeNumber?.addEventListener("change", () => {
    setShapeWidth(Number(shapeNumber.value));
    if (shapeRange && penSettings.kind !== "paint") shapeRange.value = String(Math.min(600, freeWidthByKind[penSettings.kind] ?? 0));
  });
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

// ---- 自由な形（free-shapes.ts）: 池・花壇・芝生・ラグはなぞって囲んだ形、川・小道・生け垣・石垣・柵・竹垣・線路・飛び石はなぞった道すじ ----

// 最後に使った幅（川・小道・生け垣・石垣）。次になぞるときも同じ幅
const freeWidthByKind: Partial<Record<FurnitureKind, number>> = {};

function isFreeShapeItem(item: Furniture): boolean {
  return isFreeShapeKind(item.kind) && (Boolean(item.path) || isAlwaysFreeKind(item.kind));
}

function freeItemPoints(kind: FreeKind, w: number, h: number, item?: Furniture): Point2[] {
  return freePathPoints(item?.path ?? defaultFreePath(kind), w, h);
}

// 池・花壇・芝生・ラグの穴（cm）。なぞった形のときだけ持つ
function freeItemHoles(kind: FreeKind, w: number, h: number, item?: Furniture): Point2[][] {
  return isFreeAreaKind(kind) && item?.path ? freeHolePoints(item.holes, w, h) : [];
}

// 穴のある形を塗る（穴の所は塗らない）。縁の線は、外側の輪郭と穴の縁に引く
function fillRegion(outline: Point2[], holes: Point2[][], fill: string, stroke = true): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (const ring of [outline, ...holes]) {
    ring.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }
  ctx.fill("evenodd");
  if (stroke) ctx.stroke();
}

// 線に沿った幅 width cm の帯（角は丸い）。先に線の色で少し太く、次に塗りの色で描いて、縁取りにする。3Dの帯（箱と丸い柱）と同じ形
function strokeFreeBand(line: Point2[], width: number, fill: string, closed = false, outline = true): void {
  if (line.length < 2) return;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "butt";
  const ink = ctx.lineWidth;
  ctx.beginPath();
  line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (closed) ctx.closePath();
  if (outline) {
    ctx.lineWidth = width + ink;
    ctx.stroke();
  }
  ctx.lineWidth = outline ? Math.max(width - ink, ink * 0.5) : width;
  ctx.strokeStyle = fill;
  ctx.stroke();
  ctx.restore();
}

// 2Dの記号。点の位置は3D（furniture-models.ts の buildFreeShape）と同じ
function drawFreeShape2d(kind: FreeKind, w: number, h: number, item?: Furniture): void {
  const points = freeItemPoints(kind, w, h, item);
  const holes = freeItemHoles(kind, w, h, item);
  const line = freeCenterLine(points);
  const tint = item?.color ? solidColor(item.color) : undefined;
  ctx.save();
  ctx.lineJoin = "round";
  switch (kind) {
    case "pond": {
      const pond = freePond(points, holes);
      fillRegion(pond.water, pond.holes, OUTDOOR_WATER);
      for (const ripple of pond.ripples) {
        ctx.beginPath();
        ctx.ellipse(ripple.x, ripple.y, ripple.rx, ripple.ry, 0, RIPPLE_START, RIPPLE_END);
        ctx.stroke();
      }
      // 縁の石は小さいので、引いて見たときに縁取りで黒くつぶれないよう、縁取りを石の大きさに合わせて細くする
      ctx.fillStyle = OUTDOOR_STONE;
      ctx.lineWidth = Math.min(ctx.lineWidth, 2.5);
      for (const stone of pond.stones) {
        ctx.save();
        ctx.translate(stone.x, stone.y);
        ctx.rotate(stone.angle);
        strokeEllipse(0, 0, stone.rx, stone.ry, true);
        ctx.restore();
      }
      break;
    }
    case "flowerBed": {
      const bed = freeFlowerBed(points, holes);
      fillRegion(bed.outline, bed.holes, OUTDOOR_SOIL, false);
      for (const ring of [bed.outline, ...bed.holes]) strokeFreeBand(ring, 8, OUTDOOR_STONE, true);
      // 株は小さいので、縁取りを株の大きさに合わせて細くする（引いて見ても花の色が見える）
      ctx.lineWidth = Math.min(ctx.lineWidth, 1.5);
      for (const plant of bed.plants) {
        ctx.fillStyle = OUTDOOR_LEAF;
        strokeCircle(plant.x, plant.y, plant.r + 3, true);
        ctx.fillStyle = plant.color;
        strokeCircle(plant.x, plant.y, plant.r, true);
      }
      break;
    }
    case "lawn": {
      const lawn = freeLawn(points, holes);
      fillRegion(lawn.outline, lawn.holes, OUTDOOR_LEAF);
      ctx.save();
      ctx.lineWidth = Math.min(ctx.lineWidth * 0.6, 1);
      for (const [x, y] of lawn.tufts) strokeCircle(x, y, 3);
      ctx.restore();
      break;
    }
    case "rug": {
      const outline = freeOutline(points), rugHoles = freeHoleOutlines(holes);
      fillRegion(outline, rugHoles, tint ? withAlpha(tint, 0.25) : furnitureSymbolFill("rug"));
      for (const ring of [outline, ...rugHoles]) strokeFreeBand(ring, 6, tint ? withAlpha(tint, 0.55) : OUTDOOR_TRUNK, true);
      break;
    }
    case "river": {
      // 土手と水面。流れに沿った小さな波の印（3Dの筋と同じ所）。真ん中に線は引かない
      const width = freeLineWidth("river", item?.brush);
      strokeFreeBand(line, width + 28, OUTDOOR_SOIL);
      strokeFreeBand(line, width, OUTDOOR_WATER);
      ctx.save();
      ctx.strokeStyle = tint ?? "#8fb9cf";
      ctx.lineCap = "round";
      for (const ripple of freeRiverRipples(line, width)) {
        const dx = (Math.cos(ripple.angle) * ripple.length) / 2, dy = (Math.sin(ripple.angle) * ripple.length) / 2;
        strokeLine(ripple.x - dx, ripple.y - dy, ripple.x + dx, ripple.y + dy);
      }
      ctx.restore();
      break;
    }
    case "pathway": {
      const width = freeLineWidth("pathway", item?.brush);
      strokeFreeBand(line, width + 8, OUTDOOR_STONE);
      strokeFreeBand(line, width, "#f4f0e8");
      break;
    }
    case "hedge": {
      const width = freeLineWidth("hedge", item?.brush);
      strokeFreeBand(line, width, OUTDOOR_LEAF);
      strokeFreeBand(line, width * 0.55, "#eef5e8");
      break;
    }
    case "stoneWall": {
      const width = freeLineWidth("stoneWall", item?.brush);
      strokeFreeBand(line, width + 2, OUTDOOR_STONE);
      // 笠石の継ぎ目（3Dの継ぎ目の溝と同じ所。両端は除く）
      for (const joint of freePosts(line, 38).slice(1, -1)) {
        const nx = -Math.sin(joint.angle) * (width / 2 + 1), ny = Math.cos(joint.angle) * (width / 2 + 1);
        strokeLine(joint.x - nx, joint.y - ny, joint.x + nx, joint.y + ny);
      }
      break;
    }
    case "fence": {
      strokeFreeBand(line, 4, OUTDOOR_TRUNK);
      ctx.fillStyle = String(ctx.strokeStyle);
      for (const post of freePosts(line, 150)) {
        ctx.save();
        ctx.translate(post.x, post.y);
        ctx.rotate(post.angle);
        ctx.fillRect(-4.5, -4.5, 9, 9);
        ctx.restore();
      }
      break;
    }
    case "takegaki": {
      strokeFreeBand(line, 8, OUTDOOR_TRUNK);
      ctx.fillStyle = String(ctx.strokeStyle);
      for (const post of freePosts(line, 180)) strokeCircle(post.x, post.y, 5, true);
      break;
    }
    case "railway": {
      strokeFreeBand(line, 300, "#ebe8e2");
      ctx.fillStyle = OUTDOOR_TRUNK;
      for (const sleeper of freePosts(line, RAILWAY.sleeperSpacing)) {
        ctx.save();
        ctx.translate(sleeper.x, sleeper.y);
        ctx.rotate(sleeper.angle);
        strokeRoundedRect(-RAILWAY.sleeperWidth / 2, -RAILWAY.sleeperLength / 2, RAILWAY.sleeperWidth, RAILWAY.sleeperLength, 1, true);
        ctx.restore();
      }
      for (const side of [1, -1]) {
        const rail = offsetFreeLine(line, side * (RAILWAY.gauge / 2 + RAILWAY.railWidth / 2), false);
        strokeFreeBand(rail, RAILWAY.railWidth, String(ctx.strokeStyle), false, false);
      }
      break;
    }
    case "steppingStones": {
      ctx.fillStyle = OUTDOOR_STONE;
      for (const stone of freeSteppingStones(line)) {
        ctx.save();
        ctx.translate(stone.x, stone.y);
        ctx.rotate(stone.angle);
        strokeEllipse(0, 0, stone.rx, stone.ry, true);
        ctx.restore();
      }
      break;
    }
  }
  ctx.restore();
}

// 形の上か（閉じた形は内側か縁の近く、線の形は帯の上）
function isPointOnFreeShape(item: Furniture, point: Point, reach = 6 / view.zoom): boolean {
  return freeShapeTester(item, reach)(point);
}

// 形の上かを調べる関数。道すじは1回だけ計算するので、同じ物をたくさんの点で調べるときに使う
function freeShapeTester(item: Furniture, reach: number): (point: Point) => boolean {
  const kind = item.kind as FreeKind;
  const points = freeItemPoints(kind, item.w, item.h, item);
  if (isFreeAreaKind(kind)) {
    // 穴の中は形の外。縁（外側の輪郭と穴の縁）の近くは形の上
    const outline = freeOutline(points), holes = freeHoleOutlines(freeItemHoles(kind, item.w, item.h, item));
    const margin = reach + (kind === "pond" ? 18 : 4);
    return (point) => {
      const [x, y] = worldToFurnitureLocal(item, point);
      return pointInFreeRegion(x, y, outline, holes) || [outline, ...holes].some((ring) => distanceToFreeLine(x, y, ring, true) <= margin);
    };
  }
  const line = freeCenterLine(points);
  const half = freeBandWidth(kind, item.brush) / 2 + reach;
  return (point) => {
    const [x, y] = worldToFurnitureLocal(item, point);
    return distanceToFreeLine(x, y, line, false) <= half;
  };
}

// 線の形の、見えている帯の幅（川は岸、小道は縁石も含める。線路は枕木の長さ）
function freeBandWidth(kind: FreeKind, brush?: number): number {
  if (isFreeAreaKind(kind)) return 0;
  const line = kind as Parameters<typeof freeLineWidth>[0];
  return kind === "railway" ? 300 : kind === "river" ? freeLineWidth(line, brush) + 28 : kind === "pathway" ? freeLineWidth(line, brush) + 8 : Math.max(freeLineWidth(line, brush), 12);
}

// なぞり終えたとき。短ければ（クリック）いつもの形で置き、長ければ、なぞった形で作る（または「なぞり直す」の物を描き直す）。
// exact: 点を打って描いた形（打った点をそのまま使い、なめらかにしない）
function placeFreeShapePath(kind: FreeKind, points: Point[], exact = false): Furniture | null {
  const redraw = pathRedrawTarget(kind);
  pathRedrawId = null;
  const path = exact ? points.map((point): Point2 => [point.x, point.y]) : tidyPath(points);
  const area = isFreeAreaKind(kind);
  if (path.length < (area ? 3 : 2) || pathLength(path) < (area ? 60 : 30)) {
    if (redraw) return null;
    const base = FURNITURE_DEFS[kind];
    const item: Furniture = {
      id: newId("furniture"), type: "furniture", kind, x: snap(points[0].x - base.w / 2), y: snap(points[0].y - base.h / 2), w: base.w, h: base.h, rotation: 0,
      ...newFurnitureDetails(kind), ...(isFreeWidthAdjustable(kind) && freeWidthByKind[kind] ? { brush: freeWidthByKind[kind] } : {}),
    };
    activeEntities().push(item);
    state.selectedId = item.id;
    return item;
  }
  const brush = isFreeWidthAdjustable(kind) ? redraw?.brush ?? freeWidthByKind[kind] : undefined;
  const frame = pathFrame(path, freeMargin(kind, brush));
  const item: Furniture = redraw ?? { id: newId("furniture"), type: "furniture", kind, x: 0, y: 0, w: 1, h: 1, rotation: 0, ...newFurnitureDetails(kind) };
  Object.assign(item, frame, { rotation: 0 });
  if (brush !== undefined) item.brush = brush;
  delete item.flip;
  if (!redraw) activeEntities().push(item);
  state.selectedId = item.id;
  if (redraw) {
    activeTool = "select";
    setActiveButton("[data-tool]", activeTool);
    setActiveButton("[data-furniture]", "");
  }
  return item;
}

// なぞっている間の見本: 離したときにできる形を、うすく描く（exact: 点を打って描いている形は、打った点のまま）
function drawFreeShapePreview(kind: FreeKind, points: Point[], exact = false): void {
  if (deferOverlay(() => drawFreeShapePreview(kind, points, exact))) return;
  const path = exact ? points.map((point): Point2 => [point.x, point.y]) : tidyPath(points);
  ctx.save();
  ctx.strokeStyle = "rgba(39, 117, 209, 0.55)";
  ctx.lineWidth = 1.5 / view.zoom;
  ctx.setLineDash([6 / view.zoom, 4 / view.zoom]);
  traceOpenPath(path);
  if (isFreeAreaKind(kind)) ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  if (path.length >= (isFreeAreaKind(kind) ? 3 : 2) && pathLength(path) >= 30) {
    const redraw = pathRedrawTarget(kind);
    const brush = isFreeWidthAdjustable(kind) ? redraw?.brush ?? freeWidthByKind[kind] : undefined;
    const frame = pathFrame(path, freeMargin(kind, brush));
    ctx.globalAlpha = 0.75;
    ctx.translate(frame.x + frame.w / 2, frame.y + frame.h / 2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2 / view.zoom;
    drawFreeShape2d(kind, frame.w, frame.h, { id: "preview", type: "furniture", kind, x: frame.x, y: frame.y, w: frame.w, h: frame.h, rotation: 0, path: frame.path, ...(brush ? { brush } : {}) });
  }
  ctx.restore();
}

function freeShapeEditorHtml(item: Furniture, disabled: string): string {
  const kind = item.kind as FreeKind;
  const area = isFreeAreaKind(kind);
  const width = isFreeWidthAdjustable(kind)
    ? `<label>幅 cm<input id="freeWidthInput" type="number" min="${FREE_WIDTH_RANGE.min}" max="${FREE_WIDTH_RANGE.max}" step="10" value="${freeLineWidth(kind as Parameters<typeof freeLineWidth>[0], item.brush)}" ${disabled} /></label>`
    : "";
  const reset = item.path && !isAlwaysFreeKind(kind) ? `<button type="button" class="prop-button" id="freeResetButton" ${disabled}>いつもの形に戻す</button>` : "";
  return `
    ${width}
    <div class="two-col">
      <button type="button" class="prop-button" id="freeRedrawButton" ${disabled}>${area ? "形をなぞり直す" : "道すじをなぞり直す"}</button>
      ${reset}
    </div>
    <p class="pose-hint">${area ? "パーツを選んで2Dをドラッグすると、囲んだ形になります（クリックだけなら、いつもの形）。" : "パーツを選んで2Dをドラッグすると、なぞった道すじに沿って置けます（クリックだけなら、まっすぐ）。"}</p>`;
}

// 幅を変えたとき。道すじの場所はそのままに、範囲を合わせ直す
function refitFreeShape(item: Furniture): void {
  if (!item.path) return;
  const points = item.path.map(([u, v]): Point2 => [u * item.w, v * item.h]);
  const frame = pathFrame(points, freeMargin(item.kind as FreeKind, item.brush));
  const center = furnitureLocalToWorld(item, [frame.x + frame.w / 2, frame.y + frame.h / 2]);
  item.w = frame.w;
  item.h = frame.h;
  item.path = frame.path;
  item.x = roundTenth(center.x - frame.w / 2);
  item.y = roundTenth(center.y - frame.h / 2);
}

function bindFreeShapeEditor(item: Furniture): void {
  bindNumber("#freeWidthInput", (value) => {
    item.brush = clamp(Math.round(value), FREE_WIDTH_RANGE.min, FREE_WIDTH_RANGE.max);
    freeWidthByKind[item.kind] = item.brush;
    if (!item.path) item.path = defaultFreePath(item.kind as FreeKind).map(([u, v]) => [u, v]);
    refitFreeShape(item);
  });
  propertiesPanel.querySelector<HTMLButtonElement>("#freeRedrawButton")?.addEventListener("click", () => {
    pathRedrawId = item.id;
    activeFurniture = item.kind;
    activeTool = "furniture";
    setActiveButton("[data-furniture]", activeFurniture);
    setActiveButton("[data-tool]", activeTool);
    syncPlanCursor();
    const hint = propertiesPanel.querySelector<HTMLParagraphElement>(".pose-hint");
    if (hint) hint.textContent = isFreeAreaKind(item.kind) ? "2Dの上をドラッグして、新しい形を囲んでください。" : "2Dの上をドラッグして、新しい道すじをなぞってください。";
  });
  bindButton("#freeResetButton", () => {
    const base = FURNITURE_DEFS[item.kind];
    const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
    delete item.path;
    item.w = base.w;
    item.h = base.h;
    item.x = snap(cx - base.w / 2);
    item.y = snap(cy - base.h / 2);
  });
}

// 「なぞり直す」を押した足跡・破片・自由な形
function pathRedrawTarget(kind: FurnitureKind): Furniture | null {
  const target = pathRedrawId ? findEntity(pathRedrawId) : null;
  return target?.type === "furniture" && target.kind === kind && !isLocked(target) ? target : null;
}

// なぞり終えたとき。短ければ（クリック）まっすぐな足跡を置き、長ければその道すじに沿った足跡を作る（または描き直す）
function placeFootprintPath(points: Point[]): void {
  const redraw = pathRedrawTarget("footprints");
  pathRedrawId = null;
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
  if (deferOverlay(() => drawFootprintPreview(points))) return;
  const path = tidyPath(points);
  if (path.length < 2) return;
  const redraw = pathRedrawTarget("footprints");
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
    pathRedrawId = item.id;
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
  pathRedrawId = null;
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

// 道すじ（間取りの cm）から、余白を付けた範囲と、範囲に対する割合の道すじを作る（テンプレートと同じ free-shapes.ts の計算）
function pathFrame(path: Point2[], margin: number): { x: number; y: number; w: number; h: number; path: number[][] } {
  return freeFrame(path, margin);
}

// なぞっている間の見本: 道すじと、そこにまかれる破片
function drawShardPreview(points: Point[]): void {
  if (deferOverlay(() => drawShardPreview(points))) return;
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
    pathRedrawId = item.id;
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

// 選択中パネルで記号を見比べるための見本（一覧のボタンの小さな絵も）。回転はせず、反転と2Dの色は反映する
function drawSymbolPreview(canvas: HTMLCanvasElement, item: Furniture, symbol: number, size = SYMBOL_PREVIEW_SIZE): void {
  const target = canvas.getContext("2d");
  if (!target) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(size * ratio);
  canvas.height = Math.round(size * ratio);
  // 倒れた人の前からある形の見本は、その形の標準の大きさで見せる（手足を動かした後の範囲だと小さくなるため）
  const legacyPreview = item.kind === "fallenPerson" && symbol !== 2 && Boolean(item.pose);
  const w = legacyPreview ? FURNITURE_DEFS.fallenPerson.w : item.w, h = legacyPreview ? FURNITURE_DEFS.fallenPerson.h : item.h;
  const pad = size >= 40 ? 8 : 3;
  const scale = Math.min((size - pad) / w, (size - pad) / h);
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
  if (shape.kind === "circle" || shape.kind === "ellipse") {
    ctx.ellipse(shape.x, shape.y, shape.r, shapeRadiusY(shape), 0, 0, Math.PI * 2);
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
  if (selectedEntities().length > 1) return;
  if (deferOverlay(() => drawShapeHandle(shape))) return;
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#2775d1";
  ctx.lineWidth = 2 / view.zoom;
  const size = 5 / view.zoom;
  for (const handle of shapeHandles(shape)) {
    ctx.beginPath(); ctx.arc(handle.x, handle.y, size, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  strokeLine(shape.x - size, shape.y, shape.x + size, shape.y);
  strokeLine(shape.x, shape.y - size, shape.x, shape.y + size);
  if (drag.dragMode === "resize" && drag.originEntity?.id === shape.id) drawSizeBadge(shape.x, shape.y, shape.kind === "ellipse" ? `${Math.round(shape.r * 2)} × ${Math.round(shapeRadiusY(shape) * 2)} cm` : `直径 ${Math.round(shape.r * 20) / 10} cm`);
  ctx.restore();
}

function drawSizeBadge(x: number, y: number, label: string): void {
  const text = t(label);
  ctx.save();
  ctx.font = `12px ${TEXT_FONT}`;
  ctx.translate(x, y); ctx.scale(1 / view.zoom, 1 / view.zoom);
  const w = ctx.measureText(text).width + 16;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-w / 2, -32, w, 24);
  ctx.fillStyle = "#1659a9";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, 0, -20);
  ctx.restore();
}

function drawFloorDraft(): void {
  if (!floorDraft?.points.length) return;
  if (deferOverlay(drawFloorDraft)) return;
  const target = draftTarget();
  const points = floorDraft.points, hover = floorDraft.hover;
  const closing = target.closed && points.length >= 3 && hover && Math.hypot(hover.x - points[0][0], hover.y - points[0][1]) <= 14 / view.zoom;
  const curve = currentDrawMethod() === "curve";
  if (activeTool !== "floor") {
    const placed: [number, number][] = [...points, ...(hover && !closing ? [[hover.x, hover.y] as [number, number]] : [])];
    const path = shapeDraftPoints(placed, target.closed && (closing || placed.length >= 3)).map(([x, y]): Point => ({ x, y }));
    if (activeTool === "paint" && penSettings.kind === "paint") drawPaintPreview(path, true);
    else {
      const kind = activeTool === "paint" ? penSettings.kind : activeFurniture;
      if (kind !== "paint" && isFreeShapeKind(kind)) drawFreeShapePreview(kind, path, true);
    }
  }
  ctx.save();
  ctx.lineWidth = 2 / view.zoom;
  ctx.strokeStyle = "#2775d1";
  ctx.fillStyle = "rgba(39,117,209,.12)";
  ctx.beginPath();
  if (curve) {
    // 曲線: 打った点（とマウスの所）を通る線
    const through: [number, number][] = [...points, ...(hover && !closing ? [[hover.x, hover.y] as [number, number]] : [])];
    curveThrough(through, target.closed && closing === true).forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    if (target.closed && closing) ctx.closePath();
  } else {
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    if (hover) ctx.lineTo(closing ? points[0][0] : hover.x, closing ? points[0][1] : hover.y);
  }
  if (target.closed) ctx.fill();
  ctx.stroke();
  if (target.closed) {
    ctx.setLineDash([5 / view.zoom, 5 / view.zoom]);
    ctx.lineTo(points[0][0], points[0][1]); ctx.stroke(); ctx.setLineDash([]);
  }
  points.forEach(([x, y], i) => {
    ctx.beginPath(); ctx.arc(x, y, (i === 0 ? 7 : 4) / view.zoom, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 && closing ? "#2775d1" : "#ffffff"; ctx.fill(); ctx.stroke();
  });
  const last = points[points.length - 1];
  if (hover && !closing && (hover.x !== last[0] || hover.y !== last[1])) drawSizeBadge((hover.x + last[0]) / 2, (hover.y + last[1]) / 2, `${Math.round(Math.hypot(hover.x - last[0], hover.y - last[1]))} cm`);
  ctx.restore();
}

function drawPreview(start: Point, current: Point): void {
  if (deferOverlay(() => drawPreview(start, current))) return;
  ctx.save();
  ctx.setLineDash([8 / view.zoom, 6 / view.zoom]);
  ctx.lineWidth = 2 / view.zoom;
  ctx.strokeStyle = "#2775d1";
  ctx.fillStyle = "rgba(39, 117, 209, 0.08)";
  if (activeTool === "room" && drag.path && isFloorTrace(drag.path)) {
    // なぞっている形（離すと、この形の床になる）
    ctx.beginPath();
    drag.path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (activeTool === "room") {
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const w = Math.abs(current.x - start.x);
    const h = Math.abs(current.y - start.y);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  } else if (activeTool === "ellipse") {
    ctx.beginPath(); ctx.ellipse((start.x + current.x) / 2, (start.y + current.y) / 2, Math.max(1, Math.abs(current.x - start.x) / 2), Math.max(1, Math.abs(current.y - start.y) / 2), 0, 0, Math.PI * 2); ctx.stroke();
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
  if (selectedEntities().length > 1) return;
  if (deferOverlay(() => drawResizeHandles(entity))) return;
  const handles = entity.type === "room" ? floorHandles(entity) : [
    { key: "nw", x: entity.x, y: entity.y },
    { key: "ne", x: entity.x + entity.w, y: entity.y },
    { key: "sw", x: entity.x, y: entity.y + entity.h },
    { key: "se", x: entity.x + entity.w, y: entity.y + entity.h },
  ];
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#2775d1";
  ctx.lineWidth = 2 / view.zoom;
  const size = 8 / view.zoom;
  handles.forEach((handle) => {
    const edge = handle.key.startsWith("edge:");
    const vertex = floorEdit?.id === entity.id && handle.key === `vertex:${floorEdit.vertex}`;
    ctx.fillStyle = vertex ? "#2775d1" : "#ffffff";
    if (edge || handle.key.startsWith("round:") || handle.key.startsWith("regular:") || handle.key.startsWith("vertex:")) {
      ctx.beginPath(); ctx.arc(handle.x, handle.y, (vertex ? 7 : edge ? 4 : 5) / view.zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (edge) {
        strokeLine(handle.x - 2 / view.zoom, handle.y, handle.x + 2 / view.zoom, handle.y);
        strokeLine(handle.x, handle.y - 2 / view.zoom, handle.x, handle.y + 2 / view.zoom);
      }
      return;
    }
    ctx.fillRect(handle.x - size / 2, handle.y - size / 2, size, size);
    ctx.strokeRect(handle.x - size / 2, handle.y - size / 2, size, size);
  });
  ctx.restore();
}

function measureLabel(text: string, size: number, mode: WritingMode = "horizontal"): TextLayout {
  ctx.save();
  ctx.font = styledFont(`${size}px ${TEXT_FONT}`, planStyle);
  const layout = layoutText(text, size, mode, (line) => ctx.measureText(line).width);
  ctx.restore();
  return layout;
}

function paintLabel(layout: TextLayout, x: number, y: number): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const run of layout.runs) {
    ctx.save();
    ctx.translate(x + run.x, y + run.y);
    if (run.rotate) ctx.rotate(Math.PI / 2);
    ctx.fillText(run.text, 0, 0);
    ctx.restore();
  }
}

// 文字のまとまりの幅と高さ（ワールド座標）。フォントの大きさをそのまま cm として扱う
function measureTextLabel(label: TextLabel): { w: number; h: number } {
  return measureLabel(label.text, label.size, label.writingMode);
}

function drawTextLabel(label: TextLabel): void {
  const layout = measureLabel(label.text, label.size, label.writingMode);
  ctx.save();
  ctx.translate(label.x, label.y);
  ctx.rotate(degreesToRadians(label.rotation));
  ctx.font = `${label.size}px ${TEXT_FONT}`;
  ctx.fillStyle = solidColor(label.color) ?? INK;
  paintLabel(layout, -layout.w / 2, -layout.h / 2);
  ctx.restore();
  if (state.selectedId === label.id) drawTextSelection(label);
}

function drawTextSelection(label: TextLabel): void {
  if (selectedEntities().length > 1) return;
  if (deferOverlay(() => drawTextSelection(label))) return;
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
  if (deferOverlay(() => drawLockedIndicator(entity))) return;
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

// 3Dの元になる物（間取り・屋根・隠した階・屋根の表示・絵柄）。前に作ったときと同じなら作り直さない
let threeSceneKey: string | null = null;
// 作り直しの間だけ使う、選んでいる物の id（物ごとに選択を調べ直さないように）
let buildSelection: Set<string> | null = null;

function threeSceneSignature(): string {
  return JSON.stringify([state.floors, state.roofs, [...hiddenFloorIds], roofVisible3d, threeStyle]);
}

function rebuildThreeScene(): void {
  // 間取り専用版では3Dを作らない。2Dだけを見ているときは、3Dを見るときに作る
  if (PLAN_EDITION) return;
  if (viewMode === "plan") {
    threeSceneKey = null;
    return;
  }
  ensureThreeScene();
}

// 3Dを、いまの間取りに合わせる。変わっていなければ選択の枠だけを直す（選ぶだけで全部を作り直さない）
function ensureThreeScene(): void {
  if (PLAN_EDITION) return;
  const key = threeSceneSignature();
  if (key === threeSceneKey && !pendingCameraFrame) {
    refreshSelectionBoxes();
    return;
  }
  threeSceneKey = key;
  buildThreeScene();
}

// 選択の枠だけを付け直す
function refreshSelectionBoxes(): void {
  for (const helper of planGroup.children.filter((object) => object instanceof THREE.BoxHelper)) {
    planGroup.remove(helper);
    collectDisposables(helper, pendingDisposal);
  }
  buildSelection = new Set(selectedEntities().map((item) => item.id));
  try {
    for (const object of [...planGroup.children]) {
      const id = object.userData.selectionTarget;
      if (typeof id === "string" && buildSelection.has(id)) addSelectionBox(object, id);
    }
  } finally {
    buildSelection = null;
  }
  threeNeedsRender = true;
}

function buildThreeScene(): void {
  threeNeedsRender = true;
  renderer.shadowMap.needsUpdate = true;
  disposeGroup(planGroup);
  modelCacheRound += 1;
  buildSelection = new Set(selectedEntities().map((item) => item.id));
  try {
    buildThreeObjects();
  } finally {
    buildSelection = null;
  }
  trimModelCache();
}

function buildThreeObjects(): void {
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

  liftSmallItems();
  state.roofs.forEach((roofItem) => addRoof3d(roofItem, center));
  if (threeStyle === "real") addRealGround(bounds, center);
  else addSubtleGrid(bounds, center);
  if (threeStyle === "real") realizeMaterials(planGroup, true);
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
  if (roomItem.outline || roomItem.holes || laterRooms.some(room => room.outline || room.holes)) {
    const polygons = visibleFloorPolygons(roomItem.outline || roomItem.holes ? roomItem : footprint(roomItem), laterRooms.map(room => room.outline || room.holes ? room : footprint(room)));
    const top = ground ? 0.08 : yBase;
    for (const polygon of polygons) {
      const path = (ring: [number, number][]) => ring.map(([x, y]) => new THREE.Vector2((x - center.x) * SCALE_3D, -(y - center.y) * SCALE_3D));
      const shape = new THREE.Shape(path(polygon[0]));
      polygon.slice(1).forEach(ring => shape.holes.push(new THREE.Path(path(ring))));
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
      const pos = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
      for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) / SCALE_3D + center.x - roomItem.x) / roomItem.w, 1 - (-pos.getY(i) / SCALE_3D + center.y - roomItem.y) / roomItem.h);
      geometry.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geometry, [roomMaterial(roomItem, roomItem), side]);
      mesh.position.y = top - thickness;
      mesh.receiveShadow = true;
      mesh.castShadow = floorIndex > 0 && alpha >= 1;
      group.add(mesh);
    }
    if (polygons.length && roomItem.surface === "grass") addGrass3d(roomItem, roomItem, center, top, state.floors[floorIndex].entities, polygons);
  } else for (const rect of visibleRectangles(footprint(roomItem), laterRooms.map(footprint))) {
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

// 草の束の置き場所と色の作り置き。部屋・範囲・草を生やさない物が同じなら、前に決めた置き場所をそのまま使う
const grassCache = new Map<string, { matrices: Float32Array; colors: Float32Array; count: number; used: number }>();
let grassTuftGeometry: THREE.BufferGeometry | null = null;

function addGrass3d(roomItem: Room, rect: Rectangle, center: Point, top: number, entities: Entity[], polygons?: ReturnType<typeof visibleFloorPolygons>): void {
  const count = Math.min(GRASS_MAX_TUFTS, Math.round(((rect.w * rect.h) / 10000) * GRASS_TUFTS_PER_M2));
  if (count <= 0) return;
  const bareItems = entities.filter((entity): entity is Furniture => entity.type === "furniture" && GRASS_FREE_KINDS.includes(entity.kind));
  const key = JSON.stringify([roomItem.id, roomItem.color, roomItem.color3d, rect.x, rect.y, rect.w, rect.h, top, center.x, center.y, polygons ?? null,
    bareItems.map((item) => [item.kind, item.x, item.y, item.w, item.h, item.rotation, item.path, item.brush])]);
  let placement = grassCache.get(key);
  if (!placement) {
    placement = { ...placeGrass(roomItem, rect, center, top, bareItems, count, polygons ? multiPolygonTester(polygons) : undefined), used: 0 };
    grassCache.set(key, placement);
  }
  placement.used = modelCacheRound;
  if (!placement.count) return;
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, vertexColors: true, side: THREE.DoubleSide, name: "grass-blades" });
  makeTranslucent(material, colorAlpha(roomItem.color3d ?? roomItem.color));
  if (!grassTuftGeometry) {
    grassTuftGeometry = createGrassTuftGeometry();
    cachedResources.add(grassTuftGeometry);
  }
  const mesh = new THREE.InstancedMesh(grassTuftGeometry, material, placement.count);
  mesh.instanceMatrix.array.set(placement.matrices);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(placement.colors.slice(), 3);
  // 草は見た目だけ。クリックが下の床に届くよう、当たり判定から外す
  mesh.raycast = () => {};
  mesh.receiveShadow = true;
  planGroup.add(mesh);
}

// 草の束の置き場所と色を決める。草を生やさない物の上と、範囲（穴のある床の形）の外には置かない
function placeGrass(roomItem: Room, rect: Rectangle, center: Point, top: number, bareItems: Furniture[], count: number, within?: (x: number, y: number) => boolean): { matrices: Float32Array; colors: Float32Array; count: number } {
  const bare = bareItems.map((item) => {
    // 自由な形は、形そのもの（川や小道は帯の上）。ほかは家具の回転を戻した座標で、池は楕円、それ以外は長方形の内側かどうかを見る。
    // 草の束ごとに道すじを計算し直さないよう、調べ方は先に1回だけ作り、家具の外側の点はすぐに外す
    const angle = degreesToRadians(-item.rotation), cos = Math.cos(angle), sin = Math.sin(angle);
    const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
    const ex = (Math.abs(cos) * item.w + Math.abs(sin) * item.h) / 2, ey = (Math.abs(sin) * item.w + Math.abs(cos) * item.h) / 2;
    const onShape = isFreeShapeItem(item) ? freeShapeTester(item, 0) : null;
    return (x: number, y: number) => {
      const dx = x - cx, dy = y - cy;
      if (Math.abs(dx) > ex || Math.abs(dy) > ey) return false;
      if (onShape) return onShape({ x, y });
      const lx = (dx * cos - dy * sin) / (item.w / 2);
      const ly = (dx * sin + dy * cos) / (item.h / 2);
      return item.kind === "pond" ? lx * lx + ly * ly <= 1 : Math.abs(lx) <= 1 && Math.abs(ly) <= 1;
    };
  });
  const isBare = (x: number, y: number) => bare.some((test) => test(x, y));
  const matrices = new Float32Array(count * 16), colors = new Float32Array(count * 3);
  // 描き直すたびに草の位置が変わらないよう、部屋と範囲から決まる乱数を使う
  const random = seededRandom(`${roomItem.id}:${Math.round(rect.x)}:${Math.round(rect.y)}`);
  const base = new THREE.Color(solidColor(roomItem.color3d ?? roomItem.color));
  const tint = new THREE.Color();
  const placement = new THREE.Object3D();
  let placed = 0;
  for (let i = 0; i < count; i += 1) {
    const x = rect.x + random() * rect.w, y = rect.y + random() * rect.h;
    if (isBare(x, y) || (within && !within(x, y))) continue;
    const position = to3d(x, y, center);
    placement.position.set(position.x, top, position.z);
    placement.rotation.set(0, random() * Math.PI * 2, 0);
    const spread = 0.8 + random() * 0.6;
    placement.scale.set(spread, 0.05 + random() * 0.08, spread);
    placement.updateMatrix();
    placement.matrix.toArray(matrices, placed * 16);
    tint.copy(base).offsetHSL((random() - 0.5) * 0.04, 0, (random() - 0.5) * 0.1).toArray(colors, placed * 3);
    placed += 1;
  }
  return { matrices: matrices.slice(0, placed * 16), colors: colors.slice(0, placed * 3), count: placed };
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
  const info = wallInfoOf(wallItem);
  // 厚みを変えたふつうの壁は、2Dと同じく端を厚みの半分だけ伸ばす（角がすき間なくつながる）
  const extend = wallItem.thickness !== undefined;
  const length = distance(wallItem);
  const top = info.height !== undefined ? Math.min(WALL_HEIGHT, info.height * SCALE_3D) : WALL_HEIGHT;
  wallSections(wallItem, entities).forEach((section) => {
    // 石垣などは、床から立つ部分だけを、その区切りの線に沿った自由な形で作る（ドアの所はあく）
    if (info.freeKind) {
      if (section.bottom <= 1e-6) addFurniture3d(freeWallItem(wallItem, info, section.from, section.to), center, yBase);
      return;
    }
    if (section.bottom >= top - 1e-6) return;
    const segment = segmentInterval(wallItem, section.from, section.to);
    if (info.value === "plain") addStraightWall3d(segment, center, yBase, wallItem.id, true, section.bottom, section.top, withCap, info.thickness, extend && section.from <= 1e-6, extend && section.to >= length - 1e-6);
    else addStyledWall3d(segment, info, wallItem, center, yBase, section.bottom, Math.min(section.top, top), section.from <= 1e-6, section.to >= length - 1e-6);
  });
}

// 種類のある壁の3D: 厚み・高さ・色の箱（壁の端は2Dと同じく厚みの半分だけ伸ばす）と、土塀の瓦の笠
const tileCapMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(CAP_COLOR), roughness: 0.7, name: "roof-tile-cap" });
const wallStyleMaterials = new Map<string, THREE.MeshStandardMaterial>();
function wallStyleMaterial(info: WallStyleInfo, color: string): THREE.MeshStandardMaterial {
  const key = `${info.value}-${color}`;
  const cached = wallStyleMaterials.get(key);
  if (cached) return cached;
  // 名前は、リアルの絵柄で材質の模様を決めるのに使う（レンガ・ブロック・コンクリートは石、板塀は木、土塀は漆喰、ガラス）
  const name = info.glass ? "glass-wall" : info.value === "wood" ? "wall-wood-plank" : info.value === "earthen" ? "plaster-earthen" : `wall-${info.value}`;
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(solidColor(color)), roughness: info.glass ? 0.08 : 0.85, name });
  if (info.glass) {
    material.transparent = true;
    material.opacity = 0.35;
    material.depthWrite = false;
  } else makeTranslucent(material, colorAlpha(color));
  wallStyleMaterials.set(key, material);
  return material;
}

function addStyledWall3d(segment: LinearElement, info: WallStyleInfo, wallItem: LinearElement, center: Point, yBase: number, yFrom: number, yTo: number, extendStart: boolean, extendEnd: boolean): void {
  const angle = Math.atan2(segment.y2 - segment.y1, segment.x2 - segment.x1);
  const bottomExtension = yBase > floorBaseY(0) + 1e-6 && yFrom === 0 ? FLOOR_SLAB : 0;
  const height = yTo - yFrom + bottomExtension;
  const box = (width: number, boxHeight: number, y: number, material: THREE.Material) => {
    // 端を伸ばす長さ（cm）。伸ばしたぶん中心をずらす
    const ext0 = extendStart ? width / 2 : 0, ext1 = extendEnd ? width / 2 : 0;
    const length = distance(segment) + ext0 + ext1;
    if (length <= 2 || boxHeight <= 0.02) return;
    const mid = midpoint(segment), shift = (ext1 - ext0) / 2;
    const pos = to3d(mid.x + Math.cos(angle) * shift, mid.y + Math.sin(angle) * shift, center);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(length * SCALE_3D, boxHeight, width * SCALE_3D), material);
    mesh.position.set(pos.x, y, pos.z);
    mesh.rotation.y = -angle;
    mesh.castShadow = !(material as THREE.MeshStandardMaterial).transparent;
    mesh.receiveShadow = true;
    markSelectable(mesh, wallItem.id);
    planGroup.add(mesh);
    addSelectionBox(mesh, wallItem.id);
  };
  box(info.thickness, height, yBase + yFrom - bottomExtension + height / 2, wallStyleMaterial(info, wallItem.color3d ?? wallItem.color ?? info.color));
  // 瓦の笠: 壁の上に、両側へ張り出した薄い板と棟（真上から見ると、2Dの笠と同じ幅）
  if (info.cap && info.height !== undefined && yTo >= info.height * SCALE_3D - 1e-6) {
    box(wallTopWidth(info), 0.05, yBase + yTo + 0.025, tileCapMaterial);
    box(8, 0.06, yBase + yTo + 0.08, tileCapMaterial);
  }
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
  thicknessCm = WALL_THICKNESS_2D,
  extendStart = false,
  extendEnd = false,
): void {
  // 端を伸ばす長さ（cm）。伸ばしたぶん中心をずらす
  const ext0 = extendStart ? thicknessCm / 2 : 0, ext1 = extendEnd ? thicknessCm / 2 : 0;
  const length = (distance(wallItem) + ext0 + ext1) * SCALE_3D;
  // 上階の壁は床スラブの厚みぶん下へ延長し、下階の壁と外面が連続するようにする
  // いちばん下の階でなければ、下の階の壁の上端まで伸ばす（地下があるときの1Fも同じ）
  const bottomExtension = yBase > floorBaseY(0) + 1e-6 && yFrom === 0 ? FLOOR_SLAB : 0;
  const height = yTo - yFrom + bottomExtension;
  if (length <= 0.02 || height <= 0.02) return;
  const thickness = thicknessCm * SCALE_3D;
  const angle = Math.atan2(wallItem.y2 - wallItem.y1, wallItem.x2 - wallItem.x1);
  const customWallColor = wallItem.color3d ?? wallItem.color;
  const bodyMaterial = customWallColor ? coloredMaterial(customWallColor, 0.78) : wallMaterial;
  const geometry = new THREE.BoxGeometry(length, height, thickness);
  const mesh = new THREE.Mesh(geometry, bodyMaterial);
  const mid = midpoint(wallItem), shift = (ext1 - ext0) / 2;
  const pos = to3d(mid.x + Math.cos(angle) * shift, mid.y + Math.sin(angle) * shift, center);
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
  const start = shape.kind === "arc" ? shape.startAngle : 0;
  const sweep = shape.kind === "arc" ? normalizeAngle(shape.endAngle - shape.startAngle) : Math.PI * 2;
  const segmentCount = Math.min(2048, Math.max(12, Math.ceil((Math.max(shape.r, shapeRadiusY(shape)) * sweep) / 24)));
  for (let index = 0; index < segmentCount; index += 1) {
    const a1 = start + (sweep * index) / segmentCount;
    const a2 = start + (sweep * (index + 1)) / segmentCount;
    const p1 = shapePoint(shape, a1), p2 = shapePoint(shape, a2);
    const segment: LinearElement = {
      id: shape.id,
      type: "wall",
      x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
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
  const options = { ...item, type: item.type, length: distance(item) * SCALE_3D, floorTop: yBase === 0 ? 0.08 : 0 };
  const { type, doorStyle, color, color3d, flip, floorTop, length, mullion } = options;
  const key = JSON.stringify([threeStyle === "real", type, doorStyle, color, color3d, flip, floorTop, length, mullion]);
  const group = cachedModel(`opening:${key}`, () => buildOpeningModel(options));
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
  const options = { ...furnitureItem, rise: FLOOR_SPACING - floorTop };
  let group: THREE.Group;
  if (furnitureItem.kind === "evidenceMarker" || furnitureItem.kind === "paint" || furnitureItem.kind === "image") {
    // 文字・描いた絵・取り込んだ画像を貼る物は、1つずつ作る
    group = buildFurnitureModel(options);
    if (furnitureItem.kind === "evidenceMarker") applyMarkerLabel(group, furnitureItem);
    else if (furnitureItem.kind === "image") applyImageTexture(group, furnitureItem);
    else applyPaintTexture(group, furnitureItem);
  } else {
    // 形を決める値が同じ家具は、作り置きを写して使う（リアルの絵柄では材質を変えるので分ける）
    const { kind, w, h, color, color3d, rise, height, symbol, path, holes, stride, brush, density, pose } = options;
    const key = JSON.stringify([threeStyle === "real", kind, w, h, color, color3d, rise, height, symbol, path, holes, stride, brush, density, pose]);
    group = cachedModel(`furniture:${key}`, () => buildFurnitureModel(options));
  }
  placeFurniture3d(group, furnitureItem, center, yBase);
  if (furnitureItem.flip) group.scale.x *= -1;
  markSelectable(group, furnitureItem.id);
  planGroup.add(group);
  addSelectionBox(group, furnitureItem.id);
}

function placeFurniture3d(group: THREE.Object3D, furnitureItem: Furniture, center: Point, yBase: number): void {
  const floorTop = yBase === 0 ? 0.08 : 0;
  const pos = to3d(furnitureItem.x + furnitureItem.w / 2, furnitureItem.y + furnitureItem.h / 2, center);
  group.position.set(pos.x, yBase + floorTop + smallItemLift(furnitureItem, yBase + floorTop), pos.z);
  group.rotation.y = (-furnitureItem.rotation * Math.PI) / 180;
}

// 机やテーブルの上に置く小物（鍵・メモ・ノートPCなど）。3Dでは、2Dで重ねて置いた家具の上にのせる
const SMALL_ITEM_KINDS = new Set<FurnitureKind>(MORE_SMALL_KINDS);
// 上にのせない物（人や動物、床に貼る物）
const NO_SUPPORT_KINDS = new Set<FurnitureKind>(["person", "fallenPerson", "rug", "paint", "image", "bloodPool", "footprints", "brokenGlass", "evidenceMarker"]);

// 小物の真下にある家具の、いちばん上の高さ（床から m）。なければ 0
function smallItemLift(item: Furniture, floorY: number): number {
  if (!SMALL_ITEM_KINDS.has(item.kind)) return 0;
  const floor = state.floors.find((candidate) => candidate.entities.includes(item));
  if (!floor) return 0;
  const center = { x: item.x + item.w / 2, y: item.y + item.h / 2 };
  let top = 0;
  for (const other of floor.entities) {
    if (other.type !== "furniture" || other === item || SMALL_ITEM_KINDS.has(other.kind) || NO_SUPPORT_KINDS.has(other.kind)) continue;
    if (isMorePartKind(other.kind) && MORE_DEFS[other.kind].group === "creatures") continue;
    const [lx, ly] = worldToFurnitureLocal(other, center);
    if (Math.abs(lx) > other.w / 2 || Math.abs(ly) > other.h / 2) continue;
    for (const object of planGroup.children) {
      if (object.userData.entityId !== other.id || object.userData.ignoreSelection) continue;
      top = Math.max(top, new THREE.Box3().setFromObject(object).max.y - floorY);
    }
  }
  return top;
}

// 作り直しの終わりに、小物を下の家具の上へのせ直す（下の家具が小物より後に作られることもあるため）
function liftSmallItems(): void {
  for (const object of planGroup.children) {
    const id = object.userData.entityId;
    if (typeof id !== "string" || object.userData.ignoreSelection) continue;
    const item = findEntity(id);
    if (item?.type !== "furniture" || !SMALL_ITEM_KINDS.has(item.kind)) continue;
    const floorIndex = state.floors.findIndex((floor) => floor.entities.includes(item));
    if (floorIndex < 0) continue;
    const floorY = floorBaseY(floorIndex) + floorTopOffset(floorIndex);
    object.position.y = floorY + smallItemLift(item, floorY);
  }
  planGroup.children.forEach((object) => { if (object instanceof THREE.BoxHelper) object.update(); });
}

// ---- 2Dでドラッグしている間も、3Dをすぐ合わせる ----
// 家具は、その家具の3Dだけを動かす（大きさを変えたときは、その家具だけ作り直す）ので軽い。
// 壁・床・屋根・階段など、ほかの物の形に響く物は3D全体を作り直す。作り直しが重い間取りでは、そのぶん間を空ける
let threeDragRefreshAt = 0;
let threeDragRefreshCost = 0;

function syncThreeWhileDragging(entities: Entity[], rebuild = false): void {
  if (PLAN_EDITION || viewMode === "plan" || !entities.length) return;
  if (entities.every((entity) => entity.type === "furniture" && !isStair(entity))) {
    // シーンを作り直さずに変えるので、次の作り直しは省かない
    threeSceneKey = null;
    renderer.shadowMap.needsUpdate = true;
    for (const entity of entities as Furniture[]) {
      const floorIndex = state.floors.findIndex((floor) => floor.entities.includes(entity));
      if (floorIndex < 0 || hiddenFloorIds.has(state.floors[floorIndex].id)) continue;
      const objects = planGroup.children.filter((object) => object.userData.entityId === entity.id && !object.userData.ignoreSelection);
      if (rebuild) {
        removeThreeObjects(entity.id);
        addFurniture3d(entity, threeSceneCenter, floorBaseY(floorIndex));
        if (threeStyle === "real") realizeMaterials(planGroup, true);
      } else objects.forEach((object) => placeFurniture3d(object, entity, threeSceneCenter, floorBaseY(floorIndex)));
    }
    planGroup.children.forEach((object) => { if (object instanceof THREE.BoxHelper) object.update(); });
    threeNeedsRender = true;
    return;
  }
  // 前の作り直しにかかった時間の数倍は空ける（軽い間取りでは毎フレーム）
  const now = performance.now();
  if (now - threeDragRefreshAt < threeDragRefreshCost * 3) return;
  threeDragRefreshAt = now;
  requestAnimationFrame(() => {
    const start = performance.now();
    rebuildThreeScene();
    threeDragRefreshCost = performance.now() - start;
  });
}

// その物の3D（選択の枠も）をシーンから外して捨てる。ほかの物と共有している材質と、作り置きの物は残す
function removeThreeObjects(entityId: string): void {
  const objects = planGroup.children.filter((object) => object.userData.entityId === entityId && !object.userData.ignoreSelection);
  const helpers = planGroup.children.filter((object) => object instanceof THREE.BoxHelper && objects.includes(object.object));
  const shared = new Set<object>(coloredMaterialCache.values());
  const disposables = new Set<{ dispose(): void }>();
  for (const object of [...objects, ...helpers]) {
    planGroup.remove(object);
    object.traverse((child) => collectDisposables(child, disposables));
  }
  disposables.forEach((item) => { if (!shared.has(item)) pendingDisposal.add(item); });
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

// 屋根の材質。色を決めていなければ、ほかの屋根と同じ材質を使う。透明度があれば透かし、影を落とさない
function roofMaterialFor(roofItem: Roof): THREE.MeshStandardMaterial {
  if (!roofItem.color) return roofMaterial;
  const key = `roof-${roofItem.color}`;
  const cached = coloredMaterialCache.get(key);
  if (cached) return cached;
  const material = roofMaterial.clone();
  material.color.set(solidColor(roofItem.color));
  makeTranslucent(material, colorAlpha(roofItem.color));
  coloredMaterialCache.set(key, material);
  return material;
}

function addRoof3d(roofItem: Roof, center: Point): void {
  if (!roofVisible3d) return;
  const material = roofMaterialFor(roofItem);
  const opaque = colorAlpha(roofItem.color) >= 1;
  const topIndex = roofItem.floorId ? state.floors.findIndex((floor) => floor.id === roofItem.floorId) : state.floors.length - 1;
  if (topIndex < 0 || hiddenFloorIds.has(state.floors[topIndex].id)) return;
  const width = roofItem.w * SCALE_3D;
  const depth = roofItem.h * SCALE_3D;
  const pos = to3d(roofItem.x + roofItem.w / 2, roofItem.y + roofItem.h / 2, center);
  const topY = floorBaseY(topIndex) + WALL_HEIGHT + 0.06 + roofElevation(roofItem.elevation) * SCALE_3D;

  if (isRadialRoof(roofItem.kind)) {
    const model = radialRoofModel(roofItem, material);
    if (!opaque) model.traverse((object) => { object.castShadow = false; });
    model.scale.setScalar(SCALE_3D);
    model.position.set(pos.x, topY, pos.z);
    markSelectable(model, roofItem.id);
    planGroup.add(model);
    addSelectionBox(model, roofItem.id);
    return;
  }

  if (roofItem.kind === "flat") {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.16, depth), material);
    mesh.position.set(pos.x, topY + 0.08, pos.z);
    mesh.castShadow = opaque;
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
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(pos.x, topY, pos.z);
  if (depth > width) {
    mesh.rotation.y = Math.PI / 2;
  }
  mesh.castShadow = opaque;
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
  // 選択が変わったときに枠だけを付け直せるよう、枠を付ける物に印を付けておく
  object.userData.selectionTarget = entityId;
  if (!(buildSelection ? buildSelection.has(entityId) : selectedEntities().some((item) => item.id === entityId))) return;
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
  const material = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.8, name: "ground" });
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
  let buildingHeight = (state.floors.length - basementCount()) * FLOOR_SPACING;
  // 高さを指定できる屋根は、実際に表示中のモデルの先端まで収める。
  const radialIds = new Set(state.roofs.filter(roof => isRadialRoof(roof.kind)).map(roof => roof.id));
  for (const object of planGroup.children) {
    if (radialIds.has(object.userData.entityId) && !object.userData.ignoreSelection) buildingHeight = Math.max(buildingHeight, new THREE.Box3().setFromObject(object).max.y);
  }
  const rect = threeCanvas.getBoundingClientRect();
  const aspect = rect.height > 0 ? rect.width / rect.height : 1;
  const portraitScale = aspect < 1 ? 1 / Math.max(aspect, 0.1) : 1;
  const distanceToFit = clamp(Math.max(size * 1.4 * portraitScale, buildingHeight * 2.2), 6, MAX_CAMERA_DISTANCE / 2);
  camera.position.set(distanceToFit * 0.9, distanceToFit * 0.72, distanceToFit);
  controls.target.set(0, Math.min(buildingHeight * 0.32, 2.4), 0);
  controls.update();
}

function render3dOnce(): void {
  const rect = threeCanvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    flushDisposal();
    return;
  }
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  // 寄ったときに手前が切れず、引いたときに奥が消えないよう、見える範囲をカメラの距離に合わせる
  const distance = camera.position.distanceTo(controls.target);
  camera.near = clamp(distance * 0.002, 0.0005, 0.1);
  camera.far = Math.max(distance * 200, 1000);
  camera.updateProjectionMatrix();
  controls.update();
  renderThreeView();
  threeNeedsRender = false;
  // 作り直す前の形・材質は、作り直した物を描いた後で捨てる
  flushDisposal();
}

// ---- 3Dの絵柄 ----
// 標準とリアルは、そのまま描く。ほかは、色（白模型は白い材質で）と、法線・奥行きを別に描いてから、
// 画面全体に効果（three-style.ts の POST_FRAGMENT_SHADER）をかけて描き直す
interface ThreePost {
  color: THREE.WebGLRenderTarget;
  normal: THREE.WebGLRenderTarget;
  material: THREE.ShaderMaterial;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  quad: THREE.Mesh;
  normalMaterial: THREE.MeshNormalMaterial;
  clayMaterial: THREE.MeshStandardMaterial;
  // リアル: 明るさの幅を残した色（半精度の浮動小数）と、物の間の暗がり（半分の大きさ）
  realColor: THREE.WebGLRenderTarget | null;
  ao: THREE.WebGLRenderTarget;
  aoMaterial: THREE.ShaderMaterial;
  realMaterial: THREE.ShaderMaterial;
}
let threePost: ThreePost | null = null;
let realEnvironment: THREE.Texture | null = null;
let realSky: THREE.Texture | null = null;
const STANDARD_BACKGROUND = new THREE.Color(0xe9edf3);
// リアルの空の地平線の色（遠くのかすみも同じ色）
const REAL_HORIZON = 0xe2e9ee;

function ensureThreePost(width: number, height: number): ThreePost {
  if (!threePost) {
    const color = new THREE.WebGLRenderTarget(width, height, { samples: 4, colorSpace: THREE.SRGBColorSpace });
    const normal = new THREE.WebGLRenderTarget(width, height);
    normal.depthTexture = new THREE.DepthTexture(width, height);
    const material = new THREE.ShaderMaterial({
      vertexShader: POST_VERTEX_SHADER,
      fragmentShader: POST_FRAGMENT_SHADER,
      uniforms: {
        tColor: { value: color.texture },
        tNormal: { value: normal.texture },
        tDepth: { value: normal.depthTexture },
        resolution: { value: new THREE.Vector2(width, height) },
        cameraNear: { value: camera.near },
        cameraFar: { value: camera.far },
        pixelRatio: { value: 1 },
        styleId: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    material.uniforms.focusDistance = { value: 10 };
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    const postScene = new THREE.Scene();
    postScene.add(quad);
    // 半精度の浮動小数の絵に描けない環境では、リアルは暗がりなしで直接描く
    const floatColor = renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float");
    const ao = new THREE.WebGLRenderTarget(Math.max(1, width >> 1), Math.max(1, height >> 1));
    const aoMaterial = new THREE.ShaderMaterial({
      vertexShader: POST_VERTEX_SHADER,
      fragmentShader: AO_FRAGMENT_SHADER,
      uniforms: {
        tNormal: { value: normal.texture },
        tDepth: { value: normal.depthTexture },
        resolution: { value: new THREE.Vector2(width >> 1, height >> 1) },
        cameraNear: { value: camera.near },
        cameraFar: { value: camera.far },
        projScale: { value: new THREE.Vector2(1, 1) },
        radius: { value: 0.5 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const realColor = floatColor ? new THREE.WebGLRenderTarget(width, height, { samples: 4, type: THREE.HalfFloatType }) : null;
    const realMaterial = new THREE.ShaderMaterial({
      vertexShader: POST_VERTEX_SHADER,
      fragmentShader: REAL_COMPOSITE_FRAGMENT_SHADER,
      uniforms: {
        tColor: { value: realColor?.texture ?? null },
        tAo: { value: ao.texture },
        tDepth: { value: normal.depthTexture },
        aoTexel: { value: new THREE.Vector2(1 / Math.max(1, width >> 1), 1 / Math.max(1, height >> 1)) },
        cameraNear: { value: camera.near },
        cameraFar: { value: camera.far },
        strength: { value: 0.85 },
      },
      depthTest: false,
      depthWrite: false,
    });
    threePost = {
      color, normal, material, scene: postScene, quad,
      camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
      normalMaterial: new THREE.MeshNormalMaterial({ side: THREE.DoubleSide }),
      clayMaterial: new THREE.MeshStandardMaterial({ color: 0xf1eee8, roughness: 0.88, side: THREE.DoubleSide }),
      realColor, ao, aoMaterial, realMaterial,
    };
  }
  if (threePost.color.width !== width || threePost.color.height !== height) {
    threePost.color.setSize(width, height);
    threePost.normal.setSize(width, height);
    threePost.realColor?.setSize(width, height);
    threePost.ao.setSize(Math.max(1, width >> 1), Math.max(1, height >> 1));
  }
  return threePost;
}

function renderThreeView(): void {
  const distance = camera.position.distanceTo(controls.target);
  if (threeStyle === "real" && scene.fog instanceof THREE.Fog) {
    // 遠くのかすみは、見ている物より十分奥から。地面の端（500m先）は空の色に溶けきる
    scene.fog.near = distance * 2;
    scene.fog.far = Math.min(distance * 8 + 80, 450);
  }
  if (!isPostStyle(threeStyle) && threeStyle !== "real") {
    renderer.render(scene, camera);
    return;
  }
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const post = ensureThreePost(size.x, size.y);
  if (threeStyle === "real" && !post.realColor) {
    renderer.render(scene, camera);
    return;
  }
  // 線（壁の縁・方眼・選択の枠）と、透けて見える物（ガラスなど）は、法線と奥行きの絵には入れない
  const hidden: THREE.Object3D[] = [];
  scene.traverse((object) => {
    if (!object.visible) return;
    const mesh = object as THREE.Mesh;
    const lineLike = (object as THREE.Line).isLine || (object as THREE.Points).isPoints || (object as THREE.Sprite).isSprite;
    const materials = mesh.isMesh ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
    const seeThrough = materials.length > 0 && materials.every((material) => !material.visible || (material.transparent && material.opacity < 0.75));
    if (lineLike || seeThrough) hidden.push(object);
  });
  const background = scene.background;
  const clearColor = renderer.getClearColor(new THREE.Color());
  const clearAlpha = renderer.getClearAlpha();
  const autoShadow = renderer.shadowMap.autoUpdate;
  const model = threeStyle === "model";
  try {
    // 1. 色（白模型は、すべて白い材質で。ガラスや線は入れない。リアルは明るさの幅を残して）
    if (model) {
      scene.overrideMaterial = post.clayMaterial;
      hidden.forEach((object) => (object.visible = false));
    }
    renderer.setRenderTarget(threeStyle === "real" ? post.realColor : post.color);
    renderer.render(scene, camera);
    // 2. 法線と奥行き
    hidden.forEach((object) => (object.visible = false));
    scene.overrideMaterial = post.normalMaterial;
    scene.background = null;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(post.normal);
    renderer.setClearColor(0x8080ff, 1);
    renderer.clear();
    renderer.render(scene, camera);
  } finally {
    hidden.forEach((object) => (object.visible = true));
    scene.overrideMaterial = null;
    scene.background = background;
    renderer.shadowMap.autoUpdate = autoShadow;
    renderer.setClearColor(clearColor, clearAlpha);
    renderer.setRenderTarget(null);
  }
  if (threeStyle === "real") {
    // 3. 物の間の暗がり → 4. 色に掛けて、トーンマッピングして画面へ
    const ao = post.aoMaterial.uniforms;
    ao.resolution.value.set(post.ao.width, post.ao.height);
    ao.cameraNear.value = camera.near;
    ao.cameraFar.value = camera.far;
    ao.projScale.value.set(camera.projectionMatrix.elements[0], camera.projectionMatrix.elements[5]);
    // 暗がりを探す範囲は、寄っているときは狭く、引いているときは広く（部屋の隅・家具の下が暗くなる程度）
    ao.radius.value = clamp(distance * 0.04, 0.12, 1.2);
    post.quad.material = post.aoMaterial;
    renderer.setRenderTarget(post.ao);
    renderer.render(post.scene, post.camera);
    renderer.setRenderTarget(null);
    const real = post.realMaterial.uniforms;
    real.aoTexel.value.set(1 / post.ao.width, 1 / post.ao.height);
    real.cameraNear.value = camera.near;
    real.cameraFar.value = camera.far;
    post.quad.material = post.realMaterial;
    renderer.render(post.scene, post.camera);
    post.quad.material = post.material;
    return;
  }
  // 3. 効果をかけて画面へ
  const uniforms = post.material.uniforms;
  uniforms.resolution.value.set(size.x, size.y);
  uniforms.cameraNear.value = camera.near;
  uniforms.cameraFar.value = camera.far;
  uniforms.pixelRatio.value = renderer.getPixelRatio();
  uniforms.focusDistance.value = distance;
  uniforms.styleId.value = postStyleId(threeStyle);
  renderer.render(post.scene, post.camera);
}

// リアルの空（上は青く、地平線に向かって明るく白っぽく）
function realSkyTexture(): THREE.Texture {
  if (realSky) return realSky;
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "#8fb6dd");
    gradient.addColorStop(0.55, "#c4d8ea");
    gradient.addColorStop(1, "#e2e9ee");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 4, 256);
  }
  realSky = new THREE.CanvasTexture(canvas);
  realSky.colorSpace = THREE.SRGBColorSpace;
  return realSky;
}

// リアルの地面（方眼の代わり）。遠くはかすみに溶ける
function addRealGround(bounds: Bounds | null, center: Point): void {
  const size = Math.max(500, (bounds ? Math.max(bounds.w, bounds.h) * SCALE_3D : 10) * 6);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(size, 96),
    new THREE.MeshStandardMaterial({ color: 0xcfc9bd, roughness: 0.95, name: "concrete-ground" }),
  );
  ground.rotation.x = -Math.PI / 2;
  const middle = to3d(center.x, center.y, center);
  ground.position.set(middle.x, -0.004, middle.z);
  ground.receiveShadow = true;
  ground.userData.ignoreSelection = true;
  planGroup.add(ground);
}

// リアル: トーンマッピングと周りの映り込み、細かい影、家具・設備の材質の模様と光り方
function applyThreeStyle(rebuild = true): void {
  const real = threeStyle === "real";
  renderer.toneMapping = real ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  renderer.toneMappingExposure = real ? 0.95 : 1;
  if (real && !realEnvironment) {
    const generator = new THREE.PMREMGenerator(renderer);
    realEnvironment = generator.fromScene(new RoomEnvironment(), 0.04).texture;
    generator.dispose();
  }
  scene.environment = real ? realEnvironment : null;
  scene.environmentIntensity = 0.06;
  scene.background = real ? realSkyTexture() : STANDARD_BACKGROUND;
  scene.fog = real ? new THREE.Fog(REAL_HORIZON, 30, 200) : null;
  const shadowSize = real ? 4096 : 2048;
  if (sunLight.shadow.mapSize.x !== shadowSize) {
    sunLight.shadow.mapSize.set(shadowSize, shadowSize);
    sunLight.shadow.map?.dispose();
    sunLight.shadow.map = null;
  }
  applyLightSettings();
  // 方眼と地面を入れ替えるため作り直す（作り直しの中で、材質も本物らしくする）。起動のときは、あとの最初の作り直しに任せる
  if (rebuild) rebuildThreeScene();
  if (!real) realizeMaterials(planGroup, false);
  threeNeedsRender = true;
}

// 材質を本物らしくする（on=false で元に戻す）。材質の名前から木・布・金属などに分け、模様と光り方をシェーダーに足す
function realizeMaterials(root: THREE.Object3D, on: boolean): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      if (on) makeMaterialReal(material);
      else if (material.userData.realKind) {
        delete material.userData.realKind;
        Reflect.deleteProperty(material, "onBeforeCompile");
        Reflect.deleteProperty(material, "customProgramCacheKey");
        material.needsUpdate = true;
      }
    }
  });
}

function makeMaterialReal(material: THREE.MeshStandardMaterial): void {
  if (material.userData.realKind) return;
  const kind = realMaterialKind(material.name, material.color.getHex(), material.roughness, material.metalness, material.transparent);
  material.userData.realKind = kind;
  // 床など、すでに模様（画像）を持つ物は、光り方だけ変える
  const colorCode = material.map ? "" : realColorCode(kind);
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${REAL_VERTEX_DECLARATIONS}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${REAL_VERTEX_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${REAL_FRAGMENT_DECLARATIONS}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${colorCode}`)
      .replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>\n${realSurfaceCode(kind)}`);
  };
  material.customProgramCacheKey = () => `real-${kind}-${colorCode ? "pattern" : "plain"}`;
  material.needsUpdate = true;
}

function setupThreeStyle(): void {
  const select = document.querySelector<HTMLSelectElement>("#threeStyleSelect");
  if (!select) return;
  select.innerHTML = THREE_STYLE_GROUPS.map((group) => `<optgroup label="${escapeHtml(group)}">${THREE_STYLES.filter((style) => style.group === group)
    .map(({ value, label, hint }) => `<option value="${value}" title="${escapeHtml(hint)}">${escapeHtml(label)}</option>`).join("")}</optgroup>`).join("");
  select.value = threeStyle;
  select.addEventListener("change", () => {
    if (!isThreeStyle(select.value)) return;
    threeStyle = select.value;
    viewState.look3d = threeStyle;
    scheduleViewStateSave();
    applyThreeStyle();
  });
  applyThreeStyle(false);
}

function animate3d(): void {
  requestAnimationFrame(animate3d);
  if (viewMode === "plan" || document.hidden) return;
  controls.update();
  if (threeNeedsRender) render3dOnce();
}

function redrawAll(rebuild = true): void {
  render2d();
  if (rebuild) rebuildThreeScene();
  updateUi();
}

function updateUi(): void {
  syncFloorEditing();
  syncThreeMoveMode();
  syncToolHint();
  scheduleViewStateSave();
  renderGhostFloorOptions();
  updateStats();
  updatePropertiesPanel();
  renderFloorTabs();
  renderFloorVisibility();
  renderRoofList();
  updateRoofToggle2d();
  syncHistoryButtons();
}

function syncHistoryButtons(): void {
  document.querySelector<HTMLButtonElement>("#undoButton")?.toggleAttribute("disabled", isPointDrafting() && floorDraft ? !floorDraft.points.length : activeTool === "floor" ? true : historyIndex <= 0);
  document.querySelector<HTMLButtonElement>("#redoButton")?.toggleAttribute("disabled", isPointDrafting() && floorDraft ? !floorDraft.undone.length : activeTool === "floor" ? true : historyIndex >= history.length - 1);
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

// まとめて選んだ物の内訳（「部屋・床 2・壁 5・家具 8」など）
function describeSelection(entities: Entity[]): string {
  const names: [string, Entity["type"]][] = [["部屋・床", "room"], ["壁", "wall"], ["ドア", "door"], ["窓", "window"], ["家具", "furniture"], ["図形の壁", "shape"], ["屋根", "roof"], ["文字", "text"]];
  return names.map(([name, type]) => [name, entities.filter((entity) => entity.type === type).length] as const)
    .filter(([, count]) => count > 0).map(([name, count]) => `${name} ${count}`).join("・");
}

// 点を打って描くときの案内（直線・曲線）
function drawPointsHint(label: string, closed: boolean): string {
  const curve = currentDrawMethod() === "curve";
  const drag = curve || activeTool === "floor" ? "" : closed ? "ドラッグすると四角になります。" : "ドラッグすると1本の直線になります。";
  const how = curve ? "点を通るなめらかな曲線でつなぎます" : "点と点をまっすぐにつなぎます";
  return closed
    ? `${label}: 2Dをクリックして点を打つと、${how}。最初の点を押すと閉じて${label}になります（Enter でも閉じます。Backspace で1点戻す）。${drag}`
    : `${label}: 2Dをクリックして点を打つと、${how}。Enter かダブルクリックで描き終えます（Backspace で1点戻す）。${drag}`;
}

function updatePropertiesPanel(): void {
  if (activeTool === "floor") {
    propertiesPanel.innerHTML = `<div class="property-grid"><p class="empty-state">${drawPointsHint("床", true)}</p>${drawMethodHtml()}${surfacePickerHtml("draftSurfacePicker", activeRoomSurface)}</div>`;
    bindDrawMethod();
    bindSurfacePicker("#draftSurfacePicker", (value) => {
      activeRoomSurface = value;
      syncPlanCursor();
      updatePropertiesPanel();
    });
    return;
  }
  const members = selectedEntities();
  if (members.length > 1) {
    const locked = members.filter(isLocked).length;
    propertiesPanel.innerHTML = `<div class="property-grid">
      <p class="selection-count">${members.length}件選択中${locked ? `（固定 ${locked}件）` : ""}</p>
      <p class="empty-state">${escapeHtml(describeSelection(members))}。選んだ物のどれかをドラッグするとまとめて動き、矢印キーでも少しずつ動かせます。</p>
      <label class="check"><input id="selectionLockedInput" type="checkbox" ${locked === members.length ? "checked" : ""} />配置を固定（L）</label>
      <div class="two-col">
        <button type="button" class="prop-button" id="selectionRotateButton" title="選択全体を90度回転（R）" ${locked === members.length ? "disabled" : ""}><i data-lucide="rotate-cw"></i>90°回転</button>
        <button type="button" class="prop-button" id="selectionDuplicateButton" title="選択を複製（Ctrl / Cmd+D）"><i data-lucide="copy"></i>複製</button>
      </div>
      <button type="button" class="prop-button danger-button" id="selectionDeleteButton" ${locked === members.length ? "disabled" : ""}><i data-lucide="trash-2"></i>選択を削除（Delete）</button>
      <button type="button" class="prop-button" id="selectionClearButton"><i data-lucide="x"></i>選択を解除（Esc）</button>
    </div>`;
    requiredElement("#selectionRotateButton").addEventListener("click", () => {
      rotateSelection(members);
      commitState();
      redrawAll();
    });
    requiredElement("#selectionDuplicateButton").addEventListener("click", () => placeCopies(members, GRID * 2, GRID * 2));
    const checkbox = requiredElement<HTMLInputElement>("#selectionLockedInput");
    checkbox.indeterminate = locked > 0 && locked < members.length;
    checkbox.addEventListener("change", () => {
      members.forEach((item) => { item.locked = checkbox.checked; });
      commitState();
      redrawAll();
    });
    requiredElement("#selectionDeleteButton").addEventListener("click", deleteSelection);
    requiredElement("#selectionClearButton").addEventListener("click", () => { selectOnly(null); redrawAll(); });
    createIcons({ icons });
    return;
  }
  const selected = state.selectedId ? findEntity(state.selectedId) : null;
  if (!selected && activeTool === "paint") {
    const kind = penSettings.kind;
    const hint = kind === "paint"
      ? "ペン: 2Dの上をドラッグすると、この色で描けます。クリックで点、「囲んで塗る」なら囲んだ所を塗りつぶします。"
      : isFreeAreaKind(kind)
        ? `ペンで${FURNITURE_DEFS[kind].label}: 2Dをドラッグで囲むと、その形になります（クリックだけなら、いつもの形）。`
        : `ペンで${FURNITURE_DEFS[kind].label}: 2Dをなぞると、その道すじに沿って描けます（クリックだけなら、まっすぐ）。`;
    const method = currentDrawMethod();
    propertiesPanel.innerHTML = `<div class="property-grid">
        <p class="empty-state">${method === "brush" && kind !== "paint" ? brushHint(FURNITURE_DEFS[kind].label) : method !== "trace" ? drawPointsHint(kind === "paint" ? "ペン" : FURNITURE_DEFS[kind].label, kind === "paint" ? penSettings.filled : isFreeAreaKind(kind)) : hint}</p>
        ${penKindHtml()}
        ${drawMethodHtml()}
        ${kind === "paint" ? penControlsHtml("pen", penSettings.color, penSettings.brush, penSettings.filled) : penShapeWidthHtml(kind)}
      </div>`;
    bindPenControls();
    bindDrawMethod();
    return;
  }
  // 壁のツール: 次に描く壁の種類を絵で選ぶ
  if (!selected && activeTool === "wall") {
    propertiesPanel.innerHTML = `<div class="property-grid">
        <p class="empty-state">${escapeHtml(wallStyleInfo(activeWallStyle).label)}: 2Dをドラッグすると、この種類の壁を描きます。</p>
        ${wallStylePickerHtml("wallToolStylePicker", activeWallStyle)}
      </div>`;
    bindWallStylePicker("#wallToolStylePicker", (style) => {
      activeWallStyle = style;
      syncPlanCursor();
      updatePropertiesPanel();
    });
    return;
  }
  // 床（部屋のツール）と、なぞれる物（池・川・足跡など）を置くとき: 描き方を選べる
  if (!selected && (activeTool === "room" || (activeTool === "furniture" && isTraceableKind(activeFurniture)))) {
    const label = activeTool === "room" ? "床" : FURNITURE_DEFS[activeFurniture].label;
    const area = activeTool === "room" || (isFreeShapeKind(activeFurniture) && isFreeAreaKind(activeFurniture));
    const hint = isBrushing() ? brushHint(label)
      : activeTool === "room"
        ? "床: 2Dを斜めにドラッグすると四角、ぐるっとなぞるとその形の床になります。"
        : currentDrawMethod() !== "trace" ? drawPointsHint(label, area) : `${label}: ${area ? "2Dをドラッグで囲むと、その形になります（クリックだけなら、いつもの形）。" : "2Dをなぞると、その道すじに沿って置けます（クリックだけなら、まっすぐ）。"}`;
    propertiesPanel.innerHTML = `<div class="property-grid">
        <p class="empty-state">${hint}</p>
        ${drawMethodHtml()}
        ${activeTool === "room" ? surfacePickerHtml("roomToolSurfacePicker", activeRoomSurface) : ""}
      </div>`;
    bindDrawMethod();
    bindSurfacePicker("#roomToolSurfacePicker", (value) => {
      activeRoomSurface = value;
      syncPlanCursor();
      updatePropertiesPanel();
    });
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
    const radial = isRadialRoof(selected.kind), polygon = selected.kind === "polygon";
    const diameter = radial && Math.abs(selected.w - selected.h) < 0.01;
    propertiesPanel.innerHTML = `
      <div class="property-grid">
        ${lockRow}
        <p class="empty-state">屋根 ${roofIndex + 1}</p>
        <label>設置階<select id="roofFloorInput" ${placementDisabled}>${state.floors.map((floor) => `<option value="${escapeHtml(floor.id)}" ${floor.id === (selected.floorId ?? state.floors[state.floors.length - 1].id) ? "selected" : ""}>${floor.name}</option>`).join("")}</select></label>
        <label>上げ下げ cm<input id="roofElevationInput" type="number" min="${-ROOF_ELEVATION_LIMIT}" max="${ROOF_ELEVATION_LIMIT}" step="10" value="${roofElevation(selected.elevation)}" title="設置階の壁の上から、屋根を置く高さをずらす（下げるとマイナス）" ${placementDisabled} /></label>
        <label>種類
          <select id="roofKindInput" ${placementDisabled}>
            ${Object.entries(ROOF_LABELS).map(([kind, label]) => `<option value="${kind}" ${selected.kind === kind ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        ${polygon ? `<div class="two-col"><label>辺の数<input id="roofSidesInput" type="number" min="3" max="12" step="1" value="${roofSides(selected.sides)}" ${placementDisabled} /></label><label>向き °<input id="roofRotationInput" type="number" step="1" value="${selected.rotation ?? 0}" ${placementDisabled} /></label></div>` : ""}
        ${diameter ? diameterControl("roof", selected.w, placementDisabled, polygon ? "外接円の直径 cm" : "直径 cm") : ""}
        ${polygon ? "" : `<div class="two-col">
          <label>幅 cm<input id="roofWInput" type="number" min="40" step="${radial ? 1 : 20}" value="${selected.w}" ${placementDisabled} /></label>
          <label>奥行 cm<input id="roofHInput" type="number" min="40" step="${radial ? 1 : 20}" value="${selected.h}" ${placementDisabled} /></label>
        </div>`}
        ${radial ? `<label>屋根の高さ cm<input id="roofRiseInput" type="number" min="10" max="2000" step="1" value="${selected.rise ?? ""}" placeholder="自動（${Math.round(roofRise(selected))}）" ${placementDisabled} /></label>` : ""}
        ${colorField("roofColorInput", "色", selected.color ?? ROOF_COLORS[0][0])}
        <div class="pen-colors roof-colors" role="group" aria-label="屋根の色の見本">${ROOF_COLORS.map(([value, label]) => `<button type="button" class="pen-color${(parseColorCode(selected.color)?.rgb ?? ROOF_COLORS[0][0]) === value ? " is-active" : ""}" data-roof-color="${value}" title="${label}" aria-label="${label}" style="--pen-color: ${value}"></button>`).join("")}</div>
        <div class="two-col">
          <label>位置 X<input id="roofXInput" type="number" step="20" value="${selected.x}" ${placementDisabled} /></label>
          <label>位置 Y<input id="roofYInput" type="number" step="20" value="${selected.y}" ${placementDisabled} /></label>
        </div>
        <button type="button" class="prop-button" id="roofRotateButton" ${placementDisabled}><i data-lucide="rotate-cw"></i>${polygon ? "90°回転" : "幅と奥行を入れ替える"}</button>
        <button type="button" class="prop-button danger-button" id="roofDeleteButton" ${placementDisabled}>この屋根を削除</button>
      </div>
    `;
    bindEntityLock(selected);
    bindSelect("#roofFloorInput", (value) => {
      if (state.floors.some((floor) => floor.id === value)) selected.floorId = value;
    });
    bindNumber("#roofElevationInput", (value) => { selected.elevation = roofElevation(value) || undefined; });
    bindSelect("#roofKindInput", (value) => {
      if (!isRoofKind(value)) return;
      selected.kind = value;
      if (value === "polygon") { Object.assign(selected, regularRoofSize(selected)); selected.sides = roofSides(selected.sides); selected.rotation ??= 0; }
    });
    if (diameter) bindDiameter("roof", selected, () => selected.w, value => Object.assign(selected, regularRoofSize(selected, value)));
    bindNumber("#roofWInput", value => { const w = Math.max(GRID * 2, radial ? value : snap(value)); if (radial) Object.assign(selected, centeredFloorSize(selected, w, selected.h)); else selected.w = w; });
    bindNumber("#roofHInput", value => { const h = Math.max(GRID * 2, radial ? value : snap(value)); if (radial) Object.assign(selected, centeredFloorSize(selected, selected.w, h)); else selected.h = h; });
    bindNumber("#roofSidesInput", value => { selected.sides = roofSides(value); });
    bindNumber("#roofRotationInput", value => { selected.rotation = ((value % 360) + 360) % 360; });
    bindInput("#roofRiseInput", value => { selected.rise = value.trim() && Number.isFinite(Number(value)) ? clamp(Number(value), 10, 2000) : undefined; });
    // 標準の色を選んだら、色を持たない（ほかの屋根と同じ材質）に戻す。見本を選び直しても透明度は残す
    const setRoofColor = (value: string | undefined) => { selected.color = value && value !== ROOF_COLORS[0][0] ? value : undefined; };
    bindColor("#roofColorInput", setRoofColor);
    propertiesPanel.querySelectorAll<HTMLButtonElement>("[data-roof-color]").forEach((button) => button.addEventListener("click", () => {
      setRoofColor(withAlpha(button.dataset.roofColor ?? ROOF_COLORS[0][0], colorAlpha(selected.color)));
      commitState();
      redrawAll();
    }));
    bindNumber("#roofXInput", (value) => (selected.x = snap(value)));
    bindNumber("#roofYInput", (value) => (selected.y = snap(value)));
    bindButton("#roofRotateButton", () => rotateEntity(selected, 90));
    bindButton("#roofDeleteButton", () => {
      removeEntityById(selected.id);
      state.selectedId = null;
    });
    createIcons({ icons });
    return;
  }

  if (selected.type === "room") {
    const editing = floorEdit?.id === selected.id;
    const round = isEllipseFloor(selected) && Math.abs(selected.w - selected.h) < 0.01;
    const polygon = regularFloor(selected);
    propertiesPanel.innerHTML = `
      <div class="property-grid">
        ${lockRow}
        <div class="floor-shapes" role="group" aria-label="床の形">
          ${(["rectangle", "circle", "ellipse", "polygon", "l"] as FloorPreset[]).map(preset => { const label = { rectangle: "長方形", circle: "円", ellipse: "楕円", polygon: "正多角形", l: "L字" }[preset]; return `<button type="button" data-floor-preset="${preset}" title="${label}の床に変更" aria-label="${label}" aria-pressed="${floorPreset(selected) === preset}" ${placementDisabled}><canvas width="88" height="64"></canvas></button>`; }).join("")}
        </div>
        <div class="two-col">
          <button type="button" class="prop-button" id="floorRetraceButton" aria-pressed="${floorRetraceId === selected.id}" title="床の形を、2Dをなぞって描き直す" ${placementDisabled}><i data-lucide="pen-line"></i>なぞり直す</button>
          <button type="button" class="prop-button" id="floorEditToggle" aria-pressed="${editing}" ${placementDisabled}><i data-lucide="${editing ? "check" : "square-pen"}"></i>${editing ? "輪郭の編集を完了" : "輪郭を編集"}</button>
        </div>
        ${editing && floorEdit?.vertex != null ? `<div class="floor-vertices"><div class="vertex-heading"><span>頂点 ${floorEdit.vertex + 1}</span><button class="prop-button" type="button" id="floorVertexAdd" title="次の辺に頂点を追加" aria-label="頂点を追加" ${placementDisabled}><i data-lucide="plus"></i></button><button class="prop-button" type="button" id="floorVertexRemove" title="選択した頂点を削除" aria-label="頂点を削除" ${placementDisabled}><i data-lucide="minus"></i></button></div>
          <div class="two-col"><label>X cm<input id="floorVertexX" type="number" step="1" ${placementDisabled} /></label><label>Y cm<input id="floorVertexY" type="number" step="1" ${placementDisabled} /></label></div></div>` : ""}
        ${round && !editing ? diameterControl("floor", selected.w, placementDisabled) : ""}
        ${polygon && !editing ? `<div class="two-col"><label>辺の数<input id="floorSidesInput" type="number" min="3" max="12" step="1" value="${polygon.sides}" ${placementDisabled} /></label><label>向き °<input id="floorRotationInput" type="number" step="1" value="${Math.round(polygon.rotation * 100) / 100}" ${placementDisabled} /></label></div>${diameterControl("floor", polygon.diameter, placementDisabled, "外接円の直径 cm")}` : ""}
        <div class="two-col">
          <label>幅 cm<input id="roomWInput" type="number" min="40" step="1" value="${Math.round((polygon?.w ?? selected.w) * 10) / 10}" ${placementDisabled} /></label>
          <label>奥行 cm<input id="roomHInput" type="number" min="40" step="1" value="${Math.round((polygon?.h ?? selected.h) * 10) / 10}" ${placementDisabled} /></label>
        </div>
        ${surfacePickerHtml("roomSurfacePicker", selected.surface ?? "plain")}
        <label>名前<input id="roomNameInput" value="${escapeHtml(selected.name)}" placeholder="なし" /></label>
        <label>文字サイズ cm<input id="roomLabelSizeInput" type="number" min="5" max="500" step="1" value="${selected.labelSize ?? ""}" placeholder="自動" ${placementDisabled} /></label>
        ${writingModeControl(selected.writingMode, placementDisabled)}
        ${colorField("roomColorInput", "色 2D", selected.color)}
        ${PLAN_EDITION ? "" : colorField("roomColor3dInput", "色 3D", selected.color3d ?? selected.color)}
        <button type="button" class="prop-button" id="roomRotateButton" ${placementDisabled}>90°回転（Rキー）</button>
      </div>
    `;
    bindEntityLock(selected);
    bindInput("#roomNameInput", (value) => (selected.name = value));
    bindInput("#roomLabelSizeInput", (value) => { selected.labelSize = value.trim() && Number.isFinite(Number(value)) ? clamp(Number(value), 5, 500) : undefined; });
    bindWritingMode(selected);
    bindFloorShapeControls(selected);
    if (round && !editing) bindDiameter("floor", selected, () => selected.w, value => Object.assign(selected, centeredFloorSize(selected, value, value)));
    if (polygon && !editing) {
      bindDiameter("floor", selected, () => regularFloor(selected)!.diameter, value => Object.assign(selected, regularFloorSize(selected, value)));
      bindNumber("#floorSidesInput", value => changeRegularFloor(selected, regularFloorSides(value), regularFloor(selected)!.rotation));
      bindNumber("#floorRotationInput", value => changeRegularFloor(selected, regularFloor(selected)!.sides, value));
    }
    bindFloorVertices(selected);
    bindSurfacePicker("#roomSurfacePicker", (value) => {
      selected.surface = value;
      // 床材を変えても、カラーコードで決めた透明度はそのまま
      selected.color3d = withAlpha(SURFACE_DEFS[value].color, colorAlpha(selected.color3d ?? selected.color));
      selected.color = withAlpha(SURFACE_DEFS[value].color, colorAlpha(selected.color));
      commitState();
      redrawAll();
    });
    bindNumber("#roomWInput", value => { const w = Math.max(GRID * 2, value), p = regularFloor(selected); if (p) Object.assign(selected, regularFloorSize(selected, p.diameter * w / p.w)); else if (isEllipseFloor(selected)) Object.assign(selected, centeredFloorSize(selected, w, selected.h)); else selected.w = w; });
    bindNumber("#roomHInput", value => { const h = Math.max(GRID * 2, value), p = regularFloor(selected); if (p) Object.assign(selected, regularFloorSize(selected, p.diameter * h / p.h)); else if (isEllipseFloor(selected)) Object.assign(selected, centeredFloorSize(selected, selected.w, h)); else selected.h = h; });
    bindColor("#roomColorInput", (value) => (selected.color = value ?? SURFACE_DEFS[selected.surface ?? "plain"].color));
    bindColor("#roomColor3dInput", (value) => (selected.color3d = value));
    bindButton("#roomRotateButton", () => rotateEntity(selected, 90));
    return;
  }

  if (isLinear(selected)) {
    const doorInfo = doorStyleInfo(selected.doorStyle);
    const slidingDoor = selected.type === "door" && doorInfo.sliding;
    const typeLabel = selected.type === "wall" ? "壁" : selected.type === "door" ? doorInfo.label : "窓";
    const default3d = selected.type === "wall" ? "#f4f1ec" : selected.type === "door" ? DOOR_COLORS[doorInfo.value] : "#dfe5ea";
    const doorStyleRow =
      selected.type === "door"
        ? `<label>扉の種類
            <select id="doorStyleInput" ${placementDisabled}>
              ${DOOR_STYLES.map((style) => `<option value="${style.value}" ${style.value === doorInfo.value ? "selected" : ""}>${escapeHtml(style.label)}</option>`).join("")}
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
        ${selected.type === "wall" ? wallStylePickerHtml("wallStylePicker", selected.wallStyle ?? "plain", placementDisabled) : ""}
        ${selected.type === "wall" ? wallThicknessHtml(selected, placementDisabled) : ""}
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
    bindSelect("#doorStyleInput", (value) => {
      if (!isDoorStyle(value) || value === "swing") delete selected.doorStyle;
      else selected.doorStyle = value;
    });
    bindWallStylePicker("#wallStylePicker", (style) => {
      if (isLocked(selected)) return;
      if (style === "plain") delete selected.wallStyle;
      else selected.wallStyle = style;
      // 種類を変えたら、その種類の標準の厚みに戻す
      delete selected.thickness;
      activeWallStyle = style;
      commitState();
      redrawAll();
    });
    bindWallThickness(selected);
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
        ${writingModeControl(label.writingMode, placementDisabled)}
        <div class="two-col">
          <label>大きさ cm<input id="textSizeInput" type="number" min="5" max="500" step="2" value="${label.size}" ${placementDisabled} /></label>
          <label>回転 °<input id="textRotationInput" type="number" step="5" value="${label.rotation}" ${placementDisabled} /></label>
        </div>
        ${colorField("textColorInput", "色", label.color ?? INK, placementDisabled)}
      </div>
    `;
    bindEntityLock(label);
    bindWritingMode(label);
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
            <option value="ellipse" ${selectedShape.kind === "ellipse" ? "selected" : ""}>楕円</option>
            <option value="arc" ${selectedShape.kind === "arc" ? "selected" : ""}>円弧</option>
            <option value="polygon" ${selectedShape.kind === "polygon" ? "selected" : ""}>多角形</option>
          </select>
        </label>
        ${selectedShape.kind !== "ellipse" ? diameterControl("shape", selectedShape.r * 2, placementDisabled) : ""}
        ${selectedShape.kind === "circle" || selectedShape.kind === "ellipse" ? `<div class="two-col"><label>幅 cm<input id="shapeWInput" type="number" min="40" step="1" value="${selectedShape.r * 2}" ${placementDisabled} /></label><label>奥行 cm<input id="shapeHInput" type="number" min="40" step="1" value="${shapeRadiusY(selectedShape) * 2}" ${placementDisabled} /></label></div>` : ""}
        ${arcRows}
        ${polygonRows}
        ${colorField("shapeColorInput", "色 2D", selectedShape.color ?? INK)}
        ${PLAN_EDITION ? "" : colorField("shapeColor3dInput", "色 3D", selectedShape.color3d ?? selectedShape.color ?? "#f4f1ec")}
        <button type="button" class="prop-button" id="shapeFloorButton" ${placementDisabled}><i data-lucide="layers"></i>この図形に合わせて床を追加</button>
      </div>
    `;
    bindEntityLock(selectedShape);
    bindButton("#shapeFloorButton", () => floorFromShape(selectedShape));
    createIcons({ icons });
    bindSelect("#shapeKindInput", (value) => {
      selectedShape.kind = value as ShapeKind;
      if (selectedShape.kind === "ellipse") selectedShape.ry ??= Math.max(GRID, selectedShape.r * 0.6);
      if (selectedShape.kind === "circle") {
        selectedShape.ry = undefined;
        selectedShape.startAngle = 0;
        selectedShape.endAngle = Math.PI * 2;
      }
      if (selectedShape.kind === "polygon") {
        selectedShape.sides = selectedShape.sides ?? 6;
        selectedShape.rotation = selectedShape.rotation ?? 0;
      }
    });
    if (selectedShape.kind !== "ellipse") bindDiameter("shape", selectedShape, () => selectedShape.r * 2, value => { selectedShape.r = value / 2; });
    const setAxes = (w: number, h: number) => {
      selectedShape.r = Math.max(GRID, w / 2);
      const ry = Math.max(GRID, h / 2);
      selectedShape.kind = Math.abs(selectedShape.r - ry) < 0.001 ? "circle" : "ellipse";
      selectedShape.ry = selectedShape.kind === "ellipse" ? ry : undefined;
    };
    bindNumber("#shapeWInput", value => setAxes(value, shapeRadiusY(selectedShape) * 2));
    bindNumber("#shapeHInput", value => setAxes(selectedShape.r * 2, value));
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
  const kindOptions = [...FURNITURE_GROUPS, { label: "階段", kinds: STAIR_KINDS }].map(
    (category) =>
      `<optgroup label="${category.label}">` +
      category.kinds
        .map((kind) => `<option value="${kind}" ${kind === selectedFurniture.kind ? "selected" : ""}>${FURNITURE_DEFS[kind].label}</option>`)
        .join("") +
      `</optgroup>`,
  ).join("");
  const defaultHeight = FURNITURE_DEFS[selectedFurniture.kind].height;
  const duplicateStair = isStair(selectedFurniture) && stairsBelow(state.floors, state.activeFloor).some((item) => sameStairPlacement(selectedFurniture, item));
  const minimumHeight = isPartKind(selectedFurniture.kind) ? 1 : MIN_FURNITURE_HEIGHT;
  const markerRow = selectedFurniture.kind === "evidenceMarker"
    ? `<label>番号（印に書く文字。${MAX_MARKER_LABEL}文字まで）<input id="markerLabelInput" value="${escapeHtml(selectedFurniture.markerLabel ?? "")}" maxlength="${MAX_MARKER_LABEL}" autocomplete="off" /></label>`
    : "";
  const heightRow = defaultHeight !== undefined && !PLAN_EDITION
    ? `<label>高さ cm<input id="furnitureHeightInput" type="number" min="${minimumHeight}" max="${MAX_FURNITURE_HEIGHT}" step="${isPartKind(selectedFurniture.kind) ? 1 : 10}" value="${selectedFurniture.height ?? defaultHeight}" ${placementDisabled} /></label>`
    : "";
  // 2Dの記号だけのデザインは、3Dが標準の形のままになることを名前に添える
  const only2d = FURNITURE_VARIANTS_2D_ONLY[selectedFurniture.kind] ?? [];
  const symbolLabels = ["標準", ...(SYMBOL_VARIANTS[selectedFurniture.kind] ?? []).map((variant, index) => (only2d.includes(index + 1) ? `${variant.label}（2Dの記号のみ・3Dは標準）` : variant.label))];
  const currentSymbol = selectedFurniture.symbol ?? 0;
  // 取り込んだ画像は、大きさ・濃さ・向き・重なりの順だけを変える
  if (selectedFurniture.kind === "image") {
    propertiesPanel.innerHTML = `<div class="property-grid">
        ${lockRow}
        <p class="empty-state">画像</p>
        ${imageEditorHtml(selectedFurniture, placementDisabled)}
        <label>回転（R: 90° / Shift+R: 15°）<input id="furnitureRotationInput" type="number" step="5" value="${selectedFurniture.rotation}" ${placementDisabled} /></label>
        <label class="check"><input id="furnitureFlipInput" type="checkbox" ${selectedFurniture.flip ? "checked" : ""} ${placementDisabled} /> 左右反転（Fキー）</label>
        ${orderRowHtml()}
      </div>`;
    bindEntityLock(selectedFurniture);
    bindOrderButtons(selectedFurniture);
    bindImageEditor(selectedFurniture);
    bindNumber("#furnitureRotationInput", (value) => (selectedFurniture.rotation = value % 360));
    bindCheckbox("#furnitureFlipInput", (checked) => (selectedFurniture.flip = checked));
    return;
  }
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
      ${duplicateStair ? `<button type="button" class="prop-button" id="useLowerStairButton" title="この階の重複した階段を削除し、下階の階段を2Dに表示します。取り消し可能です" ${placementDisabled}><i data-lucide="arrow-down-to-line"></i>下階の階段表示に切り替え</button>` : ""}
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
      ${isFreeShapeKind(selectedFurniture.kind) ? freeShapeEditorHtml(selectedFurniture, placementDisabled) : ""}
      <label>回転（R: 90° / Shift+R: 15°）<input id="furnitureRotationInput" type="number" step="5" value="${selectedFurniture.rotation}" ${placementDisabled} /></label>
      <label class="check"><input id="furnitureFlipInput" type="checkbox" ${selectedFurniture.flip ? "checked" : ""} ${placementDisabled} /> 左右反転（Fキー）</label>
      ${orderRowHtml()}
      ${colorField("furnitureColorInput", "色 2D", selectedFurniture.color ?? MARK_FILLS[selectedFurniture.kind] ?? INK)}
      ${PLAN_EDITION ? "" : colorField("furnitureColor3dInput", "色 3D", selectedFurniture.color3d ?? selectedFurniture.color ?? "#b9c0c8")}
    </div>
  `;
  bindEntityLock(selectedFurniture);
  bindOrderButtons(selectedFurniture);
  propertiesPanel.querySelector<HTMLButtonElement>("#useLowerStairButton")?.addEventListener("click", () => {
    if (isLocked(selectedFurniture) || !isStair(selectedFurniture)
      || !stairsBelow(state.floors, state.activeFloor).some((item) => sameStairPlacement(selectedFurniture, item))) return;
    removeEntityById(selectedFurniture.id);
    selectOnly(null);
    commitState();
    redrawAll();
  });
  if (duplicateStair) createIcons({ icons });
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
  if (isFreeShapeKind(selectedFurniture.kind)) bindFreeShapeEditor(selectedFurniture);
  bindNumber("#furnitureHeightInput", (value) => {
    const height = clamp(Math.round(value), minimumHeight, MAX_FURNITURE_HEIGHT);
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

// 重なりの順（最前面へ・最背面へ）。見た目の順なので、配置を固定していても変えられる
function orderRowHtml(): string {
  return `<div class="two-col">
      <button type="button" class="prop-button" id="bringFrontButton" title="重なっている物より手前（上）に描く">最前面へ</button>
      <button type="button" class="prop-button" id="sendBackButton" title="重なっている物より奥（下）に描く">最背面へ</button>
    </div>`;
}

function bindOrderButtons(entity: Entity): void {
  bindButton("#bringFrontButton", () => moveEntityOrder(entity, true));
  bindButton("#sendBackButton", () => moveEntityOrder(entity, false));
}

// 同じ階の並びの最後（いちばん手前）か最初（いちばん奥）へ移す
function moveEntityOrder(entity: Entity, front: boolean): void {
  const entities = activeEntities();
  const index = entities.indexOf(entity);
  if (index < 0) return;
  entities.splice(index, 1);
  if (front) entities.push(entity);
  else entities.unshift(entity);
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
  const bounds = getEntitiesBounds([...activeEntities(), ...incomingStairs(state.floors, state.activeFloor), ...state.roofs]) ?? getGlobalBounds();
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

function deleteSelection(): void {
  const members = selectedEntities().filter((item) => !isLocked(item));
  if (!members.length) return;
  members.forEach((item) => removeEntityById(item.id));
  selectOnly(null);
  commitState();
  redrawAll();
}

function commitState(refreshUi = true): void {
  history = history.slice(0, historyIndex + 1);
  history.push(cloneState(state));
  if (history.length > HISTORY_LIMIT) {
    history.shift();
  } else {
    historyIndex += 1;
  }
  persistState();
  if (refreshUi) updateUi();
  else syncHistoryButtons();
}

function replaceState(next: PlanState, pushHistory: boolean): void {
  floorDraft = null;
  floorEdit = null;
  floorEditError = "";
  threeMoveId = null;
  multiSelection.clear();
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
  if (activeTool === "floor" || (isPointDrafting() && floorDraft?.points.length)) { undoFloorPoint(); return; }
  if (historyIndex <= 0) return;
  const ids = selectedEntities().map((item) => item.id), floorId = activeFloor().id;
  historyIndex -= 1;
  state = cloneState(history[historyIndex]);
  restoreHistorySelection(ids, floorId);
  persistState();
  redrawAll();
}

function redo(): void {
  if (activeTool === "floor" || (isPointDrafting() && floorDraft?.undone.length)) { redoFloorPoint(); return; }
  if (historyIndex >= history.length - 1) return;
  const ids = selectedEntities().map((item) => item.id), floorId = activeFloor().id;
  historyIndex += 1;
  state = cloneState(history[historyIndex]);
  restoreHistorySelection(ids, floorId);
  persistState();
  redrawAll();
}

function restoreHistorySelection(ids: string[], floorId: string): void {
  multiSelection.clear();
  if (floorId !== activeFloor().id || !ids.length) return;
  const visible = new Set([...activeEntities(), ...state.roofs].map((item) => item.id));
  selectMany(ids.filter((id) => visible.has(id)));
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

// ---- 更新履歴 ----

// 左の「更新履歴」に、新しい順に日付と変わった所を並べる。見出しの横には最新の日付
function setupChangelog(): void {
  const list = document.querySelector<HTMLDivElement>("#changelogList");
  const latest = document.querySelector<HTMLSpanElement>("#changelogLatest");
  if (!list) return;
  // 日本語以外では、英語の文を出す
  const english = getLanguage() !== "ja";
  list.innerHTML = CHANGELOG.map((entry) => `
    <section class="changelog-day">
      <h3><time datetime="${entry.date}">${formatDate(entry.date)}</time></h3>
      <ul>${entry.items.map((item) => `<li>${escapeHtml(english ? item.en : item.ja)}</li>`).join("")}</ul>
    </section>`).join("");
  if (latest && CHANGELOG[0]) latest.textContent = `最新 ${formatDate(CHANGELOG[0].date, false)}`;
}

// ---- 言語 ----
// 上のバーの「言語」。選ぶと画面の文字をその言語にし、ブラウザに覚える（src/i18n.ts）
function setupLanguageSelect(): void {
  const select = document.querySelector<HTMLSelectElement>("#languageSelect");
  if (!select) return;
  select.value = getLanguage();
  select.addEventListener("change", () => {
    if (isLanguage(select.value)) void setLanguage(select.value);
  });
  onLanguageChange((language) => {
    select.value = language;
    // 更新履歴は言語ごとの文を持つので作り直す。2Dに描く文字（部屋の広さなど）も描き直す
    setupChangelog();
    applyPaletteSearch();
    render2d();
  });
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
  const cell = document.querySelector<HTMLSelectElement>("#imageExportCell");
  const transparent = document.querySelector<HTMLInputElement>("#imageExportTransparent");
  if (!button || !menu || !floors || !grid || !names || !cell || !transparent) return;
  const saved = viewState.imageExport;
  if (saved && typeof saved === "object") {
    if (saved.floors === "current" || saved.floors === "all" || saved.floors === "each") imageExportSettings.floors = saved.floors;
    if (typeof saved.grid === "boolean") imageExportSettings.grid = saved.grid;
    if (typeof saved.names === "boolean") imageExportSettings.names = saved.names;
    if (typeof saved.cell === "number" && EXPORT_CELLS.includes(saved.cell)) imageExportSettings.cell = saved.cell;
    if (typeof saved.transparent === "boolean") imageExportSettings.transparent = saved.transparent;
  }
  floors.value = imageExportSettings.floors;
  grid.checked = imageExportSettings.grid;
  names.checked = imageExportSettings.names;
  cell.value = String(imageExportSettings.cell);
  transparent.checked = imageExportSettings.transparent;
  const remember = () => {
    imageExportSettings.floors = floors.value as ImageExportSettings["floors"];
    imageExportSettings.grid = grid.checked;
    imageExportSettings.names = names.checked;
    imageExportSettings.cell = EXPORT_CELLS.includes(Number(cell.value)) ? Number(cell.value) : 0;
    imageExportSettings.transparent = transparent.checked;
    viewState.imageExport = { ...imageExportSettings };
    scheduleViewStateSave();
  };
  [floors, grid, names, cell, transparent].forEach((input) => input.addEventListener("change", remember));
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
  document.querySelector<HTMLButtonElement>("#imageExportCopy")?.addEventListener("click", () => {
    remember();
    close();
    copyPlanImage();
  });
}

// 間取りの画像を、クリップボードにコピーする（階ごとにするときは表示中の階）
function copyPlanImage(): void {
  const floorIndexes = imageExportSettings.floors === "all" ? state.floors.map((_, index) => index).filter((index) => exportBounds([index])) : [state.activeFloor];
  const bounds = exportBounds(floorIndexes);
  const notify = (text: string) => {
    saveStatus.textContent = text;
    window.setTimeout(() => (saveStatus.textContent = "保存済み"), 2000);
  };
  if (!bounds || !floorIndexes.length) {
    notify("書き出す物がありません");
    return;
  }
  const canvas = renderPlanImage(floorIndexes, bounds);
  canvas.toBlob(async (blob) => {
    if (!blob || !navigator.clipboard || typeof ClipboardItem === "undefined") {
      notify("このブラウザでは画像をコピーできません。書き出してください");
      return;
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      notify("画像をコピーしました");
    } catch {
      notify("画像をコピーできませんでした。書き出してください");
    }
  }, "image/png");
}

// 書き出す階の、物が入る範囲（屋根は含めない）
function exportBounds(floorIndexes: number[]): Bounds | null {
  const entities = floorIndexes.flatMap((index) => [...state.floors[index].entities, ...incomingStairs(state.floors, index)]);
  const bounds = getEntitiesBounds(entities);
  if (!bounds || !imageExportSettings.names) return bounds;
  // 大きくした部屋名が床からはみ出しても、画像の端で切らない。
  for (const room of entities.filter(isRoom)) {
    if (!room.labelSize || !room.name.trim()) continue;
    const pos = getRoomLabelPosition(room), label = measureLabel(room.name, room.labelSize, room.writingMode);
    const right = Math.max(bounds.x + bounds.w, pos.x + label.w), bottom = Math.max(bounds.y + bounds.h, pos.y + label.h + roomDetailLines(room).length * 20);
    bounds.x = Math.min(bounds.x, pos.x); bounds.y = Math.min(bounds.y, pos.y);
    bounds.w = right - bounds.x; bounds.h = bottom - bounds.y;
  }
  return bounds;
}

// 1つの階を、書き出し用のキャンバスの (left, top) から描く。選択の枠・ほかの階の透過・屋根・固定の印は描かない
function drawFloorForExport(target: CanvasRenderingContext2D, floorIndex: number, bounds: Bounds, left: number, top: number, ratio: number, zoom: number): void {
  const selection = [...multiSelection], originalSelectionFloor = selectionFloor;
  const saved = { ctx, view: { ...view }, activeFloor: state.activeFloor, selectedId: state.selectedId, hideRoomNames };
  const width = (bounds.w + EXPORT_MARGIN * 2) * zoom;
  const height = (bounds.h + EXPORT_MARGIN * 2) * zoom;
  ctx = target;
  view = { zoom, x: (EXPORT_MARGIN - bounds.x) * zoom, y: (EXPORT_MARGIN - bounds.y) * zoom };
  state.activeFloor = floorIndex;
  state.selectedId = null;
  hideRoomNames = !imageExportSettings.names;
  exactGrid = true;
  try {
    target.save();
    target.setTransform(ratio, 0, 0, ratio, left * ratio, top * ratio);
    target.beginPath();
    target.rect(0, 0, width, height);
    target.clip();
    // いまの2Dの絵柄で描く（筆の和紙は、画像全体にまとめて描く）
    drawStyledPlan(target, width, height, ratio, { grid: imageExportSettings.grid, ghost: false, editing: false }, false);
    target.restore();
  } finally {
    ctx = saved.ctx;
    view = saved.view;
    state.activeFloor = saved.activeFloor;
    state.selectedId = saved.selectedId;
    multiSelection.clear();
    selection.forEach((id) => multiSelection.add(id));
    selectionFloor = originalSelectionFloor;
    hideRoomNames = saved.hideRoomNames;
    exactGrid = false;
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

// 方眼の大きさを決めて方眼を入れるときは、画像の端（余白を含めた範囲）を方眼の線に合わせる。画像の左上から方眼が並ぶ
function gridAlignedBounds(bounds: Bounds): Bounds {
  const cell = displaySettings.gridSize;
  if (!(cell > 0) || !imageExportSettings.grid) return bounds;
  const left = Math.floor((bounds.x - EXPORT_MARGIN) / cell) * cell, top = Math.floor((bounds.y - EXPORT_MARGIN) / cell) * cell;
  const right = Math.ceil((bounds.x + bounds.w + EXPORT_MARGIN) / cell) * cell, bottom = Math.ceil((bounds.y + bounds.h + EXPORT_MARGIN) / cell) * cell;
  return { x: left + EXPORT_MARGIN, y: top + EXPORT_MARGIN, w: right - left - EXPORT_MARGIN * 2, h: bottom - top - EXPORT_MARGIN * 2 };
}

// 階の画像を並べた1枚（階が1つなら、その階だけ）。複数の階は、階の名前を上に書く
function renderPlanImage(floorIndexes: number[], original: Bounds): HTMLCanvasElement {
  const bounds = gridAlignedBounds(original);
  const labelled = floorIndexes.length > 1;
  const heading = labelled ? 44 : 0;
  const cellWcm = bounds.w + EXPORT_MARGIN * 2;
  const cellHcm = bounds.h + EXPORT_MARGIN * 2;
  // 横に長くなりすぎるときは、何段かに折り返す
  const columns = labelled ? Math.max(1, Math.min(floorIndexes.length, Math.round(Math.sqrt((floorIndexes.length * cellHcm * 1.6) / cellWcm)) || 1)) : 1;
  const rows = Math.ceil(floorIndexes.length / columns);
  const scale = exportScale(cellWcm * columns, cellHcm * rows, heading * rows);
  const { zoom } = scale;
  let { ratio } = scale;
  // 1マスの大きさを決めたときは、方眼1つがちょうどその px になる細かさにする（作れる大きさまで）
  if (imageExportSettings.cell > 0 && displaySettings.gridSize > 0 && imageExportSettings.grid) {
    const wanted = imageExportSettings.cell / (displaySettings.gridSize * zoom);
    const widthCss = cellWcm * columns * zoom, heightCss = cellHcm * rows * zoom + heading * rows;
    ratio = Math.min(wanted, EXPORT_MAX_SIDE / widthCss, EXPORT_MAX_SIDE / heightCss, Math.sqrt(EXPORT_MAX_PIXELS / (widthCss * heightCss)));
  }
  const cellW = cellWcm * zoom;
  const cellH = cellHcm * zoom + heading;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(cellW * columns * ratio));
  canvas.height = Math.max(1, Math.round(cellH * rows * ratio));
  const target = canvas.getContext("2d");
  if (!target) return canvas;
  // 背景を透明にするときは、地の色も紙の模様も描かない
  const transparent = imageExportSettings.transparent;
  if (!transparent) {
    target.fillStyle = STYLE_LOOKS[planLook()].background ?? "#ffffff";
    target.fillRect(0, 0, canvas.width, canvas.height);
  }
  floorIndexes.forEach((floorIndex, i) => {
    const left = (i % columns) * cellW;
    const top = Math.floor(i / columns) * cellH;
    if (labelled) drawExportHeading(target, state.floors[floorIndex].name, left + 16, top + heading / 2, ratio, cellW * columns, cellH * rows);
    drawFloorForExport(target, floorIndex, bounds, left, top + heading, ratio, zoom);
  });
  // 紙の模様などの仕上げは、画像全体にまとめて重ねる
  if (!transparent) {
    target.save();
    target.setTransform(ratio, 0, 0, ratio, 0, 0);
    styleFinish(planLook(), target, cellW * columns, cellH * rows, 0, 0);
    target.restore();
  }
  return canvas;
}

// 複数の階を並べた画像の、階の名前。間取りと同じ絵柄の文字にする
function drawExportHeading(target: CanvasRenderingContext2D, text: string, x: number, y: number, ratio: number, width: number, height: number): void {
  target.save();
  target.setTransform(ratio, 0, 0, ratio, 0, 0);
  const font = `700 22px ${TEXT_FONT}`;
  if (isDotStyle(planStyle)) {
    pixelTextCanvas ??= document.createElement("canvas");
    const color = planStyle === "retro" ? RETRO_INK : INK;
    drawPixelTexts(target, [{ text, x, y, transform: new DOMMatrix(), font: styledFont(font, "pixel"), color, align: "left", baseline: "middle", alpha: 1 }], width, height, pixelTextCanvas);
  } else {
    const g = styleContext(planStyle, target, { unit: ratio, anchorX: 0, anchorY: 0 }) ?? target;
    g.fillStyle = INK;
    g.font = font;
    g.textBaseline = "middle";
    g.fillText(text, x, y);
  }
  target.restore();
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
  ensureThreeScene();
  const pixelRatio = renderer.getPixelRatio();
  const ratio = Math.min(pixelRatio * 2, EXPORT_MAX_SIDE / size.x, EXPORT_MAX_SIDE / size.y, renderer.capabilities.maxTextureSize / Math.max(size.x, size.y));
  renderer.setPixelRatio(ratio);
  renderer.setSize(size.x, size.y, false);
  renderThreeView();
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

// ---- いくつかのファイルを組み合わせる ----
// 書き出したファイル（JSON）を、いまの間取りに足す。いくつでも一度に選べ、1回の「元に戻す」で取り消せる。
// 置き方: 右に並べる（重ならないよう、いまの間取りの右へずらす）・同じ位置に重ねる・上の階に積む。
// 並べる・重ねるときは、1Fは1Fへ、地下は地下へと同じ階どうしを合わせる（足りない階は足す）
type CombinePlacement = "side" | "same" | "stack";
const COMBINE_PLACEMENTS: CombinePlacement[] = ["side", "same", "stack"];
// 右に並べるときの、いまの間取りとのすき間（cm）
const COMBINE_GAP = GRID * 10;
let combinePlacement: CombinePlacement = "side";

function setupCombine(): void {
  const button = document.querySelector<HTMLButtonElement>("#combineButton");
  const menu = document.querySelector<HTMLDivElement>("#combineMenu");
  const placement = document.querySelector<HTMLSelectElement>("#combinePlacement");
  if (!button || !menu || !placement) return;
  if (COMBINE_PLACEMENTS.includes(viewState.combine as CombinePlacement)) combinePlacement = viewState.combine as CombinePlacement;
  placement.value = combinePlacement;
  placement.addEventListener("change", () => {
    if (!COMBINE_PLACEMENTS.includes(placement.value as CombinePlacement)) return;
    combinePlacement = placement.value as CombinePlacement;
    viewState.combine = combinePlacement;
    scheduleViewStateSave();
  });
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
  document.querySelector<HTMLButtonElement>("#combineChoose")?.addEventListener("click", () => {
    close();
    combineInput.click();
  });
  combineInput.addEventListener("change", () => void combinePlanFiles());
}

async function combinePlanFiles(): Promise<void> {
  const files = [...(combineInput.files ?? [])];
  combineInput.value = "";
  if (!files.length) return;
  const parts: PlanState[] = [];
  let failed = 0;
  for (const file of files) {
    try {
      const plan = normalizePlan(JSON.parse(await file.text()));
      if (!plan) throw new Error("Invalid plan");
      parts.push(plan);
    } catch {
      failed += 1;
    }
  }
  if (parts.length) combinePlans(parts, combinePlacement);
  saveStatus.textContent = parts.length
    ? `${parts.length}個を組み合わせました${failed ? `（${failed}個は読めず）` : ""}`
    : "読み込み失敗";
  window.setTimeout(() => (saveStatus.textContent = "保存済み"), 2400);
}

// 間取りを、いまの間取りに足す。足した物は新しいIDにし、表示している階の分を選んだ状態にする（そのままドラッグで位置を直せる）
function combinePlans(parts: PlanState[], placement: CombinePlacement): void {
  floorDraft = null;
  floorEdit = null;
  floorEditError = "";
  threeMoveId = null;
  const added = new Set<string>();
  const copyOf = <T extends Entity>(entity: T, dx: number, dy: number): T => {
    const copy = cloneEntity(entity) as T;
    copy.id = newId(copy.type);
    translateEntity(copy, dx, dy);
    added.add(copy.id);
    return copy;
  };
  for (const part of parts) {
    // 何もない間取りに足すときは、ファイルの位置と階のまま入れる
    const mode = isPlanEmpty(state) ? "same" : placement;
    let dx = 0, dy = 0;
    if (mode === "side") {
      const here = planBounds(state), there = planBounds(part);
      if (here && there) {
        dx = snap(here.x + here.w + COMBINE_GAP - there.x);
        dy = snap(here.y - there.y);
      }
    }
    const partBasements = basementCount(part);
    const floorIds = new Map<string, string>();
    part.floors.forEach((floor, index) => {
      const target = mode === "stack" ? pushEmptyFloor() : floorAtLevel(index - partBasements);
      floorIds.set(floor.id, target.id);
      floor.entities.forEach((entity) => target.entities.push(copyOf(entity, dx, dy)));
    });
    const topId = part.floors[part.floors.length - 1].id;
    part.roofs.forEach((roofItem) => {
      const copy = copyOf(roofItem, dx, dy);
      copy.floorId = floorIds.get(roofItem.floorId ?? topId) ?? floorIds.get(topId);
      state.roofs.push(copy);
    });
  }
  renameFloors();
  // 足した物が見える階を表示して、その階の分を選ぶ
  if (!activeEntities().some((entity) => added.has(entity.id))) {
    const shown = state.floors.findIndex((floor) => floor.entities.some((entity) => added.has(entity.id)));
    if (shown >= 0) state.activeFloor = shown;
  }
  const floorId = activeFloor().id;
  selectMany([
    ...activeEntities().filter((entity) => added.has(entity.id)),
    ...state.roofs.filter((roofItem) => added.has(roofItem.id) && roofItem.floorId === floorId),
  ].map((entity) => entity.id));
  activeTool = "select";
  setActiveButton("[data-tool]", activeTool);
  syncPlanCursor();
  commitState();
  fitPlanToCanvas();
  pendingCameraFrame = true;
  redrawAll();
}

function isPlanEmpty(plan: PlanState): boolean {
  return plan.roofs.length === 0 && plan.floors.every((floor) => floor.entities.length === 0);
}

// 間取り全体（すべての階と屋根）の外形
function planBounds(plan: PlanState): Bounds | null {
  return getEntitiesBounds([...plan.floors.flatMap((floor) => floor.entities), ...plan.roofs]);
}

function pushEmptyFloor(): Floor {
  const floor: Floor = { id: newId("floor"), name: "", entities: [] };
  state.floors.push(floor);
  return floor;
}

// その高さの階（1Fが0、B1Fが-1）。なければ上や下（地下）に足す
function floorAtLevel(level: number): Floor {
  while (level + basementCount() < 0) {
    state.floors.unshift({ id: newId("floor"), name: "", entities: [] });
    state.basements = basementCount() + 1;
    state.activeFloor += 1;
  }
  while (level + basementCount() >= state.floors.length) pushEmptyFloor();
  return state.floors[level + basementCount()];
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
  if (selectedPerson?.type === "room" && !isLocked(selectedPerson)) {
    const corner = getCornerHit(selectedPerson, point);
    if (corner) return { entity: selectedPerson, corner };
    if (floorEdit?.id === selectedPerson.id && pointInPolygon(point.x, point.y, floorPolygon(selectedPerson))) return { entity: selectedPerson, corner: null };
  }
  if (selectedPerson?.type === "shape" && !isLocked(selectedPerson) && selectedEntities().length === 1) {
    const handle = shapeHandles(selectedPerson).find(p => Math.hypot(p.x - point.x, p.y - point.y) <= 12 / view.zoom);
    if (handle) return { entity: selectedPerson, corner: handle.key };
    if (Math.hypot(selectedPerson.x - point.x, selectedPerson.y - point.y) <= 12 / view.zoom) return { entity: selectedPerson, corner: null };
  }
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

  // 屋根は縁と棟の線で選ぶ。庭・地面などの床の上にある線でも選べるよう、床より先に調べる（いま見ている階の屋根を優先）
  const roofEdge = roofsOn2d() ? roofEdgeAt(point, selectedRoof?.id) : null;
  for (let i = entities.length - 1; i >= 0; i -= 1) {
    const entity = entities[i];
    if (entity.type === "room") {
      if (roofEdge) return { entity: roofEdge, corner: null };
      const corner = getCornerHit(entity, point);
      if (corner) return { entity, corner };
      if (pointInPolygon(point.x, point.y, floorPolygon(entity))) {
        return { entity, corner: null };
      }
    } else if (entity.type === "furniture" && entity.kind === "paint") {
      const corner = entity.id === state.selectedId ? getCornerHit(entity, point) : null;
      if (corner) return { entity, corner };
      if (isPointOnPaint(entity, point)) return { entity, corner: null };
    } else if (entity.type === "furniture") {
      const corner = isPerson(entity) ? null : getCornerHit(entity, point);
      if (corner) return { entity, corner };
      // 自由な形は、範囲の四角ではなく、形そのもので選ぶ（長い柵や川が、まわりの物を選びにくくしないように）
      if (isFreeShapeItem(entity)) {
        if (isPointOnFreeShape(entity, point)) return { entity, corner: null };
        continue;
      }
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
      // ドア・窓は壁の厚みのぶんも当たりにする。開き戸は、開いた扉と開く範囲（4分の1の円）も当たり
      const reach = entity.type === "wall" ? Math.max(12 / view.zoom, wallTopWidth(wallInfoOf(entity)) / 2) : Math.max(12 / view.zoom, WALL_THICKNESS_2D);
      if (distanceToSegment(point, { x: entity.x1, y: entity.y1 }, { x: entity.x2, y: entity.y2 }) < reach || (entity.type === "door" && isPointInDoorSwing(point, entity))) {
        return { entity, corner: null };
      }
    }
  }
  if (roofEdge) return { entity: roofEdge, corner: null };
  // 選択ツールでは、ほかに何もない所（軒先など）を押すと、そこを覆う屋根を選ぶ（消すツールでうっかり消さないよう、選択ツールだけ）
  const roofInside = roofsOn2d() && activeTool === "select" ? roofAt(point) : null;
  return { entity: roofInside, corner: null };
}

// その点を覆う屋根（いま見ている階の屋根を優先）
function roofAt(point: Point): Roof | null {
  const floorId = activeFloor().id, topId = state.floors[state.floors.length - 1]?.id;
  let other: Roof | null = null;
  for (let i = state.roofs.length - 1; i >= 0; i -= 1) {
    const roofItem = state.roofs[i];
    if (!isPointInRoof(point, roofItem)) continue;
    if ((roofItem.floorId ?? topId) === floorId) return roofItem;
    other ??= roofItem;
  }
  return other;
}

// 点の近くに縁がある屋根。いま見ている階の屋根を先に、同じ階どうしなら後から置いた（上に描かれる）屋根を選ぶ
function roofEdgeAt(point: Point, skipId?: string): Roof | null {
  const floorId = activeFloor().id, topId = state.floors[state.floors.length - 1]?.id;
  let other: Roof | null = null;
  for (let i = state.roofs.length - 1; i >= 0; i -= 1) {
    const roofItem = state.roofs[i];
    if (roofItem.id === skipId || !isPointNearRoofEdge(point, roofItem)) continue;
    if ((roofItem.floorId ?? topId) === floorId) return roofItem;
    other ??= roofItem;
  }
  return other;
}

function getLineEndpointHit(entity: LinearElement, point: Point): string | null {
  // 短い線でも中央部をドラッグで移動できるよう、端点判定は線長の1/4までに制限する
  const size = Math.min(12 / view.zoom, distance(entity) * 0.25);
  if (Math.abs(point.x - entity.x1) <= size && Math.abs(point.y - entity.y1) <= size) return "p1";
  if (Math.abs(point.x - entity.x2) <= size && Math.abs(point.y - entity.y2) <= size) return "p2";
  return null;
}

function bindFloorVertices(room: Room): void {
  if (floorEdit?.id !== room.id || floorEdit.vertex === null) return;
  const index = floorEdit.vertex;
  const x = requiredElement<HTMLInputElement>("#floorVertexX"), y = requiredElement<HTMLInputElement>("#floorVertexY");
  const remove = requiredElement<HTMLButtonElement>("#floorVertexRemove"), add = requiredElement<HTMLButtonElement>("#floorVertexAdd");
  const sync = () => {
    const point = floorPoints(room)[index];
    x.value = String(Math.round(point[0])); y.value = String(Math.round(point[1]));
    remove.disabled = isLocked(room) || floorPoints(room).length <= 3;
    add.disabled = isLocked(room) || floorPoints(room).length >= MAX_FLOOR_VERTICES;
  };
  const change = () => {
    if (isLocked(room)) return;
    const points = floorPoints(room);
    if (!x.value.trim() || !y.value.trim() || !Number.isFinite(x.valueAsNumber) || !Number.isFinite(y.valueAsNumber)) { sync(); return; }
    points[index] = [x.valueAsNumber, y.valueAsNumber];
    if (!updateFloorVertex(room, points)) { sync(); return; }
    commitState(); redrawAll();
  };
  x.addEventListener("change", change); y.addEventListener("change", change);
  remove.addEventListener("click", removeFloorVertex);
  add.addEventListener("click", () => {
    if (isLocked(room) || floorPoints(room).length >= MAX_FLOOR_VERTICES) return;
    const points = floorPoints(room), i = index, a = points[i], b = points[(i + 1) % points.length];
    points.splice(i + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
    if (updateFloorVertex(room, points)) { floorEdit!.vertex = i + 1; commitState(); redrawAll(); }
  });
  sync(); createIcons({ icons });
}

function changeRegularFloor(room: Room, sides: number, rotation: number): boolean {
  const polygon = regularFloor(room);
  const diameter = polygon?.diameter ?? Math.min(room.w, room.h);
  const cx = polygon?.x ?? room.x + room.w / 2, cy = polygon?.y ?? room.y + room.h / 2;
  const size = { x: cx - diameter / 2, y: cy - diameter / 2, w: diameter, h: diameter };
  const outline = regularFloorOutline(sides, rotation);
  const holes = floorPolygon(room).slice(1).map(ring => ring.map(([x, y]): [number, number] => [(x - size.x) / size.w, (y - size.y) / size.h]));
  let normalizedHoles: Room["holes"];
  try { normalizedHoles = normalizeFloorHoles(holes, outline); }
  catch { floorEditError = "階段などの開口が床の外に出るため、この形には変更できません"; syncFloorToolbar(); return false; }
  const label = getRoomLabelPosition(room);
  Object.assign(room, size, { outline, holes: normalizedHoles });
  room.labelOffsetX = label.x - room.x; room.labelOffsetY = label.y - room.y;
  floorEdit = null; floorEditError = "";
  return true;
}

function bindFloorShapeControls(room: Room): void {
  propertiesPanel.querySelectorAll<HTMLButtonElement>("[data-floor-preset]").forEach(button => {
    const preset = button.dataset.floorPreset as FloorPreset;
    const canvas = button.querySelector("canvas")!, g = canvas.getContext("2d")!;
    const points = presetOutline(preset) ?? [[0, 0], [1, 0], [1, 1], [0, 1]];
    g.fillStyle = "#dceaf7"; g.strokeStyle = "#315575"; g.lineWidth = 3;
    const equalAxes = preset === "circle" || preset === "polygon";
    g.beginPath(); points.forEach(([x, y], i) => i ? g.lineTo((equalAxes ? 22 : 12) + x * (equalAxes ? 44 : 64), 10 + y * 44) : g.moveTo((equalAxes ? 22 : 12) + x * (equalAxes ? 44 : 64), 10 + y * 44)); g.closePath(); g.fill(); g.stroke();
    button.addEventListener("click", () => {
      if (isLocked(room)) return;
      if (preset === "polygon") {
        if (changeRegularFloor(room, 6, 0)) { commitState(); redrawAll(); }
        return;
      }
      const outline = presetOutline(preset);
      const size = preset === "circle" ? centeredFloorSize(room, Math.min(room.w, room.h), Math.min(room.w, room.h))
        : preset === "ellipse" ? centeredFloorSize(room, room.w, Math.abs(room.w - room.h) < 0.01 ? Math.max(40, room.h * 0.6) : room.h) : { x: room.x, y: room.y, w: room.w, h: room.h };
      const holes = floorPolygon(room).slice(1).map(ring => ring.map(([x, y]): [number, number] => [(x - size.x) / size.w, (y - size.y) / size.h]));
      let normalizedHoles: Room["holes"];
      try { normalizedHoles = normalizeFloorHoles(holes, outline); }
      catch { floorEditError = "階段などの開口が床の外に出るため、この形には変更できません"; syncFloorToolbar(); return; }
      const label = getRoomLabelPosition(room);
      Object.assign(room, size);
      room.outline = outline;
      room.holes = normalizedHoles;
      room.labelOffsetX = label.x - room.x;
      room.labelOffsetY = label.y - room.y;
      floorEdit = null; floorEditError = "";
      commitState(); redrawAll();
    });
  });
  // なぞって描き直す: 部屋のツールにして、次になぞった形（または四角）をこの床に当てる
  requiredElement("#floorRetraceButton").addEventListener("click", () => {
    if (isLocked(room)) return;
    floorEdit = null;
    floorRetraceId = floorRetraceId === room.id ? null : room.id;
    activeTool = floorRetraceId ? "room" : "select";
    if (floorRetraceId && viewMode === "three") applyViewMode("split");
    setActiveButton("[data-tool]", activeTool);
    syncPlanCursor();
    redrawAll(false);
  });
  requiredElement("#floorEditToggle").addEventListener("click", () => {
    if (isLocked(room)) return;
    floorRetraceId = null;
    floorEdit = floorEdit?.id === room.id ? null : { id: room.id, vertex: null };
    activeTool = "select";
    if (floorEdit && viewMode === "three") applyViewMode("split");
    floorEditError = "";
    setActiveButton("[data-tool]", activeTool);
    redrawAll(false);
  });
  createIcons({ icons });
}

// 床材を絵で選ぶ欄。選んでいる床材の名前と、模様の見本を並べる（見本の絵は一度だけ作る）
const surfaceSwatchUrls = new Map<RoomSurface, string>();
function surfaceSwatchUrl(surface: RoomSurface): string {
  let url = surfaceSwatchUrls.get(surface);
  if (!url) {
    // 見本は小さいので、模様1枚（256px）を縮めてから画像にする（画像にする手間は大きさに比例する）
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 96;
    canvas.getContext("2d")?.drawImage(surfaceCanvas(surface, SURFACE_DEFS[surface].color), 0, 0, 96, 96);
    url = canvas.toDataURL();
    surfaceSwatchUrls.set(surface, url);
  }
  return url;
}

function surfacePickerHtml(id: string, current: RoomSurface): string {
  return `<div class="surface-field">
      <span class="surface-field-label">床材 <strong>${escapeHtml(SURFACE_DEFS[current].label)}</strong></span>
      <div class="surface-picker" id="${id}" role="radiogroup" aria-label="床材">${(Object.keys(SURFACE_DEFS) as RoomSurface[]).map((surface) => {
        const active = surface === current;
        return `<button type="button" role="radio" data-surface-choice="${surface}" class="${active ? "is-active" : ""}" aria-checked="${active}" title="${escapeHtml(SURFACE_DEFS[surface].label)}" aria-label="${escapeHtml(SURFACE_DEFS[surface].label)}" style="background-image:url(${surfaceSwatchUrl(surface)})"></button>`;
      }).join("")}</div>
    </div>`;
}

function bindSurfacePicker(selector: string, choose: (surface: RoomSurface) => void): void {
  propertiesPanel.querySelectorAll<HTMLButtonElement>(`${selector} [data-surface-choice]`).forEach((button) => button.addEventListener("click", () => {
    const value = button.dataset.surfaceChoice ?? "";
    if (isRoomSurface(value)) choose(value);
  }));
}

function diameterControl(prefix: string, diameter: number, disabled: string, label = "直径 cm"): string {
  const value = Math.round(diameter * 10) / 10;
  const max = Math.ceil(Math.max(2000, diameter * 2) / 100) * 100;
  return `<div class="diameter-control"><label for="${prefix}DiameterInput">${label}</label><div class="diameter-row">
    <button type="button" id="${prefix}DiameterMinus" title="直径を10cm小さく" aria-label="直径を10cm小さく" ${disabled}><i data-lucide="minus"></i></button>
    <input id="${prefix}DiameterInput" type="number" min="40" step="1" value="${value}" ${disabled} />
    <button type="button" id="${prefix}DiameterPlus" title="直径を10cm大きく" aria-label="直径を10cm大きく" ${disabled}><i data-lucide="plus"></i></button></div>
    <input id="${prefix}DiameterRange" type="range" min="40" max="${max}" step="10" value="${value}" aria-label="直径" ${disabled} /></div>`;
}

function bindDiameter(prefix: string, entity: Entity, get: () => number, set: (value: number) => void): void {
  const number = requiredElement<HTMLInputElement>(`#${prefix}DiameterInput`);
  const range = requiredElement<HTMLInputElement>(`#${prefix}DiameterRange`);
  let original = cloneEntity(entity);
  const sync = () => {
    if (get() > Number(range.max)) range.max = String(Math.ceil(get() * 2 / 100) * 100);
    number.value = String(Math.round(get() * 10) / 10); range.value = String(get());
    if (entity.type === "room") {
      const polygon = regularFloor(entity);
      requiredElement<HTMLInputElement>("#roomWInput").value = String(Math.round((polygon?.w ?? entity.w) * 10) / 10);
      requiredElement<HTMLInputElement>("#roomHInput").value = String(Math.round((polygon?.h ?? entity.h) * 10) / 10);
    }
    if (entity.type === "shape") {
      const w = propertiesPanel.querySelector<HTMLInputElement>("#shapeWInput"), h = propertiesPanel.querySelector<HTMLInputElement>("#shapeHInput");
      if (w) w.value = String(entity.r * 2);
      if (h) h.value = String(shapeRadiusY(entity) * 2);
    }
    if (entity.type === "roof") {
      const w = propertiesPanel.querySelector<HTMLInputElement>("#roofWInput"), h = propertiesPanel.querySelector<HTMLInputElement>("#roofHInput");
      if (w) w.value = String(entity.w);
      if (h) h.value = String(entity.h);
      requiredElement<HTMLInputElement>("#roofXInput").value = String(entity.x);
      requiredElement<HTMLInputElement>("#roofYInput").value = String(entity.y);
      requiredElement<HTMLInputElement>("#roofRiseInput").placeholder = `自動（${Math.round(roofRise(entity))}）`;
    }
  };
  const apply = (value: number) => {
    if (isLocked(entity) || !Number.isFinite(value)) return;
    set(Math.max(40, value)); sync(); render2d(); scheduleThreeRefresh();
  };
  const finish = () => {
    // 入力欄を作り直すと、フォーカスや直後のボタンクリックが失われる。描画はapplyで更新済み。
    if (JSON.stringify(original) !== JSON.stringify(entity)) commitState(false);
    if (entity.type === "roof") renderRoofList();
    original = cloneEntity(entity);
  };
  number.addEventListener("change", () => {
    if (!number.value.trim() || !Number.isFinite(number.valueAsNumber)) { sync(); return; }
    apply(number.valueAsNumber); finish();
  });
  range.addEventListener("pointerdown", () => { original = cloneEntity(entity); });
  range.addEventListener("input", () => apply(range.valueAsNumber));
  range.addEventListener("change", finish);
  const cancel = () => { Object.assign(entity, cloneEntity(original)); sync(); render2d(); scheduleThreeRefresh(); };
  range.addEventListener("pointercancel", cancel);
  range.addEventListener("keydown", event => { if (event.key === "Escape") { event.preventDefault(); cancel(); range.blur(); } });
  for (const [suffix, delta] of [["Minus", -10], ["Plus", 10]] as const) {
    requiredElement(`#${prefix}Diameter${suffix}`).addEventListener("click", () => { apply(get() + delta); finish(); });
  }
}

function writingModeControl(mode: WritingMode | undefined, disabled: string): string {
  return `<div class="segmented" role="group" aria-label="文字の方向">${(["horizontal", "vertical"] as const).map(value => `<button type="button" data-writing-mode="${value}" class="${(mode ?? "horizontal") === value ? "is-active" : ""}" aria-pressed="${(mode ?? "horizontal") === value}" ${disabled}>${value === "vertical" ? "縦書き" : "横書き"}</button>`).join("")}</div>`;
}

function bindWritingMode(entity: Room | TextLabel): void {
  propertiesPanel.querySelectorAll<HTMLButtonElement>("[data-writing-mode]").forEach(button => {
    button.addEventListener("click", () => {
      if (isLocked(entity)) return;
      entity.writingMode = button.dataset.writingMode === "vertical" ? "vertical" : undefined;
      commitState();
      redrawAll();
    });
  });
}

function getRoomLabelPosition(room: Room): Point {
  return {
    x: room.x + (room.labelOffsetX ?? 10),
    y: room.y + (room.labelOffsetY ?? 10),
  };
}

function getRoomLabelBounds(room: Room): { x: number; y: number; w: number; h: number } | null {
  const named = room.name.trim() !== "" && !hideRoomNames;
  const details = roomDetailLines(room);
  if (!named && !details.length) return null;
  const position = getRoomLabelPosition(room);
  const layout = measureLabel(room.name, room.labelSize ?? Math.max(12, 13 / view.zoom), room.writingMode);
  ctx.save();
  const dimSize = Math.max(10, 11 / view.zoom);
  ctx.font = styledFont(`${dimSize}px ${TEXT_FONT}`, planStyle);
  const dimensionWidth = Math.max(0, ...details.map((text) => ctx.measureText(text).width));
  ctx.restore();
  return {
    x: position.x - 6,
    y: position.y - 5,
    w: Math.max(named ? layout.w : 0, dimensionWidth) + 12,
    h: (named ? layout.h : 0) + (details.length ? details.length * (dimSize + 3) - 3 + (named ? 4 : 0) : 0) + 10,
  };
}

// 部屋の名前の下に出す、寸法（幅 x 奥行）と広さ（帖・㎡）
function roomDetailLines(room: Room): string[] {
  const lines: string[] = [];
  if (showDimensions) lines.push(`${formatMeters(room.w)} x ${formatMeters(room.h)}`);
  const area = roomAreaText(room);
  if (area) lines.push(area);
  return lines;
}

// 部屋の広さ。穴（階段など）は引く。1帖は 1.62㎡
function roomAreaText(room: Room): string | null {
  if (displaySettings.area === "none") return null;
  const [outer, ...holes] = floorPolygon(room);
  const ring = (points: [number, number][]) => Math.abs(points.reduce((sum, [x, y], i) => {
    const [nx, ny] = points[(i + 1) % points.length];
    return sum + x * ny - nx * y;
  }, 0)) / 2;
  const m2 = Math.max(0, ring(outer) - holes.reduce((sum, hole) => sum + ring(hole), 0)) / 10000;
  return displaySettings.area === "jo" ? t(`${(m2 / 1.62).toFixed(1)}帖`) : `${m2.toFixed(1)}㎡`;
}

function isPointInRoomLabel(point: Point, room: Room): boolean {
  const bounds = getRoomLabelBounds(room);
  if (!bounds) return false;
  return point.x >= bounds.x && point.x <= bounds.x + bounds.w && point.y >= bounds.y && point.y <= bounds.y + bounds.h;
}

function getCornerHit(entity: Room | Furniture | Roof, point: Point): string | null {
  const size = 12 / view.zoom;
  if (entity.type === "room" && (entity.outline || floorEdit?.id === entity.id)) {
    if (entity.id !== state.selectedId || selectedEntities().length > 1) return null;
    return floorHandles(entity).find(handle => Math.hypot(point.x - handle.x, point.y - handle.y) <= size)?.key ?? null;
  }
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
  const points = roofOutline(roofItem);
  return points.some(([x, y], i) => {
    const next = points[(i + 1) % points.length];
    return distanceToSegment(point, { x, y }, { x: next[0], y: next[1] }) <= tolerance;
  }) || roofLines2d(roofItem).some(([from, to]) => distanceToSegment(point, from, to) <= tolerance);
}

// 開き戸（片開き・両開き・門扉）の、開いた扉と開く範囲の4分の1の円の中か
function isPointInDoorSwing(point: Point, door: LinearElement): boolean {
  if (door.doorStyle && door.doorStyle !== "double" && door.doorStyle !== "gate") return false;
  const length = Math.max(distance(door), GRID);
  const a = Math.atan2(door.y2 - door.y1, door.x2 - door.x1);
  const open = a + ((door.flip ? 1 : -1) * Math.PI) / 2;
  const leaves = door.doorStyle ? doubleLeaves() : [{ hinge: -1, width: 1 }];
  const slack = 6 / view.zoom;
  return leaves.some((leaf) => {
    const hinge = leaf.hinge < 0 ? { x: door.x1, y: door.y1 } : { x: door.x2, y: door.y2 };
    const closed = leaf.hinge < 0 ? a : a + Math.PI;
    const dx = point.x - hinge.x, dy = point.y - hinge.y;
    return Math.hypot(dx, dy) <= length * leaf.width + slack
      && dx * Math.cos(closed) + dy * Math.sin(closed) >= -slack
      && dx * Math.cos(open) + dy * Math.sin(open) >= -slack;
  });
}

function isPointInRoof(point: Point, roofItem: Roof): boolean {
  return pointInPolygon(point.x, point.y, [roofOutline(roofItem)]);
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

// 「サンプル」テンプレート: 作例プラン（書き出しJSONをそのまま収録）
// 起動時（URLパラメータ経由）でも参照できるよう、巻き上げの効く関数宣言にしている
function samplePlanData(): unknown {
  return {
  floors: [
    {
      id: "floor-a35471aa-199e-4886-8241-548b47d8ea02",
      name: "1F",
      entities: [
        { id: "room-ee067625-51a8-4019-8565-b352841f3e73", type: "room", name: "", x: 380, y: 0, w: 220, h: 220, color: "#e9eff8", surface: "plain" },
        { id: "room-038963ce-8166-4fe4-9eaa-7e91829213e4", type: "room", name: "水回り", x: 380, y: 220, w: 220, h: 220, color: "#e8f2ed", surface: "plain" },
        { id: "room-6b1825cb-c567-403c-8058-6523ca6dbde4", type: "room", name: "玄関", x: 0, y: 300, w: 380, h: 140, color: "#f6e8e0", labelOffsetX: 244.10191702469064, labelOffsetY: 35.376901574492194, surface: "plain" },
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
        { id: "furniture-7728a0d4-8c93-43da-816b-e781b5a504c6", type: "furniture", kind: "table", x: 460, y: 860, w: 160, h: 180, rotation: 0 },
        { id: "furniture-18c308ac-cdad-4a92-bc92-5071236d8479", type: "furniture", kind: "bed", x: 520, y: 20, w: 74, h: 120, rotation: 0 },
        { id: "furniture-be7d6740-6272-440f-95d1-f0bab0608c73", type: "furniture", kind: "kitchen", x: 240, y: 20, w: 120, h: 40, rotation: 0 },
        { id: "furniture-c5bcaafe-20ab-47b9-8739-0dbaa36f719e", type: "furniture", kind: "bath", x: 440, y: 280, w: 120, h: 80, rotation: 0, color: "#000000", color3d: "#c2f3ff" },
        { id: "window-cced82e5-d999-480a-a32e-8494dee0bb5a", type: "window", x1: 0, y1: 60, x2: 0, y2: 220 },
        { id: "wall-470a55ea-b8e9-41b0-836e-794f53e1b254", type: "wall", x1: 0, y1: 40, x2: 0, y2: -180 },
        { id: "wall-433e695b-470e-43c3-bd75-6ddd5a28a896", type: "wall", x1: 0, y1: -180, x2: 600, y2: -180 },
        { id: "wall-76154116-819b-4daf-aaa6-431e94fcc1c0", type: "wall", x1: 600, y1: -180, x2: 600, y2: 20 },
        { id: "shape-8cf996c6-dca5-4b39-ba14-12f60889bd91", type: "shape", kind: "circle", x: 920, y: -80, r: 160, startAngle: 0, endAngle: 6.283185307179586, sides: 6, rotation: 0 },
        { id: "shape-b1ac4c06-b255-4d6f-99cb-4c2633303385", type: "shape", kind: "arc", x: 660, y: -300, r: 60, startAngle: -1.5707963267948966, endAngle: 2.3754228892920524, sides: 6, rotation: 0 },
        { id: "wall-69d4bd62-3860-4a4c-9eec-745e06e193ad", type: "wall", x1: 1180, y1: -240, x2: 1180, y2: 340 },
        { id: "wall-72497fe6-53c5-49c2-9355-58ac4b57089c", type: "wall", x1: 1180, y1: -240, x2: 2020, y2: -240 },
        { id: "wall-640af7ef-3e1b-48b4-97e6-1c17efcf3069", type: "wall", x1: 1180, y1: 340, x2: 1880, y2: 340 },
        { id: "wall-c2da2d05-a822-49f9-b5a1-9eb226eb91fb", type: "wall", x1: 1880, y1: -240, x2: 1880, y2: 340 },
        { id: "room-80fae1c5-87f5-4824-9c0f-085a1e51b617", type: "room", name: "部屋", x: 1360, y: -480, w: 460, h: 180, color: "#e8f2ed", surface: "plain" },
        { id: "door-c9e53dd8-24be-423c-99ab-ee27a80a23c0", type: "door", x1: 60, y1: 440, x2: 160, y2: 440, color3d: "#2a4edf" },
        { id: "furniture-6a1c3a27-ee99-4f34-8c53-c74399151063", type: "furniture", kind: "table", x: 200, y: -140, w: 100, h: 80, rotation: 0 },
        { id: "furniture-41012320-f935-440d-abee-0371f54ae634", type: "furniture", kind: "table", x: 60, y: -300, w: 100, h: 50, rotation: 0 },
        { id: "furniture-1743122b-187b-412e-b280-c986fe64f743", type: "furniture", kind: "stairsSpiral", x: 440, y: -160, w: 140, h: 140, rotation: 90 },
        { id: "furniture-6a9947d5-8015-4f76-9691-005782f6091c", type: "furniture", kind: "table", x: 760, y: 220, w: 100, h: 70, rotation: 0 },
        { id: "furniture-01fc71a0-f688-459e-bb63-60bb100fe6ba", type: "furniture", kind: "closet", x: 360, y: 1180, w: 260, h: 100, rotation: 0 },
        { id: "door-d1972569-27a1-4dc2-aa16-28c048986801", type: "door", x1: 920, y1: -480, x2: 1060, y2: -480 },
        { id: "door-67b92620-b0a9-47e1-9a0d-53b29d85c3f2", type: "door", x1: 0, y1: -100, x2: 0, y2: -40 },
        { id: "furniture-283cf7e4-31f2-404e-8455-f4821697752c", type: "furniture", kind: "car", x: 1320, y: 540, w: 260, h: 520, rotation: 0 },
        { id: "furniture-c965ef89-9119-4a01-ae08-ac7f6cc5374e", type: "furniture", kind: "stairsU", x: -300, y: 60, w: 240, h: 260, rotation: 0 },
        { id: "furniture-ffff236f-57f6-4649-9d0b-1851ead4b219", type: "furniture", kind: "plant", x: 700, y: 560, w: 420, h: 460, rotation: 0 },
        { id: "furniture-a5f3f497-a0cd-4212-b9fc-1c23f318ee60", type: "furniture", kind: "tv", x: 60, y: 680, w: 320, h: 140, rotation: 0 },
        { id: "furniture-a02a885c-4624-410e-92ac-14b3fe78a3f6", type: "furniture", kind: "toilet", x: 140, y: 920, w: 80, h: 120, rotation: 0 },
        { id: "furniture-9c9e45fd-689b-4419-acc2-c2bc1ce0dfb4", type: "furniture", kind: "armchair", x: -400, y: -160, w: 80, h: 80, rotation: 0 },
        { id: "furniture-2efe9d15-206a-4c2f-b007-383d567f5448", type: "furniture", kind: "chair", x: 1080, y: 300, w: 80, h: 80, rotation: 0 },
        { id: "furniture-984286e0-c13c-4137-8b30-5fc8d7c822d6", type: "furniture", kind: "chair", x: 500, y: 460, w: 200, h: 200, rotation: 0 },
        { id: "furniture-0560c5e1-3110-46ce-bdba-9b438b7b2dc7", type: "furniture", kind: "aquarium", x: -200, y: 1060, w: 200, h: 120, rotation: 0 },
        { id: "furniture-9932ba70-4b8e-4bf4-9dd8-839dcf799304", type: "furniture", kind: "grandfatherClock", x: 80, y: 1060, w: 80, h: 140, rotation: 0 },
        { id: "furniture-224fd4b7-5937-44d7-89c1-86debdf6fdf8", type: "furniture", kind: "wallClock", x: 520, y: 760, w: 80, h: 20, rotation: 0 },
        { id: "furniture-f10a3996-56f8-426d-98f5-1f00b84a75e7", type: "furniture", kind: "washer", x: 1140, y: 1360, w: 100, h: 160, rotation: 0 },
        { id: "furniture-a33c49c0-52ea-480f-9238-dd675437a9ea", type: "furniture", kind: "washbasin", x: 1220, y: 1260, w: 75, h: 55, rotation: 0 },
        { id: "furniture-14358d3e-963c-45ff-b18b-224095ec5ddc", type: "furniture", kind: "washbasin", x: 700, y: 1280, w: 240, h: 220, rotation: 180 },
        { id: "furniture-bf61839b-28c6-4829-97c0-74d6e1c08fae", type: "furniture", kind: "stairs", x: 1700, y: 720, w: 180, h: 320, rotation: 0 },
        { id: "furniture-5a37139b-6d02-4562-b577-34d6287b6180", type: "furniture", kind: "bath", x: -80, y: -520, w: 140, h: 80, rotation: 0 },
        { id: "furniture-19063c64-57a5-4b4f-8709-8c6dae22c863", type: "furniture", kind: "wardrobe", x: 60, y: 1380, w: 240, h: 115, rotation: 0 },
        { id: "furniture-f6238363-354d-46b1-a7bb-b6ed8e6ceda0", type: "furniture", kind: "closet", x: 340, y: -840, w: 160, h: 60, rotation: 0 },
        { id: "furniture-29c0cd75-8e90-45cf-9cb4-c855b02b403e", type: "furniture", kind: "bench", x: 940, y: 980, w: 150, h: 55, rotation: 0, color: "#940000" },
        { id: "wall-375e8191-c47c-47e6-8826-8ab5270d1ad9", type: "wall", x1: 1300, y1: -520, x2: 1611, y2: -831 },
        { id: "door-e582f2f2-1681-4362-9c56-befc60f014b0", type: "door", x1: 1423, y1: -637, x2: 1504, y2: -718 },
        { id: "furniture-c2f7442a-d801-4dbe-9eb5-5e89f41b1f83", type: "furniture", kind: "sofaCorner", x: -340, y: 500, w: 300, h: 180, rotation: 0, color3d: "#0f3561" },
        { id: "furniture-52c5b538-0241-4fc1-b1e6-aa4d4684a165", type: "furniture", kind: "rug", x: -600, y: 500, w: 260, h: 260, rotation: 0, color: "#d11010" },
        { id: "room-d35ba6d1-e2e8-48ab-9b98-b1fda60adf01", type: "room", name: "", x: -480, y: -800, w: 340, h: 340, color: "#fbfcfd", surface: "plain" },
        { id: "room-ccc94754-3d23-4582-b51a-24d80d1a7d11", type: "room", name: "", x: 740, y: -960, w: 320, h: 320, color: "#fcfbf9", surface: "plain" },
        { id: "furniture-8b870ae1-fed2-4bd2-af95-e10a5d4157ef", type: "furniture", kind: "stool", x: 460, y: 1540, w: 100, h: 100, rotation: 0 },
        { id: "door-547f4261-40d4-4b25-bf7e-eabfa1b82346", type: "door", x1: 2000, y1: 300, x2: 2440, y2: 300, doorStyle: "sliding" },
        { id: "furniture-52f55e4c-d626-4040-974b-c5256d4484a2", type: "furniture", kind: "deskL", x: -480, y: 1220, w: 220, h: 200, rotation: 0, color: "#30dfa4" },
        { id: "furniture-1d2f1c8d-a3a1-4424-ae9b-2e1b12834c5e", type: "furniture", kind: "zaisu", x: -260, y: 780, w: 120, h: 140, rotation: 0 },
        { id: "furniture-2ac529e2-00a6-4452-9a7f-4d81a7654923", type: "furniture", kind: "kitchenIsland", x: -340, y: 1580, w: 240, h: 100, rotation: 0 },
        { id: "furniture-de2af0b0-6c91-46a7-83ca-6bc9d7c2eb2c", type: "furniture", kind: "bath", x: 760, y: 1820, w: 200, h: 160, rotation: 0, symbol: 1 },
        { id: "furniture-d3d08739-809b-4a54-901a-197e28bb071f", type: "furniture", kind: "unitBath", x: 660, y: 1560, w: 340, h: 200, rotation: 0 },
        { id: "furniture-6e69e1bb-08cf-4701-9acd-aae3e4094fc6", type: "furniture", kind: "bunkBed", x: -640, y: 880, w: 100, h: 210, rotation: 0 },
        { id: "furniture-bcef726e-0a1c-40e4-83be-6cac9ff92b60", type: "furniture", kind: "kitchen", x: -480, y: 380, w: 240, h: 65, rotation: 0 },
        { id: "furniture-bdc44cbc-6e33-4202-8524-8545e2ff5343", type: "furniture", kind: "kitchen", x: -1060, y: 220, w: 240, h: 65, rotation: 0 },
        { id: "room-4199d766-10e4-4293-9ea2-fa1cc649904c", type: "room", name: "", x: -780, y: 1400, w: 240, h: 120, color: "#83ab57", surface: "grass" },
        { id: "room-35e1730d-8429-412e-bfe4-622e85f95413", type: "room", name: "", x: -760, y: 1520, w: 240, h: 120, color: "#aeb3b1", surface: "stone" },
        { id: "room-cd54b945-43bf-4c8d-9b29-54c27f2c494e", type: "room", name: "", x: -780, y: 1640, w: 280, h: 100, color: "#d6b58a", surface: "wood" },
        { id: "room-8f9322b2-33d0-4cb1-813b-7879dade8fd8", type: "room", name: "", x: -780, y: 1740, w: 280, h: 100, color: "#dfe7ea", surface: "tile" },
        { id: "furniture-cc221f0f-62e3-4c6e-beae-9d7c9ae7a809", type: "furniture", kind: "rug", x: 1640, y: 1820, w: 200, h: 140, rotation: 0 },
        { id: "furniture-11c44532-a098-4906-9e95-895305f07d99", type: "furniture", kind: "rug", x: 100, y: 1800, w: 580, h: 360, rotation: 0 },
        { id: "furniture-61516ad9-f0cf-44ea-8b5a-fd81a13bb8e7", type: "furniture", kind: "armchair", x: -940, y: -300, w: 80, h: 80, rotation: 0 },
        { id: "furniture-844cb1a1-9949-4cf5-a15c-d5465e369e35", type: "furniture", kind: "tv", x: -1900, y: -1360, w: 400, h: 220, rotation: 0, symbol: 1 },
        { id: "furniture-3e1753e8-3c0a-4714-9a53-1f1e04bd3124", type: "furniture", kind: "tree", x: -1160, y: 760, w: 400, h: 400, rotation: 0, height: 670 },
        { id: "furniture-5e800a74-3b4c-4d44-b856-979d91d93ccd", type: "furniture", kind: "conifer", x: -1360, y: -180, w: 320, h: 340, rotation: 0 },
        { id: "furniture-18bf02ce-932d-4868-9d08-9e1fb105aa22", type: "furniture", kind: "palmTree", x: -1460, y: 820, w: 320, h: 320, rotation: 0, height: 630 },
        { id: "furniture-672de3e5-f924-4bb3-b209-543486560c65", type: "furniture", kind: "shrub", x: -1260, y: 1500, w: 120, h: 80, rotation: 0 },
        { id: "furniture-0d6cc2c8-41fe-41f9-a6c1-efec7f8b7123", type: "furniture", kind: "rock", x: -1080, y: 1240, w: 220, h: 180, rotation: 0 },
        { id: "furniture-8dccb549-8f10-45ab-a504-f7804c13bc9c", type: "furniture", kind: "stoneLantern", x: -1080, y: 1780, w: 220, h: 220, rotation: 0 },
        { id: "furniture-fdb58adf-a99f-43aa-9cbd-5120c3538e7f", type: "furniture", kind: "shed", x: -1320, y: 1880, w: 180, h: 90, rotation: 0 },
        { id: "door-bac820c5-1110-4d37-b327-d88bad05539d", type: "door", x1: 1520, y1: 1600, x2: 1660, y2: 1600 },
        { id: "text-0e871d23-f5a9-4222-a897-583313d534d5", type: "text", text: "uooooo", x: -797, y: -119, size: 77, rotation: 0 },
      ],
    },
    {
      id: "floor-b9fc8ff7-f6b0-4e9b-a154-89bed050dea9",
      name: "2F",
      entities: [
        { id: "room-923b3ad0-4082-450e-8a48-68c9b8055ce4", type: "room", name: "部屋 1", x: 0, y: -180, w: 280, h: 320, color: "#ffffff", surface: "plain" },
        { id: "shape-2a8a9d8b-096a-446b-b2d2-39be77dce91d", type: "shape", kind: "polygon", x: 420, y: 0, r: 220, startAngle: 0, endAngle: 6.283185307179586, sides: 8, rotation: 1.4547659070016843 },
        { id: "furniture-c535570b-ca5a-4c39-90cd-40c69bdc447b", type: "furniture", kind: "table", x: 1300, y: 80, w: 220, h: 160, rotation: 0 },
        { id: "furniture-ae632daf-ea67-4fee-b757-ef5d359dc695", type: "furniture", kind: "piano", x: -360, y: 620, w: 340, h: 340, rotation: 0 },
        { id: "room-f7df7d94-7957-4a33-a2ac-2c646e837258", type: "room", name: "石の床 2", x: -60, y: -340, w: 1640, h: 1140, color: "#aeb3b1", surface: "stone" },
      ],
    },
  ],
  activeFloor: 0,
  selectedId: null,
  roofs: [
    { id: "roof-259cf045-ac7e-4220-b73e-e2283b7ddc81", type: "roof", kind: "flat", x: -580, y: -1880, w: 1240, h: 1260, floorId: "floor-b9fc8ff7-f6b0-4e9b-a154-89bed050dea9" },
    { id: "roof-0491f156-d58c-46c2-bdfd-787d481b43c7", type: "roof", kind: "hip", x: 620, y: -2100, w: 1880, h: 1620, floorId: "floor-b9fc8ff7-f6b0-4e9b-a154-89bed050dea9" },
  ],
  };
}

function makeTemplate(key: string): PlanState {
  const plan = buildTemplate(key);
  if (!hasTemplatePlan(key)) openTemplateStairwells(plan.floors, () => newId("room"));
  plan.roofs.forEach((item) => { item.floorId ??= plan.floors[plan.floors.length - 1].id; });
  return localizePlanNames(plan);
}

// テンプレートの部屋の名前と文字は、選んでいる言語で作る（作った後は利用者の書いた名前と同じに扱い、言語を変えても変えない）
function localizePlanNames(plan: PlanState): PlanState {
  if (getLanguage() === "ja") return plan;
  plan.floors.forEach((floor) => floor.entities.forEach((entity) => {
    if (entity.type === "room" && entity.name) entity.name = t(entity.name);
    if (entity.type === "text" && entity.text) entity.text = t(entity.text);
  }));
  return plan;
}

// 家具なし（間取りだけ）: 家具・小物を外す。階段と、川・小道・池・塀などの外まわりの形は残す
function structureOnly(plan: PlanState): PlanState {
  plan.floors.forEach((floor) => {
    floor.entities = floor.entities.filter((entity) => entity.type !== "furniture" || isStair(entity) || isFreeShapeKind(entity.kind));
  });
  return plan;
}

// テンプレートを名前で探す（ひらがな・カタカナ、全角・半角は同じに扱う）
function applyTemplateSearch(): void {
  const query = normalizeSearchText(document.querySelector<HTMLInputElement>("#templateSearch")?.value ?? "").trim();
  let shown = 0;
  document.querySelectorAll<HTMLElement>("#templateList .template-group").forEach((group) => {
    let visible = 0;
    group.querySelectorAll<HTMLButtonElement>("[data-template]").forEach((button) => {
      const match = !query || normalizeSearchText(`${button.textContent ?? ""} ${button.title} ${group.querySelector(".template-group-label")?.textContent ?? ""}`).includes(query);
      button.hidden = !match;
      if (match) visible += 1;
    });
    group.hidden = visible === 0;
    shown += visible;
  });
  const empty = document.querySelector<HTMLParagraphElement>("#templateEmpty");
  if (empty) empty.hidden = shown > 0;
}

// 左の「テンプレート」の一覧。種類ごとに見出しを付けて並べる
function buildTemplateList(): void {
  const list = document.querySelector<HTMLDivElement>("#templateList");
  if (!list) return;
  list.innerHTML = TEMPLATE_GROUPS.map((group) => `
    <div class="template-group">
      <p class="template-group-label">${escapeHtml(group.label)}</p>
      <div class="template-buttons">${group.templates.map((template) =>
        `<button type="button" data-template="${template.key}" title="${escapeHtml(template.title)}">${escapeHtml(template.label)}</button>`).join("")}</div>
    </div>`).join("");
}

function buildTemplate(key: string): PlanState {
  // 家・病院・洋館などのテンプレート（src/templates.ts）
  if (hasTemplatePlan(key)) {
    const plan = normalizePlan(templatePlan(key, newId, FURNITURE_DEFS));
    if (plan) return plan;
  }
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
          room("LDK", 0, 0, 460, 600, "#ffffff"),
          room("水回り", 460, 0, 260, 240, "#fbfcfd"),
          room("玄関", 460, 240, 260, 360, "#fcfbf9"),
          wall(0, 0, 720, 0),
          wall(720, 0, 720, 600),
          wall(720, 600, 0, 600),
          wall(0, 600, 0, 0),
          wall(460, 0, 460, 600),
          wall(460, 240, 720, 240),
          door(560, 600, 640, 600),
          door(460, 300, 460, 380),
          door(540, 240, 620, 240),
          windowLine(60, 0, 240, 0),
          windowLine(0, 140, 0, 320),
          windowLine(520, 0, 660, 0),
          windowLine(60, 600, 220, 600),
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
          room("書斎", 0, 280, 240, 320, "#fcfbf9"),
          { ...room("ホール", 240, 280, 240, 320, "#fdfdfc"), labelOffsetY: 240 },
          room("収納", 480, 280, 240, 320, "#fbfcfb"),
          wall(0, 0, 720, 0),
          wall(720, 0, 720, 600),
          wall(720, 600, 0, 600),
          wall(0, 600, 0, 0),
          wall(360, 0, 360, 280),
          wall(0, 280, 720, 280),
          wall(240, 280, 240, 600),
          wall(480, 280, 480, 600),
          door(260, 280, 330, 280),
          door(390, 280, 460, 280),
          door(240, 500, 240, 570),
          door(480, 500, 480, 570),
          windowLine(60, 0, 240, 0),
          windowLine(440, 0, 620, 0),
          windowLine(40, 600, 160, 600),
          windowLine(540, 600, 660, 600),
          windowLine(0, 80, 0, 200),
          furniture("bedDouble", 60, 40),
          furniture("closet", 200, 10),
          furniture("bed", 400, 40),
          furniture("desk", 560, 40),
          furniture("shelf", 620, 180),
          furniture("desk", 40, 320),
          furniture("shelf", 40, 410),
          furniture("wardrobe", 520, 300),
          furniture("closet", 520, 400),
        ]),
      ],
      activeFloor: 0,
      selectedId: null,
      roofs: [roof("gable", -40, -40, 800, 680)],
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

// 物と配列だけを写し、文字列はそのまま共有する（取り込んだ画像のような長い文字列を、取り消しの履歴の数だけ持たない）。
// JSON に書けない値（undefined）は、JSON で写したときと同じく落とす
function deepCopy<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => deepCopy(item)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) if (item !== undefined) out[key] = deepCopy(item);
    return out as T;
  }
  return value;
}

function cloneState(value: PlanState): PlanState {
  return deepCopy(value);
}

function cloneEntity(value: Entity): Entity {
  return deepCopy(value);
}

function findEntity(id: string): Entity | undefined {
  const roof = state.roofs.find((item) => item.id === id);
  if (roof) return roof;
  // 階ごとの配列をつなげずに探す（よく呼ばれるので、大きな間取りでも軽く）
  for (const floor of state.floors) {
    const entity = floor.entities.find((item) => item.id === id);
    if (entity) return entity;
  }
  return undefined;
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
      minY = Math.min(minY, entity.y - shapeRadiusY(entity));
      maxX = Math.max(maxX, entity.x + entity.r);
      maxY = Math.max(maxY, entity.y + shapeRadiusY(entity));
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
    material = new THREE.MeshStandardMaterial({ color, roughness: 0.82, name: "surface-plain" });
  } else {
    const map = new THREE.CanvasTexture(surfaceCanvas(surface, color));
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    const tile = surfaceTileCm(surface);
    map.repeat.set(rect.w / tile, rect.h / tile);
    map.offset.set((rect.x - roomItem.x) / tile, (roomItem.y + roomItem.h - rect.y - rect.h) / tile);
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    material = new THREE.MeshStandardMaterial({ map, roughness: SURFACE_DEFS[surface].roughness, metalness: SURFACE_DEFS[surface].metalness ?? 0, name: `surface-${surface}` });
  }
  makeTranslucent(material, colorAlpha(code));
  return material;
}

// カラーコードの末尾2桁（透明度）は、材質の透け具合にする
function coloredMaterial(color: string, roughness = 0.75): THREE.MeshStandardMaterial {
  const key = `${color}-${roughness}`;
  const cached = coloredMaterialCache.get(key);
  if (cached) return cached;
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(solidColor(color)), roughness, name: "plaster-colored" });
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

// 捨てる形・材質・模様。次に3Dを描いた後で捨てる。先に捨てると、作り直した同じ作りの材質のために
// 描く準備（シェーダーの組み立て）をやり直すことになり、作り直すたびに重くなる
const pendingDisposal = new Set<{ dispose(): void }>();

function disposeGroup(group: THREE.Group): void {
  const instanced: THREE.InstancedMesh[] = [];
  group.traverse((object) => {
    if ((object as THREE.InstancedMesh).isInstancedMesh) instanced.push(object as THREE.InstancedMesh);
    collectDisposables(object, pendingDisposal);
  });
  group.clear();
  instanced.forEach((mesh) => mesh.dispose());
  coloredMaterialCache.clear();
}

// 捨ててよい形・材質・模様を集める（ほかの物と共有している材質と、作り置きの物は残す）
function collectDisposables(object: THREE.Object3D, into: Set<{ dispose(): void }>): void {
  const mesh = object as THREE.Mesh;
  if (mesh.geometry && !cachedResources.has(mesh.geometry)) into.add(mesh.geometry);
  const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
  for (const material of materials) {
    if (sharedMaterials.has(material) || cachedResources.has(material)) continue;
    into.add(material);
    const map = (material as THREE.MeshStandardMaterial).map;
    if (map && !cachedResources.has(map)) into.add(map);
  }
}

function flushDisposal(): void {
  pendingDisposal.forEach((item) => item.dispose());
  pendingDisposal.clear();
}

// ---- 3Dの作り置き ----
// 同じ種類・大きさ・色の家具やドア・窓は、一度作った立体（形と材質）を写して使う。
// 作り置きはシーンを作り直しても捨てず、しばらく（作り直し数回のあいだ）使われなかったら捨てる
const MODEL_CACHE_KEEP = 3;
const modelCache = new Map<string, { model: THREE.Object3D; used: number }>();
const cachedResources = new WeakSet<object>();
let modelCacheRound = 0;

function cachedModel<T extends THREE.Object3D>(key: string, build: () => T): T {
  let entry = modelCache.get(key);
  if (!entry) {
    const model = build();
    model.traverse((object) => {
      const owned = new Set<{ dispose(): void }>();
      collectDisposables(object, owned);
      owned.forEach((item) => cachedResources.add(item));
    });
    entry = { model, used: modelCacheRound };
    modelCache.set(key, entry);
  }
  entry.used = modelCacheRound;
  return entry.model.clone() as T;
}

// しばらく使われなかった作り置きを捨てる。シーンにある物は、いまの作り直しで使った物だけなので、残る
function trimModelCache(): void {
  for (const [key, entry] of grassCache) if (modelCacheRound - entry.used >= MODEL_CACHE_KEEP) grassCache.delete(key);
  for (const [key, entry] of modelCache) {
    if (modelCacheRound - entry.used < MODEL_CACHE_KEEP) continue;
    modelCache.delete(key);
    entry.model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) pendingDisposal.add(mesh.geometry);
      for (const material of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) {
        if (sharedMaterials.has(material)) continue;
        pendingDisposal.add(material);
        const map = (material as THREE.MeshStandardMaterial).map;
        if (map) pendingDisposal.add(map);
      }
    });
  }
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
  if (shape.kind === "ellipse") {
    const count = Math.min(2048, Math.max(64, Math.ceil(Math.max(shape.r, shapeRadiusY(shape)) * Math.PI / 12)));
    for (let i = 0; i < count; i++) if (distanceToSegment(point, shapePoint(shape, i * Math.PI * 2 / count), shapePoint(shape, (i + 1) * Math.PI * 2 / count)) < threshold) return true;
    return false;
  }
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
void initI18n();
fitPlanToCanvas();
render2d();
rebuildThree();
applyViewMode(viewMode, false, true);
if (!PLAN_EDITION) animate3d();
