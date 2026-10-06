// Token Weather under `claude plugin test`: the test's own hooks stand for
// the engine, answering `session.usage` with the figures a response would
// have left, `turn.step` with a model response, and `session.start` and
// `turn.complete` as the engine's own steps, so each test walks the
// band through turns and through model requests inside a turn.

import { describe, expect, test } from "claude-code/testing";

const WINDOW = 1_000_000;
const PLUGIN = "token-weather";
const ORANGE = "#cc5a14";

// The live context fill the engine would report; each test sets it before
// the event that reads it. The engine's own percent is rounded, as the
// status line's is.
let tokens = 0;

function engine($: any, on: any, stepUsage: object | null = null) {
  on("session.usage", () => ({
    value: {
      startedAt: 0,
      context: { tokens, window: WINDOW, percent: Math.round((tokens / WINDOW) * 100) },
      rateLimits: [],
    },
  }));
  // The engine draws nothing of its own above the prompt.
  on("ui.render", { component: "AbovePrompt" }, ($: any, e: any) => {
    const { Box } = $.ui.resolve(e);
    return Box({ key: "engine" });
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

// The band's Text elements and whether the engine drew its own instead.
async function draw($: any, props: { hasSurvey?: boolean; bodyColumns?: number } = {}) {
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: "terminal",
    component: "AbovePrompt",
    props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 120, ...props } as any,
    viewport: { columns: 120, rows: 40 },
  });
  const elements = await ui.findAll({ type: "Text" });
  const isEngines = (await ui.find({ key: "engine" })) !== undefined;
  await ui.unmount();
  return { elements, isEngines };
}

async function band($: any, props: { hasSurvey?: boolean; bodyColumns?: number } = {}) {
  return (await draw($, props)).elements.map((t: any) => t.text);
}

// The forecast's Text and the chart's, which share the forecast's color.
async function forecast($: any) {
  const { elements } = await draw($);
  return { label: elements[0], chart: elements[4] };
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
  test("each main turn adds a reading to the chart and the change", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await complete($, 160_000);
    await complete($, 450_000);
    const texts = await band($);
    expect(texts).toContain("☀  Clear");
    expect(texts).toContain("  45% of context");
    expect(texts).toContain("  450k / 1M");
    expect(texts).toContain("▂▄");
    expect(texts).toContain("  ▲ +290k last turn");
  });

  test("a subagent's turn adds no reading", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await complete($, 100_000);
    await complete($, 950_000, "agent-1");
    const texts = await band($);
    expect(texts).toContain("  10% of context");
    expect(texts).toContain("▁");
  });
});

describe("limits and colors", () => {
  test("each limit, both sides, after a turn", async ($: any, on: any) => {
    engine($, on);
    await start($);
    for (const [fill, word, color] of LIMITS) {
      await complete($, fill);
      const { label, chart } = await forecast($);
      expect(label.text, `${fill}`).toBe(word);
      expect(label.props.color, `${fill}`).toBe(color);
      expect(chart.props.color, `${fill} chart`).toBe(color);
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

describe("the chart against the stop", () => {
  test("160k of 1M is a low bar, alone or not", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await complete($, 160_000);
    expect(await band($)).toContain("▂");
  });

  test("bars measure against 90% of the window", async ($: any, on: any) => {
    engine($, on);
    await start($);
    for (const fill of [100_000, 450_000, 899_999, 900_000, 1_000_000]) {
      await complete($, fill);
    }
    // 100k: 0.78 of a step; 450k: half the stop; 899,999: just short; 900k and 1M: full.
    expect(await band($)).toContain("▁▄▇██");
  });
});

describe("the band's props", () => {
  test("a survey takes the band", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await complete($, 160_000);
    const withSurvey = await draw($, { hasSurvey: true });
    expect(withSurvey.isEngines).toBe(true);
    expect(withSurvey.elements).toHaveLength(0);
    const without = await draw($, { hasSurvey: false });
    expect(without.isEngines).toBe(false);
  });

  test("the chart hides below 60 columns of the band", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await complete($, 160_000);
    await complete($, 450_000);
    // The viewport stays 120 wide: only bodyColumns narrows.
    const narrow = await band($, { bodyColumns: 59 });
    expect(narrow).toContain("☀  Clear");
    expect(narrow).not.toContain("   last turns ");
    expect(narrow).not.toContain("▂▄");
    expect(narrow).not.toContain("  ▲ +290k last turn");
    const wide = await band($, { bodyColumns: 60 });
    expect(wide).toContain("   last turns ");
    expect(wide).toContain("▂▄");
  });
});

describe("mid-response, after each model request", () => {
  test("the state follows the step; the chart and the change stay per turn", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await complete($, 160_000);
    await complete($, 450_000);

    // The next turn: a request that called a tool, then the one after the tool's result.
    await step($, 600_000, 0);
    let texts = await band($);
    expect(texts).toContain("☁  Cloudy");
    expect(texts).toContain("  60% of context");
    expect(texts).toContain("  600k / 1M");
    expect(texts).toContain("▂▄");
    expect(texts).toContain("  ▲ +290k last turn");

    await step($, 750_000, 1);
    texts = await band($);
    expect(texts).toContain("☂  Showers");
    expect(texts).toContain("  75% of context");
    expect(texts).toContain("  750k / 1M");
    expect(texts).toContain("▂▄");
    expect(texts).toContain("  ▲ +290k last turn");

    // The turn ends: the reading joins the chart and the change counts the whole turn.
    await complete($, 750_000);
    texts = await band($);
    expect(texts).toContain("☂  Showers");
    expect(texts).toContain("▂▄▆");
    expect(texts).toContain("  ▲ +300k last turn");
  });

  test("a subagent's model requests leave the band as it was", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await complete($, 100_000);
    await step($, 950_000, 0, "agent-1");
    const texts = await band($);
    expect(texts).toContain("☀  Clear");
    expect(texts).toContain("  10% of context");
    expect(texts).toContain("  100k / 1M");
  });

  test("a step's own usage counts, whatever session.usage still holds", async ($: any, on: any) => {
    // A response that reports its usage: 20k uncached, 80k cache-written, 500k cache-read.
    engine($, on, { model: "claude-opus-5-5", input_tokens: 20_000, output_tokens: 500, cache_read_input_tokens: 500_000, cache_creation_input_tokens: 80_000 });
    await start($);
    await complete($, 100_000);
    // session.usage still reports the previous response.
    await step($, 100_000, 0);
    const texts = await band($);
    expect(texts).toContain("☁  Cloudy");
    expect(texts).toContain("  60% of context");
    expect(texts).toContain("  600k / 1M");
    expect(texts).toContain("▁");
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
