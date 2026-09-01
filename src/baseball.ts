// やきゅう（ホームランダービー）。tennis-game リポジトリの baseball.html を移した。
//
// 中身（球速・当たり判定・観客・絵）は変えていない。変えたのは4つ。
//  - 画布の大きさを window ではなく置き場所（host）から取る。
//  - RETRY が location.reload() だったのを、その場でやり直す形にした。読み直すと遊び場ごと
//    立ち上げ直しになるうえ、記録を送る前に画面が消える。
//  - 飛ぶ文字（HIT! など）を document.body ではなく置き場所に入れる。画面を離れた後に
//    body へ残り続けるのを避ける。
//  - 3アウトで onFinish を呼ぶ。得点がこのゲームの点になる。

import type { GameMount } from './types';

type Ball = { x: number; y: number; radius: number; vx: number; vy: number; active: boolean; hit: boolean };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };
type Person = { x: number; y: number; color: string; offset: number; jump: number };

const AUDIENCE_COLORS = ['#e74c3c', '#f1c40f', '#3498db', '#9b59b6', '#e67e22', '#ffffff'];

const CSS = `
.bb{position:absolute;inset:0;overflow:hidden;background:#2c3e50;touch-action:manipulation;
  font:14px/1.5 "Helvetica Neue",Arial,sans-serif;user-select:none;-webkit-user-select:none}
.bb canvas{display:block;width:100%;height:100%;
  background:linear-gradient(to bottom,#87CEEB 0%,#87CEEB 40%,#2ecc71 60%,#27ae60 100%)}
.bb-hud{position:absolute;top:16px;left:16px;color:#fff;text-shadow:2px 2px 4px rgba(0,0,0,.5);
  pointer-events:none;z-index:10}
.bb-hud .s{font-size:24px;font-weight:700}
.bb-hud .o{font-size:20px}
.bb-start{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;
  background:rgba(255,255,255,.95);padding:2.5rem;border-radius:1.5rem;
  box-shadow:0 10px 30px rgba(0,0,0,.4);width:85%;max-width:420px;z-index:100;box-sizing:border-box}
.bb-start h1{font-size:34px;font-weight:900;color:#2563eb;margin:0 0 1rem}
.bb-start h2{font-size:28px;font-weight:700;color:#dc2626;margin:0 0 .5rem}
.bb-start p{margin:0 0 1.5rem;color:#374151;font-weight:500}
.bb-btn{background:#3b82f6;color:#fff;font-weight:700;padding:12px 40px;border:0;border-radius:999px;
  box-shadow:0 4px 10px rgba(0,0,0,.2);cursor:pointer;font-size:15px;font-family:inherit}
.bb-btn:active{transform:scale(.95)}
.bb-fb{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);font-size:36px;
  font-weight:900;pointer-events:none;z-index:50;transition:top 1s,opacity 1s}
`;

