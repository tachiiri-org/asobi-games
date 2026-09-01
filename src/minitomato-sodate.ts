// ミニトマトを そだてよう。たね1つを、みず・たいよう・えいよう・むしとり だけで
// まっかな みまで そだてる。おみせも おかねも 出てこない。
//
// tennis-game リポジトリの minitomato-simple.html を移した。遊びの中身（成長の式・
// 糖度・虫の出方・肥料の効き方・1秒ごとの進み方）は変えていない。変えたのは6つ。
//  - 保存先を localStorage から置き場（ctx.save）に移した。1秒ごとに put を呼ぶが、
//    実際に出るのは束ねたあとなので、毎秒 HTTP が飛ぶわけではない。
//  - class と id を ms- と data-* に付け替えた。あそびば側の画面と名前がぶつからない。
//  - 画面いっぱいに出ていた窓（modal・せつめいしょ）を、置き場所の中の absolute に
//    変えた。あそびばの帯を覆わない。
//  - Google Fonts の読み込みをやめた（外から CSS を読まない決まり）。字は指定だけ残す。
//  - 収穫のたびに onFinish を呼ぶ。点は「とれた数 × あまさ」。おせわが丁寧なほど
//    数も甘さも上がるので、両方が効く。
//  - タイマーを全部ひかえて、後片付けで止める。
//
// せつめいしょ（8章）も中に入れてある。別ページを開くと、埋め込みで動くときに
// 開けないため。

import type { GameMount } from './types';

type Place = 'sun' | 'shade';

type State = {
  day: number;
  tick: number;
  growth: number;
  water: number;
  sun: number;
  nut: number;
  health: number;
  place: Place;
  bug: boolean;
  bugAge: number;
  /** おせわが ちょうどよかった びょうすう。あまさの もとになる。 */
  goodTicks: number;
  careTicks: number;
  ready: boolean;
  /** つぎに ひりょうを あげられる ときこく。 */
  fertReady: number;
  totalHarvest: number;
  bestBrix: number;
  round: number;
};

const fresh = (): State => ({
  day: 1, tick: 0,
  growth: 0, water: 60, sun: 50, nut: 55, health: 100,
  place: 'sun',
  bug: false, bugAge: 0,
  goodTicks: 0, careTicks: 0,
  ready: false, fertReady: 0,
  totalHarvest: 0, bestBrix: 0, round: 0,
});

/** 1びょう = 1ティック。30ティックで 1にち すすむ。 */
const TICK_MS = 1000;
const DAY_TICKS = 30;
/** ひりょうは つづけては あげられない。 */
const FERT_WAIT = 15000;

const STAGES: readonly { readonly max: number; readonly name: string }[] = [
  { max: 8, name: 'たね' },
  { max: 22, name: 'め' },
  { max: 40, name: 'ふたば' },
  { max: 58, name: 'わかば' },
  { max: 70, name: 'つぼみ' },
  { max: 80, name: 'はな' },
  { max: 92, name: 'みどりのみ' },
  { max: 100, name: 'あかい み' },
  { max: 999, name: 'しゅうかく できる！' },
];

/** せつめいしょの「そだつ じゅんばん」に ならべる え。 */
const MANUAL_FIGS: readonly { readonly g: number; readonly name: string; readonly pct: string }[] = [
  { g: 3, name: 'たね', pct: '0〜8%' },
  { g: 15, name: 'め', pct: '8〜22%' },
  { g: 32, name: 'ふたば', pct: '22〜40%' },
  { g: 50, name: 'わかば', pct: '40〜58%' },
  { g: 64, name: 'つぼみ', pct: '58〜70%' },
  { g: 76, name: 'はな', pct: '70〜80%' },
  { g: 86, name: 'みどりのみ', pct: '80〜92%' },
  { g: 97, name: 'あかい み', pct: '92〜100%' },
  { g: 100, name: 'しゅうかく', pct: '100%' },
];

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

function lerpColor(a: string, b: string, t: number): string {
  const k = clamp(t, 0, 1);
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  return '#' + pa.map((v, i) => Math.round(v + ((pb[i] ?? 0) - v) * k).toString(16).padStart(2, '0')).join('');
}

function stageName(growth: number): string {
  for (const s of STAGES) if (growth < s.max) return s.name;
  return STAGES[STAGES.length - 1]!.name;
}

/** はちの え。そだちぐあい・げんき・ばしょ で かたちが かわる。 */
function plantSVG(g: number, health: number, place: Place, ready: boolean): string {
    const weak  = health < 35;
    const sunny = place === 'sun';
    const leafA = weak ? "#9aa05e" : "#4d7c0f";
    const leafB = weak ? "#b6bb7a" : "#84cc16";
    const stemC = weak ? "#8a8f55" : "#4d7c0f";

    const stemH = g < 6 ? 0 : (g - 6) * 2.4;      // 0 〜 226
    const topY  = 300 - stemH;

    let s = "";

    /* そら */
    s += '<defs>'
      +  '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">'
      +  '<stop offset="0" stop-color="' + (sunny ? "#7dd3fc" : "#c7d2da") + '"/>'
      +  '<stop offset="1" stop-color="' + (sunny ? "#e6f6ff" : "#e6eaee") + '"/>'
      +  '</linearGradient></defs>';
    s += '<rect x="0" y="0" width="300" height="380" fill="url(#sky)"/>';

    if (sunny) {
        s += '<circle cx="248" cy="52" r="34" fill="#fde68a" opacity=".55"/>'
          +  '<circle cx="248" cy="52" r="23" fill="#fbbf24"/>';
    } else {
        s += '<g fill="#f1f5f9" opacity=".95">'
          +  '<circle cx="228" cy="56" r="22"/><circle cx="252" cy="50" r="26"/>'
          +  '<circle cx="272" cy="60" r="18"/><rect x="226" y="56" width="60" height="18" rx="9"/></g>';
    }

    /* とおくの じめん */
    s += '<rect x="0" y="330" width="300" height="50" fill="' + (sunny ? "#bbf7d0" : "#cfe0d4") + '"/>';

    /* はち */
    s += '<path d="M80,300 L220,300 L205,366 Q202,372 196,372 L104,372 Q98,372 95,366 Z" fill="#e07a45"/>';
    s += '<path d="M80,300 L220,300 L214,326 L86,326 Z" fill="#c96436" opacity=".35"/>';
    s += '<rect x="74" y="286" width="152" height="22" rx="11" fill="#f08a4b"/>';
    s += '<rect x="74" y="286" width="152" height="8" rx="4" fill="#ffa76a" opacity=".7"/>';

    /* つちの めん（はちの ふちより てまえ） */
    s += '<ellipse cx="150" cy="292" rx="62" ry="9.5" fill="#4b2e17"/>';
    s += '<ellipse cx="150" cy="291" rx="58" ry="7.5" fill="#66432a"/>';

    /* つちの もりあがり（たねの ころ） */
    if (g < 6) {
        s += '<ellipse cx="150" cy="289" rx="15" ry="5" fill="#7d5533"/>';
        s += '<circle cx="144" cy="288" r="1.8" fill="#96683f"/><circle cx="156" cy="290" r="1.8" fill="#96683f"/>';
    }

    s += '<g class="sway">';

    /* くき */
    if (stemH > 0) {
        s += '<path d="M150,301 Q142,' + (300 - stemH * 0.5).toFixed(1) + ' 150,' + topY.toFixed(1) + '" '
          +  'stroke="' + stemC + '" stroke-width="' + (3 + Math.min(4, stemH / 60)).toFixed(1) + '" fill="none" stroke-linecap="round"/>';
    }

    /* ふたば */
    if (g >= 6 && g < 30) {
        const t = clamp((g - 6) / 10, 0.25, 1);
        const rx = 12 * t, ry = 8 * t;
        const fade = clamp((30 - g) / 6, 0, 1).toFixed(2);
        s += '<g opacity="' + fade + '">';
        s += '<ellipse cx="' + (150 - 11 * t) + '" cy="' + (topY - 2) + '" rx="' + rx + '" ry="' + ry + '" fill="' + leafB + '" transform="rotate(-18 ' + (150 - 11 * t) + ' ' + (topY - 2) + ')"/>';
        s += '<ellipse cx="' + (150 + 11 * t) + '" cy="' + (topY - 2) + '" rx="' + rx + '" ry="' + ry + '" fill="' + leafB + '" transform="rotate(18 '  + (150 + 11 * t) + ' ' + (topY - 2) + ')"/>';
        s += '</g>';
    }

    /* ほんば（さゆうに はえる） */
    const leafSpots = [0.34, 0.55, 0.74, 0.9];
    leafSpots.forEach((f, i) => {
        const need = 50 + i * 45;
        if (stemH < need) return;
        const grow = clamp((stemH - need) / 40, 0.35, 1);
        const y = 300 - stemH * f;
        const w = 30 * grow, h = 12 * grow;
        const dir = i % 2 === 0 ? 1 : -1;
        [1, -1].forEach((sd) => {
            const cx = 150 + sd * (w * 0.75);
            const rot = sd * (16 + dir * 4);
            s += '<ellipse cx="' + cx.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="' + w.toFixed(1) + '" ry="' + h.toFixed(1) + '" '
              +  'fill="' + (sd > 0 ? leafA : leafB) + '" transform="rotate(' + rot + ' ' + cx.toFixed(1) + ' ' + y.toFixed(1) + ')"/>';
            s += '<line x1="150" y1="' + y.toFixed(1) + '" x2="' + cx.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + stemC + '" stroke-width="1.6"/>';
        });
    });

    /* つぼみ */
    if (g >= 56 && g < 72) {
        const a = clamp(Math.min((g - 56) / 5, (72 - g) / 5), 0, 1);
        const fy = 300 - stemH * 0.6;
        [-30, 0, 30].forEach((dx, i) => {
            const cx = 150 + dx, cy = fy + (i === 1 ? -10 : 6);
            s += '<g opacity="' + a.toFixed(2) + '">'
              +  '<line x1="150" y1="' + (fy - 4).toFixed(1) + '" x2="' + cx + '" y2="' + cy + '" stroke="' + stemC + '" stroke-width="1.5"/>'
              +  '<ellipse cx="' + cx + '" cy="' + cy + '" rx="4.2" ry="6.2" fill="#d9e58a"/>'
              +  '<ellipse cx="' + (cx - 1.2) + '" cy="' + (cy - 1) + '" rx="1.6" ry="3.2" fill="#f0f6c0"/>'
              +  '</g>';
        });
    }

    /* はな */
    if (g >= 68 && g < 86) {
        const a = clamp(Math.min((g - 68) / 5, (86 - g) / 6), 0, 1);
        const fy = 300 - stemH * 0.6;
        [-30, 0, 30].forEach((dx, i) => {
            const cx = 150 + dx, cy = fy + (i === 1 ? -10 : 6);
            s += '<g opacity="' + a.toFixed(2) + '">';
            for (let k = 0; k < 5; k++) {
                const ang = (k * 72) * Math.PI / 180;
                s += '<ellipse cx="' + (cx + Math.cos(ang) * 6).toFixed(1) + '" cy="' + (cy + Math.sin(ang) * 6).toFixed(1) + '" rx="5" ry="3.4" fill="#fef9c3" transform="rotate(' + (k * 72) + ' ' + (cx + Math.cos(ang) * 6).toFixed(1) + ' ' + (cy + Math.sin(ang) * 6).toFixed(1) + ')"/>';
            }
            s += '<circle cx="' + cx + '" cy="' + cy + '" r="3.4" fill="#facc15"/></g>';
        });
    }

    /* み */
    if (g >= 70) {
        const t = clamp((g - 72) / 26, 0, 1);
        const col = lerpColor("#a3e635", "#dc2626", t);
        const r   = 4 + t * 9;
        const fy  = 300 - stemH * 0.58;
        const spots = [[-34, 12], [-12, 32], [14, 26], [36, 6]];
        spots.forEach((p, i) => {
            if (g < 70 + i * 4) return;
            const cx = 150 + p[0], cy = fy + p[1];
            s += '<line x1="150" y1="' + (fy - 6).toFixed(1) + '" x2="' + cx + '" y2="' + (cy - r) + '" stroke="' + stemC + '" stroke-width="1.8"/>';
            s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r.toFixed(1) + '" fill="' + col + '" stroke="rgba(0,0,0,.13)" stroke-width="1"/>';
            s += '<ellipse cx="' + (cx - r * 0.32).toFixed(1) + '" cy="' + (cy - r * 0.38).toFixed(1) + '" rx="' + (r * 0.28).toFixed(1) + '" ry="' + (r * 0.2).toFixed(1) + '" fill="#fff" opacity=".55"/>';
            // へた
            s += '<path d="M' + (cx - r * 0.7) + ',' + (cy - r * 0.75) + ' L' + cx + ',' + (cy - r * 0.3) + ' L' + (cx + r * 0.7) + ',' + (cy - r * 0.75) + ' L' + cx + ',' + (cy - r * 1.05) + ' Z" fill="#3f6212"/>';
        });
    }

    s += '</g>';

    /* しゅうかく サイン */
    if (ready) {
        s += '<text x="150" y="40" text-anchor="middle" font-size="22" font-weight="900" fill="#dc2626">まっかっか！</text>';
        s += '<text x="150" y="62" text-anchor="middle" font-size="18">✨🍅✨</text>';
    }
    return s;
}

