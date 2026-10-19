import { isStair } from "./stairs.ts";
import { openTemplateStairwells } from "./template-floors.ts";
import type { RoofKind } from "./roof-shapes.ts";
import type { DoorStyle } from "./opening-shapes.ts";
import type { RoomSurface } from "./surfaces.ts";
import { curveThrough, freeFrame, freeMargin, isFreeAreaKind, isFreeShapeKind } from "./free-shapes.ts";

// テンプレート（間取りの見本）。家・病院・洋館など153種類のうち、ここで作る物（住まいの4種類と作例は main.ts）。
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
      { key: "oneK", label: "1K", title: "洋室・キッチン・ユニットバスとベランダ" },
      { key: "oneLdk", label: "1LDK", title: "LDKと寝室" },
      { key: "twoLdk", label: "2LDK", title: "LDKと洋室2つ" },
      { key: "twoStory", label: "二階建て 3LDK", title: "1階にLDK、2階に寝室と洋室" },
      { key: "threeStory", label: "三階建て", title: "1階に車庫と水回り、2階にLDK、3階に寝室。狭い土地の三階建て" },
      { key: "mansion", label: "マンション", title: "3LDKのマンションの1戸。玄関からの廊下とバルコニー" },
      { key: "towerMansion", label: "タワーマンション", title: "高層階の2LDK。大きな窓とバルコニー、ウォークインクローゼット" },
      { key: "maisonette", label: "メゾネット", title: "1階にLDKと水回り、2階に寝室と子ども部屋" },
      { key: "apartment", label: "アパート", title: "1Kが3部屋ずつの二階建て。外廊下と外階段" },
      { key: "danchi", label: "団地", title: "昭和の団地の3DK。和室2つとダイニングキッチン" },
      { key: "shareHouse", label: "シェアハウス", title: "共用のLDKと水回り、個室5つの二階建て" },
      { key: "twoFamily", label: "二世帯住宅", title: "1階に親世帯、2階に子世帯の二階建て" },
      { key: "garageHouse", label: "ガレージハウス", title: "1階にガレージと作業場、2階にLDKと寝室" },
      { key: "courtyardHouse", label: "中庭のある家", title: "中庭を囲む平屋" },
      { key: "bungalow", label: "平屋の洋風住宅", title: "テラスと庭のある平屋" },
      { key: "logHouse", label: "ログハウス", title: "暖炉のあるリビングとデッキ、森の中の丸太の家" },
      { key: "penthouse", label: "ペントハウス", title: "最上階の広いリビングと屋上テラス" },
      { key: "tinyHouse", label: "小さな家", title: "1部屋に寝床・台所・シャワーをまとめた小屋" },
      { key: "sample", label: "サンプル（作例）", title: "いろいろな家具や床を置いた作例" },
    ],
  },
  {
    label: "和風・歴史",
    templates: [
      { key: "japaneseHouse", label: "平屋の日本家屋", title: "茶の間・座敷・土間・縁側と庭のある和風の家" },
      { key: "oldFarmhouse", label: "古民家", title: "土間・囲炉裏の間・座敷と縁側、庭と蔵" },
      { key: "samuraiHouse", label: "武家屋敷", title: "広間・書院・茶室、池と枯山水の庭、白い土塀と表門" },
      { key: "machiya", label: "京町家", title: "通り庭の土間・店の間・坪庭・奥の間" },
      { key: "nagaya", label: "長屋", title: "路地に面した4軒の長屋。土間とかまど、共同の井戸" },
      { key: "ninjaHouse", label: "忍者屋敷", title: "隠し部屋・仏間・納戸と竹垣" },
      { key: "japaneseCastle", label: "日本の城", title: "石垣と堀に囲まれた本丸、三重の天守・本丸御殿・櫓門・隅櫓" },
      { key: "shrine", label: "神社", title: "本殿・拝殿・神楽殿・社務所、二つの鳥居の長い参道、玉垣と池" },
      { key: "temple", label: "寺", title: "本堂・庫裏・鐘楼・五重塔・山門と墓地、築地塀に囲まれた境内" },
      { key: "japaneseGarden", label: "日本庭園", title: "池・流れ・飛び石・石灯籠の庭と茶室・東屋" },
      { key: "onsen", label: "温泉", title: "男湯・女湯の内湯と、竹垣で仕切った露天風呂" },
      { key: "teaHouse", label: "茶室", title: "茶室・水屋と、飛び石とつくばいの露地" },
      { key: "yatai", label: "屋台", title: "提灯をさげた夜のラーメン屋台" },
    ],
  },
  {
    label: "屋敷・宿",
    templates: [
      { key: "westernMansion", label: "洋館", title: "大広間・食堂・書斎のある二階建てと地下室" },
      { key: "palace", label: "宮殿", title: "謁見の間・舞踏の間と東西の間、噴水と花壇の前庭" },
      { key: "villa", label: "海辺の別荘", title: "プールとヤシの木のある白い別荘" },
      { key: "lodge", label: "山荘・ペンション", title: "暖炉のラウンジと客室4つ。森とテラス" },
      { key: "ryokan", label: "旅館", title: "客室・宴会場・大浴場と中庭。2階にも客室と談話室" },
      { key: "minshuku", label: "民宿", title: "帳場・食堂・客室・風呂の小さな宿" },
      { key: "hotel", label: "ホテル", title: "1階にロビーとレストラン、2・3階に客室" },
      { key: "guesthouse", label: "ゲストハウス", title: "ラウンジとキッチン、2段ベッドのドミトリー" },
      { key: "capsuleHotel", label: "カプセルホテル", title: "カプセルが並ぶ寝室・ロッカー・浴場・ラウンジ" },
      { key: "dormitory", label: "寮", title: "個室が並ぶ二階建て。食堂・大浴場・洗濯室" },
    ],
  },
  {
    label: "お店",
    templates: [
      { key: "cafe", label: "カフェ", title: "カウンターと客席、テラス席" },
      { key: "kissaten", label: "喫茶店", title: "レトロなソファ席とカウンター" },
      { key: "restaurant", label: "レストラン", title: "テーブル席・個室・厨房とワインセラー" },
      { key: "ramen", label: "ラーメン屋", title: "L字のカウンターと厨房、テーブル席" },
      { key: "sushi", label: "寿司屋", title: "つけ台のカウンター・座敷・厨房" },
      { key: "yakiniku", label: "焼肉店", title: "ロースター付きのテーブル席とレジ" },
      { key: "fastFood", label: "ファストフード", title: "カウンター・客席・厨房と駐車場" },
      { key: "izakaya", label: "居酒屋", title: "カウンター・座敷・個室と厨房" },
      { key: "bar", label: "バー", title: "カウンターとボックス席" },
      { key: "bakery", label: "パン屋", title: "パンの棚とショーケース、工房、イートイン" },
      { key: "florist", label: "花屋", title: "鉢植えと花の並ぶ売り場、作業場、店先の花壇" },
      { key: "dagashiya", label: "駄菓子屋", title: "駄菓子の棚と店番の茶の間、店先のベンチ" },
      { key: "supermarket", label: "スーパー", title: "陳列棚の並ぶ売り場・レジ・バックヤードと駐車場" },
      { key: "convenience", label: "コンビニ", title: "売り場・レジ・事務所と駐車場" },
      { key: "pharmacy", label: "薬局", title: "売り場・調剤室・待合" },
      { key: "boutique", label: "服屋", title: "洋服の棚・試着室・ストック" },
      { key: "bookstore", label: "本屋", title: "本棚の列・平台・レジとカフェ" },
      { key: "antiqueShop", label: "骨董屋", title: "古道具の並ぶ店と奥の間" },
      { key: "toyShop", label: "おもちゃ屋", title: "おもちゃの棚とレジ" },
      { key: "salon", label: "美容院", title: "鏡の前の席・シャンプー台・待合" },
      { key: "barber", label: "床屋", title: "理容椅子の並ぶ店と待合" },
      { key: "laundromat", label: "コインランドリー", title: "洗濯機の並ぶ小さな店" },
      { key: "gasStation", label: "ガソリンスタンド", title: "給油機の屋根と事務所" },
      { key: "arcade", label: "ゲームセンター", title: "ゲーム機が並ぶフロアと景品・両替" },
      { key: "karaoke", label: "カラオケ", title: "受付・ドリンクバーと個室4つ" },
      { key: "netCafe", label: "ネットカフェ", title: "受付・マンガの棚と個室ブース" },
    ],
  },
  {
    label: "学校・仕事場",
    templates: [
      { key: "school", label: "学校", title: "3階建て。教室・職員室・保健室・理科室・音楽室・図書室" },
      { key: "classroom", label: "教室", title: "黒板・教卓と30の机の教室と廊下" },
      { key: "lectureHall", label: "講義室", title: "壇上とホワイトボード、長机の並ぶ大学の講義室" },
      { key: "clubRoom", label: "部室", title: "長机とロッカー・ソファの文化部の部室" },
      { key: "schoolRooftop", label: "学校の屋上", title: "フェンスに囲まれた屋上と塔屋" },
      { key: "nursery", label: "保育園", title: "保育室・お昼寝の部屋・給食室と園庭" },
      { key: "library", label: "図書館", title: "本棚と閲覧席・書庫、2階に学習室と郷土資料室" },
      { key: "office", label: "オフィス", title: "執務室・会議室・社長室" },
      { key: "mangaStudio", label: "漫画家の仕事場", title: "作画机の並ぶ仕事場・資料室・仮眠室" },
      { key: "lab", label: "研究所", title: "実験室・資料室・サーバー室" },
    ],
  },
  {
    label: "公共・医療",
    templates: [
      { key: "hospital", label: "病院", title: "1階に待合・診察室・手術室、2階に病棟" },
      { key: "clinic", label: "診療所", title: "待合室・受付・診察室・処置室の町のお医者さん" },
      { key: "dentist", label: "歯医者", title: "診療台の並ぶ診療室・待合・受付・技工室" },
      { key: "vetClinic", label: "動物病院", title: "待合・診察室と、ケージの並ぶ入院室" },
      { key: "nursingHome", label: "老人ホーム", title: "食堂・機能訓練室・浴室と個室4つ、庭" },
      { key: "police", label: "警察署", title: "刑事課・取調室・留置場、2階に道場と会議室" },
      { key: "policeBox", label: "交番", title: "小さな交番。机と奥の休憩室" },
      { key: "fireStation", label: "消防署", title: "消防車の車庫・事務室・仮眠室" },
      { key: "cityHall", label: "市役所", title: "窓口・待合・会議室・市長室と前の広場" },
      { key: "postOffice", label: "郵便局", title: "窓口・事務室・仕分け室" },
      { key: "bank", label: "銀行", title: "ロビーと窓口・事務室・金庫室・応接室" },
      { key: "courtroom", label: "法廷", title: "裁判官席・証言台・傍聴席と控室" },
      { key: "prison", label: "刑務所", title: "独房の並ぶ廊下・看守室・食堂と運動場" },
      { key: "funeralHall", label: "葬儀場", title: "祭壇の式場・控室・受付" },
    ],
  },
  {
    label: "文化・娯楽",
    templates: [
      { key: "museum", label: "美術館", title: "展示室5つ・ショップ・2階にカフェと収蔵庫" },
      { key: "aquarium", label: "水族館", title: "大水槽・水槽の並ぶ通路・ショップ" },
      { key: "cinema", label: "映画館", title: "スクリーンと客席・ロビー・映写室" },
      { key: "theater", label: "劇場", title: "舞台と幕・客席・楽屋・ロビー" },
      { key: "concertHall", label: "コンサートホール", title: "ステージと客席、ホワイエ。丸い屋根" },
      { key: "danceStudio", label: "ダンススタジオ", title: "鏡とバーのスタジオ・更衣室・受付" },
      { key: "recordingStudio", label: "録音スタジオ", title: "ブース・コントロール室・ロビー" },
      { key: "observatory", label: "天文台", title: "丸い観測室と丸屋根" },
      { key: "church", label: "教会", title: "長椅子の並ぶ礼拝堂と、芝生の庭・墓地・外灯の小道" },
      { key: "weddingChapel", label: "結婚式場", title: "長椅子の並ぶ白いチャペルと控室、花壇の小道" },
      { key: "gymnasium", label: "体育館", title: "広いアリーナ・ステージ・更衣室・器具庫" },
      { key: "indoorPool", label: "屋内プール", title: "25mプールと更衣室・シャワー" },
      { key: "bathhouse", label: "銭湯", title: "男湯・女湯と番台" },
    ],
  },
  {
    label: "屋外・街",
    templates: [
      { key: "park", label: "公園", title: "遊び場・池・広場" },
      { key: "schoolGround", label: "校庭", title: "トラックのある校庭と遊具・体育倉庫・朝礼台" },
      { key: "shoppingStreet", label: "商店街", title: "アーケードに7軒の店が並ぶ通り" },
      { key: "intersection", label: "交差点", title: "十字路・角のコンビニ・バス停・電柱" },
      { key: "railroadCrossing", label: "踏切", title: "線路と道路の踏切、詰所" },
      { key: "station", label: "駅", title: "駅舎・駅員室・ホームと線路、駅前のバス停" },
      { key: "parkingLot", label: "駐車場", title: "車の並ぶ駐車場と管理室" },
      { key: "festival", label: "夏祭り", title: "参道に屋台が並ぶお祭り。鳥居と舞台" },
      { key: "beach", label: "海水浴場", title: "海の家・パラソル・ヤシの木と砂浜" },
      { key: "harbor", label: "港", title: "倉庫・事務所・岸壁と桟橋" },
      { key: "riverside", label: "河川敷", title: "広い川・土手の道・橋とボート小屋" },
      { key: "farm", label: "農家と田畑", title: "母屋と納屋、畑の畝と田んぼ" },
      { key: "zoo", label: "動物園", title: "ゾウ舎・サル山・ペンギン池と売店" },
      { key: "amusementPark", label: "遊園地", title: "園内を回る汽車の線路・お化け屋敷・噴水・ステージと売店" },
      { key: "cemetery", label: "霊園", title: "和型と洋型の墓が並ぶ霊園と管理棟" },
      { key: "campsite", label: "キャンプ場", title: "テント・タープ・焚き火・バンガローと川" },
    ],
  },
  {
    label: "乗り物",
    templates: [
      { key: "cruiseShip", label: "客船", title: "客室・レストラン・プールデッキ・操舵室" },
      { key: "sleeperTrain", label: "寝台列車", title: "個室の寝台車と食堂車の2両" },
      { key: "shinkansen", label: "新幹線", title: "2列と2列の座席が並ぶ客室とデッキ・トイレ" },
      { key: "busInterior", label: "バスの車内", title: "運転席と座席、前と中の扉" },
      { key: "airplaneCabin", label: "飛行機の機内", title: "客席・ギャレー・操縦室" },
      { key: "submarine", label: "潜水艦", title: "魚雷室・発令所・居住区・機関室" },
    ],
  },
  {
    label: "ファンタジー",
    templates: [
      { key: "castle", label: "城", title: "玉座の間・大広間・塔・兵舎、城壁と見張り台に囲まれた中庭、堀と跳ね橋。2階に王の寝室と礼拝室" },
      { key: "adventurersInn", label: "冒険者の宿", title: "酒場・暖炉・依頼の掲示板と2階の客室" },
      { key: "guildHall", label: "冒険者ギルド", title: "受付ホール・依頼の掲示板・ギルド長室" },
      { key: "weaponShop", label: "武器屋", title: "武器の棚とショーケース、倉庫" },
      { key: "blacksmith", label: "鍛冶屋", title: "炉と金床の鍛冶場、店先と井戸" },
      { key: "alchemistLab", label: "錬金術師の工房", title: "大釜と実験台の実験室、書庫" },
      { key: "magicSchool", label: "魔法学校", title: "魔法の教室と図書室、2階に寮" },
      { key: "wizardTower", label: "魔法使いの塔", title: "らせん階段でつながる書庫・研究室・寝室" },
      { key: "village", label: "村", title: "宿屋・道具屋・民家・教会と小道、川" },
      { key: "fort", label: "砦", title: "石壁に囲まれた兵舎・武器庫・見張り台" },
      { key: "colosseum", label: "闘技場", title: "丸い壁に囲まれた砂の闘技場と観客席" },
      { key: "demonCastle", label: "魔王城", title: "玉座の間・大広間・牢・宝物庫と赤い堀" },
      { key: "dungeon", label: "地下牢", title: "牢屋・大広間・武器庫・宝物庫のダンジョン" },
      { key: "labyrinth", label: "迷宮", title: "入り組んだ通路の先に宝箱" },
      { key: "dragonLair", label: "竜の巣", title: "財宝の積まれた洞窟と溶岩の川" },
      { key: "treehouse", label: "ツリーハウス", title: "木の上の小屋と根元の物置" },
    ],
  },
  {
    label: "SF・ホラー",
    templates: [
      { key: "spaceship", label: "宇宙船", title: "操縦室・居室・食堂・医務室・機関室" },
      { key: "spaceStation", label: "宇宙ステーション", title: "丸い司令室と居住・ドッキング・温室のモジュール" },
      { key: "secretBase", label: "秘密基地", title: "司令室・格納庫・研究室・仮眠室" },
      { key: "controlRoom", label: "管制室", title: "壁に並ぶモニターと机の列、サーバー室" },
      { key: "hauntedHouse", label: "幽霊屋敷", title: "荒れた広間・食堂・書斎と2階の子ども部屋" },
      { key: "abandonedHospital", label: "廃病院", title: "待合・診察室・手術室・霊安室" },
      { key: "abandonedSchool", label: "廃校", title: "荒れた教室・理科室・廊下" },
      { key: "factory", label: "廃工場", title: "作業場・倉庫・事務所" },
      { key: "sewer", label: "地下水道", title: "水路と通路、制御室" },
    ],
  },
];

