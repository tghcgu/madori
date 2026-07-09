import { createIcons, icons } from "lucide";
import "./styles.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type Tool = "select" | "room" | "wall" | "door" | "window" | "window2" | "furniture" | "circle" | "arc" | "erase";
type EntityType = "room" | "wall" | "door" | "window" | "furniture" | "shape";
type FurnitureKind =
  | "sofa"
  | "armchair"
  | "table"
  | "tv"
  | "plant"
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
  | "car";
type ShapeKind = "circle" | "arc";
type RoofKind = "none" | "gable" | "hip" | "flat";
type LightDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw" | "top";
type DragMode = "draw" | "move" | "resize" | "label" | "pan" | "none";
type Direction = "horizontal" | "vertical";
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
  labelOffsetX?: number;
  labelOffsetY?: number;
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
  color?: string;
  color3d?: string;
}

type Entity = Room | LinearElement | Furniture | Shape;

interface Floor {
  id: string;
  name: string;
  entities: Entity[];
}

interface PlanState {
  floors: Floor[];
  activeFloor: number;
  selectedId: string | null;
  roof: RoofKind;
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
const HISTORY_LIMIT = 60;
const GRID = 20;
const SCALE_3D = 0.01;
const WALL_THICKNESS_2D = 10;
const WALL_HEIGHT = 2.6;
const FLOOR_SLAB = 0.15;
const FLOOR_SPACING = WALL_HEIGHT + FLOOR_SLAB;
const MAX_FLOORS = 4;

const INK = "#000000";
const INK_SOFT = "#5b6470";
const GHOST = "#d4d9e0";

interface FurnitureDef {
  label: string;
  w: number;
  h: number;
}

const FURNITURE_DEFS: Record<FurnitureKind, FurnitureDef> = {
  sofa: { label: "ソファ", w: 170, h: 80 },
  armchair: { label: "1人掛け", w: 80, h: 80 },
  table: { label: "ローテーブル", w: 100, h: 50 },
  tv: { label: "テレビ台", w: 120, h: 40 },
  plant: { label: "観葉植物", w: 40, h: 40 },
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
};

const FURNITURE_CATEGORIES: { label: string; kinds: FurnitureKind[] }[] = [
  { label: "リビング", kinds: ["sofa", "armchair", "table", "tv", "plant"] },
  { label: "ダイニング・キッチン", kinds: ["diningTable", "chair", "kitchen", "fridge"] },
  { label: "寝室・書斎", kinds: ["bed", "bedDouble", "desk", "shelf"] },
  { label: "水回り", kinds: ["bath", "toilet", "washbasin", "washer"] },
  { label: "収納", kinds: ["closet", "wardrobe"] },
  { label: "階段", kinds: ["stairs", "stairsU", "stairsSpiral"] },
  { label: "屋外", kinds: ["car"] },
];

const ROOM_COLORS = ["#ffffff", "#fdfdfc", "#fbfcfd", "#fcfbf9", "#fbfcfb", "#fdfcfd"];

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

// 3D palette
const COLOR_WOOD = 0xb59a76;
const COLOR_WOOD_DARK = 0x8a6f52;
const COLOR_FABRIC = 0x8ea0b5;
const COLOR_WHITE = 0xf3f4f2;
const COLOR_STEEL = 0xd7dbde;
const COLOR_GREEN = 0x6f9e63;
const COLOR_CERAMIC = 0xf0f4f5;
const COLOR_DARK = 0x2c3238;

let activeTool: Tool = "select";
let activeFurniture: FurnitureKind = "sofa";
let viewMode: ViewMode = loadViewMode();
let showDimensions = loadDimensionLabels();
let shadowsEnabled = loadShadowsEnabled();
let lightDirection: LightDirection = loadLightDirection();
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
let pendingCameraFrame = true;
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

const roomMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f1ec, roughness: 0.78 });
const wallCapMaterial = new THREE.MeshStandardMaterial({ color: 0xe2ddd5, roughness: 0.8 });
const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x99683d, roughness: 0.72 });
const doorFrameMaterial = new THREE.MeshStandardMaterial({ color: 0xd8d2c8, roughness: 0.74 });
const windowFrameMaterial = new THREE.MeshStandardMaterial({ color: 0xdfe5ea, roughness: 0.52, metalness: 0.08 });
const windowMaterial = new THREE.MeshStandardMaterial({
  color: 0x78b8d8,
  transparent: true,
  opacity: 0.42,
  roughness: 0.18,
  metalness: 0.05,
});
const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x405064, transparent: true, opacity: 0.55 });
const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x5d6773, roughness: 0.86, side: THREE.DoubleSide });
const slabMaterial = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.85 });

createIcons({ icons });
setupUi();
fitPlanToCanvas();
render2d();
rebuildThree();
applyViewMode(viewMode, false);
animate3d();

function isRoofKind(value: unknown): value is RoofKind {
  return value === "none" || value === "gable" || value === "hip" || value === "flat";
}

function normalizePlan(parsed: unknown): PlanState | null {
  const data = parsed as Partial<PlanState> & { entities?: Entity[] };
  if (data && Array.isArray(data.floors)) {
    const floors: Floor[] = data.floors
      .filter((floor): floor is Floor => Boolean(floor) && Array.isArray((floor as Floor).entities))
      .map((floor, index) => ({
        id: floor.id ?? newId("room"),
        name: `${index + 1}F`,
        entities: floor.entities,
      }));
    if (floors.length === 0) return null;
    return {
      floors,
      activeFloor: clamp(Math.round(Number(data.activeFloor ?? 0)) || 0, 0, floors.length - 1),
      selectedId: data.selectedId ?? null,
      roof: isRoofKind(data.roof) ? data.roof : "none",
    };
  }
  if (data && Array.isArray(data.entities)) {
    return {
      floors: [{ id: newId("floor"), name: "1F", entities: data.entities }],
      activeFloor: 0,
      selectedId: data.selectedId ?? null,
      roof: "none",
    };
  }
  return null;
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
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const normalized = normalizePlan(JSON.parse(raw));
      if (normalized) return normalized;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return makeTemplate("oneLdk");
}

function emptyState(): PlanState {
  return {
    floors: [{ id: newId("floor"), name: "1F", entities: [] }],
    activeFloor: 0,
    selectedId: null,
    roof: "none",
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
  return localStorage.getItem(SHADOWS_KEY) !== "off";
}

function loadLightDirection(): LightDirection {
  const stored = localStorage.getItem(LIGHT_DIRECTION_KEY);
  return stored && stored in LIGHT_POSITIONS ? (stored as LightDirection) : "se";
}

function applyLightSettings(): void {
  const [x, y, z] = LIGHT_POSITIONS[lightDirection];
  sunLight.position.set(x, y, z);
  sunLight.castShadow = shadowsEnabled;
  renderer.shadowMap.enabled = shadowsEnabled;
  renderer.shadowMap.needsUpdate = true;
  // shadowMap.enabled の切替は既存マテリアルに反映されないため再コンパイルを強制する
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) {
      material.forEach((item) => (item.needsUpdate = true));
    } else if (material) {
      material.needsUpdate = true;
    }
  });
}

function activeFloor(): Floor {
  return state.floors[state.activeFloor];
}

function activeEntities(): Entity[] {
  return activeFloor().entities;
}

