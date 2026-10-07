// コマンドバトル。「たたかう・まほう・ぼうぎょ・やくそう」から えらんで、つぎつぎ
// でてくる モンスターと 1体ずつ たたかう。たおすたびに つぎの かいそうへ すすむ。
//
// たたかい（BLADE DESTROYER）とは わざと 別の 作りに してある。あちらは 手を うごかす
// 速さで きまる アクションで、こちらは 何を えらぶかで きまる。同じ「戦い」でも、
// にがての 子が 変わるので、2本ある ほうが 遊べる 人が ふえる。
//
// canvas は 使わない。絵は 文字と CSS だけで 出す——えらぶ 遊びは 1秒に 60回 描き直す
// 必要が なく、DOM の ほうが 字が 読みやすい（ふりがな の ない 子でも 読める 大きさに
// できる）。そのぶん、毎フレームの ループも 持たない。うごくのは 手番の あいだだけ。
//
// 点は「たおした かず」。かいそうが すすむほど 相手が 強くなるので、上に いくほど
// 1体が 重い。きえる 途中が 無いので 置き場（ctx.save）は 使わない——1回の 遊びが
// その場で 終わる かたち。
//
// まほうに 使う 数（MP）は 持たない。残りを かぞえる ものを 置くと、えらぶ 遊びが
// やりくりの 遊びに なる。ここで えらぶのは「残りが あるか」ではなく「目の前の
// 相手に どれが 合うか」——かたい 相手には まほう、柔らかい 相手には けん。

import type { GameMount } from './types';

/**
 * モンスターの くせ。
 *
 * 強さの 数（HP・こうげき）だけで ならべると、どの 相手にも「たたかう」を
 * おしつづける のが 一番 強くなる。えらぶ 意味を 出すために、数ではなく
 * ふるまいを 変える ものを 持たせる。
 */
type Trait =
  /** ときどき よける。あてに いく だけでは すすまない。 */
  | 'dodge'
  /** ときどき まほうを うつ。ぼうぎょが 効かない ので、HP を 高く たもつ ことで よける。 */
  | 'magic'
  /** かたい。ふつうの こうげきが とおりにくく、まほうの ほうが 速い。 */
  | 'hard'
  /** 2回 うごく。ボス。 */
  | 'boss';

type Kind = {
  readonly name: string;
  readonly face: string;
  readonly hp: number;
  readonly atk: number;
  readonly def: number;
  readonly exp: number;
  readonly trait?: Trait;
};

/**
 * ふつうの モンスター。この じゅんばんに 出てくる（6体で ひとまわり）。
 *
 * ひとまわり するたびに 強さが 上がる（scaleKind）ので、同じ 顔でも 同じ 相手では ない。
 */
const KINDS: readonly Kind[] = [
  { name: 'スライム', face: '🟢', hp: 18, atk: 6, def: 2, exp: 6 },
  { name: 'こうもり', face: '🦇', hp: 15, atk: 8, def: 1, exp: 8, trait: 'dodge' },
  { name: 'ゴブリン', face: '👺', hp: 28, atk: 10, def: 4, exp: 11 },
  { name: 'がいこつ', face: '💀', hp: 36, atk: 12, def: 6, exp: 14 },
  { name: 'まじょ', face: '🧙', hp: 30, atk: 11, def: 3, exp: 17, trait: 'magic' },
  { name: 'ゴーレム', face: '🗿', hp: 48, atk: 15, def: 9, exp: 22, trait: 'hard' },
];

/** 5かいそう ごとの ボス。こちらも ひとまわり するたびに 強くなる。 */
const BOSSES: readonly Kind[] = [
  { name: 'ドラゴン', face: '🐉', hp: 80, atk: 17, def: 6, exp: 40, trait: 'boss' },
  { name: 'デーモン', face: '😈', hp: 110, atk: 20, def: 9, exp: 55, trait: 'boss' },
  { name: 'まおう', face: '👹', hp: 150, atk: 24, def: 11, exp: 75, trait: 'boss' },
];

