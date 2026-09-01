// ペットのデータ。tennis-game リポジトリの pet.html から、中身をそのまま移した。
//
// 打ち直すと転記ミスが混ざるので、元の表記のまま置き、型だけを被せてある。
// 値を1つも変えていないので、遊びの手ざわりは元と同じになる。

import type {
  Activity, DecorZone, Food, InfEffect, Job, KindEntry, Place, Species,
} from './types';

/** ゲーム内1日 = 実時間3分。 */
export const DAY_SEC = 180;
/** 放置は最大6時間ぶんまで反映する。 */
export const OFFLINE_CAP = 6 * 3600;
export const MEDICINE_COST = 30;


export const SPECIES: Record<string, Species> = {
    baby:    { name: 'ベビモフ',   body: '#a7f3d0', accent: '#34d399', ear: 'round',  acc: 'none'  },
    child:   { name: 'モフっこ',   body: '#93c5fd', accent: '#3b82f6', ear: 'long',   acc: 'none'  },
    power:   { name: 'マッチョン', body: '#fca5a5', accent: '#ef4444', ear: 'horn',   acc: 'band'  },
    cheer:   { name: 'ゲンキー',   body: '#fde68a', accent: '#f59e0b', ear: 'star',   acc: 'none'  },
    gourmet: { name: 'モグモン',   body: '#f9a8d4', accent: '#ec4899', ear: 'round',  acc: 'bib'   },
    royal:   { name: 'プリンセア', body: '#c4b5fd', accent: '#8b5cf6', ear: 'long',   acc: 'crown' }
};