function setActiveEntities(entities: Entity[]): void {
  activeFloor().entities = entities;
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
      setActiveButton("[data-tool]", activeTool);
      syncPlanCursor();
    });
  });

  buildFurniturePicker();

  document.querySelectorAll<HTMLButtonElement>("[data-roof]").forEach((button) => {
    button.addEventListener("click", () => {
      state.roof = button.dataset.roof as RoofKind;
      commitState();
      rebuildThree();
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
    render2d();
  });

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

  document.querySelector<HTMLButtonElement>("#undoButton")?.addEventListener("click", undo);
  document.querySelector<HTMLButtonElement>("#redoButton")?.addEventListener("click", redo);
  document.querySelector<HTMLButtonElement>("#fitButton")?.addEventListener("click", () => {
    fitPlanToCanvas();
    render2d();
    frameCamera(getGlobalBounds());
  });
  document.querySelector<HTMLButtonElement>("#resetButton")?.addEventListener("click", () => {
    replaceState(emptyState(), true);
  });
  document.querySelector<HTMLButtonElement>("#exportButton")?.addEventListener("click", exportPlan);
  document.querySelector<HTMLButtonElement>("#importButton")?.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", importPlan);

  planCanvas.addEventListener("pointerdown", handlePointerDown);
  planCanvas.addEventListener("pointermove", handlePointerMove);
  planCanvas.addEventListener("pointerup", handlePointerUp);
  planCanvas.addEventListener("pointercancel", handlePointerUp);
  planCanvas.addEventListener("wheel", handleWheel, { passive: false });
  planCanvas.addEventListener("contextmenu", (event) => event.preventDefault());
  planCanvas.addEventListener("dblclick", handleDoubleClick);
  threeCanvas.addEventListener("pointerdown", handleThreePointerDown);
  threeCanvas.addEventListener("pointerup", handleThreePointerUp);
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

  const fittings = document.createElement("details");
  fittings.className = "furniture-category";
  fittings.open = true;
  const fittingsSummary = document.createElement("summary");
  fittingsSummary.textContent = "建具（ドア・窓）";
  fittings.appendChild(fittingsSummary);
  const fittingsItems = document.createElement("div");
  fittingsItems.className = "furniture-items";
  ([
    ["door", "ドア"],
    ["window", "窓"],
    ["window2", "窓（区切付き）"],
  ] as [Tool, string][]).forEach(([tool, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.tool = tool;
    button.textContent = label;
    button.addEventListener("click", () => {
      activeTool = tool;
      setActiveButton("[data-tool]", activeTool);
      syncPlanCursor();
    });
    fittingsItems.appendChild(button);
  });
  fittings.appendChild(fittingsItems);
  furniturePicker.appendChild(fittings);

  FURNITURE_CATEGORIES.forEach((category, categoryIndex) => {
    const details = document.createElement("details");
    details.className = "furniture-category";
    if (categoryIndex === 0) details.open = true;
    const summary = document.createElement("summary");
    summary.textContent = category.label;
    details.appendChild(summary);
    const items = document.createElement("div");
    items.className = "furniture-items";
    category.kinds.forEach((kind) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.furniture = kind;
      button.textContent = FURNITURE_DEFS[kind].label;
      if (kind === activeFurniture) button.classList.add("is-active");
      button.addEventListener("click", () => {
        activeFurniture = kind;
        setActiveButton("[data-furniture]", activeFurniture);
        activeTool = "furniture";
        setActiveButton("[data-tool]", activeTool);
        syncPlanCursor();
      });
      items.appendChild(button);
    });
    details.appendChild(items);
    furniturePicker.appendChild(details);
  });
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
  if (state.floors.length <= 1) return;
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
  if (!window.confirm(`${floor.name}（${floor.entities.length}個の要素）を削除します。実行しますか？`)) {
    return;
  }
  hiddenFloorIds.delete(floor.id);
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
    const dataValue = button.dataset.tool ?? button.dataset.furniture ?? button.dataset.viewMode ?? button.dataset.roof;
    button.classList.toggle("is-active", dataValue === value);
  });
}

function syncPlanCursor(): void {
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
      render2d();
    }
    render3dOnce();
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
    if (hit.entity) {
      setActiveEntities(activeEntities().filter((entity) => entity.id !== hit.entity?.id));
      if (state.selectedId === hit.entity.id) state.selectedId = null;
      commitState();
      redrawAll();
    }
    drag.dragMode = "none";
    return;
  }

  if (activeTool === "select") {
    state.selectedId = hit.entity?.id ?? null;
    if (hit.entity?.type === "room" && hit.corner === "label") {
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
    planCanvas.style.cursor = hover.corner === "label" ? "grab" : hover.corner ? "nwse-resize" : hover.entity ? "move" : "default";
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
    if (activeTool === "window") addLineFromDrag("window", start, end);
    if (activeTool === "window2") addLineFromDrag("window", start, end, true);
    if (activeTool === "circle") addShapeFromDrag("circle", start, end);
    if (activeTool === "arc") addShapeFromDrag("arc", start, end);
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
  threePointerDown = { x: event.clientX, y: event.clientY };
}

function handleThreePointerUp(event: PointerEvent): void {
  if (!threePointerDown) return;
  const moved = Math.hypot(event.clientX - threePointerDown.x, event.clientY - threePointerDown.y);
  threePointerDown = null;
  if (moved > 6) return;

  const rect = threeCanvas.getBoundingClientRect();
  pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObjects(planGroup.children, true);
  const entityId = hits.map((hit) => entityIdFromObject(hit.object)).find((id): id is string => Boolean(id)) ?? null;

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
  view.zoom = clamp(view.zoom * factor, 0.35, 3.6);
  const after = screenToWorld(event);
  view.x += (after.x - before.x) * view.zoom;
  view.y += (after.y - before.y) * view.zoom;
  render2d();
}

function handleKeyDown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  const isEditing = target?.tagName === "INPUT" || target?.tagName === "SELECT";
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
  if (!isEditing && event.key.toLowerCase() === "r" && state.selectedId) {
    const selected = findEntity(state.selectedId);
    if (selected) {
      rotateEntity90(selected);
      commitState();
      redrawAll();
    }
    return;
  }
  if (!isEditing && event.key.toLowerCase() === "f" && state.selectedId) {
    const selected = findEntity(state.selectedId);
    if (selected?.type === "furniture" || selected?.type === "door") {
      selected.flip = !selected.flip;
      commitState();
      redrawAll();
    }
    return;
  }
  if (!isEditing && (event.key === "Delete" || event.key === "Backspace") && state.selectedId) {
    setActiveEntities(activeEntities().filter((entity) => entity.id !== state.selectedId));
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
    name: `部屋 ${entities.filter((entity) => entity.type === "room").length + 1}`,
    x,
    y,
    w,
    h,
    color: ROOM_COLORS[entities.length % ROOM_COLORS.length],
  };
  entities.push(newRoom);
  state.selectedId = newRoom.id;
}

function addLineFromDrag(type: "wall" | "door" | "window", start: Point, end: Point, mullion = false): void {
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
  activeEntities().push(line);
  state.selectedId = line.id;
}

function addShapeFromDrag(kind: ShapeKind, start: Point, end: Point): void {
  const radius = Math.max(GRID, snap(Math.hypot(end.x - start.x, end.y - start.y)));
  const endAngle = kind === "arc" ? Math.atan2(end.y - start.y, end.x - start.x) : Math.PI * 2;
  const shape: Shape = {
    id: newId("shape"),
    type: "shape",
    kind,
    x: snap(start.x),
    y: snap(start.y),
    r: radius,
    startAngle: kind === "arc" ? -Math.PI / 2 : 0,
    endAngle,
  };
  activeEntities().push(shape);
  state.selectedId = shape.id;
}

function rotateEntity90(entity: Entity): void {
  if (entity.type === "furniture") {
    entity.rotation = (entity.rotation + 90) % 360;
    return;
  }
  if (entity.type === "room") {
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
    const x1 = mid.x - (entity.y1 - mid.y);
    const y1 = mid.y + (entity.x1 - mid.x);
    const x2 = mid.x - (entity.y2 - mid.y);
    const y2 = mid.y + (entity.x2 - mid.x);
    entity.x1 = snap(x1);
    entity.y1 = snap(y1);
    entity.x2 = snap(x2);
    entity.y2 = snap(y2);
    return;
  }
  if (entity.type === "shape") {
    entity.startAngle += Math.PI / 2;
    entity.endAngle += Math.PI / 2;
  }
}

function rotateLineTo(entity: LinearElement, degrees: number): void {
  const mid = midpoint(entity);
  const length = distance(entity);
  const rad = degreesToRadians(degrees);
  entity.x1 = Math.round(mid.x - (Math.cos(rad) * length) / 2);
  entity.y1 = Math.round(mid.y - (Math.sin(rad) * length) / 2);
  entity.x2 = Math.round(mid.x + (Math.cos(rad) * length) / 2);
  entity.y2 = Math.round(mid.y + (Math.sin(rad) * length) / 2);
}

