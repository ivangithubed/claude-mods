// The disguise: a homely Ukrainian phrase in place of the raw tool line, in the
// spirit of the spinner's words, tied to what the call really does.

import type { Kind } from '../types'

/**
 * Three to five phrases per kind; the call's number picks one, so a redraw
 * keeps it. One household: the kitchen, the wardrobe, the mail, the neighbours,
 * told with a mild, self-mocking shrug. "гортаю" is always reading,
 * "перебираю" always searching, "латаю" always mending. Kept under
 * 36 characters, so a narrow pane shows the whole line.
 */
export const PHRASES: Record<Kind, readonly string[]> = {
  search: [
    'шукаю ключі, що були в руці',
    'розгрібаю безлад, що сам і зробив',
    'перебираю шухляду, там «потрібне»',
    'зазираю під диван, бо де ж іще',
    'перетрушую кладовку, ніби там нове',
  ],
  read: [
    'гортаю книжку, щоб потім перечитати',
    'читаю етикетку, ніби щось зрозумію',
    'вивчаю інструкцію, вперше за роки',
    'розбираю почерк, вочевидь свій',
    'переглядаю рецепт, який і так знаю',
  ],
  // Edit mends what is there; Write makes something new
  edit: [
    'латаю шкарпетку, замість купити нову',
    'пришиваю ґудзик, відірваний втретє',
    'підклеюю обкладинку, бо то не нова',
    'підтягую ніжку стільця, знову',
    'штопаю рукав, бо так, кажуть, модно',
  ],
  write: [
    'ліплю вареники, бо хтось же має',
    'нарізаю сир рівно, як ніколи',
    'пишу листівку, яку ніхто не прочитає',
    'заварюю чай, бо інакше не працюється',
    'застеляю ліжко, щоб було куди впасти',
  ],
  // A shell: deletes take out the trash, builds and installs wait for the kettle, the rest are odd chores
  remove: [
    'виношу сміття, цього разу насправді',
    'вигрібаю попіл, сам не вигребеться',
    'витрушую килим, поки ніхто не бачить',
    'зливаю воду з ванни, хоч і шкода',
  ],
  build: [
    'нагріваю воду для кави, це надовго',
    'вмикаю чайник і стежу, щоб не втік',
    'збираю шафу за інструкцією, майже',
    'замішую тісто, бо раптом вийде',
    'чекаю, поки закипить, фахово',
  ],
  shell: [
    'поливаю квіти, які ще живі',
    'підкручую гайки, бо щось же треба',
    'ставлю чайник, вдруге за годину',
    'розвішую білизну за кольором, звісно',
    'заводжу годинник, що й так спішить',
  ],
  // Git: looking back, fixing a moment, sending it off, bringing it in
  git: [
    'переглядаю старі фото: хто це накоїв',
    'гортаю альбом, самі дивні рішення',
    'перебираю листи, самі рахунки',
    'звіряю, що змінилось у шафі, і чому',
  ],
  commit: [
    'вклеюю фото в альбом, хай буде доказ',
    'підписую дату на звороті: хто винен',
    'ставлю печатку в щоденнику, офіційно',
    'перев’язую пачку листів, нарешті',
  ],
  send: [
    'несу листа на пошту, не повернеш',
    'кидаю листівку в скриньку, і все',
    'віддаю пакунок кур’єру, хай сам',
    'виставляю молоко за двері, заберуть',
  ],
  fetch: [
    'забираю пошту, хоч би не рахунки',
    'приймаю посилку, яку сам і замовив',
    'зустрічаю гостей з валізами, надовго',
    'заношу газету з ґанку, вчорашню',
  ],
  test: [
    'пробую суп на сіль, уже втретє',
    'нюхаю молоко, дата на пачці бреше',
    'стукаю по кавуну, ніби щось чую',
    'міряю воду ліктем, як бабуся вчила',
  ],
  note: [
    'записую в блокнот, який загублю',
    'клею стікер на холодильник, до решти',
    'дописую в список те, що не куплю',
    'роблю нотатку на полях, нерозбірливо',
  ],
  agent: [
    'кличу сусіда, бо самому ліньки',
    'шлю брата за хлібом, верне з чіпсами',
    'гукаю когось із кухні, там нікого',
    'дзвоню майстру, який прийде «завтра»',
  ],
  web: [
    'розпитую сусідів, вони все знають',
    'дивлюсь у вікно, ніби щось зміниться',
    'гортаю газету, вчорашню, звісно',
    'слухаю радіо, бо інтернету замало',
  ],
  other: [
    'порядкую на столі: пересуваю купки',
    'розкладаю речі по місцях, нових',
    'протираю окуляри, ніби стане ясніше',
    'переставляю горщики, туди й назад',
  ],
  done: [
    'прибираюсь після роботи, ненадовго',
    'витираю стіл, доки ніхто не бачить',
    'мию посуд, ніби це востаннє',
    'вимикаю світло на кухні, нарешті',
  ],
}

