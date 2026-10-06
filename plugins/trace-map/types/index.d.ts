export type Phase = 'idle' | 'thinking' | 'tool-use' | 'done'

/** What kind of chore a tool call is, for the disguise's phrase */
export type Kind =
  | 'search'
  | 'read'
  | 'edit'
  | 'write'
  | 'shell'
  | 'remove'
  | 'build'
  | 'git'
  | 'commit'
  | 'send'
  | 'fetch'
  | 'test'
  | 'note'
  | 'agent'
  | 'web'
  | 'other'
  | 'done'

export type Touch = {
  /** The path as the tool got it, shortened for the drawing by the hook */
  path: string
  /** Which tools touched it, latest last */
  tools: string[]
  /** How many times a tool went to it */
  count: number
  /** Milliseconds since the epoch when it was last touched */
  lastAt: number
}

export type LastTool = {
  tool: string
  /** The one-line gist: a path, a pattern, a command's head */
  what: string
  /** The kind of chore, for the disguise */
  kind: Kind
  /** One or two words of context next to the disguise: a file's name, a pattern, a command's head */
  hint: string
  /** The call's number in the session: picks the disguise's phrase, so a redraw keeps it */
  callNo: number
  isDone: boolean
  isError: boolean
}