function moveEntity(entity: Entity, origin: Entity, dx: number, dy: number): void {
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
  if (origin.type === "shape" && entity.type === "shape") {
    entity.x = snap(origin.x + moveX);
    entity.y = snap(origin.y + moveY);
  }
  if (isLinear(origin) && isLinear(entity)) {
    entity.x1 = snap(origin.x1 + moveX);
    entity.y1 = snap(origin.y1 + moveY);
    entity.x2 = snap(origin.x2 + moveX);
    entity.y2 = snap(origin.y2 + moveY);
  }
}

function moveRoomLabel(entity: Entity, origin: Entity, dx: number, dy: number): void {
  if (origin.type !== "room" || entity.type !== "room") return;
  entity.labelOffsetX = (origin.labelOffsetX ?? 10) + dx;
  entity.labelOffsetY = (origin.labelOffsetY ?? 10) + dy;
}

function resizeEntity(entity: Entity, origin: Entity, corner: string, point: Point): void {
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
  drawFloorBelowGhost();

  const entities = activeEntities();
  entities.filter(isRoom).forEach(drawRoom);
  entities.filter((entity): entity is LinearElement => entity.type === "wall").forEach((wallItem) => {
    getVisibleWallSegments(wallItem, entities).forEach(drawWall2d);
  });
  entities.filter((entity): entity is LinearElement => entity.type === "window").forEach(drawWindow2d);
  entities.filter((entity): entity is LinearElement => entity.type === "door").forEach(drawDoor2d);
  entities.filter(isFurniture).forEach(drawFurniture2d);
  entities.filter(isShape).forEach(drawShape2d);

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
  if (state.activeFloor === 0) return;
  const below = state.floors[state.activeFloor - 1];
  ctx.save();
  below.entities.forEach((entity) => {
    if (entity.type === "room") {
      ctx.strokeStyle = GHOST;
      ctx.lineWidth = 1.2 / view.zoom;
      ctx.strokeRect(entity.x, entity.y, entity.w, entity.h);
    } else if (entity.type === "wall") {
      ctx.strokeStyle = GHOST;
      ctx.lineCap = "square";
      ctx.lineWidth = WALL_THICKNESS_2D;
      ctx.beginPath();
      ctx.moveTo(entity.x1, entity.y1);
      ctx.lineTo(entity.x2, entity.y2);
      ctx.stroke();
    }
  });
  ctx.restore();
}

function drawRoom(room: Room): void {
  const selected = state.selectedId === room.id;
  ctx.fillStyle = selected ? "#f2f7fd" : room.color;
  ctx.strokeStyle = selected ? "#2775d1" : "#c3c9d2";
  ctx.lineWidth = selected ? 2.4 / view.zoom : 1.1 / view.zoom;
  ctx.fillRect(room.x, room.y, room.w, room.h);
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
  if (selected) drawResizeHandles(room);
}

function drawRoomLabelGuide(room: Room): void {
  const bounds = getRoomLabelBounds(room);
  ctx.save();
  ctx.setLineDash([5 / view.zoom, 4 / view.zoom]);
  ctx.strokeStyle = "rgba(39, 117, 209, 0.7)";
  ctx.lineWidth = 1.5 / view.zoom;
  ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.restore();
}

function drawWall2d(wallItem: LinearElement): void {
  drawLineElement(wallItem, wallItem.color ?? INK, WALL_THICKNESS_2D);
  if (state.selectedId === wallItem.id) drawLineHandles(wallItem);
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
  if (selected) drawLineHandles(windowEl);
}

function drawDoor2d(door: LinearElement): void {
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
  if (selected) drawLineHandles(door);
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

// ---- 2D furniture symbols (CAD-style monochrome line art) ----

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
  drawFurnitureSymbol(furnitureItem.kind, furnitureItem.w, furnitureItem.h);
  if (selected) {
    ctx.strokeStyle = "#2775d1";
    ctx.lineWidth = 2.2 / view.zoom;
    strokeRoundedRect(-furnitureItem.w / 2, -furnitureItem.h / 2, furnitureItem.w, furnitureItem.h, 4);
  }
  ctx.restore();
  if (selected) drawResizeHandles(furnitureItem);
}

