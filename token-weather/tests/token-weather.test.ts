// Token Weather under `claude plugin test`: the test's own hooks stand for
// the engine, answering `session.usage` with the figures a response would
// have left, `turn.step` with a model response, and `session.start` and
// `turn.complete` as the engine's own steps, and `ui.render` as whatever is
// drawn beneath the mod in the band: the engine's own drawing (`{ type:
// "engine" }`, what a real session hands on when nobody beneath draws) or
// another mod's tree. So each test walks the band through turns, through
// model requests inside a turn, and beside other mods.

import { describe, expect, test } from "claude-code/testing";

const WINDOW = 1_000_000;
const PLUGIN = "token-weather";
const ORANGE = "#cc5a14";

// The live context fill the engine would report; each test sets it before
// the event that reads it. The engine's own percent is rounded, as the
// status line's is.
let tokens = 0;

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
  on("session.start", (_$: any, e: any) => ({ cwd: e.cwd }));
  on("turn.complete", (_$: any, e: any) => ({ text: e.answer }));
  on("turn.step", async function* (_$: any, e: any) {
    return { turnId: e.turnId, index: e.index, answer: "", toolUses: [], stopReason: null, usage: stepUsage };
  });
  return $;
}

async function start($: any) {
  tokens = 0;
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

// The token-weather line as the mod draws it: one row Box of three Texts.
function isLine(node: any) {
  return node?.type === "Box" && node.props?.flexDirection === "row" && node.children?.length === 3 && node.children.every((c: any) => c.type === "Text");
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
    for (const prop of ["padding", "paddingX", "paddingLeft", "margin", "marginX", "marginLeft"]) {
      expect(line.props[prop], prop).toBeUndefined();
    }
    // The first Text is the icon, two spaces and the word: the word starts in column 3.
    expect(line.children[0].children[0].indexOf("Clear")).toBe(3);
  });
});

describe("sharing the band", () => {
  test("alone, the line is the whole band: no engine drawing, no blank row", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await complete($, 70_000);
    const { tree, elements } = await draw($);
    expect(isLine(tree)).toBe(true);
    expect(tree).toEqual({
      type: "Box",
      props: { flexDirection: "row" },
      children: [
        { type: "Text", props: { color: "success", bold: true }, children: ["☀  Clear"] },
        { type: "Text", children: ["  7% of context"] },
        { type: "Text", props: { dimColor: true }, children: ["  70k / 1M"] },
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
    expect(await band($)).toEqual(["☁  Cloudy", "  60% of context", "  600k / 1M"]);

    await step($, 750_000, 1);
    expect(await band($)).toEqual(["☂  Showers", "  75% of context", "  750k / 1M"]);

    // The turn ends: the turn's reading takes over.
    await complete($, 760_000);
    expect(await band($)).toEqual(["☂  Showers", "  76% of context", "  760k / 1M"]);
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
    expect(await band($)).toEqual(["☁  Cloudy", "  60% of context", "  600k / 1M"]);
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