const CSS = `
.ms-root {
    --ground: #f3faf0;
    --card: #ffffff;
    --ink: #22301f;
    --muted: #6f7f6d;
    --line: #e2ebdf;
    --tomato: #e0483c;
    --sun: #efa52f;
    --sun-d: #b3760f;
    --water: #37a8dc;
    --water-d: #1b7ba9;
    --leaf: #4c9a3e;
    --zone: #cbeec4;
    --track: #e7ece4;
    --shadow: 0 6px 18px rgba(34,48,31,.09);
}
.ms-root * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
.ms-root .ms-hidden { display: none !important; }
.ms-root {
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font-family: 'Zen Maru Gothic', 'Hiragino Maru Gothic ProN', 'Yu Gothic', sans-serif;
    -webkit-user-select: none; user-select: none;
    overscroll-behavior: none;
}
.ms-root button { font-family: inherit; }
.ms-root button:focus-visible { outline: 3px solid #7cc0e8; outline-offset: 2px; }
.ms-root [data-app] { max-width: 480px; margin: 0 auto; min-height: 100%; background: var(--ground); }
.ms-root /* ヘッダー */
.ms-topbar {
    display: flex; align-items: center; justify-content: space-between; gap: .5rem;
    padding: .75rem 1rem;
    background: linear-gradient(100deg, #d8413a, #f2755e);
    color: #fff;
    box-shadow: 0 3px 10px rgba(176,54,42,.28);
}
.ms-root .ms-brand { margin: 0; font-size: 1.02rem; font-weight: 900; letter-spacing: .01em; display: flex; align-items: center; gap: .35rem; }
.ms-root .ms-ghost-btn {
    border: 0; border-radius: 999px; cursor: pointer;
    background: rgba(255,255,255,.24); color: #fff;
    padding: .38rem .8rem; font-size: .72rem; font-weight: 900;
}
.ms-root .ms-wrap { display: flex; flex-direction: column; gap: .75rem; padding: .8rem 1rem 1.75rem; }
.ms-root .ms-status-row { display: flex; align-items: center; justify-content: space-between; font-size: .8rem; font-weight: 700; color: var(--muted); }
.ms-root .ms-place-chip { padding: .25rem .75rem; border-radius: 999px; font-weight: 900; }
.ms-root .ms-place-chip.ms-sunny { background: #fdf0d5; color: #a9711a; }
.ms-root .ms-place-chip.ms-shady { background: #e5eae7; color: #5f6d63; }
.ms-root /* はちの え */
.ms-plant-box {
    position: relative; aspect-ratio: 300 / 380;
    background: var(--card); border-radius: 22px; overflow: hidden; box-shadow: var(--shadow);
}
.ms-root [data-plant-svg] { display: block; width: 100%; height: 100%; }
.ms-root /* たねを うえた あとに でる せつめいしょ ボタン */
.ms-seed-doc {
    display: flex; align-items: center; gap: .7rem; width: 100%;
    text-align: left; font-family: inherit; cursor: pointer;
    padding: .7rem .85rem; border-radius: 18px;
    background: linear-gradient(180deg, #f7fdf3, #e8f6e0);
    border: 2px solid #cfe8c4;
    box-shadow: var(--shadow);
    color: var(--ink); text-decoration: none;
    animation: pop .4s cubic-bezier(.2,1.6,.4,1) both;
}
.ms-root .ms-seed-doc:focus-visible { outline: 3px solid #7cc0e8; outline-offset: 2px; }
.ms-root .ms-seed-doc-icon { font-size: 1.5rem; line-height: 1; }
.ms-root .ms-seed-doc-body { display: flex; flex-direction: column; gap: .1rem; flex: 1; }
.ms-root .ms-seed-doc-body b { font-size: .85rem; font-weight: 900; }
.ms-root .ms-seed-doc-sub { font-size: .68rem; font-weight: 700; color: var(--muted); }
.ms-root .ms-seed-doc-arrow { font-size: 1.4rem; font-weight: 900; color: var(--leaf); line-height: 1; }
.ms-root .ms-card { background: var(--card); border-radius: 18px; box-shadow: var(--shadow); padding: .8rem .9rem; }
.ms-root /* せいちょう */
.ms-growth-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: .5rem; }
.ms-root .ms-stage { font-size: .98rem; font-weight: 900; color: var(--leaf); }
.ms-root .ms-pct { font-size: .82rem; font-weight: 700; color: var(--muted); font-variant-numeric: tabular-nums; }
.ms-root .ms-msg { margin: .6rem 0 0; font-size: .84rem; font-weight: 700; color: #4a5a49; line-height: 1.5; min-height: 2.5em; }
.ms-root /* メーター */
.ms-bar { height: 10px; border-radius: 999px; background: var(--track); overflow: hidden; }
.ms-root .ms-bar > i { display: block; height: 100%; border-radius: 999px; transition: width .4s ease; }
.ms-root .ms-fill-growth { background: linear-gradient(90deg, #8fce5a, #e0483c); }
.ms-root .ms-fill-water { background: var(--water); }
.ms-root .ms-fill-sun { background: var(--sun); }
.ms-root .ms-fill-nut { background: #a06f38; }
.ms-root .ms-fill-health { background: #46c08a; }
.ms-root .ms-zone-water { background: linear-gradient(90deg, var(--track) 0 29%, var(--zone) 29% 73%, var(--track) 73%); }
.ms-root .ms-zone-sun { background: linear-gradient(90deg, var(--track) 0 40%, var(--zone) 40% 88%, var(--track) 88%); }
.ms-root .ms-zone-nut { background: linear-gradient(90deg, var(--track) 0 23%, var(--zone) 23% 73%, var(--track) 73%); }
.ms-root .ms-meters { display: grid; grid-template-columns: repeat(4, 1fr); gap: .4rem; }
.ms-root .ms-meter { padding: .55rem .4rem .45rem; text-align: center; }
.ms-root .ms-meter-name { font-size: .7rem; font-weight: 900; margin-bottom: .4rem; white-space: nowrap; }
.ms-root .ms-meter-name.ms-water { color: var(--water-d); }
.ms-root .ms-meter-name.ms-sun { color: var(--sun-d); }
.ms-root .ms-meter-name.ms-nut { color: #7a4f27; }
.ms-root .ms-meter-name.ms-health { color: #2f8f66; }
.ms-root .ms-meter-state { margin-top: .4rem; font-size: .68rem; font-weight: 700; color: var(--muted); }
.ms-root /* そうさボタン */
.ms-actions { display: grid; grid-template-columns: repeat(4, 1fr); gap: .4rem; }
.ms-root .ms-btn {
    border: 0; border-radius: 16px; cursor: pointer;
    padding: .65rem .15rem; color: #fff;
    font-size: 1.25rem; line-height: 1.15; font-weight: 900;
    border-bottom: 5px solid rgba(0,0,0,.22);
    box-shadow: 0 4px 12px rgba(34,48,31,.13);
    transition: transform .08s ease, opacity .15s ease;
}
.ms-root .ms-btn-label { display: block; font-size: .72rem; margin-top: .25rem; }
.ms-root .ms-btn:active:not(:disabled) { transform: translateY(4px); border-bottom-width: 1px; }
.ms-root .ms-btn:disabled { opacity: .42; cursor: default; }
.ms-root .ms-btn-water { background: linear-gradient(180deg, #5cc0ea, #2b93c8); }
.ms-root .ms-btn-sun { background: linear-gradient(180deg, #f7bd5b, #d78a12); }
.ms-root .ms-btn-fert { background: linear-gradient(180deg, #b98753, #86592c); }
.ms-root .ms-btn-harvest { background: linear-gradient(180deg, #f0705f, #c93b2d); }
.ms-root /* きろく */
.ms-records { display: flex; align-items: center; justify-content: space-around; gap: .4rem; text-align: center; }
.ms-root .ms-rec { display: flex; flex-direction: column; gap: .15rem; }
.ms-root .ms-rec-label { font-size: .66rem; font-weight: 700; color: var(--muted); }
.ms-root .ms-rec-num { font-size: 1.12rem; font-weight: 900; font-variant-numeric: tabular-nums; }
.ms-root .ms-rec-num.ms-tomato { color: var(--tomato); }
.ms-root .ms-rec-num.ms-sun { color: var(--sun-d); }
.ms-root .ms-rec-num.ms-leaf { color: var(--leaf); }
.ms-root .ms-rec-div { width: 1px; align-self: stretch; background: var(--line); }
.ms-root .ms-reset-btn { background: none; border: 0; cursor: pointer; color: #9aa89a; font-size: .72rem; font-weight: 700; padding: .5rem; }
.ms-root /* モーダル */
.ms-modal { position: absolute; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 1.1rem; background: rgba(28,40,28,.55); }
.ms-root .ms-modal-card {
    width: 100%; max-width: 360px; max-height: 80%; overflow-y: auto;
    background: var(--card); border-radius: 22px; padding: 1.25rem 1.1rem;
    box-shadow: 0 20px 50px rgba(0,0,0,.3);
    -webkit-overflow-scrolling: touch;
}
.ms-root .ms-lead { margin: 0 0 .25rem; text-align: center; font-size: .8rem; font-weight: 700; color: #55634f; line-height: 1.5; }
.ms-root .ms-sec-title {
    display: flex; align-items: center; gap: .3rem;
    margin: 1.1rem 0 .45rem; padding-bottom: .3rem;
    border-bottom: 2px dotted var(--line);
    font-size: .82rem; font-weight: 900; color: var(--leaf);
}
.ms-root .ms-mini-table {
    display: grid; grid-template-columns: auto 1fr; gap: .45rem .6rem;
    font-size: .79rem; font-weight: 700; color: #46543f; line-height: 1.45;
}
.ms-root .ms-mini-key { white-space: nowrap; font-weight: 900; color: var(--ink); }
.ms-root .ms-flow { margin: 0; font-size: .78rem; font-weight: 900; color: #46543f; line-height: 1.9; }
.ms-root .ms-flow b { color: var(--tomato); }
.ms-root .ms-modal-title { margin: 0 0 .75rem; text-align: center; font-size: 1.05rem; font-weight: 900; color: var(--tomato); }
.ms-root .ms-legend { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .55rem; font-size: .82rem; font-weight: 700; color: #46543f; line-height: 1.45; }
.ms-root .ms-legend b { color: var(--ink); }
.ms-root .ms-note { margin-top: .9rem; background: #f1f9ec; border-radius: 14px; padding: .65rem .75rem; font-size: .74rem; font-weight: 700; color: #4d6046; line-height: 1.5; }
.ms-root .ms-wide-btn {
    width: 100%; border: 0; border-radius: 14px; cursor: pointer;
    padding: .75rem; color: #fff; font-size: .92rem; font-weight: 900;
    border-bottom: 5px solid rgba(0,0,0,.22);
    transition: transform .08s ease;
}
.ms-root .ms-wide-btn:active { transform: translateY(4px); border-bottom-width: 1px; }
.ms-root .ms-wide-btn.ms-primary { background: linear-gradient(180deg, #f0705f, #c93b2d); }
.ms-root .ms-wide-btn.ms-neutral { background: linear-gradient(180deg, #9fb09c, #5f7059); }
.ms-root .ms-modal-foot { margin-top: 1rem; }
.ms-root .ms-doc-link-wrap { margin: 1.1rem 0 0; text-align: center; }
.ms-root .ms-doc-link {
    display: inline-block; padding: .5rem 1.1rem; border-radius: 999px;
    font-family: inherit; cursor: pointer;
    background: #f1f9ec; color: var(--leaf);
    font-size: .78rem; font-weight: 900; text-decoration: none;
    border: 2px solid #d8ecd0;
}
.ms-root .ms-doc-link:focus-visible { outline: 3px solid #7cc0e8; outline-offset: 2px; }
.ms-root /* しゅうかく モーダル */
.ms-harvest-emoji { font-size: 3rem; text-align: center; line-height: 1; }
.ms-root .ms-harvest-qty { margin: .4rem 0; text-align: center; font-size: 2.4rem; font-weight: 900; font-variant-numeric: tabular-nums; }
.ms-root .ms-brix-box { background: #fdf3e0; border-radius: 14px; padding: .6rem; text-align: center; margin-bottom: .7rem; }
.ms-root .ms-brix-label { font-size: .7rem; font-weight: 700; color: #a9711a; }
.ms-root .ms-brix-value { font-size: 1.5rem; font-weight: 900; color: var(--sun-d); font-variant-numeric: tabular-nums; }
.ms-root .ms-harvest-comment { margin: 0 0 .9rem; text-align: center; font-size: .82rem; font-weight: 700; color: #55634f; line-height: 1.5; }
.ms-root /* アニメーション */
.ms-sway { transform-origin: 150px 300px; animation: sway 4s ease-in-out infinite; }
@keyframes sway { 0%,100% { transform: rotate(-1.2deg) } 50% { transform: rotate(1.2deg) } }
.ms-root .ms-pop { animation: pop .4s cubic-bezier(.2,1.6,.4,1) both; }
@keyframes pop { from { transform: scale(.65); opacity: 0 } to { transform: scale(1); opacity: 1 } }
.ms-root .ms-blink { animation: blink 1.3s ease-in-out infinite; }
@keyframes blink {
    0%, 100% { box-shadow: 0 4px 12px rgba(34,48,31,.13); }
    50%      { box-shadow: 0 0 0 5px rgba(224,72,60,.26), 0 4px 12px rgba(34,48,31,.13); }
}
.ms-root .ms-bug {
    position: absolute; font-size: 1.9rem; cursor: pointer; z-index: 5;
    animation: wiggle .5s ease-in-out infinite;
    filter: drop-shadow(0 2px 3px rgba(0,0,0,.3));
}
@keyframes wiggle { 0%,100% { transform: rotate(-12deg) } 50% { transform: rotate(12deg) } }
.ms-root .ms-drop { position: absolute; font-size: 1.4rem; z-index: 6; pointer-events: none; animation: fall .9s linear forwards; }
@keyframes fall { from { transform: translateY(-10px); opacity: 1 } to { transform: translateY(120px); opacity: 0 } }
.ms-root .ms-float-txt {
    position: absolute; left: 50%; top: 38%; transform: translateX(-50%);
    z-index: 7; pointer-events: none; font-weight: 900; font-size: 1.15rem;
    text-shadow: 0 2px 0 #fff, 0 0 8px #fff;
    animation: floatup 1.1s ease-out forwards;
}
@keyframes floatup { from { opacity: 1; transform: translate(-50%, 0) } to { opacity: 0; transform: translate(-50%, -50px) } }
@media (prefers-reduced-motion: reduce) {
.ms-root .ms-sway, .ms-root .ms-pop, .ms-root .ms-blink, .ms-root .ms-bug, .ms-root .ms-drop, .ms-root .ms-float-txt { animation: none !important; }
}
.ms-root /* おせわの えんしゅつ（じょうろ / ひりょう） */
.ms-fx-layer { position: absolute; inset: 0; z-index: 8; pointer-events: none; }
.ms-root .ms-fx-layer svg { display: block; width: 100%; height: 100%; }
.ms-root .ms-fx-can { transform-box: view-box; transform-origin: 50px 174px; animation: fx-can 2.4s ease-in-out both; }
@keyframes fx-can {
      0% { transform: translate(-95px, -25px) rotate(0deg); opacity: 0; }
     16% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
     30% { transform: translate(0, 0) rotate(26deg); opacity: 1; }
     76% { transform: translate(0, 0) rotate(26deg); opacity: 1; }
     90% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
    100% { transform: translate(-95px, -25px) rotate(0deg); opacity: 0; }
}
.ms-root .ms-fx-bag { transform-box: view-box; transform-origin: 224px 182px; animation: fx-bag 2.4s ease-in-out both; }
@keyframes fx-bag {
      0% { transform: translate(95px, -25px) rotate(0deg); opacity: 0; }
     16% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
     32% { transform: translate(0, 0) rotate(-34deg); opacity: 1; }
     74% { transform: translate(0, 0) rotate(-34deg); opacity: 1; }
     90% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
    100% { transform: translate(95px, -25px) rotate(0deg); opacity: 0; }
}
.ms-root .ms-fx-drop { animation: fx-fall-water .78s linear both; }
@keyframes fx-fall-water {
      0% { transform: translateY(0); opacity: 0; }
     12% { opacity: 1; }
     86% { opacity: 1; }
    100% { transform: translateY(104px); opacity: 0; }
}
.ms-root .ms-fx-grain { transform-box: fill-box; transform-origin: center; animation: fx-fall-grain .85s ease-in both; }
@keyframes fx-fall-grain {
      0% { transform: translateY(0) rotate(0deg); opacity: 0; }
     12% { opacity: 1; }
     88% { opacity: 1; }
    100% { transform: translateY(118px) rotate(160deg); opacity: 0; }
}
.ms-root .ms-fx-splash { transform-box: fill-box; transform-origin: center; animation: fx-splash .7s ease-out both; }
@keyframes fx-splash {
      0% { transform: scale(.25); opacity: .85; }
    100% { transform: scale(1.7); opacity: 0; }
}
.ms-root .ms-fx-spark { transform-box: fill-box; transform-origin: center; animation: fx-spark 1s ease-out both; }
@keyframes fx-spark {
      0% { transform: translateY(0) scale(.3); opacity: 0; }
     30% { opacity: 1; }
    100% { transform: translateY(-42px) scale(1); opacity: 0; }
}
.ms-root .ms-fx-soil { animation: fx-soil 2.4s ease-in-out both; }
@keyframes fx-soil {
      0% { opacity: 0; }
     28% { opacity: .5; }
     78% { opacity: .38; }
    100% { opacity: 0; }
}
.ms-root /* せつめいしょ シート（ゲームの なかで ひらく） */
.ms-manual-sheet { position: absolute; inset: 0; z-index: 60; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.ms-root .ms-manual-bar {
    position: sticky; top: 0; z-index: 5;
    display: flex; align-items: center; justify-content: space-between; gap: .5rem;
    padding: .55rem .9rem;
    background: #d8433a; color: #fff;
    font-size: .88rem; font-weight: 900;
    box-shadow: 0 3px 12px rgba(0,0,0,.22);
}
.ms-root .ms-manual-close {
    border: 0; border-radius: 999px; cursor: pointer; font-family: inherit;
    background: rgba(255,255,255,.26); color: #fff;
    font-size: .75rem; font-weight: 900; padding: .35rem .9rem;
}
.ms-root .ms-manual-close:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
.ms-root .ms-manual-sheet .ms-chapter, .ms-root .ms-manual-sheet .ms-toc { scroll-margin-top: 3.4rem; }
.ms-root .ms-manual-sheet {
    --ground: #eef7ea;
    --card: #ffffff;
    --ink: #22301f;
    --body: #46543f;
    --muted: #71806f;
    --line: #e0eadc;
    --tomato: #d8433a;
    --leaf: #45913a;
    --earth: #8a5a30;
    --sky: #2f9dd0;
    --sun: #d9901c;
    --zone: #cbeec4;
    --track: #e7ece4;
    --shadow: 0 6px 20px rgba(34,48,31,.08);
}
.ms-root .ms-manual-sheet * { box-sizing: border-box; }
.ms-root .ms-manual-sheet {
    margin: 0;
    background: var(--ground);
    color: var(--body);
    font-family: 'Zen Maru Gothic', 'Hiragino Maru Gothic ProN', 'Yu Gothic', sans-serif;
    font-size: 15px;
    line-height: 1.85;
}
.ms-root .ms-manual-sheet .ms-page { max-width: 720px; margin: 0 auto; padding: 0 1rem 3rem; }
.ms-root .ms-manual-sheet /* ひょうし */
.ms-cover {
    margin: 0 -1rem 1.5rem;
    padding: 2.2rem 1.5rem 1.8rem;
    background: linear-gradient(160deg, #d8433a 0%, #e9705a 55%, #f0996f 100%);
    color: #fff;
    text-align: center;
}
.ms-root .ms-manual-sheet .ms-cover-badge {
    display: inline-block; margin-bottom: .7rem;
    padding: .2rem 1rem; border-radius: 999px;
    background: rgba(255,255,255,.22);
    font-size: .72rem; font-weight: 900; letter-spacing: .22em;
}
.ms-root .ms-manual-sheet .ms-cover h1 { margin: 0; font-size: 1.9rem; font-weight: 900; line-height: 1.35; text-wrap: balance; }
.ms-root .ms-manual-sheet .ms-cover p { margin: .6rem auto 0; max-width: 26em; font-size: .86rem; font-weight: 700; opacity: .95; }
.ms-root .ms-manual-sheet .ms-cover-strip { display: flex; justify-content: center; gap: .4rem; margin-top: 1.2rem; }
.ms-root .ms-manual-sheet .ms-cover-strip svg { width: 58px; height: 74px; border-radius: 10px; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,.18); }
.ms-root .ms-manual-sheet /* もくじ */
.ms-toc { background: var(--card); border-radius: 18px; box-shadow: var(--shadow); padding: 1rem 1.2rem; margin-bottom: 1.4rem; }
.ms-root .ms-manual-sheet .ms-toc-title { font-size: .74rem; font-weight: 900; letter-spacing: .18em; color: var(--muted); margin-bottom: .5rem; }
.ms-root .ms-manual-sheet .ms-toc ol { margin: 0; padding-left: 1.3rem; font-size: .86rem; font-weight: 700; line-height: 1.9; columns: 2; column-gap: 1.4rem; }
@media (max-width: 520px) {
.ms-root .ms-manual-sheet .ms-toc ol { columns: 1; }
}
.ms-root .ms-manual-sheet .ms-toc a { color: var(--body); text-decoration: none; border-bottom: 1px dotted var(--line); }
.ms-root .ms-manual-sheet .ms-toc a:hover, .ms-root .ms-manual-sheet .ms-toc a:focus-visible { color: var(--tomato); border-bottom-color: var(--tomato); }
.ms-root .ms-manual-sheet /* しょう */
.ms-chapter { background: var(--card); border-radius: 20px; box-shadow: var(--shadow); padding: 1.4rem 1.3rem; margin-bottom: 1rem; scroll-margin-top: 1rem; }
.ms-root .ms-manual-sheet .ms-chapter h2 {
    display: flex; align-items: center; gap: .6rem;
    margin: 0 0 .9rem; font-size: 1.12rem; font-weight: 900; color: var(--ink);
    text-wrap: balance;
}
.ms-root .ms-manual-sheet .ms-num {
    flex: none; width: 1.85rem; height: 1.85rem; border-radius: 50%;
    background: var(--tomato); color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: .9rem; font-weight: 900; font-variant-numeric: tabular-nums;
}
.ms-root .ms-manual-sheet .ms-chapter p { margin: 0 0 .7rem; font-size: .9rem; font-weight: 500; }
.ms-root .ms-manual-sheet .ms-chapter p:last-child { margin-bottom: 0; }
.ms-root .ms-manual-sheet b, .ms-root .ms-manual-sheet strong { color: var(--ink); font-weight: 900; }
.ms-root .ms-manual-sheet /* がめんの みかた */
.ms-screen-map { display: grid; grid-template-columns: 190px 1fr; gap: 1.1rem; align-items: start; }
@media (max-width: 560px) {
.ms-root .ms-manual-sheet .ms-screen-map { grid-template-columns: 1fr; }
}
.ms-root .ms-manual-sheet .ms-mock { border: 3px solid var(--line); border-radius: 16px; overflow: hidden; background: var(--ground); }
.ms-root .ms-manual-sheet .ms-mock-row { display: flex; align-items: center; gap: .4rem; padding: .35rem .4rem; border-bottom: 1px dashed var(--line); }
.ms-root .ms-manual-sheet .ms-mock-row:last-child { border-bottom: 0; }
.ms-root .ms-manual-sheet .ms-mock-bar { flex: 1; border-radius: 6px; font-size: .58rem; font-weight: 900; color: #fff; padding: .25rem .4rem; text-align: center; }
.ms-root .ms-manual-sheet .ms-badge {
    flex: none; width: 1.15rem; height: 1.15rem; border-radius: 50%;
    background: var(--ink); color: #fff; font-size: .6rem; font-weight: 900;
    display: flex; align-items: center; justify-content: center;
    font-variant-numeric: tabular-nums;
}
.ms-root .ms-manual-sheet .ms-mock-plant { background: #cdeaf8; text-align: center; padding: .2rem; }
.ms-root .ms-manual-sheet .ms-mock-plant svg { width: 70px; height: 88px; }
.ms-root .ms-manual-sheet .ms-mock-mini { display: flex; gap: .2rem; flex: 1; }
.ms-root .ms-manual-sheet .ms-mock-mini span { flex: 1; height: 1.5rem; border-radius: 5px; background: #fff; border: 1px solid var(--line); }
.ms-root .ms-manual-sheet .ms-map-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .5rem; }
.ms-root .ms-manual-sheet .ms-map-list li { display: flex; gap: .5rem; font-size: .84rem; font-weight: 700; line-height: 1.6; }
.ms-root .ms-manual-sheet .ms-map-list .ms-badge { margin-top: .18rem; }
.ms-root .ms-manual-sheet /* そうさ */
.ms-ops { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: .7rem; }
.ms-root .ms-manual-sheet .ms-op { display: flex; gap: .7rem; padding: .8rem .9rem; border-radius: 14px; background: #f7fbf5; border: 2px solid var(--line); }
.ms-root .ms-manual-sheet .ms-op-icon { flex: none; font-size: 1.5rem; line-height: 1.3; }
.ms-root .ms-manual-sheet .ms-op-name { font-size: .9rem; font-weight: 900; color: var(--ink); }
.ms-root .ms-manual-sheet .ms-op-text { font-size: .8rem; font-weight: 500; line-height: 1.6; }
.ms-root .ms-manual-sheet /* メーター */
.ms-meter-doc { display: flex; flex-direction: column; gap: .9rem; }
.ms-root .ms-manual-sheet .ms-meter-doc-row { display: grid; grid-template-columns: 6.2rem 1fr; gap: .8rem; align-items: center; }
@media (max-width: 560px) {
.ms-root .ms-manual-sheet .ms-meter-doc-row { grid-template-columns: 1fr; gap: .3rem; }
}
.ms-root .ms-manual-sheet .ms-meter-doc-name { font-size: .86rem; font-weight: 900; }
.ms-root .ms-manual-sheet .ms-meter-doc-name.ms-water { color: var(--sky); }
.ms-root .ms-manual-sheet .ms-meter-doc-name.ms-sun { color: var(--sun); }
.ms-root .ms-manual-sheet .ms-meter-doc-name.ms-nut { color: var(--earth); }
.ms-root .ms-manual-sheet .ms-meter-doc-name.ms-life { color: #2f8f66; }
.ms-root .ms-manual-sheet .ms-zonebar { height: 12px; border-radius: 999px; margin-bottom: .3rem; }
.ms-root .ms-manual-sheet .ms-zonebar.ms-w { background: linear-gradient(90deg, var(--track) 0 29%, var(--zone) 29% 73%, var(--track) 73%); }
.ms-root .ms-manual-sheet .ms-zonebar.ms-s { background: linear-gradient(90deg, var(--track) 0 40%, var(--zone) 40% 88%, var(--track) 88%); }
.ms-root .ms-manual-sheet .ms-zonebar.ms-n { background: linear-gradient(90deg, var(--track) 0 23%, var(--zone) 23% 73%, var(--track) 73%); }
.ms-root .ms-manual-sheet .ms-zonebar.ms-l { background: #46c08a; }
.ms-root .ms-manual-sheet .ms-meter-doc-text { font-size: .8rem; font-weight: 500; line-height: 1.6; }
.ms-root .ms-manual-sheet /* せいちょう */
.ms-stages { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: .6rem; }
.ms-root .ms-manual-sheet .ms-stage-fig { text-align: center; }
.ms-root .ms-manual-sheet .ms-stage-fig svg { width: 100%; height: auto; border-radius: 12px; background: #cdeaf8; display: block; }
.ms-root .ms-manual-sheet .ms-stage-fig .ms-sway { animation: none; }
.ms-root .ms-manual-sheet .ms-stage-name { margin-top: .3rem; font-size: .78rem; font-weight: 900; color: var(--ink); }
.ms-root .ms-manual-sheet .ms-stage-pct { font-size: .68rem; font-weight: 700; color: var(--muted); font-variant-numeric: tabular-nums; }
.ms-root .ms-manual-sheet /* ちゅうい */
.ms-warns { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: .7rem; }
.ms-root .ms-manual-sheet .ms-warn { padding: .8rem .9rem; border-radius: 14px; background: #fff8ec; border-left: 5px solid var(--sun); }
.ms-root .ms-manual-sheet .ms-warn b { display: block; font-size: .86rem; margin-bottom: .15rem; }
.ms-root .ms-manual-sheet .ms-warn span { font-size: .8rem; font-weight: 500; line-height: 1.6; }
.ms-root .ms-manual-sheet .ms-warn.ms-bad { background: #fdf0ee; border-left-color: var(--tomato); }
.ms-root .ms-manual-sheet /* コツ */
.ms-steps { list-style: none; counter-reset: st; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .6rem; }
.ms-root .ms-manual-sheet .ms-steps li { counter-increment: st; display: flex; gap: .6rem; font-size: .86rem; font-weight: 500; line-height: 1.65; }
.ms-root .ms-manual-sheet .ms-steps li::before {
    content: counter(st); flex: none;
    width: 1.5rem; height: 1.5rem; margin-top: .15rem; border-radius: 50%;
    background: var(--leaf); color: #fff; font-size: .74rem; font-weight: 900;
    display: flex; align-items: center; justify-content: center;
}
.ms-root .ms-manual-sheet .ms-brix { width: 100%; border-collapse: collapse; margin-top: .9rem; font-size: .82rem; }
.ms-root .ms-manual-sheet .ms-brix th, .ms-root .ms-manual-sheet .ms-brix td { padding: .45rem .6rem; border-bottom: 1px solid var(--line); text-align: left; }
.ms-root .ms-manual-sheet .ms-brix th { font-size: .72rem; font-weight: 900; color: var(--muted); letter-spacing: .06em; }
.ms-root .ms-manual-sheet .ms-brix td:first-child { font-weight: 900; color: var(--ink); font-variant-numeric: tabular-nums; white-space: nowrap; }
.ms-root .ms-manual-sheet .ms-table-wrap { overflow-x: auto; }
.ms-root .ms-manual-sheet /* しつもん */
.ms-qa { display: flex; flex-direction: column; gap: .8rem; }
.ms-root .ms-manual-sheet .ms-qa dt { font-size: .88rem; font-weight: 900; color: var(--ink); }
.ms-root .ms-manual-sheet .ms-qa dt::before { content: "Q. "; color: var(--tomato); }
.ms-root .ms-manual-sheet .ms-qa dd { margin: .15rem 0 0; font-size: .84rem; font-weight: 500; line-height: 1.7; }
.ms-root .ms-manual-sheet .ms-qa dd::before { content: "A. "; font-weight: 900; color: var(--leaf); }
.ms-root .ms-manual-sheet .ms-play-wrap { text-align: center; margin: 1.6rem 0 .4rem; }
.ms-root .ms-manual-sheet .ms-play-link {
    display: inline-block; padding: .8rem 2rem; border-radius: 999px;
    background: linear-gradient(180deg, #ef6f5d, #c93b2d); color: #fff;
    font-size: .95rem; font-weight: 900; text-decoration: none;
    border-bottom: 5px solid #9c2d21;
    box-shadow: 0 6px 18px rgba(201,59,45,.3);
}
.ms-root .ms-manual-sheet .ms-play-link:active { transform: translateY(4px); border-bottom-width: 1px; }
.ms-root .ms-manual-sheet .ms-play-link:focus-visible { outline: 3px solid #7cc0e8; outline-offset: 3px; }
@media print {
.ms-root .ms-manual-sheet .ms-play-wrap { display: none; }
}
.ms-root .ms-manual-sheet footer { text-align: center; font-size: .74rem; font-weight: 700; color: var(--muted); padding-top: 1.4rem; }
@media print {
.ms-root .ms-manual-sheet { background: #fff; }
.ms-root .ms-manual-sheet .ms-chapter, .ms-root .ms-manual-sheet .ms-toc { box-shadow: none; border: 1px solid var(--line); break-inside: avoid; }
.ms-root .ms-manual-sheet .ms-cover { background: #d8433a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
@media (prefers-reduced-motion: reduce) {
.ms-root .ms-manual-sheet * { animation: none !important; }
}
/* あそびばの がめんの なかに おさめる。まどは この はこの なかだけを おおう。 */
.ms-root { position: relative; max-width: 480px; margin: 0 auto; }
.ms-root .ms-manual-sheet .ms-toc a { cursor: pointer; }`;

