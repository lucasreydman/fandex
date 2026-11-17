# Fandex

Every NFL, NBA, MLB and NHL season since 1903 on one scale, and how your own teams have done since the year you were born. Pick a birth year (or all time, or any span of years) and one team per league; the site scores every NFL, NBA, MLB and NHL season since on one scale, ranks all 124 franchises and 49 cities, and tells you how lucky a fan you have been.

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
- `scripts/source/patches.json` holds reference standings for the older NFL and NBA seasons, compiled from Wikipedia. ESPN's history silently omits clubs (most Baltimore Colts seasons, several Bengals seasons, the 1974 Steelers) and has a few wrong records, so where the reference covers a season it is the record and the feed is only compared against it.

## More leagues

MLS (1996), the WNBA (1997), NWSL (2013), the PWHL (2023-24) and the CFL (1958) sit alongside the big four. Each has a reference file in `scripts/source/leagues/` holding its teams, standings, champions and franchise lineage, compiled from Wikipedia; `scripts/extra-leagues.mjs` turns those into seasons. A live feed (ESPN for MLS, WNBA and NWSL; the league's own feed for the PWHL) only adds seasons newer than the reference file, and those count as in progress until the file records how they ended. The CFL has no public feed, so it updates only when its file does.

- In soccer a draw counts as half a win.
- Each league is scored against its own spread, so the nine share one scale.
- Any league can be switched off in the Scoring panel.
- CFL teams show a monogram in the club colour: no public feed carries their logos.

## Franchise history

Lineage follows each league's official record, and `src/lib/history.test.ts` pins it down for all teams: first season, every season since, and the known gaps.

- A relocated or renamed franchise keeps its seasons. `scripts/source/eras.json` records what it was called and where it played each year, so the Thunder's 1979 title shows as the Seattle SuperSonics and the Dodgers' 1955 as Brooklyn.
- Cities are scored on the seasons actually played there. Seattle keeps the Sonics' years, Montreal the Expos', and former homes such as Hartford and Quebec City appear on the map when the span reaches back to them.
- The 1988 to 2002 Charlotte Hornets belong to today's Hornets (the NBA reassigned them); the Pelicans begin in 2002.
- The Browns keep their pre-1996 history and sit out 1996 to 1998; the Ravens begin in 1996.
- The Arizona Coyotes are kept as an inactive franchise ending in 2024, and Utah starts as a new club that year, as the NHL has it. The first Winnipeg Jets' seasons sit with today's Jets, following the NHL's own records feed.
- The wartime merged teams (Phil-Pitt 1943, Card-Pitt 1944) count for both clubs.
- The AFL's 1960 to 1969 seasons count for its clubs, and the AFL title games of 1960 to 1965 count as championships. From 1966 the Super Bowl is the title.
- Not counted: the ABA, WHA and AAFC, the Federal League of 1914 to 1915, and anything before each league's first season in the data.

`pnpm data` refreshes it. Finished seasons are kept as they are and only the recent ones are refetched; every request retries; a season that fails or does not add up (wins must equal losses) keeps its last good copy; and the file is only rewritten when something actually changed. `pnpm data:full` refetches everything.

A GitHub Action (`.github/workflows/refresh-data.yml`) runs this every morning, runs the tests, and commits the file only when both pass, which redeploys the site.

`pnpm map` redraws the base map (`src/data/map.json`) from Natural Earth shapes.

## Stack

Next.js (App Router), Tailwind CSS, Motion for layout animation, NumberFlow for figures. No database and no API keys: the page is static and all scoring runs in the browser, so every control responds instantly and any view can be shared as a link.

Not affiliated with any league or team. Logos are loaded from ESPN and belong to their owners.