type Enemy = {
  readonly name: string;
  readonly face: string;
  readonly maxHp: number;
  hp: number;
  readonly atk: number;
  readonly def: number;
  readonly exp: number;
  readonly trait?: Trait;
};

/**
 * かいそうに あわせて 強さを のばす。
 *
 * HP の のびを こうげきより 大きく してある。こうげきを 同じだけ のばすと、
 * 上の かいそうで 1手で 力尽きる——「えらびかたを まちがえた」のか「もう どうにも
 * ならない」のか が、遊んでいる 側から 区別できなくなる。
 */
const scaleKind = (kind: Kind, floor: number): Enemy => {
  const step = floor - 1;
  // ボスは もともと 固いので、のびを 半分に する。ふつうの 敵と 同じ のびに すると、
  // 2体めの ボスで もう 当てる 数が 足りなくなる——こちらの こうげきは レベルで
  // 上がるが、レベルは かいそうほど 速くは 上がらない。
  const hpStep = kind.trait === 'boss' ? 0.08 : 0.16;
  const hp = Math.round(kind.hp * (1 + step * hpStep));
  return {
    name: kind.name,
    face: kind.face,
    maxHp: hp,
    hp,
    atk: Math.round(kind.atk * (1 + step * 0.055)),
    def: Math.round(kind.def * (1 + step * 0.04)),
    exp: Math.round(kind.exp * (1 + step * 0.08)),
    trait: kind.trait,
  };
};

/** そのかいそうの 相手。5の ばいすうは ボス。 */
const enemyOf = (floor: number): Enemy => {
  if (floor % 5 === 0) {
    const boss = BOSSES[Math.floor(floor / 5 - 1) % BOSSES.length];
    return scaleKind(boss as Kind, floor);
  }
  const kind = KINDS[(floor - 1) % KINDS.length];
  return scaleKind(kind as Kind, floor);
};

type Spell = {
  readonly id: string;
  readonly name: string;
  /** つかえるように なる レベル。 */
  readonly lv: number;
  readonly note: string;
};

/**
 * まほう。
 *
 * つかうのに 何も 要らない。数を かぞえる ものを 持つと、小さい子には
 * 「えらぶ」より「やりくり」の 遊びに なってしまう——ここで えらぶのは
 * 残りの 数ではなく、目の前の 相手に どれが 合うか。
 *
 * こうげきの まほうは あいての ぼうぎょを 半分しか 見ない。かたい 相手には
 * まほうの ほうが 速い——「たたかう」だけでは すすまない 相手を 置くための 道。
 */
const SPELLS: readonly Spell[] = [
  { id: 'fire', name: 'ファイア', lv: 1, note: 'ぼうぎょを はんぶん むしして もやす' },
  { id: 'heal', name: 'ヒール', lv: 2, note: 'HP を 40% ぶん なおす' },
  { id: 'bolt', name: 'いかずち', lv: 4, note: 'ぼうぎょを ぜんぶ むしして つらぬく' },
];

type Phase = 'start' | 'input' | 'spell' | 'busy' | 'over';

