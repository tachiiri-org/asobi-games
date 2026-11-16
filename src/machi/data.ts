// せかいの まち の データ。
//
// まちを 1つ 足すのは、CITIES に 1行と BUILDINGS に 名所3つ。index.ts も draw.ts も
// 変えなくていい形にしてある。needPop の順に ひらくので、行の順も その順に ならべる。

import type { Building, City } from './types';

/**
 * ごばんの 大きさ。
 *
 * たては 4列。5列に すると、手前の たてものが うしろを ほとんど 隠して、
 * どこが 空いて いるのか 見えなくなる。
 */
export const COLS = 6;
export const ROWS = 4;
export const TILES = COLS * ROWS;

/** キャラの 点の かず（よこ・たて）。 */
export const DOT = 16;

/** はじめに もっている コイン。いえ2けんと おみせ1けんが 建つ。 */
export const START_COINS = 300;

/** こわしたときに もどる わりあい。 */
export const BREAK_BACK = 0.5;

/** すんでいる キャラ1人に つき、そのまちの もうけが これだけ ふえる。 */
export const RESIDENT_BONUS = 0.1;

/** かける キャラの かず。これ以上は 保存が ふくらむので ふやさない。 */
export const PEOPLE_MAX = 24;

/** キャラの 色。16色。番号を そのまま 0〜f の もじにして 点を のこす。 */
export const PALETTE: readonly string[] = [
  '#1f2937', '#ffffff', '#ef4444', '#f97316',
  '#facc15', '#84cc16', '#22c55e', '#14b8a6',
  '#38bdf8', '#3b82f6', '#8b5cf6', '#ec4899',
  '#fda4af', '#a16207', '#f5d0a9', '#9ca3af',
];

/** 点1つを もじに する（0〜f）。'.' は すけて見える ところ。 */
export const dotChar = (index: number): string => index.toString(16);

export const CITIES: readonly City[] = [
  {
    id: 'tokyo', name: 'とうきょう', country: 'にほん', needPop: 0,
    sky: ['#7dd3fc', '#e0f2fe'], ground: '#a7f3d0', ground2: '#86efac',
    hello: 'こんにちは！', lon: 139.7, lat: 35.7, labelDown: true,
  },
  {
    id: 'paris', name: 'パリ', country: 'フランス', needPop: 20,
    sky: ['#93c5fd', '#fef3c7'], ground: '#94a3b8', ground2: '#cbd5e1',
    hello: 'ボンジュール！', lon: 2.3, lat: 48.9,
  },
  {
    id: 'newyork', name: 'ニューヨーク', country: 'アメリカ', needPop: 50,
    sky: ['#60a5fa', '#dbeafe'], ground: '#64748b', ground2: '#475569',
    hello: 'ハロー！', lon: -74.0, lat: 40.7,
  },
  {
    id: 'cairo', name: 'カイロ', country: 'エジプト', needPop: 100,
    sky: ['#fdba74', '#fef9c3'], ground: '#fcd34d', ground2: '#f59e0b',
    hello: 'アハラン！', lon: 31.2, lat: 30.0,
  },
  {
    id: 'beijing', name: 'ペキン', country: 'ちゅうごく', needPop: 170,
    sky: ['#fca5a5', '#fee2e2'], ground: '#bbf7d0', ground2: '#86efac',
    hello: 'ニイハオ！', lon: 116.4, lat: 39.9,
  },
  {
    id: 'delhi', name: 'デリー', country: 'インド', needPop: 260,
    sky: ['#fcd34d', '#fff7ed'], ground: '#fb923c', ground2: '#f97316',
    hello: 'ナマステ！', lon: 77.2, lat: 28.6, labelDown: true,
  },
  {
    id: 'nairobi', name: 'ナイロビ', country: 'ケニア', needPop: 380,
    sky: ['#fb923c', '#fef3c7'], ground: '#d9f99d', ground2: '#bef264',
    hello: 'ジャンボ！', lon: 36.8, lat: -1.3, labelDown: true,
  },
  {
    id: 'rio', name: 'リオデジャネイロ', country: 'ブラジル', needPop: 520,
    sky: ['#38bdf8', '#fef9c3'], ground: '#34d399', ground2: '#6ee7b7',
    hello: 'オイ！', lon: -43.2, lat: -22.9, labelDown: true,
  },
  {
    id: 'sydney', name: 'シドニー', country: 'オーストラリア', needPop: 700,
    sky: ['#22d3ee', '#ecfeff'], ground: '#bbf7d0', ground2: '#5eead4',
    hello: 'グダイ！', lon: 151.2, lat: -33.9,
  },
];

