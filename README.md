# asobi-games

あそびば（[asobi.tachiiri.com](https://asobi.tachiiri.com)）のゲーム。

front（`tachiiri-org/front`）から **submodule** として読まれる。ここは front を
参照しない。依存は一方通行で、front がこちらを読む。逆向きにすると、ゲームを直す
たびに front を開くことになり、分けた意味が無くなる。

## 置き方

```
src/types.ts      あそびばとの約束ごと。これだけが front と共有する形
src/tennis.ts     ゲーム1本 = 1ファイル（ペットだけ大きいので src/pet/ に分けてある）
```

## ゲームの形

1本のゲームは `GameMount` を1つ出す。

```ts
import type { GameMount } from './types';

export const mountTennis: GameMount = (host, ctx) => {
  // host に組み立てる
  return () => { /* 後片付け。画面を離れるときに必ず呼ばれる */ };
};
```

`ctx` でできること。

| | |
|---|---|
| `ctx.onFinish(score, startedAt)` | 1回の走りが終わったときに呼ぶ。ランキングに載る |
| `ctx.save` | 続きから。`load()` / `put()` / `part(名前)` |
| `ctx.canRecord` | 記録を残せるか（未ログインなら false） |
| `ctx.setStatus(text)` | 画面上部の帯に一言出す |

後片付けの手は**必ず返すこと**。`requestAnimationFrame` や `setInterval` を止めないと、
別の画面へ移ったあとも裏で回り続ける。

## 決まっていること

- **見た目は自前で持つ**。外から CSS を読まない（Tailwind の CDN などは使わない）
- **`localStorage` は使わない**。続きからは `ctx.save` に置く。そうしないと、端末を
  変えたときに消えるし、その子のアカウントに紐づかない
- **`window` に物を置かない**。置くなら後片付けで消す

## どのゲームを出すかは front が決める

ゲームの一覧（名前・ログインが要るか・ランキングの向き）は front 側の表にある。
「ログインが要るか」は認証の関門に効くので、こちら側では変えられない。

## 確かめ方

```
npm install
npm run typecheck
```

実際に動かすのは front 側。
