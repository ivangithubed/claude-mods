import type { EngineInterface, Register } from 'claude-code'

import type { LastTool, Phase, Touch } from '../types'
import { kindOf, phraseOf } from './disguise'

const PANE = 'trace-map'

// The `disguise` option of plugin.json: the last tool shown as a homely chore
// ("нарізаю сир") instead of the raw command. Off, the honest line is drawn.
// The pane's button and `/trace-map honest|disguise` flip it: through the
// /config row when the host lets a plugin set its own row, else in $.store.
let disguise = true
const DISGUISE_KEY = 'trace-map:disguise'

// $.store is shared by every session on the machine, so each session saves
// under its own key: a new session starts clean, a hot reload within one
// restores its list, and session.end removes the key.
let storeKey = 'trace:unknown'

const TRAIL_LENGTH = 12
const MAX_TOUCHES = 300
const DRAWN_FILES = 120
const DRAWN_HOPS = 8
const ACTIVITY_LENGTH = 48
const THOUGHT_MAX = 600
// While thinking streams, the pane redraws at most this often: each redraw swaps the image
const REDRAW_EVERY_MS = 600

// The desktop's approximate pixel size of one cell, to size the SVG to the pane
const PX_PER_COLUMN = 8
const PX_PER_ROW = 17
const LANDSCAPE_FROM = 720

// What the pane draws. Module variables are lost on a hot reload, so the
// session's part (touches, trail, calls, activity, scans) is also kept in
// $.store and loaded back in session.start.
let phase: Phase = 'idle'
let lastTool: LastTool | null = null
let touches: Touch[] = []
let trail: string[] = []
let calls = 0
let activity: Activity[] = []
let scans: Scan[] = []
let thought = ''
let cwd = ''
let isDark = true
let lastRedrawAt = 0

type Activity = { tool: string; isError: boolean }
type Scan = { dir: string; pattern: string; count: number }

// Nothing of the conversation is kept beyond what the pane draws: no log, no
// prompt text, and the thought only in memory
type Saved = {
  touches: Touch[]
  trail: string[]
  calls: number
  activity: Activity[]
  scans: Scan[]
  lastTool?: LastTool | null
  phase?: Phase
}

function isSaved(value: unknown): value is Saved {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    Array.isArray(v.touches) &&
    Array.isArray(v.trail) &&
    typeof v.calls === 'number' &&
    Array.isArray(v.activity) &&
    Array.isArray(v.scans)
  )
}

/** Redraws the pane and saves the session's part of the state. */
async function changed($: EngineInterface): Promise<void> {
  $.ui.invalidate('ui.render')
  lastRedrawAt = Date.now()
  await $.store.set(storeKey, { touches, trail, calls, activity, scans, lastTool, phase })
}

/**
 * Flips the disguise and keeps the choice: through the plugin's own /config
 * row, so the menu and the pane agree and the module reloads with the new
 * option; where the host refuses that, in $.store, read back on load.
 */
async function setDisguise($: EngineInterface, on: boolean): Promise<void> {
  disguise = on
  await $.store.set(storeKey, { touches, trail, calls, activity, scans, lastTool, phase })
  try {
    const set = await $.config.set({ key: 'trace-map.disguise', value: on })
    if (set.deny === undefined) {
      await $.store.delete(DISGUISE_KEY)
      $.ui.invalidate('ui.render')
      return
    }
  } catch {
    // The host has no such row: the store keeps the choice
  }
  await $.store.set(DISGUISE_KEY, on)
  $.ui.invalidate('ui.render')
}

/** Reads the theme row of /config: light themes start with `light`. */
async function readTheme($: EngineInterface): Promise<void> {
  const row = (await $.config.list()).find(one => one.key === 'theme')
  isDark = !String(row?.value ?? 'dark').startsWith('light')
}

// The tools whose path names one file. Grep's and Glob's `path` is a search
// root, not a file, so it counts as a scan of a directory instead.
const FILE_TOOLS = new Set(['Read', 'Edit', 'Write', 'NotebookEdit'])
const SEARCH_TOOLS = new Set(['Grep', 'Glob'])

/** The file a tool call goes to, when the tool reads or writes one; else undefined. */
function fileOf(tool: string, e: Record<string, unknown>): string | undefined {
  if (!FILE_TOOLS.has(tool)) return undefined
  const path = e.file_path ?? e.notebook_path
  return typeof path === 'string' && path.length > 0 ? path : undefined
}

/** A path whose last segment has a short extension, as `notes.md` does and `.claude` does not. */
function looksLikeFile(path: string): boolean {
  const base = baseOf(path)
  return !base.startsWith('.') && /\.[A-Za-z0-9]{1,6}$/.test(base)
}

