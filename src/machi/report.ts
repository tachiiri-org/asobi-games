// まちの レポート。
//
// 自分で 書く ところ。できごとは かってに ひかえ（log）に たまるので、書く ときに
// それを タップして 文に 入れられる——「なにを 書けばいいか 分からない」で 止まらない
// ように、下じきの ほうから 出す。
//
// 書いた ものは べつの 置き場に 置く。長い 文が 入るので、毎秒の 保存に のせない。

import type { LogEntry, Report } from './types';

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

export const REPORTS_MAX = 30;

export const dateText = (at: number): string => {
  const d = new Date(at);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const serializeReports = (reports: readonly Report[]): string =>
  JSON.stringify({ version: 1, reports: [...reports] });

export const deserializeReports = (raw: string): Report[] | null => {
  try {
    const got = JSON.parse(raw) as { version?: number; reports?: unknown } | null;
    if (!got || got.version !== 1 || !Array.isArray(got.reports)) return null;
    return (got.reports as Partial<Report>[]).slice(0, REPORTS_MAX).map((r, i) => ({
      id: typeof r?.id === 'string' && r.id ? r.id : `r${i}`,
      title: typeof r?.title === 'string' ? r.title.slice(0, 30) : 'レポート',
      body: typeof r?.body === 'string' ? r.body.slice(0, 2000) : '',
      at: typeof r?.at === 'number' ? r.at : Date.now(),
      pop: typeof r?.pop === 'number' ? r.pop : 0,
    }));
  } catch {
    return null;
  }
};

/** レポートの たな。読む・書く・けす。 */
export const buildReportList = (opts: {
  readonly reports: readonly Report[];
  readonly onNew: () => void;
  readonly onOpen: (report: Report) => void;
  readonly onRemove: (report: Report) => void;
  readonly onClose: () => void;
}): HTMLElement => {
  const wrap = el('div');
  wrap.append(
    el('div', 'mc-mtitle', `📓 まちの レポート（${opts.reports.length}）`),
    el('p', 'mc-note', 'まちで あった ことを 書いて のこそう。あとから 読みかえせる。'),
  );

  const list = el('div', 'mc-plist');
  for (const report of opts.reports) {
    const row = el('div', 'mc-prow');
    const mid = el('div', 'mc-pmid');
    mid.append(el('div', 'mc-pname', report.title));
    mid.append(el('div', 'mc-wnote', `${dateText(report.at)}・じんこう ${report.pop}人`));
    const open = el('button', 'mc-btn blue', '📖');
    open.addEventListener('click', () => opts.onOpen(report));
    const del = el('button', 'mc-btn gray', '🗑');
    del.addEventListener('click', () => opts.onRemove(report));
    const side = el('div', 'mc-pside');
    side.append(open, del);
    row.append(mid, side);
    list.appendChild(row);
  }
  if (opts.reports.length === 0) {
    list.appendChild(el('p', 'mc-note', 'まだ 1まいも ない。「あたらしく かく」から はじめよう。'));
  }
  wrap.appendChild(list);

  const foot = el('div', 'mc-row2');
  const add = el('button', 'mc-btn green', '✏️ あたらしく かく');
  add.disabled = opts.reports.length >= REPORTS_MAX;
  add.addEventListener('click', () => opts.onNew());
  const close = el('button', 'mc-btn gray', 'とじる');
  close.addEventListener('click', () => opts.onClose());
  foot.append(add, close);
  wrap.appendChild(foot);
  return wrap;
};

/** レポートを 書く ところ。できごとを タップすると 文に 入る。 */
export const buildReportEditor = (opts: {
  readonly report: Report | null;
  readonly cityName: string;
  readonly pop: number;
  readonly coins: number;
  readonly log: readonly LogEntry[];
  readonly onSave: (title: string, body: string) => void;
  readonly onCancel: () => void;
}): HTMLElement => {
  const wrap = el('div');
  wrap.append(
    el('div', 'mc-mtitle', opts.report ? '📖 レポート' : '✏️ レポートを かく'),
    el('p', 'mc-power', `${opts.cityName}・じんこう ${opts.pop}人・🪙 ${Math.floor(opts.coins)}`),
  );

  const title = el('input', 'mc-name');
  title.type = 'text';
  title.maxLength = 30;
  title.placeholder = 'だいめい（きょうの まち など）';
  title.value = opts.report ? opts.report.title : '';
  wrap.appendChild(title);

  const body = el('textarea', 'mc-body');
  body.rows = 7;
  body.maxLength = 2000;
  body.placeholder = 'なにが あったか、どんな まちに したいか、すきなだけ 書こう。';
  body.value = opts.report ? opts.report.body : '';
  wrap.appendChild(body);

  if (opts.log.length > 0) {
    wrap.appendChild(el('p', 'mc-note', 'タップすると 文に 入る：'));
    const chips = el('div', 'mc-chips');
    for (const entry of opts.log.slice(0, 8)) {
      const chip = el('button', 'mc-chip', entry.text);
      chip.addEventListener('click', () => {
        const line = `${dateText(entry.at)} ${entry.text}`;
        body.value = body.value ? `${body.value}\n${line}` : line;
        body.scrollTop = body.scrollHeight;
        body.focus();
      });
      chips.appendChild(chip);
    }
    wrap.appendChild(chips);
  }

  const foot = el('div', 'mc-row2');
  const save = el('button', 'mc-btn', '✅ のこす');
  save.addEventListener('click', () => {
    const text = body.value.trim();
    if (!text) {
      body.placeholder = 'なにか 1ぎょうでも 書いてから「のこす」を おしてね。';
      body.focus();
      return;
    }
    opts.onSave(title.value.trim().slice(0, 30) || 'まちの レポート', text);
  });
  const cancel = el('button', 'mc-btn gray', 'やめる');
  cancel.addEventListener('click', () => opts.onCancel());
  foot.append(save, cancel);
  wrap.appendChild(foot);
  return wrap;
};
