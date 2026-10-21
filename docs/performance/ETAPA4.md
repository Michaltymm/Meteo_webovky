# Etapa 4: společné souhrny a obnova na pozadí

21. 10. 2026, v0.2.1 (`0ae577a`) → v0.2.2. METEO-005 dokončeno;
METEO-038 rozpracované. Surová měření jsou v [stage4](stage4/after.json).

## Co se změnilo

`dataAggregates` vytvoří jedním průchodem originálních řádků globální teplotní
extrémy s původními řádky, denní maxima srážek, denní/měsíční součty a počty
T/RH a souhrn dnešních T/RH/P/srážek s posledním validním napětím. Používá je
`refreshUI`, `buildDailyGrid`, `buildAgg` a srážková část `buildCharts`.
Průměr zůstává vzorkový, pořadí sčítání stejné jako původní průchod. Při
shodném extrému zůstává první původní řádek, nula je validní a chybějící údaj
se nezaměňuje s nulou. Neplatné nekonečné hodnoty se nezahrnují.

Cache drží pouze jeden aktuální dataset: odkaz na zdroj a malé mapy dnů/měsíců,
nikoli kopii historie nebo tři stanice. `invalidateDerivedData` ji zahodí po
CSV/MQTT/resetu. Reference/počet řádků, místní datum a meze dne brání záměně
zdroje a starému dnešku po půlnoci. In-place oprava musí vždy invalidovat;
tato již existující povinnost platí pro všechny další mutace `store.rows`.
Externí pole předané `buildAgg` cache aktuální stanice nevytlačí.

Po prvním experimentu jsme omezili také opakovanou tvorbu řetězců klíčů:
sousední měření stejných kalendářních dnů/měsíců používají stejné skupiny.
Zachovává se pořadí vstupů i původní řazení výstupů. Mezilehlý experiment není
vydávaný výsledek; tabulky níže patří výsledné implementaci.

Nedopočítávají se dosud hodinové cache ani procentuální pokrytí bez ověřeného
měřicího plánu. Roční statistiky a porovnání hodin zatím mají vlastní výpočty.
METEO-038 proto zůstává rozpracované, i když hlavní opakované skeny jsou odstraněny.

## Metodika

Stejné prostředí/metodika jako [etapa 2](ETAPA2.md): skutečný Chromium
154.0.8037.57 a Chart.js 4.4.0, mobilní viewport390, Europe/Prague, offline
syntetická data, 1k/10k/100k/250k. Pět vzorků bez vyřazování prvního, medián.
Měření před/po probíhala postupně, bez souběžných testů/prohlížečů. Zvlášť
CPU×4 při 100k. `--aggregates` přidává před každý vzorek explicitní invalidaci
a měření `coldRefresh`; následná `refresh` již může využít souhrny.
Denní karty a oba agregační grafy následují ve stejném vzorku. Zahrnut je
synchronní skutečný DOM/Chart.js update, nikoli dokončení snímku/Web Vitals.

```bash
git show 0ae577a:index.html > /tmp/meteo-before.html
python scripts/profile-history.py --aggregates --html /tmp/meteo-before.html --chartjs /tmp/meteo-chart.js --output /tmp/before.json
python scripts/profile-history.py --aggregates --html index.html --chartjs /tmp/meteo-chart.js --output /tmp/after.json
python scripts/profile-history.py --aggregates --html /tmp/meteo-before.html --chartjs /tmp/meteo-chart.js --counts 100000 --cpu 4 --output /tmp/before-cpu4.json
python scripts/profile-history.py --aggregates --html index.html --chartjs /tmp/meteo-chart.js --counts 100000 --cpu 4 --output /tmp/after-cpu4.json
node --test tests/*.test.js
python scripts/check-background-browser.py --chartjs /tmp/meteo-chart.js --output /tmp/background.json
python scripts/check-interval-browser.py --chartjs /tmp/meteo-chart.js --at 2026-03-30T00:30:00+02:00 --output /tmp/stations.json
```

Chart.js lokálně získat dle [README](README.md). Python Playwright/Chromium jsou
volitelné vývojové nástroje; produkce nemá novou závislost. Cold znamená
invalidovanou aplikační cache, nikoli restart browseru nebo chladný JIT.

## Výsledky

Milisekundy, medián pěti vzorků, CPU×1:

| Řádků | Refresh po invalidaci před → po | Opakovaný refresh před → po | Denní karty před → po | Denní graf před → po | Měsíční graf před → po |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 000 | 23,9 → 24,4 | 20,6 → 21,1 | 0,6 → 0,2 | 2,4 → 1,7 | 1,6 → 1,5 |
| 10 000 | 28,9 → 27,3 | 21,6 → 18,8 | 1,1 → 0,2 | 4,3 → 2,9 | 3,0 → 1,5 |
| 100 000 | 51,1 → 41,2 | 43,4 → 22,0 | 6,5 → 0,2 | 17,4 → 3,5 | 13,5 → 2,2 |
| 250 000 | 89,4 → 46,3 | 79,1 → 23,1 | 33,0 → 0,2 | 35,4 → 3,3 | 27,2 → 2,4 |