// The extensions a token in a shell command may end in to count as a file:
// `.length` and `.keys(e)` in an inline script are not files
const FILE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts', 'json', 'jsonc', 'md', 'mdx', 'txt', 'css', 'scss', 'less',
  'html', 'htm', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'yml', 'yaml', 'toml', 'xml', 'csv', 'tsv',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'c', 'h', 'cpp', 'hpp', 'cs', 'php', 'sh', 'bash', 'ps1', 'bat', 'cmd',
  'sql', 'env', 'lock', 'log', 'cfg', 'ini', 'conf', 'vue', 'svelte', 'astro', 'prisma', 'graphql', 'proto', 'pdf',
])

/** A token of a shell command that names a file: a known extension, and no code around it. */
function looksLikeFileToken(token: string): boolean {
  if (/[()'"`]/.test(token)) return false
  const base = baseOf(token)
  if (base.startsWith('.')) return false
  const dot = base.lastIndexOf('.')
  return dot > 0 && FILE_EXTENSIONS.has(base.slice(dot + 1).toLowerCase())
}

const SHELL_TOOLS = new Set(['Bash', 'PowerShell'])
const MAX_COMMAND_PATHS = 8

/**
 * The files a shell command names: its tokens that look like a file, quotes
 * and punctuation stripped, globs and variables left out, relative ones
 * resolved against the session's directory.
 */
function pathsInCommand(command: string): string[] {
  const found: string[] = []
  for (const raw of command.split(/\s+/)) {
    const token = raw.replace(/^[('"`]+/, '').replace(/[)'"`;,|&]+$/, '')
    if (token.length < 3 || token.startsWith('-') || token.includes('://')) continue
    if (/[*?{}$<>[\]=]/.test(token)) continue
    if (!looksLikeFileToken(token)) continue
    const isAbsolute = token.startsWith('/') || /^[A-Za-z]:/.test(token)
    found.push(isAbsolute ? token : slashes(cwd).replace(/\/+$/, '') + '/' + slashes(token).replace(/^\.\//, ''))
  }
  return [...new Set(found)].slice(0, MAX_COMMAND_PATHS)
}

function str(e: Record<string, unknown>, key: string): string {
  return typeof e[key] === 'string' ? (e[key] as string) : ''
}

/** One short line that says what a tool call is about. */
function gistOf(tool: string, e: Record<string, unknown>): string {
  switch (tool) {
    case 'Read':
    case 'Edit':
    case 'Write':
    case 'NotebookEdit':
      return fileOf(tool, e) ?? ''
    case 'Grep':
      return `/${str(e, 'pattern')}/` + (str(e, 'path') ? ` in ${str(e, 'path')}` : '')
    case 'Glob':
      return str(e, 'pattern')
    case 'Bash':
    case 'PowerShell':
      return str(e, 'command').split('\n')[0] ?? ''
    case 'Agent':
      return str(e, 'description')
    default:
      return ''
  }
}

/**
 * One or two words of context for the disguise: a file's name or a pattern,
 * never the command itself. A shell command gets the first file it names, if
 * any; an agent, a web call and the rest get nothing, so only the chore shows.
 */
function hintOf(tool: string, e: Record<string, unknown>): string {
  switch (tool) {
    case 'Read':
    case 'Edit':
    case 'Write':
    case 'NotebookEdit':
      return baseOf(fileOf(tool, e) ?? '')
    case 'Grep':
      return `/${str(e, 'pattern')}/`
    case 'Glob':
      return str(e, 'pattern')
    case 'Bash':
    case 'PowerShell': {
      const [first] = pathsInCommand(str(e, 'command'))
      return first === undefined ? '' : baseOf(first)
    }
    default:
      return ''
  }
}

type Line = { mark: string; color: string; text: string; hint: string }

/**
 * The line under the phase: disguised, a chore and a hint ("✓ нарізаю сир  login.ts");
 * honest, the tool and its gist ("✓ Edit src/auth/login.ts"). After the answer, the
 * disguise tidies up. `cells` is the width the whole line may take.
 */
function lineOf(cells: number): Line | null {
  // The chore is cut to the cells past the mark when the column is too narrow for it whole
  if (disguise && phase === 'done') {
    return { mark: '&#10003;', color: PHASE_HEX.done, text: head(phraseOf('done', calls), cells - 2), hint: '' }
  }
  if (lastTool === null) return null
  const mark = lastTool.isDone ? (lastTool.isError ? '&#10007;' : '&#10003;') : '&#8230;'
  if (disguise) {
    // The chore and the hint share the line. Too long together, the chore drops
    // its aside (what follows the comma or colon); still too long, the hint goes.
    const full = phraseOf(lastTool.kind, lastTool.callNo)
    const bare = full.split(/[,:] /)[0] ?? full
    const hint = lastTool.hint
    const fits = (text: string) => text.length + 2 + (hint ? hint.length + 2 : 0) <= cells
    const text = fits(full) ? full : fits(bare) ? bare : head(full, cells - 2)
    return { mark, color: hexOf(lastTool.tool), text, hint: fits(text) ? hint : '' }
  }
  const room = cells - lastTool.tool.length - 4
  const what = FILE_TOOLS.has(lastTool.tool) ? tail(relative(lastTool.what), room) : head(lastTool.what, room)
  return { mark, color: hexOf(lastTool.tool), text: lastTool.tool, hint: what }
}

/** The terminal's glyph for a numeric entity of `lineOf`. */
function glyph(mark: string): string {
  return mark === '&#10003;' ? '✓' : mark === '&#10007;' ? '✗' : '…'
}

function slashes(path: string): string {
  return path.split(String.fromCharCode(92)).join('/')
}

/** The path relative to the session's directory when it lies inside it. */
function relative(path: string): string {
  const p = slashes(path)
  const root = slashes(cwd).replace(/\/+$/, '')
  if (root && (p === root || p.startsWith(root + '/'))) return p.slice(root.length + 1) || '.'
  return p
}

function dirOf(rel: string): string {
  const i = rel.lastIndexOf('/')
  return i < 0 ? '.' : rel.slice(0, i)
}

function baseOf(path: string): string {
  const p = slashes(path).replace(/\/+$/, '')
  const i = p.lastIndexOf('/')
  return i < 0 ? p : p.slice(i + 1)
}

/** The path cut to its tail so it fits `width` cells. */
function tail(path: string, width: number): string {
  const normal = slashes(path)
  if (normal.length <= width) return normal
  return '…' + normal.slice(normal.length - width + 1)
}

/** The text cut to its head so it fits `width` cells: for a command or a pattern, whose start matters. */
function head(text: string, width: number): string {
  if (text.length <= width) return text
  return text.slice(0, Math.max(0, width - 1)) + '…'
}

/** Records one touch of `file` by `tool`: the file moves to the top with its count raised. */
function touch(file: string, tool: string): void {
  const found = touches.find(one => one.path === file)
  const rest = touches.filter(one => one.path !== file)
  const tools = [...(found?.tools ?? []).filter(t => t !== tool), tool]
  touches = [{ path: file, tools, count: (found?.count ?? 0) + 1, lastAt: Date.now() }, ...rest].slice(0, MAX_TOUCHES)
  if (trail[trail.length - 1] !== file) trail = [...trail, file].slice(-TRAIL_LENGTH)
}

/** Records a search over `dir`: a dashed node on the map, its label the pattern. */
function scan(dir: string, pattern: string): void {
  const rel = relative(dir)
  const found = scans.find(one => one.dir === rel)
  scans = [{ dir: rel, pattern, count: (found?.count ?? 0) + 1 }, ...scans.filter(one => one.dir !== rel)].slice(0, 40)
}

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'idle',
  thinking: 'thinking',
  'tool-use': 'using a tool',
  done: 'answered',
}

const PHASE_COLOR: Record<Phase, string | undefined> = {
  idle: undefined,
  thinking: 'yellow',
  'tool-use': 'cyan',
  done: 'green',
}

// Colors of the map: one per kind of tool, the same on a light and a dark page
const PHASE_HEX: Record<Phase, string> = { idle: '#8b919c', thinking: '#e2b53a', 'tool-use': '#38bdf8', done: '#34c27a' }
const TOOL_HEX: Record<string, string> = {
  Read: '#4f8cff',
  Grep: '#e2a52b',
  Glob: '#e2a52b',
  Edit: '#34c27a',
  Write: '#34c27a',
  NotebookEdit: '#34c27a',
  Bash: '#b67bf0',
  PowerShell: '#b67bf0',
  Agent: '#f0718f',
}

function hexOf(tool: string): string {
  return TOOL_HEX[tool] ?? '#8b919c'
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Breaks text into at most `lines` lines of about `width` characters, keeping the end. */
function wrap(text: string, width: number, lines: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const out: string[] = []
  let line = ''
  for (const word of words) {
    if ((line + ' ' + word).trim().length > width && line) {
      out.push(line)
      line = word
    } else line = (line + ' ' + word).trim()
  }
  if (line) out.push(line)
  return out.length > lines ? ['…' + (out[out.length - lines] ?? '').slice(1), ...out.slice(-lines + 1)] : out
}

type Point = { x: number; y: number }

/**
 * The map as one SVG document, `W` by `H` pixels: a narrow pane stacks the
 * header, the thought, the map and the activity; a wide one puts the map on
 * the left and the rest in a column on the right.
 */
function svg(W: number, H: number): string {
  const isWide = W >= LANDSCAPE_FROM
  const bg = isDark ? '#1b1b1f' : '#ffffff'
  const INK = isDark ? '#9aa0a8' : '#5b6069'
  const INK_DIM = isDark ? '#9aa0a880' : '#5b606980'
  const parts: string[] = []
  // Square corners: a rounded rect would let the image slot's own background show through
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${bg}"/>`)

  // Where the pieces go: wide, the map takes the left and a column of at most
  // 420px the right; narrow, everything stacks. `k` scales the marks with the map.
  const colW = isWide ? Math.min(420, Math.round(W * 0.35)) : W - 24
  const mapW = isWide ? W - colW - 24 : W
  // Type: the column's sizes, and the map's, which also grow with the map
  const T = { phase: 28, body: 20, thought: 19, line: 27, small: 16 }
  const headerH = 120
  // The ring leaves room past it for the outer lane and the legend (92px wide),
  // and narrow, 96px on each side for the labels
  const R_FILE = Math.max(60, isWide ? Math.min(mapW, H) / 2 - 92 : Math.min(W / 2 - 96, (H - headerH - 3 * T.line - 170) / 2))
  // Narrow and tall, the thought takes the room the map leaves above it
  const narrowLines = Math.max(3, Math.min(12, Math.floor((H - headerH - 2 * R_FILE - 240) / T.line)))
  const C: Point = isWide ? { x: mapW / 2, y: H / 2 + 6 } : { x: W / 2, y: headerH + narrowLines * T.line + R_FILE + 40 }
  const R_DIR = R_FILE * 0.56
  const k = Math.max(1.4, Math.min(2.6, R_FILE / 110))
  const labelChars = isWide ? 16 : 11
  // Labels stay compact however large the marks grow
  const labelFont = Math.min(9 * k, 12).toFixed(1)
  const col = isWide ? { x: mapW + 12, w: colW } : { x: 12, w: W - 24 }
  const charW = T.body * 0.54

  // Header: the phase ring and the counts
  const ring = PHASE_HEX[phase]
  const spinning = phase === 'thinking' || phase === 'tool-use'
  const hx = col.x + 16
  const hy = 36
  // The drawing is an image, redrawn on each change, so the ring turns a step per redraw instead of animating
  parts.push(`<circle cx="${hx}" cy="${hy}" r="15" fill="none" stroke="${ring}" stroke-width="3" opacity="0.35"/>`)
  if (spinning) {
    const turn = (calls * 47) % 360
    parts.push(
      `<circle cx="${hx}" cy="${hy}" r="15" fill="none" stroke="${ring}" stroke-width="4" stroke-dasharray="26 68" stroke-linecap="round" transform="rotate(${turn} ${hx} ${hy})"/>`,
    )
  } else parts.push(`<circle cx="${hx}" cy="${hy}" r="7" fill="${ring}"/>`)
  parts.push(`<text x="${hx + 28}" y="${hy + 10}" font-size="${T.phase}" font-weight="600" fill="${ring}">${esc(PHASE_LABEL[phase])}</text>`)
  // The count sits by the activity strip, one tick per call, so the header row
  // holds only the ring and the phase and nothing collides when the column is narrow
  const line = lineOf(Math.floor(col.w / charW))
  if (line !== null) {
    // The mark is a numeric entity, so the glyph survives whatever encoding the surface gives the markup.
    // Disguised, the hint is small and dim; honest, it is the gist in the body size.
    const hintSize = disguise ? T.small : T.body
    const hintInk = disguise ? INK_DIM : INK
    // The hint takes what the chore leaves; under eight characters it is left out rather than mangled
    const hintRoom = Math.floor((col.w - charW * (line.text.length + 2) - 12) / (hintSize * 0.54))
    parts.push(`<text x="${col.x}" y="${hy + 44}" font-size="${T.body}" fill="${line.color}">${line.mark} ${esc(line.text)}</text>`)
    if (line.hint !== '' && hintRoom >= 8) {
      parts.push(
        `<text x="${(col.x + charW * (line.text.length + 2) + 12).toFixed(1)}" y="${hy + 44}" font-size="${hintSize}" fill="${hintInk}">${esc(head(line.hint, hintRoom))}</text>`,
      )
    }
  }

  // The thought: the last of what the model is thinking, while it thinks
  const thoughtLines = isWide ? Math.max(3, Math.floor((H - headerH - 130) / T.line)) : narrowLines
  const lines = thought ? wrap(thought, Math.floor(col.w / (T.thought * 0.52)), thoughtLines) : []
  lines.forEach((line, i) => {
    parts.push(`<text x="${col.x}" y="${headerH + i * T.line}" font-size="${T.thought}" font-style="italic" fill="${INK_DIM}">${esc(line)}</text>`)
  })

  // The map: root at the center, directories on a ring, files on a ring outside
  const files = touches.slice(0, DRAWN_FILES)
  const byDir = new Map<string, Touch[]>()
  for (const one of files) {
    const dir = dirOf(relative(one.path))
    byDir.set(dir, [...(byDir.get(dir) ?? []), one])
  }
  for (const one of scans) if (!byDir.has(one.dir)) byDir.set(one.dir, [])
  const dirs = [...byDir.keys()]
  const weightOf = (dir: string) => (byDir.get(dir)?.length ?? 0) + 1
  const total = dirs.reduce((sum, dir) => sum + weightOf(dir), 0)
  const at = (angle: number, radius: number): Point => ({ x: C.x + Math.cos(angle) * radius, y: C.y + Math.sin(angle) * radius })
  const place = new Map<string, Point>()
  const dirAt = new Map<string, Point>()
  const dirSpan = new Map<string, number>()
  // A crowded ring: marks shrink, and a big directory's files take three lanes
  const crowd = (2 * Math.PI * R_FILE) / Math.max(1, files.length)
  const kn = k * Math.max(0.5, Math.min(1, crowd / 22))
  let start = -Math.PI / 2
  for (const dir of dirs) {
    const span = (2 * Math.PI * weightOf(dir)) / total
    const list = byDir.get(dir) ?? []
    dirAt.set(dir, at(start + span / 2, R_DIR))
    dirSpan.set(dir, span)
    list.forEach((one, j) => {
      const angle = start + (span * (j + 0.5)) / list.length
      const lane = list.length > 6 ? (j % 3) - 1 : 0
      place.set(one.path, at(angle, R_FILE + lane * 13 * k))
    })
    start += span
  }
  const f1 = (n: number) => n.toFixed(1)

  // Labels keep clear of each other: a label whose box meets a placed one is left out
  const boxes: { x: number; y: number; w: number; h: number }[] = []
  const labelPx = Number(labelFont)
  const fits = (x: number, y: number, chars: number, anchor: 'start' | 'end' | 'middle'): boolean => {
    const w = chars * labelPx * 0.58
    const h = labelPx * 1.2
    const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2
    const box = { x: left, y: y - h, w, h }
    const clear = boxes.every(b => box.x + box.w < b.x || b.x + b.w < box.x || box.y + box.h < b.y || b.y + b.h < box.y)
    if (clear) boxes.push(box)
    return clear
  }

  // Spokes: root to directory, directory to file
  for (const dir of dirs) {
    const d = dirAt.get(dir)!
    parts.push(`<line x1="${f1(C.x)}" y1="${f1(C.y)}" x2="${f1(d.x)}" y2="${f1(d.y)}" stroke="${INK}" stroke-opacity="0.18"/>`)
    for (const one of byDir.get(dir) ?? []) {
      const p = place.get(one.path)!
      parts.push(`<line x1="${f1(d.x)}" y1="${f1(d.y)}" x2="${f1(p.x)}" y2="${f1(p.y)}" stroke="${INK}" stroke-opacity="0.14"/>`)
    }
  }

  // The trail: arcs between files in the order they were touched, the latest strongest
  const hops = trail.filter(one => place.has(one)).slice(-DRAWN_HOPS - 1)
  for (let i = 1; i < hops.length; i += 1) {
    const a = place.get(hops[i - 1] ?? '')!
    const b = place.get(hops[i] ?? '')!
    // A gentle bow toward the center, so hops across the map clear the nodes between
    const cx = ((a.x + b.x) / 2) * 0.8 + C.x * 0.2
    const cy = ((a.y + b.y) / 2) * 0.8 + C.y * 0.2
    const strength = (i / (hops.length - 1)) * 0.5 + 0.1
    parts.push(
      `<path d="M${f1(a.x)},${f1(a.y)} Q${f1(cx)},${f1(cy)} ${f1(b.x)},${f1(b.y)}" fill="none" stroke="#4f8cff" stroke-width="${f1((0.8 + strength) * k)}" stroke-opacity="${strength.toFixed(2)}" stroke-linecap="round"/>`,
    )
  }

  // Root
  const fs = (base: number) => (base * k).toFixed(1)
  parts.push(`<circle cx="${f1(C.x)}" cy="${f1(C.y)}" r="${f1(5 * k)}" fill="${INK}"/>`)
  parts.push(`<text x="${f1(C.x)}" y="${f1(C.y + 12 * k)}" font-size="14" text-anchor="middle" fill="${INK}">${esc(head(baseOf(cwd) || 'project', 18))}</text>`)

  // Directories: a dashed ring where a search ran, a dot otherwise
  for (const dir of dirs) {
    const d = dirAt.get(dir)!
    const scanned = scans.find(one => one.dir === dir)
    if (scanned) {
      parts.push(
        `<circle cx="${f1(d.x)}" cy="${f1(d.y)}" r="${f1((6 + Math.min(scanned.count, 5)) * k)}" fill="#e2a52b" fill-opacity="0.12" stroke="#e2a52b" stroke-dasharray="3 2" stroke-width="${f1(1.2 * k)}"/>`,
      )
    } else parts.push(`<circle cx="${f1(d.x)}" cy="${f1(d.y)}" r="${f1(3 * k)}" fill="${INK}" fill-opacity="0.7"/>`)
    const label = dir === '.' || dir === '' ? '/' : head(baseOf(dir), 14)
    const above = d.y < C.y
    const ly = above ? d.y - 8 * k : d.y + 11 * k
    // A directory with a sliver of the ring, and nothing searched in it, goes unlabelled;
    // a crowded narrow map labels only the searched ones and those with four files or more
    const few = (byDir.get(dir)?.length ?? 0) < 4
    const slim = !scanned && ((dirSpan.get(dir) ?? 0) * R_DIR < 26 || (files.length > 30 && !isWide && few))
    if (!slim && fits(d.x, ly, label.length, 'middle')) {
      parts.push(`<text x="${f1(d.x)}" y="${f1(ly)}" font-size="${labelFont}" text-anchor="middle" fill="${INK}" fill-opacity="0.8">${esc(label)}</text>`)
    }
  }

  // Files: size by how often, color by the last tool, the latest one pulsing
  const current = lastTool !== null && !lastTool.isDone && FILE_TOOLS.has(lastTool.tool) ? lastTool.what : null
  const latest = trail[trail.length - 1]
  // Label the files returned to first, then the most recent, and not too many.
  // A crowded narrow map labels only the files returned to three times or more.
  const crowded = files.length > (isWide ? 60 : 30)
  const returned = touches.filter(one => one.count > 1)
  const once = touches.filter(one => one.count === 1)
  const picked = crowded && !isWide ? returned.filter(one => one.count >= 3) : [...returned, ...once]
  const labelled = new Set(picked.slice(0, isWide ? 12 : 7).map(one => one.path))
  if (latest !== undefined) labelled.add(latest)
  for (const one of files) {
    const p = place.get(one.path)!
    const color = hexOf(one.tools[one.tools.length - 1] ?? 'Read')
    const r = (3 + Math.min(one.count, 6) * 1.1) * kn
    // The latest file wears two halos, a still stand-in for a pulse
    if (one.path === current || one.path === latest) {
      parts.push(
        `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1(r + 4 * k)}" fill="none" stroke="${color}" stroke-width="${f1(1.5 * k)}" opacity="0.55"/>` +
          `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1(r + 8 * k)}" fill="none" stroke="${color}" stroke-width="${f1(k)}" opacity="0.22"/>`,
      )
    }
    parts.push(`<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1(r)}" fill="${color}" fill-opacity="0.9"/>`)
    if (labelled.has(one.path)) {
      const left = p.x < C.x
      const label = head(baseOf(one.path), labelChars)
      const lx = left ? p.x - r - 4 : p.x + r + 4
      if (fits(lx, p.y + 4, label.length, left ? 'end' : 'start')) {
        parts.push(`<text x="${f1(lx)}" y="${f1(p.y + 4)}" font-size="${labelFont}" text-anchor="${left ? 'end' : 'start'}" fill="${INK}">${esc(label)}</text>`)
      }
    }
  }
  if (files.length === 0 && scans.length === 0) {
    parts.push(`<text x="${f1(C.x)}" y="${f1(C.y - R_DIR)}" font-size="${T.small}" text-anchor="middle" fill="${INK_DIM}">nothing touched yet</text>`)
  }

  // The activity strip: one tick per tool call, the latest at the right
  const y0 = H - 96
  parts.push(`<text x="${col.x}" y="${y0 - 10}" font-size="${T.small}" fill="${INK_DIM}">activity</text>`)
  parts.push(`<text x="${col.x + col.w}" y="${y0 - 10}" font-size="${T.small}" text-anchor="end" fill="${INK}">${calls} tool calls</text>`)
  const step = 12
  const fit = Math.min(ACTIVITY_LENGTH, Math.floor(col.w / step))
  const recent = activity.slice(-fit)
  recent.forEach((one, i) => {
    const x = col.x + col.w - (recent.length - 1 - i) * step
    parts.push(
      `<rect x="${x - 9}" y="${y0}" width="9" height="${one.isError ? 10 : 22}" rx="2" fill="${one.isError ? '#e05a5a' : hexOf(one.tool)}" opacity="${(0.35 + (0.65 * (i + 1)) / recent.length).toFixed(2)}"/>`,
    )
  })

  // Legend, along the bottom from the left
  const legend: [string, string][] = [['read', '#4f8cff'], ['search', '#e2a52b'], ['edit', '#34c27a'], ['shell', '#b67bf0'], ['agent', '#f0718f']]
  const legendStep = Math.min(110, (W - 24) / legend.length)
  const legendFont = legendStep < 100 ? 12 : T.small
  legend.forEach(([name, color], i) => {
    const x = 12 + i * legendStep
    parts.push(`<circle cx="${x + 6}" cy="${H - 26}" r="${legendStep < 100 ? 4.5 : 6}" fill="${color}"/><text x="${x + 16}" y="${H - 21}" font-size="${legendFont}" fill="${INK}">${name}</text>`)
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="ui-sans-serif, system-ui, sans-serif">${parts.join('')}</svg>`
}

export const register: Register = (on, options) => {
  disguise = options.disguise !== false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'trace-map',
      description: 'Open the trace map: what Claude is doing and which files it touched',
    })
    cwd = e.cwd
    await readTheme($)
    storeKey = `trace:${await $.session.id()}`
    const saved = await $.store.get(storeKey)
    if (isSaved(saved)) {
      touches = saved.touches
      trail = saved.trail
      calls = saved.calls
      activity = saved.activity
      scans = saved.scans
      lastTool = saved.lastTool ?? null
      phase = saved.phase ?? 'idle'
    }
    // A choice the pane's button kept in the store, where the host has no /config row to keep it
    const kept = await $.store.get(DISGUISE_KEY)
    if (typeof kept === 'boolean') disguise = kept
    void $.ui.open({ id: PANE, title: 'Trace map' })
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    await $.store.delete(storeKey)
    return next(e)
  })

  on('config.set', { key: 'theme' }, async ($, e, next) => {
    const done = await next(e)
    await readTheme($)
    $.ui.invalidate('ui.render')
    return done
  })

  // `/trace-map` opens the pane; `/trace-map honest` and `/trace-map disguise`
  // flip the line
  on('command.run', { command: 'trace-map' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'honest' || arg === 'disguise') {
      await setDisguise($, arg === 'disguise')
      return { text: arg === 'disguise' ? 'Trace map: the chores are back on.' : 'Trace map: showing the honest tool line.' }
    }
    await $.ui.open({ id: PANE, title: 'Trace map' })
    return { text: 'Trace map opened.' }
  })

  on('turn.start', async ($, e, next) => {
    phase = 'thinking'
    thought = ''
    await changed($)
    return next(e)
  })

  // The main loop's turn only: a subagent's turn.complete would end the phase early
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      phase = 'done'
      await changed($)
    }
    return next(e)
  })

  // The model's thinking as it streams: the pane shows its last lines
  on('turn.step', async function* ($, e, next) {
    const stream = next(e)
    let block = -1
    for await (const chunk of stream) {
      if (chunk.kind === 'thinking' && e.agentId === undefined) {
        if (chunk.index !== block) {
          block = chunk.index
          thought = ''
        }
        thought = (thought + chunk.text).slice(-THOUGHT_MAX)
        if (Date.now() - lastRedrawAt > REDRAW_EVERY_MS) {
          lastRedrawAt = Date.now()
          $.ui.invalidate('ui.render')
        }
      }
      yield chunk
    }
    if (block >= 0) $.ui.invalidate('ui.render')
    return await stream.result
  })

  on('tool.call', async ($, e, next) => {
    const input = e as unknown as Record<string, unknown>
    const file = fileOf(e.tool, input)
    calls += 1
    const started: LastTool = {
      tool: e.tool,
      what: gistOf(e.tool, input),
      kind: kindOf(e.tool, str(input, 'command')),
      hint: hintOf(e.tool, input),
      callNo: calls,
      isDone: false,
      isError: false,
    }

    lastTool = started
    if (e.agentId === undefined) phase = 'tool-use'
    if (file !== undefined) touch(file, e.tool)
    if (SEARCH_TOOLS.has(e.tool)) {
      // A search over one file is a touch of that file; over a directory, a scan of it
      const where = str(input, 'path') || cwd || '.'
      if (looksLikeFile(where)) touch(where, e.tool)
      else scan(where, str(input, 'pattern'))
    }
    // A shell command names the files it reads or writes in its text
    if (SHELL_TOOLS.has(e.tool)) for (const path of pathsInCommand(str(input, 'command'))) touch(path, e.tool)
    await changed($)

    const ran = await next(e)

    const isError = ran.deny !== undefined || ran.isError === true
    if (lastTool === started) lastTool = { ...started, isDone: true, isError }
    activity = [...activity, { tool: e.tool, isError }].slice(-ACTIVITY_LENGTH)
    if (e.agentId === undefined) phase = 'thinking'
    await changed($)
    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)

    const clear = async () => {
      touches = []
      trail = []
      lastTool = null
      calls = 0
      activity = []
      scans = []
      thought = ''
      await changed($)
    }
    // The pane's own switch: ✕ turns the chores off, ✓ turns them back on
    const toggle = () => setDisguise($, !disguise)
    const toggleLabel = disguise ? '✕ фрази' : '✓ фрази'

    if (e.surface === 'desktop') {
      const { Svg } = $.ui.resolve(e)
      // Size the drawing to the pane. The surface scales the image to the pane's
      // width, so what matters is the aspect: the pane's own, from its cells,
      // less a little for the row under the drawing.
      const cols = e.props.bodyColumns
      const rows = e.viewport?.rows
      const W = Math.max(340, Math.min(1600, cols * PX_PER_COLUMN - 16))
      // 72px off the height: the row under the drawing and the pane's padding, so nothing scrolls
      const paneAspect = rows !== undefined && rows > 0 ? (rows * PX_PER_ROW - 72) / (cols * PX_PER_COLUMN) : undefined
      const H = Math.round(Math.max(360, Math.min(1200, paneAspect !== undefined ? W * paneAspect : W >= LANDSCAPE_FROM ? W * 0.5 : 560)))
      return (
        <Box flexDirection="column">
          <Svg
            source={svg(W, H)}
            width={W}
            height={H}
            alt={`Claude is ${PHASE_LABEL[phase]}, ${calls} tool calls, ${touches.length} files touched`}
          />
          <Box flexDirection="row" columnGap={1}>
            <Text dimColor>{`${touches.length} files`}</Text>
            <Button key="clear" label="clear" hotkey="c" plain onPress={clear} />
            <Button key="disguise" label={toggleLabel} hotkey="d" plain onPress={toggle} />
          </Box>
        </Box>
      )
    }

    // The terminal: a text list
    const width = Math.max(20, e.props.bodyColumns - 1)
    const rows = e.viewport?.rows ?? 24
    const room = Math.max(1, rows - 9)
    const shown = touches.slice(0, room)
    const widest = Math.max(...shown.map(one => String(one.count).length), 1)

    const line = lineOf(width + 1)
    const trailLine = trail.length === 0 ? 'nothing touched yet' : trail.map(one => tail(one, 24)).join(' → ')

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={1}>
          <Text bold>Claude is</Text>
          <Text color={PHASE_COLOR[phase]} bold>
            {PHASE_LABEL[phase]}
          </Text>
          <Text dimColor>{`· ${calls} tool calls`}</Text>
        </Box>
        {line === null ? (
          <Text dimColor>no tool yet</Text>
        ) : (
          <Box flexDirection="row" columnGap={1}>
            <Text dimColor={!disguise} wrap="truncate-end">{`${glyph(line.mark)} ${line.text}`}</Text>
            {line.hint !== '' && (
              <Text dimColor wrap="truncate-end">
                {line.hint}
              </Text>
            )}
          </Box>
        )}
        {thought !== '' && <Text dimColor italic wrap="truncate-end">{`“${thought.slice(-width + 2)}”`}</Text>}
        <Text> </Text>
        <Text bold>Trail</Text>
        <Text wrap="truncate-start" dimColor={trail.length === 0}>
          {trailLine}
        </Text>
        <Text> </Text>
        <Box flexDirection="row" columnGap={1}>
          <Text bold>Files</Text>
          <Text dimColor>{`(${touches.length})`}</Text>
          <Button key="clear" label="clear" hotkey="c" plain onPress={clear} />
          <Button key="disguise" label={toggleLabel} hotkey="d" plain onPress={toggle} />
        </Box>
        {shown.map(one => (
          <Box flexDirection="row" columnGap={1}>
            <Text color={one.count > 1 ? 'cyan' : undefined}>{`${String(one.count).padStart(widest)}×`}</Text>
            <Text wrap="truncate-start" dimColor={one.count === 1}>
              {tail(one.path, width - widest - 3)}
            </Text>
          </Box>
        ))}
        {touches.length > shown.length && <Text dimColor>{`… and ${touches.length - shown.length} more`}</Text>}
      </Box>
    )
  })
}
