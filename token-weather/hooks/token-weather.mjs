// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
//
// Modified by joaopasbento in 2026 from the token-weather example in
// anthropics/claude-code-playground (commit 569c5283d9a0): updates mid-response,
// new limits and colors, props read from e.props, the chart and the last-turn
// change removed, the band shared with the mods drawn beneath, and the line
// drawn from the band's left edge.
//
// Token Weather: a live forecast of the context window, above the prompt.
//
// turn.complete: after each main-loop turn, read the context window's fill
// from $.session.usage() (the same figures the status line shows).
// turn.step: after each model request of a main-loop turn (each tool the
// model uses ends one request and starts the next), take a live reading from
// that request's own usage (the same sum the status line's tokens are), with
// the window from $.session.usage(), so the line follows it mid-response.
// session.start: take a first reading, so the band shows before any turn.
// ui.render (AbovePrompt): one line: icon, forecast word, percent, and tokens
// used of the window. The band is one for every mod: the line goes on top of
// whatever the hooks beneath drew (await next(e)), so when the band is taller
// than its rows and shows its top, the line stays in view; alone, it is the
// whole band, as before.
//
// The host reads on(...) and $.noun.method(...) from source, so they are
// spelled literally, and helpers that take $ are top-level functions.

// The stop: the share of the window where the session is meant to end
// (900k of 1M). The last forecast starts there.
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

// The last turn's reading: { tokens, window, percent }; null before any.
let reading = null;
// The reading after the latest model request of the running turn; null
// between turns, when the band shows the last turn's reading.
let live = null;

export function register(on) {
  on("session.start", async ($, e, next) => {
    const result = await next(e);
    reading = null;
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

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    if (e.props.hasSurvey || (!reading && !live)) {
      return next(e);
    }
    const below = await next(e);
    const { Box, Text } = $.ui.resolve(e);
    const line = band(Box, Text);
    // Nobody beneath drew: the engine's own band, empty without a survey.
    if (!below || below.type === "engine") {
      return line;
    }
    return Box({ flexDirection: "column", children: [line, below] });
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
    reading = { tokens, window: context.window, percent };
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

function band(Box, Text) {
  const now = live ?? reading;
  const f = forecastFor(now.tokens / now.window);
  // No left padding: the line starts at the band's left edge, as the bar of
  // savvy-progress above it does, so their icons and words line up.
  return Box({
    flexDirection: "row",
    children: [
      Text({ ...colored(f), bold: true, children: `${f.icon}  ${f.word}` }),
      Text({ children: `  ${now.percent}% of context` }),
      Text({ dimColor: true, children: `  ${short(now.tokens)} / ${short(now.window)}` }),
    ],
  });
}

function forecastFor(share) {
  return FORECAST.find((band) => share < band.upTo) ?? FORECAST[FORECAST.length - 1];
}

// The color prop, left out for a band drawn in the plain text color.
function colored(f) {
  return f.color ? { color: f.color } : {};
}

function short(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return String(n);
}
