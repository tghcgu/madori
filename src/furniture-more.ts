// 足した家具・小物（建物の部分・設備・物流・研究・文化施設・娯楽・乗り物・駅・道路・オフィス・家・和風・調査の小物・
// ホラー・人物と動物と怪物・SF・ファンタジー）。どれも部品（箱・円柱・輪・横倒しの円柱・楕円体・傾けた板）で組み、
// 2Dの記号と3Dの形は同じ部品から作る（furniture-shapes.ts の createPartBuilder）。長さは cm、x は右、y は手前（正面）。
// ここは furniture-shapes.ts を型としてだけ読む（読み込みの輪にしない）
import type { PartBuilder, PartMaterialName } from "./furniture-shapes.ts";

export interface MoreDef {
  label: string;
  w: number;
  h: number;
  height: number;
  // 並べる一覧の分類（furniture-catalog.ts の FURNITURE_GROUPS の id）
  group: string;
  // 壁に掛ける・天井から吊るす物（3Dでも床まで下ろさない）
  mounted?: boolean;
  // 机やテーブルの上に置く小物（3Dでは、下にある家具の上にのせる）
  small?: boolean;
  keywords?: string;
}

const DEFS = {
  // ---- 建物の部分・工事 ----
  pillar: { label: "柱", w: 30, h: 30, height: 240, group: "structure", keywords: "はしら" },
  ladder: { label: "はしご", w: 45, h: 20, height: 240, group: "structure", keywords: "はしご 梯子" },
  elevator: { label: "エレベーター", w: 200, h: 200, height: 240, group: "structure", keywords: "えれべーたー 昇降機" },
  trapdoor: { label: "床の扉（地下・床下へ）", w: 100, h: 100, height: 4, group: "structure", keywords: "ゆかのとびら 床下 地下 隠し 跳ね上げ戸" },
  stairsDown: { label: "下り階段（地下へ）", w: 100, h: 250, height: 10, group: "structure", keywords: "くだりかいだん 地下 ちか 階段" },
  debris: { label: "瓦礫", w: 150, h: 120, height: 50, group: "structure", keywords: "がれき 瓦礫 崩れ" },
  wallCrack: { label: "壁のヒビ（壁に重ねる）", w: 150, h: 20, height: 240, group: "structure", keywords: "ひび ヒビ 割れ 亀裂" },
  collapsedWall: { label: "崩れた壁（壁に重ねる）", w: 150, h: 80, height: 120, group: "structure", keywords: "くずれたかべ 崩壊 瓦礫" },
  wallHole: { label: "壁の穴（壁に重ねる）", w: 100, h: 30, height: 200, group: "structure", keywords: "かべのあな 穴 あな" },
  fireEscape: { label: "非常階段（屋外の鉄骨）", w: 200, h: 300, height: 300, group: "structure", keywords: "ひじょうかいだん 非常 鉄骨 外" },
  outdoorStairs: { label: "外階段", w: 120, h: 300, height: 280, group: "structure", keywords: "そとかいだん 外 階段" },
  tempStairs: { label: "仮設階段", w: 100, h: 250, height: 250, group: "structure", keywords: "かせつかいだん 工事 足場" },
  handrail: { label: "手すり", w: 200, h: 10, height: 90, group: "structure", keywords: "てすり" },
  guardrail: { label: "ガードレール", w: 400, h: 30, height: 80, group: "structure", keywords: "がーどれーる 道路" },
  scaffold: { label: "足場", w: 400, h: 100, height: 300, group: "structure", keywords: "あしば 工事 こうじ" },
  barricade: { label: "工事用バリケード", w: 150, h: 40, height: 100, group: "structure", keywords: "ばりけーど 工事 こうじ 通行止め" },
  vent: { label: "換気口", w: 40, h: 40, height: 5, group: "structure", keywords: "かんきこう 通気口 ダクト" },
  duct: { label: "ダクト（天井）", w: 300, h: 50, height: 240, group: "structure", mounted: true, keywords: "だくと 天井 配管" },
  gutter: { label: "排水溝", w: 300, h: 30, height: 3, group: "structure", keywords: "はいすいこう どぶ 溝" },
  grating: { label: "グレーチング", w: 100, h: 50, height: 3, group: "structure", keywords: "ぐれーちんぐ 格子 ふた" },
  sandbags: { label: "土嚢", w: 200, h: 60, height: 60, group: "structure", keywords: "どのう 土のう" },

  // ---- 設備・インフラ ----
  breaker: { label: "ブレーカー", w: 40, h: 12, height: 200, group: "infra", mounted: true, keywords: "ぶれーかー 分電盤 電気" },
  distributionBoard: { label: "配電盤", w: 100, h: 30, height: 200, group: "infra", keywords: "はいでんばん 電気" },
  controlPanel: { label: "制御盤", w: 120, h: 40, height: 180, group: "infra", keywords: "せいぎょばん 操作盤 機械" },
  serviceEntrance: { label: "電気の引込み口", w: 50, h: 30, height: 300, group: "infra", mounted: true, keywords: "ひきこみ 電気メーター メーター" },
  cableRack: { label: "ケーブルラック（天井）", w: 300, h: 30, height: 240, group: "infra", mounted: true, keywords: "けーぶるらっく 電線 配線" },
  pipe: { label: "パイプ", w: 300, h: 20, height: 20, group: "infra", keywords: "ぱいぷ 配管 管" },
  pipeLarge: { label: "太い工業用パイプ", w: 400, h: 60, height: 80, group: "infra", keywords: "ぱいぷ 配管 工場" },
  waterPipe: { label: "水道管", w: 300, h: 25, height: 25, group: "infra", keywords: "すいどうかん 配管 水" },
  valve: { label: "バルブ", w: 40, h: 40, height: 60, group: "infra", keywords: "ばるぶ 弁 ハンドル" },
  pump: { label: "ポンプ", w: 100, h: 70, height: 80, group: "infra", keywords: "ぽんぷ" },
  boiler: { label: "ボイラー", w: 150, h: 120, height: 200, group: "infra", keywords: "ぼいらー 釜" },
  bigTank: { label: "大型タンク", w: 250, h: 250, height: 300, group: "infra", keywords: "たんく 貯水 燃料" },
  emergencyGenerator: { label: "非常用発電機", w: 200, h: 100, height: 150, group: "infra", keywords: "はつでんき 発電 非常" },
  waterTower: { label: "給水塔（高架水槽）", w: 200, h: 200, height: 400, group: "infra", keywords: "きゅうすいとう 水槽 屋上" },
  ventUnit: { label: "換気設備", w: 100, h: 100, height: 100, group: "infra", keywords: "かんき ファン 屋上" },
  antenna: { label: "アンテナ", w: 100, h: 100, height: 300, group: "infra", keywords: "あんてな 屋上 電波" },
  hydrant: { label: "消火栓", w: 70, h: 20, height: 150, group: "infra", keywords: "しょうかせん 消防 火事" },
  securityCamera: { label: "防犯カメラ", w: 20, h: 30, height: 240, group: "infra", mounted: true, keywords: "ぼうはんかめら 監視 カメラ" },
  cardReader: { label: "カードリーダー", w: 10, h: 6, height: 130, group: "infra", mounted: true, keywords: "かーどりーだー 鍵 セキュリティ" },
  alarm: { label: "警報装置", w: 20, h: 10, height: 220, group: "infra", mounted: true, keywords: "けいほう 非常ベル ベル サイレン" },
  sluiceGate: { label: "水門", w: 300, h: 50, height: 200, group: "infra", keywords: "すいもん 水路 川" },

  // ---- 物流・工場 ----
  pallet: { label: "パレット", w: 110, h: 110, height: 15, group: "industry", keywords: "ぱれっと 倉庫" },
  palletStack: { label: "パレット積み", w: 110, h: 110, height: 120, group: "industry", keywords: "ぱれっと 積み 倉庫" },
  container: { label: "貨物コンテナ", w: 244, h: 606, height: 259, group: "industry", keywords: "こんてな 港 倉庫" },
  handCart: { label: "台車", w: 70, h: 100, height: 90, group: "industry", keywords: "だいしゃ 運搬" },
  toolShelf: { label: "工具棚", w: 150, h: 50, height: 180, group: "industry", keywords: "こうぐ 工具 棚" },
  machineTool: { label: "工作機械", w: 150, h: 120, height: 160, group: "industry", keywords: "こうさくきかい 旋盤 工場" },
  portableGenerator: { label: "発電機（持ち運び）", w: 80, h: 60, height: 60, group: "industry", keywords: "はつでんき 発電" },
  industrialTank: { label: "工業用タンク", w: 150, h: 150, height: 200, group: "industry", keywords: "たんく 工場" },
  conveyor: { label: "ベルトコンベア", w: 500, h: 100, height: 80, group: "industry", keywords: "べるとこんべあ 工場 ライン" },
  workbench: { label: "作業台", w: 200, h: 80, height: 85, group: "industry", keywords: "さぎょうだい 工房 万力" },
  materialPile: { label: "資材の山", w: 200, h: 150, height: 80, group: "industry", keywords: "しざい 砂利 砂 山" },
  buildingMaterials: { label: "建築資材（鉄骨・木材）", w: 400, h: 100, height: 60, group: "industry", keywords: "けんちくしざい 鉄骨 木材 工事" },
  palletRack: { label: "大型ラック", w: 400, h: 110, height: 300, group: "industry", keywords: "らっく 倉庫 棚" },

  // ---- 病院・研究 ----
  operatingTable: { label: "手術台", w: 150, h: 220, height: 200, group: "hospital", keywords: "しゅじゅつだい 手術 無影灯" },
  medicineCabinet: { label: "薬品棚", w: 150, h: 50, height: 180, group: "hospital", keywords: "やくひん 薬 棚" },
  morgue: { label: "遺体安置庫", w: 210, h: 120, height: 200, group: "hospital", keywords: "いたいあんちこ 霊安室 安置" },
  labBench: { label: "実験台", w: 200, h: 80, height: 90, group: "hospital", keywords: "じっけんだい 理科 研究" },
  cultureTank: { label: "培養槽", w: 120, h: 120, height: 220, group: "hospital", keywords: "ばいようそう 研究 実験 タンク" },
  serverRack: { label: "サーバーラック", w: 70, h: 100, height: 200, group: "hospital", keywords: "さーばー コンピューター 機械室" },
  fumeHood: { label: "ドラフトチャンバー", w: 150, h: 80, height: 230, group: "hospital", keywords: "どらふと 実験 研究" },
  microscope: { label: "顕微鏡", w: 25, h: 35, height: 40, group: "hospital", small: true, keywords: "けんびきょう 研究 理科" },
  labFreezer: { label: "超低温フリーザー", w: 80, h: 70, height: 190, group: "hospital", keywords: "ふりーざー 冷凍 研究" },
  deconShower: { label: "除染シャワー", w: 100, h: 100, height: 230, group: "hospital", keywords: "じょせん シャワー 研究" },

  // ---- 博物館・教会・図書館 ----
  lectureDesk: { label: "講義室の机（固定席）", w: 360, h: 100, height: 80, group: "culture", keywords: "こうぎしつ 大学 机" },
  bookStack: { label: "両面書架", w: 200, h: 70, height: 180, group: "culture", keywords: "しょか 本棚 図書館" },
  painting: { label: "額縁の絵（壁に掛ける）", w: 150, h: 8, height: 200, group: "culture", mounted: true, keywords: "がくぶち え 絵画 美術館" },
  pedestal: { label: "展示台・彫刻", w: 80, h: 80, height: 160, group: "culture", keywords: "てんじだい 彫刻 美術館 博物館" },
  ropeBarrier: { label: "ロープパーティション", w: 200, h: 20, height: 95, group: "culture", keywords: "ろーぷ 仕切り 美術館" },
  dinosaurSkeleton: { label: "恐竜の骨格標本", w: 600, h: 300, height: 400, group: "culture", keywords: "きょうりゅう 化石 博物館" },
  pipeOrgan: { label: "パイプオルガン", w: 200, h: 80, height: 400, group: "culture", keywords: "ぱいぷおるがん 教会 楽器" },
  baptismalFont: { label: "洗礼盤", w: 70, h: 70, height: 100, group: "culture", keywords: "せんれいばん 教会" },
  confessional: { label: "告解室", w: 150, h: 120, height: 220, group: "culture", keywords: "こっかいしつ 懺悔 教会" },

  // ---- 遊具・スポーツ・音楽・娯楽 ----
  theaterSeats: { label: "客席（1列）", w: 300, h: 60, height: 90, group: "play", keywords: "きゃくせき 劇場 映画館 ホール" },
  pew: { label: "長椅子（教会）", w: 300, h: 60, height: 90, group: "play", keywords: "ながいす 教会 礼拝" },
  speaker: { label: "スピーカー", w: 60, h: 50, height: 120, group: "play", keywords: "すぴーかー 音響 ライブ" },
  mixingDesk: { label: "音響卓（PA）", w: 150, h: 70, height: 110, group: "play", keywords: "おんきょう ミキサー ライブ" },
  boothSeat: { label: "ボックス席", w: 150, h: 200, height: 110, group: "play", keywords: "ぼっくすせき ファミレス 喫茶 店" },
  banquetTable: { label: "宴会テーブル（8人）", w: 280, h: 280, height: 75, group: "play", keywords: "えんかい パーティー 丸テーブル" },
  pool: { label: "プール", w: 600, h: 1250, height: 5, group: "play", keywords: "ぷーる 水泳" },
  deckChair: { label: "デッキチェア", w: 70, h: 180, height: 60, group: "play", keywords: "でっきちぇあ プールサイド" },
  treadmill: { label: "ランニングマシン", w: 90, h: 200, height: 140, group: "play", keywords: "らんにんぐ ジム" },
  exerciseBike: { label: "エアロバイク", w: 60, h: 130, height: 120, group: "play", keywords: "えあろばいく ジム" },
  weightBench: { label: "ベンチプレス", w: 150, h: 160, height: 130, group: "play", keywords: "べんちぷれす ジム 筋トレ" },
  dumbbellRack: { label: "ダンベルラック", w: 150, h: 50, height: 80, group: "play", keywords: "だんべる ジム 筋トレ" },

  // ---- 乗り物・船 ----
  trainCar: { label: "電車・客車", w: 300, h: 2000, height: 380, group: "vehicles", keywords: "でんしゃ 列車 客車" },
  locomotive: { label: "機関車", w: 300, h: 1600, height: 400, group: "vehicles", keywords: "きかんしゃ SL 汽車" },
  van: { label: "バン", w: 190, h: 470, height: 200, group: "vehicles", keywords: "ばん ワゴン 車" },
  truck: { label: "トラック", w: 250, h: 800, height: 300, group: "vehicles", keywords: "とらっく 車" },
  policeCar: { label: "パトカー", w: 180, h: 470, height: 160, group: "vehicles", keywords: "ぱとかー 警察 車" },
  ambulance: { label: "救急車", w: 200, h: 560, height: 250, group: "vehicles", keywords: "きゅうきゅうしゃ 病院 車" },
  fireTruck: { label: "消防車", w: 250, h: 850, height: 300, group: "vehicles", keywords: "しょうぼうしゃ 消防 車" },
  excavator: { label: "ショベルカー", w: 300, h: 600, height: 300, group: "vehicles", keywords: "しょべるかー 工事 重機" },
  bulldozer: { label: "ブルドーザー", w: 350, h: 500, height: 300, group: "vehicles", keywords: "ぶるどーざー 工事 重機" },
  craneTruck: { label: "クレーン車", w: 280, h: 1000, height: 350, group: "vehicles", keywords: "くれーん 工事 重機" },
  forklift: { label: "フォークリフト", w: 120, h: 250, height: 210, group: "vehicles", keywords: "ふぉーくりふと 倉庫" },
  tank: { label: "戦車", w: 350, h: 700, height: 240, group: "vehicles", keywords: "せんしゃ 軍 ミリタリー" },
  airplane: { label: "飛行機（小型機）", w: 1100, h: 830, height: 280, group: "vehicles", keywords: "ひこうき セスナ 空港" },
  helicopter: { label: "ヘリコプター", w: 1100, h: 1100, height: 300, group: "vehicles", keywords: "へりこぷたー ヘリ" },
  rowboat: { label: "小舟", w: 110, h: 400, height: 60, group: "vehicles", keywords: "こぶね ボート 舟" },
  lifeboat: { label: "救命艇", w: 200, h: 600, height: 250, group: "vehicles", keywords: "きゅうめいてい 船 ボート" },
  lifeRaft: { label: "救命いかだ（コンテナ）", w: 80, h: 120, height: 60, group: "vehicles", keywords: "きゅうめい いかだ 船" },
  anchor: { label: "錨", w: 100, h: 120, height: 20, group: "vehicles", keywords: "いかり アンカー 船 港" },
  mooringBitt: { label: "係船設備（ビット）", w: 60, h: 50, height: 50, group: "vehicles", keywords: "びっと ボラード 港 船" },
  shipWheel: { label: "操舵輪", w: 80, h: 80, height: 120, group: "vehicles", keywords: "そうだりん 舵 船" },
  radarConsole: { label: "レーダー卓", w: 120, h: 80, height: 120, group: "vehicles", keywords: "れーだー 船 艦橋" },
  chartTable: { label: "海図卓", w: 120, h: 80, height: 90, group: "vehicles", keywords: "かいず 地図 船" },
  shipEngine: { label: "船舶エンジン", w: 300, h: 500, height: 250, group: "vehicles", keywords: "えんじん 機関室 船" },
  shipHatch: { label: "船舶用ハッチ", w: 120, h: 120, height: 30, group: "vehicles", keywords: "はっち 船 甲板" },

  // ---- 駅・線路 ----
  railSwitch: { label: "ポイント（分岐器）", w: 400, h: 800, height: 20, group: "station", keywords: "ぽいんと 分岐 線路" },
  bufferStop: { label: "車止め（線路の終端）", w: 200, h: 100, height: 120, group: "station", keywords: "くるまどめ 線路 終点" },
  platformEdge: { label: "ホームの端（点字ブロック）", w: 600, h: 50, height: 3, group: "station", keywords: "ほーむ 点字ブロック 駅" },
  ticketGate: { label: "改札", w: 300, h: 150, height: 100, group: "station", keywords: "かいさつ 駅" },
  ticketMachine: { label: "券売機", w: 80, h: 50, height: 170, group: "station", keywords: "けんばいき 切符 駅" },
  stationSign: { label: "駅名標", w: 150, h: 25, height: 200, group: "station", keywords: "えきめいひょう 看板 駅" },
  kiosk: { label: "駅の売店", w: 200, h: 120, height: 250, group: "station", keywords: "ばいてん キオスク 駅" },

  // ---- 街・道路 ----
  road: { label: "道路（2車線）", w: 600, h: 600, height: 2, group: "street", keywords: "どうろ 車道 道" },
  crosswalk: { label: "横断歩道", w: 400, h: 300, height: 2, group: "street", keywords: "おうだんほどう 道路" },
  parkingStall: { label: "駐車区画", w: 250, h: 500, height: 1, group: "street", keywords: "ちゅうしゃ 駐車場" },
  roadArrow: { label: "路面の矢印", w: 100, h: 200, height: 1, group: "street", keywords: "やじるし 道路" },
  roadSign: { label: "道路標識", w: 60, h: 10, height: 250, group: "street", keywords: "ひょうしき 道路" },
  trafficLight: { label: "信号機", w: 60, h: 40, height: 350, group: "street", keywords: "しんごう 交差点 道路" },
  bollardPost: { label: "車止め（ポール）", w: 30, h: 30, height: 80, group: "street", keywords: "くるまどめ ポール" },
  puddle: { label: "水たまり", w: 120, h: 80, height: 1, group: "street", keywords: "みずたまり 雨" },
  cliff: { label: "崖", w: 400, h: 150, height: 150, group: "street", keywords: "がけ 岩 山" },
  landslide: { label: "土砂", w: 200, h: 150, height: 80, group: "street", keywords: "どしゃ 土砂崩れ 土" },
  siteFence: { label: "工事柵（仮囲い）", w: 300, h: 20, height: 200, group: "street", keywords: "かりがこい 工事 柵" },

  // ---- 学校・オフィス・お店 ----
  officeDesk: { label: "事務机", w: 120, h: 70, height: 72, group: "school", keywords: "じむづくえ 机 オフィス" },
  receptionCounter: { label: "受付カウンター", w: 250, h: 70, height: 110, group: "school", keywords: "うけつけ カウンター フロント" },
  fileCabinet: { label: "書類棚", w: 50, h: 60, height: 130, group: "school", keywords: "しょるい キャビネット 棚" },
  meetingTable: { label: "会議テーブル（6人）", w: 240, h: 180, height: 75, group: "school", keywords: "かいぎ ミーティング" },
  islandDesks: { label: "島型デスク（4席）", w: 250, h: 250, height: 120, group: "school", keywords: "しまがた 机 オフィス" },
  monitorWall: { label: "モニター壁", w: 300, h: 30, height: 250, group: "school", keywords: "もにたー 監視 司令室" },
  operationsTable: { label: "作戦卓", w: 250, h: 180, height: 90, group: "school", keywords: "さくせん 地図 司令室" },
  radioSet: { label: "通信機", w: 50, h: 30, height: 40, group: "school", small: true, keywords: "つうしんき 無線" },
  gunRack: { label: "銃架", w: 150, h: 40, height: 150, group: "school", keywords: "じゅうか 銃 武器" },
  registerCounter: { label: "レジカウンター", w: 150, h: 70, height: 100, group: "shop", keywords: "れじ 会計 コンビニ" },
  fridgeCase: { label: "冷蔵ショーケース", w: 200, h: 60, height: 190, group: "shop", keywords: "れいぞう ショーケース コンビニ" },
  atm: { label: "ATM", w: 70, h: 50, height: 160, group: "shop", keywords: "えーてぃーえむ 銀行" },
  barberChair: { label: "理容椅子", w: 70, h: 110, height: 110, group: "shop", keywords: "りよう 床屋 美容室" },

  // ---- 家の家具 ----
  canopyBed: { label: "天蓋付きベッド", w: 160, h: 210, height: 220, group: "beds", keywords: "てんがい ベッド お姫様" },
  dresser: { label: "ドレッサー", w: 100, h: 45, height: 150, group: "storage", keywords: "どれっさー 鏡台 化粧台" },
  nightstand: { label: "ナイトテーブル", w: 45, h: 40, height: 55, group: "beds", keywords: "ないとてーぶる ベッド サイド" },
  deskSet: { label: "机と椅子", w: 120, h: 120, height: 100, group: "tables", keywords: "つくえ いす 勉強机" },
  roundDining: { label: "丸いダイニング（4人）", w: 170, h: 170, height: 80, group: "tables", keywords: "まるい ダイニング 食卓" },
  kitchenSink: { label: "シンク", w: 100, h: 60, height: 85, group: "kitchen", keywords: "しんく 流し 台所" },
  cooktop: { label: "コンロ", w: 60, h: 60, height: 85, group: "kitchen", keywords: "こんろ ガス 台所" },
  grandPiano: { label: "グランドピアノ", w: 150, h: 190, height: 100, group: "decor", keywords: "ぐらんどぴあの 楽器" },
  gramophone: { label: "蓄音機", w: 45, h: 45, height: 80, group: "decor", keywords: "ちくおんき レコード 昭和" },

  // ---- 和風・神社 ----
  zataku: { label: "座卓", w: 150, h: 90, height: 33, group: "japanese", keywords: "ざたく 和室 テーブル" },
  engawaDeck: { label: "縁側（板敷き）", w: 400, h: 100, height: 45, group: "japanese", keywords: "えんがわ 和風" },
  katanakake: { label: "刀掛け", w: 80, h: 35, height: 60, group: "japanese", keywords: "かたなかけ 刀 侍" },
  shishiOdoshi: { label: "鹿威し", w: 120, h: 50, height: 80, group: "japanese", keywords: "ししおどし 庭" },
  stoneBridge: { label: "石橋", w: 100, h: 300, height: 40, group: "japanese", keywords: "いしばし 橋 庭" },
  drumBridge: { label: "太鼓橋（木の橋）", w: 150, h: 400, height: 150, group: "japanese", keywords: "たいこばし 橋 庭" },
  pine: { label: "松", w: 300, h: 300, height: 400, group: "japanese", keywords: "まつ 木 庭" },
  bamboo: { label: "竹", w: 200, h: 200, height: 600, group: "japanese", keywords: "たけ 竹林" },
  moss: { label: "苔", w: 200, h: 150, height: 5, group: "japanese", keywords: "こけ 庭" },
  teaHouse: { label: "茶室（建物を外から）", w: 300, h: 300, height: 350, group: "japanese", keywords: "ちゃしつ 庵 建物" },
  temizuya: { label: "手水舎", w: 300, h: 200, height: 300, group: "shrine", keywords: "ちょうずや 神社 参拝" },
  hokora: { label: "祠", w: 80, h: 80, height: 120, group: "shrine", keywords: "ほこら 神社 祀る" },
  buddhaAltar: { label: "須弥壇・本尊", w: 200, h: 120, height: 250, group: "shrine", keywords: "しゅみだん 仏像 寺" },
  templeBell: { label: "梵鐘（鐘楼）", w: 300, h: 300, height: 500, group: "shrine", keywords: "ぼんしょう 鐘 寺" },

  // ---- 人・事件・調査（小物） ----
  clueMarker: { label: "手がかりの印", w: 30, h: 30, height: 5, group: "people", keywords: "てがかり ヒント 調査 虫めがね" },
  dangerMark: { label: "危険の印", w: 40, h: 40, height: 3, group: "people", keywords: "きけん 注意 罠" },
  fingerprintMarker: { label: "指紋の印", w: 20, h: 20, height: 3, group: "people", keywords: "しもん 鑑識 調査" },
  memo: { label: "メモ・紙片", w: 15, h: 10, height: 1, group: "people", small: true, keywords: "めも かみ 手紙" },
  diary: { label: "日記・手帳", w: 20, h: 15, height: 3, group: "people", small: true, keywords: "にっき てちょう 本" },
  keyItem: { label: "鍵", w: 10, h: 4, height: 1, group: "people", small: true, keywords: "かぎ キー" },
  knife: { label: "刃物", w: 30, h: 5, height: 2, group: "people", small: true, keywords: "はもの ナイフ 包丁 凶器" },
  photo: { label: "写真", w: 15, h: 10, height: 1, group: "people", small: true, keywords: "しゃしん" },
  smartphone: { label: "携帯電話", w: 8, h: 15, height: 1, group: "people", small: true, keywords: "けいたい スマホ 電話" },
  pillBottle: { label: "薬瓶", w: 10, h: 8, height: 10, group: "people", small: true, keywords: "くすり 薬 瓶 毒" },
  flashlight: { label: "懐中電灯", w: 25, h: 6, height: 6, group: "people", small: true, keywords: "かいちゅうでんとう ライト" },
  toolbox: { label: "工具箱", w: 50, h: 25, height: 25, group: "people", small: true, keywords: "こうぐ 道具" },
  bag: { label: "鞄", w: 45, h: 20, height: 35, group: "people", small: true, keywords: "かばん バッグ" },
  wallet: { label: "財布", w: 15, h: 10, height: 3, group: "people", small: true, keywords: "さいふ お金" },
  papers: { label: "書類の束", w: 30, h: 22, height: 5, group: "people", small: true, keywords: "しょるい 紙 資料" },
  fileFolder: { label: "ファイル", w: 25, h: 32, height: 3, group: "people", small: true, keywords: "ふぁいる 書類" },
  laptop: { label: "ノートPC", w: 35, h: 25, height: 22, group: "people", small: true, keywords: "のーとぱそこん パソコン PC" },
  voiceRecorder: { label: "録音機", w: 6, h: 12, height: 2, group: "people", small: true, keywords: "ろくおん レコーダー" },
  camera: { label: "カメラ", w: 14, h: 9, height: 8, group: "people", small: true, keywords: "かめら 写真" },
  bulletCasings: { label: "使用済みの薬莢", w: 30, h: 30, height: 2, group: "people", keywords: "やっきょう 銃 発砲" },
  bulletHoles: { label: "弾痕（壁に重ねる）", w: 60, h: 14, height: 200, group: "people", keywords: "だんこん 銃 発砲" },
  burnMark: { label: "焼け跡", w: 150, h: 120, height: 1, group: "people", keywords: "やけあと 火事 焦げ" },
  brokenFurniture: { label: "壊れた家具", w: 120, h: 80, height: 50, group: "people", keywords: "こわれた 家具 荒らされた" },
  keepOutTape: { label: "立入禁止テープ", w: 300, h: 10, height: 100, group: "people", keywords: "たちいりきんし 規制線 警察" },
  boundPerson: { label: "拘束された人", w: 70, h: 80, height: 130, group: "people", keywords: "こうそく 縛られた 人質" },

  // ---- ホラー・オカルト ----
  strangeIdol: { label: "奇妙な像", w: 50, h: 50, height: 80, group: "occult", keywords: "きみょう 像 邪神" },
  jizo: { label: "地蔵", w: 40, h: 40, height: 80, group: "occult", keywords: "じぞう お地蔵さん" },
  magicCircle: { label: "魔法陣", w: 250, h: 250, height: 1, group: "occult", keywords: "まほうじん 儀式 召喚" },
  candelabra: { label: "燭台", w: 40, h: 40, height: 120, group: "occult", keywords: "しょくだい ろうそく 蝋燭" },
  bones: { label: "骨", w: 70, h: 60, height: 15, group: "occult", keywords: "ほね 骸骨 どくろ" },
  humanPod: { label: "培養ポット（人型）", w: 90, h: 90, height: 220, group: "occult", keywords: "ばいよう クローン 実験" },
  sarcophagus: { label: "石棺", w: 120, h: 220, height: 90, group: "occult", keywords: "せっかん 棺 墓" },
  ritualTable: { label: "儀式台", w: 150, h: 100, height: 90, group: "occult", keywords: "ぎしき 生贄 祭壇" },
  chains: { label: "鎖", w: 150, h: 30, height: 5, group: "occult", keywords: "くさり 拘束" },
  stele: { label: "奇妙な石碑", w: 100, h: 50, height: 200, group: "occult", keywords: "せきひ 碑 遺跡" },
  totem: { label: "トーテム", w: 70, h: 70, height: 300, group: "occult", keywords: "とーてむ 柱" },
  offering: { label: "供物", w: 70, h: 50, height: 20, group: "occult", small: true, keywords: "くもつ お供え 供え物" },
  cursedItem: { label: "呪物", w: 30, h: 30, height: 20, group: "occult", small: true, keywords: "じゅぶつ 呪い 人形" },
  fleshMass: { label: "肉塊・異形", w: 120, h: 100, height: 60, group: "occult", keywords: "にくかい 異形 クリーチャー" },
  blackStain: { label: "黒い染み", w: 150, h: 120, height: 1, group: "occult", keywords: "くろいしみ 汚れ" },
  tendrils: { label: "触手の侵食（壁に重ねる）", w: 200, h: 60, height: 240, group: "occult", keywords: "しょくしゅ 蔓 侵食" },
  abyss: { label: "異常な穴", w: 150, h: 150, height: 2, group: "occult", keywords: "あな 深淵 異界" },

  // ---- 人物・動物・怪物 ----
  manFigure: { label: "男性", w: 50, h: 30, height: 170, group: "creatures", keywords: "だんせい 人 ひと NPC" },
  womanFigure: { label: "女性", w: 46, h: 30, height: 160, group: "creatures", keywords: "じょせい 人 ひと NPC" },
  childFigure: { label: "子ども", w: 36, h: 24, height: 120, group: "creatures", keywords: "こども 子供 NPC" },
  elderFigure: { label: "老人", w: 54, h: 40, height: 155, group: "creatures", keywords: "ろうじん お年寄り NPC" },
  policeFigure: { label: "警官", w: 52, h: 30, height: 175, group: "creatures", keywords: "けいかん 警察 おまわりさん NPC" },
  soldierFigure: { label: "兵士", w: 56, h: 40, height: 175, group: "creatures", keywords: "へいし 軍人 兵隊 NPC" },
  doctorFigure: { label: "医師", w: 52, h: 30, height: 172, group: "creatures", keywords: "いし 医者 ドクター NPC" },
  nurseFigure: { label: "看護師", w: 46, h: 30, height: 160, group: "creatures", keywords: "かんごし ナース NPC" },
  scientistFigure: { label: "研究員", w: 52, h: 30, height: 172, group: "creatures", keywords: "けんきゅういん 科学者 NPC" },
  workerFigure: { label: "作業員", w: 52, h: 30, height: 175, group: "creatures", keywords: "さぎょういん 工事 NPC" },
  stationStaffFigure: { label: "駅員", w: 52, h: 30, height: 172, group: "creatures", keywords: "えきいん 駅 NPC" },
  sailorFigure: { label: "船員", w: 52, h: 30, height: 172, group: "creatures", keywords: "せんいん 船乗り NPC" },
  guardFigure: { label: "警備員", w: 52, h: 30, height: 175, group: "creatures", keywords: "けいびいん ガードマン NPC" },
  robedFigure: { label: "ローブ姿", w: 60, h: 44, height: 178, group: "creatures", keywords: "ろーぶ 魔法使い 信者 修道士 NPC" },
  cat: { label: "猫", w: 25, h: 50, height: 30, group: "creatures", keywords: "ねこ ネコ 動物" },
  dog: { label: "犬", w: 30, h: 70, height: 50, group: "creatures", keywords: "いぬ イヌ 動物" },
  bigDog: { label: "大型犬", w: 40, h: 100, height: 75, group: "creatures", keywords: "いぬ 大型犬 動物" },
  bird: { label: "鳥", w: 30, h: 30, height: 25, group: "creatures", keywords: "とり カラス 動物" },
  wildAnimal: { label: "野生動物（熊）", w: 100, h: 170, height: 110, group: "creatures", keywords: "くま 熊 獣 動物" },
  humanoidEnemy: { label: "人型の敵", w: 60, h: 40, height: 185, group: "creatures", keywords: "てき 敵 ゾンビ 影" },
  smallMonster: { label: "小型モンスター（スライム）", w: 50, h: 50, height: 45, group: "creatures", keywords: "すらいむ モンスター 魔物" },
  monster: { label: "モンスター", w: 100, h: 100, height: 150, group: "creatures", keywords: "もんすたー 魔物 獣" },
  largeMonster: { label: "大型モンスター", w: 200, h: 200, height: 300, group: "creatures", keywords: "もんすたー 巨人 オーガ" },
  bossMonster: { label: "強大な敵（竜）", w: 300, h: 300, height: 450, group: "creatures", keywords: "どらごん 竜 ボス" },
  hugeMonster: { label: "超大型の敵", w: 500, h: 500, height: 700, group: "creatures", keywords: "かいじゅう 怪獣 巨大" },

  // ---- SF ----
  sfConsole: { label: "操作卓・コンソール", w: 180, h: 70, height: 110, group: "sf", keywords: "こんそーる 宇宙船 司令室" },
  pilotSeat: { label: "操縦席", w: 80, h: 90, height: 120, group: "sf", keywords: "そうじゅうせき 宇宙船 コックピット" },
  cryoPod: { label: "冷凍睡眠カプセル", w: 90, h: 200, height: 120, group: "sf", keywords: "れいとうすいみん コールドスリープ カプセル" },
  reactor: { label: "動力炉", w: 250, h: 250, height: 300, group: "sf", keywords: "どうりょくろ 炉 エンジン" },
  holoTable: { label: "ホログラム卓", w: 170, h: 170, height: 110, group: "sf", keywords: "ほろぐらむ 宇宙船 作戦" },
  sfHatch: { label: "ハッチ", w: 100, h: 100, height: 10, group: "sf", keywords: "はっち 宇宙船 床" },

  // ---- ファンタジー ----
  weaponRack: { label: "武器ラック", w: 150, h: 50, height: 180, group: "fantasy", keywords: "ぶき 剣 槍 武器庫" },
  armorStand: { label: "鎧", w: 60, h: 50, height: 180, group: "fantasy", keywords: "よろい 甲冑 騎士" },
  cauldron: { label: "大釜", w: 80, h: 80, height: 80, group: "fantasy", keywords: "おおがま 魔女 薬" },
  crystalBall: { label: "水晶玉", w: 50, h: 50, height: 100, group: "fantasy", keywords: "すいしょう 占い 魔法" },
  banner: { label: "旗・タペストリー（壁に掛ける）", w: 100, h: 10, height: 250, group: "fantasy", mounted: true, keywords: "はた 旗 タペストリー 紋章" },
  anvil: { label: "金床", w: 80, h: 40, height: 80, group: "fantasy", keywords: "かなとこ 鍛冶" },
  forge: { label: "鍛冶炉", w: 150, h: 100, height: 150, group: "fantasy", keywords: "かじ 炉 鍛冶屋" },
  questBoard: { label: "依頼掲示板", w: 150, h: 25, height: 200, group: "fantasy", keywords: "いらい 掲示板 クエスト ギルド" },
  spikeTrap: { label: "トゲの罠", w: 100, h: 100, height: 30, group: "fantasy", keywords: "とげ 罠 わな" },
  wallTorch: { label: "壁の松明", w: 25, h: 20, height: 220, group: "fantasy", mounted: true, keywords: "たいまつ 松明 明かり" },
  hay: { label: "干し草", w: 100, h: 70, height: 80, group: "fantasy", keywords: "ほしくさ 藁 牧場" },

  // ---- 天井に付ける物（照明など）。どれも天井（床から260cm）に付く ----
  chandelier: { label: "シャンデリア", w: 90, h: 90, height: 260, group: "ceiling", mounted: true, keywords: "しゃんでりあ 洋館 豪華 照明" },
  pendantLight: { label: "ペンダントライト", w: 40, h: 40, height: 260, group: "ceiling", mounted: true, keywords: "ぺんだんとらいと 吊り下げ 照明 ダイニング" },
  ceilingLight: { label: "シーリングライト", w: 50, h: 50, height: 260, group: "ceiling", mounted: true, keywords: "しーりんぐらいと 照明 天井灯" },
  ceilingFan: { label: "シーリングファン", w: 120, h: 120, height: 260, group: "ceiling", mounted: true, keywords: "しーりんぐふぁん 扇風機 ファン プロペラ" },
  downlight: { label: "ダウンライト", w: 12, h: 12, height: 260, group: "ceiling", mounted: true, keywords: "だうんらいと 照明 埋め込み" },
  spotlightRail: { label: "スポットライト（レール）", w: 150, h: 15, height: 260, group: "ceiling", mounted: true, keywords: "すぽっとらいと ライティングレール 照明 ギャラリー" },
  bareBulb: { label: "裸電球", w: 10, h: 10, height: 260, group: "ceiling", mounted: true, keywords: "はだかでんきゅう 電球 吊り下げ 照明 ホラー" },
  mirrorBall: { label: "ミラーボール", w: 40, h: 40, height: 260, group: "ceiling", mounted: true, keywords: "みらーぼーる ディスコ クラブ ダンス" },
  hangingPlant: { label: "吊り鉢（ハンギングプラント）", w: 50, h: 50, height: 260, group: "ceiling", mounted: true, keywords: "つりばち ハンギング 観葉植物 植物 鉢" },
  ceilingProjector: { label: "プロジェクター（天井）", w: 35, h: 30, height: 260, group: "ceiling", mounted: true, keywords: "ぷろじぇくたー 投影 映写 会議 ホームシアター" },
  ceilingAc: { label: "天井埋め込みエアコン", w: 84, h: 84, height: 260, group: "ceiling", mounted: true, keywords: "てんじょうえあこん 空調 エアコン カセット オフィス" },
  smokeDetector: { label: "火災報知器（煙感知器）", w: 12, h: 12, height: 260, group: "ceiling", mounted: true, keywords: "かさいほうちき 火災 煙 感知器 報知器 消防" },
  sprinkler: { label: "スプリンクラー", w: 8, h: 8, height: 260, group: "ceiling", mounted: true, keywords: "すぷりんくらー 消火 消防 散水" },
} as const;

