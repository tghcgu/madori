// 雛形（間取りの見本）。家・病院・洋館など27種類のうち、ここで作る物（住まいの4種類と作例は main.ts）。
// 部屋・壁・建具・家具を、書き出しJSONと同じ形のデータで作る。読み込むときに main.ts の normalizePlan で確かめる。
// 壁は部屋の縁から自動で立てる（隣り合う部屋の縁は1本にまとめる）。家具の位置は、回したあとの見た目の左上で書く

export interface TemplateInfo {
  key: string;
  label: string;
  title: string;
}

export const TEMPLATE_GROUPS: { label: string; templates: TemplateInfo[] }[] = [
  {
    label: "住まい",
    templates: [
      { key: "studio", label: "ワンルーム", title: "1部屋と水回りの小さな家" },
      { key: "oneLdk", label: "1LDK", title: "LDKと寝室" },
      { key: "twoLdk", label: "2LDK", title: "LDKと洋室2つ" },
      { key: "twoStory", label: "二階建て 3LDK", title: "1階にLDK、2階に寝室と洋室" },
      { key: "japaneseHouse", label: "平屋の日本家屋", title: "茶の間・座敷・土間・縁側と庭のある和風の家" },
      { key: "apartment", label: "アパート", title: "1Kが3部屋ずつの二階建て。外廊下と外階段" },
      { key: "sample", label: "サンプル（作例）", title: "いろいろな家具や床を置いた作例" },
    ],
  },
  {
    label: "屋敷・宿",
    templates: [
      { key: "westernMansion", label: "洋館", title: "大広間・食堂・書斎のある二階建てと地下室" },
      { key: "lodge", label: "山荘・ペンション", title: "暖炉のラウンジと客室4つ。森とテラス" },
      { key: "ryokan", label: "旅館", title: "客室・宴会場・大浴場と中庭" },
      { key: "hotel", label: "ホテル", title: "廊下に客室が並ぶ1フロア" },
    ],
  },
  {
    label: "お店",
    templates: [
      { key: "cafe", label: "カフェ", title: "カウンターと客席、テラス席" },
      { key: "bar", label: "バー", title: "カウンターとボックス席" },
      { key: "convenience", label: "コンビニ", title: "売り場・レジ・事務所と駐車場" },
    ],
  },
  {
    label: "施設",
    templates: [
      { key: "hospital", label: "病院", title: "待合・診察室・病室・手術室" },
      { key: "school", label: "学校", title: "教室3つ・職員室・保健室・昇降口" },
      { key: "office", label: "オフィス", title: "執務室・会議室・社長室" },
      { key: "library", label: "図書館", title: "本棚と閲覧席、書庫" },
      { key: "church", label: "教会", title: "長椅子の並ぶ礼拝堂" },
      { key: "shrine", label: "神社", title: "本殿・拝殿・社務所と参道" },
      { key: "police", label: "警察署", title: "刑事課・取調室・留置場" },
      { key: "lab", label: "研究所", title: "実験室・資料室・サーバー室" },
      { key: "museum", label: "美術館", title: "展示室3つとショップ" },
      { key: "bathhouse", label: "銭湯", title: "男湯・女湯と番台" },
    ],
  },
  {
    label: "屋外・そのほか",
    templates: [
      { key: "park", label: "公園", title: "遊び場・池・広場" },
      { key: "factory", label: "廃工場", title: "作業場・倉庫・事務所" },
      { key: "dungeon", label: "地下牢", title: "牢屋・大広間・武器庫・宝物庫のダンジョン" },
    ],
  },
];

type Raw = Record<string, unknown>;
type Surface = "plain" | "wood" | "tile" | "stone" | "grass";
export type TemplateIdPrefix = "room" | "wall" | "door" | "window" | "furniture" | "roof" | "floor";

interface ItemOptions {
  w?: number;
  h?: number;
  // 回転（度）。0 は背もたれ・頭の側が上（奥）、90 は右、180 は下、270 は左
  rot?: 0 | 90 | 180 | 270;
  symbol?: number;
  color?: string;
  color3d?: string;
  height?: number;
  flip?: boolean;
}

export interface TemplatePlan {
  floors: { id: string; name: string; entities: Raw[] }[];
  activeFloor: number;
  selectedId: null;
  roofs: Raw[];
  basements?: number;
}

// 床の色（面のつくり surface を付けた部屋は、その模様の地の色）
const C = {
  white: "#ffffff",
  warm: "#fbf7f0",
  cool: "#f3f7fb",
  mint: "#eef6f1",
  rose: "#fbefec",
  cream: "#fdf8e8",
  gray: "#eef0f3",
  tatami: "#e8e2b8",
  wood: "#d6b58a",
  tile: "#dfe7ea",
  stone: "#aeb3b1",
  darkStone: "#9a9c98",
  grass: "#83ab57",
  sand: "#eadcbc",
};

const round = (value: number) => Math.round(value * 10) / 10;

function floorBuilder(id: string, newId: (prefix: TemplateIdPrefix) => string, sizes: Record<string, { w: number; h: number }>) {
  const entities: Raw[] = [];
  const walled: [number, number, number, number][] = [];
  const openings: [number, number, number, number][] = [];
  const roomData = (name: string, x: number, y: number, w: number, h: number, color: string, surface: Surface) =>
    ({ id: newId("room"), type: "room", name, x, y, w, h, color, surface });
  const f = {
    id,
    entities,
    // 壁で囲む部屋
    room(name: string, x: number, y: number, w: number, h: number, color = C.white, surface: Surface = "plain") {
      entities.push(roomData(name, x, y, w, h, color, surface));
      walled.push([x, y, w, h]);
      return f;
    },
    // 壁のない所（庭・駐車場・外廊下・参道など）
    area(name: string, x: number, y: number, w: number, h: number, surface: Surface, color: string) {
      entities.push(roomData(name, x, y, w, h, color, surface));
      return f;
    },
    // 直前に足した部屋・場所の名前の位置（部屋の左上から）。家具に隠れないように動かす
    label(dx: number, dy: number) {
      const room = [...entities].reverse().find((entity) => entity.type === "room");
      if (room) Object.assign(room, { labelOffsetX: dx, labelOffsetY: dy });
      return f;
    },
    // 自動で立てる壁のうち、開けておく所（部屋どうしをつなぐ広い出入り口）
    open(x1: number, y1: number, x2: number, y2: number) {
      openings.push([x1, y1, x2, y2]);
      return f;
    },
    door(x1: number, y1: number, x2: number, y2: number, options: { flip?: boolean; sliding?: boolean } = {}) {
      entities.push({
        id: newId("door"), type: "door", x1, y1, x2, y2,
        ...(options.flip ? { flip: true } : {}),
        ...(options.sliding ? { doorStyle: "sliding" } : {}),
      });
      return f;
    },
    sliding(x1: number, y1: number, x2: number, y2: number) {
      return f.door(x1, y1, x2, y2, { sliding: true });
    },
    window(x1: number, y1: number, x2: number, y2: number, mullion = false) {
      entities.push({ id: newId("window"), type: "window", x1, y1, x2, y2, ...(mullion ? { mullion: true } : {}) });
      return f;
    },
    // 家具。(X, Y) は回したあとの見た目の左上
    item(kind: string, X: number, Y: number, options: ItemOptions = {}) {
      const size = sizes[kind];
      if (!size) throw new Error(`Unknown furniture kind: ${kind}`);
      const w = options.w ?? size.w, h = options.h ?? size.h;
      const rot = options.rot ?? 0;
      const sideways = rot === 90 || rot === 270;
      const cx = X + (sideways ? h : w) / 2, cy = Y + (sideways ? w : h) / 2;
      entities.push({
        id: newId("furniture"), type: "furniture", kind,
        x: round(cx - w / 2), y: round(cy - h / 2), w, h, rotation: rot,
        ...(options.symbol ? { symbol: options.symbol } : {}),
        ...(options.color ? { color: options.color } : {}),
        ...(options.color3d ? { color3d: options.color3d } : {}),
        ...(options.height ? { height: options.height } : {}),
        ...(options.flip ? { flip: true } : {}),
      });
      return f;
    },
    // 同じ家具を (dx, dy) ずつずらして count 個
    row(kind: string, X: number, Y: number, count: number, dx: number, dy: number, options: ItemOptions = {}) {
      for (let i = 0; i < count; i += 1) f.item(kind, X + dx * i, Y + dy * i, options);
      return f;
    },
    // 部屋の縁に壁を立てる。重なる縁は1本にまとめ、open で開けた所は除く。部屋を並べ終えてから呼ぶ
    walls() {
      const lines = new Map<string, [number, number][]>();
      const add = (key: string, a: number, b: number) => {
        const spans = lines.get(key) ?? [];
        spans.push([Math.min(a, b), Math.max(a, b)]);
        lines.set(key, spans);
      };
      for (const [x, y, w, h] of walled) {
        add(`h:${y}`, x, x + w);
        add(`h:${y + h}`, x, x + w);
        add(`v:${x}`, y, y + h);
        add(`v:${x + w}`, y, y + h);
      }
      lines.forEach((spans, key) => {
        spans.sort((a, b) => a[0] - b[0]);
        let pieces: [number, number][] = [];
        for (const span of spans) {
          const last = pieces[pieces.length - 1];
          if (last && span[0] <= last[1] + 0.01) last[1] = Math.max(last[1], span[1]);
          else pieces.push([span[0], span[1]]);
        }
        for (const [x1, y1, x2, y2] of openings) {
          const cutKey = y1 === y2 ? `h:${y1}` : x1 === x2 ? `v:${x1}` : "";
          if (cutKey !== key) continue;
          const ca = y1 === y2 ? Math.min(x1, x2) : Math.min(y1, y2), cb = y1 === y2 ? Math.max(x1, x2) : Math.max(y1, y2);
          pieces = pieces.flatMap(([a, b]): [number, number][] =>
            cb <= a || ca >= b ? [[a, b]] : [...(ca > a ? [[a, ca] as [number, number]] : []), ...(cb < b ? [[cb, b] as [number, number]] : [])]);
        }
        const [axis, value] = [key[0], Number(key.slice(2))];
        for (const [a, b] of pieces) {
          if (b - a < 1) continue;
          entities.push(axis === "h"
            ? { id: newId("wall"), type: "wall", x1: a, y1: value, x2: b, y2: value }
            : { id: newId("wall"), type: "wall", x1: value, y1: a, x2: value, y2: b });
        }
      });
      return f;
    },
  };
  return f;
}

