// ポケモン ダメージけいさん（ファイアレッド／第3世代）。
//
// あそびばの中では めずらしく「どうぐ」で、遊んで点を出すものではない。だから
// onFinish は 一度も 呼ばない（表の ranking は 'none'）。ランキングに ならばない
// かわりに、ログインも 保存も 要らない。
//
// 合わせる先は 第3世代の 5本（ルビー・サファイア・エメラルド・ファイアレッド・
// リーフグリーン）。この 5本は 式も タイプ相性も しゅぞくちも わざの いりょくも
// 同じ なので、1つの どうぐで よい。ちがうのは、どこで 何が つかまるかだけ——
// ミュウは ファイアレッドでは つかまらないが、計算の しかたは 変わらない。
//
// いまの作品とは 計算の しかたが ちがうので、そこを まぜると どちらでも 合わない数が
// 出る。ちがいは4つ。
//  - フェアリータイプが まだ 無い。ピッピも プリンも ノーマル。
//  - 物理か 特殊かは、わざ1つずつ ではなく タイプで 決まる。ゴーストは 物理なので
//    シャドーボールは 物理、ドラゴンは 特殊なので げきりんは 特殊。
//  - きゅうしょは ×2（いまは ×1.5）。
//  - はがねが ゴーストと あくを 半減する。
// 種族値も 当時のもの。ピカチュウの ぼうぎょは 30（いまは 40）など、第6世代以降で
// 上がった ぶんは 入れて いない。
//
// 一覧に 無いものは 自分で 書ける。全国図鑑の 386匹の 外（思いついた すうじや、
// 名前だけ 知って いる わざ）を 試すのに、一覧を 太らせずに 済ませるため。
//
// 決めごと。
//  - 外から CSS も 絵も 取らない。ポケモンは 名前と すうじ だけで あらわす。
//  - 第3世代の 計算順。もとの数 → てんき → やけど → ＋2 → きゅうしょ → らんすう →
//    タイプ一致 → タイプ相性。＋2 が てんきの あとに 来るのと、きゅうしょが ＋2 の
//    あとに 来るのが、いまの作品との ちがい。
//  - もちものは、ダメージに きく ものだけ 持つ（タイプを つよくする 17個と、
//    のうりょくに かかる 7個）。えらべるのに 数が 動かない ものを ならべると、
//    きいて いないのか 書きまちがえたのかが 分からなくなる。
//  - とくせい・リフレクター・きゅうしょが ランクを 無視する ところは 持たない。

import type { GameMount } from './types';

// ── タイプ ────────────────────────────────────────────────────────────

/** 第3世代の 17タイプ。フェアリーは まだ 無い。 */
type TypeKey =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice'
  | 'fight' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug'
  | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel';

const TYPE_NAME: Record<TypeKey, string> = {
  normal: 'ノーマル', fire: 'ほのお', water: 'みず', electric: 'でんき',
  grass: 'くさ', ice: 'こおり', fight: 'かくとう', poison: 'どく',
  ground: 'じめん', flying: 'ひこう', psychic: 'エスパー', bug: 'むし',
  rock: 'いわ', ghost: 'ゴースト', dragon: 'ドラゴン', dark: 'あく', steel: 'はがね',
};

const TYPE_ORDER: readonly TypeKey[] = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fight', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel',
];

const TYPE_COLOR: Record<TypeKey, string> = {
  normal: '#9ca3af', fire: '#ef4444', water: '#3b82f6', electric: '#eab308',
  grass: '#22c55e', ice: '#38bdf8', fight: '#b91c1c', poison: '#a855f7',
  ground: '#b45309', flying: '#60a5fa', psychic: '#ec4899', bug: '#84cc16',
  rock: '#a16207', ghost: '#7c3aed', dragon: '#4f46e5', dark: '#475569', steel: '#64748b',
};

/**
 * 第3世代では、物理か 特殊かが わざ1つずつ ではなく タイプで 決まる。
 *
 * だから シャドーボール（ゴースト）は 物理で、ふぶき（こおり）は 特殊。
 * 第4世代で わざごとに 変わったので、いまの作品の 感覚で 選ぶと 逆になる。
 */
const PHYSICAL_TYPES: ReadonlySet<TypeKey> = new Set<TypeKey>([
  'normal', 'fight', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel',
]);

const isPhysical = (type: TypeKey): boolean => PHYSICAL_TYPES.has(type);

/**
 * わざの タイプが、受ける タイプに どれだけ 効くか。第3世代の 表。
 *
 * 書いて ない ところは 1倍。はがねが ゴーストと あくを 半減するのは この世代まで。
 */
const CHART: Record<TypeKey, Partial<Record<TypeKey, number>>> = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: {
    fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5,
    bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5,
  },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fight: {
    normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5,
    rock: 2, ghost: 0, dark: 2, steel: 2,
  },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fight: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fight: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fight: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5 },
  rock: { fire: 2, ice: 2, fight: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5, steel: 0.5 },
  dragon: { dragon: 2, steel: 0.5 },
  dark: { fight: 0.5, psychic: 2, ghost: 2, dark: 0.5, steel: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5 },
};

/** 1つずつ かけて、そのつど きりすてる（第3世代の やりかた）。 */
const typeSteps = (move: TypeKey, defender: readonly TypeKey[]): readonly number[] =>
  defender.map((t) => CHART[move][t] ?? 1);

const effectiveness = (move: TypeKey, defender: readonly TypeKey[]): number =>
  typeSteps(move, defender).reduce((a, b) => a * b, 1);

// ── ポケモン ──────────────────────────────────────────────────────────

/** base は しゅぞくち。HP・こうげき・ぼうぎょ・とくこう・とくぼう の順（すばやさは 使わない）。 */
type Mon = {
  readonly no: number;
  readonly name: string;
  readonly types: readonly TypeKey[];
  readonly base: readonly [number, number, number, number, number];
  /** kg。けたぐりの いりょくが これで 決まる。 */
  readonly weight: number;
  /** その子が もちうる とくせい。第3世代は 1つか 2つ。 */
  readonly abilities: readonly string[];
};

/**
 * 全国図鑑の 386匹。しゅぞくちも タイプも 第3世代のもの。
 *
 * いまの作品とは ちがう ところが ある。フェアリーが まだ 無いので、ピッピも プリンも
 * マリルリも ノーマル・みず の ままだし、しゅぞくちも 第6世代 以降で 上がった ぶんは
 * 入って いない（ピカチュウの ぼうぎょ30、ニドキングの こうげき92 など）。
 *
 * すばやさは この どうぐでは 使わないので 持たない。
 */