[Před](stage4/before-0ae577a.json), [po](stage4/after.json).
Při CPU×4 a100k refresh po invalidaci **213,3 → 136,4 ms**, opakovaný
**183,9 → 109,9 ms**, denní karty **29,1 → 0,9 ms**, denní graf
**74,9 → 18,3 ms**, měsíční **57,2 → 11,5 ms**.
[Před CPU×4](stage4/before-cpu4.json), [po CPU×4](stage4/after-cpu4.json).

Přínos roste s historií. Malý 1k scénář mírně kolísá i opačně; nelze slíbit
zrychlení každého snímku. Cache pomůže při opakovaném použití stejné revize;
po nové CSV/MQTT revizi se výpočet opravdu provede znovu. Identické CSV již
z předchozích etap parser/render přeskočí, proto nelze úsporu každého zde
měřeného refresh automaticky násobit počtem síťových pollů. Průzkumník stále
počítá statistiky z celého zvoleného úseku. CPU×4 nad100ms zůstává důvodem
dalšího profilu hlavního vlákna, ne automatickým důvodem přidat worker.

JS heap po GC při250k po zahřátí **56,36 → 56,48 MiB**, tedy přibližně
0,12 MiB navíc v tomto fixture. Osm Chart instancí zůstalo osm i po30cyklech.
To není celková RAM ani důkaz několika dnů bez úniku. Reálný CSV text/parser
v tomto profilu nejsou měřeny; nová cache má velikost dle počtu dnů/měsíců,
nikoli pevnou velikost pro libovolnou historii.

## Viditelnost stránky a požadavky

Periodické Sheets, UV a overview callbacky ve skryté kartě nepouštějí síť.
Astronomický UI timer ve skrytí také nevykresluje. Časovače zůstávají registrované,
neprovádějí uvedenou práci; zahájené požadavky se neruší a ruční obnova/start
zůstávají explicitní akce. MQTT se kvůli viditelnosti neodpojuje ani znovu
nevytváří, zprávy nadále zpracovává.

Poslední pokus se sleduje zvlášť pro Sheets/UV/overview v relaci stanice.
Pokus reguluje četnost, **není potvrzením úspěšné synchronizace**. Návrat
zkontroluje stáří dle příslušného intervalu; nejbližší původní timer znovu
nekopíruje právě provedený refresh. UV při změně dne smí načíst nový den,
neúspěch však nevyvolá retry při každém přepnutí viditelnosti. UV/overview
mají sdílenou rozpracovanou Promise; Sheets již deduplikaci měly. Čekající
konfigurace stanice se nepředbíhá a starý timer nemůže obnovovat novou relaci.

Prohlížečový test používá skutečné časovače a skutečný UI/Chart.js, řízenou
síť a **syntetickou vlastnost document.hidden + visibilitychange**, nikoli
měření nativního uspávání OS. [Výsledek](stage4/background-browser.json):

| Scénář | Počet fixture HTTP požadavků |
| --- | ---: |
| Skrytí10min | 0 |
| Návrat10min, zastaralé Sheets a overview | 3 (aktivní Sheets + dvě ostatní stanice) |
| Skrytí dalších24h | 0 |
| Návrat další den | 4 (navíc UV nového dne) |
| Opakované přepínání při běžícím refreshi | Bez dalších požadavků |

Test zachoval 1000 originálních řádků a promítl opravu starého extrému85→99;
návrat přes půlnoc vyčistil dnešní karty i denní panel při nedostupném dnešku.
Viewport390 bez přetečení/pageErrors. [Tři konfigurace](stage4/stations-browser.json)
prošly také plným startupem, souběžným full requestem, kalendářem23/25h a
porovnáním. [Smoke](stage4/smoke.json) prošel všemi záložkami/osmi metrikami;
jeho časy zde nejsou srovnávány, jde pouze o funkční kontrolu.

## Regrese a další etapa

**96/96 Node testů**, 16 nových: nezávislé plné referenční souhrny, roky,
null/nula/nekonečno, žádný další scan250k při sdílení, oprava/smazání/MQTT,
půlnoc, selhání UV, rychlá viditelnost, ruční refresh, staré timery,
čekající full historie a MQTT-only/both bez nového klienta. Syntax/diff kontrola
prošla. Sdílený testovací DOM nově zachytává intervaly a události viditelnosti.
Dosavadní test in-place mutace doplnil povinné `invalidateDerivedData`.

Následuje hodinová agregace a množství/pokrytí pozorování v METEO-038, s jasným
oddělením počtu vzorků, pozorovaného času a dostupnosti podle plánu. Poté lze
stavět bateriový modul METEO-019/020/031. Explicitní zóna/UV časové značky
METEO-048 a omezená cache stanic METEO-004 zůstávají samostatné položky.
Skutečné mobilní zařízení, živý broker, reálná pomalá síť a několikadenní soak
zde nebyly ověřeny. Konfigurace, workflow, archiv a main jsou beze změn.
