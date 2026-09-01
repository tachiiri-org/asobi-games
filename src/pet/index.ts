// ペット（もふもふペット育成記）。tennis-game リポジトリの pet.html を移した。
//
// 遊びの中身は変えていない。ここは元の1枚のスクリプトを、そのまま閉じた形（mount の中）に
// 収めたもの。元は state をはじめ多くの値を共有する273個の関数が自由に触り合う作りで、
// 引数で渡し回す形に組み替えると、触り合う先を1つ間違えただけで遊びが変わる。読み替えを
// 増やさないため、共有の仕方は元のまま閉じ込めてある。
//
// 変えたのは5つ。
//  - 表（ショップの品・ごはん・できること…）は別のファイルに出した。中身は原文のまま。
//  - 保存先を localStorage からテナントの置き場へ移した。本体ともちものを別の部分に置く
//    （毎秒の保存で、もちものを丸ごと送り直さないため）。
//  - 画布と要素の探し先を、ページ全体ではなく置き場所の中に閉じた。
//  - Tailwind の CDN をやめ、当てていたクラスを CSS にした。
//  - 組み立てた HTML の中の onclick は、そのままの形で残し、mount のあいだだけ立てる
//    名前空間ごしに呼ぶ。108箇所をひとつずつリスナに組み替える方が、書き写しの間違いが
//    入りやすい。名前空間は後片付けで消す。

import { big, bmax, bmin, coinText } from './coins';
import {
  ACTIVITIES, ACT_EMOJI, CHAT_CHIPS, DAY_SEC, DECOR_MAX, DECOR_ZONE, FOODS, FOOD_ALIAS,
  FRIEND_X, FU_KIND, HOME_VIEW, INF_FX, JOBS, MEDICINE_COST, OFFLINE_CAP, ORDERS, ORDER_CHIPS,
  OUTDOOR, OUT_NAME, PLACES, PLACE_X, ROOM_LABEL, ROOM_NAME, SHOP_CAT, SPECIES, TALK_MENU, TONE,
} from './data';
import { FRIENDS } from './friends-data';
import {
  FES_TOTAL_TEXT, FURN_PER, FURN_TOTAL, INF_PER, INF_TOTAL, MORE_BLD, MORE_FLOORS,
  MORE_PER, MORE_TOTAL_TEXT, SWEET_TOTAL, SW_PER,
} from './more-data';
import {
  furnCost, furnEmoji, furnName, infCost, infEmoji, infFx, infName,
  moAdd, moDigit, moDiv, moKeyDigits, moMod, moNumText, moSub,
  moreCost, moreEmoji, moreKey, moreLast, moreMaxText, moreName, moreShortT, moreText, moreTotal,
  sweetCost, sweetEmoji, sweetExp, sweetHappy, sweetHunger, sweetName,
} from './naming';
import { SHOP, STYLE_COLORS, WEAR_COLOR } from './shop-data';
import { clamp, deserialize, expNeeded, newState, nowSec as now, type PetState } from './state';
import type { Activity, DecorZone, Food, Friend, Job, MoreShop, Species } from './types';
import { PET_CSS, buildPetMarkup } from './shell';
import type { GameMount } from '../types';

/** 組み立てた HTML の中から呼ぶ口。mount のあいだだけ window に立てる。 */
type PetApi = Record<string, (...args: never[]) => unknown>;

/** おしゃべりの相手。ともだち・ロボット・ペット本人のどれか。 */
type ChatSpeaker = {
  readonly id: string;
  readonly name: string;
  readonly tone: { readonly tail: string; readonly emo: string; readonly end?: string };
  readonly kind: string;
  readonly likes: string;
  readonly f?: Friend;
};

/** 本体と分けて置くもの。買った時にしか変わらないので、毎秒の保存には乗せない。 */
const COLLECTION_KEYS: readonly string[] = [
  'owned', 'worn', 'theme', 'inf', 'infAll', 'furn', 'furnAll', 'more', 'moreAll',
];

const withBig = (v: unknown): string =>
  JSON.stringify(v, (_k, x: unknown) => (typeof x === 'bigint' ? `${x.toString()}n` : x));

export const mountPet: GameMount = (host, game) => {
  const style = document.createElement('style');
  style.textContent = PET_CSS;
  const root = buildPetMarkup();
  host.append(style, root);

  const el = (id: string): HTMLElement => root.querySelector(`#${id}`) as HTMLElement;

  let state: PetState = newState();
  let particles: { type: string; x: number; y: number; vx: number; vy: number; life: number }[] = [];
  let action: { type: string | null; until: number; dur: number; food: string | null } =
    { type: null, until: 0, dur: 1, food: null };
  const mini = { active: false, pos: 0, dir: 1, speed: 0.8 };
  let lastFrame = 0;
  let saveTimer = 0;
  let petPos = 0.5;          // ペットの立ち位置（キャンバス幅にたいする割合）
  let petHidden = false;     // そとから見て おうちの中に いるか
  let inBed = false;         // へやの ベッドで ねているか

  const canvas = el('stage') as HTMLCanvasElement;
  const context = canvas.getContext('2d');
  if (!context) {
    root.textContent = 'この端末では canvas が使えないため、遊べません。';
    return () => { host.replaceChildren(); };
  }
  // 元の描画コードは 2D コンテキストを ctx と呼んでいる。4,600行ある描画の側に名前を譲る。
  const ctx: CanvasRenderingContext2D = context;

  let animationId = 0;
  let disposed = false;

  // ── 続きから ──────────────────────────────────────────────────────
  //
  // 本体（毎秒動く）ともちもの（買った時だけ）を別の部分に置く。1つにすると、
  // 毎秒の保存のたびに、買ったものを丸ごと送り直すことになる。
  const mainPart = game.save;
  const collPart = game.save.part('collection');
  let lastColl = '';

  function save(): void {
    state.lastTick = now();
    const main: Record<string, unknown> = {};
    const coll: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(state)) {
      if (COLLECTION_KEYS.includes(k)) coll[k] = v; else main[k] = v;
    }
    const collText = withBig(coll);
    // 中身が変わっていなければ出さない。買っていない間、重い側は動かない。
    if (collText !== lastColl) {
      lastColl = collText;
      collPart.put(collText);
    }
    mainPart.put(withBig(main));
  }

  /**
   * 置いてある続きからを読む。
   *
   * 片方でも読めなかったら null ではなく「読めなかった」として扱い、新規で始めない。
   * 新規で始めると、次の保存が育てた分を空で上書きする。
   * まだ分けていなかった頃の保存は、本体の側に全部入っている。合わせれば開ける。
   */
  async function loadSaved(): Promise<{ ok: boolean; state: PetState | null }> {
    const [m, c] = await Promise.all([mainPart.load(), collPart.load()]);
    if (!m.ok || !c.ok) return { ok: false, state: null };
    if (!m.state && !c.state) return { ok: true, state: null };
    const merged = {
      ...(m.state ? (JSON.parse(m.state) as Record<string, unknown>) : {}),
      ...(c.state ? (JSON.parse(c.state) as Record<string, unknown>) : {}),
    };
    if (c.state) lastColl = c.state;
    return { ok: true, state: deserialize(JSON.stringify(merged), moreKey) };
  }






  // おかねは BigInt で もつので じょうげんが ない（なんけたでも OK）

  function addCoins(n: number | bigint) {
      const v = big(n);
      state.coins = big(state.coins) + v;
      if (state.stats) state.stats.earned = big(state.stats.earned) + v;
  }

  // おおきな かずの よびかた（万 → 無量大数 まで）

  // おおきな かずは よみやすい かたちに する

  // かった ものが あると できる こと
  // e:げんきを つかう / hu:おなかが へる / h:きげん / x:けいけんち /
  // c:コイン / eg:げんきが ふえる / hg:おなかが ふえる / cl:きれいが へる

  // かわなくても できる あそびが あるので まとめて はんてい
  function actOk(a: Activity) { return !!a.free || (a.item !== undefined && has(a.item)); }


  // おしごと: ちからと レベルが たかいほど おだちんが ふえる

  function jobPay(j: Job) {
      const raw = j.flat ? big(j.flat) : big(j.base + state.power * j.perPower + state.level * j.perLevel);
      let pay = has('bank') ? raw * 12n / 10n : raw;
      if (has('suit')) pay = pay * 115n / 100n;        // おしごとスーツ
      if (has('wallet')) pay = pay * 110n / 100n;      // おさいふ
      if (has('piggy2')) pay = pay * 115n / 100n;      // おおきな ちょきんばこ
      if (has('luckycoin')) pay = pay * 120n / 100n;   // ラッキーコイン
      return pay;
  }

  // おさらが あると ごはんが すこし やすくなる
  function foodCost(f: Food) {
      let c = f.cost;
      if (has('dish')) c *= 0.8;
      if (has('coupon')) c *= 0.9;
      if (has('bento2')) c *= 0.9;
      if (has('lunchbag')) c *= 0.92;
      return Math.max(1, Math.round(c));
  }


  // もようがえ: スロットごとに 1つ えらぶ

  function styleSlot(id: string) { return id.split('_')[0]; }

  // はってある もの（1めんに なんまいでも）
  function styleList(slot: string) {
      const v = state.theme && state.theme[slot];
      if (!v) return [];
      return Array.isArray(v) ? v.slice() : [v];
  }

  function styleUsed(id: string) { return styleList(styleSlot(id)).indexOf(id) >= 0; }

  // はってある まいすうぶんの いろ（なければ もとの いろ）
  function styleColors(slot: string, night: boolean, defDay: string, defNight: string) {
      const ids = styleList(slot).filter(function (id) { return STYLE_COLORS[id]; });
      if (!ids.length) return [night ? defNight : defDay];
      return ids.map(function (id) { return night ? STYLE_COLORS[id].night : STYLE_COLORS[id].day; });
  }

  // よこに ならべて はる
  function paintBands(x: number, y: number, w: number, h: number, cols: readonly string[]) {
      const n = cols.length;
      for (let i = 0; i < n; i++) {
          ctx.fillStyle = cols[i];
          ctx.fillRect(x + w * i / n, y, w / n + 0.7, h);
      }
  }

  // ぜんぶで 1まんこに なるまで、いろちがい・そざいちがいを じどうで つくる
  (function fillShop() {
      const MAT  = ['木の', 'てつの', 'ガラスの', 'ふわふわの', 'きらきらの', 'たけの', 'いしの', 'ぬのの', 'とうめいな', 'きんの'];
      const COL  = ['あかい', 'あおい', 'きいろい', 'みどりの', 'しろい', 'くろい', 'ピンクの', 'むらさきの', 'オレンジの', 'みずいろの'];
      const SIZE = ['ミニ', '', 'おおきな', 'とくだいの', 'ちいさな'];
      const KIND = [
          { n: 'イス', e: '🪑', c: 'friend' },      { n: 'テーブル', e: '🍽', c: 'friend' },
          { n: 'ベッド', e: '🛏', c: 'friend' },    { n: 'クッション', e: '🛋', c: 'friend' },
          { n: 'ランプ', e: '💡', c: 'room' },      { n: 'とけい', e: '⏰', c: 'room' },
          { n: 'かびん', e: '🏺', c: 'room' },      { n: 'えほん', e: '📕', c: 'room' },
          { n: 'ぬいぐるみ', e: '🧸', c: 'bedroom' }, { n: 'オルゴール', e: '🎵', c: 'bedroom' },
          { n: 'まくら', e: '🛌', c: 'bedroom' },   { n: 'ライト', e: '🔦', c: 'bedroom' },
          { n: 'コップ', e: '🥤', c: 'kitchen' },   { n: 'おさら', e: '🍽', c: 'kitchen' },
          { n: 'なべ', e: '🍲', c: 'kitchen' },     { n: 'びん', e: '🫙', c: 'kitchen' },
          { n: 'はちうえ', e: '🪴', c: 'yard' },    { n: 'おきもの', e: '🗿', c: 'yard' },
          { n: 'ふうせん', e: '🎈', c: 'yard' },    { n: 'ふうりん', e: '🎐', c: 'yard' }
      ];
      let k = 0;
      while (SHOP.length < 10000 && k < MAT.length * COL.length * SIZE.length * KIND.length) {
          const kind = KIND[k % KIND.length];
          const col  = COL[Math.floor(k / KIND.length) % COL.length];
          const mat  = MAT[Math.floor(k / (KIND.length * COL.length)) % MAT.length];
          const size = SIZE[Math.floor(k / (KIND.length * COL.length * MAT.length)) % SIZE.length];
          SHOP.push({
              id: 'gf' + k,
              cat: kind.c,
              label: `${kind.e} ${size}${mat}${col}${kind.n}`,
              cost: 60 + (k % 940),
              note: 'おうちに かざる／きげんが へりにくい',
              deco: kind.e
          });
          k++;
      }
  })();



  const HOUSE_X = 0.80;      // おうちの中心
  const DOOR_X = 0.775;      // げんかんの位置
  const BED_X = 0.72;        // ベッドの位置
  const IN_X = 0.40;         // へやでの ふだんの 立ち位置

  /* ---------------- utility ---------------- */

  const now = () => Date.now() / 1000;


  // ショップで かったか どうか
  function has(id: string) { return !!(state.owned && state.owned[id]); }

  // いま みにつけているか
  function isWorn(id: string) { return !!(state.worn && state.worn[id]); }

  // おなじ もので いろちがいの もの

  function wornVariant(ids: string[]) {
      for (let i = 0; i < ids.length; i++) if (isWorn(ids[i])) return ids[i];
      return null;
  }

  function currentSpecies() {
      if (state.stage === 'baby') return SPECIES.baby;
      if (state.stage === 'child') return SPECIES.child;
      if (state.stage === 'adult') return SPECIES[state.species ?? ''] || SPECIES.cheer;
      return SPECIES.baby;
  }

  function petScale() {
      if (state.stage === 'baby') return 0.62;
      if (state.stage === 'child') return 0.85;
      if (state.stage === 'adult') return 1.1;
      return 1;
  }

  function addLog(text: string) {
      state.log.unshift(text);
      if (state.log.length > 5) state.log.length = 5;
      renderLog();
  }

  function renderLog() {
      el('log').innerHTML = state.log
          .map((m, i) => `<div style="opacity:${1 - i * 0.18}">${m}</div>`)
          .join('');
  }

  function burst(type: string, count: number) {
      for (let i = 0; i < count; i++) {
          particles.push({
              x: canvas.width / 2 + (Math.random() - 0.5) * 90,
              y: canvas.height * 0.62 - Math.random() * 40,
              vx: (Math.random() - 0.5) * 30,
              vy: -30 - Math.random() * 40,
              life: 1.2,
              type: type
          });
      }
  }

  function setAction(type: string, sec: number, food?: string | null) {
      action.type = type;
      action.until = now() + sec;
      action.dur = sec;
      action.food = food || null;
  }

  // アクションの しんこう度（0→1）
  function actionProgress() {
      if (!action.type) return 1;
      return clamp(1 - (action.until - now()) / action.dur, 0, 1);
  }

  /* ---------------- state ---------------- */




  // 「123n」の かたちを かずに もどす


  /* ---------------- time progression ---------------- */

  function applyTime(dt: number) {
      state.ageSec += dt;

      if (state.stage === 'egg') return;

      const m = dt / 60;

      if (state.sleeping) {
          state.energy = clamp(state.energy + (has('curtain') ? 20 : 16) * (has('tent') ? 1.25 : 1)
              * (has('pillow') ? 1.2 : 1) * (has('nightlamp') ? 1.1 : 1) * (has('cushion2') ? 1.1 : 1)
              * (has('sleepmask') ? 1.1 : 1) * (has('cocoa5') ? 1.1 : 1) * m, 0, 100);
          state.hunger = clamp(state.hunger - 2 * m, 0, 100);
          state.happy = clamp(state.happy - 0.5 * m, 0, 100);
          if (state.energy >= 100) {
              state.sleeping = false;
              addLog(`${state.name} は ぐっすり ねて めをさました！`);
          }
      } else {
          // ショップで かったものは へる はやさを ゆるめる
          const happyRate = 2.5 * (has('doll') ? 0.85 : 1) * (has('flower') ? 0.9 : 1) * (has('guitar') ? 0.9 : 1)
              * (has('sunflower') ? 0.92 : 1) * (has('piano') ? 0.92 : 1) * (has('tower') ? 0.9 : 1)
              * (has('aroma') ? 0.9 : 1) * (has('incense') ? 0.92 : 1) * (has('relax') ? 0.93 : 1)
              * Math.max(0.7, Math.pow(0.94, roomieCount()))    // いっしょに すむ ともだちが いると さみしくない
              * Math.max(0.6, Math.pow(0.995, decorCount()))    // かざりが あると きげんが へりにくい
              * (has('yogamat2') ? 0.95 : 1) * (has('perfume') ? 0.95 : 1) * infMul('happy');
          const energyRate = 1.6 * (has('tree') ? 0.85 : 1) * (has('aircon') ? 0.85 : 1) * (has('warmsocks') ? 0.92 : 1)
              * (has('heater') ? 0.9 : 1) * (has('drink') ? 0.93 : 1) * (has('runshoes') ? 0.93 : 1)
              * (has('carpet2') ? 0.94 : 1) * (has('sunhat') ? 0.95 : 1) * infMul('energy');
          // トイレが あれば うんちで よごれにくい
          const dirtPerPoop = has('toilet') ? 1 : 3;
          const cleanRate = (2 + state.poops.length * dirtPerPoop) * (has('plant') ? 0.85 : 1)
              * (isWorn('boots') || isWorn('boots_blue') ? 0.9 : 1) * (has('brush') ? 0.9 : 1)
              * (has('robot') ? 0.85 : 1) * (has('mop') ? 0.9 : 1) * (has('humid') ? 0.93 : 1)
              * (has('slipper') ? 0.93 : 1) * (has('shampoo') ? 0.93 : 1) * (has('duster') ? 0.94 : 1) * (has('humid2') ? 0.94 : 1)
              * infMul('clean');
          state.hunger = clamp(state.hunger - 3.2 * infMul('hunger') * m, 0, 100);
          state.happy = clamp(state.happy - happyRate * m, 0, 100);
          state.energy = clamp(state.energy - energyRate * m, 0, 100);
          state.clean = clamp(state.clean - cleanRate * m, 0, 100);

          state.poopTimer -= dt;
          if (state.poopTimer <= 0) {
              state.poopTimer = 90 + Math.random() * 70;
              if (state.poops.length < 5) {
                  // ペットや おうちに かぶらないよう ひだり手前に ならべる
                  state.poops.push({ x: 0.06 + state.poops.length * 0.05 + Math.random() * 0.02 });
              }
          }
      }

      if (has('robot')) {                     // ロボットが かってに おてつだい＆おしゃべり
          state.robotTimer = (typeof state.robotTimer === 'number' ? state.robotTimer : 45) - dt;
          if (state.robotTimer <= 0) {
              state.robotTimer = 45;
              robotHelp();
          }
          state.chatTimer = (typeof state.chatTimer === 'number' ? state.chatTimer : 20) - dt;
          if (state.chatTimer <= 0) {
              state.chatTimer = 22 + Math.random() * 16;
              robotSay(robotLine());
          }
      }

      if (has('bank') && state.savings > 0) {  // ちょきんに りそくが つく（1日 = 180びょう ごと）
          state.bankTimer = (typeof state.bankTimer === 'number' ? state.bankTimer : DAY_SEC) - dt;
          if (state.bankTimer <= 0) {
              const times = Math.min(20, 1 + Math.floor(-state.bankTimer / DAY_SEC));
              state.bankTimer = DAY_SEC;
              let gain = 0n;
              const r = big(Math.round(bankRate() * 100));
              for (let i = 0; i < times; i++) gain += (big(state.savings) + gain) * r / 100n;
              gain = bmax(0n, bmin(gain, bankCap() - big(state.savings)));
              if (gain > 0n) {
                  state.savings = big(state.savings) + gain;
                  state.stats.interest = big(state.stats.interest) + gain;
                  addLog(`🐷 ちょきんに りそくが ついた！ +${coinText(gain)}🪙`);
                  robotSay('ちょきん、ふえてるよ！');
              }
          }
      }

      if (state.bankAcct > 0) {                // ぎんこうの こうざにも りそくが つく
          state.acctTimer = (typeof state.acctTimer === 'number' ? state.acctTimer : DAY_SEC) - dt;
          if (state.acctTimer <= 0) {
              const times = Math.min(20, 1 + Math.floor(-state.acctTimer / DAY_SEC));
              state.acctTimer = DAY_SEC;
              let gain = 0n;
              for (let i = 0; i < times; i++) gain += (big(state.bankAcct) + gain) * 2n / 100n;
              if (gain > 0n) {
                  state.bankAcct = big(state.bankAcct) + gain;
                  state.stats.interest = big(state.stats.interest) + gain;
                  bankNote('ri', gain);
                  addLog(`🏦 ぎんこうの りそく +${coinText(gain)}🪙`);
              }
          }
      }

      if (state.stage !== 'egg' && Math.random() < 0.002) checkRoomieWishes();   // ときどき おもいだす

      if (has('post')) {                      // ポストに ときどき コインが とどく
          state.postTimer -= dt;
          if (state.postTimer <= 0) {
              const times = Math.min(10, 1 + Math.floor(-state.postTimer / 180));
              state.postTimer = 180;
              addCoins(5 * times);
              addLog(`📮 ポストに コインが とどいていた！ (+${5 * times}🪙)`);
          }
      }

      // 病気の判定
      const bad = state.clean < 12 || state.hunger < 12 || state.poops.length >= 4;
      if (!state.sick) {
          state.sickTimer = bad ? state.sickTimer + dt : Math.max(0, state.sickTimer - dt);
          if (state.sickTimer > (isWorn('mask') ? 70 : 40) * (has('firstaid') ? 2 : 1) * (has('airpur') ? 1.5 : 1)
              * (isWorn('mask2') || has('mask2') ? 1.2 : 1) * (has('band') ? 1.2 : 1)
              * (has('vitc') ? 1.3 : 1) * (has('handwash') ? 1.2 : 1) * (has('warmup') ? 1.25 : 1)) {
              state.sick = true;
              state.sickTimer = 0;
              state.stats.sick++;
              addLog(`⚠ ${state.name} が びょうきに なってしまった…！`);
          }
      }

      if (state.sick) {
          state.hp = clamp(state.hp - 3 * m, 0, 100);
          state.happy = clamp(state.happy - 4 * m, 0, 100);
      } else if (state.hunger < 8 || state.happy < 5) {
          state.hp = clamp(state.hp - 2 * m, 0, 100);
      } else if (state.hunger > 40 && state.happy > 40 && state.clean > 40) {
          state.hp = clamp(state.hp + 2.5 * (has('vitamin') ? 1.6 : 1) * (has('royal') ? 1.4 : 1)
              * (has('jelly') ? 1.25 : 1) * (has('honeypot') ? 1.2 : 1) * (has('greentea') ? 1.2 : 1) * (has('yogurt') ? 1.2 : 1)
              * infUp('hp') * m, 0, 100);
      }
      if (state.sleeping && has('mattress')) {              // いい マットレスは ねている あいだも かいふく
          state.hp = clamp(state.hp + 1.5 * m, 0, 100);
      }

      // どんなに ほうっておかれても たいりょくは 1 で ふみとどまる（おわかれは しない）
      if (state.hp < 1) state.hp = 1;
      if (state.hp <= 1) {
          if (!state.exhausted) {
              state.exhausted = true;
              addLog(`${state.name} が ぐったりしている… おせわして あげよう！`);
          }
      } else if (state.hp > 30) {
          state.exhausted = false;
      }
  }

  /* ---------------- ともだちの ペット ---------------- */

  // ear: round / cat / long / fluffy / bird / horn、mark: star / flower / none

  // きょうは どこに いるか（1日ごとに かわる）
  function friendPlace(f: Friend) {
      const day = Math.floor(state.ageSec / DAY_SEC);
      return f.spots[(day + f.seed) % f.spots.length];
  }

  function friendLv(id: string) { return (state.friends && state.friends[id]) ? state.friends[id].lv : 0; }


  function isRoomie(id: string) { return !!(state.roomies && state.roomies[id]); }
  function roomieCount() { return FRIENDS.filter(function (f) { return isRoomie(f.id); }).length; }

  // いっしょに すんでいる ともだちは どこへでも ついてくる
  function friendsHere() {
      const v = state.view || 'out';
      return FRIENDS.filter(function (f) {
          if (isRoomie(f.id)) return true;          // おでかけ さきにも ついてくる
          return friendPlace(f) === v;
      });
  }

  const ROOMIE_LV = 5;                                 // なかよし 5で ペットが よびたがる

  // なかよく なったら ペットが じぶんから 「いっしょに すみたい」と いう
  function petWantsRoomie(f: Friend) {
      if (!state.invites) state.invites = {};
      if (state.invites[f.id] || isRoomie(f.id)) return false;
      if (friendLv(f.id) < ROOMIE_LV) return false;
      state.invites[f.id] = true;
      addLog(`💭 ${state.name}「${f.name} と いっしょに すみたいな！」`);
      robotSay(`${state.name} が ${f.name} と すみたいって！`, 5);
      return true;
  }

  // もう なかよしなのに いいそびれて いた ぶんも まとめて
  function checkRoomieWishes() {
      let said = false;
      FRIENDS.forEach(function (f) { if (petWantsRoomie(f)) said = true; });
      if (said) save();
      return said;
  }

  // おうちに よぶ
  function moveIn(id: string) {
      const f = FRIENDS.filter(function (x) { return x.id === id; })[0];
      if (!f) return;
      if (!state.invites || !state.invites[id]) {
          addLog(`${state.name}「まだ ${f.name} を さそって ないよ」`);
          return;
      }
      if (roomieCount() >= FRIENDS.length) { addLog('もう みんな いっしょに すんでいるよ！'); return; }
      state.roomies[id] = true;
      addLog(`🏠 ${f.name} が おうちに ひっこして きた！ いっしょに くらそう！`);
      robotSay(`${f.name} が なかまに なったよ！`);
      burst('heart', 10);
      state.happy = clamp(state.happy + 15, 0, 100);
      hideModal();
      setView('living');
      save();
  }

  function moveOut(id: string) {
      const f = FRIENDS.filter(function (x) { return x.id === id; })[0];
      if (!f) return;
      delete state.roomies[id];
      addLog(`👋 ${f.name} は じぶんの おうちに かえった。またね！`);
      save();
      openFriends();
  }

  // ともだちが きょう みにつける もの（かった ものを ともだちも つかえる）
  function friendWear(f: Friend) {
      if (!state.owned) return null;
      const ids = Object.keys(WEAR_COLOR).filter(function (k) { return has(k); });
      if (!ids.length) return null;
      const day = Math.floor(state.ageSec / DAY_SEC);
      return ids[(f.seed * 5 + day) % ids.length];
  }

  // ともだちを えがく
  function drawFriend(f: Friend, x: number, y: number, s: number, t: number, i: number, sc: number) {
      const night = isNight();
      const r = 26 * s * (sc || 1);
      const napping = state.sleeping;                                     // ペットが ねたら みんな ねる
      const doing = napping ? null : actEmoji();
      const bob = napping ? Math.sin(t * 1.1 + i) * 1.2 * s
                : doing ? Math.abs(Math.sin(t * 5 + i * 0.8)) * 7 * s      // まねして はねる
                        : Math.sin(t * 1.6 + i * 1.3) * 2.5 * s;
      const cy = y - r - bob;

      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ellipse(x, y + 1 * s, r * 0.8, r * 0.22);

      // みんなの かぐ（ベッド・クッション）
      if (state.sleeping && has('fr_bed')) {
          ctx.fillStyle = night ? '#7c3a5a' : '#f472b6';
          ctx.fillRect(x - r * 1.05, y - r * 0.34, r * 2.1, r * 0.30);
          ctx.fillStyle = night ? '#57534e' : '#a16207';
          ctx.fillRect(x - r * 1.1, y - r * 0.10, r * 2.2, r * 0.14);
          ctx.fillStyle = night ? '#e2e8f0' : '#fff';
          ellipse(x + r * 0.72, y - r * 0.40, r * 0.28, r * 0.16);
      } else if (!state.sleeping && has('fr_cushion')) {
          ctx.fillStyle = night ? '#4c1d95' : '#c4b5fd';
          ellipse(x, y - r * 0.10, r * 0.85, r * 0.24);
          ctx.fillStyle = night ? '#5b21b6' : '#ddd6fe';
          ellipse(x, y - r * 0.16, r * 0.72, r * 0.18);
      }

      // かった マントは からだの うしろに
      const wid = friendWear(f);
      if (wid && wid.indexOf('cape') === 0) {
          const cc = WEAR_COLOR[wid];
          ctx.fillStyle = cc[1];
          ctx.beginPath();
          ctx.moveTo(x - r * 0.90, cy - r * 0.30);
          ctx.quadraticCurveTo(x, cy + r * 0.20, x + r * 0.90, cy - r * 0.30);
          ctx.lineTo(x + r * 1.10, cy + r * 1.00);
          ctx.quadraticCurveTo(x, cy + r * 0.70, x - r * 1.10, cy + r * 1.00);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = cc[0];
          ctx.beginPath();
          ctx.moveTo(x - r * 0.80, cy - r * 0.26);
          ctx.quadraticCurveTo(x, cy + r * 0.16, x + r * 0.80, cy - r * 0.26);
          ctx.lineTo(x + r * 0.96, cy + r * 0.86);
          ctx.quadraticCurveTo(x, cy + r * 0.58, x - r * 0.96, cy + r * 0.86);
          ctx.closePath();
          ctx.fill();
      }

      // みみ
      ctx.fillStyle = f.dark;
      if (f.ear === 'round') {
          ellipse(x - r * 0.62, cy - r * 0.78, r * 0.30, r * 0.30);
          ellipse(x + r * 0.62, cy - r * 0.78, r * 0.30, r * 0.30);
      } else if (f.ear === 'cat') {
          [-1, 1].forEach(function (d) {
              ctx.beginPath();
              ctx.moveTo(x + d * r * 0.30, cy - r * 0.80);
              ctx.lineTo(x + d * r * 0.72, cy - r * 1.42);
              ctx.lineTo(x + d * r * 0.86, cy - r * 0.62);
              ctx.closePath();
              ctx.fill();
          });
      } else if (f.ear === 'long') {
          [-1, 1].forEach(function (d) {
              ctx.save();
              ctx.translate(x + d * r * 0.42, cy - r * 0.80);
              ctx.rotate(d * 0.22);
              ellipse(0, -r * 0.55, r * 0.20, r * 0.62);
              ctx.restore();
          });
      } else if (f.ear === 'fluffy') {
          [-1, 1].forEach(function (d) {
              ellipse(x + d * r * 0.66, cy - r * 0.70, r * 0.26, r * 0.24);
              ellipse(x + d * r * 0.86, cy - r * 0.48, r * 0.20, r * 0.18);
          });
      } else if (f.ear === 'bird') {
          [-1, 1].forEach(function (d) {
              ctx.beginPath();
              ctx.moveTo(x + d * r * 0.86, cy - r * 0.10);
              ctx.quadraticCurveTo(x + d * r * 1.5, cy + r * 0.25, x + d * r * 0.8, cy + r * 0.55);
              ctx.closePath();
              ctx.fill();
          });
      } else if (f.ear === 'horn') {
          ctx.beginPath();
          ctx.moveTo(x - r * 0.20, cy - r * 0.92);
          ctx.lineTo(x, cy - r * 1.55);
          ctx.lineTo(x + r * 0.20, cy - r * 0.92);
          ctx.closePath();
          ctx.fill();
      }

      // からだ
      ctx.fillStyle = night ? f.dark : f.col;
      ellipse(x, cy, r, r);
      ctx.fillStyle = night ? f.col : f.belly;
      ellipse(x, cy + r * 0.28, r * 0.60, r * 0.52);

      // て・あし
      ctx.fillStyle = f.dark;
      ellipse(x - r * 0.92, cy + r * 0.20, r * 0.20, r * 0.26);
      ellipse(x + r * 0.92, cy + r * 0.20, r * 0.20, r * 0.26);
      ellipse(x - r * 0.42, cy + r * 0.94, r * 0.24, r * 0.16);
      ellipse(x + r * 0.42, cy + r * 0.94, r * 0.24, r * 0.16);

      // かお
      ctx.fillStyle = '#1f2937';
      const blink = Math.sin(t * 1.1 + f.seed) > 0.96;
      if (napping) {                                                      // ねているかお
          ctx.strokeStyle = '#1f2937';
          ctx.lineWidth = 1.6 * s;
          [-1, 1].forEach(function (d) {
              ctx.beginPath();
              ctx.arc(x + d * r * 0.32, cy - r * 0.20, r * 0.13, 0.15 * Math.PI, 0.85 * Math.PI);
              ctx.stroke();
          });
      } else if (blink) {
          ctx.fillRect(x - r * 0.44, cy - r * 0.12, r * 0.24, r * 0.06);
          ctx.fillRect(x + r * 0.20, cy - r * 0.12, r * 0.24, r * 0.06);
      } else {
          ellipse(x - r * 0.32, cy - r * 0.14, r * 0.11, r * 0.13);
          ellipse(x + r * 0.32, cy - r * 0.14, r * 0.11, r * 0.13);
          ctx.fillStyle = '#fff';
          ellipse(x - r * 0.28, cy - r * 0.19, r * 0.04, r * 0.05);
          ellipse(x + r * 0.36, cy - r * 0.19, r * 0.04, r * 0.05);
      }
      ctx.fillStyle = 'rgba(248,113,113,0.5)';
      ellipse(x - r * 0.56, cy + r * 0.10, r * 0.14, r * 0.10);
      ellipse(x + r * 0.56, cy + r * 0.10, r * 0.14, r * 0.10);
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath();
      ctx.arc(x, cy + r * 0.10, r * 0.20, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();

      // かった ものを ともだちも つける
      if (wid && wid.indexOf('cape') !== 0) {
          const col = WEAR_COLOR[wid];
          if (wid.indexOf('ribbon') === 0) {                 // リボン
              ctx.fillStyle = col[0];
              [-1, 1].forEach(function (d) {
                  ctx.beginPath();
                  ctx.moveTo(x + r * 0.60, cy - r * 0.72);
                  ctx.lineTo(x + r * 0.60 + d * r * 0.34, cy - r * 0.98);
                  ctx.lineTo(x + r * 0.60 + d * r * 0.34, cy - r * 0.46);
                  ctx.closePath();
                  ctx.fill();
              });
              ctx.fillStyle = col[1];
              ellipse(x + r * 0.60, cy - r * 0.72, r * 0.11, r * 0.11);
          } else if (wid.indexOf('scarf') === 0) {           // マフラー
              ctx.fillStyle = col[0];
              ctx.fillRect(x - r * 0.72, cy + r * 0.34, r * 1.44, r * 0.26);
              ctx.fillStyle = col[1];
              ctx.fillRect(x + r * 0.24, cy + r * 0.50, r * 0.26, r * 0.52);
              ctx.fillStyle = col[2] || col[0];
              ctx.fillRect(x - r * 0.72, cy + r * 0.34, r * 1.44, r * 0.08);
          }
      }

      // しるし
      if (f.mark === 'star') {
          ctx.fillStyle = '#fde047';
          star(x, cy - r * 0.55, 5, r * 0.20, r * 0.09);
          ctx.fill();
      } else if (f.mark === 'flower') {
          ctx.fillStyle = '#fb7185';
          for (let k = 0; k < 5; k++) {
              const a = k / 5 * Math.PI * 2;
              ellipse(x - r * 0.62 + Math.cos(a) * r * 0.13, cy - r * 0.74 + Math.sin(a) * r * 0.13, r * 0.09, r * 0.09);
          }
          ctx.fillStyle = '#fde047';
          ellipse(x - r * 0.62, cy - r * 0.74, r * 0.07, r * 0.07);
      }

      // ねている しるし
      if (napping) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold ' + (r * 0.55) + 'px sans-serif';
          ctx.textAlign = 'center';
          for (let z = 0; z < 2; z++) {
              const q = ((t * 0.4 + z * 0.5 + i * 0.2) % 1);
              ctx.globalAlpha = 1 - q;
              ctx.fillText('z', x + r * 0.8 + q * r * 0.5, cy - r * 1.0 - q * r * 0.8);
          }
          ctx.globalAlpha = 1;
      }

      // ペットと おなじ ことを している しるし
      if (doing) {
          ctx.font = (r * 0.7) + 'px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(doing, x + r * 0.9, cy - r * 0.7);
          ctx.textBaseline = 'alphabetic';
      }

      // なまえ（あたまの うえ）
      const lv = friendLv(f.id);
      const few = friendsHere().length <= 4;
      ctx.textAlign = 'center';
      ctx.fillStyle = night ? '#e2e8f0' : '#1f2937';
      ctx.font = 'bold ' + (8.5 * s * (sc || 1)) + 'px sans-serif';
      ctx.fillText(f.name, x, cy - r * 1.7);
      if (lv > 0 && few) {
          ctx.fillStyle = '#ef4444';
          ctx.font = (8 * s) + 'px sans-serif';
          ctx.fillText('♥'.repeat(Math.min(5, Math.ceil(lv / 2))), x, cy - r * 2.2);
      }
  }

  // ペットが していることを ともだちも まねする

  // ボタンを おした ときの まね（アニメの ない こうどう ようも）
  let mimicNow: { emoji: string | null; until: number } = { emoji: null, until: 0 };

  function friendsCopy(emoji: string, sec?: number) {
      mimicNow = { emoji: emoji, until: now() + (sec || 2.6) };
  }

  function actEmoji() {
      if (!action.type || now() > action.until) {
          return (mimicNow.emoji && now() < mimicNow.until) ? mimicNow.emoji : null;
      }
      if (action.type === 'eat') {
          if (action.food === '__sweet') return sweetNow;
          const f = FOODS[action.food ?? ''];
          return (f && f.emoji) ? f.emoji : '🍚';
      }
      if (action.type === 'activity') {
          const a = ACTIVITIES.filter(function (x) { return x.id === action.food; })[0];
          return a ? a.emoji : '🎉';
      }
      return ACT_EMOJI[action.type] || null;
  }

  // みんなで やると もっと たのしい
  function friendsJoin(what: string) {
      const n = friendsHere().length;
      if (!n) return;
      state.happy = clamp(state.happy + Math.min(12, n * 2), 0, 100);
      addLog(`👫 みんなも いっしょに ${what}！ たのしい！`);
  }


  function drawFriends(t: number) {
      if (state.stage === 'egg') return;
      const here = friendsHere();
      if (!here.length) return;
      const W = cw(), H = ch(), s = W / 380;
      const y = isOutside() ? H * 0.945 : H * 0.965;

      if (here.length <= 4) {                       // すくないときは きまった ばしょに
          here.forEach(function (f, i) {
              drawFriend(f, W * FRIEND_X[i], y, s, t, i, 1);
          });
          ctx.textAlign = 'center';
          return;
      }

      // おおぜいの ときは まえ・うしろ こうごに ならぶ（ふえるほど ちいさく）
      const n = here.length;
      const base = Math.max(0.5, Math.min(0.92, 7.4 / n));
      here.forEach(function (f, i) {
          const fx = 0.06 + (0.88 * i) / (n - 1);
          const back = (i % 2 === 0);
          drawFriend(f, W * fx, back ? y - 34 * s * base : y, s, t, i, back ? base * 0.8 : base);
      });
      ctx.textAlign = 'center';
  }

  /* ---------------- ともだちと あそぶ ---------------- */

  function meetFriend(id: string) {
      hideModal();
      const f = FRIENDS.filter(function (x) { return x.id === id; })[0];
      if (!f || busy()) return;
      const place = friendPlace(f);
      if ((state.view || 'out') !== place) {
          setView(place);
          addLog(`🚶 ${ROOM_LABEL[place]}へ ${f.name}に あいに いった。`);
      }
      if (state.energy < 6) { addLog(`げんきが たりない… やすませて あげよう。`); return; }

      if (!state.friends) state.friends = {};
      const rec = state.friends[id] || { lv: 0, times: 0 };
      const first = rec.lv === 0;
      rec.lv = Math.min(10, rec.lv + (has('gift') ? 2 : 1) + (has('friendbook') ? 1 : 0) + (has('photo') ? 1 : 0));
      rec.times++;
      state.friends[id] = rec;

      state.energy = clamp(state.energy - 6, 0, 100);
      state.hunger = clamp(state.hunger - 3, 0, 100);
      state.happy = clamp(state.happy + 24, 0, 100);
      state.care.play += 1;
      state.stats.plays++;
      setAction('play', 2.6);
      burst('heart', 8);

      if (first) addLog(`🎉 ${f.name} と ともだちに なった！`);
      addLog(`👫 ${f.name} と あそんだ！ とても たのしい（なかよし ${rec.lv}）`);
      robotSay(`${f.name} と なかよしだね！`);
      petWantsRoomie(f);                              // なかよく なったら すみたいと いう

      // なかよしが すすむと プレゼントが もらえる
      const gift = { 3: 200, 5: 800, 8: 3000, 10: 20000 }[rec.lv];
      if (gift) {
          addCoins(gift);
          addLog(`🎁 ${f.name} から プレゼント！ ${f.likes} と ${coinText(gift)}🪙 を もらった！`);
          burst('star', 10);
      }
      gainExp(8);
      save();
  }

  function openFriends() {
      checkRoomieWishes();                            // なかよしなら ペットが すみたいと いう
      let html = `<div class="font-bold text-lg mb-1">👫 ともだち</div>
          <div class="text-xs text-gray-600 mb-2">いる ばしょは 1日ごとに かわるよ</div>
          <div class="game-btn blue mb-3" onclick="__pet.openChat('pet')">💬 ${state.name} と おはなしする</div>`;
      FRIENDS.forEach(function (f) {
          const place = friendPlace(f);
          const here = (state.view || 'out') === place;
          const lv = friendLv(f.id);
          const hearts = lv ? '♥'.repeat(lv) + '♡'.repeat(10 - lv) : '♡'.repeat(10);
          const live = isRoomie(f.id);
          const invited = !!(state.invites && state.invites[f.id]);
          let houseBtn = '';
          if (live) houseBtn = `<div class="game-btn gray" style="font-size:0.7rem" onclick="__pet.moveOut('${f.id}')">🏠 でていく</div>`;
          else if (invited) houseBtn = `<div class="game-btn" style="font-size:0.7rem;background:#f59e0b;border-bottom-color:#b45309" onclick="__pet.moveIn('${f.id}')">🏠 よぶ</div>`;
          const houseNote = live ? '' : invited
              ? `<div class="text-xs" style="color:#b45309">🏠 ${state.name}が「いっしょに すみたい」と いってるよ！</div>`
              : `<div class="text-xs text-gray-400">なかよし ${ROOMIE_LV}に なると おうちに よべるよ</div>`;
          html += `<div class="mb-3" style="border-bottom:1px dashed #e7e5e4;padding-bottom:6px">
              <div class="text-left text-sm">
                  <div class="font-bold">${f.likes} ${f.name}${live ? '　🏠 いっしょに すんでる' : (here ? '　📍いま ここ' : '')}</div>
                  <div class="text-xs" style="color:#ef4444;letter-spacing:1px">${hearts}</div>
                  <div class="text-xs text-gray-500">${live ? 'いつも いっしょ（どこへでも ついてくる）' : ROOM_LABEL[place] + 'に いる'}${lv ? ` / なかよし ${lv}` : ''}</div>
                  ${houseNote}
              </div>
              <div class="grid grid-cols-${houseBtn ? 3 : 2} gap-1">
                  <div class="game-btn ${here ? 'pink' : 'green'}" style="font-size:0.7rem"
                      onclick="__pet.meetFriend('${f.id}')">${here ? '🎾 あそぶ' : '🚶 あいに いく'}</div>
                  <div class="game-btn blue" style="font-size:0.7rem" onclick="__pet.openChat('friend','${f.id}')">💬 はなす</div>
                  ${houseBtn}
              </div>
          </div>`;
      });
      html += `<div class="game-btn gray mt-2" onclick="__pet.hideModal()">とじる</div>`;
      showModal(html);
  }

  /* ---------------- キーボードで おしゃべり ---------------- */

  // ともだちごとの しゃべりかた（さいごに つく くちぐせ）

  // いま はなしている あいて
  let chatWho: ChatSpeaker | null = null;
  let chatLog: { me: boolean; text: string }[] = [];
  let chatDraft = '';

  function setChatDraft(v: string) { chatDraft = v; }

  function chatSpeaker(kind: string, id?: string) {
      if (kind === 'friend') {
          const f = FRIENDS.filter(function (x) { return x.id === id; })[0];
          return { id: f.id, name: f.name, tone: TONE[f.id], kind: 'friend', likes: f.likes, f: f };
      }
      if (kind === 'robot') return { id: 'robot', name: 'ロボット', tone: TONE.robot, kind: 'robot', likes: '🔋' };
      return { id: 'pet', name: state.name, tone: TONE.pet, kind: 'pet', likes: '🍚' };
  }

  // ことばを みて へんじを かんがえる
  function chatAnswer(sp: ChatSpeaker, text: string) {
      const t = text;
      const n = state.name;
      const has_ = (...words: string[]): boolean => words.some((w) => t.indexOf(w) >= 0);
      const say = (line: string): string => line + sp.tone.tail;

      // じぶんの ペットに ともだちの なまえを いうと 「いっしょに すみたい」と いう
      if (sp.kind === 'pet') {
          for (let i = 0; i < FRIENDS.length; i++) {
              const f = FRIENDS[i];
              if (t.indexOf(f.name) < 0) continue;
              if (isRoomie(f.id)) return say(`${f.name} と いっしょに すめて うれしい！`);
              if (friendLv(f.id) >= 3) {
                  if (!state.invites) state.invites = {};
                  if (!state.invites[f.id]) {
                      state.invites[f.id] = true;
                      addLog(`💭 ${state.name}「${f.name} と いっしょに すみたいな！」`);
                  }
                  return say(`${f.name}！ だいすき！ いっしょに すみたいな！（「👫 ともだち」から よべるよ）`);
              }
              return say(`${f.name} とは まだ あんまり あそんでないの… もっと なかよく なりたい！`);
          }
      }

      if (has_('こんにちは', 'やあ', 'はろー', 'ハロー', 'やっほ', 'おーい'))
          return say('こんにちは！ あえて うれしいよ！');
      if (has_('おはよう')) return say('おはよう！ きょうも いい ひに なるね！');
      if (has_('こんばんは')) return say('こんばんは。ほしが きれいだね。');
      if (has_('おやすみ')) return say('おやすみ！ いい ゆめ みてね。');
      if (has_('なまえ', 'だれ', 'きみは')) return say(`ぼくの なまえは ${sp.name}！ よろしくね！`);
      if (has_('すき', 'だいすき', 'かわいい', 'きれい')) return say(`ぼくも ${n} の こと だいすき！`);
      if (has_('ありがと', 'あんがと')) return say('どういたしまして！');
      if (has_('ごめん', 'すまん')) return say('きにしないで！ なかよく しようね。');
      if (has_('あそぼ', 'あそぶ', 'いっしょ', 'あそび')) return say('いいね！ あそぼう！「あそぶ」ボタンでも あそべるよ。');
      if (has_('たべ', 'ごはん', 'おなか', 'おやつ')) return say(`ぼくの すきな たべものは ${sp.likes} だよ！ ${n} は なにが すき？`);
      if (has_('どこ', 'ばしょ', 'いるの'))
          return say(sp.kind === 'friend' && !isRoomie(sp.id)
              ? `きょうは ${ROOM_LABEL[sp.f ? friendPlace(sp.f) : 'out']}に いるよ！`
              : `いまは ${ROOM_LABEL[state.view || 'out']}に いるよ！`);
      if (has_('なんさい', 'とし', 'たんじょう')) return say(`いま ${Math.floor(state.ageSec / DAY_SEC)}日目 だよ！`);
      if (has_('てんき', 'はれ', 'あめ', 'ゆき', 'あつ', 'さむ'))
          return say(isNight() ? 'そとは まっくら。ほしが きれいだね。' : 'きょうは いい てんきだね！');
      if (has_('げんき', 'ちょうし', 'だいじょうぶ')) return say(`げんきだよ！ ${n} は たいりょく ${Math.round(state.hp)} だね！`);
      if (has_('ばいばい', 'またね', 'じゃあ', 'さようなら')) return say('またね！ また はなそうね。');
      if (has_('すごい', 'かっこい', 'つよい', 'えらい')) return say('ありがとう！ うれしいなあ。');
      if (has_('なかよし', 'ともだち'))
          return say(sp.kind === 'friend'
              ? `${n} とは なかよし ${friendLv(sp.id)} だね。もっと なかよく なろう！`
              : 'ともだちが いっぱいで うれしいな！');
      if (has_('すむ', 'すみたい', 'いっしょにすみ', 'ひっこ', 'おうちに'))
          return say(sp.kind === 'friend'
              ? `${n} の おうちに すめたら うれしいなあ！（なかよし 3から よべるよ）`
              : 'なかよしの ともだちなら おうちに よべるよ！');
      if (has_('うた', 'おんがく', 'ダンス')) return say('ラララ〜♪ いっしょに うたおう！');
      if (has_('ねむ', 'つかれ')) return say('むりしないで ゆっくり やすんでね。');
      if (has_('おかね', 'コイン', 'ちょきん')) return say(`${n} は ${coinText(state.coins)}🪙 もってるね。すごい！`);
      if (has_('しごと', 'はたらく')) return say('おしごと えらいね！ おうえん するよ。');
      if (has_('がっこう', 'べんきょう')) return say('べんきょう、いっしょに がんばろう！');
      if (has_('うみ', 'やま', 'こうえん', 'おでかけ')) return say('おでかけ たのしいよね！ また いこうね。');
      if (has_('なぞなぞ', 'クイズ', 'もんだい')) return say('じゃあ もんだい！「あかくて まるくて あまい くだものは？」…こたえは 🍎！');
      if (has_(sp.name)) return say('よんだ？ なあに？');
      if (has_('?', '？')) return say('うーん、なんだろう… いっしょに かんがえよう！');

      const talk = [
          'そうなんだ！ おしえて くれて ありがとう。',
          `${n} と はなすの たのしいなあ。`,
          'へえ！ もっと きかせて。',
          'なるほどね〜。',
          'うんうん、それで それで？',
          `きょうも ${n} は すてきだね。`,
          `${sp.likes} たべながら はなそうか。`,
          'そう おもって いたんだ！'
      ];
      return say(talk[Math.floor(Math.random() * talk.length)]);
  }


  function openChat(kind: string, id: string) {
      chatWho = chatSpeaker(kind, id);
      chatLog = [{ me: false, text: `やっほー！ ${state.name}、はなしかけて くれて ありがとう${chatWho.tone.end}` }];
      renderChat();
  }

  function sendChat(preset: string) {
      if (!chatWho) return;
      const box = el('chat-input');
      const txt = (preset !== undefined ? preset : (box ? (box as HTMLInputElement).value : chatDraft)).trim();
      if (!txt) return;
      chatDraft = '';
      friendsCopy('💬');
      chatLog.push({ me: true, text: txt });
      chatLog.push({ me: false, text: chatAnswer(chatWho, txt) });
      chatLog = chatLog.slice(-16);

      state.stats.talks = (state.stats.talks || 0) + 1;
      state.happy = clamp(state.happy + 1, 0, 100);

      // ともだちとは はなすほど なかよくなる
      if (chatWho.kind === 'friend') {
          if (!state.friends) state.friends = {};
          const rec = state.friends[chatWho.id] || { lv: 0, times: 0, said: 0 };
          rec.said = (rec.said || 0) + 1;
          if (rec.said % 4 === 0 && rec.lv < 10) {
              rec.lv++;
              addLog(`💬 ${chatWho.name} と たくさん はなした！（なかよし ${rec.lv}）`);
              burst('heart', 4);
          }
          state.friends[chatWho.id] = rec;
          petWantsRoomie(chatWho.f!);
      }
      // じぶんの ペットは ときどき ともだちを おうちに さそいたがる
      if (chatWho.kind === 'pet' && Math.random() < 0.3) {
          const want = FRIENDS.filter(function (f) {
              return friendLv(f.id) >= 5 && !isRoomie(f.id) && !(state.invites && state.invites[f.id]);
          })[0];
          if (want) {
              if (!state.invites) state.invites = {};
              state.invites[want.id] = true;
              chatLog.push({ me: false, text: `ねえねえ、${want.name} を おうちに よびたいな！ いっしょに すみたい！` });
              addLog(`💭 ${state.name}「${want.name} を おうちに よびたいな！」`);
          }
      }
      save();
      renderChat();
  }

  function renderChat() {
      const sp = chatWho;
      if (!sp) return;
      const bubbles = chatLog.map(function (m) {
          return m.me
              ? `<div style="text-align:right;margin:4px 0">
                   <span style="display:inline-block;max-width:80%;background:#fde68a;border-radius:14px 14px 4px 14px;
                                padding:7px 10px;font-size:0.86rem;text-align:left">${escAttr(m.text)}</span></div>`
              : `<div style="text-align:left;margin:4px 0">
                   <span style="display:inline-block;max-width:80%;background:#e0f2fe;border-radius:14px 14px 14px 4px;
                                padding:7px 10px;font-size:0.86rem">${sp.tone.emo} ${escAttr(m.text)}</span></div>`;
      }).join('');
      const chips = CHAT_CHIPS.map(function (c) {
          return `<div class="game-btn green" style="font-size:0.7rem;padding:7px 2px" onclick="__pet.sendChat('${c}')">${c}</div>`;
      }).join('');

      showModal(`
          <div class="font-bold text-lg mb-2">💬 ${sp.tone.emo} ${sp.name} と おはなし</div>
          <div id="chat-box" style="background:#fffdf7;border:3px solid #d6d3d1;border-radius:12px;
               padding:8px;height:240px;overflow-y:auto;text-align:left">${bubbles}</div>
          <input id="chat-input" value="${escAttr(chatDraft)}" placeholder="キーボードで はなしかけてね"
              oninput="__pet.setChatDraft(this.value)"
              onkeydown="__pet.if(event.key==='Enter'){__pet.sendChat();}"
              style="width:100%;box-sizing:border-box;font-family:inherit;font-size:0.95rem;padding:9px 10px;
                     border:3px solid #78350f;border-radius:12px;background:#fff;margin:8px 0 6px">
          <div class="game-btn mb-2" onclick="__pet.sendChat()">💬 はなす</div>
          <div class="grid grid-cols-3 gap-1 mb-3">${chips}</div>
          <div class="game-btn gray" onclick="__pet.hideModal()">またね</div>
      `);
      const boxEl = el('chat-box');
      if (boxEl) boxEl.scrollTop = boxEl.scrollHeight;
      const inp = el('chat-input');
      if (inp) inp.focus();
  }

  /* ---------------- robot ---------------- */

  // キャンバスの ふきだし（robotSay で セット、drawRobot が えがく）
  let roboTalk = { text: '', until: 0 };

  function robotSay(text: string, sec?: number) {
      if (!state || !has('robot') || state.stage === 'egg') return;
      roboTalk = { text: text, until: now() + (sec || 4.5) };
  }

  function robotDays() { return Math.floor(state.ageSec / DAY_SEC); }

  // そのときの ようすに あわせた ひとこと
  function robotLine() {
      const n = state.name;
      if (state.sick) return `${n} が びょうきだよ！ おくすりを あげて！`;
      if (state.hp <= 1) return `${n} が ぐったり… はやく おせわ しよう`;
      if (state.hunger < 25) return `${n} の おなかが ペコペコ みたいだよ`;
      if (state.poops.length >= 3) return 'おへやが ちらかってる… そうじ するね！';
      if (state.clean < 25) return `${n} が よごれてるよ。おふろは どうかな`;
      if (state.energy < 25) return `${n} が ねむそう。ねかせて あげよう`;
      if (state.happy < 25) return `${n} と あそんで あげて！ さみしそうだよ`;
      return randomChat();
  }

  function randomChat() {
      const n = state.name;
      const list = [
          `きょうで ${robotDays()}日目 だね。はやいなあ`,
          `${n} は きょうも げんきだよ`,
          `レベル ${state.level} まで きたね！ すごい`,
          `コインは いま ${coinText(state.coins)} あるよ`,
          'ぼくの バッテリーは まんタン！',
          `${n} の わらいがお、ぼく すきだな`,
          'なにか てつだえる こと ある？',
          'いっしょに いられて うれしいよ',
          'おそうじは ぼくに まかせてね',
          `${n} と キミが なかよしで よかった`,
          'ときどき ショップを のぞくと たのしいよ',
          'ピピッ… きょうも いい ひ だね'
      ];
      return list[Math.floor(Math.random() * list.length)];
  }

  // いちばん たりない ところを おしえて くれる
  function robotAdvice() {
      const n = state.name;
      if (state.sick) return `${n} は びょうき。「💊 くすり」を つかおう！`;
      const low = ([
          ['おなか', state.hunger, `「🍚 ごはん」を あげよう`],
          ['きげん', state.happy, `「🎾 あそぶ」で あそんで あげよう`],
          ['きれい', state.clean, `「🛁 おふろ」に いれて あげよう`],
          ['げんき', state.energy, `「💤 ねる」で やすませて あげよう`],
      ] as [string, number, string][]).sort((a, b) => a[1] - b[1])[0];
      if (low[1] > 70) return `ぜんぶ ばっちり！ 「💼 おしごと」で コインを かせぐ チャンスだよ`;
      return `${low[0]} が ${Math.round(low[1])} だよ。${low[2]}`;
  }

  function robotStatusTalk() {
      const n = state.name;
      const mark = state.hp > 70 ? 'とても げんき' : state.hp > 30 ? 'まあまあ げんき' : 'ちょっと つかれぎみ';
      return `${n} は ${mark}（たいりょく ${Math.round(state.hp)}）。${robotDays()}日目、レベル ${state.level} だよ`;
  }

  // 45びょうごとの おてつだい（もっている モジュールの ぶんだけ できる）
  function robotHelp() {
      if (state.stage === 'egg') return;

      if (has('robomed') && state.sick && state.coins >= MEDICINE_COST) {
          state.coins = big(state.coins) - big(MEDICINE_COST);
          state.sick = false;
          state.sickTimer = 0;
          state.hp = clamp(state.hp + 20, 0, 100);
          state.happy = clamp(state.happy + 8, 0, 100);
          state.stats.meds++;
          state.helps = (state.helps || 0) + 1;
          burst('star', 6);
          addLog(`🤖 ロボットが おくすりを のませて くれた！ (-${MEDICINE_COST}🪙)`);
          robotSay('だいじょうぶ、もう へいきだよ');
          return;
      }

      const f = FOODS.onigiri, cost = foodCost(f);
      if (has('roboarm') && state.hunger < 30 && state.coins >= cost) {
          state.coins = big(state.coins) - big(cost);
          state.hunger = clamp(state.hunger + f.hunger, 0, 100);
          state.happy = clamp(state.happy + f.happy, 0, 100);
          state.care.eat += f.eat;
          state.stats.meals++;
          state.helps = (state.helps || 0) + 1;
          state.poopTimer = Math.min(state.poopTimer, 45);
          burst('heart', 5);
          addLog(`🤖 ロボットが ${f.label} を あげてくれた！ (-${cost}🪙)`);
          robotSay('はい、どうぞ！ めしあがれ');
          return;
      }

      if (has('robosoap') && state.clean < 30) {
          state.clean = 100;
          state.happy = clamp(state.happy + 6, 0, 100);
          state.care.clean += 1;
          state.stats.baths++;
          state.helps = (state.helps || 0) + 1;
          burst('bubble', 8);
          addLog('🤖 ロボットが おふろに いれて くれた！ ぴかぴか！');
          robotSay('ごしごし〜 きれいに なったよ');
          return;
      }

      if (state.poops.length > 0) {
          state.poops.pop();
          state.clean = clamp(state.clean + 10, 0, 100);
          state.helps = (state.helps || 0) + 1;
          addLog('🤖 ロボットが おそうじして くれた！');
          robotSay('おそうじ、まかせて！');
      }
  }

  /* ---------------- talking ---------------- */

  let talkText = '';

  function openTalk() {
      if (!has('robot')) return;
      talkText = robotLine();
      robotSay(talkText, 5);
      renderTalk();
  }


  function talkTo(key: string) {
      const n = state.name;
      if (key === 'hi') talkText = `やっほー！ ${n} も よろこんでるよ`;
      else if (key === 'how') talkText = robotStatusTalk();
      else if (key === 'what') talkText = robotAdvice();
      else if (key === 'chat') talkText = randomChat();
      else talkText = 'どういたしまして！ また よんでね';

      state.stats.talks = (state.stats.talks || 0) + 1;
      // はなすと ちょっとだけ きげんが よくなる（れんぞくは 6びょうに 1かいまで）
      if (now() - (state.lastTalk || 0) > 6) {
          state.lastTalk = now();
          state.happy = clamp(state.happy + 2, 0, 100);
          burst('heart', 3);
      }
      robotSay(talkText, 5);
      renderTalk();
      save();
  }


  function renderTalk() {
      const btns = TALK_MENU.map(function (m) {
          return `<div class="game-btn blue mb-2" onclick="__pet.talkTo('${m.key}')">${m.label}</div>`;
      }).join('');

      let ask = `<div class="game-btn blue mb-3" onclick="__pet.openChat('robot')">💬 キーボードで おはなしする</div>`;
      if (canOrder()) {
          const chips = ORDER_CHIPS.map(function (c) {
              return `<div class="game-btn green" style="font-size:0.68rem;padding:7px 2px" onclick="__pet.sendOrder('${c[1]}')">${c[0]}</div>`;
          }).join('');
          ask += `<div class="text-xs font-bold text-gray-600 text-left mb-1">🎙 「〜して」と おねがい</div>
              <input id="order-input" value="${escAttr(orderDraft)}" placeholder="れい: ごはんを あげて"
                  oninput="__pet.setOrderDraft(this.value)"
                  onkeydown="__pet.if(event.key==='Enter'){__pet.sendOrder();}"
                  style="width:100%;box-sizing:border-box;font-family:inherit;font-size:0.95rem;padding:9px 10px;
                         border:3px solid #78350f;border-radius:12px;background:#fff;margin-bottom:6px">
              <div class="game-btn mb-2" onclick="__pet.sendOrder()">🎙 おねがい！</div>
              <div class="grid grid-cols-3 gap-1 mb-3">${chips}</div>`;
      } else {
          ask += `<div class="text-left text-xs mb-3" style="background:#fef3c7;border-radius:10px;padding:8px;line-height:1.6">
              🎙 ショップ（おへや）の <b>おねがいマイク</b>を かうと、<br>
              「ごはんを あげて」のように たのめるように なるよ！
          </div>`;
      }

      showModal(`
          <div class="font-bold text-lg mb-2">🤖 ロボットと おはなし</div>
          <div class="text-left text-sm mb-3" style="background:#e0f2fe;border-radius:12px;padding:10px;line-height:1.6">
              🤖「${talkText}」
          </div>
          ${ask}
          <div class="text-xs font-bold text-gray-600 text-left mb-1">💬 おしゃべり</div>
          ${btns}
          <div class="game-btn gray mt-1" onclick="__pet.hideModal()">またね</div>
      `);
  }

  /* ---------------- orders（「〜して」と おねがい） ---------------- */

  // たべものの よびかた（うしろの ものほど ざっくり）

  // 「〜して」の ことば → やること

  function canOrder() { return has('robot') && has('robomic'); }

  function findOrder(txt: string) {
      for (let i = 0; i < ORDERS.length; i++) {
          const o = ORDERS[i];
          for (let k = 0; k < o.words.length; k++) {
              if (txt.indexOf(o.words[k]) >= 0) return o.key;
          }
      }
      return null;
  }

  function foodFromText(txt: string) {
      for (let i = 0; i < FOOD_ALIAS.length; i++) {
          const pair = FOOD_ALIAS[i];
          for (let k = 0; k < pair[1].length; k++) {
              if (txt.indexOf(pair[1][k]) >= 0) return pair[0];
          }
      }
      return null;
  }

  // いま できる いちばん おだちんの いい おしごと
  function bestJob() {
      const ok = JOBS.filter(function (j) {
          return state.power >= j.minPower && state.level >= j.minLevel
              && state.energy >= j.energy && state.hunger >= j.hunger;
      });
      // sort は比べた結果を数として読む。bigint を返すと、そこで TypeError で止まる
      // （おしごとが2つ以上えらべる時だけ起きるので、これまで出ていなかった）。
      // でんせつの おしごとは 10 の 500 乗なので、Number にすると Infinity になるが、
      // 大小の向きは変わらないので並べ替えとしては正しい。
      ok.sort((a, b) => Number(jobPay(b) - jobPay(a)));
      return ok[0] || null;
  }

  // もっている あそびから ひとつ えらぶ
  function pickActivity() {
      const ok = ACTIVITIES.filter(function (a) {
          return actOk(a) && state.energy >= a.e && state.hunger >= a.hu;
      });
      return ok.length ? ok[Math.floor(Math.random() * ok.length)] : null;
  }

  let orderDraft = '';

  function setOrderDraft(v: string) { orderDraft = v; }

  // 入力を そのまま HTML に いれても こわれないように
  function escAttr(v: string) {
      return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
          .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function sendOrder(preset: string) {
      const box = el('order-input');
      const txt = (preset !== undefined ? preset : (box ? (box as HTMLInputElement).value : '')).trim();
      if (!txt) return;
      if (!canOrder()) {
          talkText = 'ショップの 🎙 おねがいマイクが あると おねがいを ききとれるよ';
          renderTalk();
          return;
      }
      orderDraft = '';
      addLog(`🗣「${escAttr(txt)}」`);
      const key = findOrder(txt);
      state.stats.orders = (state.stats.orders || 0) + 1;

      if (!key) {                                       // おねがいで なければ おしゃべりの へんじ
          talkText = chatAnswer(chatSpeaker('robot'), txt);
          robotSay(talkText);
          renderTalk();
          save();
          return;
      }
      if (state.stage === 'egg') {
          talkText = 'まだ たまごだよ。タップして あたためよう！';
          renderTalk();
          return;
      }
      hideModal();
      runOrder(key, txt);
      save();
  }

  function runOrder(key: string, txt: string) {
      const n = state.name;

      if (key === 'wake') {
          if (!state.sleeping) { addLog(`🤖「${n} は もう おきてるよ」`); robotSay(`${n} は もう おきてるよ`); return; }
          robotSay('はーい、おこして くるね！');
          toggleSleep();
          return;
      }
      if (key === 'sleep') {
          if (state.sleeping) { addLog(`🤖「${n} は もう ねてるよ」`); robotSay(`${n} は もう ねてるよ`); return; }
          robotSay('はーい、ねかしつけて くるね');
          toggleSleep();
          return;
      }
      if (state.sleeping && key !== 'report' && key !== 'status' && key !== 'shop' && key.indexOf('v-') !== 0) {
          addLog(`🤖「${n} は ねてるよ。おこして からに しよう？」`);
          robotSay(`${n} は ねてるよ。おこす？`);
          return;
      }

      if (key === 'med') {
          if (!state.sick) { addLog(`🤖「${n} は げんきだよ！ おくすりは いらないね」`); robotSay('げんきだから だいじょうぶ！'); return; }
          robotSay('おくすりを もってくるね');
          useMedicine();
          return;
      }
      if (key === 'bath') { robotSay('りょうかい！ おふろに いれるね'); doBath(); return; }
      if (key === 'clean') {
          if (state.poops.length === 0) { addLog('🤖「おへやは きれいだよ！」'); robotSay('おへやは きれいだよ！'); return; }
          robotSay('まかせて！ そうじ するね');
          doCleanPoop();
          return;
      }
      if (key === 'feed') {
          const want = foodFromText(txt);
          let k = want || 'rice';
          if (!want) {                                  // なにを たべるか いわれなかったら かえる ものを えらぶ
              const cheap = Object.keys(FOODS).filter(function (x) { return state.coins >= foodCost(FOODS[x]); })
                  .sort(function (a, b) { return FOODS[b].hunger - FOODS[a].hunger; });
              k = cheap.length ? (state.coins >= foodCost(FOODS.rice) ? 'rice' : cheap[0]) : 'rice';
          }
          if (state.coins < foodCost(FOODS[k])) {
              addLog(`🤖「コインが たりないよ…（${FOODS[k].label} は ${foodCost(FOODS[k])}🪙）」`);
              robotSay('コインが たりないみたい…');
              return;
          }
          robotSay(`${FOODS[k].label} を もってくるね！`);
          feed(k);
          return;
      }
      if (key === 'play') {
          const a = pickActivity();
          if (a) { robotSay(`${a.emoji} ${a.label}に しよう！`); doActivity(a.id); }
          else { robotSay('ボールで あそぼう！'); startPlay(); }
          return;
      }
      if (key === 'train') { robotSay('がんばれー！'); doTrain(); return; }
      if (key === 'study') {
          if (state.energy < 10 || state.hunger < 6) {
              addLog('🤖「げんきか おなかが たりないよ。やすませて あげよう」');
              robotSay('げんきか おなかが たりないよ');
              return;
          }
          robotSay('がっこうへ いこう！ べんきょう べんきょう');
          doActivity('study');
          return;
      }
      if (key === 'job') {
          const j = bestJob();
          if (!j) { addLog('🤖「いま できる おしごとが ないよ。げんきを ためよう」'); robotSay('いま できる おしごとが ないよ'); return; }
          robotSay(`${j.label} が よさそう！`);
          doJob(j.id);
          return;
      }
      if (key === 'bank') {
          robotSay('おかねの ばしょを ひらくね！');
          openBank();
          return;
      }
      if (key === 'friend') { robotSay('ともだちに あいに いこう！'); openFriends(); return; }
      if (key === 'map') { robotSay('どこに いこうか？'); openMap(); return; }
      if (key === 'shop') { robotSay('ショップを ひらくね'); openShop(); return; }
      if (key === 'report') { robotSay('レポートを だすね'); openReport(); return; }
      if (key === 'status') { robotSay('ずかんを ひらくね'); openStatus(); return; }
      if (key.indexOf('v-') === 0) {
          const v = key.slice(2);
          const VMAP: Record<string, string> = { out: 'out', park: 'park', liv: 'living', kit: 'kitchen', bed: 'bed' };
          const dest = VMAP[v] || v;
          robotSay(`${ROOM_LABEL[dest]}へ いこう！`);
          setView(dest);
          return;
      }
  }

  /* ---------------- growth ---------------- */

  function gainExp(n: number) {
      state.exp += Math.round(n * (has('notebook') ? 1.2 : 1) * (has('album') ? 1.15 : 1)
          * (has('planner') ? 1.15 : 1) * (has('dictionary') ? 1.2 : 1) * (has('atlas') ? 1.15 : 1) * infUp('exp'));
      let need = expNeeded(state.level);
      while (state.exp >= need) {
          state.exp -= need;
          state.level++;
          addCoins(20);
          addLog(`🎉 レベル ${state.level} に あがった！ (+20🪙)`);
          robotSay(`レベル ${state.level}！ おめでとう！`, 5);
          need = expNeeded(state.level);
      }
      checkEvolve();
  }

  function checkEvolve() {
      if (state.stage === 'baby' && state.level >= 4) {
          state.stage = 'child';
          addLog(`✨ ${state.name} は こどもに せいちょうした！`);
          burst('star', 18);
          setAction('happy', 2);
      } else if (state.stage === 'child' && state.level >= 9) {
          const c = state.care;
          const pairs: [string, number, string][] = [
              ['train', c.train, 'power'],
              ['play', c.play, 'cheer'],
              ['eat', c.eat, 'gourmet'],
              ['clean', c.clean, 'royal'],
          ];
          pairs.sort((a, b) => b[1] - a[1]);
          state.species = pairs[0][2];
          state.stage = 'adult';
          addLog(`✨ ${state.name} は 「${SPECIES[state.species ?? ''].name}」に しんかした！`);
          burst('star', 30);
          setAction('happy', 3);
      }
  }

  /* ---------------- actions ---------------- */

  function busy() {
      if (state.stage === 'egg') { addLog('たまごを タップして あたためよう！'); return true; }
      if (state.sleeping) { addLog(`${state.name} は ぐっすり ねむっている…`); return true; }
      return false;
  }

  function openFoodMenu() {
      if (busy()) return;
      const rows = Object.keys(FOODS).map((k) => {
          const f = FOODS[k];
          const cost = foodCost(f);
          const poor = state.coins < cost;
          return `<div class="game-btn ${poor ? 'disabled' : ''} mb-2" onclick="__pet.feed('${k}')">
              ${f.label}<span class="text-xs"> / ${cost}🪙</span></div>`;
      }).join('');
      showModal(`<div class="font-bold text-lg mb-3">なにを たべる？</div>${rows}
          <div class="game-btn gray mt-1" onclick="__pet.hideModal()">やめる</div>`);
  }

  function feed(key: string) {
      hideModal();
      if (busy()) return;
      const f = FOODS[key];
      const cost = foodCost(f);
      if (state.coins < cost) { addLog('コインが たりない…'); return; }
      if (state.hunger > 95) { addLog(`${state.name}「おなか いっぱいだよ〜」`); return; }

      state.coins = big(state.coins) - big(cost);
      state.hunger = clamp(state.hunger + f.hunger, 0, 100);
      state.happy = clamp(state.happy + f.happy, 0, 100);
      state.care.eat += f.eat;
      state.stats.meals++;
      state.poopTimer = Math.min(state.poopTimer, 45);
      setAction('eat', 3, key);
      burst('heart', 5);
      addLog(`${f.label} を たべた！ おいしそう。`);
      friendsJoin('たべた');
      robotSay('おいしそう だね！');
      gainExp(f.exp);
      save();
  }

  function openPlayMenu() {
      if (busy()) return;
      let html = `<div class="font-bold text-lg mb-1">🎾 なにして あそぶ？</div>
          <div class="text-xs text-gray-600 mb-3">かった ものが あると できる ことが ふえるよ</div>
          <div class="flex items-center gap-2 mb-2">
              <div class="text-left text-sm" style="flex:1">
                  <div class="font-bold">🎾 ボールキャッチ</div>
                  <div class="text-xs text-gray-500">げんき -12 / コインが もらえる</div>
              </div>
              <div style="width:38%"><div class="game-btn blue" onclick="__pet.startPlay()">する</div></div>
          </div>`;
      // いま この ばしょに いる ともだち
      friendsHere().forEach(function (f) {
          html += `<div class="flex items-center gap-2 mb-2">
              <div class="text-left text-sm" style="flex:1">
                  <div class="font-bold">👫 ${f.name} と あそぶ</div>
                  <div class="text-xs text-gray-500">げんき -6 / きげん +24 / なかよしが ふえる</div>
              </div>
              <div style="width:38%"><div class="game-btn pink" onclick="__pet.meetFriend('${f.id}')">する</div></div>
          </div>`;
      });

      // ばしょごとに まとめる（いま いる ばしょが いちばん うえ）
      const rooms: string[] = [];
      ACTIVITIES.forEach(function (a) { if (rooms.indexOf(a.room) < 0) rooms.push(a.room); });
      rooms.sort(function (x: string, y: string) {
          return (x === state.view ? -1 : 0) - (y === state.view ? -1 : 0);
      });

      const rowHtml = function (a: Activity) {
          const item = SHOP.filter(function (x) { return x.id === a.item; })[0];
          const owned = actOk(a);
          const tired = state.energy < a.e || state.hunger < a.hu;
          let note, btn;
          if (!owned) {
              note = `${item ? item.label : ''} が あると できる`;
              btn = `<div class="game-btn gray disabled">まだ できない</div>`;
          } else {
              note = `${ROOM_LABEL[a.room]}で / げんき -${a.e}`;
              if (a.fee) note += ` / ${a.fee}🪙`;
              if (a.cg) note += ` → きれい +${a.cg}`;
              if (a.cure) note += ' / びょうきが なおる';
              if (a.luck) note += ' / コインが もらえるかも';
              if (a.night) note += ' / よぞらに なる';
              if (a.eg) note += ` → げんき +${a.eg}`;
              if (a.hg) note += ` → おなか +${a.hg}`;
              if (a.hp) note += ` → たいりょく +${a.hp}`;
              if (a.pw) note += ` → ちから +${a.pw}`;
              if (a.c) note += ` / +${a.c}🪙`;
              btn = `<div class="game-btn ${tired ? 'disabled' : 'blue'}" onclick="__pet.doActivity('${a.id}')">する</div>`;
          }
          return `<div class="flex items-center gap-2 mb-2" style="${owned ? '' : 'opacity:0.55'}">
              <div class="text-left text-sm" style="flex:1">
                  <div class="font-bold">${a.emoji} ${a.label}</div>
                  <div class="text-xs text-gray-500">${note}</div>
              </div>
              <div style="width:38%">${btn}</div>
          </div>`;
      };

      rooms.forEach(function (r) {
          html += `<div class="text-xs font-bold text-left mt-3 mb-1" style="color:#78350f;border-bottom:2px solid #fcd34d">
              ${r === state.view ? '📍 ' : ''}${ROOM_LABEL[r]}</div>`;
          ACTIVITIES.filter(function (a) { return a.room === r; }).forEach(function (a) {
              html += rowHtml(a);
          });
      });
      html += `<div class="game-btn gray mt-2" onclick="__pet.hideModal()">やめる</div>`;
      showModal(html);
  }

  function doActivity(id: string) {
      hideModal();
      if (busy()) return;
      const a = ACTIVITIES.filter(function (x) { return x.id === id; })[0];
      if (!a || !actOk(a)) return;
      if (state.energy < a.e || state.hunger < a.hu) { addLog('げんきか おなかが たりない…'); return; }
      if (a.fee && state.coins < a.fee) { addLog(`コインが たりない…（${a.fee}🪙 かかるよ）`); return; }

      if (state.view !== a.room) {                     // やる ばしょへ いく
          state.view = a.room;
          petPos = petTarget();
          addLog(`🚶 ${ROOM_LABEL[a.room]}へ いった。`);
          updateUI();
      }

      if (a.fee) state.coins = big(state.coins) - big(a.fee);
      state.energy = clamp(state.energy - a.e + (a.eg || 0), 0, 100);
      state.hunger = clamp(state.hunger - a.hu + (a.hg || 0), 0, 100);
      state.happy = clamp(state.happy + a.h, 0, 100);
      state.clean = clamp(state.clean - (a.cl || 0) + (a.cg || 0), 0, 100);
      if (a.c) addCoins(a.c);
      if (a.cure && state.sick) {                      // びょういんで びょうきが なおる
          state.sick = false;
          state.sickTimer = 0;
          state.stats.meds++;
          addLog(`🏥 びょうきが なおった！`);
      }
      let luckWin = 0;
      if (a.luck) {                                    // おみくじ
          const roll = Math.random();
          luckWin = roll > 0.93 ? 500 : roll > 0.7 ? 120 : roll > 0.35 ? 30 : 0;
          const fortune = roll > 0.93 ? '大きち！' : roll > 0.7 ? 'ちゅうきち！' : roll > 0.35 ? 'しょうきち。' : 'きょう…';
          if (luckWin) addCoins(luckWin);
          addLog(`🎴 おみくじは 「${fortune}」${luckWin ? ` おまもり代 +${luckWin}🪙` : ' でも げんきに いこう！'}`);
      }
      if (a.hp) state.hp = clamp(state.hp + a.hp, 0, 100);
      if (a.pw) state.power += a.pw;
      state.care.play += 1;
      state.stats.acts++;
      setAction('activity', 2.8, a.id);
      burst('heart', 6);
      addLog(`${a.emoji} ${a.label}！ たのしかった${a.c ? `（+${a.c}🪙）` : ''}${a.fee ? `（-${a.fee}🪙）` : ''}`);
      friendsJoin(a.label);
      gainExp(a.x || 0);
      save();
  }

  function startPlay() {
      hideModal();
      if (busy()) return;
      if (state.energy < 10) { addLog(`${state.name} は つかれている… ねかせてあげよう。`); return; }
      if (state.hunger < 10) { addLog(`${state.name} は おなかが ぺこぺこだ…`); return; }
      mini.active = true;
      mini.pos = 0;
      mini.dir = 1;
      mini.speed = 0.75 + Math.min(0.9, state.level * 0.05);
      showModal(`
          <div class="font-bold text-lg mb-1">🎾 ボールキャッチ</div>
          <div class="text-xs mb-3 text-gray-600">まんなかで ストップ！</div>
          <div id="mini-track">
              <div id="mini-zone"></div>
              <div id="mini-perfect"></div>
              <div id="mini-marker" style="left:0%"></div>
          </div>
          <div class="game-btn blue mt-4" onclick="__pet.stopMini()">ストップ！</div>
      `, false);
  }

  function stopMini() {
      if (!mini.active) return;
      mini.active = false;
      hideModal();

      const d = Math.abs(mini.pos - 0.5);
      let coins, happy, label;
      if (d < 0.03) { coins = 30; happy = 26; label = 'パーフェクト！！'; }
      else if (d < 0.10) { coins = 18; happy = 18; label = 'グッド！'; }
      else if (d < 0.22) { coins = 10; happy = 12; label = 'まあまあ…'; }
      else { coins = 3; happy = 6; label = 'ざんねん…'; }

      addCoins(Math.round(coins * (has('bike') ? 1.3 : 1)));   // BigInt に なおして たされる
      state.happy = clamp(state.happy + happy * (has('tv') ? 1.3 : 1) * (has('game') ? 1.15 : 1) * (has('toybox') ? 1.1 : 1), 0, 100);
      state.energy = clamp(state.energy - 12, 0, 100);
      state.hunger = clamp(state.hunger - 8, 0, 100);
      state.clean = clamp(state.clean - 6, 0, 100);
      state.care.play += 1;
      state.stats.plays++;
      setAction('play', 2.5);
      burst('heart', 8);
      addLog(`${label} いっしょに あそんだ！ (+${coins}🪙)`);
      friendsJoin('あそんだ');
      gainExp(8);
      save();
  }

  function openJobMenu() {
      if (busy()) return;
      const rows = JOBS.map(function (j) {
          const lackPower = state.power < j.minPower;
          const lackLevel = state.level < j.minLevel;
          const tired = state.energy < j.energy || state.hunger < j.hunger;
          const ng = lackPower || lackLevel || tired;
          let why = '';
          if (lackPower) why = `ちから ${j.minPower} から`;
          else if (lackLevel) why = `レベル ${j.minLevel} から`;
          else if (tired) why = 'げんきか おなかが たりない';
          else why = `げんき -${j.energy} / おなか -${j.hunger}`;
          return `<div class="flex items-center gap-2 mb-2">
              <div class="text-left text-sm" style="flex:1">
                  <div class="font-bold">${j.label}</div>
                  <div class="text-xs text-gray-500">${why}</div>
              </div>
              <div style="width:40%">
                  <div class="game-btn ${ng ? 'disabled' : ''}" onclick="__pet.doJob('${j.id}')">${coinText(jobPay(j))}🪙 もらう</div>
              </div>
          </div>`;
      }).join('');
      showModal(`<div class="font-bold text-lg mb-1">💼 おしごと</div>
          <div class="text-xs text-gray-600 mb-3">ちからと レベルが あがると おだちんも ふえるよ</div>
          ${rows}
          <div class="game-btn gray mt-2" onclick="__pet.hideModal()">やめる</div>`);
  }

  function doJob(id: string) {
      hideModal();
      if (busy()) return;
      const j = JOBS.filter(function (x) { return x.id === id; })[0];
      if (!j) return;
      if (state.power < j.minPower) { addLog(`まだ ちからが たりない…`); return; }
      if (state.level < j.minLevel) { addLog(`まだ レベルが たりない…`); return; }
      if (state.energy < j.energy || state.hunger < j.hunger) { addLog(`げんきか おなかが たりない…`); return; }

      const pay = jobPay(j);
      state.energy = clamp(state.energy - j.energy, 0, 100);
      state.hunger = clamp(state.hunger - j.hunger, 0, 100);
      state.happy = clamp(state.happy - j.happy, 0, 100);
      state.clean = clamp(state.clean - 8, 0, 100);
      addCoins(pay);
      state.jobs = (state.jobs || 0) + 1;
      setAction('work', 2.5, id);
      burst('star', id === 'legend' ? 30 : 6);
      if (id === 'legend') addLog('🌌 うちゅうの おそうじを たのまれた…！');
      addLog(`${j.label} を がんばった！ おだちん ${coinText(pay)}🪙`);
      friendsJoin('おしごとを した');
      robotSay('おつかれさま！ よく はたらいたね');
      gainExp(10);
      save();
  }

  function doTrain() {
      if (busy()) return;
      if (state.energy < 20) { addLog(`げんきが たりない… やすませてあげよう。`); return; }
      if (state.hunger < 15) { addLog(`おなかが すいて トレーニングできない…`); return; }

      goPlace('park');                                  // こうえんまで あるいて いく
      state.energy = clamp(state.energy - 20, 0, 100);
      state.hunger = clamp(state.hunger - 12, 0, 100);
      state.happy = clamp(state.happy - 5, 0, 100);
      state.clean = clamp(state.clean - 10, 0, 100);
      state.power += 1;
      addCoins(8);
      state.care.train += 1;
      setAction('train', 2.5);
      burst('sweat', 6);
      addLog(`💪 こうえんで トレーニング！ ちからが ${state.power} に なった (+8🪙)`);
      friendsJoin('きたえた');
      gainExp(has('shelf') ? 20 : 15);
      save();
  }

  function doBath() {
      if (busy()) return;
      if (state.clean > 95) { addLog(`${state.name} は ぴかぴかだ！`); return; }
      state.clean = 100;
      state.happy = clamp(state.happy + (has('pool') ? 14 : 6) + (has('soap') ? 8 : 0)
          + (has('bigtowel') ? 6 : 0) + (has('bathsalt') ? 6 : 0), 0, 100);
      state.care.clean += 1;
      state.stats.baths++;
      setAction('bath', 3.5);
      burst('bubble', 12);
      addLog(`🛁 おふろで ごしごし！ ぴかぴかに なった。`);
      friendsJoin('おふろに はいった');
      robotSay('ぴかぴか！ きもち よさそう');
      gainExp(4);
      save();
  }

  function doCleanPoop() {
      if (busy()) return;
      if (state.poops.length === 0) { addLog('そうじする ところは なさそうだ。'); return; }
      const n = state.poops.length;
      state.poops = [];
      state.clean = has('vacuum') ? 100 : clamp(state.clean + 18 * n, 0, 100);
      state.happy = clamp(state.happy + 4, 0, 100);
      state.care.clean += 1;
      burst('bubble', 8);
      if (has('bin')) {
          const tip = 5 * n;
          addCoins(tip);
          addLog(`🧹 うんちを ${n}こ ゴミばこに すてた！ (+${tip}🪙)`);
      } else {
          addLog(`🧹 うんちを ${n}こ かたづけた！`);
      }
      friendsCopy('🧹');
      friendsJoin('おそうじを した');
      gainExp(3);
      save();
  }

  // おでかけさきで ペットが たつ ばしょ
  function isOutside() { return !state.view || !!OUTDOOR[state.view]; }
  function atPark() { return state.view === 'park'; }
  function atShop() { return state.view === 'shop'; }
  function atSchool() { return state.view === 'school'; }
  function inBedroom() { return state.view === 'bed'; }


  // おでかけマップに ならぶ ばしょ

  function petTarget() {
      if (PLACE_X[state.view]) return PLACE_X[state.view];
      if (isOutside()) return state.sleeping ? DOOR_X : 0.5;
      if (inBedroom()) return state.sleeping ? BED_X : IN_X;
      if (state.view === 'kitchen') return 0.74;      // ながしだいの まえは あけておく
      return IN_X;
  }

  function setView(v: string) {
      if (state.view === v) return;
      state.view = v;
      petPos = petTarget();            // ばしょが かわるので すぐ そこに立たせる
      addLog(OUT_NAME[v] || `🏠 ${ROOM_NAME[v]} に きた。`);
      save();
      updateUI();
  }

  // おでかけ（ねている ときや たまごの ときは うごかない）
  function goPlace(v: string) {
      if (state.stage === 'egg' || state.sleeping) return false;
      if (state.view !== v) setView(v);
      return true;
  }

  // 🗺 おでかけマップ
  function openMap() {
      let html = `<div class="font-bold text-lg mb-1">🗺 おでかけマップ</div>
          <div class="text-xs text-gray-600 mb-3">いきたい ところを タップしてね</div>`;
      PLACES.forEach(function (pl) {
          const here = (state.view || 'out') === pl.v;
          html += `<div class="flex items-center gap-2 mb-2">
              <div class="text-left text-sm" style="flex:1">
                  <div class="font-bold">${pl.icon} ${pl.name}${here ? '　📍いま ここ' : ''}</div>
                  <div class="text-xs text-gray-500">${pl.note}</div>
              </div>
              <div style="width:34%"><div class="game-btn ${here ? 'gray disabled' : 'green'}"
                  onclick="__pet.gotoPlace('${pl.v}')">${here ? 'いる' : 'いく'}</div></div>
          </div>`;
      });
      html += `<div class="game-btn gray mt-2" onclick="__pet.hideModal()">とじる</div>`;
      showModal(html);
  }

  function gotoPlace(v: string) {
      hideModal();
      if (state.sleeping) { addLog(`${state.name} は ねている… おこして からに しよう。`); return; }
      setView(v);
  }

  function toggleSleep() {
      if (state.stage === 'egg') return;
      if (state.sleeping) {
          state.sleeping = false;
          addLog(isOutside() ? `${state.name} が おうちから でてきた！` : `${state.name} が ベッドから おきた！`);
          robotSay('おはよう！ きょうも よろしくね', 5);
          friendsCopy('☀');
      } else {
          if (state.energy >= 98) {
              // げんきが まんタンだと すぐ おきてしまうので おうちに いれない
              addLog(`${state.name} は げんきいっぱいで ねむくないみたい。`);
              return;
          }
          if (state.view !== 'out' && isOutside()) {     // おでかけ さきからは おうちへ かえる
              state.view = 'out';
              petPos = 0.5;
              addLog(`🏠 ${state.name} は おうちへ かえってきた。`);
          }
          if (!isOutside() && !inBedroom()) {
              state.view = 'bed';                       // ベッドは 2かいに ある
              petPos = IN_X;
              addLog(`🛏 ${state.name} は 2かいへ ねに あがった。`);
          }
          state.sleeping = true;
          addLog(isOutside()
              ? `🏠 ${state.name} は おうちに はいって ねむりについた…`
              : `🛏 ${state.name} は ベッドに もぐりこんだ…`);
          robotSay(has('dock') ? 'おやすみ〜 ぼくも じゅうでん するね' : 'おやすみ〜 みまもってるよ', 5);
      }
      save();
      updateUI();
  }

  function useMedicine() {
      if (busy()) return;
      if (!state.sick) { addLog(`${state.name} は げんきだ！ おくすりは いらない。`); return; }
      if (state.coins < MEDICINE_COST) { addLog(`コインが たりない…（おくすりは ${MEDICINE_COST}🪙）`); return; }
      state.coins = big(state.coins) - big(MEDICINE_COST);
      state.sick = false;
      state.sickTimer = 0;
      state.hp = clamp(state.hp + 20, 0, 100);
      state.happy = clamp(state.happy + 8, 0, 100);
      state.stats.meds++;
      burst('star', 8);
      addLog(`💊 おくすりを のんだ。 びょうきが なおった！`);
      friendsCopy('💊');
      friendsJoin('おくすりを のんだ');
      robotSay('よかった… ひとあんしん だね');
      save();
  }

  let shopTab = 'room';
  let shopPage = 0;
  const SHOP_PER = 20;

  function shopGo(d: number) {
      shopPage += d;
      if (shopPage < 0) shopPage = 0;
      openShop();
  }

  function setShopTab(cat: string) {
      shopPage = 0;
      shopTab = cat;
      openShop();
  }

  function openShop() {
      goPlace('shop');                                  // おみせまで あるいて いく
      const allMine = state.infAll && state.furnAll && state.moreAll && SHOP.every(function (it) { return has(it.id); });
      let html = `<div class="font-bold text-lg mb-1">🛒 ショップ</div>
          <div class="text-sm font-bold text-amber-700 mb-2">もっているコイン ${coinText(state.coins)}🪙</div>
          <div class="game-btn ${allMine ? 'gray disabled' : 'pink'} mb-2"
              onclick="${allMine ? '' : '__pet.confirmGetAll()'}">🎁 ぜんぶ もらう（${allMine ? 'ぜんぶ そろった！' : SHOP.filter(function (it) { return has(it.id); }).length + '／' + SHOP.length}）</div>
          ${(state.infAll || allMine) ? `<div class="game-btn mb-2" style="background:#059669;border-bottom-color:#065f46"
              onclick="__pet.confirmShopReset()">🔁 また かえるように する</div>` : ''}
          <div class="grid grid-cols-3 gap-1 mb-3">`;
      SHOP_CAT.forEach(function (pair) {
          const cat = pair[0];
          if (cat === 'more') {
              html += `<div class="game-btn ${shopTab === cat ? '' : 'gray'}" onclick="__pet.setShopTab('${cat}')">
                  <div style="font-size:0.8em">${pair[1]}</div>
                  <div style="font-size:0.72em">${state.moreAll ? 'ぜんぶ' : moreCount() + 'こ'}</div></div>`;
              return;
          }
          if (cat === 'furn') {
              html += `<div class="game-btn ${shopTab === cat ? '' : 'gray'}" onclick="__pet.setShopTab('${cat}')">
                  <div style="font-size:0.8em">${pair[1]}</div>
                  <div style="font-size:0.72em">${state.furnAll ? 'ぜんぶ' : furnHave() + '/10ちょう'}</div></div>`;
              return;
          }
          if (cat === 'sweet') {
              html += `<div class="game-btn ${shopTab === cat ? '' : 'gray'}" onclick="__pet.setShopTab('${cat}')">
                  <div style="font-size:0.8em">${pair[1]}</div>
                  <div style="font-size:0.72em">${coinText(SWEET_TOTAL)}</div></div>`;
              return;
          }
          if (cat === 'inf') {
              html += `<div class="game-btn ${shopTab === cat ? '' : 'gray'}" onclick="__pet.setShopTab('${cat}')">
                  <div style="font-size:0.8em">${pair[1]}</div>
                  <div style="font-size:0.72em">${state.infAll ? 'ぜんぶ' : Object.keys(state.inf || {}).length + '/∞'}</div></div>`;
              return;
          }
          const list = SHOP.filter(function (it) { return it.cat === cat; });
          const mine = list.filter(function (it) { return has(it.id); }).length;
          html += `<div class="game-btn ${shopTab === cat ? '' : 'gray'}" onclick="__pet.setShopTab('${cat}')">
              <div style="font-size:0.8em">${pair[1]}</div>
              <div style="font-size:0.72em">${mine}/${list.length}</div></div>`;
      });
      html += `</div>`;
      if (shopTab === 'inf') html += infShopHtml();
      if (shopTab === 'sweet') html += sweetShopHtml();
      if (shopTab === 'furn') html += furnShopHtml();
      if (shopTab === 'more') html += moreShopHtml();
      SHOP_CAT.filter(function (pair) {
          return pair[0] === shopTab && pair[0] !== 'inf' && pair[0] !== 'sweet' && pair[0] !== 'furn' && pair[0] !== 'more';
      }).forEach(function (pair) {
          const cat = pair[0];
          const all = SHOP.filter(function (it) { return it.cat === cat; });
          const pages = Math.max(1, Math.ceil(all.length / SHOP_PER));
          if (shopPage >= pages) shopPage = pages - 1;
          if (pages > 1) {
              html += `<div class="text-xs font-bold text-gray-600 text-left mb-1">
                  ${all.length}こ / ページ ${shopPage + 1}／${pages}</div>`;
          }
          all.slice(shopPage * SHOP_PER, shopPage * SHOP_PER + SHOP_PER).forEach(function (it) {
              const owned = has(it.id);
              let btn;
              if (!owned) {
                  const poor = state.coins < it.cost;
                  btn = `<div class="game-btn ${poor ? 'disabled' : ''}" onclick="__pet.buyItem('${it.id}')">${it.cost}🪙 で かう</div>`;
              } else if (it.cat === 'wear') {
                  const on = isWorn(it.id);
                  btn = `<div class="game-btn ${on ? 'pink' : 'gray'}" onclick="__pet.wearItem('${it.id}')">${on ? 'はずす' : 'つける'}</div>`;
              } else if (it.cat === 'style') {
                  const on = styleUsed(it.id);
                  btn = `<div class="game-btn ${on ? 'pink' : 'gray'}" onclick="__pet.useStyle('${it.id}')">${on ? 'はがす' : 'はる'}</div>`;
              } else {
                  btn = `<div class="game-btn gray disabled">${it.deco ? 'おうちに あるよ' : 'もってる'}</div>`;
              }
              html += `<div class="flex items-center gap-2 mb-2">
                  <div class="text-left text-sm" style="flex:1">
                      <div class="font-bold">${it.label}</div>
                      <div class="text-xs text-gray-500">${it.note}</div>
                  </div>
                  <div style="width:38%">${btn}</div>
              </div>`;
          });
          if (pages > 1) {
              html += `<div class="grid grid-cols-3 gap-1 mb-2">
                  <div class="game-btn ${shopPage === 0 ? 'gray disabled' : 'gray'}" onclick="__pet.shopGo(-1)">◀ まえ</div>
                  <div class="game-btn green" onclick="__pet.shopGo(${pages - 1 - shopPage})">さいご ▶▶</div>
                  <div class="game-btn ${shopPage >= pages - 1 ? 'gray disabled' : 'gray'}" onclick="__pet.shopGo(1)">つぎ ▶</div>
              </div>`;
          }
          if (cat === 'style') {
              const used = SHOP.filter(function (it) { return it.cat === 'style' && styleUsed(it.id); }).length;
              html += `<div class="text-xs text-gray-500 text-left mb-2">おなじ めんに なんまいでも はれるよ（いま ${used}まい）</div>`;
              if (used > 0) html += `<div class="game-btn gray mb-2" onclick="__pet.peelAll()">ぜんぶ はがす</div>`;
          }
          if (cat === 'wear') {
              const wearing = SHOP.filter(function (it) { return it.cat === 'wear' && isWorn(it.id); }).length;
              html += `<div class="text-xs text-gray-500 text-left mb-2">いくつでも かさねて つけられるよ（いま ${wearing}こ）</div>`;
              if (wearing > 0) html += `<div class="game-btn gray mb-2" onclick="__pet.takeOffAll()">ぜんぶ はずす</div>`;
          }
      });
      html += `<div class="game-btn gray mt-3" onclick="__pet.hideModal()">とじる</div>`;
      showModal(html);
  }

  /* ---------------- 🎲 むげんショップ（10^120こ） ---------------- */




  function infOwned(i: bigint) { return !!state.infAll || !!(state.inf && state.inf[i.toString()]); }

  // もっている ふしぎな ものの かず（ぜんぶの ときは 10^120）
  function infHave() { return state.infAll ? coinText(INF_TOTAL) : String(Object.keys(state.inf || {}).length); }

  // もっている かずを こうかごとに かぞえる
  function infBonus(key: string) {
      if (state.infAll) return 999;                 // ぜんぶ もっている ときは さいだい
      if (!state.inf) return 0;
      let n = 0;
      Object.keys(state.inf).forEach(function (k) {
          try { if (infFx(BigInt(k)).key === key) n++; } catch (e) { /* こわれた キーは むし */ }
      });
      return n;
  }
  function infMul(key: string) { return Math.max(0.7, Math.pow(0.99, infBonus(key))); }
  function infUp(key: string) { return 1 + Math.min(50, infBonus(key)) * 0.01; }

  let infPage = 0n;
  let infDraft = '';

  function setInfDraft(v: string) { infDraft = v; }

  function infGo(dir: number) {
      const last = INF_TOTAL / INF_PER - 1n;
      infPage += BigInt(dir);
      if (infPage < 0n) infPage = 0n;
      if (infPage > last) infPage = last;
      openShop();
  }

  function infJump() {
      const box = el('inf-input');
      const raw = (box ? (box as HTMLInputElement).value : infDraft).replace(/[^0-9]/g, '').replace(/^0+/, '');
      if (!raw) { addLog('ばんごうを いれてね（れい: 12345）'); return; }
      let n = BigInt(raw);
      if (n >= INF_TOTAL) n = INF_TOTAL - 1n;
      infDraft = '';
      infPage = n / INF_PER;
      openShop();
  }

  function infRandom() {
      const len = INF_TOTAL.toString().length - 1;     // ばんごうの けたすう
      let d = String(1 + Math.floor(Math.random() * 8));
      for (let k = 1; k < len; k++) d += Math.floor(Math.random() * 10);
      infPage = BigInt(d) / INF_PER;
      openShop();
  }

  function buyInf(key: string) {
      const i = BigInt(key);
      if (infOwned(i)) return;
      const cost = big(infCost(i));
      if (state.coins < cost) { addLog('コインが たりない…'); return; }
      state.coins = big(state.coins) - cost;
      if (!state.inf) state.inf = {};
      state.inf[key] = true;
      burst('star', 6);
      addLog(`🎲 ${infEmoji(i)} ${infName(i)} No.${key} を かった！`);
      robotSay('めずらしい ものだね！');
      save();
      openShop();
  }

  // ショップの 🎲 タブ
  function infShopHtml() {
      const start = infPage * INF_PER;
      let html = `<div class="text-left text-xs mb-2" style="background:#ede9fe;border-radius:10px;padding:8px;line-height:1.6">
          🎲 <b>むげんショップ</b>には ${coinText(INF_TOTAL)}こ の しなものが あるよ！<br>
          ぜんぶ ちがう なまえと こうかを もっていて、ばんごうで さがせる。
          ${state.infAll ? '<br><b>いまは ぜんぶ もっているよ。</b>また かいたい ときは うえの 🔁 ボタン！' : ''}
      </div>
      <div class="text-xs font-bold text-gray-600 text-left mb-1">ページ ${coinText(infPage + 1n)}</div>`;
      for (let k = 0n; k < INF_PER; k++) {
          const i = start + k;
          if (i >= INF_TOTAL) break;
          const key = i.toString();
          const owned = infOwned(i);
          const cost = infCost(i);
          const poor = state.coins < big(cost);
          const btn = owned
              ? `<div class="game-btn gray disabled">おうちに あるよ</div>`
              : `<div class="game-btn ${poor ? 'disabled' : ''}" onclick="__pet.buyInf('${key}')">${cost}🪙 で かう</div>`;
          html += `<div class="flex items-center gap-2 mb-2">
              <div class="text-left text-sm" style="flex:1">
                  <div class="font-bold">${infEmoji(i)} ${infName(i)}</div>
                  <div class="text-xs text-gray-500">No.${key.length > 24 ? key.slice(0, 24) + '…' : key} / ${infFx(i).note}</div>
              </div>
              <div style="width:38%">${btn}</div>
          </div>`;
      }
      html += `<div class="grid grid-cols-3 gap-1 mb-2">
          <div class="game-btn gray" onclick="__pet.infGo(-1)">◀ まえ</div>
          <div class="game-btn green" onclick="__pet.infRandom()">🎲 ランダム</div>
          <div class="game-btn gray" onclick="__pet.infGo(1)">つぎ ▶</div>
      </div>
      <div class="text-xs font-bold text-gray-600 text-left mb-1">すきな ばんごうへ（なんけたでも）</div>
      <input id="inf-input" value="${escAttr(infDraft)}" placeholder="れい: 1000000" inputmode="numeric"
          oninput="__pet.setInfDraft(this.value)" onkeydown="__pet.if(event.key==='Enter'){__pet.infJump();}"
          style="width:100%;box-sizing:border-box;font-family:inherit;font-size:0.95rem;padding:9px 10px;
                 border:3px solid #78350f;border-radius:12px;background:#fff;margin-bottom:6px">
      <div class="game-btn mb-2" onclick="__pet.infJump()">🔎 その ばんごうへ</div>
      <div class="text-xs text-gray-500 text-left mb-2">もっている ふしぎな もの ${infHave()}こ</div>`;
      return html;
  }

  /* ---------------- 🍬 おかしやさん（9おくこ） ---------------- */




  let swPage = 0n;
  let swDraft = '';
  let sweetNow = '🍬';

  function setSwDraft(v: string) { swDraft = v; }

  function swGo(dir: number) {
      const last = SWEET_TOTAL / SW_PER - 1n;
      swPage += BigInt(dir);
      if (swPage < 0n) swPage = 0n;
      if (swPage > last) swPage = last;
      openShop();
  }

  function swJump() {
      const box = el('sw-input');
      const raw = (box ? (box as HTMLInputElement).value : swDraft).replace(/[^0-9]/g, '').replace(/^0+/, '');
      if (!raw) { addLog('ばんごうを いれてね（れい: 12345）'); return; }
      let n = BigInt(raw);
      if (n >= SWEET_TOTAL) n = SWEET_TOTAL - 1n;
      swDraft = '';
      swPage = n / SW_PER;
      openShop();
  }

  function swRandom() {
      swPage = BigInt(Math.floor(Math.random() * 900000000)) / SW_PER;
      openShop();
  }

  // かって そのばで たべる
  function eatSweet(key: string) {
      const i = BigInt(key);
      if (state.stage === 'egg') { addLog('たまごを タップして あたためよう！'); return; }
      const cost = big(sweetCost(i));
      if (state.coins < cost) { addLog('コインが たりない…'); return; }
      if (state.sleeping) {                       // ねていても おかしの においで おきる
          state.sleeping = false;
          addLog(`${state.name} は おかしの においで めをさました！`);
      }
      // おかしは べつばら！ おなかが いっぱいでも いつでも たべられる

      state.coins = big(state.coins) - cost;
      state.hunger = clamp(state.hunger + sweetHunger(i), 0, 100);
      state.happy = clamp(state.happy + sweetHappy(i), 0, 100);
      state.care.eat += 1;
      state.stats.meals++;
      state.stats.sweets = (state.stats.sweets || 0) + 1;
      state.poopTimer = Math.min(state.poopTimer, 45);
      sweetNow = sweetEmoji(i);
      setAction('eat', 3, '__sweet');
      burst('heart', 6);
      addLog(`${sweetEmoji(i)} ${sweetName(i)} を たべた！ おいしい〜（-${sweetCost(i)}🪙）`);
      friendsJoin('おかしを たべた');
      robotSay('おいしそう！ いい かおだね');
      gainExp(sweetExp(i));
      hideModal();
      save();
  }

  // ショップの 🍬 タブ
  function sweetShopHtml() {
      const start = swPage * SW_PER;
      let html = `<div class="text-left text-xs mb-2" style="background:#fce7f3;border-radius:10px;padding:8px;line-height:1.6">
          🍬 <b>おかしやさん</b>には ${coinText(SWEET_TOTAL)}こ の おかしが あるよ！<br>
          かうと その ばで たべられる。あじも おおきさも ぜんぶ ちがう。<br>
          <b>おなかが いっぱいでも、ねていても、いつでも たべられる</b>（べつばら！）
      </div>
      <div class="text-xs font-bold text-gray-600 text-left mb-1">ページ ${coinText(swPage + 1n)}</div>`;
      for (let k = 0n; k < SW_PER; k++) {
          const i = start + k;
          if (i >= SWEET_TOTAL) break;
          const key = i.toString();
          const cost = sweetCost(i);
          const poor = state.coins < big(cost);
          html += `<div class="flex items-center gap-2 mb-2">
              <div class="text-left text-sm" style="flex:1">
                  <div class="font-bold">${sweetEmoji(i)} ${sweetName(i)}</div>
                  <div class="text-xs text-gray-500">No.${key} / おなか +${sweetHunger(i)} / きげん +${sweetHappy(i)}</div>
              </div>
              <div style="width:40%"><div class="game-btn ${poor ? 'disabled' : 'pink'}"
                  onclick="__pet.eatSweet('${key}')">${cost}🪙 で たべる</div></div>
          </div>`;
      }
      html += `<div class="grid grid-cols-3 gap-1 mb-2">
          <div class="game-btn gray" onclick="__pet.swGo(-1)">◀ まえ</div>
          <div class="game-btn green" onclick="__pet.swRandom()">🎲 ランダム</div>
          <div class="game-btn gray" onclick="__pet.swGo(1)">つぎ ▶</div>
      </div>
      <div class="text-xs font-bold text-gray-600 text-left mb-1">すきな ばんごうへ（0〜${coinText(SWEET_TOTAL - 1n)}）</div>
      <input id="sw-input" value="${escAttr(swDraft)}" placeholder="れい: 1234567" inputmode="numeric"
          oninput="__pet.setSwDraft(this.value)" onkeydown="__pet.if(event.key==='Enter'){__pet.swJump();}"
          style="width:100%;box-sizing:border-box;font-family:inherit;font-size:0.95rem;padding:9px 10px;
                 border:3px solid #78350f;border-radius:12px;background:#fff;margin-bottom:6px">
      <div class="game-btn mb-2" onclick="__pet.swJump()">🔎 その ばんごうへ</div>
      <div class="text-xs text-gray-500 text-left mb-2">たべた おかし ${state.stats.sweets || 0}こ</div>`;
      return html;
  }

  /* ---------------- 🪑 かぐやさん（10兆こ） ---------------- */



  function furnOwned(i: bigint) { return !!state.furnAll || !!(state.furn && state.furn[i.toString()]); }
  function furnHave() { return state.furnAll ? coinText(FURN_TOTAL) : String(Object.keys(state.furn || {}).length); }

  let fuPage = 0n;
  let fuDraft = '';

  function setFuDraft(v: string) { fuDraft = v; }

  function fuGo(dir: number) {
      const last = FURN_TOTAL / FURN_PER - 1n;
      fuPage += BigInt(dir);
      if (fuPage < 0n) fuPage = 0n;
      if (fuPage > last) fuPage = last;
      openShop();
  }

  function fuJump() {
      const box = el('fu-input');
      const raw = (box ? (box as HTMLInputElement).value : fuDraft).replace(/[^0-9]/g, '').replace(/^0+/, '');
      if (!raw) { addLog('ばんごうを いれてね（れい: 12345）'); return; }
      let n = BigInt(raw);
      if (n >= FURN_TOTAL) n = FURN_TOTAL - 1n;
      fuDraft = '';
      fuPage = n / FURN_PER;
      openShop();
  }

  function fuRandom() {
      let d = String(1 + Math.floor(Math.random() * 9));
      for (let k = 1; k < 13; k++) d += Math.floor(Math.random() * 10);
      fuPage = BigInt(d) / FURN_PER;
      openShop();
  }

  function buyFurn(key: string) {
      const i = BigInt(key);
      if (furnOwned(i)) return;
      const cost = big(furnCost(i));
      if (state.coins < cost) { addLog('コインが たりない…'); return; }
      state.coins = big(state.coins) - cost;
      if (!state.furn) state.furn = {};
      state.furn[key] = true;
      decorDirty();
      burst('star', 6);
      addLog(`${furnEmoji(i)} ${furnName(i)} を かった！ おうちに かざった。`);
      robotSay('いい かぐだね！');
      friendsCopy('🪑');
      save();
      openShop();
  }

  // ショップの 🪑 タブ
  function furnShopHtml() {
      const start = fuPage * FURN_PER;
      let html = `<div class="text-left text-xs mb-2" style="background:#fef3c7;border-radius:10px;padding:8px;line-height:1.6">
          🪑 <b>かぐやさん</b>には ${coinText(FURN_TOTAL)}こ の かぐが あるよ！<br>
          かうと おうちに かざられて、みんなの きげんが へりにくくなる。
          ${state.furnAll ? '<br><b>いまは ぜんぶ もっているよ。</b>' : ''}
      </div>
      <div class="text-xs font-bold text-gray-600 text-left mb-1">ページ ${coinText(fuPage + 1n)}</div>`;
      for (let k = 0n; k < FURN_PER; k++) {
          const i = start + k;
          if (i >= FURN_TOTAL) break;
          const key = i.toString();
          const owned = furnOwned(i);
          const cost = furnCost(i);
          const poor = state.coins < big(cost);
          const btn = owned
              ? `<div class="game-btn gray disabled">おうちに あるよ</div>`
              : `<div class="game-btn ${poor ? 'disabled' : ''}" onclick="__pet.buyFurn('${key}')">${cost}🪙 で かう</div>`;
          html += `<div class="flex items-center gap-2 mb-2">
              <div class="text-left text-sm" style="flex:1">
                  <div class="font-bold">${furnEmoji(i)} ${furnName(i)}</div>
                  <div class="text-xs text-gray-500">No.${key}</div>
              </div>
              <div style="width:38%">${btn}</div>
          </div>`;
      }
      html += `<div class="grid grid-cols-3 gap-1 mb-2">
          <div class="game-btn gray" onclick="__pet.fuGo(-1)">◀ まえ</div>
          <div class="game-btn green" onclick="__pet.fuRandom()">🎲 ランダム</div>
          <div class="game-btn gray" onclick="__pet.fuGo(1)">つぎ ▶</div>
      </div>
      <div class="text-xs font-bold text-gray-600 text-left mb-1">すきな ばんごうへ（0〜${coinText(FURN_TOTAL - 1n)}）</div>
      <input id="fu-input" value="${escAttr(fuDraft)}" placeholder="れい: 1234567890" inputmode="numeric"
          oninput="__pet.setFuDraft(this.value)" onkeydown="__pet.if(event.key==='Enter'){__pet.fuJump();}"
          style="width:100%;box-sizing:border-box;font-family:inherit;font-size:0.95rem;padding:9px 10px;
                 border:3px solid #78350f;border-radius:12px;background:#fff;margin-bottom:6px">
      <div class="game-btn mb-2" onclick="__pet.fuJump()">🔎 その ばんごうへ</div>
      <div class="text-xs text-gray-500 text-left mb-2">もっている かぐ ${furnHave()}こ</div>`;
      return html;
  }

  /* ---------------- 🏬 おみせビル（デパート 9 ＋ タワー 19 ＋ モール 50 ＋ ひろば 3） ---------------- */




  // タワーの かいは 1かいめ 10^2000 から 2000けたずつ ふえていく

  /* 🌍 ワールドモール（50かい）。かいごとに「せかい」が あって、
     うる ものの しゅるいは 10この プールを じゅんばんに つかう。 */




  /* 🎉 ひろば（3かい）。3かい × 10^149こ ＝ ちょうど 3×10^149こ の ついかぶん。 */


  // ひろばは 3かい × 10^149こ ＝ ちょうど 3×10^149こ

  // ぜんぶ たすと いちばん おおきい かいで ほとんど きまるので 1.00×10^N に なる

  /* かずが 50まんけた にも なるので、BigInt に しないで「もじれつの まま」
     たしざん・わりざん・あまり を する。そうすると なんけたでも すぐ うごく。
     10^e は「1 の あとに 0 が e こ」なので、e けた までの かずが うっている。 */

  // さいごの 15けた だけ みれば たいてい すむので、ながい ばんごうでも すぐ おわる

  // ながい ばんごうは そのまま しまうと セーブが おもいので、みじかい かぎに する



  function moreBag(id: string) {
      if (!state.more) state.more = {};
      if (!state.more[id]) state.more[id] = {};
      return state.more[id];
  }
  function moreOwned(sh: MoreShop, num: string) { return !!state.moreAll || !!moreBag(sh.id)[moreKey(num)]; }
  function moreHave(sh: MoreShop) { return state.moreAll ? moreText(sh) : String(Object.keys(moreBag(sh.id)).length); }
  function moreCount() {
      if (state.moreAll) return MORE_FLOORS.length * 200;
      if (!state.more) return 0;
      let n = 0;
      MORE_FLOORS.forEach(function (sh) { n += Object.keys(moreBag(sh.id)).length; });
      return n;
  }

  let moreBld = 0;                       // いま みている たてもの
  let moreShop = 0;                      // いま みている かい
  let moreStart = '0';                   // いま みている ページの さいしょの ばんごう
  let moreDraft = '';

  function moreBldCur() { return MORE_BLD[moreBld]; }
  function moreCur() { return moreBldCur().floors[moreShop]; }

  function setMoreBld(k: number) { moreBld = k; moreShop = 0; moreStart = '0'; moreDraft = ''; openShop(); }
  function setMoreShop(k: number) { moreShop = k; moreStart = '0'; moreDraft = ''; openShop(); }
  function setMoreDraft(v: string) { moreDraft = v; }

  function moGo(dir: number) {
      const sh = moreCur();
      if (dir > 0) {
          const next = moAdd(moreStart, MORE_PER);
          moreStart = next.length > sh.exp ? moreLast(sh) : next;
      } else {
          moreStart = moSub(moreStart, MORE_PER);
      }
      openShop();
  }

  function moJump() {
      const box = el('mo-input');
      const raw = (box ? (box as HTMLInputElement).value : moreDraft).replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
      if (!raw) { addLog('ばんごうを いれてね（れい: 12345）'); return; }
      const sh = moreCur();
      moreDraft = '';
      moreStart = raw.length > sh.exp ? moreLast(sh) : moSub(raw, moMod(raw, MORE_PER));
      openShop();
  }

  function moRandom() {
      const digits = moreCur().exp;                        // 10^e なので e けた まで
      let d = String(1 + Math.floor(Math.random() * 9));
      for (let k = 1; k < digits; k++) d += Math.floor(Math.random() * 10);
      moreStart = moSub(d, moMod(d, MORE_PER));
      openShop();
  }

  // ページの なかの k ばんめを かう（ばんごうが ながくても だいじょうぶ）
  function buyMoreAt(k: number) {
      const sh = moreCur();
      const num = moAdd(moreStart, k);
      if (num.length > sh.exp || moreOwned(sh, num)) return;
      const cost = big(moreCost(num));
      if (state.coins < cost) { addLog('コインが たりない…'); return; }
      state.coins = big(state.coins) - cost;
      moreBag(sh.id)[moreKey(num)] = true;
      decorDirty();
      burst('star', 6);
      addLog(`${moreEmoji(sh, num)} ${moreName(sh, num)} を かった！ おうちに ふえたよ。`);
      robotSay('いい かいものだね！');
      friendsCopy(moreEmoji(sh, num));
      save();
      openShop();
  }

  function moreShopHtml() {
      const bld = moreBldCur();
      const sh = moreCur();
      let html = `<div class="text-left text-xs mb-2" style="background:#ffe4e6;border-radius:10px;padding:8px;line-height:1.6">
          🏬 <b>おみせビル</b>は 4とう だて（ぜんぶで ${MORE_FLOORS.length}かい）。
          しなものは ${MORE_TOTAL_TEXT}こ！<br>
          🎉 ひろばは あとから ふえた ${FES_TOTAL_TEXT}こ ぶんだよ。<br>
          いきたい たてものと かいを えらんでね。
          ${state.moreAll ? '<br><b>いまは ぜんぶ もっているよ。</b>' : ''}
      </div>
      <div class="grid grid-cols-2 gap-1 mb-2">`;
      MORE_BLD.forEach(function (b, k) {
          html += `<div class="game-btn ${moreBld === k ? '' : 'gray'}" onclick="__pet.setMoreBld(${k})">
              <div style="font-size:0.76em">${b.tab}</div>
              <div style="font-size:0.68em">${b.floors.length}かい だて</div></div>`;
      });
      html += `</div>
      <div class="grid grid-cols-3 gap-1 mb-2">`;
      bld.floors.forEach(function (s, k) {
          html += `<div class="game-btn ${moreShop === k ? '' : 'gray'}" onclick="__pet.setMoreShop(${k})">
              <div style="font-size:0.76em">${k + 1}かい</div>
              <div style="font-size:0.7em">${s.tab}</div>
              <div style="font-size:0.66em">${moreShortT(s)}</div></div>`;
      });
      html += `</div>
      <div class="text-left text-xs mb-2" style="background:#fef3c7;border-radius:10px;padding:8px;line-height:1.6">
          <b>${bld.title} ${moreShop + 1}かい ${sh.tab}</b>（${moreText(sh)}こ）<br>${sh.note}
      </div>
      <div class="text-xs font-bold text-gray-600 text-left mb-1">ページ ${moNumText(moAdd(moDiv(moreStart, MORE_PER), 1))}</div>`;

      for (let k = 0; k < MORE_PER; k++) {
          const num = moAdd(moreStart, k);
          if (num.length > sh.exp) break;               // 10^e は e+1 けた ＝ さいごの つぎ
          const owned = moreOwned(sh, num);
          const cost = moreCost(num);
          const poor = state.coins < big(cost);
          const btn = owned
              ? `<div class="game-btn gray disabled">おうちに あるよ</div>`
              : `<div class="game-btn ${poor ? 'disabled' : ''}" onclick="__pet.buyMoreAt(${k})">${cost}🪙 で かう</div>`;
          html += `<div class="flex items-center gap-2 mb-2">
              <div class="text-left text-sm" style="flex:1">
                  <div class="font-bold">${moreEmoji(sh, num)} ${moreName(sh, num)}</div>
                  <div class="text-xs text-gray-500">No.${num.length > 24 ? num.slice(0, 24) + '…' : num}</div>
              </div>
              <div style="width:38%">${btn}</div>
          </div>`;
      }
      html += `<div class="grid grid-cols-3 gap-1 mb-2">
          <div class="game-btn gray" onclick="__pet.moGo(-1)">◀ まえ</div>
          <div class="game-btn green" onclick="__pet.moRandom()">🎲 ランダム</div>
          <div class="game-btn gray" onclick="__pet.moGo(1)">つぎ ▶</div>
      </div>
      <div class="text-xs font-bold text-gray-600 text-left mb-1">すきな ばんごうへ（0〜${moreMaxText(sh)}）</div>
      <input id="mo-input" value="${escAttr(moreDraft)}" placeholder="れい: 1234567890" inputmode="numeric"
          oninput="__pet.setMoreDraft(this.value)" onkeydown="__pet.if(event.key==='Enter'){__pet.moJump();}"
          style="width:100%;box-sizing:border-box;font-family:inherit;font-size:0.95rem;padding:9px 10px;
                 border:3px solid #78350f;border-radius:12px;background:#fff;margin-bottom:6px">
      <div class="game-btn mb-2" onclick="__pet.moJump()">🔎 その ばんごうへ</div>
      <div class="text-xs text-gray-500 text-left mb-2">この かいで もっているの ${moreHave(sh)}こ ／ ビルぜんぶで ${state.moreAll ? MORE_TOTAL_TEXT : moreCount()}こ</div>`;
      return html;
  }

  /* ---------------- ぜんぶ もらう ---------------- */

  function confirmGetAll() {
      const left = SHOP.filter(function (it) { return !has(it.id); }).length;
      showModal(`
          <div class="font-bold text-lg mb-2">🎁 ぜんぶ もらう</div>
          <div class="text-left text-sm mb-3" style="background:#fef3c7;border-radius:12px;padding:10px;line-height:1.7">
              ショップの しなもの <b>${SHOP.length}ひん</b>を ぜんぶ もらえるよ！<br>
              （まだ もっていないのは ${left}ひん）<br>
              🎲 むげんショップの <b>${coinText(INF_TOTAL)}こ</b>も ぜんぶ ついてくる！<br>
              🪑 かぐやさんの <b>${coinText(FURN_TOTAL)}こ</b>も ぜんぶ ついてくる！<br>
              🏬 おみせビル 81かい ぶんの <b>${MORE_TOTAL_TEXT}こ</b>も ぜんぶ ついてくる！<br>
              コインは へらないよ。
          </div>
          <div class="game-btn pink mb-2" onclick="__pet.getAllItems()">🎁 ぜんぶ もらう！</div>
          <div class="game-btn gray" onclick="__pet.openShop()">やめる</div>
      `);
  }

  function getAllItems() {
      hideModal();
      if (!state.owned) state.owned = {};
      if (!state.inf) state.inf = {};
      SHOP.forEach(function (it) { state.owned[it.id] = true; });
      decorDirty();
      state.infAll = true;                          // ふしぎな ものも ぜんぶ
      for (let k = 0; k < 120; k++) state.inf[String(k)] = true;
      state.furnAll = true;                         // かぐも ぜんぶ
      state.moreAll = true;                         // デパートも ぜんぶ
      state.happy = clamp(state.happy + 20, 0, 100);
      burst('star', 20);
      addLog(`🎁 ショップの ${SHOP.length}ひんと ふしぎな もの ${coinText(INF_TOTAL)}こ、かぐ ${coinText(FURN_TOTAL)}こ、おみせビル ${MORE_TOTAL_TEXT}こを ぜんぶ てに いれた！`);
      robotSay('わあ！ ぜんぶ そろったね！', 6);
      save();
      openShop();
  }

  // ぜんぶ もらった あとで、また かえるように もどす
  function confirmShopReset() {
      showModal(`
          <div class="font-bold text-lg mb-2">🔁 また かえるように する</div>
          <div class="text-left text-sm mb-3" style="background:#fee2e2;border-radius:12px;padding:10px;line-height:1.7">
              いま もっている しなものを <b>ぜんぶ てばなして</b>、ショップで また かえるように するよ。<br>
              ・コインは へらないよ<br>
              ・ともだちや なかよしは そのまま<br>
              ・つけているもの／はっている もようも はずれるよ
          </div>
          <div class="game-btn pink mb-2" onclick="__pet.shopReset()">🔁 また かえるように する</div>
          <div class="game-btn gray" onclick="__pet.openShop()">やめる</div>
      `);
  }

  function shopReset() {
      hideModal();
      state.owned = {};
      state.worn = {};
      decorDirty();
      state.theme = {};
      state.inf = {};
      state.infAll = false;
      state.furn = {};
      state.furnAll = false;
      state.more = {};
      state.moreAll = false;
      addLog('🔁 しなものを ぜんぶ てばなした。また ショップで かえるよ！');
      robotSay('また かいものが たのしめるね！');
      save();
      openShop();
  }

  function buyItem(id: string) {
      const it = SHOP.filter(function (x) { return x.id === id; })[0];
      if (!it || has(id)) return;
      if (state.coins < it.cost) { addLog('コインが たりない…'); return; }
      state.coins = big(state.coins) - big(it.cost);
      friendsCopy('🛍');
      decorDirty();
      state.owned[id] = true;
      if (it.cat === 'wear') state.worn[id] = true;
      if (it.cat === 'style') {
          const slot = styleSlot(id);
          state.theme[slot] = styleList(slot).concat([id]);
      }
      burst('star', 10);
      addLog(`🛒 ${it.label} を かった！`);
      save();
      updateUI();
      openShop();
  }

  function wearItem(id: string) {
      if (!has(id)) return;
      const label = SHOP.filter(function (x) { return x.id === id; })[0].label;
      if (isWorn(id)) {
          delete state.worn[id];
          addLog(`${state.name} は ${label} を はずした。`);
      } else {
          state.worn[id] = true;
          addLog(`${state.name} は ${label} を つけた！`);
      }
      save();
      openShop();
  }

  function useStyle(id: string) {
      if (!has(id)) return;
      const slot = styleSlot(id);
      const label = SHOP.filter(function (x) { return x.id === id; })[0].label;
      const list = styleList(slot);
      const at = list.indexOf(id);
      if (at >= 0) {
          list.splice(at, 1);
          if (list.length) state.theme[slot] = list; else delete state.theme[slot];
          addLog(`${label} を はがした。`);
      } else {
          state.theme[slot] = list.concat([id]);
          addLog(`🎨 ${label} を はった！`);
      }
      save();
      openShop();
  }

  function peelAll() {
      state.theme = {};
      addLog('はってあった もようを ぜんぶ はがした。');
      save();
      openShop();
  }

  function takeOffAll() {
      state.worn = {};
      addLog(`${state.name} は みにつけていたものを ぜんぶ はずした。`);
      save();
      openShop();
  }

  /* ---------------- ちょきんばこ ---------------- */

  // いれられる かず（ショップで おおきく できる）
  function bankCap() {
      if (has('vault')) return 9000000000000000n;
      if (has('safe')) return 10000000n;
      if (has('bank')) return 10000n;
      return 0n;
  }

  // 1日（180びょう）ごとに つく りそく
  function bankRate() { return has('vault') ? 0.05 : has('safe') ? 0.04 : 0.03; }

  const ACCT_RATE = 0.02;                 // ぎんこうこうざの りそく（1日）

  // ぎんこうが つかえるか（まどぐちに いる か カードを もっている）
  function canUseAcct() { return state.view === 'bank' || has('vault'); }

  // つうちょうに かきこむ
  function bankNote(kind: string, amt: bigint) {
      if (!Array.isArray(state.bankLog)) state.bankLog = [];
      state.bankLog.unshift({ k: kind, a: amt, d: Math.floor(state.ageSec / DAY_SEC) });
      state.bankLog = state.bankLog.slice(0, 10);
  }

  function acctPut(which: string | bigint) {
      const amt = bmin(bankAmount('in', which), big(state.coins));   // ぎんこうは じょうげん なし
      if (amt <= 0n) { addLog('あずける コインが たりない…'); renderBank(); return; }
      state.coins = big(state.coins) - amt;
      state.bankAcct = big(state.bankAcct) + amt;
      bankNote('in', amt);
      burst('star', 4);
      addLog(`🏦 ${coinText(amt)}🪙 を ぎんこうに あずけた！`);
      robotSay('ぎんこうなら いくらでも あずけられるよ');
      save();
      renderBank();
  }

  function acctTake(which: string | bigint) {
      const amt = bmin(bankAmount('out', which), big(state.bankAcct));
      if (amt <= 0n) { addLog('こうざは からっぽ…'); renderBank(); return; }
      state.bankAcct = big(state.bankAcct) - amt;
      state.coins = big(state.coins) + amt;
      bankNote('out', amt);
      burst('heart', 3);
      addLog(`🏦 ぎんこうから ${coinText(amt)}🪙 おろした。`);
      save();
      renderBank();
  }

  let bankDraft = '';

  function setBankDraft(v: string) { bankDraft = v; }

  function bankAmount(kind: string, which: string | bigint) {
      const have = big(kind === 'in' ? state.coins : (bankTab === 'acct' ? state.bankAcct : state.savings));
      if (which === 'all') return have;
      if (which === 'half') return have / 2n;
      return big(which);
  }

  function bankPut(which: string | bigint) {
      const room = bankCap() - big(state.savings);
      const amt = bmin(bmin(bankAmount('in', which), big(state.coins)), room);
      if (amt <= 0n) {
          addLog(room <= 0n ? '🐷 ちょきんばこは もう いっぱい！' : 'いれる コインが たりない…');
          renderBank();
          return;
      }
      state.coins = big(state.coins) - amt;
      state.savings = big(state.savings) + amt;
      burst('star', 4);
      addLog(`🐷 ${coinText(amt)}🪙 を ちょきんばこに いれた！`);
      robotSay('しっかり ためようね！');
      save();
      renderBank();
  }

  function bankTake(which: string | bigint) {
      const amt = bmin(bankAmount('out', which), big(state.savings));
      if (amt <= 0n) { addLog('ちょきんばこは からっぽ…'); renderBank(); return; }
      state.savings = big(state.savings) - amt;
      state.coins = big(state.coins) + amt;
      burst('heart', 3);
      addLog(`🐷 ちょきんばこから ${coinText(amt)}🪙 だした。`);
      save();
      renderBank();
  }

  // にゅうりょくらんの かずを つかう
  function bankTyped(dir: string) {
      const box = el('bank-input');
      // なんけたでも いいように もじの まま つかう
      const raw = (box ? (box as HTMLInputElement).value : bankDraft).replace(/[^0-9]/g, '').replace(/^0+/, '');
      if (!raw) { addLog('かずを いれてね（れい: 500）'); return; }
      bankDraft = '';
      const n = big(raw);
      if (bankTab === 'acct') { if (dir === 'in') acctPut(n); else acctTake(n); }
      else if (dir === 'in') bankPut(n); else bankTake(n);
  }

  let bankTab = 'piggy';

  function setBankTab(v: string) { bankTab = v; renderBank(); }

  function openBank() {
      if (!has('bank')) bankTab = 'acct';                  // ちょきんばこが なければ ぎんこうから
      renderBank();
  }

  function renderBank() {
      const tabs = `<div class="grid grid-cols-2 gap-1 mb-3">
          <div class="game-btn ${bankTab === 'piggy' ? 'pink' : 'gray'}" onclick="__pet.setBankTab('piggy')">🐷 ちょきんばこ</div>
          <div class="game-btn ${bankTab === 'acct' ? '' : 'gray'}" onclick="__pet.setBankTab('acct')">🏦 ぎんこう</div>
      </div>`;
      showModal(tabs + (bankTab === 'acct' ? acctHtml() : piggyHtml()));
  }

  // 🐷 いえの ちょきんばこ
  function piggyHtml() {
      if (!has('bank')) {
          return `<div class="font-bold text-lg mb-2">🐷 ちょきんばこ</div>
              <div class="text-left text-sm mb-3" style="background:#fef3c7;border-radius:10px;padding:10px;line-height:1.6">
                  ショップ（リビング）の <b>🐷 ちょきんばこ</b>を かうと、おうちでも コインを ためられるよ！
              </div>
              <div class="game-btn gray" onclick="__pet.hideModal()">とじる</div>`;
      }
      const cap = bankCap();
      const pct = cap > 0n ? Math.min(100, Number(big(state.savings) * 100n / cap)) : 0;
      const nextUp = !has('safe') ? '🔐 きんこ を かうと 1000ばい ためられる！'
          : !has('vault') ? '💳 キャッシュカード が あれば どこでも ぎんこうが つかえる！'
          : 'ちょきんばこは さいだい！ おおきな おかねは ぎんこうへ';
      const puts = ([['+100', 100], ['+1000', 1000], ['はんぶん', 'half'], ['ぜんぶ', 'all']] as const)
          .map(function (b) { return `<div class="game-btn" onclick="__pet.bankPut(${typeof b[1] === 'number' ? b[1] : `'${b[1]}'`})">${b[0]}</div>`; }).join('');
      const takes = ([['-100', 100], ['-1000', 1000], ['はんぶん', 'half'], ['ぜんぶ', 'all']] as const)
          .map(function (b) { return `<div class="game-btn gray" onclick="__pet.bankTake(${typeof b[1] === 'number' ? b[1] : `'${b[1]}'`})">${b[0]}</div>`; }).join('');

      return `
          <div class="font-bold text-lg mb-1">🐷 ちょきんばこ</div>
          <div class="text-xs text-gray-600 mb-2">1日ごとに りそくが ${Math.round(bankRate() * 100)}% つくよ</div>
          <div style="background:#fce7f3;border-radius:14px;padding:10px" class="mb-3">
              <div class="text-2xl font-bold" style="color:#be185d">${coinText(state.savings)}🪙</div>
              <div class="bar-outer mt-1"><div class="bar-inner" style="width:${pct}%;background:#ec4899"></div></div>
              <div class="text-xs text-gray-600 mt-1">いれられる かず ${coinText(cap)}🪙 まで</div>
          </div>
          <div class="text-sm font-bold text-amber-700 mb-2">もっているコイン ${coinText(state.coins)}🪙</div>
          <div class="text-xs font-bold text-gray-600 text-left mb-1">🐷 ちょきんばこに いれる</div>
          <div class="grid grid-cols-4 gap-1 mb-2">${puts}</div>
          <div class="text-xs font-bold text-gray-600 text-left mb-1">💰 ちょきんばこから だす</div>
          <div class="grid grid-cols-4 gap-1 mb-3">${takes}</div>
          ${inputHtml()}
          <div class="text-xs text-left" style="background:#fef3c7;border-radius:10px;padding:8px">${nextUp}</div>
          <div class="game-btn gray mt-3" onclick="__pet.hideModal()">とじる</div>`;
  }

  // すきな かずの にゅうりょくらん
  function inputHtml() {
      return `<div class="text-xs font-bold text-gray-600 text-left mb-1">すきな かずだけ（なんえんでも）</div>
          <input id="bank-input" value="${escAttr(bankDraft)}" placeholder="れい: 12345" inputmode="numeric"
              oninput="__pet.setBankDraft(this.value)"
              onkeydown="__pet.if(event.key==='Enter'){__pet.bankTyped('in');}"
              style="width:100%;box-sizing:border-box;font-family:inherit;font-size:0.95rem;padding:9px 10px;
                     border:3px solid #78350f;border-radius:12px;background:#fff;margin-bottom:6px">
          <div class="grid grid-cols-2 gap-1 mb-3">
              <div class="game-btn" onclick="__pet.bankTyped('in')">あずける</div>
              <div class="game-btn gray" onclick="__pet.bankTyped('out')">おろす</div>
          </div>`;
  }

  // 🏦 ぎんこうの こうざ
  function acctHtml() {
      const here = canUseAcct();
      const book = (state.bankLog || []).map(function (e) {
          const label = e.k === 'in' ? '<span style="color:#0f766e">あずけた</span>'
              : e.k === 'out' ? '<span style="color:#be123c">おろした</span>'
              : '<span style="color:#a16207">りそく</span>';
          return `<div class="flex justify-between text-xs" style="border-bottom:1px dashed #d6d3d1;padding:4px 2px">
              <span>${e.d}日目　${label}</span><span class="font-bold">${e.k === 'out' ? '-' : '+'}${coinText(e.a)}🪙</span>
          </div>`;
      }).join('') || '<div class="text-xs text-gray-500" style="padding:6px">まだ なにも ないよ</div>';

      let ops;
      if (here) {
          const puts = ([['+1000', 1000], ['+1万', 10000], ['はんぶん', 'half'], ['ぜんぶ', 'all']] as const)
              .map(function (b) { return `<div class="game-btn" onclick="__pet.acctPut(${typeof b[1] === 'number' ? b[1] : `'${b[1]}'`})">${b[0]}</div>`; }).join('');
          const takes = ([['-1000', 1000], ['-1万', 10000], ['はんぶん', 'half'], ['ぜんぶ', 'all']] as const)
              .map(function (b) { return `<div class="game-btn gray" onclick="__pet.acctTake(${typeof b[1] === 'number' ? b[1] : `'${b[1]}'`})">${b[0]}</div>`; }).join('');
          ops = `<div class="text-xs font-bold text-gray-600 text-left mb-1">🏦 こうざに あずける</div>
              <div class="grid grid-cols-4 gap-1 mb-2">${puts}</div>
              <div class="text-xs font-bold text-gray-600 text-left mb-1">💵 こうざから おろす</div>
              <div class="grid grid-cols-4 gap-1 mb-3">${takes}</div>
              ${inputHtml()}`;
      } else {
          ops = `<div class="text-left text-sm mb-2" style="background:#fef3c7;border-radius:10px;padding:10px;line-height:1.6">
                  まどぐちは ぎんこうに あるよ。<b>おでかけマップ</b>から 🏦 ぎんこうへ いこう！<br>
                  （ショップの <b>💳 キャッシュカード</b>が あれば どこからでも つかえる）
              </div>
              <div class="game-btn green mb-3" onclick="__pet.gotoPlace('bank')">🏦 ぎんこうへ いく</div>`;
      }

      return `
          <div class="font-bold text-lg mb-1">🏦 ぎんこう</div>
          <div class="text-xs text-gray-600 mb-2">じょうげん なし！ 1日ごとに りそくが ${Math.round(ACCT_RATE * 100)}% つくよ</div>
          <div style="background:#ecfeff;border-radius:14px;padding:10px" class="mb-3">
              <div class="text-xs text-gray-600">こうざの ざんだか</div>
              <div class="text-2xl font-bold" style="color:#0e7490">${coinText(state.bankAcct || 0)}🪙</div>
          </div>
          <div class="text-sm font-bold text-amber-700 mb-2">もっているコイン ${coinText(state.coins)}🪙</div>
          ${ops}
          <div class="text-xs font-bold text-gray-600 text-left mb-1">📗 つうちょう</div>
          <div class="text-left mb-3" style="background:#fff;border:2px solid #d6d3d1;border-radius:10px;padding:4px">${book}</div>
          <div class="game-btn gray" onclick="__pet.hideModal()">とじる</div>`;
  }

  function openReport() {
      const c = state.care;
      const st = state.stats || { earned: 0n, acts: 0, meds: 0, sick: 0, meals: 0, plays: 0, baths: 0, talks: 0, orders: 0, interest: 0n };
      const days = Math.floor(state.ageSec / DAY_SEC);
      const total = Math.max(1, c.eat + c.play + c.train + c.clean);
      const ownedCount = SHOP.filter(function (i) { return has(i.id); }).length;
      const wornCount = SHOP.filter(function (i) { return i.cat === 'wear' && isWorn(i.id); }).length;
      const actCount = ACTIVITIES.filter(function (a) { return actOk(a); }).length;

      const bars = ([
          ['🍚 ごはん', c.eat, '#f97316'],
          ['🎾 あそび', c.play, '#3b82f6'],
          ['💪 きたえる', c.train, '#a855f7'],
          ['🫧 おそうじ', c.clean, '#38bdf8']
      ] as const).map(function (b) {
          const pct = Math.round(b[1] / total * 100);
          return `<div class="mb-2">
              <div class="flex justify-between text-xs font-bold"><span>${b[0]}</span><span>${b[1]}かい（${pct}%）</span></div>
              <div class="bar-outer"><div class="bar-inner" style="width:${pct}%;background:${b[2]}"></div></div>
          </div>`;
      }).join('');

      // そだてかたの しんだん
      const top = ([['ごはん', c.eat], ['あそび', c.play], ['トレーニング', c.train], ['おそうじ', c.clean]] as [string, number][])
          .sort((a, b) => b[1] - a[1])[0];
      let title;
      if (total < 8) title = 'まだ はじまったばかり。これから！';
      else if (st.sick === 0 && state.hp > 70) title = 'びょうき しらずの けんこうっこ！';
      else if (top[0] === 'トレーニング') title = 'きたえるのが だいすきな がんばりや！';
      else if (top[0] === 'ごはん') title = 'たべることが なにより すきな こ！';
      else if (top[0] === 'あそび') title = 'あそぶのが だいすきな げんきっこ！';
      else title = 'いつも きれいずきな しっかりもの！';

      showModal(`
          <div class="font-bold text-lg mb-1">📊 そだてかた レポート</div>
          <div class="text-xs text-gray-600 mb-3">${state.name} / ${currentSpecies().name} / ${days}日目</div>

          <div class="text-left text-sm mb-3" style="background:#fef3c7;border-radius:10px;padding:8px">
              <span class="font-bold">${title}</span>
          </div>

          <div class="text-xs font-bold text-gray-600 text-left mb-1">おせわの うちわけ</div>
          ${bars}

          <div class="text-xs font-bold text-gray-600 text-left mt-3 mb-1">これまでの きろく</div>
          <div class="text-left text-sm leading-6">
              ⭐ レベル ${state.level} ／ 💪 ちから ${state.power}<br>
              🍽 ごはんを あげた かず ${st.meals}<br>
              🎾 あそんだ かず ${st.plays + st.acts}（うち アイテム ${st.acts}）<br>
              🛁 おふろ ${st.baths} ／ 💊 おくすり ${st.meds} ／ 🤒 びょうき ${st.sick}<br>
              💼 おしごと ${state.jobs || 0}かい<br>
              👫 ともだち ${FRIENDS.filter(function (f) { return friendLv(f.id) > 0; }).length}／${FRIENDS.length}（なかよし ごうけい ${FRIENDS.reduce(function (a, f) { return a + friendLv(f.id); }, 0)}）<br>
              🏠 いっしょに すんでいる ともだち ${roomieCount()}／${FRIENDS.length}<br>
              🤖 ロボットの おてつだい ${state.helps || 0}かい ／ 💬 おしゃべり ${st.talks || 0}かい<br>
              🎙 ロボットへの おねがい ${st.orders || 0}かい<br>
              🪙 これまでに かせいだ コイン ${coinText(st.earned)}<br>
              🐷 ちょきん ${coinText(state.savings || 0)}／${coinText(bankCap())}<br>
              🏦 ぎんこうの こうざ ${coinText(state.bankAcct || 0)}（りそくで +${coinText(st.interest || 0)}）<br>
              🎲 ふしぎな もの ${infHave()}こ（ぜんぶで ${coinText(INF_TOTAL)}こ）<br>
              🍬 たべた おかし ${st.sweets || 0}こ（おみせには ${coinText(SWEET_TOTAL)}こ）<br>
              🪑 かぐ ${furnHave()}こ（おみせには ${coinText(FURN_TOTAL)}こ）<br>
              🏬 おみせビル ${state.moreAll ? MORE_TOTAL_TEXT : moreCount()}こ（おみせには ${MORE_TOTAL_TEXT}こ）<br>
              🛒 もちもの ${ownedCount}／${SHOP.length}（みにつけ ${wornCount}）<br>
              🎪 できる あそび ${actCount}／${ACTIVITIES.length}
          </div>

          <div class="text-xs text-gray-500 mt-3">いまの ようす: おなか ${Math.round(state.hunger)} / きげん ${Math.round(state.happy)} / きれい ${Math.round(state.clean)} / げんき ${Math.round(state.energy)} / たいりょく ${Math.round(state.hp)}</div>
          <div class="game-btn gray mt-3" onclick="__pet.hideModal()">とじる</div>
      `);
  }

  function openStatus() {
      const c = state.care;
      const sp = currentSpecies();
      showModal(`
          <div class="font-bold text-lg mb-2">📖 ${state.name} の ずかん</div>
          <div class="text-sm text-left leading-6">
              すがた：${sp.name}<br>
              レベル：${state.level}（つぎまで ${expNeeded(state.level) - state.exp}）<br>
              ねんれい：${Math.floor(state.ageSec / DAY_SEC)}日目<br>
              ちから：${state.power}<br>
              コイン：${coinText(state.coins)}🪙<br>
              <hr class="my-2">
              <span class="text-xs text-gray-600">おせわの きろく</span><br>
              🍚 ごはん ${c.eat} / 🎾 あそび ${c.play}<br>
              💪 きたえた ${c.train} / 🫧 おそうじ ${c.clean}<br>
              💼 おしごと ${state.jobs || 0}かい
          </div>
          <div class="text-xs text-gray-500 mt-2">ちからと レベルが あがると おしごとの おだちんが ふえるよ</div>
          <div class="text-xs text-gray-500 mt-3">Lv9で いちばん おおい おせわの すがたに しんかするよ</div>
          <div class="game-btn gray mt-3" onclick="__pet.hideModal()">とじる</div>
          <div class="game-btn pink mt-2" onclick="__pet.confirmReset()">🔄 さいしょから</div>
      `);
  }

  function confirmReset() {
      showModal(`
          <div class="font-bold text-lg mb-3">さいしょから はじめる？</div>
          <div class="text-sm mb-4 text-gray-600">いまの ペットの きろくは きえてしまうよ。</div>
          <div class="game-btn pink mb-2" onclick="__pet.hardReset()">はじめる</div>
          <div class="game-btn gray" onclick="__pet.hideModal()">やめる</div>
      `);
  }

  function hardReset() {
      hideModal();
      state = newState();
      particles = [];
      action = { type: null, until: 0, dur: 1, food: null };
      save();
      renderLog();
      updateUI();
  }

  /* ---------------- egg / naming ---------------- */

  function tapCanvas() {
      if (state.stage === 'egg') {
          state.tap++;
          setAction('shake', 0.4);
          if (state.tap >= 8) {
              hatch();
          } else if (state.tap % 3 === 0) {
              addLog('たまごが ぴくぴく うごいている…！');
          }
          return;
      }
      if (state.sleeping) return;
      state.happy = clamp(state.happy + 1, 0, 100);
      setAction('happy', 0.8);
      burst('heart', 2);
  }

  function hatch() {
      state.stage = 'baby';
      state.name = 'ベビモフ';
      burst('star', 24);
      setAction('happy', 2);
      addLog('🥚 たまごが われた！ ペットが うまれた！');
      save();
      showModal(`
          <div class="font-bold text-lg mb-2">たまごが かえった！</div>
          <div class="text-sm mb-3">なまえを つけてあげよう</div>
          <input id="name-input" maxlength="8" value="モフ" class="border-2 border-amber-700 rounded-lg px-3 py-2 text-center w-full mb-3">
          <div class="game-btn" onclick="__pet.decideName()">けってい</div>
      `, false);
      setTimeout(() => { const i = el('name-input'); if (i) i.focus(); }, 50);
  }

  function decideName() {
      const input = el('name-input');
      const box = input as HTMLInputElement | null;
      const v = box && box.value.trim() ? box.value.trim().slice(0, 8) : 'モフ';
      state.name = v;
      hideModal();
      addLog(`なまえは 「${v}」に きまった！ よろしくね。`);
      save();
      updateUI();
  }

  /* ---------------- modal ---------------- */

  function showModal(html: string, closable?: boolean) {
      el('modal').innerHTML = html;
      el('modal-back').style.display = 'flex';
      el('modal-back').dataset.closable = closable === false ? '0' : '1';
  }

  function hideModal() {
      el('modal-back').style.display = 'none';
  }

  /* ---------------- drawing ---------------- */

  function resize() {
      const w = canvas.clientWidth;
      const h = Math.round(w * 0.62);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function cw() { return canvas.width / (window.devicePixelRatio || 1); }
  function ch() { return canvas.height / (window.devicePixelRatio || 1); }

  function mood(): string {
      if (state.sleeping) return 'sleep';
      if (action.type === 'eat') return 'eat';
      if (action.type === 'happy' || action.type === 'play' || action.type === 'bath'
          || action.type === 'activity') return 'joy';
      if (action.type === 'train' || action.type === 'work') return 'train';
      if (state.sick) return 'sick';
      if (state.hp < 25 || state.hunger < 20 || state.happy < 20 || state.clean < 20) return 'sad';
      if (state.happy > 70) return 'joy';
      return 'normal';
  }

  // ねているとき と「ほしを みる」あいだは よるの えに する
  function isNight() {
      return state.sleeping || (action.type === 'activity' && action.food === 'star');
  }

  function ellipse(x: number, y: number, rx: number, ry: number) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
  }

  function drawBackground(t: number) {
      const W = cw(), H = ch();
      const night = isNight();
      const g = ctx.createLinearGradient(0, 0, 0, H);
      if (night) { g.addColorStop(0, '#1e293b'); g.addColorStop(1, '#334155'); }
      else { g.addColorStop(0, '#bae6fd'); g.addColorStop(1, '#e0f2fe'); }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      if (night) {
          ctx.fillStyle = '#fef9c3';
          ellipse(W * 0.18, H * 0.19, 16, 16);
          ctx.fillStyle = 'rgba(202,191,120,0.55)';
          ellipse(W * 0.18 - 5, H * 0.19 - 4, 3.5, 3);
          ellipse(W * 0.18 + 4, H * 0.19 + 3, 4.5, 3.5);
          ellipse(W * 0.18 + 5, H * 0.19 - 6, 2.5, 2);
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          for (let i = 0; i < 12; i++) {
              const x = (i * 97 % Math.round(W));
              const y = (i * 53 % Math.round(H * 0.55));
              ctx.fillRect(x, y, 2, 2);
          }
      } else {
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          const cx = (t * 12) % (W + 120) - 60;
          ellipse(cx, H * 0.2, 26, 14);
          ellipse(cx + 22, H * 0.2, 18, 11);
          ellipse(cx - 20, H * 0.22, 16, 10);
      }

      // 床
      ctx.fillStyle = night ? '#4c1d95' : '#86efac';
      ctx.fillRect(0, H * 0.76, W, H * 0.24);
      ctx.fillStyle = night ? '#5b21b6' : '#4ade80';
      ctx.fillRect(0, H * 0.76, W, 6);
  }

  // ---------------- こうえん ----------------
  function drawPark(t: number) {
      const W = cw(), H = ch(), s = W / 380;
      const night = isNight();
      const G = H * 0.76;                               // しばふの うえ
      const F = H * 0.965;                              // ペットの あしもと

      // とおくの き
      [0.03, 0.97].forEach(function (fx, i) {
          const x = W * fx, y = G + H * 0.02;
          ctx.fillStyle = night ? '#3f2d1a' : '#78350f';
          ctx.fillRect(x - 5 * s, y - 26 * s, 10 * s, 26 * s);
          ctx.fillStyle = night ? '#14532d' : (i ? '#16a34a' : '#22c55e');
          ellipse(x, y - 34 * s, 26 * s, 22 * s);
          ellipse(x - 14 * s, y - 26 * s, 16 * s, 13 * s);
          ellipse(x + 14 * s, y - 26 * s, 16 * s, 13 * s);
      });

      // さんぽみち
      ctx.fillStyle = night ? '#57534e' : '#e7d7b8';
      ctx.fillRect(0, H * 0.90, W, H * 0.05);
      ctx.fillStyle = night ? '#44403c' : '#d6c39c';
      ctx.fillRect(0, H * 0.90, W, 3 * s);

      // すべりだい（ひだり）
      const sx = W * 0.11, sy = G + H * 0.10;
      ctx.strokeStyle = night ? '#78716c' : '#94a3b8';
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(sx - 12 * s, sy); ctx.lineTo(sx - 12 * s, sy - 38 * s);
      ctx.moveTo(sx + 2 * s, sy); ctx.lineTo(sx + 2 * s, sy - 38 * s);
      ctx.stroke();
      for (let i = 0; i < 5; i++) {                     // はしご
          const yy = sy - 6 * s - i * 7 * s;
          ctx.beginPath(); ctx.moveTo(sx - 12 * s, yy); ctx.lineTo(sx + 2 * s, yy); ctx.stroke();
      }
      ctx.fillStyle = night ? '#7f1d1d' : '#ef4444';    // すべる ところ
      ctx.beginPath();
      ctx.moveTo(sx + 2 * s, sy - 40 * s);
      ctx.lineTo(sx + 12 * s, sy - 40 * s);
      ctx.lineTo(sx + 34 * s, sy - 2 * s);
      ctx.lineTo(sx + 24 * s, sy - 2 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = night ? '#991b1b' : '#f87171';
      ctx.fillRect(sx - 2 * s, sy - 44 * s, 16 * s, 5 * s);

      // ブランコ
      const bx = W * 0.29, by = G + H * 0.11;
      ctx.strokeStyle = night ? '#78716c' : '#64748b';
      ctx.lineWidth = 3.5 * s;
      ctx.beginPath();
      ctx.moveTo(bx - 22 * s, by); ctx.lineTo(bx - 6 * s, by - 40 * s);
      ctx.moveTo(bx + 22 * s, by); ctx.lineTo(bx + 6 * s, by - 40 * s);
      ctx.moveTo(bx - 8 * s, by - 40 * s); ctx.lineTo(bx + 8 * s, by - 40 * s);
      ctx.stroke();
      const sw = Math.sin(t * 1.6) * 5 * s;
      ctx.lineWidth = 1.6 * s;
      [-9, 6].forEach(function (q, i) {
          const ox = bx + q * s + (i ? -sw : sw);
          ctx.beginPath();
          ctx.moveTo(bx + q * s, by - 39 * s); ctx.lineTo(ox, by - 14 * s);
          ctx.moveTo(bx + (q + 6) * s, by - 39 * s); ctx.lineTo(ox + 6 * s, by - 14 * s);
          ctx.stroke();
          ctx.fillStyle = night ? '#78350f' : '#facc15';
          ctx.fillRect(ox - 2 * s, by - 14 * s, 10 * s, 3 * s);
      });

      // ふんすい（みぎ）
      const fx2 = W * 0.74, fy = G + H * 0.09;
      ctx.fillStyle = night ? '#475569' : '#cbd5e1';
      ellipse(fx2, fy, 30 * s, 10 * s);
      ctx.fillStyle = night ? '#1e3a5f' : '#7dd3fc';
      ellipse(fx2, fy - 1 * s, 25 * s, 7 * s);
      ctx.fillStyle = night ? '#475569' : '#e2e8f0';
      ctx.fillRect(fx2 - 4 * s, fy - 20 * s, 8 * s, 18 * s);
      ellipse(fx2, fy - 21 * s, 9 * s, 4 * s);
      ctx.strokeStyle = night ? '#38bdf8' : '#38bdf8';
      ctx.lineWidth = 2 * s;
      for (let i = 0; i < 4; i++) {                     // みずしぶき
          const a = (i / 4) * Math.PI * 2 + t * 0.6;
          ctx.beginPath();
          ctx.moveTo(fx2, fy - 24 * s);
          ctx.quadraticCurveTo(fx2 + Math.cos(a) * 12 * s, fy - 34 * s,
                               fx2 + Math.cos(a) * 20 * s, fy - 6 * s);
          ctx.stroke();
      }

      // ジャングルジム
      const jx = W * 0.90, jy = G + H * 0.12;
      ctx.strokeStyle = night ? '#0f766e' : '#14b8a6';
      ctx.lineWidth = 2.5 * s;
      for (let i = 0; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(jx - 24 * s + i * 16 * s, jy); ctx.lineTo(jx - 24 * s + i * 16 * s, jy - 40 * s);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(jx - 24 * s, jy - i * 13 * s); ctx.lineTo(jx + 24 * s, jy - i * 13 * s);
          ctx.stroke();
      }

      // すなば（てまえ ひだり）
      ctx.fillStyle = night ? '#78350f' : '#a16207';
      ctx.fillRect(W * 0.005, F - 16 * s, 62 * s, 5 * s);
      ctx.fillStyle = night ? '#78716c' : '#fde68a';
      ctx.fillRect(W * 0.005 + 3 * s, F - 12 * s, 56 * s, 11 * s);
      ctx.fillStyle = night ? '#7f1d1d' : '#ef4444';    // バケツ
      ctx.fillRect(W * 0.005 + 40 * s, F - 20 * s, 10 * s, 9 * s);

  }

  // ---------------- おでかけさきの けしき ----------------

  // じめんを ぬる
  function groundBand(top: number, col: string, edge: string, from?: number) {
      const W = cw(), H = ch(), s = W / 380;
      const f = (typeof from === 'number' ? from : 0.745);  // そらの したの みどりを けす
      ctx.fillStyle = col;
      ctx.fillRect(0, H * f, W, H * (1 - f));
      ctx.fillStyle = edge;
      ctx.fillRect(0, H * top, W, 4 * s);
  }

  // かんばん
  function signBoard(x: number, y: number, w: number, text: string, back: string, ink: string, s: number) {
      ctx.fillStyle = back;
      ctx.fillRect(x - w / 2, y - 15 * s, w, 15 * s);
      ctx.fillStyle = ink;
      ctx.font = 'bold ' + (9 * s) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(text, x, y - 4 * s);
  }

  // ならんだ まど
  function windowRow(x: number, y: number, n: number, gap: number, w: number, h: number, s: number, night: boolean) {
      for (let i = 0; i < n; i++) {
          ctx.fillStyle = night ? '#fde68a' : '#bae6fd';
          ctx.fillRect(x + i * gap, y, w, h);
          ctx.strokeStyle = night ? '#57534e' : '#94a3b8';
          ctx.lineWidth = 2 * s;
          ctx.strokeRect(x + i * gap, y, w, h);
      }
  }

  // 🏥 びょういん
  function drawHospital(t: number) {
      const W = cw(), H = ch(), s = W / 380;
      const night = isNight();
      groundBand(0.84, night ? '#44403c' : '#d4d4d8', night ? '#57534e' : '#e4e4e7');

      const L = W * 0.40, R = W * 0.99, top = H * 0.15, base = H * 0.86;
      ctx.fillStyle = night ? '#3f3f46' : '#f8fafc';
      ctx.fillRect(L, top, R - L, base - top);
      ctx.fillStyle = night ? '#27272a' : '#cbd5e1';
      ctx.fillRect(L, top - 8 * s, R - L, 10 * s);

      const cx = L + (R - L) * 0.16, cy = top + 30 * s;   // あかい じゅうじ
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cx - 5 * s, cy - 15 * s, 10 * s, 30 * s);
      ctx.fillRect(cx - 15 * s, cy - 5 * s, 30 * s, 10 * s);

      windowRow(L + (R - L) * 0.34, top + 14 * s, 4, (R - L) * 0.16, 22 * s, 18 * s, s, night);
      windowRow(L + (R - L) * 0.34, top + 42 * s, 4, (R - L) * 0.16, 22 * s, 18 * s, s, night);

      const dx = L + (R - L) * 0.55;                       // じどうドア
      ctx.fillStyle = night ? '#1c1917' : '#94a3b8';
      ctx.fillRect(dx - 26 * s, base - 40 * s, 52 * s, 40 * s);
      ctx.fillStyle = night ? '#334155' : '#e0f2fe';
      ctx.fillRect(dx - 22 * s, base - 36 * s, 19 * s, 34 * s);
      ctx.fillRect(dx + 3 * s, base - 36 * s, 19 * s, 34 * s);
      signBoard(dx, base - 46 * s, 66 * s, '🏥 びょういん', night ? '#334155' : '#fff', night ? '#e2e8f0' : '#dc2626', s);

      const ax = W * 0.12, ay = H * 0.93;                  // きゅうきゅうしゃ
      ctx.fillStyle = night ? '#cbd5e1' : '#fff';
      ctx.fillRect(ax - 34 * s, ay - 26 * s, 50 * s, 20 * s);
      ctx.fillRect(ax + 14 * s, ay - 20 * s, 18 * s, 14 * s);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(ax - 34 * s, ay - 16 * s, 50 * s, 4 * s);
      ctx.fillStyle = night ? '#334155' : '#bae6fd';
      ctx.fillRect(ax + 17 * s, ay - 17 * s, 12 * s, 8 * s);
      ctx.fillStyle = '#1f2937';
      ellipse(ax - 22 * s, ay - 5 * s, 6 * s, 6 * s);
      ellipse(ax + 20 * s, ay - 5 * s, 6 * s, 6 * s);
      ctx.fillStyle = (Math.sin(t * 5) > 0 ? '#ef4444' : '#38bdf8');
      ellipse(ax - 10 * s, ay - 29 * s, 5 * s, 4 * s);
      ctx.textAlign = 'center';
  }

  // 🏖 うみ
  function drawBeach(t: number) {
      const W = cw(), H = ch(), s = W / 380;
      const night = isNight();

      ctx.fillStyle = night ? '#0c4a6e' : '#0ea5e9';       // うみ
      ctx.fillRect(0, H * 0.55, W, H * 0.30);
      ctx.fillStyle = night ? '#075985' : '#38bdf8';
      ctx.fillRect(0, H * 0.55, W, H * 0.06);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';          // なみ
      ctx.lineWidth = 2.5 * s;
      for (let r = 0; r < 4; r++) {
          ctx.beginPath();
          const yy = H * (0.62 + r * 0.055);
          for (let x = -20; x <= W + 20; x += 14 * s) {
              ctx.lineTo(x, yy + Math.sin((x / (18 * s)) + t * 1.4 + r) * 2.5 * s);
          }
          ctx.stroke();
      }
      groundBand(0.845, night ? '#78716c' : '#fde68a', night ? '#57534e' : '#fcd34d', 0.845);
      ctx.fillStyle = night ? '#57534e' : '#fef3c7';       // なみうちぎわ
      ctx.fillRect(0, H * 0.845, W, 8 * s);

      const px = W * 0.90, py = H * 0.87;                  // やしのき
      ctx.fillStyle = night ? '#3f2d1a' : '#a16207';
      ctx.fillRect(px - 4 * s, py - 60 * s, 8 * s, 60 * s);
      ctx.fillStyle = night ? '#14532d' : '#16a34a';
      ([[-1, -0.3], [1, -0.3], [-0.7, -1], [0.7, -1]] as const).forEach(function (d) {
          ctx.beginPath();
          ctx.moveTo(px, py - 60 * s);
          ctx.quadraticCurveTo(px + d[0] * 22 * s, py - 60 * s + d[1] * 16 * s,
                               px + d[0] * 46 * s, py - 50 * s + d[1] * 10 * s);
          ctx.quadraticCurveTo(px + d[0] * 24 * s, py - 58 * s + d[1] * 12 * s, px, py - 56 * s);
          ctx.closePath();
          ctx.fill();
      });
      ctx.fillStyle = night ? '#78350f' : '#f59e0b';
      ellipse(px - 6 * s, py - 56 * s, 4 * s, 4 * s);
      ellipse(px + 6 * s, py - 57 * s, 4 * s, 4 * s);

      const ux = W * 0.14, uy = H * 0.94;                  // パラソル
      ctx.fillStyle = night ? '#57534e' : '#e2e8f0';
      ctx.fillRect(ux - 2 * s, uy - 46 * s, 4 * s, 46 * s);
      for (let i = 0; i < 6; i++) {
          ctx.fillStyle = (i % 2 ? (night ? '#7f1d1d' : '#ef4444') : (night ? '#e2e8f0' : '#fff'));
          ctx.beginPath();
          ctx.moveTo(ux, uy - 48 * s);
          ctx.arc(ux, uy - 48 * s, 30 * s, Math.PI + i * (Math.PI / 6), Math.PI + (i + 1) * (Math.PI / 6));
          ctx.closePath();
          ctx.fill();
      }
      ctx.fillStyle = night ? '#7f1d1d' : '#f472b6';       // ビーチボール
      ellipse(W * 0.30, H * 0.955 + Math.sin(t * 2) * 3 * s, 10 * s, 10 * s);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(W * 0.30, H * 0.955 + Math.sin(t * 2) * 3 * s);
      ctx.arc(W * 0.30, H * 0.955 + Math.sin(t * 2) * 3 * s, 10 * s, -0.4, 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.textAlign = 'center';
  }

  // ⛰ やま
  function drawMountain(t: number) {
      const W = cw(), H = ch(), s = W / 380;
      const night = isNight();

      ([[0.22, 0.30, night ? '#3730a3' : '#a5b4fc'], [0.62, 0.24, night ? '#4338ca' : '#818cf8'],
       [0.90, 0.28, night ? '#3730a3' : '#a5b4fc']] as const).forEach(function (m) {  // とおくの やま
          ctx.fillStyle = m[2];
          ctx.beginPath();
          ctx.moveTo(W * m[0] - W * 0.26, H * 0.80);
          ctx.lineTo(W * m[0], H * (0.80 - m[1]));
          ctx.lineTo(W * m[0] + W * 0.26, H * 0.80);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = night ? '#e0e7ff' : '#fff';       // ゆき
          ctx.beginPath();
          ctx.moveTo(W * m[0] - W * 0.06, H * (0.80 - m[1] * 0.66));
          ctx.lineTo(W * m[0], H * (0.80 - m[1]));
          ctx.lineTo(W * m[0] + W * 0.06, H * (0.80 - m[1] * 0.66));
          ctx.closePath();
          ctx.fill();
      });
      groundBand(0.80, night ? '#14532d' : '#4ade80', night ? '#166534' : '#22c55e', 0.80);
      ctx.fillStyle = night ? '#57534e' : '#d6c39c';       // やまみち
      ctx.beginPath();
      ctx.moveTo(0, H * 0.99);
      ctx.quadraticCurveTo(W * 0.4, H * 0.90, W, H * 0.86);
      ctx.lineTo(W, H * 0.95);
      ctx.quadraticCurveTo(W * 0.4, H * 0.97, 0, H);
      ctx.closePath();
      ctx.fill();

      [0.06, 0.30, 0.84, 0.96].forEach(function (fx, i) {  // すぎの き
          const x = W * fx, y = H * 0.86 - (i % 2) * H * 0.02;
          ctx.fillStyle = night ? '#3f2d1a' : '#78350f';
          ctx.fillRect(x - 4 * s, y - 14 * s, 8 * s, 14 * s);
          ctx.fillStyle = night ? '#14532d' : '#15803d';
          for (let k = 0; k < 3; k++) {
              ctx.beginPath();
              ctx.moveTo(x - (18 - k * 4) * s, y - (10 + k * 12) * s);
              ctx.lineTo(x, y - (28 + k * 12) * s);
              ctx.lineTo(x + (18 - k * 4) * s, y - (10 + k * 12) * s);
              ctx.closePath();
              ctx.fill();
          }
      });

      const gx = W * 0.62, gy = H * 0.90;                  // ちょうてんの ひょうしき
      ctx.fillStyle = night ? '#57534e' : '#78350f';
      ctx.fillRect(gx - 2 * s, gy - 26 * s, 4 * s, 26 * s);
      signBoard(gx + 10 * s, gy - 26 * s, 46 * s, '⛰ さんちょう', night ? '#334155' : '#fef3c7', night ? '#e2e8f0' : '#78350f', s);
      ctx.textAlign = 'center';
  }

  // 🎡 ゆうえんち
  function drawFun(t: number) {
      const W = cw(), H = ch(), s = W / 380;
      const night = isNight();
      groundBand(0.84, night ? '#4c1d95' : '#a78bfa', night ? '#5b21b6' : '#8b5cf6');

      const fx = W * 0.76, fy = H * 0.52, rr = W * 0.20;   // かんらんしゃ
      ctx.strokeStyle = night ? '#94a3b8' : '#e2e8f0';
      ctx.lineWidth = 4 * s;
      ctx.beginPath(); ctx.arc(fx, fy, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 2 * s;
      for (let i = 0; i < 8; i++) {
          const a = t * 0.25 + i * Math.PI / 4;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(fx + Math.cos(a) * rr, fy + Math.sin(a) * rr);
          ctx.stroke();
          ctx.fillStyle = ['#ef4444', '#f59e0b', '#22c55e', '#38bdf8'][i % 4];
          ellipse(fx + Math.cos(a) * rr, fy + Math.sin(a) * rr, 7 * s, 7 * s);
      }
      ctx.fillStyle = night ? '#475569' : '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(fx - 16 * s, H * 0.87); ctx.lineTo(fx - 3 * s, fy);
      ctx.lineTo(fx + 3 * s, fy); ctx.lineTo(fx + 16 * s, H * 0.87);
      ctx.closePath(); ctx.fill();

      const cx = W * 0.22, cy = H * 0.80;                  // コースターの レール
      ctx.strokeStyle = night ? '#7f1d1d' : '#f87171';
      ctx.lineWidth = 3.5 * s;
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.quadraticCurveTo(cx, cy - H * 0.22, W * 0.44, cy);
      ctx.stroke();
      // レールの うえの ばしょ（にじきょくせん）
      const railAt = function (u: number) {
          const iu = 1 - u;
          return [2 * iu * u * cx + u * u * W * 0.44,
                  iu * iu * cy + 2 * iu * u * (cy - H * 0.22) + u * u * cy];
      };
      ctx.lineWidth = 2.5 * s;                             // レールの あし
      for (let i = 1; i < 5; i++) {
          const pt = railAt(i / 5);
          ctx.beginPath();
          ctx.moveTo(pt[0], pt[1]); ctx.lineTo(pt[0], H * 0.88);
          ctx.stroke();
      }
      ctx.lineWidth = 3.5 * s;
      const car = railAt((t * 0.35) % 1);                  // はしる くるま
      ctx.fillStyle = night ? '#fbbf24' : '#fde047';
      ctx.fillRect(car[0] - 7 * s, car[1] - 9 * s, 14 * s, 9 * s);
      ctx.fillStyle = night ? '#57534e' : '#334155';
      ellipse(car[0] - 4 * s, car[1], 2.5 * s, 2.5 * s);
      ellipse(car[0] + 4 * s, car[1], 2.5 * s, 2.5 * s);

      ctx.strokeStyle = night ? '#a78bfa' : '#c4b5fd';     // フラッグ
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(0, H * 0.90); ctx.quadraticCurveTo(W * 0.25, H * 0.86, W * 0.5, H * 0.90);
      ctx.stroke();
      for (let i = 0; i < 7; i++) {
          const xx = W * (0.04 + i * 0.07);
          const yy = H * 0.90 - Math.sin((i / 7) * Math.PI) * H * 0.035;
          ctx.fillStyle = ['#ef4444', '#f59e0b', '#22c55e', '#38bdf8', '#ec4899'][i % 5];
          ctx.beginPath();
          ctx.moveTo(xx, yy); ctx.lineTo(xx + 7 * s, yy + 5 * s); ctx.lineTo(xx, yy + 11 * s);
          ctx.closePath(); ctx.fill();
      }
      ctx.textAlign = 'center';
  }

  // 🐘 どうぶつえん
  function drawZoo(t: number) {
      const W = cw(), H = ch(), s = W / 380;
      const night = isNight();
      groundBand(0.82, night ? '#3f6212' : '#86efac', night ? '#4d7c0f' : '#4ade80');

      ctx.strokeStyle = night ? '#57534e' : '#a16207';     // さく
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(0, H * 0.86); ctx.lineTo(W, H * 0.86);
      ctx.moveTo(0, H * 0.92); ctx.lineTo(W, H * 0.92);
      ctx.stroke();
      for (let x = 0; x < W; x += 26 * s) {
          ctx.beginPath(); ctx.moveTo(x, H * 0.84); ctx.lineTo(x, H * 0.95); ctx.stroke();
      }

      const ex = W * 0.20, ey = H * 0.84;                  // ぞう
      ctx.fillStyle = night ? '#475569' : '#94a3b8';
      ellipse(ex, ey - 22 * s, 30 * s, 20 * s);
      ellipse(ex - 26 * s, ey - 30 * s, 16 * s, 15 * s);
      ctx.fillRect(ex - 20 * s, ey - 8 * s, 8 * s, 10 * s);
      ctx.fillRect(ex + 12 * s, ey - 8 * s, 8 * s, 10 * s);
      ctx.fillStyle = night ? '#334155' : '#cbd5e1';
      ellipse(ex - 18 * s, ey - 30 * s, 10 * s, 12 * s);
      ctx.fillStyle = night ? '#475569' : '#94a3b8';
      ctx.beginPath();                                     // はな
      ctx.moveTo(ex - 34 * s, ey - 28 * s);
      ctx.quadraticCurveTo(ex - 46 * s, ey - 16 * s + Math.sin(t * 2) * 4 * s, ex - 40 * s, ey - 4 * s);
      ctx.lineTo(ex - 33 * s, ey - 6 * s);
      ctx.quadraticCurveTo(ex - 38 * s, ey - 16 * s, ex - 30 * s, ey - 26 * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1f2937';
      ellipse(ex - 30 * s, ey - 34 * s, 2 * s, 2 * s);

      const gx = W * 0.86, gy = H * 0.84;                  // きりん
      ctx.fillStyle = night ? '#a16207' : '#fbbf24';
      ellipse(gx, gy - 26 * s, 22 * s, 15 * s);
      ctx.fillRect(gx + 6 * s, gy - 66 * s, 9 * s, 42 * s);
      ellipse(gx + 12 * s, gy - 68 * s, 11 * s, 8 * s);
      ctx.fillStyle = night ? '#78350f' : '#b45309';
      ellipse(gx - 8 * s, gy - 28 * s, 5 * s, 4 * s);
      ellipse(gx + 6 * s, gy - 22 * s, 5 * s, 4 * s);
      ctx.fillStyle = '#1f2937';
      ellipse(gx + 16 * s, gy - 70 * s, 1.8 * s, 1.8 * s);
      ctx.fillRect(gx + 4 * s, gy - 12 * s, 5 * s, 12 * s);
      ctx.fillRect(gx - 12 * s, gy - 12 * s, 5 * s, 12 * s);

      ctx.textAlign = 'center';
  }

  // 🐟 すいぞくかん
  function drawAqua(t: number) {
      const W = cw(), H = ch(), s = W / 380;
      const night = isNight();

      const g = ctx.createLinearGradient(0, 0, 0, H);      // おおきな すいそう
      g.addColorStop(0, night ? '#082f49' : '#0369a1');
      g.addColorStop(1, night ? '#0c4a6e' : '#0ea5e9');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H * 0.86);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      for (let i = 0; i < 6; i++) ctx.fillRect(W * (i * 0.17), 0, 10 * s, H * 0.86);

      ['#fbbf24', '#f472b6', '#fb923c', '#a7f3d0', '#fde047'].forEach(function (col, i) {
          const q = ((t * (0.07 + i * 0.02) + i * 0.2) % 1);
          const fx = q * (W + 60 * s) - 30 * s;
          const fy = H * (0.16 + i * 0.12) + Math.sin(t + i) * 6 * s;
          ctx.fillStyle = col;
          ellipse(fx, fy, 12 * s, 7 * s);
          ctx.beginPath();
          ctx.moveTo(fx - 11 * s, fy);
          ctx.lineTo(fx - 21 * s, fy - 7 * s);
          ctx.lineTo(fx - 21 * s, fy + 7 * s);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#1f2937';
          ellipse(fx + 5 * s, fy - 1.5 * s, 1.6 * s, 1.6 * s);
      });
      ctx.fillStyle = 'rgba(255,255,255,0.35)';            // あわ
      for (let i = 0; i < 10; i++) {
          const q = ((t * 0.22 + i * 0.1) % 1);
          ellipse(W * (0.05 + (i * 0.1)), H * 0.84 - q * H * 0.7, (2 + (i % 3)) * s, (2 + (i % 3)) * s);
      }
      ctx.fillStyle = night ? '#166534' : '#15803d';       // かいそう
      [0.08, 0.42, 0.94].forEach(function (fx) {
          for (let k = 0; k < 3; k++) {
              ctx.beginPath();
              ctx.moveTo(W * fx + k * 7 * s, H * 0.86);
              ctx.quadraticCurveTo(W * fx + k * 7 * s + Math.sin(t + k) * 10 * s, H * 0.72,
                                   W * fx + k * 7 * s, H * 0.60);
              ctx.quadraticCurveTo(W * fx + k * 7 * s + 6 * s, H * 0.73, W * fx + k * 7 * s + 5 * s, H * 0.86);
              ctx.closePath();
              ctx.fill();
          }
      });

      ctx.fillStyle = night ? '#1c1917' : '#334155';       // てすりと ゆか
      ctx.fillRect(0, H * 0.855, W, 8 * s);
      groundBand(0.885, night ? '#292524' : '#475569', night ? '#1c1917' : '#64748b', 0.885);
      ctx.textAlign = 'center';
  }

  // ♨ おんせん
  function drawOnsen(t: number) {
      const W = cw(), H = ch(), s = W / 380;
      const night = isNight();
      groundBand(0.72, night ? '#3f2d1a' : '#a16207', night ? '#292524' : '#78350f', 0.72);

      ctx.fillStyle = night ? '#292524' : '#7c5c3a';       // いたべい
      ctx.fillRect(0, H * 0.50, W, H * 0.22);
      for (let x = 0; x < W; x += 18 * s) {
          ctx.fillStyle = night ? '#1c1917' : '#6b4f31';
          ctx.fillRect(x, H * 0.50, 3 * s, H * 0.22);
      }
      ctx.fillStyle = night ? '#44403c' : '#8b6a45';
      ctx.fillRect(0, H * 0.48, W, 8 * s);

      ctx.fillStyle = night ? '#57534e' : '#78716c';       // いわぶろ
      ctx.beginPath();
      ctx.ellipse(W * 0.5, H * 0.90, W * 0.46, H * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = night ? '#0e7490' : '#67e8f9';
      ctx.beginPath();
      ctx.ellipse(W * 0.5, H * 0.90, W * 0.41, H * 0.10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2 * s;
      for (let r = 0; r < 2; r++) {
          ctx.beginPath();
          ctx.ellipse(W * 0.5, H * 0.90, W * (0.18 + r * 0.1) + Math.sin(t + r) * 4 * s,
                      H * (0.04 + r * 0.02), 0, 0, Math.PI * 2);
          ctx.stroke();
      }
      ctx.fillStyle = night ? '#44403c' : '#57534e';       // いわ
      ([[0.06, 0.86], [0.22, 0.80], [0.80, 0.80], [0.95, 0.86]] as const).forEach(function (r) {
          ellipse(W * r[0], H * r[1], 22 * s, 13 * s);
      });

      ctx.fillStyle = '#fff';                              // ゆげ
      for (let i = 0; i < 6; i++) {
          const q = ((t * 0.18 + i * 0.17) % 1);
          ctx.globalAlpha = 0.4 * (1 - q);
          ellipse(W * (0.16 + i * 0.14) + Math.sin(t * 1.2 + i) * 8 * s,
                  H * 0.88 - q * H * 0.22, (6 + q * 12) * s, (4 + q * 8) * s);
      }
      ctx.globalAlpha = 1;

      const lx = W * 0.90, ly = H * 0.62;                  // ちょうちん
      ctx.fillStyle = night ? '#7f1d1d' : '#ef4444';
      ellipse(lx, ly, 12 * s, 16 * s);
      ctx.fillStyle = night ? '#fef08a' : '#fff';
      ctx.font = 'bold ' + (11 * s) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('湯', lx, ly + 4 * s);
      ctx.textAlign = 'center';
  }

  // 📚 としょかん
  function drawLibrary(t: number) {
      const W = cw(), H = ch(), s = W / 380;
      const night = isNight();
      groundBand(0.86, night ? '#44403c' : '#d4d4d8', night ? '#57534e' : '#e4e4e7');

      const L = W * 0.32, R = W * 0.99, top = H * 0.17, base = H * 0.88;
      ctx.fillStyle = night ? '#3f3f46' : '#e7d7b8';       // れんがの たてもの
      ctx.fillRect(L, top, R - L, base - top);
      ctx.fillStyle = night ? '#292524' : '#c9b189';
      for (let y = top; y < base; y += 12 * s) {
          ctx.fillRect(L, y, R - L, 1.5 * s);
      }
      ctx.fillStyle = night ? '#1c1917' : '#a16207';       // やね
      ctx.beginPath();
      ctx.moveTo(L - 8 * s, top);
      ctx.lineTo((L + R) / 2, top - 26 * s);
      ctx.lineTo(R + 4 * s, top);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = night ? '#27272a' : '#f5efe0';       // はしら
      [0.12, 0.34, 0.66, 0.88].forEach(function (f) {
          const x = L + (R - L) * f;
          ctx.fillRect(x - 7 * s, top + 10 * s, 14 * s, base - top - 22 * s);
          ctx.fillRect(x - 10 * s, top + 6 * s, 20 * s, 6 * s);
          ctx.fillRect(x - 10 * s, base - 14 * s, 20 * s, 6 * s);
      });

      const dx = (L + R) / 2;                              // いりぐち
      ctx.fillStyle = night ? '#1c1917' : '#78350f';
      ctx.fillRect(dx - 24 * s, base - 44 * s, 48 * s, 44 * s);
      ctx.fillStyle = night ? '#334155' : '#fde68a';
      ctx.fillRect(dx - 19 * s, base - 39 * s, 16 * s, 39 * s);
      ctx.fillRect(dx + 3 * s, base - 39 * s, 16 * s, 39 * s);
      signBoard(dx, top + 4 * s, 78 * s, '📚 としょかん', night ? '#334155' : '#fff', night ? '#e2e8f0' : '#78350f', s);

      ctx.fillStyle = night ? '#57534e' : '#cbd5e1';       // かいだん
      ctx.fillRect(dx - 44 * s, base, 88 * s, 6 * s);
      ctx.fillRect(dx - 52 * s, base + 6 * s, 104 * s, 6 * s);

      const bx = W * 0.06, by = H * 0.99;                  // ほんの やま
      ([['#ef4444', 0], ['#38bdf8', 7], ['#22c55e', 14], ['#f59e0b', 21]] as const).forEach(function (b) {
          ctx.fillStyle = night ? '#475569' : b[0];
          ctx.fillRect(bx - 22 * s, by - (b[1] + 7) * s, 44 * s, 6 * s);
      });
      ctx.textAlign = 'center';
  }

  // 🎬 えいがかん
  function drawCinema(t: number) {
      const W = cw(), H = ch(), s = W / 380;
      const night = isNight();
      groundBand(0.86, night ? '#292524' : '#71717a', night ? '#1c1917' : '#a1a1aa');

      const L = W * 0.26, R = W * 0.99, top = H * 0.16, base = H * 0.88;
      ctx.fillStyle = night ? '#3f3f46' : '#7f1d1d';
      ctx.fillRect(L, top, R - L, base - top);
      ctx.fillStyle = night ? '#27272a' : '#991b1b';
      ctx.fillRect(L, top, R - L, 10 * s);

      const mx = (L + R) / 2, my = top + 34 * s;           // マーキー
      ctx.fillStyle = night ? '#1c1917' : '#fbbf24';
      ctx.fillRect(L + 10 * s, my - 20 * s, (R - L) - 20 * s, 34 * s);
      ctx.fillStyle = night ? '#fde68a' : '#78350f';
      ctx.font = 'bold ' + (13 * s) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🎬 CINEMA', mx, my + 2 * s);
      for (let i = 0; i < 12; i++) {                       // でんきゅう
          const on = (Math.floor(t * 3) + i) % 3 !== 0;
          ctx.fillStyle = on ? '#fef08a' : (night ? '#57534e' : '#a16207');
          ellipse(L + 16 * s + i * ((R - L) - 32 * s) / 11, my + 20 * s, 3.5 * s, 3.5 * s);
      }

      ctx.fillStyle = night ? '#1e293b' : '#fef3c7';       // ポスター
      ctx.fillRect(L + 14 * s, my + 32 * s, 40 * s, 56 * s);
      ctx.strokeStyle = night ? '#57534e' : '#fbbf24';
      ctx.lineWidth = 2.5 * s;
      ctx.strokeRect(L + 14 * s, my + 32 * s, 40 * s, 56 * s);
      ctx.font = (16 * s) + 'px sans-serif';
      ctx.fillText('🍿', L + 34 * s, my + 66 * s);

      const dx = R - (R - L) * 0.30;                       // いりぐち
      ctx.fillStyle = night ? '#1c1917' : '#450a0a';
      ctx.fillRect(dx - 30 * s, base - 46 * s, 60 * s, 46 * s);
      ctx.fillStyle = night ? '#334155' : '#fca5a5';
      ctx.fillRect(dx - 24 * s, base - 40 * s, 21 * s, 40 * s);
      ctx.fillRect(dx + 3 * s, base - 40 * s, 21 * s, 40 * s);

      const tx = W * 0.13, ty = H * 0.92;                  // チケットうりば
      ctx.fillStyle = night ? '#3f3f46' : '#fbbf24';
      ctx.fillRect(tx - 24 * s, ty - 34 * s, 48 * s, 34 * s);
      ctx.fillStyle = night ? '#1e293b' : '#e0f2fe';
      ctx.fillRect(tx - 17 * s, ty - 27 * s, 34 * s, 16 * s);
      ctx.fillStyle = night ? '#fde68a' : '#78350f';
      ctx.font = 'bold ' + (7 * s) + 'px sans-serif';
      ctx.fillText('チケット', tx, ty - 4 * s);
      ctx.textAlign = 'center';
  }

  // ⛩ じんじゃ
  function drawShrine(t: number) {
      const W = cw(), H = ch(), s = W / 380;
      const night = isNight();
      groundBand(0.82, night ? '#3f2d1a' : '#d6c39c', night ? '#292524' : '#b99a68');

      [0.04, 0.17].forEach(function (fx, i) {              // き
          const x = W * fx, y = H * 0.86;
          ctx.fillStyle = night ? '#3f2d1a' : '#78350f';
          ctx.fillRect(x - 5 * s, y - 30 * s, 10 * s, 30 * s);
          ctx.fillStyle = night ? '#14532d' : (i ? '#15803d' : '#16a34a');
          ellipse(x, y - 42 * s, 28 * s, 22 * s);
      });

      const L = W * 0.62, R = W * 0.96, top = H * 0.44, base = H * 0.84;  // おやしろ
      ctx.fillStyle = night ? '#292524' : '#a16207';
      ctx.fillRect(L, top + 16 * s, R - L, base - top - 16 * s);
      ctx.fillStyle = night ? '#7f1d1d' : '#b91c1c';
      ctx.beginPath();
      ctx.moveTo(L - 14 * s, top + 20 * s);
      ctx.lineTo((L + R) / 2, top - 6 * s);
      ctx.lineTo(R + 14 * s, top + 20 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = night ? '#1c1917' : '#78350f';
      ctx.fillRect((L + R) / 2 - 16 * s, base - 30 * s, 32 * s, 30 * s);
      ctx.fillStyle = night ? '#44403c' : '#57534e';       // さいせんばこ
      ctx.fillRect((L + R) / 2 - 20 * s, base - 12 * s, 40 * s, 12 * s);

      const tx = W * 0.30, ty = H * 0.86;                  // とりい
      ctx.fillStyle = night ? '#991b1b' : '#dc2626';
      ctx.fillRect(tx - 34 * s, ty - 62 * s, 8 * s, 62 * s);
      ctx.fillRect(tx + 26 * s, ty - 62 * s, 8 * s, 62 * s);
      ctx.fillRect(tx - 46 * s, ty - 50 * s, 92 * s, 7 * s);
      ctx.fillStyle = night ? '#7f1d1d' : '#b91c1c';
      ctx.beginPath();
      ctx.moveTo(tx - 52 * s, ty - 62 * s);
      ctx.lineTo(tx + 52 * s, ty - 62 * s);
      ctx.lineTo(tx + 46 * s, ty - 70 * s);
      ctx.lineTo(tx - 46 * s, ty - 70 * s);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = night ? '#fef08a' : '#fff';          // ちょうちん
      [-1, 1].forEach(function (d) {
          ellipse(tx + d * 30 * s, ty - 38 * s, 8 * s, 11 * s);
          ctx.fillStyle = night ? '#7f1d1d' : '#dc2626';
          ctx.fillRect(tx + d * 30 * s - 8 * s, ty - 40 * s, 16 * s, 2 * s);
          ctx.fillStyle = night ? '#fef08a' : '#fff';
      });

      ctx.fillStyle = night ? '#f9a8d4' : '#fbcfe8';       // はなびら
      for (let i = 0; i < 6; i++) {
          const q = ((t * 0.2 + i * 0.16) % 1);
          ellipse(W * (0.10 + i * 0.14) + Math.sin(t + i) * 8 * s, H * 0.30 + q * H * 0.55, 3 * s, 2.2 * s);
      }
      ctx.textAlign = 'center';
  }

  // 🏦 ぎんこう
  function drawBank(t: number) {
      const W = cw(), H = ch(), s = W / 380;
      const night = isNight();
      groundBand(0.86, night ? '#44403c' : '#d4d4d8', night ? '#57534e' : '#e4e4e7');

      const L = W * 0.30, R = W * 0.99, top = H * 0.18, base = H * 0.88;
      ctx.fillStyle = night ? '#3f3f46' : '#e5e7eb';       // いしの たてもの
      ctx.fillRect(L, top, R - L, base - top);
      ctx.fillStyle = night ? '#27272a' : '#d1d5db';
      for (let y = top; y < base; y += 16 * s) ctx.fillRect(L, y, R - L, 1.5 * s);

      ctx.fillStyle = night ? '#78350f' : '#fbbf24';       // きんいろの やね
      ctx.beginPath();
      ctx.moveTo(L - 10 * s, top);
      ctx.lineTo((L + R) / 2, top - 30 * s);
      ctx.lineTo(R + 6 * s, top);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = night ? '#92400e' : '#f59e0b';
      ctx.fillRect(L - 10 * s, top, (R - L) + 16 * s, 6 * s);

      ctx.fillStyle = night ? '#fde68a' : '#78350f';       // ¥ マーク
      ctx.font = 'bold ' + (17 * s) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('¥', (L + R) / 2, top - 8 * s);

      ctx.fillStyle = night ? '#52525b' : '#f9fafb';       // はしら
      [0.10, 0.32, 0.68, 0.90].forEach(function (f) {
          const x = L + (R - L) * f;
          ctx.fillRect(x - 8 * s, top + 12 * s, 16 * s, base - top - 26 * s);
          ctx.fillStyle = night ? '#3f3f46' : '#e5e7eb';
          ctx.fillRect(x - 11 * s, top + 8 * s, 22 * s, 6 * s);
          ctx.fillRect(x - 11 * s, base - 16 * s, 22 * s, 6 * s);
          ctx.fillStyle = night ? '#52525b' : '#f9fafb';
      });

      const dx = (L + R) / 2;                              // いりぐち
      ctx.fillStyle = night ? '#1c1917' : '#475569';
      ctx.fillRect(dx - 26 * s, base - 46 * s, 52 * s, 46 * s);
      ctx.fillStyle = night ? '#334155' : '#bae6fd';
      ctx.fillRect(dx - 21 * s, base - 41 * s, 18 * s, 41 * s);
      ctx.fillRect(dx + 3 * s, base - 41 * s, 18 * s, 41 * s);
      signBoard(dx, top + 6 * s, 84 * s, '🏦 ぎんこう', night ? '#334155' : '#fff', night ? '#fde68a' : '#78350f', s);

      // まどから みえる きんこ
      const vx = L + (R - L) * 0.80, vy = top + 46 * s;
      ctx.fillStyle = night ? '#1e293b' : '#e0f2fe';
      ctx.fillRect(vx - 22 * s, vy, 44 * s, 34 * s);
      ctx.strokeStyle = night ? '#57534e' : '#94a3b8';
      ctx.lineWidth = 2.5 * s;
      ctx.strokeRect(vx - 22 * s, vy, 44 * s, 34 * s);
      ctx.fillStyle = night ? '#475569' : '#64748b';
      ctx.fillRect(vx - 13 * s, vy + 7 * s, 26 * s, 22 * s);
      ctx.strokeStyle = night ? '#fbbf24' : '#fde047';
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.arc(vx, vy + 18 * s, 6 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      const hd = t * 1.2;
      ctx.moveTo(vx, vy + 18 * s);
      ctx.lineTo(vx + Math.cos(hd) * 6 * s, vy + 18 * s + Math.sin(hd) * 6 * s);
      ctx.stroke();

      // ATM（ひだり）
      const ax = W * 0.10, ay = H * 0.94;
      ctx.fillStyle = night ? '#3f3f46' : '#0f766e';
      ctx.fillRect(ax - 22 * s, ay - 60 * s, 44 * s, 60 * s);
      ctx.fillStyle = night ? '#1c1917' : '#134e4a';
      ctx.fillRect(ax - 22 * s, ay - 66 * s, 44 * s, 8 * s);
      ctx.fillStyle = night ? '#0e7490' : '#67e8f9';       // がめん
      ctx.fillRect(ax - 15 * s, ay - 54 * s, 30 * s, 20 * s);
      ctx.fillStyle = night ? '#155e75' : '#0e7490';
      ctx.fillRect(ax - 12 * s, ay - 50 * s, 24 * s, 3 * s);
      ctx.fillRect(ax - 12 * s, ay - 44 * s, 16 * s, 3 * s);
      ctx.fillStyle = night ? '#57534e' : '#e2e8f0';       // ボタン
      for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
              ctx.fillRect(ax - 13 * s + c * 10 * s, ay - 30 * s + r * 8 * s, 7 * s, 5 * s);
          }
      }
      ctx.fillStyle = night ? '#fbbf24' : '#fde047';       // でてくる おかね
      ctx.fillRect(ax - 10 * s, ay - 8 * s + Math.sin(t * 1.5) * 1.5 * s, 20 * s, 5 * s);
      ctx.fillStyle = night ? '#fde68a' : '#fff';
      ctx.font = 'bold ' + (6 * s) + 'px sans-serif';
      ctx.fillText('ATM', ax, ay - 60 * s);

      // てまえの コインの やま
      const cx2 = W * 0.05, cy2 = H * 0.99;
      for (let i = 0; i < 4; i++) {
          ctx.fillStyle = night ? '#a16207' : '#fbbf24';
          ellipse(cx2, cy2 - 4 * s - i * 4 * s, 11 * s, 4 * s);
          ctx.fillStyle = night ? '#78350f' : '#f59e0b';
          ellipse(cx2, cy2 - 2.5 * s - i * 4 * s, 11 * s, 4 * s);
      }
      ctx.textAlign = 'center';
  }

  // ---------------- がっこう ----------------
  function drawSchool(t: number) {
      const W = cw(), H = ch(), s = W / 380;
      const night = isNight();

      // グラウンド（つちの いろ）
      ctx.fillStyle = night ? '#57534e' : '#e7c9a0';
      ctx.fillRect(0, H * 0.76, W, H * 0.24);
      ctx.fillStyle = night ? '#44403c' : '#d9b88a';
      ctx.fillRect(0, H * 0.84, W, 4 * s);
      ctx.strokeStyle = night ? '#78716c' : '#fafafa';   // トラックの しろせん
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(0, H * 0.94); ctx.lineTo(W, H * 0.94);
      ctx.stroke();

      // こうしゃ（みぎ）
      const L = W * 0.44, R = W * 0.995, top = H * 0.15, base = H * 0.86;
      ctx.fillStyle = night ? '#3f3f46' : '#fde9c8';
      ctx.fillRect(L, top, R - L, base - top);
      ctx.fillStyle = night ? '#27272a' : '#e8d3ae';     // かべの したの おび
      ctx.fillRect(L, base - 14 * s, R - L, 14 * s);
      ctx.fillStyle = night ? '#334155' : '#93c5fd';     // やね
      ctx.fillRect(L - 4 * s, top - 8 * s, (R - L) + 8 * s, 10 * s);

      // とけい
      const kx = L + (R - L) * 0.16, ky = top + 18 * s;
      ctx.fillStyle = night ? '#e2e8f0' : '#fff';
      ellipse(kx, ky, 11 * s, 11 * s);
      ctx.strokeStyle = night ? '#475569' : '#78350f';
      ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.arc(kx, ky, 11 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 1.6 * s;
      const hh = (t * 0.1) % (Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(kx, ky); ctx.lineTo(kx + Math.cos(hh - 1.6) * 5 * s, ky + Math.sin(hh - 1.6) * 5 * s);
      ctx.moveTo(kx, ky); ctx.lineTo(kx + Math.cos(t * 0.5 - 1.6) * 8 * s, ky + Math.sin(t * 0.5 - 1.6) * 8 * s);
      ctx.stroke();

      // まど（3だん）
      for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 5; c++) {
              const wx = L + (R - L) * (0.30 + c * 0.135);
              const wy = top + (12 + r * 26) * s;
              ctx.fillStyle = night ? '#fde68a' : '#bae6fd';
              ctx.fillRect(wx, wy, 22 * s, 18 * s);
              ctx.strokeStyle = night ? '#57534e' : '#a16207';
              ctx.lineWidth = 2 * s;
              ctx.strokeRect(wx, wy, 22 * s, 18 * s);
              ctx.beginPath();
              ctx.moveTo(wx + 11 * s, wy); ctx.lineTo(wx + 11 * s, wy + 18 * s);
              ctx.stroke();
          }
      }

      // げんかん
      const dx = L + (R - L) * 0.44, dy = base;
      ctx.fillStyle = night ? '#1c1917' : '#a16207';
      ctx.fillRect(dx - 26 * s, dy - 38 * s, 52 * s, 38 * s);
      ctx.fillStyle = night ? '#334155' : '#e0f2fe';
      ctx.fillRect(dx - 21 * s, dy - 33 * s, 18 * s, 30 * s);
      ctx.fillRect(dx + 3 * s, dy - 33 * s, 18 * s, 30 * s);
      ctx.fillStyle = night ? '#292524' : '#78350f';     // ひさし
      ctx.fillRect(dx - 32 * s, dy - 44 * s, 64 * s, 7 * s);

      // 「がっこう」の かんばん
      ctx.fillStyle = night ? '#334155' : '#fff';
      ctx.fillRect(dx - 30 * s, dy - 60 * s, 60 * s, 14 * s);
      ctx.strokeStyle = night ? '#57534e' : '#a16207';
      ctx.lineWidth = 2 * s;
      ctx.strokeRect(dx - 30 * s, dy - 60 * s, 60 * s, 14 * s);
      ctx.fillStyle = night ? '#e2e8f0' : '#1f2937';
      ctx.font = 'bold ' + (9 * s) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('がっこう', dx, dy - 49 * s);

      // さくらの き
      const tx = W * 0.075, ty = H * 0.88;
      ctx.fillStyle = night ? '#3f2d1a' : '#78350f';
      ctx.fillRect(tx - 5 * s, ty - 30 * s, 10 * s, 30 * s);
      ctx.fillStyle = night ? '#4c1d95' : '#f9a8d4';
      ellipse(tx, ty - 40 * s, 26 * s, 20 * s);
      ellipse(tx - 15 * s, ty - 32 * s, 15 * s, 12 * s);
      ellipse(tx + 15 * s, ty - 32 * s, 15 * s, 12 * s);
      ctx.fillStyle = night ? '#6d28d9' : '#fbcfe8';
      ellipse(tx - 6 * s, ty - 46 * s, 10 * s, 8 * s);
      ellipse(tx + 8 * s, ty - 44 * s, 9 * s, 7 * s);

      // ひらひら まう はなびら
      ctx.fillStyle = night ? '#a78bfa' : '#f9a8d4';
      for (let i = 0; i < 5; i++) {
          const q = (t * 0.25 + i * 0.2) % 1;
          ellipse(tx + 20 * s + q * 40 * s + Math.sin(t + i) * 5 * s,
                  ty - 44 * s + q * 44 * s, 2.5 * s, 2 * s);
      }

      // こっき ポール
      const px = W * 0.385, py = H * 0.90;
      ctx.fillStyle = night ? '#57534e' : '#94a3b8';
      ctx.fillRect(px - 2 * s, py - 74 * s, 4 * s, 74 * s);
      ctx.fillStyle = night ? '#7f1d1d' : '#ef4444';
      ctx.beginPath();
      ctx.moveTo(px + 2 * s, py - 74 * s);
      ctx.quadraticCurveTo(px + 16 * s, py - 70 * s + Math.sin(t * 2) * 3 * s, px + 28 * s, py - 72 * s);
      ctx.lineTo(px + 28 * s, py - 58 * s);
      ctx.quadraticCurveTo(px + 16 * s, py - 56 * s + Math.sin(t * 2) * 3 * s, px + 2 * s, py - 60 * s);
      ctx.closePath();
      ctx.fill();

      ctx.textAlign = 'center';
  }

  // ---------------- おみせ ----------------
  function drawShopTown(t: number) {
      const W = cw(), H = ch(), s = W / 380;
      const night = isNight();
      const G = H * 0.76;

      // ほどう
      ctx.fillStyle = night ? '#44403c' : '#d4d4d8';
      ctx.fillRect(0, H * 0.76, W, H * 0.24);
      ctx.fillStyle = night ? '#57534e' : '#e4e4e7';
      ctx.fillRect(0, H * 0.86, W, 4 * s);

      // おみせ（みぎ半分）
      const L = W * 0.42, R = W * 0.99, top = H * 0.20;
      ctx.fillStyle = night ? '#3f3f46' : '#fef3c7';
      ctx.fillRect(L, top, R - L, H * 0.68);
      ctx.fillStyle = night ? '#27272a' : '#fcd34d';
      ctx.fillRect(L, top, R - L, 10 * s);

      // かんばん
      ctx.fillStyle = night ? '#7f1d1d' : '#ef4444';
      ctx.fillRect(L + 10 * s, top - 22 * s, (R - L) - 20 * s, 22 * s);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold ' + (12 * s) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🛒 ショップ', (L + R) / 2, top - 6 * s);

      // ひさし（しましま）
      const aw = (R - L) - 16 * s, ay = top + 12 * s;
      for (let i = 0; i < 8; i++) {
          ctx.fillStyle = (i % 2 ? (night ? '#7f1d1d' : '#f87171') : (night ? '#3f3f46' : '#fef2f2'));
          ctx.fillRect(L + 8 * s + i * (aw / 8), ay, aw / 8, 16 * s);
      }
      ctx.fillStyle = night ? '#27272a' : '#dc2626';
      ctx.fillRect(L + 8 * s, ay + 16 * s, aw, 3 * s);

      // ウィンドウ
      const wx = L + 16 * s, wy = ay + 28 * s, ww = (R - L) * 0.52, wh = H * 0.28;
      ctx.fillStyle = night ? '#1e293b' : '#bae6fd';
      ctx.fillRect(wx, wy, ww, wh);
      ctx.strokeStyle = night ? '#57534e' : '#a16207';
      ctx.lineWidth = 3 * s;
      ctx.strokeRect(wx, wy, ww, wh);
      // ならんだ しなもの
      ctx.font = (13 * s) + 'px sans-serif';
      ctx.textAlign = 'center';
      ['🍰', '🎾', '🧸', '🍚', '🎸', '🍭'].forEach(function (e, i) {
          ctx.fillText(e, wx + ww * (0.18 + (i % 3) * 0.32), wy + wh * (i < 3 ? 0.38 : 0.82));
      });
      ctx.fillStyle = night ? '#44403c' : '#e7d7b8';
      ctx.fillRect(wx + 3 * s, wy + wh * 0.45, ww - 6 * s, 4 * s);

      // ドア
      const dx = R - (R - L) * 0.26;
      ctx.fillStyle = night ? '#292524' : '#a16207';
      ctx.fillRect(dx - 20 * s, H * 0.88 - H * 0.34, 40 * s, H * 0.34);
      ctx.fillStyle = night ? '#1c1917' : '#78350f';
      ctx.fillRect(dx - 20 * s, H * 0.88 - H * 0.34, 40 * s, 4 * s);
      ctx.fillStyle = night ? '#334155' : '#e0f2fe';
      ctx.fillRect(dx - 14 * s, H * 0.88 - H * 0.31, 28 * s, 22 * s);
      ctx.fillStyle = '#fbbf24';
      ellipse(dx + 13 * s, H * 0.88 - H * 0.16, 3 * s, 3 * s);

      // OPEN の ふだ
      ctx.fillStyle = night ? '#166534' : '#22c55e';
      ctx.fillRect(dx - 12 * s, H * 0.88 - H * 0.24, 24 * s, 10 * s);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold ' + (6 * s) + 'px sans-serif';
      ctx.fillText('OPEN', dx, H * 0.88 - H * 0.24 + 7 * s);

      // てまえの プランター（ドアの みぎ）
      const plx = R - 26 * s;
      ctx.fillStyle = night ? '#7c2d12' : '#c2410c';
      ctx.fillRect(plx - 11 * s, H * 0.93 - 14 * s, 22 * s, 14 * s);
      ctx.fillStyle = night ? '#14532d' : '#22c55e';
      ellipse(plx, H * 0.93 - 20 * s, 12 * s, 9 * s);
      ctx.fillStyle = night ? '#7f1d1d' : '#f472b6';
      ellipse(plx - 5 * s, H * 0.93 - 24 * s, 3 * s, 3 * s);
      ellipse(plx + 6 * s, H * 0.93 - 22 * s, 3 * s, 3 * s);

      // がいとう（ひだり）
      const px = W * 0.08, py = H * 0.90;
      ctx.fillStyle = night ? '#57534e' : '#475569';
      ctx.fillRect(px - 3 * s, py - 58 * s, 6 * s, 58 * s);
      ctx.fillStyle = night ? '#fde68a' : '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(px - 12 * s, py - 58 * s);
      ctx.lineTo(px + 12 * s, py - 58 * s);
      ctx.lineTo(px + 7 * s, py - 70 * s);
      ctx.lineTo(px - 7 * s, py - 70 * s);
      ctx.closePath();
      ctx.fill();

      ctx.textAlign = 'center';
  }

  function drawHouse(t: number) {
      const W = cw(), H = ch();
      const s = W / 380;
      const night = isNight();

      ctx.save();
      ctx.translate(W * HOUSE_X, H * 0.79);
      ctx.scale(s, s);

      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ellipse(0, 8, 54, 8);

      // えんとつ
      ctx.fillStyle = night ? '#7c2d12' : '#9a3412';
      ctx.fillRect(22, -156, 15, 30);

      // やね（2かいだて）
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-56, -104); ctx.lineTo(0, -148); ctx.lineTo(56, -104);
      ctx.closePath();
      ctx.clip();
      paintBands(-56, -148, 112, 46, styleColors('roof', night, '#dc2626', '#7f1d1d'));
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(-56, -104); ctx.lineTo(0, -148); ctx.lineTo(56, -104);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(60,20,10,0.5)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // かべ
      paintBands(-44, -104, 88, 108, styleColors('wall2', night, '#e0b884', '#7c5a3a'));
      ctx.strokeStyle = 'rgba(80,45,15,0.45)';
      ctx.lineWidth = 3;
      ctx.strokeRect(-44, -104, 88, 108);
      ctx.beginPath();                                  // 1かいと 2かいの さかいめ
      ctx.moveTo(-44, -54); ctx.lineTo(44, -54);
      ctx.stroke();

      // 2かいの まど（ねているときは ここに あかりが つく）
      ctx.fillStyle = night ? '#fde68a' : '#bae6fd';
      if (night) { ctx.shadowBlur = 18; ctx.shadowColor = '#fde68a'; }
      ctx.fillRect(-32, -94, 26, 24);
      ctx.shadowBlur = 0;
      if (petHidden) {                                  // まどごしの ねがお
          const sp2 = currentSpecies();
          ctx.fillStyle = sp2.body;
          ellipse(-19, -81, 9.5, 8.5);
          ctx.fillStyle = 'rgba(248,113,113,0.5)';
          ellipse(-24, -79, 2.5, 1.8);
          ellipse(-14, -79, 2.5, 1.8);
          ctx.strokeStyle = '#1f2937';
          ctx.lineWidth = 1.8;
          [-22.5, -15.5].forEach(function (ex) {
              ctx.beginPath();
              ctx.arc(ex, -83, 2.6, Math.PI * 0.15, Math.PI * 0.85);
              ctx.stroke();
          });
      }
      ctx.strokeStyle = night ? '#92400e' : '#78350f';
      ctx.lineWidth = 3;
      ctx.strokeRect(-32, -94, 26, 24);
      if (!petHidden) {
          ctx.beginPath();
          ctx.moveTo(-19, -94); ctx.lineTo(-19, -70);
          ctx.moveTo(-32, -82); ctx.lineTo(-6, -82);
          ctx.stroke();
      }
      ctx.fillStyle = night ? '#3f2d1f' : '#bae6fd';    // 2かいの もうひとつの まど
      ctx.fillRect(10, -94, 24, 22);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(10, -94, 7, 22);
      ctx.fillRect(27, -94, 7, 22);
      ctx.strokeStyle = night ? '#92400e' : '#78350f';
      ctx.lineWidth = 3;
      ctx.strokeRect(10, -94, 24, 22);

      // げんかん
      ctx.fillStyle = night ? '#5b3a1a' : '#8b5e34';
      ctx.beginPath();
      ctx.moveTo(-18, 4);
      ctx.lineTo(-18, -20);
      ctx.arc(-6, -20, 12, Math.PI, 0);
      ctx.lineTo(6, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ellipse(1, -14, 2.5, 2.5);

      // げんかんの だん
      ctx.fillStyle = night ? '#57534e' : '#d6d3d1';
      ctx.fillRect(-24, 4, 36, 7);
      ctx.fillStyle = night ? '#44403c' : '#a8a29e';
      ctx.fillRect(-27, 10, 42, 5);

      // ポーチライト
      ctx.fillStyle = night ? '#78350f' : '#92400e';
      ctx.fillRect(-40, -34, 4, 8);
      if (night) {
          ctx.fillStyle = 'rgba(253,230,138,0.35)';
          ellipse(-38, -22, 15, 16);
      }
      ctx.fillStyle = night ? '#fde68a' : '#e7e5e4';
      ctx.beginPath();
      ctx.moveTo(-45, -18);
      ctx.lineTo(-31, -18);
      ctx.lineTo(-34, -28);
      ctx.lineTo(-42, -28);
      ctx.closePath();
      ctx.fill();

      // 1かいの まど（ねている よるは あかりを けす）
      ctx.fillStyle = night ? '#3f2d1f' : '#bae6fd';
      ctx.fillRect(12, -44, 26, 24);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';     // レースカーテン
      ctx.fillRect(12, -44, 8, 24);
      ctx.fillRect(30, -44, 8, 24);
      ctx.strokeStyle = night ? '#92400e' : '#78350f';
      ctx.lineWidth = 3;
      ctx.strokeRect(12, -44, 26, 24);
      ctx.beginPath();
      ctx.moveTo(25, -44); ctx.lineTo(25, -20);
      ctx.moveTo(12, -32); ctx.lineTo(38, -32);
      ctx.stroke();

      ctx.restore();

      // ねているあいだは えんとつから けむりと Zzz
      if (night) {
          const bx = W * HOUSE_X + 29 * s, by = H * 0.79 - 156 * s;
          for (let i = 0; i < 3; i++) {
              const q = (t * 0.35 + i * 0.33) % 1;
              ctx.globalAlpha = (1 - q) * 0.5;
              ctx.fillStyle = '#e2e8f0';
              ellipse(bx + Math.sin(q * 5) * 8 * s, by - q * 46 * s, (5 + q * 9) * s, (4 + q * 7) * s);
          }
          ctx.globalAlpha = 1;
          ctx.font = 'bold 22px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#fff';
          for (let i = 0; i < 3; i++) {
              const q = (t * 0.6 + i * 0.33) % 1;
              ctx.globalAlpha = 1 - q;
              ctx.fillText('Z', bx + 14 * s + q * 24, by - 6 * s - q * 40);
          }
          ctx.globalAlpha = 1;
          ctx.textAlign = 'left';
      }
  }

  function drawYard(t: number) {
      const W = cw(), H = ch(), s = W / 380;
      const night = isNight();

      if (has('rainbow') && !night) {
          const cols = ['#ef4444', '#f97316', '#facc15', '#4ade80', '#38bdf8', '#a78bfa'];
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, W, H * 0.76);       // じめんより 下には えがかない
          ctx.clip();
          ctx.lineWidth = 7 * s;
          ctx.globalAlpha = 0.7;
          cols.forEach(function (c, i) {
              ctx.strokeStyle = c;
              ctx.beginPath();
              ctx.arc(W * 0.45, H * 0.86, W * 0.30 - i * 7 * s, Math.PI, Math.PI * 2);
              ctx.stroke();
          });
          ctx.restore();
      }

      if (has('sun') && !night) {                     // おひさま
          const x = W * 0.60, y = H * 0.12;
          ctx.save();
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 4 * s;
          ctx.lineCap = 'round';
          for (let i = 0; i < 8; i++) {
              const a = i / 8 * Math.PI * 2 + t * 0.2;
              ctx.beginPath();
              ctx.moveTo(x + Math.cos(a) * 22 * s, y + Math.sin(a) * 22 * s);
              ctx.lineTo(x + Math.cos(a) * 31 * s, y + Math.sin(a) * 31 * s);
              ctx.stroke();
          }
          ctx.restore();
          ctx.fillStyle = '#fbbf24';
          ellipse(x, y, 19 * s, 19 * s);
          ctx.fillStyle = '#fde68a';
          ellipse(x - 4 * s, y - 4 * s, 9 * s, 8 * s);
      }

      if (has('balloon')) {                           // ふうせん
          const bx = W * 0.36 + Math.sin(t * 0.9) * 8 * s;
          const by = H * 0.44 + Math.sin(t * 1.3) * 6 * s;
          ctx.strokeStyle = 'rgba(60,40,20,0.5)';
          ctx.lineWidth = 1.5 * s;
          ctx.beginPath();
          ctx.moveTo(W * 0.36, H * 0.80);
          ctx.quadraticCurveTo(bx - 6 * s, (by + H * 0.80) / 2, bx, by + 16 * s);
          ctx.stroke();
          ctx.fillStyle = night ? '#9f1239' : '#fb7185';
          ellipse(bx, by, 15 * s, 18 * s);
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ellipse(bx - 5 * s, by - 6 * s, 4 * s, 5 * s);
          ctx.fillStyle = night ? '#881337' : '#e11d48';
          ctx.beginPath();
          ctx.moveTo(bx - 4 * s, by + 17 * s);
          ctx.lineTo(bx + 4 * s, by + 17 * s);
          ctx.lineTo(bx, by + 22 * s);
          ctx.closePath();
          ctx.fill();
      }

      if (has('butterfly')) {                         // ちょうちょ
          ([[0.27, 0.52, 1.0], [0.44, 0.60, 1.6]] as const).forEach(function (bset, k) {
              const bx = W * bset[0] + Math.sin(t * bset[2]) * 26 * s;
              const by = H * bset[1] + Math.cos(t * bset[2] * 1.3) * 16 * s;
              const flap = Math.abs(Math.sin(t * 9 + k)) * 0.7 + 0.3;
              ctx.fillStyle = k ? '#f472b6' : '#facc15';
              ctx.save();
              ctx.translate(bx, by);
              ctx.scale(flap, 1);
              ellipse(-6 * s, -3 * s, 6 * s, 7 * s);
              ellipse(6 * s, -3 * s, 6 * s, 7 * s);
              ellipse(-5 * s, 4 * s, 4 * s, 5 * s);
              ellipse(5 * s, 4 * s, 4 * s, 5 * s);
              ctx.restore();
              ctx.fillStyle = '#78350f';
              ellipse(bx, by, 1.8 * s, 7 * s);
          });
      }

      if (has('garden')) {                            // はたけ
          const x = W * 0.70, y = H * 0.985;
          ctx.fillStyle = night ? '#4a2c10' : '#78350f';
          ctx.fillRect(x - 46 * s, y - 12 * s, 92 * s, 12 * s);
          [-32, -16, 0, 16, 32].forEach(function (q, i) {
              ctx.fillStyle = night ? '#166534' : '#22c55e';
              ellipse(x + q * s, y - 18 * s, 7 * s, 9 * s);
              ctx.fillStyle = night ? '#14532d' : '#16a34a';
              ellipse(x + q * s - 5 * s, y - 20 * s, 5 * s, 3 * s);
              ellipse(x + q * s + 5 * s, y - 21 * s, 5 * s, 3 * s);
              if (i % 2 === 0) {
                  ctx.fillStyle = night ? '#7f1d1d' : '#ef4444';
                  ellipse(x + q * s, y - 26 * s, 3.5 * s, 3.5 * s);
              }
          });
      }

      if (has('bbq')) {                               // バーベキューコンロ
          const x = W * 0.445, y = H * 0.985;
          ctx.fillStyle = night ? '#334155' : '#475569';
          ctx.fillRect(x - 4 * s, y - 20 * s, 3 * s, 20 * s);
          ctx.fillRect(x + 12 * s, y - 20 * s, 3 * s, 20 * s);
          ctx.fillStyle = night ? '#1e293b' : '#334155';
          ellipse(x + 6 * s, y - 22 * s, 22 * s, 8 * s);
          ctx.fillStyle = night ? '#7f1d1d' : '#f97316';
          ellipse(x + 6 * s, y - 24 * s, 16 * s, 5 * s);
          ctx.fillStyle = night ? '#b45309' : '#78350f';
          ctx.fillRect(x - 4 * s, y - 28 * s, 10 * s, 4 * s);
          ctx.fillRect(x + 10 * s, y - 27 * s, 10 * s, 4 * s);
      }

      if (has('swingset')) {                          // ブランコ
          const x = W * 0.055, y = H * 0.80;
          ctx.strokeStyle = night ? '#334155' : '#64748b';
          ctx.lineWidth = 5 * s;
          ctx.beginPath();
          ctx.moveTo(x - 26 * s, y); ctx.lineTo(x - 8 * s, y - 62 * s);
          ctx.moveTo(x + 26 * s, y); ctx.lineTo(x + 8 * s, y - 62 * s);
          ctx.moveTo(x - 10 * s, y - 62 * s); ctx.lineTo(x + 10 * s, y - 62 * s);
          ctx.stroke();
          const sw = Math.sin(t * 1.5) * 6 * s;
          ctx.lineWidth = 2 * s;
          ctx.beginPath();
          ctx.moveTo(x - 8 * s, y - 60 * s); ctx.lineTo(x - 8 * s + sw, y - 24 * s);
          ctx.moveTo(x + 8 * s, y - 60 * s); ctx.lineTo(x + 8 * s + sw, y - 24 * s);
          ctx.stroke();
          ctx.fillStyle = night ? '#7f1d1d' : '#ef4444';
          ctx.fillRect(x - 12 * s + sw, y - 26 * s, 24 * s, 5 * s);
      }

      if (has('sandbox')) {                           // すなば
          const x = W * 0.20, y = H * 0.995;
          ctx.fillStyle = night ? '#6b5a2f' : '#fde68a';
          ellipse(x, y - 10 * s, 40 * s, 12 * s);
          ctx.fillStyle = night ? '#4a2c10' : '#a16207';
          ctx.strokeStyle = night ? '#4a2c10' : '#a16207';
          ctx.lineWidth = 5 * s;
          ctx.beginPath();
          ctx.ellipse(x, y - 10 * s, 40 * s, 12 * s, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = night ? '#7f1d1d' : '#ef4444';
          ctx.beginPath();
          ctx.moveTo(x + 22 * s, y - 12 * s);
          ctx.lineTo(x + 32 * s, y - 12 * s);
          ctx.lineTo(x + 27 * s, y - 24 * s);
          ctx.closePath();
          ctx.fill();
      }

      if (has('pinwheel')) {                          // かざぐるま
          const x = W * 0.395, y = H * 0.80;
          ctx.strokeStyle = night ? '#4a2c10' : '#a16207';
          ctx.lineWidth = 3 * s;
          ctx.beginPath();
          ctx.moveTo(x, y); ctx.lineTo(x, y - 40 * s);
          ctx.stroke();
          ctx.save();
          ctx.translate(x, y - 42 * s);
          ctx.rotate(t * 2.5);
          ([['#ef4444', 0], ['#facc15', 1], ['#38bdf8', 2], ['#4ade80', 3]] as const).forEach(function (b) {
              ctx.save();
              ctx.rotate(b[1] * Math.PI / 2);
              ctx.fillStyle = night ? 'rgba(255,255,255,0.35)' : b[0];
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(11 * s, -4 * s);
              ctx.lineTo(11 * s, 6 * s);
              ctx.closePath();
              ctx.fill();
              ctx.restore();
          });
          ctx.restore();
      }

      if (has('soccer')) {                            // サッカーボール
          const x = W * 0.325, y = H * 0.99;
          ctx.fillStyle = '#f8fafc';
          ellipse(x, y - 11 * s, 11 * s, 11 * s);
          ctx.fillStyle = '#1f2937';
          ctx.beginPath();
          ctx.moveTo(x, y - 17 * s); ctx.lineTo(x + 5 * s, y - 13 * s);
          ctx.lineTo(x + 3 * s, y - 7 * s); ctx.lineTo(x - 3 * s, y - 7 * s);
          ctx.lineTo(x - 5 * s, y - 13 * s);
          ctx.closePath();
          ctx.fill();
      }

      if (has('jumprope')) {                          // なわとび
          const x = W * 0.21, y = H * 0.985;
          ctx.strokeStyle = night ? '#7f1d1d' : '#ef4444';
          ctx.lineWidth = 3 * s;
          ctx.beginPath();
          ctx.ellipse(x, y - 6 * s, 16 * s, 6 * s, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = night ? '#4b3418' : '#a16207';
          ctx.fillRect(x - 20 * s, y - 10 * s, 8 * s, 4 * s);
          ctx.fillRect(x + 12 * s, y - 10 * s, 8 * s, 4 * s);
      }

      if (has('feeder')) {                            // ことりの えさだい
          const x = W * 0.025, y = H * 0.80;
          ctx.fillStyle = night ? '#4a2c10' : '#78350f';
          ctx.fillRect(x - 3 * s, y - 60 * s, 6 * s, 60 * s);
          ctx.fillStyle = night ? '#6b4a24' : '#a16207';
          ctx.fillRect(x - 18 * s, y - 66 * s, 36 * s, 7 * s);
          ctx.beginPath();
          ctx.moveTo(x - 22 * s, y - 74 * s);
          ctx.lineTo(x + 22 * s, y - 74 * s);
          ctx.lineTo(x, y - 90 * s);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = night ? '#7c5a3a' : '#fbbf24';
          ellipse(x, y - 62 * s, 8 * s, 3 * s);
      }

      if (has('planter')) {                           // プランター
          const x = W * 0.955, y = H * 0.90;
          ctx.fillStyle = night ? '#7c2d12' : '#c2410c';
          ctx.fillRect(x - 20 * s, y - 14 * s, 40 * s, 14 * s);
          ([['#f472b6', -12], ['#facc15', 0], ['#a78bfa', 12]] as const).forEach(function (f) {
              ctx.strokeStyle = night ? '#14532d' : '#16a34a';
              ctx.lineWidth = 2 * s;
              ctx.beginPath();
              ctx.moveTo(x + f[1] * s, y - 14 * s);
              ctx.lineTo(x + f[1] * s, y - 24 * s);
              ctx.stroke();
              ctx.fillStyle = night ? 'rgba(255,255,255,0.3)' : f[0];
              ellipse(x + f[1] * s, y - 27 * s, 5 * s, 5 * s);
          });
      }

      if (has('flagpole')) {                          // はた
          const x = W * 0.50, y = H * 0.79;
          ctx.fillStyle = night ? '#64748b' : '#94a3b8';
          ctx.fillRect(x - 2 * s, y - 96 * s, 4 * s, 96 * s);
          ctx.fillStyle = night ? '#7f1d1d' : '#ef4444';
          ctx.beginPath();
          ctx.moveTo(x + 2 * s, y - 96 * s);
          ctx.lineTo(x + 40 * s + Math.sin(t * 3) * 4 * s, y - 88 * s);
          ctx.lineTo(x + 2 * s, y - 76 * s);
          ctx.closePath();
          ctx.fill();
      }

      if (has('pond')) {                              // いけ
          const x = W * 0.56, y = H * 0.855;
          ctx.fillStyle = night ? '#1e3a8a' : '#38bdf8';
          ellipse(x, y, 44 * s, 13 * s);
          ctx.fillStyle = night ? '#1d4ed8' : '#7dd3fc';
          ellipse(x, y - 1 * s, 36 * s, 9 * s);
          ctx.strokeStyle = night ? '#334155' : '#94a3b8';
          ctx.lineWidth = 3 * s;
          ctx.beginPath();
          ctx.ellipse(x, y, 44 * s, 13 * s, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = night ? '#7f1d1d' : '#f97316';
          ellipse(x - 12 * s + Math.sin(t) * 8 * s, y, 6 * s, 3 * s);
          ctx.fillStyle = night ? '#166534' : '#22c55e';
          ellipse(x + 22 * s, y + 2 * s, 9 * s, 4 * s);
      }

      if (has('stonelamp')) {                         // いしどうろう
          const x = W * 0.955, y = H * 0.84;
          ctx.fillStyle = night ? '#57534e' : '#a8a29e';
          ctx.fillRect(x - 6 * s, y - 26 * s, 12 * s, 26 * s);
          ctx.fillRect(x - 14 * s, y - 34 * s, 28 * s, 9 * s);
          if (night) {
              ctx.fillStyle = 'rgba(253,230,138,0.35)';
              ellipse(x, y - 40 * s, 18 * s, 18 * s);
          }
          ctx.fillStyle = night ? '#fde68a' : '#e7e5e4';
          ctx.fillRect(x - 9 * s, y - 48 * s, 18 * s, 14 * s);
          ctx.fillStyle = night ? '#57534e' : '#a8a29e';
          ctx.beginPath();
          ctx.moveTo(x - 15 * s, y - 48 * s);
          ctx.lineTo(x + 15 * s, y - 48 * s);
          ctx.lineTo(x, y - 62 * s);
          ctx.closePath();
          ctx.fill();
      }

      if (has('bench')) {                             // ベンチ
          const x = W * 0.16, y = H * 0.78;
          ctx.fillStyle = night ? '#4a2c10' : '#a16207';
          ctx.fillRect(x - 30 * s, y - 10 * s, 60 * s, 6 * s);
          ctx.fillRect(x - 30 * s, y - 20 * s, 60 * s, 6 * s);
          ctx.fillStyle = night ? '#2a1d14' : '#78350f';
          ctx.fillRect(x - 26 * s, y - 4 * s, 6 * s, 12 * s);
          ctx.fillRect(x + 20 * s, y - 4 * s, 6 * s, 12 * s);
      }

      if (has('shishi')) {                            // ししおどし
          const x = W * 0.955, y = H * 0.975;
          const tip = Math.sin(t * 1.2) > 0 ? 0.25 : -0.1;
          ctx.fillStyle = night ? '#334155' : '#94a3b8';
          ellipse(x, y, 20 * s, 7 * s);
          ctx.fillStyle = night ? '#1e3a8a' : '#7dd3fc';
          ellipse(x, y - 1 * s, 15 * s, 4.5 * s);
          ctx.fillStyle = night ? '#4a2c10' : '#78350f';
          ctx.fillRect(x - 2 * s, y - 30 * s, 4 * s, 30 * s);
          ctx.save();
          ctx.translate(x, y - 28 * s);
          ctx.rotate(tip);
          ctx.fillStyle = night ? '#6b4a24' : '#a3a35c';
          ctx.fillRect(-22 * s, -3 * s, 44 * s, 6 * s);
          ctx.restore();
      }

      if (has('heli') && !night) {                    // ヘリコプター
          const x = W * (((t * 0.05) % 1.3) - 0.15), y = H * 0.20 + Math.sin(t * 2) * 4 * s;
          ctx.fillStyle = '#334155';
          ellipse(x, y, 20 * s, 11 * s);
          ctx.fillRect(x + 14 * s, y - 3 * s, 26 * s, 5 * s);
          ctx.fillStyle = '#7dd3fc';
          ellipse(x - 8 * s, y - 2 * s, 8 * s, 6 * s);
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(x - 2 * s, y - 16 * s, 4 * s, 6 * s);
          ctx.fillRect(x - 30 * s + (Math.sin(t * 30) + 1) * 4 * s, y - 18 * s, 60 * s, 3 * s);
          ctx.fillRect(x + 36 * s, y - 12 * s, 3 * s, 14 * s);
      }

      if (has('koinobori')) {                         // こいのぼり
          const x = W * 0.03, y = H * 0.80;
          ctx.fillStyle = night ? '#4a2c10' : '#78350f';
          ctx.fillRect(x - 2 * s, y - 120 * s, 5 * s, 120 * s);
          ctx.fillStyle = '#facc15';
          ellipse(x, y - 124 * s, 5 * s, 5 * s);
          ([['#1f2937', -112, 1], ['#dc2626', -88, 0.85], ['#38bdf8', -68, 0.7]] as const).forEach(function (k, i) {
              const ky = y + k[1] * s, kk = k[2], wave = Math.sin(t * 2 + i) * 4 * s;
              ctx.fillStyle = night ? 'rgba(255,255,255,0.3)' : k[0];
              ctx.beginPath();
              ctx.moveTo(x + 2 * s, ky - 9 * s * kk);
              ctx.quadraticCurveTo(x + 30 * s, ky - 12 * s * kk + wave, x + 52 * s * kk, ky - 6 * s * kk + wave);
              ctx.lineTo(x + 44 * s * kk, ky + wave);
              ctx.lineTo(x + 52 * s * kk, ky + 6 * s * kk + wave);
              ctx.quadraticCurveTo(x + 30 * s, ky + 12 * s * kk + wave, x + 2 * s, ky + 9 * s * kk);
              ctx.closePath();
              ctx.fill();
              ctx.fillStyle = '#fff';
              ellipse(x + 10 * s, ky - 2 * s * kk, 3 * s * kk, 3 * s * kk);
          });
      }

      if (has('laundry')) {                           // ものほし
          const y = H * 0.50;
          ctx.strokeStyle = night ? '#4a2c10' : '#78350f';
          ctx.lineWidth = 4 * s;
          [0.24, 0.46].forEach(function (q) {
              ctx.beginPath();
              ctx.moveTo(W * q, H * 0.80); ctx.lineTo(W * q, y);
              ctx.stroke();
          });
          ctx.lineWidth = 2 * s;
          ctx.beginPath();
          ctx.moveTo(W * 0.24, y);
          ctx.quadraticCurveTo(W * 0.35, y + H * 0.02, W * 0.46, y);
          ctx.stroke();
          ([['#f8fafc', 0.28], ['#7dd3fc', 0.34], ['#fbcfe8', 0.40]] as const).forEach(function (c) {
              ctx.fillStyle = night ? 'rgba(255,255,255,0.35)' : c[0];
              ctx.fillRect(W * c[1] - 9 * s, y + H * 0.012, 18 * s, 26 * s);
          });
      }

      if (has('tree2')) {                             // もみのき
          const x = W * 0.36, y = H * 0.78;
          ctx.fillStyle = night ? '#4a2c10' : '#78350f';
          ctx.fillRect(x - 4 * s, y - 16 * s, 8 * s, 16 * s);
          ctx.fillStyle = night ? '#14532d' : '#16a34a';
          ([[0, 26, 20], [-14, 22, 17], [-26, 17, 13]] as const).forEach(function (lv) {
              ctx.beginPath();
              ctx.moveTo(x, y - (16 + lv[0] + lv[2] * 1.6) * s);
              ctx.lineTo(x + lv[1] * s, y - (16 + lv[0]) * s);
              ctx.lineTo(x - lv[1] * s, y - (16 + lv[0]) * s);
              ctx.closePath();
              ctx.fill();
          });
      }

      if (has('dragonfly') && !night) {               // とんぼ
          ([[0.42, 0.60, 1.3], [0.52, 0.68, 0.9]] as const).forEach(function (d, k) {
              const x = W * d[0] + Math.sin(t * d[2]) * 24 * s;
              const y = H * d[1] + Math.cos(t * d[2] * 1.6) * 10 * s;
              ctx.fillStyle = 'rgba(125,211,252,0.75)';
              ellipse(x - 5 * s, y - 3 * s, 9 * s, 3 * s);
              ellipse(x + 5 * s, y - 3 * s, 9 * s, 3 * s);
              ctx.fillStyle = night ? '#334155' : '#0ea5e9';
              ctx.fillRect(x - 1.5 * s, y - 2 * s, 3 * s, 16 * s);
              ellipse(x, y - 3 * s, 3.5 * s, 3.5 * s);
          });
      }

      if (has('sheep') && !night) {                   // ひつじぐも
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ([[0.30, 0.10, 1], [0.52, 0.07, 0.75], [0.70, 0.12, 0.6]] as const).forEach(function (c) {
              const x = W * c[0] + ((t * 5) % (W * 0.3)), y = H * c[1], k = c[2];
              ellipse(x, y, 18 * s * k, 10 * s * k);
              ellipse(x + 15 * s * k, y + 2 * s * k, 13 * s * k, 8 * s * k);
              ellipse(x - 14 * s * k, y + 3 * s * k, 11 * s * k, 7 * s * k);
          });
      }

      if (has('flock') && !night) {                   // とりのむれ
          const base = ((t * 0.06) % 1.2) - 0.1;
          ([[0, 0], [-18, 10], [18, 12], [-34, 22], [34, 20]] as const).forEach(function (o) {
              const x = W * base + o[0] * s, y = H * 0.13 + o[1] * s + Math.sin(t * 2 + o[0]) * 2 * s;
              ctx.strokeStyle = '#475569';
              ctx.lineWidth = 2.5 * s;
              ctx.beginPath();
              ctx.moveTo(x - 7 * s, y);
              ctx.quadraticCurveTo(x, y - 5 * s - Math.sin(t * 6) * 2 * s, x + 7 * s, y);
              ctx.stroke();
          });
      }

      if (has('bee') && !night) {                     // みつばち
          ([[0.28, 0.72, 1.4], [0.36, 0.66, 1.1]] as const).forEach(function (bs, k) {
              const x = W * bs[0] + Math.sin(t * bs[2]) * 30 * s;
              const y = H * bs[1] + Math.cos(t * bs[2] * 1.7) * 12 * s;
              ctx.fillStyle = '#facc15';
              ellipse(x, y, 6 * s, 4.5 * s);
              ctx.fillStyle = '#1f2937';
              ctx.fillRect(x - 2 * s, y - 4.5 * s, 2 * s, 9 * s);
              ctx.fillRect(x + 2 * s, y - 4 * s, 2 * s, 8 * s);
              ctx.fillStyle = 'rgba(255,255,255,0.75)';
              ellipse(x - 1 * s, y - 6 * s - Math.abs(Math.sin(t * 20 + k)) * 2 * s, 4 * s, 2.5 * s);
          });
      }

      if (has('bat') && night) {                      // こうもり
          ([[0.30, 0.20, 1.1], [0.46, 0.14, 0.8]] as const).forEach(function (bs) {
              const x = W * bs[0] + Math.sin(t * bs[2]) * 40 * s;
              const y = H * bs[1] + Math.cos(t * bs[2] * 1.4) * 14 * s;
              const flap = Math.sin(t * 8) * 6 * s;
              ctx.fillStyle = '#1e1b4b';
              ellipse(x, y, 6 * s, 5 * s);
              ctx.beginPath();
              ctx.moveTo(x - 4 * s, y);
              ctx.quadraticCurveTo(x - 16 * s, y - 8 * s + flap, x - 22 * s, y + 2 * s);
              ctx.quadraticCurveTo(x - 14 * s, y + 4 * s, x - 4 * s, y + 4 * s);
              ctx.closePath();
              ctx.fill();
              ctx.beginPath();
              ctx.moveTo(x + 4 * s, y);
              ctx.quadraticCurveTo(x + 16 * s, y - 8 * s + flap, x + 22 * s, y + 2 * s);
              ctx.quadraticCurveTo(x + 14 * s, y + 4 * s, x + 4 * s, y + 4 * s);
              ctx.closePath();
              ctx.fill();
          });
      }

      if (has('firework') && night) {                 // はなび
          ([[0.30, 0.22, '#f472b6', 0], [0.58, 0.16, '#facc15', 0.5], [0.44, 0.30, '#7dd3fc', 0.25]] as const).forEach(function (fw) {
              const q = ((t * 0.35) + fw[3]) % 1;
              const x = W * fw[0], y = H * fw[1];
              ctx.globalAlpha = Math.max(0, 1 - q);
              ctx.strokeStyle = fw[2];
              ctx.lineWidth = 2.5 * s;
              for (let i = 0; i < 12; i++) {
                  const a = i / 12 * Math.PI * 2;
                  const r0 = 6 * s + q * 34 * s, r1 = r0 + 9 * s;
                  ctx.beginPath();
                  ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
                  ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
                  ctx.stroke();
              }
              ctx.globalAlpha = 1;
          });
      }

      if (has('ufo') && !night) {                     // UFO
          const x = W * (0.15 + ((t * 0.03) % 1) * 0.7), y = H * 0.16 + Math.sin(t * 1.5) * 6 * s;
          ctx.fillStyle = 'rgba(148,163,184,0.35)';
          ellipse(x, y + 12 * s, 34 * s, 8 * s);
          ctx.fillStyle = '#94a3b8';
          ellipse(x, y, 30 * s, 10 * s);
          ctx.fillStyle = '#7dd3fc';
          ellipse(x, y - 8 * s, 15 * s, 12 * s);
          ctx.fillStyle = '#facc15';
          [-18, 0, 18].forEach(function (q) { ellipse(x + q * s, y + 3 * s, 3.5 * s, 3.5 * s); });
      }

      if (has('airplane') && !night) {                // ひこうき
          const x = W * (((t * 0.045) % 1.2) - 0.1), y = H * 0.09;
          ctx.fillStyle = '#f8fafc';
          ellipse(x, y, 26 * s, 6 * s);
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.moveTo(x - 4 * s, y); ctx.lineTo(x + 10 * s, y - 12 * s); ctx.lineTo(x + 14 * s, y);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x - 22 * s, y); ctx.lineTo(x - 30 * s, y - 9 * s); ctx.lineTo(x - 16 * s, y);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          ctx.lineWidth = 4 * s;
          ctx.beginPath();
          ctx.moveTo(x - 28 * s, y + 2 * s);
          ctx.lineTo(x - 90 * s, y + 2 * s);
          ctx.stroke();
      }

      if (has('kite') && !night) {                    // たこ
          const kx = W * 0.52 + Math.sin(t * 0.7) * 26 * s;
          const ky = H * 0.14 + Math.cos(t * 0.9) * 14 * s;
          ctx.strokeStyle = 'rgba(60,40,20,0.45)';
          ctx.lineWidth = 1.5 * s;
          ctx.beginPath();
          ctx.moveTo(W * 0.44, H * 0.80);
          ctx.quadraticCurveTo(kx - 20 * s, (ky + H * 0.8) / 2, kx, ky + 20 * s);
          ctx.stroke();
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.moveTo(kx, ky - 20 * s); ctx.lineTo(kx + 16 * s, ky);
          ctx.lineTo(kx, ky + 20 * s); ctx.lineTo(kx - 16 * s, ky);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#fde68a';
          ctx.beginPath();
          ctx.moveTo(kx, ky - 20 * s); ctx.lineTo(kx + 16 * s, ky); ctx.lineTo(kx, ky);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#f472b6';
          ctx.lineWidth = 2.5 * s;
          ctx.beginPath();
          ctx.moveTo(kx, ky + 20 * s);
          ctx.quadraticCurveTo(kx + 10 * s, ky + 32 * s, kx - 4 * s, ky + 44 * s);
          ctx.stroke();
      }

      if (has('star') && night) {                     // ながれぼし
          const q = (t * 0.25) % 1;
          const sx = W * (0.15 + q * 0.6), sy = H * (0.08 + q * 0.35);
          ctx.globalAlpha = Math.sin(q * Math.PI);
          ctx.strokeStyle = '#fef9c3';
          ctx.lineWidth = 3 * s;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - 40 * s, sy - 22 * s);
          ctx.stroke();
          ctx.fillStyle = '#fff';
          star(sx, sy, 5, 8 * s, 3.5 * s);
          ctx.globalAlpha = 1;
      }

      if (has('tent')) {                              // テント
          const x = W * 0.08, y = H * 0.97;
          ctx.fillStyle = night ? '#7f1d1d' : '#ef4444';
          ctx.beginPath();
          ctx.moveTo(x, y - 52 * s);
          ctx.lineTo(x + 40 * s, y);
          ctx.lineTo(x - 40 * s, y);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = night ? '#450a0a' : '#b91c1c';
          ctx.beginPath();
          ctx.moveTo(x, y - 52 * s);
          ctx.lineTo(x + 13 * s, y);
          ctx.lineTo(x - 13 * s, y);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = night ? '#292524' : '#451a03';
          ctx.beginPath();
          ctx.moveTo(x, y - 40 * s);
          ctx.lineTo(x + 9 * s, y);
          ctx.lineTo(x - 9 * s, y);
          ctx.closePath();
          ctx.fill();
      }

      if (has('bike')) {                              // じてんしゃ
          const x = W * 0.47, y = H * 0.97;
          ctx.strokeStyle = night ? '#334155' : '#0f172a';
          ctx.lineWidth = 3 * s;
          [-17, 17].forEach(function (q) {
              ctx.beginPath();
              ctx.arc(x + q * s, y - 12 * s, 12 * s, 0, Math.PI * 2);
              ctx.stroke();
          });
          ctx.strokeStyle = night ? '#1e40af' : '#2563eb';
          ctx.lineWidth = 4 * s;
          ctx.beginPath();
          ctx.moveTo(x - 17 * s, y - 12 * s);
          ctx.lineTo(x - 2 * s, y - 12 * s);
          ctx.lineTo(x + 6 * s, y - 28 * s);
          ctx.lineTo(x + 17 * s, y - 12 * s);
          ctx.moveTo(x - 2 * s, y - 12 * s);
          ctx.lineTo(x - 10 * s, y - 28 * s);
          ctx.stroke();
          ctx.fillStyle = night ? '#292524' : '#1f2937';
          ctx.fillRect(x - 16 * s, y - 32 * s, 13 * s, 5 * s);
      }

      if (has('pool')) {                              // ビニールプール
          const x = W * 0.62, y = H * 0.965;
          ctx.fillStyle = night ? '#1e3a8a' : '#38bdf8';
          ellipse(x, y - 8 * s, 34 * s, 12 * s);
          ctx.fillStyle = night ? '#1d4ed8' : '#7dd3fc';
          ellipse(x, y - 10 * s, 28 * s, 9 * s);
          ctx.strokeStyle = night ? '#7f1d1d' : '#f97316';
          ctx.lineWidth = 5 * s;
          ctx.beginPath();
          ctx.ellipse(x, y - 8 * s, 34 * s, 12 * s, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ellipse(x + 20 * s, y - 14 * s, 7 * s, 5 * s);
      }

      if (has('snowman')) {                           // ゆきだるま
          const x = W * 0.34, y = H * 0.96;
          ctx.fillStyle = '#f8fafc';
          ellipse(x, y - 13 * s, 16 * s, 13 * s);
          ellipse(x, y - 32 * s, 11 * s, 10 * s);
          ctx.fillStyle = '#1f2937';
          ellipse(x - 4 * s, y - 34 * s, 1.8 * s, 1.8 * s);
          ellipse(x + 4 * s, y - 34 * s, 1.8 * s, 1.8 * s);
          [0, 6, 12].forEach(function (q) { ellipse(x, y - 16 * s + q * s * 0.6, 1.8 * s, 1.8 * s); });
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.moveTo(x + 2 * s, y - 30 * s);
          ctx.lineTo(x + 14 * s, y - 28 * s);
          ctx.lineTo(x + 2 * s, y - 27 * s);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(x - 12 * s, y - 44 * s, 24 * s, 5 * s);
          ctx.fillRect(x - 8 * s, y - 54 * s, 16 * s, 11 * s);
      }

      if (has('rock')) {                              // いわ
          const x = W * 0.90, y = H * 0.96;
          ctx.fillStyle = night ? '#44403c' : '#9ca3af';
          ctx.beginPath();
          ctx.moveTo(x - 22 * s, y);
          ctx.lineTo(x - 15 * s, y - 16 * s);
          ctx.lineTo(x + 2 * s, y - 21 * s);
          ctx.lineTo(x + 18 * s, y - 12 * s);
          ctx.lineTo(x + 22 * s, y);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = night ? '#57534e' : '#d1d5db';
          ellipse(x - 6 * s, y - 12 * s, 7 * s, 4 * s);
      }

      if (has('mushroom')) {                          // きのこ
          ([[0.15, 1], [0.20, 0.8], [0.24, 0.6]] as const).forEach(function (mk) {
              const x = W * mk[0], y = H * 0.93, k = mk[1];
              ctx.fillStyle = '#fef3c7';
              ctx.fillRect(x - 4 * s * k, y - 12 * s * k, 8 * s * k, 12 * s * k);
              ctx.fillStyle = night ? '#7f1d1d' : '#ef4444';
              ellipse(x, y - 12 * s * k, 12 * s * k, 9 * s * k);
              ctx.fillStyle = '#fff';
              ellipse(x - 4 * s * k, y - 14 * s * k, 2.5 * s * k, 2 * s * k);
              ellipse(x + 4 * s * k, y - 12 * s * k, 2 * s * k, 1.6 * s * k);
          });
      }

      if (has('tree')) {
          const x = W * 0.12, y = H * 0.80;
          ctx.fillStyle = night ? '#4a2c10' : '#78350f';
          ctx.fillRect(x - 7 * s, y - 48 * s, 14 * s, 48 * s);
          ctx.fillStyle = night ? '#14532d' : '#22c55e';
          ellipse(x, y - 66 * s, 34 * s, 27 * s);
          ellipse(x - 23 * s, y - 52 * s, 21 * s, 17 * s);
          ellipse(x + 23 * s, y - 54 * s, 23 * s, 18 * s);
          ctx.fillStyle = night ? '#166534' : '#4ade80';
          ellipse(x - 8 * s, y - 74 * s, 14 * s, 11 * s);
      }

      if (has('flower')) {
          const fx = W * 0.30, fy = H * 0.81;
          ctx.fillStyle = night ? '#4a2c10' : '#78350f';
          ctx.fillRect(fx - 30 * s, fy - 7 * s, 60 * s, 8 * s);
          ([[-21, '#f472b6'], [-7, '#facc15'], [7, '#fb7185'], [21, '#a78bfa']] as const).forEach(function (f) {
              ctx.strokeStyle = night ? '#14532d' : '#16a34a';
              ctx.lineWidth = 2.5 * s;
              ctx.beginPath();
              ctx.moveTo(fx + f[0] * s, fy - 7 * s);
              ctx.lineTo(fx + f[0] * s, fy - 21 * s);
              ctx.stroke();
              ctx.fillStyle = f[1];
              for (let k = 0; k < 5; k++) {
                  const a = k / 5 * Math.PI * 2;
                  ellipse(fx + f[0] * s + Math.cos(a) * 5 * s, fy - 21 * s + Math.sin(a) * 5 * s, 3.5 * s, 3.5 * s);
              }
              ctx.fillStyle = '#fff';
              ellipse(fx + f[0] * s, fy - 21 * s, 2.5 * s, 2.5 * s);
          });
      }
  }

  // おうちに くっつく もの（おうちの あとに えがく）
  function drawHouseExtras(t: number) {
      const W = cw(), H = ch(), s = W / 380;
      const night = isNight();

      // げんかんから つづく いしだたみ
      ctx.fillStyle = night ? 'rgba(87,83,78,0.8)' : 'rgba(190,186,180,0.95)';
      ([[0.79, 0.855, 0.95], [0.772, 0.905, 1.2], [0.748, 0.965, 1.45]] as const).forEach(function (st2) {
          ctx.beginPath();
          ctx.ellipse(W * st2[0], H * st2[1], 15 * s * st2[2], 5 * s * st2[2], 0, 0, Math.PI * 2);
          ctx.fill();
      });

      if (has('sunflower')) {                         // ひまわり
          const x = W * 0.75, y = H * 0.95;
          ctx.strokeStyle = night ? '#14532d' : '#16a34a';
          ctx.lineWidth = 5 * s;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + 4 * s, y - 40 * s, x, y - 78 * s);
          ctx.stroke();
          ctx.fillStyle = night ? '#166534' : '#22c55e';
          ellipse(x - 14 * s, y - 40 * s, 14 * s, 7 * s);
          ellipse(x + 14 * s, y - 56 * s, 14 * s, 7 * s);
          ctx.fillStyle = night ? '#a16207' : '#facc15';
          for (let i = 0; i < 10; i++) {
              const a = i / 10 * Math.PI * 2;
              ellipse(x + Math.cos(a) * 17 * s, y - 78 * s + Math.sin(a) * 17 * s, 8 * s, 6 * s);
          }
          ctx.fillStyle = night ? '#451a03' : '#78350f';
          ellipse(x, y - 78 * s, 12 * s, 12 * s);
      }

      if (has('lantern')) {                           // ちょうちん
          const x = W * 0.70, y = H * 0.44 + Math.sin(t * 1.4) * 3 * s;
          ctx.strokeStyle = night ? '#4a2c10' : '#78350f';
          ctx.lineWidth = 2 * s;
          ctx.beginPath();
          ctx.moveTo(x, H * 0.30); ctx.lineTo(x, y - 16 * s);
          ctx.stroke();
          if (night) {
              ctx.fillStyle = 'rgba(248,113,113,0.30)';
              ellipse(x, y, 26 * s, 26 * s);
          }
          ctx.fillStyle = night ? '#fca5a5' : '#ef4444';
          ellipse(x, y, 14 * s, 18 * s);
          ctx.fillStyle = night ? '#7f1d1d' : '#b91c1c';
          ctx.fillRect(x - 8 * s, y - 19 * s, 16 * s, 4 * s);
          ctx.fillRect(x - 8 * s, y + 15 * s, 16 * s, 4 * s);
      }

      if (has('nameplate')) {                         // ひょうさつ（ドアの上）
          const x = W * 0.784, y = H * 0.625;
          ctx.fillStyle = night ? '#7c5a3a' : '#fbbf24';
          ctx.fillRect(x - 20 * s, y - 8 * s, 40 * s, 16 * s);
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 2.5 * s;
          ctx.strokeRect(x - 20 * s, y - 8 * s, 40 * s, 16 * s);
          ctx.fillStyle = '#451a03';
          ctx.font = `bold ${10 * s}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText((state.name || '').slice(0, 4), x, y + 4 * s);
          ctx.textAlign = 'left';
      }

      if (has('bird')) {                              // ことりが えんとつに とまる
          const x = W * 0.80 + 29 * s, y = H * 0.79 - 156 * s;
          const hop = Math.abs(Math.sin(t * 2)) * 3 * s;
          ctx.fillStyle = night ? '#7c5a3a' : '#38bdf8';
          ellipse(x, y - 6 * s - hop, 9 * s, 7 * s);
          ellipse(x + 6 * s, y - 12 * s - hop, 5.5 * s, 5 * s);
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.moveTo(x + 11 * s, y - 13 * s - hop);
          ctx.lineTo(x + 17 * s, y - 11 * s - hop);
          ctx.lineTo(x + 11 * s, y - 9 * s - hop);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#1f2937';
          ellipse(x + 7 * s, y - 13 * s - hop, 1.4 * s, 1.4 * s);
          ctx.fillStyle = night ? '#5b4636' : '#0ea5e9';
          ellipse(x - 3 * s, y - 6 * s - hop, 5 * s, 4 * s);
      }

      drawPost(t);
  }

  function drawPost(t: number) {
      if (!has('post')) return;
      const W = cw(), H = ch(), s = W / 380;
      const night = isNight();
      const x = W * 0.66, y = H * 0.84;
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ellipse(x, y, 12 * s, 4 * s);
      ctx.fillStyle = night ? '#4a2c10' : '#78350f';
      ctx.fillRect(x - 3 * s, y - 36 * s, 6 * s, 36 * s);
      ctx.fillStyle = night ? '#7f1d1d' : '#dc2626';
      ctx.fillRect(x - 14 * s, y - 55 * s, 28 * s, 21 * s);
      ctx.fillStyle = night ? '#450a0a' : '#991b1b';
      ctx.fillRect(x - 14 * s, y - 55 * s, 28 * s, 5 * s);
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(x - 8 * s, y - 47 * s, 16 * s, 3 * s);
      ctx.fillStyle = night ? '#a16207' : '#facc15';
      ctx.fillRect(x + 13 * s, y - 64 * s, 3 * s, 16 * s);
      ctx.fillRect(x + 16 * s, y - 64 * s, 11 * s, 8 * s);
  }

  // へやに かざるもの（かべ・おくの もの）
  function drawRoomStuff(t: number) {
      const W = cw(), H = ch(), s = W / 380;
      const night = isNight();

      if (has('hammock') && state.view === 'living') {        // ハンモック
          const y = H * 0.60;
          ctx.strokeStyle = night ? '#4a2c10' : '#78350f';
          ctx.lineWidth = 4 * s;
          [0.10, 0.60].forEach(function (q) {
              ctx.beginPath();
              ctx.moveTo(W * q, H * 0.74); ctx.lineTo(W * q, y - H * 0.04);
              ctx.stroke();
          });
          ctx.fillStyle = night ? '#4a6b73' : '#7dd3fc';
          ctx.beginPath();
          ctx.moveTo(W * 0.10, y - H * 0.04);
          ctx.quadraticCurveTo(W * 0.35, y + H * 0.10, W * 0.60, y - H * 0.04);
          ctx.quadraticCurveTo(W * 0.35, y + H * 0.05, W * 0.10, y - H * 0.04);
          ctx.closePath();
          ctx.fill();
      }

      if (has('bigart') && state.view === 'living') {         // おおきな え
          const x = W * 0.875, y = H * 0.46;
          ctx.fillStyle = night ? '#6b5a3a' : '#a16207';
          ctx.fillRect(x - W * 0.075, y - H * 0.11, W * 0.15, H * 0.22);
          ctx.fillStyle = night ? '#3f5b63' : '#7dd3fc';
          ctx.fillRect(x - W * 0.065, y - H * 0.10, W * 0.13, H * 0.20);
          ctx.fillStyle = night ? '#4b5b46' : '#86efac';
          ctx.fillRect(x - W * 0.065, y + H * 0.02, W * 0.13, H * 0.08);
          ctx.fillStyle = night ? '#7c6f4a' : '#facc15';
          ellipse(x + W * 0.03, y - H * 0.05, 8 * s, 8 * s);
          ctx.fillStyle = night ? '#4b3418' : '#78350f';
          ctx.fillRect(x - W * 0.04, y - H * 0.005, 4 * s, 22 * s);
          ctx.fillStyle = night ? '#166534' : '#22c55e';
          ellipse(x - W * 0.038, y - H * 0.02, 13 * s, 9 * s);
      }

      if (has('trumpet') && state.view === 'living') {        // トランペット
          const x = W * 0.37, y = H * 0.44;
          ctx.fillStyle = night ? '#a16207' : '#fbbf24';
          ctx.fillRect(x - 16 * s, y - 4 * s, 26 * s, 7 * s);
          ctx.beginPath();
          ctx.moveTo(x + 10 * s, y - 12 * s);
          ctx.lineTo(x + 22 * s, y - 16 * s);
          ctx.lineTo(x + 22 * s, y + 15 * s);
          ctx.lineTo(x + 10 * s, y + 11 * s);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = night ? '#78350f' : '#d97706';
          [-10, -4, 2].forEach(function (q) { ctx.fillRect(x + q * s, y - 10 * s, 3 * s, 7 * s); });
      }

      if (has('phone') && state.view === 'living') {          // でんわ
          const x = W * 0.755, y = H * 0.655;
          ctx.fillStyle = night ? '#7f1d1d' : '#ef4444';
          ctx.fillRect(x - 12 * s, y - 10 * s, 24 * s, 18 * s);
          ctx.fillStyle = night ? '#450a0a' : '#b91c1c';
          ctx.fillRect(x - 15 * s, y - 15 * s, 30 * s, 7 * s);
          ctx.strokeStyle = night ? '#450a0a' : '#b91c1c';
          ctx.lineWidth = 2 * s;
          ctx.beginPath();
          ctx.moveTo(x + 12 * s, y - 2 * s);
          ctx.quadraticCurveTo(x + 22 * s, y + 8 * s, x + 14 * s, y + 14 * s);
          ctx.stroke();
      }

      if (has('windowplant') && state.view === 'living') {    // まどべの はち
          const x = W * 0.275, y = H * 0.485;
          ctx.fillStyle = night ? '#7c2d12' : '#c2410c';
          ctx.fillRect(x - 9 * s, y - 10 * s, 18 * s, 12 * s);
          ctx.fillStyle = night ? '#166534' : '#22c55e';
          ellipse(x - 6 * s, y - 16 * s, 8 * s, 6 * s);
          ellipse(x + 6 * s, y - 17 * s, 8 * s, 6 * s);
          ellipse(x, y - 22 * s, 7 * s, 6 * s);
      }

      if (has('ivy')) {                                       // かべの ツタ
          ctx.strokeStyle = night ? '#166534' : '#22c55e';
          ctx.lineWidth = 2.5 * s;
          [0.02, 0.055].forEach(function (q, k) {
              ctx.beginPath();
              ctx.moveTo(W * q, H * 0.07);
              ctx.quadraticCurveTo(W * (q + 0.03), H * 0.28, W * (q + 0.005), H * 0.50);
              ctx.stroke();
              for (let i = 0; i < 6; i++) {
                  ctx.fillStyle = night ? '#14532d' : (i % 2 ? '#4ade80' : '#22c55e');
                  ellipse(W * (q + 0.02 + (i % 2 ? 0.012 : -0.012)), H * (0.10 + i * 0.07 + k * 0.02), 6 * s, 4.5 * s);
              }
          });
      }

      if (has('floorlamp') && state.view === 'living') {      // スタンドライト
          const x = W * 0.335, y = H * 0.90;
          ctx.fillStyle = night ? '#475569' : '#64748b';
          ellipse(x, y, 15 * s, 5 * s);
          ctx.fillRect(x - 2 * s, y - 74 * s, 4 * s, 74 * s);
          if (night) {
              ctx.fillStyle = 'rgba(253,230,138,0.28)';
              ellipse(x, y - 70 * s, 34 * s, 34 * s);
          }
          ctx.fillStyle = night ? '#fde68a' : '#f8fafc';
          ctx.beginPath();
          ctx.moveTo(x - 20 * s, y - 66 * s);
          ctx.lineTo(x + 20 * s, y - 66 * s);
          ctx.lineTo(x + 13 * s, y - 90 * s);
          ctx.lineTo(x - 13 * s, y - 90 * s);
          ctx.closePath();
          ctx.fill();
      }

      if (has('globe') && state.view === 'living') {          // ちきゅうぎ
          const x = W * 0.29, y = H * 0.565;
          ctx.fillStyle = night ? '#4b3418' : '#a16207';
          ctx.fillRect(x - 8 * s, y + 8 * s, 16 * s, 4 * s);
          ctx.fillRect(x - 1.5 * s, y, 3 * s, 10 * s);
          ctx.fillStyle = night ? '#3f5b63' : '#38bdf8';
          ellipse(x, y - 8 * s, 11 * s, 11 * s);
          ctx.fillStyle = night ? '#166534' : '#4ade80';
          ellipse(x - 3 * s, y - 10 * s, 5 * s, 3.5 * s);
          ellipse(x + 4 * s, y - 5 * s, 4 * s, 3 * s);
      }

      if (has('radio') && state.view === 'living') {          // ラジカセ
          const x = W * 0.235, y = H * 0.565;
          ctx.fillStyle = night ? '#475569' : '#64748b';
          ctx.fillRect(x - 18 * s, y - 12 * s, 36 * s, 24 * s);
          ctx.fillStyle = night ? '#1e293b' : '#334155';
          ellipse(x - 8 * s, y + 1 * s, 6 * s, 6 * s);
          ellipse(x + 8 * s, y + 1 * s, 6 * s, 6 * s);
          ctx.fillStyle = night ? '#7c6f4a' : '#facc15';
          ctx.fillRect(x - 14 * s, y - 9 * s, 28 * s, 4 * s);
      }

      if (has('manga') && state.view === 'living') {          // まんがの やま
          const x = W * 0.485, y = H * 0.905;
          ([['#ef4444', 0], ['#38bdf8', -5], ['#facc15', -10], ['#4ade80', -15]] as const).forEach(function (bk) {
              ctx.fillStyle = night ? 'rgba(255,255,255,0.25)' : bk[0];
              ctx.fillRect(x - 14 * s + (bk[1] % 3) * s, y + bk[1] * s, 28 * s, 5 * s);
          });
      }

      if (has('toybox') && state.view === 'living') {         // おもちゃばこ
          const x = W * 0.155, y = H * 0.93;
          ctx.fillStyle = night ? '#7c2d12' : '#f97316';
          ctx.fillRect(x - 22 * s, y - 24 * s, 44 * s, 24 * s);
          ctx.fillStyle = night ? '#9a3412' : '#fb923c';
          ctx.fillRect(x - 24 * s, y - 29 * s, 48 * s, 6 * s);
          ctx.fillStyle = night ? 'rgba(255,255,255,0.25)' : '#facc15';
          ellipse(x - 8 * s, y - 33 * s, 7 * s, 7 * s);
          ctx.fillStyle = night ? 'rgba(255,255,255,0.25)' : '#38bdf8';
          ctx.fillRect(x + 4 * s, y - 38 * s, 10 * s, 10 * s);
      }

      if (has('grandclock') && state.view === 'living') {     // ふるどけい
          const x = W * 0.74, y = H * 0.74;
          ctx.fillStyle = night ? '#4b3418' : '#92400e';
          ctx.fillRect(x - 16 * s, y - 96 * s, 32 * s, 96 * s);
          ctx.fillStyle = night ? '#292524' : '#78350f';
          ctx.fillRect(x - 20 * s, y - 104 * s, 40 * s, 10 * s);
          ctx.fillStyle = night ? '#d6d3d1' : '#fffbeb';
          ellipse(x, y - 76 * s, 12 * s, 12 * s);
          ctx.strokeStyle = '#1f2937';
          ctx.lineWidth = 1.8 * s;
          ctx.beginPath();
          ctx.moveTo(x, y - 76 * s); ctx.lineTo(x, y - 83 * s);
          ctx.moveTo(x, y - 76 * s); ctx.lineTo(x + 5 * s, y - 74 * s);
          ctx.stroke();
          ctx.fillStyle = night ? '#3f2d1f' : '#451a03';
          ctx.fillRect(x - 10 * s, y - 58 * s, 20 * s, 44 * s);
          ctx.fillStyle = '#fbbf24';                          // ふりこ
          ellipse(x + Math.sin(t * 2) * 6 * s, y - 24 * s, 6 * s, 6 * s);
      }

      if (has('tower') && state.view === 'living') {          // キャットタワー
          const x = W * 0.07, y = H * 0.90;
          ctx.fillStyle = night ? '#5b4636' : '#d6a15b';
          ctx.fillRect(x - 26 * s, y - 6 * s, 52 * s, 8 * s);
          ctx.fillStyle = night ? '#4b3418' : '#b4813f';
          ctx.fillRect(x - 6 * s, y - 60 * s, 12 * s, 56 * s);
          ctx.fillStyle = night ? '#7f5f8f' : '#fbcfe8';
          ctx.fillRect(x - 22 * s, y - 34 * s, 30 * s, 8 * s);
          ctx.fillRect(x - 4 * s, y - 70 * s, 34 * s, 9 * s);
          ctx.fillStyle = night ? '#5b4a73' : '#c4b5fd';
          ellipse(x + 13 * s, y - 74 * s, 12 * s, 6 * s);
      }

      if (has('wallshelf') && state.view === 'living') {      // かべの たな
          const x = W * 0.30, y = H * 0.60;
          ctx.fillStyle = night ? '#4b3418' : '#a16207';
          ctx.fillRect(x - W * 0.06, y, W * 0.12, H * 0.014);
          ctx.fillStyle = night ? '#5b7fa8' : '#7dd3fc';
          ellipse(x - W * 0.035, y - H * 0.018, 6 * s, 8 * s);
          ctx.fillStyle = night ? '#166534' : '#22c55e';
          ellipse(x + W * 0.005, y - H * 0.016, 7 * s, 7 * s);
          ctx.fillStyle = night ? '#7f1d1d' : '#ef4444';
          ctx.fillRect(x + W * 0.03, y - H * 0.03, W * 0.012, H * 0.03);
          ctx.fillStyle = night ? '#a16207' : '#facc15';
          ctx.fillRect(x + W * 0.044, y - H * 0.026, W * 0.012, H * 0.026);
      }

      if (has('tv')) {                                        // かべかけテレビ
          const x = W * 0.09, y = H * 0.46;
          ctx.fillStyle = '#57534e';
          ctx.fillRect(x - 5 * s, y + 17 * s, 10 * s, 7 * s);
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(x - 30 * s, y - 20 * s, 60 * s, 38 * s);
          ctx.fillStyle = night ? '#334155' : '#7dd3fc';
          ctx.fillRect(x - 26 * s, y - 16 * s, 52 * s, 30 * s);
          if (!night) {
              ctx.fillStyle = 'rgba(255,255,255,0.7)';
              ctx.fillRect(x - 22 * s, y - 12 * s, 18 * s, 3 * s);
              ctx.fillStyle = '#fde68a';
              ellipse(x + 11 * s, y - 3 * s, 8 * s, 8 * s);
              ctx.fillStyle = '#86efac';
              ctx.fillRect(x - 26 * s, y + 8 * s, 52 * s, 6 * s);
          }
      }

      if (has('shelf')) {
          const x = W * 0.55, y = H * 0.81;
          ctx.fillStyle = night ? '#6b4a2a' : '#a16207';
          ctx.fillRect(x - 25 * s, y - 66 * s, 50 * s, 66 * s);
          const books = [['#ef4444', '#facc15', '#38bdf8'], ['#4ade80', '#f472b6'], ['#a78bfa', '#fb923c', '#22d3ee']];
          for (let i = 0; i < 3; i++) {
              const sy = y - (62 - i * 21) * s;
              ctx.fillStyle = night ? '#3b2f4f' : '#fde8c8';
              ctx.fillRect(x - 21 * s, sy, 42 * s, 17 * s);
              books[i].forEach(function (c, k) {
                  ctx.fillStyle = night ? 'rgba(0,0,0,0.35)' : c;
                  ctx.fillRect(x - 18 * s + k * 9 * s, sy + 3 * s, 6 * s, 13 * s);
              });
          }
      }

      if (has('plant')) {
          const x = W * 0.93, y = H * 0.87;
          ctx.fillStyle = night ? '#7c2d12' : '#c2410c';
          ctx.beginPath();
          ctx.moveTo(x - 14 * s, y - 20 * s);
          ctx.lineTo(x + 14 * s, y - 20 * s);
          ctx.lineTo(x + 9 * s, y);
          ctx.lineTo(x - 9 * s, y);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = night ? '#166534' : '#22c55e';
          ellipse(x, y - 34 * s, 9 * s, 16 * s);
          ellipse(x - 13 * s, y - 28 * s, 13 * s, 8 * s);
          ellipse(x + 13 * s, y - 30 * s, 13 * s, 8 * s);
      }

      if (has('curtain')) {                                   // カーテン（よるは しまる）
          const wx = W * 0.17, wy = H * 0.18, ww = W * 0.21, wh = H * 0.30;
          ctx.fillStyle = night ? '#5b4636' : '#92400e';
          ctx.fillRect(wx - 11 * s, wy - 11 * s, ww + 22 * s, 6 * s);
          const panel = night ? ww * 0.52 : ww * 0.23;
          ctx.fillStyle = night ? '#a78bfa' : '#f9a8d4';
          ctx.fillRect(wx - 7 * s, wy - 7 * s, panel, wh + 8 * s);
          ctx.fillRect(wx + ww + 7 * s - panel, wy - 7 * s, panel, wh + 8 * s);
          ctx.strokeStyle = 'rgba(0,0,0,0.13)';
          ctx.lineWidth = 2 * s;
          [0.33, 0.66].forEach(function (q) {
              ctx.beginPath();
              ctx.moveTo(wx - 7 * s + panel * q, wy - 7 * s);
              ctx.lineTo(wx - 7 * s + panel * q, wy + wh);
              ctx.moveTo(wx + ww + 7 * s - panel + panel * q, wy - 7 * s);
              ctx.lineTo(wx + ww + 7 * s - panel + panel * q, wy + wh);
              ctx.stroke();
          });
      }

      if (has('clock')) {                                     // かべどけい（いまの じかん）
          const x = W * 0.62, y = H * 0.30, r = W * 0.042;
          ctx.fillStyle = night ? '#6b5a3a' : '#a16207';
          ellipse(x, y, r + 3 * s, r + 3 * s);
          ctx.fillStyle = night ? '#d6d3d1' : '#fffbeb';
          ellipse(x, y, r, r);
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 2 * s;
          for (let i = 0; i < 12; i++) {
              const a = i / 12 * Math.PI * 2;
              ctx.beginPath();
              ctx.moveTo(x + Math.cos(a) * r * 0.76, y + Math.sin(a) * r * 0.76);
              ctx.lineTo(x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92);
              ctx.stroke();
          }
          const d = new Date();
          const hA = ((d.getHours() % 12) + d.getMinutes() / 60) / 12 * Math.PI * 2 - Math.PI / 2;
          const mA = d.getMinutes() / 60 * Math.PI * 2 - Math.PI / 2;
          ctx.strokeStyle = '#1f2937';
          ctx.lineCap = 'round';
          ctx.lineWidth = 4 * s;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(hA) * r * 0.5, y + Math.sin(hA) * r * 0.5);
          ctx.stroke();
          ctx.lineWidth = 2.5 * s;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(mA) * r * 0.74, y + Math.sin(mA) * r * 0.74);
          ctx.stroke();
          ctx.fillStyle = '#dc2626';
          ellipse(x, y, 2.5 * s, 2.5 * s);
      }

      if (has('aircon')) {                                    // エアコン
          const x = W * 0.86, y = H * 0.11;
          ctx.fillStyle = night ? '#cbd5e1' : '#f8fafc';
          ctx.fillRect(x - 30 * s, y - 12 * s, 60 * s, 24 * s);
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 2 * s;
          ctx.strokeRect(x - 30 * s, y - 12 * s, 60 * s, 24 * s);
          ctx.fillStyle = night ? '#94a3b8' : '#e2e8f0';
          ctx.fillRect(x - 26 * s, y + 3 * s, 52 * s, 6 * s);
          ctx.fillStyle = '#38bdf8';
          ellipse(x + 23 * s, y - 6 * s, 3 * s, 3 * s);
          ctx.strokeStyle = 'rgba(56,189,248,0.5)';
          ctx.lineWidth = 2.5 * s;
          [0, 1].forEach(function (i) {
              const yy = y + (18 + i * 10) * s;
              ctx.beginPath();
              ctx.moveTo(x - 16 * s + i * 10 * s, yy);
              ctx.quadraticCurveTo(x - 4 * s + i * 10 * s, yy + 6 * s, x + 8 * s + i * 10 * s, yy);
              ctx.stroke();
          });
      }

  }

  // キッチンに おく もの
  function drawKitchenStuff(t: number) {
      const W = cw(), H = ch(), s = W / 380;
      const night = isNight();
      const cy = H * 0.62;

      if (has('herbtea')) {                                   // やくそうティー
          const x = W * 0.185, y = cy;
          ctx.fillStyle = night ? '#166534' : '#4ade80';
          ctx.fillRect(x - 7 * s, y - 18 * s, 14 * s, 18 * s);
          ctx.fillStyle = night ? '#14532d' : '#22c55e';
          ctx.fillRect(x - 8 * s, y - 22 * s, 16 * s, 5 * s);
          ctx.fillStyle = '#fff';
          ctx.fillRect(x - 4 * s, y - 12 * s, 8 * s, 6 * s);
      }

      if (has('protein')) {                                   // プロテイン
          const x = W * 0.415, y = cy;
          ctx.fillStyle = night ? '#7f1d1d' : '#ef4444';
          ctx.fillRect(x - 9 * s, y - 24 * s, 18 * s, 24 * s);
          ctx.fillStyle = night ? '#450a0a' : '#b91c1c';
          ctx.fillRect(x - 6 * s, y - 29 * s, 12 * s, 6 * s);
          ctx.fillStyle = '#fff';
          ctx.fillRect(x - 7 * s, y - 16 * s, 14 * s, 7 * s);
      }

      if (has('brush')) {                                     // はブラシ
          const x = W * 0.115, y = cy - H * 0.02;
          ctx.fillStyle = night ? '#5b7fa8' : '#38bdf8';
          ctx.fillRect(x - 2 * s, y - 20 * s, 4 * s, 20 * s);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(x - 4 * s, y - 26 * s, 8 * s, 7 * s);
      }

      if (has('soap')) {                                      // いい せっけん
          ctx.fillStyle = night ? '#7f5f8f' : '#fbcfe8';
          ctx.fillRect(W * 0.135, cy - H * 0.022, W * 0.028, H * 0.018);
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ellipse(W * 0.145, cy - H * 0.026, 3 * s, 2 * s);
      }

      if (has('firstaid')) {                                  // きゅうきゅうばこ
          const x = W * 0.60, y = H * 0.30;
          ctx.fillStyle = night ? '#94a3b8' : '#f8fafc';
          ctx.fillRect(x - W * 0.045, y - H * 0.05, W * 0.09, H * 0.10);
          ctx.strokeStyle = night ? '#475569' : '#cbd5e1';
          ctx.lineWidth = 2;
          ctx.strokeRect(x - W * 0.045, y - H * 0.05, W * 0.09, H * 0.10);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(x - W * 0.006, y - H * 0.032, W * 0.012, H * 0.064);
          ctx.fillRect(x - W * 0.03, y - H * 0.008, W * 0.06, H * 0.016);
      }

      if (has('vitamin')) {                                   // ビタミンざい
          const x = W * 0.335, y = cy;
          ctx.fillStyle = night ? '#a16207' : '#facc15';
          ctx.fillRect(x - 7 * s, y - 20 * s, 14 * s, 20 * s);
          ctx.fillStyle = night ? '#78350f' : '#d97706';
          ctx.fillRect(x - 5 * s, y - 25 * s, 10 * s, 6 * s);
          ctx.fillStyle = '#fff';
          ctx.fillRect(x - 5 * s, y - 14 * s, 10 * s, 6 * s);
      }

      if (has('takoyaki')) {                                  // たこやきき
          const x = W * 0.53, y = H * 0.93;
          ctx.fillStyle = night ? '#334155' : '#475569';
          ctx.fillRect(x - 20 * s, y - 16 * s, 40 * s, 16 * s);
          ctx.fillStyle = night ? '#1e293b' : '#1f2937';
          ctx.fillRect(x - 17 * s, y - 20 * s, 34 * s, 6 * s);
          [-11, -4, 3, 10].forEach(function (q) {
              ctx.fillStyle = night ? '#7c2d12' : '#d97706';
              ellipse(x + q * s, y - 18 * s, 3.5 * s, 2.5 * s);
          });
      }

      if (has('juicer')) {                                    // ジューサー
          const x = W * 0.44, y = H * 0.93;
          ctx.fillStyle = night ? '#64748b' : '#e2e8f0';
          ctx.fillRect(x - 10 * s, y - 12 * s, 20 * s, 12 * s);
          ctx.fillStyle = night ? '#a16207' : '#fb923c';
          ctx.fillRect(x - 8 * s, y - 30 * s, 16 * s, 18 * s);
          ctx.fillStyle = night ? '#475569' : '#94a3b8';
          ctx.fillRect(x - 10 * s, y - 34 * s, 20 * s, 5 * s);
      }

      if (has('breadmk')) {                                   // パンやきき
          const x = W * 0.245, y = H * 0.93;
          ctx.fillStyle = night ? '#64748b' : '#cbd5e1';
          ctx.fillRect(x - 14 * s, y - 26 * s, 28 * s, 26 * s);
          ctx.fillStyle = night ? '#475569' : '#94a3b8';
          ctx.fillRect(x - 16 * s, y - 31 * s, 32 * s, 6 * s);
          ctx.fillStyle = night ? '#7c2d12' : '#d97706';
          ellipse(x, y - 34 * s, 9 * s, 5 * s);
      }

      if (has('jug')) {                                       // みずさし
          const x = W * 0.455, y = cy;
          ctx.fillStyle = night ? '#5b7fa8' : '#bae6fd';
          ctx.fillRect(x - 7 * s, y - 26 * s, 14 * s, 26 * s);
          ctx.fillStyle = night ? '#3f6b8f' : '#7dd3fc';
          ctx.fillRect(x - 7 * s, y - 14 * s, 14 * s, 14 * s);
          ctx.strokeStyle = night ? '#5b7fa8' : '#bae6fd';
          ctx.lineWidth = 2.5 * s;
          ctx.beginPath();
          ctx.arc(x + 11 * s, y - 16 * s, 6 * s, Math.PI * 1.5, Math.PI * 0.5);
          ctx.stroke();
      }

      if (has('cans')) {                                      // かんづめの たな
          ctx.fillStyle = night ? '#4b3418' : '#a16207';
          ctx.fillRect(W * 0.36, H * 0.46, W * 0.13, H * 0.012);
          ([['#ef4444', 0.375], ['#4ade80', 0.405], ['#facc15', 0.435], ['#38bdf8', 0.465]] as const).forEach(function (c) {
              ctx.fillStyle = night ? 'rgba(255,255,255,0.3)' : c[0];
              ctx.fillRect(W * c[1], H * 0.435, W * 0.02, H * 0.025);
              ctx.fillStyle = 'rgba(255,255,255,0.5)';
              ctx.fillRect(W * c[1], H * 0.443, W * 0.02, H * 0.006);
          });
      }

      if (has('garlic')) {                                    // つるした にんにく
          const x = W * 0.53, y = H * 0.24;
          ctx.strokeStyle = night ? '#6b5a3a' : '#a16207';
          ctx.lineWidth = 2 * s;
          ctx.beginPath();
          ctx.moveTo(x, y); ctx.lineTo(x, y + 14 * s);
          ctx.stroke();
          ctx.fillStyle = night ? '#d6d3d1' : '#f5f5f4';
          ([[0, 16], [-6, 24], [6, 26], [0, 33]] as const).forEach(function (g) {
              ellipse(x + g[0] * s, y + g[1] * s, 6 * s, 7 * s);
          });
      }

      if (has('towel')) {                                     // ふきん
          const x = W * 0.30, y = cy + H * 0.06;
          ctx.fillStyle = night ? '#5b7fa8' : '#93c5fd';
          ctx.fillRect(x - 9 * s, y, 18 * s, 22 * s);
          ctx.fillStyle = night ? '#3f6b8f' : '#60a5fa';
          ctx.fillRect(x - 9 * s, y + 8 * s, 18 * s, 4 * s);
      }

      if (has('pot')) {                                       // なべ
          ctx.fillStyle = night ? '#475569' : '#94a3b8';
          ctx.fillRect(W * 0.28, cy - H * 0.03, W * 0.055, H * 0.03);
          ctx.fillStyle = night ? '#334155' : '#cbd5e1';
          ctx.fillRect(W * 0.275, cy - H * 0.038, W * 0.065, H * 0.01);
          ctx.fillStyle = night ? '#7f1d1d' : '#ef4444';
          ellipse(W * 0.3075, cy - H * 0.042, 3 * s, 3 * s);
      }

      if (has('board')) {                                     // まないた
          ctx.fillStyle = night ? '#6b4a24' : '#d6a15b';
          ctx.fillRect(W * 0.06, cy - H * 0.085, W * 0.03, H * 0.085);
          ctx.fillStyle = night ? '#94a3b8' : '#e2e8f0';
          ctx.fillRect(W * 0.095, cy - H * 0.08, W * 0.008, H * 0.055);
          ctx.fillStyle = night ? '#4b3418' : '#78350f';
          ctx.fillRect(W * 0.095, cy - H * 0.028, W * 0.008, H * 0.028);
      }

      if (has('apron')) {                                     // エプロン
          const x = W * 0.72, y = H * 0.42;
          ctx.strokeStyle = night ? '#64748b' : '#94a3b8';
          ctx.lineWidth = 2 * s;
          ctx.beginPath();
          ctx.moveTo(x - 8 * s, y); ctx.lineTo(x, y + 8 * s); ctx.lineTo(x + 8 * s, y);
          ctx.stroke();
          ctx.fillStyle = night ? '#7f5f8f' : '#f9a8d4';
          ctx.beginPath();
          ctx.moveTo(x - 10 * s, y + 8 * s);
          ctx.lineTo(x + 10 * s, y + 8 * s);
          ctx.lineTo(x + 15 * s, y + 46 * s);
          ctx.lineTo(x - 15 * s, y + 46 * s);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.fillRect(x - 9 * s, y + 26 * s, 18 * s, 10 * s);
      }

      if (has('kclock')) {                                    // キッチンどけい
          const x = W * 0.55, y = H * 0.20, r = W * 0.032;
          ctx.fillStyle = night ? '#475569' : '#f8fafc';
          ellipse(x, y, r + 2 * s, r + 2 * s);
          ctx.fillStyle = night ? '#94a3b8' : '#e2e8f0';
          ellipse(x, y, r, r);
          const d2 = new Date();
          const hA2 = ((d2.getHours() % 12) + d2.getMinutes() / 60) / 12 * Math.PI * 2 - Math.PI / 2;
          const mA2 = d2.getMinutes() / 60 * Math.PI * 2 - Math.PI / 2;
          ctx.strokeStyle = '#1f2937';
          ctx.lineCap = 'round';
          ctx.lineWidth = 3 * s;
          ctx.beginPath();
          ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(hA2) * r * 0.5, y + Math.sin(hA2) * r * 0.5);
          ctx.stroke();
          ctx.lineWidth = 2 * s;
          ctx.beginPath();
          ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(mA2) * r * 0.75, y + Math.sin(mA2) * r * 0.75);
          ctx.stroke();
      }

      if (has('plates')) {                                    // おさらの たな
          ctx.fillStyle = night ? '#4b3418' : '#a16207';
          ctx.fillRect(W * 0.06, H * 0.52, W * 0.14, H * 0.012);
          [0.085, 0.12, 0.155].forEach(function (q, i) {
              ctx.fillStyle = night ? '#64748b' : '#f8fafc';
              ellipse(W * q, H * 0.505, 9 * s, 9 * s);
              ctx.fillStyle = night ? '#475569' : ['#7dd3fc', '#fbcfe8', '#fde68a'][i];
              ellipse(W * q, H * 0.505, 5 * s, 5 * s);
          });
      }

      if (has('trashbag')) {                                  // ゴミぶくろ
          const x = W * 0.10, y = H * 0.955;
          ctx.fillStyle = night ? '#334155' : '#94a3b8';
          ellipse(x, y - 12 * s, 15 * s, 13 * s);
          ctx.beginPath();
          ctx.moveTo(x - 6 * s, y - 22 * s);
          ctx.lineTo(x, y - 30 * s);
          ctx.lineTo(x + 6 * s, y - 22 * s);
          ctx.closePath();
          ctx.fill();
      }

      if (has('pan')) {                                       // フライパン
          ctx.fillStyle = night ? '#334155' : '#1f2937';
          ellipse(W * 0.39, H * 0.33, 15 * s, 13 * s);
          ctx.fillStyle = night ? '#1e293b' : '#0f172a';
          ctx.fillRect(W * 0.39 + 12 * s, H * 0.33 - 3 * s, 22 * s, 5 * s);
          ctx.fillStyle = night ? '#475569' : '#64748b';
          ellipse(W * 0.39, H * 0.33, 10 * s, 8 * s);
      }

      if (has('ladle')) {                                     // おたま
          ctx.strokeStyle = night ? '#64748b' : '#94a3b8';
          ctx.lineWidth = 3.5 * s;
          ctx.beginPath();
          ctx.moveTo(W * 0.45, H * 0.27);
          ctx.lineTo(W * 0.45, H * 0.35);
          ctx.stroke();
          ctx.fillStyle = night ? '#64748b' : '#cbd5e1';
          ctx.beginPath();
          ctx.arc(W * 0.45, H * 0.36, 7 * s, 0, Math.PI);
          ctx.fill();
      }

      if (has('spice')) {                                     // ちょうみりょう
          ctx.fillStyle = night ? '#4b3418' : '#a16207';
          ctx.fillRect(W * 0.06, H * 0.46, W * 0.14, H * 0.012);
          ([['#ef4444', 0.075], ['#facc15', 0.105], ['#22c55e', 0.135], ['#f8fafc', 0.165]] as const).forEach(function (b) {
              ctx.fillStyle = night ? 'rgba(255,255,255,0.35)' : b[0];
              ctx.fillRect(W * b[1], H * 0.435, W * 0.018, H * 0.025);
          });
      }

      if (has('sponge')) {                                    // スポンジと せんざい
          ctx.fillStyle = night ? '#4a6b73' : '#7dd3fc';
          ctx.fillRect(W * 0.075, cy - H * 0.03, W * 0.02, H * 0.028);
          ctx.fillStyle = night ? '#7f5f8f' : '#f472b6';
          ctx.fillRect(W * 0.10, cy - H * 0.038, W * 0.016, H * 0.036);
          ctx.fillStyle = night ? '#94a3b8' : '#e2e8f0';
          ctx.fillRect(W * 0.104, cy - H * 0.048, W * 0.008, H * 0.012);
      }

      if (has('herb')) {                                      // ハーブの はち
          ctx.fillStyle = night ? '#7c2d12' : '#c2410c';
          ctx.fillRect(W * 0.228, cy - H * 0.03, W * 0.03, H * 0.03);
          ctx.fillStyle = night ? '#166534' : '#22c55e';
          ellipse(W * 0.243, cy - H * 0.045, 9 * s, 7 * s);
          ellipse(W * 0.231, cy - H * 0.055, 6 * s, 5 * s);
          ellipse(W * 0.256, cy - H * 0.052, 6 * s, 5 * s);
      }

      if (has('toaster')) {                                   // トースター
          ctx.fillStyle = night ? '#64748b' : '#e2e8f0';
          ctx.fillRect(W * 0.415, cy - H * 0.045, W * 0.07, H * 0.045);
          ctx.fillStyle = night ? '#334155' : '#94a3b8';
          ctx.fillRect(W * 0.43, cy - H * 0.05, W * 0.04, H * 0.008);
          ctx.fillStyle = '#f97316';
          ellipse(W * 0.477, cy - H * 0.02, 2.5 * s, 2.5 * s);
      }

      if (has('microwave')) {                                 // でんしレンジ（れいぞうこの上）
          const x = W * 0.56, y = H * 0.415;
          ctx.fillStyle = night ? '#475569' : '#64748b';
          ctx.fillRect(x - W * 0.06, y - H * 0.075, W * 0.12, H * 0.075);
          ctx.fillStyle = night ? '#1e293b' : '#334155';
          ctx.fillRect(x - W * 0.05, y - H * 0.065, W * 0.075, H * 0.055);
          ctx.fillStyle = night ? '#3f5b63' : '#7dd3fc';
          ctx.fillRect(x - W * 0.045, y - H * 0.06, W * 0.065, H * 0.045);
          ctx.fillStyle = '#facc15';
          ctx.fillRect(x + W * 0.032, y - H * 0.055, W * 0.018, H * 0.008);
      }

      if (has('ricecooker')) {                                // すいはんき
          const x = W * 0.50, y = H * 0.93;
          ctx.fillStyle = night ? '#94a3b8' : '#f8fafc';
          ctx.fillRect(x - 17 * s, y - 26 * s, 34 * s, 26 * s);
          ctx.fillStyle = night ? '#64748b' : '#cbd5e1';
          ctx.fillRect(x - 19 * s, y - 32 * s, 38 * s, 7 * s);
          ctx.fillStyle = '#ef4444';
          ellipse(x + 9 * s, y - 14 * s, 2.5 * s, 2.5 * s);
          if (!night) {
              ctx.fillStyle = 'rgba(255,255,255,0.6)';
              ellipse(x, y - 40 * s + Math.sin(t * 2) * 3 * s, 7 * s, 5 * s);
          }
      }

      if (has('coffee')) {                                    // コーヒーメーカー
          const x = W * 0.585, y = H * 0.94;
          ctx.fillStyle = night ? '#334155' : '#1f2937';
          ctx.fillRect(x - 12 * s, y - 34 * s, 24 * s, 34 * s);
          ctx.fillStyle = night ? '#7c2d12' : '#b45309';
          ctx.fillRect(x - 8 * s, y - 16 * s, 16 * s, 12 * s);
          ctx.fillStyle = '#ef4444';
          ellipse(x + 7 * s, y - 28 * s, 2 * s, 2 * s);
      }

      if (has('kmat')) {                                      // キッチンマット
          ctx.fillStyle = night ? '#4b3418' : '#fca5a5';
          ctx.fillRect(W * 0.20, H * 0.955, W * 0.22, H * 0.03);
          ctx.fillStyle = night ? '#5b4023' : '#fecdd3';
          ctx.fillRect(W * 0.215, H * 0.962, W * 0.19, H * 0.016);
      }

      if (has('bin')) {                                       // ゴミばこ
          const x = W * 0.05, y = H * 0.95;
          ctx.fillStyle = night ? '#475569' : '#64748b';
          ctx.beginPath();
          ctx.moveTo(x - 14 * s, y - 30 * s);
          ctx.lineTo(x + 14 * s, y - 30 * s);
          ctx.lineTo(x + 10 * s, y);
          ctx.lineTo(x - 10 * s, y);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.22)';
          ctx.lineWidth = 2 * s;
          [-6, 0, 6].forEach(function (q) {
              ctx.beginPath();
              ctx.moveTo(x + q * s, y - 27 * s);
              ctx.lineTo(x + q * s * 0.8, y - 4 * s);
              ctx.stroke();
          });
          ctx.fillStyle = night ? '#334155' : '#475569';
          ctx.fillRect(x - 16 * s, y - 35 * s, 32 * s, 6 * s);
          ctx.fillRect(x - 3 * s, y - 39 * s, 6 * s, 5 * s);
      }

      if (has('toilet')) {                                    // ペットトイレ
          const x = W * 0.17, y = H * 0.95;
          ctx.fillStyle = night ? '#3f6b8f' : '#60a5fa';
          ctx.fillRect(x - 28 * s, y - 17 * s, 56 * s, 17 * s);
          ctx.fillStyle = night ? '#5b7fa8' : '#dbeafe';
          ctx.fillRect(x - 24 * s, y - 13 * s, 48 * s, 10 * s);
          ctx.fillStyle = night ? '#334155' : '#e2e8f0';      // すな
          for (let i = 0; i < 12; i++) {
              ctx.fillRect(x + (-22 + (i * 37 % 44)) * s, y - (5 + (i * 13 % 6)) * s, 3 * s, 3 * s);
          }
      }

      if (has('dish')) {                                      // ごはんの おさら
          const x = W * 0.29, y = H * 0.965;
          ctx.fillStyle = night ? '#7f1d1d' : '#ef4444';
          ctx.beginPath();
          ctx.moveTo(x - 19 * s, y - 15 * s);
          ctx.lineTo(x + 19 * s, y - 15 * s);
          ctx.quadraticCurveTo(x + 14 * s, y, x, y);
          ctx.quadraticCurveTo(x - 14 * s, y, x - 19 * s, y - 15 * s);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = night ? '#5b3a1a' : '#b45309';
          ([[-8, -17], [0, -19], [8, -17], [-4, -14], [5, -14]] as const).forEach(function (q) {
              ellipse(x + q[0] * s, y + q[1] * s, 4 * s, 3.5 * s);
          });
          ctx.fillStyle = night ? '#991b1b' : '#fca5a5';
          ctx.fillRect(x - 19 * s, y - 16 * s, 38 * s, 3 * s);
      }

      if (has('basket')) {                                    // せんたくかご
          const x = W * 0.40, y = H * 0.94;
          ctx.fillStyle = night ? '#7c5a3a' : '#d6a15b';
          ctx.beginPath();
          ctx.moveTo(x - 15 * s, y - 20 * s);
          ctx.lineTo(x + 15 * s, y - 20 * s);
          ctx.lineTo(x + 11 * s, y);
          ctx.lineTo(x - 11 * s, y);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.2)';
          ctx.lineWidth = 1.5 * s;
          [-7, 0, 7].forEach(function (q) {
              ctx.beginPath();
              ctx.moveTo(x + q * s, y - 19 * s);
              ctx.lineTo(x + q * s * 0.75, y - 1 * s);
              ctx.stroke();
          });
          ctx.fillStyle = night ? '#5b7fa8' : '#93c5fd';
          ellipse(x - 4 * s, y - 22 * s, 10 * s, 5 * s);
          ctx.fillStyle = night ? '#7f5f8f' : '#fbcfe8';
          ellipse(x + 7 * s, y - 24 * s, 8 * s, 4 * s);
      }

  }

  // へやの てまえに おく もの（ベッドより まえ）
  function drawRoomFloor(t: number) {
      const W = cw(), H = ch(), s = W / 380;
      const night = isNight();

      if (has('dock')) {                                      // ロボットの じゅうでんき
          const x = W * 0.90, y = H * 0.965;
          ctx.fillStyle = night ? '#334155' : '#64748b';
          ctx.fillRect(x - 22 * s, y - 6 * s, 44 * s, 6 * s);
          ctx.fillStyle = night ? '#1e293b' : '#475569';
          ctx.fillRect(x - 18 * s, y - 22 * s, 36 * s, 16 * s);
          ctx.fillStyle = (state.sleeping && has('robot')) ? '#4ade80' : (night ? '#7f1d1d' : '#ef4444');
          ellipse(x + 12 * s, y - 14 * s, 3 * s, 3 * s);
          ctx.strokeStyle = night ? '#94a3b8' : '#cbd5e1';
          ctx.lineWidth = 2 * s;
          ctx.beginPath();
          ctx.moveTo(x - 10 * s, y - 22 * s); ctx.lineTo(x - 10 * s, y - 30 * s);
          ctx.lineTo(x + 4 * s, y - 30 * s);
          ctx.stroke();
      }

      if (has('robotoy')) {                                   // ロボットの おもちゃ
          const x = W * 0.30, y = H * 0.975;
          ctx.fillStyle = night ? '#7c2d12' : '#f97316';
          ctx.fillRect(x - 8 * s, y - 14 * s, 16 * s, 14 * s);
          ctx.fillStyle = night ? '#475569' : '#e2e8f0';
          ctx.fillRect(x - 6 * s, y - 24 * s, 12 * s, 10 * s);
          ctx.fillStyle = '#1f2937';
          ellipse(x - 2.5 * s, y - 19 * s, 1.5 * s, 1.5 * s);
          ellipse(x + 2.5 * s, y - 19 * s, 1.5 * s, 1.5 * s);
          ctx.strokeStyle = night ? '#94a3b8' : '#64748b';
          ctx.lineWidth = 1.5 * s;
          ctx.beginPath();
          ctx.moveTo(x, y - 24 * s); ctx.lineTo(x, y - 29 * s);
          ctx.stroke();
          ctx.fillStyle = '#facc15';
          ellipse(x, y - 30 * s, 2 * s, 2 * s);
      }

      if (has('kotatsu')) {                                   // こたつ
          const x = W * 0.40, y = H * 0.955;
          ctx.fillStyle = night ? '#5b4a73' : '#fbcfe8';
          ctx.fillRect(x - 56 * s, y - 22 * s, 112 * s, 22 * s);
          ctx.fillStyle = night ? '#4b3418' : '#a16207';
          ctx.fillRect(x - 60 * s, y - 28 * s, 120 * s, 7 * s);
          if (!night) {
              ctx.fillStyle = 'rgba(251,146,60,0.35)';
              ellipse(x, y - 12 * s, 40 * s, 10 * s);
          }
          ctx.fillStyle = night ? '#7f5f8f' : '#f9a8d4';
          ellipse(x - 34 * s, y - 26 * s, 12 * s, 5 * s);
      }

      if (has('petbed')) {                                    // ペットベッド
          const x = W * 0.20, y = H * 0.955;
          ctx.fillStyle = night ? '#4a3f63' : '#c4b5fd';
          ellipse(x, y - 8 * s, 26 * s, 11 * s);
          ctx.fillStyle = night ? '#5b4a73' : '#ddd6fe';
          ellipse(x, y - 10 * s, 19 * s, 7 * s);
      }

      if (has('aroma')) {                                     // アロマディフューザー
          const x = W * 0.545, y = H * 0.96;
          ctx.fillStyle = night ? '#64748b' : '#e2e8f0';
          ctx.beginPath();
          ctx.moveTo(x - 9 * s, y);
          ctx.lineTo(x + 9 * s, y);
          ctx.lineTo(x + 6 * s, y - 18 * s);
          ctx.lineTo(x - 6 * s, y - 18 * s);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          for (let i = 0; i < 3; i++) {
              const q = (t * 0.5 + i * 0.33) % 1;
              ctx.globalAlpha = (1 - q) * 0.6;
              ellipse(x + Math.sin(q * 6) * 5 * s, y - 22 * s - q * 26 * s, (3 + q * 5) * s, (3 + q * 4) * s);
          }
          ctx.globalAlpha = 1;
      }

      if (has('mic')) {                                       // カラオケマイク
          const x = W * 0.485, y = H * 0.965;
          ctx.fillStyle = night ? '#334155' : '#1f2937';
          ctx.fillRect(x - 3 * s, y - 26 * s, 6 * s, 22 * s);
          ctx.fillStyle = night ? '#64748b' : '#94a3b8';
          ellipse(x, y - 30 * s, 8 * s, 8 * s);
          ctx.fillStyle = night ? '#475569' : '#cbd5e1';
          ctx.fillRect(x - 9 * s, y - 4 * s, 18 * s, 5 * s);
      }

      if (has('artset')) {                                    // おえかきセット
          const x = W * 0.235, y = H * 0.955;
          ctx.fillStyle = night ? '#4b3418' : '#d6a15b';
          ctx.fillRect(x - 18 * s, y - 12 * s, 36 * s, 12 * s);
          ([['#ef4444', -13], ['#facc15', -6], ['#38bdf8', 1], ['#4ade80', 8]] as const).forEach(function (c) {
              ctx.fillStyle = night ? 'rgba(255,255,255,0.3)' : c[0];
              ctx.fillRect(x + c[1] * s, y - 22 * s, 5 * s, 11 * s);
          });
          ctx.fillStyle = night ? '#94a3b8' : '#f8fafc';
          ctx.fillRect(x + 16 * s, y - 26 * s, 16 * s, 20 * s);
      }

      if (has('puzzle')) {                                    // パズル
          const x = W * 0.335, y = H * 0.975;
          ([['#f472b6', -14, 0], ['#7dd3fc', 0, 0], ['#facc15', -14, -9], ['#4ade80', 0, -9]] as const).forEach(function (q) {
              ctx.fillStyle = night ? 'rgba(255,255,255,0.3)' : q[0];
              ctx.fillRect(x + q[1] * s, y + q[2] * s - 9 * s, 13 * s, 8 * s);
          });
      }

      if (has('candlestand')) {                               // キャンドルスタンド
          const x = W * 0.555, y = H * 0.96;
          ctx.fillStyle = night ? '#6b5a3a' : '#a16207';
          ellipse(x, y, 12 * s, 4 * s);
          ctx.fillRect(x - 2 * s, y - 26 * s, 4 * s, 26 * s);
          ctx.fillRect(x - 10 * s, y - 30 * s, 20 * s, 5 * s);
          [-7, 0, 7].forEach(function (q) {
              ctx.fillStyle = night ? '#e2e8f0' : '#f8fafc';
              ctx.fillRect(x + q * s - 2 * s, y - 40 * s, 4 * s, 11 * s);
              if (night) {
                  ctx.fillStyle = 'rgba(253,230,138,0.4)';
                  ellipse(x + q * s, y - 44 * s, 6 * s, 7 * s);
              }
              ctx.fillStyle = '#f59e0b';
              ellipse(x + q * s, y - 43 * s, 2.5 * s, 4 * s);
          });
      }

      if (has('lowtable')) {                                  // ローテーブルと ティーセット
          const x = W * 0.40, y = H * 0.955;
          ctx.fillStyle = night ? '#4b3418' : '#b4813f';
          ctx.fillRect(x - 46 * s, y - 20 * s, 92 * s, 8 * s);
          ctx.fillStyle = night ? '#3f2d1f' : '#8b5e34';
          ctx.fillRect(x - 40 * s, y - 12 * s, 8 * s, 14 * s);
          ctx.fillRect(x + 32 * s, y - 12 * s, 8 * s, 14 * s);
          ctx.fillStyle = night ? '#94a3b8' : '#f8fafc';      // ティーポット
          ellipse(x - 14 * s, y - 27 * s, 11 * s, 8 * s);
          ctx.fillRect(x - 16 * s, y - 34 * s, 5 * s, 5 * s);
          ctx.strokeStyle = night ? '#94a3b8' : '#f8fafc';
          ctx.lineWidth = 2.5 * s;
          ctx.beginPath();
          ctx.arc(x - 24 * s, y - 27 * s, 5 * s, Math.PI * 0.5, Math.PI * 1.5);
          ctx.stroke();
          ctx.fillStyle = night ? '#7f5f8f' : '#fbcfe8';      // カップ
          ellipse(x + 12 * s, y - 24 * s, 6 * s, 4.5 * s);
          ellipse(x + 26 * s, y - 24 * s, 6 * s, 4.5 * s);
      }

      if (has('cushion')) {                                   // クッション
          const x = W * 0.55, y = H * 0.845;
          ctx.fillStyle = night ? '#5b4a73' : '#a78bfa';
          ctx.beginPath();
          ctx.moveTo(x - 15 * s, y - 13 * s);
          ctx.quadraticCurveTo(x, y - 18 * s, x + 15 * s, y - 13 * s);
          ctx.quadraticCurveTo(x + 19 * s, y, x + 15 * s, y + 12 * s);
          ctx.quadraticCurveTo(x, y + 17 * s, x - 15 * s, y + 12 * s);
          ctx.quadraticCurveTo(x - 19 * s, y, x - 15 * s, y - 13 * s);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = night ? '#7f5f8f' : '#c4b5fd';
          ellipse(x, y, 6 * s, 5 * s);
      }

      if (has('garland')) {                                   // ガーランド
          const y0 = H * 0.045;
          ctx.strokeStyle = night ? '#6b5a3a' : '#a16207';
          ctx.lineWidth = 2.5 * s;
          ctx.beginPath();
          ctx.moveTo(W * 0.03, y0);
          ctx.quadraticCurveTo(W * 0.38, y0 + H * 0.05, W * 0.73, y0);
          ctx.stroke();
          const cols = ['#ef4444', '#facc15', '#4ade80', '#38bdf8', '#f472b6', '#a78bfa'];
          for (let i = 0; i < 9; i++) {
              const q = i / 8;
              const fx = W * 0.03 + (W * 0.70) * q;
              const fy = y0 + Math.sin(q * Math.PI) * H * 0.037;
              ctx.fillStyle = night ? 'rgba(255,255,255,0.25)' : cols[i % cols.length];
              ctx.beginPath();
              ctx.moveTo(fx - 8 * s, fy);
              ctx.lineTo(fx + 8 * s, fy);
              ctx.lineTo(fx, fy + 15 * s);
              ctx.closePath();
              ctx.fill();
          }
      }

      if (has('poster')) {                                    // ポスター
          const x = W * 0.70, y = H * 0.50;
          ctx.fillStyle = night ? '#4b5b46' : '#fef3c7';
          ctx.fillRect(x - 22 * s, y - 30 * s, 44 * s, 60 * s);
          ctx.strokeStyle = night ? '#3b2f4f' : '#d97706';
          ctx.lineWidth = 2.5 * s;
          ctx.strokeRect(x - 22 * s, y - 30 * s, 44 * s, 60 * s);
          ctx.fillStyle = night ? '#6b5a3a' : '#38bdf8';
          ctx.fillRect(x - 18 * s, y - 26 * s, 36 * s, 30 * s);
          ctx.fillStyle = night ? '#7c6f4a' : '#facc15';
          star(x, y - 12 * s, 5, 11 * s, 5 * s);
          ctx.fillStyle = night ? '#4b5b46' : '#f472b6';
          ctx.fillRect(x - 18 * s, y + 8 * s, 36 * s, 5 * s);
          ctx.fillRect(x - 18 * s, y + 17 * s, 24 * s, 5 * s);
      }

      if (has('guitar')) {                                    // ギター
          const x = W * 0.79, y = H * 0.93;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(-0.22);
          ctx.fillStyle = night ? '#7c5a3a' : '#d97706';
          ellipse(0, -18 * s, 17 * s, 14 * s);
          ellipse(0, -34 * s, 13 * s, 12 * s);
          ctx.fillStyle = '#451a03';
          ellipse(0, -24 * s, 5 * s, 5 * s);
          ctx.fillStyle = night ? '#5b4636' : '#92400e';
          ctx.fillRect(-4 * s, -74 * s, 8 * s, 42 * s);
          ctx.fillRect(-7 * s, -84 * s, 14 * s, 12 * s);
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 1 * s;
          [-2, 0, 2].forEach(function (q) {
              ctx.beginPath();
              ctx.moveTo(q * s, -72 * s);
              ctx.lineTo(q * s, -6 * s);
              ctx.stroke();
          });
          ctx.restore();
      }

      if (has('vacuum')) {                                    // そうじき
          const x = W * 0.90, y = H * 0.96;
          ctx.fillStyle = night ? '#4b5563' : '#94a3b8';
          ctx.fillRect(x - 16 * s, y - 22 * s, 32 * s, 20 * s);
          ctx.fillStyle = night ? '#334155' : '#64748b';
          ctx.fillRect(x - 20 * s, y - 6 * s, 40 * s, 6 * s);
          ctx.fillStyle = '#dc2626';
          ellipse(x + 4 * s, y - 14 * s, 6 * s, 6 * s);
          ctx.strokeStyle = night ? '#334155' : '#475569';
          ctx.lineWidth = 4 * s;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x - 12 * s, y - 22 * s);
          ctx.quadraticCurveTo(x - 26 * s, y - 50 * s, x - 10 * s, y - 62 * s);
          ctx.stroke();
      }

      if (has('game')) {                                      // ゲームき
          const x = W * 0.40, y = H * 0.965;
          ctx.fillStyle = night ? '#4b5563' : '#a78bfa';
          ctx.fillRect(x - 22 * s, y - 15 * s, 44 * s, 15 * s);
          ctx.fillStyle = night ? '#334155' : '#c4b5fd';
          ctx.fillRect(x - 22 * s, y - 15 * s, 44 * s, 4 * s);
          ctx.fillStyle = night ? '#1e293b' : '#38bdf8';
          ctx.fillRect(x - 12 * s, y - 12 * s, 24 * s, 9 * s);
          ctx.fillStyle = '#ef4444';
          ellipse(x + 17 * s, y - 8 * s, 2.5 * s, 2.5 * s);
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(x - 20 * s, y - 9 * s, 7 * s, 2.5 * s);
      }

      if (has('chime')) {                                     // ふうりん
          const x = W * 0.395, y = H * 0.27;
          const sway = Math.sin(t * 2) * 0.12;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(sway);
          ctx.strokeStyle = night ? '#6b5a3a' : '#a16207';
          ctx.lineWidth = 2 * s;
          ctx.beginPath();
          ctx.moveTo(0, -12 * s); ctx.lineTo(0, 0);
          ctx.stroke();
          ctx.fillStyle = night ? '#5b7fa8' : '#bae6fd';
          ctx.beginPath();
          ctx.arc(0, 6 * s, 10 * s, Math.PI, 0);
          ctx.lineTo(10 * s, 8 * s);
          ctx.lineTo(-10 * s, 8 * s);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = night ? '#94a3b8' : '#f8fafc';
          ctx.fillRect(-4 * s, 8 * s, 8 * s, 14 * s);
          ctx.restore();
      }

      if (has('sock')) {                                      // くつした
          const x = W * 0.155, y = H * 0.66;
          ctx.fillStyle = night ? '#7f1d1d' : '#ef4444';
          ctx.beginPath();
          ctx.moveTo(x - 8 * s, y - 18 * s);
          ctx.lineTo(x + 8 * s, y - 18 * s);
          ctx.lineTo(x + 8 * s, y + 6 * s);
          ctx.quadraticCurveTo(x + 8 * s, y + 16 * s, x - 6 * s, y + 15 * s);
          ctx.quadraticCurveTo(x - 12 * s, y + 12 * s, x - 8 * s, y + 4 * s);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.fillRect(x - 9 * s, y - 22 * s, 18 * s, 6 * s);
      }

      if (has('mirror')) {                                    // かがみ
          const x = W * 0.10, y = H * 0.62;
          ctx.fillStyle = night ? '#6b5a3a' : '#a16207';
          ellipse(x, y, 22 * s, 28 * s);
          ctx.fillStyle = night ? '#475569' : '#e0f2fe';
          ellipse(x, y, 17 * s, 23 * s);
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.beginPath();
          ctx.moveTo(x - 10 * s, y + 12 * s);
          ctx.lineTo(x + 2 * s, y - 16 * s);
          ctx.lineTo(x + 8 * s, y - 14 * s);
          ctx.lineTo(x - 4 * s, y + 14 * s);
          ctx.closePath();
          ctx.fill();
      }

      if (has('candle')) {                                    // キャンドル（ほんだなの上）
          const x = W * 0.50, y = H * 0.81 - 68 * s;
          ctx.fillStyle = night ? '#94a3b8' : '#f1f5f9';
          ctx.fillRect(x - 5 * s, y - 16 * s, 10 * s, 18 * s);
          ctx.fillStyle = night ? '#78716c' : '#cbd5e1';
          ellipse(x, y + 2 * s, 8 * s, 3 * s);
          if (night) {
              ctx.fillStyle = 'rgba(253,230,138,0.35)';
              ellipse(x, y - 22 * s, 11 * s, 13 * s);
          }
          ctx.fillStyle = '#f59e0b';
          ellipse(x, y - 21 * s, 3.5 * s, 6 * s + Math.sin(t * 8) * 1.2 * s);
          ctx.fillStyle = '#fef3c7';
          ellipse(x, y - 20 * s, 1.6 * s, 3 * s);
      }

      if (has('kokeshi')) {                                   // こけし（ほんだなの上）
          const x = W * 0.60, y = H * 0.81 - 68 * s;
          ctx.fillStyle = night ? '#7c5a3a' : '#fef3c7';
          ctx.beginPath();
          ctx.moveTo(x - 6 * s, y + 2 * s);
          ctx.lineTo(x + 6 * s, y + 2 * s);
          ctx.lineTo(x + 4 * s, y - 14 * s);
          ctx.lineTo(x - 4 * s, y - 14 * s);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = night ? '#9d5f7a' : '#f472b6';
          ctx.fillRect(x - 5 * s, y - 10 * s, 10 * s, 4 * s);
          ctx.fillStyle = night ? '#d6d3d1' : '#fff';
          ellipse(x, y - 19 * s, 7 * s, 7 * s);
          ctx.fillStyle = '#1f2937';
          ctx.beginPath();
          ctx.arc(x, y - 21 * s, 7 * s, Math.PI, Math.PI * 2);
          ctx.fill();
          ellipse(x - 2.5 * s, y - 18 * s, 1.2 * s, 1.2 * s);
          ellipse(x + 2.5 * s, y - 18 * s, 1.2 * s, 1.2 * s);
      }

      if (has('photo')) {                                     // かぞくの しゃしん
          const x = W * 0.33, y = H * 0.62;
          ctx.fillStyle = night ? '#6b5a3a' : '#a16207';
          ctx.fillRect(x - 17 * s, y - 14 * s, 34 * s, 28 * s);
          ctx.fillStyle = night ? '#4b5b46' : '#fef3c7';
          ctx.fillRect(x - 13 * s, y - 10 * s, 26 * s, 20 * s);
          ctx.fillStyle = night ? '#5b7fa8' : '#7dd3fc';
          ellipse(x - 5 * s, y - 1 * s, 5 * s, 6 * s);
          ctx.fillStyle = night ? '#7f5f8f' : '#f472b6';
          ellipse(x + 5 * s, y + 1 * s, 4 * s, 5 * s);
      }

      if (has('thermo')) {                                    // おんどけい
          const x = W * 0.79, y = H * 0.60;
          ctx.fillStyle = night ? '#94a3b8' : '#f8fafc';
          ctx.fillRect(x - 6 * s, y - 20 * s, 12 * s, 34 * s);
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 2 * s;
          ctx.strokeRect(x - 6 * s, y - 20 * s, 12 * s, 34 * s);
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(x - 2 * s, y - 4 * s, 4 * s, 16 * s);
          ellipse(x, y + 13 * s, 6 * s, 6 * s);
      }

      if (has('darts')) {                                     // ダーツ
          const x = W * 0.24, y = H * 0.60;
          const cols = ['#f8fafc', '#1f2937', '#ef4444'];
          for (let i = 0; i < 3; i++) {
              ctx.fillStyle = night ? ['#94a3b8', '#334155', '#7f1d1d'][i] : cols[i];
              ellipse(x, y, (22 - i * 7) * s, (22 - i * 7) * s);
          }
          ctx.fillStyle = '#facc15';
          ctx.fillRect(x - 1.5 * s, y - 16 * s, 3 * s, 14 * s);
          ctx.beginPath();
          ctx.moveTo(x, y - 16 * s);
          ctx.lineTo(x + 7 * s, y - 22 * s);
          ctx.lineTo(x, y - 24 * s);
          ctx.closePath();
          ctx.fill();
      }

      if (has('fishbowl')) {                                  // きんぎょばち（ほんだなの上）
          const x = W * 0.55, y = H * 0.81 - 68 * s;
          ctx.fillStyle = night ? '#3f6b8f' : '#bae6fd';
          ellipse(x, y - 12 * s, 16 * s, 14 * s);
          ctx.fillStyle = night ? '#1e3a8a' : '#7dd3fc';
          ctx.beginPath();
          ctx.ellipse(x, y - 8 * s, 16 * s, 12 * s, 0, 0, Math.PI);
          ctx.fill();
          ctx.fillStyle = '#f97316';
          ellipse(x - 3 * s, y - 8 * s, 5 * s, 3.5 * s);
          ctx.beginPath();
          ctx.moveTo(x + 2 * s, y - 8 * s);
          ctx.lineTo(x + 8 * s, y - 11 * s);
          ctx.lineTo(x + 8 * s, y - 5 * s);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = night ? '#64748b' : '#e2e8f0';
          ctx.fillRect(x - 9 * s, y + 1 * s, 18 * s, 4 * s);
      }

      if (has('piano')) {                                     // ピアノ
          const x = W * 0.07, y = H * 0.87;
          ctx.fillStyle = night ? '#292524' : '#1f2937';
          ctx.fillRect(x - 26 * s, y - 30 * s, 52 * s, 12 * s);
          ctx.fillStyle = night ? '#94a3b8' : '#f8fafc';
          ctx.fillRect(x - 24 * s, y - 18 * s, 48 * s, 10 * s);
          ctx.fillStyle = '#1f2937';
          for (let i = 0; i < 7; i++) ctx.fillRect(x - 20 * s + i * 6.6 * s, y - 18 * s, 2.5 * s, 6 * s);
          ctx.fillStyle = night ? '#292524' : '#111827';
          ctx.fillRect(x - 22 * s, y - 8 * s, 6 * s, 8 * s);
          ctx.fillRect(x + 16 * s, y - 8 * s, 6 * s, 8 * s);
      }

      if (has('bank')) {                                      // ちょきんばこ
          const x = W * 0.66, y = H * 0.96;
          const fill = bankCap() > 0n ? Math.min(1, Number(big(state.savings) * 100n / bankCap()) / 100) : 0;
          if (fill > 0) {                                     // ためた ぶんだけ コインが つみあがる
              const n = 1 + Math.floor(fill * 4.99);
              for (let i = 0; i < n; i++) {
                  ctx.fillStyle = night ? '#a16207' : '#fbbf24';
                  ellipse(x - 30 * s, y - 3 * s - i * 3.5 * s, 6 * s, 2.6 * s);
                  ctx.fillStyle = night ? '#78350f' : '#f59e0b';
                  ellipse(x - 30 * s, y - 2 * s - i * 3.5 * s, 6 * s, 2.6 * s);
              }
          }
          ctx.fillStyle = night ? '#7f3f5f' : '#f472b6';
          ctx.fillRect(x - 15 * s, y - 6 * s, 7 * s, 6 * s);
          ctx.fillRect(x + 6 * s, y - 6 * s, 7 * s, 6 * s);
          ctx.fillStyle = night ? '#9d5f7a' : '#f9a8d4';
          ellipse(x, y - 15 * s, 22 * s, 14 * s);
          ellipse(x + 20 * s, y - 18 * s, 11 * s, 10 * s);
          ctx.fillStyle = night ? '#7f3f5f' : '#f472b6';
          ellipse(x + 28 * s, y - 18 * s, 5 * s, 5 * s);
          ctx.beginPath();
          ctx.moveTo(x + 12 * s, y - 27 * s);
          ctx.lineTo(x + 20 * s, y - 24 * s);
          ctx.lineTo(x + 12 * s, y - 21 * s);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#1f2937';
          ellipse(x + 22 * s, y - 20 * s, 1.8 * s, 1.8 * s);
          ctx.fillStyle = '#a16207';
          ctx.fillRect(x - 7 * s, y - 29 * s, 15 * s, 3.5 * s);
      }

      if (has('doll')) {
          const x = W * 0.53, y = H * 0.95;
          ctx.fillStyle = 'rgba(0,0,0,0.14)';
          ellipse(x, y + 1 * s, 14 * s, 4 * s);
          ctx.fillStyle = night ? '#7c5a3a' : '#b45309';
          ellipse(x, y - 11 * s, 13 * s, 11 * s);
          ellipse(x, y - 27 * s, 11 * s, 10 * s);
          ellipse(x - 9 * s, y - 34 * s, 5 * s, 5 * s);
          ellipse(x + 9 * s, y - 34 * s, 5 * s, 5 * s);
          ctx.fillStyle = '#fde68a';
          ellipse(x, y - 25 * s, 5 * s, 4 * s);
          ctx.fillStyle = '#1f2937';
          ellipse(x - 4 * s, y - 29 * s, 1.6 * s, 1.6 * s);
          ellipse(x + 4 * s, y - 29 * s, 1.6 * s, 1.6 * s);
      }
  }

  function drawRoom(t: number) {
      const W = cw(), H = ch();
      const night = isNight();
      const wallH = H * 0.74;
      const room = state.view;

      // ---- どの へやも おなじ かべ・ゆか ----
      paintBands(0, 0, W, wallH, styleColors('wall', night, '#fdebd0', '#4b3b63'));
      if (room === 'kitchen') {                       // キッチンは タイルばり
          ctx.strokeStyle = night ? 'rgba(255,255,255,0.08)' : 'rgba(120,140,150,0.25)';
          ctx.lineWidth = 1.5;
          for (let x = 0; x < W; x += 26) {
              ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, wallH); ctx.stroke();
          }
          for (let y = 0; y < wallH; y += 22) {
              ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
          }
      } else {
          ctx.fillStyle = night ? 'rgba(255,255,255,0.05)' : 'rgba(180,120,60,0.10)';
          for (let x = 0; x < W; x += 30) ctx.fillRect(x, 0, 13, wallH);
      }

      // へやの すみ
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(0, 0, W * 0.06, wallH);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W * 0.06, 0);
      ctx.lineTo(W * 0.06, wallH);
      ctx.stroke();

      // てんじょうと まわりぶち
      ctx.fillStyle = night ? '#5b4a73' : '#fff7ea';
      ctx.fillRect(0, 0, W, H * 0.05);
      if (room === 'bed') {                           // 2かいは やねの かたむき
          ctx.fillStyle = night ? '#4b3f63' : '#f5e3cc';
          ctx.beginPath();
          ctx.moveTo(W, H * 0.05);
          ctx.lineTo(W, H * 0.30);
          ctx.lineTo(W * 0.72, H * 0.05);
          ctx.closePath();
          ctx.fill();
      }
      ctx.fillStyle = night ? '#3b2f4f' : '#e7c9a0';
      ctx.fillRect(0, H * 0.05, W, H * 0.014);

      // はばき
      ctx.fillStyle = night ? '#3b2f4f' : '#f3d3a8';
      ctx.fillRect(0, wallH - H * 0.03, W, H * 0.03);

      // ゆか
      paintBands(0, wallH, W, H - wallH, styleColors('floor', night, '#c08b5c', '#5a4636'));
      ctx.strokeStyle = night ? 'rgba(0,0,0,0.25)' : 'rgba(120,80,40,0.35)';
      ctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(0, wallH + (H - wallH) * i / 4);
          ctx.lineTo(W, wallH + (H - wallH) * i / 4);
          ctx.stroke();
      }

      // ---- まど（リビングと 2かい）----
      if (room !== 'kitchen') {
          const wx = W * 0.17, wy = H * 0.18, ww = W * 0.21, wh = H * 0.30;
          ctx.fillStyle = night ? '#16233b' : '#bae6fd';
          ctx.fillRect(wx, wy, ww, wh);
          if (night) {
              ctx.fillStyle = '#fef9c3';
              ellipse(wx + ww * 0.68, wy + wh * 0.3, ww * 0.13, ww * 0.13);
              ctx.fillStyle = '#fff';
              for (let i = 0; i < 6; i++) {
                  ctx.fillRect(wx + (i * 37 % Math.round(ww)), wy + (i * 23 % Math.round(wh)), 2, 2);
              }
          } else {
              ctx.fillStyle = '#86efac';
              ctx.fillRect(wx, wy + wh * 0.72, ww, wh * 0.28);
              ctx.fillStyle = 'rgba(255,255,255,0.9)';
              const cx2 = wx + ((t * 8) % (ww + 40)) - 20;
              ellipse(cx2, wy + wh * 0.3, 14, 8);
              ellipse(cx2 + 12, wy + wh * 0.3, 10, 6);
          }
          ctx.strokeStyle = night ? '#7c5a3a' : '#a16207';
          ctx.lineWidth = 5;
          ctx.strokeRect(wx, wy, ww, wh);
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
          ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2);
          ctx.stroke();
      }

      // ---- てんじょうの ランプ ----
      const lx = W * 0.68;
      ctx.strokeStyle = night ? '#57534e' : '#78716c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(lx, 0); ctx.lineTo(lx, H * 0.10);
      ctx.stroke();
      if (night) {
          const g = ctx.createRadialGradient(lx, H * 0.13, 4, lx, H * 0.13, H * 0.42);
          g.addColorStop(0, 'rgba(253,230,138,0.55)');
          g.addColorStop(1, 'rgba(253,230,138,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(lx, H * 0.13, H * 0.42, 0, Math.PI * 2);
          ctx.fill();
      }
      ctx.fillStyle = night ? '#fde68a' : '#e7e5e4';
      ctx.beginPath();
      ctx.moveTo(lx - 22, H * 0.14); ctx.lineTo(lx + 22, H * 0.14);
      ctx.lineTo(lx + 11, H * 0.09); ctx.lineTo(lx - 11, H * 0.09);
      ctx.closePath();
      ctx.fill();

      if (room === 'kitchen') { drawKitchen(t, W, H, night, wallH); return; }
      if (room === 'bed') { drawBedroom(t, W, H, night, wallH); return; }
      drawLiving(t, W, H, night, wallH);
  }

  // ---- リビング ----
  function drawLiving(t: number, W: number, H: number, night: boolean, wallH: number) {
      const s = W / 380;

      // かべの カレンダー（ほんとうの つきと ひ）
      const px = W * 0.45, py = H * 0.14, pw = W * 0.13, ph = H * 0.19;
      const today = new Date();
      ctx.fillStyle = night ? '#94a3b8' : '#f8fafc';
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = night ? '#3b2f4f' : '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, pw, ph);
      ctx.fillStyle = night ? '#7f1d1d' : '#ef4444';
      ctx.fillRect(px, py, pw, ph * 0.3);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(H * 0.045)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText((today.getMonth() + 1) + 'がつ', px + pw / 2, py + ph * 0.23);
      ctx.fillStyle = night ? '#475569' : '#1f2937';
      ctx.font = `bold ${Math.round(H * 0.095)}px sans-serif`;
      ctx.fillText(String(today.getDate()), px + pw / 2, py + ph * 0.86);
      ctx.textAlign = 'left';
      ctx.fillStyle = night ? '#64748b' : '#94a3b8';
      ctx.fillRect(px + pw * 0.44, py - H * 0.012, pw * 0.12, H * 0.014);

      // でんきの スイッチ
      ctx.fillStyle = night ? '#cbd5e1' : '#f8fafc';
      ctx.fillRect(W * 0.795, H * 0.50, W * 0.028, H * 0.045);
      ctx.fillStyle = night ? '#94a3b8' : '#cbd5e1';
      ctx.fillRect(W * 0.801, H * 0.512, W * 0.016, H * 0.021);

      // コンセント
      ctx.fillStyle = night ? '#cbd5e1' : '#f8fafc';
      ctx.fillRect(W * 0.655, wallH - H * 0.055, W * 0.026, H * 0.036);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(W * 0.661, wallH - H * 0.047, W * 0.004, H * 0.014);
      ctx.fillRect(W * 0.671, wallH - H * 0.047, W * 0.004, H * 0.014);

      // 2かいへの かいだん
      ctx.fillStyle = night ? '#2a1d14' : '#6b4423';
      ctx.fillRect(W * 0.855, H * 0.28, W * 0.145, H * 0.08);
      ctx.fillStyle = night ? '#3f2d1f' : '#8b5e34';
      for (let i = 0; i < 5; i++) {
          const stepW = W * (0.055 + i * 0.018);
          const stepH = H * 0.055;
          ctx.fillRect(W - stepW, H * 0.74 - stepH * (i + 1), stepW, stepH);
          ctx.fillStyle = night ? '#241a10' : '#5c3a1e';
          ctx.fillRect(W - stepW, H * 0.74 - stepH * (i + 1), stepW, H * 0.008);
          ctx.fillStyle = night ? '#3f2d1f' : '#8b5e34';
      }
      ctx.strokeStyle = night ? '#6b4a24' : '#a16207';
      ctx.lineWidth = 4 * s;
      ctx.beginPath();
      ctx.moveTo(W * 0.945, H * 0.70);
      ctx.lineTo(W * 0.86, H * 0.42);
      ctx.stroke();

      // ソファ
      const fx = W * 0.62, fy = H * 0.90;
      const sofaCols = styleColors('sofa', night, '#38bdf8', '#3f5b63');
      paintBands(fx - 54 * s, fy - 62 * s, 108 * s, 40 * s, sofaCols);   // せもたれ
      paintBands(fx - 54 * s, fy - 26 * s, 108 * s, 20 * s, sofaCols);   // ざめん
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(fx - 54 * s, fy - 26 * s, 108 * s, 20 * s);
      ctx.strokeStyle = night ? '#2f3f5f' : '#0ea5e9';
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(fx, fy - 26 * s); ctx.lineTo(fx, fy - 6 * s);
      ctx.stroke();
      ctx.fillStyle = sofaCols[0];                            // ひじかけ
      ctx.fillRect(fx - 66 * s, fy - 44 * s, 16 * s, 38 * s);
      ctx.fillRect(fx + 50 * s, fy - 44 * s, 16 * s, 38 * s);
      ctx.fillStyle = night ? '#7f5f8f' : '#fbcfe8';          // クッション
      ellipse(fx - 30 * s, fy - 42 * s, 13 * s, 11 * s);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';                     // あし
      ctx.fillRect(fx - 58 * s, fy - 6 * s, 9 * s, 8 * s);
      ctx.fillRect(fx + 49 * s, fy - 6 * s, 9 * s, 8 * s);

      // ラグ
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(W * IN_X, H * 0.90, W * 0.20, H * 0.055, 0, 0, Math.PI * 2);
      ctx.clip();
      paintBands(W * IN_X - W * 0.20, H * 0.845, W * 0.40, H * 0.11,
          styleColors('rug', night, '#fca5a5', '#4a3f63'));
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ellipse(W * IN_X, H * 0.90, W * 0.13, H * 0.035);

      drawRoomStuff(t);
  }

  // ---- キッチン（げんかんも ここ）----
  function drawKitchen(t: number, W: number, H: number, night: boolean, wallH: number) {
      const s = W / 380;

      // げんかんの ドア
      const dx = W * 0.90, dTop = H * 0.30;
      ctx.fillStyle = night ? '#4b3418' : '#92400e';
      ctx.fillRect(dx - W * 0.078, dTop - H * 0.015, W * 0.156, wallH - dTop + H * 0.015);
      ctx.fillStyle = night ? '#6b4a24' : '#b45309';
      ctx.fillRect(dx - W * 0.066, dTop, W * 0.132, wallH - dTop);
      ctx.fillStyle = night ? '#5b3e1e' : '#a1560a';
      ctx.fillRect(dx - W * 0.048, dTop + H * 0.04, W * 0.096, H * 0.10);
      ctx.fillRect(dx - W * 0.048, dTop + H * 0.17, W * 0.096, H * 0.14);
      ctx.fillStyle = '#fbbf24';
      ellipse(dx + W * 0.044, dTop + H * 0.19, 5 * s, 5 * s);
      ctx.fillStyle = night ? '#292524' : '#78350f';
      ctx.fillRect(dx - W * 0.078, wallH - H * 0.012, W * 0.156, H * 0.012);

      // げんかんマット
      ctx.fillStyle = night ? '#4b3418' : '#c2846a';
      ellipse(W * 0.905, H * 0.80, W * 0.075, H * 0.028);
      ctx.fillStyle = night ? '#5b4023' : '#d9a184';
      ellipse(W * 0.905, H * 0.80, W * 0.055, H * 0.018);

      // つりとだな
      ctx.fillStyle = night ? '#6b4a24' : '#d6a15b';
      ctx.fillRect(W * 0.05, H * 0.22, W * 0.29, H * 0.20);
      ctx.fillStyle = night ? '#4b3418' : '#b4813f';
      ctx.fillRect(W * 0.05, H * 0.22, W * 0.29, H * 0.02);
      ctx.strokeStyle = night ? '#3f2d1f' : '#8b5e34';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W * 0.195, H * 0.24); ctx.lineTo(W * 0.195, H * 0.42);
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ellipse(W * 0.18, H * 0.33, 3 * s, 3 * s);
      ellipse(W * 0.21, H * 0.33, 3 * s, 3 * s);

      // ながしだい
      const cy = H * 0.62;
      ctx.fillStyle = night ? '#64748b' : '#e2e8f0';
      ctx.fillRect(W * 0.03, cy, W * 0.44, H * 0.05);
      ctx.fillStyle = night ? '#475569' : '#cbd5e1';
      ctx.fillRect(W * 0.03, cy + H * 0.05, W * 0.44, H * 0.24);
      ctx.strokeStyle = night ? '#334155' : '#94a3b8';
      ctx.lineWidth = 2;
      [0.17, 0.30, 0.43].forEach(function (q) {
          ctx.beginPath();
          ctx.moveTo(W * q, cy + H * 0.05); ctx.lineTo(W * q, cy + H * 0.29);
          ctx.stroke();
      });
      [0.10, 0.23, 0.36].forEach(function (q) {
          ctx.fillStyle = night ? '#1e293b' : '#64748b';
          ctx.fillRect(W * q, cy + H * 0.10, W * 0.05, H * 0.012);
      });

      // シンクと じゃぐち
      ctx.fillStyle = night ? '#334155' : '#94a3b8';
      ctx.fillRect(W * 0.06, cy - H * 0.005, W * 0.16, H * 0.055);
      ctx.fillStyle = night ? '#1e293b' : '#cbd5e1';
      ctx.fillRect(W * 0.075, cy + H * 0.005, W * 0.13, H * 0.035);
      ctx.strokeStyle = night ? '#94a3b8' : '#64748b';
      ctx.lineWidth = 4 * s;
      ctx.beginPath();
      ctx.moveTo(W * 0.14, cy - H * 0.005);
      ctx.lineTo(W * 0.14, cy - H * 0.06);
      ctx.quadraticCurveTo(W * 0.14, cy - H * 0.085, W * 0.115, cy - H * 0.085);
      ctx.stroke();

      // コンロと やかん
      ctx.fillStyle = night ? '#1e293b' : '#334155';
      ctx.fillRect(W * 0.26, cy - H * 0.005, W * 0.18, H * 0.05);
      ctx.fillStyle = night ? '#7f1d1d' : '#f97316';
      ellipse(W * 0.30, cy + H * 0.02, 9 * s, 5 * s);
      ellipse(W * 0.39, cy + H * 0.02, 9 * s, 5 * s);
      ctx.fillStyle = night ? '#94a3b8' : '#e2e8f0';
      ellipse(W * 0.39, cy - H * 0.012, 13 * s, 10 * s);
      ctx.fillRect(W * 0.39 - 2 * s, cy - H * 0.04, 4 * s, 9 * s);
      ctx.strokeStyle = night ? '#94a3b8' : '#e2e8f0';
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.arc(W * 0.39, cy - H * 0.026, 10 * s, Math.PI, Math.PI * 2);
      ctx.stroke();

      // れいぞうこ
      ctx.fillStyle = night ? '#94a3b8' : '#f8fafc';
      ctx.fillRect(W * 0.49, H * 0.42, W * 0.14, H * 0.45);
      ctx.strokeStyle = night ? '#475569' : '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(W * 0.49, H * 0.42, W * 0.14, H * 0.45);
      ctx.beginPath();
      ctx.moveTo(W * 0.49, H * 0.57); ctx.lineTo(W * 0.63, H * 0.57);
      ctx.stroke();
      ctx.fillStyle = night ? '#334155' : '#94a3b8';
      ctx.fillRect(W * 0.605, H * 0.48, W * 0.012, H * 0.06);
      ctx.fillRect(W * 0.605, H * 0.60, W * 0.012, H * 0.06);
      ctx.fillStyle = night ? '#7f5f8f' : '#f472b6';
      ctx.fillRect(W * 0.525, H * 0.46, W * 0.03, H * 0.035);

      drawKitchenStuff(t);
  }

  // ---- 2かいの しんしつ ----
  function drawBedroom(t: number, W: number, H: number, night: boolean, wallH: number) {
      const s = W / 380;

      // クローゼット
      ctx.fillStyle = night ? '#4b3418' : '#b4813f';
      ctx.fillRect(W * 0.80, H * 0.30, W * 0.19, wallH - H * 0.30);
      ctx.strokeStyle = night ? '#2a1d14' : '#8b5e34';
      ctx.lineWidth = 3;
      ctx.strokeRect(W * 0.80, H * 0.30, W * 0.19, wallH - H * 0.30);
      ctx.beginPath();
      ctx.moveTo(W * 0.895, H * 0.30); ctx.lineTo(W * 0.895, wallH);
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ellipse(W * 0.885, H * 0.52, 3.5 * s, 3.5 * s);
      ellipse(W * 0.905, H * 0.52, 3.5 * s, 3.5 * s);

      // ベッドサイドの ちいさな テーブルと あかり
      ctx.fillStyle = night ? '#3f2d1f' : '#a16207';
      ctx.fillRect(W * 0.43, H * 0.80, W * 0.10, H * 0.02);
      ctx.fillRect(W * 0.442, H * 0.82, W * 0.014, H * 0.08);
      ctx.fillRect(W * 0.504, H * 0.82, W * 0.014, H * 0.08);
      if (night) {
          ctx.fillStyle = 'rgba(253,230,138,0.30)';
          ellipse(W * 0.48, H * 0.76, W * 0.07, H * 0.07);
      }
      ctx.fillStyle = night ? '#fde68a' : '#fca5a5';
      ctx.beginPath();
      ctx.moveTo(W * 0.455, H * 0.795);
      ctx.lineTo(W * 0.505, H * 0.795);
      ctx.lineTo(W * 0.495, H * 0.755);
      ctx.lineTo(W * 0.465, H * 0.755);
      ctx.closePath();
      ctx.fill();

      // ゆかの ラグ
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(W * IN_X, H * 0.90, W * 0.18, H * 0.05, 0, 0, Math.PI * 2);
      ctx.clip();
      paintBands(W * IN_X - W * 0.18, H * 0.85, W * 0.36, H * 0.10,
          styleColors('rug', night, '#c4b5fd', '#4a3f63'));
      ctx.restore();

      drawBedroomStuff(t, W, H, night, s);
  }

  // 2かいに おく もの
  function drawBedroomStuff(t: number, W: number, H: number, night: boolean, s: number) {
      if (has('starlight')) {                                 // ほしの ライト
          const x = W * 0.545, y = H * 0.48;
          if (isNight()) {
              ctx.fillStyle = 'rgba(253,230,138,0.25)';
              ellipse(x, y, W * 0.10, W * 0.10);
              ctx.fillStyle = '#fef9c3';
              for (let i = 0; i < 7; i++) {
                  const a2 = i / 7 * Math.PI * 2 + t * 0.3;
                  star(x + Math.cos(a2) * W * 0.075, y + Math.sin(a2) * W * 0.06, 5, 4 * s, 1.8 * s);
              }
          }
          ctx.fillStyle = isNight() ? '#fde68a' : '#e2e8f0';
          ellipse(x, y, 11 * s, 11 * s);
          ctx.fillStyle = isNight() ? '#a16207' : '#94a3b8';
          ctx.fillRect(x - 4 * s, y + 8 * s, 8 * s, 6 * s);
      }

      if (has('musicbox')) {                                  // オルゴール
          const x = W * 0.475, y = H * 0.79;
          ctx.fillStyle = night ? '#6b4a24' : '#b4813f';
          ctx.fillRect(x - 11 * s, y - 10 * s, 22 * s, 10 * s);
          ctx.fillStyle = night ? '#4b3418' : '#8b5e34';
          ctx.fillRect(x - 12 * s, y - 14 * s, 24 * s, 5 * s);
          ctx.fillStyle = night ? '#7f5f8f' : '#f472b6';
          ellipse(x, y - 18 * s, 4 * s, 5 * s);
      }

      if (has('diary')) {                                     // にっきちょう
          const x = W * 0.075, y = H * 0.845;
          ctx.fillStyle = night ? '#7f1d1d' : '#ef4444';
          ctx.fillRect(x - 11 * s, y - 15 * s, 22 * s, 15 * s);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(x - 9 * s, y - 13 * s, 18 * s, 11 * s);
          ctx.fillStyle = night ? '#a16207' : '#facc15';
          ctx.fillRect(x + 6 * s, y - 17 * s, 3 * s, 8 * s);
      }

      if (has('telescope')) {                                 // ぼうえんきょう
          const x = W * 0.685, y = H * 0.90;
          ctx.fillStyle = night ? '#334155' : '#64748b';
          ctx.beginPath();
          ctx.moveTo(x, y - 6 * s); ctx.lineTo(x - 14 * s, y); ctx.lineTo(x + 14 * s, y);
          ctx.closePath();
          ctx.fill();
          ctx.fillRect(x - 2 * s, y - 30 * s, 4 * s, 26 * s);
          ctx.save();
          ctx.translate(x, y - 34 * s);
          ctx.rotate(-0.5);
          ctx.fillStyle = night ? '#1e293b' : '#334155';
          ctx.fillRect(-22 * s, -5 * s, 44 * s, 10 * s);
          ctx.fillStyle = night ? '#475569' : '#94a3b8';
          ctx.fillRect(18 * s, -7 * s, 10 * s, 14 * s);
          ctx.restore();
      }

      if (has('yogamat')) {                                   // ヨガマット
          ctx.fillStyle = night ? '#4a3f63' : '#a7f3d0';
          ctx.fillRect(W * 0.20, H * 0.955, W * 0.22, H * 0.028);
          ctx.fillStyle = night ? '#5b4a73' : '#6ee7b7';
          ctx.fillRect(W * 0.395, H * 0.945, W * 0.028, H * 0.048);
      }

      if (has('slippers')) {                                  // ルームシューズ
          const x = W * 0.145, y = H * 0.955;
          ([[-11, '#f9a8d4'], [11, '#f472b6']] as const).forEach(function (q) {
              ctx.fillStyle = night ? 'rgba(255,255,255,0.3)' : q[1];
              ellipse(x + q[0] * s, y, 10 * s, 5 * s);
              ctx.fillStyle = night ? 'rgba(255,255,255,0.2)' : '#fff';
              ellipse(x + q[0] * s - 3 * s, y - 1 * s, 5 * s, 3 * s);
          });
      }

      if (has('cork')) {                                      // コルクボード
          const x = W * 0.455, y = H * 0.42;
          ctx.fillStyle = night ? '#6b4a24' : '#d6a15b';
          ctx.fillRect(x - W * 0.055, y - H * 0.07, W * 0.11, H * 0.14);
          ([['#f8fafc', -0.025, -0.035], ['#fde68a', 0.02, -0.02], ['#fbcfe8', -0.01, 0.025]] as const).forEach(function (n2) {
              ctx.fillStyle = night ? 'rgba(255,255,255,0.35)' : n2[0];
              ctx.fillRect(x + W * n2[1], y + H * n2[2], W * 0.032, H * 0.035);
          });
          ctx.fillStyle = '#ef4444';
          ellipse(x - W * 0.01, y - H * 0.045, 2.5 * s, 2.5 * s);
      }

      if (has('curtain2')) {                                  // 2かいの カーテン
          const wx = W * 0.17, wy = H * 0.18, ww = W * 0.21, wh = H * 0.30;
          ctx.fillStyle = night ? '#5b4636' : '#92400e';
          ctx.fillRect(wx - 11 * s, wy - 11 * s, ww + 22 * s, 6 * s);
          const panel = night ? ww * 0.52 : ww * 0.23;
          ctx.fillStyle = night ? '#7f5f8f' : '#c4b5fd';
          ctx.fillRect(wx - 7 * s, wy - 7 * s, panel, wh + 8 * s);
          ctx.fillRect(wx + ww + 7 * s - panel, wy - 7 * s, panel, wh + 8 * s);
      }

      if (has('dresser')) {                                   // たんす
          const x = W * 0.10, y = H * 0.74;
          ctx.fillStyle = night ? '#4b3418' : '#b4813f';
          ctx.fillRect(x - W * 0.075, y - H * 0.20, W * 0.15, H * 0.20);
          ctx.strokeStyle = night ? '#2a1d14' : '#8b5e34';
          ctx.lineWidth = 2;
          [0.06, 0.115, 0.17].forEach(function (q) {
              ctx.strokeRect(x - W * 0.065, y - H * q, W * 0.13, H * 0.05);
              ctx.fillStyle = '#fbbf24';
              ellipse(x, y - H * (q - 0.025), 3 * s, 3 * s);
          });
      }

      if (has('plushshelf')) {                                // ぬいぐるみの たな
          const x = W * 0.30, y = H * 0.56;
          ctx.fillStyle = night ? '#4b3418' : '#a16207';
          ctx.fillRect(x - W * 0.07, y, W * 0.14, H * 0.014);
          ([['#f9a8d4', -0.045], ['#7dd3fc', 0], ['#fde68a', 0.045]] as const).forEach(function (c) {
              ctx.fillStyle = night ? 'rgba(255,255,255,0.3)' : c[0];
              ellipse(x + W * c[1], y - H * 0.018, 8 * s, 7 * s);
              ellipse(x + W * c[1], y - H * 0.038, 6 * s, 5.5 * s);
              ellipse(x + W * c[1] - 5 * s, y - H * 0.048, 3 * s, 3 * s);
              ellipse(x + W * c[1] + 5 * s, y - H * 0.048, 3 * s, 3 * s);
          });
      }

      if (has('standmirror')) {                               // すがたみ
          const x = W * 0.60, y = H * 0.70;
          ctx.fillStyle = night ? '#4b3418' : '#a16207';
          ctx.fillRect(x - 4 * s, y - 4 * s, 8 * s, 8 * s);
          ctx.fillRect(x - 18 * s, y, 36 * s, 5 * s);
          ctx.fillStyle = night ? '#6b5a3a' : '#b4813f';
          ctx.fillRect(x - 20 * s, y - 88 * s, 40 * s, 86 * s);
          ctx.fillStyle = night ? '#475569' : '#e0f2fe';
          ctx.fillRect(x - 15 * s, y - 83 * s, 30 * s, 78 * s);
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.beginPath();
          ctx.moveTo(x - 12 * s, y - 20 * s);
          ctx.lineTo(x + 2 * s, y - 78 * s);
          ctx.lineTo(x + 10 * s, y - 78 * s);
          ctx.lineTo(x - 4 * s, y - 20 * s);
          ctx.closePath();
          ctx.fill();
      }

      if (has('bookpile')) {                                  // ほんの やま
          const x = W * 0.055, y = H * 0.90;
          ([['#a78bfa', 0], ['#fca5a5', -6], ['#7dd3fc', -12]] as const).forEach(function (bk) {
              ctx.fillStyle = night ? 'rgba(255,255,255,0.25)' : bk[0];
              ctx.fillRect(x - 13 * s + (bk[1] % 4) * s, y + bk[1] * s, 26 * s, 6 * s);
          });
      }

      if (has('skyposter')) {                                 // よぞらの ポスター
          const x = W * 0.62, y = H * 0.28;
          ctx.fillStyle = night ? '#1e1b4b' : '#312e81';
          ctx.fillRect(x - W * 0.055, y - H * 0.08, W * 0.11, H * 0.16);
          ctx.strokeStyle = night ? '#3b2f4f' : '#a16207';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(x - W * 0.055, y - H * 0.08, W * 0.11, H * 0.16);
          ctx.fillStyle = '#fef9c3';
          ellipse(x + W * 0.02, y - H * 0.03, 7 * s, 7 * s);
          ctx.fillStyle = '#fff';
          ([[-0.03, -0.05], [0.03, 0.03], [-0.02, 0.05], [0.04, -0.06]] as const).forEach(function (q) {
              ctx.fillRect(x + W * q[0], y + H * q[1], 2, 2);
          });
      }

      if (has('nightlight')) {                                // ムーンライト
          const x = W * 0.70, y = H * 0.47;
          if (night) {
              ctx.fillStyle = 'rgba(253,230,138,0.30)';
              ellipse(x, y, W * 0.06, W * 0.06);
          }
          ctx.fillStyle = night ? '#fde68a' : '#e2e8f0';
          ctx.beginPath();
          ctx.arc(x, y, 12 * s, Math.PI * 0.3, Math.PI * 1.7);
          ctx.arc(x + 5 * s, y, 10 * s, Math.PI * 1.7, Math.PI * 0.3, true);
          ctx.closePath();
          ctx.fill();
      }

      if (has('hanger')) {                                    // ハンガーラック
          const x = W * 0.735, y = H * 0.55;
          ctx.strokeStyle = night ? '#475569' : '#94a3b8';
          ctx.lineWidth = 3 * s;
          ctx.beginPath();
          ctx.moveTo(x - W * 0.07, y); ctx.lineTo(x + W * 0.07, y);
          ctx.stroke();
          ([[-0.045, '#ef4444'], [0, '#38bdf8'], [0.045, '#facc15']] as const).forEach(function (c) {
              const hx = x + W * c[0];
              ctx.strokeStyle = night ? '#64748b' : '#94a3b8';
              ctx.lineWidth = 2 * s;
              ctx.beginPath();
              ctx.moveTo(hx, y); ctx.lineTo(hx, y + 6 * s);
              ctx.stroke();
              ctx.fillStyle = night ? 'rgba(255,255,255,0.3)' : c[1];
              ctx.beginPath();
              ctx.moveTo(hx - 11 * s, y + 6 * s);
              ctx.lineTo(hx + 11 * s, y + 6 * s);
              ctx.lineTo(hx + 8 * s, y + 30 * s);
              ctx.lineTo(hx - 8 * s, y + 30 * s);
              ctx.closePath();
              ctx.fill();
          });
      }

      if (has('desk')) {                                      // べんきょうづくえ
          const x = W * 0.19, y = H * 0.87;
          ctx.fillStyle = night ? '#4b3418' : '#b4813f';
          ctx.fillRect(x - W * 0.10, y - H * 0.03, W * 0.20, H * 0.025);
          ctx.fillStyle = night ? '#3f2d1f' : '#8b5e34';
          ctx.fillRect(x - W * 0.095, y, W * 0.018, H * 0.10);
          ctx.fillRect(x + W * 0.077, y, W * 0.018, H * 0.10);
          ctx.fillRect(x - W * 0.095, y + H * 0.02, W * 0.19, H * 0.012);
          if (has('laptop')) {                                // パソコン
              ctx.fillStyle = night ? '#64748b' : '#cbd5e1';
              ctx.fillRect(x - W * 0.045, y - H * 0.035, W * 0.09, H * 0.008);
              ctx.fillStyle = night ? '#475569' : '#94a3b8';
              ctx.beginPath();
              ctx.moveTo(x - W * 0.04, y - H * 0.035);
              ctx.lineTo(x + W * 0.04, y - H * 0.035);
              ctx.lineTo(x + W * 0.05, y - H * 0.10);
              ctx.lineTo(x - W * 0.03, y - H * 0.10);
              ctx.closePath();
              ctx.fill();
              ctx.fillStyle = night ? '#1e293b' : '#38bdf8';
              ctx.beginPath();
              ctx.moveTo(x - W * 0.033, y - H * 0.042);
              ctx.lineTo(x + W * 0.036, y - H * 0.042);
              ctx.lineTo(x + W * 0.044, y - H * 0.094);
              ctx.lineTo(x - W * 0.025, y - H * 0.094);
              ctx.closePath();
              ctx.fill();
          }
          ctx.fillStyle = night ? '#3f2d1f' : '#a16207';      // いす
          ctx.fillRect(W * 0.325, y + H * 0.01, W * 0.05, H * 0.014);
          ctx.fillRect(W * 0.325, y - H * 0.06, W * 0.012, H * 0.075);
          ctx.fillRect(W * 0.333, y + H * 0.024, W * 0.01, H * 0.06);
          ctx.fillRect(W * 0.362, y + H * 0.024, W * 0.01, H * 0.06);
      }

      if (has('alarm')) {                                     // めざましどけい
          const x = W * 0.508, y = H * 0.785;
          ctx.fillStyle = night ? '#7f1d1d' : '#ef4444';
          ellipse(x, y, 9 * s, 9 * s);
          ctx.fillStyle = night ? '#94a3b8' : '#f8fafc';
          ellipse(x, y, 6.5 * s, 6.5 * s);
          ctx.strokeStyle = '#1f2937';
          ctx.lineWidth = 1.5 * s;
          ctx.beginPath();
          ctx.moveTo(x, y); ctx.lineTo(x, y - 4 * s);
          ctx.moveTo(x, y); ctx.lineTo(x + 3 * s, y + 2 * s);
          ctx.stroke();
          ctx.fillStyle = night ? '#7f1d1d' : '#ef4444';
          ellipse(x - 7 * s, y - 8 * s, 3.5 * s, 3.5 * s);
          ellipse(x + 7 * s, y - 8 * s, 3.5 * s, 3.5 * s);
      }

      if (has('bedbook')) {                                   // まくらもとの ほん
          const x = W * 0.455, y = H * 0.795;
          ctx.fillStyle = night ? '#4b3418' : '#7c3aed';
          ctx.fillRect(x - 9 * s, y - 5 * s, 18 * s, 5 * s);
          ctx.fillStyle = night ? '#5b4023' : '#a78bfa';
          ctx.fillRect(x - 9 * s, y - 9 * s, 18 * s, 4 * s);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(x - 7 * s, y - 8 * s, 14 * s, 2 * s);
      }

      if (has('bedplush')) {                                  // ベッドの ぬいぐるみ
          const x = W * 0.615, y = H * 0.79;
          ctx.fillStyle = night ? '#7f5f8f' : '#f9a8d4';
          ellipse(x, y, 11 * s, 10 * s);
          ellipse(x, y - 13 * s, 9 * s, 8 * s);
          ellipse(x - 7 * s, y - 19 * s, 4 * s, 4 * s);
          ellipse(x + 7 * s, y - 19 * s, 4 * s, 4 * s);
          ctx.fillStyle = '#1f2937';
          ellipse(x - 3 * s, y - 14 * s, 1.4 * s, 1.4 * s);
          ellipse(x + 3 * s, y - 14 * s, 1.4 * s, 1.4 * s);
      }
  }

  function drawBedBack(t: number) {
      const W = cw(), H = ch();
      const s = petScale() * (W / 380);
      ctx.save();
      ctx.translate(W * BED_X, H * 0.70 + 28 * s);
      ctx.scale(s, s);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ellipse(0, 26, 78, 8);
      ctx.fillStyle = '#92400e';                    // あし
      ctx.fillRect(-70, 14, 11, 10);
      ctx.fillRect(59, 14, 11, 10);
      ctx.fillStyle = '#a16207';                    // ヘッドボード
      ctx.fillRect(64, -52, 16, 66);
      ctx.fillStyle = '#b45309';                    // フレーム
      ctx.fillRect(-76, 2, 156, 14);
      ctx.fillStyle = '#fffbeb';                    // マットレス
      ctx.fillRect(-74, -10, 152, 14);
      ctx.fillStyle = '#fff';                       // まくら
      ellipse(50, -17, 22, 10);
      ctx.restore();
  }

  function drawBlanket(t: number) {
      const W = cw(), H = ch();
      const s = petScale() * (W / 380);
      ctx.save();
      ctx.translate(W * BED_X, H * 0.70 + 28 * s);
      ctx.scale(s, s);
      paintBands(-76, -26, 112, 30, styleColors('bedsheet', false, '#f472b6', '#f472b6'));   // ふとん
      ctx.fillStyle = 'rgba(255,255,255,0.55)';     // おりかえし
      ctx.fillRect(-76, -31, 112, 7);
      ctx.restore();

      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 3; i++) {
          const q = (t * 0.6 + i * 0.33) % 1;
          ctx.globalAlpha = 1 - q;
          ctx.fillText('Z', W * BED_X - 62 * s + q * 20, H * 0.70 - 34 * s - q * 40);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
  }

  function drawPoops() {
      const W = cw(), H = ch();
      const s = W / 380;
      const inTray = state.view === 'kitchen' && has('toilet');   // トイレは キッチンに ある
      ctx.save();
      ctx.fillStyle = '#78350f';
      state.poops.forEach((p, i) => {
          const k = (inTray ? 0.7 : 1) * s;
          const x = inTray ? W * 0.17 + (i - (state.poops.length - 1) / 2) * 10 * s : p.x * W;
          const y = inTray ? H * 0.95 - 10 * s : H * 0.86;
          ellipse(x, y, 12 * k, 6 * k);
          ellipse(x, y - 6 * k, 9 * k, 5 * k);
          ellipse(x, y - 11 * k, 5 * k, 4 * k);
      });
      ctx.restore();
  }

  function drawEgg(t: number) {
      const W = cw(), H = ch();
      const shake = action.type === 'shake' ? Math.sin(t * 40) * 0.12 : Math.sin(t * 1.6) * 0.04;
      ctx.save();
      ctx.translate(W / 2, H * 0.66);
      ctx.rotate(shake);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ellipse(0, 46, 40, 9);
      ctx.fillStyle = '#fffbeb';
      ellipse(0, 0, 42, 52);
      ctx.strokeStyle = 'rgba(120,53,15,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 42, 52, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fbcfe8';
      ellipse(-14, -8, 9, 7);
      ellipse(12, 10, 11, 8);
      ellipse(6, -24, 6, 5);
      if (state.tap >= 4) {
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-22, -12); ctx.lineTo(-8, -2); ctx.lineTo(2, -16); ctx.lineTo(16, -4);
          ctx.stroke();
      }
      ctx.restore();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('タップして あたためよう！ (' + state.tap + '/8)', W / 2, H * 0.94);
      ctx.textAlign = 'left';
  }

  function drawEyes(m: string, t: number) {
      const blink = (Math.sin(t * 1.3) > 0.985);
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';

      if (m === 'sleep' || blink) {
          [-16, 16].forEach((x) => {
              ctx.beginPath();
              ctx.arc(x, -8, 7, Math.PI * 0.15, Math.PI * 0.85);
              ctx.stroke();
          });
          return;
      }
      if (m === 'joy') {
          [-16, 16].forEach((x) => {
              ctx.beginPath();
              ctx.arc(x, -4, 7, Math.PI * 1.15, Math.PI * 1.85);
              ctx.stroke();
          });
          return;
      }
      if (m === 'sick') {
          [-16, 16].forEach((x) => {
              ctx.beginPath();
              ctx.moveTo(x - 6, -12); ctx.lineTo(x + 6, -3);
              ctx.moveTo(x + 6, -12); ctx.lineTo(x - 6, -3);
              ctx.stroke();
          });
          return;
      }
      [-16, 16].forEach((x) => {
          ctx.fillStyle = '#1f2937';
          ellipse(x, -8, 6, m === 'sad' ? 5 : 7);
          ctx.fillStyle = '#fff';
          ellipse(x + 2, -10, 2.2, 2.2);
      });
      if (m === 'sad') {
          ctx.fillStyle = '#38bdf8';
          ellipse(-22, 0, 3, 5);
      }
  }

  function drawMouth(m: string, t: number) {
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      if (m === 'eat') {
          ctx.fillStyle = '#be123c';
          ellipse(0, 10, 9, 7 + Math.sin(t * 18) * 3);
          return;
      }
      if (m === 'sad' || m === 'sick') {
          ctx.beginPath();
          ctx.arc(0, 16, 8, Math.PI * 1.2, Math.PI * 1.8);
          ctx.stroke();
          return;
      }
      if (m === 'sleep') {
          ctx.beginPath();
          ctx.arc(0, 8, 4, 0, Math.PI);
          ctx.stroke();
          return;
      }
      ctx.beginPath();
      ctx.arc(0, 6, m === 'joy' ? 11 : 8, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
  }

  function drawEars(sp: Species) {
      ctx.fillStyle = sp.accent;
      if (sp.ear === 'round') {
          ellipse(-34, -34, 13, 13);
          ellipse(34, -34, 13, 13);
      } else if (sp.ear === 'long') {
          ctx.save();
          ctx.rotate(-0.25); ellipse(-24, -48, 9, 22); ctx.restore();
          ctx.save();
          ctx.rotate(0.25); ellipse(24, -48, 9, 22); ctx.restore();
      } else if (sp.ear === 'horn') {
          [-26, 26].forEach((x) => {
              ctx.beginPath();
              ctx.moveTo(x - 10, -34);
              ctx.lineTo(x, -60);
              ctx.lineTo(x + 10, -34);
              ctx.closePath();
              ctx.fill();
          });
      } else if (sp.ear === 'star') {
          ctx.strokeStyle = sp.accent;
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(0, -60); ctx.stroke();
          ctx.fillStyle = '#facc15';
          star(0, -66, 5, 10, 5);
      }
  }

  function star(x: number, y: number, spikes: number, outer: number, inner: number) {
      let rot = -Math.PI / 2;
      const step = Math.PI / spikes;
      ctx.beginPath();
      ctx.moveTo(x, y - outer);
      for (let i = 0; i < spikes; i++) {
          ctx.lineTo(x + Math.cos(rot) * outer, y + Math.sin(rot) * outer);
          rot += step;
          ctx.lineTo(x + Math.cos(rot) * inner, y + Math.sin(rot) * inner);
          rot += step;
      }
      ctx.closePath();
      ctx.fill();
  }

  function drawAccessory(sp: Species) {
      if (sp.acc === 'crown') {
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.moveTo(-20, -44);
          ctx.lineTo(-20, -62); ctx.lineTo(-8, -52); ctx.lineTo(0, -66);
          ctx.lineTo(8, -52); ctx.lineTo(20, -62); ctx.lineTo(20, -44);
          ctx.closePath();
          ctx.fill();
      } else if (sp.acc === 'band') {
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(-40, -34, 80, 10);
          ctx.fillStyle = '#fff';
          ellipse(0, -29, 4, 4);
      } else if (sp.acc === 'bib') {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.moveTo(-22, 12); ctx.lineTo(22, 12); ctx.lineTo(14, 44); ctx.lineTo(-14, 44);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#ef4444';
          ellipse(0, 26, 6, 6);
      }
  }

  function drawCreature(t: number) {
      const W = cw(), H = ch();
      const sp = currentSpecies();
      const m = mood();
      const s = petScale() * (W / 380);
      let bob = Math.sin(t * 2.4) * 4;
      if (m === 'joy') bob = Math.abs(Math.sin(t * 6)) * -14;
      if (m === 'train') bob = Math.abs(Math.sin(t * 9)) * -10;
      if (m === 'sad' || m === 'sick') bob = Math.sin(t * 1.2) * 2;

      const baseY = H * 0.70 - (inBed ? 26 * s : 0);
      const cx = petPos * W;

      if (action.type !== 'bath') {
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.16)';
          ctx.beginPath();
          ctx.ellipse(cx, baseY + 52 * s, 44 * s, 10 * s, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
      }

      ctx.save();
      ctx.translate(cx, baseY + bob * s);
      ctx.scale(s, s);

      drawEars(sp);

      const capeId = wornVariant(['cape', 'cape_blue', 'cape_gold', 'cape_purple', 'cape_white', 'cape_orange', 'cape_mint', 'cape_pink', 'cape_black', 'cape_silver', 'cape_green', 'cape_brown', 'cape_sky', 'cape_rainbow', 'cape_lime', 'cape_navy', 'cape_cream', 'cape_coral', 'cape_jade', 'cape_violet', 'cape_rose', 'cape_ocean', 'cape_flame', 'cape_forest', 'cape_berry', 'cape_sand', 'cape_smoke', 'cape_grape', 'cape_pearl', 'cape_snow', 'cape_choco', 'cape_soda', 'cape_matcha', 'cape_sunrise', 'cape_night', 'cape_cherry', 'cape_honey', 'cape_rainbow2', 'cape_galaxy', 'cape_vanilla', 'cape_marine', 'cape_bubblegum', 'cape_moss', 'cape_twilight', 'cape_desert']);
      if (capeId) {                              // マント（からだの うしろ）
          const sway = Math.sin(t * 2) * 6;
          ctx.fillStyle = WEAR_COLOR[capeId][0];
          ctx.beginPath();
          ctx.moveTo(-32, -28);
          ctx.lineTo(32, -28);
          ctx.lineTo(78 + sway, 62);
          ctx.lineTo(-78 + sway, 62);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = WEAR_COLOR[capeId][1];
          ctx.fillRect(-34, -34, 68, 11);
      }
      if (isWorn('wings')) {              // はね
          ctx.fillStyle = '#fff';
          [-1, 1].forEach(function (d) {
              ctx.save();
              ctx.translate(d * 34, -4);
              ctx.rotate(d * 0.35 + Math.sin(t * 3) * 0.06 * d);
              ellipse(d * 22, 0, 24, 13);
              ellipse(d * 16, 14, 18, 10);
              ctx.restore();
          });
          ctx.fillStyle = 'rgba(148,163,184,0.45)';
          [-1, 1].forEach(function (d) { ellipse(d * 50, -4, 8, 5); });
      }

      if (isWorn('backpack')) {           // ランドセル
          ctx.fillStyle = '#b91c1c';
          ctx.fillRect(-64, -6, 30, 40);
          ctx.fillStyle = '#7f1d1d';
          ctx.fillRect(-64, -6, 30, 12);
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(-52, 6, 7, 5);
      }

      // 足
      ctx.fillStyle = sp.accent;
      ellipse(-22, 46, 15, 9);
      ellipse(22, 46, 15, 9);

      // 手
      const arm = m === 'joy' ? -18 : (m === 'train' ? -22 + Math.sin(t * 9) * 10 : (m === 'eat' ? -4 : 6));
      ctx.fillStyle = sp.accent;
      ellipse(-44, 12 + arm, 11, 11);
      ellipse(44, 12 + arm, 11, 11);

      // からだ
      ctx.fillStyle = sp.body;
      ellipse(0, 6, 44, 44);
      ctx.strokeStyle = 'rgba(31,41,55,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 6, 44, 44, 0, 0, Math.PI * 2);
      ctx.stroke();

      // おなか
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ellipse(0, 18, 26, 24);

      drawAccessory(sp);

      // ほっぺ
      if (m !== 'sick' && m !== 'sad') {
          ctx.fillStyle = 'rgba(248,113,113,0.55)';
          ellipse(-28, 4, 8, 5);
          ellipse(28, 4, 8, 5);
      }

      drawEyes(m, t);
      drawMouth(m, t);

      if (isWorn('rabbitear')) {          // うさみみ
          [-1, 1].forEach(function (d) {
              ctx.save();
              ctx.translate(d * 18, -40);
              ctx.rotate(d * 0.16);
              ctx.fillStyle = '#fff';
              ellipse(0, -24, 9, 26);
              ctx.fillStyle = '#fbcfe8';
              ellipse(0, -24, 4.5, 18);
              ctx.restore();
          });
      }

      if (isWorn('catear')) {             // ねこみみ
          [-1, 1].forEach(function (d) {
              ctx.fillStyle = '#4b5563';
              ctx.beginPath();
              ctx.moveTo(d * 14, -36);
              ctx.lineTo(d * 28, -68);
              ctx.lineTo(d * 40, -38);
              ctx.closePath();
              ctx.fill();
              ctx.fillStyle = '#fbcfe8';
              ctx.beginPath();
              ctx.moveTo(d * 20, -40);
              ctx.lineTo(d * 28, -58);
              ctx.lineTo(d * 34, -41);
              ctx.closePath();
              ctx.fill();
          });
      }

      if (isWorn('hat')) {                       // むぎわらぼうし
          ctx.fillStyle = '#fcd34d';
          ellipse(0, -38, 54, 13);
          ctx.fillStyle = '#fbbf24';
          ellipse(0, -50, 26, 17);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(-26, -47, 52, 7);
      }
      const ribbonId = wornVariant(['ribbon', 'ribbon_blue', 'ribbon_yellow', 'ribbon_green', 'ribbon_white', 'ribbon_purple', 'ribbon_orange', 'ribbon_mint', 'ribbon_black', 'ribbon_red', 'ribbon_sky', 'ribbon_brown', 'ribbon_gold', 'ribbon_lime', 'ribbon_navy', 'ribbon_cream', 'ribbon_coral', 'ribbon_jade', 'ribbon_violet', 'ribbon_rose', 'ribbon_silver', 'ribbon_ocean', 'ribbon_flame', 'ribbon_forest', 'ribbon_berry', 'ribbon_sand', 'ribbon_smoke', 'ribbon_grape', 'ribbon_pearl', 'ribbon_snow', 'ribbon_choco', 'ribbon_soda', 'ribbon_matcha', 'ribbon_sunrise', 'ribbon_night', 'ribbon_cherry', 'ribbon_honey', 'ribbon_rainbow', 'ribbon_galaxy', 'ribbon_vanilla', 'ribbon_marine', 'ribbon_bubblegum', 'ribbon_moss', 'ribbon_twilight', 'ribbon_desert']);
      if (ribbonId) {                     // リボン
          ctx.fillStyle = WEAR_COLOR[ribbonId][0];
          ctx.beginPath();
          ctx.moveTo(-30, -34); ctx.lineTo(-50, -45); ctx.lineTo(-50, -23);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(-30, -34); ctx.lineTo(-10, -45); ctx.lineTo(-10, -23);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = WEAR_COLOR[ribbonId][1];
          ellipse(-30, -34, 6, 6);
      }
      if (isWorn('crown')) {              // おうかん
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.moveTo(-24, -38);
          ctx.lineTo(-24, -60); ctx.lineTo(-10, -48); ctx.lineTo(0, -66);
          ctx.lineTo(10, -48); ctx.lineTo(24, -60); ctx.lineTo(24, -38);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#dc2626';
          ellipse(0, -44, 4, 4);
          ctx.fillStyle = '#38bdf8';
          ellipse(-14, -42, 3, 3);
          ellipse(14, -42, 3, 3);
      }
      if (isWorn('headphone')) {          // ヘッドホン
          ctx.strokeStyle = '#1f2937';
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.arc(0, -4, 46, Math.PI * 1.18, Math.PI * 1.82);
          ctx.stroke();
          ctx.fillStyle = '#334155';
          ellipse(-44, -8, 10, 13);
          ellipse(44, -8, 10, 13);
          ctx.fillStyle = '#ef4444';
          ellipse(-44, -8, 5, 7);
          ellipse(44, -8, 5, 7);
      }
      if (isWorn('hairflower')) {         // かみの おはな
          ctx.fillStyle = '#f472b6';
          for (let k = 0; k < 5; k++) {
              const a = k / 5 * Math.PI * 2;
              ellipse(28 + Math.cos(a) * 8, -36 + Math.sin(a) * 8, 6, 6);
          }
          ctx.fillStyle = '#facc15';
          ellipse(28, -36, 5, 5);
      }
      if (isWorn('glasses')) {            // めがね
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ellipse(-16, -8, 13, 13);
          ellipse(16, -8, 13, 13);
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(-16, -8, 13, 0, Math.PI * 2);
          ctx.moveTo(29, -8);
          ctx.arc(16, -8, 13, 0, Math.PI * 2);
          ctx.moveTo(-3, -10); ctx.lineTo(3, -10);
          ctx.moveTo(-29, -11); ctx.lineTo(-42, -15);
          ctx.moveTo(29, -11); ctx.lineTo(42, -15);
          ctx.stroke();
      }
      if (isWorn('sunglass')) {           // サングラス
          ctx.fillStyle = '#1f2937';
          ellipse(-17, -8, 15, 12);
          ellipse(17, -8, 15, 12);
          ctx.fillRect(-6, -11, 12, 5);
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ellipse(-21, -12, 5, 3);
          ellipse(13, -12, 5, 3);
          ctx.strokeStyle = '#1f2937';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-31, -10); ctx.lineTo(-44, -14);
          ctx.moveTo(31, -10); ctx.lineTo(44, -14);
          ctx.stroke();
      }
      const scarfId = wornVariant(['scarf', 'scarf_blue', 'scarf_green', 'scarf_purple', 'scarf_pink', 'scarf_yellow', 'scarf_orange', 'scarf_brown', 'scarf_gray', 'scarf_mint', 'scarf_black', 'scarf_white', 'scarf_gold', 'scarf_lime', 'scarf_navy', 'scarf_cream', 'scarf_coral', 'scarf_jade', 'scarf_violet', 'scarf_rose', 'scarf_silver', 'scarf_ocean', 'scarf_flame', 'scarf_forest', 'scarf_berry', 'scarf_sand', 'scarf_smoke', 'scarf_grape', 'scarf_pearl', 'scarf_snow', 'scarf_choco', 'scarf_soda', 'scarf_matcha', 'scarf_sunrise', 'scarf_night', 'scarf_cherry', 'scarf_honey', 'scarf_rainbow', 'scarf_galaxy', 'scarf_vanilla', 'scarf_marine', 'scarf_bubblegum', 'scarf_moss', 'scarf_twilight', 'scarf_desert']);
      if (scarfId) {                      // マフラー
          ctx.fillStyle = WEAR_COLOR[scarfId][0];
          ctx.fillRect(-42, 26, 84, 14);
          ctx.fillStyle = WEAR_COLOR[scarfId][1];
          ctx.fillRect(24, 34, 15, 30);
          ctx.fillStyle = WEAR_COLOR[scarfId][2];
          [-30, -10, 10, 30].forEach(function (q) { ctx.fillRect(q, 26, 6, 14); });
      }
      if (isWorn('necktie')) {            // ネクタイ
          ctx.fillStyle = '#1d4ed8';
          ctx.beginPath();
          ctx.moveTo(-9, 20); ctx.lineTo(9, 20); ctx.lineTo(5, 28); ctx.lineTo(-5, 28);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(-5, 28); ctx.lineTo(5, 28); ctx.lineTo(9, 48); ctx.lineTo(0, 54); ctx.lineTo(-9, 48);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#93c5fd';
          ctx.fillRect(-7, 32, 14, 4);
          ctx.fillRect(-8, 40, 16, 4);
      }

      if (isWorn('cheek')) {              // ほっぺシール
          ctx.fillStyle = '#facc15';
          star(-30, 6, 5, 8, 3.5);
          star(30, 6, 5, 8, 3.5);
      }

      if (isWorn('bandaid')) {            // ばんそうこう
          ctx.save();
          ctx.translate(-30, -20);
          ctx.rotate(-0.5);
          ctx.fillStyle = '#fcd9b6';
          ctx.fillRect(-13, -5, 26, 10);
          ctx.fillStyle = '#e7b98c';
          ctx.fillRect(-5, -5, 10, 10);
          ctx.restore();
      }

      if (isWorn('beard')) {              // つけひげ
          ctx.fillStyle = '#e5e7eb';
          ctx.beginPath();
          ctx.moveTo(-20, 4);
          ctx.quadraticCurveTo(-24, 40, 0, 44);
          ctx.quadraticCurveTo(24, 40, 20, 4);
          ctx.quadraticCurveTo(0, 16, -20, 4);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#f3f4f6';
          ellipse(-9, 2, 10, 5);
          ellipse(9, 2, 10, 5);
      }

      if (isWorn('mask')) {               // マスク
          ctx.fillStyle = '#fff';
          ctx.fillRect(-23, -2, 46, 26);
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 2;
          ctx.strokeRect(-23, -2, 46, 26);
          [6, 14].forEach(function (q) {
              ctx.beginPath();
              ctx.moveTo(-23, q); ctx.lineTo(23, q);
              ctx.stroke();
          });
          ctx.beginPath();
          ctx.moveTo(-23, 2); ctx.lineTo(-36, -6);
          ctx.moveTo(23, 2); ctx.lineTo(36, -6);
          ctx.stroke();
      }

      if (isWorn('necklace')) {           // ネックレス
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 12, 30, Math.PI * 0.15, Math.PI * 0.85);
          ctx.stroke();
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.moveTo(0, 36); ctx.lineTo(7, 44); ctx.lineTo(0, 52); ctx.lineTo(-7, 44);
          ctx.closePath();
          ctx.fill();
      }

      if (isWorn('gloves')) {             // てぶくろ
          const ga = m === 'joy' ? -18 : (m === 'train' || m === 'work' ? -22 + Math.sin(t * 9) * 10 : (m === 'eat' ? -4 : 6));
          ctx.fillStyle = '#fff';
          ellipse(-44, 12 + ga, 12, 12);
          ellipse(44, 12 + ga, 12, 12);
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 2;
          [-44, 44].forEach(function (hx) {
              ctx.beginPath();
              ctx.arc(hx, 12 + ga, 12, 0, Math.PI * 2);
              ctx.stroke();
          });
      }

      if (isWorn('watch')) {              // うでどけい
          const ga = m === 'joy' ? -18 : (m === 'train' || m === 'work' ? -22 + Math.sin(t * 9) * 10 : (m === 'eat' ? -4 : 6));
          ctx.fillStyle = '#334155';
          ctx.fillRect(34, 22 + ga, 20, 6);
          ctx.fillStyle = '#e2e8f0';
          ellipse(44, 25 + ga, 8, 8);
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(44, 25 + ga); ctx.lineTo(44, 20 + ga);
          ctx.moveTo(44, 25 + ga); ctx.lineTo(48, 27 + ga);
          ctx.stroke();
      }

      if (isWorn('boots')) {              // ながぐつ
          ctx.fillStyle = '#facc15';
          ellipse(-22, 44, 17, 12);
          ellipse(22, 44, 17, 12);
          ctx.fillStyle = '#ca8a04';
          ctx.fillRect(-33, 46, 22, 6);
          ctx.fillRect(11, 46, 22, 6);
      }

      if (isWorn('goggles')) {            // ゴーグル
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(0, -8, 44, Math.PI * 1.25, Math.PI * 1.75);
          ctx.stroke();
          ctx.fillStyle = 'rgba(125,211,252,0.75)';
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 3;
          [-17, 17].forEach(function (ex) {
              ctx.beginPath();
              ctx.ellipse(ex, -8, 15, 12, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
          });
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ellipse(-21, -13, 5, 3);
          ellipse(13, -13, 5, 3);
      }

      if (isWorn('cap')) {                // キャップ
          ctx.fillStyle = '#2563eb';
          ellipse(0, -44, 28, 19);
          ctx.fillRect(-28, -44, 56, 8);
          ctx.fillStyle = '#1d4ed8';
          ellipse(-30, -37, 26, 7);
          ctx.fillStyle = '#fff';
          ellipse(0, -52, 6, 5);
      }

      if (isWorn('headband')) {           // はちまき
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(-42, -32, 84, 9);
          ctx.fillStyle = '#dc2626';
          ellipse(0, -27, 6, 6);
          ctx.fillRect(38, -30, 16, 5);
      }

      if (isWorn('visor')) {              // サンバイザー
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(-32, -36, 64, 9);
          ctx.fillStyle = '#16a34a';
          ellipse(-28, -30, 28, 8);
      }

      if (isWorn('boots_blue')) {         // ながぐつ（あお）
          ctx.fillStyle = '#3b82f6';
          ellipse(-22, 44, 17, 12);
          ellipse(22, 44, 17, 12);
          ctx.fillStyle = '#1d4ed8';
          ctx.fillRect(-33, 46, 22, 6);
          ctx.fillRect(11, 46, 22, 6);
      }

      if (isWorn('hairpin')) {            // ヘアピン
          ctx.strokeStyle = '#f472b6';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(20, -30); ctx.lineTo(34, -36);
          ctx.stroke();
          ctx.fillStyle = '#facc15';
          star(36, -37, 5, 6, 2.5);
      }

      if (isWorn('earring')) {            // イヤリング
          [-38, 38].forEach(function (ex) {
              ctx.strokeStyle = '#fbbf24';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(ex, -14); ctx.lineTo(ex, -6);
              ctx.stroke();
              ctx.fillStyle = '#38bdf8';
              ctx.beginPath();
              ctx.moveTo(ex, -6); ctx.lineTo(ex + 5, 1); ctx.lineTo(ex, 8); ctx.lineTo(ex - 5, 1);
              ctx.closePath();
              ctx.fill();
          });
      }

      if (isWorn('foxmask')) {            // きつねの おめん
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.moveTo(-26, -44);
          ctx.lineTo(-16, -62);
          ctx.lineTo(-6, -46);
          ctx.lineTo(6, -46);
          ctx.lineTo(16, -62);
          ctx.lineTo(26, -44);
          ctx.quadraticCurveTo(28, -22, 0, -16);
          ctx.quadraticCurveTo(-28, -22, -26, -44);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#ef4444';
          ellipse(-14, -34, 6, 4);
          ellipse(14, -34, 6, 4);
          ctx.fillRect(-3, -24, 6, 6);
          ctx.fillStyle = '#1f2937';
          ellipse(-13, -36, 2, 2);
          ellipse(13, -36, 2, 2);
      }

      if (isWorn('gloves_red')) {         // てぶくろ（あか）
          const ga2 = m === 'joy' ? -18 : (m === 'train' || m === 'work' ? -22 + Math.sin(t * 9) * 10 : (m === 'eat' ? -4 : 6));
          ctx.fillStyle = '#ef4444';
          ellipse(-44, 12 + ga2, 12, 12);
          ellipse(44, 12 + ga2, 12, 12);
          ctx.fillStyle = '#fff';
          ctx.fillRect(-50, 20 + ga2, 12, 4);
          ctx.fillRect(38, 20 + ga2, 12, 4);
      }

      if (isWorn('cap_red')) {            // キャップ（あか）
          ctx.fillStyle = '#dc2626';
          ellipse(0, -44, 28, 19);
          ctx.fillRect(-28, -44, 56, 8);
          ctx.fillStyle = '#991b1b';
          ellipse(-30, -37, 26, 7);
          ctx.fillStyle = '#fff';
          ellipse(0, -52, 6, 5);
      }

      if (isWorn('beret')) {              // ベレーぼう
          ctx.fillStyle = '#7c3aed';
          ellipse(-4, -44, 30, 17);
          ctx.fillStyle = '#5b21b6';
          ellipse(-4, -38, 26, 9);
          ctx.fillStyle = '#a78bfa';
          ellipse(10, -54, 5, 5);
      }

      if (isWorn('collar')) {             // すずの くびわ
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.arc(0, 10, 32, Math.PI * 0.18, Math.PI * 0.82);
          ctx.stroke();
          ctx.fillStyle = '#facc15';
          ellipse(0, 41, 7, 7);
          ctx.strokeStyle = '#a16207';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-6, 41); ctx.lineTo(6, 41);
          ctx.stroke();
      }

      if (isWorn('shoes')) {              // スニーカー
          ctx.fillStyle = '#f8fafc';
          ellipse(-22, 45, 17, 11);
          ellipse(22, 45, 17, 11);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(-36, 47, 28, 5);
          ctx.fillRect(8, 47, 28, 5);
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 2;
          [-22, 22].forEach(function (fx2) {
              ctx.beginPath();
              ctx.moveTo(fx2 - 6, 41); ctx.lineTo(fx2 + 6, 44);
              ctx.moveTo(fx2 - 6, 45); ctx.lineTo(fx2 + 6, 41);
              ctx.stroke();
          });
      }

      if (isWorn('tophat')) {             // シルクハット
          ctx.fillStyle = '#1f2937';
          ellipse(0, -42, 42, 10);
          ctx.fillRect(-23, -86, 46, 45);
          ellipse(0, -86, 23, 7);
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(-23, -54, 46, 10);
      }

      // よごれ
      if (state.clean < 40) {
          ctx.fillStyle = 'rgba(120,53,15,0.45)';
          ellipse(-18, 30, 6, 4);
          ellipse(14, 36, 5, 3);
          if (state.clean < 20) ellipse(24, 18, 5, 4);
      }
      ctx.restore();

      // 状態アイコン
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      if (state.sick) {
          ctx.fillStyle = '#16a34a';
          ctx.fillText('🤒', cx + 46 * s, baseY - 44 * s);
      }
      if (!state.sleeping && !state.sick && state.hunger < 25) {
          ctx.fillText('🍖', cx - 52 * s, baseY - 44 * s + Math.sin(t * 3) * 4);
      }
      ctx.textAlign = 'left';
  }

  /* ---------------- action scenes ---------------- */

  // ペットと おなじ ざひょうけいを つかう
  function stageInfo() {
      const W = cw(), H = ch();
      return { W: W, H: H, s: petScale() * (W / 380), cx: petPos * W, baseY: H * 0.70 };
  }

  function drawFoodItem(key: string) {
      if (key === '__sweet') {                             // おかしやさんの おかし
          ctx.font = '46px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(sweetNow, 0, -12);
          ctx.textBaseline = 'alphabetic';
          return;
      }
      const fd = FOODS[key];
      if (fd && fd.emoji) {                                // あたらしい たべものは 絵文字で
          ctx.font = '46px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(fd.emoji, 0, -12);
          ctx.textBaseline = 'alphabetic';
          return;
      }
      if (key === 'feast') {
          ctx.fillStyle = '#fde68a';                       // ほね
          ctx.fillRect(-26, -6, 52, 7);
          ctx.beginPath();
          ctx.arc(-26, -2.5, 6, 0, Math.PI * 2);
          ctx.arc(26, -2.5, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#b45309';                       // おにく
          ellipse(0, -9, 21, 13);
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(0, -9, 21, 13, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#92400e';
          ellipse(-6, -13, 8, 4);
      } else if (key === 'cake') {
          ctx.fillStyle = '#fef3c7';                       // スポンジ
          ctx.beginPath();
          ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.lineTo(11, -26); ctx.lineTo(-11, -26);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#fbcfe8';                       // クリーム
          ctx.fillRect(-15, -15, 30, 6);
          ctx.beginPath();
          ctx.moveTo(-11, -26); ctx.lineTo(11, -26); ctx.lineTo(12, -31); ctx.lineTo(-12, -31);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#ef4444';                       // いちご
          ellipse(0, -35, 6, 6);
      } else if (key === 'carrot') {
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.moveTo(-9, -30); ctx.lineTo(9, -30); ctx.lineTo(0, 4);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#fdba74';
          ctx.lineWidth = 2;
          [-4, 2].forEach(function (q) {
              ctx.beginPath();
              ctx.moveTo(q - 5, -20 + q * 2); ctx.lineTo(q + 5, -22 + q * 2);
              ctx.stroke();
          });
          ctx.fillStyle = '#22c55e';
          [-8, 0, 8].forEach(function (q) { ellipse(q * 0.8, -36, 5, 9); });
      } else if (key === 'berry') {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.moveTo(-14, -22); ctx.quadraticCurveTo(-16, 4, 0, 6);
          ctx.quadraticCurveTo(16, 4, 14, -22);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#fecaca';
          ([[-6, -14], [4, -10], [-2, -2], [8, -18]] as const).forEach(function (q) { ellipse(q[0], q[1], 1.8, 2.4); });
          ctx.fillStyle = '#22c55e';
          [-9, 0, 9].forEach(function (q) { ellipse(q, -24, 7, 4); });
      } else if (key === 'onigiri') {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.moveTo(0, -30); ctx.lineTo(19, 4); ctx.lineTo(-19, 4);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(-11, -8, 22, 12);
      } else if (key === 'icecream') {
          ctx.fillStyle = '#d6a15b';
          ctx.beginPath();
          ctx.moveTo(-11, -12); ctx.lineTo(11, -12); ctx.lineTo(0, 14);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#fbcfe8';
          ellipse(0, -20, 13, 12);
          ctx.fillStyle = '#fde68a';
          ellipse(-4, -30, 10, 9);
          ctx.fillStyle = '#ef4444';
          ellipse(-4, -40, 4, 4);
      } else if (key === 'pudding') {
          ctx.fillStyle = '#fde68a';
          ctx.beginPath();
          ctx.moveTo(-16, -18); ctx.lineTo(16, -18); ctx.lineTo(12, 4); ctx.lineTo(-12, 4);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#b45309';
          ellipse(0, -18, 16, 5);
          ctx.fillStyle = '#fff';
          ellipse(0, -26, 8, 6);
          ctx.fillStyle = '#ef4444';
          ellipse(0, -33, 3.5, 3.5);
      } else if (key === 'fish') {
          ctx.fillStyle = '#93c5fd';
          ellipse(-2, -10, 20, 11);
          ctx.beginPath();
          ctx.moveTo(16, -10); ctx.lineTo(28, -19); ctx.lineTo(28, -1);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#60a5fa';
          ctx.beginPath();
          ctx.moveTo(-6, -19); ctx.lineTo(2, -26); ctx.lineTo(6, -18);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#1f2937';
          ellipse(-11, -12, 2.2, 2.2);
      } else if (key === 'pizza') {
          ctx.fillStyle = '#fcd34d';
          ctx.beginPath();
          ctx.moveTo(0, 4); ctx.lineTo(-22, -30); ctx.lineTo(22, -30);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(-22, -34, 44, 6);
          ctx.fillStyle = '#ef4444';
          ([[-8, -20], [6, -24], [0, -12]] as const).forEach(function (q) { ellipse(q[0], q[1], 4, 4); });
          ctx.fillStyle = '#22c55e';
          ellipse(9, -14, 3, 3);
      } else if (key === 'ramen') {
          ctx.fillStyle = '#fde68a';
          ellipse(0, -12, 20, 8);
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.moveTo(-24, -14); ctx.lineTo(24, -14);
          ctx.quadraticCurveTo(18, 8, 0, 8);
          ctx.quadraticCurveTo(-18, 8, -24, -14);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-21, -8); ctx.lineTo(21, -8);
          ctx.stroke();
          ctx.fillStyle = '#fca5a5';
          ellipse(-8, -16, 6, 3);
          ctx.fillStyle = '#22c55e';
          ellipse(8, -17, 5, 3);
          ctx.strokeStyle = '#a16207';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(10, -34); ctx.lineTo(20, -16);
          ctx.moveTo(15, -34); ctx.lineTo(24, -17);
          ctx.stroke();
      } else {
          ctx.fillStyle = '#fff';                          // ごはん
          ellipse(0, -14, 17, 11);
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(0, -14, 17, 11, 0, Math.PI, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#dc2626';                       // おちゃわん
          ctx.beginPath();
          ctx.moveTo(-23, -10);
          ctx.lineTo(23, -10);
          ctx.quadraticCurveTo(19, 9, 0, 9);
          ctx.quadraticCurveTo(-19, 9, -23, -10);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#fca5a5';
          ctx.fillRect(-23, -11, 46, 3);
          ctx.fillStyle = '#b91c1c';                       // だい
          ctx.fillRect(-7, 7, 14, 4);
      }
  }

  function drawFoodScene(t: number) {
      const st = stageInfo();
      const left = 1 - Math.floor(actionProgress() * 3) / 3;   // 3くちで たべおわる
      if (left <= 0) return;
      ctx.save();
      ctx.translate(st.cx - 76 * st.s, st.baseY + 12 * st.s + Math.sin(t * 9) * 2.5 * st.s);
      ctx.scale(st.s * 1.2, st.s * 1.2);
      ctx.scale(left, left);
      drawFoodItem(action.food ?? '');
      ctx.restore();
  }

  function drawTubBack(t: number) {
      const st = stageInfo();
      ctx.save();
      ctx.translate(st.cx, st.baseY);
      ctx.scale(st.s, st.s);
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ellipse(0, 64, 78, 10);
      ctx.fillStyle = '#e0f2fe';                               // タブ
      ctx.fillRect(-74, 24, 148, 34);
      ellipse(0, 58, 74, 12);
      ctx.fillStyle = '#bae6fd';                               // ふちの うちがわ
      ellipse(0, 24, 74, 17);
      ctx.restore();
  }

  function drawTubFront(t: number) {
      const st = stageInfo();
      ctx.save();
      ctx.translate(st.cx, st.baseY);
      ctx.scale(st.s, st.s);

      const wave = Math.sin(t * 3) * 1.5;
      ctx.fillStyle = 'rgba(56,189,248,0.95)';                 // おゆ
      ellipse(0, 30 + wave, 68, 14);

      ctx.fillStyle = '#e0f2fe';                               // タブの まえがわ
      ctx.beginPath();
      ctx.ellipse(0, 30, 74, 17, 0, 0, Math.PI);
      ctx.rect(-74, 30, 148, 30);
      ctx.fill();
      ctx.fillStyle = '#f0f9ff';
      ctx.beginPath();
      ctx.ellipse(0, 58, 74, 12, 0, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 30, 74, 17, 0, 0, Math.PI);
      ctx.stroke();

      ctx.fillStyle = '#fff';                                  // あわ（おゆの ふち）
      for (let i = 0; i < 9; i++) {
          const a = i / 8 * Math.PI;
          ctx.globalAlpha = 0.9;
          ellipse(-66 + i * 16.5, 30 + wave + Math.sin(t * 4 + i) * 2, 9 + (i % 3) * 2, 7);
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#fff';                                  // あたまの あわ
      ellipse(-12, -46, 12, 9);
      ellipse(4, -52, 14, 10);
      ellipse(16, -44, 10, 8);

      // アヒル
      ctx.fillStyle = '#facc15';
      ellipse(48, 22 + wave, 13, 9);
      ellipse(56, 12 + wave, 8, 8);
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(62, 11 + wave); ctx.lineTo(72, 14 + wave); ctx.lineTo(62, 16 + wave);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1f2937';
      ellipse(58, 10 + wave, 1.6, 1.6);
      ctx.restore();

      // ゆげ
      ctx.save();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4.5 * st.s;
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
          const q = (t * 0.5 + i * 0.33) % 1;
          ctx.globalAlpha = (1 - q) * 0.9;
          const x = st.cx + (-40 + i * 40) * st.s;
          const y = st.baseY + (10 - q * 70) * st.s;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + 10 * st.s, y - 10 * st.s, x, y - 20 * st.s);
          ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
  }

  function drawActivityScene(t: number) {
      const st = stageInfo();
      const a = ACTIVITIES.filter(function (x) { return x.id === action.food; })[0];
      if (!a) return;
      const bob = Math.sin(t * 6) * 4 * st.s;
      ctx.save();
      ctx.font = `${Math.round(46 * st.s)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(a.emoji, st.cx - 62 * st.s, st.baseY + 14 * st.s + bob);
      ctx.font = `${Math.round(22 * st.s)}px sans-serif`;
      for (let i = 0; i < 3; i++) {
          const q = (t * 0.8 + i * 0.33) % 1;
          ctx.globalAlpha = 1 - q;
          ctx.fillText('♪', st.cx + (48 + i * 10) * st.s, st.baseY - 30 * st.s - q * 40 * st.s);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      ctx.restore();
  }

  function drawWorkScene(t: number) {
      const st = stageInfo();
      const arm = 12 + (-22 + Math.sin(t * 9) * 10);
      const id = action.food;
      ctx.save();
      ctx.translate(st.cx, st.baseY);
      ctx.scale(st.s, st.s);
      if (id === 'carry') {                                  // にもつ
          ctx.fillStyle = '#d6a15b';
          ctx.fillRect(-30, arm - 56, 60, 38);
          ctx.strokeStyle = '#92400e';
          ctx.lineWidth = 3;
          ctx.strokeRect(-30, arm - 56, 60, 38);
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(-30, arm - 42, 60, 7);
      } else if (id === 'weed') {                            // くさ
          ctx.strokeStyle = '#16a34a';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ([[-64, -16], [-56, -24], [-48, -14]] as const).forEach(function (g) {
              ctx.beginPath();
              ctx.moveTo(-52, arm);
              ctx.quadraticCurveTo(g[0], arm + g[1], g[0] - 3, arm + g[1] * 1.7);
              ctx.stroke();
          });
          ctx.fillStyle = '#22c55e';
          ellipse(66, 44, 17, 7);
          ellipse(60, 38, 10, 5);
      } else {                                               // おみせばんの コイン
          ctx.fillStyle = '#facc15';
          ellipse(54, arm, 14, 14);
          ctx.strokeStyle = '#a16207';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(54, arm, 14, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#a16207';
          ctx.fillRect(47, arm - 2, 14, 3.5);
          ctx.fillRect(52, arm - 9, 4, 18);
      }
      ctx.restore();
  }

  function drawDumbbell(t: number) {
      const st = stageInfo();
      const y = 12 + (-22 + Math.sin(t * 9) * 10);
      ctx.save();
      ctx.translate(st.cx, st.baseY);
      ctx.scale(st.s, st.s);
      [-52, 52].forEach((x) => {
          ctx.fillStyle = '#64748b';
          ctx.fillRect(x - 12, y - 2.5, 24, 5);
          ctx.fillStyle = '#334155';
          ctx.fillRect(x - 16, y - 10, 8, 20);
          ctx.fillRect(x + 8, y - 10, 8, 20);
      });
      ctx.restore();
  }

  function drawBall(t: number) {
      const st = stageInfo();
      const hop = Math.abs(Math.sin(t * 5));
      const gx = st.cx + 58 * st.s, gy = st.baseY + 48 * st.s;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.beginPath();
      ctx.ellipse(gx, gy, (12 - hop * 4) * st.s, (4 - hop * 1.5) * st.s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(gx, gy - 13 * st.s - hop * 54 * st.s);
      ctx.scale(st.s, st.s);
      ctx.fillStyle = '#f8fafc';
      ellipse(0, 0, 13, 13);
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-13, 1);
      ctx.quadraticCurveTo(0, -7, 13, 1);
      ctx.stroke();
      ctx.restore();
  }

  // おてつだいロボット（へやを うろうろ しながら そうじする）
  function drawRobot(t: number) {
      if (!has('robot')) return;
      const W = cw(), H = ch(), s = W / 380;
      const night = isNight();
      const parked = state.sleeping;
      // じゅうでんきが あるときは リビングに もどって じゅうでん する
      if (parked && has('dock') && state.view !== 'living') return;
      const dockX = W * 0.90;
      const x = parked ? dockX - 14 * s : W * (0.14 + (Math.sin(t * 0.32) * 0.5 + 0.5) * 0.46);
      const y = isOutside() ? H * 0.945 : H * 0.965;
      const bob = parked ? 0 : Math.abs(Math.sin(t * 4)) * 2 * s;
      const face = night ? '#4ade80' : '#38bdf8';

      ctx.save();
      ctx.translate(x, y - bob);

      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ellipse(0, 2 * s, 20 * s, 5 * s);

      // キャタピラ
      ctx.fillStyle = night ? '#1e293b' : '#334155';
      ctx.fillRect(-18 * s, -10 * s, 36 * s, 11 * s);
      ctx.fillStyle = night ? '#334155' : '#64748b';
      [-11, 0, 11].forEach(function (q) {
          ellipse(q * s, -5 * s, 4 * s, 4 * s);
      });

      // からだ
      ctx.fillStyle = night ? '#64748b' : '#e2e8f0';
      ctx.fillRect(-16 * s, -34 * s, 32 * s, 25 * s);
      ctx.fillStyle = night ? '#475569' : '#cbd5e1';
      ctx.fillRect(-16 * s, -34 * s, 32 * s, 5 * s);

      // かお
      ctx.fillStyle = night ? '#0f172a' : '#1f2937';
      ctx.fillRect(-12 * s, -30 * s, 24 * s, 15 * s);
      ctx.fillStyle = face;
      const blink = Math.sin(t * 1.7) > 0.93;
      if (blink) {
          ctx.fillRect(-7 * s, -24 * s, 5 * s, 1.5 * s);
          ctx.fillRect(2 * s, -24 * s, 5 * s, 1.5 * s);
      } else {
          ellipse(-4.5 * s, -24 * s, 2.5 * s, 2.5 * s);
          ellipse(4.5 * s, -24 * s, 2.5 * s, 2.5 * s);
      }
      ctx.strokeStyle = face;
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.arc(0, -20 * s, 4 * s, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();

      // うで
      ctx.fillStyle = night ? '#475569' : '#94a3b8';
      const arm = Math.sin(t * 3) * 3 * s;
      ctx.fillRect(-22 * s, -28 * s + arm, 6 * s, 14 * s);
      ctx.fillRect(16 * s, -28 * s - arm, 6 * s, 14 * s);

      // アンテナ
      ctx.strokeStyle = night ? '#94a3b8' : '#64748b';
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(0, -34 * s); ctx.lineTo(0, -42 * s);
      ctx.stroke();
      ctx.fillStyle = (Math.sin(t * 4) > 0 ? '#ef4444' : '#7f1d1d');
      ellipse(0, -44 * s, 3 * s, 3 * s);

      ctx.restore();

      // ふきだし（おしゃべり）
      if (roboTalk.text && now() < roboTalk.until) {
          drawSpeech(x, y - 50 * s, roboTalk.text, s, night);
      }

      // そうじの ほこり
      if (!parked) {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = night ? '#94a3b8' : '#e2e8f0';
          for (let i = 0; i < 3; i++) {
              const q = (t * 1.2 + i * 0.33) % 1;
              ellipse(x - 22 * s - q * 14 * s, y - 6 * s - q * 6 * s, (2 + q * 3) * s, (2 + q * 2) * s);
          }
          ctx.globalAlpha = 1;
      }
  }

  // ロボットの ふきだし
  function drawSpeech(x: number, y: number, text: string, s: number, night: boolean) {
      const W = cw();
      const fs = Math.max(9, 9.5 * s);
      ctx.font = 'bold ' + fs + 'px sans-serif';

      // 13もじ くらいで おりかえす（ことばの くぎりで きる）
      const words = text.split(' ');
      const lines = [];
      let cur = '';
      words.forEach(function (w) {
          if (cur && (cur + w).length > 13) { lines.push(cur.trim()); cur = ''; }
          cur += w + ' ';
      });
      if (cur.trim()) lines.push(cur.trim());

      let tw = 0;
      lines.forEach(function (l) { tw = Math.max(tw, ctx.measureText(l).width); });
      const padX = 8 * s, padY = 6 * s, lh = fs * 1.35;
      const bw = tw + padX * 2, bh = lines.length * lh + padY * 2;
      let bx = clamp(x, bw / 2 + 4, W - bw / 2 - 4);
      // ペットの かおを かくさないように よこへ ずらす
      const px = petPos * W;
      if (!petHidden && Math.abs(bx - px) < bw / 2 + 30 * s) {
          bx = clamp(px + (x >= px ? 1 : -1) * (bw / 2 + 30 * s), bw / 2 + 4, W - bw / 2 - 4);
      }
      const by = y - bh;
      const r = 8 * s;

      ctx.fillStyle = night ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.96)';
      ctx.strokeStyle = night ? '#94a3b8' : '#94a3b8';
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(bx - bw / 2 + r, by);
      ctx.lineTo(bx + bw / 2 - r, by);
      ctx.quadraticCurveTo(bx + bw / 2, by, bx + bw / 2, by + r);
      ctx.lineTo(bx + bw / 2, by + bh - r);
      ctx.quadraticCurveTo(bx + bw / 2, by + bh, bx + bw / 2 - r, by + bh);
      ctx.lineTo(bx - bw / 2 + r, by + bh);
      ctx.quadraticCurveTo(bx - bw / 2, by + bh, bx - bw / 2, by + bh - r);
      ctx.lineTo(bx - bw / 2, by + r);
      ctx.quadraticCurveTo(bx - bw / 2, by, bx - bw / 2 + r, by);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // しっぽ（ロボットの ほうを さす）
      const tx = clamp(x, bx - bw / 2 + 8 * s, bx + bw / 2 - 8 * s);
      ctx.beginPath();
      ctx.moveTo(tx - 5 * s, by + bh - 1);
      ctx.lineTo(tx + 5 * s, by + bh - 1);
      ctx.lineTo(tx, by + bh + 8 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tx - 5 * s, by + bh);
      ctx.lineTo(tx, by + bh + 8 * s);
      ctx.lineTo(tx + 5 * s, by + bh);
      ctx.stroke();

      ctx.fillStyle = night ? '#e2e8f0' : '#1f2937';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach(function (l, i) {
          ctx.fillText(l, bx, by + padY + lh * (i + 0.5));
      });
      ctx.textBaseline = 'alphabetic';
  }

  // ばしょごとの えがきかた

  // かざりは へやの あちこちに おく（たなに ならべる だけに しない）

  // k ばんめの かざりを どこに おくか
  function decorSpot(k: number, zone: DecorZone) {
      const wall = (k % 2 === 0);
      const idx = Math.floor(k / 2);
      const right = (idx % 2 === 1);
      const step = Math.floor(idx / 2);
      const col = step % 4;
      const row = Math.floor(step / 4);
      const x = right ? 0.95 - col * 0.085 : 0.05 + col * 0.085;
      const y = wall ? zone.wallY + (row % 5) * 0.10
                     : zone.floorY + (row % 3) * 0.045;
      return [x, y];
  }

  let decorCache: { count: number; byCat: Record<string, { deco?: string; cat: string }[]> } | null = null;

  function decorDirty() { decorCache = null; }

  function decorBuild() {
      const byCat: Record<string, { deco?: string; cat: string }[]> = {};
      let n = 0;
      SHOP.forEach(function (it) {
          if (!it.deco || !has(it.id)) return;
          n++;
          (byCat[it.cat] = byCat[it.cat] || []).push(it);
      });
      // 🪑 かぐやさんで かった かぐも おうちに かざる
      const furn = byCat.room = byCat.room || [];
      if (state.furnAll) {
          n += DECOR_MAX;
          for (let k = 0; k < DECOR_MAX; k++) {
              furn.push({ deco: FU_KIND[k % FU_KIND.length].e, cat: 'room' });
          }
      } else if (state.furn) {
          const keys = Object.keys(state.furn);
          n += keys.length;
          keys.slice(0, DECOR_MAX).forEach(function (k) {
              try { furn.push({ deco: furnEmoji(BigInt(k)), cat: 'room' }); } catch (e) { /* こわれた キーは むし */ }
          });
      }
      // 🌈 デパートで かった ものも おうちに ならぶ
      if (state.moreAll) {
          n += DECOR_MAX;
          for (let k = 0; k < DECOR_MAX; k++) {
              const sh = MORE_FLOORS[k % MORE_FLOORS.length];
              furn.push({ deco: sh.kind[k % sh.kind.length].e, cat: 'room' });
          }
      } else if (state.more) {
          MORE_FLOORS.forEach(function (sh) {
              const keys = Object.keys(state.more[sh.id] || {});
              n += keys.length;
              keys.slice(0, 12).forEach(function (k) {
                  furn.push({ deco: moreEmoji(sh, moKeyDigits(k)), cat: 'room' });
              });
          });
      }
      decorCache = { count: n, byCat: byCat };
  }

  function decorCount() {
      if (!state.owned) return 0;
      if (!decorCache) decorBuild();
      return decorCache ? decorCache.count : 0;
  }


  function drawDecor(cat: string) {
      const zone = DECOR_ZONE[cat];
      if (!zone || !state.owned) return;
      if (!decorCache) decorBuild();
      const cache = decorCache;
      if (!cache) return;
      let list = cache.byCat[cat] || [];
      if (cat === 'room') list = list.concat(cache.byCat.friend || []);
      if (!list.length) return;
      if (list.length > DECOR_MAX) list = list.slice(0, DECOR_MAX);   // へやに かざるのは 60こまで

      const W = cw(), H = ch(), s = W / 380;
      const size = Math.max(9 * s, Math.min(18 * s, 18 * s * Math.pow(16 / list.length, 0.25)));
      ctx.font = size + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      list.forEach(function (it, i) {
          const sp = decorSpot(i, zone);
          ctx.fillText(it.deco ?? '', W * sp[0], H * sp[1]);
      });
      ctx.textBaseline = 'alphabetic';
  }

  function drawParticles(dt: number, t: number) {
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      particles = particles.filter((p) => {
          p.life -= dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 30 * dt;
          if (p.life <= 0) return false;
          ctx.globalAlpha = clamp(p.life, 0, 1);
          const icon = p.type === 'heart' ? '💛' : p.type === 'star' ? '⭐' :
                       p.type === 'bubble' ? '🫧' : '💦';
          ctx.fillText(icon, p.x, p.y);
          ctx.globalAlpha = 1;
          return true;
      });
      ctx.textAlign = 'left';
  }

  // どの ばしょを どの絵で描くか。絵を描く側を指すので、ここは閉じた形の中に置く。
  const PLACE_DRAW: Record<string, ((t: number) => void) | undefined> = {
      park: drawPark, shop: drawShopTown, school: drawSchool, hospital: drawHospital,
      beach: drawBeach, mountain: drawMountain, fun: drawFun, zoo: drawZoo,
      aqua: drawAqua, onsen: drawOnsen, library: drawLibrary, cinema: drawCinema, shrine: drawShrine,
      bank: drawBank,
  };

  /* ---------------- UI ---------------- */

  function setBar(id: string, numId: string | null, value: number) {
      el(id).style.width = clamp(value, 0, 100) + '%';
      if (numId) el(numId).textContent = String(Math.round(value));
  }

  function updateUI() {
      el('pet-name').textContent = state.stage === 'egg' ? 'たまご' : state.name;
      el('coin-view').textContent = '🪙 ' + coinText(state.coins);
      el('stage-view').textContent = state.stage === 'egg' ? 'たまご' : currentSpecies().name;
      el('age-view').textContent = Math.floor(state.ageSec / DAY_SEC) + '日目';
      el('power-view').textContent = 'ちから ' + state.power;

      setBar('hunger-bar', 'hunger-num', state.hunger);
      setBar('happy-bar', 'happy-num', state.happy);
      setBar('clean-bar', 'clean-num', state.clean);
      setBar('energy-bar', 'energy-num', state.energy);
      setBar('hp-bar', 'hp-num', state.hp);
      setBar('exp-bar', null, state.exp / expNeeded(state.level) * 100);
      el('level-num').textContent = String(state.level);

      el('btn-sleep').textContent = state.sleeping ? '☀ おこす' : '💤 ねる';
      ([['btn-view-out', 'out'], ['btn-view-park', 'park'], ['btn-view-shop', 'shop'], ['btn-view-school', 'school'],
       ['btn-view-bank', 'bank'], ['btn-view-living', 'living'], ['btn-view-kitchen', 'kitchen'], ['btn-view-bed', 'bed']] as const).forEach(function (pair) {
          el(pair[0]).classList.toggle('view-off', (state.view || 'out') !== pair[1]);
      });
      // クイックボタンに ない ばしょに いるときは 「おでかけ」を ひからせる
      const quick = ['out', 'park', 'shop', 'school', 'bank', 'living', 'kitchen', 'bed'];
      el('btn-map').classList.toggle('view-off', quick.indexOf(state.view || 'out') >= 0);

      const locked = state.stage === 'egg' || state.sleeping;
      ['btn-feed', 'btn-play', 'btn-train', 'btn-job', 'btn-bath', 'btn-clean', 'btn-med'].forEach((id) => {
          el(id).classList.toggle('disabled', locked);
      });
      el('btn-med').classList.toggle('disabled', locked || !state.sick);

      const talk = has('robot') && state.stage !== 'egg';   // ロボットが いるときだけ はなせる
      el('btn-talk').style.display = talk ? '' : 'none';
      el('row-extra').className = 'grid grid-cols-' + (talk ? 3 : 2) + ' gap-2 mb-2';
  }

  /* ---------------- main loop ---------------- */

  function frame(ts: number) {
      const t = ts / 1000;
      let dt = lastFrame ? t - lastFrame : 0;
      lastFrame = t;
      dt = clamp(dt, 0, 0.5);

      if (action.type && now() > action.until) action.type = null;

      applyTime(dt);

      if (mini.active) {
          mini.pos += mini.dir * mini.speed * dt;
          if (mini.pos >= 1) { mini.pos = 1; mini.dir = -1; }
          if (mini.pos <= 0) { mini.pos = 0; mini.dir = 1; }
          const marker = el('mini-marker');
          if (marker) marker.style.left = (mini.pos * 100) + '%';
      }

      // ねるときは げんかん（そと）／ベッド（なか）まで あるいて いく
      const outside = isOutside();
      petPos += (petTarget() - petPos) * Math.min(1, dt * 3.5);
      petHidden = state.sleeping && (outside
          ? Math.abs(petPos - DOOR_X) < 0.012        // おうちの なかに はいった
          : !inBedroom());                           // 2かいで ねている
      inBed = inBedroom() && state.sleeping && Math.abs(petPos - BED_X) < 0.02;

      if (outside) {
          drawBackground(t);
          const paint = PLACE_DRAW[state.view];
          if (paint) paint(t);
          else {
              drawYard(t);
              drawHouse(t);
              drawHouseExtras(t);
              drawDecor('yard');
          }
      } else {
          drawRoom(t);
          drawDecor(state.view === 'living' ? 'room' : state.view === 'kitchen' ? 'kitchen' : 'bedroom');
          if (inBedroom()) drawBedBack(t);
          if (state.view === 'living') drawRoomFloor(t);
      }
      if (state.stage === 'egg') {
          drawEgg(t);
      } else {
          drawFriends(t);                            // ともだちは ペットの うしろに
          drawPoops();
          if (!petHidden) {
              if (action.type === 'bath') drawTubBack(t);
              drawCreature(t);
              if (inBed) drawBlanket(t);
              if (action.type === 'bath') drawTubFront(t);
              else if (action.type === 'eat') drawFoodScene(t);
              else if (action.type === 'train') drawDumbbell(t);
              else if (action.type === 'work') drawWorkScene(t);
              else if (action.type === 'activity') drawActivityScene(t);
              else if (action.type === 'play') drawBall(t);
          }
      }
      if (state.stage !== 'egg') drawRobot(t);
      drawParticles(dt, t);
      updateUI();

      saveTimer += dt;
      if (saveTimer > 5) { saveTimer = 0; save(); }

      requestAnimationFrame(frame);
  }



  // ── 組み立てた HTML から呼ぶ口 ──────────────────────────────────
  //
  // モーダルは HTML の文字列として組み立てていて、その中に onclick が108箇所ある。
  // ひとつずつリスナに組み替える方が、書き写しの間違いが入りやすい。文字列はそのまま
  // 残し、呼び先だけを mount のあいだ立てる名前空間に寄せる。後片付けで消す。
  const api: PetApi = {
    hideModal, setShopTab, shopGo, openChat, swGo, setBankTab, sendOrder, sendChat, openShop,
    moGo, meetFriend, infGo, gotoPlace, fuGo, bankTyped, wearItem, useStyle, talkTo, takeOffAll,
    swRandom, swJump, stopMini, startPlay, shopReset, setMoreShop, setMoreBld, peelAll, moveOut,
    moveIn, moRandom, moJump, infRandom, infJump, hardReset, getAllItems, fuRandom, fuJump, feed,
    eatSweet, doJob, doActivity, decideName, confirmShopReset, confirmReset, buyMoreAt, buyItem,
    buyInf, buyFurn, bankTake, bankPut, acctTake, acctPut, confirmGetAll,
    setBankDraft, setChatDraft, setFuDraft, setInfDraft, setMoreDraft, setOrderDraft, setSwDraft,
    setView, openMap, openFoodMenu, openPlayMenu, doTrain, openJobMenu, doBath, doCleanPoop,
    toggleSleep, useMedicine, openTalk, openBank, openFriends, openStatus, openReport,
  };
  (window as unknown as { __pet?: PetApi }).__pet = api;

  const onResize = (): void => resize();
  const onTap = (): void => tapCanvas();
  const onHide = (): void => { if (document.hidden) save(); };

  // そだてた にっすうが この ゲームの点。日が変わったところで記録する。
  //
  // 終わりの無いゲームなので「1回の走り」が決めにくい。日が増えた時にすれば、
  // 記録は増える一方になり、ランキングは一番育った日数を指す。
  let lastDay = -1;

  function frameLoop(ts: number): void {
    if (disposed) return;
    frame(ts);
    const day = Math.floor(state.ageSec / DAY_SEC);
    if (day > lastDay) {
      const first = lastDay < 0;
      lastDay = day;
      // 開いた直後に、続きからで読んだ日数をもう一度書かない。
      if (!first && day > 0) game.onFinish(day, Date.now() - state.ageSec * 1000);
    }
  }

  void (async () => {
    resize();
    window.addEventListener('resize', onResize);

    const loaded = await loadSaved();
    if (disposed) return;
    if (!loaded.ok) {
      // 読めなかった。新しく始めると、次の保存が育てた分を空で上書きする。
      game.setStatus('続きからを読めませんでした。遊べますが、記録は残しません。');
    } else if (loaded.state) {
      state = loaded.state;
      const away = clamp(now() - state.lastTick, 0, OFFLINE_CAP);
      if (away > 60) {
        applyTime(away);
        addLog(`（${Math.floor(away / 60)}分ぶん じかんが すすんだ）`);
        if (!state.exhausted && (state.hp < 40 || state.sick)) {
          addLog(`${state.name} が ぐったりしている… はやく おせわしよう！`);
        }
      }
    }

    petPos = petTarget();
    petHidden = state.sleeping && (isOutside() || !inBedroom());
    inBed = inBedroom() && state.sleeping;

    canvas.addEventListener('click', onTap);
    el('modal-back').addEventListener('click', (e) => {
      if (e.target === el('modal-back') && el('modal-back').dataset.closable !== '0') hideModal();
    });
    document.addEventListener('visibilitychange', onHide);

    renderLog();
    updateUI();
    animationId = requestAnimationFrame(frameLoop);
  })();

  return () => {
    disposed = true;
    if (animationId) cancelAnimationFrame(animationId);
    window.removeEventListener('resize', onResize);
    canvas.removeEventListener('click', onTap);
    document.removeEventListener('visibilitychange', onHide);
    delete (window as unknown as { __pet?: PetApi }).__pet;
    // 溜めている分は、遊び場の側が dispose で出し切る。
    host.replaceChildren();
  };
};
