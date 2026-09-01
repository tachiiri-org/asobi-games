// ミニトマト（ぷるるんミニトマト栽培記 100マルチメガファーム版）。
// tennis-game リポジトリの minitomato.html を移した。
//
// 遊びの中身（成長式・糖度・天気・ショップの値段・自動化アイテムの効き方・1秒ごとの進み方）は
// 変えていない。変えたのは5つ。
//  - Tailwind の CDN と lucide をやめた。アイコンは絵文字にし、クラスは CSS にしてある。
//  - 保存先を localStorage からテナントの置き場（ctx.save）に移した。読めなかった時に
//    書かない決まりは save.ts 側にある。1秒ごとの saveGame() をそのまま HTTP にすると
//    毎秒書くことになるので、束ねるのも save.ts の役目。
//  - onclick="plantSeedHere('x')" のような window 直付けの関数をリスナに付け替えた。
//  - お知らせ（トースト）を document.body ではなく置き場所の中に入れる。
//  - 収穫のたびに onFinish を呼ぶ。累計の収穫数がこのゲームの点になる。

import type { GameMount } from './types';

type Shape = 'circle' | 'heart' | 'star' | 'crown' | 'diamond' | 'cat' | 'watermelon' | 'phoenix';
type Weather = 'sunny' | 'cloudy' | 'rainy';

type Breed = {
  readonly id: string; readonly name: string; readonly desc: string;
  readonly price: number; readonly baseBrix: number; readonly maxBrix: number;
  readonly coinMultiplier: number; readonly color: string; readonly shape: Shape;
};

type Plant = {
  breed: string; growth: number; stage: number; water: number; nutrition: number;
  health: number; pruningDone: number; pestRemoved: number; brixBonus: number;
  wakiMeSpawned: boolean; pestSpawned: boolean;
};

type Upgrades = Record<string, boolean>;

type State = {
  coins: number;
  vaultCoins: number;
  weather: Weather;
  activePlantIndex: number;
  plants: (Plant | null)[];
  upgrades: Upgrades;
  unlockedBreeds: string[];
  stats: { totalHarvest: number; maxSweetness: number; totalCoins: number; careCount: number };
};

const MAX_PLANTS = 100;

const STAGES = [
  { name: '種まき完了', emoji: '🌱', minGrowth: 0, helper: '土が乾いたら「水やり」をして、芽が出るのをワクワクしながら待ちましょう！' },
  { name: 'ふたば', emoji: '🌱', minGrowth: 15, helper: '可愛いふたばが出てきました！水と栄養をバランス良くあげてね。' },
  { name: '本葉・急成長', emoji: '🌿', minGrowth: 35, helper: '茎が伸びてきました！「わき芽」や「アブラムシ(🐛)」が出たらタップして摘み取ってね！' },
  { name: '黄色い花が満開', emoji: '🌼', minGrowth: 60, helper: 'お花が咲きました！この時期に栄養をたっぷり与えると、とても甘い実ができます。' },
  { name: '青い実が結実', emoji: '🟢', minGrowth: 80, helper: 'ちいさな青い実ができました！赤く色づくまで大切に見守りましょう。' },
  { name: '収穫期（完熟！）', emoji: '🍅', minGrowth: 100, helper: '完熟しました！実をタップ、または「収穫する」でお金をたくさんゲット！' },
] as const;

const BREEDS: Record<string, Breed> = {
  standard: { id: 'standard', name: 'プチレッド', desc: '育てやすい基本 of 基本赤いミニトマト。初心者に最適。', price: 0, baseBrix: 5.5, maxBrix: 8.0, coinMultiplier: 1.0, color: '#ef4444', shape: 'circle' },
  yellow: { id: 'yellow', name: 'イエローピコ', desc: 'フルーティーで酸味が少なく大人気！', price: 150, baseBrix: 7.0, maxBrix: 9.5, coinMultiplier: 1.3, color: '#eab308', shape: 'circle' },
  sweet: { id: 'sweet', name: '極甘シュガーゴールド', desc: '糖度10％を超えることもある、まるで果物なトマト。', price: 350, baseBrix: 9.0, maxBrix: 12.5, coinMultiplier: 1.8, color: '#f97316', shape: 'circle' },
  heart: { id: 'heart', name: 'ハッピートマト（ハート）', desc: '愛らしいハートの実がなる。甘くてハッピー！', price: 550, baseBrix: 10.5, maxBrix: 14.0, coinMultiplier: 2.2, color: '#ec4899', shape: 'heart' },
  cat: { id: 'cat', name: 'キャットミント（ねこ型）', desc: 'ねこの耳が付いたピンク色のキュートなトマト。', price: 700, baseBrix: 11.5, maxBrix: 15.0, coinMultiplier: 2.5, color: '#f472b6', shape: 'cat' },
  cosmo: { id: 'cosmo', name: 'コスモスター（星型）', desc: '星形をしたきらめくイエロートマト。夜空の味がするかも？', price: 800, baseBrix: 11.0, maxBrix: 15.5, coinMultiplier: 2.7, color: '#fbbf24', shape: 'star' },
  chocolate: { id: 'chocolate', name: 'ショコラミニ', desc: 'ビターチョコレート色の深いコクがある大人なトマト。', price: 900, baseBrix: 12.0, maxBrix: 16.0, coinMultiplier: 3.0, color: '#78350f', shape: 'circle' },
  watermelon: { id: 'watermelon', name: 'スイカミニ', desc: 'ちいさなスイカ模様！中身は最高にフルーティーな極甘種。', price: 1000, baseBrix: 12.5, maxBrix: 16.5, coinMultiplier: 3.2, color: '#16a34a', shape: 'watermelon' },
  purple: { id: 'purple', name: 'マジカルパープル', desc: '神秘のパープル。美しさと健康、甘さを兼ね備える。', price: 1100, baseBrix: 13.0, maxBrix: 17.0, coinMultiplier: 3.5, color: '#8b5cf6', shape: 'circle' },
  snow: { id: 'snow', name: 'スノージュエル', desc: '真っ白に輝く雪のようなミニトマト。超一級の価値。', price: 1300, baseBrix: 13.5, maxBrix: 18.0, coinMultiplier: 3.8, color: '#e2e8f0', shape: 'circle' },
  crown: { id: 'crown', name: 'クラウンゴールド', desc: '王冠の形をしたトマト。糖度・価格ともに最上級。', price: 1500, baseBrix: 14.0, maxBrix: 19.5, coinMultiplier: 4.5, color: '#f59e0b', shape: 'crown' },
  rainbow: { id: 'rainbow', name: 'レインボーミラクル', desc: '七色に光り輝く伝説のミニトマト。夢の栽培を目指そう！', price: 2000, baseBrix: 15.0, maxBrix: 21.0, coinMultiplier: 5.5, color: 'url(#rainbow-grad)', shape: 'star' },
  diamond: { id: 'diamond', name: 'コズミックダイヤモンド', desc: '【超大富豪】ダイヤモンド型をした宇宙ブルーのトマト。一気に1万円以上のコインを稼ぎ出す。', price: 3000, baseBrix: 25.0, maxBrix: 35.0, coinMultiplier: 12.0, color: '#38bdf8', shape: 'diamond' },
  phoenix: { id: 'phoenix', name: 'ソルフェニックス（不死鳥）', desc: '【絶対無敵】絶対に枯れない太陽の不死鳥トマト。驚異的な糖度と15倍 of コイン価格！', price: 5000, baseBrix: 30.0, maxBrix: 45.0, coinMultiplier: 15.0, color: '#f97316', shape: 'phoenix' },
};

