import { createIcons, icons } from "lucide";
import "./styles.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SURFACE_DEFS, SURFACE_TILE_CM, isRoomSurface, surfaceCanvas, type RoomSurface } from "./surfaces";
import { openingIntervals, segmentInterval, solidWallSections, visibleRectangles, type Rectangle } from "./geometry";
import { readStoredPlan, type Recovery } from "./persistence";
import { FURNITURE_DEFS, type FurnitureKind } from "./furniture-catalog";
import { buildFurnitureModel } from "./furniture-models";
import { buildOpeningModel } from "./opening-models";

type Tool = "select" | "room" | "wall" | "door" | "slidingDoor" | "window" | "window2" | "furniture" | "circle" | "arc" | "polygon" | "erase";
type EntityType = "room" | "wall" | "door" | "window" | "furniture" | "shape" | "roof";
type ShapeKind = "circle" | "arc" | "polygon";
type RoofKind = "gable" | "hip" | "flat";
type LegacyRoofKind = RoofKind | "none";
type LightDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw" | "top";
type DragMode = "draw" | "move" | "resize" | "label" | "pan" | "none";
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

type Entity = Room | LinearElement | Furniture | Shape | Roof;

interface Floor {
  id: string;
  name: string;
  entities: Entity[];
}

interface PlanState {
  floors: Floor[];
  activeFloor: number;
  selectedId: string | null;
  roofs: Roof[];
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
const ctx: CanvasRenderingContext2D = canvasContext;

const STORAGE_KEY = "madori-quick-3d-plan";
const VIEW_MODE_KEY = "madori-quick-3d-view-mode";
const DIMENSION_LABELS_KEY = "madori-quick-3d-dimension-labels";
const SHADOWS_KEY = "madori-quick-3d-shadows";
const LIGHT_DIRECTION_KEY = "madori-quick-3d-light-direction";
const LIGHT_LEVEL_KEY = "madori-quick-3d-light-level";
const GHOST_FLOOR_KEY = "madori-quick-3d-ghost-floor";
const MOBILE_NOTICE_KEY = "madori-quick-3d-mobile-notice";
const HISTORY_LIMIT = 60;
const GRID = 20;
const SCALE_3D = 0.01;
const WALL_THICKNESS_2D = 10;
const WALL_HEIGHT = 2.6;
const FLOOR_SLAB = 0.15;
const FLOOR_SPACING = WALL_HEIGHT + FLOOR_SLAB;
const MAX_FLOORS = 4;
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
  return Boolean(
    navigatorWithUserAgentData.userAgentData?.mobile ||
      isIpadOs ||
      /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle/i.test(navigator.userAgent),
  );
}

const INK = "#000000";
const INK_SOFT = "#5b6470";

// 家具は置く部屋ではなく種類で分ける。創作では部屋の種類が決まっていないことが多いため
const FURNITURE_CATEGORIES: { label: string; kinds: FurnitureKind[] }[] = [
  { label: "椅子・ソファ", kinds: ["sofa", "sofaCorner", "armchair", "chair", "stool", "bench"] },
  { label: "テーブル・机", kinds: ["diningTable", "roundTable", "table", "sideTable", "desk"] },
  { label: "ベッド", kinds: ["bed", "bedDouble"] },
  { label: "収納・棚", kinds: ["closet", "wardrobe", "shelf"] },
  { label: "家電", kinds: ["fridge", "washer", "tv"] },
  { label: "キッチン・水回り", kinds: ["kitchen", "bath", "toilet", "washbasin"] },
  { label: "インテリア", kinds: ["plant", "rug", "floorLamp", "wallClock", "grandfatherClock", "aquarium", "piano"] },
  { label: "乗り物", kinds: ["car"] },
];
// 階段は家具の種類分けに入れず、パレットでは床材や図形の壁と並べて下の方に置く
const STAIR_KINDS: FurnitureKind[] = ["stairs", "stairsU", "stairsSpiral"];

// 検索で表記ゆれ（ひらがな・別名）を拾うための語。表示名と分類名は自動で検索対象になる
const SEARCH_KEYWORDS: Record<string, string> = {
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
};