const CSS = `
.bt{position:absolute;inset:0;overflow-y:auto;box-sizing:border-box;
  background:linear-gradient(#1e1b4b,#020617);color:#e5e7eb;
  font:15px/1.7 'Hiragino Maru Gothic ProN','Arial Rounded MT Bold',system-ui,sans-serif;
  -webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
.bt-app{max-width:480px;margin:0 auto;padding:10px 10px 20px;box-sizing:border-box;
  display:flex;flex-direction:column;gap:8px;min-height:100%}
.bt-panel{background:rgba(15,23,42,.85);border:3px solid #475569;border-radius:14px;
  padding:10px;box-sizing:border-box}
.bt-head{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:.8rem}
.bt-floor{font-weight:700;color:#facc15}
.bt-kill{color:#93c5fd}
.bt-btn-s{background:#334155;border:0;border-radius:999px;padding:3px 10px;font-size:.72rem;
  color:#e5e7eb;font-family:inherit;cursor:pointer}
.bt-stage{position:relative;text-align:center;padding:14px 10px;min-height:150px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
.bt-face{font-size:64px;line-height:1;display:block;filter:drop-shadow(0 6px 6px rgba(0,0,0,.6))}
.bt-face.hurt{animation:bt-shake .3s}
.bt-face.gone{animation:bt-gone .5s forwards}
@keyframes bt-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-10px) rotate(-8deg)}
  50%{transform:translateX(10px) rotate(8deg)}80%{transform:translateX(-6px)}}
@keyframes bt-gone{to{transform:scale(.2) rotate(40deg);opacity:0}}
.bt-face.comes{animation:bt-comes .4s}
@keyframes bt-comes{from{transform:translateY(-30px) scale(.4);opacity:0}}
.bt-ename{font-weight:700;font-size:.95rem}
.bt-ename .trait{font-size:.7rem;color:#fcd34d;margin-left:6px}
.bt-bar{width:170px;height:10px;background:#450a0a;border:2px solid #0f172a;border-radius:999px;
  overflow:hidden}
.bt-bar i{display:block;height:100%;background:#ef4444;transition:width .3s}
.bt-pop{position:absolute;left:50%;top:26px;transform:translateX(-50%);font-weight:700;
  font-size:1.5rem;color:#fde047;text-shadow:0 2px 0 #000,0 0 10px rgba(0,0,0,.8);
  pointer-events:none;opacity:0}
.bt-pop.go{animation:bt-pop .8s forwards}
@keyframes bt-pop{0%{opacity:1;transform:translate(-50%,0) scale(.6)}
  30%{transform:translate(-50%,-10px) scale(1.2)}100%{opacity:0;transform:translate(-50%,-40px)}}
.bt-me{display:flex;gap:10px;align-items:center}
.bt-me .face{font-size:34px;line-height:1}
.bt-me .face.hurt{animation:bt-shake .3s}
.bt-gauges{flex:1;display:flex;flex-direction:column;gap:3px;font-size:.74rem}
.bt-gauge{display:flex;align-items:center;gap:6px}
.bt-gauge .k{width:2.1rem;font-weight:700}
.bt-gauge .k.hp{color:#4ade80}
.bt-gauge .t{flex:1;height:9px;background:#1f2937;border-radius:999px;overflow:hidden}
.bt-gauge .t i{display:block;height:100%;transition:width .3s}
.bt-gauge .t i.hp{background:#22c55e}
.bt-gauge .n{width:4.6rem;text-align:right;font-family:ui-monospace,monospace}
.bt-stat{display:flex;gap:10px;font-size:.72rem;color:#cbd5e1;margin-top:4px}
.bt-log{font-size:.8rem;line-height:1.55;min-height:4.6em;white-space:pre-wrap}
.bt-log p{margin:0}
.bt-log p.dim{color:#94a3b8}
.bt-cmds{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.bt-cmd{background:#f59e0b;color:#fff;border:0;border-bottom:4px solid #b45309;border-radius:12px;
  padding:.6rem .4rem;font:700 .92rem/1.3 inherit;cursor:pointer;text-shadow:1px 1px 2px rgba(0,0,0,.35)}
.bt-cmd:active:not(:disabled){transform:translateY(2px);border-bottom-width:2px}
.bt-cmd:disabled{background:#64748b;border-bottom-color:#475569;opacity:.6;cursor:default}
.bt-cmd.magic{background:#6366f1;border-bottom-color:#3730a3}
.bt-cmd.guard{background:#0ea5e9;border-bottom-color:#075985}
.bt-cmd.item{background:#16a34a;border-bottom-color:#15803d}
.bt-cmd.back{background:#64748b;border-bottom-color:#334155;grid-column:1 / -1}
.bt-cmd .sub{display:block;font-size:.66rem;font-weight:400;opacity:.9;margin-top:2px}
.bt-lead{font-size:.8rem;color:#cbd5e1;margin:0 0 8px}
.bt-lead b{color:#fde047}
.bt-how{font-size:.74rem;color:#cbd5e1;line-height:1.7;margin:0 0 10px;padding-left:1.1em}
.bt-how li{margin-bottom:2px}
.bt-big{font-size:1.5rem;font-weight:800;color:#fca5a5;margin:0 0 6px;text-align:center}
.bt-score{text-align:center;margin:0 0 10px}
.bt-score .n{font-size:2.2rem;font-weight:800;color:#fde047;display:block;line-height:1.2}
.bt-score .k{font-size:.74rem;color:#94a3b8}
.bt-hidden{display:none}
`;

