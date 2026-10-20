// Token Weather under `claude plugin test`: the test's own hooks stand for
// the engine, answering `session.usage` with the figures a response would
// have left, `turn.step` with a model response, and `session.start` and
// `turn.complete` as the engine's own steps, and `ui.render` as whatever is
// drawn beneath the mod in the band: the engine's own drawing (`{ type:
// "engine" }`, what a real session hands on when nobody beneath draws) or
// another mod's tree. It also answers `session.model` and `config.list` (the
// fast row) as a session would. So each test walks the band through turns,
// through model requests inside a turn, model switches, and beside other
// mods.

import { describe, expect, test } from "claude-code/testing";

const WINDOW = 1_000_000;
const PLUGIN = "token-weather";
const ORANGE = "#cc5a14";

// The live context fill the engine would report; each test sets it before
// the event that reads it. The engine's own percent is rounded, as the
// status line's is.
let tokens = 0;

// What `$.session.model()` answers ("" names none) and the fast row of
// `$.config.list()` (undefined: no row, as without fast mode on the account).
let sessionModel = "";
let fastRow: boolean | undefined = undefined;
const FAST_ON = "#e0600a";

// The engine's own drawing of the band, as `next(e)` resolves to it when no
// plugin beneath draws: a real session answers this shape (ref 1).
const ENGINE = { type: "engine", ref: 1 };

function engine($: any, on: any, stepUsage: object | null = null, beneath: (Box: any, Text: any) => object = () => ENGINE) {
  on("session.usage", () => ({
    value: {
      startedAt: 0,
      context: { tokens, window: WINDOW, percent: Math.round((tokens / WINDOW) * 100) },
      rateLimits: [],
    },
  }));
  // What is drawn beneath the mod: by default the engine's own band.
  on("ui.render", { component: "AbovePrompt" }, ($: any, e: any) => {
    const { Box, Text } = $.ui.resolve(e);
    return beneath(Box, Text);
  });
  on("session.model", () => ({ value: sessionModel }));
  on("config.list", () => ({
    value: fastRow === undefined ? [] : [{ key: "fast", label: "Fast mode (Opus 5.5)", kind: "boolean", value: fastRow, provider: { plugin: "engine", tier: "core" }, isLocked: false }],
  }));
  on("config.set", (_$: any, e: any) => {
    if (e.key === "fast") fastRow = e.value;
    return { value: e.value };
  });
  on("session.start", (_$: any, e: any) => ({ cwd: e.cwd }));
  on("turn.start", (_$: any, e: any) => ({ turnId: e.turnId }));
  on("prompt.attachment", (_$: any, e: any) => ({ text: e.text }));
  on("classic.SessionStart", () => ({}));
  on("classic.PostModelSwitch", () => ({}));
  on("classic.ConfigChange", () => ({}));
  on("turn.complete", (_$: any, e: any) => ({ text: e.answer }));
  on("turn.step", async function* (_$: any, e: any) {
    return { turnId: e.turnId, index: e.index, answer: "", toolUses: [], stopReason: null, usage: stepUsage };
  });
  return $;
}

async function start($: any, model = "", fast?: boolean) {
  tokens = 0;
  sessionModel = model;
  fastRow = fast;
  await $.session.start({ cwd: "/", surface: "terminal", isInteractive: true });
}

async function step($: any, fill: number, index: number, agentId?: string) {
  tokens = fill;
  const stream = $.turn.step({ turnId: "t", index, model: "claude-opus-5-5", messageCount: 1, ...(agentId ? { agentId } : {}) });
  for await (const _ of stream) {
    // The test's response yields no chunks.
  }
  await stream.result;
}

async function complete($: any, fill: number, agentId?: string) {
  tokens = fill;
  await $.turn.complete({ answer: "", durationMs: 1, isAborted: false, turnId: "t", reason: "answer", ...(agentId ? { agentId } : {}) });
}

type Props = { hasSurvey?: boolean; bodyColumns?: number; maxRows?: number };

