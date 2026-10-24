// ポケモン ダメージけいさん。
//
// あそびばの中では めずらしく「どうぐ」で、遊んで点を出すものではない。だから
// onFinish は 一度も 呼ばない（表の ranking は 'none'）。ランキングに ならばない
// かわりに、ログインも 保存も 要らない。
//
// 中身は しくみを 見せることが 目的なので、式を 隠さない。出した数と いっしょに、
// 使った こうげき・ぼうぎょ・HP の 実数も ならべて 出す。子どもが「なぜ この数に
// なったか」を たどれないと、計算機は ただの 黒い箱に なる。
//
// 決めごと。
//  - 外から CSS も 絵も 取らない。ポケモンは 名前と すうじ だけで あらわす。
//  - ランクを 上げ下げする 式（(2+r)/2 と 2/(2-r)）は 第5世代 以降の かたち。
//  - かけ算の まるめは 各段で きりすて（Math.floor）に して ある。本物は 4096分の1の
//    まるめを 使うので、特性や もちものが 重なる 場面では 1〜2 ずれることが ある。
//    そこを 合わせると 式が 読めなくなるので、ここでは 読める方を とった。
//  - のう（きあいのタスキ・とくせい・もちもの・ダブルの ちょうせい）は 持たない。
//    持ちはじめると「どれを 持っていて どれを 持っていないか」が 分からなくなる。

import type { GameMount } from './types';

// ── タイプ ────────────────────────────────────────────────────────────

type TypeKey =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice'
  | 'fight' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug'
  | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';

const TYPE_NAME: Record<TypeKey, string> = {
  normal: 'ノーマル', fire: 'ほのお', water: 'みず', electric: 'でんき',
  grass: 'くさ', ice: 'こおり', fight: 'かくとう', poison: 'どく',
  ground: 'じめん', flying: 'ひこう', psychic: 'エスパー', bug: 'むし',
  rock: 'いわ', ghost: 'ゴースト', dragon: 'ドラゴン', dark: 'あく',
  steel: 'はがね', fairy: 'フェアリー',
};

/** タイプの いろ。わざと 相手の タイプに 付ける ふだの 色。 */
const TYPE_COLOR: Record<TypeKey, string> = {
  normal: '#9ca3af', fire: '#ef4444', water: '#3b82f6', electric: '#eab308',
  grass: '#22c55e', ice: '#38bdf8', fight: '#b91c1c', poison: '#a855f7',
  ground: '#b45309', flying: '#60a5fa', psychic: '#ec4899', bug: '#84cc16',
  rock: '#a16207', ghost: '#7c3aed', dragon: '#4f46e5', dark: '#475569',
  steel: '#64748b', fairy: '#f472b6',
};

/**
 * わざの タイプが、受ける タイプに どれだけ 効くか。
 *
 * 書いて ない ところは 1倍。2つ タイプを 持つ 相手には、2つ ぶんを かける
 * （みず が くさ・じめん の 相手に 0.5 × 2 = 1倍 に なるのは これ）。
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
    rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5,
  },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fight: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fight: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: {
    fire: 0.5, grass: 2, fight: 0.5, poison: 0.5, flying: 0.5, psychic: 2,
    ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5,
  },
  rock: { fire: 2, ice: 2, fight: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fight: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fight: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

/** わざ1つが 相手に 何倍 効くか。0 なら きかない。 */
const effectiveness = (move: TypeKey, defender: readonly TypeKey[]): number =>
  defender.reduce((acc, t) => acc * (CHART[move][t] ?? 1), 1);

// ── ポケモン と わざ ──────────────────────────────────────────────────

/** base は しゅぞくち。HP・こうげき・ぼうぎょ・とくこう・とくぼう・すばやさ の順。 */
type Mon = {
  readonly name: string;
  readonly types: readonly TypeKey[];
  readonly base: readonly [number, number, number, number, number, number];
};