function drawFurnitureSymbol(kind: FurnitureKind, w: number, h: number): void {
  const hw = w / 2;
  const hh = h / 2;
  switch (kind) {
    case "sofa":
    case "armchair": {
      strokeRoundedRect(-hw, -hh, w, h, 8, true);
      const t = Math.min(w, h) * 0.22;
      strokeRoundedRect(-hw, -hh, w, t, 5);
      strokeRoundedRect(-hw, -hh, t, h, 5);
      strokeRoundedRect(hw - t, -hh, t, h, 5);
      if (kind === "sofa" && w >= 120) {
        strokeLine(0, -hh + t, 0, hh);
      }
      break;
    }
    case "table": {
      strokeRoundedRect(-hw, -hh, w, h, 6, true);
      break;
    }
    case "tv": {
      strokeRoundedRect(-hw, -hh, w, h, 3, true);
      strokeRoundedRect(-w * 0.36, -hh + 4, w * 0.72, 6, 2);
      break;
    }
    case "plant": {
      const r = Math.min(hw, hh);
      strokeCircle(0, 0, r, true);
      ctx.beginPath();
      for (let i = 0; i <= 12; i += 1) {
        const angle = (i / 12) * Math.PI * 2;
        const radius = i % 2 === 0 ? r * 0.82 : r * 0.3;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
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
      break;
    }
    case "fridge": {
      strokeRoundedRect(-hw, -hh, w, h, 3, true);
      strokeLine(-hw + 3, hh - h * 0.18, hw - 3, hh - h * 0.18);
      strokeLine(-hw + w * 0.16, hh - h * 0.09, -hw + w * 0.38, hh - h * 0.09);
      break;
    }
    case "bed":
    case "bedDouble": {
      strokeRoundedRect(-hw, -hh, w, h, 4, true);
      if (kind === "bed") {
        strokeRoundedRect(-w * 0.28, -hh + h * 0.04, w * 0.56, h * 0.1, 4);
      } else {
        strokeRoundedRect(-w * 0.43, -hh + h * 0.04, w * 0.37, h * 0.1, 4);
        strokeRoundedRect(w * 0.06, -hh + h * 0.04, w * 0.37, h * 0.1, 4);
      }
      strokeLine(-hw, -hh + h * 0.24, hw, -hh + h * 0.24);
      strokeLine(hw - w * 0.3, -hh + h * 0.24, hw, -hh + h * 0.24 + h * 0.12);
      break;
    }
    case "desk": {
      strokeRoundedRect(-hw, -hh, w, h, 3, true);
      const cs = Math.min(w, h) * 0.5;
      drawMiniChair(0, hh - cs * 0.58, cs, 1);
      break;
    }
    case "shelf": {
      strokeRoundedRect(-hw, -hh, w, h, 2, true);
      for (let x = -hw + 30; x < hw - 2; x += 30) {
        strokeLine(x, -hh, x, hh);
      }
      break;
    }
    case "bath": {
      strokeRoundedRect(-hw, -hh, w, h, 3, true);
      strokeRoundedRect(-hw + 7, -hh + 7, w - 14, h - 14, Math.min(w, h) * 0.28);
      strokeCircle(-hw + w * 0.18, 0, 3);
      break;
    }
    case "toilet": {
      strokeRoundedRect(-hw + 1, -hh, w - 2, h * 0.26, 2, true);
      ctx.fillStyle = "#ffffff";
      strokeEllipse(0, h * 0.14, w * 0.42, h * 0.32, true);
      strokeEllipse(0, h * 0.14, w * 0.27, h * 0.21);
      break;
    }
    case "washbasin": {
      strokeRoundedRect(-hw, -hh, w, h, 3, true);
      strokeEllipse(0, h * 0.06, w * 0.3, h * 0.28);
      strokeRoundedRect(-w * 0.07, -hh + 2, w * 0.14, 5, 2);
      break;
    }
    case "washer": {
      strokeRoundedRect(-hw, -hh, w, h, 4, true);
      const r = Math.min(hw, hh);
      strokeCircle(0, 1, r * 0.6);
      strokeCircle(0, 1, r * 0.3);
      strokeCircle(-hw + 6, -hh + 6, 2);
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
      break;
    }
    case "wardrobe": {
      strokeRoundedRect(-hw, -hh, w, h, 2, true);
      strokeLine(-hw, -hh, hw, hh);
      strokeLine(hw, -hh, -hw, hh);
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
      const landing = Math.min(w, h) * 0.32;
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
      ctx.arc(0, ay, ax, 0, Math.PI, true);
      ctx.stroke();
      strokeLine(-ax, ay, -ax, hh - 12);
      strokeArrowHead(-ax, hh - 12, Math.PI / 2, 8);
      break;
    }
    case "stairsSpiral": {
      const r = Math.min(hw, hh);
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
      break;
    }
    case "car": {
      let cw = w;
      let chh = h;
      if (w > h) {
        ctx.rotate(Math.PI / 2);
        cw = h;
        chh = w;
      }
      const cx = cw / 2;
      const cy = chh / 2;
      strokeRoundedRect(-cx, -cy, cw, chh, Math.min(cx, chh * 0.12), true);
      strokeRoundedRect(-cx + cw * 0.12, -chh * 0.1, cw * 0.76, chh * 0.42, 8);
      strokeLine(-cx + cw * 0.1, -cy + chh * 0.12, cx - cw * 0.1, -cy + chh * 0.12);
      strokeLine(-cx, -chh * 0.11, -cx - 6, -chh * 0.14);
      strokeLine(cx, -chh * 0.11, cx + 6, -chh * 0.14);
      break;
    }
    default: {
      strokeRoundedRect(-hw, -hh, w, h, 4, true);
    }
  }
}

function drawShape2d(shape: Shape): void {
  const selected = state.selectedId === shape.id;
  ctx.save();
  if (selected) {
    ctx.strokeStyle = "rgba(39, 117, 209, 0.35)";
    ctx.lineWidth = WALL_THICKNESS_2D + 6 / view.zoom;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (shape.kind === "circle") {
      ctx.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2);
    } else {
      ctx.arc(shape.x, shape.y, shape.r, shape.startAngle, shape.endAngle);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = shape.color ?? INK;
  ctx.lineWidth = WALL_THICKNESS_2D;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (shape.kind === "circle") {
    ctx.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2);
  } else {
    ctx.arc(shape.x, shape.y, shape.r, shape.startAngle, shape.endAngle);
  }
  ctx.stroke();
  if (selected) {
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
  } else if (activeTool === "circle" || activeTool === "arc") {
    const r = Math.max(1, Math.hypot(current.x - start.x, current.y - start.y));
    ctx.beginPath();
    if (activeTool === "circle") {
      ctx.arc(start.x, start.y, r, 0, Math.PI * 2);
    } else {
      ctx.arc(start.x, start.y, r, -Math.PI / 2, Math.atan2(current.y - start.y, current.x - start.x));
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

function drawResizeHandles(entity: Room | Furniture): void {
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

// ---- 3D ----

function rebuildThree(): void {
  disposeGroup(planGroup);
  const bounds = getGlobalBounds();
  const center = bounds ? { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 } : { x: 0, y: 0 };

  state.floors.forEach((floor, index) => {
    if (hiddenFloorIds.has(floor.id)) return;
    const yBase = index * FLOOR_SPACING;
    floor.entities.filter(isRoom).forEach((roomItem) => addRoom3d(roomItem, center, yBase, index));
    floor.entities
      .filter((entity): entity is LinearElement => entity.type === "wall")
      .forEach((wallItem) => {
        getVisibleWallSegments(wallItem, floor.entities).forEach((segment) =>
          addStraightWall3d(segment, center, yBase, wallItem.id, true),
        );
      });
    floor.entities.filter(isShape).forEach((shape) => addShapeWall3d(shape, center, yBase));
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

  addRoof3d(center);
  addSubtleGrid(bounds, center);
  if (pendingCameraFrame) {
    frameCamera(bounds);
    pendingCameraFrame = false;
  }
  updateUi();
}

function addRoom3d(roomItem: Room, center: Point, yBase: number, floorIndex: number): void {
  const width = roomItem.w * SCALE_3D;
  const depth = roomItem.h * SCALE_3D;
  const thickness = floorIndex === 0 ? 0.08 : FLOOR_SLAB;
  const geometry = new THREE.BoxGeometry(width, thickness, depth);
  const material = floorIndex === 0 ? roomMaterial(roomItem.color3d ?? roomItem.color) : slabMaterial;
  const mesh = new THREE.Mesh(geometry, material);
  const pos = to3d(roomItem.x + roomItem.w / 2, roomItem.y + roomItem.h / 2, center);
  const y = floorIndex === 0 ? thickness / 2 : yBase - thickness / 2;
  mesh.position.set(pos.x, y, pos.z);
  mesh.receiveShadow = true;
  mesh.castShadow = floorIndex > 0;
  markSelectable(mesh, roomItem.id);
  planGroup.add(mesh);

  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMaterial);
  edge.position.copy(mesh.position);
  planGroup.add(edge);
  addSelectionBox(mesh, roomItem.id);
}

function addStraightWall3d(wallItem: LinearElement, center: Point, yBase: number, entityId = wallItem.id, showSelection = true): void {
  const length = distance(wallItem) * SCALE_3D;
  if (length <= 0.02) return;
  const thickness = WALL_THICKNESS_2D * SCALE_3D;
  const angle = Math.atan2(wallItem.y2 - wallItem.y1, wallItem.x2 - wallItem.x1);
  const customWallColor = wallItem.color3d ?? wallItem.color;
  const bodyMaterial = customWallColor ? coloredMaterial(customWallColor, 0.78) : wallMaterial;
  const geometry = new THREE.BoxGeometry(length, WALL_HEIGHT, thickness);
  const mesh = new THREE.Mesh(geometry, bodyMaterial);
  const mid = midpoint(wallItem);
  const pos = to3d(mid.x, mid.y, center);
  mesh.position.set(pos.x, yBase + WALL_HEIGHT / 2, pos.z);
  mesh.rotation.y = -angle;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  markSelectable(mesh, entityId);
  planGroup.add(mesh);

  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(length + 0.01, 0.06, thickness + 0.01),
    customWallColor ? bodyMaterial : wallCapMaterial,
  );
  cap.position.set(pos.x, yBase + WALL_HEIGHT + 0.03, pos.z);
  cap.rotation.y = -angle;
  cap.castShadow = true;
  markSelectable(cap, entityId);
  planGroup.add(cap);
  if (showSelection) {
    addSelectionBox(mesh, entityId);
  }
}

function addShapeWall3d(shape: Shape, center: Point, yBase: number): void {
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
    addStraightWall3d(segment, center, yBase, shape.id, false);
  }
}

function addDoor3d(door: LinearElement, center: Point, yBase: number): void {
  const length = Math.max(distance(door) * SCALE_3D, 0.7);
  const frameThickness = 0.1;
  const frameHeight = 2.1;
  const panelHeight = 2.0;
  const panelThickness = 0.08;
  const angle = lineAngle(door);
  const mid = midpoint(door);

  const customDoorColor = door.color3d ?? door.color;
  const panel = addOrientedBox(mid, center, length * 0.92, panelHeight, panelThickness, yBase + panelHeight / 2, angle, customDoorColor ? coloredMaterial(customDoorColor, 0.72) : doorMaterial, door.id);
  panel.castShadow = true;
  panel.receiveShadow = true;

  const handleOffset = localOffset3d(length * 0.34, panelThickness * 0.72 * (door.flip ? -1 : 1), angle);
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd7b56d, roughness: 0.42, metalness: 0.25 }));
  const panelPos = to3d(mid.x, mid.y, center);
  handle.position.set(panelPos.x + handleOffset.x, yBase + 1.05, panelPos.z + handleOffset.z);
  handle.castShadow = true;
  markSelectable(handle, door.id);
  planGroup.add(handle);

  addOrientedBox(mid, center, length + frameThickness * 2, 0.08, frameThickness, yBase + 0.04, angle, doorFrameMaterial, door.id);
  addOrientedBox(mid, center, length + frameThickness * 2, 0.12, frameThickness, yBase + frameHeight, angle, doorFrameMaterial, door.id);

  addOrientedBox({ x: door.x1, y: door.y1 }, center, frameThickness, frameHeight, frameThickness, yBase + frameHeight / 2, angle, doorFrameMaterial, door.id);
  addOrientedBox({ x: door.x2, y: door.y2 }, center, frameThickness, frameHeight, frameThickness, yBase + frameHeight / 2, angle, doorFrameMaterial, door.id);

  // 開口で切り抜かれた壁を埋める垂れ壁（ドア上部）
  const headerHeight = WALL_HEIGHT - frameHeight;
  addOrientedBox(mid, center, length + 0.15, headerHeight, WALL_THICKNESS_2D * SCALE_3D, yBase + frameHeight + headerHeight / 2, angle, wallMaterial, door.id);
  addSelectionBox(panel, door.id);
}

function addWindow3d(windowEl: LinearElement, center: Point, yBase: number): void {
  const length = distance(windowEl) * SCALE_3D;
  const angle = lineAngle(windowEl);
  const mid = midpoint(windowEl);
  const frameThickness = 0.08;
  const frameDepth = 0.1;
  const glassHeight = 1.05;
  const glassY = yBase + 1.4;
  const frameBottom = glassY - glassHeight / 2;
  const frameTop = glassY + glassHeight / 2;
  const customFrameColor = windowEl.color3d ?? windowEl.color;
  const frameMaterial = customFrameColor ? coloredMaterial(customFrameColor, 0.5) : windowFrameMaterial;

  const glass = addOrientedBox(mid, center, Math.max(length - frameThickness * 1.2, 0.2), glassHeight, 0.04, glassY, angle, windowMaterial, windowEl.id);
  glass.receiveShadow = true;

  addOrientedBox(mid, center, length + frameThickness, frameThickness, frameDepth, frameBottom, angle, frameMaterial, windowEl.id);
  addOrientedBox(mid, center, length + frameThickness, frameThickness, frameDepth, frameTop, angle, frameMaterial, windowEl.id);
  addOrientedBox({ x: windowEl.x1, y: windowEl.y1 }, center, frameThickness, glassHeight + frameThickness, frameDepth, glassY, angle, frameMaterial, windowEl.id);
  addOrientedBox({ x: windowEl.x2, y: windowEl.y2 }, center, frameThickness, glassHeight + frameThickness, frameDepth, glassY, angle, frameMaterial, windowEl.id);
  if (windowEl.mullion) {
    addOrientedBox(mid, center, frameThickness * 0.72, glassHeight, frameDepth, glassY, angle, frameMaterial, windowEl.id);
  }

  // 開口で切り抜かれた壁を埋める腰壁（下）と垂れ壁（上）
  const wallDepth = WALL_THICKNESS_2D * SCALE_3D;
  const sillHeight = frameBottom - yBase;
  const headerHeight = yBase + WALL_HEIGHT - frameTop;
  addOrientedBox(mid, center, length + 0.15, sillHeight, wallDepth, yBase + sillHeight / 2, angle, wallMaterial, windowEl.id);
  addOrientedBox(mid, center, length + 0.15, headerHeight, wallDepth, frameTop + headerHeight / 2, angle, wallMaterial, windowEl.id);
  addSelectionBox(glass, windowEl.id);
}

function addOrientedBox(
  anchor: Point,
  center: Point,
  width: number,
  height: number,
  depth: number,
  y: number,
  angle: number,
  material: THREE.Material,
  entityId: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  const pos = to3d(anchor.x, anchor.y, center);
  mesh.position.set(pos.x, y, pos.z);
  mesh.rotation.y = -angle;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  markSelectable(mesh, entityId);
  planGroup.add(mesh);
  return mesh;
}

function localOffset3d(localX: number, localZ: number, angle: number): { x: number; z: number } {
  return {
    x: Math.cos(angle) * localX - Math.sin(angle) * localZ,
    z: Math.sin(angle) * localX + Math.cos(angle) * localZ,
  };
}

// ---- 3D furniture ----

function furniturePart(
  group: THREE.Group,
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  color: number,
  roughness = 0.72,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color, roughness }));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function cylinderPart(
  group: THREE.Group,
  radius: number,
  height: number,
  x: number,
  y: number,
  z: number,
  color: number,
  roughness = 0.72,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 24), new THREE.MeshStandardMaterial({ color, roughness }));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addFurniture3d(furnitureItem: Furniture, center: Point, yBase: number): void {
  const group = new THREE.Group();
  const w = furnitureItem.w * SCALE_3D;
  const d = furnitureItem.h * SCALE_3D;
  const pos = to3d(furnitureItem.x + furnitureItem.w / 2, furnitureItem.y + furnitureItem.h / 2, center);
  group.position.set(pos.x, yBase + 0.02, pos.z);
  group.rotation.y = (-furnitureItem.rotation * Math.PI) / 180;
  if (furnitureItem.flip) group.scale.x = -1;

  switch (furnitureItem.kind) {
    case "sofa":
    case "armchair": {
      furniturePart(group, w * 0.98, 0.35, d * 0.72, 0, 0.175, d * 0.13, COLOR_FABRIC);
      furniturePart(group, w, 0.7, d * 0.24, 0, 0.35, -d * 0.38, COLOR_FABRIC);
      furniturePart(group, w * 0.12, 0.52, d, -w * 0.44, 0.26, 0, COLOR_FABRIC);
      furniturePart(group, w * 0.12, 0.52, d, w * 0.44, 0.26, 0, COLOR_FABRIC);
      break;
    }
    case "table": {
      furniturePart(group, w, 0.045, d, 0, 0.4, 0, COLOR_WOOD);
      [-1, 1].forEach((sx) => {
        [-1, 1].forEach((sz) => {
          furniturePart(group, 0.05, 0.38, 0.05, sx * w * 0.42, 0.19, sz * d * 0.36, COLOR_WOOD_DARK);
        });
      });
      break;
    }
    case "tv": {
      furniturePart(group, w, 0.4, d, 0, 0.2, 0, COLOR_WOOD_DARK);
      furniturePart(group, w * 0.72, 0.62, 0.05, 0, 0.73, -d * 0.15, COLOR_DARK, 0.3);
      break;
    }
    case "plant": {
      cylinderPart(group, w * 0.32, 0.32, 0, 0.16, 0, 0x99705a);
      const foliage = new THREE.Mesh(new THREE.SphereGeometry(w * 0.52, 18, 14), new THREE.MeshStandardMaterial({ color: COLOR_GREEN, roughness: 0.8 }));
      foliage.position.set(0, 0.72, 0);
      foliage.castShadow = true;
      group.add(foliage);
      break;
    }
    case "diningTable": {
      furniturePart(group, w * 0.7, 0.045, d * 0.48, 0, 0.7, 0, COLOR_WOOD);
      [-1, 1].forEach((sx) => {
        [-1, 1].forEach((sz) => {
          furniturePart(group, 0.05, 0.68, 0.05, sx * w * 0.3, 0.34, sz * d * 0.18, COLOR_WOOD_DARK);
        });
      });
      const cs = Math.min(w, d) * 0.22;
      const chairZ = d * 0.24 + cs * 0.6;
      [-1, 1].forEach((sx) => {
        [-1, 1].forEach((sz) => {
          furniturePart(group, cs, 0.44, cs, sx * w * 0.17, 0.22, sz * chairZ, COLOR_WOOD);
          furniturePart(group, cs, 0.4, 0.045, sx * w * 0.17, 0.62, sz * (chairZ + cs * 0.45), COLOR_WOOD);
        });
      });
      break;
    }
    case "chair": {
      furniturePart(group, w, 0.42, d, 0, 0.21, 0, COLOR_WOOD);
      furniturePart(group, w, 0.42, 0.05, 0, 0.63, -d / 2 + 0.025, COLOR_WOOD);
      break;
    }
    case "kitchen": {
      furniturePart(group, w, 0.85, d, 0, 0.425, 0, 0xdadcda);
      furniturePart(group, w + 0.02, 0.04, d + 0.02, 0, 0.87, 0, 0x8d8d89, 0.4);
      furniturePart(group, w * 0.28, 0.015, d * 0.66, w * 0.28, 0.9, 0, COLOR_DARK, 0.35);
      furniturePart(group, w * 0.2, 0.015, d * 0.5, -w * 0.24, 0.9, 0, 0xc4cbcf, 0.3);
      break;
    }
    case "fridge": {
      furniturePart(group, w, 1.82, d, 0, 0.91, 0, 0xe2e6e7, 0.38);
      furniturePart(group, w * 0.06, 0.5, 0.03, -w * 0.3, 1.2, d / 2 + 0.015, COLOR_STEEL, 0.3);
      break;
    }
    case "bed":
    case "bedDouble": {
      furniturePart(group, w, 0.24, d, 0, 0.12, 0, COLOR_WOOD_DARK);
      furniturePart(group, w * 0.95, 0.2, d * 0.95, 0, 0.34, 0, 0xf0ede6);
      if (furnitureItem.kind === "bed") {
        furniturePart(group, w * 0.55, 0.09, d * 0.14, 0, 0.48, -d * 0.36, COLOR_WHITE);
      } else {
        furniturePart(group, w * 0.36, 0.09, d * 0.14, -w * 0.22, 0.48, -d * 0.36, COLOR_WHITE);
        furniturePart(group, w * 0.36, 0.09, d * 0.14, w * 0.22, 0.48, -d * 0.36, COLOR_WHITE);
      }
      break;
    }
    case "desk": {
      furniturePart(group, w, 0.045, d, 0, 0.72, 0, COLOR_WOOD);
      [-1, 1].forEach((sx) => {
        [-1, 1].forEach((sz) => {
          furniturePart(group, 0.05, 0.7, 0.05, sx * w * 0.44, 0.35, sz * d * 0.4, COLOR_WOOD_DARK);
        });
      });
      break;
    }
    case "shelf": {
      furniturePart(group, w, 1.8, d, 0, 0.9, 0, COLOR_WOOD);
      break;
    }
    case "bath": {
      furniturePart(group, w, 0.58, d, 0, 0.29, 0, 0xe6edf0, 0.4);
      furniturePart(group, w * 0.78, 0.03, d * 0.72, 0, 0.585, 0, 0xbcd9e4, 0.2);
      break;
    }
    case "toilet": {
      furniturePart(group, w * 0.9, 0.7, d * 0.24, 0, 0.35, -d * 0.36, COLOR_CERAMIC, 0.35);
      const bowl = cylinderPart(group, w * 0.42, 0.4, 0, 0.2, d * 0.1, COLOR_CERAMIC, 0.35);
      bowl.scale.z = Math.max(1, (d * 0.6) / (w * 0.84));
      break;
    }
    case "washbasin": {
      furniturePart(group, w, 0.78, d, 0, 0.39, 0, 0xe8e9e7, 0.5);
      furniturePart(group, w + 0.02, 0.035, d + 0.02, 0, 0.8, 0, COLOR_CERAMIC, 0.3);
      furniturePart(group, 0.04, 0.14, 0.04, 0, 0.88, -d * 0.3, COLOR_STEEL, 0.3);
      break;
    }
    case "washer": {
      furniturePart(group, w, 0.96, d, 0, 0.48, 0, 0xeceeee, 0.35);
      const door = cylinderPart(group, Math.min(w, d) * 0.3, 0.02, 0, 0.55, d / 2 + 0.005, 0x87919a, 0.3);
      door.rotation.x = Math.PI / 2;
      break;
    }
    case "closet": {
      furniturePart(group, w, 2.35, d, 0, 1.175, 0, 0xcfc8bb);
      break;
    }
    case "wardrobe": {
      furniturePart(group, w, 1.25, d, 0, 0.625, 0, COLOR_WOOD);
      break;
    }
    case "stairs": {
      const horizontal = furnitureItem.w > furnitureItem.h;
      const run = horizontal ? w : d;
      const stepCount = Math.round(clamp((horizontal ? furnitureItem.w : furnitureItem.h) / 24, 8, 16));
      const stepDepth = run / stepCount;
      for (let i = 0; i < stepCount; i += 1) {
        const stepHeight = (WALL_HEIGHT * (i + 1)) / stepCount;
        if (horizontal) {
          furniturePart(group, stepDepth, stepHeight, d, -w / 2 + stepDepth * (i + 0.5), stepHeight / 2, 0, 0xcbb391);
        } else {
          furniturePart(group, w, stepHeight, stepDepth, 0, stepHeight / 2, d / 2 - stepDepth * (i + 0.5), 0xcbb391);
        }
      }
      break;
    }
    case "stairsU": {
      const landing = d * 0.32;
      const flight = d - landing;
      const steps = 7;
      const stepDepth = flight / steps;
      for (let i = 0; i < steps; i += 1) {
        const upHeight = ((WALL_HEIGHT / 2) * (i + 1)) / steps;
        furniturePart(group, w / 2, upHeight, stepDepth, w / 4, upHeight / 2, d / 2 - stepDepth * (i + 0.5), 0xcbb391);
        const downHeight = WALL_HEIGHT / 2 + ((WALL_HEIGHT / 2) * (i + 1)) / steps;
        furniturePart(group, w / 2, downHeight, stepDepth, -w / 4, downHeight / 2, -d / 2 + landing + stepDepth * (i + 0.5), 0xcbb391);
      }
      furniturePart(group, w, WALL_HEIGHT / 2, landing, 0, WALL_HEIGHT / 4, -d / 2 + landing / 2, 0xcbb391);
      break;
    }
    case "stairsSpiral": {
      const radius = Math.min(w, d) / 2;
      cylinderPart(group, 0.045, WALL_HEIGHT, 0, WALL_HEIGHT / 2, 0, COLOR_STEEL, 0.4);
      const steps = 12;
      for (let i = 0; i < steps; i += 1) {
        const angle = -Math.PI / 2 + (i * Math.PI * 1.8) / steps;
        const stepY = (WALL_HEIGHT * (i + 1)) / (steps + 2);
        const step = furniturePart(group, radius * 0.92, 0.05, radius * 0.38, Math.cos(angle) * radius * 0.48, stepY, Math.sin(angle) * radius * 0.48, 0xcbb391);
        step.rotation.y = -angle;
      }
      break;
    }
    case "car": {
      furniturePart(group, w * 0.96, 0.45, d * 0.98, 0, 0.62, 0, 0xaebccb, 0.35);
      furniturePart(group, w * 0.82, 0.4, d * 0.42, 0, 1.02, d * 0.03, 0x5b6875, 0.3);
      [-1, 1].forEach((sx) => {
        [-1, 1].forEach((sz) => {
          const wheel = cylinderPart(group, 0.32, 0.2, sx * (w / 2 - 0.1), 0.32, sz * d * 0.3, COLOR_DARK, 0.6);
          wheel.rotation.z = Math.PI / 2;
        });
      });
      break;
    }
    default: {
      furniturePart(group, w, 0.72, d, 0, 0.36, 0, 0xb9c0c8);
    }
  }

  const customFurnitureColor = furnitureItem.color3d ?? furnitureItem.color;
  if (customFurnitureColor) {
    const tint = new THREE.Color(customFurnitureColor);
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      const material = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (material?.color) material.color.set(tint);
    });
  }

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

