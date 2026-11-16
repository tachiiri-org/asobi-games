// ぶきや。
//
// どうぐは キャラが 1つずつ 持つ。まちに 置くのでは なく 人に 持たせるのは、
// 「自分で かいた 子が、自分で えらんだ どうぐで たたかう」ところを 見せたいから。
//
// どれも 合わない 事件にも 3わりは きく（events.ts の powerOf）ので、買った ものが
// むだに なることは ない。

import type { Person, Weapon } from './types';

export const WEAPONS: readonly Weapon[] = [
  { id: 'water', label: 'みずでっぽう', emoji: '🔫', cost: 120, kind: 'fire', power: 4, note: 'かじに きく' },
  { id: 'hose', label: 'しょうぼうホース', emoji: '🧯', cost: 420, kind: 'fire', power: 12, note: 'かじに とても きく' },
  { id: 'net', label: 'あみ', emoji: '🕸️', cost: 260, kind: 'thief', power: 9, note: 'どろぼうを つかまえる' },
  { id: 'whistle', label: 'よびこ', emoji: '📣', cost: 140, kind: 'thief', power: 5, note: 'みんなを よべる' },
  { id: 'sword', label: 'けん', emoji: '⚔️', cost: 340, kind: 'monster', power: 11, note: 'かいじゅうに きく' },
  { id: 'shield', label: 'たて', emoji: '🛡️', cost: 200, kind: 'storm', power: 7, note: 'あらしに きく' },
  { id: 'umbrella', label: 'じょうぶな かさ', emoji: '🌂', cost: 150, kind: 'storm', power: 5, note: 'かぜに まけない' },
  { id: 'wand', label: 'まほうの つえ', emoji: '🪄', cost: 700, kind: 'all', power: 10, note: 'どの 事件にも きく' },
  { id: 'robot', label: 'おてつだいロボ', emoji: '🤖', cost: 1200, kind: 'all', power: 18, note: 'とても つよい' },
];

export const weaponById = (id: string): Weapon | null =>
  WEAPONS.find((w) => w.id === id) ?? null;

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** もっている かず − いま だれかが 持っている かず＝あまっている かず。 */
export const sparesOf = (
  owned: Record<string, number>, people: readonly Person[], id: string,
): number => {
  const held = people.filter((p) => p.weapon === id).length;
  return (owned[id] ?? 0) - held;
};

export const buildWeaponShop = (opts: {
  readonly coins: number;
  readonly owned: Record<string, number>;
  readonly people: readonly Person[];
  readonly onBuy: (weapon: Weapon) => void;
  readonly onClose: () => void;
}): HTMLElement => {
  const wrap = el('div');
  wrap.append(
    el('div', 'mc-mtitle', '⚔️ ぶきや'),
    el('p', 'mc-note', 'どうぐは キャラが 持つ。もっていると、事件の ときの ちからが ふえる。買った どうぐは「キャラ」の ところで わたせる。'),
    el('p', 'mc-power', `もっている コイン 🪙 ${Math.floor(opts.coins)}`),
  );

  const list = el('div', 'mc-wlist');
  for (const weapon of WEAPONS) {
    const row = el('div', 'mc-wrow');
    row.append(el('span', 'mc-wmark', weapon.emoji));

    const mid = el('div', 'mc-pmid');
    mid.append(el('div', 'mc-pname', weapon.label));
    const have = opts.owned[weapon.id] ?? 0;
    const spare = sparesOf(opts.owned, opts.people, weapon.id);
    mid.append(el('div', 'mc-wnote',
      `ちから +${weapon.power}・${weapon.note}`
      + (have > 0 ? `（もっている ${have}・あまり ${spare}）` : '')));

    const buy = el('button', 'mc-btn', `🪙 ${weapon.cost}`);
    buy.disabled = opts.coins < weapon.cost;
    buy.addEventListener('click', () => opts.onBuy(weapon));

    row.append(mid, buy);
    list.appendChild(row);
  }
  wrap.appendChild(list);

  const foot = el('div', 'mc-row2');
  const close = el('button', 'mc-btn gray', 'とじる');
  close.addEventListener('click', () => opts.onClose());
  foot.append(close);
  wrap.appendChild(foot);
  return wrap;
};
