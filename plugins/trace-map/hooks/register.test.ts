import { expect, mock, test } from 'claude-code/testing'

import { PHRASES, anyPhrase, kindOf, phraseOf } from './disguise'

const OK = { result: { stdout: '', stderr: '', interrupted: false } }
// How the test raises a slash command: typed at the prompt, on an 80-column main screen
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

const PANE = {
  component: 'Pane',
  requestId: 'trace-map',
  props: {
    title: 'Trace map',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('the terminal pane starts empty and idle', async ($, on) => {
  mock.store(on)
  const ui = await $.ui.mount({ plugin: 'trace-map', surface: 'terminal', ...PANE })
  expect(await ui.find({ type: 'Text', text: /idle/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /nothing touched yet/ })).toBeDefined()
  await ui.unmount()
})

test('the desktop pane draws the map as one SVG', async ($, on) => {
  mock.store(on)
  const ui = await $.ui.mount({ plugin: 'trace-map', surface: 'desktop', ...PANE })
  const map = await ui.find({ type: 'Svg' })
  expect(map).toBeDefined()
  expect(String(map?.props.source)).toContain('<svg')
  expect(String(map?.props.source)).toContain('nothing touched yet')
  await ui.unmount()
})

test('a Read call lands in the trail and the file list, and the phase follows the turn', async ($, on) => {
  mock.store(on)
  on('turn.start', async (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', async (_, e) => ({ text: e.answer }))
  on('tool.call', async () => ({ result: { stdout: '', stderr: '', interrupted: false } }))

  const ui = await $.ui.mount({ plugin: 'trace-map', surface: 'terminal', ...PANE })

  await $.turn.start({ text: 'find the debt', turnId: 't1' })
  expect(await ui.find({ type: 'Text', text: /thinking/ })).toBeDefined()

  await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: 'C:/proj/src/auth/login.ts' })
  await $.tool.call({ tool: 'Read', tool_use_id: 'r2', file_path: 'C:/proj/src/auth/login.ts' })
  await $.tool.call({ tool: 'Grep', tool_use_id: 'g1', pattern: 'TODO', path: 'C:/proj/src' })

  expect(await ui.find({ type: 'Text', text: /src\/auth\/login\.ts/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /2×/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /3 tool calls/ })).toBeDefined()
  // Disguised by default: the Grep is a search chore, its pattern the hint
  expect(await ui.find({ type: 'Text', text: anyPhrase('search') })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '/TODO/' })).toBeDefined()
  // Grep's path is a search root, not a touched file: one file row, not two
  expect(await ui.find({ type: 'Text', text: '(1)' })).toBeDefined()
  expect(await ui.findAll({ type: 'Text', text: '\u00d7' })).toHaveLength(1)

  await $.turn.complete({ answer: 'done', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' })
  expect(await ui.find({ type: 'Text', text: /answered/ })).toBeDefined()

  await ui.press({ key: 'clear' })
  expect(await ui.find({ type: 'Text', text: /nothing touched yet/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /0 tool calls/ })).toBeDefined()
  await ui.unmount()
})

test('the desktop map marks the file read and the directory searched', async ($, on) => {
  mock.store(on)
  on('tool.call', async () => ({ result: { stdout: '', stderr: '', interrupted: false } }))

  const ui = await $.ui.mount({ plugin: 'trace-map', surface: 'desktop', ...PANE })
  await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: 'C:/proj/src/auth/login.ts' })
  await $.tool.call({ tool: 'Grep', tool_use_id: 'g1', pattern: 'TODO', path: 'C:/proj/src' })

  const source = String((await ui.find({ type: 'Svg' }))?.props.source)
  expect(source).toContain('login.ts')
  expect(source).toContain('stroke-dasharray="3 2"')
  expect(source).toContain('2 tool calls')
  await ui.unmount()
})

