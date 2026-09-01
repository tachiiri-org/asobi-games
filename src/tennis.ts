// テニス。tennis-game リポジトリの index.html をそのまま移した。
//
// 中身（当たり判定・キャラの絵・相手の強さ）は変えていない。変えたのは3つだけ。
//  - 画布の大きさを window ではなく置き場所（host）から取る。プロダクトの外枠の中に入るので、
//    window の高さを使うとヘッダのぶんだけはみ出す。
//  - onclick 属性で呼んでいた関数を、リスナに付け替えた。
//  - 走り終わりに onFinish を呼ぶ。「どのワールドまで行けたか」が、このゲームの点になる。
//
// Tailwind の CDN は持ち込まない。当てていたクラスは、ここで必要なぶんだけ CSS にしてある。

import type { GameMount } from './types';

type Character = {
  readonly name: string;
  readonly color: string;
  readonly speedMult: number;
  readonly powerMult: number;
};

type Opponent = {
  readonly name: string;
  readonly speed: number;
  readonly ballSpeed: number;
  readonly color: string;
  readonly label: string;
};

type Fighter = { x: number; y: number; swing: number; speed: number; color: string; active: boolean };
type Ball = {
  x: number; y: number; dx: number; dy: number;
  radius: number; speed: number; serving: boolean; effect: number;
  serveTimer: ReturnType<typeof setTimeout> | null;
};

const CHARACTERS: readonly Character[] = [
  { name: 'ハヤト', color: '#e53e3e', speedMult: 1.0, powerMult: 1.0 },
  { name: 'サクラ', color: '#38a169', speedMult: 1.3, powerMult: 0.8 },
  { name: 'ダイキ', color: '#d69e2e', speedMult: 0.7, powerMult: 1.5 },
];

const CHARACTER_NOTES: readonly string[] = ['バランス', 'スピード', 'パワー'];

const OPPONENTS: readonly Opponent[] = [
  { name: 'クリボー風', speed: 3.5, ballSpeed: 6.5, color: '#975a16', label: 'WORLD 1-1' },
  { name: 'ノコノコ風', speed: 4.8, ballSpeed: 8.5, color: '#38a169', label: 'WORLD 1-2' },
  { name: 'テレサ風', speed: 5.8, ballSpeed: 10.0, color: '#edf2f7', label: 'WORLD 1-3' },
  { name: 'カメック風', speed: 7.0, ballSpeed: 11.5, color: '#3182ce', label: 'WORLD 1-4' },
  { name: 'クッパ風', speed: 8.5, ballSpeed: 13.5, color: '#d69e2e', label: 'FINAL BATTLE' },
];

/** 5点先取。元の実装と同じ。 */
const POINTS_TO_WIN = 5;

