// せかいの まち。
//
// 世界中の まちを じゅんばんに ひらいて、ごばんに たてものを 建てる。すむ 人は
// 自分で かいた キャラで、かいた 絵が そのまま どうろを 歩く。
//
// 点は「せかいの じんこう」——建てた ものに すめる 人の かずの ごうけい。いちばん
// 大きかった ところで onFinish を 呼ぶ（まちは 消さない かぎり 育つので、1回の
// 走りの 終わりが 無い。ペットの「そだてた にっすう」と 同じ 考えで、のびた ときに 出す）。
//
// 決まりごとは あそびば の まま。localStorage は つかわず ctx.save に 置き、外から
// CSS を 読まず、window には 何も 置かない。後片付けの 手は 必ず 返す。

import type { GameMount } from '../types';
import {
  BREAK_BACK, CITIES, PEOPLE_MAX, buildingById, buildingsFor, cityById,
} from './data';
import {
  cityAt, createSpriteCache, drawCity, drawWorld, layoutOf, tileAt,
} from './draw';
import { buildBattle, pickEvent } from './events';
import { createMusic } from './music';
import { buildDrawEditor, buildPeopleList } from './people';
import {
  REPORTS_MAX, buildReportEditor, buildReportList, dateText, deserializeReports,
  serializeReports,
} from './report';
import { buildWeaponShop } from './shop';
import {
  addLog, cityToOpen, deserialize, deserializePeople, incomePer10s, newState, popOfCity,
  residentsOf, serialize, serializePeople, tilesOf, worldPop,
} from './state';
import type { MachiState, Person, Report, TownEvent } from './types';

