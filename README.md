# Born Lucky

How your teams have really done since the year you were born. Pick a birth year (or all time, or any span of years) and one team per league; the site scores every NFL, NBA, MLB and NHL season since on one scale, ranks all 124 franchises and 49 cities, and tells you how lucky a fan you have been.

It started as a spreadsheet (`big4_win_pct_since_2005.xlsx`). The engine reproduces that sheet's numbers and a test keeps it that way.

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # engine against the original spreadsheet
pnpm lint && pnpm typecheck
```

## How the score works

- **Win rate** is wins / (wins + losses), regular season only. Ties are left out; NHL overtime losses count as losses.
- **Record** is that win rate measured from .500 in units of how spread out the league is, so baseball's tight records and football's wide ones are comparable.
- **Typical season** averages each season's standing against that year's league.
- **Championships** counts titles above what an average club would have won (1 in n each year), so a Cup in a six-team league is worth less than one in a 32-team league.
- The three are blended (50 / 30 / 20 by default, adjustable in the Scoring panel), short histories are pulled toward average, and the result is put on a 0 to 100 line where the best franchise in the span is 100 and the worst is 0.

All of it lives in `src/lib/engine.ts`.

## Data

`src/data/data.json` holds every season: MLB from 1903, NHL from 1917, NFL from 1922, NBA from 1946.

- NFL, NBA and MLB standings come from ESPN's public standings feed; NHL from the league's stats API (ESPN's hockey history has seasons with playoff games mixed in).
- Champions and losing finalists are in `scripts/source/champions.json`, compiled from Wikipedia. Seasons newer than that file are read off the postseason scoreboard automatically.
- A few old NFL seasons are missing clubs in the feed; `scripts/source/patches.json` fills them.
- Relocated franchises keep their history through team ids.

`pnpm data` refreshes it. Finished seasons are kept as they are and only the recent ones are refetched; every request retries; a season that fails or does not add up (wins must equal losses) keeps its last good copy; and the file is only rewritten when something actually changed. `pnpm data:full` refetches everything.

A GitHub Action (`.github/workflows/refresh-data.yml`) runs this every morning, runs the tests, and commits the file only when both pass, which redeploys the site.

`pnpm map` redraws the base map (`src/data/map.json`) from Natural Earth shapes.

## Stack

Next.js (App Router), Tailwind CSS, Motion for layout animation, NumberFlow for figures. No database and no API keys: the page is static and all scoring runs in the browser, so every control responds instantly and any view can be shared as a link.

Not affiliated with any league or team. Logos are loaded from ESPN and belong to their owners.
