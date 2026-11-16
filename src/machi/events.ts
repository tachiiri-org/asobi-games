// 事件と、たたかう ところ。
//
// まちが そだつだけだと、見ている あいだに なにも おきない。ときどき 事件を 出して、
// 「どうしよう」と 思う ときを つくる。
//
// かてるか どうかは さいころでは 決めない。ゲージを 止める ところで 決める——自分の
// 指で 決めた ほうが ドキドキする。ちからが あるほど 当たりの はばが ひろくなるので、
// ぶきを そろえた ぶんは ちゃんと やさしくなる。

import { PALETTE } from './data';
import type { EventKind, Person, TownEvent } from './types';
import { weaponById } from './shop';

export const EVENTS: readonly TownEvent[] = [
  {
    id: 'fire', label: 'かじだ！', emoji: '🔥', kind: 'fire', need: 14, prize: 220, damage: 150, breaks: true,
    warn: 'まちの どこかが もえている！ はやく 火を けそう。',
    win: '火を けした！ まちの みんなが ありがとうと 言っている。',
    lose: 'けせなかった…… たてものが 1つ やけてしまった。',
  },
  {
    id: 'thief', label: 'どろぼう！', emoji: '🥷', kind: 'thief', need: 12, prize: 200, damage: 180, breaks: false,
    warn: 'コインを ねらう どろぼうが きた！ つかまえよう。',
    win: 'つかまえた！ おとしていった コインを ひろった。',
    lose: 'にげられた…… コインを もっていかれた。',
  },
  {
    id: 'monster', label: 'かいじゅう あらわる！', emoji: '🦖', kind: 'monster', need: 20, prize: 320, damage: 220, breaks: true,
    warn: 'うみの むこうから かいじゅうが きた！ みんなで たたかおう。',
    win: 'かいじゅうを おいかえした！ まちは ぶじ。',
    lose: 'あばれられた…… たてものが 1つ こわれた。',
  },
  {
    id: 'storm', label: 'おおあらし！', emoji: '🌪️', kind: 'storm', need: 16, prize: 240, damage: 160, breaks: true,
    warn: 'すごい かぜが ふいてきた！ たてものを おさえよう。',
    win: 'あらしが すぎさった！ なにも こわれなかった。',
    lose: 'とばされた…… たてものが 1つ こわれた。',
  },
  {
    id: 'festival', label: 'おまつりだ！', emoji: '🎆', kind: 'good', need: 0, prize: 180, damage: 0, breaks: false,
    warn: 'まちで おまつりが はじまった！',
    win: 'みんなで おどった。おみせが よく うれて コインが ふえた。',
    lose: '',
  },
  {
    id: 'treasure', label: 'たからばこ！', emoji: '🎁', kind: 'good', need: 0, prize: 260, damage: 0, breaks: false,
    warn: 'じめんから たからばこが 出てきた！',
    win: 'あけてみたら コインが いっぱい 入っていた。',
    lose: '',
  },
];

export const eventById = (id: string): TownEvent | null =>
  EVENTS.find((e) => e.id === id) ?? null;

/** つぎの 事件を 1つ えらぶ。まちが 小さいうちは いいことが 出やすい。 */
export const pickEvent = (pop: number): TownEvent => {
  const bad = EVENTS.filter((e) => e.kind !== 'good');
  const good = EVENTS.filter((e) => e.kind === 'good');
  const badChance = Math.min(0.68, 0.25 + pop / 300);
  const pool = Math.random() < badChance ? bad : good;
  return pool[Math.floor(Math.random() * pool.length)];
};

/**
 * そのまちの ちから。
 *
 * すんでいる 人が 1人 1。それに もっている どうぐを 足す。合わない 事件にも
 * 3わりだけ きく——「かさで かじに 立ちむかう」のを だめとは しない。
 */
export const powerOf = (residents: readonly Person[], kind: EventKind): number => {
  let power = residents.length;
  for (const person of residents) {
    const weapon = person.weapon ? weaponById(person.weapon) : null;
    if (!weapon) continue;
    power += weapon.kind === kind || weapon.kind === 'all' ? weapon.power : weapon.power * 0.3;
  }
  return Math.round(power * 10) / 10;
};