export const FOODS: Record<string, Food> = {
    rice:  { label: '🍚 ふつうのごはん', cost: 5,  hunger: 25, happy: 4,  exp: 3, eat: 1 },
    feast: { label: '🍖 ごうかディナー', cost: 25, hunger: 50, happy: 14, exp: 8, eat: 2 },
    cake:  { label: '🍰 おやつのケーキ', cost: 12, hunger: 10, happy: 24, exp: 3, eat: 1 },
    carrot:  { label: '🥕 にんじん',   cost: 6,  hunger: 15, happy: 3,  exp: 2, eat: 1 },
    berry:   { label: '🍓 いちご',     cost: 8,  hunger: 8,  happy: 16, exp: 2, eat: 1 },
    onigiri: { label: '🍙 おにぎり',   cost: 10, hunger: 22, happy: 6,  exp: 3, eat: 1 },
    icecream:{ label: '🍦 アイス',     cost: 14, hunger: 8,  happy: 24, exp: 3, eat: 1 },
    pudding: { label: '🍮 プリン',     cost: 16, hunger: 14, happy: 20, exp: 3, eat: 1 },
    fish:    { label: '🐟 さかな',     cost: 18, hunger: 32, happy: 8,  exp: 5, eat: 1 },
    pizza:   { label: '🍕 ピザ',       cost: 28, hunger: 42, happy: 12, exp: 7, eat: 2 },
    ramen:   { label: '🍜 ラーメン',   cost: 30, hunger: 48, happy: 14, exp: 8, eat: 2 },
    milk:    { label: '🥛 ミルク',     cost: 7,  hunger: 10, happy: 8,  exp: 2, eat: 1 },
    banana:  { label: '🍌 バナナ',     cost: 9,  hunger: 18, happy: 10, exp: 2, eat: 1 },
    grape:   { label: '🍇 ぶどう',     cost: 12, hunger: 12, happy: 18, exp: 3, eat: 1 },
    donut:   { label: '🍩 ドーナツ',   cost: 15, hunger: 16, happy: 22, exp: 3, eat: 1 },
    honey:   { label: '🍯 はちみつ',   cost: 20, hunger: 14, happy: 26, exp: 4, eat: 1 },
    steak:   { label: '🥩 ステーキ',   cost: 35, hunger: 55, happy: 16, exp: 9, eat: 2 },
    sushi:    { label: '🍣 おすし', emoji: '🍣', cost: 34, hunger: 52, happy: 16, exp: 9, eat: 2 },
    curry:    { label: '🍛 カレー', emoji: '🍛', cost: 26, hunger: 46, happy: 14, exp: 7, eat: 2 },
    sand:     { label: '🥪 サンドイッチ', emoji: '🥪', cost: 20, hunger: 30, happy: 10, exp: 5, eat: 1 },
    egg:      { label: '🍳 めだまやき', emoji: '🍳', cost: 12, hunger: 20, happy: 6, exp: 3, eat: 1 },
    soup:     { label: '🍲 スープ', emoji: '🍲', cost: 16, hunger: 26, happy: 10, exp: 4, eat: 1 },
    corn:     { label: '🌽 とうもろこし', emoji: '🌽', cost: 10, hunger: 16, happy: 8, exp: 3, eat: 1 },
    apple:    { label: '🍎 りんご', emoji: '🍎', cost: 8, hunger: 14, happy: 10, exp: 2, eat: 1 },
    melon:    { label: '🍈 メロン', emoji: '🍈', cost: 24, hunger: 18, happy: 24, exp: 4, eat: 1 },
    peach:    { label: '🍑 もも', emoji: '🍑', cost: 14, hunger: 14, happy: 18, exp: 3, eat: 1 },
    choco:    { label: '🍫 チョコ', emoji: '🍫', cost: 18, hunger: 10, happy: 26, exp: 3, eat: 1 },
    candy:    { label: '🍬 あめ', emoji: '🍬', cost: 6, hunger: 4, happy: 14, exp: 1, eat: 1 },
    cookie:   { label: '🍪 クッキー', emoji: '🍪', cost: 10, hunger: 8, happy: 16, exp: 2, eat: 1 },
    pancake:  { label: '🥞 パンケーキ', emoji: '🥞', cost: 22, hunger: 24, happy: 22, exp: 4, eat: 1 },
    dango:    { label: '🍡 おだんご', emoji: '🍡', cost: 12, hunger: 12, happy: 18, exp: 3, eat: 1 },
    gyoza:    { label: '🥟 ぎょうざ', emoji: '🥟', cost: 22, hunger: 32, happy: 12, exp: 5, eat: 1 },
    hotdog:   { label: '🌭 ホットドッグ', emoji: '🌭', cost: 20, hunger: 28, happy: 12, exp: 4, eat: 1 },
    burger:   { label: '🍔 ハンバーガー', emoji: '🍔', cost: 26, hunger: 40, happy: 16, exp: 6, eat: 2 },
    salad:    { label: '🥗 サラダ', emoji: '🥗', cost: 14, hunger: 18, happy: 6, exp: 4, eat: 1 },
    cheese:   { label: '🧀 チーズ', emoji: '🧀', cost: 16, hunger: 18, happy: 10, exp: 3, eat: 1 },
    pine:     { label: '🍍 パイナップル', emoji: '🍍', cost: 18, hunger: 16, happy: 20, exp: 4, eat: 1 },
    takoyaki2:  { label: '🐙 たこやき', emoji: '🐙', cost: 22, hunger: 32, happy: 16, exp: 5, eat: 1 },
    yakiimo:    { label: '🍠 やきいも', emoji: '🍠', cost: 14, hunger: 26, happy: 12, exp: 3, eat: 1 },
    senbei:     { label: '🍘 おせんべい', emoji: '🍘', cost: 8, hunger: 10, happy: 10, exp: 2, eat: 1 },
    shortcake:  { label: '🎂 ショートケーキ', emoji: '🎂', cost: 30, hunger: 16, happy: 32, exp: 5, eat: 1 },
    parfait:    { label: '🍨 パフェ', emoji: '🍨', cost: 28, hunger: 14, happy: 30, exp: 4, eat: 1 },
    waffle:     { label: '🧇 ワッフル', emoji: '🧇', cost: 20, hunger: 20, happy: 22, exp: 4, eat: 1 },
    croissant:  { label: '🥐 クロワッサン', emoji: '🥐', cost: 16, hunger: 22, happy: 12, exp: 3, eat: 1 },
    bagel:      { label: '🥯 ベーグル', emoji: '🥯', cost: 18, hunger: 26, happy: 10, exp: 4, eat: 1 },
    taco:       { label: '🌮 タコス', emoji: '🌮', cost: 24, hunger: 34, happy: 14, exp: 5, eat: 1 },
    pasta:      { label: '🍝 パスタ', emoji: '🍝', cost: 28, hunger: 42, happy: 14, exp: 7, eat: 2 },
    oden:       { label: '🍢 おでん', emoji: '🍢', cost: 22, hunger: 34, happy: 12, exp: 5, eat: 1 },
    shave:      { label: '🍧 かきごおり', emoji: '🍧', cost: 12, hunger: 6, happy: 24, exp: 2, eat: 1 },
    blue:       { label: '🫐 ブルーベリー', emoji: '🫐', cost: 12, hunger: 10, happy: 16, exp: 3, eat: 1 },
    kiwi:       { label: '🥝 キウイ', emoji: '🥝', cost: 10, hunger: 12, happy: 14, exp: 2, eat: 1 },
    coconut:    { label: '🥥 ココナッツ', emoji: '🥥', cost: 20, hunger: 18, happy: 18, exp: 4, eat: 1 },
    pretzel:    { label: '🥨 プレッツェル', emoji: '🥨', cost: 14, hunger: 18, happy: 10, exp: 3, eat: 1 },
    flan:       { label: '🍮 とろけるプリン', emoji: '🍮', cost: 22, hunger: 16, happy: 26, exp: 4, eat: 1 },
    lolly:      { label: '🍭 ぺろぺろキャンディ', emoji: '🍭', cost: 8, hunger: 4, happy: 18, exp: 1, eat: 1 },
    nuts:       { label: '🌰 くり', emoji: '🌰', cost: 10, hunger: 16, happy: 8, exp: 3, eat: 1 },
    tealeaf:    { label: '🫖 あったかい こうちゃ', emoji: '🫖', cost: 10, hunger: 8, happy: 14, exp: 2, eat: 1 },
    omurice:    { label: '🍳 オムライス', emoji: '🍳', cost: 26, hunger: 40, happy: 18, exp: 6, eat: 2 },
    gratin:     { label: '🧀 グラタン', emoji: '🧀', cost: 28, hunger: 38, happy: 18, exp: 6, eat: 2 },
    yakisoba:   { label: '🍜 やきそば', emoji: '🍜', cost: 24, hunger: 36, happy: 14, exp: 5, eat: 1 },
    sushi2:     { label: '🍥 なると', emoji: '🍥', cost: 10, hunger: 12, happy: 8, exp: 2, eat: 1 },
    anpan:      { label: '🥐 あんパン', emoji: '🥐', cost: 16, hunger: 22, happy: 16, exp: 3, eat: 1 },
    melonpan:   { label: '🍞 メロンパン', emoji: '🍞', cost: 18, hunger: 24, happy: 18, exp: 3, eat: 1 },
    crepe:      { label: '🥞 クレープ', emoji: '🥞', cost: 24, hunger: 18, happy: 26, exp: 4, eat: 1 },
    cotton:     { label: '🍡 わたあめ', emoji: '🍡', cost: 10, hunger: 6, happy: 22, exp: 2, eat: 1 },
    macaron:    { label: '🍬 マカロン', emoji: '🍬', cost: 20, hunger: 8, happy: 24, exp: 3, eat: 1 },
    tart:       { label: '🥧 タルト', emoji: '🥧', cost: 26, hunger: 16, happy: 28, exp: 4, eat: 1 },
    smoothie:   { label: '🥤 スムージー', emoji: '🥤', cost: 18, hunger: 12, happy: 20, exp: 3, eat: 1 },
    cocoa2:     { label: '☕ ココア', emoji: '☕', cost: 14, hunger: 10, happy: 18, exp: 2, eat: 1 },
    soba:       { label: '🍲 おそば', emoji: '🍲', cost: 22, hunger: 34, happy: 12, exp: 5, eat: 1 },
    gyudon:     { label: '🍚 ぎゅうどん', emoji: '🍚', cost: 30, hunger: 46, happy: 16, exp: 7, eat: 2 },
    karaage:    { label: '🍗 からあげ', emoji: '🍗', cost: 26, hunger: 38, happy: 20, exp: 6, eat: 2 },
    corn2:      { label: '🌽 やきとうもろこし', emoji: '🌽', cost: 14, hunger: 20, happy: 14, exp: 3, eat: 1 },
    mango:      { label: '🥭 マンゴー', emoji: '🥭', cost: 22, hunger: 16, happy: 22, exp: 4, eat: 1 },
    cherry2:    { label: '🍒 さくらんぼ', emoji: '🍒', cost: 12, hunger: 10, happy: 16, exp: 3, eat: 1 },
    avocado:    { label: '🥑 アボカド', emoji: '🥑', cost: 18, hunger: 20, happy: 10, exp: 4, eat: 1 },
    honeytoast: { label: '🍞 ハニートースト', emoji: '🍞', cost: 24, hunger: 26, happy: 24, exp: 4, eat: 1 },
    dorayaki:     { label: '🥞 どらやき', emoji: '🥞', cost: 20, hunger: 24, happy: 20, exp: 4, eat: 1 },
    daifuku:      { label: '🍡 だいふく', emoji: '🍡', cost: 16, hunger: 18, happy: 20, exp: 3, eat: 1 },
    kakigori:     { label: '🍧 いちごシロップ', emoji: '🍧', cost: 12, hunger: 6, happy: 22, exp: 2, eat: 1 },
    purin2:       { label: '🍮 おおきい プリン', emoji: '🍮', cost: 26, hunger: 20, happy: 28, exp: 4, eat: 1 },
    sundae:       { label: '🍨 サンデー', emoji: '🍨', cost: 26, hunger: 14, happy: 30, exp: 4, eat: 1 },
    nikuman:      { label: '🥟 にくまん', emoji: '🥟', cost: 20, hunger: 30, happy: 14, exp: 4, eat: 1 },
    yakitori:     { label: '🍢 やきとり', emoji: '🍢', cost: 24, hunger: 34, happy: 16, exp: 5, eat: 1 },
    tempura:      { label: '🍤 てんぷら', emoji: '🍤', cost: 28, hunger: 38, happy: 16, exp: 6, eat: 2 },
    katsu:        { label: '🍱 とんかつ', emoji: '🍱', cost: 30, hunger: 44, happy: 16, exp: 7, eat: 2 },
    omuraisu:     { label: '🍛 ハヤシライス', emoji: '🍛', cost: 28, hunger: 42, happy: 16, exp: 6, eat: 2 },
    pizza2:       { label: '🍕 てづくりピザ', emoji: '🍕', cost: 30, hunger: 44, happy: 20, exp: 7, eat: 2 },
    salad2:       { label: '🥗 フルーツサラダ', emoji: '🥗', cost: 20, hunger: 16, happy: 20, exp: 4, eat: 1 },
    juice2:       { label: '🧃 オレンジジュース', emoji: '🧃', cost: 10, hunger: 8, happy: 16, exp: 2, eat: 1 },
    latte:        { label: '☕ カフェオレ', emoji: '☕', cost: 14, hunger: 10, happy: 18, exp: 2, eat: 1 },
    bread2:       { label: '🥖 やきたてパン', emoji: '🥖', cost: 18, hunger: 26, happy: 14, exp: 4, eat: 1 },
    choco2:       { label: '🍫 いちごチョコ', emoji: '🍫', cost: 20, hunger: 10, happy: 28, exp: 3, eat: 1 },
    marshmallow:  { label: '🍬 マシュマロ', emoji: '🍬', cost: 10, hunger: 6, happy: 18, exp: 2, eat: 1 },
    donut2:       { label: '🍩 チョコドーナツ', emoji: '🍩', cost: 18, hunger: 18, happy: 24, exp: 3, eat: 1 },
    watermelon:   { label: '🍉 すいか', emoji: '🍉', cost: 16, hunger: 14, happy: 22, exp: 3, eat: 1 },
    grapes3:      { label: '🍇 マスカット', emoji: '🍇', cost: 18, hunger: 14, happy: 22, exp: 3, eat: 1 },
    unagi:        { label: '🍱 うなぎどん', emoji: '🍱', cost: 34, hunger: 50, happy: 20, exp: 8, eat: 2 },
    chahan:       { label: '🍚 チャーハン', emoji: '🍚', cost: 26, hunger: 40, happy: 16, exp: 6, eat: 2 },
    gratin2:      { label: '🥘 ドリア', emoji: '🥘', cost: 28, hunger: 40, happy: 18, exp: 6, eat: 2 },
    sandwich2:    { label: '🥪 たまごサンド', emoji: '🥪', cost: 20, hunger: 28, happy: 14, exp: 4, eat: 1 },
    milktea:      { label: '🧋 タピオカ', emoji: '🧋', cost: 22, hunger: 14, happy: 26, exp: 3, eat: 1 },
    soda2:        { label: '🥤 クリームソーダ', emoji: '🥤', cost: 18, hunger: 10, happy: 24, exp: 3, eat: 1 },
    jelly2:       { label: '🍮 フルーツゼリー', emoji: '🍮', cost: 18, hunger: 12, happy: 22, exp: 3, eat: 1 },
    mont:         { label: '🌰 モンブラン', emoji: '🌰', cost: 28, hunger: 16, happy: 28, exp: 4, eat: 1 },
    roll:         { label: '🍥 ロールケーキ', emoji: '🍥', cost: 26, hunger: 18, happy: 26, exp: 4, eat: 1 },
    cannele:      { label: '🥐 カヌレ', emoji: '🥐', cost: 22, hunger: 16, happy: 22, exp: 3, eat: 1 },
    okonomi:      { label: '🥞 おこのみやき', emoji: '🥞', cost: 26, hunger: 38, happy: 18, exp: 6, eat: 2 },
    takowasa:     { label: '🐙 たこさん ウインナー', emoji: '🐙', cost: 14, hunger: 16, happy: 16, exp: 3, eat: 1 },
    corn3:        { label: '🍿 キャラメルポップコーン', emoji: '🍿', cost: 14, hunger: 10, happy: 22, exp: 2, eat: 1 },
    mikan:        { label: '🍊 みかん', emoji: '🍊', cost: 10, hunger: 12, happy: 14, exp: 2, eat: 1 },
    nashi:        { label: '🍐 なし', emoji: '🍐', cost: 12, hunger: 14, happy: 14, exp: 3, eat: 1 },
    persimmon:    { label: '🍑 かき', emoji: '🍑', cost: 12, hunger: 14, happy: 14, exp: 3, eat: 1 },
    icecandy:     { label: '🍦 ソフトクリーム', emoji: '🍦', cost: 20, hunger: 10, happy: 26, exp: 3, eat: 1 },
    cheese2:      { label: '🧀 チーズケーキ', emoji: '🧀', cost: 26, hunger: 18, happy: 26, exp: 4, eat: 1 },
    curry2:       { label: '🍛 あまくち カレー', emoji: '🍛', cost: 24, hunger: 42, happy: 16, exp: 6, eat: 2 },
    miso:         { label: '🍲 おみそしる', emoji: '🍲', cost: 12, hunger: 20, happy: 10, exp: 3, eat: 1 }
};

