// 番号から品を組み立てる。
//
// ふしぎショップ・おかしやさん・かぐやさん・おみせビルは、品を表に持たない。
// おみせビルは 10 の 149 乗こあるので、表にする量ではない。番号を桁ごとに読んで、
// 語の束から名前と絵を組み立てる。だから何番の品を見ても、いつも同じ名前になる。
//
// けたが多い側（おみせビル）は BigInt でも重いので、番号を文字列のまま扱う。
// 足し引きは末尾15けただけ見れば足りる（繰り上がりだけ上へ渡す）。

import { coinText } from './coins';
import { FU_KIND, INF_FX } from './data';
import {
  FU_COL, FU_MAT, FU_PAT, FU_SIZE,
  INF_A, INF_B, INF_C, INF_D, INF_E,
  MORE_ATT, MORE_COL, MORE_KEY_MAX, MORE_PAT, MORE_PER, MORE_SIZE, MO_TAIL,
  SW_A, SW_B, SW_C, SW_E,
} from './more-data';
import type { InfEffect, MoreShop } from './types';

// ── ふしぎショップ（10^5000 こ）

const infDigit = (i: bigint, place: number): number => Number((i / 10n ** BigInt(place)) % 10n);

export const infName = (i: bigint): string =>
  `${INF_A[infDigit(i, 0)]} ${INF_B[infDigit(i, 1)]} ${INF_C[infDigit(i, 2)]}${INF_D[infDigit(i, 3)]}`;
export const infEmoji = (i: bigint): string => INF_E[infDigit(i, 4)];
export const infFx = (i: bigint): InfEffect => INF_FX[Number(i % 6n)];
export const infCost = (i: bigint): number => 60 + Number(i % 4941n);

// ── おかしやさん（9おくこ）

const swDigit = (i: bigint, place: number): number => Number((i / 10n ** BigInt(place)) % 10n);

export const sweetName = (i: bigint): string => SW_A[swDigit(i, 0)] + SW_B[swDigit(i, 1)] + SW_C[swDigit(i, 2)];
export const sweetEmoji = (i: bigint): string => SW_E[swDigit(i, 2)];
export const sweetCost = (i: bigint): number => 20 + Number(i % 481n);
export const sweetHunger = (i: bigint): number => 8 + Number(i % 33n);
export const sweetHappy = (i: bigint): number => 10 + Number(i % 29n);
export const sweetExp = (i: bigint): number => 1 + Number(i % 6n);

// ── かぐやさん（10ちょうこ）

const fuDigit = (i: bigint, place: number): number => Number((i / 10n ** BigInt(place)) % 10n);

export const furnName = (i: bigint): string =>
  FU_SIZE[fuDigit(i, 4)] + FU_MAT[fuDigit(i, 3)] + FU_COL[fuDigit(i, 2)]
  + FU_PAT[fuDigit(i, 1)] + FU_KIND[fuDigit(i, 0)].n;
export const furnEmoji = (i: bigint): string => FU_KIND[fuDigit(i, 0)].e;
export const furnCost = (i: bigint): number => 80 + Number(i % 3921n);

// ── おみせビル（数を文字列のまま扱う）

/** みぎから place ばんめの すうじ。 */
export const moDigit = (num: string, place: number): number => {
  const i = num.length - 1 - place;
  return i >= 0 ? num.charCodeAt(i) - 48 : 0;
};

const moTrim = (num: string): string => num.replace(/^0+(?=\d)/, '');

/** ちいさな かずを たす。末尾15けたで足りて、繰り上がりだけ上へ渡す。 */
export const moAdd = (num: string, k: number): string => {
  if (k === 0) return num;
  const cut = Math.max(0, num.length - MO_TAIL);
  const tail = num.slice(cut);
  const sum = String(Number(tail) + k);
  if (sum.length <= tail.length) return num.slice(0, cut) + sum.padStart(tail.length, '0');
  const out = sum.slice(1);
  let i = cut;
  while (i > 0) {                            // 9 が ならんでいる あいだは 0 に なる
    const c = num.charCodeAt(i - 1) - 48;
    if (c < 9) return num.slice(0, i - 1) + String(c + 1) + '0'.repeat(cut - i) + out;
    i--;
  }
  return '1' + '0'.repeat(cut) + out;
};