type Raw = { id: string; type: string } & Record<string, unknown>;
type Surface = RoomSurface;
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
  tatami: "#dcd6a2",
  wood: "#d6b58a",
  tile: "#dfe7ea",
  stone: "#aeb3b1",
  darkStone: "#9a9c98",
  grass: "#83ab57",
  sand: "#eadcbc",
  gravel: "#c9c2b5",
  cobble: "#a29c92",
  asphalt: "#6a6d71",
  soil: "#a88a66",
  water: "#5f9fc6",
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
    // 円周上の建具は短い弦に置く。壁と床に同じ輪郭を使い、開口も通常の壁と同じ方法で抜く。
    roundRoom(name: string, cx: number, cy: number, r: number, color: string, surface: Surface, gaps: { angle: number; width: number; type: "door" | "window" }[]) {
      const openings = gaps.map(gap => ({ ...gap, a: gap.angle * Math.PI / 180, half: Math.asin(gap.width / (2 * r)) })).sort((a, b) => a.a - b.a);
      const point = (a: number): [number, number] => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      const points: [number, number][] = [];
      const segment = (a: [number, number], b: [number, number]) => entities.push({ id: newId("wall"), type: "wall", x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
      for (let i = 0; i < openings.length; i++) {
        const gap = openings[i], next = openings[(i + 1) % openings.length];
        const a = point(gap.a - gap.half), b = point(gap.a + gap.half);
        // 四方の建具を正確な水平・垂直にそろえる。
        if (gap.angle % 180 === 0) b[0] = a[0]; else b[1] = a[1];
        points.push(a, b);
        f[gap.type](a[0], a[1], b[0], b[1]);
        const start = gap.a + gap.half, end = next.a - next.half + (i === openings.length - 1 ? Math.PI * 2 : 0);
        // 大きな円は、床の輪郭の点の数（128まで）に収まるように弦を長くする
        const count = Math.ceil((end - start) * r / Math.max(32, r / 17));
        for (let step = 1; step < count; step++) points.push(point(start + (end - start) * step / count));
      }
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        segment(a, b);
      }
      entities.push({ ...roomData(name, cx - r, cy - r, r * 2, r * 2, color, surface), outline: points.map(([x, y]) => [(x - cx + r) / (2 * r), (y - cy + r) / (2 * r)]) });
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
    door(x1: number, y1: number, x2: number, y2: number, options: { flip?: boolean; sliding?: boolean; style?: DoorStyle } = {}) {
      const style = options.style ?? (options.sliding ? "sliding" : undefined);
      entities.push({
        id: newId("door"), type: "door", x1, y1, x2, y2,
        ...(options.flip ? { flip: true } : {}),
        ...(style && style !== "swing" ? { doorStyle: style } : {}),
      });
      return f;
    },
    sliding(x1: number, y1: number, x2: number, y2: number) {
      return f.door(x1, y1, x2, y2, { sliding: true });
    },
    // 和風の建具: 障子・襖・格子戸（玄関戸）・板戸
    shoji(x1: number, y1: number, x2: number, y2: number) {
      return f.door(x1, y1, x2, y2, { style: "shoji" });
    },
    fusuma(x1: number, y1: number, x2: number, y2: number) {
      return f.door(x1, y1, x2, y2, { style: "fusuma" });
    },
    koshi(x1: number, y1: number, x2: number, y2: number) {
      return f.door(x1, y1, x2, y2, { style: "koshi" });
    },
    itado(x1: number, y1: number, x2: number, y2: number) {
      return f.door(x1, y1, x2, y2, { style: "itado" });
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
    // 自由な形（free-shapes.ts）。池・花壇・芝生・ラグは囲む点、川・小道・生け垣・石垣・フェンス・竹垣・線路・飛び石はたどる点（cm）で置く
    // curve: 点を通るなめらかな線にする（自然な形の池など。点が少なくても角ばらない）
    trace(kind: string, points: [number, number][], options: { brush?: number; height?: number; color?: string; color3d?: string; curve?: boolean } = {}) {
      if (!sizes[kind] || !isFreeShapeKind(kind)) throw new Error(`Not a free shape: ${kind}`);
      const frame = freeFrame(options.curve ? curveThrough(points, isFreeAreaKind(kind), 30) : points, freeMargin(kind, options.brush));
      entities.push({
        id: newId("furniture"), type: "furniture", kind, ...frame, rotation: 0,
        ...(options.brush ? { brush: options.brush } : {}),
        ...(options.height ? { height: options.height } : {}),
        ...(options.color ? { color: options.color } : {}),
        ...(options.color3d ? { color3d: options.color3d } : {}),
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
    // elevation: 設置階の壁の上からの高さのずれ（cm）。重ねた屋根（五重塔・天守）や、低い下屋に使う
    roof(kind: RoofKind, x: number, y: number, w: number, h: number, floor: FloorBuilder, color?: string, options: { elevation?: number; rise?: number } = {}) {
      roofs.push({
        id: newId("roof"), type: "roof", kind, x, y, w, h, floorId: floor.id, ...(color ? { color } : {}),
        ...(options.elevation ? { elevation: options.elevation } : {}), ...(options.rise ? { rise: options.rise } : {}),
      });
    },
    plan(basements = 0): TemplatePlan {
      const plan = {
        // 最上階には上り階段を重ねない。下階からの到着側は2Dで自動表示する。
        floors: floors.map((floor, index) => ({ id: floor.id, name: "", entities: floors.length > 1 && index === floors.length - 1 ? floor.entities.filter((item) => !isStair(item)) : floor.entities })),
        activeFloor: basements,
        selectedId: null,
        roofs,
        ...(basements ? { basements } : {}),
      };
      openTemplateStairwells(plan.floors, () => newId("room"));
      return plan;
    },
  };
}

type PlanBuilder = ReturnType<typeof planBuilder>;

// ---- 住まい ----

function japaneseHouse(b: PlanBuilder): void {
  const f = b.floor();
  f.area("庭", 1260, 0, 640, 900, "grass", C.grass).label(20, 835)
    .room("台所", 0, 0, 270, 450, C.wood, "wood").label(60, 90)
    .room("茶の間", 270, 0, 450, 450, C.tatami, "tatami")
    .room("座敷", 720, 0, 450, 450, C.tatami, "tatami")
    .room("縁側", 1170, 0, 90, 900, C.wood, "wood")
    .room("土間", 0, 450, 270, 450, C.soil, "soil")
    .room("", 270, 450, 900, 90, C.wood, "wood")
    .room("洗面", 270, 540, 180, 180, C.tile, "tile")
    .room("風呂", 270, 720, 180, 180, C.tile, "tile")
    .room("便所", 450, 540, 90, 180, C.tile, "tile")
    .room("納戸", 450, 720, 90, 180, C.warm).label(10, 45)
    .room("寝室", 540, 540, 360, 360, C.tatami, "tatami").label(190, 15)
    .room("次の間", 900, 540, 270, 360, C.tatami, "tatami")
    .walls()
    .koshi(60, 900, 180, 900)
    .itado(90, 450, 180, 450)
    .shoji(270, 460, 270, 530)
    .shoji(270, 150, 270, 300)
    .fusuma(720, 100, 720, 350)
    .shoji(400, 450, 490, 450)
    .shoji(900, 450, 990, 450)
    .shoji(1170, 60, 1170, 390)
    .shoji(1170, 600, 1170, 840)
    .shoji(1170, 460, 1170, 530)
    .door(320, 540, 400, 540)
    .sliding(320, 720, 400, 720)
    .door(460, 540, 530, 540)
    .fusuma(540, 760, 540, 840)
    .fusuma(620, 540, 710, 540)
    .fusuma(900, 600, 900, 840)
    .fusuma(960, 540, 1050, 540)
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
    f.door(ux + 30, 600, ux + 110, 600, { flip: true })
      .door(ux + 60, 340, ux + 140, 340, { sliding: true })
      .door(ux + 190, 360, ux + 190, 430, { sliding: true })
      .window(ux + 50, 0, ux + 250, 0, true)
      .item("bed", ux + 190, 15)
      .item("desk", ux + 15, 15, { w: 100, h: 50 })
      .item("chair", ux + 43, 70, { rot: 180 })
      .item("table", ux + 60, 230, { w: 80, h: 50 })
      .item("kitchen", ux + 5, 370, { w: 170, h: 60, rot: 270 })
      .item("fridge", ux + 115, 525)
      .item("washer", ux + 205, 525)
      .item("toilet", ux + 235, 352)
      .item("shower", ux + 200, 432, { w: 90, h: 85 });
  };
  const first = b.floor();
  first.area("", 0, 720, 1020, 200, "stone", C.stone)
    .area("", 0, 600, 900, 120, "stone", C.stone)
    .area("", 900, 320, 120, 400, "stone", C.stone);
  [0, 300, 600].forEach((ux) => unit(first, ux));
  first.walls();
  [0, 300, 600].forEach((ux) => furnish(first, ux));
  first.item("stairs", 910, 320, { rot: 180 })
    .row("bicycle", 40, 760, 3, 200, 0, { rot: 90 })
    .row("mailbox", 700, 740, 3, 50, 0);
  const second = b.floor();
  // 階段の上は空け、上り切った所だけを外廊下につながる踊り場にする。
  second.area("", 0, 600, 900, 120, "stone", C.stone)
    .area("", 900, 600, 120, 120, "stone", C.stone);
  [0, 300, 600].forEach((ux) => unit(second, ux));
  second.walls();
  [0, 300, 600].forEach((ux) => furnish(second, ux));
  second.row("fence", 0, 702, 3, 300, 0, { w: 300, h: 15 })
    .item("fence", 900, 702, { w: 105, h: 15 })
    .item("fence", 1005, 600, { w: 120, h: 15, rot: 90 });
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
    .door(1000, 240, 1000, 360, { flip: true })
    .door(1000, 800, 1000, 890)
    .door(1250, 600, 1340, 600)
    .window(100, 0, 250, 0).window(350, 0, 500, 0).window(700, 0, 900, 0, true)
    .window(1100, 0, 1250, 0).window(1350, 0, 1500, 0)
    .window(1600, 150, 1600, 450, true).window(1600, 750, 1600, 950)
    .window(150, 1100, 450, 1100, true).window(1150, 1100, 1450, 1100)
    // 玄関ホール
    .item("stairsU", 650, 40, { w: 300, h: 300 })
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
    .item("plantLarge", 930, 520)
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
    .door(800, 500, 890, 500, { flip: true })
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
    .room("松", 400, 0, 300, 250, C.tatami, "tatami")
    .room("竹", 700, 0, 300, 250, C.tatami, "tatami")
    .room("", 400, 250, 600, 100, C.wood, "wood")
    .room("", 400, 350, 100, 300, C.wood, "wood")
    .room("", 900, 350, 100, 300, C.wood, "wood")
    .room("", 400, 650, 600, 100, C.wood, "wood")
    .room("中庭", 500, 350, 400, 300, C.grass, "grass")
    .room("梅", 1000, 0, 400, 500, C.tatami, "tatami")
    .room("宴会場", 1000, 500, 400, 500, C.tatami, "tatami")
    .room("", 400, 750, 200, 250, C.wood, "wood")
    .room("厨房", 600, 750, 400, 250, C.tile, "tile")
    .open(400, 350, 500, 350).open(900, 350, 1000, 350).open(400, 650, 500, 650).open(900, 650, 1000, 650)
    .open(410, 750, 590, 750)
    .walls()
    .koshi(120, 1000, 280, 1000)
    .shoji(400, 660, 400, 740)
    .sliding(400, 500, 400, 580)
    .sliding(150, 450, 250, 450)
    .fusuma(500, 250, 580, 250)
    .fusuma(800, 250, 880, 250)
    .fusuma(1000, 260, 1000, 340)
    .fusuma(1000, 660, 1000, 740)
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
    .item("table", 490, 70, { w: 120, h: 70 }).item("zaisu", 522, 5).item("zaisu", 522, 142, { rot: 180 }).item("tv", 610, 5, { w: 80, h: 35 })
    .item("table", 790, 70, { w: 120, h: 70 }).item("zaisu", 822, 5).item("zaisu", 822, 142, { rot: 180 }).item("tv", 910, 5, { w: 80, h: 35 })
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
  upper.room("桜", 0, 0, 400, 450, C.tatami, "tatami")
    .room("楓", 0, 450, 400, 210, C.tatami, "tatami")
    .room("萩", 0, 660, 400, 340, C.tatami, "tatami")
    .room("菊", 400, 0, 300, 250, C.tatami, "tatami")
    .room("椿", 700, 0, 300, 250, C.tatami, "tatami")
    .room("", 400, 250, 600, 100, C.wood, "wood")
    .room("", 400, 350, 100, 300, C.wood, "wood")
    .room("", 900, 350, 100, 300, C.wood, "wood")
    .room("", 400, 650, 600, 100, C.wood, "wood")
    .room("藤", 1000, 0, 400, 500, C.tatami, "tatami")
    .room("月", 1000, 500, 400, 500, C.tatami, "tatami")
    .room("", 400, 750, 200, 250, C.wood, "wood")
    .room("談話室", 600, 750, 400, 250, C.wood, "wood")
    .open(400, 350, 500, 350).open(900, 350, 1000, 350).open(400, 650, 500, 650).open(900, 650, 1000, 650)
    .open(410, 750, 590, 750)
    .walls()
    .fusuma(400, 260, 400, 340)
    .fusuma(400, 500, 400, 580)
    .fusuma(400, 665, 400, 745)
    .fusuma(500, 250, 580, 250)
    .fusuma(800, 250, 880, 250)
    .fusuma(1000, 260, 1000, 340)
    .fusuma(1000, 660, 1000, 740)
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
    .item("table", 490, 70, { w: 120, h: 70 }).item("zaisu", 522, 5).item("zaisu", 522, 142, { rot: 180 }).item("tv", 610, 5, { w: 80, h: 35 })
    .item("table", 790, 70, { w: 120, h: 70 }).item("zaisu", 822, 5).item("zaisu", 822, 142, { rot: 180 }).item("tv", 910, 5, { w: 80, h: 35 })
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
  b.roof("gable", -30, -30, 1060, 760, f, "#6d4c41");
}

function bar(b: PlanBuilder): void {
  const f = b.floor();
  f.room("客席", 0, 0, 600, 600, "#e9e2d6", "wood").label(20, 100)
    .room("厨房", 600, 0, 200, 300, C.tile, "tile")
    .room("トイレ", 600, 300, 200, 300, C.tile, "tile").label(90, 100)
    .walls()
    .door(60, 600, 160, 600)
    .door(600, 180, 600, 260, { flip: true })
    .door(600, 420, 600, 500)
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
  b.roof("flat", -20, -20, 840, 640, f, "#4a4f5a");
}

function convenience(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 800, 1200, 480, "asphalt", C.asphalt)
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
    f.item("displayShelf", 120, y, { w: 260, h: 80 }).item("displayShelf", 480, y, { w: 260, h: 80 });
  }
  f.item("shelf", 950, 100, { w: 200, h: 40, rot: 90 })
    .item("counter", 620, 650, { w: 260, h: 60 })
    .item("trashCan", 20, 820).item("trashCan", 70, 820)
    .item("vendingMachine", 1080, 820)
    .item("shelf", 1165, 220, { rot: 90 }).item("shelf", 1165, 320, { rot: 90 })
    .item("desk", 1020, 20)
    .item("officeChair", 1050, 85, { rot: 180 })
    .item("toilet", 1130, 715, { rot: 180 })
    .item("washbasin", 1020, 520)
    .item("car", 350, 830, { w: 170, h: 430 })
    .item("car", 600, 830, { w: 170, h: 430, symbol: 1 })
    .item("car", 850, 830, { w: 170, h: 430 })
    .row("bicycle", 60, 900, 2, 80, 0);
  b.roof("flat", -20, -20, 1240, 840, f, "#c9ced3");
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
      .item("examCouch", x + 300, 30, { w: 80, h: 190 })
      .item("washbasin", x + 300, 490, { rot: 180 });
  }
  f.row("shelf", 5, 250, 2, 0, 100, { rot: 270 })
    .row("shelf", 765, 250, 2, 0, 100, { rot: 90 })
    // 処置室
    .item("examCouch", 830, 30, { w: 80, h: 190 }).item("examCouch", 950, 30, { w: 80, h: 190 })
    .item("longTable", 1040, 30, { w: 140, h: 50 })
    .item("shelf", 1165, 250, { rot: 90 })
    .item("washbasin", 805, 380, { rot: 270 })
    .item("chair", 1000, 300);
  // 病室（4人部屋）
  for (const x of [1200, 1600]) {
    f.item("hospitalBed", x + 30, 20, { w: 90, h: 200 }).item("hospitalBed", x + 280, 20, { w: 90, h: 200 })
      .item("hospitalBed", x + 5, 300, { w: 90, h: 190, rot: 270 }).item("hospitalBed", x + 205, 300, { w: 90, h: 190, rot: 90 })
      .item("sideTable", x + 130, 30, { w: 40, h: 40 }).item("sideTable", x + 230, 30, { w: 40, h: 40 })
      .item("washbasin", x + 300, 490, { rot: 180 });
  }
  f.item("hospitalBed", 1530, 990, { w: 90, h: 200, rot: 180 }).item("hospitalBed", 1880, 990, { w: 90, h: 200, rot: 180 })
    .item("hospitalBed", 1505, 800, { w: 90, h: 190, rot: 270 }).item("hospitalBed", 1805, 800, { w: 90, h: 190, rot: 90 })
    .item("sideTable", 1630, 1140, { w: 40, h: 40 }).item("sideTable", 1830, 1140, { w: 40, h: 40 })
    // ナース室
    .item("longTable", 650, 720, { w: 300, h: 50 })
    .row("officeChair", 670, 780, 3, 100, 0, { rot: 180 })
    .item("desk", 640, 1100).item("desk", 800, 1100)
    .row("shelf", 605, 900, 2, 0, 100, { rot: 270 })
    .item("fridge", 920, 900)
    .item("longTable", 700, 920, { w: 160, h: 70 })
    // 手術室
    .item("examCouch", 1215, 850, { w: 70, h: 190 })
    .item("ivStand", 1150, 900)
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
    .item("wheelchair", 20, 1020)
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
      .item("hospitalBed", x + 30, 20, { w: 90, h: 200 }).item("hospitalBed", x + 280, 20, { w: 90, h: 200 })
      .item("hospitalBed", x + 5, 300, { w: 90, h: 190, rot: 270 }).item("hospitalBed", x + 205, 300, { w: 90, h: 190, rot: 90 })
      .item("sideTable", x + 130, 30, { w: 40, h: 40 }).item("sideTable", x + 230, 30, { w: 40, h: 40 })
      .item("washbasin", x + 300, 490, { rot: 180 });
  }
  for (const x of [1000, 1500]) {
    upper.item("hospitalBed", x + 30, 990, { w: 90, h: 200, rot: 180 }).item("hospitalBed", x + 380, 990, { w: 90, h: 200, rot: 180 })
      .item("hospitalBed", x + 5, 800, { w: 90, h: 190, rot: 270 }).item("hospitalBed", x + 305, 800, { w: 90, h: 190, rot: 90 })
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
      .item("blackboard", ox + 3, 120, { w: 360, h: 10, rot: 270 })
      .item("lectern", ox + 70, 240, { w: 120, h: 60, rot: 270 });
    // 生徒の机と椅子は、黒板のほう（左）を向く
    for (let c = 0; c < 6; c += 1) {
      for (let r = 0; r < 5; r += 1) f.item("schoolDesk", ox + 200 + c * 95, 60 + r * 100, { w: 62, h: 92, rot: 270 });
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
  f.sliding(100, 750, 180, 750).sliding(700, 750, 780, 750)
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
    .item("copier", 690, 1132)
    .item("locker", 560, 1145, { rot: 180 })
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
    .door(380, 700, 470, 700, { flip: true })
    .door(580, 700, 660, 700, { flip: true })
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
    .item("officeChair", 1135, 195, { rot: 270 }).item("officeChair", 1490, 195, { rot: 90 })
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
    .door(700, 800, 780, 800)
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
    .door(1000, 650, 1080, 650, { flip: true })
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
  // 教会の庭（芝生）
  f.area("", -400, -300, 1950, 2750, "grass", C.grass)
    .room("聖具室", 0, 0, 500, 400, C.warm).label(170, 10)
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
    .item("altar", 390, 450, { w: 220, h: 70 })
    .item("plantLarge", 300, 440).item("plantLarge", 640, 440)
    .item("piano", 60, 520)
    .row("bench", 60, 700, 8, 0, 110, { w: 320, h: 50, rot: 180 })
    .row("bench", 620, 700, 8, 0, 110, { w: 320, h: 50, rot: 180 })
    .item("wardrobe", 30, 10)
    .item("longTable", 250, 200, { w: 160, h: 60 })
    .item("desk", 560, 300)
    .item("chair", 598, 245)
    .item("shelf", 965, 60, { rot: 90 }).item("shelf", 965, 160, { rot: 90 })
    .item("armchair", 850, 200)
    // 入口から門までの小道と外灯
    .trace("pathway", [[500, 1810], [500, 2430]], { brush: 160 })
    .row("gardenLight", 380, 1950, 3, 0, 160).row("gardenLight", 590, 1950, 3, 0, 160)
    // 墓地（十字架の墓）と、まわりの生け垣
    .trace("hedge", [[1180, 520], [1500, 520], [1500, 1620], [1180, 1620]], { brush: 40, height: 100 });
  for (let row = 0; row < 5; row += 1) f.row("westernGrave", 1220, 600 + row * 200, 3, 85, 0);
  // 前の生け垣（門の所は開ける）、木とベンチ、花壇
  f.trace("hedge", [[-380, 2425], [400, 2425]], { brush: 50 })
    .trace("hedge", [[600, 2425], [1530, 2425]], { brush: 50 })
    .item("tree", -350, 100, { w: 260, h: 260 })
    .item("tree", -350, 1100, { w: 260, h: 260 })
    .item("conifer", 1200, 1850)
    .item("bench", -300, 1900, { w: 150, h: 55 })
    .trace("flowerBed", [[750, 1950], [960, 1920], [1050, 2030], [900, 2120], [740, 2080]], { curve: true });
  b.roof("gable", -40, 360, 1080, 1480, f);
  b.roof("flat", -40, -40, 1080, 440, f);
}

function shrine(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 1700, 2500, "gravel", C.gravel)
    .area("", 450, 750, 700, 150, "cobblestone", C.cobble)
    .area("", 680, 900, 240, 1600, "cobblestone", C.cobble)
    .area("手水舎", 250, 1190, 220, 220, "stone", C.stone)
    .room("本殿", 650, 100, 300, 260, C.wood, "wood")
    .room("", 760, 360, 80, 90, C.wood, "wood")
    .room("拝殿", 500, 450, 600, 300, C.wood, "wood")
    .room("神楽殿", 1230, 950, 340, 240, C.wood, "wood").label(20, 150)
    .room("社務所", 1150, 1300, 400, 350, C.wood, "wood").label(20, 110)
    .walls()
    .koshi(700, 750, 900, 750)
    .koshi(760, 360, 840, 360)
    .koshi(760, 450, 840, 450)
    .koshi(1230, 1020, 1230, 1120)
    .koshi(1150, 1450, 1150, 1530)
    .window(1200, 1650, 1500, 1650)
    .window(500, 520, 500, 680).window(1100, 520, 1100, 680)
    .window(1300, 950, 1500, 950)
    // 玉垣（低い石の垣）で拝殿・本殿の区画を囲む。参道の所は開ける
    .trace("stoneWall", [[640, 930], [430, 930], [430, 50], [1170, 50], [1170, 930], [960, 930]], { brush: 30, height: 80 })
    // 瑞垣（本殿を囲む木の垣）
    .trace("fence", [[740, 400], [625, 400], [625, 75], [975, 75], [975, 400], [860, 400]], { height: 120, color: "#8c3b2a" })
    .item("shoeCabinet", 520, 690, { w: 120, h: 50, color: "#7a4a2a" })
    .item("rug", 620, 500, { w: 360, h: 160, color: "#c9b27c" })
    .item("stage", 1340, 975, { w: 200, h: 110 })
    // 参道の石灯籠、二の鳥居、狛犬と賽銭箱
    .row("stoneLantern", 600, 950, 4, 0, 350)
    .row("stoneLantern", 940, 950, 4, 0, 350)
    .item("torii", 650, 1500, { w: 300, h: 50, height: 330 })
    .item("komainu", 600, 1120).item("komainu", 950, 1120)
    .item("saisenBako", 740, 800)
    // 鎮守の森と御神木
    .item("tree", 40, 40, { w: 280, h: 280 })
    .item("tree", 1280, 40, { w: 280, h: 280 })
    .item("tree", 40, 2100, { w: 280, h: 280 })
    .item("tree", 1250, 1950, { w: 380, h: 380 })
    .item("conifer", 1300, 500)
    .item("conifer", 150, 600)
    .item("conifer", 1250, 1720, { w: 150, h: 150 })
    .item("chozubachi", 300, 1290)
    // 池と岩
    .trace("pond", [[150, 1700], [300, 1640], [440, 1720], [430, 1880], [290, 1960], [140, 1880]], { curve: true })
    .item("rock", 330, 1500)
    .item("bench", 1180, 1680, { w: 150, h: 50 })
    .item("longTable", 1200, 1340, { w: 200, h: 50 })
    .item("desk", 1380, 1550)
    .row("shrub", 100, 1000, 3, 0, 150)
    // 入口の鳥居、由緒書きの看板、境内の端の生け垣
    .item("torii", 620, 2330)
    .item("signboard", 480, 2240)
    .trace("hedge", [[20, 2465], [560, 2465]], { brush: 50 })
    .trace("hedge", [[1040, 2465], [1680, 2465]], { brush: 50 });
  b.roof("gable", 620, 70, 360, 320, f, "#5e9c8b");
  b.roof("hip", 470, 420, 660, 360, f, "#5e9c8b");
  b.roof("hip", 1210, 930, 380, 280, f, "#5e9c8b");
  b.roof("gable", 1120, 1270, 460, 410, f);
  // 手水舎は柱だけの屋根（低めに）
  b.roof("gable", 235, 1175, 250, 250, f, "#5e9c8b", { elevation: -40 });
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
  upper.room("道場", 0, 0, 800, 600, C.tatami, "tatami")
    .room("会議室", 800, 0, 800, 600, C.cool)
    .room("更衣室", 0, 600, 300, 500, C.gray)
    .room("", 300, 600, 200, 500, C.gray)
    .room("", 500, 600, 1100, 150, C.gray)
    .room("休憩室", 500, 750, 500, 350, C.tatami, "tatami")
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
    .koshi(520, 1000, 680, 1000)
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
    .area("遊び場", 100, 100, 700, 420, "sand", C.sand).label(20, 330)
    .area("広場", 1150, 850, 750, 450, "stone", C.stone).label(20, 110)
    .room("トイレ", 120, 880, 300, 260, C.tile, "tile").label(10, 200)
    .walls()
    .door(220, 1140, 300, 1140, { flip: true })
    .row("swing", 150, 150, 2, 250, 0)
    .item("jungleGym", 640, 130, { w: 140, h: 140, height: 180 })
    .item("slide", 270, 330, { w: 50, h: 300, rot: 90 })
    .item("sandbox", 110, 300, { w: 150, h: 100 })
    .item("bench", 600, 420, { w: 150, h: 50 })
    .item("pond", 1250, 150, { w: 500, h: 300 })
    .item("rock", 1220, 470)
    .item("tree", 1720, 120, { w: 260, h: 260 })
    .item("tree", 560, 980, { w: 280, h: 280 })
    .item("conifer", 1500, 1150, { w: 140, h: 140 })
    .row("flowerBed", 700, 540, 2, 400, 0)
    .item("flowerBed", 700, 760)
    .row("gardenLight", 860, 560, 2, 200, 0)
    .row("gardenLight", 860, 760, 2, 200, 0)
    .row("bench", 1200, 900, 2, 300, 0, { w: 150, h: 50 })
    .item("bench", 1200, 1220, { w: 150, h: 50, rot: 180 })
    .item("trashCan", 1820, 870)
    .item("fountain", 1600, 1000, { w: 200, h: 200 })
    .item("vendingMachine", 440, 880)
    .row("bicycle", 30, 1250, 2, 200, 0, { rot: 90 })
    .item("toilet", 160, 920)
    .item("toilet", 240, 920)
    .item("washbasin", 330, 920, { w: 60, h: 45 })
    .row("shrub", 1100, 40, 2, 0, 200, { rot: 90 });
  b.roof("gable", 100, 860, 340, 300, f, "#7a5a3a");
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
    .item("brazier", 820, 1120, { w: 60, h: 60 }).item("brazier", 820, 1320, { w: 60, h: 60 })
    .item("rug", 940, 100, { w: 120, h: 480, color: "#7a1e1e" })
    .item("longTable", 850, 250, { w: 300, h: 90 })
    .item("throne", 955, 20, { w: 90, h: 80 })
    .item("brazier", 670, 20, { w: 60, h: 60 }).item("brazier", 1270, 20, { w: 60, h: 60 }).item("brazier", 670, 500, { w: 60, h: 60 }).item("brazier", 1270, 500, { w: 60, h: 60 })
    .row("futon", 20, 20, 3, 200, 0, { w: 80, h: 180, color: "#b9a77d" })
    .row("trashCan", 20, 20, 3, 200, 0)
    .item("desk", 250, 450)
    .item("chair", 288, 395)
    .item("brazier", 20, 520, { w: 60, h: 60 })
    .row("shelf", 5, 750, 3, 0, 100, { rot: 270 })
    .item("longTable", 150, 900, { w: 250, h: 80 })
    .item("wardrobe", 360, 1050, { rot: 180 })
    .row("barrel", 420, 760, 2, 0, 70)
    .item("crate", 240, 1000)
    .row("treasureChest", 1450, 30, 4, 100, 0, { w: 70, h: 45 })
    .item("rug", 1500, 200, { w: 300, h: 200, color: "#c9a227" })
    .item("brazier", 1420, 520, { w: 60, h: 60 })
    .row("shelf", 1470, 800, 3, 0, 100, { w: 360, h: 35 })
    .item("rock", 500, 620, { w: 60, h: 45 })
    .item("rock", 1250, 640, { w: 60, h: 45, symbol: 1 });
  b.roof("flat", -20, -20, 1940, 1440, f, "#3a3530");
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
  top.room("寝室", 0, 0, 500, 280, C.wood, "wood")
    .room("", 0, 280, 500, 100, C.wood, "wood")
    .room("洋室", 0, 380, 300, 380, C.wood, "wood")
    .room("", 300, 380, 200, 380, C.wood, "wood")
    .room("納戸", 0, 760, 500, 240, C.warm)
    .open(300, 380, 500, 380)
    .walls()
    .door(320, 280, 400, 280)
    .door(300, 600, 300, 680)
    .door(320, 760, 400, 760)
    .window(60, 0, 440, 0, true).window(0, 450, 0, 700).window(500, 100, 500, 300)
    .item("stairs", 390, 380)
    .item("bedDouble", 180, 20)
    .item("sideTable", 120, 30)
    .item("sideTable", 330, 30)
    .item("wardrobe", 30, 230, { rot: 180 })
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
    .door(300, 430, 300, 510, { flip: true })
    .door(160, 420, 160, 500)
    .door(450, 380, 450, 450)
    .door(620, 350, 700, 350, { flip: true })
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
    .item("bedSemiDouble", 660, 100)
    .item("wardrobe", 460, 305, { rot: 180 })
    // 玄関・水回り・納戸
    .item("shoeCabinet", 300, 60, { rot: 270 })
    .item("bath", 0, 520)
    .item("shower", 25, 410)
    .item("washbasin", 190, 545, { rot: 180 })
    .item("washer", 235, 355)
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
  b.roof("flat", -20, -20, 840, 1140, f, "#9aa1a8");
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
    .room("土間", 0, 0, 400, 540, C.soil, "soil")
    .room("囲炉裏の間", 400, 0, 400, 450, C.wood, "wood")
    .room("座敷", 800, 0, 450, 450, C.tatami, "tatami")
    .room("奥座敷", 1250, 0, 450, 450, C.tatami, "tatami")
    .room("縁側", 400, 450, 1500, 90, C.wood, "wood")
    .room("風呂", 1700, 0, 200, 250, C.tile, "tile")
    .room("便所", 1700, 250, 200, 200, C.tile, "tile")
    .room("蔵", 1450, 650, 350, 300, C.darkStone, "stone").label(20, 120)
    .open(400, 60, 400, 400)
    .walls()
    .itado(80, 540, 280, 540)
    .itado(400, 470, 400, 520)
    .fusuma(800, 100, 800, 350)
    .fusuma(1250, 100, 1250, 350)
    .shoji(450, 450, 750, 450)
    .shoji(850, 450, 1200, 450)
    .shoji(1300, 450, 1650, 450)
    .door(1740, 450, 1820, 450)
    .door(1740, 250, 1820, 250, { flip: true })
    .door(1580, 950, 1670, 950)
    .window(0, 100, 0, 300)
    .window(450, 0, 750, 0, true).window(880, 0, 1170, 0).window(1330, 0, 1620, 0)
    .window(450, 540, 1000, 540, true).window(1100, 540, 1650, 540, true)
    .window(1900, 60, 1900, 190)
    // 土間（かまど・作業台）
    .item("kamado", 0, 120, { rot: 270 })
    .item("cupboard", 200, 5)
    .item("longTable", 120, 380, { color: "#8a6a4a" })
    .item("bicycle", 320, 280)
    // 囲炉裏の間・座敷・奥座敷
    .item("irori", 540, 190, { w: 120, h: 120 })
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
    .item("bath", 1720, 100)
    .item("toilet", 1840, 260)
    // 庭と蔵
    .item("tree", 60, 700)
    .item("pond", 450, 760)
    .item("stoneLantern", 820, 680)
    .item("rock", 1180, 620)
    .item("ido", 1250, 780)
    .item("shrub", 1050, 990)
    .row("shelf", 1480, 655, 3, 100, 0)
    .item("wardrobe", 1755, 760, { rot: 90 });
  b.roof("hip", -40, -40, 1980, 620, f);
  b.roof("gable", 1420, 620, 410, 360, f);
}

// ---- 屋敷・宿（つづき） ----

function samuraiHouse(b: PlanBuilder): void {
  const f = b.floor();
  // 屋敷の敷地（白い土塀の内側）
  f.area("", -200, -200, 2100, 1560, "gravel", C.gravel)
    .area("庭", 0, 590, 1700, 610, "grass", C.grass)
    // 枯山水（白い砂利と岩）
    .area("", 1120, 660, 480, 300, "gravel", "#e3ddd0")
    .room("台所", 0, 0, 300, 300, C.wood, "wood").label(80, 110)
    .room("玄関", 0, 300, 300, 290, C.stone, "stone")
    .room("広間", 300, 0, 600, 500, C.tatami, "tatami")
    .room("書院", 900, 0, 450, 500, C.tatami, "tatami")
    .room("茶室", 1350, 0, 300, 300, C.tatami, "tatami")
    .room("水屋", 1350, 300, 300, 200, C.wood, "wood")
    .room("縁側", 300, 500, 1350, 90, C.wood, "wood")
    // 表門（土塀の門）
    .room("表門", -200, 380, 100, 160, C.wood, "wood").label(10, 60)
    .open(300, 500, 300, 590)
    .open(300, 590, 1650, 590)
    .walls()
    .koshi(0, 380, 0, 520)
    .itado(60, 300, 200, 300)
    .door(-200, 400, -200, 520, { style: "gate" })
    .door(-100, 400, -100, 520, { style: "gate", flip: true })
    .fusuma(300, 80, 300, 220)
    .fusuma(300, 330, 300, 470)
    .fusuma(900, 80, 900, 420)
    .shoji(1350, 80, 1350, 220)
    .fusuma(1400, 300, 1500, 300)
    .shoji(350, 500, 850, 500)
    .shoji(950, 500, 1300, 500)
    .shoji(1400, 500, 1600, 500)
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
    .item("washbasin", 1575, 445, { rot: 180 })
    // 庭: 自然な形の池、縁側から池への飛び石、石灯籠、松、枯山水の岩
    .trace("pond", [[470, 770], [680, 700], [900, 760], [930, 900], [780, 1010], [560, 990], [450, 890]], { curve: true })
    .trace("steppingStones", [[330, 640], [360, 760], [420, 900], [470, 1060]])
    .item("stoneLantern", 960, 680)
    .item("stoneLantern", 300, 1080)
    .item("tsukubai", 1000, 980)
    .item("rock", 1200, 720)
    .item("rock", 1420, 840, { symbol: 1 })
    .item("conifer", 60, 900)
    .item("conifer", 1500, 1020, { w: 160, h: 160 })
    .item("tree", 1180, 1000, { w: 200, h: 180 })
    .item("shrub", 1020, 1090)
    // 白い土塀で敷地を囲む。表門の所は開ける
    .trace("stoneWall", [[-150, 540], [-150, 1310], [1850, 1310], [1850, -150], [-150, -150], [-150, 380]], { brush: 40, height: 220, color3d: "#efe9da" });
  b.roof("hip", -40, -40, 1730, 670, f);
  b.roof("gable", -230, 360, 160, 200, f, "#3f4549");
}