// おおきな かずの よびかた（万 → 無量大数 まで）
export const BIG_UNITS: readonly (readonly [number, string])[] = [
    [68, '無量大数'], [64, '不可思議'], [60, '那由他'], [56, '阿僧祇'], [52, '恒河沙'],
    [48, '極'], [44, '載'], [40, '正'], [36, '澗'], [32, '溝'], [28, '穣'], [24, '𥝱'],
    [20, '垓'], [16, '京'], [12, '兆'], [8, '億'], [4, '万']
];

export const ACTIVITIES: readonly Activity[] = [
    { id: 'tv',     item: 'tv',      emoji: '📺', label: 'テレビを みる',      room: 'living',  e: 4,  hu: 2,  h: 18, x: 3 },
    { id: 'game',   item: 'game',    emoji: '🕹', label: 'ゲームを する',      room: 'living',  e: 8,  hu: 4,  h: 24, x: 5 },
    { id: 'guitar', item: 'guitar',  emoji: '🎸', label: 'ギターを ひく',      room: 'living',  e: 6,  hu: 3,  h: 20, x: 6 },
    { id: 'piano',  item: 'piano',   emoji: '🎹', label: 'ピアノを ひく',      room: 'living',  e: 6,  hu: 3,  h: 20, x: 6 },
    { id: 'read',   item: 'shelf',   emoji: '📖', label: 'ほんを よむ',        room: 'living',  e: 5,  hu: 2,  h: 8,  x: 16 },
    { id: 'darts',  item: 'darts',   emoji: '🎯', label: 'ダーツを なげる',    room: 'living',  e: 6,  hu: 3,  h: 14, x: 4, c: 8 },
    { id: 'tower',  item: 'tower',   emoji: '🪜', label: 'タワーに のぼる',    room: 'living',  e: 10, hu: 5,  h: 18, x: 5 },
    { id: 'hug',    item: 'doll',    emoji: '🧸', label: 'ぬいぐるみと あそぶ', room: 'living',  e: 3,  hu: 1,  h: 14, x: 2 },
    { id: 'cook',   item: 'pot',     emoji: '🍲', label: 'りょうりを する',    room: 'kitchen', e: 10, hu: 0,  h: 10, x: 6, hg: 26 },
    { id: 'brew',   item: 'coffee',  emoji: '☕', label: 'コーヒーを いれる',  room: 'kitchen', e: 0,  hu: 3,  h: 8,  x: 3, eg: 18 },
    { id: 'radio',  item: 'radio',   emoji: '🎵', label: 'ラジオを きく',      room: 'living',  e: 2,  hu: 1,  h: 12, x: 2 },
    { id: 'swim',   item: 'pool',    emoji: '🏊', label: 'プールで あそぶ',    room: 'out',     e: 10, hu: 6,  h: 24, x: 5, cl: 12 },
    { id: 'ride',   item: 'bike',    emoji: '🚲', label: 'サイクリングする',   room: 'out',     e: 16, hu: 10, h: 18, x: 8, c: 12 },
    { id: 'fish',   item: 'pond',    emoji: '🎣', label: 'さかなつりを する',  room: 'out',     e: 10, hu: 6,  h: 12, x: 6, c: 22 },
    { id: 'camp',   item: 'tent',    emoji: '⛺', label: 'キャンプごっこ',     room: 'out',     e: 8,  hu: 5,  h: 22, x: 5 },
    { id: 'swing',  item: 'bench',   emoji: '🌤', label: 'ベンチで ひなたぼっこ', room: 'out',  e: 0,  hu: 2,  h: 12, x: 2, eg: 8 },
    { id: 'sing',   item: 'mic',     emoji: '🎤', label: 'うたを うたう',      room: 'living',  e: 7,  hu: 4,  h: 24, x: 5 },
    { id: 'draw',   item: 'artset',  emoji: '🎨', label: 'おえかきを する',    room: 'living',  e: 5,  hu: 3,  h: 14, x: 12 },
    { id: 'puzzle', item: 'puzzle',  emoji: '🧩', label: 'パズルを する',      room: 'living',  e: 4,  hu: 2,  h: 12, x: 14 },
    { id: 'trumpet',item: 'trumpet', emoji: '🎺', label: 'トランペットを ふく', room: 'living', e: 8,  hu: 4,  h: 22, x: 7 },
    { id: 'call',   item: 'phone',   emoji: '☎️', label: 'でんわで おはなし',  room: 'living',  e: 2,  hu: 1,  h: 16, x: 3 },
    { id: 'star',   item: 'telescope', emoji: '🔭', label: 'ほしを みる',      room: 'bed',     e: 4,  hu: 2,  h: 22, x: 8, night: true },
    { id: 'yoga',   item: 'yogamat', emoji: '🧘', label: 'ストレッチを する',  room: 'bed',     e: 0,  hu: 3,  h: 10, x: 5, eg: 14 },
    { id: 'soccer', item: 'soccer',  emoji: '⚽', label: 'サッカーを する',    room: 'out',     e: 14, hu: 9,  h: 22, x: 8 },
    { id: 'rope',   item: 'jumprope',emoji: '🪢', label: 'なわとびを する',    room: 'out',     e: 12, hu: 8,  h: 12, x: 10 },
    { id: 'bbq',    item: 'bbq',     emoji: '🍖', label: 'バーベキューを する', room: 'out',    e: 8,  hu: 0,  h: 20, x: 6, hg: 30 },
    { id: 'grow',   item: 'garden',  emoji: '🌱', label: 'やさいを そだてる',  room: 'out',     e: 10, hu: 5,  h: 10, x: 6, c: 18 },
    { id: 'birds',  item: 'feeder',  emoji: '🐦', label: 'ことりと あそぶ',    room: 'out',     e: 3,  hu: 2,  h: 16, x: 3 },
    { id: 'tea',    item: 'herbtea', emoji: '🍵', label: 'やくそうティーを のむ', room: 'kitchen', e: 0, hu: 2, h: 6, x: 2, hp: 15 },
    { id: 'shake',  item: 'protein', emoji: '🥤', label: 'プロテインを のむ',  room: 'kitchen', e: 0,  hu: 0,  h: 4,  x: 4, pw: 1, hg: 8 },
    { id: 'tako',   item: 'takoyaki',emoji: '🐙', label: 'たこやきを やく',    room: 'kitchen', e: 8,  hu: 0,  h: 18, x: 5, hg: 26 },
    { id: 'juice',  item: 'juicer',  emoji: '🥤', label: 'ジュースを つくる',  room: 'kitchen', e: 4,  hu: 0,  h: 14, x: 3, hg: 12 },
    { id: 'robo',   item: 'robot',   emoji: '🤖', label: 'ロボットと あそぶ',  room: 'living',  e: 5,  hu: 3,  h: 20, x: 6 },
    { id: 'nap',    item: 'hammock', emoji: '🛖', label: 'ハンモックで ひるね', room: 'living',  e: 0,  hu: 3,  h: 12, x: 2, eg: 22 },
    { id: 'kotatsu',item: 'kotatsu', emoji: '🔥', label: 'こたつに はいる',    room: 'living',  e: 0,  hu: 3,  h: 20, x: 2, eg: 10 },
    { id: 'curl',   item: 'petbed',  emoji: '🛏', label: 'まるくなって やすむ', room: 'living',  e: 0,  hu: 2,  h: 10, x: 2, eg: 14 },
    { id: 'diary',  item: 'diary',   emoji: '📔', label: 'にっきを かく',      room: 'bed',     e: 3,  hu: 2,  h: 10, x: 15 },
    { id: 'music',  item: 'musicbox',emoji: '🎶', label: 'オルゴールを きく',  room: 'bed',     e: 1,  hu: 1,  h: 18, x: 3 },
    { id: 'swing2', item: 'swingset',emoji: '🎠', label: 'ブランコに のる',    room: 'out',     e: 9,  hu: 6,  h: 22, x: 5 },
    { id: 'sand',   item: 'sandbox', emoji: '🏖', label: 'すなあそびを する',  room: 'out',     e: 8,  hu: 5,  h: 20, x: 5, cl: 14 },
    { id: 'atkite', item: 'ty_kite', emoji: '🪁', label: 'たこあげを する', room: 'out', e: 10, hu: 6, h: 20, x: 6 },
    { id: 'atbubbles', item: 'ty_bubbles', emoji: '🫧', label: 'シャボンだまを とばす', room: 'out', e: 6, hu: 3, h: 22, x: 4 },
    { id: 'atkendama', item: 'ty_kendama', emoji: '🪀', label: 'けんだまで あそぶ', room: 'living', e: 7, hu: 4, h: 18, x: 6 },
    { id: 'atchess', item: 'ty_chess', emoji: '♟', label: 'しょうぎを さす', room: 'living', e: 6, hu: 3, h: 14, x: 16 },
    { id: 'atkaruta', item: 'ty_karuta', emoji: '🎴', label: 'かるたを する', room: 'living', e: 5, hu: 3, h: 20, x: 8 },
    { id: 'atorigami', item: 'ty_origami', emoji: '📄', label: 'おりがみを おる', room: 'living', e: 4, hu: 2, h: 16, x: 10 },
    { id: 'atclay', item: 'ty_clay', emoji: '🧱', label: 'ねんどで つくる', room: 'living', e: 6, hu: 3, h: 20, x: 8 },
    { id: 'atmagic', item: 'ty_magic', emoji: '🎩', label: 'マジックを する', room: 'living', e: 7, hu: 4, h: 26, x: 7 },
    { id: 'atdrum', item: 'ty_drum', emoji: '🥁', label: 'たいこを たたく', room: 'living', e: 9, hu: 5, h: 24, x: 5 },
    { id: 'atviolin', item: 'ty_violin', emoji: '🎻', label: 'バイオリンを ひく', room: 'living', e: 8, hu: 4, h: 24, x: 9 },
    { id: 'atcamera', item: 'ty_camera', emoji: '📷', label: 'しゃしんを とる', room: 'out', e: 5, hu: 3, h: 18, x: 8 },
    { id: 'atskate', item: 'ty_skate', emoji: '🛼', label: 'スケートを する', room: 'out', e: 14, hu: 8, h: 24, x: 8 },
    { id: 'atsurf', item: 'ty_surf', emoji: '🏄', label: 'サーフィンを する', room: 'beach', e: 18, hu: 10, h: 30, x: 10 },
    { id: 'atsnorkel', item: 'ty_snorkel', emoji: '🤿', label: 'うみに もぐる', room: 'beach', e: 12, hu: 7, h: 26, x: 9 },
    { id: 'atbinocular', item: 'ty_binocular', emoji: '🔭', label: 'とりを かんさつする', room: 'mountain', e: 5, hu: 3, h: 16, x: 10 },
    { id: 'atbackpack2', item: 'ty_backpack2', emoji: '🎒', label: 'ハイキングを する', room: 'mountain', e: 16, hu: 10, h: 20, x: 12, pw: 1 },
    { id: 'atball', item: 'ty_ball', emoji: '🏀', label: 'バスケを する', room: 'park', e: 13, hu: 8, h: 22, x: 8 },
    { id: 'atbadminton', item: 'ty_badminton', emoji: '🏸', label: 'バドミントンを する', room: 'park', e: 12, hu: 7, h: 22, x: 7 },
    { id: 'atfrisbee', item: 'ty_frisbee', emoji: '🥏', label: 'フリスビーで あそぶ', room: 'park', e: 10, hu: 6, h: 20, x: 6 },
    { id: 'atscooter', item: 'ty_scooter', emoji: '🛴', label: 'キックボードで はしる', room: 'park', e: 12, hu: 7, h: 20, x: 7 },
    { id: 'atteaset', item: 'ty_teaset', emoji: '🫖', label: 'おちゃかいを する', room: 'kitchen', e: 3, hu: 2, h: 20, x: 5, hg: 10 },
    { id: 'aticecream2', item: 'ty_icecream2', emoji: '🍦', label: 'アイスを つくる', room: 'kitchen', e: 5, hu: 2, h: 24, x: 5, hg: 14 },
    { id: 'atbread', item: 'ty_bread', emoji: '🥖', label: 'パンを やく', room: 'kitchen', e: 7, hu: 0, h: 18, x: 6, hg: 24 },
    { id: 'atcandy2', item: 'ty_candy2', emoji: '🍬', label: 'キャンディを つくる', room: 'kitchen', e: 5, hu: 2, h: 22, x: 4, hg: 10 },
    { id: 'atstarmap', item: 'ty_starmap', emoji: '🌌', label: 'ほしを さがす', room: 'bed', e: 4, hu: 2, h: 22, x: 10 },
    { id: 'atpillowfight', item: 'ty_pillowfight', emoji: '🛏', label: 'まくら なげを する', room: 'bed', e: 9, hu: 5, h: 24, x: 5 },
    { id: 'atlego', item: 'ty_lego', emoji: '🧩', label: 'ブロックで つくる', room: 'bed', e: 6, hu: 3, h: 20, x: 12 },
    { id: 'atpuppet', item: 'ty_puppet', emoji: '🎭', label: 'にんぎょうげきを する', room: 'bed', e: 5, hu: 3, h: 22, x: 7 },
    { id: 'atfishing2', item: 'ty_fishing2', emoji: '🎣', label: 'おおものを つる', room: 'beach', e: 12, hu: 7, h: 16, x: 8, c: 60 },
    { id: 'atmetal', item: 'ty_metal', emoji: '🔍', label: 'たからを さがす', room: 'park', e: 10, hu: 6, h: 14, x: 6, c: 80 },
    { id: 'atunicycle', item: 'ty_unicycle', emoji: '🎪', label: 'いちりんしゃに のる', room: 'park', e: 13, hu: 8, h: 22, x: 8 },
    { id: 'atjumpball', item: 'ty_jumpball', emoji: '🏐', label: 'バランスボールで あそぶ', room: 'living', e: 8, hu: 5, h: 20, x: 6 },
    { id: 'atdartboard', item: 'ty_dartboard', emoji: '🎯', label: 'ダーツで しょうぶ', room: 'living', e: 6, hu: 3, h: 20, x: 6, c: 10 },
    { id: 'atbowling', item: 'ty_bowling', emoji: '🎳', label: 'ボウリングを する', room: 'living', e: 10, hu: 6, h: 26, x: 8 },
    { id: 'atpinball', item: 'ty_pinball', emoji: '🕹', label: 'ピンボールで あそぶ', room: 'living', e: 8, hu: 4, h: 24, x: 7 },
    { id: 'attrainset', item: 'ty_trainset', emoji: '🚂', label: 'でんしゃで あそぶ', room: 'living', e: 5, hu: 3, h: 22, x: 6 },
    { id: 'atdollhouse', item: 'ty_dollhouse', emoji: '🏠', label: 'ドールハウスで あそぶ', room: 'living', e: 5, hu: 3, h: 24, x: 6 },
    { id: 'atshogi2', item: 'ty_shogi2', emoji: '🀄', label: 'ならべて あそぶ', room: 'living', e: 5, hu: 3, h: 16, x: 12 },
    { id: 'atmicroscope', item: 'ty_microscope', emoji: '🔬', label: 'ちいさな せかいを みる', room: 'bed', e: 5, hu: 3, h: 14, x: 20 },
    { id: 'atglobe', item: 'ty_globe', emoji: '🌍', label: 'せかいを しらべる', room: 'bed', e: 4, hu: 2, h: 12, x: 18 },
    { id: 'atdiary2', item: 'ty_diary2', emoji: '📔', label: 'にっきを こうかんする', room: 'bed', e: 4, hu: 2, h: 20, x: 10 },
    { id: 'atnightsky', item: 'ty_nightsky', emoji: '🔭', label: 'わくせいを みる', room: 'bed', e: 6, hu: 3, h: 26, x: 16 },
    { id: 'atbakeset', item: 'ty_bakeset', emoji: '🧁', label: 'おかしを つくる', room: 'kitchen', e: 7, hu: 0, h: 24, x: 6, hg: 20 },
    { id: 'atjuicer2', item: 'ty_juicer2', emoji: '🍹', label: 'ジュースを つくる', room: 'kitchen', e: 4, hu: 0, h: 20, x: 4, hg: 14 },
    { id: 'athotplate', item: 'ty_hotplate', emoji: '🍳', label: 'みんなで やきそば', room: 'kitchen', e: 8, hu: 0, h: 26, x: 7, hg: 30 },
    { id: 'atpot2', item: 'ty_pot2', emoji: '🍲', label: 'なべを つくる', room: 'kitchen', e: 8, hu: 0, h: 24, x: 6, hg: 28 },
    { id: 'atsandtoy', item: 'ty_sandtoy', emoji: '🏖', label: 'すなの おしろを つくる', room: 'beach', e: 10, hu: 6, h: 24, x: 6 },
    { id: 'atfloat', item: 'ty_float', emoji: '🛟', label: 'うきわで ぷかぷか', room: 'beach', e: 8, hu: 5, h: 22, x: 5 },
    { id: 'atshellbox', item: 'ty_shellbox', emoji: '🐚', label: 'かいがらを あつめる', room: 'beach', e: 7, hu: 4, h: 18, x: 6, c: 30 },
    { id: 'attent2', item: 'ty_tent2', emoji: '⛺', label: 'やまで キャンプ', room: 'mountain', e: 10, hu: 6, h: 26, x: 8 },
    { id: 'atrope2', item: 'ty_rope2', emoji: '🧗', label: 'がけを のぼる', room: 'mountain', e: 20, hu: 12, h: 20, x: 12, pw: 1 },
    { id: 'atflask', item: 'ty_flask', emoji: '🧪', label: 'じっけんを する', room: 'school', e: 7, hu: 4, h: 16, x: 22 },
    { id: 'atrecorder', item: 'ty_recorder', emoji: '🪈', label: 'リコーダーを ふく', room: 'school', e: 6, hu: 3, h: 20, x: 8 },
    { id: 'atpaint', item: 'ty_paint', emoji: '🖌', label: 'おおきな えを かく', room: 'school', e: 6, hu: 3, h: 22, x: 12 },
    { id: 'atsoccer2', item: 'ty_soccer2', emoji: '⚽', label: 'しあいを する', room: 'school', e: 15, hu: 9, h: 26, x: 9 },
    { id: 'atswim2', item: 'ty_swim2', emoji: '🩱', label: 'プールで およぐ', room: 'school', e: 13, hu: 8, h: 24, x: 7 },
    { id: 'atlantern2', item: 'ty_lantern2', emoji: '🏮', label: 'おまつりごっこ', room: 'shrine', e: 6, hu: 4, h: 26, x: 7 },
    { id: 'atgoldfish', item: 'ty_goldfish', emoji: '🐠', label: 'きんぎょを すくう', room: 'shrine', e: 6, hu: 3, h: 22, x: 5 },
    { id: 'atpopper', item: 'ty_popper', emoji: '🎉', label: 'パーティーを する', room: 'fun', e: 5, hu: 3, h: 28, x: 5 },
    { id: 'atballoon2', item: 'ty_balloon2', emoji: '🎈', label: 'ふうせんを とばす', room: 'fun', e: 4, hu: 2, h: 24, x: 4 },
    { id: 'atrollerblade', item: 'ty_rollerblade', emoji: '⛸', label: 'スケートリンクで すべる', room: 'park', e: 14, hu: 8, h: 26, x: 8 },
    { id: 'atkart', item: 'ty_kart', emoji: '🏎', label: 'カートで はしる', room: 'fun', e: 12, hu: 7, h: 30, x: 9 },
    { id: 'athoop', item: 'ty_hoop', emoji: '🤸', label: 'フラフープを まわす', room: 'park', e: 10, hu: 6, h: 20, x: 6 },
    { id: 'attrampo', item: 'ty_trampo', emoji: '🤾', label: 'トランポリンで はねる', room: 'out', e: 14, hu: 8, h: 28, x: 8 },
    { id: 'atbug', item: 'ty_bug', emoji: '🦋', label: 'むしとりを する', room: 'mountain', e: 9, hu: 5, h: 20, x: 8 },
    { id: 'atleafart', item: 'ty_leafart', emoji: '🍁', label: 'おちばで あそぶ', room: 'park', e: 6, hu: 3, h: 18, x: 6 },
    { id: 'atsnowman', item: 'ty_snowman', emoji: '⛄', label: 'ゆきだるまを つくる', room: 'mountain', e: 10, hu: 6, h: 26, x: 7 },
    { id: 'atlantern3', item: 'ty_lantern3', emoji: '🕯', label: 'キャンドルを つくる', room: 'living', e: 5, hu: 3, h: 18, x: 12 },
    { id: 'atknit', item: 'ty_knit', emoji: '🧶', label: 'マフラーを あむ', room: 'living', e: 6, hu: 3, h: 16, x: 14 },
    { id: 'atstamp', item: 'ty_stamp', emoji: '📮', label: 'スタンプを おす', room: 'living', e: 4, hu: 2, h: 16, x: 10 },
    { id: 'atradio2', item: 'ty_radio2', emoji: '📻', label: 'ラジオたいそうを する', room: 'out', e: 8, hu: 5, h: 16, x: 6, pw: 1 },
    { id: 'atwaterfall', item: 'ty_waterfall', emoji: '🚿', label: 'みずでっぽうで あそぶ', room: 'beach', e: 10, hu: 6, h: 24, x: 6 },
    { id: 'atsandcastle', item: 'ty_sandcastle', emoji: '🏰', label: 'おおきな おしろを つくる', room: 'beach', e: 12, hu: 7, h: 26, x: 8 },
    { id: 'atkayak', item: 'ty_kayak', emoji: '🛶', label: 'カヌーに のる', room: 'beach', e: 16, hu: 9, h: 28, x: 10 },
    { id: 'attelescope2', item: 'ty_telescope2', emoji: '🌠', label: 'ながれぼしを かぞえる', room: 'bed', e: 4, hu: 2, h: 24, x: 14 },
    { id: 'atmusicbox2', item: 'ty_musicbox2', emoji: '🎼', label: 'うたを つくる', room: 'bed', e: 5, hu: 3, h: 22, x: 16 },
    { id: 'atquiz', item: 'ty_quiz', emoji: '❓', label: 'クイズを とく', room: 'school', e: 5, hu: 3, h: 18, x: 20 },
    { id: 'atabacus', item: 'ty_abacus', emoji: '🧮', label: 'そろばんを はじく', room: 'school', e: 5, hu: 3, h: 14, x: 22 },
    { id: 'atrelay', item: 'ty_relay', emoji: '🏃', label: 'リレーを する', room: 'school', e: 15, hu: 9, h: 24, x: 8 },
    { id: 'atpottery', item: 'ty_pottery', emoji: '🏺', label: 'うつわを つくる', room: 'kitchen', e: 7, hu: 4, h: 20, x: 14 },
    // こうえんの ゆうぐは かわなくても あそべる
    { id: 'pswing', free: true, emoji: '🎠', label: 'こうえんの ブランコ',   room: 'park', e: 8,  hu: 5, h: 16, x: 4 },
    { id: 'pslide', free: true, emoji: '🛝', label: 'すべりだいで あそぶ',   room: 'park', e: 7,  hu: 4, h: 15, x: 4 },
    { id: 'pgym',   free: true, emoji: '🧗', label: 'ジャングルジムに のぼる', room: 'park', e: 11, hu: 7, h: 14, x: 6, pw: 1 },
    { id: 'pwater', free: true, emoji: '⛲', label: 'ふんすいで みずあそび', room: 'park', e: 6,  hu: 3, h: 18, x: 3, cl: 8 },
    // がっこうの じゅぎょう
    { id: 'study',  free: true, emoji: '📚', label: 'べんきょうを する',   room: 'school', e: 10, hu: 6, h: 4,  x: 30 },
    { id: 'art',    free: true, emoji: '🖍', label: 'ずこうの じかん',     room: 'school', e: 6,  hu: 3, h: 18, x: 10 },
    { id: 'music2', free: true, emoji: '🎵', label: 'おんがくの じかん',   room: 'school', e: 5,  hu: 3, h: 20, x: 8 },
    { id: 'pe',     free: true, emoji: '🏃', label: 'たいいくの じかん',   room: 'school', e: 14, hu: 8, h: 12, x: 10, pw: 1 },
    { id: 'lunch',  free: true, emoji: '🍛', label: 'きゅうしょくを たべる', room: 'school', e: 8, hu: 0, h: 12, x: 3, hg: 26 },
    // 🏥 びょういん
    { id: 'checkup', free: true, emoji: '🩺', label: 'けんしんを うける',   room: 'hospital', e: 3, hu: 2, h: 2,  x: 6,  hp: 25, fee: 20, cure: true },
    { id: 'dentist', free: true, emoji: '🦷', label: 'はいしゃさんに いく', room: 'hospital', e: 4, hu: 2, h: 4,  x: 5,  hp: 10, fee: 15 },
    // 🏖 うみ
    { id: 'swim2',  free: true, emoji: '🏊', label: 'うみで およぐ',       room: 'beach', e: 14, hu: 8, h: 28, x: 8, cl: 12 },
    { id: 'shell',  free: true, emoji: '🐚', label: 'かいがらを ひろう',   room: 'beach', e: 6,  hu: 3, h: 14, x: 5, c: 18 },
    // ⛰ やま
    { id: 'climb',  free: true, emoji: '🥾', label: 'やまのぼりを する',   room: 'mountain', e: 22, hu: 14, h: 18, x: 14, pw: 1 },
    { id: 'bento',  free: true, emoji: '🍱', label: 'おべんとうを たべる', room: 'mountain', e: 3, hu: 0, h: 16, x: 3, hg: 24 },
    // 🎡 ゆうえんち
    { id: 'wheel',  free: true, emoji: '🎡', label: 'かんらんしゃに のる', room: 'fun', e: 4,  hu: 2, h: 30, x: 6, fee: 30 },
    { id: 'coaster',free: true, emoji: '🎢', label: 'コースターに のる',   room: 'fun', e: 12, hu: 6, h: 38, x: 9, fee: 40 },
    // 🐘 どうぶつえん
    { id: 'animal', free: true, emoji: '🐘', label: 'どうぶつを みる',     room: 'zoo', e: 7,  hu: 4, h: 26, x: 9, fee: 25 },
    { id: 'feedzoo',free: true, emoji: '🥕', label: 'えさやりを たいけん', room: 'zoo', e: 6,  hu: 3, h: 20, x: 7, fee: 15 },
    // 🐟 すいぞくかん
    { id: 'fishsee',free: true, emoji: '🐠', label: 'さかなを みる',       room: 'aqua', e: 5, hu: 3, h: 24, x: 12, fee: 25 },
    { id: 'dolphin',free: true, emoji: '🐬', label: 'イルカショーを みる', room: 'aqua', e: 6, hu: 3, h: 32, x: 10, fee: 30 },
    // ♨ おんせん
    { id: 'bathhot',free: true, emoji: '♨', label: 'おんせんに つかる',   room: 'onsen', e: 0, hu: 5, h: 26, x: 5, eg: 26, cg: 70, fee: 15 },
    { id: 'milkcof',free: true, emoji: '🥛', label: 'コーヒーぎゅうにゅう', room: 'onsen', e: 0, hu: 0, h: 14, x: 2, hg: 12, fee: 8 },
    // 📚 としょかん
    { id: 'readlot',free: true, emoji: '📖', label: 'ほんを たくさん よむ', room: 'library', e: 9, hu: 5, h: 8,  x: 40 },
    { id: 'story',  free: true, emoji: '🗣', label: 'おはなしかいに いく', room: 'library', e: 5, hu: 3, h: 22, x: 12 },
    // 🎬 えいがかん
    { id: 'movie',  free: true, emoji: '🎬', label: 'えいがを みる',       room: 'cinema', e: 6, hu: 4, h: 34, x: 8, fee: 25 },
    { id: 'popcorn',free: true, emoji: '🍿', label: 'ポップコーンを たべる', room: 'cinema', e: 2, hu: 0, h: 16, x: 2, hg: 18, fee: 10 },
    // ⛩ じんじゃ
    { id: 'pray',   free: true, emoji: '🙏', label: 'おまいりを する',     room: 'shrine', e: 3, hu: 2, h: 16, x: 6, hp: 12 },
    { id: 'omikuji',free: true, emoji: '🎴', label: 'おみくじを ひく',     room: 'shrine', e: 2, hu: 1, h: 10, x: 4, fee: 5, luck: true }
];