test('a shell command touches the files it names, and a Grep over one file touches it too', async ($, on) => {
  mock.store(on)
  on('tool.call', async () => ({ result: { stdout: '', stderr: '', interrupted: false } }))

  // A wide pane, where file labels are not cut short
  const ui = await $.ui.mount({ plugin: 'trace-map', surface: 'desktop', ...PANE, props: { ...PANE.props, bodyColumns: 120 } })
  await $.tool.call({
    tool: 'Bash',
    tool_use_id: 'b1',
    command: "awk 'NR>160 && /#[0-9a-f]{3,8}/ {print NR\": \"$0}' src/ui/theme.css | head -30; cat README.md",
  })
  await $.tool.call({ tool: 'Grep', tool_use_id: 'g1', pattern: '^#', path: 'D:/proj/research/brand-guidebook.md' })

  const source = String((await ui.find({ type: 'Svg' }))?.props.source)
  // Labels are cut to 16 characters, so the long name is matched by its head
  expect(source).toContain('theme.css')
  expect(source).toContain('README.md')
  expect(source).toContain('brand-guidebook')
  // Neither the awk program nor the Grep over a file is a directory scan
  expect(source).not.toContain('stroke-dasharray="3 2"')
  await ui.unmount()
})

test('the disguise picks a chore by the kind of call, with a word of context', async ($, on) => {
  mock.store(on)
  on('turn.start', async (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', async (_, e) => ({ text: e.answer }))
  on('tool.call', async () => OK)

  const ui = await $.ui.mount({ plugin: 'trace-map', surface: 'terminal', ...PANE })
  await $.turn.start({ text: 'tidy up', turnId: 't1' })

  await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: 'C:/proj/src/auth/login.ts' })
  expect(await ui.find({ type: 'Text', text: anyPhrase('read') })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'login.ts' })).toBeDefined()

  await $.tool.call({ tool: 'Edit', tool_use_id: 'e1', file_path: 'C:/proj/src/auth/login.ts', old_string: 'a', new_string: 'b' })
  expect(await ui.find({ type: 'Text', text: anyPhrase('edit') })).toBeDefined()

  await $.tool.call({ tool: 'Glob', tool_use_id: 'g1', pattern: 'src/**/*.ts' })
  expect(await ui.find({ type: 'Text', text: anyPhrase('search') })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'src/**/*.ts' })).toBeDefined()

  await $.tool.call({ tool: 'Bash', tool_use_id: 'b1', command: 'git status --short' })
  expect(await ui.find({ type: 'Text', text: anyPhrase('git') })).toBeDefined()
  // A command's text is never the hint: only a file it names or a pattern is
  expect(await ui.find({ type: 'Text', text: /git status/ })).toBeUndefined()

  await $.tool.call({ tool: 'Bash', tool_use_id: 'b2', command: 'npm test -- --watch=false' })
  expect(await ui.find({ type: 'Text', text: anyPhrase('test') })).toBeDefined()

  await $.tool.call({ tool: 'Bash', tool_use_id: 'b3', command: "cat >> TECH-DEBT.md <<'EOF'\n- fix it\nEOF" })
  expect(await ui.find({ type: 'Text', text: anyPhrase('note') })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'TECH-DEBT.md' })).toBeDefined()

  await $.tool.call({ tool: 'Bash', tool_use_id: 'b4', command: 'ls -la' })
  expect(await ui.find({ type: 'Text', text: anyPhrase('shell') })).toBeDefined()

  await $.tool.call({ tool: 'Agent', tool_use_id: 'a1', description: 'find the debt', prompt: 'look for TODOs' })
  expect(await ui.find({ type: 'Text', text: anyPhrase('agent') })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /find the debt/ })).toBeUndefined()

  // The raw tool names stay off the line
  expect(await ui.find({ type: 'Text', text: /^[✓✗…] (Read|Edit|Glob|Bash|Agent)/ })).toBeUndefined()

  // After the answer, the disguise tidies up
  await $.turn.complete({ answer: 'done', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' })
  expect(await ui.find({ type: 'Text', text: anyPhrase('done') })).toBeDefined()
  await ui.unmount()
})

