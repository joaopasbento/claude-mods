<!-- Modified by joaopasbento in 2026 from the token-weather example in anthropics/claude-code-playground (commit 569c5283d9a0). See "Origin" below. -->

# Token Weather

A Claude Code mod that draws a live forecast of your context window in the band above the prompt: one hooks module that reads real usage figures and draws one line of UI.

## What it shows

```text
 ☂  Showers  72% of context  720k / 1M   last turns ▁▂▆  ▲ +560k last turn
```

The band shows:

- a weather icon and word for how full the window is,
- the percentage used, and the tokens used out of the window,
- a chart of the last 12 turns, drawn with block characters, each bar measured against 90% of the window (a full bar means the stop was reached), and
- how much the last turn added.

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
| `turn.step` | After each model request of a main-loop turn (so after each tool use too), updates the icon, percentage and tokens from that request's usage. The chart and the last-turn change still count whole turns. Subagent requests are skipped. |
| `ui.render` with `{component: "AbovePrompt"}` | Draws the band as one line. It gives way to a survey, and hides the chart when the band is narrower than 60 columns. |

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
- **The band's state updates during a turn**, after each model request of the main loop; the chart and the last-turn change update once per turn.
- **The chart's bars are absolute**: each measures its turn against 90% of the window, so a full bar means the stop was reached, and a light session (160k of 1M) stays low.
- **The history resets** when the session starts, or when the plugin reloads.
- **On a 1M-token window**, ordinary work stays at ☀ for a long time. That's accurate.
- **One band per session.** Another plugin that draws `AbovePrompt` competes for the same band.
- **Before the first response**, the band reads 0%, because no response has reported usage yet.

## Dependencies

None.

## Origin

This mod started from the `token-weather` example in [anthropics/claude-code-playground](https://github.com/anthropics/claude-code-playground), folder `claude-code/mods/token-weather`, at commit [`569c5283d9a0`](https://github.com/anthropics/claude-code-playground/tree/569c5283d9a0a7ee7938df85bb32e4f48cbb8c86/claude-code/mods/token-weather), licensed under the Apache License 2.0. What changed from that example:

- **Updates mid-response.** A `turn.step` hook updates the icon, percentage and tokens after each model request of the main loop, from that request's own usage. The example only updated at session start and at the end of each turn.
- **New limits and colors.** Clear under 50%, Cloudy 50–69%, Showers 70–79%, Storm 80–89%, Compact soon from 90%, compared on the exact share of the window. Colors are Claude Code theme keys (`success`, `warning`, `error`), the plain text color for Cloudy, and a fixed orange for Storm. The example used fixed ANSI colors and limits at 25/50/75/90% of the rounded percentage.
- **Absolute chart.** Each bar measures against 90% of the window. The example scaled the bars to the fullest turn shown.
- **Fixed props.** The mod reads `hasSurvey` and `bodyColumns` from `e.props`, where Claude Code puts them. The example read them from the event itself, so the band never gave way to surveys and the chart never hid in narrow windows.
- **Tests.** `tests/token-weather.test.ts` is new and runs under `claude plugin test`.
- **Packaging.** A new author and marketplace, this README rewritten, and the example's screenshots removed, since they showed the old colors.

## License

Apache License 2.0. See [LICENSE](../LICENSE).