const CSS = `
.tn{position:absolute;inset:0;overflow:hidden;background:#2f855a;touch-action:none;
  user-select:none;-webkit-user-select:none;
  font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
.tn canvas{display:block;background:#38a169;width:100%;height:100%}
.tn-hud{position:absolute;top:16px;left:0;right:0;display:flex;justify-content:space-around;
  color:#fff;pointer-events:none;text-shadow:2px 2px 4px rgba(0,0,0,.8);z-index:5}
.tn-score{background:rgba(255,0,0,.7);padding:.5rem 1.5rem;border:3px solid #fff;
  border-radius:1rem;text-align:center;min-width:100px}
.tn-score.rival{background:#4a5568}
.tn-score p{margin:0}
.tn-score .lbl{font-size:12px;opacity:.9}
.tn-score .num{font-size:30px;font-weight:700;line-height:1.1}
.tn-stage{position:absolute;top:104px;left:0;right:0;text-align:center;color:#ffd700;
  font-weight:700;font-size:1.5rem;pointer-events:none;z-index:5;background:rgba(0,0,0,.4);
  padding:5px 0;text-shadow:2px 2px 0 #000}
.tn-count{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#ff0;
  font-size:8rem;font-weight:900;text-shadow:6px 6px 0 #000;pointer-events:none;z-index:30}
.tn-msg{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;
  padding:2rem;border:5px solid #e53e3e;border-radius:1.5rem;color:#2d3748;text-align:center;
  box-shadow:0 10px 25px rgba(0,0,0,.5);z-index:20;width:90%;max-width:450px;box-sizing:border-box}
.tn-msg h2{font-size:1.75rem;font-weight:700;margin:0 0 .5rem;color:#c53030}
.tn-msg p{font-weight:700;margin:0 0 1rem}
.tn-btn{background:#e53e3e;color:#fff;padding:.75rem 1.5rem;border:0;border-bottom:4px solid #9b2c2c;
  border-radius:.75rem;font-weight:700;margin:.4rem;cursor:pointer;font-size:14px;
  font-family:inherit;transition:transform .1s,border-bottom-width .1s}
.tn-btn:active{transform:translateY(2px);border-bottom-width:2px}
.tn-btn[disabled]{opacity:.5;cursor:default}
.tn-chars{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:1rem}
.tn-char{border:3px solid #e2e8f0;padding:10px;border-radius:15px;cursor:pointer;
  transition:.2s;background:#fff;text-align:center}
.tn-char:hover,.tn-char.sel{border-color:#e53e3e;background:#fff5f5;transform:scale(1.05)}
.tn-char .dot{width:40px;height:40px;border-radius:50%;margin:0 auto 4px;border:2px solid #fff}
.tn-char .nm{font-size:12px;font-weight:700}
.tn-char .sub{font-size:10px;color:#718096}
.tn-note{font-size:12px;color:#718096;margin:.5rem 0 0}
`;

