// しんけいすいじゃく（タイムアタック）。tennis-game リポジトリの tramp.html を移した。
//
// 遊びの中身（8種16枚・めくる待ち時間・音・その場のランキング）は変えていない。変えたのは4つ。
//  - Tailwind の CDN をやめ、当てていたクラスを CSS にした。
//  - AudioContext を組み立てのときに作り、後片付けで閉じる。読み込んだだけで音の口を
//    開けたままにしない。
//  - その場のランキング（名前つき・遊んでいる間だけ）は残したうえで、クリアしたら
//    テナントのランキングにも記録する。名前は遊びの中の話で、記録はアカウントに付く。
//  - 点はクリアタイムの 10分の1秒。速いほど上（表の ranking: 'low'）。
//
// カウントダウンの待ちは await new Promise(setTimeout) のままだと、画面を離れた後も
// 続きが走る。組み立てのたびに作り直す世代番号で、離れた後の続きを捨てる。

import type { GameMount } from './types';

const SYMBOLS = ['🍎', '💎', '🚗', '👻', '⭐️', '🍀', '🏀', '☀️'];

type SoundType = 'flip' | 'match' | 'wrong' | 'countdown' | 'start' | 'win';
type Rank = { name: string; time: number; moves: number };

const CSS = `
.tr{position:absolute;inset:0;overflow-y:auto;background:#f1f5f9;color:#1e293b;
  font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;
  display:flex;flex-direction:column;align-items:center;padding:32px 16px;box-sizing:border-box}
.tr-wrap{max-width:28rem;width:100%;position:relative}
.tr-mute{position:absolute;top:-44px;right:0;background:#fff;padding:8px;border-radius:50%;
  box-shadow:0 1px 2px rgba(0,0,0,.05);border:1px solid #e2e8f0;color:#64748b;cursor:pointer;
  font-size:16px;line-height:1}
.tr-card-panel{background:#fff;border-radius:1.5rem;padding:2rem;box-shadow:0 20px 25px -5px rgba(0,0,0,.1);
  text-align:center;border:1px solid #e2e8f0;box-sizing:border-box}
.tr h1{font-size:30px;font-weight:800;margin:0 0 1.5rem;color:#2563eb}
.tr-field{margin-bottom:1.5rem;text-align:left}
.tr-field label{display:block;font-size:12px;font-weight:700;color:#64748b;margin-bottom:.5rem;
  text-transform:uppercase;letter-spacing:.05em}
.tr-field input{width:100%;padding:12px 16px;border-radius:.75rem;border:2px solid #f1f5f9;
  outline:none;font-size:17px;box-sizing:border-box;font-family:inherit}
.tr-field input:focus{border-color:#3b82f6}
.tr-field input.bad{border-color:#ef4444}
.tr-primary{width:100%;background:#2563eb;color:#fff;font-weight:700;padding:16px;border:0;
  border-radius:.75rem;box-shadow:0 10px 15px -3px rgba(0,0,0,.1);font-size:17px;cursor:pointer;
  font-family:inherit}
.tr-primary:hover{background:#1d4ed8}
.tr-secondary{width:100%;background:#f1f5f9;color:#475569;font-weight:700;padding:12px;border:0;
  border-radius:.75rem;font-size:15px;cursor:pointer;font-family:inherit;margin-top:.75rem}
.tr-head{font-size:24px;font-weight:800;margin:0 0 1rem;text-align:center;color:#2563eb}
.tr-stats{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem}
.tr-stat{background:#fff;padding:12px;border-radius:.75rem;box-shadow:0 1px 2px rgba(0,0,0,.05);
  text-align:center}
.tr-stat .k{font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;text-align:left;
  padding:0 8px;margin:0}
.tr-stat .v{font-size:20px;font-family:ui-monospace,monospace;font-weight:700;margin:0}
.tr-board{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;perspective:1000px;margin-bottom:1.5rem}
.tr-slot{aspect-ratio:3/4;position:relative}
.tr-inner{transition:transform .6s;transform-style:preserve-3d;cursor:pointer;position:relative;
  width:100%;height:100%}
.tr-inner.flip{transform:rotateY(180deg)}
.tr-front,.tr-back{position:absolute;width:100%;height:100%;backface-visibility:hidden;
  display:flex;align-items:center;justify-content:center;border-radius:.75rem;
  box-shadow:0 4px 6px -1px rgba(0,0,0,.1)}
.tr-front{background:#fff;transform:rotateY(180deg);border:2px solid #f1f5f9;font-size:30px}
.tr-back{background-image:linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%);color:#fff;
  font-size:20px;font-weight:700;font-style:italic}
.tr-inner.done{opacity:.3;cursor:default;transform:scale(.9);transition:all .3s}
.tr-give{color:#94a3b8;font-size:13px;display:block;margin:0 auto;text-decoration:underline;
  background:none;border:0;cursor:pointer;font-family:inherit}
.tr-count{position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;
  background:rgba(0,0,0,.2);pointer-events:none}
.tr-count span{font-size:96px;font-weight:900;color:#fff;font-style:italic;
  filter:drop-shadow(0 8px 8px rgba(0,0,0,.3))}
@keyframes tr-pop{0%{transform:scale(.5);opacity:0}50%{transform:scale(1.2);opacity:1}100%{transform:scale(1);opacity:0}}
.tr-count span.go{animation:tr-pop 1s ease-in-out forwards}
.tr-modal{position:absolute;inset:0;background:rgba(15,23,42,.8);display:flex;align-items:center;
  justify-content:center;padding:16px;z-index:60;overflow-y:auto}
.tr-modal-inner{background:#fff;border-radius:1.5rem;padding:2rem;max-width:24rem;width:100%;
  box-shadow:0 25px 50px -12px rgba(0,0,0,.25);box-sizing:border-box}
.tr-result{display:flex;justify-content:space-around;margin-bottom:2rem;background:#eff6ff;
  padding:1rem;border-radius:1rem}
.tr-result p{margin:0}
.tr-result .k{font-size:12px;color:#60a5fa;font-weight:700;text-transform:uppercase}
.tr-result .v{font-size:20px;font-weight:700;color:#1d4ed8}
.tr-rank{list-style:none;padding:0;margin:0 0 2rem}
.tr-rank li{display:flex;justify-content:space-between;align-items:center;padding:8px;
  border-radius:.75rem;background:#f8fafc;margin-bottom:8px}
.tr-rank li.top{background:#fefce8;border:1px solid #fef08a}
.tr-rank .nm{font-weight:700;font-size:13px}
.tr-rank .tm{font-family:ui-monospace,monospace;font-weight:700;color:#2563eb;font-size:13px}
.tr-hidden{display:none}
`;

