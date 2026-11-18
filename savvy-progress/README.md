<!-- Modified by joaopasbento in 2026: a copy of savvy-progress 1.2.0 by johnnyvizz (MIT), from github.com/JohnnyVizz/claude-kit at commit 272a877, changed in 1.2.1, 1.2.2, 1.2.3, 1.2.4, 1.2.5, 1.2.6, 1.2.7 and 1.2.8. -->

# savvy-progress

> **This is a modified copy.** It copies savvy-progress 1.2.0 by [johnnyvizz](https://github.com/johnnyvizz), from [JohnnyVizz/claude-kit](https://github.com/JohnnyVizz/claude-kit/tree/272a877/plugins/savvy-progress), folder `plugins/savvy-progress` at commit `272a877`, under the MIT License ([LICENSE](LICENSE)). What changed from the author's 1.2.0, in 1.2.1:
>
> - **The band is shared.** The progress bar goes on top of whatever the other mods draw above the prompt, instead of replacing it. Alone, it draws as before. When the band is taller than its rows, Claude Code shows its top, so the bar stays in view.
> - **No cost.** The estimated cost is gone from the bar's panel, its views and the descriptions, along with the price table: with a subscription, API prices are not what you pay. Tokens and time stay.
> - **Any work in several parts.** The `progress` tool's description now fits any multi-part task, and still serves savvy-flow.
> - **The bar shows in the terminal.** Claude Code's terminal now lists `Svg` among its elements but draws none, so the bar showed only its buttons there. The SVG row is now drawn on the desktop alone, as the panel already did, and the terminal gets the text bar.
>
> And in 1.2.2:
>
> - **The title moves right.** In the terminal it starts after the dot and two spaces (column 3), in the app at x=19 inside the SVG, with the bar after it. The dot stays where it was.
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
> And in 1.2.5:
>
> - **Effort uses the app's names.** The agents panel shows each agent's effort with the names of the app's effort menu, on the desktop and in the terminal: `xhigh` shows as `extra`, and low, medium, high and max stay as they are. The planned heavy tier reads `Opus · extra`.
>
> And in 1.2.6:
>
> - **The bar shows by itself while subagents run.** As soon as at least one subagent of any type runs (Explore, general-purpose, Plan or any other), the bar appears, with no progress call: the title "Agents", how many are running, the wave's agents finished out of started, and the crew button that opens the panel. It has no dismiss and leaves by itself when none runs. A wave is every run that overlapped the stretch since none was running. Work that reports progress (`progress`, savvy-flow) keeps its own bar, as before.
>
> And in 1.2.7:
>
> - **No task list unless the panel is asked for.** The `progress` tool's description now tells the model not to pass `tasks` unless the user asks for the agents panel, so the panel does not open by itself.
>
> And in 1.2.8:
>
> - **No dependency.** The manifest no longer lists another mod as a dependency, so savvy-progress installs, updates and uninstalls on its own. The bar still goes on top of whatever the other mods draw above the prompt.
>
> The savvy-flow skill this mod was made for is not part of this marketplace.

A Claude Code mod: a progress bar above the prompt and a live panel of subagents. Made for the [savvy-flow](https://github.com/JohnnyVizz/claude-kit/tree/272a877/plugins/savvy-flow) skill, and useful with any subagents.

- **Progress bar**: the flow's title, phase, accepted tasks out of planned, and a button with the crew size that opens the panel. It appears once something reports progress (savvy-flow does) or a `savvy-*` worker starts, and by itself, under the title "Agents", while at least one subagent of any type runs; that one leaves when none runs.
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
