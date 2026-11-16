// キャラを かく ところと、かいた キャラの 一覧。
//
// 自分で かいた 絵が そのまま まちを 歩くので、ここが この ゲームの 半分。
// 16×16 の 点に したのは2つの ため。小さい 子の 指でも 1マスが 大きくて ぬれるし、
// 1人ぶんが 256もじで 済んで 保存に のる。
//
// 絵の 置き場（dots）は もじの ならび。'.' は すけて見える ところ、0〜f は 色の 番号。

import { DOT, NAME_SEEDS, PALETTE, dotChar } from './data';
import { blankDots } from './state';
import type { City, Person } from './types';

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** 点の ならびを canvas に 描く（下じきの ごばんも いっしょに）。 */
const paintBoard = (g: CanvasRenderingContext2D, dots: string, cell: number): void => {
  g.fillStyle = '#f8fafc';
  g.fillRect(0, 0, cell * DOT, cell * DOT);
  // すけて見える ところが 分かるように、うすい 市松を しく。
  g.fillStyle = '#e2e8f0';
  for (let y = 0; y < DOT; y++) {
    for (let x = 0; x < DOT; x++) {
      if ((x + y) % 2 === 0) g.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  for (let i = 0; i < DOT * DOT; i++) {
    const ch = dots[i];
    if (!ch || ch === '.') continue;
    const color = PALETTE[parseInt(ch, 16)];
    if (!color) continue;
    g.fillStyle = color;
    g.fillRect((i % DOT) * cell, Math.floor(i / DOT) * cell, cell, cell);
  }
  g.strokeStyle = 'rgba(0,0,0,.12)';
  g.lineWidth = 1;
  for (let i = 1; i < DOT; i++) {
    g.beginPath();
    g.moveTo(i * cell + 0.5, 0);
    g.lineTo(i * cell + 0.5, cell * DOT);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i * cell + 0.5);
    g.lineTo(cell * DOT, i * cell + 0.5);
    g.stroke();
  }
  g.strokeStyle = '#78350f';
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, cell * DOT - 3, cell * DOT - 3);
};

export type DrawEditor = {
  /** 置き場に 組み立てる。 */
  readonly node: HTMLElement;
};

/**
 * キャラを かく 画面を 組み立てる。
 *
 * できあがりは onDone に 渡すだけで、保存は 呼んだ 側が する——ここが 置き場を
 * 知らない ほうが、あとで「かきなおし」を 足したときに ふえる 道が 1つで 済む。
 */
