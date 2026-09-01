// ゲーム1本の形。ここが、あそびば（front）との唯一の約束ごと。
//
// このリポジトリは front を参照しない。依存は一方通行で、front がこちらを読む。
// 逆向きにすると、ゲームを直すたびに front を開くことになり、分けた意味が無くなる。
//
// canvas を持つゲームは、DOM を組み立てる画面とは作りが違う。違いをこの形に閉じ込めて、
// 「置き場所を渡す・後片付けの手を返す」だけにしてある。ここが揃っていれば、ゲームが
// 何本増えても、あそびば側は変わらない。

/** 続きからの読み出し。「まだ無い」と「読めなかった」を分ける。 */
export type SaveRead =
  | { readonly ok: true; readonly state: string | null }
  | { readonly ok: false };

/**
 * 続きからの1つの部分。
 *
 * 変わる速さが違うものは、別の部分に置く。ペットは本体（毎秒動く）ともちもの
 * （買った時だけ）を分けている。1つにすると、毎秒の保存のたびに、買ったものを
 * 丸ごと送り直すことになる。
 */
export type SavePart = {
  /** 置いてある状態。まだ無ければ null。読めなければ ok:false。 */
  readonly load: () => Promise<SaveRead>;
  /** 書く予定に入れる。実際に出るのは少し後（まとめて出す）。 */
  readonly put: (state: unknown) => void;
  /** 溜めている分を今すぐ出す。 */
  readonly flush: () => Promise<void>;
};

export type SaveSlot = SavePart & {
  /** 別の部分を開く。同じ名前で呼べば同じものが返る。 */
  readonly part: (name: string) => SavePart;
  /** 直近の書き込みが通ったか。 */
  readonly lastError: () => string | null;
};

export type GameContext = {
  /** 記録を残せるか（ログイン済みで、グループも決まっている）。 */
  readonly canRecord: boolean;
  /**
   * 1回の走りが終わったときに呼ぶ。score が何を指すかはゲームが決める
   * （あそびば側の表に、その説明が書いてある）。
   */
  readonly onFinish: (score: number, startedAt: number) => void;
  /**
   * 続きからの置き場。
   *
   * 読めなかったときは書かない作りになっているので、ゲーム側は put を呼ぶだけでよい。
   * 読めなかったのを「まだ無い」と取り違えて新規で始めると、次の保存が育てた分を
   * 空で上書きする。そこは あそびば側で塞いである。
   */
  readonly save: SaveSlot;
  /** 画面上部の帯に一言出す。保存の状態など、遊びの外の知らせに使う。 */
  readonly setStatus: (text: string) => void;
};

/** 置き場所に組み立てて、後片付けの手を返す。返した手は画面を離れるときに必ず呼ばれる。 */
export type GameMount = (host: HTMLElement, ctx: GameContext) => () => void;
