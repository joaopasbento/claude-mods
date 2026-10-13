// savvy-progress under `claude plugin test`: the tests cover what 1.2.1
// changed from the 1.2.0 copy. The test's own hooks stand for the engine:
// `session.start`, a subagent's spawn, model request and end, and
// `ui.render` as whatever is drawn beneath the mod in the band, either the
// engine's own drawing (`{ type: "engine" }`, what a real session hands on
// when nobody beneath draws) or another mod's tree.

import { describe, expect, test } from "claude-code/testing";

const PLUGIN = "savvy-progress";
const TOOL = "mcp__savvy-progress__progress";
const PANE = "savvy-agents";
const ENGINE = { type: "engine", ref: 1 };
const BAND = { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 120 };

// What the engine beneath was asked for: the commands registered and the panes opened.
let commands: any[] = [];
let panes: string[] = [];
let clock = 0;

function engine($: any, on: any, beneath: (Box: any, Text: any) => object = () => ENGINE) {
  commands = [];
  panes = [];
  clock = 1_000;
  on("session.start", (_$: any, e: any) => ({ cwd: e.cwd }));
  on("env.get", () => ({ value: undefined }));
  on("settings.read", () => ({ value: {} }));
  on("clock.now", () => ({ value: (clock += 1_000) }));
  on("clock.every", () => ({ value: undefined }));
  on("tool.register", (_$: any, e: any) => ({ value: { tool: `mcp__${PLUGIN}__${e.name}` } }));
  on("command.register", (_$: any, e: any) => {
    commands.push(e);
    return { value: { command: e.name } };
  });
  on("ui.open", (_$: any, e: any) => {
    panes.push(e.id);
    return { value: { isPlaced: true } };
  });
  on("ui.panes", () => ({ value: panes.map((id) => ({ id, title: "Agents", isPlaced: true })) }));
  on("ui.render", { component: "AbovePrompt" }, ($: any, e: any) => {
    const { Box, Text } = $.ui.resolve(e);
    return beneath(Box, Text);
  });
  on("agent.spawn", (_$: any, e: any) => ({ model: "claude-opus-5-5", agentId: `agent-${e.tool_use_id}` }));
  on("turn.step", async function* (_$: any, e: any) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: "",
      toolUses: [],
      stopReason: "end_turn",
      usage: { model: "claude-opus-5-5", input_tokens: 20_000, output_tokens: 3_000, cache_read_input_tokens: 400_000, cache_creation_input_tokens: 50_000 },
    };
  });
  on("turn.complete", (_$: any, e: any) => ({ text: e.answer }));
  return $;
}

async function start($: any) {
  await $.session.start({ cwd: "/", surface: "terminal", isInteractive: true });
}

// The main session's call: no agentId, as the model's own tool calls carry none.
async function progress($: any, input: object) {
  return $.tool.call({ tool: TOOL, ...input });
}

// A subagent that ran one model request and finished.
async function subagent($: any, n: number) {
  const id = `t${n}`;
  await $.agent.spawn({ tool_use_id: id, prompt: "work", description: `part ${n}`, subagentType: "general-purpose", parentModel: "claude-opus-5-5" });
  const stream = $.turn.step({ turnId: id, index: 0, model: "claude-opus-5-5", messageCount: 1, agentId: `agent-${id}` });
  for await (const _ of stream) {
    // The test's response yields no chunks.
  }
  await stream.result;
  await $.turn.complete({ answer: "done", durationMs: 1, isAborted: false, turnId: id, reason: "answer", agentId: `agent-${id}` });
}

async function band($: any, surface: "terminal" | "desktop", props: object = {}) {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: "AbovePrompt", props: { ...BAND, ...props } as any, viewport: { columns: 120, rows: 40 } });
  const tree = await ui.drawn();
  const texts = (await ui.findAll({ type: "Text" })).map((t: any) => t.text);
  await ui.unmount();
  return { tree, texts };
}

// Everything a drawing shows as text: Text children, labels, alts and SVG sources.
function shown(node: any): string[] {
  if (node === null || node === undefined) return [];
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  const own = [node.props?.label, node.props?.alt, node.props?.source].filter((v: any) => typeof v === "string");
  return [...own, ...(node.children ?? []).flatMap(shown)];
}

// The bar's row: a row Box holding the crew Button, on either surface.
function isBar(node: any) {
  return node?.type === "Box" && node.props?.flexDirection === "row" && JSON.stringify(node).includes('"savvy-agents"');
}

