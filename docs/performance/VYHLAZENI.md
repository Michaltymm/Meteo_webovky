# Jednoprůchodové vyhlazení — v0.18.4

2026-10-24, další malá část METEO-008. Výchozí `f47c9d2` (HTML v0.18.3),
výsledek v commitu tohoto dokumentu. Navazuje na již hotový profil
[heatmapy/vyhlazení/noci](NOCNI_ANALYZA.md); tyto analýzy se neopakují.
Měněno pouze `analyticsMoving`, sdílené teplotou a tlakem v kartách1 a3.

## Změna a zachování výpočtů

Původní funkce vytvářela pole bodů pro celou historii, následně přes
`sampleExtrema` vybírala nejvýše600bodů. Nový průchod počítá každý původní
pětiměřicí průměr ve stejném pořadí součtů/odečtů a průběžně vybírá body.
Nemění obecný sampler ani jiné grafy. Pro více než600záznamů má stejných
199košů s mezemi floor(b*n/199), první minimum/maximum i první neplatnou
hodnotu každého koše a oba koncové body. Shody zachovávají první výskyt.
Výstup je v původním pořadí indexů včetně časových duplicit. Malé rozsahy
do600vracejí každý vypočtený bod jako dříve.

Živá pracovní paměť funkce je omezená počtem reprezentantů: nejvýše
3×199+2vybraných indexů, několik kandidátů aktuálního koše a fronta pěti
hodnot (při přidání přechodně šest). Nevzniká plné pole n bodů; kandidáti
se stále průběžně alokují a uvolňují. Čas zůstává O(n), pomocný prostor
O(limit) místo O(n). Nejde o neredukované statistiky z redukovaného vstupu:
všechny průměry vznikají ze všech původních měření, výběr je až jejich
vizualizace. Původní úplné souhrny/model a memo hotových vyhlazení se nemění.

Chybějící/nečíselná/nonfinite hodnota nebo mezera>3h resetuje frontu;
první čtyři hodnoty okna nemají průměr. Nula, záporné hodnoty, přesně3h,
duplicity, mezikošová kontinuita i původní chování numerického přetečení
zůstávají. Není interpolace, nový request, časovač, cache nebo závislost.
Nový kód nezavádí dávkování, velká historie může nadále blokovat vlákno.

## Metodika a rychlost

`scripts/profile-analytics-details.py --moving-only`, skutečný Chromium
154.0.8037.57 a lokální skutečné SRI knihovny, žádné živé služby. Připravený
model se neměří. Viewport390×844, Europe/Prague, omezené animace. Jedno
zahřátí a pět vzorků s GC před vzorkem; tabulka jsou mediány synchronního
volání v ms. Stejná data jako NOCNI_ANALYZA: `regular` po5min, `dense` po100ms,
konec24.10.2026 ve12:00. Teplota má null/nuly/extrém85°C a sinusový průběh,
tlak je v tomto profilu konstantní1010hPa. Proměnlivý tlak a jeho chybějící
hodnoty ověřují zvlášť regresní testy. Každý scénář má novou stránku;
před/po, CPU×4, alokace, Node a UI testy běžely sekvenčně.

| Řádků | Rozložení | T před | T po | Tlak před | Tlak po |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 000 | regular | 0,4 | 0,4 | 0,3 | 0,2 |
| 1 000 | dense | 0,4 | 0,4 | 0,2 | 0,2 |
| 10 000 | regular | 1,8 | 1,9 | 1,7 | 1,2 |
| 10 000 | dense | 1,7 | 2,1 | 1,8 | 1,2 |
| 100 000 | regular | 16,9 | 10,9 | 15,3 | 8,9 |
| 100 000 | dense | 27,0 | 11,8 | 16,3 | 10,3 |
| 250 000 | regular | 36,3 | 28,8 | 32,4 | 22,3 |
| 250 000 | dense | 53,6 | 24,0 | 37,6 | 20,9 |
| 100 000, CPU×4 | regular | 64,3 | 59,4 | 61,5 | 41,9 |
| 100 000, CPU×4 | dense | 73,0 | 54,4 | 61,9 | 50,5 |