export const ROOM_LABEL: Record<string, string> = {
    out: 'そと', park: 'こうえん', shop: 'おみせ', school: 'がっこう', hospital: 'びょういん',
    beach: 'うみ', mountain: 'やま', fun: 'ゆうえんち', zoo: 'どうぶつえん', aqua: 'すいぞくかん',
    onsen: 'おんせん', library: 'としょかん', cinema: 'えいがかん', shrine: 'じんじゃ', bank: 'ぎんこう',
    living: 'リビング', kitchen: 'キッチン', bed: '2かい'
};

// おしごと: ちからと レベルが たかいほど おだちんが ふえる
export const JOBS: readonly Job[] = [
    { id: 'weed',  label: '🌿 くさむしり',   energy: 12, hunger: 8,  happy: 3, minPower: 0, minLevel: 1,
      base: 12, perPower: 2, perLevel: 1 },
    { id: 'carry', label: '📦 にもつはこび', energy: 25, hunger: 15, happy: 6, minPower: 3, minLevel: 1,
      base: 28, perPower: 4, perLevel: 2 },
    { id: 'shop',  label: '🏪 おみせばん',   energy: 18, hunger: 10, happy: 4, minPower: 0, minLevel: 5,
      base: 22, perPower: 2, perLevel: 3 },
    { id: 'office', label: '🏢 かいしゃで はたらく', energy: 30, hunger: 18, happy: 8, minPower: 10, minLevel: 10,
      base: 90, perPower: 6, perLevel: 6 },
    { id: 'space', label: '🚀 うちゅうひこうし', energy: 45, hunger: 25, happy: 10, minPower: 20, minLevel: 15,
      base: 600, perPower: 20, perLevel: 25 },
    { id: 'legend', label: '🌠 でんせつの おしごと', energy: 60, hunger: 35, happy: 0, minPower: 30, minLevel: 20,
      base: 0, perPower: 0, perLevel: 0, flat: '1' + '0'.repeat(500) }   // 1のあとに 0が 500こ
];

