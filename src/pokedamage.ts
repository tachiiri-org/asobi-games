// ポケモン ダメージけいさん（ファイアレッド／第3世代）。
//
// あそびばの中では めずらしく「どうぐ」で、遊んで点を出すものではない。だから
// onFinish は 一度も 呼ばない（表の ranking は 'none'）。ランキングに ならばない
// かわりに、ログインも 保存も 要らない。
//
// 合わせる先は ファイアレッド／リーフグリーン（第3世代）。いまの作品とは 計算の
// しかたが ちがうので、そこを まぜると どちらでも 合わない数が 出る。ちがいは4つ。
//  - フェアリータイプが まだ 無い。ピッピも プリンも ノーマル。
//  - 物理か 特殊かは、わざ1つずつ ではなく タイプで 決まる。ゴーストは 物理なので
//    シャドーボールは 物理、ドラゴンは 特殊なので げきりんは 特殊。
//  - きゅうしょは ×2（いまは ×1.5）。
//  - はがねが ゴーストと あくを 半減する。
// 種族値も 当時のもの。ピカチュウの ぼうぎょは 30（いまは 40）など、第6世代以降で
// 上がった ぶんは 入れて いない。
//
// 一覧に 無いものは 自分で 書ける。カントー図鑑の 151匹の 外（他の地方の ポケモンや、
// 覚える わざの 組み合わせ）を 試すのに、一覧を 太らせずに 済ませるため。
//
// 決めごと。
//  - 外から CSS も 絵も 取らない。ポケモンは 名前と すうじ だけで あらわす。
//  - 第3世代の 計算順。もとの数 → てんき → やけど → ＋2 → きゅうしょ → らんすう →
//    タイプ一致 → タイプ相性。＋2 が てんきの あとに 来るのと、きゅうしょが ＋2 の
//    あとに 来るのが、いまの作品との ちがい。
//  - のう（もちもの・とくせい・リフレクター・きゅうしょが ランクを 無視する ところ）は
//    持たない。持ちはじめると「どれを 持っていて どれを 持っていないか」が 分からなくなる。

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
};

/**
 * カントー図鑑の 151匹。種族値は 第3世代のもの。
 *
 * 第6世代以降で 上がった ぶんは 入れて いない。ピカチュウの ぼうぎょ30・とくぼう40、
 * バタフリーの とくこう80、ピジョットの すばやさ、ニドキングの こうげき92、
 * フーディンの とくぼう85、マルマインの すばやさ、ダグトリオと カモネギの こうげきなど。
 * すばやさは この どうぐでは 使わないので 持たない。
 */
