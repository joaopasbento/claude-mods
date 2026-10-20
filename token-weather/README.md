<!-- Modified by joaopasbento in 2026 from the token-weather example in anthropics/claude-code-playground (commit 569c5283d9a0): see "Origin" below for what changed. -->

# Token Weather

A Claude Code mod that draws a live forecast of your context window in the band above the prompt, with the session's model, effort, ultracode and fast mode beside it: one hooks module that reads real usage figures and session state and draws one line of UI, on top of whatever the mods after it draw there.

## What it shows

```text
☀  Clear  7% of context  70k / 1M                  Opus 5.5 · medium · fast off
```

The band shows, on the left:

- a weather icon and word for how full the window is, and
- the percentage used, and the tokens used out of the window.

And on the right, at least two columns away, the main session's:

- **model**, by its short name: `Opus 5.5` for `claude-opus-5-5`; any other id without its `claude-` prefix and its `[...]` suffix (the same rule as savvy-progress's `modelName`);
- **effort**, with the names of the app's effort menu: `low`, `medium`, `high`, `extra` (for `xhigh`) and `max`; an effort given as a number shows as that number; a model without effort shows none;
- **ultracode**, only while it is on for the session;
- **fast mode**: `fast on`, in an orange near Claude Code's own fast-mode sign (`#e0600a`), whenever it is on; `fast off`, grey, only on the models that have fast mode (Opus 5.5, Opus 5 and Opus 4.8, as of Claude Code 2.1.299); nothing when fast mode is not available to the account.

Each part is left out when there is nothing to say, and the ` · ` separators are grey. The right part sits against the band's right edge by flex (`justifyContent`, `flexGrow`, `flexWrap`), not by counted spaces, so it lines up the same in the terminal and in the app's proportional font. When the whole line does not fit in the band's width, the right part moves to a second line, still on the right. The left part is never cut; the right part alone, if too long, is cut at its end.

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

The right part comes from the main session alone; subagents' requests, turns and events (which carry an agent id) are left out:

- **Model**: the model that answered each request (`usage.model` in the `turn.step` result, or the request's `e.model`). On a switch, `to_model` of `classic.PostModelSwitch`. At the start, `model` of `classic.SessionStart`, or `$.session.model()`. A value that names no version (an alias such as `opus`) waits for the first request, which names the id.
- **Effort**: `e.effort` of each main-session `turn.step`. A model switch clears it until the next request says it again.
- **Fast mode**: the `fast` row of `$.config.list()` (labeled `Fast mode (…)`), which holds the session's state, the one `/fast` and the app's toggle change, not only the saved preference. The row exists only when fast mode is available to the account. It is read at the start, at the start of each main-session turn, after `classic.PostModelSwitch` and `classic.ConfigChange`, and when `/config` changes it.
- **Ultracode**: the engine's own reminders to the model. Claude Code sends `ultra_effort_enter` while ultracode is in effect for the session (turned on in the menu or with `/effort ultracode`, on a model that supports it) and `ultra_effort_exit` once it is off; the mod reads them as they go out (`prompt.attachment`). The `ultracode` keyword at the start of a prompt is a different attachment and does not count.

Nothing is read on a timer: what no event catches between responses shows at the next request. The band is redrawn only when a value it shows changes.

| Hook | What it does |
|------|--------------|
| `session.start` | Takes a first reading, so the band shows before the first turn, reads the model from `$.session.model()` and fast mode from `$.config.list()`. |
| `classic.SessionStart` | Takes the model the session starts on, when the event names one. |
| `turn.start` | Reads fast mode again at the start of each main-loop turn. Subagent turns are skipped. |
| `turn.complete` | Takes a reading after each main-loop turn. Subagent turns are skipped. |
| `turn.step` | After each model request of a main-loop turn (so after each tool use too), updates the icon, percentage and tokens from that request's usage, and the model and effort from the request. Subagent requests are skipped. |
| `classic.PostModelSwitch` | Takes the new model, clears the effort and reads fast mode again. A subagent's switch is skipped. |
| `classic.ConfigChange` | Reads fast mode again after a settings file changes. |
| `config.set` with `{key: "fast"}` | Reads fast mode again when `/config` changes it. |
| `prompt.attachment` with `ultra_effort_enter` and `ultra_effort_exit` | Turns ultracode on and off as the engine tells the model. Subagents' reminders are skipped. The attachment goes out unchanged. |
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
- **The effort shows from the first request on.** Claude Code tells a mod the effort only with each request, so before the first one, and after a model switch until the next one, there is none to show.
- **A change between responses can show only at the next request.** Nothing is read on a timer: an effort changed in the menu shows with the next request; ultracode turned on or off shows when the next prompt is sent, since that is when Claude Code tells the model; fast mode is read again at each turn's start and on the events above, so a `/fast` or an app toggle between turns shows when the next turn starts.
- **Fast mode's pause at its limit does not show.** When fast mode reaches its rate limit, Claude Code answers at standard speed for a while and keeps fast mode on; mods cannot see that pause, so the line keeps `fast on`.
- **The models that have fast mode are a list in the mod** (`FAST_MODELS` in `hooks/token-weather.mjs`), taken from the model catalog of Claude Code 2.1.299: Opus 5.5, Opus 5 and Opus 4.8. Claude Code gives mods no way to ask whether a model has fast mode. A model added later shows `fast on` when it is on, but no `fast off` until the list is updated.
- **`fast on` uses a fixed orange.** Claude Code's own fast-mode sign uses its theme's `fastMode` color, which is not among the theme keys mods are sure to have on every surface, so the mod uses `#e0600a`, close to it and readable on light and dark themes.
- **Ultracode after a restart or resume** shows once Claude Code sends its reminder again, at a following prompt.
- **Where an organization manages Claude Code**, the `classic.*` and `prompt.attachment` events pass over the plugins a person installs, so the model then follows requests and `$.session.model()` alone, and ultracode does not show.

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
- **The session on the right.** The line also shows the main session's model, effort, ultracode and fast mode, against the band's right edge, moving to a second line when the band is too narrow. The example showed only the context.
- **Tests.** `tests/token-weather.test.ts` is new and runs under `claude plugin test`.
- **Packaging.** A new author and marketplace, this README rewritten, and the example's screenshots removed, since they showed the old colors.

## License

Apache License 2.0. See [LICENSE](../LICENSE).