export const SHOP_CAT: readonly (readonly [string, string])[] = [
    ['room', '🛋 リビング'],
    ['kitchen', '🍳 キッチン'],
    ['bedroom', '🛏 2かい'],
    ['yard', '🌳 そと'],
    ['wear', '✨ みにつける'],
    ['health', '💊 けんこう'],
    ['friend', '👫 みんなの'],
    ['style', '🎨 もようがえ'],
    ['inf', '🎲 ふしぎ'],
    ['sweet', '🍬 おかし'],
    ['furn', '🪑 かぐ'],
    ['more', '🏬 おみせビル']
];

export const HOME_VIEW: Record<string, number> = { out: 1, living: 1, kitchen: 1, bed: 1 };

export const ACT_EMOJI: Record<string, string> = { eat: '🍚', bath: '🫧', play: '🎾', train: '💪', work: '💼', activity: '🎉' };

export const FRIEND_X: readonly number[] = [0.86, 0.09, 0.70, 0.20];

export const TONE: Record<string, { readonly tail: string; readonly emo: string; readonly end?: string }> = {
    puni:   { tail: '　えへへ', emo: '🍰' },
    kuro:   { tail: '　…ふん', emo: '🐟' },
    piyo:   { tail: '　ぴよっ！', emo: '🌽' },
    moko:   { tail: '　のんびり〜', emo: '🍯' },
    aoba:   { tail: '　ふふ', emo: '🍡' },
    kira:   { tail: '　キラッ✨', emo: '🍭' },
    daifu:  { tail: '　もぐもぐ', emo: '🍙' },
    koharu: { tail: '　あらあら', emo: '🍓' },
    pet:    { tail: '　えへへ', emo: '🐾' },
    robot:  { tail: '　ピピッ', emo: '🤖' }
};

