# trace-map privacy policy

Last updated: 2026-10-07. Applies to trace-map 0.3.0 and later.

trace-map is a Claude Code mod that draws a pane showing what Claude is doing in the current session. It runs entirely on your machine, inside Claude Code. It has no server, no account and no analytics.

## What it reads

While a session runs, the mod reads these events from Claude Code, only to draw the pane:

- **Tool calls:** the tool's name and its input. That is the file path for `Read`, `Edit`, `Write` and `NotebookEdit`; the pattern and folder for `Grep` and `Glob`; the first line of the command for `Bash` and `PowerShell`; and the description for `Agent`.
- **Claude's reasoning:** the thinking text of the main agent as it streams, to show its last lines in the pane.
- **Session facts:** the working folder, the session id and the theme from `/config`.

Claude Code also passes the mod the events for the start and end of each turn, which carry your prompt and Claude's answer. The mod uses them only to know when a turn starts and ends. It does not use or keep their text. It does not open your files, your memory or your chat history.

## What it stores, where, and for how long

- **In memory, for the current session:** the last 600 characters of Claude's reasoning. They are never written anywhere and are gone when the turn ends or the session closes.
- **In Claude Code's local plugin store, on your machine:** the map's state, so the pane survives `/reload-plugins`. That state is the touched file paths, the searched folders and patterns, the order of the last files touched, per-call tool names and success, the count of calls, the turn's phase, and the last tool call with its gist, such as a path or the first line of a command. It is kept under a key for the session and deleted when the session ends.
- **Your setting:** whether the phrases are on or off, kept in Claude Code's settings or the local plugin store.

The mod keeps no log. It stores no prompt text and no reasoning text.

## What it sends

Nothing. The mod makes no network requests, calls no model, starts no processes and reads or writes no files. You can confirm this without running it:

```bash
claude plugin validate ./plugins/trace-map
```

The `calls:` line of the output lists every Claude Code API the mod uses. None of them reach the network or the file system.

## Who sees the data

Only you, on your machine. The pane is visible on your screen, so anyone who sees your screen or a recording of it sees what the pane shows.

## Children

The mod is a developer tool and is not directed at children under 18.

## Contact

Questions and reports: [GitHub Issues](https://github.com/ivangithubed/claude-mods/issues).
