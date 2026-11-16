// せかいの まち の型。
//
// ここに置くのは「データの形」だけ。絵の描き方（draw.ts）と、遊びの進み方（index.ts）は
// この形を読むだけにしてある。まちを足すのが データ1行で済むように、たてものの絵は
// 形（shape）の名前で指して、1つずつ描き分けない。

/** たてものの 絵の かたち。絵は shape ごとに1つだけ持ち、色と目じるしで描き分ける。 */
export type Shape =
  | 'box'      // ふつうの たてもの（まどが つく）
  | 'tower'    // ほそくて たかい（とう）
  | 'dome'     // まるい やね
  | 'pyramid'  // さんかく
  | 'tent'     // テント
  | 'flat'     // ひくくて よこに ながい（ひろば・はし・すなはま）
  | 'tree'     // き
  | 'wall';    // よこに ながい かべ（ちょうじょう）

export type Building = {
  readonly id: string;
  readonly label: string;
  readonly cost: number;
  /** そのまちに すめる 人の かず。これを 足したものが「じんこう」。 */
  readonly pop: number;
  /** 10びょうに はいる コイン。 */
  readonly coin: number;
  readonly shape: Shape;
  readonly body: string;
  readonly roof: string;
  /** 目じるしの 絵文字。名所は これで 見わける。 */
  readonly mark?: string;
  /**
   * そのまちだけに 建てられる もの（名所）。
   * 省いたものは どのまちにも 建てられる。
   */
  readonly city?: string;
  readonly note: string;
};

export type City = {
  readonly id: string;
  readonly name: string;
  readonly country: string;
  /** せかいの じんこうが これに とどくと ひらく。とうきょうは 0（はじめから ひらいている）。 */
  readonly needPop: number;
  /** 空の色（うえ・した）。 */
  readonly sky: readonly [string, string];
  /** じめんの 色と、ごばんの もう1色。 */
  readonly ground: string;
  readonly ground2: string;
  /** そのまちの あいさつ。まちに 入ったときに 出す。 */
  readonly hello: string;
  /** 地図の ばしょ（けいど・いど）。 */
  readonly lon: number;
  readonly lat: number;
  /**
   * 地図で 名前を 点の 下に 出すか。
   *
   * ヨーロッパから アジアに かけては まちが こんでいて、ぜんぶ 同じ 側に 出すと
   * 名前が かさなって 読めない。どちらに 出すかは まちごとに ここで 決める。
   */
  readonly labelDown?: boolean;
};

/** 自分で かいた キャラ。dots は 16×16 の 点の 色。 */
export type Person = {
  readonly id: string;
  name: string;
  /** 16×16=256もじ。1もじが 1つの 点（'.' は すけて見える）。 */
  dots: string;
  /** すんでいる まち。まだ どこにも いなければ null。 */
  city: string | null;
  /** もっている どうぐ。事件の ときの ちからに なる。 */
  weapon?: string | null;
};

/** 事件の たね。good は たたかわない（いいこと が おきる）。 */
export type EventKind = 'fire' | 'thief' | 'monster' | 'storm' | 'good';

export type TownEvent = {
  readonly id: string;
  readonly label: string;
  readonly emoji: string;
  readonly kind: EventKind;
  /** これだけ ちからが あれば らくに かてる。good では つかわない。 */
  readonly need: number;
  /** かったとき（good なら おきたとき）に もらえる コイン。 */
  readonly prize: number;
  /** まけたときに なくす コイン。 */
  readonly damage: number;
  /** まけると たてものが 1つ こわれるか。 */
  readonly breaks: boolean;
  readonly warn: string;
  readonly win: string;
  readonly lose: string;
};

/** ぶきやの しなもの。kind が 合う 事件に よく きく。 */
export type Weapon = {
  readonly id: string;
  readonly label: string;
  readonly emoji: string;
  readonly cost: number;
  /** 'all' は どの 事件にも 同じだけ きく。 */
  readonly kind: EventKind | 'all';
  readonly power: number;
  readonly note: string;
};

/** まちの レポート。じぶんで 書く。 */
export type Report = {
  readonly id: string;
  title: string;
  body: string;
  /** 書いた とき。 */
  at: number;
  /** その ときの せかいの じんこう。あとで 読みかえす ときの めじるし。 */
  pop: number;
};

/** できごとの ひかえ。レポートを 書く ときの 下じきに する。 */
export type LogEntry = { at: number; text: string };

export type MachiState = {
  version: number;
  coins: number;
  /** いま 見ている まち。 */
  here: string;
  /** まちごとの ごばん。1マスに たてものの id が 入る（なければ null）。 */
  tiles: Record<string, (string | null)[]>;
  /** ひらいた まち。 */
  opened: string[];
  /** ぶきやで かった どうぐ。id → かず。 */
  weapons: Record<string, number>;
  /** BGMを 鳴らすか。端末では なく その子の 持ちものなので、保存に のこす。 */
  music: boolean;
  /** さいきんの できごと。新しいものが さき。30件まで。 */
  log: LogEntry[];
  stats: { built: number; drawn: number; maxPop: number; won: number; lost: number };
};

/** キャラは べつの 置き場に 置く（かいた ときだけ 変わるので、毎秒の 保存に のせない）。 */
export type PeopleSave = {
  version: number;
  people: Person[];
};

/** レポートも べつの 置き場。長い 文が 入るので、毎秒の 保存に のせない。 */
export type ReportSave = {
  version: number;
  reports: Report[];
};