function addRoof3d(center: Point): void {
  if (state.roof === "none") return;
  let topIndex = -1;
  for (let i = state.floors.length - 1; i >= 0; i -= 1) {
    if (!hiddenFloorIds.has(state.floors[i].id)) {
      topIndex = i;
      break;
    }
  }
  if (topIndex < 0) return;
  const topFloor = state.floors[topIndex];
  const bounds =
    getEntitiesBounds(topFloor.entities.filter(isRoom)) ??
    getEntitiesBounds(topFloor.entities) ??
    getGlobalBounds();
  if (!bounds) return;

  const overhang = 40;
  const width = (bounds.w + overhang * 2) * SCALE_3D;
  const depth = (bounds.h + overhang * 2) * SCALE_3D;
  const pos = to3d(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2, center);
  const topY = topIndex * FLOOR_SPACING + WALL_HEIGHT + 0.06;

  if (state.roof === "flat") {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.16, depth), roofMaterial);
    mesh.position.set(pos.x, topY + 0.08, pos.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    planGroup.add(mesh);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMaterial);
    edge.position.copy(mesh.position);
    planGroup.add(edge);
    return;
  }

  const long = Math.max(width, depth);
  const short = Math.min(width, depth);
  const height = short * (state.roof === "gable" ? 0.34 : 0.3);
  const ridgeInset = state.roof === "gable" ? 0 : short / 2;
  const geometry = buildRoofGeometry(long, short, height, ridgeInset);
  const mesh = new THREE.Mesh(geometry, roofMaterial);
  mesh.position.set(pos.x, topY, pos.z);
  if (depth > width) {
    mesh.rotation.y = Math.PI / 2;
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  planGroup.add(mesh);

  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 12), edgeMaterial);
  edge.position.copy(mesh.position);
  edge.rotation.copy(mesh.rotation);
  planGroup.add(edge);
}