describe("a progress call from the main session", () => {
  test("puts the bar in view, alone in the band", async ($: any, on: any) => {
    engine($, on);
    await start($);
    // No flow yet: the mod passes and the engine's band stays as it was.
    expect((await band($, "terminal")).tree).toEqual(ENGINE);

    const result = await progress($, { title: "Tidy the docs", total: 4, phase: "delegate" });
    expect(result.result).toBe("ok: Tasks 0/4");
    await progress($, { done: 1 });

    for (const surface of ["terminal", "desktop"] as const) {
      const { tree } = await band($, surface);
      expect(isBar(tree), surface).toBe(true);
      expect(JSON.stringify(tree), surface).toContain('"label":"×0"');
    }
  });

  // The terminal's element table carries Svg too (2.1.295), but the terminal
  // draws none, not even its alt: the bar there must be the text branch.
  test("terminal: the bar is text, title, bar, label and percent, no Svg", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await progress($, { title: "Tidy the docs", total: 4, done: 1, phase: "delegate" });
    const { tree, texts } = await band($, "terminal");
    expect(JSON.stringify(tree)).not.toContain('"type":"Svg"');
    expect(texts).toContain("Tidy the docs");
    expect(texts).toContain("Tasks 1/4");
    expect(texts).toContain("25%");
    expect(texts.some((t: string) => /^█+░+$/.test(t))).toBe(true);
  });

  test("desktop: the bar is the Svg row, its words in the alt", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await progress($, { title: "Tidy the docs", total: 4, done: 1, phase: "delegate" });
    const { tree, texts } = await band($, "desktop");
    expect(tree.children[0].type).toBe("Svg");
    expect(tree.children[0].props.alt).toBe("Tidy the docs: Tasks 1/4, 25%");
    expect(texts).toHaveLength(0);
  });

  test("without tasks the agents panel stays closed", async ($: any, on: any) => {
    engine($, on);
    await start($);
    await progress($, { title: "Tidy the docs", total: 4, phase: "delegate" });
    expect(panes).not.toContain(PANE);
    // With tasks, the panel opens: the call the rule above leaves out.
    await progress($, { title: "Tidy the docs", total: 1, phase: "delegate", tasks: [{ title: "part 1", tier: "light" }] });
    expect(panes).toContain(PANE);
  });
});

describe("sharing the band", () => {
  for (const surface of ["terminal", "desktop"] as const) {
    test(`${surface}: the bar goes on top of another mod's drawing`, async ($: any, on: any) => {
      engine($, on, (Box: any, Text: any) =>
        Box({ key: "other", flexDirection: "column", children: [Text({ children: "a note" }), Text({ children: "  7% of context" })] }),
      );
      await start($);
      await progress($, { title: "Tidy the docs", total: 4, phase: "delegate" });
      const { tree, texts } = await band($, surface);
      expect(tree.type).toBe("Box");
      expect(tree.props.flexDirection).toBe("column");
      // Exactly the two: the bar, then what was drawn beneath; no blank row.
      expect(tree.children).toHaveLength(2);
      expect(isBar(tree.children[0])).toBe(true);
      expect(tree.children[1].props.key).toBe("other");
      expect(texts.slice(-2)).toEqual(["a note", "  7% of context"]);
    });

    test(`${surface}: a survey takes the band and the mod draws nothing`, async ($: any, on: any) => {
      engine($, on, (Box: any, Text: any) => Box({ key: "survey", children: [Text({ children: "How is Claude doing?" })] }));
      await start($);
      await progress($, { title: "Tidy the docs", total: 4, phase: "delegate" });
      const { tree, texts } = await band($, surface, { hasSurvey: true });
      expect(tree.props.key).toBe("survey");
      expect(texts).toEqual(["How is Claude doing?"]);
    });
  }
});

describe("no cost anywhere", () => {
  for (const surface of ["terminal", "desktop"] as const) {
    for (const isCompact of [false, true]) {
      test(`${surface}${isCompact ? ", compact" : ""}: the panel shows tokens and time, no cost`, async ($: any, on: any) => {
        engine($, on);
        await start($);
        await progress($, { title: "Tidy the docs", total: 2, phase: "delegate" });
        await subagent($, 1);
        await subagent($, 2);
        const ui = await $.ui.mount({
          plugin: PLUGIN,
          surface,
          component: "Pane",
          requestId: PANE,
          props: { title: "Agents", isFocused: false, bodyColumns: 80, placement: "dock" } as any,
          viewport: { columns: 120, rows: 40 },
        });
        if (isCompact) {
          await ui.press({ key: "compact" });
        }
        const all = shown(await ui.drawn()).join("\n");
        await ui.unmount();
        // 2 × (20k + 3k + 400k + 50k) = 946k tokens across the two runs.
        expect(all).toContain("946k");
        for (const gone of ["$", "≈", "Cost", "cost", "USD"]) {
          expect(all, gone).not.toContain(gone);
        }
      });
    }
  }

  test("the command's description names no cost", async ($: any, on: any) => {
    engine($, on);
    await start($);
    const agentsInfo = commands.find((c: any) => c.name === "agents-info");
    expect(agentsInfo.description).toContain("tokens and time");
    expect(agentsInfo.description).not.toContain("cost");
  });
});
