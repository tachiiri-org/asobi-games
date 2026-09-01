// ペットの状態と、その置き場。
//
// 元は localStorage に JSON で置いていた。ここではテナントの置き場（ctx.save）へ移す。
// 読めなかったときに書かない決まりは save.ts が持っているので、ここは形の面倒だけを見る。
//
// 古い保存を開けるようにする補いは、元の load() が持っていた分をそのまま残してある。
// 家族が育てている途中の状態なので、鍵が1つ欠けただけで開けなくなる形にしない。

import { big } from './coins';
import { MORE_KEY_MAX } from './more-data';

export type PoopMark = { x: number };
export type BankEntry = { k: string; a: bigint; d: number };
export type FriendRecord = { lv: number; times: number; said?: number };

export type PetStats = {
  earned: bigint;
  acts: number; meds: number; sick: number; meals: number; plays: number; baths: number;
  talks: number; orders: number;
  interest: bigint;
  sweets: number;
};

export type PetState = {
  version: number;
  name: string;
  /** egg のあいだは、まだ たまご。かえると species が入る。 */
  stage: string;
  species: string | null;
  tap: number;
  lastTick: number;
  ageSec: number;
  hunger: number; happy: number; clean: number; energy: number; hp: number;
  level: number; exp: number; coins: bigint; power: number;
  sleeping: boolean; sick: boolean; sickTimer: number;
  poops: PoopMark[];
  poopTimer: number; postTimer: number; robotTimer: number; chatTimer: number;
  jobs: number; helps: number; lastTalk: number;
  savings: bigint; bankTimer: number; bankAcct: bigint; acctTimer: number;
  bankLog: BankEntry[];
  friends: Record<string, FriendRecord>;
  roomies: Record<string, boolean>;
  invites: Record<string, boolean>;
  /** ふしぎショップの もちもの。番号を鍵にする。 */
  inf: Record<string, boolean>;
  infAll: boolean;
  furn: Record<string, boolean>;
  furnAll: boolean;
  /** おみせビルの もちもの。かいごとに袋を分ける。 */
  more: Record<string, Record<string, boolean>>;
  moreAll: boolean;
  stats: PetStats;
  view: string;
  owned: Record<string, boolean>;
  worn: Record<string, boolean>;
  /** もようがえ。1つの場所に何枚も重ねられる。 */
  theme: Record<string, string[]>;
  care: { eat: number; play: number; train: number; clean: number };
  log: string[];
  exhausted: boolean;
};

export const nowSec = (): number => Date.now() / 1000;

export const newState = (): PetState => {
  const t = nowSec();
  return {
    version: 1,
    name: 'たまご',
    stage: 'egg',
    species: null,
    tap: 0,
    lastTick: t,
    ageSec: 0,
    hunger: 80, happy: 80, clean: 100, energy: 100, hp: 100,
    level: 1, exp: 0, coins: 60n, power: 0,
    sleeping: false, sick: false, sickTimer: 0,
    poops: [], poopTimer: 90, postTimer: 180, robotTimer: 45, chatTimer: 20, jobs: 0,
    helps: 0, lastTalk: 0, savings: 0n, bankTimer: 180, bankAcct: 0n, acctTimer: 180, bankLog: [],
    friends: {}, roomies: {}, invites: {}, inf: {}, infAll: false, furn: {}, furnAll: false,
    more: {}, moreAll: false,
    stats: {
      earned: 0n, acts: 0, meds: 0, sick: 0, meals: 0, plays: 0, baths: 0,
      talks: 0, orders: 0, interest: 0n, sweets: 0,
    },
    view: 'out',
    owned: {},
    worn: {},
    theme: {},
    care: { eat: 0, play: 0, train: 0, clean: 0 },
    log: ['たまごが とどいた！ タップして あたためよう。'],
    exhausted: false,
  };
};

/** BigInt は JSON に入らないので「123n」の形で残す。 */
export const serialize = (state: PetState): string =>
  JSON.stringify(state, (_k, v: unknown) => (typeof v === 'bigint' ? `${v.toString()}n` : v));

/** 「123n」の かたちを かずに もどす。 */
const strip = (v: unknown): unknown => (typeof v === 'string' ? v.replace(/n$/, '') : v);

/** 短い鍵に付け替える。長い番号をそのまま鍵にすると、保存が膨れて置けなくなる。 */
type MoreKeyFn = (num: string) => string;

