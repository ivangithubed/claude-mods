# learningtogether-mods

Маркетплейс Claude Code з модами від [learningtogetherua](https://github.com/ivangithubed). Мод — це плагін, який працює всередині Claude Code і може малювати власні панелі, перехоплювати виклики інструментів і додавати команди. Докладніше: [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview).

*A Claude Code plugin marketplace with mods by learningtogetherua. Each plugin has its own README under `plugins/`.*

## Плагіни

| Плагін | Що робить |
| :- | :- |
| [`trace-map`](plugins/trace-map/) | Панель із живою SVG-картою того, що Claude робить: фаза ходу, останній інструмент, стрічка думок, радіальна карта зачеплених файлів, смуга активності |

## Установка

Потрібен Claude Code 2.1.287 або новіший у терміналі, або застосунок Claude Desktop від 2.1.286.

У сесії Claude Code:

```text
/plugin marketplace add ivangithubed/claude-mods
/plugin install trace-map@learningtogether-mods
```

Або з оболонки, без запуску сесії:

```bash
claude plugin marketplace add ivangithubed/claude-mods
claude plugin install trace-map@learningtogether-mods
```

Після установки з оболонки у вже відкритій сесії виконайте `/reload-plugins`. Перевірка: `/plugin` показує рядок `1 mod active · trace-map`, а в Claude Desktop плагін видно в **Customize → Plugins**.

## Оновлення

Автооновлення для сторонніх маркетплейсів вимкнене за умовчанням. Щоб отримати нову версію:

```bash
claude plugin update trace-map@learningtogether-mods
```

або в сесії: `/plugin` → **Marketplaces** → `learningtogether-mods` → **Update marketplace**. Там само можна увімкнути **Enable auto-update**.

Нова версія приходить лише тоді, коли змінюється поле `version` у `plugins/<name>/.claude-plugin/plugin.json`. Історія змін кожного плагіна — у його README, у комітах і тегах цього репозиторію.

## Перш ніж довіряти моду

Мод виконується з вашими правами всередині Claude Code. Перш ніж встановлювати, подивіться, які події він обробляє і що просить у Claude Code, не запускаючи його:

```bash
git clone https://github.com/ivangithubed/claude-mods
claude plugin validate ./claude-mods/plugins/trace-map
```

Рядки `hooks:` і `calls:` у виводі — повний перелік того, що мод робить. У README кожного плагіна є цей вивід і чесний розділ про те, що мод читає і чого не робить.

## Структура

```text
.claude-plugin/marketplace.json   каталог маркетплейсу
plugins/trace-map/                плагін trace-map (manifest, hooks, тести, docs)
LICENSE                           MIT
```

## Перевірка перед комітом

```bash
claude plugin validate .
claude plugin validate ./plugins/trace-map
claude plugin test ./plugins/trace-map
```

## Ліцензія

[MIT](LICENSE) © 2026 learningtogetherua
