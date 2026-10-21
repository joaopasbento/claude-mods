# claude-mods

A plugin marketplace of mods for [Claude Code](https://code.claude.com): small plugins that change what Claude Code shows you while you work.

## Mods

- **[token-weather](token-weather/README.md)**: a live forecast of the context window, drawn as one line above the prompt, with a weather icon, the percentage used and the tokens used of the window, followed by the session's model, effort and ultracode.
- **[savvy-progress](savvy-progress/README.md)**: a progress bar above the prompt for work in several parts, and a panel of subagents (`/agents-info`) with their model, context, tokens and time. A modified copy of savvy-progress 1.2.0 by johnnyvizz. It depends on token-weather, so installing it installs both.

Both share the band above the prompt with the other mods: the savvy-progress bar always first, the token-weather line right under it, and anything another mod draws (Claude Code's bundled mods included) below both. When the band runs out of rows it shows its top, so the bar and the line stay in view.

## Install

In Claude Code (2.1.287 or later):

```text
/plugin marketplace add joaopasbento/claude-mods
/plugin install token-weather@claude-mods
/plugin install savvy-progress@claude-mods
```

savvy-progress lists token-weather as a dependency, so its install alone brings both.

## License

Apache License 2.0. See [LICENSE](LICENSE). token-weather started from an example by Anthropic; its README's [Origin](token-weather/README.md#origin) section names the source commit and lists what changed.

savvy-progress is by johnnyvizz, under the MIT License, kept in [savvy-progress/LICENSE](savvy-progress/LICENSE); the note at the top of its [README](savvy-progress/README.md) names the source commit and lists what changed.