export type MorePartKind = keyof typeof DEFS;
export const MORE_DEFS: Record<MorePartKind, MoreDef> = DEFS;
export const MORE_PART_KINDS = Object.keys(DEFS) as MorePartKind[];
export const MORE_MOUNTED_KINDS = MORE_PART_KINDS.filter((kind) => (MORE_DEFS[kind] as MoreDef).mounted);
export const MORE_SMALL_KINDS = MORE_PART_KINDS.filter((kind) => (MORE_DEFS[kind] as MoreDef).small);

export function isMorePartKind(kind: string): kind is MorePartKind {
  return Object.prototype.hasOwnProperty.call(DEFS, kind);
}

type Mat = PartMaterialName;

export function moreFurnitureParts(kind: MorePartKind, b: PartBuilder): void {
  const { w, d, height, box, ellipse, ring, disc, sphere, cm, slab, tilted } = b;
  // 上から見た向きを持つ箱（割合）
  const turned = (x: number, y: number, pw: number, pd: number, bottom: number, ph: number, material: Mat, angle: number) =>
    cm("box", x * w, y * d, pw * w, pd * d, bottom * height, ph * height, material, { angle });
  // 椅子（割合の位置と大きさ。背もたれは奥 = y の負の側。facing を -1 にすると背もたれが手前）
  const chair = (x: number, y: number, cw: number, cd: number, seat: number, top: number, material: Mat, facing = 1) => {
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) box(x + sx * cw * 0.38, y + sy * cd * 0.38, cw * 0.1, cd * 0.1, 0, seat, "metal");
    box(x, y, cw, cd, seat, 0.06, material);
    box(x, y - facing * cd * 0.44, cw, cd * 0.12, seat, top - seat, material);
  };
  // 人の形（真上から見て、肩幅が幅いっぱい、頭が中央）。立った姿で、正面は手前
  const figure = (body: Mat, legsMat: Mat, opts: { hat?: Mat; skirt?: boolean; coat?: boolean; hood?: boolean; arms?: Mat } = {}) => {
    for (const sx of [-1, 1]) ellipse(sx * 0.17, 0, 0.24, 0.5, 0, opts.coat || opts.skirt || opts.hood ? 0.3 : 0.47, legsMat);
    if (opts.skirt || opts.coat || opts.hood) ellipse(0, 0, opts.hood ? 0.86 : 0.7, opts.hood ? 0.95 : 0.85, 0.12, 0.38, body, opts.hood ? 0.75 : 0.85);
    ellipse(0, 0, 0.62, 0.7, 0.45, 0.32, body);
    for (const sx of [-1, 1]) ellipse(sx * 0.38, 0.05, 0.2, 0.45, 0.48, 0.3, opts.arms ?? body);
    box(0, 0, 1, 0.66, 0.74, 0.08, body, 0.3);
    ellipse(0, 0, 0.16, 0.26, 0.8, 0.04, "skin");
    if (opts.hood) {
      sphere(0, 0, 0.44, 0.72, 0.8, 0.2, body);
      return;
    }
    sphere(0, 0.02, 0.36, 0.58, 0.82, opts.hat ? 0.15 : 0.17, "skin");
    sphere(0, -0.06, 0.38, 0.6, 0.86, opts.hat ? 0.1 : 0.14, "hair");
    if (opts.hat) {
      ellipse(0, 0.04, 0.46, 0.78, 0.93, 0.025, opts.hat);
      ellipse(0, -0.02, 0.38, 0.6, 0.94, 0.06, opts.hat);
    }
  };
  // 車輪（軸は x）。車の向きは奥行（y）。縦の大きさは高さに対する割合 rise
  const wheels = (xs: number, ys: number[], tire: number, diameter: number, rise: number) => {
    for (const sx of [-1, 1]) for (const y of ys) disc(sx * xs, y, tire, diameter, 0, rise, "black");
  };
  switch (kind) {
    // ---- 建物の部分・工事 ----
    case "pillar":
      box(0, 0, 1, 1, 0, 0.05, "trim");
      box(0, 0, 0.9, 0.9, 0.05, 0.92, "plaster");
      box(0, 0, 1, 1, 0.97, 0.03, "trim");
      break;
    case "ladder":
      for (const sx of [-1, 1]) box(sx * 0.42, 0, 0.12, 0.7, 0, 1, "wood");
      for (let i = 1; i <= 8; i++) disc(0, 0, 0.74, 0.25, i / 9 - 0.01, 0.02, "wood");
      break;
    case "elevator":
      box(0, 0, 1, 1, 0, 0.01, "metal");
      box(0, -0.47, 1, 0.06, 0, 1, "darkSteel");
      for (const sx of [-1, 1]) box(sx * 0.47, 0.03, 0.06, 0.94, 0, 1, "darkSteel");
      for (const sx of [-1, 1]) box(sx * 0.36, 0.47, 0.22, 0.06, 0, 1, "darkSteel");
      for (const sx of [-1, 1]) box(sx * 0.12, 0.47, 0.24, 0.03, 0, 0.9, "metal");
      box(0, 0.47, 0.5, 0.06, 0.9, 0.1, "darkSteel");
      box(0, -0.42, 0.8, 0.03, 0.38, 0.03, "metal");
      box(0.4, 0.42, 0.06, 0.02, 0.42, 0.12, "screen");
      break;
    case "trapdoor":
      box(0, 0, 1, 1, 0, 0.5, "trim");
      for (let i = 0; i < 5; i++) box(-0.4 + i * 0.2, 0, 0.18, 0.9, 0.5, 0.5, "wood");
      for (const y of [-0.3, 0.05]) box(0, y, 0.92, 0.07, 0.95, 0.05, "iron");
      ring(0, 0.3, 0.14, 0.14, 0.8, 0.2, "iron", 0.6);
      break;
    case "stairsDown": {
      // 地下へ下りる階段: 手前から奥へ、だんだん暗くなる段（床の下へ下りていく見た目）。まわりに縁
      const shades: Mat[] = ["concrete", "concrete", "granite", "granite", "darkSteel", "darkSteel", "black", "black"];
      shades.forEach((material, i) => box(0, 0.42 - i * 0.11, 0.88, 0.1, 0, 0.3, material));
      for (const sx of [-1, 1]) box(sx * 0.47, 0, 0.06, 1, 0, 1, "concrete");
      box(0, -0.49, 1, 0.02, 0, 1, "concrete");
      break;
    }
    case "debris": {
      const chunks: [number, number, number, number, number, number, Mat][] = [
        [-0.25, -0.15, 0.3, 0.3, 0.7, 0.3, "concrete"], [0.18, -0.2, 0.28, 0.25, 0.5, -0.4, "concrete"], [0.05, 0.2, 0.3, 0.24, 1, 0.6, "concrete"],
        [-0.3, 0.25, 0.18, 0.2, 0.4, -0.2, "brick"], [0.32, 0.18, 0.2, 0.18, 0.35, 0.9, "granite"], [-0.05, -0.02, 0.16, 0.16, 0.55, 0.2, "brick"],
      ];
      for (const [x, y, cw, cd, ch, angle, material] of chunks) turned(x, y, cw, cd, 0, ch, material, angle);
      sphere(-0.05, 0.05, 0.5, 0.5, 0, 0.35, "granite");
      break;
    }
    case "wallCrack":
      // 壁の両側の面に、黒いヒビ（縦にぎざぎざにつながる線と枝分かれ）
      for (const side of [-1, 1]) {
        [[-0.05, 0, 0.22], [0.03, 0.22, 0.2], [-0.04, 0.42, 0.18], [0.07, 0.6, 0.2], [0, 0.8, 0.2]].forEach(([x, z, h]) => box(x, side * 0.32, 0.025, 0.08, z, h, "black"));
        box(0.14, side * 0.32, 0.12, 0.08, 0.66, 0.015, "black");
        box(-0.15, side * 0.32, 0.12, 0.08, 0.36, 0.015, "black");
      }
      break;
    case "collapsedWall":
      // 崩れた壁: 壁の両側に崩れ落ちた塊と、斜めに倒れかかった壁の板
      for (const side of [-1, 1]) {
        turned(-0.25, side * 0.22, 0.3, 0.25, 0, 0.35, "concrete", 0.4 * side);
        turned(0.2, side * 0.28, 0.22, 0.32, 0, 0.25, "concrete", -0.3 * side);
        sphere(0, side * 0.3, 0.3, 0.35, 0, 0.3, "granite");
      }
      slab(0.15 * w, 0, 0.4 * w, d * 0.9, 0, height, 6, "plaster");
      break;
    case "wallHole":
      // 壁の穴: 壁を貫く暗い楕円（壁の両面から見える）と、足もとに落ちたかけら
      cm("disc", 0, 0, d * 0.5, w * 0.8, height * 0.25, height * 0.75, "black", { angle: Math.PI / 2 });
      for (const side of [-1, 1]) {
        turned(-0.2, side * 0.3, 0.12, 0.15, 0, 0.06, "plaster", 0.5);
        turned(0.18, side * 0.28, 0.14, 0.18, 0, 0.05, "plaster", -0.4);
      }
      break;
    case "fireEscape": {
      // 非常階段: 手前から奥へ上る鉄の段、奥に踊り場、まわりに手すり
      const landing = 0.62, steps = 12;
      for (let i = 0; i < steps; i++) box(0, 0.46 - (i / steps) * 0.62, 0.9, 0.05, ((i + 1) / steps) * landing - 0.02, 0.02, "darkSteel");
      for (const sx of [-1, 1]) slab(sx * (w / 2 - 3), d * 0.15, 5, d * 0.66, 0, landing * height, 5, "darkSteel");
      box(0, -0.33, 1, 0.34, landing - 0.02, 0.02, "darkSteel");
      for (const sx of [-1, 1]) for (const y of [-0.485, -0.17]) box(sx * 0.48, y, 0.04, 0.03, 0, 1, "darkSteel");
      box(0, -0.49, 1, 0.02, 0.97, 0.03, "darkSteel");
      for (const sx of [-1, 1]) box(sx * 0.48, -0.33, 0.04, 0.34, 0.97, 0.03, "darkSteel");
      for (const sx of [-1, 1]) slab(sx * (w / 2 - 2), d * 0.15, 3, d * 0.66, height * 0.3, landing * height, 3, "darkSteel");
      break;
    }
    case "outdoorStairs": {
      const steps = 14, post = 1 - 0.95 * 0.68;
      for (let i = 0; i < steps; i++) box(0, 0.5 - (i + 0.5) / steps, 1, 1 / steps - 0.002, 0, ((i + 1) / steps) * 0.68, "concrete");
      for (const sx of [-1, 1]) for (const y of [0.45, 0, -0.45]) box(sx * 0.47, y, 0.04, 0.03, (0.5 - y) * 0.68, post, "metal");
      for (const sx of [-1, 1]) slab(sx * w * 0.47, 0, w * 0.04, d * 0.9, height * (0.034 + post - 0.03), height * (1 - 0.034 - post + 0.03), 3, "metal");
      break;
    }
    case "tempStairs": {
      const steps = 12;
      for (let i = 0; i < steps; i++) box(0, 0.45 - (i / steps) * 0.85, 0.86, 0.06, ((i + 1) / steps) * 0.62 - 0.02, 0.02, "metal");
      for (const sx of [-1, 1]) for (const y of [0.47, -0.47]) box(sx * 0.46, y, 0.05, 0.04, 0, 1, "metal");
      for (const sx of [-1, 1]) slab(sx * (w / 2 - 2.5), 0, 4, d * 0.9, 0, height * 0.62, 4, "metal");
      for (const sx of [-1, 1]) slab(sx * (w / 2 - 2.5), 0, 3, d * 0.9, height * 0.38, height * 0.62, 3, "yellow");
      break;
    }
    case "handrail":
      for (const x of [-0.48, 0, 0.48]) box(x, 0, 0.02, 0.5, 0, 0.95, "metal");
      disc(0, 0, 1, 0.8, 0.93, 0.07, "metal");
      break;
    case "guardrail":
      for (const x of [-0.45, -0.15, 0.15, 0.45]) ellipse(x, 0.15, 0.03, 0.35, 0, 0.75, "metal");
      box(0, -0.15, 1, 0.3, 0.55, 0.2, "metal");
      box(0, -0.2, 1, 0.2, 0.62, 0.38, "metal");
      break;
    case "scaffold": {
      for (const x of [-0.49, -0.17, 0.17, 0.49]) for (const y of [-0.45, 0.45]) ellipse(x, y, 0.012, 0.05, 0, 1, "metal");
      for (const z of [0.32, 0.65, 0.98]) {
        for (const y of [-0.45, 0.45]) disc(0, y, 1, 0.04, z, 0.016, "metal");
        box(0, 0, 0.96, 0.8, z - 0.03, 0.02, "wood");
      }
      break;
    }
    case "barricade":
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) turned(sx * 0.42, sy * 0.25, 0.04, 0.4, 0, 0.6, "darkSteel", 0);
      for (let i = 0; i < 5; i++) box(-0.4 + i * 0.2, 0, 0.2, 0.25, 0.6, 0.4, i % 2 ? "black" : "yellow");
      break;
    case "vent":
      box(0, 0, 1, 1, 0, 0.6, "metal");
      for (let i = 0; i < 6; i++) box(0, -0.38 + i * 0.152, 0.84, 0.06, 0.6, 0.4, "darkSteel");
      break;
    case "duct":
      // 天井のダクト: 継ぎ目のある四角い管と、吊り金具
      box(0, 0, 1, 0.9, 0.8, 0.17, "metal");
      for (let i = 1; i < 6; i++) box(-0.5 + i / 6, 0, 0.012, 0.94, 0.8, 0.17, "darkSteel");
      for (const x of [-0.35, 0.35]) box(x, 0, 0.01, 0.1, 0.97, 0.03, "darkSteel");
      break;
    case "gutter":
      box(0, 0, 1, 1, 0, 0.6, "concrete");
      box(0, 0, 1, 0.6, 0.6, 0.4, "darkSteel");
      for (let i = 0; i < 30; i++) box(-0.49 + i * (0.98 / 29), 0, 0.006, 0.6, 0.6, 0.4, "black");
      break;
    case "grating":
      box(0, 0, 1, 1, 0, 0.5, "darkSteel");
      for (let i = 0; i < 12; i++) box(-0.46 + i * (0.92 / 11), 0, 0.02, 0.92, 0.5, 0.5, "metal");
      break;
    case "sandbags":
      for (let row = 0; row < 3; row++) for (let i = 0; i < (row === 2 ? 3 : 4); i++) {
        const offset = row === 2 ? 0.125 : 0;
        box(-0.375 + offset + i * 0.25, row === 1 ? -0.1 : 0.1 - (row === 2 ? 0.1 : 0), 0.245, 0.55, row / 3, 1 / 3, "sand", 0.3);
      }
      break;

    // ---- 設備・インフラ ----
    case "breaker":
      box(0, 0, 1, 1, 0.65, 0.35, "enamel");
      for (let i = 0; i < 4; i++) box(-0.3 + i * 0.2, 0.48, 0.12, 0.04, 0.78, 0.08, "black");
      break;
    case "distributionBoard":
      box(0, 0, 1, 1, 0, 1, "enamel");
      for (const x of [-0.25, 0.25]) box(x, 0.49, 0.46, 0.02, 0.05, 0.9, "board");
      for (const x of [-0.05, 0.05]) box(x, 0.495, 0.03, 0.01, 0.45, 0.1, "metal");
      break;
    case "controlPanel":
      box(0, 0, 1, 1, 0, 1, "paint");
      box(0, 0.49, 0.9, 0.02, 0.45, 0.45, "board");
      for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) {
        const mat: Mat = (["led", "redLamp", "amberLamp"] as Mat[])[(row + i) % 3];
        cm("disc", (-0.35 + i * 0.14) * w, d * 0.5 - 1, 2, 6, height * (0.55 + row * 0.12), 6, mat, { angle: Math.PI / 2 });
      }
      box(0, 0.49, 0.8, 0.02, 0.2, 0.15, "screen");
      break;
    case "serviceEntrance":
      // 電気の引込み口: 壁のメーター箱と、上へ伸びる配管
      box(0, 0, 1, 1, 0.45, 0.25, "enamel");
      cm("disc", 0, d * 0.5 - 1, 2, w * 0.4, height * 0.53, w * 0.4, "glass", { angle: Math.PI / 2 });
      ellipse(0, -0.2, 0.16, 0.25, 0.7, 0.3, "darkSteel");
      break;
    case "cableRack":
      box(0, 0, 1, 1, 0.88, 0.02, "metal");
      for (const sy of [-1, 1]) box(0, sy * 0.47, 1, 0.06, 0.88, 0.06, "metal");
      for (const y of [-0.25, 0, 0.25]) disc(0, y, 1, 0.2, 0.9, 0.025, (["black", "red", "blue"] as Mat[])[Math.round((y + 0.25) * 4)]);
      for (const x of [-0.4, 0, 0.4]) box(x, 0, 0.01, 0.1, 0.94, 0.06, "darkSteel");
      break;
    case "pipe":
      disc(0, 0, 1, 0.8, 0, 0.8, "metal");
      for (const x of [-0.45, 0, 0.45]) disc(x, 0, 0.03, 1, 0, 1, "darkSteel");
      break;
    case "pipeLarge":
      for (const x of [-0.35, 0.35]) box(x, 0, 0.06, 1, 0, 0.3, "concrete");
      disc(0, 0, 1, 0.9, 0.2, 0.7, "steel");
      for (const x of [-0.25, 0.25]) disc(x, 0, 0.03, 1, 0.16, 0.78, "darkSteel");
      box(0, 0, 0.02, 0.4, 0.9, 0.1, "darkSteel");
      break;
    case "waterPipe":
      disc(0, 0, 1, 0.8, 0, 0.8, "pipeBlue");
      for (const x of [-0.4, 0.4]) disc(x, 0, 0.04, 1, 0, 1, "metal");
      break;
    case "valve":
      disc(0, 0, 1, 0.4, 0, 0.3, "pipeBlue");
      ellipse(0, 0, 0.4, 0.4, 0.2, 0.4, "red");
      ellipse(0, 0, 0.08, 0.08, 0.5, 0.4, "metal");
      ring(0, 0, 0.9, 0.9, 0.9, 0.1, "red", 0.8);
      break;
    case "pump":
      box(0, 0, 1, 1, 0, 0.15, "darkSteel");
      disc(-0.15, 0, 0.55, 0.7, 0.15, 0.7, "paint");
      ellipse(0.3, 0, 0.36, 0.6, 0.15, 0.7, "steel");
      disc(0.2, 0, 0.6, 0.25, 0.75, 0.25, "metal");
      break;
    case "boiler":
      box(0, 0, 1, 1, 0, 0.1, "concrete");
      disc(0, 0, 0.95, 0.8, 0.1, 0.62, "red");
      box(0, 0.45, 0.25, 0.1, 0.15, 0.3, "darkSteel");
      ellipse(0.3, -0.2, 0.15, 0.18, 0.7, 0.3, "darkSteel");
      cm("disc", w * 0.25, d * 0.42, 6, 12, height * 0.55, 12, "glass", { angle: Math.PI / 2 });
      break;
    case "bigTank":
      ellipse(0, 0, 0.96, 0.96, 0, 0.92, "steel");
      ellipse(0, 0, 0.98, 0.98, 0.9, 0.06, "metal", 0.6);
      ellipse(0, 0, 0.2, 0.2, 0.96, 0.04, "darkSteel");
      for (const z of [0.3, 0.6]) ring(0, 0, 1, 1, z, 0.02, "darkSteel", 0.96);
      box(0.47, 0.2, 0.04, 0.08, 0, 0.96, "darkSteel");
      break;
    case "emergencyGenerator":
      box(0, 0, 1, 1, 0, 0.06, "darkSteel");
      box(0, 0, 0.98, 0.95, 0.06, 0.85, "paint");
      for (let i = 0; i < 8; i++) box(-0.35 + i * 0.1, 0.48, 0.05, 0.04, 0.3, 0.45, "darkSteel");
      ellipse(-0.35, -0.25, 0.08, 0.16, 0.91, 0.09, "darkSteel");
      break;
    case "waterTower":
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) box(sx * 0.4, sy * 0.4, 0.06, 0.06, 0, 0.6, "steel");
      box(0, 0, 0.9, 0.9, 0.58, 0.03, "steel");
      ellipse(0, 0, 0.84, 0.84, 0.6, 0.32, "enamel");
      ellipse(0, 0, 0.86, 0.86, 0.9, 0.1, "enamel", 0.3);
      break;
    case "ventUnit":
      box(0, 0, 1, 1, 0, 0.8, "metal");
      ellipse(0, 0, 0.8, 0.8, 0.8, 0.12, "darkSteel");
      for (let i = 0; i < 4; i++) turned(0, 0, 0.7, 0.06, 0.92, 0.08, "black", (i * Math.PI) / 4);
      break;
    case "antenna":
      box(0, 0, 0.5, 0.5, 0, 0.04, "concrete");
      ellipse(0, 0, 0.05, 0.05, 0.04, 0.96, "metal");
      for (const z of [0.6, 0.75, 0.9]) disc(0, 0, 1 - (z - 0.6), 0.04, z, 0.012, "metal");
      cm("disc", w * 0.18, 0, 6, w * 0.5, height * 0.4, height * 0.18, "enamel", { angle: Math.PI / 2 });
      break;
    case "hydrant":
      box(0, 0, 1, 1, 0, 1, "red");
      box(0, 0.49, 0.85, 0.02, 0.05, 0.75, "red");
      cm("disc", 0, d * 0.5 - 1, 2, 12, height * 0.88, height * 0.08, "redLamp", { angle: Math.PI / 2 });
      break;
    case "securityCamera":
      box(0, -0.4, 0.5, 0.2, 0.88, 0.12, "enamel");
      disc(0, 0.1, 0.6, 0.8, 0.88, 0.07, "enamel");
      cm("disc", 0, d * 0.42, 2, w * 0.4, height * 0.88, height * 0.035, "black", { angle: Math.PI / 2 });
      box(0, -0.15, 0.8, 0.5, 0.95, 0.05, "enamel");
      break;
    case "cardReader":
      box(0, 0, 1, 1, 0.75, 0.25, "black");
      box(0, 0.5, 0.6, 0.02, 0.8, 0.08, "led");
      break;
    case "alarm":
      box(0, -0.2, 1, 0.6, 0.85, 0.15, "red");
      cm("disc", 0, d * 0.3, 4, w * 0.8, height * 0.88, height * 0.07, "redLamp", { angle: Math.PI / 2 });
      break;
    case "sluiceGate":
      for (const sx of [-1, 1]) box(sx * 0.45, 0, 0.1, 1, 0, 1, "concrete");
      box(0, 0, 0.8, 0.2, 0, 0.7, "rust");
      for (const z of [0.2, 0.45]) box(0, 0, 0.8, 0.26, z, 0.04, "darkSteel");
      box(0, 0, 1, 0.5, 0.9, 0.1, "darkSteel");
      ring(0, 0, 0.2, 0.6, 0.98, 0.02, "red", 0.7);
      break;

    // ---- 物流・工場 ----
    case "pallet":
      for (const x of [-0.42, 0, 0.42]) box(x, 0, 0.15, 1, 0, 0.66, "paleWood");
      for (let i = 0; i < 7; i++) box(0, -0.43 + i * (0.86 / 6), 1, 0.12, 0.66, 0.34, "paleWood");
      break;
    case "palletStack":
      for (let level = 0; level < 8; level++) {
        for (const x of [-0.42, 0, 0.42]) box(x, 0, 0.15, 1, level / 8, 0.08, "paleWood");
        for (let i = 0; i < 5; i++) box(0, -0.4 + i * 0.2, 1, 0.14, level / 8 + 0.08, 0.045, "paleWood");
      }
      break;
    case "container":
      box(0, 0, 1, 1, 0, 1, "paint");
      for (let i = 1; i < 24; i++) box(0, -0.5 + i / 24, 1.0, 0.004, 0.02, 0.96, "darkSteel");
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) box(sx * 0.46, sy * 0.49, 0.08, 0.02, 0, 1, "darkSteel");
      for (const sx of [-1, 1]) box(sx * 0.12, 0.495, 0.02, 0.01, 0.05, 0.9, "metal");
      break;
    case "handCart":
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) ellipse(sx * 0.38, sy * 0.4, 0.12, 0.08, 0, 0.12, "black");
      box(0, 0, 1, 1, 0.12, 0.06, "blue");
      box(0, -0.48, 0.9, 0.04, 0.18, 0.04, "metal");
      for (const sx of [-1, 1]) box(sx * 0.42, -0.48, 0.05, 0.04, 0.18, 0.82, "metal");
      box(0, -0.48, 0.9, 0.04, 0.96, 0.04, "metal");
      break;
    case "toolShelf":
      box(0, -0.45, 1, 0.1, 0, 1, "paint");
      for (const z of [0.05, 0.3, 0.55]) box(0, 0, 1, 0.9, z, 0.03, "paint");
      for (let i = 0; i < 5; i++) box(-0.36 + i * 0.18, -0.38, 0.06, 0.04, 0.68, 0.18, (["red", "yellow", "metal", "blue", "black"] as Mat[])[i]);
      for (let i = 0; i < 4; i++) box(-0.3 + i * 0.2, 0.05, 0.14, 0.5, 0.33, 0.12, (["red", "blue", "yellow", "metal"] as Mat[])[i]);
      for (const sx of [-1, 1]) box(sx * 0.48, 0, 0.04, 1, 0, 0.62, "paint");
      break;
    case "machineTool":
      box(0, 0, 1, 1, 0, 0.45, "paint");
      box(0, -0.1, 0.9, 0.7, 0.45, 0.5, "glass");
      box(-0.2, -0.1, 0.25, 0.3, 0.45, 0.25, "metal");
      box(0.44, 0.35, 0.12, 0.25, 0.45, 0.55, "darkSteel");
      box(0.44, 0.47, 0.1, 0.02, 0.6, 0.25, "screen");
      box(0, -0.1, 0.92, 0.72, 0.95, 0.05, "paint");
      break;
    case "portableGenerator":
      for (const sx of [-1, 1]) box(sx * 0.45, 0, 0.06, 1, 0, 1, "black");
      box(0, 0, 0.82, 0.86, 0.05, 0.75, "red");
      box(0, 0, 0.88, 0.06, 0.94, 0.06, "black");
      box(0.2, 0.45, 0.3, 0.06, 0.25, 0.25, "darkSteel");
      break;
    case "industrialTank":
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) box(sx * 0.32, sy * 0.32, 0.06, 0.06, 0, 0.25, "darkSteel");
      ellipse(0, 0, 0.9, 0.9, 0.2, 0.68, "steel");
      ellipse(0, 0, 0.9, 0.9, 0.88, 0.12, "steel", 0.4);
      disc(0.35, 0, 0.3, 0.12, 0.4, 0.06, "pipeBlue");
      ellipse(0, 0, 0.12, 0.12, 0.98, 0.02, "darkSteel");
      break;
    case "conveyor":
      for (const x of [-0.45, -0.15, 0.15, 0.45]) for (const sy of [-1, 1]) box(x, sy * 0.4, 0.02, 0.06, 0, 0.75, "darkSteel");
      for (const sy of [-1, 1]) box(0, sy * 0.45, 1, 0.08, 0.72, 0.18, "yellow");
      box(0, 0, 0.98, 0.8, 0.82, 0.13, "black");
      for (let i = 0; i < 3; i++) box(-0.3 + i * 0.3, 0, 0.12, 0.5, 0.95, 0.05, "cardboard");
      break;
    case "workbench":
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) box(sx * 0.46, sy * 0.4, 0.04, 0.08, 0, 0.92, "wood");
      box(0, 0, 0.9, 0.8, 0.2, 0.04, "wood");
      box(0, 0, 1, 1, 0.92, 0.08, "paleWood");
      box(0.38, 0.42, 0.14, 0.12, 0.98, 0.02, "darkSteel");
      break;
    case "materialPile":
      ellipse(0, 0, 1, 1, 0, 0.5, "dirt", 0.6);
      ellipse(0, 0.05, 0.6, 0.6, 0.48, 0.52, "dirt", 0.2);
      break;
    case "buildingMaterials":
      for (let i = 0; i < 3; i++) box(0, -0.3 + i * 0.3, 1, 0.25, 0, 0.35, "paleWood");
      for (let i = 0; i < 4; i++) disc(0, -0.36 + i * 0.24, 0.96, 0.18, 0.35, 0.3, "steel");
      box(0, 0, 0.9, 0.3, 0.65, 0.35, "rust");
      break;
    case "palletRack":
      for (const x of [-0.49, 0, 0.49]) for (const sy of [-1, 1]) box(x, sy * 0.46, 0.02, 0.08, 0, 1, "blue");
      for (const z of [0.02, 0.36, 0.7]) {
        for (const sy of [-1, 1]) box(0, sy * 0.46, 1, 0.06, z + 0.05, 0.04, "orange");
        for (const x of [-0.25, 0.25]) {
          box(x, 0, 0.44, 0.9, z + 0.09, 0.04, "paleWood");
          box(x, 0, 0.4, 0.8, z + 0.13, 0.15, (z === 0.36 ? "cardboard" : "goodsB") as Mat);
        }
      }
      break;

    // ---- 病院・研究 ----
    case "operatingTable":
      // 手術台と、真上に吊るした無影灯
      ellipse(0, 0.05, 0.25, 0.15, 0, 0.42, "metal");
      box(0, 0.05, 0.4, 0.75, 0.42, 0.06, "enamel");
      box(0, 0.05, 0.36, 0.7, 0.48, 0.03, "vinyl");
      for (const sx of [-1, 1]) cm("ellipse", sx * w * 0.25, -d * 0.3, w * 0.3, w * 0.3, height * 0.85, height * 0.06, "enamel", { taper: 0.6 });
      for (const sx of [-1, 1]) cm("ellipse", sx * w * 0.25, -d * 0.3, w * 0.25, w * 0.25, height * 0.84, height * 0.015, "light");
      box(0, -0.3, 0.5, 0.04, 0.94, 0.02, "metal");
      ellipse(0, -0.3, 0.04, 0.03, 0.95, 0.05, "metal");
      break;
    case "medicineCabinet":
      // 薬品棚: 下は扉の戸棚、上はガラス戸の中の棚に薬のびん。天板は奥へ寄せ、上から見て手前にガラス戸が見える
      box(0, 0, 1, 1, 0, 0.36, "enamel");
      for (let i = 0; i < 2; i++) box(-0.25 + i * 0.5, 0.49, 0.46, 0.02, 0.04, 0.28, "board");
      box(0, -0.45, 1, 0.1, 0.36, 0.61, "enamel");
      for (const sx of [-1, 1]) box(sx * 0.485, -0.03, 0.03, 0.94, 0.36, 0.61, "enamel");
      for (const z of [0.56, 0.76]) box(0, -0.05, 0.94, 0.8, z, 0.015, "enamel");
      for (const z of [0.36, 0.575, 0.775]) for (let i = 0; i < 8; i++) ellipse(-0.42 + i * 0.12, -0.05, 0.07, 0.3, z, 0.12, (["glass", "orange", "enamel", "blue"] as Mat[])[i % 4]);
      box(0, -0.03, 1, 0.94, 0.97, 0.03, "enamel");
      box(0, 0.47, 0.96, 0.06, 0.37, 0.61, "glass");
      break;
    case "morgue":
      // 遺体安置庫: ステンレスの箱に2列3段の扉と取っ手。上の奥に冷やす機械とファン
      box(0, -0.03, 1, 0.94, 0, 0.92, "steel");
      for (let row = 0; row < 3; row++) for (const x of [-0.25, 0.25]) {
        box(x, 0.46, 0.46, 0.04, 0.05 + row * 0.29, 0.26, "metal");
        box(x, 0.49, 0.12, 0.02, 0.15 + row * 0.29, 0.04, "darkSteel");
      }
      box(0, -0.22, 0.56, 0.44, 0.92, 0.07, "darkSteel");
      for (const sx of [-1, 1]) cm("ellipse", sx * w * 0.13, -d * 0.22, w * 0.2, w * 0.2, height * 0.99, height * 0.01, "metal");
      break;
    case "labBench":
      box(0, 0, 0.96, 0.9, 0, 0.92, "enamel");
      box(0, 0, 1, 1, 0.92, 0.04, "black");
      box(0.3, 0.05, 0.25, 0.4, 0.93, 0.02, "metal");
      for (let i = 0; i < 4; i++) ellipse(-0.35 + i * 0.1, -0.3, 0.04, 0.1, 0.96, 0.04, (["glass", "blue", "orange", "glass"] as Mat[])[i]);
      break;
    case "cultureTank":
      ellipse(0, 0, 1, 1, 0, 0.12, "darkSteel");
      ellipse(0, 0, 0.84, 0.84, 0.12, 0.76, "glass");
      ellipse(0, 0, 0.8, 0.8, 0.14, 0.6, "slime");
      sphere(0, 0, 0.3, 0.3, 0.35, 0.3, "flesh");
      ellipse(0, 0, 1, 1, 0.88, 0.12, "darkSteel");
      break;
    case "serverRack":
      // サーバーラック: 黒い箱の正面に機器とランプ。天板に換気のファン2つ
      box(0, 0, 1, 1, 0, 0.99, "black");
      for (let i = 0; i < 12; i++) {
        box(0, 0.49, 0.85, 0.02, 0.06 + i * 0.075, 0.06, "darkSteel");
        box(-0.3, 0.5, 0.1, 0.01, 0.08 + i * 0.075, 0.02, i % 3 ? "led" : "amberLamp");
      }
      for (const sy of [-1, 1]) {
        cm("ellipse", 0, sy * d * 0.22, w * 0.6, w * 0.6, height * 0.99, height * 0.01, "darkSteel");
        cm("ellipse", 0, sy * d * 0.22, w * 0.16, w * 0.16, height * 0.99, height * 0.01, "metal");
      }
      break;
    case "fumeHood":
      // ドラフトチャンバー: 実験台の上を囲い、正面にガラスの窓。上に排気のダクト
      box(0, 0, 1, 1, 0, 0.4, "enamel");
      box(0, 0, 1, 1, 0.4, 0.02, "black");
      box(0, -0.4, 1, 0.2, 0.42, 0.45, "enamel");
      for (const sx of [-1, 1]) box(sx * 0.47, 0, 0.06, 1, 0.42, 0.45, "enamel");
      box(0, 0.47, 0.88, 0.04, 0.6, 0.27, "glass");
      box(0, 0, 1, 1, 0.87, 0.07, "enamel");
      cm("ellipse", 0, -d * 0.15, Math.min(w, d) * 0.4, Math.min(w, d) * 0.4, height * 0.94, height * 0.06, "metal");
      break;
    case "microscope":
      box(0, 0.1, 0.9, 0.6, 0, 0.1, "black");
      box(0, -0.25, 0.3, 0.25, 0.1, 0.7, "enamel");
      box(0, 0.1, 0.6, 0.4, 0.35, 0.05, "black");
      slab(0, -d * 0.1, w * 0.2, d * 0.45, height * 0.6, height * 0.4, w * 0.15, "enamel", 1);
      break;
    case "labFreezer":
      // 超低温フリーザー: 白い箱の正面に厚い扉と取っ手、扉の上に表示板
      box(0, -0.04, 1, 0.92, 0, 1, "enamel");
      box(0, 0.46, 0.94, 0.08, 0.03, 0.85, "board");
      box(0.35, 0.49, 0.06, 0.02, 0.4, 0.25, "metal");
      box(0, 0.46, 0.4, 0.08, 0.89, 0.07, "screen");
      break;
    case "deconShower":
      // 除染シャワー: 左右はガラス、奥は壁。天井は枠だけにし、上から中のシャワーと排水口が見える
      box(0, 0, 1, 1, 0, 0.03, "poolTile");
      box(0, 0, 0.3, 0.3, 0.03, 0.005, "darkSteel");
      for (const sx of [-1, 1]) box(sx * 0.48, 0, 0.04, 1, 0, 0.94, "glass");
      box(0, -0.47, 1, 0.06, 0, 0.94, "enamel");
      box(0, 0.47, 1, 0.06, 0.86, 0.08, "yellow");
      for (const x of [-0.25, 0.25]) box(x, 0, 0.04, 0.9, 0.9, 0.04, "metal");
      for (const x of [-0.25, 0.25]) for (const y of [-0.25, 0.25]) cm("ellipse", x * w, y * d, 8, 8, height * 0.86, height * 0.04, "metal");
      for (const sy of [-1, 1]) box(0, sy * 0.47, 1, 0.06, 0.94, 0.06, "enamel");
      for (const sx of [-1, 1]) box(sx * 0.47, 0, 0.06, 0.88, 0.94, 0.06, "enamel");
      break;

    // ---- 博物館・教会・図書館 ----
    case "lectureDesk":
      box(0, -0.28, 1, 0.44, 0.65, 0.05, "paleWood");
      box(0, -0.48, 1, 0.04, 0, 0.7, "wood");
      for (let i = 0; i < 6; i++) {
        const x = -0.42 + i * 0.168;
        ellipse(x, 0.25, 0.04, 0.1, 0, 0.45, "metal");
        box(x, 0.28, 0.12, 0.35, 0.42, 0.06, "velvet");
        box(x, 0.47, 0.12, 0.06, 0.42, 0.58, "velvet");
      }
      break;
    case "bookStack":
      box(0, 0, 1, 1, 0, 0.04, "wood");
      box(0, 0, 1, 0.06, 0, 1, "wood");
      for (const sx of [-1, 1]) box(sx * 0.485, 0, 0.03, 1, 0, 1, "wood");
      for (const side of [-1, 1]) for (const z of [0.04, 0.27, 0.5, 0.73]) {
        if (z > 0.05) box(0, side * 0.26, 0.97, 0.45, z, 0.015, "wood");
        for (let i = 0; i < 12; i++) box(-0.44 + i * 0.08, side * 0.24, 0.06, 0.38, z + 0.015, 0.16 + (i % 3) * 0.02, (["red", "blue", "goodsC", "leather"] as Mat[])[(i + (z > 0.5 ? 1 : 0)) % 4]);
      }
      box(0, 0, 1, 1, 0.97, 0.03, "wood");
      break;
    case "painting":
      box(0, -0.1, 0.84, 0.6, 0.6, 0.35, "cloth");
      for (const z of [0.55, 0.95]) box(0, 0, 1, 1, z, 0.05, "gold");
      for (const sx of [-1, 1]) box(sx * 0.46, 0, 0.08, 1, 0.55, 0.45, "gold");
      break;
    case "pedestal":
      box(0, 0, 0.8, 0.8, 0, 0.55, "statue");
      box(0, 0, 0.9, 0.9, 0.55, 0.04, "statue");
      ellipse(0, 0, 0.35, 0.35, 0.59, 0.25, "granite");
      sphere(0, 0, 0.5, 0.5, 0.75, 0.25, "granite");
      break;
    case "ropeBarrier":
      for (const x of [-0.42, 0.42]) {
        ellipse(x, 0, 0.15, 1, 0, 0.05, "gold");
        ellipse(x, 0, 0.03, 0.2, 0.05, 0.95, "gold");
      }
      disc(0, 0, 0.8, 0.3, 0.8, 0.04, "velvet");
      break;
    case "dinosaurSkeleton": {
      box(0, 0, 0.9, 0.5, 0, 0.04, "granite");
      for (const sx of [-0.12, 0.12]) for (const y of [-0.12, 0.12]) ellipse(sx, y, 0.03, 0.06, 0.04, 0.4, "bone");
      for (let i = 0; i < 18; i++) {
        const x = -0.45 + i * 0.05, z = 0.45 + Math.sin((i / 17) * Math.PI) * 0.12 - (i > 13 ? 0.1 : 0);
        sphere(x, 0, 0.04, 0.08, z, 0.06, "bone");
        if (i > 3 && i < 12) cm("box", x * w, 0, 4, d * 0.4, z * height - height * 0.12, height * 0.12, "bone");
      }
      sphere(0.47, 0, 0.06, 0.2, 0.6, 0.12, "bone");
      sphere(0.43, 0.05, 0.04, 0.15, 0.62, 0.38, "bone");
      break;
    }
    case "pipeOrgan":
      box(0, 0, 1, 1, 0, 0.25, "wood");
      box(0, 0.3, 0.7, 0.3, 0.25, 0.04, "black");
      for (let i = 0; i < 15; i++) {
        const x = -0.45 + i * (0.9 / 14), tall = 0.4 + 0.35 * Math.cos(((i - 7) / 7) * Math.PI / 2);
        ellipse(x, -0.25, 0.05, 0.12, 0.25, tall, "gold");
      }
      box(0, -0.4, 1, 0.2, 0.25, 0.75, "wood");
      break;
    case "baptismalFont":
      box(0, 0, 0.6, 0.6, 0, 0.1, "granite");
      ellipse(0, 0, 0.3, 0.3, 0.1, 0.6, "granite");
      ellipse(0, 0, 1, 1, 0.7, 0.3, "granite", 1.2);
      ellipse(0, 0, 0.8, 0.8, 0.98, 0.02, "water");
      break;
    case "confessional":
      // 告解室: 3つに分かれた木の小部屋。屋根は部屋ごとに一段高くし、上から見て3つに分かれて見える
      box(0, 0, 1, 1, 0, 0.92, "woodDark");
      for (const x of [-0.33, 0, 0.33]) box(x, 0.49, 0.3, 0.02, 0.05, 0.82, "wood");
      box(0, 0.495, 0.25, 0.01, 0.3, 0.4, "velvet");
      box(0, 0, 1, 1, 0.92, 0.04, "woodDark");
      for (const x of [-0.335, 0, 0.335]) box(x, -0.02, 0.31, 0.9, 0.96, 0.04, "wood");
      break;

    // ---- 遊具・スポーツ・音楽・娯楽 ----
    case "theaterSeats":
      for (let i = 0; i < 6; i++) {
        const x = -0.4083 + i * 0.1633;
        box(x, 0.05, 0.14, 0.6, 0.45, 0.08, "velvet");
        box(x, -0.38, 0.14, 0.2, 0.2, 0.8, "velvet");
      }
      for (let i = 0; i <= 6; i++) box(-0.49 + i * 0.1633, 0, 0.02, 0.8, 0, 0.7, "black");
      break;
    case "pew":
      for (const x of [-0.47, 0, 0.47]) box(x, 0, 0.04, 0.9, 0, 0.95, "woodDark");
      box(0, 0.1, 0.98, 0.6, 0.47, 0.06, "wood");
      box(0, -0.4, 0.98, 0.1, 0.47, 0.53, "wood");
      box(0, -0.42, 1, 0.14, 0.95, 0.05, "woodDark");
      break;
    case "speaker":
      box(0, 0, 1, 1, 0, 1, "black");
      cm("disc", 0, d * 0.48, 2, w * 0.7, height * 0.12, height * 0.35, "darkSteel", { angle: Math.PI / 2 });
      cm("disc", 0, d * 0.48, 2, w * 0.35, height * 0.65, height * 0.18, "darkSteel", { angle: Math.PI / 2 });
      break;
    case "mixingDesk":
      for (const sx of [-1, 1]) box(sx * 0.45, 0, 0.08, 0.8, 0, 0.75, "black");
      slab(0, 0, w, d, height * 0.75, height * 0.2, 6, "darkSteel");
      for (let i = 0; i < 16; i++) box(-0.42 + i * 0.056, 0.1, 0.02, 0.4, 0.86, 0.1, i % 4 ? "metal" : "led");
      box(0, -0.38, 0.4, 0.15, 0.85, 0.15, "screen");
      break;
    case "boothSeat":
      box(0, 0, 0.6, 0.35, 0, 0.62, "wood");
      box(0, 0, 0.7, 0.4, 0.62, 0.04, "paleWood");
      for (const sy of [-1, 1]) {
        box(0, sy * 0.36, 1, 0.24, 0, 0.42, "velvet");
        box(0, sy * 0.46, 1, 0.08, 0.42, 0.58, "velvet");
      }
      break;
    case "banquetTable":
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, r = 0.38;
        cm("box", Math.cos(a) * r * w, Math.sin(a) * r * d, w * 0.14, d * 0.14, 0, height * 0.6, "velvet", { angle: a + Math.PI / 2 });
      }
      ellipse(0, 0, 0.12, 0.12, 0, 0.95, "metal");
      ellipse(0, 0, 0.62, 0.62, 0.95, 0.05, "linen");
      break;
    case "pool": {
      box(0, 0, 1, 1, 0, 0.4, "poolTile");
      box(0, 0, 0.9, 0.95, 0.4, 0.6, "water");
      for (let i = 1; i < 6; i++) box(-0.45 + i * 0.15, 0, 0.012, 0.93, 0.4, 0.6, "blue");
      for (const sy of [-1, 1]) box(0.38, sy * 0.47, 0.08, 0.02, 0.4, 0.6, "metal");
      break;
    }
    case "deckChair":
      for (const sx of [-1, 1]) for (const y of [-0.4, 0.4]) box(sx * 0.44, y, 0.06, 0.06, 0, 0.55, "metal");
      box(0, 0.15, 0.9, 0.65, 0.5, 0.08, "enamel");
      slab(0, -d * 0.3, w * 0.9, d * 0.3, height * 0.5, height * 0.5, 4, "enamel", 1);
      break;
    case "treadmill":
      box(0, 0.1, 0.8, 0.8, 0, 0.12, "black");
      box(0, 0.1, 0.65, 0.75, 0.12, 0.02, "darkSteel");
      for (const sx of [-1, 1]) box(sx * 0.45, -0.38, 0.06, 0.06, 0, 0.9, "metal");
      box(0, -0.42, 0.9, 0.12, 0.85, 0.15, "darkSteel");
      box(0, -0.42, 0.3, 0.06, 0.95, 0.05, "screen");
      break;
    case "exerciseBike":
      box(0, 0, 0.8, 0.95, 0, 0.06, "darkSteel");
      disc(0, 0.32, 0.12, 0.3, 0.06, 0.35, "darkSteel");
      box(0, -0.05, 0.12, 0.55, 0.06, 0.6, "metal");
      box(0, 0.15, 0.4, 0.2, 0.62, 0.06, "black");
      box(0, -0.35, 0.8, 0.1, 0.85, 0.15, "black");
      break;
    case "weightBench":
      box(0, 0.2, 0.2, 0.6, 0.3, 0.12, "black");
      ellipse(0, 0.2, 0.08, 0.3, 0, 0.3, "metal");
      for (const sx of [-1, 1]) box(sx * 0.3, -0.25, 0.05, 0.05, 0, 0.82, "metal");
      disc(0, -0.25, 1, 0.04, 0.78, 0.03, "metal");
      for (const sx of [-1, 1]) disc(sx * 0.4, -0.25, 0.06, 0.3, 0.66, 0.34, "black");
      break;
    case "dumbbellRack":
      for (const sx of [-1, 1]) box(sx * 0.45, 0, 0.06, 0.9, 0, 0.75, "black");
      for (const z of [0.4, 0.7]) slab(0, 0, w * 0.9, d * 0.8, height * (z - 0.1), height * 0.1, 3, "darkSteel");
      for (let i = 0; i < 6; i++) for (const z of [0.5, 0.8]) disc(-0.37 + i * 0.15, 0, 0.12, 0.25, z, 0.2, "black");
      break;

    // ---- 乗り物・船 ----
    case "trainCar":
      for (const y of [-0.42, 0.42]) for (const sx of [-1, 1]) for (const dy of [-0.025, 0.025]) disc(sx * 0.35, y + dy, 0.06, 0.04, 0, 0.22, "black");
      box(0, 0, 0.95, 0.99, 0.12, 0.8, "vehicle", 0.02);
      for (const sx of [-1, 1]) box(sx * 0.47, 0, 0.03, 0.9, 0.45, 0.25, "glass");
      for (let i = 0; i < 11; i++) for (const sx of [-1, 1]) box(sx * 0.475, -0.45 + i * 0.09, 0.025, 0.012, 0.45, 0.25, "busRoof");
      for (const sx of [-1, 1]) box(sx * 0.475, 0, 0.02, 0.98, 0.35, 0.05, "busStripe");
      box(0, 0, 0.9, 0.98, 0.92, 0.08, "busRoof", 0.02);
      break;
    case "locomotive":
      for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) disc(sx * 0.36, -0.35 + i * 0.14, 0.05, 0.08, 0, 0.35, "black");
      box(0, 0.1, 0.8, 0.75, 0.15, 0.55, "black");
      cm("disc", 0, d * 0.12, d * 0.6, w * 0.7, height * 0.3, height * 0.42, "black", { angle: Math.PI / 2 });
      ellipse(0, 0.4, 0.12, 0.04, 0.62, 0.38, "darkSteel");
      box(0, -0.35, 0.95, 0.28, 0.15, 0.75, "black");
      box(0, -0.35, 1, 0.3, 0.9, 0.06, "darkSteel");
      box(0, 0.47, 0.8, 0.05, 0.1, 0.15, "red");
      break;
    case "van":
      wheels(0.44, [-0.32, 0.32], 0.12, 0.14, 0.33);
      box(0, 0, 1, 1, 0.15, 0.6, "vehicle", 0.05);
      box(0, 0.36, 0.9, 0.2, 0.55, 0.25, "glass", 0.03);
      box(0, -0.08, 0.96, 0.7, 0.75, 0.25, "vehicle", 0.05);
      for (const sx of [-1, 1]) box(sx * 0.48, -0.05, 0.02, 0.35, 0.55, 0.15, "glass");
      break;
    case "truck":
      wheels(0.42, [-0.36, -0.22, 0.3], 0.12, 0.12, 0.33);
      box(0, 0.36, 1, 0.26, 0.15, 0.5, "vehicle", 0.04);
      box(0, 0.42, 0.9, 0.08, 0.5, 0.15, "glass");
      box(0, -0.13, 1, 0.72, 0.15, 0.85, "busRoof", 0.01);
      for (let i = 1; i < 8; i++) box(0, -0.49 + i * 0.09, 1, 0.004, 0.16, 0.84, "darkSteel");
      break;
    case "policeCar":
      wheels(0.45, [-0.3, 0.3], 0.1, 0.14, 0.4);
      box(0, 0, 1, 1, 0.15, 0.4, "black", 0.06);
      for (const sy of [-1, 1]) box(0, sy * 0.38, 1, 0.24, 0.15, 0.42, "enamel", 0.06);
      box(0, -0.02, 0.86, 0.48, 0.55, 0.28, "glass", 0.08);
      box(0, -0.02, 0.84, 0.36, 0.82, 0.08, "black", 0.04);
      for (const sx of [-1, 1]) box(sx * 0.2, 0.02, 0.36, 0.08, 0.9, 0.1, sx < 0 ? "redLamp" : "blueLamp");
      break;
    case "ambulance":
      wheels(0.44, [-0.3, 0.3], 0.1, 0.12, 0.3);
      box(0, 0.35, 1, 0.3, 0.13, 0.5, "enamel", 0.04);
      box(0, 0.42, 0.9, 0.1, 0.45, 0.2, "glass");
      box(0, -0.12, 1, 0.76, 0.13, 0.82, "enamel", 0.02);
      for (const sx of [-1, 1]) box(sx * 0.49, -0.1, 0.02, 0.7, 0.4, 0.06, "red");
      box(0, -0.12, 0.3, 0.06, 0.95, 0.03, "red");
      box(0, -0.12, 0.08, 0.2, 0.95, 0.03, "red");
      box(0, 0.22, 0.6, 0.05, 0.95, 0.05, "redLamp");
      break;
    case "fireTruck":
      wheels(0.42, [-0.35, -0.22, 0.3], 0.12, 0.12, 0.33);
      box(0, 0.36, 1, 0.26, 0.12, 0.6, "red", 0.03);
      box(0, 0.43, 0.9, 0.08, 0.5, 0.2, "glass");
      box(0, -0.13, 1, 0.72, 0.12, 0.6, "red", 0.02);
      box(0, -0.12, 0.4, 0.74, 0.72, 0.06, "metal");
      for (let i = 0; i < 10; i++) box(0, -0.45 + i * 0.075, 0.38, 0.015, 0.78, 0.04, "metal");
      box(0, 0.28, 0.7, 0.05, 0.85, 0.05, "redLamp");
      box(0, -0.13, 0.95, 0.72, 0.95, 0.05, "red");
      break;
    case "excavator":
      for (const sx of [-1, 1]) box(sx * 0.36, 0.1, 0.25, 0.7, 0, 0.25, "black", 0.1);
      box(0, 0.1, 0.8, 0.6, 0.25, 0.25, "yellow");
      box(0.1, 0.18, 0.4, 0.3, 0.5, 0.4, "glass");
      box(-0.2, 0.18, 0.35, 0.45, 0.5, 0.3, "yellow");
      slab(-w * 0.05, -d * 0.2, w * 0.12, d * 0.3, height * 0.3, height * 0.7, 20, "yellow", -1);
      box(-0.05, -0.45, 0.35, 0.1, 0, 0.35, "darkSteel");
      break;
    case "bulldozer":
      for (const sx of [-1, 1]) box(sx * 0.35, 0.05, 0.25, 0.7, 0, 0.3, "black", 0.1);
      box(0, 0.1, 0.65, 0.55, 0.3, 0.3, "yellow");
      box(0, 0.15, 0.4, 0.35, 0.6, 0.4, "glass");
      box(0, 0.15, 0.42, 0.37, 0.97, 0.03, "yellow");
      box(0, -0.43, 1, 0.12, 0, 0.45, "yellow");
      break;
    case "craneTruck":
      wheels(0.43, [-0.38, -0.24, 0.12, 0.32], 0.1, 0.1, 0.3);
      box(0, 0.38, 1, 0.22, 0.12, 0.6, "yellow", 0.03);
      box(0, 0.44, 0.9, 0.06, 0.45, 0.2, "glass");
      box(0, -0.1, 1, 0.72, 0.12, 0.25, "darkSteel");
      box(0, -0.15, 0.5, 0.25, 0.37, 0.3, "yellow");
      slab(0, -d * 0.02, w * 0.18, d * 0.56, height * 0.5, height * 0.5, 15, "yellow", -1);
      break;
    case "forklift":
      for (const sx of [-1, 1]) {
        disc(sx * 0.42, 0.05, 0.16, 0.24, 0, 0.25, "black");
        disc(sx * 0.42, -0.35, 0.16, 0.2, 0, 0.2, "black");
      }
      box(0, -0.15, 0.85, 0.55, 0.1, 0.35, "orange");
      box(0, -0.2, 0.7, 0.3, 0.45, 0.1, "black");
      for (const sx of [-1, 1]) for (const y of [-0.02, -0.38]) box(sx * 0.4, y, 0.06, 0.04, 0.45, 0.55, "darkSteel");
      box(0, -0.2, 0.85, 0.42, 0.98, 0.02, "darkSteel");
      for (const sx of [-1, 1]) box(sx * 0.35, 0.13, 0.06, 0.05, 0, 1, "darkSteel");
      for (const sx of [-1, 1]) box(sx * 0.25, 0.32, 0.1, 0.36, 0.02, 0.02, "darkSteel");
      break;
    case "tank":
      for (const sx of [-1, 1]) box(sx * 0.38, 0, 0.24, 1, 0, 0.35, "black", 0.1);
      box(0, 0, 0.6, 0.9, 0.2, 0.25, "military");
      ellipse(0, -0.05, 0.5, 0.3, 0.45, 0.3, "military");
      cm("disc", 0, d * 0.25, d * 0.5, 14, height * 0.58, 14, "darkSteel", { angle: Math.PI / 2 });
      ellipse(0.1, -0.1, 0.12, 0.08, 0.75, 0.25, "military");
      break;
    case "airplane":
      // 小型機: 胴体は奥行の向き、翼は横いっぱい。プロペラは手前
      cm("disc", 0, 0, d * 0.95, w * 0.12, height * 0.3, height * 0.42, "enamel", { angle: Math.PI / 2 });
      box(0, 0.05, 1, 0.16, 0.5, 0.04, "enamel");
      box(0, -0.42, 0.35, 0.1, 0.4, 0.04, "enamel");
      box(0, -0.43, 0.02, 0.12, 0.42, 0.58, "enamel");
      box(0, 0.12, 0.08, 0.12, 0.58, 0.12, "glass");
      cm("box", 0, d * 0.4, w * 0.18, 3, height * 0.25, height * 0.12, "black");
      for (const sx of [-1, 1]) ellipse(sx * 0.12, 0.08, 0.02, 0.04, 0, 0.25, "black");
      break;
    case "helicopter":
      // ヘリコプター: 胴体と尾、真上の回転翼（十字）
      ellipse(0, 0.12, 0.22, 0.3, 0.05, 0.4, "red");
      box(0, 0.22, 0.18, 0.12, 0.25, 0.22, "glass", 0.1);
      box(0, -0.25, 0.05, 0.45, 0.3, 0.08, "red");
      box(0, -0.46, 0.02, 0.08, 0.3, 0.3, "red");
      for (const sx of [-1, 1]) box(sx * 0.1, 0.12, 0.02, 0.35, 0, 0.05, "darkSteel");
      ellipse(0, 0.1, 0.05, 0.05, 0.45, 0.45, "darkSteel");
      for (const a of [Math.PI / 4, -Math.PI / 4]) cm("box", 0, d * 0.1, w * 0.95, 18, height * 0.9, height * 0.03, "black", { angle: a });
      ellipse(0, 0.1, 0.08, 0.08, 0.9, 0.1, "darkSteel");
      break;
    case "rowboat":
      ellipse(0, 0, 1, 1, 0, 0.7, "wood", 1.15);
      ellipse(0, 0, 0.8, 0.85, 0.15, 0.6, "paleWood");
      for (const y of [-0.15, 0.2]) box(0, y, 0.8, 0.08, 0.6, 0.12, "wood");
      for (const sx of [-1, 1]) turned(sx * 0.25, 0.05, 0.08, 0.35, 0.75, 0.25, "paleWood", sx * 0.15);
      break;
    case "lifeboat":
      ellipse(0, 0, 1, 1, 0, 0.55, "orange", 1.1);
      ellipse(0, 0, 0.85, 0.9, 0.55, 0.4, "orange", 0.75);
      for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) box(sx * 0.4, -0.25 + i * 0.16, 0.03, 0.06, 0.62, 0.15, "glass");
      ellipse(0, 0, 0.3, 0.2, 0.95, 0.05, "enamel");
      break;
    case "lifeRaft":
      for (const y of [-0.3, 0.3]) box(0, y, 1, 0.12, 0, 0.35, "darkSteel");
      disc(0, 0, 0.98, 0.95, 0.25, 0.75, "enamel");
      for (const x of [-0.25, 0.25]) disc(x, 0, 0.06, 0.97, 0.23, 0.77, "orange");
      break;
    case "anchor":
      box(0, -0.15, 0.1, 0.7, 0, 0.6, "darkSteel");
      ring(0, -0.47, 0.25, 0.06, 0, 0.6, "darkSteel", 0.6);
      box(0, -0.35, 0.6, 0.06, 0, 0.5, "darkSteel");
      turned(-0.25, 0.3, 0.45, 0.08, 0, 1, "darkSteel", -0.7);
      turned(0.25, 0.3, 0.45, 0.08, 0, 1, "darkSteel", 0.7);
      break;
    case "mooringBitt":
      box(0, 0, 1, 1, 0, 0.15, "darkSteel");
      for (const sx of [-1, 1]) {
        ellipse(sx * 0.25, 0, 0.36, 0.56, 0.15, 0.7, "darkSteel");
        ellipse(sx * 0.25, 0, 0.46, 0.7, 0.85, 0.15, "darkSteel");
      }
      break;
    case "shipWheel": {
      // 操舵輪: 台の上の、横（x の向き）を向いた輪と取っ手。輪は8枚の傾けた板で丸く組み、十字と斜めの輻（や）を渡す
      const r = Math.min(d * 0.38, height * 0.3), cz = height - r * 1.12 - 2;
      box(0, 0, 0.4, 0.5, 0, (cz - r * 0.2) / height, "woodDark");
      for (let i = 0; i < 8; i++) {
        const a = ((i + 0.5) / 8) * Math.PI * 2, len = 2 * r * Math.sin(Math.PI / 8) * 1.05;
        tilted(0, Math.cos(a) * r * 0.92, 4, len, 4, cz + Math.sin(a) * r * 0.92, a + Math.PI / 2, "wood");
        cm("disc", 0, Math.cos((i / 8) * Math.PI * 2) * r * 1.12, 4, 4, cz + Math.sin((i / 8) * Math.PI * 2) * r * 1.12 - 2, 4, "wood");
      }
      for (const tilt of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) tilted(0, 0, 3, r * 1.9, 3, cz, tilt, "wood");
      cm("disc", 0, 0, 8, 10, cz - 5, 10, "gold");
      break;
    }
    case "radarConsole":
      box(0, 0.1, 1, 0.8, 0, 0.75, "darkSteel");
      slab(0, -d * 0.2, w, d * 0.4, height * 0.75, height * 0.25, 5, "darkSteel", 1);
      cm("ellipse", 0, -d * 0.15, w * 0.4, w * 0.4, height * 0.82, 4, "led");
      for (let i = 0; i < 6; i++) box(-0.3 + i * 0.12, 0.35, 0.06, 0.06, 0.75, 0.03, i % 2 ? "redLamp" : "amberLamp");
      break;
    case "chartTable":
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) box(sx * 0.44, sy * 0.4, 0.06, 0.08, 0, 0.94, "woodDark");
      box(0, 0, 1, 1, 0.94, 0.04, "woodDark");
      box(0, 0, 0.8, 0.75, 0.98, 0.02, "paper");
      break;
    case "shipEngine":
      box(0, 0, 1, 1, 0, 0.1, "darkSteel");
      box(0, 0, 0.8, 0.95, 0.1, 0.55, "paint");
      for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) ellipse(sx * 0.2, -0.38 + i * 0.15, 0.22, 0.12, 0.65, 0.25, "steel");
      disc(0, 0, 0.12, 0.98, 0.3, 0.2, "darkSteel");
      box(0, 0, 0.3, 0.9, 0.9, 0.1, "darkSteel");
      break;
    case "shipHatch":
      box(0, 0, 1, 1, 0, 0.6, "paint");
      box(0, 0, 0.88, 0.88, 0.6, 0.3, "darkSteel");
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) box(sx * 0.4, sy * 0.4, 0.08, 0.08, 0.85, 0.15, "metal");
      ellipse(0, 0, 0.3, 0.3, 0.9, 0.1, "metal");
      break;

    // ---- 駅・線路 ----
    case "railSwitch": {
      // ポイント: まっすぐな2本のレールと、手前で分かれていく2本のレール。枕木を並べる
      for (let i = 0; i < 20; i++) box(0.02 * (i / 19), 0.48 - i * 0.05, 0.75 + 0.18 * (i / 19), 0.03, 0, 0.4, "wood");
      for (const x of [-0.18, 0.08]) box(x, 0, 0.02, 1, 0.4, 0.6, "metal");
      const split = Math.atan2(w * 0.25, d * 0.85);
      for (const x0 of [-0.18, 0.08]) turned(x0 + 0.13, 0.05, 0.02, 0.9, 0.4, 0.6, "metal", -split);
      break;
    }
    case "bufferStop":
      box(0, 0.2, 1, 0.5, 0, 0.5, "darkSteel");
      box(0, -0.15, 0.9, 0.3, 0, 0.75, "red");
      for (let i = 0; i < 4; i++) box(-0.33 + i * 0.22, -0.31, 0.11, 0.02, 0.4, 0.3, i % 2 ? "black" : "yellow");
      for (const sx of [-1, 1]) disc(sx * 0.3, -0.36, 0.12, 0.2, 0.5, 0.15, "darkSteel");
      box(0, -0.15, 0.95, 0.35, 0.92, 0.08, "red");
      break;
    case "platformEdge":
      box(0, 0, 1, 1, 0, 0.6, "concrete");
      box(0, 0.05, 1, 0.5, 0.6, 0.4, "tactile");
      for (let i = 0; i < 40; i++) box(-0.49 + i * 0.025, 0.05, 0.004, 0.42, 0.65, 0.35, "yellow");
      box(0, 0.45, 1, 0.1, 0.6, 0.2, "yellow");
      break;
    case "ticketGate":
      for (let i = 0; i < 4; i++) {
        const x = -0.45 + i * 0.3;
        box(x, 0, 0.08, 1, 0, 0.9, "enamel", 0.05);
        box(x, -0.2, 0.08, 0.15, 0.9, 0.1, "blueLamp");
        if (i < 3) box(x + 0.15, 0, 0.2, 0.04, 0.5, 0.25, "glass");
      }
      break;
    case "ticketMachine":
      // 券売機: 白い箱の正面が手前へ張り出し、斜めの画面。下にお金と切符の口
      box(0, -0.06, 1, 0.88, 0, 1, "enamel");
      box(0, 0.44, 0.9, 0.12, 0, 0.5, "enamel");
      slab(0, d * 0.44, w * 0.9, d * 0.12, height * 0.5, height * 0.14, 2, "screen", 1);
      box(0, 0.37, 0.85, 0.02, 0.72, 0.2, "screen");
      box(0.3, 0.495, 0.15, 0.01, 0.12, 0.08, "black");
      box(-0.25, 0.495, 0.3, 0.01, 0.3, 0.06, "darkSteel");
      break;
    case "stationSign":
      for (const sx of [-1, 1]) ellipse(sx * 0.45, 0, 0.05, 0.3, 0, 0.72, "metal");
      box(0, 0, 1, 0.5, 0.65, 0.35, "enamel");
      box(0, 0.26, 0.98, 0.02, 0.72, 0.06, "busStripe");
      break;
    case "kiosk":
      box(0, -0.1, 1, 0.8, 0, 0.6, "enamel");
      box(0, 0.38, 1, 0.24, 0, 0.35, "wood");
      for (let i = 0; i < 6; i++) box(-0.4 + i * 0.16, 0.38, 0.12, 0.18, 0.35, 0.08, (["goodsA", "goodsB", "goodsC", "goodsD"] as Mat[])[i % 4]);
      box(0, -0.25, 0.96, 0.3, 0.6, 0.25, "goodsB");
      box(0, 0, 1, 1, 0.85, 0.05, "busStripe");
      box(0, 0, 1, 1, 0.9, 0.1, "enamel");
      break;

    // ---- 街・道路 ----
    case "road":
      box(0, 0, 1, 1, 0, 0.6, "asphalt");
      for (let i = 0; i < 5; i++) box(0, -0.4 + i * 0.2, 0.025, 0.1, 0.6, 0.4, "roadLine");
      for (const sx of [-1, 1]) box(sx * 0.46, 0, 0.02, 1, 0.6, 0.4, "roadLine");
      break;
    case "crosswalk":
      box(0, 0, 1, 1, 0, 0.6, "asphalt");
      for (let i = 0; i < 7; i++) box(-0.42 + i * 0.14, 0, 0.08, 0.96, 0.6, 0.4, "roadLine");
      break;
    case "parkingStall":
      box(0, 0, 1, 1, 0, 0.5, "asphalt");
      for (const sx of [-1, 1]) box(sx * 0.48, 0, 0.04, 1, 0.5, 0.5, "roadLine");
      box(0, -0.49, 1, 0.02, 0.5, 0.5, "roadLine");
      box(0, -0.4, 0.5, 0.06, 0.5, 0.5, "black");
      break;
    case "roadArrow":
      box(0, 0.15, 0.25, 0.7, 0, 1, "roadLine");
      for (const sx of [-1, 1]) turned(sx * 0.18, -0.28, 0.22, 0.28, 0, 1, "roadLine", -sx * 0.8);
      break;
    case "roadSign":
      ellipse(0, 0, 0.1, 0.6, 0, 0.68, "metal");
      cm("disc", 0, 0, d * 0.3, w * 0.98, height * 0.68, height * 0.32, "red", { angle: Math.PI / 2 });
      cm("disc", 0, d * 0.16, 1, w * 0.72, height * 0.72, height * 0.24, "enamel", { angle: Math.PI / 2 });
      break;
    case "trafficLight":
      ellipse(-0.3, 0.2, 0.2, 0.3, 0, 0.82, "darkSteel");
      box(0.05, -0.1, 0.9, 0.5, 0.78, 0.22, "darkSteel");
      for (let i = 0; i < 3; i++) cm("disc", (-0.1 + i * 0.25) * w, d * 0.17, 2, w * 0.2, height * 0.83, height * 0.035, (["greenLamp", "amberLamp", "redLamp"] as Mat[])[i], { angle: Math.PI / 2 });
      break;
    case "bollardPost":
      ellipse(0, 0, 1, 1, 0, 0.9, "metal");
      ellipse(0, 0, 1, 1, 0.7, 0.08, "yellow");
      ellipse(0, 0, 1, 1, 0.9, 0.1, "metal", 0.6);
      break;
    case "puddle":
      ellipse(0, 0, 1, 1, 0, 1, "water");
      ellipse(0.2, -0.1, 0.4, 0.3, 0, 1, "water");
      break;
    case "cliff":
      for (let i = 0; i < 6; i++) turned(-0.36 + i * 0.144, -0.1 + (i % 2) * 0.1, 0.22, 0.6, 0, 0.6 + (i % 3) * 0.2, "granite", (i % 2 ? 0.2 : -0.15));
      box(0, -0.35, 1, 0.3, 0, 1, "stoneDark");
      break;
    case "landslide":
      ellipse(0, 0.05, 1, 0.9, 0, 0.6, "dirt", 0.5);
      for (let i = 0; i < 5; i++) sphere(-0.35 + i * 0.17, (i % 2) * 0.2 - 0.1, 0.18, 0.2, 0.4, 0.6, "granite");
      ellipse(-0.1, -0.1, 0.5, 0.5, 0.55, 0.45, "dirt", 0.3);
      break;
    case "siteFence":
      for (let i = 0; i < 4; i++) box(-0.375 + i * 0.25, 0, 0.24, 0.3, 0, 1, "enamel");
      for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) box(Math.max(-0.49, Math.min(0.49, x)), 0.25, 0.02, 0.5, 0, 1, "metal");
      box(0, 0, 1, 0.32, 0.45, 0.06, "busStripe");
      break;

    // ---- 学校・オフィス・お店 ----
    case "officeDesk":
      box(0, 0, 1, 1, 0.93, 0.07, "enamel");
      box(0.32, 0, 0.34, 0.95, 0, 0.93, "metal");
      for (let i = 0; i < 3; i++) box(0.32, 0.48, 0.3, 0.02, 0.05 + i * 0.3, 0.26, "board");
      box(-0.46, 0, 0.06, 0.95, 0, 0.93, "metal");
      break;
    case "receptionCounter":
      box(0, 0.1, 1, 0.8, 0, 0.92, "wood");
      box(0, 0.15, 1, 0.7, 0.92, 0.08, "paleWood");
      box(0, -0.25, 0.96, 0.5, 0.65, 0.04, "paleWood");
      box(0.25, -0.3, 0.2, 0.1, 0.69, 0.15, "screen");
      break;
    case "fileCabinet":
      // 書類棚: 鉄の箱に4段の引き出し。引き出しの前板が手前に少し出る
      box(0, -0.03, 1, 0.94, 0, 1, "metal");
      for (let i = 0; i < 4; i++) {
        box(0, 0.47, 0.94, 0.06, 0.03 + i * 0.245, 0.22, "board");
        box(0, 0.495, 0.3, 0.01, 0.12 + i * 0.245, 0.03, "darkSteel");
      }
      break;
    case "meetingTable":
      for (let i = 0; i < 3; i++) for (const sy of [-1, 1]) chair(-0.32 + i * 0.32, sy * 0.38, 0.2, 0.24, 0.6, 0.95, "cloth", -sy);
      box(0, 0, 0.9, 0.5, 0.92, 0.08, "paleWood");
      for (const sx of [-1, 1]) box(sx * 0.4, 0, 0.04, 0.4, 0, 0.92, "metal");
      break;
    case "islandDesks":
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        box(sx * 0.25, sy * 0.13, 0.48, 0.24, 0.55, 0.05, "enamel");
        box(sx * 0.25, sy * 0.13, 0.04, 0.2, 0, 0.55, "metal");
        chair(sx * 0.25, sy * 0.38, 0.18, 0.18, 0.4, 0.75, "cloth", -sy);
        box(sx * 0.25, sy * 0.05, 0.16, 0.03, 0.6, 0.18, "screen");
      }
      box(0, 0, 1, 0.03, 0.55, 0.45, "cloth");
      box(0, 0, 0.03, 0.55, 0.55, 0.45, "cloth");
      break;
    case "monitorWall":
      for (const sx of [-1, 1]) box(sx * 0.45, 0, 0.05, 1, 0, 0.98, "black");
      for (let row = 0; row < 2; row++) for (let i = 0; i < 3; i++) box(-0.31 + i * 0.31, 0.2, 0.3, 0.3, 0.3 + row * 0.34, 0.32, "screenGlow");
      box(0, -0.15, 1, 0.4, 0.98, 0.02, "black");
      break;
    case "operationsTable":
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) box(sx * 0.44, sy * 0.4, 0.06, 0.08, 0, 0.94, "darkSteel");
      box(0, 0, 1, 1, 0.94, 0.03, "darkSteel");
      box(0, 0, 0.9, 0.86, 0.97, 0.03, "paper");
      for (let i = 0; i < 5; i++) ellipse(-0.3 + i * 0.15, (i % 2) * 0.2 - 0.1, 0.03, 0.04, 0.98, 0.02, i % 2 ? "red" : "blue");
      break;
    case "radioSet":
      box(0, 0, 1, 1, 0, 0.8, "military");
      box(0, 0.49, 0.8, 0.02, 0.15, 0.5, "darkSteel");
      for (let i = 0; i < 3; i++) cm("disc", (-0.25 + i * 0.25) * w, d * 0.5 - 1, 2, 6, height * 0.35, 6, "metal", { angle: Math.PI / 2 });
      ellipse(0.35, -0.3, 0.06, 0.1, 0.8, 0.2, "black");
      break;
    case "gunRack":
      box(0, -0.4, 1, 0.2, 0, 1, "woodDark");
      box(0, 0.1, 1, 0.8, 0, 0.12, "woodDark");
      for (let i = 0; i < 6; i++) box(-0.4 + i * 0.16, -0.12, 0.04, 0.12, 0.12, 0.8, "black");
      box(0, -0.15, 1, 0.3, 0.6, 0.05, "woodDark");
      break;
    case "registerCounter":
      box(0, 0.05, 1, 0.9, 0, 0.92, "enamel");
      box(0, 0, 1, 1, 0.92, 0.04, "paleWood");
      box(0.25, -0.1, 0.25, 0.4, 0.96, 0.04, "black");
      slab(w * 0.25, -d * 0.15, w * 0.2, d * 0.2, height * 0.96, height * 0.04, 2, "screen", 1);
      break;
    case "fridgeCase":
      // 冷蔵ショーケース: 白い箱の正面がガラス戸。中の棚に飲み物。天板は奥へ寄せ、上から見て手前にガラス戸が見える
      box(0, -0.45, 1, 0.1, 0, 0.9, "enamel");
      for (const sx of [-1, 1]) box(sx * 0.49, -0.03, 0.02, 0.94, 0, 0.9, "enamel");
      box(0, -0.03, 0.96, 0.94, 0, 0.12, "enamel");
      for (const z of [0.4, 0.65]) box(0, -0.05, 0.96, 0.8, z - 0.015, 0.015, "metal");
      for (const z of [0.12, 0.4, 0.65]) for (let i = 0; i < 8; i++) ellipse(-0.42 + i * 0.12, -0.05, 0.08, 0.4, z, 0.18, (["goodsA", "goodsB", "goodsC", "goodsD"] as Mat[])[i % 4]);
      box(0, -0.03, 1, 0.94, 0.9, 0.1, "enamel");
      box(0, 0.4, 0.96, 0.04, 0.86, 0.04, "light");
      for (const x of [-0.25, 0.25]) box(x, 0.47, 0.48, 0.06, 0.03, 0.87, "glass");
      break;
    case "atm":
      box(0, 0, 1, 1, 0, 1, "enamel");
      slab(0, d * 0.35, w * 0.8, d * 0.3, height * 0.55, height * 0.12, 3, "screen", 1);
      box(0, 0.49, 0.7, 0.02, 0.4, 0.12, "darkSteel");
      box(0, 0.46, 1, 0.08, 0.85, 0.15, "blue");
      break;
    case "barberChair":
      ellipse(0, 0.05, 0.6, 0.45, 0, 0.1, "metal");
      ellipse(0, 0.05, 0.15, 0.12, 0.1, 0.3, "metal");
      box(0, 0.05, 0.8, 0.45, 0.4, 0.12, "velvet", 0.2);
      for (const sx of [-1, 1]) box(sx * 0.43, 0.05, 0.14, 0.4, 0.52, 0.15, "velvet");
      slab(0, -d * 0.32, w * 0.75, d * 0.2, height * 0.45, height * 0.55, 8, "velvet", 1);
      box(0, 0.42, 0.6, 0.12, 0.15, 0.06, "metal");
      break;

    // ---- 家の家具 ----
    case "canopyBed":
      // 天蓋付きベッド: 4本の柱の上に枠と、ふちから下がる布。上から見ても中のベッドが見えるよう、天井は張らない
      box(0, 0.03, 0.92, 0.92, 0, 0.25, "wood");
      box(0, 0.05, 0.88, 0.86, 0.25, 0.1, "linen", 0.05);
      box(0, 0.15, 0.86, 0.62, 0.35, 0.04, "velvet");
      for (const sx of [-1, 1]) box(sx * 0.22, -0.35, 0.36, 0.15, 0.35, 0.07, "linen", 0.3);
      box(0, -0.47, 0.88, 0.04, 0.25, 0.4, "wood");
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) box(sx * 0.42, sy * 0.44, 0.07, 0.06, 0.3, 0.6, "velvet");
      for (const sy of [-1, 1]) box(0, sy * 0.475, 0.9, 0.02, 0.8, 0.13, "velvet");
      for (const sx of [-1, 1]) box(sx * 0.475, 0, 0.02, 0.9, 0.8, 0.13, "velvet");
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) box(sx * 0.47, sy * 0.47, 0.06, 0.06, 0, 1, "wood");
      for (const sy of [-1, 1]) box(0, sy * 0.47, 0.88, 0.04, 0.93, 0.05, "wood");
      for (const sx of [-1, 1]) box(sx * 0.47, 0, 0.04, 0.88, 0.93, 0.05, "wood");
      break;
    case "dresser":
      box(0, 0.1, 1, 0.8, 0, 0.5, "wood");
      for (let i = 0; i < 3; i++) box(0, 0.5, 0.9, 0.02, 0.04 + i * 0.15, 0.13, "paleWood");
      box(0, -0.35, 0.7, 0.08, 0.5, 0.5, "wood");
      box(0, -0.31, 0.6, 0.02, 0.55, 0.4, "glass");
      for (let i = 0; i < 3; i++) ellipse(-0.3 + i * 0.15, 0.15, 0.06, 0.12, 0.5, 0.08, (["glass", "goodsA", "gold"] as Mat[])[i]);
      break;
    case "nightstand":
      box(0, 0, 1, 1, 0, 0.75, "wood");
      box(0, 0.49, 0.9, 0.02, 0.4, 0.3, "paleWood");
      ellipse(0, -0.1, 0.4, 0.45, 0.75, 0.25, "linen", 0.7);
      break;
    case "deskSet":
      box(0, -0.25, 1, 0.5, 0.67, 0.05, "wood");
      for (const sx of [-1, 1]) box(sx * 0.46, -0.25, 0.06, 0.48, 0, 0.67, "wood");
      box(-0.3, -0.3, 0.3, 0.2, 0.72, 0.03, "paper");
      chair(0, 0.3, 0.4, 0.38, 0.42, 0.85, "wood", -1);
      ellipse(0.3, -0.38, 0.1, 0.1, 0.72, 0.28, "enamel", 0.6);
      break;
    case "roundDining":
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        cm("box", Math.cos(a) * 0.3 * w, Math.sin(a) * 0.3 * d, w * 0.2, d * 0.2, 0, height * 0.56, "wood", { angle: a + Math.PI / 2 });
        cm("box", Math.cos(a) * 0.43 * w, Math.sin(a) * 0.43 * d, w * 0.2, d * 0.05, 0, height, "wood", { angle: a + Math.PI / 2 });
      }
      ellipse(0, 0, 0.1, 0.1, 0, 0.9, "wood");
      ellipse(0, 0, 0.6, 0.6, 0.9, 0.06, "paleWood");
      break;
    case "kitchenSink":
      // シンク: 台の天板に穴をあけ、その中に一段下がった流し。奥に蛇口
      box(0, 0, 1, 1, 0, 0.7, "enamel");
      box(0, 0.025, 0.6, 0.65, 0.7, 0.2, "darkSteel");
      for (const [x, y, pw, pd] of [[0, -0.4, 1, 0.2], [0, 0.425, 1, 0.15], [-0.4, 0.025, 0.2, 0.65], [0.4, 0.025, 0.2, 0.65]]) {
        box(x, y, pw, pd, 0.7, 0.24, "enamel");
        box(x, y, pw, pd, 0.94, 0.06, "metal");
      }
      ellipse(0, -0.38, 0.06, 0.1, 0.98, 0.02, "metal");
      break;
    case "cooktop":
      box(0, 0, 1, 1, 0, 0.94, "enamel");
      box(0, 0, 1, 1, 0.94, 0.04, "black");
      for (const x of [-0.25, 0.25]) for (const y of [-0.2, 0.2]) ring(x, y, 0.3, 0.3, 0.97, 0.03, "darkSteel", 0.6);
      break;
    case "grandPiano":
      // グランドピアノ: 左はまっすぐ、右は丸く絞った胴（ふたは閉じた形）。手前に鍵盤と両わきの腕木、3本の脚
      for (const [x, y] of [[-0.4, 0.3], [0.38, 0.3], [-0.12, -0.38]]) box(x, y, 0.06, 0.05, 0, 0.62, "black");
      box(0, 0.41, 0.88, 0.18, 0.62, 0.26, "enamel");
      for (let i = 0; i < 20; i++) box(-0.4 + i * 0.042, 0.37, 0.02, 0.1, 0.88, 0.02, "black");
      for (const sx of [-1, 1]) box(sx * 0.47, 0.41, 0.06, 0.18, 0.62, 0.3, "black");
      ellipse(0.1, -0.13, 0.8, 0.74, 0.62, 0.38, "black");
      box(-0.23, -0.12, 0.54, 0.76, 0.62, 0.38, "black", 0.3);
      box(0, 0.21, 1, 0.22, 0.62, 0.38, "black");
      break;
    case "gramophone":
      box(0, 0.1, 1, 0.8, 0, 0.3, "woodDark");
      ellipse(0, 0.1, 0.7, 0.55, 0.3, 0.03, "black");
      ellipse(0.25, -0.2, 0.06, 0.06, 0.3, 0.3, "gold");
      ellipse(0.1, -0.25, 0.8, 0.5, 0.55, 0.45, "gold", 2.5);
      break;

    // ---- 和風・神社 ----
    case "zataku":
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) box(sx * 0.42, sy * 0.38, 0.06, 0.1, 0, 0.85, "woodDark");
      box(0, 0, 1, 1, 0.85, 0.15, "woodDark");
      box(0, 0, 0.94, 0.9, 0.99, 0.01, "wood");
      break;
    case "engawaDeck":
      for (const x of [-0.45, -0.15, 0.15, 0.45]) for (const y of [-0.4, 0.4]) box(x, y, 0.03, 0.1, 0, 0.85, "woodDark");
      for (let i = 0; i < 10; i++) box(-0.45 + i * 0.1, 0, 0.098, 1, 0.85, 0.15, "paleWood");
      break;
    case "katanakake":
      box(0, 0, 1, 0.6, 0, 0.12, "black");
      for (const sx of [-1, 1]) box(sx * 0.42, 0, 0.08, 0.3, 0.12, 0.88, "black");
      for (const z of [0.55, 0.85]) disc(0, 0.05, 0.98, 0.12, z, 0.1, "black");
      for (const z of [0.68, 0.95]) disc(0, 0.12, 0.9, 0.12, z - 0.03, 0.05, "gold");
      break;
    case "shishiOdoshi":
      ellipse(0.25, 0.1, 0.45, 0.8, 0, 0.3, "stone");
      ellipse(0.25, 0.1, 0.32, 0.6, 0.3, 0.02, "water");
      for (const y of [-0.3, 0.3]) box(-0.15, y, 0.05, 0.1, 0, 0.75, "bamboo");
      cm("disc", 0, 0, w * 0.6, d * 0.24, height * 0.62, height * 0.14, "bamboo", { angle: -0.15 });
      box(-0.4, 0, 0.12, 0.12, 0, 1, "bamboo");
      break;
    case "stoneBridge":
      for (let i = 0; i < 3; i++) box(0, -0.33 + i * 0.33, 0.85, 0.32, 0.5, 0.25, "stone");
      for (const sx of [-1, 1]) box(sx * 0.46, 0, 0.08, 1, 0.5, 0.5, "granite");
      for (const sy of [-1, 1]) box(0, sy * 0.45, 0.9, 0.1, 0, 0.5, "granite");
      break;
    case "drumBridge": {
      // 太鼓橋: 中ほどが高い、反った木の橋と朱の欄干
      for (const sy of [-1, 1]) slab(0, sy * d * 0.25, w * 0.85, d * 0.5, 0, height * 0.55, 8, "wood", sy);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) slab(sx * (w / 2 - 4), sy * d * 0.25, 6, d * 0.5, height * 0.35, height * 0.65, 6, "vermilion", sy);
      for (const sx of [-1, 1]) for (const y of [-0.45, -0.2, 0, 0.2, 0.45]) box(sx * 0.46, y, 0.05, 0.03, 0, 1 - Math.abs(y) * 0.65, "vermilion");
      break;
    }
    case "pine": {
      // 松: 曲がった幹と、平たく広がる枝の葉（いくつかの段）
      ellipse(-0.05, 0.05, 0.1, 0.1, 0, 0.55, "wood");
      turned(0.1, -0.05, 0.3, 0.06, 0.45, 0.06, "wood", 0.4);
      const pads: [number, number, number, number, number][] = [[-0.2, 0.15, 0.55, 0.45, 0.5], [0.2, -0.15, 0.6, 0.5, 0.62], [0, 0.05, 0.45, 0.4, 0.78], [-0.1, -0.2, 0.4, 0.35, 0.68], [0.05, 0.1, 0.3, 0.28, 0.9]];
      for (const [x, y, pw, pd, z] of pads) ellipse(x, y, pw, pd, z, 0.1, "pine", 0.7);
      break;
    }
    case "bamboo":
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4, r = 0.12 + 0.28 * ((i * 37) % 9) / 9;
        ellipse(Math.cos(a) * r, Math.sin(a) * r, 0.05, 0.05, 0, 0.9 + (i % 3) * 0.05, "bambooGreen");
      }
      for (let i = 0; i < 5; i++) {
        const a = i * 1.3;
        ellipse(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.55, 0.55, 0.78 + (i % 2) * 0.08, 0.12, "leaf", 0.5);
      }
      break;
    case "moss":
      ellipse(0, 0, 1, 1, 0, 0.6, "moss");
      for (let i = 0; i < 6; i++) ellipse(-0.3 + (i % 3) * 0.3, i < 3 ? -0.15 : 0.18, 0.3, 0.3, 0.3, 0.7, "moss", 0.6);
      break;
    case "teaHouse":
      box(0, 0, 0.9, 0.9, 0, 0.12, "stone");
      box(0, 0, 0.84, 0.84, 0.12, 0.5, "plaster");
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) box(sx * 0.42, sy * 0.42, 0.04, 0.04, 0.12, 0.5, "woodDark");
      box(0, 0.42, 0.3, 0.02, 0.15, 0.25, "paper");
      for (const sy of [-1, 1]) slab(0, sy * d * 0.25, w, d * 0.5, height * 0.6, height * 0.4, 10, "straw", sy);
      break;
    case "temizuya":
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) box(sx * 0.42, sy * 0.38, 0.06, 0.08, 0, 0.7, "wood");
      box(0, 0, 0.6, 0.45, 0, 0.3, "stone");
      box(0, 0, 0.5, 0.35, 0.3, 0.02, "water");
      for (let i = 0; i < 3; i++) box(-0.15 + i * 0.15, 0.1, 0.03, 0.25, 0.33, 0.02, "bamboo");
      for (const sy of [-1, 1]) slab(0, sy * d * 0.25, w, d * 0.5, height * 0.7, height * 0.3, 10, "woodDark", sy);
      break;
    case "hokora":
      box(0, 0, 1, 1, 0, 0.25, "stone");
      box(0, 0, 0.7, 0.7, 0.25, 0.35, "wood");
      box(0, 0.36, 0.4, 0.02, 0.3, 0.25, "gold");
      for (const sy of [-1, 1]) slab(0, sy * d * 0.25, w * 0.9, d * 0.5, height * 0.6, height * 0.4, 5, "woodDark", sy);
      break;
    case "buddhaAltar":
      box(0, 0, 1, 1, 0, 0.3, "gold");
      box(0, 0, 0.9, 0.9, 0.3, 0.03, "trim");
      ellipse(0, -0.05, 0.5, 0.7, 0.33, 0.12, "gold", 0.9);
      ellipse(0, -0.05, 0.32, 0.45, 0.45, 0.3, "gold");
      sphere(0, -0.05, 0.16, 0.24, 0.72, 0.12, "gold");
      ellipse(0, -0.25, 0.6, 0.2, 0.33, 0.67, "gold", 0.4);
      for (const sx of [-1, 1]) ellipse(sx * 0.4, 0.3, 0.1, 0.15, 0.33, 0.3, "gold");
      break;
    case "templeBell":
      box(0, 0, 1, 1, 0, 0.06, "stone");
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) box(sx * 0.42, sy * 0.42, 0.06, 0.06, 0.06, 0.64, "woodDark");
      ellipse(0, 0, 0.36, 0.36, 0.3, 0.32, "darkSteel", 0.8);
      ellipse(0, 0, 0.04, 0.04, 0.62, 0.08, "darkSteel");
      disc(0, 0.25, 0.6, 0.06, 0.45, 0.03, "wood");
      for (const sy of [-1, 1]) slab(0, sy * d * 0.25, w, d * 0.5, height * 0.68, height * 0.32, 12, "darkSteel", sy);
      break;

    // ---- 人・事件・調査（小物と印） ----
    case "clueMarker":
      // 手がかりの印: 青い丸い札に、虫めがね（輪と柄）
      ellipse(0, 0, 1, 1, 0, 0.6, "blue");
      ring(-0.08, -0.08, 0.5, 0.5, 0.6, 0.4, "enamel", 0.65);
      turned(0.2, 0.2, 0.32, 0.1, 0.6, 0.4, "enamel", Math.PI / 4);
      break;
    case "dangerMark":
      // 危険の印: 黄色い三角（3枚の板）と、まんなかに縦の棒と点
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
        turned(Math.cos(a + Math.PI / 3) * 0.24, Math.sin(a + Math.PI / 3) * 0.24 + 0.05, 0.75, 0.12, 0, 0.6, "yellow", a + Math.PI / 3 + Math.PI / 2);
      }
      box(0, 0.02, 0.2, 0.42, 0, 0.6, "yellow");
      box(0, -0.02, 0.08, 0.2, 0.6, 0.4, "black");
      box(0, 0.18, 0.08, 0.07, 0.6, 0.4, "black");
      break;
    case "fingerprintMarker":
      ellipse(0, 0, 1, 1, 0, 0.6, "yellow");
      for (let i = 0; i < 3; i++) ring(0, 0.05, 0.25 + i * 0.18, 0.35 + i * 0.2, 0.6, 0.4, "black", 0.82);
      break;
    case "memo":
      box(0, 0, 1, 1, 0, 1, "paperWhite");
      for (let i = 0; i < 3; i++) box(-0.05, -0.25 + i * 0.25, 0.7, 0.08, 0.5, 0.5, "trim");
      break;
    case "diary":
      box(0, 0, 1, 1, 0, 0.8, "leather", 0.1);
      box(0.05, 0, 0.88, 0.9, 0.15, 0.6, "paperWhite");
      box(-0.46, 0, 0.08, 1, 0.8, 0.2, "red");
      break;
    case "keyItem":
      ring(-0.3, 0, 0.4, 1, 0, 1, "gold", 0.5);
      box(0.15, 0, 0.55, 0.25, 0, 1, "gold");
      box(0.38, 0.25, 0.08, 0.35, 0, 1, "gold");
      break;
    case "knife":
      box(-0.3, 0, 0.4, 0.8, 0, 1, "black", 0.2);
      box(0.2, 0, 0.6, 0.6, 0, 0.5, "metal");
      break;
    case "photo":
      box(0, 0, 1, 1, 0, 1, "paperWhite");
      box(0, -0.05, 0.85, 0.75, 0.5, 0.5, "photo");
      break;
    case "smartphone":
      box(0, 0, 1, 1, 0, 0.7, "black", 0.15);
      box(0, 0, 0.85, 0.85, 0.7, 0.3, "screen");
      break;
    case "pillBottle":
      for (const [x, y, s] of [[-0.25, 0, 0.45], [0.25, 0.1, 0.4]] as [number, number, number][]) {
        ellipse(x, y, s, s * 1.25, 0, 0.8, "orange");
        ellipse(x, y, s, s * 1.25, 0.8, 0.2, "enamel");
      }
      break;
    case "flashlight":
      disc(-0.15, 0, 0.7, 0.7, 0.1, 0.7, "black");
      disc(0.35, 0, 0.3, 1, 0, 1, "darkSteel");
      break;
    case "toolbox":
      box(0, 0, 1, 1, 0, 0.75, "red", 0.05);
      box(0, 0, 0.6, 0.15, 0.75, 0.05, "black");
      for (const sx of [-1, 1]) box(sx * 0.32, 0, 0.06, 0.15, 0.75, 0.25, "black");
      box(0, 0, 0.6, 0.15, 0.95, 0.05, "black");
      break;
    case "bag":
      box(0, 0, 1, 1, 0, 0.75, "leather", 0.15);
      box(0, 0.48, 0.6, 0.04, 0.3, 0.3, "gold");
      for (const sx of [-1, 1]) box(sx * 0.2, 0, 0.05, 0.3, 0.75, 0.25, "leather");
      box(0, 0, 0.45, 0.3, 0.95, 0.05, "leather");
      break;
    case "wallet":
      box(0, 0, 1, 1, 0, 1, "leather", 0.15);
      box(0.3, 0, 0.1, 0.8, 0.7, 0.3, "gold");
      break;
    case "papers":
      for (let i = 0; i < 4; i++) cm("box", (i - 1.5) * 0.4, (i - 1.5) * 0.3, w * 0.88, d * 0.88, i * height * 0.25, height * 0.25, "paperWhite", { angle: (i - 1.5) * 0.05 });
      break;
    case "fileFolder":
      box(0, 0, 1, 1, 0, 1, "blue", 0.05);
      box(0.1, 0, 0.75, 0.85, 0.7, 0.3, "paperWhite");
      box(-0.42, 0, 0.1, 0.9, 0.9, 0.1, "metal");
      break;
    case "laptop":
      box(0, 0.25, 1, 0.5, 0, 0.08, "darkSteel", 0.05);
      box(0, 0.25, 0.85, 0.35, 0.08, 0.02, "black");
      slab(0, -d * 0.25, w, d * 0.48, height * 0.05, height * 0.95, 1, "darkSteel", 1);
      break;
    case "voiceRecorder":
      box(0, 0, 1, 1, 0, 1, "darkSteel", 0.2);
      box(0, -0.25, 0.6, 0.3, 0.6, 0.4, "screen");
      ellipse(0, 0.25, 0.4, 0.2, 0.6, 0.4, "black");
      break;
    case "camera":
      box(0, 0.1, 1, 0.8, 0, 0.8, "black", 0.1);
      cm("disc", 0, -d * 0.35, d * 0.3, w * 0.45, height * 0.1, height * 0.6, "darkSteel", { angle: Math.PI / 2 });
      box(-0.3, 0.1, 0.25, 0.4, 0.8, 0.2, "black");
      break;
    case "bulletCasings":
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4, r = 0.1 + 0.3 * ((i * 5) % 9) / 9;
        cm("disc", Math.cos(a) * r * w, Math.sin(a) * r * d, 3, 1.2, 0, height, "gold", { angle: a });
      }
      break;
    case "bulletHoles":
      for (const side of [-1, 1]) for (const [x, z] of [[-0.3, 0.45], [0.05, 0.6], [0.3, 0.42], [-0.1, 0.3], [0.2, 0.75]]) {
        cm("disc", x * w, side * d * 0.36, d * 0.25, 4, z * height, 4, "black", { angle: Math.PI / 2 });
      }
      box(0, 0, 0.02, 0.02, 0, 1, "black");
      break;
    case "burnMark":
      ellipse(0, 0, 1, 1, 0, 1, "soot");
      for (let i = 0; i < 5; i++) {
        const a = i * 1.3;
        ellipse(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.3, 0.25, 0, 1, "soot");
      }
      ellipse(0, 0, 0.5, 0.5, 0, 1, "black");
      break;
    case "brokenFurniture":
      turned(-0.15, -0.1, 0.6, 0.35, 0, 0.12, "wood", 0.3);
      for (let i = 0; i < 3; i++) turned(-0.3 + i * 0.25, 0.25, 0.35, 0.06, 0, 0.1, "wood", 0.8 - i * 0.6);
      slab(w * 0.25, 0, w * 0.4, d * 0.6, 0, height, 4, "wood", -1);
      box(0.3, -0.35, 0.08, 0.08, 0, 0.6, "wood");
      break;
    case "keepOutTape":
      for (const sx of [-1, 1]) {
        ellipse(sx * 0.46, 0, 0.06, 1, 0, 0.05, "orange");
        ellipse(sx * 0.46, 0, 0.02, 0.5, 0, 1, "orange");
      }
      for (let i = 0; i < 10; i++) box(-0.4 + i * 0.09, 0, 0.09, 0.3, 0.82, 0.12, i % 2 ? "black" : "yellow");
      break;
    case "boundPerson":
      chair(0, 0, 0.8, 0.7, 0.36, 0.72, "wood", 1);
      for (const sx of [-1, 1]) ellipse(sx * 0.15, 0.25, 0.18, 0.3, 0, 0.36, "suitDark");
      box(0, 0.12, 0.45, 0.42, 0.36, 0.1, "suitDark", 0.3);
      ellipse(0, -0.05, 0.5, 0.36, 0.42, 0.32, "suitDark");
      ring(0, -0.05, 0.6, 0.44, 0.55, 0.06, "rope", 0.8);
      sphere(0, -0.05, 0.26, 0.24, 0.74, 0.18, "skin");
      sphere(0, -0.1, 0.27, 0.25, 0.8, 0.2, "hair");
      break;

    // ---- ホラー・オカルト ----
    case "strangeIdol":
      box(0, 0, 0.8, 0.8, 0, 0.25, "stoneDark");
      ellipse(0, 0, 0.5, 0.5, 0.25, 0.35, "stoneDark", 0.8);
      sphere(0, 0, 0.55, 0.55, 0.55, 0.35, "stoneDark");
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        cm("ellipse", Math.cos(a) * w * 0.32, Math.sin(a) * d * 0.32, w * 0.1, d * 0.1, height * 0.3, height * 0.5, "stoneDark", { taper: 0.3 });
      }
      for (const sx of [-1, 1]) sphere(sx * 0.1, 0.22, 0.08, 0.08, 0.85, 0.06, "eye");
      sphere(0, 0, 0.3, 0.3, 0.88, 0.12, "stoneDark");
      break;
    case "jizo":
      box(0, 0, 1, 1, 0, 0.2, "stone");
      ellipse(0, 0, 0.55, 0.55, 0.2, 0.5, "stone", 0.85);
      ellipse(0, 0.08, 0.6, 0.45, 0.55, 0.15, "red", 0.7);
      sphere(0, 0, 0.42, 0.42, 0.7, 0.3, "stone");
      break;
    case "magicCircle":
      ring(0, 0, 1, 1, 0, 1, "magic", 0.94);
      ring(0, 0, 0.8, 0.8, 0, 1, "magic", 0.93);
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 4) / 5, b2 = -Math.PI / 2 + ((i + 1) * Math.PI * 4) / 5;
        const x1 = Math.cos(a) * 0.38, y1 = Math.sin(a) * 0.38, x2 = Math.cos(b2) * 0.38, y2 = Math.sin(b2) * 0.38;
        turned((x1 + x2) / 2, (y1 + y2) / 2, Math.hypot(x2 - x1, y2 - y1), 0.02, 0, 1, "magic", Math.atan2(y2 - y1, x2 - x1));
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ellipse(Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0.04, 0.04, 0, 1, "magic");
      }
      break;
    case "candelabra":
      ellipse(0, 0, 0.7, 0.7, 0, 0.05, "gold");
      ellipse(0, 0, 0.1, 0.1, 0.05, 0.65, "gold");
      disc(0, 0, 0.8, 0.08, 0.68, 0.04, "gold");
      for (const x of [-0.38, 0, 0.38]) {
        ellipse(x, 0, 0.15, 0.15, 0.72, 0.03, "gold");
        ellipse(x, 0, 0.08, 0.08, 0.75, 0.15, "paper");
        ellipse(x, 0, 0.06, 0.06, 0.9, 0.1, "flame", 0.2);
      }
      break;
    case "bones":
      sphere(-0.25, -0.1, 0.32, 0.35, 0, 1, "bone");
      for (const sx of [-1, 1]) sphere(-0.3 + sx * 0.06, 0.02, 0.07, 0.07, 0.4, 0.2, "black");
      turned(0.15, 0.1, 0.55, 0.1, 0, 0.5, "bone", 0.4);
      turned(0.2, -0.25, 0.45, 0.08, 0, 0.45, "bone", -0.6);
      turned(-0.05, 0.32, 0.35, 0.08, 0, 0.4, "bone", 0.1);
      break;
    case "humanPod":
      ellipse(0, 0, 1, 1, 0, 0.1, "darkSteel");
      ellipse(0, 0, 0.84, 0.84, 0.1, 0.78, "glass");
      ellipse(0, 0, 0.8, 0.8, 0.12, 0.6, "slime");
      ellipse(0, 0, 0.25, 0.18, 0.15, 0.45, "flesh");
      sphere(0, 0, 0.18, 0.16, 0.6, 0.1, "flesh");
      ellipse(0, 0, 1, 1, 0.88, 0.12, "darkSteel");
      break;
    case "sarcophagus":
      box(0, 0, 1, 1, 0, 0.7, "granite");
      box(0, 0, 1, 1, 0.7, 0.15, "stone");
      box(0, 0, 0.6, 0.8, 0.85, 0.15, "stone", 0.1);
      sphere(0, -0.32, 0.3, 0.12, 0.88, 0.12, "stone");
      break;
    case "ritualTable":
      for (const sx of [-1, 1]) box(sx * 0.35, 0, 0.2, 0.7, 0, 0.75, "stoneDark");
      box(0, 0, 1, 1, 0.75, 0.15, "stoneDark");
      box(0, 0.05, 0.6, 0.5, 0.9, 0.02, "blood");
      for (const [x, y] of [[-0.42, -0.4], [0.42, -0.4], [-0.42, 0.4], [0.42, 0.4]]) {
        ellipse(x, y, 0.06, 0.08, 0.9, 0.06, "paper");
        ellipse(x, y, 0.04, 0.05, 0.96, 0.04, "flame", 0.2);
      }
      break;
    case "chains":
      for (let i = 0; i < 12; i++) ring(-0.455 + i * 0.083, (i % 2) * 0.15 - 0.075, 0.08, 0.4, 0, 1, "darkSteel", 0.55);
      break;
    case "stele":
      box(0, 0, 1, 1, 0, 0.1, "stoneDark");
      box(0, 0, 0.8, 0.6, 0.1, 0.85, "stoneDark");
      box(0, 0, 0.7, 0.55, 0.95, 0.05, "stoneDark", 0.3);
      for (let i = 0; i < 4; i++) box(0, 0.31, 0.5, 0.02, 0.3 + i * 0.12, 0.05, "magic");
      break;
    case "totem":
      for (let i = 0; i < 4; i++) {
        box(0, 0, 0.7, 0.7, i * 0.22, 0.2, (["woodDark", "red", "woodDark", "goodsB"] as Mat[])[i]);
        for (const sx of [-1, 1]) box(sx * 0.15, 0.35, 0.12, 0.02, i * 0.22 + 0.1, 0.05, "enamel");
      }
      for (const sx of [-1, 1]) turned(sx * 0.35, 0, 0.3, 0.2, 0.75, 0.1, "goodsB", 0);
      box(0, 0, 0.5, 0.5, 0.88, 0.12, "goodsC");
      break;
    case "offering":
      box(0, 0, 1, 1, 0, 0.3, "paleWood");
      ellipse(-0.25, 0, 0.35, 0.5, 0.3, 0.35, "ceramic");
      sphere(-0.25, 0, 0.3, 0.4, 0.5, 0.5, "enamel");
      for (const x of [0.15, 0.35]) sphere(x, 0.05, 0.22, 0.32, 0.3, 0.5, x > 0.2 ? "orange" : "red");
      break;
    case "cursedItem":
      box(0, 0.2, 0.9, 0.5, 0, 0.3, "woodDark");
      ellipse(0, -0.15, 0.45, 0.4, 0, 0.6, "linen");
      sphere(0, -0.15, 0.35, 0.3, 0.55, 0.45, "linen");
      box(0, -0.02, 0.15, 0.04, 0.3, 0.5, "red");
      for (const sx of [-1, 1]) sphere(sx * 0.08, -0.32, 0.06, 0.04, 0.75, 0.08, "black");
      break;
    case "fleshMass":
      for (const [x, y, s, z] of [[-0.2, 0, 0.6, 0.7], [0.25, 0.1, 0.5, 0.55], [0, -0.25, 0.4, 0.5], [0.1, 0.3, 0.35, 0.4]] as [number, number, number, number][]) sphere(x, y, s, s, 0, z, "flesh");
      for (const [x, y] of [[-0.1, 0.1], [0.3, -0.05], [0.05, -0.2]]) sphere(x, y, 0.1, 0.1, 0.55, 0.12, "eye");
      sphere(-0.15, 0.05, 0.3, 0.3, 0.5, 0.5, "flesh");
      break;
    case "blackStain":
      ellipse(0, 0, 0.8, 0.75, 0, 1, "black");
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9, r = 0.38 + (i % 3) * 0.04;
        ellipse(Math.cos(a) * r, Math.sin(a) * r, 0.12 + (i % 2) * 0.06, 0.1, 0, 1, "black");
      }
      break;
    case "tendrils":
      for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
        const x = -0.35 + i * 0.23;
        slab(x * w, side * d * 0.32, w * 0.05, d * 0.3, 0, height * (0.55 + (i % 2) * 0.45), 4, "flesh", side);
        sphere(x, side * 0.3, 0.12, 0.3, 0, 0.08, "flesh");
      }
      break;
    case "abyss":
      ellipse(0, 0, 1, 1, 0, 0.5, "magic");
      ellipse(0, 0, 0.88, 0.88, 0, 1, "black");
      ellipse(0.05, -0.05, 0.5, 0.45, 0, 1, "black");
      break;

    // ---- 人物・動物・怪物 ----
    case "manFigure":
      figure("suitDark", "trim");
      break;
    case "womanFigure":
      figure("cloth", "skin", { skirt: true });
      break;
    case "childFigure":
      figure("yellow", "blue");
      break;
    case "elderFigure":
      figure("leather", "trim");
      ellipse(0.42, 0.3, 0.06, 0.08, 0, 0.55, "wood");
      break;
    case "policeFigure":
      figure("police", "police", { hat: "police" });
      break;
    case "soldierFigure":
      figure("military", "military", { hat: "military" });
      turned(0.15, 0.3, 0.12, 0.25, 0.45, 0.06, "black", 0.3);
      break;
    case "doctorFigure":
      figure("enamel", "trim", { coat: true });
      break;
    case "nurseFigure":
      figure("pink", "enamel", { skirt: true });
      break;
    case "scientistFigure":
      figure("enamel", "trim", { coat: true, arms: "enamel" });
      box(0, 0.25, 0.3, 0.06, 0.88, 0.04, "glass");
      break;
    case "workerFigure":
      figure("orange", "blue", { hat: "yellow" });
      break;
    case "stationStaffFigure":
      figure("navy", "navy", { hat: "navy" });
      break;
    case "sailorFigure":
      figure("enamel", "navy", { hat: "enamel" });
      break;
    case "guardFigure":
      figure("navy", "navy", { hat: "black" });
      break;
    case "robedFigure":
      figure("robe", "robe", { hood: true });
      break;
    case "cat":
      for (const sx of [-1, 1]) for (const y of [-0.25, 0.2]) ellipse(sx * 0.2, y, 0.25, 0.12, 0, 0.45, "fur");
      ellipse(0, -0.02, 0.7, 0.65, 0.3, 0.4, "fur");
      sphere(0, 0.32, 0.6, 0.3, 0.5, 0.42, "fur");
      for (const sx of [-1, 1]) ellipse(sx * 0.18, 0.32, 0.18, 0.1, 0.82, 0.18, "fur", 0.1);
      turned(0, -0.37, 0.12, 0.25, 0.3, 0.12, "fur", 0);
      break;
    case "dog":
    case "bigDog":
      for (const sx of [-1, 1]) for (const y of [-0.22, 0.18]) ellipse(sx * 0.22, y, 0.25, 0.1, 0, 0.5, "fur");
      ellipse(0, -0.03, 0.75, 0.62, 0.42, 0.33, "fur");
      sphere(0, 0.32, 0.6, 0.25, 0.6, 0.35, "fur");
      ellipse(0, 0.44, 0.3, 0.12, 0.62, 0.15, "fur");
      for (const sx of [-1, 1]) ellipse(sx * 0.22, 0.3, 0.15, 0.1, 0.78, 0.22, "furDark", 0.4);
      turned(0, -0.4, 0.1, 0.2, 0.62, 0.15, "fur", 0);
      break;
    case "bird":
      sphere(0, 0, 0.6, 0.7, 0.1, 0.6, "feather");
      sphere(0, 0.3, 0.38, 0.35, 0.55, 0.45, "feather");
      ellipse(0, 0.46, 0.1, 0.06, 0.7, 0.1, "yellow", 0.2);
      for (const sx of [-1, 1]) turned(sx * 0.3, -0.05, 0.25, 0.5, 0.35, 0.25, "feather", sx * 0.2);
      for (const sx of [-1, 1]) ellipse(sx * 0.12, 0.05, 0.05, 0.05, 0, 0.15, "yellow");
      break;
    case "wildAnimal":
      for (const sx of [-1, 1]) for (const y of [-0.25, 0.2]) ellipse(sx * 0.28, y, 0.28, 0.14, 0, 0.45, "furDark");
      sphere(0, -0.02, 0.9, 0.75, 0.25, 0.6, "furDark");
      sphere(0, 0.36, 0.55, 0.28, 0.45, 0.42, "furDark");
      ellipse(0, 0.47, 0.25, 0.06, 0.5, 0.2, "fur");
      for (const sx of [-1, 1]) sphere(sx * 0.2, 0.32, 0.15, 0.07, 0.82, 0.18, "furDark");
      break;
    case "humanoidEnemy":
      figure("monsterDark", "monsterDark", { arms: "monsterDark" });
      for (const sx of [-1, 1]) sphere(sx * 0.07, 0.25, 0.08, 0.06, 0.9, 0.05, "eye");
      for (const sx of [-1, 1]) cm("ellipse", sx * w * 0.12, -d * 0.05, w * 0.08, d * 0.1, height * 0.94, height * 0.06, "horn", { taper: 0.1 });
      break;
    case "smallMonster":
      ellipse(0, 0, 1, 1, 0, 0.4, "slime", 0.85);
      sphere(0, 0, 0.85, 0.85, 0.15, 0.75, "slime");
      for (const sx of [-1, 1]) sphere(sx * 0.15, 0.3, 0.15, 0.12, 0.6, 0.18, "enamel");
      for (const sx of [-1, 1]) sphere(sx * 0.15, 0.36, 0.07, 0.06, 0.65, 0.08, "black");
      sphere(0, 0, 0.3, 0.3, 0.85, 0.15, "slime");
      break;
    case "monster":
      for (const sx of [-1, 1]) for (const y of [-0.25, 0.2]) ellipse(sx * 0.3, y, 0.22, 0.2, 0, 0.42, "monster");
      sphere(0, -0.03, 0.85, 0.8, 0.3, 0.45, "monster");
      sphere(0, 0.3, 0.5, 0.35, 0.55, 0.32, "monster");
      for (const sx of [-1, 1]) sphere(sx * 0.1, 0.45, 0.1, 0.06, 0.72, 0.06, "eye");
      for (const sx of [-1, 1]) cm("ellipse", sx * w * 0.18, d * 0.25, w * 0.08, d * 0.08, height * 0.8, height * 0.2, "horn", { taper: 0.1 });
      for (let i = 0; i < 4; i++) cm("ellipse", 0, d * (0.1 - i * 0.12), w * 0.08, d * 0.08, height * 0.72, height * 0.12, "horn", { taper: 0.1 });
      turned(0, -0.42, 0.12, 0.16, 0.25, 0.15, "monster", 0);
      break;
    case "largeMonster":
      for (const sx of [-1, 1]) ellipse(sx * 0.2, 0, 0.25, 0.3, 0, 0.4, "monster");
      ellipse(0, 0, 0.75, 0.6, 0.35, 0.4, "monster");
      for (const sx of [-1, 1]) ellipse(sx * 0.4, 0.1, 0.18, 0.25, 0.25, 0.5, "monster");
      for (const sx of [-1, 1]) sphere(sx * 0.39, 0.15, 0.2, 0.25, 0.15, 0.15, "monster");
      sphere(0, 0, 0.9, 0.55, 0.65, 0.18, "monster");
      sphere(0, 0.05, 0.35, 0.35, 0.78, 0.2, "monster");
      for (const sx of [-1, 1]) sphere(sx * 0.07, 0.2, 0.06, 0.05, 0.88, 0.04, "eye");
      for (const sx of [-1, 1]) cm("ellipse", sx * w * 0.1, 0, w * 0.06, d * 0.06, height * 0.92, height * 0.08, "horn", { taper: 0.1 });
      break;
    case "bossMonster": {
      // 竜: 4本の脚の胴、長い首と頭、大きく広げた翼（2枚の傾けた板）、長い尾
      for (const sx of [-1, 1]) for (const y of [-0.12, 0.12]) ellipse(sx * 0.16, y, 0.1, 0.1, 0, 0.3, "monster");
      sphere(0, 0, 0.4, 0.45, 0.2, 0.3, "monster");
      turned(0, 0.3, 0.1, 0.25, 0.35, 0.25, "monster", 0);
      sphere(0, 0.43, 0.15, 0.14, 0.55, 0.12, "monster");
      for (const sx of [-1, 1]) sphere(sx * 0.04, 0.48, 0.03, 0.03, 0.62, 0.03, "eye");
      for (const sx of [-1, 1]) cm("ellipse", sx * w * 0.05, d * 0.38, w * 0.03, d * 0.05, height * 0.66, height * 0.1, "horn", { taper: 0.1 });
      for (const sx of [-1, 1]) slab(sx * w * 0.3, -d * 0.02, w * 0.4, d * 0.45, height * 0.45, height * 0.24, 6, "monsterDark", 1);
      const wingRise = d * 0.3 * Math.sin(0.3) + 4 * Math.cos(0.3);
      for (const sx of [-1, 1]) tilted(sx * w * 0.3, 0, w * 0.38, d * 0.3, 4, height - wingRise / 2, 0.3 * sx, "monsterDark");
      turned(0, -0.33, 0.08, 0.3, 0.25, 0.08, "monster", 0.1);
      turned(0.06, -0.45, 0.06, 0.06, 0.2, 0.06, "monster", 0.3);
      break;
    }
    case "hugeMonster":
      for (const sx of [-1, 1]) ellipse(sx * 0.18, 0.05, 0.2, 0.25, 0, 0.35, "monster");
      ellipse(0, 0, 0.6, 0.55, 0.3, 0.4, "monster", 0.8);
      sphere(0, 0.05, 0.5, 0.45, 0.6, 0.3, "monster");
      for (const sx of [-1, 1]) ellipse(sx * 0.32, 0.18, 0.12, 0.16, 0.45, 0.25, "monster");
      sphere(0, 0.18, 0.28, 0.3, 0.82, 0.18, "monster");
      for (const sx of [-1, 1]) sphere(sx * 0.06, 0.32, 0.04, 0.03, 0.92, 0.03, "eye");
      for (let i = 0; i < 6; i++) cm("ellipse", 0, -d * (0.05 + i * 0.07), w * 0.05, d * 0.05, height * (0.7 - i * 0.06), height * 0.15, "horn", { taper: 0.1 });
      turned(0, -0.35, 0.15, 0.3, 0, 0.15, "monster", 0);
      turned(0.1, -0.44, 0.08, 0.06, 0, 0.1, "monster", 0.4);
      break;

    // ---- SF ----
    case "sfConsole":
      box(0, 0.15, 1, 0.7, 0, 0.75, "darkSteel", 0.05);
      slab(0, -d * 0.2, w, d * 0.4, height * 0.75, height * 0.25, 5, "darkSteel", 1);
      for (let i = 0; i < 4; i++) box(-0.36 + i * 0.24, -0.2, 0.2, 0.25, 0.82, 0.04, "screenGlow");
      for (let i = 0; i < 10; i++) box(-0.42 + i * 0.094, 0.35, 0.05, 0.08, 0.75, 0.02, (["led", "redLamp", "blueLamp"] as Mat[])[i % 3]);
      break;
    case "pilotSeat":
      ellipse(0, 0.05, 0.4, 0.3, 0, 0.35, "darkSteel");
      box(0, 0.1, 0.8, 0.6, 0.35, 0.1, "black", 0.2);
      slab(0, -d * 0.3, w * 0.8, d * 0.25, height * 0.4, height * 0.6, 10, "black", 1);
      for (const sx of [-1, 1]) {
        box(sx * 0.45, 0.15, 0.1, 0.5, 0.45, 0.1, "darkSteel");
        ellipse(sx * 0.45, 0.35, 0.08, 0.08, 0.55, 0.12, "redLamp");
      }
      break;
    case "cryoPod":
      box(0, 0, 1, 1, 0, 0.35, "enamel", 0.05);
      ellipse(0, 0, 0.9, 0.92, 0.35, 0.3, "ice");
      ellipse(0, 0.02, 0.35, 0.8, 0.35, 0.25, "linen");
      ellipse(0, 0, 0.92, 0.95, 0.6, 0.4, "glass");
      box(0, -0.45, 0.6, 0.06, 0.35, 0.15, "screenGlow");
      break;
    case "reactor":
      box(0, 0, 1, 1, 0, 0.1, "darkSteel");
      ellipse(0, 0, 0.7, 0.7, 0.1, 0.8, "darkSteel");
      for (const z of [0.25, 0.5, 0.75]) ring(0, 0, 0.9, 0.9, z, 0.05, "hologram", 0.8);
      ellipse(0, 0, 0.35, 0.35, 0.15, 0.85, "screenGlow");
      ellipse(0, 0, 0.75, 0.75, 0.9, 0.1, "darkSteel", 0.6);
      break;
    case "holoTable":
      ellipse(0, 0, 0.5, 0.5, 0, 0.75, "darkSteel");
      ellipse(0, 0, 1, 1, 0.75, 0.08, "darkSteel");
      ellipse(0, 0, 0.8, 0.8, 0.83, 0.02, "screenGlow");
      sphere(0, 0, 0.45, 0.45, 0.85, 0.15, "hologram");
      break;
    case "sfHatch":
      box(0, 0, 1, 1, 0, 0.5, "darkSteel");
      ellipse(0, 0, 0.85, 0.85, 0.5, 0.3, "metal");
      for (let i = 0; i < 4; i++) turned(0, 0, 0.8, 0.06, 0.8, 0.2, i % 2 ? "black" : "yellow", (i * Math.PI) / 4);
      ellipse(0, 0, 0.3, 0.3, 0.8, 0.2, "darkSteel");
      break;

    // ---- ファンタジー ----
    case "weaponRack":
      box(0, -0.35, 1, 0.3, 0, 1, "woodDark");
      box(0, 0.1, 1, 0.8, 0, 0.1, "woodDark");
      for (let i = 0; i < 5; i++) {
        const x = -0.38 + i * 0.19;
        box(x, -0.12, 0.03, 0.12, 0.1, 0.85, i % 2 ? "metal" : "wood");
        box(x, -0.12, 0.12, 0.1, 0.55, 0.03, "gold");
      }
      box(0, -0.15, 1, 0.2, 0.62, 0.05, "woodDark");
      break;
    case "armorStand":
      box(0, 0, 0.8, 0.8, 0, 0.05, "woodDark");
      ellipse(0, 0, 0.08, 0.08, 0.05, 0.3, "woodDark");
      for (const sx of [-1, 1]) ellipse(sx * 0.15, 0, 0.18, 0.3, 0.05, 0.4, "metal");
      ellipse(0, 0, 0.6, 0.55, 0.42, 0.33, "metal");
      for (const sx of [-1, 1]) sphere(sx * 0.33, 0, 0.28, 0.4, 0.68, 0.12, "metal");
      for (const sx of [-1, 1]) ellipse(sx * 0.4, 0.05, 0.16, 0.25, 0.42, 0.3, "metal");
      sphere(0, 0, 0.3, 0.36, 0.78, 0.22, "metal");
      box(0, 0.12, 0.2, 0.06, 0.85, 0.06, "black");
      break;
    case "cauldron":
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
        ellipse(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.1, 0.1, 0, 0.25, "iron");
      }
      for (let i = 0; i < 4; i++) turned(0, 0, 0.7, 0.08, 0, 0.12, "wood", i * 0.8);
      ellipse(0, 0, 0.3, 0.3, 0.06, 0.15, "flame", 0.3);
      ellipse(0, 0, 0.9, 0.9, 0.2, 0.6, "iron", 1.1);
      ellipse(0, 0, 0.82, 0.82, 0.78, 0.04, "slime");
      ring(0, 0, 1, 1, 0.8, 0.2, "iron", 0.85);
      break;
    case "crystalBall":
      ellipse(0, 0, 0.6, 0.6, 0, 0.05, "woodDark");
      ellipse(0, 0, 0.12, 0.12, 0.05, 0.5, "woodDark");
      ring(0, 0, 0.5, 0.5, 0.55, 0.08, "gold", 0.7);
      sphere(0, 0, 0.7, 0.7, 0.6, 0.4, "crystal");
      break;
    case "banner":
      disc(0, 0, 1, 0.5, 0.95, 0.05, "wood");
      box(0, 0.1, 0.9, 0.3, 0.4, 0.55, "velvet");
      box(0, 0.26, 0.4, 0.02, 0.55, 0.25, "gold");
      for (let i = 0; i < 2; i++) box(-0.25 + i * 0.5, 0.1, 0.4, 0.3, 0.32, 0.1, "velvet");
      break;
    case "anvil":
      box(0, 0, 0.7, 0.8, 0, 0.45, "woodDark");
      box(0, 0, 0.45, 0.5, 0.45, 0.2, "iron");
      box(0.05, 0, 0.8, 0.75, 0.65, 0.35, "iron");
      cm("ellipse", w * 0.45, 0, w * 0.1, d * 0.3, height * 0.75, height * 0.25, "iron", { taper: 0.3 });
      break;
    case "forge":
      box(0, 0, 1, 1, 0, 0.55, "stone");
      box(0, 0.05, 0.6, 0.6, 0.55, 0.05, "coal");
      ellipse(0, 0.05, 0.4, 0.4, 0.6, 0.1, "ember");
      box(0, -0.35, 0.8, 0.3, 0.55, 0.45, "stone");
      ellipse(0, -0.35, 0.25, 0.25, 0.8, 0.2, "stone");
      disc(0.4, 0.3, 0.2, 0.3, 0.3, 0.2, "leather");
      break;
    case "questBoard":
      for (const sx of [-1, 1]) ellipse(sx * 0.45, 0, 0.06, 0.4, 0, 1, "wood");
      box(0, 0, 0.92, 0.4, 0.4, 0.5, "wood");
      for (let i = 0; i < 6; i++) box(-0.3 + (i % 3) * 0.3, 0.22, 0.2, 0.03, 0.48 + Math.floor(i / 3) * 0.2, 0.15, "paper");
      box(0, 0, 1, 0.5, 0.9, 0.08, "woodDark");
      break;
    case "spikeTrap":
      box(0, 0, 1, 1, 0, 0.15, "darkSteel");
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) ellipse(-0.36 + i * 0.18, -0.36 + j * 0.18, 0.08, 0.08, 0.15, 0.85, "metal", 0.05);
      break;
    case "wallTorch":
      box(0, -0.35, 0.5, 0.3, 0.68, 0.12, "iron");
      turned(0, 0.05, 0.2, 0.6, 0.72, 0.12, "wood", 0);
      ellipse(0, 0.2, 0.5, 0.5, 0.8, 0.12, "iron");
      ellipse(0, 0.2, 0.45, 0.45, 0.86, 0.14, "flame", 0.2);
      ellipse(0, 0.2, 0.25, 0.25, 0.88, 0.12, "flameCore", 0.2);
      break;
    case "hay":
      box(0, 0, 1, 1, 0, 0.75, "hay", 0.1);
      for (const x of [-0.3, 0.3]) box(x, 0, 0.04, 1.0, 0, 0.76, "rope");
      ellipse(0.1, 0.1, 0.5, 0.5, 0.75, 0.25, "hay", 0.4);
      break;

    // ---- 天井に付ける物。高さ（260cm）がちょうど天井で、上の端が天井に付く ----
    case "chandelier": {
      // シャンデリア: 天井の台座から竿を下ろし、金の胴から6本の腕。腕の先に受け皿・ろうそく・明かり、腕の間にガラスの飾り
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + Math.PI / 6;
        sphere(Math.cos(a) * 0.27, Math.sin(a) * 0.27, 0.06, 0.06, 0.64, 0.07, "glass");
      }
      sphere(0, 0, 0.09, 0.09, 0.6, 0.08, "gold");
      sphere(0, 0, 0.22, 0.22, 0.66, 0.12, "gold");
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        cm("box", Math.cos(a) * w * 0.21, Math.sin(a) * d * 0.21, w * 0.34, 4, height * 0.72, height * 0.025, "gold", { angle: a });
        ellipse(Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.1, 0.1, 0.735, 0.02, "gold");
        ellipse(Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.04, 0.04, 0.755, 0.05, "paperWhite");
        sphere(Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.05, 0.05, 0.805, 0.03, "light");
      }
      ellipse(0, 0, 0.035, 0.035, 0.78, 0.2, "gold");
      ellipse(0, 0, 0.16, 0.16, 0.975, 0.025, "gold");
      break;
    }
    case "pendantLight":
      // ペンダントライト: 電球、上がすぼまった笠、コード、天井の台
      sphere(0, 0, 0.3, 0.3, 0.64, 0.045, "light");
      ellipse(0, 0, 1, 1, 0.66, 0.1, "dark", 0.3);
      ellipse(0, 0, 0.04, 0.04, 0.76, 0.22, "black");
      ellipse(0, 0, 0.25, 0.25, 0.98, 0.02, "dark");
      break;
    case "ceilingLight":
      // シーリングライト: 光る丸いカバーと、白い本体
      ellipse(0, 0, 0.9, 0.9, 0.955, 0.012, "light");
      ellipse(0, 0, 1, 1, 0.965, 0.035, "enamel");
      break;
    case "ceilingFan": {
      // シーリングファン: 4枚の羽根、モーター、下の明かり、竿と天井の台
      sphere(0, 0, 0.12, 0.12, 0.775, 0.045, "light");
      ellipse(0, 0, 0.16, 0.16, 0.81, 0.05, "dark");
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        cm("box", Math.cos(a) * w * 0.28, Math.sin(a) * d * 0.28, w * 0.42, d * 0.11, height * 0.83, height * 0.008, "wood", { angle: a });
      }
      ellipse(0, 0, 0.025, 0.025, 0.86, 0.11, "dark");
      ellipse(0, 0, 0.08, 0.08, 0.97, 0.03, "dark");
      break;
    }
    case "downlight":
      // ダウンライト: 天井に埋めた、光る丸と白い縁
      ellipse(0, 0, 0.7, 0.7, 0.98, 0.012, "light");
      ring(0, 0, 1, 1, 0.985, 0.015, "enamel", 0.7);
      break;
    case "spotlightRail":
      // スポットライト: 天井のレールに、下を照らす3つの灯具
      for (const x of [-0.33, 0, 0.33]) {
        ellipse(x, 0, 0.06, 0.6, 0.855, 0.012, "light");
        ellipse(x, 0, 0.08, 0.8, 0.86, 0.065, "dark");
        box(x, 0, 0.025, 0.3, 0.925, 0.05, "dark");
      }
      box(0, 0, 1, 0.35, 0.975, 0.025, "dark");
      break;
    case "bareBulb":
      // 裸電球: コードの先に、ソケットと光る電球
      sphere(0, 0, 0.75, 0.75, 0.705, 0.045, "light");
      ellipse(0, 0, 0.45, 0.45, 0.745, 0.055, "black");
      ellipse(0, 0, 0.12, 0.12, 0.8, 0.2, "black");
      break;
    case "mirrorBall":
      // ミラーボール: 鏡を貼った玉と、竿・天井の台
      sphere(0, 0, 1, 1, 0.7, 0.15, "metal");
      ellipse(0, 0, 0.04, 0.04, 0.85, 0.13, "metal");
      ellipse(0, 0, 0.2, 0.2, 0.98, 0.02, "metal");
      break;
    case "hangingPlant":
      // 吊り鉢: 鉢のふちから垂れ下がるつる、ふちを囲む葉、上が広い鉢、吊りひもと天井のフック
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5 + 0.3;
        ellipse(Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0.07, 0.07, 0.46 + (i % 2) * 0.06, 0.26 - (i % 2) * 0.06, "leaf");
      }
      for (let i = 0; i < 7; i++) {
        const a = (i * Math.PI * 2) / 7;
        sphere(Math.cos(a) * 0.33, Math.sin(a) * 0.33, 0.3, 0.3, 0.7, 0.09, "leaf");
      }
      ellipse(0, 0, 0.5, 0.5, 0.68, 0.12, "ceramic", 1.3);
      ellipse(0, 0, 0.42, 0.42, 0.8, 0.012, "leaf");
      ellipse(0, 0, 0.03, 0.03, 0.81, 0.175, "rope");
      ellipse(0, 0, 0.1, 0.1, 0.985, 0.015, "metal");
      break;
    case "ceilingProjector":
      // 天井のプロジェクター: 吊り金具の下に本体、前（手前）にレンズ
      box(0, 0, 1, 0.85, 0.82, 0.08, "enamel", 0.2);
      cm("disc", 0, d * 0.42, 3, w * 0.3, height * 0.835, height * 0.05, "black", { angle: Math.PI / 2 });
      ellipse(0, 0, 0.08, 0.09, 0.9, 0.085, "dark");
      box(0, 0, 0.4, 0.4, 0.985, 0.015, "dark");
      break;
    case "ceilingAc":
      // 天井埋め込みエアコン: 四角い化粧板、真ん中の吸い込み口、四方の吹き出し口
      for (const s of [-1, 1]) {
        box(0, s * 0.38, 0.6, 0.06, 0.962, 0.006, "dark");
        box(s * 0.38, 0, 0.06, 0.6, 0.962, 0.006, "dark");
      }
      box(0, 0, 0.45, 0.45, 0.964, 0.008, "grille");
      box(0, 0, 1, 1, 0.97, 0.03, "enamel", 0.05);
      break;
    case "smokeDetector":
      // 火災報知器: 丸い本体と、赤い表示灯
      ellipse(0.25, 0, 0.08, 0.08, 0.966, 0.006, "redLamp");
      ellipse(0, 0, 0.45, 0.45, 0.965, 0.012, "enamel");
      ellipse(0, 0, 1, 1, 0.975, 0.025, "enamel");
      break;
    case "sprinkler":
      // スプリンクラー: 天井の座金と、下向きの頭と散水板
      ellipse(0, 0, 0.8, 0.8, 0.963, 0.006, "metal");
      ellipse(0, 0, 0.35, 0.35, 0.968, 0.025, "metal");
      ellipse(0, 0, 1, 1, 0.993, 0.007, "metal");
      break;
  }
}
