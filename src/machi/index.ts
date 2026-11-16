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
import { buildDrawEditor, buildPeopleList } from './people';
import {
  cityToOpen, deserialize, deserializePeople, incomePer10s, newState, popOfCity,
  residentsOf, serialize, serializePeople, tilesOf, worldPop,
} from './state';
import type { MachiState, Person } from './types';

const CSS = `
.mc{position:absolute;inset:0;overflow-y:auto;background:linear-gradient(#1e3a8a,#0f172a);
  color:#1f2937;-webkit-user-select:none;user-select:none;touch-action:manipulation;
  font:14px/1.6 'Hiragino Maru Gothic ProN','Arial Rounded MT Bold',system-ui,sans-serif}
.mc-app{max-width:480px;margin:0 auto;padding:10px 10px 28px;box-sizing:border-box}
.mc-panel{background:#fffdf7;border:4px solid #78350f;border-radius:18px;
  box-shadow:0 8px 0 rgba(0,0,0,.35);padding:10px;margin-bottom:10px;box-sizing:border-box}
.mc-top{display:flex;justify-content:space-between;align-items:flex-end;gap:8px;margin-bottom:8px}
.mc-city{font-weight:700;font-size:1.1rem;color:#78350f;line-height:1.2}
.mc-sub{font-size:.68rem;color:#a16207}
.mc-stats{text-align:right;font-weight:700;font-size:.8rem;color:#b45309;white-space:nowrap}
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
  font-family:inherit;color:#78350f;background:#fffdf7;box-sizing:border-box}
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
      <div class="mc-stats" data-stats>🪙 0<br>👥 0人</div>
    </div>
    <canvas class="mc-stage" data-stage></canvas>
    <div class="mc-row3">
      <button class="mc-btn blue" data-world>🗺 せかいちず</button>
      <button class="mc-btn green" data-draw>✏️ キャラをかく</button>
      <button class="mc-btn" data-people>👫 キャラ</button>
    </div>
  </div>
  <div class="mc-panel" data-shop>
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
  const shopEl = q<HTMLElement>('shop');
  const toastEl = q<HTMLElement>('toast');
  const backEl = q<HTMLElement>('back');
  const modalEl = q<HTMLElement>('modal');
  const stage = q<HTMLCanvasElement>('stage');
  const worldBtn = q<HTMLButtonElement>('world');
  const drawBtn = q<HTMLButtonElement>('draw');
  const peopleBtn = q<HTMLButtonElement>('people');

  const g2d = stage.getContext('2d');
  if (!g2d) {
    hintEl.textContent = 'この端末では canvas が つかえないため、あそべません。';
    return () => { host.replaceChildren(); };
  }
  const g: CanvasRenderingContext2D = g2d;

  let state: MachiState = newState();
  let people: Person[] = [];
  let view: 'city' | 'world' = 'city';
  let selected: number | null = null;
  let coinAcc = 0;
  let startedAt = Date.now();
  let loaded = false;
  let disposed = false;
  let frame = 0;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  const t0 = performance.now();
  const cache = createSpriteCache();

  // 画布は 置き場所の よこ幅から 取る。window から 取ると、プロダクトの 外枠の ぶん
  // だけ はみ出す。
  let cw = 320;
  let ch = 230;
  const resize = (): void => {
    const w = Math.max(240, Math.round(stage.clientWidth || host.clientWidth || 320));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = w;
    ch = Math.round(w * 0.72);
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

  const toast = (text: string): void => {
    toastEl.textContent = text;
    toastEl.style.display = 'block';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.display = 'none'; }, 2400);
  };

  const closeModal = (): void => {
    backEl.style.display = 'none';
    modalEl.replaceChildren();
  };
  const openModal = (node: HTMLElement): void => {
    modalEl.replaceChildren(node);
    backEl.style.display = 'flex';
    modalEl.scrollTop = 0;
  };

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
    statsEl.innerHTML =
      `🪙 ${Math.floor(state.coins)}<br>👥 ${worldPop(state)}人<br>`
      + `<span style="font-size:.9em;opacity:.8">10びょうに +${per10.toFixed(1)}</span>`;
  };

  const refreshHint = (): void => {
    if (view === 'world') {
      hintEl.textContent = 'いきたい まちを タップ。🔒 の まちは、せかいの じんこうが とどくと ひらく。';
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

  const refreshBuilds = (): void => {
    buildsEl.replaceChildren();
    if (view === 'world') {
      shopEl.style.display = 'none';
      return;
    }
    shopEl.style.display = '';
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
    worldBtn.classList.toggle('on', view === 'world');
  };

  const enterCity = (id: string): void => {
    state.here = id;
    view = 'city';
    selected = null;
    persist();
    const city = cityById(id);
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
      onMove: (person, cityId) => {
        person.city = cityId;
        persistPeople();
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
    if (e.target === backEl) closeModal();
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

  // ── 1びょうごと。コインが はいる。
  const tick = (): void => {
    const per10 = incomePer10s(state, people);
    if (per10 <= 0) return;
    coinAcc += per10 / 10;
    if (coinAcc >= 1) {
      const add = Math.floor(coinAcc);
      coinAcc -= add;
      state.coins += add;
      persist();
      refreshHeader();
      refreshBuilds();
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
      });
    }
    frame = requestAnimationFrame(loop);
  };

  // ── 立ち上げ
  void (async () => {
    const [mine, theirs] = await Promise.all([
      ctx.save.load(),
      ctx.save.part('people').load(),
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
    loaded = true;
    startedAt = Date.now();
    reportedPop = worldPop(state);
    state.stats.maxPop = Math.max(state.stats.maxPop, reportedPop);
    refresh();
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
    if (frame) cancelAnimationFrame(frame);
    if (tickTimer) clearInterval(tickTimer);
    if (toastTimer) clearTimeout(toastTimer);
    observer.disconnect();
    cache.clear();
    host.replaceChildren();
  };
};