// The band as drawn: its tree and its Text elements, in the order drawn.
async function draw($: any, props: Props = {}) {
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: "terminal",
    component: "AbovePrompt",
    props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 120, ...props } as any,
    viewport: { columns: 120, rows: 40 },
  });
  const tree = await ui.drawn();
  const elements = await ui.findAll({ type: "Text" });
  await ui.unmount();
  return { tree, elements };
}

async function band($: any, props: Props = {}) {
  return (await draw($, props)).elements.map((t: any) => t.text);
}

// The forecast's Text.
async function forecast($: any) {
  const { elements } = await draw($);
  return { label: elements[0] };
}

// The context part of the line: one row Box of three Texts.
function isContext(node: any) {
  return node?.type === "Box" && node.props?.flexDirection === "row" && node.children?.length === 3 && node.children.every((c: any) => c.type === "Text");
}

// The token-weather line as the mod draws it: a row Box that wraps, the
// context part first, then, when there is one, the session's part.
function isLine(node: any) {
  return node?.type === "Box" && node.props?.flexDirection === "row" && node.props?.flexWrap === "wrap" && isContext(node.children?.[0]) && node.children.length <= 2;
}

// The texts of the line's context part alone.
async function contextTexts($: any) {
  const { tree } = await draw($);
  const line = isLine(tree) ? tree : tree.children[0];
  return line.children[0].children.map((t: any) => t.children.join(""));
}

// Both sides of each limit, by exact tokens of a 1M window, with the color
// each forecast is drawn in (undefined: the plain text color).
const LIMITS: Array<[number, string, string | undefined]> = [
  [499_999, "☀  Clear", "success"],
  [500_000, "☁  Cloudy", undefined],
  [699_999, "☁  Cloudy", undefined],
  [700_000, "☂  Showers", "warning"],
  [799_999, "☂  Showers", "warning"],
  [800_000, "☇  Storm", ORANGE],
  [899_999, "☇  Storm", ORANGE],
  [900_000, "↯  Compact soon", "error"],
];

describe("once per turn, as in the example", () => {
  test("each main turn updates the line", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await complete($, 160_000);
    await complete($, 450_000);
    expect(await band($)).toEqual(["☀  Clear", "  45% of context", "  450k / 1M"]);
  });

  test("a subagent's turn leaves the line as it was", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await complete($, 100_000);
    await complete($, 950_000, "agent-1");
    expect(await band($)).toEqual(["☀  Clear", "  10% of context", "  100k / 1M"]);
  });
});

describe("limits and colors", () => {
  test("each limit, both sides, after a turn", async ($: any, on: any) => {
    engine($, on);
    await start($);
    for (const [fill, word, color] of LIMITS) {
      await complete($, fill);
      const { label } = await forecast($);
      expect(label.text, `${fill}`).toBe(word);
      expect(label.props.color, `${fill}`).toBe(color);
    }
  });

  test("each limit, both sides, mid-response", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await complete($, 100_000);
    let index = 0;
    for (const [fill, word, color] of LIMITS) {
      await step($, fill, index++);
      const { label } = await forecast($);
      expect(label.text, `${fill}`).toBe(word);
      expect(label.props.color, `${fill}`).toBe(color);
    }
  });

  test("the exact share decides, not the rounded percent", async ($: any, on: any) => {
    engine($, on);
    await start($);
    // 899,999 rounds to 90%, yet the stop is not reached.
    await complete($, 899_999);
    let texts = await band($);
    expect(texts).toContain("  90% of context");
    expect(texts).toContain("☇  Storm");
    // 495,000 rounds to 50%, yet it is still under half.
    await complete($, 495_000);
    texts = await band($);
    expect(texts).toContain("  50% of context");
    expect(texts).toContain("☀  Clear");
  });

  test("the five forecasts draw five different colors", async ($: any, on: any) => {
    engine($, on);
    await start($);
    const colors = new Set<string>();
    for (const fill of [100_000, 600_000, 750_000, 850_000, 950_000]) {
      await complete($, fill);
      colors.add(String((await forecast($)).label.props.color));
    }
    expect(colors.size).toBe(5);
  });
});