const MONS: readonly Mon[] = [
  { no: 1, name: 'フシギダネ', types: ['grass', 'poison'], base: [45, 49, 49, 65, 65], weight: 6.9, abilities: ['しんりょく'] },
  { no: 2, name: 'フシギソウ', types: ['grass', 'poison'], base: [60, 62, 63, 80, 80], weight: 13, abilities: ['しんりょく'] },
  { no: 3, name: 'フシギバナ', types: ['grass', 'poison'], base: [80, 82, 83, 100, 100], weight: 100, abilities: ['しんりょく'] },
  { no: 4, name: 'ヒトカゲ', types: ['fire'], base: [39, 52, 43, 60, 50], weight: 8.5, abilities: ['もうか'] },
  { no: 5, name: 'リザード', types: ['fire'], base: [58, 64, 58, 80, 65], weight: 19, abilities: ['もうか'] },
  { no: 6, name: 'リザードン', types: ['fire', 'flying'], base: [78, 84, 78, 109, 85], weight: 90.5, abilities: ['もうか'] },
  { no: 7, name: 'ゼニガメ', types: ['water'], base: [44, 48, 65, 50, 64], weight: 9, abilities: ['げきりゅう'] },
  { no: 8, name: 'カメール', types: ['water'], base: [59, 63, 80, 65, 80], weight: 22.5, abilities: ['げきりゅう'] },
  { no: 9, name: 'カメックス', types: ['water'], base: [79, 83, 100, 85, 105], weight: 85.5, abilities: ['げきりゅう'] },
  { no: 10, name: 'キャタピー', types: ['bug'], base: [45, 30, 35, 20, 20], weight: 2.9, abilities: ['りんぷん'] },
  { no: 11, name: 'トランセル', types: ['bug'], base: [50, 20, 55, 25, 25], weight: 9.9, abilities: ['だっぴ'] },
  { no: 12, name: 'バタフリー', types: ['bug', 'flying'], base: [60, 45, 50, 80, 80], weight: 32, abilities: ['ふくがん'] },
  { no: 13, name: 'ビードル', types: ['bug', 'poison'], base: [40, 35, 30, 20, 20], weight: 3.2, abilities: ['りんぷん'] },
  { no: 14, name: 'コクーン', types: ['bug', 'poison'], base: [45, 25, 50, 25, 25], weight: 10, abilities: ['だっぴ'] },
  { no: 15, name: 'スピアー', types: ['bug', 'poison'], base: [65, 80, 40, 45, 80], weight: 29.5, abilities: ['むしのしらせ'] },
  { no: 16, name: 'ポッポ', types: ['normal', 'flying'], base: [40, 45, 40, 35, 35], weight: 1.8, abilities: ['するどいめ'] },
  { no: 17, name: 'ピジョン', types: ['normal', 'flying'], base: [63, 60, 55, 50, 50], weight: 30, abilities: ['するどいめ'] },
  { no: 18, name: 'ピジョット', types: ['normal', 'flying'], base: [83, 80, 75, 70, 70], weight: 39.5, abilities: ['するどいめ'] },
  { no: 19, name: 'コラッタ', types: ['normal'], base: [30, 56, 35, 25, 35], weight: 3.5, abilities: ['にげあし', 'こんじょう'] },
  { no: 20, name: 'ラッタ', types: ['normal'], base: [55, 81, 60, 50, 70], weight: 18.5, abilities: ['にげあし', 'こんじょう'] },
  { no: 21, name: 'オニスズメ', types: ['normal', 'flying'], base: [40, 60, 30, 31, 31], weight: 2, abilities: ['するどいめ'] },
  { no: 22, name: 'オニドリル', types: ['normal', 'flying'], base: [65, 90, 65, 61, 61], weight: 38, abilities: ['するどいめ'] },
  { no: 23, name: 'アーボ', types: ['poison'], base: [35, 60, 44, 40, 54], weight: 6.9, abilities: ['いかく', 'だっぴ'] },
  { no: 24, name: 'アーボック', types: ['poison'], base: [60, 85, 69, 65, 79], weight: 65, abilities: ['いかく', 'だっぴ'] },
  { no: 25, name: 'ピカチュウ', types: ['electric'], base: [35, 55, 30, 50, 40], weight: 6, abilities: ['せいでんき'] },
  { no: 26, name: 'ライチュウ', types: ['electric'], base: [60, 90, 55, 90, 80], weight: 30, abilities: ['せいでんき'] },
  { no: 27, name: 'サンド', types: ['ground'], base: [50, 75, 85, 20, 30], weight: 12, abilities: ['すながくれ'] },
  { no: 28, name: 'サンドパン', types: ['ground'], base: [75, 100, 110, 45, 55], weight: 29.5, abilities: ['すながくれ'] },
  { no: 29, name: 'ニドラン♀', types: ['poison'], base: [55, 47, 52, 40, 40], weight: 7, abilities: ['どくのトゲ'] },
  { no: 30, name: 'ニドリーナ', types: ['poison'], base: [70, 62, 67, 55, 55], weight: 20, abilities: ['どくのトゲ'] },
  { no: 31, name: 'ニドクイン', types: ['poison', 'ground'], base: [90, 82, 87, 75, 85], weight: 60, abilities: ['どくのトゲ'] },
  { no: 32, name: 'ニドラン♂', types: ['poison'], base: [46, 57, 40, 40, 40], weight: 9, abilities: ['どくのトゲ'] },
  { no: 33, name: 'ニドリーノ', types: ['poison'], base: [61, 72, 57, 55, 55], weight: 19.5, abilities: ['どくのトゲ'] },
  { no: 34, name: 'ニドキング', types: ['poison', 'ground'], base: [81, 92, 77, 85, 75], weight: 62, abilities: ['どくのトゲ'] },
  { no: 35, name: 'ピッピ', types: ['normal'], base: [70, 45, 48, 60, 65], weight: 7.5, abilities: ['メロメロボディ'] },
  { no: 36, name: 'ピクシー', types: ['normal'], base: [95, 70, 73, 85, 90], weight: 40, abilities: ['メロメロボディ'] },
  { no: 37, name: 'ロコン', types: ['fire'], base: [38, 41, 40, 50, 65], weight: 9.9, abilities: ['もらいび'] },
  { no: 38, name: 'キュウコン', types: ['fire'], base: [73, 76, 75, 81, 100], weight: 19.9, abilities: ['もらいび'] },
  { no: 39, name: 'プリン', types: ['normal'], base: [115, 45, 20, 45, 25], weight: 5.5, abilities: ['メロメロボディ'] },
  { no: 40, name: 'プクリン', types: ['normal'], base: [140, 70, 45, 75, 50], weight: 12, abilities: ['メロメロボディ'] },
  { no: 41, name: 'ズバット', types: ['poison', 'flying'], base: [40, 45, 35, 30, 40], weight: 7.5, abilities: ['せいしんりょく'] },
  { no: 42, name: 'ゴルバット', types: ['poison', 'flying'], base: [75, 80, 70, 65, 75], weight: 55, abilities: ['せいしんりょく'] },
  { no: 43, name: 'ナゾノクサ', types: ['grass', 'poison'], base: [45, 50, 55, 75, 65], weight: 5.4, abilities: ['ようりょくそ'] },
  { no: 44, name: 'クサイハナ', types: ['grass', 'poison'], base: [60, 65, 70, 85, 75], weight: 8.6, abilities: ['ようりょくそ'] },
  { no: 45, name: 'ラフレシア', types: ['grass', 'poison'], base: [75, 80, 85, 100, 90], weight: 18.6, abilities: ['ようりょくそ'] },
  { no: 46, name: 'パラス', types: ['bug', 'grass'], base: [35, 70, 55, 45, 55], weight: 5.4, abilities: ['ほうし'] },
  { no: 47, name: 'パラセクト', types: ['bug', 'grass'], base: [60, 95, 80, 60, 80], weight: 29.5, abilities: ['ほうし'] },
  { no: 48, name: 'コンパン', types: ['bug', 'poison'], base: [60, 55, 50, 40, 55], weight: 30, abilities: ['ふくがん'] },
  { no: 49, name: 'モルフォン', types: ['bug', 'poison'], base: [70, 65, 60, 90, 75], weight: 12.5, abilities: ['りんぷん'] },
  { no: 50, name: 'ディグダ', types: ['ground'], base: [10, 55, 25, 35, 45], weight: 0.8, abilities: ['すながくれ', 'ありじごく'] },
  { no: 51, name: 'ダグトリオ', types: ['ground'], base: [35, 80, 50, 50, 70], weight: 33.3, abilities: ['すながくれ', 'ありじごく'] },
  { no: 52, name: 'ニャース', types: ['normal'], base: [40, 45, 35, 40, 40], weight: 4.2, abilities: ['ものひろい'] },
  { no: 53, name: 'ペルシアン', types: ['normal'], base: [65, 70, 60, 65, 65], weight: 32, abilities: ['じゅうなん'] },
  { no: 54, name: 'コダック', types: ['water'], base: [50, 52, 48, 65, 50], weight: 19.6, abilities: ['しめりけ', 'ノーてんき'] },
  { no: 55, name: 'ゴルダック', types: ['water'], base: [80, 82, 78, 95, 80], weight: 76.6, abilities: ['しめりけ', 'ノーてんき'] },
  { no: 56, name: 'マンキー', types: ['fight'], base: [40, 80, 35, 35, 45], weight: 28, abilities: ['やるき'] },
  { no: 57, name: 'オコリザル', types: ['fight'], base: [65, 105, 60, 60, 70], weight: 32, abilities: ['やるき'] },
  { no: 58, name: 'ガーディ', types: ['fire'], base: [55, 70, 45, 70, 50], weight: 19, abilities: ['いかく', 'もらいび'] },
  { no: 59, name: 'ウインディ', types: ['fire'], base: [90, 110, 80, 100, 80], weight: 155, abilities: ['いかく', 'もらいび'] },
  { no: 60, name: 'ニョロモ', types: ['water'], base: [40, 50, 40, 40, 40], weight: 12.4, abilities: ['ちょすい', 'しめりけ'] },
  { no: 61, name: 'ニョロゾ', types: ['water'], base: [65, 65, 65, 50, 50], weight: 20, abilities: ['ちょすい', 'しめりけ'] },
  { no: 62, name: 'ニョロボン', types: ['water', 'fight'], base: [90, 85, 95, 70, 90], weight: 54, abilities: ['ちょすい', 'しめりけ'] },
  { no: 63, name: 'ケーシィ', types: ['psychic'], base: [25, 20, 15, 105, 55], weight: 19.5, abilities: ['シンクロ', 'せいしんりょく'] },
  { no: 64, name: 'ユンゲラー', types: ['psychic'], base: [40, 35, 30, 120, 70], weight: 56.5, abilities: ['シンクロ', 'せいしんりょく'] },
  { no: 65, name: 'フーディン', types: ['psychic'], base: [55, 50, 45, 135, 85], weight: 48, abilities: ['シンクロ', 'せいしんりょく'] },
  { no: 66, name: 'ワンリキー', types: ['fight'], base: [70, 80, 50, 35, 35], weight: 19.5, abilities: ['こんじょう'] },
  { no: 67, name: 'ゴーリキー', types: ['fight'], base: [80, 100, 70, 50, 60], weight: 70.5, abilities: ['こんじょう'] },
  { no: 68, name: 'カイリキー', types: ['fight'], base: [90, 130, 80, 65, 85], weight: 130, abilities: ['こんじょう'] },
  { no: 69, name: 'マダツボミ', types: ['grass', 'poison'], base: [50, 75, 35, 70, 30], weight: 4, abilities: ['ようりょくそ'] },
  { no: 70, name: 'ウツドン', types: ['grass', 'poison'], base: [65, 90, 50, 85, 45], weight: 6.4, abilities: ['ようりょくそ'] },
  { no: 71, name: 'ウツボット', types: ['grass', 'poison'], base: [80, 105, 65, 100, 60], weight: 15.5, abilities: ['ようりょくそ'] },
  { no: 72, name: 'メノクラゲ', types: ['water', 'poison'], base: [40, 40, 35, 50, 100], weight: 45.5, abilities: ['クリアボディ', 'ヘドロえき'] },
  { no: 73, name: 'ドククラゲ', types: ['water', 'poison'], base: [80, 70, 65, 80, 120], weight: 55, abilities: ['クリアボディ', 'ヘドロえき'] },
  { no: 74, name: 'イシツブテ', types: ['rock', 'ground'], base: [40, 80, 100, 30, 30], weight: 20, abilities: ['いしあたま', 'がんじょう'] },
  { no: 75, name: 'ゴローン', types: ['rock', 'ground'], base: [55, 95, 115, 45, 45], weight: 105, abilities: ['いしあたま', 'がんじょう'] },
  { no: 76, name: 'ゴローニャ', types: ['rock', 'ground'], base: [80, 110, 130, 55, 65], weight: 300, abilities: ['いしあたま', 'がんじょう'] },
  { no: 77, name: 'ポニータ', types: ['fire'], base: [50, 85, 55, 65, 65], weight: 30, abilities: ['にげあし', 'もらいび'] },
  { no: 78, name: 'ギャロップ', types: ['fire'], base: [65, 100, 70, 80, 80], weight: 95, abilities: ['にげあし', 'もらいび'] },
  { no: 79, name: 'ヤドン', types: ['water', 'psychic'], base: [90, 65, 65, 40, 40], weight: 36, abilities: ['どんかん', 'マイペース'] },
  { no: 80, name: 'ヤドラン', types: ['water', 'psychic'], base: [95, 75, 110, 100, 80], weight: 78.5, abilities: ['どんかん', 'マイペース'] },
  { no: 81, name: 'コイル', types: ['electric', 'steel'], base: [25, 35, 70, 95, 55], weight: 6, abilities: ['じりょく', 'がんじょう'] },
  { no: 82, name: 'レアコイル', types: ['electric', 'steel'], base: [50, 60, 95, 120, 70], weight: 60, abilities: ['じりょく', 'がんじょう'] },
  { no: 83, name: 'カモネギ', types: ['normal', 'flying'], base: [52, 65, 55, 58, 62], weight: 15, abilities: ['するどいめ', 'せいしんりょく'] },
  { no: 84, name: 'ドードー', types: ['normal', 'flying'], base: [35, 85, 45, 35, 35], weight: 39.2, abilities: ['にげあし', 'はやおき'] },
  { no: 85, name: 'ドードリオ', types: ['normal', 'flying'], base: [60, 110, 70, 60, 60], weight: 85.2, abilities: ['にげあし', 'はやおき'] },
  { no: 86, name: 'パウワウ', types: ['water'], base: [65, 45, 55, 45, 70], weight: 90, abilities: ['あついしぼう'] },
  { no: 87, name: 'ジュゴン', types: ['water', 'ice'], base: [90, 70, 80, 70, 95], weight: 120, abilities: ['あついしぼう'] },
  { no: 88, name: 'ベトベター', types: ['poison'], base: [80, 80, 50, 40, 50], weight: 30, abilities: ['あくしゅう', 'ねんちゃく'] },
  { no: 89, name: 'ベトベトン', types: ['poison'], base: [105, 105, 75, 65, 100], weight: 30, abilities: ['あくしゅう', 'ねんちゃく'] },
  { no: 90, name: 'シェルダー', types: ['water'], base: [30, 65, 100, 45, 25], weight: 4, abilities: ['シェルアーマー'] },
  { no: 91, name: 'パルシェン', types: ['water', 'ice'], base: [50, 95, 180, 85, 45], weight: 132.5, abilities: ['シェルアーマー'] },
  { no: 92, name: 'ゴース', types: ['ghost', 'poison'], base: [30, 35, 30, 100, 35], weight: 0.1, abilities: ['ふゆう'] },
  { no: 93, name: 'ゴースト', types: ['ghost', 'poison'], base: [45, 50, 45, 115, 55], weight: 0.1, abilities: ['ふゆう'] },
  { no: 94, name: 'ゲンガー', types: ['ghost', 'poison'], base: [60, 65, 60, 130, 75], weight: 40.5, abilities: ['ふゆう'] },
  { no: 95, name: 'イワーク', types: ['rock', 'ground'], base: [35, 45, 160, 30, 45], weight: 210, abilities: ['いしあたま', 'がんじょう'] },
  { no: 96, name: 'スリープ', types: ['psychic'], base: [60, 48, 45, 43, 90], weight: 32.4, abilities: ['ふみん'] },
  { no: 97, name: 'スリーパー', types: ['psychic'], base: [85, 73, 70, 73, 115], weight: 75.6, abilities: ['ふみん'] },
  { no: 98, name: 'クラブ', types: ['water'], base: [30, 105, 90, 25, 25], weight: 6.5, abilities: ['かいりきバサミ', 'シェルアーマー'] },
  { no: 99, name: 'キングラー', types: ['water'], base: [55, 130, 115, 50, 50], weight: 60, abilities: ['かいりきバサミ', 'シェルアーマー'] },
  { no: 100, name: 'ビリリダマ', types: ['electric'], base: [40, 30, 50, 55, 55], weight: 10.4, abilities: ['ぼうおん', 'せいでんき'] },
  { no: 101, name: 'マルマイン', types: ['electric'], base: [60, 50, 70, 80, 80], weight: 66.6, abilities: ['ぼうおん', 'せいでんき'] },
  { no: 102, name: 'タマタマ', types: ['grass', 'psychic'], base: [60, 40, 80, 60, 45], weight: 2.5, abilities: ['ようりょくそ'] },
  { no: 103, name: 'ナッシー', types: ['grass', 'psychic'], base: [95, 95, 85, 125, 65], weight: 120, abilities: ['ようりょくそ'] },
  { no: 104, name: 'カラカラ', types: ['ground'], base: [50, 50, 95, 40, 50], weight: 6.5, abilities: ['いしあたま', 'ひらいしん'] },
  { no: 105, name: 'ガラガラ', types: ['ground'], base: [60, 80, 110, 50, 80], weight: 45, abilities: ['いしあたま', 'ひらいしん'] },
  { no: 106, name: 'サワムラー', types: ['fight'], base: [50, 120, 53, 35, 110], weight: 49.8, abilities: ['じゅうなん'] },
  { no: 107, name: 'エビワラー', types: ['fight'], base: [50, 105, 79, 35, 110], weight: 50.2, abilities: ['するどいめ'] },
  { no: 108, name: 'ベロリンガ', types: ['normal'], base: [90, 55, 75, 60, 75], weight: 65.5, abilities: ['マイペース', 'どんかん'] },
  { no: 109, name: 'ドガース', types: ['poison'], base: [40, 65, 95, 60, 45], weight: 1, abilities: ['ふゆう'] },
  { no: 110, name: 'マタドガス', types: ['poison'], base: [65, 90, 120, 85, 70], weight: 9.5, abilities: ['ふゆう'] },
  { no: 111, name: 'サイホーン', types: ['ground', 'rock'], base: [80, 85, 95, 30, 30], weight: 115, abilities: ['ひらいしん', 'いしあたま'] },
  { no: 112, name: 'サイドン', types: ['ground', 'rock'], base: [105, 130, 120, 45, 45], weight: 120, abilities: ['ひらいしん', 'いしあたま'] },
  { no: 113, name: 'ラッキー', types: ['normal'], base: [250, 5, 5, 35, 105], weight: 34.6, abilities: ['しぜんかいふく', 'てんのめぐみ'] },
  { no: 114, name: 'モンジャラ', types: ['grass'], base: [65, 55, 115, 100, 40], weight: 35, abilities: ['ようりょくそ'] },
  { no: 115, name: 'ガルーラ', types: ['normal'], base: [105, 95, 80, 40, 80], weight: 80, abilities: ['はやおき'] },
  { no: 116, name: 'タッツー', types: ['water'], base: [30, 40, 70, 70, 25], weight: 8, abilities: ['すいすい'] },
  { no: 117, name: 'シードラ', types: ['water'], base: [55, 65, 95, 95, 45], weight: 25, abilities: ['どくのトゲ'] },
  { no: 118, name: 'トサキント', types: ['water'], base: [45, 67, 60, 35, 50], weight: 15, abilities: ['すいすい', 'みずのベール'] },
  { no: 119, name: 'アズマオウ', types: ['water'], base: [80, 92, 65, 65, 80], weight: 39, abilities: ['すいすい', 'みずのベール'] },
  { no: 120, name: 'ヒトデマン', types: ['water'], base: [30, 45, 55, 70, 55], weight: 34.5, abilities: ['はっこう', 'しぜんかいふく'] },
  { no: 121, name: 'スターミー', types: ['water', 'psychic'], base: [60, 75, 85, 100, 85], weight: 80, abilities: ['はっこう', 'しぜんかいふく'] },
  { no: 122, name: 'バリヤード', types: ['psychic'], base: [40, 45, 65, 100, 120], weight: 54.5, abilities: ['ぼうおん'] },
  { no: 123, name: 'ストライク', types: ['bug', 'flying'], base: [70, 110, 80, 55, 80], weight: 56, abilities: ['むしのしらせ'] },
  { no: 124, name: 'ルージュラ', types: ['ice', 'psychic'], base: [65, 50, 35, 115, 95], weight: 40.6, abilities: ['どんかん'] },
  { no: 125, name: 'エレブー', types: ['electric'], base: [65, 83, 57, 95, 85], weight: 30, abilities: ['せいでんき'] },
  { no: 126, name: 'ブーバー', types: ['fire'], base: [65, 95, 57, 100, 85], weight: 44.5, abilities: ['ほのおのからだ'] },
  { no: 127, name: 'カイロス', types: ['bug'], base: [65, 125, 100, 55, 70], weight: 55, abilities: ['かいりきバサミ'] },
  { no: 128, name: 'ケンタロス', types: ['normal'], base: [75, 100, 95, 40, 70], weight: 88.4, abilities: ['いかく'] },
  { no: 129, name: 'コイキング', types: ['water'], base: [20, 10, 55, 15, 20], weight: 10, abilities: ['すいすい'] },
  { no: 130, name: 'ギャラドス', types: ['water', 'flying'], base: [95, 125, 79, 60, 100], weight: 235, abilities: ['いかく'] },
  { no: 131, name: 'ラプラス', types: ['water', 'ice'], base: [130, 85, 80, 85, 95], weight: 220, abilities: ['ちょすい', 'シェルアーマー'] },
  { no: 132, name: 'メタモン', types: ['normal'], base: [48, 48, 48, 48, 48], weight: 4, abilities: ['じゅうなん'] },
  { no: 133, name: 'イーブイ', types: ['normal'], base: [55, 55, 50, 45, 65], weight: 6.5, abilities: ['にげあし'] },
  { no: 134, name: 'シャワーズ', types: ['water'], base: [130, 65, 60, 110, 95], weight: 29, abilities: ['ちょすい'] },
  { no: 135, name: 'サンダース', types: ['electric'], base: [65, 65, 60, 110, 95], weight: 24.5, abilities: ['ちくでん'] },
  { no: 136, name: 'ブースター', types: ['fire'], base: [65, 130, 60, 95, 110], weight: 25, abilities: ['もらいび'] },
  { no: 137, name: 'ポリゴン', types: ['normal'], base: [65, 60, 70, 85, 75], weight: 36.5, abilities: ['トレース'] },
  { no: 138, name: 'オムナイト', types: ['rock', 'water'], base: [35, 40, 100, 90, 55], weight: 7.5, abilities: ['すいすい', 'シェルアーマー'] },
  { no: 139, name: 'オムスター', types: ['rock', 'water'], base: [70, 60, 125, 115, 70], weight: 35, abilities: ['すいすい', 'シェルアーマー'] },
  { no: 140, name: 'カブト', types: ['rock', 'water'], base: [30, 80, 90, 55, 45], weight: 11.5, abilities: ['すいすい', 'カブトアーマー'] },
  { no: 141, name: 'カブトプス', types: ['rock', 'water'], base: [60, 115, 105, 65, 70], weight: 40.5, abilities: ['すいすい', 'カブトアーマー'] },
  { no: 142, name: 'プテラ', types: ['rock', 'flying'], base: [80, 105, 65, 60, 75], weight: 59, abilities: ['いしあたま', 'プレッシャー'] },
  { no: 143, name: 'カビゴン', types: ['normal'], base: [160, 110, 65, 65, 110], weight: 460, abilities: ['めんえき', 'あついしぼう'] },
  { no: 144, name: 'フリーザー', types: ['ice', 'flying'], base: [90, 85, 100, 95, 125], weight: 55.4, abilities: ['プレッシャー'] },
  { no: 145, name: 'サンダー', types: ['electric', 'flying'], base: [90, 90, 85, 125, 90], weight: 52.6, abilities: ['プレッシャー'] },
  { no: 146, name: 'ファイヤー', types: ['fire', 'flying'], base: [90, 100, 90, 125, 85], weight: 60, abilities: ['プレッシャー'] },
  { no: 147, name: 'ミニリュウ', types: ['dragon'], base: [41, 64, 45, 50, 50], weight: 3.3, abilities: ['だっぴ'] },
  { no: 148, name: 'ハクリュー', types: ['dragon'], base: [61, 84, 65, 70, 70], weight: 16.5, abilities: ['だっぴ'] },
  { no: 149, name: 'カイリュー', types: ['dragon', 'flying'], base: [91, 134, 95, 100, 100], weight: 210, abilities: ['せいしんりょく'] },
  { no: 150, name: 'ミュウツー', types: ['psychic'], base: [106, 110, 90, 154, 90], weight: 122, abilities: ['プレッシャー'] },
  { no: 151, name: 'ミュウ', types: ['psychic'], base: [100, 100, 100, 100, 100], weight: 4, abilities: ['シンクロ'] },
  { no: 152, name: 'チコリータ', types: ['grass'], base: [45, 49, 65, 49, 65], weight: 6.4, abilities: ['しんりょく'] },
  { no: 153, name: 'ベイリーフ', types: ['grass'], base: [60, 62, 80, 63, 80], weight: 15.8, abilities: ['しんりょく'] },
  { no: 154, name: 'メガニウム', types: ['grass'], base: [80, 82, 100, 83, 100], weight: 100.5, abilities: ['しんりょく'] },
  { no: 155, name: 'ヒノアラシ', types: ['fire'], base: [39, 52, 43, 60, 50], weight: 7.9, abilities: ['もうか'] },
  { no: 156, name: 'マグマラシ', types: ['fire'], base: [58, 64, 58, 80, 65], weight: 19, abilities: ['もうか'] },
  { no: 157, name: 'バクフーン', types: ['fire'], base: [78, 84, 78, 109, 85], weight: 79.5, abilities: ['もうか'] },
  { no: 158, name: 'ワニノコ', types: ['water'], base: [50, 65, 64, 44, 48], weight: 9.5, abilities: ['げきりゅう'] },
  { no: 159, name: 'アリゲイツ', types: ['water'], base: [65, 80, 80, 59, 63], weight: 25, abilities: ['げきりゅう'] },
  { no: 160, name: 'オーダイル', types: ['water'], base: [85, 105, 100, 79, 83], weight: 88.8, abilities: ['げきりゅう'] },
  { no: 161, name: 'オタチ', types: ['normal'], base: [35, 46, 34, 35, 45], weight: 6, abilities: ['にげあし', 'するどいめ'] },
  { no: 162, name: 'オオタチ', types: ['normal'], base: [85, 76, 64, 45, 55], weight: 32.5, abilities: ['にげあし', 'するどいめ'] },
  { no: 163, name: 'ホーホー', types: ['normal', 'flying'], base: [60, 30, 30, 36, 56], weight: 21.2, abilities: ['ふみん', 'するどいめ'] },
  { no: 164, name: 'ヨルノズク', types: ['normal', 'flying'], base: [100, 50, 50, 76, 96], weight: 40.8, abilities: ['ふみん', 'するどいめ'] },
  { no: 165, name: 'レディバ', types: ['bug', 'flying'], base: [40, 20, 30, 40, 80], weight: 10.8, abilities: ['むしのしらせ', 'はやおき'] },
  { no: 166, name: 'レディアン', types: ['bug', 'flying'], base: [55, 35, 50, 55, 110], weight: 35.6, abilities: ['むしのしらせ', 'はやおき'] },
  { no: 167, name: 'イトマル', types: ['bug', 'poison'], base: [40, 60, 40, 40, 40], weight: 8.5, abilities: ['むしのしらせ', 'ふみん'] },
  { no: 168, name: 'アリアドス', types: ['bug', 'poison'], base: [70, 90, 70, 60, 60], weight: 33.5, abilities: ['むしのしらせ', 'ふみん'] },
  { no: 169, name: 'クロバット', types: ['poison', 'flying'], base: [85, 90, 80, 70, 80], weight: 75, abilities: ['せいしんりょく'] },
  { no: 170, name: 'チョンチー', types: ['water', 'electric'], base: [75, 38, 38, 56, 56], weight: 12, abilities: ['ちくでん', 'はっこう'] },
  { no: 171, name: 'ランターン', types: ['water', 'electric'], base: [125, 58, 58, 76, 76], weight: 22.5, abilities: ['ちくでん', 'はっこう'] },
  { no: 172, name: 'ピチュー', types: ['electric'], base: [20, 40, 15, 35, 35], weight: 2, abilities: ['せいでんき'] },
  { no: 173, name: 'ピィ', types: ['normal'], base: [50, 25, 28, 45, 55], weight: 3, abilities: ['メロメロボディ'] },
  { no: 174, name: 'ププリン', types: ['normal'], base: [90, 30, 15, 40, 20], weight: 1, abilities: ['メロメロボディ'] },
  { no: 175, name: 'トゲピー', types: ['normal'], base: [35, 20, 65, 40, 65], weight: 1.5, abilities: ['はりきり', 'てんのめぐみ'] },
  { no: 176, name: 'トゲチック', types: ['normal', 'flying'], base: [55, 40, 85, 80, 105], weight: 3.2, abilities: ['はりきり', 'てんのめぐみ'] },
  { no: 177, name: 'ネイティ', types: ['psychic', 'flying'], base: [40, 50, 45, 70, 45], weight: 2, abilities: ['シンクロ', 'はやおき'] },
  { no: 178, name: 'ネイティオ', types: ['psychic', 'flying'], base: [65, 75, 70, 95, 70], weight: 15, abilities: ['シンクロ', 'はやおき'] },
  { no: 179, name: 'メリープ', types: ['electric'], base: [55, 40, 40, 65, 45], weight: 7.8, abilities: ['せいでんき'] },
  { no: 180, name: 'モココ', types: ['electric'], base: [70, 55, 55, 80, 60], weight: 13.3, abilities: ['せいでんき'] },
  { no: 181, name: 'デンリュウ', types: ['electric'], base: [90, 75, 75, 115, 90], weight: 61.5, abilities: ['せいでんき'] },
  { no: 182, name: 'キレイハナ', types: ['grass'], base: [75, 80, 85, 90, 100], weight: 5.8, abilities: ['ようりょくそ'] },
  { no: 183, name: 'マリル', types: ['water'], base: [70, 20, 50, 20, 50], weight: 8.5, abilities: ['あついしぼう', 'ちからもち'] },
  { no: 184, name: 'マリルリ', types: ['water'], base: [100, 50, 80, 50, 80], weight: 28.5, abilities: ['あついしぼう', 'ちからもち'] },
  { no: 185, name: 'ウソッキー', types: ['rock'], base: [70, 100, 115, 30, 65], weight: 38, abilities: ['がんじょう', 'いしあたま'] },
  { no: 186, name: 'ニョロトノ', types: ['water'], base: [90, 75, 75, 90, 100], weight: 33.9, abilities: ['ちょすい', 'しめりけ'] },
  { no: 187, name: 'ハネッコ', types: ['grass', 'flying'], base: [35, 35, 40, 35, 55], weight: 0.5, abilities: ['ようりょくそ'] },
  { no: 188, name: 'ポポッコ', types: ['grass', 'flying'], base: [55, 45, 50, 45, 65], weight: 1, abilities: ['ようりょくそ'] },
  { no: 189, name: 'ワタッコ', types: ['grass', 'flying'], base: [75, 55, 70, 55, 85], weight: 3, abilities: ['ようりょくそ'] },
  { no: 190, name: 'エイパム', types: ['normal'], base: [55, 70, 55, 40, 55], weight: 11.5, abilities: ['にげあし', 'ものひろい'] },
  { no: 191, name: 'ヒマナッツ', types: ['grass'], base: [30, 30, 30, 30, 30], weight: 1.8, abilities: ['ようりょくそ'] },
  { no: 192, name: 'キマワリ', types: ['grass'], base: [75, 75, 55, 105, 85], weight: 8.5, abilities: ['ようりょくそ'] },
  { no: 193, name: 'ヤンヤンマ', types: ['bug', 'flying'], base: [65, 65, 45, 75, 45], weight: 38, abilities: ['かそく', 'ふくがん'] },
  { no: 194, name: 'ウパー', types: ['water', 'ground'], base: [55, 45, 45, 25, 25], weight: 8.5, abilities: ['しめりけ', 'ちょすい'] },
  { no: 195, name: 'ヌオー', types: ['water', 'ground'], base: [95, 85, 85, 65, 65], weight: 75, abilities: ['しめりけ', 'ちょすい'] },
  { no: 196, name: 'エーフィ', types: ['psychic'], base: [65, 65, 60, 130, 95], weight: 26.5, abilities: ['シンクロ'] },
  { no: 197, name: 'ブラッキー', types: ['dark'], base: [95, 65, 110, 60, 130], weight: 27, abilities: ['シンクロ'] },
  { no: 198, name: 'ヤミカラス', types: ['dark', 'flying'], base: [60, 85, 42, 85, 42], weight: 2.1, abilities: ['ふみん'] },
  { no: 199, name: 'ヤドキング', types: ['water', 'psychic'], base: [95, 75, 80, 100, 110], weight: 79.5, abilities: ['どんかん', 'マイペース'] },
  { no: 200, name: 'ムウマ', types: ['ghost'], base: [60, 60, 60, 85, 85], weight: 1, abilities: ['ふゆう'] },
  { no: 201, name: 'アンノーン', types: ['psychic'], base: [48, 72, 48, 72, 48], weight: 5, abilities: ['ふゆう'] },
  { no: 202, name: 'ソーナンス', types: ['psychic'], base: [190, 33, 58, 33, 58], weight: 28.5, abilities: ['かげふみ'] },
  { no: 203, name: 'キリンリキ', types: ['normal', 'psychic'], base: [70, 80, 65, 90, 65], weight: 41.5, abilities: ['せいしんりょく', 'はやおき'] },
  { no: 204, name: 'クヌギダマ', types: ['bug'], base: [50, 65, 90, 35, 35], weight: 7.2, abilities: ['がんじょう'] },
  { no: 205, name: 'フォレトス', types: ['bug', 'steel'], base: [75, 90, 140, 60, 60], weight: 125.8, abilities: ['がんじょう'] },
  { no: 206, name: 'ノコッチ', types: ['normal'], base: [100, 70, 70, 65, 65], weight: 14, abilities: ['てんのめぐみ', 'にげあし'] },
  { no: 207, name: 'グライガー', types: ['ground', 'flying'], base: [65, 75, 105, 35, 65], weight: 64.8, abilities: ['かいりきバサミ', 'すながくれ'] },
  { no: 208, name: 'ハガネール', types: ['steel', 'ground'], base: [75, 85, 200, 55, 65], weight: 400, abilities: ['いしあたま', 'がんじょう'] },
  { no: 209, name: 'ブルー', types: ['normal'], base: [60, 80, 50, 40, 40], weight: 7.8, abilities: ['いかく', 'にげあし'] },
  { no: 210, name: 'グランブル', types: ['normal'], base: [90, 120, 75, 60, 60], weight: 48.7, abilities: ['いかく'] },
  { no: 211, name: 'ハリーセン', types: ['water', 'poison'], base: [65, 95, 75, 55, 55], weight: 3.9, abilities: ['どくのトゲ', 'すいすい'] },
  { no: 212, name: 'ハッサム', types: ['bug', 'steel'], base: [70, 130, 100, 55, 80], weight: 118, abilities: ['むしのしらせ'] },
  { no: 213, name: 'ツボツボ', types: ['bug', 'rock'], base: [20, 10, 230, 10, 230], weight: 20.5, abilities: ['がんじょう'] },
  { no: 214, name: 'ヘラクロス', types: ['bug', 'fight'], base: [80, 125, 75, 40, 95], weight: 54, abilities: ['むしのしらせ', 'こんじょう'] },
  { no: 215, name: 'ニューラ', types: ['dark', 'ice'], base: [55, 95, 55, 35, 75], weight: 28, abilities: ['せいしんりょく', 'するどいめ'] },
  { no: 216, name: 'ヒメグマ', types: ['normal'], base: [60, 80, 50, 50, 50], weight: 8.8, abilities: ['ものひろい'] },
  { no: 217, name: 'リングマ', types: ['normal'], base: [90, 130, 75, 75, 75], weight: 125.8, abilities: ['こんじょう'] },
  { no: 218, name: 'マグマッグ', types: ['fire'], base: [40, 40, 40, 70, 40], weight: 35, abilities: ['マグマのよろい', 'ほのおのからだ'] },
  { no: 219, name: 'マグカルゴ', types: ['fire', 'rock'], base: [50, 50, 120, 80, 80], weight: 55, abilities: ['マグマのよろい', 'ほのおのからだ'] },
  { no: 220, name: 'ウリムー', types: ['ice', 'ground'], base: [50, 50, 40, 30, 30], weight: 6.5, abilities: ['どんかん'] },
  { no: 221, name: 'イノムー', types: ['ice', 'ground'], base: [100, 100, 80, 60, 60], weight: 55.8, abilities: ['どんかん'] },
  { no: 222, name: 'サニーゴ', types: ['water', 'rock'], base: [55, 55, 85, 65, 85], weight: 5, abilities: ['はりきり', 'しぜんかいふく'] },
  { no: 223, name: 'テッポウオ', types: ['water'], base: [35, 65, 35, 65, 35], weight: 12, abilities: ['はりきり'] },
  { no: 224, name: 'オクタン', types: ['water'], base: [75, 105, 75, 105, 75], weight: 28.5, abilities: ['きゅうばん'] },
  { no: 225, name: 'デリバード', types: ['ice', 'flying'], base: [45, 55, 45, 65, 45], weight: 16, abilities: ['やるき', 'はりきり'] },
  { no: 226, name: 'マンタイン', types: ['water', 'flying'], base: [65, 40, 70, 80, 140], weight: 220, abilities: ['すいすい', 'ちょすい'] },
  { no: 227, name: 'エアームド', types: ['steel', 'flying'], base: [65, 80, 140, 40, 70], weight: 50.5, abilities: ['するどいめ', 'がんじょう'] },
  { no: 228, name: 'デルビル', types: ['dark', 'fire'], base: [45, 60, 30, 80, 50], weight: 10.8, abilities: ['はやおき', 'もらいび'] },
  { no: 229, name: 'ヘルガー', types: ['dark', 'fire'], base: [75, 90, 50, 110, 80], weight: 35, abilities: ['はやおき', 'もらいび'] },
  { no: 230, name: 'キングドラ', types: ['water', 'dragon'], base: [75, 95, 95, 95, 95], weight: 152, abilities: ['すいすい'] },
  { no: 231, name: 'ゴマゾウ', types: ['ground'], base: [90, 60, 60, 40, 40], weight: 33.5, abilities: ['ものひろい'] },
  { no: 232, name: 'ドンファン', types: ['ground'], base: [90, 120, 120, 60, 60], weight: 120, abilities: ['がんじょう'] },
  { no: 233, name: 'ポリゴン２', types: ['normal'], base: [85, 80, 90, 105, 95], weight: 32.5, abilities: ['トレース'] },
  { no: 234, name: 'オドシシ', types: ['normal'], base: [73, 95, 62, 85, 65], weight: 71.2, abilities: ['いかく'] },
  { no: 235, name: 'ドーブル', types: ['normal'], base: [55, 20, 35, 20, 45], weight: 58, abilities: ['マイペース'] },
  { no: 236, name: 'バルキー', types: ['fight'], base: [35, 35, 35, 35, 35], weight: 21, abilities: ['こんじょう'] },
  { no: 237, name: 'カポエラー', types: ['fight'], base: [50, 95, 95, 35, 110], weight: 48, abilities: ['いかく'] },
  { no: 238, name: 'ムチュール', types: ['ice', 'psychic'], base: [45, 30, 15, 85, 65], weight: 6, abilities: ['どんかん'] },
  { no: 239, name: 'エレキッド', types: ['electric'], base: [45, 63, 37, 65, 55], weight: 23.5, abilities: ['せいでんき'] },
  { no: 240, name: 'ブビィ', types: ['fire'], base: [45, 75, 37, 70, 55], weight: 21.4, abilities: ['ほのおのからだ'] },
  { no: 241, name: 'ミルタンク', types: ['normal'], base: [95, 80, 105, 40, 70], weight: 75.5, abilities: ['あついしぼう'] },
  { no: 242, name: 'ハピナス', types: ['normal'], base: [255, 10, 10, 75, 135], weight: 46.8, abilities: ['しぜんかいふく', 'てんのめぐみ'] },
  { no: 243, name: 'ライコウ', types: ['electric'], base: [90, 85, 75, 115, 100], weight: 178, abilities: ['プレッシャー'] },
  { no: 244, name: 'エンテイ', types: ['fire'], base: [115, 115, 85, 90, 75], weight: 198, abilities: ['プレッシャー'] },
  { no: 245, name: 'スイクン', types: ['water'], base: [100, 75, 115, 90, 115], weight: 187, abilities: ['プレッシャー'] },
  { no: 246, name: 'ヨーギラス', types: ['rock', 'ground'], base: [50, 64, 50, 45, 50], weight: 72, abilities: ['こんじょう'] },
  { no: 247, name: 'サナギラス', types: ['rock', 'ground'], base: [70, 84, 70, 65, 70], weight: 152, abilities: ['だっぴ'] },
  { no: 248, name: 'バンギラス', types: ['rock', 'dark'], base: [100, 134, 110, 95, 100], weight: 202, abilities: ['すなおこし'] },
  { no: 249, name: 'ルギア', types: ['psychic', 'flying'], base: [106, 90, 130, 90, 154], weight: 216, abilities: ['プレッシャー'] },
  { no: 250, name: 'ホウオウ', types: ['fire', 'flying'], base: [106, 130, 90, 110, 154], weight: 199, abilities: ['プレッシャー'] },
  { no: 251, name: 'セレビィ', types: ['psychic', 'grass'], base: [100, 100, 100, 100, 100], weight: 5, abilities: ['しぜんかいふく'] },
  { no: 252, name: 'キモリ', types: ['grass'], base: [40, 45, 35, 65, 55], weight: 5, abilities: ['しんりょく'] },
  { no: 253, name: 'ジュプトル', types: ['grass'], base: [50, 65, 45, 85, 65], weight: 21.6, abilities: ['しんりょく'] },
  { no: 254, name: 'ジュカイン', types: ['grass'], base: [70, 85, 65, 105, 85], weight: 52.2, abilities: ['しんりょく'] },
  { no: 255, name: 'アチャモ', types: ['fire'], base: [45, 60, 40, 70, 50], weight: 2.5, abilities: ['もうか'] },
  { no: 256, name: 'ワカシャモ', types: ['fire', 'fight'], base: [60, 85, 60, 85, 60], weight: 19.5, abilities: ['もうか'] },
  { no: 257, name: 'バシャーモ', types: ['fire', 'fight'], base: [80, 120, 70, 110, 70], weight: 52, abilities: ['もうか'] },
  { no: 258, name: 'ミズゴロウ', types: ['water'], base: [50, 70, 50, 50, 50], weight: 7.6, abilities: ['げきりゅう'] },
  { no: 259, name: 'ヌマクロー', types: ['water', 'ground'], base: [70, 85, 70, 60, 70], weight: 28, abilities: ['げきりゅう'] },
  { no: 260, name: 'ラグラージ', types: ['water', 'ground'], base: [100, 110, 90, 85, 90], weight: 81.9, abilities: ['げきりゅう'] },
  { no: 261, name: 'ポチエナ', types: ['dark'], base: [35, 55, 35, 30, 30], weight: 13.6, abilities: ['にげあし'] },
  { no: 262, name: 'グラエナ', types: ['dark'], base: [70, 90, 70, 60, 60], weight: 37, abilities: ['いかく'] },
  { no: 263, name: 'ジグザグマ', types: ['normal'], base: [38, 30, 41, 30, 41], weight: 17.5, abilities: ['ものひろい'] },
  { no: 264, name: 'マッスグマ', types: ['normal'], base: [78, 70, 61, 50, 61], weight: 32.5, abilities: ['ものひろい'] },
  { no: 265, name: 'ケムッソ', types: ['bug'], base: [45, 45, 35, 20, 30], weight: 3.6, abilities: ['りんぷん'] },
  { no: 266, name: 'カラサリス', types: ['bug'], base: [50, 35, 55, 25, 25], weight: 10, abilities: ['だっぴ'] },
  { no: 267, name: 'アゲハント', types: ['bug', 'flying'], base: [60, 70, 50, 90, 50], weight: 28.4, abilities: ['むしのしらせ'] },
  { no: 268, name: 'マユルド', types: ['bug'], base: [50, 35, 55, 25, 25], weight: 11.5, abilities: ['だっぴ'] },
  { no: 269, name: 'ドクケイル', types: ['bug', 'poison'], base: [60, 50, 70, 50, 90], weight: 31.6, abilities: ['りんぷん'] },
  { no: 270, name: 'ハスボー', types: ['water', 'grass'], base: [40, 30, 30, 40, 50], weight: 2.6, abilities: ['すいすい', 'あめうけざら'] },
  { no: 271, name: 'ハスブレロ', types: ['water', 'grass'], base: [60, 50, 50, 60, 70], weight: 32.5, abilities: ['すいすい', 'あめうけざら'] },
  { no: 272, name: 'ルンパッパ', types: ['water', 'grass'], base: [80, 70, 70, 90, 100], weight: 55, abilities: ['すいすい', 'あめうけざら'] },
  { no: 273, name: 'タネボー', types: ['grass'], base: [40, 40, 50, 30, 30], weight: 4, abilities: ['ようりょくそ', 'はやおき'] },
  { no: 274, name: 'コノハナ', types: ['grass', 'dark'], base: [70, 70, 40, 60, 40], weight: 28, abilities: ['ようりょくそ', 'はやおき'] },
  { no: 275, name: 'ダーテング', types: ['grass', 'dark'], base: [90, 100, 60, 90, 60], weight: 59.6, abilities: ['ようりょくそ', 'はやおき'] },
  { no: 276, name: 'スバメ', types: ['normal', 'flying'], base: [40, 55, 30, 30, 30], weight: 2.3, abilities: ['こんじょう'] },
  { no: 277, name: 'オオスバメ', types: ['normal', 'flying'], base: [60, 85, 60, 50, 50], weight: 19.8, abilities: ['こんじょう'] },
  { no: 278, name: 'キャモメ', types: ['water', 'flying'], base: [40, 30, 30, 55, 30], weight: 9.5, abilities: ['するどいめ'] },
  { no: 279, name: 'ペリッパー', types: ['water', 'flying'], base: [60, 50, 100, 85, 70], weight: 28, abilities: ['するどいめ'] },
  { no: 280, name: 'ラルトス', types: ['psychic'], base: [28, 25, 25, 45, 35], weight: 6.6, abilities: ['シンクロ', 'トレース'] },
  { no: 281, name: 'キルリア', types: ['psychic'], base: [38, 35, 35, 65, 55], weight: 20.2, abilities: ['シンクロ', 'トレース'] },
  { no: 282, name: 'サーナイト', types: ['psychic'], base: [68, 65, 65, 125, 115], weight: 48.4, abilities: ['シンクロ', 'トレース'] },
  { no: 283, name: 'アメタマ', types: ['bug', 'water'], base: [40, 30, 32, 50, 52], weight: 1.7, abilities: ['すいすい'] },
  { no: 284, name: 'アメモース', types: ['bug', 'flying'], base: [70, 60, 62, 80, 82], weight: 3.6, abilities: ['いかく'] },
  { no: 285, name: 'キノココ', types: ['grass'], base: [60, 40, 60, 40, 60], weight: 4.5, abilities: ['ほうし'] },
  { no: 286, name: 'キノガッサ', types: ['grass', 'fight'], base: [60, 130, 80, 60, 60], weight: 39.2, abilities: ['ほうし'] },
  { no: 287, name: 'ナマケロ', types: ['normal'], base: [60, 60, 60, 35, 35], weight: 24, abilities: ['なまけ'] },
  { no: 288, name: 'ヤルキモノ', types: ['normal'], base: [80, 80, 80, 55, 55], weight: 46.5, abilities: ['やるき'] },
  { no: 289, name: 'ケッキング', types: ['normal'], base: [150, 160, 100, 95, 65], weight: 130.5, abilities: ['なまけ'] },
  { no: 290, name: 'ツチニン', types: ['bug', 'ground'], base: [31, 45, 90, 30, 30], weight: 5.5, abilities: ['ふくがん'] },
  { no: 291, name: 'テッカニン', types: ['bug', 'flying'], base: [61, 90, 45, 50, 50], weight: 12, abilities: ['かそく'] },
  { no: 292, name: 'ヌケニン', types: ['bug', 'ghost'], base: [1, 90, 45, 30, 30], weight: 1.2, abilities: ['ふしぎなまもり'] },
  { no: 293, name: 'ゴニョニョ', types: ['normal'], base: [64, 51, 23, 51, 23], weight: 16.3, abilities: ['ぼうおん'] },
  { no: 294, name: 'ドゴーム', types: ['normal'], base: [84, 71, 43, 71, 43], weight: 40.5, abilities: ['ぼうおん'] },
  { no: 295, name: 'バクオング', types: ['normal'], base: [104, 91, 63, 91, 63], weight: 84, abilities: ['ぼうおん'] },
  { no: 296, name: 'マクノシタ', types: ['fight'], base: [72, 60, 30, 20, 30], weight: 86.4, abilities: ['あついしぼう', 'こんじょう'] },
  { no: 297, name: 'ハリテヤマ', types: ['fight'], base: [144, 120, 60, 40, 60], weight: 253.8, abilities: ['あついしぼう', 'こんじょう'] },
  { no: 298, name: 'ルリリ', types: ['normal'], base: [50, 20, 40, 20, 40], weight: 2, abilities: ['あついしぼう', 'ちからもち'] },
  { no: 299, name: 'ノズパス', types: ['rock'], base: [30, 45, 135, 45, 90], weight: 97, abilities: ['がんじょう', 'じりょく'] },
  { no: 300, name: 'エネコ', types: ['normal'], base: [50, 45, 45, 35, 35], weight: 11, abilities: ['メロメロボディ'] },
  { no: 301, name: 'エネコロロ', types: ['normal'], base: [70, 65, 65, 55, 55], weight: 32.6, abilities: ['メロメロボディ'] },
  { no: 302, name: 'ヤミラミ', types: ['dark', 'ghost'], base: [50, 75, 75, 65, 65], weight: 11, abilities: ['するどいめ'] },
  { no: 303, name: 'クチート', types: ['steel'], base: [50, 85, 85, 55, 55], weight: 11.5, abilities: ['かいりきバサミ', 'いかく'] },
  { no: 304, name: 'ココドラ', types: ['steel', 'rock'], base: [50, 70, 100, 40, 40], weight: 60, abilities: ['がんじょう', 'いしあたま'] },
  { no: 305, name: 'コドラ', types: ['steel', 'rock'], base: [60, 90, 140, 50, 50], weight: 120, abilities: ['がんじょう', 'いしあたま'] },
  { no: 306, name: 'ボスゴドラ', types: ['steel', 'rock'], base: [70, 110, 180, 60, 60], weight: 360, abilities: ['がんじょう', 'いしあたま'] },
  { no: 307, name: 'アサナン', types: ['fight', 'psychic'], base: [30, 40, 55, 40, 55], weight: 11.2, abilities: ['ヨガパワー'] },
  { no: 308, name: 'チャーレム', types: ['fight', 'psychic'], base: [60, 60, 75, 60, 75], weight: 31.5, abilities: ['ヨガパワー'] },
  { no: 309, name: 'ラクライ', types: ['electric'], base: [40, 45, 40, 65, 40], weight: 15.2, abilities: ['せいでんき', 'ひらいしん'] },
  { no: 310, name: 'ライボルト', types: ['electric'], base: [70, 75, 60, 105, 60], weight: 40.2, abilities: ['せいでんき', 'ひらいしん'] },
  { no: 311, name: 'プラスル', types: ['electric'], base: [60, 50, 40, 85, 75], weight: 4.2, abilities: ['プラス'] },
  { no: 312, name: 'マイナン', types: ['electric'], base: [60, 40, 50, 75, 85], weight: 4.2, abilities: ['マイナス'] },
  { no: 313, name: 'バルビート', types: ['bug'], base: [65, 73, 55, 47, 75], weight: 17.7, abilities: ['はっこう', 'むしのしらせ'] },
  { no: 314, name: 'イルミーゼ', types: ['bug'], base: [65, 47, 55, 73, 75], weight: 17.7, abilities: ['どんかん'] },
  { no: 315, name: 'ロゼリア', types: ['grass', 'poison'], base: [50, 60, 45, 100, 80], weight: 2, abilities: ['しぜんかいふく', 'どくのトゲ'] },
  { no: 316, name: 'ゴクリン', types: ['poison'], base: [70, 43, 53, 43, 53], weight: 10.3, abilities: ['ヘドロえき', 'ねんちゃく'] },
  { no: 317, name: 'マルノーム', types: ['poison'], base: [100, 73, 83, 73, 83], weight: 80, abilities: ['ヘドロえき', 'ねんちゃく'] },
  { no: 318, name: 'キバニア', types: ['water', 'dark'], base: [45, 90, 20, 65, 20], weight: 20.8, abilities: ['さめはだ'] },
  { no: 319, name: 'サメハダー', types: ['water', 'dark'], base: [70, 120, 40, 95, 40], weight: 88.8, abilities: ['さめはだ'] },
  { no: 320, name: 'ホエルコ', types: ['water'], base: [130, 70, 35, 70, 35], weight: 130, abilities: ['みずのベール', 'どんかん'] },
  { no: 321, name: 'ホエルオー', types: ['water'], base: [170, 90, 45, 90, 45], weight: 398, abilities: ['みずのベール', 'どんかん'] },
  { no: 322, name: 'ドンメル', types: ['fire', 'ground'], base: [60, 60, 40, 65, 45], weight: 24, abilities: ['どんかん'] },
  { no: 323, name: 'バクーダ', types: ['fire', 'ground'], base: [70, 100, 70, 105, 75], weight: 220, abilities: ['マグマのよろい'] },
  { no: 324, name: 'コータス', types: ['fire'], base: [70, 85, 140, 85, 70], weight: 80.4, abilities: ['しろいけむり'] },
  { no: 325, name: 'バネブー', types: ['psychic'], base: [60, 25, 35, 70, 80], weight: 30.6, abilities: ['あついしぼう', 'マイペース'] },
  { no: 326, name: 'ブーピッグ', types: ['psychic'], base: [80, 45, 65, 90, 110], weight: 71.5, abilities: ['あついしぼう', 'マイペース'] },
  { no: 327, name: 'パッチール', types: ['normal'], base: [60, 60, 60, 60, 60], weight: 5, abilities: ['マイペース'] },
  { no: 328, name: 'ナックラー', types: ['ground'], base: [45, 100, 45, 45, 45], weight: 15, abilities: ['かいりきバサミ', 'ありじごく'] },
  { no: 329, name: 'ビブラーバ', types: ['ground', 'dragon'], base: [50, 70, 50, 50, 50], weight: 15.3, abilities: ['ふゆう'] },
  { no: 330, name: 'フライゴン', types: ['ground', 'dragon'], base: [80, 100, 80, 80, 80], weight: 82, abilities: ['ふゆう'] },
  { no: 331, name: 'サボネア', types: ['grass'], base: [50, 85, 40, 85, 40], weight: 51.3, abilities: ['すながくれ'] },
  { no: 332, name: 'ノクタス', types: ['grass', 'dark'], base: [70, 115, 60, 115, 60], weight: 77.4, abilities: ['すながくれ'] },
  { no: 333, name: 'チルット', types: ['normal', 'flying'], base: [45, 40, 60, 40, 75], weight: 1.2, abilities: ['しぜんかいふく'] },
  { no: 334, name: 'チルタリス', types: ['dragon', 'flying'], base: [75, 70, 90, 70, 105], weight: 20.6, abilities: ['しぜんかいふく'] },
  { no: 335, name: 'ザングース', types: ['normal'], base: [73, 115, 60, 60, 60], weight: 40.3, abilities: ['めんえき'] },
  { no: 336, name: 'ハブネーク', types: ['poison'], base: [73, 100, 60, 100, 60], weight: 52.5, abilities: ['だっぴ'] },
  { no: 337, name: 'ルナトーン', types: ['rock', 'psychic'], base: [70, 55, 65, 95, 85], weight: 168, abilities: ['ふゆう'] },
  { no: 338, name: 'ソルロック', types: ['rock', 'psychic'], base: [70, 95, 85, 55, 65], weight: 154, abilities: ['ふゆう'] },
  { no: 339, name: 'ドジョッチ', types: ['water', 'ground'], base: [50, 48, 43, 46, 41], weight: 1.9, abilities: ['どんかん'] },
  { no: 340, name: 'ナマズン', types: ['water', 'ground'], base: [110, 78, 73, 76, 71], weight: 23.6, abilities: ['どんかん'] },
  { no: 341, name: 'ヘイガニ', types: ['water'], base: [43, 80, 65, 50, 35], weight: 11.5, abilities: ['かいりきバサミ', 'シェルアーマー'] },
  { no: 342, name: 'シザリガー', types: ['water', 'dark'], base: [63, 120, 85, 90, 55], weight: 32.8, abilities: ['かいりきバサミ', 'シェルアーマー'] },
  { no: 343, name: 'ヤジロン', types: ['ground', 'psychic'], base: [40, 40, 55, 40, 70], weight: 21.5, abilities: ['ふゆう'] },
  { no: 344, name: 'ネンドール', types: ['ground', 'psychic'], base: [60, 70, 105, 70, 120], weight: 108, abilities: ['ふゆう'] },
  { no: 345, name: 'リリーラ', types: ['rock', 'grass'], base: [66, 41, 77, 61, 87], weight: 23.8, abilities: ['きゅうばん'] },
  { no: 346, name: 'ユレイドル', types: ['rock', 'grass'], base: [86, 81, 97, 81, 107], weight: 60.4, abilities: ['きゅうばん'] },
  { no: 347, name: 'アノプス', types: ['rock', 'bug'], base: [45, 95, 50, 40, 50], weight: 12.5, abilities: ['カブトアーマー'] },
  { no: 348, name: 'アーマルド', types: ['rock', 'bug'], base: [75, 125, 100, 70, 80], weight: 68.2, abilities: ['カブトアーマー'] },
  { no: 349, name: 'ヒンバス', types: ['water'], base: [20, 15, 20, 10, 55], weight: 7.4, abilities: ['すいすい'] },
  { no: 350, name: 'ミロカロス', types: ['water'], base: [95, 60, 79, 100, 125], weight: 162, abilities: ['ふしぎなうろこ'] },
  { no: 351, name: 'ポワルン', types: ['normal'], base: [70, 70, 70, 70, 70], weight: 0.8, abilities: ['てんきや'] },
  { no: 352, name: 'カクレオン', types: ['normal'], base: [60, 90, 70, 60, 120], weight: 22, abilities: ['へんしょく'] },
  { no: 353, name: 'カゲボウズ', types: ['ghost'], base: [44, 75, 35, 63, 33], weight: 2.3, abilities: ['ふみん'] },
  { no: 354, name: 'ジュペッタ', types: ['ghost'], base: [64, 115, 65, 83, 63], weight: 12.5, abilities: ['ふみん'] },
  { no: 355, name: 'ヨマワル', types: ['ghost'], base: [20, 40, 90, 30, 90], weight: 15, abilities: ['ふゆう'] },
  { no: 356, name: 'サマヨール', types: ['ghost'], base: [40, 70, 130, 60, 130], weight: 30.6, abilities: ['プレッシャー'] },
  { no: 357, name: 'トロピウス', types: ['grass', 'flying'], base: [99, 68, 83, 72, 87], weight: 100, abilities: ['ようりょくそ'] },
  { no: 358, name: 'チリーン', types: ['psychic'], base: [65, 50, 70, 95, 80], weight: 1, abilities: ['ふゆう'] },
  { no: 359, name: 'アブソル', types: ['dark'], base: [65, 130, 60, 75, 60], weight: 47, abilities: ['プレッシャー'] },
  { no: 360, name: 'ソーナノ', types: ['psychic'], base: [95, 23, 48, 23, 48], weight: 14, abilities: ['かげふみ'] },
  { no: 361, name: 'ユキワラシ', types: ['ice'], base: [50, 50, 50, 50, 50], weight: 16.8, abilities: ['せいしんりょく'] },
  { no: 362, name: 'オニゴーリ', types: ['ice'], base: [80, 80, 80, 80, 80], weight: 256.5, abilities: ['せいしんりょく'] },
  { no: 363, name: 'タマザラシ', types: ['ice', 'water'], base: [70, 40, 50, 55, 50], weight: 39.5, abilities: ['あついしぼう'] },
  { no: 364, name: 'トドグラー', types: ['ice', 'water'], base: [90, 60, 70, 75, 70], weight: 87.6, abilities: ['あついしぼう'] },
  { no: 365, name: 'トドゼルガ', types: ['ice', 'water'], base: [110, 80, 90, 95, 90], weight: 150.6, abilities: ['あついしぼう'] },
  { no: 366, name: 'パールル', types: ['water'], base: [35, 64, 85, 74, 55], weight: 52.5, abilities: ['シェルアーマー'] },
  { no: 367, name: 'ハンテール', types: ['water'], base: [55, 104, 105, 94, 75], weight: 27, abilities: ['すいすい'] },
  { no: 368, name: 'サクラビス', types: ['water'], base: [55, 84, 105, 114, 75], weight: 22.6, abilities: ['すいすい'] },
  { no: 369, name: 'ジーランス', types: ['water', 'rock'], base: [100, 90, 130, 45, 65], weight: 23.4, abilities: ['すいすい', 'いしあたま'] },
  { no: 370, name: 'ラブカス', types: ['water'], base: [43, 30, 55, 40, 65], weight: 8.7, abilities: ['すいすい'] },
  { no: 371, name: 'タツベイ', types: ['dragon'], base: [45, 75, 60, 40, 30], weight: 42.1, abilities: ['いしあたま'] },
  { no: 372, name: 'コモルー', types: ['dragon'], base: [65, 95, 100, 60, 50], weight: 110.5, abilities: ['いしあたま'] },
  { no: 373, name: 'ボーマンダ', types: ['dragon', 'flying'], base: [95, 135, 80, 110, 80], weight: 102.6, abilities: ['いかく'] },
  { no: 374, name: 'ダンバル', types: ['steel', 'psychic'], base: [40, 55, 80, 35, 60], weight: 95.2, abilities: ['クリアボディ'] },
  { no: 375, name: 'メタング', types: ['steel', 'psychic'], base: [60, 75, 100, 55, 80], weight: 202.5, abilities: ['クリアボディ'] },
  { no: 376, name: 'メタグロス', types: ['steel', 'psychic'], base: [80, 135, 130, 95, 90], weight: 550, abilities: ['クリアボディ'] },
  { no: 377, name: 'レジロック', types: ['rock'], base: [80, 100, 200, 50, 100], weight: 230, abilities: ['クリアボディ'] },
  { no: 378, name: 'レジアイス', types: ['ice'], base: [80, 50, 100, 100, 200], weight: 175, abilities: ['クリアボディ'] },
  { no: 379, name: 'レジスチル', types: ['steel'], base: [80, 75, 150, 75, 150], weight: 205, abilities: ['クリアボディ'] },
  { no: 380, name: 'ラティアス', types: ['dragon', 'psychic'], base: [80, 80, 90, 110, 130], weight: 40, abilities: ['ふゆう'] },
  { no: 381, name: 'ラティオス', types: ['dragon', 'psychic'], base: [80, 90, 80, 130, 110], weight: 60, abilities: ['ふゆう'] },
  { no: 382, name: 'カイオーガ', types: ['water'], base: [100, 100, 90, 150, 140], weight: 352, abilities: ['あめふらし'] },
  { no: 383, name: 'グラードン', types: ['ground'], base: [100, 150, 140, 100, 90], weight: 950, abilities: ['ひでり'] },
  { no: 384, name: 'レックウザ', types: ['dragon', 'flying'], base: [105, 150, 90, 150, 90], weight: 206.5, abilities: ['エアロック'] },
  { no: 385, name: 'ジラーチ', types: ['steel', 'psychic'], base: [100, 100, 100, 100, 100], weight: 1.1, abilities: ['てんのめぐみ'] },
  { no: 386, name: 'デオキシス', types: ['psychic'], base: [50, 150, 50, 150, 50], weight: 60.8, abilities: ['プレッシャー'] },
];