export const buildDrawEditor = (opts: {
  readonly person: Person | null;
  readonly width: number;
  readonly onDone: (name: string, dots: string) => void;
  readonly onCancel: () => void;
}): DrawEditor => {
  const wrap = el('div');
  let dots = opts.person ? opts.person.dots : blankDots();
  let color = 2;
  let erase = false;
  let mirror = true;

  const title = el('div', 'mc-mtitle', opts.person ? 'キャラを かきなおす' : 'キャラを かく');
  const lead = el('p', 'mc-note', 'ゆびで なぞって ぬろう。かいた 子は まちを 歩くよ。');

  const cell = Math.max(12, Math.floor(Math.min(288, opts.width) / DOT));
  const canvas = el('canvas', 'mc-draw');
  canvas.width = cell * DOT;
  canvas.height = cell * DOT;
  canvas.style.width = `${cell * DOT}px`;
  canvas.style.height = `${cell * DOT}px`;
  const g = canvas.getContext('2d');

  const repaint = (): void => {
    if (g) paintBoard(g, dots, cell);
  };

  const put = (ix: number, iy: number): void => {
    if (ix < 0 || iy < 0 || ix >= DOT || iy >= DOT) return;
    const ch = erase ? '.' : dotChar(color);
    const set = (x: number): void => {
      const at = iy * DOT + x;
      dots = dots.slice(0, at) + ch + dots.slice(at + 1);
    };
    set(ix);
    if (mirror) set(DOT - 1 - ix);
    repaint();
  };

  let drawing = false;
  const atEvent = (e: PointerEvent): void => {
    const rect = canvas.getBoundingClientRect();
    put(
      Math.floor(((e.clientX - rect.left) / rect.width) * DOT),
      Math.floor(((e.clientY - rect.top) / rect.height) * DOT),
    );
  };
  canvas.addEventListener('pointerdown', (e) => {
    drawing = true;
    canvas.setPointerCapture(e.pointerId);
    atEvent(e);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drawing) atEvent(e);
  });
  canvas.addEventListener('pointerup', () => { drawing = false; });
  canvas.addEventListener('pointercancel', () => { drawing = false; });

  // ── 色
  const pal = el('div', 'mc-pal');
  const swatches: HTMLElement[] = [];
  const markPal = (): void => {
    swatches.forEach((s, i) => s.classList.toggle('on', !erase && i === color));
    eraser.classList.toggle('on', erase);
  };
  PALETTE.forEach((hex, i) => {
    const b = el('button', 'mc-sw');
    b.style.background = hex;
    b.title = `いろ ${i + 1}`;
    b.addEventListener('click', () => {
      color = i;
      erase = false;
      markPal();
    });
    pal.appendChild(b);
    swatches.push(b);
  });
  const eraser = el('button', 'mc-sw mc-er', '消');
  eraser.addEventListener('click', () => {
    erase = true;
    markPal();
  });
  pal.appendChild(eraser);

  // ── 手だすけ
  const tools = el('div', 'mc-row3');
  const mirrorBtn = el('button', 'mc-btn blue on', '🪞 さゆう おなじ');
  mirrorBtn.addEventListener('click', () => {
    mirror = !mirror;
    mirrorBtn.classList.toggle('on', mirror);
    mirrorBtn.textContent = mirror ? '🪞 さゆう おなじ' : '🪞 かたほうずつ';
  });
  const clearBtn = el('button', 'mc-btn gray', '🧽 ぜんぶ けす');
  clearBtn.addEventListener('click', () => {
    dots = blankDots();
    repaint();
  });
  const fillBtn = el('button', 'mc-btn green', '🧍 したがき');
  fillBtn.addEventListener('click', () => {
    // まっ白から 始める のは むずかしいので、からだの かたちだけ 置く。
    // 顔や 色は この上から ぬる。
    const base = blankDots().split('');
    const stamp = (x0: number, y0: number, x1: number, y1: number, ch: string): void => {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) base[y * DOT + x] = ch;
      }
    };
    stamp(5, 1, 10, 6, dotChar(14));    // あたま
    stamp(6, 7, 9, 11, dotChar(color));  // からだ（いま えらんでいる 色）
    stamp(4, 7, 5, 9, dotChar(14));     // うで
    stamp(10, 7, 11, 9, dotChar(14));
    stamp(6, 12, 7, 15, dotChar(0));    // あし
    stamp(8, 12, 9, 15, dotChar(0));
    base[4 * DOT + 6] = dotChar(0);     // め（まんなかから はなす）
    base[4 * DOT + 9] = dotChar(0);
    dots = base.join('');
    repaint();
  });
  tools.append(mirrorBtn, fillBtn, clearBtn);

  // ── なまえ
  const nameRow = el('div', 'mc-namerow');
  const nameInput = el('input', 'mc-name');
  nameInput.type = 'text';
  nameInput.maxLength = 6;
  nameInput.placeholder = 'なまえ（6もじまで）';
  nameInput.value = opts.person ? opts.person.name : '';
  const dice = el('button', 'mc-btn gray', '🎲');
  dice.addEventListener('click', () => {
    nameInput.value = NAME_SEEDS[Math.floor(Math.random() * NAME_SEEDS.length)];
  });
  nameRow.append(nameInput, dice);

  const foot = el('div', 'mc-row2');
  const ok = el('button', 'mc-btn', '✅ できた！');
  ok.addEventListener('click', () => {
    // 1つも ぬっていない ときは わたさない。白い キャラは まちで 見えない。
    if (!/[0-9a-f]/.test(dots)) {
      lead.textContent = 'まだ 白いよ。すこし ぬってから「できた！」を おしてね。';
      return;
    }
    const name = nameInput.value.trim() || NAME_SEEDS[Math.floor(Math.random() * NAME_SEEDS.length)];
    opts.onDone(name.slice(0, 6), dots);
  });
  const cancel = el('button', 'mc-btn gray', 'やめる');
  cancel.addEventListener('click', () => opts.onCancel());
  foot.append(ok, cancel);

  wrap.append(title, lead, canvas, pal, tools, nameRow, foot);
  markPal();
  repaint();
  return { node: wrap };
};

