// BGM。
//
// 外から 音の ファイルを 読まない（画像も CSS も 読まない のと 同じ 決まり。音は
// とくに 重く、1本の ゲームの ために メガバイトを 落とすことに なる）。かわりに、
// 曲を「マス目の 表」として ここに 持ち、その場で 鳴らす。
//
// もとは Song Maker（Chrome Music Lab）で つくった MIDI。マス目の 曲なので、
// 8つの マスと、そのマスで 鳴る 音の 高さ（MIDIの ばんごう）に そのまま 写せる。
// 120BPM・1マス 0.25びょう・8マスで ひとまわり（2びょう）。音の 長さは ぜんぶ 1マス。

/** 1マスの ながさ（びょう）。 */
export const STEP = 0.25;

/** 1マスに 鳴る 音。MIDIの ばんごう（60 が まんなかの ド）。 */
export const SONG: readonly (readonly number[])[] = [
  [55, 57, 59, 60, 62, 64],
  [57, 59, 60, 62],
  [59, 60],
  [52, 53, 55, 57],
  [53, 55],
  [65, 67, 69, 71],
  [67, 69],
  [59],
];

/** ひとまわりの ながさ（びょう）。 */
export const LOOP = SONG.length * STEP;

const freqOf = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/**
 * みじかい 音を WAV（音の ファイルの かたち）に して、文字として 返す。
 *
 * ブラウザに よっては、その場で 音を 作る 道（AudioContext）が 閉じている。アプリの
 * 中の ブラウザや、わくの 中に 置かれた ページで おきる。そういう ときでも、
 * ふつうの 音の ファイルなら 鳴る ことが ある。外から 読まない 決まりは まもったまま
 * 道を もう1本 持つために、ファイルも ここで 作る。
 */