// ── わざ ──────────────────────────────────────────────────────────────

/** 物理か 特殊かは タイプで 決まるので、わざ自身は 持たない。 */
type Move = {
  readonly name: string;
  readonly type: TypeKey;
  readonly power: number;
};

/**
 * 第3世代に ある、ダメージの 出る わざ。いりょくも 当時のもの。
 *
 * いまの作品で 数が 変わった ものが ある。かえんほうしゃ・なみのり・10まんボルト・
 * れいとうビームは 95（いまは 90）、だいもんじ・ハイドロポンプ・かみなり・ふぶきは
 * 120（いまは 110）、たいあたりは 35、とびひざげりは 85、コメットパンチは 100。
 *
 * 第4世代 以降の わざ（インファイト・シザークロス・つじぎり・ダストシュート・
 * タネばくだん など）は、この ころに 無いので 入れて いない。ほかに 3つ、
 * わざと 外した ものが ある。
 *  - ダメージの 出ない わざ（つるぎのまい・でんじは など）。この どうぐでは 使い道が無い。
 *  - いりょくが 場面で 変わる わざ（ふんえん・きしかいせい・おんがえし・
 *    マグニチュード・めざめるパワー）。残りHPや なつき度 なので、この どうぐが
 *    知らない。「じぶんで かく」で、その場の 数を 入れて 使う。
 *    けたぐり だけは 入れて ある——あいての おもさで 決まり、おもさは 持って いる。
 *  - 一撃必殺と、いりょくが 決め打ちの わざ（じわれ・ソニックブーム・ちきゅうなげ）。
 *    ダメージが この 式から 出ない。
 */
