# trace-map

A Claude Code mod that adds a pane beside the transcript and draws, live, what Claude is doing during a turn. It was built for screencasts: instead of a wall of logs, viewers watch a map.

**English** · [Українська](README.uk.md)

![The Trace map pane in the Claude Desktop Code tab](docs/trace-map-screenshot.png)

*The pane while Claude works on this repository: a shell call disguised as a chore, the thought stream on the right, the file map on the left, and the activity strip.*

## What it draws

One SVG image, redrawn on every event. From top to bottom:

- **Phase ring** and label: `idle` (grey), `thinking` (yellow, the arc turns), `using a tool` (blue), `answered` (green dot).
- **Action line**: a status mark (`…` running, `✓` done, `✗` error), a phrase in the tool's color, and a small hint such as a file name or a search pattern. By default the phrase is a homely chore in Ukrainian instead of the raw command, for example `✓ пришиваю ґудзик, відірваний втретє  login.ts` ("sewing on a button, torn off for the third time"). Each kind of call has its own set of phrases: search, read, edit, write, shell, delete, build, git, commit, push, pull, tests, notes, subagent and web.
- **Thought stream**: the last lines of the model's reasoning in grey italics while it thinks.
- **File map**: the project at the center, folders on the inner ring and files on the outer ring. A folder that was searched is a dashed amber circle. A file's dot grows with every touch and takes the color of the last tool. Blue arcs join files touched one after another.
- **Activity strip**: one tick per tool call in the tool's color, with errors as short red ticks, next to an `N tool calls` counter.
- **Legend**: `read` blue, `search` amber, `edit` green, `shell` purple, `agent` pink.
- **Row under the image**: `N files`, a `clear` button, and a button that turns the phrases off and on.

In the terminal the pane shows a text list instead of the SVG. The pane opens by itself when a session starts.

## Commands

| Command | What it does |
| :- | :- |
| `/trace-map` | Open the pane |
| `/trace-map honest` | Show the tool and its gist instead of the phrases |
| `/trace-map disguise` | Bring the phrases back |
| `/trace-map log` | The session's timeline: turns and calls, what each phrase showed and what it stood for |
| `/trace-map log last` | The same, for the last turn only |

The phrases choice is kept between sessions. You can also change it in `/plugin` → **Installed** → `trace-map` → **Configure options** (the **Disguise the last tool** option), or in the `trace-map.disguise` row of `/config`.

## Install

In a Claude Code session:

```text
/plugin marketplace add ivangithubed/claude-mods
/plugin install trace-map@learningtogether-mods
```

From your shell:

```bash
claude plugin marketplace add ivangithubed/claude-mods
claude plugin install trace-map@learningtogether-mods
```

If a session is already open, run `/reload-plugins` there. To check, run `/plugin`: it shows `1 mod active · trace-map`.

It needs Claude Code 2.1.287 or later in the terminal, or the Claude Desktop app from 2.1.286. The pane is drawn in the terminal and in the Code tab of Claude Desktop. In the VS Code extension, `claude -p` and cloud sessions the hooks run but nothing is drawn.

## Pane width

The image adapts to the pane's width, but the action line is only readable in full at some widths. A quick check: a line such as `✓ пришиваю ґудзик, відірваний втретє  login.ts` should fit on one line with no `…` at the end.

| Pane width | Layout | What you see |
| :- | :- | :- |
| under ~57 columns (~440 px) | stacked | the phrase is cut |
| ~60–79 columns (~470–620 px) | stacked | the full phrase; the file hint may drop |
| **~80–91 columns (~620–710 px)** | stacked | **phrase and hint in full: recommended for a narrow pane** |
| ~92–149 columns (~720–1180 px) | map left, text right | the right column is narrow and the phrase is shortened |
| **~150 columns and up (~1180 px)** | map left, text right | **everything in full: recommended for a wide pane** |

Pixels are approximate, since the mod counts 8 px per column. For screen recording, use either a narrow pane of 80–91 columns or a wide one of 150 or more.

## What the mod reads, and what it doesn't do

The mod runs inside Claude Code with your permissions, so here is the full list.

**What it reads while a session runs:**

- the input of every tool call: the file path for `Read`, `Edit`, `Write` and `NotebookEdit`; the pattern and folder for `Grep` and `Glob`; the first line of the command for `Bash` and `PowerShell`, from which it also picks the tokens that look like file names; the description for `Agent`;
- the model's reasoning (`thinking`) as it streams, for the main agent only; it keeps the last 600 characters in memory;
- the session's working folder, its id, and the theme from `/config`;
- the text of your prompt at the start of each turn: its first 60 characters go into the log.

**What it stores:** the map's state (files, trail, counters) and the log for `/trace-map log`, in Claude Code's plugin store (`$.store`) under a key for the session, so they survive `/reload-plugins`. The log holds up to 400 lines: the time and the first 60 characters of the prompt at the start of each turn, and for each call its time, duration, phrase and the first 60 characters of its gist (a path, a pattern or a command). The session's key is deleted when the session ends. The phrases choice is stored separately.

**What it doesn't do:**

- it makes no network requests, calls no model and starts no processes;
- it reads and writes no files on disk: none of the `calls:` below touch files or the network;
- it changes no tool calls, prompts or permissions: every hook passes its event on unchanged.

The full list of events and API calls is what `claude plugin validate` prints for this folder:

```text
Validating plugin manifest: .../plugins/trace-map/.claude-plugin/plugin.json

Validating hooks: .../plugins/trace-map/hooks/hooks.json

  ❯ ./register.tsx hooks: session.start, session.end, config.set{key=theme}, command.run{command=trace-map}, turn.start, turn.complete, turn.step, tool.call, ui.render{component=Pane, requestId=trace-map}
  ❯ ./register.tsx calls: $.command.register, $.config.list (via readTheme), $.config.set (via setDisguise), $.session.id, $.store.delete, $.store.get, $.store.set (via changed, setDisguise), $.ui.invalidate, $.ui.open, $.ui.resolve

✔ Validation passed
```

## Development

```bash
claude plugin validate ./plugins/trace-map
claude plugin test ./plugins/trace-map
```

There are 14 tests in `hooks/register.test.ts`. The files:

```text
.claude-plugin/plugin.json   manifest, with the `disguise` userConfig option
hooks/hooks.json             points to the hooks module
hooks/register.tsx           the hooks and the drawing
hooks/disguise.ts            the phrases and how calls are classified
hooks/register.test.ts       tests
types/index.d.ts             shared types
docs/                        a sound design brief and a sample log, in Ukrainian
```

Claude Code generates the `.claude-plugin/types/` folder with the mods API types, and it is in `.gitignore`.

## Versions

- **0.2.0**: Ukrainian chore phrases by kind of call, a button and `/trace-map honest|disguise|log`, the thought stream in the pane, state kept across reloads.
- **0.1.0**: first version with the phase ring, tool line, radial file map and activity strip.

## License

[MIT](../../LICENSE) © 2026 learningtogetherua