type FloorBuilder = ReturnType<typeof floorBuilder>;

function planBuilder(newId: (prefix: TemplateIdPrefix) => string, sizes: Record<string, { w: number; h: number }>) {
  const floors: FloorBuilder[] = [];
  const roofs: Raw[] = [];
  return {
    // 下の階から順に作る
    floor() {
      const floor = floorBuilder(newId("floor"), newId, sizes);
      floors.push(floor);
      return floor;
    },
    roof(kind: "gable" | "hip" | "flat", x: number, y: number, w: number, h: number, floor: FloorBuilder) {
      roofs.push({ id: newId("roof"), type: "roof", kind, x, y, w, h, floorId: floor.id });
    },
    plan(basements = 0): TemplatePlan {
      return {
        floors: floors.map((floor) => ({ id: floor.id, name: "", entities: floor.entities })),
        activeFloor: basements,
        selectedId: null,
        roofs,
        ...(basements ? { basements } : {}),
      };
    },
  };
}

type PlanBuilder = ReturnType<typeof planBuilder>;

// ---- 住まい ----

function japaneseHouse(b: PlanBuilder): void {
  const f = b.floor();
  f.area("庭", 1260, 0, 640, 900, "grass", C.grass).label(20, 835)
    .room("台所", 0, 0, 270, 450, C.wood, "wood").label(60, 90)
    .room("茶の間", 270, 0, 450, 450, C.tatami)
    .room("座敷", 720, 0, 450, 450, C.tatami)
    .room("縁側", 1170, 0, 90, 900, C.wood, "wood")
    .room("土間", 0, 450, 270, 450, C.stone, "stone")
    .room("", 270, 450, 900, 90, C.wood, "wood")
    .room("洗面", 270, 540, 180, 180, C.tile, "tile")
    .room("風呂", 270, 720, 180, 180, C.tile, "tile")
    .room("便所", 450, 540, 90, 180, C.tile, "tile")
    .room("納戸", 450, 720, 90, 180, C.warm).label(10, 45)
    .room("寝室", 540, 540, 360, 360, C.tatami).label(190, 15)
    .room("次の間", 900, 540, 270, 360, C.tatami)
    .walls()
    .sliding(60, 900, 180, 900)
    .sliding(90, 450, 180, 450)
    .sliding(270, 460, 270, 530)
    .sliding(270, 150, 270, 300)
    .sliding(720, 100, 720, 350)
    .sliding(400, 450, 490, 450)
    .sliding(900, 450, 990, 450)
    .sliding(1170, 60, 1170, 390)
    .sliding(1170, 600, 1170, 840)
    .sliding(1170, 460, 1170, 530)
    .door(320, 540, 400, 540)
    .sliding(320, 720, 400, 720)
    .door(460, 540, 530, 540)
    .sliding(540, 760, 540, 840)
    .sliding(620, 540, 710, 540)
    .sliding(900, 600, 900, 840)
    .sliding(960, 540, 1050, 540)
    .window(60, 0, 210, 0)
    .window(330, 0, 660, 0, true)
    .window(780, 0, 1110, 0, true)
    .window(1260, 40, 1260, 420, true)
    .window(1260, 480, 1260, 860, true)
    .window(0, 560, 0, 700)
    .window(0, 120, 0, 330)
    .window(300, 900, 420, 900)
    .window(600, 900, 840, 900, true)
    .window(960, 900, 1110, 900)
    // 台所
    .item("kitchen", 15, 10)
    .item("fridge", 190, 365)
    .item("cupboard", 5, 150, { rot: 270 })
    .item("diningTable", 75, 160, { w: 150, h: 150 })
    // 茶の間
    .item("kotatsu", 405, 135)
    .item("zaisu", 467, 70)
    .item("zaisu", 467, 317, { rot: 180 })
    .item("zaisu", 337, 198, { rot: 270 })
    .item("zaisu", 588, 198, { rot: 90 })
    .item("wardrobe", 280, 400, { rot: 180 })
    .item("tv", 590, 405, { rot: 180 })
    // 座敷
    .item("table", 845, 180, { w: 200, h: 90 })
    .row("zaisu", 880, 112, 2, 100, 0)
    .row("zaisu", 880, 273, 2, 100, 0, { rot: 180 })
    .item("plant", 1120, 400)
    // 土間・水回り
    .item("shoeCabinet", 5, 760, { rot: 270 })
    .item("bicycle", 180, 600)
    .item("washbasin", 275, 612, { rot: 270 })
    .item("washer", 375, 615)
    .item("bath", 280, 815)
    .item("toilet", 472, 640, { rot: 180 })
    .item("shelf", 450, 725)
    .item("shelf", 450, 865, { rot: 180 })
    // 寝室・次の間
    .row("futon", 580, 620, 2, 130, 0)
    .item("wardrobe", 560, 850, { rot: 180 })
    .item("desk", 990, 830, { rot: 180 })
    .item("zaisu", 1022, 760)
    .item("shelf", 1060, 545)
    // 庭
    .item("pond", 1450, 330)
    .item("stoneLantern", 1390, 260)
    .item("steppingStones", 1290, 640, { rot: 90 })
    .item("conifer", 1650, 40)
    .item("rock", 1300, 470)
    .item("shrub", 1290, 40)
    .item("tree", 1560, 620, { w: 260, h: 260 });
  b.roof("hip", -40, -40, 1340, 980, f);
}

function apartment(b: PlanBuilder): void {
  const unit = (f: FloorBuilder, ux: number) => {
    f.room(`${f === first ? 1 : 2}0${ux / 300 + 1}`, ux, 0, 300, 340, C.wood, "wood").label(12, 300)
      .room("", ux, 340, 190, 260, C.warm)
      .room("", ux + 190, 340, 110, 260, C.tile, "tile");
  };
  const furnish = (f: FloorBuilder, ux: number) => {
    f.door(ux + 30, 600, ux + 110, 600)
      .door(ux + 60, 340, ux + 140, 340)
      .door(ux + 190, 380, ux + 190, 450)
      .window(ux + 50, 0, ux + 250, 0, true)
      .item("bed", ux + 190, 15)
      .item("desk", ux + 15, 15, { w: 100, h: 50 })
      .item("chair", ux + 43, 70, { rot: 180 })
      .item("table", ux + 60, 230, { w: 80, h: 50 })
      .item("kitchen", ux + 5, 410, { w: 170, h: 60, rot: 270 })
      .item("fridge", ux + 115, 525)
      .item("washer", ux + 205, 525)
      .item("toilet", ux + 225, 352)
      .item("shower", ux + 200, 432, { w: 90, h: 85 });
  };
  const first = b.floor();
  first.area("", 0, 720, 1020, 200, "stone", C.stone)
    .area("", 0, 600, 900, 120, "stone", C.stone)
    .area("", 900, 380, 120, 340, "stone", C.stone);
  [0, 300, 600].forEach((ux) => unit(first, ux));
  first.walls();
  [0, 300, 600].forEach((ux) => furnish(first, ux));
  first.item("stairs", 910, 420)
    .row("bicycle", 40, 760, 3, 200, 0, { rot: 90 })
    .row("mailbox", 700, 740, 3, 50, 0);
  const second = b.floor();
  second.area("", 0, 600, 900, 120, "stone", C.stone)
    .area("", 900, 380, 120, 340, "stone", C.stone);
  [0, 300, 600].forEach((ux) => unit(second, ux));
  second.walls();
  [0, 300, 600].forEach((ux) => furnish(second, ux));
  second.item("stairs", 910, 420)
    .row("fence", 0, 702, 3, 300, 0, { w: 300, h: 15 });
  b.roof("gable", -40, -40, 980, 800, second);
}

// ---- 屋敷・宿 ----