const MOVES: readonly Move[] = [
  { name: 'おうふくビンタ', type: 'normal', power: 15 },
  { name: 'みだれづき', type: 'normal', power: 15 },
  { name: 'れんぞくパンチ', type: 'normal', power: 18 },
  { name: 'たいあたり', type: 'normal', power: 35 },
  { name: 'いびき', type: 'normal', power: 40 },
  { name: 'でんこうせっか', type: 'normal', power: 40 },
  { name: 'ねこだまし', type: 'normal', power: 40 },
  { name: 'ねこにこばん', type: 'normal', power: 40 },
  { name: 'はたく', type: 'normal', power: 40 },
  { name: 'ひっかく', type: 'normal', power: 40 },
  { name: 'みねうち', type: 'normal', power: 40 },
  { name: 'いあいぎり', type: 'normal', power: 50 },
  { name: 'はさむ', type: 'normal', power: 55 },
  { name: 'スピードスター', type: 'normal', power: 60 },
  { name: 'つのでつく', type: 'normal', power: 65 },
  { name: 'ふみつけ', type: 'normal', power: 65 },
  { name: 'きりさく', type: 'normal', power: 70 },
  { name: 'ずつき', type: 'normal', power: 70 },
  { name: 'かいりき', type: 'normal', power: 80 },
  { name: 'しんそく', type: 'normal', power: 80 },
  { name: 'たたきつける', type: 'normal', power: 80 },
  { name: 'トライアタック', type: 'normal', power: 80 },
  { name: 'メガトンパンチ', type: 'normal', power: 80 },
  { name: 'のしかかり', type: 'normal', power: 85 },
  { name: 'とっしん', type: 'normal', power: 90 },
  { name: 'たまごばくだん', type: 'normal', power: 100 },
  { name: 'ロケットずつき', type: 'normal', power: 100 },
  { name: 'すてみタックル', type: 'normal', power: 120 },
  { name: 'メガトンキック', type: 'normal', power: 120 },
  { name: 'はかいこうせん', type: 'normal', power: 150 },
  { name: 'ひのこ', type: 'fire', power: 40 },
  { name: 'かえんぐるま', type: 'fire', power: 60 },
  { name: 'ほのおのパンチ', type: 'fire', power: 75 },
  { name: 'ブレイズキック', type: 'fire', power: 85 },
  { name: 'かえんほうしゃ', type: 'fire', power: 95 },
  { name: 'ヒートウェーブ', type: 'fire', power: 100 },
  { name: 'だいもんじ', type: 'fire', power: 120 },
  { name: 'オーバーヒート', type: 'fire', power: 140 },
  { name: 'あわ', type: 'water', power: 20 },
  { name: 'みずでっぽう', type: 'water', power: 40 },
  { name: 'ダイビング', type: 'water', power: 60 },
  { name: 'みずのはどう', type: 'water', power: 60 },
  { name: 'バブルこうせん', type: 'water', power: 65 },
  { name: 'たきのぼり', type: 'water', power: 80 },
  { name: 'クラブハンマー', type: 'water', power: 90 },
  { name: 'なみのり', type: 'water', power: 95 },
  { name: 'ハイドロポンプ', type: 'water', power: 120 },
  { name: 'でんきショック', type: 'electric', power: 40 },
  { name: 'でんげきは', type: 'electric', power: 60 },
  { name: 'スパーク', type: 'electric', power: 65 },
  { name: 'かみなりパンチ', type: 'electric', power: 75 },
  { name: '10まんボルト', type: 'electric', power: 95 },
  { name: 'でんじほう', type: 'electric', power: 100 },
  { name: 'かみなり', type: 'electric', power: 120 },
  { name: 'すいとる', type: 'grass', power: 20 },
  { name: 'つるのムチ', type: 'grass', power: 35 },
  { name: 'メガドレイン', type: 'grass', power: 40 },
  { name: 'はっぱカッター', type: 'grass', power: 55 },
  { name: 'ギガドレイン', type: 'grass', power: 60 },
  { name: 'ニードルアーム', type: 'grass', power: 60 },
  { name: 'マジカルリーフ', type: 'grass', power: 60 },
  { name: 'はなびらのまい', type: 'grass', power: 70 },
  { name: 'リーフブレード', type: 'grass', power: 70 },
  { name: 'ソーラービーム', type: 'grass', power: 120 },
  { name: 'こなゆき', type: 'ice', power: 40 },
  { name: 'こごえるかぜ', type: 'ice', power: 55 },
  { name: 'オーロラビーム', type: 'ice', power: 65 },
  { name: 'れいとうパンチ', type: 'ice', power: 75 },
  { name: 'れいとうビーム', type: 'ice', power: 95 },
  { name: 'ふぶき', type: 'ice', power: 120 },
  { name: 'いわくだき', type: 'fight', power: 20 },
  // いりょく 0 は「ここでは 決まらない」の しるし。けたぐりは あいての おもさで 決まる。
  { name: 'けたぐり', type: 'fight', power: 0 },
  { name: 'にどげり', type: 'fight', power: 30 },
  { name: 'マッハパンチ', type: 'fight', power: 40 },
  { name: 'からてチョップ', type: 'fight', power: 50 },
  { name: 'まわしげり', type: 'fight', power: 60 },
  { name: 'リベンジ', type: 'fight', power: 60 },
  { name: 'とびげり', type: 'fight', power: 70 },
  { name: 'かわらわり', type: 'fight', power: 75 },
  { name: 'じごくぐるま', type: 'fight', power: 80 },
  { name: 'スカイアッパー', type: 'fight', power: 85 },
  { name: 'とびひざげり', type: 'fight', power: 85 },
  { name: 'クロスチョップ', type: 'fight', power: 100 },
  { name: 'ばくれつパンチ', type: 'fight', power: 100 },
  { name: 'きあいパンチ', type: 'fight', power: 150 },
  { name: 'どくばり', type: 'poison', power: 15 },
  { name: 'ヘドロこうげき', type: 'poison', power: 65 },
  { name: 'ヘドロばくだん', type: 'poison', power: 90 },
  { name: 'どろかけ', type: 'ground', power: 20 },
  { name: 'あなをほる', type: 'ground', power: 60 },
  { name: 'じしん', type: 'ground', power: 100 },
  { name: 'つつく', type: 'flying', power: 35 },
  { name: 'エアカッター', type: 'flying', power: 55 },
  { name: 'つばさでうつ', type: 'flying', power: 60 },
  { name: 'つばめがえし', type: 'flying', power: 60 },
  { name: 'そらをとぶ', type: 'flying', power: 70 },
  { name: 'ドリルくちばし', type: 'flying', power: 80 },
  { name: 'ゴッドバード', type: 'flying', power: 140 },
  { name: 'ねんりき', type: 'psychic', power: 50 },
  { name: 'サイケこうせん', type: 'psychic', power: 65 },
  { name: 'みらいよち', type: 'psychic', power: 80 },
  { name: 'サイコキネシス', type: 'psychic', power: 90 },
  { name: 'ゆめくい', type: 'psychic', power: 100 },
  { name: 'サイコブースト', type: 'psychic', power: 140 },
  { name: 'れんぞくぎり', type: 'bug', power: 10 },
  { name: 'ミサイルばり', type: 'bug', power: 14 },
  { name: 'きゅうけつ', type: 'bug', power: 20 },
  { name: 'ぎんいろのかぜ', type: 'bug', power: 60 },
  { name: 'シグナルビーム', type: 'bug', power: 75 },
  { name: 'メガホーン', type: 'bug', power: 120 },
  { name: 'ロックブラスト', type: 'rock', power: 25 },
  { name: 'ころがる', type: 'rock', power: 30 },
  { name: 'いわおとし', type: 'rock', power: 50 },
  { name: 'がんせきふうじ', type: 'rock', power: 50 },
  { name: 'げんしのちから', type: 'rock', power: 60 },
  { name: 'いわなだれ', type: 'rock', power: 75 },
  { name: 'したでなめる', type: 'ghost', power: 20 },
  { name: 'シャドーボール', type: 'ghost', power: 80 },
  { name: 'りゅうのいぶき', type: 'dragon', power: 60 },
  { name: 'ドラゴンクロー', type: 'dragon', power: 80 },
  { name: 'げきりん', type: 'dragon', power: 90 },
  { name: 'どろぼう', type: 'dark', power: 40 },
  { name: 'かみつく', type: 'dark', power: 60 },
  { name: 'だましうち', type: 'dark', power: 60 },
  { name: 'かみくだく', type: 'dark', power: 80 },
  { name: 'メタルクロー', type: 'steel', power: 50 },
  { name: 'はがねのつばさ', type: 'steel', power: 70 },
  { name: 'アイアンテール', type: 'steel', power: 100 },
  { name: 'コメットパンチ', type: 'steel', power: 100 },
  { name: 'はめつのねがい', type: 'steel', power: 120 },
];

