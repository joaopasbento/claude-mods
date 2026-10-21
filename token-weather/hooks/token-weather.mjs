// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
//
// Modified by joaopasbento in 2026 from the token-weather example in
// anthropics/claude-code-playground (commit 569c5283d9a0): updates mid-response,
// new limits and colors, props read from e.props, the chart and the last-turn
// change removed, the band shared with the mods drawn beneath, the line
// drawn from the band's left edge, and the session's model, effort and
// ultracode after the tokens.
//
// Token Weather: a live forecast of the context window, above the prompt, and
// the main session's model, effort and ultracode beside it.
//
// turn.complete: after each main-loop turn, read the context window's fill
// from $.session.usage() (the same figures the status line shows).
// turn.step: after each model request of a main-loop turn (each tool the
// model uses ends one request and starts the next), take a live reading from
// that request's own usage (the same sum the status line's tokens are), with
// the window from $.session.usage(), so the line follows it mid-response.
// The same request names the model that answered (usage.model, or e.model)
// and the effort it ran at (e.effort).
// session.start: take a first reading, so the band shows before any turn, and
// the model from $.session.model().
// classic.SessionStart: the model the session starts on, when it says one.
// classic.PostModelSwitch: the new model (to_model); the effort is cleared
// until the next request says it again.
// prompt.attachment: ultracode is on while the engine's ultra_effort_enter
// reminder is the last it sent, off after ultra_effort_exit.
// Subagents' turns, requests and events (agentId, agent_id) are left out.
// ui.render (AbovePrompt): one line: icon, forecast word, percent, and tokens
// used of the window, then, after a grey " · ", model, effort and ultracode;
// when they do not fit beside the tokens, they go on the line beneath, from
// the forecast word's column, with no " · " before them.
// The band is one for every mod: the line goes on top of whatever the hooks
// beneath drew (await next(e)), so when the band is taller than its rows and
// shows its top, the line stays in view; alone, it is the whole band, as
// before.
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

// Whether the session's part fits beside the tokens: the line's characters,
// times ROOM_SCALE, plus ROOM_SLACK columns, within the band's bodyColumns.
// The terminal draws a character per column; the app draws the band in a
// proportional font whose letters and symbols can run wider than its column
// metric, so the margin keeps the line from breaking there on its own.
const ROOM_SCALE = 1.25;
const ROOM_SLACK = 2;

// The column the forecast word starts in: the icon and two spaces.
const WORD_COLUMN = 3;

// Model aliases, which name no version: the model waits for a request's id.
const ALIASES = /^(fable|mythos|opus|sonnet|haiku|best|default|opusplan)$/i;

// The last turn's reading: { tokens, window, percent }; null before any.
let reading = null;
// The reading after the latest model request of the running turn; null
// between turns, when the band shows the last turn's reading.
let live = null;

// The main session's model by short name ("Opus 5.5"); null until known.
let model = null;
// The effort of the main session's latest request: a level or a number;
// undefined before the first request, after a model switch, and on a model
// without effort.
let effort = undefined;
// Ultracode in effect for the session.
let ultracode = false;

export function register(on) {
  on("session.start", async ($, e, next) => {
    const result = await next(e);
    reading = null;
    live = null;
    model = null;
    effort = undefined;
    ultracode = false;
    await takeReading($);
    await readModel($);
    return result;
  });

  on("classic.SessionStart", async ($, e, next) => {
    const result = await next(e);
    if (!e.agent_id && e.model) {
      setShown($, () => {
        model = shortModel(e.model) ?? model;
      });
    }
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
      setShown($, () => {
        model = shortModel((result && result.usage && result.usage.model) || e.model) ?? model;
        effort = e.effort;
      });
      await takeLiveReading($, result && result.usage);
    }
    return result;
  });

  on("classic.PostModelSwitch", async ($, e, next) => {
    const result = await next(e);
    if (!e.agent_id) {
      // An alias names no version: the next request's id will.
      setShown($, () => {
        model = shortModel(e.to_model);
        effort = undefined;
      });
    }
    return result;
  });

  // The engine's own ultracode reminders, on main: not the "ultracode"
  // keyword at the start of a prompt, which is another attachment.
  on("prompt.attachment", { type: "ultra_effort_enter" }, async ($, e, next) => {
    const result = await next(e);
    if (!e.agentId) {
      setShown($, () => {
        ultracode = true;
      });
    }
    return result;
  });

  on("prompt.attachment", { type: "ultra_effort_exit" }, async ($, e, next) => {
    const result = await next(e);
    if (!e.agentId) {
      setShown($, () => {
        ultracode = false;
      });
    }
    return result;
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    if (e.props.hasSurvey || (!reading && !live)) {
      return next(e);
    }
    const below = await next(e);
    const { Box, Text } = $.ui.resolve(e);
    const line = band(Box, Text, e.props.bodyColumns);
    // Nobody beneath drew: the engine's own band, empty without a survey.
    if (!below || below.type === "engine") {
      return line;
    }
    return Box({ flexDirection: "column", children: [line, below] });
  });
}