export const CHAT_CHIPS: readonly string[] = ['こんにちは', 'すき！', 'あそぼう', 'げんき？', 'ありがとう', 'またね'];

export const TALK_MENU: readonly { readonly key: string; readonly label: string }[] = [
    { key: 'hi',     label: '😀 やっほー！' },
    { key: 'how',    label: '❓ ちょうし どう？' },
    { key: 'what',   label: '💡 なにを すれば いい？' },
    { key: 'chat',   label: '🎵 なにか はなして' },
    { key: 'thanks', label: '🙏 ありがとう' }
];

export const ORDER_CHIPS: readonly (readonly [string, string])[] = [
    ['🍚 ごはんを あげて', 'ごはんを あげて'],
    ['🛁 おふろに いれて', 'おふろに いれて'],
    ['🧹 そうじして', 'そうじして'],
    ['🎾 あそんで あげて', 'あそんで あげて'],
    ['💪 きたえて', 'きたえて'],
    ['💼 おしごと して', 'おしごと して'],
    ['🏞 こうえんに いこう', 'こうえんに いこう'],
    ['📚 べんきょうして', 'べんきょうして'],
    ['🐷 ちょきんしたい', 'ちょきんしたい'],
    ['🗺 どこか いきたい', 'どこか おでかけしたい'],
    ['🏦 ぎんこうに いこう', 'ぎんこうに いこう'],
    ['👫 ともだちに あいたい', 'ともだちに あいたい'],
    ['🏪 おみせに いこう', 'おみせに いこう'],
    ['💊 なおして', 'なおして'],
    ['💤 ねかせて', 'ねかせて'],
    ['⏰ おこして', 'おこして']
];