/** なまえ引き。じぶんで かく とき、なまえを 書いたら いりょくと タイプを 入れるのに 使う。 */
const MOVE_BY_NAME = new Map(MOVES.map((m) => [m.name, m]));

// ── もちもの ──────────────────────────────────────────────────────────

type StatSlot = 'atk' | 'def' | 'spa' | 'spd';

type Item = {
  readonly name: string;
  /** わざの タイプが これと 同じ なら、ダメージが 1.1倍に なる。 */
  readonly boostType?: TypeKey;
  /** のうりょくに かかる もの。どれに かかるかと、何倍か。 */
  readonly stat?: readonly StatSlot[];
  readonly mul?: number;
  /** その ポケモンの ときだけ きく（図鑑番号）。書いて なければ だれでも。 */
  readonly only?: readonly number[];
};

/**
 * 第3世代で ダメージに きく もちもの。
 *
 * タイプを つよくする 17個は 1.1倍。第4世代から 1.2倍に なるので、ここが ちがう。
 * のうりょくに かかる ものは、その 子の ときだけ きく ものが 多い——ふといホネは
 * カラカラと ガラガラ、でんきだまは ピカチュウ、という ぐあい。
 *
 * ダメージに きかない もの（きのみ・せんせいのツメ・ひかりのこな など）は 入れて
 * いない。えらべるのに 数が 動かないと、きいて いないのか 書きまちがえたのかが
 * 分からなくなる。
 */
const ITEMS: readonly Item[] = [
  { name: 'シルクのスカーフ', boostType: 'normal' },
  { name: 'もくたん', boostType: 'fire' },
  { name: 'しんぴのしずく', boostType: 'water' },
  { name: 'じしゃく', boostType: 'electric' },
  { name: 'きせきのタネ', boostType: 'grass' },
  { name: 'とけないこおり', boostType: 'ice' },
  { name: 'くろおび', boostType: 'fight' },
  { name: 'どくバリ', boostType: 'poison' },
  { name: 'やわらかいすな', boostType: 'ground' },
  { name: 'するどいくちばし', boostType: 'flying' },
  { name: 'まがったスプーン', boostType: 'psychic' },
  { name: 'ぎんのこな', boostType: 'bug' },
  { name: 'かたいいし', boostType: 'rock' },
  { name: 'のろいのおふだ', boostType: 'ghost' },
  { name: 'りゅうのキバ', boostType: 'dragon' },
  { name: 'くろいメガネ', boostType: 'dark' },
  { name: 'メタルコート', boostType: 'steel' },
  { name: 'こだわりハチマキ', stat: ['atk'], mul: 1.5 },
  { name: 'ふといホネ', stat: ['atk'], mul: 2, only: [104, 105] },
  { name: 'でんきだま', stat: ['spa'], mul: 2, only: [25] },
  { name: 'しんかいのキバ', stat: ['spa'], mul: 2, only: [366] },
  { name: 'しんかいのウロコ', stat: ['spd'], mul: 2, only: [366] },
  { name: 'メタルパウダー', stat: ['def'], mul: 2, only: [132] },
  { name: 'こころのしずく', stat: ['spa', 'spd'], mul: 1.5, only: [380, 381] },
];

/**
 * けたぐりの いりょく。あいての おもさ（kg）で 決まる。
 *
 * 第1・第2世代は 50 で 決め打ちだったが、第3世代から この かたちに なった。
 */
const lowKickPower = (weightKg: number): number => {
  if (weightKg < 10) return 20;
  if (weightKg < 25) return 40;
  if (weightKg < 50) return 60;
  if (weightKg < 100) return 80;
  if (weightKg < 200) return 100;
  return 120;
};

/** いりょくが 書いて ない わざ（0）を、その 場面の 数に する。 */
const powerFor = (move: Move, target: Mon): number =>
  move.power > 0 ? move.power : lowKickPower(target.weight);

/**
 * ダメージに きく とくせい（第3世代）。
 *
 * ここに 無い ものは、ダメージの 計算には 出て こない（ねむらない・すばやさが 上がる
 * など）。出て こないから 間違いという ことでは なく、この どうぐが 見て いる のが
 * ダメージ だけ という こと。
 *
 * 入れて いない もの。しんりょく・もうか・げきりゅう・むしのしらせ は 残りHPで、
 * こんじょう は 状態異常で 変わる。どちらも この どうぐが 持って いない。
 */
type AbilityEffect = {
  /** この タイプの わざが きかない。 */
  readonly immune?: readonly TypeKey[];
  /** この タイプの わざが 半分に なる。 */
  readonly half?: readonly TypeKey[];
  /** こうげき などに かかる。 */
  readonly stat?: readonly StatSlot[];
  readonly mul?: number;
  /** 音の わざが きかない。 */
  readonly soundproof?: true;
  /** こうかばつぐん の わざ いがい きかない。 */
  readonly wonderGuard?: true;
  /** てんきの ぶんを 消す。 */
  readonly noWeather?: true;
};

const ABILITY: Record<string, AbilityEffect> = {
  ふゆう: { immune: ['ground'] },
  もらいび: { immune: ['fire'] },
  ちょすい: { immune: ['water'] },
  ちくでん: { immune: ['electric'] },
  あついしぼう: { half: ['fire', 'ice'] },
  ふしぎなまもり: { wonderGuard: true },
  ぼうおん: { soundproof: true },
  ちからもち: { stat: ['atk'], mul: 2 },
  ヨガパワー: { stat: ['atk'], mul: 2 },
  はりきり: { stat: ['atk'], mul: 1.5 },
  ノーてんき: { noWeather: true },
  エアロック: { noWeather: true },
};

/** ぼうおんが 止める 音の わざ。この 一覧に あるのは いびき だけ。 */
const SOUND_MOVES: ReadonlySet<string> = new Set(['いびき']);

/** じぶんで かく ポケモンに 持たせられる とくせい。ダメージに きく ものだけ。 */
const ABILITY_NAMES: readonly string[] = Object.keys(ABILITY);

/** その とくせいが 何を するか、一言で。ダメージに きかない ものは 空。 */
const abilityWord = (name: string): string => {
  const e = ABILITY[name];
  if (!e) return '';
  if (e.immune) return `${e.immune.map((t) => TYPE_NAME[t]).join('・')} の わざが きかない`;
  if (e.half) return `${e.half.map((t) => TYPE_NAME[t]).join('・')} の わざが はんぶんに なる`;
  if (e.wonderGuard) return 'こうかバツグン の わざ いがい きかない';
  if (e.soundproof) return '音の わざ（いびき）が きかない';
  if (e.noWeather) return 'てんきの ぶんが きえる';
  if (e.stat) return `${e.stat.map((k) => STAT_NAME[k]).join('と')} が ${e.mul ?? 1}倍に なる`;
  return '';
};

/** その もちものが、その ポケモンに きくか。 */
const itemWorks = (item: Item | null, mon: Mon): boolean =>
  item !== null && (item.only === undefined || item.only.includes(mon.no));

// ── 実数（ステータス）────────────────────────────────────────────────

/**
 * HP の じっすう。
 *
 * しゅぞくちの HP が 1 の子（ヌケニン）だけは、レベルも どりょくも 関係なく いつも 1。
 * ゲームの 決まりが そう なって いるので、式の 外に 出して ある。
 */