const CSS = `
.mc{position:absolute;inset:0;overflow-y:auto;scrollbar-gutter:stable;background:linear-gradient(#1e3a8a,#0f172a);
  color:#1f2937;-webkit-user-select:none;user-select:none;touch-action:manipulation;
  font:14px/1.6 'Hiragino Maru Gothic ProN','Arial Rounded MT Bold',system-ui,sans-serif}
.mc-app{max-width:480px;margin:0 auto;padding:10px 10px 28px;box-sizing:border-box}
.mc-panel{background:#fffdf7;border:4px solid #78350f;border-radius:18px;
  box-shadow:0 8px 0 rgba(0,0,0,.35);padding:10px;margin-bottom:10px;box-sizing:border-box}
.mc-top{display:flex;justify-content:space-between;align-items:flex-end;gap:8px;margin-bottom:8px}
.mc-city{font-weight:700;font-size:1.1rem;color:#78350f;line-height:1.2}
.mc-sub{font-size:.68rem;color:#a16207}
.mc-stats{text-align:right;font-weight:700;font-size:.8rem;color:#b45309;white-space:nowrap}
.mc-statwrap{display:flex;align-items:flex-start;gap:6px}
.mc-sound{background:#fef3c7;border:2px solid #b45309;border-radius:999px;width:30px;height:30px;
  font-size:.9rem;line-height:1;cursor:pointer;padding:0;flex:none;font-family:inherit}
.mc-sound.off{background:#e7e5e4;border-color:#a8a29e;filter:grayscale(1);opacity:.7}
.mc-stage{display:block;width:100%;border-radius:12px;background:#bae6fd}
.mc-row2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
.mc-row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px}
.mc-btn{background:#f59e0b;color:#fff;padding:.5rem .3rem;font-size:.78rem;line-height:1.25;
  border:0;border-bottom:4px solid #b45309;border-radius:.7rem;font-weight:700;cursor:pointer;
  font-family:inherit;text-align:center;text-shadow:1px 1px 2px rgba(0,0,0,.3);transition:all .1s}
.mc-btn:active{transform:translateY(2px);border-bottom-width:2px}
.mc-btn.blue{background:#3b82f6;border-bottom-color:#1d4ed8}
.mc-btn.green{background:#10b981;border-bottom-color:#047857}
.mc-btn.gray{background:#64748b;border-bottom-color:#334155}
.mc-btn.on{box-shadow:0 0 0 3px #fde047}
.mc-btn[disabled]{opacity:.45;cursor:default}
.mc-hint{font-size:.74rem;color:#6b7280;margin:0 0 8px;line-height:1.5;min-height:2.2em}
.mc-builds{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
.mc-bcard{background:#fff;border:3px solid #78350f;border-radius:12px;padding:5px 3px;
  cursor:pointer;text-align:center;font-family:inherit;transition:all .1s}
.mc-bcard:active{transform:translateY(2px)}
.mc-bcard[disabled]{opacity:.4;cursor:default}
.mc-bcard.on{background:#fef3c7;box-shadow:0 0 0 3px #f59e0b}
.mc-bcard .nm{display:block;font-weight:700;font-size:.72rem;color:#78350f}
.mc-bcard .cost{display:block;font-size:.66rem;color:#b45309}
.mc-bcard .gain{display:block;font-size:.6rem;color:#6b7280}
.mc-toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#78350f;
  color:#fff;padding:.5rem .9rem;border-radius:999px;font-size:.78rem;font-weight:700;
  box-shadow:0 6px 16px rgba(0,0,0,.4);z-index:60;display:none;max-width:90%;text-align:center}
.mc-back{position:absolute;inset:0;background:rgba(0,0,0,.65);display:none;
  align-items:center;justify-content:center;z-index:50;padding:14px}
.mc-modal{max-height:86vh;overflow-y:auto;background:#fffdf7;border:5px solid #78350f;
  border-radius:20px;padding:14px;width:100%;max-width:400px;text-align:center;
  box-shadow:0 10px 30px rgba(0,0,0,.6);box-sizing:border-box}
.mc-mtitle{font-weight:700;font-size:1.05rem;color:#78350f;margin-bottom:4px}
.mc-note{font-size:.72rem;color:#6b7280;margin:0 0 8px;line-height:1.5}
.mc-draw{margin:0 auto 8px;display:block;touch-action:none;border-radius:8px}
.mc-pal{display:grid;grid-template-columns:repeat(9,1fr);gap:4px;margin-bottom:8px}
.mc-sw{aspect-ratio:1;border:2px solid #78350f;border-radius:6px;cursor:pointer;padding:0;
  font-family:inherit;font-size:.7rem;font-weight:700;color:#78350f}
.mc-sw.on{box-shadow:0 0 0 3px #fde047}
.mc-er{background:#fff}
.mc-namerow{display:grid;grid-template-columns:1fr auto;gap:6px;margin-bottom:8px}
.mc-name{border:3px solid #b45309;border-radius:.7rem;padding:.4rem .6rem;font-family:inherit;
  font-size:.85rem;min-width:0;box-sizing:border-box}
.mc-plist{max-height:46vh;overflow-y:auto;margin-bottom:8px}
.mc-prow{display:flex;align-items:center;gap:8px;border:3px solid #78350f;border-radius:12px;
  padding:6px;margin-bottom:6px;background:#fff}
.mc-pface{width:44px;height:44px;image-rendering:pixelated;background:#e2e8f0;border-radius:8px;flex:none}
.mc-pmid{flex:1;min-width:0;text-align:left}
.mc-pname{font-weight:700;font-size:.82rem;color:#78350f}
.mc-pside{display:flex;gap:4px;flex:none}
.mc-pside .mc-btn{padding:.35rem .5rem}
.mc-sel{width:100%;border:2px solid #b45309;border-radius:999px;padding:2px 6px;font-size:.72rem;
  font-family:inherit;color:#78350f;background:#fffdf7;box-sizing:border-box;margin-top:3px}

/* ── 事件 */
.mc-bigmark{font-size:3.2rem;line-height:1.1;animation:mc-shake .9s ease-in-out infinite}
@keyframes mc-shake{0%,100%{transform:translateX(-2px) rotate(-2deg)}50%{transform:translateX(2px) rotate(2deg)}}
@media (prefers-reduced-motion: reduce){.mc-bigmark{animation:none}}
.mc-power{font-size:.78rem;font-weight:700;color:#b45309;margin:4px 0 6px}
.mc-team{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:6px}
.mc-teamone{position:relative;width:40px;height:40px}
.mc-teamone .mc-pface{width:40px;height:40px}
.mc-teamw{position:absolute;right:-4px;bottom:-4px;font-size:.9rem}
.mc-track{position:relative;height:30px;background:#e2e8f0;border:3px solid #334155;
  border-radius:8px;overflow:hidden;margin-bottom:6px}
.mc-zone{position:absolute;top:0;bottom:0;background:#fde68a;border-left:2px dashed #f59e0b;
  border-right:2px dashed #f59e0b}
.mc-marker{position:absolute;top:-2px;width:6px;height:34px;background:#dc2626;margin-left:-3px}
.mc-marker.hit{background:#16a34a}
.mc-marker.miss{background:#475569}

/* ── ぶきや */
.mc-wlist{max-height:46vh;overflow-y:auto;margin-bottom:8px}
.mc-wrow{display:flex;align-items:center;gap:8px;border:3px solid #78350f;border-radius:12px;
  padding:6px;margin-bottom:6px;background:#fff}
.mc-wmark{font-size:1.5rem;flex:none;width:34px;text-align:center}
.mc-wnote{font-size:.68rem;color:#6b7280;line-height:1.4}
.mc-wrow .mc-btn{flex:none;padding:.4rem .6rem}

/* ── レポート */
.mc-body{width:100%;box-sizing:border-box;border:3px solid #b45309;border-radius:.7rem;
  padding:.5rem;font-family:inherit;font-size:.82rem;line-height:1.7;margin-bottom:8px;
  resize:vertical}
.mc-chips{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px}
.mc-chip{background:#fef3c7;border:2px solid #f59e0b;border-radius:999px;padding:2px 8px;
  font-size:.68rem;font-family:inherit;color:#78350f;cursor:pointer;max-width:100%;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mc-read{text-align:left;font-size:.82rem;line-height:1.8;white-space:pre-wrap;
  background:#fff;border:3px solid #78350f;border-radius:12px;padding:8px;margin-bottom:8px;
  max-height:50vh;overflow-y:auto;word-break:break-word}
.mc-loglist{text-align:left;max-height:50vh;overflow-y:auto;margin-bottom:8px}
.mc-logrow{border-bottom:1px dashed #e7e5e4;padding:5px 2px;font-size:.78rem;color:#44403c}
.mc-logrow span{display:block;font-size:.64rem;color:#a8a29e}
`;