function westernMansion(b: PlanBuilder): void {
  const cellar = b.floor();
  cellar.room("", 600, 0, 400, 1100, C.darkStone, "stone")
    .room("ワイン蔵", 0, 0, 600, 600, C.darkStone, "stone")
    .room("地下室", 0, 600, 600, 500, C.darkStone, "stone").label(150, 20)
    .walls()
    .door(600, 250, 600, 350)
    .door(600, 800, 600, 880)
    .item("stairs", 880, 400)
    .row("shelf", 100, 80, 4, 0, 120, { w: 400, h: 40 })
    .item("longTable", 380, 520, { w: 160, h: 60 })
    .item("wardrobe", 30, 620)
    .item("shelf", 5, 750, { rot: 270 })
    .item("longTable", 200, 850, { w: 200, h: 80 })
    .item("chair", 230, 790)
    .item("chair", 330, 790)
    .item("rug", 160, 960, { w: 280, h: 120 });

  const ground = b.floor();
  ground.room("大広間", 0, 0, 600, 600, C.wood, "wood").label(210, 15)
    .room("書斎", 0, 600, 600, 500, C.wood, "wood").label(50, 50)
    .room("玄関ホール", 600, 0, 400, 1100, "#efe9df", "tile").label(60, 450)
    .room("食堂", 1000, 0, 600, 600, C.wood, "wood")
    .room("厨房", 1000, 600, 600, 500, C.tile, "tile")
    .walls()
    .door(740, 1100, 860, 1100)
    .door(600, 240, 600, 360)
    .door(600, 800, 600, 890)
    .door(1000, 240, 1000, 360)
    .door(1000, 800, 1000, 890)
    .door(1250, 600, 1340, 600)
    .window(100, 0, 250, 0).window(350, 0, 500, 0).window(700, 0, 900, 0, true)
    .window(1100, 0, 1250, 0).window(1350, 0, 1500, 0)
    .window(1600, 150, 1600, 450, true).window(1600, 750, 1600, 950)
    .window(150, 1100, 450, 1100, true).window(1150, 1100, 1450, 1100)
    // 玄関ホール
    .item("stairsU", 650, 40, { w: 300, h: 300 })
    .item("stairs", 880, 400)
    .item("grandfatherClock", 620, 380)
    .item("rug", 690, 720, { w: 160, h: 300, color: "#8e2a2a" })
    .item("plantLarge", 610, 1030)
    .item("plantLarge", 930, 1030)
    .item("coatStand", 615, 640)
    // 大広間
    .item("piano", 40, 30)
    .item("fireplace", 5, 240, { rot: 270 })
    .item("rug", 140, 190, { w: 300, h: 220 })
    .item("sofa", 400, 215, { rot: 90 })
    .item("armchair", 200, 105)
    .item("armchair", 200, 415, { rot: 180 })
    .item("table", 230, 265, { w: 120, h: 70 })
    .item("plantLarge", 530, 20)
    .item("plantLarge", 530, 520)
    .item("floorLamp", 20, 520)
    // 書斎
    .item("desk", 220, 920, { w: 160, h: 80, symbol: 2 })
    .item("officeChair", 270, 1010, { rot: 180 })
    .row("shelf", 5, 640, 4, 0, 100, { rot: 270 })
    .row("shelf", 120, 605, 4, 100, 0)
    .item("armchair", 300, 650)
    .item("sideTable", 390, 665)
    .item("armchair", 450, 650)
    .item("floorLamp", 540, 640)
    // 食堂
    .item("longTable", 1120, 250, { w: 360, h: 100 })
    .row("chair", 1135, 195, 6, 60, 0)
    .row("chair", 1135, 360, 6, 60, 0, { rot: 180 })
    .item("chair", 1065, 277, { rot: 270 })
    .item("chair", 1490, 277, { rot: 90 })
    .item("cupboard", 1120, 550, { rot: 180 })
    .item("cupboard", 1420, 550, { rot: 180 })
    .item("grandfatherClock", 1525, 20)
    // 厨房
    .item("kitchenL", 1355, 915, { rot: 180 })
    .item("fridge", 1520, 620)
    .item("fridge", 1450, 620)
    .item("longTable", 1140, 760, { w: 220, h: 80 })
    .item("cupboard", 1005, 950, { rot: 270 })
    .item("trashCan", 1300, 1050);

  const upper = b.floor();
  upper.room("主寝室", 0, 0, 600, 600, C.wood, "wood")
    .room("客室A", 0, 600, 600, 500, C.wood, "wood").label(330, 40)
    .room("", 600, 0, 400, 700, C.wood, "wood")
    .room("浴室", 600, 700, 400, 400, C.tile, "tile")
    .room("客室B", 1000, 0, 600, 600, C.wood, "wood")
    .room("図書室", 1000, 600, 600, 500, C.wood, "wood")
    .walls()
    .door(600, 240, 600, 340)
    .door(600, 620, 600, 690)
    .door(750, 700, 840, 700)
    .door(1000, 240, 1000, 340)
    .door(1000, 620, 1000, 690)
    .window(100, 0, 250, 0).window(350, 0, 500, 0).window(700, 0, 900, 0, true)
    .window(1100, 0, 1250, 0).window(1350, 0, 1500, 0)
    .window(0, 150, 0, 450, true).window(1600, 150, 1600, 450, true)
    .window(150, 1100, 450, 1100).window(700, 1100, 900, 1100).window(1150, 1100, 1450, 1100)
    .item("stairsU", 650, 40, { w: 300, h: 300 })
    .item("plantLarge", 930, 620)
    .item("bench", 700, 450, { w: 150, h: 45 })
    // 主寝室
    .item("bedDouble", 210, 30, { w: 180, h: 210 })
    .item("sideTable", 150, 40)
    .item("sideTable", 400, 40)
    .item("rug", 170, 280, { w: 260, h: 160 })
    .item("wardrobe", 60, 550, { rot: 180 })
    .item("wardrobe", 190, 550, { rot: 180 })
    .item("roundTable", 440, 420, { w: 80, h: 80 })
    .item("armchair", 520, 420, { rot: 90 })
    .item("armchair", 350, 420, { rot: 270 })
    // 客室A
    .item("bed", 60, 640)
    .item("bed", 200, 640)
    .item("desk", 420, 1035, { rot: 180 })
    .item("chair", 458, 980)
    .item("wardrobe", 30, 1050, { rot: 180 })
    // 浴室
    .item("bath", 820, 1015, { rot: 180 })
    .item("washbasin", 605, 760, { rot: 270 })
    .item("washbasin", 605, 850, { rot: 270 })
    .item("toilet", 925, 760, { rot: 90 })
    // 客室B
    .item("bedSemiDouble", 1240, 30)
    .item("sideTable", 1370, 40)
    .item("desk", 1420, 535, { rot: 180 })
    .item("chair", 1458, 480)
    .item("armchair", 1030, 380)
    .item("wardrobe", 1100, 550, { rot: 180 })
    // 図書室
    .row("shelf", 1150, 650, 3, 0, 110, { w: 400, h: 35 })
    .item("armchair", 1040, 990)
    .item("floorLamp", 1130, 1030);
  b.roof("hip", -40, -40, 1680, 1180, upper);
}

function lodge(b: PlanBuilder): void {
  const ground = b.floor();
  ground.area("", -400, -250, 1700, 1350, "grass", C.grass)
    .area("テラス", -320, 0, 320, 500, "wood", C.wood)
    .room("ラウンジ", 0, 0, 600, 500, C.wood, "wood")
    .room("食堂", 600, 0, 400, 500, C.wood, "wood")
    .room("玄関", 0, 500, 300, 300, C.stone, "stone").label(60, 140)
    .room("浴室", 300, 500, 300, 300, C.tile, "tile").label(20, 110)
    .room("厨房", 600, 500, 400, 300, C.tile, "tile")
    .open(600, 100, 600, 400)
    .walls()
    .door(60, 800, 160, 800)
    .door(180, 500, 270, 500)
    .door(300, 700, 300, 780)
    .door(800, 500, 890, 500)
    .sliding(0, 180, 0, 320)
    .window(80, 0, 200, 0).window(400, 0, 520, 0).window(680, 0, 920, 0, true)
    .window(1000, 100, 1000, 400, true).window(700, 800, 900, 800).window(380, 800, 520, 800)
    .window(0, 40, 0, 150).window(0, 350, 0, 460)
    .item("fireplace", 240, 5)
    .item("rug", 150, 120, { w: 300, h: 200, color: "#a8463a" })
    .item("sofa", 215, 300, { rot: 180 })
    .item("armchair", 460, 150, { rot: 90 })
    .item("armchair", 60, 150, { rot: 270 })
    .item("table", 250, 220)
    .item("plantLarge", 520, 430)
    .item("stairs", 10, 520, { rot: 90 })
    .item("shoeCabinet", 5, 650, { rot: 270 })
    .item("coatStand", 230, 640)
    .item("bath", 420, 520)
    .item("washbasin", 320, 520)
    .item("toilet", 540, 720, { rot: 180 })
    .item("shower", 440, 620)
    .item("diningTable", 640, 60)
    .item("diningTable", 820, 60)
    .item("diningTable", 640, 280)
    .item("diningTable", 820, 280)
    .item("kitchen", 620, 730, { rot: 180 })
    .item("fridge", 920, 720)
    .item("longTable", 700, 590, { w: 180, h: 70 })
    .item("cupboard", 950, 520, { rot: 90 })
    .item("parasol", -270, 140, { w: 200, h: 200 })
    .item("roundTable", -210, 200, { w: 80, h: 80 })
    .item("chair", -125, 217, { rot: 90 })
    .item("chair", -265, 217, { rot: 270 })
    .item("bench", -290, 420, { w: 150, h: 50 })
    .item("conifer", -390, -240)
    .item("conifer", 1100, -200)
    .item("conifer", 1110, 300)
    .item("conifer", 1100, 800)
    .item("conifer", -360, 800)
    .item("conifer", 500, 900)
    .item("tree", 150, 840, { w: 260, h: 260 });

  const upper = b.floor();
  upper.room("客室1", 0, 0, 500, 350, C.wood, "wood").label(15, 260)
    .room("客室2", 500, 0, 500, 350, C.wood, "wood").label(15, 260)
    .room("", 0, 350, 1000, 100, C.wood, "wood")
    .room("", 0, 450, 300, 350, C.wood, "wood")
    .room("客室3", 300, 450, 350, 350, C.wood, "wood")
    .room("客室4", 650, 450, 350, 350, C.wood, "wood")
    .open(0, 450, 300, 450)
    .walls()
    .door(200, 350, 280, 350)
    .door(700, 350, 780, 350)
    .door(420, 450, 500, 450)
    .door(780, 450, 860, 450)
    .window(100, 0, 400, 0, true).window(600, 0, 900, 0, true)
    .window(380, 800, 570, 800).window(730, 800, 920, 800).window(0, 550, 0, 700)
    .item("stairs", 10, 520, { rot: 90 })
    .item("plant", 940, 360)
    .item("bed", 40, 30).item("bed", 160, 30).item("sideTable", 270, 40)
    .item("desk", 360, 40, { w: 100, h: 50 }).item("chair", 388, 95, { rot: 180 })
    .item("bed", 540, 30).item("bed", 660, 30).item("sideTable", 770, 40)
    .item("desk", 860, 40, { w: 100, h: 50 }).item("chair", 888, 95, { rot: 180 })
    .item("bed", 330, 590, { rot: 180 }).item("bed", 450, 590, { rot: 180 }).item("sideTable", 560, 740)
    .item("bed", 680, 590, { rot: 180 }).item("bed", 800, 590, { rot: 180 }).item("sideTable", 910, 740);
  b.roof("gable", -60, -60, 1120, 920, upper);
}

