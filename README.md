# claude-mods

A plugin marketplace of mods for [Claude Code](https://code.claude.com): small plugins that change what Claude Code shows you while you work.

## Mods

- **[token-weather](token-weather/README.md)**: a live forecast of the context window, drawn as one line above the prompt, with a weather icon, the percentage used and a chart of the last turns.

## Install

In Claude Code (2.1.287 or later):

```text
/plugin marketplace add joaopasbento/claude-mods
/plugin install token-weather@claude-mods
```

## License

Apache License 2.0. See [LICENSE](LICENSE). token-weather started from an example by Anthropic; its README's [Origin](token-weather/README.md#origin) section names the source commit and lists what changed.