const MONS: readonly Mon[] = [
  { no: 1, name: 'フシギダネ', types: ['grass', 'poison'], base: [45, 49, 49, 65, 65] },
  { no: 2, name: 'フシギソウ', types: ['grass', 'poison'], base: [60, 62, 63, 80, 80] },
  { no: 3, name: 'フシギバナ', types: ['grass', 'poison'], base: [80, 82, 83, 100, 100] },
  { no: 4, name: 'ヒトカゲ', types: ['fire'], base: [39, 52, 43, 60, 50] },
  { no: 5, name: 'リザード', types: ['fire'], base: [58, 64, 58, 80, 65] },
  { no: 6, name: 'リザードン', types: ['fire', 'flying'], base: [78, 84, 78, 109, 85] },
  { no: 7, name: 'ゼニガメ', types: ['water'], base: [44, 48, 65, 50, 64] },
  { no: 8, name: 'カメール', types: ['water'], base: [59, 63, 80, 65, 80] },
  { no: 9, name: 'カメックス', types: ['water'], base: [79, 83, 100, 85, 105] },
  { no: 10, name: 'キャタピー', types: ['bug'], base: [45, 30, 35, 20, 20] },
  { no: 11, name: 'トランセル', types: ['bug'], base: [50, 20, 55, 25, 25] },
  { no: 12, name: 'バタフリー', types: ['bug', 'flying'], base: [60, 45, 50, 80, 80] },
  { no: 13, name: 'ビードル', types: ['bug', 'poison'], base: [40, 35, 30, 20, 20] },
  { no: 14, name: 'コクーン', types: ['bug', 'poison'], base: [45, 25, 50, 25, 25] },
  { no: 15, name: 'スピアー', types: ['bug', 'poison'], base: [65, 80, 40, 45, 80] },
  { no: 16, name: 'ポッポ', types: ['normal', 'flying'], base: [40, 45, 40, 35, 35] },
  { no: 17, name: 'ピジョン', types: ['normal', 'flying'], base: [63, 60, 55, 50, 50] },
  { no: 18, name: 'ピジョット', types: ['normal', 'flying'], base: [83, 80, 75, 70, 70] },
  { no: 19, name: 'コラッタ', types: ['normal'], base: [30, 56, 35, 25, 35] },
  { no: 20, name: 'ラッタ', types: ['normal'], base: [55, 81, 60, 50, 70] },
  { no: 21, name: 'オニスズメ', types: ['normal', 'flying'], base: [40, 60, 30, 31, 31] },
  { no: 22, name: 'オニドリル', types: ['normal', 'flying'], base: [65, 90, 65, 61, 61] },
  { no: 23, name: 'アーボ', types: ['poison'], base: [35, 60, 44, 40, 54] },
  { no: 24, name: 'アーボック', types: ['poison'], base: [60, 85, 69, 65, 79] },
  { no: 25, name: 'ピカチュウ', types: ['electric'], base: [35, 55, 30, 50, 40] },
  { no: 26, name: 'ライチュウ', types: ['electric'], base: [60, 90, 55, 90, 80] },
  { no: 27, name: 'サンド', types: ['ground'], base: [50, 75, 85, 20, 30] },
  { no: 28, name: 'サンドパン', types: ['ground'], base: [75, 100, 110, 45, 55] },
  { no: 29, name: 'ニドラン♀', types: ['poison'], base: [55, 47, 52, 40, 40] },
  { no: 30, name: 'ニドリーナ', types: ['poison'], base: [70, 62, 67, 55, 55] },
  { no: 31, name: 'ニドクイン', types: ['poison', 'ground'], base: [90, 82, 87, 75, 85] },
  { no: 32, name: 'ニドラン♂', types: ['poison'], base: [46, 57, 40, 40, 40] },
  { no: 33, name: 'ニドリーノ', types: ['poison'], base: [61, 72, 57, 55, 55] },
  { no: 34, name: 'ニドキング', types: ['poison', 'ground'], base: [81, 92, 77, 85, 75] },
  { no: 35, name: 'ピッピ', types: ['normal'], base: [70, 45, 48, 60, 65] },
  { no: 36, name: 'ピクシー', types: ['normal'], base: [95, 70, 73, 85, 90] },
  { no: 37, name: 'ロコン', types: ['fire'], base: [38, 41, 40, 50, 65] },
  { no: 38, name: 'キュウコン', types: ['fire'], base: [73, 76, 75, 81, 100] },
  { no: 39, name: 'プリン', types: ['normal'], base: [115, 45, 20, 45, 25] },
  { no: 40, name: 'プクリン', types: ['normal'], base: [140, 70, 45, 75, 50] },
  { no: 41, name: 'ズバット', types: ['poison', 'flying'], base: [40, 45, 35, 30, 40] },
  { no: 42, name: 'ゴルバット', types: ['poison', 'flying'], base: [75, 80, 70, 65, 75] },
  { no: 43, name: 'ナゾノクサ', types: ['grass', 'poison'], base: [45, 50, 55, 75, 65] },
  { no: 44, name: 'クサイハナ', types: ['grass', 'poison'], base: [60, 65, 70, 85, 75] },
  { no: 45, name: 'ラフレシア', types: ['grass', 'poison'], base: [75, 80, 85, 100, 90] },
  { no: 46, name: 'パラス', types: ['bug', 'grass'], base: [35, 70, 55, 45, 55] },
  { no: 47, name: 'パラセクト', types: ['bug', 'grass'], base: [60, 95, 80, 60, 80] },
  { no: 48, name: 'コンパン', types: ['bug', 'poison'], base: [60, 55, 50, 40, 55] },
  { no: 49, name: 'モルフォン', types: ['bug', 'poison'], base: [70, 65, 60, 90, 75] },
  { no: 50, name: 'ディグダ', types: ['ground'], base: [10, 55, 25, 35, 45] },
  { no: 51, name: 'ダグトリオ', types: ['ground'], base: [35, 80, 50, 50, 70] },
  { no: 52, name: 'ニャース', types: ['normal'], base: [40, 45, 35, 40, 40] },
  { no: 53, name: 'ペルシアン', types: ['normal'], base: [65, 70, 60, 65, 65] },
  { no: 54, name: 'コダック', types: ['water'], base: [50, 52, 48, 65, 50] },
  { no: 55, name: 'ゴルダック', types: ['water'], base: [80, 82, 78, 95, 80] },
  { no: 56, name: 'マンキー', types: ['fight'], base: [40, 80, 35, 35, 45] },
  { no: 57, name: 'オコリザル', types: ['fight'], base: [65, 105, 60, 60, 70] },
  { no: 58, name: 'ガーディ', types: ['fire'], base: [55, 70, 45, 70, 50] },
  { no: 59, name: 'ウインディ', types: ['fire'], base: [90, 110, 80, 100, 80] },
  { no: 60, name: 'ニョロモ', types: ['water'], base: [40, 50, 40, 40, 40] },
  { no: 61, name: 'ニョロゾ', types: ['water'], base: [65, 65, 65, 50, 50] },
  { no: 62, name: 'ニョロボン', types: ['water', 'fight'], base: [90, 85, 95, 70, 90] },
  { no: 63, name: 'ケーシィ', types: ['psychic'], base: [25, 20, 15, 105, 55] },
  { no: 64, name: 'ユンゲラー', types: ['psychic'], base: [40, 35, 30, 120, 70] },
  { no: 65, name: 'フーディン', types: ['psychic'], base: [55, 50, 45, 135, 85] },
  { no: 66, name: 'ワンリキー', types: ['fight'], base: [70, 80, 50, 35, 35] },
  { no: 67, name: 'ゴーリキー', types: ['fight'], base: [80, 100, 70, 50, 60] },
  { no: 68, name: 'カイリキー', types: ['fight'], base: [90, 130, 80, 65, 85] },
  { no: 69, name: 'マダツボミ', types: ['grass', 'poison'], base: [50, 75, 35, 70, 30] },
  { no: 70, name: 'ウツドン', types: ['grass', 'poison'], base: [65, 90, 50, 85, 45] },
  { no: 71, name: 'ウツボット', types: ['grass', 'poison'], base: [80, 105, 65, 100, 60] },
  { no: 72, name: 'メノクラゲ', types: ['water', 'poison'], base: [40, 40, 35, 50, 100] },
  { no: 73, name: 'ドククラゲ', types: ['water', 'poison'], base: [80, 70, 65, 80, 120] },
  { no: 74, name: 'イシツブテ', types: ['rock', 'ground'], base: [40, 80, 100, 30, 30] },
  { no: 75, name: 'ゴローン', types: ['rock', 'ground'], base: [55, 95, 115, 45, 45] },
  { no: 76, name: 'ゴローニャ', types: ['rock', 'ground'], base: [80, 110, 130, 55, 65] },
  { no: 77, name: 'ポニータ', types: ['fire'], base: [50, 85, 55, 65, 65] },
  { no: 78, name: 'ギャロップ', types: ['fire'], base: [65, 100, 70, 80, 80] },
  { no: 79, name: 'ヤドン', types: ['water', 'psychic'], base: [90, 65, 65, 40, 40] },
  { no: 80, name: 'ヤドラン', types: ['water', 'psychic'], base: [95, 75, 110, 100, 80] },
  { no: 81, name: 'コイル', types: ['electric', 'steel'], base: [25, 35, 70, 95, 55] },
  { no: 82, name: 'レアコイル', types: ['electric', 'steel'], base: [50, 60, 95, 120, 70] },
  { no: 83, name: 'カモネギ', types: ['normal', 'flying'], base: [52, 65, 55, 58, 62] },
  { no: 84, name: 'ドードー', types: ['normal', 'flying'], base: [35, 85, 45, 35, 35] },
  { no: 85, name: 'ドードリオ', types: ['normal', 'flying'], base: [60, 110, 70, 60, 60] },
  { no: 86, name: 'パウワウ', types: ['water'], base: [65, 45, 55, 45, 70] },
  { no: 87, name: 'ジュゴン', types: ['water', 'ice'], base: [90, 70, 80, 70, 95] },
  { no: 88, name: 'ベトベター', types: ['poison'], base: [80, 80, 50, 40, 50] },
  { no: 89, name: 'ベトベトン', types: ['poison'], base: [105, 105, 75, 65, 100] },
  { no: 90, name: 'シェルダー', types: ['water'], base: [30, 65, 100, 45, 25] },
  { no: 91, name: 'パルシェン', types: ['water', 'ice'], base: [50, 95, 180, 85, 45] },
  { no: 92, name: 'ゴース', types: ['ghost', 'poison'], base: [30, 35, 30, 100, 35] },
  { no: 93, name: 'ゴースト', types: ['ghost', 'poison'], base: [45, 50, 45, 115, 55] },
  { no: 94, name: 'ゲンガー', types: ['ghost', 'poison'], base: [60, 65, 60, 130, 75] },
  { no: 95, name: 'イワーク', types: ['rock', 'ground'], base: [35, 45, 160, 30, 45] },
  { no: 96, name: 'スリープ', types: ['psychic'], base: [60, 48, 45, 43, 90] },
  { no: 97, name: 'スリーパー', types: ['psychic'], base: [85, 73, 70, 73, 115] },
  { no: 98, name: 'クラブ', types: ['water'], base: [30, 105, 90, 25, 25] },
  { no: 99, name: 'キングラー', types: ['water'], base: [55, 130, 115, 50, 50] },
  { no: 100, name: 'ビリリダマ', types: ['electric'], base: [40, 30, 50, 55, 55] },
  { no: 101, name: 'マルマイン', types: ['electric'], base: [60, 50, 70, 80, 80] },
  { no: 102, name: 'タマタマ', types: ['grass', 'psychic'], base: [60, 40, 80, 60, 45] },
  { no: 103, name: 'ナッシー', types: ['grass', 'psychic'], base: [95, 95, 85, 125, 65] },
  { no: 104, name: 'カラカラ', types: ['ground'], base: [50, 50, 95, 40, 50] },
  { no: 105, name: 'ガラガラ', types: ['ground'], base: [60, 80, 110, 50, 80] },
  { no: 106, name: 'サワムラー', types: ['fight'], base: [50, 120, 53, 35, 110] },
  { no: 107, name: 'エビワラー', types: ['fight'], base: [50, 105, 79, 35, 110] },
  { no: 108, name: 'ベロリンガ', types: ['normal'], base: [90, 55, 75, 60, 75] },
  { no: 109, name: 'ドガース', types: ['poison'], base: [40, 65, 95, 60, 45] },
  { no: 110, name: 'マタドガス', types: ['poison'], base: [65, 90, 120, 85, 70] },
  { no: 111, name: 'サイホーン', types: ['ground', 'rock'], base: [80, 85, 95, 30, 30] },
  { no: 112, name: 'サイドン', types: ['ground', 'rock'], base: [105, 130, 120, 45, 45] },
  { no: 113, name: 'ラッキー', types: ['normal'], base: [250, 5, 5, 35, 105] },
  { no: 114, name: 'モンジャラ', types: ['grass'], base: [65, 55, 115, 100, 40] },
  { no: 115, name: 'ガルーラ', types: ['normal'], base: [105, 95, 80, 40, 80] },
  { no: 116, name: 'タッツー', types: ['water'], base: [30, 40, 70, 70, 25] },
  { no: 117, name: 'シードラ', types: ['water'], base: [55, 65, 95, 95, 45] },
  { no: 118, name: 'トサキント', types: ['water'], base: [45, 67, 60, 35, 50] },
  { no: 119, name: 'アズマオウ', types: ['water'], base: [80, 92, 65, 65, 80] },
  { no: 120, name: 'ヒトデマン', types: ['water'], base: [30, 45, 55, 70, 55] },
  { no: 121, name: 'スターミー', types: ['water', 'psychic'], base: [60, 75, 85, 100, 85] },
  { no: 122, name: 'バリヤード', types: ['psychic'], base: [40, 45, 65, 100, 120] },
  { no: 123, name: 'ストライク', types: ['bug', 'flying'], base: [70, 110, 80, 55, 80] },
  { no: 124, name: 'ルージュラ', types: ['ice', 'psychic'], base: [65, 50, 35, 115, 95] },
  { no: 125, name: 'エレブー', types: ['electric'], base: [65, 83, 57, 95, 85] },
  { no: 126, name: 'ブーバー', types: ['fire'], base: [65, 95, 57, 100, 85] },
  { no: 127, name: 'カイロス', types: ['bug'], base: [65, 125, 100, 55, 70] },
  { no: 128, name: 'ケンタロス', types: ['normal'], base: [75, 100, 95, 40, 70] },
  { no: 129, name: 'コイキング', types: ['water'], base: [20, 10, 55, 15, 20] },
  { no: 130, name: 'ギャラドス', types: ['water', 'flying'], base: [95, 125, 79, 60, 100] },
  { no: 131, name: 'ラプラス', types: ['water', 'ice'], base: [130, 85, 80, 85, 95] },
  { no: 132, name: 'メタモン', types: ['normal'], base: [48, 48, 48, 48, 48] },
  { no: 133, name: 'イーブイ', types: ['normal'], base: [55, 55, 50, 45, 65] },
  { no: 134, name: 'シャワーズ', types: ['water'], base: [130, 65, 60, 110, 95] },
  { no: 135, name: 'サンダース', types: ['electric'], base: [65, 65, 60, 110, 95] },
  { no: 136, name: 'ブースター', types: ['fire'], base: [65, 130, 60, 95, 110] },
  { no: 137, name: 'ポリゴン', types: ['normal'], base: [65, 60, 70, 85, 75] },
  { no: 138, name: 'オムナイト', types: ['rock', 'water'], base: [35, 40, 100, 90, 55] },
  { no: 139, name: 'オムスター', types: ['rock', 'water'], base: [70, 60, 125, 115, 70] },
  { no: 140, name: 'カブト', types: ['rock', 'water'], base: [30, 80, 90, 55, 45] },
  { no: 141, name: 'カブトプス', types: ['rock', 'water'], base: [60, 115, 105, 65, 70] },
  { no: 142, name: 'プテラ', types: ['rock', 'flying'], base: [80, 105, 65, 60, 75] },
  { no: 143, name: 'カビゴン', types: ['normal'], base: [160, 110, 65, 65, 110] },
  { no: 144, name: 'フリーザー', types: ['ice', 'flying'], base: [90, 85, 100, 95, 125] },
  { no: 145, name: 'サンダー', types: ['electric', 'flying'], base: [90, 90, 85, 125, 90] },
  { no: 146, name: 'ファイヤー', types: ['fire', 'flying'], base: [90, 100, 90, 125, 85] },
  { no: 147, name: 'ミニリュウ', types: ['dragon'], base: [41, 64, 45, 50, 50] },
  { no: 148, name: 'ハクリュー', types: ['dragon'], base: [61, 84, 65, 70, 70] },
  { no: 149, name: 'カイリュー', types: ['dragon', 'flying'], base: [91, 134, 95, 100, 100] },
  { no: 150, name: 'ミュウツー', types: ['psychic'], base: [106, 110, 90, 154, 90] },
  { no: 151, name: 'ミュウ', types: ['psychic'], base: [100, 100, 100, 100, 100] },
];