function dormitory(b: PlanBuilder): void {
  const ground = b.floor();
  ground.room("洗濯室", 0, 0, 250, 300, C.tile, "tile").label(20, 150)
    .room("玄関", 0, 300, 250, 220, C.stone, "stone")
    .room("食堂", 250, 0, 550, 400, C.wood, "wood")
    .room("厨房", 800, 0, 300, 400, C.tile, "tile")
    .room("大浴場", 1100, 0, 500, 400, C.tile, "tile")
    .room("", 250, 400, 1350, 120, C.wood, "wood")
    .room("管理人室", 0, 520, 250, 280, C.tatami, "tatami").label(10, 80)
    .room("101", 250, 520, 450, 280, C.wood, "wood")
    .room("102", 700, 520, 450, 280, C.wood, "wood")
    .room("103", 1150, 520, 450, 280, C.wood, "wood")
    .open(250, 400, 250, 520)
    .walls()
    .door(0, 380, 0, 470)
    .door(80, 300, 170, 300)
    .door(100, 520, 180, 520)
    .door(720, 400, 800, 400, { flip: true })
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
  b.roof("hip", -30, -30, 1360, 960, f, "#5a6670");
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
  b.roof("gable", -30, -30, 860, 760, f, "#3f4549");
}

function izakaya(b: PlanBuilder): void {
  const f = b.floor();
  f.room("客席", 0, 0, 650, 550, C.wood, "wood")
    .room("厨房", 650, 0, 350, 550, C.tile, "tile")
    .room("トイレ", 0, 550, 150, 300, C.tile, "tile").label(20, 120)
    .room("座敷", 150, 550, 400, 300, C.tatami, "tatami")
    .room("個室", 550, 550, 300, 300, C.tatami, "tatami")
    .room("倉庫", 850, 550, 150, 300, C.warm).label(10, 120)
    .open(650, 60, 650, 490)
    .walls()
    .koshi(60, 0, 200, 0)
    .door(30, 550, 110, 550)
    .shoji(200, 550, 500, 550)
    .fusuma(570, 550, 640, 550)
    .door(880, 550, 960, 550)
    .window(0, 100, 0, 450).window(300, 0, 600, 0).window(1000, 100, 1000, 450)
    // カウンター
    .item("counter", 600, 65, { w: 420, h: 50, rot: 270 })
    .row("barStool", 545, 80, 6, 0, 68)
    .item("chochin", 215, 10).item("chochin", 10, 60)
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
  b.roof("gable", -30, -30, 1060, 910, f, "#3f4549");
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
  b.roof("flat", -20, -20, 840, 470, f, "#c9ced3");
  b.roof("flat", 330, 450, 490, 220, f, "#c9ced3");
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
  b.roof("gable", -30, -30, 1260, 860, f, "#5a6670");
}

// ---- 施設（つづき） ----

function nursery(b: PlanBuilder): void {
  const f = b.floor();
  f.area("園庭", 0, -550, 1100, 550, "sand", C.sand)
    .room("保育室", 0, 0, 700, 500, C.wood, "wood")
    .room("お昼寝室", 700, 0, 400, 500, C.tatami, "tatami")
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
    .row("shelf", 10, 100, 3, 0, 95, { rot: 90 })
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
    .item("slide", 380, -400, { w: 50, h: 300, rot: 90 })
    .item("sandbox", 100, -280, { w: 160, h: 160 })
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
    .door(1650, 1500, 1730, 1500, { flip: true })
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
    .room("休憩室", 300, 0, 200, 250, C.tatami, "tatami")
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
    .item("coatStand", 20, 330)
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
    .item("blackboard", 150, 15, { w: 900, h: 10, color: "#f2f1ec", height: 240 })
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
  f.area("", 0, 0, 2000, 2300, "gravel", C.gravel)
    .area("", 950, 650, 100, 1300, "cobblestone", C.cobble)
    .area("墓地", 100, 950, 750, 600, "stone", C.stone)
    .area("鐘楼", 300, 250, 220, 220, "wood", C.wood)
    .room("本堂", 650, 150, 700, 500, C.wood, "wood")
    .room("庫裏", 1450, 150, 450, 500, C.tatami, "tatami")
    .room("五重塔", 1500, 1000, 260, 260, C.wood, "wood").label(10, 200)
    .room("山門", 850, 1950, 300, 200, C.wood, "wood").label(20, 120)
    .walls()
    .shoji(750, 650, 1250, 650)
    .door(1500, 650, 1590, 650)
    .door(1580, 1000, 1680, 1000, { style: "itado" })
    .door(900, 1950, 1100, 1950, { style: "gate" })
    .door(900, 2150, 1100, 2150, { style: "gate", flip: true })
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
    // 山門の仁王像
    .item("statue", 855, 1965, { w: 50, h: 50, height: 240 })
    .item("statue", 1095, 1965, { w: 50, h: 50, height: 240 })
    // 鐘楼・墓地・境内
    .item("roundTable", 360, 330, { w: 100, h: 100, color: "#8a6a3a" })
    .item("saisenBako", 940, 700)
    .item("conifer", 60, 500)
    .item("conifer", 1720, 1700)
    .item("tree", 1300, 1500, { w: 260, h: 260 })
    .row("stoneLantern", 870, 760, 4, 0, 300)
    .row("stoneLantern", 1070, 760, 4, 0, 300)
    // 墓地を囲む生け垣（参道の側を開ける）
    .trace("hedge", [[850, 1575], [75, 1575], [75, 925], [850, 925]], { brush: 30, height: 90 })
    // 庫裏の前の池と飛び石
    .trace("pond", [[1520, 720], [1700, 690], [1880, 740], [1870, 880], [1700, 920], [1540, 880]], { curve: true })
    .trace("steppingStones", [[1150, 700], [1300, 760], [1470, 800]])
    // 五重塔の芯（重ねた屋根の間に見える、黒っぽい木の塔身）
    .trace("stoneWall", [[1590, 1090], [1670, 1090], [1670, 1170], [1590, 1170], [1590, 1090]], { brush: 30, height: 820, color3d: "#5a3a26" })
    // 境内を囲む築地塀（白い土塀と瓦の笠）。山門の所は開ける
    .trace("stoneWall", [[840, 2060], [20, 2060], [20, 20], [1980, 20], [1980, 2060], [1160, 2060]], { brush: 40, height: 220, color3d: "#efe9da" });
  for (let r = 0; r < 4; r += 1) f.row("grave", 160, 1050 + r * 120, 8, 80, 0, { w: 60, h: 70 });
  b.roof("hip", 620, 120, 760, 560, f);
  b.roof("gable", 1420, 120, 510, 560, f);
  b.roof("hip", 280, 230, 260, 260, f);
  // 五重塔: 屋根を少しずつ小さくして5つ重ねる
  for (let tier = 0; tier < 5; tier += 1) {
    const size = 400 - tier * 34;
    b.roof("hip", 1630 - size / 2, 1130 - size / 2, size, size, f, "#3f4549", { elevation: tier * 125 });
  }
  // 山門: 二重の屋根
  b.roof("hip", 820, 1920, 360, 260, f, "#3f4549");
  b.roof("hip", 850, 1940, 300, 220, f, "#3f4549", { elevation: 100 });
}

// ---- 屋外・乗り物（つづき） ----

function campsite(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 2000, 1400, "grass", C.grass)
    .area("川", 0, 1250, 2000, 150, "water", C.water)
    .area("駐車場", 0, 0, 500, 600, "gravel", C.gravel)
    .area("炊事場", 800, 100, 400, 300, "concrete", C.stone)
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
    .item("tent", 650, 650, { w: 220, h: 200, color: "#e07b39" })
    .item("tent", 950, 650, { w: 220, h: 200, color: "#3f8f6b" })
    .item("tent", 1250, 650, { w: 220, h: 200, color: "#d9b23f" })
    .item("parasol", 600, 950)
    .item("longTable", 630, 1040)
    .item("bench", 630, 990, { w: 180, h: 40 })
    .item("bench", 630, 1105, { w: 180, h: 40 })
    .item("campfire", 1000, 1000, { w: 110, h: 110 })
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
  f.area("プールデッキ", -500, 0, 800, 740, "deck", C.wood)
    .area("プール", -420, 170, 360, 400, "water", "#6fb6dc")
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
  b.roof("flat", 280, -20, 1870, 780, f, "#e8eaee");
  b.roof("flat", 2150, 150, 320, 440, f, "#e8eaee");
}

function sleeperTrain(b: PlanBuilder): void {
  const f = b.floor();
  // 1両目: 個室の寝台が7つと、トイレ・通路
  for (let i = 0; i < 7; i += 1) {
    const x = i * 250;
    f.room(`${i + 1}号室`, x, 0, 250, 200, C.cream).label(10, 140);
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
    .door(1800, 200, 1880, 200, { flip: true })
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
    f.item("bed", x + 25, 10, { rot: 90 })
      .sliding(x + 60, 200, x + 190, 200)
      .window(x + 40, 0, x + 210, 0);
  }
  for (let i = 0; i < 5; i += 1) {
    const x = 40 + i * 230;
    f.item("table", x + 60, 410, { w: 70, h: 70 }).item("chair", x + 10, 422, { rot: 270 }).item("chair", x + 135, 422, { rot: 90 })
      .item("table", x + 60, 620, { w: 70, h: 70 }).item("chair", x + 10, 632, { rot: 270 }).item("chair", x + 135, 632, { rot: 90 });
  }
  b.roof("flat", -10, -10, 2020, 320, f, "#3b4a7a");
  b.roof("flat", -10, 390, 2020, 320, f, "#3b4a7a");
}

// ---- ファンタジー・SF ----

function castle(b: PlanBuilder): void {
  const inset = 300 - Math.sqrt(300 ** 2 - 50 ** 2);
  const towers = (floor: FloorBuilder, lowerDoors: boolean) => {
    floor.roundRoom("北西の塔", 200, 300, 300, C.darkStone, "stone", [
      { angle: 0, width: 100, type: "door" }, { angle: 180, width: 150, type: "window" },
      ...(lowerDoors ? [{ angle: 90, width: 100, type: "door" as const }] : []),
    ]).label(180, 90)
      .roundRoom("北東の塔", 1800, 300, 300, C.darkStone, "stone", [
        { angle: 180, width: 100, type: "door" }, { angle: 0, width: 150, type: "window" },
        ...(lowerDoors ? [{ angle: 90, width: 100, type: "door" as const }] : []),
      ]).label(180, 90)
      .area("", 500 - inset, 250, inset, 100, "stone", C.darkStone)
      .area("", 1500, 250, inset, 100, "stone", C.darkStone)
      .open(500, 250, 500, 350).open(1500, 250, 1500, 350);
    if (lowerDoors) floor.area("", 150, 600 - inset, 100, inset, "stone", C.darkStone)
      .area("", 1750, 600 - inset, 100, inset, "stone", C.darkStone)
      .open(150, 600, 250, 600).open(1750, 600, 1850, 600);
  };
  const f = b.floor();
  // 城のまわりの野原。堀と跳ね橋、その先の道まで
  f.area("", -500, -500, 3000, 3450, "grass", C.grass);
  towers(f, true);
  f.area("中庭", 0, 1300, 2000, 1000, "gravel", C.gravel).label(240, 40)
    .room("玉座の間", 500, 0, 1000, 800, C.stone, "stone").label(60, 650)
    .room("兵舎", 0, 600, 500, 700, C.wood, "wood")
    .room("大広間", 500, 800, 1000, 500, C.wood, "wood").label(20, 300)
    .room("厨房", 1500, 600, 500, 700, C.stone, "stone")
    .room("城門", 900, 1300, 200, 200, C.darkStone, "stone").label(10, 20)
    // 外の城門（門楼）。両側に城壁が続く
    .room("", 880, 2180, 240, 160, C.darkStone, "stone")
    .walls()
    .door(950, 800, 1050, 800)
    .door(500, 1000, 500, 1100).door(1500, 1000, 1500, 1100)
    .door(950, 1300, 1050, 1300)
    .sliding(920, 1500, 1080, 1500)
    .door(900, 2180, 1100, 2180, { style: "gate" })
    .door(900, 2340, 1100, 2340, { style: "gate", flip: true })
    .window(700, 0, 1300, 0, true)
    .window(0, 800, 0, 1100).window(2000, 1150, 2000, 1250);
  // 中庭の前の角の見張り台（丸い小塔）
  f.roundRoom("", 90, 2210, 140, C.darkStone, "stone", [{ angle: 0, width: 80, type: "door" }, { angle: 90, width: 60, type: "window" }])
    .roundRoom("", 1910, 2210, 140, C.darkStone, "stone", [{ angle: 180, width: 80, type: "door" }, { angle: 90, width: 60, type: "window" }])
    // 中庭を囲む城壁（高さ4.5m）
    .trace("stoneWall", [[45, 1300], [45, 2070]], { brush: 90, height: 450 })
    .trace("stoneWall", [[230, 2255], [880, 2255]], { brush: 90, height: 450 })
    .trace("stoneWall", [[1120, 2255], [1770, 2255]], { brush: 90, height: 450 })
    .trace("stoneWall", [[1955, 1300], [1955, 2070]], { brush: 90, height: 450 })
    // 城を囲む堀。道すじの始めと終わりを重ねて、ひと回りにする
    .trace("river", [[1000, -330], [2330, -330], [2330, 2580], [-330, 2580], [-330, -330], [1060, -330]], { brush: 220 })
    // 堀を渡る跳ね橋と、門から城門までの石畳の道
    .trace("pathway", [[1000, 2350], [1000, 2930]], { brush: 220 })
    .trace("pathway", [[1000, 2170], [1000, 1620]], { brush: 200 })
    // 塔（らせん階段）
    .item("stairsSpiral", 180, 230).item("floorLamp", 60, 500)
    .item("stairsSpiral", 1680, 230).item("floorLamp", 1895, 500)
    // 玉座の間
    .item("rug", 920, 120, { w: 160, h: 640, color: "#8e1f2a" })
    .item("throne", 945, 15, { w: 110, h: 100 })
    .item("armchair", 790, 40, { color: "#8e1f2a" })
    .item("armchair", 1130, 40, { color: "#8e1f2a" })
    .item("brazier", 700, 200).item("brazier", 1255, 200).item("brazier", 700, 550).item("brazier", 1255, 550)
    // 兵舎
    .item("longTable", 160, 720)
    .row("stool", 175, 785, 4, 45, 0)
    .row("bunkBed", 30, 900, 3, 115, 0)
    // 大広間
    .item("longTable", 700, 950, { w: 600, h: 80 })
    .row("chair", 720, 900, 10, 58, 0)
    .row("chair", 720, 1035, 10, 58, 0, { rot: 180 })
    .item("fireplace", 1200, 800)
    // 厨房
    .item("kitchen", 1935, 700, { rot: 90 })
    .item("longTable", 1600, 900, { w: 200, h: 70 })
    .row("roundTable", 1530, 1180, 3, 70, 0, { w: 60, h: 60, color: "#8a5a2b" })
    // 中庭: 井戸・石像・篝火・樽と木箱・木
    .item("ido", 300, 1750)
    .item("statue", 1480, 1800)
    .item("brazier", 820, 2100).item("brazier", 1130, 2100)
    .item("brazier", 870, 1560).item("brazier", 1080, 1560)
    .row("barrel", 160, 1980, 3, 65, 0).item("crate", 160, 2050).item("crate", 240, 2050)
    .item("pond", 600, 1450, { w: 120, h: 120, color: "#6f8fa6" })
    .item("tree", 1600, 1350, { w: 220, h: 220 })
    .item("shrub", 1250, 1550)
    // 堀の外、道の両側の木
    .item("conifer", 300, 2740).item("conifer", 1550, 2740).item("tree", 2100, 2710, { w: 240, h: 240 }).item("tree", -380, 2710, { w: 240, h: 240 });
  // 2階の下にならない兵舎・大広間・厨房の屋根と、城門・門楼・見張り台の屋根
  b.roof("flat", -30, 600, 2060, 730, f);
  b.roof("hip", 880, 1280, 240, 240, f);
  b.roof("hip", 860, 2160, 280, 200, f);
  b.roof("cone", -60, 2060, 300, 300, f);
  b.roof("cone", 1760, 2060, 300, 300, f);

  // 2階: 塔と、王の寝室・礼拝室
  const upper = b.floor();
  towers(upper, false);
  upper.room("王の寝室", 500, 0, 500, 600, C.wood, "wood")
    .room("礼拝室", 1000, 0, 500, 600, C.stone, "stone").label(60, 500)
    .walls()
    .door(1000, 250, 1000, 350)
    .window(600, 0, 900, 0, true).window(1100, 0, 1400, 0, true).window(600, 600, 900, 600, true).window(1100, 600, 1400, 600, true)
    .item("stairsSpiral", 180, 230).item("floorLamp", 60, 500)
    .item("stairsSpiral", 1680, 230).item("floorLamp", 1895, 500)
    .item("bedDouble", 660, 100, { w: 180, h: 220, color: "#8e1f2a" })
    .item("sideTable", 600, 100).item("sideTable", 850, 100)
    .item("rug", 600, 340, { w: 300, h: 180, color: "#8e1f2a" })
    .item("fireplace", 955, 380, { rot: 90 })
    .item("wardrobe", 500, 420, { rot: 270 })
    .item("cupboard", 1250, 10, { w: 200, h: 50, color: "#c9a227" })
    .item("floorLamp", 1190, 15).item("floorLamp", 1455, 15)
    .row("bench", 1100, 220, 3, 0, 110, { w: 300, h: 50 });
  b.roof("cone", -130, -30, 660, 660, upper);
  b.roof("cone", 1470, -30, 660, 660, upper);
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
  const windows = [{ angle: 0, width: 150, type: "window" as const }, { angle: 180, width: 150, type: "window" as const }, { angle: 270, width: 150, type: "window" as const }];
  const ground = b.floor();
  ground.roundRoom("書庫", 400, 400, 400, C.wood, "wood", [...windows, { angle: 90, width: 100, type: "door" }]).label(230, 140)
    .item("stairsSpiral", 510, 430)
    .row("shelf", 110, 230, 3, 0, 100, { rot: 270 })
    .row("shelf", 230, 90, 4, 100, 0)
    .item("rug", 220, 280, { w: 260, h: 200, color: "#5b3a6b" })
    .item("desk", 250, 300, { w: 140, h: 70 })
    .item("armchair", 280, 375, { rot: 180 })
    .item("floorLamp", 430, 290);

  const middle = b.floor();
  middle.roundRoom("研究室", 400, 400, 400, C.darkStone, "stone", [...windows, { angle: 90, width: 150, type: "window" }]).label(230, 130)
    .item("stairsSpiral", 510, 430)
    .item("longTable", 190, 220, { w: 300, h: 80 })
    .item("roundTable", 220, 420, { w: 100, h: 100, color: "#2f3436" })
    .item("aquarium", 490, 120, { color: "#7fd1b9" })
    .row("shelf", 100, 340, 2, 0, 100, { rot: 270 })
    .item("fireplace", 670, 250, { rot: 90 })
    .item("catTower", 400, 360);

  const top = b.floor();
  top.roundRoom("寝室・星見台", 400, 400, 400, C.wood, "wood", [...windows, { angle: 90, width: 150, type: "window" }]).label(220, 120)
    .item("bed", 190, 210)
    .item("wardrobe", 110, 450, { rot: 270 })
    .item("desk", 290, 640, { rot: 180 })
    .item("chair", 328, 590)
    .item("floorLamp", 540, 190)
    .item("armchair", 530, 270)
    .item("roundTable", 420, 330, { w: 70, h: 70 });
  b.roof("cone", -40, -40, 880, 880, top);
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
  b.roof("flat", -20, -20, 2040, 840, f, "#c9ced3");
  b.roof("flat", 2020, 130, 400, 540, f, "#c9ced3");
}

function oneK(b: PlanBuilder): void {
  const f = b.floor();
  f.area("ベランダ", 0, -120, 360, 120, "deck", C.wood)
    .room("洋室", 0, 0, 360, 420, C.wood, "wood")
    .room("キッチン", 0, 420, 210, 260, C.wood, "wood")
    .room("", 210, 420, 150, 150, C.tile, "tile")
    .room("", 210, 570, 150, 110, C.stone, "stone")
    .open(210, 580, 210, 670)
    .walls()
    .sliding(60, 0, 300, 0)
    .door(60, 420, 140, 420, { sliding: true })
    .door(210, 450, 210, 520, { sliding: true })
    .door(240, 680, 330, 680, { flip: true })
    .window(360, 100, 360, 300).window(0, 480, 0, 600)
    .item("bed", 240, 160)
    .item("desk", 20, 320)
    .item("chair", 57, 273)
    .item("tv", 10, 100, { rot: 90 })
    .item("rug", 90, 120, { w: 120, h: 100 })
    .item("kitchen", 10, 610, { w: 180, h: 60 })
    .item("fridge", 90, 470)
    .item("washer", 20, 470)
    .item("unitBath", 210, 420, { w: 150, h: 150 })
    .item("shoeCabinet", 270, 585)
    .item("clothesDryer", 90, -95, { w: 200, h: 50 })
    .item("acOutdoor", 280, -50);
  b.roof("flat", -20, -20, 400, 720, f);
}

function maisonette(b: PlanBuilder): void {
  const f = b.floor();
  f.room("LDK", 0, 0, 600, 500, C.wood, "wood")
    .room("玄関", 0, 500, 200, 200, C.stone, "stone")
    .room("洗面", 200, 500, 200, 200, C.tile, "tile")
    .room("浴室", 400, 500, 200, 200, C.tile, "tile")
    .walls()
    .door(60, 500, 140, 500)
    .door(0, 560, 0, 650)
    .door(200, 520, 200, 600)
    .door(400, 560, 400, 640)
    .window(60, 0, 540, 0, true).window(0, 100, 0, 400)
    .item("tv", 85, 20)
    .item("table", 95, 150, { w: 100, h: 50 })
    .item("sofa", 60, 230, { rot: 180 })
    .item("diningTable", 300, 150, { w: 140, h: 90 })
    .row("chair", 320, 105, 2, 60, 0)
    .row("chair", 320, 245, 2, 60, 0, { rot: 180 })
    .item("kitchen", 200, 420)
    .item("fridge", 130, 420)
    .item("stairs", 490, 200)
    .item("shoeCabinet", 110, 655)
    .item("washbasin", 300, 630, { rot: 180 })
    .item("washer", 220, 620)
    .item("bath", 520, 530, { rot: 90 });
  const upper = b.floor();
  upper.room("寝室", 0, 0, 450, 350, C.wood, "wood")
    .room("子ども部屋", 0, 350, 450, 350, C.wood, "wood")
    .room("", 450, 0, 150, 700, C.wood, "wood")
    .walls()
    .door(450, 120, 450, 200)
    .door(450, 520, 450, 600)
    .window(0, 60, 0, 290).window(0, 410, 0, 640).window(60, 0, 390, 0)
    .item("bedDouble", 150, 100)
    .item("sideTable", 90, 100).item("sideTable", 300, 100)
    .item("wardrobe", 310, 290)
    .item("bed", 230, 360, { rot: 90 })
    .item("desk", 20, 600)
    .item("chair", 57, 553)
    .item("shelf", 180, 660);
  b.roof("gable", -30, -30, 660, 760, upper);
}

function towerMansion(b: PlanBuilder): void {
  const f = b.floor();
  f.area("バルコニー", 0, -200, 1300, 200, "deck", C.wood)
    .room("LDK", 0, 0, 900, 500, C.wood, "wood")
    .room("主寝室", 900, 0, 400, 500, "#e7e1d8", "carpet")
    .room("洋室", 0, 500, 350, 350, C.wood, "wood")
    .room("", 350, 500, 550, 120, C.wood, "wood")
    .room("玄関", 350, 620, 200, 230, C.stone, "stone")
    .room("浴室", 550, 620, 200, 230, C.tile, "tile")
    .room("洗面", 750, 620, 150, 230, C.tile, "tile")
    .room("クローゼット", 900, 500, 400, 350, C.wood, "wood")
    .open(360, 620, 540, 620)
    .walls()
    .sliding(100, 0, 800, 0).sliding(950, 0, 1250, 0)
    .door(900, 40, 900, 120)
    .door(600, 500, 680, 500)
    .door(350, 520, 350, 600)
    .door(400, 850, 490, 850)
    .door(590, 620, 670, 620)
    .door(780, 620, 860, 620)
    .door(1000, 500, 1080, 500, { flip: true })
    .window(0, 60, 0, 440, true).window(0, 560, 0, 800).window(1300, 60, 1300, 440)
    .item("tv", 115, 120)
    .item("table", 125, 260, { w: 100, h: 50 })
    .item("sofa", 90, 360, { rot: 180 })
    .item("diningTable", 420, 170, { w: 160, h: 90 })
    .row("chair", 440, 125, 2, 70, 0)
    .row("chair", 440, 265, 2, 70, 0, { rot: 180 })
    .item("kitchenIsland", 650, 200, { rot: 90 })
    .item("kitchen", 830, 160, { rot: 90 })
    .item("fridge", 830, 420)
    .item("plantLarge", 20, 430)
    .item("bedDouble", 1060, 150)
    .item("sideTable", 1000, 150).item("sideTable", 1210, 150)
    .item("armchair", 930, 400)
    .item("bed", 230, 600)
    .item("desk", 20, 770)
    .item("chair", 57, 723)
    .item("shoeCabinet", 460, 640)
    .item("bath", 570, 760)
    .item("washbasin", 780, 780, { rot: 180 })
    .item("washer", 770, 700)
    .item("closet", 1100, 560)
    .item("wardrobe", 1150, 790)
    .item("closet", 940, 780)
    .item("plantLarge", 300, -150).item("plantLarge", 900, -150)
    .item("roundTable", 500, -170, { w: 80, h: 80 })
    .item("chair", 445, -150).item("chair", 590, -150);
  b.roof("flat", -20, -20, 1340, 890, f);
}

function twoFamily(b: PlanBuilder): void {
  const f = b.floor();
  f.room("和室", 0, 0, 400, 400, C.tatami, "tatami")
    .room("LDK", 400, 0, 600, 450, C.wood, "wood")
    .room("寝室", 0, 400, 400, 300, C.wood, "wood")
    .room("", 400, 450, 250, 250, C.wood, "wood")
    .room("浴室", 650, 450, 350, 250, C.tile, "tile")
    .room("玄関", 400, 700, 250, 150, C.stone, "stone")
    .open(450, 450, 600, 450)
    .open(420, 700, 630, 700)
    .walls()
    .fusuma(400, 100, 400, 300)
    .fusuma(100, 400, 300, 400)
    .door(400, 500, 400, 580)
    .door(650, 520, 650, 600)
    .door(480, 850, 570, 850)
    .window(60, 0, 340, 0).window(0, 80, 0, 320).window(460, 0, 940, 0, true).window(1000, 80, 1000, 380).window(0, 480, 0, 640)
    .item("kotatsu", 120, 150, { w: 140, h: 140 })
    .item("zaisu", 162, 95).item("zaisu", 162, 295, { rot: 180 })
    .item("butsudan", 300, 20)
    .item("kitchen", 740, 360)
    .item("fridge", 660, 370)
    .item("diningTable", 760, 120, { w: 140, h: 90 })
    .row("chair", 780, 75, 2, 60, 0)
    .row("chair", 780, 215, 2, 60, 0, { rot: 180 })
    .item("sofa", 460, 260, { rot: 180 })
    .item("tv", 485, 80)
    .item("bed", 20, 450, { rot: 90 })
    .item("bed", 20, 560, { rot: 90 })
    .item("wardrobe", 250, 650)
    .item("stairsU", 440, 480)
    .item("bath", 820, 600)
    .item("washbasin", 700, 640, { rot: 180 })
    .item("shoeCabinet", 560, 790);
  const upper = b.floor();
  upper.room("LDK", 0, 0, 600, 450, C.wood, "wood")
    .room("寝室", 600, 0, 400, 450, C.wood, "wood")
    .room("子ども部屋", 0, 450, 400, 400, C.wood, "wood")
    .room("", 400, 450, 250, 250, C.wood, "wood")
    .room("浴室", 650, 450, 350, 250, C.tile, "tile")
    .room("書斎", 400, 700, 250, 150, C.wood, "wood")
    .open(420, 450, 580, 450)
    .walls()
    .door(600, 150, 600, 230)
    .door(400, 600, 400, 680)
    .door(650, 520, 650, 600)
    .door(440, 700, 520, 700)
    .window(60, 0, 540, 0, true).window(660, 0, 940, 0).window(0, 520, 0, 780).window(1000, 520, 1000, 640)
    .item("kitchen", 30, 360)
    .item("fridge", 280, 370)
    .item("diningTable", 80, 150, { w: 140, h: 90 })
    .row("chair", 100, 105, 2, 60, 0)
    .row("chair", 100, 245, 2, 60, 0, { rot: 180 })
    .item("sofa", 360, 200, { rot: 90 })
    .item("bedDouble", 760, 150)
    .item("sideTable", 700, 150)
    .item("bunkBed", 160, 600)
    .item("desk", 20, 760)
    .item("chair", 57, 713)
    .item("bath", 820, 600)
    .item("washbasin", 700, 640, { rot: 180 })
    .item("desk", 500, 780, { w: 120, h: 60 });
  // 2階は子ども部屋と書斎の側だけが南に出ているので、本体と張り出しに分けて屋根を載せる（何もない所に屋根をかけない）
  b.roof("hip", -30, -30, 1060, 760, upper);
  b.roof("gable", -30, 700, 710, 180, upper);
}