describe("the line", () => {
  test("icon and word, percent, tokens: nothing more, at any width", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await complete($, 70_000);
    await complete($, 160_000);
    for (const bodyColumns of [40, 59, 60, 120, 200]) {
      expect(await band($, { bodyColumns }), `${bodyColumns}`).toEqual(["☀  Clear", "  16% of context", "  160k / 1M"]);
    }
  });

  test("no chart and no last-turn change", async ($: any, on: any) => {
    engine($, on);
    await start($);
    for (const fill of [100_000, 450_000, 899_999]) {
      await complete($, fill);
    }
    const joined = (await band($)).join("");
    for (const gone of ["last turn", "▲", "▼", "steady", ..."▁▂▃▄▅▆▇█"]) {
      expect(joined, gone).not.toContain(gone);
    }
  });
});

describe("alignment", () => {
  test("the line starts at the band's left edge: no padding, the icon in column 0, the word in column 3", async ($: any, on: any) => {
    engine($, on, null, (Box: any, Text: any) => Box({ key: "other", children: [Text({ children: "a note" })] }));
    await start($);
    await complete($, 70_000);
    const line = (await draw($)).tree.children[0];
    expect(isLine(line)).toBe(true);
    const context = line.children[0];
    for (const prop of ["padding", "paddingX", "paddingLeft", "margin", "marginX", "marginLeft"]) {
      expect(line.props[prop], prop).toBeUndefined();
      expect(context.props[prop], prop).toBeUndefined();
    }
    // The first Text is the icon, two spaces and the word: the word starts in column 3.
    expect(context.children[0].children[0].indexOf("Clear")).toBe(3);
  });
});

describe("sharing the band", () => {
  test("alone, the line is the whole band: no engine drawing, no blank row", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await complete($, 70_000);
    const { tree, elements } = await draw($);
    expect(isLine(tree)).toBe(true);
    // The engine stamps the root it gets back with `part: { plugin }` (2.1.299).
    const { part, ...drawn } = tree;
    expect(part).toEqual({ plugin: PLUGIN });
    expect(drawn).toEqual({
      type: "Box",
      props: { flexDirection: "row", flexWrap: "wrap" },
      children: [
        {
          type: "Box",
          props: { flexDirection: "row", flexShrink: 0 },
          children: [
            { type: "Text", props: { color: "success", bold: true }, children: ["☀  Clear"] },
            { type: "Text", children: ["  7% of context"] },
            { type: "Text", props: { dimColor: true }, children: ["  70k / 1M"] },
          ],
        },
      ],
    });
    expect(elements.map((t: any) => t.text)).toEqual(["☀  Clear", "  7% of context", "  70k / 1M"]);
  });

  test("the line goes on top of another mod's drawing", async ($: any, on: any) => {
    engine($, on, null, (Box: any, Text: any) =>
      Box({ key: "other", flexDirection: "column", children: [Text({ children: "a note" }), Text({ children: "another note" })] }),
    );
    await start($);
    await complete($, 70_000);
    const { tree, elements } = await draw($);
    expect(tree.type).toBe("Box");
    expect(tree.props.flexDirection).toBe("column");
    // Exactly the two: the line, then what was drawn beneath; no blank row between.
    expect(tree.children).toHaveLength(2);
    expect(isLine(tree.children[0])).toBe(true);
    expect(tree.children[1].props.key).toBe("other");
    expect(elements.map((t: any) => t.text)).toEqual(["☀  Clear", "  7% of context", "  70k / 1M", "a note", "another note"]);
  });

  test("a long note beneath: the line stays first, where a band too tall still shows it", async ($: any, on: any) => {
    const NOTE = "a long note ".repeat(80).trim();
    engine($, on, null, (Box: any, Text: any) =>
      Box({ key: "other", flexDirection: "column", children: Array.from({ length: 30 }, (_, i) => Text({ children: `${i}: ${NOTE}` })) }),
    );
    await start($);
    await complete($, 70_000);
    // A band taller than maxRows shows its top rows, so the line must lead.
    const { tree, elements } = await draw($, { maxRows: 9 });
    expect(tree.children).toHaveLength(2);
    expect(isLine(tree.children[0])).toBe(true);
    expect(elements.slice(0, 3).map((t: any) => t.text)).toEqual(["☀  Clear", "  7% of context", "  70k / 1M"]);
  });

  test("a survey takes the band: the mod passes and draws nothing", async ($: any, on: any) => {
    const SURVEY = (Box: any, Text: any) => Box({ key: "survey", children: [Text({ children: "How is Claude doing?" })] });
    engine($, on, null, SURVEY);
    await start($);
    await complete($, 160_000);
    const withSurvey = await draw($, { hasSurvey: true });
    expect(withSurvey.tree.props.key).toBe("survey");
    expect(withSurvey.elements.map((t: any) => t.text)).toEqual(["How is Claude doing?"]);
  });

  test("a survey over the engine's band: still the engine's alone", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await complete($, 160_000);
    const { tree, elements } = await draw($, { hasSurvey: true });
    expect(tree).toEqual(ENGINE);
    expect(elements).toHaveLength(0);
  });
});

