import { createIcons, icons } from "lucide";
import "./styles.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type Tool = "select" | "room" | "wall" | "door" | "window" | "furniture" | "circle" | "arc" | "erase";
type EntityType = "room" | "wall" | "door" | "window" | "furniture" | "shape";
type FurnitureKind = "sofa" | "table" | "bed" | "desk" | "kitchen" | "bath";
type ShapeKind = "circle" | "arc";
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
}

type Entity = Room | LinearElement | Furniture | Shape;

interface PlanState {
  entities: Entity[];
  selectedId: string | null;
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
const canvasContext = planCanvas.getContext("2d");
if (!canvasContext) {
  throw new Error("2D canvas is not supported.");
}
const ctx: CanvasRenderingContext2D = canvasContext;

const STORAGE_KEY = "madori-quick-3d-plan";
const VIEW_MODE_KEY = "madori-quick-3d-view-mode";
const DIMENSION_LABELS_KEY = "madori-quick-3d-dimension-labels";
const HISTORY_LIMIT = 60;
const GRID = 20;
const SCALE_3D = 0.03;
const WALL_THICKNESS_2D = 10;
const WALL_HEIGHT = 3.18;
const BASE_FURNITURE: Record<FurnitureKind, { label: string; w: number; h: number; color: number }> = {
  sofa: { label: "ソファ", w: 86, h: 42, color: 0x2b7bc0 },
  table: { label: "テーブル", w: 58, h: 42, color: 0xb98636 },
  bed: { label: "ベッド", w: 88, h: 128, color: 0x7f8ba1 },
  desk: { label: "机", w: 72, h: 42, color: 0x53616e },
  kitchen: { label: "キッチン", w: 116, h: 44, color: 0x4f9b80 },
  bath: { label: "浴槽", w: 74, h: 48, color: 0x62a8c8 },
};

const ROOM_COLORS = ["#f5efe4", "#e8f2ed", "#e9eff8", "#f6e8e0", "#eef0e3", "#f0e9f4"];

let activeTool: Tool = "select";
let activeFurniture: FurnitureKind = "sofa";
let viewMode: ViewMode = loadViewMode();
let showDimensions = loadDimensionLabels();
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
controls.minDistance = 5;
controls.maxDistance = 42;
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

createIcons({ icons });
setupUi();
fitPlanToCanvas();
render2d();
rebuildThree();
applyViewMode(viewMode, false);
animate3d();

function loadInitialState(): PlanState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as PlanState;
      if (Array.isArray(parsed.entities)) {
        return {
          entities: parsed.entities,
          selectedId: parsed.selectedId ?? null,
        };
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return {
    entities: makeTemplate("oneLdk"),
    selectedId: null,
  };
}

function loadViewMode(): ViewMode {
  const stored = localStorage.getItem(VIEW_MODE_KEY);
  return stored === "plan" || stored === "three" || stored === "split" ? stored : "split";
}

function loadDimensionLabels(): boolean {
  return localStorage.getItem(DIMENSION_LABELS_KEY) !== "hidden";
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

  document.querySelectorAll<HTMLButtonElement>("[data-furniture]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFurniture = button.dataset.furniture as FurnitureKind;
      setActiveButton("[data-furniture]", activeFurniture);
      activeTool = "furniture";
      setActiveButton("[data-tool]", activeTool);
      syncPlanCursor();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-template]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.template ?? "oneLdk";
      if (!window.confirm("現在の間取りを雛形で置き換えます。実行しますか？")) {
        return;
      }
      replaceState({ entities: makeTemplate(key), selectedId: null }, true);
    });
  });

  dimensionToggle.addEventListener("click", () => {
    showDimensions = !showDimensions;
    localStorage.setItem(DIMENSION_LABELS_KEY, showDimensions ? "visible" : "hidden");
    updateDimensionToggle();
    render2d();
  });

  document.querySelector<HTMLButtonElement>("#undoButton")?.addEventListener("click", undo);
  document.querySelector<HTMLButtonElement>("#redoButton")?.addEventListener("click", redo);
  document.querySelector<HTMLButtonElement>("#fitButton")?.addEventListener("click", () => {
    fitPlanToCanvas();
    render2d();
  });
  document.querySelector<HTMLButtonElement>("#resetButton")?.addEventListener("click", () => {
    replaceState({ entities: [], selectedId: null }, true);
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
  updateUi();
}

function setActiveButton(selector: string, value: string): void {
  document.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
    const dataValue = button.dataset.tool ?? button.dataset.furniture ?? button.dataset.viewMode;
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
      state.entities = state.entities.filter((entity) => entity.id !== hit.entity?.id);
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
    } else if (hit.entity && hit.corner && isResizable(hit.entity)) {
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
    const base = BASE_FURNITURE[activeFurniture];
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
    state.entities.push(entity);
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
  const distance = Math.hypot(end.x - start.x, end.y - start.y);

  if (drag.dragMode === "draw" && distance > 8) {
    if (activeTool === "room") addRoomFromDrag(start, end);
    if (activeTool === "wall") addLineFromDrag("wall", start, end);
    if (activeTool === "door") addLineFromDrag("door", start, end);
    if (activeTool === "window") addLineFromDrag("window", start, end);
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
  if (!isEditing && (event.key === "Delete" || event.key === "Backspace") && state.selectedId) {
    state.entities = state.entities.filter((entity) => entity.id !== state.selectedId);
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
  const room: Room = {
    id: newId("room"),
    type: "room",
    name: `部屋 ${state.entities.filter((entity) => entity.type === "room").length + 1}`,
    x,
    y,
    w,
    h,
    color: ROOM_COLORS[state.entities.length % ROOM_COLORS.length],
  };
  state.entities.push(room);
  state.selectedId = room.id;
}

function addLineFromDrag(type: "wall" | "door" | "window", start: Point, end: Point): void {
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
  state.entities.push(line);
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
  state.entities.push(shape);
  state.selectedId = shape.id;
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
  state.entities.filter(isRoom).forEach(drawRoom);
  state.entities.filter((entity): entity is LinearElement => entity.type === "wall").forEach((wall) => {
    getVisibleWallSegments(wall).forEach(drawWall2d);
  });
  state.entities.filter((entity): entity is LinearElement => entity.type === "window").forEach(drawWindow2d);
  state.entities.filter((entity): entity is LinearElement => entity.type === "door").forEach(drawDoor2d);
  state.entities.filter(isFurniture).forEach(drawFurniture2d);
  state.entities.filter(isShape).forEach(drawShape2d);

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
    ctx.strokeStyle = x % (GRID * 5) === 0 ? "#d8dee8" : "#edf0f5";
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }
  for (let y = startY; y <= bottom; y += GRID) {
    ctx.beginPath();
    ctx.strokeStyle = y % (GRID * 5) === 0 ? "#d8dee8" : "#edf0f5";
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }
}

function drawRoom(room: Room): void {
  const selected = state.selectedId === room.id;
  ctx.fillStyle = room.color;
  ctx.strokeStyle = selected ? "#2775d1" : "#aeb7c4";
  ctx.lineWidth = selected ? 3 / view.zoom : 1.4 / view.zoom;
  ctx.fillRect(room.x, room.y, room.w, room.h);
  ctx.strokeRect(room.x, room.y, room.w, room.h);

  const label = getRoomLabelPosition(room);
  ctx.fillStyle = "#2e3746";
  ctx.font = `${Math.max(12, 13 / view.zoom)}px "Yu Gothic UI", sans-serif`;
  ctx.textBaseline = "top";
  ctx.fillText(room.name, label.x, label.y);
  if (showDimensions) {
    ctx.fillStyle = "#687386";
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

function drawWall2d(wall: LinearElement): void {
  drawLineElement(wall, "#2f3b4d", WALL_THICKNESS_2D);
}

function drawWindow2d(windowEl: LinearElement): void {
  drawLineElement(windowEl, "#4aa9d6", 8);
  const mid = midpoint(windowEl);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(mid.x, mid.y, 3.5 / view.zoom, 0, Math.PI * 2);
  ctx.fill();
}

function drawDoor2d(door: LinearElement): void {
  ctx.save();
  const selected = state.selectedId === door.id;
  const length = Math.max(distance(door), GRID);
  const angle = Math.atan2(door.y2 - door.y1, door.x2 - door.x1);
  const leafAngle = angle - Math.PI / 2;
  const leafEnd = {
    x: door.x1 + Math.cos(leafAngle) * length,
    y: door.y1 + Math.sin(leafAngle) * length,
  };

  ctx.lineCap = "butt";
  ctx.strokeStyle = "#fbfcfe";
  ctx.lineWidth = (WALL_THICKNESS_2D + 5) / view.zoom;
  ctx.beginPath();
  ctx.moveTo(door.x1, door.y1);
  ctx.lineTo(door.x2, door.y2);
  ctx.stroke();

  ctx.strokeStyle = selected ? "#2775d1" : "#1e2430";
  ctx.lineWidth = (selected ? 3.2 : 2.4) / view.zoom;
  ctx.beginPath();
  ctx.moveTo(door.x1, door.y1);
  ctx.lineTo(leafEnd.x, leafEnd.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(door.x1, door.y1, length, leafAngle, angle, false);
  ctx.stroke();

  ctx.lineWidth = 4 / view.zoom;
  ctx.beginPath();
  ctx.moveTo(door.x1, door.y1);
  ctx.lineTo(door.x1 + Math.cos(angle + Math.PI / 2) * 10, door.y1 + Math.sin(angle + Math.PI / 2) * 10);
  ctx.moveTo(door.x2, door.y2);
  ctx.lineTo(door.x2 + Math.cos(angle + Math.PI / 2) * 10, door.y2 + Math.sin(angle + Math.PI / 2) * 10);
  ctx.stroke();
  ctx.restore();
}

function drawLineElement(entity: LinearElement, color: string, width: number): void {
  const selected = state.selectedId === entity.id;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = (selected ? width + 6 : width) / view.zoom;
  ctx.strokeStyle = selected ? "rgba(39, 117, 209, 0.35)" : color;
  ctx.beginPath();
  ctx.moveTo(entity.x1, entity.y1);
  ctx.lineTo(entity.x2, entity.y2);
  ctx.stroke();
  ctx.lineWidth = width / view.zoom;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(entity.x1, entity.y1);
  ctx.lineTo(entity.x2, entity.y2);
  ctx.stroke();
  ctx.restore();
}

function drawFurniture2d(furniture: Furniture): void {
  const selected = state.selectedId === furniture.id;
  const base = BASE_FURNITURE[furniture.kind];
  ctx.save();
  ctx.translate(furniture.x + furniture.w / 2, furniture.y + furniture.h / 2);
  ctx.rotate((furniture.rotation * Math.PI) / 180);
  roundedRect(-furniture.w / 2, -furniture.h / 2, furniture.w, furniture.h, 8);
  ctx.fillStyle = `#${base.color.toString(16).padStart(6, "0")}`;
  ctx.fill();
  ctx.strokeStyle = selected ? "#2775d1" : "rgba(34, 41, 54, 0.28)";
  ctx.lineWidth = selected ? 3 / view.zoom : 1.5 / view.zoom;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.max(11, 12 / view.zoom)}px "Yu Gothic UI", sans-serif`;
  ctx.fillText(base.label, 0, 0);
  ctx.restore();
  if (selected) drawResizeHandles(furniture);
}

function drawShape2d(shape: Shape): void {
  const selected = state.selectedId === shape.id;
  ctx.save();
  if (selected) {
    ctx.strokeStyle = "rgba(39, 117, 209, 0.35)";
    ctx.lineWidth = (WALL_THICKNESS_2D + 6) / view.zoom;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (shape.kind === "circle") {
      ctx.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2);
    } else {
      ctx.arc(shape.x, shape.y, shape.r, shape.startAngle, shape.endAngle);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = "#2f3b4d";
  ctx.lineWidth = WALL_THICKNESS_2D / view.zoom;
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

function rebuildThree(): void {
  disposeGroup(planGroup);
  const rooms = state.entities.filter(isRoom);
  const bounds = getBounds();
  const center = bounds ? { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 } : { x: 0, y: 0 };

  if (rooms.length === 0) {
    addGroundPlaceholder(center);
  } else {
    rooms.forEach((room) => addRoom3d(room, center));
  }

  state.entities.filter((entity): entity is LinearElement => entity.type === "wall").forEach((wall) => addWall3d(wall, center));
  state.entities.filter(isShape).forEach((shape) => addShapeWall3d(shape, center));
  state.entities.filter((entity): entity is LinearElement => entity.type === "door").forEach((door) => addDoor3d(door, center));
  state.entities.filter((entity): entity is LinearElement => entity.type === "window").forEach((windowEl) => addWindow3d(windowEl, center));
  state.entities.filter(isFurniture).forEach((furniture) => addFurniture3d(furniture, center));

  addSubtleGrid(bounds, center);
  frameCamera(bounds);
  updateUi();
}

function addRoom3d(room: Room, center: Point): void {
  const width = room.w * SCALE_3D;
  const depth = room.h * SCALE_3D;
  const geometry = new THREE.BoxGeometry(width, 0.06, depth);
  const material = roomMaterial(room.color);
  const mesh = new THREE.Mesh(geometry, material);
  const pos = to3d(room.x + room.w / 2, room.y + room.h / 2, center);
  mesh.position.set(pos.x, 0, pos.z);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  markSelectable(mesh, room.id);
  planGroup.add(mesh);

  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMaterial);
  edge.position.copy(mesh.position);
  planGroup.add(edge);
  addSelectionBox(mesh, room.id);
}

function addWall3d(wall: LinearElement, center: Point): void {
  getVisibleWallSegments(wall).forEach((segment) => addStraightWall3d(segment, center, wall.id));
}

function addStraightWall3d(wall: LinearElement, center: Point, entityId = wall.id, showSelection = true): void {
  const length = distance(wall) * SCALE_3D;
  if (length <= 0.02) return;
  const thickness = WALL_THICKNESS_2D * SCALE_3D;
  const angle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1);
  const geometry = new THREE.BoxGeometry(length, WALL_HEIGHT, thickness);
  const mesh = new THREE.Mesh(geometry, wallMaterial);
  const mid = midpoint(wall);
  const pos = to3d(mid.x, mid.y, center);
  mesh.position.set(pos.x, WALL_HEIGHT / 2, pos.z);
  mesh.rotation.y = -angle;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  markSelectable(mesh, entityId);
  planGroup.add(mesh);

  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(length + 0.01, 0.08, thickness + 0.01),
    wallCapMaterial,
  );
  cap.position.set(pos.x, WALL_HEIGHT + 0.04, pos.z);
  cap.rotation.y = -angle;
  cap.castShadow = true;
  markSelectable(cap, entityId);
  planGroup.add(cap);
  if (showSelection) {
    addSelectionBox(mesh, entityId);
  }
}

function addShapeWall3d(shape: Shape, center: Point): void {
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
    };
    addStraightWall3d(segment, center, shape.id, false);
  }
}

function addDoor3d(door: LinearElement, center: Point): void {
  const length = Math.max(distance(door) * SCALE_3D, 0.7);
  const frameThickness = 0.1;
  const frameHeight = 2.62;
  const panelHeight = 2.42;
  const panelThickness = 0.08;
  const angle = lineAngle(door);
  const mid = midpoint(door);

  const panel = addOrientedBox(mid, center, length * 0.92, panelHeight, panelThickness, panelHeight / 2, angle, doorMaterial, door.id);
  panel.castShadow = true;
  panel.receiveShadow = true;

  const handleOffset = localOffset3d(length * 0.34, panelThickness * 0.72, angle);
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd7b56d, roughness: 0.42, metalness: 0.25 }));
  const panelPos = to3d(mid.x, mid.y, center);
  handle.position.set(panelPos.x + handleOffset.x, 1.2, panelPos.z + handleOffset.z);
  handle.castShadow = true;
  markSelectable(handle, door.id);
  planGroup.add(handle);

  addOrientedBox(mid, center, length + frameThickness * 2, 0.08, frameThickness, 0.04, angle, doorFrameMaterial, door.id);
  addOrientedBox(mid, center, length + frameThickness * 2, 0.12, frameThickness, frameHeight, angle, doorFrameMaterial, door.id);

  addOrientedBox({ x: door.x1, y: door.y1 }, center, frameThickness, frameHeight, frameThickness, frameHeight / 2, angle, doorFrameMaterial, door.id);
  addOrientedBox({ x: door.x2, y: door.y2 }, center, frameThickness, frameHeight, frameThickness, frameHeight / 2, angle, doorFrameMaterial, door.id);
  addSelectionBox(panel, door.id);
}

function addWindow3d(windowEl: LinearElement, center: Point): void {
  const length = distance(windowEl) * SCALE_3D;
  const angle = lineAngle(windowEl);
  const mid = midpoint(windowEl);
  const frameThickness = 0.08;
  const frameDepth = 0.1;
  const glassHeight = 1.08;
  const glassY = 1.58;
  const frameBottom = glassY - glassHeight / 2;
  const frameTop = glassY + glassHeight / 2;

  const glass = addOrientedBox(mid, center, Math.max(length - frameThickness * 1.2, 0.2), glassHeight, 0.04, glassY, angle, windowMaterial, windowEl.id);
  glass.receiveShadow = true;

  addOrientedBox(mid, center, length + frameThickness, frameThickness, frameDepth, frameBottom, angle, windowFrameMaterial, windowEl.id);
  addOrientedBox(mid, center, length + frameThickness, frameThickness, frameDepth, frameTop, angle, windowFrameMaterial, windowEl.id);
  addOrientedBox({ x: windowEl.x1, y: windowEl.y1 }, center, frameThickness, glassHeight + frameThickness, frameDepth, glassY, angle, windowFrameMaterial, windowEl.id);
  addOrientedBox({ x: windowEl.x2, y: windowEl.y2 }, center, frameThickness, glassHeight + frameThickness, frameDepth, glassY, angle, windowFrameMaterial, windowEl.id);
  addOrientedBox(mid, center, frameThickness * 0.72, glassHeight, frameDepth, glassY, angle, windowFrameMaterial, windowEl.id);
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

function addFurniture3d(furniture: Furniture, center: Point): void {
  const base = BASE_FURNITURE[furniture.kind];
  const width = furniture.w * SCALE_3D;
  const depth = furniture.h * SCALE_3D;
  const material = new THREE.MeshStandardMaterial({ color: base.color, roughness: 0.64 });
  const height = furniture.kind === "bed" ? 0.58 : furniture.kind === "kitchen" ? 1.1 : furniture.kind === "bath" ? 0.68 : 0.78;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  const pos = to3d(furniture.x + furniture.w / 2, furniture.y + furniture.h / 2, center);
  mesh.position.set(pos.x, height / 2 + 0.05, pos.z);
  mesh.rotation.y = (-furniture.rotation * Math.PI) / 180;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  planGroup.add(mesh);

  if (furniture.kind === "sofa") {
    addFurniturePart(mesh, width, 0.46, 0.14, 0, height * 0.58, -depth * 0.46, base.color);
  }
  if (furniture.kind === "table" || furniture.kind === "desk") {
    addLegs(mesh, width, depth, height, base.color);
  }
  if (furniture.kind === "bath") {
    const tub = new THREE.Mesh(new THREE.BoxGeometry(width * 0.76, 0.05, depth * 0.62), new THREE.MeshStandardMaterial({ color: 0xe9f6fb, roughness: 0.25 }));
    tub.position.set(0, height / 2 + 0.03, 0);
    mesh.add(tub);
  }
  markSelectable(mesh, furniture.id);
  addSelectionBox(mesh, furniture.id);
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

function addFurniturePart(parent: THREE.Mesh, width: number, height: number, depth: number, x: number, y: number, z: number, color: number): void {
  const part = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
  part.position.set(x, y, z);
  part.castShadow = true;
  parent.add(part);
}

function addLegs(parent: THREE.Mesh, width: number, depth: number, height: number, color: number): void {
  const legMaterial = new THREE.MeshStandardMaterial({ color: shadeColor(color, -0.25), roughness: 0.72 });
  const positions = [
    [-width * 0.38, -depth * 0.34],
    [width * 0.38, -depth * 0.34],
    [-width * 0.38, depth * 0.34],
    [width * 0.38, depth * 0.34],
  ];
  positions.forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, height, 0.07), legMaterial);
    leg.position.set(x, -height * 0.42, z);
    leg.castShadow = true;
    parent.add(leg);
  });
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
  const distanceToFit = clamp(size * 1.5, 7, 28);
  camera.position.set(distanceToFit * 0.9, distanceToFit * 0.78, distanceToFit);
  controls.target.set(0, 0.45, 0);
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
  document.querySelector<HTMLButtonElement>("#undoButton")?.toggleAttribute("disabled", historyIndex <= 0);
  document.querySelector<HTMLButtonElement>("#redoButton")?.toggleAttribute("disabled", historyIndex >= history.length - 1);
}

function updateStats(): void {
  const rooms = state.entities.filter(isRoom).length;
  const walls = state.entities.filter((entity) => entity.type === "wall").length;
  const furniture = state.entities.filter(isFurniture).length;
  const shapes = state.entities.filter(isShape).length;
  const threeParts = state.entities.length;
  planStats.textContent = `${rooms}室 / 壁${walls} / 家具${furniture}${shapes ? ` / 図形${shapes}` : ""}`;
  threeStats.textContent = `部屋${rooms}・部材${threeParts}を自動変換`;
}

function updatePropertiesPanel(): void {
  const selected = state.selectedId ? findEntity(state.selectedId) : null;
  if (!selected) {
    propertiesPanel.innerHTML = `<p class="empty-state">選択ツールで部屋・壁・家具を選ぶと、名前や寸法を調整できます。</p>`;
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
        <label>色<input id="roomColorInput" type="color" value="${selected.color}" /></label>
      </div>
    `;
    bindInput("#roomNameInput", (value) => (selected.name = value || "部屋"));
    bindNumber("#roomWInput", (value) => (selected.w = Math.max(GRID * 2, snap(value))));
    bindNumber("#roomHInput", (value) => (selected.h = Math.max(GRID * 2, snap(value))));
    bindInput("#roomColorInput", (value) => (selected.color = value));
    return;
  }

  if (isLinear(selected)) {
    const typeLabel = selected.type === "wall" ? "壁" : selected.type === "door" ? "ドア" : "窓";
    propertiesPanel.innerHTML = `
      <div class="property-grid">
        <p class="empty-state">${typeLabel} / 長さ ${Math.round(distance(selected))} cm</p>
        <div class="two-col">
          <label>始点X<input id="lineXInput" type="number" step="20" value="${selected.x1}" /></label>
          <label>始点Y<input id="lineYInput" type="number" step="20" value="${selected.y1}" /></label>
        </div>
      </div>
    `;
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
    return;
  }

  const selectedFurniture = selected as Furniture;
  propertiesPanel.innerHTML = `
    <div class="property-grid">
      <label>種類
        <select id="furnitureKindInput">
          ${Object.entries(BASE_FURNITURE)
            .map(([key, value]) => `<option value="${key}" ${key === selectedFurniture.kind ? "selected" : ""}>${value.label}</option>`)
            .join("")}
        </select>
      </label>
      <div class="two-col">
        <label>幅 cm<input id="furnitureWInput" type="number" min="20" step="20" value="${selectedFurniture.w}" /></label>
        <label>奥行 cm<input id="furnitureHInput" type="number" min="20" step="20" value="${selectedFurniture.h}" /></label>
      </div>
      <label>回転<input id="furnitureRotationInput" type="number" step="15" value="${selectedFurniture.rotation}" /></label>
    </div>
  `;
  bindSelect("#furnitureKindInput", (value) => (selectedFurniture.kind = value as FurnitureKind));
  bindNumber("#furnitureWInput", (value) => (selectedFurniture.w = Math.max(GRID, snap(value))));
  bindNumber("#furnitureHInput", (value) => (selectedFurniture.h = Math.max(GRID, snap(value))));
  bindNumber("#furnitureRotationInput", (value) => (selectedFurniture.rotation = value % 360));
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
  const bounds = getBounds();
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
  if (pushHistory) commitState();
  persistState();
  fitPlanToCanvas();
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
      const parsed = JSON.parse(String(reader.result)) as PlanState;
      if (!Array.isArray(parsed.entities)) throw new Error("Invalid plan");
      replaceState({ entities: parsed.entities, selectedId: null }, true);
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
  for (let i = state.entities.length - 1; i >= 0; i -= 1) {
    const entity = state.entities[i];
    if (entity.type === "room" && isPointInRoomLabel(point, entity)) {
      return { entity, corner: "label" };
    }
  }

  for (let i = state.entities.length - 1; i >= 0; i -= 1) {
    const entity = state.entities[i];
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
    } else if (distanceToSegment(point, { x: entity.x1, y: entity.y1 }, { x: entity.x2, y: entity.y2 }) < 12 / view.zoom) {
      return { entity, corner: null };
    }
  }
  return { entity: null, corner: null };
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

function makeTemplate(key: string): Entity[] {
  if (key === "studio") {
    return [
      room("LDK", 0, 0, 360, 300, "#e9eff8"),
      room("水回り", 360, 0, 140, 160, "#e8f2ed"),
      wall(0, 0, 500, 0),
      wall(500, 0, 500, 300),
      wall(500, 300, 0, 300),
      wall(0, 300, 0, 0),
      wall(360, 0, 360, 160),
      door(330, 300, 390, 300),
      windowLine(80, 0, 220, 0),
      furniture("sofa", 60, 172, 92, 44),
      furniture("table", 178, 170, 62, 46),
      furniture("kitchen", 372, 20, 112, 44),
      furniture("bath", 390, 92, 72, 50),
    ];
  }

  if (key === "twoLdk") {
    return [
      room("LDK", 0, 0, 380, 280, "#f5efe4"),
      room("洋室 1", 380, 0, 220, 200, "#e9eff8"),
      room("洋室 2", 0, 280, 240, 200, "#eef0e3"),
      room("水回り", 240, 280, 180, 200, "#e8f2ed"),
      room("玄関", 420, 200, 180, 280, "#f6e8e0"),
      wall(0, 0, 600, 0),
      wall(600, 0, 600, 480),
      wall(600, 480, 0, 480),
      wall(0, 480, 0, 0),
      wall(380, 0, 380, 200),
      wall(0, 280, 420, 280),
      wall(240, 280, 240, 480),
      wall(420, 200, 600, 200),
      door(340, 280, 400, 280),
      door(380, 130, 380, 190),
      door(214, 280, 274, 280),
      door(420, 340, 420, 400),
      windowLine(80, 0, 250, 0),
      windowLine(440, 0, 560, 0),
      windowLine(40, 480, 190, 480),
      furniture("sofa", 50, 150, 100, 46),
      furniture("table", 192, 144, 70, 48),
      furniture("bed", 426, 38, 94, 124),
      furniture("bed", 40, 326, 94, 124),
      furniture("kitchen", 242, 20, 118, 44),
      furniture("bath", 284, 340, 76, 54),
    ];
  }

  return [
    room("LDK", 0, 0, 380, 300, "#f5efe4"),
    room("寝室", 380, 0, 220, 220, "#e9eff8"),
    room("水回り", 380, 220, 220, 160, "#e8f2ed"),
    room("玄関", 0, 300, 240, 80, "#f6e8e0"),
    wall(0, 0, 600, 0),
    wall(600, 0, 600, 380),
    wall(600, 380, 0, 380),
    wall(0, 380, 0, 0),
    wall(380, 0, 380, 380),
    wall(380, 220, 600, 220),
    wall(0, 300, 380, 300),
    door(340, 300, 400, 300),
    door(380, 150, 380, 210),
    door(480, 220, 540, 220),
    windowLine(70, 0, 250, 0),
    windowLine(430, 0, 560, 0),
    furniture("sofa", 54, 162, 98, 46),
    furniture("table", 194, 154, 70, 48),
    furniture("bed", 440, 48, 94, 126),
    furniture("kitchen", 234, 22, 116, 44),
    furniture("bath", 442, 278, 76, 54),
  ];
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

function furniture(kind: FurnitureKind, x: number, y: number, w: number, h: number): Furniture {
  return { id: newId("furniture"), type: "furniture", kind, x, y, w, h, rotation: 0 };
}

function cloneState(value: PlanState): PlanState {
  return JSON.parse(JSON.stringify(value)) as PlanState;
}

function cloneEntity(value: Entity): Entity {
  return JSON.parse(JSON.stringify(value)) as Entity;
}

function findEntity(id: string): Entity | undefined {
  return state.entities.find((entity) => entity.id === id);
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

function getVisibleWallSegments(wall: LinearElement): LinearElement[] {
  const direction = lineDirection(wall);
  const wallFrom = direction === "horizontal" ? Math.min(wall.x1, wall.x2) : Math.min(wall.y1, wall.y2);
  const wallTo = direction === "horizontal" ? Math.max(wall.x1, wall.x2) : Math.max(wall.y1, wall.y2);
  const openings = getWallOpenings(wall, wallFrom, wallTo);
  if (openings.length === 0) return [wall];

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

  return intervals.map((interval) => intervalToWallSegment(wall, interval));
}

function getWallOpenings(wall: LinearElement, wallFrom: number, wallTo: number): WallOpening[] {
  const direction = lineDirection(wall);
  const wallLinePosition = direction === "horizontal" ? (wall.y1 + wall.y2) / 2 : (wall.x1 + wall.x2) / 2;
  const tolerance = WALL_THICKNESS_2D * 1.4;
  const clearance = WALL_THICKNESS_2D * 0.7;

  return state.entities
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

function intervalToWallSegment(wall: LinearElement, interval: WallOpening): LinearElement {
  if (lineDirection(wall) === "horizontal") {
    const y = (wall.y1 + wall.y2) / 2;
    return { ...wall, x1: interval.from, y1: y, x2: interval.to, y2: y };
  }
  const x = (wall.x1 + wall.x2) / 2;
  return { ...wall, x1: x, y1: interval.from, x2: x, y2: interval.to };
}

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

function getBounds(includeEntity: (entity: Entity) => boolean = () => true): Bounds | null {
  if (state.entities.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  state.entities.forEach((entity) => {
    if (!includeEntity(entity)) return;
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

function roomMaterial(color: string): THREE.MeshStandardMaterial {
  const cached = roomMaterialCache.get(color);
  if (cached) return cached;
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.82 });
  roomMaterialCache.set(color, material);
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
  return `${Math.round(value / 20) / 10}m`;
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

function shadeColor(color: number, amount: number): number {
  const threeColor = new THREE.Color(color);
  threeColor.offsetHSL(0, 0, amount);
  return threeColor.getHex();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function newId(prefix: EntityType): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
