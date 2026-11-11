// Claude Usage: Claude Code plan limits (current session and weekly) in a
// collapsible sidebar. Data comes from ~/.cache/claude-usage/limits.json,
// written by statusline.py (Claude Code's statusLine). No network, no credentials.
import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { exec, home, nextCommand, props, readTextFile, run, shared, setShared, theme, window as appWindow } from "herdr";
import { STRINGS, firstAppleLanguage, isStale, pickLanguage, resetText, updatedText, usedPercent, weeklyHeadline } from "./model.js";

const NODE = "claude-usage";            // layout node id
const OPEN_PX = 300;
const CLOSED_PX = 44;
const KEY = "claude-usage.collapsed";   // shared state, survives restarts
const WARN_AT = 90;

export default class ClaudeUsage extends View {
  init(_props, cx) {
    this.data = null;
    this.error = null;
    this.s = STRINGS.en;
    this.detectLanguage(cx);
    this.load(cx);
    cx.timer.every(30000, (cx) => this.load(cx));
    // claude-usage.toggle / claude-usage.refresh: keys.json or `herdr-app do`.
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "toggle") this.toggle();
        else if (c === "refresh") this.load(cx);
        cx.notify();
      }
    });
  }

  // Herdr has no language setting of its own: use the layout's `props.lang`
  // if set, else the operating system's language. English when unknown.
  detectLanguage(cx) {
    const forced = props()?.lang;
    if (forced) { this.s = STRINGS[pickLanguage(forced)]; return; }
    cx.spawn(async (cx) => {
      let code = "";
      try {
        const platform = appWindow()?.platform;
        if (platform === "macos") {
          code = firstAppleLanguage((await exec("defaults", ["read", "-g", "AppleLanguages"], { timeout: 5000 })).stdout);
        } else if (platform === "windows") {
          code = (await exec("powershell", ["-NoProfile", "-Command", "(Get-Culture).Name"], { timeout: 5000 })).stdout;
        } else {
          code = (await exec("sh", ["-c", 'printf %s "${LC_ALL:-${LC_MESSAGES:-$LANG}}"'], { timeout: 5000 })).stdout;
        }
      } catch (_e) {
        code = "";
      }
      this.s = STRINGS[pickLanguage(code)];
      cx.notify();
    });
  }

  load(cx) {
    cx.spawn(async (cx) => {
      try {
        const text = await readTextFile(`${home()}/.cache/claude-usage/limits.json`);
        this.data = text ? JSON.parse(text) : null;
        this.error = null;
      } catch (e) {
        this.error = String(e?.message ?? e);
      }
      cx.notify();
    });
  }

  toggle() {
    const collapsed = !shared(KEY);
    setShared(KEY, collapsed);
    run("layout.resize", { id: NODE, px: collapsed ? CLOSED_PX : OPEN_PX });
  }

  chevron(t, id, file) {
    return div().id(id).p(4).rounded(6).cursor_pointer().hover((s) => s.bg(t.hover))
      .on_click(() => this.toggle())
      .child(svg(`mods/claude-usage/${file}`).size(14).text_color(t.muted));
  }

  bar(t, pct) {
    return h_flex().h(6).w_full().rounded(3).overflow_hidden().bg(t.raised)
      .child(div().h_full().flex_grow(pct).bg(pct >= WARN_AT ? t.blocked : t.accent))
      .child(div().h_full().flex_grow(100 - pct));
  }

  row(t, id, title, win, off, nowS) {
    const s = this.s;
    const pct = usedPercent(win, nowS);
    return v_flex().id(id).gap(6)
      .child(h_flex().items_center().justify_between().gap(8)
        .child(div().flex_1().min_w(0).text_size(13).text_color(t.foreground).child(title))
        .child(div().flex_none().text_size(12).text_color(t.muted).child(pct == null ? "—" : s.used(pct))))
      .child(this.bar(t, pct ?? 0))
      .child(div().text_size(11).text_color(t.dim).child(resetText(s, win, off, nowS)));
  }

  collapsedView(t, d, nowS) {
    const mini = (label, win) => {
      const pct = usedPercent(win, nowS);
      return v_flex().items_center().gap(2)
        .child(div().text_size(10).text_color(t.dim).child(label))
        .child(div().text_size(11).text_color(pct != null && pct >= WARN_AT ? t.blocked : t.foreground)
          .child(pct == null ? "—" : `${pct}%`));
    };
    return v_flex().id("cu-root").size_full().items_center().py(10).gap(14).rounded(10).bg(t.background)
      .border_1().border_color(t.border).text_color(t.foreground)
      .child(this.chevron(t, "cu-expand", "chevron-left.svg"))
      .child(mini("5 h", d?.five_hour))
      .child(mini("7 d", d?.seven_day));
  }

  render() {
    const t = theme();
    const s = this.s;
    const d = this.data;
    const nowS = Math.floor(Date.now() / 1000);
    if (shared(KEY)) return this.collapsedView(t, d, nowS);

    const off = d?.tz_offset_min ?? 0;
    const headline = weeklyHeadline(s, d?.seven_day, off, nowS);
    const empty = this.error ? s.readError(this.error) : s.empty;

    return v_flex().id("cu-root").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background)
      .border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().justify_between().border_b(1).border_color(t.border)
        .child(div().font_semibold().child(s.title))
        .child(this.chevron(t, "cu-collapse", "chevron-right.svg")))
      .child(v_flex().id("cu-body").flex_1().min_h(0).overflow_y_scrollbar().p(14).gap(18)
        .when(Boolean(headline), (el) => el.child(div().text_size(13).font_semibold().child(headline)))
        .when(!d, (el) => el.child(div().text_size(12).text_color(t.dim).child(empty)))
        .when(Boolean(d), (el) => el
          .child(this.row(t, "cu-session", s.session, d.five_hour, off, nowS))
          .child(this.row(t, "cu-week", s.weekly, d.seven_day, off, nowS))))
      .child(h_flex().flex_none().px(14).py(8).border_t(1).border_color(t.border).text_size(11)
        .text_color(isStale(d?.updated_at, nowS) ? t.blocked : t.dim)
        .child(updatedText(s, d?.updated_at, nowS)));
  }
}