function ryokan(b: PlanBuilder): void {
  const f = b.floor();
  f.room("大浴場", 0, 0, 400, 450, C.tile, "tile").label(10, 250)
    .room("脱衣所", 0, 450, 400, 200, C.wood, "wood").label(150, 10)
    .room("帳場", 0, 650, 400, 350, C.wood, "wood")
    .room("松", 400, 0, 300, 250, C.tatami)
    .room("竹", 700, 0, 300, 250, C.tatami)
    .room("", 400, 250, 600, 100, C.wood, "wood")
    .room("", 400, 350, 100, 300, C.wood, "wood")
    .room("", 900, 350, 100, 300, C.wood, "wood")
    .room("", 400, 650, 600, 100, C.wood, "wood")
    .room("中庭", 500, 350, 400, 300, C.grass, "grass")
    .room("梅", 1000, 0, 400, 500, C.tatami)
    .room("宴会場", 1000, 500, 400, 500, C.tatami)
    .room("厨房", 400, 750, 600, 250, C.tile, "tile")
    .open(400, 350, 500, 350).open(900, 350, 1000, 350).open(400, 650, 500, 650).open(900, 650, 1000, 650)
    .walls()
    .sliding(120, 1000, 280, 1000)
    .sliding(400, 660, 400, 740)
    .sliding(400, 500, 400, 580)
    .sliding(150, 450, 250, 450)
    .sliding(500, 250, 580, 250)
    .sliding(800, 250, 880, 250)
    .sliding(1000, 260, 1000, 340)
    .sliding(1000, 660, 1000, 740)
    .door(850, 750, 930, 750)
    .window(520, 350, 880, 350, true).window(520, 650, 880, 650, true)
    .window(500, 370, 500, 630, true).window(900, 370, 900, 630, true)
    .window(50, 0, 350, 0, true).window(0, 80, 0, 380)
    .window(450, 0, 650, 0, true).window(750, 0, 950, 0, true)
    .window(1050, 0, 1350, 0, true).window(1400, 80, 1400, 420)
    .window(1400, 580, 1400, 920).window(1050, 1000, 1350, 1000, true).window(500, 1000, 900, 1000)
    // 大浴場・脱衣所
    .item("bath", 50, 40, { w: 300, h: 180, symbol: 1 })
    .item("shower", 10, 360, { w: 70, h: 70 })
    .item("shower", 80, 360, { w: 70, h: 70 })
    .item("shower", 260, 360, { w: 70, h: 70 })
    .item("shower", 330, 360, { w: 70, h: 70 })
    .item("washbasin", 30, 590, { rot: 180 })
    .item("washbasin", 290, 590, { rot: 180 })
    .item("shelf", 20, 455, { w: 120, h: 30 })
    .item("shelf", 260, 455, { w: 120, h: 30 })
    .item("bench", 130, 520, { w: 140, h: 40 })
    // 帳場
    .item("longTable", 30, 720, { w: 200, h: 50 })
    .item("chair", 108, 668)
    .item("shoeCabinet", 5, 800, { rot: 270 })
    .item("shoeCabinet", 5, 890, { rot: 270 })
    .item("armchair", 220, 800)
    .item("armchair", 300, 800)
    .item("plantLarge", 330, 920)
    // 客室
    .item("table", 490, 90, { w: 120, h: 70 }).item("zaisu", 522, 23).item("zaisu", 522, 162, { rot: 180 }).item("tv", 610, 5, { w: 80, h: 35 })
    .item("table", 790, 90, { w: 120, h: 70 }).item("zaisu", 822, 23).item("zaisu", 822, 162, { rot: 180 }).item("tv", 910, 5, { w: 80, h: 35 })
    .item("table", 1120, 100, { w: 160, h: 90 })
    .row("zaisu", 1140, 33, 2, 80, 0)
    .row("zaisu", 1140, 192, 2, 80, 0, { rot: 180 })
    .row("futon", 1040, 270, 3, 110, 0)
    // 宴会場
    .item("longTable", 1050, 620, { w: 300, h: 60 })
    .item("longTable", 1050, 840, { w: 300, h: 60 })
    .row("zaisu", 1065, 558, 4, 70, 0)
    .row("zaisu", 1065, 677, 4, 70, 0, { rot: 180 })
    .row("zaisu", 1065, 778, 4, 70, 0)
    .row("zaisu", 1065, 897, 4, 70, 0, { rot: 180 })
    // 中庭・厨房
    .item("pond", 660, 470, { w: 160, h: 100 })
    .item("stoneLantern", 560, 400)
    .item("rock", 760, 380, { w: 100, h: 70 })
    .item("shrub", 530, 560)
    .item("kitchen", 420, 930, { rot: 180 })
    .item("kitchen", 670, 930, { rot: 180 })
    .item("fridge", 930, 925)
    .item("longTable", 560, 800, { w: 200, h: 70 });
  b.roof("hip", -40, -40, 1480, 1080, f);
}

function hotel(b: PlanBuilder): void {
  const f = b.floor();
  for (let i = 0; i < 4; i += 1) {
    const x = i * 360;
    f.room(`70${i + 1}`, x, 0, 360, 400, C.wood, "wood").label(190, 228).room("", x, 220, 180, 180, C.tile, "tile");
    f.room(`70${i + 5}`, x, 520, 360, 400, C.wood, "wood").label(200, 10).room("", x, 520, 180, 180, C.tile, "tile");
  }
  f.room("", 0, 400, 1800, 120, C.gray)
    .room("", 1440, 0, 360, 400, "#e6e2dc", "stone")
    .room("EV", 1460, 20, 150, 150, C.gray)
    .room("EV", 1630, 20, 150, 150, C.gray)
    .room("", 1440, 520, 360, 400, "#e6e2dc", "stone")
    .open(1440, 400, 1800, 400)
    .walls()
    .sliding(1490, 170, 1580, 170)
    .sliding(1660, 170, 1750, 170)
    .door(1560, 520, 1650, 520)
    .window(1800, 650, 1800, 800)
    .item("stairsU", 1500, 600, { w: 240, h: 240 })
    .item("bench", 1500, 300, { w: 150, h: 45 })
    .item("plantLarge", 1720, 320);
  for (let i = 0; i < 4; i += 1) {
    const x = i * 360;
    f.door(x + 200, 400, x + 280, 400)
      .door(x + 180, 240, x + 180, 310)
      .window(x + 60, 0, x + 300, 0, true)
      .item("unitBath", x + 5, 225, { w: 170, h: 170 })
      .item("bed", x + 20, 15).item("bed", x + 130, 15).item("sideTable", x + 240, 20)
      .item("desk", x + 305, 60, { w: 120, h: 50, rot: 90 })
      .item("chair", x + 255, 97, { rot: 270 })
      .item("armchair", x + 275, 250)
      .door(x + 200, 520, x + 280, 520)
      .door(x + 180, 610, x + 180, 680)
      .window(x + 60, 920, x + 300, 920, true)
      .item("unitBath", x + 5, 525, { w: 170, h: 170 })
      .item("bed", x + 20, 705, { rot: 180 }).item("bed", x + 130, 705, { rot: 180 })
      .item("desk", x + 305, 740, { w: 120, h: 50, rot: 90 })
      .item("chair", x + 255, 777, { rot: 270 })
      .item("armchair", x + 275, 590);
  }
  b.roof("flat", -30, -30, 1860, 980, f);
}

// ---- お店 ----

function cafe(b: PlanBuilder): void {
  const f = b.floor();
  f.area("テラス席", 0, 700, 700, 250, "wood", C.wood)
    .room("客席", 0, 0, 700, 700, C.wood, "wood")
    .room("厨房", 700, 0, 300, 450, C.tile, "tile").label(30, 300)
    .room("トイレ", 700, 450, 150, 250, C.tile, "tile").label(10, 100)
    .room("倉庫", 850, 450, 150, 250, C.warm)
    .open(700, 60, 700, 380)
    .walls()
    .door(150, 700, 270, 700)
    .door(700, 520, 700, 590, { flip: true })
    .door(880, 450, 960, 450)
    .door(1000, 300, 1000, 380)
    .window(60, 0, 640, 0, true).window(0, 80, 0, 620, true).window(380, 700, 640, 700, true)
    .item("longTable", 640, 60, { w: 320, h: 50, rot: 90 })
    .row("stool", 585, 90, 4, 0, 70)
    .item("roundTable", 80, 90, { w: 80, h: 80 }).item("chair", 30, 107, { rot: 270 }).item("chair", 165, 107, { rot: 90 })
    .item("roundTable", 320, 90, { w: 80, h: 80 }).item("chair", 270, 107, { rot: 270 }).item("chair", 405, 107, { rot: 90 })
    .item("roundTable", 80, 330, { w: 80, h: 80 }).item("chair", 30, 347, { rot: 270 }).item("chair", 165, 347, { rot: 90 })
    .item("roundTable", 320, 330, { w: 80, h: 80 }).item("chair", 270, 347, { rot: 270 }).item("chair", 405, 347, { rot: 90 })
    .item("sofa2", 400, 615, { rot: 180 })
    .item("table", 425, 545, { w: 90, h: 55 })
    .item("chair", 410, 490).item("chair", 480, 490)
    .item("plantLarge", 20, 620)
    .item("kitchen", 930, 40, { rot: 90 })
    .item("fridge", 720, 10)
    .item("cupboard", 800, 5)
    .item("longTable", 760, 200, { w: 140, h: 60 })
    .item("toilet", 790, 620, { rot: 180 })
    .item("washbasin", 770, 455, { w: 60, h: 45 })
    .item("shelf", 965, 500, { rot: 90 })
    .item("shelf", 965, 600, { rot: 90 })
    .item("parasol", 420, 735, { w: 180, h: 180 })
    .item("roundTable", 475, 790, { w: 70, h: 70 })
    .item("chair", 425, 802, { rot: 270 })
    .item("chair", 550, 802, { rot: 90 })
    .item("flowerBed", 20, 880, { w: 160, h: 50 });
}

function bar(b: PlanBuilder): void {
  const f = b.floor();
  f.room("客席", 0, 0, 600, 600, "#e9e2d6", "wood").label(20, 100)
    .room("厨房", 600, 0, 200, 300, C.tile, "tile")
    .room("トイレ", 600, 300, 200, 300, C.tile, "tile").label(90, 100)
    .walls()
    .door(60, 600, 160, 600)
    .door(600, 180, 600, 260, { flip: true })
    .door(600, 420, 600, 500, { flip: true })
    .window(0, 400, 0, 520)
    .row("shelf", 120, 5, 3, 130, 0, { w: 120, h: 30 })
    .item("fridge", 480, 50, { w: 60, h: 60 })
    .item("longTable", 100, 170, { w: 420, h: 55, color: "#6b4a2f" })
    .row("stool", 120, 240, 6, 65, 0)
    .item("sofa2", 400, 515, { rot: 180, color: "#7a2a2a" })
    .item("table", 420, 440, { w: 100, h: 55 })
    .item("armchair", 395, 355)
    .item("armchair", 485, 355)
    .item("sofa2", 200, 515, { rot: 180, color: "#7a2a2a" })
    .item("table", 220, 440, { w: 100, h: 55 })
    .item("plant", 20, 20)
    .item("kitchen", 730, 30, { rot: 90 })
    .item("toilet", 730, 520, { rot: 180 })
    .item("washbasin", 620, 310, { w: 60, h: 45 });
}

