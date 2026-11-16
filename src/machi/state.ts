// せかいの まち の 状態と、その 置き場。
//
// localStorage は つかわない（端末を かえると 消えるし、その子の アカウントに つかない）。
// ctx.save に 置く。キャラは かいた ときだけ 変わるので べつの 部分に 分ける——
// 毎秒の 保存に 256もじ×24人を のせ直すのは もったいない。
//
// 読めなかった ときに 書かない決まりは あそびば側（save.ts）が 持っているので、
// ここは 形の 面倒だけ 見る。欄が 1つ 欠けただけで 開けなくなる 形には しない。

import { BUILDINGS, CITIES, DOT, PEOPLE_MAX, RESIDENT_BONUS, START_COINS, TILES, buildingById } from './data';
import type { MachiState, PeopleSave, Person } from './types';

export const blankDots = (): string => '.'.repeat(DOT * DOT);

export const newState = (): MachiState => ({
  version: 1,
  coins: START_COINS,
  here: CITIES[0].id,
  tiles: { [CITIES[0].id]: new Array<string | null>(TILES).fill(null) },
  opened: [CITIES[0].id],
  weapons: {},
  music: true,
  log: [],
  stats: { built: 0, drawn: 0, maxPop: 0, won: 0, lost: 0 },
});

/** できごとを ひかえに のこす。レポートを 書く ときの 下じきに なる。 */
export const LOG_MAX = 30;
export const addLog = (state: MachiState, text: string): void => {
  state.log.unshift({ at: Date.now(), text });
  if (state.log.length > LOG_MAX) state.log.length = LOG_MAX;
};

/** そのまちの ごばん。まだ 無ければ つくる。 */
export const tilesOf = (state: MachiState, cityId: string): (string | null)[] => {
  const got = state.tiles[cityId];
  if (got) return got;
  const made = new Array<string | null>(TILES).fill(null);
  state.tiles[cityId] = made;
  return made;
};

/** そのまちの じんこう（建てた ものに すめる 人の かず）。 */
export const popOfCity = (state: MachiState, cityId: string): number => {
  let sum = 0;
  for (const id of tilesOf(state, cityId)) {
    if (id) sum += buildingById(id)?.pop ?? 0;
  }
  return sum;
};

/** せかいの じんこう。これが このゲームの 点になる。 */
export const worldPop = (state: MachiState): number => {
  let sum = 0;
  for (const city of CITIES) sum += popOfCity(state, city.id);
  return sum;
};

/** そのまちに すんでいる キャラ。 */
export const residentsOf = (people: readonly Person[], cityId: string): readonly Person[] =>
  people.filter((p) => p.city === cityId);

/**
 * 10びょうに はいる コイン。
 *
 * すんでいる キャラ1人ごとに、そのまちの ぶんが RESIDENT_BONUS だけ ふえる。
 * かいた キャラが ただの かざりに ならないように、もうけに つなげてある。
 */
export const incomePer10s = (state: MachiState, people: readonly Person[]): number => {
  let sum = 0;
  for (const city of CITIES) {
    let base = 0;
    for (const id of tilesOf(state, city.id)) {
      if (id) base += buildingById(id)?.coin ?? 0;
    }
    if (base === 0) continue;
    sum += base * (1 + RESIDENT_BONUS * residentsOf(people, city.id).length);
  }
  return sum;
};

/** じんこうが とどいて、まだ ひらいていない まち。 */
export const cityToOpen = (state: MachiState, pop: number): string | null => {
  for (const city of CITIES) {
    if (!state.opened.includes(city.id) && pop >= city.needPop) return city.id;
  }
  return null;
};

export const serialize = (state: MachiState): string => JSON.stringify(state);