/** ちいさな かずを ひく（0より ちいさくは ならない）。 */
export const moSub = (num: string, k: number): string => {
  if (k === 0) return num;
  const cut = Math.max(0, num.length - MO_TAIL);
  const tail = num.slice(cut);
  const t = Number(tail);
  if (t >= k) return moTrim(num.slice(0, cut) + String(t - k).padStart(tail.length, '0'));
  if (cut === 0) return '0';
  const out = String(1000000000000000 + t - k);   // かならず 15けた
  let i = cut;
  while (i > 0) {                            // 0 が ならんでいる あいだは 9 に なる
    const c = num.charCodeAt(i - 1) - 48;
    if (c > 0) return moTrim(num.slice(0, i - 1) + String(c - 1) + '9'.repeat(cut - i) + out);
    i--;
  }
  return '0';
};

export const moMod = (num: string, m: number): number => {
  let r = 0;
  for (let i = 0; i < num.length; i++) r = (r * 10 + (num.charCodeAt(i) - 48)) % m;
  return r;
};

/** ちいさな かずで わる（あまりは すてる）。 */
export const moDiv = (num: string, d: number): string => {
  let out = '';
  let rem = 0;
  for (let i = 0; i < num.length; i++) {
    const cur = rem * 10 + (num.charCodeAt(i) - 48);
    out += String((cur / d) | 0);
    rem = cur % d;
  }
  return out.replace(/^0+(?=\d)/, '');
};

export const moNumText = (num: string): string =>
  num.length <= 20
    ? coinText(BigInt(num))
    : `${num[0]}.${num.slice(1, 3)}×10^${num.length - 1}（${num.length}けた）`;

/** ながい ばんごうは そのまま しまうと セーブが おもいので、みじかい かぎに する。 */
const moHash = (num: string): string => {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < num.length; i++) {
    const c = num.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c, 2654435761) >>> 0;
    h2 = (h2 ^ (h2 >>> 13)) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
};

/** みじかい ばんごうは そのまま。ながいのは 「ハッシュ.したろくけた.けたすう」。 */
export const moreKey = (num: string): string =>
  num.length <= MORE_KEY_MAX ? num : `${moHash(num)}.${num.slice(-6)}.${num.length}`;

/** かぎから すうじの ぶぶんを とりだす。 */
export const moKeyDigits = (key: string): string => {
  const i = key.indexOf('.');
  if (i < 0) return key;
  const j = key.indexOf('.', i + 1);
  return j < 0 ? key.slice(i + 1) : key.slice(i + 1, j);
};

// 10^exp は桁が大きく、作り直すと重い。要ったときに1回だけ作って覚えておく。
// 元は表そのものに書き込んでいたが、表は読むだけのものなので外に持つ。
const totalCache = new Map<string, bigint>();
const lastCache = new Map<string, string>();

export const moreTotal = (sh: MoreShop): bigint => {
  const hit = totalCache.get(sh.id);
  if (hit !== undefined) return hit;
  const v = 10n ** BigInt(sh.exp);
  totalCache.set(sh.id, v);
  return v;
};

export const moreText = (sh: MoreShop): string =>
  sh.exp <= 20 ? coinText(moreTotal(sh)) : `1.00×10^${sh.exp}（${sh.exp + 1}けた）`;
export const moreShortT = (sh: MoreShop): string =>
  sh.exp <= 20 ? coinText(moreTotal(sh)) : `10^${sh.exp}`;
export const moreMaxText = (sh: MoreShop): string =>
  sh.exp <= 20 ? coinText(moreTotal(sh) - 1n) : `9.99×10^${sh.exp - 1}（${sh.exp}けた）`;

/** さいごの ページの さいしょの ばんごう。 */
export const moreLast = (sh: MoreShop): string => {
  const hit = lastCache.get(sh.id);
  if (hit !== undefined) return hit;
  const nines = '9'.repeat(sh.exp);      // 10^e - 1
  const v = moSub(nines, moMod(nines, MORE_PER));
  lastCache.set(sh.id, v);
  return v;
};

export const moreName = (sh: MoreShop, num: string): string =>
  MORE_ATT[moDigit(num, 5)] + MORE_SIZE[moDigit(num, 4)] + sh.mat[moDigit(num, 3) % sh.mat.length]
  + MORE_COL[moDigit(num, 2)] + MORE_PAT[moDigit(num, 1)] + sh.kind[moDigit(num, 0) % sh.kind.length].n;

export const moreEmoji = (sh: MoreShop, num: string): string =>
  sh.kind[moDigit(num, 0) % sh.kind.length].e;

export const moreCost = (num: string): number => 100 + moMod(num, 9901);