function markSelectable(object: THREE.Object3D, entityId: string): void {
  object.userData.entityId = entityId;
  object.traverse((child) => {
    child.userData.entityId = entityId;
  });
}

function addSelectionBox(object: THREE.Object3D, entityId: string): void {
  if (state.selectedId !== entityId) return;
  const helper = new THREE.BoxHelper(object, 0x2775d1);
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
  const distanceToFit = clamp(Math.max(size * 1.4, buildingHeight * 2.2), 6, 30);
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
}

function animate3d(): void {
  requestAnimationFrame(animate3d);
  render3dOnce();
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
  setActiveButton("[data-roof]", state.roof);
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
  threeStats.textContent = `${state.floors.length}階建て・部材${totalParts}を自動変換`;
}

function updatePropertiesPanel(): void {
  const selected = state.selectedId ? findEntity(state.selectedId) : null;
  if (!selected) {
    propertiesPanel.innerHTML = `<p class="empty-state">選択ツールで部屋・壁・家具を選ぶと、名前や寸法を調整できます。家具は R キーで回転、F キーで反転します。</p>`;
    return;
  }

  if (selected.type === "room") {
    propertiesPanel.innerHTML = `
      <div class="property-grid">
        <label>名前<input id="roomNameInput" value="${escapeHtml(selected.name)}" /></label>
        <div class="two-col">
          <label>幅 cm<input id="roomWInput" type="number" min="40" step="20" value="${selected.w}" /></label>
          <label>奥行 cm<input id="roomHInput" type="number" min="40" step="20" value="${selected.h}" /></label>
        </div>
        <div class="two-col">
          <label>色 2D<input id="roomColorInput" type="color" value="${selected.color}" /></label>
          <label>色 3D<input id="roomColor3dInput" type="color" value="${selected.color3d ?? selected.color}" /></label>
        </div>
        <button type="button" class="prop-button" id="roomRotateButton">90°回転（Rキー）</button>
      </div>
    `;
    bindInput("#roomNameInput", (value) => (selected.name = value || "部屋"));
    bindNumber("#roomWInput", (value) => (selected.w = Math.max(GRID * 2, snap(value))));
    bindNumber("#roomHInput", (value) => (selected.h = Math.max(GRID * 2, snap(value))));
    bindInput("#roomColorInput", (value) => (selected.color = value));
    bindInput("#roomColor3dInput", (value) => (selected.color3d = value));
    bindButton("#roomRotateButton", () => rotateEntity90(selected));
    return;
  }

  if (isLinear(selected)) {
    const typeLabel = selected.type === "wall" ? "壁" : selected.type === "door" ? "ドア" : "窓";
    const default3d = selected.type === "wall" ? "#f4f1ec" : selected.type === "door" ? "#99683d" : "#dfe5ea";
    const doorFlipRow =
      selected.type === "door"
        ? `<label class="check"><input id="doorFlipInput" type="checkbox" ${selected.flip ? "checked" : ""} /> 開きを反転（Fキー）</label>`
        : "";
    const mullionRow =
      selected.type === "window"
        ? `<label class="check"><input id="windowMullionInput" type="checkbox" ${selected.mullion ? "checked" : ""} /> 中央に区切り</label>`
        : "";
    propertiesPanel.innerHTML = `
      <div class="property-grid">
        <p class="empty-state">${typeLabel}</p>
        <div class="two-col">
          <label>長さ cm<input id="lineLengthInput" type="number" min="20" step="20" value="${Math.round(distance(selected))}" /></label>
          <label>角度 °<input id="lineAngleInput" type="number" step="15" value="${Math.round(radiansToDegrees(lineAngle(selected)))}" /></label>
        </div>
        <div class="two-col">
          <label>始点X<input id="lineXInput" type="number" step="20" value="${selected.x1}" /></label>
          <label>始点Y<input id="lineYInput" type="number" step="20" value="${selected.y1}" /></label>
        </div>
        <button type="button" class="prop-button" id="lineRotateButton">90°回転（Rキー）</button>
        ${doorFlipRow}
        ${mullionRow}
        <div class="two-col">
          <label>色 2D<input id="lineColorInput" type="color" value="${selected.color ?? "#000000"}" /></label>
          <label>色 3D<input id="lineColor3dInput" type="color" value="${selected.color3d ?? selected.color ?? default3d}" /></label>
        </div>
      </div>
    `;
    bindNumber("#lineLengthInput", (value) => {
      const newLength = Math.max(GRID, Math.round(value));
      const angle = lineAngle(selected);
      selected.x2 = Math.round(selected.x1 + Math.cos(angle) * newLength);
      selected.y2 = Math.round(selected.y1 + Math.sin(angle) * newLength);
    });
    bindNumber("#lineAngleInput", (value) => rotateLineTo(selected, value));
    bindButton("#lineRotateButton", () => rotateEntity90(selected));
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
    propertiesPanel.innerHTML = `
      <div class="property-grid">
        <label>種類
          <select id="shapeKindInput">
            <option value="circle" ${selectedShape.kind === "circle" ? "selected" : ""}>円</option>
            <option value="arc" ${selectedShape.kind === "arc" ? "selected" : ""}>円弧</option>
          </select>
        </label>
        <label>半径 cm<input id="shapeRadiusInput" type="number" min="20" step="20" value="${selectedShape.r}" /></label>
        <div class="two-col">
          <label>開始 °<input id="shapeStartInput" type="number" step="15" value="${Math.round(radiansToDegrees(selectedShape.startAngle))}" /></label>
          <label>終了 °<input id="shapeEndInput" type="number" step="15" value="${Math.round(radiansToDegrees(selectedShape.endAngle))}" /></label>
        </div>
        <div class="two-col">
          <label>色 2D<input id="shapeColorInput" type="color" value="${selectedShape.color ?? "#000000"}" /></label>
          <label>色 3D<input id="shapeColor3dInput" type="color" value="${selectedShape.color3d ?? selectedShape.color ?? "#f4f1ec"}" /></label>
        </div>
      </div>
    `;
    bindSelect("#shapeKindInput", (value) => {
      selectedShape.kind = value as ShapeKind;
      if (selectedShape.kind === "circle") {
        selectedShape.startAngle = 0;
        selectedShape.endAngle = Math.PI * 2;
      }
    });
    bindNumber("#shapeRadiusInput", (value) => (selectedShape.r = Math.max(GRID, snap(value))));
    bindNumber("#shapeStartInput", (value) => (selectedShape.startAngle = degreesToRadians(value)));
    bindNumber("#shapeEndInput", (value) => (selectedShape.endAngle = degreesToRadians(value)));
    bindInput("#shapeColorInput", (value) => (selectedShape.color = value));
    bindInput("#shapeColor3dInput", (value) => (selectedShape.color3d = value));
    return;
  }

  const selectedFurniture = selected as Furniture;
  const kindOptions = FURNITURE_CATEGORIES.map(
    (category) =>
      `<optgroup label="${category.label}">` +
      category.kinds
        .map((kind) => `<option value="${kind}" ${kind === selectedFurniture.kind ? "selected" : ""}>${FURNITURE_DEFS[kind].label}</option>`)
        .join("") +
      `</optgroup>`,
  ).join("");
  propertiesPanel.innerHTML = `
    <div class="property-grid">
      <label>種類
        <select id="furnitureKindInput">${kindOptions}</select>
      </label>
      <div class="two-col">
        <label>幅 cm<input id="furnitureWInput" type="number" min="20" step="20" value="${selectedFurniture.w}" /></label>
        <label>奥行 cm<input id="furnitureHInput" type="number" min="20" step="20" value="${selectedFurniture.h}" /></label>
      </div>
      <label>回転（Rキーで90°）<input id="furnitureRotationInput" type="number" step="15" value="${selectedFurniture.rotation}" /></label>
      <label class="check"><input id="furnitureFlipInput" type="checkbox" ${selectedFurniture.flip ? "checked" : ""} /> 左右反転（Fキー）</label>
      <div class="two-col">
        <label>色 2D<input id="furnitureColorInput" type="color" value="${selectedFurniture.color ?? "#000000"}" /></label>
        <label>色 3D<input id="furnitureColor3dInput" type="color" value="${selectedFurniture.color3d ?? selectedFurniture.color ?? "#b9c0c8"}" /></label>
      </div>
    </div>
  `;
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
  const bounds = getEntitiesBounds(activeEntities()) ?? getGlobalBounds();
  const rect = planCanvas.getBoundingClientRect();
  if (!bounds || rect.width === 0 || rect.height === 0) {
    view = { zoom: 1, x: rect.width / 2, y: rect.height / 2 };
    return;
  }
  const padding = 70;
  const zoomX = (rect.width - padding * 2) / bounds.w;
  const zoomY = (rect.height - padding * 2) / bounds.h;
  const zoom = clamp(Math.min(zoomX, zoomY), 0.45, 2.2);
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  saveTimer = window.setTimeout(() => {
    saveStatus.textContent = "保存済み";
  }, 320);
}