async function readModel($) {
  try {
    const id = await $.session.model();
    setShown($, () => {
      model = shortModel(id) ?? model;
    });
  } catch {
    // No model yet; the first request will name it.
  }
}

// Runs change, and redraws the band only when what the line shows changed.
function setShown($, change) {
  const before = sessionParts().join("|");
  change();
  if (sessionParts().join("|") !== before && (reading || live)) {
    $.ui.invalidate("ui.render");
  }
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

function band(Box, Text, columns) {
  const now = live ?? reading;
  const f = forecastFor(now.tokens / now.window);
  const words = [`${f.icon}  ${f.word}`, `  ${now.percent}% of context`, `  ${short(now.tokens)} / ${short(now.window)}`];
  // No left padding: the line starts at the band's left edge, as the bar of
  // savvy-progress above it does, so their icons and words line up.
  const context = Box({
    flexDirection: "row",
    flexShrink: 0,
    children: [
      Text({ ...colored(f), bold: true, children: words[0] }),
      Text({ children: words[1] }),
      Text({ dimColor: true, children: words[2] }),
    ],
  });
  const parts = sessionParts();
  if (!parts.length) {
    return Box({ flexDirection: "row", children: [context] });
  }
  // The session's part: model, effort and ultracode, with grey " · " between.
  const children = [];
  for (const part of parts) {
    if (children.length) {
      children.push(Text({ dimColor: true, children: " · " }));
    }
    children.push(Text({ children: part }));
  }
  const session = Text({ wrap: "truncate-end", children });
  const lead = "  ·  ";
  if (fits([...words, lead, parts.join(" · ")].join(""), columns)) {
    return Box({ flexDirection: "row", children: [context, Text({ dimColor: true, children: lead }), session] });
  }
  // Too wide for one line: the session's part goes beneath, from the forecast
  // word's column, with no " · " before it; the context stays whole.
  return Box({ flexDirection: "column", children: [context, Box({ paddingLeft: WORD_COLUMN, children: [session] })] });
}

// Whether text fits in the band's columns, with the app's margin.
function fits(text, columns) {
  return typeof columns === "number" && Math.ceil([...text].length * ROOM_SCALE) + ROOM_SLACK <= columns;
}

// Model, effort and ultracode, in that order, each left out when there is
// nothing to say.
function sessionParts() {
  const parts = [];
  if (model) parts.push(model);
  if (effort !== undefined && effort !== null) parts.push(effortName(effort));
  if (ultracode) parts.push("ultracode");
  return parts;
}

// The effort as the app's effort menu names it: xhigh is "extra" there; a
// number shows as it is.
function effortName(value) {
  if (typeof value === "number") return String(value);
  return value === "xhigh" ? "extra" : String(value);
}

// The short name, by savvy-progress's modelName rule: "Opus 5.5" for
// claude-opus-5-5, any other id without its claude- prefix and its [..]
// suffix; null for an alias, which names no version, or nothing.
function shortModel(id) {
  if (typeof id !== "string" || !id) return null;
  const m = /(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?!\d))?/i.exec(id);
  const [, family = "", major = "", minor] = m ?? [];
  if (!family) {
    const name = id.replace(/^claude-/, "").replace(/\[.*\]$/, "");
    return !name || ALIASES.test(name) ? null : name;
  }
  return `${family.charAt(0).toUpperCase()}${family.slice(1).toLowerCase()} ${major}${minor ? "." + minor : ""}`;
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
