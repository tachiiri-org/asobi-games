// たたかい（BLADE DESTROYER）。tennis-game リポジトリの tatakai.html を移した。
//
// 遊びの中身（当たり判定・ノックバック・敵の出方・レベル上げ・絵・音）は変えていない。変えたのは5つ。
//  - Tailwind の CDN と Font Awesome をやめた。アイコンは絵文字と文字に置き換えてある
//    （外から取る CSS のために、遊び場が別のドメインへ繋ぎに行く形を残さない）。
//  - AudioContext を組み立てのときに作り、後片付けで閉じる。
//  - window のキーボードと mouseup を、後片付けで外せるようにした。矢印キーとスペースは
//    既定の動きを止めるので、離れた後も拾い続けるとページが動かなくなる。
//  - ダメージの赤枠を document.getElementById ではなく、自分の中の要素として持つ。
//  - 力尽きたときと、ボスを倒したときに onFinish を呼ぶ。スコアがこのゲームの点になる。
//
// 画布は 800x400 の固定で、大きさは CSS が合わせる（元の作りのまま）。

import type { GameMount } from './types';

const BASE_WIDTH = 800;
const BASE_HEIGHT = 400;

type SoundType = 'hit' | 'swing' | 'damage' | 'jump' | 'levelup' | 'boss_spawn' | 'crash';
type EnemyType = 'slime' | 'skeleton' | 'bat' | 'boss';
type Rect = { x: number; y: number; width: number; height: number };

const CSS = `
.tk{position:absolute;inset:0;overflow:auto;background:#111827;color:#fff;touch-action:none;
  font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;
  display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px;
  box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none}
.tk-box{position:relative;width:100%;max-width:56rem;background:#111827;border:4px solid #374151;
  border-radius:.5rem;box-shadow:0 25px 50px -12px rgba(0,0,0,.5);overflow:hidden;
  display:flex;flex-direction:column}
.tk-head{display:flex;justify-content:space-between;align-items:center;background:#1f2937;
  padding:8px 16px;border-bottom:2px solid #374151;z-index:10;font-size:14px}
.tk-head .grp{display:flex;align-items:center;gap:16px}
.tk-head .k{font-weight:700}
.tk-head .k.s{color:#facc15}
.tk-head .k.l{color:#60a5fa}
.tk-head .v{font-family:ui-monospace,monospace;font-size:18px}
.tk-warn{text-align:center;font-weight:700;color:#ef4444;animation:tk-pulse 1.5s infinite}
@keyframes tk-pulse{0%,100%{opacity:1}50%{opacity:.4}}
.tk-btn-s{background:#374151;padding:4px 8px;border:0;border-radius:4px;font-size:12px;color:#fff;
  cursor:pointer;font-family:inherit}
.tk-btn-s:hover{background:#4b5563}
.tk-stage{position:relative;flex-grow:1;display:flex;align-items:center;justify-content:center;
  background:#020617;height:60vh;max-height:450px}
.tk-stage canvas{width:100%;height:100%;object-fit:contain;image-rendering:pixelated}
.tk-over{position:absolute;inset:0;background:rgba(0,0,0,.85);display:flex;flex-direction:column;
  align-items:center;justify-content:center;text-align:center;padding:24px;z-index:20;
  overflow-y:auto;box-sizing:border-box}
.tk-over h1{font-size:40px;font-weight:800;letter-spacing:.05em;color:#ef4444;margin:0 0 1rem;
  filter:drop-shadow(0 5px 5px rgba(0,0,0,.8))}
.tk-over h2{font-size:44px;font-weight:800;margin:0 0 1rem}
.tk-over h2.over{color:#dc2626}
.tk-over h2.win{color:#facc15}
.tk-over h2.pause{color:#d1d5db;font-size:28px}
.tk-over p{margin:0 0 1rem}
.tk-lead{color:#facc15;font-weight:700;max-width:28rem}
.tk-keys{background:rgba(31,41,55,.8);padding:12px;border-radius:.5rem;border:1px solid #374151;
  max-width:20rem;margin:0 auto 1.5rem;font-size:12px;color:#d1d5db;text-align:left}
.tk-keys p{margin:0 0 4px}
.tk-keys kbd{padding:2px 6px;background:#111827;border-radius:4px;font-family:ui-monospace,monospace}
.tk-panel{background:rgba(17,24,39,.8);padding:16px;border-radius:.5rem;display:inline-block;
  margin-bottom:1.5rem}
.tk-panel.over{border:1px solid #7f1d1d}
.tk-panel.win{border:1px solid #ca8a04}
.tk-panel .k{font-size:13px;color:#9ca3af;margin:0}
.tk-panel .v{font-size:30px;font-weight:700;color:#facc15;margin:0}
.tk-panel .sub{font-size:12px;color:#9ca3af;margin:8px 0 0}
.tk-go{padding:12px 32px;border:0;border-radius:999px;font-weight:700;font-size:17px;cursor:pointer;
  color:#fff;font-family:inherit;box-shadow:0 10px 15px -3px rgba(0,0,0,.4)}
.tk-go.red{background:#dc2626}
.tk-go.blue{background:#2563eb}
.tk-go.yellow{background:#eab308;color:#000;font-weight:800}
.tk-go.green{background:#16a34a;padding:8px 24px;font-size:15px}
.tk-flash{position:absolute;inset:0;background:rgba(220,38,38,.3);pointer-events:none;opacity:0;
  transition:opacity 75ms}
.tk-ctrl{background:#111827;padding:16px;border-top:2px solid #374151;user-select:none}
.tk-ctrl .row{max-width:28rem;margin:0 auto;display:flex;justify-content:space-between;align-items:center}
.tk-ctrl .grp{display:flex;gap:12px}
.tk-pad{width:56px;height:56px;background:#374151;border:0;border-bottom:4px solid #111827;
  border-radius:1rem;display:flex;flex-direction:column;align-items:center;justify-content:center;
  font-size:22px;color:#fff;box-shadow:0 4px 6px -1px rgba(0,0,0,.3);cursor:pointer;font-family:inherit}
.tk-pad:active{background:#6b7280}
.tk-pad.jump{background:#1d4ed8;border-radius:50%;border-bottom-color:#1e3a8a}
.tk-pad.jump:active{background:#3b82f6}
.tk-pad.attack{width:64px;height:64px;background:#dc2626;border-radius:50%;border-bottom-color:#991b1b;
  transform:translateY(-8px)}
.tk-pad.attack:active{background:#f87171}
.tk-pad .cap{font-size:10px;font-weight:700}
.tk-hidden{display:none}
`;

