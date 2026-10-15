<!-- Modified by joaopasbento in 2026: a copy of savvy-progress 1.2.0 by johnnyvizz (MIT), from github.com/JohnnyVizz/claude-kit at commit 272a877, changed in 1.2.1, 1.2.2, 1.2.3 and 1.2.4. -->

# savvy-progress

> **This is a modified copy.** It copies savvy-progress 1.2.0 by [johnnyvizz](https://github.com/johnnyvizz), from [JohnnyVizz/claude-kit](https://github.com/JohnnyVizz/claude-kit/tree/272a877/plugins/savvy-progress), folder `plugins/savvy-progress` at commit `272a877`, under the MIT License ([LICENSE](LICENSE)). What changed from the author's 1.2.0, in 1.2.1:
>
> - **The band is shared.** The progress bar goes on top of whatever the other mods draw above the prompt, instead of replacing it. Alone, it draws as before. The manifest lists [token-weather](../token-weather/README.md) as a dependency, so this mod's hooks run before token-weather's: the bar always sits first, the context line right under it, and anything else (another mod's notes) below both. When the band is taller than its rows, Claude Code shows its top, so the bar and the line stay in view. Installing savvy-progress installs token-weather with it.
> - **No cost.** The estimated cost is gone from the bar's panel, its views and the descriptions, along with the price table: with a subscription, API prices are not what you pay. Tokens and time stay.
> - **Any work in several parts.** The `progress` tool's description now fits any multi-part task, and still serves savvy-flow.
> - **The bar shows in the terminal.** Claude Code's terminal now lists `Svg` among its elements but draws none, so the bar showed only its buttons there. The SVG row is now drawn on the desktop alone, as the panel already did, and the terminal gets the text bar.
>
> And in 1.2.2:
>
> - **The bar lines up with token-weather's line.** The title starts where the forecast word does under it: in the terminal after the dot and two spaces (column 3), in the app at x=19 inside the SVG, with the bar after it. The dot stays where it was.
> - **Every agent type is dressed.** The panel picks each agent's costume and color by its exact type, from one table (`AGENT_LOOKS` in `hooks/register.tsx`): general-purpose the engineer, Explore the pirate, Plan the chef, claude-code-guide the detective, claude the astronaut, fork the racer. Any other type, or one a plugin prefixes, keeps the plain crab. savvy-flow's workers and planned tasks are dressed by their tier, as before, and the bar's crab stays plain. In the terminal, the type's ▣ and name take its color.
>
> And in 1.2.3:
>
> - **Wrong calls are refused.** The `progress` and `step` tools refuse a call with an argument their input schema does not list, or a value it does not accept, instead of answering "ok" and leaving the bar where it was. The refusal names the field and the right one, as in `Unknown field "completed". Use "done" (integer): the number of parts finished.`, so the model corrects itself on the next try; a refused call changes neither the bar nor the panel. Right calls work as before.
>
> And in 1.2.4:
>
> - **Only known slips are refused.** An unknown argument makes the call fail only when it is a known slip for a real field, such as `completed` for `done`. Any other unknown key is let through, as up to 1.2.2: the `tool.call` event carries keys of its own beside the arguments, and a newer Claude Code may add more, which 1.2.3 would have refused on every call. Values the schema does not take and missing required fields are still refused, and so is a call with none of the tool's fields, which would change nothing; its refusal lists the fields.
>
> The savvy-flow skill this mod was made for is not part of this marketplace.

A Claude Code mod: a progress bar above the prompt and a live panel of subagents. Made for the [savvy-flow](https://github.com/JohnnyVizz/claude-kit/tree/272a877/plugins/savvy-flow) skill, and useful with any subagents.

- **Progress bar**: the flow's title, phase, accepted tasks out of planned, and a button with the crew size that opens the panel. It appears once something reports progress (savvy-flow does) or a `savvy-*` worker starts.
- **Agents panel** (`/agents-info` toggles it): running, finished and planned subagents with model, effort, task progress, context, tokens and time. Working crabs walk, and each costume animates its prop: the astronaut floats, the detective sweeps the magnifier, the engineer turns the wrench, the chef tosses the omelette, the racer runs with a fluttering flag. `prefers-reduced-motion` stops them.

## Tools it adds

- `mcp__savvy-progress__progress`: reports the progress of any work in several parts: the title, the parts planned and finished, and the phase. With savvy-flow, the orchestrator reports the plan, phase and accepted tasks.
- `mcp__savvy-progress__step`: a worker reports its own steps (`done`, `total`, `note`). A worker that does not report shows its context fill in grey instead.

## Settings

`language`: `auto` (default), `en` or `ru`. `auto` follows Claude Code's `language` setting, then the system locale, and falls back to English. Set it in `/config`, or, for a mod loaded by hand, in `~/.claude/settings.json`:

```json
{ "pluginConfigs": { "savvy-progress": { "options": { "language": "ru" } } } }
```

Install instructions are in the [repository README](https://github.com/JohnnyVizz/claude-kit/blob/272a877/README.md).