function logHouse(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", -300, -200, 1400, 1300, "grass", C.grass)
    .area("デッキ", 0, 700, 800, 250, "deck", C.wood)
    .room("リビング", 0, 0, 550, 450, C.wood, "wood")
    .room("キッチン", 550, 0, 250, 450, C.wood, "wood")
    .room("寝室", 0, 450, 400, 250, C.wood, "wood")
    .room("浴室", 400, 450, 200, 250, C.tile, "tile")
    .room("", 600, 450, 200, 250, C.wood, "wood")
    .walls()
    .door(550, 150, 550, 230)
    .door(150, 450, 230, 450)
    .door(460, 450, 540, 450)
    .door(600, 520, 600, 600)
    .door(650, 700, 740, 700, { flip: true })
    .door(800, 520, 800, 610)
    .window(80, 0, 480, 0, true).window(0, 80, 0, 380).window(0, 500, 0, 650).window(600, 0, 760, 0)
    .item("fireplace", 200, 0)
    .item("sofa", 180, 250, { rot: 180 })
    .item("table", 215, 160, { w: 100, h: 50 })
    .item("armchair", 40, 140, { rot: 90 })
    .item("rug", 150, 120, { w: 230, h: 180 })
    .item("kitchen", 730, 120, { rot: 90 })
    .item("roundTable", 580, 280, { w: 90, h: 90 })
    .item("chair", 600, 230).item("chair", 600, 375, { rot: 180 })
    .item("bedDouble", 200, 490, { rot: 90 })
    .item("bath", 420, 600)
    .item("stove", 640, 600)
    .row("chair", 100, 800, 3, 90, 0, { rot: 180 })
    .item("longTable", 100, 850, { w: 260, h: 70 })
    .item("conifer", -250, -150).item("conifer", 900, -150).item("tree", 850, 720, { w: 200, h: 200 })
    .trace("pathway", [[690, 960], [720, 1080]], { brush: 90 });
  b.roof("gable", -40, -40, 880, 780, f, "#5a3e2b");
}

function garageHouse(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 600, 900, 300, "concrete", C.stone)
    .room("ガレージ", 0, 0, 500, 600, C.stone, "concrete")
    .room("作業場", 500, 0, 400, 300, C.gray, "concrete")
    .room("玄関", 500, 300, 400, 300, C.stone, "stone")
    .walls()
    .sliding(60, 600, 440, 600)
    .door(500, 100, 500, 180)
    .door(600, 300, 680, 300, { flip: true })
    .door(700, 600, 790, 600)
    .window(900, 60, 900, 240)
    .item("car", 160, 80)
    .item("motorcycle", 380, 300)
    .item("shelf", 420, 20, { rot: 90 })
    .item("longTable", 700, 80, { w: 180, h: 60 })
    .item("stool", 760, 160)
    .item("shelf", 520, 240)
    .item("shoeCabinet", 800, 520)
    .item("stairs", 600, 400, { rot: 90 });
  const upper = b.floor();
  upper.room("LDK", 0, 0, 600, 600, C.wood, "wood")
    .room("寝室", 600, 0, 300, 350, C.wood, "wood")
    .room("", 600, 350, 300, 250, C.wood, "wood")
    .walls()
    .door(600, 150, 600, 230)
    .door(600, 450, 600, 530)
    .door(700, 350, 780, 350)
    .window(60, 0, 540, 0, true).window(0, 80, 0, 520).window(900, 60, 900, 300)
    .item("kitchen", 30, 520)
    .item("fridge", 280, 525)
    .item("diningTable", 80, 300, { w: 140, h: 90 })
    .row("chair", 100, 255, 2, 60, 0)
    .row("chair", 100, 395, 2, 60, 0, { rot: 180 })
    .item("sofa", 330, 120)
    .item("tv", 355, 260, { rot: 180 })
    .item("bed", 750, 120);
  b.roof("flat", -20, -20, 940, 640, upper);
}

function danchi(b: PlanBuilder): void {
  const f = b.floor();
  f.area("ベランダ", 0, -150, 900, 150, "concrete", C.stone)
    .room("和室", 0, 0, 350, 350, C.tatami, "tatami")
    .room("和室", 350, 0, 300, 350, C.tatami, "tatami")
    .room("DK", 650, 0, 250, 450, C.wood, "wood")
    .room("洋室", 0, 350, 350, 300, C.wood, "wood")
    .room("", 350, 350, 300, 100, C.wood, "wood")
    .room("浴室", 350, 450, 180, 200, C.tile, "tile")
    .room("玄関", 530, 450, 370, 200, C.stone, "stone")
    .walls()
    .sliding(40, 0, 310, 0).sliding(390, 0, 610, 0)
    .fusuma(350, 80, 350, 270)
    .fusuma(650, 100, 650, 280)
    .fusuma(400, 350, 600, 350)
    .door(350, 370, 350, 430)
    .door(650, 370, 650, 430, { flip: true })
    .door(400, 450, 470, 450)
    .open(550, 450, 640, 450)
    .door(780, 650, 870, 650)
    .window(0, 400, 0, 600).window(900, 60, 900, 380)
    .item("chabudai", 140, 140)
    .item("zabuton", 157, 80).item("zabuton", 157, 240)
    .item("stepTansu", 190, 300, { w: 150, h: 45 })
    .item("futon", 450, 80)
    .item("kitchen", 835, 140, { rot: 90 })
    .item("fridge", 705, 380)
    .item("table", 690, 200, { w: 90, h: 70 })
    .item("chair", 700, 150).item("chair", 700, 275, { rot: 180 })
    .item("desk", 20, 580)
    .item("chair", 57, 533)
    .item("bed", 230, 420)
    .item("bath", 360, 560, { w: 160, h: 75 })
    .item("washer", 825, 470)
    .item("shoeCabinet", 600, 600)
    .item("clothesDryer", 300, -110, { w: 300, h: 50 });
  b.roof("flat", -20, -20, 940, 690, f);
}

function courtyardHouse(b: PlanBuilder): void {
  const f = b.floor();
  f.area("中庭", 350, 350, 400, 350, "grass", C.grass).label(20, 20)
    .room("LDK", 0, 0, 750, 350, C.wood, "wood")
    .room("寝室", 750, 0, 350, 500, C.wood, "wood")
    .room("書斎", 0, 350, 350, 350, C.wood, "wood")
    .room("浴室", 750, 500, 350, 200, C.tile, "tile")
    .room("", 0, 700, 1100, 150, C.wood, "wood")
    .room("玄関", 450, 850, 200, 150, C.stone, "stone")
    .walls()
    .sliding(400, 350, 700, 350)
    .sliding(350, 400, 350, 650)
    .sliding(750, 400, 750, 470)
    .door(750, 150, 750, 230)
    .door(150, 700, 230, 700, { flip: true })
    .door(850, 700, 930, 700)
    .open(470, 850, 630, 850)
    .door(500, 1000, 600, 1000)
    .window(60, 0, 690, 0, true).window(810, 0, 1050, 0).window(0, 400, 0, 650).window(1100, 560, 1100, 660)
    .item("kitchenL", 30, 80)
    .item("diningTable", 300, 120, { w: 160, h: 90 })
    .row("chair", 320, 75, 2, 70, 0)
    .row("chair", 320, 215, 2, 70, 0, { rot: 180 })
    .item("sofa", 540, 230, { rot: 180 })
    .item("tv", 565, 40)
    .item("bedDouble", 850, 150)
    .item("sideTable", 1000, 150)
    .item("desk", 140, 600, { w: 140, h: 60 })
    .item("officeChair", 180, 540)
    .item("shelf", 20, 450, { rot: 90 })
    .item("bath", 920, 600)
    .item("tree", 470, 430, { w: 160, h: 160 })
    .trace("steppingStones", [[400, 640], [550, 610], [700, 640]])
    .item("shoeCabinet", 560, 860);
  b.roof("flat", -20, -20, 1140, 390, f);
  b.roof("flat", -20, 330, 390, 390, f);
  b.roof("flat", 730, 330, 390, 390, f);
  b.roof("flat", -20, 680, 1140, 340, f);
}

function bungalow(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", -200, -200, 1500, 1300, "grass", C.grass)
    .area("テラス", 0, 600, 600, 250, "deck", C.wood)
    .room("リビング", 0, 0, 600, 600, C.wood, "herringbone")
    .room("寝室", 600, 0, 500, 400, "#e7e1d8", "carpet")
    .room("浴室", 600, 400, 250, 200, C.tile, "tile")
    .room("玄関", 850, 400, 250, 200, C.stone, "stone")
    .walls()
    .sliding(100, 600, 500, 600)
    .door(600, 20, 600, 100)
    .door(650, 400, 730, 400)
    .door(850, 450, 850, 530, { flip: true })
    .door(950, 600, 1040, 600)
    .window(60, 0, 540, 0, true).window(0, 100, 0, 500).window(660, 0, 1040, 0).window(1100, 80, 1100, 320)
    .item("sofaCorner", 60, 330)
    .item("table", 150, 230, { w: 110, h: 60 })
    .item("tv", 160, 40)
    .item("kitchenIsland", 360, 380)
    .item("kitchen", 520, 120, { rot: 90 })
    .item("diningTable", 330, 150, { w: 140, h: 90 })
    .item("bedDouble", 820, 120)
    .item("sideTable", 760, 120).item("sideTable", 970, 120)
    .item("bath", 660, 510)
    .item("shoeCabinet", 1000, 420)
    .item("parasol", 150, 610, { w: 200, h: 200 })
    .item("palmTree", 650, 800, { w: 220, h: 220 })
    .trace("flowerBed", [[-150, 650], [-50, 620], [-40, 780], [-150, 820]])
    .trace("pathway", [[1000, 610], [1000, 1080]], { brush: 100 });
  b.roof("hip", -40, -40, 1180, 680, f, "#a0522d");
}

function penthouse(b: PlanBuilder): void {
  const f = b.floor();
  f.area("屋上テラス", 0, 600, 1200, 500, "deck", C.wood).label(20, 20)
    .room("リビング", 0, 0, 700, 600, C.wood, "marble")
    .room("寝室", 700, 0, 500, 400, "#e7e1d8", "carpet")
    .room("浴室", 700, 400, 500, 200, C.tile, "marble")
    .walls()
    .sliding(100, 600, 600, 600)
    .door(700, 150, 700, 230)
    .door(760, 400, 840, 400)
    .window(60, 0, 640, 0, true).window(0, 80, 0, 520).window(760, 0, 1140, 0, true).window(1200, 80, 1200, 340)
    .item("sofaCorner", 60, 330)
    .item("table", 150, 240, { w: 110, h: 60 })
    .item("piano", 420, 60)
    .item("tv", 160, 40)
    .item("kitchenIsland", 420, 400)
    .item("bedDouble", 900, 120)
    .item("sideTable", 840, 120).item("sideTable", 1050, 120)
    .item("bath", 1000, 500)
    .item("washbasin", 760, 520, { rot: 180 })
    .item("fountain", 820, 680, { w: 200, h: 200 })
    .item("parasol", 200, 700, { w: 200, h: 200 })
    .row("chair", 220, 940, 3, 70, 0)
    .trace("lawn", [[450, 750], [700, 700], [760, 900], [520, 1000], [430, 900]], { curve: true })
    .trace("hedge", [[20, 1080], [1180, 1080]], { brush: 40, height: 90 });
  b.roof("flat", -20, -20, 1240, 640, f);
}

function tinyHouse(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", -200, -150, 900, 700, "grass", C.grass)
    .area("デッキ", 0, 300, 500, 150, "deck", C.wood)
    .room("", 0, 0, 500, 300, C.wood, "wood")
    .walls()
    .door(380, 300, 460, 300)
    .window(60, 0, 300, 0).window(0, 80, 0, 220).window(500, 80, 500, 220)
    .item("bed", 20, 30, { w: 90, h: 190 })
    .item("kitchen", 220, 235, { w: 150, h: 60 })
    .item("table", 140, 120, { w: 80, h: 60 })
    .item("stool", 150, 70)
    .item("shower", 400, 20)
    .item("stove", 400, 140)
    .item("bench", 60, 380, { w: 150, h: 45 })
    .item("tree", 530, -140, { w: 160, h: 160 })
    .item("campfire", 300, 470, { w: 80, h: 80 });
  b.roof("gable", -30, -30, 560, 360, f, "#6b4f3a");
}

function japaneseCastle(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 3000, 3100, "grass", C.grass)
    .area("本丸", 700, 600, 1600, 1700, "gravel", C.gravel).label(160, 170)
    .room("天守", 1100, 800, 800, 600, C.wood, "wood").label(140, 20)
    .room("大広間", 780, 1650, 400, 350, C.tatami, "tatami").label(20, 20)
    .room("書院", 1180, 1650, 220, 350, C.tatami, "tatami").label(20, 20)
    // 櫓門（両側から高石垣が続くので、名前は付けない）
    .room("", 1350, 2220, 300, 160, C.wood, "wood")
    .room("", 760, 660, 220, 220, C.wood, "wood")
    .room("", 2020, 660, 220, 220, C.wood, "wood")
    .walls()
    .door(1450, 1400, 1550, 1400)
    .fusuma(1180, 1750, 1180, 1900)
    .shoji(1400, 1700, 1400, 1950)
    .door(1400, 2220, 1600, 2220, { style: "gate" })
    .door(1400, 2380, 1600, 2380, { style: "gate", flip: true })
    .door(860, 880, 920, 880)
    .door(2080, 880, 2140, 880)
    .window(1200, 800, 1800, 800, true).window(1100, 900, 1100, 1300).window(1900, 900, 1900, 1300)
    .window(880, 2000, 1150, 2000)
    // 天守の中: 階段と武具
    .item("stairs", 1150, 1050)
    .item("treasureChest", 1700, 1300)
    .item("crate", 1780, 1290)
    // 本丸御殿
    .item("tokonoma", 1000, 1910)
    .row("zabuton", 850, 1760, 4, 90, 0)
    .item("byobu", 1200, 1940, { w: 160, h: 45 })
    .item("chabudai", 1250, 1780)
    // 天守台の石垣（入口は開ける）
    .trace("stoneWall", [[1450, 1430], [1070, 1430], [1070, 770], [1930, 770], [1930, 1430], [1550, 1430]], { brush: 50, height: 180 })
    // 本丸を囲む高石垣（門の所は開ける）と堀
    .trace("stoneWall", [[1340, 2300], [700, 2300], [700, 600], [2300, 600], [2300, 2300], [1660, 2300]], { brush: 120, height: 350 })
    .trace("river", [[1500, 300], [2650, 300], [2650, 2650], [350, 2650], [350, 300], [1560, 300]], { brush: 260 })
    // 堀を渡る土橋と、門から天守への道
    .trace("pathway", [[1500, 2480], [1500, 3060]], { brush: 260 })
    .trace("pathway", [[1500, 2120], [1500, 1440]], { brush: 160 })
    // 松と桜、石灯籠
    .item("conifer", 900, 1100).item("conifer", 2000, 1150).item("tree", 1900, 1700, { w: 260, h: 260 })
    .item("stoneLantern", 1320, 2080).item("stoneLantern", 1620, 2080)
    .item("tree", 40, 40, { w: 150, h: 150 }).item("tree", 2750, 2830, { w: 200, h: 200 }).item("conifer", 2830, 40, { w: 150, h: 150 });
  // 天守の1階（下の重）の屋根と、御殿・櫓門・隅櫓の屋根
  b.roof("hip", 1040, 740, 920, 720, f, "#3f4549");
  b.roof("hip", 750, 1620, 680, 410, f, "#3f4549");
  b.roof("hip", 1320, 2190, 360, 220, f, "#3f4549");
  b.roof("hip", 1360, 2210, 280, 180, f, "#3f4549", { elevation: 110 });
  b.roof("hip", 730, 630, 280, 280, f, "#3f4549");
  b.roof("hip", 1990, 630, 280, 280, f, "#3f4549");
  // 天守の2階・3階（上の重ほど小さく）
  const second = b.floor();
  second.room("二の重", 1170, 860, 660, 480, C.wood, "wood").label(20, 20)
    .walls()
    .window(1250, 860, 1750, 860, true).window(1170, 950, 1170, 1250).window(1830, 950, 1830, 1250)
    .item("stairs", 1600, 900)
    .item("crate", 1300, 1250);
  b.roof("hip", 1110, 800, 780, 600, second, "#3f4549");
  const third = b.floor();
  third.room("最上階", 1260, 900, 480, 400, C.wood, "wood").label(20, 20)
    .walls()
    .window(1340, 900, 1660, 900, true).window(1260, 980, 1260, 1220).window(1740, 980, 1740, 1220).window(1340, 1300, 1660, 1300, true)
    .item("zabuton", 1460, 1150);
  b.roof("hip", 1200, 840, 600, 520, third, "#3f4549");
}

function machiya(b: PlanBuilder): void {
  const f = b.floor();
  f.room("店の間", 0, 0, 450, 300, C.wood, "wood")
    .room("", 450, 0, 120, 1200, C.stone, "soil")
    .room("中の間", 0, 300, 450, 300, C.tatami, "tatami")
    .area("坪庭", 0, 600, 450, 200, "gravel", C.gravel)
    .room("奥の間", 0, 800, 450, 400, C.tatami, "tatami")
    .walls()
    .koshi(100, 0, 350, 0)
    .door(450, 0, 570, 0, { style: "koshi" })
    .shoji(450, 80, 450, 220)
    .fusuma(100, 300, 350, 300)
    .shoji(450, 380, 450, 520)
    .shoji(80, 600, 370, 600)
    .shoji(80, 800, 370, 800)
    .shoji(450, 900, 450, 1100)
    .item("showcase", 60, 180, { w: 300, h: 60 })
    .item("counter", 300, 60, { w: 120, h: 50 })
    .item("chabudai", 180, 420)
    .item("zabuton", 197, 360).item("zabuton", 197, 520, { rot: 180 })
    .item("kamado", 475, 650, { rot: 90 })
    .item("ido", 455, 1085, { w: 110, h: 110 })
    .item("tsukubai", 200, 680)
    .item("stoneLantern", 330, 660)
    .item("tokonoma", 20, 1110)
    .item("chabudai", 180, 920)
    .item("butsudan", 350, 1135);
  b.roof("gable", -30, -30, 630, 660, f, "#3f4549");
  b.roof("gable", -30, 770, 630, 460, f, "#3f4549");
  b.roof("flat", 450, 630, 150, 140, f, "#3f4549");
}

function nagaya(b: PlanBuilder): void {
  const f = b.floor();
  f.area("路地", 0, 500, 1800, 200, "soil", C.soil).label(20, 20);
  for (let unit = 0; unit < 4; unit += 1) {
    const x = unit * 450;
    f.room("", x, 0, 450, 150, C.stone, "soil")
      .room(`部屋${unit + 1}`, x, 150, 450, 350, C.tatami, "tatami");
  }
  f.walls();
  for (let unit = 0; unit < 4; unit += 1) {
    const x = unit * 450;
    f.door(x + 60, 500, x + 160, 500, { style: "koshi" })
      .shoji(x + 200, 150, x + 400, 150)
      .window(x + 120, 0, x + 330, 0)
      .item("kamado", x + 280, 20)
      .item("chabudai", x + 190, 330)
      .item("futon", x + 340, 250, { w: 90, h: 200 })
      .item("andon", x + 30, 440);
  }
  f.item("ido", 840, 560, { w: 110, h: 110 })
    .item("trashCan", 300, 610)
    .item("bench", 1300, 600, { w: 150, h: 45 });
  b.roof("gable", -30, -30, 1860, 560, f, "#5a5f63");
}

function ninjaHouse(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", -200, -200, 1500, 1300, "gravel", C.gravel)
    .room("表座敷", 0, 0, 500, 400, C.tatami, "tatami")
    .room("仏間", 500, 0, 300, 400, C.tatami, "tatami")
    .room("隠し部屋", 800, 0, 300, 250, C.wood, "wood")
    .room("台所", 0, 400, 400, 400, C.wood, "soil")
    .room("納戸", 400, 400, 400, 400, C.wood, "wood")
    .room("", 800, 250, 300, 550, C.wood, "wood")
    .walls()
    .fusuma(500, 100, 500, 300)
    .fusuma(800, 80, 800, 180)
    .fusuma(100, 400, 300, 400)
    .door(400, 500, 400, 580, { style: "itado" })
    .shoji(850, 250, 1050, 250)
    .door(800, 500, 800, 580)
    .door(150, 800, 260, 800, { style: "koshi" })
    .window(60, 0, 440, 0).window(0, 80, 0, 320).window(1100, 300, 1100, 700)
    .item("byobu", 260, 40)
    .item("tokonoma", 300, 310)
    .item("butsudan", 700, 325)
    .item("treasureChest", 1000, 160)
    .item("crate", 900, 80)
    .item("kamado", 10, 500, { rot: 90 })
    .item("irori", 150, 520)
    .item("crate", 650, 700).item("barrel", 720, 710)
    .item("stepTansu", 600, 450)
    .item("shelf", 1050, 620, { rot: 90 })
    .trace("takegaki", [[-150, 1050], [1250, 1050]], { height: 180 })
    .item("conifer", 1100, -180, { w: 150, h: 150 });
  b.roof("hip", -40, -40, 1180, 880, f, "#4a4f52");
}

function japaneseGarden(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 2400, 1800, "gravel", "#e3ddd0")
    .area("芝生", 1500, 1200, 800, 500, "grass", C.grass).label(20, 20)
    .room("茶室", 100, 100, 350, 300, C.tatami, "tatami").label(20, 20)
    .room("東屋", 1800, 100, 400, 300, C.wood, "wood").label(20, 20)
    .walls()
    .shoji(150, 400, 400, 400)
    .door(1900, 400, 2100, 400, { style: "itado" })
    .item("zaisu", 300, 250).item("sideTable", 200, 260, { color: "#3f3a36" })
    .item("bench", 1880, 250, { w: 240, h: 50 })
    .trace("pond", [[600, 500], [1000, 380], [1450, 520], [1500, 900], [1150, 1150], [700, 1080], [520, 820]], { curve: true })
    .trace("river", [[1300, 1700], [1450, 1300], [1380, 1000]], { brush: 80 })
    .trace("steppingStones", [[275, 460], [420, 700], [560, 1000], [800, 1300], [1100, 1450], [1500, 1450]])
    .trace("pathway", [[1600, 420], [1700, 800], [1550, 1150]], { brush: 90 })
    .item("stoneLantern", 480, 420).item("stoneLantern", 1550, 400)
    .item("tsukubai", 470, 330)
    .item("rock", 900, 650).item("rock", 1100, 820, { symbol: 1 }).item("rock", 1650, 1350)
    .item("conifer", 1600, 900, { w: 160, h: 160 }).item("tree", 300, 1300, { w: 300, h: 300 }).item("tree", 2000, 700, { w: 280, h: 280 })
    .trace("hedge", [[40, 1760], [2360, 1760]], { brush: 50 })
    .trace("takegaki", [[2360, 40], [2360, 1700]]);
  b.roof("gable", 70, 70, 410, 360, f, "#4a4f52");
  b.roof("hip", 1770, 70, 460, 360, f, "#4a4f52");
}

function onsen(b: PlanBuilder): void {
  const f = b.floor();
  f.area("露天風呂", 0, 900, 1600, 600, "stone", C.stone).label(20, 20)
    .room("男湯", 0, 400, 800, 500, C.tile, "tile")
    .room("女湯", 800, 400, 800, 500, C.tile, "tile")
    .room("脱衣所", 0, 0, 800, 400, C.wood, "wood")
    .room("脱衣所", 800, 0, 800, 400, C.wood, "wood")
    .walls()
    .door(350, 400, 450, 400, { flip: true }).door(1150, 400, 1250, 400, { flip: true })
    .sliding(560, 900, 760, 900).sliding(840, 900, 1040, 900)
    .door(100, 0, 190, 0).door(1410, 0, 1500, 0)
    .window(0, 480, 0, 820).window(1600, 480, 1600, 820)
    .row("shoeCabinet", 300, 20, 3, 100, 0)
    .row("shelf", 120, 300, 4, 100, 0, { rot: 180 })
    .row("shoeCabinet", 1100, 20, 3, 100, 0)
    .row("shelf", 920, 300, 4, 100, 0, { rot: 180 })
    .item("hinokiBath", 300, 600, { w: 300, h: 160 })
    .item("hinokiBath", 1000, 600, { w: 300, h: 160 })
    .row("washbasin", 40, 820, 4, 120, 0, { rot: 180 })
    .row("washbasin", 1125, 820, 4, 120, 0, { rot: 180 })
    .trace("pond", [[150, 1000], [600, 960], [750, 1150], [500, 1380], [150, 1300]], { color: "#6f8fa6", curve: true })
    .trace("pond", [[850, 1000], [1350, 980], [1450, 1200], [1100, 1400], [850, 1300]], { color: "#6f8fa6", curve: true })
    .item("rock", 650, 1300).item("rock", 1400, 1350, { symbol: 1 })
    .trace("takegaki", [[800, 920], [800, 1480]], { height: 200 })
    .item("stoneLantern", 40, 1420).item("stoneLantern", 1500, 1420);
  b.roof("gable", -30, -30, 1660, 960, f, "#4a4f52");
}

function minshuku(b: PlanBuilder): void {
  const f = b.floor();
  f.room("帳場", 0, 0, 400, 300, C.wood, "wood")
    .room("食堂", 400, 0, 600, 520, C.tatami, "tatami")
    .room("台所", 1000, 0, 300, 520, C.tile, "tile")
    .room("玄関", 0, 300, 400, 220, C.stone, "stone")
    .room("", 0, 520, 1300, 100, C.wood, "wood")
    .room("客室", 0, 620, 430, 280, C.tatami, "tatami")
    .room("客室", 430, 620, 430, 280, C.tatami, "tatami")
    .room("風呂", 860, 620, 440, 280, C.tile, "tile")
    .walls()
    .door(400, 100, 400, 180)
    .door(1000, 150, 1000, 230)
    .door(150, 300, 230, 300)
    .koshi(0, 380, 0, 460)
    .open(20, 520, 380, 520)
    .fusuma(500, 520, 900, 520)
    .door(1100, 520, 1180, 520)
    .fusuma(80, 620, 220, 620).fusuma(510, 620, 650, 620)
    .door(950, 620, 1030, 620)
    .window(60, 0, 340, 0).window(460, 0, 940, 0, true).window(1300, 80, 1300, 440).window(60, 900, 370, 900).window(490, 900, 800, 900)
    .item("counter", 200, 220, { w: 180, h: 50 })
    .item("longTable", 500, 150, { w: 400, h: 70 })
    .row("zabuton", 520, 90, 4, 100, 0).row("zabuton", 520, 230, 4, 100, 0)
    .item("kitchen", 1235, 100, { rot: 90 })
    .item("fridge", 1020, 430)
    .item("shoeCabinet", 300, 470)
    .item("futon", 60, 680).item("futon", 180, 680)
    .item("futon", 490, 680).item("futon", 610, 680)
    .item("hinokiBath", 950, 720, { w: 260, h: 120 });
  b.roof("hip", -40, -40, 1380, 980, f, "#4a4f52");
}