// アイコンは lucide をやめて絵文字にした。名前は元の icon 名をそのまま残してある
// （どのアイテムがどの絵だったかを追えるように）。
const SHOP_ITEMS: readonly { id: string; name: string; desc: string; price: number; icon: string }[] = [
  { id: 'autoWater', name: '自動散水器', desc: '水分が30%以下になると自動で20%水を補給。', price: 180, icon: '💧' },
  { id: 'greenhouse', name: 'プチビニールハウス', desc: '全プランターの成長速度が常に1.5倍。', price: 320, icon: '🏠' },
  { id: 'premiumFertilizer', name: '金の有機肥料', desc: '肥料効率+35%、さらに使うたび糖度+0.1アップ。', price: 280, icon: '✨' },
  { id: 'pestGuard', name: 'てんとう虫ハウス', desc: '害虫発生率半減＆アブラムシを時々自動退治。', price: 400, icon: '🐞' },
  { id: 'bgmSpeaker', name: 'おんがくスピーカー', desc: 'クラシック音楽で、トマトの体力減少スピードを30%カット。', price: 450, icon: '🎵' },
  { id: 'goldenShears', name: '黄金のはさみ', desc: 'わき芽かきの糖度ボーナスがなんと2倍に！', price: 500, icon: '✂️' },
  { id: 'autoFertilizer', name: '自動施肥機（オートフィーダー）', desc: '栄養が30%以下になると自動で肥料補給。', price: 550, icon: '🤖' },
  { id: 'growthElixir', name: 'ミラクル成長エキス', desc: '全体のトマトの基本成長速度が常時1.2倍。', price: 600, icon: '⚗️' },
  { id: 'weatherShield', name: 'お天気ドーム', desc: '天候による土の「激しい乾燥や湿気」の変化を優しく緩和。', price: 650, icon: '☂️' },
  { id: 'nutritionShield', name: '栄養活力シールド', desc: '土の栄養が減るスピードを30%カットし負担を軽減。', price: 700, icon: '🛡️' },
  { id: 'beeNest', name: 'ハチさんの巣箱', desc: '受粉お手伝い！開花期の成長スピードがなんと3倍に！', price: 750, icon: '🐝' },
  { id: 'luckyClover', name: '幸運のクローバー', desc: '収穫時に手に入るコインが常に1.2倍にアップ！', price: 800, icon: '🍀' },
  { id: 'decoSticker', name: 'ぷるるんデコステッカー', desc: 'お世話をするたびに体力が+5%追加回復します。', price: 900, icon: '🎨' },
  { id: 'ledLight', name: 'おてんと様LEDライト', desc: '曇りや雨でも常に晴れと同じ成長率をキープ。', price: 1000, icon: '💡' },
  { id: 'superNutrition', name: '栄養限界突破アンプル', desc: '栄養上限が120%になり、与えすぎペナルティが完全消失。', price: 1100, icon: '🧪' },
  { id: 'bearPlush', name: 'くまさんのぬいぐるみ', desc: 'お世話を見守る！1株からの収穫数が7個(通常5)にアップ！', price: 1300, icon: '🧸' },
  { id: 'magicWateringCan', name: 'まほうのじょうろ', desc: '水やり時に15%の確率で一気に成長が10%進む。', price: 1600, icon: '🪄' },
  { id: 'bulkWaterItem', name: '全自動一括スプリンクラー', desc: 'ファーム内のすべての苗にまとめて一度に水やりができるボタンが解放！', price: 1500, icon: '🚿' },
  { id: 'bulkFertilizerItem', name: '一括ドローン施肥機', desc: 'ファーム内のすべての苗にまとめて一度に肥料を配れるボタンが解放！', price: 2000, icon: '🛸' },
  { id: 'autoHarvestBot', name: '全自動収穫ロボット', desc: '【最強アイテム】100株のどこかでトマトが完熟した瞬間、自動で即時に収穫してコインを回収！', price: 4000, icon: '🤖' },
];

const WEATHER: Record<Weather, { name: string; icon: string; cls: string; waterDrain: number; growthGain: number }> = {
  sunny: { name: '晴れ', icon: '☀️', cls: 'w-sunny', waterDrain: 3.5, growthGain: 1.2 },
  cloudy: { name: '曇り', icon: '☁️', cls: 'w-cloudy', waterDrain: 1.8, growthGain: 0.8 },
  rainy: { name: '雨', icon: '🌧️', cls: 'w-rainy', waterDrain: -2.0, growthGain: 0.5 },
};

const GRADIENT_BREEDS = new Set(['rainbow', 'diamond', 'phoenix']);

const newPlant = (breed: string): Plant => ({
  breed, growth: 0, stage: 0, water: 50, nutrition: 50, health: 100,
  pruningDone: 0, pestRemoved: 0, brixBonus: 0, wakiMeSpawned: false, pestSpawned: false,
});

const newState = (): State => ({
  coins: 500,
  vaultCoins: 0,
  weather: 'sunny',
  activePlantIndex: 0,
  plants: [newPlant('standard')],
  upgrades: Object.fromEntries(SHOP_ITEMS.map((i) => [i.id, false])),
  unlockedBreeds: ['standard'],
  stats: { totalHarvest: 0, maxSweetness: 0, totalCoins: 500, careCount: 0 },
});