export const cityById = (id: string): City =>
  CITIES.find((c) => c.id === id) ?? CITIES[0];

/**
 * たてもの。city を 持たない ものは どのまちにも 建てられる。
 *
 * ねだんと じんこうの つり合いは「いえ20円で1人」を もとにして、名所だけ
 * とびぬけて 高く・とびぬけて たくさん すめるように してある。つぎの まちを
 * ひらく ときの ごほうびに なるので。
 */
export const BUILDINGS: readonly Building[] = [
  // ── どのまちにも 建てられる もの
  { id: 'tree', label: 'き', cost: 20, pop: 0, coin: 2, shape: 'tree', body: '#15803d', roof: '#22c55e', note: 'みどりが ふえる' },
  { id: 'park', label: 'ひろば', cost: 50, pop: 2, coin: 5, shape: 'flat', body: '#4ade80', roof: '#16a34a', mark: '⛲', note: 'みんなが あつまる' },
  { id: 'house', label: 'いえ', cost: 50, pop: 4, coin: 4, shape: 'box', body: '#fde68a', roof: '#dc2626', note: '4人 すめる' },
  { id: 'shop', label: 'おみせ', cost: 80, pop: 1, coin: 12, shape: 'box', body: '#fbcfe8', roof: '#db2777', mark: '🛒', note: 'コインが よく はいる' },
  { id: 'school', label: 'がっこう', cost: 150, pop: 9, coin: 8, shape: 'box', body: '#e0e7ff', roof: '#4338ca', mark: '🏫', note: '9人 すめる' },
  { id: 'apart', label: 'アパート', cost: 240, pop: 16, coin: 10, shape: 'tower', body: '#fef3c7', roof: '#b45309', note: '16人 すめる' },

  // ── とうきょう
  { id: 'tokyotower', label: 'とうきょうタワー', cost: 420, pop: 18, coin: 20, shape: 'tower', body: '#f87171', roof: '#b91c1c', mark: '🗼', city: 'tokyo', note: 'まちの めじるし' },
  { id: 'shrine', label: 'じんじゃ', cost: 300, pop: 12, coin: 16, shape: 'flat', body: '#fca5a5', roof: '#b91c1c', mark: '⛩️', city: 'tokyo', note: 'おまつりが できる' },
  { id: 'castle', label: 'おしろ', cost: 520, pop: 24, coin: 22, shape: 'box', body: '#f8fafc', roof: '#1e293b', mark: '🏯', city: 'tokyo', note: 'とても おおきい' },

  // ── パリ
  { id: 'eiffel', label: 'エッフェルとう', cost: 480, pop: 20, coin: 22, shape: 'tower', body: '#a8a29e', roof: '#57534e', mark: '🗼', city: 'paris', note: 'パリの めじるし' },
  { id: 'cafe', label: 'カフェ', cost: 220, pop: 8, coin: 14, shape: 'box', body: '#fef3c7', roof: '#047857', mark: '☕', city: 'paris', note: 'そとの せきで おしゃべり' },
  { id: 'museum', label: 'びじゅつかん', cost: 560, pop: 24, coin: 24, shape: 'dome', body: '#e7e5e4', roof: '#a16207', mark: '🖼️', city: 'paris', note: '絵が いっぱい' },

  // ── ニューヨーク
  { id: 'liberty', label: 'じゆうのめがみ', cost: 600, pop: 26, coin: 26, shape: 'tower', body: '#5eead4', roof: '#0f766e', mark: '🗽', city: 'newyork', note: 'うみから 見える' },
  { id: 'skyscraper', label: 'こうそうビル', cost: 700, pop: 40, coin: 24, shape: 'tower', body: '#e2e8f0', roof: '#1e40af', mark: '🏙️', city: 'newyork', note: '40人 すめる' },
  { id: 'hotdog', label: 'ホットドッグやたい', cost: 180, pop: 5, coin: 14, shape: 'flat', body: '#fcd34d', roof: '#dc2626', mark: '🌭', city: 'newyork', note: 'いいにおい' },

  // ── カイロ
  { id: 'pyramid', label: 'ピラミッド', cost: 650, pop: 28, coin: 26, shape: 'pyramid', body: '#d97706', roof: '#92400e', city: 'cairo', note: 'とても むかしの たてもの' },
  { id: 'sphinx', label: 'スフィンクス', cost: 380, pop: 16, coin: 18, shape: 'flat', body: '#fde68a', roof: '#78350f', mark: '🦁', city: 'cairo', note: 'ピラミッドを まもる' },
  { id: 'palm', label: 'やしのき', cost: 60, pop: 2, coin: 5, shape: 'tree', body: '#166534', roof: '#4ade80', mark: '🌴', city: 'cairo', note: 'かげが できる' },

  // ── ペキン
  { id: 'wall', label: 'ばんりのちょうじょう', cost: 720, pop: 30, coin: 28, shape: 'wall', body: '#d6d3d1', roof: '#78716c', city: 'beijing', note: 'どこまでも つづく' },
  { id: 'pagoda', label: 'とう', cost: 420, pop: 18, coin: 20, shape: 'tower', body: '#fecaca', roof: '#b91c1c', mark: '🏮', city: 'beijing', note: 'やねが なんまいも ある' },
  { id: 'panda', label: 'パンダのおうち', cost: 300, pop: 12, coin: 18, shape: 'box', body: '#f8fafc', roof: '#1f2937', mark: '🐼', city: 'beijing', note: 'みんなが 見にくる' },

  // ── デリー
  { id: 'taj', label: 'タージ・マハル', cost: 760, pop: 32, coin: 30, shape: 'dome', body: '#fffbeb', roof: '#e7e5e4', mark: '🕌', city: 'delhi', note: 'まっ白で まるい やね' },
  { id: 'elephant', label: 'ぞうのいえ', cost: 340, pop: 14, coin: 18, shape: 'box', body: '#fed7aa', roof: '#9a3412', mark: '🐘', city: 'delhi', note: 'ぞうと あるける' },
  { id: 'curry', label: 'カレーやさん', cost: 240, pop: 8, coin: 18, shape: 'box', body: '#fef08a', roof: '#c2410c', mark: '🍛', city: 'delhi', note: 'いいにおいが する' },

  // ── ナイロビ
  { id: 'safari', label: 'サファリゲート', cost: 700, pop: 28, coin: 28, shape: 'wall', body: '#fbbf24', roof: '#854d0e', mark: '🦒', city: 'nairobi', note: 'きりんに あえる' },
  { id: 'tent', label: 'テント', cost: 160, pop: 6, coin: 12, shape: 'tent', body: '#fdba74', roof: '#c2410c', mark: '🏕️', city: 'nairobi', note: 'とまれる' },
  { id: 'market', label: 'マーケット', cost: 320, pop: 10, coin: 20, shape: 'flat', body: '#fca5a5', roof: '#b91c1c', mark: '🧺', city: 'nairobi', note: 'なんでも うっている' },

  // ── リオデジャネイロ
  { id: 'corcovado', label: 'コルコバードの おか', cost: 780, pop: 32, coin: 30, shape: 'pyramid', body: '#bbf7d0', roof: '#f8fafc', mark: '🗿', city: 'rio', note: 'たかい おかの うえ' },
  { id: 'beach', label: 'すなはま', cost: 200, pop: 4, coin: 16, shape: 'flat', body: '#fde68a', roof: '#38bdf8', mark: '🏖️', city: 'rio', note: 'うみで あそべる' },
  { id: 'carnival', label: 'カーニバルの やたい', cost: 360, pop: 12, coin: 22, shape: 'tent', body: '#f0abfc', roof: '#a21caf', mark: '🎺', city: 'rio', note: 'おんがくが きこえる' },

  // ── シドニー
  { id: 'opera', label: 'オペラハウス', cost: 820, pop: 36, coin: 32, shape: 'dome', body: '#f8fafc', roof: '#cbd5e1', mark: '🎭', city: 'sydney', note: 'かいがらの ような やね' },
  { id: 'bridge', label: 'ハーバーブリッジ', cost: 640, pop: 26, coin: 26, shape: 'wall', body: '#9ca3af', roof: '#4b5563', mark: '🌉', city: 'sydney', note: 'うみを わたる はし' },
  { id: 'koala', label: 'コアラのいえ', cost: 300, pop: 10, coin: 18, shape: 'tree', body: '#78716c', roof: '#a8a29e', mark: '🐨', city: 'sydney', note: 'きの うえで ねている' },
];