function guesthouse(b: PlanBuilder): void {
  const f = b.floor();
  f.room("ラウンジ", 0, 0, 600, 450, C.wood, "wood")
    .room("キッチン", 600, 0, 350, 450, C.tile, "tile")
    .room("ドミトリー", 0, 450, 500, 450, C.wood, "wood")
    .room("ドミトリー", 500, 450, 450, 450, C.wood, "wood")
    .room("シャワー", 950, 0, 250, 450, C.tile, "tile")
    .room("受付", 950, 450, 250, 450, C.warm)
    .walls()
    .door(600, 150, 600, 230)
    .door(380, 450, 460, 450)
    .door(610, 450, 690, 450, { flip: true })
    .door(950, 100, 950, 180, { flip: true })
    .door(950, 500, 950, 580)
    .door(1050, 900, 1140, 900)
    .window(60, 0, 540, 0, true).window(0, 520, 0, 820).window(1200, 520, 1200, 820)
    .item("sofaCorner", 40, 260)
    .item("table", 120, 170, { w: 110, h: 60 })
    .item("shelf", 440, 20).item("plantLarge", 520, 380)
    .item("kitchen", 680, 360)
    .item("longTable", 680, 150, { w: 200, h: 70 })
    .row("stool", 700, 230, 3, 60, 0)
    .row("bunkBed", 40, 600, 4, 115, 0)
    .row("bunkBed", 540, 600, 3, 130, 0)
    .row("locker", 60, 520, 2, 100, 0, { w: 90, h: 50 })
    .row("shower", 1010, 60, 3, 0, 120)
    .item("counter", 990, 700, { w: 180, h: 60 });
  b.roof("gable", -30, -30, 1260, 960, f);
}

function capsuleHotel(b: PlanBuilder): void {
  const f = b.floor();
  f.room("フロント", 0, 0, 500, 400, C.gray)
    .room("ロッカー", 0, 400, 500, 300, C.gray)
    .room("カプセル", 500, 0, 900, 700, "#e8eaee", "carpet").label(20, 20)
    .room("浴場", 0, 700, 700, 350, C.tile, "tile")
    .room("ラウンジ", 700, 700, 700, 350, C.wood, "wood")
    .walls()
    .door(200, 0, 300, 0)
    .door(150, 400, 230, 400)
    .door(500, 450, 500, 530)
    .door(300, 700, 380, 700)
    .door(900, 700, 980, 700, { flip: true })
    .window(1400, 760, 1400, 1000).window(0, 60, 0, 340)
    .item("counter", 150, 120, { w: 240, h: 60 })
    .item("vendingMachine", 380, 290)
    .row("locker", 30, 470, 4, 110, 0, { w: 90, h: 50 })
    .row("bunkBed", 590, 100, 7, 115, 0)
    .row("bunkBed", 590, 440, 7, 115, 0)
    .item("bath", 100, 900, { w: 300, h: 120 })
    .row("washbasin", 450, 990, 3, 80, 0, { rot: 180 })
    .row("armchair", 760, 800, 3, 110, 0)
    .item("tv", 1150, 990, { rot: 180 })
    .item("vendingMachine", 1270, 760);
  b.roof("flat", -20, -20, 1440, 1090, f);
}

function palace(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", -600, -400, 3200, 2800, "grass", C.grass)
    .area("前庭", 300, 1300, 1400, 900, "cobblestone", C.cobble).label(40, 40)
    .room("謁見の間", 500, 0, 1000, 700, "#eadfca", "marble").label(40, 600)
    .room("舞踏の間", 500, 700, 1000, 600, C.wood, "herringbone").label(40, 500)
    .room("東の間", 1500, 0, 500, 1300, "#eadfca", "marble")
    .room("西の間", 0, 0, 500, 1300, "#eadfca", "marble")
    .walls()
    .door(950, 700, 1050, 700)
    .door(500, 300, 500, 400).door(1500, 300, 1500, 400)
    .door(500, 900, 500, 1000).door(1500, 900, 1500, 1000)
    .door(900, 1300, 1100, 1300)
    .window(600, 0, 1400, 0, true).window(0, 100, 0, 1200, true).window(2000, 100, 2000, 1200, true)
    .item("rug", 920, 150, { w: 160, h: 500, color: "#8e1f2a" })
    .item("throne", 950, 30, { w: 100, h: 90 })
    .row("brazier", 640, 150, 2, 0, 300).row("brazier", 1310, 150, 2, 0, 300)
    .item("grandfatherClock", 520, 20)
    .item("piano", 600, 800)
    .row("armchair", 600, 1000, 4, 110, 0, { rot: 180 })
    .item("fireplace", 1150, 700, { rot: 180 })
    .row("sofa", 1600, 200, 4, 0, 250, { rot: 90 })
    .row("roundTable", 1780, 220, 4, 0, 250)
    .row("shelf", 20, 200, 6, 0, 150, { rot: 270 })
    .item("diningTable", 150, 450, { w: 160, h: 400 })
    .row("chair", 100, 470, 5, 0, 75, { rot: 270 })
    .row("chair", 315, 470, 5, 0, 75, { rot: 90 })
    .item("fountain", 850, 1550)
    .row("statue", 330, 1650, 2, 0, 400).row("statue", 1600, 1650, 2, 0, 400)
    .trace("flowerBed", [[450, 1500], [750, 1450], [750, 1650], [450, 1700]])
    .trace("flowerBed", [[1250, 1450], [1550, 1500], [1550, 1700], [1250, 1650]])
    .trace("hedge", [[-550, 2300], [850, 2300]], { brush: 60 })
    .trace("hedge", [[1150, 2300], [2550, 2300]], { brush: 60 })
    .trace("pathway", [[1000, 2200], [1000, 2380]], { brush: 260 })
    .item("tree", -500, 0, { w: 300, h: 300 }).item("tree", -500, 900, { w: 300, h: 300 })
    .item("tree", 2200, 0, { w: 300, h: 300 }).item("tree", 2200, 900, { w: 300, h: 300 });
  b.roof("hip", -40, -40, 2080, 1380, f, "#4f6170");
}

function villa(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", -300, -300, 1900, 1700, "sand", C.sand)
    .area("プールサイド", 0, 600, 1300, 500, "tile", C.tile).label(20, 20)
    .room("リビング", 0, 0, 700, 600, C.white, "marble")
    .room("寝室", 700, 0, 600, 400, "#e7e1d8", "carpet")
    .room("浴室", 700, 400, 600, 200, C.tile, "mosaic")
    .walls()
    .sliding(100, 600, 600, 600)
    .door(700, 150, 700, 230)
    .door(800, 400, 880, 400)
    .window(60, 0, 640, 0, true).window(760, 0, 1240, 0, true).window(1300, 60, 1300, 340)
    .item("sofaCorner", 60, 320)
    .item("table", 150, 230, { w: 110, h: 60 })
    .item("kitchenIsland", 420, 380)
    .item("diningTable", 420, 120, { w: 160, h: 90 })
    .item("bedDouble", 950, 120)
    .item("bath", 1100, 500)
    .trace("pond", [[300, 700], [900, 680], [950, 950], [320, 980]], { color: "#3fa7c9" })
    .row("bench", 1000, 680, 3, 0, 120, { w: 200, h: 60 })
    .item("parasol", 40, 750, { w: 200, h: 200 })
    .item("palmTree", 1300, -250, { w: 260, h: 260 })
    .item("palmTree", -250, 1100, { w: 260, h: 260 })
    .trace("river", [[-250, 1300], [1550, 1300]], { brush: 120 });
  b.roof("flat", -20, -20, 1340, 640, f);
}

function festival(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 2200, 1400, "soil", C.soil)
    .room("本部", 1900, 1200, 250, 180, C.wood, "wood")
    .walls()
    .door(1950, 1200, 2030, 1200, { flip: true })
    .item("longTable", 1940, 1300, { w: 180, h: 50 })
    .trace("pathway", [[100, 700], [2100, 700]], { brush: 260 });
  // 参道の両側に並ぶ屋台（提灯をつるす）
  for (const [x, y] of [[200, 300], [600, 300], [1000, 300], [1400, 300], [1800, 300], [200, 900], [600, 900], [1000, 900], [1400, 900], [1800, 900]]) {
    f.item("counter", x, y + (y < 700 ? 140 : 0), { w: 240, h: 60 })
      .item("tent", x, y + (y < 700 ? 0 : 60), { w: 240, h: 200 })
      .item("chochin", x + 100, y < 700 ? y + 210 : y - 50);
  }
  f.item("torii", 920, 40)
    .item("stage", 900, 1150, { w: 400, h: 200 })
    .item("drumKit", 1030, 1180)
    .row("bench", 300, 1250, 3, 200, 0, { w: 150, h: 45 })
    .item("trashCan", 1700, 1300)
    .item("tree", 30, 30, { w: 220, h: 220 }).item("tree", 1950, 30, { w: 220, h: 220 });
  b.roof("gable", 1880, 1180, 290, 220, f);
}

function beach(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 2400, 1600, "sand", C.sand)
    .area("海", 0, 1100, 2400, 500, "water", C.water).label(40, 40)
    .room("海の家", 100, 100, 600, 350, C.wood, "deck")
    .walls()
    .sliding(150, 450, 650, 450)
    .window(100, 160, 100, 380).window(160, 100, 640, 100)
    .item("counter", 150, 300, { w: 300, h: 60 })
    .row("roundTable", 120, 200, 4, 140, 0, { w: 80, h: 80 })
    .item("vendingMachine", 580, 120)
    .row("parasol", 900, 500, 4, 350, 0, { w: 220, h: 220 })
    .row("bench", 900, 780, 4, 350, 0, { w: 160, h: 50 })
    .item("palmTree", 2050, 100, { w: 300, h: 300 })
    .item("palmTree", 1000, 60, { w: 240, h: 240 })
    .trace("pathway", [[800, 30], [800, 460], [1200, 900], [1300, 1050]], { brush: 120 })
    .item("signboard", 300, 520)
    .item("shower", 900, 320)
    .item("campfire", 2150, 880);
  b.roof("gable", 70, 70, 660, 410, f, "#2f6f8f");
}

function station(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 2600, 1500, "asphalt", C.asphalt)
    .area("ホーム", 200, 600, 2200, 300, "concrete", C.stone).label(40, 30)
    .room("駅舎", 900, 0, 800, 450, C.gray).label(30, 30)
    .room("駅員室", 1700, 0, 400, 450, C.cool)
    .walls()
    .sliding(1150, 450, 1450, 450)
    .door(1150, 0, 1450, 0)
    .door(1700, 200, 1700, 280)
    .window(1760, 0, 2040, 0).window(900, 80, 900, 380)
    .item("counter", 1200, 300, { w: 300, h: 60 })
    .row("vendingMachine", 950, 330, 2, 110, 0)
    .row("bench", 1100, 130, 2, 280, 0, { w: 150, h: 50 })
    .item("desk", 1800, 100).item("officeChair", 1830, 170)
    .item("locker", 1980, 360)
    .trace("railway", [[0, 1100], [2600, 1100]])
    .row("bench", 500, 640, 3, 450, 0, { w: 180, h: 50 })
    .item("vendingMachine", 1950, 640)
    .item("busStop", 100, 300)
    .item("car", 300, 80, { rot: 90 })
    .item("signboard", 820, 520)
    .item("trashCan", 2300, 650);
  b.roof("gable", 870, -30, 1260, 510, f, "#5a6670");
  b.roof("flat", 180, 580, 2240, 220, f, "#7a8288", { elevation: 40 });
}

function kissaten(b: PlanBuilder): void {
  const f = b.floor();
  f.room("客席", 0, 0, 800, 600, "#6b4a32", "wood")
    .room("厨房", 800, 0, 300, 400, C.tile, "tile")
    .room("", 800, 400, 300, 200, C.tile, "tile")
    .walls()
    .door(350, 600, 450, 600, { flip: true })
    .door(800, 150, 800, 230)
    .door(880, 400, 960, 400, { flip: true })
    .window(60, 0, 740, 0, true).window(0, 80, 0, 520)
    .item("counter", 560, 180, { w: 220, h: 60, rot: 90 })
    .row("barStool", 500, 200, 4, 0, 80)
    .item("shelf", 720, 470, { rot: 90 })
    .item("grandfatherClock", 20, 520)
    .item("plantLarge", 720, 20);
  for (const [x, y] of [[80, 130], [80, 390], [300, 130], [300, 390]]) {
    f.item("table", x, y, { w: 90, h: 70, color: "#5b3a24" })
      .item("armchair", x + 5, y - 85, { color: "#8e3b2f" }).item("armchair", x + 5, y + 75, { rot: 180, color: "#8e3b2f" });
  }
  f.item("kitchen", 1035, 80, { rot: 90 })
    .item("fridge", 820, 300)
    .item("toilet", 1000, 500, { rot: 90 })
    .item("washbasin", 820, 520, { rot: 180 });
  b.roof("gable", -30, -30, 1160, 660, f, "#6b3a2a");
}

function sushi(b: PlanBuilder): void {
  const f = b.floor();
  f.room("客席", 0, 0, 900, 550, C.wood, "wood")
    .room("厨房", 900, 0, 350, 550, C.tile, "tile")
    .room("座敷", 0, 550, 500, 300, C.tatami, "tatami")
    .room("", 500, 550, 750, 300, C.wood, "wood")
    .walls()
    .door(900, 100, 900, 180)
    .shoji(100, 550, 400, 550)
    .open(520, 550, 880, 550)
    .koshi(1100, 850, 1220, 850)
    .window(60, 0, 840, 0).window(1250, 80, 1250, 460)
    .item("counter", 100, 300, { w: 700, h: 70 })
    .row("barStool", 140, 390, 8, 85, 0)
    .item("showcase", 150, 230, { w: 600, h: 50 })
    .item("kitchen", 1185, 120, { rot: 90 })
    .item("fridge", 920, 460)
    .item("longTable", 960, 200, { w: 160, h: 70 })
    .item("chabudai", 120, 680, { w: 120, h: 90 })
    .row("zabuton", 130, 620, 2, 60, 0).row("zabuton", 130, 775, 2, 60, 0)
    .item("chabudai", 320, 680, { w: 120, h: 90 })
    .row("zabuton", 330, 620, 2, 60, 0).row("zabuton", 330, 775, 2, 60, 0)
    .item("shoeCabinet", 560, 790)
    .item("chochin", 1040, 600);
  b.roof("gable", -30, -30, 1310, 910, f, "#3f4549");
}

function yakiniku(b: PlanBuilder): void {
  const f = b.floor();
  f.room("客席", 0, 0, 1000, 700, C.wood, "wood")
    .room("厨房", 1000, 0, 350, 450, C.tile, "tile")
    .room("レジ", 1000, 450, 350, 250, C.gray)
    .walls()
    .door(1000, 150, 1000, 230)
    .open(1000, 470, 1000, 680)
    .door(1150, 700, 1250, 700, { flip: true })
    .window(60, 0, 940, 0).window(0, 80, 0, 620);
  for (const [x, y] of [[80, 120], [380, 120], [680, 120], [80, 420], [380, 420], [680, 420]]) {
    f.item("table", x, y, { w: 120, h: 80, color: "#3f3a36" })
      .item("stove", x + 36, y + 16, { w: 48, h: 48 })
      .row("chair", x + 10, y - 50, 2, 55, 0)
      .row("chair", x + 10, y + 85, 2, 55, 0, { rot: 180 });
  }
  f.item("kitchen", 1285, 100, { rot: 90 })
    .item("fridge", 1020, 360)
    .item("counter", 1080, 560, { w: 200, h: 60 });
  b.roof("flat", -20, -20, 1390, 740, f);
}

function fastFood(b: PlanBuilder): void {
  const f = b.floor();
  f.area("駐車場", 0, 700, 1300, 450, "asphalt", C.asphalt).label(20, 20)
    .room("客席", 0, 0, 800, 700, "#f3e6c4", "tile")
    .room("厨房", 800, 0, 500, 450, C.tile, "tile")
    .room("カウンター", 800, 450, 500, 250, C.gray)
    .walls()
    .door(350, 700, 450, 700)
    .door(800, 150, 800, 230)
    .open(800, 470, 800, 680)
    .door(1180, 450, 1260, 450, { flip: true })
    .window(60, 0, 740, 0, true).window(0, 80, 0, 620, true).window(1300, 500, 1300, 650)
    .item("counter", 830, 560, { w: 300, h: 60 })
    .item("kitchen", 850, 370, { w: 300, h: 65 })
    .item("kitchenIsland", 900, 200, { w: 240, h: 100 })
    .item("fridge", 1220, 20)
    .item("vendingMachine", 650, 600)
    .item("trashCan", 50, 600);
  for (const [x, y] of [[100, 120], [350, 120], [100, 360], [350, 360], [580, 240]]) {
    f.item("roundTable", x, y, { w: 80, h: 80 }).item("chair", x - 50, y + 18).item("chair", x + 85, y + 18);
  }
  f.row("car", 100, 860, 2, 500, 0, { rot: 90 })
    .item("signboard", 1200, 760);
  b.roof("flat", -20, -20, 1340, 740, f, "#c0392b");
}

function bakery(b: PlanBuilder): void {
  const f = b.floor();
  f.room("売り場", 0, 0, 700, 500, "#f3e6c4", "wood")
    .room("工房", 700, 0, 450, 750, C.tile, "tile")
    .room("イートイン", 0, 500, 700, 250, C.wood, "wood")
    .walls()
    .door(300, 750, 400, 750)
    .door(700, 150, 700, 230)
    .open(100, 500, 600, 500)
    .window(60, 0, 640, 0, true).window(0, 560, 0, 700).window(1150, 80, 1150, 420)
    .row("displayShelf", 80, 140, 3, 200, 0, { w: 180, h: 90 })
    .item("showcase", 80, 330, { w: 300, h: 60 })
    .item("counter", 450, 330, { w: 200, h: 60 })
    .item("kitchen", 760, 420, { w: 300, h: 65 })
    .item("kitchenIsland", 800, 220, { w: 240, h: 100 })
    .item("stove", 1080, 100)
    .item("fridge", 1075, 420)
    .item("shelf", 760, 690, { w: 300, h: 45 })
    .row("roundTable", 120, 600, 3, 180, 0, { w: 70, h: 70 })
    .row("chair", 75, 610, 3, 180, 0);
  b.roof("gable", -30, -30, 1210, 810, f, "#b5651d");
}

function florist(b: PlanBuilder): void {
  const f = b.floor();
  f.area("店先", 0, 500, 800, 250, "tile", C.tile).label(20, 20)
    .room("売り場", 0, 0, 550, 500, C.tile, "tile")
    .room("作業場", 550, 0, 250, 500, C.wood, "wood")
    .walls()
    .sliding(150, 500, 400, 500)
    .door(550, 150, 550, 230, { flip: true })
    .window(60, 0, 490, 0, true)
    .row("plantLarge", 40, 150, 4, 0, 80)
    .row("plant", 200, 150, 4, 70, 0).row("plant", 200, 250, 4, 70, 0)
    .item("showcase", 300, 380, { w: 220, h: 60 })
    .item("counter", 600, 380, { w: 170, h: 60 })
    .item("longTable", 600, 120, { w: 170, h: 60 })
    .item("fridge", 720, 20)
    .trace("flowerBed", [[60, 560], [380, 560], [380, 640], [60, 640]])
    .row("plantLarge", 480, 600, 4, 75, 0)
    .item("signboard", 700, 680);
  b.roof("gable", -30, -30, 860, 560, f, "#4f7a3d");
}

function dagashiya(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 500, 900, 250, "soil", C.soil)
    .room("店", 0, 0, 550, 500, C.wood, "wood")
    .room("茶の間", 550, 0, 350, 500, C.tatami, "tatami")
    .walls()
    .door(150, 500, 400, 500, { style: "koshi" })
    .shoji(550, 150, 550, 350)
    .window(60, 0, 490, 0).window(900, 80, 900, 420)
    .row("displayShelf", 60, 120, 2, 210, 0, { w: 180, h: 90 })
    .item("showcase", 80, 320, { w: 300, h: 60 })
    .item("counter", 420, 300, { w: 100, h: 60 })
    .item("chabudai", 680, 200)
    .item("zabuton", 697, 140).item("zabuton", 697, 300)
    .item("tv", 780, 440, { rot: 180 })
    .item("vendingMachine", 650, 550)
    .item("bench", 100, 600, { w: 180, h: 45 })
    .item("signboard", 400, 620)
    .item("trashCan", 820, 600);
  b.roof("gable", -30, -30, 960, 560, f, "#5a5f63");
}

function supermarket(b: PlanBuilder): void {
  const f = b.floor();
  f.area("駐車場", 0, 1000, 1800, 600, "asphalt", C.asphalt).label(40, 40)
    .room("売り場", 0, 0, 1400, 1000, "#eef0f3", "tile").label(30, 30)
    .room("バックヤード", 1400, 0, 400, 600, C.gray, "concrete")
    .room("事務所", 1400, 600, 400, 400, C.cool)
    .walls()
    .sliding(300, 1000, 600, 1000)
    .door(1400, 200, 1400, 300)
    .door(1400, 750, 1400, 830)
    .door(1500, 600, 1580, 600)
    .window(60, 1000, 260, 1000).window(640, 1000, 1340, 1000, true)
    .row("displayShelf", 150, 200, 5, 220, 0, { w: 180, h: 90 })
    .row("displayShelf", 150, 420, 5, 220, 0, { w: 180, h: 90 })
    .row("displayShelf", 150, 640, 5, 220, 0, { w: 180, h: 90 })
    .row("showcase", 300, 20, 6, 170, 0, { w: 160, h: 60 })
    .row("counter", 700, 840, 3, 220, 0, { w: 180, h: 60 })
    .row("fridge", 1430, 120, 4, 80, 0)
    .row("crate", 1450, 250, 4, 80, 0)
    .item("desk", 1500, 800).item("officeChair", 1530, 870)
    .row("car", 100, 1150, 3, 500, 0, { rot: 90 })
    .item("vendingMachine", 1650, 1080);
  b.roof("flat", -20, -20, 1840, 1040, f);
}

function pharmacy(b: PlanBuilder): void {
  const f = b.floor();
  f.room("売り場", 0, 0, 800, 600, C.white, "tile")
    .room("調剤室", 800, 0, 400, 400, C.cool, "tile")
    .room("待合", 800, 400, 400, 200, C.warm)
    .walls()
    .sliding(300, 600, 500, 600)
    .door(800, 150, 800, 230)
    .open(800, 420, 800, 580)
    .door(950, 400, 1030, 400, { flip: true })
    .window(60, 0, 740, 0, true)
    .row("displayShelf", 80, 150, 3, 220, 0, { w: 180, h: 90 })
    .row("displayShelf", 80, 350, 3, 220, 0, { w: 180, h: 90 })
    .item("counter", 600, 500, { w: 180, h: 60 })
    .row("shelf", 830, 60, 3, 120, 0)
    .item("longTable", 880, 200, { w: 200, h: 60 })
    .item("counter", 850, 300, { w: 300, h: 50 })
    .row("bench", 830, 535, 2, 180, 0, { w: 160, h: 45 });
  b.roof("flat", -20, -20, 1240, 640, f);
}

function boutique(b: PlanBuilder): void {
  const f = b.floor();
  f.room("売り場", 0, 0, 900, 600, C.white, "herringbone")
    .room("試着室", 900, 0, 300, 250, "#e7e1d8", "carpet")
    .room("ストック", 900, 250, 300, 350, C.gray)
    .walls()
    .sliding(350, 600, 550, 600)
    .door(900, 100, 900, 180)
    .door(900, 350, 900, 430, { flip: true })
    .window(60, 0, 840, 0, true)
    .row("closet", 60, 150, 3, 260, 0, { w: 200, h: 60 })
    .row("displayShelf", 100, 350, 2, 300, 0, { w: 180, h: 90 })
    .item("counter", 680, 480, { w: 180, h: 60 })
    .item("person", 600, 260)
    .item("armchair", 760, 250)
    .row("curtain", 950, 120, 2, 120, 0, { w: 100, h: 15 })
    .row("shelf", 1150, 320, 3, 0, 90, { rot: 90 })
    .item("crate", 960, 500);
  b.roof("flat", -20, -20, 1240, 640, f);
}

function antiqueShop(b: PlanBuilder): void {
  const f = b.floor();
  f.room("店", 0, 0, 800, 600, "#7a5a3c", "wood")
    .room("奥の間", 800, 0, 350, 600, C.tatami, "tatami")
    .walls()
    .door(300, 600, 400, 600, { style: "koshi" })
    .shoji(800, 200, 800, 400)
    .window(60, 0, 740, 0)
    .item("grandfatherClock", 220, 20)
    .row("shelf", 300, 20, 4, 110, 0)
    .item("showcase", 100, 250, { w: 300, h: 60 })
    .item("treasureChest", 500, 260)
    .item("byobu", 100, 420)
    .item("stepTansu", 500, 450)
    .item("counter", 650, 300, { w: 120, h: 60, rot: 90 })
    .item("chabudai", 930, 250)
    .item("zabuton", 947, 190)
    .item("tokonoma", 950, 515);
  b.roof("gable", -30, -30, 1210, 660, f, "#3f4549");
}

function toyShop(b: PlanBuilder): void {
  const f = b.floor();
  f.room("売り場", 0, 0, 900, 700, "#fdf1d6", "checker")
    .room("レジ", 900, 0, 300, 700, C.warm)
    .walls()
    .sliding(300, 700, 600, 700)
    .open(900, 100, 900, 600)
    .window(60, 0, 840, 0, true)
    .row("displayShelf", 100, 150, 3, 240, 0, { w: 180, h: 90 })
    .row("displayShelf", 100, 380, 3, 240, 0, { w: 180, h: 90 })
    .item("showcase", 120, 580, { w: 300, h: 60 })
    .item("catTower", 700, 560)
    .item("cardboard", 820, 600).item("cardboard", 770, 640)
    .item("counter", 950, 300, { w: 200, h: 60 })
    .item("vendingMachine", 1060, 560)
    .item("treasureChest", 980, 100);
  b.roof("flat", -20, -20, 1240, 740, f, "#d9534f");
}

function barber(b: PlanBuilder): void {
  const f = b.floor();
  f.room("店", 0, 0, 900, 500, "#e8eaee", "checker")
    .room("待合", 900, 0, 300, 500, C.warm)
    .walls()
    .open(900, 80, 900, 420)
    .door(1000, 500, 1100, 500)
    .window(60, 0, 840, 0, true)
    .row("officeChair", 100, 150, 4, 190, 0)
    .row("shelf", 90, 20, 4, 190, 0)
    .row("washbasin", 100, 380, 4, 190, 0, { rot: 180 })
    .item("counter", 950, 350, { w: 200, h: 60 })
    .item("sofa2", 1000, 120)
    .item("tv", 1010, 20)
    .item("plantLarge", 1120, 230);
  b.roof("flat", -20, -20, 1240, 540, f);
}

function laundromat(b: PlanBuilder): void {
  const f = b.floor();
  f.room("", 0, 0, 900, 500, C.white, "tile")
    .walls()
    .sliding(350, 500, 550, 500)
    .window(60, 500, 300, 500).window(600, 500, 840, 500)
    .row("washer", 60, 20, 10, 80, 0)
    .row("washer", 60, 300, 4, 80, 0)
    .row("bench", 500, 330, 1, 0, 0, { w: 300, h: 50 })
    .item("longTable", 500, 200, { w: 300, h: 60 })
    .item("vendingMachine", 780, 380)
    .item("trashCan", 20, 440);
  b.roof("flat", -20, -20, 940, 540, f);
}