export const mountBaseball: GameMount = (host, ctx) => {
  const style = document.createElement('style');
  style.textContent = CSS;

  const wrap = document.createElement('div');
  wrap.className = 'bb';
  const canvas = document.createElement('canvas');

  const hud = document.createElement('div');
  hud.className = 'bb-hud';
  hud.innerHTML = '<div class="s">SCORE: <span data-score>0</span></div><div class="o">OUTS: <span data-outs>0</span> / 3</div>';

  const startScreen = document.createElement('div');
  startScreen.className = 'bb-start';

  wrap.append(canvas, hud, startScreen);
  host.append(style, wrap);

  const scoreEl = hud.querySelector('[data-score]') as HTMLElement;
  const outsEl = hud.querySelector('[data-outs]') as HTMLElement;
  const context = canvas.getContext('2d');
  if (!context) {
    startScreen.textContent = 'この端末では canvas が使えないため、遊べません。';
    return () => { host.replaceChildren(); };
  }
  const c2d: CanvasRenderingContext2D = context;

  let score = 0;
  let outs = 0;
  let gameState: 'START' | 'PLAYING' | 'GAMEOVER' = 'START';
  let ball: Ball | null = null;
  let startedAt = 0;
  const bat = { angle: -Math.PI / 3, swinging: false, length: 110 };
  let pitcherAction = 0;
  let particles: Particle[] = [];
  let audience: Person[] = [];
  let animationId = 0;
  let disposed = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  // 画面を離れた後に走る setTimeout を残さない。飛ぶ文字も投球の間合いもこれで止まる。
  const later = (fn: () => void, ms: number): void => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!disposed) fn();
    }, ms);
    timers.add(id);
  };

  const initAudience = (): void => {
    audience = [];
    for (let i = 0; i < 150; i++) {
      audience.push({
        x: Math.random() * canvas.width,
        y: Math.random() * (canvas.height * 0.15) + canvas.height * 0.25,
        color: AUDIENCE_COLORS[Math.floor(Math.random() * AUDIENCE_COLORS.length)],
        offset: Math.random() * Math.PI * 2,
        jump: 0,
      });
    }
  };

  const resize = (): void => {
    const rect = host.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width));
    canvas.height = Math.max(1, Math.round(rect.height));
    initAudience();
  };
  const observer = new ResizeObserver(() => resize());
  observer.observe(host);
  resize();

  const spawnBall = (): void => {
    pitcherAction = 1.0;
    // スピードは得点に関わらず一定（元の実装のまま）。
    const speed = 6;
    later(() => {
      if (gameState !== 'PLAYING') return;
      ball = {
        x: canvas.width / 2, y: canvas.height * 0.45, radius: 10,
        vx: 0, vy: speed, active: true, hit: false,
      };
    }, 300);
  };

  const createParticles = (x: number, y: number, color: string): void => {
    for (let i = 0; i < 15; i++) {
      particles.push({ x, y, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, life: 1.0, color });
    }
  };

  const showFeedback = (text: string, color = '#fbbf24'): void => {
    const div = document.createElement('div');
    div.className = 'bb-fb';
    div.style.color = color;
    div.textContent = text;
    wrap.appendChild(div);
    later(() => {
      div.style.top = '20%';
      div.style.opacity = '0';
      later(() => div.remove(), 1000);
    }, 50);
  };

  const audienceExcited = (): void => {
    for (const person of audience) person.jump = 15 + Math.random() * 15;
  };

  const renderStart = (): void => {
    startScreen.replaceChildren();
    const h = document.createElement('h1');
    h.textContent = 'BASEBALL STAR';
    const p = document.createElement('p');
    p.innerHTML = 'スピードはずっと一定だよ！<br>自分のペースで打ち返そう！';
    const btn = document.createElement('button');
    btn.className = 'bb-btn';
    btn.textContent = 'PLAY START';
    btn.addEventListener('click', beginGame);
    startScreen.append(h, p, btn);
    startScreen.style.display = 'block';
  };

  const renderGameOver = (): void => {
    startScreen.replaceChildren();
    const h = document.createElement('h2');
    h.textContent = 'GAME OVER';
    const p = document.createElement('p');
    p.textContent = `SCORE: ${score}`;
    const btn = document.createElement('button');
    btn.className = 'bb-btn';
    btn.textContent = 'RETRY';
    // 元は location.reload() だった。読み直すと遊び場ごと立ち上げ直しになる。
    btn.addEventListener('click', beginGame);
    startScreen.append(h, p, btn);
    startScreen.style.display = 'block';
  };

  function beginGame(): void {
    startScreen.style.display = 'none';
    gameState = 'PLAYING';
    score = 0;
    outs = 0;
    ball = null;
    particles = [];
    startedAt = Date.now();
    scoreEl.textContent = '0';
    outsEl.textContent = '0';
    spawnBall();
  }

  const recordOut = (): void => {
    outs++;
    outsEl.textContent = String(outs);
    showFeedback('STRIKE!', '#ff4444');
    if (outs < 3) return;
    gameState = 'GAMEOVER';
    ctx.onFinish(score, startedAt || Date.now());
    later(renderGameOver, 500);
  };

  const swing = (): void => {
    if (gameState !== 'PLAYING' || bat.swinging) return;
    bat.swinging = true;
    bat.angle = -Math.PI / 1.5;

    let hitSomething = false;
    if (ball && ball.active && !ball.hit) {
      const distY = Math.abs(ball.y - canvas.height * 0.88);
      if (distY < 60) {
        ball.hit = true;
        ball.vy = -14 - Math.random() * 10;
        ball.vx = (Math.random() - 0.5) * 12;
        hitSomething = true;
        if (distY < 20) {
          score += 100;
          createParticles(ball.x, ball.y, '#FFD700');
          showFeedback('HOME RUN!!');
          audienceExcited();
        } else {
          score += 50;
          createParticles(ball.x, ball.y, '#FFFFFF');
          showFeedback('HIT!');
        }
        scoreEl.textContent = String(score);
      }
    }

    if (!hitSomething && ball && ball.active && !ball.hit && ball.y > canvas.height * 0.6) {
      recordOut();
    }
  };

  const update = (): void => {
    if (gameState !== 'PLAYING') return;

    if (ball && ball.active) {
      ball.x += ball.vx;
      ball.y += ball.vy;
      if (ball.y > canvas.height + 50 || ball.y < -200) {
        spawnBall();
        ball = null;
      }
    }

    if (bat.swinging) {
      bat.angle += 0.5;
      if (bat.angle >= Math.PI / 3) {
        bat.swinging = false;
        bat.angle = -Math.PI / 3;
      }
    }

    if (pitcherAction > 0) pitcherAction -= 0.05;

    // 元は forEach の途中で splice していて、消えた次の粒を飛ばしていた。後ろから消す。
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
      if (p.life <= 0) particles.splice(i, 1);
    }

    for (const person of audience) {
      if (person.jump > 0) person.jump *= 0.9;
    }
  };

  const drawPerson = (x: number, y: number, isPitcher: boolean, actionVal: number): void => {
    const bodyColor = isPitcher ? '#1e40af' : '#ffffff';
    const skinColor = '#f3e5ab';
    const capColor = isPitcher ? '#1e3a8a' : '#b91c1c';

    c2d.lineWidth = 2;
    c2d.fillStyle = '#ffffff';
    c2d.beginPath();
    c2d.moveTo(x, y);
    c2d.lineTo(x - 12, y + 20);
    c2d.lineTo(x - 5, y + 20);
    c2d.lineTo(x, y - 5);
    c2d.lineTo(x + 5, y + 20);
    c2d.lineTo(x + 12, y + 20);
    c2d.closePath();
    c2d.fill();
    c2d.stroke();

    c2d.fillStyle = bodyColor;
    c2d.beginPath();
    c2d.rect(x - 10, y - 40, 20, 35);
    c2d.fill();
    c2d.stroke();

    c2d.strokeStyle = skinColor;
    c2d.lineWidth = 6;
    if (isPitcher) {
      const throwAngle = actionVal > 0 ? (1 - actionVal) * Math.PI : 0;
      c2d.beginPath();
      c2d.moveTo(x, y - 30);
      c2d.lineTo(x + Math.sin(throwAngle) * 25, y - 30 + Math.cos(throwAngle) * 25);
      c2d.stroke();
    } else {
      const armAngle = bat.angle + 0.2;
      c2d.beginPath();
      c2d.moveTo(x, y - 30);
      c2d.lineTo(x + Math.cos(armAngle) * 30, y - 30 + Math.sin(armAngle) * 30);
      c2d.stroke();
    }

    c2d.fillStyle = skinColor;
    c2d.lineWidth = 2;
    c2d.beginPath();
    c2d.arc(x, y - 55, 12, 0, Math.PI * 2);
    c2d.fill();
    c2d.stroke();

    c2d.fillStyle = capColor;
    c2d.beginPath();
    c2d.arc(x, y - 58, 12, Math.PI, 0);
    c2d.fill();
    c2d.beginPath();
    c2d.rect(x - 12, y - 62, 24, 4);
    c2d.fill();
  };

  const drawAudience = (): void => {
    c2d.fillStyle = '#34495e';
    c2d.beginPath();
    c2d.moveTo(0, canvas.height * 0.25);
    c2d.lineTo(canvas.width, canvas.height * 0.25);
    c2d.lineTo(canvas.width, canvas.height * 0.45);
    c2d.lineTo(0, canvas.height * 0.45);
    c2d.fill();

    c2d.strokeStyle = '#2c3e50';
    c2d.lineWidth = 5;
    c2d.beginPath();
    c2d.moveTo(0, canvas.height * 0.45);
    c2d.lineTo(canvas.width, canvas.height * 0.45);
    c2d.stroke();

    const now = Date.now();
    for (const person of audience) {
      const wobble = Math.sin(now / 200 + person.offset) * 2;
      c2d.fillStyle = person.color;
      c2d.beginPath();
      c2d.arc(person.x, person.y - person.jump + wobble, 4, 0, Math.PI * 2);
      c2d.fill();
    }
  };

  const draw = (): void => {
    c2d.clearRect(0, 0, canvas.width, canvas.height);
    drawAudience();

    c2d.strokeStyle = 'rgba(255,255,255,0.3)';
    c2d.lineWidth = 2;
    c2d.beginPath();
    c2d.moveTo(canvas.width / 2, canvas.height * 0.5);
    c2d.lineTo(0, canvas.height);
    c2d.moveTo(canvas.width / 2, canvas.height * 0.5);
    c2d.lineTo(canvas.width, canvas.height);
    c2d.stroke();

    c2d.fillStyle = '#d35400';
    c2d.beginPath();
    c2d.ellipse(canvas.width / 2, canvas.height * 0.5, 60, 30, 0, 0, Math.PI * 2);
    c2d.fill();

    drawPerson(canvas.width / 2, canvas.height * 0.5, true, pitcherAction);

    c2d.fillStyle = '#d35400';
    c2d.beginPath();
    c2d.ellipse(canvas.width / 2, canvas.height * 0.88, 120, 60, 0, 0, Math.PI * 2);
    c2d.fill();

    drawPerson(canvas.width / 2 - 70, canvas.height * 0.88, false, 0);

    for (const p of particles) {
      c2d.globalAlpha = p.life;
      c2d.fillStyle = p.color;
      c2d.beginPath();
      c2d.arc(p.x, p.y, 4, 0, Math.PI * 2);
      c2d.fill();
    }
    c2d.globalAlpha = 1.0;

    if (ball && ball.active) {
      const shadowRadius = Math.max(0, ball.radius * (ball.y / (canvas.height * 0.88)));
      c2d.fillStyle = 'rgba(0,0,0,0.15)';
      c2d.beginPath();
      c2d.ellipse(ball.x, canvas.height * 0.88, shadowRadius, 5, 0, 0, Math.PI * 2);
      c2d.fill();

      c2d.fillStyle = 'white';
      c2d.beginPath();
      c2d.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      c2d.fill();
      c2d.strokeStyle = '#999';
      c2d.lineWidth = 1;
      c2d.stroke();
    }

    c2d.save();
    const armAngle = bat.angle + 0.2;
    c2d.translate(
      canvas.width / 2 - 70 + Math.cos(armAngle) * 30,
      canvas.height * 0.88 - 30 + Math.sin(armAngle) * 30,
    );
    c2d.rotate(bat.angle);
    c2d.fillStyle = '#5d4037';
    c2d.fillRect(0, -5, 25, 10);
    c2d.fillStyle = '#d7ccc8';
    c2d.fillRect(25, -8, bat.length - 25, 16);
    c2d.restore();

    animationId = requestAnimationFrame(() => {
      update();
      draw();
    });
  };

  const onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    swing();
  };
  canvas.addEventListener('mousedown', swing);
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });

  renderStart();
  draw();

  return () => {
    disposed = true;
    gameState = 'GAMEOVER';
    if (animationId) cancelAnimationFrame(animationId);
    for (const id of timers) clearTimeout(id);
    timers.clear();
    observer.disconnect();
    canvas.removeEventListener('mousedown', swing);
    canvas.removeEventListener('touchstart', onTouchStart);
    host.replaceChildren();
  };
};