describe("mid-response, after each model request", () => {
  test("the line follows the step", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await complete($, 160_000);
    await complete($, 450_000);

    // The next turn: a request that called a tool, then the one after the tool's result.
    await step($, 600_000, 0);
    expect(await contextTexts($)).toEqual(["☁  Cloudy", "  60% of context", "  600k / 1M"]);

    await step($, 750_000, 1);
    expect(await contextTexts($)).toEqual(["☂  Showers", "  75% of context", "  750k / 1M"]);

    // The turn ends: the turn's reading takes over.
    await complete($, 760_000);
    expect(await contextTexts($)).toEqual(["☂  Showers", "  76% of context", "  760k / 1M"]);
  });

  test("a subagent's model requests leave the band as it was", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await complete($, 100_000);
    await step($, 950_000, 0, "agent-1");
    expect(await band($)).toEqual(["☀  Clear", "  10% of context", "  100k / 1M"]);
  });

  test("a step's own usage counts, whatever session.usage still holds", async ($: any, on: any) => {
    // A response that reports its usage: 20k uncached, 80k cache-written, 500k cache-read.
    engine($, on, { model: "claude-opus-5-5", input_tokens: 20_000, output_tokens: 500, cache_read_input_tokens: 500_000, cache_creation_input_tokens: 80_000 });
    await start($);
    await complete($, 100_000);
    // session.usage still reports the previous response.
    await step($, 100_000, 0);
    expect(await contextTexts($)).toEqual(["☁  Cloudy", "  60% of context", "  600k / 1M"]);
  });

  test("before any turn, a step alone draws the band", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await step($, 300_000, 0);
    const texts = await band($);
    expect(texts).toContain("  30% of context");
    expect(texts).toContain("  300k / 1M");
  });
});

// A main-session (or, with agentId, a subagent's) model request naming its
// model and effort; tokens stay where the last reading left them.
async function request($: any, fields: { model?: string; effort?: string | number; agentId?: string; index?: number } = {}) {
  const { model = "claude-opus-5-5", index = 0, ...rest } = fields;
  const stream = $.turn.step({ turnId: "t", index, model, messageCount: 1, ...rest });
  for await (const _ of stream) {
    // The test's response yields no chunks.
  }
  await stream.result;
}

async function switchModel($: any, to: string, agentId?: string) {
  await $.classic.PostModelSwitch({
    from_model: "claude-opus-5-5",
    to_model: to,
    requested_model: to,
    source: "command",
    context_tokens: 70_000,
    prompt_cache_warm: true,
    cache_ttl: "5m",
    estimated_cache_write_usd: 0,
    pricing: null,
    ...(agentId ? { agent_id: agentId } : {}),
  });
}

async function attachment($: any, type: string, agentId?: string) {
  await $.prompt.attachment({ type, text: "", origin: { kind: "engine" }, ...(agentId ? { agentId } : {}) });
}