const wavFrom = (
  seconds: number, rate: number, sample: (t: number) => number,
): string => {
  const n = Math.floor(rate * seconds);
  const bytes = new Uint8Array(44 + n * 2);
  const view = new DataView(bytes.buffer);
  const text = (at: number, str: string): void => {
    for (let i = 0; i < str.length; i++) view.setUint8(at + i, str.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + n * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);     // PCM
  view.setUint16(22, 1, true);     // 1つの みち
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, sample(i / rate)));
    view.setInt16(44 + i * 2, Math.round(v * 32767), true);
  }
  // btoa は 1もじずつ しか 受けないので、小分けに して 文字に する。
  let raw = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    raw += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:audio/wav;base64,${btoa(raw)}`;
};

/** ためしの 1音。 */
const wavTone = (midi: number, seconds: number): string =>
  wavFrom(seconds, 8000, (t) => {
    const env = Math.min(1, t * 40) * Math.max(0, 1 - t / seconds);
    return Math.sin(2 * Math.PI * freqOf(midi) * t) * env * 0.5;
  });

/**
 * 曲 ひとまわりぶんを、音の ファイルに して 返す。
 *
 * その場で 作る 道（AudioContext）が 使えない ブラウザでも、これなら 鳴る ことが
 * ある。作るのは 1回きりで、2びょうぶん・11kHz・かたみち だけなので 小さい。
 */
const wavSong = (): string =>
  wavFrom(LOOP, 11025, (t) => {
    const step = Math.min(SONG.length - 1, Math.floor(t / STEP));
    const chord = SONG[step];
    const inStep = t - step * STEP;
    const env = Math.min(1, inStep * 80) * Math.max(0, 1 - inStep / (STEP * 0.95));
    let v = 0;
    for (const midi of chord) v += Math.sin(2 * Math.PI * freqOf(midi) * t);
    return (v / Math.sqrt(chord.length)) * env * 0.22;
  });

/** 鳴らす 音の たね。みじかい 合図。 */
export type Sfx = 'build' | 'coin' | 'win' | 'lose' | 'alarm' | 'draw' | 'move';

export type Music = {
  /** 鳴らす／止める。鳴らすのは 指で さわった あとだけ（ブラウザの 決まり）。 */
  readonly setOn: (on: boolean) => void;
  readonly isOn: () => boolean;
  /**
   * 指で さわる たびに 呼ぶ。
   *
   * iPhone は 画面を 離れたり 時間が たつと 音を 止める（suspended）。そのままだと
   * 「さっきまで 鳴っていたのに 鳴らない」に なるので、さわるたびに 起こし直す。
   */
  readonly wake: () => void;
  /** いま 音が 出る ところまで 来ているか。鳴らない ときの 知らせに つかう。 */
  readonly running: () => boolean;
  /**
   * ためしに 1つ 鳴らす。その場で 作る 道と、音の ファイルの 道、両方で 鳴らす。
   * どちらが 通ったかを 返す。
   */
  readonly test: () => Promise<string>;
  /** いまの ようす。鳴らない ときの 手がかりに なる。 */
  readonly status: () => string;
  /**
   * 曲を「音の ファイル」の 道だけで 鳴らす。
   *
   * アプリの 中の ブラウザには、その場で 作る 音だけを 黙らせる ものが ある。
   * 「running と 出ているのに 聞こえない」ときの 逃げ道。
   */
  readonly forceFile: () => Promise<string>;
  /** みじかい 合図を 1つ 鳴らす。 */
  readonly sfx: (kind: Sfx) => void;
  /** 後片付け。画面を 離れる ときに 必ず 呼ぶ。 */
  readonly dispose: () => void;
};

type Ctor = { new (): AudioContext };

export const createMusic = (): Music => {
  let ac: AudioContext | null = null;
  let master: GainNode | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let nextLoopAt = 0;
  let on = false;
  let dead = false;
  let el: HTMLAudioElement | null = null;
  let elResult = 'まだ';
  /** その場で 作る 道が だめだった ときに まわす、ファイルの 曲。 */
  let loopEl: HTMLAudioElement | null = null;
  let songUri = '';

  const open = (): boolean => {
    if (ac) return true;
    const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
    const Ctx = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctx) return false;          // 音が 出せない 端末でも、ゲームは そのまま 遊べる
    ac = new Ctx();
    // 1つぶんの 無音を すぐ 鳴らして、箱の ふたを 開ける。iPhone や アプリの 中の
    // ブラウザは、さわった その場で 鳴らさないと あとから 鳴らなく なる。
    try {
      const buf = ac.createBuffer(1, 1, 22050);
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.connect(ac.destination);
      src.start(0);
    } catch { /* 開けなくても 下で ためす */ }
    master = ac.createGain();
    master.gain.value = 0.22;        // ずっと 鳴るので ひかえめに、でも 聞こえるように
    // マス目の 曲は 同じ 高さの 音が かさなって かたくなるので、高い ところを 少し 落とす。
    const soft = ac.createBiquadFilter();
    soft.type = 'lowpass';
    soft.frequency.value = 2400;
    master.connect(soft);
    soft.connect(ac.destination);
    return true;
  };

  /** 1つの 音。やわらかい 三かく波に、すぐ 落ちる 山を かける。 */
  const voice = (at: number, midi: number, together: number): void => {
    if (!ac || !master) return;
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freqOf(midi);
    const gain = ac.createGain();
    // 同時に 鳴る 数で わる。6つ かさなっても うるさく ならないように。
    const peak = 0.9 / Math.sqrt(together);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + STEP * 0.95);
    osc.connect(gain);
    gain.connect(master);
    osc.start(at);
    osc.stop(at + STEP + 0.05);
  };

  /** みじかい 合図。BGMとは べつの 音いろで、少し 大きめに 鳴らす。 */
  const blip = (
    at: number, midi: number, len: number, type: OscillatorType, vol: number,
  ): void => {
    if (!ac || !master) return;
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.value = freqOf(midi);
    osc.frequency.setValueAtTime(freqOf(midi), at);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(vol, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + len);
    osc.connect(gain);
    gain.connect(master);
    osc.start(at);
    osc.stop(at + len + 0.03);
  };

  /** 合図ごとの 音の ならび。[音の高さ, いつ, ながさ] の くりかえし。 */
  const SFX: Record<Sfx, { readonly type: OscillatorType; readonly vol: number;
    readonly notes: readonly (readonly [number, number, number])[] }> = {
    build: { type: 'square', vol: 0.5, notes: [[72, 0, 0.09], [79, 0.07, 0.14]] },
    coin: { type: 'square', vol: 0.45, notes: [[88, 0, 0.06], [93, 0.05, 0.1]] },
    win: { type: 'triangle', vol: 0.6, notes: [[72, 0, 0.1], [76, 0.09, 0.1], [79, 0.18, 0.1], [84, 0.27, 0.3]] },
    lose: { type: 'sawtooth', vol: 0.35, notes: [[62, 0, 0.14], [57, 0.12, 0.18], [50, 0.26, 0.34]] },
    alarm: { type: 'square', vol: 0.4, notes: [[69, 0, 0.16], [64, 0.16, 0.16], [69, 0.32, 0.16], [64, 0.48, 0.22]] },
    draw: { type: 'triangle', vol: 0.5, notes: [[76, 0, 0.08], [83, 0.07, 0.16]] },
    move: { type: 'triangle', vol: 0.4, notes: [[67, 0, 0.07], [74, 0.06, 0.12]] },
  };

  const scheduleLoop = (start: number): void => {
    SONG.forEach((chord, i) => {
      for (const midi of chord) voice(start + i * STEP, midi, chord.length);
    });
  };

  // さきの ぶんだけ 入れておく。setInterval は ずれるので、鳴らす 時こくは
  // AudioContext の 時計で 決める。
  const pump = (): void => {
    if (!on || !ac || dead) return;
    const now = ac.currentTime;
    if (nextLoopAt < now) nextLoopAt = now + 0.05;
    while (nextLoopAt < now + 1.2) {
      scheduleLoop(nextLoopAt);
      nextLoopAt += LOOP;
    }
  };

  const setOn = (want: boolean): void => {
    if (dead || want === on) return;
    on = want;
    if (!on) {
      if (timer) clearInterval(timer);
      timer = null;
      stopFallback();
      if (ac) void ac.suspend();
      return;
    }
    if (!open() || !ac) {
      void startFallback();
      return;
    }
    const box = ac;
    void box.resume().catch(() => undefined).then(() => {
      if (!on || dead) return;
      if (box.state === 'running') return;
      // 起こせなかった。ブラウザが その場で 作る 音を 止めている ので、
      // 音の ファイルの 道に 切りかえる。
      void startFallback();
    });
    nextLoopAt = ac.currentTime + 0.08;
    pump();
    timer = setInterval(pump, 400);
  };

  /** ファイルの 曲を まわす。すでに まわって いれば なにも しない。 */
  const startFallback = async (): Promise<void> => {
    if (dead || !on) return;
    try {
      if (!loopEl) {
        if (!songUri) songUri = wavSong();
        loopEl = new Audio(songUri);
        loopEl.loop = true;
        loopEl.preload = 'auto';
        loopEl.volume = 0.5;
      }
      await loopEl.play();
      elResult = 'ok（曲も ファイルで）';
    } catch (e) {
      elResult = `だめ（${e instanceof Error ? e.name : 'エラー'}）`;
    }
  };

  const stopFallback = (): void => {
    if (loopEl) loopEl.pause();
  };

  return {
    setOn,
    isOn: () => on,
    wake: () => {
      if (!on || dead || !ac) return;
      if (ac.state !== 'running') void ac.resume();
    },
    running: () => ac !== null && ac.state === 'running',
    test: async () => {
      open();
      if (ac && ac.state !== 'running') {
        try { await ac.resume(); } catch { /* だめでも ファイルの 道を ためす */ }
      }
      if (ac && ac.state === 'running' && master) {
        const now = ac.currentTime + 0.01;
        blip(now, 76, 0.12, 'triangle', 0.6);
        blip(now + 0.12, 83, 0.22, 'triangle', 0.6);
      }
      // 音の ファイルの 道。こちらだけ 通る ブラウザが ある。
      try {
        if (!el) {
          el = new Audio(wavTone(83, 0.25));
          el.preload = 'auto';
        }
        el.volume = 1;
        el.currentTime = 0;
        await el.play();
        elResult = 'ok';
      } catch (e) {
        elResult = `だめ（${e instanceof Error ? e.name : 'エラー'}）`;
      }
      if (on && (!ac || ac.state !== 'running')) await startFallback();
      return `つくる音:${ac ? ac.state : 'つかえない'} ／ ファイル音:${elResult}`;
    },
    status: () => `つくる音:${ac ? ac.state : 'つかえない'} ／ ファイル音:${elResult}`,
    forceFile: async () => {
      if (dead) return 'おわり';
      on = true;
      if (timer) clearInterval(timer);
      timer = null;
      if (ac) {
        try { await ac.suspend(); } catch { /* 止まらなくても 下で 鳴らす */ }
      }
      await startFallback();
      return elResult;
    },
    sfx: (kind) => {
      // 音を けして いる ときは 鳴らさない。まだ 一度も さわって いない ときは、
      // ここで 箱を 開けない（ブラウザに はじかれる）。
      if (!on || dead || !ac) return;
      if (ac.state !== 'running') void ac.resume();
      const spec = SFX[kind];
      const now = ac.currentTime + 0.01;
      for (const [midi, at, len] of spec.notes) blip(now + at, midi, len, spec.type, spec.vol);
    },
    dispose: () => {
      dead = true;
      on = false;
      if (timer) clearInterval(timer);
      timer = null;
      stopFallback();
      loopEl = null;
      el = null;
      if (ac) void ac.close();
      ac = null;
      master = null;
    },
  };
};