/** 当たりの はば（0〜1）。ちからが need に とどけば ひろい。 */
export const zoneOf = (power: number, need: number): number => {
  if (need <= 0) return 1;
  return Math.max(0.1, Math.min(0.62, 0.1 + (power / need) * 0.34));
};

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** キャラの 顔を 小さく 出す（だれが たたかうのか 見えるように）。 */
const faceNode = (person: Person): HTMLCanvasElement => {
  const cv = el('canvas', 'mc-pface');
  cv.width = 16;
  cv.height = 16;
  const g = cv.getContext('2d');
  if (g) {
    for (let i = 0; i < 256; i++) {
      const ch = person.dots[i];
      if (!ch || ch === '.') continue;
      const color = PALETTE[parseInt(ch, 16)];
      if (!color) continue;
      g.fillStyle = color;
      g.fillRect(i % 16, Math.floor(i / 16), 1, 1);
    }
  }
  return cv;
};

export type Battle = {
  readonly node: HTMLElement;
  /** ゲージを 止める。画面を 離れる ときに 必ず 呼ぶ。 */
  readonly dispose: () => void;
};

/**
 * 事件の 画面。
 *
 * いいことなら ボタン1つ。わるいことなら、ゲージを 止めて かち負けを 決める。
 * 「にげる」も のこしてある——かてない ときに 出口が 無いと、小さい 子には つらい。
 */
export const buildBattle = (opts: {
  readonly event: TownEvent;
  readonly cityName: string;
  readonly residents: readonly Person[];
  readonly onDone: (result: 'win' | 'lose' | 'run') => void;
}): Battle => {
  const { event } = opts;
  const wrap = el('div');
  let frame = 0;
  let stopped = false;

  const big = el('div', 'mc-bigmark', event.emoji);
  wrap.append(big, el('div', 'mc-mtitle', event.label), el('p', 'mc-note', `${opts.cityName}に ${event.warn}`));

  if (event.kind === 'good') {
    const ok = el('button', 'mc-btn', 'やったー！');
    ok.addEventListener('click', () => opts.onDone('win'));
    const row = el('div', 'mc-row2');
    row.append(ok);
    wrap.appendChild(row);
    return { node: wrap, dispose: () => { /* 止める ものは 無い */ } };
  }

  const power = powerOf(opts.residents, event.kind);
  const zone = zoneOf(power, event.need);

  const team = el('div', 'mc-team');
  for (const person of opts.residents.slice(0, 8)) {
    const one = el('div', 'mc-teamone');
    one.append(faceNode(person));
    const weapon = person.weapon ? weaponById(person.weapon) : null;
    one.append(el('span', 'mc-teamw', weapon ? weapon.emoji : '🤚'));
    team.appendChild(one);
  }
  if (opts.residents.length === 0) {
    team.appendChild(el('p', 'mc-note', 'このまちには だれも いない。キャラを すませると、いっしょに たたかってくれる。'));
  }
  wrap.appendChild(team);

  wrap.appendChild(el('p', 'mc-power',
    `みんなの ちから ${power} ／ ひつような ちから ${event.need}`));

  const track = el('div', 'mc-track');
  const zoneEl = el('div', 'mc-zone');
  zoneEl.style.left = `${(0.5 - zone / 2) * 100}%`;
  zoneEl.style.width = `${zone * 100}%`;
  const marker = el('div', 'mc-marker');
  track.append(zoneEl, marker);
  wrap.appendChild(track);
  wrap.appendChild(el('p', 'mc-note', 'きいろの ところで ボタンを おすと かてる！'));

  // ゲージ。ちからが 足りないほど 速い。
  const speed = 0.55 + Math.max(0, 1 - power / Math.max(1, event.need)) * 0.5;
  let at = 0;
  let dir = 1;
  let last = performance.now();
  const step = (now: number): void => {
    if (stopped) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    at += dir * speed * dt;
    if (at > 1) { at = 1; dir = -1; }
    if (at < 0) { at = 0; dir = 1; }
    marker.style.left = `${at * 100}%`;
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);

  const stop = (): void => {
    stopped = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };

  const row = el('div', 'mc-row2');
  const go = el('button', 'mc-btn', '⚔️ いまだ！');
  go.addEventListener('click', () => {
    if (stopped) return;
    stop();
    const hit = Math.abs(at - 0.5) <= zone / 2;
    marker.classList.add(hit ? 'hit' : 'miss');
    go.disabled = true;
    run.disabled = true;
    const said = el('p', 'mc-note', hit ? event.win : event.lose);
    wrap.appendChild(said);
    const next = el('button', 'mc-btn', hit ? 'やったー！' : 'つぎは がんばる');
    next.addEventListener('click', () => opts.onDone(hit ? 'win' : 'lose'));
    row.replaceChildren(next);
  });
  const run = el('button', 'mc-btn gray', 'にげる');
  run.addEventListener('click', () => {
    stop();
    opts.onDone('run');
  });
  row.append(go, run);
  wrap.appendChild(row);

  return { node: wrap, dispose: stop };
};