const HTML = `
<div data-app>
    <header class="ms-topbar">
        <h1 class="ms-brand">🍅 ミニトマトを そだてよう</h1>
        <button data-btn-howto class="ms-ghost-btn">あそびかた</button>
    </header>

    <div class="ms-wrap">
        <div class="ms-status-row">
            <span data-day-label>1日目</span>
            <span data-place-label class="ms-place-chip ms-sunny">☀️ ひなた</span>
        </div>

        <div data-plant-box class="ms-plant-box">
            <svg data-plant-svg viewBox="0 0 300 380"></svg>
        </div>

        <button type="button" data-seed-doc class="ms-seed-doc ms-hidden">
            <span class="ms-seed-doc-icon">📖</span>
            <span class="ms-seed-doc-body">
                <b>そだてかたを たしかめる</b>
                <span class="ms-seed-doc-sub">みず・たいよう・えいようの コツが のっているよ</span>
            </span>
            <span class="ms-seed-doc-arrow">›</span>
        </button>

        <section class="ms-card">
            <div class="ms-growth-head">
                <span data-stage-name class="ms-stage">たね</span>
                <span class="ms-pct"><span data-growth-percent>0</span>%</span>
            </div>
            <div class="ms-bar"><i data-growth-bar class="ms-fill-growth" style="width:0%"></i></div>
            <p data-message class="ms-msg">つちに たねを うえたよ。みずを あげてね。</p>
        </section>

        <section class="ms-meters">
            <div class="ms-card ms-meter">
                <div class="ms-meter-name ms-water">💧 みず</div>
                <div class="ms-bar ms-zone-water"><i data-water-bar class="ms-fill-water"></i></div>
                <div data-water-text class="ms-meter-state">ちょうどいい</div>
            </div>
            <div class="ms-card ms-meter">
                <div class="ms-meter-name ms-sun">☀️ たいよう</div>
                <div class="ms-bar ms-zone-sun"><i data-sun-bar class="ms-fill-sun"></i></div>
                <div data-sun-text class="ms-meter-state">ちょうどいい</div>
            </div>
            <div class="ms-card ms-meter">
                <div class="ms-meter-name ms-nut">🌱 えいよう</div>
                <div class="ms-bar ms-zone-nut"><i data-nut-bar class="ms-fill-nut"></i></div>
                <div data-nut-text class="ms-meter-state">ちょうどいい</div>
            </div>
            <div class="ms-card ms-meter">
                <div class="ms-meter-name ms-health">🌿 げんき</div>
                <div class="ms-bar"><i data-health-bar class="ms-fill-health"></i></div>
                <div data-health-text class="ms-meter-state">げんき</div>
            </div>
        </section>

        <section class="ms-actions">
            <button data-btn-water class="ms-btn ms-btn-water">💧<span class="ms-btn-label">みずやり</span></button>
            <button data-btn-fert class="ms-btn ms-btn-fert">🌱<span class="ms-btn-label">ひりょう</span></button>
            <button data-btn-place class="ms-btn ms-btn-sun">☀️<span class="ms-btn-label">ひかげへ</span></button>
            <button data-btn-harvest class="ms-btn ms-btn-harvest" disabled>🍅<span class="ms-btn-label">しゅうかく</span></button>
        </section>

        <section class="ms-card ms-records">
            <div class="ms-rec">
                <span class="ms-rec-label">しゅうかくした かず</span>
                <b class="ms-rec-num ms-tomato"><span data-rec-total>0</span> こ</b>
            </div>
            <div class="ms-rec-div"></div>
            <div class="ms-rec">
                <span class="ms-rec-label">いちばん あまかった</span>
                <b class="ms-rec-num ms-sun" data-rec-brix>-</b>
            </div>
            <div class="ms-rec-div"></div>
            <div class="ms-rec">
                <span class="ms-rec-label">そだてた かい</span>
                <b class="ms-rec-num ms-leaf"><span data-rec-round>0</span> かい</b>
            </div>
        </section>

        <button data-btn-reset class="ms-reset-btn">さいしょから はじめる</button>
    </div>
</div>

<!-- しゅうかく けっか -->
<div data-modal-harvest class="ms-modal ms-hidden">
    <div class="ms-modal-card ms-pop">
        <div class="ms-harvest-emoji">🍅</div>
        <h2 class="ms-modal-title">しゅうかく できた！</h2>
        <div class="ms-harvest-qty"><span data-harvest-qty>0</span> こ</div>
        <div class="ms-brix-box">
            <div class="ms-brix-label">あまさ（とうど）</div>
            <div class="ms-brix-value" data-harvest-brix>0.0</div>
        </div>
        <p data-harvest-comment class="ms-harvest-comment"></p>
        <p class="ms-doc-link-wrap" style="margin:0 0 .9rem"><button type="button" data-btn-doc-harvest class="ms-doc-link">📖 もっと あまく する コツを よむ</button></p>
        <button data-btn-next class="ms-wide-btn ms-primary">つぎの たねを うえる</button>
    </div>
</div>

<div class="ms-manual-sheet ms-hidden">
    <div class="ms-manual-bar"><span>📖 せつめいしょ</span><button type="button" data-btn-manual-close class="ms-manual-close">✕ とじる</button></div>
<div class="ms-page">

<header class="ms-cover">
    <div class="ms-cover-badge">せつめいしょ</div>
    <h1>ミニトマトを そだてよう</h1>
    <p>たねを うえてから まっかな みを しゅうかく するまで。そだてかたの ぜんぶが この 1さつに はいっています。</p>
    <div class="ms-cover-strip" data-cover-strip></div>
</header>

<nav class="ms-toc">
    <div class="ms-toc-title">もくじ</div>
    <ol>
        <li><a data-goto="c1">どんな ゲーム？</a></li>
        <li><a data-goto="c2">がめんの みかた</a></li>
        <li><a data-goto="c3">そうさ ボタン</a></li>
        <li><a data-goto="c4">4つの メーター</a></li>
        <li><a data-goto="c5">そだつ じゅんばん</a></li>
        <li><a data-goto="c6">きを つけること</a></li>
        <li><a data-goto="c7">あまい トマトの つくりかた</a></li>
        <li><a data-goto="c8">よくある しつもん</a></li>
    </ol>
</nav>

<main>

<section class="ms-chapter" data-c1>
    <h2><span class="ms-num">1</span>どんな ゲーム？</h2>
    <p>はちに うえた ミニトマトの なえに <b>みず</b>・<b>たいよう</b>・<b>ひりょう</b> を あげて、まっかな みが なるまで そだてる ゲームです。おみせや おかねは でてきません。じぶんの てで そだてるだけです。</p>
    <p>じかんは <b>1びょうに 1かい</b> すすみます。じょうずに おせわ できれば <b>2〜3ぷんくらい</b> で しゅうかく できます。おせわを わすれると もっと じかんが かかったり、かれてしまう ことも あります。</p>
    <p>とちゅうで ページを とじても だいじょうぶ。そだてている とちゅうの ようすと きろくは <b>じどうで ほぞん</b> されます。</p>
</section>

<section class="ms-chapter" data-c2>
    <h2><span class="ms-num">2</span>がめんの みかた</h2>
    <div class="ms-screen-map">
        <div class="ms-mock" aria-hidden="true">
            <div class="ms-mock-row"><span class="ms-badge">1</span><span class="ms-mock-bar" style="background:#d8433a">ミニトマトを そだてよう</span></div>
            <div class="ms-mock-row"><span class="ms-badge">2</span><span class="ms-mock-bar" style="background:#e6ae4a">1日目 / ☀️ ひなた</span></div>
            <div class="ms-mock-plant"><span class="ms-badge" style="float:left">3</span><span data-mock-plant></span></div>
            <div class="ms-mock-row"><span class="ms-badge">4</span><span class="ms-mock-bar" style="background:#7bbf5a">せいちょう と メッセージ</span></div>
            <div class="ms-mock-row"><span class="ms-badge">5</span><span class="ms-mock-mini"><span></span><span></span><span></span><span></span></span></div>
            <div class="ms-mock-row"><span class="ms-badge">6</span><span class="ms-mock-mini"><span style="background:#5cc0ea"></span><span style="background:#b98753"></span><span style="background:#f7bd5b"></span><span style="background:#f0705f"></span></span></div>
            <div class="ms-mock-row"><span class="ms-badge">7</span><span class="ms-mock-bar" style="background:#9fb09c">きろく</span></div>
        </div>
        <ul class="ms-map-list">
            <li><span class="ms-badge">1</span><span><b>タイトルバー</b>／みぎの「あそびかた」で この せつめいを よめます。</span></li>
            <li><span class="ms-badge">2</span><span><b>ひづけ と ばしょ</b>／いま なんにちめか、ひなたか ひかげかが わかります。</span></li>
            <li><span class="ms-badge">3</span><span><b>はちの え</b>／なえの ようすが かわります。<b>むしが でたら ここを タップ</b>して つかまえます。</span></li>
            <li><span class="ms-badge">4</span><span><b>せいちょうバー</b>／いまの だんかいと なんパーセントか。したの ぶんしょうは なえからの メッセージです。</span></li>
            <li><span class="ms-badge">5</span><span><b>4つの メーター</b>／みず・たいよう・えいよう・げんき。</span></li>
            <li><span class="ms-badge">6</span><span><b>そうさボタン</b>／みずやり・ひりょう・ひなた／ひかげ・しゅうかく。</span></li>
            <li><span class="ms-badge">7</span><span><b>きろく</b>／これまでに しゅうかくした かずなどが のこります。</span></li>
        </ul>
    </div>
</section>

<section class="ms-chapter" data-c3>
    <h2><span class="ms-num">3</span>そうさ ボタン</h2>
    <div class="ms-ops">
        <div class="ms-op">
            <div class="ms-op-icon">💧</div>
            <div><div class="ms-op-name">みずやり</div>
            <div class="ms-op-text">じょうろで みずを あげます。1かいで みずメーターが おおきく ふえます。つちが かわく まえに あげましょう。</div></div>
        </div>
        <div class="ms-op">
            <div class="ms-op-icon">🌱</div>
            <div><div class="ms-op-name">ひりょう</div>
            <div class="ms-op-text">えいようを あげます。<b>15びょうに 1かい</b> だけ。まちじかんの あいだは ボタンに「あと ◯びょう」と でます。</div></div>
        </div>
        <div class="ms-op">
            <div class="ms-op-icon">☀️</div>
            <div><div class="ms-op-name">ひなた / ひかげ</div>
            <div class="ms-op-text">おす たびに いれかわります。ひなたでは たいようが ふえ、ひかげでは へります。みずの へりかたも かわります。</div></div>
        </div>
        <div class="ms-op">
            <div class="ms-op-icon">🍅</div>
            <div><div class="ms-op-name">しゅうかく</div>
            <div class="ms-op-text">せいちょうが 100%に なると おせるように なります。とれた かずと あまさが でます。</div></div>
        </div>
        <div class="ms-op">
            <div class="ms-op-icon">🐛</div>
            <div><div class="ms-op-name">むしを つかまえる</div>
            <div class="ms-op-text">ボタンでは なく、はちの えに でてきた <b>むしを ちょくせつ タップ</b> します。</div></div>
        </div>
    </div>
</section>

<section class="ms-chapter" data-c4>
    <h2><span class="ms-num">4</span>4つの メーター</h2>
    <p>バーの <b>みどりの ところ</b> が「ちょうどいい」しるしです。4つとも みどりに はいっていると いちばん はやく そだち、あまさも あがります。</p>
    <div class="ms-meter-doc">
        <div class="ms-meter-doc-row">
            <div class="ms-meter-doc-name ms-water">💧 みず</div>
            <div><div class="ms-zonebar ms-w"></div>
            <div class="ms-meter-doc-text">じかんが たつと へります。ひなたに おいて いる ときは はやく へります。<b>すくなすぎる</b>と げんきが へり、<b>おおすぎる</b>と ねが いたみます。</div></div>
        </div>
        <div class="ms-meter-doc-row">
            <div class="ms-meter-doc-name ms-sun">☀️ たいよう</div>
            <div><div class="ms-zonebar ms-s"></div>
            <div class="ms-meter-doc-text">ひなたに だすと ふえ、ひかげに いれると へります。<b>あてすぎる</b>と あつくなって よわるので、ときどき ひかげへ。</div></div>
        </div>
        <div class="ms-meter-doc-row">
            <div class="ms-meter-doc-name ms-nut">🌱 えいよう</div>
            <div><div class="ms-zonebar ms-n"></div>
            <div class="ms-meter-doc-text">そだつ ときに つかわれて すこしずつ へります。<b>からっぽ</b>だと せいちょうが おそくなり、<b>あげすぎる</b>と ひりょうやけに なります。</div></div>
        </div>
        <div class="ms-meter-doc-row">
            <div class="ms-meter-doc-name ms-life">🌿 げんき</div>
            <div><div class="ms-zonebar ms-l"></div>
            <div class="ms-meter-doc-text">ほかの 3つが ちょうどいいと すこしずつ ふえます。わるい ことが つづくと へって、<b>0に なると かれて</b> たねから やりなおしです。</div></div>
        </div>
    </div>
</section>

<section class="ms-chapter" data-c5>
    <h2><span class="ms-num">5</span>そだつ じゅんばん</h2>
    <p>せいちょうが すすむと、はちの えが つぎのように かわっていきます。パーセントは せいちょうバーの めやすです。</p>
    <div class="ms-stages" data-stages></div>
</section>

<section class="ms-chapter" data-c6>
    <h2><span class="ms-num">6</span>きを つけること</h2>
    <div class="ms-warns">
        <div class="ms-warn"><b>💧 みずの あげすぎ</b><span>メーターが みどりを こえても あげつづけると、ねが いたんで げんきが へります。「たっぷり」に なったら すこし まちましょう。</span></div>
        <div class="ms-warn"><b>🌱 ひりょうの あげすぎ</b><span>「おおすぎ」で あげると ひりょうやけ。げんきが へって しまいます。</span></div>
        <div class="ms-warn"><b>☀️ ひなたに おきっぱなし</b><span>たいようが「あつすぎ」に なると よわります。ときどき ひかげに いれて あげましょう。</span></div>
        <div class="ms-warn ms-bad"><b>🐛 むしを ほうって おく</b><span>むしが いる あいだは げんきが どんどん へります。みつけたら すぐ タップ！</span></div>
        <div class="ms-warn ms-bad"><b>🥀 かれて しまったら</b><span>げんきが 0に なると なえは かれ、せいちょうは 0%に もどります。しゅうかくの きろくは のこるので、また たねから そだてましょう。</span></div>
    </div>
</section>

<section class="ms-chapter" data-c7>
    <h2><span class="ms-num">7</span>あまい トマトの つくりかた</h2>
    <p>あまさ（とうど）は、そだてている あいだ <b>4つの メーターが どれだけ ちょうどいい じょうたい だったか</b> で きまります。ずっと みどりの ゾーンに たもてた ほど あまくなります。</p>
    <ol class="ms-steps">
        <li>みずは「ちょうどいい」を たもつ。「すこし かわいた」に なったら あげる。</li>
        <li>たいようが「まぶしい」に なったら ひかげへ、「たりない」に なったら ひなたへ。</li>
        <li>ひりょうは まちじかんが あけたら、「たっぷり」に なる まえに あげる。</li>
        <li>むしは みつけしだい すぐに つかまえる。</li>
    </ol>
    <div class="ms-table-wrap">
        <table class="ms-brix">
            <thead><tr><th>とうど</th><th>あじの めやす</th></tr></thead>
            <tbody>
                <tr><td>〜6.0</td><td>ちょっと すっぱい</td></tr>
                <tr><td>6.0〜8.0</td><td>まずまずの あじ</td></tr>
                <tr><td>8.0〜10.0</td><td>あまくて おいしい</td></tr>
                <tr><td>10.0〜</td><td>とびきり あまい！</td></tr>
            </tbody>
        </table>
    </div>
</section>

<section class="ms-chapter" data-c8>
    <h2><span class="ms-num">8</span>よくある しつもん</h2>
    <dl class="ms-qa">
        <dt>とちゅうで ページを とじても いい？</dt>
        <dd>だいじょうぶです。そだてている とちゅうの ようすと きろくは じどうで ほぞんされ、つぎに ひらいた ときに つづきから あそべます。</dd>

        <dt>しゅうかくの ボタンが おせません</dt>
        <dd>せいちょうが 100%に なるまで おせません。バーが みぎはしまで いって「しゅうかく できる！」と でたら おせます。</dd>

        <dt>ひりょうの ボタンが グレーです</dt>
        <dd>ひりょうは 15びょうに 1かいだけ。ボタンに でている「あと ◯びょう」が 0に なると また おせます。</dd>

        <dt>ぜんぜん そだちません</dt>
        <dd>みず・たいよう・えいようの どれかが たりないか おおすぎです。がめんの メッセージに いま なにが たりないか でているので、そこを なおして みてください。</dd>

        <dt>きろくを けしたい</dt>
        <dd>いちばん したの「さいしょから はじめる」を <b>2かい</b> おすと、しゅうかくの きろくも ふくめて ぜんぶ けせます。まちがえて けさないように 2かい おす しくみです。</dd>
    </dl>
</section>

</main>

<footer>ミニトマトを そだてよう ／ せつめいしょ</footer>
</div>
</div>`;

