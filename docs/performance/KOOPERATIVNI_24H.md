# METEO-008: dávkovaná příprava 24h, v0.20.1

Výchozí revize 9098210. Dokončen dílčí checkpoint; celé METEO-008 zůstává
rozpracované. Hotový min/max výběr a časová osa se znovu nenavrhují.

Viditelný přehled s funkčním IntersectionObserver a více než 10 000 načtenými
řádky používá společný generátor currentChartDataSteps. Zachovává původní
sampleExtremaSteps; průchod pro přerušení přes chybějící hodnoty nově předává
řízení po 256 řádcích. Existující analyticsWorkSlice omezuje dávku na přibližně
8 ms nebo 64 kroků. Jediný setTimeout pokračuje až v další úloze. Nejde o
pevnou časovou garanci. Malá historie, chybějící IO a explicitní buildCharts
ponechávají synchronní API. Žádná nová závislost, síťový požadavek ani polling.

Soukromý rozpracovaný výsledek se zveřejní atomicky. Dirty zůstává do vykreslení.
Invalidace ruší timer i generátor (také při mutaci stejného pole); každá dávka
ověří relaci stanice, identitu/délku dat, stránku, tab, background a viewport.
Odchod bez invalidace zastaví práci při nejbližší dávce. Chyba ponechá možnost
opakování při návratu/obnově. Canvas je během přípravy skrytý, plocha zachovaná.

## Ověření

430/430 Node testů, z toho 4 nové scénáře v
`tests/current-chart-cooperative.test.js`: atomický výsledek/shoda, slučování
opakovaných refreshů, in-place invalidace, stanice/data/page/tab/background,
viewport, chyba a návrat. Existující nezávislé min/max oracles zůstaly nezměněné.

`scripts/check-current-cooperative-browser.py` používá skutečný Chromium/Chart.js,
řízené zdroje, tři původní konfigurace, vykreslení a porovnání všech bodů;
kontroluje přetečení při 320/390/767/1440 px a chyby konzole.
Profil běžel postupně před/po, jeden warmup a tři měřené běhy, CPU bez zpomalení,
stejná syntetická data (krok100ms, nuly/null). SHA celého výstupu shodná pro
každou velikost. Raw výsledky: `kooperativni-24h.json`.

| Vzorků | Nejdelší část před → po (ms) | Celá příprava před → po (ms) |
|---|---|---|
| 1 000 | 0,8 → 1,3 | 0,8 → 1,3 |
| 10 000 | 8,9 → 4,3 | 8,9 → 4,3 |
| 100 000 | 49,8 → 3,9 | 49,8 → 72,9 |
| 250 000 | 103,7 → 6,3 | 103,7 → 197,6 |

Tabulka uvádí mediány. Měří pouze přípravu již vybraných řádků, nikoli síť,
celý refreshUI nebo Chart.update. Malé synchronní případy vykazují variabilitu;
netvrdíme jejich zrychlení. Dávkování prodlužuje celkový čas za cenu kratších
souvislých úseků. Nejde o INP/Web Vitals/RAM ani test fyzického Safari/iPhone.

## Další krok

Výběr/kopie/stabilní sort výřezu, plné statistiky a závěrečný Chart.update
zůstávají synchronní. Dále změřit tyto zbylé úseky v celém refreshUI včetně
nového asynchronního dokončení; starý profil synchronního commitu nesmí být
vydáván za celkovou dobu vykreslení. Teprve podle dopadu pokračovat ve výběru
rozsahu či agregacích. Neměnit přesné statistiky, 0/null nebo pořadí duplicit.

Původní `check-current-chart-visibility-browser.py` také prošel: skutečný IO,
3stanice/12k, témata,320–1440px, mezery a touch tooltip. Instrumentace nyní počítá
skutečně aplikovaný graf přes applyCurrentChartData (společný sync/async commit),
nikoli pouze synchronní vstup buildCharts; původní věcné aserce zachovány.
