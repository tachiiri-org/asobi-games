// せかいの まち の 絵。
//
// 絵は ぜんぶ ここで canvas に 描く。外から 画像も CSS も 読まない。
// たてものは 1つずつ 描き分けず、形（shape）ごとに 1つの 描き方を 持つ——まちを
// 足すのが データ1行で 済むのは、ここを 形で まとめてあるから。
//
// キャラは 自分で かいた 16×16 の 点。毎コマ 256の 点を 置き直すと おもいので、
// 1人ぶんを 小さな canvas に 焼いて おいて、それを 貼る。

import { COLS, DOT, LAND, PALETTE, ROWS, buildingById } from './data';
import type { Building, City, Person } from './types';

export type Layout = {
  readonly skyH: number;
  readonly gridTop: number;
  readonly padX: number;
  readonly tileW: number;
  readonly tileH: number;
  readonly streetTop: number;
};

export const layoutOf = (w: number, h: number): Layout => {
  const padX = Math.round(w * 0.03) + 4;
  const skyH = Math.round(h * 0.24);
  const gridTop = skyH + 8;
  const tileH = Math.max(18, Math.round((h - gridTop - h * 0.26) / ROWS));
  return {
    skyH, gridTop, padX,
    tileW: (w - padX * 2) / COLS,
    tileH,
    streetTop: gridTop + tileH * ROWS + 6,
  };
};

/** どの マスを さわったか。ごばんの そとなら null。 */
export const tileAt = (lay: Layout, x: number, y: number): number | null => {
  const col = Math.floor((x - lay.padX) / lay.tileW);
  const row = Math.floor((y - lay.gridTop) / lay.tileH);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
  return row * COLS + col;
};

/** かいた キャラを 小さな canvas に 焼いて おく 置き場。mount ごとに 1つ 持つ。 */
export type SpriteCache = {
  readonly get: (dots: string) => HTMLCanvasElement | null;
  readonly clear: () => void;
};

export const createSpriteCache = (): SpriteCache => {
  const made = new Map<string, HTMLCanvasElement>();
  return {
    get: (dots) => {
      const hit = made.get(dots);
      if (hit) return hit;
      const cv = document.createElement('canvas');
      cv.width = DOT;
      cv.height = DOT;
      const g = cv.getContext('2d');
      if (!g) return null;
      for (let i = 0; i < DOT * DOT; i++) {
        const ch = dots[i];
        if (!ch || ch === '.') continue;
        const color = PALETTE[parseInt(ch, 16)];
        if (!color) continue;
        g.fillStyle = color;
        g.fillRect(i % DOT, Math.floor(i / DOT), 1, 1);
      }
      // 置きすぎないように、ふるい ぶんから 捨てる。かける のは 24人までなので、
      // ここまで 溜まるのは「かきなおし」を 何回も した ときだけ。
      if (made.size > 48) made.delete(made.keys().next().value as string);
      made.set(dots, cv);
      return cv;
    },
    clear: () => made.clear(),
  };
};

/** キャラを 貼る。size は 画面での よこ幅。 */
export const drawPerson = (
  g: CanvasRenderingContext2D, cache: SpriteCache, person: Person,
  cx: number, baseY: number, size: number, flip: boolean,
): void => {
  const sprite = cache.get(person.dots);
  g.save();
  g.fillStyle = 'rgba(0,0,0,.18)';
  g.beginPath();
  g.ellipse(cx, baseY, size * 0.34, size * 0.11, 0, 0, Math.PI * 2);
  g.fill();
  if (sprite) {
    g.imageSmoothingEnabled = false;
    g.translate(cx, baseY - size);
    if (flip) g.scale(-1, 1);
    g.drawImage(sprite, -size / 2, 0, size, size);
  }
  g.restore();
};

const windows = (
  g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lit: boolean,
): void => {
  const cols = Math.max(1, Math.round(w / 12));
  const rows = Math.max(1, Math.round(h / 14));
  const cw = w / (cols * 2 + 1);
  const ch = h / (rows * 2 + 1);
  g.fillStyle = lit ? '#fde68a' : '#bfdbfe';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      g.fillRect(x + cw * (c * 2 + 1), y + ch * (r * 2 + 1), cw, ch);
    }
  }
};