const MONS: readonly Mon[] = [
  { name: 'フシギバナ', types: ['grass', 'poison'], base: [80, 82, 83, 100, 100, 80] },
  { name: 'リザードン', types: ['fire', 'flying'], base: [78, 84, 78, 109, 85, 100] },
  { name: 'カメックス', types: ['water'], base: [79, 83, 100, 85, 105, 78] },
  { name: 'ピカチュウ', types: ['electric'], base: [35, 55, 40, 50, 50, 90] },
  { name: 'ライチュウ', types: ['electric'], base: [60, 90, 55, 90, 80, 110] },
  { name: 'イーブイ', types: ['normal'], base: [55, 55, 50, 45, 65, 55] },
  { name: 'サンダース', types: ['electric'], base: [65, 65, 60, 110, 95, 130] },
  { name: 'ニンフィア', types: ['fairy'], base: [95, 65, 65, 110, 130, 60] },
  { name: 'カビゴン', types: ['normal'], base: [160, 110, 65, 65, 110, 30] },
  { name: 'ゲンガー', types: ['ghost', 'poison'], base: [60, 65, 60, 130, 75, 110] },
  { name: 'フーディン', types: ['psychic'], base: [55, 50, 45, 135, 95, 120] },
  { name: 'ヤドラン', types: ['water', 'psychic'], base: [95, 75, 110, 100, 80, 30] },
  { name: 'ギャラドス', types: ['water', 'flying'], base: [95, 125, 79, 60, 100, 81] },
  { name: 'ラプラス', types: ['water', 'ice'], base: [130, 85, 80, 85, 95, 60] },
  { name: 'ウインディ', types: ['fire'], base: [90, 110, 80, 100, 80, 95] },
  { name: 'ニドキング', types: ['poison', 'ground'], base: [81, 92, 77, 85, 75, 85] },
  { name: 'ピジョット', types: ['normal', 'flying'], base: [83, 80, 75, 70, 70, 101] },
  { name: 'カイリュー', types: ['dragon', 'flying'], base: [91, 134, 95, 100, 100, 80] },
  { name: 'ミュウツー', types: ['psychic'], base: [106, 110, 90, 154, 90, 130] },
  { name: 'ミュウ', types: ['psychic'], base: [100, 100, 100, 100, 100, 100] },
  { name: 'ハガネール', types: ['steel', 'ground'], base: [75, 85, 200, 55, 65, 30] },
  { name: 'ハッサム', types: ['bug', 'steel'], base: [70, 130, 100, 55, 80, 65] },
  { name: 'キングドラ', types: ['water', 'dragon'], base: [75, 95, 95, 95, 95, 85] },
  { name: 'バンギラス', types: ['rock', 'dark'], base: [100, 134, 110, 95, 100, 61] },
  { name: 'ジュカイン', types: ['grass'], base: [70, 85, 65, 105, 85, 120] },
  { name: 'バシャーモ', types: ['fire', 'fight'], base: [80, 120, 70, 110, 70, 80] },
  { name: 'ラグラージ', types: ['water', 'ground'], base: [100, 110, 90, 85, 90, 60] },
  { name: 'サーナイト', types: ['psychic', 'fairy'], base: [68, 65, 65, 125, 115, 80] },
  { name: 'サメハダー', types: ['water', 'dark'], base: [70, 120, 40, 95, 40, 95] },
  { name: 'ボーマンダ', types: ['dragon', 'flying'], base: [95, 135, 80, 110, 80, 100] },
  { name: 'メタグロス', types: ['steel', 'psychic'], base: [80, 135, 130, 95, 90, 70] },
  { name: 'ジバコイル', types: ['electric', 'steel'], base: [70, 70, 115, 130, 90, 60] },
  { name: 'ルカリオ', types: ['fight', 'steel'], base: [70, 110, 70, 115, 70, 90] },
  { name: 'ヒードラン', types: ['fire', 'steel'], base: [91, 90, 106, 130, 106, 77] },
  { name: 'ガブリアス', types: ['dragon', 'ground'], base: [108, 130, 95, 80, 85, 102] },
  { name: 'ゲッコウガ', types: ['water', 'dark'], base: [72, 95, 67, 103, 71, 122] },
  { name: 'ミミッキュ', types: ['ghost', 'fairy'], base: [55, 90, 80, 50, 105, 96] },
  { name: 'エースバーン', types: ['fire'], base: [80, 116, 75, 65, 75, 119] },
  { name: 'ドラパルト', types: ['dragon', 'ghost'], base: [88, 120, 75, 100, 75, 142] },
];

/** 物理は こうげき と ぼうぎょ、特殊は とくこう と とくぼう で 計算する。 */
type Category = 'physical' | 'special';

type Move = {
  readonly name: string;
  readonly type: TypeKey;
  readonly power: number;
  readonly cat: Category;
};