function gasStation(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 2000, 1300, "concrete", C.stone)
    .room("事務所", 1400, 100, 500, 400, C.gray).label(20, 20)
    .walls()
    .sliding(1500, 500, 1700, 500)
    .window(1400, 160, 1400, 440).window(1460, 100, 1840, 100)
    .item("counter", 1500, 300, { w: 300, h: 60 })
    .item("displayShelf", 1700, 160, { w: 180, h: 90 })
    .item("vendingMachine", 1780, 380)
    .row("vendingMachine", 400, 520, 4, 280, 0, { w: 80, h: 60 })
    .row("car", 300, 200, 2, 600, 0, { rot: 90 })
    .item("car", 300, 800, { rot: 90 })
    .row("trafficCone", 100, 1150, 6, 300, 0)
    .item("signboard", 1850, 1100)
    .item("drum", 1880, 600).item("drum", 1880, 680);
  b.roof("flat", 200, 380, 1100, 380, f, "#c0392b", { elevation: 200 });
  b.roof("flat", 1380, 80, 540, 440, f);
}

function arcade(b: PlanBuilder): void {
  const f = b.floor();
  f.room("フロア", 0, 0, 1200, 800, "#2c2f4a", "carpet").label(30, 30)
    .room("景品", 1200, 0, 300, 400, C.gray)
    .room("両替", 1200, 400, 300, 400, C.gray)
    .walls()
    .sliding(400, 800, 700, 800)
    .door(1200, 150, 1200, 230, { flip: true })
    .open(1200, 450, 1200, 750)
    .row("vendingMachine", 300, 150, 7, 120, 0)
    .row("vendingMachine", 300, 400, 7, 120, 0, { rot: 180 })
    .row("showcase", 100, 600, 3, 180, 0, { w: 160, h: 60 })
    .item("poolTable", 700, 580, { rot: 90 })
    .item("drumKit", 960, 620)
    .item("displayShelf", 1250, 100, { w: 180, h: 90 })
    .item("counter", 1250, 600, { w: 200, h: 60 })
    .row("bench", 50, 120, 1, 0, 0, { w: 150, h: 45 });
  b.roof("flat", -20, -20, 1540, 840, f);
}

function karaoke(b: PlanBuilder): void {
  const f = b.floor();
  f.room("受付", 0, 0, 500, 400, C.warm)
    .room("ドリンクバー", 0, 400, 500, 300, C.tile, "tile")
    .room("", 500, 0, 150, 1000, "#2c2f4a", "carpet");
  for (let i = 0; i < 4; i += 1) f.room(`${101 + i}`, 650, i * 250, 450, 250, "#3b2f4a", "carpet");
  f.room("厨房", 0, 700, 500, 300, C.tile, "tile")
    .walls()
    .door(200, 0, 300, 0)
    .open(500, 80, 500, 320)
    .open(500, 440, 500, 660)
    .door(500, 800, 500, 880);
  for (let i = 0; i < 4; i += 1) {
    f.door(650, i * 250 + 90, 650, i * 250 + 170, { flip: true })
      .item("sofaCorner", 700, i * 250 + 70, { w: 240, h: 160 })
      .item("table", 830, i * 250 + 120, { w: 100, h: 50 })
      .item("tv", 1050, i * 250 + 90, { rot: 90 });
  }
  f.item("counter", 100, 250, { w: 300, h: 60 })
    .item("vendingMachine", 380, 450).item("vendingMachine", 380, 550)
    .item("longTable", 80, 550, { w: 200, h: 60 })
    .item("kitchen", 30, 920)
    .item("fridge", 300, 720);
  b.roof("flat", -20, -20, 1140, 1040, f);
}

function netCafe(b: PlanBuilder): void {
  const f = b.floor();
  f.room("受付", 0, 0, 400, 400, C.warm)
    .room("マンガの棚", 0, 400, 400, 500, C.wood, "wood")
    .room("個室", 400, 0, 800, 900, "#2c2f4a", "carpet").label(20, 20)
    .walls()
    .door(150, 0, 250, 0)
    .open(100, 400, 300, 400)
    .open(400, 100, 400, 800)
    .item("counter", 80, 250, { w: 240, h: 60 })
    .item("vendingMachine", 300, 30)
    .row("shelf", 20, 500, 4, 0, 100, { rot: 270 })
    .row("shelf", 150, 500, 3, 0, 120, { w: 200, h: 30 });
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const x = 470 + col * 180, y = 120 + row * 260;
      f.item("partition", x - 10, y + 150, { w: 170, h: 30 })
        .item("desk", x, y, { w: 140, h: 60 })
        .item("officeChair", x + 40, y + 70);
    }
  }
  b.roof("flat", -20, -20, 1240, 940, f);
}

function teaHouse(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", -300, -200, 1400, 1100, "gravel", "#e3ddd0")
    .room("茶室", 0, 0, 450, 450, C.tatami, "tatami")
    .room("水屋", 450, 0, 250, 450, C.wood, "wood")
    .walls()
    .door(150, 450, 230, 450, { style: "itado" })
    .shoji(450, 150, 450, 300)
    .window(0, 100, 0, 300).window(100, 0, 350, 0)
    .item("tokonoma", 250, 20)
    .item("hibachi", 200, 200)
    .item("zaisu", 120, 300).item("zaisu", 280, 300)
    .item("cupboard", 600, 40, { rot: 90 })
    .item("washbasin", 520, 380, { rot: 180 })
    .trace("steppingStones", [[190, 480], [250, 650], [400, 800]])
    .item("tsukubai", 60, 560)
    .item("stoneLantern", 500, 560)
    .item("conifer", -250, 600, { w: 160, h: 160 })
    .trace("takegaki", [[-280, 860], [1080, 860]], { height: 150 })
    .item("rock", 750, 650);
  b.roof("hip", -40, -40, 780, 530, f, "#4a4f52");
}

function yatai(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 1200, 800, "asphalt", C.asphalt)
    .room("屋台", 400, 250, 400, 180, C.wood, "wood").label(20, 20)
    .walls()
    .open(420, 430, 780, 430)
    .item("stove", 650, 300)
    .item("counter", 420, 440, { w: 360, h: 50 })
    .row("barStool", 440, 520, 5, 70, 0)
    .item("chochin", 355, 200).item("chochin", 805, 200)
    .row("trafficCone", 100, 700, 2, 900, 0)
    .item("bicycle", 100, 200, { rot: 90 })
    .item("signboard", 860, 500);
  b.roof("gable", 380, 230, 440, 220, f, "#8e3b2f");
}

function classroom(b: PlanBuilder): void {
  const f = b.floor();
  f.room("教室", 0, 0, 900, 800, C.wood, "wood").label(30, 120)
    .room("", 0, 800, 900, 200, C.gray)
    .walls()
    .door(80, 800, 180, 800, { flip: true }).door(720, 800, 820, 800)
    .window(900, 80, 900, 720, true).window(80, 1000, 820, 1000)
    .item("blackboard", 270, 0)
    .item("lectern", 390, 60)
    .item("locker", 20, 700).item("locker", 120, 700)
    .item("shelf", 790, 700);
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 6; col += 1) f.item("schoolDesk", 160 + col * 110, 200 + row * 95, { w: 62, h: 50 });
  }
  b.roof("flat", -20, -20, 940, 1040, f);
}

function lectureHall(b: PlanBuilder): void {
  const f = b.floor();
  f.room("講義室", 0, 0, 1400, 1100, C.wood, "wood").label(40, 1000)
    .room("", 1400, 0, 300, 1100, C.gray)
    .walls()
    .door(1400, 150, 1400, 250, { flip: true }).door(1400, 850, 1400, 950)
    .window(0, 100, 0, 1000, true)
    .item("whiteboard", 500, 10, { w: 400, h: 50 })
    .item("lectern", 640, 90)
    .item("stage", 300, 0, { w: 800, h: 200 });
  for (let row = 0; row < 7; row += 1) {
    f.item("longTable", 150, 280 + row * 100, { w: 500, h: 50 })
      .item("longTable", 750, 280 + row * 100, { w: 500, h: 50 });
  }
  f.row("bench", 1450, 120, 3, 0, 230, { w: 200, h: 50, rot: 90 });
  b.roof("flat", -20, -20, 1740, 1140, f);
}

function clubRoom(b: PlanBuilder): void {
  const f = b.floor();
  f.room("部室", 0, 0, 600, 500, C.wood, "wood").label(20, 20)
    .room("", 0, 500, 600, 150, C.gray)
    .walls()
    .door(250, 500, 330, 500, { flip: true })
    .window(600, 80, 600, 420).window(100, 0, 500, 0)
    .item("longTable", 150, 200, { w: 300, h: 90 })
    .row("chair", 170, 150, 4, 70, 0)
    .row("chair", 170, 295, 4, 70, 0, { rot: 180 })
    .item("whiteboard", 20, 400, { w: 180, h: 50 })
    .item("sofa2", 420, 400)
    .row("locker", 350, 20, 2, 100, 0, { w: 90, h: 50 })
    .item("tv", 550, 200, { rot: 90 })
    .item("cardboard", 230, 420)
    .item("fan", 30, 120);
  b.roof("flat", -20, -20, 640, 690, f);
}

function schoolRooftop(b: PlanBuilder): void {
  const f = b.floor();
  f.area("屋上", 0, 0, 1600, 1000, "concrete", C.stone).label(40, 40)
    .room("塔屋", 1200, 600, 300, 300, C.gray).label(20, 20)
    .walls()
    .door(1200, 700, 1200, 800)
    .window(1300, 600, 1450, 600)
    .trace("fence", [[20, 20], [1580, 20], [1580, 980], [20, 980], [20, 20]], { height: 220 })
    .row("bench", 300, 400, 3, 300, 0, { w: 180, h: 50 })
    .item("acOutdoor", 1200, 100).item("acOutdoor", 1300, 100)
    .item("drum", 100, 800)
    .item("trashCan", 1120, 880);
  b.roof("flat", 1180, 580, 340, 340, f);
}

function mangaStudio(b: PlanBuilder): void {
  const f = b.floor();
  f.room("仕事場", 0, 0, 800, 600, C.wood, "wood").label(20, 20)
    .room("資料室", 800, 0, 350, 600, C.wood, "wood")
    .room("仮眠室", 0, 600, 400, 300, C.tatami, "tatami")
    .room("台所", 400, 600, 750, 300, C.tile, "tile")
    .walls()
    .door(800, 250, 800, 330)
    .door(150, 600, 230, 600)
    .door(500, 600, 580, 600, { flip: true })
    .door(1000, 900, 1090, 900)
    .window(60, 0, 740, 0, true).window(0, 100, 0, 500)
    .row("desk", 60, 150, 3, 180, 0, { w: 160, h: 70 })
    .row("officeChair", 110, 230, 3, 180, 0, { rot: 180 })
    .row("desk", 60, 400, 3, 180, 0, { w: 160, h: 70 })
    .row("officeChair", 110, 480, 3, 180, 0, { rot: 180 })
    .item("deskL", 620, 380)
    .row("shelf", 830, 100, 4, 0, 100, { w: 290, h: 40 })
    .item("futon", 100, 660).item("futon", 220, 660)
    .item("kitchen", 820, 610)
    .item("fridge", 1070, 610)
    .item("table", 600, 700, { w: 140, h: 80 });
  b.roof("flat", -20, -20, 1190, 940, f);
}

function clinic(b: PlanBuilder): void {
  const f = b.floor();
  f.room("待合室", 0, 0, 700, 500, C.warm)
    .room("受付", 0, 500, 350, 300, C.cool)
    .room("診察室", 700, 0, 450, 400, C.white)
    .room("処置室", 700, 400, 450, 400, C.white)
    .room("", 350, 500, 350, 300, C.gray)
    .walls()
    .sliding(250, 0, 450, 0)
    .door(700, 150, 700, 230)
    .door(700, 550, 700, 630)
    .open(100, 500, 300, 500)
    .open(400, 500, 650, 500)
    .window(0, 80, 0, 420).window(1150, 80, 1150, 340).window(1150, 460, 1150, 740)
    .row("bench", 100, 150, 3, 0, 110, { w: 200, h: 50 })
    .row("bench", 400, 150, 3, 0, 110, { w: 200, h: 50 })
    .item("plantLarge", 620, 20)
    .item("counter", 60, 700, { w: 240, h: 60 })
    .item("shelf", 20, 560, { rot: 270 })
    .item("desk", 900, 80)
    .item("officeChair", 930, 150)
    .item("chair", 830, 180)
    .item("examCouch", 1050, 150)
    .item("hospitalBed", 1000, 520)
    .item("ivStand", 940, 550)
    .item("shelf", 750, 750)
    .item("washbasin", 450, 720, { rot: 180 })
    .item("toilet", 600, 710, { rot: 180 });
  b.roof("flat", -20, -20, 1190, 840, f);
}

function dentist(b: PlanBuilder): void {
  const f = b.floor();
  f.room("待合", 0, 0, 500, 500, C.warm)
    .room("診療室", 500, 0, 700, 500, C.white).label(20, 400)
    .room("受付", 0, 500, 500, 250, C.cool)
    .room("技工室", 500, 500, 700, 250, C.gray)
    .walls()
    .sliding(150, 750, 350, 750)
    .open(500, 80, 500, 420)
    .open(100, 500, 400, 500)
    .door(800, 500, 880, 500)
    .window(560, 0, 1140, 0, true).window(0, 80, 0, 420)
    .row("bench", 80, 150, 2, 0, 140, { w: 220, h: 50 })
    .item("plantLarge", 400, 20);
  for (let i = 0; i < 3; i += 1) {
    f.item("examCouch", 560 + i * 210, 80, { w: 70, h: 180 })
      .item("stool", 650 + i * 210, 180)
      .item("partition", 690 + i * 210, 60, { w: 20, h: 220 });
  }
  f.item("counter", 100, 650, { w: 280, h: 60 })
    .item("longTable", 600, 650, { w: 300, h: 60 })
    .item("shelf", 1000, 680);
  b.roof("flat", -20, -20, 1240, 790, f);
}

function vetClinic(b: PlanBuilder): void {
  const f = b.floor();
  f.room("待合", 0, 0, 500, 500, C.warm)
    .room("診察室", 500, 0, 450, 500, C.white)
    .room("入院室", 950, 0, 400, 500, C.gray)
    .walls()
    .sliding(150, 500, 350, 500)
    .door(500, 200, 500, 280)
    .door(950, 200, 950, 280)
    .window(60, 0, 440, 0).window(1350, 80, 1350, 420)
    .row("bench", 60, 300, 2, 0, 90, { w: 200, h: 50 })
    .item("counter", 300, 80, { w: 160, h: 60, rot: 90 })
    .item("dogHouse", 60, 120)
    .item("catTower", 180, 120)
    .item("examCouch", 650, 200, { w: 90, h: 160 })
    .item("desk", 780, 80)
    .item("officeChair", 810, 150)
    .item("shelf", 780, 440)
    .row("cage", 980, 80, 3, 120, 0, { w: 110, h: 110 })
    .row("cage", 980, 300, 3, 120, 0, { w: 110, h: 110 });
  b.roof("flat", -20, -20, 1390, 540, f);
}

function nursingHome(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", -200, -200, 2000, 1500, "grass", C.grass)
    .room("食堂", 0, 0, 800, 500, C.wood, "wood")
    .room("機能訓練室", 800, 0, 400, 500, C.wood, "wood")
    .room("", 0, 500, 1600, 150, C.wood, "wood")
    .room("浴室", 1200, 0, 400, 500, C.tile, "tile");
  for (let i = 0; i < 4; i += 1) f.room(`${101 + i}`, i * 400, 650, 400, 350, C.wood, "wood");
  f.walls()
    .door(800, 200, 800, 280)
    .door(300, 500, 400, 500).door(950, 500, 1030, 500).door(1300, 500, 1380, 500)
    .door(1600, 540, 1600, 620)
    .window(60, 0, 740, 0, true).window(860, 0, 1140, 0).window(0, 80, 0, 420);
  for (let i = 0; i < 4; i += 1) {
    f.door(i * 400 + 150, 650, i * 400 + 240, 650)
      .window(i * 400 + 80, 1000, i * 400 + 320, 1000)
      .item("hospitalBed", i * 400 + 260, 760)
      .item("wardrobe", i * 400 + 20, 940, { w: 120, h: 45 })
      .item("wheelchair", i * 400 + 60, 760);
  }
  for (const [x, y] of [[120, 150], [420, 150], [120, 360], [420, 360]]) {
    f.item("diningTable", x, y, { w: 160, h: 90 }).row("chair", x + 20, y - 50, 2, 70, 0).row("chair", x + 20, y + 95, 2, 70, 0, { rot: 180 });
  }
  f.item("kitchen", 700, 400, { w: 90, h: 65 })
    .item("vaultingBox", 900, 150, { w: 80, h: 120 })
    .item("ironBar", 900, 350, { w: 240, h: 30 })
    .item("bath", 1300, 250, { w: 200, h: 90 })
    .row("washbasin", 1420, 420, 2, 90, 0, { rot: 180 })
    .trace("flowerBed", [[100, 1100], [600, 1080], [620, 1200], [100, 1220]])
    .row("bench", 900, 1120, 2, 300, 0, { w: 180, h: 50 })
    .item("tree", 1450, 1050, { w: 220, h: 220 });
  b.roof("hip", -40, -40, 1680, 1080, f);
}

function fireStation(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 900, 1600, 500, "concrete", C.stone)
    .room("車庫", 0, 0, 1000, 900, C.stone, "concrete").label(30, 30)
    .room("事務室", 1000, 0, 600, 450, C.gray)
    .room("仮眠室", 1000, 450, 600, 450, C.wood, "wood")
    .walls()
    .sliding(60, 900, 460, 900).sliding(540, 900, 940, 900)
    .door(1000, 150, 1000, 230, { flip: true })
    .door(1000, 600, 1000, 680)
    .window(1600, 80, 1600, 380).window(1600, 520, 1600, 820)
    .item("bus", 200, 150, { w: 250, h: 700, color: "#c0392b", height: 250 })
    .item("bus", 600, 150, { w: 250, h: 700, color: "#c0392b", height: 250 })
    .item("locker", 40, 700)
    .row("coatStand", 920, 200, 4, 0, 120)
    .row("desk", 1100, 100, 3, 150, 0)
    .row("officeChair", 1130, 170, 3, 150, 0)
    .item("whiteboard", 1300, 380, { w: 180, h: 50 })
    .row("bed", 1080, 600, 4, 120, 0, { w: 90, h: 200 })
    .row("trafficCone", 100, 1100, 5, 300, 0);
  b.roof("flat", -20, -20, 1640, 940, f, "#8e1f2a");
}

function cityHall(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 900, 1800, 400, "cobblestone", C.cobble)
    .room("窓口", 0, 0, 1200, 600, C.white, "tile").label(30, 500)
    .room("待合", 0, 600, 1200, 300, C.warm)
    .room("会議室", 1200, 0, 600, 450, C.cool)
    .room("市長室", 1200, 450, 600, 450, C.wood, "wood")
    .walls()
    .sliding(450, 900, 750, 900)
    .open(60, 600, 1140, 600)
    .door(1200, 150, 1200, 230)
    .door(1200, 650, 1200, 730)
    .window(60, 0, 1140, 0, true).window(1800, 60, 1800, 400).window(1800, 500, 1800, 840)
    .row("counter", 60, 380, 5, 220, 0, { w: 200, h: 60 })
    .row("desk", 60, 150, 5, 220, 0)
    .row("officeChair", 90, 220, 5, 220, 0)
    .row("bench", 100, 720, 4, 260, 0, { w: 200, h: 50 })
    .item("longTable", 1300, 150, { w: 400, h: 100 })
    .row("chair", 1320, 95, 5, 75, 0)
    .row("chair", 1320, 255, 5, 75, 0, { rot: 180 })
    .item("desk", 1500, 650, { w: 160, h: 80, symbol: 2 })
    .item("officeChair", 1550, 580, { symbol: 1 })
    .item("sofa2", 1260, 800)
    .item("statue", 300, 1100).item("fountain", 800, 980, { w: 250, h: 250 })
    .row("flowerBed", 1300, 1050, 2, 220, 0);
  b.roof("flat", -20, -20, 1840, 940, f);
}

function postOffice(b: PlanBuilder): void {
  const f = b.floor();
  f.room("窓口", 0, 0, 800, 500, C.white, "tile")
    .room("事務室", 800, 0, 500, 500, C.gray)
    .room("仕分け室", 0, 500, 1300, 350, C.gray, "concrete")
    .walls()
    .sliding(300, 0, 500, 0)
    .open(800, 80, 800, 420)
    .door(1000, 500, 1080, 500)
    .door(1200, 850, 1290, 850)
    .window(0, 80, 0, 420).window(1300, 80, 1300, 420)
    .item("counter", 100, 300, { w: 600, h: 60 })
    .row("bench", 100, 120, 2, 300, 0, { w: 200, h: 50 })
    .item("mailbox", 720, 30)
    .row("desk", 860, 100, 2, 200, 0)
    .row("officeChair", 890, 170, 2, 200, 0)
    .item("safe", 1200, 380)
    .row("longTable", 80, 600, 4, 290, 0, { w: 260, h: 70 })
    .row("crate", 100, 760, 6, 90, 0)
    .item("bicycle", 1100, 520, { rot: 90 });
  b.roof("flat", -20, -20, 1340, 890, f, "#c0392b");
}

function bank(b: PlanBuilder): void {
  const f = b.floor();
  f.room("ロビー", 0, 0, 900, 600, "#eadfca", "marble").label(30, 30)
    .room("事務室", 0, 600, 900, 400, C.gray)
    .room("金庫室", 900, 600, 400, 400, C.darkStone, "steelPlate")
    .room("応接室", 900, 0, 400, 600, C.wood, "wood")
    .walls()
    .sliding(350, 0, 550, 0)
    .open(60, 600, 840, 600)
    .door(900, 800, 900, 880)
    .door(900, 200, 900, 280)
    .window(0, 80, 0, 520, true).window(1300, 80, 1300, 520)
    .row("counter", 60, 520, 4, 210, 0, { w: 190, h: 60 })
    .row("bench", 200, 200, 3, 0, 100, { w: 250, h: 50 })
    .item("plantLarge", 820, 20)
    .item("vendingMachine", 700, 150, { w: 80, h: 60 })
    .row("desk", 60, 700, 4, 210, 0)
    .row("officeChair", 90, 770, 4, 210, 0)
    .row("safe", 940, 700, 4, 80, 0)
    .row("safe", 940, 900, 4, 80, 0)
    .item("sofa", 1000, 150)
    .item("table", 1035, 260, { w: 100, h: 50 })
    .item("sofa", 1000, 340, { rot: 180 });
  b.roof("flat", -20, -20, 1340, 1040, f);
}

function courtroom(b: PlanBuilder): void {
  const f = b.floor();
  f.room("法廷", 0, 0, 1200, 1000, C.wood, "wood").label(30, 900)
    .room("控室", 1200, 0, 400, 500, C.gray)
    .room("裁判官室", 1200, 500, 400, 500, C.wood, "wood")
    .walls()
    .door(500, 1000, 700, 1000)
    .door(1200, 200, 1200, 280)
    .door(1200, 700, 1200, 780)
    .window(0, 100, 0, 500)
    .item("stage", 300, 0, { w: 600, h: 200 })
    .item("counter", 350, 60, { w: 500, h: 70 })
    .row("officeChair", 420, 0, 3, 130, 0, { rot: 180 })
    .item("lectern", 540, 400)
    .item("desk", 150, 380, { w: 200, h: 70 }).item("desk", 850, 380, { w: 200, h: 70 })
    .row("chair", 170, 460, 2, 90, 0).row("chair", 870, 460, 2, 90, 0)
    .row("bench", 150, 650, 2, 0, 110, { w: 400, h: 50 })
    .row("bench", 650, 650, 2, 0, 110, { w: 400, h: 50 })
    .row("chair", 1260, 120, 3, 90, 0)
    .item("desk", 1300, 650)
    .item("officeChair", 1330, 720)
    .item("shelf", 1500, 900);
  b.roof("gable", -30, -30, 1660, 1060, f);
}

function prison(b: PlanBuilder): void {
  const f = b.floor();
  f.area("運動場", 0, 900, 1600, 500, "concrete", C.stone).label(30, 30)
    .room("", 0, 300, 1600, 150, C.gray, "concrete");
  for (let i = 0; i < 5; i += 1) f.room(`${i + 1}`, i * 320, 0, 320, 300, C.darkStone, "concrete");
  f.room("看守室", 0, 450, 500, 450, C.gray)
    .room("食堂", 500, 450, 1100, 450, C.gray, "concrete")
    .walls()
    .door(200, 450, 280, 450)
    .open(560, 450, 1540, 450)
    .door(700, 900, 800, 900)
    .window(0, 520, 0, 820);
  for (let i = 0; i < 5; i += 1) {
    const x = i * 320;
    f.door(x + 120, 300, x + 200, 300)
      .item("bed", x + 20, 80, { w: 80, h: 190 })
      .item("toilet", x + 240, 200, { rot: 180 })
      .item("washbasin", x + 220, 70);
  }
  f.row("desk", 60, 600, 2, 200, 0)
    .row("officeChair", 90, 670, 2, 200, 0)
    .item("locker", 380, 820)
    .row("longTable", 600, 560, 3, 330, 0, { w: 280, h: 70 })
    .row("bench", 600, 650, 3, 330, 0, { w: 280, h: 45 })
    .item("ironBar", 200, 1150)
    .item("bench", 700, 1200, { w: 200, h: 50 })
    .trace("fence", [[10, 1390], [1590, 1390]], { height: 400 });
  b.roof("flat", -20, -20, 1640, 940, f);
}

function funeralHall(b: PlanBuilder): void {
  const f = b.floor();
  f.room("式場", 0, 0, 1000, 800, "#e8e2d4", "carpet").label(30, 700)
    .room("控室", 1000, 0, 450, 400, C.tatami, "tatami")
    .room("受付", 1000, 400, 450, 400, C.warm)
    .walls()
    .door(1000, 150, 1000, 230, { flip: true })
    .door(1000, 550, 1000, 630)
    .door(1150, 800, 1300, 800)
    .window(1450, 80, 1450, 320)
    .item("altar", 380, 40, { w: 240, h: 80 })
    .item("flowerBed", 140, 40, { w: 200, h: 60 })
    .item("flowerBed", 660, 40, { w: 200, h: 60 })
    .item("coffin", 465, 150, { rot: 90 })
    .row("chair", 150, 380, 8, 90, 0)
    .row("chair", 150, 470, 8, 90, 0)
    .row("chair", 150, 560, 8, 90, 0)
    .item("lectern", 800, 250)
    .item("longTable", 1060, 150, { w: 300, h: 80 })
    .row("zabuton", 1080, 100, 4, 70, 0)
    .item("counter", 1100, 600, { w: 250, h: 60 });
  b.roof("gable", -30, -30, 1510, 860, f, "#3f4549");
}

function aquarium(b: PlanBuilder): void {
  const f = b.floor();
  f.room("大水槽", 0, 0, 1200, 700, "#1f3a55", "carpet").label(30, 600)
    .room("通路", 0, 700, 1200, 300, "#1f3a55", "carpet")
    .room("ショップ", 1200, 0, 400, 500, C.warm)
    .room("入口", 1200, 500, 400, 500, C.warm)
    .walls()
    .open(60, 700, 1140, 700)
    .door(1200, 200, 1200, 280, { flip: true })
    .open(1200, 760, 1200, 940)
    .door(1350, 1000, 1450, 1000)
    .item("pond", 150, 40, { w: 900, h: 400, color: "#3a7ca5" })
    .row("bench", 250, 500, 3, 250, 0, { w: 180, h: 50 })
    .row("aquarium", 100, 760, 5, 220, 0, { w: 180, h: 60 })
    .row("aquarium", 100, 920, 5, 220, 0, { w: 180, h: 60, rot: 180 })
    .row("displayShelf", 1250, 120, 2, 0, 160, { w: 180, h: 90 })
    .item("counter", 1300, 420, { w: 200, h: 50 })
    .item("vendingMachine", 1480, 560);
  b.roof("flat", -20, -20, 1640, 1040, f);
}