export const mountTramp: GameMount = (host, ctx) => {
  const style = document.createElement('style');
  style.textContent = CSS;

  const page = document.createElement('div');
  page.className = 'tr';
  const wrap = document.createElement('div');
  wrap.className = 'tr-wrap';
  page.appendChild(wrap);
  host.append(style, page);

  // ── 音。組み立てのときに作り、後片付けで閉じる。
  const AudioCtor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const audio = AudioCtor ? new AudioCtor() : null;
  let isMuted = false;

  const playSound = (type: SoundType): void => {
    if (isMuted || !audio) return;
    const now = audio.currentTime;
    if (type === 'win') {
      for (const [i, f] of [523.25, 659.25, 783.99, 1046.5].entries()) {
        const o = audio.createOscillator();
        const g = audio.createGain();
        o.type = 'sine';
        o.connect(g);
        g.connect(audio.destination);
        o.frequency.setValueAtTime(f, now + i * 0.1);
        g.gain.setValueAtTime(0.1, now + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.5);
        o.start(now + i * 0.1);
        o.stop(now + i * 0.1 + 0.5);
      }
      return;
    }
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.connect(gain);
    gain.connect(audio.destination);
    if (type === 'flip') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'match') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.1);
      osc.frequency.setValueAtTime(783.99, now + 0.2);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now); osc.stop(now + 0.4);
    } else if (type === 'wrong') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.2);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
      osc.start(now); osc.stop(now + 0.2);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(type === 'start' ? 880 : 440, now);
      const tail = type === 'start' ? 0.3 : 0.1;
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + tail);
      osc.start(now); osc.stop(now + tail);
    }
  };

  // ── 画面の部品
  const muteBtn = document.createElement('button');
  muteBtn.className = 'tr-mute';
  muteBtn.textContent = '🔊';

  const startScreen = document.createElement('div');
  startScreen.className = 'tr-card-panel';

  const gameArea = document.createElement('div');
  gameArea.className = 'tr-hidden';

  const countOverlay = document.createElement('div');
  countOverlay.className = 'tr-count tr-hidden';
  const countText = document.createElement('span');
  countOverlay.appendChild(countText);

  const winModal = document.createElement('div');
  winModal.className = 'tr-modal tr-hidden';

  wrap.append(muteBtn, startScreen, gameArea, countOverlay, winModal);

  // ── 状態
  let flippedCards: HTMLElement[] = [];
  let matchedPairs = 0;
  let moves = 0;
  let isProcessing = false;
  let startTime: number | null = null;
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let currentPlayer = 'Player';
  let rankings: Rank[] = [];
  let disposed = false;
  // 組み立てのたびに増やす。カウントダウンの続きが、離れた後に走るのを捨てるための番号。
  let generation = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const later = (fn: () => void, ms: number): void => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!disposed) fn();
    }, ms);
    timers.add(id);
  };
  const wait = (ms: number): Promise<void> => new Promise((resolve) => {
    const id = setTimeout(() => { timers.delete(id); resolve(); }, ms);
    timers.add(id);
  });

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = '名前を入力してください';

  const timerDisplay = document.createElement('p');
  timerDisplay.className = 'v';
  timerDisplay.textContent = '0.0s';
  const movesDisplay = document.createElement('p');
  movesDisplay.className = 'v';
  movesDisplay.textContent = '0';
  const board = document.createElement('div');
  board.className = 'tr-board';

  const shuffle = <T,>(array: T[]): T[] => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  const finishGame = (): void => {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    const finalTime = (Date.now() - (startTime ?? Date.now())) / 1000;
    playSound('win');

    rankings.push({ name: currentPlayer, time: finalTime, moves });
    rankings.sort((a, b) => a.time - b.time);
    rankings = rankings.slice(0, 5);

    // テナントのランキングへは10分の1秒で残す。点は整数で持つ決まりなので、
    // 秒のまま丸めると 0.4 秒の差が消える。
    ctx.onFinish(Math.round(finalTime * 10), startTime ?? Date.now());

    renderWin(finalTime);
  };

  const checkMatch = (): void => {
    isProcessing = true;
    const [c1, c2] = flippedCards;
    if (c1.dataset.symbol === c2.dataset.symbol) {
      later(() => {
        playSound('match');
        c1.classList.add('done');
        c2.classList.add('done');
        matchedPairs++;
        flippedCards = [];
        isProcessing = false;
        if (matchedPairs === SYMBOLS.length) finishGame();
      }, 500);
    } else {
      later(() => {
        playSound('wrong');
        c1.classList.remove('flip');
        c2.classList.remove('flip');
        flippedCards = [];
        isProcessing = false;
      }, 800);
    }
  };

  const handleCardClick = (card: HTMLElement): void => {
    if (isProcessing || card.classList.contains('flip') || card.classList.contains('done') || !startTime) return;
    playSound('flip');
    card.classList.add('flip');
    flippedCards.push(card);
    if (flippedCards.length === 2) {
      moves++;
      movesDisplay.textContent = String(moves);
      checkMatch();
    }
  };

  const createCardElement = (symbol: string): HTMLElement => {
    const slot = document.createElement('div');
    slot.className = 'tr-slot';
    const inner = document.createElement('div');
    inner.className = 'tr-inner';
    inner.dataset.symbol = symbol;
    const front = document.createElement('div');
    front.className = 'tr-front';
    front.textContent = symbol;
    const back = document.createElement('div');
    back.className = 'tr-back';
    back.textContent = '?';
    inner.append(front, back);
    inner.addEventListener('click', () => handleCardClick(inner));
    slot.appendChild(inner);
    return slot;
  };

  const initGameBoard = (): void => {
    board.replaceChildren();
    flippedCards = [];
    matchedPairs = 0;
    moves = 0;
    isProcessing = false;
    startTime = null;
    movesDisplay.textContent = '0';
    timerDisplay.textContent = '0.0s';
    winModal.classList.add('tr-hidden');
    for (const symbol of shuffle([...SYMBOLS, ...SYMBOLS])) {
      board.appendChild(createCardElement(symbol));
    }
  };

  const beginGame = (): void => {
    startTime = Date.now();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!startTime) return;
      timerDisplay.textContent = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
    }, 100);
  };

  const startCountdown = async (): Promise<void> => {
    const gen = ++generation;
    startScreen.classList.add('tr-hidden');
    gameArea.classList.remove('tr-hidden');
    countOverlay.classList.remove('tr-hidden');

    for (const text of ['3', '2', '1', 'START!']) {
      if (disposed || gen !== generation) return;
      countText.textContent = text;
      playSound(text === 'START!' ? 'start' : 'countdown');
      countText.classList.remove('go');
      void countText.offsetWidth; // アニメーションを流し直すために一度読む
      countText.classList.add('go');
      await wait(1000);
    }
    if (disposed || gen !== generation) return;
    countOverlay.classList.add('tr-hidden');
    beginGame();
  };

  const showStart = (): void => {
    generation++; // 走っているカウントダウンがあれば、そこで終わらせる
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    startTime = null;
    gameArea.classList.add('tr-hidden');
    winModal.classList.add('tr-hidden');
    startScreen.classList.remove('tr-hidden');
  };

  // ── 画面を組み立てる
  const renderStart = (): void => {
    startScreen.replaceChildren();
    const h = document.createElement('h1');
    h.textContent = 'Memory Attack';
    const field = document.createElement('div');
    field.className = 'tr-field';
    const label = document.createElement('label');
    label.textContent = 'Player Name';
    field.append(label, nameInput);
    const btn = document.createElement('button');
    btn.className = 'tr-primary';
    btn.textContent = 'ゲーム開始';
    btn.addEventListener('click', () => {
      // Web Audio はユーザーの操作からしか起こせない。
      if (audio?.state === 'suspended') void audio.resume();
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.classList.add('bad');
        later(() => nameInput.classList.remove('bad'), 1000);
        return;
      }
      currentPlayer = name;
      initGameBoard();
      void startCountdown();
    });
    startScreen.append(h, field, btn);
  };

  const renderGameArea = (): void => {
    gameArea.replaceChildren();
    const h = document.createElement('h1');
    h.className = 'tr-head';
    h.textContent = 'Memory Attack';

    const stats = document.createElement('div');
    stats.className = 'tr-stats';
    for (const [key, valueEl] of [['Time', timerDisplay], ['Moves', movesDisplay]] as const) {
      const box = document.createElement('div');
      box.className = 'tr-stat';
      const k = document.createElement('p');
      k.className = 'k';
      k.textContent = key;
      box.append(k, valueEl);
      stats.appendChild(box);
    }

    const give = document.createElement('button');
    give.className = 'tr-give';
    give.textContent = 'タイトルに戻る';
    give.addEventListener('click', showStart);

    gameArea.append(h, stats, board, give);
  };

  const renderWin = (finalTime: number): void => {
    winModal.replaceChildren();
    const inner = document.createElement('div');
    inner.className = 'tr-modal-inner';

    const head = document.createElement('div');
    head.style.cssText = 'text-align:center;margin-bottom:1.5rem';
    head.innerHTML = '<div style="font-size:48px;margin-bottom:.5rem">🏆</div><h2 style="font-size:24px;font-weight:700;margin:0">Result</h2>';

    const result = document.createElement('div');
    result.className = 'tr-result';
    for (const [k, v] of [['Time', `${finalTime.toFixed(2)}s`], ['Moves', String(moves)]] as const) {
      const box = document.createElement('div');
      box.style.textAlign = 'center';
      const kp = document.createElement('p');
      kp.className = 'k';
      kp.textContent = k;
      const vp = document.createElement('p');
      vp.className = 'v';
      vp.textContent = v;
      box.append(kp, vp);
      result.appendChild(box);
    }

    const rankHead = document.createElement('h3');
    rankHead.style.cssText = 'font-size:13px;font-weight:700;color:#94a3b8;margin:0 0 .75rem';
    rankHead.textContent = '📊 このセッションの記録 (Top 5)';

    const list = document.createElement('ol');
    list.className = 'tr-rank';
    rankings.forEach((r, i) => {
      const li = document.createElement('li');
      if (i === 0) li.classList.add('top');
      const left = document.createElement('div');
      left.style.cssText = 'display:flex;align-items:center;gap:8px';
      const no = document.createElement('span');
      no.style.cssText = `font-size:12px;font-weight:700;color:${i === 0 ? '#ca8a04' : '#94a3b8'}`;
      no.textContent = String(i + 1);
      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = r.name;
      left.append(no, nm);
      const tm = document.createElement('span');
      tm.className = 'tm';
      tm.textContent = `${r.time.toFixed(2)}s`;
      li.append(left, tm);
      list.appendChild(li);
    });

    const retry = document.createElement('button');
    retry.className = 'tr-primary';
    retry.textContent = '名前を変えて挑戦';
    retry.addEventListener('click', () => {
      showStart();
      nameInput.focus();
    });

    const fast = document.createElement('button');
    fast.className = 'tr-secondary';
    fast.textContent = '同じ名前で再戦';
    fast.addEventListener('click', () => {
      initGameBoard();
      void startCountdown();
    });

    inner.append(head, result, rankHead, list, retry, fast);
    winModal.appendChild(inner);
    winModal.classList.remove('tr-hidden');
  };

  muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    muteBtn.textContent = isMuted ? '🔇' : '🔊';
  });

  renderStart();
  renderGameArea();

  return () => {
    disposed = true;
    generation++;
    if (timerInterval) clearInterval(timerInterval);
    for (const id of timers) clearTimeout(id);
    timers.clear();
    void audio?.close().catch(() => undefined);
    host.replaceChildren();
  };
};