const MOVES: readonly Move[] = [
  { name: 'たいあたり', type: 'normal', power: 40, cat: 'physical' },
  { name: 'でんこうせっか', type: 'normal', power: 40, cat: 'physical' },
  { name: 'すてみタックル', type: 'normal', power: 120, cat: 'physical' },
  { name: 'はかいこうせん', type: 'normal', power: 150, cat: 'special' },
  { name: 'かえんほうしゃ', type: 'fire', power: 90, cat: 'special' },
  { name: 'だいもんじ', type: 'fire', power: 110, cat: 'special' },
  { name: 'フレアドライブ', type: 'fire', power: 120, cat: 'physical' },
  { name: 'たきのぼり', type: 'water', power: 80, cat: 'physical' },
  { name: 'なみのり', type: 'water', power: 90, cat: 'special' },
  { name: 'ハイドロポンプ', type: 'water', power: 110, cat: 'special' },
  { name: '10まんボルト', type: 'electric', power: 90, cat: 'special' },
  { name: 'かみなり', type: 'electric', power: 110, cat: 'special' },
  { name: 'ワイルドボルト', type: 'electric', power: 90, cat: 'physical' },
  { name: 'はっぱカッター', type: 'grass', power: 55, cat: 'physical' },
  { name: 'エナジーボール', type: 'grass', power: 90, cat: 'special' },
  { name: 'リーフブレード', type: 'grass', power: 90, cat: 'physical' },
  { name: 'れいとうビーム', type: 'ice', power: 90, cat: 'special' },
  { name: 'ふぶき', type: 'ice', power: 110, cat: 'special' },
  { name: 'つららおとし', type: 'ice', power: 85, cat: 'physical' },
  { name: 'インファイト', type: 'fight', power: 120, cat: 'physical' },
  { name: 'とびひざげり', type: 'fight', power: 130, cat: 'physical' },
  { name: 'きあいだま', type: 'fight', power: 120, cat: 'special' },
  { name: 'どくづき', type: 'poison', power: 80, cat: 'physical' },
  { name: 'ヘドロばくだん', type: 'poison', power: 90, cat: 'special' },
  { name: 'じしん', type: 'ground', power: 100, cat: 'physical' },
  { name: 'だいちのちから', type: 'ground', power: 90, cat: 'special' },
  { name: 'エアスラッシュ', type: 'flying', power: 75, cat: 'special' },
  { name: 'ブレイブバード', type: 'flying', power: 120, cat: 'physical' },
  { name: 'サイコキネシス', type: 'psychic', power: 90, cat: 'special' },
  { name: 'シザークロス', type: 'bug', power: 80, cat: 'physical' },
  { name: 'とんぼがえり', type: 'bug', power: 70, cat: 'physical' },
  { name: 'いわなだれ', type: 'rock', power: 75, cat: 'physical' },
  { name: 'ストーンエッジ', type: 'rock', power: 100, cat: 'physical' },
  { name: 'かげうち', type: 'ghost', power: 40, cat: 'physical' },
  { name: 'シャドーボール', type: 'ghost', power: 80, cat: 'special' },
  { name: 'りゅうのはどう', type: 'dragon', power: 85, cat: 'special' },
  { name: 'げきりん', type: 'dragon', power: 120, cat: 'physical' },
  { name: 'りゅうせいぐん', type: 'dragon', power: 130, cat: 'special' },
  { name: 'かみくだく', type: 'dark', power: 80, cat: 'physical' },
  { name: 'あくのはどう', type: 'dark', power: 80, cat: 'special' },
  { name: 'アイアンヘッド', type: 'steel', power: 80, cat: 'physical' },
  { name: 'ラスターカノン', type: 'steel', power: 80, cat: 'special' },
  { name: 'じゃれつく', type: 'fairy', power: 90, cat: 'physical' },
  { name: 'ムーンフォース', type: 'fairy', power: 95, cat: 'special' },
];

// ── 実数（ステータス）────────────────────────────────────────────────

/** こたいちは 31 で 固定。えらべる ようにすると、いじる ところが 多すぎる。 */
const IV = 31;

const statHp = (base: number, level: number, ev: number): number =>
  Math.floor(((base * 2 + IV + Math.floor(ev / 4)) * level) / 100) + level + 10;

