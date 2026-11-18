# claude-mods

A plugin marketplace of mods for [Claude Code](https://code.claude.com): small plugins that change what Claude Code shows you while you work.

## Mods

- **[savvy-progress](savvy-progress/README.md)**: a progress bar above the prompt for work in several parts, and a panel of subagents (`/agents-info`) with their model, context, tokens and time. A modified copy of savvy-progress 1.2.0 by johnnyvizz.

It shares the band above the prompt with the other mods: its bar goes on top of whatever another mod draws (Claude Code's bundled mods included). When the band runs out of rows it shows its top, so the bar stays in view.

## Install

In Claude Code (2.1.287 or later):

```text
/plugin marketplace add joaopasbento/claude-mods
/plugin install savvy-progress@claude-mods
```

## License

Apache License 2.0. See [LICENSE](LICENSE).

savvy-progress is by johnnyvizz, under the MIT License, kept in [savvy-progress/LICENSE](savvy-progress/LICENSE); the note at the top of its [README](savvy-progress/README.md) names the source commit and lists what changed.