/**
 * 保存から状態を戻す。開けなければ null。
 *
 * 補いはすべて「古い保存を開けるため」で、順序も元のまま。ここを整理すると、
 * どの時代の保存が開けなくなるのかが分からなくなる。
 */
export const deserialize = (raw: string, moreKey: MoreKeyFn): PetState | null => {
  try {
    const s = JSON.parse(raw) as Record<string, unknown>;
    if (!s || s.version !== 1) return null;

    if (!s.owned) s.owned = {};                 // ショップより まえの セーブ
    if (!s.worn) {                              // 1つしか つけられなかった ころの セーブ
      s.worn = {};
      const wearing = s.wearing;
      if (typeof wearing === 'string') (s.worn as Record<string, boolean>)[wearing] = true;
    }
    delete s.wearing;
    if (s.view === 'in') s.view = 'living';     // へやが 1つだった ころの セーブ

    if (!s.stats) {
      s.stats = { earned: 0, acts: 0, meds: 0, sick: 0, meals: 0, plays: 0, baths: 0 };
    }
    const stats = s.stats as Record<string, unknown>;
    if (stats.earned === undefined) stats.earned = 0;
    if (!s.theme) s.theme = {};
    const theme = s.theme as Record<string, unknown>;
    for (const k of Object.keys(theme)) {       // 1まいだけの ころの セーブ
      if (!Array.isArray(theme[k])) theme[k] = [theme[k]];
    }
    if (typeof s.postTimer !== 'number') s.postTimer = 180;
    if (typeof s.robotTimer !== 'number') s.robotTimer = 45;   // ロボットが くるまえの セーブ
    if (typeof s.chatTimer !== 'number') s.chatTimer = 20;
    if (typeof s.helps !== 'number') s.helps = 0;
    if (typeof s.lastTalk !== 'number') s.lastTalk = 0;
    if (typeof stats.talks !== 'number') stats.talks = 0;
    if (typeof stats.orders !== 'number') stats.orders = 0;
    if (typeof stats.sweets !== 'number') stats.sweets = 0;
    if (stats.interest === undefined) stats.interest = 0;
    if (s.savings === undefined) s.savings = 0;                // ちょきんばこが なかった ころの セーブ
    if (typeof s.bankTimer !== 'number') s.bankTimer = 180;
    if (s.bankAcct === undefined) s.bankAcct = 0;              // ぎんこうが なかった ころの セーブ
    if (typeof s.acctTimer !== 'number') s.acctTimer = 180;
    if (!Array.isArray(s.bankLog)) s.bankLog = [];
    if (!s.friends) s.friends = {};                            // ともだちが いなかった ころの セーブ
    if (!s.roomies) s.roomies = {};                            // いっしょに すんでいる ともだち
    if (!s.invites) s.invites = {};
    if (!s.inf) s.inf = {};                                    // むげんショップの もちもの
    if (typeof s.infAll !== 'boolean') s.infAll = false;
    if (!s.furn) s.furn = {};                                  // かぐやさんの もちもの
    if (typeof s.furnAll !== 'boolean') s.furnAll = false;
    if (!s.more) s.more = {};                                  // もっともっとデパートの もちもの
    if (typeof s.moreAll !== 'boolean') s.moreAll = false;

    const more = s.more as Record<string, Record<string, boolean>>;
    for (const fid of Object.keys(more)) {      // ながい かぎは みじかい かぎに つけかえる
      const bag = more[fid];
      for (const k of Object.keys(bag)) {
        if (k.length > MORE_KEY_MAX && k.indexOf('.') < 0) {
          bag[moreKey(k)] = true;
          delete bag[k];
        }
      }
    }

    // おかねは BigInt に もどす（ふるい セーブの すうじも そのまま つかえる）
    for (const k of ['coins', 'savings', 'bankAcct'] as const) s[k] = big(strip(s[k]));
    for (const k of ['earned', 'interest'] as const) stats[k] = big(strip(stats[k]));
    for (const e of s.bankLog as { a: unknown }[]) e.a = big(strip(e.a));

    // 足りない欄は新しい状態から埋める。欄が1つ欠けただけで開けなくなる形にしない。
    return { ...newState(), ...(s as unknown as PetState) };
  } catch {
    return null;
  }
};

export const expNeeded = (level: number): number => 20 + level * 15;

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