export const mountTennis: GameMount = (host, ctx) => {
  const style = document.createElement('style');
  style.textContent = CSS;

  const wrap = document.createElement('div');
  wrap.className = 'tn';

  const canvas = document.createElement('canvas');
  const hud = document.createElement('div');
  hud.className = 'tn-hud';
  hud.innerHTML =
    '<div class="tn-score rival"><p class="lbl">ライバル</p><p class="num" data-cpu>0</p></div>'
    + '<div class="tn-score"><p class="lbl">あなた</p><p class="num" data-player>0</p></div>';

  const stageEl = document.createElement('div');
  stageEl.className = 'tn-stage';
  stageEl.textContent = OPPONENTS[0].label;

  const countEl = document.createElement('div');
  countEl.className = 'tn-count';
  countEl.style.display = 'none';

  const msgBox = document.createElement('div');
  msgBox.className = 'tn-msg';

  wrap.append(canvas, hud, stageEl, countEl, msgBox);
  host.append(style, wrap);

  const cpuScoreEl = hud.querySelector('[data-cpu]') as HTMLElement;
  const playerScoreEl = hud.querySelector('[data-player]') as HTMLElement;
  const context = canvas.getContext('2d');
  if (!context) {
    msgBox.textContent = 'この端末では canvas が使えないため、遊べません。';
    return () => { host.replaceChildren(); };
  }
  const c2d: CanvasRenderingContext2D = context;

  let tournamentStage = 0;
  let gameMode: 'singles' | 'doubles' = 'singles';
  let isCountingDown = false;
  let runStartedAt = 0;
  let lastClickTime = 0;
  let isPowerShot = false;
  let selectedCharIndex = -1;
  let gameActive = false;
  let animationId = 0;
  let countdownTimer: ReturnType<typeof setInterval> | null = null;
  let revealTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const player = { x: 0, y: 0, score: 0, swing: 0, speed: 7.5, color: '#e53e3e', power: 1.0 };
  const partner: Fighter = { x: 0, y: 0, swing: 0, speed: 6.0, color: '#fff', active: false };
  const cpu = { x: 0, y: 80, score: 0, speed: 3.0, color: '#975a16' };
  const cpuPartner: Fighter = { x: 0, y: 80, swing: 0, speed: 3.0, color: '#38a169', active: false };
  const ball: Ball = {
    x: 0, y: 0, dx: 0, dy: 0, radius: 10, speed: 6, serving: true, effect: 0, serveTimer: null,
  };

  // 画布は置き場所に合わせる。元は window だったが、プロダクトの外枠（ヘッダ）のぶん食い違う。
  const resize = (): void => {
    const rect = host.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width));
    canvas.height = Math.max(1, Math.round(rect.height));
    player.x = canvas.width / 2;
    player.y = canvas.height * 0.85;
    partner.x = canvas.width * 0.3;
    partner.y = canvas.height * 0.7;
    cpu.x = canvas.width / 2;
    cpuPartner.x = canvas.width * 0.7;
  };

  const observer = new ResizeObserver(() => resize());
  observer.observe(host);
  resize();

  const clearServeTimer = (): void => {
    if (ball.serveTimer) {
      clearTimeout(ball.serveTimer);
      ball.serveTimer = null;
    }
  };

  const resetBall = (isPlayerServe: boolean): void => {
    clearServeTimer();
    ball.serving = true;
    ball.effect = 0;
    ball.speed = OPPONENTS[Math.min(tournamentStage, OPPONENTS.length - 1)].ballSpeed;
    if (isPlayerServe) {
      ball.y = player.y - 45;
      ball.x = player.x + 20;
    } else {
      ball.serving = false;
      ball.x = cpu.x;
      ball.y = cpu.y + 45;
      ball.dy = ball.speed;
      ball.dx = (Math.random() - 0.5) * 8;
    }
  };

  const showMessage = (render: () => void): void => {
    if (revealTimer) clearTimeout(revealTimer);
    revealTimer = setTimeout(() => {
      if (disposed) return;
      render();
      msgBox.style.display = 'block';
    }, 500);
  };

  const drawCharacter = (
    x: number, y: number, isPlayerSide: boolean, swingFrame: number, color: string,
  ): void => {
    c2d.save();
    c2d.translate(x, y);

    c2d.fillStyle = 'rgba(0,0,0,0.2)';
    c2d.beginPath(); c2d.ellipse(0, 10, 22, 10, 0, 0, Math.PI * 2); c2d.fill();

    c2d.fillStyle = color;
    c2d.beginPath(); c2d.arc(0, -42, 12, Math.PI, 0); c2d.fill();
    c2d.fillRect(-15, -42, 30, 4);
    c2d.fillStyle = '#ffdbac';
    c2d.beginPath(); c2d.arc(0, -32, 10, 0, Math.PI * 2); c2d.fill();

    c2d.fillStyle = '#4a2c2c';
    c2d.fillRect(-5, -30, 10, 2);

    c2d.fillStyle = isPlayerSide ? '#2b6cb0' : color;
    c2d.fillRect(-12, -25, 24, 20);
    c2d.fillStyle = isPlayerSide ? color : '#2b6cb0';
    c2d.fillRect(-12, -25, 5, 20);
    c2d.fillRect(7, -25, 5, 20);

    c2d.fillStyle = '#4a2c2c';
    c2d.fillRect(-14, -5, 10, 8);
    c2d.fillRect(4, -5, 10, 8);

    const armAngle = isPlayerSide ? (swingFrame > 0 ? -Math.PI / 1.2 : Math.PI / 4) : Math.PI / 4;
    c2d.save();
    c2d.translate(0, -20); c2d.rotate(armAngle);
    c2d.strokeStyle = '#fff'; c2d.lineWidth = 4;
    c2d.beginPath(); c2d.moveTo(0, 0); c2d.lineTo(25, 0); c2d.stroke();
    c2d.translate(25, 0);
    c2d.strokeStyle = '#ffd700'; c2d.lineWidth = 5;
    c2d.beginPath(); c2d.ellipse(15, 0, 10, 15, Math.PI / 2, 0, Math.PI * 2); c2d.stroke();
    c2d.restore();

    c2d.restore();
  };

  // ── 画面（メッセージ枠）─────────────────────────────────────────────

  const renderModeSelect = (title = 'テニス', note = ''): void => {
    msgBox.replaceChildren();
    const h = document.createElement('h2'); h.textContent = title;
    const p = document.createElement('p'); p.textContent = 'どうやってあそぶ？';
    msgBox.append(h, p);
    for (const [mode, label] of [['singles', 'ひとりで'], ['doubles', 'ふたりで']] as const) {
      const b = document.createElement('button');
      b.className = 'tn-btn';
      b.textContent = label;
      b.addEventListener('click', () => {
        gameMode = mode;
        renderCharSelect();
      });
      msgBox.appendChild(b);
    }
    if (note) {
      const n = document.createElement('p'); n.className = 'tn-note'; n.textContent = note;
      msgBox.appendChild(n);
    }
    msgBox.style.display = 'block';
  };

  const renderCharSelect = (): void => {
    msgBox.replaceChildren();
    const h = document.createElement('h2'); h.textContent = 'テニス';
    const p = document.createElement('p'); p.textContent = 'だれにする？';
    const grid = document.createElement('div'); grid.className = 'tn-chars';
    const confirm = document.createElement('button');
    confirm.className = 'tn-btn';
    confirm.textContent = 'これにきめた！';
    confirm.disabled = true;

    CHARACTERS.forEach((char, i) => {
      const card = document.createElement('div');
      card.className = 'tn-char';
      const dot = document.createElement('div');
      dot.className = 'dot';
      dot.style.background = char.color;
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = char.name;
      const sub = document.createElement('div'); sub.className = 'sub'; sub.textContent = CHARACTER_NOTES[i];
      card.append(dot, nm, sub);
      card.addEventListener('click', () => {
        selectedCharIndex = i;
        for (const el of grid.children) el.classList.remove('sel');
        card.classList.add('sel');
        confirm.disabled = false;
      });
      grid.appendChild(card);
    });

    confirm.addEventListener('click', () => {
      const char = CHARACTERS[selectedCharIndex];
      player.color = char.color;
      player.speed = 8.5 * char.speedMult;
      player.power = char.powerMult;
      renderReady('このキャラで冒険にでかけよう！');
    });

    msgBox.append(h, p, grid, confirm);
    msgBox.style.display = 'block';
  };

  const renderReady = (body: string, title = 'テニス'): void => {
    msgBox.replaceChildren();
    const h = document.createElement('h2'); h.textContent = title;
    const p = document.createElement('p'); p.textContent = body;
    const b = document.createElement('button');
    b.className = 'tn-btn';
    b.textContent = 'スタート！';
    b.addEventListener('click', startCountdown);
    msgBox.append(h, p, b);
    if (!ctx.canRecord) {
      const n = document.createElement('p');
      n.className = 'tn-note';
      n.textContent = 'ログインすると、どこまで行けたかが記録に残ります。';
      msgBox.appendChild(n);
    }
    msgBox.style.display = 'block';
  };

  function startCountdown(): void {
    if (tournamentStage === 0) runStartedAt = Date.now();
    msgBox.style.display = 'none';
    isCountingDown = true;
    countEl.style.display = 'block';
    let count = 3;
    countEl.textContent = String(count);
    countdownTimer = setInterval(() => {
      count--;
      if (count === 0) {
        countEl.textContent = 'GO!';
      } else if (count < 0) {
        if (countdownTimer) clearInterval(countdownTimer);
        countdownTimer = null;
        countEl.style.display = 'none';
        isCountingDown = false;
        nextMatch();
      } else {
        countEl.textContent = String(count);
      }
    }, 800);
  }

  function nextMatch(): void {
    const config = OPPONENTS[tournamentStage];
    cpu.speed = config.speed;
    cpu.color = config.color;
    cpuPartner.speed = config.speed * 0.9;
    cpuPartner.color = config.color;
    stageEl.textContent = config.label;

    partner.active = gameMode === 'doubles';
    cpuPartner.active = gameMode === 'doubles';

    player.score = 0;
    cpu.score = 0;
    updateScoreDisplay();
    resetBall(true);
    msgBox.style.display = 'none';
    gameActive = true;
    if (animationId) cancelAnimationFrame(animationId);
    draw();
  }

  /** 走りの終わり。到達したワールド数がこのゲームの点になる。 */
  const finishRun = (clearedWorlds: number): void => {
    ctx.onFinish(clearedWorlds, runStartedAt || Date.now());
  };

  function updateScoreDisplay(): void {
    playerScoreEl.textContent = String(player.score);
    cpuScoreEl.textContent = String(cpu.score);
    if (player.score < POINTS_TO_WIN && cpu.score < POINTS_TO_WIN) return;

    gameActive = false;
    if (player.score >= POINTS_TO_WIN) {
      tournamentStage++;
      if (tournamentStage >= OPPONENTS.length) {
        const cleared = OPPONENTS.length;
        tournamentStage = 0;
        finishRun(cleared);
        showMessage(() => renderModeSelect('🏆 ぜんぶクリア！ 🏆', 'あなたは真のスーパーヒーローです！'));
      } else {
        showMessage(() => renderReady('つぎのワールドへいこう！', 'コースクリア！'));
      }
    } else {
      const cleared = tournamentStage;
      tournamentStage = 0;
      finishRun(cleared);
      showMessage(() => renderReady('あきらめないでもういっかい！', 'ミス！'));
    }
  }

  const update = (): void => {
    if (!gameActive || isCountingDown) return;

    player.x = Math.max(45, Math.min(canvas.width - 45, player.x));
    player.y = Math.max(canvas.height / 2 + 50, Math.min(canvas.height - 45, player.y));

    const targetCpu = gameMode === 'doubles' && ball.x > canvas.width / 2 ? cpuPartner : cpu;
    if (targetCpu.x < ball.x - 5) targetCpu.x += targetCpu.speed;
    else if (targetCpu.x > ball.x + 5) targetCpu.x -= targetCpu.speed;

    if (ball.serving) {
      if (!ball.serveTimer) {
        ball.serveTimer = setTimeout(() => {
          ball.serving = false;
          ball.dy = -ball.speed;
          ball.dx = (Math.random() - 0.5) * 8;
          player.swing = 15;
          ball.serveTimer = null;
        }, 1500);
      }
      return;
    }

    ball.x += ball.dx;
    ball.y += ball.dy;
    if (ball.x < 30 || ball.x > canvas.width - 30) ball.dx *= -1;

    const checkHit = (h: { x: number; y: number; swing: number }, isMainPlayer: boolean): void => {
      if (ball.dy > 0 && Math.abs(ball.y - h.y) < 65 && Math.abs(ball.x - h.x) < 55) {
        h.swing = 15;
        let currentSpeed = ball.speed;
        if (isMainPlayer) {
          currentSpeed *= player.power;
          if (isPowerShot) {
            currentSpeed *= 1.6;
            ball.effect = 25;
            isPowerShot = false;
          } else {
            ball.effect = 0;
          }
        }
        ball.dy = -currentSpeed;
        ball.dx = (ball.x - h.x) * 0.45;
      }
    };
    checkHit(player, true);
    if (partner.active) {
      if (ball.dy > 0 && ball.y < player.y - 100) {
        if (partner.x < ball.x) partner.x += partner.speed;
        else partner.x -= partner.speed;
      }
      checkHit(partner, false);
    }

    const cpuHit = (c: { x: number; y: number }): void => {
      if (ball.dy < 0 && Math.abs(ball.y - c.y) < 45 && Math.abs(ball.x - c.x) < 55) {
        ball.dy = ball.speed;
        ball.dx = (ball.x - c.x) * 0.45;
        ball.effect = 0;
      }
    };
    cpuHit(cpu);
    if (cpuPartner.active) cpuHit(cpuPartner);

    if (ball.y < 0) {
      player.score++;
      updateScoreDisplay();
      if (gameActive) resetBall(false);
    } else if (ball.y > canvas.height) {
      cpu.score++;
      updateScoreDisplay();
      if (gameActive) resetBall(true);
    }

    if (player.swing > 0) player.swing--;
    if (partner.swing > 0) partner.swing--;
    if (ball.effect > 0) ball.effect--;
  };

  function draw(): void {
    c2d.fillStyle = '#38a169';
    c2d.fillRect(0, 0, canvas.width, canvas.height);

    c2d.strokeStyle = 'rgba(255,255,255,0.7)';
    c2d.lineWidth = 4;
    c2d.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);
    c2d.beginPath();
    c2d.moveTo(30, canvas.height / 2);
    c2d.lineTo(canvas.width - 30, canvas.height / 2);
    c2d.stroke();

    c2d.save();
    if (ball.effect > 0) {
      c2d.shadowBlur = 20;
      c2d.shadowColor = '#f00';
      c2d.fillStyle = '#ff4d4d';
      c2d.beginPath(); c2d.arc(ball.x, ball.y, ball.radius + 3, 0, Math.PI * 2); c2d.fill();
      c2d.fillStyle = '#fff';
      c2d.fillRect(ball.x + Math.random() * 20 - 10, ball.y + Math.random() * 20 - 10, 4, 4);
    } else {
      c2d.fillStyle = '#ff0';
      c2d.beginPath(); c2d.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); c2d.fill();
      c2d.strokeStyle = '#000'; c2d.lineWidth = 1; c2d.stroke();
    }
    c2d.restore();

    drawCharacter(player.x, player.y, true, player.swing, player.color);
    if (partner.active) drawCharacter(partner.x, partner.y, true, partner.swing, partner.color);
    drawCharacter(cpu.x, cpu.y, false, 0, cpu.color);
    if (cpuPartner.active) drawCharacter(cpuPartner.x, cpuPartner.y, false, 0, cpuPartner.color);

    update();
    if (gameActive || isCountingDown) animationId = requestAnimationFrame(draw);
  }

  // ── 入力 ────────────────────────────────────────────────────────────

  const registerClick = (): void => {
    const now = Date.now();
    isPowerShot = now - lastClickTime < 300;
    lastClickTime = now;
  };

  const handleInteraction = (clientX: number, clientY: number): void => {
    if (!gameActive || isCountingDown) return;
    const rect = canvas.getBoundingClientRect();
    player.x = clientX - rect.left;
    const mouseY = clientY - rect.top;
    if (mouseY > canvas.height / 2 + 50) player.y = mouseY;
  };

  const onMouseMove = (e: MouseEvent): void => handleInteraction(e.clientX, e.clientY);
  const onTouchStart = (e: TouchEvent): void => {
    const touch = e.touches[0];
    if (!touch) return;
    handleInteraction(touch.clientX, touch.clientY);
    registerClick();
  };
  const onTouchMove = (e: TouchEvent): void => {
    const touch = e.touches[0];
    if (!touch) return;
    handleInteraction(touch.clientX, touch.clientY);
  };

  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', registerClick);
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: true });

  renderModeSelect();

  return () => {
    disposed = true;
    gameActive = false;
    isCountingDown = false;
    if (animationId) cancelAnimationFrame(animationId);
    if (countdownTimer) clearInterval(countdownTimer);
    if (revealTimer) clearTimeout(revealTimer);
    clearServeTimer();
    observer.disconnect();
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', registerClick);
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    host.replaceChildren();
  };
};
