// サッカー。tennis-game リポジトリの soccer.html を移した。
//
// 中身（大きさ・摩擦・当たり判定・キーパーの動き・絵）は変えていない。変えたのは3つ。
//  - onclick="handleAction()" をリスナに。
//  - キーボードのリスナを window から外せるようにした（画面を離れた後も矢印キーを
//    拾い続けると、遊び場の他の画面でスクロールが効かなくなる）。
//  - 勝負がついたところで onFinish を呼ぶ。P1 の得点がこのゲームの点になる。
//
// 画布は 800x500 の固定で、大きさは CSS が合わせる（元の作りのまま）。中の座標が
// 固定なので、置き場所の大きさが変わっても当たり判定は動かない。

import type { GameMount } from './types';

const WIDTH = 800;
const HEIGHT = 500;
const PLAYER_RADIUS = 25;
const GK_RADIUS = 20;
const BALL_RADIUS = 15;
const GOAL_WIDTH = 10;
const GOAL_HEIGHT = 150;
const FRICTION = 0.98;
const SPEED_LIMIT = 7;
const SHOOT_POWER = 15;
const WINNING_SCORE = 5;

type Mover = {
  x: number; y: number; vx: number; vy: number;
  color: string; accel: number; radius: number;
  animFrame: number; kickTimer: number; isGK?: boolean;
};

const CSS = `
.sc{position:absolute;inset:0;overflow:hidden;background:#1a1a1a;touch-action:none;
  display:flex;align-items:center;justify-content:center;font:14px/1.5 sans-serif;
  user-select:none;-webkit-user-select:none}
.sc canvas{display:block;background:#2e7d32;box-shadow:0 0 20px rgba(0,0,0,.5);
  max-width:100%;max-height:100%}
.sc-ui{position:absolute;top:10px;left:0;right:0;pointer-events:none;display:flex;
  justify-content:center;gap:20px;color:#fff;font-size:1.2rem;font-weight:700;
  text-shadow:2px 2px 4px rgba(0,0,0,.5)}
.sc-count{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;
  font-size:6rem;font-weight:900;text-shadow:0 0 20px rgba(0,0,0,.5);pointer-events:none;z-index:20}
.sc-msg{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.9);
  color:#fff;padding:20px 40px;border-radius:15px;text-align:center;z-index:30;border:2px solid #fff;
  width:80%;max-width:400px;box-sizing:border-box}
.sc-msg h1{font-size:24px;font-weight:900;margin:0 0 1rem}
.sc-btn{background:#2563eb;color:#fff;padding:12px 32px;border:0;border-radius:999px;
  font-size:17px;font-weight:700;cursor:pointer;font-family:inherit}
.sc-btn:active{transform:scale(.95)}
.sc-touch{position:absolute;bottom:20px;left:0;right:0;height:150px;pointer-events:none;
  display:flex;justify-content:space-between;padding:0 30px;z-index:40;box-sizing:border-box}
.sc-joy{width:120px;height:120px;background:rgba(255,255,255,.1);border-radius:50%;position:relative;
  pointer-events:auto;border:2px solid rgba(255,255,255,.3)}
.sc-stick{width:50px;height:50px;background:rgba(255,255,255,.5);border-radius:50%;position:absolute;
  top:35px;left:35px;pointer-events:none}
.sc-shoot{width:80px;height:80px;background:rgba(255,255,255,.2);border:3px solid #fff;
  border-radius:50%;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;
  pointer-events:auto;user-select:none;align-self:flex-end}
.sc-shoot:active{transform:scale(.9)}
`;