export const mountBattle: GameMount = (host, ctx) => {
  const style = document.createElement('style');
  style.textContent = CSS;

  const page = document.createElement('div');
  page.className = 'bt';
  page.innerHTML = `
<div class="bt-app">
  <div class="bt-panel bt-head">
    <span class="bt-floor" data-floor>1かいそう</span>
    <span class="bt-kill" data-kill>たおした: 0</span>
    <button class="bt-btn-s" data-sound>🔊</button>
  </div>

  <div class="bt-panel bt-stage">
    <div class="bt-pop" data-pop></div>
    <span class="bt-face" data-face>🟢</span>
    <div class="bt-ename" data-ename>スライム</div>
    <div class="bt-bar"><i data-ehp style="width:100%"></i></div>
  </div>

  <div class="bt-panel">
    <div class="bt-me">
      <span class="face" data-myface>🧒</span>
      <div class="bt-gauges">
        <div class="bt-gauge"><span class="k hp">HP</span>
          <span class="t"><i class="hp" data-myhp style="width:100%"></i></span>
          <span class="n" data-myhpn>40/40</span></div>
      </div>
    </div>
    <div class="bt-stat">
      <span>レベル <b data-lv>1</b></span>
      <span>こうげき <b data-atk>10</b></span>
      <span>ぼうぎょ <b data-def>4</b></span>
      <span>つぎまで <b data-next>8</b></span>
    </div>
  </div>

  <div class="bt-panel bt-log" data-log></div>

  <div data-area="start">
    <div class="bt-panel">
      <p class="bt-lead"><b>コマンドバトル</b><br>でてくる モンスターを 1体ずつ たおして、うえの かいそうへ すすもう。</p>
      <ul class="bt-how">
        <li><b>たたかう</b>… けんで きる。あいての ぼうぎょが たかいと とおりにくい</li>
        <li><b>まほう</b>… いつでも つかえる。かたい あいてには こちらが はやい</li>
        <li><b>ぼうぎょ</b>… つぎに うける ダメージが はんぶんに なる</li>
        <li><b>やくそう</b>… HP を 30 なおす。5かいそう ごとに 1つ もらえる</li>
        <li>レベルが あがると HP が ぜんぶ もどる。4で <b>いかずち</b>を おぼえる</li>
      </ul>
      <div class="bt-cmds"><button class="bt-cmd back" style="background:#dc2626;border-bottom-color:#991b1b" data-begin>はじめる</button></div>
    </div>
  </div>

  <div class="bt-hidden" data-area="cmds">
    <div class="bt-cmds">
      <button class="bt-cmd" data-do="fight">たたかう</button>
      <button class="bt-cmd magic" data-do="magic">まほう</button>
      <button class="bt-cmd guard" data-do="guard">ぼうぎょ<span class="sub">ダメージ はんぶん</span></button>
      <button class="bt-cmd item" data-do="herb">やくそう<span class="sub" data-herbn>のこり 2</span></button>
    </div>
  </div>

  <div class="bt-hidden" data-area="spells">
    <div class="bt-cmds" data-spelllist></div>
  </div>

  <div class="bt-hidden" data-area="over">
    <div class="bt-panel">
      <p class="bt-big">ちからが つきた…</p>
      <p class="bt-score"><span class="n" data-overkill>0</span><span class="k">たおした かず</span></p>
      <p class="bt-lead" style="text-align:center" data-overfloor></p>
      <div class="bt-cmds"><button class="bt-cmd back" style="background:#dc2626;border-bottom-color:#991b1b" data-again>もういちど</button></div>
    </div>
  </div>
</div>`;
  host.append(style, page);

  const q = <T extends HTMLElement>(sel: string): T => page.querySelector(sel) as T;

  // ── 音。はじめて さわった ときに つくり、後片付けで 閉じる。
  const AudioCtor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  let audio: AudioContext | null = null;
  let soundOn = true;

  const initAudio = (): void => {
    if (!audio && AudioCtor) audio = new AudioCtor();
  };

  type Sound = 'hit' | 'magic' | 'heal' | 'guard' | 'miss' | 'levelup' | 'down';

  const beep = (at: number, freq: number, to: number, kind: OscillatorType, vol: number, len: number): void => {
    if (!audio) return;
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = kind;
    o.frequency.setValueAtTime(freq, at);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + len);
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.01, at + len);
    o.connect(g);
    g.connect(audio.destination);
    o.start(at);
    o.stop(at + len + 0.02);
  };

  const play = (kind: Sound): void => {
    if (!soundOn) return;
    initAudio();
    if (!audio) return;
    if (audio.state === 'suspended') void audio.resume();
    const now = audio.currentTime;
    if (kind === 'hit') beep(now, 220, 60, 'square', 0.25, 0.12);
    else if (kind === 'magic') beep(now, 660, 180, 'triangle', 0.22, 0.3);
    else if (kind === 'heal') { beep(now, 520, 780, 'sine', 0.2, 0.25); beep(now + 0.12, 780, 1040, 'sine', 0.15, 0.2); }
    else if (kind === 'guard') beep(now, 160, 120, 'sine', 0.2, 0.18);
    else if (kind === 'miss') beep(now, 300, 500, 'sine', 0.12, 0.1);
    else if (kind === 'levelup') {
      for (const [i, f] of [392, 523.25, 659.25, 783.99].entries()) beep(now + i * 0.09, f, f, 'triangle', 0.18, 0.18);
    } else {
      beep(now, 300, 40, 'sawtooth', 0.3, 0.9);
    }
  };

  // ── 待ち。後片付けの あとに 手番が すすまないよう、ひかえて おいて まとめて 止める。
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let disposed = false;
  const after = (ms: number, fn: () => void): void => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!disposed) fn();
    }, ms);
    timers.add(id);
  };

  // ── 状態
  /**
   * はじまりの 数。
   *
   * ここ1か所から 画面の はじめの 表示も、「もういちど」の 戻しも 取る。
   * 2か所に 書くと、片方だけ 直したときに、出ている 数と 遊んでいる 数が ずれる。
   */
  const START = { maxHp: 40, atk: 10, def: 4, nextExp: 8, herbs: 2 } as const;

  let lv = 1;
  let maxHp: number = START.maxHp;
  let hp: number = START.maxHp;
  let atk: number = START.atk;
  let def: number = START.def;
  let exp = 0;
  let nextExp: number = START.nextExp;
  let herbs: number = START.herbs;
  let floor = 1;
  let killed = 0;
  /** この 手番、ぼうぎょを えらんだか。あいての こうげきを 半分に する。 */
  let guarding = false;
  let enemy = enemyOf(1);
  let phase: Phase = 'start';
  let startedAt = 0;
  const lines: string[] = [];

  const area = (name: 'start' | 'cmds' | 'spells' | 'over'): void => {
    for (const key of ['start', 'cmds', 'spells', 'over'] as const) {
      q(`[data-area="${key}"]`).classList.toggle('bt-hidden', key !== name);
    }
  };

  /** 文を 下に つみ、ふるい ものから 消す。3行 ぶんだけ 見せる。 */
  const say = (text: string): void => {
    lines.push(text);
    while (lines.length > 3) lines.shift();
    const log = q('[data-log]');
    log.replaceChildren();
    for (const [i, line] of lines.entries()) {
      const p = document.createElement('p');
      p.textContent = line;
      if (i < lines.length - 1) p.className = 'dim';
      log.append(p);
    }
  };

  const TRAIT_NOTE: Record<Trait, string> = {
    dodge: 'すばやい',
    magic: 'まほうつかい',
    hard: 'かたい',
    boss: 'ボス',
  };

  const draw = (): void => {
    q('[data-floor]').textContent = `${floor}かいそう`;
    q('[data-kill]').textContent = `たおした: ${killed}`;
    q('[data-face]').textContent = enemy.face;
    const ename = q('[data-ename]');
    ename.replaceChildren();
    ename.append(document.createTextNode(enemy.name));
    if (enemy.trait) {
      const tag = document.createElement('span');
      tag.className = 'trait';
      tag.textContent = `（${TRAIT_NOTE[enemy.trait]}）`;
      ename.append(tag);
    }
    q('[data-ehp]').style.width = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;
    q('[data-myhp]').style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
    q('[data-myhpn]').textContent = `${hp}/${maxHp}`;
    q('[data-lv]').textContent = String(lv);
    q('[data-atk]').textContent = String(atk);
    q('[data-def]').textContent = String(def);
    q('[data-next]').textContent = String(Math.max(0, nextExp - exp));
    q('[data-herbn]').textContent = `のこり ${herbs}`;
    (q('[data-do="herb"]') as HTMLButtonElement).disabled = herbs <= 0 || phase !== 'input';
    (q('[data-do="magic"]') as HTMLButtonElement).disabled = phase !== 'input';
    (q('[data-do="fight"]') as HTMLButtonElement).disabled = phase !== 'input';
    (q('[data-do="guard"]') as HTMLButtonElement).disabled = phase !== 'input';
  };

  /** 当たった ところに 数を 出す。 */
  const pop = (text: string): void => {
    const node = q('[data-pop]');
    node.textContent = text;
    node.classList.remove('go');
    // クラスを 付け直す だけでは アニメーションが 流れない。1度 読み出して 区切る。
    void node.offsetWidth;
    node.classList.add('go');
  };

  const shake = (sel: string): void => {
    const node = q(sel);
    node.classList.remove('hurt');
    void node.offsetWidth;
    node.classList.add('hurt');
  };

  /** ふれ幅。同じ えらびかたでも 同じ 数には ならない。 */
  const vary = (base: number): number => Math.round(base * (0.85 + Math.random() * 0.3));

  const hurtEnemy = (amount: number): void => {
    enemy.hp = Math.max(0, enemy.hp - amount);
    pop(String(amount));
    shake('[data-face]');
    draw();
  };

  // ── こちらの 手番
  const doFight = (): void => {
    if (enemy.trait === 'dodge' && Math.random() < 0.25) {
      play('miss');
      say('こうげきは かわされた！');
      after(700, enemyTurn);
      return;
    }
    const raw = vary(atk + 6) - enemy.def;
    const dmg = Math.max(1, raw);
    play('hit');
    hurtEnemy(dmg);
    say(`けんで きった！ ${enemy.name}に ${dmg}の ダメージ。`);
    after(700, afterMyTurn);
  };

  const doSpell = (spell: Spell): void => {
    if (spell.id === 'heal') {
      const back = Math.round(maxHp * 0.4);
      const before = hp;
      hp = Math.min(maxHp, hp + back);
      play('heal');
      // まんたんで つかった ときに「0 もどった」と 出すと、こわれて いるように 見える。
      say(hp === before ? 'ヒール！ でも HP は もう まんたんだった。' : `ヒール！ HP が ${hp - before} もどった。`);
      draw();
      after(700, enemyTurn);
      return;
    }
    // こうげきの まほうは ぼうぎょを 半分（ファイア）か ぜんぶ（いかずち）むしする。
    const power = spell.id === 'bolt' ? atk * 2.2 + 12 : atk * 1.5 + 8;
    const through = spell.id === 'bolt' ? 0 : Math.floor(enemy.def / 2);
    const dmg = Math.max(1, vary(power) - through);
    play('magic');
    hurtEnemy(dmg);
    say(`${spell.name}！ ${enemy.name}に ${dmg}の ダメージ。`);
    after(700, afterMyTurn);
  };

  const doGuard = (): void => {
    guarding = true;
    play('guard');
    say('みを かまえた。つぎの ダメージは はんぶん。');
    draw();
    after(600, enemyTurn);
  };

  const doHerb = (): void => {
    herbs--;
    const before = hp;
    hp = Math.min(maxHp, hp + 30);
    play('heal');
    say(`やくそうを つかった。HP が ${hp - before} もどった。`);
    draw();
    after(700, enemyTurn);
  };

  /** こちらの 手番の あと。たおして いれば つぎの かいそう、まだ なら あいての 手番。 */
  const afterMyTurn = (): void => {
    if (enemy.hp > 0) {
      enemyTurn();
      return;
    }
    const face = q('[data-face]');
    face.classList.add('gone');
    killed++;
    say(`${enemy.name}を たおした！`);
    draw();
    after(600, () => {
      face.classList.remove('gone');
      gainExp(enemy.exp);
      after(500, nextFloor);
    });
  };

  const gainExp = (amount: number): void => {
    exp += amount;
    if (exp < nextExp) {
      draw();
      return;
    }
    exp -= nextExp;
    lv++;
    // つぎまでの のびを ゆるく してある。きつく すると、5かいそうの ボスに
    // レベル3で ぶつかる——そこで ほぼ 必ず 止まるので、点が「4たい」で そろって
    // しまい、うまい・へたの ちがいが 出なくなる。
    nextExp = Math.round(nextExp * 1.35);
    maxHp += 8;
    atk += 3;
    def += 1;
    // レベルが 上がったら 全部 なおす。えらびかたを まちがえた 回を、つぎの かいそうまで
    // ひきずらない——ひきずると、ここで もう 勝てないと 決まってしまう 回ができる。
    hp = maxHp;
    play('levelup');
    say(`レベルが ${lv}に あがった！ HP が ぜんぶ もどった。`);
    const unlocked = SPELLS.find((s) => s.lv === lv);
    if (unlocked) say(`${unlocked.name}を おぼえた！`);
    draw();
  };

  const nextFloor = (): void => {
    floor++;
    enemy = enemyOf(floor);
    if (floor % 5 === 0) {
      herbs++;
      say(`${floor}かいそう。やくそうを 1つ みつけた。`);
    }
    const face = q('[data-face]');
    face.classList.remove('comes');
    void face.offsetWidth;
    face.classList.add('comes');
    say(`${enemy.name}が あらわれた！`);
    phase = 'input';
    area('cmds');
    draw();
  };

  // ── あいての 手番
  const enemyTurn = (): void => {
    if (enemy.hp <= 0) {
      afterMyTurn();
      return;
    }
    phase = 'busy';
    draw();
    const hits = enemy.trait === 'boss' ? 2 : 1;
    runEnemyHit(0, hits);
  };

  const runEnemyHit = (index: number, hits: number): void => {
    if (index >= hits) {
      guarding = false;
      phase = 'input';
      area('cmds');
      draw();
      return;
    }
    // まほうつかいは ときどき まほうを うつ。ぼうぎょでは 半分に ならない。
    const casts = enemy.trait === 'magic' && Math.random() < 0.4;
    // 2回 うごく あいては、1発を 弱く する。そのままの 強さで 2回 入れると、
    // こちらの 手番が 1回 来るたびに HP の 半分が 飛ぶ——なおす ひまが 無くなる。
    const share = hits > 1 ? 0.6 : 1;
    const base = (casts ? enemy.atk * 1.4 : enemy.atk) * share;
    const guard = casts ? 0 : def;
    let dmg = Math.max(1, vary(base) - Math.floor(guard * 0.8));
    if (guarding && !casts) dmg = Math.max(1, Math.floor(dmg / 2));
    hp = Math.max(0, hp - dmg);
    play(casts ? 'magic' : 'hit');
    shake('[data-myface]');
    say(casts
      ? `${enemy.name}の まほう！ ${dmg}の ダメージ。`
      : `${enemy.name}の こうげき！ ${dmg}の ダメージ。`);
    draw();

    if (hp <= 0) {
      after(700, gameOver);
      return;
    }
    after(hits > 1 ? 650 : 700, () => runEnemyHit(index + 1, hits));
  };

  function gameOver(): void {
    phase = 'over';
    play('down');
    say('ちからが つきて たおれてしまった…');
    q('[data-myface]').textContent = '💤';
    q('[data-overkill]').textContent = String(killed);
    q('[data-overfloor]').textContent = `${floor}かいそう まで すすんだ（レベル ${lv}）`;
    ctx.onFinish(killed, startedAt || Date.now());
    area('over');
    draw();
  }

  /** まほうの 一覧。おぼえた ものだけ 出す。 */
  const openSpells = (): void => {
    phase = 'spell';
    const list = q('[data-spelllist]');
    list.replaceChildren();
    for (const spell of SPELLS) {
      if (lv < spell.lv) continue;
      const btn = document.createElement('button');
      btn.className = 'bt-cmd magic';
      const name = document.createElement('span');
      name.textContent = spell.name;
      const sub = document.createElement('span');
      sub.className = 'sub';
      sub.textContent = spell.note;
      btn.append(name, sub);
      btn.addEventListener('click', () => {
        if (phase !== 'spell') return;
        phase = 'busy';
        area('cmds');
        draw();
        doSpell(spell);
      });
      list.append(btn);
    }
    const back = document.createElement('button');
    back.className = 'bt-cmd back';
    back.textContent = 'やめる';
    back.addEventListener('click', () => {
      if (phase !== 'spell') return;
      phase = 'input';
      area('cmds');
      draw();
    });
    list.append(back);
    area('spells');
    draw();
  };

  const begin = (): void => {
    initAudio();
    lv = 1;
    maxHp = START.maxHp; hp = START.maxHp;
    atk = START.atk; def = START.def;
    exp = 0; nextExp = START.nextExp; herbs = START.herbs;
    floor = 1; killed = 0;
    guarding = false;
    enemy = enemyOf(1);
    lines.length = 0;
    q('[data-myface]').textContent = '🧒';
    startedAt = Date.now();
    phase = 'input';
    say(`${enemy.name}が あらわれた！`);
    area('cmds');
    draw();
  };

  q('[data-begin]').addEventListener('click', begin);
  q('[data-again]').addEventListener('click', begin);
  q('[data-sound]').addEventListener('click', () => {
    soundOn = !soundOn;
    q('[data-sound]').textContent = soundOn ? '🔊' : '🔇';
  });

  for (const [key, run] of [['fight', doFight], ['guard', doGuard], ['herb', doHerb]] as const) {
    q(`[data-do="${key}"]`).addEventListener('click', () => {
      if (phase !== 'input') return;
      if (key === 'herb' && herbs <= 0) return;
      phase = 'busy';
      draw();
      run();
    });
  }
  q('[data-do="magic"]').addEventListener('click', () => {
    if (phase !== 'input') return;
    openSpells();
  });

  area('start');
  draw();

  return () => {
    disposed = true;
    phase = 'over';
    for (const id of timers) clearTimeout(id);
    timers.clear();
    void audio?.close().catch(() => undefined);
    host.replaceChildren();
  };
};