export const mountMinitomatoSodate: GameMount = (host, ctx) => {
  const style = document.createElement('style');
  style.textContent = CSS;
  const root = document.createElement('div');
  root.className = 'ms-root';
  root.innerHTML = HTML;
  host.replaceChildren(style, root);

  /** 置き場所の中だけを見る。id ではなく data-* にしてあるので、外とぶつからない。 */
  const q = <T extends HTMLElement = HTMLElement>(name: string): T =>
    root.querySelector('[data-' + name + ']') as T;

  const S: State = fresh();
  let startedAt = Date.now();
  let disposed = false;
  let lastMessage = '';
  let manualReady = false;
  let resetArmedUntil = 0;
  let seedDocTimer = 0;
  let tickTimer = 0;

  const timers = new Set<number>();
  const later = (fn: () => void, ms: number): number => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (!disposed) fn();
    }, ms);
    timers.add(id);
    return id;
  };
  const stop = (id: number): void => {
    if (!id) return;
    window.clearTimeout(id);
    timers.delete(id);
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const put = (): void => ctx.save.put(S);

  /* ===================== はんてい ===================== */
  const waterOK = (): boolean => S.water >= 35 && S.water <= 88;
  const sunOK = (): boolean => S.sun >= 40 && S.sun <= 88;
  const nutOK = (): boolean => S.nut >= 30 && S.nut <= 95;
  const perfect = (): boolean => waterOK() && sunOK() && nutOK() && !S.bug && S.health >= 60;

  const setMessage = (text: string): void => {
    lastMessage = text;
    q('message').textContent = text;
  };

  function floatText(text: string, color: string): void {
    const box = q('plant-box');
    const el = document.createElement('div');
    el.className = 'ms-float-txt';
    el.style.color = color;
    el.textContent = text;
    box.appendChild(el);
    later(() => el.remove(), 1100);
  }

  /* ===================== おせわの えんしゅつ ===================== */
  function waterFxSVG(): string {
    let s = '<ellipse class="ms-fx-soil" cx="150" cy="292" rx="60" ry="9" fill="#2c1a08"/>';
    s += '<g class="ms-fx-can">'
      + '<path d="M78,158 L132,138 L140,152 L86,176 Z" fill="#8fcfec"/>'
      + '<ellipse cx="136" cy="145" rx="7" ry="9" fill="#6fb9de" transform="rotate(-20 136 145)"/>'
      + '<path d="M26,150 Q22,118 50,116 Q78,114 74,150" fill="none" stroke="#6fb9de" stroke-width="7" stroke-linecap="round"/>'
      + '<rect x="18" y="150" width="64" height="52" rx="12" fill="#7cc4e8"/>'
      + '<rect x="18" y="150" width="64" height="15" rx="7" fill="#a9e0f7"/>'
      + '<rect x="14" y="194" width="72" height="11" rx="5" fill="#57a6cf"/>'
      + '</g>';
    for (let i = 0; i < 8; i++) {
      s += '<ellipse class="ms-fx-drop" cx="' + (138 + ((i % 3) - 1) * 5) + '" cy="192" rx="3.2" ry="5" '
        + 'fill="#5fb0d9" style="animation-delay:' + (0.70 + i * 0.13).toFixed(2) + 's"/>';
    }
    for (let i = 0; i < 3; i++) {
      s += '<ellipse class="ms-fx-splash" cx="140" cy="297" rx="15" ry="4.5" fill="none" stroke="#7cc4e8" '
        + 'stroke-width="2.5" style="animation-delay:' + (1.10 + i * 0.34).toFixed(2) + 's"/>';
    }
    return s;
  }

  function fertFxSVG(): string {
    let s = '<ellipse class="ms-fx-soil" cx="150" cy="292" rx="60" ry="9" fill="#3a250d"/>';
    s += '<g class="ms-fx-bag">'
      + '<path d="M196,152 L252,152 L252,208 Q252,216 244,216 L204,216 Q196,216 196,208 Z" fill="#b5814c"/>'
      + '<path d="M196,152 L224,138 L252,152 Z" fill="#8b5e3c"/>'
      + '<rect x="205" y="170" width="38" height="24" rx="7" fill="#f6ead2"/>'
      + '<path d="M215,182 q9,-9 18,0 q-9,9 -18,0 Z" fill="#6f9c3a"/>'
      + '<line x1="224" y1="176" x2="224" y2="188" stroke="#4d7c0f" stroke-width="1.6"/>'
      + '</g>';
    const cols = ['#7a5230', '#a9743f', '#8b5a2b', '#c39152'];
    for (let i = 0; i < 12; i++) {
      s += '<circle class="ms-fx-grain" cx="' + (172 + (i % 5) * 4.5) + '" cy="' + (174 + (i % 3) * 3) + '" '
        + 'r="' + (2.2 + (i % 3) * 0.5).toFixed(1) + '" fill="' + cols[i % 4] + '" '
        + 'style="animation-delay:' + (0.72 + i * 0.075).toFixed(2) + 's"/>';
    }
    for (let i = 0; i < 5; i++) {
      const x = 118 + i * 16;
      s += '<path class="ms-fx-spark" d="M' + x + ',288 l3,-7 l3,7 l7,3 l-7,3 l-3,7 l-3,-7 l-7,-3 Z" '
        + 'fill="#fde68a" style="animation-delay:' + (1.35 + i * 0.12).toFixed(2) + 's"/>';
    }
    return s;
  }

  function careFx(kind: 'water' | 'fert'): void {
    const box = q('plant-box');
    for (const el of Array.from(box.querySelectorAll('.ms-fx-layer'))) el.remove();
    if (reduceMotion) return;
    const layer = document.createElement('div');
    layer.className = 'ms-fx-layer';
    layer.innerHTML = '<svg viewBox="0 0 300 380">' + (kind === 'fert' ? fertFxSVG() : waterFxSVG()) + '</svg>';
    box.appendChild(layer);
    later(() => layer.remove(), 2500);
  }

  /* ===================== せつめいしょ ===================== */
  const figureAt = (g: number): string =>
    '<svg viewBox="0 0 300 380">' + plantSVG(g, 100, 'sun', g >= 100) + '</svg>';

  function buildManual(): void {
    if (manualReady) return;
    manualReady = true;
    q('cover-strip').innerHTML = [12, 62, 100].map(figureAt).join('');
    q('mock-plant').innerHTML = figureAt(84);
    q('stages').innerHTML = MANUAL_FIGS.map((f) =>
      '<div class="ms-stage-fig">' + figureAt(f.g)
      + '<div class="ms-stage-name">' + f.name + '</div>'
      + '<div class="ms-stage-pct">' + f.pct + '</div></div>').join('');
  }

  const sheet = root.querySelector('.ms-manual-sheet') as HTMLElement;

  function openManual(): void {
    buildManual();
    hideSeedDoc();
    sheet.classList.remove('ms-hidden');
    sheet.scrollTop = 0;
  }
  const closeManual = (): void => sheet.classList.add('ms-hidden');

  /* ===================== たねを うえた あとの あんない ===================== */
  function showSeedDoc(): void {
    const el = q('seed-doc');
    el.classList.remove('ms-hidden');
    stop(seedDocTimer);
    seedDocTimer = later(() => el.classList.add('ms-hidden'), 20000);
  }
  function hideSeedDoc(): void {
    stop(seedDocTimer);
    seedDocTimer = 0;
    q('seed-doc').classList.add('ms-hidden');
  }

  /* ===================== 1ティックの しょり ===================== */
  function tick(): void {
    if (S.ready) { render(); return; }

    S.tick++;
    if (S.tick % DAY_TICKS === 0) S.day++;

    // みずは だんだん へる（ひなたの ほうが はやい）
    S.water = clamp(S.water - (S.place === 'sun' ? 0.9 : 0.45), 0, 120);
    S.sun = clamp(S.sun + (S.place === 'sun' ? 1.1 : -0.9), 0, 100);
    // えいようは そだつ ときに つかわれて へる
    S.nut = clamp(S.nut - 0.3, 0, 130);

    if (!S.bug && S.growth > 15 && Math.random() < 0.012) { S.bug = true; S.bugAge = 0; }
    if (S.bug) {
      S.bugAge++;
      if (S.bugAge > 45) S.bug = false;   // じぶんで どこかへ いく
    }

    let d = 0.18;
    if (S.water < 15) d -= 0.55;
    if (S.water > 100) d -= 0.45;         // みずの あげすぎ（ねぐされ）
    if (S.sun > 95) d -= 0.30;            // ひなたに おきっぱなし
    if (S.sun < 12) d -= 0.25;
    if (S.nut > 105) d -= 0.40;           // ひりょうやけ
    if (S.bug) d -= 0.55;
    S.health = clamp(S.health + d, 0, 100);

    S.careTicks++;
    if (perfect()) S.goodTicks++;
    if (S.health > 20 && S.water >= 18 && S.water <= 105 && S.sun >= 20) {
      let rate = 0.28;
      if (waterOK()) rate += 0.20;
      if (sunOK()) rate += 0.20;
      if (nutOK()) rate += 0.16;
      if (!S.bug) rate += 0.06;
      if (S.nut < 10) rate *= 0.6;        // えいよう ぎれ
      rate *= 0.5 + S.health / 200;
      S.growth = clamp(S.growth + rate, 0, 100);
    }

    if (S.growth >= 100) S.ready = true;
    if (S.health <= 0) wither();

    put();
    render();
  }

  function wither(): void {
    floatText('かれちゃった…', '#6b7280');
    S.growth = 0; S.water = 60; S.sun = 50; S.nut = 55; S.health = 55;
    S.bug = false; S.ready = false;
    S.goodTicks = 0; S.careTicks = 0;
    startedAt = Date.now();
    setMessage('かれちゃった… もういちど たねから そだてよう。');
  }

  /* ===================== そうさ ===================== */
  function doWater(): void {
    if (S.ready) return;
    if (S.water > 95) {
      S.water = clamp(S.water + 12, 0, 120);
      S.health = clamp(S.health - 3, 0, 100);
      floatText('あげすぎ！', '#0284c7');
      setMessage('みずが おおすぎるよ。すこし まってから あげよう。');
    } else {
      S.water = clamp(S.water + 26, 0, 120);
      floatText('💧 ごくごく', '#0284c7');
      setMessage(waterOK() ? 'おいしい みずを もらった！' : 'もう すこし あげても いいかも。');
    }
    careFx('water');
    put();
    render();
  }

  function doFertilizer(): void {
    if (S.ready || Date.now() < S.fertReady) return;
    S.fertReady = Date.now() + FERT_WAIT;
    if (S.nut > 95) {
      S.nut = clamp(S.nut + 14, 0, 130);
      S.health = clamp(S.health - 4, 0, 100);
      floatText('ひりょうが おおすぎ！', '#a16207');
      setMessage('ひりょうの あげすぎは ねっこが いたむよ。すこし まってね。');
    } else {
      S.nut = clamp(S.nut + 32, 0, 130);
      floatText('🌱 えいよう まんてん', '#7a4f27');
      setMessage(nutOK() ? 'えいようを もらった！ ぐんぐん そだつよ。' : 'もう すこし あげても だいじょうぶ。');
    }
    careFx('fert');
    put();
    render();
  }

  function togglePlace(): void {
    S.place = S.place === 'sun' ? 'shade' : 'sun';
    floatText(S.place === 'sun' ? '☀️ ひなた' : '🌥 ひかげ', '#d97706');
    setMessage(S.place === 'sun'
      ? 'ひなたに だしたよ。ひかりを あびて そだつ！'
      : 'ひかげに いれたよ。すこし やすもうね。');
    put();
    render();
  }

  function catchBug(): void {
    if (!S.bug) return;
    S.bug = false;
    S.health = clamp(S.health + 4, 0, 100);
    floatText('むしを つかまえた！', '#16a34a');
    setMessage('むしを とれたよ！ はっぱが たすかった。');
    put();
    render();
  }

  function harvest(): void {
    if (!S.ready) return;
    const quality = S.careTicks > 0 ? S.goodTicks / S.careTicks : 0;
    const brix = clamp(5.0 + quality * 6.0 + (S.health - 60) / 40 + Math.random() * 0.6, 3.5, 12.0);
    const qty = 3 + Math.floor(quality * 6) + Math.floor(Math.random() * 3);

    S.totalHarvest += qty;
    S.round += 1;
    if (brix > S.bestBrix) S.bestBrix = brix;

    q('harvest-qty').textContent = String(qty);
    q('harvest-brix').textContent = brix.toFixed(1);
    q('harvest-comment').textContent =
      brix >= 10 ? 'とびきり あまい！ さいこうの できばえ！'
        : brix >= 8 ? 'あまくて おいしい ミニトマト！'
          : brix >= 6 ? 'まずまずの あじ。つぎは もっと あまく できるよ。'
            : 'ちょっと すっぱいかも。みずと たいようを ちょうどよくしてみよう。';
    q('modal-harvest').classList.remove('ms-hidden');

    // 「とれた かず × あまさ」が この ゲームの てん。どちらも おせわの じょうずさで あがる。
    ctx.onFinish(Math.round(qty * brix), startedAt);
    put();
  }

  function nextSeed(): void {
    q('modal-harvest').classList.add('ms-hidden');
    S.growth = 0; S.water = 60; S.sun = 50; S.nut = 55; S.health = 100;
    S.bug = false; S.ready = false;
    S.goodTicks = 0; S.careTicks = 0;
    startedAt = Date.now();
    setMessage('あたらしい たねを うえたよ。みずを あげてね。');
    showSeedDoc();
    put();
    render();
  }

  function resetAll(): void {
    const btn = q('btn-reset');
    // 2かい おしたら けす（まちがえて けさないように）
    if (Date.now() > resetArmedUntil) {
      resetArmedUntil = Date.now() + 5000;
      btn.textContent = 'ほんとうに けしていい？ もういちど おしてね';
      btn.style.color = '#ef4444';
      later(() => {
        btn.textContent = 'さいしょから はじめる';
        btn.style.color = '';
        resetArmedUntil = 0;
      }, 5000);
      return;
    }
    resetArmedUntil = 0;
    btn.textContent = 'さいしょから はじめる';
    btn.style.color = '';
    hideSeedDoc();
    Object.assign(S, fresh());
    startedAt = Date.now();
    setMessage('つちに たねを うえたよ。みずを あげてね。');
    put();
    render();
  }

  /* ===================== がめんを こうしん ===================== */
  function hintMessage(): string {
    if (S.bug) return '🐛 むしが ついてる！ タップして つかまえよう。';
    if (S.water < 15) return 'つちが からから！ みずを あげてね。';
    if (S.water > 100) return 'みずが おおすぎ。すこし かわかそう。';
    if (S.sun > 95) return 'ひざしが つよすぎ。ひかげに いれてあげよう。';
    if (S.sun < 12) return 'くらいよ。ひなたに だしてあげよう。';
    if (S.nut < 12) return 'えいようが たりない。ひりょうを あげよう。';
    if (S.nut > 105) return 'ひりょうが おおすぎ。すこし まってね。';
    if (S.health < 30) return 'ぐったり… おせわを ちょうどよくしてね。';
    if (S.ready) return 'まっかに なったよ！ しゅうかく しよう！';
    return lastMessage;
  }

  function render(): void {
    q('plant-svg').innerHTML = plantSVG(S.growth, S.health, S.place, S.ready);

    // むし
    const box = q('plant-box');
    let bugEl = box.querySelector('.ms-bug') as HTMLElement | null;
    if (S.bug) {
      if (!bugEl) {
        bugEl = document.createElement('div');
        bugEl.className = 'ms-bug';
        bugEl.textContent = '🐛';
        bugEl.addEventListener('click', catchBug);
        box.appendChild(bugEl);
      }
      const stemH = S.growth < 6 ? 0 : (S.growth - 6) * 2.4;
      bugEl.style.top = ((300 - stemH * 0.55) / 380 * 100).toFixed(1) + '%';
      bugEl.style.left = '58%';
    } else if (bugEl) {
      bugEl.remove();
    }

    q('stage-name').textContent = stageName(S.growth);
    q('growth-percent').textContent = String(Math.floor(S.growth));
    q('growth-bar').style.width = S.growth + '%';
    q('message').textContent = hintMessage();

    q('water-bar').style.width = clamp(S.water / 120 * 100, 0, 100) + '%';
    q('sun-bar').style.width = S.sun + '%';
    q('nut-bar').style.width = clamp(S.nut / 130 * 100, 0, 100) + '%';
    q('health-bar').style.width = S.health + '%';
    q('water-text').textContent =
      S.water < 15 ? 'からから' : S.water < 35 ? 'すこし かわいた'
        : S.water <= 88 ? 'ちょうどいい' : S.water <= 100 ? 'たっぷり' : 'あげすぎ';
    q('sun-text').textContent =
      S.sun < 12 ? 'くらい' : S.sun < 40 ? 'たりない'
        : S.sun <= 88 ? 'ちょうどいい' : S.sun <= 95 ? 'まぶしい' : 'あつすぎ';
    q('nut-text').textContent =
      S.nut < 12 ? 'からっぽ' : S.nut < 30 ? 'すこし たりない'
        : S.nut <= 95 ? 'ちょうどいい' : S.nut <= 105 ? 'たっぷり' : 'おおすぎ';
    q('health-text').textContent =
      S.health >= 70 ? 'げんき' : S.health >= 40 ? 'ふつう'
        : S.health >= 15 ? 'よわってる' : 'ぐったり';

    const sunny = S.place === 'sun';
    const pl = q('place-label');
    pl.textContent = sunny ? '☀️ ひなた' : '🌥 ひかげ';
    pl.className = 'ms-place-chip ' + (sunny ? 'ms-sunny' : 'ms-shady');
    q('btn-place').innerHTML = (sunny ? '🌥' : '☀️')
      + '<span class="ms-btn-label">' + (sunny ? 'ひかげへ' : 'ひなたへ') + '</span>';

    q('day-label').textContent = S.day + '日目';
    q('rec-total').textContent = String(S.totalHarvest);
    q('rec-brix').textContent = S.bestBrix > 0 ? S.bestBrix.toFixed(1) : '-';
    q('rec-round').textContent = String(S.round);

    const hb = q<HTMLButtonElement>('btn-harvest');
    hb.disabled = !S.ready;
    hb.classList.toggle('ms-blink', S.ready);
    q<HTMLButtonElement>('btn-water').disabled = S.ready;

    const wait = Math.ceil((S.fertReady - Date.now()) / 1000);
    const fb = q<HTMLButtonElement>('btn-fert');
    fb.disabled = S.ready || wait > 0;
    fb.innerHTML = '🌱<span class="ms-btn-label">'
      + (!S.ready && wait > 0 ? 'あと ' + wait + 'びょう' : 'ひりょう') + '</span>';
  }

  /* ===================== つづきから ===================== */
  function adopt(raw: unknown): void {
    if (typeof raw !== 'object' || raw === null) return;
    const p = raw as Partial<State>;
    const num = (v: unknown, lo: number, hi: number, or: number): number =>
      typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : or;
    S.day = num(p.day, 1, 1e9, 1);
    S.tick = num(p.tick, 0, 1e12, 0);
    S.growth = num(p.growth, 0, 100, 0);
    S.water = num(p.water, 0, 120, 60);
    S.sun = num(p.sun, 0, 100, 50);
    S.nut = num(p.nut, 0, 130, 55);
    S.health = num(p.health, 0, 100, 100);
    S.place = p.place === 'shade' ? 'shade' : 'sun';
    S.bug = p.bug === true;
    S.bugAge = num(p.bugAge, 0, 1e6, 0);
    S.goodTicks = num(p.goodTicks, 0, 1e12, 0);
    S.careTicks = num(p.careTicks, 0, 1e12, 0);
    S.ready = p.ready === true || S.growth >= 100;
    // まちじかんは ときこく。とじて いる あいだに すぎて いれば すぐ あげられる。
    S.fertReady = num(p.fertReady, 0, Date.now() + FERT_WAIT, 0);
    S.totalHarvest = num(p.totalHarvest, 0, 1e12, 0);
    S.bestBrix = num(p.bestBrix, 0, 12, 0);
    S.round = num(p.round, 0, 1e12, 0);
  }

  /* ===================== つなぎこみ ===================== */
  q('btn-water').addEventListener('click', doWater);
  q('btn-fert').addEventListener('click', doFertilizer);
  q('btn-place').addEventListener('click', togglePlace);
  q('btn-harvest').addEventListener('click', harvest);
  q('btn-next').addEventListener('click', nextSeed);
  q('btn-reset').addEventListener('click', resetAll);
  q('seed-doc').addEventListener('click', openManual);
  q('btn-howto').addEventListener('click', openManual);
  q('btn-doc-harvest').addEventListener('click', openManual);
  (root.querySelector('[data-btn-manual-close]') as HTMLElement).addEventListener('click', closeManual);

  // せつめいしょの もくじ。href で とばすと あそびば ごと うごくので、じぶんで うごかす。
  sheet.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('[data-goto]') as HTMLElement | null;
    if (!a) return;
    e.preventDefault();
    const to = root.querySelector('[data-' + a.dataset['goto'] + ']');
    if (to) to.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') closeManual();
  };
  document.addEventListener('keydown', onKey);

  setMessage('つちに たねを うえたよ。みずを あげてね。');
  render();

  void (async () => {
    const res = await ctx.save.load();
    if (disposed) return;
    if (!res.ok) {
      ctx.setStatus('つづきの データを よめなかったので、あたらしく はじめます');
    } else if (res.state) {
      try {
        adopt(JSON.parse(res.state));
        setMessage('おかえり！ つづきから そだてよう。');
      } catch {
        ctx.setStatus('つづきの データが こわれていたので、あたらしく はじめます');
      }
    }
    startedAt = Date.now();
    render();
    tickTimer = window.setInterval(tick, TICK_MS);
  })();

  return () => {
    disposed = true;
    if (tickTimer) window.clearInterval(tickTimer);
    for (const id of timers) window.clearTimeout(id);
    timers.clear();
    document.removeEventListener('keydown', onKey);
    host.replaceChildren();
  };
};
