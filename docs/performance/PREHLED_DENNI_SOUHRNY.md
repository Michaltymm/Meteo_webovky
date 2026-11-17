# METEO-008: přesné průběžné denní souhrny přehledu, v0.20.6

Výchozí a33dd90/v0.20.5. Navazuje na naměřený CPU buildTempOverview kolem90ms
při regular250k. Parser, roční výpočty ani hlavní agregace se znovu nenavrhují.

## Změna

Původní přehled T/RH/P zkopíroval každou hodnotu do denního vals pole, formátoval
stejné datum pro každý bod a následně znovu prošel hodnoty přes numericSummary.
Nový overviewDaySummaries počítá min/max/sum/count průběžně v přesném pořadí
původního source. Průměr se dokončí až po průchodu, bez změny přesnosti či
zaokrouhlení. Klíč data se formátuje jen při změně civilního dne/roku/měsíce.
Nevzniká vals pole všech měření ani další cache; pracovní souhrny jsou O(počet dní).

Sheets používá existující historyRangeBounds s původním přesným časovým cutFrom
a horní mezíInfinity. Bez slice/kopie rozsahu. MQTT/both zachovají úplný scan
s původním predikátem kvůli hodinám příjmu. Odpadá implicitní Date porovnání
v každém bodě. Nezaměňuje se rozsah dní za celé kalendářní dny: první den zůstává
přesně oříznutý na milisekundu, budoucí řádky se stejně jako dříve nevylučují.
Vše nadále začíná epochou0 jako v původním přehledu; jde o zachování kontraktu,
ne změnu interpretace legacy času. Tlak má vlastní přesné hodnoty, null a0 odlišeny.

Denní pořadí sum se nemění, včetně duplicit a citlivého floating-point sčítání.
Původní řazení datových klíčů, tabulka, počty, grafy, jednotky, ovládání a názvy
zůstávají. Statistický vstup obsahuje všechna platná měření vybraného rozsahu.
Bez nového fetch/timer/worker/dependency/Chart instance nebo invalidace cache.

## Ověření

Lokálně455/455 celé Node sady před doplněním posledního DST testu, pak8/8cílených
regresí overview-summaries. Nové testy:3metriky/4rozsahy vs nezávislé full-array
souhrny, null/0 a pořadí součtů/frozen zdroj, hranice+future/pre-epoch,
250kProxy<400čtení pro289bodový den a≤2formátování data, MQTT/both neuspořádané
hodiny, původní grafové hodnoty a tabulka, DST/UTC/EuropePrague/AsiaKathmandu.

Skutečný Chromium/SRI/3konfigurace/12k unordered/320–1440px prošel: původní
načítání/sort/abort/roční tab a navíc ovládání Přehled→Vše→T/RH/P přes UI.
Výsledné grafové hodnoty porovnány s původními vals/statistikami; bez pageerror
nebo socketů. Čtyři horní pohledy a konfigurace beze změny. Živé služby/fyzický
Safari/iOS ani přímé Pages widgety nejsou tímto testem ověřeny.

## Měření před/po

Stejný benchmark-statistics-browser.py jako v0.20.5,16profilů postupně,
1warmup+3běhy, skutečný Chromium, Europe/Prague, CPU bez škrcení. Základní
snapshot připraven mimo časy. Hourly/annual cache se maže; overview má jako
v předchozí metodice vypnuté chartOverview.update pro oddělení CPU/DOM přípravy
od Chart layout/paint. Regular krok300s, dense3body/sekundu; rozsahVše, T.
Všech8párů plných hourly/annual/overview SHA shodné, žádná redukce dat.
Raw: prehled-souhrny-before.json/prehled-souhrny-after.json.

| Řádků | Přehled regular před → po ms | Přehled dense před → po ms |
|---|---:|---:|
| 1000 | 0,5 → 0,5 | 0,5 → 0,2 |
| 10000 | 5,7 → 1,4 | 2,5 → 0,2 |
| 100000 | 34,9 → 15,0 | 26,2 → 2,0 |
| 250000 | 79,9 → 27,1 | 49,9 → 4,7 |

Mediány. Regular má více denních řádků tabulky, proto dražší DOM přípravu než
hustá jednodenní data. Neměněné annual/hourly vykazují variabilitu: například
annual dense250k32,2→39,9ms není dokladem změny jejich algoritmu. Nejde o INP,
Web Vitals, paměť, síť, hotový snímek nebo měření fyzického telefonu. Ani27,1ms
není16ms garance. Strukturálně odpadla per-row vals pole, RAM se zde neměřila.

## Pokračování

Dílčí checkpoint hotový, celé008Rozpracováno. PřehledVše při víceletých datech
stále synchronně tvoří dlouhou tabulku a pak Chart.update; samostatně změřit
její HTML/DOM a Chart část před případným dávkováním či stránkováním. Hodinové
cold dense~26ms a roční~40ms zůstávají dalšími kandidáty. Hotové přesné souhrny,
parser/sort a24h výběr neopakovat. ESP084 stále blokuje firmware/API.