export const mountSoccer: GameMount = (host, ctx) => {
  const style = document.createElement('style');
  style.textContent = CSS;

  const wrap = document.createElement('div');
  wrap.className = 'sc';

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const ui = document.createElement('div');
  ui.className = 'sc-ui';
  ui.innerHTML = '<div data-p1>P1: 0</div><div data-p2>P2: 0</div>';

  const countEl = document.createElement('div');
  countEl.className = 'sc-count';
  countEl.style.display = 'none';

  const msgBox = document.createElement('div');
  msgBox.className = 'sc-msg';
  msgBox.style.display = 'none';
  const msgText = document.createElement('h1');
  const actionButton = document.createElement('button');
  actionButton.className = 'sc-btn';
  msgBox.append(msgText, actionButton);

  const touch = document.createElement('div');
  touch.className = 'sc-touch';
  const joystick = document.createElement('div');
  joystick.className = 'sc-joy';
  const stick = document.createElement('div');
  stick.className = 'sc-stick';
  joystick.appendChild(stick);
  const shootBtn = document.createElement('div');
  shootBtn.className = 'sc-shoot';
  shootBtn.textContent = 'SHOOT';
  touch.append(joystick, shootBtn);

  wrap.append(canvas, ui, countEl, msgBox, touch);
  host.append(style, wrap);

  const scoreP1El = ui.querySelector('[data-p1]') as HTMLElement;
  const scoreP2El = ui.querySelector('[data-p2]') as HTMLElement;
  const context = canvas.getContext('2d');
  if (!context) {
    msgBox.textContent = 'この端末では canvas が使えないため、遊べません。';
    msgBox.style.display = 'block';
    return () => { host.replaceChildren(); };
  }
  const c2d: CanvasRenderingContext2D = context;

  let gameState: 'countdown' | 'playing' | 'goal' = 'countdown';
  const score = { p1: 0, p2: 0 };
  let mousePos = { x: 200, y: HEIGHT / 2 };
  let joystickVector = { x: 0, y: 0 };
  const keys: Record<string, boolean> = {};
  let animationId = 0;
  let countdownTimer: ReturnType<typeof setInterval> | null = null;
  let startedAt = Date.now();
  let disposed = false;

  const p1: Mover = { x: 200, y: HEIGHT / 2, vx: 0, vy: 0, color: '#2196F3', accel: 0.8, radius: PLAYER_RADIUS, animFrame: 0, kickTimer: 0 };
  const p2: Mover = { x: WIDTH - 200, y: HEIGHT / 2, vx: 0, vy: 0, color: '#F44336', accel: 0.8, radius: PLAYER_RADIUS, animFrame: 0, kickTimer: 0 };
  const gk1: Mover = { x: 50, y: HEIGHT / 2, vx: 0, vy: 0, color: '#4FC3F7', accel: 0.4, radius: GK_RADIUS, animFrame: 0, kickTimer: 0, isGK: true };
  const gk2: Mover = { x: WIDTH - 50, y: HEIGHT / 2, vx: 0, vy: 0, color: '#E57373', accel: 0.4, radius: GK_RADIUS, animFrame: 0, kickTimer: 0, isGK: true };
  const ball = { x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0, radius: BALL_RADIUS, animFrame: 0, kickTimer: 0 };
  const players = [p1, p2, gk1, gk2];

  const shoot = (player: Mover): void => {
    const dx = ball.x - player.x;
    const dy = ball.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < player.radius + ball.radius + 20) {
      const angle = Math.atan2(dy, dx);
      ball.vx = Math.cos(angle) * SHOOT_POWER;
      ball.vy = Math.sin(angle) * SHOOT_POWER;
      player.kickTimer = 10;
    }
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    keys[e.code] = true;
    if (e.code === 'Space' && gameState === 'playing') shoot(p2);
  };
  const onKeyUp = (e: KeyboardEvent): void => { keys[e.code] = false; };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const onMouseMove = (e: MouseEvent): void => {
    const rect = canvas.getBoundingClientRect();
    mousePos = {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };
  const onMouseDown = (): void => { if (gameState === 'playing') shoot(p1); };
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);

  const handleJoystick = (e: TouchEvent): void => {
    e.preventDefault();
    const t = e.touches[0];
    if (!t) return;
    const rect = joystick.getBoundingClientRect();
    const dx = t.clientX - (rect.left + rect.width / 2);
    const dy = t.clientY - (rect.top + rect.height / 2);
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), 50);
    const angle = Math.atan2(dy, dx);
    const moveX = Math.cos(angle) * dist;
    const moveY = Math.sin(angle) * dist;
    stick.style.transform = `translate(${moveX}px, ${moveY}px)`;
    joystickVector = { x: moveX / 50, y: moveY / 50 };
  };
  const onJoystickEnd = (): void => {
    stick.style.transform = 'translate(0, 0)';
    joystickVector = { x: 0, y: 0 };
  };
  const onShoot = (e: TouchEvent): void => {
    e.preventDefault();
    if (gameState === 'playing') shoot(p1);
  };
  joystick.addEventListener('touchstart', handleJoystick, { passive: false });
  joystick.addEventListener('touchmove', handleJoystick, { passive: false });
  joystick.addEventListener('touchend', onJoystickEnd);
  shootBtn.addEventListener('touchstart', onShoot, { passive: false });

  const startCountdown = (): void => {
    gameState = 'countdown';
    let countdownValue = 3;
    countEl.style.display = 'block';
    countEl.textContent = String(countdownValue);
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      if (disposed) return;
      countdownValue--;
      if (countdownValue > 0) {
        countEl.textContent = String(countdownValue);
      } else if (countdownValue === 0) {
        countEl.textContent = 'GO!';
      } else {
        if (countdownTimer) clearInterval(countdownTimer);
        countdownTimer = null;
        countEl.style.display = 'none';
        gameState = 'playing';
      }
    }, 1000);
  };

  const startNextRound = (): void => {
    p1.x = 200; p1.y = HEIGHT / 2; p1.vx = 0; p1.vy = 0;
    p2.x = WIDTH - 200; p2.y = HEIGHT / 2; p2.vx = 0; p2.vy = 0;
    gk1.x = 50; gk1.y = HEIGHT / 2;
    gk2.x = WIDTH - 50; gk2.y = HEIGHT / 2;
    ball.x = WIDTH / 2; ball.y = HEIGHT / 2; ball.vx = 0; ball.vy = 0;
    msgBox.style.display = 'none';
    startCountdown();
  };

  const handleAction = (): void => {
    if (score.p1 >= WINNING_SCORE || score.p2 >= WINNING_SCORE) {
      score.p1 = 0;
      score.p2 = 0;
      scoreP1El.textContent = 'P1: 0';
      scoreP2El.textContent = 'P2: 0';
      startedAt = Date.now();
    }
    startNextRound();
  };
  actionButton.addEventListener('click', handleAction);

  const checkCollision = (
    a: { x: number; y: number; vx: number; vy: number; radius: number },
    b: { x: number; y: number; vx: number; vy: number; radius: number },
  ): void => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = a.radius + b.radius;
    if (distance >= minDistance) return;
    const angle = Math.atan2(dy, dx);
    const force = 0.6;
    const ax = (a.x + Math.cos(angle) * minDistance - b.x) * force;
    const ay = (a.y + Math.sin(angle) * minDistance - b.y) * force;
    a.vx -= ax; a.vy -= ay;
    b.vx += ax; b.vy += ay;
  };

  const updateGK = (gk: Mover): void => {
    const goalTop = (HEIGHT - GOAL_HEIGHT) / 2;
    const goalBottom = goalTop + GOAL_HEIGHT;
    const targetY = Math.max(goalTop, Math.min(goalBottom, ball.y));
    if (gk.y < targetY) gk.vy += gk.accel;
    else gk.vy -= gk.accel;
    gk.vy *= 0.9;
  };

  const showResult = (text: string, btnText: string): void => {
    gameState = 'goal';
    msgText.textContent = text;
    actionButton.textContent = btnText;
    msgBox.style.display = 'block';
  };

  const checkWinStatus = (lastScorer: string): void => {
    scoreP1El.textContent = `P1: ${score.p1}`;
    scoreP2El.textContent = `P2: ${score.p2}`;
    if (score.p1 >= WINNING_SCORE) {
      // 勝負がついたところが1回の走りの終わり。P1 の得点を残す。
      ctx.onFinish(score.p1, startedAt);
      showResult('PLAYER 1 WINS!', 'REMATCH');
    } else if (score.p2 >= WINNING_SCORE) {
      ctx.onFinish(score.p1, startedAt);
      showResult('PLAYER 2 WINS!', 'REMATCH');
    } else {
      showResult(`${lastScorer} GOAL!`, 'NEXT ROUND');
    }
  };

  const update = (): void => {
    if (gameState === 'playing') {
      if (joystickVector.x !== 0 || joystickVector.y !== 0) {
        p1.vx += joystickVector.x * p1.accel * 1.5;
        p1.vy += joystickVector.y * p1.accel * 1.5;
      } else {
        const dx1 = mousePos.x - p1.x;
        const dy1 = mousePos.y - p1.y;
        if (Math.sqrt(dx1 * dx1 + dy1 * dy1) > 10) {
          const angle = Math.atan2(dy1, dx1);
          p1.vx += Math.cos(angle) * p1.accel;
          p1.vy += Math.sin(angle) * p1.accel;
        }
      }

      if (keys['ArrowUp']) p2.vy -= p2.accel;
      if (keys['ArrowDown']) p2.vy += p2.accel;
      if (keys['ArrowLeft']) p2.vx -= p2.accel;
      if (keys['ArrowRight']) p2.vx += p2.accel;

      updateGK(gk1);
      updateGK(gk2);
    }

    for (const obj of [...players, ball]) {
      obj.vx *= FRICTION;
      obj.vy *= FRICTION;
      const speed = Math.sqrt(obj.vx * obj.vx + obj.vy * obj.vy);
      if (obj.radius >= GK_RADIUS) {
        if (speed > SPEED_LIMIT) {
          obj.vx = (obj.vx / speed) * SPEED_LIMIT;
          obj.vy = (obj.vy / speed) * SPEED_LIMIT;
        }
        if (speed > 0.5) obj.animFrame += speed * 0.1;
        if (obj.kickTimer > 0) obj.kickTimer--;
      }
      obj.x += obj.vx;
      obj.y += obj.vy;
      if (obj.x < obj.radius) { obj.x = obj.radius; obj.vx *= -0.5; }
      if (obj.x > WIDTH - obj.radius) { obj.x = WIDTH - obj.radius; obj.vx *= -0.5; }
      if (obj.y < obj.radius) { obj.y = obj.radius; obj.vy *= -0.5; }
      if (obj.y > HEIGHT - obj.radius) { obj.y = HEIGHT - obj.radius; obj.vy *= -0.5; }
    }

    if (gameState !== 'playing') return;

    for (let i = 0; i < players.length; i++) {
      checkCollision(players[i], ball);
      for (let j = i + 1; j < players.length; j++) checkCollision(players[i], players[j]);
    }

    const goalTop = (HEIGHT - GOAL_HEIGHT) / 2;
    const goalBottom = goalTop + GOAL_HEIGHT;
    if (ball.y > goalTop && ball.y < goalBottom) {
      if (ball.x < ball.radius + 5) {
        score.p2++;
        checkWinStatus('PLAYER 2');
      } else if (ball.x > WIDTH - ball.radius - 5) {
        score.p1++;
        checkWinStatus('PLAYER 1');
      }
    }
  };

  const drawHuman = (player: Mover): void => {
    const { x, y, color, animFrame, kickTimer, vx, radius } = player;
    c2d.save();
    c2d.translate(x, y);
    const scale = radius / PLAYER_RADIUS;
    c2d.scale(vx < -0.1 ? -scale : scale, scale);

    c2d.strokeStyle = color;
    c2d.lineWidth = 4;
    c2d.lineCap = 'round';

    const legSwing = kickTimer > 0 ? 25 : Math.sin(animFrame) * 15;
    const armSwing = Math.cos(animFrame) * 15;

    c2d.beginPath(); c2d.arc(0, -15, 8, 0, Math.PI * 2); c2d.stroke();
    c2d.beginPath(); c2d.moveTo(0, -7); c2d.lineTo(0, 10); c2d.stroke();
    c2d.beginPath(); c2d.moveTo(0, -2); c2d.lineTo(armSwing, 8);
    c2d.moveTo(0, -2); c2d.lineTo(-armSwing, 8); c2d.stroke();
    c2d.beginPath(); c2d.moveTo(0, 10); c2d.lineTo(legSwing, 22);
    c2d.moveTo(0, 10); c2d.lineTo(-legSwing, 22); c2d.stroke();

    if (player.isGK) {
      c2d.fillStyle = '#fff';
      c2d.beginPath(); c2d.arc(armSwing, 8, 4, 0, Math.PI * 2); c2d.fill();
      c2d.beginPath(); c2d.arc(-armSwing, 8, 4, 0, Math.PI * 2); c2d.fill();
    }
    c2d.restore();
  };

  const drawBall = (): void => {
    c2d.save();
    c2d.translate(ball.x, ball.y);
    c2d.fillStyle = '#fff';
    c2d.beginPath(); c2d.arc(0, 0, ball.radius, 0, Math.PI * 2); c2d.fill();
    c2d.strokeStyle = '#333';
    c2d.lineWidth = 2;
    c2d.stroke();
    c2d.beginPath();
    c2d.moveTo(-5, -5); c2d.lineTo(5, -5); c2d.lineTo(8, 0);
    c2d.lineTo(5, 5); c2d.lineTo(-5, 5); c2d.lineTo(-8, 0); c2d.closePath();
    c2d.stroke();
    c2d.restore();
  };

  const drawPitch = (): void => {
    c2d.fillStyle = '#2e7d32';
    c2d.fillRect(0, 0, WIDTH, HEIGHT);
    c2d.strokeStyle = 'rgba(255,255,255,0.4)';
    c2d.lineWidth = 4;
    c2d.strokeRect(10, 10, WIDTH - 20, HEIGHT - 20);
    c2d.beginPath();
    c2d.moveTo(WIDTH / 2, 10); c2d.lineTo(WIDTH / 2, HEIGHT - 10); c2d.stroke();
    c2d.beginPath(); c2d.arc(WIDTH / 2, HEIGHT / 2, 70, 0, Math.PI * 2); c2d.stroke();

    c2d.fillStyle = '#ffffff';
    const goalY = (HEIGHT - GOAL_HEIGHT) / 2;
    c2d.fillRect(0, goalY, GOAL_WIDTH, GOAL_HEIGHT);
    c2d.fillRect(WIDTH - GOAL_WIDTH, goalY, GOAL_WIDTH, GOAL_HEIGHT);
  };

  const gameLoop = (): void => {
    update();
    c2d.clearRect(0, 0, WIDTH, HEIGHT);
    drawPitch();
    drawBall();
    for (const p of players) drawHuman(p);
    animationId = requestAnimationFrame(gameLoop);
  };

  gameLoop();
  startCountdown();

  return () => {
    disposed = true;
    if (animationId) cancelAnimationFrame(animationId);
    if (countdownTimer) clearInterval(countdownTimer);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    joystick.removeEventListener('touchstart', handleJoystick);
    joystick.removeEventListener('touchmove', handleJoystick);
    joystick.removeEventListener('touchend', onJoystickEnd);
    shootBtn.removeEventListener('touchstart', onShoot);
    host.replaceChildren();
  };
};