const CSS = `
.mt{position:absolute;inset:0;overflow-y:auto;background:#f7fee7;color:#1e293b;
  font:14px/1.6 "Zen Maru Gothic","Kiwi Maru",system-ui,-apple-system,sans-serif;
  display:flex;flex-direction:column;box-sizing:border-box}
.mt-head{background:linear-gradient(to right,#ef4444,#f59e0b);color:#fff;padding:12px 16px;
  box-shadow:0 4px 6px -1px rgba(0,0,0,.1);position:sticky;top:0;z-index:10}
.mt-head .in{max-width:80rem;margin:0 auto;display:flex;justify-content:space-between;
  align-items:center;gap:8px;flex-wrap:wrap}
.mt-head h1{font-size:18px;font-weight:900;margin:0;display:flex;align-items:center;gap:8px}
.mt-head .tag{font-size:11px;background:rgba(255,255,255,.2);padding:2px 8px;border-radius:999px;
  font-weight:400}
.mt-chips{display:flex;align-items:center;gap:8px}
.mt-chip{background:rgba(255,255,255,.2);padding:6px 12px;border-radius:999px;display:flex;
  align-items:center;gap:6px;font-size:14px;font-weight:700}
.mt-chip.vault{background:rgba(69,26,3,.4);color:#fde68a}
.mt-icon-btn{background:none;border:0;color:#fff;padding:8px;border-radius:50%;cursor:pointer;
  font-size:16px;line-height:1}
.mt-icon-btn:hover{background:rgba(255,255,255,.1)}
.mt-main{flex:1;max-width:80rem;width:100%;margin:0 auto;padding:16px;box-sizing:border-box;
  display:grid;grid-template-columns:1fr;gap:16px}
@media(min-width:900px){.mt-main{grid-template-columns:1fr 1fr}}
.mt-card{background:#fff;border-radius:1.5rem;padding:16px;box-shadow:0 4px 6px -1px rgba(0,0,0,.08);
  border:1px solid #ecfccb;box-sizing:border-box}
.mt-card h3{font-size:14px;font-weight:900;margin:0 0 8px;display:flex;justify-content:space-between;
  align-items:center;gap:8px}
.mt-pill{font-size:12px;background:#d1fae5;color:#065f46;padding:4px 10px;border-radius:999px;font-weight:700}
.mt-pill.hot{background:#fee2e2;color:#dc2626}
.mt-vault-row{display:flex;gap:6px;margin-top:8px}
.mt-vault-row button{flex:1;color:#fff;font-weight:700;padding:6px 12px;border:0;border-radius:.75rem;
  font-size:12px;cursor:pointer;font-family:inherit}
.mt-v1{background:#d97706}.mt-v2{background:#b45309}.mt-v3{background:#059669}
.mt-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;max-height:350px;overflow-y:auto;
  padding:4px;background:rgba(247,254,231,.5);border-radius:1rem;border:1px solid #ecfccb}
@media(min-width:640px){.mt-grid{grid-template-columns:repeat(10,1fr)}}
.mt-slot{padding:4px;border-radius:.5rem;border:1px solid #e2e8f0;background:#fff;text-align:center;
  cursor:pointer;display:flex;flex-direction:column;justify-content:space-between;height:48px;
  box-sizing:border-box}
.mt-slot.on{border-color:#ef4444;background:#fef2f2;box-shadow:0 0 0 1px #fca5a5}
.mt-slot .no{font-size:8px;color:#94a3b8;font-weight:700}
.mt-slot .lamp{width:6px;height:6px;border-radius:50%;display:inline-block}
.mt-slot .top{display:flex;justify-content:space-between;align-items:center;padding:0 2px}
.mt-slot .em{font-size:14px;line-height:1}
.mt-slot .gauge{width:100%;background:#f1f5f9;height:2px;border-radius:999px;overflow:hidden}
.mt-slot .gauge i{display:block;height:100%;background:#84cc16}
.lamp-ok{background:#10b981}.lamp-dead{background:#94a3b8}
.lamp-ripe{background:#f43f5e;animation:mt-pulse 1.5s infinite}
.lamp-warn{background:#fbbf24}
@keyframes mt-pulse{0%,100%{opacity:1}50%{opacity:.4}}
.mt-bulk{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.mt-bulk button{color:#fff;font-weight:700;padding:8px 12px;border:0;border-radius:.75rem;
  font-size:12px;cursor:pointer;font-family:inherit}
.mt-bulk button:disabled{background:#e2e8f0;color:#94a3b8;cursor:default}
.mt-bw{background:#0ea5e9}.mt-bf{background:#f59e0b}
.mt-visual{background:linear-gradient(to bottom,#e0f2fe,#f0f9ff,#ecfdf5);border-radius:1.5rem;
  padding:16px;border:2px solid #d9f99d;position:relative;display:flex;flex-direction:column;
  justify-content:space-between;min-height:340px;box-sizing:border-box;transition:box-shadow .3s}
.mt-visual.barrier{border-color:#38bdf8;animation:mt-barrier 1.5s infinite alternate}
@keyframes mt-barrier{0%{box-shadow:0 0 10px rgba(14,165,233,.4)}100%{box-shadow:0 0 25px rgba(14,165,233,.8)}}
.mt-badge{position:absolute;top:52px;left:16px;z-index:20;background:#0ea5e9;color:#fff;
  font-size:10px;font-weight:900;padding:4px 10px;border-radius:999px;box-shadow:0 4px 6px rgba(0,0,0,.2)}
.mt-vtop{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px}
.mt-stage-area{position:relative;flex:1;min-height:220px}
.mt-stage-area svg{width:100%;height:100%;filter:drop-shadow(0 4px 3px rgba(0,0,0,.07))}
.mt-inter{position:absolute;inset:0;z-index:20}
.mt-pop{position:absolute;inset:0;pointer-events:none;z-index:30}
.mt-waki{position:absolute;width:48px;height:48px;background:rgba(163,230,53,.9);
  border:1px solid #bef264;border-radius:50%;display:flex;flex-direction:column;align-items:center;
  justify-content:center;cursor:pointer;box-shadow:0 4px 6px rgba(0,0,0,.15);font-size:9px;
  font-weight:700;color:#065f46;z-index:30;animation:mt-bounce 2s infinite}
.mt-pest{position:absolute;width:40px;height:40px;background:#fef9c3;border:2px solid #facc15;
  border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;
  box-shadow:0 4px 6px rgba(0,0,0,.15);font-size:14px;z-index:30;animation:mt-wiggle .5s infinite ease-in-out}
.mt-harvest-btn{position:absolute;background:#f43f5e;color:#fff;font-weight:900;padding:8px 16px;
  border:0;border-radius:1rem;box-shadow:0 4px 10px rgba(0,0,0,.2);z-index:30;cursor:pointer;
  font-size:12px;animation:mt-pulse 1.5s infinite;font-family:inherit}
@keyframes mt-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes mt-wiggle{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
.mt-effect{position:absolute;font-size:12px;font-weight:900;color:#3b82f6;background:rgba(255,255,255,.95);
  padding:4px 10px;border-radius:999px;box-shadow:0 2px 4px rgba(0,0,0,.1);border:1px solid #bfdbfe;
  pointer-events:none;z-index:40;animation:mt-bounce 2s infinite}
.mt-helper{background:#fff;border-radius:1rem;padding:8px 12px;display:flex;align-items:center;gap:8px;
  margin-top:8px;font-size:11px;font-weight:700;color:#475569}
.mt-gauges{margin-top:12px;display:flex;flex-direction:column;gap:8px}
.mt-g .lbl{display:flex;justify-content:space-between;font-size:11px;font-weight:700;margin-bottom:2px}
.mt-g .bar{position:relative;background:#f1f5f9;height:8px;border-radius:999px;overflow:hidden}
.mt-g .bar i{position:absolute;left:0;top:0;height:100%;transition:width .3s;display:block}
.b-water{background:#3b82f6}.b-nut{background:#f59e0b}.b-health{background:#f43f5e}
.b-growth{background:linear-gradient(to right,#a3e635,#22c55e)}
.mt-tip{font-size:9px;color:#94a3b8;margin:2px 0 0}
.mt-acts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.mt-acts button{color:#fff;font-weight:700;padding:8px;border:0;border-radius:.75rem;cursor:pointer;
  font-size:13px;font-family:inherit;box-shadow:0 2px 4px rgba(0,0,0,.1)}
.mt-acts button:disabled{background:#e2e8f0;color:#94a3b8;cursor:default}
.mt-aw{background:#3b82f6}.mt-af{background:#f59e0b}
.mt-tabs{display:flex;border-bottom:1px solid #e2e8f0}
.mt-tabs button{flex:1;padding:12px 16px;text-align:center;font-weight:700;font-size:13px;
  background:none;border:0;border-bottom:2px solid transparent;color:#94a3b8;cursor:pointer;
  font-family:inherit}
.mt-tabs button.on{color:#ef4444;border-bottom-color:#ef4444}
.mt-panel{padding:12px 0}
.mt-sec h4{font-size:11px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;
  margin:0 0 8px}
.mt-list{display:grid;grid-template-columns:1fr;gap:8px}
@media(min-width:640px){.mt-list{grid-template-columns:1fr 1fr}}
.mt-item{padding:12px;border-radius:.75rem;border:1px solid #e2e8f0;background:#fff;
  display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 1px 2px rgba(0,0,0,.05)}
.mt-item.bought{border-color:#a7f3d0;background:rgba(236,253,245,.3)}
.mt-item.locked{background:#f8fafc;border-color:#e2e8f0;opacity:.6}
.mt-item .nm{font-weight:900;font-size:12px}
.mt-item .brix{font-size:9px;background:#f1f5f9;color:#64748b;padding:2px 4px;border-radius:4px;font-weight:700}
.mt-item .ds{font-size:10px;color:#94a3b8;margin:4px 0 0;line-height:1.35;height:2.7em;overflow:hidden}
.mt-item .row{display:flex;justify-content:space-between;align-items:flex-start;gap:6px}
.mt-item button{margin-top:8px;width:100%;color:#fff;font-weight:700;padding:5px 12px;border:0;
  border-radius:.5rem;font-size:12px;cursor:pointer;font-family:inherit}
.mt-plant{background:#84cc16}.mt-buy{background:#f59e0b}.mt-up{background:#6366f1}
.mt-done{font-size:12px;font-weight:700;color:#059669;margin-top:8px;text-align:center;display:block}
.mt-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.mt-stat{background:#f8fafc;border-radius:1rem;padding:12px;text-align:center}
.mt-stat .k{font-size:10px;color:#94a3b8;font-weight:700;display:block}
.mt-stat .v{font-size:22px;font-weight:900}
.mt-modal{position:absolute;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;
  justify-content:center;padding:16px;z-index:50;overflow-y:auto}
.mt-modal-in{background:#fff;border-radius:1.5rem;max-width:28rem;width:100%;box-sizing:border-box;
  box-shadow:0 25px 50px -12px rgba(0,0,0,.25);padding:20px}
.mt-modal-in h3{font-size:18px;font-weight:900;margin:0 0 4px}
.mt-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;
  border-bottom:1px dashed #e2e8f0}
.mt-toast{position:absolute;bottom:24px;left:50%;transform:translate(-50%,40px);z-index:60;
  padding:10px 20px;border-radius:1rem;box-shadow:0 10px 15px -3px rgba(0,0,0,.2);color:#fff;
  font-weight:700;font-size:12px;opacity:0;transition:all .3s;pointer-events:none;max-width:90%;
  text-align:center}
.mt-toast.on{transform:translate(-50%,0);opacity:1}
.t-success{background:#10b981}.t-error{background:#ef4444}.t-info{background:#334155}
.w-sunny{background:#fef3c7;color:#b45309;border:1px solid #fde68a}
.w-cloudy{background:#f1f5f9;color:#334155;border:1px solid #e2e8f0}
.w-rainy{background:#dbeafe;color:#1d4ed8;border:1px solid #bfdbfe}
.mt-weather{padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700}
.mt-hidden{display:none}
`;

