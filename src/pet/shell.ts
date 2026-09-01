// ペットの外枠（見た目と、置き場所の組み立て）。
//
// 元は Tailwind の CDN を読んでいた。当てていたクラスは数が知れているので、ここに CSS として
// 書き出してある。組み立てた HTML の中でも同じクラス名を使うので、名前は元のまま残した。

export const PET_CSS = `
.pet{position:absolute;inset:0;overflow-y:auto;background:linear-gradient(#1e3a8a,#0f172a);
  color:#1f2937;-webkit-user-select:none;user-select:none;touch-action:manipulation;
  font-family:'Hiragino Maru Gothic ProN','Arial Rounded MT Bold',Arial,sans-serif}
.pet .app{max-width:480px;margin:0 auto;padding:8px 10px 24px;box-sizing:border-box}
.pet .panel{background:#fffdf7;border:4px solid #78350f;border-radius:18px;
  box-shadow:0 8px 0 rgba(0,0,0,.35)}
.pet canvas{display:block;width:100%;border-radius:12px;background:#bae6fd}
.pet .bar-outer{background:#e5e7eb;border:2px solid #6b7280;border-radius:999px;height:14px;overflow:hidden}
.pet .bar-inner{height:100%;width:0%;transition:width .3s linear}
.pet .game-btn{background-color:#f59e0b;color:#fff;padding:.6rem .2rem;
  font-size:clamp(.72rem,3.1vw,.95rem);line-height:1.25;border-bottom:4px solid #b45309;
  border-radius:.75rem;font-weight:700;cursor:pointer;transition:all .1s;text-align:center;
  text-shadow:1px 1px 2px rgba(0,0,0,.3)}
.pet .game-btn:active{transform:translateY(2px);border-bottom-width:2px}
.pet .game-btn.blue{background-color:#3b82f6;border-bottom-color:#1d4ed8}
.pet .game-btn.green{background-color:#10b981;border-bottom-color:#047857}
.pet .game-btn.purple{background-color:#8b5cf6;border-bottom-color:#6d28d9}
.pet .game-btn.pink{background-color:#ec4899;border-bottom-color:#be185d}
.pet .game-btn.gray{background-color:#64748b;border-bottom-color:#334155}
.pet .game-btn.disabled{opacity:.45;pointer-events:none}
.pet .game-btn.view-off{filter:grayscale(.65);opacity:.5}
.pet #log{height:74px;overflow:hidden;font-size:.8rem;line-height:1.5}
.pet #modal-back{position:absolute;inset:0;background:rgba(0,0,0,.65);display:none;
  align-items:center;justify-content:center;z-index:50;padding:16px}
.pet #modal{max-height:84vh;overflow-y:auto;background:#fffdf7;border:5px solid #78350f;
  border-radius:20px;padding:18px;width:100%;max-width:400px;text-align:center;
  box-shadow:0 10px 30px rgba(0,0,0,.6);box-sizing:border-box}
.pet #mini-track{position:relative;height:34px;background:#e2e8f0;border:3px solid #334155;
  border-radius:8px;overflow:hidden}
.pet #mini-zone{position:absolute;top:0;bottom:0;left:40%;width:20%;background:#fde68a;
  border-left:2px dashed #f59e0b;border-right:2px dashed #f59e0b}
.pet #mini-perfect{position:absolute;top:0;bottom:0;left:47%;width:6%;background:#fca5a5}
.pet #mini-marker{position:absolute;top:-3px;width:6px;height:40px;background:#dc2626;margin-left:-3px}
.pet .stat-label{font-size:.7rem;font-weight:700}

/* もとは Tailwind で当てていた分。名前はそのまま残してある。 */
.pet .p-3{padding:.75rem}.pet .p-2{padding:.5rem}
.pet .mb-2{margin-bottom:.5rem}.pet .mb-1{margin-bottom:.25rem}.pet .mb-4{margin-bottom:1rem}
.pet .mt-1{margin-top:.25rem}.pet .mt-2{margin-top:.5rem}.pet .mt-3{margin-top:.75rem}
.pet .px-1{padding-left:.25rem;padding-right:.25rem}
.pet .flex{display:flex}.pet .justify-between{justify-content:space-between}
.pet .items-center{align-items:center}
.pet .grid{display:grid}
.pet .grid-cols-1{grid-template-columns:repeat(1,minmax(0,1fr))}
.pet .grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.pet .grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.pet .grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}
.pet .gap-1{gap:.25rem}.pet .gap-2{gap:.5rem}.pet .gap-3{gap:.75rem}
.pet .gap-x-3{column-gap:.75rem}.pet .gap-y-1{row-gap:.25rem}
.pet .font-bold{font-weight:700}
.pet .text-lg{font-size:1.125rem}.pet .text-sm{font-size:.875rem}.pet .text-xs{font-size:.75rem}
.pet .text-amber-700{color:#b45309}.pet .text-gray-600{color:#4b5563}.pet .text-gray-400{color:#9ca3af}
.pet .text-center{text-align:center}.pet .text-left{text-align:left}
.pet .w-full{width:100%}
`;

/**
 * 置き場所を組み立てる。元の #app の中身をそのまま持ってきてあり、id も変えていない
 * （8,000行ある側が id で引くので、ここを変えると全部の引き先が変わる）。
 *
 * onclick は文字列のまま残す。mount のあいだだけ立つ __pet ごしに呼ぶ。
 */