// ── わざ ──────────────────────────────────────────────────────────────

/** 物理か 特殊かは タイプで 決まるので、わざ自身は 持たない。 */
type Move = {
  readonly name: string;
  readonly type: TypeKey;
  readonly power: number;
};

/**
 * ファイアレッドに ある、ダメージの 出る わざ。いりょくは 当時のもの。
 *
 * いまの作品で 数が 変わった ものが ある。かえんほうしゃ・なみのり・10まんボルト・
 * れいとうビームは 95（いまは 90）、だいもんじ・ハイドロポンプ・かみなり・ふぶきは
 * 120（いまは 110）、たいあたりは 35、とびひざげりは 100、げきりんは 90。
 *
 * 入れて いないもの。
 *  - ダメージの 出ない わざ（つるぎのまい・でんじは など）。この どうぐでは 使い道が無い。
 *  - いりょくが 場面で 変わる わざ（きしかいせい・おんがえし・マグニチュード・めざめるパワー）。
 *    1つの 数で 書けないので、書くと うそに なる。「じぶんで かく」で その場の 数を 入れる。
 *  - 一撃必殺と、いりょくが 決め打ちの わざ（じわれ・ソニックブーム・ちきゅうなげ）。
 *    ダメージが 式から 出ない。
 */
const MOVES: readonly Move[] = [
  { name: 'おうふくビンタ', type: 'normal', power: 15 },
  { name: 'みだれづき', type: 'normal', power: 15 },
  { name: 'れんぞくパンチ', type: 'normal', power: 18 },
  { name: 'たいあたり', type: 'normal', power: 35 },
  { name: 'はたく', type: 'normal', power: 40 },
  { name: 'ひっかく', type: 'normal', power: 40 },
  { name: 'でんこうせっか', type: 'normal', power: 40 },
  { name: 'みねうち', type: 'normal', power: 40 },
  { name: 'いびき', type: 'normal', power: 40 },
  { name: 'ねこにこばん', type: 'normal', power: 40 },
  { name: 'いあいぎり', type: 'normal', power: 50 },
  { name: 'はさむ', type: 'normal', power: 55 },
  { name: 'スピードスター', type: 'normal', power: 60 },
  { name: 'つのでつく', type: 'normal', power: 65 },
  { name: 'ふみつけ', type: 'normal', power: 65 },
  { name: 'ずつき', type: 'normal', power: 70 },
  { name: 'きりさく', type: 'normal', power: 70 },
  { name: 'しんそく', type: 'normal', power: 80 },
  { name: 'たたきつける', type: 'normal', power: 80 },
  { name: 'メガトンパンチ', type: 'normal', power: 80 },
  { name: 'トライアタック', type: 'normal', power: 80 },
  { name: 'のしかかり', type: 'normal', power: 85 },
  { name: 'とっしん', type: 'normal', power: 90 },
  { name: 'ロケットずつき', type: 'normal', power: 100 },
  { name: 'たまごばくだん', type: 'normal', power: 100 },
  { name: 'メガトンキック', type: 'normal', power: 120 },
  { name: 'すてみタックル', type: 'normal', power: 120 },
  { name: 'はかいこうせん', type: 'normal', power: 150 },
  { name: 'ひのこ', type: 'fire', power: 40 },
  { name: 'かえんぐるま', type: 'fire', power: 60 },
  { name: 'ほのおのパンチ', type: 'fire', power: 75 },
  { name: 'ふんえん', type: 'fire', power: 80 },
  { name: 'かえんほうしゃ', type: 'fire', power: 95 },
  { name: 'だいもんじ', type: 'fire', power: 120 },
  { name: 'オーバーヒート', type: 'fire', power: 140 },
  { name: 'あわ', type: 'water', power: 20 },
  { name: 'みずでっぽう', type: 'water', power: 40 },
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
  { name: 'かみなり', type: 'electric', power: 120 },
  { name: 'でんじほう', type: 'electric', power: 120 },
  { name: 'すいとる', type: 'grass', power: 20 },
  { name: 'つるのムチ', type: 'grass', power: 35 },
  { name: 'メガドレイン', type: 'grass', power: 40 },
  { name: 'はっぱカッター', type: 'grass', power: 55 },
  { name: 'マジカルリーフ', type: 'grass', power: 60 },
  { name: 'ギガドレイン', type: 'grass', power: 60 },
  { name: 'ニードルアーム', type: 'grass', power: 60 },
  { name: 'はなびらのまい', type: 'grass', power: 70 },
  { name: 'リーフブレード', type: 'grass', power: 70 },
  { name: 'タネばくだん', type: 'grass', power: 80 },
  { name: 'ソーラービーム', type: 'grass', power: 120 },
  { name: 'こなゆき', type: 'ice', power: 40 },
  { name: 'こごえるかぜ', type: 'ice', power: 55 },
  { name: 'オーロラビーム', type: 'ice', power: 65 },
  { name: 'れいとうパンチ', type: 'ice', power: 75 },
  { name: 'れいとうビーム', type: 'ice', power: 95 },
  { name: 'ふぶき', type: 'ice', power: 120 },
  { name: 'にどげり', type: 'fight', power: 30 },
  { name: 'マッハパンチ', type: 'fight', power: 40 },
  { name: 'からてチョップ', type: 'fight', power: 50 },
  { name: 'ローキック', type: 'fight', power: 50 },
  { name: 'まわしげり', type: 'fight', power: 60 },
  { name: 'リベンジ', type: 'fight', power: 60 },
  { name: 'とびげり', type: 'fight', power: 70 },
  { name: 'じごくぐるま', type: 'fight', power: 80 },
  { name: 'スカイアッパー', type: 'fight', power: 85 },
  { name: 'とびひざげり', type: 'fight', power: 100 },
  { name: 'クロスチョップ', type: 'fight', power: 100 },
  { name: 'ばくれつパンチ', type: 'fight', power: 100 },
  { name: 'インファイト', type: 'fight', power: 120 },
  { name: 'きあいパンチ', type: 'fight', power: 150 },
  { name: 'どくばり', type: 'poison', power: 15 },
  { name: 'ヘドロこうげき', type: 'poison', power: 65 },
  { name: 'ヘドロばくだん', type: 'poison', power: 90 },
  { name: 'ダストシュート', type: 'poison', power: 120 },
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
  { name: 'れんぞくぎり', type: 'bug', power: 10 },
  { name: 'ミサイルばり', type: 'bug', power: 14 },
  { name: 'きゅうけつ', type: 'bug', power: 20 },
  { name: 'シザークロス', type: 'bug', power: 80 },
  { name: 'メガホーン', type: 'bug', power: 120 },
  { name: 'ロックブラスト', type: 'rock', power: 25 },
  { name: 'ころがる', type: 'rock', power: 30 },
  { name: 'がんせきふうじ', type: 'rock', power: 50 },
  { name: 'いわおとし', type: 'rock', power: 50 },
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
  { name: 'つじぎり', type: 'dark', power: 70 },
  { name: 'かみくだく', type: 'dark', power: 80 },
  { name: 'メタルクロー', type: 'steel', power: 50 },
  { name: 'はがねのつばさ', type: 'steel', power: 70 },
  { name: 'コメットパンチ', type: 'steel', power: 90 },
  { name: 'アイアンテール', type: 'steel', power: 100 },
];

