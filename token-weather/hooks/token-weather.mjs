// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
//
// Modified by joaopasbento in 2026 from the token-weather example in
// anthropics/claude-code-playground (commit 569c5283d9a0): updates mid-response,
// new limits and colors, an absolute chart, and props read from e.props.
//
// Token Weather: a live forecast of the context window, above the prompt.
//
// turn.complete: after each main-loop turn, read the context window's fill
// from $.session.usage() (the same figures the status line shows) and keep
// the last HISTORY readings.
// turn.step: after each model request of a main-loop turn (each tool the
// model uses ends one request and starts the next), take a live reading from
// that request's own usage (the same sum the status line's tokens are), with
// the window from $.session.usage(): the icon, percent and tokens follow it
// mid-response, while the chart and the last-turn change count whole turns.
// session.start: take a first reading, so the band shows before any turn.
// ui.render (AbovePrompt): one line: icon, forecast word, percent, tokens
// used of the window, and a block-character chart of the recent turns, each
// bar measured against STOP of the window (a full bar is the stop reached).
//
// The host reads on(...) and $.noun.method(...) from source, so they are
// spelled literally, and helpers that take $ are top-level functions.

const HISTORY = 12;
const BARS = "▁▂▃▄▅▆▇█";
// The stop: the share of the window where the session is meant to end
// (900k of 1M). The last forecast starts there and a full bar reaches it.
const STOP = 0.9;

// Forecast bands, by the exact share of the window used (tokens / window,
// never the rounded percent). Colors are Claude Code theme keys, which follow
// the light and dark themes, except Cloudy (the plain text color) and Storm:
// no theme key is an orange that reads on both, so it is one fixed tone
// between the themes' amber and red.
const FORECAST = [
// Single-width text symbols, not emoji: they line up in every terminal font.
  { upTo: 0.5, icon: "☀", word: "Clear", color: "success" },
  { upTo: 0.7, icon: "☁", word: "Cloudy", color: undefined },
  { upTo: 0.8, icon: "☂", word: "Showers", color: "warning" },
  { upTo: STOP, icon: "☇", word: "Storm", color: "#cc5a14" },
  { upTo: Infinity, icon: "↯", word: "Compact soon", color: "error" },
];

// Readings: { tokens, window, percent }, oldest first.
let readings = [];
// The reading after the latest model request of the running turn; null
// between turns, when the band shows the last turn's reading.
let live = null;

export function register(on) {
  on("session.start", async ($, e, next) => {
    const result = await next(e);
    readings = [];
    live = null;
    await takeReading($);
    return result;
  });

  on("turn.complete", async ($, e, next) => {
    const result = await next(e);
    if (e.agentId) {
      return result;
    }
    await takeReading($);
    return result;
  });

  on("turn.step", async function* ($, e, next) {
    const result = yield* next(e);
    if (!e.agentId) {
      await takeLiveReading($, result && result.usage);
    }
    return result;
  });

  on("ui.render", { component: "AbovePrompt" }, ($, e, next) => {
    if (e.props.hasSurvey || (readings.length === 0 && !live)) {
      return next(e);
    }
    const { Box, Text } = $.ui.resolve(e);
    return band(Box, Text, e.props.bodyColumns ?? 80);
  });
}

async function takeReading($) {
  try {
    const { context } = await $.session.usage();
    if (!context || !context.window) {
      return;
    }
    const tokens = context.tokens ?? 0;
    const percent = Math.round(context.percent ?? (tokens / context.window) * 100);
    // The session.start reading is 0 before any response; drop it once real readings arrive.
    readings = readings.filter((r) => r.tokens > 0);
    readings.push({ tokens, window: context.window, percent });
    if (readings.length > HISTORY) {
      readings = readings.slice(-HISTORY);
    }
    live = null;
    $.ui.invalidate("ui.render");
  } catch {
    // No reading this turn; the band keeps the last one.
  }
}

// usage: the request's own, as the API reported it; without it, the figures
// $.session.usage() holds.
async function takeLiveReading($, usage) {
  try {
    const { context } = await $.session.usage();
    if (!context || !context.window) {
      return;
    }
    let tokens = context.tokens ?? 0;
    let percent = Math.round(context.percent ?? (tokens / context.window) * 100);
    if (usage) {
      tokens = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
      percent = Math.round((tokens / context.window) * 100);
    }
    live = { tokens, window: context.window, percent };
    $.ui.invalidate("ui.render");
  } catch {
    // No reading this step; the band keeps the last one.
  }
}

function band(Box, Text, columns) {
  const now = live ?? readings[readings.length - 1];
  const f = forecastFor(now.tokens / now.window);
  const trend = trendWord();
  const parts = [
    Text({ ...colored(f), bold: true, children: `${f.icon}  ${f.word}` }),
    Text({ children: `  ${now.percent}% of context` }),
    Text({ dimColor: true, children: `  ${short(now.tokens)} / ${short(now.window)}` }),
  ];
  if (columns >= 60) {
    parts.push(Text({ dimColor: true, children: "   last turns " }));
    parts.push(Text({ ...colored(f), children: chart() }));
    if (trend) {
      parts.push(Text({ dimColor: true, children: `  ${trend}` }));
    }
  }
  return Box({ flexDirection: "row", paddingX: 1, children: parts });
}

function forecastFor(share) {
  return FORECAST.find((band) => share < band.upTo) ?? FORECAST[FORECAST.length - 1];
}

// The color prop, left out for a band drawn in the plain text color.
function colored(f) {
  return f.color ? { color: f.color } : {};
}

// Bars scale to STOP of each reading's window, so a full bar is the stop
// reached and a light session stays low.
function chart() {
  const bars = readings.map((r) => BARS[Math.min(BARS.length - 1, Math.floor((r.tokens / (r.window * STOP)) * (BARS.length - 1)))]);
  return bars.join("");
}

function trendWord() {
  if (readings.length < 2) {
    return "";
  }
  const delta = readings[readings.length - 1].tokens - readings[readings.length - 2].tokens;
  if (delta > 0) return `▲ +${short(delta)} last turn`;
  if (delta < 0) return `▼ ${short(-delta)} last turn`;
  return "steady";
}

function short(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return String(n);
}
