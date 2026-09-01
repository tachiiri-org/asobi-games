// ペットの型。
//
// 元は1枚の HTML に入っていた素のオブジェクト。front は strict なので、まず
// 「何が入っている表なのか」をここに書き、データの節はその形に合わせて置く。
// キーの取りこぼしを避けるため、型は実データを数えて起こした（省略できる欄は ? を付けてある）。

/** 進化さきの見た目。耳と付けものは絵の描き分けに使う。 */
export type Species = {
  readonly name: string;
  readonly body: string;
  readonly accent: string;
  readonly ear: string;
  readonly acc: string;
};

/** ごはん。emoji はあとから足したものだけが持つ。 */
export type Food = {
  readonly label: string;
  readonly emoji?: string;
  readonly cost: number;
  readonly hunger: number;
  readonly happy: number;
  readonly exp: number;
  readonly eat: number;
};

/**
 * かった ものが あると できる こと。
 * 増減の欄は元のコードの略称のまま置く（読み替えを1か所に増やさない）。
 *   e:げんきを つかう / hu:おなかが へる / h:きげん / x:けいけんち
 *   c:コイン / eg:げんきが ふえる / hg:おなかが ふえる / cl:きれいが へる
 *   cg:きれいが ふえる / hp:たいりょく / pw:ちから
 */
export type Activity = {
  readonly id: string;
  /** 要るもの。free のものは持っていなくてもできる。 */
  readonly item?: string;
  readonly free?: boolean;
  readonly emoji: string;
  readonly label: string;
  readonly room: string;
  readonly e: number;
  readonly hu: number;
  readonly h: number;
  readonly x: number;
  readonly c?: number;
  readonly eg?: number;
  readonly hg?: number;
  readonly cl?: number;
  readonly cg?: number;
  readonly hp?: number;
  readonly pw?: number;
  readonly night?: boolean;
  readonly fee?: number;
  readonly cure?: boolean;
  readonly luck?: boolean;
};

/** おしごと。flat を持つものは、ちからとレベルに関わらず決まった額を払う。 */
export type Job = {
  readonly id: string;
  readonly label: string;
  readonly energy: number;
  readonly hunger: number;
  readonly happy: number;
  readonly minPower: number;
  readonly minLevel: number;
  readonly base: number;
  readonly perPower: number;
  readonly perLevel: number;
  /** けたが大きすぎて number に入らないので文字列で持つ。 */
  readonly flat?: string;
};

/** ショップの品。deco を持つものは、へやに並べて飾れる。 */
export type ShopItem = {
  readonly id: string;
  readonly cat: string;
  readonly label: string;
  readonly cost: number;
  readonly note: string;
  readonly deco?: string;
};

/** もようがえの色。昼と夜で持つ。 */
export type StyleColor = { readonly day: string; readonly night: string };

/** ともだち。spots はその子が現れる場所。 */
export type Friend = {
  readonly id: string;
  readonly name: string;
  readonly col: string;
  readonly dark: string;
  readonly belly: string;
  readonly ear: string;
  readonly mark: string;
  readonly seed: number;
  readonly likes: string;
  readonly spots: readonly string[];
};

/** おでかけ先。 */
export type Place = {
  readonly v: string;
  readonly icon: string;
  readonly name: string;
  readonly note: string;
};

/** ふしぎショップの効きめ。 */
export type InfEffect = { readonly key: string; readonly note: string };

/** 品の見ためと名前のもと。 */
export type KindEntry = { readonly n: string; readonly e: string };

/**
 * おみせビルの1かい。
 * exp は「そのかいに何こあるか」を 10 の何乗で表したもの。桁が大きすぎて数では持てない。
 */
export type MoreShop = {
  readonly id: string;
  readonly tab: string;
  readonly exp: number;
  readonly note: string;
  readonly mat: readonly string[];
  readonly kind: readonly KindEntry[];
};

/** たてもの。かいの束を持つ。 */
export type MoreBuilding = {
  readonly id: string;
  readonly tab: string;
  readonly title: string;
  readonly floors: readonly MoreShop[];
};

/** かざる場所の高さ（画布の割合）。 */
export type DecorZone = { readonly wallY: number; readonly floorY: number };