test('the phrase is picked by the call number, so a redraw keeps it', async () => {
  for (const kind of Object.keys(PHRASES) as (keyof typeof PHRASES)[]) {
    const n = PHRASES[kind].length
    expect(n).toBeGreaterThanOrEqual(3)
    expect(phraseOf(kind, 7)).toBe(phraseOf(kind, 7))
    expect(phraseOf(kind, 7)).toBe(phraseOf(kind, 7 + n))
    expect(phraseOf(kind, 1)).not.toBe(phraseOf(kind, 2))
  }
  expect(kindOf('Bash', 'git log -3')).toBe('git')
  expect(kindOf('PowerShell', 'Add-Content notes.md "x"')).toBe('note')
  expect(kindOf('Bash', 'echo x | tee -a log.txt')).toBe('note')
  expect(kindOf('Bash', 'npx vitest run')).toBe('test')
  expect(kindOf('Bash', 'cd x && claude plugin test ./y')).toBe('test')
  expect(kindOf('Bash', 'cat file.md')).toBe('shell')
  expect(kindOf('WebFetch', '')).toBe('web')
  expect(kindOf('mcp__foo__bar', '')).toBe('other')
})

test('a write makes, an edit mends; a shell deletes, builds or checks; git looks back, fixes, sends or fetches', async () => {
  expect(kindOf('Write', '')).toBe('write')
  expect(kindOf('Edit', '')).toBe('edit')
  expect(kindOf('NotebookEdit', '')).toBe('edit')

  expect(kindOf('Bash', 'rm -rf dist')).toBe('remove')
  expect(kindOf('PowerShell', 'Remove-Item -Recurse out')).toBe('remove')
  expect(kindOf('Bash', 'git clean -fd')).toBe('remove')
  // `rm` inside a word is not a delete
  expect(kindOf('Bash', 'npm run format')).toBe('shell')

  expect(kindOf('Bash', 'npm install')).toBe('build')
  expect(kindOf('Bash', 'pnpm i && pnpm build')).toBe('build')
  expect(kindOf('Bash', 'cargo build --release')).toBe('build')
  expect(kindOf('Bash', 'make -j4')).toBe('build')

  // Checks are tests; `npx` alone says nothing, the runner after it does
  expect(kindOf('Bash', 'tsc -p . --noEmit')).toBe('test')
  expect(kindOf('Bash', 'npx tsc --noEmit')).toBe('test')
  expect(kindOf('Bash', 'npx prettier --write .')).toBe('shell')
  expect(kindOf('Bash', 'npm run lint')).toBe('test')
  expect(kindOf('Bash', 'claude plugin validate ./x')).toBe('test')
  expect(kindOf('Bash', 'cargo clippy')).toBe('test')
  // A test runner wins over the build that precedes it on the same line
  expect(kindOf('Bash', 'npm ci && npm test')).toBe('test')

  expect(kindOf('Bash', 'git status --short')).toBe('git')
  expect(kindOf('Bash', 'git diff HEAD~1')).toBe('git')
  expect(kindOf('Bash', 'git add -A && git commit -m "x"')).toBe('commit')
  expect(kindOf('Bash', 'git stash')).toBe('commit')
  expect(kindOf('Bash', 'git push -u origin main')).toBe('send')
  expect(kindOf('Bash', 'gh pr create --fill')).toBe('send')
  expect(kindOf('Bash', 'git pull --rebase')).toBe('fetch')
  expect(kindOf('Bash', 'git clone https://x/y.git')).toBe('fetch')
  // Commit then push: the push is what the line is for
  expect(kindOf('Bash', 'git commit -m "x" && git push')).toBe('send')

  for (const kind of ['write', 'remove', 'build', 'commit', 'send', 'fetch'] as const) {
    expect(PHRASES[kind].length).toBeGreaterThanOrEqual(3)
  }
})