Na malých datech není doloženo obecné zrychlení (T/10k i mírně pomalejší).
Na velkých odpadá druhý průchod a velké dočasné pole. CPU×4 je emulace,
nikoli telefon; ani54–59ms není záruka16ms/plynulého snímku. Časy neobsahují
CSV, síť, Chart.js update nebo paint a nejsou měřením INP celého webu.

SHA256 všech výsledných T/tlakových bodů je před/po shodné ve všech10scénářích.
Identita a pořadí všech zdrojových řádků se kontroluje mimo časování.

## Samostatné alokační měření

`--moving-only --allocations-only --counts 250000`, pouze teplotní výpočet
po zahřátí obou veličin. Jeden samostatný vzorek na scénář, bez časových
výsledků. V8 HeapProfiler sampling32768B se započtením objektů sesbíraných
minor/major GC; součet selfSize celého profilu, včetně malé režie evaluátoru.
Odhaduje **alokované bajty během volání**, ne počet živých objektů ani RAM.

| Rozložení | Odhad alokovaných B před | Po | Pokles |
| --- | ---: | ---: | ---: |
| regular | 29 282 448 | 16 301 940 | ~44 % |
| dense | 25 753 380 | 16 733 468 | ~35 % |

Přesné body se shodují i v obou alokačních scénářích, výstup598bodů.
Naměřený heap na hranici návratu a poGC je v obou revizích kolem37,5–37,7MB;
GC může velké dočasné pole uvolnit dříve, než CDP heap přečte. Z těchto snímků
nelze určit peak/RSS, celkovou úsporu RAM, fragmentaci nebo dlouhodobé úniky.
Vzorkovaný odhad s jediným během není přesné účtování alokací. Strukturální
omezení živého pracovního pole je vlastnost algoritmu, nikoli měření celé RAM.

## Regrese a další krok

`tests/analytics-moving.test.js`:8nových testů proti původnímu algoritmu
(všechny průměry + nezměněný obecný sampler), přesné číselné porovnání včetně
nonfinite/-0. Okraje600/601/602, mezery/null/nuly/shody/extrémy/duplicity,
numerické přetečení,150náhodných historií pro T i tlak a250k s Proxy:
každý původní řádek přečten právě jednou, zdroj zmrazený, cache nezměněná,
bez requestů/časovačů. Celá sada350/350 Node.

Rozšířený skutečný browser harness navíc ověřuje zapnutí/vypnutí obou
vyhlazení na100k datech, stejné memo při návratu, nezměněné úplné souhrny
a žádné další requesty; ostatní9grafů/3stanice/zoom/PNG/320–1440px/2témata
zůstávají součástí ověření. Výsledek běhu a publikování jsou v auditu.

METEO-008 zůstává Rozpracováno. Další malá etapa: heatmapové buňky na hustých
datech podle již uloženého profilu NOCNI_ANALYZA; podle potřeby oddělit cenu
agregace a plátna, neopakovat hotový model/párování/noc/vyhlazení. Velký
parser, dávkování zbylé synchronní práce, nezávislé rozsahy a streaming dále.

## Reprodukce a surová data

- [Časy před](vyhlazeni-before.json), [po](vyhlazeni-after.json).
- [CPU×4 před](vyhlazeni-cpu4-before.json), [po](vyhlazeni-cpu4-after.json).
- [Alokace před](vyhlazeni-allocations-before.json), [po](vyhlazeni-allocations-after.json).

```bash
git show f47c9d2:index.html > /tmp/meteo-smoothing-before.html
python scripts/profile-analytics-details.py --html /tmp/meteo-smoothing-before.html --chartjs /tmp/meteo-chart.js --paho /tmp/meteo-paho.js --moving-only --output /tmp/smoothing-before.json
python scripts/profile-analytics-details.py --html index.html --chartjs /tmp/meteo-chart.js --paho /tmp/meteo-paho.js --moving-only --output /tmp/smoothing-after.json
```

Pro CPU oba s `--counts 100000 --cpu 4`. Pro alokace oba s
`--counts 250000 --allocations-only`. Časové běhy nezahrnují sampling profileru.
