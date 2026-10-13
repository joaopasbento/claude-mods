<!-- Modified by joaopasbento in 2026 from the token-weather example in anthropics/claude-code-playground (commit 569c5283d9a0): see "Origin" below for what changed. -->

# Token Weather

A Claude Code mod that draws a live forecast of your context window in the band above the prompt: one hooks module that reads real usage figures and draws one line of UI, on top of whatever the mods after it draw there.

## What it shows

```text
☀  Clear  7% of context  70k / 1M
```

The band shows:

- a weather icon and word for how full the window is, and
- the percentage used, and the tokens used out of the window.

| Used      | Forecast          | Color |
|-----------|-------------------|-------|
| under 50% | ☀ Clear           | green: the theme's `success` |
| 50–69%    | ☁ Cloudy          | none: the plain text color |
| 70–79%    | ☂ Showers         | amber: the theme's `warning` |
| 80–89%    | ☇ Storm           | orange: `#cc5a14`, fixed |
| 90% up    | ↯ Compact soon    | red: the theme's `error` |

The limits compare the exact share of the window (`tokens / window`), not the rounded percentage: at 899,999 of 1M the band reads 90% but stays ☇ Storm, and ↯ shows from 900,000. The theme keys follow Claude Code's light and dark themes. No theme key is an orange that reads well on both, so Storm uses one fixed tone between the themes' amber and red.

The numbers are real, not estimated. The mod calls `$.session.usage()` and reads `context`:

- `tokens`: the input tokens the last response was answered over (uncached, cache-written and cache-read together),
- `window`: the context window of the session's model, and
- `percent`: `tokens` over `window`.

These are the same figures the status line shows (`total_input_tokens`, `context_window_size`, `used_percentage`). The call is free: the mod doesn't ask for a breakdown, so it sends no token-count request.

| Hook | What it does |
|------|--------------|
| `session.start` | Takes a first reading, so the band shows before the first turn. |
| `turn.complete` | Takes a reading after each main-loop turn. Subagent turns are skipped. |
| `turn.step` | After each model request of a main-loop turn (so after each tool use too), updates the icon, percentage and tokens from that request's usage. Subagent requests are skipped. |
| `ui.render` with `{component: "AbovePrompt"}` | Draws the line on top of whatever the mods beneath drew in the band (`await next(e)`). Alone, the line is the whole band. It gives way to a survey. |

## Install

Requires Claude Code 2.1.287 or later, where mods load by default. The band is drawn above the prompt in the terminal and in the desktop app's Code tab.

In Claude Code:

```text
/plugin marketplace add joaopasbento/claude-mods
/plugin install token-weather@claude-mods
```

Then run `/reload-plugins`, or start a new session. No environment variables or configuration.

## Test it

From a clone of this repository:

```bash
claude plugin validate ./token-weather
claude plugin test ./token-weather
```

## Notes and limitations

- **The percentage is of the full window.** Claude Code's own "context used" notice counts against the auto-compact point, which is lower, so the two can differ.
- **The line updates during a turn**, after each model request of the main loop, and again when the turn ends.
- **The reading resets** when the session starts, or when the plugin reloads.
- **On a 1M-token window**, ordinary work stays at ☀ for a long time. That's accurate.
- **The band is shared.** Claude Code has one band above the prompt for every mod, and each mod's hook runs before those of the mods after it. Token Weather passes the band on (`await next(e)`) and puts its line on top of what it gets back, so the mods after it (Claude Code's bundled mods, such as you-should-know, always come after the ones you install) draw under the line. A mod that runs before Token Weather and puts its own drawing on top, as [savvy-progress](../savvy-progress/README.md) does with its bar (it lists token-weather as a dependency, which places it first), sits above the line. A mod that draws without passing the band on hides what the mods after it would draw.
- **A band taller than its room shows its top.** When the mods' drawings together pass the band's rows (`maxRows`), Claude Code shows the top of the band and an `↓ n more` row. The line is near the top, so it stays in view and only what is drawn under it is cut.
- **Before the first response**, the band reads 0%, because no response has reported usage yet.

## Dependencies

None.

## Origin

This mod started from the `token-weather` example in [anthropics/claude-code-playground](https://github.com/anthropics/claude-code-playground), folder `claude-code/mods/token-weather`, at commit [`569c5283d9a0`](https://github.com/anthropics/claude-code-playground/tree/569c5283d9a0a7ee7938df85bb32e4f48cbb8c86/claude-code/mods/token-weather), licensed under the Apache License 2.0. What changed from that example:

- **Updates mid-response.** A `turn.step` hook updates the icon, percentage and tokens after each model request of the main loop, from that request's own usage. The example only updated at session start and at the end of each turn.
- **New limits and colors.** Clear under 50%, Cloudy 50–69%, Showers 70–79%, Storm 80–89%, Compact soon from 90%, compared on the exact share of the window. Colors are Claude Code theme keys (`success`, `warning`, `error`), the plain text color for Cloudy, and a fixed orange for Storm. The example used fixed ANSI colors and limits at 25/50/75/90% of the rounded percentage.
- **No chart and no last-turn change.** The line keeps the icon, the forecast word, the percentage and the tokens. The example also drew a chart of the last turns and how much the last turn added.
- **A shared band.** The mod passes the band on and puts its line on top of what the mods beneath drew. The example drew its line in place of anything else.
- **No left padding.** The line starts at the band's left edge, so the icon lines up with the dot of the savvy-progress bar above it and the forecast word with its title. The example padded the line by one column on each side.
- **Fixed props.** The mod reads `hasSurvey` from `e.props`, where Claude Code puts it. The example read it from the event itself, so the band never gave way to surveys.
- **Tests.** `tests/token-weather.test.ts` is new and runs under `claude plugin test`.
- **Packaging.** A new author and marketplace, this README rewritten, and the example's screenshots removed, since they showed the old colors.

## License

Apache License 2.0. See [LICENSE](../LICENSE).