/** nature は せいかくの ぶん（1.1 / 1.0 / 0.9）。 */
const statOther = (base: number, level: number, ev: number, nature: number): number =>
  Math.floor((Math.floor(((base * 2 + IV + Math.floor(ev / 4)) * level) / 100) + 5) * nature);

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
  readonly type: number;
  readonly crit: boolean;
  /** てんきの ぶん。1.5 / 1 / 0.5。 */
  readonly weather: number;
  /** やけど。物理の ときだけ 0.5。 */
  readonly burn: boolean;
};

/**
 * 85〜100 の 16通りを 小さい順に かえす。
 *
 * かける 順番が 結果を 変える（きりすてが 各段で 入るので）。本物と おなじ 順で、
 * もとの数 → てんき → きゅうしょ → らんすう → タイプ一致 → タイプ相性 → やけど。
 */
const damages = (inp: Input): number[] => {
  if (inp.type === 0) return new Array<number>(16).fill(0);

  const level = Math.floor((inp.level * 2) / 5 + 2);
  const base = Math.floor(Math.floor((level * inp.power * inp.atk) / inp.def) / 50) + 2;

  const out: number[] = [];
  for (let r = 85; r <= 100; r += 1) {
    let d = base;
    d = Math.floor(d * inp.weather);
    if (inp.crit) d = Math.floor(d * 1.5);
    d = Math.floor((d * r) / 100);
    if (inp.stab) d = Math.floor(d * 1.5);
    d = Math.floor(d * inp.type);
    if (inp.burn) d = Math.floor(d * 0.5);
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
.pd-lead{font-size:.74rem;color:#6b7280;margin:0 0 10px;line-height:1.6}
.pd-row{display:flex;align-items:center;gap:8px;margin-bottom:7px}
.pd-row>label{flex:0 0 5.6rem;font-size:.76rem;color:#78350f;font-weight:700}
.pd-row>select,.pd-row>input{flex:1 1 auto;min-width:0;background:#fff;border:2px solid #b45309;
  border-radius:10px;padding:5px 8px;font:inherit;font-size:.82rem;color:#1f2937}
.pd-row>input[type=number]{flex:0 0 5rem}
.pd-sub{font-size:.72rem;color:#6b7280;margin:-2px 0 8px}
.pd-chips{display:flex;flex-wrap:wrap;gap:4px;margin:-3px 0 8px calc(5.6rem + 8px)}
.pd-chip{color:#fff;font-size:.68rem;font-weight:700;padding:1px 9px;border-radius:999px;
  text-shadow:1px 1px 1px rgba(0,0,0,.25)}
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
.pd-bar i{position:absolute;left:0;top:0;bottom:0;background:#f59e0b;display:block}
.pd-bar i.max{background:#fca5a5}
.pd-table{width:100%;border-collapse:collapse;font-size:.74rem;margin-top:8px}
.pd-table th,.pd-table td{border-bottom:1px solid #e5e7eb;padding:3px 4px;text-align:left;color:#374151}
.pd-table td.num{text-align:right;font-variant-numeric:tabular-nums}
.pd-note{font-size:.7rem;color:#6b7280;line-height:1.7;margin:0}
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

/** えらぶ ところを 1つ 作る。値は くらいの 添字（文字列）で もつ。 */
const select = (options: readonly { readonly value: string; readonly label: string }[],
  value: string): HTMLSelectElement => {
  const node = el('select');
  for (const o of options) {
    const opt = el('option');
    opt.value = o.value;
    opt.textContent = o.label;
    node.appendChild(opt);
  }
  node.value = value;
  return node;
};

/**
 * 入れた すうじを よむ。
 *
 * 空に したときと 0 を 入れたときを 分ける。`Number(raw) || fallback` で 済ませると、
 * 0 が うその値（falsy）なので、0 を 入れた人に 既定の 50 が 返る——入れた数と
 * 出た数が 合わなくなる。空なら 既定に もどし、0 なら 下限まで 下げる。
 */
const readNum = (raw: string, fallback: number, lo: number, hi: number): number => {
  if (raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(n)));
};

const row = (label: string, ...controls: readonly HTMLElement[]): HTMLElement => {
  const r = el('div', 'pd-row');
  r.appendChild(el('label', undefined, label));
  for (const c of controls) r.appendChild(c);
  return r;
};

const monOptions = MONS.map((m, i) => ({ value: String(i), label: m.name }));
const moveOptions = MOVES.map((m, i) => ({
  value: String(i),
  label: `${m.name}（${TYPE_NAME[m.type]}・${m.cat === 'physical' ? '物理' : '特殊'}・${m.power}）`,
}));
const rankOptions = [6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6].map((r) => ({
  value: String(r),
  label: r === 0 ? '± 0' : r > 0 ? `+ ${r}` : `− ${-r}`,
}));
const evOptions = [
  { value: '0', label: '0（ふりきらない）' },
  { value: '252', label: '252（めいっぱい）' },
];
const natureOptions = [
  { value: '1.1', label: 'あがる（× 1.1）' },
  { value: '1', label: 'ふつう（× 1.0）' },
  { value: '0.9', label: 'さがる（× 0.9）' },
];

const typeChips = (types: readonly TypeKey[]): HTMLElement => {
  const box = el('div', 'pd-chips');
  for (const t of types) {
    const chip = el('span', 'pd-chip', TYPE_NAME[t]);
    chip.style.background = TYPE_COLOR[t];
    box.appendChild(chip);
  }
  return box;
};

const monAt = (sel: HTMLSelectElement): Mon => MONS[Number(sel.value)] ?? MONS[0]!;
const moveAt = (sel: HTMLSelectElement): Move => MOVES[Number(sel.value)] ?? MOVES[0]!;

export const mountPokeDamage: GameMount = (host, _ctx) => {
  const style = el('style');
  style.textContent = CSS;

  const page = el('div', 'pd');
  const app = el('div', 'pd-app');
  page.appendChild(app);

  // ── せめる がわ ──
  const atkCard = el('div', 'pd-card');
  atkCard.appendChild(el('h2', undefined, '⚔️ せめる ポケモン'));
  const atkMon = select(monOptions, String(MONS.findIndex((m) => m.name === 'リザードン')));
  const atkTypes = el('div');
  const atkLevel = el('input');
  atkLevel.type = 'number';
  atkLevel.min = '1';
  atkLevel.max = '100';
  atkLevel.value = '50';
  const atkEv = select(evOptions, '252');
  const atkNature = select(natureOptions, '1.1');
  const atkRank = select(rankOptions, '0');
  const move = select(moveOptions, String(MOVES.findIndex((m) => m.name === 'だいもんじ')));
  const power = el('input');
  power.type = 'number';
  power.min = '1';
  power.max = '250';
  const atkNote = el('div', 'pd-sub');
  atkCard.append(
    row('ポケモン', atkMon),
    atkTypes,
    row('レベル', atkLevel),
    row('どりょく', atkEv),
    row('せいかく', atkNature),
    row('ランク', atkRank),
    row('わざ', move),
    row('いりょく', power),
    atkNote,
  );

  // ── まもる がわ ──
  const defCard = el('div', 'pd-card');
  defCard.appendChild(el('h2', undefined, '🛡️ まもる ポケモン'));
  const defMon = select(monOptions, String(MONS.findIndex((m) => m.name === 'カメックス')));
  const defTypes = el('div');
  const defLevel = el('input');
  defLevel.type = 'number';
  defLevel.min = '1';
  defLevel.max = '100';
  defLevel.value = '50';
  const defHpEv = select(evOptions, '252');
  const defEv = select(evOptions, '252');
  const defNature = select(natureOptions, '1');
  const defRank = select(rankOptions, '0');
  const defNote = el('div', 'pd-sub');
  defCard.append(
    row('ポケモン', defMon),
    defTypes,
    row('レベル', defLevel),
    row('HPどりょく', defHpEv),
    row('ぼうぎょ', defEv),
    row('せいかく', defNature),
    row('ランク', defRank),
    defNote,
  );

  // ── そのほか ──
  const optCard = el('div', 'pd-card');
  optCard.appendChild(el('h2', undefined, '🌤️ そのほか'));
  const weather = select([
    { value: 'none', label: 'なし' },
    { value: 'sun', label: 'ひざしが つよい' },
    { value: 'rain', label: 'あめ' },
  ], 'none');
  const crit = el('input');
  crit.type = 'checkbox';
  const burn = el('input');
  burn.type = 'checkbox';
  const checks = el('div', 'pd-checks');
  const critLabel = el('label');
  critLabel.append(crit, document.createTextNode('きゅうしょに あたる'));
  const burnLabel = el('label');
  burnLabel.append(burn, document.createTextNode('せめる がわが やけど'));
  checks.append(critLabel, burnLabel);
  optCard.append(row('てんき', weather), checks);

  const swap = el('button', 'pd-swap', '🔁 せめる がわと まもる がわを 入れかえる');
  swap.type = 'button';

  // ── こたえ ──
  const outCard = el('div', 'pd-card');
  outCard.appendChild(el('h2', undefined, '📊 けいさん'));
  const out = el('div', 'pd-out');
  const eff = el('p', 'pd-eff');
  const big = el('p', 'pd-big');
  const pct = el('p', 'pd-pct');
  const bar = el('div', 'pd-bar');
  const barMax = el('i', 'max');
  const barMin = el('i');
  bar.append(barMax, barMin);
  const ko = el('p', 'pd-ko');
  out.append(eff, big, pct, bar, ko);
  const table = el('table', 'pd-table');
  outCard.append(out, table);

  const noteCard = el('div', 'pd-card');
  noteCard.appendChild(el('h2', undefined, '📖 つかっている しき'));
  noteCard.appendChild(el('p', 'pd-note',
    'ダメージ ＝ （（レベル × 2 ÷ 5 ＋ 2）× いりょく × こうげき ÷ ぼうぎょ ÷ 50 ＋ 2）'
    + ' × てんき × きゅうしょ × らんすう × タイプ一致 × タイプ相性 × やけど。'
    + ' らんすうは 0.85 から 1.00 までの 16とおり なので、おなじ わざでも 当たるたびに'
    + ' すこし ちがう。だから こたえは 1つの 数ではなく「いくつから いくつ」に なる。'
    + ' こたいちは 31、まるめは 各段で きりすて。もちものと とくせいは 入れて いないので、'
    + ' じっさいの 対戦とは すこし ずれることが ある。'));

  app.append(atkCard, defCard, optCard, swap, outCard, noteCard);

  // ── 計算して 出す ────────────────────────────────────────────────

  /** わざを えらび直した ときだけ、いりょくを その わざの ぶんに もどす。 */
  const resetPower = (): void => { power.value = String(moveAt(move).power); };
  resetPower();

  const render = (): void => {
    const a = monAt(atkMon);
    const d = monAt(defMon);
    const mv = moveAt(move);

    atkTypes.replaceChildren(typeChips(a.types));
    defTypes.replaceChildren(typeChips(d.types));

    const aLevel = readNum(atkLevel.value, 50, 1, 100);
    const dLevel = readNum(defLevel.value, 50, 1, 100);
    const pw = readNum(power.value, mv.power, 1, 250);

    // 物理なら こうげき と ぼうぎょ、特殊なら とくこう と とくぼう。
    const physical = mv.cat === 'physical';
    const aBase = physical ? a.base[1] : a.base[3];
    const dBase = physical ? d.base[2] : d.base[4];

    const aStat = statOther(aBase, aLevel, Number(atkEv.value), Number(atkNature.value));
    const dStat = statOther(dBase, dLevel, Number(defEv.value), Number(defNature.value));
    const dHp = statHp(d.base[0], dLevel, Number(defHpEv.value));

    // ランクは 実数に かけてから きりすてる。
    const aUsed = Math.max(1, Math.floor(aStat * rankMul(Number(atkRank.value))));
    const dUsed = Math.max(1, Math.floor(dStat * rankMul(Number(defRank.value))));

    const stab = a.types.includes(mv.type);
    const typeMul = effectiveness(mv.type, d.types);
    const weatherMul = weather.value === 'sun'
      ? (mv.type === 'fire' ? 1.5 : mv.type === 'water' ? 0.5 : 1)
      : weather.value === 'rain'
        ? (mv.type === 'water' ? 1.5 : mv.type === 'fire' ? 0.5 : 1)
        : 1;

    // やけどが 効くのは 物理 だけ。特殊を えらんで いるあいだは さわれなくする。
    burn.disabled = !physical;
    burnLabel.style.opacity = physical ? '1' : '.45';

    const rolls = damages({
      level: aLevel, power: pw, atk: aUsed, def: dUsed,
      stab, type: typeMul, crit: crit.checked, weather: weatherMul,
      burn: physical && burn.checked,
    });
    const lo = rolls[0] ?? 0;
    const hi = rolls[rolls.length - 1] ?? 0;

    atkNote.textContent = `${physical ? 'こうげき' : 'とくこう'} ${aStat}`
      + `${aUsed === aStat ? '' : ` → ${aUsed}（ランク）`}`
      + `${stab ? ' / タイプ一致 × 1.5' : ''}`;
    defNote.textContent = `HP ${dHp} / ${physical ? 'ぼうぎょ' : 'とくぼう'} ${dStat}`
      + `${dUsed === dStat ? '' : ` → ${dUsed}（ランク）`}`;

    eff.textContent = effectWord(typeMul);

    if (typeMul === 0) {
      big.textContent = 'ダメージ 0';
      pct.textContent = `${mv.name}（${TYPE_NAME[mv.type]}）は ${d.name} に きかない。`;
      barMin.style.width = '0';
      barMax.style.width = '0';
      ko.textContent = 'たおせない。べつの タイプの わざを ためしてみよう。';
      table.replaceChildren();
      return;
    }

    big.replaceChildren(
      document.createTextNode(`${lo} 〜 ${hi}`),
      el('small', undefined, ` ダメージ（HP ${dHp}）`),
    );

    const loPct = (lo / dHp) * 100;
    const hiPct = (hi / dHp) * 100;
    pct.textContent = `のこり HP の ${loPct.toFixed(1)}% 〜 ${hiPct.toFixed(1)}% を けずる`;
    barMin.style.width = `${Math.min(100, loPct)}%`;
    barMax.style.width = `${Math.min(100, hiPct)}%`;

    // 「かくじつ」は いちばん 小さい ダメージでも たおせる 回数、「うまくいけば」は
    // いちばん 大きい ダメージが そろった ときの 回数。2つが 同じなら 言いかたを 1つに する。
    const sure = Math.ceil(dHp / lo);
    const lucky = Math.ceil(dHp / hi);
    ko.textContent = sure === lucky
      ? `かくじつに ${sure}はつで たおせる`
      : `うまくいけば ${lucky}はつ、かくじつには ${sure}はつで たおせる`;

    const head = el('tr');
    head.append(el('th', undefined, 'つかった すうじ'), el('th', undefined, 'あたい'));
    table.replaceChildren(head);
    const lines: readonly [string, string][] = [
      ['わざ', `${mv.name}（${TYPE_NAME[mv.type]}・${physical ? '物理' : '特殊'}）`],
      ['いりょく', String(pw)],
      [physical ? 'こうげき' : 'とくこう', String(aUsed)],
      [physical ? 'ぼうぎょ' : 'とくぼう', String(dUsed)],
      ['まもる がわの HP', String(dHp)],
      ['タイプ一致', stab ? '× 1.5' : '× 1'],
      ['タイプ相性', `× ${typeMul}`],
      ['てんき', `× ${weatherMul}`],
      ['きゅうしょ', crit.checked ? '× 1.5' : '× 1'],
      ['やけど', physical && burn.checked ? '× 0.5' : '× 1'],
    ];
    for (const [k, v] of lines) {
      const tr = el('tr');
      tr.append(el('td', undefined, k), el('td', 'num', v));
      table.appendChild(tr);
    }
  };

  // 入れかえは ポケモンと レベルだけ。わざは せめる がわの もので、入れかえても
  // 持ちかえられない（ここで わざも 変えると、何を えらんで いたか 分からなくなる）。
  const onSwap = (): void => {
    const monValue = atkMon.value;
    atkMon.value = defMon.value;
    defMon.value = monValue;
    const levelValue = atkLevel.value;
    atkLevel.value = defLevel.value;
    defLevel.value = levelValue;
    render();
  };

  // どれが 変わっても やることは おなじ（計算を やり直す）ので、1つずつ つなぐより
  // まとめて 1か所で 受ける。わざだけは、えらび直した ときに いりょくを もどす。
  const onChange = (e: Event): void => {
    if (e.target === move) resetPower();
    render();
  };

  swap.addEventListener('click', onSwap);
  page.addEventListener('change', onChange);
  page.addEventListener('input', onChange);

  host.replaceChildren(style, page);
  render();

  return () => {
    swap.removeEventListener('click', onSwap);
    page.removeEventListener('change', onChange);
    page.removeEventListener('input', onChange);
    host.replaceChildren();
  };
};