export const mountMachi: GameMount = (host, ctx) => {
  const style = document.createElement('style');
  style.textContent = CSS;

  const wrap = document.createElement('div');
  wrap.className = 'mc';
  wrap.innerHTML = `
<div class="mc-app">
  <div class="mc-panel">
    <div class="mc-top">
      <div><div class="mc-city" data-city>とうきょう</div><div class="mc-sub" data-sub>にほん</div></div>
      <div class="mc-statwrap">
        <button class="mc-sound" data-sound type="button" aria-label="おんがく">🔊</button>
        <div class="mc-stats" data-stats>🪙 0<br>👥 0人</div>
      </div>
    </div>
    <canvas class="mc-stage" data-stage></canvas>
    <div class="mc-row3">
      <button class="mc-btn blue" data-world>🗺 せかいちず</button>
      <button class="mc-btn green" data-draw>✏️ キャラをかく</button>
      <button class="mc-btn" data-people>👫 キャラ</button>
    </div>
    <div class="mc-row3">
      <button class="mc-btn" data-shop style="background:#dc2626;border-bottom-color:#7f1d1d">⚔️ ぶきや</button>
      <button class="mc-btn" data-report style="background:#7c3aed;border-bottom-color:#5b21b6">📓 レポート</button>
      <button class="mc-btn gray" data-log>🔔 できごと</button>
    </div>
  </div>
  <div class="mc-panel" data-palette>
    <p class="mc-hint" data-hint></p>
    <div class="mc-builds" data-builds></div>
  </div>
</div>
<div class="mc-toast" data-toast></div>
<div class="mc-back" data-back><div class="mc-modal" data-modal></div></div>`;
  host.append(style, wrap);

  const q = <T extends HTMLElement>(name: string): T =>
    wrap.querySelector(`[data-${name}]`) as T;
  const cityEl = q<HTMLElement>('city');
  const subEl = q<HTMLElement>('sub');
  const statsEl = q<HTMLElement>('stats');
  const hintEl = q<HTMLElement>('hint');
  const buildsEl = q<HTMLElement>('builds');
  const paletteEl = q<HTMLElement>('palette');
  const toastEl = q<HTMLElement>('toast');
  const backEl = q<HTMLElement>('back');
  const modalEl = q<HTMLElement>('modal');
  const stage = q<HTMLCanvasElement>('stage');
  const worldBtn = q<HTMLButtonElement>('world');
  const drawBtn = q<HTMLButtonElement>('draw');
  const peopleBtn = q<HTMLButtonElement>('people');
  const shopBtn = q<HTMLButtonElement>('shop');
  const reportBtn = q<HTMLButtonElement>('report');
  const logBtn = q<HTMLButtonElement>('log');
  const soundBtn = q<HTMLButtonElement>('sound');

  const g2d = stage.getContext('2d');
  if (!g2d) {
    hintEl.textContent = 'この端末では canvas が つかえないため、あそべません。';
    return () => { host.replaceChildren(); };
  }
  const g: CanvasRenderingContext2D = g2d;

  let state: MachiState = newState();
  let people: Person[] = [];
  let reports: Report[] = [];
  let view: 'city' | 'world' = 'city';
  let selected: number | null = null;
  let coinAcc = 0;
  let startedAt = Date.now();
  let loaded = false;
  let disposed = false;
  let frame = 0;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  /** いま 出ている 事件。canvas に しるしを 出すのと、二重に 出さない ための 目じるし。 */
  let alarm: TownEvent | null = null;
  const music = createMusic();
  /** つぎの 事件の 時こく。 */
  let eventAt = 0;
  /** 画面の 中の 後片付け（ゲージを 止めるなど）。modal を 閉じる ときに 呼ぶ。 */
  let modalDispose: (() => void) | null = null;
  const t0 = performance.now();
  const cache = createSpriteCache();

  // 画布の 大きさ。
  //
  // よこは 置き場所の はばから 取る（window から 取ると、プロダクトの 外枠の ぶんだけ
  // はみ出す）。画布じたいの はばからは 取らない——中が スクロールしはじめると
  // スクロールバーの ぶんだけ はばが 変わり、それで 画布の 高さが 変わり、また
  // はばが 変わる、という 輪に なって 画面が ゆれる。
  //
  // たては よこの 0.72ばい。小さな ずれで 行ったり 来たり しないように、少ししか
  // 変わらない ときは さわらない。
  let cw = 320;
  let ch = 230;
  const resize = (): void => {
    const box = wrap.clientWidth || host.clientWidth || 320;
    const w = Math.max(240, Math.round(box - 20));
    const h = Math.round(w * 0.72);
    if (Math.abs(w - cw) < 2 && Math.abs(h - ch) < 4) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = w;
    ch = h;
    stage.width = Math.round(cw * dpr);
    stage.height = Math.round(ch * dpr);
    stage.style.height = `${ch}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const observer = new ResizeObserver(() => resize());
  observer.observe(wrap);
  resize();

  const persist = (): void => {
    if (!loaded) return;
    ctx.save.put(serialize(state));
  };
  const persistPeople = (): void => {
    if (!loaded) return;
    ctx.save.part('people').put(serializePeople(people));
  };
  const persistReports = (): void => {
    if (!loaded) return;
    ctx.save.part('reports').put(serializeReports(reports));
  };

  const toast = (text: string): void => {
    toastEl.textContent = text;
    toastEl.style.display = 'block';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.display = 'none'; }, 2400);
  };

  const closeModal = (): void => {
    music.dispose();
    document.removeEventListener('visibilitychange', onVisible);
    wrap.removeEventListener('pointerdown', onTouch);
    if (modalDispose) modalDispose();
    modalDispose = null;
    backEl.style.display = 'none';
    modalEl.replaceChildren();
  };
  const openModal = (node: HTMLElement, dispose?: () => void): void => {
    if (modalDispose) modalDispose();
    modalDispose = dispose ?? null;
    modalEl.replaceChildren(node);
    backEl.style.display = 'flex';
    modalEl.scrollTop = 0;
  };
  const modalOpen = (): boolean => backEl.style.display === 'flex';

  /**
   * 点の のびを 記録に 出す。
   *
   * 建てるたびに 出すと、1回 あそぶ あいだに 記録が 何十行も できる。のびた ことは
   * ここで 覚えて おいて、出すのは 10びょうに 1回まで。出しそびれた ぶんは、
   * 画面を 離れる ときに 出す。
   */
  const REPORT_WAIT_MS = 10000;
  let reportedPop = 0;
  let lastReport = 0;
  const reportPop = (force = false): void => {
    const pop = worldPop(state);
    if (pop > state.stats.maxPop) state.stats.maxPop = pop;
    if (state.stats.maxPop <= reportedPop) return;
    const now = Date.now();
    if (!force && now - lastReport < REPORT_WAIT_MS) return;
    lastReport = now;
    reportedPop = state.stats.maxPop;
    ctx.onFinish(reportedPop, startedAt);
  };

  const here = (): string => state.here;

  const refreshHeader = (): void => {
    const city = cityById(here());
    cityEl.textContent = view === 'world' ? 'せかいちず' : city.name;
    subEl.textContent = view === 'world'
      ? `ひらいた まち ${state.opened.length}/${CITIES.length}`
      : `${city.country} ・ このまち ${popOfCity(state, city.id)}人 ・ すんでいる ${residentsOf(people, city.id).length}人`;
    const per10 = incomePer10s(state, people);
    // 毎びょう 呼ばれる ところなので、中身が 同じなら さわらない。
    const html = `🪙 ${Math.floor(state.coins)}<br>👥 ${worldPop(state)}人<br>`
      + `<span style="font-size:.9em;opacity:.8">10びょうに +${per10.toFixed(1)}</span>`;
    if (statsEl.innerHTML !== html) statsEl.innerHTML = html;
  };

  const refreshHint = (): void => {
    if (view === 'world') {
      hintEl.textContent = 'いきたい まちを 下の ボタンか 地図の 点から えらぼう。🔒 の まちは、せかいの じんこうが とどくと ひらく。';
      return;
    }
    if (selected === null) {
      hintEl.textContent = 'ごばんを タップして、たてる ばしょを えらぼう。';
      return;
    }
    const id = tilesOf(state, here())[selected];
    if (!id) {
      hintEl.textContent = 'ばしょを えらんだ。下から たてものを えらんで 建てよう。';
      return;
    }
    const b = buildingById(id);
    hintEl.textContent = b ? `ここは「${b.label}」。${b.note}。` : '';
  };

  const breakHere = (): void => {
    if (selected === null) return;
    const tiles = tilesOf(state, here());
    const id = tiles[selected];
    if (!id) return;
    const b = buildingById(id);
    tiles[selected] = null;
    const back = Math.floor((b?.cost ?? 0) * BREAK_BACK);
    state.coins += back;
    persist();
    music.sfx('move');
    toast(`こわした。🪙${back} もどってきた`);
    refresh();
  };

  const build = (id: string): void => {
    if (selected === null) {
      toast('まず ごばんを タップして ばしょを えらんでね');
      return;
    }
    const tiles = tilesOf(state, here());
    if (tiles[selected]) {
      toast('そこには もう 建っている');
      return;
    }
    const b = buildingById(id);
    if (!b) return;
    if (state.coins < b.cost) {
      toast(`コインが たりない（あと 🪙${b.cost - Math.floor(state.coins)}）`);
      return;
    }
    state.coins -= b.cost;
    tiles[selected] = b.id;
    state.stats.built++;
    persist();
    music.sfx('build');
    toast(`${b.label} が できた！`);
    reportPop();
    checkOpen();
    refresh();
  };

  /** じんこうが とどいたら、つぎの まちを ひらく。 */
  const checkOpen = (): void => {
    const next = cityToOpen(state, worldPop(state));
    if (!next) return;
    state.opened.push(next);
    persist();
    music.sfx('win');
    const city = cityById(next);
    const node = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'mc-mtitle';
    title.textContent = '🎉 あたらしい まちが ひらいた！';
    const body = document.createElement('p');
    body.className = 'mc-note';
    body.textContent = `${city.country}の ${city.name}。${city.hello} ここにも たてものを 建てて、キャラを すませよう。`;
    const row = document.createElement('div');
    row.className = 'mc-row2';
    const go = document.createElement('button');
    go.className = 'mc-btn';
    go.textContent = `${city.name}へ いく`;
    go.addEventListener('click', () => {
      closeModal();
      enterCity(next);
    });
    const stay = document.createElement('button');
    stay.className = 'mc-btn gray';
    stay.textContent = 'あとで';
    stay.addEventListener('click', closeModal);
    row.append(go, stay);
    node.append(title, body, row);
    openModal(node);
  };

  /**
   * 下の ボタンの 列を 書きなおす。
   *
   * コインは 毎びょう ふえるので、ここも 毎びょう 呼ばれる。中身が 同じでも 作り直すと、
   * 9つの ボタンが 毎びょう 入れかわって、画面が ふるえて 見える（実さい そう 見えた）。
   * 何が ならぶかを 1本の 文字（key）に して、変わった ときだけ 作り直す。
   * 変わっていない ときは、買えるか どうかだけ 付けかえる。
   */
  let buildsKey = '';

  const refreshAfford = (): void => {
    for (const node of buildsEl.children) {
      const card = node as HTMLButtonElement;
      const cost = card.dataset.cost;
      if (cost) card.disabled = state.coins < Number(cost);
    }
  };

  const refreshBuilds = (): void => {
    paletteEl.style.display = '';
    const tilesHere = tilesOf(state, here());
    const key = view === 'world'
      ? `w|${here()}|${state.opened.join(',')}|${CITIES.map((c) => popOfCity(state, c.id)).join(',')}`
      : `c|${here()}|${selected}|${selected === null ? '' : tilesHere[selected] ?? ''}`;
    if (key === buildsKey) {
      refreshAfford();
      return;
    }
    buildsKey = key;
    buildsEl.replaceChildren();

    // 地図の ときは、まちの ボタンを ならべる。
    //
    // 地図の 点だけだと 行けない まちが ある。とうきょうと ペキンは 画面の うえで
    // 20てんほどしか はなれていないので、指が 少し ずれると となりの 国に 行く。
    // 地図は 見る ためのもの、行く ための 道は この ボタンに する。
    if (view === 'world') {
      const pop = worldPop(state);
      for (const city of CITIES) {
        const open = state.opened.includes(city.id);
        const card = document.createElement('button');
        card.className = 'mc-bcard';
        if (city.id === here()) card.classList.add('on');
        const nm = document.createElement('span');
        nm.className = 'nm';
        nm.textContent = open ? city.name : `🔒 ${city.name}`;
        const sub = document.createElement('span');
        sub.className = 'cost';
        sub.textContent = city.country;
        const gain = document.createElement('span');
        gain.className = 'gain';
        gain.textContent = open
          ? `👥 ${popOfCity(state, city.id)}人`
          : `せかいで ${city.needPop}人（あと ${Math.max(0, city.needPop - pop)}）`;
        card.append(nm, sub, gain);
        card.addEventListener('click', () => {
          if (!open) {
            toast(`${city.name}は せかいの じんこうが ${city.needPop}人に なると ひらく`);
            return;
          }
          enterCity(city.id);
        });
        buildsEl.appendChild(card);
      }
      return;
    }
    const occupied = selected !== null && tilesOf(state, here())[selected] !== null;
    if (occupied) {
      const btn = document.createElement('button');
      btn.className = 'mc-btn gray';
      btn.style.gridColumn = '1 / -1';
      btn.textContent = `🔨 ここを こわす（🪙 ${Math.floor((buildingById(tilesOf(state, here())[selected ?? 0] ?? '')?.cost ?? 0) * BREAK_BACK)} もどる）`;
      btn.addEventListener('click', breakHere);
      buildsEl.appendChild(btn);
      return;
    }
    for (const b of buildingsFor(here())) {
      const card = document.createElement('button');
      card.className = 'mc-bcard';
      card.dataset.cost = String(b.cost);
      card.disabled = state.coins < b.cost;
      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = `${b.mark ?? ''}${b.label}`;
      const cost = document.createElement('span');
      cost.className = 'cost';
      cost.textContent = `🪙 ${b.cost}`;
      const gain = document.createElement('span');
      gain.className = 'gain';
      gain.textContent = `👥+${b.pop} 🪙+${b.coin}`;
      card.append(nm, cost, gain);
      card.addEventListener('click', () => build(b.id));
      buildsEl.appendChild(card);
    }
  };

  const refresh = (): void => {
    refreshHeader();
    refreshHint();
    refreshBuilds();
    refreshSound();
    worldBtn.classList.toggle('on', view === 'world');
  };

  const enterCity = (id: string): void => {
    state.here = id;
    view = 'city';
    selected = null;
    persist();
    const city = cityById(id);
    music.sfx('move');
    toast(`${city.name}（${city.country}）・ ${city.hello}`);
    refresh();
  };

  // ── キャラ
  const openEditor = (person: Person | null): void => {
    const editor = buildDrawEditor({
      person,
      width: Math.min(300, cw - 30),
      onDone: (name, dots) => {
        if (person) {
          person.name = name;
          person.dots = dots;
        } else {
          people.push({
            id: `p${Date.now().toString(36)}`,
            name,
            dots,
            // かいた 子は、いま 見ている まちに すませる。すぐ 歩くのが 見えるように。
            city: here(),
          });
          state.stats.drawn++;
          persist();
        }
        persistPeople();
        cache.clear();
        closeModal();
        music.sfx('draw');
        toast(person ? `${name} を かきなおした` : `${name} が ${cityById(here()).name}に ひっこしてきた！`);
        refresh();
      },
      onCancel: closeModal,
    });
    openModal(editor.node);
  };

  const openPeople = (): void => {
    openModal(buildPeopleList({
      people,
      cities: CITIES.filter((c) => state.opened.includes(c.id)),
      here: here(),
      max: PEOPLE_MAX,
      onNew: () => openEditor(null),
      onEdit: (person) => openEditor(person),
      weapons: state.weapons,
      onMove: (person, cityId) => {
        person.city = cityId;
        persistPeople();
        refresh();
      },
      onGive: (person, weaponId) => {
        person.weapon = weaponId;
        persistPeople();
        openPeople();
        refresh();
      },
      onRemove: (person) => {
        people = people.filter((p) => p.id !== person.id);
        persistPeople();
        openPeople();
        refresh();
      },
      onClose: closeModal,
    }));
  };

  const openShop = (): void => {
    openModal(buildWeaponShop({
      coins: state.coins,
      owned: state.weapons,
      people,
      onBuy: (weapon) => {
        if (state.coins < weapon.cost) return;
        state.coins -= weapon.cost;
        state.weapons[weapon.id] = (state.weapons[weapon.id] ?? 0) + 1;
        // 買った ものは、この まちに すんでいて 手ぶらの 子に そのまま わたす。
        // 「買ったのに なにも 変わらない」を 作らない。
        const free = people.find((p) => p.city === here() && !p.weapon);
        if (free) {
          free.weapon = weapon.id;
          persistPeople();
        }
        addLog(state, `${weapon.emoji} ${weapon.label}を かった`);
        persist();
        music.sfx('coin');
        toast(free
          ? `${weapon.label}を ${free.name}に わたした！`
          : `${weapon.label}を かった。キャラの ところで わたせるよ`);
        openShop();
        refresh();
      },
      onClose: closeModal,
    }));
  };

  const openReportEditor = (report: Report | null, readOnly: boolean): void => {
    if (readOnly && report) {
      const node = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'mc-mtitle';
      title.textContent = report.title;
      const when = document.createElement('p');
      when.className = 'mc-power';
      when.textContent = `${dateText(report.at)}・じんこう ${report.pop}人`;
      const body = document.createElement('div');
      body.className = 'mc-read';
      body.textContent = report.body;
      const row = document.createElement('div');
      row.className = 'mc-row2';
      const edit = document.createElement('button');
      edit.className = 'mc-btn blue';
      edit.textContent = '✏️ なおす';
      edit.addEventListener('click', () => openReportEditor(report, false));
      const back = document.createElement('button');
      back.className = 'mc-btn gray';
      back.textContent = 'もどる';
      back.addEventListener('click', openReports);
      row.append(edit, back);
      node.append(title, when, body, row);
      openModal(node);
      return;
    }
    openModal(buildReportEditor({
      report,
      cityName: cityById(here()).name,
      pop: worldPop(state),
      coins: state.coins,
      log: state.log,
      onSave: (title, body) => {
        if (report) {
          report.title = title;
          report.body = body;
          report.at = Date.now();
          report.pop = worldPop(state);
        } else {
          reports.unshift({
            id: `r${Date.now().toString(36)}`,
            title, body, at: Date.now(), pop: worldPop(state),
          });
          if (reports.length > REPORTS_MAX) reports.length = REPORTS_MAX;
        }
        persistReports();
        music.sfx('draw');
        toast('レポートを のこした！');
        openReports();
      },
      onCancel: openReports,
    }));
  };

  function openReports(): void {
    openModal(buildReportList({
      reports,
      onNew: () => openReportEditor(null, false),
      onOpen: (report) => openReportEditor(report, true),
      onRemove: (report) => {
        reports = reports.filter((r) => r.id !== report.id);
        persistReports();
        openReports();
      },
      onClose: closeModal,
    }));
  }

  const openLog = (): void => {
    const node = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'mc-mtitle';
    title.textContent = '🔔 できごと';
    const note = document.createElement('p');
    note.className = 'mc-note';
    note.textContent = `かった ${state.stats.won}かい ・ まけた ${state.stats.lost}かい`;
    const list = document.createElement('div');
    list.className = 'mc-loglist';
    for (const entry of state.log) {
      const row = document.createElement('div');
      row.className = 'mc-logrow';
      row.textContent = entry.text;
      const when = document.createElement('span');
      when.textContent = dateText(entry.at);
      row.appendChild(when);
      list.appendChild(row);
    }
    if (state.log.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'mc-note';
      empty.textContent = 'まだ なにも おきていない。';
      list.appendChild(empty);
    }
    const row = document.createElement('div');
    row.className = 'mc-row2';
    const write = document.createElement('button');
    write.className = 'mc-btn';
    write.textContent = '📓 レポートに かく';
    write.addEventListener('click', () => openReportEditor(null, false));
    const close = document.createElement('button');
    close.className = 'mc-btn gray';
    close.textContent = 'とじる';
    close.addEventListener('click', closeModal);
    row.append(write, close);
    node.append(title, note, list, row);
    openModal(node);
  };

  // ── おんがく
  //
  // 鳴らすのは 指で さわった あと。ブラウザが そう 決めているので、立ち上げで
  // 鳴らそうとしても 鳴らない。はじめて さわった ときに そっと 始める。
  const refreshSound = (): void => {
    soundBtn.textContent = state.music ? '🔊' : '🔇';
    soundBtn.classList.toggle('off', !state.music);
    soundBtn.title = state.music ? '音を けす' : '音を つける';
  };

  // さわる たびに 呼ぶ。1回目で 鳴らしはじめ、2回目からは 止まって いたら 起こす
  // （iPhone は 画面を 離れると 音を 止める）。
  const onTouch = (): void => {
    if (!state.music || !loaded) return;
    if (music.isOn()) music.wake();
    else music.setOn(true);
  };
  wrap.addEventListener('pointerdown', onTouch);

  soundBtn.addEventListener('click', () => {
    state.music = !state.music;
    music.setOn(state.music);
    persist();
    refreshSound();
    if (!state.music) {
      toast('🔇 音を けした');
      return;
    }
    music.sfx('coin');
    toast('🔊 音を つけた');
    // つけたのに 音の 箱が 動かない ときは、端末の ほうで 止まっている。
    // iPhone の よこの スイッチ（マナーモード）が いちばん 多い。
    setTimeout(() => {
      if (disposed || !state.music) return;
      if (!music.running()) {
        toast('音が 出ない ときは、マナーモードと おとの 大きさを たしかめてね');
      }
    }, 600);
  });

  // 画面を 見ていない あいだは 鳴らさない。タブを うらに したまま 鳴りつづけると、
  // どこから 音が 出ているのか 分からなくなる。
  const onVisible = (): void => {
    if (document.hidden) music.setOn(false);
    else if (state.music && loaded) music.setOn(true);
  };
  document.addEventListener('visibilitychange', onVisible);

  shopBtn.addEventListener('click', openShop);
  reportBtn.addEventListener('click', openReports);
  logBtn.addEventListener('click', openLog);

  worldBtn.addEventListener('click', () => {
    view = view === 'world' ? 'city' : 'world';
    selected = null;
    refresh();
  });
  drawBtn.addEventListener('click', () => {
    if (people.length >= PEOPLE_MAX) {
      toast(`キャラは ${PEOPLE_MAX}人までだよ`);
      return;
    }
    openEditor(null);
  });
  peopleBtn.addEventListener('click', openPeople);
  backEl.addEventListener('click', (e) => {
    // 事件の あいだは、そとを さわって 閉じられないように する。閉じられると
    // 事件が 出たままで 止まり、つぎの 事件も こなくなる。
    if (e.target === backEl && !alarm) closeModal();
  });

  stage.addEventListener('click', (e) => {
    const rect = stage.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * cw;
    const y = ((e.clientY - rect.top) / rect.height) * ch;
    if (view === 'world') {
      const city = cityAt(cw, ch, CITIES, x, y);
      if (!city) return;
      if (!state.opened.includes(city.id)) {
        toast(`${city.name}は せかいの じんこうが ${city.needPop}人に なると ひらく`);
        return;
      }
      enterCity(city.id);
      return;
    }
    const at = tileAt(layoutOf(cw, ch), x, y);
    selected = at === selected ? null : at;
    refresh();
  });

  // ── 事件
  //
  // ときどき 事件が おきる。ただし「見ていない ところ」では おこさない——地図を
  // 見ている あいだや、べつの 画面を 開けている あいだに 進むと、もどったら コインが
  // 減っていた、という 形に なる。そのときは 少し 先に のばす。
  const EVENT_FIRST_MS = 40000;
  const EVENT_MIN_MS = 45000;
  const EVENT_SPAN_MS = 45000;

  const scheduleEvent = (first = false): void => {
    eventAt = Date.now() + (first ? EVENT_FIRST_MS : EVENT_MIN_MS + Math.random() * EVENT_SPAN_MS);
  };

  /** まちの たてものを 1つ こわす。まけた ときの そんがい。 */
  const breakOne = (cityId: string): string | null => {
    const tiles = tilesOf(state, cityId);
    const at = tiles
      .map((id, i) => (id ? i : -1))
      .filter((i) => i >= 0);
    if (at.length === 0) return null;
    const pick = at[Math.floor(Math.random() * at.length)];
    const label = buildingById(tiles[pick] ?? '')?.label ?? null;
    tiles[pick] = null;
    return label;
  };

  const finishEvent = (event: TownEvent, result: 'win' | 'lose' | 'run'): void => {
    const cityId = here();
    alarm = null;
    scheduleEvent();

    if (result === 'win') {
      state.coins += event.prize;
      if (event.kind !== 'good') state.stats.won++;
      addLog(state, event.kind === 'good'
        ? `${event.emoji} ${event.label}（🪙+${event.prize}）`
        : `${event.emoji} ${event.label} に かった！（🪙+${event.prize}）`);
      music.sfx('win');
      toast(`🪙+${event.prize}！`);
    } else if (result === 'lose') {
      state.stats.lost++;
      const lost = Math.min(Math.floor(state.coins), event.damage);
      state.coins -= lost;
      const broke = event.breaks ? breakOne(cityId) : null;
      addLog(state, `${event.emoji} ${event.label} に まけた……（🪙-${lost}`
        + (broke ? `・${broke}が こわれた）` : '）'));
      music.sfx('lose');
      toast(broke ? `${broke}が こわれた……` : `🪙-${lost}……`);
    } else {
      const lost = Math.min(Math.floor(state.coins), Math.floor(event.damage * 0.3));
      state.coins -= lost;
      addLog(state, `${event.emoji} ${event.label} から にげた（🪙-${lost}）`);
      music.sfx('move');
      toast('にげた！');
    }

    persist();
    closeModal();
    reportPop();
    refresh();
  };

  const startEvent = (): void => {
    const city = cityById(here());
    const event = pickEvent(worldPop(state));
    alarm = event;
    music.sfx('alarm');
    const battle = buildBattle({
      event,
      cityName: city.name,
      residents: residentsOf(people, city.id),
      onDone: (result) => finishEvent(event, result),
    });
    openModal(battle.node, battle.dispose);
  };

  // ── 1びょうごと。コインが はいり、ときどき 事件が おきる。
  const tick = (): void => {
    if (loaded && Date.now() >= eventAt) {
      const busy = alarm !== null || modalOpen() || view !== 'city';
      const empty = popOfCity(state, here()) === 0 && residentsOf(people, here()).length === 0;
      if (busy || empty) eventAt = Date.now() + 15000;
      else startEvent();
    }

    const per10 = incomePer10s(state, people);
    if (per10 <= 0) return;
    coinAcc += per10 / 10;
    if (coinAcc >= 1) {
      const add = Math.floor(coinAcc);
      coinAcc -= add;
      state.coins += add;
      persist();
      refreshHeader();
      refreshAfford();
    }
  };

  const loop = (): void => {
    if (disposed) return;
    const t = (performance.now() - t0) / 1000;
    if (view === 'world') {
      drawWorld(g, cw, ch, {
        cities: CITIES, opened: state.opened, here: here(), pop: worldPop(state), t,
      });
    } else {
      const city = cityById(here());
      drawCity(g, cw, ch, cache, {
        city,
        tiles: tilesOf(state, city.id),
        residents: residentsOf(people, city.id),
        selected,
        t,
        alarm: alarm ? alarm.emoji : null,
      });
    }
    frame = requestAnimationFrame(loop);
  };

  // ── 立ち上げ
  void (async () => {
    const [mine, theirs, written] = await Promise.all([
      ctx.save.load(),
      ctx.save.part('people').load(),
      ctx.save.part('reports').load(),
    ]);
    if (disposed) return;
    if (mine.ok && mine.state) {
      const got = deserialize(mine.state);
      if (got) state = got;
      else ctx.setStatus('つづきからの データを 読めなかったので、新しく はじめます');
    }
    if (theirs.ok && theirs.state) {
      const got = deserializePeople(theirs.state);
      if (got) people = got;
    }
    if (written.ok && written.state) {
      const got = deserializeReports(written.state);
      if (got) reports = got;
    }
    loaded = true;
    scheduleEvent(true);
    startedAt = Date.now();
    reportedPop = worldPop(state);
    state.stats.maxPop = Math.max(state.stats.maxPop, reportedPop);
    refresh();
    // ブラウザは さわるまで 音を 出さない。黙って いると「音が 出ない」に 見えるので、
    // 1回だけ 知らせる。
    if (state.music) {
      setTimeout(() => {
        if (!disposed && state.music && !music.running()) {
          toast('🔊 画面を さわると 音が 鳴るよ');
        }
      }, 1200);
    }
    if (state.stats.built === 0 && people.length === 0) {
      hintEl.textContent = 'まずは いえを 建てて、つぎに「キャラをかく」で すむ 子を かこう。';
    }
  })();

  refresh();
  loop();
  tickTimer = setInterval(tick, 1000);

  return () => {
    // 出しそびれた のびを ここで 出す。建てた ところで 画面を 離れても、
    // いちばん 大きかった ところが 記録に のこる。
    if (loaded) reportPop(true);
    disposed = true;
    music.dispose();
    document.removeEventListener('visibilitychange', onVisible);
    wrap.removeEventListener('pointerdown', onTouch);
    if (modalDispose) modalDispose();
    modalDispose = null;
    if (frame) cancelAnimationFrame(frame);
    if (tickTimer) clearInterval(tickTimer);
    if (toastTimer) clearTimeout(toastTimer);
    observer.disconnect();
    cache.clear();
    host.replaceChildren();
  };
};