export const buildingById = (id: string): Building | null =>
  BUILDINGS.find((b) => b.id === id) ?? null;

/** そのまちで 建てられる もの（きょうつう → そのまちの 名所）。 */
export const buildingsFor = (cityId: string): readonly Building[] =>
  BUILDINGS.filter((b) => b.city === undefined || b.city === cityId);

/** キャラの 名前の もと。思いつかない ときに ひとつ もらう。 */
export const NAME_SEEDS: readonly string[] = [
  'そら', 'ひかり', 'もも', 'つばさ', 'なつ', 'ゆき', 'あお', 'みどり',
  'こまち', 'たいよう', 'ほし', 'しおん', 'れん', 'はな', 'りく', 'うみ',
  'ぽん', 'まる', 'ちび', 'とら', 'くま', 'ぴー', 'たろう', 'はると',
];

/**
 * せかいの かたち。けいど・いどの 点を つないだ もの。
 *
 * 地図は 画像を 持たずに ここから 描く。外から 絵を 読まない決まりなので、
 * あらい かたちで よい——まちの ばしょが どのへんか 分かれば 足りる。
 */
export const LAND: readonly (readonly (readonly [number, number])[])[] = [
  // ユーラシア
  [
    [-10, 36], [-9, 44], [-2, 48], [4, 52], [10, 57], [20, 56], [25, 65], [30, 70],
    [40, 68], [60, 70], [75, 73], [90, 75], [105, 77], [130, 73], [160, 70], [170, 66],
    [178, 65], [170, 60], [162, 58], [155, 52], [142, 46], [130, 43], [126, 38], [122, 30],
    [110, 20], [105, 10], [100, 6], [97, 16], [92, 21], [88, 21], [80, 15], [77, 8],
    [72, 20], [68, 24], [60, 25], [56, 26], [50, 29], [52, 24], [58, 22], [55, 17],
    [43, 13], [39, 21], [34, 28], [36, 36], [28, 40], [26, 41], [20, 40], [18, 40],
    [12, 38], [9, 44], [3, 42], [-2, 37], [-6, 36],
  ],
  // アフリカ
  [
    [-17, 15], [-10, 5], [0, 5], [9, 4], [9, -1], [12, -6], [13, -17], [15, -28],
    [18, -34], [27, -34], [32, -26], [40, -16], [41, -2], [51, 12], [43, 12], [38, 18],
    [34, 28], [32, 31], [25, 32], [10, 34], [0, 36], [-6, 36], [-10, 31], [-17, 21],
  ],
  // 北アメリカ
  [
    [-168, 65], [-150, 61], [-130, 55], [-123, 38], [-117, 32], [-110, 23], [-105, 20],
    [-97, 16], [-92, 15], [-83, 9], [-83, 10], [-87, 21], [-97, 19], [-94, 29], [-81, 25],
    [-76, 35], [-70, 42], [-60, 47], [-64, 60], [-78, 62], [-95, 68], [-125, 70], [-160, 70],
  ],
  // 南アメリカ
  [
    [-77, 8], [-71, 12], [-60, 5], [-50, 0], [-35, -6], [-39, -15], [-48, -25], [-53, -34],
    [-62, -40], [-65, -52], [-71, -54], [-73, -45], [-71, -30], [-70, -18], [-76, -14],
    [-81, -6], [-79, 2],
  ],
  // オーストラリア
  [
    [113, -22], [114, -27], [118, -35], [130, -32], [138, -35], [146, -39], [150, -37],
    [153, -28], [146, -19], [142, -11], [136, -12], [130, -11], [125, -14], [122, -18],
  ],
  // にほん
  [
    [130, 32], [135, 34], [140, 36], [142, 41], [145, 43], [141, 45], [139, 38], [135, 33], [131, 31],
  ],
  // イギリス
  [[-5, 50], [-3, 54], [-5, 58], [-2, 57], [0, 53], [1, 51]],
  // グリーンランド
  [[-45, 60], [-50, 68], [-55, 75], [-45, 82], [-25, 80], [-20, 72], [-35, 65]],
  // マダガスカル
  [[43, -12], [49, -15], [48, -25], [44, -22]],
  // ニュージーランド
  [[173, -35], [178, -38], [175, -41], [170, -44], [166, -46], [170, -42], [172, -38]],
  // インドネシアの あたり
  [[95, 5], [105, 0], [115, -4], [125, -8], [115, -9], [105, -7], [97, 1]],
];