export const mountTatakai: GameMount = (host, ctx) => {
  const style = document.createElement('style');
  style.textContent = CSS;

  const page = document.createElement('div');
  page.className = 'tk';
  page.innerHTML = `
<div class="tk-box">
  <div class="tk-head">
    <div class="grp">
      <div><span class="k s">👑 スコア:</span> <span class="v" data-score>0</span></div>
      <div><span class="k l">⬆ Lv:</span> <span class="v" data-level>1</span></div>
    </div>
    <div class="tk-warn tk-hidden" data-boss>⚠️ ボス出現中！ ⚠️</div>
    <div class="grp">
      <button class="tk-btn-s" data-sound>🔊</button>
      <button class="tk-btn-s" data-pause>一時停止</button>
    </div>
  </div>
  <div class="tk-stage">
    <canvas data-canvas></canvas>
    <div class="tk-over" data-overlay>
      <div data-menu="start">
        <h1>BLADE DESTROYER</h1>
        <p class="tk-lead">★超・爆裂スクロールぶっ飛びノックバック！★<br>大剣の重撃を当てて、世界ごと敵を後ろへ吹っ飛ばせ！</p>
        <div class="tk-keys">
          <p style="color:#facc15;font-weight:700">🎮 操作方法 🎮</p>
          <p><kbd>←</kbd> <kbd>→</kbd> または画面ボタン：移動</p>
          <p><kbd>スペース</kbd> または <kbd>X</kbd>：<span style="color:#f87171;font-weight:700">超・連続攻撃！</span></p>
          <p><kbd>↑</kbd> または <kbd>Z</kbd>：ジャンプ</p>
          <p style="color:#f87171;font-weight:700;font-size:10px">※動かない時は、まず画面を1回クリックしてね！</p>
        </div>
        <button class="tk-go red" data-start>ゲーム開始</button>
      </div>
      <div class="tk-hidden" data-menu="gameover">
        <h2 class="over">GAME OVER</h2>
        <p style="color:#d1d5db">あなたは力尽きてしまった...</p>
        <div class="tk-panel over">
          <p class="k">最終スコア</p>
          <p class="v" data-final-score>0</p>
          <p class="sub">到達レベル: <span style="color:#60a5fa" data-final-level>1</span></p>
        </div>
        <br>
        <button class="tk-go blue" data-restart>もう一度挑戦</button>
      </div>
      <div class="tk-hidden" data-menu="clear">
        <h2 class="win">VICTORY!</h2>
        <p style="color:#4ade80;font-weight:700">強敵をすべて撃破し、世界に平和が戻った！</p>
        <div class="tk-panel win">
          <p class="k">ハイスコア</p>
          <p class="v" data-clear-score>0</p>
        </div>
        <br>
        <button class="tk-go yellow" data-clear-restart>もう一度遊ぶ</button>
      </div>
      <div class="tk-hidden" data-menu="pause">
        <h2 class="pause">PAUSE</h2>
        <p style="color:#9ca3af">ゲームは一時停止しています</p>
        <button class="tk-go green" data-resume>再開する</button>
      </div>
    </div>
    <div class="tk-flash" data-flash></div>
  </div>
  <div class="tk-ctrl">
    <div class="row">
      <div class="grp">
        <button class="tk-pad" data-ctrl="left">←</button>
        <button class="tk-pad" data-ctrl="right">→</button>
      </div>
      <div class="grp">
        <button class="tk-pad jump" data-ctrl="jump">↑<span class="cap">JUMP</span></button>
        <button class="tk-pad attack" data-ctrl="attack">✊<span class="cap">ATTACK</span></button>
      </div>
    </div>
  </div>
</div>`;
  host.append(style, page);

  const q = <T extends HTMLElement>(sel: string): T => page.querySelector(sel) as T;
  const canvas = q<HTMLCanvasElement>('[data-canvas]');
  canvas.width = BASE_WIDTH;
  canvas.height = BASE_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) {
    page.textContent = 'この端末では canvas が使えないため、遊べません。';
    return () => { host.replaceChildren(); };
  }
  const c2d: CanvasRenderingContext2D = context;

  const scoreEl = q('[data-score]');
  const levelEl = q('[data-level]');
  const bossWarn = q('[data-boss]');
  const overlay = q('[data-overlay]');
  const flash = q('[data-flash]');
  const menus = {
    start: q('[data-menu="start"]'),
    gameover: q('[data-menu="gameover"]'),
    clear: q('[data-menu="clear"]'),
    pause: q('[data-menu="pause"]'),
  };

  // ── 音
  const AudioCtor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  let audio: AudioContext | null = null;
  let soundEnabled = true;

  const initAudio = (): void => {
    if (!audio && AudioCtor) audio = new AudioCtor();
  };

  const playSound = (type: SoundType): void => {
    if (!soundEnabled) return;
    initAudio();
    if (!audio) return;
    if (audio.state === 'suspended') void audio.resume();
    const now = audio.currentTime;

    if (type === 'levelup') {
      for (const [index, freq] of [261.63, 329.63, 392.0, 523.25].entries()) {
        const t = now + index * 0.08;
        const o = audio.createOscillator();
        const g = audio.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        o.connect(g);
        g.connect(audio.destination);
        o.start(t);
        o.stop(t + 0.22);
      }
      return;
    }

    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.connect(gain);
    gain.connect(audio.destination);

    if (type === 'hit') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'swing') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now); osc.stop(now + 0.08);
    } else if (type === 'damage') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.linearRampToValueAtTime(60, now + 0.2);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now); osc.stop(now + 0.25);
    } else if (type === 'jump') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'boss_spawn') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.linearRampToValueAtTime(120, now + 0.5);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc.start(now); osc.stop(now + 0.6);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now); osc.stop(now + 0.35);
    }
  };

  // ── 状態
  let gameState: 'START' | 'PLAYING' | 'GAMEOVER' | 'CLEAR' | 'PAUSED' = 'START';
  let score = 0;
  let level = 1;
  let exp = 0;
  let nextLevelExp = 100;
  let bossSpawned = false;
  let screenShake = 0;
  let hitStopTimer = 0;
  let spawnTimer = 0;
  let startedAt = 0;
  let animationId = 0;
  let disposed = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const keys: Record<string, boolean> = {};
  const touchInputs = { left: false, right: false, jump: false, attack: false };

  class Player {
    width = 40; height = 64;
    x = 100; y = BASE_HEIGHT - 64 - 40;
    vx = 0; vy = 0;
    speed = 5.5; jumpPower = 13; gravity = 0.6;
    isGrounded = false;
    maxHp = 100; hp = 100; attackPower = 20;
    direction = 1;
    isAttacking = false;
    attackCooldown = 0;
    attackRange = 110;
    attackDuration = 12;
    attackTimer = 0;
    invulnerableFrames = 0;
    animTimer = 0;
    isWalking = false;

    update(): void {
      if (this.invulnerableFrames > 0) this.invulnerableFrames--;

      const goLeft = keys['ArrowLeft'] || touchInputs.left;
      const goRight = keys['ArrowRight'] || touchInputs.right;
      if (goLeft) { this.vx = -this.speed; this.direction = -1; this.isWalking = true; }
      else if (goRight) { this.vx = this.speed; this.direction = 1; this.isWalking = true; }
      else { this.vx = 0; this.isWalking = false; }

      const doJump = keys['ArrowUp'] || keys['z'] || keys['Z'] || keys['KeyZ'] || touchInputs.jump;
      if (doJump && this.isGrounded) {
        this.vy = -this.jumpPower;
        this.isGrounded = false;
        playSound('jump');
      }

      this.vy += this.gravity;
      this.x += this.vx;
      this.y += this.vy;

      if (this.x < 0) this.x = 0;
      if (this.x > BASE_WIDTH - this.width) this.x = BASE_WIDTH - this.width;

      const groundY = BASE_HEIGHT - this.height - 40;
      if (this.y >= groundY) { this.y = groundY; this.vy = 0; this.isGrounded = true; }

      const doAttack = keys[' '] || keys['Space'] || keys['x'] || keys['X'] || keys['KeyX'] || touchInputs.attack;
      if (doAttack && this.attackCooldown === 0) this.performAttack();

      if (this.attackCooldown > 0) this.attackCooldown--;
      if (this.isAttacking) {
        this.attackTimer--;
        if (this.attackTimer <= 0) this.isAttacking = false;
      }
      this.animTimer++;
    }

    performAttack(): void {
      this.isAttacking = true;
      this.attackTimer = this.attackDuration;
      this.attackCooldown = 8;
      playSound('swing');
      slashes.push(new SlashEffect(this.x + this.width / 2 + this.direction * 45, this.y + this.height / 2, this.direction));
    }

    draw(): void {
      c2d.save();
      if (this.isAttacking) {
        c2d.shadowColor = '#60a5fa';
        c2d.shadowBlur = 15;
      } else if (this.invulnerableFrames > 0 && Math.floor(this.invulnerableFrames / 4) % 2 === 0) {
        c2d.globalAlpha = 0.3;
      }
      c2d.translate(this.x + this.width / 2, this.y + this.height / 2);
      c2d.scale(this.direction, 1);

      const w = this.width;
      const h = this.height;
      const bob = this.isWalking && this.isGrounded ? Math.sin(this.animTimer * 0.2) * 3 : 0;

      c2d.fillStyle = '#1e40af';
      c2d.fillRect(-w / 2 + 4, -h / 2 + 16 + bob, w - 8, 30);
      c2d.fillStyle = '#3b82f6';
      c2d.fillRect(-w / 2 + 8, -h / 2 + 20 + bob, w - 16, 22);

      c2d.fillStyle = '#9ca3af';
      c2d.fillRect(-w / 2 + 6, -h / 2 + bob, w - 12, 18);
      c2d.fillStyle = '#d1d5db';
      c2d.fillRect(-w / 2 + 10, -h / 2 + 4 + bob, w - 20, 10);
      c2d.fillStyle = '#ef4444';
      c2d.fillRect(2, -h / 2 + 8 + bob, 6, 3);

      if (this.isAttacking) {
        c2d.fillStyle = '#f3f4f6';
        c2d.fillRect(10, -h / 2 + 16 + bob, 45, 10);
        c2d.fillStyle = '#d97706';
        c2d.fillRect(6, -h / 2 + 12 + bob, 4, 18);
      } else {
        c2d.fillStyle = '#f3f4f6';
        c2d.fillRect(-w / 2 - 2, -h / 2 + bob, 6, 24);
        c2d.fillStyle = '#d97706';
        c2d.fillRect(-w / 2 - 4, -h / 2 + 24 + bob, 10, 4);
      }

      c2d.fillStyle = '#1e293b';
      const swing = this.isWalking && this.isGrounded ? Math.sin(this.animTimer * 0.2) * 6 : 0;
      c2d.fillRect(-w / 2 + 6, h / 2 - 18 + swing, 8, 18);
      c2d.fillRect(w / 2 - 14, h / 2 - 18 - swing, 8, 18);

      c2d.restore();

      const barWidth = 50;
      const barX = this.x + (this.width - barWidth) / 2;
      const barY = this.y - 12;
      c2d.fillStyle = '#ef4444';
      c2d.fillRect(barX, barY, barWidth, 6);
      c2d.fillStyle = '#22c55e';
      const hpW = (this.hp / this.maxHp) * barWidth;
      c2d.fillRect(barX, barY, hpW > 0 ? hpW : 0, 6);
    }

    takeDamage(amount: number, fromX: number): void {
      if (this.isAttacking || this.invulnerableFrames > 0) return;
      this.hp -= amount;
      this.invulnerableFrames = 45;
      playSound('damage');

      flash.style.opacity = '1';
      const id = setTimeout(() => {
        timers.delete(id);
        flash.style.opacity = '0';
      }, 100);
      timers.add(id);

      this.vx = (this.x + this.width / 2 > fromX ? 1 : -1) * 8;
      this.vy = -5;
      this.isGrounded = false;

      if (this.hp <= 0) {
        this.hp = 0;
        gameOver();
      }
    }

    gainExp(amount: number): void {
      exp += amount;
      if (exp < nextLevelExp) return;
      exp -= nextLevelExp;
      level++;
      nextLevelExp = Math.floor(nextLevelExp * 1.5);
      this.maxHp += 20;
      this.hp = this.maxHp;
      this.attackPower += 5;
      this.speed += 0.2;
      playSound('levelup');
      effects.push(new LevelUpRing(this));
      updateUI();
    }
  }

  class Enemy {
    type: EnemyType;
    width = 40; height = 40;
    x = BASE_WIDTH + 50;
    y = BASE_HEIGHT - 40 - 40;
    vx = -1.5; vy = 0;
    direction = -1;
    color = '#10b981';
    scoreVal = 10;
    expVal = 20;
    knockbackTimer = 0;
    kbVx = 0; kbVy = 0;
    gravity = 0.52;
    hasCrashed = false;
    trail: { x: number; y: number; kbVx: number }[] = [];
    maxHp = 30; hp = 30;
    damage = 10;
    speed = 1.2;
    invulnerableFrames = 0;
    animTimer = Math.random() * 100;

    constructor(type: EnemyType) {
      this.type = type;
      if (type === 'slime') {
        this.width = 36; this.height = 26;
        this.y = BASE_HEIGHT - this.height - 40;
        this.maxHp = 30; this.hp = 30; this.damage = 10; this.speed = 1.2;
        this.color = '#10b981';
      } else if (type === 'skeleton') {
        this.width = 38; this.height = 58;
        this.y = BASE_HEIGHT - this.height - 40;
        this.maxHp = 60; this.hp = 60; this.damage = 20; this.speed = 0.8;
        this.color = '#cbd5e1';
      } else if (type === 'bat') {
        this.width = 32; this.height = 24;
        this.y = BASE_HEIGHT - 120 - Math.random() * 80;
        this.maxHp = 20; this.hp = 20; this.damage = 8; this.speed = 2.2;
        this.color = '#a855f7';
      } else {
        this.width = 80; this.height = 110;
        this.y = BASE_HEIGHT - this.height - 40;
        this.maxHp = 350; this.hp = 350; this.damage = 35; this.speed = 0.6;
        this.color = '#ef4444';
        this.scoreVal = 100;
        this.expVal = 200;
        bossSpawned = true;
        bossWarn.classList.remove('tk-hidden');
        playSound('boss_spawn');
      }
    }

    update(playerX: number): void {
      if (this.invulnerableFrames > 0) this.invulnerableFrames--;

      if (this.knockbackTimer > 0) {
        this.knockbackTimer--;
        this.x += this.kbVx;
        this.kbVx *= 0.94;

        this.trail.push({ x: this.x, y: this.y, kbVx: this.kbVx });
        if (this.trail.length > 6) this.trail.shift();

        if (this.knockbackTimer % 2 === 0) {
          const groundY = this.type === 'bat' ? this.y + this.height : BASE_HEIGHT - 40;
          dusts.push(new DustParticle(this.x + this.width / 2, groundY));
          windLines.push(new WindLine(this.x + this.width / 2, this.y + Math.random() * this.height, this.kbVx));
        }

        if (this.type !== 'bat') {
          this.y += this.kbVy;
          this.kbVy += this.gravity;
          const groundY = BASE_HEIGHT - this.height - 40;
          if (this.y >= groundY) { this.y = groundY; this.kbVy = 0; }
        }

        const rightLimit = BASE_WIDTH - this.width;
        if (this.x < 0) {
          this.x = 0;
          if (!this.hasCrashed) this.triggerWallCrash(-1);
        }
        if (this.x > rightLimit) {
          this.x = rightLimit;
          if (!this.hasCrashed) this.triggerWallCrash(1);
        }

        this.animTimer++;
        return;
      }

      if (this.trail.length > 0) this.trail.shift();
      this.hasCrashed = false;

      if (this.x < playerX) { this.vx = this.speed; this.direction = 1; }
      else { this.vx = -this.speed; this.direction = -1; }
      this.x += this.vx;
      if (this.type !== 'bat') this.y = BASE_HEIGHT - this.height - 40;
      else this.y += Math.sin(this.animTimer * 0.1) * 1.5;

      this.animTimer++;
    }

    triggerWallCrash(wallSide: number): void {
      this.hasCrashed = true;
      screenShake = 26;
      playSound('crash');
      spawnDamageText(this.x + this.width / 2, this.y - 45, '壁ドンッ！');
      spawnDamageText(this.x + this.width / 2, this.y - 20, 'ドゴォォン！');
      // 壁で跳ね返らせず、壁際に留めてずり落ちさせる（跳ね返すとプレイヤーを押し返す）。
      this.kbVx = -wallSide * 1.5;
      this.kbVy = -2.5;
      this.knockbackTimer = 45;
      for (let i = 0; i < 25; i++) {
        for (const col of ['#fffbeb', '#f97316', '#ef4444']) {
          sparks.push(new Spark(this.x + this.width / 2, this.y + this.height / 2, col,
            (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10));
        }
      }
    }

    draw(): void {
      for (const [index, t] of this.trail.entries()) {
        c2d.save();
        c2d.fillStyle = this.color;
        c2d.globalAlpha = ((index + 1) / 7) * 0.15;
        c2d.translate(t.x + this.width / 2, t.y + this.height / 2);
        c2d.rotate(t.kbVx * 0.02);
        c2d.scale(this.direction, 1);
        c2d.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        c2d.restore();
      }

      c2d.save();
      if (this.invulnerableFrames > 0 && Math.floor(this.invulnerableFrames / 3) % 2 === 0) {
        c2d.globalAlpha = 0.4;
      }
      c2d.translate(this.x + this.width / 2, this.y + this.height / 2);
      if (this.knockbackTimer > 0) c2d.rotate(this.kbVx * 0.035);
      c2d.scale(this.direction, 1);

      const w = this.width;
      const h = this.height;

      if (this.type === 'slime') {
        const squish = Math.sin(this.animTimer * 0.15) * 2;
        c2d.fillStyle = this.color;
        c2d.beginPath();
        c2d.ellipse(0, squish, w / 2, h / 2 - squish, 0, 0, Math.PI * 2);
        c2d.fill();
        c2d.fillStyle = '#0f172a';
        c2d.fillRect(4, -2 + squish, 3, 3);
        c2d.fillRect(10, -2 + squish, 3, 3);
      } else if (this.type === 'skeleton') {
        const bounce = Math.sin(this.animTimer * 0.1) * 2;
        c2d.fillStyle = this.color;
        c2d.fillRect(-10, -h / 2 + bounce, 20, 16);
        c2d.fillStyle = '#1e293b';
        c2d.fillRect(2, -h / 2 + 6 + bounce, 4, 4);
        c2d.fillRect(-6, -h / 2 + 6 + bounce, 4, 4);
        c2d.fillStyle = this.color;
        c2d.fillRect(-6, -h / 2 + 18, 12, 18);
        c2d.fillStyle = '#0f172a';
        c2d.fillRect(-8, -h / 2 + 22, 16, 2);
        c2d.fillRect(-8, -h / 2 + 28, 16, 2);
        c2d.fillStyle = '#94a3b8';
        c2d.fillRect(8, -h / 2 + 10, 4, 16);
      } else if (this.type === 'bat') {
        const wing = Math.sin(this.animTimer * 0.3) * h / 2;
        c2d.fillStyle = this.color;
        c2d.beginPath(); c2d.arc(0, 0, w / 3, 0, Math.PI * 2); c2d.fill();
        c2d.beginPath();
        c2d.moveTo(-w / 4, 0); c2d.lineTo(-w, -wing); c2d.lineTo(-w / 2, wing / 2); c2d.fill();
        c2d.beginPath();
        c2d.moveTo(w / 4, 0); c2d.lineTo(w, -wing); c2d.lineTo(w / 2, wing / 2); c2d.fill();
        c2d.fillStyle = '#ef4444';
        c2d.fillRect(2, -2, 2, 2);
      } else {
        const hover = Math.sin(this.animTimer * 0.05) * 3;
        c2d.fillStyle = '#450a0a';
        c2d.fillRect(-w / 2 - 5, -h / 2 + 24 + hover, w + 10, h - 30);
        c2d.fillStyle = '#111827';
        c2d.fillRect(-w / 2, -h / 2 + 20 + hover, w, h - 40);
        c2d.fillStyle = '#ef4444';
        c2d.fillRect(-6, -6 + hover, 12, 12);
        c2d.fillStyle = '#1f2937';
        c2d.fillRect(-20, -h / 2 + hover, 40, 24);
        c2d.beginPath();
        c2d.moveTo(-18, -h / 2 + hover); c2d.lineTo(-24, -h / 2 - 12 + hover); c2d.lineTo(-10, -h / 2 + hover);
        c2d.fill();
        c2d.beginPath();
        c2d.moveTo(18, -h / 2 + hover); c2d.lineTo(24, -h / 2 - 12 + hover); c2d.lineTo(10, -h / 2 + hover);
        c2d.fill();
        c2d.fillStyle = '#ef4444';
        c2d.fillRect(w / 2 - 10, -h / 2 - 10 + hover, 16, h - 10);
        c2d.fillStyle = '#991b1b';
        c2d.fillRect(w / 2 - 14, -h / 2 + hover + 10, 24, 6);
      }
      c2d.restore();

      if (this.knockbackTimer > 0) {
        c2d.save();
        const centerX = this.x + this.width / 2;
        const centerY = this.y - 15;
        for (let i = 0; i < 3; i++) {
          const angle = this.animTimer * 0.1 + (i * Math.PI * 2) / 3;
          c2d.font = '12px sans-serif';
          c2d.fillStyle = '#facc15';
          c2d.textAlign = 'center';
          c2d.fillText('★', centerX + Math.cos(angle) * 15, centerY + Math.sin(angle) * 6);
        }
        c2d.restore();
      }

      c2d.fillStyle = '#475569';
      c2d.fillRect(this.x, this.y - 8, this.width, 4);
      c2d.fillStyle = '#ef4444';
      const hpW = (this.hp / this.maxHp) * this.width;
      c2d.fillRect(this.x, this.y - 8, hpW > 0 ? hpW : 0, 4);
    }

    takeDamage(amount: number, playerX: number): void {
      if (this.invulnerableFrames > 0) return;
      this.hp -= amount;
      this.invulnerableFrames = 15;
      playSound('hit');
      hitStopTimer = 4;
      screenShake = 16;

      const soundWord = ['ブッ飛び！', 'バシィィッ！', 'ズサーーーッ！'][Math.floor(Math.random() * 3)];
      spawnDamageText(this.x + this.width / 2, this.y - 30, soundWord);
      spawnDamageText(this.x + this.width / 2, this.y, String(amount));

      const kbDir = this.x + this.width / 2 > playerX ? 1 : -1;
      for (let i = 0; i < 18; i++) {
        const spread = (kbDir === 1 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.2;
        const speed = 3 + Math.random() * 8;
        sparks.push(new Spark(
          this.x + this.width / 2, this.y + this.height / 2, this.color,
          Math.cos(spread) * speed, Math.sin(spread) * speed - 1,
        ));
      }

      this.knockbackTimer = 45;
      if (this.type === 'boss') { this.kbVx += kbDir * 11; this.kbVy = -3.5; }
      else if (this.type === 'bat') { this.kbVx += kbDir * 23; }
      else { this.kbVx += kbDir * 18; this.kbVy = -6.5; }
    }
  }

  class SlashEffect {
    life = 14; maxLife = 14;
    constructor(public x: number, public y: number, public dir: number) {}
    update(): void { this.life--; this.x += this.dir * 6; }
    draw(): void {
      c2d.save();
      c2d.translate(this.x, this.y);
      c2d.scale(this.dir, 1);
      c2d.strokeStyle = `rgba(255, 255, 255, ${this.life / this.maxLife})`;
      c2d.lineWidth = 12;
      c2d.lineCap = 'round';
      c2d.beginPath(); c2d.arc(-20, 0, 75, -Math.PI / 3, Math.PI / 3); c2d.stroke();
      c2d.strokeStyle = `rgba(59, 130, 246, ${this.life / this.maxLife})`;
      c2d.lineWidth = 6;
      c2d.beginPath(); c2d.arc(-20, 0, 72, -Math.PI / 3.2, Math.PI / 3.2); c2d.stroke();
      c2d.restore();
    }
  }

  class DamageText {
    vy = -1.2; life = 35; maxLife = 35;
    constructor(public x: number, public y: number, public text: string) {}
    update(): void { this.y += this.vy; this.life--; }
    draw(): void {
      c2d.save();
      c2d.font = 'bold 22px "Impact", sans-serif';
      c2d.fillStyle = `rgba(255, 239, 10, ${this.life / this.maxLife})`;
      c2d.strokeStyle = `rgba(0, 0, 0, ${this.life / this.maxLife})`;
      c2d.lineWidth = 4;
      c2d.textAlign = 'center';
      c2d.strokeText(this.text, this.x, this.y);
      c2d.fillText(this.text, this.x, this.y);
      c2d.restore();
    }
  }

  class Spark {
    life = 20 + Math.random() * 15;
    size = 3 + Math.random() * 4;
    constructor(public x: number, public y: number, public color: string, public vx: number, public vy: number) {}
    update(): void { this.x += this.vx; this.y += this.vy; this.vy += 0.12; this.life--; }
    draw(): void {
      c2d.fillStyle = this.color;
      c2d.globalAlpha = this.life / 35;
      c2d.fillRect(this.x, this.y, this.size, this.size);
      c2d.globalAlpha = 1;
    }
  }

  class DustParticle {
    vx = (Math.random() - 0.5) * 3;
    vy = -Math.random() * 1.5 - 0.5;
    size = 5 + Math.random() * 7;
    life = 12 + Math.random() * 8;
    maxLife = this.life;
    constructor(public x: number, public y: number) {}
    update(): void { this.x += this.vx; this.y += this.vy; this.life--; }
    draw(): void {
      c2d.save();
      c2d.fillStyle = `rgba(148, 163, 184, ${(this.life / this.maxLife) * 0.4})`;
      c2d.beginPath(); c2d.arc(this.x, this.y, this.size, 0, Math.PI * 2); c2d.fill();
      c2d.restore();
    }
  }

  class WindLine {
    vx: number;
    life = 14; maxLife = 14;
    width = 20 + Math.random() * 30;
    constructor(public x: number, public y: number, vx: number) { this.vx = vx * 0.75; }
    update(): void { this.x += this.vx; this.life--; }
    draw(): void {
      c2d.save();
      c2d.strokeStyle = `rgba(255, 255, 255, ${(this.life / this.maxLife) * 0.4})`;
      c2d.lineWidth = 2;
      c2d.beginPath();
      c2d.moveTo(this.x, this.y);
      c2d.lineTo(this.x - this.width * Math.sign(this.vx), this.y);
      c2d.stroke();
      c2d.restore();
    }
  }

  class LevelUpRing {
    radius = 10; life = 40; maxLife = 40;
    constructor(public target: Player) {}
    update(): void { this.radius += 2.5; this.life--; }
    draw(): void {
      c2d.save();
      c2d.strokeStyle = `rgba(250, 204, 21, ${this.life / this.maxLife})`;
      c2d.lineWidth = 4;
      c2d.shadowColor = '#eab308';
      c2d.shadowBlur = 10;
      c2d.beginPath();
      c2d.arc(this.target.x + this.target.width / 2, this.target.y + this.target.height, this.radius, 0, Math.PI * 2);
      c2d.stroke();
      c2d.font = 'bold 20px sans-serif';
      c2d.fillStyle = `rgba(250, 204, 21, ${this.life / this.maxLife})`;
      c2d.textAlign = 'center';
      c2d.fillText('LEVEL UP!!', this.target.x + this.target.width / 2, this.target.y - 40);
      c2d.restore();
    }
  }

  class Environment {
    bgScroll = 0;
    stars = Array.from({ length: 30 }, () => ({
      x: Math.random() * BASE_WIDTH,
      y: Math.random() * (BASE_HEIGHT - 150),
      size: Math.random() * 2,
    }));
    update(playerSpeed: number): void {
      this.bgScroll = (this.bgScroll - playerSpeed * 0.1) % BASE_WIDTH;
    }
    draw(): void {
      const grad = c2d.createLinearGradient(0, 0, 0, BASE_HEIGHT);
      grad.addColorStop(0, '#020617');
      grad.addColorStop(0.6, '#0f172a');
      grad.addColorStop(1, '#1e1b4b');
      c2d.fillStyle = grad;
      c2d.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

      c2d.fillStyle = '#ffffff';
      for (const s of this.stars) c2d.fillRect(s.x, s.y, s.size, s.size);

      c2d.fillStyle = '#11103a';
      c2d.beginPath();
      c2d.moveTo(0, BASE_HEIGHT);
      c2d.lineTo(200 + this.bgScroll * 0.5, 180);
      c2d.lineTo(450 + this.bgScroll * 0.5, 300);
      c2d.lineTo(700 + this.bgScroll * 0.5, 120);
      c2d.lineTo(1000 + this.bgScroll * 0.5, BASE_HEIGHT);
      c2d.fill();

      c2d.fillStyle = '#1e293b';
      c2d.fillRect(0, BASE_HEIGHT - 40, BASE_WIDTH, 40);
      c2d.fillStyle = '#0f766e';
      c2d.fillRect(0, BASE_HEIGHT - 42, BASE_WIDTH, 4);
    }
  }

  let player = new Player();
  const env = new Environment();
  let enemies: Enemy[] = [];
  let slashes: SlashEffect[] = [];
  let damageTexts: DamageText[] = [];
  let sparks: Spark[] = [];
  let effects: LevelUpRing[] = [];
  let dusts: DustParticle[] = [];
  let windLines: WindLine[] = [];

  const spawnDamageText = (x: number, y: number, text: string): void => {
    damageTexts.push(new DamageText(Math.max(20, Math.min(BASE_WIDTH - 20, x)), y, text));
  };

  const checkRectCollision = (a: Rect, b: Rect): boolean =>
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

  const updateUI = (): void => {
    scoreEl.textContent = String(score);
    levelEl.textContent = String(level);
  };

  const showMenu = (which: keyof typeof menus | null): void => {
    if (which === null) {
      overlay.classList.add('tk-hidden');
      return;
    }
    overlay.classList.remove('tk-hidden');
    for (const [key, node] of Object.entries(menus)) {
      node.classList.toggle('tk-hidden', key !== which);
    }
  };

  function gameOver(): void {
    gameState = 'GAMEOVER';
    q('[data-final-score]').textContent = String(score);
    q('[data-final-level]').textContent = String(level);
    ctx.onFinish(score, startedAt || Date.now());
    showMenu('gameover');
  }

  function gameClear(): void {
    gameState = 'CLEAR';
    q('[data-clear-score]').textContent = String(score);
    ctx.onFinish(score, startedAt || Date.now());
    showMenu('clear');
  }

  const resetGame = (): void => {
    player = new Player();
    enemies = []; slashes = []; damageTexts = []; sparks = []; dusts = []; windLines = []; effects = [];
    score = 0; level = 1; exp = 0; nextLevelExp = 100;
    bossSpawned = false; spawnTimer = 0; screenShake = 0; hitStopTimer = 0;
    bossWarn.classList.add('tk-hidden');
    updateUI();
  };

  const startGame = (): void => {
    initAudio();
    resetGame();
    startedAt = Date.now();
    gameState = 'PLAYING';
    showMenu(null);
  };

  const togglePause = (): void => {
    const pauseBtn = q('[data-pause]');
    if (gameState === 'PLAYING') {
      gameState = 'PAUSED';
      showMenu('pause');
      pauseBtn.textContent = '再開';
    } else if (gameState === 'PAUSED') {
      gameState = 'PLAYING';
      showMenu(null);
      pauseBtn.textContent = '一時停止';
    }
  };

  const update = (): void => {
    if (gameState !== 'PLAYING') return;
    if (hitStopTimer > 0) { hitStopTimer--; return; }

    env.update(player.vx);
    player.update();

    spawnTimer++;
    if (!bossSpawned) {
      const spawnInterval = Math.max(80, 180 - Math.floor(score / 5));
      if (spawnTimer >= spawnInterval) {
        spawnTimer = 0;
        const rand = Math.random();
        let type: EnemyType = 'slime';
        if (score >= 120 && rand < 0.25) type = 'bat';
        else if (score >= 60 && rand < 0.6) type = 'skeleton';
        enemies.push(new Enemy(type));
      }
      if (score >= 250) enemies.push(new Enemy('boss'));
    }

    for (const e of enemies) e.update(player.x);
    for (const s of slashes) s.update();
    for (const d of damageTexts) d.update();
    for (const p of sparks) p.update();
    for (const du of dusts) du.update();
    for (const w of windLines) w.update();
    for (const f of effects) f.update();

    if (player.isAttacking) {
      const margin = 20;
      const rangeX = player.direction === 1
        ? player.x + player.width - margin
        : player.x - player.attackRange;
      const attackBox: Rect = {
        x: rangeX,
        y: player.y - 15,
        width: player.attackRange + margin,
        height: player.height + 30,
      };
      for (const e of enemies) {
        if (!checkRectCollision(attackBox, e)) continue;
        e.takeDamage(player.attackPower, player.x);
        if (e.hp <= 0) {
          score += e.scoreVal;
          player.gainExp(e.expVal);
          if (e.type === 'boss') gameClear();
        }
        updateUI();
      }
    }

    for (const e of enemies) {
      if (!player.isAttacking && checkRectCollision(player, e) && e.hp > 0) {
        player.takeDamage(e.damage, e.x + e.width / 2);
      }
    }

    enemies = enemies.filter((e) => e.hp > 0 || e.trail.length > 0);
    slashes = slashes.filter((s) => s.life > 0);
    damageTexts = damageTexts.filter((d) => d.life > 0);
    sparks = sparks.filter((p) => p.life > 0);
    dusts = dusts.filter((du) => du.life > 0);
    windLines = windLines.filter((w) => w.life > 0);
    effects = effects.filter((f) => f.life > 0);
  };

  const draw = (): void => {
    c2d.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    c2d.save();
    if (screenShake > 0) {
      const intensity = Math.min(screenShake, 11);
      c2d.translate((Math.random() - 0.5) * intensity, (Math.random() - 0.5) * intensity);
      screenShake *= 0.84;
      if (screenShake < 0.5) screenShake = 0;
    }
    env.draw();
    for (const f of effects) f.draw();
    for (const du of dusts) du.draw();
    for (const w of windLines) w.draw();
    for (const p of sparks) p.draw();
    for (const e of enemies) e.draw();
    player.draw();
    for (const s of slashes) s.draw();
    for (const d of damageTexts) d.draw();
    c2d.restore();
  };

  const loop = (): void => {
    update();
    draw();
    animationId = requestAnimationFrame(loop);
  };

  // ── 入力
  q('[data-start]').addEventListener('click', startGame);
  q('[data-restart]').addEventListener('click', startGame);
  q('[data-clear-restart]').addEventListener('click', startGame);
  q('[data-resume]').addEventListener('click', togglePause);
  q('[data-pause]').addEventListener('click', togglePause);
  q('[data-sound]').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    q('[data-sound]').textContent = soundEnabled ? '🔊' : '🔇';
  });

  const HANDLED_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Space']);
  const onKeyDown = (e: KeyboardEvent): void => {
    keys[e.key] = true;
    keys[e.code] = true;
    if (HANDLED_KEYS.has(e.key) || HANDLED_KEYS.has(e.code)) e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    keys[e.key] = false;
    keys[e.code] = false;
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const releaseAll = (): void => {
    touchInputs.left = false;
    touchInputs.right = false;
    touchInputs.jump = false;
    touchInputs.attack = false;
  };
  window.addEventListener('mouseup', releaseAll);

  for (const key of ['left', 'right', 'jump', 'attack'] as const) {
    const btn = q(`[data-ctrl="${key}"]`);
    const startAction = (e?: Event): void => {
      e?.preventDefault();
      initAudio();
      touchInputs[key] = true;
      if (key === 'attack' && gameState === 'PLAYING' && player.attackCooldown === 0) {
        player.performAttack();
      }
      if (key === 'jump' && gameState === 'PLAYING' && player.isGrounded) {
        player.vy = -player.jumpPower;
        player.isGrounded = false;
        playSound('jump');
      }
    };
    const endAction = (e?: Event): void => {
      e?.preventDefault();
      touchInputs[key] = false;
    };
    btn.addEventListener('touchstart', startAction, { passive: false });
    btn.addEventListener('touchend', endAction, { passive: false });
    btn.addEventListener('touchcancel', endAction, { passive: false });
    btn.addEventListener('mousedown', startAction);
  }

  updateUI();
  loop();

  return () => {
    disposed = true;
    gameState = 'GAMEOVER';
    if (animationId) cancelAnimationFrame(animationId);
    for (const id of timers) clearTimeout(id);
    timers.clear();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('mouseup', releaseAll);
    void audio?.close().catch(() => undefined);
    host.replaceChildren();
    void disposed;
  };
};