function convenience(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 800, 1200, 480, "stone", C.stone)
    .room("売り場", 0, 0, 1000, 800, "#eef1f4", "tile").label(15, 95)
    .room("事務所", 1000, 0, 200, 500, C.warm).label(20, 150)
    .room("トイレ", 1000, 500, 200, 300, C.tile, "tile").label(90, 100)
    .walls()
    .sliding(150, 800, 300, 800)
    .door(1000, 380, 1000, 460)
    .door(1000, 640, 1000, 720)
    .door(1200, 100, 1200, 180, { flip: true })
    .window(350, 800, 950, 800, true).window(0, 450, 0, 750, true)
    .row("shelf", 40, 5, 3, 310, 0, { w: 300, h: 60, color: "#cfe3f0" });
  for (let r = 0; r < 3; r += 1) {
    const y = 170 + r * 170;
    f.item("shelf", 120, y, { w: 260, h: 40 }).item("shelf", 120, y + 40, { w: 260, h: 40, rot: 180 })
      .item("shelf", 480, y, { w: 260, h: 40 }).item("shelf", 480, y + 40, { w: 260, h: 40, rot: 180 });
  }
  f.item("shelf", 950, 100, { w: 200, h: 40, rot: 90 })
    .item("longTable", 620, 650, { w: 260, h: 60 })
    .item("trashCan", 20, 820).item("trashCan", 70, 820)
    .item("shelf", 1165, 220, { rot: 90 }).item("shelf", 1165, 320, { rot: 90 })
    .item("desk", 1020, 20)
    .item("officeChair", 1050, 85, { rot: 180 })
    .item("toilet", 1130, 715, { rot: 180 })
    .item("washbasin", 1020, 520)
    .item("car", 350, 830, { w: 170, h: 430 })
    .item("car", 600, 830, { w: 170, h: 430, symbol: 1 })
    .item("car", 850, 830, { w: 170, h: 430 })
    .row("bicycle", 60, 900, 2, 80, 0);
}

// ---- 施設 ----

function hospital(b: PlanBuilder): void {
  const f = b.floor();
  f.room("診察室1", 0, 0, 400, 550, C.cool).label(60, 250)
    .room("診察室2", 400, 0, 400, 550, C.cool).label(60, 250)
    .room("処置室", 800, 0, 400, 550, C.cool).label(10, 230)
    .room("病室A", 1200, 0, 400, 550, C.mint).label(135, 80)
    .room("病室B", 1600, 0, 400, 550, C.mint).label(135, 80)
    .room("", 600, 550, 1400, 150, C.gray)
    .room("受付・待合", 0, 550, 600, 650, C.warm)
    .room("ナース室", 600, 700, 400, 500, C.cool).label(60, 160)
    .room("手術室", 1000, 700, 500, 500, "#e6f1f1", "tile")
    .room("病室C", 1500, 700, 500, 500, C.mint)
    .open(600, 550, 600, 700)
    .open(650, 700, 950, 700)
    .walls()
    .sliding(200, 1200, 360, 1200)
    .door(150, 550, 230, 550)
    .door(480, 550, 560, 550)
    .sliding(900, 550, 990, 550)
    .sliding(1300, 550, 1390, 550)
    .sliding(1700, 550, 1790, 550)
    .sliding(1200, 700, 1300, 700)
    .sliding(1600, 700, 1690, 700)
    .door(400, 400, 400, 470)
    .window(60, 0, 340, 0, true).window(460, 0, 740, 0, true).window(860, 0, 1140, 0, true)
    .window(1260, 0, 1540, 0, true).window(1660, 0, 1940, 0, true)
    .window(2000, 100, 2000, 450).window(2000, 800, 2000, 1100)
    .window(1560, 1200, 1940, 1200, true).window(0, 650, 0, 1100, true);
  // 診察室
  for (const x of [0, 400]) {
    f.item("desk", x + 30, 30)
      .item("officeChair", x + 60, 95, { rot: 180 })
      .item("chair", x + 160, 110, { rot: 270 })
      .item("bed", x + 300, 30, { w: 80, h: 190 })
      .item("washbasin", x + 300, 490, { rot: 180 });
  }
  f.row("shelf", 5, 250, 2, 0, 100, { rot: 270 })
    .row("shelf", 765, 250, 2, 0, 100, { rot: 90 })
    // 処置室
    .item("bed", 830, 30, { w: 80, h: 190 }).item("bed", 950, 30, { w: 80, h: 190 })
    .item("longTable", 1040, 30, { w: 140, h: 50 })
    .item("shelf", 1165, 250, { rot: 90 })
    .item("washbasin", 805, 380, { rot: 270 })
    .item("chair", 1000, 300);
  // 病室（4人部屋）
  for (const x of [1200, 1600]) {
    f.item("bed", x + 30, 20, { w: 90, h: 200 }).item("bed", x + 280, 20, { w: 90, h: 200 })
      .item("bed", x + 5, 300, { w: 90, h: 190, rot: 270 }).item("bed", x + 205, 300, { w: 90, h: 190, rot: 90 })
      .item("sideTable", x + 130, 30, { w: 40, h: 40 }).item("sideTable", x + 230, 30, { w: 40, h: 40 })
      .item("washbasin", x + 300, 490, { rot: 180 });
  }
  f.item("bed", 1530, 990, { w: 90, h: 200, rot: 180 }).item("bed", 1880, 990, { w: 90, h: 200, rot: 180 })
    .item("bed", 1505, 800, { w: 90, h: 190, rot: 270 }).item("bed", 1805, 800, { w: 90, h: 190, rot: 90 })
    .item("sideTable", 1630, 1140, { w: 40, h: 40 }).item("sideTable", 1830, 1140, { w: 40, h: 40 })
    // ナース室
    .item("longTable", 650, 720, { w: 300, h: 50 })
    .row("officeChair", 670, 780, 3, 100, 0, { rot: 180 })
    .item("desk", 640, 1100).item("desk", 800, 1100)
    .row("shelf", 605, 900, 2, 0, 100, { rot: 270 })
    .item("fridge", 920, 900)
    .item("longTable", 700, 920, { w: 160, h: 70 })
    // 手術室
    .item("bed", 1215, 850, { w: 70, h: 190, color: "#9fc7c7" })
    .item("floorLamp", 1160, 830).item("floorLamp", 1300, 830)
    .item("longTable", 1040, 1000, { w: 120, h: 50 }).item("longTable", 1340, 1000, { w: 120, h: 50 })
    .item("washbasin", 1040, 1140, { rot: 180 }).item("washbasin", 1130, 1140, { rot: 180 })
    .item("shelf", 1465, 760, { rot: 90 })
    // 受付・待合
    .item("longTable", 320, 600, { w: 260, h: 60 })
    .row("bench", 80, 760, 3, 0, 100, { w: 150, h: 50, rot: 180 })
    .row("bench", 260, 760, 3, 0, 100, { w: 150, h: 50, rot: 180 })
    .item("plantLarge", 520, 1120)
    .item("trashCan", 20, 1140);
  b.roof("flat", -30, -30, 2060, 1260, f);
}

function school(b: PlanBuilder): void {
  const f = b.floor();
  ["1-1", "1-2", "1-3"].forEach((name, i) => f.room(name, i * 800, 0, 800, 600, C.wood, "wood"));
  f.room("", 0, 600, 2400, 150, C.wood, "wood")
    .room("職員室", 0, 750, 800, 450, C.cool).label(20, 280)
    .room("保健室", 800, 750, 400, 450, C.mint).label(180, 30)
    .room("トイレ", 1200, 750, 300, 450, C.tile, "tile").label(90, 200)
    .room("", 1500, 750, 300, 450, C.gray)
    .room("昇降口", 1800, 750, 600, 450, C.stone, "stone")
    .open(1500, 750, 1800, 750)
    .open(1850, 750, 2350, 750)
    .walls();
  for (let i = 0; i < 3; i += 1) {
    const ox = i * 800;
    f.sliding(ox + 40, 600, ox + 120, 600)
      .sliding(ox + 680, 600, ox + 760, 600)
      .window(ox + 60, 0, ox + 740, 0, true)
      .item("shelf", ox + 3, 120, { w: 360, h: 12, rot: 270, color: "#2f5d46" })
      .item("desk", ox + 60, 250, { w: 100, h: 55, rot: 270 });
    for (let c = 0; c < 6; c += 1) {
      for (let r = 0; r < 5; r += 1) {
        const x = ox + 200 + c * 95, y = 60 + r * 100;
        f.item("desk", x, y, { w: 60, h: 45, rot: 270 }).item("chair", x + 50, y + 10, { w: 40, h: 40, rot: 90 });
      }
    }
  }
  f.sliding(100, 750, 180, 750).sliding(600, 750, 680, 750)
    .sliding(1000, 750, 1080, 750)
    .door(1300, 750, 1370, 750)
    .sliding(1900, 1200, 2050, 1200).sliding(2150, 1200, 2300, 1200)
    .window(60, 1200, 740, 1200, true).window(860, 1200, 1140, 1200)
    .window(0, 620, 0, 730).window(2400, 620, 2400, 730);
  // 職員室: 向かい合わせの机の島を2つ
  for (const x of [150, 450]) {
    f.item("desk", x, 830, { w: 110, h: 60 }).item("desk", x + 110, 830, { w: 110, h: 60 })
      .item("desk", x, 890, { w: 110, h: 60, rot: 180 }).item("desk", x + 110, 890, { w: 110, h: 60, rot: 180 })
      .item("officeChair", x + 25, 768).item("officeChair", x + 135, 768)
      .item("officeChair", x + 25, 955, { rot: 180 }).item("officeChair", x + 135, 955, { rot: 180 });
  }
  f.row("shelf", 40, 1165, 5, 100, 0, { rot: 180 })
    .item("longTable", 600, 1060, { w: 160, h: 70 })
    // 保健室
    .item("bed", 1080, 1000, { w: 90, h: 190, rot: 180 }).item("bed", 970, 1000, { w: 90, h: 190, rot: 180 })
    .item("desk", 830, 790).item("chair", 868, 855, { rot: 180 })
    .item("washbasin", 805, 950, { rot: 270 })
    .item("shelf", 1165, 800, { rot: 90 })
    // トイレ・階段・昇降口
    .row("toilet", 1220, 1120, 4, 70, 0, { rot: 180 })
    .row("washbasin", 1205, 800, 2, 0, 80, { rot: 270 })
    .item("stairsU", 1530, 900, { w: 240, h: 240 })
    .row("shoeCabinet", 1850, 850, 2, 250, 0, { w: 200, h: 40 })
    .row("shoeCabinet", 1850, 980, 2, 250, 0, { w: 200, h: 40 })
    .item("plantLarge", 2320, 1120);
  b.roof("flat", -30, -30, 2460, 1260, f);
}