/** 保存から もどす。開けなければ null。 */
export const deserialize = (raw: string): MachiState | null => {
  try {
    const got = JSON.parse(raw) as Partial<MachiState> | null;
    if (!got || got.version !== 1) return null;
    const state: MachiState = { ...newState(), ...got };

    // ごばんは かたちを 見て なおす。マスの かずが 合わない 保存（ごばんを ひろげた
    // ときの もの）も、ある ぶんだけ 入れて のこりは 空に する。
    const tiles: Record<string, (string | null)[]> = {};
    const raws = (got.tiles ?? {}) as Record<string, unknown>;
    for (const city of CITIES) {
      const board = new Array<string | null>(TILES).fill(null);
      const src = raws[city.id];
      if (Array.isArray(src)) {
        for (let i = 0; i < Math.min(TILES, src.length); i++) {
          const id = src[i];
          if (typeof id === 'string' && BUILDINGS.some((b) => b.id === id)) board[i] = id;
        }
      }
      tiles[city.id] = board;
    }
    state.tiles = tiles;

    state.opened = Array.isArray(got.opened)
      ? CITIES.filter((c) => got.opened?.includes(c.id)).map((c) => c.id)
      : [CITIES[0].id];
    if (!state.opened.includes(CITIES[0].id)) state.opened.unshift(CITIES[0].id);
    if (!state.opened.includes(state.here)) state.here = CITIES[0].id;
    if (typeof state.coins !== 'number' || !Number.isFinite(state.coins)) state.coins = START_COINS;

    // 事件・ぶき・レポートより まえの 保存にも、無い 欄が ある。欄が 1つ 欠けた
    // だけで 開けなくなる 形には しない。
    if (!state.weapons || typeof state.weapons !== 'object') state.weapons = {};
    if (typeof state.music !== 'boolean') state.music = true;
    if (!Array.isArray(state.log)) state.log = [];
    state.log = state.log
      .filter((e) => e && typeof e.text === 'string' && typeof e.at === 'number')
      .slice(0, LOG_MAX);
    const stats = state.stats as Partial<MachiState['stats']> | undefined;
    state.stats = {
      built: stats?.built ?? 0,
      drawn: stats?.drawn ?? 0,
      maxPop: stats?.maxPop ?? 0,
      won: stats?.won ?? 0,
      lost: stats?.lost ?? 0,
    };
    return state;
  } catch {
    return null;
  }
};

/** 点の ならびが 16×16 の かたちか。ちがえば 空の 絵に する。 */
const fixDots = (dots: unknown): string => {
  if (typeof dots !== 'string') return blankDots();
  const cleaned = dots.replace(/[^0-9a-f.]/g, '.');
  if (cleaned.length === DOT * DOT) return cleaned;
  return (cleaned + blankDots()).slice(0, DOT * DOT);
};

export const serializePeople = (people: readonly Person[]): string =>
  JSON.stringify({ version: 1, people: [...people] } satisfies PeopleSave);

/** キャラの 保存から もどす。開けなければ null。 */
export const deserializePeople = (raw: string): Person[] | null => {
  try {
    const got = JSON.parse(raw) as Partial<PeopleSave> | null;
    if (!got || got.version !== 1 || !Array.isArray(got.people)) return null;
    return got.people.slice(0, PEOPLE_MAX).map((p, i) => ({
      id: typeof p?.id === 'string' && p.id ? p.id : `p${i}`,
      name: typeof p?.name === 'string' && p.name ? p.name.slice(0, 6) : 'なまえ',
      dots: fixDots(p?.dots),
      city: typeof p?.city === 'string' && CITIES.some((c) => c.id === p.city) ? p.city : null,
      weapon: typeof p?.weapon === 'string' ? p.weapon : null,
    }));
  } catch {
    return null;
  }
};

/** 新しい キャラの 番号。すでに いる 番号と かぶらせない。 */
export const nextPersonId = (people: readonly Person[]): string => {
  let n = people.length + 1;
  while (people.some((p) => p.id === `p${n}`)) n++;
  return `p${n}`;
};
