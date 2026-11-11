// Pure helpers for the Claude Usage mod. No imports, so Node can test them.

export const STALE_SECONDS = 15 * 60;

// UI strings. Add a language by adding an entry with the same keys.
export const STRINGS = {
  en: {
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    daysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    title: "Claude Usage",
    session: "Current session",
    weekly: "Weekly limit · All models",
    used: (p) => `${p}% used`,
    headline: (day, hm) => `Your weekly limit resets ${day}, ${hm}.`,
    resetsToday: (hm) => `Resets at ${hm}`,
    resetsOn: (day, hm) => `Resets ${day}, ${hm}`,
    windowReset: "Window reset",
    noData: "No data",
    empty: "No data yet. Send a message in Claude Code so its status line can save your limits.",
    readError: (e) => `Could not read the limits: ${e}`,
    waiting: "Waiting for Claude Code",
    updatedNow: "Updated just now",
    updatedMin: (n) => `Updated ${n} min ago`,
    updatedHour: (n) => `Updated ${n} h ago`,
    updatedDay: (n) => `Updated ${n} d ago`,
  },
  es: {
    days: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
    daysShort: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
    title: "Claude Usage",
    session: "Sesión actual",
    weekly: "Límite semanal · Todos los modelos",
    used: (p) => `${p}% usado`,
    headline: (day, hm) => `Tu límite semanal se restablece el ${day}, ${hm}.`,
    resetsToday: (hm) => `Se restablece a las ${hm}`,
    resetsOn: (day, hm) => `Se restablece el ${day}, ${hm}`,
    windowReset: "Ventana restablecida",
    noData: "Sin datos",
    empty: "Sin datos todavía. Envía un mensaje en Claude Code para que su status line guarde tus límites.",
    readError: (e) => `No se pudieron leer los límites: ${e}`,
    waiting: "Esperando a Claude Code",
    updatedNow: "Actualizado hace un momento",
    updatedMin: (n) => `Actualizado hace ${n} min`,
    updatedHour: (n) => `Actualizado hace ${n} h`,
    updatedDay: (n) => `Actualizado hace ${n} d`,
  },
};

// "es_ES.UTF-8", "es-419", "en-GB" -> "es" / "en". Unknown languages fall back to English.
export function pickLanguage(code) {
  const base = String(code ?? "").trim().toLowerCase().split(/[-_.@]/)[0];
  return Object.prototype.hasOwnProperty.call(STRINGS, base) ? base : "en";
}

// First language from `defaults read -g AppleLanguages` output: ( "es-ES", "en-ES" ).
export function firstAppleLanguage(text) {
  const m = String(text ?? "").match(/"?([A-Za-z]{2,3}(?:[-_][A-Za-z0-9]+)*)"?/);
  return m ? m[1] : "";
}

const pad = (n) => String(n).padStart(2, "0");

// Wall time for epoch seconds, using the UTC offset saved by statusline.py,
// so it does not depend on the JavaScript runtime's time zone support.
export function wallTime(epoch, offsetMin = 0) {
  const d = new Date((epoch + offsetMin * 60) * 1000);
  return { day: d.getUTCDay(), date: d.toISOString().slice(0, 10), hm: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` };
}

// A window whose reset time has passed counts as 0 % until Claude Code reports again.
export function usedPercent(win, nowS) {
  if (!win || typeof win.used_percentage !== "number") return null;
  if (win.resets_at && win.resets_at <= nowS) return 0;
  return Math.max(0, Math.min(100, Math.round(win.used_percentage)));
}

export function resetText(s, win, offsetMin, nowS) {
  if (!win) return s.noData;
  if (!win.resets_at) return "";
  if (win.resets_at <= nowS) return s.windowReset;
  const r = wallTime(win.resets_at, offsetMin);
  return r.date === wallTime(nowS, offsetMin).date ? s.resetsToday(r.hm) : s.resetsOn(s.daysShort[r.day], r.hm);
}

export function weeklyHeadline(s, win, offsetMin, nowS) {
  if (!win?.resets_at || win.resets_at <= nowS) return "";
  const r = wallTime(win.resets_at, offsetMin);
  return s.headline(s.days[r.day], r.hm);
}

export function updatedText(s, updatedAt, nowS) {
  if (!updatedAt) return s.waiting;
  const sec = Math.max(0, nowS - updatedAt);
  if (sec < 60) return s.updatedNow;
  if (sec < 3600) return s.updatedMin(Math.floor(sec / 60));
  if (sec < 86400) return s.updatedHour(Math.floor(sec / 3600));
  return s.updatedDay(Math.floor(sec / 86400));
}

export function isStale(updatedAt, nowS) {
  return Boolean(updatedAt) && nowS - updatedAt > STALE_SECONDS;
}