function office(b: PlanBuilder): void {
  const f = b.floor();
  f.room("執務室", 0, 0, 1100, 700, C.gray)
    .room("会議室", 1100, 0, 500, 450, C.cool)
    .room("社長室", 1100, 450, 500, 550, C.wood, "wood")
    .room("受付", 0, 700, 500, 300, C.warm)
    .room("給湯室", 500, 700, 250, 300, C.tile, "tile")
    .room("トイレ", 750, 700, 350, 300, C.tile, "tile")
    .walls()
    .door(180, 1000, 320, 1000)
    .door(380, 700, 470, 700)
    .door(580, 700, 660, 700)
    .door(850, 700, 930, 700)
    .door(1100, 300, 1100, 390)
    .door(1100, 520, 1100, 610)
    .window(60, 0, 1040, 0, true).window(1160, 0, 1540, 0, true)
    .window(1600, 60, 1600, 400, true).window(1600, 520, 1600, 940, true).window(0, 60, 0, 640, true);
  // 執務室: 6人の机の島を4つ
  for (const [X, Y] of [[60, 120], [500, 120], [60, 450], [500, 450]]) {
    for (let i = 0; i < 3; i += 1) {
      f.item("desk", X + i * 120, Y, { w: 120, h: 70 }).item("desk", X + i * 120, Y + 70, { w: 120, h: 70, rot: 180 })
        .item("officeChair", X + i * 120 + 30, Y - 62).item("officeChair", X + i * 120 + 30, Y + 142, { rot: 180 });
    }
  }
  f.item("shelf", 1065, 60, { rot: 90 }).item("shelf", 1065, 160, { rot: 90 })
    .item("plantLarge", 1030, 630)
    // 会議室
    .item("longTable", 1200, 175, { w: 300, h: 100 })
    .row("officeChair", 1215, 112, 3, 90, 0)
    .row("officeChair", 1215, 278, 3, 90, 0, { rot: 180 })
    .item("officeChair", 1135, 195, { rot: 270 }).item("officeChair", 1505, 195, { rot: 90 })
    .item("tv", 1555, 145, { w: 160, h: 40, rot: 90, symbol: 1 })
    // 社長室
    .item("desk", 1330, 830, { w: 160, h: 80, symbol: 2 })
    .item("officeChair", 1380, 915, { rot: 180, symbol: 1 })
    .item("sofa2", 1270, 500)
    .item("table", 1290, 600, { w: 100, h: 55 })
    .item("sofa2", 1270, 670, { rot: 180 })
    .item("shelf", 1565, 480, { rot: 90 }).item("shelf", 1565, 580, { rot: 90 })
    .item("plantLarge", 1530, 930)
    // 受付・給湯室・トイレ
    .item("longTable", 150, 720, { w: 200, h: 60 })
    .item("sofa2", 5, 760, { rot: 270 })
    .item("plantLarge", 430, 930)
    .item("kitchen", 510, 935, { w: 230, h: 60, rot: 180 })
    .item("fridge", 680, 720)
    .row("toilet", 960, 920, 2, 80, 0, { rot: 180 })
    .row("washbasin", 755, 760, 2, 0, 80, { rot: 270 });
  b.roof("flat", -30, -30, 1660, 1060, f);
}

function library(b: PlanBuilder): void {
  const f = b.floor();
  f.room("閲覧室", 0, 0, 1600, 800, "#f1e6d2", "wood")
    .room("受付", 0, 800, 600, 400, C.warm)
    .room("書庫", 600, 800, 500, 400, C.gray)
    .room("事務室", 1100, 800, 500, 400, C.cool)
    .open(100, 800, 500, 800)
    .walls()
    .sliding(200, 1200, 360, 1200)
    .door(700, 800, 780, 800, { flip: true })
    .door(1200, 800, 1280, 800, { flip: true })
    .window(60, 0, 500, 0, true).window(600, 0, 1000, 0, true).window(1100, 0, 1540, 0, true)
    .window(1600, 60, 1600, 740, true);
  for (const y of [80, 230, 380, 530]) f.item("shelf", 60, y, { w: 420, h: 40 }).item("shelf", 60, y + 40, { w: 420, h: 40, rot: 180 });
  for (const [X, Y] of [[700, 120], [1050, 120], [700, 400], [1050, 400]]) {
    f.item("longTable", X, Y, { w: 240, h: 90 })
      .row("chair", X + 25, Y - 50, 3, 80, 0)
      .row("chair", X + 25, Y + 95, 3, 80, 0, { rot: 180 });
  }
  f.item("armchair", 1400, 640).item("armchair", 1490, 640).item("plantLarge", 1320, 720)
    .item("longTable", 150, 960, { w: 300, h: 60 })
    .item("officeChair", 200, 895).item("officeChair", 330, 895)
    .item("shelf", 30, 1150, { w: 120, h: 35, rot: 180 })
    .item("plantLarge", 530, 1130)
    .row("shelf", 680, 860, 4, 0, 80, { w: 380, h: 35 })
    .row("desk", 1150, 1100, 3, 150, 0, { rot: 180 })
    .row("officeChair", 1180, 1035, 3, 150, 0)
    .item("shelf", 1565, 850, { rot: 90 });
  b.roof("flat", -30, -30, 1660, 1260, f);
}

function church(b: PlanBuilder): void {
  const f = b.floor();
  f.room("聖具室", 0, 0, 500, 400, C.warm).label(170, 10)
    .room("司祭室", 500, 0, 500, 400, C.wood, "wood")
    .room("礼拝堂", 0, 400, 1000, 1400, "#d6d0c4", "stone")
    .walls()
    .door(420, 1800, 580, 1800)
    .door(100, 400, 180, 400)
    .door(820, 400, 900, 400)
    .window(0, 600, 0, 800).window(0, 950, 0, 1150).window(0, 1300, 0, 1500)
    .window(1000, 600, 1000, 800).window(1000, 950, 1000, 1150).window(1000, 1300, 1000, 1500)
    .window(100, 0, 400, 0).window(600, 0, 900, 0)
    .window(100, 1800, 300, 1800).window(700, 1800, 900, 1800)
    .item("rug", 420, 620, { w: 160, h: 1000, color: "#9b1c1c" })
    .item("longTable", 390, 450, { w: 220, h: 70 })
    .item("plantLarge", 300, 440).item("plantLarge", 640, 440)
    .item("piano", 60, 520)
    .row("bench", 60, 700, 8, 0, 110, { w: 320, h: 50, rot: 180 })
    .row("bench", 620, 700, 8, 0, 110, { w: 320, h: 50, rot: 180 })
    .item("wardrobe", 30, 10)
    .item("longTable", 250, 200, { w: 160, h: 60 })
    .item("desk", 560, 300)
    .item("chair", 598, 245)
    .item("shelf", 965, 60, { rot: 90 }).item("shelf", 965, 160, { rot: 90 })
    .item("armchair", 850, 200);
  b.roof("gable", -40, 360, 1080, 1480, f);
  b.roof("flat", -40, -40, 1080, 440, f);
}

function shrine(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 1600, 2100, "grass", C.grass)
    .area("", 450, 750, 700, 150, "stone", C.stone)
    .area("", 680, 900, 240, 1200, "stone", C.stone)
    .area("手水舎", 250, 1190, 220, 220, "stone", C.stone)
    .room("本殿", 650, 100, 300, 260, C.wood, "wood")
    .room("", 760, 360, 80, 90, C.wood, "wood")
    .room("拝殿", 500, 450, 600, 300, C.wood, "wood")
    .room("社務所", 1150, 1250, 400, 350, C.wood, "wood").label(20, 110)
    .walls()
    .sliding(700, 750, 900, 750)
    .sliding(760, 360, 840, 360)
    .sliding(760, 450, 840, 450)
    .sliding(1150, 1400, 1150, 1480)
    .window(1200, 1600, 1500, 1600)
    .window(500, 520, 500, 680).window(1100, 520, 1100, 680)
    .item("shoeCabinet", 740, 690, { w: 120, h: 50, color: "#7a4a2a" })
    .item("rug", 620, 500, { w: 360, h: 160, color: "#c9b27c" })
    .row("stoneLantern", 600, 950, 3, 0, 350)
    .row("stoneLantern", 940, 950, 3, 0, 350)
    .item("tree", 40, 40, { w: 280, h: 280 })
    .item("tree", 1280, 40, { w: 280, h: 280 })
    .item("tree", 60, 1700, { w: 280, h: 280 })
    .item("conifer", 1300, 500)
    .item("conifer", 150, 600)
    .item("conifer", 1250, 1750)
    .item("washbasin", 320, 1300, { w: 100, h: 60, color: "#9a9c98" })
    .item("rock", 330, 1500)
    .item("bench", 1200, 1700, { w: 150, h: 50 })
    .item("longTable", 1200, 1290, { w: 200, h: 50 })
    .item("desk", 1380, 1500)
    .row("shrub", 100, 1000, 3, 0, 150)
    .item("shrub", 1380, 1000);
  b.roof("gable", 620, 70, 360, 320, f);
  b.roof("hip", 470, 420, 660, 360, f);
  b.roof("gable", 1120, 1220, 460, 410, f);
}