const ROOM_COLORS = ["#ffffff", "#fdfdfc", "#fbfcfd", "#fcfbf9", "#fbfcfb", "#fdfcfd"];
const ROOF_LABELS: Record<RoofKind, string> = {
  gable: "切妻",
  hip: "寄棟",
  flat: "陸屋根",
};

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
let activeRoomSurface: RoomSurface = "plain";
let activePolygonSides = 6;
let viewMode: ViewMode = loadViewMode();
let showDimensions = loadDimensionLabels();
let shadowsEnabled = loadShadowsEnabled();
let lightDirection: LightDirection = loadLightDirection();
let lightLevel = loadLightLevel();
let showGhostFloor = loadGhostFloor();
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
controls.minDistance = 4;
controls.maxDistance = 48;
controls.maxPolarAngle = Math.PI * 0.48;
controls.addEventListener("change", () => { threeNeedsRender = true; });

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

createIcons({ icons });
setupUi();
fitPlanToCanvas();
render2d();
rebuildThree();
applyViewMode(viewMode, false);
animate3d();

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
  const color = (input: unknown) => typeof input === "string" && /^#[0-9a-f]{6}$/i.test(input) ? input : undefined;
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
        name: typeof entity.name === "string" ? entity.name : "部屋",
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
      if (activeTool === "room") activeRoomSurface = "plain";
      setActiveButton("[data-surface]", activeTool === "room" ? activeRoomSurface : "");
      setActiveButton("[data-tool]", activeTool);
      syncPlanCursor();
    });
  });

  buildFurniturePicker();
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
    if (localStorage.getItem(MOBILE_NOTICE_KEY) === "dismissed") {
      mobileNotice.classList.add("is-dismissed");
    }
    document.querySelector<HTMLButtonElement>("#mobileNoticeClose")?.addEventListener("click", () => {
      mobileNotice.classList.add("is-dismissed");
      localStorage.setItem(MOBILE_NOTICE_KEY, "dismissed");
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

  appResizeObserver = new ResizeObserver(() => {
    resizeCanvases();
    render2d();
    render3dOnce();
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
  state.floors.forEach((floor, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `floor-tab${index === state.activeFloor ? " is-active" : ""}`;
    button.textContent = floor.name;
    button.title = `${floor.name}を編集`;
    button.addEventListener("click", () => setActiveFloorIndex(index));
    floorTabs.appendChild(button);
  });
  if (state.floors.length < MAX_FLOORS) {
    const add = document.createElement("button");
    add.type = "button";
    add.className = "floor-tab floor-tab-ghost";
    add.textContent = "＋";
    add.title = "上の階を追加";
    add.addEventListener("click", addFloorAbove);
    floorTabs.appendChild(add);
  }
  if (state.floors.length > 1) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "floor-tab floor-tab-ghost";
    remove.textContent = "×";
    remove.title = "表示中の階を削除";
    remove.addEventListener("click", removeActiveFloor);
    floorTabs.appendChild(remove);
  }
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

function addFloorAbove(): void {
  if (state.floors.length >= MAX_FLOORS) return;
  state.floors.push({ id: newId("floor"), name: `${state.floors.length + 1}F`, entities: [] });
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
  state.floors.splice(state.activeFloor, 1);
  state.floors.forEach((item, index) => {
    item.name = `${index + 1}F`;
  });
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
  planCanvas.style.cursor = activeTool === "select" ? "default" : activeTool === "erase" ? "not-allowed" : "crosshair";
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

function applyViewMode(nextMode: ViewMode, persist = true): void {
  viewMode = nextMode;
  workspace.dataset.viewMode = viewMode;
  workspace.classList.remove("is-active");
  setActiveButton("button[data-view-mode]", viewMode);
  if (persist) {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }
  requestAnimationFrame(() => {
    resizeCanvases();
    if (viewMode !== "three") {
      fitPlanToCanvas();
      render2d();
    }
    if (viewMode !== "plan") {
      frameCamera(getGlobalBounds());
      render3dOnce();
    }
  });
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
    planCanvas.style.cursor = hover.entity && isLocked(hover.entity) ? "not-allowed" : hover.corner === "label" ? "grab" : hover.corner ? "nwse-resize" : hover.entity ? "move" : "default";
  }

  if (drag.pointerId !== event.pointerId || drag.dragMode === "none") {
    return;
  }

  drag.currentWorld = point;

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

  if ((drag.dragMode === "move" || drag.dragMode === "resize" || drag.dragMode === "label") && drag.originEntity) {
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
    const point = threeFloorPoint(event, floorIndex * FLOOR_SPACING + (floorIndex === 0 ? 0.08 : 0));
    if (!point) return;
    const base = FURNITURE_DEFS[activeFurniture];
    furnitureItem = { id: newId("furniture"), type: "furniture", kind: activeFurniture, x: snap(point.x - base.w / 2), y: snap(point.y - base.h / 2), w: base.w, h: base.h, rotation: 0 };
  } else if (activeTool === "select" && selected?.type === "furniture" && !isLocked(selected)) {
    furnitureItem = selected;
    floorIndex = state.floors.findIndex((floor) => floor.entities.some((entity) => entity.id === selected.id));
  } else {
    return;
  }

  const planeY = floorIndex * FLOOR_SPACING + (floorIndex === 0 ? 0.08 : 0);
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

function setThreeRay(event: PointerEvent): void {
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
  const factor = event.deltaY > 0 ? 0.9 : 1.1;
  view.zoom = clamp(view.zoom * factor, 0.25, 3.6);
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
    name: `${activeRoomSurface === "grass" ? "草地" : activeRoomSurface === "stone" ? "石の床" : "部屋"} ${entities.filter((entity) => entity.type === "room").length + 1}`,
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
  if (entity.type === "furniture") {
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
  ctx.save();
  ctx.translate(view.x, view.y);
  ctx.scale(view.zoom, view.zoom);

  drawGrid(width, height);

  const entities = activeEntities();
  entities.filter(isRoom).forEach(drawRoom);
  // 現在の階の部屋の塗りの上・線画の下に、下階のゴーストを挟む
  drawFloorBelowGhost();
  entities.filter(isFurniture).filter((item) => item.kind === "rug").forEach(drawFurniture2d);
  entities.filter((entity): entity is LinearElement => entity.type === "wall").forEach((wallItem) => {
    getVisibleWallSegments(wallItem, entities).forEach(drawWall2d);
  });
  entities.filter((entity): entity is LinearElement => entity.type === "window").forEach(drawWindow2d);
  entities.filter((entity): entity is LinearElement => entity.type === "door").forEach(drawDoor2d);
  entities.filter(isFurniture).filter((item) => item.kind !== "rug").forEach(drawFurniture2d);
  entities.filter(isShape).forEach(drawShape2d);
  revealRoofsIfSelected();
  if (roofVisible2d) state.roofs.forEach(drawRoof2d);
  entities.filter(isLocked).forEach(drawLockedIndicator);
  if (roofVisible2d) state.roofs.filter(isLocked).forEach(drawLockedIndicator);

  if (drag.dragMode === "draw" && activeTool !== "furniture") {
    drawPreview(drag.startWorld, drag.currentWorld);
  }

  ctx.restore();
}

function drawGrid(canvasWidth: number, canvasHeight: number): void {
  const left = -view.x / view.zoom;
  const top = -view.y / view.zoom;
  const right = left + canvasWidth / view.zoom;
  const bottom = top + canvasHeight / view.zoom;
  const startX = Math.floor(left / GRID) * GRID;
  const startY = Math.floor(top / GRID) * GRID;

  ctx.lineWidth = 1 / view.zoom;
  for (let x = startX; x <= right; x += GRID) {
    ctx.beginPath();
    ctx.strokeStyle = x % (GRID * 5) === 0 ? "#e2e6ec" : "#f2f4f7";
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }
  for (let y = startY; y <= bottom; y += GRID) {
    ctx.beginPath();
    ctx.strokeStyle = y % (GRID * 5) === 0 ? "#e2e6ec" : "#f2f4f7";
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }
}

function drawFloorBelowGhost(): void {
  if (!showGhostFloor || state.activeFloor === 0) return;
  const below = state.floors[state.activeFloor - 1];
  const entities = below.entities;
  ctx.save();
  // 下の階のすべての要素をごく薄い半透明で描く
  ctx.globalAlpha = 0.13;
  entities.filter(isRoom).forEach(drawRoom);
  entities.filter((entity): entity is LinearElement => entity.type === "wall").forEach((wallItem) => {
    getVisibleWallSegments(wallItem, entities).forEach(drawWall2d);
  });
  entities.filter((entity): entity is LinearElement => entity.type === "window").forEach(drawWindow2d);
  entities.filter((entity): entity is LinearElement => entity.type === "door").forEach(drawDoor2d);
  entities.filter(isFurniture).forEach(drawFurniture2d);
  entities.filter(isShape).forEach(drawShape2d);
  ctx.restore();
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
  const pattern = surface !== "plain" ? ctx.createPattern(surfaceCanvas(surface, room.color), "repeat") : null;
  pattern?.setTransform(new DOMMatrix().translate(room.x, room.y).scale(SURFACE_TILE_CM / 256));
  ctx.fillStyle = pattern ?? room.color;
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
  ctx.fillText(room.name, label.x, label.y);
  if (showDimensions) {
    ctx.fillStyle = INK_SOFT;
    ctx.font = `${Math.max(10, 11 / view.zoom)}px "Yu Gothic UI", sans-serif`;
    ctx.fillText(`${formatMeters(room.w)} x ${formatMeters(room.h)}`, label.x, label.y + 20);
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
  drawLineElement(wallItem, wallItem.color ?? INK, WALL_THICKNESS_2D);
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
  ctx.strokeStyle = selected ? "#2775d1" : windowEl.color ?? INK;
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
  ctx.strokeStyle = selected ? "#2775d1" : door.color ?? INK;
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
  ctx.strokeStyle = selected ? "#2775d1" : door.color ?? INK;
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
  strokeRoundedRect(cx - size / 2, cy - size / 2, size, size, 3, true);
  strokeLine(cx - size / 2 + 2, cy + backSide * (size / 2 - 3), cx + size / 2 - 2, cy + backSide * (size / 2 - 3));
}

function drawFurniture2d(furnitureItem: Furniture): void {
  const selected = state.selectedId === furnitureItem.id;
  ctx.save();
  ctx.translate(furnitureItem.x + furnitureItem.w / 2, furnitureItem.y + furnitureItem.h / 2);
  ctx.rotate((furnitureItem.rotation * Math.PI) / 180);
  if (furnitureItem.flip) ctx.scale(-1, 1);
  ctx.lineWidth = 1.4 / view.zoom;
  ctx.strokeStyle = furnitureItem.color ?? INK;
  ctx.fillStyle = "#ffffff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (["sofa", "sofaCorner", "armchair", "stool", "bed", "bedDouble"].includes(furnitureItem.kind)) ctx.fillStyle = "#edf3f2";
  if (["table", "sideTable", "roundTable", "desk", "bench", "shelf", "closet", "wardrobe"].includes(furnitureItem.kind)) ctx.fillStyle = "#f7f5f0";
  drawFurnitureSymbol(furnitureItem.kind, furnitureItem.w, furnitureItem.h);
  if (selected) {
    ctx.strokeStyle = "#2775d1";
    ctx.lineWidth = 2.2 / view.zoom;
    strokeRoundedRect(-furnitureItem.w / 2, -furnitureItem.h / 2, furnitureItem.w, furnitureItem.h, 4);
  }
  ctx.restore();
  if (selected && !isLocked(furnitureItem)) drawResizeHandles(furnitureItem);
}

function drawFurnitureSymbol(kind: FurnitureKind, w: number, h: number): void {
  const hw = w / 2;
  const hh = h / 2;
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
        strokeEllipse(0, 0, w * 0.22, h * 0.22);
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
      strokeRoundedRect(-hw, -hh, w, h, 3, true);
      strokeRoundedRect(-w * 0.42, -hh + 3, w * 0.84, Math.max(5, h * 0.18), 2);
      for (const sign of [-1, 1]) strokeLine(sign * w * 0.26, -h * 0.29, sign * w * 0.31, h * 0.14);
      strokeLine(-w * 0.17, h * 0.4, -w * 0.17, hh);
      strokeLine(w * 0.17, h * 0.4, w * 0.17, hh);
      break;
    }
    case "plant": {
      ctx.fillStyle = "#e8f1e7";
      strokeEllipse(0, 0, w * 0.22, h * 0.22, true);
      for (let i = 0; i < 8; i += 1) {
        ctx.save();
        ctx.scale(w / Math.max(w, h), h / Math.max(w, h));
        ctx.rotate((i / 8) * Math.PI * 2);
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
      strokeRoundedRect(-hw, -hh, w, h, 4, true);
      strokeLine(-hw + 3, -hh + 4, hw - 3, -hh + 4);
      strokeRoundedRect(-w * 0.37, -h * 0.28, w * 0.74, h * 0.66, 4);
      const legRadius = Math.max(1.8, Math.min(w, h) * 0.055);
      [
        [-hw + legRadius * 1.8, -hh + legRadius * 1.8],
        [hw - legRadius * 1.8, -hh + legRadius * 1.8],
        [-hw + legRadius * 1.8, hh - legRadius * 1.8],
        [hw - legRadius * 1.8, hh - legRadius * 1.8],
      ].forEach(([x, y]) => strokeCircle(x, y, legRadius));
      break;
    }
    case "kitchen": {
      strokeRoundedRect(-hw, -hh, w, h, 2, true);
      strokeRoundedRect(-hw + w * 0.07, -h * 0.3, w * 0.24, h * 0.6, 5);
      strokeCircle(-hw + w * 0.19, -hh + h * 0.12, 2.5);
      const bx = hw - w * 0.16;
      const br = h * 0.17;
      strokeCircle(bx, -h * 0.2, br);
      strokeCircle(bx, h * 0.2, br);
      strokeCircle(bx - w * 0.14, 0, br * 0.8);
      strokeRoundedRect(w * 0.06, -h * 0.39, w * 0.39, h * 0.78, 2);
      const doors = Math.max(2, Math.min(8, Math.round(w / 60)));
      for (let i = 1; i < doors; i += 1) strokeLine(-hw + i * w / doors, hh - h * 0.09, -hw + i * w / doors, hh);
      break;
    }
    case "fridge": {
      strokeRoundedRect(-hw, -hh, w, h, 3, true);
      strokeLine(-hw + 3, hh - h * 0.18, hw - 3, hh - h * 0.18);
      strokeLine(-hw + w * 0.16, hh - h * 0.09, -hw + w * 0.38, hh - h * 0.09);
      strokeRoundedRect(-w * 0.45, -h * 0.45, w * 0.9, h * 0.74, 2);
      break;
    }
    case "bed":
    case "bedDouble": {
      strokeRoundedRect(-hw, -hh, w, h, 4, true);
      strokeRoundedRect(-w * 0.45, -h * 0.48, w * 0.9, h * 0.035, 2);
      if (kind === "bed") {
        strokeRoundedRect(-w * 0.28, -hh + h * 0.04, w * 0.56, h * 0.1, 4);
      } else {
        strokeRoundedRect(-w * 0.43, -hh + h * 0.04, w * 0.37, h * 0.1, 4);
        strokeRoundedRect(w * 0.06, -hh + h * 0.04, w * 0.37, h * 0.1, 4);
      }
      strokeLine(-hw, -hh + h * 0.24, hw, -hh + h * 0.24);
      strokeLine(hw - w * 0.3, -hh + h * 0.24, hw, -hh + h * 0.24 + h * 0.12);
      strokeLine(-w * 0.47, h * 0.38, w * 0.47, h * 0.38);
      break;
    }
    case "desk": {
      strokeRoundedRect(-hw, -hh, w, h, 3, true);
      strokeRoundedRect(w * 0.15, -h * 0.38, w * 0.28, h * 0.76, 2);
      strokeLine(w * 0.23, h * 0.32, w * 0.35, h * 0.32);
      strokeCircle(-w * 0.3, -h * 0.32, Math.min(w, h) * 0.025);
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
      strokeRoundedRect(-hw, -hh, w, h, 2, true);
      ctx.save();
      ctx.beginPath();
      ctx.rect(-hw, -hh, w, h);
      ctx.clip();
      for (let x = -hw - h; x < hw; x += 16) {
        strokeLine(x, hh, x + h, -hh);
      }
      ctx.restore();
      strokeLine(0, h * 0.38, 0, hh);
      strokeLine(-w * 0.12, h * 0.42, -w * 0.04, h * 0.42);
      strokeLine(w * 0.04, h * 0.42, w * 0.12, h * 0.42);
      break;
    }
    case "wardrobe": {
      strokeRoundedRect(-hw, -hh, w, h, 2, true);
      strokeLine(0, -h * 0.4, 0, h * 0.42);
      strokeRoundedRect(-w * 0.45, -h * 0.4, w * 0.9, h * 0.83, 2);
      for (const sign of [-1, 1]) strokeLine(sign * w * 0.15, h * 0.35, sign * w * 0.33, h * 0.35);
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
    default: {
      strokeRoundedRect(-hw, -hh, w, h, 4, true);
    }
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
  ctx.strokeStyle = shape.color ?? INK;
  ctx.lineWidth = WALL_THICKNESS_2D;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  traceShapePath(shape);
  ctx.stroke();
  if (selected && !isLocked(shape)) {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#2775d1";
    ctx.lineWidth = 2 / view.zoom;
    const size = 8 / view.zoom;
    ctx.fillRect(shape.x - size / 2, shape.y - size / 2, size, size);
    ctx.strokeRect(shape.x - size / 2, shape.y - size / 2, size, size);
  }
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

function drawLockedIndicator(entity: Entity): void {
  let anchor: Point;
  if (entity.type === "room" || entity.type === "roof") {
    anchor = { x: entity.x + entity.w - 16 / view.zoom, y: entity.y + 16 / view.zoom };
  } else if (entity.type === "furniture") {
    anchor = { x: entity.x + entity.w / 2, y: entity.y + entity.h / 2 };
  } else if (entity.type === "shape") {
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
    const yBase = index * FLOOR_SPACING;
    // 笠木（壁上端のキャップ）は最上階のみ。途中階は上階の壁と面一に continuous させる
    const withCap = index === topVisibleIndex;
    const rooms = floor.entities.filter(isRoom);
    rooms.forEach((roomItem, roomIndex) => addRoom3d(roomItem, center, yBase, index, rooms.slice(roomIndex + 1)));
    floor.entities
      .filter((entity): entity is LinearElement => entity.type === "wall")
      .forEach((wallItem) => addWall3d(wallItem, floor.entities, center, yBase, withCap));
    floor.entities.filter(isShape).forEach((shape) => addShapeWall3d(shape, center, yBase, withCap));
    floor.entities
      .filter((entity): entity is LinearElement => entity.type === "door")
      .forEach((door) => addDoor3d(door, center, yBase));
    floor.entities
      .filter((entity): entity is LinearElement => entity.type === "window")
      .forEach((windowEl) => addWindow3d(windowEl, center, yBase));
    floor.entities.filter(isFurniture).forEach((furnitureItem) => addFurniture3d(furnitureItem, center, yBase));
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
  updateUi();
}

function addRoom3d(roomItem: Room, center: Point, yBase: number, floorIndex: number, laterRooms: Room[]): void {
  const slabInset = floorIndex === 0 ? 0 : WALL_THICKNESS_2D;
  const footprint = (item: Room): Rectangle => ({ x: item.x + slabInset / 2, y: item.y + slabInset / 2, w: Math.max(item.w - slabInset, 10), h: Math.max(item.h - slabInset, 10) });
  const thickness = floorIndex === 0 ? 0.08 : FLOOR_SLAB;
  const group = new THREE.Group();
  for (const rect of visibleRectangles(footprint(roomItem), laterRooms.map(footprint))) {
    const geometry = new THREE.BoxGeometry(rect.w * SCALE_3D, thickness, rect.h * SCALE_3D);
    const mesh = new THREE.Mesh(geometry, [slabMaterial, slabMaterial, roomMaterial(roomItem, rect), slabMaterial, slabMaterial, slabMaterial]);
    const pos = to3d(rect.x + rect.w / 2, rect.y + rect.h / 2, center);
    mesh.position.set(pos.x, floorIndex === 0 ? thickness / 2 : yBase - thickness / 2, pos.z);
    mesh.receiveShadow = true;
    mesh.castShadow = floorIndex > 0;
    group.add(mesh);
  }
  if (!group.children.length) return;
  markSelectable(group, roomItem.id);
  planGroup.add(group);
  addSelectionBox(group, roomItem.id);
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
  const bottomExtension = yBase > 0 && yFrom === 0 ? FLOOR_SLAB : 0;
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
  mesh.castShadow = true;
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
    cap.castShadow = true;
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
  const topY = topIndex * FLOOR_SPACING + WALL_HEIGHT + 0.06;

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
  const buildingHeight = state.floors.length * FLOOR_SPACING;
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
  const totalParts = state.floors.reduce((sum, floor) => sum + floor.entities.length, 0);
  threeStats.textContent = `${state.floors.length}階建て・部材${totalParts}・屋根${state.roofs.length}`;
}

function updatePropertiesPanel(): void {
  const selected = state.selectedId ? findEntity(state.selectedId) : null;
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
        <label>名前<input id="roomNameInput" value="${escapeHtml(selected.name)}" /></label>
        <label>床材<select id="roomSurfaceInput">${(Object.keys(SURFACE_DEFS) as RoomSurface[]).map((surface) => `<option value="${surface}" ${surface === (selected.surface ?? "plain") ? "selected" : ""}>${SURFACE_DEFS[surface].label}</option>`).join("")}</select></label>
        <div class="two-col">
          <label>幅 cm<input id="roomWInput" type="number" min="40" step="20" value="${selected.w}" ${placementDisabled} /></label>
          <label>奥行 cm<input id="roomHInput" type="number" min="40" step="20" value="${selected.h}" ${placementDisabled} /></label>
        </div>
        <div class="two-col">
          <label>色 2D<input id="roomColorInput" type="color" value="${selected.color}" /></label>
          <label>色 3D<input id="roomColor3dInput" type="color" value="${selected.color3d ?? selected.color}" /></label>
        </div>
        <button type="button" class="prop-button" id="roomRotateButton" ${placementDisabled}>90°回転（Rキー）</button>
      </div>
    `;
    bindEntityLock(selected);
    bindInput("#roomNameInput", (value) => (selected.name = value));
    bindSelect("#roomSurfaceInput", (value) => {
      if (!isRoomSurface(value)) return;
      selected.surface = value;
      selected.color = SURFACE_DEFS[value].color;
      selected.color3d = SURFACE_DEFS[value].color;
    });
    bindNumber("#roomWInput", (value) => (selected.w = Math.max(GRID * 2, snap(value))));
    bindNumber("#roomHInput", (value) => (selected.h = Math.max(GRID * 2, snap(value))));
    bindInput("#roomColorInput", (value) => (selected.color = value));
    bindInput("#roomColor3dInput", (value) => (selected.color3d = value));
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
        <div class="two-col">
          <label>色 2D<input id="lineColorInput" type="color" value="${selected.color ?? "#000000"}" /></label>
          <label>色 3D<input id="lineColor3dInput" type="color" value="${selected.color3d ?? selected.color ?? default3d}" /></label>
        </div>
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
    bindInput("#lineColorInput", (value) => (selected.color = value));
    bindInput("#lineColor3dInput", (value) => (selected.color3d = value));
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
        <div class="two-col">
          <label>色 2D<input id="shapeColorInput" type="color" value="${selectedShape.color ?? "#000000"}" /></label>
          <label>色 3D<input id="shapeColor3dInput" type="color" value="${selectedShape.color3d ?? selectedShape.color ?? "#f4f1ec"}" /></label>
        </div>
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
    bindInput("#shapeColorInput", (value) => (selectedShape.color = value));
    bindInput("#shapeColor3dInput", (value) => (selectedShape.color3d = value));
    return;
  }

  const selectedFurniture = selected as Furniture;
  const kindOptions = [...FURNITURE_CATEGORIES, { label: "階段", kinds: STAIR_KINDS }].map(
    (category) =>
      `<optgroup label="${category.label}">` +
      category.kinds
        .map((kind) => `<option value="${kind}" ${kind === selectedFurniture.kind ? "selected" : ""}>${FURNITURE_DEFS[kind].label}</option>`)
        .join("") +
      `</optgroup>`,
  ).join("");
  propertiesPanel.innerHTML = `
    <div class="property-grid">
      ${lockRow}
      <label>種類
        <select id="furnitureKindInput" ${placementDisabled}>${kindOptions}</select>
      </label>
      <div class="two-col">
        <label>幅 cm<input id="furnitureWInput" type="number" min="20" step="20" value="${selectedFurniture.w}" ${placementDisabled} /></label>
        <label>奥行 cm<input id="furnitureHInput" type="number" min="20" step="20" value="${selectedFurniture.h}" ${placementDisabled} /></label>
      </div>
      <label>回転（R: 90° / Shift+R: 15°）<input id="furnitureRotationInput" type="number" step="5" value="${selectedFurniture.rotation}" ${placementDisabled} /></label>
      <label class="check"><input id="furnitureFlipInput" type="checkbox" ${selectedFurniture.flip ? "checked" : ""} ${placementDisabled} /> 左右反転（Fキー）</label>
      <div class="two-col">
        <label>色 2D<input id="furnitureColorInput" type="color" value="${selectedFurniture.color ?? "#000000"}" /></label>
        <label>色 3D<input id="furnitureColor3dInput" type="color" value="${selectedFurniture.color3d ?? selectedFurniture.color ?? "#b9c0c8"}" /></label>
      </div>
    </div>
  `;
  bindEntityLock(selectedFurniture);
  bindSelect("#furnitureKindInput", (value) => {
    const kind = value as FurnitureKind;
    const def = FURNITURE_DEFS[kind];
    selectedFurniture.kind = kind;
    selectedFurniture.w = def.w;
    selectedFurniture.h = def.h;
  });
  bindNumber("#furnitureWInput", (value) => (selectedFurniture.w = Math.max(GRID, snap(value))));
  bindNumber("#furnitureHInput", (value) => (selectedFurniture.h = Math.max(GRID, snap(value))));
  bindNumber("#furnitureRotationInput", (value) => (selectedFurniture.rotation = value % 360));
  bindCheckbox("#furnitureFlipInput", (checked) => (selectedFurniture.flip = checked));
  bindInput("#furnitureColorInput", (value) => (selectedFurniture.color = value));
  bindInput("#furnitureColor3dInput", (value) => (selectedFurniture.color3d = value));
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
  const zoom = clamp(Math.min(zoomX, zoomY), 0.25, 2.2);
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
  hiddenFloorIds.clear();
  roofVisible2d = true;
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
  const layer = (entity: Entity): number => entity.type === "room" ? 0 : entity.type === "furniture" && entity.kind === "rug" ? 1 : entity.type === "wall" ? 2 : entity.type === "window" ? 3 : entity.type === "door" ? 4 : entity.type === "furniture" ? 5 : 6;
  const entities = [...activeEntities()].sort((a, b) => layer(a) - layer(b));
  const selectedRoof = roofVisible2d ? state.roofs.find((item) => item.id === state.selectedId) : undefined;
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
    } else if (entity.type === "furniture") {
      const corner = getCornerHit(entity, point);
      if (corner) return { entity, corner };
      const angle = degreesToRadians(entity.rotation);
      const dx = point.x - entity.x - entity.w / 2;
      const dy = point.y - entity.y - entity.h / 2;
      const localX = dx * Math.cos(angle) + dy * Math.sin(angle);
      const localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
      if (Math.abs(localX) <= entity.w / 2 && Math.abs(localY) <= entity.h / 2) {
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
  for (let i = roofVisible2d ? state.roofs.length - 1 : -1; i >= 0; i -= 1) {
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
  if (!room.name.trim() && !showDimensions) return null;
  const position = getRoomLabelPosition(room);
  const nameWidth = Math.max(36, room.name.length * 14);
  const dimensionWidth = showDimensions ? 82 : 0;
  return {
    x: position.x - 6,
    y: position.y - 5,
    w: Math.max(nameWidth, dimensionWidth) + 12,
    h: showDimensions ? 44 : 26,
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
  const color = roomItem.color3d ?? roomItem.color;
  if (surface === "plain") return new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
  const map = new THREE.CanvasTexture(surfaceCanvas(surface, color));
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(rect.w / SURFACE_TILE_CM, rect.h / SURFACE_TILE_CM);
  map.offset.set((rect.x - roomItem.x) / SURFACE_TILE_CM, (roomItem.y + roomItem.h - rect.y - rect.h) / SURFACE_TILE_CM);
  map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return new THREE.MeshStandardMaterial({ map, roughness: SURFACE_DEFS[surface].roughness });
}

function coloredMaterial(color: string, roughness = 0.75): THREE.MeshStandardMaterial {
  const key = `${color}-${roughness}`;
  const cached = coloredMaterialCache.get(key);
  if (cached) return cached;
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness });
  coloredMaterialCache.set(key, material);
  return material;
}

function disposeGroup(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  group.traverse((object) => {
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