test('with disguise off the honest line shows the tool and its gist', { options: { disguise: false } }, async ($, on) => {
  mock.store(on)
  on('tool.call', async () => OK)

  const ui = await $.ui.mount({ plugin: 'trace-map', surface: 'terminal', ...PANE })
  await $.tool.call({ tool: 'Bash', tool_use_id: 'b1', command: 'git status --short' })
  expect(await ui.find({ type: 'Text', text: /^✓ Bash$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'git status --short' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: anyPhrase('git') })).toBeUndefined()

  await $.tool.call({ tool: 'Grep', tool_use_id: 'g1', pattern: 'TODO', path: 'C:/proj/src' })
  expect(await ui.find({ type: 'Text', text: /^✓ Grep$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '/TODO/ in C:/proj/src' })).toBeDefined()
  await ui.unmount()
})

test('the desktop map draws the chore in the tool color and the hint small, or the honest line when off', async ($, on) => {
  mock.store(on)
  on('tool.call', async () => OK)

  const ui = await $.ui.mount({ plugin: 'trace-map', surface: 'desktop', ...PANE })
  await $.tool.call({ tool: 'Edit', tool_use_id: 'e1', file_path: 'C:/proj/src/auth/login.ts', old_string: 'a', new_string: 'b' })
  const source = String((await ui.find({ type: 'Svg' }))?.props.source)
  // A narrow pane: the chore keeps its first clause and the hint stays, the aside goes
  const bare = PHRASES.edit.map(one => one.split(/[,:] /)[0])
  expect(source).toMatch(new RegExp(`fill="#34c27a">&#10003; (${bare.join('|')})</text>`))
  expect(source).toMatch(/font-size="16" fill="#9aa0a880">login\.ts</)
  expect(source).not.toContain('&#10003; Edit')
  await ui.unmount()
})

test('the desktop map draws the honest line when disguise is off', { options: { disguise: false } }, async ($, on) => {
  mock.store(on)
  on('tool.call', async () => OK)

  const ui = await $.ui.mount({ plugin: 'trace-map', surface: 'desktop', ...PANE })
  await $.tool.call({ tool: 'Edit', tool_use_id: 'e1', file_path: 'C:/proj/src/auth/login.ts', old_string: 'a', new_string: 'b' })
  const source = String((await ui.find({ type: 'Svg' }))?.props.source)
  expect(source).toContain('&#10003; Edit</text>')
  expect(source).toMatch(/font-size="20" fill="#9aa0a8">[^<]*login\.ts</)
  expect(source).not.toMatch(anyPhrase('edit'))
  await ui.unmount()
})

test('the pane has its own switch: ✕ turns the chores off, ✓ turns them back on, and the choice is kept', async ($, on) => {
  mock.store(on)
  on('tool.call', async () => OK)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'trace-map', surface, ...PANE })
    await $.tool.call({ tool: 'Bash', tool_use_id: `b-${surface}`, command: 'git status --short' })
    expect((await ui.find({ type: 'Button', key: 'disguise' }))?.props.label).toBe('✕ фрази')

    await ui.press({ key: 'disguise' })
    expect((await ui.find({ type: 'Button', key: 'disguise' }))?.props.label).toBe('✓ фрази')
    if (surface === 'terminal') {
      expect(await ui.find({ type: 'Text', text: /^✓ Bash$/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'git status --short' })).toBeDefined()
    } else {
      expect(String((await ui.find({ type: 'Svg' }))?.props.source)).toContain('&#10003; Bash</text>')
    }

    await ui.press({ key: 'disguise' })
    expect((await ui.find({ type: 'Button', key: 'disguise' }))?.props.label).toBe('✕ фрази')
    if (surface === 'terminal') expect(await ui.find({ type: 'Text', text: anyPhrase('git') })).toBeDefined()
    await ui.unmount()
  }
})

