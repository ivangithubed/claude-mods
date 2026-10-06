# learningtogether-mods

A Claude Code plugin marketplace with mods by [learningtogetherua](https://github.com/ivangithubed). A mod is a plugin that runs inside Claude Code: it can draw its own panes, step into tool calls and add commands. See [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview).

**English** · [Українська](README.uk.md)

## Plugins

| Plugin | What it does |
| :- | :- |
| [`trace-map`](plugins/trace-map/) | A pane with a live SVG map of what Claude is doing: the turn's phase, the last tool, the thought stream, a radial map of touched files, and an activity strip |

## Install

You need Claude Code 2.1.287 or later in the terminal, or the Claude Desktop app from 2.1.286.

In a Claude Code session:

```text
/plugin marketplace add ivangithubed/claude-mods
/plugin install trace-map@learningtogether-mods
```

Or from your shell, without starting a session:

```bash
claude plugin marketplace add ivangithubed/claude-mods
claude plugin install trace-map@learningtogether-mods
```

After installing from your shell, run `/reload-plugins` in any session that is already open. To check, run `/plugin`: it shows `1 mod active · trace-map`. In Claude Desktop the plugin appears under **Customize → Plugins**.

## Update

Auto-update is off by default for third-party marketplaces. To get a new version:

```bash
claude plugin update trace-map@learningtogether-mods
```

Or in a session: `/plugin` → **Marketplaces** → `learningtogether-mods` → **Update marketplace**. The same screen has **Enable auto-update**.

A new version arrives only when `version` changes in `plugins/<name>/.claude-plugin/plugin.json`. Each plugin's changes are listed in its README and in this repository's commits.

## Before you trust a mod

A mod runs with your permissions inside Claude Code. Before you install one, you can list which events it handles and what it asks Claude Code to do, without running it:

```bash
git clone https://github.com/ivangithubed/claude-mods
claude plugin validate ./claude-mods/plugins/trace-map
```

The `hooks:` and `calls:` lines of the output are the full list of what the mod does. Each plugin's README includes that output and an honest section on what the mod reads and what it doesn't do.

## Layout

```text
.claude-plugin/marketplace.json   the marketplace catalog
plugins/trace-map/                the trace-map plugin: manifest, hooks, tests, docs
LICENSE                           MIT
```

## Checks before a commit

```bash
claude plugin validate .
claude plugin validate ./plugins/trace-map
claude plugin test ./plugins/trace-map
```

## License

[MIT](LICENSE) © 2026 learningtogetherua