/**
 * たてものを 1つ 描く。(cx, baseY) が 足もと、w が よこ幅。
 *
 * たかい ものは うしろの 列に かぶる。列を おくから 手前へ 描いて いるので、
 * かぶって も 手前が 上に なる（それで まちが こんでいる ように 見える）。
 */
export const drawBuilding = (
  g: CanvasRenderingContext2D, b: Building, cx: number, baseY: number, w: number,
): void => {
  g.save();
  g.fillStyle = 'rgba(0,0,0,.16)';
  g.beginPath();
  g.ellipse(cx, baseY, w * 0.46, w * 0.11, 0, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = 'rgba(0,0,0,.35)';
  g.lineWidth = 1.5;
  let markY = baseY - w;

  if (b.shape === 'box') {
    const h = w * 0.85;
    const x = cx - w / 2;
    const y = baseY - h;
    g.fillStyle = b.body;
    g.fillRect(x, y, w, h);
    g.strokeRect(x, y, w, h);
    windows(g, x + w * 0.1, y + h * 0.12, w * 0.8, h * 0.55, false);
    g.fillStyle = b.roof;
    g.beginPath();
    g.moveTo(x - w * 0.08, y);
    g.lineTo(cx, y - w * 0.4);
    g.lineTo(x + w * 1.08, y);
    g.closePath();
    g.fill();
    g.stroke();
    markY = y - w * 0.46;
  } else if (b.shape === 'tower') {
    // たかさは よこ幅の 1.45ばい まで。これ以上 のばすと、うしろの 列が
    // ぜんぶ 隠れて、ごばんが 見えなくなる。
    const h = w * 1.45;
    const tw = w * 0.52;
    const x = cx - tw / 2;
    const y = baseY - h;
    g.fillStyle = b.body;
    g.beginPath();
    g.moveTo(x - w * 0.12, baseY);
    g.lineTo(x + tw * 0.14, y);
    g.lineTo(x + tw * 0.86, y);
    g.lineTo(x + tw + w * 0.12, baseY);
    g.closePath();
    g.fill();
    g.stroke();
    windows(g, x + tw * 0.2, y + h * 0.1, tw * 0.6, h * 0.7, true);
    g.fillStyle = b.roof;
    g.beginPath();
    g.moveTo(x + tw * 0.1, y);
    g.lineTo(cx, y - w * 0.45);
    g.lineTo(x + tw * 0.9, y);
    g.closePath();
    g.fill();
    markY = y - w * 0.5;
  } else if (b.shape === 'dome') {
    const h = w * 0.58;
    const x = cx - w / 2;
    const y = baseY - h;
    g.fillStyle = b.body;
    g.fillRect(x, y, w, h);
    g.strokeRect(x, y, w, h);
    g.fillStyle = b.roof;
    g.beginPath();
    g.ellipse(cx, y, w * 0.5, w * 0.5, 0, Math.PI, 0);
    g.fill();
    g.stroke();
    g.fillStyle = b.body;
    for (const dx of [-w * 0.42, w * 0.42]) {
      g.beginPath();
      g.ellipse(cx + dx, y + h * 0.1, w * 0.12, w * 0.3, 0, Math.PI, 0);
      g.fill();
    }
    markY = y - w * 0.56;
  } else if (b.shape === 'pyramid') {
    const h = w * 0.8;
    g.fillStyle = b.body;
    g.beginPath();
    g.moveTo(cx - w * 0.6, baseY);
    g.lineTo(cx, baseY - h);
    g.lineTo(cx + w * 0.6, baseY);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = b.roof;
    g.beginPath();
    g.moveTo(cx, baseY - h);
    g.lineTo(cx + w * 0.6, baseY);
    g.lineTo(cx + w * 0.2, baseY);
    g.closePath();
    g.fill();
    markY = baseY - h - w * 0.12;
  } else if (b.shape === 'tent') {
    const h = w * 0.7;
    g.fillStyle = b.body;
    g.beginPath();
    g.moveTo(cx - w * 0.55, baseY);
    g.lineTo(cx, baseY - h);
    g.lineTo(cx + w * 0.55, baseY);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = b.roof;
    g.beginPath();
    g.moveTo(cx - w * 0.14, baseY);
    g.lineTo(cx, baseY - h * 0.62);
    g.lineTo(cx + w * 0.14, baseY);
    g.closePath();
    g.fill();
    markY = baseY - h - w * 0.1;
  } else if (b.shape === 'flat') {
    const h = w * 0.36;
    const x = cx - w * 0.5;
    const y = baseY - h;
    g.fillStyle = b.body;
    g.fillRect(x, y, w, h);
    g.strokeRect(x, y, w, h);
    g.fillStyle = b.roof;
    g.fillRect(x, y - h * 0.3, w, h * 0.3);
    markY = y - h * 0.4;
  } else if (b.shape === 'wall') {
    const h = w * 0.55;
    const x = cx - w * 0.5;
    const y = baseY - h;
    g.fillStyle = b.body;
    g.fillRect(x, y, w, h);
    g.strokeRect(x, y, w, h);
    g.fillStyle = b.roof;
    for (let i = 0; i < 4; i++) {
      g.fillRect(x + (w / 4) * i, y - h * 0.22, w * 0.15, h * 0.22);
    }
    markY = y - h * 0.3;
  } else {
    // tree
    const h = w * 0.95;
    g.fillStyle = b.body;
    g.fillRect(cx - w * 0.07, baseY - h * 0.55, w * 0.14, h * 0.55);
    g.fillStyle = b.roof;
    g.beginPath();
    g.arc(cx, baseY - h * 0.68, w * 0.34, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    markY = baseY - h * 0.68 - w * 0.4;
  }

  if (b.mark) {
    g.font = `${Math.round(w * 0.4)}px system-ui,"Apple Color Emoji","Segoe UI Emoji",sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillText(b.mark, cx, markY);
  }
  g.restore();
};

export type CityView = {
  readonly city: City;
  readonly tiles: readonly (string | null)[];
  readonly residents: readonly Person[];
  readonly selected: number | null;
  /** うごきの もと（びょう）。歩く いちと ゆれに つかう。 */
  readonly t: number;
  /** 事件の しるし。出ている あいだ、まちの 上に 大きく 出す。 */
  readonly alarm?: string | null;
};

/** まちを 1まい 描く。 */
export const drawCity = (
  g: CanvasRenderingContext2D, w: number, h: number, cache: SpriteCache, view: CityView,
): void => {
  const lay = layoutOf(w, h);
  const { city } = view;

  const sky = g.createLinearGradient(0, 0, 0, lay.skyH + 20);
  sky.addColorStop(0, city.sky[0]);
  sky.addColorStop(1, city.sky[1]);
  g.fillStyle = sky;
  g.fillRect(0, 0, w, lay.skyH + 20);

  // おひさまと くも。くもは ゆっくり ながれる。
  g.fillStyle = 'rgba(255,255,255,.85)';
  for (let i = 0; i < 3; i++) {
    const cx = ((view.t * (6 + i * 3) + i * 180) % (w + 120)) - 60;
    const cy = 16 + i * 18;
    for (const [dx, r] of [[-14, 10], [0, 14], [15, 9]] as const) {
      g.beginPath();
      g.arc(cx + dx, cy, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.fillStyle = 'rgba(253,224,71,.95)';
  g.beginPath();
  g.arc(w - 36, 26, 16, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = city.ground;
  g.fillRect(0, lay.skyH, w, h - lay.skyH);

  // ごばん。先に ゆかを ぜんぶ 描く（あとの 列の ゆかが、前の 列の たてものを
  // 消さないように）。
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = lay.padX + c * lay.tileW;
      const y = lay.gridTop + r * lay.tileH;
      g.fillStyle = (r + c) % 2 === 0 ? city.ground2 : city.ground;
      g.fillRect(x, y, lay.tileW, lay.tileH);
      g.strokeStyle = 'rgba(0,0,0,.08)';
      g.lineWidth = 1;
      g.strokeRect(x + 0.5, y + 0.5, lay.tileW - 1, lay.tileH - 1);
    }
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = view.tiles[r * COLS + c];
      if (!id) continue;
      const b = buildingById(id);
      if (!b) continue;
      // うしろの 列ほど 小さく 描く。遠くに 見えるのと、手前に 隠れにくく なるのと、
      // ねらいは 2つ ある。
      drawBuilding(
        g, b,
        lay.padX + (c + 0.5) * lay.tileW,
        lay.gridTop + (r + 1) * lay.tileH,
        lay.tileW * (0.62 + r * 0.06),
      );
    }
  }

  // えらんだ マスの わく。たてものの あとに 描く——先に 描くと、手前の 列の
  // たてものに 隠れて、どこを えらんだのか 見えなくなる。
  if (view.selected !== null) {
    const c = view.selected % COLS;
    const r = Math.floor(view.selected / COLS);
    g.save();
    g.strokeStyle = '#f59e0b';
    g.lineWidth = 3;
    g.setLineDash([6, 4]);
    g.lineDashOffset = -view.t * 10;
    g.strokeRect(lay.padX + c * lay.tileW + 2, lay.gridTop + r * lay.tileH + 2, lay.tileW - 4, lay.tileH - 4);
    g.restore();
  }

  // どうろ。すんでいる キャラが ここを 歩く。
  const roadH = h - lay.streetTop;
  g.fillStyle = '#4b5563';
  g.fillRect(0, lay.streetTop, w, roadH);
  g.fillStyle = '#6b7280';
  g.fillRect(0, lay.streetTop, w, 3);
  g.strokeStyle = '#fde68a';
  g.lineWidth = 3;
  g.setLineDash([14, 12]);
  g.beginPath();
  g.moveTo(0, lay.streetTop + roadH * 0.52);
  g.lineTo(w, lay.streetTop + roadH * 0.52);
  g.stroke();
  g.setLineDash([]);

  const size = Math.min(40, Math.max(22, roadH * 0.42));
  view.residents.forEach((p, i) => {
    const lane = i % 2;
    const speed = 16 + (i % 5) * 5;
    const dir = lane === 0 ? 1 : -1;
    const span = w + size * 2;
    const raw = (view.t * speed + i * 97) % span;
    const x = dir === 1 ? raw - size : w + size - raw;
    const baseY = lay.streetTop + roadH * (lane === 0 ? 0.46 : 0.96) - 2;
    const bob = Math.abs(Math.sin((view.t * speed) / 9 + i)) * 3;
    drawPerson(g, cache, p, x, baseY - bob, size, dir === -1);
  });

  // 事件。まちの 上に かぶせる。赤い ふちと、ゆれる しるしで「ふつうでは ない」のを
  // ひとめで 分かるように する。
  if (view.alarm) {
    const edge = g.createLinearGradient(0, 0, 0, h);
    edge.addColorStop(0, 'rgba(220,38,38,.45)');
    edge.addColorStop(0.5, 'rgba(220,38,38,0)');
    edge.addColorStop(1, 'rgba(220,38,38,.45)');
    g.fillStyle = edge;
    g.fillRect(0, 0, w, h);
    g.save();
    g.translate(w / 2 + Math.sin(view.t * 14) * 5, lay.skyH + 14 + Math.sin(view.t * 9) * 4);
    g.font = `${Math.round(w * 0.2)}px system-ui,"Apple Color Emoji","Segoe UI Emoji",sans-serif`;
    g.textAlign = 'center';
    g.fillText(view.alarm, 0, 0);
    g.restore();
  }

  if (view.residents.length === 0) {
    g.font = `bold ${Math.round(Math.min(16, w * 0.035))}px 'Hiragino Maru Gothic ProN',system-ui,sans-serif`;
    g.textAlign = 'center';
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(0,0,0,.6)';
    g.strokeText('このまちには まだ だれも いない', w / 2, lay.streetTop + roadH * 0.34);
    g.fillStyle = '#fff';
    g.fillText('このまちには まだ だれも いない', w / 2, lay.streetTop + roadH * 0.34);
  }
};

// ── せかいちず ─────────────────────────────────────────────────────

/** 地図の わく。けいど・いどを 画面の 点に する ために つかう。 */
const mapBox = (w: number, h: number): { x: number; y: number; w: number; h: number } => {
  const mw = w - 8;
  // たてに のばす。そのままの わりあいだと 画面の 4わりしか つかわず、まちの 点が
  // かたまって、名前が かさなって 読めない。
  const mh = Math.min(h - 46, mw * (145 / 360) * 1.5);
  return { x: 4, y: 26 + (h - 34 - mh) / 2, w: mw, h: mh };
};

/** けいど・いど → 画面の 点。いどは -60〜85 だけ つかう（そこに まちが ある）。 */
export const mapPoint = (
  w: number, h: number, lon: number, lat: number,
): { x: number; y: number } => {
  const box = mapBox(w, h);
  return {
    x: box.x + ((lon + 180) / 360) * box.w,
    y: box.y + ((85 - lat) / 145) * box.h,
  };
};

export type WorldView = {
  readonly cities: readonly City[];
  readonly opened: readonly string[];
  readonly here: string;
  readonly pop: number;
  readonly t: number;
};

export const drawWorld = (
  g: CanvasRenderingContext2D, w: number, h: number, view: WorldView,
): void => {
  const sea = g.createLinearGradient(0, 0, 0, h);
  sea.addColorStop(0, '#1e3a8a');
  sea.addColorStop(1, '#0c4a6e');
  g.fillStyle = sea;
  g.fillRect(0, 0, w, h);

  g.fillStyle = '#86efac';
  g.strokeStyle = '#15803d';
  g.lineWidth = 1.5;
  for (const shape of LAND) {
    g.beginPath();
    shape.forEach(([lon, lat], i) => {
      const p = mapPoint(w, h, lon, lat);
      if (i === 0) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    });
    g.closePath();
    g.fill();
    g.stroke();
  }

  g.textAlign = 'center';
  for (const city of view.cities) {
    const p = mapPoint(w, h, city.lon, city.lat);
    const open = view.opened.includes(city.id);
    const here = city.id === view.here;
    if (here) {
      g.strokeStyle = '#fde047';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(p.x, p.y, 11 + Math.sin(view.t * 4) * 2, 0, Math.PI * 2);
      g.stroke();
    }
    g.beginPath();
    g.arc(p.x, p.y, 7, 0, Math.PI * 2);
    g.fillStyle = open ? '#ef4444' : '#64748b';
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = 2;
    g.stroke();

    g.font = `bold 11px 'Hiragino Maru Gothic ProN',system-ui,sans-serif`;
    const label = open ? city.name : `🔒 ${city.needPop}人`;
    const ty = city.labelDown ? p.y + 20 : p.y - 12;
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(0,0,0,.75)';
    g.strokeText(label, p.x, ty);
    g.fillStyle = open ? '#fff' : '#cbd5e1';
    g.fillText(label, p.x, ty);
  }

  g.font = `bold 13px 'Hiragino Maru Gothic ProN',system-ui,sans-serif`;
  g.fillStyle = '#fff';
  g.fillText(`せかいの じんこう ${view.pop}人`, w / 2, 20);
  g.font = `11px 'Hiragino Maru Gothic ProN',system-ui,sans-serif`;
  g.fillStyle = '#e0f2fe';
  g.fillText('まちを タップすると いけるよ', w / 2, h - 8);
};

/** 地図の どの まちを さわったか。どれにも 近くなければ null。 */
export const cityAt = (
  w: number, h: number, cities: readonly City[], x: number, y: number,
): City | null => {
  let best: City | null = null;
  let bestD = 20 * 20;
  for (const city of cities) {
    const p = mapPoint(w, h, city.lon, city.lat);
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = city;
    }
  }
  return best;
};