export const FOOD_ALIAS: readonly (readonly [string, readonly string[]])[] = [
    ['steak', ['ステーキ']], ['ramen', ['ラーメン']], ['pizza', ['ピザ']],
    ['icecream', ['アイス']], ['pudding', ['プリン']], ['donut', ['ドーナツ']],
    ['cake', ['ケーキ']], ['honey', ['はちみつ', 'ハチミツ']], ['grape', ['ぶどう', 'ブドウ']],
    ['banana', ['バナナ']], ['milk', ['ミルク', 'ぎゅうにゅう', '牛乳']], ['fish', ['さかな', '魚']],
    ['berry', ['いちご', 'イチゴ']], ['carrot', ['にんじん', 'ニンジン', '人参']],
    ['onigiri', ['おにぎり']], ['feast', ['ディナー', 'ごうか', 'ごちそう']],
    ['rice', ['ごはん', 'ご飯', 'ライス']]
];

export const ORDERS: readonly { readonly key: string; readonly words: readonly string[] }[] = [
    { key: 'med',     words: ['くすり', '薬', 'なおし', '治し', 'びょうき', '病気', 'かいふく'] },
    { key: 'wake',    words: ['おこして', '起こして', 'おきて', 'おはよう', 'めをさま'] },
    { key: 'sleep',   words: ['ねかせ', 'ねむら', 'おやすみ', 'ねる', '寝', 'すいみん'] },
    { key: 'bath',    words: ['おふろ', 'ふろ', '風呂', 'あらっ', 'あらい', '洗', 'シャワー', 'ぴかぴか', 'きれいに'] },
    { key: 'clean',   words: ['そうじ', '掃除', 'うんち', 'ちらか', 'かたづけ', '片付', 'ごみ', 'ゴミ'] },
    { key: 'feed',    words: ['ごはん', 'ご飯', 'たべ', '食べ', 'おなか', 'えさ', 'エサ', 'おやつ', 'まんぷく'] },
    { key: 'play',    words: ['あそ', '遊', 'たのし', 'ゲーム', 'あいて'] },
    { key: 'train',   words: ['きたえ', '鍛え', 'トレーニング', 'ちから', 'きんとれ', '筋トレ', 'うんどう', '運動'] },
    { key: 'job',     words: ['しごと', '仕事', 'はたら', '働', 'かせ', '稼', 'コイン', 'おかね', 'お金', 'バイト'] },
    { key: 'friend',  words: ['ともだち', '友だち', '友達', 'なかよし', 'あいたい'] },
    { key: 'v-bank',  words: ['ぎんこう', '銀行', 'こうざ', 'ATM', 'つうちょう'] },
    { key: 'bank',    words: ['ちょきん', '貯金', 'ためて', 'ちょきんばこ', 'ためる', 'あずけ'] },
    { key: 'shop',    words: ['ショップ', 'かいもの', '買い物', 'おみせ', 'みせ', 'かって', '買って'] },
    { key: 'report',  words: ['レポート', 'せいせき', 'きろく', '記録'] },
    { key: 'status',  words: ['ずかん', '図鑑', 'ステータス'] },
    { key: 'study',   words: ['べんきょう', '勉強', 'がっこう', '学校', 'じゅぎょう', 'しゅくだい'] },
    { key: 'v-hospital', words: ['びょういん', '病院', 'おいしゃ', 'けんしん'] },
    { key: 'v-beach',    words: ['うみ', '海', 'ビーチ', 'すなはま'] },
    { key: 'v-mountain', words: ['やま', '山', 'やまのぼり', 'とざん'] },
    { key: 'v-fun',      words: ['ゆうえんち', '遊園地', 'かんらんしゃ', 'コースター'] },
    { key: 'v-zoo',      words: ['どうぶつえん', '動物園'] },
    { key: 'v-aqua',     words: ['すいぞくかん', '水族館', 'イルカ'] },
    { key: 'v-onsen',    words: ['おんせん', '温泉', 'ゆっくり'] },
    { key: 'v-library',  words: ['としょかん', '図書館'] },
    { key: 'v-cinema',   words: ['えいが', '映画'] },
    { key: 'v-shrine',   words: ['じんじゃ', '神社', 'おまいり', 'おみくじ'] },
    { key: 'map',        words: ['おでかけ', 'マップ', 'ちず', '地図', 'どこか'] },
    { key: 'v-park',  words: ['こうえん', '公園', 'ゆうぐ', 'ブランコ', 'すべりだい'] },
    { key: 'v-bed',   words: ['2かい', '２かい', 'にかい', '二かい', '二階', 'しんしつ', '寝室', 'ベッド'] },
    { key: 'v-kit',   words: ['キッチン', 'だいどころ', '台所'] },
    { key: 'v-liv',   words: ['リビング', 'いま', '居間'] },
    { key: 'v-out',   words: ['そと', '外', 'おにわ', 'にわ', '庭'] }
];

