// 雛形（間取りの見本）。家・病院・洋館など50種類のうち、ここで作る物（住まいの4種類と作例は main.ts）。
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
      { key: "threeStory", label: "三階建て", title: "1階に車庫と水回り、2階にLDK、3階に寝室。狭い土地の三階建て" },
      { key: "mansion", label: "マンション", title: "3LDKのマンションの1戸。玄関からの廊下とバルコニー" },
      { key: "apartment", label: "アパート", title: "1Kが3部屋ずつの二階建て。外廊下と外階段" },
      { key: "shareHouse", label: "シェアハウス", title: "共用のLDKと水回り、個室5つの二階建て" },
      { key: "japaneseHouse", label: "平屋の日本家屋", title: "茶の間・座敷・土間・縁側と庭のある和風の家" },
      { key: "oldFarmhouse", label: "古民家", title: "土間・囲炉裏の間・座敷と縁側、庭と蔵" },
      { key: "sample", label: "サンプル（作例）", title: "いろいろな家具や床を置いた作例" },
    ],
  },
  {
    label: "屋敷・宿",
    templates: [
      { key: "westernMansion", label: "洋館", title: "大広間・食堂・書斎のある二階建てと地下室" },
      { key: "samuraiHouse", label: "武家屋敷", title: "広間・書院・茶室と、池のある庭" },
      { key: "lodge", label: "山荘・ペンション", title: "暖炉のラウンジと客室4つ。森とテラス" },
      { key: "ryokan", label: "旅館", title: "客室・宴会場・大浴場と中庭。2階にも客室と談話室" },
      { key: "hotel", label: "ホテル", title: "1階にロビーとレストラン、2・3階に客室" },
      { key: "dormitory", label: "寮", title: "個室が並ぶ二階建て。食堂・大浴場・洗濯室" },
    ],
  },
  {
    label: "お店",
    templates: [
      { key: "cafe", label: "カフェ", title: "カウンターと客席、テラス席" },
      { key: "restaurant", label: "レストラン", title: "テーブル席・個室・厨房とワインセラー" },
      { key: "ramen", label: "ラーメン屋", title: "L字のカウンターと厨房、テーブル席" },
      { key: "izakaya", label: "居酒屋", title: "カウンター・座敷・個室と厨房" },
      { key: "bar", label: "バー", title: "カウンターとボックス席" },
      { key: "salon", label: "美容院", title: "鏡の前の席・シャンプー台・待合" },
      { key: "bookstore", label: "本屋", title: "本棚の列・平台・レジとカフェ" },
      { key: "convenience", label: "コンビニ", title: "売り場・レジ・事務所と駐車場" },
    ],
  },
  {
    label: "施設",
    templates: [
      { key: "hospital", label: "病院", title: "1階に待合・診察室・手術室、2階に病棟" },
      { key: "school", label: "学校", title: "3階建て。教室・職員室・保健室・理科室・音楽室・図書室" },
      { key: "nursery", label: "保育園", title: "保育室・お昼寝の部屋・給食室と園庭" },
      { key: "library", label: "図書館", title: "本棚と閲覧席・書庫、2階に学習室と郷土資料室" },
      { key: "gymnasium", label: "体育館", title: "広いアリーナ・ステージ・更衣室・器具庫" },
      { key: "office", label: "オフィス", title: "執務室・会議室・社長室" },
      { key: "lab", label: "研究所", title: "実験室・資料室・サーバー室" },
      { key: "police", label: "警察署", title: "刑事課・取調室・留置場、2階に道場と会議室" },
      { key: "policeBox", label: "交番", title: "小さな交番。机と奥の休憩室" },
      { key: "museum", label: "美術館", title: "展示室5つ・ショップ・2階にカフェと収蔵庫" },
      { key: "cinema", label: "映画館", title: "スクリーンと客席・ロビー・映写室" },
      { key: "church", label: "教会", title: "長椅子の並ぶ礼拝堂" },
      { key: "shrine", label: "神社", title: "本殿・拝殿・社務所と参道" },
      { key: "temple", label: "寺", title: "本堂・庫裏・鐘楼と墓地" },
      { key: "bathhouse", label: "銭湯", title: "男湯・女湯と番台" },
      { key: "factory", label: "廃工場", title: "作業場・倉庫・事務所" },
    ],
  },
  {
    label: "屋外・乗り物",
    templates: [
      { key: "park", label: "公園", title: "遊び場・池・広場" },
      { key: "campsite", label: "キャンプ場", title: "テント・タープ・焚き火・バンガローと川" },
      { key: "cruiseShip", label: "客船", title: "客室・レストラン・プールデッキ・操舵室" },
      { key: "sleeperTrain", label: "寝台列車", title: "個室の寝台車と食堂車の2両" },
    ],
  },
  {
    label: "ファンタジー・SF",
    templates: [
      { key: "castle", label: "城", title: "玉座の間・大広間・塔・兵舎と城門、2階に王の寝室と礼拝室" },
      { key: "adventurersInn", label: "冒険者の宿", title: "酒場・暖炉・依頼の掲示板と2階の客室" },
      { key: "wizardTower", label: "魔法使いの塔", title: "らせん階段でつながる書庫・研究室・寝室" },
      { key: "dungeon", label: "地下牢", title: "牢屋・大広間・武器庫・宝物庫のダンジョン" },
      { key: "spaceship", label: "宇宙船", title: "操縦室・居室・食堂・医務室・機関室" },
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
    .room("", 400, 750, 200, 250, C.wood, "wood")
    .room("厨房", 600, 750, 400, 250, C.tile, "tile")
    .open(400, 350, 500, 350).open(900, 350, 1000, 350).open(400, 650, 500, 650).open(900, 650, 1000, 650)
    .open(410, 750, 590, 750)
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
    .window(1400, 580, 1400, 920).window(1050, 1000, 1350, 1000, true).window(650, 1000, 950, 1000)
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
    .item("kitchen", 620, 935, { rot: 180 })
    .item("fridge", 920, 925)
    .item("longTable", 660, 800, { w: 200, h: 70 })
    .item("stairsU", 410, 760);

  // 2階: 中庭の上は吹き抜け。まわりの廊下と客室、階段の上に談話室
  const upper = b.floor();
  upper.room("桜", 0, 0, 400, 450, C.tatami)
    .room("楓", 0, 450, 400, 210, C.tatami)
    .room("萩", 0, 660, 400, 340, C.tatami)
    .room("菊", 400, 0, 300, 250, C.tatami)
    .room("椿", 700, 0, 300, 250, C.tatami)
    .room("", 400, 250, 600, 100, C.wood, "wood")
    .room("", 400, 350, 100, 300, C.wood, "wood")
    .room("", 900, 350, 100, 300, C.wood, "wood")
    .room("", 400, 650, 600, 100, C.wood, "wood")
    .room("藤", 1000, 0, 400, 500, C.tatami)
    .room("月", 1000, 500, 400, 500, C.tatami)
    .room("", 400, 750, 200, 250, C.wood, "wood")
    .room("談話室", 600, 750, 400, 250, C.wood, "wood")
    .open(400, 350, 500, 350).open(900, 350, 1000, 350).open(400, 650, 500, 650).open(900, 650, 1000, 650)
    .open(410, 750, 590, 750)
    .walls()
    .sliding(400, 260, 400, 340)
    .sliding(400, 500, 400, 580)
    .sliding(400, 665, 400, 745)
    .sliding(500, 250, 580, 250)
    .sliding(800, 250, 880, 250)
    .sliding(1000, 260, 1000, 340)
    .sliding(1000, 660, 1000, 740)
    .door(850, 750, 930, 750)
    .window(520, 350, 880, 350, true).window(520, 650, 880, 650, true)
    .window(500, 370, 500, 630, true).window(900, 370, 900, 630, true)
    .window(50, 0, 350, 0, true).window(0, 80, 0, 380).window(0, 500, 0, 620).window(0, 720, 0, 940)
    .window(450, 0, 650, 0, true).window(750, 0, 950, 0, true)
    .window(1050, 0, 1350, 0, true).window(1400, 80, 1400, 420)
    .window(1400, 580, 1400, 920).window(1050, 1000, 1350, 1000, true).window(650, 1000, 950, 1000, true)
    .item("stairsU", 410, 760)
    // 桜・楓・萩
    .item("table", 220, 80, { w: 120, h: 70 }).item("zaisu", 252, 13).item("zaisu", 252, 155, { rot: 180 })
    .item("futon", 40, 230).item("futon", 150, 230)
    .item("table", 150, 520, { w: 120, h: 70 }).item("zaisu", 182, 455).item("zaisu", 182, 595, { rot: 180 })
    .item("table", 150, 760, { w: 120, h: 70 }).item("zaisu", 182, 695).item("zaisu", 182, 835, { rot: 180 })
    .item("wardrobe", 30, 955, { rot: 180 })
    // 菊・椿
    .item("table", 490, 90, { w: 120, h: 70 }).item("zaisu", 522, 23).item("zaisu", 522, 162, { rot: 180 }).item("tv", 610, 5, { w: 80, h: 35 })
    .item("table", 790, 90, { w: 120, h: 70 }).item("zaisu", 822, 23).item("zaisu", 822, 162, { rot: 180 }).item("tv", 910, 5, { w: 80, h: 35 })
    // 藤・月
    .item("table", 1120, 100, { w: 160, h: 90 }).row("zaisu", 1140, 33, 2, 80, 0).row("zaisu", 1140, 192, 2, 80, 0, { rot: 180 })
    .row("futon", 1040, 270, 3, 110, 0)
    .item("table", 1120, 600, { w: 160, h: 90 }).row("zaisu", 1140, 533, 2, 80, 0).row("zaisu", 1140, 692, 2, 80, 0, { rot: 180 })
    .row("futon", 1040, 770, 3, 110, 0)
    // 談話室
    .item("sofa", 700, 830).item("table", 725, 920, { w: 120, h: 60 }).item("armchair", 900, 830);
  b.roof("hip", -40, -40, 1480, 1080, upper);
}

function hotel(b: PlanBuilder): void {
  // 1階: ロビー（フロント・ソファ）、レストラン・厨房・事務所・トイレ。エレベーターと階段は上の階と同じ所
  const ground = b.floor();
  ground.room("ロビー", 0, 0, 1440, 400, "#e6e2dc", "stone")
    .room("", 1440, 0, 360, 400, "#e6e2dc", "stone")
    .room("EV", 1460, 20, 150, 150, C.gray)
    .room("EV", 1630, 20, 150, 150, C.gray)
    .room("", 0, 400, 1800, 120, C.gray)
    .room("レストラン", 0, 520, 720, 400, C.wood, "wood")
    .room("厨房", 720, 520, 360, 400, C.tile, "tile")
    .room("事務所", 1080, 520, 180, 400, C.cool).label(10, 120)
    .room("トイレ", 1260, 520, 180, 400, C.tile, "tile").label(10, 120)
    .room("", 1440, 520, 360, 400, "#e6e2dc", "stone")
    .open(1440, 0, 1440, 400)
    .open(1440, 400, 1800, 400)
    .open(60, 400, 1380, 400)
    .walls()
    .sliding(600, 0, 840, 0)
    .sliding(1490, 170, 1580, 170)
    .sliding(1660, 170, 1750, 170)
    .door(300, 520, 380, 520)
    .door(720, 780, 720, 860)
    .door(1120, 520, 1200, 520)
    .door(1300, 520, 1380, 520)
    .door(1560, 520, 1650, 520)
    .window(60, 0, 540, 0, true).window(900, 0, 1380, 0, true)
    .window(60, 920, 660, 920, true).window(0, 560, 0, 880).window(1800, 650, 1800, 800)
    // ロビー
    .item("longTable", 1080, 120, { w: 300, h: 60 })
    .item("officeChair", 1130, 55).item("officeChair", 1250, 55)
    .item("shelf", 1100, 0, { w: 260, h: 30 })
    .item("sofa", 200, 60).item("table", 225, 160, { w: 120, h: 60 }).item("sofa", 200, 240, { rot: 180 })
    .item("plantLarge", 520, 20).item("plantLarge", 900, 20).item("plantLarge", 20, 320)
    .item("bench", 1500, 300, { w: 150, h: 45 })
    .item("plantLarge", 1720, 320)
    // レストラン・厨房・事務所・トイレ
    .item("diningTable", 60, 600).item("diningTable", 290, 600).item("diningTable", 520, 600)
    .item("kitchen", 750, 855, { rot: 180 })
    .item("fridge", 1005, 855)
    .item("longTable", 800, 680, { w: 160, h: 60 })
    .item("desk", 1110, 860, { rot: 180 })
    .item("officeChair", 1140, 795)
    .item("toilet", 1290, 845, { rot: 180 }).item("toilet", 1370, 845, { rot: 180 })
    .item("stairsU", 1500, 600, { w: 240, h: 240 });

  // 2・3階: 廊下の両側に客室（ツイン）が並ぶ
  for (const level of [2, 3]) {
    const f = b.floor();
    for (let i = 0; i < 4; i += 1) {
      const x = i * 360;
      f.room(`${level}0${i + 1}`, x, 0, 360, 400, C.wood, "wood").label(190, 228).room("", x, 220, 180, 180, C.tile, "tile");
      f.room(`${level}0${i + 5}`, x, 520, 360, 400, C.wood, "wood").label(200, 10).room("", x, 520, 180, 180, C.tile, "tile");
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
    if (level === 3) b.roof("flat", -30, -30, 1860, 980, f);
  }
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
    .item("trashCan", 20, 1140)
    .item("stairs", 470, 760);

  // 2階: 病棟（4人部屋が7つ）、ナース室、デイルーム
  const upper = b.floor();
  ["201", "202", "203", "204", "205"].forEach((name, i) => upper.room(name, i * 400, 0, 400, 550, C.mint).label(135, 80));
  upper.room("", 0, 550, 2000, 150, C.gray)
    .room("デイルーム", 0, 700, 400, 500, C.wood, "wood")
    .room("", 400, 700, 200, 500, C.gray)
    .room("ナース室", 600, 700, 400, 500, C.cool).label(60, 160)
    .room("206", 1000, 700, 500, 500, C.mint)
    .room("207", 1500, 700, 500, 500, C.mint)
    .open(410, 700, 590, 700)
    .open(650, 700, 950, 700)
    .walls()
    .sliding(100, 700, 300, 700)
    .sliding(1100, 700, 1190, 700)
    .sliding(1600, 700, 1690, 700)
    .window(2000, 100, 2000, 450).window(2000, 800, 2000, 1100).window(0, 750, 0, 1150, true)
    .window(1060, 1200, 1440, 1200, true).window(1560, 1200, 1940, 1200, true)
    .item("stairs", 470, 760)
    // デイルーム
    .item("diningTable", 40, 820)
    .item("sofa2", 180, 1100, { rot: 180 })
    .item("tv", 360, 1000, { rot: 90 })
    .item("plantLarge", 20, 1120)
    // ナース室
    .item("longTable", 650, 720, { w: 300, h: 50 })
    .row("officeChair", 670, 780, 3, 100, 0, { rot: 180 })
    .item("desk", 640, 1100).item("desk", 800, 1100)
    .row("shelf", 605, 900, 2, 0, 100, { rot: 270 })
    .item("fridge", 920, 900);
  for (let i = 0; i < 5; i += 1) {
    const x = i * 400;
    upper.sliding(x + 100, 550, x + 190, 550)
      .window(x + 60, 0, x + 340, 0, true)
      .item("bed", x + 30, 20, { w: 90, h: 200 }).item("bed", x + 280, 20, { w: 90, h: 200 })
      .item("bed", x + 5, 300, { w: 90, h: 190, rot: 270 }).item("bed", x + 205, 300, { w: 90, h: 190, rot: 90 })
      .item("sideTable", x + 130, 30, { w: 40, h: 40 }).item("sideTable", x + 230, 30, { w: 40, h: 40 })
      .item("washbasin", x + 300, 490, { rot: 180 });
  }
  for (const x of [1000, 1500]) {
    upper.item("bed", x + 30, 990, { w: 90, h: 200, rot: 180 }).item("bed", x + 380, 990, { w: 90, h: 200, rot: 180 })
      .item("bed", x + 5, 800, { w: 90, h: 190, rot: 270 }).item("bed", x + 305, 800, { w: 90, h: 190, rot: 90 })
      .item("sideTable", x + 130, 1140, { w: 40, h: 40 }).item("sideTable", x + 330, 1140, { w: 40, h: 40 });
  }
  b.roof("flat", -30, -30, 2060, 1260, upper);
}

// 学校の1つの階の教室3つ（name1〜3）と、その下の廊下
function classrooms(f: FloorBuilder, names: string[]): void {
  names.forEach((name, i) => f.room(name, i * 800, 0, 800, 600, C.wood, "wood"));
  f.room("", 0, 600, 2400, 150, C.wood, "wood");
}

function classroomFurniture(f: FloorBuilder): void {
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
}

function school(b: PlanBuilder): void {
  const f = b.floor();
  classrooms(f, ["1-1", "1-2", "1-3"]);
  f.room("職員室", 0, 750, 800, 450, C.cool).label(20, 280)
    .room("保健室", 800, 750, 400, 450, C.mint).label(180, 30)
    .room("トイレ", 1200, 750, 300, 450, C.tile, "tile").label(90, 200)
    .room("", 1500, 750, 300, 450, C.gray)
    .room("昇降口", 1800, 750, 600, 450, C.stone, "stone")
    .open(1500, 750, 1800, 750)
    .open(1850, 750, 2350, 750)
    .walls();
  classroomFurniture(f);
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

  // 2階と3階: 教室3つと、特別教室・トイレ・階段
  const floors = [
    { names: ["2-1", "2-2", "2-3"], left: "理科室", middle: "準備室", right: "音楽室" },
    { names: ["3-1", "3-2", "3-3"], left: "図書室", middle: "美術室", right: "多目的室" },
  ];
  let top = f;
  floors.forEach(({ names, left, middle, right }, level) => {
    const u = b.floor();
    top = u;
    classrooms(u, names);
    u.room(left, 0, 750, 800, 450, C.wood, "wood")
      .room(middle, 800, 750, 400, 450, C.cool)
      .room("トイレ", 1200, 750, 300, 450, C.tile, "tile").label(90, 200)
      .room("", 1500, 750, 300, 450, C.gray)
      .room(right, 1800, 750, 600, 450, C.wood, "wood")
      .open(1500, 750, 1800, 750)
      .walls();
    classroomFurniture(u);
    u.sliding(100, 750, 180, 750).sliding(600, 750, 680, 750)
      .sliding(1000, 750, 1080, 750)
      .door(1300, 750, 1370, 750)
      .sliding(1900, 750, 1980, 750)
      .window(60, 1200, 740, 1200, true).window(860, 1200, 1140, 1200).window(1860, 1200, 2340, 1200, true)
      .window(0, 620, 0, 730).window(2400, 620, 2400, 730).window(2400, 800, 2400, 1150)
      .row("toilet", 1220, 1120, 4, 70, 0, { rot: 180 })
      .row("washbasin", 1205, 800, 2, 0, 80, { rot: 270 })
      .item("stairsU", 1530, 900, { w: 240, h: 240 })
      .row("shelf", 830, 1165, 3, 100, 0, { rot: 180 })
      .item("desk", 1050, 950);
    if (level === 0) {
      // 理科室: 流し付きの実験台、音楽室: ピアノと椅子の列
      for (const [x, y] of [[100, 880], [450, 880], [100, 1060], [450, 1060]]) {
        u.item("longTable", x, y, { w: 220, h: 80 })
          .item("washbasin", x + 85, y + 12, { w: 50, h: 45 })
          .row("stool", x + 20, y - 45, 3, 70, 0);
      }
      u.item("piano", 2200, 790)
        .row("chair", 1880, 950, 8, 60, 0)
        .row("chair", 1880, 1060, 8, 60, 0);
    } else {
      // 図書室: 本棚と閲覧机、美術室: 大きな作業台と丸椅子、多目的室: 長机
      u.item("longTable", 850, 850, { w: 180, h: 80 })
        .row("stool", 860, 940, 3, 60, 0)
        .row("shelf", 40, 1160, 4, 180, 0, { w: 170, h: 35, rot: 180 })
        .item("longTable", 150, 950, { w: 240, h: 90 }).row("chair", 175, 900, 3, 80, 0).row("chair", 175, 1045, 3, 80, 0, { rot: 180 })
        .item("longTable", 480, 950, { w: 240, h: 90 }).row("chair", 505, 900, 3, 80, 0).row("chair", 505, 1045, 3, 80, 0, { rot: 180 })
        .row("longTable", 1880, 850, 3, 0, 110, { w: 300, h: 60 })
        .row("chair", 2200, 850, 3, 0, 110, { rot: 90 });
    }
  });
  b.roof("flat", -30, -30, 2460, 1260, top);
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
    .item("shelf", 1565, 850, { rot: 90 })
    .item("stairs", 1470, 60);
  // 2階の下にならない受付・書庫・事務室の屋根
  b.roof("flat", -30, 770, 1660, 460, f);

  // 2階: 学習室・郷土資料室と廊下。階段は閲覧室の奥から
  const upper = b.floor();
  upper.room("学習室", 0, 0, 800, 650, "#f1e6d2", "wood")
    .room("郷土資料室", 800, 0, 550, 650, C.warm)
    .room("", 1350, 0, 250, 650, "#f1e6d2", "wood")
    .room("", 0, 650, 1600, 150, "#f1e6d2", "wood")
    .open(1350, 650, 1600, 650)
    .walls()
    .door(300, 650, 380, 650)
    .door(1000, 650, 1080, 650)
    .window(60, 0, 740, 0, true).window(0, 100, 0, 550).window(860, 0, 1290, 0).window(1600, 60, 1600, 600)
    .item("stairs", 1470, 60)
    .row("desk", 60, 120, 5, 140, 0)
    .row("officeChair", 90, 185, 5, 140, 0, { rot: 180 })
    .row("desk", 60, 360, 5, 140, 0)
    .row("officeChair", 90, 425, 5, 140, 0, { rot: 180 })
    .row("shelf", 850, 100, 3, 0, 150, { w: 400, h: 40 })
    .item("longTable", 900, 530, { w: 200, h: 70 })
    .item("bench", 500, 720, { w: 150, h: 45 })
    .item("plantLarge", 20, 680);
  b.roof("flat", -30, -30, 1660, 860, upper);
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
    .item("trashCan", 20, 1050)
    .item("stairs", 380, 760);
  for (const X of [500, 800]) {
    f.item("desk", X + 100, 900, { w: 100, h: 70 })
      .item("chair", X + 128, 850).item("chair", X + 128, 975, { rot: 180 })
      .item("floorLamp", X + 20, 1040).item("chair", X + 240, 1040);
  }
  f.item("bed", 1250, 900, { w: 80, h: 190, rot: 180 }).item("toilet", 1120, 1020, { rot: 180 })
    .item("bed", 1500, 900, { w: 80, h: 190, rot: 180 }).item("toilet", 1370, 1020, { rot: 180 });

  // 2階: 道場・会議室と、更衣室・休憩室・仮眠室
  const upper = b.floor();
  upper.room("道場", 0, 0, 800, 600, C.tatami)
    .room("会議室", 800, 0, 800, 600, C.cool)
    .room("更衣室", 0, 600, 300, 500, C.gray)
    .room("", 300, 600, 200, 500, C.gray)
    .room("", 500, 600, 1100, 150, C.gray)
    .room("休憩室", 500, 750, 500, 350, C.tatami)
    .room("仮眠室", 1000, 750, 600, 350, C.wood, "wood")
    .open(500, 600, 500, 750)
    .walls()
    .door(350, 600, 450, 600)
    .door(600, 600, 680, 600)
    .door(300, 650, 300, 730)
    .door(1000, 600, 1080, 600)
    .door(650, 750, 730, 750)
    .door(1100, 750, 1180, 750)
    .window(60, 0, 740, 0, true).window(0, 100, 0, 500).window(860, 0, 1540, 0, true).window(1600, 420, 1600, 560)
    .window(560, 1100, 940, 1100).window(1100, 1100, 1500, 1100)
    .item("stairs", 380, 760)
    .item("shelf", 340, 0, { w: 120, h: 30, color: "#8a6a4a" })
    .item("longTable", 1000, 240, { w: 400, h: 120 })
    .row("chair", 1020, 185, 5, 80, 0)
    .row("chair", 1020, 365, 5, 80, 0, { rot: 180 })
    .item("shelf", 1585, 200, { w: 200, h: 12, rot: 90, color: "#ffffff" })
    .item("closet", 0, 700, { rot: 270 })
    .item("closet", 0, 870, { rot: 270 })
    .item("bench", 150, 750, { rot: 90 })
    .item("table", 650, 900, { w: 160, h: 80 })
    .row("zaisu", 670, 835, 2, 80, 0)
    .row("zaisu", 670, 985, 2, 80, 0, { rot: 180 })
    .item("fridge", 920, 1030)
    .row("bunkBed", 1050, 860, 3, 150, 0);
  b.roof("flat", -30, -30, 1660, 1160, upper);
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
    .item("shelf", 1765, 900, { rot: 90 })
    .item("stairs", 880, 870, { rot: 90 });

  // 2階: 展示室4・5と、カフェ・収蔵庫
  const upper = b.floor();
  upper.room("展示室4", 0, 0, 900, 800, "#ece4d6", "wood")
    .room("展示室5", 900, 0, 900, 800, "#ece4d6", "wood")
    .room("カフェ", 0, 800, 600, 400, C.warm)
    .room("", 600, 800, 600, 400, "#e6e2dc", "stone")
    .room("収蔵庫", 1200, 800, 600, 400, C.gray)
    .open(900, 300, 900, 500).open(650, 800, 880, 800).open(920, 800, 1150, 800).open(600, 900, 600, 1100)
    .walls()
    .door(1200, 1050, 1200, 1130)
    .window(100, 0, 800, 0, true).window(1000, 0, 1700, 0, true).window(100, 1200, 500, 1200, true).window(0, 850, 0, 1150)
    .item("stairs", 880, 870, { rot: 90 })
    .row("table", 100, 70, 3, 260, 0, { w: 160, h: 60, symbol: 1 })
    .row("sideTable", 150, 350, 3, 250, 0, { w: 60, h: 60 })
    .row("sideTable", 150, 600, 3, 250, 0, { w: 60, h: 60 })
    .item("bench", 350, 460, { w: 160, h: 45 })
    .row("table", 960, 70, 3, 260, 0, { w: 160, h: 60, symbol: 1 })
    .item("rug", 1150, 250, { w: 400, h: 300, color: "#7d2e2e" })
    .item("rock", 1275, 340, { w: 150, h: 120 })
    .item("bench", 1050, 650, { w: 160, h: 45 }).item("bench", 1450, 650, { w: 160, h: 45 })
    .item("diningTable", 60, 880).item("diningTable", 320, 880)
    .item("longTable", 380, 1130, { w: 200, h: 50 })
    .row("shelf", 1260, 900, 3, 0, 100, { w: 480, h: 40 });
  b.roof("flat", -30, -30, 1860, 1260, upper);
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

// ---- 住まい（つづき） ----

function threeStory(b: PlanBuilder): void {
  const ground = b.floor();
  ground.room("車庫", 0, 0, 300, 520, C.stone, "stone")
    .room("玄関", 300, 0, 200, 200, C.stone, "stone").label(20, 140)
    .room("", 300, 200, 200, 560, C.wood, "wood")
    .room("洗面", 0, 520, 300, 180, C.tile, "tile")
    .room("浴室", 0, 700, 300, 300, C.tile, "tile")
    .room("トイレ", 300, 760, 200, 240, C.tile, "tile").label(20, 100)
    .open(300, 200, 500, 200)
    .walls()
    .sliding(20, 0, 280, 0)
    .door(360, 0, 440, 0)
    .door(300, 615, 300, 690)
    .door(180, 700, 260, 700)
    .door(330, 760, 410, 760)
    .window(0, 560, 0, 660).window(0, 780, 0, 920).window(500, 850, 500, 950)
    .item("car", 60, 40)
    .item("bicycle", 240, 320)
    .item("shoeCabinet", 465, 60, { rot: 90 })
    .item("stairs", 390, 380)
    .item("washbasin", 110, 520)
    .item("washer", 200, 520)
    .item("bath", 130, 920)
    .item("shower", 20, 760)
    .item("toilet", 380, 925, { rot: 180 });

  const middle = b.floor();
  middle.room("LDK", 0, 0, 500, 760, C.wood, "wood")
    .room("納戸", 0, 760, 300, 240, C.warm)
    .room("トイレ", 300, 760, 200, 240, C.tile, "tile").label(20, 100)
    .walls()
    .door(100, 760, 180, 760)
    .door(320, 760, 390, 760)
    .window(60, 0, 440, 0, true).window(0, 300, 0, 420).window(500, 260, 500, 360)
    .item("stairs", 390, 380)
    .item("sofa", 10, 100, { rot: 270 })
    .item("table", 130, 135, { rot: 90 })
    .item("tv", 460, 125, { rot: 90 })
    .item("kitchen", 0, 450, { rot: 270 })
    .item("fridge", 0, 690)
    .item("diningTable", 110, 480)
    .row("shelf", 20, 965, 3, 95, 0, { rot: 180 })
    .item("toilet", 420, 925, { rot: 180 });

  const top = b.floor();
  top.room("寝室", 0, 0, 500, 380, C.wood, "wood")
    .room("洋室", 0, 380, 300, 380, C.wood, "wood")
    .room("", 300, 380, 200, 380, C.wood, "wood")
    .room("納戸", 0, 760, 500, 240, C.warm)
    .walls()
    .door(310, 380, 380, 380)
    .door(300, 600, 300, 680)
    .door(320, 760, 400, 760)
    .window(60, 0, 440, 0, true).window(0, 450, 0, 700).window(500, 100, 500, 300)
    .item("stairs", 390, 380)
    .item("bedDouble", 180, 20)
    .item("sideTable", 120, 30)
    .item("sideTable", 330, 30)
    .item("wardrobe", 30, 335, { rot: 180 })
    .item("bed", 20, 540)
    .item("desk", 160, 390)
    .item("officeChair", 190, 455, { rot: 180 })
    .row("shelf", 30, 965, 4, 110, 0, { rot: 180 });
  b.roof("gable", -40, -40, 580, 1080, top);
}

function mansion(b: PlanBuilder): void {
  const f = b.floor();
  f.area("バルコニー", 0, 1100, 800, 150, "plain", C.gray)
    .room("洋室1", 0, 0, 300, 350, C.wood, "wood")
    .room("玄関", 300, 0, 150, 170, C.stone, "stone").label(60, 120)
    .room("", 300, 170, 150, 430, C.wood, "wood")
    .room("洋室2", 450, 0, 350, 350, C.wood, "wood")
    .room("浴室", 0, 350, 160, 250, C.tile, "tile")
    .room("洗面", 160, 350, 140, 250, C.tile, "tile")
    .room("トイレ", 450, 350, 120, 250, C.tile, "tile")
    .room("納戸", 570, 350, 230, 250, C.warm)
    .room("LDK", 0, 600, 520, 500, C.wood, "wood").label(20, 80)
    .room("洋室3", 520, 600, 280, 500, C.wood, "wood")
    .open(300, 170, 450, 170)
    .walls()
    .door(340, 0, 420, 0)
    .door(300, 200, 300, 280)
    .door(450, 200, 450, 280)
    .door(300, 400, 300, 480)
    .door(160, 420, 160, 500)
    .door(450, 380, 450, 450)
    .door(620, 350, 700, 350)
    .door(340, 600, 420, 600)
    .sliding(520, 700, 520, 860)
    .window(60, 0, 240, 0).window(500, 0, 760, 0).window(800, 100, 800, 280)
    .window(60, 1100, 460, 1100, true).window(570, 1100, 760, 1100, true)
    // 洋室1・洋室2
    .item("bed", 10, 140)
    .item("desk", 170, 10)
    .item("officeChair", 200, 75, { rot: 180 })
    .item("wardrobe", 150, 305, { rot: 180 })
    .item("desk", 560, 10)
    .item("officeChair", 590, 75, { rot: 180 })
    .item("bedSemiDouble", 660, 130)
    .item("wardrobe", 540, 305, { rot: 180 })
    // 玄関・水回り・納戸
    .item("shoeCabinet", 300, 60, { rot: 270 })
    .item("bath", 0, 520)
    .item("shower", 35, 410)
    .item("washbasin", 190, 545, { rot: 180 })
    .item("washer", 215, 420)
    .item("toilet", 495, 500, { rot: 90 })
    .row("shelf", 590, 565, 2, 100, 0, { rot: 180 })
    // LDK
    .item("kitchen", 20, 600)
    .item("fridge", 265, 600)
    .item("diningTable", 60, 740)
    .item("rug", 275, 860, { w: 240, h: 200 })
    .item("sofa", 290, 870, { rot: 270 })
    .item("table", 395, 905, { rot: 90 })
    .item("tv", 480, 895, { rot: 90 })
    .item("plantLarge", 20, 1030)
    // 洋室3・バルコニー
    .item("closet", 600, 600)
    .item("bed", 685, 880)
    .item("desk", 540, 1035, { rot: 180 })
    .item("officeChair", 570, 970)
    .item("clothesDryer", 480, 1145)
    .item("plantLarge", 20, 1180);
}

function shareHouse(b: PlanBuilder): void {
  const ground = b.floor();
  ground.room("LDK", 0, 0, 550, 600, C.wood, "wood")
    .room("玄関", 550, 0, 200, 200, C.stone, "stone").label(60, 140)
    .room("", 550, 200, 200, 700, C.wood, "wood")
    .room("トイレ", 750, 0, 250, 150, C.tile, "tile")
    .room("洗面", 750, 150, 250, 250, C.tile, "tile")
    .room("浴室", 750, 400, 250, 250, C.tile, "tile")
    .room("納戸", 750, 650, 250, 250, C.warm)
    .room("個室1", 0, 600, 550, 300, C.wood, "wood")
    .open(550, 200, 750, 200)
    .walls()
    .door(600, 0, 690, 0)
    .door(750, 40, 750, 120)
    .door(750, 260, 750, 340)
    .door(800, 400, 880, 400)
    .door(750, 700, 750, 780)
    .door(550, 300, 550, 380)
    .door(550, 700, 550, 780)
    .window(80, 0, 480, 0, true).window(0, 150, 0, 450, true)
    .window(0, 650, 0, 850).window(100, 900, 450, 900)
    .window(1000, 460, 1000, 590)
    // LDK
    .item("fridge", 220, 0)
    .item("kitchen", 290, 0)
    .item("longTable", 60, 200)
    .row("chair", 75, 150, 3, 60, 0)
    .row("chair", 75, 265, 3, 60, 0, { rot: 180 })
    .item("sofa", 290, 330)
    .item("table", 325, 440)
    .item("tv", 315, 560, { rot: 180 })
    // 個室1
    .item("bed", 10, 650, { rot: 270 })
    .item("wardrobe", 250, 605)
    .item("desk", 300, 840, { rot: 180 })
    .item("officeChair", 330, 775)
    // 玄関・廊下・水回り
    .item("shoeCabinet", 550, 60, { rot: 270 })
    .item("stairs", 600, 580)
    .item("toilet", 925, 50, { rot: 90 })
    .item("washbasin", 945, 170, { rot: 90 })
    .item("washer", 930, 300)
    .item("bath", 920, 460, { rot: 90 })
    .item("shower", 770, 540)
    .row("shelf", 780, 870, 2, 100, 0, { rot: 180 });

  const upper = b.floor();
  upper.room("個室2", 0, 0, 550, 450, C.wood, "wood")
    .room("個室3", 0, 450, 550, 450, C.wood, "wood")
    .room("", 550, 0, 200, 900, C.wood, "wood")
    .room("個室4", 750, 0, 250, 450, C.wood, "wood")
    .room("個室5", 750, 450, 250, 300, C.wood, "wood")
    .room("トイレ", 750, 750, 250, 150, C.tile, "tile")
    .walls()
    .door(550, 200, 550, 280).door(550, 700, 550, 780)
    .door(750, 200, 750, 280).door(750, 500, 750, 580).door(750, 790, 750, 860)
    .window(100, 0, 450, 0).window(0, 100, 0, 350).window(0, 550, 0, 800).window(100, 900, 450, 900)
    .window(800, 0, 950, 0).window(1000, 100, 1000, 350).window(1000, 500, 1000, 700).window(600, 0, 700, 0)
    .item("stairs", 600, 580)
    .item("bed", 20, 220).item("desk", 400, 10).item("officeChair", 430, 75, { rot: 180 }).item("wardrobe", 150, 405, { rot: 180 })
    .item("bed", 20, 680).item("desk", 400, 460).item("officeChair", 430, 525, { rot: 180 })
    .item("desk", 870, 10).item("officeChair", 900, 75, { rot: 180 }).item("bed", 880, 220)
    .item("bed", 885, 520).item("sideTable", 800, 690)
    .item("toilet", 925, 800, { rot: 90 });
  b.roof("gable", -40, -40, 1080, 980, upper);
}

function oldFarmhouse(b: PlanBuilder): void {
  const f = b.floor();
  f.area("庭", 0, 540, 1900, 560, "grass", C.grass)
    .room("土間", 0, 0, 400, 540, C.stone, "stone")
    .room("囲炉裏の間", 400, 0, 400, 450, C.wood, "wood")
    .room("座敷", 800, 0, 450, 450, C.tatami)
    .room("奥座敷", 1250, 0, 450, 450, C.tatami)
    .room("縁側", 400, 450, 1500, 90, C.wood, "wood")
    .room("風呂", 1700, 0, 200, 250, C.tile, "tile")
    .room("便所", 1700, 250, 200, 200, C.tile, "tile")
    .room("蔵", 1450, 650, 350, 300, C.darkStone, "stone").label(20, 120)
    .open(400, 60, 400, 400)
    .walls()
    .sliding(80, 540, 280, 540)
    .sliding(400, 470, 400, 520)
    .sliding(800, 100, 800, 350)
    .sliding(1250, 100, 1250, 350)
    .sliding(450, 450, 750, 450)
    .sliding(850, 450, 1200, 450)
    .sliding(1300, 450, 1650, 450)
    .door(1740, 450, 1820, 450)
    .door(1740, 250, 1820, 250)
    .door(1580, 950, 1670, 950)
    .window(0, 100, 0, 300)
    .window(450, 0, 750, 0, true).window(880, 0, 1170, 0).window(1330, 0, 1620, 0)
    .window(450, 540, 1000, 540, true).window(1100, 540, 1650, 540, true)
    .window(1900, 60, 1900, 190)
    // 土間（かまど・作業台）
    .item("kitchen", 0, 120, { rot: 270 })
    .item("cupboard", 200, 5)
    .item("longTable", 120, 380, { color: "#8a6a4a" })
    .item("bicycle", 320, 280)
    // 囲炉裏の間・座敷・奥座敷
    .item("kotatsu", 510, 160, { color: "#5a4a3a" })
    .item("zaisu", 572, 90)
    .item("zaisu", 572, 345, { rot: 180 })
    .item("zaisu", 440, 222, { rot: 270 })
    .item("zaisu", 695, 222, { rot: 90 })
    .item("table", 925, 180, { w: 200, h: 90 })
    .row("zaisu", 955, 110, 2, 90, 0)
    .row("zaisu", 955, 275, 2, 90, 0, { rot: 180 })
    .item("futon", 1300, 120)
    .item("futon", 1430, 120)
    .item("wardrobe", 1560, 5)
    // 風呂・便所
    .item("bath", 1720, 160)
    .item("toilet", 1840, 260)
    // 庭と蔵
    .item("tree", 60, 700)
    .item("pond", 450, 760)
    .item("stoneLantern", 820, 680)
    .item("rock", 1180, 620)
    .item("shrub", 1050, 990)
    .row("shelf", 1480, 655, 3, 100, 0)
    .item("wardrobe", 1755, 760, { rot: 90 });
  b.roof("hip", -40, -40, 1980, 620, f);
  b.roof("gable", 1420, 620, 410, 360, f);
}

// ---- 屋敷・宿（つづき） ----

function samuraiHouse(b: PlanBuilder): void {
  const f = b.floor();
  f.area("庭", 0, 590, 1700, 610, "grass", C.grass)
    .room("台所", 0, 0, 300, 300, C.wood, "wood").label(80, 110)
    .room("玄関", 0, 300, 300, 290, C.stone, "stone")
    .room("広間", 300, 0, 600, 500, C.tatami)
    .room("書院", 900, 0, 450, 500, C.tatami)
    .room("茶室", 1350, 0, 300, 300, C.tatami)
    .room("水屋", 1350, 300, 300, 200, C.wood, "wood")
    .room("縁側", 300, 500, 1350, 90, C.wood, "wood")
    .open(300, 500, 300, 590)
    .open(300, 590, 1650, 590)
    .walls()
    .sliding(0, 380, 0, 520)
    .sliding(60, 300, 200, 300)
    .sliding(300, 80, 300, 220)
    .sliding(300, 330, 300, 470)
    .sliding(900, 80, 900, 420)
    .sliding(1350, 80, 1350, 220)
    .sliding(1400, 300, 1500, 300)
    .sliding(350, 500, 850, 500)
    .sliding(950, 500, 1300, 500)
    .sliding(1400, 500, 1600, 500)
    .window(0, 40, 0, 160).window(30, 0, 270, 0)
    .window(380, 0, 820, 0, true).window(980, 0, 1270, 0).window(1650, 60, 1650, 240)
    // 台所・玄関
    .item("kitchen", 30, 0)
    .item("cupboard", 0, 180, { rot: 270 })
    .item("bench", 60, 530, { w: 180, h: 45 })
    // 広間
    .item("table", 420, 210, { w: 360, h: 80 })
    .row("zaisu", 440, 135, 4, 85, 0)
    .row("zaisu", 440, 300, 4, 85, 0, { rot: 180 })
    // 書院（床の間と文机）
    .item("shelf", 1050, 5, { w: 180, h: 45, color: "#8a6a4a" })
    .item("table", 1000, 250)
    .item("zaisu", 1022, 305, { rot: 180 })
    // 茶室・水屋
    .item("sideTable", 1475, 125, { color: "#3f3a36" })
    .item("zaisu", 1472, 50)
    .item("zaisu", 1472, 190, { rot: 180 })
    .item("cupboard", 1605, 330, { rot: 90 })
    .item("washbasin", 1380, 445, { rot: 180 })
    // 庭
    .item("pond", 500, 760, { w: 400, h: 260 })
    .item("stoneLantern", 300, 700)
    .item("stoneLantern", 1000, 680)
    .item("rock", 950, 880)
    .item("tree", 1250, 700)
    .item("conifer", 60, 900)
    .item("steppingStones", 150, 620)
    .item("shrub", 1100, 1080);
  b.roof("hip", -40, -40, 1730, 670, f);
}

function dormitory(b: PlanBuilder): void {
  const ground = b.floor();
  ground.room("洗濯室", 0, 0, 250, 300, C.tile, "tile").label(20, 150)
    .room("玄関", 0, 300, 250, 220, C.stone, "stone")
    .room("食堂", 250, 0, 550, 400, C.wood, "wood")
    .room("厨房", 800, 0, 300, 400, C.tile, "tile")
    .room("大浴場", 1100, 0, 500, 400, C.tile, "tile")
    .room("", 250, 400, 1350, 120, C.wood, "wood")
    .room("管理人室", 0, 520, 250, 280, C.tatami).label(10, 80)
    .room("101", 250, 520, 450, 280, C.wood, "wood")
    .room("102", 700, 520, 450, 280, C.wood, "wood")
    .room("103", 1150, 520, 450, 280, C.wood, "wood")
    .open(250, 400, 250, 520)
    .walls()
    .door(0, 380, 0, 470)
    .door(80, 300, 170, 300)
    .door(100, 520, 180, 520)
    .door(600, 400, 680, 400)
    .door(900, 400, 980, 400)
    .door(1150, 400, 1230, 400)
    .door(800, 150, 800, 230)
    .window(0, 60, 0, 240).window(330, 0, 720, 0, true).window(860, 0, 1040, 0).window(1180, 0, 1520, 0)
    .window(1600, 100, 1600, 300).window(0, 600, 0, 740)
    .item("stairs", 260, 410, { rot: 90 })
    // 洗濯室・玄関・管理人室
    .row("washer", 10, 10, 3, 75, 0)
    .item("shoeCabinet", 215, 305, { rot: 90 })
    .item("desk", 110, 740, { rot: 180 })
    .item("officeChair", 140, 675)
    // 食堂・厨房・大浴場
    .item("longTable", 340, 90, { w: 360, h: 70 })
    .row("chair", 355, 40, 6, 60, 0)
    .row("chair", 355, 165, 6, 60, 0, { rot: 180 })
    .item("longTable", 340, 270, { w: 360, h: 70 })
    .row("chair", 355, 220, 6, 60, 0)
    .row("chair", 355, 345, 6, 60, 0, { rot: 180 })
    .item("kitchen", 1035, 20, { rot: 90 })
    .item("fridge", 1035, 300)
    .item("longTable", 850, 260, { w: 160, h: 60 })
    .item("bath", 1250, 30, { w: 300, h: 150 })
    .row("shower", 1310, 300, 3, 95, 0);
  for (const x of [250, 700, 1150]) {
    ground.item("desk", x + 150, 520)
      .item("officeChair", x + 180, 585, { rot: 180 })
      .item("bed", x + 10, 690, { rot: 270 })
      .item("wardrobe", x + 405, 600, { rot: 90 })
      .door(x + 310, 520, x + 390, 520);
  }

  const upper = b.floor();
  upper.room("201", 0, 0, 400, 400, C.wood, "wood")
    .room("202", 400, 0, 400, 400, C.wood, "wood")
    .room("203", 800, 0, 400, 400, C.wood, "wood")
    .room("204", 1200, 0, 400, 400, C.wood, "wood")
    .room("", 0, 400, 1600, 120, C.wood, "wood")
    .room("205", 0, 520, 400, 280, C.wood, "wood")
    .room("206", 400, 520, 400, 280, C.wood, "wood")
    .room("207", 800, 520, 400, 280, C.wood, "wood")
    .room("トイレ", 1200, 520, 400, 280, C.tile, "tile").label(20, 120)
    .walls()
    .door(1250, 520, 1330, 520)
    .window(1600, 430, 1600, 490)
    .item("stairs", 260, 410, { rot: 90 })
    .row("toilet", 1230, 725, 3, 80, 0, { rot: 180 })
    .item("washbasin", 1545, 560, { rot: 90 })
    .item("washbasin", 1545, 650, { rot: 90 });
  for (const x of [0, 400, 800, 1200]) {
    upper.item("bed", x + 20, 180)
      .item("desk", x + 260, 10)
      .item("officeChair", x + 290, 75, { rot: 180 })
      .item("wardrobe", x + 355, 200, { rot: 90 })
      .door(x + 150, 400, x + 230, 400)
      .window(x + 80, 0, x + 320, 0);
  }
  for (const x of [0, 400, 800]) {
    upper.item("bed", x + 10, 690, { rot: 270 })
      .item("desk", x + 260, 530)
      .item("officeChair", x + 290, 595, { rot: 180 })
      .door(x + 150, 520, x + 230, 520)
      .window(x + 80, 800, x + 320, 800);
  }
  b.roof("gable", -40, -40, 1680, 880, upper);
}

// ---- お店（つづき） ----

function restaurant(b: PlanBuilder): void {
  const f = b.floor();
  f.room("客席", 0, 0, 900, 700, C.wood, "wood")
    .room("エントランス", 0, 700, 300, 200, C.stone, "stone")
    .room("トイレ", 300, 700, 300, 200, C.tile, "tile").label(20, 60)
    .room("ワインセラー", 600, 700, 300, 200, C.darkStone, "stone").label(20, 70)
    .room("個室", 900, 0, 400, 350, C.wood, "wood")
    .room("厨房", 900, 350, 400, 550, C.tile, "tile")
    .open(40, 700, 260, 700)
    .walls()
    .door(100, 900, 200, 900)
    .door(400, 700, 480, 700)
    .door(700, 700, 780, 700)
    .door(900, 120, 900, 200)
    .door(900, 500, 900, 580)
    .door(1300, 700, 1300, 780)
    .window(80, 0, 820, 0, true).window(0, 150, 0, 550, true).window(950, 0, 1250, 0).window(1300, 60, 1300, 290)
    .item("diningTable", 80, 80).item("diningTable", 380, 80).item("diningTable", 680, 80)
    .item("diningTable", 80, 400).item("diningTable", 380, 400).item("diningTable", 680, 400)
    .item("desk", 60, 640, { w: 120, h: 50 })
    .item("plantLarge", 820, 620)
    .item("diningTable", 1020, 95)
    .item("plant", 1245, 295)
    .item("kitchen", 1235, 380, { rot: 90 })
    .item("kitchenIsland", 960, 600)
    .item("fridge", 920, 830)
    .item("fridge", 995, 830)
    .item("cupboard", 1100, 855, { rot: 180 })
    .item("coatStand", 240, 720)
    .item("bench", 20, 760, { w: 150, h: 45 })
    .item("toilet", 520, 825, { rot: 180 })
    .item("washbasin", 330, 845, { rot: 180 })
    .row("shelf", 620, 870, 3, 90, 0, { rot: 180 })
    .item("shelf", 870, 770, { rot: 90 });
}

function ramen(b: PlanBuilder): void {
  const f = b.floor();
  f.room("客席", 0, 0, 450, 700, C.wood, "wood")
    .room("", 450, 400, 200, 300, C.wood, "wood")
    .room("厨房", 450, 0, 350, 400, C.tile, "tile")
    .room("トイレ", 650, 400, 150, 300, C.tile, "tile")
    .open(450, 0, 450, 400)
    .open(450, 400, 450, 700)
    .open(450, 400, 650, 400)
    .walls()
    .sliding(220, 700, 380, 700)
    .door(650, 600, 650, 680)
    .window(0, 150, 0, 550, true).window(500, 0, 750, 0)
    // L字のカウンター
    .item("longTable", 400, 40, { w: 330, h: 50, rot: 90 })
    .item("longTable", 455, 405, { w: 190, h: 50 })
    .row("stool", 350, 60, 5, 0, 60)
    .row("stool", 470, 465, 4, 45, 0)
    // テーブル席
    .item("table", 60, 100, { w: 80, h: 70 }).item("chair", 10, 112, { rot: 270 }).item("chair", 145, 112, { rot: 90 })
    .item("table", 60, 330, { w: 80, h: 70 }).item("chair", 10, 342, { rot: 270 }).item("chair", 145, 342, { rot: 90 })
    .item("table", 60, 560, { w: 80, h: 70 }).item("chair", 10, 572, { rot: 270 }).item("chair", 145, 572, { rot: 90 })
    // 厨房・トイレ
    .item("kitchen", 735, 20, { rot: 90 })
    .item("fridge", 735, 300)
    .item("longTable", 520, 150, { w: 160, h: 60 })
    .item("toilet", 725, 470, { rot: 90 });
}

function izakaya(b: PlanBuilder): void {
  const f = b.floor();
  f.room("客席", 0, 0, 650, 550, C.wood, "wood")
    .room("厨房", 650, 0, 350, 550, C.tile, "tile")
    .room("トイレ", 0, 550, 150, 300, C.tile, "tile").label(20, 120)
    .room("座敷", 150, 550, 400, 300, C.tatami)
    .room("個室", 550, 550, 300, 300, C.tatami)
    .room("倉庫", 850, 550, 150, 300, C.warm).label(10, 120)
    .open(650, 60, 650, 490)
    .walls()
    .sliding(60, 0, 200, 0)
    .door(30, 550, 110, 550)
    .sliding(200, 550, 500, 550)
    .sliding(570, 550, 640, 550)
    .door(880, 550, 960, 550)
    .window(0, 100, 0, 450).window(300, 0, 600, 0).window(1000, 100, 1000, 450)
    // カウンター
    .item("longTable", 600, 65, { w: 420, h: 50, rot: 90 })
    .row("stool", 545, 80, 6, 0, 68)
    // テーブル席
    .item("table", 100, 150, { w: 120, h: 70 }).row("chair", 115, 100, 2, 60, 0).row("chair", 115, 225, 2, 60, 0, { rot: 180 })
    .item("table", 330, 150, { w: 120, h: 70 }).row("chair", 345, 100, 2, 60, 0).row("chair", 345, 225, 2, 60, 0, { rot: 180 })
    .item("table", 100, 380, { w: 120, h: 70 }).row("chair", 115, 330, 2, 60, 0).row("chair", 115, 455, 2, 60, 0, { rot: 180 })
    .item("table", 330, 380, { w: 120, h: 70 }).row("chair", 345, 330, 2, 60, 0).row("chair", 345, 455, 2, 60, 0, { rot: 180 })
    // 厨房
    .item("kitchen", 935, 40, { rot: 90 })
    .item("fridge", 935, 300)
    .item("longTable", 720, 200, { w: 160, h: 60 })
    .item("cupboard", 700, 505, { rot: 180 })
    // トイレ・座敷・個室・倉庫
    .item("toilet", 50, 775, { rot: 180 })
    .item("table", 250, 660, { w: 200, h: 80 })
    .row("zaisu", 270, 593, 3, 65, 0)
    .row("zaisu", 270, 745, 3, 65, 0, { rot: 180 })
    .item("table", 620, 690, { w: 160, h: 80 })
    .row("zaisu", 640, 625, 2, 65, 0)
    .row("zaisu", 640, 775, 2, 65, 0, { rot: 180 })
    .item("shelf", 970, 640, { rot: 90 })
    .item("shelf", 970, 740, { rot: 90 });
}

function salon(b: PlanBuilder): void {
  const f = b.floor();
  f.room("サロン", 0, 0, 800, 450, C.warm)
    .room("トイレ", 350, 450, 150, 200, C.tile, "tile").label(20, 90)
    .room("スタッフ室", 500, 450, 300, 200, C.cool).label(20, 50)
    .walls()
    .door(80, 450, 180, 450)
    .door(380, 450, 450, 450)
    .door(540, 450, 620, 450)
    .window(0, 60, 0, 180, true).window(800, 60, 800, 160)
    // 鏡の前の席・シャンプー台
    .row("shelf", 120, 5, 4, 150, 0, { w: 100, h: 20, color: "#dfe9ef" })
    .row("officeChair", 140, 60, 4, 150, 0)
    .item("washbasin", 745, 190, { rot: 90 })
    .item("washbasin", 745, 290, { rot: 90 })
    .item("armchair", 660, 188, { rot: 90 })
    .item("armchair", 660, 288, { rot: 90 })
    // 待合・レジ
    .item("sofa2", 0, 200, { rot: 270 })
    .item("table", 100, 220, { rot: 90 })
    .item("desk", 250, 385, { rot: 180 })
    .item("plantLarge", 720, 380)
    // トイレ・スタッフ室
    .item("toilet", 430, 575, { rot: 180 })
    .item("longTable", 620, 540, { w: 140, h: 60 })
    .item("stool", 640, 605)
    .item("stool", 700, 605)
    .item("washer", 735, 460);
}

function bookstore(b: PlanBuilder): void {
  const f = b.floor();
  f.room("売り場", 0, 0, 900, 800, C.wood, "wood")
    .room("カフェ", 900, 0, 300, 450, C.wood, "wood")
    .room("事務所", 900, 450, 300, 350, C.cool)
    .open(900, 50, 900, 400)
    .walls()
    .sliding(100, 800, 300, 800)
    .door(900, 650, 900, 730)
    .window(0, 100, 0, 700, true).window(950, 0, 1150, 0).window(1200, 60, 1200, 400)
    // 壁の本棚と、背中合わせの本棚の列
    .row("shelf", 120, 0, 8, 95, 0);
  for (const x of [150, 320, 490, 660]) {
    f.item("shelf", x, 120, { w: 360, h: 35, rot: 90 })
      .item("shelf", x + 35, 120, { w: 360, h: 35, rot: 270 });
  }
  f.item("table", 150, 580, { w: 140, h: 70, color: "#c9a27a" })
    .item("table", 400, 580, { w: 140, h: 70, color: "#c9a27a" })
    .item("longTable", 650, 640, { w: 180, h: 60 })
    .item("officeChair", 710, 705, { rot: 180 })
    .item("plantLarge", 20, 720)
    // カフェ
    .item("roundTable", 960, 100, { w: 70, h: 70 }).item("chair", 915, 112, { rot: 270 }).item("chair", 1035, 112, { rot: 90 })
    .item("roundTable", 960, 280, { w: 70, h: 70 }).item("chair", 915, 292, { rot: 270 }).item("chair", 1035, 292, { rot: 90 })
    .item("longTable", 1150, 120, { w: 200, h: 50, rot: 90 })
    // 事務所
    .item("desk", 1060, 470)
    .item("officeChair", 1090, 535, { rot: 180 })
    .row("shelf", 920, 765, 3, 90, 0, { rot: 180 });
}

// ---- 施設（つづき） ----

function nursery(b: PlanBuilder): void {
  const f = b.floor();
  f.area("園庭", 0, -550, 1100, 550, "plain", C.sand)
    .room("保育室", 0, 0, 700, 500, C.wood, "wood")
    .room("お昼寝室", 700, 0, 400, 500, C.tatami)
    .room("給食室", 0, 500, 350, 300, C.tile, "tile")
    .room("職員室", 350, 500, 350, 300, C.cool).label(100, 40)
    .room("トイレ", 700, 500, 400, 300, C.tile, "tile")
    .walls()
    .sliding(100, 0, 300, 0).sliding(400, 0, 600, 0)
    .sliding(700, 100, 700, 400)
    .door(150, 500, 230, 500)
    .door(360, 500, 440, 500)
    .door(800, 500, 880, 500)
    .door(600, 800, 690, 800)
    .window(780, 0, 1020, 0).window(0, 100, 0, 400).window(1100, 100, 1100, 400).window(80, 800, 280, 800).window(1100, 560, 1100, 740)
    // 保育室
    .item("rug", 60, 80, { w: 300, h: 200, color: "#7fb3d5" })
    .item("table", 420, 150, { w: 120, h: 60, color: "#f2c14e" })
    .row("stool", 425, 105, 3, 40, 0)
    .row("stool", 425, 215, 3, 40, 0)
    .item("table", 420, 330, { w: 120, h: 60, color: "#9ccc65" })
    .row("stool", 425, 285, 3, 40, 0)
    .row("stool", 425, 395, 3, 40, 0)
    .row("shelf", 60, 465, 3, 95, 0, { rot: 180 })
    .item("piano", 520, 440, { rot: 180 })
    // お昼寝室
    .row("futon", 740, 120, 4, 85, 0, { w: 70, h: 130 })
    .row("futon", 740, 300, 4, 85, 0, { w: 70, h: 130 })
    // 給食室・職員室・トイレ
    .item("kitchen", 20, 735, { rot: 180 })
    .item("fridge", 275, 735)
    .item("longTable", 60, 600, { w: 160, h: 60 })
    .item("desk", 640, 540, { rot: 90 })
    .item("officeChair", 570, 570, { rot: 270 })
    .item("desk", 380, 620)
    .item("officeChair", 410, 685, { rot: 180 })
    .row("toilet", 750, 725, 4, 70, 0, { rot: 180 })
    .row("washbasin", 1045, 540, 2, 0, 85, { rot: 90 })
    // 園庭
    .item("swing", 100, -450)
    .item("tree", 800, -520)
    .item("bench", 400, -120)
    .item("flowerBed", 420, -530)
    .item("trashCan", 620, -60);
  b.roof("hip", -30, -30, 1160, 860, f);
}

function gymnasium(b: PlanBuilder): void {
  const f = b.floor();
  f.room("アリーナ", 0, 0, 2400, 1500, C.wood, "wood")
    .room("器具庫", 0, 1500, 500, 400, C.gray)
    .room("ステージ", 500, 1500, 1100, 400, C.wood, "wood")
    .room("男子更衣室", 1600, 1500, 400, 400, C.cool).label(20, 100)
    .room("女子更衣室", 2000, 1500, 400, 400, C.rose).label(20, 100)
    .open(550, 1500, 1550, 1500)
    .walls()
    .sliding(1050, 0, 1350, 0)
    .sliding(150, 1500, 400, 1500)
    .door(1650, 1500, 1730, 1500)
    .door(2050, 1500, 2130, 1500)
    .window(200, 0, 900, 0, true).window(1500, 0, 2200, 0, true)
    .window(0, 200, 0, 600, true).window(0, 900, 0, 1300, true)
    .window(2400, 200, 2400, 600, true).window(2400, 900, 2400, 1300, true)
    .row("bench", 100, 1400, 3, 250, 0, { w: 200, h: 50 })
    .row("bench", 1600, 1400, 3, 250, 0, { w: 200, h: 50 })
    .item("rug", 50, 1600, { w: 200, h: 100, color: "#3a6ea5" })
    .item("rug", 280, 1600, { w: 200, h: 100, color: "#3a6ea5" })
    .row("shelf", 30, 1865, 5, 90, 0, { rot: 180 })
    .item("piano", 600, 1820)
    .item("desk", 1000, 1560, { w: 100, h: 50 })
    .item("closet", 1620, 1835).item("closet", 1800, 1835)
    .item("bench", 1700, 1680, { w: 200, h: 45 })
    .item("closet", 2020, 1835).item("closet", 2200, 1835)
    .item("bench", 2100, 1680, { w: 200, h: 45 });
  b.roof("gable", -40, -40, 2480, 1980, f);
}

function policeBox(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", -150, 400, 800, 250, "stone", C.stone)
    .room("執務室", 0, 0, 300, 400, C.gray)
    .room("休憩室", 300, 0, 200, 250, C.tatami)
    .room("トイレ", 300, 250, 200, 150, C.tile, "tile")
    .walls()
    .sliding(80, 400, 220, 400)
    .door(300, 80, 300, 160)
    .door(300, 290, 300, 360)
    .window(0, 100, 0, 300).window(230, 400, 290, 400).window(500, 60, 500, 200)
    .item("desk", 90, 200)
    .item("officeChair", 120, 135)
    .item("chair", 128, 270, { rot: 180 })
    .item("shelf", 200, 0)
    .item("coatStand", 240, 330)
    .item("table", 380, 100, { w: 80, h: 60 })
    .item("zaisu", 392, 165, { rot: 180 })
    .item("toilet", 425, 300, { rot: 90 })
    .item("bicycle", 300, 450, { rot: 90 })
    .item("bicycle", 300, 540, { rot: 90 })
    .item("gardenLight", 240, 410, { color: "#d9302c" });
  b.roof("gable", -30, -30, 560, 460, f);
}

function cinema(b: PlanBuilder): void {
  const f = b.floor();
  f.room("シアター", 0, 0, 1200, 1000, "#4a4f5a")
    .room("ロビー", 0, 1000, 900, 400, C.warm).label(20, 100)
    .room("映写室", 900, 1000, 300, 200, C.gray)
    .room("トイレ", 900, 1200, 300, 200, C.tile, "tile")
    .walls()
    .door(100, 1000, 200, 1000)
    .door(700, 1000, 800, 1000)
    .door(900, 1050, 900, 1130)
    .door(900, 1250, 900, 1330)
    .sliding(300, 1400, 600, 1400)
    .item("tv", 150, 20, { w: 900, h: 30 })
    .item("desk", 1020, 1010, { w: 100, h: 60, color: "#55595f" })
    .item("officeChair", 1040, 1075, { rot: 180 })
    .item("longTable", 550, 1100, { w: 300, h: 60 })
    .item("sofa2", 60, 1320, { rot: 180 })
    .item("plantLarge", 820, 1320)
    .row("toilet", 1000, 1325, 3, 60, 0, { rot: 180 });
  // 客席（スクリーンを向く）。真ん中に通路
  for (let r = 0; r < 7; r += 1) {
    f.row("chair", 120, 250 + r * 95, 6, 55, 0, { w: 50, h: 50, rot: 180, color: "#a33a3a" })
      .row("chair", 700, 250 + r * 95, 6, 55, 0, { w: 50, h: 50, rot: 180, color: "#a33a3a" });
  }
  b.roof("flat", -30, -30, 1260, 1460, f);
}

function temple(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 2000, 1700, "plain", C.sand)
    .area("", 950, 650, 100, 1050, "stone", C.stone)
    .area("墓地", 100, 950, 750, 600, "stone", C.stone)
    .area("鐘楼", 300, 250, 220, 220, "wood", C.wood)
    .room("本堂", 650, 150, 700, 500, C.wood, "wood")
    .room("庫裏", 1450, 150, 450, 500, C.tatami)
    .walls()
    .sliding(750, 650, 1250, 650)
    .door(1500, 650, 1590, 650)
    .window(650, 250, 650, 550).window(1350, 250, 1350, 550).window(1900, 250, 1900, 550).window(1500, 150, 1850, 150)
    // 本堂
    .item("cupboard", 850, 160, { w: 300, h: 70, color: "#c9a227" })
    .item("floorLamp", 790, 170)
    .item("floorLamp", 1165, 170)
    .row("zaisu", 750, 330, 7, 75, 0)
    .row("zaisu", 750, 430, 7, 75, 0)
    // 庫裏
    .item("kitchen", 1835, 380, { rot: 90 })
    .item("table", 1550, 300, { w: 140, h: 80 })
    .item("zaisu", 1570, 230)
    .item("zaisu", 1630, 230)
    // 鐘楼・墓地・境内
    .item("roundTable", 360, 330, { w: 100, h: 100, color: "#8a6a3a" })
    .item("conifer", 60, 500)
    .item("conifer", 1700, 800)
    .item("tree", 1400, 1000)
    .row("stoneLantern", 870, 760, 3, 0, 300)
    .row("stoneLantern", 1070, 760, 3, 0, 300);
  for (let r = 0; r < 4; r += 1) f.row("grave", 160, 1050 + r * 120, 8, 80, 0, { w: 60, h: 70 });
  b.roof("hip", 620, 120, 760, 560, f);
  b.roof("gable", 1420, 120, 510, 560, f);
  b.roof("hip", 280, 230, 260, 260, f);
}

// ---- 屋外・乗り物（つづき） ----

function campsite(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 2000, 1400, "grass", C.grass)
    .area("川", 0, 1250, 2000, 150, "plain", "#8cc0dc")
    .area("駐車場", 0, 0, 500, 600, "stone", C.stone)
    .area("炊事場", 800, 100, 400, 300, "stone", C.stone)
    .room("バンガロー", 1500, 100, 350, 350, C.wood, "wood")
    .room("トイレ", 1550, 800, 250, 200, C.tile, "tile")
    .walls()
    .door(1850, 150, 1850, 230)
    .door(1550, 850, 1550, 930)
    .window(1520, 100, 1700, 100).window(1500, 200, 1500, 350)
    .item("car", 60, 100)
    .item("car", 280, 100, { symbol: 1 })
    .item("kitchen", 880, 300, { rot: 180 })
    .item("longTable", 900, 200)
    .item("bunkBed", 1520, 230)
    .item("bunkBed", 1640, 230)
    .item("sideTable", 1780, 380)
    .item("toilet", 1650, 925, { rot: 180 })
    .item("toilet", 1720, 925, { rot: 180 })
    // テントとタープ・焚き火
    .item("shed", 650, 650, { w: 220, h: 200, color: "#e07b39" })
    .item("shed", 950, 650, { w: 220, h: 200, color: "#3f8f6b" })
    .item("shed", 1250, 650, { w: 220, h: 200, color: "#d9b23f" })
    .item("parasol", 600, 950)
    .item("longTable", 630, 1040)
    .item("bench", 630, 990, { w: 180, h: 40 })
    .item("bench", 630, 1105, { w: 180, h: 40 })
    .item("pond", 1000, 1000, { w: 110, h: 110, color: "#d9662b" })
    .item("stool", 940, 1035)
    .item("stool", 1125, 1035)
    .item("stool", 1035, 1125)
    .item("conifer", 600, 150)
    .item("conifer", 1300, 150)
    .item("tree", 100, 750)
    .item("conifer", 1810, 1050);
  b.roof("gable", 780, 80, 440, 340, f);
  b.roof("gable", 1480, 80, 390, 390, f);
  b.roof("gable", 1530, 780, 290, 240, f);
}

function cruiseShip(b: PlanBuilder): void {
  const f = b.floor();
  f.area("プールデッキ", -500, 0, 800, 740, "wood", C.wood)
    .area("プール", -420, 170, 360, 400, "tile", "#7fc4e8")
    .room("", 300, 320, 1050, 100, C.gray)
    .room("レストラン", 1350, 0, 800, 740, C.wood, "wood")
    .room("操舵室", 2150, 170, 300, 400, C.cool);
  // 客室（上の列と下の列）
  [300, 650, 1000].forEach((x, i) => {
    f.room(`${101 + i}`, x, 0, 350, 320, C.cream).label(10, 220)
      .room(`${104 + i}`, x, 420, 350, 320, C.cream);
  });
  f.walls()
    .door(300, 340, 300, 400)
    .door(1350, 340, 1350, 400)
    .door(2150, 300, 2150, 380)
    .window(1420, 0, 2080, 0, true).window(1420, 740, 2080, 740, true).window(2450, 200, 2450, 540, true)
    .item("bench", -480, 200, { rot: 90 })
    .item("bench", -480, 400, { rot: 90 })
    .item("parasol", 20, 60)
    .item("roundTable", 100, 140, { w: 80, h: 80 })
    .item("plantLarge", 220, 650)
    .item("diningTable", 1420, 140).item("diningTable", 1650, 140).item("diningTable", 1880, 140)
    .item("diningTable", 1420, 470).item("diningTable", 1650, 470).item("diningTable", 1880, 470)
    .item("desk", 2390, 300, { rot: 90 })
    .item("desk", 2390, 430, { rot: 90 })
    .item("officeChair", 2320, 330, { rot: 270 })
    .item("officeChair", 2320, 460, { rot: 270 });
  for (const x of [300, 650, 1000]) {
    f.item("bed", x + 20, 10).item("bed", x + 140, 10).item("sideTable", x + 260, 20)
      .door(x + 250, 320, x + 330, 320)
      .window(x + 80, 0, x + 260, 0)
      .item("bed", x + 20, 530, { rot: 180 }).item("bed", x + 140, 530, { rot: 180 }).item("sideTable", x + 260, 680)
      .door(x + 250, 420, x + 330, 420)
      .window(x + 80, 740, x + 260, 740);
  }
}

function sleeperTrain(b: PlanBuilder): void {
  const f = b.floor();
  // 1両目: 個室の寝台が7つと、トイレ・通路
  for (let i = 0; i < 7; i += 1) {
    const x = i * 250;
    f.room(`${i + 1}号室`, x, 0, 250, 200, C.cream);
  }
  f.room("トイレ", 1750, 0, 250, 200, C.tile, "tile")
    .room("", 0, 200, 2000, 100, C.wood, "wood")
    // 2両目: 食堂車と、広い個室が2つ
    .room("食堂車", 0, 400, 1200, 300, C.wood, "wood").label(10, 115)
    .room("8号室", 1200, 400, 400, 200, C.cream)
    .room("9号室", 1600, 400, 400, 200, C.cream)
    .room("", 1200, 600, 800, 100, C.wood, "wood")
    .walls()
    .door(0, 220, 0, 280).door(2000, 220, 2000, 280)
    .door(1800, 200, 1880, 200)
    .door(0, 520, 0, 580).door(1200, 620, 1200, 680).door(2000, 620, 2000, 680)
    .sliding(1240, 600, 1350, 600).sliding(1640, 600, 1750, 600)
    .window(100, 300, 600, 300).window(800, 300, 1300, 300).window(1450, 300, 1900, 300)
    .window(100, 400, 1100, 400, true).window(100, 700, 1100, 700, true)
    .window(1260, 400, 1540, 400).window(1660, 400, 1940, 400)
    .item("toilet", 1925, 120, { rot: 90 })
    .item("washbasin", 1750, 110, { rot: 270 })
    .item("bedDouble", 1380, 450, { rot: 90 })
    .item("bedDouble", 1780, 450, { rot: 90 });
  for (let i = 0; i < 7; i += 1) {
    const x = i * 250;
    f.item("bed", x + 25, 90, { rot: 90 })
      .sliding(x + 60, 200, x + 190, 200)
      .window(x + 40, 0, x + 210, 0);
  }
  for (let i = 0; i < 5; i += 1) {
    const x = 40 + i * 230;
    f.item("table", x + 60, 410, { w: 70, h: 70 }).item("chair", x + 10, 422, { rot: 270 }).item("chair", x + 135, 422, { rot: 90 })
      .item("table", x + 60, 620, { w: 70, h: 70 }).item("chair", x + 10, 632, { rot: 270 }).item("chair", x + 135, 632, { rot: 90 });
  }
}

// ---- ファンタジー・SF ----

function castle(b: PlanBuilder): void {
  const f = b.floor();
  f.area("前庭", 0, 1300, 2000, 400, "grass", C.grass)
    .room("北西の塔", 0, 0, 500, 600, C.darkStone, "stone")
    .room("玉座の間", 500, 0, 1000, 800, C.stone, "stone")
    .room("北東の塔", 1500, 0, 500, 600, C.darkStone, "stone")
    .room("兵舎", 0, 600, 500, 700, C.wood, "wood")
    .room("大広間", 500, 800, 1000, 500, C.wood, "wood")
    .room("厨房", 1500, 600, 500, 700, C.stone, "stone")
    .room("城門", 900, 1300, 200, 200, C.darkStone, "stone").label(10, 120)
    .walls()
    .door(500, 250, 500, 350).door(1500, 250, 1500, 350)
    .door(200, 600, 300, 600).door(1700, 600, 1800, 600)
    .door(950, 800, 1050, 800)
    .door(500, 1000, 500, 1100).door(1500, 1000, 1500, 1100)
    .door(950, 1300, 1050, 1300)
    .sliding(920, 1500, 1080, 1500)
    .window(0, 200, 0, 400).window(2000, 200, 2000, 400).window(700, 0, 1300, 0, true)
    .window(0, 800, 0, 1100).window(2000, 1150, 2000, 1250)
    // 塔（らせん階段）
    .item("stairsSpiral", 180, 230).item("floorLamp", 60, 500)
    .item("stairsSpiral", 1680, 230).item("floorLamp", 1895, 500)
    // 玉座の間
    .item("rug", 920, 120, { w: 160, h: 640, color: "#8e1f2a" })
    .item("armchair", 945, 15, { w: 110, h: 100, color: "#c9a227" })
    .item("armchair", 790, 40, { color: "#8e1f2a" })
    .item("armchair", 1130, 40, { color: "#8e1f2a" })
    .item("floorLamp", 700, 200).item("floorLamp", 1255, 200).item("floorLamp", 700, 550).item("floorLamp", 1255, 550)
    // 兵舎
    .item("longTable", 160, 720)
    .row("stool", 175, 785, 4, 45, 0)
    .row("bunkBed", 30, 900, 4, 115, 0)
    // 大広間
    .item("longTable", 700, 950, { w: 600, h: 80 })
    .row("chair", 720, 900, 10, 58, 0)
    .row("chair", 720, 1035, 10, 58, 0, { rot: 180 })
    .item("fireplace", 1200, 800)
    // 厨房
    .item("kitchen", 1935, 700, { rot: 90 })
    .item("longTable", 1600, 900, { w: 200, h: 70 })
    .row("roundTable", 1530, 1180, 3, 70, 0, { w: 60, h: 60, color: "#8a5a2b" })
    // 前庭
    .item("pond", 600, 1450, { w: 120, h: 120, color: "#6f8fa6" })
    .item("tree", 150, 1380)
    .item("tree", 1600, 1350)
    .item("shrub", 1250, 1550);
  // 2階の下にならない兵舎・大広間・厨房の屋根と、城門の屋根
  b.roof("flat", -30, 600, 2060, 730, f);
  b.roof("hip", 880, 1280, 240, 240, f);

  // 2階: 塔と、王の寝室・礼拝室
  const upper = b.floor();
  upper.room("北西の塔", 0, 0, 500, 600, C.darkStone, "stone")
    .room("王の寝室", 500, 0, 500, 600, C.wood, "wood")
    .room("礼拝室", 1000, 0, 500, 600, C.stone, "stone")
    .room("北東の塔", 1500, 0, 500, 600, C.darkStone, "stone")
    .walls()
    .door(500, 250, 500, 350).door(1000, 250, 1000, 350).door(1500, 250, 1500, 350)
    .window(0, 200, 0, 400).window(2000, 200, 2000, 400)
    .window(600, 0, 900, 0, true).window(1100, 0, 1400, 0, true).window(600, 600, 900, 600, true).window(1100, 600, 1400, 600, true)
    .item("stairsSpiral", 180, 230).item("floorLamp", 60, 500)
    .item("stairsSpiral", 1680, 230).item("floorLamp", 1895, 500)
    .item("bedDouble", 660, 90, { w: 180, h: 220, color: "#8e1f2a" })
    .item("sideTable", 600, 100).item("sideTable", 850, 100)
    .item("rug", 600, 340, { w: 300, h: 180, color: "#8e1f2a" })
    .item("fireplace", 955, 380, { rot: 90 })
    .item("wardrobe", 500, 420, { rot: 270 })
    .item("cupboard", 1250, 10, { w: 200, h: 50, color: "#c9a227" })
    .item("floorLamp", 1190, 15).item("floorLamp", 1455, 15)
    .row("bench", 1100, 220, 3, 0, 110, { w: 300, h: 50 });
  b.roof("hip", -30, -30, 560, 660, upper);
  b.roof("hip", 1470, -30, 560, 660, upper);
  b.roof("gable", 470, -30, 1060, 660, upper);
}

function adventurersInn(b: PlanBuilder): void {
  const ground = b.floor();
  ground.room("酒場", 0, 0, 800, 900, C.wood, "wood")
    .room("厨房", 800, 0, 400, 450, C.tile, "tile")
    .room("倉庫", 800, 450, 400, 250, C.wood, "wood")
    .room("", 800, 700, 400, 200, C.wood, "wood")
    .walls()
    .door(300, 900, 400, 900)
    .door(800, 100, 800, 180)
    .door(900, 450, 980, 450)
    .door(800, 760, 800, 840)
    .window(0, 100, 0, 300).window(0, 600, 0, 800).window(500, 900, 700, 900).window(1200, 60, 1200, 240)
    // 暖炉・依頼の掲示板・カウンター
    .item("fireplace", 0, 380, { rot: 270 })
    .item("shelf", 300, 0, { w: 160, h: 15, color: "#8a5a2b" })
    .item("longTable", 680, 250, { w: 400, h: 60, rot: 90 })
    .row("stool", 630, 270, 6, 0, 65)
    .row("shelf", 770, 300, 3, 0, 100, { rot: 90 })
    .item("plantLarge", 720, 820);
  // 丸テーブルと丸椅子
  for (const [x, y] of [[150, 150], [400, 150], [150, 600], [400, 600]]) {
    ground.item("roundTable", x, y)
      .item("stool", x - 45, y + 30).item("stool", x + 105, y + 30)
      .item("stool", x + 30, y - 45).item("stool", x + 30, y + 105);
  }
  ground.item("kitchen", 1135, 40, { rot: 90 })
    .item("longTable", 880, 200, { w: 160, h: 60 })
    .item("roundTable", 830, 380, { w: 60, h: 60, color: "#8a5a2b" })
    .row("roundTable", 830, 600, 4, 85, 0, { w: 70, h: 70, color: "#8a5a2b" })
    .item("stairs", 880, 750, { rot: 90 });

  const upper = b.floor();
  upper.room("客室1", 0, 0, 300, 400, C.wood, "wood")
    .room("客室2", 300, 0, 300, 400, C.wood, "wood")
    .room("客室3", 600, 0, 300, 400, C.wood, "wood")
    .room("客室4", 900, 0, 300, 400, C.wood, "wood")
    .room("", 0, 400, 1200, 120, C.wood, "wood")
    .room("客室5", 0, 520, 400, 380, C.wood, "wood")
    .room("客室6", 400, 520, 400, 380, C.wood, "wood")
    .room("", 800, 520, 400, 380, C.wood, "wood")
    .open(800, 520, 1200, 520)
    .walls()
    .item("stairs", 880, 750, { rot: 90 });
  for (const x of [0, 300, 600, 900]) {
    upper.item("bed", x + 20, 180).item("sideTable", x + 130, 190).item("wardrobe", x + 180, 10, { w: 100, h: 45 })
      .door(x + 200, 400, x + 280, 400)
      .window(x + 60, 0, x + 160, 0);
  }
  for (const x of [0, 400]) {
    upper.item("bunkBed", x + 30, 680).item("bunkBed", x + 150, 680).item("wardrobe", x + 270, 855, { w: 100, h: 45, rot: 180 })
      .door(x + 250, 520, x + 330, 520)
      .window(x + 60, 900, x + 220, 900);
  }
  upper.window(0, 600, 0, 800);
  b.roof("hip", -40, -40, 1280, 980, upper);
}

function wizardTower(b: PlanBuilder): void {
  const ground = b.floor();
  ground.room("書庫", 0, 0, 700, 700, C.wood, "wood")
    .walls()
    .door(250, 700, 350, 700)
    .window(700, 150, 700, 300).window(0, 620, 0, 680)
    .item("stairsSpiral", 520, 520)
    .row("shelf", 0, 100, 5, 0, 100, { rot: 270 })
    .row("shelf", 120, 0, 5, 100, 0)
    .item("rug", 180, 260, { w: 300, h: 200, color: "#5b3a6b" })
    .item("desk", 250, 300, { w: 140, h: 70 })
    .item("armchair", 280, 375, { rot: 180 })
    .item("floorLamp", 430, 290);

  const middle = b.floor();
  middle.room("研究室", 0, 0, 700, 700, C.darkStone, "stone")
    .walls()
    .window(0, 150, 0, 260).window(300, 700, 450, 700)
    .item("stairsSpiral", 520, 520)
    .item("longTable", 100, 150, { w: 300, h: 80 })
    .item("roundTable", 150, 400, { w: 100, h: 100, color: "#2f3436" })
    .item("aquarium", 450, 10, { color: "#7fd1b9" })
    .row("shelf", 0, 300, 2, 0, 100, { rot: 270 })
    .item("fireplace", 655, 150, { rot: 90 })
    .item("catTower", 420, 300);

  const top = b.floor();
  top.room("寝室", 0, 0, 400, 700, C.wood, "wood")
    .room("星見台", 400, 0, 300, 700, C.wood, "wood")
    .walls()
    .door(400, 300, 400, 380)
    .window(100, 0, 300, 0).window(700, 60, 700, 300, true).window(450, 700, 650, 700, true)
    .item("stairsSpiral", 520, 520)
    .item("bed", 40, 60)
    .item("wardrobe", 0, 400, { rot: 270 })
    .item("desk", 180, 640, { rot: 180 })
    .item("chair", 218, 590)
    .item("floorLamp", 530, 120)
    .item("armchair", 510, 220)
    .item("roundTable", 430, 360, { w: 70, h: 70 });
  b.roof("hip", -40, -40, 780, 780, top);
}

function spaceship(b: PlanBuilder): void {
  const f = b.floor();
  const hull = "#e9eef3";
  f.room("", 0, 350, 2000, 100, C.gray)
    .room("食堂", 1200, 0, 800, 350, hull)
    .room("機関室", 0, 450, 800, 350, C.darkStone, "stone")
    .room("貨物室", 800, 450, 400, 350, C.gray)
    .room("医務室", 1200, 450, 400, 350, C.mint)
    .room("エアロック", 1600, 450, 400, 350, C.gray)
    .room("操縦室", 2000, 150, 400, 500, "#dfe7ef");
  [0, 300, 600, 900].forEach((x, i) => {
    f.room(`居室${i + 1}`, x, 0, 300, 350, hull);
  });
  f.walls()
    .door(2000, 360, 2000, 440)
    .sliding(1250, 350, 1330, 350)
    .sliding(100, 450, 180, 450)
    .sliding(1050, 450, 1130, 450)
    .sliding(1250, 450, 1330, 450)
    .sliding(1650, 450, 1730, 450)
    .door(1750, 800, 1850, 800)
    .window(2400, 200, 2400, 600, true).window(2050, 150, 2350, 150).window(2050, 650, 2350, 650)
    // 操縦室
    .item("desk", 2340, 200, { rot: 90 }).item("desk", 2340, 340, { rot: 90 }).item("desk", 2340, 480, { rot: 90 })
    .item("officeChair", 2270, 230, { rot: 270 }).item("officeChair", 2270, 370, { rot: 270 }).item("officeChair", 2270, 510, { rot: 270 })
    .item("armchair", 2120, 360, { rot: 90 })
    // 食堂
    .item("longTable", 1350, 150, { w: 360, h: 80 })
    .row("chair", 1365, 100, 6, 60, 0)
    .row("chair", 1365, 235, 6, 60, 0, { rot: 180 })
    .item("kitchen", 1935, 50, { rot: 90 })
    // 機関室・貨物室・医務室・エアロック
    .item("roundTable", 300, 520, { w: 200, h: 200, color: "#3fa7d6" })
    .item("wardrobe", 580, 700, { w: 180, h: 90, color: "#4a5560" })
    .row("shelf", 770, 480, 2, 0, 100, { rot: 90, color: "#4a5560" })
    .item("wardrobe", 830, 560, { w: 180, h: 90, color: "#8a7a5a" })
    .item("wardrobe", 830, 680, { w: 180, h: 90, color: "#5a7a8a" })
    .item("bed", 1240, 560).item("bed", 1380, 560)
    .item("washbasin", 1545, 470, { rot: 90 })
    .row("coatStand", 1630, 560, 3, 70, 0);
  for (const x of [0, 300, 600, 900]) {
    f.item("bunkBed", x + 180, 120).item("closet", x, 220, { w: 100, h: 45, rot: 270 })
      .sliding(x + 40, 350, x + 150, 350)
      .window(x + 100, 0, x + 200, 0);
  }
}

const BUILDERS: Record<string, (b: PlanBuilder) => void> = {
  threeStory, mansion, apartment, shareHouse, japaneseHouse, oldFarmhouse,
  westernMansion, samuraiHouse, lodge, ryokan, hotel, dormitory,
  cafe, restaurant, ramen, izakaya, bar, salon, bookstore, convenience,
  hospital, school, nursery, library, gymnasium, office, lab, police, policeBox, museum, cinema, church, shrine, temple, bathhouse, factory,
  park, campsite, cruiseShip, sleeperTrain,
  castle, adventurersInn, wizardTower, dungeon, spaceship,
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