test('/trace-map honest and /trace-map disguise flip the line, /trace-map log lists the calls', async ($, on) => {
  mock.store(on)
  on('tool.call', async () => OK)

  on('turn.start', async (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', async (_, e) => ({ text: e.answer }))

  const ui = await $.ui.mount({ plugin: 'trace-map', surface: 'terminal', ...PANE })
  await $.turn.start({ text: 'note the debt', turnId: 't1' })
  await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: 'C:/proj/src/auth/login.ts' })
  await $.tool.call({ tool: 'Bash', tool_use_id: 'b1', command: "cat >> TECH-DEBT.md <<'EOF'\n- fix it\nEOF" })
  await $.turn.complete({ answer: 'done', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' })

  // A timeline: the turn's edges with the clock, each call with the clock and how long it took
  const log = await $.command.run({ command: 'trace-map', args: 'log', ...RUN })
  const lines = String(log.text).split('\n')
  expect(lines).toHaveLength(4)
  const CLOCK = '\\d\\d:\\d\\d:\\d\\d'
  const SPAN = '(\\d+\\.\\ds|\\d+m\\d\\ds)'
  expect(lines[0]).toMatch(new RegExp(`^── ${CLOCK} thinking · note the debt$`))
  expect(lines[1]).toMatch(new RegExp(`^#\\d+ ${CLOCK} \\+${SPAN} ✓ read · (${PHRASES.read.join('|')}) login\\.ts · Read C:/proj/src/auth/login\\.ts$`))
  expect(lines[2]).toMatch(new RegExp(`^#\\d+ ${CLOCK} \\+${SPAN} ✓ note · (${PHRASES.note.join('|')}) TECH-DEBT\\.md · Bash cat >> TECH-DEBT\\.md`))
  expect(lines[3]).toMatch(new RegExp(`^── ${CLOCK} answered · turn ${SPAN}$`))


  const honest = await $.command.run({ command: 'trace-map', args: 'honest', ...RUN })
  expect(honest.text).toContain('honest')
  expect(await ui.find({ type: 'Text', text: /^✓ Bash$/ })).toBeDefined()

  // The turn is answered, so the disguise shows the tidying-up, not the last chore
  const back = await $.command.run({ command: 'trace-map', args: 'disguise', ...RUN })
  expect(back.text).toContain('chores')
  expect(await ui.find({ type: 'Text', text: anyPhrase('done') })).toBeDefined()

  // A second turn; `log last` shows only it
  await $.turn.start({ text: 'and again', turnId: 't2' })
  await $.tool.call({ tool: 'Read', tool_use_id: 'r2', file_path: 'C:/proj/src/auth/session.ts' })
  await $.turn.complete({ answer: 'done', durationMs: 10, isAborted: false, turnId: 't2', reason: 'answer' })
  const last = String((await $.command.run({ command: 'trace-map', args: 'log last', ...RUN })).text).split('\n')
  expect(last).toHaveLength(3)
  expect(last[0]).toMatch(/^── \d\d:\d\d:\d\d thinking · and again$/)
  expect(last[1]).toContain('session.ts')
  expect(String((await $.command.run({ command: 'trace-map', args: 'log', ...RUN })).text).split('\n')).toHaveLength(7)
  await ui.unmount()
})

test('the thought streams into the pane, under the chore line, on both surfaces', async ($, on) => {
  mock.store(on)
  on('turn.start', async (_, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* (_, e) {
    yield { kind: 'thinking', index: 0, text: 'перевіряю, чи ' }
    yield { kind: 'thinking', index: 0, text: 'цілі думки' }
    yield { kind: 'stop', stopReason: 'end_turn', usage: null }
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'trace-map', surface, ...PANE })
    await $.turn.start({ text: 'think', turnId: `t-${surface}` })
    const stream = $.turn.step({ turnId: `t-${surface}`, index: 0, model: 'test', messageCount: 1 })
    for await (const _chunk of stream) {
      // read to the end
    }
    await stream.result
    if (surface === 'terminal') {
      expect(await ui.find({ type: 'Text', text: /перевіряю, чи цілі думки/ })).toBeDefined()
    } else {
      const source = String((await ui.find({ type: 'Svg' }))?.props.source)
      expect(source).toMatch(/font-style="italic"[^>]*>перевіряю, чи цілі думки</)
    }
    await ui.unmount()
  }
})