function theater(b: PlanBuilder): void {
  const f = b.floor();
  f.room("客席", 0, 300, 1400, 800, "#6b1f2a", "carpet").label(30, 700)
    .room("舞台", 200, 0, 1000, 300, C.wood, "wood")
    .room("楽屋", 0, 0, 200, 300, C.gray)
    .room("楽屋", 1200, 0, 200, 300, C.gray)
    .room("ロビー", 0, 1100, 1400, 300, C.warm)
    .walls()
    .open(220, 300, 1180, 300)
    .door(200, 100, 200, 180).door(1200, 100, 1200, 180)
    .door(300, 1100, 400, 1100).door(1000, 1100, 1100, 1100)
    .sliding(600, 1400, 800, 1400)
    .item("stage", 250, 50, { w: 900, h: 230 })
    .item("curtain", 260, 280, { w: 880, h: 15 })
    .item("piano", 1000, 100)
    .item("longTable", 20, 200, { w: 160, h: 50 })
    .item("longTable", 1220, 200, { w: 160, h: 50 })
    .item("counter", 500, 1250, { w: 400, h: 60 })
    .row("bench", 100, 1180, 2, 1000, 0, { w: 200, h: 50 });
  for (let row = 0; row < 6; row += 1) f.row("chair", 250 + (row % 2) * 20, 400 + row * 100, 18, 50, 0);
  b.roof("gable", -30, -30, 1460, 1460, f);
}

function concertHall(b: PlanBuilder): void {
  const f = b.floor();
  f.room("ホール", 0, 0, 1600, 1200, "#8a5a2b", "wood").label(30, 1100)
    .room("ホワイエ", 0, 1200, 1600, 300, C.warm)
    .walls()
    .door(300, 1200, 450, 1200).door(1150, 1200, 1300, 1200)
    .sliding(650, 1500, 950, 1500)
    .item("stage", 300, 30, { w: 1000, h: 300 })
    .item("piano", 500, 80)
    .item("drumKit", 1050, 80)
    .row("chair", 700, 120, 6, 60, 0)
    .row("chair", 700, 200, 6, 60, 0)
    .item("counter", 600, 1350, { w: 400, h: 60 })
    .row("plantLarge", 60, 1300, 2, 1440, 0);
  for (let row = 0; row < 7; row += 1) f.row("chair", 200, 420 + row * 90, 24, 50, 0);
  b.roof("flat", -20, -20, 1640, 1540, f, "#c9ced3");
  b.roof("dome", 100, 50, 1400, 1100, f, "#5a6670", { elevation: 20 });
}

function danceStudio(b: PlanBuilder): void {
  const f = b.floor();
  f.room("スタジオ", 0, 0, 1000, 700, C.wood, "wood").label(30, 600)
    .room("更衣室", 1000, 0, 400, 350, C.gray)
    .room("受付", 1000, 350, 400, 350, C.warm)
    .walls()
    .door(1000, 120, 1000, 200, { flip: true })
    .open(1000, 420, 1000, 640)
    .door(1150, 700, 1250, 700, { flip: true })
    .window(0, 80, 0, 620, true)
    .item("curtain", 100, 0, { w: 800, h: 15 })
    .item("ironBar", 100, 100, { w: 800, h: 30 })
    .item("fan", 930, 620)
    .row("locker", 1040, 120, 3, 110, 0, { w: 90, h: 50 })
    .item("bench", 1100, 260, { w: 200, h: 50 })

    .item("counter", 1100, 500, { w: 200, h: 60 })
    .item("sofa2", 1255, 600);
  b.roof("flat", -20, -20, 1440, 740, f);
}

function recordingStudio(b: PlanBuilder): void {
  const f = b.floor();
  f.room("ブース", 0, 0, 600, 500, "#3b2f4a", "carpet")
    .room("コントロール室", 600, 0, 600, 500, C.gray, "carpet").label(20, 400)
    .room("ロビー", 0, 500, 1200, 250, C.warm)
    .walls()
    .door(600, 100, 600, 180)
    .door(200, 500, 280, 500)
    .door(900, 500, 980, 500)
    .door(1100, 750, 1190, 750)
    .item("drumKit", 300, 100)
    .item("piano", 60, 320)
    .row("stool", 450, 380, 2, 60, 0)
    .item("longTable", 700, 120, { w: 400, h: 90 })
    .row("officeChair", 760, 220, 3, 110, 0)
    .item("sofa", 940, 300)
    .item("sofa2", 100, 600)
    .item("vendingMachine", 1080, 520);
  b.roof("flat", -20, -20, 1240, 790, f);
}

function observatory(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", -400, -400, 1800, 1800, "grass", C.grass)
    .roundRoom("観測室", 500, 500, 400, C.gray, "concrete", [{ angle: 90, width: 120, type: "door" }, { angle: 0, width: 100, type: "window" }]).label(260, 150)
    .item("statue", 465, 465, { w: 70, h: 70, height: 250 })
    .row("desk", 250, 650, 3, 140, 0, { w: 120, h: 60 })
    .row("officeChair", 280, 590, 3, 140, 0)
    .item("shelf", 250, 300, { rot: 270 })
    .trace("pathway", [[500, 920], [500, 1350]], { brush: 120 })
    .item("conifer", -350, -350).item("conifer", 1150, -350).item("tree", 1100, 1100, { w: 220, h: 220 });
  b.roof("dome", 60, 60, 880, 880, f, "#c9ced3");
}

function weddingChapel(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", -300, -200, 1600, 2200, "grass", C.grass)
    .room("チャペル", 0, 0, 1000, 1300, C.white, "marble").label(30, 1200)
    .room("控室", 0, 1300, 1000, 300, C.warm)
    .walls()
    .door(400, 1300, 600, 1300)
    .door(800, 1600, 900, 1600)
    .window(0, 150, 0, 1150, true).window(1000, 150, 1000, 1150, true)
    .item("altar", 400, 60, { w: 200, h: 70, color: "#f4f1ea" })
    .item("rug", 440, 200, { w: 120, h: 1000, color: "#c9a227" })
    .item("piano", 760, 100)
    .row("bench", 80, 350, 7, 0, 120, { w: 330, h: 50, rot: 180 })
    .row("bench", 590, 350, 7, 0, 120, { w: 330, h: 50, rot: 180 })
    .row("plantLarge", 120, 60, 2, 810, 0)
    .item("sofa", 100, 1400)
    .item("wardrobe", 700, 1400)
    .trace("pathway", [[500, 1610], [500, 1980]], { brush: 160 })
    .trace("flowerBed", [[150, 1700], [380, 1680], [380, 1800], [150, 1820]])
    .trace("flowerBed", [[620, 1680], [850, 1700], [850, 1820], [620, 1800]]);
  b.roof("gable", -40, -40, 1080, 1380, f);
  b.roof("flat", -40, 1280, 1080, 360, f);
}

function indoorPool(b: PlanBuilder): void {
  const f = b.floor();
  f.room("プール", 0, 0, 1600, 1000, C.tile, "tile").label(30, 900)
    .room("更衣室", 1600, 0, 500, 500, C.gray)
    .room("更衣室", 1600, 500, 500, 500, C.gray)
    .walls()
    .door(1600, 200, 1600, 280).door(1600, 700, 1600, 780)
    .door(1900, 1000, 2000, 1000)
    .window(60, 0, 1540, 0, true)
    .trace("pond", [[150, 150], [1450, 150], [1450, 750], [150, 750]], { color: "#3fa7c9" })
    .row("bench", 200, 840, 4, 300, 0, { w: 200, h: 50 })
    .row("locker", 1640, 120, 4, 110, 0, { w: 90, h: 50 })
    .row("locker", 1640, 920, 2, 110, 0, { w: 90, h: 50, rot: 180 })
    .row("shower", 1700, 250, 3, 110, 0)
    .row("shower", 1700, 600, 3, 110, 0);
  b.roof("gable", -40, -40, 2180, 1080, f);
}

function schoolGround(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 3000, 2000, "sand", C.sand)
    .room("倉庫", 2600, 100, 300, 400, C.gray).label(20, 20)
    .walls()
    .sliding(2600, 200, 2600, 400)
    .trace("pathway", [[400, 1000], [400, 500], [1500, 400], [2400, 600], [2400, 1400], [1500, 1600], [400, 1500], [400, 1000]], { brush: 120 })
    .row("ironBar", 200, 200, 3, 0, 120, { w: 240, h: 30 })
    .item("jungleGym", 900, 1750, { w: 200, h: 200 })
    .item("slide", 1300, 1700, { rot: 90 })
    .item("sandbox", 2000, 1700, { w: 250, h: 250 })
    .item("vaultingBox", 2700, 600)
    .item("bench", 600, 1850, { w: 200, h: 50 })
    .item("stage", 1300, 20, { w: 400, h: 200 })
    .item("tree", 50, 1700, { w: 250, h: 250 })
    .item("tree", 2650, 1650, { w: 280, h: 280 });
  b.roof("gable", 2580, 80, 340, 440, f);
}

function shoppingStreet(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 2800, 1400, "cobblestone", C.cobble);
  const shops = ["八百屋", "魚屋", "肉屋", "本屋", "花屋", "薬局", "パン屋"];
  shops.forEach((name, i) => {
    const x = i * 400;
    f.room(name, x, 0, 400, 450, C.warm, "tile");
  });
  f.walls();
  shops.forEach((_, i) => {
    const x = i * 400;
    f.sliding(x + 80, 450, x + 320, 450)
      .item("displayShelf", x + 110, 250, { w: 180, h: 90 })
      .item("counter", x + 280, 100, { w: 100, h: 60 });
  });
  f.row("bench", 300, 900, 4, 600, 0, { w: 180, h: 50 })
    .row("gardenLight", 200, 750, 7, 400, 0)
    .item("vendingMachine", 2650, 600)
    .row("bicycle", 2400, 1000, 3, 80, 0)
    .item("busStop", 100, 1200)
    .item("signboard", 1300, 650);
  b.roof("flat", -20, -20, 2840, 490, f, "#7a8288", { elevation: 80 });
  b.roof("gable", -20, 470, 2840, 700, f, "#e3edf2b3", { elevation: 140 });
}

function intersection(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 2400, 2400, "concrete", C.stone)
    .area("", 900, 0, 600, 2400, "asphalt", C.asphalt)
    .area("", 0, 900, 2400, 600, "asphalt", C.asphalt)
    .room("コンビニ", 100, 100, 600, 500, C.white, "tile").label(20, 20)
    .walls()
    .sliding(400, 600, 600, 600)
    .item("counter", 150, 400, { w: 200, h: 60 })
    .row("displayShelf", 380, 150, 2, 0, 120, { w: 180, h: 90 })
    .item("car", 1000, 200)
    .item("car", 1200, 1700)
    .item("bus", 1250, 1000, { rot: 90 })
    .row("utilityPole", 800, 700, 2, 750, 0)
    .item("trafficCone", 880, 1530)
    .item("busStop", 1600, 800)
    .item("phoneBooth", 2100, 1600)
    .item("mailbox", 750, 800)
    .item("manhole", 1170, 1170)
    .item("tree", 1700, 1700, { w: 260, h: 260 })
    .item("vendingMachine", 400, 700)
    .row("bicycle", 100, 1600, 4, 80, 0);
  b.roof("flat", 80, 80, 640, 540, f);
}

function railroadCrossing(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 2400, 1600, "grass", C.grass)
    .area("", 900, 0, 600, 1600, "asphalt", C.asphalt)
    .room("詰所", 200, 1100, 300, 300, C.gray).label(20, 20)
    .walls()
    .door(500, 1200, 500, 1280)
    .trace("railway", [[20, 800], [2380, 800]])
    .row("trafficCone", 920, 580, 2, 520, 0)
    .row("trafficCone", 920, 980, 2, 520, 0)
    .item("car", 1000, 100)
    .item("bicycle", 1300, 1200)
    .row("utilityPole", 600, 500, 2, 1100, 0)
    .item("signboard", 1550, 450)
    .item("desk", 260, 1250, { w: 120, h: 60 })
    .item("tree", 1900, 1200, { w: 260, h: 260 })
    .item("tree", 100, 100, { w: 260, h: 260 });
  b.roof("gable", 180, 1080, 340, 340, f);
}

function parkingLot(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 2400, 1600, "asphalt", C.asphalt)
    .room("管理室", 2100, 1300, 300, 300, C.gray).label(20, 20)
    .walls()
    .door(2100, 1400, 2100, 1480)
    .row("car", 100, 80, 8, 280, 0)
    .row("car", 100, 1000, 6, 280, 0, { rot: 180 })
    .row("trafficCone", 100, 700, 8, 280, 0)
    .item("motorcycle", 1900, 1050)
    .row("gardenLight", 300, 600, 4, 600, 0)
    .item("vendingMachine", 1950, 1450)
    .item("desk", 2160, 1500, { w: 120, h: 60 });
  b.roof("flat", 2080, 1280, 340, 340, f);
}

function harbor(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 2800, 1200, "concrete", C.stone)
    .area("海", 0, 1200, 2800, 800, "water", C.water).label(40, 40)
    .room("倉庫", 100, 100, 800, 600, C.gray, "concrete").label(30, 30)
    .room("事務所", 1000, 100, 400, 400, C.cool)
    .walls()
    .sliding(300, 700, 700, 700)
    .door(1150, 500, 1250, 500)
    .window(1000, 160, 1000, 440)
    .row("crate", 150, 250, 6, 110, 0).row("crate", 150, 350, 6, 110, 0).row("barrel", 160, 500, 8, 85, 0)
    .item("desk", 1100, 200).item("officeChair", 1130, 270)
    .row("crate", 1600, 300, 4, 80, 0)
    .row("drum", 2200, 300, 4, 70, 0)
    .item("car", 1600, 600, { rot: 90 })
    .trace("pathway", [[2000, 1150], [2000, 1700]], { brush: 200 })
    .trace("pathway", [[1000, 1150], [1000, 1500]], { brush: 160 })
    .row("bench", 400, 1050, 2, 300, 0, { w: 200, h: 50 });
  b.roof("gable", 80, 80, 840, 640, f, "#5a6670");
  b.roof("flat", 980, 80, 440, 440, f);
}

function riverside(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 3000, 1800, "grass", C.grass)
    .room("ボート小屋", 2400, 100, 500, 300, C.wood, "wood").label(20, 20)
    .walls()
    .sliding(2500, 400, 2700, 400)
    .trace("river", [[10, 1050], [800, 980], [1600, 1150], [2400, 1000], [2990, 1100]], { brush: 400 })
    .trace("pathway", [[10, 650], [1000, 600], [2000, 700], [2990, 650]], { brush: 150 })
    .trace("pathway", [[1200, 400], [1250, 1600]], { brush: 260 })
    .row("bench", 300, 480, 4, 600, 0, { w: 180, h: 50 })
    .row("tree", 100, 100, 4, 500, 0, { w: 260, h: 260 })
    .row("shrub", 300, 1450, 5, 450, 0)
    .item("campfire", 600, 1550)
    .item("tent", 820, 1580)
    .item("bicycle", 1720, 470, { rot: 90 })
    .row("crate", 2450, 260, 3, 100, 0)
    .item("trashCan", 2300, 490);
  b.roof("gable", 2380, 80, 540, 340, f);
}

function farm(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 3000, 2000, "grass", C.grass)
    .area("畑", 1000, 200, 1800, 800, "soil", C.soil).label(40, 40)
    .area("田んぼ", 1000, 1100, 1800, 800, "water", "#7aa38a").label(40, 40)
    .room("母屋", 100, 200, 700, 500, C.wood, "wood")
    .room("納屋", 100, 900, 600, 500, C.wood, "soil")
    .walls()
    .door(350, 700, 450, 700, { style: "koshi" })
    .sliding(250, 1400, 550, 1400)
    .window(100, 300, 100, 600).window(200, 200, 700, 200)
    .item("irori", 300, 400)
    .item("kotatsu", 550, 350, { w: 140, h: 140 })
    .item("kitchen", 540, 210, { w: 240, h: 60 })
    .item("car", 450, 900)
    .row("crate", 140, 1150, 3, 90, 0)
    .item("barrel", 120, 1290);
  for (let row = 0; row < 6; row += 1) f.trace("flowerBed", [[1150, 360 + row * 110], [2650, 360 + row * 110], [2650, 400 + row * 110], [1150, 400 + row * 110]]);
  f.trace("pathway", [[900, 0], [900, 2000]], { brush: 120 })
    .item("ido", 600, 1700)
    .item("dogHouse", 720, 760)
    .item("tree", 100, 1600, { w: 260, h: 260 });
  b.roof("hip", 70, 170, 760, 560, f, "#6b5a3a");
  b.roof("gable", 70, 870, 660, 560, f, "#6b5a3a");
}

function zoo(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 3000, 2000, "grass", C.grass)
    .area("ゾウ舎", 100, 100, 800, 600, "soil", C.soil).label(40, 40)
    .area("サル山", 1100, 100, 700, 600, "stone", C.stone).label(40, 40)
    .area("ペンギン池", 2000, 100, 900, 600, "concrete", C.stone).label(40, 40)
    .room("売店", 2300, 1500, 600, 400, C.warm).label(20, 20)
    .walls()
    .sliding(2400, 1500, 2700, 1500)
    .trace("fence", [[100, 720], [900, 720]], { height: 150 })
    .trace("fence", [[1100, 720], [1800, 720]], { height: 150 })
    .trace("fence", [[2000, 720], [2900, 720]], { height: 150 })
    .trace("pond", [[300, 300], [600, 260], [700, 450], [400, 550]], { curve: true })
    .item("rock", 1300, 300, { w: 300, h: 200 }).item("rock", 1500, 450, { symbol: 1 })
    .trace("pond", [[2100, 250], [2800, 250], [2800, 600], [2100, 600]], { color: "#3fa7c9" })
    .item("tree", 600, 150, { w: 250, h: 250 })
    .trace("pathway", [[0, 900], [3000, 900]], { brush: 260 })
    .trace("pathway", [[1500, 900], [1500, 1900]], { brush: 200 })
    .row("bench", 300, 1100, 4, 300, 0, { w: 180, h: 50 })
    .item("counter", 2400, 1750, { w: 300, h: 60 })
    .item("vendingMachine", 2780, 1550)
    .row("tree", 100, 1300, 3, 350, 0, { w: 250, h: 250 })
    .item("fountain", 1800, 1300, { w: 260, h: 260 });
  b.roof("gable", 2280, 1480, 640, 440, f, "#d9534f");
}

function amusementPark(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 3200, 2200, "cobblestone", C.cobble)
    .room("お化け屋敷", 2200, 100, 800, 600, "#2c2f4a").label(20, 20)
    .room("売店", 100, 1700, 600, 400, C.warm).label(20, 20)
    .walls()
    .door(2200, 300, 2200, 400).door(3000, 300, 3000, 400)
    .sliding(250, 1700, 550, 1700)
    .item("coffin", 2400, 250).item("cage", 2600, 400).item("fallenPerson", 2800, 450)
    .item("counter", 200, 1900, { w: 300, h: 60 })
    .trace("railway", [[300, 300], [1600, 200], [1900, 800], [1200, 1200], [400, 900], [300, 300]])
    .item("fountain", 1300, 1500, { w: 300, h: 300 })
    .item("parasol", 900, 1600, { w: 220, h: 220 })
    .row("roundTable", 800, 1850, 3, 160, 0, { w: 90, h: 90 })
    .item("swing", 2400, 1200, { w: 300, h: 160 })
    .item("slide", 2900, 1200, { rot: 0 })
    .item("stage", 2200, 1700, { w: 600, h: 300 })
    .row("vendingMachine", 1700, 1950, 3, 110, 0)
    .row("gardenLight", 200, 1200, 5, 400, 0)
    .item("statue", 1100, 600);
  b.roof("hip", 2180, 80, 840, 640, f, "#4a2c4f");
  b.roof("gable", 80, 1680, 640, 440, f, "#d9534f");
}

function cemetery(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 2400, 1800, "gravel", C.gravel)
    .room("管理棟", 1900, 1400, 400, 300, C.wood, "wood").label(20, 20)
    .walls()
    .door(2000, 1400, 2080, 1400)
    .trace("pathway", [[1200, 1790], [1200, 100]], { brush: 160 })
    .trace("pathway", [[100, 900], [2300, 900]], { brush: 120 });
  for (let r = 0; r < 4; r += 1) {
    f.row("grave", 150, 150 + r * 170, 9, 110, 0)
      .row("westernGrave", 1350, 150 + r * 170, 8, 110, 0, { w: 60, h: 90 });
  }
  for (let r = 0; r < 3; r += 1) f.row("grave", 150, 1050 + r * 170, 9, 110, 0);
  f.row("tree", 1350, 1050, 2, 260, 0, { w: 240, h: 240 })
    .item("conifer", 1600, 1300)
    .item("ido", 1950, 1100)
    .row("stoneLantern", 1040, 960, 2, 260, 0)
    .item("bench", 1300, 1600, { w: 180, h: 50 })
    .trace("hedge", [[20, 1780], [1100, 1780]], { brush: 40 })
    .trace("hedge", [[1300, 1780], [2380, 1780]], { brush: 40 });
  b.roof("gable", 1880, 1380, 440, 340, f);
}

function shinkansen(b: PlanBuilder): void {
  const f = b.floor();
  f.room("客室", 0, 0, 2000, 340, "#3d4a6b", "carpet").label(20, 140)
    .room("デッキ", 2000, 0, 300, 340, C.gray).label(100, 130)
    .room("", 2300, 0, 200, 170, C.tile, "tile")
    .room("", 2300, 170, 200, 170, C.tile, "tile")
    .walls()
    .open(2000, 20, 2000, 320)
    .door(2300, 60, 2300, 130, { flip: true })
    .door(2300, 210, 2300, 280, { flip: true })
    .sliding(2100, 0, 2240, 0).sliding(2100, 340, 2240, 340)
    .window(60, 0, 1940, 0, true).window(60, 340, 1940, 340, true);
  for (let i = 0; i < 18; i += 1) {
    const x = 120 + i * 100;
    // 進む向きにそろえた、通路をはさむ2席と2席
    for (const y of [15, 72, 213, 270]) f.item("armchair", x, y, { w: 55, h: 60, rot: 90, color: "#2f4f8f" });
  }
  f.item("toilet", 2400, 60, { rot: 90 })
    .item("washbasin", 2390, 200)
    .item("trashCan", 2020, 270)
    .item("vendingMachine", 2010, 20, { w: 80, h: 60 });
  b.roof("flat", -20, -20, 2540, 380, f, "#e8eaee");
}

function busInterior(b: PlanBuilder): void {
  const f = b.floor();
  f.room("車内", 0, 0, 1100, 250, "#5a6670", "steelPlate").label(20, 100)
    .walls()
    .door(150, 250, 250, 250).door(800, 250, 900, 250)
    .window(60, 0, 1040, 0, true).window(300, 250, 750, 250, true).window(1100, 30, 1100, 220)
    .item("officeChair", 1000, 40, { w: 50, h: 50 })
    .item("counter", 1030, 120, { w: 50, h: 90 });
  for (let i = 0; i < 7; i += 1) f.item("armchair", 260 + i * 100, 10, { w: 50, h: 55, color: "#3f6f5f" }).item("armchair", 310 + i * 100, 10, { w: 50, h: 55, color: "#3f6f5f" });
  for (let i = 0; i < 5; i += 1) f.item("armchair", 300 + i * 90, 185, { w: 50, h: 55, color: "#3f6f5f", rot: 180 });
  f.item("bench", 20, 20, { w: 200, h: 50 });
  b.roof("flat", -10, -10, 1120, 270, f, "#e8eaee");
}

function airplaneCabin(b: PlanBuilder): void {
  const f = b.floor();
  f.room("客室", 300, 0, 2200, 500, "#4a5568", "carpet").label(20, 220)
    .room("ギャレー", 0, 0, 300, 500, C.gray)
    .room("操縦室", 2500, 50, 300, 400, "#2c2f4a")
    .walls()
    .open(300, 100, 300, 400)
    .door(2500, 200, 2500, 300)
    .door(100, 0, 200, 0).door(100, 500, 200, 500)
    .window(400, 0, 2400, 0, true).window(400, 500, 2400, 500, true)
    .item("kitchen", 30, 150, { w: 240, h: 60 })
    .item("fridge", 30, 380);
  for (let i = 0; i < 18; i += 1) {
    const x = 380 + i * 110;
    f.item("armchair", x, 30, { w: 50, h: 55 }).item("armchair", x, 85, { w: 50, h: 55 })
      .item("armchair", x, 360, { w: 50, h: 55 }).item("armchair", x, 415, { w: 50, h: 55 });
  }
  f.row("officeChair", 2620, 140, 2, 0, 160, { w: 60, h: 60 })
    .item("counter", 2700, 150, { w: 60, h: 200 });
  b.roof("flat", -20, -20, 2840, 540, f, "#e8eaee");
}

function submarine(b: PlanBuilder): void {
  const f = b.floor();
  f.room("発令所", 600, 0, 600, 400, "#3b4a52", "steelPlate")
    .room("魚雷室", 0, 0, 600, 400, "#3b4a52", "steelPlate")
    .room("居住区", 1200, 0, 600, 400, "#3b4a52", "steelPlate")
    .room("機関室", 1800, 0, 600, 400, "#3b4a52", "steelPlate")
    .walls()
    .door(600, 160, 600, 240).door(1200, 160, 1200, 240, { flip: true }).door(1800, 160, 1800, 240)
    .item("gardenLight", 865, 175, { w: 30, h: 30, height: 240, color: "#55595f" })
    .row("officeChair", 700, 100, 3, 120, 0)
    .item("counter", 680, 300, { w: 440, h: 60 })
    .row("drum", 100, 250, 4, 110, 0, { w: 60, h: 60 })
    .item("longTable", 100, 100, { w: 400, h: 60 })
    .row("bunkBed", 1250, 100, 4, 130, 0)
    .item("stove", 1850, 120).item("drum", 1950, 120).item("drum", 2050, 120)
    .item("shelf", 2300, 300);
  b.roof("hip", -20, -40, 2440, 480, f, "#3f4549");
}

function guildHall(b: PlanBuilder): void {
  const f = b.floor();
  f.room("受付ホール", 0, 0, 1000, 700, C.wood, "wood").label(30, 600)
    .room("依頼掲示", 1000, 0, 400, 350, C.wood, "wood")
    .room("ギルド長室", 1000, 350, 400, 350, C.wood, "wood")
    .walls()
    .door(400, 700, 600, 700)
    .door(1000, 150, 1000, 230)
    .door(1000, 500, 1000, 580)
    .window(60, 0, 940, 0, true)
    .item("counter", 300, 150, { w: 400, h: 70 })
    .row("barStool", 330, 230, 5, 75, 0)
    .row("roundTable", 100, 380, 3, 300, 0, { w: 100, h: 100 })
    .row("stool", 60, 410, 3, 300, 0).row("stool", 210, 410, 3, 300, 0)
    .item("fireplace", 0, 300, { rot: 270 })
    .row("signboard", 1050, 100, 3, 100, 0)
    .item("shelf", 1300, 250)
    .item("desk", 1150, 500, { w: 160, h: 80 })
    .item("officeChair", 1200, 430)
    .item("treasureChest", 1300, 620)
    .item("barrel", 900, 50);
  b.roof("gable", -30, -30, 1460, 760, f, "#6b3a2a");
}