const statHp = (base: number, level: number, iv: number, ev: number): number =>
  base === 1 ? 1 : Math.floor(((base * 2 + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;

/** nature は せいかくの ぶん（1.1 / 1.0 / 0.9）。 */
const statOther = (
  base: number, level: number, iv: number, ev: number, nature: number,
): number =>
  Math.floor((Math.floor(((base * 2 + iv + Math.floor(ev / 4)) * level) / 100) + 5) * nature);

/** ランク（-6〜+6）の かけ算。上げるのと 下げるのは 式が ちがう。 */
const rankMul = (rank: number): number => (rank >= 0 ? (2 + rank) / 2 : 2 / (2 - rank));

// ── ダメージ ──────────────────────────────────────────────────────────

type Input = {
  readonly level: number;
  readonly power: number;
  readonly atk: number;
  readonly def: number;
  /** タイプ一致（じぶんと おなじ タイプの わざ）なら 1.5。 */
  readonly stab: boolean;
  /** タイプ相性。1つずつ かけて、そのつど きりすてる。 */
  readonly typeSteps: readonly number[];
  readonly crit: boolean;
  /** タイプを つよくする もちものの ぶん。1.1 か 1。 */
  readonly item: number;
  /** てんきの ぶん。1.5 / 1 / 0.5。 */
  readonly weather: number;
  /** やけど。物理の ときだけ 0.5。 */
  readonly burn: boolean;
  /** かべ（リフレクター・ひかりのかべ）。かかって いれば 0.5。 */
  readonly screen: boolean;
};

/**
 * 85〜100 の 16通りを 小さい順に かえす。第3世代の 順。
 *
 * もとの数 → かべ → てんき → やけど → ＋2 → きゅうしょ(×2) → もちもの → らんすう →
 * タイプ一致 → タイプ相性。いまの作品は ＋2 を 先に 足して きゅうしょを ×1.5 に
 * するので、おなじ 場面でも 数が ずれる。
 */
const damages = (inp: Input): number[] => {
  if (inp.typeSteps.some((s) => s === 0)) return new Array<number>(16).fill(0);

  const level = Math.floor((inp.level * 2) / 5 + 2);
  const core = Math.floor(Math.floor((level * inp.power * inp.atk) / inp.def) / 50);

  let fixed = core;
  // きゅうしょに あたると、かべは 無かった ことに なる。
  if (inp.screen && !inp.crit) fixed = Math.floor(fixed * 0.5);
  fixed = Math.floor(fixed * inp.weather);
  if (inp.burn) fixed = Math.floor(fixed * 0.5);
  fixed = Math.max(1, fixed) + 2;
  if (inp.crit) fixed *= 2;
  fixed = Math.floor(fixed * inp.item);

  const out: number[] = [];
  for (let r = 85; r <= 100; r += 1) {
    let d = Math.floor((fixed * r) / 100);
    if (inp.stab) d = Math.floor(d * 1.5);
    for (const step of inp.typeSteps) d = Math.floor(d * step);
    // 相性が 0 でない かぎり、ダメージは すくなくとも 1。
    out.push(Math.max(1, d));
  }
  return out;
};

/** 相性の 言いかた。 */
const effectWord = (mul: number): string => {
  if (mul === 0) return 'こうかが ない みたいだ…（0ばい）';
  if (mul >= 4) return 'こうかは バツグンだ！（4ばい）';
  if (mul >= 2) return 'こうかは バツグンだ！（2ばい）';
  if (mul <= 0.25) return 'こうかは いまひとつ…（0.25ばい）';
  if (mul <= 0.5) return 'こうかは いまひとつ…（0.5ばい）';
  return 'ふつうの こうか（1ばい）';
};

// ── 画面 ──────────────────────────────────────────────────────────────

const CSS = `
.pd{position:absolute;inset:0;overflow-y:auto;background:linear-gradient(#1e3a8a,#0f172a);
  color:#1f2937;box-sizing:border-box;padding:10px 8px 28px;
  font:14px/1.7 'Hiragino Maru Gothic ProN','Arial Rounded MT Bold',system-ui,sans-serif;
  -webkit-text-size-adjust:100%}
.pd-app{max-width:940px;margin:0 auto}
.pd-lead{background:rgba(255,253,247,.9);border-radius:12px;padding:8px 12px;margin:0 0 12px;
  font-size:.74rem;line-height:1.7;color:#78350f;box-sizing:border-box}
/* 出し入れする ところは hidden で ふせる。.pd-row に display:flex を 当てて いるので、
   これが 無いと ブラウザが もつ [hidden] の 既定を 上書きして しまって 消えない。 */
.pd [hidden]{display:none!important}
.pd-card{background:#fffdf7;border:4px solid #78350f;border-radius:18px;
  box-shadow:0 8px 0 rgba(0,0,0,.35);padding:12px;margin-bottom:12px;box-sizing:border-box}
.pd-card h2{margin:0 0 8px;font-size:.95rem;color:#78350f;display:flex;align-items:center;gap:6px}
/* 2つを ならべる。入れ物が せまければ たてに、ひろければ 左右に。
   画面の はばを 見る 書き方（メディアクエリ）だと、ゲームの 置き場が 画面より
   せまい ときに 2列に なって、はみ出す。入る だけ ならべる 書き方に して ある。 */
.pd-parties{display:grid;grid-template-columns:repeat(auto-fit,minmax(20rem,1fr));
  gap:0 12px;align-items:start}
.pd-parties>.pd-card{min-width:0}
.pd-role{margin-left:auto;background:#e7e5e4;color:#78350f;font-size:.66rem;font-weight:700;
  padding:1px 9px;border-radius:999px}
.pd-role.atk{background:#f59e0b;color:#fff;text-shadow:1px 1px 1px rgba(0,0,0,.25)}

.pd-card h3{margin:12px 0 6px;font-size:.76rem;color:#78350f;border-top:2px dotted #d6d3d1;
  padding-top:8px}
.pd-row{display:flex;align-items:center;gap:8px;margin-bottom:7px}
.pd-row>label{flex:0 0 5.6rem;font-size:.76rem;color:#78350f;font-weight:700}
.pd-row>select,.pd-row>input{flex:1 1 auto;min-width:0;background:#fff;border:2px solid #b45309;
  border-radius:10px;padding:5px 8px;font:inherit;font-size:.82rem;color:#1f2937}
.pd-row>input.num{flex:0 0 4.6rem}
/* わざは 2行目に 送る。1行に 押しこむと「たいあたり 35」が「たいあたり 3」で
   切れて、いりょく 3 の わざに 見える。 */
.pd-slot{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin-bottom:9px}
.pd-slot input[type=radio]{flex:0 0 auto;width:18px;height:18px;accent-color:#b45309;margin:0}
.pd-slot select{flex:1 1 auto;min-width:0;background:#fff;border:2px solid #b45309;
  border-radius:9px;padding:4px 5px;font:inherit;font-size:.76rem;color:#1f2937}
.pd-mvrow{display:flex;align-items:center;gap:6px;margin-bottom:5px}
.pd-mvrow input[type=radio]{flex:0 0 auto;width:17px;height:17px;accent-color:#b45309;margin:0}
.pd-mvrow .k{flex:0 0 2.6rem;font-size:.72rem;color:#78350f;font-weight:700}
.pd-mvrow select{flex:1 1 auto;min-width:0;background:#fff;border:2px solid #b45309;
  border-radius:9px;padding:4px 6px;font:inherit;font-size:.78rem;color:#1f2937}
.pd-slot input.lv{flex:0 0 2.9rem;background:#fff;border:2px solid #b45309;border-radius:9px;
  padding:4px 3px;font:inherit;font-size:.76rem;text-align:center;color:#1f2937}
.pd-slot .x{flex:0 0 auto;background:none;border:0;color:#b45309;font:inherit;font-size:.9rem;
  cursor:pointer;padding:0 2px}
.pd-slot .x:disabled{opacity:.25;cursor:default}
.pd-add{background:#e7e5e4;color:#78350f;border:0;border-bottom:3px solid #a8a29e;
  border-radius:999px;padding:3px 12px;font:inherit;font-size:.74rem;font-weight:700;cursor:pointer}
.pd-add:disabled{opacity:.4;cursor:default}
.pd-chips{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 6px}
.pd-chip{color:#fff;font-size:.68rem;font-weight:700;padding:1px 9px;border-radius:999px;
  text-shadow:1px 1px 1px rgba(0,0,0,.25)}
.pd-sub{font-size:.72rem;color:#6b7280;margin:2px 0 0}
.pd-seed{display:flex;flex-wrap:wrap;gap:2px 9px;font-size:.7rem;color:#9ca3af;margin:0 0 7px}
.pd-seed .k{color:#9ca3af}
.pd-seed b{color:#78350f;font-weight:700;font-variant-numeric:tabular-nums}
.pd-seed .on .k,.pd-seed .on b{color:#b45309}
.pd-seed .on b{text-decoration:underline}
.pd-own{background:#fff7ed;border:2px dashed #b45309;border-radius:12px;padding:8px;margin:0 0 8px}
.pd-own .pd-row:last-child{margin-bottom:0}
.pd-own .pd-row>label{flex:0 0 4.6rem}
.pd-base{display:flex;flex-wrap:wrap;gap:6px;flex:1 1 auto;min-width:0}
.pd-base div{flex:1 1 4.2rem;min-width:4.2rem}
.pd-base span{display:block;font-size:.66rem;color:#78350f;font-weight:700;margin-bottom:2px}
.pd-base input{width:100%;box-sizing:border-box;background:#fff;border:2px solid #b45309;
  border-radius:8px;padding:4px 6px;font:inherit;font-size:.8rem;color:#1f2937}
.pd-hint{font-size:.7rem;color:#92400e;margin:0 0 6px;line-height:1.6}
.pd-checks{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:4px}
.pd-checks label{font-size:.78rem;color:#78350f;font-weight:700;display:flex;align-items:center;gap:4px}
.pd-checks input{width:17px;height:17px;accent-color:#b45309}
.pd-out{background:#fff7ed;border:3px dashed #b45309;border-radius:14px;padding:10px;text-align:center}
.pd-eff{font-size:.84rem;font-weight:700;color:#b45309;margin:0 0 6px}
.pd-big{font-size:1.5rem;font-weight:700;color:#78350f;margin:0;line-height:1.3}
.pd-big small{font-size:.8rem;color:#6b7280;font-weight:400}
.pd-pct{font-size:.86rem;color:#1f2937;margin:4px 0 0}
.pd-ko{font-size:.86rem;font-weight:700;color:#b91c1c;margin:8px 0 0}
.pd-bar{height:14px;background:#e5e7eb;border:2px solid #78350f;border-radius:999px;
  overflow:hidden;margin:8px 0 0;position:relative}
.pd-bar i{position:absolute;left:0;top:0;bottom:0;display:block}
.pd-bar i.max{background:#fca5a5}
.pd-bar i.min{background:#f59e0b}
.pd-table{width:100%;border-collapse:collapse;font-size:.74rem;margin-top:8px}
.pd-table th,.pd-table td{border-bottom:1px solid #e5e7eb;padding:3px 4px;text-align:left;color:#374151}
.pd-table td.num{text-align:right;font-variant-numeric:tabular-nums}
.pd-mx{overflow-x:auto}
.pd-mx table{border-collapse:collapse;font-size:.82rem;min-width:100%}
.pd-mx th,.pd-mx td{border:1px solid #e5e7eb;padding:3px 8px;text-align:center;white-space:nowrap;
  line-height:1.25}
.pd-mx th{color:#78350f;font-weight:700;background:#fffdf7}
/* 名前の はしらは 横に ながしても 残す。わざの 行が 多いので、どの子の 行かを 見失う。
   せめる がわの 2列（名前・わざ）は、ますの すうじより ひとまわり 小さくして おく。
   見たいのは「何はつ」の ほうで、ここは その 見出し。 */
.pd-mx th.rh{text-align:left;position:sticky;left:0;z-index:2;min-width:4.6rem;
  padding:3px 6px;vertical-align:top;white-space:normal}
.pd-mx th.rh .nm{font-weight:700;font-size:.76rem}
.pd-mx th.mh{text-align:left;font-weight:400;color:#6b7280;font-size:.7rem;padding:3px 6px}
.pd-mx th.mh.on{color:#b45309;font-weight:700}
.pd-mx td{cursor:pointer;font-variant-numeric:tabular-nums}
.pd-mx td b{display:block;font-size:1rem;color:#78350f;line-height:1.15}
.pd-mx td small{display:block;color:#6b7280;font-size:.72rem;line-height:1.1}
.pd-mx td.k1{background:#fecaca}
.pd-mx td.k2{background:#fed7aa}
.pd-mx td.k3{background:#fef9c3}
.pd-mx td.k0{background:#e5e7eb;color:#9ca3af}
.pd-mx td.sel{outline:3px solid #b45309;outline-offset:-3px}
.pd-note{font-size:.7rem;color:#6b7280;line-height:1.7;margin:0 0 6px}
.pd-note:last-child{margin-bottom:0}
.pd-swap{background:#64748b;color:#fff;border:0;border-bottom:4px solid #334155;border-radius:12px;
  padding:.45rem .9rem;font:inherit;font-size:.78rem;font-weight:700;cursor:pointer;width:100%;
  text-shadow:1px 1px 2px rgba(0,0,0,.3)}
.pd-swap:active{transform:translateY(2px);border-bottom-width:2px}
`;

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

type Opt = { readonly value: string; readonly label: string };

const fill = (node: HTMLSelectElement, options: readonly Opt[], value: string): void => {
  node.replaceChildren(...options.map((o) => {
    const opt = el('option');
    opt.value = o.value;
    opt.textContent = o.label;
    return opt;
  }));
  node.value = value;
};

const select = (options: readonly Opt[], value: string): HTMLSelectElement => {
  const node = el('select');
  fill(node, options, value);
  return node;
};

const row = (label: string, ...controls: readonly HTMLElement[]): HTMLElement => {
  const r = el('div', 'pd-row');
  r.appendChild(el('label', undefined, label));
  for (const c of controls) r.appendChild(c);
  return r;
};

/**
 * 入れた すうじを よむ。
 *
 * 空に したときと 0 を 入れたときを 分ける。`Number(raw) || fallback` で 済ませると、
 * 0 が うその値（falsy）なので、0 を 入れた人に 既定が 返る——入れた数と 出た数が
 * 合わなくなる。空なら 既定に もどし、0 なら 下限まで 下げる。
 */
const readNum = (raw: string, fallback: number, lo: number, hi: number): number => {
  if (raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(n)));
};

/** 一覧の いちばん上に 置く「じぶんで かく」。図鑑番号と ぶつからない値にする。 */
const OWN = 'own';

const pad = (n: number): string => String(n).padStart(3, '0');

const MON_BY_NO = new Map(MONS.map((m) => [String(m.no), m]));

const monOptions: readonly Opt[] = MONS.map((m) => ({
  value: String(m.no), label: `${pad(m.no)} ${m.name}`,
}));

/**
 * ひらがなを カタカナに する。
 *
 * ポケモンの 名前は カタカナ なので、「みずごろう」と 打つと 1つも 当たらない。
 * 打つ方に 合わせる ほうが 筋が いい——探して いる 子に「カタカナで 打ち直して」とは
 * 言えない。
 */
const kata = (text: string): string =>
  text.replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

/** 地方の くぎり。全国図鑑の 番号で 決まって いる。 */
const REGIONS: readonly { readonly name: string; readonly last: number }[] = [
  { name: 'カントー（赤・緑・ファイアレッド）', last: 151 },
  { name: 'ジョウト（金・銀）', last: 251 },
  { name: 'ホウエン（ルビー・サファイア・エメラルド）', last: 386 },
];

/**
 * ポケモンの 一覧を 地方ごとに まとめる。
 *
 * 386匹を 1列に ならべると、ホウエンの ポケモンは ずっと 下に いて、そこまで ある
 * ことに 気づけない。くぎりを 出せば、下に まだ ある ことが 見えるし、しぼりこんだ
 * ときも どの 地方の 子が 残ったかが 分かる。
 */
const fillMons = (node: HTMLSelectElement, options: readonly Opt[], value: string): void => {
  const own = el('option');
  own.value = OWN;
  own.textContent = '✏️ じぶんで かく';
  const parts: HTMLElement[] = [own];
  let from = 1;
  for (const region of REGIONS) {
    const group = el('optgroup');
    group.label = region.name;
    for (const o of options) {
      const no = Number(o.value);
      if (no < from || no > region.last) continue;
      const opt = el('option');
      opt.value = o.value;
      opt.textContent = o.label;
      group.appendChild(opt);
    }
    if (group.childElementCount) parts.push(group);
    from = region.last + 1;
  }
  node.replaceChildren(...parts);
  node.value = value;
};
const typeOptions: readonly Opt[] = TYPE_ORDER.map((t) => ({ value: t, label: TYPE_NAME[t] }));
const typeOptionsWithNone: readonly Opt[] = [{ value: '', label: 'なし' }, ...typeOptions];
const rankOptions: readonly Opt[] = [6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6].map((r) => ({
  value: String(r),
  label: r === 0 ? '± 0' : r > 0 ? `+ ${r}` : `− ${-r}`,
}));
const evOptions: readonly Opt[] = [
  { value: '0', label: '0（ぼうけん中は だいたい これ）' },
  { value: '128', label: '128（そこそこ）' },
  { value: '252', label: '252（めいっぱい）' },
];
/**
 * こたいちは 1匹ずつ ばらばらで、ゲームの 中では 見えない。
 *
 * だから ここで 出す すうじは「だいたい」に しか ならない。ぴったり 合わせたい ときは、
 * ゲームの がめんの すうじを そのまま 書く方に する。
 */
const ivOptions: readonly Opt[] = [
  { value: '31', label: '31（いちばん よい）' },
  { value: '15', label: '15（まんなか）' },
  { value: '0', label: '0（いちばん ひくい）' },
];
const natureOptions: readonly Opt[] = [
  { value: '1.1', label: 'あがる（× 1.1）' },
  { value: '1', label: 'ふつう（× 1.0）' },
  { value: '0.9', label: 'さがる（× 0.9）' },
];
/** もちものの えらびかた。きき方で 2つに わけて ならべる。 */
const fillItems = (node: HTMLSelectElement, value: string): void => {
  const none = el('option');
  none.value = '';
  none.textContent = 'なし';
  const byType = el('optgroup');
  byType.label = 'タイプを つよくする（× 1.1）';
  const byStat = el('optgroup');
  byStat.label = 'のうりょくに かかる';
  ITEMS.forEach((it, i) => {
    const opt = el('option');
    opt.value = String(i);
    if (it.boostType) {
      opt.textContent = `${it.name}（${TYPE_NAME[it.boostType]}）`;
      byType.appendChild(opt);
    } else {
      opt.textContent = `${it.name}（× ${it.mul ?? 1}）`;
      byStat.appendChild(opt);
    }
  });
  node.replaceChildren(none, byType, byStat);
  node.value = value;
};

const sourceOptions: readonly Opt[] = [
  { value: 'calc', label: 'しゅぞくちから 出す（だいたい）' },
  { value: 'typed', label: 'ゲームの がめんを 見て 書く（ぴったり）' },
];

const STAT_LABEL = ['HP', 'こうげき', 'ぼうぎょ', 'とくこう', 'とくぼう'] as const;

/**
 * えらんだ ポケモンの しゅぞくちを ならべる。
 *
 * しゅぞくちは その ポケモンに はじめから 決まって いる すうじで、図鑑にも ゲームの
 * 画面にも 出て こない。ここに 出さないと、じぶんで かく ときに 何を 書けば いいか
 * 分からないし、出た ダメージが どこから 来たのかも たどれない。
 */
const seedRow = (mon: Mon, used: readonly number[]): HTMLElement => {
  const box = el('div', 'pd-seed');
  box.appendChild(el('span', 'k', 'しゅぞくち'));
  mon.base.forEach((v, i) => {
    const item = el('span', used.includes(i) ? 'on' : undefined);
    item.append(el('span', 'k', `${STAT_LABEL[i]} `), el('b', undefined, String(v)));
    box.appendChild(item);
  });
  return box;
};

const typeChips = (types: readonly TypeKey[]): HTMLElement => {
  const box = el('div', 'pd-chips');
  for (const t of types) {
    const chip = el('span', 'pd-chip', TYPE_NAME[t]);
    chip.style.background = TYPE_COLOR[t];
    box.appendChild(chip);
  }
  return box;
};

const numInput = (cls: string, value: string, min: number, max: number): HTMLInputElement => {
  const node = el('input', cls);
  node.type = 'number';
  node.min = String(min);
  node.max = String(max);
  node.value = value;
  return node;
};

/**
 * わざの 一覧を タイプごとに まとめる。
 *
 * 130本を 1列に ならべると 探せない。まとめると ついでに、どの タイプが 物理で
 * どれが 特殊かも 見える——第3世代は そこが わざ ではなく タイプで 決まるので、
 * いまの作品から 来た人が いちばん まちがえる ところ。
 */
const fillMoves = (node: HTMLSelectElement, value: string): void => {
  const none = el('option');
  none.value = '';
  none.textContent = '—（まだ きめて いない）';
  const own = el('option');
  own.value = OWN;
  own.textContent = '✏️ じぶんで かく';
  const parts: HTMLElement[] = [none, own];
  for (const t of TYPE_ORDER) {
    const group = el('optgroup');
    group.label = `${TYPE_NAME[t]}（${isPhysical(t) ? '物理' : '特殊'}）`;
    MOVES.forEach((m, i) => {
      if (m.type !== t) return;
      const opt = el('option');
      opt.value = String(i);
      opt.textContent = m.power > 0 ? `${m.name} ${m.power}` : `${m.name}（おもさで かわる）`;
      group.appendChild(opt);
    });
    if (group.childElementCount) parts.push(group);
  }
  node.replaceChildren(...parts);
  node.value = value;
};

// ── てもち ────────────────────────────────────────────────────────────

/**
 * てもちの 1匹。
 *
 * 両がわ おなじ 形に して ある。どちらが せめるかは、下の「むき」で 決める——
 * あいての わざで こちらが どれだけ 食らうかも、おなじ 表で 見たいため。
 */
type Slot = {
  readonly wrap: HTMLElement;
  readonly radio: HTMLInputElement;
  readonly monSel: HTMLSelectElement;
  readonly levelInput: HTMLInputElement;
  readonly del: HTMLButtonElement;
  /** 「じぶんで かく」を えらんだ ときの 中身。 */
  own: Mon;
  ownTouched: boolean;
  /** ゲームの がめんを 見て 書いた すうじ。HP・こうげき・ぼうぎょ・とくこう・とくぼう。 */
  typed: [number, number, number, number, number];
  typedTouched: boolean;
  /** わざ4つ。MOVES の 添字か OWN。まだ 決めて いなければ 空。 */
  moves: string[];
  /** いま つかう わざ（0〜3）。表の 名前の 下に 出て いる もの。 */
  active: number;
  /** わざ4つ ぶんの「じぶんで かく」の 中身。 */
  ownMoves: { name: string; type: TypeKey }[];
  /** わざ4つ ぶんの、手で 書きかえた いりょく。null なら わざの ままの いりょく。 */
  powers: (number | null)[];
  /** もちもの。ITEMS の 添字。持って いなければ 空。 */
  item: string;
  /** えらんで ある とくせいの なまえ。空なら その子の 1つめ。 */
  ability: string;
  /** 直前に えらんで いた 図鑑の ポケモン。「じぶんで かく」の 下じきに 使う。 */
  lastReal: Mon;
};

/** その がわ ぜんいんに かかる せってい。 */
type SideCtl = {
  readonly source: HTMLSelectElement;
  readonly iv: HTMLSelectElement;
  readonly hpEv: HTMLSelectElement;
  readonly ev: HTMLSelectElement;
  readonly nature: HTMLSelectElement;
  readonly rank: HTMLSelectElement;
};

const MAX_SLOTS = 6;

const monOf = (slot: Slot): Mon =>
  slot.monSel.value === OWN ? slot.own : MON_BY_NO.get(slot.monSel.value) ?? MONS[0]!;

const levelOf = (slot: Slot): number => readNum(slot.levelInput.value, 50, 1, 100);

/**
 * いま えらんで いる とくせい。
 *
 * なまえで 持って いるので、ポケモンを 変えた ときに その子が もたない とくせいが
 * 残らない——残ると、ゲンガーに あついしぼう が ついた ような 形に なる。
 */
const abilityOf = (slot: Slot, mon: Mon): string => {
  if (mon.abilities.length === 0) return slot.ability;
  if (mon.abilities.includes(slot.ability)) return slot.ability;
  return mon.abilities[0] ?? '';
};

const itemOf = (slot: Slot): Item | null =>
  slot.item === '' ? null : ITEMS[Number(slot.item)] ?? null;

const STAT_NAME: Record<StatSlot, string> = {
  atk: 'こうげき', def: 'ぼうぎょ', spa: 'とくこう', spd: 'とくぼう',
};

/**
 * その もちものが いま 何を して いるかを 一言で。
 *
 * きく 相手が 決まって いる ものを よその子に 持たせても、数は 1つも 動かない。
 * だまって いると「持たせたのに 変わらない」で 止まるので、きいて いない ことを
 * ここで 言う。
 */
const itemWord = (item: Item | null, mon: Mon): string => {
  if (!item) return '';
  if (!itemWorks(item, mon)) {
    const who = (item.only ?? []).map((n) => MON_BY_NO.get(String(n))?.name ?? '?').join('・');
    return `${item.name} は ${who} の ときだけ きく。いまは きいて いない。`;
  }
  if (item.boostType) return `${TYPE_NAME[item.boostType]} の わざが 1.1倍に なる。`;
  const where = (item.stat ?? []).map((k) => STAT_NAME[k]).join('と');
  return `${where} が ${item.mul ?? 1}倍に なる。`;
};

/** 決めて ある わざの 番号（0〜3）だけ。1つも 無ければ 空。 */
const filledMoves = (slot: Slot): number[] =>
  [0, 1, 2, 3].filter((i) => slot.moves[i] !== '' && slot.moves[i] !== undefined);

/** いま つかう わざの 番号。消して あれば、決めて ある いちばん 前の ものに 落ちる。 */
const activeIndex = (slot: Slot): number => {
  const filled = filledMoves(slot);
  if (filled.includes(slot.active)) return slot.active;
  return filled[0] ?? slot.active;
};

const moveAt = (slot: Slot, i: number): Move => {
  const value = slot.moves[i] ?? '';
  const power = slot.powers[i] ?? null;
  if (value === OWN) {
    const own = slot.ownMoves[i];
    return {
      name: own?.name.trim() || 'じぶんの わざ',
      type: own?.type ?? 'normal',
      power: power ?? 80,
    };
  }
  const m = MOVES[Number(value)] ?? MOVES[0]!;
  return power === null ? m : { ...m, power };
};

const moveOf = (slot: Slot): Move => moveAt(slot, activeIndex(slot));

/** しゅぞくちから 出した、その レベルの 5つ。ゲームの すうじの 下じきにも 使う。 */
const computedStats = (
  mon: Mon, level: number, iv: number,
): [number, number, number, number, number] => [
  statHp(mon.base[0], level, iv, 0),
  statOther(mon.base[1], level, iv, 0, 1),
  statOther(mon.base[2], level, iv, 0, 1),
  statOther(mon.base[3], level, iv, 0, 1),
  statOther(mon.base[4], level, iv, 0, 1),
];

export const mountPokeDamage: GameMount = (host, ctx) => {
  const style = el('style');
  style.textContent = CSS;

  const page = el('div', 'pd');
  const app = el('div', 'pd-app');
  page.appendChild(app);

  // どの 作品の 計算かを さきに 出す。一覧は 全国図鑑 ぜんぶ なので、その 作品で
  // つかまるかは 別の 話——ミュウは ファイアレッドでは つかまらない。
  // それでも 計算の しかたは この 5本で 同じ なので、どれで 遊んで いても 使える。
  app.appendChild(el('p', 'pd-lead',
    'ルビー・サファイア・エメラルド・ファイアレッド・リーフグリーン（第3世代）の'
    + ' ダメージを 出します。一覧は 全国図鑑 386匹ぜんぶ なので、その 作品で'
    + ' つかまえられるかは 別に 見てね。'));

  // ── しかけの 置き場 ────────────────────────────────────────────

  type SideKey = 'mine' | 'theirs';

  const slots: Record<SideKey, Slot[]> = { mine: [], theirs: [] };
  /** その がわに 1匹 足す。つづきからの 読み込みでも 使う。 */
  const adders = {} as Record<SideKey, (no: string, level: number, move: string, on: boolean) => Slot | null>;
  /** その がわの 行の 置き場。まとめて 消すのに 使う。 */
  const lists = {} as Record<SideKey, HTMLElement>;
  const ctl = {} as Record<SideKey, SideCtl>;
  const detail = {} as Record<SideKey, {
    readonly ownWrap: HTMLElement;
    readonly ownName: HTMLInputElement;
    readonly ownT1: HTMLSelectElement;
    readonly ownT2: HTMLSelectElement;
    readonly ownBase: readonly HTMLInputElement[];
    readonly ownWeight: HTMLInputElement;
    readonly types: HTMLElement;
    readonly seed: HTMLElement;
    readonly moveRadios: readonly HTMLInputElement[];
    readonly moveSels: readonly HTMLSelectElement[];
    readonly moveWrap: HTMLElement;
    readonly moveName: HTMLInputElement;
    readonly moveType: HTMLSelectElement;
    readonly powerRow: HTMLElement;
    readonly power: HTMLInputElement;
    readonly ability: HTMLSelectElement;
    readonly abilityNote: HTMLElement;
    readonly item: HTMLSelectElement;
    readonly itemNote: HTMLElement;
    readonly typedWrap: HTMLElement;
    readonly typedInputs: readonly HTMLInputElement[];
    readonly note: HTMLElement;
    readonly roleTag: HTMLElement;
    readonly ivRow: HTMLElement;
    readonly hpEvRow: HTMLElement;
    readonly evRow: HTMLElement;
    readonly natureRow: HTMLElement;
  }>;

  const chosen = (side: SideKey): Slot =>
    slots[side].find((s) => s.radio.checked) ?? slots[side][0]!;

  const isTyped = (side: SideKey): boolean => ctl[side].source.value === 'typed';

  /**
   * いま 下の「けいさん」に 出して いる のは どちらの こうげきか。
   *
   * えらびかた としては 出さない。総当たりの 表を 2つ（じぶんの こうげき・あいての
   * こうげき）出すので、見たい ますを 押せば そちらに 変わる。えらびかたを 別に 置くと、
   * 表が 2つ あるのに むきが 1つ、という ちぐはぐな かたちに なる。
   */
  let direction: SideKey = 'mine';
  const other = (side: SideKey): SideKey => (side === 'mine' ? 'theirs' : 'mine');
  const attacker = (): SideKey => direction;
  const defender = (): SideKey => other(direction);

  // ── 1匹ぶんの すうじ ──────────────────────────────────────────

  /**
   * もちものが のうりょくに かける ぶん。
   *
   * ゲームの ステータスの がめんには もちもののぶんは 出ない（持たせても 数は 動かない）
   * ので、「ゲームの すうじを 書く」に して いても、この ぶんは ここで かける。
   */
  const itemStatMul = (slot: Slot, want: StatSlot): number => {
    const it = itemOf(slot);
    return it && it.stat?.includes(want) && itemWorks(it, monOf(slot)) ? it.mul ?? 1 : 1;
  };

  /** とくせいが のうりょくに かける ぶん（ちからもち・ヨガパワー・はりきり）。 */
  const abilityStatMul = (slot: Slot, want: StatSlot): number => {
    const e = ABILITY[abilityOf(slot, monOf(slot))];
    return e?.stat?.includes(want) ? e.mul ?? 1 : 1;
  };

  const offenceOf = (slot: Slot, side: SideKey, physical: boolean): number => {
    const want: StatSlot = physical ? 'atk' : 'spa';
    const raw = isTyped(side)
      ? slot.typed[physical ? 1 : 3]
      : statOther(
        monOf(slot).base[physical ? 1 : 3], levelOf(slot),
        Number(ctl[side].iv.value), Number(ctl[side].ev.value), Number(ctl[side].nature.value),
      );
    return Math.floor(raw * itemStatMul(slot, want) * abilityStatMul(slot, want));
  };

  const defenceOf = (slot: Slot, side: SideKey, physical: boolean): number => {
    const want: StatSlot = physical ? 'def' : 'spd';
    const raw = isTyped(side)
      ? slot.typed[physical ? 2 : 4]
      : statOther(
        monOf(slot).base[physical ? 2 : 4], levelOf(slot),
        Number(ctl[side].iv.value), Number(ctl[side].ev.value), Number(ctl[side].nature.value),
      );
    return Math.floor(raw * itemStatMul(slot, want));
  };

  const hpOf = (slot: Slot, side: SideKey): number => {
    if (isTyped(side)) return slot.typed[0];
    const mon = monOf(slot);
    return statHp(
      mon.base[0], levelOf(slot),
      Number(ctl[side].iv.value), Number(ctl[side].hpEv.value),
    );
  };

  type Pair = {
    readonly mv: Move;
    /** その場の いりょく。けたぐりの ように、あいてで 変わる ものが ある。 */
    readonly power: number;
    readonly physical: boolean;
    readonly atkMon: Mon;
    readonly defMon: Mon;
    readonly atkStat: number;
    readonly defStat: number;
    readonly atkUsed: number;
    readonly defUsed: number;
    readonly hp: number;
    readonly stab: boolean;
    readonly typeMul: number;
    readonly lo: number;
    readonly hi: number;
    readonly weather: number;
    readonly burn: boolean;
    readonly crit: boolean;
    readonly item: number;
    readonly screen: boolean;
    /** きかない ときに、止めて いる とくせいの なまえ。タイプの せい なら null。 */
    readonly blockedBy: string | null;
    readonly defAbility: string;
  };

  const weather = select([
    { value: 'none', label: 'なし' },
    { value: 'sun', label: 'ひざしが つよい' },
    { value: 'rain', label: 'あめ' },
  ], 'none');
  const crit = el('input');
  crit.type = 'checkbox';
  const burn = el('input');
  burn.type = 'checkbox';
  // かべ。受ける がわに かかって いる もの。物理は リフレクター、特殊は ひかりのかべ。
  const reflect = el('input');
  reflect.type = 'checkbox';
  const screenLight = el('input');
  screenLight.type = 'checkbox';

  const pairOf = (atkSlot: Slot, defSlot: Slot, atkSide: SideKey, moveIndex?: number): Pair => {
    const defSide = other(atkSide);
    const mv = moveIndex === undefined ? moveOf(atkSlot) : moveAt(atkSlot, moveIndex);
    const physical = isPhysical(mv.type);
    const atkMon = monOf(atkSlot);
    const defMon = monOf(defSlot);

    const atkStat = offenceOf(atkSlot, atkSide, physical);
    const defStat = defenceOf(defSlot, defSide, physical);
    // ランクは 実数に かけてから きりすてる。
    const atkUsed = Math.max(1, Math.floor(atkStat * rankMul(Number(ctl[atkSide].rank.value))));
    const defUsed = Math.max(1, Math.floor(defStat * rankMul(Number(ctl[defSide].rank.value))));
    const hp = hpOf(defSlot, defSide);

    const stab = atkMon.types.includes(mv.type);
    const baseSteps = typeSteps(mv.type, defMon.types);
    const typeOnly = baseSteps.reduce((a, b) => a * b, 1);

    // 受ける がわの とくせい。きかない ものは、相性 0 と おなじ 道を 通す。
    const defAbility = abilityOf(defSlot, defMon);
    const e = ABILITY[defAbility];
    let abilityMul = 1;
    let blockedBy: string | null = null;
    if (e?.immune?.includes(mv.type)) { abilityMul = 0; blockedBy = defAbility; }
    else if (e?.half?.includes(mv.type)) abilityMul = 0.5;
    if (e?.soundproof && SOUND_MOVES.has(mv.name)) { abilityMul = 0; blockedBy = defAbility; }
    // ふしぎなまもりは、こうかバツグン の わざ いがい ぜんぶ 止める。
    if (e?.wonderGuard && typeOnly <= 1) { abilityMul = 0; blockedBy = defAbility; }

    const steps = [...baseSteps, abilityMul];
    const typeMul = typeOnly * abilityMul;

    // どちらかが ノーてんき／エアロックを 持って いると、てんきの ぶんが きえる。
    const noWeather = ABILITY[abilityOf(atkSlot, atkMon)]?.noWeather === true
      || e?.noWeather === true;
    const weatherMul = noWeather ? 1 : weather.value === 'sun'
      ? (mv.type === 'fire' ? 1.5 : mv.type === 'water' ? 0.5 : 1)
      : weather.value === 'rain'
        ? (mv.type === 'water' ? 1.5 : mv.type === 'fire' ? 0.5 : 1)
        : 1;
    const burned = physical && burn.checked;
    const screened = physical ? reflect.checked : screenLight.checked;
    const power = powerFor(mv, defMon);
    const held = itemOf(atkSlot);
    const itemMul = held?.boostType === mv.type && itemWorks(held, atkMon) ? 1.1 : 1;

    const rolls = damages({
      level: levelOf(atkSlot), power, atk: atkUsed, def: defUsed,
      stab, typeSteps: steps, crit: crit.checked, item: itemMul,
      weather: weatherMul, burn: burned, screen: screened,
    });
    return {
      mv, power, physical, atkMon, defMon, atkStat, defStat, atkUsed, defUsed, hp, stab, typeMul,
      blockedBy, defAbility,
      lo: rolls[0] ?? 0, hi: rolls[rolls.length - 1] ?? 0,
      weather: weatherMul, burn: burned, crit: crit.checked, item: itemMul, screen: screened,
    };
  };

  // ── てもちの 1行 ──────────────────────────────────────────────

  const makeSlot = (side: SideKey, monValue: string, level: number, moveValue: string): Slot => {
    const wrap = el('div', 'pd-slot');
    const radio = el('input');
    radio.type = 'radio';
    radio.name = `pd-${side}`;
    const monSel = el('select');
    fillMons(monSel, monOptions, monValue);
    const levelInput = numInput('lv', String(level), 1, 100);
    const del = el('button', 'x', '✕');
    del.type = 'button';
    wrap.append(radio, monSel, levelInput, del);

    const base = MON_BY_NO.get(monValue) ?? MONS[0]!;
    const slot: Slot = {
      wrap, radio, monSel, levelInput, del,
      own: {
        no: 0, name: 'じぶんの ポケモン', types: ['normal'],
        base: [100, 100, 100, 100, 100], weight: 50, abilities: [],
      },
      ownTouched: false,
      typed: computedStats(base, level, 31),
      typedTouched: false,
      // わざは 4つ まで。はじめは 1つめ だけ 決まって いて、のこりは 空。
      moves: [moveValue, '', '', ''],
      active: 0,
      ownMoves: [0, 1, 2, 3].map(() => ({ name: 'じぶんの わざ', type: 'normal' as TypeKey })),
      powers: [null, null, null, null],
      item: '',
      ability: '',
      lastReal: base,
    };
    del.addEventListener('click', () => {
      if (slots[side].length <= 1) return;
      const was = radio.checked;
      slots[side] = slots[side].filter((s) => s !== slot);
      wrap.remove();
      if (was) slots[side][0]!.radio.checked = true;
      render();
    });
    return slot;
  };

  // ── てもちの カード ──────────────────────────────────────────

  const buildSide = (side: SideKey, title: string, firstNo: string, secondNo: string): HTMLElement => {
    const card = el('div', 'pd-card');
    const heading = el('h2', undefined, title);
    const roleTag = el('span', 'pd-role');
    heading.appendChild(roleTag);
    card.appendChild(heading);

    const find = el('input');
    find.type = 'search';
    find.placeholder = 'なまえ か ばんごう';
    card.appendChild(row('しぼりこみ', find));

    const list = el('div');
    card.appendChild(list);

    const add = el('button', 'pd-add', '＋ ふやす');
    add.type = 'button';
    const addRow = el('div', 'pd-row');
    addRow.appendChild(add);
    card.appendChild(addRow);

    const push = (no: string, level: number, moveValue: string, checked: boolean): Slot | null => {
      if (slots[side].length >= MAX_SLOTS) return null;
      const slot = makeSlot(side, no, level, moveValue);
      slot.radio.checked = checked;
      slots[side].push(slot);
      list.appendChild(slot.wrap);
      return slot;
    };
    adders[side] = push;
    lists[side] = list;
    push(firstNo, 50, String(MOVES.findIndex((m) => m.name === 'たいあたり')), true);
    push(secondNo, 50, String(MOVES.findIndex((m) => m.name === 'たいあたり')), false);
    add.addEventListener('click', () => {
      push('1', 50, String(MOVES.findIndex((m) => m.name === 'たいあたり')), false);
      render();
    });

    // しぼりこみは この がわの ぜんぶの えらびかたに かかる。いま えらんで いる ものは、
    // しぼった 先に 残らなくても 消さない。字を 打った とたんに 選びなおしに なるため。
    find.addEventListener('input', () => {
      const q = kata(find.value.trim());
      for (const slot of slots[side]) {
        const kept = slot.monSel.value;
        const matched = q === ''
          ? monOptions
          : monOptions.filter((o) => o.value === kept || kata(o.label).includes(q));
        // 当たらなかった ときは、いま えらんで いる ものだけが 残る。一覧を そのまま
        // 出し続けるより、当たらなかったと 分かる 方が いい。
        fillMons(slot.monSel, matched, kept);
      }
    });

    card.appendChild(el('h3', undefined, 'えらんで いる ポケモン'));

    // じぶんで かく ポケモン。一覧は 第3世代の 386匹だけ なので、あとの 世代の
    // ポケモンや、思いついた すうじは ここに 書く。すばやさは この どうぐでは 使わない。
    const ownWrap = el('div', 'pd-own');
    const ownName = el('input');
    ownName.type = 'text';
    ownName.maxLength = 12;
    const ownT1 = select(typeOptions, 'normal');
    const ownT2 = select(typeOptionsWithNone, '');
    const ownBaseBox = el('div', 'pd-base');
    const ownBase = STAT_LABEL.map((label) => {
      const cell = el('div');
      cell.appendChild(el('span', undefined, label));
      const input = el('input');
      input.type = 'number';
      input.min = '1';
      input.max = '255';
      ownBaseBox.appendChild(cell);
      cell.appendChild(input);
      return input;
    });
    // おもさは けたぐりの いりょくに きく。ほかには つかわない。
    const ownWeight = numInput('num', '50', 1, 999);
    ownWrap.append(
      row('なまえ', ownName), row('タイプ1', ownT1), row('タイプ2', ownT2),
      row('しゅぞくち', ownBaseBox), row('おもさ(kg)', ownWeight),
    );
    const onOwnEdit = (): void => {
      const slot = chosen(side);
      const types: TypeKey[] = [ownT1.value as TypeKey];
      // おなじ タイプを 2つ えらんでも、相性を 二重に かけない。
      if (ownT2.value && ownT2.value !== ownT1.value) types.push(ownT2.value as TypeKey);
      const nums = ownBase.map((i) => readNum(i.value, 100, 1, 255));
      slot.own = {
        no: 0,
        name: ownName.value.trim() || 'じぶんの ポケモン',
        types,
        base: [nums[0] ?? 100, nums[1] ?? 100, nums[2] ?? 100, nums[3] ?? 100, nums[4] ?? 100],
        weight: readNum(ownWeight.value, 50, 1, 999),
        abilities: [],
      };
      slot.ownTouched = true;
    };
    ownWrap.addEventListener('input', onOwnEdit);
    ownWrap.addEventListener('change', onOwnEdit);
    card.appendChild(ownWrap);

    const types = el('div');
    const seed = el('div');
    card.append(types, seed);

    // もちもの。1匹ずつ ちがう ものを 持てるので、ここに 置く（ぜんいんに かかる
    // せってい とは 別）。きく 相手が 決まって いる ものは、下の 行で 知らせる。
    // とくせい。その子が もちうる ものだけ ならべる（第3世代は 1つか 2つ）。
    // ダメージに きく ものは、下の 行で 何を するかを 言う。
    const ability = el('select');
    const abilityNote = el('p', 'pd-sub');
    card.append(row('とくせい', ability), abilityNote);
    const onAbility = (): void => { chosen(side).ability = ability.value; };
    ability.addEventListener('input', onAbility);
    ability.addEventListener('change', onAbility);

    const item = el('select');
    fillItems(item, '');
    const itemNote = el('p', 'pd-sub');
    card.append(row('もちもの', item), itemNote);
    // input と change の 両方で 受ける。えらびかたは input が 先に とぶので、change
    // だけに して おくと、先に 走った 書き直しが 元の 値に もどして しまう——
    // 持たせた はずの ものが、その場で 消える。
    const onItem = (): void => { chosen(side).item = item.value; };
    item.addEventListener('input', onItem);
    item.addEventListener('change', onItem);

    // わざは 4つ まで。まるは「いま つかう わざ」で、表の 名前の 下に 出る ものと
    // 同じ。いりょくと「じぶんで かく」は、その まるが ついた 1つに かかる——
    // 4つぶん ならべると、どの わざを 直して いるのか 見失う。
    const moveRadios: HTMLInputElement[] = [];
    const moveSels: HTMLSelectElement[] = [];
    for (let i = 0; i < 4; i += 1) {
      const line = el('div', 'pd-mvrow');
      const mark = el('input');
      mark.type = 'radio';
      mark.name = `pd-mv-${side}`;
      const sel = el('select');
      fillMoves(sel, '');
      line.append(mark, el('span', 'k', `わざ${i + 1}`), sel);
      card.appendChild(line);
      moveRadios.push(mark);
      moveSels.push(sel);
      const onMark = (): void => { chosen(side).active = i; };
      mark.addEventListener('input', onMark);
      mark.addEventListener('change', onMark);
      const onSel = (): void => {
        const slot = chosen(side);
        slot.moves[i] = sel.value;
        // わざを 入れかえたら、いりょくは その わざの ものに もどす。
        slot.powers[i] = null;
        // 空に したら、まるは 決まって いる ものへ 移す。
        if (sel.value !== '') slot.active = i;
      };
      sel.addEventListener('input', onSel);
      sel.addEventListener('change', onSel);
    }

    // じぶんで かく わざ。なまえが 一覧に ある ものと 合えば、いりょくと タイプを
    // そのまま 入れる。打ちまちがいや、一覧に 無い わざは、手で 直せば いい。
    const powerInput = numInput('num', '80', 1, 250);
    const powerRow = row('いりょく', powerInput);
    const onPower = (): void => {
      const slot = chosen(side);
      slot.powers[activeIndex(slot)] = readNum(powerInput.value, 80, 1, 250);
    };
    powerInput.addEventListener('input', onPower);

    const moveWrap = el('div', 'pd-own');
    const moveName = el('input');
    moveName.type = 'text';
    moveName.maxLength = 12;
    const moveType = select(typeOptions, 'normal');
    moveWrap.append(row('わざの なまえ', moveName), row('タイプ', moveType));
    const onMoveEdit = (e: Event): void => {
      const slot = chosen(side);
      const i = activeIndex(slot);
      const own = slot.ownMoves[i];
      if (!own) return;
      own.name = moveName.value;
      const known = MOVE_BY_NAME.get(moveName.value.trim());
      if (known && e.target === moveName) {
        moveType.value = known.type;
        powerInput.value = String(known.power);
        slot.powers[i] = known.power;
      }
      own.type = moveType.value as TypeKey;
    };
    moveWrap.addEventListener('input', onMoveEdit);
    moveWrap.addEventListener('change', onMoveEdit);
    card.appendChild(moveWrap);

    card.appendChild(powerRow);

    const source = select(sourceOptions, 'calc');
    card.appendChild(row('すうじ', source));

    const typedWrap = el('div', 'pd-own');
    typedWrap.appendChild(el('p', 'pd-hint',
      'ゲームの ステータスの がめんを 見て、そのまま 書いてね。'
      + 'こたいちと どりょくは 1匹ずつ ちがって 中からは 見えないので、'
      + 'しゅぞくちから 出した すうじは どうしても ずれる。'));
    const typedBox = el('div', 'pd-base');
    const typedInputs = STAT_LABEL.map((label) => {
      const cell = el('div');
      cell.appendChild(el('span', undefined, label));
      const input = el('input');
      input.type = 'number';
      input.min = '1';
      input.max = '999';
      cell.appendChild(input);
      typedBox.appendChild(cell);
      return input;
    });
    typedWrap.appendChild(row('じっすう', typedBox));
    const onTypedEdit = (): void => {
      const slot = chosen(side);
      const nums = typedInputs.map((i) => readNum(i.value, 100, 1, 999));
      slot.typed = [nums[0] ?? 100, nums[1] ?? 100, nums[2] ?? 100, nums[3] ?? 100, nums[4] ?? 100];
      slot.typedTouched = true;
    };
    typedWrap.addEventListener('input', onTypedEdit);
    typedWrap.addEventListener('change', onTypedEdit);
    card.appendChild(typedWrap);

    const note = el('p', 'pd-sub');
    card.appendChild(note);

    card.appendChild(el('h3', undefined, 'この がわ ぜんいんに かかる'));
    const iv = select(ivOptions, '15');
    const hpEv = select(evOptions, '0');
    const ev = select(evOptions, '0');
    const nature = select(natureOptions, '1');
    const rank = select(rankOptions, '0');
    const ivRow = row('こたいち', iv);
    const hpEvRow = row('HPどりょく', hpEv);
    const evRow = row('どりょく', ev);
    const natureRow = row('せいかく', nature);
    card.append(ivRow, hpEvRow, evRow, natureRow, row('ランク', rank));

    ctl[side] = { source, iv, hpEv, ev, nature, rank };
    detail[side] = {
      ownWrap, ownName, ownT1, ownT2, ownBase, ownWeight, types, seed,
      moveRadios, moveSels, moveWrap, moveName, moveType, powerRow, power: powerInput,
      typedWrap, typedInputs, note, roleTag, ivRow, hpEvRow, evRow, natureRow,
      ability, abilityNote, item, itemNote,
    };
    return card;
  };

  const mineCard = buildSide('mine', '🎒 じぶんの てもち', '4', '25');
  const theirsCard = buildSide('theirs', '👹 あいての てもち', '16', '19');

  /**
   * てもちは 2つ ならべて、どちらも 出したまま にする。
   *
   * 片がわずつ 切りかえる 形に すると、相手を 見ながら こちらを 直す ことが できない——
   * この どうぐで やりたいのは まさに それ。画面が 横に 広い ときは 左右に、せまい
   * ときは たてに 2つ ならぶ。
   */
  const parties = el('div', 'pd-parties');
  parties.append(mineCard, theirsCard);

  // ── そのほか ──────────────────────────────────────────────────

  const optCard = el('div', 'pd-card');
  optCard.appendChild(el('h2', undefined, '🌤️ そのほか'));
  const checks = el('div', 'pd-checks');
  const critLabel = el('label');
  critLabel.append(crit, document.createTextNode('きゅうしょに あたる（× 2）'));
  const burnLabel = el('label');
  burnLabel.append(burn, document.createTextNode('せめる がわが やけど'));
  checks.append(critLabel, burnLabel);

  // かべは 受ける がわに かかる。物理には リフレクター、特殊には ひかりのかべ。
  // きゅうしょに あたると、どちらも 無かった ことに なる。
  const walls = el('div', 'pd-checks');
  const reflectLabel = el('label');
  reflectLabel.append(reflect, document.createTextNode('リフレクター（物理が はんぶん）'));
  const lightLabel = el('label');
  lightLabel.append(screenLight, document.createTextNode('ひかりのかべ（特殊が はんぶん）'));
  walls.append(reflectLabel, lightLabel);

  optCard.append(row('てんき', weather), checks, el('h3', undefined, '🧱 まもる がわの かべ'), walls);

  // ── こたえ ────────────────────────────────────────────────────

  const outCard = el('div', 'pd-card');
  outCard.appendChild(el('h2', undefined, '📊 けいさん'));
  const who = el('p', 'pd-sub');
  const out = el('div', 'pd-out');
  const eff = el('p', 'pd-eff');
  const big = el('p', 'pd-big');
  const pct = el('p', 'pd-pct');
  const bar = el('div', 'pd-bar');
  const barMax = el('i', 'max');
  const barMin = el('i', 'min');
  bar.append(barMax, barMin);
  const ko = el('p', 'pd-ko');
  out.append(eff, big, pct, bar, ko);
  const table = el('table', 'pd-table');
  outCard.append(who, out, table);

  // ── てもち × てもち ────────────────────────────────────────────

  const mxCard = el('div', 'pd-card');
  mxCard.appendChild(el('h2', undefined, '🔢 てもち × てもち'));
  const mineMxNote = el('p', 'pd-note');
  const mineMx = el('div', 'pd-mx');
  const theirsMxNote = el('p', 'pd-note');
  const theirsMx = el('div', 'pd-mx');
  mxCard.append(
    el('h3', undefined, '⚔️ じぶんの こうげき'), mineMxNote, mineMx,
    el('h3', undefined, '🛡️ あいての こうげき'), theirsMxNote, theirsMx,
  );

  const noteCard = el('div', 'pd-card');
  noteCard.appendChild(el('h2', undefined, '📖 つかっている しき'));
  noteCard.appendChild(el('p', 'pd-note',
    'ダメージ ＝ （（レベル × 2 ÷ 5 ＋ 2）× いりょく × こうげき ÷ ぼうぎょ ÷ 50）'
    + ' × てんき × やけど ＋ 2 → きゅうしょ(× 2) → らんすう → タイプ一致 → タイプ相性。'
    + ' ファイアレッド（第3世代）の 順で、いまの作品とは ちがう。'
    + ' 物理か 特殊かは わざ ではなく タイプで 決まり、フェアリーは まだ 無い。'
    + ' らんすうは 0.85 から 1.00 までの 16とおり なので、おなじ わざでも 当たるたびに'
    + ' すこし ちがう。だから こたえは 1つの 数ではなく「いくつから いくつ」に なる。'));
  noteCard.appendChild(el('p', 'pd-note',
    'しゅぞくちから その レベルの じっすうを 出す しきは、'
    + '（しゅぞくち × 2 ＋ こたいち ＋ どりょく ÷ 4）× レベル ÷ 100 ＋ 5 × せいかく。'
    + ' HP だけ ちがって、最後が ＋ レベル ＋ 10 で、せいかくも きかない。'
    + ' こたいちと どりょくは 1匹ずつ ちがって、ゲームの 中からは 見えない。'
    + ' だから しゅぞくちから 出した すうじは「だいたい」で、ぴったり 合わせたい ときは'
    + ' ステータスの がめんの すうじを そのまま 書く。'
    + ' もちものの ぶんは、ステータスの がめんには 出ない ので、書いた すうじの 上から'
    + ' この どうぐが かける。'
    + ' とくせいは ダメージに きく ものだけ 入れて ある（ふゆう・もらいび・ちょすい・'
    + ' ちくでん・あついしぼう・ふしぎなまもり・ぼうおん・ちからもち・ヨガパワー・'
    + ' はりきり・ノーてんき・エアロック）。'
    + ' しんりょく・もうか・げきりゅう・むしのしらせ は 残りHP、こんじょう は じょうたいで'
    + ' 変わる ので、この どうぐでは 見て いない。'));

  app.append(parties, optCard, outCard, mxCard, noteCard);

  // ── 出す ──────────────────────────────────────────────────────

  /** 同じ すうじを 書き直さない。打って いる 最中に 書き戻すと、文字の 位置が 飛ぶ。 */
  const put = (node: HTMLInputElement | HTMLSelectElement, value: string): void => {
    if (node.value !== value) node.value = value;
  };

  const renderSide = (side: SideKey, role: 'attack' | 'defend', pair: Pair): void => {
    const d = detail[side];
    const list = slots[side];
    for (const slot of list) slot.del.disabled = list.length <= 1;

    const slot = chosen(side);
    const typed = isTyped(side);

    // 「じぶんで かく」の 下じき。まっさらな 100 から 書き起こすより、直前に えらんで
    // いた ポケモンを 1つ2つ 直す方が 早い。一度でも 手が 入ったら 入れ直さない。
    if (slot.monSel.value !== OWN) slot.lastReal = monOf(slot);
    if (slot.monSel.value === OWN && !slot.ownTouched) slot.own = slot.lastReal;
    for (const other of list) {
      if (other.monSel.value !== OWN) other.lastReal = monOf(other);
      if (other.monSel.value === OWN && !other.ownTouched) other.own = other.lastReal;
      if (!other.typedTouched) {
        other.typed = computedStats(monOf(other), levelOf(other), Number(ctl[side].iv.value));
      }
    }

    const mon = monOf(slot);
    d.ownWrap.hidden = slot.monSel.value !== OWN;
    if (!d.ownWrap.hidden) {
      put(d.ownName, slot.own.name);
      put(d.ownT1, slot.own.types[0] ?? 'normal');
      put(d.ownT2, slot.own.types[1] ?? '');
      slot.own.base.forEach((v, i) => { const n = d.ownBase[i]; if (n) put(n, String(v)); });
      put(d.ownWeight, String(slot.own.weight));
    }

    const active = activeIndex(slot);
    slot.moves.forEach((value, i) => { const n = d.moveSels[i]; if (n) put(n, value); });
    d.moveRadios.forEach((mark, i) => { mark.checked = i === active; });

    d.moveWrap.hidden = slot.moves[active] !== OWN;
    if (!d.moveWrap.hidden) {
      const own = slot.ownMoves[active];
      if (own) {
        put(d.moveName, own.name);
        put(d.moveType, own.type);
      }
    }
    // とくせいの えらびかたは、その子に 合わせて 作り直す。じぶんで かいた 子は
    // もちうる ものが 分からないので、ダメージに きく ものから えらぶ。
    const now = abilityOf(slot, mon);
    const names = mon.abilities.length ? mon.abilities : ['', ...ABILITY_NAMES];
    fill(d.ability, names.map((n) => ({ value: n, label: n || 'なし' })), now);
    d.abilityNote.textContent = now ? abilityWord(now) || 'ダメージには きかない とくせい' : '';

    put(d.item, slot.item);
    d.itemNote.textContent = itemWord(itemOf(slot), mon);

    const mv = moveOf(slot);
    // おもさ だよりの わざは、あいてが 変われば いりょくも 変わる。いま 下の けいさんに
    // 出て いる 組み合わせの 数を 出す。
    put(d.power, String(role === 'attack' ? pair.power : powerFor(mv, pair.defMon)));
    // いりょくを いじれるのは せめる がわ だけ。受ける がわの わざは この 計算に
    // 出て こないので、出すと 何に きくのか 分からなくなる。
    d.powerRow.hidden = role !== 'attack';

    d.typedWrap.hidden = !typed;
    if (typed) slot.typed.forEach((v, i) => { const n = d.typedInputs[i]; if (n) put(n, String(v)); });
    d.ivRow.hidden = typed;
    d.hpEvRow.hidden = typed;
    d.evRow.hidden = typed;
    d.natureRow.hidden = typed;

    d.types.replaceChildren(typeChips(mon.types));
    const used = role === 'attack'
      ? [pair.physical ? 1 : 3]
      : [0, pair.physical ? 2 : 4];
    d.seed.replaceChildren(seedRow(mon, used));

    if (role === 'attack') {
      d.note.textContent = `つかう すうじ：${pair.physical ? 'こうげき' : 'とくこう'} ${pair.atkStat}`
        + `${pair.atkUsed === pair.atkStat ? '' : ` → ${pair.atkUsed}（ランク）`}`
        + `${pair.stab ? ' / タイプ一致 × 1.5' : ''}`;
    } else {
      d.note.textContent = `つかう すうじ：HP ${pair.hp}`
        + ` / ${pair.physical ? 'ぼうぎょ' : 'とくぼう'} ${pair.defStat}`
        + `${pair.defUsed === pair.defStat ? '' : ` → ${pair.defUsed}（ランク）`}`;
    }
  };

  const renderOut = (pair: Pair): void => {
    who.textContent = `${pair.atkMon.name} の ${pair.mv.name} → ${pair.defMon.name}`;
    eff.textContent = effectWord(pair.typeMul);

    if (pair.typeMul === 0) {
      big.textContent = 'ダメージ 0';
      pct.textContent = pair.blockedBy
        ? `${pair.defMon.name} の ${pair.blockedBy} で、${pair.mv.name} は きかない。`
        : `${pair.mv.name}（${TYPE_NAME[pair.mv.type]}）は ${pair.defMon.name} に きかない。`;
      barMin.style.width = '0';
      barMax.style.width = '0';
      ko.textContent = pair.blockedBy
        ? 'たおせない。とくせいを こえる わざを さがそう。'
        : 'たおせない。べつの タイプの わざを ためしてみよう。';
      table.replaceChildren();
      return;
    }

    big.replaceChildren(
      document.createTextNode(`${pair.lo} 〜 ${pair.hi}`),
      el('small', undefined, ` ダメージ（HP ${pair.hp}）`),
    );
    const loPct = (pair.lo / pair.hp) * 100;
    const hiPct = (pair.hi / pair.hp) * 100;
    pct.textContent = `のこり HP の ${loPct.toFixed(1)}% 〜 ${hiPct.toFixed(1)}% を けずる`;
    barMin.style.width = `${Math.min(100, loPct)}%`;
    barMax.style.width = `${Math.min(100, hiPct)}%`;

    // 「かくじつ」は いちばん 小さい ダメージでも たおせる 回数、「うまくいけば」は
    // いちばん 大きい ダメージが そろった ときの 回数。
    const sure = Math.ceil(pair.hp / pair.lo);
    const lucky = Math.ceil(pair.hp / pair.hi);
    ko.textContent = sure === lucky
      ? `かくじつに ${sure}はつで たおせる`
      : `うまくいけば ${lucky}はつ、かくじつには ${sure}はつで たおせる`;

    const head = el('tr');
    head.append(el('th', undefined, 'つかった すうじ'), el('th', undefined, 'あたい'));
    table.replaceChildren(head);
    const lines: readonly [string, string][] = [
      ['わざ', `${pair.mv.name}（${TYPE_NAME[pair.mv.type]}・${pair.physical ? '物理' : '特殊'}）`],
      ['いりょく', pair.mv.power > 0
        ? String(pair.power)
        : `${pair.power}（おもさ ${pair.defMon.weight}kg）`],
      [pair.physical ? 'こうげき' : 'とくこう', String(pair.atkUsed)],
      [pair.physical ? 'ぼうぎょ' : 'とくぼう', String(pair.defUsed)],
      ['まもる がわの HP', String(pair.hp)],
      ['タイプ一致', pair.stab ? '× 1.5' : '× 1'],
      ['タイプ相性', `× ${pair.typeMul}`],
      ['てんき', `× ${pair.weather}`],
      ['まもる がわの とくせい', pair.defAbility
        ? `${pair.defAbility}${abilityWord(pair.defAbility) ? `（${abilityWord(pair.defAbility)}）` : ''}`
        : 'なし'],
      ['かべ', pair.screen && !pair.crit ? '× 0.5' : '× 1'],
      ['きゅうしょ', pair.crit ? '× 2' : '× 1'],
      ['もちもの', pair.item === 1 ? '× 1' : `× ${pair.item}`],
      ['やけど', pair.burn ? '× 0.5' : '× 1'],
    ];
    for (const [k, v] of lines) {
      const tr = el('tr');
      tr.append(el('td', undefined, k), el('td', 'num', v));
      table.appendChild(tr);
    }
  };

  /**
   * せめる がわ ぜんいん × 受ける がわ ぜんいんの 総当たり。
   *
   * むきが ちがう 2つを 両方 出す。どちらの こうげきも 同じ 画面で 見たい——
   * 「こちらが 何発で 倒せるか」だけ 分かっても、「向こうが 何発で 倒してくるか」が
   * 見えなければ、どちらが 先に 倒れるかは 決められない。
   *
   * ますには「かくじつに たおせる 回数」を 出す。いちばん 小さい ダメージで 数えるので、
   * ここに 3 と 出て いれば、運が わるくても 3発で 終わる。下の % は いちばん 大きい
   * ダメージの ぶん。ますを 押すと、その 組み合わせが 上の けいさんに 出る。
   */
  const renderMatrix = (atkSide: SideKey, box: HTMLElement, note: HTMLElement): void => {
    const defSide = other(atkSide);
    note.textContent = atkSide === 'mine'
      ? 'たてが じぶん、よこが あいて。ますの すうじは、かくじつに たおせる はっすう。'
      : 'たてが あいて、よこが じぶん。ますの すうじは、かくじつに たおされる はっすう。';

    const table = el('table');
    const head = el('tr');
    head.append(el('th', 'rh', ''), el('th', 'mh', 'わざ'));
    for (const d of slots[defSide]) head.appendChild(el('th', undefined, monOf(d).name));
    table.appendChild(head);

    for (const a of slots[atkSide]) {
      // 覚えて いる わざを ぜんぶ 行に する。1つの わざだけ 出して 押しかえる 形だと、
      // どの わざが いちばん 効くかを 見くらべる のに、何度も 押す ことに なる。
      const filled = filledMoves(a);
      const indexes = filled.length ? filled : [activeIndex(a)];
      const active = activeIndex(a);

      indexes.forEach((i, nth) => {
        const tr = el('tr');
        if (nth === 0) {
          const th = el('th', 'rh');
          th.rowSpan = indexes.length;
          th.appendChild(el('div', 'nm', monOf(a).name));
          tr.appendChild(th);
        }
        const mh = el('th', `mh${i === active ? ' on' : ''}`, moveAt(a, i).name);
        tr.appendChild(mh);

        for (const d of slots[defSide]) {
          const pair = pairOf(a, d, atkSide, i);
          const td = el('td');
          if (pair.typeMul === 0) {
            td.className = 'k0';
            td.textContent = 'きかない';
          } else {
            const sure = Math.ceil(pair.hp / pair.lo);
            td.className = sure <= 1 ? 'k1' : sure === 2 ? 'k2' : sure <= 3 ? 'k3' : '';
            td.append(
              el('b', undefined, `${sure}はつ`),
              el('small', undefined, `${((pair.hi / pair.hp) * 100).toFixed(0)}%`),
            );
          }
          if (direction === atkSide && a.radio.checked && d.radio.checked && i === active) {
            td.classList.add('sel');
          }
          // ますを 押すと、その 組み合わせと その わざが 下の けいさんに 出る。
          td.addEventListener('click', () => {
            direction = atkSide;
            a.active = i;
            a.radio.checked = true;
            d.radio.checked = true;
            render();
          });
          tr.appendChild(td);
        }
        table.appendChild(tr);
      });
    }

    box.replaceChildren(table);
  };

  function render(): void {
    const atkSide = attacker();
    const defSide = defender();
    const pair = pairOf(chosen(atkSide), chosen(defSide), atkSide);

    // やけどが 効くのは 物理 だけ。特殊の タイプの あいだは さわれなくする。
    burn.disabled = !pair.physical;
    burnLabel.style.opacity = pair.physical ? '1' : '.45';

    // どちらが せめるかは 見出しに 出す。「むき」の えらびかたは ずっと 下に あるので、
    // てもちを 見て いる ときに、いま どちらの 立場かが 分からなくなる。
    for (const side of ['mine', 'theirs'] as const) {
      const attacking = side === atkSide;
      detail[side].roleTag.textContent = attacking ? '⚔️ せめる' : '🛡️ うける';
      detail[side].roleTag.classList.toggle('atk', attacking);
    }

    renderSide(atkSide, 'attack', pair);
    renderSide(defSide, 'defend', pair);
    renderOut(pair);
    renderMatrix('mine', mineMx, mineMxNote);
    renderMatrix('theirs', theirsMx, theirsMxNote);
    save();
  }

  /**
   * 置き場に 書く 予定に 入れる。実際に 出るのは すこし あと（まとめて 出る）。
   *
   * 中身が 変わって いない ときは 書かない。書き直しは ひらいた だけでも 走るので、
   * そのまま つなぐと、見に 来ただけの ときや、画の とりこみ の ときにも 書いて しまう。
   */
  function save(): void {
    if (!saving) return;
    const next = snapshot();
    const json = JSON.stringify(next);
    if (json === lastSaved) return;
    lastSaved = json;
    ctx.save.put(next);
  }

  // どれが 変わっても やることは おなじ（計算を やり直す）ので、1つずつ つなぐより
  // まとめて 1か所で 受ける。
  const onChange = (e: Event): void => {
    for (const side of ['mine', 'theirs'] as const) {
      for (const slot of slots[side]) {
        // さわった 行を、そのまま「えらんで いる」行に する。
        // そうしないと、3ばんめの 行で「じぶんで かく」を えらんだのに、下に 出て
        // いるのは 1ばんめの 中身、という ずれ方を する。
        if (e.target instanceof Node && slot.wrap.contains(e.target)) slot.radio.checked = true;
      }
    }
    render();
  };

  page.addEventListener('change', onChange);
  page.addEventListener('input', onChange);

  // ── つづきから ────────────────────────────────────────────────

  /**
   * いまの ぜんぶを 1つの かたまりに する。
   *
   * てもちを 組み直すのは 手間が かかる——6匹 × わざ4つ ＋ もちもの ＋ すうじ。
   * 1回 使って 終わりなら 要らない 仕組みだが、これは 何度も ひらいて 同じ てもちを
   * 見る どうぐ なので、置いて おける 方が いい。
   */
  const snapshot = (): unknown => ({
    v: 1,
    direction,
    weather: weather.value,
    crit: crit.checked,
    burn: burn.checked,
    reflect: reflect.checked,
    lightScreen: screenLight.checked,
    sides: (['mine', 'theirs'] as const).map((side) => ({
      source: ctl[side].source.value,
      iv: ctl[side].iv.value,
      hpEv: ctl[side].hpEv.value,
      ev: ctl[side].ev.value,
      nature: ctl[side].nature.value,
      rank: ctl[side].rank.value,
      chosen: slots[side].findIndex((s) => s.radio.checked),
      slots: slots[side].map((slot) => ({
        mon: slot.monSel.value,
        level: slot.levelInput.value,
        moves: slot.moves,
        active: slot.active,
        ownMoves: slot.ownMoves,
        powers: slot.powers,
        item: slot.item,
        ability: slot.ability,
        own: slot.own,
        ownTouched: slot.ownTouched,
        typed: slot.typed,
        typedTouched: slot.typedTouched,
      })),
    })),
  });

  /** 置いて あった かたまりを 画面に もどす。形が 違えば 何も しない。 */
  const restore = (raw: string): boolean => {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (data['v'] !== 1 || !Array.isArray(data['sides'])) return false;
    const sides = data['sides'] as Record<string, unknown>[];

    direction = data['direction'] === 'theirs' ? 'theirs' : 'mine';
    weather.value = String(data['weather'] ?? 'none');
    crit.checked = data['crit'] === true;
    burn.checked = data['burn'] === true;
    reflect.checked = data['reflect'] === true;
    screenLight.checked = data['lightScreen'] === true;

    (['mine', 'theirs'] as const).forEach((side, i) => {
      const saved = sides[i];
      if (!saved) return;
      const put2 = (node: HTMLSelectElement, key: string): void => {
        const v = saved[key];
        if (typeof v === 'string') node.value = v;
      };
      put2(ctl[side].source, 'source');
      put2(ctl[side].iv, 'iv');
      put2(ctl[side].hpEv, 'hpEv');
      put2(ctl[side].ev, 'ev');
      put2(ctl[side].nature, 'nature');
      put2(ctl[side].rank, 'rank');

      const rows = Array.isArray(saved['slots']) ? saved['slots'] as Record<string, unknown>[] : [];
      if (!rows.length) return;
      slots[side] = [];
      lists[side]?.replaceChildren();
      const add = adders[side];
      if (!add) return;
      rows.slice(0, MAX_SLOTS).forEach((r, index) => {
        const slot = add(String(r['mon'] ?? '1'), 50, '', index === 0);
        if (!slot) return;
        slot.levelInput.value = String(r['level'] ?? '50');
        if (Array.isArray(r['moves'])) slot.moves = (r['moves'] as string[]).slice(0, 4);
        if (typeof r['active'] === 'number') slot.active = r['active'];
        if (Array.isArray(r['ownMoves'])) {
          slot.ownMoves = r['ownMoves'] as { name: string; type: TypeKey }[];
        }
        if (Array.isArray(r['powers'])) slot.powers = r['powers'] as (number | null)[];
        if (typeof r['item'] === 'string') slot.item = r['item'];
        if (typeof r['ability'] === 'string') slot.ability = r['ability'];
        if (r['own']) slot.own = r['own'] as Mon;
        slot.ownTouched = r['ownTouched'] === true;
        if (Array.isArray(r['typed'])) {
          slot.typed = r['typed'] as [number, number, number, number, number];
        }
        slot.typedTouched = r['typedTouched'] === true;
      });
      const chose = saved['chosen'];
      const mark = slots[side][typeof chose === 'number' && chose >= 0 ? chose : 0];
      if (mark) mark.radio.checked = true;
    });
    return true;
  };

  let disposed = false;
  // 読めるまでは 書かない。読めなかったのを「まだ 無い」と 取りちがえると、
  // つぎの 保存が 置いて あった てもちを 空で 上書きする。
  let saving = false;
  /** 最後に 置いた 中身。おなじ ものを もう一度 書かない ための 目じるし。 */
  let lastSaved: string | null = null;

  host.replaceChildren(style, page);
  render();

  void (async () => {
    const res = await ctx.save.load();
    if (disposed) return;
    if (!res.ok) {
      ctx.setStatus('まえの ぶんが よみこめませんでした');
    } else if (typeof res.state === 'string') {
      try {
        if (restore(res.state)) render();
      } catch {
        ctx.setStatus('まえの ぶんが こわれて いたので、あたらしく はじめます');
      }
    }
    // 読みおえた ところの 中身を 目じるしに して おく。ここで 1回 書くと、ひらいた
    // だけで 置き場に 触る ことに なる——置いて ある ものと おなじ 中身を、わざわざ
    // 書き直す 形に なる。
    saving = true;
    lastSaved = JSON.stringify(snapshot());
  })();

  return () => {
    disposed = true;
    page.removeEventListener('change', onChange);
    page.removeEventListener('input', onChange);
    host.replaceChildren();
  };
};