// The session's part of the line: its Box, its Text, the pieces and the words shown.
async function sessionPart($: any, props: Props = {}) {
  const { tree } = await draw($, props);
  const line = isLine(tree) ? tree : tree.children[0];
  const box = line.children[1];
  if (!box) return { shown: "", box: undefined, text: undefined, pieces: [] as any[] };
  const text = box.children[0];
  const pieces: any[] = text.children;
  return { shown: pieces.map((p: any) => p.children.join("")).join(""), box, text, pieces };
}

function piece(pieces: any[], words: string) {
  return pieces.find((p: any) => p.children.join("") === words);
}

describe("the session's part: the model", () => {
  test("by short name, from a request's id, with or without a suffix", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await complete($, 70_000);
    expect((await sessionPart($)).shown).toBe("");
    for (const [id, name] of [
      ["claude-opus-5-5", "Opus 5.5"],
      ["claude-opus-4-8[1m]", "Opus 4.8"],
      ["claude-sonnet-4-5-20250929", "Sonnet 4.5"],
      ["claude-opus-5", "Opus 5"],
      ["claude-haiku-4-5", "Haiku 4.5"],
    ]) {
      await request($, { model: id });
      expect((await sessionPart($)).shown, id).toBe(name);
    }
  });

  test("the model that answered (usage.model) before the one asked for (e.model)", async ($: any, on: any) => {
    engine($, on, { model: "claude-sonnet-5", input_tokens: 70_000, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });
    await start($);
    await request($, { model: "claude-opus-5-5" });
    expect((await sessionPart($)).shown).toBe("Sonnet 5");
  });

  test("at the start, from $.session.model() and classic.SessionStart", async ($: any, on: any) => {
    engine($, on);
    await start($, "claude-opus-5-5[1m]");
    await complete($, 70_000);
    expect((await sessionPart($)).shown).toBe("Opus 5.5");
    await $.classic.SessionStart({ source: "startup", model: "claude-opus-4-8" });
    expect((await sessionPart($)).shown).toBe("Opus 4.8");
  });

  test("an alias names no version: nothing until the first request", async ($: any, on: any) => {
    engine($, on);
    await start($, "opus");
    await complete($, 70_000);
    expect((await sessionPart($)).shown).toBe("");
    await request($, { model: "claude-opus-5-5" });
    expect((await sessionPart($)).shown).toBe("Opus 5.5");
  });

  test("an unknown value shows as it is, without claude- and its [..] suffix", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await complete($, 70_000);
    await request($, { model: "claude-custom-model[1m]" });
    expect((await sessionPart($)).shown).toBe("custom-model");
    await request($, { model: "my-model" });
    expect((await sessionPart($)).shown).toBe("my-model");
  });
});

describe("the session's part: the effort", () => {
  test("each level by the app's menu: xhigh shows as extra", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await complete($, 70_000);
    for (const [effort, words] of [
      ["low", "low"],
      ["medium", "medium"],
      ["high", "high"],
      ["xhigh", "extra"],
      ["max", "max"],
    ]) {
      await request($, { effort });
      const { shown, pieces } = await sessionPart($);
      expect(shown, effort).toBe(`Opus 5.5 · ${words}`);
      expect(shown, effort).not.toContain("xhigh");
      // The separator is grey.
      expect(piece(pieces, " · ")?.props.dimColor, effort).toBe(true);
    }
  });

  test("a number shows as a number", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await complete($, 70_000);
    await request($, { effort: 2048 });
    expect((await sessionPart($)).shown).toBe("Opus 5.5 · 2048");
  });

  test("no effort, no effort part: before any request, and on a model without effort", async ($: any, on: any) => {
    engine($, on);
    await start($, "claude-opus-5-5");
    await complete($, 70_000);
    expect((await sessionPart($)).shown).toBe("Opus 5.5");
    await request($, { effort: "high" });
    await request($, { model: "claude-haiku-4-5" });
    expect((await sessionPart($)).shown).toBe("Haiku 4.5");
  });
});