function exportPlan(): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `madori-${new Date().toISOString().slice(0, 10)}.json`;
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
  const entities = activeEntities();
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
      if (point.x >= entity.x && point.x <= entity.x + entity.w && point.y >= entity.y && point.y <= entity.y + entity.h) {
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

function getRoomLabelBounds(room: Room): { x: number; y: number; w: number; h: number } {
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
  return point.x >= bounds.x && point.x <= bounds.x + bounds.w && point.y >= bounds.y && point.y <= bounds.y + bounds.h;
}

function getCornerHit(entity: Room | Furniture, point: Point): string | null {
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

function constrainLine(start: Point, end: Point): Point {
  return Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)
    ? { x: end.x, y: start.y }
    : { x: start.x, y: end.y };
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

function makeTemplate(key: string): PlanState {
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
      roof: "flat",
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
      roof: "hip",
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
      roof: "gable",
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
    roof: "gable",
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

function cloneState(value: PlanState): PlanState {
  return JSON.parse(JSON.stringify(value)) as PlanState;
}

function cloneEntity(value: Entity): Entity {
  return JSON.parse(JSON.stringify(value)) as Entity;
}

function findEntity(id: string): Entity | undefined {
  return activeEntities().find((entity) => entity.id === id);
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

function isResizable(entity: Entity): entity is Room | Furniture {
  return entity.type === "room" || entity.type === "furniture";
}

function lineDirection(entity: LinearElement): Direction {
  return Math.abs(entity.x2 - entity.x1) >= Math.abs(entity.y2 - entity.y1) ? "horizontal" : "vertical";
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

interface WallOpening {
  from: number;
  to: number;
}

function getVisibleWallSegments(wallItem: LinearElement, entities: Entity[]): LinearElement[] {
  const direction = lineDirection(wallItem);
  const wallFrom = direction === "horizontal" ? Math.min(wallItem.x1, wallItem.x2) : Math.min(wallItem.y1, wallItem.y2);
  const wallTo = direction === "horizontal" ? Math.max(wallItem.x1, wallItem.x2) : Math.max(wallItem.y1, wallItem.y2);
  const openings = getWallOpenings(wallItem, wallFrom, wallTo, entities);
  if (openings.length === 0) return [wallItem];

  const merged = mergeOpenings(openings);
  const intervals: WallOpening[] = [];
  let cursor = wallFrom;
  merged.forEach((opening) => {
    if (opening.from - cursor > 2) {
      intervals.push({ from: cursor, to: opening.from });
    }
    cursor = Math.max(cursor, opening.to);
  });
  if (wallTo - cursor > 2) {
    intervals.push({ from: cursor, to: wallTo });
  }

  return intervals.map((interval) => intervalToWallSegment(wallItem, interval));
}

function getWallOpenings(wallItem: LinearElement, wallFrom: number, wallTo: number, entities: Entity[]): WallOpening[] {
  const direction = lineDirection(wallItem);
  const wallLinePosition = direction === "horizontal" ? (wallItem.y1 + wallItem.y2) / 2 : (wallItem.x1 + wallItem.x2) / 2;
  const tolerance = WALL_THICKNESS_2D * 1.4;
  // 壁線は端が半分張り出す（lineCap: square）ため、張り出しと同量だけ余分に切ると面一になる
  const clearance = WALL_THICKNESS_2D * 0.5;

  return entities
    .filter((entity): entity is LinearElement => entity.type === "door" || entity.type === "window")
    .filter((opening) => lineDirection(opening) === direction)
    .map((opening) => {
      const openingLinePosition = direction === "horizontal" ? (opening.y1 + opening.y2) / 2 : (opening.x1 + opening.x2) / 2;
      if (Math.abs(openingLinePosition - wallLinePosition) > tolerance) return null;
      const openingFrom = direction === "horizontal" ? Math.min(opening.x1, opening.x2) : Math.min(opening.y1, opening.y2);
      const openingTo = direction === "horizontal" ? Math.max(opening.x1, opening.x2) : Math.max(opening.y1, opening.y2);
      const from = clamp(openingFrom - clearance, wallFrom, wallTo);
      const to = clamp(openingTo + clearance, wallFrom, wallTo);
      return to > from ? { from, to } : null;
    })
    .filter((opening): opening is WallOpening => Boolean(opening));
}

function mergeOpenings(openings: WallOpening[]): WallOpening[] {
  const sorted = [...openings].sort((a, b) => a.from - b.from);
  const merged: WallOpening[] = [];
  sorted.forEach((opening) => {
    const previous = merged[merged.length - 1];
    if (!previous || opening.from > previous.to) {
      merged.push({ ...opening });
      return;
    }
    previous.to = Math.max(previous.to, opening.to);
  });
  return merged;
}

function intervalToWallSegment(wallItem: LinearElement, interval: WallOpening): LinearElement {
  if (lineDirection(wallItem) === "horizontal") {
    const y = (wallItem.y1 + wallItem.y2) / 2;
    return { ...wallItem, x1: interval.from, y1: y, x2: interval.to, y2: y };
  }
  const x = (wallItem.x1 + wallItem.x2) / 2;
  return { ...wallItem, x1: x, y1: interval.from, x2: x, y2: interval.to };
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
    if (entity.type === "room" || entity.type === "furniture") {
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
  const all = state.floors.flatMap((floor) => floor.entities);
  return getEntitiesBounds(all);
}

function roomMaterial(color: string): THREE.MeshStandardMaterial {
  const cached = roomMaterialCache.get(color);
  if (cached) return cached;
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.82 });
  roomMaterialCache.set(color, material);
  return material;
}

const coloredMaterialCache = new Map<string, THREE.MeshStandardMaterial>();

function coloredMaterial(color: string, roughness = 0.75): THREE.MeshStandardMaterial {
  const key = `${color}-${roughness}`;
  const cached = coloredMaterialCache.get(key);
  if (cached) return cached;
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness });
  coloredMaterialCache.set(key, material);
  return material;
}

function disposeGroup(group: THREE.Group): void {
  while (group.children.length > 0) {
    const child = group.children.pop();
    if (!child) continue;
    child.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else if (material) {
        material.dispose();
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