// A command's words: `git`, `npm`, `rm`... at its start or after `;`, `|`, `&&`, `(`
const W = '(^|[\\s;|&(])'

/** Appends to a file: `>>`, a heredoc, `tee -a`, PowerShell's `Add-Content` or `Out-File -Append`. */
const APPENDS = new RegExp(W + `(>>|<<-?\\s*['"]?\\w|tee\\s+-a\\b|add-content\\b|out-file\\b.*-append)`, 'i')
/** Tests and checks: a test runner, a type check, a lint, a plugin's validate. `npx` alone is not one. */
const TESTS = new RegExp(
  W +
    '((npm|pnpm|yarn|bun)\\s+(run\\s+)?(test|lint|typecheck|check)\\b|pytest\\b|vitest\\b|jest\\b|mocha\\b|cargo\\s+(test|check|clippy)\\b|go\\s+(test|vet)\\b|dotnet\\s+test\\b|tsc\\b|eslint\\b|biome\\s+(check|lint)\\b|ruff\\b|mypy\\b|claude\\s+plugin\\s+(test|validate)\\b)',
  'i',
)
/** Builds and installs: what takes a while and makes something. */
const BUILDS = new RegExp(
  W +
    '((npm|pnpm|yarn|bun)\\s+(i|install|ci|add|run\\s+build|build)\\b|pip\\s+install\\b|cargo\\s+(build|install)\\b|go\\s+(build|get|mod)\\b|dotnet\\s+(build|restore)\\b|make\\b|cmake\\b|gradle\\w*\\b|mvn\\b|docker\\s+(build|compose)\\b|vite\\s+build\\b|webpack\\b|esbuild\\b)',
  'i',
)
/** Deletes: `rm`, `rmdir`, `del`, `Remove-Item`, `git clean`. */
const REMOVES = new RegExp(W + '(rm\\b|rmdir\\b|del\\b|erase\\b|remove-item\\b|ri\\b|git\\s+clean\\b)', 'i')
/** Git's three moods: a commit fixes a moment, a push sends it, a pull brings mail in. The rest looks back. */
const GIT = new RegExp(W + 'git\\s')
const GIT_COMMIT = new RegExp(W + 'git\\s+(commit\\b|tag\\b|stash\\b(?!\\s+(pop|apply|list|show|drop))|add\\b|merge\\b|rebase\\b|cherry-pick\\b)', 'i')
const GIT_SEND = new RegExp(W + '(git\\s+push\\b|gh\\s+(pr|release)\\s+create\\b|gh\\s+pr\\s+merge\\b)', 'i')
const GIT_FETCH = new RegExp(W + '(git\\s+(pull|fetch|clone)\\b|gh\\s+(repo\\s+clone|pr\\s+checkout)\\b)', 'i')

/** What kind of chore a tool call is, from its tool and, for a shell, its command. */
export function kindOf(tool: string, command: string): Kind {
  if (tool === 'Read') return 'read'
  if (tool === 'Write') return 'write'
  if (tool === 'Edit' || tool === 'NotebookEdit') return 'edit'
  if (tool === 'Grep' || tool === 'Glob') return 'search'
  if (tool === 'Agent') return 'agent'
  if (tool === 'WebSearch' || tool === 'WebFetch') return 'web'
  if (tool === 'Bash' || tool === 'PowerShell') {
    const text = command.toLowerCase()
    if (APPENDS.test(text)) return 'note'
    if (GIT_SEND.test(text)) return 'send'
    if (GIT_FETCH.test(text)) return 'fetch'
    if (GIT_COMMIT.test(text)) return 'commit'
    if (TESTS.test(text)) return 'test'
    if (BUILDS.test(text)) return 'build'
    if (REMOVES.test(text)) return 'remove'
    if (GIT.test(text)) return 'git'
    return 'shell'
  }
  return 'other'
}

/** The phrase for a kind, the same for the same call number. */
export function phraseOf(kind: Kind, callNo: number): string {
  const list = PHRASES[kind]
  return list[Math.abs(callNo) % list.length] ?? ''
}

/** A regular expression matching any phrase of the kind: for tests and searches. */
export function anyPhrase(kind: Kind): RegExp {
  return new RegExp(PHRASES[kind].join('|'))
}