/** かいた キャラの 一覧。だれが どこに すんでいるかを ここで 変える。 */
export const buildPeopleList = (opts: {
  readonly people: readonly Person[];
  readonly cities: readonly City[];
  readonly here: string;
  readonly max: number;
  readonly onNew: () => void;
  readonly onEdit: (person: Person) => void;
  readonly onMove: (person: Person, cityId: string | null) => void;
  readonly onRemove: (person: Person) => void;
  readonly onClose: () => void;
}): HTMLElement => {
  const wrap = el('div');
  wrap.append(
    el('div', 'mc-mtitle', `👫 じぶんの キャラ（${opts.people.length}/${opts.max}）`),
    el('p', 'mc-note', 'すむ まちを えらぶと、そのまちを 歩くよ。すんでいる 人が おおい まちは、もうけも ふえる。'),
  );

  const list = el('div', 'mc-plist');
  for (const person of opts.people) {
    const row = el('div', 'mc-prow');
    const cv = el('canvas', 'mc-pface');
    cv.width = DOT;
    cv.height = DOT;
    const g = cv.getContext('2d');
    if (g) {
      g.imageSmoothingEnabled = false;
      for (let i = 0; i < DOT * DOT; i++) {
        const ch = person.dots[i];
        if (!ch || ch === '.') continue;
        const color = PALETTE[parseInt(ch, 16)];
        if (!color) continue;
        g.fillStyle = color;
        g.fillRect(i % DOT, Math.floor(i / DOT), 1, 1);
      }
    }

    const mid = el('div', 'mc-pmid');
    mid.appendChild(el('div', 'mc-pname', person.name));
    const where = el('select', 'mc-sel');
    const none = el('option', undefined, 'どこにも いない');
    none.value = '';
    where.appendChild(none);
    for (const city of opts.cities) {
      const o = el('option', undefined, city.name);
      o.value = city.id;
      where.appendChild(o);
    }
    where.value = person.city ?? '';
    where.addEventListener('change', () => opts.onMove(person, where.value || null));
    mid.appendChild(where);

    const side = el('div', 'mc-pside');
    const edit = el('button', 'mc-btn blue', '✏️');
    edit.addEventListener('click', () => opts.onEdit(person));
    const del = el('button', 'mc-btn gray', '🗑');
    del.addEventListener('click', () => opts.onRemove(person));
    side.append(edit, del);

    row.append(cv, mid, side);
    list.appendChild(row);
  }
  if (opts.people.length === 0) {
    list.appendChild(el('p', 'mc-note', 'まだ だれも いない。「キャラを かく」で 1人 かいてみよう。'));
  }
  wrap.appendChild(list);

  const foot = el('div', 'mc-row2');
  const add = el('button', 'mc-btn green', '✏️ キャラを かく');
  add.disabled = opts.people.length >= opts.max;
  add.addEventListener('click', () => opts.onNew());
  const close = el('button', 'mc-btn gray', 'とじる');
  close.addEventListener('click', () => opts.onClose());
  foot.append(add, close);
  wrap.appendChild(foot);
  return wrap;
};