describe("the session's part: fast mode", () => {
  test("on: fast on, in the orange of fast mode, on any model", async ($: any, on: any) => {
    engine($, on);
    await start($, "claude-opus-5-5", true);
    await complete($, 70_000);
    await request($, { effort: "high" });
    const { shown, pieces } = await sessionPart($);
    expect(shown).toBe("Opus 5.5 · high · fast on");
    expect(piece(pieces, "fast on")?.props.color).toBe(FAST_ON);
    expect(shown).not.toContain("↯");
    await request($, { model: "claude-sonnet-5" });
    expect((await sessionPart($)).shown).toBe("Sonnet 5 · fast on");
  });

  test("off on a model that has it: fast off, grey", async ($: any, on: any) => {
    engine($, on);
    await start($, "", false);
    await complete($, 70_000);
    for (const id of ["claude-opus-5-5", "claude-opus-5", "claude-opus-4-8"]) {
      await request($, { model: id });
      const { shown, pieces } = await sessionPart($);
      expect(shown, id).toMatch(/ · fast off$/);
      expect(piece(pieces, "fast off")?.props.dimColor, id).toBe(true);
    }
  });

  test("off on a model without it: nothing about fast mode", async ($: any, on: any) => {
    engine($, on);
    await start($, "", false);
    await complete($, 70_000);
    for (const id of ["claude-opus-4-7", "claude-opus-4-6", "claude-fable-5-1", "claude-sonnet-5", "claude-haiku-4-5"]) {
      await request($, { model: id });
      expect((await sessionPart($)).shown, id).not.toContain("fast");
    }
  });

  test("no fast row in /config: nothing about fast mode", async ($: any, on: any) => {
    engine($, on);
    await start($, "claude-opus-5-5");
    await complete($, 70_000);
    await request($, { effort: "medium" });
    expect((await sessionPart($)).shown).toBe("Opus 5.5 · medium");
  });

  test("read again at each main turn's start, after /config and a settings change", async ($: any, on: any) => {
    engine($, on);
    await start($, "claude-opus-5-5", false);
    await complete($, 70_000);
    expect((await sessionPart($)).shown).toBe("Opus 5.5 · fast off");
    // A subagent's turn start reads nothing.
    fastRow = true;
    await $.turn.start({ text: "", turnId: "a1", agentId: "agent-1" });
    expect((await sessionPart($)).shown).toBe("Opus 5.5 · fast off");
    await $.turn.start({ text: "", turnId: "t2" });
    expect((await sessionPart($)).shown).toBe("Opus 5.5 · fast on");
    await $.config.set({ key: "fast", value: false });
    expect((await sessionPart($)).shown).toBe("Opus 5.5 · fast off");
    fastRow = true;
    await $.classic.ConfigChange({ source: "user_settings" });
    expect((await sessionPart($)).shown).toBe("Opus 5.5 · fast on");
  });
});

describe("the session's part: ultracode", () => {
  test("on while the engine's ultracode reminder holds, in order before fast mode", async ($: any, on: any) => {
    engine($, on);
    await start($, "claude-opus-5-5", false);
    await complete($, 70_000);
    await request($, { effort: "xhigh" });
    await attachment($, "ultra_effort_enter");
    expect((await sessionPart($)).shown).toBe("Opus 5.5 · extra · ultracode · fast off");
    await attachment($, "ultra_effort_exit");
    expect((await sessionPart($)).shown).toBe("Opus 5.5 · extra · fast off");
  });

  test("the ultracode keyword in a prompt, or a subagent's reminder, is not ultracode on", async ($: any, on: any) => {
    engine($, on);
    await start($, "claude-opus-5-5");
    await complete($, 70_000);
    await attachment($, "workflow_keyword_request");
    await attachment($, "ultra_effort_enter", "agent-1");
    expect((await sessionPart($)).shown).toBe("Opus 5.5");
  });
});