function police(b: PlanBuilder): void {
  const f = b.floor();
  f.room("刑事課", 0, 0, 800, 600, C.gray)
    .room("署長室", 800, 0, 400, 600, C.wood, "wood")
    .room("会議室", 1200, 0, 400, 600, C.cool)
    .room("受付", 0, 600, 500, 500, C.warm)
    .room("", 500, 600, 1100, 150, C.gray)
    .room("取調室1", 500, 750, 300, 350, C.gray)
    .room("取調室2", 800, 750, 300, 350, C.gray)
    .room("留置室1", 1100, 750, 250, 350, C.darkStone, "stone")
    .room("留置室2", 1350, 750, 250, 350, C.darkStone, "stone")
    .open(500, 600, 500, 750)
    .walls()
    .sliding(150, 1100, 310, 1100)
    .door(200, 600, 280, 600)
    .door(600, 600, 680, 600)
    .door(950, 600, 1030, 600)
    .door(1300, 600, 1380, 600)
    .door(600, 750, 680, 750, { flip: true })
    .door(900, 750, 980, 750, { flip: true })
    .door(1120, 750, 1190, 750, { flip: true }).window(1200, 750, 1340, 750, true)
    .door(1370, 750, 1440, 750, { flip: true }).window(1450, 750, 1590, 750, true)
    .window(60, 0, 740, 0, true).window(860, 0, 1140, 0).window(1260, 0, 1540, 0)
    .window(0, 700, 0, 1000);
  for (const X of [80, 420]) {
    f.item("desk", X, 150, { w: 120, h: 70 }).item("desk", X + 120, 150, { w: 120, h: 70 })
      .item("desk", X, 220, { w: 120, h: 70, rot: 180 }).item("desk", X + 120, 220, { w: 120, h: 70, rot: 180 })
      .item("officeChair", X + 30, 88).item("officeChair", X + 150, 88)
      .item("officeChair", X + 30, 292, { rot: 180 }).item("officeChair", X + 150, 292, { rot: 180 });
  }
  f.item("shelf", 785, 200, { w: 200, h: 12, rot: 90, color: "#ffffff" })
    .item("shelf", 330, 565, { rot: 180 }).item("shelf", 430, 565, { rot: 180 })
    .item("coatStand", 20, 540)
    .item("desk", 920, 80, { w: 160, h: 80, symbol: 2 })
    .item("officeChair", 970, 15, { symbol: 1 })
    .item("sofa2", 930, 300)
    .item("table", 950, 385, { w: 100, h: 50 })
    .item("sofa2", 930, 440, { rot: 180 })
    .item("plant", 1140, 20)
    .item("longTable", 1270, 250, { w: 260, h: 90 })
    .row("chair", 1290, 195, 3, 80, 0)
    .row("chair", 1290, 345, 3, 80, 0, { rot: 180 })
    .item("shelf", 1585, 200, { w: 200, h: 12, rot: 90, color: "#ffffff" })
    .item("longTable", 220, 680, { w: 260, h: 60 })
    .row("bench", 60, 850, 2, 0, 100, { w: 150, h: 45, rot: 180 })
    .item("plantLarge", 430, 1030)
    .item("trashCan", 20, 1050);
  for (const X of [500, 800]) {
    f.item("desk", X + 100, 900, { w: 100, h: 70 })
      .item("chair", X + 128, 850).item("chair", X + 128, 975, { rot: 180 })
      .item("floorLamp", X + 20, 1040).item("chair", X + 240, 1040);
  }
  f.item("bed", 1250, 900, { w: 80, h: 190, rot: 180 }).item("toilet", 1120, 1020, { rot: 180 })
    .item("bed", 1500, 900, { w: 80, h: 190, rot: 180 }).item("toilet", 1370, 1020, { rot: 180 });
  b.roof("flat", -30, -30, 1660, 1160, f);
}

function lab(b: PlanBuilder): void {
  const f = b.floor();
  f.room("実験室A", 0, 0, 700, 600, C.tile, "tile")
    .room("実験室B", 700, 0, 500, 600, C.tile, "tile").label(20, 120)
    .room("所長室", 1200, 0, 400, 450, C.wood, "wood")
    .room("資料室", 1200, 450, 400, 550, C.gray)
    .room("", 0, 600, 1200, 120, C.gray)
    .room("休憩室", 0, 720, 500, 280, C.wood, "wood").label(90, 15)
    .room("更衣室", 500, 720, 300, 280, C.warm)
    .room("サーバー室", 800, 720, 400, 280, C.cool)
    .walls()
    .door(0, 610, 0, 710)
    .door(100, 600, 190, 600)
    .door(560, 600, 650, 600)
    .door(900, 600, 990, 600)
    .door(1200, 300, 1200, 380)
    .door(1200, 620, 1200, 700)
    .door(200, 720, 280, 720, { flip: true })
    .door(600, 720, 680, 720, { flip: true })
    .door(1000, 720, 1080, 720, { flip: true })
    .window(60, 0, 640, 0, true).window(760, 0, 1140, 0, true).window(1260, 0, 1540, 0)
    .window(1600, 60, 1600, 400).window(1600, 520, 1600, 940).window(60, 1000, 440, 1000)
    .item("longTable", 80, 150, { w: 300, h: 90 }).item("longTable", 80, 350, { w: 300, h: 90 })
    .row("stool", 110, 105, 3, 100, 0).row("stool", 110, 245, 3, 100, 0)
    .row("stool", 110, 305, 3, 100, 0).row("stool", 110, 445, 3, 100, 0)
    .row("washbasin", 450, 5, 2, 90, 0)
    .row("shelf", 5, 100, 3, 0, 100, { rot: 270 })
    .item("fridge", 450, 510)
    .item("longTable", 420, 200, { w: 220, h: 70 })
    .item("aquarium", 760, 40, { w: 160, h: 60 })
    .item("longTable", 800, 250, { w: 300, h: 80 })
    .row("stool", 830, 205, 3, 100, 0)
    .item("shelf", 1165, 60, { rot: 90 }).item("shelf", 1165, 160, { rot: 90 })
    .item("washbasin", 1080, 540, { rot: 180 })
    .item("desk", 1350, 80, { w: 140, h: 70 })
    .item("officeChair", 1390, 15)
    .item("sofa2", 1300, 360, { rot: 180 })
    .item("table", 1320, 290, { w: 100, h: 50 })
    .row("shelf", 1260, 520, 4, 0, 100, { w: 300, h: 35 })
    .item("kitchen", 5, 760, { w: 200, h: 60, rot: 270 })
    .item("fridge", 80, 930)
    .item("diningTable", 300, 790, { w: 140, h: 140 })
    .item("wardrobe", 520, 950, { rot: 180 }).item("wardrobe", 660, 950, { rot: 180 })
    .item("bench", 560, 830, { w: 180, h: 40 })
    .row("shelf", 850, 800, 2, 0, 100, { w: 300, h: 50, color: "#5a6470" })
    .item("airConditioner", 1110, 725);
  b.roof("flat", -30, -30, 1660, 1060, f);
}

function museum(b: PlanBuilder): void {
  const f = b.floor();
  f.room("展示室1", 0, 0, 600, 800, "#ece4d6", "wood")
    .room("展示室2", 600, 0, 600, 800, "#ece4d6", "wood")
    .room("展示室3", 1200, 0, 600, 800, "#ece4d6", "wood")
    .room("ショップ", 0, 800, 600, 400, C.warm)
    .room("エントランス", 600, 800, 600, 400, "#e6e2dc", "stone")
    .room("事務室", 1200, 800, 600, 400, C.cool)
    .open(600, 300, 600, 500).open(1200, 300, 1200, 500).open(750, 800, 1050, 800).open(600, 900, 600, 1100)
    .walls()
    .sliding(800, 1200, 1000, 1200)
    .door(1200, 1050, 1200, 1130)
    .window(100, 1200, 500, 1200, true).window(1300, 1200, 1700, 1200)
    .row("table", 60, 70, 2, 240, 0, { w: 160, h: 60, symbol: 1 })
    .row("sideTable", 150, 300, 2, 250, 0, { w: 60, h: 60 })
    .row("sideTable", 150, 550, 2, 250, 0, { w: 60, h: 60 })
    .item("bench", 220, 420, { w: 160, h: 45 })
    .item("rug", 750, 300, { w: 300, h: 200, color: "#7d2e2e" })
    .item("bench", 820, 380, { w: 160, h: 45 })
    .row("table", 660, 70, 2, 240, 0, { w: 160, h: 60, symbol: 1 })
    .item("sideTable", 640, 680, { w: 60, h: 60 }).item("sideTable", 1100, 680, { w: 60, h: 60 })
    .item("piano", 1400, 300, { w: 180, h: 70 })
    .row("table", 1260, 70, 2, 240, 0, { w: 160, h: 60, symbol: 1 })
    .row("sideTable", 1300, 600, 3, 150, 0, { w: 60, h: 60 })
    .item("plantLarge", 1720, 720)
    .row("shelf", 60, 900, 2, 240, 0, { w: 200, h: 40 })
    .row("shelf", 60, 1000, 2, 240, 0, { w: 200, h: 40 })
    .item("longTable", 380, 1120, { w: 180, h: 50 })
    .item("longTable", 1000, 1000, { w: 160, h: 60 })
    .item("bench", 650, 1100, { w: 150, h: 45 })
    .item("plantLarge", 1130, 1130)
    .row("desk", 1260, 860, 2, 200, 0)
    .row("officeChair", 1290, 925, 2, 200, 0, { rot: 180 })
    .item("shelf", 1765, 900, { rot: 90 });
  b.roof("flat", -30, -30, 1860, 1260, f);
}