export const OUTDOOR: Record<string, number> = { out: 1, park: 1, shop: 1, school: 1, hospital: 1, beach: 1, mountain: 1,
                  fun: 1, zoo: 1, aqua: 1, onsen: 1, library: 1, cinema: 1, shrine: 1, bank: 1 };

export const PLACE_X: Record<string, number> = { park: 0.46, shop: 0.28, school: 0.24, hospital: 0.30, beach: 0.52,
                  mountain: 0.44, fun: 0.42, zoo: 0.52, aqua: 0.50, onsen: 0.50,
                  library: 0.21, cinema: 0.60, shrine: 0.50, bank: 0.32 };

export const ROOM_NAME: Record<string, string> = { living: 'リビング', kitchen: 'キッチン', bed: '2かいの しんしつ' };

export const OUT_NAME: Record<string, string> = {
    out: '🌳 そとに でた。', park: '🏞 こうえんに きた！', shop: '🏪 おみせに きた！',
    school: '🏫 がっこうに ついた！', hospital: '🏥 びょういんに きた。', beach: '🏖 うみに きた！',
    mountain: '⛰ やまに のぼりに きた！', fun: '🎡 ゆうえんちに きた！', zoo: '🐘 どうぶつえんに きた！',
    aqua: '🐟 すいぞくかんに きた！', onsen: '♨ おんせんに きた！', library: '📚 としょかんに きた。',
    cinema: '🎬 えいがかんに きた！', shrine: '⛩ じんじゃに おまいりに きた。',
    bank: '🏦 ぎんこうに きた！'
};

export const PLACES: readonly Place[] = [
    { v: 'out',      icon: '🌳', name: 'おうちの そと', note: 'おうち・おにわ' },
    { v: 'park',     icon: '🏞', name: 'こうえん',     note: 'ブランコ・すべりだい' },
    { v: 'shop',     icon: '🏪', name: 'おみせ',       note: 'かいもの' },
    { v: 'school',   icon: '🏫', name: 'がっこう',     note: 'べんきょう・きゅうしょく' },
    { v: 'hospital', icon: '🏥', name: 'びょういん',   note: 'けんしん・びょうきを なおす' },
    { v: 'beach',    icon: '🏖', name: 'うみ',         note: 'およぐ・かいがら' },
    { v: 'mountain', icon: '⛰', name: 'やま',         note: 'やまのぼり' },
    { v: 'fun',      icon: '🎡', name: 'ゆうえんち',   note: 'かんらんしゃ・コースター' },
    { v: 'zoo',      icon: '🐘', name: 'どうぶつえん', note: 'どうぶつを みる' },
    { v: 'aqua',     icon: '🐟', name: 'すいぞくかん', note: 'さかな・イルカショー' },
    { v: 'onsen',    icon: '♨', name: 'おんせん',     note: 'ゆっくり つかる' },
    { v: 'library',  icon: '📚', name: 'としょかん',   note: 'ほんを よむ' },
    { v: 'cinema',   icon: '🎬', name: 'えいがかん',   note: 'えいがを みる' },
    { v: 'shrine',   icon: '⛩', name: 'じんじゃ',     note: 'おまいり・おみくじ' },
    { v: 'bank',     icon: '🏦', name: 'ぎんこう',     note: 'いくらでも あずけられる' },
    { v: 'living',   icon: '🛋', name: 'リビング',     note: 'おうちの なか' },
    { v: 'kitchen',  icon: '🍳', name: 'キッチン',     note: 'りょうり' },
    { v: 'bed',      icon: '🛏', name: '2かい',        note: 'ねる・ほしを みる' }
];

export const INF_FX: readonly InfEffect[] = [
    { key: 'happy', note: 'きげんが へりにくい' },
    { key: 'hunger', note: 'おなかが へりにくい' },
    { key: 'energy', note: 'げんきが へりにくい' },
    { key: 'clean', note: 'きれいが へりにくい' },
    { key: 'hp', note: 'たいりょくが かいふく しやすい' },
    { key: 'exp', note: 'けいけんちが ふえる' }
];

export const FU_KIND: readonly KindEntry[] = [
    { n: 'イス', e: '🪑' }, { n: 'テーブル', e: '🍽' }, { n: 'ベッド', e: '🛏' }, { n: 'ソファ', e: '🛋' },
    { n: 'たな', e: '🗄' }, { n: 'ランプ', e: '💡' }, { n: 'とけい', e: '⏰' }, { n: 'かがみ', e: '🪞' },
    { n: 'はこ', e: '🧰' }, { n: 'かびん', e: '🏺' }
];

export const DECOR_ZONE: Record<string, DecorZone> = {
    room:    { wallY: 0.13, floorY: 0.88 },
    kitchen: { wallY: 0.13, floorY: 0.88 },
    bedroom: { wallY: 0.13, floorY: 0.88 },
    yard:    { wallY: 0.30, floorY: 0.88 }
};

/** 1つの へやに かざる かずの じょうげん。 */
export const DECOR_MAX = 60;