export const buildPetMarkup = (): HTMLElement => {
  const wrap = document.createElement('div');
  wrap.className = 'pet';
  wrap.innerHTML = `
<div class="app">
  <div class="panel p-3 mb-2">
    <div class="flex justify-between items-center mb-2">
      <div class="font-bold text-lg" id="pet-name">たまご</div>
      <div class="text-sm font-bold text-amber-700" id="coin-view">🪙 0</div>
    </div>
    <canvas id="stage"></canvas>
    <div class="grid grid-cols-4 gap-1 mt-2">
      <div class="game-btn green" id="btn-view-out" onclick="__pet.setView('out')">🌳 そと</div>
      <div class="game-btn" id="btn-view-park" style="background:#65a30d;border-bottom-color:#3f6212" onclick="__pet.setView('park')">🏞 こうえん</div>
      <div class="game-btn" id="btn-view-shop" style="background:#e11d48;border-bottom-color:#9f1239" onclick="__pet.setView('shop')">🏪 おみせ</div>
      <div class="game-btn" id="btn-view-school" style="background:#2563eb;border-bottom-color:#1e40af" onclick="__pet.setView('school')">🏫 がっこう</div>
    </div>
    <div class="grid grid-cols-4 gap-1 mt-1">
      <div class="game-btn" id="btn-view-bank" style="background:#ca8a04;border-bottom-color:#854d0e" onclick="__pet.setView('bank')">🏦 ぎんこう</div>
      <div class="game-btn" id="btn-view-living" style="background:#a16207;border-bottom-color:#713f12" onclick="__pet.setView('living')">🛋 リビング</div>
      <div class="game-btn" id="btn-view-kitchen" style="background:#0d9488;border-bottom-color:#115e59" onclick="__pet.setView('kitchen')">🍳 キッチン</div>
      <div class="game-btn purple" id="btn-view-bed" onclick="__pet.setView('bed')">🛏 2かい</div>
    </div>
    <div class="grid grid-cols-1 gap-1 mt-1">
      <div class="game-btn" id="btn-map" style="background:#0891b2;border-bottom-color:#155e75" onclick="__pet.openMap()">🗺 おでかけマップ（ぜんぶの ばしょ）</div>
    </div>
    <div class="flex justify-between text-xs font-bold mt-2 text-gray-600">
      <span id="stage-view">たまご</span>
      <span id="age-view">0日目</span>
      <span id="power-view">ちから 0</span>
    </div>
  </div>

  <div class="panel p-3 mb-2">
    <div class="grid grid-cols-2 gap-x-3 gap-y-1">
      <div><div class="stat-label">🍖 おなか <span id="hunger-num"></span></div>
        <div class="bar-outer"><div class="bar-inner" id="hunger-bar" style="background:#f97316"></div></div></div>
      <div><div class="stat-label">💛 きげん <span id="happy-num"></span></div>
        <div class="bar-outer"><div class="bar-inner" id="happy-bar" style="background:#eab308"></div></div></div>
      <div><div class="stat-label">🫧 きれい <span id="clean-num"></span></div>
        <div class="bar-outer"><div class="bar-inner" id="clean-bar" style="background:#38bdf8"></div></div></div>
      <div><div class="stat-label">⚡ げんき <span id="energy-num"></span></div>
        <div class="bar-outer"><div class="bar-inner" id="energy-bar" style="background:#22c55e"></div></div></div>
      <div><div class="stat-label">❤️ たいりょく <span id="hp-num"></span></div>
        <div class="bar-outer"><div class="bar-inner" id="hp-bar" style="background:#ef4444"></div></div></div>
      <div><div class="stat-label">⭐ Lv <span id="level-num">1</span></div>
        <div class="bar-outer"><div class="bar-inner" id="exp-bar" style="background:#a855f7"></div></div></div>
    </div>
  </div>

  <div class="panel p-2 mb-2"><div id="log" class="px-1"></div></div>

  <div class="grid grid-cols-4 gap-2 mb-2">
    <div class="game-btn" id="btn-feed" onclick="__pet.openFoodMenu()">🍚 ごはん</div>
    <div class="game-btn blue" id="btn-play" onclick="__pet.openPlayMenu()">🎾 あそぶ</div>
    <div class="game-btn purple" id="btn-train" onclick="__pet.doTrain()">💪 きたえる</div>
    <div class="game-btn" id="btn-job" style="background:#d97706;border-bottom-color:#92400e" onclick="__pet.openJobMenu()">💼 おしごと</div>
    <div class="game-btn green" id="btn-bath" onclick="__pet.doBath()">🛁 おふろ</div>
    <div class="game-btn pink" id="btn-clean" onclick="__pet.doCleanPoop()">🧹 そうじ</div>
    <div class="game-btn gray" id="btn-sleep" onclick="__pet.toggleSleep()">💤 ねる</div>
    <div class="game-btn" id="btn-med" style="background:#14b8a6;border-bottom-color:#0f766e" onclick="__pet.useMedicine()">💊 くすり</div>
  </div>
  <div class="grid grid-cols-3 gap-2 mb-2" id="row-extra">
    <div class="game-btn blue" id="btn-talk" style="display:none" onclick="__pet.openTalk()">🤖 ロボット</div>
    <div class="game-btn pink" id="btn-bank" onclick="__pet.openBank()">🐷 ちょきん</div>
    <div class="game-btn" id="btn-friend" style="background:#f59e0b;border-bottom-color:#b45309" onclick="__pet.openFriends()">👫 ともだち</div>
  </div>
  <div class="grid grid-cols-3 gap-2">
    <div class="game-btn gray" id="btn-status" onclick="__pet.openStatus()">📖 ずかん</div>
    <div class="game-btn" id="btn-report" style="background:#7c3aed;border-bottom-color:#5b21b6" onclick="__pet.openReport()">📊 レポート</div>
    <div class="game-btn" id="btn-shop" style="background:#0ea5e9;border-bottom-color:#0369a1" onclick="__pet.openShop()">🛒 ショップ</div>
  </div>
</div>
<div id="modal-back"><div id="modal"></div></div>`;
  return wrap;
};