function bathhouse(b: PlanBuilder): void {
  const f = b.floor();
  f.room("男湯", 0, 0, 600, 500, C.tile, "tile")
    .room("女湯", 600, 0, 600, 500, C.tile, "tile")
    .room("脱衣所", 0, 500, 400, 500, C.wood, "wood")
    .room("脱衣所", 800, 500, 400, 500, C.wood, "wood")
    .room("休憩所", 400, 500, 400, 200, C.wood, "wood")
    .room("番台", 400, 700, 400, 300, C.wood, "wood")
    .open(450, 700, 750, 700)
    .walls()
    .sliding(520, 1000, 680, 1000)
    .sliding(400, 780, 400, 860)
    .sliding(800, 780, 800, 860)
    .sliding(150, 500, 270, 500)
    .sliding(930, 500, 1050, 500)
    .window(60, 0, 540, 0, true).window(660, 0, 1140, 0, true)
    .item("bath", 110, 30, { w: 380, h: 160, symbol: 1 })
    .row("shower", 5, 230, 3, 0, 80, { w: 70, h: 70, rot: 270 })
    .row("shower", 330, 420, 3, 80, 0, { w: 70, h: 70, rot: 180 })
    .item("bath", 710, 30, { w: 380, h: 160, symbol: 1 })
    .row("shower", 1125, 230, 3, 0, 80, { w: 70, h: 70, rot: 90 })
    .row("shower", 640, 420, 3, 80, 0, { w: 70, h: 70, rot: 180 })
    .row("shelf", 5, 560, 4, 0, 100, { rot: 270 })
    .row("washbasin", 150, 940, 2, 90, 0, { rot: 180 })
    .item("bench", 150, 700, { w: 160, h: 45 })
    .row("shelf", 1165, 560, 4, 0, 100, { rot: 90 })
    .row("washbasin", 880, 940, 2, 90, 0, { rot: 180 })
    .item("bench", 890, 700, { w: 160, h: 45 })
    .item("sofa2", 440, 560)
    .item("tv", 640, 510, { w: 100, h: 35 })
    .item("armchair", 680, 600)
    .item("longTable", 520, 760, { w: 160, h: 60 })
    .item("shoeCabinet", 410, 950, { w: 100, h: 40, rot: 180 })
    .item("shoeCabinet", 690, 950, { w: 100, h: 40, rot: 180 })
    .item("fridge", 720, 720);
  b.roof("gable", -40, -40, 1280, 1080, f);
}

// ---- 屋外・そのほか ----

function park(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 2000, 1400, "grass", C.grass)
    .area("", 0, 600, 2000, 150, "stone", C.stone)
    .area("", 900, 0, 150, 1400, "stone", C.stone)
    .area("遊び場", 100, 100, 700, 420, "plain", C.sand).label(20, 330)
    .area("広場", 1150, 850, 750, 450, "stone", C.stone).label(20, 110)
    .room("トイレ", 120, 880, 300, 260, C.tile, "tile").label(10, 200)
    .walls()
    .door(220, 1140, 300, 1140, { flip: true })
    .row("swing", 150, 150, 2, 250, 0)
    .item("bench", 600, 420, { w: 150, h: 50 })
    .item("pond", 1250, 150, { w: 500, h: 300 })
    .item("rock", 1220, 470)
    .item("tree", 1720, 120, { w: 260, h: 260 })
    .item("tree", 500, 900, { w: 280, h: 280 })
    .item("conifer", 1500, 1150, { w: 140, h: 140 })
    .row("flowerBed", 700, 540, 2, 400, 0)
    .item("flowerBed", 700, 760)
    .row("gardenLight", 860, 560, 2, 200, 0)
    .row("gardenLight", 860, 760, 2, 200, 0)
    .row("bench", 1200, 900, 2, 300, 0, { w: 150, h: 50 })
    .item("bench", 1200, 1220, { w: 150, h: 50, rot: 180 })
    .item("trashCan", 1820, 870)
    .row("bicycle", 30, 1250, 2, 200, 0, { rot: 90 })
    .item("toilet", 160, 920)
    .item("toilet", 240, 920)
    .item("washbasin", 330, 920, { w: 60, h: 45 })
    .row("shrub", 1100, 40, 2, 0, 200, { rot: 90 });
}

function factory(b: PlanBuilder): void {
  const f = b.floor();
  f.room("作業場", 0, 0, 1400, 1200, "#a9aca9", "stone")
    .room("事務所", 1400, 0, 600, 500, "#e8e6e1")
    .room("倉庫", 1400, 500, 600, 700, "#a9aca9", "stone")
    .walls()
    .sliding(300, 1200, 800, 1200)
    .door(1400, 380, 1400, 460)
    .sliding(1400, 700, 1400, 900)
    .door(0, 900, 0, 980)
    .window(100, 0, 400, 0, true).window(550, 0, 850, 0, true).window(1000, 0, 1300, 0, true)
    .window(1500, 0, 1900, 0, true).window(2000, 100, 2000, 400)
    .item("longTable", 100, 150, { w: 300, h: 90 }).item("longTable", 500, 150, { w: 300, h: 90 })
    .item("shelf", 950, 100, { w: 300, h: 50 }).item("shelf", 950, 250, { w: 300, h: 50 })
    .item("shed", 100, 500, { w: 200, h: 100 }).item("shed", 100, 650, { w: 200, h: 100 }).item("shed", 1100, 450, { w: 200, h: 100 })
    .item("trashCan", 700, 600).item("trashCan", 750, 600).item("trashCan", 700, 650).item("trashCan", 760, 660)
    .item("car", 1000, 650, { w: 200, h: 480, symbol: 1 })
    .item("brokenGlass", 200, 30).item("brokenGlass", 650, 40).item("brokenGlass", 1100, 30)
    .item("rock", 500, 900, { w: 80, h: 60 }).item("rock", 300, 950, { w: 60, h: 45, symbol: 1 })
    .item("officeChair", 450, 280)
    .item("desk", 1450, 300).item("desk", 1650, 300)
    .item("officeChair", 1480, 365, { rot: 180 })
    .item("sofa", 1700, 40)
    .item("shelf", 1965, 410, { rot: 90 })
    .row("shelf", 1500, 600, 4, 0, 150, { w: 400, h: 50 });
  b.roof("gable", -40, -40, 2080, 1280, f);
}

function dungeon(b: PlanBuilder): void {
  const f = b.floor();
  const stone = C.darkStone;
  f.room("入口", 800, 1100, 400, 300, stone, "stone").label(90, 130)
    .room("", 950, 700, 100, 400, stone, "stone")
    .room("", 100, 600, 1700, 100, stone, "stone")
    .room("大広間", 650, 0, 700, 600, stone, "stone").label(110, 25)
    .room("牢屋", 0, 0, 200, 300, stone, "stone").label(10, 235)
    .room("牢屋", 200, 0, 200, 300, stone, "stone").label(10, 235)
    .room("牢屋", 400, 0, 200, 300, stone, "stone").label(10, 235)
    .room("牢番の間", 0, 300, 600, 300, stone, "stone")
    .room("武器庫", 0, 700, 500, 400, stone, "stone").label(50, 15)
    .room("宝物庫", 1400, 0, 500, 600, stone, "stone").label(20, 110)
    .room("書庫", 1400, 700, 500, 400, stone, "stone")
    .open(950, 700, 1050, 700).open(950, 1100, 1050, 1100)
    .walls()
    .door(950, 600, 1050, 600)
    .door(250, 600, 330, 600)
    .door(300, 700, 380, 700, { flip: true })
    .door(1550, 600, 1630, 600)
    .door(1550, 700, 1630, 700, { flip: true })
    .window(20, 300, 140, 300, true).door(145, 300, 195, 300)
    .window(220, 300, 340, 300, true).door(345, 300, 395, 300)
    .window(420, 300, 540, 300, true).door(545, 300, 595, 300)
    .item("stairs", 1050, 1110)
    .item("stoneLantern", 820, 1120).item("stoneLantern", 820, 1320)
    .item("rug", 940, 100, { w: 120, h: 480, color: "#7a1e1e" })
    .item("longTable", 850, 250, { w: 300, h: 90 })
    .item("armchair", 960, 30, { color: "#7a5a2a" })
    .item("stoneLantern", 670, 20).item("stoneLantern", 1270, 20).item("stoneLantern", 670, 500).item("stoneLantern", 1270, 500)
    .row("futon", 20, 20, 3, 200, 0, { w: 80, h: 180, color: "#b9a77d" })
    .row("trashCan", 140, 230, 3, 200, 0)
    .item("desk", 250, 450)
    .item("chair", 288, 395)
    .item("stoneLantern", 20, 520)
    .row("shelf", 5, 750, 3, 0, 100, { rot: 270 })
    .item("longTable", 150, 900, { w: 250, h: 80 })
    .item("wardrobe", 360, 1050, { rot: 180 })
    .row("shoeCabinet", 1450, 30, 4, 100, 0, { w: 70, h: 45, color: "#8a5a2b" })
    .item("rug", 1500, 200, { w: 300, h: 200, color: "#c9a227" })
    .item("stoneLantern", 1420, 520)
    .row("shelf", 1470, 800, 3, 0, 100, { w: 360, h: 35 })
    .item("rock", 500, 620, { w: 60, h: 45 })
    .item("rock", 1250, 640, { w: 60, h: 45, symbol: 1 });
}

const BUILDERS: Record<string, (b: PlanBuilder) => void> = {
  japaneseHouse, apartment, westernMansion, lodge, ryokan, hotel,
  cafe, bar, convenience,
  hospital, school, office, library, church, shrine, police, lab, museum, bathhouse,
  park, factory, dungeon,
};

// 地下の階がある雛形（下から数えた地下の階の数）
const BASEMENTS: Record<string, number> = { westernMansion: 1 };

export function hasTemplatePlan(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(BUILDERS, key);
}

// 雛形の間取りのデータ。newId で要素の id を作り、sizes（家具の種類ごとの標準の大きさ）で家具の大きさを決める
export function templatePlan(key: string, newId: (prefix: TemplateIdPrefix) => string, sizes: Record<string, { w: number; h: number }>): TemplatePlan | null {
  const build = BUILDERS[key];
  if (!build) return null;
  const b = planBuilder(newId, sizes);
  build(b);
  return b.plan(BASEMENTS[key] ?? 0);
}