/** なまえ引き。じぶんで かく とき、なまえを 書いたら いりょくと タイプを 入れるのに 使う。 */
const MOVE_BY_NAME = new Map(MOVES.map((m) => [m.name, m]));

// ── 実数（ステータス）────────────────────────────────────────────────

const statHp = (base: number, level: number, iv: number, ev: number): number =>
  Math.floor(((base * 2 + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;

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
  /** てんきの ぶん。1.5 / 1 / 0.5。 */
  readonly weather: number;
  /** やけど。物理の ときだけ 0.5。 */
  readonly burn: boolean;
};

/**
 * 85〜100 の 16通りを 小さい順に かえす。第3世代の 順。
 *
 * もとの数 → てんき → やけど → ＋2 → きゅうしょ(×2) → らんすう → タイプ一致 →
 * タイプ相性。いまの作品は ＋2 を 先に 足して きゅうしょを ×1.5 にするので、
 * おなじ 場面でも 数が ずれる。
 */
const damages = (inp: Input): number[] => {
  if (inp.typeSteps.some((s) => s === 0)) return new Array<number>(16).fill(0);

  const level = Math.floor((inp.level * 2) / 5 + 2);
  const core = Math.floor(Math.floor((level * inp.power * inp.atk) / inp.def) / 50);

  let fixed = core;
  fixed = Math.floor(fixed * inp.weather);
  if (inp.burn) fixed = Math.floor(fixed * 0.5);
  fixed = Math.max(1, fixed) + 2;
  if (inp.crit) fixed *= 2;

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
.pd-app{max-width:480px;margin:0 auto}
.pd-card{background:#fffdf7;border:4px solid #78350f;border-radius:18px;
  box-shadow:0 8px 0 rgba(0,0,0,.35);padding:12px;margin-bottom:12px;box-sizing:border-box}
.pd-card h2{margin:0 0 8px;font-size:.95rem;color:#78350f;display:flex;align-items:center;gap:6px}
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
.pd-slot select.mv{flex:1 1 100%;order:5;margin-left:23px}
.pd-slot .x{order:4}
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
.pd-mx table{border-collapse:collapse;font-size:.68rem;min-width:100%}
.pd-mx th,.pd-mx td{border:1px solid #e5e7eb;padding:3px 4px;text-align:center;white-space:nowrap}
.pd-mx th{color:#78350f;font-weight:700;background:#fffdf7}
.pd-mx th.rh{text-align:left;position:sticky;left:0;z-index:1;max-width:7.5rem;
  overflow:hidden;text-overflow:ellipsis}
.pd-mx th.rh small{display:block;color:#9ca3af;font-weight:400}
.pd-mx td{cursor:pointer;font-variant-numeric:tabular-nums}
.pd-mx td b{display:block;font-size:.78rem;color:#78350f}
.pd-mx td small{color:#6b7280}
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

const monOptions: readonly Opt[] = [
  { value: OWN, label: '✏️ じぶんで かく' },
  ...MONS.map((m) => ({ value: String(m.no), label: `${pad(m.no)} ${m.name}` })),
];
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
 * 125本を 1列に ならべると 探せない。まとめると ついでに、どの タイプが 物理で
 * どれが 特殊かも 見える——第3世代は そこが わざ ではなく タイプで 決まるので、
 * いまの作品から 来た人が いちばん まちがえる ところ。
 */
const fillMoves = (node: HTMLSelectElement, value: string): void => {
  const own = el('option');
  own.value = OWN;
  own.textContent = '✏️ じぶんで かく';
  const parts: HTMLElement[] = [own];
  for (const t of TYPE_ORDER) {
    const group = el('optgroup');
    group.label = `${TYPE_NAME[t]}（${isPhysical(t) ? '物理' : '特殊'}）`;
    MOVES.forEach((m, i) => {
      if (m.type !== t) return;
      const opt = el('option');
      opt.value = String(i);
      opt.textContent = `${m.name} ${m.power}`;
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
  readonly moveSel: HTMLSelectElement;
  readonly del: HTMLButtonElement;
  /** 「じぶんで かく」を えらんだ ときの 中身。 */
  own: Mon;
  ownTouched: boolean;
  /** ゲームの がめんを 見て 書いた すうじ。HP・こうげき・ぼうぎょ・とくこう・とくぼう。 */
  typed: [number, number, number, number, number];
  typedTouched: boolean;
  ownMoveName: string;
  ownMoveType: TypeKey;
  /** 手で 書きかえた いりょく。null なら わざの ままの いりょく。 */
  power: number | null;
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

const moveOf = (slot: Slot): Move => {
  if (slot.moveSel.value === OWN) {
    return {
      name: slot.ownMoveName.trim() || 'じぶんの わざ',
      type: slot.ownMoveType,
      power: slot.power ?? 80,
    };
  }
  const m = MOVES[Number(slot.moveSel.value)] ?? MOVES[0]!;
  return slot.power === null ? m : { ...m, power: slot.power };
};

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

export const mountPokeDamage: GameMount = (host, _ctx) => {
  const style = el('style');
  style.textContent = CSS;

  const page = el('div', 'pd');
  const app = el('div', 'pd-app');
  page.appendChild(app);

  // ── しかけの 置き場 ────────────────────────────────────────────

  type SideKey = 'mine' | 'theirs';

  const slots: Record<SideKey, Slot[]> = { mine: [], theirs: [] };
  const ctl = {} as Record<SideKey, SideCtl>;
  const detail = {} as Record<SideKey, {
    readonly ownWrap: HTMLElement;
    readonly ownName: HTMLInputElement;
    readonly ownT1: HTMLSelectElement;
    readonly ownT2: HTMLSelectElement;
    readonly ownBase: readonly HTMLInputElement[];
    readonly types: HTMLElement;
    readonly seed: HTMLElement;
    readonly moveWrap: HTMLElement;
    readonly moveName: HTMLInputElement;
    readonly moveType: HTMLSelectElement;
    readonly powerRow: HTMLElement;
    readonly power: HTMLInputElement;
    readonly typedWrap: HTMLElement;
    readonly typedInputs: readonly HTMLInputElement[];
    readonly note: HTMLElement;
    readonly ivRow: HTMLElement;
    readonly hpEvRow: HTMLElement;
    readonly evRow: HTMLElement;
    readonly natureRow: HTMLElement;
  }>;

  const chosen = (side: SideKey): Slot =>
    slots[side].find((s) => s.radio.checked) ?? slots[side][0]!;

  const isTyped = (side: SideKey): boolean => ctl[side].source.value === 'typed';

  // 「むき」。どちらが せめるかを 決める。
  const dir = select([
    { value: 'mine', label: 'じぶん → あいて（こちらが せめる）' },
    { value: 'theirs', label: 'あいて → じぶん（こちらが 受ける）' },
  ], 'mine');
  const attacker = (): SideKey => (dir.value === 'theirs' ? 'theirs' : 'mine');
  const defender = (): SideKey => (dir.value === 'theirs' ? 'mine' : 'theirs');

  // ── 1匹ぶんの すうじ ──────────────────────────────────────────

  const offenceOf = (slot: Slot, side: SideKey, physical: boolean): number => {
    if (isTyped(side)) return slot.typed[physical ? 1 : 3];
    const mon = monOf(slot);
    return statOther(
      mon.base[physical ? 1 : 3], levelOf(slot),
      Number(ctl[side].iv.value), Number(ctl[side].ev.value), Number(ctl[side].nature.value),
    );
  };

  const defenceOf = (slot: Slot, side: SideKey, physical: boolean): number => {
    if (isTyped(side)) return slot.typed[physical ? 2 : 4];
    const mon = monOf(slot);
    return statOther(
      mon.base[physical ? 2 : 4], levelOf(slot),
      Number(ctl[side].iv.value), Number(ctl[side].ev.value), Number(ctl[side].nature.value),
    );
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

  const pairOf = (atkSlot: Slot, defSlot: Slot): Pair => {
    const atkSide = attacker();
    const defSide = defender();
    const mv = moveOf(atkSlot);
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
    const steps = typeSteps(mv.type, defMon.types);
    const typeMul = steps.reduce((a, b) => a * b, 1);
    const weatherMul = weather.value === 'sun'
      ? (mv.type === 'fire' ? 1.5 : mv.type === 'water' ? 0.5 : 1)
      : weather.value === 'rain'
        ? (mv.type === 'water' ? 1.5 : mv.type === 'fire' ? 0.5 : 1)
        : 1;
    const burned = physical && burn.checked;

    const rolls = damages({
      level: levelOf(atkSlot), power: mv.power, atk: atkUsed, def: defUsed,
      stab, typeSteps: steps, crit: crit.checked, weather: weatherMul, burn: burned,
    });
    return {
      mv, physical, atkMon, defMon, atkStat, defStat, atkUsed, defUsed, hp, stab, typeMul,
      lo: rolls[0] ?? 0, hi: rolls[rolls.length - 1] ?? 0,
      weather: weatherMul, burn: burned, crit: crit.checked,
    };
  };

  // ── てもちの 1行 ──────────────────────────────────────────────

  const makeSlot = (side: SideKey, monValue: string, level: number, moveValue: string): Slot => {
    const wrap = el('div', 'pd-slot');
    const radio = el('input');
    radio.type = 'radio';
    radio.name = `pd-${side}`;
    const monSel = select(monOptions, monValue);
    const levelInput = numInput('lv', String(level), 1, 100);
    const moveSel = el('select', 'mv');
    fillMoves(moveSel, moveValue);
    const del = el('button', 'x', '✕');
    del.type = 'button';
    wrap.append(radio, monSel, levelInput, moveSel, del);

    const base = MON_BY_NO.get(monValue) ?? MONS[0]!;
    const slot: Slot = {
      wrap, radio, monSel, levelInput, moveSel, del,
      own: { no: 0, name: 'じぶんの ポケモン', types: ['normal'], base: [100, 100, 100, 100, 100] },
      ownTouched: false,
      typed: computedStats(base, level, 31),
      typedTouched: false,
      ownMoveName: 'じぶんの わざ',
      ownMoveType: 'normal',
      power: null,
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
    card.appendChild(el('h2', undefined, title));

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

    const push = (no: string, level: number, moveValue: string, checked: boolean): void => {
      if (slots[side].length >= MAX_SLOTS) return;
      const slot = makeSlot(side, no, level, moveValue);
      slot.radio.checked = checked;
      slots[side].push(slot);
      list.appendChild(slot.wrap);
    };
    push(firstNo, 50, String(MOVES.findIndex((m) => m.name === 'たいあたり')), true);
    push(secondNo, 50, String(MOVES.findIndex((m) => m.name === 'たいあたり')), false);
    add.addEventListener('click', () => {
      push('1', 50, String(MOVES.findIndex((m) => m.name === 'たいあたり')), false);
      render();
    });

    // しぼりこみは この がわの ぜんぶの えらびかたに かかる。いま えらんで いる ものは、
    // しぼった 先に 残らなくても 消さない。字を 打った とたんに 選びなおしに なるため。
    find.addEventListener('input', () => {
      const q = find.value.trim();
      for (const slot of slots[side]) {
        const kept = slot.monSel.value;
        const matched = q === ''
          ? monOptions
          : monOptions.filter((o) => o.value === OWN || o.value === kept || o.label.includes(q));
        fill(slot.monSel, matched.length > 1 ? matched : monOptions, kept);
      }
    });

    card.appendChild(el('h3', undefined, 'えらんで いる ポケモン'));

    // じぶんで かく ポケモン。一覧は カントー図鑑の 151匹だけ なので、ほかの 地方の
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
    ownWrap.append(
      row('なまえ', ownName), row('タイプ1', ownT1), row('タイプ2', ownT2),
      row('しゅぞくち', ownBaseBox),
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
      };
      slot.ownTouched = true;
    };
    ownWrap.addEventListener('input', onOwnEdit);
    ownWrap.addEventListener('change', onOwnEdit);
    card.appendChild(ownWrap);

    const types = el('div');
    const seed = el('div');
    card.append(types, seed);

    // じぶんで かく わざ。なまえが 一覧に ある ものと 合えば、いりょくと タイプを
    // そのまま 入れる。打ちまちがいや、一覧に 無い わざは、手で 直せば いい。
    const powerInput = numInput('num', '80', 1, 250);
    const powerRow = row('いりょく', powerInput);
    powerInput.addEventListener('input', () => {
      chosen(side).power = readNum(powerInput.value, 80, 1, 250);
    });

    const moveWrap = el('div', 'pd-own');
    const moveName = el('input');
    moveName.type = 'text';
    moveName.maxLength = 12;
    const moveType = select(typeOptions, 'normal');
    moveWrap.append(row('わざの なまえ', moveName), row('タイプ', moveType));
    const onMoveEdit = (e: Event): void => {
      const slot = chosen(side);
      slot.ownMoveName = moveName.value;
      const known = MOVE_BY_NAME.get(moveName.value.trim());
      if (known && e.target === moveName) {
        moveType.value = known.type;
        powerInput.value = String(known.power);
        slot.power = known.power;
      }
      slot.ownMoveType = moveType.value as TypeKey;
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
      ownWrap, ownName, ownT1, ownT2, ownBase, types, seed,
      moveWrap, moveName, moveType, powerRow, power: powerInput,
      typedWrap, typedInputs, note, ivRow, hpEvRow, evRow, natureRow,
    };
    return card;
  };

  const mineCard = buildSide('mine', '🎒 じぶんの てもち', '4', '25');
  const theirsCard = buildSide('theirs', '👹 あいての てもち', '16', '19');

  // ── そのほか ──────────────────────────────────────────────────

  const optCard = el('div', 'pd-card');
  optCard.appendChild(el('h2', undefined, '🌤️ そのほか'));
  const checks = el('div', 'pd-checks');
  const critLabel = el('label');
  critLabel.append(crit, document.createTextNode('きゅうしょに あたる（× 2）'));
  const burnLabel = el('label');
  burnLabel.append(burn, document.createTextNode('せめる がわが やけど'));
  checks.append(critLabel, burnLabel);
  optCard.append(row('むき', dir), row('てんき', weather), checks);

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
  const mxNote = el('p', 'pd-note');
  const mx = el('div', 'pd-mx');
  mxCard.append(mxNote, mx);

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
    + ' もちもの・とくせい・リフレクターは 入れて いない。'));

  app.append(mineCard, theirsCard, optCard, outCard, mxCard, noteCard);

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
    }

    d.moveWrap.hidden = slot.moveSel.value !== OWN;
    if (!d.moveWrap.hidden) {
      put(d.moveName, slot.ownMoveName);
      put(d.moveType, slot.ownMoveType);
    }
    const mv = moveOf(slot);
    put(d.power, String(mv.power));
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
      pct.textContent = `${pair.mv.name}（${TYPE_NAME[pair.mv.type]}）は ${pair.defMon.name} に きかない。`;
      barMin.style.width = '0';
      barMax.style.width = '0';
      ko.textContent = 'たおせない。べつの タイプの わざを ためしてみよう。';
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
      ['いりょく', String(pair.mv.power)],
      [pair.physical ? 'こうげき' : 'とくこう', String(pair.atkUsed)],
      [pair.physical ? 'ぼうぎょ' : 'とくぼう', String(pair.defUsed)],
      ['まもる がわの HP', String(pair.hp)],
      ['タイプ一致', pair.stab ? '× 1.5' : '× 1'],
      ['タイプ相性', `× ${pair.typeMul}`],
      ['てんき', `× ${pair.weather}`],
      ['きゅうしょ', pair.crit ? '× 2' : '× 1'],
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
   * ますには「かくじつに たおせる 回数」を 出す。いちばん 小さい ダメージで 数えるので、
   * ここに 3 と 出て いれば、運が わるくても 3発で 終わる。下の % は いちばん 大きい
   * ダメージの ぶん。ますを 押すと、その 組み合わせが 上の けいさんに 出る。
   */
  const renderMatrix = (): void => {
    const atkSide = attacker();
    const defSide = defender();
    mxNote.textContent = atkSide === 'mine'
      ? 'よこが あいて、たては じぶん。ますの すうじは、かくじつに たおせる はっすう。'
      : 'よこが じぶん、たては あいて。ますの すうじは、かくじつに たおされる はっすう。';

    const table2 = el('table');
    const head = el('tr');
    head.appendChild(el('th', 'rh', ''));
    for (const d of slots[defSide]) head.appendChild(el('th', undefined, monOf(d).name));
    table2.appendChild(head);

    for (const a of slots[atkSide]) {
      const tr = el('tr');
      const th = el('th', 'rh');
      th.append(document.createTextNode(monOf(a).name), el('small', undefined, moveOf(a).name));
      tr.appendChild(th);
      for (const d of slots[defSide]) {
        const pair = pairOf(a, d);
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
        if (a.radio.checked && d.radio.checked) td.classList.add('sel');
        td.addEventListener('click', () => {
          a.radio.checked = true;
          d.radio.checked = true;
          render();
        });
        tr.appendChild(td);
      }
      table2.appendChild(tr);
    }
    mx.replaceChildren(table2);
  };

  function render(): void {
    const atkSide = attacker();
    const defSide = defender();
    const pair = pairOf(chosen(atkSide), chosen(defSide));

    // やけどが 効くのは 物理 だけ。特殊の タイプの あいだは さわれなくする。
    burn.disabled = !pair.physical;
    burnLabel.style.opacity = pair.physical ? '1' : '.45';

    renderSide(atkSide, 'attack', pair);
    renderSide(defSide, 'defend', pair);
    renderOut(pair);
    renderMatrix();
  }

  // どれが 変わっても やることは おなじ（計算を やり直す）ので、1つずつ つなぐより
  // まとめて 1か所で 受ける。わざを えらび直した ときだけ、先に いりょくを もどす。
  const onChange = (e: Event): void => {
    for (const side of ['mine', 'theirs'] as const) {
      for (const slot of slots[side]) {
        if (e.target === slot.moveSel) slot.power = null;
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

  host.replaceChildren(style, page);
  render();

  return () => {
    page.removeEventListener('change', onChange);
    page.removeEventListener('input', onChange);
    host.replaceChildren();
  };
};