function weaponShop(b: PlanBuilder): void {
  const f = b.floor();
  f.room("店", 0, 0, 700, 500, C.wood, "wood")
    .room("倉庫", 700, 0, 300, 500, C.wood, "wood")
    .walls()
    .door(250, 500, 350, 500, { flip: true })
    .door(700, 200, 700, 280)
    .window(60, 0, 640, 0)
    .item("counter", 400, 300, { w: 260, h: 60 })
    .row("displayShelf", 60, 100, 2, 200, 0, { w: 180, h: 90 })
    .item("showcase", 60, 380, { w: 250, h: 60 })
    .item("statue", 600, 80)
    .row("barrel", 730, 60, 3, 70, 0)
    .row("crate", 740, 300, 3, 80, 0)
    .item("treasureChest", 820, 420);
  b.roof("gable", -30, -30, 1060, 560, f, "#6b3a2a");
}

function blacksmith(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", -200, -200, 1400, 1100, "soil", C.soil)
    .room("鍛冶場", 0, 0, 700, 500, C.stone, "stone")
    .room("店先", 700, 0, 300, 500, C.wood, "wood")
    .walls()
    .open(700, 80, 700, 420)
    .door(800, 500, 900, 500)
    .window(60, 0, 640, 0)
    .item("fireplace", 250, 0)
    .item("brazier", 400, 150)
    .item("statue", 200, 250, { w: 70, h: 70, height: 90 })
    .item("barrel", 500, 380).item("barrel", 580, 380)
    .item("longTable", 60, 400, { w: 200, h: 60 })
    .item("counter", 760, 300, { w: 200, h: 60 })
    .item("displayShelf", 800, 100, { w: 160, h: 80 })
    .row("crate", 0, 600, 4, 90, 0)
    .item("ido", 600, 650)
    .item("drum", 900, 650);
  b.roof("gable", -30, -30, 1060, 560, f, "#5a3e2b");
}

function alchemistLab(b: PlanBuilder): void {
  const f = b.floor();
  f.room("実験室", 0, 0, 800, 600, C.stone, "stone").label(30, 520)
    .room("書庫", 800, 0, 400, 600, C.wood, "wood")
    .walls()
    .door(800, 250, 800, 330)
    .door(300, 600, 400, 600)
    .window(60, 0, 740, 0)
    .item("fireplace", 300, 0)
    .item("brazier", 100, 150)
    .item("longTable", 250, 250, { w: 300, h: 90 })
    .row("barrel", 600, 100, 2, 0, 80)
    .item("cage", 600, 300, { w: 100, h: 100 })
    .item("treasureChest", 60, 380)
    .item("aquarium", 400, 480, { w: 150, h: 50 })
    .row("shelf", 830, 80, 4, 0, 120, { w: 340, h: 40 })
    .item("armchair", 1050, 520);
  b.roof("gable", -30, -30, 1260, 660, f, "#4a2c4f");
}

function magicSchool(b: PlanBuilder): void {
  const f = b.floor();
  f.room("魔法の教室", 0, 0, 1000, 700, C.wood, "wood").label(30, 620)
    .room("図書室", 1000, 0, 500, 700, C.wood, "wood")
    .room("", 0, 700, 1500, 200, C.stone, "stone")
    .walls()
    .door(400, 700, 500, 700)
    .door(1150, 700, 1250, 700)
    .door(1000, 300, 1000, 380)
    .window(60, 0, 940, 0, true).window(1500, 80, 1500, 620)
    .item("blackboard", 320, 0)
    .item("lectern", 440, 60)
    .item("cage", 820, 60, { w: 100, h: 100 })
    .row("longTable", 150, 250, 3, 0, 110, { w: 300, h: 60 })
    .row("longTable", 550, 250, 3, 0, 110, { w: 300, h: 60 })
    .item("brazier", 60, 60)
    .row("shelf", 1110, 80, 5, 0, 110, { w: 360, h: 40 })
    .item("stairsSpiral", 1300, 730)
    .row("statue", 100, 760, 2, 600, 0);
  const upper = b.floor();
  upper.room("寮", 0, 0, 1500, 900, C.wood, "wood").label(30, 30)
    .walls()
    .window(60, 0, 1440, 0, true)
    .row("bed", 100, 200, 8, 160, 0)
    .row("treasureChest", 110, 450, 8, 160, 0);
  b.roof("gable", -30, -30, 1560, 960, upper, "#4a2c4f");
}

function village(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 3000, 2200, "grass", C.grass)
    .room("宿屋", 200, 200, 600, 500, C.wood, "wood").label(20, 20)
    .room("道具屋", 1100, 200, 500, 400, C.wood, "wood").label(20, 20)
    .room("民家", 2000, 200, 500, 400, C.wood, "wood").label(20, 20)
    .room("教会", 2200, 1300, 600, 700, C.stone, "stone").label(20, 20)
    .room("民家", 200, 1400, 500, 400, C.wood, "wood").label(20, 20)
    .walls()
    .door(450, 700, 550, 700).door(1300, 600, 1400, 600).door(2200, 600, 2300, 600)
    .door(2450, 1300, 2550, 1300).door(400, 1400, 500, 1400)
    .item("longTable", 300, 400, { w: 300, h: 70 }).row("stool", 320, 480, 4, 70, 0)
    .item("counter", 1200, 450, { w: 300, h: 60 }).item("displayShelf", 1400, 320, { w: 180, h: 90 })
    .item("bed", 2350, 280).item("fireplace", 2050, 555)
    .item("altar", 2400, 1400).row("bench", 2300, 1600, 3, 0, 120, { w: 400, h: 50 })
    .item("bed", 550, 1550).item("kitchen", 230, 1700, { w: 200, h: 60 })
    .trace("pathway", [[10, 1000], [1500, 950], [2990, 1050]], { brush: 200 })
    .trace("pathway", [[1800, 970], [1800, 10]], { brush: 160 })
    .trace("pathway", [[2500, 1020], [2500, 1290]], { brush: 160 })
    .item("ido", 1440, 1200)
    .trace("river", [[10, 2130], [2990, 2110]], { brush: 140 })
    .trace("fence", [[900, 1300], [1900, 1300], [1900, 1800], [900, 1800], [900, 1300]], { height: 100 })
    .trace("flowerBed", [[1000, 1400], [1800, 1400], [1800, 1700], [1000, 1700]])
    .row("tree", 2700, 200, 2, 0, 400, { w: 250, h: 250 })
    .item("tree", 900, 300, { w: 200, h: 200 });
  b.roof("gable", 180, 180, 640, 540, f, "#8e3b2f");
  b.roof("gable", 1080, 180, 540, 440, f, "#5a6670");
  b.roof("gable", 1980, 180, 540, 440, f, "#8e3b2f");
  b.roof("gable", 2180, 1280, 640, 740, f, "#3f4549");
  b.roof("gable", 180, 1380, 540, 440, f, "#5a6670");
}

function fort(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", 0, 0, 2400, 2000, "soil", C.soil)
    .room("兵舎", 300, 300, 800, 500, C.wood, "wood").label(20, 20)
    .room("武器庫", 1300, 300, 500, 500, C.stone, "stone").label(20, 20)
    .room("見張り台", 300, 1300, 300, 300, C.wood, "wood").label(20, 20)
    .walls()
    .door(650, 800, 750, 800).door(1500, 800, 1600, 800).door(400, 1300, 500, 1300)
    .row("bunkBed", 350, 400, 6, 120, 0)
    .row("crate", 1350, 420, 4, 100, 0).row("barrel", 1350, 580, 5, 80, 0)
    .item("treasureChest", 1650, 680)
    .item("stairsSpiral", 380, 1420)
    .trace("stoneWall", [[1000, 100], [100, 100], [100, 1900], [2300, 1900], [2300, 100], [1400, 100]], { brush: 100, height: 400 })
    .item("brazier", 1050, 120).item("brazier", 1300, 120)
    .item("campfire", 1100, 1200)
    .row("tent", 1500, 1200, 2, 300, 0)
    .row("statue", 900, 1500, 3, 300, 0, { w: 60, h: 60 })
    .item("ido", 1900, 1500);
  const upper = b.floor();
  upper.room("物見", 300, 1300, 300, 300, C.wood, "wood").label(20, 20)
    .walls()
    .window(300, 1350, 300, 1550).window(600, 1350, 600, 1550).window(350, 1300, 550, 1300).window(350, 1600, 550, 1600)
    .item("brazier", 520, 1320);
  b.roof("flat", 280, 280, 840, 540, f);
  b.roof("flat", 1280, 280, 540, 540, f);
  b.roof("cone", 260, 1260, 380, 380, upper);
}

function colosseum(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", -300, -300, 3000, 3000, "sand", C.sand)
    .roundRoom("闘技場", 1200, 1200, 1200, "#c9b089", "sand", [
      { angle: 90, width: 200, type: "door" }, { angle: 270, width: 200, type: "door" },
      { angle: 0, width: 150, type: "window" }, { angle: 180, width: 150, type: "window" },
    ]).label(1000, 300)
    .item("statue", 1165, 1165, { w: 70, h: 70, height: 300 })
    .row("brazier", 700, 1175, 2, 900, 0)
    .item("cage", 1500, 700)
    .item("treasureChest", 900, 1600)
    .row("bench", 600, 400, 3, 400, 0, { w: 300, h: 60 })
    .row("bench", 600, 1950, 3, 400, 0, { w: 300, h: 60 })
    .item("throne", 1150, 120);
}

function demonCastle(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", -400, -400, 2800, 2800, "soil", "#3a2f35")
    .room("玉座の間", 400, 0, 1200, 900, "#2b2230", "stone").label(40, 800)
    .room("大広間", 400, 900, 1200, 600, "#2b2230", "stone").label(40, 500)
    .room("牢", 0, 0, 400, 700, C.darkStone, "stone")
    .room("宝物庫", 1600, 0, 400, 700, C.darkStone, "stone")
    .walls()
    .door(950, 900, 1050, 900)
    .door(400, 300, 400, 400).door(1600, 300, 1600, 400)
    .door(900, 1500, 1100, 1500, { style: "gate" })
    .item("rug", 920, 150, { w: 160, h: 700, color: "#5a1020" })
    .item("throne", 950, 30, { w: 100, h: 100 })
    .row("brazier", 600, 150, 3, 0, 250).row("brazier", 1350, 150, 3, 0, 250)
    .row("statue", 550, 1000, 3, 300, 0)
    .item("longTable", 700, 1250, { w: 600, h: 80 })
    .row("cage", 60, 100, 2, 0, 250, { w: 120, h: 120 })
    .item("coffin", 250, 480)
    .row("treasureChest", 1650, 100, 3, 0, 150)
    .item("cage", 1800, 500)
    .trace("river", [[1000, -250], [2250, -250], [2250, 2200], [-250, 2200], [-250, -250], [1060, -250]], { brush: 200, color: "#7a1f2a" })
    .trace("pathway", [[1000, 1510], [1000, 2380]], { brush: 200 });
  b.roof("hip", 360, -40, 1280, 940, f, "#2b2230");
  b.roof("cone", 850, 280, 300, 300, f, "#2b2230", { elevation: 280, rise: 900 });
  b.roof("flat", 360, 900, 1280, 620, f, "#2b2230");
  b.roof("hip", -40, -40, 480, 780, f, "#2b2230");
  b.roof("cone", 120, 270, 160, 160, f, "#2b2230", { elevation: 140, rise: 500 });
  b.roof("hip", 1560, -40, 480, 780, f, "#2b2230");
  b.roof("cone", 1720, 270, 160, 160, f, "#2b2230", { elevation: 140, rise: 500 });
}

function labyrinth(b: PlanBuilder): void {
  const f = b.floor();
  f.area("迷宮", 0, 0, 2000, 2000, "stone", C.darkStone).label(40, 40);
  const lines: [number, number, number, number][] = [
    [0, 0, 2000, 0], [0, 2000, 900, 2000], [1100, 2000, 2000, 2000], [0, 0, 0, 2000], [2000, 0, 2000, 2000],
    [300, 300, 1700, 300], [300, 300, 300, 1400], [300, 1700, 1700, 1700], [1700, 300, 1700, 900], [1700, 1100, 1700, 1700],
    [600, 600, 1400, 600], [600, 600, 600, 1400], [600, 1400, 1100, 1400], [1400, 600, 1400, 1400],
    [900, 900, 1100, 900], [900, 900, 900, 1100], [300, 1700, 300, 1400], [1000, 1700, 1000, 2000],
  ];
  for (const [x1, y1, x2, y2] of lines) f.entities.push({ id: f.id + "-w-" + x1 + "-" + y1 + "-" + x2 + "-" + y2, type: "wall", x1, y1, x2, y2 });
  f.item("treasureChest", 960, 1000)
    .item("brazier", 1200, 1000)
    .row("barrel", 100, 100, 3, 70, 0)
    .item("cage", 1800, 1800, { w: 120, h: 120 })
    .item("statue", 450, 450)
    .item("coffin", 1500, 1500)
    .item("fallenPerson", 800, 1800);
  b.roof("flat", -20, -20, 2040, 2040, f, "#3f3a36");
}

function dragonLair(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", -300, -300, 2600, 2200, "soil", "#4a3f38")
    .roundRoom("竜の寝床", 1000, 800, 700, "#5a4a40", "stone", [{ angle: 90, width: 220, type: "door" }]).label(500, 150)
    .item("treasureChest", 900, 900).item("treasureChest", 1050, 950).item("treasureChest", 800, 1050)
    .row("crate", 1150, 700, 3, 80, 0)
    .item("rock", 600, 500, { w: 200, h: 150 }).item("rock", 1250, 500, { w: 200, h: 150, symbol: 1 })
    .item("fallenPerson", 700, 750)
    .item("brazier", 950, 1350)
    .trace("river", [[-250, 1700], [800, 1550], [2250, 1750]], { brush: 160, color: "#c0392b" })
    .trace("pathway", [[1000, 1520], [1000, 1880]], { brush: 200 })
    .item("rock", -200, -200, { w: 300, h: 220 }).item("rock", 1900, -200, { w: 300, h: 220, symbol: 1 });
  b.roof("dome", 280, 80, 1440, 1440, f, "#4a3f38");
}

function treehouse(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", -300, -300, 1600, 1600, "grass", C.grass)
    .room("根元の物置", 200, 200, 600, 600, C.wood, "soil").label(20, 20)
    .walls()
    .door(450, 800, 550, 800, { style: "itado" })
    .item("stairsSpiral", 600, 250)
    .row("crate", 230, 600, 3, 90, 0)
    .item("tree", -250, 900, { w: 300, h: 300 }).item("tree", 900, -250, { w: 300, h: 300 })
    .trace("steppingStones", [[500, 820], [500, 1200]]);
  const upper = b.floor();
  upper.room("ツリーハウス", 100, 100, 800, 800, C.wood, "deck").label(30, 30)
    .walls()
    .window(100, 300, 100, 700).window(900, 300, 900, 700).window(300, 100, 700, 100)
    .item("bed", 150, 500)
    .item("table", 380, 450, { w: 120, h: 80 })
    .row("stool", 400, 400, 2, 60, 0)
    .item("treasureChest", 750, 750)
    .item("rug", 300, 650, { w: 200, h: 140 });
  b.roof("gable", 60, 60, 880, 880, upper, "#4f7a3d");
}

function spaceStation(b: PlanBuilder): void {
  const f = b.floor();
  f.roundRoom("司令室", 800, 800, 500, "#2a3242", "steelPlate", [
    { angle: 0, width: 140, type: "door" }, { angle: 180, width: 140, type: "door" }, { angle: 90, width: 140, type: "door" }, { angle: 270, width: 140, type: "window" },
  ]).label(330, 200)
    .room("居住モジュール", 1300, 650, 900, 300, "#2a3242", "steelPlate").label(20, 20)
    .room("ドッキング", -500, 650, 800, 300, "#2a3242", "steelPlate").label(20, 20)
    .room("温室", 650, 1300, 300, 900, "#2a3242", "grass").label(20, 20)
    .walls()
    .row("officeChair", 650, 650, 3, 110, 0)
    .item("counter", 600, 900, { w: 400, h: 60 })
    .item("statue", 765, 765, { w: 70, h: 70, height: 200 })
    .row("bunkBed", 1350, 840, 4, 210, 0, { w: 100, h: 200, rot: 90 })
    .row("crate", -450, 820, 6, 110, 0)
    .row("flowerBed", 700, 1400, 4, 0, 200, { w: 200, h: 60 });
  b.roof("dome", 280, 280, 1040, 1040, f, "#c9ced3");
  b.roof("flat", 1280, 630, 940, 340, f, "#c9ced3");
  b.roof("flat", -520, 630, 840, 340, f, "#c9ced3");
  b.roof("flat", 630, 1280, 340, 940, f, "#c9ced3");
}

function secretBase(b: PlanBuilder): void {
  const f = b.floor();
  f.room("司令室", 0, 0, 1000, 700, "#2a3242", "steelPlate").label(30, 600)
    .room("格納庫", 1000, 0, 1000, 1200, C.stone, "concrete").label(30, 30)
    .room("研究室", 0, 700, 600, 500, C.white, "tile")
    .room("仮眠室", 600, 700, 400, 500, C.gray)
    .walls()
    .door(1000, 300, 1000, 400)
    .door(200, 700, 300, 700).door(750, 700, 850, 700)
    .sliding(1300, 1200, 1700, 1200)
    .item("counter", 200, 100, { w: 600, h: 80 })
    .row("officeChair", 260, 190, 4, 140, 0)
    .row("tv", 200, 10, 3, 210, 0, { w: 180, h: 40 })
    .item("longTable", 300, 400, { w: 400, h: 100 })
    .item("car", 1300, 200, { color: "#c0392b" })
    .item("motorcycle", 1700, 300)
    .row("drum", 1100, 800, 4, 80, 0)
    .item("longTable", 100, 850, { w: 300, h: 70 })
    .item("aquarium", 100, 1080, { w: 200, h: 60 })
    .row("bunkBed", 650, 850, 3, 110, 0);
  b.roof("flat", -20, -20, 2040, 1240, f);
}

function controlRoom(b: PlanBuilder): void {
  const f = b.floor();
  f.room("管制室", 0, 0, 1400, 900, "#2a3242", "carpet").label(30, 800)
    .room("サーバー室", 1400, 0, 500, 900, C.gray, "steelPlate")
    .walls()
    .door(1400, 400, 1400, 500)
    .door(600, 900, 800, 900)
    .row("tv", 150, 10, 5, 225, 0, { w: 200, h: 40 })
    .row("desk", 150, 250, 6, 180, 0, { w: 160, h: 70 })
    .row("officeChair", 200, 330, 6, 180, 0)
    .row("desk", 150, 500, 6, 180, 0, { w: 160, h: 70 })
    .row("officeChair", 200, 580, 6, 180, 0)
    .row("locker", 1450, 100, 4, 0, 200, { w: 90, h: 60 })
    .row("locker", 1700, 100, 4, 0, 200, { w: 90, h: 60 });
  b.roof("flat", -20, -20, 1940, 940, f);
}

function hauntedHouse(b: PlanBuilder): void {
  const f = b.floor();
  f.area("", -300, -300, 1800, 1700, "soil", "#3a3530")
    .room("広間", 0, 0, 700, 600, "#3b3029", "wood")
    .room("食堂", 700, 0, 500, 600, "#3b3029", "wood")
    .room("書斎", 0, 600, 500, 500, "#3b3029", "wood")
    .room("", 500, 600, 700, 500, "#3b3029", "wood")
    .walls()
    .door(700, 250, 700, 330)
    .door(200, 600, 280, 600)
    .door(500, 800, 500, 880)
    .door(800, 1100, 900, 1100)
    .window(60, 0, 640, 0).window(760, 0, 1140, 0).window(0, 650, 0, 1050)
    .item("grandfatherClock", 600, 20)
    .item("sofa", 200, 300).item("armchair", 100, 150)
    .item("piano", 450, 450)
    .item("diningTable", 800, 200, { w: 300, h: 100 })
    .row("chair", 820, 145, 4, 70, 0).row("chair", 820, 305, 4, 70, 0, { rot: 180 })
    .item("fireplace", 1140, 400, { rot: 90 })
    .row("shelf", 30, 700, 3, 0, 110, { rot: 270 })
    .item("desk", 200, 900)
    .item("coffin", 700, 750, { rot: 90 })
    .item("fallenPerson", 900, 850)
    .item("bloodPool", 1050, 950)
    .item("stairs", 1080, 680)
    .trace("fence", [[-250, 1300], [1450, 1300]], { height: 150, color: "#2b2b2b" })
    .item("westernGrave", -200, 200).item("westernGrave", -200, 400)
    .item("tree", 1250, -250, { w: 220, h: 220 });
  const upper = b.floor();
  upper.room("寝室", 0, 0, 600, 600, "#3b3029", "wood")
    .room("子ども部屋", 600, 0, 600, 600, "#3b3029", "wood")
    .room("屋根裏", 0, 600, 1200, 500, "#3b3029", "wood")
    .walls()
    .door(600, 250, 600, 330).door(200, 600, 280, 600).door(800, 600, 880, 600)
    .window(60, 0, 540, 0).window(660, 0, 1140, 0)
    .item("bedDouble", 200, 200)
    .item("crib", 800, 200)
    .item("person", 950, 400)
    .row("crate", 100, 800, 4, 100, 0)
    .item("cage", 600, 900);
  b.roof("gable", -40, -40, 1280, 1180, upper, "#2b2b2b");
}

function abandonedHospital(b: PlanBuilder): void {
  const f = b.floor();
  f.room("待合", 0, 0, 800, 600, "#8a8a80", "tile")
    .room("診察室", 800, 0, 400, 600, "#8a8a80", "tile")
    .room("手術室", 0, 600, 600, 500, "#7a8a80", "tile")
    .room("霊安室", 600, 600, 600, 500, "#6a6a66", "concrete")
    .walls()
    .sliding(300, 0, 500, 0)
    .door(800, 200, 800, 280)
    .door(200, 600, 280, 600)
    .door(800, 600, 880, 600)
    .window(0, 80, 0, 520).window(1200, 80, 1200, 520)
    .row("bench", 100, 200, 2, 0, 150, { w: 250, h: 50 })
    .item("wheelchair", 600, 300)
    .item("brokenGlass", 400, 450)
    .item("examCouch", 950, 300)
    .item("desk", 1000, 100)
    .item("hospitalBed", 250, 800)
    .item("ivStand", 150, 800)
    .item("bloodPool", 400, 950)
    .row("coffin", 700, 750, 3, 150, 0)
    .item("fallenPerson", 1080, 900, { w: 90, h: 160 });
  b.roof("flat", -20, -20, 1240, 1140, f, "#6a6a66");
}

function abandonedSchool(b: PlanBuilder): void {
  const f = b.floor();
  f.room("教室", 0, 0, 900, 700, "#6b5a48", "wood").label(30, 600)
    .room("", 0, 700, 1500, 200, "#6a6a66", "wood")
    .room("理科室", 900, 0, 600, 700, "#6b5a48", "tile")
    .walls()
    .door(100, 700, 200, 700).door(700, 700, 800, 700).door(1000, 700, 1100, 700)
    .window(60, 0, 840, 0, true).window(960, 0, 1440, 0)
    .item("blackboard", 270, 0)
    .item("lectern", 390, 60)
    .item("brokenGlass", 600, 100)
    .row("schoolDesk", 150, 250, 5, 120, 0, { w: 62, h: 50 })
    .row("schoolDesk", 150, 380, 4, 150, 0, { w: 62, h: 50, rot: 90 })
    .item("schoolDesk", 700, 470, { w: 62, h: 50, rot: 180 })
    .item("fallenPerson", 500, 500)
    .row("longTable", 950, 150, 2, 0, 200, { w: 300, h: 90 })
    .item("cage", 1350, 500)
    .item("statue", 1400, 100, { w: 60, h: 60, height: 170 })
    .item("locker", 1350, 750)
    .item("bloodPool", 300, 780);
  b.roof("flat", -20, -20, 1540, 940, f, "#6a6a66");
}

function sewer(b: PlanBuilder): void {
  const f = b.floor();
  f.area("下水道", 0, 0, 2400, 1200, "concrete", "#5a5a52").label(40, 40)
    .room("制御室", 1900, 900, 500, 300, C.gray).label(20, 20)
    .walls()
    .door(1900, 1000, 1900, 1080)
    .trace("river", [[10, 600], [2390, 600]], { brush: 300, color: "#5a6b4a" })
    .trace("pathway", [[10, 350], [2390, 350]], { brush: 120 })
    .trace("pathway", [[1200, 350], [1200, 850]], { brush: 120 })
    .row("drum", 200, 150, 4, 100, 0)
    .row("barrel", 800, 900, 3, 100, 0)
    .item("manhole", 1170, 100)
    .item("cage", 400, 900)
    .item("fallenPerson", 1580, 110)
    .item("desk", 2000, 1100, { w: 120, h: 60 })
    .row("gardenLight", 300, 300, 4, 600, 0, { w: 30, h: 30 });
  b.roof("flat", 1880, 880, 540, 340, f);
}

const BUILDERS: Record<string, (b: PlanBuilder) => void> = {
  threeStory, mansion, apartment, shareHouse, japaneseHouse, oldFarmhouse, westernMansion, samuraiHouse, lodge, ryokan, hotel, dormitory, cafe,
  restaurant, ramen, izakaya, bar, salon, bookstore, convenience, hospital, school, nursery, library, gymnasium, office, lab, police, policeBox,
  museum, cinema, church, shrine, temple, bathhouse, factory, park, campsite, cruiseShip, sleeperTrain, castle, adventurersInn, wizardTower, dungeon,
  spaceship, oneK, maisonette, towerMansion, twoFamily, logHouse, garageHouse, danchi, courtyardHouse, bungalow, penthouse, tinyHouse,
  japaneseCastle, machiya, nagaya, ninjaHouse, japaneseGarden, onsen, minshuku, guesthouse, capsuleHotel, palace, villa, festival, beach, station,
  kissaten, sushi, yakiniku, fastFood, bakery, florist, dagashiya, supermarket, pharmacy, boutique, antiqueShop, toyShop, barber, laundromat,
  gasStation, arcade, karaoke, netCafe, teaHouse, yatai, classroom, lectureHall, clubRoom, schoolRooftop, mangaStudio, clinic, dentist, vetClinic,
  nursingHome, fireStation, cityHall, postOffice, bank, courtroom, prison, funeralHall, aquarium, theater, concertHall, danceStudio, recordingStudio,
  observatory, weddingChapel, indoorPool, schoolGround, shoppingStreet, intersection, railroadCrossing, parkingLot, harbor, riverside, farm, zoo,
  amusementPark, cemetery, shinkansen, busInterior, airplaneCabin, submarine, guildHall, weaponShop, blacksmith, alchemistLab, magicSchool, village,
  fort, colosseum, demonCastle, labyrinth, dragonLair, treehouse, spaceStation, secretBase, controlRoom, hauntedHouse, abandonedHospital,
  abandonedSchool, sewer,
};

// 地下の階があるテンプレート（下から数えた地下の階の数）
const BASEMENTS: Record<string, number> = { westernMansion: 1 };

export function hasTemplatePlan(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(BUILDERS, key);
}

// テンプレートの間取りのデータ。newId で要素の id を作り、sizes（家具の種類ごとの標準の大きさ）で家具の大きさを決める
export function templatePlan(key: string, newId: (prefix: TemplateIdPrefix) => string, sizes: Record<string, { w: number; h: number }>): TemplatePlan | null {
  const build = BUILDERS[key];
  if (!build) return null;
  const b = planBuilder(newId, sizes);
  build(b);
  return b.plan(BASEMENTS[key] ?? 0);
}