describe("the session's part: a model switch", () => {
  test("the new model; the effort cleared until the next request; fast mode read again", async ($: any, on: any) => {
    engine($, on);
    await start($, "claude-opus-5-5", true);
    await complete($, 70_000);
    await request($, { effort: "high" });
    expect((await sessionPart($)).shown).toBe("Opus 5.5 · high · fast on");
    // Claude Code turns fast mode off on a model without it.
    fastRow = false;
    await switchModel($, "claude-sonnet-5");
    expect((await sessionPart($)).shown).toBe("Sonnet 5");
    await request($, { model: "claude-sonnet-5", effort: "medium" });
    expect((await sessionPart($)).shown).toBe("Sonnet 5 · medium");
  });

  test("to an alias: no model until the next request names it", async ($: any, on: any) => {
    engine($, on);
    await start($, "claude-sonnet-5");
    await complete($, 70_000);
    await switchModel($, "opus");
    expect((await sessionPart($)).shown).toBe("");
    await request($, { model: "claude-opus-5-5", effort: "low" });
    expect((await sessionPart($)).shown).toBe("Opus 5.5 · low");
  });

  test("a subagent's switch leaves the line as it was", async ($: any, on: any) => {
    engine($, on);
    await start($, "claude-opus-5-5");
    await complete($, 70_000);
    await request($, { effort: "high" });
    await switchModel($, "claude-haiku-4-5", "agent-1");
    expect((await sessionPart($)).shown).toBe("Opus 5.5 · high");
  });
});

describe("the session's part: subagents' requests", () => {
  test("a subagent's model and effort leave the line as it was", async ($: any, on: any) => {
    engine($, on);
    await start($, "", false);
    await complete($, 70_000);
    await request($, { effort: "high" });
    await request($, { model: "claude-haiku-4-5", effort: "low", agentId: "agent-1" });
    expect((await sessionPart($)).shown).toBe("Opus 5.5 · high · fast off");
  });
});

describe("the session's part: room", () => {
  for (const bodyColumns of [30, 60, 120]) {
    test(`at ${bodyColumns} columns: on the right by flex, wrapping beneath; the context whole`, async ($: any, on: any) => {
      engine($, on);
      await start($, "claude-opus-5-5", false);
      await complete($, 70_000);
      await request($, { effort: "xhigh" });
      await attachment($, "ultra_effort_enter");
      const { tree } = await draw($, { bodyColumns });
      expect(isLine(tree)).toBe(true);
      // One row that wraps: the session's part moves to a line of its own when both do not fit.
      expect(tree.props.flexWrap).toBe("wrap");
      expect(tree.props.columnGap).toBe(2);
      // The context never shrinks and keeps its three texts.
      const context = tree.children[0];
      expect(context.props.flexShrink).toBe(0);
      expect(context.children.map((t: any) => t.children.join(""))).toEqual(["☀  Clear", "  7% of context", "  70k / 1M"]);
      // The session's part grows to the right edge, on either line, and is cut at its end.
      const box = tree.children[1];
      expect(box.props.flexGrow).toBe(1);
      expect(box.props.justifyContent).toBe("flex-end");
      expect(box.children[0].props.wrap).toBe("truncate-end");
      // No spaces counted by hand: no piece leads or trails with them but the separators.
      const pieces = box.children[0].children.map((p: any) => p.children.join(""));
      expect(pieces).toEqual(["Opus 5.5", " · ", "extra", " · ", "ultracode", " · ", "fast off"]);
    });
  }
});

describe("the session's part: a survey", () => {
  test("a survey still takes the band, with the session's part known", async ($: any, on: any) => {
    const SURVEY = (Box: any, Text: any) => Box({ key: "survey", children: [Text({ children: "How is Claude doing?" })] });
    engine($, on, null, SURVEY);
    await start($, "claude-opus-5-5", true);
    await complete($, 160_000);
    await request($, { effort: "high" });
    const withSurvey = await draw($, { hasSurvey: true });
    expect(withSurvey.tree.props.key).toBe("survey");
    expect(withSurvey.elements.map((t: any) => t.text)).toEqual(["How is Claude doing?"]);
  });
});
