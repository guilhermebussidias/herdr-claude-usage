// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STRINGS, firstAppleLanguage, isStale, pickLanguage, resetText, updatedText, usedPercent, wallTime, weeklyHeadline,
} from "../claude-usage/mods/claude-usage/model.js";

const en = STRINGS.en;
const es = STRINGS.es;
// 2026-11-11 14:00 UTC (Wednesday); offset +60 min -> 15:00 local.
const NOW = Date.UTC(2026, 10, 11, 14, 0) / 1000;
const OFF = 60;

test("every language has the same keys as English", () => {
  for (const [lang, s] of Object.entries(STRINGS)) {
    assert.deepEqual(Object.keys(s).sort(), Object.keys(en).sort(), lang);
    assert.equal(s.days.length, 7);
    assert.equal(s.daysShort.length, 7);
  }
});

test("pickLanguage maps locale codes and falls back to English", () => {
  assert.equal(pickLanguage("es-ES"), "es");
  assert.equal(pickLanguage("es_ES.UTF-8"), "es");
  assert.equal(pickLanguage("ES-419"), "es");
  assert.equal(pickLanguage("en-GB"), "en");
  assert.equal(pickLanguage("C.UTF-8"), "en");
  assert.equal(pickLanguage("ja-JP"), "en");
  assert.equal(pickLanguage(""), "en");
  assert.equal(pickLanguage(undefined), "en");
  assert.equal(pickLanguage("constructor"), "en");
});

test("firstAppleLanguage reads `defaults read -g AppleLanguages` output", () => {
  assert.equal(firstAppleLanguage('(\n    "es-ES",\n    "en-ES"\n)\n'), "es-ES");
  assert.equal(firstAppleLanguage("(\n    en,\n    fr\n)"), "en");
  assert.equal(firstAppleLanguage(""), "");
});

test("wallTime applies the saved UTC offset", () => {
  assert.deepEqual(wallTime(NOW, OFF), { day: 3, date: "2026-11-11", hm: "15:00" });
  assert.deepEqual(wallTime(NOW, -300), { day: 3, date: "2026-11-11", hm: "09:00" });
});

test("usedPercent rounds, clamps and resets", () => {
  assert.equal(usedPercent({ used_percentage: 17.4, resets_at: NOW + 60 }, NOW), 17);
  assert.equal(usedPercent({ used_percentage: 130 }, NOW), 100);
  assert.equal(usedPercent({ used_percentage: -3 }, NOW), 0);
  assert.equal(usedPercent({ used_percentage: 55, resets_at: NOW - 1 }, NOW), 0);
  assert.equal(usedPercent(null, NOW), null);
  assert.equal(usedPercent({}, NOW), null);
});

test("resetText: same day shows the time, other days the weekday", () => {
  const today = { used_percentage: 1, resets_at: NOW + 3600 };           // 16:00 local
  const saturday = { used_percentage: 1, resets_at: NOW + 3 * 86400 + 6 * 3600 }; // Sat 21:00 local
  assert.equal(resetText(en, today, OFF, NOW), "Resets at 16:00");
  assert.equal(resetText(es, today, OFF, NOW), "Se restablece a las 16:00");
  assert.equal(resetText(en, saturday, OFF, NOW), "Resets Sat, 21:00");
  assert.equal(resetText(es, saturday, OFF, NOW), "Se restablece el sáb, 21:00");
  assert.equal(resetText(en, { used_percentage: 1, resets_at: NOW - 1 }, OFF, NOW), "Window reset");
  assert.equal(resetText(en, null, OFF, NOW), "No data");
});

test("weeklyHeadline uses the full weekday", () => {
  const saturday = { used_percentage: 1, resets_at: NOW + 3 * 86400 + 6 * 3600 };
  assert.equal(weeklyHeadline(en, saturday, OFF, NOW), "Your weekly limit resets Saturday, 21:00.");
  assert.equal(weeklyHeadline(es, saturday, OFF, NOW), "Tu límite semanal se restablece el sábado, 21:00.");
  assert.equal(weeklyHeadline(en, { used_percentage: 1, resets_at: NOW - 1 }, OFF, NOW), "");
  assert.equal(weeklyHeadline(en, undefined, OFF, NOW), "");
});

test("updatedText and isStale", () => {
  assert.equal(updatedText(en, null, NOW), "Waiting for Claude Code");
  assert.equal(updatedText(en, NOW - 10, NOW), "Updated just now");
  assert.equal(updatedText(en, NOW - 300, NOW), "Updated 5 min ago");
  assert.equal(updatedText(es, NOW - 7200, NOW), "Actualizado hace 2 h");
  assert.equal(updatedText(en, NOW - 3 * 86400, NOW), "Updated 3 d ago");
  assert.equal(isStale(NOW - 60, NOW), false);
  assert.equal(isStale(NOW - 901, NOW), true);
  assert.equal(isStale(null, NOW), false);
});