export const mountMinitomato: GameMount = (host, ctx) => {
  const style = document.createElement('style');
  style.textContent = CSS;

  const page = document.createElement('div');
  page.className = 'mt';
  page.innerHTML = `
<header class="mt-head"><div class="in">
  <h1>🍒 ぷるるんミニトマト栽培記 <span class="tag">100マルチメガファーム版</span></h1>
  <div class="mt-chips">
    <div class="mt-chip" title="手持ちコイン">👛 <span data-coin>0</span> コイン</div>
    <div class="mt-chip vault" title="絶対に減らない金庫のコイン">🏦 <span data-vault>0</span> 金庫</div>
    <div class="mt-weather" data-weather></div>
    <button class="mt-icon-btn" data-howto title="遊び方">❓</button>
  </div>
</div></header>
<div class="mt-main">
  <div>
    <div class="mt-card">
      <h3>🏦 ちょきんばこ（金庫）<span class="mt-pill">絶対に減らない</span></h3>
      <div class="mt-vault-row">
        <button class="mt-v1" data-vault-half>半分あずける</button>
        <button class="mt-v2" data-vault-all>ぜんぶあずける</button>
        <button class="mt-v3" data-vault-take>ぜんぶ引き出す</button>
      </div>
    </div>
    <div class="mt-card" style="margin-top:16px">
      <h3>🌱 ファーム <span class="mt-pill" data-usage>1/100 栽培中</span></h3>
      <div class="mt-grid" data-grid></div>
      <div style="display:flex;justify-content:flex-end;margin-top:8px">
        <span class="mt-pill hot mt-hidden" data-robot>🤖 収穫ロボ稼働中</span>
      </div>
      <div class="mt-bulk">
        <button class="mt-bw" data-bulk-water disabled>🚿 一括水やり</button>
        <button class="mt-bf" data-bulk-fert disabled>🛸 一括肥料</button>
      </div>
    </div>
  </div>
  <div>
    <div class="mt-visual" data-visual>
      <div class="mt-badge mt-hidden" data-shield>🛡️ おやすみバリア発動中</div>
      <div class="mt-vtop">
        <span data-breed style="font-weight:800">プチレッド</span>
        <span data-brix style="font-weight:900;color:#ef4444">0.0 Brix</span>
      </div>
      <div class="mt-stage-area">
        <div class="mt-inter" data-inter></div>
        <svg viewBox="0 0 200 250"><g data-plant></g></svg>
        <div class="mt-pop" data-popup></div>
      </div>
      <div class="mt-helper"><span data-stage-emoji>🌱</span><span><b data-stage-name>種まき完了</b> — <span data-helper></span></span></div>
      <div class="mt-gauges">
        <div class="mt-g"><div class="lbl"><span>💧 水分</span><span data-water-status></span></div><div class="bar"><i class="b-water" data-water-bar></i></div></div>
        <div class="mt-g"><div class="lbl"><span>✨ 栄養</span><span data-nut-status></span></div><div class="bar"><i class="b-nut" data-nut-bar></i></div><p class="mt-tip" data-nut-tip></p></div>
        <div class="mt-g"><div class="lbl"><span>❤️ 体力</span><span data-health-status></span></div><div class="bar"><i class="b-health" data-health-bar></i></div></div>
        <div class="mt-g"><div class="lbl"><span>成長率</span><span data-growth-pct>0%</span></div><div class="bar"><i class="b-growth" data-growth-bar></i></div></div>
      </div>
      <div class="mt-acts">
        <button class="mt-aw" data-water>💦 水やり</button>
        <button class="mt-af" data-fert>✨ 肥料やり</button>
      </div>
    </div>
    <div class="mt-card" style="margin-top:16px;padding-top:0">
      <div class="mt-tabs">
        <button class="on" data-tab="shop">🛍️ ショップ</button>
        <button data-tab="records">📖 図鑑</button>
        <button data-tab="stats">📊 成績</button>
      </div>
      <div class="mt-panel" data-panel="shop">
        <div class="mt-sec"><h4>🌱 品種の種</h4><div class="mt-list" data-seeds></div></div>
        <div class="mt-sec" style="margin-top:16px"><h4>🛠️ 設備アップグレード</h4><div class="mt-list" data-upgrades></div></div>
      </div>
      <div class="mt-panel mt-hidden" data-panel="records"><div class="mt-list" data-records></div></div>
      <div class="mt-panel mt-hidden" data-panel="stats"><div class="mt-stats">
        <div class="mt-stat"><span class="k">トータル収穫数</span><span class="v" style="color:#ef4444" data-st-harvest>0</span></div>
        <div class="mt-stat"><span class="k">最高糖度記録</span><span class="v" style="color:#f59e0b" data-st-brix>0.0</span></div>
        <div class="mt-stat"><span class="k">累計獲得コイン</span><span class="v" style="color:#d97706" data-st-coins>0</span></div>
        <div class="mt-stat"><span class="k">お世話回数</span><span class="v" style="color:#059669" data-st-care>0</span></div>
      </div></div>
    </div>
  </div>
</div>
<div class="mt-modal mt-hidden" data-modal="howto"><div class="mt-modal-in">
  <h3>❓ 遊び方ガイド</h3>
  <p style="font-size:12px"><b style="color:#ef4444">🌱 1. 基本のお世話</b><br>左側のファーム（最大100スロット）から好きなトマト苗を選び、水と栄養を適正レベルにキープしてお世話します。</p>
  <p style="font-size:12px"><b style="color:#f59e0b">☀️ 2. 一括お世話マシン</b><br>ショップで「自動一括スプリンクラー」や「一括ドローン施肥機」を購入すると、100個すべてのプランターに一度にお世話ができます。</p>
  <p style="font-size:12px"><b style="color:#14b8a6">🤖 3. 自動収穫ロボット</b><br>「全自動収穫ロボット」をアンロックすると、完熟したトマトを自動で収穫してお金に変えてくれます。</p>
  <p style="font-size:12px"><b style="color:#6366f1">🛍️ 4. 宇宙トマト</b><br>コインが貯まったら高額の種を購入！1株で1万コインを突破できます。</p>
  <button class="mt-v3" style="width:100%;color:#fff;font-weight:700;padding:10px;border:0;border-radius:.75rem;cursor:pointer;font-family:inherit;margin-top:8px" data-close-howto>とじる</button>
</div></div>
<div class="mt-modal mt-hidden" data-modal="harvest"><div class="mt-modal-in">
  <div style="text-align:center"><div style="font-size:40px">🍅</div>
    <h3>トマトを収穫しました！</h3>
    <p style="font-size:12px;color:#94a3b8;font-weight:700;margin:4px 0 12px" data-h-breed></p></div>
  <div class="mt-row"><span style="font-weight:700;color:#64748b">収穫数</span><span style="font-weight:900" data-h-qty></span></div>
  <div class="mt-row"><span style="font-weight:700;color:#64748b">平均糖度 (Brix)</span><span style="font-weight:900;color:#ef4444" data-h-brix></span></div>
  <div class="mt-row" style="border:0"><span style="font-weight:700;color:#64748b">獲得コイン</span><span style="font-weight:900;color:#f59e0b" data-h-earn></span></div>
  <p style="font-size:12px;font-weight:700;padding:12px;border-radius:.75rem;margin:12px 0" data-h-comment></p>
  <button style="width:100%;background:linear-gradient(to right,#ef4444,#f59e0b);color:#fff;font-weight:900;padding:12px;border:0;border-radius:1rem;cursor:pointer;font-family:inherit" data-next-plant>プランターを整理する</button>
</div></div>
<div class="mt-toast" data-toast></div>`;
  host.append(style, page);

  const q = <T extends HTMLElement>(sel: string): T => page.querySelector(sel) as T;
  const qa = (sel: string): HTMLElement[] => Array.from(page.querySelectorAll(sel));

  let state = newState();
  let disposed = false;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const later = (fn: () => void, ms: number): void => {
    const id = setTimeout(() => { timers.delete(id); if (!disposed) fn(); }, ms);
    timers.add(id);
  };

  const persist = (): void => ctx.save.put(state);

  const activePlant = (): Plant | null => state.plants[state.activePlantIndex] ?? null;

  const maxNutrition = (): number => (state.upgrades.superNutrition ? 120 : 100);

  const brixOf = (plant: Plant): number => {
    if (plant.stage < 4) return 0.0;
    const breed = BREEDS[plant.breed] ?? BREEDS.standard;
    const pruningMultiplier = state.upgrades.goldenShears ? 0.8 : 0.4;
    let bonus = plant.pruningDone * pruningMultiplier + plant.pestRemoved * 0.2;
    if (plant.nutrition >= 50 && plant.nutrition <= (state.upgrades.superNutrition ? 120 : 85)) bonus += 0.5;
    return Math.min(breed.baseBrix + bonus + plant.brixBonus, breed.maxBrix);
  };

  // ── お知らせ
  const toast = q('[data-toast]');
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  const notify = (message: string, type: 'success' | 'error' | 'info' = 'info'): void => {
    toast.className = `mt-toast on t-${type}`;
    toast.textContent = message;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.className = `mt-toast t-${type}`; }, 2500);
  };

  const showEffect = (text: string): void => {
    const el = document.createElement('div');
    el.className = 'mt-effect';
    el.textContent = text;
    el.style.left = `${Math.random() * 50 + 25}%`;
    el.style.top = `${Math.random() * 30 + 30}%`;
    q('[data-popup]').appendChild(el);
    later(() => el.remove(), 1200);
  };

  // ── 実の形
  const fruitSvg = (breed: Breed, cx: number, cy: number, rx: number, ry: number): string => {
    const c = breed.color;
    if (breed.shape === 'heart') {
      return `<g transform="translate(${cx}, ${cy - 2}) scale(1.1)"><path d="M 0 -3 C -5 -10 -11 -6 -11 0 C -11 6 -5 10 0 14 C 5 10 11 6 11 0 C 11 -6 5 -10 0 -3" fill="${c}" /><ellipse cx="-3" cy="-2" rx="2" ry="1" fill="#fff" opacity="0.6" transform="rotate(-30 -3 -2)" /></g>`;
    }
    if (breed.shape === 'star') {
      return `<g transform="translate(${cx}, ${cy})"><polygon points="0,-12 3,-3 12,-3 5,2 8,11 0,6 -8,11 -5,2 -12,-3 -3,-3" fill="${c}" /><circle cx="-2" cy="-2" r="2" fill="#fff" opacity="0.8" /></g>`;
    }
    if (breed.shape === 'crown') {
      return `<g transform="translate(${cx}, ${cy}) scale(0.9)"><path d="M -12 8 L -15 -8 L -6 -2 L 0 -12 L 6 -2 L 15 -8 L 12 8 Z" fill="${c}" /><ellipse cx="0" cy="8" rx="12" ry="4" fill="#d97706" opacity="0.5" /><circle cx="-15" cy="-8" r="2.5" fill="#fef08a" /><circle cx="0" cy="-12" r="2.5" fill="#fef08a" /><circle cx="15" cy="-8" r="2.5" fill="#fef08a" /><circle cx="-3" cy="2" r="1.5" fill="#fff" opacity="0.8" /></g>`;
    }
    if (breed.shape === 'diamond') {
      return `<g transform="translate(${cx}, ${cy}) scale(0.9)"><polygon points="0,-12 11,-2 0,12 -11,-2" fill="${c}" stroke="#e0f2fe" stroke-width="1" /><polygon points="0,-6 5,-2 0,6 -5,-2" fill="#fff" opacity="0.5" /><circle cx="-3" cy="-4" r="1.5" fill="#fff" opacity="0.9" /></g>`;
    }
    if (breed.shape === 'cat') {
      return `<g transform="translate(${cx}, ${cy}) scale(1.05)"><polygon points="-8,-6 -12,-15 -2,-8" fill="${c}" /><polygon points="8,-6 12,-15 2,-8" fill="${c}" /><circle cx="0" cy="0" r="9" fill="${c}" /><circle cx="-3" cy="-3" r="2" fill="#fff" opacity="0.6" /></g>`;
    }
    if (breed.shape === 'watermelon') {
      return `<g transform="translate(${cx}, ${cy})"><circle cx="0" cy="0" r="9.5" fill="${c}" /><path d="M -9 0 Q -3 -5 0 -9" stroke="#14532d" stroke-width="1.5" fill="none" /><path d="M -5 7 Q 0 0 5 -7" stroke="#14532d" stroke-width="1.5" fill="none" /><path d="M 0 9 Q 3 5 9 0" stroke="#14532d" stroke-width="1.5" fill="none" /><circle cx="-3" cy="-3" r="1.5" fill="#fff" opacity="0.6" /></g>`;
    }
    if (breed.shape === 'phoenix') {
      return `<g transform="translate(${cx}, ${cy}) scale(1.1)"><path d="M -12 5 Q -18 -8 -5 -15 Q 0 -5 -12 5" fill="${c}" /><path d="M 12 5 Q 18 -8 5 -15 Q 0 -5 12 5" fill="${c}" /><path d="M 0 10 Q -8 -3 0 -18 Q 8 -3 0 10" fill="#ef4444" /><path d="M 0 8 Q -4 0 0 -10 Q 4 0 0 8" fill="#fbbf24" /></g>`;
    }
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}" /><ellipse cx="${cx - 3}" cy="${cy - 3}" rx="2" ry="1" fill="#fff" opacity="0.6" />`;
  };

  const drawPlant = (): void => {
    const group = q('[data-plant]');
    const plant = activePlant();
    if (!plant) {
      group.innerHTML = '<ellipse cx="100" cy="225" rx="42" ry="8" fill="#5c2d10" />';
      return;
    }
    const breed = BREEDS[plant.breed] ?? BREEDS.standard;
    const leaf = plant.health < 30 ? '#a3a3a3' : plant.health < 60 ? '#84cc16' : '#22c55e';
    const stem = plant.health < 30 ? '#78716c' : '#15803d';

    const defs = '<defs><linearGradient id="rainbow-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ff007f" /><stop offset="30%" stop-color="#ffae00" /><stop offset="60%" stop-color="#00e1ff" /><stop offset="100%" stop-color="#7000ff" /></linearGradient></defs>';
    const clover = state.upgrades.luckyClover ? '<g transform="translate(155, 230) scale(0.8)"><path d="M 0 0 C -5 -5 -10 0 -5 5 C 0 10 5 5 0 0" fill="#22c55e" /><path d="M 0 0 C -5 5 0 10 5 5 C 10 0 5 -5 0 0" fill="#22c55e" /><path d="M 0 0 C 5 5 10 0 5 -5 C 0 -10 -5 -5 0 0" fill="#22c55e" /><path d="M 0 0 C 5 -5 0 -10 -5 -5 C -10 0 -5 5 0 0" fill="#22c55e" /><path d="M 0 5 Q 5 15 2 20" stroke="#16a34a" stroke-width="2" fill="none" /></g>' : '';
    const bee = state.upgrades.beeNest ? '<g transform="translate(30, 160) scale(0.7)"><rect x="-10" y="30" width="20" height="40" fill="#b45309" /><path d="M -20 10 Q -25 -20 0 -25 Q 25 -20 20 10 Q 20 30 0 35 Q -20 30 -20 10 Z" fill="#f59e0b" stroke="#d97706" stroke-width="2" /><circle cx="0" cy="5" r="5" fill="#78350f" /></g>' : '';
    const dome = state.upgrades.weatherShield ? '<path d="M 30 220 A 80 80 0 0 1 170 220" fill="rgba(14, 165, 233, 0.05)" stroke="rgba(14, 165, 233, 0.35)" stroke-width="2" stroke-dasharray="4 4" />' : '';
    const bear = state.upgrades.bearPlush ? '<g transform="translate(45, 226) scale(0.85)"><circle cx="0" cy="10" r="10" fill="#7c2d12" /><circle cx="0" cy="-2" r="8" fill="#7c2d12" /><circle cx="-6" cy="-8" r="3" fill="#7c2d12" /><circle cx="6" cy="-8" r="3" fill="#7c2d12" /></g>' : '';
    const led = state.upgrades.ledLight ? '<g transform="translate(100, 20)"><rect x="-35" y="-5" width="70" height="8" rx="2" fill="#475569" /><polygon points="-30,3 -50,220 50,220 30,3" fill="rgba(253, 224, 71, 0.12)" /></g>' : '';
    const soil = '<ellipse cx="100" cy="225" rx="42" ry="8" fill="#78350f" />';
    const shield = plant.health <= 15 && breed.id !== 'phoenix'
      ? '<circle cx="100" cy="150" r="75" fill="rgba(14, 165, 233, 0.08)" stroke="#0ea5e9" stroke-width="2.5" stroke-dasharray="6 4" />'
      : '';
    const base = defs + dome + soil + clover + bee + bear;

    let body = '';
    if (plant.stage === 0) {
      body = '<ellipse cx="100" cy="222" rx="4" ry="2.5" fill="#f59e0b" transform="rotate(-15 100 222)" />';
    } else if (plant.stage === 1) {
      body = `<path d="M 100 225 Q 100 210 98 200" stroke="${stem}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M 98 200 Q 85 195 80 200 Q 88 205 98 200" fill="${leaf}" /><path d="M 98 200 Q 111 195 116 200 Q 108 205 98 200" fill="${leaf}" />`;
    } else if (plant.stage === 2) {
      body = `<path d="M 100 225 Q 103 180 97 145" stroke="${stem}" stroke-width="5" fill="none" stroke-linecap="round"/><g transform="translate(100, 200)"><path d="M 0 0 Q -25 -10 -35 0 Q -20 15 0 0" fill="${leaf}" /></g><g transform="translate(101, 175)"><path d="M 0 0 Q 25 -15 35 -5 Q 20 15 0 0" fill="${leaf}" /></g>`;
    } else if (plant.stage === 3) {
      body = `<path d="M 100 225 Q 104 170 95 100" stroke="${stem}" stroke-width="6" fill="none" stroke-linecap="round"/><g transform="translate(101, 190)"><path d="M 0 0 Q -35 -5 -45 10 Q -25 25 0 0" fill="${leaf}" /></g><g transform="translate(102, 160)"><path d="M 0 0 Q 35 -15 45 -5 Q 25 20 0 0" fill="${leaf}" /></g><g transform="translate(85, 120)"><circle cx="0" cy="0" r="6" fill="#facc15" /><circle cx="0" cy="0" r="3" fill="#ca8a04" /></g><g transform="translate(115, 140)"><circle cx="0" cy="0" r="6" fill="#facc15" /><circle cx="0" cy="0" r="3" fill="#ca8a04" /></g>`;
    } else if (plant.stage === 4) {
      body = `<line x1="105" y1="225" x2="105" y2="50" stroke="#047857" stroke-width="4" stroke-linecap="round" /><path d="M 100 225 Q 104 160 96 70" stroke="${stem}" stroke-width="7" fill="none" stroke-linecap="round"/><g transform="translate(101, 180)"><path d="M 0 0 Q -40 -10 -50 10 Q -30 30 0 0" fill="${leaf}" /></g><g transform="translate(102, 150)"><path d="M 0 0 Q 40 -20 50 -5 Q 30 25 0 0" fill="${leaf}" /></g><g transform="translate(80, 130)"><ellipse cx="0" cy="0" rx="9" ry="8.5" fill="#84cc16" /></g><g transform="translate(120, 110)"><ellipse cx="0" cy="0" rx="10" ry="9" fill="#4ade80" /></g>`;
    } else {
      body = `<line x1="105" y1="225" x2="105" y2="50" stroke="#047857" stroke-width="4" stroke-linecap="round" /><path d="M 100 225 Q 104 160 96 70" stroke="${stem}" stroke-width="7" fill="none" stroke-linecap="round"/><g transform="translate(101, 180)"><path d="M 0 0 Q -40 -10 -50 10 Q -30 30 0 0" fill="${leaf}" /></g><g transform="translate(102, 150)"><path d="M 0 0 Q 40 -20 50 -5 Q 30 25 0 0" fill="${leaf}" /></g>`
        + `<g transform="translate(80, 130)">${fruitSvg(breed, 0, 0, 9, 8.5)}</g>`
        + `<g transform="translate(70, 140)">${fruitSvg(breed, 0, 0, 8, 7.5)}</g>`
        + `<g transform="translate(120, 110)">${fruitSvg(breed, 0, 0, 10, 9)}</g>`
        + `<g transform="translate(132, 120)">${fruitSvg(breed, 0, 0, 8, 7.5)}</g>`
        + `<g transform="translate(100, 100)">${fruitSvg(breed, 0, 0, 9, 8.5)}</g>`;
    }
    group.innerHTML = base + body + led + shield;
  };

  // ── 収穫
  const harvestValue = (plant: Plant): { count: number; brix: number; earnings: number } => {
    const breed = BREEDS[plant.breed] ?? BREEDS.standard;
    const count = state.upgrades.bearPlush ? 7 : 5;
    const brix = brixOf(plant);
    let earnings = Math.floor(brix * breed.coinMultiplier * count * 8);
    if (state.upgrades.luckyClover) earnings = Math.floor(earnings * 1.2);
    return { count, brix, earnings };
  };

  const applyHarvest = (plant: Plant): { count: number; brix: number; earnings: number } => {
    const r = harvestValue(plant);
    state.coins += r.earnings;
    state.stats.totalHarvest += r.count;
    if (r.brix > state.stats.maxSweetness) state.stats.maxSweetness = r.brix;
    state.stats.totalCoins += r.earnings;
    // 累計の収穫数がこのゲームの点。育て続けるゲームなので、走りの終わりは収穫のたびとする。
    ctx.onFinish(state.stats.totalHarvest, startedAt);
    return r;
  };

  const harvest = (): void => {
    const plant = activePlant();
    if (!plant || plant.stage !== 5) return;
    const breed = BREEDS[plant.breed] ?? BREEDS.standard;
    const r = applyHarvest(plant);

    q('[data-h-breed]').textContent = `品種：${breed.name}`;
    q('[data-h-qty]').textContent = `${r.count} 個`;
    q('[data-h-brix]').textContent = `${r.brix.toFixed(1)} Brix`;
    q('[data-h-earn]').textContent = state.upgrades.luckyClover
      ? `+${r.earnings}（クローバー+20%）`
      : `+${r.earnings}`;

    const comment = q('[data-h-comment]');
    if (r.earnings >= 10000) {
      comment.textContent = '💎 1万コイン以上の超・ウルトラダイヤモンド収穫達成！大農園の新しい伝説がここに誕生しました！';
      comment.style.cssText = 'font-size:12px;font-weight:700;padding:12px;border-radius:.75rem;margin:12px 0;color:#0369a1;background:#f0f9ff;border:1px solid #e0f2fe';
    } else if (r.brix >= breed.maxBrix * 0.95) {
      comment.textContent = '🏆 奇跡の糖度！最高に甘くてみずみずしい究極品質のトマトです！';
      comment.style.cssText = 'font-size:12px;font-weight:700;padding:12px;border-radius:.75rem;margin:12px 0;color:#047857;background:#ecfdf5;border:1px solid #d1fae5';
    } else {
      comment.textContent = '😊 収穫おめでとうございます！美味しいミニトマトにファームのみんなも大喜びです！';
      comment.style.cssText = 'font-size:12px;font-weight:700;padding:12px;border-radius:.75rem;margin:12px 0;color:#334155;background:#f8fafc;border:1px solid #e2e8f0';
    }

    q('[data-modal="harvest"]').classList.remove('mt-hidden');
    persist();
  };

  const runAutoHarvestBot = (): void => {
    if (!state.upgrades.autoHarvestBot) return;
    let harvested = 0;
    let total = 0;
    state.plants.forEach((plant, index) => {
      if (!plant || plant.stage !== 5) return;
      const r = applyHarvest(plant);
      state.plants[index] = null;
      harvested += r.count;
      total += r.earnings;
    });
    if (harvested === 0) return;
    notify(`🤖 収穫ロボ稼働！${harvested}個のミニトマトを自動収穫し、+${total}コインを獲得しました！`, 'success');
    persist();
    updateUI();
  };

  // ── 障害物
  const renderInteractive = (plant: Plant | null): void => {
    const layer = q('[data-inter]');
    layer.replaceChildren();
    if (!plant) return;

    if (plant.wakiMeSpawned && plant.stage >= 2 && plant.stage < 5) {
      const waki = document.createElement('div');
      waki.className = 'mt-waki';
      waki.style.left = '40%';
      waki.style.top = '45%';
      waki.innerHTML = '<span>🌱</span><span>わき芽</span>';
      waki.addEventListener('click', (e) => {
        e.stopPropagation();
        plant.wakiMeSpawned = false;
        plant.pruningDone++;
        const added = state.upgrades.goldenShears ? 0.6 : 0.3;
        plant.brixBonus += added;
        showEffect(`✂️ 摘み取り成功！ (糖度+${added})`);
        persist();
        updateUI();
      });
      layer.appendChild(waki);
    }

    if (plant.pestSpawned && plant.stage >= 2 && plant.stage < 5) {
      const pest = document.createElement('div');
      pest.className = 'mt-pest';
      pest.style.left = '55%';
      pest.style.top = '35%';
      pest.textContent = '🐛';
      pest.addEventListener('click', (e) => {
        e.stopPropagation();
        plant.pestSpawned = false;
        plant.pestRemoved++;
        plant.health = Math.min(100, plant.health + 15);
        showEffect('💥 害虫駆除！');
        persist();
        updateUI();
      });
      layer.appendChild(pest);
    }

    if (plant.stage === 5) {
      const btn = document.createElement('button');
      btn.className = 'mt-harvest-btn';
      btn.style.left = '32%';
      btn.style.top = '40%';
      btn.textContent = '🍅 収穫する！';
      btn.addEventListener('click', harvest);
      layer.appendChild(btn);
    }
  };

  // ── 一覧
  const renderFarmGrid = (): void => {
    const grid = q('[data-grid]');
    grid.replaceChildren();
    for (let i = 0; i < MAX_PLANTS; i++) {
      const plant = state.plants[i] ?? null;
      const card = document.createElement('div');
      card.className = `mt-slot${i === state.activePlantIndex ? ' on' : ''}`;
      card.addEventListener('click', () => {
        state.activePlantIndex = i;
        updateUI();
      });

      const top = document.createElement('div');
      top.className = 'top';
      const no = document.createElement('span');
      no.className = 'no';
      no.textContent = String(i + 1);
      top.appendChild(no);

      const em = document.createElement('div');
      em.className = 'em';
      const gauge = document.createElement('div');
      gauge.className = 'gauge';
      const fill = document.createElement('i');
      gauge.appendChild(fill);

      if (plant) {
        const isRipe = plant.stage === 5;
        const isDead = plant.health <= 0;
        const lamp = document.createElement('span');
        lamp.className = 'lamp ' + (isDead ? 'lamp-dead'
          : isRipe ? 'lamp-ripe'
          : (plant.water < 30 || plant.water > 80 || plant.health < 40) ? 'lamp-warn' : 'lamp-ok');
        top.appendChild(lamp);
        em.textContent = isDead ? '💀' : isRipe ? '🍅' : STAGES[plant.stage].emoji;
        fill.style.width = `${plant.growth}%`;
      } else {
        em.textContent = '➕';
        em.style.color = '#cbd5e1';
        fill.style.width = '0%';
      }
      card.append(top, em, gauge);
      grid.appendChild(card);
    }

    const count = state.plants.filter((p) => p !== null).length;
    q('[data-usage]').textContent = `${count}/${MAX_PLANTS} 栽培中`;
    (q('[data-bulk-water]') as HTMLButtonElement).disabled = !state.upgrades.bulkWaterItem;
    (q('[data-bulk-fert]') as HTMLButtonElement).disabled = !state.upgrades.bulkFertilizerItem;
    q('[data-robot]').classList.toggle('mt-hidden', !state.upgrades.autoHarvestBot);
  };

  const breedNameStyle = (breed: Breed): string => {
    if (breed.id === 'rainbow') return 'background-image:linear-gradient(to right,#ff007f,#ffae00,#00e1ff);-webkit-background-clip:text;background-clip:text;color:transparent';
    if (breed.id === 'diamond') return 'background-image:linear-gradient(to right,#38bdf8,#3b82f6,#6366f1);-webkit-background-clip:text;background-clip:text;color:transparent';
    if (breed.id === 'phoenix') return 'background-image:linear-gradient(to right,#f97316,#ef4444,#facc15);-webkit-background-clip:text;background-clip:text;color:transparent';
    return `color:${breed.color}`;
  };

  const plantSeedHere = (breedId: string): void => {
    if (state.plants[state.activePlantIndex]) {
      notify('❌ 現在のプランターにはすでにトマトが植えられています。空き鉢を選択してください！', 'error');
      return;
    }
    state.plants[state.activePlantIndex] = newPlant(breedId);
    notify(`🌱 ${BREEDS[breedId].name}の種を${state.activePlantIndex + 1}号鉢に植えました！`, 'success');
    persist();
    updateUI();
  };

  const buyBreed = (breedId: string, price: number): void => {
    if (state.coins < price) {
      notify('❌ 手持ちのコインが足りません。貯金箱（金庫）から引き出すか、トマトを収穫してください！', 'error');
      return;
    }
    state.coins -= price;
    state.unlockedBreeds.push(breedId);
    notify(`🎉 ${BREEDS[breedId].name}の種がアンロックされました！`, 'success');
    persist();
    updateUI();
  };

  const buyUpgrade = (itemId: string): void => {
    const item = SHOP_ITEMS.find((i) => i.id === itemId);
    if (!item) return;
    if (state.coins < item.price) {
      notify('❌ 手持ちのコインが足りません。貯金箱（金庫）から引き出すか、トマトを収穫してください！', 'error');
      return;
    }
    state.coins -= item.price;
    state.upgrades[itemId] = true;
    notify(`🛠️ 「${item.name}」を導入しました！`, 'success');
    persist();
    updateUI();
  };

  const renderShop = (): void => {
    const seeds = q('[data-seeds]');
    seeds.replaceChildren();
    for (const breed of Object.values(BREEDS)) {
      const unlocked = state.unlockedBreeds.includes(breed.id);
      const card = document.createElement('div');
      card.className = 'mt-item';
      const head = document.createElement('div');
      const row = document.createElement('div');
      row.className = 'row';
      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.setAttribute('style', breedNameStyle(breed));
      nm.textContent = breed.name;
      const brix = document.createElement('span');
      brix.className = 'brix';
      brix.textContent = `糖度: ~${breed.maxBrix} Brix`;
      row.append(nm, brix);
      const ds = document.createElement('p');
      ds.className = 'ds';
      ds.textContent = breed.desc;
      head.append(row, ds);

      const btn = document.createElement('button');
      if (unlocked) {
        btn.className = 'mt-plant';
        btn.textContent = 'この種をここに植える';
        btn.addEventListener('click', () => plantSeedHere(breed.id));
      } else {
        btn.className = 'mt-buy';
        btn.textContent = `🪙 ${breed.price}で購入`;
        btn.addEventListener('click', () => buyBreed(breed.id, breed.price));
      }
      card.append(head, btn);
      seeds.appendChild(card);
    }

    const ups = q('[data-upgrades]');
    ups.replaceChildren();
    for (const item of SHOP_ITEMS) {
      const bought = !!state.upgrades[item.id];
      const card = document.createElement('div');
      card.className = `mt-item${bought ? ' bought' : ''}`;
      const head = document.createElement('div');
      const nm = document.createElement('div');
      nm.className = 'nm';
      nm.textContent = `${item.icon} ${item.name}`;
      const ds = document.createElement('p');
      ds.className = 'ds';
      ds.textContent = item.desc;
      head.append(nm, ds);
      card.appendChild(head);
      if (bought) {
        const done = document.createElement('span');
        done.className = 'mt-done';
        done.textContent = '✓ 導入済み';
        card.appendChild(done);
      } else {
        const btn = document.createElement('button');
        btn.className = 'mt-up';
        btn.textContent = `🪙 ${item.price}で購入`;
        btn.addEventListener('click', () => buyUpgrade(item.id));
        card.appendChild(btn);
      }
      ups.appendChild(card);
    }
  };

  const renderRecords = (): void => {
    const list = q('[data-records]');
    list.replaceChildren();
    for (const breed of Object.values(BREEDS)) {
      const unlocked = state.unlockedBreeds.includes(breed.id);
      const card = document.createElement('div');
      card.className = `mt-item${unlocked ? '' : ' locked'}`;
      const nm = document.createElement('div');
      nm.className = 'nm';
      if (unlocked) {
        nm.setAttribute('style', breedNameStyle(breed));
        nm.textContent = `🍅 ${breed.name}`;
        const ds = document.createElement('p');
        ds.className = 'ds';
        ds.textContent = breed.desc;
        card.append(nm, ds);
      } else {
        nm.style.color = '#94a3b8';
        nm.textContent = '🍅 ??? (未解放)';
        card.appendChild(nm);
      }
      list.appendChild(card);
    }
  };

  const setBar = (sel: string, pct: number): void => {
    q(sel).style.width = `${Math.max(0, Math.min(100, pct))}%`;
  };

  const setText = (sel: string, text: string, color?: string): void => {
    const el = q(sel);
    el.textContent = text;
    if (color) el.style.color = color;
  };

  const updateUI = (): void => {
    q('[data-coin]').textContent = String(Math.floor(state.coins));
    q('[data-vault]').textContent = String(Math.floor(state.vaultCoins));

    const w = WEATHER[state.weather];
    const weatherEl = q('[data-weather]');
    weatherEl.className = `mt-weather ${w.cls}`;
    weatherEl.textContent = `${w.icon} ${w.name}`;

    const plant = activePlant();
    const visual = q('[data-visual]');
    const shieldBadge = q('[data-shield]');
    const btnWater = q('[data-water]') as HTMLButtonElement;
    const btnFert = q('[data-fert]') as HTMLButtonElement;

    if (plant) {
      const breed = BREEDS[plant.breed] ?? BREEDS.standard;
      const breedEl = q('[data-breed]');
      breedEl.setAttribute('style', `font-weight:800;${breedNameStyle(breed)}`);
      breedEl.textContent = `${state.activePlantIndex + 1}号鉢: ${breed.name}`;

      const protecting = plant.health <= 15 && breed.id !== 'phoenix';
      shieldBadge.classList.toggle('mt-hidden', !protecting);
      visual.classList.toggle('barrier', protecting);

      setText('[data-brix]', `${brixOf(plant).toFixed(1)} Brix / 成長 ${Math.floor(plant.growth)}%`);
      setBar('[data-growth-bar]', plant.growth);
      q('[data-growth-pct]').textContent = `${Math.floor(plant.growth)}%`;

      setBar('[data-water-bar]', plant.water);
      if (plant.water <= 0) setText('[data-water-status]', 'カラカラ (0%)', '#ef4444');
      else if (plant.water < 40) setText('[data-water-status]', '乾燥気味', '#f59e0b');
      else if (plant.water <= 70) setText('[data-water-status]', 'ちょうどよい', '#10b981');
      else setText('[data-water-status]', '湿りすぎ', '#3b82f6');

      setBar('[data-nut-bar]', (plant.nutrition / maxNutrition()) * 100);
      q('[data-nut-tip]').textContent = state.upgrades.superNutrition
        ? '※アンプル効果により、どれだけ栄養をあげても過剰ペナルティはありません！'
        : '※50%以上に保つと成長にボーナス。肥料の与えすぎに注意！';
      if (plant.nutrition < 30) setText('[data-nut-status]', '栄養不足', '#f87171');
      else if (plant.nutrition <= 85 || state.upgrades.superNutrition) setText('[data-nut-status]', '栄養たっぷり', '#10b981');
      else setText('[data-nut-status]', '肥料過多', '#f59e0b');

      setBar('[data-health-bar]', plant.health);
      if (plant.health > 80) setText('[data-health-status]', '超元気！', '#10b981');
      else if (plant.health > 30) setText('[data-health-status]', '普通', '#475569');
      else if (plant.health > 0) setText('[data-health-status]', 'バリア保護中！', '#0ea5e9');
      else setText('[data-health-status]', '枯れた', '#94a3b8');

      btnWater.disabled = false;
      btnFert.disabled = false;

      const stage = STAGES[plant.stage];
      q('[data-stage-emoji]').textContent = stage.emoji;
      q('[data-stage-name]').textContent = stage.name;
      q('[data-helper]').textContent = stage.helper;
      renderInteractive(plant);
    } else {
      shieldBadge.classList.add('mt-hidden');
      visual.classList.remove('barrier');
      setText('[data-breed]', `${state.activePlantIndex + 1}号鉢: 空っぽ`, '#cbd5e1');
      setText('[data-brix]', '苗を植えてね！');
      setBar('[data-growth-bar]', 0);
      q('[data-growth-pct]').textContent = '0%';
      setBar('[data-water-bar]', 0);
      setText('[data-water-status]', 'なし');
      setBar('[data-nut-bar]', 0);
      setText('[data-nut-status]', 'なし');
      setBar('[data-health-bar]', 0);
      setText('[data-health-status]', 'なし');
      btnWater.disabled = true;
      btnFert.disabled = true;
      q('[data-stage-emoji]').textContent = '❌';
      q('[data-stage-name]').textContent = '苗がありません';
      q('[data-helper]').textContent = 'ショップからアンロック済みの「種」をえらんで購入すると、この鉢に直接植えることができます！';
      renderInteractive(null);
    }

    q('[data-st-harvest]').textContent = String(state.stats.totalHarvest);
    q('[data-st-brix]').textContent = state.stats.maxSweetness.toFixed(1);
    q('[data-st-coins]').textContent = String(Math.floor(state.stats.totalCoins));
    q('[data-st-care]').textContent = String(state.stats.careCount);

    renderFarmGrid();
    renderShop();
    renderRecords();
    drawPlant();
  };

  // ── 1秒ごとの進み
  const gameTick = (): void => {
    state.plants.forEach((plant, index) => {
      if (!plant || plant.health <= 0) return;
      const breed = BREEDS[plant.breed] ?? BREEDS.standard;
      if (breed.id === 'phoenix') plant.health = 100;

      const conf = WEATHER[state.weather];

      let drain = conf.waterDrain;
      if (state.upgrades.weatherShield) drain *= 0.7;
      plant.water = Math.max(0, Math.min(100, plant.water - drain));
      if (state.upgrades.autoWater && plant.water <= 30) plant.water = Math.min(100, plant.water + 20);

      if (plant.stage > 0 && plant.growth < 100) {
        plant.nutrition = Math.max(0, plant.nutrition - (state.upgrades.nutritionShield ? 0.56 : 0.8));
      }
      if (state.upgrades.autoFertilizer && plant.nutrition <= 30) {
        plant.nutrition = Math.min(maxNutrition(), plant.nutrition + 15);
      }

      if (breed.id !== 'phoenix') {
        let delta = 0;
        if (plant.water <= 0 || plant.water >= 95) delta -= 4;
        else if (plant.water < 30 || plant.water > 80) delta -= 1;
        else delta += 1;

        const overNutLimit = state.upgrades.superNutrition ? 125 : 90;
        if (plant.nutrition < 20 || plant.nutrition > overNutLimit) delta -= 2;
        else delta += 1;

        if (plant.pestSpawned) delta -= 3;
        if (breed.id === 'cat' && Math.random() < 0.25) delta += 2;
        if (state.upgrades.bgmSpeaker && delta < 0) delta = Math.floor(delta * 0.7);

        // おやすみ自動セーフバリア。体力は10より下がらない。
        const next = plant.health + delta;
        plant.health = next <= 10 ? 10 : Math.min(100, next);
      }

      if (plant.growth < 100 && plant.health > 20) {
        let speed = 0.8;
        let gain = conf.growthGain;
        if (state.upgrades.ledLight && (state.weather === 'cloudy' || state.weather === 'rainy')) gain = 1.2;
        speed *= gain;

        const idealMaxNut = state.upgrades.superNutrition ? 120 : 85;
        if (plant.nutrition >= 50 && plant.nutrition <= idealMaxNut) speed *= 1.3;
        else if (plant.nutrition < 30) speed *= 0.5;
        if (plant.water < 40 || plant.water > 75) speed *= 0.6;
        if (state.upgrades.greenhouse) speed *= 1.5;
        if (state.upgrades.growthElixir) speed *= 1.2;
        if (state.upgrades.beeNest && plant.stage === 3) speed *= 3.0;

        plant.growth = Math.min(100, plant.growth + speed);
      }

      const oldStage = plant.stage;
      for (let i = STAGES.length - 1; i >= 0; i--) {
        if (plant.growth >= STAGES[i].minGrowth) { plant.stage = i; break; }
      }
      if (plant.stage > oldStage && index === state.activePlantIndex) {
        notify(`🎉 ${index + 1}号鉢が「${STAGES[plant.stage].name}」に成長！`, 'success');
      }

      if (plant.stage >= 2 && plant.stage <= 4 && plant.health > 15) {
        const pestProb = state.upgrades.pestGuard ? 0.03 : 0.07;
        if (!plant.wakiMeSpawned && Math.random() < 0.08) plant.wakiMeSpawned = true;
        if (!plant.pestSpawned && Math.random() < pestProb) plant.pestSpawned = true;
      }
    });

    if (Math.random() < 0.1) {
      const weathers: Weather[] = ['sunny', 'cloudy', 'rainy'];
      state.weather = weathers[Math.floor(Math.random() * weathers.length)];
      notify(`☁️ 天気が「${WEATHER[state.weather].name}」に変わりました。`, 'info');
    }

    runAutoHarvestBot();
    persist();
    updateUI();
  };

  // ── 操作
  q('[data-vault-half]').addEventListener('click', () => {
    if (state.coins <= 0) { notify('❌ 預けるコインがありません。', 'error'); return; }
    const amount = Math.floor(state.coins / 2);
    state.coins -= amount;
    state.vaultCoins += amount;
    notify(`🏦 貯金箱に ${amount} コインを預けました！`, 'success');
    persist(); updateUI();
  });
  q('[data-vault-all]').addEventListener('click', () => {
    if (state.coins <= 0) { notify('❌ 預けるコインがありません。', 'error'); return; }
    const amount = state.coins;
    state.coins = 0;
    state.vaultCoins += amount;
    notify(`🏦 貯金箱に ${amount} コインすべて預けました！絶対に安全です！`, 'success');
    persist(); updateUI();
  });
  q('[data-vault-take]').addEventListener('click', () => {
    if (state.vaultCoins <= 0) { notify('❌ 貯金箱の中身は空っぽです。', 'error'); return; }
    const amount = state.vaultCoins;
    state.vaultCoins = 0;
    state.coins += amount;
    notify(`💰 貯金箱から ${amount} コインすべて引き出しました！`, 'success');
    persist(); updateUI();
  });

  q('[data-water]').addEventListener('click', () => {
    const plant = activePlant();
    if (!plant || plant.health <= 0) return;
    plant.water = Math.min(100, plant.water + 25);
    state.stats.careCount++;
    let magic = '';
    if (state.upgrades.magicWateringCan && Math.random() < 0.15) {
      plant.growth = Math.min(100, plant.growth + 10);
      magic = ' ✨まほうで一気に成長+10%！';
    }
    if (state.upgrades.decoSticker) {
      plant.health = Math.min(100, plant.health + 5);
      showEffect(`💦 水やり +25% (体力回復！)${magic}`);
    } else {
      showEffect(`💦 水やり +25%${magic}`);
    }
    persist(); updateUI();
  });

  q('[data-fert]').addEventListener('click', () => {
    const plant = activePlant();
    if (!plant || plant.health <= 0) return;
    const add = state.upgrades.premiumFertilizer ? 35 : 20;
    plant.nutrition = Math.min(maxNutrition(), plant.nutrition + add);
    if (state.upgrades.premiumFertilizer) plant.brixBonus += 0.1;
    const recovery = state.upgrades.decoSticker ? ' (体力回復！)' : '';
    if (state.upgrades.decoSticker) plant.health = Math.min(100, plant.health + 5);
    showEffect(state.upgrades.premiumFertilizer
      ? `✨ 金の有機肥料 +35% (糖度UP!)${recovery}`
      : `✨ 肥料 +20%${recovery}`);
    state.stats.careCount++;
    persist(); updateUI();
  });

  q('[data-bulk-water]').addEventListener('click', () => {
    let processed = 0;
    for (const plant of state.plants) {
      if (plant && plant.health > 0 && plant.water < 90) {
        plant.water = Math.min(100, plant.water + 30);
        processed++;
      }
    }
    if (processed === 0) { notify('乾燥しているトマトがありません。', 'info'); return; }
    notify(`💦 全自動一括スプリンクラー作動！${processed}株の苗に水やりをしました！`, 'success');
    state.stats.careCount++;
    persist(); updateUI();
  });

  q('[data-bulk-fert]').addEventListener('click', () => {
    let processed = 0;
    for (const plant of state.plants) {
      if (plant && plant.health > 0 && plant.nutrition < 80) {
        plant.nutrition = Math.min(maxNutrition(), plant.nutrition + 25);
        processed++;
      }
    }
    if (processed === 0) { notify('肥料を必要とするトマトがありません。', 'info'); return; }
    notify(`🛸 一括ドローン施肥機が発進！${processed}株の苗に栄養を配りました！`, 'success');
    state.stats.careCount++;
    persist(); updateUI();
  });

  for (const btn of qa('[data-tab]')) {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      for (const b of qa('[data-tab]')) b.classList.toggle('on', b === btn);
      for (const p of qa('[data-panel]')) p.classList.toggle('mt-hidden', p.dataset.panel !== tab);
    });
  }

  q('[data-howto]').addEventListener('click', () => q('[data-modal="howto"]').classList.remove('mt-hidden'));
  q('[data-close-howto]').addEventListener('click', () => q('[data-modal="howto"]').classList.add('mt-hidden'));
  q('[data-next-plant]').addEventListener('click', () => {
    q('[data-modal="harvest"]').classList.add('mt-hidden');
    state.plants[state.activePlantIndex] = null;
    persist();
    updateUI();
    notify('プランターを整理しました。次の種を植えましょう！', 'success');
  });

  // ── 立ち上げ
  let startedAt = Date.now();

  const fill = (): void => {
    while (state.plants.length < MAX_PLANTS) state.plants.push(null);
    // 後から増えたアップグレードの鍵を補う（古い保存を開いたときに undefined にしない）。
    for (const item of SHOP_ITEMS) {
      if (state.upgrades[item.id] === undefined) state.upgrades[item.id] = false;
    }
  };

  void (async () => {
    const res = await ctx.save.load();
    if (disposed) return;
    if (res.ok && res.state) {
      try {
        const parsed = JSON.parse(res.state) as Partial<State>;
        state = { ...newState(), ...parsed };
        if (!Array.isArray(state.plants)) state.plants = [newPlant('standard')];
        if (typeof state.activePlantIndex !== 'number') state.activePlantIndex = 0;
        if (!state.upgrades) state.upgrades = {};
        if (!state.stats) state.stats = { totalHarvest: 0, maxSweetness: 0, totalCoins: 500, careCount: 0 };
      } catch {
        ctx.setStatus('続きからのデータを読めなかったので、新しく始めます');
      }
    }
    fill();
    startedAt = Date.now();
    updateUI();
    tickTimer = setInterval(gameTick, 1000);
  })();

  fill();
  updateUI();

  return () => {
    disposed = true;
    if (tickTimer) clearInterval(tickTimer);
    if (toastTimer) clearTimeout(toastTimer);
    for (const id of timers) clearTimeout(id);
    timers.clear();
    host.replaceChildren();
  };
};
