# Зразок логу Trace map: одна реальна сесія

Це справжній лог панелі з сесії, в якій писався бриф `sound-brief.md`. Один рядок на один виклик інструмента, у тому порядку, в якому виклики завершувались.

Формат рядка:

```
#номер статус · категорія · фраза на екрані [підказка] · інструмент і суть виклику (що фраза приховує)
```

- `✓` виклик завершився добре, `✗` з помилкою.
- Категорія відповідає розділу 4 брифу: `search`, `read`, `edit`, `write`, `shell`, `remove`, `build`, `git`, `commit`, `send`, `fetch`, `test`, `note`, `agent`, `web`, `other`.
- Підказка після фрази — назва файлу або патерн, дрібним сірим шрифтом на панелі.
- Номери можуть іти не по порядку (`#14` перед `#13`): кілька інструментів запускаються паралельно і завершуються в різний час.
- Між викликами панель у стані `thinking`, тече текст думок. Паузи між рядками від частки секунди до десятків секунд: `tsc`, `claude plugin test` і `node -e` з перевірками тривають довше, `Edit` і `Read` майже миттєві.

## Хід 1: переписування фраз у саркастичний тон (рядки #1–#27)

```
#1  ✓ edit  · пришиваю ґудзик disguise.ts        · Edit  hooks/disguise.ts
#2  ✓ test  · стукаю по кавуну                   · Bash  tsc -p . --noEmit
#3  ✓ shell · розвішую білизну disguise.ts       · Bash  grep -n "^export const PHRASES" …
#4  ✓ shell · заводжу годинник                   · Bash  node -e "…"  (заміна таблиці фраз)
#5  ✓ read  · гортаю книжку disguise.ts          · Read  hooks/disguise.ts
#6  ✓ edit  · пришиваю ґудзик disguise.ts        · Edit  hooks/disguise.ts
#7  ✓ shell · ставлю чайник на плиту             · Bash  node -e "…"  (скорочення довгих фраз)
#8  ✓ shell · розвішую білизну                   · Bash  node -e "…"  (ще скорочення)
#9  ✓ edit  · штопаю рукав register.tsx          · Edit  hooks/register.tsx
#10 ✓ edit  · латаю шкарпетку register.tsx       · Edit  hooks/register.tsx
#11 ✓ edit  · пришиваю ґудзик register.tsx       · Edit  hooks/register.tsx
#12 ✓ edit  · підклеюю обкладинку register.tsx   · Edit  hooks/register.tsx
#14 ✓ read  · розбираю почерк disguise.ts        · Read  hooks/disguise.ts
#13 ✓ shell · розвішую білизну register.tsx      · Bash  grep -n "lineOf(" …
#15 ✓ edit  · латаю шкарпетку register.tsx       · Edit  hooks/register.tsx
#16 ✓ edit  · пришиваю ґудзик register.tsx       · Edit  hooks/register.tsx
#17 ✓ edit  · підклеюю обкладинку register.tsx   · Edit  hooks/register.tsx
#18 ✓ edit  · підтягую ніжку стільця register.tsx· Edit  hooks/register.tsx
#19 ✓ test  · перевіряю воду в купелі            · Bash  tsc -p . --noEmit
#20 ✓ test  · пробую суп на сіль                 · Bash  claude plugin test ./trace-map
#21 ✓ edit  · пришиваю ґудзик register.tsx       · Edit  hooks/register.tsx
#22 ✓ edit  · підклеюю обкладинку register.test.ts · Edit hooks/register.test.ts
#23 ✓ test  · перевіряю воду в купелі            · Bash  tsc -p . --noEmit
#24 ✓ note  · записую в блокнот zz-preview.test.ts · Bash cat > hooks/zz-preview.test.ts <<'EOF' …
#25 ✓ shell · поливаю квіти                      · Bash  node -e "…"  (перелік фраз без коми)
#26 ✓ test  · стукаю по кавуну                   · Bash  node -e "…" && claude plugin validate && test && tsc
#27 ✓ test  · перевіряю воду в купелі            · Bash  node -e "…" && claude plugin test
```

## Хід 2: створення брифу для звукового дизайну (рядки #28–#29)

```
#28 ✓ shell · розвішую білизну                   · Bash  node -e "…"  (витяг таблиці фраз із коду)
#29 ✓ write · застеляю ліжко sound-brief.md      · Write docs/sound-brief.md
```

## Хід 3: пошук цього логу (рядок #30)

```
#30 ✓ shell · поливаю квіти disguise.ts          · Bash  grep -rl "trace-map:disguise" …
```

## Примітка про фрази в цьому логу

Рядки записані тим набором фраз, який був завантажений на момент виклику. Це ще попередній, несаркастичний набір без ремарок після коми: «пришиваю ґудзик» замість «пришиваю ґудзик, відірваний втретє». Після `/reload-plugins` у записі будуть повні фрази з розділу 4 брифу. Решта поведінки, тобто категорії, знаки, підказки, ритм, та сама.
