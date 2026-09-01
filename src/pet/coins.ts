// おかねの扱い。
//
// おかねは BigInt で持つので上限が無い（何けたでも良い）。おみせビルの品は 10 の 149 乗まで
// あって、number では途中で精度が落ちる。落ちると「買ったのに減っていない」が起きる。
//
// 見せるときだけ、読みやすい形に落とす。

import { BIG_UNITS } from './data';

/** 何が来ても BigInt にする。保存から戻した文字列も、古い保存の数も受ける。 */
export const big = (v: unknown): bigint => {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? BigInt(Math.floor(v)) : 0n;
  if (typeof v === 'string') {
    const d = v.replace(/[^0-9]/g, '');
    return d ? BigInt(d) : 0n;
  }
  return 0n;
};

export const bmin = (a: bigint, b: bigint): bigint => (a < b ? a : b);
export const bmax = (a: bigint, b: bigint): bigint => (a > b ? a : b);

/**
 * おおきな かずを 読みやすい形に する。
 * 72けたを こえたら 「1.2×10^500（501けた）」の かたちで見せる。
 */
export const coinText = (n: bigint | number | string): string => {
  const v = big(n);
  if (v < 0n) return '0';
  const str = v.toString();
  const len = str.length;
  if (len <= 4) return str;

  if (len > 72) {
    const head = str[0] + '.' + str.slice(1, 3);
    return `${head}×10^${len - 1}（${len}けた）`;
  }
  for (const [dg, unit] of BIG_UNITS) {
    if (len > dg) {
      const whole = str.slice(0, len - dg);
      const frac = str.slice(len - dg, len - dg + 1);
      const num = whole.length >= 3 || frac === '0' ? whole : whole + '.' + frac;
      return num + unit;
    }
  }
  return str;
};
